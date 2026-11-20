// Dedicated NW.js/CDP battle QA. Never connects to the user's normal playtest.
const fs = require('node:fs');
const path = require('node:path');
const {spawn,spawnSync} = require('node:child_process');
const {once} = require('node:events');
const root = path.resolve(__dirname, '..');
const take=(process.argv.find(arg=>arg.startsWith('--take='))||'--take=').slice(7);
if(take&&!/^[a-z0-9-]+$/.test(take))throw new Error('Invalid take name');
const openingOnly=process.argv.includes('--opening-only');
const finalOnly=process.argv.includes('--final-only');
const outputDir = path.join(root, 'artifacts', take?'gnuro-'+take:'gnuro-battle-revision');
const work = path.join(outputDir, '_capture');
fs.mkdirSync(work, {recursive:true});
const ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe');
async function fresh(cdp) {
    await cdp.call('Page.reload');
    for(let attempt=0;attempt<100;attempt++) {
        const ready=await cdp.evaluate('!!window.KNH_ZXC_Battle_Gnuro && !!window.$dataSkills && !!SceneManager._sceneStarted && !SceneManager._nextScene');
        if(ready)return cdp.evaluate(fs.readFileSync(path.join(__dirname,'gnuro_battle_preview/runtime.js'),'utf8'));
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Fresh QA process did not finish loading');
}
function mixAudio(report) {
    const rate=44100,samples=Math.ceil(report.frames/60*rate),mix=new Float32Array(samples*2),cache=new Map();
    const firstFrame=report.firstFrame||0,offset=Math.round(firstFrame/60*rate)*2;
    function decode(file,pitch=100) {
        const key=file+':'+pitch;
        if(cache.has(key))return cache.get(key);
        const args=['-hide_banner','-loglevel','error','-i',file];
        if(pitch!==100)args.push('-af','asetrate='+Math.round(rate*pitch/100)+',aresample='+rate);
        args.push('-f','f32le','-ac','2','-ar',String(rate),'pipe:1');
        const result=spawnSync(ffmpeg,args,{maxBuffer:100e6});
        if(result.status!==0)throw new Error(result.stderr.toString());
        const out=new Float32Array(result.stdout.buffer.slice(result.stdout.byteOffset,result.stdout.byteOffset+result.stdout.length));
        cache.set(key,out);return out;
    }
    const bgm=decode(path.join(root,'audio/bgm/00_New_Battle2.ogg'));
    const loopStart=Math.round((report.bgm.loopStart||0)*rate)*2;
    const loopLength=Math.round((report.bgm.loopLength||bgm.length/2/rate)*rate)*2;
    for(let i=0;i<mix.length;i++) {
        const clock=i+offset;
        const at=clock<bgm.length?clock:loopStart+(clock-loopStart)%Math.max(2,loopLength);
        mix[i]=(bgm[at]||0)*0.38;
    }
    for(const event of report.sounds) {
        const file=path.join(root,'audio/se',event.name+'.ogg');
        if(!fs.existsSync(file))throw new Error('Missing recorded SE: '+event.name);
        const sound=decode(file,event.pitch||100),start=Math.round((event.frame-firstFrame)/60*rate)*2;
        const gain=event.volume/100*0.66;
        for(let i=Math.max(0,-start);i<sound.length&&start+i<mix.length;i++)mix[start+i]+=sound[i]*gain;
    }
    let peak=0;for(const value of mix)peak=Math.max(peak,Math.abs(value));
    const gain=peak>0.96?0.96/peak:1;
    const wave=Buffer.alloc(44+samples*4);
    wave.write('RIFF',0);wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);
    wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(2,22);
    wave.writeUInt32LE(rate,24);wave.writeUInt32LE(rate*4,28);wave.writeUInt16LE(4,32);wave.writeUInt16LE(16,34);
    wave.write('data',36);wave.writeUInt32LE(samples*4,40);
    for(let i=0;i<mix.length;i++)wave.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix[i]*gain))*32767),44+i*2);
    const file=path.join(work,'showcase-audio.wav');fs.writeFileSync(file,wave);return file;
}
async function record(cdp) {
    let initial=await fresh(cdp);
    if(finalOnly)initial=await cdp.evaluate(`(async function(){
        for(var i=0;i<20000;i++){
            var s=__gnuroQA.status();
            if(s.phase===3&&s.turn-s.since>=2&&!s.running)return s;
            __gnuroQA.step(12);
            // Let animation sheets load during pre-roll, as they do in normal play.
            // Otherwise old animations release their queued SE on the first filmed frame.
            if(i%8===0)await new Promise(function(resolve){setTimeout(resolve,10);});
            while(!ImageManager.isReady())await new Promise(function(resolve){setTimeout(resolve,50);});
        }
        throw new Error('Did not reach the real pre-25% battle round');
    })()`);
    console.log(JSON.stringify(initial));
    const silent=path.join(work,'showcase-silent.mp4');
    const encoder=spawn(ffmpeg,['-hide_banner','-y','-f','image2pipe','-framerate','20','-i','pipe:0',
        '-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',silent],{stdio:['pipe','ignore','pipe']});
    let log='';encoder.stderr.on('data',data=>log+=data);encoder.stdin.on('error',()=>{});
    const done=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code?reject(new Error(log)):resolve());});
    done.catch(()=>{});
    let frames=0;
    for(let index=0;index<4000;index++) {
        const shot=await cdp.evaluate(`(function(){var state=__gnuroQA.step(3);return {state:state,png:__gnuroQA.capture(),
            finalHits:__gnuroQA.hits.filter(function(h){return h.skillId===113;}).length};})()`);
        const png=Buffer.from(shot.png,'base64');
        if(!encoder.stdin.write(png))await Promise.race([once(encoder.stdin,'drain'),done]);
        frames+=3;
        if(index%100===0)console.log(JSON.stringify({frames,phase:shot.state.phase,turn:shot.state.turn}));
        if(openingOnly&&shot.state.phase>=1&&shot.state.turn-shot.state.since>=1)break;
        if(!openingOnly&&shot.state.phase===4&&shot.state.turn-shot.state.since>=4&&shot.finalHits>=2)break;
        if(index===3999)throw new Error('Showcase did not complete all phases');
    }
    encoder.stdin.end();await done;fs.writeFileSync(path.join(work,'encode.log'),log);
    const report=await cdp.evaluate(`({frames:${frames},firstFrame:${initial.frame+3},sounds:__gnuroQA.sounds,guards:__gnuroQA.guards,hits:__gnuroQA.hits,
        messages:__gnuroQA.messages,phaseChanges:__gnuroQA.phaseChanges,trace:__gnuroQA.trace,
        jumps:__gnuroQA.jumps,spins:__gnuroQA.spins,breakPoses:__gnuroQA.breakPoses,threatPoses:__gnuroQA.threatPoses,uiPoses:__gnuroQA.uiPoses,
        axeChanges:__gnuroQA.axeChanges,barChanges:__gnuroQA.barChanges,
        bubblePoses:__gnuroQA.bubblePoses,
        bgm:{loopStart:AudioManager._bgmBuffer._loopStart,loopLength:AudioManager._bgmBuffer._loopLength}})`);
    fs.writeFileSync(path.join(outputDir,'verification.json'),JSON.stringify(report,null,2));
    const audio=mixAudio(report),output=path.join(outputDir,'gnuro_boss_showcase.mp4');
    const mux=spawnSync(ffmpeg,['-hide_banner','-y','-i',silent,'-i',audio,'-map','0:v:0','-map','1:a:0',
        '-c:v','copy','-c:a','aac','-b:a','192k','-t',String(frames/60),'-movflags','+faststart',output],{encoding:'utf8'});
    fs.writeFileSync(path.join(work,'mux.log'),mux.stderr);
    if(mux.status)throw new Error(mux.stderr);
    console.log(JSON.stringify({output,frames,seconds:frames/60,bytes:fs.statSync(output).size}));
}
async function connect() {
    const pages = await (await fetch('http://127.0.0.1:9341/json')).json();
    const page = pages.find(p=>/\/index.html$/.test(p.url));
    if (!page) throw new Error('Launch a separate NW.js playtest on port 9341 first');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    let next = 0;
    const pending = new Map();
    ws.addEventListener('message',event=>{
        const data=JSON.parse(event.data),item=pending.get(data.id);
        if(!item)return;
        pending.delete(data.id);
        if(data.error)item.reject(new Error(JSON.stringify(data.error)));else item.resolve(data.result);
    });
    const call=(method,params={})=>new Promise((resolve,reject)=>{
        const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
    });
    return {call,close:()=>ws.close(),async evaluate(expression){
        const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
        if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
    }};
}
async function main(){
    const cdp=await connect();
    try{
        const mode=process.argv[2]||'inspect';
        if(mode==='bench')console.log(JSON.stringify(await cdp.evaluate(`(function(){
            var t=performance.now(),png=__gnuroQA.canvas.toDataURL('image/png'),a=performance.now(),
                jpg=__gnuroQA.canvas.toDataURL('image/jpeg',0.95),b=performance.now();
            return {pngMs:a-t,jpgMs:b-a,pngBytes:png.length,jpgBytes:jpg.length};})()`)));
        else if(mode==='inspect')console.log(JSON.stringify(await cdp.evaluate(`({
            scene:window.SceneManager&&SceneManager._scene&&SceneManager._scene.constructor.name,
            stopped:window.SceneManager&&SceneManager._stopped,
            database:window.$dataSkills&&$dataSkills.length,
            plugin:!!window.KNH_ZXC_Battle_Gnuro,
            error:document.getElementById('ErrorPrinter')&&document.getElementById('ErrorPrinter').innerText,
            body:document.body.innerText.slice(0,1600)
        })`),null,2));
        else if(mode==='layer-check'){
            for(const hidden of [false,true]){
                const png=await cdp.evaluate(`(function(){var s=SceneManager._scene,b=s._barSprite,was=b.visible;
                    b.visible=${!hidden};Graphics._renderer.render(s);var png=Graphics._canvas.toDataURL('image/png').split(',')[1];
                    b.visible=was;return png;})()`);
                const file=path.join(work,hidden?'without-bar.png':'with-bar.png');
                fs.writeFileSync(file,Buffer.from(png,'base64'));console.log(file);
            }
        }
        else if(mode==='close'){
            await cdp.call('Browser.close');console.log('Closed dedicated QA playtest');
        }
        else if(mode==='record')await record(cdp);
        else if(mode==='prepare')console.log(JSON.stringify(await fresh(cdp)));
        else if(mode==='remux'){
            const report=JSON.parse(fs.readFileSync(path.join(outputDir,'verification.json'),'utf8'));
            if(report.firstFrame===undefined)report.firstFrame=6;
            const audio=mixAudio(report),output=path.join(outputDir,'gnuro_boss_showcase.mp4');
            const mux=spawnSync(ffmpeg,['-hide_banner','-y','-i',path.join(work,'showcase-silent.mp4'),'-i',audio,
                '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(report.frames/60),
                '-movflags','+faststart',output],{encoding:'utf8'});
            if(mux.status)throw new Error(mux.stderr);
            fs.writeFileSync(path.join(work,'mux.log'),mux.stderr);
            fs.writeFileSync(path.join(outputDir,'verification.json'),JSON.stringify(report,null,2));
            console.log(JSON.stringify({output,seconds:report.frames/60,firstFrame:report.firstFrame}));
        }
        else if(mode==='exit-check')console.log(JSON.stringify(await cdp.evaluate(`(function(){
            var previous=SceneManager._scene,art=previous._gnuro.filterTarget;previous.terminate();
            var detached=!previous._gnuro&&!(previous._barSprite.filters||[]).length&&!(art.filters||[]).length;
            BattleManager.setup(43,false,true);
            var next=new Scene_NewBattle();SceneManager._scene=next;next.create();next.start();
            return {detached:detached,phase:next._gnuro.phase,depth:next._gnuro.depth,
                barY:next._barSprite.y,normalSkill:next._enemySprites[0]._battler.isActionValid({skillId:111,conditionType:0}),
                stompLocked:!next._enemySprites[0]._battler.isActionValid({skillId:112,conditionType:0})};})()`),null,2));
        else if(mode==='refresh-capture'){
            const source=fs.readFileSync(path.join(__dirname,'gnuro_battle_preview/runtime.js'),'utf8');
            const from=source.indexOf('    q.capture = function()');
            const to=source.indexOf('    // Let the scene',from);
            await cdp.evaluate('(function(q,scene){'+source.slice(from,to)+'})(__gnuroQA,__gnuroQA.scene)');
            console.log('Refreshed capture-only chapter captions');
        }
        else if(mode==='navigate'){
            const url=await cdp.evaluate("new URL('tools/yume_skill_preview/index.html',document.baseURI).href");
            await cdp.call('Page.navigate',{url});console.log('Loaded isolated battle preview');
        }else if(mode==='reload'){
            await cdp.call('Page.reload');console.log('Reloaded dedicated QA playtest');
        }else if(mode==='eval')console.log(JSON.stringify(await cdp.evaluate(process.argv[3]),null,2));
        else if(mode==='run'){
            const source=fs.readFileSync(path.join(__dirname,'gnuro_battle_preview','runtime.js'),'utf8');
            console.log(JSON.stringify(await cdp.evaluate(source),null,2));
        }else if(mode==='step'){
            console.log(JSON.stringify(await cdp.evaluate('__gnuroQA.step('+Number(process.argv[3]||1)+')'),null,2));
        }else if(mode==='snap'){
            const data=await cdp.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");
            const file=path.join(work,process.argv[3]||'gnuro-preview.png');
            fs.writeFileSync(file,Buffer.from(data,'base64'));console.log(file);
        }else throw new Error('Unknown mode '+mode);
    }finally{cdp.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
