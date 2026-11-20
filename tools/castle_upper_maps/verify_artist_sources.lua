local function main()
  local f=assert(io.open(app.params.manifest,'rb'));local m=json.decode(f:read('*a'));f:close()
  if app.params.testOutput then
    local s=Sprite{fromFile=app.params.testOutput};local im=Image(s.width,s.height,ColorMode.RGB);im:drawSprite(s,1)
    local count=0;for it in im:pixels() do if app.pixelColor.rgbaA(it())>0 then count=count+1 end end
    assert(count==1,'Draft pixels leaked into cleanup export')
    assert(im:getPixel(20,30)==app.pixelColor.rgba(71,78,81,255));s:close();return
  end
  local function render(file)
    return Image{fromFile=file}
  end
  for _,a in ipairs(m.assets) do
    local s=Sprite{fromFile=a.editable};s.layers[1].opacity=255;s.layers[2].isVisible=false
    local draft=Image(s.width,s.height,ColorMode.RGB);draft:drawSprite(s,1);s:close()
    local current=render(a.runtime)
    assert(draft.width==current.width and draft.height==current.height,a.name..' size '..draft.width..'x'..draft.height..' vs '..current.width..'x'..current.height)
    -- Ignore RGB stored underneath fully transparent pixels.
    for it in draft:pixels() do local c=it();local d=current:getPixel(it.x,it.y)
      assert(c==d or app.pixelColor.rgbaA(c)==0 and app.pixelColor.rgbaA(d)==0,a.name..' pixels '..it.x..','..it.y)
    end
    print('MATCH '..a.name)
  end
  -- Exercise real cleanup export using a disposable native document.
  local a=m.assets[7];local s=Sprite{fromFile=a.editable}
  app.activeSprite=s
  local clean=s.layers[2].layers[1]
  local im=Image(s.width,s.height,ColorMode.RGB);im:drawPixel(20,30,app.pixelColor.rgba(71,78,81,255))
  s:newCel(clean,1,im,Point(0,0));s:saveAs(app.params.testSource);s:close()
end
local ok,err=xpcall(main,debug.traceback)
local f=assert(io.open(app.params.log,'wb'));f:write(ok and 'OK' or err);f:close();if not ok then error(err) end
