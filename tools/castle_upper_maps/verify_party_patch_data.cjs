const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/castle-upper-party-staging-20261118');
const omit=(x,key)=>Object.fromEntries(Object.entries(x).filter(([k])=>k!==key));
for(const id of [59,60,62]){
 const f='data/Map'+String(id).padStart(3,'0')+'.json',before=JSON.parse(fs.readFileSync(path.join(out,'before',f))),after=JSON.parse(fs.readFileSync(path.join(root,f)));
 assert.deepEqual(omit(after,'events'),omit(before,'events'),'Map background/collision changed');
 for(const event of before.events.filter(Boolean)){
  const next=after.events[event.id];
  if(event.pages.some(p=>p.list.some(c=>c.code===355&&String(c.parameters[0]).startsWith('KNH_CastleUpper.beginScene(')))){
   assert.deepEqual(omit(next,'pages'),omit(event,'pages'));assert.equal(next.pages.length,event.pages.length);
   next.pages.forEach((p,i)=>{assert.deepEqual(omit(p,'list'),omit(event.pages[i],'list'));if(i===0)assert.deepEqual(p.list.slice(3),event.pages[i].list.slice(3));else assert.deepEqual(p.list,event.pages[i].list);});
  }else assert.deepEqual(next,event,'Unrelated event changed: '+id+'/'+event.id);
 }
 const proxies=after.events.filter(e=>e&&e.note.includes('<castleUpperActor:'));
 assert.equal(proxies.length,2);assert.equal(after.events.length,before.events.length+2);
 proxies.forEach(e=>{for(const p of e.pages)for(const command of p.moveRoute.list)assert.ok(!JSON.stringify(command).match(/locate|goTo|setPosition/),'Position reset in initial route');});
}
console.log('PASS: only 3 encounter entries and 6 party stand-ins changed; all existing placements and progression preserved.');
