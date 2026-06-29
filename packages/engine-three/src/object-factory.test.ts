import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Entity } from '@frameforge/shared-types';
import { colorForEntity, defaultObjectFactory } from './object-factory';

describe('colorForEntity', () => {
  it('優先使用 component 的 data.color（number）', () => {
    const e: Entity = {
      id: 'hero',
      name: 'Hero',
      components: [{ type: 'Sprite', data: { color: 0xffd400 } }],
    };
    expect(colorForEntity(e).getHex()).toBe(0xffd400);
  });

  it('支援 CSS 字串顏色', () => {
    const e: Entity = {
      id: 'x',
      name: 'X',
      components: [{ type: 'Sprite', data: { color: 'gold' } }],
    };
    expect(colorForEntity(e).getHex()).toBe(new THREE.Color('gold').getHex());
  });

  it('無指定時退回由 id 衍生的穩定顏色（決定性）', () => {
    const e: Entity = { id: 'box', name: 'Box', components: [] };
    expect(colorForEntity(e).getHex()).toBe(colorForEntity({ ...e }).getHex());
  });
});

describe('defaultObjectFactory', () => {
  it('套用 component 指定的顏色到材質', () => {
    const mesh = defaultObjectFactory({
      id: 'hero',
      name: 'Hero',
      components: [{ type: 'Sprite', data: { color: 0xffd400 } }],
    }) as THREE.Mesh;
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xffd400);
    expect(mesh.name).toBe('hero');
  });
});
