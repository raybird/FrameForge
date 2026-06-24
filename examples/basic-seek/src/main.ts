import type { JsonValue, SceneTimeline } from '@frameforge/shared-types';
import {
  ControllerRegistry,
  KinematicController,
  ReplaySession,
} from '@frameforge/engine-core';
import { EntityAdapter, SceneAdapter, Stage, TimelinePlayer } from '@frameforge/engine-three';

const TICK_RATE = 60;
const DURATION = 600; // 10 秒
const SEED = 12345;

/** hero 是 interactive（鍵盤驅動）；spinner/ground 是 authored，與互動同軌共存。 */
function makeTimeline(): SceneTimeline {
  return {
    id: 'basic_seek',
    name: 'Basic Seek',
    tickRate: TICK_RATE,
    durationTicks: DURATION,
    assets: [],
    entities: [
      {
        id: 'ground',
        name: 'Ground',
        components: [
          {
            type: 'Transform',
            data: { position: { x: 0, y: -1.2, z: 0 }, scale: { x: 16, y: 0.3, z: 16 } },
          },
        ],
      },
      {
        id: 'spinner',
        name: 'Spinner',
        components: [{ type: 'Transform', data: { position: { x: -4, y: 0.5, z: -2 } } }],
      },
      { id: 'hero', name: 'Hero', components: [] },
    ],
    tracks: [
      // spinner：authored 自轉
      {
        id: 'tk_spinner_rot',
        entityId: 'spinner',
        kind: 'authored',
        target: 'transform.rotation',
        keyframes: [
          { tick: 0, value: { x: 0, y: 0, z: 0 } },
          { tick: DURATION, value: { x: 0, y: Math.PI * 8, z: 0 } },
        ],
      },
      // hero：interactive，由方向鍵驅動
      {
        id: 'seg_hero',
        entityId: 'hero',
        kind: 'interactive',
        target: 'transform.position',
        startTick: 0,
        endTick: null,
        controller: 'kinematic',
        params: { position: { x: 0, y: 0.5, z: 0 }, speed: 0.1 },
      },
    ],
    events: [],
  };
}

// ── DOM ──────────────────────────────────────────────
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const speedSel = document.getElementById('speed') as HTMLSelectElement;
const scrubber = document.getElementById('scrubber') as HTMLInputElement;
const timeLabel = document.getElementById('time') as HTMLSpanElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;

scrubber.max = String(DURATION);

// ── Engine ───────────────────────────────────────────
const timeline = makeTimeline();
const stage = new Stage({ canvas, width: 800, height: 500, background: 0x0b0b0e });
const registry = new ControllerRegistry().register(KinematicController);

// session 用 let：清除時可重建（evaluateAt 閉包在呼叫時讀最新值）
let session = new ReplaySession(timeline, { registry, seed: SEED, snapshotInterval: 60 });

const player = new TimelinePlayer(
  timeline,
  stage,
  [new SceneAdapter(stage.camera), new EntityAdapter(stage.scene, timeline.entities)],
  {
    evaluateAt: (tick) => session.seek(tick),
    onRender: (tick) => {
      scrubber.value = String(tick);
      timeLabel.textContent = `tick ${tick} / ${(tick / TICK_RATE).toFixed(2)}s`;
      syncPlayButton();
    },
  },
);

player.mount();

// ── 鍵盤輸入 → 即時錄製 ───────────────────────────────
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const held = new Set<string>();

function direction(): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (held.has('ArrowLeft')) dx -= 1;
  if (held.has('ArrowRight')) dx += 1;
  if (held.has('ArrowUp')) dy += 1;
  if (held.has('ArrowDown')) dy -= 1;
  return { dx, dy };
}

/** 在「下一個要模擬的 tick」錄製速度變更事件。 */
function recordMovement(): void {
  const tick = player.scheduler.tick + 1;
  const { dx, dy } = direction();
  const payload: JsonValue = dx === 0 && dy === 0 ? { entityId: 'hero' } : { entityId: 'hero', dx, dy };
  session.recordEvent(tick, dx === 0 && dy === 0 ? 'stop' : 'move', payload);
}

window.addEventListener('keydown', (e) => {
  if (!ARROWS.includes(e.key)) return;
  e.preventDefault();
  if (held.has(e.key)) return; // 忽略系統 auto-repeat
  held.add(e.key);
  if (!player.playing) player.play(); // 首次輸入即開始播放
  recordMovement();
});

window.addEventListener('keyup', (e) => {
  if (!ARROWS.includes(e.key)) return;
  held.delete(e.key);
  recordMovement();
});

// ── UI 接線 ──────────────────────────────────────────
function syncPlayButton(): void {
  playBtn.textContent = player.playing ? '⏸ 暫停' : '▶ 播放';
}

playBtn.addEventListener('click', () => {
  if (player.playing) {
    player.pause();
  } else {
    if (player.scheduler.tick >= DURATION) player.seekTick(0);
    player.play();
  }
  syncPlayButton();
});

speedSel.addEventListener('change', () => {
  player.setSpeed(Number(speedSel.value));
});

scrubber.addEventListener('input', () => {
  if (player.playing) player.pause();
  player.seekTick(Number(scrubber.value));
  syncPlayButton();
});

resetBtn.addEventListener('click', () => {
  player.pause();
  held.clear();
  session = new ReplaySession(timeline, { registry, seed: SEED, snapshotInterval: 60 });
  player.seekTick(0);
  syncPlayButton();
});

syncPlayButton();
