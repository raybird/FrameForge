/**
 * @frameforge/engine-three
 *
 * 把 WorldState 投影到 Three.js 的 seek adapters，與 render-on-demand 的 Stage / TimelinePlayer。
 * 詳見 docs/ARCHITECTURE.md。
 */

export { Stage } from './stage';
export type { StageOptions } from './stage';

export { defaultObjectFactory } from './object-factory';
export type { ObjectFactory } from './object-factory';

export { EntityAdapter, applyEntityState } from './adapters/entity-adapter';
export { SceneAdapter } from './adapters/scene-adapter';
export type { SceneAdapterOptions } from './adapters/scene-adapter';

export { TimelinePlayer } from './timeline-player';
export type { TimelinePlayerOptions } from './timeline-player';
