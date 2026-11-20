const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/castle-upper-events-20261118'),work=path.join(out,'_flow_video_work');
fs.mkdirSync(work,{recursive:true});
const ffmpeg=path.join(root,'tools/bgm_video_maker/node_modules/ffmpeg-static/ffmpeg.exe'),video=path.join(out,'castle_upper_floor_flow.mp4');
const run=args=>{const r=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:6e6});assert.equal(r.status,0,r.stderr);return r.stderr;};
const log=run(['-hide_banner','-i',video,'-af','volumedetect','-f','null','NUL']);
fs.writeFileSync(path.join(work,'decode-verification.log'),log);
const duration=log.match(/Duration:\s+(\d+):(\d+):([\d.]+)/);assert.ok(duration);const seconds=Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]);
assert.ok(log.includes('Video: h264'));assert.ok(log.includes('Audio: aac'));assert.ok(log.includes('816x624'));
const volume=Number(log.match(/mean_volume:\s+(-?[\d.]+) dB/)[1]);assert.ok(volume>-55,'Silent audio');
const events=JSON.parse(fs.readFileSync(path.join(out,'video-verification.json')));assert.ok(Math.abs(events.seconds-seconds)<3,'Duration mismatch');assert.equal(events.trace.length,13);assert.equal(events.status.done,true);
const at=name=>events.trace.find(e=>e.name===name).seconds;
const times=[1.2,10,(at('Mone save point')+at('Mone encounter'))/2,(at('Stairs to 3F')+at('Beast encounter'))/2,at('Round key')-1.4,at('Last gimmick room')-1.5,at('Triangle key')-1.4,at('Two-key gate')-2,at('Throne save point')-2.5,at('Throne save point')+5.5,(at('Throne save point')+at('Tsunehi encounter'))/2,seconds-1];
const thumbnails=[];
for(let i=0;i<times.length;i++){const file=path.join(work,'check-'+String(i).padStart(2,'0')+'.png');run(['-hide_banner','-loglevel','error','-y','-ss',String(Math.max(0,times[i])),'-i',video,'-frames:v','1','-vf','scale=408:312',file]);thumbnails.push(file);}
run(['-hide_banner','-loglevel','error','-y','-framerate','1','-i',path.join(work,'check-%02d.png'),'-vf','tile=4x3','-frames:v','1',path.join(work,'contact-sheet.png')]);
const result={file:video,seconds,codec:'H.264/AAC',resolution:[816,624],audioMeanDb:volume,fullDecode:true,chapters:events.trace.map(e=>({name:e.name,ends:e.seconds})),bytes:fs.statSync(video).size,temporaryPngs:thumbnails.length+1};
fs.writeFileSync(path.join(out,'video-final-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
