/**
 * 物件工廠：為每個 entity 建立對應的 Three.js Object3D。
 *
 * MVP 用 placeholder 方塊（顏色由 id 衍生，決定性）。
 * 之後可依 entity 的 Sprite / Mesh component 換成貼圖、gltf 等。
 */

import * as THREE from 'three';
import type { Entity } from '@frameforge/shared-types';

export type ObjectFactory = (entity: Entity) => THREE.Object3D;

/** 由 id 衍生穩定顏色（不依賴 Math.random）。 */
function colorForId(id: string): THREE.Color {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  const hue = (((h % 360) + 360) % 360) / 360;
  const c = new THREE.Color();
  c.setHSL(hue, 0.7, 0.6);
  return c;
}

export const defaultObjectFactory: ObjectFactory = (entity) => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: colorForId(entity.id),
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = entity.id;
  return mesh;
};
