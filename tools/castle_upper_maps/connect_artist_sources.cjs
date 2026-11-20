const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'artist_sources.json'),'utf8'));
for(const a of plan.assets){if(!fs.existsSync(a.runtime))fs.copyFileSync(a.proof,a.runtime);}
function edit(file,fn){file=path.join(root,file);const bytes=fs.readFileSync(file),old=bytes.toString('utf8');let next=fn(old);assert.notEqual(next,old,'No changes: '+file);assert(fs.readFileSync(file).equals(bytes),'Concurrent edit: '+file);fs.writeFileSync(file,next);}
function record(text,old,next){const token=JSON.stringify(old);assert.equal(text.split(token).length,2,'Record must match once');return text.replace(token,JSON.stringify(next));}
if(!process.argv.includes('--plugin-only')){
edit('data/Map060.json',text=>{const map=JSON.parse(text);for(const id of [2,8]){const old=map.events[id],next=structuredClone(old);for(const p of next.pages)p.image.characterName=id===2?'$castleBeast':'castleThroneDoor';text=record(text,old,next);}return text;});
edit('data/Map062.json',text=>{const map=JSON.parse(text);let old=map.events[3],next=structuredClone(old);next.note=next.note.replace('<cssRect:0,0,288,320>','');next.pages[0].image.characterName='$castleTsunehi';text=record(text,old,next);old=map.events[5];next=structuredClone(old);for(const p of next.pages)for(const c of p.list)if(c.code===355||c.code===655)c.parameters=c.parameters.map(v=>typeof v==='string'?v.replaceAll('$castleTsunehi_vial_tmp','$castleTsunehi'):v);return record(text,old,next);});
edit('data/Actors.json',text=>{const data=JSON.parse(text),old=data[6],next=structuredClone(old);next.characterName='$castleBeast';next.battlerName='castleBeast';return record(text,old,next);});
}
edit('js/plugins/KNH_ZXC_CastleUpper.js',text=>{
 text=text.replace('The throne gate reuses the closed leaves and open arch in outsideObject3.','The throne gate uses its dedicated closed-leaves/open-arch artwork.');
 assert.equal(text.split("ImageManager.loadCharacter('outsideObject3')").length,2);text=text.replace("ImageManager.loadCharacter('outsideObject3')","ImageManager.loadCharacter('castleThroneDoor')");
 text=text.replace('// Single-pose PNGs use a fixed cell; the original sheets use native cells.','// All map poses use native 3-by-4 character-sheet cells.');
 text=text.replace("ch._cssRect = pose === 'inject' ? {x: 0, y: 0, width: 288, height: 320} : null;","ch._cssRect = null;");
 text=text.replace("var image = pose === 'mad' ? '$kanbu2_2' : pose === 'inject' ? '$castleTsunehi_vial_tmp' : '$kanbu2';","var image = '$castleTsunehi';");
 text=text.replace(/if \(pose === 'inject'\) \{(\r?\n)            ch.startShiverX\(\);/,(_,nl)=>"if (pose === 'inject') {"+nl+'            ch.startFrameAnimation([3, 4, 5], 6, true);'+nl+'            ch.startShiverX();');
 text=text.replace(/(\} else if \(pose === 'mad'\) \{\r?\n            )ch.startFrameAnimation\(\[3, 4, 5\], 6, true\);/,'$1ch.startFrameAnimation([6, 7, 8], 6, true);');
 text=text.replace('ch.startFrameAnimation([5], 1, false);','ch.startFrameAnimation([10], 1, false);');
 assert(text.includes('ch.startFrameAnimation([6, 7, 8], 6, true);'));assert(text.includes('ch.startFrameAnimation([10], 1, false);'));return text;
});
console.log('Connected dedicated gate, beast and native Tsunehi character sheet.');
