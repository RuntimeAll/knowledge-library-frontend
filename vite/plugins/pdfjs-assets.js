import { createReadStream, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const packagePath = require.resolve('pdfjs-dist/package.json')
const packageRoot = path.dirname(packagePath)
const { version } = JSON.parse(readFileSync(packagePath, 'utf8'))
const prefix = `pdfjs/${version}/`
const files = new Map()
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  for (const file of readdirSync(path.join(packageRoot, folder), { withFileTypes: true })) {
    if (file.isFile()) files.set(`${folder}/${file.name}`, path.join(packageRoot, folder, file.name))
  }
}

// Keep CJK fonts and image decoders local in both Vite development and built output.
export default function pdfjsAssets() {
  let base = '/'
  return {
    name: 'knowledge-pdfjs-assets',
    configResolved(config) { base = config.base },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname
        const route = `${base}${prefix}`
        if (!pathname.startsWith(route)) return next()
        const file = files.get(pathname.slice(route.length))
        if (!file) { response.statusCode = 404; response.end(); return }
        const types = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.ttf': 'font/ttf', '.pfb': 'application/octet-stream' }
        response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
        createReadStream(file).on('error', () => response.destroy()).pipe(response)
      })
    },
    generateBundle() {
      for (const [name, file] of files) {
        this.emitFile({ type: 'asset', fileName: prefix + name, source: readFileSync(file) })
      }
    }
  }
}
