/**
 * @frameforge/scene-mcp
 *
 * FrameForge 場景的 MCP 工具伺服器：對 agent 暴露 get_scene_schema / validate_scene / save_scene，
 * 讓 Claude Code / Desktop 產生並「即時驗證」場景（生成 → 驗證 → 修正 的閉環跑在 agent）。
 * 執行：`npm start`（stdio）。
 */

export { createServer, main } from './server';
export {
  AUTHORING_GUIDE,
  schemaText,
  validateScene,
  saveScene,
  type ValidateResult,
  type SaveResult,
} from './tools';
