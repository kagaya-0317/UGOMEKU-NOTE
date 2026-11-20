-- Export approved background art in the project's native page formats.
local cfgFile = assert(io.open(app.params.config, 'rb'))
local cfg = json.decode(cfgFile:read('*a'))
cfgFile:close()
local ink = app.pixelColor.rgba(71,78,81,255)
local white = app.pixelColor.rgba(255,255,255,255)
for _,v in ipairs(cfg.sources) do
  if not app.params.map or app.params.map == v.key then
  local s=Sprite{fromFile=v.source}
  s:resize(v.width,v.height)
  s.layers[1].name='Background'
  for _,cel in ipairs(s.cels) do
    for it in cel.image:pixels() do
      local c=it()
      if (app.pixelColor.rgbaR(c)+app.pixelColor.rgbaG(c)+app.pixelColor.rgbaB(c))/3 < 195 then it(ink)
      else it(white) end
    end
  end
  s:saveAs(cfg.root..'../aseprite/'..v.name..'.aseprite')
  s:saveCopyAs(cfg.root..'img/parallaxes/'..v.name..'.png')
  print(v.name..' '..v.width..'x'..v.height)
  s:close()
  end
end
