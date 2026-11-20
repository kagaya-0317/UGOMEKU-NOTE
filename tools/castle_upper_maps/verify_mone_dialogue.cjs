const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs'),dialogue=require('./mone_dialogue.cjs');
const out=path.resolve(__dirname,'../..',process.env.MONE_QA_OUT||'artifacts/mone-dialogue-20261120');fs.mkdirSync(out,{recursive:true});
async function main(){const{q,sound}=await prepare();try{
 await q.evaluate(`(function(){Window_Message.prototype.getMessageSpeed=function(){return 0;};var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(text===${JSON.stringify(dialogue.after[0][1][0])})__gnuroIntroQA.auto=false;return add.apply(this,arguments);};return true;})()`);
 const shot=async name=>{await q.sleep(100);const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));};
 const rendered=()=>q.evaluate('SceneManager._scene._spriteset._characterSprites.filter(function(sp){var c=sp._character;return c&&sp.visible&&sp.opacity>0&&!c.isTransparent()&&c.characterName()&&(c===$gamePlayer||c instanceof Game_Follower&&c.actor()||c instanceof Game_Event&&c.event().meta.castleUpperActor);}).map(function(sp){var c=sp._character;return c===$gamePlayer?2:c instanceof Game_Follower?c.actor().actorId():Number(c.event().meta.castleUpperActor);}).sort()');
 const results=[];
 const parties=process.env.MONE_QA_PARTIES?JSON.parse(process.env.MONE_QA_PARTIES):[[2,3,4],[2,4,3],[2],[2,4]];
 for(const party of parties){
  const reports=[];
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(63,0);$gameParty.members().forEach(a=>{a.addParam(0,10000);a.setHp(a.mhp);});__gnuroIntroQA.auto=false;true`);
  await q.map(59,4.5,24.5);assert.deepEqual(await q.evaluate('[$gameMap.event(3).x,$gameMap.event(3).y]'),[10,15]);
  const initial=await q.evaluate('({speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy.slice(),visible:$gamePlayer.followers().isVisible()})');
  await q.evaluate('__gnuroIntroQA.route(10,20.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()||$gameMap.isEventRunning()','normal route to Mone');
  for(let i=0;i<5&&!await q.evaluate('$gameMap.isEventRunning()');i++){await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(180);}
  async function lines(list,scope,shotPrefix){for(const[index,[who,text]]of list.entries()){
   if(who!=='enemy'&&!party.includes(who))continue;
   await q.until(`JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(text))}&&SceneManager._scene._messageWindow.pause`,'Mone '+scope+' line '+index,40000);
   const state=await q.evaluate('({text:$gameMessage._texts.slice(),rect:[SceneManager._scene._messageWindow.x,SceneManager._scene._messageWindow.y,SceneManager._scene._messageWindow.width,SceneManager._scene._messageWindow.height],tone:$gameVariables.value(14),battle:$gameParty.inBattle(),speaker:$gameParty.inBattle()?SceneManager._scene._castleMoneDialogue.speaker:SceneManager._scene._messageWindow.getPopupTargetCharacter().eventId(),moving:$gameParty.inBattle()?false:KNH_CastleUpper.isForming(),enemy:SceneManager._scene._enemySprites&&SceneManager._scene._enemySprites.map(s=>({pos:[s.x,s.y],anchor:[s.anchor.x,s.anchor.y],size:s._frameSize,scale:[s.scale.x,s.scale.y]}))})');
   assert.equal(state.battle,scope.startsWith('battle'));assert.equal(state.tone,0);assert.equal(state.moving,false);
   assert.equal(state.speaker,state.battle?who:who==='enemy'?3:who===3?8:9);
   assert(state.rect[0]>=0&&state.rect[1]>=0&&state.rect[0]+state.rect[2]<=816&&state.rect[1]+state.rect[3]<=624,'Popup outside screen '+scope+' '+index+' '+JSON.stringify(state));
   if(!state.battle)assert.deepEqual(await rendered(),party.slice().sort());
   if(party.join(',')==='2,3,4'&&[0,2].includes(index))await shot(shotPrefix+'-'+index);
   reports.push({scope,index,...state});
   await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');
   await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(JSON.stringify(text))}`,'advance Mone line');
  }}
  await lines(dialogue.before,'before','before');
  await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','Mone native battle');
  assert.deepEqual(await q.evaluate('[$gameTroop._troopId,$gameSwitches.value(16),$gameSwitches.value(17)]'),[46,false,false]);
  // Test HP thresholds without evaluating encounter balance or suppressing attacks.
  await q.evaluate('$gameTroop.members()[0].addParam(0,10000000);$gameTroop.members()[0].setHp($gameTroop.members()[0].mhp);true');
  for(const[i,part]of dialogue.during.entries()){
   const rate=party.join(',')==='2,4,3'?0.24:(part.hp-1)/100;
   await q.evaluate(`$gameTroop.members()[0].setHp(Math.floor($gameTroop.members()[0].mhp*${rate}));true`);
   await lines(part.lines,'battle'+i,'battle'+i);
   await q.until(`SceneManager._scene._castleMoneDialogue.phase===${i+1}&&!SceneManager._scene._castleMoneDialogue.eventRunning&&!$gameTroop.isEventRunning()`,'Mone phase resume');
   const resumed=await q.evaluate('({turn:SceneManager._scene._turn,flags:JSON.parse(JSON.stringify($gameTroop._eventFlags)),phase:SceneManager._scene._castleMoneDialogue.phase,pressing:SceneManager._scene._buttonSprites.some(b=>b._pressing)})');
   assert.equal(resumed.phase,i+1);assert(resumed.flags[i]);reports.push({scope:'resume',...resumed});
  }
  await q.evaluate('__gnuroIntroQA.auto=true;$gameTroop.members()[0].setHp(0);BattleManager.checkBattleEnd();true');
  await lines(dialogue.after,'after','after');
  await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(63)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','Mone map return',40000);
  assert.deepEqual(await rendered(),party.slice().sort());
  const final=await q.evaluate('({speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy.slice(),visible:$gamePlayer.followers().isVisible(),boss:[$gameMap.event(3).x,$gameMap.event(3).y,$gameMap.event(3)._pageIndex],tail:$gameMessage._tailDir})');assert.equal(final.speed,initial.speed);assert.deepEqual(final.camera,initial.camera);assert.equal(final.visible,initial.visible);assert.deepEqual(final.boss,[10,15,1]);assert.equal(final.tail,0);
  await q.evaluate('$gamePlayer.moveStraight(2);true');await q.until('!$gamePlayer.isMoving()','resumed following');assert.deepEqual(await rendered(),party.slice().sort());
  await q.map(59,4.5,24.5);assert.equal(await q.evaluate('$gameMap.isEventRunning()||$gameMap.event(3).characterName()!==""'),false);
  fs.writeFileSync(path.join(out,'party-'+party.join('-')+'.json'),JSON.stringify({party,initial,reports,final,forcedHpThresholdsAndVictoryForFlowOnly:true},null,2));results.push({party,messages:reports.filter(r=>r.text).length,completedReentry:true,restored:true});console.log('PASS Mone '+party);
 }
 await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate('DataManager.saveGame(86)'),true);assert.equal(await q.evaluate('DataManager.loadGame(86)'),true);await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!$gameMap.isEventRunning()','Mone completed save/load');assert.equal(await q.evaluate('$gameVariables.value(63)'),2);
 await q.evaluate('$gameTroop.setup(48);true');const boundary=await q.evaluate('$gameTroop.meetsConditions({conditions:{turnEnding:false,turnValid:true,turnA:0,turnB:0,enemyValid:false,actorValid:false,switchValid:false},list:[{code:108,parameters:["<MoneGate:99,99>"]}]})');assert.equal(boundary,true);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({sound,results,saveLoad:true,otherTroopConditionUnchanged:true,waveEffectNotImplemented:true,combatBalanceNotEvaluated:true},null,2));console.log('PASS save/load and other-encounter boundary');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
