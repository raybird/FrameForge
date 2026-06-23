import { describe, expect, it } from 'vitest';
import type { EntityState, SceneTimeline } from '@frameforge/shared-types';
import { evaluate } from './evaluator';

/** 找出某 entity 的狀態。 */
function ent(ws: { entities: EntityState[] }, id: string): EntityState {
  const e = ws.entities.find((x) => x.id === id);
  if (!e) throw new Error(`entity ${id} not found`);
  return e;
}

/** 基本場景：player 從 (0,0,0) 在 0→60 tick 線性移動到 (60,0,0)。 */
function makeTimeline(): SceneTimeline {
  return {
    id: 'scene_test',
    name: 'Test',
    tickRate: 60,
    durationTicks: 120,
    assets: [],
    entities: [
      { id: 'player', name: 'Player', components: [] },
      { id: 'box', name: 'Box', components: [] },
    ],
    tracks: [
      {
        id: 'tk_player_pos',
        entityId: 'player',
        kind: 'authored',
        target: 'transform.position',
        keyframes: [
          { tick: 0, value: { x: 0, y: 0, z: 0 } },
          { tick: 60, value: { x: 60, y: 0, z: 0 } },
        ],
      },
    ],
    events: [],
  };
}

describe('evaluate — 基本插值', () => {
  it('線性插值：中點 tick 30 → x=30', () => {
    const ws = evaluate(makeTimeline(), 30);
    expect(ent(ws, 'player').transform.position.x).toBeCloseTo(30);
  });

  it('邊界夾住：tick 0 之前回第一個值、之後回最後一個值', () => {
    const tl = makeTimeline();
    expect(ent(evaluate(tl, -10), 'player').transform.position.x).toBe(0);
    expect(ent(evaluate(tl, 999), 'player').transform.position.x).toBe(60);
  });

  it('剛好命中 keyframe 回精確值', () => {
    const tl = makeTimeline();
    expect(ent(evaluate(tl, 0), 'player').transform.position.x).toBe(0);
    expect(ent(evaluate(tl, 60), 'player').transform.position.x).toBe(60);
  });

  it('未被 track 驅動的 entity 使用預設 transform', () => {
    const box = ent(evaluate(makeTimeline(), 30), 'box');
    expect(box.transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(box.transform.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(box.visible).toBe(true);
    expect(box.opacity).toBe(1);
  });

  it('entities 以 id 穩定排序（決定性迭代順序）', () => {
    const ws = evaluate(makeTimeline(), 0);
    expect(ws.entities.map((e) => e.id)).toEqual(['box', 'player']);
  });
});

describe('evaluate — MVP 命脈①：零漂移 / 純函數 f(tick)', () => {
  it('同一 tick 重複求值結果完全相同', () => {
    const tl = makeTimeline();
    expect(evaluate(tl, 37)).toEqual(evaluate(tl, 37));
  });

  it('求值與呼叫歷史無關：先正向掃描全部 tick，再 seek 回任意 tick 仍等於直接求值', () => {
    const tl = makeTimeline();

    // 模擬使用者：先從 0 掃到 120
    for (let t = 0; t <= 120; t++) evaluate(tl, t);

    // 再亂序 seek 回去，每次都必須等於「全新直接求值」
    for (const t of [60, 0, 13, 120, 1, 59, 30, 7]) {
      const fresh = evaluate(makeTimeline(), t);
      expect(evaluate(tl, t)).toEqual(fresh);
    }
  });

  it('正向逐 tick 的軌跡與隨機抽樣一致（無累積誤差）', () => {
    const tl = makeTimeline();
    const forward: number[] = [];
    for (let t = 0; t <= 60; t++) forward.push(ent(evaluate(tl, t), 'player').transform.position.x);

    // 直接抽樣特定 tick 必須命中正向掃描的同一值
    for (const t of [0, 15, 30, 45, 60]) {
      expect(ent(evaluate(tl, t), 'player').transform.position.x).toBe(forward[t]);
    }
    expect(forward[30]).toBeCloseTo(30);
  });
});

describe('evaluate — 各種 target', () => {
  it('opacity 與 visible track', () => {
    const tl = makeTimeline();
    tl.tracks.push(
      {
        id: 'tk_op',
        entityId: 'box',
        kind: 'authored',
        target: 'opacity',
        keyframes: [
          { tick: 0, value: 0 },
          { tick: 10, value: 1 },
        ],
      },
      {
        id: 'tk_vis',
        entityId: 'box',
        kind: 'authored',
        target: 'visible',
        keyframes: [
          { tick: 0, value: false, easing: 'step' },
          { tick: 5, value: true, easing: 'step' },
        ],
      },
    );
    expect(ent(evaluate(tl, 5), 'box').opacity).toBeCloseTo(0.5);
    expect(ent(evaluate(tl, 2), 'box').visible).toBe(false); // step 保持前值
    expect(ent(evaluate(tl, 5), 'box').visible).toBe(true);
  });

  it('component.<type>.<field> 巢狀屬性（如 animator.clip，step）', () => {
    const tl = makeTimeline();
    tl.entities[0].components.push({ type: 'Animator', data: { clip: 'idle' } });
    tl.tracks.push({
      id: 'tk_clip',
      entityId: 'player',
      kind: 'authored',
      target: 'component.Animator.clip',
      keyframes: [
        { tick: 0, value: 'idle', easing: 'step' },
        { tick: 30, value: 'run', easing: 'step' },
      ],
    });
    expect(ent(evaluate(tl, 10), 'player').components.Animator.data.clip).toBe('idle');
    expect(ent(evaluate(tl, 30), 'player').components.Animator.data.clip).toBe('run');
  });

  it('Transform component 的初始值會作為基礎 transform', () => {
    const tl = makeTimeline();
    tl.entities[1].components.push({
      type: 'Transform',
      data: { position: { x: 5, y: 6, z: 7 }, scale: { x: 2, y: 2, z: 2 } },
    });
    const box = ent(evaluate(tl, 0), 'box');
    expect(box.transform.position).toEqual({ x: 5, y: 6, z: 7 });
    expect(box.transform.scale).toEqual({ x: 2, y: 2, z: 2 });
  });
});

describe('evaluate — InteractiveSegment', () => {
  it('純 evaluator 不處理 interactive track（留給薄 SimCore）', () => {
    const tl = makeTimeline();
    tl.tracks.push({
      id: 'tk_inter',
      entityId: 'player',
      kind: 'interactive',
      target: 'transform.position',
      startTick: 0,
      endTick: null,
      controller: 'kinematic',
      params: {},
    });
    // 不應拋錯，且 player 仍由 authored track 決定
    expect(ent(evaluate(tl, 30), 'player').transform.position.x).toBeCloseTo(30);
  });

  it('輸出可 JSON 序列化（WorldState 是唯一真相，無不可序列化物件）', () => {
    const ws = evaluate(makeTimeline(), 30);
    expect(() => JSON.stringify(ws)).not.toThrow();
    expect(JSON.parse(JSON.stringify(ws))).toEqual(ws);
  });
});
