import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* requests to the Express backend in development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    // Output to dist/
    outDir: 'dist',
    // Warn if any chunk > 1 MB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Code-split large libraries into separate async chunks
        manualChunks: {
          react:     ['react', 'react-dom'],
          router:    ['react-router-dom'],
          query:     ['@tanstack/react-query'],
          charts:    ['recharts'],
          motion:    ['framer-motion'],
          icons:     ['lucide-react'],
          utils:     ['axios', 'zustand', 'date-fns', 'react-hot-toast'],
        },
      },
    },
  },
});
