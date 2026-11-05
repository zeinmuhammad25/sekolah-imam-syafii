import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://sekolah-imam-syafii.pages.dev',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
