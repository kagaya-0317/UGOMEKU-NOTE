const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/item-selection-prompts-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const {q}=await prepare();try{
 await q.evaluate('$gameVariables.setValue(64,2);$gameParty.gainItem($dataItems[53],1);$gameParty.gainItem($dataItems[54],1);$gameParty.gainItem($dataItems[52],1);$gameParty.gainItem($dataItems[1],1);Window_Message.prototype.getMessageSpeed=function(){return 0;};true');
 const paused=text=>q.until(`JSON.stringify($gameMessage._texts)===${JSON.stringify(JSON.stringify(text))}&&SceneManager._scene._messageWindow.pause`,'message '+text.join('/'));
 const advance=()=>q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');
 const select=()=>q.until('$gameMessage.isItemChoice()&&SceneManager._scene._messageWindow._itemWindow.active&&SceneManager._scene._messageWindow._itemWindow.openness===255','item choice');
 const choose=async id=>{await select();await q.evaluate(`(function(){var w=SceneManager._scene._messageWindow._itemWindow;if(${id}===0)w.processCancel();else{var index=w._data.findIndex(item=>item.id===${id});if(index<0)throw Error('missing '+${id});w.select(index);w.processOk();}return true;})()`);await q.sleep(200);};
 const shot=async name=>{await q.sleep(350);const b=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(b,'base64'));};
 const system=()=>q.evaluate('({text:$gameMessage._texts,fukidashi:$gameMessage._fukidashi,tail:$gameMessage._tailDir,height:SceneManager._scene._messageWindow.height})');
 const finish=async()=>{await q.evaluate('__gnuroIntroQA.auto=true;true');await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','finish');await q.evaluate('__gnuroIntroQA.auto=false;true');};
 await q.map(60,25.5,16.5);await q.evaluate('__gnuroIntroQA.route(25.5,12.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','gate approach');for(let i=0;i<6&&!await q.evaluate('$gameMap.isEventRunning()');i++){await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(200);}
 await paused(['カギがかかっているようだ','カギ穴が2つある']);const gateIntro=await system();assert.equal(gateIntro.fukidashi,false);assert.equal(gateIntro.tail,5);assert.equal(await q.evaluate('$gameMessage.isItemChoice()'),false);await shot('gate_locked_message');await advance();
 await select();const firstKey=await system();assert.deepEqual(firstKey.text,['カギを選ぼう']);await shot('first_key_prompt');await choose(53);
 await select();const secondKey=await system();assert.deepEqual(secondKey.text,['カギをもう1本選ぼう']);assert.ok(!await q.evaluate('SceneManager._scene._messageWindow._itemWindow._data.some(i=>i.id===53)'));await shot('second_key_prompt');await choose(54);await finish();assert.deepEqual(await q.evaluate('[$gameVariables.value(66),$gameParty.numItems($dataItems[53]),$gameParty.numItems($dataItems[54])]'),[1,0,0]);
 // Run the saved 1F NPC event; pause at its new system prompt before selecting.
 await q.evaluate('$gameVariables.setValue(54,1);true');await q.map(49,34,10);await q.evaluate('(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(text==="リップクリームを渡そう")__gnuroIntroQA.auto=false;return add.apply(this,arguments);};__gnuroIntroQA.auto=true;$gameMap.event(14).start();return true;})()');
 await select();const lip=await system();assert.deepEqual(lip.text,['リップクリームを渡そう']);assert.equal(lip.fukidashi,false);assert.equal(lip.tail,5);await shot('lip_cream_prompt');await choose(1);
 await paused(['なんだい★','そんなものは','いらないよ★']);const restored=await system();assert.equal(restored.fukidashi,true);assert.equal(restored.tail,9);assert.equal(await q.evaluate('$gameSwitches.value(4)'),false);await finish();assert.equal(await q.evaluate('$gameParty.numItems($dataItems[52])'),1);
 await q.evaluate('__gnuroIntroQA.auto=true;$gameMap.event(14).start();true');await select();await choose(0);await finish();assert.equal(await q.evaluate('$gameSwitches.value(4)'),false);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({gateIntro,firstKey,secondKey,lip,restored,keysConsumedOnUnlock:true,firstKeyExcluded:true,lipWrongItemAndCancelRestoreNpc:true},null,2));console.log('PASS locked-door notice, both key prompts, distinct-key filter, unlock, lip prompt, and NPC restoration');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
