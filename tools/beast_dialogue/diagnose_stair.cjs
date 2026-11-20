const fs=require('node:fs'),path=require('node:path');const {prepare}=require('./capture_client.cjs');
async function main(){const {q}=await prepare();try{
 await q.evaluate('$gameVariables.setValue(64,2);__gnuroIntroQA.auto=true;true');await q.map(60,14.5,25);
 const idle=()=>q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gamePlayer.isMoving()&&$gameScreen.brightness()===255','idle');await idle();
 const snap=()=>q.evaluate('({map:$gameMap.mapId(),pos:[$gamePlayer.x,$gamePlayer.y],dir:$gamePlayer.direction(),canMove:$gamePlayer.canMove(),half:$gamePlayer.isHalfMove(),speed:$gamePlayer._moveSpeed,playerThrough:$gamePlayer.isThrough(),stair:$gameMap.mapId()===59?{x:$gameMap.event(6).x,y:$gameMap.event(6).y,page:$gameMap.event(6)._pageIndex,trigger:$gameMap.event(6)._trigger}:null,pass:[2,4,6,8].map(d=>({d:d,ok:$gamePlayer.canPass($gamePlayer.x,$gamePlayer.y,d)})),running:$gameMap.isEventRunning(),event:$gameMap._interpreter._eventId})');
 const steps=[];for(let i=0;i<3&&await q.evaluate('$gameMap.mapId()===60');i++){await q.evaluate('$gamePlayer.moveStraight(2);true');await q.sleep(300);await idle();steps.push(await snap());}
 console.log('After down '+JSON.stringify(steps));
 const up=[];for(let i=0;i<8;i++){up.push(await snap());if(await q.evaluate('$gameMap.mapId()===60'))break;await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(300);await idle();}up.push(await snap());console.log('Up steps '+JSON.stringify(up));
 console.log('Grid '+JSON.stringify(await q.evaluate('(function(){var a=[];for(var y=4.5;y<=8;y+=.5)a.push({y:y,pass:$gamePlayer.canPass(10,y,8),region:$gameMap.regionId(10,y)});return a;})()')));
 fs.writeFileSync(path.resolve(__dirname,'../../artifacts/beast-aside-popup-20261119/stair-diagnostic.json'),JSON.stringify({steps,up},null,2));
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
