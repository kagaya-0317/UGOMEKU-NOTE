local function main()
  local function bounds(im,row)
    local x1,y1,x2,y2=144,144,-1,-1
    for y=0,143 do for x=0,143 do if app.pixelColor.rgbaA(im:getPixel(x,row*144+y))>0 then
      x1=math.min(x1,x);y1=math.min(y1,y);x2=math.max(x2,x);y2=math.max(y2,y)
    end end end
    return {left=x1,top=y1,right=x2,bottom=y2,width=x2-x1+1,height=y2-y1+1}
  end
  local before=Image{fromFile=app.params.before};local after=Image{fromFile=app.params.runtime}
  local s=Sprite{fromFile=app.params.source};assert(s.width==144 and s.height==1152)
  local draftOpacity
  for _,l in ipairs(s.layers) do if l.name=='下書き' then draftOpacity=l.opacity;l.opacity=255 end end
  local rendered=Image(s.width,s.height,ColorMode.RGB);rendered:drawSprite(s,1)
  assert(rendered.bytes==after.bytes,'Saved source and runtime differ')
  local report={nativeReopen=true,pixelsMatch=true,draftOpacity=draftOpacity,canvas={144,1152},rows={}}
  for row=0,7 do local a,b=bounds(before,row),bounds(after,row)
    assert(math.abs(a.width/2-b.width)<=1 and math.abs(a.height/2-b.height)<=1,'Not half-size')
    assert(math.abs(a.bottom-b.bottom)<=1,'Foot baseline moved')
    report.rows[#report.rows+1]={before=a,after=b}
  end
  s:close();local f=assert(io.open(app.params.report,'wb'));f:write(json.encode(report));f:close()
end
local ok,err=xpcall(main,debug.traceback);if not ok then error(err) end
