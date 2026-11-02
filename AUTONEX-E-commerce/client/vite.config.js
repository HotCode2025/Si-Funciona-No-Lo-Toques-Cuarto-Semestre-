import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Subruta donde se publica la app (ej: /autonex/). Tiene que coincidir con BASE_PATH del server.
  let base = env.VITE_BASE_PATH || '/';
  if (!base.endsWith('/')) base += '/';
  const destinoApi = env.VITE_API_PROXY || 'http://127.0.0.1:3200';

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        [`${base}api`]: { target: destinoApi, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        [`${base}api`]: { target: destinoApi, changeOrigin: true },
      },
    },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
