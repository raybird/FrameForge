import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // 確保整個 bundle 只有一份 three（避免 instanceof 失效）。
    dedupe: ['three'],
    alias: {
      '@frameforge/shared-types': src('../../packages/shared-types/src/index.ts'),
      '@frameforge/engine-core': src('../../packages/engine-core/src/index.ts'),
      '@frameforge/engine-three': src('../../packages/engine-three/src/index.ts'),
    },
  },
});
