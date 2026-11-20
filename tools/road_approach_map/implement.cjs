// Register the existing approach artwork and reuse native page-turn transfers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {build}=require('../castle_upper_maps/build_maps.cjs');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/road-approach-map-implementation-20261119');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),clone=x=>JSON.parse(JSON.stringify(x));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const snapshots=new Map();
function source(p){const bytes=fs.readFileSync(path.join(root,p));snapshots.set(p,bytes);return bytes.toString('utf8');}
function patchKey(text,key,value){const [a,b]=keySpan(text,key);return text.slice(0,a)+JSON.stringify(value)+text.slice(b);}
function appendEvents(text,events){
 const [a,b]=keySpan(text,'events'),existing=JSON.parse(text.slice(a,b)),changes=[],append=[];
 for(const event of events){assert.ok(!existing[event.id],'Event id occupied');if(event.id<existing.length)changes.push([event.id,event]);else {assert.equal(event.id,existing.length+append.length);append.push(event);}}
 return text.slice(0,a)+patchRecords(text.slice(a,b),changes,append)+text.slice(b);
}
const hallText=source('data/Map054.json'),roadText=source('data/Map055.json'),infoText=source('data/MapInfos.json'),systemText=source('data/System.json');
const hall=JSON.parse(hallText),road=JSON.parse(roadText),infos=JSON.parse(infoText),system=JSON.parse(systemText);
const id=63;assert.equal(infos[id],undefined);assert.ok(!fs.existsSync(path.join(root,'data/Map063.json')));
assert.ok(!hall.events[7]);assert.equal(road.events.length,11);
const transferTemplate=hall.events[2].pages[0];
function transferPage(map,x,y,dir,shiftX=0,shiftY=0){
 const page=clone(transferTemplate),turn={2:16,4:17,6:18,8:19}[dir];
 page.conditions=clone(transferTemplate.conditions);
 page.list[0].parameters[1].list[0].code=turn;
 page.list[1].parameters[0].code=turn;
 page.list.find(c=>c.code===201).parameters=[0,map,Math.floor(x),Math.floor(y),dir,2];
 const script=page.list.find(c=>c.code===355);script.parameters=[`$gamePlayer.shiftPos(${shiftX}, ${shiftY}); //shift`];
 return page;
}
function event(id,name,x,y,note,pages){return {id,name,note,pages,x,y};}
const hallActive=transferPage(id,5,27,8,.5,0);
hallActive.conditions.variableValid=true;hallActive.conditions.variableId=60;hallActive.conditions.variableValue=2;
const hallInactive=clone(hallActive);hallInactive.conditions=clone(transferTemplate.conditions);hallInactive.trigger=0;hallInactive.list=[{code:0,indent:0,parameters:[]}];
const hallExit=event(7,'88,888,888番通路 手前へ',10,8,'<HM拡大領域:0.5,1.5,1.5,0.5>',[hallInactive,hallActive]);
const roadExit=event(11,'通路 手前へ',0,24,'<HM拡大領域:1.5,0.5,0.5,2.5>',[transferPage(id,18,10,4,.5,.5)]);
const spec={id,name:'88,888,888番通路 手前',parentId:54,image:'!map112',width:21,ref:[1000,1414],
 floors:[
  [[144,490],[192,430],[1008,430],[1008,625],[384,625],[384,1440],[144,1440]],
  [[384,964],[624,964],[668,1008],[716,960],[768,1012],[768,1056],[816,1104],[720,1200],[670,1156],[624,1200],[384,1200]]
 ],blocks:[]};
const map=build(spec);map.displayName='モンスター城';map.events=[null,
 event(1,'幹部廊下へ',5,28,'<HM初期半歩X:+><HM初期半歩Y:+><HM拡大領域:0.5,2.5,2.5,0>',[transferPage(54,10,9,2,0,.5)]),
 event(2,'88,888,888番通路へ',20,10,'<HM初期半歩Y:+><HM拡大領域:2,0,0.5,2>',[transferPage(55,1,23,6,.5,.5)])
];
// The arrow-1 panel is a wall; its original walkable entrance is below it.
const changedRoadTiles=[];
const info={id,expanded:false,name:spec.name,order:63,parentId:54,scrollX:1404,scrollY:768};
const changes=new Map([
 ['data/Map054.json',appendEvents(hallText,[hallExit])],
 ['data/Map055.json',appendEvents(roadText,[roadExit])],
 ['data/MapInfos.json',patchRecords(infoText,[],[info])],
 ['data/System.json',patchKey(systemText,'versionId',system.versionId+1)],
 ['data/Map063.json',JSON.stringify(map)+'\n']
]);
const manifest={mapId:id,name:spec.name,background:map.parallaxName,source:'../画像/!map112.aseprite',size:[21,30],
 transfers:[{from:54,event:7,to:63,requires:'variable 60 >= 2'},{from:63,event:1,to:54},{from:63,event:2,to:55},{from:55,event:11,to:63}],
 floors:spec.floors,changedRoadTiles,versionBefore:system.versionId,versionAfter:system.versionId+1};
if(!process.argv.includes('--write')){console.log(JSON.stringify(manifest,null,2));process.exit(0);}
for(const [p,bytes]of snapshots)assert.ok(fs.readFileSync(path.join(root,p)).equals(bytes),'Concurrent edit: '+p);
const baseline=read('artifacts/road-approach-map-implementation-20261119/baseline.json');
for(const p of ['data/Map054.json','data/Map055.json','data/MapInfos.json','data/System.json'])assert.equal(sha(snapshots.get(p)),baseline.files[p],'Changed since task baseline: '+p);
for(const [p,text]of changes){JSON.parse(text);fs.writeFileSync(path.join(root,p),text,{encoding:'utf8',flag:p==='data/Map063.json'?'wx':'w'});}
fs.writeFileSync(path.join(out,'implementation.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({mapId:id,files:[...changes.keys()],changedRoadTiles:changedRoadTiles.length}));
