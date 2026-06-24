import { describe, expect, it } from 'vitest';
import { ReplayRecorder, indexEvents } from './replay-log';

describe('ReplayRecorder', () => {
  it('build 依 tick 排序，同 tick 維持錄入順序', () => {
    const r = new ReplayRecorder('s', 60, 1);
    r.record(30, 'b', {});
    r.record(10, 'a', {});
    r.record(30, 'c', {}); // 與 b 同 tick，須排在 b 之後
    const log = r.build();
    expect(log.events.map((e) => e.type)).toEqual(['a', 'b', 'c']);
    expect(log.seed).toBe(1);
    expect(log.tickRate).toBe(60);
  });
});

describe('indexEvents', () => {
  it('依 tick 分組並保留順序', () => {
    const map = indexEvents([
      { tick: 5, type: 'x', payload: {} },
      { tick: 5, type: 'y', payload: {} },
      { tick: 8, type: 'z', payload: {} },
    ]);
    expect(map.get(5)!.map((e) => e.type)).toEqual(['x', 'y']);
    expect(map.get(8)!.map((e) => e.type)).toEqual(['z']);
    expect(map.has(99)).toBe(false);
  });
});
