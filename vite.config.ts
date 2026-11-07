import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: process.env.BUILD_OUT_DIR ?? 'dist',
    emptyOutDir: true,
  },
});
