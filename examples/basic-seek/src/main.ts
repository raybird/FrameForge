import type { SceneTimeline } from '@frameforge/shared-types';
import { EntityAdapter, SceneAdapter, Stage, TimelinePlayer } from '@frameforge/engine-three';

const TICK_RATE = 60;
const DURATION = 240; // 4 秒

/** 示範時間軸：全部是 AuthoredTrack（純 f(tick)）。 */
const timeline: SceneTimeline = {
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
    { id: 'player', name: 'Player', components: [] },
    {
      id: 'spinner',
      name: 'Spinner',
      components: [{ type: 'Transform', data: { position: { x: 0, y: 0.5, z: -3 } } }],
    },
    {
      id: 'fader',
      name: 'Fader',
      components: [{ type: 'Transform', data: { position: { x: 3.5, y: 0.6, z: 2 } } }],
    },
  ],
  tracks: [
    // player：左右來回 + 上下彈跳（easeInOut）
    {
      id: 'tk_player_pos',
      entityId: 'player',
      kind: 'authored',
      target: 'transform.position',
      keyframes: [
        { tick: 0, value: { x: -4, y: 0, z: 0 }, easing: 'easeInOut' },
        { tick: 60, value: { x: 0, y: 2, z: 0 }, easing: 'easeInOut' },
        { tick: 120, value: { x: 4, y: 0, z: 0 }, easing: 'easeInOut' },
        { tick: 180, value: { x: 0, y: 2, z: 0 }, easing: 'easeInOut' },
        { tick: 240, value: { x: -4, y: 0, z: 0 } },
      ],
    },
    // spinner：繞 y 軸自轉一圈
    {
      id: 'tk_spinner_rot',
      entityId: 'spinner',
      kind: 'authored',
      target: 'transform.rotation',
      keyframes: [
        { tick: 0, value: { x: 0, y: 0, z: 0 } },
        { tick: 240, value: { x: 0, y: Math.PI * 2, z: 0 } },
      ],
    },
    // fader：淡出再淡入
    {
      id: 'tk_fader_op',
      entityId: 'fader',
      kind: 'authored',
      target: 'opacity',
      keyframes: [
        { tick: 0, value: 1, easing: 'easeInOut' },
        { tick: 120, value: 0, easing: 'easeInOut' },
        { tick: 240, value: 1 },
      ],
    },
  ],
  events: [],
};

// ── DOM ──────────────────────────────────────────────
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const playBtn = document.getElementById('play') as HTMLButtonElement;
const speedSel = document.getElementById('speed') as HTMLSelectElement;
const scrubber = document.getElementById('scrubber') as HTMLInputElement;
const timeLabel = document.getElementById('time') as HTMLSpanElement;

scrubber.max = String(DURATION);

// ── Engine ───────────────────────────────────────────
const stage = new Stage({ canvas, width: 800, height: 500, background: 0x0b0b0e });

const player = new TimelinePlayer(
  timeline,
  stage,
  [new SceneAdapter(stage.camera), new EntityAdapter(stage.scene, timeline.entities)],
  {
    onRender: (tick) => {
      scrubber.value = String(tick);
      timeLabel.textContent = `tick ${tick} / ${(tick / TICK_RATE).toFixed(2)}s`;
      syncPlayButton();
    },
  },
);

player.mount();

// ── UI 接線 ──────────────────────────────────────────
function syncPlayButton(): void {
  playBtn.textContent = player.playing ? '⏸ 暫停' : '▶ 播放';
}

playBtn.addEventListener('click', () => {
  if (player.playing) {
    player.pause();
  } else {
    if (player.scheduler.tick >= DURATION) player.seekTick(0); // 播完從頭
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

syncPlayButton();
