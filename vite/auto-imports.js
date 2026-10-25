// Shared by Vite and ESLint; globals must match actual automatic imports.
export const autoImportPresets = ['vue', 'vue-router', 'pinia']
export const customAutoImports = {
  '@/utils/dict': ['useDict'],
  '@/utils/ruoyi': ['selectDictLabel']
}
