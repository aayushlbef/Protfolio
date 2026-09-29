import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build works when served from a sub-path
  // (e.g. https://<user>.github.io/Protfolio/) as well as from a domain root.
  base: './',
  plugins: [react()],
  server: {
    watch: {
      // Ignore PDFs, videos, and other non-web assets that Vite shouldn't watch
      ignored: ['**/*.pdf', '**/*.mp4', '**/*.mov', '**/*.avi', '**/*.zip', '**/*.rar']
    }
  }
});
