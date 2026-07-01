/**
 * @frameforge/engine-export
 *
 * 逐幀擷取與 MP4 匯出（WebCodecs + mp4-muxer），與渲染器解耦。
 * 詳見 docs/ARCHITECTURE.md §7。
 */

export { sequenceFrames } from './frame-sequencer';
export type { ExportFrame, SequenceOptions } from './frame-sequencer';

export { runExport } from './video-exporter';
export type { FrameEncoder, RunExportOptions } from './video-exporter';

export { WebCodecsEncoder } from './webcodecs-encoder';
export type { WebCodecsEncoderOptions } from './webcodecs-encoder';

export { isWebCodecsSupported } from './capabilities';

export { exportToMp4 } from './export-to-mp4';
export type { ExportToMp4Options } from './export-to-mp4';
