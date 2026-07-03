import { describe, expect, it, vi } from 'vitest';
import { schemaText, validateScene, compileToCanonical, saveScene, renderScene } from './tools';

const VALID = {
  id: 's',
  name: 'S',
  tickRate: 60,
  durationTicks: 120,
  assets: [],
  entities: [{ id: 'orb', name: 'Orb', components: [{ type: 'Mesh', data: { shape: 'sphere' } }] }],
  tracks: [
    {
      id: 't',
      entityId: 'orb',
      kind: 'authored',
      target: 'transform.position',
      keyframes: [
        { tick: 0, value: { x: 0, y: 0, z: 0 } },
        { tick: 120, value: { x: 1, y: 0, z: 0 } },
      ],
    },
  ],
  events: [],
};
// 同一份，但 track 參照不存在的 entity。
const INVALID = { ...VALID, tracks: [{ ...VALID.tracks[0], entityId: 'ghost' }] };

// authoring 形式（秒 / 角度 / camera lookAt）。
const AUTHORED = {
  id: 'a',
  name: 'A',
  durationSeconds: 4,
  entities: [
    {
      id: 'cam',
      name: 'Cam',
      components: [
        { type: 'Transform', data: { position: { x: 0, y: 6, z: 14 } } },
        { type: 'Camera', data: { fov: 50, lookAt: { x: 0, y: 0, z: 0 } } },
      ],
    },
    { id: 'orb', name: 'Orb', components: [{ type: 'Mesh', data: { shape: 'sphere' } }] },
  ],
  tracks: [],
  events: [],
};

describe('schemaText（authoring 形式）', () => {
  it('是可解析的 JSON Schema，含 durationSeconds 等頂層欄位', () => {
    const schema = JSON.parse(schemaText());
    expect(schema.type).toBe('object');
    for (const k of ['entities', 'tracks', 'events', 'durationSeconds']) {
      expect(schema.properties).toHaveProperty(k);
    }
  });
});

describe('validateScene', () => {
  it('合法物件 → ok，並回傳解析後 timeline', () => {
    const r = validateScene(VALID);
    expect(r.ok).toBe(true);
    expect(r.timeline?.entities).toHaveLength(1);
    expect(r.text).toContain('通過');
  });

  it('合法 JSON 字串 → ok（接受字串輸入）', () => {
    const r = validateScene(JSON.stringify(VALID));
    expect(r.ok).toBe(true);
  });

  it('交叉引用錯誤 → 不 ok，文字含可修正的錯誤', () => {
    const r = validateScene(INVALID);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.includes('entityId'))).toBe(true);
    expect(r.text).toContain('entityId');
  });

  it('壞 JSON 字串 → 回報解析失敗', () => {
    const r = validateScene('{ not json');
    expect(r.ok).toBe(false);
    expect(r.text).toContain('JSON 解析失敗');
  });

  it('也吃 authoring 形式（有 durationSeconds）', () => {
    const r = validateScene(AUTHORED);
    expect(r.ok).toBe(true);
    // 已編譯成 canonical：4 秒 @60 → 240 ticks
    expect(r.timeline?.durationTicks).toBe(240);
  });
});

describe('compileToCanonical', () => {
  it('authoring → canonical JSON（秒→tick、lookAt→旋轉）', () => {
    const r = compileToCanonical(AUTHORED);
    expect(r.ok).toBe(true);
    const canonical = JSON.parse(r.canonicalJson!);
    expect(canonical.durationTicks).toBe(240);
    const cam = canonical.entities.find((e: { id: string }) => e.id === 'cam');
    const transform = cam.components.find((c: { type: string }) => c.type === 'Transform');
    expect(transform.data.rotation.x).toBeCloseTo(-Math.atan2(6, 14), 4);
  });

  it('不合法 authoring → 回報錯誤，無 canonicalJson', () => {
    const r = compileToCanonical({ ...AUTHORED, durationSeconds: 0 });
    expect(r.ok).toBe(false);
    expect(r.canonicalJson).toBeUndefined();
  });
});

describe('saveScene', () => {
  it('合法 → 寫檔並回傳絕對路徑', async () => {
    const write = vi.fn(async (_path: string, _content: string) => {});
    const r = await saveScene(VALID, './scenes/demo.json', write);
    expect(r.ok).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(r.path).toMatch(/scenes\/demo\.json$/);
    // 寫入的是解析後（含預設值填補）的合法 JSON
    const written = JSON.parse(write.mock.calls[0][1] as string);
    expect(written.id).toBe('s');
  });

  it('不合法 → 不寫檔、回傳錯誤', async () => {
    const write = vi.fn(async (_path: string, _content: string) => {});
    const r = await saveScene(INVALID, './scenes/x.json', write);
    expect(r.ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(r.text).toContain('未寫入');
  });
});

describe('renderScene', () => {
  it('合法 → 先編譯出 canonical 再交給渲染器，回傳路徑與位元組', async () => {
    const write = vi.fn(async (_path: string, _content: string) => {});
    const render = vi.fn(async (_scenePath: string, _outPath: string) => ({ bytes: 12345 }));
    const r = await renderScene(VALID, './out.mp4', render, write);
    expect(r.ok).toBe(true);
    expect(r.bytes).toBe(12345);
    expect(r.path).toMatch(/out\.mp4$/);
    // 有先把 canonical 寫成暫存場景檔，並用它呼叫渲染器
    expect(write).toHaveBeenCalledOnce();
    const [scenePathArg] = render.mock.calls[0];
    expect(scenePathArg).toMatch(/out\.mp4\.scene\.json$/);
    expect(JSON.parse(write.mock.calls[0][1] as string).id).toBe('s');
  });

  it('接受 authoring 形式（先編譯成 canonical）', async () => {
    const write = vi.fn(async () => {});
    const render = vi.fn(async () => ({ bytes: 1 }));
    const r = await renderScene(AUTHORED, './a.mp4', render, write);
    expect(r.ok).toBe(true);
    expect(render).toHaveBeenCalledOnce();
  });

  it('不合法 → 不渲染、回傳可修正的錯誤', async () => {
    const write = vi.fn(async () => {});
    const render = vi.fn(async () => ({ bytes: 1 }));
    const r = await renderScene(INVALID, './x.mp4', render, write);
    expect(r.ok).toBe(false);
    expect(render).not.toHaveBeenCalled();
    expect(r.text).toContain('未渲染');
  });

  it('渲染器丟錯 → 回傳含環境需求提示的失敗訊息', async () => {
    const write = vi.fn(async () => {});
    const render = vi.fn(async () => {
      throw new Error('Chrome not found');
    });
    const r = await renderScene(VALID, './x.mp4', render, write);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('渲染失敗');
    expect(r.text).toContain('FRAMEFORGE_RENDER_CMD');
  });
});
