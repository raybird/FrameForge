/**
 * Authoring 編譯層——把「人/LLM 友善」的輸入編譯成 canonical SceneTimeline。
 *
 * 友善之處（大幅提升 LLM 一次生成成功率）：
 *   - 時間用「秒」：durationSeconds / keyframe.atSeconds / event.atSeconds → 依 tickRate 換算 tick。
 *   - 旋轉用「角度」：transform.rotation 的初始值與 keyframe 值以「度」表示 → 換算弧度。
 *   - 相機用 lookAt：Camera 給一個注視點 → 由其位置算出 euler 旋轉（弧度）寫回 Transform。
 *
 * 編譯後一律再過 validateTimeline（結構 + 交叉引用），確保輸出保證合法。
 * loadScene() 會自動辨識輸入是 authoring（有 durationSeconds）或 canonical，路由到對應處理。
 */

import { z } from 'zod/v4';
import type { JsonValue, Vec3 } from '@frameforge/shared-types';
import { easing, jsonValue, trackTarget, vec3 } from './primitives';
import {
  animatorData,
  audioSourceData,
  cameraData,
  colliderData,
  meshData,
  scriptData,
  spriteData,
  textData,
  transformData,
} from './components';
import { asset } from './timeline';
import { validateTimeline, type ValidationError, type ValidationResult } from './validate';

const DEG2RAD = Math.PI / 180;
const id = z.string().min(1);
const seconds = z.number().nonnegative();

// ─────────────────────────────────────────────────────────────
// authoring schema（結構鏡射 canonical，但時間用秒、Camera 多 lookAt）
// ─────────────────────────────────────────────────────────────

/** Camera 可多給一個注視點；編譯時換成 Transform 旋轉。 */
const authoredCameraData = cameraData.extend({ lookAt: vec3.optional() });

const authoredComponent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Transform'), data: transformData }),
  z.object({ type: z.literal('Sprite'), data: spriteData }),
  z.object({ type: z.literal('Mesh'), data: meshData }),
  z.object({ type: z.literal('Animator'), data: animatorData }),
  z.object({ type: z.literal('Collider'), data: colliderData }),
  z.object({ type: z.literal('Script'), data: scriptData }),
  z.object({ type: z.literal('AudioSource'), data: audioSourceData }),
  z.object({ type: z.literal('Camera'), data: authoredCameraData }),
  z.object({ type: z.literal('Text'), data: textData }),
]);

const authoredKeyframe = z.object({
  atSeconds: seconds,
  value: jsonValue,
  easing: easing.optional(),
});

const authoredTrack = z.discriminatedUnion('kind', [
  z.object({
    id,
    entityId: id,
    kind: z.literal('authored'),
    target: trackTarget,
    keyframes: z.array(authoredKeyframe),
  }),
  z.object({
    id,
    entityId: id,
    kind: z.literal('interactive'),
    target: trackTarget,
    startSeconds: seconds,
    endSeconds: seconds.nullable(),
    controller: z.string().min(1),
    params: z.record(z.string(), jsonValue),
  }),
]);

export const authoredScene = z.object({
  id,
  name: z.string(),
  tickRate: z.int().positive().default(60),
  durationSeconds: z.number().positive(),
  entities: z.array(z.object({ id, name: z.string(), components: z.array(authoredComponent) })),
  assets: z.array(asset).default([]),
  tracks: z.array(authoredTrack).default([]),
  events: z
    .array(z.object({ atSeconds: seconds, type: z.string().min(1), payload: jsonValue }))
    .default([]),
});

type AuthoredScene = z.infer<typeof authoredScene>;

// ─────────────────────────────────────────────────────────────
// 對外
// ─────────────────────────────────────────────────────────────

export interface CompileOptions {
  controllers?: readonly string[];
}

/** authoring 輸入 → canonical SceneTimeline（並保證通過 validateTimeline）。 */
export function compileScene(input: unknown, opts: CompileOptions = {}): ValidationResult {
  const parsed = authoredScene.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(zodIssueToError) };
  }
  const canonical = toCanonical(parsed.data);
  return validateTimeline(canonical, { controllers: opts.controllers });
}

/** 自動辨識 authoring（有 durationSeconds）或 canonical，回傳驗證後的 canonical timeline。 */
export function loadScene(input: unknown, opts: CompileOptions = {}): ValidationResult {
  if (isAuthoringForm(input)) return compileScene(input, opts);
  return validateTimeline(input, { controllers: opts.controllers });
}

/** authoring 形式的 JSON Schema（供 LLM 以友善形式生成）。 */
export function sceneAuthoringJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(authoredScene, { target: 'draft-2020-12' }) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// 編譯
// ─────────────────────────────────────────────────────────────

function toCanonical(a: AuthoredScene): unknown {
  const tickRate = a.tickRate;
  const toTick = (s: number): number => Math.round(s * tickRate);

  return {
    id: a.id,
    name: a.name,
    tickRate,
    durationTicks: toTick(a.durationSeconds),
    assets: a.assets,
    entities: a.entities.map(compileEntity),
    tracks: a.tracks.map((t) => compileTrack(t, toTick)),
    events: a.events.map((e) => ({ tick: toTick(e.atSeconds), type: e.type, payload: e.payload })),
  };
}

type CompiledComponent = { type: string; data: Record<string, JsonValue> };

