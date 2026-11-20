// Installed only in the isolated QA app. Movement uses normal half-tile passage.
(function(){
    var qa=window.__gnuroIntroQA={auto:false,advance:false,path:[],messages:[],trace:[],walking:false,error:null};
    qa.route=function(tx,ty){
        var start=[$gamePlayer.x,$gamePlayer.y],queue=[start],previous={},seen={},key=function(x,y){return x+','+y;},first=key(start[0],start[1]),last=key(tx,ty),saved=$gameMap.events;
        seen[first]=true;
        try{
            $gameMap.events=function(){return this._events.filter(Boolean);};
            for(var i=0;i<queue.length&&!seen[last]&&i<12000;i++){
                var p=queue[i];[2,4,6,8].forEach(function(d){
                    if(!$gamePlayer.canPass(p[0],p[1],d))return;
                    var x=p[0]+(d===4?-.5:d===6?.5:0),y=p[1]+(d===8?-.5:d===2?.5:0),k=key(x,y);
                    if(!seen[k]){seen[k]=true;previous[k]={from:key(p[0],p[1]),direction:d};queue.push([x,y]);}
                });
            }
        }finally{$gameMap.events=saved;}
        if(!seen[last])throw Error('No normal walking route '+first+' -> '+last);
        var result=[];for(var k=last;k!==first;k=previous[k].from)result.push(previous[k].direction);
        qa.path=result.reverse();qa.walking=true;return qa.path.length;
    };
    var add=Game_Message.prototype.add;
    Game_Message.prototype.add=function(text){qa.messages.push({text:text,frame:Graphics.frameCount,map:$gameMap.mapId(),battle:$gameParty.inBattle(),time:performance.now()});return add.apply(this,arguments);};
    var trigger=Window_Message.prototype.isTriggered;
    Window_Message.prototype.isTriggered=function(){return qa.advance||trigger.apply(this,arguments);};
    var speed=Window_Message.prototype.getMessageSpeed;
    Window_Message.prototype.getMessageSpeed=function(){return qa.auto?0:qa.recording?1:speed.apply(this,arguments);};
    var update=SceneManager.updateScene;
    SceneManager.updateScene=function(){
        try{
            qa.advance=false;
            if(qa.auto)qa.advance=true;
            if(qa.recording){
                var w=SceneManager._scene&&SceneManager._scene._messageWindow;
                if(w&&w.pause){if(!qa.pauseAt)qa.pauseAt=performance.now();if(performance.now()-qa.pauseAt>(qa.pauseMs||1500)){qa.advance=true;qa.pauseAt=0;}}
                else qa.pauseAt=0;
            }
            if(SceneManager._scene instanceof Scene_Map){
                if(qa.recording&&$gameMap.mapId()===54&&!qa.hallRouted&&!$gameMap.isEventRunning()&&!$gamePlayer.isMoving()){
                    qa.route(10,18.5);qa.hallRouted=true;
                }
                if($gameMap.mapId()===54&&$gameVariables.value(60)===1){qa.walking=false;qa.path=[];}
                if(qa.walking&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gamePlayer.isMoving()){
                    if(qa.path.length)$gamePlayer.moveStraight(qa.path.shift());else qa.walking=false;
                }
                var state=$gameTemp._castleUpperScene;
                if(state&&state.mapId===54){
                    var people=[{actor:2,x:$gamePlayer._realX,y:$gamePlayer._realY,visible:!$gamePlayer.isTransparent()}];
                    state.members.forEach(function(m){var e=$gameMap.event(m.eventId);people.push({actor:m.actorId,x:e._realX,y:e._realY,visible:!e.isTransparent()});});
                    var mw=SceneManager._scene._messageWindow,boss=$gameMap.event(1);
                    qa.trace.push({frame:Graphics.frameCount,people:people,camera:$gamePlayer._centerXy.slice(),bossHeight:boss.getHeightForPopup(),bubble:$gameMessage.isBusy()?{x:mw.x,y:mw.y,width:mw.width,height:mw.height}:null});
                }
            }
            if(SceneManager._scene instanceof Scene_NewBattle&&SceneManager._scene.isBattleActive()){
                var s=SceneManager._scene,at=s.progress()/s.maxCount()*64;
                var note=s._buttonSprites.filter(function(b){return !b._judged&&b._waitCount<=0&&Math.abs((b._index-at)/64*s.maxCount())<.9;})[0];
                qa.key=note?note._info.button:'';
                var hold=s._buttonSprites.filter(function(b){return b._pressing;})[0];qa.pressed=hold?hold._info.button:qa.key;
            }else qa.key=qa.pressed='';
        }catch(e){qa.error=e.stack||String(e);}
        return update.apply(this,arguments);
    };
    var input=Input.isTriggered,pressed=Input.isPressed;
    Input.isTriggered=function(key){return key===({A:'right',B:'down',X:'up',Y:'left'}[qa.key])||input.apply(this,arguments);};
    Input.isPressed=function(key){return key===({A:'right',B:'down',X:'up',Y:'left'}[qa.pressed])||pressed.apply(this,arguments);};
    return true;
})();
