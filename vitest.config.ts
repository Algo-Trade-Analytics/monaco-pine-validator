import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/ast/**/*.test.ts',
      'tests/e2e/**/*.test.ts',
      'tests/monaco/**/*.test.ts',
      'tests/constants-registry-lint.test.ts'
    ],
    environment: 'node',
    globals: true
  }
});
