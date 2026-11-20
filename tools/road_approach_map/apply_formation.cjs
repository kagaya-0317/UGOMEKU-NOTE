// Apply the selected formation and normal companion bubbles without changing dialogue.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/road-approach-intro-formation-20261120');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),file='data/Map063.json',bytes=fs.readFileSync(path.join(root,file)),text=bytes.toString('utf8'),map=JSON.parse(text),before=structuredClone(map);
const list=map.events[3].pages[0].list;
const begin=list.find(c=>c.code===655&&c.parameters[0]==='KNH_CastleUpper.beginScene(3,true);');assert.ok(begin);begin.parameters[0]='KNH_CastleUpper.beginRoadIntro();';
const camera=list.findIndex(c=>c.code===355&&c.parameters[0]==='$gameMap.scrollCameraTo($gamePlayer.x,$gamePlayer.y-1.5,60);');assert.ok(camera>=0);
list.splice(camera,1,{code:355,indent:0,parameters:['KNH_CastleUpper.roadIntroFaceRight();']},{code:655,indent:0,parameters:['$gameMap.scrollCameraTo($gamePlayer.x,$gamePlayer.y-1.5,60);']});
let reactions=0;for(let i=0;i<list.length;i++)if(list[i].code===111&&list[i].parameters[1]==='KNH_CastleUpper.roadIntroReaction()'){const tone=list[i+1];assert.equal(tone.code,122);assert.equal(tone.parameters[4],1);tone.parameters[4]=0;reactions++;}assert.equal(reactions,2);
for(const [id,y]of[[4,10],[5,12]]){const event=map.events[id];event.x=12;event.y=y;event.note=event.note.replace('<HM初期半歩Y:+>','');event.pages[0].image.direction=6;}
const oldLines=before.events[3].pages[0].list.filter(c=>c.code===401).map(c=>c.parameters[0]);assert.deepEqual(list.filter(c=>c.code===401).map(c=>c.parameters[0]),oldLines);
const [a,b]=keySpan(text,'events'),next=text.slice(0,a)+patchRecords(text.slice(a,b),[3,4,5].map(id=>[id,map.events[id]]))+text.slice(b);
const sf='data/System.json',sb=fs.readFileSync(path.join(root,sf)),st=sb.toString('utf8'),system=JSON.parse(st),[x,y]=keySpan(st,'versionId');
const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline.json'))).files;assert.equal(sha(bytes),baseline[file]);assert.equal(sha(sb),baseline[sf]);assert.ok(fs.readFileSync(path.join(root,file)).equals(bytes));assert.ok(fs.readFileSync(path.join(root,sf)).equals(sb));
fs.writeFileSync(path.join(root,file),next);fs.writeFileSync(path.join(root,sf),st.slice(0,x)+JSON.stringify(system.versionId+1)+st.slice(y));
const groups=[];let speaker='ツネヒ';for(const c of list){if([355,655].includes(c.code)&&c.parameters[0].startsWith('KNH_CastleUpper.roadIntroVoice('))speaker='ツネヒ';if(c.code===111&&c.parameters[1]==='KNH_CastleUpper.roadIntroReaction()')speaker='みぃー';if(c.code===101)groups.push({speaker,lines:[]});if(c.code===401)groups.at(-1).lines.push(c.parameters[0]);}
fs.writeFileSync(path.join(out,'dialogue.txt'),groups.map(g=>'【'+g.speaker+'】\n'+g.lines.join('\n')).join('\n\n')+'\n','utf8');
fs.writeFileSync(path.join(out,'implementation.json'),JSON.stringify({mapId:63,hero:[14,11],mii:[12.5,10],yume:[12.5,12],direction:6,reactionTone:0,dialogue:oldLines,groups,versionBefore:system.versionId,versionAfter:system.versionId+1},null,2)+'\n');console.log(JSON.stringify({positions:{hero:[14,11],mii:[12.5,10],yume:[12.5,12]},normalReactions:reactions,dialogueUnchanged:true,version:system.versionId+1}));
