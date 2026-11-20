# Spike floor and toggle-panel room

Map061 replaces the forced-success placeholder with eight editor-owned panels
and a branching network of timed spike crossings. Persistent spike fields fill
the surrounding floor so shortcuts also use the original spike-floor response.
Existing background art, editable Aseprite files and terrain data are unchanged.

- Panels are events 5-12. They all call common event 41; the common event waits
  for the player's half-step to land and invokes the one shared toggle method.
- Self switch A is each panel's ON state. Standing still does not toggle it;
  deliberate reentry does. Followers do not operate panels.
- All trap hits go through the existing `command_updateSpikeFloor` API. Its
  source and Map050 are unchanged. HP damage, visible follower hits, animation
  and return to the preceding safe floor retain their original behavior.
- Damage never clears the panels. A return landing is latched so it cannot
  unintentionally toggle the panel under the character.
- Variable 65 is 0 before instructions, 1 while active and 2 after all eight
  panels are ON. Panel states persist across saving and reentry.
- Completion stops all spikes, shows the key area, unlocks the existing chest
  and B2 exit, and restores the native camera. Leaving an incomplete room also
  releases the temporary fixed camera.
- Trap size, cycle phase and type are stored in each event's note. Rectangles
  are relative to the saved editor/half-step position; initialization never
  relocates events. Panel pages keep the existing `$switch` graphics and the
  trap renderer reuses the existing `$trap` sheet. No new image assets are used.

`plan.json` records the board, crossings and one valid route for authoring/QA.
The builder refuses concurrently changed inputs and must not be run over user
edits. The older upper-castle event generator still describes the former room;
do not use it to replace this map.

Validation is performed in the dedicated castle-map QA profile and temporary
save directory. `verification.json` covers native walking, completion, key
pickup, serialization and reentry; `boundary-verification.json` also covers
partial progress and the unchanged first-floor behavior. The video demonstrates
entry, ON/OFF toggling, a native hit and safe return with retained panel state,
all eight panels, the real key pickup and the return to 3F.

The completed video is `spike_panel_puzzle.mp4`; `puzzle-overview.png` is the
saved-implementation screenshot. Recording intermediates are kept only until
the final video passes duration, full decoding, sound and visual checks.
