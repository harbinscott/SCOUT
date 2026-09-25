import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const basePath = `${(process.env.BASE_PATH || '/scout').replace(/\/$/, '')}/`;

export default defineConfig({
  base: basePath,
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      [`${basePath}api`]: 'http://localhost:3001',
      [`${basePath}health`]: 'http://localhost:3001',
    },
  },
});
