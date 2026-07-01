import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Asset } from '@frameforge/shared-types';
import { preloadAssets, type AssetLoaders } from './assets';

function loaders(over: Partial<AssetLoaders> = {}): AssetLoaders {
  return {
    loadTexture: vi.fn(async () => new THREE.Texture()),
    loadModel: vi.fn(async () => new THREE.Object3D()),
    ...over,
  };
}

const A = (id: string, type: Asset['type'], url = '/x'): Asset => ({ id, type, url });

describe('preloadAssets', () => {
  it('png/jpg → 貼圖；gltf/glb → 模型；factoryContext 解析得到', async () => {
    const store = await preloadAssets(
      [A('img', 'png'), A('pic', 'jpg'), A('ship', 'glb'), A('tree', 'gltf')],
      loaders(),
    );
    expect(store.texture('img')).toBeInstanceOf(THREE.Texture);
    expect(store.texture('pic')).toBeInstanceOf(THREE.Texture);
    expect(store.model('ship')).toBeInstanceOf(THREE.Object3D);
    expect(store.model('tree')).toBeInstanceOf(THREE.Object3D);

    const ctx = store.factoryContext();
    expect(ctx.resolveTexture?.('img')).toBe(store.texture('img'));
    expect(ctx.resolveModel?.('ship')).toBe(store.model('ship'));
  });

  it('非圖片/模型型別（mp3/json）不在此載入', async () => {
    const l = loaders();
    const store = await preloadAssets([A('bgm', 'mp3'), A('cfg', 'json')], l);
    expect(l.loadTexture).not.toHaveBeenCalled();
    expect(l.loadModel).not.toHaveBeenCalled();
    expect(store.texture('bgm')).toBeUndefined();
  });

  it('單一 asset 載入失敗 → 記進 failures，不中斷其他', async () => {
    const l = loaders({
      loadTexture: vi.fn(async (url: string) => {
        if (url === '/bad') throw new Error('boom');
        return new THREE.Texture();
      }),
    });
    const store = await preloadAssets([A('ok', 'png', '/good'), A('nope', 'png', '/bad')], l);
    expect(store.texture('ok')).toBeInstanceOf(THREE.Texture);
    expect(store.texture('nope')).toBeUndefined();
    expect(store.failures).toContain('nope');
  });

  it('空 assets → 空 store（決定性 no-op）', async () => {
    const store = await preloadAssets([], loaders());
    expect(store.failures).toHaveLength(0);
    expect(store.texture('x')).toBeUndefined();
  });
});
