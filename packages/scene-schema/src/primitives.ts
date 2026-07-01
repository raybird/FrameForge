/**
 * 基礎 zod 契約：座標、顏色、可序列化 JSON 值、插值、track target。
 *
 * 這些鏡射 @frameforge/shared-types 的純型別，但**故意收緊**：
 * shared-types 是零 runtime 依賴的編譯期契約；本套件是 runtime 驗證層，
 * 專供「AI 生成的 timeline JSON」在載入前被檢查、並導出 JSON Schema 餵給 LLM。
 */

import { z } from 'zod/v4';

// ─────────────────────────────────────────────────────────────
// 可序列化 JSON 值（snapshot / payload / params 一律限制在此）
// ─────────────────────────────────────────────────────────────

export const jsonValue: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

// ─────────────────────────────────────────────────────────────
// 數學
// ─────────────────────────────────────────────────────────────

/**
 * 2.5D 座標。z 可省略（runtime 視為 0，對齊 evaluator 的 readVec3），
 * 讓「只在平面上動」的常見情況不必每次寫 z。
 */
export const vec3 = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────
// 顏色：數字（0xffd400）或 CSS 字串（'gold' / '#ffd400'）
// object-factory 兩者都吃。
// ─────────────────────────────────────────────────────────────

export const color = z.union([z.number().int(), z.string()]);

// ─────────────────────────────────────────────────────────────
// 插值
// ─────────────────────────────────────────────────────────────

export const cubicBezierEasing = z.object({
  type: z.literal('cubicBezier'),
  p1x: z.number(),
  p1y: z.number(),
  p2x: z.number(),
  p2y: z.number(),
});

export const easing = z.union([
  z.enum(['linear', 'step', 'easeIn', 'easeOut', 'easeInOut']),
  cubicBezierEasing,
]);

// ─────────────────────────────────────────────────────────────
// Track 驅動的目標屬性
// component.* 用 template literal，對應 shared-types 的 `component.${string}`
// ─────────────────────────────────────────────────────────────

export const trackTarget = z.union([
  z.enum(['transform.position', 'transform.rotation', 'transform.scale', 'visible', 'opacity']),
  z.templateLiteral(['component.', z.string()]),
]);

// ─────────────────────────────────────────────────────────────
// 時間：canonical 單位是「非負整數 tick」
// ─────────────────────────────────────────────────────────────

export const tick = z.int().nonnegative();
