// Native walking into the selected dialogue, popup geometry, party handoff and persistence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('../castle_upper_maps/qa_client.cjs');
const root=path.resolve(__dirname,'../..'),outArg=process.argv.indexOf('--out'),out=outArg>=0?path.resolve(root,process.argv[outArg+1]):path.join(root,'artifacts/road-approach-tsunehi-intro-20261119');
const captureApp=process.argv.includes('--capture-app');
const expected=require('./intro_dialogue.cjs').map(p=>({voice:p.speaker==='tsunehi',actorId:typeof p.speaker==='number'?p.speaker:null,text:p.lines,tone:p.tone,laugh:p.laugh,shot:p.shot}));
async function main(){const q=await connect(),reports=[];try{
 await q.call('Page.reload');await q.until('!!window.$gameMap&&DataManager.isDatabaseLoaded()&&SceneManager._sceneStarted&&!SceneManager._nextScene&&ImageManager.isReady()','boot',40000);assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'),captureApp?'road-intro-capture':'castle-map-qa');await q.prepare();
 await q.evaluate(fs.readFileSync(path.join(root,'tools/spike_panel_puzzle/driver.js'),'utf8'));
 await q.evaluate(`__spikeDriver.autoMessage=false;__castleQA.auto=false;Window_Message.prototype.getMessageSpeed=function(){return 0;};
 window.__roadIntroQA={messages:[],frames:[],laughPatterns:[]};var add=Game_Message.prototype.add;Game_Message.prototype.add=function(text){__roadIntroQA.messages.push(text);return add.apply(this,arguments);};
 var update=SceneManager.updateScene;SceneManager.updateScene=function(){var result=update.apply(this,arguments);var s=$gameTemp&&$gameTemp._castleUpperScene;
 if(s&&s.mapId===63){var people=[{actor:2,x:$gamePlayer._realX,y:$gamePlayer._realY,visible:!$gamePlayer.isTransparent()}];s.members.forEach(function(m){var e=$gameMap.event(m.eventId);people.push({actor:m.actorId,x:e._realX,y:e._realY,visible:!e.isTransparent()});});__roadIntroQA.frames.push(people);var w=SceneManager._scene._messageWindow;if(w&&w._popupPortraitInfo&&w._popupPortraitInfo.direction===4)__roadIntroQA.laughPatterns.push(w._popupPortraitCurrentPattern);}
 return result;};true`);
 const idle=()=>q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&!$gamePlayer.isTransferring()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gamePlayer.isMoving()&&ImageManager.isReady()','idle map',35000);
 const go=(x,y)=>q.evaluate(`__spikeDriver.go(${x},${y})`);
 async function step(d){await q.evaluate(`$gamePlayer.moveStraight(${d});true`);await q.until('!$gamePlayer.isMoving()','step');}
 async function exit(d,map){for(let i=0;i<10;i++){if(await q.evaluate(`$gameMap.mapId()===${map}||$gamePlayer.isTransferring()`))break;await q.evaluate(`if(!$gameMap.isEventRunning()&&!$gamePlayer.isMoving())$gamePlayer.moveStraight(${d});true`);await q.sleep(160);}await q.until(`$gameMap.mapId()===${map}`,'walking transfer');await idle();}
 const layoutOnly=process.argv.includes('--layout-only');
 const parties=layoutOnly?[[2,3,4]]:[[2,3,4],[2,4,3],[2,3],[2,4],[2]];
 for(const [index,party]of parties.entries()){
  await q.evaluate(`$gameParty._actors=${JSON.stringify(party)};$gamePlayer.refresh();$gameVariables.setValue(60,2);$gameSelfSwitches.setValue([63,3,"A"],false);__roadIntroQA.messages=[];__roadIntroQA.frames=[];__roadIntroQA.laughPatterns=[];__castleQA.auto=false;true`);
  if(index===0){await q.map(54,10,10,8);await exit(8,63);assert.equal(await q.evaluate('!!$gameTemp._castleUpperScene'),false);await go(5.5,10.5);}else await q.map(63,5.5,10.5,6);
  await q.evaluate('$gameScreen.startFadeIn(1);true');assert.equal(await q.evaluate('[4,5].every(function(id){return $gameMap.event(id).isTransparent();})'),true);await go(11,10.5);
  if(index===3)await q.evaluate('$gamePlayer.setMoveSpeed(3);$gamePlayer.setDirectionFix(true);true');
  const initial=await q.evaluate('({speed:$gamePlayer._moveSpeed,directionFix:$gamePlayer.isDirectionFixed(),camera:$gamePlayer._centerXy.slice(),progress:$gameVariables._data.slice(60,68)})');
  for(let i=0;i<3;i++){if(await q.evaluate('!!$gameTemp._castleUpperScene'))break;await step(6);}
  const bubbles=[];
  if(index===0){for(const spec of expected){
   const match=JSON.stringify(JSON.stringify(spec.text));await q.until(`$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause&&!SceneManager._scene._messageWindow._textState&&JSON.stringify($gameMessage._texts)===${match}`,'selected dialogue '+spec.text[0],35000);await q.sleep(140);
   const info=await q.evaluate(`(function(){var w=SceneManager._scene._messageWindow;var s=$gameTemp._castleUpperScene;var roots=SceneManager._scene._spriteset._characterSprites.filter(function(sp){return sp.visible&&sp.opacity>0&&!sp._character.isTransparent()&&["$001","$002","$003"].indexOf(sp._character.characterName())>=0;});return {text:$gameMessage._texts.slice(),tone:$gameVariables.value(14),shape:w._fukidashiSprite._fukidashiDrawType,tail:$gameMessage._tailDir,portrait:$gameMessage.popupPortrait(),portraitVisible:!!(w._popupPortraitLayer&&w._popupPortraitLayer.visible&&w._popupPortraitSprite&&w._popupPortraitSprite.worldVisible),rect:[w.x,w.y,w.width,w.height],popup:$gameSystem.getMessagePopupId(),hero:[$gamePlayer.x,$gamePlayer.y],heroDirection:$gamePlayer.direction(),members:s.members.map(function(m){var e=$gameMap.event(m.eventId);return {actor:m.actorId,xy:[e.x,e.y],direction:e.direction()};}),renderedPartyRoots:roots.map(function(sp){return sp._character.characterName();})};})()`);
   assert.equal(info.tone,spec.tone);assert.equal(info.shape,spec.tone);assert.ok(info.rect[0]>=0&&info.rect[1]>=0&&info.rect[0]+info.rect[2]<=816&&info.rect[1]+info.rect[3]<=624,'Popup clipped');assert.deepEqual(info.hero,[14,11]);assert.deepEqual(info.members.map(m=>m.xy),[[12.5,10],[12.5,12]]);assert.equal(info.heroDirection,6);assert.ok(info.members.every(m=>m.direction===6));
   assert.equal(info.renderedPartyRoots.filter(n=>n==='$002').length,1);assert.equal(info.renderedPartyRoots.filter(n=>n==='$003').length,1);
   if(spec.voice){assert.equal(info.portrait.fileName,'$kanbu2_2');assert.equal(info.portraitVisible,true);assert.equal(info.tail,5);}else{assert.equal(info.portrait,null);assert.equal(info.popup,spec.actorId===4?5:4);assert.equal(info.tail,spec.actorId===4?6:2);}
   if(spec.laugh){
    await q.sleep(400);assert.deepEqual(await q.evaluate('Array.from(new Set(__roadIntroQA.laughPatterns)).sort()'),[0,1,2]);
    info.laughInkTops=await q.evaluate('(function(){var w=SceneManager._scene._messageWindow,sp=w._popupPortraitSprite,bm=ImageManager.loadCharacter("$kanbu2_2"),fw=bm.width/3,fh=bm.height/4,tops=[];for(var p=0;p<3;p++){var data=bm._context.getImageData(p*fw,fh,fw,fh).data,minY=fh;for(var y=0;y<fh;y++)for(var x=0;x<fw;x++)if(data[(y*fw+x)*4+3]>0)minY=Math.min(minY,y);tops.push(sp.toGlobal(new PIXI.Point(0,minY-fh)).y);}return tops;})()');
    assert.ok(info.laughInkTops.every(y=>y>=8),'Animated laugh clipped at screen top');
    info.laughTextOverlap=await q.evaluate('(function(){var w=SceneManager._scene._messageWindow,sp=w._popupPortraitSprite,bm=ImageManager.loadCharacter("$kanbu2_2"),fw=bm.width/3,fh=bm.height/4,content=w.contents,ink=content._context.getImageData(0,0,content.width,content.height).data,cs=w._windowContentsSprite,counts=[];for(var p=0;p<3;p++){var image=bm._context.getImageData(p*fw,fh,fw,fh).data,count=0;for(var y=0;y<fh;y++)for(var x=0;x<fw;x++){if(image[(y*fw+x)*4+3]===0)continue;var world=sp.toGlobal(new PIXI.Point(x-fw/2,y-fh)),local=cs.toLocal(world),ix=Math.round(local.x),iy=Math.round(local.y),hit=false;for(var dy=-3;dy<=3&&!hit;dy++)for(var dx=-3;dx<=3;dx++){var cx=ix+dx,cy=iy+dy;if(cx>=0&&cy>=0&&cx<content.width&&cy<content.height&&ink[(cy*content.width+cx)*4+3]>0){hit=true;break;}}if(hit)count++;}counts.push(count);}return counts;})()');
    assert.deepEqual(info.laughTextOverlap,[0,0,0],'Laugh portrait overlaps dialogue glyphs');
   }
   // Read inside a native draw; a second out-of-frame render can show stale masks.
   if(spec.shot){const png=await q.evaluate('new Promise(function(resolve){var render=Graphics.render;Graphics.render=function(stage){var draws=this._skipCount<=0;render.apply(this,arguments);if(!draws)return;Graphics.render=render;resolve(Graphics._canvas.toDataURL("image/png").split(",")[1]);};})');fs.writeFileSync(path.join(out,spec.shot),Buffer.from(png,'base64'));}
   bubbles.push(info);await q.evaluate('SceneManager._scene._messageWindow._triggered=true;true');
   // Use the native message input path for exactly one advance.
   await q.evaluate('__castleQA.auto=true;SceneManager._scene._messageWindow.updateInput();__castleQA.auto=false;true');await q.until(`JSON.stringify($gameMessage._texts)!==${match}`,'advance');
  }}else await q.evaluate('__castleQA.auto=true;true');
  await q.until('$gameSelfSwitches.value([63,3,"A"])&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','intro finished',40000);await q.sleep(150);
  const after=await q.evaluate('({party:$gameParty._actors.slice(),speed:$gamePlayer._moveSpeed,directionFix:$gamePlayer.isDirectionFixed(),camera:$gamePlayer._centerXy.slice(),followers:$gamePlayer.followers().isVisible(),hidden:[4,5].every(function(id){return $gameMap.event(id).isTransparent();}),portrait:$gameMessage.popupPortrait(),popup:$gameSystem.getMessagePopupId(),fukidashi:$gameMessage._fukidashi,tail:$gameMessage._tailDir,tone:$gameVariables.value(14),progress:$gameVariables._data.slice(60,68),messages:__roadIntroQA.messages.slice(),frames:__roadIntroQA.frames.length,visibleCounts:__roadIntroQA.frames.map(function(f){return f.filter(function(p){return p.visible;}).length;})})');
  assert.deepEqual(after.party,party);assert.equal(after.speed,initial.speed);assert.equal(after.directionFix,initial.directionFix);assert.deepEqual(after.camera,initial.camera);assert.equal(after.followers,true);assert.equal(after.hidden,true);assert.equal(after.portrait,null);assert.ok(!after.popup);assert.equal(after.fukidashi,false);assert.equal(after.tail,0);assert.equal(after.tone,0);assert.deepEqual(after.progress,initial.progress);
  const lines=expected.filter(s=>s.voice||(s.actorId===4?party.includes(4):party.includes(3)||party.includes(4))).flatMap(s=>s.text);assert.deepEqual(after.messages,lines);assert.ok(after.visibleCounts.every(n=>n===party.length));
  if(index===0){await go(12.5,12);await go(12.5,10);}
  await go(16,11);assert.equal(await q.evaluate('$gameMap.isEventRunning()'),false);
  await q.map(63,5.5,10.5,6);await go(14,10.5);await idle();assert.deepEqual(await q.evaluate('__roadIntroQA.messages'),lines);
  reports.push({party,initial,bubbles,after:{...after,visibleCounts:undefined},onceOnReentry:true});console.log('PASS party '+party+' native intro, portraits, staging, cleanup and reentry');
 }
 if(layoutOnly){fs.writeFileSync(path.join(out,'layout-verification.json'),JSON.stringify({reason:'Popup layouts checked after the final scoped placement adjustment',cases:reports},null,2)+'\n');console.log('PASS final portrait headroom and all native dialogue layouts');return;}
 // Native persistence and old-save event refresh use only the isolated QA directory.
 const directory=await q.evaluate('StorageManager.localFileDirectoryPath()');assert.ok(directory.includes(captureApp?'codex-road-intro-capture-20261120-saves':'codex-castle-upper-maps-qa-saves'));
 const slot=await q.evaluate('(function(){for(var i=320;i<400;i++)if(!StorageManager.exists(i))return i;throw Error("No QA slot");})()');
 await q.evaluate('$gameSystem.onBeforeSave();true');assert.equal(await q.evaluate(`DataManager.saveGame(${slot})`),true);await q.evaluate('$gameSelfSwitches.setValue([63,3,"A"],false);true');assert.equal(await q.evaluate(`DataManager.loadGame(${slot})`),true);await q.evaluate('$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await idle();assert.equal(await q.evaluate('$gameSelfSwitches.value([63,3,"A"])'),true);await go(16,10.5);await idle();
 await go(18.5,10.5);await exit(6,55);await go(1.5,23.5);await exit(4,63);await go(11,10.5);await idle();
 const oldVersion=JSON.parse(fs.readFileSync(path.join(out,'implementation.json'))).versionBefore;
 await q.evaluate(`$gameSelfSwitches.setValue([63,3,"A"],false);$gameSystem.onBeforeSave();$gameSystem._versionId=${oldVersion};[3,4,5].forEach(function(id){$gameMap._events[id]=null;});true`);assert.equal(await q.evaluate(`DataManager.saveGame(${slot})`),true);assert.equal(await q.evaluate(`DataManager.loadGame(${slot})`),true);
 await q.evaluate('Scene_Load.prototype.reloadMapIfUpdated.call({});$gameSystem.onAfterLoad();SceneManager.goto(Scene_Map);true');await idle();assert.equal(await q.evaluate('[3,4,5].every(function(id){return !!$gameMap.event(id);})'),true);await q.evaluate('__castleQA.auto=true;true');await step(6);await step(6);await q.until('$gameSelfSwitches.value([63,3,"A"])&&!$gameMap.isEventRunning()&&!$gameTemp._castleUpperScene','old-save intro',35000);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({cases:reports,nativeSaveLoad:true,oldSaveReload:true,normalRoadTransfers:true,saveSlot:slot},null,2)+'\n');console.log('PASS save/load, old-save map reload and road transfers');
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
