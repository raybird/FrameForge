#!/usr/bin/env node
/**
 * CLI：把場景 JSON 檔渲染成 MP4。
 *   frameforge-scene-render <scene.json> <out.mp4>
 * 場景可為 authoring 或 canonical 形式（Studio 的載入器會自動辨識）。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { renderSceneToMp4 } from './render';

async function main(): Promise<void> {
  const [scenePath, outPath] = process.argv.slice(2);
  if (!scenePath || !outPath) {
    console.error('用法: frameforge-scene-render <scene.json> <out.mp4>');
    process.exit(2);
  }
  const json = readFileSync(scenePath, 'utf8');
  const bytes = await renderSceneToMp4(json);
  writeFileSync(outPath, bytes);
  console.error(`✓ 已輸出 ${outPath}（${bytes.length} bytes）`);
}

main().catch((e) => {
  console.error('✋ 渲染失敗:', e instanceof Error ? e.message : e);
  process.exit(1);
});
