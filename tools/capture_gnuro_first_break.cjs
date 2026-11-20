// Capture the saved first-break event in a dedicated NW.js QA process.
// Fades are applied by FFmpeg after capture; game rendering stays untouched.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawn, spawnSync} = require('node:child_process');
const {once} = require('node:events');
const root = path.resolve(__dirname, '..');
const take = (process.argv.find(arg=>arg.startsWith('--take='))||'--take=post-20261118').slice(7);
assert.match(take,/^[a-z0-9-]+$/);
const out = path.join(root, 'artifacts/gnuro-first-break-'+take);
const work = path.join(out, '_capture');
const ffmpeg = path.join(root, 'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe');
const output = path.join(out, 'gnuro_first_break.mp4');
fs.mkdirSync(work, {recursive:true});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect() {
    const pages = await (await fetch('http://127.0.0.1:9341/json')).json();
    const page = pages.find(p => /tools\/yume_skill_preview\/index.html$/.test(p.url));
    assert.ok(page, 'Use the dedicated battle-preview process on port 9341');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await once(ws, 'open');
    const pending = new Map();
    let serial = 0;
    ws.addEventListener('message', event => {
        const message = JSON.parse(event.data), item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id);
        if (message.error) item.reject(new Error(JSON.stringify(message.error)));
        else item.resolve(message.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++serial;
        pending.set(id, {resolve, reject});
        ws.send(JSON.stringify({id, method, params}));
    });
    return {call, close:()=>ws.close(), async evaluate(expression) {
        const result = await call('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    }};
}

function audio(report) {
    const rate = 44100, samples = Math.ceil(report.seconds * rate);
    const mix = new Float32Array(samples * 2), cache = new Map();
    function decode(file, pitch = 100) {
        const key = file + ':' + pitch;
        if (cache.has(key)) return cache.get(key);
        const args = ['-hide_banner','-loglevel','error','-i',file];
        if (pitch !== 100) args.push('-af', 'asetrate=' + Math.round(rate*pitch/100) + ',aresample=' + rate);
        args.push('-f','f32le','-ac','2','-ar',String(rate),'pipe:1');
        const result = spawnSync(ffmpeg, args, {maxBuffer:100e6});
        assert.equal(result.status, 0, result.stderr.toString());
        const sound = new Float32Array(result.stdout.buffer.slice(result.stdout.byteOffset, result.stdout.byteOffset + result.stdout.length));
        cache.set(key, sound);
        return sound;
    }
    const bgm = decode(path.join(root, 'audio/bgm', report.bgm.name + '.ogg'), report.bgm.pitch);
    const loopStart = Math.round(report.bgm.loopStart * rate) * 2;
    const loopLength = Math.round(report.bgm.loopLength * rate) * 2;
    const offset = Math.round(report.firstFrame / 60 * rate) * 2;
    const bgmGain = report.bgm.volume / 100 * report.bgmVolume / 100 * report.master;
    for (let i = 0; i < mix.length; i++) {
        const clock = i + offset;
        const at = clock < bgm.length ? clock : loopStart + (clock - loopStart) % loopLength;
        mix[i] = (bgm[at] || 0) * bgmGain;
    }
    for (const se of report.sounds) {
        const sound = decode(path.join(root, 'audio/se', se.name + '.ogg'), se.pitch || 100);
        const start = Math.round((se.frame - report.firstFrame) / 60 * rate) * 2;
        const gain = se.volume / 100 * report.seVolume / 100 * report.master;
        for (let i = Math.max(0, -start); i < sound.length && start + i < mix.length; i++) {
            mix[start + i] += sound[i] * gain;
        }
    }
    let peak = 0;
    for (const value of mix) peak = Math.max(peak, Math.abs(value));
    const gain = peak > 0.98 ? 0.98 / peak : 1;
    const wave = Buffer.alloc(44 + samples * 4);
    wave.write('RIFF',0); wave.writeUInt32LE(wave.length-8,4); wave.write('WAVEfmt ',8);
    wave.writeUInt32LE(16,16); wave.writeUInt16LE(1,20); wave.writeUInt16LE(2,22);
    wave.writeUInt32LE(rate,24); wave.writeUInt32LE(rate*4,28); wave.writeUInt16LE(4,32); wave.writeUInt16LE(16,34);
    wave.write('data',36); wave.writeUInt32LE(samples*4,40);
    for (let i = 0; i < mix.length; i++) wave.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix[i]*gain))*32767),44+i*2);
    const file = path.join(work, 'game-audio.wav');
    fs.writeFileSync(file, wave);
    return file;
}

