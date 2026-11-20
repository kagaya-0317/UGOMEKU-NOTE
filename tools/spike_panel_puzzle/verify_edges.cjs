// Native-engine checks for complete spike drawings at every floor boundary.
const {connect}=require('../castle_upper_maps/qa_client.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const out=process.argv.includes('--out')?path.resolve(root,process.argv[process.argv.indexOf('--out')+1]):path.join(root,'artifacts/spike-panel-whole-spikes-20261119');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline.json'),'utf8'));
 const report={unchanged:[]};
 for(const [name,hash] of Object.entries(baseline.files)){
  if(name==='js/plugins/KNH_ZXC_Gimmick_SpikePanel.js'||name==='AGENTS.md')continue;
  assert.equal(sha(fs.readFileSync(path.join(root,name))),hash,name);
  report.unchanged.push(name);
 }
 const name='js/plugins/KNH_ZXC_Gimmick_SpikePanel.js';
 const before=fs.readFileSync(path.join(out,'before',name),'utf8');
 const current=fs.readFileSync(path.join(root,name),'utf8');
 assert.equal(current.split('    // One connected surface')[0],before.split('    // One connected surface')[0]);
 report.nativeGameplayPrefixUnchanged=true;
 const q=await connect();
 try{
  await q.call('Page.reload');
  await q.until('!!window.$gameMap&&!!window.KNH_SpikePanel&&DataManager.isDatabaseLoaded()&&SceneManager._scene&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','fresh edge-check boot',40000);
  await q.prepare();await q.evaluate('$gameVariables.setValue(65,1);true');
  await q.map(61,15.5,24.5);await q.evaluate('$gameScreen.startFadeIn(24);true');
  await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
  await q.evaluate('__spikeDriver.walk(15,23)');
  report.geometry=await q.evaluate(`(function(){
   var f=SceneManager._scene._spriteset._spikePanelFloor,ctx=f.bitmap._context,outside=0,tested=0;
   var masks={};for(var cell=3;cell<=5;cell++)masks[cell]=f._spikes[cell].map(function(c){return c.getContext('2d').getImageData(0,0,48,72).data;});
   f._regions.forEach(function(g){f.regionPath(ctx,g);g.spikes.forEach(function(p){
    for(var cell=3;cell<=5;cell++){var pixels=masks[cell][p.flip];
     for(var y=0;y<72;y++)for(var x=0;x<48;x++)if(pixels[(y*48+x)*4+3]){
      tested++;if(!ctx.isPointInPath(p.x+x+.5,p.y+y+.5))outside++;
     }
    }
   });});
   var fixtures=[[384,288],[72,144],[144,72],[48,144]].map(function(size){
    var cells={};for(var y=0;y<size[1]/24;y++)for(var x=0;x<size[0]/24;x++)cells[x+','+y]=true;
    var spikes=f.fitSpikes(cells),b=f._spikeBounds;
    return {size:size,count:spikes.length,nativePitchEstimate:size[0]*size[1]/(48*24),
     edgeGaps:[Math.min.apply(null,spikes.map(function(p){return p.x+b.x;}))-12,
      12+size[0]-Math.max.apply(null,spikes.map(function(p){return p.x+b.right;})),
      Math.min.apply(null,spikes.map(function(p){return p.y+b.y;}))-30,
      30+size[1]-Math.max.apply(null,spikes.map(function(p){return p.y+b.bottom;}))]};
   });
   var irregular=0,mirrored=0;
   f._regions.forEach(function(g){g.spikes.forEach(function(p){
    var row=(p.y+f._spikeBounds.y-31)/24;
    var center=p.x+f._spikeBounds.x+f._spikeBounds.w/2;
    var column=(center-24-((row%2+2)%2)*24)/48;
    if(row!==Math.round(row)||column!==Math.round(column))irregular++;
    if(p.flip!==0)mirrored++;
   });});
   var trimmedInterior=[];
   for(var cell=3;cell<=5;cell++){
    var source=document.createElement('canvas');source.width=48;source.height=72;
    var sourceCtx=source.getContext('2d');sourceCtx.drawImage(f._source._canvas,cell%3*480+94,Math.floor(cell/3)*480+184,48,72,0,0,48,72);
    var original=sourceCtx.getImageData(0,0,48,72).data,kept=masks[cell][0],seed=40*48+22,queue=[seed],seen={};seen[seed]=true;
    var lost=0;for(var i=0;i<queue.length;i++){
     var at=queue[i];if(kept[at*4+3]!==255)lost++;
     [at-1,at+1,at-48,at+48].forEach(function(n){
      if(n<0||n>=48*72||Math.abs(n%48-at%48)>1||seen[n]||original[n*4]<160)return;
      seen[n]=true;queue.push(n);
     });
    }trimmedInterior.push({cell:cell,originalInteriorPixels:queue.length,lost:lost});
   }
   return {outside:outside,tested:tested,irregular:irregular,mirrored:mirrored,trimmedInterior:trimmedInterior,
    bounds:f._spikeBounds,regions:f._regions.length,fixtures:fixtures,
    areas:f._regions.map(function(g){return Object.keys(g.cells).length*576;}),
    placements:f._regions.map(function(g){return g.spikes.length;}),scale:f._textureScale,
    belowCharacters:f.parent===SceneManager._scene._spriteset._baseSprite&&f.parent.children.indexOf(f)<f.parent.children.indexOf(SceneManager._scene._spriteset._tilemap),
    panels:$gameMap._events.filter(function(e){return e&&e.event().meta.spikePanel;}).map(function(e){return {id:e.eventId(),x:e.x,y:e.y};}),body:document.body.innerText};
  })()`);
  assert.equal(report.geometry.outside,0,'A complete spike extends past its floor boundary');
  assert.equal(report.geometry.scale,1);assert.equal(report.geometry.belowCharacters,true);
  assert.equal(report.geometry.regions,11);assert.ok(report.geometry.tested>10000);
  assert.equal(report.geometry.irregular,0,'A spike departs from the shared native staggered lattice');
  assert.equal(report.geometry.mirrored,0,'Native spike drawings must not be mirrored');
  assert.ok(report.geometry.trimmedInterior.every(p=>p.lost===0&&p.originalInteriorPixels>10),'The native spike body was cropped');
  for(const fixture of report.geometry.fixtures){
   assert.ok(fixture.edgeGaps.every(gap=>gap>=0&&gap<24),'Spikes leave more than a native half-cell at a floor end');
  }
  report.hatching=await q.evaluate(fs.readFileSync(path.join(__dirname,'hatching_checks.js'),'utf8'));
  assert.equal(report.hatching.sourceDifferences,0,'Floor hatching differs from the unmirrored native repeat, including its seams');
  assert.equal(report.hatching.identicalFloorMaterial,true,'A spike pose changes the floor material');
  assert.ok(report.hatching.downLeftDifference<report.hatching.downRightDifference,'Hatching does not slant down-left');
  for(const pose of report.hatching.poses){
   assert.equal(pose.changedOutsideSpikes,0,'Floor pixels change when spikes move');
   assert.ok(pose.changedInsideSpikes>1000,'The spike artwork did not animate');
  }
  report.boundary=await q.evaluate(fs.readFileSync(path.join(__dirname,'boundary_checks.js'),'utf8'));
  assert.equal(report.boundary.missingEdges,0,'The trap footprint is missing a boundary');
  assert.equal(report.boundary.internalEdgesDrawn,0,'A line separates two trap sections');
  assert.ok(report.boundary.removedSectionInterfaceEdges>0,'No phase interfaces were checked');
  for(const pose of report.boundary.poses){
   assert.equal(pose.width,4,'The trap-floor boundary is not 4px wide');
   assert.equal(pose.boundaryDraws,1,'The footprint boundary is absent or duplicated');
   assert.equal(pose.behindSpikes,true,'The boundary covers the spike artwork');
  }
  report.yura=[];
  for(const cell of [3,4,5]){
   await q.evaluate(`window.__yuraProbeCell=${cell};true`);
   const motion=await q.evaluate(fs.readFileSync(path.join(__dirname,'yura_motion_checks.js'),'utf8'));
   assert.ok(motion.samples>100);assert.equal(motion.emptySamples,0,'A probe did not render');
   assert.equal(motion.staticTips,0,'A spike tip remains static across yura steps');
   report.yura.push(motion);
  }
  await q.evaluate('delete window.__yuraProbeCell;true');
  const png=await q.evaluate(`(function(){
   var f=SceneManager._scene._spriteset._spikePanelFloor,c=document.createElement('canvas');c.width=576;c.height=600;
   var ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);
   for(var cell=3;cell<=5;cell++){
    var x=(cell-3)*192;ctx.fillStyle='#474e51';ctx.font='16px sans-serif';ctx.fillText('Cell '+cell,x+12,22);
    ctx.drawImage(f._source._canvas,cell%3*480+94,Math.floor(cell/3)*480+184,48,72,x,30,192,288);
    ctx.drawImage(f._spikes[cell][0],x,312,192,288);
   }return c.toDataURL('image/png').split(',')[1];})()`);
  fs.mkdirSync(path.join(out,'_work'),{recursive:true});
  fs.writeFileSync(path.join(out,'_work/spike-poses.png'),Buffer.from(png,'base64'));
  const hp=await q.evaluate('$gameParty.leader().hp');
  await q.until('(KNH_SpikePanel.status().clock%255)>=145&&(KNH_SpikePanel.status().clock%255)<175','active first crossing');
  await q.evaluate('$gamePlayer.moveStraight(4);true');await q.until('!$gamePlayer.isMoving()','safe step');
  await q.evaluate('$gamePlayer.moveStraight(4);true');await q.until('!!$gamePlayer._spikeFloorDamageState','native spike hit');
  assert.equal(await q.evaluate('$gameParty.leader().hp'),hp-1);
  await q.until('!$gamePlayer._spikeFloorDamageState&&!$gamePlayer.isJumping()&&!$gamePlayer.isMoving()','native safe return',20000);
  report.afterHit=await q.evaluate('({xy:[$gamePlayer.x,$gamePlayer.y],on:KNH_SpikePanel.status().on})');
  assert.deepEqual(report.afterHit.on,[5]);assert.ok(report.afterHit.xy[0]>=14.5);
  // Recreate the spriteset through normal map loading; exercise disposal too.
  await q.map(60,32,12.5);await q.map(61,15.5,24.5);
  assert.deepEqual(await q.evaluate('KNH_SpikePanel.status().on'),[5]);
  await q.evaluate('$gameScreen.startFadeIn(24);true');await q.sleep(600);
  const screen=await q.evaluate('Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL("image/png").split(",")[1]');
  fs.writeFileSync(path.join(out,'puzzle-overview.png'),Buffer.from(screen,'base64'));
  report.reentry=true;
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
 }finally{q.ws.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
