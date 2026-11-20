const fs=require('node:fs'),path=require('node:path');
const{prepare}=require('../beast_dialogue/capture_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/tsunehi-prebattle-20261120');
async function main(){const{q}=await prepare();const reports=[];try{
 for(const party of [[2,3,4],[2,4,3]]){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(67,0);__gnuroIntroQA.auto=true;Window_Message.prototype.getMessageSpeed=function(){return 0;};true`);await q.map(62,10,18.5);
  await q.evaluate('KNH_CastleUpper.beginScene(3,true);true');await q.until('!KNH_CastleUpper.isForming()','formation');
  await q.evaluate('(function(){var list=$dataMap.events[5].pages[0].list,index=list.findIndex(c=>c.code===301);$gameMap._interpreter.setup(list.slice(index),5);$gameVariables.setValue(67,1);return true;})()');
  await q.until('SceneManager._scene instanceof Scene_NewBattle&&!!SceneManager._scene._actorSprites','battle');await q.sleep(400);
  const requested=await q.evaluate('$gameTroop.members().forEach(e=>e.die());BattleManager.checkBattleEnd()');
  const states=[];for(let i=0;i<12;i++){await q.sleep(700);const s=await q.evaluate('({scene:SceneManager._scene.constructor.name,phase:BattleManager._phase,flag:$gameVariables.value(67),text:$gameMessage._texts,busy:$gameMessage.isBusy(),partyHP:$gameParty.members().map(a=>a.hp),enemyHP:$gameTroop.members().map(a=>a.hp),endCount:SceneManager._scene._battleEndCount,skip:SceneManager._scene._skip,finish:SceneManager._scene._inFinish,todome:SceneManager._scene._inTodome,troopRunning:$gameTroop.isEventRunning(),troopIndex:$gameTroop._interpreter._index,troopWait:$gameTroop._interpreter._waitMode,command:$gameTroop._interpreter._list&&$gameTroop._interpreter.currentCommand(),skLv:$gameTemp._skLvUpInfos&&$gameTemp._skLvUpInfos.length,lv:$gameTemp._lvUpInfos&&$gameTemp._lvUpInfos.length,reward:$gameTemp._itemRewards&&$gameTemp._itemRewards.length})');states.push(s);console.log(JSON.stringify({party,requested,state:s}));if(s.scene==='Scene_Map'&&s.flag===2)break;}
  reports.push({party,requested,states});if(states.at(-1).scene!=='Scene_Map')break;
 }
 fs.writeFileSync(path.join(out,'return-diagnostic.json'),JSON.stringify(reports,null,2));
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
