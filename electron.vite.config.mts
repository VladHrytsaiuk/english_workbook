import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = dirname(fileURLToPath(import.meta.url))

const shared = resolve(root, 'src/shared')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } }
  },
  preload: {
    resolve: { alias: { '@shared': shared } }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(root, 'src/renderer/src'),
        '@shared': shared
      }
    },
    plugins: [react()]
  }
})
