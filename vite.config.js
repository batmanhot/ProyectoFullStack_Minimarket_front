import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    // Optimizaciones para PWA
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'react-hot-toast'],
          'form-vendor': ['react-hook-form', 'zod'],
          'chart-vendor': ['recharts'],
        }
      }
    },
    // Generar source maps para debugging
    sourcemap: true,
  },

  // PWA - no cachear el SW
  publicDir: 'public',
})