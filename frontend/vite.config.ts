import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 支援 GitHub Pages 任意子路徑
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
