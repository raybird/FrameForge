import type { SceneTimeline } from '@frameforge/shared-types';

export const HERO_ID = 'hero';
export const SEED = 12345;
export const TICK_RATE = 60;
export const DURATION = 600; // 10 秒

/** Studio 預設場景：hero 互動（鍵盤驅動）、spinner authored 自轉、ground 靜態。 */
export function buildTimeline(): SceneTimeline {
  return {
    id: 'studio_demo',
    name: 'Studio Demo',
    tickRate: TICK_RATE,
    durationTicks: DURATION,
    assets: [],
    entities: [
      {
        id: 'ground',
        name: 'Ground',
        components: [
          {
            type: 'Transform',
            data: {
              position: { x: 0, y: -1.2, z: 0 },
              scale: { x: 16, y: 0.3, z: 16 },
              color: 0x2e7d32,
            },
          },
        ],
      },
      {
        id: 'spinner',
        name: 'Spinner',
        components: [
          { type: 'Transform', data: { position: { x: -4, y: 0.5, z: -2 }, color: 0x3a86ff } },
        ],
      },
      {
        id: HERO_ID,
        name: 'Hero',
        components: [{ type: 'Sprite', data: { color: 0xffd400 } }],
      },
    ],
    tracks: [
      {
        id: 'tk_spinner_rot',
        entityId: 'spinner',
        kind: 'authored',
        target: 'transform.rotation',
        keyframes: [
          { tick: 0, value: { x: 0, y: 0, z: 0 } },
          { tick: DURATION, value: { x: 0, y: Math.PI * 8, z: 0 } },
        ],
      },
      {
        id: 'seg_hero',
        entityId: HERO_ID,
        kind: 'interactive',
        target: 'transform.position',
        startTick: 0,
        endTick: null,
        controller: 'kinematic',
        params: { position: { x: 0, y: 0.5, z: 0 }, speed: 0.1 },
      },
    ],
    events: [],
  };
}
