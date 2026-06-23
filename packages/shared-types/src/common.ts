/**
 * 共用基礎型別。
 *
 * 這個套件只放「型別契約」，零 runtime 依賴，與工具鏈無關。
 */

// ─────────────────────────────────────────────────────────────
// ID（MVP 先用 string alias；之後要強型別可改 branded type）
// ─────────────────────────────────────────────────────────────

export type EntityId = string;
export type TrackId = string;
export type AssetId = string;
export type SceneId = string;

// ─────────────────────────────────────────────────────────────
// JSON 值：snapshot / replay / scene 一律可序列化，禁止塞不可序列化物件
// （例如 Three.js Object3D 永遠不會進入這裡——那是衍生視圖）
// ─────────────────────────────────────────────────────────────

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

// ─────────────────────────────────────────────────────────────
// 數學
// ─────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2.5D 變換。直接對應 Three.js Object3D 的 position / rotation(euler 弧度) / scale。
 * 2.5D 場景通常只變動部分軸（例：z 用於深度/視差，rotation 多半只用 z）。
 */
export interface Transform {
  position: Vec3;
  /** euler 弧度。2.5D 通常只用 z。 */
  rotation: Vec3;
  scale: Vec3;
}
