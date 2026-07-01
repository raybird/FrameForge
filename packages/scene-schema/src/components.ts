/**
 * Component 契約——把 shared-types 的 `data: Record<string, JsonValue>` 黑洞
 * 收斂成「每種 component 各有明確欄位」的 discriminated union。
 *
 * 這是 P5（AI 生成）最關鍵的一塊：LLM 唯有知道每種 component 該填什麼，
 * 才生得出「有效且能被渲染」的 entity。
 *
 * 對照 docs/ARCHITECTURE.md §5：
 *   - Collider 只做觸發體積（isTrigger 恆為 true），不做剛體動力學。
 *   - Camera / Text 是本層新增的第一公民（cinematic 與字幕所需）。
 */

import { z } from 'zod/v4';
import { color, vec3, jsonValue, tick } from './primitives';

/** 影像 / 3D / 音訊資源的參照，對應 SceneTimeline.assets[].id。 */
const assetId = z.string().min(1);

// ─────────────────────────────────────────────────────────────
// 各 component 的 data 契約
// ─────────────────────────────────────────────────────────────

/** Transform：初始位姿。缺省軸由 evaluator 補（position 0 / rotation 0 / scale 1）。 */
export const transformData = z.object({
  position: vec3.optional(),
  /** euler 弧度。2.5D 通常只用 z。 */
  rotation: vec3.optional(),
  scale: vec3.optional(),
  color: color.optional(),
});

/** Sprite：2.5D 影像看板。 */
export const spriteData = z.object({
  assetId: assetId.optional(),
  color: color.optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  anchor: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
});

/** Mesh：primitive 幾何或載入的 gltf/glb。 */
export const meshData = z.object({
  shape: z.enum(['box', 'plane', 'sphere']).optional(),
  /** gltf/glb 資源；與 shape 二選一。 */
  assetId: assetId.optional(),
  color: color.optional(),
  size: z.number().positive().optional(),
});

/** Animator：動畫 clip 目錄與預設。 */
export const animatorData = z.object({
  clips: z.array(z.string().min(1)).min(1),
  defaultClip: z.string().min(1).optional(),
  autoplay: z.boolean().optional(),
});

/** Collider：甲只做觸發體積（進入/離開區域），不做剛體。 */
export const colliderData = z.object({
  shape: z.enum(['box', 'sphere']),
  /** box 用；半邊長。 */
  size: vec3.optional(),
  /** sphere 用。 */
  radius: z.number().positive().optional(),
  /** 甲的鐵則：只做觸發，恆為 true。 */
  isTrigger: z.literal(true).default(true),
});

/** Script：掛一段具名邏輯（薄互動 / 觸發回呼）。 */
export const scriptData = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), jsonValue).optional(),
});

/** AudioSource：音源（見 §6，事件驅動；非可 seek 之物）。 */
export const audioSourceData = z.object({
  assetId,
  loop: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  autoplay: z.boolean().optional(),
  startTick: tick.optional(),
});

/** Camera：第一公民攝影機（cinematic 運鏡）。 */
export const cameraData = z.object({
  projection: z.enum(['perspective', 'orthographic']).default('perspective'),
  /** perspective 用（度）。 */
  fov: z.number().positive().optional(),
  /** orthographic 用。 */
  zoom: z.number().positive().optional(),
  near: z.number().positive().optional(),
  far: z.number().positive().optional(),
});

/** Text：標題 / 字幕 / 標籤。 */
export const textData = z.object({
  content: z.string(),
  fontSize: z.number().positive().optional(),
  color: color.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  font: z.string().min(1).optional(),
});

// ─────────────────────────────────────────────────────────────
// discriminated union（discriminant = type）
// ─────────────────────────────────────────────────────────────

export const componentDef = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Transform'), data: transformData }),
  z.object({ type: z.literal('Sprite'), data: spriteData }),
  z.object({ type: z.literal('Mesh'), data: meshData }),
  z.object({ type: z.literal('Animator'), data: animatorData }),
  z.object({ type: z.literal('Collider'), data: colliderData }),
  z.object({ type: z.literal('Script'), data: scriptData }),
  z.object({ type: z.literal('AudioSource'), data: audioSourceData }),
  z.object({ type: z.literal('Camera'), data: cameraData }),
  z.object({ type: z.literal('Text'), data: textData }),
]);

/** 本層支援的 component 類型（含 shared-types 的 7 種 + Camera/Text）。 */
export const COMPONENT_TYPES = [
  'Transform',
  'Sprite',
  'Mesh',
  'Animator',
  'Collider',
  'Script',
  'AudioSource',
  'Camera',
  'Text',
] as const;

/** 會參照 asset 的 component 類型（供交叉引用驗證用）。 */
export const ASSET_REFERENCING_TYPES = ['Sprite', 'Mesh', 'AudioSource'] as const;

export type ComponentDef = z.infer<typeof componentDef>;
