/**
 * validateTimeline——AI 生成 timeline 的守門員。
 *
 * 兩層檢查：
 *   1. 結構（交給 zod）：型別、必填、範圍、component data 契約。
 *   2. 交叉引用（zod 無法單筆判斷）：id 唯一、entityId/assetId 存在、
 *      keyframe 有序且在界內、interactive 區段界限、controller 名合法。
 *
 * 回傳的 errors 是「人可讀、且可直接回餵給 LLM 自我修正」的字串陣列——
 * 這正是 P5 閉環（生成 → 驗證 → 修正）所需。
 */

import { sceneTimeline, type SceneTimeline } from './timeline';

/** runtime 目前實作的 controller。未知 controller 會讓互動片段跑不起來，故視為錯誤。 */
export const KNOWN_CONTROLLERS = ['kinematic', 'trigger'] as const;

export interface ValidationError {
  /** 例：'entities[0].components[1].data.content'。 */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; timeline: SceneTimeline }
  | { ok: false; errors: ValidationError[] };

export interface ValidateOptions {
  /** 覆寫 / 擴充已知 controller 清單（例：接了 stateMachine 之後）。 */
  controllers?: readonly string[];
}

export function validateTimeline(input: unknown, opts: ValidateOptions = {}): ValidationResult {
  const parsed = sceneTimeline.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(zodIssueToError) };
  }

  const t = parsed.data;
  const errors: ValidationError[] = [];
  const controllers = new Set(opts.controllers ?? KNOWN_CONTROLLERS);

  checkUniqueIds(t, errors);
  checkTrackReferences(t, controllers, errors);
  checkControllerParams(t, errors);
  checkAssetReferences(t, errors);
  checkTrackTiming(t, errors);
  checkEventTiming(t, errors);

  return errors.length === 0 ? { ok: true, timeline: t } : { ok: false, errors };
}

/** 把 errors 攤成一段可貼給 LLM 的文字。 */
export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `- ${e.path}: ${e.message}`).join('\n');
}

// ─────────────────────────────────────────────────────────────
// 交叉引用檢查
// ─────────────────────────────────────────────────────────────

function checkUniqueIds(t: SceneTimeline, errors: ValidationError[]): void {
  reportDuplicates(
    t.entities.map((e, i) => [e.id, `entities[${i}].id`] as const),
    'entity id 重複',
    errors,
  );
  reportDuplicates(
    t.assets.map((a, i) => [a.id, `assets[${i}].id`] as const),
    'asset id 重複',
    errors,
  );
  reportDuplicates(
    t.tracks.map((tr, i) => [tr.id, `tracks[${i}].id`] as const),
    'track id 重複',
    errors,
  );
}

function checkTrackReferences(
  t: SceneTimeline,
  controllers: Set<string>,
  errors: ValidationError[],
): void {
  const entityIds = new Set(t.entities.map((e) => e.id));
  t.tracks.forEach((tr, i) => {
    if (!entityIds.has(tr.entityId)) {
      errors.push({
        path: `tracks[${i}].entityId`,
        message: `參照不存在的 entity '${tr.entityId}'`,
      });
    }
    if (tr.kind === 'interactive' && !controllers.has(tr.controller)) {
      errors.push({
        path: `tracks[${i}].controller`,
        message: `未知的 controller '${tr.controller}'（已知：${[...controllers].join(', ')}）`,
      });
    }
  });
}

