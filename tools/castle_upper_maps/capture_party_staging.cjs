const {connect}=require('./qa_client.cjs'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const q=await connect();try{
 await q.call('Page.reload');await q.until('!!window.$gameMap&&!!window.$dataTemplateEvents&&DataManager.isDatabaseLoaded()&&!!SceneManager._scene&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','fresh staging preview',40000);
 await q.prepare();await q.evaluate('__castleQA.auto=false;true');await q.map(62,10,18.5);await q.evaluate('$gamePlayer.moveStraight(8);true');
 await q.until('!!$gameTemp._castleUpperScene&&$gameMap._interpreter._waitCount>0&&$gameMap._interpreter._waitCount<=12&&!$gameMessage.isBusy()','settled camera before dialogue',30000);
 const png=await q.evaluate('(function(){Graphics._renderer.render(SceneManager._scene);return Graphics._canvas.toDataURL("image/png").split(",")[1];})()');
 const out=path.resolve(__dirname,'../../artifacts/castle-upper-party-staging-20261118');fs.writeFileSync(path.join(out,'tsunehi-formation.png'),Buffer.from(png,'base64'));
 assert.equal(await q.evaluate('SceneManager._scene._spriteset._characterSprites.filter(s=>s.visible&&s.opacity>0&&["$002","$003"].indexOf(s._character.characterName())>=0).length'),2);
 assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'),'castle-map-qa');await q.evaluate('setTimeout(function(){require("nw.gui").App.quit();},100);true');console.log('Captured saved staging; closed dedicated QA app.');
 }finally{q.ws.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
