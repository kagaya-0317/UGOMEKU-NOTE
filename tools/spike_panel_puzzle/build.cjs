// Author editor-owned panels and trap fields without changing artwork/terrain.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/spike-panel-puzzle-20261119');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const nodes=[[15,23],[10.5,23],[4.5,23],[4.5,17],[10.5,17],[15,17],[15,14.5],[10.5,14.5]];
const edges=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[0,5],[1,4],[4,7]];
const command=(code,parameters=[])=>({code,indent:0,parameters});
const script=s=>command(355,[s]);
const conditions=(id,value)=>({actorId:1,actorValid:false,itemId:1,itemValid:false,selfSwitchCh:'A',selfSwitchValid:false,switch1Id:1,switch1Valid:false,switch2Id:1,switch2Valid:false,variableId:id||1,variableValid:!!id,variableValue:value||0});
function page(list=[],opts={}){return{conditions:conditions(),directionFix:true,image:{tileId:0,characterName:'',characterIndex:0,direction:2,pattern:1},list:[...list,command(0)],moveFrequency:3,moveRoute:{list:[{code:0,parameters:[]}],repeat:false,skippable:true,wait:false},moveSpeed:3,moveType:0,priorityType:0,stepAnime:false,through:true,trigger:0,walkAnime:false,...opts};}
function event(id,name,x,y,note,pages){return{id,name,x:Math.floor(x),y:Math.floor(y),note:note+(x%1?'<HM初期半歩X:+>':'')+(y%1?'<HM初期半歩Y:+>':''),pages};}
function message(lines){return[script('KNH_CastleUpper.systemMessage();'),command(101,['',0,0,2]),...lines.map(s=>command(401,[s])),script('KNH_CastleUpper.clearMessage();')];}
function safe(x,y){if(nodes.some(p=>Math.abs(p[0]-x)<=.5&&Math.abs(p[1]-y)<=.5))return true;if(x>=15&&x<=16&&y>=23&&y<=25)return true;return edges.some(([a,b])=>{const p=nodes[a],q=nodes[b];return p[0]===q[0]?Math.abs(x-p[0])<=.5&&y>=Math.min(p[1],q[1])&&y<=Math.max(p[1],q[1]):Math.abs(y-p[1])<=.5&&x>=Math.min(p[0],q[0])&&x<=Math.max(p[0],q[0]);});}
function main(){
 const originals=['data/Map061.json','data/CommonEvents.json','js/plugins.js','AGENTS.md'];
 const snapshot=read('artifacts/spike-panel-puzzle-20261119/baseline.json');
 const revise=process.argv.includes('--revise'),previous=revise?read('artifacts/spike-panel-puzzle-20261119/plan.json'):null;
 const expected={...snapshot.files,...(previous?previous.files:{})};
 for(const file of originals)assert.equal(sha(fs.readFileSync(path.join(root,file))),expected[file],file+' changed during planning');
 const input=file=>revise?path.join(out,'before',file):path.join(root,file);
 const map=JSON.parse(fs.readFileSync(input('data/Map061.json'),'utf8')),ce=JSON.parse(fs.readFileSync(input('data/CommonEvents.json'),'utf8'));assert.equal(ce.length,41);assert.equal(map.events.filter(Boolean).length,4);
 const floor=read('artifacts/spike-panel-puzzle-20261119/floor.json');
 const mask=Array.from({length:floor.h},(_,j)=>Array.from({length:floor.w},(_,i)=>floor.cells[j*floor.w+i]&&!safe(i/2,j/2)));
 const walls=[];
 for(let j=0;j<floor.h;j++)for(let i=0;i<floor.w;i++)if(mask[j][i]){let w=1;while(w<8&&i+w<floor.w&&mask[j][i+w])w++;let h=1;while(h<6&&j+h<floor.h&&mask[j+h].slice(i,i+w).every(Boolean))h++;for(let y=j;y<j+h;y++)for(let x=i;x<i+w;x++)mask[y][x]=false;walls.push({x:i/2,y:j/2,w:w/2,h:h/2,mode:'wall',phase:0});}
 const traps=walls.concat(edges.map(([a,b],i)=>{const p=nodes[a],q=nodes[b],vertical=p[0]===q[0];return vertical?{x:p[0]-.5,y:Math.min(p[1],q[1])+1,w:1.5,h:Math.abs(p[1]-q[1])-1.5,mode:'timed',phase:i%3*85}:{x:Math.min(p[0],q[0])+1,y:p[1]-.5,w:Math.abs(p[0]-q[0])-1.5,h:1.5,mode:'timed',phase:i%3*85};}));
 const intro=page([...message(['パネルは ふむたびに切り替わる','すべてのパネルを つけよう']),command(122,[65,65,0,0,1])],{trigger:3});
 const idle=page([],{conditions:conditions(65,1)});
 const success=page([script('KNH_SpikePanel.releaseCamera();'),script('$gameMap.scrollCameraTo(10, 8, 60);'),command(230,[70]),command(250,[{name:'00_pa',volume:90,pitch:100,pan:0}]),...message(['すべてのパネルが ついた','奥の宝箱が 開けられそうだ']),script('KNH_SpikePanel.restoreCamera();'),command(230,[60]),command(123,['A',0])],{trigger:3,conditions:conditions(65,2)});
 const finished=page([],{conditions:{...conditions(65,2),selfSwitchValid:true}});
 const records=new Map([[1,event(1,'トゲ床パズル_案内とクリア',0,0,'<important>',[intro,idle,success,finished])]]),added=[];
 let next=map.events.length;
 const panelIds=[];nodes.forEach(([x,y],i)=>{const id=next++;panelIds.push(id);const opts={trigger:1,image:{tileId:0,characterName:'$switch',characterIndex:0,direction:2,pattern:1}};const off=page([command(117,[41])],opts),on=page([command(117,[41])],{...opts,conditions:{...conditions(),selfSwitchValid:true},image:{...opts.image,direction:8}});added.push(event(id,'パネル '+(i+1),x,y,'<important><spikePanel><HM拡大領域:0.5,0.5,0.5,0.5><yura><CGShift:A,0,30>',[off,on]));});
 const trapIds=[];traps.forEach((t,i)=>{const id=next++;trapIds.push(id);added.push(event(id,(t.mode==='wall'?'トゲ床_常時 ':'トゲ床_周期 ')+(i+1),t.x,t.y,'<important><spikePanelTrap:'+t.w+','+t.h+','+t.mode+','+t.phase+'>',[page([],{image:{tileId:0,characterName:'$trap',characterIndex:0,direction:6,pattern:0}})]));});
 added.push(event(next++,'トゲ床とパネル_共通監視',0,0,'<important>',[page([script('KNH_SpikePanel.update(this);')],{trigger:4})]));
 let text=fs.readFileSync(input('data/Map061.json'),'utf8');const [a,b]=keySpan(text,'events');text=text.slice(0,a)+patchRecords(text.slice(a,b),records,added)+text.slice(b);const [n,m]=keySpan(text,'note');text=text.slice(0,n)+JSON.stringify(map.note+'<spikePanelPuzzle:65,41>')+text.slice(m);
 const common={id:41,name:'トゲ床パネル_共通切替',trigger:0,switchId:1,list:[script('this.setWaitMode("spikePanelLanding");'),script('KNH_SpikePanel.toggle(this._eventId);'),command(0)]};
 const ct=fs.readFileSync(input('data/CommonEvents.json'),'utf8'),newCommon=patchRecords(ct,new Map(),[common]);
 const pt=fs.readFileSync(input('js/plugins.js'),'utf8'),at=pt.lastIndexOf(']');const entry={name:'KNH_ZXC_Gimmick_SpikePanel',status:true,description:'Shared toggle panels using native spike-floor damage and safe return.',parameters:{}};let end=at;while(/\s/.test(pt[end-1]))end--;const nl=pt.includes('\r\n')?'\r\n':'\n';const plugins=pt.slice(0,end)+','+nl+JSON.stringify(entry)+pt.slice(end);
 const outputs={'data/Map061.json':text,'data/CommonEvents.json':newCommon,'js/plugins.js':plugins};
 for(const [f,value]of Object.entries(outputs)){assert.equal(sha(fs.readFileSync(path.join(root,f))),expected[f],f+' changed concurrently');fs.writeFileSync(path.join(root,f),value,'utf8');}
 const plan={nodes,panelIds,edges,traps:traps.map((t,i)=>({...t,id:trapIds[i]})),commonEvent:41,variable:65,solution:panelIds,clockCycle:255,hitBehavior:'Native first-floor safe return; panel states unchanged',files:Object.fromEntries(Object.entries(outputs).map(([f,t])=>[f,sha(Buffer.from(t))]))};
 fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({panels:panelIds.length,traps:traps.length,walls:walls.length,commonEvent:41}));
}
if(require.main===module)main();module.exports={nodes,edges,safe};
