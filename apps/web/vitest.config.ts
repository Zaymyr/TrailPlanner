import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Route tests mock `fetch` call by call: the admin audit journal stays off unless a test turns it on.
    env: { ADMIN_AUDIT_LOG_DISABLED: "1" },
    environment: 'node',
    include: ['packages/**/*.test.ts', 'app/**/*.test.ts', 'lib/**/*.test.ts', 'components/**/*.test.ts']
  }
});
