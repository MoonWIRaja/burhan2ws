import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env from PARENT directory (/var/dev/moon/burhan2ws)
  const env = loadEnv(mode, resolve('..'), '');

  // Read frontend port from env
  const port = parseInt(env.FRONTEND_PORT) || 5173;

  // Read API URLs - construct from parent .env
  const apiTarget = `http://localhost:${env.PORT || 3000}`;

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['@tabler/icons-react'],
    },
    server: {
      port,
      host: true,
      strictPort: true, // Fail if port is occupied instead of trying next available
      allowedHosts: [
        'localhost',
        '.localhost',
        'burhan2ws.owlscottage.com',
        '.owlscottage.com'
      ],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true
        },
        '/ws': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path  // Keep /ws path
        }
      }
    }
  };
});
