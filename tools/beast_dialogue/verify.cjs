const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('../gnuro_prebattle/client.cjs');
const out=path.resolve(__dirname,'../../artifacts/beast-dialogue-20261119');fs.mkdirSync(out,{recursive:true});
const expected=[
 {text:['ぐるるるる…'],battle:false,tone:0},
 {text:['我は魔王城の番犬','「死の猛獣」なり…'],battle:false,tone:0},
 {text:['侵入者どもを','生かしておくわけには','いかぬのじゃ！！'],battle:false,tone:1,shot:'beast_threat.png'},
 {text:['ぬおッ！？'],battle:true,tone:1},
 {text:['なぜこちら側に！？','間違えたなり！！'],battle:true,tone:1,shot:'beast_wrong_side.png'},
 {text:['でも…こっち側も','なんだか悪くないのじゃ'],battle:true,tone:0},
 {text:['ヘッヘッ…'],battle:true,tone:0},
 {text:['うむ…仕方ない','通行を許可しようぞ'],battle:false,tone:0},
 {text:['我々…なんだか','友達になれた気がするのじゃ'],battle:false,tone:0,shot:'beast_friend.png'},
 {text:['ヘッヘッ…'],battle:false,tone:0}
];
async function main(){const q=await connect(),reports=[];try{
 await q.ready();await q.call('Page.reload');await q.ready();
 await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gamePlayer.refresh();true');
 // Reuse normal half-tile walking, without the Gnuro-specific recording setup.
 await q.evaluate(fs.readFileSync(path.resolve(__dirname,'../gnuro_prebattle/driver.js'),'utf8'));
 await q.evaluate(`(function(){
  window.__beastQA={messages:[],samples:[],guest:null};
  var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){__beastQA.messages.push({text:text,battle:$gameParty.inBattle(),tone:$gameVariables.value(14)});return add.apply(this,arguments);};
  Window_Message.prototype.getMessageSpeed=function(){return 0;};
  var update=SceneManager.updateScene;SceneManager.updateScene=function(){var result=update.apply(this,arguments);
   if(SceneManager._scene instanceof Scene_Map&&$gameTemp._castleUpperScene&&$gameTemp._castleUpperScene.mapId===60){var state=$gameTemp._castleUpperScene;__beastQA.samples.push({phase:state.returning?'return':'approach',hero:{x:$gamePlayer._realX,y:$gamePlayer._realY,speed:$gamePlayer._moveSpeed},people:state.members.map(m=>{var e=$gameMap.event(m.eventId);return {actor:m.actorId,x:e._realX,y:e._realY,speed:e._moveSpeed,visible:!e.isTransparent()};})});}
   if(SceneManager._scene instanceof Scene_NewBattle&&SceneManager._scene._castleGuestSprite){var s=SceneManager._scene;__beastQA.guest={actor:s._castleGuestSprite._battler.actorId(),party:$gameParty._actors.slice(),inActions:s._actorSprites.some(sp=>sp._battler.actorId()===6),enemyHidden:s._enemySprites.every(sp=>!sp.visible),active:s.isBattleActive()};}
   return result;};return true;
 })()`);
 for(const [caseIndex,party] of [[2,3,4],[2,4,3],[2,3],[2,4],[2]].entries()){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(64,0);__gnuroIntroQA.auto=false;__beastQA.messages=[];__beastQA.samples=[];__beastQA.guest=null;true`);
  await q.map(60,6,18.5);await q.sleep(200);
  const initial=await q.evaluate('({speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy.slice(),boss:[$gameMap.event(2).x,$gameMap.event(2).y],chest:$gameMap.event(5)._pageIndex,proxies:[9,10].map(id=>({id:id,x:$gameMap.event(id).x,y:$gameMap.event(id).y,hidden:$gameMap.event(id).isTransparent()}))})');
  assert.equal(initial.chest,0);assert.ok(initial.proxies.every(p=>p.hidden));
  await q.evaluate('$gamePlayer.moveStraight(8);true');
  const bubbles=[];
  if(caseIndex===0){
   for(const spec of expected){
    await q.until(`$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause&&!SceneManager._scene._messageWindow._textState&&JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(spec.text))}`,'dialogue '+spec.text[0],35000);await q.sleep(120);
    const info=await q.evaluate('({text:$gameMessage._texts.slice(),battle:$gameParty.inBattle(),tone:$gameVariables.value(14),shape:SceneManager._scene._messageWindow._fukidashiSprite._fukidashiDrawType,rect:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,w:SceneManager._scene._messageWindow.width,h:SceneManager._scene._messageWindow.height},textHeight:SceneManager._scene._messageWindow._textRect.height,guest:__beastQA.guest,party:$gameParty._actors.slice()})');
    if(spec.shot){const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,spec.shot),Buffer.from(png,'base64'));}
    console.log('Popup geometry '+JSON.stringify(info));
    assert.equal(info.battle,spec.battle);assert.equal(info.tone,spec.tone);assert.equal(info.shape,spec.tone,'Native jagged/normal bubble');assert.deepEqual(info.party,party);assert.ok(info.rect.x>=0&&info.rect.y>=0&&info.rect.x+info.rect.w<=816&&info.rect.y+info.rect.h<=624,'Popup fits the screen');assert.equal(info.textHeight,spec.text.length*33,'Height follows real line count');
    bubbles.push(info);console.log('Checked '+(info.battle?'battle':'map')+' tone '+info.tone+' '+info.text.join(' / '));
    const prior=JSON.stringify(spec.text);await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(prior)}`,'advance');await q.sleep(120);
   }
  }else await q.evaluate('__gnuroIntroQA.auto=true;true');
  await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(64)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','friendly return',45000);await q.sleep(200);
  const after=await q.evaluate('({party:$gameParty._actors.slice(),speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy,followersShown:$gamePlayer.followers().isVisible(),followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y})),proxiesHidden:[9,10].every(id=>$gameMap.event(id).isTransparent()),boss:[$gameMap.event(2).x,$gameMap.event(2).y],chest:$gameMap.event(5)._pageIndex,tone:$gameVariables.value(14),fukidashi:$gameMessage._fukidashi,popup:$gameSystem.getMessagePopupId(),messages:__beastQA.messages,guest:__beastQA.guest,samples:__beastQA.samples,error:__gnuroIntroQA.error})');
  assert.equal(after.error,null);assert.deepEqual(after.party,party);assert.equal(after.speed,initial.speed);assert.deepEqual(after.camera,initial.camera);assert.deepEqual(after.boss,initial.boss);assert.equal(after.chest,1);assert.equal(after.followersShown,true);assert.equal(after.proxiesHidden,true);assert.equal(after.tone,0);assert.equal(after.fukidashi,false);
  assert.deepEqual(after.messages,expected.flatMap(s=>s.text.map(text=>({text,battle:s.battle,tone:s.tone}))),'Exact requested dialogue in the intended scenes');
  assert.equal(after.guest.actor,6);assert.equal(after.guest.inActions,false);assert.equal(after.guest.enemyHidden,true);assert.equal(after.guest.active,false);assert.deepEqual(after.guest.party,party);
  for(const actor of party.slice(1)){assert.ok(after.samples.some(s=>s.phase==='return'&&s.people.some(p=>p.actor===actor&&p.speed===4)),'Walk back at the reference speed');}
  assert.ok(after.samples.every(s=>s.hero.speed===initial.speed&&s.people.every(p=>p.speed===4)),'Preserve player speed and companion speed 4');
  await q.evaluate('__gnuroIntroQA.auto=true;__gnuroIntroQA.route(6,19.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','resumed following');
  const count=await q.evaluate('SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&!s._character.isTransparent()&&["$002","$003"].indexOf(s._character.characterName())>=0).length');assert.equal(count,party.length-1,'Exactly one rendered sprite per present companion');
  await q.map(60,6,18.5);await q.sleep(200);assert.equal(await q.evaluate('$gameMap.isEventRunning()'),false);assert.ok(await q.evaluate('[9,10].every(id=>$gameMap.event(id).isTransparent())'));
  reports.push({party,initial,bubbles,after:{...after,samples:undefined},movementFrames:after.samples.length});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({complete:false,cases:reports},null,2));console.log('PASS party '+party+' dialogue, display-only guest, return, treasure unlock and reentry');
 }
 await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate('DataManager.saveGame(82)'),true);await q.evaluate('$gameVariables.setValue(64,0);true');assert.equal(await q.evaluate('DataManager.loadGame(82)'),true);await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()&&!$gameMap.isEventRunning()','completed save/load');assert.equal(await q.evaluate('$gameVariables.value(64)'),2);assert.equal(await q.evaluate('$gameMap.event(5)._pageIndex'),1);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({nativeFriendlyBattle:true,forcedVictory:false,saveLoad:true,cases:reports},null,2));console.log('PASS completed-state save/load');
}finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
