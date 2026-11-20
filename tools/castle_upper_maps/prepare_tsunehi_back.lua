-- Normalize the generated rear pose using the existing native asset workflow.
local source=Sprite{fromFile=assert(app.params.source)}
local root=assert(app.params.root)
local name=app.params.name or 'tsunehi_back'
local character=app.params.character or '$castleTsunehi_back'
local proof=app.params.proof or 'artifacts/tsunehi-prebattle-20261120/back_reopened.png'
local image=Image(source.width,source.height,ColorMode.RGB)
image:drawImage(source.cels[1].image,source.cels[1].position)
local minx,miny,maxx,maxy=image.width,image.height,-1,-1
local ink=app.pixelColor.rgba(71,78,81,255)
local white=app.pixelColor.rgba(255,255,255,255)
for it in image:pixels() do
 local color=it()
 if app.pixelColor.rgbaA(color)<180 then it(0) else
  local value=(app.pixelColor.rgbaR(color)+app.pixelColor.rgbaG(color)+app.pixelColor.rgbaB(color))/3
  it(value>195 and white or ink)
  minx=math.min(minx,it.x);miny=math.min(miny,it.y);maxx=math.max(maxx,it.x);maxy=math.max(maxy,it.y)
 end
end
assert(maxx>=minx)
local crop=Sprite(maxx-minx+1,maxy-miny+1,ColorMode.RGB)
crop.cels[1].image:drawImage(image,Point(-minx,-miny))
local scale=math.min(230/crop.width,270/crop.height)
crop:resize(math.max(1,math.floor(crop.width*scale)),math.max(1,math.floor(crop.height*scale)))
local final=Sprite(288,320,ColorMode.RGB)
final.layers[1].name=app.params.layer or 'Rear standing pose'
final.cels[1].image:drawImage(crop.cels[1].image,Point(math.floor((288-crop.width)/2),311-crop.height))
final:saveAs(root..'../画像/'..name..'.aseprite')
final:saveCopyAs(root..'img/characters/'..character..'.png')
final:close();crop:close();source:close()
-- Reopen the editable file and export separately for pixel-for-pixel validation.
local reopened=Sprite{fromFile=root..'../画像/'..name..'.aseprite'}
reopened:saveCopyAs(root..proof)
reopened:close()
print('Saved and reopened the 288x320 pose: '..name)
