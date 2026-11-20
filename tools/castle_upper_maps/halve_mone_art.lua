local function main()
  local s=Sprite{fromFile=app.params.source}
  assert(s.width==144 and s.height==1152,'Unexpected source layout')
  local layers={}
  local function collect(list)
    for _,l in ipairs(list) do if l.isGroup then collect(l.layers) else layers[#layers+1]=l end end
  end
  collect(s.layers)
  for _,layer in ipairs(layers) do for n=1,#s.frames do
    local cel=layer:cel(n)
    if cel then
      local original=Image(s.width,s.height,ColorMode.RGB)
      original:drawImage(cel.image,cel.position)
      local result=Image(s.width,s.height,ColorMode.RGB)
      for row=0,7 do
        local crop=Sprite(144,144,ColorMode.RGB)
        crop.cels[1].image:drawImage(original,Point(0,-row*144))
        crop:resize(72,72)
        result:drawImage(crop.cels[1].image,Point(36,row*144+69))
        crop:close()
      end
      cel.image=result;cel.position=Point(0,0)
    end
  end end
  s:saveAs(app.params.source);s:close()
  -- Reopen the real saved source, then render the current graphics at full opacity.
  s=Sprite{fromFile=app.params.source}
  local draft,clean
  for _,l in ipairs(s.layers) do if l.name=='下書き' then draft=l elseif l.name=='清書' then clean=l end end
  assert(draft and clean)
  draft.isVisible=false
  local hasClean=false
  for n=1,#s.frames do local im=Image(s.width,s.height,ColorMode.RGB);im:drawSprite(s,n);if not im:isEmpty() then hasClean=true end end
  if not hasClean then clean.isVisible=false;draft.isVisible=true;draft.opacity=255 end
  local out=Image(s.width*#s.frames,s.height,ColorMode.RGB)
  for n=1,#s.frames do local im=Image(s.width,s.height,ColorMode.RGB);im:drawSprite(s,n);out:drawImage(im,Point((n-1)*s.width,0)) end
  out:saveAs(app.params.runtime)
  local reopened=Image{fromFile=app.params.runtime}
  assert(reopened.bytes==out.bytes,'Runtime roundtrip mismatch')
  s:close()
end
local ok,err=xpcall(main,debug.traceback)
local f=assert(io.open(app.params.log,'wb'));f:write(ok and 'OK' or err);f:close();if not ok then error(err) end
