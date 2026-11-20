// The friendly encounter's skip guard must delegate to normal combat elsewhere.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {connect}=require('../gnuro_prebattle/client.cjs');
async function main(){const q=await connect();try{
 await q.ready();await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(a=>{a.changeLevel(10,false);a.recoverAll();});$gamePlayer.refresh();true');await q.evaluate(fs.readFileSync(path.resolve(__dirname,'../gnuro_prebattle/driver.js'),'utf8'));await q.map(54,10,22.5);
 await q.evaluate('__gnuroIntroQA.auto=true;BattleManager.setup(43,false,false);SceneManager.push(Scene_NewBattle);true');
 await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()&&SceneManager._scene.isBattleActive()','normal combat input',45000);
 const state=await q.evaluate('({troop:$gameTroop._troopId,active:SceneManager._scene.isBattleActive(),skip:SceneManager._scene.updateSkip(),guest:!!SceneManager._scene._castleGuestSprite,party:$gameParty._actors})');
 assert.equal(state.troop,43);assert.equal(state.active,true);assert.equal(state.skip,false);assert.equal(state.guest,false);assert.deepEqual(state.party,[2,3,4]);
 fs.writeFileSync(path.resolve(__dirname,'../../artifacts/beast-dialogue-20261119/normal-battle-boundary.json'),JSON.stringify(state,null,2));console.log('PASS normal battle keeps combat input and native skip behavior');
}finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
