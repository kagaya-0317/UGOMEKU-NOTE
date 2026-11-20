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

## Reuse existing game implementations

- Before implementing an event, save point, item pickup, transition or effect,
  inspect saved maps, common events and plugins for an existing equivalent.
  Follow its calls, flags, presentation and cleanup rather than creating a
  parallel system that bypasses the game's existing behavior.
- When copying events or pages, check event IDs, variable IDs, template names
  and other references as well as coordinates; copied references may be stale.
- Create only the requested assets, events and progression logic. Brainstormed
  ideas are not accepted specifications until the user chooses them.

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
- Inspect existing `cssRect`, `CGScale`, `CGShift` and related image settings
  before reusing artwork. The intended picture may occupy an interior sheet
  cell rather than the top-left cell or a standard character-sheet frame.

## Recording gameplay

- Preserve the configured character and boss scale in recordings. Do not resize
  combatants just to fit the capture frame.
- Keep normal party attacks enabled. Do not suppress them for clearer enemy
  footage unless the user explicitly requests an isolated attack demonstration.

## Game-specific color rules

- Treat `#474e51` as the game's canonical visual black. Use it for in-game
  "black" pixels, drawings, fills, and similar artwork-facing colors unless a
  true technical black is explicitly required for masks, outlines, or debugging.

## Map backgrounds and editable artwork

- Map display numbers, internal map IDs and background names are separate.
  Resolve transfers through `data/MapInfos.json` and the actual map data rather
  than assuming a display number is the map ID.
- Store editable map-background `.aseprite` files in `../画像/` and runtime
  PNGs in `img/parallaxes/`, using the same base name, including the leading
  `!`. Keep the editable artwork and exported PNG in sync after changes.
- Older helpers and copies may use `../aseprite/`. For these map backgrounds,
  the user-designated image directory above is authoritative; do not overwrite
  newer user edits with an older generated copy or rerun a stale generator.
- The upper-castle backgrounds use these page formats:

  | Format | Runtime PNG | Map size in tiles |
  | --- | --- | --- |
  | One page | 1000x1414 | 21x30 |
  | Two-page spread | 2000x1414 | 41x30 |

- Some older editable files are 500x707 or 1000x707 and export at 2x. The current
  `!map113`, `!map114`, `!map114_room` and `!map115` editable files already match
  their runtime PNG dimensions and export at 1x. Check both dimensions before
  exporting; do not apply a blanket scale factor to all source files.
- Background artwork and passage data are separate. Match floors, walls,
  fences, stairs and entrances to the actual collision data, and account for
  the gutter in two-page spreads. Preserve existing map events when changing
  artwork or collision; do not rebuild a populated map as a background-only map.
- Half-step positions and `HM` note tags affect actual placement. Check the
  loaded position and passage at fractional coordinates, including both ends
  of a transfer; an integer-coordinate check alone is insufficient.

## Game-specific message rules

- By default, game messages in this project should use the popup message
  system rather than the normal fixed message window.
- For system-style messages, confirmations, and non-character UI prompts, use
  a rectangular system popup with the speech-bubble/fukidashi shape disabled.
  In practice, use the popup positioning flow such as
  `$gameSystem.setMessagePopupFree(...)`, then keep `$gameMessage._fukidashi`
  false and use a no-tail direction such as `$gameMessage._tailDir = 5`.
- Clear popup positioning/state after temporary system prompts when leaving
  the flow, so the next unrelated message does not inherit the popup position.
- Choice and number-input popup placement is overridden in
  `js/plugins/KNH_ZXC_System.js` by `Window_ChoiceList.updatePlacementPopup()`
  and `Window_NumberInput.updatePlacementPopup()`. Do not assume
  `$gameMessage.setChoicePositionType(...)` is enough for popup messages.
- System choice popups are centered when switch 4, `_sceneInfo.shop`, or
  `_sceneInfo.systemMessage` is active. Prefer setting and clearing
  `_sceneInfo.systemMessage` for temporary system confirmations instead of
  repurposing shop flags or relying on player-relative popup placement.
