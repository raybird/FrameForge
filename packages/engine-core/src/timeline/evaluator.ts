/**
 * Timeline Evaluator——MVP 命脈①。
 *
 * evaluate(timeline, tick) → WorldState：把所有 AuthoredTrack 在 tick 求值，
 * 投影成可序列化的 WorldState。這是純函數 f(tick)：
 *   - 不依賴呼叫歷史（任意順序 seek 結果一致，零漂移）
 *   - 不使用 Math.random / Date.now
 *   - entities 以 id 穩定排序，避免迭代順序破壞決定性
 *
 * InteractiveSegment 不在這裡求值（需薄 SimCore + replay）；此處只負責編排內容。
 */

import type {
  AuthoredTrack,
  ComponentState,
  Entity,
  EntityState,
  JsonValue,
  SceneTimeline,
  Tick,
  TrackTarget,
  Transform,
  Vec3,
  WorldState,
} from '@frameforge/shared-types';
import { sampleTrack } from './track-sampler';

export interface EvaluateOptions {
  /** 寫入 WorldState.rng 的初始 RNG 狀態（純編排內容不消耗亂數）。 */
  seed?: number;
}

const byIdAsc = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function evaluate(
  timeline: SceneTimeline,
  tick: Tick,
  opts: EvaluateOptions = {},
): WorldState {
  // 1. 建立基礎 entity 狀態（依 id 穩定排序）
  const entities = [...timeline.entities].sort(byIdAsc).map(baseEntityState);
  const byId = new Map(entities.map((es) => [es.id, es]));

  // 2. 套用 authored tracks（依 track id 穩定排序，確保套用順序決定性）
  const authored = timeline.tracks
    .filter((t): t is AuthoredTrack => t.kind === 'authored')
    .sort(byIdAsc);

  for (const track of authored) {
    const es = byId.get(track.entityId);
    if (!es || track.keyframes.length === 0) continue;
    applyTarget(es, track.target, sampleTrack(track, tick));
  }

  return {
    tick,
    rng: (opts.seed ?? 0) >>> 0,
    entities,
    vars: {},
  };
}

// ─────────────────────────────────────────────────────────────
// 基礎狀態
// ─────────────────────────────────────────────────────────────

function baseEntityState(entity: Entity): EntityState {
  const components: Record<string, ComponentState> = {};
  for (const c of entity.components) {
    components[c.type] = { type: c.type, data: { ...c.data } };
  }

  // 若有 Transform component，用它的初始值當基礎
  const t = entity.components.find((c) => c.type === 'Transform');
  const transform: Transform = {
    position: readVec3(t?.data.position, { x: 0, y: 0, z: 0 }),
    rotation: readVec3(t?.data.rotation, { x: 0, y: 0, z: 0 }),
    scale: readVec3(t?.data.scale, { x: 1, y: 1, z: 1 }),
  };

  return {
    id: entity.id,
    transform,
    visible: true,
    opacity: 1,
    components,
  };
}

// ─────────────────────────────────────────────────────────────
// 套用 track 值到 entity 狀態
// ─────────────────────────────────────────────────────────────

function applyTarget(es: EntityState, target: TrackTarget, value: JsonValue): void {
  switch (target) {
    case 'transform.position':
      es.transform.position = readVec3(value, es.transform.position);
      return;
    case 'transform.rotation':
      es.transform.rotation = readVec3(value, es.transform.rotation);
      return;
    case 'transform.scale':
      es.transform.scale = readVec3(value, es.transform.scale);
      return;
    case 'visible':
      es.visible = Boolean(value);
      return;
    case 'opacity':
      es.opacity = typeof value === 'number' ? value : es.opacity;
      return;
    default: {
      // component.<type>.<field...>
      if (target.startsWith('component.')) {
        const path = target.slice('component.'.length).split('.');
        const type = path[0];
        const comp = (es.components[type] ??= {
          type: type as ComponentState['type'],
          data: {},
        });
        if (path.length >= 2) setDeep(comp.data, path.slice(1), value);
      }
    }
  }
}

function setDeep(
  obj: Record<string, JsonValue>,
  path: string[],
  value: JsonValue,
): void {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = cur[key];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, JsonValue>;
  }
  cur[path[path.length - 1]] = value;
}

function readVec3(value: JsonValue | undefined, fallback: Vec3): Vec3 {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  ) {
    const z = value.z;
    return { x: value.x, y: value.y, z: typeof z === 'number' ? z : fallback.z };
  }
  return { ...fallback };
}
