import { Component, inject, signal } from '@angular/core';
import { StudioStore } from './studio-store';

@Component({
  selector: 'ff-transport',
  template: `
    <div class="transport">
      <button (click)="store.togglePlay()">{{ store.playing() ? '⏸' : '▶' }}</button>
      <select (change)="onSpeed($event)" title="速度">
        <option value="0.5">0.5×</option>
        <option value="1" selected>1×</option>
        <option value="2">2×</option>
      </select>
      <input
        type="range"
        min="0"
        [max]="store.durationTicks"
        [value]="store.tick()"
        (input)="onSeek($event)"
      />
      <span class="time">tick {{ store.tick() }} / {{ seconds() }}s</span>
      <button (click)="store.reset()" title="清除錄製">⟲ 清除</button>
      <button
        class="export"
        (click)="store.export()"
        [disabled]="store.exporting() || !store.canExport"
        [title]="store.canExport ? '逐幀匯出 MP4' : '此瀏覽器不支援 WebCodecs'"
      >
        {{ store.exporting() ? '匯出中 ' + pct() + '%' : '⬇ 匯出 MP4' }}
      </button>
      <button class="replay-out" (click)="store.exportReplay()" title="匯出互動錄製（可分享、可逐位元重播）">
        ⬇ Replay
      </button>
      <button class="replay-in" (click)="fileInput.click()" title="匯入 Replay 並重播">⬆ Replay</button>
      <input #fileInput type="file" accept="application/json,.json" hidden (change)="onReplayFile($event)" />
      @if (replayStatus()) {
        <span class="replay-status" [class.err]="replayError()">{{ replayStatus() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .transport {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 4px;
      }
      button,
      select {
        background: #1c1c22;
        color: #e6e6ea;
        border: 1px solid #33333a;
        border-radius: 6px;
        padding: 6px 12px;
        cursor: pointer;
      }
      input[type='range'] {
        flex: 1;
      }
      .time {
        font-variant-numeric: tabular-nums;
        min-width: 120px;
        text-align: right;
        opacity: 0.85;
      }
    `,
  ],
})
export class TransportComponent {
  readonly store = inject(StudioStore);
  readonly replayStatus = signal('');
  readonly replayError = signal(false);

  seconds(): string {
    return (this.store.tick() / this.store.tickRate).toFixed(2);
  }

  pct(): number {
    return Math.round(this.store.exportProgress() * 100);
  }

  onSpeed(e: Event): void {
    this.store.setSpeed(Number((e.target as HTMLSelectElement).value));
  }

  onSeek(e: Event): void {
    this.store.seek(Number((e.target as HTMLInputElement).value));
  }

  async onReplayFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // 允許重選同一檔
    if (!file) return;
    const outcome = this.store.importReplay(await file.text());
    this.replayError.set(!outcome.ok);
    this.replayStatus.set(
      outcome.ok ? 'Replay 已匯入 ✓' : '匯入失敗：' + outcome.errors.map((x) => x.message).join('; '),
    );
  }
}
