import { describe, expect, it, vi } from 'vitest';
import { sequenceFrames } from './frame-sequencer';
import { runExport, type FrameEncoder } from './video-exporter';

/** 假編碼器：記錄每幀呼叫，finish 回傳固定位元組。 */
class FakeEncoder implements FrameEncoder {
  readonly calls: Array<{ source: unknown; ts: number; keyFrame: boolean }> = [];
  finished = false;
  addFrame(source: unknown, timestampMicros: number, keyFrame: boolean): void {
    this.calls.push({ source, ts: timestampMicros, keyFrame });
  }
  async finish(): Promise<Uint8Array> {
    this.finished = true;
    return new Uint8Array([1, 2, 3]);
  }
}

describe('runExport', () => {
  it('逐幀渲染後擷取並編碼，順序正確', async () => {
    const frames = sequenceFrames({ endTick: 60, tickRate: 60, fps: 60 });
    const encoder = new FakeEncoder();
    const renderedTicks: number[] = [];

    const bytes = await runExport({
      frames,
      renderAt: (t) => renderedTicks.push(t),
      capture: () => 'CANVAS',
      encoder,
      keyFrameInterval: 60,
    });

    expect(renderedTicks).toEqual(frames.map((f) => f.tick));
    expect(encoder.calls).toHaveLength(60);
    expect(encoder.calls[0]).toEqual({ source: 'CANVAS', ts: 0, keyFrame: true });
    expect(encoder.calls[1].keyFrame).toBe(false); // 非關鍵幀
    expect(encoder.finished).toBe(true);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('擷取發生在渲染之後（順序：先 renderAt 再 capture）', async () => {
    const order: string[] = [];
    const frames = sequenceFrames({ endTick: 2, tickRate: 60, fps: 60 });
    await runExport({
      frames,
      renderAt: () => order.push('render'),
      capture: () => {
        order.push('capture');
        return null;
      },
      encoder: new FakeEncoder(),
    });
    expect(order).toEqual(['render', 'capture', 'render', 'capture']);
  });

  it('回報進度', async () => {
    const frames = sequenceFrames({ endTick: 5, tickRate: 60, fps: 60 });
    const onProgress = vi.fn();
    await runExport({
      frames,
      renderAt: () => {},
      capture: () => null,
      encoder: new FakeEncoder(),
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
  });

  it('keyFrameInterval 控制關鍵幀分布', async () => {
    const frames = sequenceFrames({ endTick: 10, tickRate: 60, fps: 60 });
    const encoder = new FakeEncoder();
    await runExport({ frames, renderAt: () => {}, capture: () => null, encoder, keyFrameInterval: 3 });
    const keyIdx = encoder.calls.map((c, i) => (c.keyFrame ? i : -1)).filter((i) => i >= 0);
    expect(keyIdx).toEqual([0, 3, 6, 9]);
  });
});
