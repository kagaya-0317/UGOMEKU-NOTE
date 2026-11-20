-- Build editable, native-size sheets without modifying the source artwork.
local function main()
  local f=assert(io.open(app.params.plan,'rb'))
  local plan=json.decode(f:read('*a'));f:close()
  local function imageFrom(file)
    if file:lower():sub(-4)=='.png' then return Image{fromFile=file} end
    local s=Sprite{fromFile=file}
    local im=Image(s.width,s.height,ColorMode.RGB)
    im:drawSprite(s,1);s:close();return im
  end
  for _,a in ipairs(plan.assets) do
    local s=Sprite(a.width,a.height,ColorMode.RGB)
    local empty=s.layers[1]
    local draft=s:newGroup();draft.name='下書き';draft.opacity=100
    for _,p in ipairs(a.parts) do
      local original=imageFrom(p.file)
      local im=Image(p.w,p.h,ColorMode.RGB)
      im:drawImage(original,Point(-p.sx,-p.sy))
      local l=s:newLayer();l.name=p.name;l.parent=draft
      s:newCel(l,1,im,Point(p.x,p.y));l.isEditable=false
    end
    draft.isEditable=false
    local clean=s:newGroup();clean.name='清書'
    for _,p in ipairs(a.parts) do
      local l=s:newLayer();l.name=p.name;l.parent=clean
    end
    s:deleteLayer(empty)
    s.gridBounds=Rectangle(0,0,a.cellWidth or a.width,a.cellHeight or a.height)
    s.selection:deselect()
    app.activeSprite=s;app.layer=clean.layers[1]
    s:saveAs(a.editable)
    -- Reopen the actual saved file and render its draft at full opacity.
    s:close();s=Sprite{fromFile=a.editable}
    s.layers[1].opacity=255
    local proof=Image(s.width,s.height,ColorMode.RGB)
    proof:drawSprite(s,1)
    proof:saveAs(a.proof)
    assert(#s.layers==2 and s.layers[1].name=='下書き' and s.layers[2].name=='清書')
    s:close();print(a.name)
  end
end
local ok,err=xpcall(main,debug.traceback)
local f=assert(io.open(app.params.log,'wb'));f:write(ok and 'OK' or err);f:close()
if not ok then error(err) end
