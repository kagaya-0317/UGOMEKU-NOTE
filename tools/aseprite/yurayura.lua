-- Generate the A / original / B frames used by saveYurayuraBitmap.
-- Copy this file into Aseprite's scripts folder. No other files are needed.
local Yura = {}
local GRID_SIZE = 8
local floor, ceil, min, max = math.floor, math.ceil, math.min, math.max

function Yura.grid(width, height)
  return max(1, ceil(width / GRID_SIZE)), max(1, ceil(height / GRID_SIZE))
end

local function number(value, default, low, high, name)
  if value == nil then value = default end
  value = tonumber(value)
  if not value or value ~= value or value < low or value > high then
    error(name .. " must be between " .. low .. " and " .. high .. ".", 0)
  end
  return value
end

local function randomGenerator(seed)
  -- Local Park-Miller RNG; do not change Aseprite's global random state.
  return function()
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  end
end

function Yura.mesh(width, height, amplitude, random)
  local cols, rows = Yura.grid(width, height)
  local vertices = {}
  for row = 0, rows do
    for col = 0, cols do
      local sx, sy = width * col / cols, height * row / rows
      vertices[#vertices + 1] = {
        x = sx + (random() - 0.5) * amplitude * 2,
        y = sy + (random() - 0.5) * amplitude * 2,
        sx = sx, sy = sy
      }
    end
  end
  return vertices, cols, rows
end

local function edge(a, b, x, y)
  return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
end

local function topLeft(a, b)
  local dy = b.y - a.y
  return dy < 0 or (dy == 0 and b.x > a.x)
end

local function inside(value, inclusive)
  return value > 0 or (value == 0 and inclusive)
end

local function triangle(source, output, a, b, c, clip)
  local area = edge(a, b, c.x, c.y)
  if math.abs(area) < 1e-12 then return end
  if area < 0 then b, c, area = c, b, -area end

  local x0 = max(clip.x0, ceil(min(a.x, b.x, c.x) - 0.5))
  local x1 = min(clip.x1, floor(max(a.x, b.x, c.x) - 0.5))
  local y0 = max(clip.y0, ceil(min(a.y, b.y, c.y) - 0.5))
  local y1 = min(clip.y1, floor(max(a.y, b.y, c.y) - 0.5))
  local ab, bc, ca = topLeft(a, b), topLeft(b, c), topLeft(c, a)
  local invArea = 1 / area
  local sw, sh = source.width, source.height

  -- Sample destination pixel centers, then invert the triangle's affine map.
  -- A half-open edge rule gives adjacent triangles a shared, seamless edge.
  for y = y0, y1 do
    for x = x0, x1 do
      local wa = edge(b, c, x + 0.5, y + 0.5)
      local wb = edge(c, a, x + 0.5, y + 0.5)
      local wc = edge(a, b, x + 0.5, y + 0.5)
      if inside(wa, bc) and inside(wb, ca) and inside(wc, ab) then
        local sx = min(sw - 1, max(0, floor(
          (wa * a.sx + wb * b.sx + wc * c.sx) * invArea)))
        local sy = min(sh - 1, max(0, floor(
          (wa * a.sy + wb * b.sy + wc * c.sy) * invArea)))
        output:drawPixel(x, y, source:getPixel(sx, sy))
      end
    end
  end
end

function Yura.render(source, vertices, cols, rows)
  local left, top, right, bottom = math.huge, math.huge, -math.huge, -math.huge
  for _, v in ipairs(vertices) do
    left, top = min(left, v.x), min(top, v.y)
    right, bottom = max(right, v.x), max(bottom, v.y)
  end

  -- PIXI generateTexture truncates the mesh bounds to an integer size.
  -- saveYurayuraBitmap then centers that extracted image and bottom-aligns it.
  local renderW, renderH = max(1, floor(right - left)), max(1, floor(bottom - top))
  local dx, dy = floor((source.width - renderW) / 2), source.height - renderH
  local clip = {
    x0 = max(0, dx), y0 = max(0, dy),
    x1 = min(source.width - 1, dx + renderW - 1),
    y1 = min(source.height - 1, dy + renderH - 1)
  }
  local positioned = {}
  for i, v in ipairs(vertices) do
    positioned[i] = { x = v.x - left + dx, y = v.y - top + dy,
                      sx = v.sx, sy = v.sy }
  end

  local output = Image(source.spec)
  output:clear()
  for row = 0, rows - 1 do
    for col = 0, cols - 1 do
      local i = row * (cols + 1) + col + 1
      local a, b = positioned[i], positioned[i + 1]
      local c, d = positioned[i + cols + 1], positioned[i + cols + 2]
      -- Same diagonal and draw order as PIXI.mesh.Plane.
      triangle(source, output, a, b, c, clip)
      triangle(source, output, b, d, c, clip)
    end
  end
  return output
