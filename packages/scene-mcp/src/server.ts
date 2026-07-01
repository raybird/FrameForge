/**
 * FrameForge 場景的 MCP server（stdio）。
 *
 * 對 MCP 客戶端（Claude Code / Claude Desktop）暴露三個工具：
 *   - get_scene_schema：拿 JSON Schema + 撰寫指南
 *   - validate_scene ：驗證 timeline，回傳可修正的錯誤（agent 的修正迴圈靠這個）
 *   - save_scene     ：驗證通過才寫成 JSON 檔（給 Studio 載入）
 *
 * 注意：stdio 上 stdout 專供 MCP 協定，任何日誌只能寫 stderr。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AUTHORING_GUIDE, schemaText, validateScene, compileToCanonical, saveScene } from './tools';

/** timeline 參數：物件或 JSON 字串皆可。 */
const timelineArg = z.union([z.string(), z.record(z.string(), z.unknown())]);

export function createServer(): McpServer {
  const server = new McpServer({ name: 'frameforge-scene', version: '0.0.0' });

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

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}

// 直接執行時才啟動（被測試 import 時不觸發）。
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    process.stderr.write(String(e?.message ?? e) + '\n');
    process.exit(1);
  });
}
