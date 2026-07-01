/**
 * WebCodecs + mp4-muxer 編碼器（瀏覽器）。
 *
 * WebCodecs 的 VideoEncoder / VideoFrame 在部分 TS lib 設定下沒有全域型別，
 * 故此處用 module 範圍的最小 ambient 宣告，讓本套件不依賴 @types/dom-webcodecs，
 * 也能被各下游（studio 的 types:[] 設定）順利編譯。
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { FrameEncoder } from './video-exporter';

interface VideoFrameInit {
  timestamp: number;
  duration?: number;
}
interface VideoFrameLike {
  close(): void;
}
interface VideoFrameCtor {
  new (source: CanvasImageSource, init: VideoFrameInit): VideoFrameLike;
}
interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
}
interface VideoEncoderInit {
  output: (chunk: unknown, meta: unknown) => void;
  error: (err: unknown) => void;
}
interface VideoEncoderLike {
  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrameLike, options?: { keyFrame?: boolean }): void;
  flush(): Promise<void>;
  close(): void;
  readonly encodeQueueSize: number;
}
interface VideoEncoderCtor {
  new (init: VideoEncoderInit): VideoEncoderLike;
}

declare const VideoEncoder: VideoEncoderCtor;
declare const VideoFrame: VideoFrameCtor;

export interface WebCodecsEncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
}

export class WebCodecsEncoder implements FrameEncoder {
  private readonly target = new ArrayBufferTarget();
  private readonly muxer: Muxer<ArrayBufferTarget>;
  private readonly encoder: VideoEncoderLike;

  constructor(opts: WebCodecsEncoderOptions) {
    this.muxer = new Muxer({
      target: this.target,
      video: { codec: 'avc', width: opts.width, height: opts.height },
      fastStart: 'in-memory',
    });

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk as never, meta as never),
      error: (err) => {
        throw err;
      },
    });
    this.encoder.configure({
      codec: 'avc1.42001f', // H.264 baseline 3.1
      width: opts.width,
      height: opts.height,
      bitrate: opts.bitrate ?? 4_000_000,
      framerate: opts.fps,
    });
  }

  addFrame(source: unknown, timestampMicros: number, keyFrame: boolean): void {
    const frame = new VideoFrame(source as CanvasImageSource, { timestamp: timestampMicros });
    this.encoder.encode(frame, { keyFrame });
    frame.close();
  }

  async finish(): Promise<Uint8Array> {
    await this.encoder.flush();
    this.muxer.finalize();
    this.encoder.close();
    return new Uint8Array(this.target.buffer);
  }
}
