// Use the existing castle staging helpers and patch only the owned records.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords,stageParty}=require('../castle_upper_maps/implement_events.cjs');
const root=path.resolve(__dirname,'../..');
const clone=x=>JSON.parse(JSON.stringify(x));
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const js=text=>text.split('\n').map((s,i)=>c(i?655:355,[s]));
const wait=n=>c(230,[n]);
const message=lines=>[c(101,['',0,0,2]),...lines.map(s=>c(401,[s]))];
const file=path.join(root,'data/Map054.json'),before=fs.readFileSync(file),text=before.toString('utf8'),map=JSON.parse(text);
assert.ok(Buffer.from(text).equals(before),'UTF-8 roundtrip');
assert.ok(map.events[5]==null&&map.events[6]==null,'Stand-in event IDs are occupied');
const boss=clone(map.events[1]),controller=clone(map.events[3]);
if(!boss.note.includes('<important>'))boss.note+='<important>';
assert.equal(controller.pages[0].list[3].code,230,'Expected empty prebattle placeholder');
const condition={...clone(controller.pages[0].conditions),variableId:60,variableValue:2,variableValid:true};
const completed=clone(controller.pages[1]);
const bossDone=clone(boss.pages[0]);bossDone.conditions=clone(condition);bossDone.image={tileId:0,characterName:'',characterIndex:0,direction:2,pattern:0};bossDone.priorityType=0;bossDone.through=true;bossDone.list=[c(0)];
boss.pages.push(bossDone);
boss.pages[0].list=[c(122,[60,60,0,0,1]),c(0)];
const stage=stageParty(1);stage.splice(2,0,...js("this.setWaitMode('image');"),wait(2));
const list=[...clone(controller.pages[0].list.slice(0,3)),c(108,['Progress 60: 0 waiting, 1 introduction/battle, 2 defeated']),...stage,...js('KNH_CastleUpper.mapSpeaker(1);')];
function say(lines,tone=0){list.push(c(122,[14,14,0,0,tone]),...message(lines));}
function pose(cells,waitFrames=9){list.push(...js('$gameMap.event(1).startFrameAnimation('+JSON.stringify(cells)+','+waitFrames+',true);'));}
function idle(){list.push(...js("var boss=$gameMap.event(1);\nboss.endFrameAnimation();boss._patternFix=false;boss.setImageZXC('$kanbu1',0,2);"));}
say(['ワシは幹部','グミ・グヌロッベン！']);
say(['ワシは四天王の中でも、','最強の腕力を持つ男…']);
say(['この先へ進みたければ…','ワシを倒していくの！？']);
pose([3,4,5],10);
say(['クックック…']);
say(['ワーッハッハッハ！'],1);
say(['ドワッハッハッハ！'],1);
say(['ドワーッハッハッハ！'],1);
say(['ブワッハッハッハ！'],1);
idle();list.push(wait(18));
say(['おっと、失礼しました']);
say(['では、改めまして…']);
pose([6,7,8],8);
say(['ワシのこの斧で、','みじん切りにしてくれるわ！！'],1);
idle();
list.push(...js('KNH_CastleUpper.clearMessage();\n$gameTemp._gnuroMapIntro=true;'),c(301,[0,43,false,false]),c(222),wait(30),c(122,[60,60,0,0,2]),...js('delete $gameTemp._gnuroMapIntro;\nKNH_CastleUpper.endScene();'),wait(60),c(0));
controller.pages[0].list=list;controller.pages[1]=completed;
const upper=JSON.parse(fs.readFileSync(path.join(root,'data/Map059.json'),'utf8'));
const proxies=[3,4].map((actor,i)=>{
    const source=upper.events.find(e=>e&&e.note.includes('<castleUpperActor:'+actor+'>'));
    assert.ok(source);const event=clone(source);delete event.meta;delete event.metaArray;
    event.id=5+i;event.name=i?'ゆめちゃん（演出）':'みぃー（演出）';event.x=i?11:8;event.y=16;
    event.note='<important><castleUpperActor:'+actor+'><HM初期半歩X:+>';
    const page=event.pages[0];page.list=[c(0)];page.moveType=0;page.moveSpeed=3;page.moveRoute={list:[{code:0,parameters:[]}],repeat:false,skippable:true,wait:false};
    return event;
});
const [start,end]=keySpan(text,'events');
const updated=text.slice(0,start)+patchRecords(text.slice(start,end),[[1,boss],[3,controller],...proxies.map(e=>[e.id,e])])+text.slice(end);
const saved=JSON.parse(updated);assert.deepEqual(saved.events[2],map.events[2]);assert.deepEqual(saved.events[4],map.events[4]);assert.deepEqual(saved.data,map.data);assert.deepEqual([saved.events[1].x,saved.events[1].y],[10,13]);
assert.ok(saved.events[3].pages[0].list.filter(x=>x.code===401).every(x=>!x.parameters[0].includes('\u3002')));
const pending=[{file,before,after:Buffer.from(updated)}];
for(const relative of ['data/Troops.json','data/testData/Test_Troops.json']){
    const troopFile=path.join(root,relative),old=fs.readFileSync(troopFile),source=old.toString('utf8'),troop=JSON.parse(source)[43],oldBytes=Buffer.from(JSON.stringify(troop));
    assert.ok(!JSON.stringify(troop.pages[0]).includes('_gnuroMapIntro'),'Already patched');
    troop.pages[0].list.unshift(c(111,[12,'$gameTemp._gnuroMapIntro === true']),c(355,['delete $gameTemp._gnuroMapIntro;'],1),c(115,[],1),c(412));
    const at=old.indexOf(oldBytes);assert.ok(at>=0);assert.equal(old.indexOf(oldBytes,at+1),-1);
    pending.push({file:troopFile,before:old,after:Buffer.concat([old.subarray(0,at),Buffer.from(JSON.stringify(troop)),old.subarray(at+oldBytes.length)])});
}
for(const item of pending)assert.ok(fs.readFileSync(item.file).equals(item.before),'Concurrent edit: '+item.file);
for(const item of pending){assert.ok(fs.readFileSync(item.file).equals(item.before));fs.writeFileSync(item.file,item.after);JSON.parse(fs.readFileSync(item.file,'utf8'));console.log('Updated '+path.relative(root,item.file));}
console.log('Saved dialogue:',list.filter(x=>x.code===401).map(x=>x.parameters[0]));