end

local function uniqueTagName(sprite)
  local names = {}
  for _, tag in ipairs(sprite.tags) do names[tag.name] = true end
  local name, index = "Yurayura", 1
  while names[name] do
    index = index + 1
    name = "Yurayura " .. index
  end
  return name
end

function Yura.capture(sprite, frameNumber)
  if not sprite then error("Open a sprite first.", 0) end
  if not sprite.frames[frameNumber] then error("Select a source frame first.", 0) end
  if sprite.colorMode == ColorMode.INDEXED and #sprite.palettes > 1 then
    error("Animated palettes are not supported. Convert this sprite to RGB first.", 0)
  end
  if sprite.colorMode == ColorMode.INDEXED and sprite.backgroundLayer then
    -- Its transparent index can be opaque on the background, and converting
    -- that layer would change the source pose and generated normal-layer cels.
    error("Indexed background layers need RGB. Convert this sprite to RGB first.", 0)
  end

  local source = Image(sprite.spec)
  source:clear()
  source:drawSprite(sprite, frameNumber)
  if source:isEmpty() then error("The selected frame has no visible pixels.", 0) end
  return source
end

function Yura.generate(source, shake, requestedSeed)
  local amplitude = number(shake, 1, 0, 2, "Shake (+/- px)")
  local seed = number(requestedSeed, 0, 0, 2147483646, "Seed")
  if seed ~= floor(seed) then error("Seed must be a whole number.", 0) end
  if seed == 0 then
    seed = (os.time() + floor(os.clock() * 1000000)) % 2147483646 + 1
  end

  local random = randomGenerator(seed)
  local meshA, cols, rows = Yura.mesh(source.width, source.height, amplitude, random)
  local meshB = Yura.mesh(source.width, source.height, amplitude, random)
  local imageA = Yura.render(source, meshA, cols, rows)
  local imageB = Yura.render(source, meshB, cols, rows)
  return { images = { imageA, source, imageB }, cols = cols, rows = rows,
           seed = seed, shake = amplitude }
end

function Yura.commit(sprite, frameNumber, prepared, duration)
  local milliseconds = floor(number(duration, 167, 1, 65535, "Frame ms") + 0.5)
  local layer, tag
  local tagName = uniqueTagName(sprite)

  app.transaction("Create Yurayura frames", function()
    -- A background layer otherwise fills both empty frames with opaque pixels.
    -- The command also participates in this single undo operation.
    if sprite.backgroundLayer then
      app.layer = sprite.backgroundLayer
      app.command.LayerFromBackground()
      if sprite.backgroundLayer then error("Could not convert the background layer.", 0) end
    end
    sprite:newEmptyFrame(frameNumber)
    sprite:newEmptyFrame(frameNumber + 2)
    layer = sprite:newLayer()
    layer.name = tagName
    layer.data = string.format("Yurayura: grid=8 shake=%g seed=%d", prepared.shake, prepared.seed)
    sprite:newCel(layer, frameNumber, prepared.images[1], Point(0, 0))
    sprite:newCel(layer, frameNumber + 2, prepared.images[3], Point(0, 0))
    for i = frameNumber, frameNumber + 2 do
      sprite.frames[i].duration = milliseconds / 1000
    end
    tag = sprite:newTag(frameNumber, frameNumber + 2)
    tag.name = tagName
    tag.aniDir = AniDir.FORWARD
  end)

  app.layer = layer
  app.frame = frameNumber
  app.refresh()
  return { layer = layer, tag = tag, firstFrame = frameNumber,
           centerFrame = frameNumber + 1, lastFrame = frameNumber + 2,
           cols = prepared.cols, rows = prepared.rows, seed = prepared.seed }
end

function Yura.apply(sprite, frameNumber, options)
  options = options or {}
  local source = Yura.capture(sprite, frameNumber)
  -- Finish the expensive work before modifying the document.
  local prepared = Yura.generate(source, options.shake, options.seed)
  return Yura.commit(sprite, frameNumber, prepared, options.duration)
