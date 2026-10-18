import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// تطبيق الموظف (employee.html)
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Riyadh' }).slice(0, 16)) },
  plugins: [react()],
  resolve: { alias: [
    { find: /^react\/jsx-runtime$/, replacement: resolve(__dirname, 'src/lib/ico-runtime.js') },
    { find: /^react\/jsx-dev-runtime$/, replacement: resolve(__dirname, 'src/lib/ico-runtime.js') },
  ] },
  build: { rollupOptions: { input: { employee: resolve(__dirname, 'employee.html') } } },
})
