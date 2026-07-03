import { Injectable, signal } from '@angular/core';
import type { ReplayLog, SceneTimeline, Tick, WorldState } from '@frameforge/shared-types';
import { ControllerRegistry, KinematicController, ReplaySession } from '@frameforge/engine-core';
import {
  createObjectFactory,
  preloadAssets,
  type ObjectFactory,
  type ObjectFactoryContext,
  type TimelinePlayer,
} from '@frameforge/engine-three';
import { exportToMp4, isWebCodecsSupported } from '@frameforge/engine-export';
import { loadScene, type ValidationError } from '@frameforge/scene-schema';
import { HERO_ID, SEED, buildTimeline } from './scene-data';

export interface LoadOutcome {
  ok: boolean;
  errors: ValidationError[];
}

/**
 * StudioStore：Studio 的單一狀態源。
 * 擁有 timeline / registry / session；Viewport 建立 player 後 attach 回來；
 * Transport / SceneTree / Inspector 透過 signal 反應。
 */
@Injectable({ providedIn: 'root' })
export class StudioStore {
  /** 目前作用中的場景（可換）。signal，讓 scene-tree 等反應式更新。 */
  readonly timeline = signal<SceneTimeline>(buildTimeline());
  get durationTicks(): number {
    return this.timeline().durationTicks;
  }
  get tickRate(): number {
    return this.timeline().tickRate;
  }

  private readonly registry = new ControllerRegistry().register(KinematicController);
  private session = this.newSession();
  private player: TimelinePlayer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  /** Viewport 註冊的重建器：換場景時重建 adapters/player。 */
  private rebuild: ((timeline: SceneTimeline) => void) | null = null;
  /** 目前場景已預載 asset 的 object-factory context（貼圖 / 模型解析）。 */
  private assetCtx: ObjectFactoryContext = {};

  /** 供 Viewport 建 EntityAdapter：綁定目前場景已預載 asset 的工廠。 */
  objectFactory(): ObjectFactory {
    return createObjectFactory(this.assetCtx);
  }

  readonly tick = signal<Tick>(0);
  readonly playing = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly world = signal<WorldState | null>(null);
  readonly exporting = signal(false);
  readonly exportProgress = signal(0);
  /** 換場景時預載 asset 的狀態。 */
  readonly loading = signal(false);

  private newSession(): ReplaySession {
    return new ReplaySession(this.timeline(), {
      registry: this.registry,
      seed: SEED,
      snapshotInterval: 60,
    });
  }

  /** 傳給 TimelinePlayer 的求值器（接 ReplaySession，並快取當幀 world 供 Inspector）。 */
  readonly evaluateAt = (t: Tick): WorldState => {
    const w = this.session.seek(t);
    this.world.set(w);
    return w;
  };

  /** 傳給 TimelinePlayer 的渲染後回呼。 */
  readonly onRender = (t: Tick): void => {
    this.tick.set(t);
    this.playing.set(this.player?.playing ?? false);
  };

  attachPlayer(p: TimelinePlayer, canvas: HTMLCanvasElement): void {
    this.player = p;
    this.canvas = canvas;
    this.tick.set(p.scheduler.tick);
    this.playing.set(p.playing);
  }

  /** Viewport 在建立 Stage 後註冊；換場景時用來重建 adapters/player。 */
  registerRebuild(fn: (timeline: SceneTimeline) => void): void {
    this.rebuild = fn;
  }

