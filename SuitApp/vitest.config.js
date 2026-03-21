import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['tests/unit/**/*.{test,spec}.{js,jsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
});
