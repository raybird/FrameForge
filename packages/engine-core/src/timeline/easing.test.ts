import { describe, expect, it } from 'vitest';
import { resolveEasing } from './easing';

describe('resolveEasing', () => {
  it('linear / undefined 為恆等', () => {
    expect(resolveEasing('linear')(0.3)).toBeCloseTo(0.3);
    expect(resolveEasing(undefined)(0.7)).toBeCloseTo(0.7);
  });

  it('step 在區間內恆為 0（保持前值）', () => {
    const step = resolveEasing('step');
    expect(step(0)).toBe(0);
    expect(step(0.5)).toBe(0);
    expect(step(0.999)).toBe(0);
  });

  it('easeInOut 端點為 0/1、中點為 0.5', () => {
    const e = resolveEasing('easeInOut');
    expect(e(0)).toBeCloseTo(0);
    expect(e(1)).toBeCloseTo(1);
    expect(e(0.5)).toBeCloseTo(0.5);
  });

  it('easeIn/easeOut 端點正確且單調', () => {
    const inn = resolveEasing('easeIn');
    const out = resolveEasing('easeOut');
    expect(inn(0)).toBeCloseTo(0);
    expect(inn(1)).toBeCloseTo(1);
    expect(out(0)).toBeCloseTo(0);
    expect(out(1)).toBeCloseTo(1);
    expect(inn(0.25)).toBeLessThan(0.25); // ease-in 起步慢
    expect(out(0.25)).toBeGreaterThan(0.25); // ease-out 起步快
  });

  it('cubicBezier 端點為 0/1 且單調遞增', () => {
    const e = resolveEasing({ type: 'cubicBezier', p1x: 0.25, p1y: 0.1, p2x: 0.25, p2y: 1 });
    expect(e(0)).toBeCloseTo(0, 4);
    expect(e(1)).toBeCloseTo(1, 4);
    let prev = -1;
    for (let x = 0; x <= 1.0001; x += 0.1) {
      const y = e(x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = y;
    }
  });
});
