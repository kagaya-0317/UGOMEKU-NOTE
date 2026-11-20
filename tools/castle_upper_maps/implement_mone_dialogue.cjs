const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dialogue=require('./mone_dialogue.cjs'),root=path.resolve(__dirname,'../..');
const out=path.join(root,'artifacts/mone-dialogue-20261120');fs.mkdirSync(out,{recursive:true});
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const script=(text,indent=0)=>text.split('\n').map((line,i)=>c(i?655:355,[line],indent));
function messages(lines,battle){return lines.flatMap(([who,text])=>{
 const call='KNH_CastleUpper.'+(battle?'moneBattleSpeaker':'moneMapSpeaker')+'('+JSON.stringify(who)+')';
 if(who==='enemy')return [...script(call+';'),c(101,['',0,0,2]),...text.map(t=>c(401,[t]))];
 return [c(111,[12,call]),c(101,['',0,0,2],1),...text.map(t=>c(401,[t],1)),c(412)];
});}
function replaceRecord(text,old,next){const token=JSON.stringify(old);assert.equal(text.split(token).length,2,'Unique native record');return text.replace(token,JSON.stringify(next));}
function battleMessages(part){return part.lines.flatMap((line,index)=>[
 ...messages([line],true),...(part.waveAfter===index?script('KNH_CastleUpper.revealMoneWave(24, 2);\nthis.setWaitMode("moneWaveReveal");'):[]),
 ...(part.disorderAfter===index?script('KNH_CastleUpper.disorderMoneWave(24, 2);\nthis.setWaitMode("moneWaveArrange");'):[]),
 ...(part.alignAfter===index?script('KNH_CastleUpper.alignMoneWave();\nthis.setWaitMode("moneWaveArrange");'):[])
]);}
const files=['data/Map059.json','data/Troops.json'];const originals=new Map(files.map(f=>[f,fs.readFileSync(path.join(root,f))]));
let mapText=originals.get(files[0]).toString('utf8'),troopText=originals.get(files[1]).toString('utf8');
const map=JSON.parse(mapText),troops=JSON.parse(troopText),old=map.events[5],event=structuredClone(old);
event.pages[0].list=[
 ...script('KNH_CastleUpper.beginScene(3, true);\nthis.setWaitMode("castleUpperFormation");'),
 ...script('KNH_CastleUpper.focusScene(3, 64);'),c(230,[90]),...messages(dialogue.before,false),
 ...script('KNH_CastleUpper.clearMessage();'),c(301,[0,46,false,false]),c(222),c(230,[30]),
 ...messages(dialogue.after,false),...script('KNH_CastleUpper.returnScene();\nthis.setWaitMode("castleUpperReturn");'),
 c(122,[63,63,0,0,2]),...script('KNH_CastleUpper.endScene();'),c(230,[60]),c(0)
];
mapText=replaceRecord(mapText,old,event);
for(const id of [8,9]){const p=structuredClone(map.events[id]);for(const page of p.pages)page.moveSpeed=4;mapText=replaceRecord(mapText,map.events[id],p);}
const troop=structuredClone(troops[46]);assert.equal(troop.members[0].enemyId,23);assert.equal(troop.pages.length,0,'Existing battle pages need reconciliation');
troop.pages=dialogue.during.map((part,i)=>({
 conditions:{actorHp:50,actorId:1,actorValid:false,enemyHp:part.hp,enemyIndex:0,enemyValid:true,switchId:1,switchValid:false,turnA:0,turnB:0,turnEnding:false,turnValid:false},
 span:0,list:[c(108,['Mone dialogue '+(i+1)+'; one shot; HP '+part.hp+'%']),c(408,['<MoneGate:'+i+','+(i?1:0)+'>']),
 ...script('KNH_CastleUpper.beginMoneEvent();\nthis.setWaitMode("castleMoneIdle");'),c(230,[12]),
 ...(part.chaosBefore?script('KNH_CastleUpper.chaosMoneWave(24);\nthis.setWaitMode("moneWaveArrange");'):[]),...battleMessages(part),
 ...script('KNH_CastleUpper.endMoneEvent('+(i+1)+');'),c(0)]
}));
troopText=replaceRecord(troopText,troops[46],troop);
for(const[f,text]of [[files[0],mapText],[files[1],troopText]]){
 assert(fs.readFileSync(path.join(root,f)).equals(originals.get(f)),'Concurrent edit: '+f);
 const backup=path.join(out,'before',f);fs.mkdirSync(path.dirname(backup),{recursive:true});assert(!fs.existsSync(backup),'Existing backup');fs.writeFileSync(backup,originals.get(f));
 fs.writeFileSync(path.join(root,f),text);
}
console.log('Saved Mone pre/post dialogue and three one-shot troop pages.');
