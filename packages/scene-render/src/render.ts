/**
 * renderSceneToMp4：在 headless Chrome 裡把一個 FrameForge 場景渲染成 MP4。
 *
 * 策略：重用「已建置且驗證過」的 Studio 作為渲染面——用一個極簡 static server 服務
 * `apps/studio/dist/studio/browser`，puppeteer 載入後把場景 JSON 貼進「載入場景」、
 * 點「匯出 MP4」，攔下產生的 Blob。渲染需要 WebGL + WebCodecs（實質上需要瀏覽器），
 * 因此此能力刻意獨立於零依賴的 scene-mcp。
 *
 * 需求：目標機有 Chrome（預設 /usr/bin/google-chrome，可用 chromePath / 環境變數覆寫）。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export interface RenderOptions {
  /** Studio 的建置產物目錄（含 index.html）。預設解析到 repo 的 apps/studio/dist/studio/browser。 */
  studioDist?: string;
  /** Chrome 執行檔路徑。預設環境變數 FRAMEFORGE_CHROME 或 /usr/bin/google-chrome。 */
  chromePath?: string;
  /** 匯出逾時（毫秒）。預設 120000。 */
  timeoutMs?: number;
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function defaultStudioDist(): string {
  // packages/scene-render/src → repo root 上兩層
  return fileURLToPath(new URL('../../../apps/studio/dist/studio/browser', import.meta.url));
}

function defaultChrome(): string {
  return process.env['FRAMEFORGE_CHROME'] ?? '/usr/bin/google-chrome';
}

function serve(root: string): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.join(root, p);
    if (p === '/' || !path.extname(p) || !fs.existsSync(file)) file = path.join(root, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
        res.end(buf);
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ port, close: () => server.close() });
    });
  });
}

/** 把 canonical 場景 JSON 渲染成 MP4 位元組。 */
export async function renderSceneToMp4(
  canonicalSceneJson: string,
  opts: RenderOptions = {},
): Promise<Uint8Array> {
  const studioDist = opts.studioDist ?? defaultStudioDist();
  if (!fs.existsSync(path.join(studioDist, 'index.html'))) {
    throw new Error(`找不到 Studio 建置產物：${studioDist}（請先 ng build，或以 studioDist 指定）`);
  }
  const chromePath = opts.chromePath ?? defaultChrome();
  if (!fs.existsSync(chromePath)) {
    throw new Error(`找不到 Chrome：${chromePath}（用 chromePath 或 FRAMEFORGE_CHROME 指定）`);
  }
  const timeoutMs = opts.timeoutMs ?? 120000;

  const { port, close } = await serve(studioDist);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      const orig = URL.createObjectURL.bind(URL);
      (window as unknown as { __blob: Blob | null }).__blob = null;
      URL.createObjectURL = (o: Blob | MediaSource) => {
        if (o instanceof Blob) (window as unknown as { __blob: Blob | null }).__blob = o;
        return orig(o);
      };
    });

    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('ff-scene-loader textarea', { timeout: 15000 });

    const hasWc = await page.evaluate(() => 'VideoEncoder' in window);
    if (!hasWc) throw new Error('此 Chrome 不支援 WebCodecs（需較新版本 + secure context）');

    // 貼入場景 → 驗證並載入
    await page.evaluate((json) => {
      const ta = document.querySelector('ff-scene-loader textarea') as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(ta, json);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, canonicalSceneJson);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('ff-scene-loader button')].find((b) =>
        b.textContent?.includes('驗證並載入'),
      ) as HTMLButtonElement | undefined;
      btn?.click();
    });

    // 等載入成功（狀態出現「載入」且非錯誤）
    await page.waitForFunction(
      () => {
        const s = document.querySelector('ff-scene-loader .status');
        return !!s && /載入/.test(s.textContent ?? '') && !s.classList.contains('err');
      },
      { timeout: 30000 },
    );

    // 匯出
    await page.evaluate(() => {
      const btn = document.querySelector('ff-transport button.export') as HTMLButtonElement | null;
      btn?.click();
    });

    const deadline = Date.now() + timeoutMs;
    let base64: string | null = null;
    while (Date.now() < deadline) {
      base64 = await page.evaluate(async () => {
        const b = (window as unknown as { __blob: Blob | null }).__blob;
        if (!b || b.type !== 'video/mp4') return null;
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        return btoa(bin);
      });
      if (base64) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!base64) throw new Error('渲染逾時：未產生 MP4');

    return Uint8Array.from(Buffer.from(base64, 'base64'));
  } finally {
    await browser.close();
    close();
  }
}