/** controller 專屬 params 檢查（目前：trigger 的區域與揭露目標）。 */
function checkControllerParams(t: SceneTimeline, errors: ValidationError[]): void {
  const entityIds = new Set(t.entities.map((e) => e.id));
  t.tracks.forEach((tr, i) => {
    if (tr.kind !== 'interactive' || tr.controller !== 'trigger') return;
    const p = tr.params;
    const base = `tracks[${i}].params`;

    if (typeof p.target !== 'string') {
      errors.push({ path: `${base}.target`, message: 'trigger 需要 target（要偵測的 entity id）' });
    } else if (!entityIds.has(p.target)) {
      errors.push({ path: `${base}.target`, message: `trigger.target 參照不存在的 entity '${p.target}'` });
    }

    if ('reveal' in p) {
      if (typeof p.reveal !== 'string' || !entityIds.has(p.reveal)) {
        errors.push({
          path: `${base}.reveal`,
          message: `trigger.reveal 參照不存在的 entity '${String(p.reveal)}'`,
        });
      }
    }

    for (const key of ['center', 'size'] as const) {
      if (!isVec3(p[key])) {
        errors.push({ path: `${base}.${key}`, message: `trigger 需要 ${key}: { x, y, z }（數字）` });
      }
    }

    if ('latch' in p && typeof p.latch !== 'boolean') {
      errors.push({ path: `${base}.latch`, message: 'latch 需為布林值' });
    }
  });
}

function isVec3(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).x === 'number' &&
    typeof (v as Record<string, unknown>).y === 'number' &&
    typeof (v as Record<string, unknown>).z === 'number'
  );
}

function checkAssetReferences(t: SceneTimeline, errors: ValidationError[]): void {
  const assetIds = new Set(t.assets.map((a) => a.id));
  t.entities.forEach((e, ei) => {
    e.components.forEach((c, ci) => {
      const ref = 'assetId' in c.data ? c.data.assetId : undefined;
      if (typeof ref === 'string' && !assetIds.has(ref)) {
        errors.push({
          path: `entities[${ei}].components[${ci}].data.assetId`,
          message: `參照不存在的 asset '${ref}'`,
        });
      }
    });
  });
}

function checkTrackTiming(t: SceneTimeline, errors: ValidationError[]): void {
  t.tracks.forEach((tr, i) => {
    if (tr.kind === 'authored') {
      let prev = -1;
      tr.keyframes.forEach((kf, ki) => {
        const at = `tracks[${i}].keyframes[${ki}].tick`;
        if (kf.tick > t.durationTicks) {
          errors.push({ path: at, message: `tick ${kf.tick} 超出 durationTicks ${t.durationTicks}` });
        }
        if (kf.tick <= prev) {
          errors.push({ path: at, message: `keyframe tick 必須嚴格遞增（前一個是 ${prev}）` });
        }
        prev = kf.tick;
      });
    } else {
      if (tr.startTick > t.durationTicks) {
        errors.push({
          path: `tracks[${i}].startTick`,
          message: `startTick ${tr.startTick} 超出 durationTicks ${t.durationTicks}`,
        });
      }
      if (tr.endTick !== null) {
        if (tr.endTick > t.durationTicks) {
          errors.push({
            path: `tracks[${i}].endTick`,
            message: `endTick ${tr.endTick} 超出 durationTicks ${t.durationTicks}`,
          });
        }
        if (tr.endTick < tr.startTick) {
          errors.push({
            path: `tracks[${i}].endTick`,
            message: `endTick ${tr.endTick} 不可小於 startTick ${tr.startTick}`,
          });
        }
      }
    }
  });
}

function checkEventTiming(t: SceneTimeline, errors: ValidationError[]): void {
  t.events.forEach((ev, i) => {
    if (ev.tick > t.durationTicks) {
      errors.push({
        path: `events[${i}].tick`,
        message: `tick ${ev.tick} 超出 durationTicks ${t.durationTicks}`,
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────

function reportDuplicates(
  entries: ReadonlyArray<readonly [string, string]>,
  message: string,
  errors: ValidationError[],
): void {
  const seen = new Map<string, string>();
  for (const [value, path] of entries) {
    const first = seen.get(value);
    if (first) errors.push({ path, message: `${message}：'${value}'（首次見於 ${first}）` });
    else seen.set(value, path);
  }
}

function zodIssueToError(issue: {
  readonly path: ReadonlyArray<PropertyKey>;
  readonly message: string;
}): ValidationError {
  return { path: pathToString(issue.path), message: issue.message };
}

function pathToString(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out === '' ? String(seg) : `.${String(seg)}`;
  }
  return out === '' ? '(root)' : out;
}
