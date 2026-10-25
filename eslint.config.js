import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import { resolveBuiltinPresets } from 'unimport'
import { autoImportPresets, customAutoImports } from './vite/auto-imports.js'

const imports = await resolveBuiltinPresets(autoImportPresets)
const autoImportGlobals = Object.fromEntries([
  ...imports.filter(item => !item.type).map(item => item.as || item.name),
  ...Object.values(customAutoImports).flat()
].map(name => [name, 'readonly']))

export default [
  { ignores: ['node_modules/**', 'dist/**', 'tests/**/coverage/**'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' }
  },
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: { globals: { ...globals.browser, ...autoImportGlobals } }
  },
  {
    files: ['*.js', 'vite/**/*.js', 'quality/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: { globals: globals.node }
  }
]
