/**
 * Asset 契約。
 *
 * 決定性要求：replay / export 開始前必須 preload 全部 asset，
 * seek 到任意 t 的結果不可取決於資源載入快慢。
 */

import type { AssetId } from './common';

export type AssetType =
  | 'png'
  | 'jpg'
  | 'svg'
  | 'lottie'
  | 'gltf'
  | 'glb'
  | 'mp3'
  | 'wav'
  | 'json';

export interface Asset {
  id: AssetId;
  type: AssetType;
  url: string;
}
