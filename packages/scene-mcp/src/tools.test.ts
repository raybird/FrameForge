import { describe, expect, it, vi } from 'vitest';
import { schemaText, validateScene, saveScene } from './tools';

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

describe('schemaText', () => {
  it('是可解析的 JSON Schema，含頂層欄位', () => {
    const schema = JSON.parse(schemaText());
    expect(schema.type).toBe('object');
    for (const k of ['entities', 'tracks', 'events', 'durationTicks']) {
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
