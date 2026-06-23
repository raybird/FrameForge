import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
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
});
