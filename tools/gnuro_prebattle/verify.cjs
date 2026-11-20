const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('./client.cjs');
const out=path.resolve(__dirname,'../../artifacts/gnuro-prebattle-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const q=await connect(),reports=[];try{
    await q.ready();await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(function(a){a.changeLevel(10,false);a.recoverAll();});$gamePlayer.refresh();$gameSwitches.setValue(17,false);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    const cases=[[2,3,4],[2,4,3],[2,3],[2,4],[2]];
    for(const party of cases){
        await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(60,0);__gnuroIntroQA.auto=false;__gnuroIntroQA.messages=[];__gnuroIntroQA.trace=[];true`);
        await q.map(54,10,22.5,8);
        await q.evaluate('$gamePlayer.setMoveSpeed(4);$gamePlayer.setDirectionFix(false);true');
        const initial=await q.evaluate('({speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy,followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y})),boss:[$gameMap.event(1).x,$gameMap.event(1).y]})');
        await q.evaluate('__gnuroIntroQA.route(10,18.5);true');
        await q.until('$gameVariables.value(60)===1&&$gameMessage.isBusy()&&$gameMap._interpreter._waitMode===\'message\'&&SceneManager._scene._messageWindow.pause','formation '+party,35000);await q.sleep(250);
        const staged=await q.evaluate(`({hero:[$gamePlayer.x,$gamePlayer.y],members:$gameTemp._castleUpperScene.members.map(m=>{var e=$gameMap.event(m.eventId);return {actor:m.actorId,x:e.x,y:e.y,image:e.characterName(),visible:!e.isTransparent()};}),boss:[$gameMap.event(1).x,$gameMap.event(1).y],moving:KNH_CastleUpper.isForming(),bubble:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,width:SceneManager._scene._messageWindow.width,height:SceneManager._scene._messageWindow.height},trace:__gnuroIntroQA.trace,error:__gnuroIntroQA.error})`);
        assert.equal(staged.error,null);assert.deepEqual(staged.hero,[10,15.5]);assert.deepEqual(staged.boss,initial.boss);assert.equal(staged.moving,false);
        const screen=await q.evaluate('({hero:$gamePlayer.screenY(),members:$gameTemp._castleUpperScene.members.map(m=>$gameMap.event(m.eventId).screenY())})');
        assert.ok(screen.hero<=604&&screen.members.every(y=>y<=604),'The whole party must fit below the boss');
        assert.deepEqual(staged.members.map(m=>m.actor).sort(),party.slice(1).sort());
        assert.ok(staged.bubble.x>=0&&staged.bubble.y>=0&&staged.bubble.x+staged.bubble.width<=816&&staged.bubble.y+staged.bubble.height<=624,'Bubble must fit the screen');
        for(const frame of staged.trace)assert.equal(frame.people.filter(p=>p.visible).length,party.length,'Party visibility during staging');
        for(const actor of party){const p=staged.trace.map(t=>t.people.find(p=>p.actor===actor)).filter(Boolean);assert.ok(p.some(n=>Math.abs(n.x-p[0].x)+Math.abs(n.y-p[0].y)>.5),'Actor walks to formation '+actor);}
        const rendered=await q.evaluate(`SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&!s._character.isTransparent()&&['$002','$003'].indexOf(s._character.characterName())>=0).length`);
        assert.equal(rendered,party.length-1,'Exactly one rendered sprite per companion');
        if(reports.length===0){const shot=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'gnuro_prebattle_formation.png'),Buffer.from(shot,'base64'));}
        await q.evaluate('__gnuroIntroQA.auto=true;true');
        await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','native battle transition',35000);
        await q.until('!!SceneManager._scene._gnuro&&$gameTroop._eventFlags[0]===true','battle intro consumed',10000);
        const battle=await q.evaluate('({troop:$gameTroop._troopId,party:$gameParty._actors,scale:SceneManager._scene._enemySprites[0].scale.x,attacksDisabled:$gameSwitches.value(17),messages:__gnuroIntroQA.messages})');
        assert.equal(battle.troop,43);assert.equal(battle.attacksDisabled,false);assert.equal(battle.scale,2);
        assert.ok(!battle.messages.some(m=>m.battle&&m.text.indexOf('\u30ef\u30b7\u306e\u540d\u306f')>=0),'Do not repeat the map introduction in battle');
        // Force only this QA outcome to exercise native victory return/cleanup.
        await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');
        await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(60)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','victory return and cleanup',90000);await q.sleep(250);
        const after=await q.evaluate('({speed:$gamePlayer._moveSpeed,directionFix:$gamePlayer.isDirectionFixed(),shown:$gamePlayer.followers().isVisible(),camera:$gamePlayer._centerXy,temp:!!$gameTemp._castleUpperScene,marker:!!$gameTemp._gnuroMapIntro,bossHidden:$gameMap.event(1).isTransparent()||!$gameMap.event(1).characterName(),proxiesHidden:$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).every(e=>e.isTransparent()),followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y}))})');
        assert.equal(after.speed,initial.speed);assert.equal(after.temp,false);assert.equal(after.marker,false);assert.equal(after.shown,true);assert.equal(after.proxiesHidden,true);assert.equal(after.bossHidden,true);assert.deepEqual(after.camera,[0,0]);
        for(const m of staged.members){const f=after.followers.find(f=>f.actor===m.actor);assert.deepEqual([f.x,f.y],[m.x,m.y],'Follower receives the stand-in position');}
        await q.evaluate('$gamePlayer.moveStraight(2);true');await q.sleep(350);
        await q.map(54,10,22.5,8);assert.equal(await q.evaluate('$gameMap.isEventRunning()'),false);assert.equal(await q.evaluate('$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).every(e=>e.isTransparent())'),true);
        reports.push({party,initial,hero:staged.hero,members:staged.members,bubble:staged.bubble,movementFrames:staged.trace.length,after});console.log('PASS '+JSON.stringify(party)+' entry, formation, native battle, cleanup and reentry');
    }
    assert.equal(await q.evaluate('DataManager.saveGame(80)'),true);
    await q.evaluate('$gameVariables.setValue(60,0);true');assert.equal(await q.evaluate('DataManager.loadGame(80)'),true);
    await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','saved completed map');
    await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','load initialization');
    assert.equal(await q.evaluate('$gameVariables.value(60)'),2);assert.equal(await q.evaluate('$gameMap.isEventRunning()'),false);
    console.log('PASS completed-state save/load');
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({forcedVictoryForCleanup:true,saveLoad:true,cases:reports},null,2));
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
