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

// Replay（命脈②）
export { ControllerRegistry } from './replay/controller';
export type { Controller, ControllerPhase, ControllerState, StepContext } from './replay/controller';
export { KinematicController } from './replay/kinematic-controller';
export { TriggerController } from './replay/trigger-controller';
export { Simulation, cloneSimState } from './replay/simulation';
export type { SimState } from './replay/simulation';
export { ReplayRecorder, indexEvents } from './replay/replay-log';
export { ReplaySession } from './replay/replay-session';
export type { ReplaySessionOptions } from './replay/replay-session';
