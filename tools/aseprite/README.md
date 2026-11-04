# Yurayura for Aseprite

`yurayura.lua` is a standalone Aseprite script. It creates the two distorted
poses used by `command_saveYurayuraBitmap()` in `KNH_ZXC_System.js`.

## Install and run

1. In Aseprite, choose File > Scripts > Open Scripts Folder.
2. Copy `yurayura.lua` into that folder.
3. Choose File > Scripts > Rescan Scripts Folder.
4. Open your artwork and select its source frame.
5. Run File > Scripts > yurayura, adjust Shake while watching the animation,
   then click Create. Cancel closes the preview without modifying the document.

On this PC the installed menu name is the Japanese "Yura animation" name.
Its position was checked in the running Aseprite Scripts menu after rescanning.
Do not infer that menu's order from Windows, Unicode order, or punctuation
prefixes. The old installed filename was renamed so only one entry remains.

The source frame becomes the middle frame of `A / original / B`. Exactly two
frames are inserted, so a one-frame sprite becomes a three-frame animation.
The generated poses occupy a new top-level layer; the original frame keeps its
editable layers. The new three-frame tag can be used for playback or export.
Ctrl+Z reverses the whole operation. Running the script again adds another pair;
undo first when trying a different setting for the same original.

## Settings

Shake (%) is the only setting: 0 to 200%, with 100% equal to +/-1 px per axis
(the game's `maxShake=10`). The animated canvas updates while moving the slider.
The pattern stays fixed while adjusting its strength, and Create uses the exact
previewed images. Transparency is shown over a checkerboard. No document edits
are made until Create is pressed; Cancel and closing the dialog stop the timer.

The grid is automatic, approximately 8 px in each direction. Counts are
`ceil(width / 8)` and `ceil(height / 8)` and cells are evenly spaced. All three
frames use 167 ms (about 6 fps). A new random seed is chosen when opening the
preview. The used seed is recorded in layer User Data for reproducibility.

## Rendering and supported artwork

The input is the selected frame's visible composite, using the full canvas,
including its transparent margins. Grid vertices move independently, including
outer vertices. Each cell uses the same two triangles as `PIXI.mesh.Plane`.
Pixels are sampled with nearest-neighbor interpolation; colors and alpha are
copied without applying the game's optional color mask.

Each distorted mesh is cropped to its geometric bounds, then centered
horizontally and bottom-aligned, matching the game's save layout. The canvas
size stays fixed. Pixels extending outside a frame are clipped at that frame's
edges; they cannot spill into the neighboring animation frame.

RGB, grayscale, and transparent-layer indexed sprites with a single palette
are supported. Indexed backgrounds and animated indexed palettes must be
converted to RGB first (Sprite > Color Mode > RGB). In RGB/grayscale sprites,
a background layer is converted to a normal layer in the same undo operation
so that generated frames can have transparent edges. Hidden layers and existing
unrelated frames are kept. Generated poses are flattened; the source pose
remains layered.

The random generator is local and reproducible. It does not reproduce an
existing game's random cache. Software triangle rasterization can also differ
from WebGL at pixel boundaries; a pixel-for-pixel GPU match is not promised.

## Batch use and verification

The dialog is skipped in batch mode. For example, in PowerShell:

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe' `
  --batch 'artwork.png' --script-param seed=123 `
  --script 'tools/aseprite/yurayura.lua' --save-as 'artwork-yura.aseprite'
```

Run the integration tests with the installed Aseprite runtime:

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe' `
  --batch --script 'tools/aseprite/tests/yurayura_test.lua'
```

The animated canvas, strength control, Create, Cancel, and timer cleanup are
also checked in a separate hidden Aseprite UI process:

```powershell
node tools/aseprite/tests/run_preview_test.cjs
```
