/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build runs under a sub-path such as /FIT-997/.
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // Process component CSS so layout rules can be asserted (jsdom cannot measure layout).
    css: { include: [/\.css$/] },
  },
});
