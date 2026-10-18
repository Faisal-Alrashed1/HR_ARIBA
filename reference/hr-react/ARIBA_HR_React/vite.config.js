import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// برنامج الموارد البشرية (index.html) + نموذج التقديم العام (apply.html)
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Riyadh' }).slice(0, 16)) },
  plugins: [react()],
  resolve: { alias: [
    { find: /^react\/jsx-runtime$/, replacement: resolve(__dirname, 'src/lib/ico-runtime.js') },
    { find: /^react\/jsx-dev-runtime$/, replacement: resolve(__dirname, 'src/lib/ico-runtime.js') },
  ] },
  build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), apply: resolve(__dirname, 'apply.html') } } },
})
