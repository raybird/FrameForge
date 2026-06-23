/**
 * FrameScheduler 實作。
 *
 * 真相時間永遠是「整數 tick」。realtime 模式用 fractional accumulator 把變動的真實 dt
 * 換算成整數 tick——accumulator 是浮點，但它只負責即時節奏，絕不是真相時間。
 * deterministic / seek 走整數 tick，與 accumulator 無關。
 */

import type {
  FrameScheduler,
  SchedulerMode,
  Seconds,
  Tick,
  TickRate,
} from '@frameforge/shared-types';
import { DEFAULT_TICK_RATE, secondsToTicks, ticksToSeconds } from '@frameforge/shared-types';

export interface SchedulerOptions {
  tickRate?: TickRate;
  mode?: SchedulerMode;
  /** 時間軸總長（tick）。到達後停止。null = 不設限。 */
  durationTicks?: Tick | null;
  /** realtime 每推進一個整數 tick 觸發。 */
  onTick?: (tick: Tick) => void;
  /** seek 後觸發。 */
  onSeek?: (tick: Tick) => void;
}

/** 防止 spiral of death：單次 advance 最多補幾秒的 tick。 */
const MAX_CATCHUP_SECONDS = 5;

export class Scheduler implements FrameScheduler {
  readonly mode: SchedulerMode;
  readonly tickRate: TickRate;

  private _tick: Tick = 0;
  private _playing = false;
  private _speed = 1;
  /** fractional tick 累加器（以 tick 為單位，僅即時節奏用，非真相）。 */
  private acc = 0;
  private readonly durationTicks: Tick | null;
  private readonly onTick?: (tick: Tick) => void;
  private readonly onSeek?: (tick: Tick) => void;

  constructor(opts: SchedulerOptions = {}) {
    this.tickRate = opts.tickRate ?? DEFAULT_TICK_RATE;
    this.mode = opts.mode ?? 'realtime';
    this.durationTicks = opts.durationTicks ?? null;
    this.onTick = opts.onTick;
    this.onSeek = opts.onSeek;
  }

  get tick(): Tick {
    return this._tick;
  }

  get seconds(): Seconds {
    return ticksToSeconds(this._tick, this.tickRate);
  }

  get playing(): boolean {
    return this._playing;
  }

  get speed(): number {
    return this._speed;
  }

  play(): void {
    this._playing = true;
    this.acc = 0;
  }

  pause(): void {
    this._playing = false;
  }

  resume(): void {
    this._playing = true;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }

  advance(dtSeconds: Seconds): void {
    if (!this._playing) return;

    // 累加器以 tick 為單位：避免「逐次減 tickDur」累積浮點誤差。
    // 1e-9 epsilon 吸收單次乘法的微量誤差（如 60*(1/60) 落在 59.9999999…）。
    this.acc += dtSeconds * this._speed * this.tickRate;
    let steps = Math.floor(this.acc + 1e-9);
    if (steps <= 0) return;
    this.acc -= steps;

    const maxTicks = Math.ceil(MAX_CATCHUP_SECONDS * this.tickRate);
    if (steps > maxTicks) {
      steps = maxTicks;
      this.acc = 0;
    }

    for (let i = 0; i < steps; i++) {
      this._tick += 1;

      if (this.durationTicks != null && this._tick >= this.durationTicks) {
        this._tick = this.durationTicks;
        this._playing = false;
        this.acc = 0;
        this.onTick?.(this._tick);
        return;
      }

      this.onTick?.(this._tick);
    }
  }

  seek(timeSeconds: Seconds): void {
    this.seekTick(secondsToTicks(timeSeconds, this.tickRate));
  }

  /** 直接 seek 到整數 tick（內部/測試用）。 */
  seekTick(tick: Tick): void {
    let target = Math.round(tick);
    if (target < 0) target = 0;
    if (this.durationTicks != null && target > this.durationTicks) {
      target = this.durationTicks;
    }
    this._tick = target;
    this.acc = 0;
    this.onSeek?.(this._tick);
  }
}
