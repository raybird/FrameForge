import { describe, expect, it } from 'vitest';
import type { ReplayLog, SceneTimeline, Vec3, WorldState } from '@frameforge/shared-types';
import { evaluate } from '../timeline/evaluator';
import { ControllerRegistry } from './controller';
import { KinematicController } from './kinematic-controller';
import { ReplayRecorder } from './replay-log';
import { ReplaySession } from './replay-session';

const SEED = 12345;

function registry(): ControllerRegistry {
  return new ControllerRegistry().register(KinematicController);
}

/** hero：互動 kinematic；deco：authored 線性位移（驗合成）。 */
function makeTimeline(): SceneTimeline {
  return {
    id: 'scene',
    name: 'Scene',
    tickRate: 60,
    durationTicks: 120,
    assets: [],
    entities: [
      { id: 'hero', name: 'Hero', components: [] },
      { id: 'deco', name: 'Deco', components: [] },
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
        id: 'tk_deco',
        entityId: 'deco',
        kind: 'authored',
        target: 'transform.position',
        keyframes: [
          { tick: 0, value: { x: 0, y: 0, z: 0 } },
          { tick: 120, value: { x: 12, y: 0, z: 0 } },
        ],
      },
    ],
    events: [],
  };
}

function makeLog(): ReplayLog {
  const r = new ReplayRecorder('scene', 60, SEED);
  r.record(10, 'move', { entityId: 'hero', dx: 1 });
  r.record(30, 'stop', { entityId: 'hero' });
  r.record(55, 'impulse', { entityId: 'hero', scale: 2 });
  r.record(80, 'move', { entityId: 'hero', dy: -1 });
  return r.build();
}

function session(snapshotInterval = 20): ReplaySession {
  return new ReplaySession(makeTimeline(), { registry: registry(), log: makeLog(), snapshotInterval });
}

function heroPos(ws: WorldState): Vec3 {
  return ws.entities.find((e) => e.id === 'hero')!.transform.position;
}

describe('ReplaySession — 合成 authored ⊕ interactive', () => {
  it('authored 的 deco 與 interactive 的 hero 同時存在', () => {
    const ws = session().seek(60);
    expect(ws.entities.find((e) => e.id === 'deco')!.transform.position.x).toBeCloseTo(6); // 0→12 中點
    expect(heroPos(ws)).toBeDefined();
  });

  it('kinematic 行為：move 後等速、stop 後停住', () => {
    const s = session();
    expect(heroPos(s.seek(9)).x).toBeCloseTo(0); // 尚未 move
    expect(heroPos(s.seek(29)).x).toBeCloseTo(20); // move@10 起每 tick +1
    expect(heroPos(s.seek(50)).x).toBeCloseTo(20); // stop@30 後停住
  });

  it('impulse 經 RNG 影響垂直方向（rng 路徑有執行）', () => {
    expect(heroPos(session().seek(60)).y).toBeGreaterThan(0);
  });
});

describe('ReplaySession — 命脈②：決定性 / 零漂移', () => {
  const SHUFFLED = [60, 0, 119, 7, 95, 31, 12, 88, 55, 41, 100, 1, 76, 20];

  it('全新 session 亂序 seek == 正向逐 tick 結果', () => {
    const forwardSession = session();
    const forward: WorldState[] = [];
    for (let t = 0; t <= 120; t++) forward.push(forwardSession.seek(t));

    const fresh = session();
    for (const t of SHUFFLED) {
      expect(fresh.seek(t)).toEqual(forward[t]);
    }
  });

  it('同一 session 反向 seek == 正向結果（snapshot 記憶化不汙染）', () => {
    const s = session();
    const forward: WorldState[] = [];
    for (let t = 0; t <= 120; t++) forward.push(s.seek(t));

    // 已前進到 120，現在亂序往回跳
    for (const t of SHUFFLED) {
      expect(s.seek(t)).toEqual(forward[t]);
    }
  });

  it('snapshot 還原能重現 impulse 之後的 RNG 狀態', () => {
    // impulse 在 tick 55；snapshot 在 60 會保存 impulse 後的 rng 狀態。
    const advanced = session(20);
    advanced.seek(120); // 建立 snapshots 至 120
    expect(advanced.snapshotTicks()).toContain(60);

    // seek(70) 會從 60 的 snapshot 還原（含已前進的 rng）
    const fresh = session(20);
    expect(advanced.seek(70)).toEqual(fresh.seek(70));
  });

  it('seek 結果可 JSON 序列化（snapshot/replay 可持久化）', () => {
    const ws = session().seek(60);
    expect(JSON.parse(JSON.stringify(ws))).toEqual(ws);
  });

  it('每 interval 記錄一個 snapshot', () => {
    const s = session(20);
    s.seek(120);
    expect(s.snapshotTicks()).toEqual([0, 20, 40, 60, 80, 100, 120]);
  });

  it('seek 負值夾到 0', () => {
    const s = session();
    expect(s.seek(-10)).toEqual(s.seek(0));
  });
});

describe('ReplaySession — 純 authored 場景', () => {
  it('無 interactive segment 時 seek == evaluate', () => {
    const tl = makeTimeline();
    tl.tracks = tl.tracks.filter((t) => t.kind === 'authored'); // 移除互動
    const s = new ReplaySession(tl, { registry: registry(), seed: SEED });
    expect(s.seek(30)).toEqual(evaluate(tl, 30, { seed: SEED }));
  });
});
