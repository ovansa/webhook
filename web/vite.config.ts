import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Emit into the Express-served static dir.
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    // In dev, proxy API + capture calls to the Express server on :3000.
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
