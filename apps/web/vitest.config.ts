import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // `next/font/google` only works inside the Next.js compiler: tests get a stub with the same shape.
    alias: {
      'next/font/google': fileURLToPath(new URL('./test/next-font-google.stub.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Route tests mock `fetch` call by call: the admin audit journal stays off unless a test turns it on.
    env: { ADMIN_AUDIT_LOG_DISABLED: "1" },
    environment: 'node',
    include: ['packages/**/*.test.ts', 'app/**/*.test.ts', 'lib/**/*.test.ts', 'components/**/*.test.ts']
  }
});
