// Add only the selected Tsunehi introduction, native stand-ins and completion page.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const dialoguePages=require('./intro_dialogue.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/road-approach-tsunehi-intro-20261119');
const clone=x=>structuredClone(x),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const c=(code,parameters=[],indent=0)=>({code,indent,parameters}),js=s=>s.split('\n').map((line,i)=>c(i?655:355,[line])),wait=n=>c(230,[n]);
const file='data/Map063.json',bytes=fs.readFileSync(path.join(root,file)),text=bytes.toString('utf8'),map=JSON.parse(text);
assert.equal(map.events.length,3);assert.ok(Buffer.from(text).equals(bytes));
const base=clone(map.events[1].pages[0]);
function page(list,options={}){const p=clone(base);p.list=[...list,c(0)];p.trigger=1;p.priorityType=0;p.through=true;p.directionFix=true;p.walkAnime=false;p.moveType=0;p.moveRoute={list:[{code:0,parameters:[]}],repeat:false,skippable:true,wait:false};return Object.assign(p,options);}
function voice(lines,shout=false,laugh=false){return [...js(`KNH_CastleUpper.roadIntroVoice(${laugh});`+(!laugh&&lines.length===1?'\n$gameSystem.setMessagePopupFree($gameMap.getCenterXForUI(),180);':'')),c(122,[14,14,0,0,shout?1:0]),c(101,['',0,0,2]),...lines.map(s=>c(401,[s]))];}
function reaction(lines,actorId=3){return [c(111,[12,'KNH_CastleUpper.roadIntroReaction('+actorId+')']),c(122,[14,14,0,0,0],1),c(101,['',0,0,2],1),...lines.map(s=>c(401,[s],1)),c(412)];}
const list=[
 ...js('ImageManager.loadCharacter("$kanbu2_2");\nKNH_CastleUpper.beginRoadIntro();\nthis.setWaitMode("castleUpperFormation");'),
 ...js('this.setWaitMode("image");'),
 ...js('KNH_CastleUpper.roadIntroFaceRight();\n$gameMap.scrollCameraTo($gamePlayer.x,$gamePlayer.y-1.5,60);'),wait(60),
 ...dialoguePages.flatMap(p=>p.speaker==='tsunehi'?voice(p.lines,!!p.tone,!!p.laugh):reaction(p.lines,p.speaker)),
 wait(24),...js('KNH_CastleUpper.endRoadIntro();'),wait(60),c(123,['A',0])
];
const done=page([],{trigger:0});done.conditions.selfSwitchValid=true;done.conditions.selfSwitchCh='A';
const controller={id:3,name:'ツネヒの声_88,888,888番通路案内',note:'<important><HM初期半歩Y:+><HM拡大領域:2,2,5,2>',x:14,y:10,pages:[page(list),done]};
const reference=JSON.parse(fs.readFileSync(path.join(root,'data/Map059.json'),'utf8'));
const proxies=[reference.events[8],reference.events[9]].map((source,i)=>{
 const e=clone(source);delete e.meta;delete e.metaArray;e.id=4+i;e.name=i?'ゆめちゃん（案内演出）':'みぃー（案内演出）';e.x=12;e.y=i?12:10;
 e.note='<important><castleUpperActor:'+(3+i)+'><castleUpperScene:3><HM初期半歩X:+>';
 e.pages=e.pages.slice(0,1);e.pages[0].moveSpeed=4;e.pages[0].moveType=0;e.pages[0].through=true;e.pages[0].image.direction=6;e.pages[0].list=[c(0)];e.pages[0].moveRoute={list:[{code:0,parameters:[]}],repeat:false,skippable:true,wait:false};return e;
});
for(let i=0;i<list.length;i++){const cmd=list[i];if(cmd.code===401)assert.ok(cmd.parameters[0].length&&!cmd.parameters[0].includes('\u3002'));if(cmd.code===355){let script=cmd.parameters[0];while(list[i+1]?.code===655)script+='\n'+list[++i].parameters[0];new vm.Script('(function(){'+script+'\n})');}}
const [a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[],[controller,...proxies])+text.slice(b);
const systemFile='data/System.json',systemBytes=fs.readFileSync(path.join(root,systemFile)),systemText=systemBytes.toString('utf8'),system=JSON.parse(systemText);
const [x,y]=keySpan(systemText,'versionId'),nextSystem=systemText.slice(0,x)+JSON.stringify(system.versionId+1)+systemText.slice(y);
const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline.json')));assert.equal(sha(bytes),baseline.files[file]);assert.equal(sha(systemBytes),baseline.files[systemFile]);
assert.ok(fs.readFileSync(path.join(root,file)).equals(bytes),'Concurrent map edit');assert.ok(fs.readFileSync(path.join(root,systemFile)).equals(systemBytes),'Concurrent system edit');
fs.writeFileSync(path.join(root,file),updated);fs.writeFileSync(path.join(root,systemFile),nextSystem);
const dialogue=list.filter(c=>c.code===401).map(c=>c.parameters[0]);fs.writeFileSync(path.join(out,'implementation.json'),JSON.stringify({mapId:63,controller:3,proxies:[4,5],completed:'self switch A on event 3',trigger:{x:14,y:10.5,area:{left:12,right:19,top:8.5,bottom:12.5}},dialogue,versionBefore:system.versionId,versionAfter:system.versionId+1},null,2)+'\n');
console.log(JSON.stringify({mapId:63,addedEvents:[3,4,5],dialogueLines:dialogue.length,versionId:system.versionId+1}));