function compileEntity(e: AuthoredScene['entities'][number]): unknown {
  const lookAt = findCameraLookAt(e.components);

  const components: CompiledComponent[] = e.components.map((c) => {
    const data = { ...c.data } as unknown as Record<string, JsonValue>;
    if (c.type === 'Camera') {
      delete data.lookAt; // lookAt 是 authoring 專用，不進 canonical
    } else if (c.type === 'Transform' && data.rotation !== undefined) {
      data.rotation = degToRadVec(data.rotation); // 初始旋轉：度 → 弧度
    }
    return { type: c.type, data };
  });

  // 有 lookAt：由相機位置算出注視旋轉（弧度），寫回 Transform.rotation。
  if (lookAt) {
    const tIdx = components.findIndex((c) => c.type === 'Transform');
    const pos = tIdx >= 0 ? readVec3(components[tIdx].data.position) : { x: 0, y: 0, z: 0 };
    const rotation = vecToJson(eulerFromLookAt(pos, lookAt));
    if (tIdx >= 0) components[tIdx].data.rotation = rotation;
    else components.push({ type: 'Transform', data: { rotation } });
  }

  return { id: e.id, name: e.name, components };
}

function compileTrack(
  t: AuthoredScene['tracks'][number],
  toTick: (s: number) => number,
): unknown {
  if (t.kind === 'authored') {
    return {
      id: t.id,
      entityId: t.entityId,
      kind: 'authored',
      target: t.target,
      keyframes: t.keyframes.map((k) => ({
        tick: toTick(k.atSeconds),
        value: t.target === 'transform.rotation' ? degToRadValue(k.value) : k.value,
        ...(k.easing !== undefined ? { easing: k.easing } : {}),
      })),
    };
  }
  return {
    id: t.id,
    entityId: t.entityId,
    kind: 'interactive',
    target: t.target,
    startTick: toTick(t.startSeconds),
    endTick: t.endSeconds === null ? null : toTick(t.endSeconds),
    controller: t.controller,
    params: t.params,
  };
}

// ─────────────────────────────────────────────────────────────
// 幾何 / 單位
// ─────────────────────────────────────────────────────────────

/** 從相機位置與注視點算出 euler（XYZ、弧度），對齊 Three 相機（-Z 前、+Y 上）。 */
export function eulerFromLookAt(pos: Vec3, target: Vec3): Vec3 {
  // z 軸 = normalize(pos - target)（相機沿 -z 看向 target）
  let zx = pos.x - target.x;
  let zy = pos.y - target.y;
  let zz = pos.z - target.z;
  const zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl;
  zy /= zl;
  zz /= zl;

  // x = normalize(cross(up=(0,1,0), z)) = normalize((zz, 0, -zx))
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xl = Math.hypot(xx, xy, xz);
  if (xl < 1e-6) {
    // z 與 up 平行（正上/正下看）→ 退回 x 軸
    xx = 1;
    xy = 0;
    xz = 0;
  } else {
    xx /= xl;
    xy /= xl;
    xz /= xl;
  }

  // y = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  // 旋轉矩陣（基底為欄向量 x,y,z）→ euler XYZ
  const m11 = xx;
  const m12 = yx;
  const m13 = zx;
  const m22 = yy;
  const m23 = zy;
  const m32 = yz;
  const m33 = zz;

  const clamp = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);
  const ry = Math.asin(clamp(m13));
  let rx: number;
  let rz: number;
  if (Math.abs(m13) < 0.9999999) {
    rx = Math.atan2(-m23, m33);
    rz = Math.atan2(-m12, m11);
  } else {
    rx = Math.atan2(m32, m22);
    rz = 0;
  }
  return { x: rx, y: ry, z: rz };
}

function vecToJson(v: Vec3): JsonValue {
  return { x: v.x, y: v.y, z: v.z };
}

function degToRadVec(v: unknown): JsonValue {
  const r = readVec3(v);
  return { x: r.x * DEG2RAD, y: r.y * DEG2RAD, z: r.z * DEG2RAD };
}

/** keyframe rotation 值：是 vec 才轉度→弧度，否則原樣（value 型別為 JsonValue）。 */
function degToRadValue(v: unknown): JsonValue {
  return isVecLike(v) ? degToRadVec(v) : (v as JsonValue);
}

function isVecLike(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).x === 'number' &&
    typeof (v as Record<string, unknown>).y === 'number'
  );
}

function readVec3(v: unknown): Vec3 {
  if (isVecLike(v)) {
    return {
      x: typeof v.x === 'number' ? v.x : 0,
      y: typeof v.y === 'number' ? v.y : 0,
      z: typeof v.z === 'number' ? v.z : 0,
    };
  }
  return { x: 0, y: 0, z: 0 };
}

function findCameraLookAt(
  components: AuthoredScene['entities'][number]['components'],
): Vec3 | undefined {
  for (const c of components) {
    if (c.type === 'Camera' && c.data.lookAt) return readVec3(c.data.lookAt);
  }
  return undefined;
}

function isAuthoringForm(input: unknown): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'durationSeconds' in (input as Record<string, unknown>)
  );
}

function zodIssueToError(issue: {
  readonly path: ReadonlyArray<PropertyKey>;
  readonly message: string;
}): ValidationError {
  let out = '';
  for (const seg of issue.path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out === '' ? String(seg) : `.${String(seg)}`;
  }
  return { path: out === '' ? '(root)' : out, message: issue.message };
}
