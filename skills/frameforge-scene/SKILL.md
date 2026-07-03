---
name: frameforge-scene
description: Generate deterministic 2.5D/3D FrameForge scenes (timelines) from a natural-language brief using the frameforge-scene MCP server, then validate and either save the JSON or render it to MP4. Use when the user wants to author, generate, or create a FrameForge scene, an animated 2.5D/3D scene, a seekable/replayable scene, a keyframed camera/text/mesh/sprite animation, or export such a scene to a video clip. Handles authored keyframe animation (f(t)), user-drivable interactive segments, cameras with lookAt, text layers, and asset-backed sprites/models.
license: MIT
compatibility: Requires the "frameforge-scene" MCP server configured in your agent (see packages/scene-mcp). The render_scene tool additionally needs local Chrome plus the scene-render CLI or a built Studio.
metadata:
  author: frameforge
  version: "1.0"
allowed-tools: mcp__frameforge-scene__get_scene_schema mcp__frameforge-scene__compile_scene mcp__frameforge-scene__validate_scene mcp__frameforge-scene__save_scene mcp__frameforge-scene__render_scene
---

# FrameForge scene generation

Turn a natural-language brief into a **valid FrameForge scene** (a declarative timeline that
plays, seeks to any time, and exports to MP4) by driving the **`frameforge-scene` MCP server**.
This skill orchestrates those tools; it does not generate scenes on its own.

**Prerequisite:** the `frameforge-scene` MCP server must be configured in the agent. If its tools
are not available, tell the user to install it (see `packages/scene-mcp/README.md`:
`claude mcp add frameforge-scene -- frameforge-scene-mcp`) and stop.

## Workflow (always follow this order)

1. **`get_scene_schema`** — call it FIRST, every time. It returns the current authoring JSON Schema
   and the writing guide. **Treat its output as the source of truth**; the cheat-sheet below is only
   orientation and may lag the schema.
2. **Draft** an *authoring-form* scene JSON per the schema (see "Authoring form" below).
3. **`compile_scene`** (or `validate_scene`) — compile the authoring JSON to canonical and validate.
   If it returns errors, **fix exactly what each message says and retry** — loop until it passes.
   Never hand the user or `save_scene`/`render_scene` a scene you have not gotten to pass.
4. **Deliver**, based on what the user wants:
   - **`save_scene`** → writes the canonical JSON to a path; the user loads it in Studio to play/seek/export.
   - **`render_scene`** → renders straight to an MP4 file (needs local Chrome + scene-render; see below).
   - Or just return the validated canonical JSON for the user to paste into Studio's "載入場景".

## Authoring form (what you write)

Write the **authoring** form — it is the agent-friendly one:

- **Time in seconds**: `durationSeconds`, `keyframe.atSeconds`, `event.atSeconds`,
  interactive `startSeconds` / `endSeconds`. (The compiler turns these into integer ticks.)
- **Rotation in degrees** (one turn = 360). **Camera aims with `lookAt`** — give a world point, not euler angles.
- **Top level**: `id`, `name`, `tickRate` (default 60), `durationSeconds`, `entities`, `assets`, `tracks`, `events`.
- **Colors**: `0xRRGGBB` number or a CSS string (`"gold"`, `"#39d98a"`).

Components (on `entity.components`, each `{ type, data }`): `Transform`, `Sprite`, `Mesh`, `Camera`,
`Text`, `Collider`, `Animator`, `AudioSource`, `Script`. Common shapes:
`Mesh {shape: box|plane|sphere, size?, color?}` · `Sprite {assetId?, color?, width?, height?}` ·
`Text {content, fontSize?, color?}` · `Camera {projection, fov?, near?, far?, lookAt?}`.

## Two kinds of track — pick deliberately

- **`authored`** (default, use this most): a pure function of time `f(t)`. `keyframes` (by `atSeconds`,
  increasing, within duration) fully drive the property. This is what plays and renders on its own —
  cinematic motion, camera moves, fades, spins, text. **For "make a video / animation", use authored tracks.**
- **`interactive`** (`controller: "kinematic"`): marks an entity as **user-drivable at runtime**. It sits
  at its initial `position` until someone drives it (arrow keys in Studio, or an imported `.replay.json`).
  Use it when the brief wants the user to *control* something. **A bare render of an interactive-only
  entity shows it static** — the movement is recorded interaction, not authored. Only `kinematic` is a
  supported controller unless `get_scene_schema` says otherwise.

See `references/AUTHORING.md` for the full field reference and two complete worked examples.

## render_scene (optional, → MP4)

`render_scene` validates then renders with headless Chrome. It requires **local Chrome + the
scene-render CLI** (dev: set `FRAMEFORGE_RENDER_CMD` to `npx tsx <repo>/packages/scene-render/src/cli.ts`
and build the Studio once with `ng build`). If it returns a "render not available" message, fall back to
`save_scene` and tell the user to open the scene in Studio to export.

## Common errors → fixes

- `expected number, received undefined` on `atSeconds` / `durationSeconds` → you wrote canonical (ticks)
  instead of authoring (seconds). Switch to seconds.
- `未知的 controller '…'` → only `kinematic` is supported; don't invent controllers.
- References a non-existent `entityId` / `assetId` → every track/segment must point at a declared entity;
  every `assetId` must exist in `assets`.
- `keyframe` out of order or past `durationSeconds` → keep `atSeconds` strictly increasing and in range.

## Rules of thumb

- Always `get_scene_schema` first; never trust memory for the exact schema.
- Prefer authored `f(t)` for anything that should animate on playback.
- Keep entity `id`s stable and referenced consistently across `entities`, `tracks`, and `assets`.
- Never deliver an unvalidated scene.
