import { Component, computed, inject } from '@angular/core';
import type { Vec3 } from '@frameforge/shared-types';
import { StudioStore } from './studio-store';

@Component({
  selector: 'ff-inspector',
  template: `
    <div class="panel">
      <h2>Inspector</h2>
      @if (selected(); as s) {
        <div class="row"><span>id</span><b>{{ s.id }}</b></div>
        <div class="row"><span>position</span><b>{{ fmt(s.transform.position) }}</b></div>
        <div class="row"><span>rotation.y</span><b>{{ s.transform.rotation.y.toFixed(3) }}</b></div>
        <div class="row"><span>scale</span><b>{{ fmt(s.transform.scale) }}</b></div>
        <div class="row"><span>visible</span><b>{{ s.visible }}</b></div>
        <div class="row"><span>opacity</span><b>{{ s.opacity.toFixed(2) }}</b></div>
      } @else {
        <p class="muted">點選左側 entity 檢視屬性（屬性值隨時間軸即時更新）。</p>
      }
    </div>
  `,
  styles: [
    `
      .row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 8px;
        font-size: 13px;
      }
      .row span {
        opacity: 0.6;
      }
      .row b {
        font-variant-numeric: tabular-nums;
      }
      .muted {
        opacity: 0.5;
        font-size: 13px;
        padding: 0 8px;
      }
    `,
  ],
})
export class InspectorComponent {
  readonly store = inject(StudioStore);

  readonly selected = computed(() => {
    const id = this.store.selectedId();
    const world = this.store.world();
    if (!id || !world) return null;
    return world.entities.find((e) => e.id === id) ?? null;
  });

  fmt(v: Vec3): string {
    return `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
  }
}
