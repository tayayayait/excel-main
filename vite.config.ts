import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.CHATGPT_API_KEY': JSON.stringify(env.CHATGPT_API_KEY),
        'process.env.MODEL_PROVIDER': JSON.stringify(env.MODEL_PROVIDER || 'chatgpt'),
        'process.env.INTERNAL_MODEL_API_URL': JSON.stringify(env.INTERNAL_MODEL_API_URL || ''),
        'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || 'http://localhost:4000'),
        'process.env.API_TOKEN': JSON.stringify(env.API_TOKEN || 'mock-token')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
