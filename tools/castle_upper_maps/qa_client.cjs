const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(){
 let tab;for(let i=0;i<80&&!tab;i++){try{const tabs=await(await fetch('http://127.0.0.1:9357/json')).json();tab=tabs.find(t=>/\/index.html$/.test(t.url));}catch(_){}if(!tab)await sleep(100);}assert.ok(tab,'Dedicated QA app missing');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0,pending=new Map();
 ws.addEventListener('message',e=>{let m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async(expression,description,timeout=20000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await sleep(100);}throw Error('Timeout: '+description+' '+await evaluate('JSON.stringify({scene:SceneManager._scene&&SceneManager._scene.constructor.name,phase:window.BattleManager&&BattleManager._phase,text:window.$gameMessage&&$gameMessage._texts,index:window.$gameMap&&$gameMap._interpreter._index,body:document.body.innerText})'));};
 const map=async(id,x,y,d=8)=>{await evaluate(`$gamePlayer.requestMapReload();$gamePlayer.reserveTransfer(${id},${Math.floor(x)},${Math.floor(y)},${d},2);SceneManager.goto(Scene_Map);true`);await until(`$gameMap.mapId()===${id}&&SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&ImageManager.isReady()`,'map '+id);if(x%1||y%1)await evaluate(`$gamePlayer.shiftPos(${x%1},${y%1});true`);await sleep(200);};
 const prepare=async()=>{await evaluate(`DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gamePlayer.refresh();window.__castleQA={messages:[],auto:true};
 var messageAdd=Game_Message.prototype.add;Game_Message.prototype.add=function(text){__castleQA.messages.push(text);return messageAdd.apply(this,arguments);};
 var triggered=Window_Message.prototype.isTriggered;Window_Message.prototype.isTriggered=function(){return __castleQA.auto||triggered.apply(this,arguments);};
 var fast=Window_Message.prototype.updateShowFast;Window_Message.prototype.updateShowFast=function(){fast.apply(this,arguments);if(__castleQA.auto)this._showFast=true;};true`);};
 return {ws,call,evaluate,until,map,prepare,sleep};
}
module.exports={connect,sleep};
