import { Component } from '@angular/core';
import { ViewportComponent } from './viewport';
import { SceneTreeComponent } from './scene-tree';
import { SceneLoaderComponent } from './scene-loader';
import { TransportComponent } from './transport';
import { InspectorComponent } from './inspector';

@Component({
  selector: 'app-root',
  imports: [
    ViewportComponent,
    SceneTreeComponent,
    SceneLoaderComponent,
    TransportComponent,
    InspectorComponent,
  ],
  template: `
    <div class="studio">
      <header class="topbar">
        <strong>FrameForge Studio</strong>
        <span class="sub">錄製互動 → 倒帶 → 完美重播</span>
      </header>
      <main class="layout">
        <aside class="left"><ff-scene-loader /><ff-scene-tree /></aside>
        <section class="center">
          <ff-viewport />
          <ff-transport />
          <p class="hint">
            按 ▶ 後用<b>方向鍵</b>駕駛 <b style="color:#ffd400">hero</b>（黃色 Sprite），操作即時錄製；
            把時間軸往回拖即可看到逐 tick 重播。藍色球體是 authored 自轉的 Mesh，上方 FrameForge 是 Text 圖層。
          </p>
        </section>
        <aside class="right"><ff-inspector /></aside>
      </main>
    </div>
  `,
  styles: [
    `
      .studio {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .topbar {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 10px 16px;
        border-bottom: 1px solid #26262e;
      }
      .topbar .sub {
        opacity: 0.55;
        font-size: 13px;
      }
      .layout {
        flex: 1;
        display: grid;
        grid-template-columns: 220px 1fr 260px;
        gap: 12px;
        padding: 12px;
        min-height: 0;
      }
      .left,
      .right {
        overflow: auto;
      }
      .center {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .hint {
        font-size: 12px;
        opacity: 0.6;
        line-height: 1.5;
      }
    `,
  ],
})
export class App {}
