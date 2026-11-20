# Upper castle temporary events

Saved events are authoritative in Map055 and Map059-Map062. The background art
and collision layers are unchanged. Map055 only receives its new exit event.

| Variable | Meaning | Stages |
| --- | --- | --- |
| 61 | Mone save point | 0 undiscovered, 1 discovered |
| 62 | Throne save point | 0 undiscovered, 1 discovered |
| 63 | Mone encounter | 0 waiting, 1 running, 2 complete |
| 64 | Beast friendship | 0 waiting, 1 running, 2 complete |
| 65 | Final gimmick | 0 waiting, 2 complete |
| 66 | Throne gate | 0 locked, 1 permanently open |
| 67 | Tsunehi encounter | 0 waiting, 1 running, 2 complete |

Items 53 and 54 are distinct keys. Each chest uses self switch A after the
standard item-pickup presentation. The gate consumes one of each key once.
Chest access depends on its encounter flag; the two routes are independent.

The saves copy the existing `save` template and sticky-note conventions.
The existing custom save UI handles native event command 352.

Actor 6 is the temporary beast. Its actual Game_Actor is rendered on the ally
side of troop 47 with Sprite_NewActor's renderer. It never enters the party or
the combat action/target arrays. The turn-zero event ends with command 340.
The hidden encounter enemy has a valid no-damage action because the existing
battle scheduler requires one even when combat input is disabled.

Troops 46 and 48 use temporary enemies 23 and 24 with existing basic attacks.
Party attacks stay enabled. Their art is assembled from the existing Mone and
Tsunehi character graphics. Combat balance and final attacks remain provisional.

Map061 event 1 currently succeeds automatically. It contains no rocks, switches
or puzzle objects. Replace that event when designing the final gimmick, and
retain variable 65 = 2 plus `KNH_CastleUpper.refreshEvents()` on success.

Temporary assets:

- `img/characters/$castleBeast_tmp.png`
- `img/sv_actors/castleBeast_tmp.png`
- `img/sv_enemies/castleMone_tmp.png`
- `img/sv_enemies/castleTsunehi_tmp.png`
- `img/items/Item9.png`

Matching editable Aseprite sources are in the project's sibling `aseprite`
directory. The beast generation prompt and source are in asset-generation.json.

Verification uses a dedicated NW.js profile and temporary save directory.
Game message windows, choices, native item pickups, native battle callbacks,
the project's save UI, and save/load serialization run in the real engine.
Victory checks finish enemies through the engine's death/victory flow; these
checks do not establish final combat balance.

- data-verification.json: unrelated records, encoding and event scripts
- mone-verification.json: save, encounter, restoration and reentry
- event-verification.json: native save UI, Tsunehi and persistence; the trace
  includes the earlier beast, key and gate run resumed at the save UI
- transfer-verification.json: actual walking transfers and reverse key order
- verification.json: static floor reachability and normal background meshes

Authoring helper: `tools/castle_upper_maps/implement_events.cjs --full` patches
owned records only and refuses inputs modified since its last run. Edit saved
events in RPG Maker normally; do not rerun the generator over editor changes.
The older background-only builder explicitly refuses maps containing events.
