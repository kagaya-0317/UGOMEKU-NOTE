// Replace only the dialogue section, retaining placement, transitions and cleanup.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs'),pages=require('./intro_dialogue.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/road-approach-dialogue-revision-20261120');
const file='data/Map063.json',bytes=fs.readFileSync(path.join(root,file)),text=bytes.toString('utf8'),map=JSON.parse(text),event=structuredClone(map.events[3]);
const c=(code,parameters=[],indent=0)=>({code,indent,parameters}),list=event.pages[0].list;
const first=list.findIndex(c=>c.code===355&&c.parameters[0].startsWith('KNH_CastleUpper.roadIntroVoice('));let last=-1;list.forEach((c,i)=>{if(c.code===401)last=i;});assert.ok(first>=0&&last>first);
const dialogue=pages.flatMap(p=>{
 const voice=p.speaker==='tsunehi',indent=voice?0:1;
 return [voice?c(355,[`KNH_CastleUpper.roadIntroVoice(${!!p.laugh});`]):c(111,[12,`KNH_CastleUpper.roadIntroReaction(${p.speaker})`]),...voice&&!p.laugh&&p.lines.length===1?[c(655,['$gameSystem.setMessagePopupFree($gameMap.getCenterXForUI(),180);'])]:[],c(122,[14,14,0,0,p.tone],indent),c(101,['',0,0,2],indent),...p.lines.map(s=>c(401,[s],indent)),...voice?[]:[c(412)]];
});
event.pages[0].list=[...list.slice(0,first),...dialogue,...list.slice(last+1)];
assert.equal(pages.length,15);assert.equal(pages.flatMap(p=>p.lines).length,36);
for(const cmd of dialogue){if(cmd.code===401)assert.ok(!cmd.parameters[0].includes('\u3002'));if(cmd.code===355)new vm.Script('(function(){'+cmd.parameters[0]+'})');if(cmd.code===111)new vm.Script('('+cmd.parameters[1]+')');}
const [a,b]=keySpan(text,'events'),next=text.slice(0,a)+patchRecords(text.slice(a,b),[[3,event]])+text.slice(b);
const sf='data/System.json',sb=fs.readFileSync(path.join(root,sf)),st=sb.toString('utf8'),system=JSON.parse(st),[x,y]=keySpan(st,'versionId');const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline.json'))).files;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),baseline[file]);assert.equal(sha(sb),baseline[sf]);assert.ok(fs.readFileSync(path.join(root,file)).equals(bytes));assert.ok(fs.readFileSync(path.join(root,sf)).equals(sb));
fs.writeFileSync(path.join(root,file),next);fs.writeFileSync(path.join(root,sf),st.slice(0,x)+JSON.stringify(system.versionId+1)+st.slice(y));
const names={tsunehi:'ツネヒ',3:'みぃー',4:'ゆめちゃん'};let previousSpeaker;
const transcript=pages.map(p=>{const heading=previousSpeaker===p.speaker?'':'【'+names[p.speaker]+'】\n\n';previousSpeaker=p.speaker;return heading+p.lines.join('\n');}).join('\n\n')+'\n';
fs.writeFileSync(path.join(out,'dialogue.txt'),transcript,'utf8');
fs.writeFileSync(path.join(out,'implementation.json'),JSON.stringify({mapId:63,eventId:3,pages,dialogue:pages.flatMap(p=>p.lines),versionBefore:system.versionId,versionAfter:system.versionId+1},null,2)+'\n');console.log(JSON.stringify({pages:pages.length,lines:36,speakers:['Tsunehi','Yume','Mii'],version:system.versionId+1}));
