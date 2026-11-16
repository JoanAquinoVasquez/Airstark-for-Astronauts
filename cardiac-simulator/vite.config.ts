import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/cardiac-simulator/',
  publicDir: '../public/cardiac-simulator',
  build: { copyPublicDir: false },
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'] },
})
