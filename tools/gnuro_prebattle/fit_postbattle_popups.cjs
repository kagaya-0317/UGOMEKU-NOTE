// Keep the shared fixed-height presentation; size only this short exchange to text.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const file=path.resolve(__dirname,'../../data/Map054.json'),before=fs.readFileSync(file),source=before.toString('utf8'),map=JSON.parse(source),event=structuredClone(map.events[3]);
assert.ok(Buffer.from(source).equals(before));
let changed=0;
for(const command of event.pages[0].list){
    if(command.code===355&&/^KNH_CastleUpper\.mapSpeaker\([56]\);$/.test(command.parameters[0])){
        command.parameters[0]+=' $gameMessage._popupHeight=0;';changed++;
    }
}
assert.equal(changed,3,'Expected three postbattle bubbles');
const [a,b]=keySpan(source,'events'),output=source.slice(0,a)+patchRecords(source.slice(a,b),[[3,event]])+source.slice(b);
assert.deepEqual(JSON.parse(output).events[3].pages[0].list.filter(c=>c.code===401),map.events[3].pages[0].list.filter(c=>c.code===401));
assert.ok(fs.readFileSync(file).equals(before),'Concurrent map edit');fs.writeFileSync(file,output);console.log('Sized three postbattle bubbles to their actual text; dialogue unchanged');
