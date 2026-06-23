/**
 * @frameforge/engine-core
 *
 * 時間調度與決定性求值核心：FrameScheduler、mulberry32 PRNG、Timeline Evaluator。
 * 詳見 docs/ARCHITECTURE.md。
 */

export { Mulberry32 } from './rng/mulberry32';

export { resolveEasing } from './timeline/easing';
export type { EasingFn } from './timeline/easing';
export { lerp, lerpValue } from './timeline/interpolate';
export { sampleTrack } from './timeline/track-sampler';
export { evaluate } from './timeline/evaluator';
export type { EvaluateOptions } from './timeline/evaluator';

export { Scheduler } from './scheduler/scheduler';
export type { SchedulerOptions } from './scheduler/scheduler';
