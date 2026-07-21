# Event Editor Architecture

The timeline extension is loaded as one ordered bundle. Each module registers
itself after initialization, so missing files and invalid dependency order fail
at startup instead of producing partial prototype overrides. Intentional
overrides of base-editor methods are declared in the module registration call.

## Module order

1. `KNH_ZXC_EventEditor_Timeline_Shared.js`
   - Shared constants and utility functions
   - Track access, UID lookup, and canonical command sorting
   - Preview character class and the animation-position engine patch
2. `KNH_ZXC_EventEditor_Timeline_Core.js`
   - Editor lifecycle and UI construction
   - Command catalogs and command insertion
3. `KNH_ZXC_EventEditor_Timeline_Schema.js`
   - Command schemas and schema-driven form controls
4. `KNH_ZXC_EventEditor_Timeline_Preview.js`
   - Command editor dialogs and visual/map previews
5. `KNH_ZXC_EventEditor_Timeline_Render.js`
   - Timeline workspace model, branch state, layout, and canvas rendering
6. `KNH_ZXC_EventEditor_Timeline_Input.js`
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

## Change rules

- Put environment-independent primitives in `Timeline_Shared`.
- Do not duplicate engine patches or fallback implementations in feature files.
- Keep compatibility wrappers when renaming a prototype method used by existing
  editor code or debug tooling.
- Mutations must mark the selected track dirty and rebuild the schedule through
  the existing editing flow.
- Rendering may use read-only per-draw caches; caches must be cleared at the end
  of the draw and must never own mutable track state.
