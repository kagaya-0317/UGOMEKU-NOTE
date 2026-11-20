// Preserve editor placement; a separate editor-owned marker is the cleared spot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'data/Map060.json'),before=fs.readFileSync(file),text=before.toString('utf8'),map=JSON.parse(text),clone=x=>structuredClone(x);
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
assert.ok(Buffer.from(text).equals(before));assert.ok(!map.events[11],'Retreat marker slot is occupied');
const boss=clone(map.events[2]),controller=clone(map.events[4]),list=controller.pages[0].list;
const permission=list.findIndex(x=>x.code===401&&x.parameters[0]==='通行を許可しようぞ');assert.ok(permission>=0);
const route={repeat:false,skippable:false,wait:true,list:[{code:36,parameters:[]},{code:29,parameters:[4]},{code:31,parameters:[]},{code:45,parameters:['this.goToCharacter($gameMap.event(11));']},{code:18,parameters:[]},{code:32,parameters:[]},{code:35,parameters:[]},{code:0,parameters:[]}]};
list.splice(permission+1,0,c(355,['KNH_CastleUpper.clearMessage();']),c(205,[2,route]),...route.list.slice(0,-1).map(command=>c(505,[clone(command)])),c(122,[64,64,0,0,2]));
// Native map popups follow the beast after it moves to the left-hand edge.
let afterAside=false;
for(const command of list){if(command.code===122&&command.parameters[0]===64)afterAside=true;if(afterAside&&command.code===355&&command.parameters[0]==='KNH_CastleUpper.mapSpeaker(2);')command.parameters[0]+=' $gameMessage._tailDir=1;';}
boss.pages[1].image.direction=6;boss.pages[1].moveSpeed=4;
boss.pages[1].list[0].parameters[0]+=' $gameMessage._tailDir=1;';
// Map 22 event 8 restores completed positions in a per-visit parallel initializer.
// Keep the marker alive: this project's erase() removes the event object entirely.
const reference=JSON.parse(fs.readFileSync(path.join(root,'data/Map022.json'),'utf8')).events[8];
const marker=clone(reference);marker.id=11;marker.name='死の猛獣_退避位置';marker.note='<important><HM初期半歩X:+>';marker.x=2;marker.y=14;delete marker.meta;delete marker.metaArray;
marker.pages=[clone(marker.pages[0])];marker.pages[0].conditions.variableValid=false;marker.pages[0].trigger=0;marker.pages[0].moveType=0;marker.pages[0].through=true;marker.pages[0].list=[c(0)];
const initializer=clone(reference);initializer.id=12;initializer.name='死の猛獣_退避位置復元';initializer.note='<important>';initializer.x=0;initializer.y=0;
initializer.pages=reference.pages.map((page,i)=>{const p=clone(page);p.conditions.variableValid=!!i;p.conditions.variableId=64;p.conditions.variableValue=2;p.moveType=0;p.through=true;p.list=i?[c(355,['var beast=this.character(2);']),c(655,['beast.locateToCharacter(this.character(11));beast.setDirection(6);']),c(214),c(0)]:[c(214),c(0)];return p;});
const [a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[[2,boss],[4,controller]],[marker,initializer])+text.slice(b),saved=JSON.parse(updated);
assert.deepEqual([saved.events[2].x,saved.events[2].y],[map.events[2].x,map.events[2].y]);assert.deepEqual(saved.events[4].pages[0].list.filter(x=>x.code===401),list.filter(x=>x.code===401));
for(const event of map.events.filter(e=>e&&e.id!==2&&e.id!==4))assert.deepEqual(saved.events[event.id],event);
const pending=[{file,before,after:Buffer.from(updated)}];
for(const relative of ['data/Troops.json','data/testData/Test_Troops.json']){const f=path.join(root,relative),old=fs.readFileSync(f),s=old.toString('utf8'),troops=JSON.parse(s),troop=clone(troops[47]),commands=troop.pages[0].list,progress=commands.filter(x=>x.code===122&&x.parameters[0]===64);assert.equal(progress.length,1);troop.pages[0].list=commands.filter(x=>x!==progress[0]);pending.push({file:f,before:old,after:Buffer.from(patchRecords(s,[[47,troop]]))});}
for(const item of pending)assert.ok(fs.readFileSync(item.file).equals(item.before),'Concurrent edit: '+item.file);
for(const item of pending){fs.writeFileSync(item.file,item.after);console.log('Updated '+path.relative(root,item.file));}
console.log('Completion now follows the native walking route; marker restores reentry position');
