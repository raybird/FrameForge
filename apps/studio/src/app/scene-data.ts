import type { SceneTimeline } from '@frameforge/shared-types';

export const HERO_ID = 'hero';
export const SEED = 12345;
export const TICK_RATE = 60;
export const DURATION = 600; // 10 秒

/** Studio 預設場景：hero 互動（鍵盤驅動）、spinner authored 自轉、ground 靜態。 */
export function buildTimeline(): SceneTimeline {
  return {
    id: 'studio_demo',
    name: 'Studio Demo',
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
            data: {
              position: { x: 0, y: -1.2, z: 0 },
              scale: { x: 16, y: 0.3, z: 16 },
              color: 0x2e7d32,
            },
          },
        ],
      },
      {
        id: 'spinner',
        name: 'Spinner',
        // Mesh 球體（authored 自轉），展示 render 端吃 Mesh。
        components: [
          { type: 'Transform', data: { position: { x: -4, y: 0.5, z: -2 } } },
          { type: 'Mesh', data: { shape: 'sphere', size: 1.4, color: 0x3a86ff } },
        ],
      },
      {
        id: 'title',
        name: 'Title',
        // Text 圖層（瀏覽器以 canvas 貼圖畫出文字），展示 render 端吃 Text。
        components: [
          { type: 'Transform', data: { position: { x: 0, y: 3.4, z: -3 } } },
          { type: 'Text', data: { content: 'FrameForge', fontSize: 96, color: '#ffffff' } },
        ],
      },
      {
        id: HERO_ID,
        name: 'Hero',
        // Sprite 平面看板，展示 render 端吃 Sprite。
        components: [{ type: 'Sprite', data: { color: 0xffd400, width: 1.2, height: 1.2 } }],
      },
    ],
    tracks: [
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
      {
        id: 'seg_hero',
        entityId: HERO_ID,
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

/**
 * 一段「像 AI 會吐出」的 **authoring 形式** JSON（秒 / 角度 / camera lookAt），供 SceneLoader
 * 的「載入範例」示範完整往返：authoring JSON → loadScene 編譯驗證 → 載入播放。純 authored。
 */
export function exampleTimelineJson(): string {
  const scene = {
    id: 'hello_scene',
    name: 'Hello（authoring form）',
    tickRate: 60,
    durationSeconds: 4,
    assets: [],
    entities: [
      {
        id: 'cam',
        name: 'Camera',
        // 相機用 lookAt 注視原點；載入時自動算出旋轉（不用手算 euler）。
        components: [
          { type: 'Transform', data: { position: { x: 0, y: 6, z: 14 } } },
          { type: 'Camera', data: { projection: 'perspective', fov: 50, lookAt: { x: 0, y: 0, z: 0 } } },
        ],
      },
      {
        id: 'ground',
        name: 'Ground',
        components: [
          {
            type: 'Transform',
            data: { position: { x: 0, y: -1.2, z: 0 }, scale: { x: 14, y: 0.3, z: 14 }, color: 0x394a2f },
          },
        ],
      },
      {
        id: 'orb',
        name: 'Orb',
        components: [
          { type: 'Transform', data: { position: { x: -3, y: 0.6, z: 0 } } },
          { type: 'Mesh', data: { shape: 'sphere', size: 1.2, color: 0x39d98a } },
        ],
      },
      {
        id: 'label',
        name: 'Label',
        components: [
          { type: 'Transform', data: { position: { x: 0, y: 3, z: -2 } } },
          { type: 'Text', data: { content: 'authoring form', fontSize: 72, color: '#39d98a' } },
        ],
      },
    ],
    tracks: [
      {
        id: 'tk_orb_x',
        entityId: 'orb',
        kind: 'authored',
        target: 'transform.position',
        keyframes: [
          { atSeconds: 0, value: { x: -3, y: 0.6, z: 0 } },
          { atSeconds: 2, value: { x: 3, y: 0.6, z: 0 }, easing: 'easeInOut' },
          { atSeconds: 4, value: { x: -3, y: 0.6, z: 0 }, easing: 'easeInOut' },
        ],
      },
      {
        id: 'tk_orb_spin',
        entityId: 'orb',
        kind: 'authored',
        target: 'transform.rotation',
        // 旋轉用「角度」：一圈 = 360 度（載入時換算弧度）。
        keyframes: [
          { atSeconds: 0, value: { x: 0, y: 0, z: 0 } },
          { atSeconds: 4, value: { x: 0, y: 360, z: 0 } },
        ],
      },
    ],
    events: [],
  };
  return JSON.stringify(scene, null, 2);
}
