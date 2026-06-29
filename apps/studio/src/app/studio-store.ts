import { Injectable, signal } from '@angular/core';
import type { SceneTimeline, Tick, WorldState } from '@frameforge/shared-types';
import { ControllerRegistry, KinematicController, ReplaySession } from '@frameforge/engine-core';
import type { TimelinePlayer } from '@frameforge/engine-three';
import { DURATION, HERO_ID, SEED, buildTimeline } from './scene-data';

/**
 * StudioStore：Studio 的單一狀態源。
 * 擁有 timeline / registry / session；Viewport 建立 player 後 attach 回來；
 * Transport / SceneTree / Inspector 透過 signal 反應。
 */
@Injectable({ providedIn: 'root' })
export class StudioStore {
  readonly timeline: SceneTimeline = buildTimeline();
  readonly durationTicks = this.timeline.durationTicks;
  readonly tickRate = this.timeline.tickRate;

  private readonly registry = new ControllerRegistry().register(KinematicController);
  private session = this.newSession();
  private player: TimelinePlayer | null = null;

  readonly tick = signal<Tick>(0);
  readonly playing = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly world = signal<WorldState | null>(null);

  private newSession(): ReplaySession {
    return new ReplaySession(this.timeline, {
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

  attachPlayer(p: TimelinePlayer): void {
    this.player = p;
    this.tick.set(p.scheduler.tick);
    this.playing.set(p.playing);
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
}
