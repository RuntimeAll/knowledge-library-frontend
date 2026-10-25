import autoImport from 'unplugin-auto-import/vite'
import { autoImportPresets, customAutoImports } from '../auto-imports.js'

export default function createAutoImport() {
  return autoImport({
    imports: [...autoImportPresets, customAutoImports],
    dts: false
  })
}
