/**
 * KinematicController：以 input 事件驅動的等速運動（無物理力學，純 kinematic）。
 *
 * 事件：
 *   - 'move'    payload { dx?, dy?, dz? }   設定速度方向 × speed
 *   - 'stop'                                 速度歸零
 *   - 'impulse' payload { scale? }           以 RNG 加一個隨機垂直衝量（驗證 rng 進 snapshot）
 *
 * 每 tick：先處理事件，再以速度積分位置（dt = 1 tick）。
 */

import type { InteractiveSegment, JsonValue, Vec3 } from '@frameforge/shared-types';
import type { Controller, ControllerState, StepContext } from './controller';

interface KinState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

function n(v: JsonValue | undefined, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function readVec3(v: JsonValue | undefined): Vec3 {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return { x: n(v.x), y: n(v.y), z: n(v.z) };
  }
  return { x: 0, y: 0, z: 0 };
}

function asKin(s: ControllerState): KinState {
  return { x: n(s.x), y: n(s.y), z: n(s.z), vx: n(s.vx), vy: n(s.vy), vz: n(s.vz) };
}

export const KinematicController: Controller = {
  id: 'kinematic',

  init(segment) {
    const pos = readVec3(segment.params.position);
    return { x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0 };
  },

  step(ctx: StepContext) {
    const s = asKin(ctx.state);
    const speed = n(ctx.segment.params.speed, 1);

    for (const e of ctx.events) {
      const p = (typeof e.payload === 'object' && e.payload !== null && !Array.isArray(e.payload)
        ? e.payload
        : {}) as Record<string, JsonValue>;
      switch (e.type) {
        case 'move':
          s.vx = n(p.dx) * speed;
          s.vy = n(p.dy) * speed;
          s.vz = n(p.dz) * speed;
          break;
        case 'stop':
          s.vx = 0;
          s.vy = 0;
          s.vz = 0;
          break;
        case 'impulse':
          // 消耗 RNG → 必須隨 snapshot 保存/還原才能重現
          s.vy += ctx.rng.next() * n(p.scale, 1);
          break;
        default:
          break;
      }
    }

    s.x += s.vx;
    s.y += s.vy;
    s.z += s.vz;

    return { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz };
  },

  readPosition(state) {
    const s = asKin(state);
    return { x: s.x, y: s.y, z: s.z };
  },

  project(state, segment, world) {
    const s = asKin(state);
    const es = world.entities.find((e) => e.id === segment.entityId);
    if (es) es.transform.position = { x: s.x, y: s.y, z: s.z };
  },
};
