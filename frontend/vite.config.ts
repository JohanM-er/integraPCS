/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react({
        // Fast refresh is enabled by default in @vitejs/plugin-react for supported setups
      })
    ],

    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Proxy GraphQL in dev to avoid CORS
        '/graphql': {
          target: env.VITE_GRAPHQL_HTTP || 'http://localhost:3000',
          ws: true, // Enable WebSocket proxy for subscriptions
          changeOrigin: true
        }
      }
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@integrapcs/shared-types': path.resolve(__dirname, '../packages/shared-types/src')
      }
    },

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    },

    build: {
      sourcemap: mode !== 'production',
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-apollo': ['@apollo/client', 'graphql'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select'
            ]
          }
        }
      }
    },

    optimizeDeps: {
      include: ['@apollo/client', 'graphql']
    },

    preview: {
      port: 5173
    },

    // Vitest configuration (for backwards compatibility)
    // Use vitest.config.ts for test-specific settings
    test: {
      globals: true,
      environment: 'happy-dom'
    }
  };
});
