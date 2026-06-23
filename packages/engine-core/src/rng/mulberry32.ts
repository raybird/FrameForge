/**
 * mulberry32：可 seed 的決定性 PRNG。
 *
 * 為什麼用它：決定性 replay 嚴禁 Math.random()。整個狀態只有單一 32-bit 整數，
 * 可直接存進 Snapshot（RngState），seek 時還原即可重現同一序列。
 */

import type { RngState } from '@frameforge/shared-types';

export class Mulberry32 {
  /** 內部累加器（int32）。 */
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  /** 從已保存的狀態還原（用於 snapshot seek）。 */
  static fromState(state: RngState): Mulberry32 {
    const rng = new Mulberry32(0);
    rng.a = state >>> 0;
    return rng;
  }

  /** 目前可序列化狀態（unsigned 32-bit），存進 Snapshot 用。 */
  get state(): RngState {
    return this.a >>> 0;
  }

  /** 下一個亂數，範圍 [0, 1)。 */
  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 整數亂數，範圍 [min, max]（含端點）。 */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}
