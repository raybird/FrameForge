/**
 * SceneTimeline 契約——最頂層的宣告式場景定義。
 *
 * 這是「可由 AI 生成」的格式（路線甲的核心賣點之一）：
 * 結構化、宣告式、tracks/keyframes/events，正是 LLM 能直接吐出的東西。
 */

import type { SceneId } from './common';
import type { Asset } from './asset.schema';
import type { Entity } from './entity.schema';
import type { Track } from './track.schema';
import type { ReplayEvent } from './replay.schema';
import type { Tick, TickRate } from './time';

export interface SceneTimeline {
  id: SceneId;
  name: string;

  /** 每秒幾個 tick。預設 60。整段時間軸固定此值。 */
  tickRate: TickRate;
  /** 總長度（以 tick 計）。 */
  durationTicks: Tick;

  entities: Entity[];
  assets: Asset[];
  tracks: Track[];

  /** 作者預先排在時間軸上的 cue points（scene.switch / sfx.play …）。 */
  events: ReplayEvent[];
}
