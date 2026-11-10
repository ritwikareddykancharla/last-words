import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One skeleton, two apps, one site: the landing page plus each app's own entry.
// Same origin, so both apps share the skeleton's IndexedDB store.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5178 },
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        ghostWords: 'ghost-words/index.html',
        echoArchive: 'echo-archive/index.html',
      },
    },
  },
});
