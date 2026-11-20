// Screenshot the saved axe/bar contact in the dedicated QA playtest on 9341.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/gnuro-impact-check-20261118');
fs.mkdirSync(output, {recursive:true});

async function main() {
    const tabs = await (await fetch('http://127.0.0.1:9341/json')).json();
    const tab = tabs.find(p=>/tools\/yume_skill_preview\/index.html$/.test(p.url));
    assert.ok(tab, 'Use the isolated battle preview');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await once(ws, 'open');
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', event=>{
        const message=JSON.parse(event.data),entry=pending.get(message.id);
        if(!entry)return;
        pending.delete(message.id);
        if(message.error)entry.reject(new Error(JSON.stringify(message.error)));
        else entry.resolve(message.result);
    });
    const call=(method,params={})=>new Promise((resolve,reject)=>{
        const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));
    });
    const evaluate=async expression=>{
        const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
        if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    try {
        await call('Page.reload');
        let ready=false;
        for(let i=0;i<150;i++){
            ready=await evaluate('!!window.KNH_ZXC_Battle_Gnuro && !!window.$dataSkills && !!SceneManager._sceneStarted && !SceneManager._nextScene');
            if(ready)break;
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert.ok(ready);
        console.log('Prepared',JSON.stringify(await evaluate(fs.readFileSync(path.join(__dirname,'gnuro_battle_preview/runtime.js'),'utf8'))));
        const seek=await evaluate(`(async function(){
            var q=__gnuroQA,s=q.scene;
            s._messageWindow.getMessageSpeed=function(){return 1;};
            for(var i=0;i<3000;i++){
                q.step(4);
                if(s._gnuro.duration&&s._enemySprites[0]._gnuroAxeHold!=null)return q.status();
                if(i%16===0)await new Promise(function(resolve){setTimeout(resolve,10);});
                while(!ImageManager.isReady())await new Promise(function(resolve){setTimeout(resolve,30);});
            }
            throw new Error('First axe strike not reached');
        })()`);
        console.log('First contact',JSON.stringify(seek));
        const checks=[];
        for(const [age,name] of [[12,'gnuro_axe_impact.png'],[50,'gnuro_axe_contact.png']]){
            const result=await evaluate(`(async function(){
                var q=__gnuroQA,s=q.scene,sp=s._enemySprites[0];
                while(s._gnuro.age<${age})q.step(1);
                while(!ImageManager.isReady())await new Promise(function(resolve){setTimeout(resolve,30);});
                Graphics._renderer.render(s);
                var blade=KNH_ZXC_Battle_Gnuro.axeBladeOffset(sp),contact=s.gnuroBarContactPoint();
                return {png:Graphics._canvas.toDataURL('image/png').split(',')[1],
                    frame:q.frame,age:s._gnuro.age,depth:s._gnuro.depth,
                    blade:{x:sp.x+blade.x,y:sp.y+blade.y},contact:contact,
                    bossScale:{x:sp.scale.x,y:sp.scale.y},allyAttacksDisabled:$gameSwitches.value(17),
                    yura:!!sp._yuraInfo,meshVisible:!!(sp._meshSprite&&sp._meshSprite.visible),
                    meshStep:sp._meshSprite&&sp._meshSprite._lastMeshStep,held:sp._gnuroAxeHold,
                    animation24:s._playAnimationSprite._animationSprites.filter(function(c){return c._animation&&c._animation.id===24;}).map(function(c){return {x:c.x,y:c.y,duration:c._duration};})};
            })()`);
            assert.ok(Math.abs(result.blade.x-result.contact.x)<0.01);
            assert.ok(Math.abs(result.blade.y-result.contact.y)<0.01);
            assert.equal(result.bossScale.x,2);
            assert.equal(result.allyAttacksDisabled,false);
            assert.ok(result.yura&&result.meshVisible);
            assert.notEqual(result.held,null);
            if(age===12)assert.ok(result.animation24.length,'Existing break animation is playing at impact');
            fs.writeFileSync(path.join(output,name),Buffer.from(result.png,'base64'));
            delete result.png;
            checks.push({file:name,...result});
            console.log(name,JSON.stringify(result));
        }
        fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(checks,null,2));
    } finally {ws.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
