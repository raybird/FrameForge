# FrameForge

> **可互動、可錄播的宣告式 2.5D / 3D 場景合成器** —— 用 HyperFrames 的 seekable 時間控制思想，
> 打造適合 **AI 生成、Replay Debug、影片輸出** 的 Web Studio。

核心差異化(護城河):**「錄下的互動」的決定性重播(遊戲 replay 式) × 3D 場景圖 × 逐幀匯出**。
其他程式化影片工具都是純 authored;FrameForge 能 `錄一段互動 → 任意 seek → 逐位元重播 → 匯出 MP4`。

---

## 現況(2026-07-03)

三根支柱都已落地並經測試 / headless 實測:

- **Seekable** ✅ 時間軸 → `WorldState` → Three.js,任意 t 求值零漂移
- **Replayable** ✅ 薄 SimCore + Snapshot;互動可錄、可倒帶重播、可匯出/匯入分享(`.replay.json`);
  含**觸發體積**(走進區域→揭露/開門,決定性可重播)——這條互動錄播是唯一未被對手佔據的差異化,且 **AI 生成鏈也已支援**
- **Exportable** ✅ 逐幀 WebCodecs → MP4;AI 生成 → 渲染出片全程 agent 端閉環

可安裝 / 可跑的東西有三塊:**scene-mcp**(AI 生成)、**Studio**(播放/編輯)、**render_scene**(出片,選配)。

---

## 快速開始

### A. 讓 AI 生成場景 — `scene-mcp`(約 30 秒)

一支**自包單檔** MCP 工具伺服器,讓任何支援 MCP 的 agent(Claude Code / Codex / opencode / Antigravity)
用自然語言生成 FrameForge 場景並即時驗證。**不呼叫 LLM、不需金鑰**,只依賴目標機的 **Node 20+**。

```bash
# 從 GitHub Release 下載自包單檔到 ~/.local/bin
sh -c "$(curl -fsSL https://raw.githubusercontent.com/raybird/FrameForge/main/install.sh)"

# 設定 MCP 客戶端（以 Claude Code 為例；其餘見 packages/scene-mcp/README.md）
claude mcp add frameforge-scene -- frameforge-scene-mcp
```

工具:`get_scene_schema`(拿 schema+指南) · `compile_scene` / `validate_scene`(編譯/驗證,回可修正錯誤) ·
`save_scene`(存 JSON) · `render_scene`(出片,見 C)。
工作流:**看 schema → 生成 → 驗證修正迴圈 → 存檔或渲染**。

### B. 打開 Studio 玩 — 播放 / seek / 錄互動 / 匯出

```bash
cd apps/studio
npm install
npm start            # ng serve → http://localhost:4200
```

按 ▶ 後用**方向鍵**駕駛角色,操作即時錄製;拖時間軸往回即逐 tick 重播。
可載入 scene-mcp 生成的 JSON、匯出 MP4、匯出/匯入 `.replay.json`。

### C. 讓 agent 直接出片 — `render_scene`(選配,需本機 Chrome)

> **重要觀念:** 渲染需要 WebGL + WebCodecs = 實質上需要**瀏覽器**。生成場景的 LLM 在雲端、碰不到你的機器,
> 所以出片一定得由**本機**的東西驅動一顆瀏覽器。`render_scene` 把這件事封在 `scene-render` 裡(headless Chrome),
> agent 呼叫一個工具就拿到 MP4——代價是**那台機器要有 Chrome + Studio 建置產物**。
> (若你的客戶端另有瀏覽器控制工具,也可改讓 agent 自行驅動 Studio,屬選配、非通用。)

目前 `render_scene` 是**本機 / 開發能力**(尚未做成自包散佈),啟用方式:

```bash
# 1) 先建置 Studio（作為渲染面）
cd apps/studio && npm install && npm run build

# 2) 讓 scene-mcp 找得到渲染器（dev 直接用 tsx 跑 scene-render CLI）
export FRAMEFORGE_RENDER_CMD="npx tsx <REPO>/packages/scene-render/src/cli.ts"
export FRAMEFORGE_CHROME=/usr/bin/google-chrome   # 若非預設路徑

# 之後 agent 呼叫 render_scene（或直接跑 CLI）即可得 MP4
npx tsx packages/scene-render/src/cli.ts scenes/cretaceous-impact.json out.mp4
```

---

## 套件

| 套件 | 職責 |
|---|---|
| `packages/shared-types` | 共用型別契約(零 runtime 依賴):SceneTimeline / Track / WorldState / ReplayLog… |
| `packages/engine-core` | Scheduler(整數 tick)、Timeline Evaluator、mulberry32 PRNG、SimCore / Snapshot / Controller |
| `packages/engine-three` | 把 `WorldState` 投影到 Three.js 的 seek adapters、asset pipeline(貼圖/模型預載) |
| `packages/engine-export` | 逐幀擷取 + WebCodecs → MP4(與渲染器解耦) |
| `packages/scene-schema` | 場景的 zod 驗證層 + 給 LLM 的 JSON Schema(秒/角度/lookAt → canonical) |
| `packages/scene-mcp` | 場景生成的 MCP 工具伺服器(自包單檔,不呼叫 LLM) |
| `packages/scene-render` | Node 端把場景渲染成 MP4(headless Chrome + 重用 Studio) |
| `apps/studio` | Angular Studio:場景樹 / 時間軸 / Inspector / 錄製 / 匯出 |

各套件目前**獨立安裝**(各自 `npm install`);尚未統一 monorepo 工具。

## 文件

- 架構藍圖與設計決策(路線甲、命脈①②、市場定位):[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- scene-mcp 四家客戶端設定與從原始碼建置:[`packages/scene-mcp/README.md`](packages/scene-mcp/README.md)
