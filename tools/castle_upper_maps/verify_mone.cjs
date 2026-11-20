const {connect}=require('./qa_client.cjs'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
async function main(){const q=await connect();try{
 await q.prepare();await q.map(59,10,25);
 let state=await q.evaluate(`({events:$gameMap._events.filter(Boolean).map(e=>({id:e.eventId(),name:e.event().name,x:e.x,y:e.y,page:e._pageIndex})),saveTemplate:$gameMap.event(1).list().length,boss:$gameMap.event(3)._cssRect})`);console.log('Placement',JSON.stringify(state));assert.equal(state.boss.x,160);assert.ok(state.saveTemplate>20);
 const out=path.resolve(__dirname,'../../artifacts/castle-upper-events-20261118');
 await q.evaluate(`KNH_MapSnapshot.save({path:${JSON.stringify(path.join(out,'mone-before.png'))},includeUi:false})`);
 await q.evaluate('$gameMap.event(1).start();true');
 await q.until('$gameMessage.isChoice()&&SceneManager._scene._messageWindow._choiceWindow.isOpenAndActive()','save choice');
 state=await q.evaluate(`({flag:$gameVariables.value(61),last:$gamePlayer._lastSavePoint,color:ZXC().husenColors[61],note:[$gameMap.event(2).x,$gameMap.event(2).y],messages:__castleQA.messages.slice()})`);console.log('Save',JSON.stringify(state));assert.equal(state.flag,1);assert.deepEqual(state.last,[59,13,25]);
 await q.evaluate('SceneManager._scene._messageWindow._choiceWindow.select(1);SceneManager._scene._messageWindow._choiceWindow.processOk();true');
 await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','save cleanup');
 await q.evaluate('$gamePlayer.locate(10,20.5);$gamePlayer.moveStraight(8);true');
 await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','Mone battle');
 state=await q.evaluate(`({flag:$gameVariables.value(63),troop:$gameTroop._troopId,party:$gameParty._actors.slice(),attackSkills:$gameTroop.members()[0].enemy().actions.map(a=>a.skillId),actorSprites:SceneManager._scene._actorSprites.map(sp=>sp._battler.actorId())})`);console.log('Battle',JSON.stringify(state));assert.equal(state.troop,46);assert.equal(state.flag,1);assert.deepEqual(state.party,[2,3,4]);
 await q.sleep(1200);await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');
 await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(63)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','Mone victory',40000);
 state=await q.evaluate(`({flag:$gameVariables.value(63),followers:$gamePlayer.followers().isVisible(),camera:$gamePlayer._centerXy,tail:$gameMessage._tailDir,popupX:$gameSystem._messagePopupFreeX,hero:$gameActors.actor(2).name(),bossPage:$gameMap.event(3)._pageIndex})`);console.log('After',JSON.stringify(state));assert.equal(state.followers,true);assert.deepEqual(state.camera,[0,0]);assert.equal(state.tail,0);assert.equal(state.bossPage,1);
 await q.map(59,10,25);assert.equal(await q.evaluate('$gameVariables.value(63)'),2);assert.equal(await q.evaluate('$gameMap.isEventRunning()'),false);
 state.reentry=await q.evaluate('[1,2].map(id=>{var e=$gameMap.event(id);return [e.x,e.y];})');assert.deepEqual(state.reentry,[[13,25],[16,24]]);
 fs.writeFileSync(path.join(out,'mone-verification.json'),JSON.stringify(state,null,2)+'\n');console.log('PASS: native save, automatic Mone encounter, victory cleanup and reentry.');
 }finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
