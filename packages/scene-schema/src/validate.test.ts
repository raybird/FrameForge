import { describe, expect, it } from 'vitest';
import { validateTimeline, formatErrors, type ValidationResult } from './validate';

/** 一份「豐富但合法」的 timeline：涵蓋 authored + interactive、asset 參照、Camera/Text/Audio。 */
function validFixture(): unknown {
  return {
    id: 'scene_001',
    name: 'Demo',
    tickRate: 60,
    durationTicks: 600,
    assets: [
      { id: 'hero_png', type: 'png', url: '/assets/hero.png' },
      { id: 'bgm', type: 'mp3', url: '/assets/bgm.mp3' },
    ],
    entities: [
      {
        id: 'cam',
        name: 'Camera',
        components: [{ type: 'Camera', data: { projection: 'perspective', fov: 50 } }],
      },
      {
        id: 'ground',
        name: 'Ground',
        components: [
          { type: 'Transform', data: { position: { x: 0, y: -1.2, z: 0 }, scale: { x: 16, y: 0.3, z: 16 }, color: 0x2e7d32 } },
        ],
      },
      {
        id: 'hero',
        name: 'Hero',
        components: [
          { type: 'Sprite', data: { assetId: 'hero_png', color: 0xffd400 } },
          { type: 'Collider', data: { shape: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } } },
        ],
      },
      {
        id: 'title',
        name: 'Title',
        components: [{ type: 'Text', data: { content: 'FrameForge', fontSize: 48, align: 'center' } }],
      },
      {
        id: 'music',
        name: 'Music',
        components: [{ type: 'AudioSource', data: { assetId: 'bgm', loop: true, volume: 0.8 } }],
      },
    ],
    tracks: [
      {
        id: 'tk_ground_rot',
        entityId: 'ground',
        kind: 'authored',
        target: 'transform.rotation',
        keyframes: [
          { tick: 0, value: { x: 0, y: 0, z: 0 } },
          { tick: 600, value: { x: 0, y: 6.28, z: 0 }, easing: 'easeInOut' },
        ],
      },
      {
        id: 'seg_hero',
        entityId: 'hero',
        kind: 'interactive',
        target: 'transform.position',
        startTick: 0,
        endTick: null,
        controller: 'kinematic',
        params: { position: { x: 0, y: 0.5, z: 0 }, speed: 0.1 },
      },
    ],
    events: [{ tick: 30, type: 'sfx.play', payload: { assetId: 'bgm' } }],
  };
}

/** 型別窄化小工具，方便斷言 errors。 */
function expectFail(r: ValidationResult): asserts r is { ok: false; errors: { path: string; message: string }[] } {
  expect(r.ok).toBe(false);
}

describe('validateTimeline — 正例', () => {
  it('豐富但合法的 timeline 通過，並回傳解析後資料', () => {
    const r = validateTimeline(validFixture());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.timeline.entities).toHaveLength(5);
      // Collider.isTrigger 預設補為 true
      const hero = r.timeline.entities.find((e) => e.id === 'hero')!;
      const collider = hero.components.find((c) => c.type === 'Collider')!;
      expect((collider.data as { isTrigger: boolean }).isTrigger).toBe(true);
    }
  });
});

describe('validateTimeline — 結構錯誤（zod）', () => {
  it('未知 component 型別被擋下', () => {
    const t = validFixture() as any;
    t.entities[0].components[0].type = 'Rigidbody';
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path.startsWith('entities[0].components[0]'))).toBe(true);
  });

  it('Text 缺 content 被擋下', () => {
    const t = validFixture() as any;
    t.entities[3].components[0].data = {};
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path.includes('content'))).toBe(true);
  });

  it('Animator clips 為空被擋下', () => {
    const t = validFixture() as any;
    t.entities[0].components.push({ type: 'Animator', data: { clips: [] } });
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path.includes('clips'))).toBe(true);
  });

  it('Collider isTrigger=false 被擋下（甲只做觸發體積）', () => {
    const t = validFixture() as any;
    t.entities[2].components[1].data.isTrigger = false;
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path.includes('isTrigger'))).toBe(true);
  });

  it('durationTicks 非正被擋下', () => {
    const t = validFixture() as any;
    t.durationTicks = 0;
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path === 'durationTicks')).toBe(true);
  });
});

describe('validateTimeline — 交叉引用', () => {
  it('track 參照不存在的 entity', () => {
    const t = validFixture() as any;
    t.tracks[1].entityId = 'ghost';
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors).toContainEqual({
      path: 'tracks[1].entityId',
      message: "參照不存在的 entity 'ghost'",
    });
  });

  it('component 參照不存在的 asset', () => {
    const t = validFixture() as any;
    t.entities[2].components[0].data.assetId = 'nope';
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.message.includes("asset 'nope'"))).toBe(true);
  });

  it('entity id 重複', () => {
    const t = validFixture() as any;
    t.entities[1].id = 'hero';
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.message.includes('entity id 重複'))).toBe(true);
  });

  it('未知 controller', () => {
    const t = validFixture() as any;
    t.tracks[1].controller = 'ragdoll';
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path === 'tracks[1].controller')).toBe(true);
  });

  it('可透過 options 擴充已知 controller', () => {
    const t = validFixture() as any;
    t.tracks[1].controller = 'stateMachine';
    const r = validateTimeline(t, { controllers: ['kinematic', 'stateMachine'] });
    expect(r.ok).toBe(true);
  });
});

describe('validateTimeline — 時間界限', () => {
  it('keyframe tick 非嚴格遞增', () => {
    const t = validFixture() as any;
    t.tracks[0].keyframes = [
      { tick: 0, value: { x: 0, y: 0, z: 0 } },
      { tick: 0, value: { x: 0, y: 1, z: 0 } },
    ];
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.message.includes('嚴格遞增'))).toBe(true);
  });

  it('keyframe 超出 durationTicks', () => {
    const t = validFixture() as any;
    t.tracks[0].keyframes[1].tick = 9999;
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.message.includes('超出 durationTicks'))).toBe(true);
  });

  it('interactive endTick 小於 startTick', () => {
    const t = validFixture() as any;
    t.tracks[1].startTick = 100;
    t.tracks[1].endTick = 50;
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path === 'tracks[1].endTick')).toBe(true);
  });

  it('event tick 超出 durationTicks', () => {
    const t = validFixture() as any;
    t.events[0].tick = 9999;
    const r = validateTimeline(t);
    expectFail(r);
    expect(r.errors.some((e) => e.path === 'events[0].tick')).toBe(true);
  });
});

describe('formatErrors', () => {
  it('攤成可回餵 LLM 的多行文字', () => {
    const r = validateTimeline({ id: '', name: 'x' });
    expectFail(r);
    const text = formatErrors(r.errors);
    expect(text).toContain('- ');
    expect(text.split('\n').length).toBe(r.errors.length);
  });
});
