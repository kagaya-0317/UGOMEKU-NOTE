const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{keySpan,patchRecords}=require('./implement_events.cjs');
const root=path.resolve(__dirname,'../..');
const pending=['js/plugins/KNH_ZXC_CastleUpper.js','tools/castle_upper_maps/tsunehi_prelude_helpers.txt'].map(name=>{
 const file=path.join(root,name),before=fs.readFileSync(file),text=before.toString('utf8'),nl=text.includes('\r\n')?'\r\n':'\n';
 const old="        // The rear PNG uses the saved cssRect; the original sheets use native cells."+nl+"        ch._cssRect = null;";
 assert.ok(text.includes(old));let updated=text.replace(old,"        // Single-pose PNGs use a fixed cell; the original sheets use native cells."+nl+"        ch._cssRect = pose === 'inject' ? {x: 0, y: 0, width: 288, height: 320} : null;");
 const oldImage="        ch.setImageZXC(pose === 'mad' ? '$kanbu2_2' : '$kanbu2', 0, 2);";
 assert.ok(updated.includes(oldImage));updated=updated.replace(oldImage,"        var image = pose === 'mad' ? '$kanbu2_2' : pose === 'inject' ? '$castleTsunehi_vial_tmp' : '$kanbu2';"+nl+"        ch.setImageZXC(image, 0, 2);");
 const oldPose="        if (pose === 'inject') {"+nl+"            ch.startFrameAnimation([3], 1, false);";
 assert.ok(updated.includes(oldPose));updated=updated.replace(oldPose,"        if (pose === 'inject') {");
 return {file,before,updated};
});
const mapFile=path.join(root,'data/Map062.json'),mb=fs.readFileSync(mapFile),mt=mb.toString('utf8'),map=JSON.parse(mt),event=map.events[5],list=event.pages[0].list;
assert.equal(list[0].parameters[0],'KNH_CastleUpper.beginScene(3, true);');list[0].code=655;list.unshift({code:355,indent:0,parameters:["ImageManager.loadCharacter('$castleTsunehi_vial_tmp');"]});
const[a,b]=keySpan(mt,'events'),mapUpdated=mt.slice(0,a)+patchRecords(mt.slice(a,b),[[5,event]])+mt.slice(b);
for(const p of pending)assert.ok(fs.readFileSync(p.file).equals(p.before),'Concurrent plugin edit');assert.ok(fs.readFileSync(mapFile).equals(mb),'Concurrent map edit');
for(const p of pending)fs.writeFileSync(p.file,p.updated);fs.writeFileSync(mapFile,mapUpdated);console.log('Installed the placeholder vial pose and early preload; other poses and timing retained');
