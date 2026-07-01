import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { WorldState } from '@frameforge/shared-types';
import { evaluate } from '@frameforge/engine-core';
import { SceneAdapter } from './scene-adapter';
import { makeTimeline } from '../test-fixtures';

describe('SceneAdapter', () => {
  it('用 camera entity 的 transform 驅動攝影機', () => {
    const camera = new THREE.PerspectiveCamera();
    const adapter = new SceneAdapter(camera);
    const tl = makeTimeline();
    adapter.seek(1, { world: evaluate(tl, 60) });
    expect(camera.position.x).toBeCloseTo(4); // camera track 終點
    expect(camera.position.z).toBeCloseTo(14);
  });

  it('沒有 camera entity 時為 no-op', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(9, 9, 9);
    const adapter = new SceneAdapter(camera, { cameraEntityId: 'nonexistent' });
    adapter.seek(1, { world: evaluate(makeTimeline(), 60) });
    expect(camera.position.toArray()).toEqual([9, 9, 9]);
  });

  it('優先用帶 Camera component 的 entity，並套用 fov / near / far', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const adapter = new SceneAdapter(camera); // 未指定 id，靠 Camera component 找到
    const world: WorldState = {
      tick: 0,
      rng: 0,
      vars: {},
      entities: [
        {
          id: 'main-cam',
          transform: {
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          visible: true,
          opacity: 1,
          components: { Camera: { type: 'Camera', data: { fov: 35, near: 0.5, far: 500 } } },
        },
      ],
    };
    adapter.seek(0, { world });
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    expect(camera.fov).toBe(35);
    expect(camera.near).toBe(0.5);
    expect(camera.far).toBe(500);
  });
});
