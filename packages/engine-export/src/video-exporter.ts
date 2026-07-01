/**
 * 匯出協調器：逐幀「推進 → 渲染 → 擷取 → 編碼」。
 *
 * 與渲染器、編碼器都解耦（靠注入的 callback / FrameEncoder），因此可在 Node 用假編碼器測試。
 * 擷取在 renderAt 之後同步進行（addFrame 內同步建立 VideoFrame），確保抓到剛渲染的畫面。
 */

import type { Tick } from '@frameforge/shared-types';
import type { ExportFrame } from './frame-sequencer';

export interface FrameEncoder {
  /** 編碼一幀。source 為擷取來源（瀏覽器中是 canvas）。 */
  addFrame(source: unknown, timestampMicros: number, keyFrame: boolean): void | Promise<void>;
  /** 收尾並回傳容器位元組（MP4）。 */
  finish(): Promise<Uint8Array>;
}

export interface RunExportOptions {
  frames: ExportFrame[];
  /** 把引擎推進並渲染到指定 tick。 */
  renderAt: (tick: Tick) => void;
  /** 取得擷取來源（剛渲染好的畫面）。 */
  capture: () => unknown;
  encoder: FrameEncoder;
  /** 每幾幀一個關鍵幀。預設 60。 */
  keyFrameInterval?: number;
  onProgress?: (done: number, total: number) => void;
  /** 每幾幀讓出事件迴圈（讓 UI 更新／避免凍結）。0 或省略則不讓出。 */
  yieldEvery?: number;
}

export async function runExport(opts: RunExportOptions): Promise<Uint8Array> {
  const keyInterval = opts.keyFrameInterval ?? 60;
  const total = opts.frames.length;

  for (let i = 0; i < total; i++) {
    const frame = opts.frames[i];
    opts.renderAt(frame.tick);
    await opts.encoder.addFrame(opts.capture(), frame.timestampMicros, i % keyInterval === 0);
    opts.onProgress?.(i + 1, total);
    if (opts.yieldEvery && (i + 1) % opts.yieldEvery === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return opts.encoder.finish();
}
