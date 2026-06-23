import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { EntityState } from '@frameforge/shared-types';
import { evaluate } from '@frameforge/engine-core';
import { EntityAdapter, applyEntityState } from './entity-adapter';
import { makeTimeline } from '../test-fixtures';

describe('EntityAdapter', () => {
  it('mount 為每個 entity 建立 Object3D 並加入場景', () => {
    const scene = new THREE.Scene();
    const tl = makeTimeline();
    const adapter = new EntityAdapter(scene, tl.entities);
    adapter.mount({});
    expect(adapter.getObject('player')).toBeInstanceOf(THREE.Object3D);
    expect(adapter.getObject('camera')).toBeInstanceOf(THREE.Object3D);
    // 場景內含這兩個物件
    expect(scene.children).toContain(adapter.getObject('player'));
  });

  it('seek(world) 把 EntityState 投影到 Object3D（position / opacity）', () => {
    const scene = new THREE.Scene();
    const tl = makeTimeline();
    const adapter = new EntityAdapter(scene, tl.entities);
    adapter.mount({});

    adapter.seek(0.5, { world: evaluate(tl, 30) });

    const player = adapter.getObject('player')!;
    expect(player.position.x).toBeCloseTo(2); // 0→4 的中點
    const mat = (player as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(mat.opacity).toBeCloseTo(0.5);
    expect(mat.transparent).toBe(true);
  });

  it('投影與呼叫歷史無關：30 → 0 → 30 回到同一位置（零漂移）', () => {
    const scene = new THREE.Scene();
    const tl = makeTimeline();
    const adapter = new EntityAdapter(scene, tl.entities);
    adapter.mount({});
    const player = adapter.getObject('player')!;

    adapter.seek(0.5, { world: evaluate(tl, 30) });
    const x30 = player.position.x;
    adapter.seek(0, { world: evaluate(tl, 0) });
    expect(player.position.x).toBeCloseTo(0);
    adapter.seek(0.5, { world: evaluate(tl, 30) });
    expect(player.position.x).toBeCloseTo(x30);
  });

  it('applyEntityState 直接套用 transform / visible', () => {
    const obj = new THREE.Object3D();
    const state: EntityState = {
      id: 'x',
      transform: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        scale: { x: 2, y: 2, z: 2 },
      },
      visible: false,
      opacity: 1,
      components: {},
    };
    applyEntityState(obj, state);
    expect(obj.position.toArray()).toEqual([1, 2, 3]);
    expect(obj.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(obj.scale.toArray()).toEqual([2, 2, 2]);
    expect(obj.visible).toBe(false);
  });

  it('unmount 清空並移出場景', () => {
    const scene = new THREE.Scene();
    const tl = makeTimeline();
    const adapter = new EntityAdapter(scene, tl.entities);
    adapter.mount({});
    adapter.unmount();
    expect(adapter.getObject('player')).toBeUndefined();
    expect(scene.children.some((c) => c.name === 'player')).toBe(false);
  });
});
