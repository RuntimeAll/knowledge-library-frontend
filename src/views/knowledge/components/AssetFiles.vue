<template>
  <div>
    <el-alert
      v-if="frozen"
      title="成品文件冻结保存；需要改版时另存为新成品版本。"
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-upload
      v-if="editable && !frozen"
      :show-file-list="false"
      :auto-upload="false"
      :on-change="upload"
      :disabled="uploading"
    >
      <el-button
        v-hasPermi="['knowledge:asset:upload']"
        type="primary"
        plain
        icon="Upload"
        :loading="uploading"
      >
        {{ uploadLabel }}
      </el-button>
      <template #tip>
        <div class="el-upload__tip">
          {{ uploadTip }}
        </div>
      </template>
    </el-upload>
    <el-table
      v-loading="loading"
      :data="assets"
      empty-text="尚未上传原件"
      class="asset-table"
    >
      <el-table-column
        label="文件名"
        prop="originalName"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
      </el-table-column>
      <el-table-column label="操作" :width="selectable ? 300 : 190">
        <template #default="{ row }">
          <el-button
            v-hasPermi="['knowledge:asset:download']"
            link
            type="primary"
            @click="download(row)"
          >
            下载
          </el-button>
          <el-button
            v-if="
              (/image|pdf|html/.test(row.contentType || '') ||
              /\.(pdf|html?)$/i.test(row.originalName || '')) &&
              (!isPdf(row) || checkPermi(['knowledge:asset:download']))
            "
            v-hasPermi="['knowledge:asset:query']"
            link
            type="primary"
            @click="preview(row)"
          >
            预览
          </el-button>
          <el-button
            v-if="selectable"
            link
            type="primary"
            :disabled="String(selectedId) === String(row.assetId)"
            @click="$emit('selected', row.assetId)"
          >
            {{
              String(selectedId) === String(row.assetId)
                ? '已用作证据'
                : '设为核实证据'
            }}
          </el-button>
          <el-button
            v-if="editable && !frozen && removable"
            link
            type="danger"
            @click="remove(row.assetId)"
          >
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog
      v-model="previewOpen"
      title="原件预览"
      width="80%"
      append-to-body
      @closed="releasePreview"
    >
      <el-alert
        v-if="previewHtml"
        title="HTML 原件以隔离模式只读预览；脚本、表单和应用会话不可访问。完整原件可下载查看。"
        type="info"
        :closable="false"
      />
      <pdf-preview v-if="previewPdf && previewOpen" :asset-id="previewAsset.assetId" />
      <iframe
        v-else
        :src="previewUrl"
        class="asset-preview"
        :sandbox="previewHtml ? '' : 'allow-same-origin'"
        referrerpolicy="no-referrer"
        title="原件预览"
      />
      <template #footer>
        <el-button v-if="previewAsset" v-hasPermi="['knowledge:asset:download']" type="primary" plain @click="download(previewAsset)">下载原件</el-button>
        <el-button @click="previewOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import {
  uploadKnowledge,
  knowledgeRequest,
  downloadKnowledge,
  getAssetBlob
} from '@/api/knowledge'
import { ElMessage } from 'element-plus'
import { defineAsyncComponent } from 'vue'
import { checkPermi } from '@/utils/permission'
const PdfPreview = defineAsyncComponent(() => import('./PdfPreview.vue'))
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  purpose: { type: String, default: 'SOURCE_ORIGINAL' },
  editable: Boolean,
  frozen: Boolean,
  single: Boolean,
  selectable: Boolean,
  selectedId: [String, Number],
  removable: { type: Boolean, default: true },
  uploadLabel: { type: String, default: '上传原件' },
  uploadTip: {
    type: String,
    default:
      '先上传再保存表单；来源可保存多个独立原件，成品每个版本保存一个文件。'
  }
})
const emit = defineEmits(['update:modelValue', 'selected', 'busy'])
const assets = ref([]),
  loading = ref(false),
  uploading = ref(false),
  previewOpen = ref(false),
  previewUrl = ref(''),
  previewHtml = ref(false),
  previewPdf = ref(false),
  previewAsset = ref(null)
let generation = 0
watch(uploading, (value) => emit('busy', value))
watch(
  () => props.modelValue,
  async (ids) => {
    const ticket = ++generation
    loading.value = true
    try {
      const result = await Promise.all(
        (ids || []).filter(Boolean).map((id) =>
          knowledgeRequest(`/asset/${id}`)
            .then((r) => r.data)
            .catch(() => ({
              assetId: id,
              originalName: `文件 ${id}（无法读取）`
            }))
        )
      )
      if (ticket === generation) assets.value = result
    } finally {
      if (ticket === generation) loading.value = false
    }
  },
  { deep: true, immediate: true }
)
function formatSize(size) {
  return size == null
    ? '—'
    : size > 1048576
      ? `${(size / 1048576).toFixed(1)} MB`
      : `${Math.ceil(size / 1024)} KB`
}
async function upload(uploadFile) {
  uploading.value = true
  try {
    const response = await uploadKnowledge('/asset/upload', uploadFile.raw, {
      purpose: props.purpose
    })
    emit(
      'update:modelValue',
      props.single
        ? [response.data.assetId]
        : [...props.modelValue, response.data.assetId]
    )
    ElMessage.success('原件上传成功，请保存表单完成关联')
  } catch {
    /* interceptor reports error */
  } finally {
    uploading.value = false
  }
}
function remove(id) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => String(item) !== String(id))
  )
}
async function download(row) {
  try {
    await downloadKnowledge(
      `/asset/${row.assetId}/content`,
      row.originalName || '原件'
    )
  } catch (e) {
    ElMessage.error(e.message || '下载失败')
  }
}
function releasePreview() {
  if (previewUrl.value.startsWith('blob:'))
    URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewAsset.value = null
  previewPdf.value = false
}
onBeforeUnmount(releasePreview)
function isPdf(row) {
  return /pdf/i.test(row.contentType || '') || /\.pdf$/i.test(row.originalName || '')
}
async function preview(row) {
  try {
    releasePreview()
    previewAsset.value = row
    previewPdf.value = isPdf(row)
    previewHtml.value =
      /html/.test(row.contentType || '') ||
      /\.html?$/i.test(row.originalName || '')
    if (previewPdf.value) {
      previewOpen.value = true
      return
    } else if (previewHtml.value) {
      const blob = await getAssetBlob(row.assetId)
      if (blob.type?.includes('json')) {
        const error = JSON.parse(await blob.text())
        throw new Error(error.msg || '读取原件失败')
      }
      previewUrl.value = URL.createObjectURL(
        new Blob([blob], { type: 'text/html;charset=utf-8' })
      )
    } else {
      const response = await knowledgeRequest(`/asset/${row.assetId}/preview`)
      previewUrl.value = response.data.url
    }
    previewOpen.value = true
  } catch (error) {
    ElMessage.error(error.message || '预览失败')
  }
}
</script>
<style scoped>
.asset-table {
  margin-top: 12px;
}
.asset-preview {
  border: 0;
  width: 100%;
  height: 65vh;
}
</style>
