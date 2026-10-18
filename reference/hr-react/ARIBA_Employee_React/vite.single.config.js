import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'node:path'

// نسخة ملف HTML واحد (كل شيء مدمج داخل الملف) — شغّل: npx vite build -c vite.single.config.js
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Riyadh' }).slice(0, 16)) },
  plugins: [react(), viteSingleFile()],
  resolve: { alias: [
    { find: /^react\/jsx-runtime$/, replacement: resolve(__dirname, 'src/lib/ico-runtime.js') },
    { find: /^react\/jsx-dev-runtime$/, replacement: resolve(__dirname, 'src/lib/ico-runtime.js') },
  ] },
  build: { outDir: 'dist-single', rollupOptions: { input: resolve(__dirname, 'employee.html') } },
})
