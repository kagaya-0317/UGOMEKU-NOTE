// Real-engine walking, progression gate, map reentry and save/load checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('../castle_upper_maps/qa_client.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/road-approach-map-implementation-20261119');
async function main(){const q=await connect(),report={};try{
 await q.call('Page.reload');await q.until('!!window.$gameMap&&DataManager.isDatabaseLoaded()&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','boot',40000);
 assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'),'castle-map-qa');await q.prepare();
 await q.evaluate(fs.readFileSync(path.join(root,'tools/spike_panel_puzzle/driver.js'),'utf8'));
 const idle=()=>q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gamePlayer.isMoving()&&ImageManager.isReady()','map idle',30000);
 const status=()=>q.evaluate('({map:$gameMap.mapId(),xy:[$gamePlayer.x,$gamePlayer.y],through:$gamePlayer.isThrough(),progress:$gameVariables.value(60),followers:$gamePlayer.followers().isVisible()})');
 const go=(x,y)=>q.evaluate(`__spikeDriver.go(${x},${y})`);
 async function exit(direction,expected){
  for(let i=0;i<12;i++){
   if(await q.evaluate(`$gameMap.mapId()===${expected}||$gamePlayer.isTransferring()`))break;
   await q.evaluate(`if(!$gameMap.isEventRunning()&&!$gamePlayer.isMoving())$gamePlayer.moveStraight(${direction});true`);await q.sleep(160);
  }
  await q.until(`$gameMap.mapId()===${expected}`,'native transfer to '+expected,30000);await idle();const s=await status();assert.equal(s.through,false);return s;
 }
 await q.map(54,10,10,8);await q.evaluate('$gameScreen.startFadeIn(1);true');
 assert.equal(await q.evaluate('$gameMap.event(7)._pageIndex'),0);
 await go(10,9);await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(300);assert.equal(await q.evaluate('$gameMap.mapId()'),54);assert.equal(await q.evaluate('$gameVariables.value(60)'),0);report.beforeBossGate=true;
 await q.evaluate('$gameVariables.setValue(60,2);KNH_CastleUpper.refreshEvents();true');await q.map(54,10,10,8);
 await go(10,9.5);report.hallToApproach=await exit(8,63);assert.deepEqual(report.hallToApproach.xy,[5.5,27]);console.log('PASS hall -> approach');
 await go(5.5,22);await go(15,22);await go(5.5,22);report.deadEndBranchWalked=true;
 await go(5.5,17);for(let i=0;i<12;i++){await q.evaluate('$gamePlayer.moveStraight(6);true');await q.until('!$gamePlayer.isMoving()','side wall');}
 const wall=await status();assert.equal(wall.map,63);assert.ok(wall.xy[0]<8,'Walked onto middle wall');report.middleWallBlockedAt=wall.xy;
 await go(5.5,10.5);await go(18.5,10.5);report.approachToRoad=await exit(6,55);assert.deepEqual(report.approachToRoad.xy,[1.5,23.5]);console.log('PASS approach -> road');
 await go(4,23.5);await q.sleep(500);
 const roadScreen=await q.evaluate('Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL("image/png").split(",")[1]');fs.writeFileSync(path.join(out,'road-arrival.png'),Buffer.from(roadScreen,'base64'));
 await go(1.5,23.5);report.roadToApproach=await exit(4,63);assert.deepEqual(report.roadToApproach.xy,[18.5,10.5]);console.log('PASS road -> approach');
 await go(5.5,10.5);await go(5.5,28);report.approachToHall=await exit(2,54);assert.deepEqual(report.approachToHall.xy,[10,9.5]);assert.equal(report.approachToHall.progress,2);console.log('PASS approach -> hall');
 await go(10,9);report.secondEntry=await exit(8,63);await go(5.5,23);
 const directory=await q.evaluate('StorageManager.localFileDirectoryPath()');assert.ok(directory.includes('codex-castle-upper-maps-qa-saves'));
 const slot=await q.evaluate('(function(){for(var i=300;i<400;i++)if(!StorageManager.exists(i))return i;throw Error("No free QA slot");})()');
 await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate(`DataManager.saveGame(${slot})`),true);await q.map(54,10,10);
 assert.equal(await q.evaluate(`DataManager.loadGame(${slot})`),true);await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await idle();assert.deepEqual((await status()).xy,[5.5,23]);assert.equal(await q.evaluate('$gameMap.mapId()'),63);await go(5.5,22);report.nativeSaveLoad={slot,map:63,walkingAfterLoad:true};
 const oldVersion=JSON.parse(fs.readFileSync(path.join(out,'implementation.json'))).versionBefore;
 report.oldSaveReload=[];
 for(const [mapId,eventId,x,y]of[[54,7,10,10],[55,11,1.5,23.5]]){
  await q.map(mapId,x,y);await idle();await q.evaluate(`$gameSystem.onBeforeSave();$gameSystem._versionId=${oldVersion};$gameMap._events[${eventId}]=null;true`);
  assert.equal(await q.evaluate(`DataManager.saveGame(${slot})`),true);assert.equal(await q.evaluate(`DataManager.loadGame(${slot})`),true);
  await q.evaluate('Scene_Load.prototype.reloadMapIfUpdated.call({});$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await idle();
  assert.equal(await q.evaluate(`!!$gameMap.event(${eventId})`),true);assert.equal(await q.evaluate(`$gameMap.event(${eventId}).list().some(function(c){return c.code===201&&c.parameters[1]===63;})`),true);
  report.oldSaveReload.push({mapId,eventId,reloaded:true});
 }
 await q.map(54,10,10);await exit(8,63);await go(5.5,10.5);await go(14,10.5);await q.sleep(3500);
 const screen=await q.evaluate('Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL("image/png").split(",")[1]');fs.writeFileSync(path.join(out,'approach-game.png'),Buffer.from(screen,'base64'));
 await q.evaluate('Graphics.width=1008;Graphics.height=1440;Graphics.boxWidth=1008;Graphics.boxHeight=1440;SceneManager.goto(Scene_Map);true');await idle();await q.sleep(300);
 const full=await q.evaluate('$gameMap.setDisplayPos(0,0);SceneManager._scene._spriteset.update();Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL("image/png").split(",")[1]');fs.writeFileSync(path.join(out,'approach-full.png'),Buffer.from(full,'base64'));
 report.savedMapScreenshot=true;report.newMapEventPositions=await q.evaluate('$gameMap._events.filter(Boolean).map(function(e){return {id:e.eventId(),saved:[e.event().x,e.event().y],loaded:[e.x,e.y]};})');
 assert.deepEqual(report.newMapEventPositions,[{id:1,saved:[5,28],loaded:[5.5,28.5]},{id:2,saved:[20,10],loaded:[20,10.5]}]);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
