const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{prepare}=require('../beast_dialogue/capture_client.cjs');
async function main(){const{q}=await prepare();try{
 await q.evaluate('__gnuroIntroQA.auto=true;BattleManager.setup(46,false,false);SceneManager.push(Scene_NewBattle);true');await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&ImageManager.isReady()','Mone boundary');
 await q.evaluate('$gameTroop.members()[0].addParam(0,1000000);$gameTroop.members()[0].setHp($gameTroop.members()[0].mhp);KNH_CastleUpper.queueMoneWave(24,2);true');await q.until('SceneManager._scene._moneWave&&SceneManager._scene._moneWave.amplitude>20','running effect before victory',30000);
 await q.evaluate('window.__moneInterruptedScene=SceneManager._scene;window.__moneInterruptedFilters=SceneManager._scene._moneWave.filters.slice();$gameTroop.members()[0].setHp(0);BattleManager.checkBattleEnd();true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!$gameParty.inBattle()','victory interrupts wave',40000);
 assert.equal(await q.evaluate('!__moneInterruptedScene._moneWave&&__moneInterruptedFilters.every(r=>!r.target)'),true);
 await q.evaluate('$gameTemp._gnuroMapIntro=true;BattleManager.setup(43,false,false);SceneManager.push(Scene_NewBattle);true');await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!!SceneManager._scene._gnuro&&ImageManager.isReady()','Gnuro boundary');
 await q.evaluate('KNH_CastleUpper.queueMoneWave(24,2);SceneManager._scene.breakGnuroBar(90,45,50);true');await q.until('SceneManager._scene._gnuro.age>=45','native Gnuro break');
 const gnuro=await q.evaluate('({wave:!!SceneManager._scene._moneWave,depth:SceneManager._scene._gnuro.depth,filter:!!SceneManager._scene._gnuro.filterTarget,barPoint:SceneManager._scene.gnuroBarPoint(360,36)})');assert.equal(gnuro.wave,false);assert(gnuro.depth>89);assert(gnuro.filter);assert(gnuro.barPoint.y>120);
 fs.writeFileSync(path.resolve(__dirname,'../../artifacts/mone-wave-20261120/boundary-verification.json'),JSON.stringify({midWaveVictoryReleasesFilters:true,gnuro,forcedVictoryForCleanupOnly:true},null,2));console.log('PASS mid-wave victory cleanup and native Gnuro break unaffected.');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
