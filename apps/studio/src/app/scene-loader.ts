import { Component, inject, signal } from '@angular/core';
import type { ValidationError } from '@frameforge/scene-schema';
import { LoadOutcome, StudioStore } from './studio-store';
import { exampleTimelineJson } from './scene-data';

/**
 * SceneLoader：把一段 timeline JSON（貼上 / 檔案 / 範例）經 scene-schema 驗證後載入。
 * 這是 P5「AI 生成 → 驗證 → 播放」閉環在 Studio 端的入口；驗證失敗會列出可回餵 LLM 的錯誤。
 */
@Component({
  selector: 'ff-scene-loader',
  template: `
    <div class="panel loader">
      <h2>載入場景</h2>
      <textarea
        [value]="text()"
        (input)="text.set(value($event))"
        rows="6"
        spellcheck="false"
        placeholder="貼上 timeline JSON…"
      ></textarea>
      <div class="btns">
        <button (click)="load()" [disabled]="!text().trim()">驗證並載入</button>
        <button (click)="loadExample()">載入範例</button>
        <button (click)="reset()">還原 demo</button>
      </div>
      <label class="file">
        或選檔：<input type="file" accept="application/json,.json" (change)="onFile($event)" />
      </label>
      @if (status(); as s) {
        <p class="status" [class.err]="!s.ok">{{ s.message }}</p>
      }
      @if (errors().length) {
        <ul class="errs">
          @for (e of errors(); track $index) {
            <li><code>{{ e.path }}</code> {{ e.message }}</li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .loader {
        margin-bottom: 12px;
      }
      textarea {
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        background: #0f0f13;
        color: #d8d8de;
        border: 1px solid #33333a;
        border-radius: 6px;
        padding: 6px;
      }
      .btns {
        display: flex;
        gap: 6px;
        margin: 8px 0;
        flex-wrap: wrap;
      }
      button {
        background: #1c1c22;
        color: #e6e6ea;
        border: 1px solid #33333a;
        border-radius: 6px;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 12px;
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .file {
        font-size: 11px;
        opacity: 0.7;
      }
      .status {
        font-size: 12px;
        color: #39d98a;
        margin: 8px 0 4px;
      }
      .status.err {
        color: #ff6b6b;
      }
      .errs {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 160px;
        overflow: auto;
      }
      .errs li {
        font-size: 11px;
        line-height: 1.5;
        color: #ffb4b4;
        border-top: 1px solid #26262e;
        padding: 3px 0;
      }
      .errs code {
        color: #ffd400;
        margin-right: 4px;
      }
    `,
  ],
})
export class SceneLoaderComponent {
  readonly store = inject(StudioStore);
  readonly text = signal('');
  readonly errors = signal<ValidationError[]>([]);
  readonly status = signal<{ ok: boolean; message: string } | null>(null);

  value(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
  }

  load(): void {
    this.apply(this.store.loadTimelineText(this.text()));
  }

  loadExample(): void {
    const json = exampleTimelineJson();
    this.text.set(json);
    this.apply(this.store.loadTimelineText(json));
  }

  reset(): void {
    this.store.loadDefault();
    this.errors.set([]);
    this.status.set({ ok: true, message: '已還原 demo 場景 ✓' });
  }

  onFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then((t) => {
      this.text.set(t);
      this.apply(this.store.loadTimelineText(t));
    });
  }

  private apply(outcome: LoadOutcome): void {
    this.errors.set(outcome.errors);
    this.status.set(
      outcome.ok
        ? { ok: true, message: '場景已載入 ✓' }
        : { ok: false, message: `驗證失敗（${outcome.errors.length} 項）` },
    );
  }
}
