/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: []
  },
  preview: {
    port: 5173
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@integrapcs/shared-types': path.resolve(
        __dirname,
        '../packages/shared-types/src'
      )
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom'
  }
});