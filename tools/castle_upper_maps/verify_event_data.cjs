const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/castle-upper-events-20261118');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const before=f=>JSON.parse(fs.readFileSync(path.join(out,'before',f),'utf8').replace(/^\uFEFF/,''));
const omit=(x,...keys)=>Object.fromEntries(Object.entries(x).filter(([key])=>!keys.includes(key)));
const changes=read('artifacts/castle-upper-events-20261118/changes.json');
for(const f of Object.keys(changes)){
 const a=fs.readFileSync(path.join(out,'before',f),'utf8'),b=fs.readFileSync(path.join(root,f),'utf8');
 assert.equal(b.startsWith('\uFEFF'),a.startsWith('\uFEFF'),'BOM '+f);
 assert.equal(/\r\n/.test(b),/\r\n/.test(a),'Line endings '+f);
 assert.ok(!b.includes('\ufffd'),'Replacement character '+f);
}
for(const id of [59,60,61,62]){const f='data/Map'+String(id).padStart(3,'0')+'.json';assert.deepEqual(omit(read(f),'events'),omit(before(f),'events'),'Background/collision changed: '+f);}
const road=read('data/Map055.json'),oldRoad=before('data/Map055.json');assert.deepEqual(omit(road,'events'),omit(oldRoad,'events'));assert.deepEqual(road.events.slice(0,oldRoad.events.length),oldRoad.events);assert.equal(road.events.length,oldRoad.events.length+1);
for(const [name,owned]of [['Actors',[6]],['Items',[53,54]],['Enemies',[23,24,25]],['Troops',[46,47,48]]]){const f='data/'+name+'.json',a=before(f),b=read(f);for(let i=0;i<a.length;i++)if(!owned.includes(i))assert.deepEqual(b[i],a[i],name+' unrelated record '+i);}
const system=read('data/System.json'),oldSystem=before('data/System.json');assert.deepEqual(omit(system,'variables'),omit(oldSystem,'variables'));assert.deepEqual(system.variables.slice(0,61),oldSystem.variables.slice(0,61));assert.equal(system.variables.length,68);
function plugins(f){let ctx={};vm.runInNewContext(fs.readFileSync(f,'utf8'),ctx);return JSON.parse(JSON.stringify(ctx.$plugins));}
const ps=plugins(path.join(root,'js/plugins.js')),oldPs=plugins(path.join(out,'before/js/plugins.js'));assert.deepEqual(ps.slice(0,oldPs.length),oldPs);assert.equal(ps.at(-1).name,'KNH_ZXC_CastleUpper');assert.equal(ps.at(-1).status,true);
let scripts=0,dialogs=0;
function commands(list){for(let i=0;i<list.length;i++){const cmd=list[i];if(cmd.code===355){let text=cmd.parameters[0];while(list[i+1]?.code===655)text+='\n'+list[++i].parameters[0];new vm.Script('(function(){'+text+'\n})');scripts++;}if(cmd.code===401){assert.ok(!cmd.parameters[0].includes('\u3002'));dialogs++;}if(cmd.code===201){const id=cmd.parameters[1];assert.ok(fs.existsSync(path.join(root,'data/Map'+String(id).padStart(3,'0')+'.json')));}}}
for(const id of [59,60,61,62])for(const e of read('data/Map'+String(id).padStart(3,'0')+'.json').events.filter(Boolean))for(const p of e.pages){commands(p.list);if(p.image.characterName)assert.ok(fs.existsSync(path.join(root,'img/characters',p.image.characterName+'.png')));}
for(const t of read('data/Troops.json').slice(46,49))for(const p of t.pages)commands(p.list);
const gimmick=read('data/Map061.json');assert.ok(gimmick.events.filter(Boolean).every(e=>e.pages.every(p=>!p.image.characterName||p.image.characterName==='$treasure')));
const actor=read('data/Actors.json')[6];assert.equal(actor.battlerName,'castleBeast_tmp');assert.equal(actor.characterName,'$castleBeast_tmp');
const result={unrelatedRecordsPreserved:true,backgroundsAndCollisionPreserved:true,encodingPreserved:true,scriptsParsed:scripts,dialogueLines:dialogs,newVariables:[61,62,63,64,65,66,67],actor:6,keys:[53,54],troops:[46,47,48],gimmickObjects:0};
fs.writeFileSync(path.join(out,'data-verification.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS',JSON.stringify(result));
