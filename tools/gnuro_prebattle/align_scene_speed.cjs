// Match maps 51/53: preserve player speed and use editor-authored proxy speed 4.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const file=path.resolve(__dirname,'../../data/Map054.json'),before=fs.readFileSync(file),source=before.toString('utf8'),map=JSON.parse(source);
assert.ok(Buffer.from(source).equals(before),'UTF-8 roundtrip');
const records=[3,5,6].map(id=>structuredClone(map.events[id]));
const begin=records[0].pages[0].list.filter(c=>c.code===355&&c.parameters[0]==='KNH_CastleUpper.beginScene(1);');assert.equal(begin.length,1);
begin[0].parameters[0]='KNH_CastleUpper.beginScene(1,true);';
for(const e of records.slice(1)){assert.ok(e.note.includes('castleUpperActor'));for(const p of e.pages)p.moveSpeed=4;}
const [a,b]=keySpan(source,'events'),output=source.slice(0,a)+patchRecords(source.slice(a,b),records.map(e=>[e.id,e]))+source.slice(b),saved=JSON.parse(output);
assert.deepEqual(saved.events[3].pages[0].list.filter(c=>c.code===401),map.events[3].pages[0].list.filter(c=>c.code===401));
for(const e of records)assert.deepEqual([saved.events[e.id].x,saved.events[e.id].y],[map.events[e.id].x,map.events[e.id].y]);
assert.ok(fs.readFileSync(file).equals(before),'Concurrent map edit');fs.writeFileSync(file,output);console.log('Preserved hero speed; companion editor speeds now 4');
