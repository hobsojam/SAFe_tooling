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
      // Coverage floors — prevent regressions and guide toward the SAFe tooling quality target.
      // Current suite covers all pages and core components. Raise these as coverage improves.
      // Long-term target: 60% across all metrics (blocked by Board.tsx at ~13%).
      thresholds: {
        lines: 50,
        branches: 52,
        functions: 38,
        statements: 48,
      },
    },
  },

});
