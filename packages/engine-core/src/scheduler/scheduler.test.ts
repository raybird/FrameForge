import { describe, expect, it, vi } from 'vitest';
import { Scheduler } from './scheduler';

describe('Scheduler', () => {
  it('預設 tickRate 60、起始 tick 0、未播放', () => {
    const s = new Scheduler();
    expect(s.tickRate).toBe(60);
    expect(s.tick).toBe(0);
    expect(s.playing).toBe(false);
  });

  it('未播放時 advance 不前進', () => {
    const s = new Scheduler();
    s.advance(1);
    expect(s.tick).toBe(0);
  });

  it('play 後 advance(1 秒) 在 60Hz 前進 60 tick', () => {
    const s = new Scheduler({ tickRate: 60 });
    s.play();
    s.advance(1);
    expect(s.tick).toBe(60);
    expect(s.seconds).toBeCloseTo(1);
  });

  it('speed 2x 時 advance(1 秒) 前進 120 tick', () => {
    const s = new Scheduler({ tickRate: 60 });
    s.play();
    s.setSpeed(2);
    s.advance(1);
    expect(s.tick).toBe(120);
  });

  it('小於一個 tick 的 dt 會累加，跨過門檻才前進', () => {
    const s = new Scheduler({ tickRate: 60 });
    s.play();
    const tickDur = 1 / 60;
    s.advance(tickDur * 0.4);
    expect(s.tick).toBe(0); // 0.4 tick，未跨過
    s.advance(tickDur * 0.7);
    expect(s.tick).toBe(1); // 累計 1.1 tick → 前進 1
  });

  it('onTick 對每個整數 tick 各觸發一次', () => {
    const onTick = vi.fn();
    const s = new Scheduler({ tickRate: 60, onTick });
    s.play();
    s.advance(1);
    expect(onTick).toHaveBeenCalledTimes(60);
    expect(onTick).toHaveBeenLastCalledWith(60);
  });

  it('seek 把秒量化為 tick 並觸發 onSeek', () => {
    const onSeek = vi.fn();
    const s = new Scheduler({ tickRate: 60, onSeek });
    s.seek(2);
    expect(s.tick).toBe(120);
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('seek 負值夾到 0', () => {
    const s = new Scheduler();
    s.seek(-5);
    expect(s.tick).toBe(0);
  });

  it('到達 durationTicks 後停止並夾住', () => {
    const s = new Scheduler({ tickRate: 60, durationTicks: 100 });
    s.play();
    s.advance(10); // 遠超過 100 tick
    expect(s.tick).toBe(100);
    expect(s.playing).toBe(false);
  });

  it('catchup 上限防止單次 advance 暴衝（不超過 5 秒份）', () => {
    const s = new Scheduler({ tickRate: 60 });
    s.play();
    s.advance(9999);
    expect(s.tick).toBeLessThanOrEqual(60 * 5);
  });
});
