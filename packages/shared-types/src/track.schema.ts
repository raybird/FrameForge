/**
 * Track 契約——FrameForge 的核心抽象（路線甲）。
 *
 * 時間軸有兩種軌道，時間性質不同，必須分開：
 *   - AuthoredTrack      : 純函數 f(t)，由 keyframes 決定，可瞬間 seek，免 snapshot。
 *   - InteractiveSegment : 依賴歷史/input，由薄 SimCore 驅動，需 snapshot + event-log 重放。
 *
 * 甲的最大紅利：只有 InteractiveSegment 那一小塊需要 snapshot/replay，
 * AuthoredTrack 永遠是「評估 t」，免重算。
 */

import type { EntityId, JsonValue, TrackId } from './common';
import type { Tick } from './time';

// ─────────────────────────────────────────────────────────────
// track 驅動的目標屬性
// ─────────────────────────────────────────────────────────────

/**
 * 一條 track 驅動 entity 的哪個屬性。
 * `component.${string}` 用於自訂屬性，例如 'component.animator.clip'。
 */
export type TrackTarget =
  | 'transform.position'
  | 'transform.rotation'
  | 'transform.scale'
  | 'visible'
  | 'opacity'
  | `component.${string}`;

// ─────────────────────────────────────────────────────────────
// 插值
// ─────────────────────────────────────────────────────────────

export interface CubicBezierEasing {
  type: 'cubicBezier';
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
}

export type Easing =
  | 'linear'
  | 'step' // 階梯：保持前一個 keyframe 值直到下一個（離散屬性用，如 animator.clip）
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | CubicBezierEasing;

/**
 * keyframe。value 的型別取決於 track 的 target
 * （position → Vec3、opacity → number、animator.clip → string…）。
 */
export interface Keyframe {
  /** 已量化到 tick 邊界。 */
  tick: Tick;
  value: JsonValue;
  /** 到「下一個」keyframe 的插值方式。預設 linear。 */
  easing?: Easing;
}

// ─────────────────────────────────────────────────────────────
// 兩種 track
// ─────────────────────────────────────────────────────────────

export type TrackKind = 'authored' | 'interactive';

interface BaseTrack {
  id: TrackId;
  /** 這條 track 驅動哪個 entity。 */
  entityId: EntityId;
  target: TrackTarget;
  kind: TrackKind;
}

/** 純 f(t)：由 keyframes 決定，可瞬間 seek。 */
export interface AuthoredTrack extends BaseTrack {
  kind: 'authored';
  /** 依 tick 遞增排序。 */
  keyframes: Keyframe[];
}

/**
 * 依賴歷史/input：由薄 SimCore 的某個 controller 驅動。
 * 例：kinematic 移動控制器、簡單狀態機。
 */
export interface InteractiveSegment extends BaseTrack {
  kind: 'interactive';
  startTick: Tick;
  /** null = 開放結尾（直到某事件結束）。 */
  endTick: Tick | null;
  /** SimCore 裡的 controller 識別字（如 'kinematic' / 'stateMachine'）。 */
  controller: string;
  /** controller 的初始參數（可序列化）。 */
  params: Record<string, JsonValue>;
}

export type Track = AuthoredTrack | InteractiveSegment;
