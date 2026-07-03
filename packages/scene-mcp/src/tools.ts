/**
 * scene-mcp 工具的純邏輯（不依賴 MCP transport，方便單元測試）。
 *
 * MCP 客戶端（agent）自己「生成」場景；我們提供：拿 schema/指南、驗證、編譯、存檔。
 * 建議 agent 用 **authoring 形式**（秒 / 角度 / camera lookAt），由 scene-schema 的
 * compileScene 編譯成 canonical；驗證/存檔工具兩種形式都吃（loadScene 自動辨識）。
 */

import { writeFile as fsWriteFile, stat, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import {
  sceneAuthoringJsonSchema,
  compileScene,
  loadScene,
  formatErrors,
  type SceneTimeline,
  type ValidationError,
} from '@frameforge/scene-schema';

export const AUTHORING_GUIDE = [
  'FrameForge 場景（authoring 形式，細節以 JSON Schema 為準）：',
  '- 頂層：id, name, tickRate（預設 60）, durationSeconds（秒）, entities, assets, tracks, events。',
  '- 時間用「秒」：keyframe.atSeconds、event.atSeconds、interactive 的 startSeconds/endSeconds。',
  '- 旋轉用「角度」：transform.rotation 的初始值、以及 target 為 transform.rotation 的 keyframe 值（度）。',
  '- 相機用 lookAt：Camera.data.lookAt 給一個注視點（世界座標），會自動算出旋轉——不用自己算 euler。',
  '- entity.components：Transform / Sprite / Mesh / Camera / Text / Collider / Animator / AudioSource / Script。',
  '  · Mesh:{shape:box|plane|sphere,size?,color?}  · Sprite:{assetId?,color?,width?,height?}  · Text:{content,fontSize?,color?}',
  '  · Camera:{projection,fov?,near?,far?,lookAt?}  顏色用 0xRRGGBB 數字或 CSS 字串。',
  '- track 兩種：authored（keyframes，純 f(t)，可任意 seek）與 interactive（controller）。',
  '  · "kinematic"：使用者可駕駛的移動（runtime 才驅動，靜態渲染時停在原地）。params:{position,speed}。',
  '  · "trigger"：sensor，target 進入 box 區域即揭露 reveal 實體。params:{target,center,size,reveal?,latch?}；target/reveal 須為存在的 entity id，center/size 為 {x,y,z}。',
  '  authored.keyframes 依 atSeconds 遞增且不超過 durationSeconds；不要引用不存在的 entityId/assetId。',
  '流程：產生 authoring JSON → compile_scene（轉 canonical 並驗證）；未過就依錯誤修正再試；',
  '通過後把 canonical JSON 交付、save_scene 或貼進 Studio 的「載入場景」（Studio 也吃 authoring 形式）。',
].join('\n');

/** authoring 形式的 JSON Schema（字串）——agent 產生前先讀。 */
export function schemaText(): string {
  return JSON.stringify(sceneAuthoringJsonSchema(), null, 2);
}

// ─────────────────────────────────────────────────────────────
// validate（兩種形式皆可：loadScene 自動辨識）
// ─────────────────────────────────────────────────────────────

export interface ValidateResult {
  ok: boolean;
  errors: ValidationError[];
  text: string;
  timeline?: SceneTimeline;
}

export function validateScene(input: unknown): ValidateResult {
  const coerced = coerceJson(input);
  if ('error' in coerced) return jsonError(coerced.error);
  const r = loadScene(coerced.value);
  if (r.ok) return { ok: true, errors: [], text: '✅ 通過（可安全載入 Studio）。', timeline: r.timeline };
  return {
    ok: false,
    errors: r.errors,
    text: `❌ 未通過（${r.errors.length} 項），請修正後重試：\n${formatErrors(r.errors)}`,
  };
}

// ─────────────────────────────────────────────────────────────
// compile（authoring → canonical，並驗證）
// ─────────────────────────────────────────────────────────────

export interface CompileToCanonicalResult {
  ok: boolean;
  canonicalJson?: string;
  errors: ValidationError[];
  text: string;
}

export function compileToCanonical(input: unknown): CompileToCanonicalResult {
  const coerced = coerceJson(input);
  if ('error' in coerced) {
    const e = jsonError(coerced.error);
    return { ok: false, errors: e.errors, text: e.text };
  }
  const r = compileScene(coerced.value);
  if (!r.ok) {
    return {
      ok: false,
      errors: r.errors,
      text: `❌ 編譯/驗證未過（${r.errors.length} 項），請修正後重試：\n${formatErrors(r.errors)}`,
    };
  }
  const json = JSON.stringify(r.timeline, null, 2);
  return { ok: true, canonicalJson: json, errors: [], text: `✅ 已編譯成 canonical scene：\n${json}` };
}

// ─────────────────────────────────────────────────────────────
// save（驗證/編譯通過才寫檔）
// ─────────────────────────────────────────────────────────────

export interface SaveResult {
  ok: boolean;
  path?: string;
  errors: ValidationError[];
  text: string;
}

export async function saveScene(
  input: unknown,
  filePath: string,
  write: (path: string, content: string) => Promise<void> = fsWriteFile,
): Promise<SaveResult> {
  const v = validateScene(input);
  if (!v.ok || !v.timeline) {
    return { ok: false, errors: v.errors, text: `未寫入（未通過）：\n${v.text}` };
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

// ─────────────────────────────────────────────────────────────
// render（先編譯/驗證，通過才用 headless Chrome 渲染成 MP4）
// ─────────────────────────────────────────────────────────────

export interface RenderResult {
  ok: boolean;
  path?: string;
  bytes?: number;
  errors: ValidationError[];
  text: string;
}

/** 注入式渲染器：吃 canonical 場景檔路徑 + 輸出 MP4 路徑，回傳位元組數。 */
export type SceneRenderer = (canonicalScenePath: string, outPath: string) => Promise<{ bytes: number }>;

const execFileAsync = promisify(execFile);

/** 預設渲染器：呼叫 scene-render CLI（frameforge-scene-render，或 FRAMEFORGE_RENDER_CMD 覆寫）。 */
const defaultRenderer: SceneRenderer = async (scenePath, outPath) => {
  const cmd = (process.env.FRAMEFORGE_RENDER_CMD ?? 'frameforge-scene-render').trim();
  const parts = cmd.split(/\s+/);
  await execFileAsync(parts[0], [...parts.slice(1), scenePath, outPath], { maxBuffer: 4 << 20 });
  const { size } = await stat(outPath);
  return { bytes: size };
};

/**
 * 渲染場景為 MP4：先 compile/驗證（不需 Chrome，快速回錯給 agent 修正），
 * 通過才呼叫渲染器（headless Chrome 逐幀）。渲染器可注入以便測試。
 */
export async function renderScene(
  input: unknown,
  outPath: string,
  render: SceneRenderer = defaultRenderer,
  writeTmp: (path: string, content: string) => Promise<void> = fsWriteFile,
): Promise<RenderResult> {
  // validateScene 自動辨識 authoring / canonical，通過即得 canonical timeline（不需 Chrome）。
  const v = validateScene(input);
  if (!v.ok || !v.timeline) {
    return { ok: false, errors: v.errors, text: `未渲染（未通過驗證）：\n${v.text}` };
  }

  const out = resolve(outPath);
  const sceneTmp = `${out}.scene.json`;
  await writeTmp(sceneTmp, JSON.stringify(v.timeline, null, 2));
  try {
    const { bytes } = await render(sceneTmp, out);
    return {
      ok: true,
      path: out,
      bytes,
      errors: [],
      text: `✅ 已渲染 → ${out}（${bytes} bytes）。可直接播放 / 分享。`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      errors: [],
      text:
        `❌ 渲染失敗：${msg}\n` +
        'render_scene 需要本機有 Chrome 與 scene-render CLI（frameforge-scene-render），' +
        '或以環境變數 FRAMEFORGE_RENDER_CMD 指定渲染指令。',
    };
  } finally {
    await unlink(sceneTmp).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// 內部
// ─────────────────────────────────────────────────────────────

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

function jsonError(message: string): ValidateResult {
  return { ok: false, errors: [{ path: '(json)', message }], text: `❌ JSON 解析失敗：${message}` };
}
