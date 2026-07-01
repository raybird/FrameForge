import { describe, expect, it } from 'vitest';
import { sceneTimelineJsonSchema } from './json-schema';

describe('sceneTimelineJsonSchema', () => {
  it('導出含頂層欄位的 JSON Schema 物件', () => {
    const schema = sceneTimelineJsonSchema();
    expect(schema.type).toBe('object');
    const props = schema.properties as Record<string, unknown>;
    for (const key of ['id', 'name', 'tickRate', 'durationTicks', 'entities', 'assets', 'tracks', 'events']) {
      expect(props).toHaveProperty(key);
    }
  });

  it('可被 JSON 序列化（適合當 LLM structured output schema）', () => {
    const schema = sceneTimelineJsonSchema();
    expect(() => JSON.stringify(schema)).not.toThrow();
    const json = JSON.stringify(schema);
    // component discriminated union 應出現在 schema 內
    expect(json).toContain('Camera');
    expect(json).toContain('Text');
  });

  it('支援 draft-7 target', () => {
    const schema = sceneTimelineJsonSchema({ target: 'draft-7' });
    expect(schema.type).toBe('object');
  });
});
