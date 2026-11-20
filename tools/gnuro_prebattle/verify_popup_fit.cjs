// Focused native-engine replay of the saved map's postbattle continuation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('./client.cjs');
const out=path.resolve(__dirname,'../../artifacts/gnuro-popup-fit-20261119');fs.mkdirSync(out,{recursive:true});
async function main(){const q=await connect();try{
    await q.ready();await q.call('Page.reload');await q.ready();
    await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gamePlayer.refresh();$gameVariables.setValue(60,0);true');
    await q.evaluate(fs.readFileSync(path.join(__dirname,'driver.js'),'utf8'));await q.map(54,10,22.5);
    await q.evaluate('KNH_CastleUpper.beginScene(1);true');await q.until('!KNH_CastleUpper.isForming()','native formation');
    const report=[];
    // The battle return was already verified. Start at its saved continuation.
    await q.evaluate('var saved=$dataMap.events[3].pages[0].list;var start=saved.findIndex(c=>c.code===355&&c.parameters[0]===\'delete $gameTemp._gnuroMapIntro;\');$gameVariables.setValue(60,2);$gameMap._interpreter.setup(saved.slice(start),3);true');
    for(let i=1;i<=3;i++){
        await q.until('$gameMessage.isBusy()&&SceneManager._scene._messageWindow.pause&&!SceneManager._scene._messageWindow._textState','bubble '+i);await q.sleep(150);
        const info=await q.evaluate('({text:$gameMessage._texts.slice(),rect:{x:SceneManager._scene._messageWindow.x,y:SceneManager._scene._messageWindow.y,w:SceneManager._scene._messageWindow.width,h:SceneManager._scene._messageWindow.height},textRect:SceneManager._scene._messageWindow._textRect,fixed:$gameMessage._popupHeight})');
        assert.ok(info.text.every(t=>t.length>0));assert.ok(info.rect.y>=0&&info.rect.x>=0&&info.rect.y+info.rect.h<=624&&info.rect.x+info.rect.w<=816);assert.ok(info.textRect.height<99,'Native text height must replace the old forced 99px');
        const png=await q.evaluate("Graphics._renderer.render(SceneManager._scene);Graphics._canvas.toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'postbattle_'+i+'.png'),Buffer.from(png,'base64'));report.push(info);console.log(JSON.stringify(info));
        const prior=JSON.stringify(info.text);
        await q.evaluate('__gnuroIntroQA.advance=true;SceneManager._scene._messageWindow.updateInput();__gnuroIntroQA.advance=false;true');
        await q.until(`JSON.stringify($gameMessage._texts)!==${JSON.stringify(prior)}`,'advance bubble');await q.sleep(250);
    }
    assert.ok(report[2].rect.h<report[0].rect.h,'One line must be shorter than two lines');
    await q.until('!$gameMap.isEventRunning()&&!$gameMessage.isBusy()&&!$gameTemp._castleUpperScene','normal cleanup');
    assert.deepEqual(await q.evaluate('$gamePlayer._centerXy'),[0,0]);assert.equal(await q.evaluate('$gamePlayer.followers().isVisible()'),true);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({focusedSavedEventReplay:true,bubbles:report,cleanup:true},null,2));console.log('PASS native text sizing and scene cleanup');
}finally{q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
