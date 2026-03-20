import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@mocks': resolve(__dirname, 'src/mocks'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Выделяем тяжёлые зависимости в отдельные чанки
          'vendor-react': ['react', 'react-dom'],
          'vendor-crypto': ['libsodium-wrappers'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
  },
})
