import { describe, expect, it } from 'vitest';
import { Mulberry32 } from './mulberry32';

describe('Mulberry32', () => {
  it('同一 seed 產生完全相同的序列', () => {
    const a = new Mulberry32(12345);
    const b = new Mulberry32(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('不同 seed 產生不同序列', () => {
    const a = new Mulberry32(1);
    const b = new Mulberry32(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('輸出落在 [0, 1)', () => {
    const rng = new Mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('狀態可保存/還原並重現後續序列（snapshot seek 用）', () => {
    const original = new Mulberry32(777);
    for (let i = 0; i < 50; i++) original.next();

    const saved = original.state; // 在第 50 次後存檔
    const expectedNext = Array.from({ length: 20 }, () => original.next());

    const restored = Mulberry32.fromState(saved);
    const actualNext = Array.from({ length: 20 }, () => restored.next());

    expect(actualNext).toEqual(expectedNext);
  });

  it('state 為可序列化的 unsigned 32-bit 整數', () => {
    const rng = new Mulberry32(-1);
    rng.next();
    expect(Number.isInteger(rng.state)).toBe(true);
    expect(rng.state).toBeGreaterThanOrEqual(0);
    expect(rng.state).toBeLessThanOrEqual(0xffffffff);
  });
});
