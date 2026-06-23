/**
 * 緩動函式：把線性進度 raw∈[0,1] 映射為 eased∈[0,1]。
 * 全部是純函數，決定性。
 */

import type { Easing } from '@frameforge/shared-types';

export type EasingFn = (t: number) => number;

const linear: EasingFn = (t) => t;
/** step：保持前一個 keyframe 值，直到抵達下一個（離散屬性用，如 animator.clip）。 */
const step: EasingFn = () => 0;
const easeIn: EasingFn = (t) => t * t;
const easeOut: EasingFn = (t) => t * (2 - t);
const easeInOut: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

/** 標準 cubic-bezier 計時函式（同 CSS）：給 x 解出 y。 */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): EasingFn {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveX = (x: number): number => {
    let t = x;
    // Newton-Raphson
    for (let i = 0; i < 8; i++) {
      const x2 = sampleX(t) - x;
      if (Math.abs(x2) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= x2 / d;
    }
    // 退回二分法
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 32; i++) {
      const x2 = sampleX(t);
      if (Math.abs(x2 - x) < 1e-6) return t;
      if (x > x2) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x) => sampleY(solveX(x));
}

/** 把 Easing 設定解析成函式。undefined / 'linear' → 線性。 */
export function resolveEasing(easing: Easing | undefined): EasingFn {
  if (easing === undefined) return linear;
  if (typeof easing === 'object') {
    return cubicBezier(easing.p1x, easing.p1y, easing.p2x, easing.p2y);
  }
  switch (easing) {
    case 'linear':
      return linear;
    case 'step':
      return step;
    case 'easeIn':
      return easeIn;
    case 'easeOut':
      return easeOut;
    case 'easeInOut':
      return easeInOut;
    default:
      return linear;
  }
}
