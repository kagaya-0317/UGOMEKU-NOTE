// Installed only in the dedicated recording process; saved game data is untouched.
(function(){
 var resume=window.__castleFlowResume;
 var f=window.__castleFlow={stage:resume?resume.stage:0,stepAt:performance.now(),started:performance.now()-(resume?resume.offset*1000:0),done:false,trace:resume?resume.trace:[],path:[],key:'',pressed:'',advance:false,choices:resume?resume.choices:0};
 var steps=[
  {name:'Road exit',map:55,walk:[20,10],nextMap:59},
  {name:'Mone save point',map:59,walk:[13,26],interact:1,save:61},
  {name:'Mone encounter',map:59,walk:[10,19.5],flag:63},
  {name:'Stairs to 3F',map:59,walk:[10,5.5],nextMap:60},
  {name:'Beast encounter',map:60,walk:[6,17.5],flag:64},
  {name:'Round key',map:60,walk:[6,12],interact:5,item:53},
  {name:'Last gimmick room',map:60,walk:[37,12],touch:8,nextMap:61,waitFlag:65},
  {name:'Triangle key',map:61,walk:[10,9],interact:2,item:54},
  {name:'Return door B2',map:61,walk:[4,25],nextMap:60},
  {name:'Two-key gate',map:60,walk:[25.5,12],touch:8,nextMap:62},
  {name:'Throne save point',map:62,walk:[6.5,24],face:4,interact:1,save:62},
  {name:'Tsunehi encounter',map:62,walk:[10,17.5],flag:67},
  {name:'Complete',map:62,hold:2500}
 ];
 function idle(){return SceneManager._scene instanceof Scene_Map&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!SceneManager._scene._sceneInfo;}
 function route(x,y){
  var original=$gameMap.events;$gameMap.events=function(){return this._events.filter(Boolean);};
  try{
   var start=[$gamePlayer.x,$gamePlayer.y],queue=[start],seen={},previous={},dirs=[8,6,2,4];
   function key(x,y){return Math.round(x*2)+','+Math.round(y*2);}
   var first=key(start[0],start[1]),last=key(x,y);seen[first]=true;
   for(var i=0;i<queue.length&&i<20000&&!seen[last];i++){
    var a=queue[i];dirs.forEach(function(d){if($gamePlayer.canPass(a[0],a[1],d)){
     var nx=a[0]+(d===4?-.5:d===6?.5:0),ny=a[1]+(d===8?-.5:d===2?.5:0),k=key(nx,ny);
     if(!seen[k]){seen[k]=true;previous[k]={at:key(a[0],a[1]),dir:d};queue.push([nx,ny]);}
    }});
   }
   if(!seen[last])throw Error('No walking route: '+f.stage+' '+first+' -> '+last);
   var path=[];for(var k=last;k!==first;k=previous[k].at)path.push(previous[k].dir);return path.reverse();
  }finally{$gameMap.events=original;}
 }
 function next(){f.trace.push({stage:f.stage,name:steps[f.stage].name,seconds:(performance.now()-f.started)/1000,map:$gameMap.mapId(),flags:[63,64,65,66,67].map(id=>$gameVariables.value(id))});f.stage++;f.stepAt=performance.now();f.path=[];f.sent=false;f.pending=false;f.choiceAt=0;f.saveAt=0;}
 f.status=function(){var s=SceneManager._scene;return {stage:f.stage,name:steps[f.stage]&&steps[f.stage].name,seconds:(performance.now()-f.started)/1000,map:$gameMap.mapId(),xy:[$gamePlayer.x,$gamePlayer.y],scene:s.constructor.name,flag:[63,64,65,66,67].map(id=>$gameVariables.value(id)),text:$gameMessage._texts,done:f.done,error:f.error,battle:s instanceof Scene_NewBattle?{troop:$gameTroop._troopId,hp:$gameTroop.members()[0].hp,turn:s._turn,party:$gameParty.members().map(a=>[a.actorId(),a.hp]),attacksDisabled:$gameSwitches.value(17)}:null};};
 function tick(){
  if(f.done||f.error)return;
  var now=performance.now(),scene=SceneManager._scene,step=steps[f.stage];
  f.key='';f.pressed='';f.advance=false;
  if(!step){f.done=true;return;}
  var mw=scene._messageWindow;
  if(mw&&mw.pause&&!(mw._choiceWindow&&mw._choiceWindow.isOpenAndActive())){
   if(!f.pauseAt)f.pauseAt=now;
   if(now-f.pauseAt>1250){f.advance=true;f.pauseAt=0;}
  }else f.pauseAt=0;
  if($gameMessage.isChoice()&&mw&&mw._choiceWindow&&mw._choiceWindow.isOpenAndActive()){
   if(!f.choiceAt)f.choiceAt=now;
   if(now-f.choiceAt>1700){mw._choiceWindow.select(step.save===61?0:1);mw._choiceWindow.processOk();f.choiceAt=0;f.choices++;}
  }
  if(scene._listWindow&&scene._sceneInfo&&scene._listWindow._mode==='save'&&scene._listWindow.isOpenAndActive()){
   if(!f.saveAt)f.saveAt=now;
   if(now-f.saveAt>1600){scene._listWindow.select(0);scene._listWindow.processOk();f.saveAt=0;}
  }
  if(scene instanceof Scene_NewBattle&&scene.isBattleActive()){
   var at=scene.progress()/scene.maxCount()*64;
   var note=scene._buttonSprites.filter(function(bs){return !bs._judged&&bs._waitCount<=0&&Math.abs((bs._index-at)/64*scene.maxCount())<=.9;})[0];
   if(note)f.key=note._info.button;
   var hold=scene._buttonSprites.filter(function(bs){return bs._pressing;})[0];f.pressed=hold?hold._info.button:f.key;
  }
  if(!idle())return;
  if(step.nextMap&&$gameMap.mapId()===step.nextMap&&(!step.waitFlag||$gameVariables.value(step.waitFlag)===2)){next();return;}
  if(step.flag&&$gameVariables.value(step.flag)===2){next();return;}
  if(step.item&&$gameParty.numItems($dataItems[step.item])>0){next();return;}
  if(step.save&&f.sent&&$gameVariables.value(step.save)===1){next();return;}
  if(step.hold){if(now-f.stepAt>step.hold){next();f.done=true;}return;}
  if($gameMap.mapId()!==step.map)return;
  if(!f.pending){f.path=route(step.walk[0],step.walk[1]);f.pending=true;}
  if(!$gamePlayer.isMoving()&&f.path.length){$gamePlayer.moveStraight(f.path.shift());return;}
  if(!$gamePlayer.isMoving()&&!f.path.length&&!f.sent){
   if(step.interact){$gamePlayer.setDirection(step.face||8);$gamePlayer.checkEventTriggerThere([0]);f.sent=true;}
   else if(step.touch){$gamePlayer.moveStraight(step.touch);f.sent=true;}
  }
 }
 var triggered=Input.isTriggered,pressed=Input.isPressed;
 Input.isTriggered=function(key){return key===({A:'right',B:'down',X:'up',Y:'left'}[f.key])||triggered.apply(this,arguments);};
 Input.isPressed=function(key){return key===({A:'right',B:'down',X:'up',Y:'left'}[f.pressed])||pressed.apply(this,arguments);};
 var messageTrigger=Window_Message.prototype.isTriggered;
 Window_Message.prototype.isTriggered=function(){return f.advance||messageTrigger.apply(this,arguments);};
 var update=SceneManager.updateScene;
 SceneManager.updateScene=function(){try{tick();}catch(e){f.error=e.stack||String(e);}return update.apply(this,arguments);};
 return f.status();
})();
