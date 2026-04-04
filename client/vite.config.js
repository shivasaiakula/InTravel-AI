import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-router-dom')) return 'react'
            if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('recharts')) return 'charts'
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('@google/generative-ai')) return 'ai'
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
