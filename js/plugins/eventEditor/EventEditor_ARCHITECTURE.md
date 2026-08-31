# Event Editor Architecture

The timeline loader reads and evaluates each source file separately in a fixed
order. Every evaluated file has its own `sourceURL`, so stack traces point to
the real module instead of a generated mega-bundle. Registered modules fail
fast when a dependency is missing or ordered incorrectly. Intentional base
method overrides are declared by the registering module.

## Module order

1. `KNH_ZXC_EventEditor_Document.js`
   - Environment-independent document merge and page-track rebase functions
   - Also loadable from Node regression tests without RPG Maker globals
2. `KNH_ZXC_EventEditor_Services.js`
   - Atomic text/JSON writes, exact-byte backups, collision-safe names, retention
   - Also loadable from Node regression tests
3. `KNH_ZXC_EventEditor_Model.js`
   - Content-addressed per-track history snapshots
   - Canonical track ordering and history-record updates
   - Full and changed-track-only schedule construction
4. `KNH_ZXC_EventEditor_Timeline_Shared.js`
   - Shared constants and utility functions
   - Track access, UID lookup, and canonical command sorting
   - Preview character class and the animation-position engine patch
   - Module ownership and declared-override validation
5. `KNH_ZXC_EventEditor_Style.js`
   - Editor CSS as a separately loaded style resource
6. `KNH_ZXC_EventEditor_Timeline_Core.js`
   - Editor lifecycle and UI construction
   - Command catalogs and command insertion
7. `KNH_ZXC_EventEditor_RouteSchemas.js`
   - Move-route command schema catalog and conversion rules
8. `KNH_ZXC_EventEditor_Debug.js`
   - Opt-in route-wait and simulation property diagnostics
9. `KNH_ZXC_EventEditor_Timeline_Schema.js`
   - Shared schema helpers and schema-driven form controls
10. `KNH_ZXC_EventEditor_CommandSchemas.js`
   - Command-code schema catalog and parameter conversion rules
11. `KNH_ZXC_EventEditor_Timeline_Preview.js`
   - Command editor dialogs and visual/map previews
12. `KNH_ZXC_EventEditor_Timeline_Branch.js`
   - Branch structure, view modes, runtime filtering, and view persistence
13. `KNH_ZXC_EventEditor_Timeline_Render.js`
   - Timeline workspace model, layout, character panels, and hit testing
14. `KNH_ZXC_EventEditor_Timeline_Edit.js`
   - Timeline insertion, clipboard, range selection, and editing operations
15. `KNH_ZXC_EventEditor_Timeline_Canvas.js`
   - Canvas primitives, fixed overlays, and final timeline drawing
16. `KNH_ZXC_EventEditor_Timeline_Input.js`
   - Input dispatch, serialization, schedule rebuilds, and snapshots

## Data invariants

- `uid` is the stable identity of a timeline entry.
- Track commands use `SH.sortTrackCommands(track)` as their canonical ordering.
- Branch structure analysis and serialization use
  `SH.commandsInSourceOrder(track)`; timeline order cannot represent overlapping
  branches safely.
- UID lookup goes through `findTrackEntryByUid` or
  `findTrackEntryIndexByUid`.
- The selected track is read through `selectedTrack()`.
- Conditional and choice view modes use the common branch view-mode API.
- RPG Maker branch structure commands keep their native indentation:
  - choices: `102 -> 402/403 -> child commands -> 404`
  - conditions: `111 -> child commands -> 411 -> child commands -> 412`
- Every branch starts at its owner's frame. Branches merge at the maximum end
  frame of their children, not at the sum of their durations.
- `dirty[trackKey]` owns command-list changes. `documentDirty.events` and
  `documentDirty.troops` own whole-document changes.
- Event and battle settings edit clones. Live database globals change only at
  the explicit commit boundary.
- Event-page structure changes use stable `orig:N` tokens. A retained original
  page carries its track and dirty flag to the new page index; a new, pasted,
  or cleared page never inherits the old track by position.
