# FrameForge 架構藍圖（修訂版）

> 文件版本：v1.0　|　日期：2026-06-17
> 狀態：已收斂（路線甲）。本文件為後續開發的唯一架構依據。

---

## 0. 一句話定位

> **FrameForge 是一個「可錄影的宣告式 2.5D 場景合成器（+ 輕互動）」**，
> 用 HyperFrames 的 Frame Adapter / seekable 時間控制思想，打造一個適合
> **AI 場景生成、Replay Debug、影片輸出**的 Web 2.5D Studio。

它**不是** emergent 物理遊戲引擎（那是被明確放棄的「路線乙」）。

---

## 1. 設計決策的根源：借用 HyperFrames，但要劃清邊界

[HyperFrames](https://github.com/heygen-com/hyperframes) 的本質：
**「Write HTML. Render video. Built for agents.」**——把 HTML/CSS/媒體/可 seek 的動畫，
離線、決定性地輸出成 MP4。核心信條是 **「same input, same frames, same output」**。
其 Frame Adapter 的職責是：**包住各種動畫 runtime（GSAP / CSS / Lottie / Three.js / WAAPI），
提供統一的「seek 到第 N 幀」介面**；元素用 `data-start` / `data-duration` 宣告式地聲明時間。

### 1.1 為什麼這個模式對 FrameForge「幾乎完全成立」

HyperFrames 的世界與遊戲世界，是兩種**數學性質不同**的東西：

| | HyperFrames | 遊戲（模擬層） |
|---|---|---|
| state(t) | **t 的純函數** `f(t)` | **歷史的遞迴** `f(state(t−Δ), input)` |
| 內容來源 | 預先編寫（`data-start/duration`） | 即時模擬「長」出來 |
| element 之間 | **獨立、零交互** | **耦合**（碰撞、AI 鎖定、共享物理世界） |
| seek 到 t=5 | 直接算，不需知道 t=4 | 必須從 snapshot 重放 |
| input / 因果 | 無 | 是核心 |

**結論：** 「讓場景、角色動作都是獨立 component」這個假設，在 HyperFrames 成立（內容預先編寫、彼此獨立），
但在遊戲的**模擬層**會破功（互動實體必須在同一個世界、同一個 tick 一起被算，否則永遠無法碰撞/互動）。

FrameForge 選擇**路線甲**，讓內容絕大多數是「預先編排」的 `f(t)`，
因此 Frame Adapter 模式**幾乎完全成立**；只在少量「互動片段」需要補上一層**很薄的模擬**。

### 1.2 不能借的東西

HyperFrames 的擷取引擎 `@hyperframes/engine` 是 **Puppeteer 抓 DOM**。
FrameForge 的畫面是 **WebGL/canvas + sim state，不是 DOM 合成的 HTML**。
因此**只能借概念**（adapter + seekable + 決定性 + 宣告式時間軸），**不能借它的算圖管線**；
匯出必須自建（見 §7）。

---

## 2. 核心模型：時間軸是真相，而且大部分是 `f(t)`

最重要的鐵則（整個產品成敗所繫）：

```txt
Simulation State（模擬層）  → 唯一真相，可序列化，決定性
Render State（Three.js）    → 純衍生視圖，不可序列化進 snapshot，隨時可重建
```

`WorldState(t)` ≈「評估所有 Track 在時間 t 的狀態」。
對「編排內容」而言，這就是純函數 `f(t)`。

### 2.1 時間軸的兩種軌道（核心抽象）

| | Authored Track（多數） | Interactive Segment（少數） |
|---|---|---|
| 例子 | 角色沿路徑走、技能特效、鏡頭運動、Lottie UI、BGM | 點擊觸發分支、玩家輸入改變走向 |
| 時間性質 | `f(t)` 純函數 | `f(state(t−1), input)` 依賴歷史 |
| seek | **直接評估，瞬間跳任意 t** | 需 snapshot + event-log 重放 |
| 需要 snapshot? | **不需要** | 需要，但範圍很小 |
| 決定性難題 | **幾乎消失** | 只在這小範圍內存在 |

> **甲的最大紅利：** 不必對整個世界做 snapshot/replay，只要對「互動片段」那一小塊做。
> 編排內容永遠是「評估 t」，免重算。

---

## 3. 整體架構

```txt
Angular Studio UI
  ├─ Scene Tree / Timeline / Property Panel / Asset Manager / Preview Controller
  ↓
Game Runtime
  ├─ SimCore（薄）          ← 只在互動片段跑；kinematic + 狀態機 + 觸發器
  └─ Frame Adapters（seek） ← 評估 t → 投影到 Three.js
  ↓
Frame Scheduler            ← 整數 tick、play/pause/seek/speed、real-time vs deterministic
  ↓
Three.js / Canvas / WebGL  ← 純衍生視圖（render-on-demand，非 rAF-locked）
  ↓
Export System              ← render-on-demand + WebCodecs（ffmpeg.wasm fallback）
```

### 3.1 資料流（即時 vs 回放統一）

```txt
[SimCore（薄）] ──產生/更新一小塊 state──┐
                                          ├──> [Frame Adapters（seek）] ──> Three.js
[Authored Tracks（f(t)）] ──評估 t────────┘

即時遊玩       = SimCore + Tracks 即時驅動 adapters
回放/seek/匯出 = 錄製時間軸（snapshot + event log）驅動 adapters（此時就是純 HyperFrames 模式）
```

---

## 4. Frame Scheduler

負責時間控制。支援兩種模式：

- **Real-time 模式**：玩家即時操作。
- **Deterministic 模式**：時間軸 seek / replay / 錄影 / debug。

```ts
interface FrameScheduler {
  play(): void;
  pause(): void;
  resume(): void;
  tick(dt: number): void;        // 內部換算為整數 tick
  seek(time: number): void;
  setSpeed(speed: number): void;
}
```

### 4.1 時間基準（決定性的地基）

```txt
canonical 時間 = 整數 tick 計數（例如固定 60Hz）
seconds        = tick / tickRate（衍生值，顯示用）
event.time     → 量化到 tick 邊界，確保「同一事件在同一 tick 被套用」
```

- **嚴禁累加浮點 dt** 當作真相時間（會漂移）。
- 即時播放需在兩個 sim state 之間做 **interpolation** 補幀（"Fix Your Timestep"）。

---

## 5. Frame Adapter

選甲後，所有 Adapter **都是 HyperFrames 式的 seek/playback adapter**
（「給我 t，把畫面設成 t 的樣子」），唯獨把「薄模擬」抽成獨立的 `SimCore`。

```ts
interface FrameAdapter {
  id: string;
  priority: number;
  mount(ctx: FrameContext): void;
  unmount(): void;
  update(dt: number): void;                       // 即時推進
  seek(time: number, replay?: ReplayContext): void; // 評估 t → 投影
}
```

| Adapter | 職責 | priority |
|---|---|---|
| SceneAdapter | 地圖 / 背景 / 攝影機 / 場景切換 | 0 |
| CharacterAdapter | 角色動畫 / 沿路徑移動 / 狀態切換（**多為 authored f(t)**） | 1 |
| VFXAdapter | 粒子 / 技能特效 / 命中 / Lottie 小動畫 / shader | 2 |
| AudioAdapter | 見 §6（事件 + 雙後端，**非可 tick/可 seek 之物**） | 3 |
| UIAdapter | HUD / 血條 / 對話框 / SVG overlay / Lottie UI | 4 |
| CaptureAdapter | 截圖 / 逐幀 / replay export / MP4 | 99 |

> 注意：`CharacterAdapter` 在甲**不擁有模擬**。角色沿路徑移動 + 動畫是 authored track（純 f(t)）；
> 只有玩家輸入介入時，薄 `SimCore` 才接手那一小塊狀態。

### 5.1 Lottie / SVG 規則

一律由 scheduler 驅動 `goToAndStop(frame)`，**禁止 autoplay / 自走 rAF**。

---

## 6. Audio：事件 + 雙後端（不是可 seek 之物）

`AudioContext.currentTime` 是牆鐘驅動、單調遞增、**無法倒退/無法 seek**。
逐幀輸出時 real-time AudioContext 也跟不上。因此：

```txt
即時播放    → AudioContext（只負責「現在播什麼」，由事件觸發）
離線輸出    → OfflineAudioContext（決定性離線 render 出 PCM，再餵編碼器）
seek 行為   → audio 不參與「重算」，只在落地那一刻依時間點重新排程
```

多數音訊是 timeline 上的 `data-start` 事件，離線輸出因此直接。

---

## 7. Export System

### 7.1 兩條紅線（先畫清楚再開工）

1. **Render-on-demand，非 rAF-locked**：必須能「推進 → 渲染一幀 → 擷取 → 重複」以任意速率跑。
   這是第一級設計約束，不是 Phase 4 才補。
2. **合成範圍**：MVP 匯出**只做純 WebGL 畫面**。
   SVG / Lottie / DOM 圖層（HUD）**不入鏡**（無法直接讀進同一張 canvas）。
   「UI 入鏡的完整合成」列為 Phase 4 之後的選配。

### 7.2 編碼器優先序

```txt
主力：WebCodecs VideoEncoder（硬體編碼，快一個量級、記憶體友善）
fallback：ffmpeg.wasm（封裝 / 不支援 WebCodecs 的瀏覽器）
```

> 因內容是 `f(t)`，逐幀輸出 = 「對每一幀評估 t → 渲染 → 擷取」，不需忠實重跑模擬。
> 這是甲對乙的壓倒性優勢。

---

## 8. 決定性破口清單（實作前就要立規矩）

只在「薄互動片段」需要嚴格遵守；authored 內容是 `f(t)`，多數破口自動消失。

| 破口 | 對策 |
|---|---|
| `Math.random()` | 換成可 seed 的 PRNG（如 mulberry32），seed 存進 snapshot |
| `Date.now()` / `performance.now()` | 模擬層一律禁用，只能讀 scheduler clock |
| Object / Map / Set 迭代順序 | entity 用穩定排序（如 id 排序）再 tick |
| **非同步 asset 載入** | replay/export 前**強制 preload 全部 asset** |
| 第三方物理 | 甲不使用剛體物理；只做 kinematic + 觸發體積 |
| Lottie / SVG 動畫 | 一律 `goToAndStop(frame)`，禁止 autoplay |

---

## 9. 該砍 / 該緩（相對原始藍圖）

```txt
砍掉：剛體物理、emergent gameplay、重型 ECS、複雜動畫狀態機
降級：碰撞 → 只做觸發體積（進入/離開區域）
降級：角色控制 → kinematic（沿路徑 / 簡單位移），非力學
保留：宣告式時間軸、keyframe、clip、event、snapshot（僅薄互動）
Worker / OffscreenCanvas → MVP 全主執行緒，效能不足再上
```

---

## 10. MVP Walking Skeleton（由內而外）

```txt
1. 宣告式場景時間軸 schema（entity + tracks + keyframes + clips + events）
2. FrameScheduler：整數 tick，核心動作是「評估時間軸在 t 的狀態」
3. Seek adapters：把評估結果投影到 Three.js
4. 驗證命脈①：拖動 timeline → 一切都是決定性 f(t) → 任意 t 瞬間 seek、零漂移
5. 加入「一個薄互動」（例：點擊觸發事件、分支一條 track）
   → 此時才動用 event-log + 小 snapshot，驗證命脈②：互動也能被錄、被重放
6. 截圖序列匯出（因為是 f(t)，逐幀輸出幾乎免費）
```

不在 MVP：完整地圖編輯器、完整碰撞、完整動畫狀態機、多人連線、完整 ECS、完整 asset pipeline。

---

## 11. 開發階段（修訂）

| Phase | 目標 | 產出 |
|---|---|---|
| **P1 核心原型** | 證明「編排內容能完美 seek」 | 時間軸 schema + Scheduler + SceneAdapter + CharacterAdapter + play/pause/seek |
| **P2 Replay 系統** | 證明「薄互動也能錄/重放」 | ReplayEventLog + input recording + 小 snapshot + deterministic replay + timeline event markers |
| **P3 VFX / Audio / Lottie** | 特效與音效跟時間軸同步 | VFXAdapter + AudioAdapter（雙後端）+ Lottie + SFX event replay |
| **P4 Export** | 輸出 5–10 秒片段 | render-on-demand + WebCodecs + PNG sequence + MP4 |
| **P5 AI Agent** | AI 生成可播放/可錄影場景 | AI 生成時間軸 JSON + 事件腳本 + 自動測試 replay + demo video |

---

## 12. 資料格式（概念，型別契約見 `shared-types`）

### Scene Timeline JSON

```json
{
  "id": "scene_001",
  "name": "Demo Scene",
  "tickRate": 60,
  "duration": 10,
  "entities": [],
  "assets": [],
  "tracks": [],
  "events": []
}
```

### Asset 支援類型

```txt
png / jpg / svg / lottie / gltf / glb / mp3 / wav / json
```

---

## 13. 目錄結構

```txt
apps/
  studio/                 # Angular Studio（editor / timeline / property-panel / scene-tree）

packages/
  engine-core/            # scheduler / adapter / entity / component / replay / snapshot
  engine-three/           # renderer / camera / scene / character
  engine-lottie/          # player / adapter
  engine-audio/           # audio-context（realtime + offline）/ adapter
  engine-export/          # capture / encoder（WebCodecs + ffmpeg fallback）
  shared-types/           # scene.schema.ts / asset.schema.ts / replay.schema.ts / worldstate.schema.ts

docs/
  ARCHITECTURE.md         # 本文件
```

> 工具鏈（Nx / pnpm workspace / Angular CLI）尚未拍板；目錄結構本身與工具鏈無關。

---

## 14. 結論

FrameForge 的核心產品**不是**「又一個 Web Game Engine」，而是
**Replayable / Seekable / Exportable 的宣告式 2.5D 場景合成器**。

選擇路線甲，讓 Frame Adapter 模式幾乎完整成立、決定性難題大幅降級、
且最契合「AI 生成 + Replay Debug + 影片輸出」的終極目標。
