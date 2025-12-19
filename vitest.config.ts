import { defineConfig } from 'vitest/config';

export default defineConfig({
  deps: {
    inline: ['reflect-metadata']
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
