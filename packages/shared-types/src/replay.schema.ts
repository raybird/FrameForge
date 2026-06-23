/**
 * Event / Replay 契約。
 *
 * Event 有兩種用途，型別相同但來源不同：
 *   1. Authored cue points  : 場景作者預先排在時間軸上的事件（scene.switch / sfx.play …），
 *                             放在 SceneTimeline.events。
 *   2. Replay log           : 執行期錄下的玩家輸入/互動事件（input.click / character.move …），
 *                             放在 ReplayLog.events，用於 deterministic 重放。
 */

import type { JsonValue, SceneId } from './common';
import type { Tick, TickRate } from './time';

/**
 * 單一事件。time 一律以整數 tick 表示，且已量化到 tick 邊界，
 * 確保「同一事件在同一 tick 被套用」。
 */
export interface ReplayEvent<P extends JsonValue = JsonValue> {
  tick: Tick;
  /** 例：'input.click' | 'character.move' | 'scene.switch' | 'sfx.play'。 */
  type: string;
  payload: P;
}

/**
 * Replay log：一場互動的完整錄製。
 * 配合 SimCore 的決定性，同一個 log + 同一個 seed → 同一個結果。
 */
export interface ReplayLog {
  sceneId: SceneId;
  tickRate: TickRate;
  /** 初始 RNG seed。決定性的關鍵之一。 */
  seed: number;
  /** 依 tick 遞增排序。 */
  events: ReplayEvent[];
}
