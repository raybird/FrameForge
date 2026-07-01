import { describe, expect, it } from 'vitest';
import { compileScene, loadScene, eulerFromLookAt, sceneAuthoringJsonSchema } from './authoring';

/** authoring 形式：秒 + 角度 + camera lookAt。 */
function authoredFixture(): unknown {
  return {
    id: 'a',
    name: 'A',
    durationSeconds: 4, // → 240 ticks @60
    entities: [
      {
        id: 'cam',
        name: 'Cam',
        components: [
          { type: 'Transform', data: { position: { x: 0, y: 6, z: 14 } } },
          { type: 'Camera', data: { fov: 50, lookAt: { x: 0, y: 0, z: 0 } } },
        ],
      },
      {
        id: 'orb',
        name: 'Orb',
        components: [{ type: 'Mesh', data: { shape: 'sphere' } }],
      },
    ],
    tracks: [
      {
        id: 'spin',
        entityId: 'orb',
        kind: 'authored',
        target: 'transform.rotation',
        keyframes: [
          { atSeconds: 0, value: { x: 0, y: 0, z: 0 } },
          { atSeconds: 4, value: { x: 0, y: 360, z: 0 } }, // 度
        ],
      },
    ],
    events: [{ atSeconds: 1, type: 'sfx.play', payload: {} }],
  };
}

describe('compileScene', () => {
  it('秒 → tick、角度 → 弧度，並通過驗證', () => {
    const r = compileScene(authoredFixture());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.timeline;
    expect(t.durationTicks).toBe(240);
    const spin = t.tracks.find((x) => x.id === 'spin')!;
    expect(spin.kind).toBe('authored');
    if (spin.kind === 'authored') {
      expect(spin.keyframes[1].tick).toBe(240);
      // 360 度 → 2π 弧度
      expect((spin.keyframes[1].value as { y: number }).y).toBeCloseTo(Math.PI * 2, 5);
    }
    // event 秒 → tick
    expect(t.events[0].tick).toBe(60);
  });

  it('camera lookAt → 由位置算出的 Transform 旋轉（弧度）', () => {
    const r = compileScene(authoredFixture());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // validateTimeline 回傳「宣告式」timeline：相機旋轉在其 Transform component 的 data 裡。
    const cam = r.timeline.entities.find((e) => e.id === 'cam')!;
    const transform = cam.components.find((c) => c.type === 'Transform')!;
    const rot = (transform.data as { rotation: { x: number; y: number; z: number } }).rotation;
    // 從 (0,6,14) 看向原點：俯角 atan2(6,14) ≈ 0.4049，rotation.x 為負
    expect(rot.x).toBeCloseTo(-Math.atan2(6, 14), 4);
    expect(rot.y).toBeCloseTo(0, 6);
    expect(rot.z).toBeCloseTo(0, 6);
  });

  it('結構錯誤（durationSeconds 非正）→ 回報錯誤', () => {
    const bad = { ...(authoredFixture() as object), durationSeconds: 0 };
    const r = compileScene(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'durationSeconds')).toBe(true);
  });

  it('編譯後仍會跑交叉引用驗證（track 參照不存在 entity → 失敗）', () => {
    const a = authoredFixture() as any;
    a.tracks[0].entityId = 'ghost';
    const r = compileScene(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes('ghost'))).toBe(true);
  });
});

describe('loadScene（自動辨識）', () => {
  it('authoring 形式（有 durationSeconds）→ 編譯', () => {
    const r = loadScene(authoredFixture());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.timeline.durationTicks).toBe(240);
  });

  it('canonical 形式（有 durationTicks）→ 直接驗證', () => {
    const canonical = {
      id: 'c',
      name: 'C',
      tickRate: 60,
      durationTicks: 60,
      assets: [],
      entities: [{ id: 'e', name: 'E', components: [] }],
      tracks: [],
      events: [],
    };
    const r = loadScene(canonical);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.timeline.durationTicks).toBe(60);
  });
});

describe('eulerFromLookAt', () => {
  it('正前方注視 → 無旋轉', () => {
    const e = eulerFromLookAt({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 0 });
    expect(e.x).toBeCloseTo(0, 6);
    expect(e.y).toBeCloseTo(0, 6);
    expect(e.z).toBeCloseTo(0, 6);
  });

  it('往右看 → 繞 Y 轉約 -90 度', () => {
    const e = eulerFromLookAt({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(e.y).toBeCloseTo(-Math.PI / 2, 4);
  });
});

describe('sceneAuthoringJsonSchema', () => {
  it('導出含 durationSeconds 的 JSON Schema', () => {
    const schema = sceneAuthoringJsonSchema();
    expect((schema.properties as Record<string, unknown>)).toHaveProperty('durationSeconds');
    expect(JSON.stringify(schema)).toContain('lookAt');
  });
});
