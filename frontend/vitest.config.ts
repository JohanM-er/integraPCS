/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  test: {
    environment: 'happy-dom', // Faster than jsdom
    globals: true, // Use describe/it/expect without imports
    setupFiles: ['./tests/setup.ts'],
    css: true, // Process CSS imports
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'playwright.config.ts'
      ]
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e', '.idea', '.git', '.cache']
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@integrapcs/shared-types': path.resolve(__dirname, '../packages/shared-types/src')
    }
  }
});
