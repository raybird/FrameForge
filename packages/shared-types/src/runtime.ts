/**
 * 執行期介面契約（只有 interface，沒有實作）。
 * 實作分散在 engine-core / engine-three / engine-audio…，但契約集中在這裡。
 */

import type { Seconds, Tick } from './time';
import type { ReplayLog } from './replay.schema';
import type { WorldState } from './worldstate.schema';

// ─────────────────────────────────────────────────────────────
// 時間控制
// ─────────────────────────────────────────────────────────────

export type SchedulerMode = 'realtime' | 'deterministic';

export interface FrameScheduler {
  readonly mode: SchedulerMode;
  /** 目前 tick（真相時間）。 */
  readonly tick: Tick;

  play(): void;
  pause(): void;
  resume(): void;

  /** 推進一段時間（內部換算為整數 tick；realtime 模式由 rAF 餵 dt）。 */
  tick_(dt: Seconds): void;

  /** 跳到指定時間（秒會先量化為 tick）。 */
  seek(time: Seconds): void;

  /** 播放速率（0.5 / 1 / 2…）。 */
  setSpeed(speed: number): void;
}

// ─────────────────────────────────────────────────────────────
// Frame Adapter（HyperFrames 式 seek/playback adapter）
// ─────────────────────────────────────────────────────────────

/** mount 時注入的環境（renderer、scene、asset 表…，具體型別由各實作決定）。 */
export interface FrameContext {
  [key: string]: unknown;
}

/**
 * seek 時提供的回放上下文：讓 adapter 知道「要呈現的世界狀態」與來源 log。
 * adapter 不自行模擬——它只把 world 投影到自己的視圖。
 */
export interface ReplayContext {
  world: WorldState;
  log?: ReplayLog;
}

export interface FrameAdapter {
  readonly id: string;
  /** 調度優先序：Scene 0 / Character 1 / VFX 2 / Audio 3 / UI 4 / Capture 99。 */
  readonly priority: number;

  mount(ctx: FrameContext): void;
  unmount(): void;

  /** 即時推進（realtime 模式）。 */
  update(dt: Seconds): void;

  /** 評估時間 t → 投影到視圖（deterministic / seek / export）。 */
  seek(time: Seconds, replay?: ReplayContext): void;
}