  /**
   * 從 JSON 字串載入場景：先過 scene-schema 驗證，通過才換場景。
   * 回傳的 errors 可直接顯示（也正是可回餵 LLM 修正的訊息）。
   */
  async loadTimelineText(text: string): Promise<LoadOutcome> {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return {
        ok: false,
        errors: [{ path: '(json)', message: `JSON 解析失敗：${(e as Error).message}` }],
      };
    }
    // loadScene 自動辨識 authoring（秒/角度/lookAt）或 canonical，並回傳驗證後的 canonical。
    const result = loadScene(json);
    if (!result.ok) return { ok: false, errors: result.errors };
    // scene-schema 契約比 shared-types 更嚴格，驗證通過後可安全視為 SceneTimeline。
    await this.applyTimeline(result.timeline as unknown as SceneTimeline);
    return { ok: true, errors: [] };
  }

  /** 還原內建 demo 場景。 */
  async loadDefault(): Promise<void> {
    await this.applyTimeline(buildTimeline());
  }

  private async applyTimeline(timeline: SceneTimeline): Promise<void> {
    this.player?.pause();
    // 決定性：換場景前先預載全部 asset，之後 seek/匯出都同步從 store 讀。
    this.loading.set(true);
    try {
      const store = await preloadAssets(timeline.assets);
      this.assetCtx = store.factoryContext();
    } finally {
      this.loading.set(false);
    }
    this.timeline.set(timeline);
    this.session = this.newSession();
    this.tick.set(0);
    this.playing.set(false);
    this.selectedId.set(null);
    this.rebuild?.(timeline);
  }

  readonly canExport = isWebCodecsSupported();

  /** 逐幀匯出目前錄製內容為 MP4 並觸發下載。 */
  async export(): Promise<void> {
    const p = this.player;
    const canvas = this.canvas;
    if (!p || !canvas || this.exporting()) return;

    p.pause();
    const resumeTick = p.scheduler.tick;
    this.exporting.set(true);
    this.exportProgress.set(0);
    try {
      const blob = await exportToMp4({
        renderAt: (t) => p.renderAt(t),
        capture: () => canvas,
        width: canvas.width,
        height: canvas.height,
        endTick: this.durationTicks,
        tickRate: this.tickRate,
        fps: 30,
        onProgress: (done, total) => this.exportProgress.set(done / total),
      });
      downloadBlob(blob, 'frameforge.mp4');
    } finally {
      this.exporting.set(false);
      p.seekTick(resumeTick); // 還原匯出前的畫面
    }
  }

  togglePlay(): void {
    const p = this.player;
    if (!p) return;
    if (p.playing) {
      p.pause();
    } else {
      if (p.scheduler.tick >= this.durationTicks) p.seekTick(0);
      p.play();
    }
    this.playing.set(p.playing);
  }

  seek(t: number): void {
    this.player?.pause();
    this.player?.seekTick(t);
    this.playing.set(false);
  }

  setSpeed(s: number): void {
    this.player?.setSpeed(s);
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  /** 方向鍵驅動 hero：即時錄製事件（首次輸入即開播）。 */
  drive(dx: number, dy: number): void {
    const p = this.player;
    if (!p) return;
    if (!p.playing) p.play();
    const tick = p.scheduler.tick + 1;
    if (dx === 0 && dy === 0) this.session.recordEvent(tick, 'stop', { entityId: HERO_ID });
    else this.session.recordEvent(tick, 'move', { entityId: HERO_ID, dx, dy });
    this.playing.set(p.playing);
  }

  reset(): void {
    this.player?.pause();
    this.session = this.newSession();
    this.player?.seekTick(0);
    this.playing.set(false);
  }

  // ── Replay 分享（護城河：錄下的互動可存檔、可被他人逐位元重播）──

  /** 匯出目前錄製的 ReplayLog 為 .replay.json。 */
  exportReplay(): void {
    downloadJson(this.session.exportLog(), 'frameforge.replay.json');
  }

  /**
   * 匯入 ReplayLog：以其事件與 seed 重建 session，套到目前場景。
   * 回傳 errors 可直接顯示（沿用 LoadOutcome）。
   */
  importReplay(text: string): LoadOutcome {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: [{ path: '(json)', message: `JSON 解析失敗：${(e as Error).message}` }] };
    }
    const errors = validateReplayShape(json);
    if (errors.length) return { ok: false, errors };

    const log = json as ReplayLog;
    this.player?.pause();
    this.session = new ReplaySession(this.timeline(), {
      registry: this.registry,
      log,
      seed: log.seed,
      snapshotInterval: 60,
    });
    this.player?.seekTick(0);
    this.playing.set(false);
    return { ok: true, errors: [] };
  }
}

function downloadJson(obj: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

function validateReplayShape(json: unknown): ValidationError[] {
  const errs: ValidationError[] = [];
  if (typeof json !== 'object' || json === null) {
    return [{ path: '(root)', message: '不是物件' }];
  }
  const o = json as Record<string, unknown>;
  if (typeof o['tickRate'] !== 'number') errs.push({ path: 'tickRate', message: '缺少或非數字' });
  if (typeof o['seed'] !== 'number') errs.push({ path: 'seed', message: '缺少或非數字' });
  if (!Array.isArray(o['events'])) {
    errs.push({ path: 'events', message: '缺少 events 陣列' });
  } else {
    (o['events'] as unknown[]).forEach((e, i) => {
      const ev = e as Record<string, unknown>;
      if (typeof ev?.['tick'] !== 'number' || typeof ev?.['type'] !== 'string') {
        errs.push({ path: `events[${i}]`, message: '需為 { tick:number, type:string, payload }' });
      }
    });
  }
  return errs;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
