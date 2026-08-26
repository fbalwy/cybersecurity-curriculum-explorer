import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths keep the build valid both at the GitHub project URL
  // and when GitHub Pages serves the same deployment from a custom domain.
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
})
