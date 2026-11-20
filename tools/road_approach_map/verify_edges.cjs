// Walk into the new transfers at both ends of each drawn entrance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('../castle_upper_maps/qa_client.cjs');
async function main(){const q=await connect(),checks=[];try{
 const idle=()=>q.until('SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!$gamePlayer.isMoving()&&ImageManager.isReady()','edge idle');
 // The overview screenshot enlarges the canvas. Event culling assumes the
 // native 816x624 viewport, so restore it before testing actual play behavior.
 await q.evaluate('Graphics.width=816;Graphics.height=624;Graphics.boxWidth=816;Graphics.boxHeight=624;SceneManager.goto(Scene_Map);true');await idle();
 async function test(map,spawn,target,direction,to){
  await q.map(map,...spawn);await idle();await q.evaluate(`__spikeDriver.go(${target[0]},${target[1]})`);
  for(let i=0;i<12;i++){if(await q.evaluate(`$gameMap.mapId()===${to}||$gamePlayer.isTransferring()`))break;await q.evaluate(`if(!$gameMap.isEventRunning()&&!$gamePlayer.isMoving())$gamePlayer.moveStraight(${direction});true`);await q.sleep(160);}
  await q.until(`$gameMap.mapId()===${to}`,'edge transfer '+map+' -> '+to);await idle();assert.equal(await q.evaluate('$gamePlayer.isThrough()'),false);checks.push({from:map,approach:target,direction,to});
 }
 for(const x of[9,11])await test(54,[10,10],[x,9],8,63);
 for(const x of[3.5,6.5])await test(63,[5.5,27],[x,28],2,54);
 for(const y of[9,12])await test(63,[18.5,10.5],[18.5,y],6,55);
 for(const y of[22,25])await test(55,[2,23.5],[2,y],4,63);
 fs.writeFileSync(path.resolve(__dirname,'../../artifacts/road-approach-map-implementation-20261119/entrance-edge-verification.json'),JSON.stringify({nativeWalking:true,through:false,checks},null,2)+'\n');console.log(JSON.stringify({entranceEdgeCases:checks.length,passed:true}));
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
