// Update only the cutscene entry and add its two native map stand-ins.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {partyProxies,keySpan,patchRecords}=require('./implement_events.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/castle-upper-party-staging-20261118');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const pending=[];
for(const id of [59,60,62]){
 const file='data/Map'+String(id).padStart(3,'0')+'.json',bytes=fs.readFileSync(path.join(root,file)),text=bytes.toString('utf8'),data=JSON.parse(text.replace(/^\uFEFF/,''));
 const records=[];
 for(const event of data.events.filter(Boolean)){
  const changed=JSON.parse(JSON.stringify(event));let modified=false;
  for(const p of changed.pages){
   const index=p.list.findIndex(c=>c.code===355&&/^KNH_CastleUpper\.beginScene\(\d+\);$/.test(c.parameters[0]));
   if(index<0)continue;
   if(p.list[index+1]?.code===655&&p.list[index+1].parameters[0].includes('castleUpperFormation'))continue;
   assert.equal(p.list[index+1].code,217,'Unexpected gather command');assert.equal(p.list[index+2].code,216,'Unexpected hide command');
   const eventId=Number(p.list[index].parameters[0].match(/\((\d+)\)/)[1]),indent=p.list[index].indent;
   p.list.splice(index,3,{code:355,indent,parameters:['KNH_CastleUpper.beginScene('+eventId+');']},{code:655,indent,parameters:['this.setWaitMode("castleUpperFormation");']},{code:355,indent,parameters:['KNH_CastleUpper.focusScene('+eventId+');']});modified=true;
  }
  if(modified)records.push([event.id,changed]);
 }
 const exists=data.events.filter(e=>e&&e.note.includes('<castleUpperActor:')).length;
 assert.ok(exists===0||exists===2,'Unexpected stand-in count');
 if(id===62&&exists&&process.argv.includes('--adjust-throne')){
  for(const e of data.events.filter(e=>e&&e.note.includes('<castleUpperActor:'))){
   assert.ok(e.y===16||e.y===13,'Throne stand-in was edited externally');
   if(e.y===16)records.push([e.id,{...e,y:13}]);
  }
 }
 const added=exists?[]:partyProxies(id,data.events.length);
 const[a,b]=keySpan(text,'events'),next=text.slice(0,a)+patchRecords(text.slice(a,b),records,added)+text.slice(b);
 const parsed=JSON.parse(next.replace(/^\uFEFF/,''));assert.equal(parsed.events.filter(e=>e&&e.note.includes('<castleUpperActor:')).length,2);
 pending.push({file,bytes,next,records:records.map(x=>x[0]),added:added.map(e=>e.id)});
}
for(const p of pending){assert.ok(fs.readFileSync(path.join(root,p.file)).equals(p.bytes),'Concurrent map edit: '+p.file);const backup=path.join(out,'before',p.file);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,p.bytes,{flag:'wx'});}
const manifestFile=path.join(root,'artifacts/castle-upper-events-20261118/changes.json'),manifestBytes=fs.readFileSync(manifestFile),manifest=JSON.parse(manifestBytes);
for(const p of pending){assert.ok(fs.readFileSync(path.join(root,p.file)).equals(p.bytes),'Concurrent map edit: '+p.file);fs.writeFileSync(path.join(root,p.file),p.next);manifest[p.file].after=sha(Buffer.from(p.next));}
assert.ok(fs.readFileSync(manifestFile).equals(manifestBytes),'Concurrent manifest edit');fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(out,'changes.json'),JSON.stringify(pending.map(p=>({file:p.file,before:sha(p.bytes),after:sha(Buffer.from(p.next)),controllers:p.records,addedEvents:p.added})),null,2)+'\n');
console.log('Updated party staging: '+pending.map(p=>p.file).join(', '));
