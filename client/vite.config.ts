import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Set base to the repo name for GitHub Pages deployment.
  // Override via VITE_BASE_URL env var if needed.
  base: process.env.VITE_BASE_URL ?? '/GrahamBrailleWriter/',

  worker: {
    // Use module workers so the braille-worker can use ESM imports.
    format: 'es',
  },

  optimizeDeps: {
    // Exclude monaco-editor from pre-bundling — it manages its own workers.
    exclude: ['monaco-editor'],
  },

  build: {
    rollupOptions: {
      output: {
        // Split monaco into its own chunk to keep the main bundle lean.
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
});
