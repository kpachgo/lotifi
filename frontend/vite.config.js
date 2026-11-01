import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'lotifi-react-router-fallback',
      configureServer(server) {
        const reactRoutes = new Set([
          '/clientes',
          '/lotificaciones',
          '/contratos',
          '/pagos',
          '/deudores',
          '/reportes'
        ]);

        server.middlewares.use((req, res, next) => {
          if (req.method === 'GET' && req.url && req.headers.accept?.includes('text/html')) {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            if (reactRoutes.has(pathname)) req.url = '/index.html';
          }
          next();
        });
      }
    }
  ],
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '../backend/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@chakra-ui') || id.includes('node_modules/@emotion')) {
            return 'chakra';
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react';
          }
          if (id.includes('node_modules/lucide-react')) return 'icons';
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
      '/uploads': 'http://localhost:3002'
    }
  }
});
