# FrameForge

> 可錄影的宣告式 2.5D 場景合成器（+ 輕互動）。
> 用 HyperFrames 的 Frame Adapter / seekable 時間控制思想，打造適合
> **AI 場景生成、Replay Debug、影片輸出**的 Web 2.5D Studio。

核心差異化：**Replayable / Seekable / Exportable**，而非「又一個 Web Game Engine」。

## 文件

- 架構藍圖與設計決策：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 目錄結構

```txt
apps/studio/            # Angular Studio（規劃中）
packages/
  shared-types/         # 共用型別契約（零 runtime 依賴）
  engine-core/          # scheduler / adapter / replay / snapshot（規劃中）
  engine-three/         # Three.js 渲染（規劃中）
  engine-lottie/        # Lottie（規劃中）
  engine-audio/         # 音訊 realtime + offline（規劃中）
  engine-export/        # capture / encoder（規劃中）
docs/ARCHITECTURE.md
```

> 工具鏈（Nx / pnpm workspace / Angular CLI）尚未拍板；目錄結構與工具鏈無關。
