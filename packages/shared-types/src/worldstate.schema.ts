/**
 * WorldState / Snapshot 契約——整個 replay / seek / export 的命脈。
 *
 * 鐵則：
 *   - WorldState 是「唯一真相」，完全可序列化（JsonValue 等級）。
 *   - Three.js 的 Object3D / Mesh / Material 等【永遠不會】進入這裡，
 *     它們是由 WorldState 投影出來的「衍生視圖」，隨時可重建。
 *   - 對純 AuthoredTrack 的場景，WorldState 是 tick 的純函數，可不存 snapshot 直接重算；
 *     只有含 InteractiveSegment 時才需要 snapshot。
 */

import type { EntityId, JsonValue, Transform } from './common';
import type { ComponentType } from './entity.schema';
import type { Tick } from './time';

/**
 * 可 seed 之 PRNG 的狀態。MVP 用 mulberry32（單一 32-bit 狀態）。
 * 演算法實作放在 engine-core；這裡只定義契約。seed/state 必須隨 snapshot 一起存。
 */
export type RngState = number;

/** 單一 component 的執行期可變狀態（可序列化）。 */
export interface ComponentState {
  type: ComponentType;
  data: Record<string, JsonValue>;
}

/** 單一 entity 在某 tick 的完整可序列化狀態。 */
export interface EntityState {
  id: EntityId;
  transform: Transform;
  visible: boolean;
  opacity: number;
  /** 以 component type 為 key 的各 component 狀態。 */
  components: Record<string, ComponentState>;
}

/**
 * 某個 tick 的完整世界狀態。
 * entities 必須以 id 穩定排序後再 tick / 序列化，避免迭代順序破壞決定性。
 */
export interface WorldState {
  tick: Tick;
  rng: RngState;
  entities: EntityState[];
  /** 互動片段的自訂狀態（狀態機 enum、計數器…）。 */
  vars: Record<string, JsonValue>;
}

/**
 * Snapshot：在某些 tick 保存的完整 WorldState，讓 seek 不必每次從 0 重算。
 *
 * 策略：每 N tick（例：每 60 或每 300）存一次。
 * seek(t) 時：找 <= t 的最近 snapshot → 套用其後的 replay events → 模擬到 t。
 * 純 AuthoredTrack 場景可完全不需要 snapshot（直接評估 t）。
 */
export interface Snapshot {
  tick: Tick;
  world: WorldState;
}
