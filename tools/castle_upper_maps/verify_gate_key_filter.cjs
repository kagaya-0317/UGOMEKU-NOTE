const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/throne-gate-key-filter-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const {q}=await prepare();try{
 await q.evaluate('$gameVariables.setValue(64,2);$gameParty.gainItem($dataItems[53],1);$gameParty.gainItem($dataItems[54],1);$gameParty.gainItem($dataItems[1],1);true');await q.map(60,25.5,16.5);
 const selector=()=>q.until('$gameMessage.isItemChoice()&&SceneManager._scene._messageWindow._itemWindow.active&&SceneManager._scene._messageWindow._itemWindow.openness===255','key selector');
 const items=()=>q.evaluate('SceneManager._scene._messageWindow._itemWindow._data.map(item=>item.id)');
 const choose=async id=>{await selector();await q.evaluate(`(function(){var w=SceneManager._scene._messageWindow._itemWindow;if(${id}===0)w.processCancel();else{var index=w._data.findIndex(item=>item.id===${id});if(index<0)throw Error('Missing item '+${id});w.select(index);w.processOk();}return true;})()`);await q.sleep(180);};
 const start=async()=>{await q.evaluate('__gnuroIntroQA.route(25.5,12.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','approach');for(let i=0;i<6&&!await q.evaluate('$gameMessage.isItemChoice()');i++){await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(200);}await selector();};
 const finish=async()=>{await q.evaluate('__gnuroIntroQA.auto=true;true');await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','cleanup');await q.evaluate('__gnuroIntroQA.auto=false;true');};
 const inventory=()=>q.evaluate('[$gameParty.numItems($dataItems[53]),$gameParty.numItems($dataItems[54]),$gameVariables.value(66)]');
 await start();assert.ok((await items()).includes(53)&&(await items()).includes(54));await choose(53);await selector();const roundFirst=await items();assert.ok(!roundFirst.includes(53)&&roundFirst.includes(54)&&roundFirst.includes(1));assert.deepEqual(await inventory(),[1,1,0]);
 await q.sleep(300);const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'second_key_filtered.png'),Buffer.from(png,'base64'));
 await choose(0);await finish();assert.deepEqual(await inventory(),[1,1,0]);
 await start();const restarted=await items();assert.ok(restarted.includes(53)&&restarted.includes(54));await choose(54);await selector();const triangleFirst=await items();assert.ok(!triangleFirst.includes(54)&&triangleFirst.includes(53)&&triangleFirst.includes(1));await choose(1);await finish();assert.deepEqual(await inventory(),[1,1,0]);
 await start();await choose(53);await selector();await choose(54);await finish();assert.deepEqual(await inventory(),[0,0,1]);assert.deepEqual(await q.evaluate('$gamePlayer._centerXy'),[0,0]);
 // The same native window restores its ordinary filter outside this gate.
 await q.evaluate('$gameParty.gainItem($dataItems[53],1);$gameParty.gainItem($dataItems[54],1);$gameMessage.setItemChoice(3,1);SceneManager._scene._messageWindow._itemWindow.start();true');const ordinary=await items();assert.ok(ordinary.includes(53)&&ordinary.includes(54));assert.equal(await q.evaluate('SceneManager._scene._messageWindow._itemWindow.width'),816);await q.evaluate('SceneManager._scene._messageWindow._itemWindow.processCancel();true');
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({roundFirst,triangleFirst,restarted,ordinary,cancelConsumesNothing:true,wrongSecondConsumesNothing:true,opensWithDistinctKeys:true,ordinarySelectorUnaffected:true},null,2));console.log('PASS both key orders, cancellation/retry, wrong second item, unlock, and ordinary selector');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
