# @frameforge/scene-mcp

FrameForge 場景生成的 **MCP 工具伺服器**。讓任何支援 MCP 的 agent（Claude Code / Codex /
opencode / Antigravity …）用自然語言生成 FrameForge 場景，並透過本伺服器的工具**即時驗證**——
「生成 → 驗證 → 依錯誤修正」的閉環跑在 agent 端。

**本伺服器不呼叫任何 LLM、不需要金鑰。** 它只提供「契約 + 驗證 + 存檔」；產出的場景可在
FrameForge Studio 播放、任意 seek、逐幀匯出 MP4。

## 工具

| 工具 | 用途 |
|---|---|
| `get_scene_schema` | 取得 authoring 形式的 JSON Schema 與撰寫指南（時間用秒、旋轉用角度、相機用 lookAt） |
| `compile_scene` | authoring → canonical，並一併驗證；回傳 canonical JSON 或可修正的錯誤 |
| `validate_scene` | 驗證場景（authoring 或 canonical 皆可），回傳可據以修正的錯誤 |
| `save_scene` | 驗證/編譯通過才把 canonical timeline 寫成 JSON 檔（給 Studio 載入） |

驗證與編譯由 `@frameforge/scene-schema` 負責（zod + 交叉引用；秒→tick、角度→弧度、lookAt→euler）。
伺服器另透過 MCP 的 `instructions` 欄位附上「使用工作流」，任何客戶端連上後模型都會看到——
等於一份跟著伺服器走的用法說明，各家不必各裝一份。

## 安裝

發行採 **GitHub Release + 安裝腳本**：把自包單檔放進 PATH，四家客戶端統一用裸指令
`frameforge-scene-mcp`。需要目標機器有 **Node 20+**（產物是 `#!/usr/bin/env node` 腳本）。

```bash
# 把 OWNER/REPO 換成本專案的 GitHub owner/repo
FRAMEFORGE_REPO=OWNER/REPO \
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/install.sh)"
```

腳本會下載最新 release 的 `frameforge-scene-mcp` 到 `~/.local/bin`（可用 `FRAMEFORGE_BIN_DIR` 改），
並在不在 PATH 時提示如何加入。裝好後在各家設定：

### Claude Code

```bash
claude mcp add frameforge-scene -- frameforge-scene-mcp
```

或 `.mcp.json`：

```json
{ "mcpServers": { "frameforge-scene": { "command": "frameforge-scene-mcp" } } }
```

### Codex CLI

```bash
codex mcp add frameforge-scene -- frameforge-scene-mcp
```

或 `~/.codex/config.toml`：

```toml
[mcp_servers.frameforge-scene]
command = "frameforge-scene-mcp"
```

### opencode

`opencode.json`（專案根）或 `~/.config/opencode/opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "frameforge-scene": { "type": "local", "command": ["frameforge-scene-mcp"], "enabled": true }
  }
}
```

### Google Antigravity

`~/.gemini/config/mcp_config.json`（或 IDE：Manage MCP Servers → View raw config）：

```json
{ "mcpServers": { "frameforge-scene": { "command": "frameforge-scene-mcp" } } }
```

> 若某客戶端找不到 PATH 上的指令，改用絕對路徑：`command` 給 `node`、
> `args` 給安裝位置（例：`~/.local/bin/frameforge-scene-mcp`）。

## 從原始碼建置（開發 / 未發行時）

```bash
npm install
npm run build   # → dist/server.js（自包單檔，含 shebang）
```

各家設定改指向本地檔：`command` 用 `node`、`args` 給 `絕對路徑/packages/scene-mcp/dist/server.js`。
發佈由 GitHub Actions（`.github/workflows/release.yml`）在推 `v*` tag 時自動建置並掛上 Release。
（本套件也保有 npm 發佈能力：`npm publish`，但預設走 GitHub Release。）

## 使用工作流

1. `get_scene_schema` — 產生前先看 authoring 形式的 schema 與指南。
2. 依 schema 產生 authoring JSON。
3. `compile_scene` — 編成 canonical 並驗證；有錯就依訊息修正後重試，直到通過。
4. `save_scene` — 寫出檔案，或把 canonical 交給使用者貼進 Studio 的「載入場景」。

`validate_scene` 可在任一階段檢查。內容多為純函數 `f(t)`（authored track，可任意 seek）；
互動片段用 controller。顏色用 `0xRRGGBB` 數字或 CSS 字串；不要引用不存在的
`entityId` / `assetId`；keyframe 依時間遞增且不超過總長。

## 開發

```bash
npm start        # tsx 直接跑（開發用，讀 src/cli.ts）
npm run build    # esbuild 打包成 dist/server.js
npm test         # vitest（工具純邏輯）
npm run typecheck
```

打包策略：**完全自包**——`@frameforge/scene-schema`、`@frameforge/shared-types`、
`@modelcontextprotocol/sdk`、`zod` 全部 inline 進單一 `dist/server.js`，僅依賴目標機器的 Node。