- Undo snapshots include only document IDs that have entered the document edit
  path. This avoids cloning every map event while still making whole-event
  edits reversible.
- A committed edit after Undo always clears the stale Redo branch. Modal flows
  create their pre-change snapshot at commit time when cancellation is possible.
- Snapshot deduplication fingerprints each track independently and verifies the
  serialized text before reusing an immutable track snapshot. Unchanged tracks
  are structurally shared between adjacent history entries.
- Track mutations go through `commitTrackMutation`. It owns dirty marking,
  revision updates, canonical sorting, incremental schedule rebuild, and the
  earliest frame that may require simulation invalidation.

## Save transaction

1. Read and parse the latest target JSON from disk.
2. Create a collision-free backup of those exact bytes.
3. Overlay only tracked document changes and dirty command lists.
4. Serialize and parse-check the merged JSON and sidecar diff.
5. Atomically replace the diff, then the target JSON.
6. Refresh runtime globals and clear dirty state only after success.

Backups are retained independently per `MapNNN.`, `Troops.`, and `System.`
prefix. The newest 80 files of each prefix are kept.

Track-only edits preserve newer disk changes to event properties. Whole-event
edits intentionally win for that event. Runtime-only top-level `meta` objects
are removed from document replacements.

## Rendering and scheduling

- Canvas backing dimensions are changed only when the required dimensions
  change. A normal redraw does not reallocate the backing store.
- Static timeline content and the hover/playhead overlay use separate canvases.
  Cursor movement does not redraw all command nodes and labels.
- Automatic conditional-branch display caches branch structure per track
  revision and redraws static content only when the effective branch result
  changes.
- Character hit boxes are derived from sprite frames and world transforms.
  This avoids `PIXI.DisplayObject#getBounds()` traversal in the normal path and
  accounts for active yurayura mesh padding.
- Schedule buckets are rebuilt only for committed changed tracks. Unchanged
  per-track contributions retain identity.
- Per-draw UID and branch caches are released in `finally`, including error
  paths.
- Expensive auto-wait route simulation is limited to changed candidate tracks
  that actually contain tile-goto or follower-goto route commands.
- Idle post-processing changes message runtime state only on playback state
  transitions.

## Change rules

- Put environment-independent primitives in `Timeline_Shared`.
- Do not duplicate engine patches or fallback implementations in feature files.
- Keep compatibility wrappers when renaming a prototype method used by existing
  editor code or debug tooling.
- Mutations must mark the selected track dirty and rebuild the schedule through
  the existing editing flow.
- Whole-event and troop mutations must register their document ID before the
  pre-change snapshot, then mark the matching `documentDirty` collection.
- Rendering may use read-only per-draw caches; caches must be cleared at the end
  of the draw and must never own mutable track state.
- File writes that replace persistent editor state must go through
  `writeTextFileAtomic`.
- Dialogs must register in the modal registry. Escape closes only the topmost
  open dialog, and generic editor shortcuts remain blocked while one is open.
- Switch and variable name pickers share the system-name picker implementation.
  `System.json` is backed up and atomically replaced before a chosen value is
  committed to the caller.

## Regression tests

Run the test files from the project root:

- `node js/plugins/eventEditor/tests/run.js` (all tests)
- `node js/plugins/eventEditor/tests/EventEditorDocument.test.js`
- `node js/plugins/eventEditor/tests/EventEditorServices.test.js`
- `node js/plugins/eventEditor/tests/EventEditorModel.test.js`
- `node js/plugins/eventEditor/tests/TimelineModules.test.js`

They cover page-track reindexing, dirty-key migration, latest-disk merge
preservation, event creation/deletion, persistent `metaArray` preservation,
runtime metadata stripping, battle document merge, missing-page save rejection,
atomic writes and backup retention, incremental schedule updates, history track
sharing, canonical ordering, selection-aware history deduplication, automatic
branch-view invalidation, range-delete rebuild boundaries, schema round trips,
module ownership/override validation, modal precedence, sprite bounds,
split-module evaluation, and required prototype
installation without starting RPG Maker.
