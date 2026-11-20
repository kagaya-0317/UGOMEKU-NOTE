const {connect}=require('./qa_client.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../artifacts/castle-upper-events-20261118');
async function main(){const q=await connect(),report={};try{
 const idle=()=>q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','map idle');
 const xy=()=>q.evaluate('({map:$gameMap.mapId(),x:$gamePlayer.x,y:$gamePlayer.y,walkable:$gameMap.isPassableByHalfRegionAndTag($gamePlayer.x,$gamePlayer.y)})');
 const ready=id=>q.until(`$gameMap.mapId()===${id}&&SceneManager._scene instanceof Scene_Map&&!$gamePlayer.isTransferring()&&!SceneManager._nextScene`,'transfer '+id);
 const place=async(x,y,d=8)=>{await q.evaluate(`$gamePlayer.locate(${x},${y});$gamePlayer.setDirection(${d});$gameMap.rejudgeEvents();true`);await q.sleep(250);};
 const step=async d=>{await q.evaluate('$gamePlayer.moveStraight('+d+');true');await q.sleep(300);};
 const screen=async name=>{await q.sleep(500);const r=await q.call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
 await q.map(55,19,10,6);await idle();assert.equal((await xy()).walkable,true);await step(6);await step(6);await ready(59);await idle();report.roadExit=await xy();assert.deepEqual(report.roadExit,{map:59,x:4.5,y:24.5,walkable:true});
 await place(4,24.5,4);await step(4);await ready(55);await idle();report.roadReturn=await xy();assert.deepEqual(report.roadReturn,{map:55,x:19,y:10,walkable:true});
 await q.map(59,10,7.5);await idle();for(let i=0;i<5&&await q.evaluate('$gameMap.mapId()===59');i++)await step(8);await ready(60);await idle();report.stairsUp=await xy();assert.deepEqual(report.stairsUp,{map:60,x:14.5,y:25,walkable:true});
 await step(2);await step(2);await ready(59);await idle();report.stairsDown=await xy();assert.deepEqual(report.stairsDown,{map:59,x:10,y:7.5,walkable:true});
 await place(13,26);await screen('mone-save-note');
 await q.map(60,37,12.5);await idle();await step(8);await step(8);await ready(61);await idle();assert.equal((await xy()).walkable,true);report.gimmickFirst=await q.evaluate('({flag:$gameVariables.value(65),beast:$gameVariables.value(64),exit:$gameMap.event(4)._pageIndex})');assert.deepEqual(report.gimmickFirst,{flag:2,beast:0,exit:0});
 await place(10,9);await q.evaluate('$gameMap.event(2).start();true');await q.sleep(100);await idle();assert.equal(await q.evaluate('$gameParty.numItems($dataItems[54])'),1);
 await place(15.5,24.5,2);await step(2);await ready(60);await idle();report.b1Return=await xy();assert.deepEqual(report.b1Return,{map:60,x:37,y:12.5,walkable:true});
 await place(6,18.5);await step(8);await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted','beast after gimmick');await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(64)===2','friendly return',35000);await idle();
 await place(6,12);await q.evaluate('$gameMap.event(5).start();true');await q.sleep(100);await idle();report.reverseOrder=await q.evaluate('[53,54].map(id=>$gameParty.numItems($dataItems[id]))');assert.deepEqual(report.reverseOrder,[1,1]);
 await place(25.5,12);await step(8);await ready(62);await idle();assert.equal(await q.evaluate('$gameVariables.value(66)'),1);
 await place(5,25);await screen('throne-save-box');
 await q.evaluate('__castleQA.auto=false;true');await place(10,18.5);await step(8);await q.until('$gameVariables.value(67)===1&&$gameMessage.isBusy()','normal throne intro');await q.sleep(500);await screen('throne-introduction');report.intro=await q.evaluate('({camera:$gamePlayer._centerXy,ui:!!SceneManager._scene._sceneInfo,boss:[$gameMap.event(3).x,$gameMap.event(3).y],bossFrame:$gameMap.event(3)._cssRect})');assert.equal(report.intro.ui,false);
 await q.evaluate('__castleQA.auto=true;true');await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&ImageManager.isReady()','final battle');await q.sleep(1800);await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(67)===2','final return',40000);await idle();
 console.log('PASS',JSON.stringify(report));
 }finally{fs.writeFileSync(path.join(out,'transfer-verification.json'),JSON.stringify(report,null,2)+'\n');q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
