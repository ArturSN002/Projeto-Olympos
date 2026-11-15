import { defineConfig } from 'vite';

// Configuração do Vite para build da SPA Hub Olympos V3.0
// Compatível com GitHub Pages (base: './') e exportação para dist/
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
