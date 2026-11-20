// Patch only the existing controller record, preserving all other map bytes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const file=path.resolve(__dirname,'../../data/Map054.json');
const before=fs.readFileSync(file),source=before.toString('utf8'),map=JSON.parse(source);
assert.ok(Buffer.from(source).equals(before),'UTF-8 roundtrip');
const event=structuredClone(map.events[3]),list=event.pages[0].list;
const start=list.findIndex(c=>c.code===355&&c.parameters[0]==='delete $gameTemp._gnuroMapIntro;');
assert.ok(start>0&&list[start+1].parameters[0]==='KNH_CastleUpper.endScene();','Expected prebattle cleanup');
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const js=(s,indent=0)=>s.split('\n').map((line,i)=>c(i?655:355,[line],indent));
const has=id=>'$gameTemp._castleUpperScene.members.some(function(m){return m.actorId==='+id+';})';
const post=[...js('delete $gameTemp._gnuroMapIntro;\nKNH_CastleUpper.clearMessage();\n$gameMap.scrollCameraTo($gamePlayer.x,$gamePlayer.y,60);'),c(230,[60])];
function say(actor,eventId,lines,condition=has(actor)){
    post.push(c(111,[12,condition]),...js('KNH_CastleUpper.mapSpeaker('+eventId+');\nvar speaker=$gameMap.event('+eventId+');\n$gamePlayer.turnTowardCharacter(speaker);\n$gameTemp._castleUpperScene.members.forEach(function(m){if(m.actorId!=='+actor+')$gameMap.event(m.eventId).turnTowardCharacter(speaker);});',1),c(101,['',0,0,2],1),...lines.map(s=>c(401,[s],1)),c(412));
}
say(3,5,['なんとか倒せたね…','すごい人だったね']);
say(4,6,['ええ、毎朝欠かさず','伸ばしてるんですって！']);
say(3,5,['足の話！？'],has(3)+' && '+has(4));
post.push(...js('KNH_CastleUpper.returnScene();\nthis.setWaitMode("castleUpperReturn");'),...js('KNH_CastleUpper.endScene();'),c(230,[60]),c(0));
list.splice(start,list.length-start,...post);
const [a,b]=keySpan(source,'events');
const output=source.slice(0,a)+patchRecords(source.slice(a,b),[[3,event]])+source.slice(b);
const saved=JSON.parse(output);
assert.deepEqual(saved.events.filter(e=>e&&e.id!==3),map.events.filter(e=>e&&e.id!==3));
assert.deepEqual(saved.events[3].pages[1],map.events[3].pages[1]);
assert.ok(post.filter(x=>x.code===401).every(x=>!x.parameters[0].includes('\u3002')));
assert.ok(fs.readFileSync(file).equals(before),'Concurrent map edit');
fs.writeFileSync(file,output);
console.log(post.filter(x=>x.code===401).map(x=>x.parameters[0]).join('\n'));
