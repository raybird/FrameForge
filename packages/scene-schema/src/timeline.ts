/**
 * SceneTimeline 的結構性 zod 契約（不含交叉引用檢查——那在 validate.ts）。
 *
 * 這個 schema 有兩個用途：
 *   1. runtime 結構驗證（型別、必填、範圍）。
 *   2. 導出 JSON Schema 餵給 LLM 做 structured output（見 json-schema.ts）。
 * 因此這裡刻意只放「單筆資料自身可判斷」的規則；跨欄位（id 是否存在…）留給 validate.ts。
 */

import { z } from 'zod/v4';
import { componentDef } from './components';
import { easing, jsonValue, tick, trackTarget } from './primitives';

const id = z.string().min(1);

// ─────────────────────────────────────────────────────────────
// Asset
// ─────────────────────────────────────────────────────────────

export const assetType = z.enum([
  'png',
  'jpg',
  'svg',
  'lottie',
  'gltf',
  'glb',
  'mp3',
  'wav',
  'json',
]);

export const asset = z.object({
  id,
  type: assetType,
  /** 可為相對路徑 / data URL，故不強制 URL 格式。 */
  url: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────────────────────

export const entity = z.object({
  id,
  name: z.string(),
  components: z.array(componentDef),
});

// ─────────────────────────────────────────────────────────────
// Keyframe / Track
// ─────────────────────────────────────────────────────────────

export const keyframe = z.object({
  tick,
  value: jsonValue,
  /** 到「下一個」keyframe 的插值方式。預設 linear。 */
  easing: easing.optional(),
});

export const authoredTrack = z.object({
  id,
  entityId: id,
  kind: z.literal('authored'),
  target: trackTarget,
  keyframes: z.array(keyframe),
});

export const interactiveSegment = z.object({
  id,
  entityId: id,
  kind: z.literal('interactive'),
  target: trackTarget,
  startTick: tick,
  /** null = 開放結尾。 */
  endTick: tick.nullable(),
  /** SimCore 裡的 controller 識別字。 */
  controller: z.string().min(1),
  params: z.record(z.string(), jsonValue),
});

export const track = z.discriminatedUnion('kind', [authoredTrack, interactiveSegment]);

// ─────────────────────────────────────────────────────────────
// Event
// ─────────────────────────────────────────────────────────────

export const replayEvent = z.object({
  tick,
  /** 例：'scene.switch' | 'sfx.play' | 'input.click'。 */
  type: z.string().min(1),
  payload: jsonValue,
});

// ─────────────────────────────────────────────────────────────
// SceneTimeline（最頂層）
// ─────────────────────────────────────────────────────────────

export const sceneTimeline = z.object({
  id,
  name: z.string(),
  /** 每秒幾個 tick。 */
  tickRate: z.int().positive(),
  /** 總長度（tick）。 */
  durationTicks: z.int().positive(),
  entities: z.array(entity),
  assets: z.array(asset),
  tracks: z.array(track),
  /** 作者預先排在時間軸上的 cue points。 */
  events: z.array(replayEvent),
});

export type SceneTimeline = z.infer<typeof sceneTimeline>;
export type Entity = z.infer<typeof entity>;
export type Track = z.infer<typeof track>;
export type Asset = z.infer<typeof asset>;
export type Keyframe = z.infer<typeof keyframe>;
export type ReplayEvent = z.infer<typeof replayEvent>;
