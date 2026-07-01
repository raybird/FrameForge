import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Entity } from '@frameforge/shared-types';
import { colorForEntity, createObjectFactory, defaultObjectFactory } from './object-factory';

function entity(components: Entity['components'], id = 'e'): Entity {
  return { id, name: id, components };
}

describe('colorForEntity', () => {
  it('優先使用 component 的 data.color（number）', () => {
    const e = entity([{ type: 'Sprite', data: { color: 0xffd400 } }], 'hero');
    expect(colorForEntity(e).getHex()).toBe(0xffd400);
  });

  it('支援 CSS 字串顏色', () => {
    const e = entity([{ type: 'Sprite', data: { color: 'gold' } }], 'x');
    expect(colorForEntity(e).getHex()).toBe(new THREE.Color('gold').getHex());
  });

  it('無指定時退回由 id 衍生的穩定顏色（決定性）', () => {
    const e = entity([], 'box');
    expect(colorForEntity(e).getHex()).toBe(colorForEntity({ ...e }).getHex());
  });
});

describe('defaultObjectFactory — 依 component 型別建立物件', () => {
  it('Camera 不進場景（回傳 null）', () => {
    expect(defaultObjectFactory(entity([{ type: 'Camera', data: { fov: 50 } }], 'cam'))).toBeNull();
  });

  it('Mesh：sphere → SphereGeometry', () => {
    const obj = defaultObjectFactory(entity([{ type: 'Mesh', data: { shape: 'sphere', size: 2 } }])) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('Mesh：box → BoxGeometry（預設 shape）', () => {
    const obj = defaultObjectFactory(entity([{ type: 'Mesh', data: {} }])) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.BoxGeometry);
  });

  it('Sprite → PlaneGeometry，顏色套到材質', () => {
    const obj = defaultObjectFactory(entity([{ type: 'Sprite', data: { color: 0xffd400 } }], 'hero')) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect((obj.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xffd400);
    expect(obj.name).toBe('hero');
  });

  it('Text → PlaneGeometry（Node 無 canvas 時退回純色平面，不丟例外）', () => {
    const obj = defaultObjectFactory(entity([{ type: 'Text', data: { content: 'FrameForge' } }], 'title')) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(obj.name).toBe('title');
  });

  it('僅 Transform / 未知 → 保留 placeholder 方塊', () => {
    const obj = defaultObjectFactory(entity([{ type: 'Transform', data: { color: 0x2e7d32 } }], 'ground')) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect((obj.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x2e7d32);
  });

  it('Mesh 優先於同時存在的 Collider（Collider 非視覺）', () => {
    const obj = defaultObjectFactory(
      entity([
        { type: 'Collider', data: { shape: 'box', isTrigger: true } },
        { type: 'Mesh', data: { shape: 'sphere' } },
      ]),
    ) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });
});

describe('createObjectFactory — asset resolver hook', () => {
  it('Sprite 有 assetId 且 resolveTexture 命中 → 貼圖並轉白底', () => {
    const texture = new THREE.Texture();
    const factory = createObjectFactory({ resolveTexture: (id) => (id === 'hero_png' ? texture : undefined) });
    const obj = factory(entity([{ type: 'Sprite', data: { assetId: 'hero_png', color: 0xff0000 } }])) as THREE.Mesh;
    const mat = obj.material as THREE.MeshBasicMaterial;
    expect(mat.map).toBe(texture);
    expect(mat.color.getHex()).toBe(0xffffff);
  });

  it('Mesh 有 assetId 且 resolveModel 命中 → clone 模型（非 primitive box）', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial()));
    const factory = createObjectFactory({ resolveModel: (id) => (id === 'ship' ? root : undefined) });
    const obj = factory(entity([{ type: 'Mesh', data: { assetId: 'ship' } }], 'm')) as THREE.Object3D;
    expect(obj).not.toBe(root); // 是 clone
    expect(obj.children).toHaveLength(1);
    expect(obj.name).toBe('m');
    expect((obj as THREE.Mesh).geometry).toBeUndefined(); // Group，非 primitive mesh
  });

  it('Mesh 有 assetId 但 resolveModel 未命中 → 退回 primitive 幾何', () => {
    const factory = createObjectFactory({ resolveModel: () => undefined });
    const obj = factory(entity([{ type: 'Mesh', data: { assetId: 'missing', shape: 'sphere' } }])) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });
});
