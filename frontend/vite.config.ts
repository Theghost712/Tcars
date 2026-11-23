import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the frontend proxies /api and /media to the Django server,
// so browser requests stay same-origin and CORS is only needed for direct calls.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
});
