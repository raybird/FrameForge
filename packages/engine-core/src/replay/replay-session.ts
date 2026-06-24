/**
 * ReplaySession：把 Timeline + Simulation + ReplayLog + Snapshot 綁起來。
 *
 * seek(tick) 是 (timeline, log, seed, tick) 的純函數：
 *   1. 還原 <= tick 的最近 snapshot
 *   2. 決定性 step 到 tick（沿途每 interval 補一個 snapshot，記憶化）
 *   3. 合成：authored f(tick) ⊕ interactive 投影
 *
 * 因為每次 seek 都先 restore 再 replay，結果與呼叫順序無關 → 命脈②（零漂移）。
 */

import type {
  InteractiveSegment,
  JsonValue,
  ReplayEvent,
  ReplayLog,
  SceneTimeline,
  Tick,
  Track,
  WorldState,
} from '@frameforge/shared-types';
import { evaluate } from '../timeline/evaluator';
import { ControllerRegistry } from './controller';
import { Simulation, type SimState } from './simulation';
import { indexEvents } from './replay-log';

export interface ReplaySessionOptions {
  registry: ControllerRegistry;
  log?: ReplayLog;
  /** 預設取 log.seed，否則 0。 */
  seed?: number;
  /** 每幾 tick 存一個 snapshot。預設 60。 */
  snapshotInterval?: Tick;
}

function isInteractive(t: Track): t is InteractiveSegment {
  return t.kind === 'interactive';
}

export class ReplaySession {
  private readonly sim: Simulation;
  private readonly eventsByTick: Map<Tick, ReplayEvent[]>;
  private readonly snapshots: SimState[]; // 依 tick 遞增，含 tick 0
  private readonly interval: Tick;
  private readonly seed: number;

  constructor(
    private readonly timeline: SceneTimeline,
    opts: ReplaySessionOptions,
  ) {
    const segments = timeline.tracks.filter(isInteractive);
    this.seed = (opts.seed ?? opts.log?.seed ?? 0) >>> 0;
    this.interval = Math.max(1, opts.snapshotInterval ?? 60);
    this.sim = new Simulation(segments, opts.registry, this.seed);
    this.eventsByTick = indexEvents(opts.log?.events ?? []);
    this.snapshots = [this.sim.snapshot()]; // tick 0
  }

  /** 求值並投影出 tick 的完整 WorldState（authored ⊕ interactive）。 */
  seek(tick: Tick): WorldState {
    const target = tick < 0 ? 0 : tick;

    this.sim.restore(this.nearestSnapshot(target));
    this.advanceTo(target);

    const world = evaluate(this.timeline, target, { seed: this.seed });
    this.sim.project(world);
    return world;
  }

  /**
   * 即時錄製一個事件（互動的 live edge）。
   * 會失效「>= tick」的 snapshot（它們在事件加入前算的，已過時），確保之後 seek 重算正確。
   * 注意：事件在 step 到 tick 時被消耗，故 tick 應 >= 1（tick 0 的事件不會被處理）。
   */
  recordEvent(tick: Tick, type: string, payload: JsonValue): void {
    const t = tick < 1 ? 1 : tick;
    const arr = this.eventsByTick.get(t);
    if (arr) arr.push({ tick: t, type, payload });
    else this.eventsByTick.set(t, [{ tick: t, type, payload }]);

    for (let i = this.snapshots.length - 1; i >= 1; i--) {
      if (this.snapshots[i].tick >= t) this.snapshots.splice(i, 1);
    }
  }

  /** 匯出目前完整 log（原始 + 即時錄製），可持久化/分享。 */
  exportLog(): ReplayLog {
    const ticks = [...this.eventsByTick.keys()].sort((a, b) => a - b);
    const events: ReplayEvent[] = [];
    for (const t of ticks) events.push(...this.eventsByTick.get(t)!);
    return {
      sceneId: this.timeline.id,
      tickRate: this.timeline.tickRate,
      seed: this.seed,
      events,
    };
  }

  /** 目前已記錄的 snapshot tick（測試/偵錯用）。 */
  snapshotTicks(): Tick[] {
    return this.snapshots.map((s) => s.tick);
  }

  private nearestSnapshot(tick: Tick): SimState {
    let best = this.snapshots[0];
    for (const s of this.snapshots) {
      if (s.tick <= tick && s.tick >= best.tick) best = s;
    }
    return best;
  }

  private advanceTo(target: Tick): void {
    while (this.sim.currentTick < target) {
      const next = this.sim.currentTick + 1;
      this.sim.stepTo(next, this.eventsByTick);
      if (next % this.interval === 0 && !this.hasSnapshot(next)) {
        this.snapshots.push(this.sim.snapshot());
      }
    }
  }

  private hasSnapshot(tick: Tick): boolean {
    return this.snapshots.some((s) => s.tick === tick);
  }
}
