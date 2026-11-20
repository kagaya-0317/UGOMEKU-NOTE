// Compare the guest with a genuine fourth actor rendered by the native battle.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {connect}=require('../gnuro_prebattle/client.cjs');
const out=path.resolve(__dirname,'../../artifacts/beast-fourth-party-slot-20261119');fs.mkdirSync(out,{recursive:true});
const battleLines=[['ぬおッ！？'],['なぜこちら側に！？','間違えたなり！！'],['でも…こっち側も','なんだか悪くないのじゃ'],['ヘッヘッ…']];
async function main(){const q=await connect(),cases=[];try{
 await q.ready();await q.call('Page.reload');await q.ready();
 await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4,5];$gamePlayer.refresh();true');await q.evaluate(fs.readFileSync(path.resolve(__dirname,'../gnuro_prebattle/driver.js'),'utf8'));await q.map(54,10,22.5);
 // Actor 5 is used only in this isolated QA reference, never in the encounter.
 await q.evaluate('__gnuroIntroQA.auto=true;BattleManager.setup(43,false,false);SceneManager.push(Scene_NewBattle);true');await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()&&SceneManager._scene.isBattleActive()','native four-person reference',45000);await q.sleep(300);
 const reference=await q.evaluate('SceneManager._scene._actorSprites.map(s=>({home:[s._homeX,s._homeY],position:[s.x,s.y]}))');assert.equal(reference.length,4);
 await q.evaluate('BattleManager.abort();BattleManager.checkAbort();true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gameParty.inBattle()','reference battle native abort',30000);
 await q.evaluate('(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if($gameParty.inBattle()&&$gameTroop._troopId===47)__gnuroIntroQA.auto=false;return add.apply(this,arguments);};Window_Message.prototype.getMessageSpeed=function(){return 0;};return true;})()');
 for(const [index,party] of [[2,3,4],[2,4,3],[2,3],[2,4],[2]].entries()){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(64,0);__gnuroIntroQA.auto=true;__gnuroIntroQA.messages=[];true`);await q.map(60,6,18.5);await q.evaluate('$gamePlayer.moveStraight(8);true');
  const bubbles=[];
  for(const [lineIndex,lines] of battleLines.entries()){
   await q.until(`SceneManager._scene instanceof Scene_NewBattle&&$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause&&!SceneManager._scene._messageWindow._textState&&JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(lines))}`,'guest line '+lines[0],35000);await q.sleep(150);
   const state=await q.evaluate('({guest:{home:[SceneManager._scene._castleGuestSprite._homeX,SceneManager._scene._castleGuestSprite._homeY],position:[SceneManager._scene._castleGuestSprite.x,SceneManager._scene._castleGuestSprite.y],scale:[SceneManager._scene._castleGuestSprite.scale.x,SceneManager._scene._castleGuestSprite.scale.y],forward:!!SceneManager._scene._castleGuestSprite._forward},allies:SceneManager._scene._actorSprites.map(s=>({home:[s._homeX,s._homeY],position:[s.x,s.y]})),party:$gameParty._actors.slice(),guestInActions:SceneManager._scene._actorSprites.some(s=>s._battler.actorId()===6),popup:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,w:SceneManager._scene._messageWindow.width,h:SceneManager._scene._messageWindow.height},tone:SceneManager._scene._messageWindow._fukidashiSprite._fukidashiDrawType})');
   assert.deepEqual(state.guest.home,reference[3].home,'Guest has the genuine fourth actor home');assert.deepEqual(state.guest.position,reference[3].position,'Guest renders at the genuine fourth actor position');assert.deepEqual(state.guest.scale,[1.2,1.2]);assert.equal(state.guest.forward,false);assert.deepEqual(state.party,party);assert.equal(state.guestInActions,false);
   state.allies.forEach((s,i)=>assert.deepEqual(s.home,reference[i].home,'Existing allies use the native four-person formation'));
   assert.ok(state.popup.x>=0&&state.popup.y>=0&&state.popup.x+state.popup.w<=816&&state.popup.y+state.popup.h<=624,'Popup fits after moving the speaker');assert.equal(state.tone,lineIndex<2?1:0);
   if(index===0&&lineIndex===1){const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'beast_fourth_slot.png'),Buffer.from(png,'base64'));}
   bubbles.push(state);const prior=JSON.stringify(lines);await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(prior)}`,'advance');await q.sleep(150);
  }
  await q.evaluate('__gnuroIntroQA.auto=true;true');await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(64)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','return to map',45000);
  const after=await q.evaluate('({party:$gameParty._actors.slice(),shown:$gamePlayer.followers().isVisible(),camera:$gamePlayer._centerXy,proxiesHidden:[9,10].every(id=>$gameMap.event(id).isTransparent()),chest:$gameMap.event(5)._pageIndex,error:__gnuroIntroQA.error})');assert.deepEqual(after.party,party);assert.equal(after.shown,true);assert.deepEqual(after.camera,[0,0]);assert.equal(after.proxiesHidden,true);assert.equal(after.chest,1);assert.equal(after.error,null);
  cases.push({party,bubbles,after});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({reference,cases},null,2));console.log('PASS '+party+' matches native fourth slot, bubble placement and map return');
 }
}finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
