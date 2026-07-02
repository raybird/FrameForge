/**
 * 打包 scene-mcp 成可散佈的 standalone。
 *
 * 為什麼要打包：本套件在 monorepo 內靠 tsconfig 的 paths 別名讀 sibling 原始碼
 * （@frameforge/scene-schema、@frameforge/shared-types）；這在別人的機器上不存在。
 * esbuild 把這兩個 workspace 套件 inline 進單一 dist/server.js，使
 * `npx -y @frameforge/scene-mcp` 在任何機器（任何 MCP 客戶端）都能跑。
 *
 * 完全自包：連 @modelcontextprotocol/sdk 與 zod 都 inline，產物只依賴「目標機器有 Node」。
 * 這讓 dist/server.js 可直接丟進 PATH（GitHub Release + install.sh）執行，無需任何 node_modules。
 * 僅 node: 內建模組保持 external（platform:'node' 自動處理）。
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const r = (p) => resolve(here, p);

await build({
  entryPoints: [r('src/cli.ts')],
  outfile: r('dist/server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // shebang：讓 dist/server.js 可直接作為可執行 bin。
  banner: { js: '#!/usr/bin/env node' },
  // workspace 套件 inline（它們沒發佈）。
  alias: {
    '@frameforge/scene-schema': r('../scene-schema/src/index.ts'),
    '@frameforge/shared-types': r('../shared-types/src/index.ts'),
  },
  // 不設 external：sdk / zod 一併 inline；node: 內建由 platform:'node' 自動外部化。
  logLevel: 'info',
});

process.stderr.write('✅ bundled → dist/server.js\n');
