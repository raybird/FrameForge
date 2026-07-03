# FrameForge authoring reference

Detailed reference for writing FrameForge **authoring-form** scenes. The authoritative, always-current
schema comes from the `get_scene_schema` MCP tool — call it first and prefer it over this file.

## Top-level fields

| Field | Notes |
|---|---|
| `id` | stable string id |
| `name` | display name |
| `tickRate` | integer, default `60` |
| `durationSeconds` | total length in **seconds** |
| `assets` | array of `{ id, type, url }` (types: `png` `jpg` `svg` `lottie` `gltf` `glb` `mp3` `wav` `json`) |
| `entities` | array of `{ id, name, components }` |
| `tracks` | array of authored / interactive tracks (below) |
| `events` | authored cue points `{ atSeconds, type, payload }` (optional) |

## Components

Each entity has `components: [{ type, data }]`. Colors are `0xRRGGBB` numbers or CSS strings.

| type | data |
|---|---|
| `Transform` | `{ position?, rotation?(degrees), scale?, color? }` — initial transform; `color` also tints the placeholder |
| `Mesh` | `{ shape: "box"|"plane"|"sphere", size?, color?, assetId? }` — `assetId` (gltf/glb) loads a real model |
| `Sprite` | `{ assetId?, color?, width?, height? }` — `assetId` (png/jpg) shows a real texture |
| `Text` | `{ content, fontSize?, color? }` — canvas-drawn text layer |
| `Camera` | `{ projection: "perspective"|"orthographic", fov?, near?, far?, lookAt? }` — `lookAt` is a world point |
| `Collider` `Animator` `AudioSource` `Script` | reserved; see schema |

An entity with a `Camera` component drives the viewport camera (cinematic framing) and can be animated.

## Tracks

### authored — pure `f(t)`, plays and renders on its own

```json
{
  "id": "tk_orb_x",
  "entityId": "orb",
  "kind": "authored",
  "target": "transform.position",
  "keyframes": [
    { "atSeconds": 0, "value": { "x": -3, "y": 0.6, "z": 0 } },
    { "atSeconds": 2, "value": { "x": 3, "y": 0.6, "z": 0 }, "easing": "easeInOut" }
  ]
}
```

- `target`: `transform.position` | `transform.rotation` (degrees) | `transform.scale` | `visible` | `opacity` | `component.<Type>.<field>`.
- `keyframes`: `atSeconds` strictly increasing and ≤ `durationSeconds`; optional `easing`
  (`linear` `step` `easeIn` `easeOut` `easeInOut` or a cubic-bezier object).

### interactive — user-drivable at runtime (not authored motion)

```json
{
  "id": "seg_hero",
  "entityId": "hero",
  "kind": "interactive",
  "target": "transform.position",
  "startSeconds": 0,
  "endSeconds": null,
  "controller": "kinematic",
  "params": { "position": { "x": 0, "y": 0.5, "z": 0 }, "speed": 0.1 }
}
```

Supported controllers: **`kinematic`** and **`trigger`** (defer to `get_scene_schema`).

- **`kinematic`** (above): the entity **sits at `params.position` until driven** — movement is *recorded
  interaction* (arrow keys in Studio, or an imported `.replay.json`), replayed deterministically. A bare
  render shows it static. Use it to make something the user controls, not for scripted motion.
- **`trigger`**: a **sensor**. When `params.target` (an entity id) enters the box region
  (`params.center` / `params.size`, both `{x,y,z}` full-width), it reveals `params.reveal` (an entity id)
  and optionally `latch`es it open. `target` and `reveal` must be **existing entity ids**. The segment's
  own `entityId` just needs to be a declared entity (triggers don't use it — pointing it at the revealed
  entity is fine). Pair it with an authored `visible=false` track on the revealed entity so the trigger is
  what shows it.

  ```json
  {
    "id": "seg_gate", "entityId": "gate", "kind": "interactive", "target": "visible",
    "startSeconds": 0, "endSeconds": null, "controller": "trigger",
    "params": { "target": "hero", "center": { "x": 5, "y": 0.5, "z": 0 },
                "size": { "x": 1.5, "y": 100, "z": 100 }, "reveal": "gate", "latch": true }
  }
  ```

## Example 1 — purely authored cinematic (plays & renders fully)

