/**
 * Controller 契約：薄 SimCore 的「互動行為」單元。
 *
 * 每個 InteractiveSegment 指定一個 controller（by id）。controller 是決定性的：
 *   step(prevState, eventsAtTick, rng, tick) → nextState
 * 並能把自身狀態投影到 WorldState（project）。
 *
 * 所有 state 都是可序列化的 JsonValue（要能進 Snapshot）。
 */

import type {
  InteractiveSegment,
  JsonValue,
  ReplayEvent,
  Tick,
  Vec3,
  WorldState,
} from '@frameforge/shared-types';
import type { Mulberry32 } from '../rng/mulberry32';

/** 單一 segment 的 controller 狀態（可序列化）。 */
export type ControllerState = Record<string, JsonValue>;

/** controller 執行階段：motion 先跑（產生位置），sensor 後跑（可讀本 tick 的位置）。 */
export type ControllerPhase = 'motion' | 'sensor';

export interface StepContext {
  segment: InteractiveSegment;
  /** 此 segment 目前狀態。 */
  state: ControllerState;
  /** 此 tick、且以本 segment 的 entity 為目標的事件（依 log 順序）。 */
  events: ReplayEvent[];
  /** 共用 RNG（本 tick 內所有 segment 依 id 順序共用同一條序列）。 */
  rng: Mulberry32;
  tick: Tick;
  /** 讀「本 tick 已由 motion 控制器算出的實體位置」（sensor 用，如觸發偵測）。 */
  readPos(entityId: string): Vec3 | null;
}

export interface Controller {
  readonly id: string;
  /** 執行階段。預設 'motion'。sensor 控制器（如觸發）在同 tick 的 motion 之後跑。 */
  readonly phase?: ControllerPhase;
  /** 建立初始狀態（讀 segment.params）。 */
  init(segment: InteractiveSegment): ControllerState;
  /** 決定性推進一個 tick。 */
  step(ctx: StepContext): ControllerState;
  /** 選配：回報本 controller 掌管實體的位置，供同 tick 的 sensor 讀取。 */
  readPosition?(state: ControllerState): Vec3 | null;
  /** 把狀態投影到 WorldState（在 authored 求值之後執行，可覆蓋）。 */
  project(state: ControllerState, segment: InteractiveSegment, world: WorldState): void;
}

export class ControllerRegistry {
  private readonly map = new Map<string, Controller>();

  register(controller: Controller): this {
    this.map.set(controller.id, controller);
    return this;
  }

  get(id: string): Controller | undefined {
    return this.map.get(id);
  }
}
