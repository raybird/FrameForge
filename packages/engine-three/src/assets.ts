/**
 * Asset pipeline——決定性地把場景 assets 預載成貼圖 / 模型，供 object-factory 同步解析。
 *
 * 決定性鐵則（見 docs/ARCHITECTURE.md §8）：replay / export 前**強制 preload 全部 asset**，
 * 之後 seek 到任意 t 都同步從 store 讀，永不觸發非同步載入 → 結果與載入快慢無關。
 *
 * loaders 可注入，方便單元測試（Node 無法真的解碼圖片 / 載 gltf）。
 */

import * as THREE from 'three';
import type { Asset } from '@frameforge/shared-types';
import type { ObjectFactoryContext } from './object-factory';

export interface AssetLoaders {
  loadTexture(url: string): Promise<THREE.Texture>;
  loadModel(url: string): Promise<THREE.Object3D>;
}

/** 預設 loaders：TextureLoader；gltf/glb 用 GLTFLoader（延遲載入，避免 Node 測試環境載到 DOM 相依）。 */
export const defaultAssetLoaders: AssetLoaders = {
  loadTexture(url) {
    return new THREE.TextureLoader().loadAsync(url);
  },
  async loadModel(url) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  },
};

const TEXTURE_TYPES = new Set(['png', 'jpg']);
const MODEL_TYPES = new Set(['gltf', 'glb']);

/** 已預載的 asset 集合：同步查詢 + 提供 object-factory 的 resolver context。 */
export class AssetStore {
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly models = new Map<string, THREE.Object3D>();
  private readonly failed: string[] = [];

  texture(id: string): THREE.Texture | undefined {
    return this.textures.get(id);
  }

  model(id: string): THREE.Object3D | undefined {
    return this.models.get(id);
  }

  /** 載入失敗的 assetId（component 會退回純色 / primitive）。 */
  get failures(): readonly string[] {
    return this.failed;
  }

  /** 綁定此 store 的 object-factory context。 */
  factoryContext(): ObjectFactoryContext {
    return {
      resolveTexture: (id) => this.textures.get(id),
      resolveModel: (id) => this.models.get(id),
    };
  }

  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    for (const m of this.models.values()) disposeModel(m);
    this.textures.clear();
    this.models.clear();
  }

  /** @internal 由 preloadAssets 填充。 */
  _setTexture(id: string, t: THREE.Texture): void {
    this.textures.set(id, t);
  }
  /** @internal */
  _setModel(id: string, o: THREE.Object3D): void {
    this.models.set(id, o);
  }
  /** @internal */
  _fail(id: string): void {
    this.failed.push(id);
  }
}

/**
 * 預載全部（可載入的）asset，回傳同步可查的 AssetStore。
 * 單一 asset 載入失敗不會中斷整批（記進 failures，component 退回純色 / primitive）。
 * 非圖片 / 模型型別（svg / lottie / mp3 / wav / json）暫不在此載入。
 */
export async function preloadAssets(
  assets: readonly Asset[],
  loaders: AssetLoaders = defaultAssetLoaders,
): Promise<AssetStore> {
  const store = new AssetStore();
  await Promise.all(
    assets.map(async (a) => {
      try {
        if (TEXTURE_TYPES.has(a.type)) store._setTexture(a.id, await loaders.loadTexture(a.url));
        else if (MODEL_TYPES.has(a.type)) store._setModel(a.id, await loaders.loadModel(a.url));
      } catch {
        store._fail(a.id);
      }
    }),
  );
  return store;
}

function disposeModel(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
}
