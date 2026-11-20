const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{prepare}=require('../beast_dialogue/capture_client.cjs');
async function main(){const{q}=await prepare();const out=path.resolve(__dirname,'../../artifacts/artist-sources-20261120');try{
 await q.evaluate('$gameVariables.setValue(64,2);$gameVariables.setValue(66,0);__gnuroIntroQA.auto=false;true');await q.map(60,25.5,13.5);
 const gate=await q.evaluate('(function(){var e=$gameMap.event(8),s=e.sprite();return {image:e.characterName(),frame:[s._frame.width,s._frame.height],pos:[e.x,e.y],scale:[e._scaleX,e._scaleY]};})()');assert.equal(gate.image,'castleThroneDoor');assert.deepEqual(gate.frame,[192,192]);assert.deepEqual(gate.pos,[25.5,11]);assert.deepEqual(gate.scale,[180,180]);
 await q.evaluate('$gameMap.event(8)._castleGateOpening=0;true');await q.until('$gameMap.event(8)._castleGateOpening>=73','native gate rendering');await q.evaluate('$gameVariables.setValue(66,1);KNH_CastleUpper.refreshEvents();true');await q.sleep(200);
 assert.deepEqual(await q.evaluate('(function(){var s=$gameMap.event(8).sprite();return[s._frame.x,s._frame.width,s._frame.height];})()'),[192,192,192]);
 await q.map(60,6,18.5);assert.equal(await q.evaluate('$gameMap.event(8).characterName()'),'castleThroneDoor');assert.deepEqual(await q.evaluate('[$gameMap.event(2).x,$gameMap.event(2).y,$gameMap.event(2).characterName()]'),[2.5,14,'$castleBeast']);
 await q.evaluate('$gameVariables.setValue(64,0);true');await q.map(60,6,18.5);assert.deepEqual(await q.evaluate('[$gameMap.event(2).x,$gameMap.event(2).y,$gameMap.event(2).characterName()]'),[5,14,'$castleBeast']);await q.evaluate('__gnuroIntroQA.auto=true;$gamePlayer.moveStraight(8);true');
 await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._scene._castleGuestSprite&&ImageManager.isReady()','beast native guest',40000);
 const beast=await q.evaluate('(function(){var s=SceneManager._scene._castleGuestSprite;return{pos:[s.x,s.y],name:s._battler.battlerName(),party:$gameParty._actors,frame:[s._frame.width,s._frame.height]};})()');assert.equal(beast.name,'castleBeast');assert.deepEqual(beast.pos,[64,372]);assert.deepEqual(beast.party,[2,3,4]);assert.deepEqual(beast.frame,[144,144]);
 fs.writeFileSync(path.join(out,'runtime-assets.json'),JSON.stringify({gate,gateNativeOpening:true,completedGateReentry:true,beastAsideReentry:true,beast},null,2));console.log('PASS native gate frames, reentry, beast editor placement/aside and fourth-slot battle image.');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
