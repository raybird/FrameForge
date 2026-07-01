/**
 * scene-mcp 工具的純邏輯（不依賴 MCP transport，方便單元測試）。
 *
 * 設計：MCP 客戶端（Claude Code / Desktop 的 agent）自己「生成」timeline，
 * 我們提供三件事——(1) 拿 schema 與撰寫指南、(2) 驗證、(3) 驗證後存檔。
 * 修正迴圈跑在 agent：產生 → validate_scene → 依錯誤修正 → 再驗，直到通過。
 */

import { writeFile as fsWriteFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  sceneTimelineJsonSchema,
  validateTimeline,
  formatErrors,
  type SceneTimeline,
  type ValidationError,
} from '@frameforge/scene-schema';

export const AUTHORING_GUIDE = [
  'FrameForge SceneTimeline 撰寫指南（細節以 JSON Schema 為準）：',
  '- 頂層：id, name, tickRate（通常 60）, durationTicks（正整數）, entities, assets, tracks, events。',
  '- 時間單位：tick 為非負整數；旋轉用 euler 弧度（2.5D 多半只用 z）；顏色用 0xRRGGBB 數字或 CSS 字串。',
  '- entity.components 是 discriminated union：Transform / Sprite / Mesh / Camera / Text / Collider / Animator / AudioSource / Script。',
  '  · Mesh: { shape: box|plane|sphere, size?, color? }  · Sprite: { assetId?, color?, width?, height? }',
  '  · Text: { content, fontSize?, color? }  · Camera: { projection, fov?, near?, far? }  · Collider: { shape, isTrigger:true }',
  '- track 兩種：authored（keyframes，純 f(t)，可任意 seek）與 interactive（controller:"kinematic"，需玩家輸入）。',
  '  authored.keyframes 依 tick 嚴格遞增且不超過 durationTicks；target 例：transform.position / transform.rotation / opacity。',
  '- 不要引用不存在的 entityId 或 assetId。純展示場景建議全部用 authored（可完美 seek 與匯出）。',
  '產生後務必呼叫 validate_scene 驗證；未通過就依錯誤修正再驗，直到通過再交付或 save_scene。',
].join('\n');

/** SceneTimeline 的 JSON Schema（字串）。 */
export function schemaText(): string {
  return JSON.stringify(sceneTimelineJsonSchema(), null, 2);
}

export interface ValidateResult {
  ok: boolean;
  errors: ValidationError[];
  /** 給 agent 讀的摘要（含可據以修正的錯誤）。 */
  text: string;
  timeline?: SceneTimeline;
}

/** 驗證一份 timeline（物件或 JSON 字串）。 */
export function validateScene(input: unknown): ValidateResult {
  const coerced = coerceJson(input);
  if ('error' in coerced) {
    return {
      ok: false,
      errors: [{ path: '(json)', message: coerced.error }],
      text: `❌ JSON 解析失敗：${coerced.error}`,
    };
  }
  const r = validateTimeline(coerced.value);
  if (r.ok) {
    return { ok: true, errors: [], text: '✅ 通過驗證，可安全載入 Studio。', timeline: r.timeline };
  }
  return {
    ok: false,
    errors: r.errors,
    text: `❌ 未通過驗證（${r.errors.length} 項），請修正後重新驗證：\n${formatErrors(r.errors)}`,
  };
}

export interface SaveResult {
  ok: boolean;
  path?: string;
  errors: ValidationError[];
  text: string;
}

/** 先驗證，通過才寫檔（給 Studio 載入）；未通過不寫、回傳錯誤。 */
export async function saveScene(
  input: unknown,
  filePath: string,
  write: (path: string, content: string) => Promise<void> = fsWriteFile,
): Promise<SaveResult> {
  const v = validateScene(input);
  if (!v.ok || !v.timeline) {
    return { ok: false, errors: v.errors, text: `未寫入（驗證未過）：\n${v.text}` };
  }
  const abs = resolve(filePath);
  await write(abs, JSON.stringify(v.timeline, null, 2));
  return {
    ok: true,
    path: abs,
    errors: [],
    text: `已寫入 ${abs}。在 Studio 用「載入場景」選此檔或貼上內容即可播放/匯出。`,
  };
}

function coerceJson(input: unknown): { value: unknown } | { error: string } {
  if (typeof input === 'string') {
    try {
      return { value: JSON.parse(input) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  return { value: input };
}
