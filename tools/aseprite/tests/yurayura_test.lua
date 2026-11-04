-- Run with Aseprite --batch --script tools/aseprite/tests/yurayura_test.lua.
local report = app.params.report and assert(io.open(app.params.report, "w"))
local function log(message)
  print(message)
  if report then report:write(message .. "\n"); report:flush() end
end
local path = app.params.script or app.fs.joinPath(
  app.fs.currentPath, "tools", "aseprite", "yurayura.lua")
local Yura = assert(loadfile(path))("module")
local passed = 0
local black = app.pixelColor.rgba(71, 78, 81, 255)
local white = app.pixelColor.rgba(255, 255, 255, 255)

local function check(name, fn)
  local ok, message = xpcall(fn, debug.traceback)
  if not ok then
    log("FAIL " .. name .. "\n" .. tostring(message))
    error(message, 0)
  end
  passed = passed + 1
  log("PASS " .. name)
end

local function composite(sprite, frame)
  local image = Image(sprite.spec)
  image:clear()
  image:drawSprite(sprite, frame)
  return image
end

local function patterned(width, height)
  local image = Image(width, height, ColorMode.RGB)
  for it in image:pixels() do
    it(app.pixelColor.rgba((it.x * 13) % 256, (it.y * 23) % 256,
                          ((it.x + it.y) * 31) % 256,
                          ((it.x + it.y) % 3 == 0) and 117 or 255))
  end
  return image
end

local function same(a, b, message)
  assert(a:isEqual(b), message or "Images differ")
end

check("automatic grid fits both dimensions", function()
  local cols, rows = Yura.grid(101, 37)
  assert(cols == 13 and rows == 5)
  assert(101 / cols <= 8 and 37 / rows <= 8)
  cols, rows = Yura.grid(1, 7)
  assert(cols == 1 and rows == 1)
end)

check("identity mesh has no seams and preserves exact RGBA", function()
  for _, size in ipairs({ {1, 1}, {1, 37}, {37, 1}, {7, 5}, {16, 16}, {101, 37} }) do
    local image = patterned(size[1], size[2])
    local vertices, cols, rows = Yura.mesh(image.width, image.height, 0, function() return 0.5 end)
    same(image, Yura.render(image, vertices, cols, rows), "Identity failed at " .. size[1] .. "x" .. size[2])
  end
end)

check("bounds extraction removes a uniform vertex translation", function()
  local image = patterned(19, 29)
  local vertices, cols, rows = Yura.mesh(19, 29, 0, function() return 0.5 end)
  for _, v in ipairs(vertices) do v.x, v.y = v.x - 7.375, v.y + 3.125 end
  same(image, Yura.render(image, vertices, cols, rows))
end)

check("shrunk mesh is centered horizontally and bottom-aligned", function()
  local image = Image(16, 16)
  image:clear(black)
  local vertices, cols, rows = Yura.mesh(16, 16, 0, function() return 0.5 end)
  for _, v in ipairs(vertices) do v.x, v.y = v.x * 0.75, v.y * 0.75 end
  local output = Yura.render(image, vertices, cols, rows)
  for it in output:pixels() do
    local expected = it.x >= 2 and it.x < 14 and it.y >= 4
    assert(it() == (expected and black or 0), "Incorrect bounds alignment")
  end
end)

