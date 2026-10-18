import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'node:path'

// صفحة التقديم للمرشحين كملف HTML واحد جاهز للرفع على أي استضافة: npx vite build -c vite.apply.config.js
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-apply', rollupOptions: { input: resolve(__dirname, 'apply.html') } },
})
