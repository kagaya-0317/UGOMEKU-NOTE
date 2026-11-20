const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('./client.cjs');
const out=path.resolve(__dirname,'../../artifacts/gnuro-event-speed-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const q=await connect(),reports=[];try{
    await q.ready();await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(function(a){a.changeLevel(10,false);a.recoverAll();});$gamePlayer.refresh();$gameSwitches.setValue(17,false);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    await q.evaluate(`(function(){
        var update=SceneManager.updateScene;window.__sceneSpeedQA={rows:[],previous:{}};
        SceneManager.updateScene=function(){
            var r=update.apply(this,arguments),qa=__sceneSpeedQA,state=$gameTemp._castleUpperScene;
            if(!(SceneManager._scene instanceof Scene_Map)||!state||state.mapId!==54){qa.previous={};return r;}
            var people=[{actor:2,c:$gamePlayer}].concat(state.members.map(function(m){return {actor:m.actorId,c:$gameMap.event(m.eventId)};}));
            people.forEach(function(p){var c=p.c,old=qa.previous[p.actor],now={x:c._realX,y:c._realY};
                if(old){var dx=Math.abs(now.x-old.x),dy=Math.abs(now.y-old.y);if(dx+dy>0.000001)qa.rows.push({actor:p.actor,phase:state.returning?'return':'approach',speed:c._moveSpeed,real:c.realMoveSpeed(),dx:dx,dy:dy});}
                qa.previous[p.actor]=now;
            });return r;
        };return true;
    })()`);
    for(const test of [{party:[2,3,4],speed:4.5,nativeBattle:true},{party:[2,4,3],speed:3.5},{party:[2,4],speed:4.5},{party:[2],speed:4.5}]){
        await q.evaluate(`$gameParty._actors=${JSON.stringify(test.party)};$gamePlayer.refresh();$gameVariables.setValue(60,0);__gnuroIntroQA.auto=false;__gnuroIntroQA.messages=[];__sceneSpeedQA.rows=[];__sceneSpeedQA.previous={};true`);
        await q.map(54,10,22.5);
        await q.evaluate(`$gamePlayer.setMoveSpeed(${test.speed});__gnuroIntroQA.route(10,18.5);true`);
        await q.until('$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause','normal walking entry',35000);
        const initial=await q.evaluate('({heroSpeed:$gamePlayer._moveSpeed,members:$gameTemp._castleUpperScene.members.map(m=>({actor:m.actorId,speed:$gameMap.event(m.eventId)._moveSpeed})),captured:$gameTemp._castleUpperScene.moveSpeed})');
        assert.equal(initial.heroSpeed,test.speed);assert.equal(initial.captured,test.speed);assert.ok(initial.members.every(m=>m.speed===4));
        if(test.nativeBattle){
            const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'formation.png'),Buffer.from(png,'base64'));
            await q.evaluate('__gnuroIntroQA.auto=true;true');await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!!SceneManager._scene._gnuro','native battle',35000);
            await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');
        }else{
            // Replay the saved postbattle continuation for the party-order boundaries.
            await q.evaluate('SceneManager._scene._messageWindow.terminateMessage();SceneManager._scene._messageWindow.pause=false;var list=$dataMap.events[3].pages[0].list;var at=list.findIndex(c=>c.code===355&&c.parameters[0]===\'delete $gameTemp._gnuroMapIntro;\');$gameVariables.setValue(60,2);$gameMap._interpreter.setup(list.slice(at),3);__gnuroIntroQA.auto=true;true');
        }
        await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(60)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','postbattle return',90000);
        const after=await q.evaluate('({speed:$gamePlayer._moveSpeed,camera:$gamePlayer._centerXy,shown:$gamePlayer.followers().isVisible(),proxiesHidden:[$gameMap.event(5),$gameMap.event(6)].every(e=>e.isTransparent()),rows:__sceneSpeedQA.rows,error:__gnuroIntroQA.error})');
        assert.equal(after.error,null);assert.equal(after.speed,test.speed);assert.deepEqual(after.camera,[0,0]);assert.equal(after.shown,true);assert.equal(after.proxiesHidden,true);
        for(const actor of test.party){
            for(const phase of actor===2?['approach']:['approach','return']){
                const rows=after.rows.filter(r=>r.actor===actor&&r.phase===phase),expected=actor===2?test.speed:4,dpf=Math.pow(2,expected)/256;
                assert.ok(rows.length>0,'Actual movement was sampled: '+actor+' '+phase);
                assert.ok(rows.every(r=>r.speed===expected&&r.real===expected),'Actual engine speed: '+actor+' '+phase);
                assert.ok(rows.every(r=>Math.max(r.dx,r.dy)<=dpf+1e-6),'No jumps or faster movement: '+actor+' '+phase);
                assert.ok(rows.some(r=>Math.abs(Math.max(r.dx,r.dy)-dpf)<1e-6),'Full walking steps match the reference speed: '+actor+' '+phase);
            }
        }
        await q.evaluate('__gnuroIntroQA.route(10,17.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','resumed following');
        const following=await q.evaluate('({speed:$gamePlayer._moveSpeed,count:SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&!s._character.isTransparent()&&["$002","$003"].indexOf(s._character.characterName())>=0).length})');assert.equal(following.speed,test.speed);assert.equal(following.count,test.party.length-1);
        reports.push({...test,initial,after,following});console.log('PASS '+test.party+' speed '+test.speed+', approach/return displacement, restoration and following');
    }
    await q.evaluate('$gameParty._actors=[2,3,4];$gamePlayer.refresh();true');await q.map(59,10,18);
    const boundary=await q.evaluate('var before=$gamePlayer._moveSpeed;KNH_CastleUpper.beginScene(1);var during=[$gamePlayer._moveSpeed].concat($gameTemp._castleUpperScene.members.map(m=>$gameMap.event(m.eventId)._moveSpeed));KNH_CastleUpper.endScene();({before:before,during:during,after:$gamePlayer._moveSpeed})');
    assert.ok(boundary.during.every(s=>s===3),'Other encounters keep their existing speed');assert.equal(boundary.after,boundary.before);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({nativeBattleForcedVictoryForReturn:true,cases:reports,unchangedOtherEncounter:boundary},null,2));console.log('PASS unchanged speed for other encounters');
}finally{
    // Leave no QA game window behind, including on verification failures.
    try{await q.call('Browser.close');}catch(_){}q.ws.close();
}}
main().catch(e=>{console.error(e);process.exitCode=1;});
