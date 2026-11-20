const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/item-selection-prompts-20261119');
async function main(){const{q}=await prepare();try{
 await q.evaluate('$gameVariables.setValue(54,1);$gameParty.gainItem($dataItems[52],1);$gameParty.gainItem($dataItems[1],1);Window_Message.prototype.getMessageSpeed=function(){return 0;};true');await q.map(49,34,10);
 await q.evaluate('(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(text==="リップクリームを渡そう")__gnuroIntroQA.auto=false;return add.apply(this,arguments);};__gnuroIntroQA.auto=true;$gameMap.event(14).start();return true;})()');
 const selector=()=>q.until('$gameMessage.isItemChoice()&&SceneManager._scene._messageWindow._itemWindow.active&&SceneManager._scene._messageWindow._itemWindow.openness===255','lip selection');
 const choose=async id=>{await selector();await q.evaluate(`(function(){var w=SceneManager._scene._messageWindow._itemWindow;if(${id}===0)w.processCancel();else{w.select(w._data.findIndex(i=>i.id===${id}));w.processOk();}return true;})()`);};
 const finish=async()=>{await q.evaluate('__gnuroIntroQA.auto=true;true');await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','finish');await q.evaluate('__gnuroIntroQA.auto=false;true');};
 await selector();await q.sleep(350);const lip=await q.evaluate('({text:$gameMessage._texts,fukidashi:$gameMessage._fukidashi,tail:$gameMessage._tailDir,height:SceneManager._scene._messageWindow.height})');assert.deepEqual(lip.text,['リップクリームを渡そう']);assert.equal(lip.fukidashi,false);assert.equal(lip.tail,5);
 const b=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'lip_cream_prompt.png'),Buffer.from(b,'base64'));
 await choose(1);await q.until('$gameMessage._texts[0]==="なんだい★"&&SceneManager._scene._messageWindow.pause','NPC response');const restored=await q.evaluate('({fukidashi:$gameMessage._fukidashi,tail:$gameMessage._tailDir,switch4:$gameSwitches.value(4)})');assert.deepEqual(restored,{fukidashi:true,tail:9,switch4:false});await finish();
 await q.evaluate('__gnuroIntroQA.auto=true;$gameMap.event(14).start();true');await selector();await choose(0);await finish();assert.equal(await q.evaluate('$gameSwitches.value(4)'),false);assert.equal(await q.evaluate('$gameParty.numItems($dataItems[52])'),1);
 fs.writeFileSync(path.join(out,'lip-verification.json'),JSON.stringify({lip,restored,wrongItemAndCancelRestoreNpc:true},null,2));console.log('PASS lip prompt, original NPC bubble restoration, wrong-item response and cancel cleanup');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
