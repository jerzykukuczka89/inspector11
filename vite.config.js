import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      plugins: [react()],
      base: './',
    };
  }

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'board-app',
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/main.jsx'),
        output: {
          format: 'iife',
          name: 'BoardApp',
          entryFileNames: 'board.js',
          assetFileNames: 'board[extname]',
          inlineDynamicImports: true,
        },
      },
    },
  };
});
