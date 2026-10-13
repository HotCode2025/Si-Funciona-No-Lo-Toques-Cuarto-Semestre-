import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Dos salidas desde el mismo código:
 *
 *   npm run build         → dist/, lo que se publica en Vercel
 *   npm run build:unico   → dist-unico/index.html, un solo archivo que se
 *                           abre con doble clic, sin servidor ni instalar nada
 *
 * En la build de archivo único todo queda embebido —JavaScript, estilos y
 * datos— y el ruteo pasa a ser por hash, porque abriendo desde el disco no
 * hay servidor que responda a /app/tokens.
 */
export default defineConfig(({ mode }) => {
  const unico = mode === 'unico';

  return {
    plugins: [react(), tailwindcss(), ...(unico ? [viteSingleFile()] : [])],

    // Inyectado acá y no por variable de entorno: así el comando es el
    // mismo en Windows, Linux y en cualquier terminal.
    define: {
      'import.meta.env.VITE_ARCHIVO_UNICO': JSON.stringify(unico ? '1' : '0'),
    },

    base: unico ? './' : '/',

    build: unico
      ? { outDir: 'dist-unico', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 }
      : {},

    server: {
      port: 5173,
      // Todo /api va al backend. Así el front queda en el mismo origen y la
      // cookie de sesión viaja sin dramas de CORS en desarrollo.
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
  };
});
