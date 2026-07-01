/**
 * EntityAdapter（priority 1，對應 CharacterAdapter 的泛化）。
 *
 * HyperFrames 式 seek adapter：mount 時為每個 entity 建立 Object3D，
 * seek(world) 時把 EntityState 投影到對應 Object3D（transform / visible / opacity）。
 * 它不模擬、不持有時間狀態——只是「把 t 的世界畫出來」。
 */

import * as THREE from 'three';
import type {
  Entity,
  EntityState,
  FrameAdapter,
  FrameContext,
  ReplayContext,
  Seconds,
} from '@frameforge/shared-types';
import { defaultObjectFactory, type ObjectFactory } from '../object-factory';

export class EntityAdapter implements FrameAdapter {
  readonly id = 'entity';
  readonly priority = 1;

  private readonly objects = new Map<string, THREE.Object3D>();

  constructor(
    private readonly root: THREE.Object3D,
    private readonly entities: Entity[],
    private readonly factory: ObjectFactory = defaultObjectFactory,
  ) {}

  mount(_ctx: FrameContext): void {
    for (const entity of this.entities) {
      const obj = this.factory(entity);
      if (!obj) continue; // null = 不進場景（例：Camera 由 SceneAdapter 驅動）
      this.objects.set(entity.id, obj);
      this.root.add(obj);
    }
  }

  unmount(): void {
    for (const obj of this.objects.values()) {
      this.root.remove(obj);
      disposeObject(obj);
    }
    this.objects.clear();
  }

  update(_dt: Seconds): void {
    // realtime 推進統一由 TimelinePlayer 走 seek(world)；此處無狀態。
  }

  seek(_time: Seconds, replay?: ReplayContext): void {
    if (!replay) return;
    for (const state of replay.world.entities) {
      const obj = this.objects.get(state.id);
      if (obj) applyEntityState(obj, state);
    }
  }

  /** 測試/偵錯用。 */
  getObject(id: string): THREE.Object3D | undefined {
    return this.objects.get(id);
  }
}

/** 把單一 EntityState 投影到 Object3D。匯出以便獨立測試。 */
export function applyEntityState(obj: THREE.Object3D, s: EntityState): void {
  obj.position.set(s.transform.position.x, s.transform.position.y, s.transform.position.z);
  obj.rotation.set(s.transform.rotation.x, s.transform.rotation.y, s.transform.rotation.z);
  obj.scale.set(s.transform.scale.x, s.transform.scale.y, s.transform.scale.z);
  obj.visible = s.visible;
  applyOpacity(obj, s.opacity);
}

function applyOpacity(obj: THREE.Object3D, opacity: number): void {
  const material = (obj as THREE.Mesh).material;
  if (!material) return;
  const mats = Array.isArray(material) ? material : [material];
  for (const m of mats) {
    m.transparent = opacity < 1;
    (m as THREE.Material & { opacity: number }).opacity = opacity;
    m.needsUpdate = true;
  }
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      (m as THREE.MeshBasicMaterial).map?.dispose(); // canvas / 貼圖
      m.dispose();
    }
  });
}
