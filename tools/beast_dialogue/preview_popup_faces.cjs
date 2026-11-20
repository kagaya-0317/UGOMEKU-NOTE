const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {prepare}=require('./capture_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/beast-conversation-movie-20261119'),work=path.join(out,'_capture');fs.mkdirSync(work,{recursive:true});
const lines=[['ぬおッ！？'],['なぜこちら側に！？','間違えたなり！！'],['でも…こっち側も','なんだか悪くないのじゃ'],['ヘッヘッ…']];
async function main(){const {q,sound}=await prepare();let finished=false;try{
 await q.evaluate('(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if($gameParty.inBattle()&&$gameTroop._troopId===47)__gnuroIntroQA.auto=false;return add.apply(this,arguments);};Window_Message.prototype.getMessageSpeed=function(){return 0;};__gnuroIntroQA.auto=true;$gamePlayer.moveStraight(8);return true;})()');const bubbles=[];
 for(const [i,text] of lines.entries()){
  await q.until(`SceneManager._scene instanceof Scene_NewBattle&&$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause&&!SceneManager._scene._messageWindow._textState&&JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(text))}`,'battle popup '+i,35000);await q.sleep(150);
  const state=await q.evaluate('({text:$gameMessage._texts.slice(),guest:[SceneManager._scene._castleGuestSprite._homeX,SceneManager._scene._castleGuestSprite._homeY],rect:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,w:SceneManager._scene._messageWindow.width,h:SceneManager._scene._messageWindow.height},tail:$gameMessage._tailDir,shape:SceneManager._scene._messageWindow._fukidashiSprite._fukidashiDrawType,allies:SceneManager._scene._actorSprites.map(s=>({actor:s._battler.actorId(),x:s.x,y:s.y}))})');
  assert.deepEqual(state.guest,[64,372]);assert.ok(state.rect.x>=0&&state.rect.y>=0&&state.rect.x+state.rect.w<=816&&state.rect.y+state.rect.h<=624);assert.equal(state.shape,i<2?1:0);
  const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(work,'popup_'+i+'.png'),Buffer.from(png,'base64'));bubbles.push(state);console.log(JSON.stringify(state));
  const prior=JSON.stringify(text);await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(prior)}`,'advance');await q.sleep(150);
 }
 await q.evaluate('__gnuroIntroQA.auto=true;true');await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(64)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','native return');fs.writeFileSync(path.join(out,'popup-verification.json'),JSON.stringify({sound,bubbles},null,2));finished=true;
}finally{if(!finished){try{await q.call('Browser.close');}catch(_){}}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
