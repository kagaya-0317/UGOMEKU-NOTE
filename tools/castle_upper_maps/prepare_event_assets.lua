-- Native Aseprite assembly: temporary sprite formats and simple geometric keys.
local function main()
local root=assert(app.params.root)
local ink=app.pixelColor.rgba(71,78,81,255)
local white=app.pixelColor.rgba(255,255,255,255)
local alpha=app.pixelColor.rgbaA
local function fitted(file,rect)
  local s=Sprite{fromFile=file}
  app.activeSprite=s
  if s.colorMode~=ColorMode.RGB then app.command.ChangePixelFormat{format='rgb'} end
  local original=s.cels[1].image
  local image=Image(rect and rect.w or s.width,rect and rect.h or s.height,ColorMode.RGB)
  image:drawImage(original,Point(s.cels[1].position.x-(rect and rect.x or 0),s.cels[1].position.y-(rect and rect.y or 0)))
  local minx,miny,maxx,maxy=image.width,image.height,-1,-1
  for it in image:pixels() do
    local c=it()
    if alpha(c)<180 then it(0) else
      if (app.pixelColor.rgbaR(c)+app.pixelColor.rgbaG(c)+app.pixelColor.rgbaB(c))/3>195 then it(white) else it(ink) end
      minx=math.min(minx,it.x);miny=math.min(miny,it.y);maxx=math.max(maxx,it.x);maxy=math.max(maxy,it.y)
    end
  end
  assert(maxx>=minx,'Empty sprite: '..file)
  local crop=Sprite(maxx-minx+1,maxy-miny+1,ColorMode.RGB)
  crop.cels[1].image:drawImage(image,Point(-minx,-miny))
  local scale=math.min(124/crop.width,124/crop.height)
  crop:resize(math.max(1,math.floor(crop.width*scale)),math.max(1,math.floor(crop.height*scale)))
  local cell=Image(144,144,ColorMode.RGB)
  cell:drawImage(crop.cels[1].image,Point(math.floor((144-crop.width)/2),138-crop.height))
  s:close();crop:close()
  return cell
end
local function sheet(name,folder,cell,cols,rows)
  local s=Sprite(cols*144,rows*144,ColorMode.RGB)
  s.layers[1].name='Temporary sprite'
  for y=0,rows-1 do for x=0,cols-1 do s.cels[1].image:drawImage(cell,Point(x*144,y*144)) end end
  s:saveAs(root..'../aseprite/'..name..'.aseprite')
  s:saveCopyAs(root..'img/'..folder..'/'..name..'.png')
  print(folder..'/'..name..' '..s.width..'x'..s.height)
  s:close()
end
local beast=fitted(assert(app.params.beast))
sheet('castleBeast_tmp','sv_actors',beast,1,1)
sheet('$castleBeast_tmp','characters',beast,3,4)
sheet('castleMone_tmp','sv_enemies',fitted(root..'img/characters/$kanbu3.png',{x=160,y=0,w=160,h=160}),1,8)
sheet('castleTsunehi_tmp','sv_enemies',fitted(root..'img/characters/$kanbu2.png',{x=0,y=0,w=288,h=320}),1,8)
local s=Sprite(576,288,ColorMode.RGB)
s.layers[1].name='Temporary keys'
local im=s.cels[1].image
local function line(x1,y1,x2,y2,width)
  local dx,dy=x2-x1,y2-y1
  local length=dx*dx+dy*dy
  for y=math.max(0,math.floor(math.min(y1,y2)-width)),math.min(287,math.ceil(math.max(y1,y2)+width)) do
    for x=math.max(0,math.floor(math.min(x1,x2)-width)),math.min(575,math.ceil(math.max(x1,x2)+width)) do
      local t=math.max(0,math.min(1,((x-x1)*dx+(y-y1)*dy)/length))
      if (x-x1-t*dx)^2+(y-y1-t*dy)^2<width^2 then im:drawPixel(x,y,ink) end
    end
  end
end
for y=20,70 do for x=46,98 do local d=math.sqrt((x-72)^2+(y-45)^2);if d>17 and d<23 then im:drawPixel(x,y,ink) end end end
line(72,67,72,124,3);line(72,105,91,105,3);line(72,119,86,119,3)
line(216,22,191,65,3);line(191,65,241,65,3);line(241,65,216,22,3)
line(216,65,216,124,3);line(216,105,235,105,3);line(216,119,230,119,3)
s:saveAs(root..'../aseprite/Item9.aseprite')
s:saveCopyAs(root..'img/items/Item9.png')
s:close()
end
local ok,err=xpcall(main,debug.traceback)
local log=assert(io.open(app.params.log,'wb'))
log:write(ok and 'OK' or tostring(err));log:close()
if not ok then error(err) end
