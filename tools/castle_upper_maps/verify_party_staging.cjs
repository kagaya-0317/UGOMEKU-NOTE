const {connect}=require('./qa_client.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../artifacts/castle-upper-party-staging-20261118');
async function main(){const q=await connect(),reports=[];try{
 await q.prepare();
 await q.evaluate(`window.__stagingTrace=[];var stageUpdate=SceneManager.updateScene;SceneManager.updateScene=function(){var value=stageUpdate.apply(this,arguments);if(SceneManager._scene instanceof Scene_Map){var scene=$gameTemp._castleUpperScene;var people=[{id:2,x:$gamePlayer._realX,y:$gamePlayer._realY,visible:!$gamePlayer.isTransparent()}];[3,4].forEach(function(id){var proxy=scene&&scene.members.filter(m=>m.actorId===id)[0];var ch=proxy?$gameMap.event(proxy.eventId):$gamePlayer.followers()._data.filter(f=>f.actor()&&f.actor().actorId()===id)[0];if(ch)people.push({id:id,x:ch._realX,y:ch._realY,visible:proxy?!ch.isTransparent():$gamePlayer.followers().isVisible()&&!ch.isTransparent()});});__stagingTrace.push({map:$gameMap.mapId(),active:!!scene,people:people});}return value;};true`);
 const cases=[
  {map:59,flag:63,start:[4.5,20.5],boss:3,controller:5,hero:[10,18],targets:[[8.5,18.5],[11.5,18.5]],party:[2,3,4],troop:46,name:'mone'},
  {map:60,flag:64,start:[6,18.5],boss:2,controller:4,hero:[5.5,16.5],targets:[[4.5,17],[6.5,17]],party:[2,4,3],troop:47,name:'beast'},
  {map:62,flag:67,start:[16,18.5],boss:3,controller:5,hero:[10,13],targets:[[8.5,13.5],[11.5,13.5]],party:[2,3,4],troop:48,name:'tsunehi'}
 ];
 for(const spec of cases){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(spec.party)};$gamePlayer.refresh();$gameVariables.setValue(${spec.flag},0);__castleQA.auto=false;true`);
  await q.map(spec.map,...spec.start);await q.sleep(300);
  let initial=await q.evaluate(`({speed:$gamePlayer._moveSpeed,proxies:$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).map(e=>({id:Number(e.event().meta.castleUpperActor),x:e.x,y:e.y,hidden:e.isTransparent()})),boss:[$gameMap.event(${spec.boss}).x,$gameMap.event(${spec.boss}).y]})`);
  assert.equal(initial.proxies.length,2);assert.ok(initial.proxies.every(e=>e.hidden));
  await q.evaluate('__stagingTrace=[];$gamePlayer.moveStraight(8);true');
  await q.until(`$gameVariables.value(${spec.flag})===1&&$gameMessage.isBusy()&&$gameMap._interpreter._waitMode==='message'`,'staged '+spec.name,30000);await q.sleep(900);
  const staged=await q.evaluate(`({hero:[$gamePlayer.x,$gamePlayer.y],members:$gameTemp._castleUpperScene.members.map(m=>{var e=$gameMap.event(m.eventId);return {actor:m.actorId,x:e.x,y:e.y,image:e.characterName(),visible:!e.isTransparent(),scale:[e._scaleX,e._scaleY]};}),camera:$gamePlayer._centerXy,bubble:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,width:SceneManager._scene._messageWindow.width,height:SceneManager._scene._messageWindow.height},moving:KNH_CastleUpper.isForming(),trace:__stagingTrace.filter(t=>t.active)})`);
  assert.deepEqual(staged.hero,spec.hero);assert.equal(staged.moving,false);assert.deepEqual(staged.members.map(m=>[m.x,m.y]),spec.targets);assert.ok(staged.members.every(m=>m.visible));assert.deepEqual(staged.members.map(m=>m.image),['$002','$003']);
  assert.ok(staged.trace.length>20);for(const frame of staged.trace)assert.equal(frame.people.filter(p=>p.visible).length,3,'Party disappears during '+spec.name);
  const rendered=await q.evaluate('SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&["$002","$003"].indexOf(s._character.characterName())>=0).map(s=>({type:s._character.constructor.name,id:s._character._eventId,member:s._character._memberIndex}))');assert.equal(rendered.length,2,'Duplicate rendered companions');
  for(const id of [2,3,4]){const positions=staged.trace.map(t=>t.people.find(p=>p.id===id)).filter(Boolean);assert.ok(positions.some(p=>Math.abs(p.x-positions[0].x)+Math.abs(p.y-positions[0].y)>.5),'Actor did not move: '+id);}
  const shot=await q.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,spec.name+'-formation.png'),Buffer.from(shot.data,'base64'));
  await q.evaluate('__castleQA.auto=true;true');await q.until(`SceneManager._scene instanceof Scene_NewBattle&&$gameTroop._troopId===${spec.troop}&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()`,'battle '+spec.name);
  if(spec.troop!==47){await q.sleep(1000);await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');}
  await q.until(`SceneManager._scene instanceof Scene_Map&&$gameVariables.value(${spec.flag})===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()`,'return '+spec.name,40000);
  const after=await q.evaluate(`({hero:[$gamePlayer.x,$gamePlayer.y],followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({id:f.actor().actorId(),x:f.x,y:f.y})),shown:$gamePlayer.followers().isVisible(),proxiesHidden:$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).every(e=>e.isTransparent()),speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy,temp:!!$gameTemp._castleUpperScene})`);
  assert.equal(after.shown,true);assert.equal(after.proxiesHidden,true);assert.equal(after.speed,initial.speed);assert.deepEqual(after.camera,[0,0]);assert.equal(after.temp,false);
  assert.equal(await q.evaluate('SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&["$002","$003"].indexOf(s._character.characterName())>=0).length'),2,'Follower handoff rendering');
  for(const member of staged.members){const follower=after.followers.find(f=>f.id===member.actor);assert.deepEqual([follower.x,follower.y],[member.x,member.y],'Handoff moved actor');}
  await q.evaluate('$gamePlayer.moveStraight(2);true');await q.sleep(500);assert.equal(await q.evaluate('$gamePlayer.followers().isVisible()'),true);
  await q.map(spec.map,...spec.start);await q.sleep(200);const reentry=await q.evaluate('({active:!!$gameTemp._castleUpperScene,running:$gameMap.isEventRunning(),proxies:$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).map(e=>({x:e.x,y:e.y,hidden:e.isTransparent()}))})');assert.equal(reentry.active,false);assert.equal(reentry.running,false);assert.deepEqual(reentry.proxies.map(p=>[p.x,p.y]),spec.targets);assert.ok(reentry.proxies.every(p=>p.hidden));
  reports.push({map:spec.map,initial,hero:staged.hero,members:staged.members,movementFrames:staged.trace.length,after,reentry});console.log('PASS '+spec.name+' staging, visible party, handoff and reentry');
 }
 // Missing companions and a blocked autonomous-route switch cannot show ghosts.
 await q.evaluate('$gameParty._actors=[2,3];$gamePlayer.refresh();$gameVariables.setValue(63,0);$gameSwitches.setValue(1,true);true');await q.map(59,10,22);assert.equal(await q.evaluate('$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).every(e=>e.isTransparent())'),true);
 await q.evaluate('KNH_CastleUpper.beginScene(3);true');await q.until('!KNH_CastleUpper.isForming()','missing companion formation');assert.deepEqual(await q.evaluate('$gameTemp._castleUpperScene.members.map(m=>m.actorId)'),[3]);await q.evaluate('KNH_CastleUpper.endScene();$gameSwitches.setValue(1,false);true');
 console.log('PASS missing-companion and autonomous-route boundary');
 }finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(reports,null,2)+'\n');q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
