import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      ignored: ['**/release/**', '**/android/**', '**/dist-gas/**']
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