```json
{
  "id": "hello_scene",
  "name": "Hello",
  "tickRate": 60,
  "durationSeconds": 4,
  "assets": [],
  "entities": [
    { "id": "cam", "name": "Camera", "components": [
      { "type": "Transform", "data": { "position": { "x": 0, "y": 6, "z": 14 } } },
      { "type": "Camera", "data": { "projection": "perspective", "fov": 50, "lookAt": { "x": 0, "y": 0, "z": 0 } } }
    ] },
    { "id": "ground", "name": "Ground", "components": [
      { "type": "Transform", "data": { "position": { "x": 0, "y": -1.2, "z": 0 }, "scale": { "x": 14, "y": 0.3, "z": 14 }, "color": "#394a2f" } }
    ] },
    { "id": "orb", "name": "Orb", "components": [
      { "type": "Transform", "data": { "position": { "x": -3, "y": 0.6, "z": 0 } } },
      { "type": "Mesh", "data": { "shape": "sphere", "size": 1.2, "color": 3791242 } }
    ] },
    { "id": "label", "name": "Label", "components": [
      { "type": "Transform", "data": { "position": { "x": 0, "y": 3, "z": -2 } } },
      { "type": "Text", "data": { "content": "hello", "fontSize": 72, "color": "#39d98a" } }
    ] }
  ],
  "tracks": [
    { "id": "tk_orb_x", "entityId": "orb", "kind": "authored", "target": "transform.position", "keyframes": [
      { "atSeconds": 0, "value": { "x": -3, "y": 0.6, "z": 0 } },
      { "atSeconds": 2, "value": { "x": 3, "y": 0.6, "z": 0 }, "easing": "easeInOut" },
      { "atSeconds": 4, "value": { "x": -3, "y": 0.6, "z": 0 }, "easing": "easeInOut" }
    ] },
    { "id": "tk_orb_spin", "entityId": "orb", "kind": "authored", "target": "transform.rotation", "keyframes": [
      { "atSeconds": 0, "value": { "x": 0, "y": 0, "z": 0 } },
      { "atSeconds": 4, "value": { "x": 0, "y": 360, "z": 0 } }
    ] }
  ],
  "events": []
}
```

## Example 2 — a user-drivable hero + authored scenery

```json
{
  "id": "playground",
  "name": "Playground",
  "tickRate": 60,
  "durationSeconds": 10,
  "assets": [],
  "entities": [
    { "id": "ground", "name": "Ground", "components": [
      { "type": "Transform", "data": { "position": { "x": 0, "y": -1.2, "z": 0 }, "scale": { "x": 16, "y": 0.3, "z": 16 }, "color": "#2e7d32" } }
    ] },
    { "id": "beacon", "name": "Beacon", "components": [
      { "type": "Transform", "data": { "position": { "x": 4, "y": 0.5, "z": 0 } } },
      { "type": "Mesh", "data": { "shape": "box", "size": 1, "color": "#3a86ff" } }
    ] },
    { "id": "hero", "name": "Hero", "components": [
      { "type": "Sprite", "data": { "color": "#ffd400", "width": 1.2, "height": 1.2 } }
    ] }
  ],
  "tracks": [
    { "id": "tk_beacon_spin", "entityId": "beacon", "kind": "authored", "target": "transform.rotation", "keyframes": [
      { "atSeconds": 0, "value": { "x": 0, "y": 0, "z": 0 } },
      { "atSeconds": 10, "value": { "x": 0, "y": 720, "z": 0 } }
    ] },
    { "id": "seg_hero", "entityId": "hero", "kind": "interactive", "target": "transform.position",
      "startSeconds": 0, "endSeconds": null, "controller": "kinematic",
      "params": { "position": { "x": 0, "y": 0.5, "z": 0 }, "speed": 0.1 } }
  ],
  "events": []
}
```

Here `beacon` spins on its own (authored). `hero` is drivable — in Studio the user presses arrow keys to
move it and that interaction is recorded and replayable; a bare render shows `hero` at its start position.

## Example 3 — walk-into-a-zone trigger (FrameForge's differentiator)

`hero` is drivable; when it enters the zone at `x≈5`, the hidden `gate` is revealed and latched.
Record the walk-in → replay it deterministically → export or share as `.replay.json`.

```json
{
  "id": "gate_demo",
  "name": "Gate",
  "tickRate": 60,
  "durationSeconds": 10,
  "assets": [],
  "entities": [
    { "id": "ground", "name": "Ground", "components": [
      { "type": "Transform", "data": { "position": { "x": 0, "y": -1.2, "z": 0 }, "scale": { "x": 16, "y": 0.3, "z": 16 }, "color": "#2e7d32" } }
    ] },
    { "id": "hero", "name": "Hero", "components": [
      { "type": "Sprite", "data": { "color": "#ffd400", "width": 1.2, "height": 1.2 } }
    ] },
    { "id": "gate", "name": "Gate", "components": [
      { "type": "Transform", "data": { "position": { "x": 5, "y": 1.8, "z": 0 } } },
      { "type": "Sprite", "data": { "color": "#ff5533", "width": 1.4, "height": 1.4 } }
    ] }
  ],
  "tracks": [
    { "id": "tk_gate_hidden", "entityId": "gate", "kind": "authored", "target": "visible",
      "keyframes": [ { "atSeconds": 0, "value": false, "easing": "step" } ] },
    { "id": "seg_hero", "entityId": "hero", "kind": "interactive", "target": "transform.position",
      "startSeconds": 0, "endSeconds": null, "controller": "kinematic",
      "params": { "position": { "x": 0, "y": 0.5, "z": 0 }, "speed": 0.1 } },
    { "id": "seg_gate", "entityId": "gate", "kind": "interactive", "target": "visible",
      "startSeconds": 0, "endSeconds": null, "controller": "trigger",
      "params": { "target": "hero", "center": { "x": 5, "y": 0.5, "z": 0 }, "size": { "x": 1.5, "y": 100, "z": 100 }, "reveal": "gate", "latch": true } }
  ],
  "events": []
}
```
