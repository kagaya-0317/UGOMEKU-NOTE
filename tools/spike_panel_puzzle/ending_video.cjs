// Deliver only the last approach, retraction, and key chest from the native run.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/spike-panel-finish-retraction-20261119'),work=path.join(out,'_video_work');
const ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe');
const data=JSON.parse(fs.readFileSync(path.join(out,'video-verification.json')));
const stage=name=>data.stages.find(s=>s.name===name),start=stage('Panel 7').seconds-.25,end=stage('Triangle key acquired').seconds+.25;
const video=path.join(out,'puzzle_ending.mp4');
function run(args){const r=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,maxBuffer:5e6});assert.equal(r.status,0,r.stderr);return r.stderr;}
run(['-hide_banner','-y','-ss',String(start),'-i',path.join(out,'spike_panel_puzzle.mp4'),'-t',String(end-start),'-c:v','libx264','-preset','fast','-crf','19','-c:a','aac','-b:a','160k','-movflags','+faststart',video]);
const log=run(['-hide_banner','-xerror','-i',video,'-af','volumedetect','-f','null','NUL']);fs.writeFileSync(path.join(work,'ending-decode.log'),log);
const m=log.match(/Duration:\s+(\d+):(\d+):([\d.]+)/),seconds=+m[1]*3600+ +m[2]*60+ +m[3];
assert.ok(Math.abs(seconds-(end-start))<.15);assert.ok(log.includes('Video: h264'));assert.ok(log.includes('Audio: aac'));assert.ok(log.includes('816x624'));
const audioDb=+log.match(/mean_volume:\s+(-?[\d.]+) dB/)[1];assert.ok(audioDb>-55);
const changes=data.finish.frames.filter((r,i,a)=>!i||JSON.stringify(r.cells)!==JSON.stringify(a[i-1].cells));
const times=[data.finish.before.seconds-.2,...changes.map(r=>r.seconds+.033),stage('Triangle key acquired').seconds-.1];
const pngs=[];for(let i=0;i<times.length;i++){const p=path.join(work,'ending-check-'+String(i).padStart(2,'0')+'.png');run(['-hide_banner','-loglevel','error','-y','-ss',String(times[i]-start),'-i',video,'-frames:v','1','-vf','scale=408:312',p]);pngs.push(p);}
const contact=path.join(work,'ending-contact.png');run(['-hide_banner','-loglevel','error','-y','-framerate','1','-i',path.join(work,'ending-check-%02d.png'),'-vf','tile=3x2','-frames:v','1',contact]);pngs.push(contact);
const report={file:video,startInSource:start,endInSource:end,seconds,bytes:fs.statSync(video).size,codec:'H.264/AAC',resolution:[816,624],meanAudioDb:audioDb,fullDecode:true,visualCheckPending:true,temporaryPngs:pngs};fs.writeFileSync(path.join(out,'ending-video-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
