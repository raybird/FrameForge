import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@frameforge/shared-types': fileURLToPath(
        new URL('../shared-types/src/index.ts', import.meta.url),
      ),
      '@frameforge/scene-schema': fileURLToPath(
        new URL('../scene-schema/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
