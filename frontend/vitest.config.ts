import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
      reporter: ['json-summary', 'json', 'text', 'lcov'],
      reportOnFailure: true,
      // Baseline thresholds — raise these as more page tests are added.
      // SonarCloud enforces 80% coverage on *new* code; these guard the aggregate floor.
      thresholds: {
        lines: 8,
        branches: 5,
        functions: 8,
        statements: 8,
      },
    },
  },

});
