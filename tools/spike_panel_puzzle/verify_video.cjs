const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=process.argv.includes('--out')?path.resolve(root,process.argv[process.argv.indexOf('--out')+1]):path.join(root,'artifacts/spike-panel-puzzle-20261119'),work=path.join(out,'_video_work');
const ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe'),video=path.join(out,'spike_panel_puzzle.mp4');
function run(args){const r=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,maxBuffer:6e6});assert.equal(r.status,0,r.stderr);return r.stderr;}
const log=run(['-hide_banner','-xerror','-i',video,'-af','volumedetect','-f','null','NUL']);
fs.writeFileSync(path.join(work,'decode-verification.log'),log);
const d=log.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);assert.ok(d);const seconds=Number(d[1])*3600+Number(d[2])*60+Number(d[3]);
assert.ok(log.includes('Video: h264'));assert.ok(log.includes('Audio: aac'));assert.ok(log.includes('816x624'));
const mean=Number(log.match(/mean_volume:\s+(-?[\d.]+) dB/)[1]);assert.ok(mean>-55,'Silent recording');
const events=JSON.parse(fs.readFileSync(path.join(out,'video-verification.json')));assert.ok(Math.abs(seconds-events.seconds)<2);assert.equal(events.stages.length,16);
const stage=name=>events.stages.find(s=>s.name===name);assert.deepEqual(stage('Native spike hit').panels.on,[5]);assert.deepEqual(stage('Returned to safe floor; panel retained').panels.on,[5]);assert.equal(stage('All panels ON; spikes stopped').panels.on.length,8);assert.equal(stage('Returned to 3F').map,60);
const times=[1.2,stage('First panel ON').seconds+.1,stage('Reentry toggles panel OFF').seconds+.1,stage('Native spike hit').seconds+.3,stage('Returned to safe floor; panel retained').seconds+.1,stage('Panel 7').seconds+.1,stage('Triangle key acquired').seconds-.4,seconds-.8],pngs=[];
for(let i=0;i<times.length;i++){const file=path.join(work,'check-'+String(i).padStart(2,'0')+'.png');run(['-hide_banner','-loglevel','error','-y','-ss',String(times[i]),'-i',video,'-frames:v','1','-vf','scale=408:312',file]);pngs.push(file);}
const contact=path.join(work,'contact-sheet.png');run(['-hide_banner','-loglevel','error','-y','-framerate','1','-i',path.join(work,'check-%02d.png'),'-vf','tile=4x2','-frames:v','1',contact]);pngs.push(contact);
const report={file:video,seconds,bytes:fs.statSync(video).size,codec:'H.264/AAC',resolution:[816,624],meanAudioDb:mean,fullDecode:true,visualCheckPending:true,temporaryPngs:pngs};
fs.writeFileSync(path.join(out,'video-final-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
