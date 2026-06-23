/**
 * 時間基準。
 *
 * 鐵則：canonical 時間是「整數 tick」，秒數永遠是衍生顯示值。
 * 嚴禁累加浮點 dt 當作真相時間——那是決定性 replay 最常見的破功原因。
 */

/** 整數 tick：引擎唯一的真相時間單位（>= 0 的整數）。 */
export type Tick = number;

/** 秒：衍生顯示值，永遠由 tick / tickRate 算出，不可累加。 */
export type Seconds = number;

/** 每秒幾個 tick。預設 60。整段時間軸固定此值。 */
export type TickRate = number;

export const DEFAULT_TICK_RATE: TickRate = 60;

/** tick → 秒（衍生值，僅供顯示）。 */
export function ticksToSeconds(tick: Tick, tickRate: TickRate): Seconds {
  return tick / tickRate;
}

/**
 * 秒 → tick，並量化到 tick 邊界（四捨五入）。
 * 所有外部時間（event.time、seek 目標）進入引擎前都要先過這裡，
 * 確保「同一事件在同一 tick 被套用」。
 */
export function secondsToTicks(seconds: Seconds, tickRate: TickRate): Tick {
  return Math.round(seconds * tickRate);
}
