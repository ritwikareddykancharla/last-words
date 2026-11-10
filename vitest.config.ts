import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['skeleton/**/*.test.ts', 'ghost-words/**/*.test.ts', 'echo-archive/**/*.test.ts'],
  },
});