- Frame event cameras for the character's actual image height and scale, the
  speech bubble and the whole party. Focusing only on the boss's foot position
  can hide companions or put the bubble outside the screen.

## Game-specific dialogue rules

- The protagonist (actor 2) is silent. Do not give the protagonist spoken lines.
- Companion speakers are Mii (actor 3) and Yume (actor 4). Resolve speakers by
  actor ID, not party order, and never fall back to the protagonist.
- Read existing character dialogue before writing new lines and preserve each
  character's established voice.
- Do not use Japanese full stops (U+3002) in game dialogue.

## Game-specific event rules

- `$gameMap.events()` is optimized in this game and returns only nearby events,
  not every event on the map.
- When logic needs all map events, use `$gameMap.events(true)` or inspect
  `$gameMap._events` directly. Prefer `_events` for hot paths where avoiding
  temporary arrays matters.
- Do not use `$gameMap.events()` for total counts, global searches, or systems
  such as darkness/light collection where offscreen events may still matter.
- After a progression change unlocks offscreen events, refresh the relevant
  event pages and event selection as needed. The upper-castle implementation
  uses `KNH_CastleUpper.refreshEvents()` for this. Do not refresh every event
  every frame or assume a nearby-only refresh has updated a distant chest.
- Use named game variables for progression shared between events or maps, and
  self switches for local state such as a chest already being opened. Inspect
  current variable usage before allocating IDs; do not repurpose occupied IDs.
- Give progression values explicit meanings and follow the convention for the
  flow being edited. Provide a completed page so autoruns and rewards do not
  repeat on reentry or load.

## Editor-owned event placement

- Map event `x` and `y` saved by RPG Maker are the authoritative initial
  position. Animation initialization must not overwrite these coordinates.
- Do not add hard-coded `locate(...)`, `setPosition(...)`, or equivalent
  position resets to page initialization, animation setup, or repeating routes.
  Explicitly requested teleports or fixed spawn points are exceptions.
- Keep animation setup limited to sprite/frame/scale/timing configuration.
  Do not persist temporary screenshot staging coordinates as initialization.
- Moving events must depart from their editor placement. Use relative movement
  and actual passage/map boundaries for endpoints when the behavior should
  continue to a dead end; do not assume a fixed starting coordinate or distance.
- When copying maps, events, or pages, inspect copied initialization scripts and
  custom/forced movement routes for stale absolute coordinates.
- After placement-related changes, load the saved map normally and confirm that
  stationary events retain the editor coordinates after animation starts and on
  map reentry. For moving events, verify the editor start point and end behavior.
- After character placement, scale, or other visible map changes, attach a fresh
  game/editor screenshot. Runtime-only staging is not a saved implementation.
- Preserve user edits already saved in map files. Check for concurrent changes
  before writing; do not restore earlier coordinates from an agent snapshot.
- If files are changed while RPG Maker or a playtest is open, explain that the
  project/playtest must be reopened to load the changes and avoid stale editor
  data overwriting the fix. Never close apps or discard unsaved work automatically.

## Game-specific follower rules

- This game intentionally inserts invisible spacer followers between visible
  party followers to widen party spacing.
- `Game_Followers` creates extra `Game_Follower` entries, and odd
  `_memberIndex` values are spacer followers whose `actor()` resolves to an
  out-of-range party member.
- The first and second visible party followers are usually
  `$gamePlayer.followers().follower(1)` and
  `$gamePlayer.followers().follower(3)`, not `follower(0)` and `follower(1)`.
- Do not assume `visibleFollowers()[0]` means the first party follower when
  follower order, party-member targeting, hit detection, or scripted movement
  needs to match this spacing system. Inspect `_memberIndex` and resolve the
  actual follower by `follower.actor().actorId()` when matching a character,
  guarding against spacer followers without an actor.
- Spacer followers still participate in the follow chain and movement spacing
  even though they have no visible actor sprite.
