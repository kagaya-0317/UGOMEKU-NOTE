// Real-engine verification using an isolated profile and the native troop page.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {connect} = require('./qa_client.cjs'), dialogue = require('./tsunehi_opening_dialogue.cjs');
const root = path.resolve(__dirname,'../..'), out = path.join(root,'artifacts/tsunehi-battle-opening-20261120');
async function main() {
    const q = await connect(), cases = [];
    try {
        await q.call('Page.reload');
        await q.until('!!window.$gameMap&&DataManager.isDatabaseLoaded()&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()', 'fresh isolated boot',40000);
        assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'),'road-intro-capture');
        await q.prepare();
        await q.evaluate(fs.readFileSync(path.join(root,'tools/gnuro_prebattle/driver.js'),'utf8'));
        await q.evaluate(`
            __gnuroIntroQA.auto=false;__castleQA.auto=true;
            Window_Message.prototype.getMessageSpeed=function(){return 0;};
            window.__tsuOpeningQA={hits:[],messages:[]};
            var add=Game_Message.prototype.add;
            Game_Message.prototype.add=function(text){
                if($gameParty.inBattle()&&$gameTroop._troopId===48){
                    __tsuOpeningQA.messages.push(text);
                    if(${JSON.stringify(dialogue.flatMap(p=>p.lines))}.indexOf(text)>=0)__castleQA.auto=false;
                }
                return add.apply(this,arguments);
            };
            var damage=Scene_NewBattle.prototype.applyDamage;
            Scene_NewBattle.prototype.applyDamage=function(subject,target,skillId){
                if($gameTroop._troopId===48)__tsuOpeningQA.hits.push({subject:subject.isActor()?subject.actorId():'enemy',target:target.isActor()?target.actorId():'enemy',during:$gameTroop.isEventRunning()});
                return damage.apply(this,arguments);
            };true`);
        const shot = async name => {
            const png = await q.evaluate('new Promise(function(resolve){var render=Graphics.render;Graphics.render=function(stage){var draws=this._skipCount<=0;render.apply(this,arguments);if(!draws)return;Graphics.render=render;resolve(Graphics._canvas.toDataURL("image/png").split(",")[1]);};})');
            fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64'));
        };
        const idle = () => q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&ImageManager.isReady()', 'normal map return',40000);
        const layoutOnly=process.argv.includes('--layout-only');
        const parties=layoutOnly?[[2,3,4]]:[[2,3,4],[2,4,3],[2,3],[2,4],[2]];
        for(const [caseIndex,party] of parties.entries()) {
            await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameParty.members().forEach(function(a){a.addParam(0,10000);a.setHp(a.mhp);});__castleQA.auto=true;__tsuOpeningQA={hits:[],messages:[]};$gameVariables.setValue(67,0);true`);
            if(caseIndex===0) {
                await q.map(62,10,19.5,8);
                await q.evaluate('__gnuroIntroQA.route(10,18.5);true');
                await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()', 'walk to throne trigger boundary');
                await q.evaluate('$gamePlayer.moveStraight(8);true');
                await q.until('!!$gameTemp._castleUpperScene||$gameVariables.value(67)===1','native throne trigger');
            } else {
                await q.map(62,10,24,8);
                await q.evaluate('BattleManager.setup(48,false,false);SceneManager.push(Scene_NewBattle);true');
            }
            await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','native Tsunehi battle');
            const bubbles=[];
            for(const [index,spec] of dialogue.entries()) {
                if(spec.who!=='enemy'&&!party.includes(spec.who))continue;
                const match=JSON.stringify(JSON.stringify(spec.lines));
                await q.until(`SceneManager._scene._messageWindow.pause&&JSON.stringify($gameMessage._texts)===${match}`,'opening popup '+index,30000);
                const state=await q.evaluate(`(function(){var s=SceneManager._scene,w=s._messageWindow;return {text:$gameMessage._texts.slice(),speaker:s._castleTsunehiSpeaker,turn:$gameTroop.turnCount(),eventFlags:$gameTroop._eventFlags,tone:$gameVariables.value(14),shape:w._fukidashiSprite._fukidashiDrawType,rect:[w.x,w.y,w.width,w.height],party:s._actorSprites.map(function(sp){return sp._battler.actorId();}),hits:__tsuOpeningQA.hits.slice()};})()`);
                assert.equal(state.speaker,spec.who);assert.equal(state.turn,0);
                assert.equal(state.tone,spec.tone||0);assert.equal(state.shape,spec.tone||0);
                assert.deepEqual(state.party,party);assert.equal(state.hits.length,0);
                assert.ok(state.rect[0]>=0&&state.rect[1]>=0&&state.rect[0]+state.rect[2]<=816&&state.rect[1]+state.rect[3]<=624,'Popup within screen');
                bubbles.push(state);
                if(caseIndex===0&&[0,3,4].includes(index))await shot(['mii','','','tsunehi','yume'][index]);
                await q.evaluate('__castleQA.auto=true;SceneManager._scene._messageWindow.updateInput();__castleQA.auto=false;true');
                await q.until(`JSON.stringify($gameMessage._texts)!==${match}`,'advance popup');
            }
            await q.until('!$gameTroop.isEventRunning()&&!$gameMessage.isBusy()','opening finished');
            const clean=await q.evaluate('({popup:$gameSystem.getMessagePopupFree(),target:$gameSystem.getMessagePopupId(),fukidashi:$gameMessage._fukidashi,tone:$gameVariables.value(14),speaker:SceneManager._scene._castleTsunehiSpeaker,enemyAttacks:$gameSwitches.value(16),allyAttacks:$gameSwitches.value(17)})');
            assert.ok(!clean.popup&&!clean.target&&!clean.fukidashi&&!clean.tone);
            assert.equal(clean.speaker,undefined);assert.equal(clean.enemyAttacks,false);assert.equal(clean.allyAttacks,false);
            // Runtime HP padding allows observing resumed attacks without changing balance data.
            await q.evaluate('$gameTroop.members()[0].addParam(0,100000);$gameTroop.members()[0].setHp($gameTroop.members()[0].mhp);true');
            await q.until('__tsuOpeningQA.hits.some(function(h){return h.subject==="enemy";})&&__tsuOpeningQA.hits.some(function(h){return h.subject!=="enemy";})&&$gameTroop.turnCount()>=2','normal attacks after dialogue',45000);
            const after=await q.evaluate('({turn:$gameTroop.turnCount(),messages:__tsuOpeningQA.messages.slice(),hits:__tsuOpeningQA.hits.slice(),flags:$gameTroop._eventFlags})');
            const expected=dialogue.filter(p=>p.who==='enemy'||party.includes(p.who)).flatMap(p=>p.lines);
            assert.deepEqual(after.messages.filter(t=>expected.includes(t)),expected);
            assert.ok(after.hits.every(h=>!h.during));assert.equal(after.flags[0],true);
            await q.evaluate('__castleQA.auto=true;$gameTroop.members().forEach(function(e){e.setHp(0);});true');
            await idle();
            if(caseIndex===0) {
                assert.equal(await q.evaluate('$gameVariables.value(67)'),2);
                assert.equal(await q.evaluate('$gamePlayer.followers().isVisible()'),true);
                const saves=await q.evaluate('StorageManager.localFileDirectoryPath()');assert.ok(saves.includes('codex-road-intro-capture-20261120-saves'));
                const slot=await q.evaluate('(function(){for(var n=600;n<700;n++)if(!StorageManager.exists(n))return n;throw Error("No test slot");})()');
                await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate(`DataManager.saveGame(${slot})`),true);
                assert.equal(await q.evaluate(`DataManager.loadGame(${slot})`),true);
                await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await idle();
                assert.equal(await q.evaluate('$gameVariables.value(67)'),2);
                await q.map(62,10,18.5,8);await idle();assert.equal(await q.evaluate('$gameParty.inBattle()'),false);
            }
            cases.push({party,bubbles,clean,after,nativeMapEntry:caseIndex===0,forcedVictoryForReturnCheck:true});
            console.log('PASS party '+party+': turn-zero dialogue once, all speakers, popup cleanup and attacks resumed');
        }
        fs.writeFileSync(path.join(out,layoutOnly?'layout-verification.json':'verification.json'),JSON.stringify({cases,nativeMapEntry:true,nativeSaveLoad:true,completedReentry:true},null,2)+'\n');
    } finally { q.ws.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
