/**
 * TimelinePlayer：把 Scheduler + Timeline Evaluator + Frame Adapters + Stage 綁起來。
 *
 * 每一幀的流程（純 f(tick) → 投影 → 渲染）：
 *   evaluate(timeline, tick) → WorldState
 *     → 依 priority 分發給各 adapter.seek(seconds, { world })
 *       → stage.renderFrame()
 *
 * - seek / scrub：直接走 scheduler.seek → renderAt（決定性，與歷史無關）。
 * - realtime play：用 rAF 餵真實 dt 給 scheduler（牆鐘僅用於即時節奏，非真相時間）。
 */

import type { FrameAdapter, SceneTimeline, Tick } from '@frameforge/shared-types';
import { Scheduler, evaluate } from '@frameforge/engine-core';
import type { Stage } from './stage';

export interface TimelinePlayerOptions {
  seed?: number;
  scheduler?: Scheduler;
  /** 每渲染一幀後觸發（play 與 seek 都會），供 UI 同步時間軸滑桿等。 */
  onRender?: (tick: Tick) => void;
}

export class TimelinePlayer {
  readonly scheduler: Scheduler;
  private readonly adapters: FrameAdapter[];
  private readonly seed?: number;
  private readonly onRender?: (tick: Tick) => void;
  private rafId: number | null = null;
  private lastMs = 0;

  constructor(
    private readonly timeline: SceneTimeline,
    private readonly stage: Stage,
    adapters: FrameAdapter[],
    opts: TimelinePlayerOptions = {},
  ) {
    this.seed = opts.seed;
    this.onRender = opts.onRender;
    // 依 priority 升冪：Scene(0) → Entity(1) → …
    this.adapters = [...adapters].sort((a, b) => a.priority - b.priority);
    this.scheduler =
      opts.scheduler ??
      new Scheduler({
        tickRate: timeline.tickRate,
        durationTicks: timeline.durationTicks,
        onTick: (t) => this.renderAt(t),
        onSeek: (t) => this.renderAt(t),
      });
  }

  mount(): void {
    for (const a of this.adapters) a.mount({});
    this.renderAt(this.scheduler.tick);
  }

  unmount(): void {
    this.pause();
    for (const a of this.adapters) a.unmount();
  }

  /** 求值 → 分發 → 渲染一幀。 */
  renderAt(tick: Tick): void {
    const world = evaluate(this.timeline, tick, { seed: this.seed });
    const seconds = tick / this.timeline.tickRate;
    for (const a of this.adapters) a.seek(seconds, { world });
    this.stage.renderFrame();
    this.onRender?.(tick);
  }

  seekTick(tick: Tick): void {
    this.scheduler.seekTick(tick);
  }

  seekSeconds(seconds: number): void {
    this.scheduler.seek(seconds);
  }

  setSpeed(speed: number): void {
    this.scheduler.setSpeed(speed);
  }

  /** realtime 播放（瀏覽器）。 */
  play(): void {
    if (this.rafId != null) return;
    this.scheduler.play();
    this.lastMs = nowMs();
    const loop = (): void => {
      const t = nowMs();
      const dt = (t - this.lastMs) / 1000;
      this.lastMs = t;
      this.scheduler.advance(dt);
      if (this.scheduler.playing) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  pause(): void {
    this.scheduler.pause();
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  get playing(): boolean {
    return this.scheduler.playing;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}
