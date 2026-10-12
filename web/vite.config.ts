import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // the game + «استوديو التحديات» (studio.html)
      input: { main: resolve(__dirname, 'index.html'), studio: resolve(__dirname, 'studio.html') },
    },
  },
})
