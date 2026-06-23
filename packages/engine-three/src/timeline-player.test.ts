import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FrameAdapter, ReplayContext, Seconds } from '@frameforge/shared-types';
import { Stage } from './stage';
import { EntityAdapter } from './adapters/entity-adapter';
import { SceneAdapter } from './adapters/scene-adapter';
import { TimelinePlayer } from './timeline-player';
import { makeTimeline } from './test-fixtures';

describe('TimelinePlayer', () => {
  it('seekTick → 求值 → 投影到 adapters（entity 與 camera 同步）', () => {
    const stage = new Stage(); // 無 canvas：純邏輯，不需 GPU
    const tl = makeTimeline();
    const entityAdapter = new EntityAdapter(stage.scene, tl.entities);
    const player = new TimelinePlayer(tl, stage, [
      new SceneAdapter(stage.camera),
      entityAdapter,
    ]);
    player.mount();

    player.seekTick(30);
    expect(entityAdapter.getObject('player')!.position.x).toBeCloseTo(2);
    expect(stage.camera.position.x).toBeCloseTo(2);

    player.seekTick(0);
    expect(entityAdapter.getObject('player')!.position.x).toBeCloseTo(0);
  });

  it('seekSeconds 與 seekTick 對齊（60Hz：0.5s = tick 30）', () => {
    const stage = new Stage();
    const tl = makeTimeline();
    const entityAdapter = new EntityAdapter(stage.scene, tl.entities);
    const player = new TimelinePlayer(tl, stage, [entityAdapter]);
    player.mount();

    player.seekSeconds(0.5);
    expect(entityAdapter.getObject('player')!.position.x).toBeCloseTo(2);
  });

  it('依 priority 升冪分發（Scene 0 先於 Entity 1）', () => {
    const stage = new Stage();
    const calls: string[] = [];
    const fake = (id: string, priority: number): FrameAdapter => ({
      id,
      priority,
      mount: () => {},
      unmount: () => {},
      update: (_dt: Seconds) => {},
      seek: (_t: Seconds, _r?: ReplayContext) => {
        calls.push(id);
      },
    });
    // 故意以亂序傳入
    const player = new TimelinePlayer(makeTimeline(), stage, [
      fake('entity', 1),
      fake('scene', 0),
    ]);
    player.mount(); // mount 內會 renderAt 一次
    calls.length = 0;
    player.seekTick(10);
    expect(calls).toEqual(['scene', 'entity']);
  });

  it('無 renderer 時 renderAt 不丟錯', () => {
    const stage = new Stage();
    const tl = makeTimeline();
    const player = new TimelinePlayer(tl, stage, [new EntityAdapter(stage.scene, tl.entities)]);
    player.mount();
    expect(() => player.seekTick(45)).not.toThrow();
  });
});
