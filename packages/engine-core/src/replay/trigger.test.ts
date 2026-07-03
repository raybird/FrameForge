import { describe, expect, it } from 'vitest';
import type { EntityState, ReplayLog, SceneTimeline, WorldState } from '@frameforge/shared-types';
import { ControllerRegistry } from './controller';
import { KinematicController } from './kinematic-controller';
import { TriggerController } from './trigger-controller';
import { ReplaySession } from './replay-session';

const SEED = 1;

function registry(): ControllerRegistry {
  return new ControllerRegistry().register(KinematicController).register(TriggerController);
}

/** hero 往右走；x∈[14,16] 是觸發區；door 預設隱藏，進入時揭露。 */
function makeTimeline(): SceneTimeline {
  return {
    id: 'trig',
    name: 'Trig',
    tickRate: 60,
    durationTicks: 120,
    assets: [],
    entities: [
      { id: 'hero', name: 'Hero', components: [] },
      { id: 'door', name: 'Door', components: [] },
    ],
    tracks: [
      {
        id: 'seg_hero',
        entityId: 'hero',
        kind: 'interactive',
        target: 'transform.position',
        startTick: 0,
        endTick: null,
        controller: 'kinematic',
        params: { position: { x: 0, y: 0, z: 0 }, speed: 1 },
      },
      {
        id: 'seg_trigger',
        entityId: 'zone',
        kind: 'interactive',
        target: 'visible',
        startTick: 0,
        endTick: null,
        controller: 'trigger',
        params: {
          target: 'hero',
          center: { x: 15, y: 0, z: 0 },
          size: { x: 2, y: 100, z: 100 },
          reveal: 'door',
          latch: true,
        },
      },
      {
        id: 'tk_door_vis',
        entityId: 'door',
        kind: 'authored',
        target: 'visible',
        keyframes: [{ tick: 0, value: false, easing: 'step' }],
      },
    ],
    events: [],
  };
}

// move@10：hero x 在 tick>=10 為 (tick-9)；x=14 在 tick23、x=16 在 tick25。
function makeLog(): ReplayLog {
  return { sceneId: 'trig', tickRate: 60, seed: SEED, events: [{ tick: 10, type: 'move', payload: { entityId: 'hero', dx: 1 } }] };
}

function session(interval = 20): ReplaySession {
  return new ReplaySession(makeTimeline(), { registry: registry(), log: makeLog(), snapshotInterval: interval });
}

function door(ws: WorldState): EntityState {
  return ws.entities.find((e) => e.id === 'door')!;
}

describe('TriggerController', () => {
  it('進入區域前 door 隱藏（authored 預設 false）', () => {
    expect(door(session().seek(20)).visible).toBe(false);
  });

  it('同 tick 感知（無延遲）：tick22 外、tick23 內即揭露', () => {
    const s = session();
    expect(door(s.seek(22)).visible).toBe(false); // hero x=13，未進
    expect(door(s.seek(23)).visible).toBe(true); // hero x=14，進入當 tick 即揭露
  });

  it('latch：離開區域後仍保持揭露', () => {
    const s = session();
    s.seek(24); // 觸發
    expect(door(s.seek(60)).visible).toBe(true); // hero 早已走出 x=51，仍鎖定
  });

  it('vars 記錄觸發狀態', () => {
    expect(session().seek(30).vars['trigger:seg_trigger']).toBe(true);
    expect(session().seek(5).vars['trigger:seg_trigger']).toBe(false);
  });

  it('決定性：正向掃描後亂序 seek 與全新求值一致', () => {
    const forwardS = session();
    const forward: WorldState[] = [];
    for (let t = 0; t <= 120; t++) forward.push(forwardS.seek(t));
    const fresh = session();
    for (const t of [23, 0, 60, 22, 100, 24, 11]) {
      expect(fresh.seek(t)).toEqual(forward[t]);
    }
  });

  it('跨 snapshot 還原正確（觸發發生在 snapshot 邊界之間）', () => {
    const advanced = session(20);
    advanced.seek(120); // 建 snapshots；觸發在 tick23（介於 20 與 40）
    const fresh = session(20);
    expect(advanced.seek(35)).toEqual(fresh.seek(35));
  });
});
