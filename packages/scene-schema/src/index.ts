/**
 * @frameforge/scene-schema
 *
 * SceneTimeline 的 runtime 驗證契約（zod）＋ LLM structured-output JSON Schema。
 *
 * 為什麼獨立成套件：@frameforge/shared-types 是零 runtime 依賴的編譯期契約，
 * 不能引入 zod。本套件在其之上加一層「執行期把關」，專供 P5（AI 生成 timeline）
 * 的閉環：導出 JSON Schema → LLM 生成 → validateTimeline 把關 → 回餵錯誤修正。
 *
 * 詳見 docs/ARCHITECTURE.md §12（資料格式）與 §11（P5）。
 */

// zod schemas（可組合 / 可 .parse）
export * from './primitives';
export * from './components';
export * from './timeline';

// runtime 驗證（含交叉引用）
export {
  validateTimeline,
  formatErrors,
  KNOWN_CONTROLLERS,
  type ValidationError,
  type ValidationResult,
  type ValidateOptions,
} from './validate';

// LLM structured output
export { sceneTimelineJsonSchema, type JsonSchemaOptions } from './json-schema';

// authoring 編譯層（秒 / 角度 / lookAt → canonical）
export {
  authoredScene,
  compileScene,
  loadScene,
  sceneAuthoringJsonSchema,
  eulerFromLookAt,
  type CompileOptions,
} from './authoring';
