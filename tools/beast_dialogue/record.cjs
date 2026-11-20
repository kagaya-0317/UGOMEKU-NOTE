// Record the native pre/battle/post encounter, with audio routed only to capture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');const {prepare}=require('./capture_client.cjs');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.BEAST_MOVIE_DIR||'artifacts/beast-conversation-movie-20261119'),work=path.join(out,'_capture');fs.mkdirSync(work,{recursive:true});
async function main(){const {q,sound}=await prepare();try{
 const webm=path.join(work,'beast_conversation_realtime.webm');
 await q.evaluate(`(function(){
  var stream=Graphics._canvas.captureStream(30);stream.addTrack(__beastCaptureAudio.destination.stream.getAudioTracks()[0].clone());
  var r=window.__beastMovie={file:${JSON.stringify(webm)},stream:stream,chunks:[],started:performance.now(),trace:[],done:false};
  r.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:5000000,audioBitsPerSecond:160000});
  r.recorder.ondataavailable=function(e){if(e.data.size)r.chunks.push(e.data);};
  r.recorder.onstop=function(){var reader=new FileReader();reader.onload=function(){require('fs').writeFileSync(r.file,Buffer.from(new Uint8Array(reader.result)));r.seconds=(performance.now()-r.started)/1000;r.done=true;};reader.readAsArrayBuffer(new Blob(r.chunks,{type:'video/webm'}));stream.getTracks().forEach(function(t){t.stop();});};
  var update=SceneManager.updateScene;SceneManager.updateScene=function(){var result=update.apply(this,arguments);
   if(Graphics.frameCount%6===0){var scene=SceneManager._scene,w=scene&&scene._messageWindow,state=$gameTemp._castleUpperScene,guest=scene&&scene._castleGuestSprite;
    var beast=$gameMap.mapId()===60&&$gameMap.event(2);
    r.trace.push({time:(performance.now()-r.started)/1000,scene:scene.constructor.name,text:$gameMessage._texts.slice(),brightness:$gameScreen.brightness(),camera:$gamePlayer._centerXy.slice(),event:$gameMap.isEventRunning(),forming:!!state,returning:!!(state&&state.returning),guest:guest?{x:guest._homeX,y:guest._homeY,scale:guest.scale.x}:null,beast:beast?{x:beast._realX,y:beast._realY}:null,popup:$gameMessage.isBusy()&&w?{x:w.x,y:w.y,w:w.width,h:w.height,tone:$gameVariables.value(14)}:null});}
   return result;};
  r.recorder.start(1000);__gnuroIntroQA.recording=true;__gnuroIntroQA.pauseMs=1800;__gnuroIntroQA.pauseAt=0;__gnuroIntroQA.hallRouted=true;$gamePlayer.moveStraight(8);return true;
 })()`);
 let complete=false,last='';
 for(let i=0;i<400;i++){
  const state=await q.evaluate('({scene:SceneManager._scene.constructor.name,text:$gameMessage._texts,flag:$gameVariables.value(64),event:$gameMap.isEventRunning(),busy:$gameMessage.isBusy(),staged:!!$gameTemp._castleUpperScene,error:__gnuroIntroQA.error})');if(state.error)throw Error(state.error);
  const phase=state.scene+':'+state.text.join('|');if(phase!==last){console.log(JSON.stringify(state));last=phase;}
  if(state.scene==='Scene_Map'&&state.flag===2&&!state.event&&!state.busy&&!state.staged){complete=true;break;}
  await q.sleep(300);
 }
 assert.ok(complete,'Encounter did not finish');
 await q.evaluate('__gnuroIntroQA.route(5.5,12.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','normal walking past the beast');await q.sleep(900);
 await q.evaluate('__beastMovie.recorder.stop();true');await q.until('__beastMovie.done','movie write');
 const report=await q.evaluate('({seconds:__beastMovie.seconds,messages:__gnuroIntroQA.messages,trace:__beastMovie.trace,party:$gameParty._actors.slice(),camera:$gamePlayer._centerXy,shown:$gamePlayer.followers().isVisible(),beastPosition:[$gameMap.event(2).x,$gameMap.event(2).y],chest:$gameMap.event(5)._pageIndex,error:__gnuroIntroQA.error,audio:{pcOutputMuted:__beastCaptureAudio.pcOutputMuted,speakerGain:__beastCaptureAudio.silentMonitor.gain.value,blockedSpeakerConnections:__beastCaptureAudio.blockedSpeakerConnections,bgm:AudioManager._currentBgm.name}})');
 assert.deepEqual(report.party,[2,3,4]);assert.deepEqual(report.camera,[0,0]);assert.equal(report.shown,true);assert.equal(report.chest,1);assert.equal(report.error,null);assert.equal(report.audio.pcOutputMuted,true);assert.equal(report.audio.speakerGain,0);
 assert.deepEqual(report.beastPosition,[2.5,14]);assert.equal(report.messages.filter(m=>m.battle).length,6);assert.ok(report.trace.some(t=>t.returning));assert.ok(report.trace.some(t=>t.beast&&t.beast.x>2.5&&t.beast.x<5));assert.ok(report.trace.filter(t=>t.guest).every(t=>t.guest.x===64&&t.guest.y===372&&t.guest.scale===1.2));
 fs.writeFileSync(path.join(out,'video-verification.json'),JSON.stringify({forcedVictory:false,initialSound:sound,...report},null,2));
 console.log(JSON.stringify({source:webm,bytes:fs.statSync(webm).size,wallSeconds:report.seconds}));
}finally{
 try{if(await q.evaluate('!!(window.__beastMovie&&__beastMovie.recorder.state==="recording")')){await q.evaluate('__beastMovie.recorder.stop();true');await q.until('__beastMovie.done','recover partial recording');}}finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}
}}
main().catch(e=>{console.error(e);process.exitCode=1;});
