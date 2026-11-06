import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devAuthUsersPlugin } from './vite-dev-users.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), devAuthUsersPlugin()],
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
