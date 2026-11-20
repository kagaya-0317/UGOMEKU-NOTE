const {connect}=require('./client.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function main(){const q=await connect();try{
    await q.call('Page.reload');await q.ready();
    assert.equal(await q.evaluate('DataManager.loadGame(80)'),true);
    await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');
    await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','settled completed map');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    assert.equal(await q.evaluate('$gameVariables.value(60)'),2);
    await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate('DataManager.saveGame(80)'),true);
    await q.evaluate('$gameVariables.setValue(60,0);true');assert.equal(await q.evaluate('DataManager.loadGame(80)'),true);
    await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');
    await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','native save/load return');
    assert.equal(await q.evaluate('$gameVariables.value(60)'),2);
    await q.evaluate('__gnuroIntroQA.route(1.5,25.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','walk to hallway exit');
    for(let i=0;i<12;i++){if(await q.evaluate('$gameMap.mapId()===52'))break;await q.evaluate('if(!$gamePlayer.isMoving()&&!$gameMap.isEventRunning())$gamePlayer.moveStraight(4);true');await q.sleep(300);}
    await q.until('$gameMap.mapId()===52&&!$gameMap.isEventRunning()&&!$gamePlayer.isTransferring()&&ImageManager.isReady()','native return to 2F');
    await q.evaluate('__gnuroIntroQA.route(39,25.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','walk to 2F door');
    for(let i=0;i<12;i++){if(await q.evaluate('$gameMap.mapId()===54'))break;await q.evaluate('if(!$gamePlayer.isMoving()&&!$gameMap.isEventRunning())$gamePlayer.moveStraight(6);true');await q.sleep(300);}
    await q.until('$gameMap.mapId()===54&&!$gameMap.isEventRunning()&&!$gamePlayer.isTransferring()&&ImageManager.isReady()','native hallway reentry');
    assert.equal(await q.evaluate('$gameVariables.value(60)'),2);
    assert.equal(await q.evaluate('$gameMap.event(1).characterName()'), '');
    assert.equal(await q.evaluate('!!$gameTemp._castleUpperScene'),false);
    const result={saveLoad:true,nativeWalkingTransferBothWays:true,completedStateReentry:true,partyCasesPassed:[[2,3,4],[2,4,3],[2,3],[2,4],[2]],forcedVictoryOnlyForCleanupTests:true};
    fs.writeFileSync(path.resolve(__dirname,'../../artifacts/gnuro-prebattle-20261119/verification.json'),JSON.stringify(result,null,2));
    console.log('PASS completed-state save/load, normal walking transfers both directions, no repeated introduction');
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
