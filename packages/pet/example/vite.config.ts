import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@viben/pet': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3456,
    open: true,
  },
});
