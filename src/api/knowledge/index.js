import request from '@/utils/request'
import { saveAs } from 'file-saver'
import { businessError } from '@/utils/business-error'

export const listRecords = (type, params) =>
  request({ url: `/knowledge/${type}/list`, method: 'get', params })
export const getRecord = (type, id) =>
  request({ url: `/knowledge/${type}/${id}`, method: 'get' })
export const getKpNames = (ids) =>
  request({ url: '/knowledge/kp/names', method: 'get', params: { ids: ids.join(',') } })
export const saveRecord = (type, data) =>
  request({ url: `/knowledge/${type}`, method: data.id ? 'put' : 'post', data })
export const deleteRecord = (type, id) =>
  request({ url: `/knowledge/${type}/${id}`, method: 'delete' })
export const knowledgeRequest = (url, method = 'get', data, params) =>
  request({ url: `/knowledge${url}`, method, data, params })
export const getAssetBlob = (id) =>
  request({
    url: `/knowledge/asset/${id}/content`,
    method: 'get',
    responseType: 'blob',
    timeout: 120000
  })
export const resumeImport = (batchId) =>
  request({
    url: `/knowledge/import/${batchId}/resume`,
    method: 'post',
    timeout: 120000,
    headers: { repeatSubmit: false }
  })
export function uploadKnowledge(url, file, fields = {}) {
  const data = new FormData()
  data.append('file', file)
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null)
      data.append(
        key,
        typeof value === 'object' ? JSON.stringify(value) : value
      )
  })
  return request({
    url: `/knowledge${url}`,
    method: 'post',
    data,
    timeout: 120000,
    headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false }
  })
}
export async function downloadKnowledge(url, filename, params) {
  const blob = await request({
    url: `/knowledge${url}`,
    method: 'get',
    params,
    responseType: 'blob',
    timeout: 120000
  })
  if (blob.type?.includes('json')) {
    const result = JSON.parse(await blob.text())
    throw businessError(result, '下载失败，请重试')
  }
  saveAs(blob, filename)
}
export async function exportQuestions(data, filename) {
  const blob = await request({
    url: '/knowledge/export/questions',
    method: 'post',
    data,
    responseType: 'blob',
    timeout: 120000,
    headers: { repeatSubmit: false }
  })
  if (blob.type?.includes('json')) {
    const result = JSON.parse(await blob.text())
    throw businessError(result, '导出失败')
  }
  saveAs(blob, filename)
}
export function importHtml(file, resources, fields) {
  const data = new FormData()
  data.append('file', file)
  resources.forEach((resource) => data.append('resources', resource))
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '')
      data.append(key, value)
  })
  return request({
    url: '/knowledge/import/html',
    method: 'post',
    data,
    timeout: 120000,
    headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false }
  })
}
