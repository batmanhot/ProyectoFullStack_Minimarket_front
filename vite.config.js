import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.config.*',
        'src/main.jsx',
        'src/features/**',
        'src/shared/components/**',
        'src/store/**',
        'src/services/**',
      ],
      thresholds: {
        'src/shared/utils/**': { lines: 100, functions: 100, branches: 90 },
      },
    },
  },

  server: {
    port: 3000,
    open: true,
    hmr: {
      protocol: 'ws',
      host:     'localhost',
      port:     3000,
    },
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
          'pdf-vendor': ['jspdf', 'html2canvas'],
        }
      }
    },
    chunkSizeWarningLimit: 650,
    sourcemap: true,
  },

  // PWA - no cachear el SW
  publicDir: 'public',
})