- For staged automatic scenes, move the protagonist and present companions
  from their current positions into formation, wait for movement to finish,
  then face the speaker and start the camera/dialogue sequence. Do not just
  hide companions and leave the protagonist at the trigger position.
- When map stand-ins take over from followers, copy their actual rendered
  positions and image settings. After hiding or showing followers, also call
  `$gamePlayer.refresh()` as native event command 216 does; changing visibility
  alone can leave duplicate sprites or missing companions.
- At the handoff back, copy stand-in positions and directions to the actual
  followers, hide the stand-ins, reset spacer/follow history as needed, and
  restore the captured movement speed, direction lock, visibility and camera.
  Do not hard-code a presumed default movement speed or collapse the visible
  party onto the protagonist at the end of the scene.
- `goTo(...)` is scripted repositioning, not normal route finding. Keep staged
  moves clear of obstacles; use actual walking to verify traversable routes.
- Reference Map051 event 6 and Map053 event 4 for staging, and Map012 event 10
  for returning stand-in positions to followers. The upper-castle helpers are
  in `js/plugins/KNH_ZXC_CastleUpper.js`.

## Save points

- Reuse the `save` template and its paired sticky-note event. Map015 events
  18 and 19 are reference examples. Set `<TE:save><save:VARIABLE_ID>` and the
  matching sticky-note condition to the save point's discovery variable, and
  preserve the existing note orientation, image shifts and presentation.
- Native event command 352 opens this game's custom save UI through
  `Scene_Base.startSave()` while staying in `Scene_Map`. Do not implement or
  verify the flow on the assumption that standard `Scene_Save` will appear.

## Template event and item rules

- Template events are resolved through `$dataTemplateEvents` and
  `DataManager.searchDataItem(..., 'name', name)`. A string such as
  `"templateName"` is only a placeholder; it must match a real template event
  name or a numeric template event id.
- The template event named `"item"` is the normal pickup-item template. It is
  not a generic object template: its event commands expect
  `this.character(0)._item` and `_itemNum` to be set before pickup.
- For normal pickup items, use `$gameMap.putItem(item, x, y, num)` or the
  player-drawing helpers `KNH_PlayerDrawing.putItem(...)` /
  `this.putLastPlayerDrawingItem(itemId, x, y, num)`. Do not use
  `spawnPlayerDrawingEvent(drawingId, "item", ...)`; that creates an item
  template event without item data.
- For non-item player-drawing objects, enemies, or custom placed objects, use
  `spawnPlayerDrawingEvent(drawingId, templateNameOrId, x, y, options)` with a
  dedicated template event that does not require `_item`.
- `Game_Event.prototype.setItem(item)` stores the actual item in `_item`.
  `item.meta.image` is optional and is only the default visual image for normal
  item sprites.
- Normal item visuals use note tags like `<image:Item3,2>` and are read from
  `img/items/` as a 4-column by 2-row sheet. Player-drawing item visuals are
  stored separately and should be treated as a single 144x144 image.
- Player-drawing item image registrations are saved in
  `$gameSystem.ZXC().playerDrawings.itemImages` as `itemId -> drawingId`.
  They intentionally do not use game variables.
- To register the last completed drawing as an item's future visual, use
  `this.registerLastPlayerDrawingItemImage(itemId)`. To clear it, use
  `this.unregisterPlayerDrawingItemImage(itemId)`.
- Any UI or battle code that displays an item image should resolve it through
  `KNH_PlayerDrawing.itemImageInfo(item)`,
  `KNH_PlayerDrawing.loadItemImageBitmap(info)`, and
  `KNH_PlayerDrawing.itemImageFrame(bitmap, info)` when available, rather than
  reading `item.meta.image` directly. Registered player drawings must override
  the note-tag image in menu, battle, and map item displays.
- Reuse existing chest pickup presentation and opened-state handling rather
  than only changing inventory. For a multi-key gate, check all required keys
  before consuming any, consume them once, and persist a permanently open
  state so later entry does not ask for or consume the keys again.

