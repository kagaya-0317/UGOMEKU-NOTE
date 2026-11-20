const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('./client.cjs');
const out=path.resolve(__dirname,'../../artifacts/gnuro-postbattle-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const q=await connect(),reports=[];try{
    await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gameParty.members().forEach(function(a){a.changeLevel(10,false);a.recoverAll();});$gamePlayer.refresh();$gameSwitches.setValue(17,false);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    // Pause the native map continuation at its first companion line.
    await q.evaluate('(function(){var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){if(!$gameParty.inBattle()&&$gameMap.mapId()===54&&$gameVariables.value(60)===2)__gnuroIntroQA.auto=false;return add.apply(this,arguments);};return true;})()');
    for(const party of [[2,3,4],[2,4,3],[2,3],[2,4],[2]]){
        await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(60,0);__gnuroIntroQA.auto=true;__gnuroIntroQA.messages=[];__gnuroIntroQA.trace=[];true`);
        await q.map(54,10,22.5,8);
        await q.evaluate('$gamePlayer.setMoveSpeed(4);$gamePlayer.setDirectionFix(true);$gameMap.scrollCamera(0,0,0);__gnuroIntroQA.route(10,18.5);true');
        await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!!SceneManager._scene._gnuro','native battle',45000);
        const expected=await q.evaluate('({speed:$gameTemp._castleUpperScene.moveSpeed,fix:$gameTemp._castleUpperScene.directionFix,camera:$gameTemp._castleUpperScene.camera,followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y,d:f.direction()}))})');
        // The forced outcome only verifies the native victory continuation.
        await q.evaluate('$gameTroop.members().forEach(e=>e.die());true');
        if(party.length>1){
            await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(60)===2&&$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause','postbattle dialogue',90000);
            const bubbles=[];
            while(await q.evaluate('$gameMessage.isBusy()')){
                await q.sleep(100);
                const b=await q.evaluate('({text:$gameMessage._texts.slice(),popup:$gameSystem.getMessagePopupId(),rect:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,w:SceneManager._scene._messageWindow.width,h:SceneManager._scene._messageWindow.height},rendered:SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&!s._character.isTransparent()&&["$002","$003"].indexOf(s._character.characterName())>=0).length,followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y})),proxies:$gameTemp._castleUpperScene.members.map(m=>({actor:m.actorId,x:$gameMap.event(m.eventId).x,y:$gameMap.event(m.eventId).y}))})');
                assert.equal(b.rendered,party.length-1);assert.ok(b.rect.x>=0&&b.rect.y>=0&&b.rect.x+b.rect.w<=816&&b.rect.y+b.rect.h<=624,'Companion bubble fits');bubbles.push(b);
                if(party.join(',')==='2,3,4'){
                    const file='gnuro_postbattle_'+bubbles.length+'.png';
                    const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,file),Buffer.from(png,'base64'));
                }
                const prior=JSON.stringify(b.text);
                await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');
                await q.until(`!$gameTemp._castleUpperScene||JSON.stringify($gameMessage._texts)!==${JSON.stringify(prior)}`,'next postbattle step');
                await q.sleep(250);
                if(await q.evaluate('$gameMessage.isBusy()'))await q.until('SceneManager._scene._messageWindow.pause','next message pause');
            }
            expected.bubbles=bubbles;
        }
        await q.until('SceneManager._scene instanceof Scene_Map&&$gameVariables.value(60)===2&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','return to following',90000);await q.sleep(150);
        const after=await q.evaluate('({hero:[$gamePlayer.x,$gamePlayer.y],speed:$gamePlayer._moveSpeed,fix:$gamePlayer.isDirectionFixed(),camera:$gamePlayer._centerXy,shown:$gamePlayer.followers().isVisible(),temp:!!$gameTemp._castleUpperScene,popup:$gameSystem.getMessagePopupId(),free:$gameSystem._messagePopupPosition,tail:$gameMessage._tailDir,fukidashi:$gameMessage._fukidashi,bossHidden:!$gameMap.event(1).characterName(),proxiesHidden:$gameMap._events.filter(e=>e&&e.event().meta.castleUpperActor).every(e=>e.isTransparent()),followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y,d:f.direction()})),messages:__gnuroIntroQA.messages.filter(m=>!m.battle&&m.text.indexOf("ワシ")!==0),trace:__gnuroIntroQA.trace,error:__gnuroIntroQA.error})');
        assert.equal(after.error,null);assert.equal(after.speed,expected.speed);assert.equal(after.fix,expected.fix);assert.deepEqual(after.camera,expected.camera);assert.equal(after.temp,false);assert.equal(after.shown,true);assert.equal(after.proxiesHidden,true);assert.equal(after.bossHidden,true);assert.equal(after.fukidashi,false);assert.equal(after.tail,0);
        for(const f of expected.followers)assert.deepEqual(after.followers.find(a=>a.actor===f.actor),f,'Return to the original hidden follower position/direction');
        const post=after.messages.map(m=>m.text).filter(t=>['なんとか倒せたね…','すごい人だったね','ええ、毎朝欠かさず','伸ばしてるんですって！','足の話！？'].includes(t));
        const want=[];if(party.includes(3))want.push('なんとか倒せたね…','すごい人だったね');if(party.includes(4))want.push('ええ、毎朝欠かさず','伸ばしてるんですって！');if(party.includes(3)&&party.includes(4))want.push('足の話！？');assert.deepEqual(post,want);
        if(expected.bubbles){const final=after.trace.slice(-100);for(const f of expected.followers){assert.ok(final.some(t=>{const p=t.people.find(p=>p.actor===f.actor);return p&&Math.abs(p.x-f.x)+Math.abs(p.y-f.y)>.1;}),'Companion walks back before handoff');}}
        await q.evaluate('$gamePlayer.setDirectionFix(false);__gnuroIntroQA.route(10,17.5);true');await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','following after return');
        const counts=await q.evaluate('({followers:$gamePlayer.followers()._data.filter(f=>f.actor()).map(f=>({actor:f.actor().actorId(),x:f.x,y:f.y})),visible:SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&!s._character.isTransparent()&&["$002","$003"].indexOf(s._character.characterName())>=0).length})');assert.equal(counts.visible,party.length-1);
        await q.map(54,10,22.5);await q.sleep(200);assert.equal(await q.evaluate('$gameMap.isEventRunning()'),false);
        reports.push({party,expected,post,after:{...after,trace:undefined},returnTrace:after.trace.slice(-120),resumed:counts});console.log('PASS '+party+' dialogue, walking return, camera, follower handoff, resumed following and reentry');
    }
    assert.equal(await q.evaluate('DataManager.saveGame(81)'),true);await q.evaluate('$gameVariables.setValue(60,0);true');assert.equal(await q.evaluate('DataManager.loadGame(81)'),true);await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','completed save/load');assert.equal(await q.evaluate('$gameVariables.value(60)'),2);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({forcedVictoryForCleanup:true,saveLoad:true,cases:reports},null,2));console.log('PASS completed save/load');
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
