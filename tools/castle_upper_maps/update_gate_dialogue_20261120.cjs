const fs=require('node:fs'),assert=require('node:assert/strict');
const{keySpan,patchRecords}=require('./implement_events.cjs');
const file='data/Map060.json',before=fs.readFileSync(file),text=before.toString('utf8'),map=JSON.parse(text),gate=map.events[8],list=gate.pages[0].list;
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const message=(lines,indent)=>[c(101,['',0,0,2],indent),...lines.map(line=>c(401,[line],indent))];
const start=list.findIndex(v=>v.code===111&&v.parameters[1]==='KNH_CastleUpper.gateMiiSpeaker()'),end=list.findIndex((v,i)=>i>start&&v.code===412&&v.indent===0);assert.ok(start>=0&&end>start);
list.splice(start,end-start+1,
 c(111,[12,'KNH_CastleUpper.gateMiiSpeaker()']),
 ...message(['おっきな','扉だね'],1),
 ...message(['この先が','王の部屋かな…'],1),
 c(111,[12,'KNH_CastleUpper.gateYumeSpeaker()'],1),
 ...message(['きっとそうよ','準備していきましょ'],2),c(412,[],1),
 c(355,['KNH_CastleUpper.gateMiiSpeaker();'],1),
 ...message(['ぼくも出会ったことのない','モンスターの王…','いったいどんな人なんだろう'],1),
 ...message(['…'],1),c(412));
const[a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[[8,gate]])+text.slice(b);
assert.ok(fs.readFileSync(file).equals(before),'Concurrent map change');fs.writeFileSync(file,updated);console.log('Changed only the gate dialogue block in Map060 event 8');
