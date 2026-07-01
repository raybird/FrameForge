/**
 * 導出 SceneTimeline 的 JSON Schema，餵給 LLM 做 structured output。
 *
 * 用途：Anthropic tool `input_schema` / OpenAI `response_format: json_schema` /
 * 一般 constrained decoding。把這份 schema 交給模型，就能大幅提高
 * 「一次生成合法 timeline」的成功率（P5 的最大槓桿）。
 *
 * 注意：JSON Schema 只涵蓋「結構」；交叉引用（id 是否存在…）仍需 validateTimeline
 * 在生成後把關。兩者互補。
 */

import { z } from 'zod/v4';
import { sceneTimeline } from './timeline';

export interface JsonSchemaOptions {
  /** JSON Schema 版本。預設 draft-2020-12（Anthropic / OpenAI 皆可）。 */
  target?: 'draft-7' | 'draft-2020-12';
}

/** SceneTimeline 的完整 JSON Schema（物件）。 */
export function sceneTimelineJsonSchema(opts: JsonSchemaOptions = {}): Record<string, unknown> {
  return z.toJSONSchema(sceneTimeline, {
    target: opts.target ?? 'draft-2020-12',
  }) as Record<string, unknown>;
}
