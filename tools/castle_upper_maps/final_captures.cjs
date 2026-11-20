const {connect}=require('./qa_client.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const q=await connect();try{
 if(process.argv.includes('--quit')){
   await q.map(55,19,10,6);
   const edge=await q.evaluate(`(function(){var e=$gameMap._events.filter(Boolean).filter(e=>e.event().name==='モーネの間へ')[0],floor=[];[20,20.5].forEach(x=>{for(var y=8;y<=13;y+=.5)if($gamePlayer.canPass(x-.5,y,6))floor.push({x:x,y:y,covered:e.isInExpansionArea(x,y)});});return floor;})()`);
   assert.ok(edge.length&&edge.every(p=>p.covered),'Uncovered corridor exit: '+JSON.stringify(edge));
   for(const y of [8,13]){
     await q.map(55,19,y,6);await q.until('!$gameMap.isEventRunning()','corridor idle');
     await q.evaluate('$gamePlayer.moveStraight(6);true');await q.sleep(300);await q.evaluate('$gamePlayer.moveStraight(6);true');
     await q.until('$gameMap.mapId()===59&&SceneManager._scene instanceof Scene_Map&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!SceneManager._nextScene','corridor boundary '+y);
     assert.deepEqual(await q.evaluate('[$gamePlayer.x,$gamePlayer.y]'),[4.5,24.5]);
   }
   assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'),'castle-map-qa');
   await q.evaluate('setTimeout(function(){require("nw.gui").App.quit();},100);true');console.log('PASS: corridor edge coverage; closed dedicated QA app.');return;
 }
 await q.map(62,5,25);await q.evaluate('$gameMap.event(1).start();true');
 await q.until('$gameMessage.isChoice()&&SceneManager._scene._messageWindow._choiceWindow.isOpenAndActive()','save discovery');
 await q.evaluate('SceneManager._scene._messageWindow._choiceWindow.select(1);SceneManager._scene._messageWindow._choiceWindow.processOk();true');
 await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!SceneManager._scene._sceneInfo','save clean return');await q.sleep(500);
 const report=await q.evaluate('({save:$gameVariables.value(62),last:$gamePlayer._lastSavePoint,positions:[1,2].map(id=>{var e=$gameMap.event(id);return[e.x,e.y];}),map:$gameMap.mapId(),followers:$gamePlayer.followers().isVisible(),popup:[$gameMessage._tailDir,$gameSystem._messagePopupFreeX,$gameSystem._messagePopupFreeY]})');
 assert.deepEqual(report.positions,[[5,24],[3,24]]);assert.equal(report.save,1);assert.equal(report.followers,true);
 const r=await q.call('Page.captureScreenshot',{format:'png'});const out=path.resolve(__dirname,'../../artifacts/castle-upper-events-20261118');fs.writeFileSync(path.join(out,'throne-save-note.png'),Buffer.from(r.data,'base64'));fs.writeFileSync(path.join(out,'final-placement-verification.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
 }finally{q.ws.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
