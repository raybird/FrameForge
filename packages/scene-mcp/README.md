# @frameforge/scene-mcp

FrameForge 場景的 **MCP 工具伺服器**。讓 Claude Code / Claude Desktop 這類 MCP 客戶端
自己「生成」`SceneTimeline`，並透過本伺服器的工具**即時驗證**——生成 → 驗證 → 依錯誤修正
的閉環跑在 agent，本伺服器不呼叫任何 LLM、不需金鑰。

## 工具

| 工具 | 用途 |
|---|---|
| `get_scene_schema` | 回傳 SceneTimeline 的 JSON Schema 與撰寫指南（產生前先讀） |
| `validate_scene` | 驗證一份 timeline（物件或 JSON 字串），回傳可據以修正的錯誤清單 |
| `save_scene` | 驗證通過才寫成 JSON 檔（給 Studio「載入場景」用），未通過不寫 |

驗證由 `@frameforge/scene-schema` 的 `validateTimeline` 負責（zod + 交叉引用）。

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
2. agent 呼叫 `get_scene_schema` 了解格式 → 產生 timeline JSON。
3. agent 呼叫 `validate_scene` → 未過就依回傳錯誤修正、再驗，直到通過。
4. （選）`save_scene` 寫檔，或把 JSON 貼進 Studio 的「載入場景」播放、匯出 MP4。
