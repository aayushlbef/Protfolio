import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works when served from a sub-path
  // (e.g. https://<user>.github.io/Protfolio/) as well as from a domain root.
  base: './',
  server: {
    watch: {
      // Ignore PDFs, videos, and other non-web assets that Vite shouldn't watch
      ignored: ['**/*.pdf', '**/*.mp4', '**/*.mov', '**/*.avi', '**/*.zip', '**/*.rar']
    }
  }
});
