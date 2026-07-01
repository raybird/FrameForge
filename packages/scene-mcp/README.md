# @frameforge/scene-mcp

FrameForge 場景的 **MCP 工具伺服器**。讓 Claude Code / Claude Desktop 這類 MCP 客戶端
自己「生成」`SceneTimeline`，並透過本伺服器的工具**即時驗證**——生成 → 驗證 → 依錯誤修正
的閉環跑在 agent，本伺服器不呼叫任何 LLM、不需金鑰。

## 工具

| 工具 | 用途 |
|---|---|
| `get_scene_schema` | 回傳 **authoring 形式**（秒 / 角度 / camera lookAt）的 JSON Schema 與撰寫指南（產生前先讀） |
| `compile_scene` | 把 authoring 形式編譯成可載入的 canonical timeline（並驗證），回傳 canonical JSON 或錯誤 |
| `validate_scene` | 驗證一份場景（authoring 或 canonical、物件或字串皆可），回傳可據以修正的錯誤 |
| `save_scene` | 驗證/編譯通過才寫成 JSON 檔（給 Studio「載入場景」用），未通過不寫 |

驗證與編譯由 `@frameforge/scene-schema` 負責：`validateTimeline`（zod + 交叉引用）、
`compileScene`（authoring → canonical：秒→tick、角度→弧度、lookAt→euler）。

## 啟動

```bash
npm start           # = tsx src/server.ts（stdio）
```

## 接進 Claude Code（專案根目錄 `.mcp.json`）

```json
{
  "mcpServers": {
    "frameforge-scene": {
      "command": "npx",
      "args": ["tsx", "packages/scene-mcp/src/server.ts"]
    }
  }
}
```

或：`claude mcp add frameforge-scene -- npx tsx packages/scene-mcp/src/server.ts`

## 接進 Claude Desktop（`claude_desktop_config.json`，需絕對路徑）

```json
{
  "mcpServers": {
    "frameforge-scene": {
      "command": "npx",
      "args": ["tsx", "/home/kevin/Documents/RCodes/FrameForge/packages/scene-mcp/src/server.ts"]
    }
  }
}
```

## 典型流程

1. 對 agent 說：「用 FrameForge 做一個 X 場景」。
2. agent 呼叫 `get_scene_schema` 了解 authoring 格式 → 用秒/角度/lookAt 產生 JSON。
3. agent 呼叫 `compile_scene` → 未過就依回傳錯誤修正、再試，直到通過並拿到 canonical JSON。
4. （選）`save_scene` 寫檔，或把 JSON 貼進 Studio 的「載入場景」播放、匯出 MP4（Studio 也直接吃 authoring 形式）。
