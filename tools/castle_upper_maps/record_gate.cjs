// Capture the saved gate event with native item selections and silent monitoring.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs');
const out=path.resolve(__dirname,'../..',process.env.MOVIE_DIR||'artifacts/throne-gate-movie-20261119'),work=path.join(out,'_capture');fs.mkdirSync(work,{recursive:true});
async function main(){const {q,sound}=await prepare();try{
 await q.evaluate('$gameVariables.setValue(64,2);$gameVariables.setValue(66,0);$gameParty.gainItem($dataItems[53],1);$gameParty.gainItem($dataItems[54],1);true');
 await q.map(60,25.5,16.5);await q.evaluate('__gnuroIntroQA.auto=true;__gnuroIntroQA.route(25.5,12.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','approach gate');
 for(let i=0;i<6&&!await q.evaluate('$gameMessage.isItemChoice()');i++){await q.evaluate('$gamePlayer.moveStraight(8);true');await q.sleep(200);}
 const selector=()=>q.until('$gameMessage.isItemChoice()&&SceneManager._scene._messageWindow._itemWindow.active&&SceneManager._scene._messageWindow._itemWindow.openness===255','key selection');
 await selector();await q.evaluate('__gnuroIntroQA.auto=false;true');await q.sleep(600);
 const source=path.join(work,'throne_gate_realtime.webm');
 await q.evaluate(`(function(){var stream=Graphics._canvas.captureStream(30);stream.addTrack(__beastCaptureAudio.destination.stream.getAudioTracks()[0].clone());
  var movie=window.__gateMovie={stream:stream,chunks:[],file:${JSON.stringify(source)},done:false,started:performance.now(),trace:[]};
  movie.people=function(){return [$gamePlayer].concat($gamePlayer.followers()._data.filter(function(f){return f.actor();})).map(function(ch){return {actor:ch.actor?ch.actor().actorId():2,x:ch._realX,y:ch._realY,direction:ch.direction()};});};
  var begin=KNH_CastleUpper.beginGate;KNH_CastleUpper.beginGate=function(){movie.beforePeople=movie.people();return begin.apply(this,arguments);};
  movie.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:5000000,audioBitsPerSecond:160000});
  movie.recorder.ondataavailable=function(e){if(e.data.size)movie.chunks.push(e.data);};
  movie.recorder.onstop=function(){var reader=new FileReader();reader.onload=function(){require('fs').writeFileSync(movie.file,Buffer.from(new Uint8Array(reader.result)));movie.seconds=(performance.now()-movie.started)/1000;movie.done=true;};reader.readAsArrayBuffer(new Blob(movie.chunks,{type:'video/webm'}));stream.getTracks().forEach(function(t){t.stop();});};
  var update=SceneManager.updateScene;SceneManager.updateScene=function(){var r=update.apply(this,arguments);if(Graphics.frameCount%3===0){var w=SceneManager._scene._messageWindow,item=w._itemWindow,gate=$gameMap.event(8),state=$gameTemp._castleUpperScene;movie.trace.push({time:(performance.now()-movie.started)/1000,text:$gameMessage._texts.slice(),item: item.active?{id:item.item()&&item.item().id,x:item.x,y:item.y,width:item.width}:null,gateOpening:gate._castleGateOpening,flag:$gameVariables.value(66),camera:$gamePlayer._centerXy.slice(),pcGain:__beastCaptureAudio.silentMonitor.gain.value,formation:state?{returning:!!state.returning,hero:{x:$gamePlayer._realX,y:$gamePlayer._realY,d:$gamePlayer.direction(),moving:$gamePlayer.isMoving()},members:state.members.map(function(m){var ch=$gameMap.event(m.eventId);return {actor:m.actorId,event:m.eventId,x:ch._realX,y:ch._realY,d:ch.direction(),moving:ch.isMoving()};})}:null});}return r;};
  movie.recorder.start(1000);__gnuroIntroQA.recording=true;__gnuroIntroQA.pauseMs=1800;__gnuroIntroQA.hallRouted=true;return true;
 })()`);
 await q.sleep(1800);assert.equal(await q.evaluate('SceneManager._scene._messageWindow._itemWindow.item().id'),53);
 await q.evaluate('SceneManager._scene._messageWindow._itemWindow.processOk();true');
 await selector();await q.sleep(850);
 await q.evaluate('(function(){var w=SceneManager._scene._messageWindow._itemWindow;if(w.item().id!==54){w.cursorDown(false);SoundManager.playCursor();}return true;})()');assert.equal(await q.evaluate('SceneManager._scene._messageWindow._itemWindow.item().id'),54);await q.sleep(1100);
 await q.evaluate('SceneManager._scene._messageWindow._itemWindow.processOk();true');
 await q.until('$gameVariables.value(66)===1&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','Mii and camera finish',35000);await q.sleep(900);
 await q.evaluate('__gateMovie.recorder.stop();true');await q.until('__gateMovie.done','movie write');
 const report=await q.evaluate('({seconds:__gateMovie.seconds,trace:__gateMovie.trace,messages:__gnuroIntroQA.messages,party:$gameParty._actors,camera:$gamePlayer._centerXy,keys:[$gameParty.numItems($dataItems[53]),$gameParty.numItems($dataItems[54])],flag:$gameVariables.value(66),error:__gnuroIntroQA.error,audio:{pcGain:__beastCaptureAudio.silentMonitor.gain.value,pcMuted:__beastCaptureAudio.pcOutputMuted,bgm:AudioManager._currentBgm.name}})');
 const staging=await q.evaluate('({before:__gateMovie.beforePeople,after:__gateMovie.people(),followers:$gamePlayer.followers().isVisible(),proxiesHidden:[9,10,13,14].every(function(id){return $gameMap.event(id).isTransparent();})})');
 assert.deepEqual(staging.after,staging.before);assert.equal(staging.followers,true);assert.equal(staging.proxiesHidden,true);
 assert.ok(report.trace.some(t=>t.formation&&!t.formation.returning&&(t.formation.hero.moving||t.formation.members.some(m=>m.moving))));assert.ok(report.trace.some(t=>t.formation&&t.formation.returning));
 assert.ok(report.trace.filter(t=>t.gateOpening>=0&&t.formation&&!t.formation.returning).every(t=>!t.formation.hero.moving&&t.formation.members.every(m=>!m.moving)));
 assert.ok(report.trace.some(t=>t.text[0]==='おっきな'&&t.formation&&t.formation.hero.d===4&&t.formation.members.some(m=>m.actor===4&&m.d===4)));
 assert.deepEqual(report.camera,[0,0]);assert.deepEqual(report.keys,[0,0]);assert.equal(report.flag,1);assert.equal(report.error,null);assert.ok(report.trace.every(t=>t.pcGain===0));assert.ok(report.trace.some(t=>t.item&&t.item.id===53));assert.ok(report.trace.some(t=>t.item&&t.item.id===54));assert.ok(report.trace.some(t=>t.gateOpening>0&&t.gateOpening<72));
 for(const line of ['おっきな','扉だね','この先が','王の部屋かな…','きっとそうよ','準備していきましょ','ぼくも出会ったことのない','モンスターの王…','いったいどんな人なんだろう','…'])assert.ok(report.messages.some(m=>m.text===line),'Missing dialogue: '+line);
 fs.writeFileSync(path.join(out,'recording-verification.json'),JSON.stringify({initialAudio:sound,staging,...report},null,2));console.log(JSON.stringify({source,bytes:fs.statSync(source).size,seconds:report.seconds,audio:report.audio}));
 }finally{try{if(await q.evaluate('!!(window.__gateMovie&&__gateMovie.recorder.state==="recording")')){await q.evaluate('__gateMovie.recorder.stop();true');await q.until('__gateMovie.done','recover recording');}}finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}}
main().catch(e=>{console.error(e);process.exitCode=1;});
