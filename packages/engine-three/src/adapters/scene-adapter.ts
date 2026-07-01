/**
 * SceneAdapter（priority 0）。
 *
 * 場景/攝影機層級的 seek adapter。找出「攝影機 entity」後把它的 transform 套到攝影機，
 * 讓鏡頭運動也能被 timeline 編排與 seek：
 *   - 優先選帶有 Camera component 的 entity（第一公民）；並套用其 fov / near / far。
 *   - 退回預設 id（'camera'）以相容純 transform 的鏡頭 entity。
 * 都找不到時為 no-op。
 *
 * 註：Stage 目前用 PerspectiveCamera；Camera.projection='orthographic' 尚未換相機型別。
 */

import * as THREE from 'three';
import type {
  EntityState,
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
    const cam = this.findCamera(replay.world.entities);
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

    this.applyCameraParams(cam.components['Camera']?.data);
  }

  /** 優先帶 Camera component 的 entity；否則退回 id。 */
  private findCamera(entities: EntityState[]): EntityState | undefined {
    return (
      entities.find((e) => e.components['Camera']) ??
      entities.find((e) => e.id === this.cameraEntityId)
    );
  }

  /** 把 Camera component 的內在參數套到透視相機（可被 track 動畫化）。 */
  private applyCameraParams(data: Record<string, unknown> | undefined): void {
    if (!data || !(this.camera instanceof THREE.PerspectiveCamera)) return;
    let changed = false;
    if (typeof data.fov === 'number') {
      this.camera.fov = data.fov;
      changed = true;
    }
    if (typeof data.near === 'number') {
      this.camera.near = data.near;
      changed = true;
    }
    if (typeof data.far === 'number') {
      this.camera.far = data.far;
      changed = true;
    }
    if (changed) this.camera.updateProjectionMatrix();
  }
}
