const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('./client.cjs');
const out=path.resolve(__dirname,'../../artifacts/gnuro-popup-fit-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const q=await connect();try{
    await q.ready();await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gamePlayer.refresh();$gameVariables.setValue(60,0);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));
    await q.evaluate('Window_Message.prototype.getMessageSpeed=function(){return 0;};true');
    await q.map(54,10,22.5);await q.evaluate('__gnuroIntroQA.route(10,18.5);true');
    const report=[],saved=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/Map054.json'),'utf8')).events[3].pages[0].list;
    const expected=saved.slice(0,saved.findIndex(c=>c.code===301)).filter(c=>c.code===101).length;
    for(let i=0;i<expected;i++){
        await q.until('$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause&&!SceneManager._scene._messageWindow._textState','prebattle bubble '+i,35000);await q.sleep(120);
        const info=await q.evaluate('({text:$gameMessage._texts.slice(),rect:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,w:SceneManager._scene._messageWindow.width,h:SceneManager._scene._messageWindow.height},textRect:SceneManager._scene._messageWindow._textRect,fixed:$gameMessage._popupHeight,feet:[$gamePlayer.screenY(),$gameMap.event(5).screenY(),$gameMap.event(6).screenY()]})');
        assert.ok(info.text.every(t=>t.length>0));assert.ok(info.rect.y>=0&&info.rect.x>=0&&info.rect.y+info.rect.h<=624&&info.rect.x+info.rect.w<=816,'Bubble fits the screen');assert.ok(info.textRect.height<99,'No inherited fixed height');assert.ok(info.feet.every(y=>y<=604),'Whole party remains visible');
        if(i===0||i===3){const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,i===0?'prebattle_intro.png':'prebattle_laugh.png'),Buffer.from(png,'base64'));}
        report.push(info);console.log(JSON.stringify(info));const prior=JSON.stringify(info.text);
        await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');
        await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(prior)}`,'advance bubble');await q.sleep(200);
    }
    await q.until('SceneManager._scene instanceof Scene_NewBattle&&SceneManager._sceneStarted&&!SceneManager._nextScene','native battle transition',35000);
    assert.equal(await q.evaluate('$gameTroop._troopId'),43);
    fs.writeFileSync(path.join(out,'prebattle-verification.json'),JSON.stringify({savedEventNormalWalkingEntry:true,bubbles:report,nativeBattle:true},null,2));console.log('PASS all '+expected+' prebattle bubbles and native battle transition');
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
