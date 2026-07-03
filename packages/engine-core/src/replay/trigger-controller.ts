/**
 * TriggerController：觸發體積（sensor 階段）。
 *
 * 每 tick 讀 target 實體「本 tick 的位置」，判斷是否進入一個 box 區域。
 * 進入時可揭露（reveal）某個 authored 實體（開門 / 顯示字幕 / 亮燈）並寫入 vars。
 *
 * params:
 *   - target : 要偵測的實體 id（通常是 hero）
 *   - center : { x, y, z } 區域中心
 *   - size   : { x, y, z } 區域尺寸（全寬）
 *   - reveal : 進入時要顯示的實體 id（選配）
 *   - latch  : 進入後是否鎖定為「已觸發」（預設 true；false 則離開即復原）
 *
 * 決定性：inside/entered/enteredTick 全在 state → 進 snapshot；不使用 RNG。
 */

import type { JsonValue, Vec3 } from '@frameforge/shared-types';
import type { Controller, ControllerState } from './controller';

function n(v: JsonValue | undefined): number {
  return typeof v === 'number' ? v : 0;
}

function readVec3(v: JsonValue | undefined): Vec3 {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return { x: n(v.x), y: n(v.y), z: n(v.z) };
  }
  return { x: 0, y: 0, z: 0 };
}

function inBox(p: Vec3, center: Vec3, size: Vec3): boolean {
  return (
    Math.abs(p.x - center.x) <= size.x / 2 &&
    Math.abs(p.y - center.y) <= size.y / 2 &&
    Math.abs(p.z - center.z) <= size.z / 2
  );
}

export const TriggerController: Controller = {
  id: 'trigger',
  phase: 'sensor',

  init() {
    return { inside: false, entered: false, enteredTick: null };
  },

  step(ctx) {
    const params = ctx.segment.params;
    const target = typeof params.target === 'string' ? params.target : '';
    const center = readVec3(params.center);
    const size = readVec3(params.size);
    const latch = params.latch !== false;

    let entered = ctx.state.entered === true;
    let enteredTick = typeof ctx.state.enteredTick === 'number' ? ctx.state.enteredTick : null;

    const pos = ctx.readPos(target);
    const now = pos ? inBox(pos, center, size) : false;
    if (now && !entered) {
      entered = true;
      enteredTick = ctx.tick;
    }

    const inside = latch ? entered : now;
    return { inside, entered, enteredTick };
  },

  project(state, segment, world) {
    const inside = state.inside === true;
    world.vars[`trigger:${segment.id}`] = inside;

    const reveal = typeof segment.params.reveal === 'string' ? segment.params.reveal : null;
    if (reveal && inside) {
      const es = world.entities.find((e) => e.id === reveal);
      if (es) {
        es.visible = true;
        es.opacity = 1;
      }
    }
  },
};
