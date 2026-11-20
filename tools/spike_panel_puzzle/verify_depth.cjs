// Regression: hidden trap sprites must not corrupt visible party depth sorting.
const {connect}=require('../castle_upper_maps/qa_client.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const out=process.argv.includes('--out')?path.resolve(root,process.argv[process.argv.indexOf('--out')+1]):path.join(root,'artifacts/spike-panel-depth-fix-20261119');
async function main(){
 const report={},baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline.json'),'utf8'));
 report.unchanged=[];
 for(const [name,hash] of Object.entries(baseline.files)){
  if(name==='js/plugins/KNH_ZXC_Gimmick_SpikePanel.js'||name==='AGENTS.md')continue;
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),hash,name);
  report.unchanged.push(name);
 }
 const q=await connect();
 try{
  await q.call('Page.reload');
  await q.until('!!window.$gameMap&&DataManager.isDatabaseLoaded()&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','fresh depth-test boot',40000);
  await q.prepare();await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
  await q.map(60,37,12.5);
  await q.evaluate(`window.__depthQA={stage:'entry',frames:[]};
   var oldRender=Graphics.render;Graphics.render=function(stage){
    var rendered=this._skipCount===0;oldRender.apply(this,arguments);
    if(!rendered||!$gameMap||$gameMap.mapId()!==61||!SceneManager._sceneStarted)return;
    var ss=SceneManager._scene._spriteset;if(!ss||!ss._spikePanelFloor)return;
    var party=ss._characterSprites.filter(function(s){var c=s._character;return c===$gamePlayer||c instanceof Game_Follower&&c.actor();});
    var traps=ss._characterSprites.filter(function(s){var c=s._character;return c&&c.event&&c.event().meta.spikePanelTrap;});
    function actor(s){return s._character===$gamePlayer?2:s._character.actor().actorId();}
    var actual=party.slice().sort(function(a,b){return a.parent.children.indexOf(a)-b.parent.children.indexOf(b);}).map(actor);
    var expected=party.slice().sort(Tilemap.prototype._compareChildOrder).map(actor),invalid=0;
    traps.forEach(function(t){party.forEach(function(p){if(!Number.isFinite(Tilemap.prototype._compareChildOrder(t,p)))invalid++;});});
    __depthQA.frames.push({stage:__depthQA.stage,frame:Graphics.frameCount,order:actual,expected:expected,invalid:invalid,
     traps:traps.length,trapMeshes:traps.filter(function(s){return !!s._meshSprite;}).length,
     party:party.map(function(s){var c=s._character;return {actor:actor(s),xy:[c._realX,c._realY],sort:[s.x,s.y,s.z],
      visible:s.visible,meshVisible:!!(s._meshSprite&&s._meshSprite.visible),
      hasVisibleArt:!!(s._meshSprite&&s._meshSprite.visible)||!!(!s._baseBitmap&&s.bitmap&&s.bitmap.isReady()&&s._frame.width>0&&s._frame.height>0),
      opacity:s.opacity};})});
   };true`);
  for(let i=0;i<2;i++){await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(250);}
  await q.until('$gameMap.mapId()===61&&$gameVariables.value(65)===1&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','native room entry',30000);
  await q.evaluate('__spikeDriver.walk(15,23)');
  async function rendered(stage,count){await q.until(`__depthQA.frames.filter(function(f){return f.stage===${JSON.stringify(stage)};}).length>=${count}`,stage+' rendered frames',40000);}
  await rendered('entry',30);
  await q.evaluate('__depthQA.stage="idle";true');await rendered('idle',120);
  await q.evaluate('__depthQA.stage="walking";true');
  await q.evaluate('__spikeDriver.walk(15,24)');await q.evaluate('__spikeDriver.walk(15,23)');await q.evaluate('__spikeDriver.walk(15,24)');
  await rendered('walking',30);
  await q.evaluate('__depthQA.stage="active-reentry";true');await q.map(60,32,12.5);await q.map(61,15.5,24.5);await rendered('active-reentry',30);
  await q.evaluate('__depthQA.stage="completed-reentry";$gameVariables.setValue(65,2);true');
  await q.map(60,32,12.5);await q.map(61,4,24.5);await rendered('completed-reentry',30);
  const frames=await q.evaluate('__depthQA.frames');
  fs.writeFileSync(path.join(out,'depth-frames.json'),JSON.stringify(frames,null,2)+'\n');
  report.stages={};
  for(const stage of ['entry','idle','walking','active-reentry','completed-reentry']){
   const rows=frames.filter(f=>f.stage===stage);assert.ok(rows.length>=20,stage+' missing rendered frames');
   for(const f of rows){
    assert.equal(f.traps,49);assert.equal(f.invalid,0,'Non-finite hidden-trap sorting comparison');
    assert.equal(f.trapMeshes,0,'Hidden traps created unnecessary visible meshes');
    assert.deepEqual(f.order,f.expected,'Rendered party order disagrees with native depth ordering');
    assert.deepEqual(f.party.map(p=>p.actor).sort(),[2,3,4]);
    assert.ok(f.party.every(p=>p.visible&&p.hasVisibleArt&&p.opacity>0),'A party member was hidden instead of fixing depth');
   }
   report.stages[stage]={renderedFrames:rows.length,invalidComparisons:0,wrongOrders:0,visibleSpritesPerActor:1};
  }
  const idle=frames.filter(f=>f.stage==='idle');assert.ok(idle.length>=90);
  assert.equal(new Set(idle.map(f=>f.order.join(','))).size,1,'Stationary party depth still flickers');
  report.idleOrder=idle[0].order;
  await q.map(50,26,21);await q.sleep(600);
  report.firstFloor=await q.evaluate(`(function(){var s=SceneManager._scene._spriteset._characterSprites.filter(function(s){return s._character===$gameMap.event(6);})[0],c=s._character;
   return {xy:[c.x,c.y],sprite:[s.x,s.y,s.z],expected:[c.screenX(),c.screenY(),c.screenZ()],visible:s.visible,mesh:!!s._meshSprite};})()`);
  assert.deepEqual(report.firstFloor.xy,[30.5,25]);assert.deepEqual(report.firstFloor.sprite,report.firstFloor.expected);
  assert.equal(report.firstFloor.visible,true);assert.equal(report.firstFloor.mesh,true);
  await q.evaluate('$gameVariables.setValue(65,1);__depthQA.stage="final-active";true');
  await q.map(61,15.5,24.5);await q.evaluate('$gameScreen.startFadeIn(24);true');await q.evaluate('__spikeDriver.walk(15,23)');
  const png=await q.evaluate('Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL("image/png").split(",")[1]');
  fs.writeFileSync(path.join(out,'party-overlap.png'),Buffer.from(png,'base64'));
  fs.writeFileSync(path.join(out,'depth-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{q.ws.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
