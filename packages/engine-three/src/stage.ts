/**
 * Stage：包住 Three.js 的 Scene / Camera / (選用) WebGLRenderer。
 *
 * 關鍵設計：render-on-demand——renderFrame() 不綁 rAF，由外部（TimelinePlayer）
 * 在「求值完一幀」後主動呼叫。這是 seek / 逐幀匯出能成立的前提。
 *
 * 無 canvas 時不建立 WebGLRenderer（供 Node 測試使用，不需 GPU）。
 */

import * as THREE from 'three';

export interface StageOptions {
  /** 提供 canvas 才會建立 WebGLRenderer（瀏覽器）；省略則純邏輯（Node 測試）。 */
  canvas?: HTMLCanvasElement;
  width?: number;
  height?: number;
  background?: number;
}

export class Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer?: THREE.WebGLRenderer;
  /** 供逐幀匯出擷取像素。 */
  readonly canvas?: HTMLCanvasElement;

  constructor(opts: StageOptions = {}) {
    const width = opts.width ?? 800;
    const height = opts.height ?? 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.background ?? 0x101014);

    // 2.5D：透視攝影機，略微俯視。
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 6, 14);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7);
    this.scene.add(ambient, dir);

    if (opts.canvas) {
      this.canvas = opts.canvas;
      this.renderer = new THREE.WebGLRenderer({
        canvas: opts.canvas,
        antialias: true,
        // 逐幀匯出需在 render 後同步讀回像素 → 保留繪圖緩衝。
        preserveDrawingBuffer: true,
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(
        typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      );
    }
  }

  /** render-on-demand：渲染目前 scene 的一幀。無 renderer 時 no-op。 */
  renderFrame(): void {
    this.renderer?.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height, false);
  }

  dispose(): void {
    this.renderer?.dispose();
  }
}
