/**
 * CLI 進入點——打包成 dist/server.js（bin）。
 *
 * 刻意獨立於 server.ts：bin 必須「無條件啟動」。若沿用 server.ts 的
 * `import.meta.url === argv[1]` 守衛，經 npm/npx 建立的 bin symlink 會讓
 * 兩者路徑不一致而不啟動。這裡直接呼叫 main() 最穩。
 * shebang 由 esbuild 的 banner 於打包時加入。
 */

import { main } from './server';

main().catch((e: unknown) => {
  process.stderr.write(String((e as Error)?.message ?? e) + '\n');
  process.exit(1);
});