check("layered source is unchanged and only two frames are inserted", function()
  local sprite = Sprite(41, 29)
  local base = sprite.layers[1]
  base.name = "Editable source"
  sprite:newCel(base, 1, patterned(27, 17), Point(4, 6))
  local group = sprite:newGroup()
  group.name = "Details"
  local detail = sprite:newLayer()
  detail.parent = group
  local dot = Image(3, 3)
  dot:clear(white)
  sprite:newCel(detail, 1, dot, Point(11, 12)).opacity = 191
  local hidden = sprite:newLayer()
  hidden.isVisible = false
  local red = Image(41, 29)
  red:clear(app.pixelColor.rgba(255, 0, 0, 255))
  sprite:newCel(hidden, 1, red)
  sprite:newEmptyFrame(2)
  sprite:newCel(base, 2, dot, Point(20, 10))
  sprite.frames[1].duration = 0.321
  sprite.frames[2].duration = 0.456
  local before, after = composite(sprite, 1), composite(sprite, 2)
  app.frame = 1
  local result = Yura.apply(sprite, 1, { seed = 1234 })
  assert(#sprite.frames == 4)
  assert(result.firstFrame == 1 and result.centerFrame == 2 and result.lastFrame == 3)
  same(before, composite(sprite, 2), "Source composite changed")
  same(after, composite(sprite, 4), "Unrelated frame changed")
  assert(base:cel(2).position.x == 4 and base:cel(2).position.y == 6)
  assert(detail.parent == group and detail:cel(2).opacity == 191)
  assert(hidden:cel(2) and not hidden.isVisible)
  assert(not base:cel(1) and not base:cel(3) and not detail:cel(1))
  assert(not result.layer:cel(2))
  assert(result.layer.parent == sprite and result.layer == sprite.layers[#sprite.layers])
  assert(result.tag.fromFrame.frameNumber == 1 and result.tag.toFrame.frameNumber == 3)
  assert(math.abs(sprite.frames[1].duration - 0.167) < 0.0001)
  assert(math.abs(sprite.frames[4].duration - 0.456) < 0.0001)
  assert(not composite(sprite, 1):isEqual(before), "A did not distort")
  assert(not composite(sprite, 1):isEqual(composite(sprite, 3)), "A and B are identical")
  app.undo()
  assert(#sprite.frames == 2 and #sprite.tags == 0 and #sprite.layers == 3)
  same(before, composite(sprite, 1), "Undo did not restore source")
  same(after, composite(sprite, 2), "Undo did not restore later frame")
  assert(math.abs(sprite.frames[1].duration - 0.321) < 0.0001)
  app.redo()
  assert(#sprite.frames == 4 and #sprite.tags == 1)
end)

check("middle-frame insertion preserves preceding and following frames", function()
  local sprite = Sprite(25, 19)
  local base = sprite.layers[1]
  for i = 1, 3 do
    if i > 1 then sprite:newEmptyFrame(i) end
    local image = Image(25, 19)
    image:clear(app.pixelColor.rgba(i * 50, 78, 81, 255))
    sprite:newCel(base, i, image)
  end
  local first, middle, last = composite(sprite, 1), composite(sprite, 2), composite(sprite, 3)
  app.frame = 2
  Yura.apply(sprite, 2, { seed = 9 })
  assert(#sprite.frames == 5)
  same(first, composite(sprite, 1))
  same(middle, composite(sprite, 3))
  same(last, composite(sprite, 5))
end)

check("seed repeats poses and sampling keeps original pixel values", function()
  local a = Sprite(32, 24)
  local input = patterned(32, 24)
  a:newCel(a.layers[1], 1, input)
  local source = composite(a, 1)
  local colors = {}
  for it in source:pixels() do colors[it()] = true end
  local ra = Yura.apply(a, 1, { seed = 927, shake = 0.75 })
  local imageA, imageB = Image(ra.layer:cel(1).image), Image(ra.layer:cel(3).image)
  local b = Sprite(32, 24)
  b:newCel(b.layers[1], 1, input)
  local rb = Yura.apply(b, 1, { seed = 927, shake = 0.75 })
  same(imageA, rb.layer:cel(1).image)
  same(imageB, rb.layer:cel(3).image)
  for _, image in ipairs({ imageA, imageB }) do
    for it in image:pixels() do
      assert(it() == 0 or colors[it()], "Sampling introduced a new color/alpha")
    end
  end
end)

check("background conversion and its undo preserve the source", function()
  for _, mode in ipairs({ ColorMode.RGB, ColorMode.GRAY }) do
    local sprite = Sprite(24, 24, mode)
    local input = Image(sprite.spec)
    if mode == ColorMode.RGB then
      input = patterned(24, 24)
    else
      input:clear(app.pixelColor.graya(78, 255))
    end
    sprite:newCel(sprite.layers[1], 1, input)
    app.command.BackgroundFromLayer()
    assert(sprite.backgroundLayer)
    local before = composite(sprite, 1)
    local visual = Image(24, 24, ColorMode.RGB)
    visual:drawSprite(sprite, 1)
    Yura.apply(sprite, 1, { seed = 4 })
    assert(not sprite.backgroundLayer)
    same(before, composite(sprite, 2))
    local afterVisual = Image(24, 24, ColorMode.RGB)
    afterVisual:drawSprite(sprite, 2)
    same(visual, afterVisual, "Background conversion changed visible colors/alpha")
    app.undo()
    assert(sprite.backgroundLayer and #sprite.frames == 1)
    same(before, composite(sprite, 1))
  end
end)

check("indexed backgrounds are rejected without changing visible artwork", function()
  local sprite = Sprite(16, 16, ColorMode.INDEXED)
  local input = Image(sprite.spec)
  input:clear(2)
  sprite:newCel(sprite.layers[1], 1, input)
  app.command.BackgroundFromLayer()
  sprite.backgroundLayer:cel(1).image:drawPixel(8, 8, 0)
  local before = Image(16, 16, ColorMode.RGB)
  before:drawSprite(sprite, 1)
  local ok, message = pcall(Yura.apply, sprite, 1, { seed = 4 })
  assert(not ok and message:find("RGB") and sprite.backgroundLayer)
  assert(#sprite.frames == 1 and #sprite.layers == 1 and #sprite.tags == 0)
  local after = Image(16, 16, ColorMode.RGB)
  after:drawSprite(sprite, 1)
  same(before, after)
end)

check("grayscale and nonzero indexed transparency are preserved", function()
  for _, mode in ipairs({ ColorMode.GRAY, ColorMode.INDEXED }) do
    local sprite = Sprite(23, 17, mode)
    if mode == ColorMode.INDEXED then sprite.transparentColor = 5 end
    local input = Image(sprite.spec)
    input:clear()
    for y = 3, 13 do
      for x = 4, 18 do
        input:drawPixel(x, y, mode == ColorMode.GRAY and app.pixelColor.graya(78, 131) or 2)
      end
    end
    sprite:newCel(sprite.layers[1], 1, input)
    local before = composite(sprite, 1)
    Yura.apply(sprite, 1, { seed = 234 })
    same(before, composite(sprite, 2))
    assert(sprite.colorMode == mode)
    assert(not composite(sprite, 1):isEmpty())
    if mode == ColorMode.INDEXED then assert(sprite.transparentColor == 5) end
  end
end)

check("empty frames and invalid settings cause no document changes", function()
  local sprite = Sprite(16, 16)
  local ok = pcall(Yura.apply, sprite, 1, { seed = 1 })
  assert(not ok and #sprite.frames == 1 and #sprite.layers == 1)
  local input = Image(16, 16)
  input:clear(black)
  sprite:newCel(sprite.layers[1], 1, input)
  for _, options in ipairs({ { shake = -1 }, { shake = 3 }, { seed = 1.5 }, { duration = 0 } }) do
    ok = pcall(Yura.apply, sprite, 1, options)
    assert(not ok and #sprite.frames == 1 and #sprite.layers == 1)
  end
end)

check("normal script entry point works in batch mode", function()
  local sprite = Sprite(24, 24)
  sprite:newCel(sprite.layers[1], 1, patterned(24, 24))
  assert(loadfile(path))()
  assert(#sprite.frames == 3 and #sprite.tags == 1)
end)

log(string.format("All %d Yurayura integration tests passed (%s).", passed, tostring(app.version)))
if report then report:close() end
