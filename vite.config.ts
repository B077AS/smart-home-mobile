import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const mdifonts = [
  'materialdesignicons-webfont.woff2',
  'materialdesignicons-webfont.woff'
];

export default defineConfig({
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    minify: false,
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 3000,
    strictPort: false,
  },
  plugins: [
    {
      name: 'copy-mdi-fonts',
      buildStart() {
        const dest = 'public/fonts';
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
        mdifonts.forEach(f => copyFileSync(`node_modules/@mdi/font/fonts/${f}`, `${dest}/${f}`));
      }
    }
  ]
});