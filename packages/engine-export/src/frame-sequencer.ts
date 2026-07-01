/**
 * 逐幀序列器：把「時間軸 tick 區間 + 匯出 fps」展開成要渲染的幀清單。純函數，可測。
 *
 * 匯出 fps 可與 tickRate 不同（例：tickRate 60、匯出 30fps → 每隔一個 tick 取一幀）。
 * 每幀帶 WebCodecs 需要的微秒時間戳。
 */

import type { Tick } from '@frameforge/shared-types';

export interface ExportFrame {
  index: number;
  tick: Tick;
  timestampMicros: number;
}

export interface SequenceOptions {
  startTick?: Tick;
  endTick: Tick;
  tickRate: number;
  fps: number;
}

export function sequenceFrames(opts: SequenceOptions): ExportFrame[] {
  const start = opts.startTick ?? 0;
  const durationTicks = Math.max(0, opts.endTick - start);
  const durationSec = durationTicks / opts.tickRate;
  const frameCount = Math.max(1, Math.round(durationSec * opts.fps));

  const frames: ExportFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const tSec = i / opts.fps;
    const tick = Math.min(opts.endTick, start + Math.round(tSec * opts.tickRate));
    frames.push({ index: i, tick, timestampMicros: Math.round((i * 1_000_000) / opts.fps) });
  }
  return frames;
}
