const fs=require('node:fs'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('./implement_events.cjs');
function patch(file,id,change){const b=fs.readFileSync(file),t=b.toString('utf8'),m=JSON.parse(t),e=m.events[id];change(e);const[a,z]=keySpan(t,'events');assert.ok(fs.readFileSync(file).equals(b));fs.writeFileSync(file,t.slice(0,a)+patchRecords(t.slice(a,z),[[id,e]])+t.slice(z));}
patch('data/Map060.json',8,e=>e.pages[0].list.forEach(c=>{if(c.code===355&&c.parameters[0]==='KNH_CastleUpper.systemMessage();')c.parameters[0]+=' $gameMessage._popupHeight = 0;';}));
patch('data/Map062.json',6,e=>{e.pages[0].priorityType=1;e.pages[0].through=false;});
const file='js/plugins/KNH_ZXC_CastleUpper.js',b=fs.readFileSync(file),t=b.toString('utf8');assert.ok(t.includes('scrollCameraTo(gate.x, gate.y - 1, 60)'));assert.ok(fs.readFileSync(file).equals(b));fs.writeFileSync(file,t.replace('scrollCameraTo(gate.x, gate.y - 1, 60)','scrollCameraTo(gate.x, gate.y, 60)'));
