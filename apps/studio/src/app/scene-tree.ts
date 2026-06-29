import { Component, inject } from '@angular/core';
import { StudioStore } from './studio-store';

@Component({
  selector: 'ff-scene-tree',
  template: `
    <div class="panel">
      <h2>Scene</h2>
      <ul class="tree">
        @for (e of entities; track e.id) {
          <li [class.selected]="store.selectedId() === e.id" (click)="store.select(e.id)">
            <span class="name">{{ e.name }}</span>
            <span class="id">{{ e.id }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      .tree {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .tree li {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
      }
      .tree li:hover {
        background: #1c1c22;
      }
      .tree li.selected {
        background: #26303f;
      }
      .name {
        font-weight: 600;
      }
      .id {
        font-size: 11px;
        opacity: 0.5;
      }
    `,
  ],
})
export class SceneTreeComponent {
  readonly store = inject(StudioStore);
  readonly entities = this.store.timeline.entities;
}
