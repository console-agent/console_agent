import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    env: loadEnv('', process.cwd(), ''),
    testTimeout: 30000, // 30s per test — API calls take time
    hookTimeout: 10000,
  },
});
