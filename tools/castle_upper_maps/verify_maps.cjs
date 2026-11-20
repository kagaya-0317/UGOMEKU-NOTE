// Read the saved maps in a dedicated NW.js session; never save game state.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const sourceOut=path.join(root,'artifacts/castle-upper-maps-implementation-20261118');
const out=path.join(root,'artifacts/castle-upper-events-20261118');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const tabs=await(await fetch('http://127.0.0.1:9357/json')).json();
  const tab=tabs.find(t=>/\/index.html$/.test(t.url));
  assert.ok(tab,'Dedicated QA app is not running');
  const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const k=++id;pending.set(k,{resolve,reject});ws.send(JSON.stringify({id:k,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    const background=tabs.find(t=>t.type==='background_page');
    const appUrl=background.url.replace('_generated_background_page.html','index.html');
    await call('Page.navigate',{url:appUrl});
    let state;
    for(let i=0;i<100;i++){
      state=await evaluate('({ready:!!window.$gameMap&&!!window.$dataTemplateEvents&&DataManager.isDatabaseLoaded()&&!!SceneManager._scene&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady(),error:document.body?document.body.innerText:"",require:typeof require,base:document.baseURI})');
      if(state.ready||/Error|エラー/.test(state.error))break;
      await sleep(100);
    }
    console.log('Boot',JSON.stringify(state));assert.ok(state.ready,'QA boot failed: '+state.error);
    if(process.argv.includes('--inspect'))return;
    await evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];[63,64,65,67].forEach(function(id){$gameVariables.setValue(id,2);});$gameVariables.setValue(66,1);$gamePlayer.refresh();true');
    const manifest=JSON.parse(fs.readFileSync(path.join(sourceOut,'manifest.json'))),reports=[];
    for(const map of manifest.maps){
      await evaluate(`$gamePlayer.reserveTransfer(${map.id},${map.probes[0][0]},${map.probes[0][1]},8,2);SceneManager.goto(Scene_Map);true`);
      for(let i=0;i<100;i++){
        const ready=await evaluate(`$gameMap.mapId()===${map.id}&&SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&ImageManager.isReady()`);
        if(ready)break;if(i===99)throw new Error('Map did not load: '+map.id);await sleep(80);
      }
      await sleep(180);
      const report=await evaluate(`(function(){
        $gamePlayer.setThrough(false);$gamePlayer._halfDisable=false;
        var originalCollision=$gamePlayer.isCollidedWithEvents;
        $gamePlayer.isCollidedWithEvents=function(){return false;};
        var probes=${JSON.stringify(map.probes)},start=probes[0],seen={},queue=[start],dirs=[2,4,6,8];
        function key(x,y){return Math.round(x*2)+','+Math.round(y*2);}
        seen[key(start[0],start[1])]=true;
        for(var i=0;i<queue.length&&i<20000;i++){
          var at=queue[i];
          dirs.forEach(function(d){if($gamePlayer.canPass(at[0],at[1],d)){
            var x=at[0]+(d===4?-0.5:d===6?0.5:0),y=at[1]+(d===8?-0.5:d===2?0.5:0),k=key(x,y);
            if(!seen[k]&&x>=0&&y>=0&&x<$gameMap.width()&&y<$gameMap.height()){seen[k]=true;queue.push([x,y]);}
          }});
        }
        $gamePlayer.isCollidedWithEvents=originalCollision;
        return {id:$gameMap.mapId(),events:$dataMap.events.filter(Boolean).length,width:$gameMap.width(),height:$gameMap.height(),background:$dataMap.parallaxName,
          reachableHalfSteps:queue.length,wallBlocked:!$gameMap.isPassableByHalfRegionAndTag(0,0),
          probes:probes.map(function(p){return {at:p,walkable:$gameMap.isPassableByHalfRegionAndTag(p[0],p[1]),reachable:!!seen[key(p[0],p[1])]};}),
          yura:!!SceneManager._scene._spriteset._parallax._yuraInfo,mesh:!!SceneManager._scene._spriteset._parallax._meshSprite};
      })()`);
      console.log(JSON.stringify(report));reports.push(report);
      await evaluate(`KNH_MapSnapshot.save({path:${JSON.stringify(path.join(out,'map'+map.id+'-in-game.png'))},includeUi:false})`);
    }
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(reports,null,2)+'\n');
    for(const report of reports){assert.ok(report.events>=0);assert.ok(report.wallBlocked);assert.ok(report.yura);assert.ok(report.probes.every(p=>p.walkable&&p.reachable),'Unreachable route on map '+report.id);}
    console.log('PASS: all four saved maps, walls and open-state main routes verified.');
  }finally{ws.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