async function main() {
    const cdp = await connect();
    try {
        await cdp.call('Page.reload');
        let ready = false;
        for (let attempt = 0; attempt < 150; attempt++) {
            ready = await cdp.evaluate('!!window.KNH_ZXC_Battle_Gnuro && !!window.$dataSkills && !!SceneManager._sceneStarted && !SceneManager._nextScene');
            if (ready) break;
            await sleep(100);
        }
        assert.ok(ready, 'Preview startup');
        let source = fs.readFileSync(path.join(__dirname,'gnuro_battle_preview/runtime.js'),'utf8');
        assert.ok(source.includes('q.holdMessage>=105'));
        source = source.replace('q.holdMessage>=105', 'q.frame-(q.messages.length?q.messages[q.messages.length-1].frame:q.frame)>=108');
        console.log('Prepared', JSON.stringify(await cdp.evaluate(source)));
        await cdp.evaluate(`(function(){
            var q=__gnuroQA,p=$dataTroops[43].pages.find(function(p){return p.conditions.enemyValid&&p.conditions.enemyHp===75;});
            var texts=p.list.filter(function(c){return c.code===401;}).map(function(c){return c.parameters[0];});
            q.clipFirstText=texts[0];q.clipReactionText=texts[5];q.clipReadability=[];
            // Use the message-speed plugin's actual setting for this capture only.
            q.scene._messageWindow.getMessageSpeed=function(){return 1;};
            // Asset-load waits can let WebGL clear its back buffer. Render and
            // read it in the same synchronous call, after those waits finish.
            q.capture=function(){Graphics._renderer.render(q.scene);return Graphics._canvas.toDataURL('image/jpeg',0.98).split(',')[1];};
            return {first:q.clipFirstText,reaction:q.clipReactionText};
        })()`);
        const preroll = await cdp.evaluate(`(async function(){
            var q=__gnuroQA;
            for(var i=0;i<2500;i++){
                var state=q.step(2);
                if(state.turn>=1&&!state.running&&state.flags.indexOf('0')>=0)return state;
                if(i%20===0)await new Promise(function(r){setTimeout(r,10);});
                while(!ImageManager.isReady())await new Promise(function(r){setTimeout(r,30);});
            }
            throw new Error('Did not finish the opening');
        })()`);
        console.log('Pre-roll',JSON.stringify(preroll));

        const silent = path.join(work,'game-silent.mp4');
        const encoder = spawn(ffmpeg,['-hide_banner','-y','-f','image2pipe','-framerate','30','-i','pipe:0',
            '-an','-c:v','libx264','-crf','16','-preset','fast','-pix_fmt','yuv420p',silent], {stdio:['pipe','ignore','pipe']});
        let log = '';
        encoder.stderr.on('data',chunk=>log+=chunk);
        encoder.stdin.on('error',()=>{});
        const done = new Promise((resolve,reject)=>{
            encoder.on('error',reject);
            encoder.on('close',code=>code?reject(new Error(log)):resolve());
        });
        done.catch(()=>{});
        async function write(data) {
            if(!encoder.stdin.write(Buffer.from(data,'base64'))) await Promise.race([once(encoder.stdin,'drain'),done]);
        }
        const ring = [];
        let started = false, firstFrame, frames = 0, reactionFrame, lastFrame, fadeOutStart;
        for(let i=0;i<3000;i++) {
            const shot = await cdp.evaluate(`(async function(){
                var q=__gnuroQA,state=q.step(2);
                while(!ImageManager.isReady())await new Promise(function(r){setTimeout(r,30);});
                var first=q.messages.find(function(m){return m.text===q.clipFirstText;});
                var reaction=q.messages.find(function(m){return m.text===q.clipReactionText;});
                if(q.scene._messageWindow.pause&&q.messages.length){
                    var last=q.messages[q.messages.length-1];
                    if(!q.clipReadability.some(function(r){return r.started===last.frame;}))
                        q.clipReadability.push({started:last.frame,complete:q.frame,text:$gameMessage._texts.slice()});
                }
                if(reaction)q.autoAdvance=false;
                return {state:state,first:first&&first.frame,reaction:reaction&&reaction.frame,png:q.capture()};
            })()`);
            lastFrame = shot.state.frame;
            if (!started) {
                ring.push({frame:lastFrame,png:shot.png});
                if(ring.length>25)ring.shift();
                if(shot.first===undefined)continue;
                started=true;
                firstFrame=ring[0].frame;
                for(const item of ring){await write(item.png);frames++;}
                console.log('Recording',JSON.stringify({firstFrame,messageFrame:shot.first}));
            } else {await write(shot.png);frames++;}
            if(shot.reaction!==undefined) {
                reactionFrame=shot.reaction;
                fadeOutStart=(reactionFrame+36-firstFrame)/60;
                if(lastFrame>=reactionFrame+108)break;
            }
            if(frames%90===0)console.log(JSON.stringify({frames,seconds:frames/30,state:shot.state}));
            if(i===2999)throw new Error('First-break event did not complete');
        }
        encoder.stdin.end();
        await done;
        assert.ok(started && reactionFrame!==undefined, 'First-break and reaction both captured');
        fs.writeFileSync(path.join(work,'encode.log'),log);
        const seconds=frames/30;
        const report=await cdp.evaluate(`({firstFrame:${firstFrame},lastFrame:${lastFrame},frames:${frames},seconds:${seconds},
            fadeIn:0.6,fadeOutStart:${fadeOutStart},fadeOutDuration:1.2,dialogueSeconds:1.8,
            messages:__gnuroQA.messages,readability:__gnuroQA.clipReadability,sounds:__gnuroQA.sounds,barChanges:__gnuroQA.barChanges,
            jumps:__gnuroQA.jumps,breakPoses:__gnuroQA.breakPoses,guards:__gnuroQA.guards,hits:__gnuroQA.hits,
            state:__gnuroQA.status(),bgm:Object.assign({},AudioManager._currentBgm,{loopStart:AudioManager._bgmBuffer._loopStart,
            loopLength:AudioManager._bgmBuffer._loopLength}),bgmVolume:AudioManager.bgmVolume,
            seVolume:AudioManager.seVolume,master:WebAudio._masterVolume})`);
        fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
        assert.equal(report.state.allyAttacksDisabled,false);
        assert.equal(report.state.bossScale,2);
        assert.equal(report.barChanges.filter(e=>e.kind==='breakGnuroBar').length,1);
        const visible=report.readability.filter(r=>r.started>=firstFrame);
        assert.equal(visible.length,3,'Two boss popups and the companion reaction');
        assert.ok(visible.every(r=>r.complete-r.started<=45),'All text completes within 0.75 s');
        const sound=audio(report);
        const color='black';
        const vf=`fade=t=in:st=0:d=0.6:color=${color},fade=t=out:st=${fadeOutStart}:d=1.2:color=${color},tpad=stop_mode=clone:stop_duration=0.1`;
        const af=`afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.2,apad=pad_dur=0.1`;
        const mux=spawnSync(ffmpeg,['-hide_banner','-y','-i',silent,'-i',sound,'-vf',vf,'-af',af,
            '-c:v','libx264','-crf','18','-preset','slow','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
            '-t',String(seconds+0.1),'-movflags','+faststart',output],{encoding:'utf8',maxBuffer:5e6});
        fs.writeFileSync(path.join(work,'mux.log'),mux.stderr);
        assert.equal(mux.status,0,mux.stderr);
        console.log('Completed',JSON.stringify({output,seconds:seconds+0.1,fadeOutStart,bytes:fs.statSync(output).size}));
    } finally {cdp.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
