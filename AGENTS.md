# Agent Notes

## Encoding and mojibake

- Never introduce mojibake into any file.
- Before editing a file that already contains Japanese text or non-ASCII text,
  preserve the file's existing encoding and line endings.
- Do not rewrite whole files unless it is necessary. Prefer small patches that
  keep existing bytes outside the edited range untouched.
- When adding agent-facing notes, comments, or documentation, prefer ASCII
  unless the target file already requires Japanese text.
- Do not use shell write tricks, ad-hoc encoding conversions, or bulk formatting
  commands on files that may contain Japanese text.
- After editing a file that contains Japanese text, inspect the relevant lines
  and make sure existing text was not changed into mojibake.

## PIXI bitmap masks

- When a `Bitmap` is updated manually with canvas APIs such as `putImageData()`,
  `_setDirty()` alone may not be enough if the bitmap is only used by a mask
  sprite that is not rendered normally.
- In particular, a mask `Sprite` with `renderable = false` may not run the
  usual bitmap dirty check through the render path.
- After updating a bitmap used as a PIXI mask, call both:

```js
bitmap._setDirty();
bitmap.checkDirty();
```

- Do not assume a light/source collection bug just because only one mask-driven
  light appears on screen. First verify whether the light reaches the brightness
  or mask buffer, then verify whether the mask bitmap texture is being uploaded.

## Game-specific sprite rules

- This game uses the hand-drawn "yurayura" distortion effect almost everywhere.
  Any sprite-related work must assume that a normal `Sprite` or `TilingSprite`
  may be replaced visually by a `Sprite_Yurayura` mesh child.
- The effect is driven mainly by `_yuraInfo` and creates/uses `_meshSprite`.
  When `_yuraInfo` is active, the sprite's original bitmap may be moved to
  `_baseBitmap`, while the visible pixels are rendered by the mesh.
- Do not judge sprite behavior only from `sprite.bitmap`, `sprite.texture`, or
  parent/child order. Also inspect `_yuraInfo`, `_meshSprite`, `_baseBitmap`,
  `_lastFrame`, `_yuraDirect`, `_yuraLockGeometry`, and `_yuraUseOwnStep`.
- When changing a sprite's bitmap, frame, contents, scale, anchor, origin, or
  dimensions, consider whether the yurayura mesh must be reset or refreshed.
  Existing code often clears `_lastFrame`, restores `_baseBitmap`, or calls
  `refreshYurayura()` to prevent stale meshes and afterimages.
- `TilingSprite` also supports yurayura in this project. Its mesh is positioned
  against `origin`, so scrolling, `tileScale`, and origin changes can interact
  with `_meshSprite` behavior.
- For large composed surfaces or tiled/repeated surfaces, prefer the filter
  based yura path (`setYuraFilterZXC(...)` / `Filter_Yurayura`) over per-tile
  `Sprite_Yurayura` meshes. Per-tile meshes can be heavy and can create visible
  seams when neighboring mesh edges distort differently.
- For dynamic bitmaps used with yurayura, update both the bitmap texture and the
  mesh when needed. Some code marks `_meshSprite._meshDirty = true`, clears
  `_lastPattern`, and calls `updateMesh()`.
- Before fixing a sprite rendering issue, first check whether the visible output
  is the base sprite or the yurayura mesh. Many "sprite is wrong" bugs in this
  game are actually stale mesh, stale base bitmap, or origin/anchor mismatch
  problems.

## Game-specific event rules

- `$gameMap.events()` is optimized in this game and returns only nearby events,
  not every event on the map.
- When logic needs all map events, use `$gameMap.events(true)` or inspect
  `$gameMap._events` directly. Prefer `_events` for hot paths where avoiding
  temporary arrays matters.
- Do not use `$gameMap.events()` for total counts, global searches, or systems
  such as darkness/light collection where offscreen events may still matter.
