/**
 * @frameforge/scene-render
 *
 * Node 端把 FrameForge 場景渲染成 MP4（headless Chrome + 重用 Studio 渲染面）。
 * 刻意獨立於零依賴的 scene-mcp；scene-mcp 的 render_scene 動態載入本套件。
 */

export { renderSceneToMp4 } from './render';
export type { RenderOptions } from './render';
