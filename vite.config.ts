import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function copyExtensionAssets(): Plugin {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const root = import.meta.dirname
      const dist = path.resolve(root, 'dist')
      mkdirSync(dist, { recursive: true })

      const manifestSrc = path.resolve(root, 'manifest.json')
      if (existsSync(manifestSrc)) {
        const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'))
        if (manifest.side_panel?.default_path) {
          manifest.side_panel.default_path = 'sidepanel.html'
        }
        if (manifest.options_page) {
          manifest.options_page = 'options.html'
        }
        writeFileSync(path.resolve(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
      }

      const bgSrc = path.resolve(root, 'background.js')
      if (existsSync(bgSrc)) copyFileSync(bgSrc, path.resolve(dist, 'background.js'))

      const iconsSrc = path.resolve(root, 'icons')
      if (existsSync(iconsSrc)) {
        cpSync(iconsSrc, path.resolve(dist, 'icons'), { recursive: true })
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), copyExtensionAssets()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(import.meta.dirname, 'sidepanel.html'),
        options: path.resolve(import.meta.dirname, 'options.html'),
      },
    },
  },
})
