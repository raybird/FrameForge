/**
 * 高階匯出：把「逐幀渲染 → MP4」串起來。與渲染器解耦——呼叫端提供 renderAt 與 capture。
 */

import type { Tick } from '@frameforge/shared-types';
import { sequenceFrames } from './frame-sequencer';
import { runExport } from './video-exporter';
import { WebCodecsEncoder } from './webcodecs-encoder';
import { isWebCodecsSupported } from './capabilities';

export interface ExportToMp4Options {
  /** 推進並渲染到指定 tick（通常是 player.renderAt）。 */
  renderAt: (tick: Tick) => void;
  /** 取得擷取來源（通常是 stage 的 canvas）。 */
  capture: () => CanvasImageSource;
  width: number;
  height: number;
  endTick: Tick;
  tickRate: number;
  startTick?: Tick;
  /** 匯出影格率。預設等於 tickRate。 */
  fps?: number;
  bitrate?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function exportToMp4(opts: ExportToMp4Options): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error(
      '此瀏覽器不支援 WebCodecs；MP4 匯出需要 WebCodecs（ffmpeg.wasm fallback 尚未實作）。',
    );
  }

  const fps = opts.fps ?? opts.tickRate;
  const frames = sequenceFrames({
    startTick: opts.startTick,
    endTick: opts.endTick,
    tickRate: opts.tickRate,
    fps,
  });

  const encoder = new WebCodecsEncoder({
    width: opts.width,
    height: opts.height,
    fps,
    bitrate: opts.bitrate,
  });

  const bytes = await runExport({
    frames,
    renderAt: opts.renderAt,
    capture: opts.capture,
    encoder,
    keyFrameInterval: fps,
    onProgress: opts.onProgress,
    yieldEvery: 4,
  });

  // cast：新版 TS lib 的 Uint8Array<ArrayBufferLike> 與 BlobPart 的 <ArrayBuffer> 泛型不相容。
  return new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' });
}
