import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const sharedModelsFolder = fileURLToPath(new URL('../src/deps/astro/', import.meta.url))
const leipzigDataFolder = fileURLToPath(new URL('../data/leipzig-8/', import.meta.url))
const leipzigEvidenceFolder = fileURLToPath(new URL('../output/leipzig-votings/evidence/', import.meta.url))

const contentTypes: Record<string, string> = { '.json': 'application/json', '.png': 'image/png' }

// In development the Leipzig review reads the local data and evidence folders instead of the published ones.
function serveLeipzigFolders(): Plugin {
  const mounts = [
    { prefix: '/leipzig-data/', folder: leipzigDataFolder },
    { prefix: '/leipzig-evidence/', folder: leipzigEvidenceFolder },
  ]
  return {
    name: 'serve-leipzig-folders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const mount = mounts.find(({ prefix }) => request.url?.startsWith(prefix))
        if (!mount || !request.url) return next()
        const relative = normalize(decodeURIComponent(request.url.slice(mount.prefix.length).split('?')[0]))
        const path = join(mount.folder, relative)
        if (relative.startsWith('..') || !existsSync(path) || !statSync(path).isFile()) {
          response.statusCode = 404
          return response.end()
        }
        response.setHeader('Content-Type', contentTypes[extname(path)] ?? 'application/octet-stream')
        createReadStream(path).pipe(response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.SESSION_REVIEW_BASE ?? '/',
  plugins: [react(), serveLeipzigFolders()],
  resolve: {
    alias: [{ find: /^@srw-astro\/models\/(.+)$/, replacement: `${sharedModelsFolder}$1.ts` }],
  },
})
