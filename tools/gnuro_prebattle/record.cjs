// Reuse native canvas/WebAudio recording, as in castle_upper_maps/record_flow.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {connect}=require('./client.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/gnuro-prebattle-20261119'),work=path.join(out,'_capture');
fs.mkdirSync(work,{recursive:true});
async function main(){const q=await connect();try{
    await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(function(a){a.changeLevel(10,false);a.recoverAll();});$gamePlayer.refresh();$gameSwitches.setValue(17,false);$gameVariables.setValue(60,0);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    await q.map(52,38,24.5,6);
    await q.evaluate('__gnuroIntroQA.route(39,25.5);true');
    await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','walk to the 2F door');
    for(let i=0;i<12;i++){if(await q.evaluate('$gameMap.mapId()===54'))break;await q.evaluate('if(!$gamePlayer.isMoving()&&!$gameMap.isEventRunning())$gamePlayer.moveStraight(6);true');await q.sleep(300);}
    await q.until('$gameMap.mapId()===54&&SceneManager._scene instanceof Scene_Map&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&ImageManager.isReady()','normal walking entry from 2F',30000);
    await q.evaluate('__gnuroIntroQA.walking=false;__gnuroIntroQA.path=[];true');
    await q.until('!$gamePlayer.isMoving()&&$gameScreen.brightness()===255','entry fade complete');
    await q.until('AudioManager._bgmBuffer&&AudioManager._bgmBuffer.isReady()&&AudioManager._bgmBuffer.isPlaying()','native map BGM');
    const webm=path.join(work,'gnuro_prebattle.webm');
    const features=await q.evaluate(`(async function(){
        if(WebAudio._context.state!=='running')await WebAudio._context.resume();
        var stream=Graphics._canvas.captureStream(30),dest=WebAudio._context.createMediaStreamDestination();
        WebAudio._masterGainNode.connect(dest);stream.addTrack(dest.stream.getAudioTracks()[0]);
        var r=window.__gnuroMovie={file:${JSON.stringify(webm)},stream:stream,dest:dest,chunks:[],started:performance.now(),done:false};
        r.recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:5000000,audioBitsPerSecond:160000});
        r.recorder.ondataavailable=function(e){if(e.data.size)r.chunks.push(e.data);};
        r.recorder.onstop=function(){var reader=new FileReader();reader.onload=function(){require('fs').writeFileSync(r.file,Buffer.from(new Uint8Array(reader.result)));r.seconds=(performance.now()-r.started)/1000;r.done=true;};reader.readAsArrayBuffer(new Blob(r.chunks,{type:'video/webm'}));WebAudio._masterGainNode.disconnect(dest);r.stream.getTracks().forEach(function(t){t.stop();});};
        r.recorder.start(1000);__gnuroIntroQA.recording=true;__gnuroIntroQA.hallRouted=false;
        var apply=Scene_NewBattle.prototype.applyDamage;
        Scene_NewBattle.prototype.applyDamage=function(subject,target,skillId){__gnuroIntroQA.hits=__gnuroIntroQA.hits||[];__gnuroIntroQA.hits.push({actor:subject.isActor(),skill:skillId,time:performance.now()});return apply.apply(this,arguments);};
        return {tracks:stream.getTracks().map(t=>t.kind),audio:WebAudio._context.state};
    })()`);
    console.log('Recording',features);
    let finished=false,battleAt=0,last='';
    for(let i=0;i<300;i++){
        const state=await q.evaluate('({scene:SceneManager._scene.constructor.name,map:$gameMap.mapId(),flag:$gameVariables.value(60),text:$gameMessage._texts,error:__gnuroIntroQA.error,allyHits:(__gnuroIntroQA.hits||[]).filter(h=>h.actor).length,battle:$gameParty.inBattle(),started:SceneManager._sceneStarted,next:!!SceneManager._nextScene})');
        if(state.error)throw Error(state.error);
        const phase=state.scene+':'+state.text.join('|');if(phase!==last){console.log(JSON.stringify(state));last=phase;}
        if(state.scene==='Scene_NewBattle'&&state.started&&!state.next){if(!battleAt)battleAt=Date.now();if(Date.now()-battleAt>6000&&state.allyHits>0){finished=true;break;}}
        await q.sleep(500);
    }
    assert.ok(finished,'Movie did not reach ordinary party attacks');
    await q.evaluate('__gnuroMovie.recorder.stop();true');await q.until('__gnuroMovie.done','video write',20000);
    const report=await q.evaluate('({seconds:__gnuroMovie.seconds,messages:__gnuroIntroQA.messages,trace:__gnuroIntroQA.trace.filter((t,i)=>i%6===0),hits:__gnuroIntroQA.hits,party:$gameParty._actors,scale:SceneManager._scene._enemySprites[0].scale.x,attacksDisabled:$gameSwitches.value(17),troop:$gameTroop._troopId,flag:$gameVariables.value(60)})');
    assert.equal(report.troop,43);assert.equal(report.scale,2);assert.equal(report.attacksDisabled,false);
    assert.ok(!report.messages.some(m=>m.battle&&m.text.indexOf('ワシの名は')>=0));
    fs.writeFileSync(path.join(out,'video-verification.json'),JSON.stringify(report,null,2));
    const output=path.join(out,'gnuro_prebattle.mp4'),ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe'),fade=Math.max(0,report.seconds-0.8);
    const result=spawnSync(ffmpeg,['-hide_banner','-y','-i',webm,'-vf',`fps=30,tpad=stop_mode=clone:stop_duration=0.6,fade=t=in:st=0:d=0.5:color=black,fade=t=out:st=${fade}:d=0.8:color=black`,'-af',`apad=pad_dur=0.6,afade=t=in:st=0:d=0.5,afade=t=out:st=${fade}:d=0.8`,'-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',String(report.seconds+0.15),'-movflags','+faststart',output],{encoding:'utf8',maxBuffer:4e6});
    fs.writeFileSync(path.join(work,'encode.log'),result.stderr);assert.equal(result.status,0,result.stderr);
    console.log('Completed',JSON.stringify({output,bytes:fs.statSync(output).size,seconds:report.seconds+0.15}));
}finally{
    try{if(await q.evaluate('!!(window.__gnuroMovie&&__gnuroMovie.recorder.state===\'recording\')')){await q.evaluate('__gnuroMovie.recorder.stop();true');await q.until('__gnuroMovie.done','partial movie write',20000);}}finally{q.ws.close();}
}}
main().catch(e=>{console.error(e);process.exitCode=1;});
