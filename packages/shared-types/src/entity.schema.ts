/**
 * Entity / Component 契約（宣告式定義，非執行期狀態）。
 *
 * 注意區分：
 *   - 這裡是「entity 的靜態定義」（要有哪些 component、初始參數）。
 *   - 執行期的可變狀態在 worldstate.schema.ts 的 WorldState / EntityState。
 */

import type { EntityId, JsonValue } from './common';

/**
 * 甲（宣告式場景合成器）支援的 component 類型。
 * 注意：Collider 在甲「只做觸發體積」（進入/離開區域），不做剛體動力學。
 * Camera / Text 為 render 端第一公民（cinematic 運鏡與字幕）；型別契約見 @frameforge/scene-schema。
 */
export type ComponentType =
  | 'Transform'
  | 'Sprite'
  | 'Mesh'
  | 'Animator'
  | 'Collider'
  | 'Script'
  | 'AudioSource'
  | 'Camera'
  | 'Text';

export interface ComponentDef {
  type: ComponentType;
  /** component 的初始參數（可序列化）。 */
  data: Record<string, JsonValue>;
}

export interface Entity {
  id: EntityId;
  name: string;
  components: ComponentDef[];
}
