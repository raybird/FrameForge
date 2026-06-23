import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // 工具鏈未定前，用 alias 解析共用型別套件（含其 runtime helper）。
      '@frameforge/shared-types': fileURLToPath(
        new URL('../shared-types/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
