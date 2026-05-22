import { mergeConfig, defineConfig } from '@playwright/test';
import base from './playwright.config';

export default mergeConfig(
  base,
  defineConfig({
    testIgnore: [],
    testMatch: ['**/screenshots.spec.ts'],
    retries: 0,
    reporter: process.env.CI ? 'github' : 'list',
  }),
);
