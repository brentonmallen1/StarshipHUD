import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Read version from VERSION file or environment variable
const getVersion = (): string => {
  // In Docker build, use env var passed as build arg
  if (process.env.VITE_APP_VERSION) {
    return process.env.VITE_APP_VERSION;
  }
  // Locally, read from VERSION file
  try {
    return fs.readFileSync(path.resolve(__dirname, '../VERSION'), 'utf-8').trim();
  } catch {
    return 'dev';
  }
};

// Where the dev server proxies /api and /uploads (override for e2e runs)
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
