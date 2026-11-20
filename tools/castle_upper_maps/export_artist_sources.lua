-- Only explicit exports replace runtime PNGs. Blank cleanup sheets are skipped.
local function main()
  local f=assert(io.open(app.params.manifest,'rb'))
  local manifest=json.decode(f:read('*a'));f:close()
  for _,a in ipairs(manifest.assets) do
    local s=Sprite{fromFile=a.editable}
    local draft
    for _,l in ipairs(s.layers) do if l.name=='下書き' then draft=l;l.isVisible=false end end
    assert(draft,'Missing draft group: '..a.editable)
    local out=Image(s.width*#s.frames,s.height,ColorMode.RGB)
    for n=1,#s.frames do
      local im=Image(s.width,s.height,ColorMode.RGB);im:drawSprite(s,n)
      out:drawImage(im,Point((n-1)*s.width,0))
    end
    if out:isEmpty() then print('SKIP (blank cleanup): '..a.name)
    else out:saveAs(a.runtime);print('EXPORTED: '..a.name) end
    s:close()
  end
end
local ok,err=xpcall(main,debug.traceback)
local f=assert(io.open(app.params.log,'wb'));f:write(ok and 'OK' or err);f:close()
if not ok then error(err) end
