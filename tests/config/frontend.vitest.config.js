import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, '..'),
  cacheDir: path.resolve(__dirname, '../../node_modules/.vite-tests'),
  plugins: [react()],
  resolve: {
    alias: {
      'react-hot-toast': path.resolve(__dirname, '../../frontend/node_modules/react-hot-toast/dist/index.mjs')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    fs: { allow: [path.resolve(__dirname, '../..')] }
  },
  test: {
    environment: 'jsdom',
    include: ['frontend/**/*.{test,spec}.{js,jsx}'],
    css: false
  }
});
