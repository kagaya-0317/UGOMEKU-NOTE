// Runs only in the dedicated QA NW.js process. No game/save files are written.
(async function() {
    if (window.__gnuroQA) throw new Error('Reload the isolated playtest before preparing another run');
    SceneManager._stopped = true;
    SceneManager.updateMain = function() {};
    DataManager.setupNewGame();
    DataManager.loadMapData(1);
    while (!DataManager.isMapLoaded()) await new Promise(function(resolve) { setTimeout(resolve, 50); });
    $gameMap.setup(1);
    $gameParty._actors = [2,3,4];
    $gameParty.members().forEach(function(actor) {
        actor.changeLevel(10, false);
        var originalParamBase = actor.paramBase;
        actor.paramBase = function(id) { return id === 0 ? 9999 : originalParamBase.call(this, id); };
        actor.recoverAll();
    });
    $gameSwitches.setValue(18, false);
    $gameSwitches.setValue(16, false);
    $gameSwitches.setValue(17, false);
    $gameSwitches.setValue(21, false);
    BattleManager.setup(43, false, true);
    var q = window.__gnuroQA = {frame:0,timers:[],sounds:[],trace:[],hits:[],guards:[],messages:[],phaseChanges:[],jumps:[],spins:[],breakPoses:[],threatPoses:[],uiPoses:[],axeChanges:[],barChanges:[],bubblePoses:[],
        key:'',pressed:'',autoAdvance:true,scriptHp:true,lastPhase:-1,holdMessage:0};
    _timeOut = function(callback, frames) { q.timers.push({at:q.frame+Math.max(0,Number(frames)||0),callback:callback}); };
    $gameSystem.getCurrentBgmFrame = function() { return q.frame; };
    $gameSystem.getRealTimeFrame60 = function() { return q.frame; };
    var originalPlaySe = AudioManager.playSe;
    AudioManager.playSe = function(se) {
        q.sounds.push({frame:q.frame,name:se.name,volume:se.volume,pitch:se.pitch,pan:se.pan});
        return originalPlaySe.apply(this, arguments);
    };
    var oldMessageAdd = Game_Message.prototype.add;
    Game_Message.prototype.add = function(text) {
        q.messages.push({frame:q.frame,text:text,speaker:q.scene && q.scene._gnuro && q.scene._gnuro.speaker,
            bubbleType:$gameVariables.value(14)});
        return oldMessageAdd.apply(this,arguments);
    };
    var scene = q.scene = new Scene_NewBattle();
    SceneManager._scene = scene;
    SceneManager._nextScene = null;
    SceneManager._sceneStarted = true;
    scene.create();
    var boss=scene._enemySprites[0], originalJump=boss.startJump, originalAnimation=boss.setAnimation;
    boss.startJump=function(x,y,duration,height){
        if(!this._actionTest)q.jumps.push({frame:q.frame,duration:duration,height:height,
            fromX:this.x,fromY:this.y,toX:this._homeX+x,toY:this._homeY+y,event:scene._gnuro.eventRunning,
            returning:Math.abs(x-this.baseOffsetX())<0.01&&Math.abs(y-this.baseOffsetY())<0.01});
        return originalJump.apply(this,arguments);
    };
    boss.setAnimation=function(type){
        if(!this._actionTest)q.axeChanges.push({frame:q.frame,type:type,duration:arguments[3],phase:scene._gnuro.phase,event:scene._gnuro.eventRunning});
        if(type==='attack1'&&!this._actionTest)q.spins.push({frame:q.frame,
            movement:this._movementDuration,jumpOffset:this._jumpOffsetY||0,event:scene._gnuro.eventRunning});
        return originalAnimation.apply(this,arguments);
    };
    ['breakGnuroBar','restoreGnuroBar'].forEach(function(name){
        var original=scene[name];
        scene[name]=function(){
            q.barChanges.push({frame:q.frame,kind:name,phase:scene._gnuro.phase,
                from:scene._gnuro.depth,args:Array.from(arguments)});
            return original.apply(this,arguments);
        };
    });
    scene._seedId = 2718;
    scene.start();
    var originalJudge=scene.showJudgeResult;
    scene.showJudgeResult=function(bs,judgment) {
        if(bs._info.button==='B')q.guards.push({frame:q.frame,skillId:bs._info.skillId,judgment:judgment});
        return originalJudge.apply(this,arguments);
    };
    var originalApply = scene.applyDamage;
    scene.applyDamage = function(subject,target,skillId) {
        q.hits.push({frame:q.frame,skillId:skillId,target:target.isActor()?'actor':'boss',
            actorId:subject.isActor()?subject.actorId():null,phase:scene._gnuro.phase});
        originalApply.apply(this,arguments);
        // Keep the showcase alive until every saved event/attack has been shown.
        if (!target.isActor() && q.scriptHp && target.hpRate()<0.12) target.setHp(Math.ceil(target.mhp*0.2));
    };
    Input.isTriggered = function(key) {
        return key === ({A:'right',B:'down',X:'up',Y:'left'}[q.key]);
    };
    Input.isPressed = function(key) {
        return key === ({A:'right',B:'down',X:'up',Y:'left'}[q.pressed]);
    };
    var originalMessageTrigger = scene._messageWindow.isTriggered;
    scene._messageWindow.isTriggered = function() {
        return q.advance || originalMessageTrigger.apply(this,arguments);
    };
    q.status = function() {
        var s=scene,st=s._gnuro;
        return {frame:q.frame,seconds:q.frame/60,phase:st.phase,attackPhase:st.attackPhase,
            turn:s._turn,since:st.sinceTurn,skip:s._skip,progress:s.progress(),hp:$gameTroop.members()[0].hp,
            running:$gameTroop.isEventRunning(),index:$gameTroop._interpreter._index,
            wait:$gameTroop._interpreter._waitMode,depth:st.depth,message:s._messageWindow.pause,
            text:$gameMessage._texts,actions:s._enemySprites[0]._actions.map(function(a){return a.skillId;}),
            queued:s._enemySprites[0]._turnActions.map(function(a){return [a.skillId,a.turn,a.did];}),
            flags:Object.keys($gameTroop._eventFlags),bossScale:s._enemySprites[0].scale.x,
            actorIds:s._actorSprites.map(function(sp){return sp._battler.actorId();}),
            allyAttacksDisabled:$gameSwitches.value(17)};
    };
    q.step = function(frames) {
        for(var n=0;n<frames;n++) {
            q.frame++;
            var timers=q.timers.filter(function(t){return t.at<=q.frame;});
            q.timers=q.timers.filter(function(t){return t.at>q.frame;});
            timers.forEach(function(t){t.callback();});
            var state=scene._gnuro;
            if(state.phase!==q.lastPhase){q.phaseChanges.push(q.status());q.lastPhase=state.phase;}
            if(q.scriptHp && !state.eventRunning) {
                var elapsed=scene._turn-state.sinceTurn;
                var ratio=state.phase===0&&elapsed>=2?0.74:state.phase===2&&elapsed>=1?0.49:
                    state.phase===3&&elapsed>=3?0.24:null;
                if(ratio!==null) $gameTroop.members()[0].setHp(Math.ceil($gameTroop.members()[0].mhp*ratio));
            }
            q.advance=false;
            if(scene._messageWindow.pause) {
                q.holdMessage++;
                if(q.autoAdvance&&q.holdMessage>=105){q.advance=true;q.holdMessage=0;}
            }else q.holdMessage=0;
            q.key='';q.pressed='';
            if(scene.isBattleActive()) {
                var at=scene.progress()/scene.maxCount()*64;
                var note=scene._buttonSprites.filter(function(bs){return !bs._judged&&bs._waitCount<=0&&
                    Math.abs((bs._index-at)/64*scene.maxCount())<=0.6;})[0];
                if(note)q.key=note._info.button;
                var hold=scene._buttonSprites.filter(function(bs){return bs._pressing;})[0];
                q.pressed=hold?hold._info.button:q.key;
            }
            scene.update();
            if(state.eventRunning&&boss._gnuroAxeHold!=null&&Math.abs(boss._offsetY)>1&&!boss._movementDuration)
                q.breakPoses.push({frame:q.frame,animationType:boss._animationType,cell:boss._animationIndex,
                    yura:!!boss._yuraInfo,meshVisible:!!(boss._meshSprite&&boss._meshSprite.visible),
                    meshStep:boss._meshSprite&&boss._meshSprite._lastMeshStep,
                    vertices:boss._meshSprite?Array.from(boss._meshSprite.vertices).slice(0,8):[]});
            if(q.frame%6===0&&state.eventRunning&&state.speaker==='enemy')
                q.threatPoses.push({frame:q.frame,animationType:boss._animationType,cell:boss._animationIndex,text:$gameMessage._texts.slice()});
            if(q.frame%12===0&&scene._messageWindow.pause&&$gameMessage._texts.length)
                q.bubblePoses.push({frame:q.frame,speaker:state.speaker,text:$gameMessage._texts.slice(),
                    drawType:scene._messageWindow._fukidashiSprite&&scene._messageWindow._fukidashiSprite._fukidashiDrawType});
            if(q.frame%6===0&&state.duration) {
                var cutFiltered=function(sprite) {
                    for(var node=sprite;node;node=node.parent)if((node.filters||[]).indexOf(state.filter)>=0)return true;
                    return false;
                };
                q.uiPoses.push({frame:q.frame,cursorX:scene._carCursorSprite.x,
                    cursorCut:cutFiltered(scene._carCursorSprite),comboCut:cutFiltered(scene._comboText),
                    cutButtons:scene._buttonSprites.filter(cutFiltered).length,buttons:scene._buttonSprites.length,
                    artCut:!!(state.filterTarget&&(state.filterTarget.filters||[]).indexOf(state.filter)>=0)});
            }
            SceneManager.updateEasing();
            Graphics.frameCount++;
            if(q.frame%30===0)q.trace.push(q.status());
        }
        Graphics._renderer.render(scene);
        return q.status();
    };
    q.capture = function() {
        if(!q.canvas){q.canvas=document.createElement('canvas');q.canvas.width=816;q.canvas.height=704;}
        var ctx=q.canvas.getContext('2d');
        ctx.fillStyle='#474e51';ctx.fillRect(0,0,816,80);
        var state=scene._gnuro, page=$dataTroops[43].pages.findIndex(function(p){return p.list===$gameTroop._interpreter._list;});
        var stage=state.phase>=4?4:state.phase>=3?3:state.phase>=1?2:0;
        if($gameTroop.isEventRunning())stage=[0,1,2,3,4][Math.max(0,page)];
        var titles=['01　開幕・斧回転斬り','02　HP75％：譜面を真っ二つに','03　V字の譜面で戦闘',
            '04　HP50％：シコ踏みと落下タライ','05　HP25％：復元を見て激怒・斧3連打'];
        var details=['威嚇や怒鳴り声はギザギザふきだし　往復とも0.4秒のジャンプ','棒の太さを保って左右を回転　振り下ろし保持中もゆらゆら',
            'ボタン・長押しの帯・カーソル・コンボ表示は切れずに棒に沿って移動',
            '踏み込みで地面が揺れ、少し遅れてタライが落ちる','怒りはギザギザふきだし　最後の回転は2倍　一撃で急なV字へ'];
        ctx.font='bold 25px "Meiryo",sans-serif';ctx.fillStyle='#ffffff';ctx.fillText(titles[stage],24,33);
        ctx.font='16px "Meiryo",sans-serif';ctx.fillStyle='#e2e5e5';ctx.fillText(details[stage],24,61);
        ctx.drawImage(Graphics._canvas,0,80);
        return q.canvas.toDataURL('image/jpeg',0.96).split(',')[1];
    };
    // Let the scene's initial native timer and asynchronous image loads complete.
    await new Promise(function(resolve){setTimeout(resolve,150);});
    for(var tick=0;tick<3;tick++)q.step(1);
    while(!ImageManager.isReady())await new Promise(function(resolve){setTimeout(resolve,50);});
    return q.status();
})();
