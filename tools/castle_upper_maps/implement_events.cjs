// Patch only owned JSON fields/records, preserving all other bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'artifacts/castle-upper-events-20261118');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const loaded=new Map();
function source(file){if(!loaded.has(file)){const b=fs.readFileSync(path.join(root,file));loaded.set(file,{bytes:b,text:b.toString('utf8'),data:JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''))});}return loaded.get(file);}
const read=n=>source('data/'+n+'.json').data;
function valueEnd(t,s){if(t[s]==='"'){for(let i=s+1;i<t.length;i++){if(t[i]==='\\')i++;else if(t[i]==='"')return i+1;}throw Error('String');}if(t[s]==='['||t[s]==='{'){const stack=[t[s]];let i=s+1;while(stack.length){if(t[i]==='"')i=valueEnd(t,i);else {if(t[i]==='['||t[i]==='{')stack.push(t[i]);else if(t[i]===']'||t[i]==='}')stack.pop();i++;}}return i;}let i=s;while(i<t.length&&!/[\s,}\]]/.test(t[i]))i++;return i;}
function arraySpans(t,start){let i=start+1,res=[];while(true){while(/[\s,]/.test(t[i]))i++;if(t[i]===']')return {spans:res,close:i};let e=valueEnd(t,i);res.push([i,e]);i=e;}}
function keySpan(t,key){const re=new RegExp('"'+key+'"\\s*:\\s*','g'),m=re.exec(t);assert.ok(m,key);return [re.lastIndex,valueEnd(t,re.lastIndex)];}
function replaceKey(t,key,value){const [s,e]=keySpan(t,key);return t.slice(0,s)+JSON.stringify(value)+t.slice(e);}
function patchRecords(t,changes,append=[]){const start=t.indexOf('['),a=arraySpans(t,start);for(const [i,v]of [...changes].sort((a,b)=>b[0]-a[0])){const [s,e]=a.spans[i];t=t.slice(0,s)+JSON.stringify(v)+t.slice(e);}if(append.length){const b=arraySpans(t,t.indexOf('[')),nl=t.includes('\r\n')?'\r\n':'\n';let at=b.close;while(/\s/.test(t[at-1]))at--;t=t.slice(0,at)+','+nl+append.map(v=>JSON.stringify(v)).join(','+nl)+t.slice(at);}return t;}
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const js=(text,indent=0)=>text.split('\n').map((l,i)=>c(i?655:355,[l],indent));
const variable=(id,n,indent=0)=>c(122,[id,id,0,0,n],indent);
const wait=n=>c(230,[n]);
const se=name=>c(250,[{name,volume:90,pitch:100,pan:0}]);
const message=(lines,indent=0)=>[c(101,['',0,0,2],indent),...lines.map(l=>c(401,[l],indent))];
const end=c(0);
const base=clone(read('Map054').events[1].pages[0]);
function page(list=[],options={}){const p=clone(base);p.list=[...list,end];p.image={tileId:0,characterName:'',characterIndex:0,direction:2,pattern:0};p.priorityType=0;p.trigger=0;p.through=true;p.walkAnime=false;p.directionFix=true;p.moveType=0;p.moveRoute={list:[{code:0,parameters:[]}],repeat:false,skippable:true,wait:false};Object.assign(p,options);return p;}
function cond(id,value=1){return {...clone(base.conditions),variableValid:true,variableId:id,variableValue:value};}
const blank=(id,value=1)=>page([],{conditions:cond(id,value)});
function event(id,name,x,y,pages,note=''){return {id,name,note,pages,x,y};}
function solid(list,image,extra={}){return page(list,{priorityType:1,through:false,image:{tileId:0,characterName:image,characterIndex:0,direction:2,pattern:0},...extra});}
function system(lines,indent=0){return [...js('KNH_CastleUpper.systemMessage();',indent),...message(lines,indent),...js('KNH_CastleUpper.clearMessage();',indent)];}
function speaker(id,lines,indent=0){return [...js('KNH_CastleUpper.mapSpeaker('+id+');',indent),...message(lines,indent)];}
function battleSpeaker(who,lines,indent=0){return [...js('KNH_CastleUpper.battleSpeaker('+JSON.stringify(who)+');',indent),...message(lines,indent)];}
function transfer(map,x,y,d,from){return [...(from?[c(122,[3,3,0,4,JSON.stringify(from)]),c(117,[7])]:[]),...js('KNH_CastleUpper.clearMessage();'),c(117,[1]),c(201,[0,map,Math.floor(x),Math.floor(y),d,2]),...((x%1||y%1)?js('$gamePlayer.shiftPos('+x%1+','+y%1+');'):[]),c(222)];}
function savePair(varId,x,y,right){const s=clone(read('Map015').events[18]),h=clone(read('Map015').events[19]);delete s.meta;delete s.metaArray;delete h.meta;delete h.metaArray;s.x=x;s.y=y;s.note='<TE:save><save:'+varId+'>';h.x=right?x+3:3;h.y=right?y-1:y;h.note=right?'<husen><important><noYura><CGShift:A,200,30><CGScale:A,80,80>':'<husen><important><noYura><CGShift:A,-200,30><CGScale:A,-80,80>';h.pages[0].conditions.variableId=varId;return [s,h];}
function stageParty(eventId){return [...js('KNH_CastleUpper.beginScene('+eventId+');\nthis.setWaitMode("castleUpperFormation");'),...js('KNH_CastleUpper.focusScene('+eventId+');'),wait(90)];}
function bossController(variableId,eventId,troopId,before,after){return [page([...stageParty(eventId),...speaker(eventId,before),...js('KNH_CastleUpper.clearMessage();'),c(301,[0,troopId,false,false]),c(222),wait(30),...speaker(eventId,after),variable(variableId,2),...js('KNH_CastleUpper.endScene();'),wait(60)],{conditions:cond(variableId),trigger:3}),blank(variableId,2)];}
function partyProxies(mapId,startId){
 const positions={59:[[8.5,18.5],[11.5,18.5]],60:[[4.5,17],[6.5,17]],62:[[8.5,13.5],[11.5,13.5]]}[mapId];
 return positions.map(([x,y],i)=>{const e=clone(read('Map053').events[5+i]);delete e.meta;delete e.metaArray;e.id=startId+i;e.name=i?'ゆめちゃん（演出）':'みぃー（演出）';e.x=Math.floor(x);e.y=Math.floor(y);e.note='<important><castleUpperActor:'+(3+i)+'>'+(x%1?'<HM初期半歩X:+>':'')+(y%1?'<HM初期半歩Y:+>':'');e.pages[0].moveSpeed=3;e.pages[0].moveType=0;return e;});
}
function trigger(id,name,x,y,varId,note){return event(id,name,x,y,[page([variable(varId,1)],{trigger:1}),blank(varId)],'<important>'+note);}
function chest(id,name,x,y,itemId,flag){const e=clone(read('Map015').events[17]);e.id=id;e.name=name;e.x=x;e.y=y;e.pages[0].list=e.pages[0].list.map(v=>clone(v));const script=e.pages[0].list.find(v=>v.code===355&&v.parameters[0].includes('var item ='));script.parameters[0]='var item = $dataItems['+itemId+'];';delete e.meta;delete e.metaArray;const open=e.pages[1];open.conditions.variableValid=true;open.conditions.variableId=flag;open.conditions.variableValue=2;open.conditions.selfSwitchValid=true;const locked=solid(system(['まだ開けられない']), '$treasure');const ready=e.pages[0];ready.conditions=cond(flag,2);e.pages=[locked,ready,open];return e;}
function mone(){const ev=[null];const [s,h]=savePair(61,13,25,true);s.id=1;h.id=2;ev.push(s,h);
 ev.push(event(3,'モーネ',10,15,[solid([], '$kanbu3'),blank(63,2)],'<cssRect:160,0,160,160><yura>'));
 ev.push(trigger(4,'_モーネ起動',10,20,63,'<HM拡大領域:0,8,8,0.5>'));
 ev.push(event(5,'モーネ戦_自動実行',0,0,bossController(63,3,46,['この先へ行きたいの？','じゃあ 相手をしてあげる'],['…いいわ','階段を上がりなさい']),'<important>'));
 ev.push(event(6,'3Fへの階段',10,5,[page(system(['先にモーネを倒そう']),{trigger:1}),page(transfer(60,14.5,25,8),{conditions:cond(63,2),trigger:1})],'<HM初期半歩Y:+><HM拡大領域:0.5,1.5,1.5,0.5>'));
 ev.push(event(7,'88888888道路へ',3,24,[page(transfer(55,19,10,4),{trigger:1})],'<HM初期半歩Y:+><HM拡大領域:0.5,0.5,0.5,0.5>'));
 ev.push(...partyProxies(59,ev.length));return ev;
}
function third(){const ev=[null];
 ev.push(event(1,'2Fへの階段',14,26,[page(transfer(59,10,7.5,2),{trigger:1})],'<HM初期半歩X:+><HM拡大領域:0.5,1.5,1.5,0>'));
 ev.push(event(2,'死の猛獣',5,14,[solid([variable(64,1)],'$castleBeast_tmp'),solid([...speaker(2,['わふ']),...js('KNH_CastleUpper.clearMessage();')], '$castleBeast_tmp',{conditions:cond(64,2)})],'<yura><CGScale:A,110,110>'));
 ev.push(trigger(3,'_死の猛獣起動',6,18,64,'<HM拡大領域:0,2,2,0.5>'));
 ev.push(event(4,'死の猛獣_自動実行',0,0,[page([...stageParty(2),...speaker(2,['ぐるる…']),...js('KNH_CastleUpper.clearMessage();'),c(301,[0,47,false,false]),c(222),...js('KNH_CastleUpper.endScene();'),wait(60)],{conditions:cond(64),trigger:3}),blank(64,2)],'<important>'));
 ev.push(chest(5,'まるい鍵の宝箱',6,11,53,64));
 ev.push(event(6,'最終ギミック入口 B1',37,11,[page(transfer(61,15.5,24.5,8,[37,12.5,8]),{trigger:1,priorityType:1,through:false})],'<HM拡大領域:0.5,1,1,0.5>'));
 ev.push(event(7,'最終ギミック出口 B2',32,11,[page(system(['向こう側から開ける扉だ']),{priorityType:1,through:false,trigger:1}),page(transfer(61,4,24.5,8,[32,12.5,8]),{conditions:cond(65,2),priorityType:1,through:false,trigger:1})],'<HM拡大領域:0.5,1,1,0.5>'));
 const unlock=[c(111,[12,'$gameParty.hasItem($dataItems[53]) && $gameParty.hasItem($dataItems[54])']),...system(['2つの鍵を使った'],1),c(126,[53,1,0,1],1),c(126,[54,1,0,1],1),variable(66,1,1),{...se('Door2'),indent:1},...transfer(62,10,25.5,8,[25.5,12.5,8]).map(v=>({...v,indent:1})),c(411),...system(['鍵穴が2つある','まるい鍵と さんかくの鍵が必要だ'],1),c(412)];
 ev.push(event(8,'玉座の間_二鍵の大扉',25,11,[solid(unlock,'outsideObject3',{trigger:1}),page(transfer(62,10,25.5,8,[25.5,12.5,8]),{conditions:cond(66),trigger:1})],'<HM初期半歩X:+><HM拡大領域:0.5,2.5,2.5,0><CGOrigin:A,50,100><CGScale:A,180,180><cssRect:0,0,192,192><yura>'));
 ev.push(...partyProxies(60,ev.length));return ev;
}
function gimmick(){const ev=[null];
 ev.push(event(1,'最終ギミック_仮成功',0,0,[page([...system(['（仮）ギミック成功']),se('00_pa'),variable(65,2),...js('KNH_CastleUpper.refreshEvents();')],{trigger:3}),blank(65,2)],'<important>'));
 ev.push(chest(2,'さんかくの鍵の宝箱',10,8,54,65));
 ev.push(event(3,'3Fへ B1',15,25,[page(transfer(60,37,12.5,2),{trigger:1})],'<HM初期半歩X:+><HM拡大領域:0.5,1,1,0>'));
 ev.push(event(4,'3Fへ B2',4,25,[page(transfer(60,32,12.5,2),{conditions:cond(65,2),trigger:1})],'<HM拡大領域:0.5,1,1,0>'));
 return ev;
}
function throne(){const ev=[null];const[s,h]=savePair(62,5,24,false);s.id=1;h.id=2;ev.push(s,h);
 ev.push(event(3,'ツネヒ',10,10,[solid([], '$kanbu2'),blank(67,2)],'<cssRect:0,0,288,320><CGScale:A,65,65><yura>'));
 ev.push(trigger(4,'_ツネヒ起動',10,18,67,'<HM拡大領域:0,8,8,0.5>'));
 ev.push(event(5,'ツネヒ戦_自動実行',0,0,bossController(67,3,48,['よく ここまで来たな','さあ 始めようか'],['…ここまで やるとはな']),'<important>'));
 ev.push(event(6,'3Fへ',10,26,[page(transfer(60,25.5,13.5,2),{trigger:1})],'<HM拡大領域:0.5,1,1,0>'));
 ev.push(...partyProxies(62,ev.length));return ev;
}
function database(changes){
 let systemData=source('data/System.json');let variables=clone(systemData.data.variables);const labels=['[save]モーネ前','[save]ツネヒ前','[ev]モーネ戦','[ev]死の猛獣','[ev]最終ギミック','[ev]玉座の扉','[ev]ツネヒ戦'];labels.forEach((s,i)=>{assert.ok(!variables[61+i]||variables[61+i]===s,'Variable used: '+(61+i));variables[61+i]=s;});changes.set('data/System.json',replaceKey(systemData.text,'variables',variables));
 const actor={...clone(read('Actors')[5]),id:6,name:'死の猛獣',battlerName:'castleBeast_tmp',characterName:'$castleBeast_tmp',note:'<castleUpperGuest>',profile:'3Fの仮ゲストアクター'};let actors=source('data/Actors.json');assert.ok(!actors.data[6]||actors.data[6].note==='<castleUpperGuest>');changes.set('data/Actors.json',actors.data[6]?patchRecords(actors.text,[[6,actor]]):patchRecords(actors.text,[],[actor]));
 const items=[53,54].map((id,i)=>({...clone(read('Items')[53]),id,name:i?'さんかくの鍵':'まるい鍵',description:i?'玉座の間の扉を開く さんかくの鍵':'玉座の間の扉を開く まるい鍵',consumable:false,occasion:3,scope:0,note:'<image:Item9,'+i+'>'}));let it=source('data/Items.json');for(const v of items)assert.ok(!it.data[v.id].name||it.data[v.id].name===v.name,'Item occupied');changes.set('data/Items.json',patchRecords(it.text,items.map(v=>[v.id,v])));
 const enemy=(id,name,battlerName,hp)=>({...clone(read('Enemies')[23]),id,name,battlerName,actions:[{conditionParam1:0,conditionParam2:0,conditionType:0,rating:5,skillId:1}],params:[hp,0,12,10,1,1,1,1],note:'<bgm:00_New_Battle2><boss><posType:2><frameSize:144><castleUpperTemporary>',traits:clone(read('Enemies')[20].traits)});
 const enemies=[enemy(23,'[仮]モーネ','castleMone_tmp',600),enemy(24,'[仮]ツネヒ','castleTsunehi_tmp',900),enemy(25,'[仮]死の猛獣との出会い','',9999)];enemies[2].actions[0].skillId=3;
 let es=source('data/Enemies.json');enemies.forEach(v=>assert.ok(!es.data[v.id].name||es.data[v.id].note.includes('castleUpperTemporary')));changes.set('data/Enemies.json',patchRecords(es.text,enemies.map(v=>[v.id,v])));
 const conditions={actorHp:50,actorId:1,actorValid:false,enemyHp:50,enemyIndex:0,enemyValid:false,switchId:1,switchValid:false,turnA:0,turnB:0,turnEnding:false,turnValid:true};
 const peaceful=[wait(30),...battleSpeaker('beast',['わふ']),c(111,[12,'$gameParty.members().some(function(a){return a.actorId()===3;})']),...battleSpeaker(3,['あれっ？','そっちに いるの？'],1),c(412),c(111,[12,'$gameParty.members().some(function(a){return a.actorId()===4;})']),...battleSpeaker(4,['ふふ 仲間みたいね'],1),c(412),...battleSpeaker('beast',['わふ！']),...js('KNH_CastleUpper.clearMessage();'),...system(['死の猛獣と 仲良くなった','奥の宝箱を開けられるようになった']),variable(64,2),c(340),end];
 const troops=[{id:46,name:'[仮]モーネ',members:[{enemyId:23,x:536,y:384,hidden:false}],pages:[]},{id:47,name:'[仮]死の猛獣_友好',members:[{enemyId:25,x:536,y:384,hidden:false}],pages:[{conditions,span:0,list:peaceful}]},{id:48,name:'[仮]ツネヒ',members:[{enemyId:24,x:536,y:384,hidden:false}],pages:[]}];
 let ts=source('data/Troops.json');troops.forEach(v=>assert.ok(!ts.data[v.id].name||ts.data[v.id].name===v.name));changes.set('data/Troops.json',patchRecords(ts.text,troops.map(v=>[v.id,v])));
}
function main(){
 const full=process.argv.includes('--full');fs.mkdirSync(out,{recursive:true});
 const manifestFile=path.join(out,'changes.json');const previous=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):{};
 const changes=new Map();database(changes);
 const maps=[[59,mone()],...(full?[[60,third()],[61,gimmick()],[62,throne()]]:[])];
 for(const[id,events]of maps){let f='data/Map'+String(id).padStart(3,'0')+'.json',s=source(f);assert.ok(s.data.events.filter(Boolean).length===0||previous[f]?.after===sha(s.bytes),'Map events changed outside this tool: '+f);changes.set(f,replaceKey(s.text,'events',events));}
 const f='data/Map055.json',s=source(f);{
   const saved=path.join(out,'before',f),original=fs.existsSync(saved)?fs.readFileSync(saved,'utf8'):s.text;
   const originalData=JSON.parse(original.replace(/^\uFEFF/,''));
   assert.deepEqual(s.data.events.slice(0,originalData.events.length),originalData.events,'Unrelated road event changed');
   const id=originalData.events.length,owned=s.data.events[id];
   assert.ok(!owned||(previous[f]&&owned.name==='モーネの間へ'),'Road exit id occupied');
   const added=event(id,'モーネの間へ',20,10,[page(transfer(59,4.5,24.5,6),{trigger:1})],'<HM拡大領域:3,0,0.5,3>');
   const [a,b]=keySpan(original,'events'),[x,y]=keySpan(s.text,'events');
   changes.set(f,s.text.slice(0,x)+patchRecords(original.slice(a,b),[],[added])+s.text.slice(y));
 }
 let p=sourcePlugin();if(!p.text.includes('"name":"KNH_ZXC_CastleUpper"')){const close=p.text.lastIndexOf(']'),at=p.text.lastIndexOf('}',close)+1,nl=p.text.includes('\r\n')?'\r\n':'\n';changes.set('js/plugins.js',p.text.slice(0,at)+','+nl+'{"name":"KNH_ZXC_CastleUpper","status":true,"description":"Temporary upper-castle progression and friendly actor guest.","parameters":{}}'+p.text.slice(at));}
 for(const[file]of changes){if(previous[file])assert.equal(sha(source(file).bytes),previous[file].after,'Owned input changed since last run: '+file);}
 for(const[file,text]of changes){const src=loaded.get(file);assert.ok(fs.readFileSync(path.join(root,file)).equals(src.bytes),'Concurrent edit: '+file);if(file.endsWith('.json'))JSON.parse(text.replace(/^\uFEFF/,''));const backup=path.join(out,'before',file);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,src.bytes,{flag:'wx'});}
 for(const[file,text]of changes){const src=loaded.get(file);assert.ok(fs.readFileSync(path.join(root,file)).equals(src.bytes),'Concurrent edit: '+file);fs.writeFileSync(path.join(root,file),text,'utf8');previous[file]={before:previous[file]?.before||sha(src.bytes),after:sha(Buffer.from(text))};}
 fs.writeFileSync(manifestFile,JSON.stringify(previous,null,2)+'\n');
 console.log('Updated '+(full?'all upper maps':'Mone/save representative')+': '+[...changes.keys()].join(', '));
}
function sourcePlugin(){const file='js/plugins.js',bytes=fs.readFileSync(path.join(root,file)),s={bytes,text:bytes.toString('utf8')};loaded.set(file,s);return s;}
if(require.main===module)main();
module.exports={mone,third,gimmick,throne,partyProxies,stageParty,patchRecords,keySpan};
