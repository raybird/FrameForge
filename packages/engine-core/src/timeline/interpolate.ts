/**
 * 值插值：支援 number 與 Vec2/Vec3；其餘（boolean / string / array / object）
 * 視為離散，在區間內保持前值（step 行為），抵達下一個 keyframe 才切換。
 */

import type { JsonValue } from '@frameforge/shared-types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface VecLike {
  x: number;
  y: number;
  z?: number;
}

function isVecLike(v: JsonValue): v is VecLike & Record<string, JsonValue> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).x === 'number' &&
    typeof (v as Record<string, unknown>).y === 'number'
  );
}

/** 依 factor∈[0,1] 在 a、b 之間插值。 */
export function lerpValue(a: JsonValue, b: JsonValue, factor: number): JsonValue {
  if (typeof a === 'number' && typeof b === 'number') {
    return lerp(a, b, factor);
  }
  if (isVecLike(a) && isVecLike(b)) {
    const out: Record<string, number> = {
      x: lerp(a.x, b.x, factor),
      y: lerp(a.y, b.y, factor),
    };
    if ('z' in a || 'z' in b) {
      out.z = lerp(a.z ?? 0, b.z ?? 0, factor);
    }
    return out;
  }
  // 離散：區間內保持前值
  return factor < 1 ? a : b;
}
