/** 測試共用：示範時間軸。player 在 0→60 tick 從 (0,0,0) 移到 (4,0,0)、opacity 1→0；camera 同步平移。 */

import type { SceneTimeline } from '@frameforge/shared-types';

export function makeTimeline(): SceneTimeline {
  return {
    id: 'demo',
    name: 'Demo',
    tickRate: 60,
    durationTicks: 120,
    assets: [],
    entities: [
      { id: 'player', name: 'Player', components: [] },
      { id: 'camera', name: 'Camera', components: [] },
    ],
    tracks: [
      {
        id: 'tk_pos',
        entityId: 'player',
        kind: 'authored',
        target: 'transform.position',
        keyframes: [
          { tick: 0, value: { x: 0, y: 0, z: 0 } },
          { tick: 60, value: { x: 4, y: 0, z: 0 } },
        ],
      },
      {
        id: 'tk_op',
        entityId: 'player',
        kind: 'authored',
        target: 'opacity',
        keyframes: [
          { tick: 0, value: 1 },
          { tick: 60, value: 0 },
        ],
      },
      {
        id: 'tk_cam',
        entityId: 'camera',
        kind: 'authored',
        target: 'transform.position',
        keyframes: [
          { tick: 0, value: { x: 0, y: 6, z: 14 } },
          { tick: 60, value: { x: 4, y: 6, z: 14 } },
        ],
      },
    ],
    events: [],
  };
}
