// Native regression checks for the opening balloon and walking follower return.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {connect} = require('../castle_upper_maps/qa_client.cjs');
const pages = require('./intro_dialogue.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'artifacts/road-intro-balloon-return-20261120');
const near = (a, b) => Math.abs(a - b) < 0.00001;
async function main() {
    const q = await connect(), cases = [];
    try {
        await q.call('Page.reload');
        await q.until('!!window.$gameMap&&DataManager.isDatabaseLoaded()&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()', 'isolated boot', 40000);
        assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'), 'road-intro-capture');
        await q.prepare();
        await q.evaluate(fs.readFileSync(path.join(root, 'tools/spike_panel_puzzle/driver.js'), 'utf8'));
        await q.evaluate(`
            __spikeDriver.autoMessage=false;
            Window_Message.prototype.getMessageSpeed=function(){return 0;};
            window.__returnQA={};
            function partyFollower(id){return $gamePlayer.followers()._data.filter(function(f){var a=f.actor();return a&&a.actorId()===id;})[0];}
            function characterState(c){return {x:c._realX,y:c._realY,direction:c.direction(),moving:c.isMoving()};}
            var balloon=Game_CharacterBase.prototype.requestBalloon;
            Game_CharacterBase.prototype.requestBalloon=function(id){if($gameMap.mapId()===63)__returnQA.balloons.push({hero:this===$gamePlayer,id:id});return balloon.apply(this,arguments);};
            var returning=KNH_CastleUpper.returnScene;
            KNH_CastleUpper.returnScene=function(){var s=$gameTemp._castleUpperScene;
                if(s&&s.mapId===63){__returnQA.targets=s.members.map(function(m){return {actor:m.actorId,target:characterState(partyFollower(m.actorId)),start:characterState($gameMap.event(m.eventId))};});}
                return returning.apply(this,arguments);
            };
            var end=KNH_CastleUpper.endScene;
            KNH_CastleUpper.endScene=function(){var s=$gameTemp._castleUpperScene,road=s&&s.mapId===63;
                if(road)__returnQA.beforeHandoff=s.members.map(function(m){return {actor:m.actorId,position:characterState($gameMap.event(m.eventId))};});
                var result=end.apply(this,arguments);
                if(road)__returnQA.afterHandoff=__returnQA.targets.map(function(t){return {actor:t.actor,position:characterState(partyFollower(t.actor))};});
                return result;
            };
            var update=SceneManager.updateScene;
            SceneManager.updateScene=function(){var result=update.apply(this,arguments),s=$gameTemp&&$gameTemp._castleUpperScene;
                if(s&&s.mapId===63&&s.returning)__returnQA.returnFrames.push({locked:$gameMap.isEventRunning(),members:s.members.map(function(m){return {actor:m.actorId,position:characterState($gameMap.event(m.eventId))};})});
                return result;
            };
            window.__returnOriginalRender=Graphics.render;
            Graphics.render=function(stage){var draws=this._skipCount<=0;__returnOriginalRender.apply(this,arguments);
                if(!draws||!__returnQA.captureOpening||__returnQA.openingPng||!SceneManager._scene._spriteset)return;
                var sp=SceneManager._scene._spriteset._characterSprites.filter(function(s){return s._character===$gamePlayer;})[0],b=sp&&sp._balloonSprite,w=SceneManager._scene._messageWindow;
                if(b&&b._duration<58&&b._duration>12&&w&&w.pause&&$gameMessage._texts[0]===${JSON.stringify(pages[0].lines[0])}){
                    __returnQA.openingPng=Graphics._canvas.toDataURL('image/png').split(',')[1];
                    __returnQA.opening={text:$gameMessage._texts.slice(),balloonId:b._balloonId,balloonDuration:b._duration,balloonVisible:b.worldVisible,balloonFrame:[b._frame.x,b._frame.y,b._frame.width,b._frame.height]};
                }
            };true`);
        async function screenshot(name) {
            const png = await q.evaluate('new Promise(function(resolve){var render=Graphics.render;Graphics.render=function(stage){var draws=this._skipCount<=0;render.apply(this,arguments);if(!draws)return;Graphics.render=render;resolve(Graphics._canvas.toDataURL("image/png").split(",")[1]);};})');
            fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
        }
        const openingOnly = process.argv.includes('--opening-only');
        const parties = openingOnly ? [[2,3,4]] : [[2,3,4], [2,4,3], [2,3], [2,4], [2]];
        for (const [index, party] of parties.entries()) {
            await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameSelfSwitches.setValue([63,3,"A"],false);__castleQA.auto=${index!==0};__castleQA.messages=[];__returnQA={balloons:[],returnFrames:[],captureOpening:${index===0}};true`);
            await q.map(63, 5.5, 10.5, 6);
            await q.evaluate('$gameScreen.startFadeIn(1);__spikeDriver.go(11,10.5)');
            for (let i = 0; i < 3; i++) {
                if (await q.evaluate('!!$gameTemp._castleUpperScene')) break;
                await q.evaluate('$gamePlayer.moveStraight(6);true');
                await q.until('!$gamePlayer.isMoving()', 'native trigger approach');
            }
            if (index === 0) {
                await q.until('!!__returnQA.openingPng', 'native exclamation with first dialogue');
                const png = await q.evaluate('__returnQA.openingPng');
                fs.writeFileSync(path.join(out, 'intro-exclamation.png'), Buffer.from(png, 'base64'));
                await q.evaluate('__returnQA.openingPng=null;__returnQA.captureOpening=false;__castleQA.auto=true;true');
            }
            await q.until('$gameSelfSwitches.value([63,3,"A"])&&!$gameMap.isEventRunning()&&!$gameTemp._castleUpperScene', 'walk back and finish', 40000);
            await q.sleep(180);
            const report = await q.evaluate(`(function(){var q=__returnQA;return {party:$gameParty._actors.slice(),balloons:q.balloons,opening:q.opening,targets:q.targets,beforeHandoff:q.beforeHandoff,afterHandoff:q.afterHandoff,returnFrames:q.returnFrames,followers:$gamePlayer.followers().isVisible(),proxiesHidden:[4,5].every(function(id){return $gameMap.event(id).isTransparent();}),camera:$gamePlayer._centerXy.slice(),messages:__castleQA.messages.slice(),rendered:SceneManager._scene._spriteset._characterSprites.filter(function(sp){return sp.visible&&sp.opacity>0&&!sp._character.isTransparent()&&['$001','$002','$003'].indexOf(sp._character.characterName())>=0;}).map(function(sp){return sp._character.characterName();})};})()`);
            assert.deepEqual(report.party, party);
            assert.deepEqual(report.balloons, [{hero:true,id:11}]);
            assert.equal(report.followers, true);
            assert.equal(report.proxiesHidden, true);
            assert.deepEqual(report.camera, [0,0]);
            const expected = pages.filter(p => p.speaker === 'tsunehi' || (p.speaker === 4 ? party.includes(4) : party.includes(3) || party.includes(4))).flatMap(p => p.lines);
            assert.deepEqual(report.messages, expected);
            for (const target of report.targets) {
                const before = report.beforeHandoff.find(m => m.actor === target.actor).position;
                const after = report.afterHandoff.find(m => m.actor === target.actor).position;
                assert.ok(near(before.x,target.target.x) && near(before.y,target.target.y), 'walked to actual follower position');
                assert.equal(before.moving, false);
                assert.deepEqual(after, before, 'handoff preserves position and direction');
                const distinct = new Set(report.returnFrames.map(f => {const p=f.members.find(m=>m.actor===target.actor).position;return p.x.toFixed(4)+','+p.y.toFixed(4);}));
                assert.ok(distinct.size > 2, 'visible return uses multiple walking frames');
            }
            assert.ok(report.returnFrames.every(f=>f.locked), 'controls locked until walking finishes');
            assert.equal(report.rendered.filter(n=>n==='$002').length, party.includes(3)?1:0);
            assert.equal(report.rendered.filter(n=>n==='$003').length, party.includes(4)?1:0);
            if (index === 0) {
                assert.equal(report.opening.balloonVisible, true);
                assert.deepEqual(report.opening.text, pages[0].lines);
                await screenshot('party-returned.png');
            }
            await q.evaluate('__spikeDriver.go(17,11)');
            const count = await q.evaluate('__returnQA.balloons.length');
            await q.map(63, 5.5, 10.5, 6);
            await q.evaluate('__spikeDriver.go(17,10.5)');
            assert.equal(await q.evaluate('__returnQA.balloons.length'), count);
            assert.equal(await q.evaluate('$gameMap.isEventRunning()'), false);
            report.onceOnReentry = true;
            cases.push(report);
            console.log('PASS party ' + party + ': opening balloon, walking return, handoff, resumed following and reentry');
        }
        const saveDirectory = await q.evaluate('StorageManager.localFileDirectoryPath()');
        assert.ok(saveDirectory.includes('codex-road-intro-capture-20261120-saves'));
        const slot = await q.evaluate('(function(){for(var i=500;i<600;i++)if(!StorageManager.exists(i))return i;throw Error("No QA slot");})()');
        await q.evaluate('$gameSystem.onBeforeSave();true');
        assert.equal(await q.evaluate(`DataManager.saveGame(${slot})`), true);
        await q.evaluate('$gameSelfSwitches.setValue([63,3,"A"],false);true');
        assert.equal(await q.evaluate(`DataManager.loadGame(${slot})`), true);
        await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');
        await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gameMap.isEventRunning()&&ImageManager.isReady()', 'saved completion reload');
        assert.equal(await q.evaluate('$gameSelfSwitches.value([63,3,"A"])'), true);
        assert.equal(await q.evaluate('$gamePlayer.followers().isVisible()'), true);
        fs.writeFileSync(path.join(out, openingOnly ? 'opening-verification.json' : 'verification.json'), JSON.stringify({cases,nativeSaveLoad:true,saveDirectory,saveSlot:slot}, null, 2) + '\n');
    } finally {
        q.ws.close();
    }
}
main().catch(e => { console.error(e); process.exitCode=1; });
