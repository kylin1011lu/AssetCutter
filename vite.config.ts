import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { singleFileHtmlPlugin } from './src/build/singleFileHtml';

const buildSingleFileHtml = process.env.ASSET_CUTTER_SINGLE_FILE === '1';

export default defineConfig({
  plugins: [react(), ...(buildSingleFileHtml ? [singleFileHtmlPlugin()] : [])],
  build: buildSingleFileHtml
    ? {
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        cssCodeSplit: false,
        outDir: 'dist-single',
      }
    : undefined,
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
