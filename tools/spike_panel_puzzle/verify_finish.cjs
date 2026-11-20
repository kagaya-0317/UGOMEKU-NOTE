// Native final-panel animation and serialized-save restoration checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('../castle_upper_maps/qa_client.cjs');
const out=path.resolve(__dirname,'../../artifacts/spike-panel-finish-retraction-20261119');
async function main(){
 const data=JSON.parse(fs.readFileSync(path.join(out,'video-verification.json'))),f=data.finish;
 assert.ok(f.before&&!f.before.complete);assert.equal(f.frames.length,240);
 const prior=new Map(f.before.cells),seen=new Set();
 for(const row of f.frames){
  assert.equal(row.complete,true);assert.equal(row.active,0);
  for(const [id,cell] of row.cells){assert.ok(cell>=prior.get(id),'spike rose after completion');prior.set(id,cell);seen.add(cell);}
  if(row.retracting){assert.equal(row.cameraHeld,true);assert.deepEqual(row.camera,[10.5,19]);}
 }
 assert.deepEqual([...seen].sort(),[3,4,5,6]);
 assert.ok(f.frames.at(-1).cells.every(([id,c])=>c===6));
 assert.ok(f.savedElapsed>=6&&f.savedElapsed<18);
 const q=await connect();try{
  assert.equal(await q.evaluate('require("nw.gui").App.manifest.name'),'castle-map-qa');
  await q.evaluate('__castleQA.auto=true;true');await q.map(61,10,9);
  // Map data must be 61 before restoring the saved runtime and event interpreters.
  await q.evaluate(`window.__finishRestore=[];var originalMapUpdate=Game_Map.prototype.update;Game_Map.prototype.update=function(){originalMapUpdate.apply(this,arguments);if(this.mapId()!==61||!this._spikePanelRuntime)return;var s=this._spikePanelRuntime;if(s.retraction&&__finishRestore.length<60)__finishRestore.push({elapsed:s.retraction.elapsed,cells:s.traps.map(function(id){return [id,$gameMap.event(id)._spikePanelCell];}),active:s.traps.filter(function(id){return $gameMap.event(id)._spikeFloorActive;}).length});};DataManager.extractSaveContents(JsonEx.parse(${JSON.stringify(f.savedMidRetraction)}));SceneManager.goto(Scene_Map);true`);
  await q.until('SceneManager._scene instanceof Scene_Map&&SceneManager._sceneStarted&&!SceneManager._nextScene&&__finishRestore.length>=20&&!KNH_SpikePanel.isRetracting()&&!$gameMap.isEventRunning()&&!$gameMessage.isBusy()','restored completion',30000);
  const restored=await q.evaluate('({status:KNH_SpikePanel.status(),frames:__finishRestore,done:$gameSelfSwitches.value([61,1,"A"]),cameraHeld:$gameMap._spikePanelRuntime.cameraHeld})');
  assert.equal(restored.status.on.length,8);assert.equal(restored.status.complete,true);assert.equal(restored.done,true);assert.equal(restored.cameraHeld,false);
  assert.ok(restored.frames.some(x=>x.elapsed<18),'restoration skipped animation');
  for(const row of restored.frames){assert.equal(row.active,0);assert.ok(row.elapsed>=f.savedElapsed);assert.ok(row.cells.every(([id,c])=>c>=4));}
  await q.map(60,32,12.5);await q.map(61,10,9);await q.sleep(400);
  const reentry=await q.evaluate('(function(){var s=$gameMap._spikePanelRuntime;return {status:KNH_SpikePanel.status(),done:$gameSelfSwitches.value([61,1,"A"]),cells:s.traps.map(function(id){return $gameMap.event(id)._spikePanelCell;}),running:$gameMap.isEventRunning(),keyCount:$gameParty.numItems($dataItems[54])};})()');
  assert.equal(reentry.status.complete,true);assert.equal(reentry.status.retracting,false);assert.equal(reentry.status.on.length,8);assert.ok(reentry.cells.every(c=>c===6));assert.equal(reentry.running,false);assert.equal(reentry.done,true);
  const report={renderedTransition:[3,4,5,6],noSpikeReraising:true,completedDamageDisabled:true,cameraHeldUntilRetraction:true,savedElapsed:f.savedElapsed,restoredElapsedRange:[restored.frames[0].elapsed,restored.frames.at(-1).elapsed],nativeSerializedSaveRestore:true,completedReentry:true,panelCount:8};
  fs.writeFileSync(path.join(out,'finish-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{q.ws.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
