const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../../data/Troops.json'),b=fs.readFileSync(file),text=b.toString('utf8'),troops=JSON.parse(text),old=troops[46],next=structuredClone(old);
const page=next.pages[2];assert.equal(page.conditions.enemyHp,25);assert(!page.list.some(c=>String(c.parameters).includes('chaosMoneWave')));
const at=page.list.findIndex(c=>c.code===355&&c.parameters[0].includes('moneBattleSpeaker'));assert(at>0);
page.list.splice(at,0,{code:355,indent:0,parameters:['KNH_CastleUpper.chaosMoneWave(24);']},{code:655,indent:0,parameters:['this.setWaitMode("moneWaveArrange");']});
const token=JSON.stringify(old);assert.equal(text.split(token).length,2);assert(fs.readFileSync(file).equals(b),'Concurrent edit');
const backup=path.resolve(__dirname,'../../artifacts/mone25-wave-20261120/before/Troops.json');fs.mkdirSync(path.dirname(backup),{recursive:true});assert(!fs.existsSync(backup));fs.writeFileSync(backup,b);fs.writeFileSync(file,text.replace(token,JSON.stringify(next)));
console.log('Connected chaotic final wave at HP25, preserving dialogue.');
