const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{prepare}=require('../beast_dialogue/capture_client.cjs'),dialogue=require('./mone_dialogue.cjs');
const out=path.resolve(__dirname,'../../artifacts/mone50-dialogue-20261120');fs.mkdirSync(out,{recursive:true});
async function main(){const{q}=await prepare();try{
 await q.evaluate(`(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(text===${JSON.stringify(dialogue.during[1].lines[0][1][0])})__gnuroIntroQA.auto=false;return add.apply(this,arguments);};Window_Message.prototype.getMessageSpeed=function(){return 0;};window.__mone50Trace=[];var update=SceneManager.updateScene;SceneManager.updateScene=function(){var r=update.apply(this,arguments),s=SceneManager._scene,w=s._moneWave;if(w){var bar=s._barSprite;__mone50Trace.push({frame:Graphics.frameCount,disorder:w.disorder||0,amp:w.amplitude,phase:w.phase,elapsed:w.elapsed,arrangement:!!w.arrangement,error:Math.max(0,...s._buttonSprites.map(b=>Math.abs(b.y-(bar.height/2+(b._index%2?18:0))-KNH_ZXC_Battle_Mone.offset(b.x,bar.width,w.amplitude,w.phase,w.disorder,w.chaos))))});}return r;};return true;})()`);
 const results=[];
 for(const[caseIndex,party]of [[2,3,4],[2,4]].entries()){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameParty.members().forEach(a=>{a.addParam(0,10000);a.setHp(a.mhp);});__gnuroIntroQA.auto=true;BattleManager.setup(46,false,false);SceneManager.push(Scene_NewBattle);true`);
  await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&ImageManager.isReady()','Mone native battle');
  await q.evaluate('$gameTroop.members()[0].addParam(0,1000000);$gameTroop.members()[0].setHp(Math.floor($gameTroop.members()[0].mhp*.74));true');
  await q.until('SceneManager._scene._castleMoneDialogue&&SceneManager._scene._castleMoneDialogue.phase===1&&!$gameTroop.isEventRunning()&&SceneManager._scene._moneWave&&SceneManager._scene._moneWave.started&&SceneManager._scene._moneWave.amplitude>20','HP75 wave resumes',40000);
  if(caseIndex===0)await q.until('!SceneManager._scene._moneWave&&SceneManager._scene._moneWaveLast','first wave fully expires',20000);
  await q.evaluate('__mone50Trace=[];$gameTroop.members()[0].setHp(Math.floor($gameTroop.members()[0].mhp*.49));true');
  const messages=[];let shaderPixels=0;
  for(const[index,[who,lines]]of dialogue.during[1].lines.entries()){
   if(who!=='enemy'&&!party.includes(who))continue;
   await q.until(`JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(lines))}&&SceneManager._scene._messageWindow.pause`,'HP50 line '+index,40000);
   const state=await q.evaluate('({texts:$gameMessage._texts.slice(),speaker:SceneManager._scene._castleMoneDialogue.speaker,tone:$gameVariables.value(14),rect:[SceneManager._scene._messageWindow.x,SceneManager._scene._messageWindow.y,SceneManager._scene._messageWindow.width,SceneManager._scene._messageWindow.height],wave:SceneManager._scene._moneWave?{amp:SceneManager._scene._moneWave.amplitude,disorder:SceneManager._scene._moneWave.disorder||0,elapsed:SceneManager._scene._moneWave.elapsed,pending:SceneManager._scene._moneWave.pending,arrangement:!!SceneManager._scene._moneWave.arrangement}:null})');
   assert.equal(state.speaker,who);assert.equal(state.tone,0);assert(state.rect[0]>=0&&state.rect[1]>=0&&state.rect[0]+state.rect[2]<=816&&state.rect[1]+state.rect[3]<=624,'Bubble in frame');
   if(index<=4){if(caseIndex===0)assert.equal(state.wave,null);else assert.equal(state.wave.disorder,0);}
   else{assert.equal(state.wave.amp,24);assert.equal(state.wave.disorder,index<=6?1:0);assert.equal(state.wave.elapsed,0);assert.equal(state.wave.pending,true);assert.equal(state.wave.arrangement,false);}
   if(index===6){shaderPixels=await q.evaluate('(function(){var s=SceneManager._scene,w=s._moneWave,renderer=Graphics._renderer,c=document.createElement("canvas");c.width=816;c.height=624;var ctx=c.getContext("2d");renderer.render(s);ctx.drawImage(Graphics._canvas,0,0);var a=ctx.getImageData(48,350,720,100).data;w.disorder=0;renderer.render(s);ctx.clearRect(0,0,816,624);ctx.drawImage(Graphics._canvas,0,0);var b=ctx.getImageData(48,350,720,100).data,n=0;for(var i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>20)n++;w.disorder=1;renderer.render(s);return n;})()');assert(shaderPixels>500);}
   if(caseIndex===0&&[6,8].includes(index)){const b=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,index===6?'disordered.png':'aligned.png'),Buffer.from(b,'base64'));}
   messages.push({index,...state});await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(JSON.stringify(lines))}`,'advance HP50 line');
  }
  await q.until('SceneManager._scene._castleMoneDialogue.phase===2&&!$gameTroop.isEventRunning()&&SceneManager._scene._moneWave&&SceneManager._scene._moneWave.started','HP50 battle resumes',30000);
  assert.equal(await q.evaluate('SceneManager._scene._moneWave.disorder'),0);
  if(caseIndex===0)await q.until('!SceneManager._scene._moneWave&&SceneManager._scene._moneWaveLast.elapsed>=SceneManager._scene._moneWaveLast.total','two aligned rounds finish',20000);
  const trace=await q.evaluate('__mone50Trace');assert(trace.every(t=>t.error<1e-5));assert(trace.some(t=>t.disorder>0&&t.disorder<1));assert(trace.some(t=>t.disorder===1));
  await q.evaluate('__gnuroIntroQA.auto=true;$gameTroop.members()[0].setHp(0);BattleManager.checkBattleEnd();true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!$gameParty.inBattle()','native cleanup',40000);
  results.push({party,previousWaveExpired:caseIndex===0,messages,shaderPixels,trace,controlledHpForFlowOnly:true});console.log('PASS HP50 '+party+'; inheritedWave='+(caseIndex!==0));
 }
 const saved=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/Troops.json'),'utf8'))[46],before=JSON.parse(fs.readFileSync(path.join(out,'before/Troops.json'),'utf8'))[46];assert.deepEqual(saved.pages[0],before.pages[0]);assert.deepEqual(saved.pages[2],before.pages[2]);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({results,otherDialoguePagesUnchanged:true},null,2));
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
