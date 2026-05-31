import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/sw.js':  { target: 'http://localhost:3001', changeOrigin: true },
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/marked') || id.includes('node_modules/dompurify')) {
            return 'vendor-markdown';
          }
          if (id.includes('node_modules/markmap-lib')) {
            return 'vendor-markmap-lib';
          }
          if (id.includes('node_modules/markmap-view')) {
            return 'vendor-markmap-view';
          }
          if (id.includes('node_modules/d3') || id.includes('node_modules/internmap')) {
            return 'vendor-d3';
          }
        },
      },
    },
  }
});