end

function Yura.previewDialog(sprite, frameNumber)
  local source = Yura.capture(sprite, frameNumber)
  local state = { frame = 1, elapsed = 0, accepted = false }
  state.prepared = Yura.generate(source, 1, 0)

  function state:refresh()
    local shake = self.dialog.data.shake / 100
    if shake == self.prepared.shake then return false end
    -- Reuse the seed so moving the slider changes only the amplitude.
    self.prepared = Yura.generate(source, shake, self.prepared.seed)
    self.dialog:repaint()
    return true
  end

  function state:paint(gc)
    local image = self.prepared.images[self.frame]
    local scale = min(4, (gc.width - 24) / image.width, (gc.height - 32) / image.height)
    if scale >= 1 then scale = floor(scale) end
    local w, h = max(1, floor(image.width * scale)), max(1, floor(image.height * scale))
    local x, y = floor((gc.width - w) / 2), floor((gc.height - 16 - h) / 2)
    gc.antialias = false
    gc.color = Color { r = 218, g = 222, b = 224 }
    gc:fillRect(Rectangle(0, 0, gc.width, gc.height))
    for cy = y, y + h - 1, 12 do
      for cx = x, x + w - 1, 12 do
        local dark = (floor((cx - x) / 12) + floor((cy - y) / 12)) % 2 == 0
        gc.color = dark and Color { r = 189, g = 196, b = 199 }
                        or Color { r = 238, g = 240, b = 241 }
        gc:fillRect(Rectangle(cx, cy, min(12, x + w - cx), min(12, y + h - cy)))
      end
    end
    gc:drawImage(image, Rectangle(0, 0, image.width, image.height), Rectangle(x, y, w, h))
    gc.color = Color { r = 71, g = 78, b = 81 }
    local label = ({ "A", "Original", "B" })[self.frame]
    local textSize = gc:measureText(label)
    gc:fillText(label, floor((gc.width - textSize.width) / 2), gc.height - 13)
  end

  local dialog = Dialog {
    title = "Yurayura",
    onclose = function() if state.timer then state.timer:stop() end end
  }
  state.dialog = dialog
  function state:accept()
    self:refresh()
    self.accepted = true
    self.dialog:close()
  end
  dialog:canvas {
    id = "preview", width = 360, height = 260,
    onpaint = function(ev) state:paint(ev.context) end
  }
  dialog:newrow()
  dialog:slider {
    id = "shake", label = "Shake (%):", min = 0, max = 200, value = 100,
    onrelease = function() state:refresh() end
  }
  dialog:newrow()
  dialog:button {
    id = "create", text = "Create", focus = true,
    onclick = function() state:accept() end
  }
  dialog:button { id = "cancel", text = "Cancel" }
  state.timer = Timer {
    interval = 0.05,
    ontick = function()
      local ok, message = pcall(function()
        state:refresh()
        state.elapsed = state.elapsed + 0.05
        if state.elapsed >= 0.167 then
          state.elapsed = state.elapsed - 0.167
          state.frame = state.frame % 3 + 1
          dialog:repaint()
        end
      end)
      if not ok then
        state.failure = message
        state.timer:stop()
        dialog:close()
      end
    end
  }

  function state:run()
    self.timer:start()
    local ok, message = pcall(function() self.dialog:show() end)
    self.timer:stop()
    if not ok then error(message, 0) end
    if self.failure then error(self.failure, 0) end
    if self.accepted then return self.prepared end
    return nil
  end
  return state
end

-- Tests can load this self-contained file without opening the dialog.
if ... == "module" then return Yura end

local function main()
  local sprite, frame = app.sprite, app.frame
  if not sprite or not frame then error("Open a sprite and select a frame first.", 0) end
  if app.isUIAvailable then
    local prepared = Yura.previewDialog(sprite, frame.frameNumber):run()
    if prepared then Yura.commit(sprite, frame.frameNumber, prepared) end
  else
    Yura.apply(sprite, frame.frameNumber, {
      shake = app.params.shake, duration = app.params.duration, seed = app.params.seed
    })
  end
end

local ok, message = pcall(main)
if not ok then
  if app.isUIAvailable then
    app.alert { title = "Yurayura", text = tostring(message) }
  else
    error(message, 0)
  end
end
return Yura
