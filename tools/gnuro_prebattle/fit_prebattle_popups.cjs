// Apply native text sizing to the map introduction, as in the postbattle scene.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const file=path.resolve(__dirname,'../../data/Map054.json'),before=fs.readFileSync(file),source=before.toString('utf8'),map=JSON.parse(source),event=structuredClone(map.events[3]);
assert.ok(Buffer.from(source).equals(before),'UTF-8 roundtrip');
const commands=event.pages[0].list.filter(c=>c.code===355&&c.parameters[0]==='KNH_CastleUpper.mapSpeaker(1);');assert.equal(commands.length,1);
commands[0].parameters[0]+=' $gameMessage._popupHeight=0;';
const [a,b]=keySpan(source,'events'),output=source.slice(0,a)+patchRecords(source.slice(a,b),[[3,event]])+source.slice(b);
assert.deepEqual(JSON.parse(output).events[3].pages[0].list.filter(c=>c.code===401),map.events[3].pages[0].list.filter(c=>c.code===401));
assert.ok(fs.readFileSync(file).equals(before),'Concurrent map edit');fs.writeFileSync(file,output);console.log('Prebattle introduction now uses native text sizing');
