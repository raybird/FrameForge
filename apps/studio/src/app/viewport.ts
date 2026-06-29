import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { EntityAdapter, SceneAdapter, Stage, TimelinePlayer } from '@frameforge/engine-three';
import { StudioStore } from './studio-store';

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

@Component({
  selector: 'ff-viewport',
  template: `<canvas #canvas class="viewport-canvas" width="800" height="520"></canvas>`,
  styles: [
    `
      :host {
        display: block;
      }
      .viewport-canvas {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 8px;
        background: #0b0b0e;
      }
    `,
  ],
})
export class ViewportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private readonly store = inject(StudioStore);
  private player: TimelinePlayer | null = null;
  private readonly held = new Set<string>();

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const stage = new Stage({ canvas, width: 800, height: 520, background: 0x0b0b0e });
    const adapters = [
      new SceneAdapter(stage.camera),
      new EntityAdapter(stage.scene, this.store.timeline.entities),
    ];
    this.player = new TimelinePlayer(this.store.timeline, stage, adapters, {
      evaluateAt: this.store.evaluateAt,
      onRender: this.store.onRender,
    });
    this.player.mount();
    this.store.attachPlayer(this.player);
  }

  ngOnDestroy(): void {
    this.player?.unmount();
  }

  private direction(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (this.held.has('ArrowLeft')) dx -= 1;
    if (this.held.has('ArrowRight')) dx += 1;
    if (this.held.has('ArrowUp')) dy += 1;
    if (this.held.has('ArrowDown')) dy -= 1;
    return { dx, dy };
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (!ARROWS.includes(e.key)) return;
    e.preventDefault();
    if (this.held.has(e.key)) return; // 忽略 auto-repeat
    this.held.add(e.key);
    const { dx, dy } = this.direction();
    this.store.drive(dx, dy);
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent): void {
    if (!ARROWS.includes(e.key)) return;
    this.held.delete(e.key);
    const { dx, dy } = this.direction();
    this.store.drive(dx, dy);
  }
}
