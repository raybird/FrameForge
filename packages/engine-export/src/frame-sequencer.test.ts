import { describe, expect, it } from 'vitest';
import { sequenceFrames } from './frame-sequencer';

describe('sequenceFrames', () => {
  it('fps == tickRate：每個 tick 一幀', () => {
    const frames = sequenceFrames({ endTick: 60, tickRate: 60, fps: 60 });
    expect(frames).toHaveLength(60);
    expect(frames[0]).toEqual({ index: 0, tick: 0, timestampMicros: 0 });
    expect(frames[59].tick).toBe(59);
  });

  it('fps < tickRate：抽樣（30fps over 60Hz → 每隔一個 tick）', () => {
    const frames = sequenceFrames({ endTick: 60, tickRate: 60, fps: 30 });
    expect(frames).toHaveLength(30);
    expect(frames.map((f) => f.tick).slice(0, 4)).toEqual([0, 2, 4, 6]);
  });

  it('時間戳為 1/fps 秒的微秒值', () => {
    const frames = sequenceFrames({ endTick: 120, tickRate: 60, fps: 30 });
    expect(frames[0].timestampMicros).toBe(0);
    expect(frames[1].timestampMicros).toBe(Math.round(1_000_000 / 30));
  });

  it('tick 夾在 endTick 內，且至少一幀', () => {
    expect(sequenceFrames({ endTick: 0, tickRate: 60, fps: 60 })).toHaveLength(1);
    const frames = sequenceFrames({ startTick: 0, endTick: 10, tickRate: 60, fps: 60 });
    expect(frames.every((f) => f.tick <= 10)).toBe(true);
  });
});
