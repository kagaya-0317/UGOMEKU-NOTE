// Native canvas + WebAudio recording in the dedicated QA app. No desktop capture.
const {connect,sleep}=require('./qa_client.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/castle-upper-events-20261118');
const work=path.join(out,'_flow_video_work');fs.mkdirSync(work,{recursive:true});
async function main(){const q=await connect();try{
 const resume=process.argv.includes('--resume');
 if(!process.argv.includes('--inspect')&&!resume){await q.call('Page.reload');await q.until('!!window.$gameMap&&!!window.$dataTemplateEvents&&DataManager.isDatabaseLoaded()&&!!SceneManager._scene&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','fresh recording app',40000);}
 const features=await q.evaluate('({recorder:typeof MediaRecorder,capture:typeof Graphics._canvas.captureStream,audio:WebAudio._context&&WebAudio._context.state,master:!!WebAudio._masterGainNode,mime:MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus"),app:require("nw.gui").App.manifest.name})');console.log(features);assert.equal(features.app,'castle-map-qa');
 if(process.argv.includes('--inspect')){const expression='({scene:SceneManager._scene.constructor.name,stopped:SceneManager._stopped,time:WebAudio._context.currentTime,frame:Graphics.frameCount,hidden:document.hidden,body:document.body.innerText,gain:WebAudio._masterGainNode.gain.value,volume:WebAudio._masterVolume,buffers:AudioManager._seBuffers.map(b=>({url:b._url,playing:b.isPlaying(),ready:b.isReady(),duration:b._totalTime})),recording:window.__flowRecording&&{state:__flowRecording.recorder.state,chunks:__flowRecording.chunks.length,track:__flowRecording.stream.getTracks().map(t=>({kind:t.kind,state:t.readyState,enabled:t.enabled}))}})';console.log(await q.evaluate(expression));await sleep(700);console.log(await q.evaluate(expression));return;}
 if(!resume){await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(function(a){a.changeLevel(8,false);a.recoverAll();});$gamePlayer.refresh();$gameVariables.setValue(60,2);true');await q.map(55,18,10,6);
 await q.evaluate('AudioManager.playBgm({name:"00_New_Dungeon4",volume:90,pitch:100,pan:0});true');await q.until('AudioManager._bgmBuffer&&AudioManager._bgmBuffer.isReady()&&AudioManager._bgmBuffer.isPlaying()','castle audio');await sleep(400);
 }else{await q.evaluate('window.__castleFlowResume={stage:__castleFlow.stage,offset:__flowRecording.seconds,trace:__castleFlow.trace,choices:__castleFlow.choices};true');fs.renameSync(path.join(work,'castle-flow.webm'),path.join(work,'castle-flow-part1.webm'));}
 const file=path.join(work,process.argv.includes('--probe')?'probe.webm':resume?'castle-flow-part2.webm':'castle-flow.webm');
 await q.evaluate(`(function(){var stream=Graphics._canvas.captureStream(30),dest=WebAudio._context.createMediaStreamDestination();WebAudio._masterGainNode.connect(dest);stream.addTrack(dest.stream.getAudioTracks()[0]);var r=window.__flowRecording={chunks:[],file:${JSON.stringify(file)},stream:stream,audio:dest,started:performance.now(),done:false};r.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:4500000,audioBitsPerSecond:160000});r.recorder.ondataavailable=function(e){if(e.data.size)r.chunks.push(e.data);};r.recorder.onstop=function(){var reader=new FileReader();reader.onload=function(){require('fs').writeFileSync(r.file,Buffer.from(new Uint8Array(reader.result)));r.done=true;r.seconds=(performance.now()-r.started)/1000;};reader.readAsArrayBuffer(new Blob(r.chunks,{type:'video/webm'}));WebAudio._masterGainNode.disconnect(dest);};r.recorder.start(1000);return {state:r.recorder.state,tracks:stream.getTracks().map(t=>t.kind)};})()`);
 if(process.argv.includes('--probe')){await q.evaluate('AudioManager.playSe({name:"Cursor1",volume:90,pitch:100,pan:0});true');await sleep(3000);await q.evaluate('__flowRecording.recorder.stop();true');await q.until('__flowRecording.done','probe write');console.log(await q.evaluate('({file:__flowRecording.file,seconds:__flowRecording.seconds})'));return;}
 console.log(await q.evaluate(fs.readFileSync(path.join(__dirname,'flow_driver.js'),'utf8')));
 let lastStage=-1,finished=false;
 for(let i=0;i<1200;i++){
  const state=await q.evaluate('__castleFlow.status()');
  if(state.stage!==lastStage||i%20===0){console.log(JSON.stringify(state));lastStage=state.stage;}
  if(state.error)throw Error(state.error);
  if(state.done){finished=true;break;}
  await sleep(1000);
 }
 assert.ok(finished,'Recording flow timeout');
 await q.evaluate('__flowRecording.recorder.stop();true');await q.until('__flowRecording.done','recording write');
 const report=await q.evaluate('({seconds:__flowRecording.seconds,trace:__castleFlow.trace,status:__castleFlow.status(),party:$gameParty.members().map(a=>({id:a.actorId(),level:a.level})),choices:__castleFlow.choices})');
 if(resume){report.part1Seconds=await q.evaluate('__castleFlowResume.offset');report.part2Seconds=report.seconds;report.seconds+=report.part1Seconds;report.join='Same map state; recorder wait removed at throne entrance';}
 fs.writeFileSync(path.join(out,'video-verification.json'),JSON.stringify(report,null,2)+'\n');
 const ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe'),output=path.join(out,'castle_upper_floor_flow.mp4');
 const inputs=resume?['-i',path.join(work,'castle-flow-part1.webm'),'-i',file,'-filter_complex','[0:v]setpts=PTS-STARTPTS[v0];[0:a]asetpts=PTS-STARTPTS[a0];[1:v]setpts=PTS-STARTPTS[v1];[1:a]asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a];[v]fps=30[video]','-map','[video]','-map','[a]']:['-i',file,'-vf','fps=30'];
 const r=spawnSync(ffmpeg,['-hide_banner','-y',...inputs,'-c:v','libx264','-preset','fast','-crf','19','-c:a','aac','-b:a','160k','-movflags','+faststart',output],{encoding:'utf8',maxBuffer:5e6});
 fs.writeFileSync(path.join(work,'encode.log'),r.stderr);assert.equal(r.status,0,r.stderr);console.log(JSON.stringify({output,bytes:fs.statSync(output).size,seconds:report.seconds}));
 }finally{try{if(await q.evaluate('!!(window.__flowRecording&&__flowRecording.recorder.state==="recording")')){await q.evaluate('__flowRecording.recorder.stop();true');await q.until('__flowRecording.done','partial recording write');}}finally{q.ws.close();}}}
main().catch(e=>{console.error(e);process.exitCode=1;});
