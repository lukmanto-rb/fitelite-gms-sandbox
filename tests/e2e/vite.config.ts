/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // The page lives where the test environment serves it.
    environmentOptions: { jsdom: { url: 'http://localhost:8080/FIT-941/' } },
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
