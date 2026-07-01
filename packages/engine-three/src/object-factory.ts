/**
 * 物件工廠：依 entity 的 component 型別建立對應的 Three.js Object3D。
 *
 * 對照 docs/ARCHITECTURE.md §5 的 component 語意：
 *   - Mesh   → 3D primitive（box / plane / sphere），受光。
 *   - Sprite → 2.5D 平面看板（可貼圖），不受光。
 *   - Text   → 以 canvas 貼圖畫出的文字平面（瀏覽器）；無 document 時退回純色平面。
 *   - Camera → 不進場景（回傳 null），由 SceneAdapter 驅動 Stage.camera。
 *   - 其餘（僅 Transform / 未知）→ 保留原本的 placeholder 方塊。
 *
 * 尺寸策略：Sprite/Text/Mesh 的大小烘進 geometry，讓 EntityState.transform.scale
 * 仍能在其上相乘而不被覆寫。
 *
 * 貼圖：真正載入 asset 需要 asset pipeline（尚未有）。這裡開一個 resolveTexture hook，
 * 有提供才貼圖，否則以顏色呈現——決定性且離線可跑。
 */

import * as THREE from 'three';
import type { ComponentDef, Entity, JsonValue } from '@frameforge/shared-types';

export interface ObjectFactoryContext {
  /** 由 assetId 取得已載入貼圖。無 asset pipeline 時可不提供 → Sprite 退回純色。 */
  resolveTexture?: (assetId: string) => THREE.Texture | undefined;
}

/** 回傳 null 代表「此 entity 不在場景樹上」（例：Camera）。 */
export type ObjectFactory = (entity: Entity) => THREE.Object3D | null;

/** 決定 entity 視覺呈現的 component 優先序（高 → 低）。 */
const VISUAL_PRECEDENCE = ['Camera', 'Mesh', 'Sprite', 'Text'] as const;

// ─────────────────────────────────────────────────────────────
// 顏色
// ─────────────────────────────────────────────────────────────

/** 由 id 衍生穩定顏色（不依賴 Math.random）。 */
function colorForId(id: string): THREE.Color {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  const hue = (((h % 360) + 360) % 360) / 360;
  const c = new THREE.Color();
  c.setHSL(hue, 0.7, 0.6);
  return c;
}

/**
 * 顏色解析優先序：
 *   1. 任一 component 的 data.color（number 如 0xffd400，或 CSS 字串如 'gold'）
 *   2. 退回由 id 雜湊的穩定顏色
 */
export function colorForEntity(entity: Entity): THREE.Color {
  for (const c of entity.components) {
    const col = c.data.color;
    if (typeof col === 'number' || typeof col === 'string') return new THREE.Color(col);
  }
  return colorForId(entity.id);
}

// ─────────────────────────────────────────────────────────────
// 工廠
// ─────────────────────────────────────────────────────────────

/** 建立一個依 context（貼圖解析…）行為的工廠。 */
export function createObjectFactory(ctx: ObjectFactoryContext = {}): ObjectFactory {
  return (entity) => {
    const obj = build(entity, ctx);
    if (obj) obj.name = entity.id;
    return obj;
  };
}

/** 開箱即用的預設工廠（無貼圖）。 */
export const defaultObjectFactory: ObjectFactory = createObjectFactory();

function build(entity: Entity, ctx: ObjectFactoryContext): THREE.Object3D | null {
  switch (primaryVisualType(entity)) {
    case 'Camera':
      return null;
    case 'Mesh':
      return buildMesh(entity);
    case 'Sprite':
      return buildSprite(entity, ctx);
    case 'Text':
      return buildText(entity);
    default:
      return buildFallbackBox(entity);
  }
}

function primaryVisualType(entity: Entity): (typeof VISUAL_PRECEDENCE)[number] | null {
  for (const t of VISUAL_PRECEDENCE) {
    if (entity.components.some((c) => c.type === t)) return t;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 各型別
// ─────────────────────────────────────────────────────────────

function buildMesh(entity: Entity): THREE.Mesh {
  const data = dataOf(entity, 'Mesh');
  const shape = str(data.shape, 'box');
  const size = num(data.size, 1);
  const geometry =
    shape === 'sphere'
      ? new THREE.SphereGeometry(size / 2, 24, 16)
      : shape === 'plane'
        ? new THREE.PlaneGeometry(size, size)
        : new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color: colorForEntity(entity),
    transparent: true,
    side: shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
  });
  return new THREE.Mesh(geometry, material);
}

function buildSprite(entity: Entity, ctx: ObjectFactoryContext): THREE.Mesh {
  const data = dataOf(entity, 'Sprite');
  const width = num(data.width, 1);
  const height = num(data.height, 1);
  const material = new THREE.MeshBasicMaterial({
    color: colorForEntity(entity),
    transparent: true,
    side: THREE.DoubleSide,
  });
  const assetId = str(data.assetId, '');
  const tex = assetId ? ctx.resolveTexture?.(assetId) : undefined;
  if (tex) {
    material.map = tex;
    material.color.set(0xffffff); // 有貼圖時不再以顏色染色
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function buildText(entity: Entity): THREE.Mesh {
  const data = dataOf(entity, 'Text');
  const content = str(data.content, '');
  const fontSize = num(data.fontSize, 64);
  const font = str(data.font, 'sans-serif');
  const built = makeTextTexture(content, {
    fontSize,
    font,
    color: cssColor(colorForEntity(entity)),
  });

  const height = 1;
  const aspect = built?.aspect ?? Math.max(1, content.length * 0.5);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    side: THREE.DoubleSide,
  });
  if (built) material.map = built.texture;
  else material.color.copy(colorForEntity(entity)); // 無 canvas（Node）：退回純色平面
  return new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), material);
}

function buildFallbackBox(entity: Entity): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: colorForEntity(entity),
    transparent: true,
  });
  return new THREE.Mesh(geometry, material);
}

// ─────────────────────────────────────────────────────────────
// Text → canvas 貼圖（僅瀏覽器；Node 無 document 時回傳 null）
// ─────────────────────────────────────────────────────────────

interface TextTexture {
  texture: THREE.Texture;
  aspect: number;
}

function makeTextTexture(
  text: string,
  opts: { fontSize: number; font: string; color: string },
): TextTexture | null {
  if (typeof document === 'undefined' || !text) return null;
  const canvas = document.createElement('canvas');
  const cx = canvas.getContext('2d');
  if (!cx) return null;

  const fontSpec = `${opts.fontSize}px ${opts.font}`;
  cx.font = fontSpec;
  const pad = Math.round(opts.fontSize * 0.3);
  const width = Math.ceil(cx.measureText(text).width) + pad * 2;
  const height = opts.fontSize + pad * 2;
  canvas.width = width;
  canvas.height = height;

  // resize 會重置 context 狀態，需重設 font。
  cx.font = fontSpec;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = opts.color;
  cx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return { texture, aspect: width / height };
}

// ─────────────────────────────────────────────────────────────
// 小工具
// ─────────────────────────────────────────────────────────────

function dataOf(entity: Entity, type: ComponentDef['type']): Record<string, JsonValue> {
  return entity.components.find((c) => c.type === type)?.data ?? {};
}

function num(v: JsonValue | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}

function str(v: JsonValue | undefined, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function cssColor(c: THREE.Color): string {
  return `#${c.getHexString()}`;
}
