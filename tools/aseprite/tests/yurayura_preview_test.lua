-- Native dialog integration test. Run WITHOUT --batch in an isolated process.
local function log(message)
  io.stdout:write(message .. "\n")
  io.stdout:flush()
end
local path = app.params.script or app.fs.joinPath(
  app.fs.currentPath, "tools", "aseprite", "yurayura.lua")
local Yura = _G.YurayuraPreviewTestModule or assert(loadfile(path))("module")
local sprite = Sprite(41, 29)
local image = Image(41, 29)
for it in image:pixels() do
  it(app.pixelColor.rgba((it.x * 13) % 256, (it.y * 23) % 256,
                        ((it.x + it.y) * 31) % 256, 255))
end
sprite:newCel(sprite.layers[1], 1, image)

local activeState, observer
local ok, message = xpcall(function()
  local state = Yura.previewDialog(sprite, 1)
  activeState = state
  local seed, paints = state.prepared.seed, 0
  local originalPaint = state.paint
  function state:paint(gc)
    paints = paints + 1
    originalPaint(self, gc)
  end
  local ticks, failure = 0, nil
  local sawAnimation = false
  observer = Timer {
    interval = 0.09,
    ontick = function()
      local stepOk, stepMessage = xpcall(function()
        ticks = ticks + 1
        sawAnimation = sawAnimation or state.frame ~= 1
        assert(#sprite.frames == 1 and #sprite.layers == 1 and #sprite.tags == 0)
        assert(state.dialog.data.duration == nil and state.dialog.data.seed == nil)
        if ticks == 1 then
          state.dialog:modify { id = "shake", value = 145 }
          state:refresh()
          assert(math.abs(state.prepared.shake - 1.45) < 0.00001)
          assert(state.prepared.seed == seed)
        elseif ticks == 3 then
          state.dialog:modify { id = "shake", value = 0 }
          state:refresh()
          assert(state.prepared.images[1]:isEqual(image))
          assert(state.prepared.images[3]:isEqual(image))
          assert(state.prepared.seed == seed)
        elseif ticks >= 7 then
          assert(sawAnimation and paints > 1, "Canvas did not animate/paint")
          -- A last adjustment must be flushed even before the next timer tick.
          state.dialog:modify { id = "shake", value = 175 }
          state:accept()
          observer:stop()
        end
      end, debug.traceback)
      if not stepOk then
        failure = stepMessage
        observer:stop()
        state.dialog:close()
      end
    end
  }
  observer:start()
  local prepared = state:run()
  observer:stop()
  assert(not failure, failure)
  assert(prepared and math.abs(prepared.shake - 1.75) < 0.00001)
  assert(not state.timer.isRunning)
  log("PASS native canvas paints and animates with only a shake control")
  log("PASS strength changes preserve the seed; zero strength shows the original")
  local result = Yura.commit(sprite, 1, prepared)
  assert(result.layer:cel(1).image:isEqual(prepared.images[1]))
  assert(result.layer:cel(3).image:isEqual(prepared.images[3]))
  app.undo()
  assert(#sprite.frames == 1 and #sprite.layers == 1)
  assert(sprite.layers[1]:cel(1).image:isEqual(image))
  log("PASS Create commits the exact last preview; one Undo restores the document")

  state = Yura.previewDialog(sprite, 1)
  activeState = state
  observer = Timer {
    interval = 0.1,
    ontick = function()
      observer:stop()
      state.dialog:close()
    end
  }
  observer:start()
  assert(state:run() == nil)
  observer:stop()
  assert(not state.timer.isRunning)
  assert(#sprite.frames == 1 and #sprite.layers == 1 and #sprite.tags == 0)
  assert(sprite.layers[1]:cel(1).image:isEqual(image))
  log("PASS closing the preview cancels edits and stops its timer")
  log("All 4 native preview integration checks passed.")
end, debug.traceback)
if observer then observer:stop() end
if activeState then activeState.timer:stop(); activeState.dialog:close() end
if not ok then log("FAIL " .. tostring(message)) end
sprite:close()
app.exit()
