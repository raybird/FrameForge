/**
 * ReplayLog 工具：錄製事件、依 tick 建索引。
 */

import type { JsonValue, ReplayEvent, ReplayLog, Tick } from '@frameforge/shared-types';

/** 把事件依 tick 分組（保留同 tick 內的 log 順序 → 決定性）。 */
export function indexEvents(events: ReplayEvent[]): Map<Tick, ReplayEvent[]> {
  const map = new Map<Tick, ReplayEvent[]>();
  for (const e of events) {
    const arr = map.get(e.tick);
    if (arr) arr.push(e);
    else map.set(e.tick, [e]);
  }
  return map;
}

/** 互動事件錄製器。產出的 ReplayLog 依 tick 穩定排序。 */
export class ReplayRecorder {
  private readonly events: ReplayEvent[] = [];

  constructor(
    readonly sceneId: string,
    readonly tickRate: number,
    readonly seed: number,
  ) {}

  record(tick: Tick, type: string, payload: JsonValue): void {
    this.events.push({ tick, type, payload });
  }

  build(): ReplayLog {
    // 穩定排序：依 tick；同 tick 維持錄入順序。
    const events = this.events
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.tick - b.e.tick || a.i - b.i)
      .map(({ e }) => e);
    return { sceneId: this.sceneId, tickRate: this.tickRate, seed: this.seed, events };
  }
}
