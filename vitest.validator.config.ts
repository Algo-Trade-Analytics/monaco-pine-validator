import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/specs/**/*.spec.ts'],
    environment: 'node',
    globals: true
  }
});
