/**
 * SceneAdapter（priority 0）。
 *
 * 場景/攝影機層級的 seek adapter。MVP：若 WorldState 內有一個「攝影機 entity」
 * （預設 id 'camera'），就把它的 transform 套到攝影機——這讓鏡頭運動也能被 timeline
 * 編排與 seek。沒有該 entity 時為 no-op。
 */

import type * as THREE from 'three';
import type {
  FrameAdapter,
  FrameContext,
  ReplayContext,
  Seconds,
} from '@frameforge/shared-types';

export interface SceneAdapterOptions {
  /** 哪個 entity 控制攝影機。預設 'camera'。 */
  cameraEntityId?: string;
}

export class SceneAdapter implements FrameAdapter {
  readonly id = 'scene';
  readonly priority = 0;
  private readonly cameraEntityId: string;

  constructor(
    private readonly camera: THREE.Camera,
    opts: SceneAdapterOptions = {},
  ) {
    this.cameraEntityId = opts.cameraEntityId ?? 'camera';
  }

  mount(_ctx: FrameContext): void {}
  unmount(): void {}
  update(_dt: Seconds): void {}

  seek(_time: Seconds, replay?: ReplayContext): void {
    if (!replay) return;
    const cam = replay.world.entities.find((e) => e.id === this.cameraEntityId);
    if (!cam) return;
    this.camera.position.set(
      cam.transform.position.x,
      cam.transform.position.y,
      cam.transform.position.z,
    );
    this.camera.rotation.set(
      cam.transform.rotation.x,
      cam.transform.rotation.y,
      cam.transform.rotation.z,
    );
  }
}