## Temporary battle guests

- A character shown on the ally side for an encounter does not necessarily
  need to join the party. Keep display-only guests outside party membership
  and battle action/target arrays when the scene requires only a visual guest.
- The current battle scheduler requires a valid enemy action even for a hidden
  dummy in a noncombat encounter. Use an existing valid nondamaging action;
  an empty action list can crash before an immediate battle abort takes effect.
- Scope special battle behavior to the intended encounter. Do not disable
  normal party attacks or change other battles to support a friendly scene.

## Verification of saved maps and events

- Verify the saved implementation in the real engine after reloading it. Check
  first entry, completed-state reentry, save/load persistence and alternative
  key acquisition orders where relevant. Walking transfers must work in both
  directions with normal collision; teleporting or enabling through mode is
  not proof of reachability.
- For party scenes, check reordered and absent companions, visible rendered
  sprite counts, battle return and resumed following. Logical visibility flags
  alone do not establish that exactly one sprite per companion is rendered.
- Use a dedicated test profile and save directory so verification cannot
  overwrite the user's saves. Keep actual battle outcomes separate from claims
  about final combat balance, especially when test setup forces victory.
- For exported artwork, reopen the saved Aseprite file and check that its
  rendered pixels match the intended runtime PNG, not only that the file exists.

## Upper-castle implementation reference (2026-11-19)

- These are the current saved mappings, not IDs to reuse for new content.
  Recheck the live data before editing or allocating additional records.

  | Internal map ID | Display location | Background base name |
  | --- | --- | --- |
  | 59 | 113, Mone's room | `!map113` |
  | 60 | 114, monster castle 3F | `!map114` |
  | 61 | 3F gimmick room | `!map114_room` |
  | 62 | 115, throne room | `!map115` |

- The four editable backgrounds currently each have one background layer;
  furniture and other drawn objects are not separate editable layers.
- Current progression variables:

  | Variable | Purpose | Values |
  | --- | --- | --- |
  | 61, 62 | Mone/throne save point discovery | 0 undiscovered, 1 discovered |
  | 63 | Mone encounter | 0 waiting, 1 running, 2 complete |
  | 64 | Beast friendship | 0 waiting, 1 running, 2 complete |
  | 65 | Final gimmick | 0 waiting, 1 active, 2 complete |
  | 66 | Throne gate | 0 locked, 1 permanently open |
  | 67 | Tsunehi encounter | 0 waiting, 1 running, 2 complete |

- Items 53 and 54 are the round and triangular keys. The gate consumes one of
  each on initial opening. The beast uses actor 6 as a display-only guest in
  troop 47; it never joins the party. Troops 46 and 48 are the temporary Mone
  and Tsunehi battles; combat balance and final attacks remain provisional.
- Map061 now contains eight editor-owned toggle panels (events 5-12). All call
  common event 41; each panel's self switch A stores its persistent ON state.
  Event 1 handles instructions and completion, not forced success.
- `KNH_ZXC_Gimmick_SpikePanel.js` registers trap rectangles through the original
  `command_updateSpikeFloor(...)` used on 1F. Preserve its hit tests, damage,
  follower handling and return to the previous safe floor. Damage does not
  reset any panel; landing after damage must not count as a new panel entry.
- All eight panels ON sets variable 65 to 2, retracts the spikes and refreshes
  the key chest and exit. Panel states survive save/load and map reentry.
  The puzzle camera is released on completion and when leaving the map.
- Spike artwork uses one connected `Sprite_SpikePanelFloor` with world-aligned
  1x source textures (matching 1F) and one yura filter. Trap events retain
  their native hit rectangles and have no separate visible sprite meshes.
  Do not stretch the source frame into each rectangle or draw borders around
  the decomposition.
- Keep this floor in `_baseSprite` before `_tilemap`, below all character
  meshes. Panel artwork uses a 30px CGShift to center it on each safe island;
  saved event coordinates and activation regions remain authoritative.
