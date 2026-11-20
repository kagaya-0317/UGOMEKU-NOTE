// Update only the existing beast event and troop; retain native encounter flow.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const root=path.resolve(__dirname,'../..'),clone=x=>structuredClone(x);
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const js=s=>s.split('\n').map((line,i)=>c(i?655:355,[line]));
const wait=n=>c(230,[n]);
function say(speaker,lines,shout=false){return [...js(speaker+'\n$gameMessage._popupHeight=0;'),c(122,[14,14,0,0,shout?1:0]),c(101,['',0,0,2]),...lines.map(line=>c(401,[line]))];}
const mapSpeaker='KNH_CastleUpper.mapSpeaker(2);',battleSpeaker='KNH_CastleUpper.battleSpeaker("beast");';
const pending=[],file=path.join(root,'data/Map060.json'),before=fs.readFileSync(file),source=before.toString('utf8'),map=JSON.parse(source);
assert.ok(Buffer.from(source).equals(before),'UTF-8 roundtrip');
const boss=clone(map.events[2]),controller=clone(map.events[4]);
assert.equal(controller.pages[0].list.find(cmd=>cmd.code===301).parameters[1],47);
controller.pages[0].list=[
    ...js('KNH_CastleUpper.beginScene(2,true);\nthis.setWaitMode("castleUpperFormation");'),
    ...js('this.setWaitMode("image");'),wait(2),...js('KNH_CastleUpper.focusScene(2,48);'),wait(90),
    ...say(mapSpeaker,['ぐるるるる…']),
    ...say(mapSpeaker,['我は魔王城の番犬','「死の猛獣」なり…']),
    ...say(mapSpeaker,['侵入者どもを','生かしておくわけには','いかぬのじゃ！！'],true),
    ...js('KNH_CastleUpper.clearMessage();'),c(301,[0,47,false,false]),c(222),wait(30),
    ...say(mapSpeaker,['うむ…仕方ない','通行を許可しようぞ']),
    ...say(mapSpeaker,['我々…なんだか','友達になれた気がするのじゃ']),
    ...say(mapSpeaker,['ヘッヘッ…']),
    ...js('KNH_CastleUpper.returnScene();\nthis.setWaitMode("castleUpperReturn");'),
    ...js('KNH_CastleUpper.endScene();'),wait(60),c(0)
];
boss.pages[1].list=[...say(mapSpeaker,['ヘッヘッ…']),...js('KNH_CastleUpper.clearMessage();'),c(0)];
const proxies=map.events.filter(e=>e&&e.note.includes('<castleUpperActor:')).map(e=>{const result=clone(e);result.pages.forEach(p=>p.moveSpeed=4);return result;});assert.equal(proxies.length,2);
const [a,b]=keySpan(source,'events'),updated=source.slice(0,a)+patchRecords(source.slice(a,b),[[2,boss],[4,controller],...proxies.map(e=>[e.id,e])])+source.slice(b);
const saved=JSON.parse(updated),owned=[2,4,...proxies.map(e=>e.id)];
assert.deepEqual(saved.events.filter(e=>e&&!owned.includes(e.id)),map.events.filter(e=>e&&!owned.includes(e.id)));
for(const e of saved.events.filter(Boolean))assert.deepEqual([e.x,e.y],[map.events[e.id].x,map.events[e.id].y]);
pending.push({file,before,after:Buffer.from(updated)});
const dialogue=[wait(30),
    ...say(battleSpeaker,['ぬおッ！？'],true),
    ...say(battleSpeaker,['なぜこちら側に！？','間違えたなり！！'],true),
    ...say(battleSpeaker,['でも…こっち側も','なんだか悪くないのじゃ']),
    ...say(battleSpeaker,['ヘッヘッ…']),
    ...js('KNH_CastleUpper.clearMessage();'),c(122,[64,64,0,0,2]),c(340),c(0)
];
let runtimeTroop;
for(const relative of ['data/Troops.json','data/testData/Test_Troops.json']){
    const troopFile=path.join(root,relative),old=fs.readFileSync(troopFile),text=old.toString('utf8'),troops=JSON.parse(text),troop=clone(runtimeTroop||troops[47]);
    assert.ok(Buffer.from(text).equals(old));assert.equal(troop.pages.length,1);troop.pages[0].list=clone(dialogue);
    pending.push({file:troopFile,before:old,after:Buffer.from(patchRecords(text,[[47,troop]]))});runtimeTroop=troop;
}
for(const list of [controller.pages[0].list,boss.pages[1].list,dialogue]){
    for(let i=0;i<list.length;i++){const command=list[i];if(command.code===401)assert.ok(command.parameters[0].length&&!command.parameters[0].includes('\u3002'));
        if(command.code===355){let script=command.parameters[0];while(list[i+1]?.code===655)script+='\n'+list[++i].parameters[0];new vm.Script('(function(){'+script+'\n})');}}
}
for(const item of pending)assert.ok(fs.readFileSync(item.file).equals(item.before),'Concurrent edit: '+item.file);
for(const item of pending){assert.ok(fs.readFileSync(item.file).equals(item.before));fs.writeFileSync(item.file,item.after);console.log('Updated '+path.relative(root,item.file));}
console.log('Map dialogue:',controller.pages[0].list.filter(c=>c.code===401).map(c=>c.parameters[0]));console.log('Battle dialogue:',dialogue.filter(c=>c.code===401).map(c=>c.parameters[0]));
