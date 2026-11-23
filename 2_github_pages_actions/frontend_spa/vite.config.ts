import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Copia os artefatos estáticos necessários (data/, assets/, PWA shell) para dist/
 * após o bundle do Vite, preservando compatibilidade com GitHub Pages (base: './').
 */
function copyStaticAssetsPlugin(): Plugin {
  return {
    name: 'olympos-copy-static-assets',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const copyDirs = ['data', 'assets'];
      for (const dirName of copyDirs) {
        const src = path.resolve(__dirname, dirName);
        const dst = path.resolve(outDir, dirName);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dst, { recursive: true, force: true });
        }
      }

      const copyFiles = ['sw.js', 'manifest.json', 'favicon.ico'];
      for (const fileName of copyFiles) {
        const src = path.resolve(__dirname, fileName);
        const dst = path.resolve(outDir, fileName);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dst);
        }
      }

      const distIndexPath = path.resolve(outDir, 'index.html');
      if (fs.existsSync(distIndexPath)) {
        const html = fs.readFileSync(distIndexPath, 'utf8')
          .replace(/href=["']\.\/assets\/manifest-[^"']+\.json["']/gi, 'href="./manifest.json"');
        fs.writeFileSync(distIndexPath, html, 'utf8');
      }
    }
  };
}

function minifyHtmlShellPlugin(): Plugin {
  return {
    name: 'olympos-minify-html-shell',
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        return html
          .replace(/href=["']\.\/assets\/manifest-[^"']+\.json["']/i, 'href="./manifest.json"')
          .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
          .replace(/\r?\n\s+/g, '\n')
          .replace(/\n{2,}/g, '\n')
          .trim();
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [copyStaticAssetsPlugin(), minifyHtmlShellPlugin()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: true,
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id: string) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('node_modules/@preact/signals-core')) {
            return 'vendor-signals';
          }
          if (normalized.includes('node_modules/@tiptap') || normalized.includes('node_modules/prosemirror')) {
            return 'vendor-tiptap';
          }
          if (normalized.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          if (normalized.includes('node_modules/pdf-lib') || normalized.includes('node_modules/@pdf-lib')) {
            return 'vendor-pdf';
          }
          if (normalized.includes('node_modules/driver.js')) {
            return 'vendor-driver';
          }
          if (normalized.includes('node_modules/fflate') || normalized.includes('node_modules/papaparse')) {
            return 'vendor-batch';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
