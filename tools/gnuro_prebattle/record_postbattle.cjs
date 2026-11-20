// Native victory continuation; the QA-only forced win is outside this clip.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {connect}=require('./client.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/gnuro-postbattle-20261119'),work=path.join(out,'_capture');fs.mkdirSync(work,{recursive:true});
async function main(){const q=await connect();try{
    await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(function(a){a.changeLevel(10,false);a.recoverAll();});$gamePlayer.refresh();$gameSwitches.setValue(17,false);$gameVariables.setValue(60,0);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    await q.evaluate('(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(!$gameParty.inBattle()&&$gameMap.mapId()===54&&$gameVariables.value(60)===2)__gnuroIntroQA.auto=false;return add.apply(this,arguments);};__gnuroIntroQA.auto=true;return true;})()');
    await q.map(54,10,22.5,8);await q.evaluate('__gnuroIntroQA.route(10,18.5);true');
    await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!!SceneManager._scene._gnuro','native battle',45000);
    await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');
    await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(60)===2&&$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause','postbattle scene',90000);
    await q.until('AudioManager._bgmBuffer&&AudioManager._bgmBuffer.isReady()&&AudioManager._bgmBuffer.isPlaying()','map BGM');
    const webm=path.join(work,'gnuro_postbattle.webm');
    await q.evaluate(`(async function(){
        if(WebAudio._context.state!=='running')await WebAudio._context.resume();
        var stream=Graphics._canvas.captureStream(30),dest=WebAudio._context.createMediaStreamDestination();WebAudio._masterGainNode.connect(dest);stream.addTrack(dest.stream.getAudioTracks()[0]);
        var r=window.__gnuroMovie={file:${JSON.stringify(webm)},stream:stream,dest:dest,chunks:[],started:performance.now(),done:false};
        r.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:5000000,audioBitsPerSecond:160000});
        r.recorder.ondataavailable=function(e){if(e.data.size)r.chunks.push(e.data);};
        r.recorder.onstop=function(){var reader=new FileReader();reader.onload=function(){require('fs').writeFileSync(r.file,Buffer.from(new Uint8Array(reader.result)));r.seconds=(performance.now()-r.started)/1000;r.done=true;};reader.readAsArrayBuffer(new Blob(r.chunks,{type:'video/webm'}));WebAudio._masterGainNode.disconnect(dest);r.stream.getTracks().forEach(function(t){t.stop();});};
        r.recorder.start(1000);__gnuroIntroQA.recording=true;__gnuroIntroQA.pauseMs=1800;__gnuroIntroQA.pauseAt=0;__gnuroIntroQA.hallRouted=true;return true;
    })()`);
    const shots=new Set();
    while(await q.evaluate('$gameMap.isEventRunning()')){
        const s=await q.evaluate('({text:$gameMessage._texts[0],pause:SceneManager._scene._messageWindow.pause,error:__gnuroIntroQA.error})');if(s.error)throw Error(s.error);
        const n=['なんとか倒せたね…','ええ、毎朝欠かさず','足の話！？'].indexOf(s.text)+1;
        if(n&&s.pause&&!shots.has(n)){await q.sleep(120);const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'gnuro_postbattle_'+n+'.png'),Buffer.from(png,'base64'));shots.add(n);console.log('Captured line '+n);}
        await q.sleep(120);
    }
    assert.equal(shots.size,3);await q.evaluate('__gnuroIntroQA.route(10,17.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','resumed following');await q.sleep(800);
    const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'gnuro_postbattle_return.png'),Buffer.from(png,'base64'));
    await q.evaluate('__gnuroMovie.recorder.stop();true');await q.until('__gnuroMovie.done','movie write');
    const report=await q.evaluate('({seconds:__gnuroMovie.seconds,party:$gameParty._actors,messages:__gnuroIntroQA.messages.filter(m=>!m.battle),camera:$gamePlayer._centerXy,followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y})),temp:!!$gameTemp._castleUpperScene,error:__gnuroIntroQA.error})');assert.equal(report.temp,false);assert.equal(report.error,null);assert.deepEqual(report.camera,[0,0]);
    fs.writeFileSync(path.join(out,'video-verification.json'),JSON.stringify({forcedVictoryBeforeClip:true,...report},null,2));
    const ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe'),output=path.join(out,'gnuro_postbattle.mp4'),fade=Math.max(0,report.seconds-.8);
    const r=spawnSync(ffmpeg,['-hide_banner','-y','-i',webm,'-vf',`fps=30,tpad=stop_mode=clone:stop_duration=0.5,fade=t=in:st=0:d=0.4:color=black,fade=t=out:st=${fade}:d=0.8:color=black`,'-af',`apad=pad_dur=0.5,afade=t=in:st=0:d=0.4,afade=t=out:st=${fade}:d=0.8`,'-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',String(report.seconds+.2),'-movflags','+faststart',output],{encoding:'utf8',maxBuffer:4e6});fs.writeFileSync(path.join(work,'encode.log'),r.stderr);assert.equal(r.status,0,r.stderr);console.log(JSON.stringify({output,seconds:report.seconds+.2,bytes:fs.statSync(output).size}));
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
