const assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect(expectedApp='gnuro-prebattle-qa'){
    let tab;
    for(let i=0;i<100&&!tab;i++){
        try{const tabs=await(await fetch('http://127.0.0.1:9364/json')).json();tab=tabs.find(t=>/\/index.html$/.test(t.url));}catch(_){}
        if(!tab)await sleep(100);
    }
    assert.ok(tab,'Dedicated Gnuro QA process is missing');
    const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
    let id=0;const pending=new Map();
    ws.addEventListener('message',event=>{const m=JSON.parse(event.data),entry=pending.get(m.id);if(!entry)return;pending.delete(m.id);m.error?entry.reject(Error(JSON.stringify(m.error))):entry.resolve(m.result);});
    const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
    const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const until=async(expression,label,timeout=25000)=>{const started=Date.now();while(Date.now()-started<timeout){if(await evaluate(expression))return;await sleep(100);}throw Error('Timeout: '+label+' '+JSON.stringify(await evaluate('({scene:SceneManager._scene&&SceneManager._scene.constructor.name,body:document.body.innerText,map:window.$gameMap&&$gameMap.mapId(),text:window.$gameMessage&&$gameMessage._texts,index:window.$gameMap&&$gameMap._interpreter._index})')));};
    const map=async(id,x,y,d=8)=>{await evaluate(`$gamePlayer.requestMapReload();$gamePlayer.reserveTransfer(${id},${Math.floor(x)},${Math.floor(y)},${d},2);SceneManager.goto(Scene_Map);true`);await until(`$gameMap.mapId()===${id}&&SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&ImageManager.isReady()`,'map '+id);if(x%1||y%1)await evaluate(`$gamePlayer.shiftPos(${x%1},${y%1});true`);await evaluate('$gameScreen.startFadeIn(12);true');await until('$gameScreen.brightness()===255','QA map entry fade');await sleep(200);};
    const ready=async()=>{await until('!!window.$gameMap&&!!window.$dataTemplateEvents&&DataManager.isDatabaseLoaded()&&!!SceneManager._scene&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','app startup',45000);assert.equal(await evaluate('require("nw.gui").App.manifest.name'),expectedApp);};
    return {ws,call,evaluate,until,map,ready,sleep};
}
module.exports={connect,sleep};
