const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const part=require('./mone_dialogue.cjs').during[1],file=path.resolve(__dirname,'../../data/Troops.json');
const bytes=fs.readFileSync(file),text=bytes.toString('utf8'),troops=JSON.parse(text),old=troops[46],next=structuredClone(old);
const c=(code,parameters=[],indent=0)=>({code,parameters,indent});
const script=text=>text.split('\n').map((line,i)=>c(i?655:355,[line]));
const list=next.pages[1].list;assert.equal(next.pages[1].conditions.enemyHp,50);
const start=list.findIndex(c=>c.code===355&&c.parameters[0].includes('moneBattleSpeaker'));
const end=list.findIndex(c=>c.code===355&&c.parameters[0].includes('endMoneEvent(2)'));assert(start>=0&&end>start);
const lines=part.lines.flatMap(([who,lines],i)=>{
 const speaker='KNH_CastleUpper.moneBattleSpeaker('+JSON.stringify(who)+')';
 const commands=who==='enemy'?[...script(speaker+';'),c(101,['',0,0,2]),...lines.map(t=>c(401,[t]))]:[c(111,[12,speaker]),c(101,['',0,0,2],1),...lines.map(t=>c(401,[t],1)),c(412)];
 if(i===part.disorderAfter)commands.push(...script('KNH_CastleUpper.disorderMoneWave(24, 2);\nthis.setWaitMode("moneWaveArrange");'));
 if(i===part.alignAfter)commands.push(...script('KNH_CastleUpper.alignMoneWave();\nthis.setWaitMode("moneWaveArrange");'));
 return commands;
});
next.pages[1].list=[...list.slice(0,start),...lines,...list.slice(end)];
const token=JSON.stringify(old);assert.equal(text.split(token).length,2);assert(fs.readFileSync(file).equals(bytes),'Concurrent edit');
const backup=path.resolve(__dirname,'../../artifacts/mone50-dialogue-20261120/before/Troops.json');fs.mkdirSync(path.dirname(backup),{recursive:true});assert(!fs.existsSync(backup));fs.writeFileSync(backup,bytes);fs.writeFileSync(file,text.replace(token,JSON.stringify(next)));
console.log('Updated HP50 dialogue with disorder and alignment beats.');
