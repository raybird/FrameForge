/**
 * AuthoredTrack 取樣：給定 tick，回傳該 track 的插值結果。純函數 f(tick)。
 */

import type { AuthoredTrack, JsonValue, Tick } from '@frameforge/shared-types';
import { resolveEasing } from './easing';
import { lerpValue } from './interpolate';

/**
 * 在 tick 處取樣 track 值。
 * - tick <= 第一個 keyframe：回傳第一個值
 * - tick >= 最後一個 keyframe：回傳最後一個值
 * - 中間：找出所在區間 [k0, k1)，以 k0 的 easing 插值
 * - keyframes 為空：回傳 null
 *
 * 注意：tick 是整數，factor 是衍生比值（不累加），故結果與呼叫歷史無關 → 零漂移。
 */
export function sampleTrack(track: AuthoredTrack, tick: Tick): JsonValue {
  const kfs = track.keyframes;
  if (kfs.length === 0) return null;
  if (tick <= kfs[0].tick) return kfs[0].value;

  const last = kfs[kfs.length - 1];
  if (tick >= last.tick) return last.value;

  // 找最大的 i 使 kfs[i].tick <= tick < kfs[i+1].tick
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].tick <= tick) i++;

  const k0 = kfs[i];
  const k1 = kfs[i + 1];
  const span = k1.tick - k0.tick;
  const raw = span === 0 ? 0 : (tick - k0.tick) / span;
  const eased = resolveEasing(k0.easing)(raw);
  return lerpValue(k0.value, k1.value, eased);
}
