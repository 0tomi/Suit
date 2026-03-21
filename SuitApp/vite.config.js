import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { transformLegacyJsxRuntimeModule } from './scripts/patch-uncontrollable-jsx-runtime.mjs'

function stripLegacyJsxRuntimeDevProps() {
  return {
    name: 'strip-legacy-jsx-runtime-dev-props',
    enforce: 'pre',
    transform(code, id) {
      const patched = transformLegacyJsxRuntimeModule(id, code)
      if (patched === null) {
        return null
      }

      return {
        code: patched,
        map: null,
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic',
  }), stripLegacyJsxRuntimeDevProps(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // TipTap + ProseMirror (editor pesado, solo carga al abrir DocumentEditor)
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'vendor-tiptap';
          }
          // react-big-calendar (solo carga al abrir Agenda)
          if (id.includes('react-big-calendar')) {
            return 'vendor-calendar';
          }
          // dayjs y plugins
          if (id.includes('node_modules/dayjs')) {
            return 'vendor-dayjs';
          }
          // Radix UI primitives
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          // lucide-react iconos
          if (id.includes('lucide-react')) {
            return 'vendor-lucide';
          }
          // React core + ReactDOM + React Router
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})
