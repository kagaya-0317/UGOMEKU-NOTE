const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{prepare}=require('../beast_dialogue/capture_client.cjs'),dialogue=require('./mone_dialogue.cjs');
const out=path.resolve(__dirname,'../../artifacts/mone-wave-dialogue-20261120');fs.mkdirSync(out,{recursive:true});
async function main(){const{q}=await prepare();try{
 await q.evaluate(`(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(text===${JSON.stringify(dialogue.during[0].lines[0][1][0])})__gnuroIntroQA.auto=false;return add.apply(this,arguments);};Window_Message.prototype.getMessageSpeed=function(){return 0;};return true;})()`);
 const results=[];
 for(const party of [[2,3,4],[2,4]]){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameParty.members().forEach(a=>{a.addParam(0,10000);a.setHp(a.mhp);});__gnuroIntroQA.auto=true;BattleManager.setup(46,false,false);SceneManager.push(Scene_NewBattle);true`);
  await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&ImageManager.isReady()','Mone native encounter');
  await q.evaluate('$gameTroop.members()[0].addParam(0,1000000);$gameTroop.members()[0].setHp(Math.floor($gameTroop.members()[0].mhp*.74));true');
  const messages=[];
  for(const[index,[who,lines]]of dialogue.during[0].lines.entries()){
   if(who!=='enemy'&&!party.includes(who))continue;
   await q.until(`JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(lines))}&&SceneManager._scene._messageWindow.pause`,'revised Mone line '+index,40000);
   const state=await q.evaluate('({texts:$gameMessage._texts.slice(),speaker:SceneManager._scene._castleMoneDialogue.speaker,rect:[SceneManager._scene._messageWindow.x,SceneManager._scene._messageWindow.y,SceneManager._scene._messageWindow.width,SceneManager._scene._messageWindow.height],wave:SceneManager._scene._moneWave?{amp:SceneManager._scene._moneWave.amplitude,elapsed:SceneManager._scene._moneWave.elapsed,pending:SceneManager._scene._moneWave.pending,revealing:SceneManager._scene._moneWave.revealing,phase:SceneManager._scene._moneWave.phase}:null})');
   assert.equal(state.speaker,who);assert(state.rect[0]>=0&&state.rect[1]>=0&&state.rect[0]+state.rect[2]<=816&&state.rect[1]+state.rect[3]<=624);
   if(index<=2)assert.equal(state.wave,null);else{assert.equal(state.wave.amp,24);assert.equal(state.wave.elapsed,0);assert.equal(state.wave.pending,true);assert.equal(state.wave.revealing,false);await q.sleep(300);assert.equal(await q.evaluate('SceneManager._scene._moneWave.elapsed'),0);}
   if(party.length===3&&index===3){const b=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'reaction.png'),Buffer.from(b,'base64'));}
   messages.push(state);await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(JSON.stringify(lines))}`,'advance revised line');
  }
  await q.until('SceneManager._scene._castleMoneDialogue.phase===1&&!$gameTroop.isEventRunning()&&SceneManager._scene._moneWave&&SceneManager._scene._moneWave.started','resume wave after conversation',30000);
  assert.equal(await q.evaluate('SceneManager._scene._moneWave.revealed'),true);
  await q.until('!SceneManager._scene._moneWave&&SceneManager._scene._moneWaveLast.elapsed>=SceneManager._scene._moneWaveLast.total','two full playable rounds',20000);
  await q.evaluate('__gnuroIntroQA.auto=true;$gameTroop.members()[0].setHp(0);BattleManager.checkBattleEnd();true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!$gameParty.inBattle()','native battle cleanup',40000);
  results.push({party,messages,twoPlayableRoundsAfterDialogue:true});console.log('PASS revised Mone dialogue '+party);
 }
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({results,controlledHpForFlowOnly:true},null,2));
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
