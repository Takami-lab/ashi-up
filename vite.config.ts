import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages: https://<user>.github.io/ashi-up/ （リポジトリ名と一致させる）
export default defineConfig({
  base: '/ashi-up/',
  plugins: [react()],
})
