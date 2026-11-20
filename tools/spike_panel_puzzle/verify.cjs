const {connect}=require('../castle_upper_maps/qa_client.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=process.argv.includes('--out')?path.resolve(root,process.argv[process.argv.indexOf('--out')+1]):path.join(root,'artifacts/spike-panel-puzzle-20261119');
const plan=JSON.parse(fs.readFileSync(path.join(out,'plan.json'))),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function staticChecks(){
 const m=read(path.join(root,'data/Map061.json')),before=read(path.join(out,'before/data/Map061.json'));
 for(const k of Object.keys(before))if(!['events','note'].includes(k))assert.deepEqual(m[k],before[k],k+' changed');
 [2,3,4].forEach(id=>assert.deepEqual(m.events[id],before.events[id]));
 const ce=read(path.join(root,'data/CommonEvents.json')),old=read(path.join(out,'before/data/CommonEvents.json'));assert.deepEqual(ce.slice(0,old.length),old);assert.equal(ce[41].list[1].parameters[0],'KNH_SpikePanel.toggle(this._eventId);');
 assert.equal(m.events.filter(e=>e&&e.note.includes('<spikePanel>')).length,8);
 for(const id of plan.panelIds)assert.equal(m.events[id].pages[0].list[0].parameters[0],41);
 const base=read(path.join(out,'baseline.json'));for(const f of ['data/Map050.json','js/plugins/KNH_ZXC_Gimmick_SpikeFloor.js'])assert.equal(sha(fs.readFileSync(path.join(root,f))),base.files[f]);
 return {terrainAndArtworkUnchanged:true,existingChestAndTransfersPreserved:true,firstFloorAndNativeHitFunctionUnchanged:true,panels:8,commonEvent:41};
}
async function boot(q){await q.call('Page.reload');await q.until('!!window.$gameMap&&!!window.KNH_SpikePanel&&DataManager.isDatabaseLoaded()&&SceneManager._scene&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','fresh puzzle boot',40000);await q.prepare();await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));}
async function main(){const report={static:staticChecks()},q=await connect();try{
 if(process.argv.includes('--resume-completion')){
  report.previousWalkingTrace=await q.evaluate('__spikeDriver.trace');
  for(let i=0;i<8;i++)assert.ok(report.previousWalkingTrace.some(t=>t.x===plan.nodes[i][0]&&t.y===plan.nodes[i][1]&&t.panels&&t.panels.on.length===i+1),'Missing previously verified panel walk '+i);
  report.precedingChecks='Toggle hold/reentry, native HP damage, retained panel state and eight-panel walking route passed before the camera-wait correction';
  await q.evaluate('$gameSelfSwitches.setValue([61,1,"A"],false);true');await q.map(61,10.5,14.5);
  await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','revised completion');
 }else{
 await boot(q);await q.map(61,15.5,24.5);await q.evaluate('$gameScreen.startFadeIn(24);true');await q.until('$gameVariables.value(65)===1&&!$gameMap.isEventRunning()','intro');
 report.initial=await q.evaluate('({status:KNH_SpikePanel.status(),panels:$gameMap._events.filter(e=>e&&e.event().meta.spikePanel).map(e=>({id:e.eventId(),x:e.x,y:e.y})),through:$gamePlayer.isThrough()})');assert.equal(report.initial.status.on.length,0);assert.equal(report.initial.through,false);
 await q.evaluate('__spikeDriver.walk(15,23)');assert.deepEqual(await q.evaluate('KNH_SpikePanel.status().on'),[5]);await q.sleep(500);assert.deepEqual(await q.evaluate('KNH_SpikePanel.status().on'),[5]);
 await q.evaluate('__spikeDriver.walk(15,24)');await q.evaluate('__spikeDriver.walk(15,23)');assert.deepEqual(await q.evaluate('KNH_SpikePanel.status().on'),[]);
 await q.evaluate('__spikeDriver.walk(15,24)');await q.evaluate('__spikeDriver.walk(15,23)');assert.deepEqual(await q.evaluate('KNH_SpikePanel.status().on'),[5]);console.log('PASS toggle on entry, held guard, retrigger OFF/ON');
 const hp=await q.evaluate('$gameParty.leader().hp');await q.until('(KNH_SpikePanel.status().clock%255)>=145&&(KNH_SpikePanel.status().clock%255)<175','active first crossing');
 await q.evaluate('$gamePlayer.moveStraight(4);true');await q.until('!$gamePlayer.isMoving()','safe step');await q.evaluate('$gamePlayer.moveStraight(4);true');await q.until('!!$gamePlayer._spikeFloorDamageState','native spike hit');
 report.hit=await q.evaluate('({on:KNH_SpikePanel.status().on,hp:$gameParty.leader().hp,safe:$gamePlayer._spikeFloorLastSafePosition,target:$gamePlayer._spikeFloorDamageState.jumpPosition})');assert.deepEqual(report.hit.on,[5]);assert.equal(report.hit.hp,hp-1);
 await q.until('!$gamePlayer._spikeFloorDamageState&&!$gamePlayer.isJumping()&&!$gamePlayer.isMoving()','native safe return',20000);report.returned=await q.evaluate('({xy:[$gamePlayer.x,$gamePlayer.y],on:KNH_SpikePanel.status().on})');assert.deepEqual(report.returned.on,[5]);assert.ok(report.returned.xy[0]>=14.5);assert.ok(report.returned.xy[1]>=22.5);console.log('PASS native damage and previous safe-floor return; panel state retained');
 if(report.returned.xy[0]!==15||report.returned.xy[1]!==23)await q.evaluate('__spikeDriver.walk(15,23)');
 for(let i=1;i<plan.nodes.length;i++){const t=plan.traps.find(t=>t.mode==='timed'&&t.id===plan.traps.filter(t=>t.mode==='timed')[i-1].id);await q.evaluate(`__spikeDriver.walk(${plan.nodes[i][0]},${plan.nodes[i][1]},${t.id})`);if(i<7)assert.deepEqual(await q.evaluate('KNH_SpikePanel.status().on'),plan.panelIds.slice(0,i+1));console.log('Walked panel '+(i+1));}
 }
 await q.until('$gameVariables.value(65)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','puzzle completion',30000);report.complete=await q.evaluate('({status:KNH_SpikePanel.status(),activeTraps:$gameMap._events.filter(e=>e&&e.event().meta.spikePanelTrap&&e._spikeFloorActive).length,camera:[$gameMap._scrollToX,$gameMap._scrollToY],offset:$gamePlayer._centerXy})');assert.equal(report.complete.activeTraps,0);assert.equal(report.complete.status.on.length,8);assert.deepEqual(report.complete.offset,[0,0]);
 await q.evaluate('__spikeDriver.go(10,9)');await q.evaluate('$gamePlayer.setDirection(8);$gameMap.event(2).start();true');await q.until('$gameParty.hasItem($dataItems[54])&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','native key pickup');assert.equal(await q.evaluate('$gameParty.numItems($dataItems[54])'),1);
 report.serialized=await q.evaluate('(function(){var s=JsonEx.stringify(DataManager.makeSaveContents());DataManager.extractSaveContents(JsonEx.parse(s));return {status:KNH_SpikePanel.status(),keys:$gameParty.numItems($dataItems[54])};})()');assert.equal(report.serialized.status.on.length,8);assert.equal(report.serialized.keys,1);
 await q.map(60,32,12.5);assert.equal(await q.evaluate('!!$gameMap._scrollToX||!!$gameMap._scrollToY'),false);await q.map(61,4,24.5);report.reentry=await q.evaluate('({status:KNH_SpikePanel.status(),panels:$gameMap._events.filter(e=>e&&e.event().meta.spikePanel).map(e=>({id:e.eventId(),x:e.x,y:e.y})),running:$gameMap.isEventRunning(),key:$gameParty.numItems($dataItems[54])})');assert.equal(report.reentry.status.on.length,8);assert.equal(report.reentry.running,false);assert.deepEqual(report.reentry.panels,plan.panelIds.map((id,i)=>({id,x:plan.nodes[i][0],y:plan.nodes[i][1]})));assert.equal(report.reentry.key,1);
 console.log('PASS completion, native key pickup, save serialization, reentry and editor positions');
 report.trace=await q.evaluate('__spikeDriver.trace');fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
 }finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
