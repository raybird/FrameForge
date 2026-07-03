/**
 * FrameForge 場景的 MCP server（stdio）。
 *
 * 對任何 MCP 客戶端（Claude Code / Codex / opencode / Antigravity …）暴露四個工具：
 *   - get_scene_schema：拿 JSON Schema + 撰寫指南
 *   - compile_scene  ：authoring（秒 / 角度 / lookAt）→ canonical，並一併驗證
 *   - validate_scene ：驗證 timeline，回傳可修正的錯誤（agent 的修正迴圈靠這個）
 *   - save_scene     ：驗證通過才寫成 JSON 檔（給 Studio 載入）
 *
 * 注意：stdio 上 stdout 專供 MCP 協定，任何日誌只能寫 stderr。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  AUTHORING_GUIDE,
  schemaText,
  validateScene,
  compileToCanonical,
  saveScene,
  renderScene,
} from './tools';

/** timeline 參數：物件或 JSON 字串皆可。 */
const timelineArg = z.union([z.string(), z.record(z.string(), z.unknown())]);

/**
 * Server 層級的使用指南——透過 MCP 協定的 `instructions` 送進任何客戶端
 * （Claude Code / Codex / opencode / Antigravity …）的模型上下文，
 * 等於「一份跟著 server 走的 skill」，不需各家各裝一份。
 */
const SERVER_INSTRUCTIONS = [
  'FrameForge 場景生成工具。用途：把需求變成可在 FrameForge Studio 播放 / 任意 seek / 匯出 MP4 的決定性 2.5D/3D 場景（timeline）。',
  '',
  '建議工作流：',
  '1) 先呼叫 get_scene_schema 取得 authoring 形式的 JSON Schema 與撰寫指南（時間用秒、旋轉用角度、相機用 lookAt）。',
  '2) 依 schema 產生 authoring JSON。',
  '3) 呼叫 compile_scene 編譯成 canonical 並驗證；若回傳錯誤，依訊息修正後重試，直到通過。',
  '4) 呼叫 save_scene 寫出檔案，或把 canonical 交給使用者貼進 Studio 的「載入場景」。',
  '5) 要直接產出影片時呼叫 render_scene（headless 渲染成 MP4；需本機 Chrome + scene-render）。',
  'validate_scene 可在任一階段檢查（authoring 或 canonical 皆可）。',
  '',
  '要點：內容多為純函數 f(t)（authored track，可任意 seek）；互動片段用 controller。顏色用 0xRRGGBB 數字或 CSS 字串。',
  '不要引用不存在的 entityId / assetId；keyframe 依時間遞增且不超過總長。',
].join('\n');

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'frameforge-scene', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    'get_scene_schema',
    {
      title: '取得場景（authoring 形式）的 JSON Schema 與撰寫指南',
      description:
        '回傳 FrameForge 場景的 authoring 形式 JSON Schema（時間用秒、旋轉用角度、相機用 lookAt）與撰寫指南。' +
        '產生場景前先呼叫此工具了解格式。',
      inputSchema: {},
    },
    async () => ({
      content: [
        { type: 'text', text: AUTHORING_GUIDE },
        { type: 'text', text: schemaText() },
      ],
    }),
  );

  server.registerTool(
    'compile_scene',
    {
      title: '編譯 authoring 場景 → canonical',
      description:
        '把 authoring 形式（秒 / 角度 / camera lookAt）編譯成可載入 Studio 的 canonical timeline，並一併驗證。' +
        '回傳 canonical JSON 或可修正的錯誤。產生 authoring JSON 後呼叫此工具取得最終場景。',
      inputSchema: { timeline: timelineArg },
    },
    async ({ timeline }) => {
      const r = compileToCanonical(timeline);
      return { content: [{ type: 'text', text: r.text }] };
    },
  );

  server.registerTool(
    'validate_scene',
    {
      title: '驗證場景',
      description:
        '驗證一份場景（authoring 或 canonical 形式、物件或 JSON 字串均可），回傳是否通過與可據以修正的錯誤。' +
        '未通過就依錯誤修正再驗，直到通過。',
      inputSchema: { timeline: timelineArg },
    },
    async ({ timeline }) => {
      const r = validateScene(timeline);
      return { content: [{ type: 'text', text: r.text }] };
    },
  );

  server.registerTool(
    'save_scene',
    {
      title: '驗證並存檔場景',
      description:
        '先驗證/編譯（authoring 或 canonical 皆可），通過才把 canonical timeline 寫成 JSON 檔（給 Studio「載入場景」用）；未通過不寫、回傳錯誤。',
      inputSchema: { timeline: timelineArg, path: z.string().min(1).describe('輸出檔路徑，例：./scenes/demo.json') },
    },
    async ({ timeline, path }) => {
      const r = await saveScene(timeline, path);
      return { content: [{ type: 'text', text: r.text }] };
    },
  );

  server.registerTool(
    'render_scene',
    {
      title: '把場景渲染成 MP4',
      description:
        '先編譯/驗證（authoring 或 canonical 皆可），通過才用 headless Chrome 逐幀渲染成 MP4 檔（生成→影片一路到底）。' +
        '需要本機有 Chrome 與 scene-render（frameforge-scene-render，或設 FRAMEFORGE_RENDER_CMD）；未通過驗證則不渲染、回傳可修正的錯誤。',
      inputSchema: {
        timeline: timelineArg,
        path: z.string().min(1).describe('輸出 MP4 路徑，例：./out.mp4'),
      },
    },
    async ({ timeline, path }) => {
      const r = await renderScene(timeline, path);
      return { content: [{ type: 'text', text: r.text }] };
    },
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

// 進入點在 src/cli.ts（打包後為 dist/server.js）；此檔僅匯出 createServer / main，
// 保持無副作用，方便測試 import 與 esbuild 打包。
