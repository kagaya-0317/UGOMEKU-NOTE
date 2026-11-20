# Connected spike floor polish

The room now draws its spike floor through one connected bitmap and one yura
filter. The native `$trap` sheet is sampled at a uniform 2x scale, aligned to
world coordinates across every hazard. Internal event-rectangle edges never
create texture seams or change the apparent size of the spikes.

The source frame's outer border is excluded from the repeated interior. Only
the eight safe islands have an inset plate/rim; half-step collision cells and
fence cutouts do not receive separate decorative boxes. A 30px graphic shift
centers the existing panel art on those islands without moving any event.

The surface is in the base spriteset before the character tilemap. Hidden trap
events keep their existing damage rectangles and native hit API, while their
individual character sprites do not allocate or update yura meshes. The one
surface uses the filter-based yura path and updates its bitmap texture after
each animation change. It is released normally when leaving the map.

Panel positions, routes, common event 41, progression, key pickup and all native
first-floor damage/return behavior are preserved. Map050, the native spike-floor
plugin, background PNGs and editable Aseprite artwork were not rewritten.

`verification.json` records the completed native walking/panel/hit/key/save/load
checks. `render-verification.json` records fixed 2x scale, one filter, zero
individual trap meshes, approximately 60 FPS and the unaffected 1F sprite.
`puzzle-overview.png` is the saved-implementation screenshot, and
`spike_panel_puzzle.mp4` is the revised gameplay video.

The earlier delivered video remains in the original puzzle artifact directory.
Only this task's obsolete takes and temporary video-check PNGs are cleaned after
the revised video passes decoding, sound and visual checks and is delivered.
