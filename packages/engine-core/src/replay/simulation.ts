/**
 * Simulation：薄 SimCore。持有「互動狀態」並逐 tick 決定性前進。
 *
 * - 只能往前 step；要回到過去 → 由 ReplaySession 先 restore snapshot 再 step。
 * - 同一 tick 內所有 segment 依 id 順序共用同一條 RNG 序列（順序固定 → 決定性）。
 * - SimState 全為可序列化 JsonValue，可直接存成 Snapshot。
 */

import type {
  InteractiveSegment,
  JsonValue,
  ReplayEvent,
  RngState,
  Tick,
  Vec3,
  WorldState,
} from '@frameforge/shared-types';
import { Mulberry32 } from '../rng/mulberry32';
import type { ControllerRegistry, ControllerState } from './controller';

export interface SimState {
  tick: Tick;
  rngState: RngState;
  /** key = segment.id。 */
  controllers: Record<string, ControllerState>;
  /** 全域互動變數（狀態機 enum、計數器…）。 */
  vars: Record<string, JsonValue>;
}

export function cloneSimState(s: SimState): SimState {
  // JSON clone：精確複製且同時保證可序列化（所有欄位皆 JsonValue）。
  return JSON.parse(JSON.stringify(s)) as SimState;
}

function isSegmentActive(seg: InteractiveSegment, tick: Tick): boolean {
  return tick >= seg.startTick && (seg.endTick === null || tick <= seg.endTick);
}

function eventTargets(e: ReplayEvent, seg: InteractiveSegment): boolean {
  const p = e.payload;
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return false;
  return (p as Record<string, JsonValue>).entityId === seg.entityId;
}

export class Simulation {
  private readonly segments: InteractiveSegment[];
  private state: SimState;

  constructor(
    segments: InteractiveSegment[],
    private readonly registry: ControllerRegistry,
    seed: number,
  ) {
    // 依 id 穩定排序：固定 step 與 RNG 消耗順序。
    this.segments = [...segments].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.state = this.initialState(seed);
  }

  private initialState(seed: number): SimState {
    const controllers: Record<string, ControllerState> = {};
    for (const seg of this.segments) {
      const c = this.registry.get(seg.controller);
      if (c) controllers[seg.id] = c.init(seg);
    }
    return { tick: 0, rngState: seed >>> 0, controllers, vars: {} };
  }

  get currentTick(): Tick {
    return this.state.tick;
  }

  snapshot(): SimState {
    return cloneSimState(this.state);
  }

  restore(s: SimState): void {
    this.state = cloneSimState(s);
  }

  /** 從目前 tick 前進到 targetTick（targetTick 必須 >= currentTick）。 */
  stepTo(targetTick: Tick, eventsByTick: Map<Tick, ReplayEvent[]>): void {
    while (this.state.tick < targetTick) {
      const nextTick = this.state.tick + 1;
      const rng = Mulberry32.fromState(this.state.rngState);
      const tickEvents = eventsByTick.get(nextTick);

      // 本 tick 由 motion 控制器算出的位置；sensor（觸發）可讀取。
      const posThisTick = new Map<string, Vec3>();
      const readPos = (id: string): Vec3 | null => posThisTick.get(id) ?? null;

      // 兩階段：motion 先跑（產生位置），sensor 後跑（讀本 tick 位置）。
      for (const phase of ['motion', 'sensor'] as const) {
        for (const seg of this.segments) {
          const controller = this.registry.get(seg.controller);
          if (!controller) continue;
          if ((controller.phase ?? 'motion') !== phase) continue;
          if (!isSegmentActive(seg, nextTick)) continue;

          const segEvents = tickEvents ? tickEvents.filter((e) => eventTargets(e, seg)) : [];
          const next = controller.step({
            segment: seg,
            state: this.state.controllers[seg.id] ?? controller.init(seg),
            events: segEvents,
            rng,
            tick: nextTick,
            readPos,
          });
          this.state.controllers[seg.id] = next;

          const pos = controller.readPosition?.(next);
          if (pos) posThisTick.set(seg.entityId, pos);
        }
      }

      this.state.rngState = rng.state; // 持久化 RNG 前進
      this.state.tick = nextTick;
    }
  }

  /** 把目前互動狀態投影到 world（在 authored 求值之後呼叫，可覆蓋 authored 值）。 */
  project(world: WorldState): void {
    world.rng = this.state.rngState;
    for (const [k, v] of Object.entries(this.state.vars)) world.vars[k] = v;

    for (const seg of this.segments) {
      if (!isSegmentActive(seg, this.state.tick)) continue;
      const controller = this.registry.get(seg.controller);
      const st = this.state.controllers[seg.id];
      if (controller && st) controller.project(st, seg, world);
    }
  }
}
