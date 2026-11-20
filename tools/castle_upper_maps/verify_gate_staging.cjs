const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/throne-gate-staging-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const{q}=await prepare();try{
 await q.evaluate(`(function(){
  window.__gateStageQA={before:null,frames:[],scopes:[]};
  window.__gatePeople=function(){return [$gamePlayer].concat($gamePlayer.followers()._data.filter(function(f){return f.actor();})).map(function(ch){return {actor:ch.actor?ch.actor().actorId():2,x:ch._realX,y:ch._realY,d:ch.direction(),speed:ch._moveSpeed,fix:ch.isDirectionFixed()};});};
  window.__gateRendered=function(){return SceneManager._scene._spriteset._characterSprites.filter(function(sp){var ch=sp._character;return ch&&sp.visible&&sp.opacity>0&&!ch.isTransparent()&&ch.characterName()&&(ch===$gamePlayer||ch instanceof Game_Follower||ch instanceof Game_Event&&ch.event().meta.castleUpperActor);}).map(function(sp){var ch=sp._character;return {actor:ch===$gamePlayer?2:ch instanceof Game_Follower?ch.actor()&&ch.actor().actorId():Number(ch.event().meta.castleUpperActor),event:ch instanceof Game_Event?ch.eventId():null,x:sp.x,y:sp.y};}).filter(function(p){return !!p.actor;});};
  var begin=KNH_CastleUpper.beginGate;KNH_CastleUpper.beginGate=function(){__gateStageQA.before=__gatePeople();return begin.apply(this,arguments);};
  var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(text==='この先が')__gnuroIntroQA.auto=false;return add.apply(this,arguments);};
  var update=SceneManager.updateScene;SceneManager.updateScene=function(){var r=update.apply(this,arguments),s=$gameTemp._castleUpperScene;if(s&&s.mapId===60){__gateStageQA.scopes.push({event:s.eventId,members:s.members.map(function(m){return m.eventId;})});if(s.eventId===8){var people=[$gamePlayer].concat(s.members.map(function(m){return $gameMap.event(m.eventId);}));__gateStageQA.frames.push({frame:Graphics.frameCount,opening:$gameMap.event(8)._castleGateOpening,returning:!!s.returning,people:people.map(function(ch){return {x:ch._realX,y:ch._realY,moving:ch.isMoving(),speed:ch._moveSpeed};})});}}return r;};
  Window_Message.prototype.getMessageSpeed=function(){return 0;};return true;
 })()`);
 const selector=()=>q.until('$gameMessage.isItemChoice()&&SceneManager._scene._messageWindow._itemWindow.active&&SceneManager._scene._messageWindow._itemWindow.openness===255','selector');
 const choose=async id=>{await selector();await q.evaluate(`(function(){var w=SceneManager._scene._messageWindow._itemWindow;w.select(w._data.findIndex(i=>i.id===${id}));w.processOk();return true;})()`);await q.sleep(150);};
 const idle=()=>q.until('SceneManager._scene instanceof Scene_Map&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene&&!$gamePlayer.isMoving()','scene cleanup',40000);
 const rendered=async expected=>{await q.sleep(120);const list=await q.evaluate('__gateRendered()');assert.deepEqual(list.map(p=>p.actor).sort(),expected.slice().sort());return list;};
 const cases=[];
 for(const party of [[2,3,4],[2,4,3],[2,4],[2]]){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(64,2);$gameVariables.setValue(66,0);$gameParty.gainItem($dataItems[53],1-$gameParty.numItems($dataItems[53]));$gameParty.gainItem($dataItems[54],1-$gameParty.numItems($dataItems[54]));__gateStageQA.frames=[];__gnuroIntroQA.auto=true;true`);await q.map(60,25.5,16.5);await rendered(party);
  assert.deepEqual(await q.evaluate('[13,14].map(id=>[$gameMap.event(id).x,$gameMap.event(id).y,$gameMap.event(id).isTransparent()])'),[[24,14,true],[27,14,true]]);
  await q.evaluate('__gnuroIntroQA.route(25.5,12.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()||$gameMap.isEventRunning()','approach');
  for(let i=0;i<6&&!await q.evaluate('$gameMap.isEventRunning()');i++){await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(200);}
  await choose(53);await choose(54);
  let speaking=null;
  if(party.includes(3)){
   await q.until('$gameMessage._texts[0]==="この先が"&&SceneManager._scene._messageWindow.pause','Mii after gate',35000);await q.sleep(200);
   speaking=await q.evaluate('({members:$gameTemp._castleUpperScene.members,hero:[$gamePlayer.x,$gamePlayer.y,$gamePlayer.direction()],mii:[$gameMap.event(13).x,$gameMap.event(13).y,$gameMap.event(13).direction()],yume:[$gameMap.event(14).x,$gameMap.event(14).y,$gameMap.event(14).direction()],speaker:SceneManager._scene._messageWindow.getPopupTargetCharacter().eventId(),rendered:__gateRendered(),hiddenBeast:[9,10].every(id=>$gameMap.event(id).isTransparent()),gate:$gameVariables.value(66)})');
   assert.deepEqual(speaking.hero,[25.5,13.5,4]);assert.deepEqual(speaking.mii,[24,14,6]);assert.deepEqual(speaking.yume,[27,14,4]);assert.equal(speaking.speaker,13);assert.equal(speaking.hiddenBeast,true);assert.equal(speaking.gate,1);await rendered(party);
   if(party.join(',')==='2,3,4'){const b=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'mii_gate_formation.png'),Buffer.from(b,'base64'));}
   await q.evaluate('__gnuroIntroQA.auto=true;true');
  }
  await idle();const result=await q.evaluate('({before:__gateStageQA.before,after:__gatePeople(),frames:__gateStageQA.frames,camera:$gamePlayer._centerXy,followers:$gamePlayer.followers().isVisible(),flag:$gameVariables.value(66),proxies:[9,10,13,14].map(id=>({id:id,hidden:$gameMap.event(id).isTransparent()})),error:__gnuroIntroQA.error})');
  assert.equal(result.error,null);assert.deepEqual(result.after,result.before);assert.deepEqual(result.camera,[0,0]);assert.equal(result.followers,true);assert.equal(result.flag,1);assert.ok(result.proxies.every(p=>p.hidden));
  const opening=result.frames.filter(f=>f.opening>=0&&!f.returning);assert.ok(opening.length>50);assert.ok(opening.every(f=>f.people.every(p=>!p.moving)),'All members finish walking before the door opens');
  assert.ok(result.frames.some(f=>!f.returning&&f.people.some(p=>p.moving)),'Visible staged walk');assert.ok(result.frames.some(f=>f.returning&&f.people.some(p=>p.moving)),'Visible return walk');await rendered(party);
  await q.evaluate('__gnuroIntroQA.route(25.5,17);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','following resumes');await rendered(party);
  cases.push({party,before:result.before,after:result.after,speaking,formationFrames:result.frames.length,openingAfterMovement:true,returnedByWalking:true});console.log('PASS gate formation / faces / return '+party);
 }
 // Completed-state map setup and dedicated save/load keep stand-ins hidden.
 await q.map(60,25.5,16.5);assert.deepEqual(await q.evaluate('[13,14].map(id=>[$gameMap.event(id).x,$gameMap.event(id).y,$gameMap.event(id).isTransparent()])'),[[24,14,true],[27,14,true]]);
 await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate('DataManager.saveGame(85)'),true);assert.equal(await q.evaluate('DataManager.loadGame(85)'),true);await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await idle();assert.equal(await q.evaluate('$gameVariables.value(66)'),1);await rendered([2]);
 // The pre-existing beast encounter must keep its own stand-ins and handoff.
 await q.evaluate('$gameParty._actors=[2,3,4];$gamePlayer.refresh();$gameVariables.setValue(64,0);__gnuroIntroQA.auto=true;true');await q.map(60,6,18.5);await q.evaluate('$gamePlayer.moveStraight(8);true');await q.until('$gameVariables.value(64)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','beast boundary',40000);await rendered([2,3,4]);
 const beast=await q.evaluate('__gateStageQA.scopes.filter(s=>s.event===2)');assert.ok(beast.length&&beast.every(s=>JSON.stringify(s.members)==="[9,10]"));assert.equal(await q.evaluate('[13,14].every(id=>$gameMap.event(id).isTransparent())'),true);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({cases,completedReentry:true,saveLoad:true,beastScopeUnchanged:true},null,2));console.log('PASS completed reentry/save-load, native beast boundary and exact rendered party counts');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
