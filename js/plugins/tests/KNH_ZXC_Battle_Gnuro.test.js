const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const troops = JSON.parse(read('data/Troops.json'));
const skills = JSON.parse(read('data/Skills.json'));
const animations = JSON.parse(read('data/Animations.json'));
const enemyData = JSON.parse(read('data/Enemies.json'))[22];
function metadata(record) {
    record.meta = {};
    for (const match of record.note.matchAll(/<([^<>:]+)(:?)([^>]*)>/g))
        record.meta[match[1]] = match[2] === ':' ? match[3] : true;
    return record;
}
skills.filter(Boolean).forEach(metadata);
metadata(enemyData);
function Scene_NewBattle() {}
Object.assign(Scene_NewBattle.prototype, {
    createDisplayObjects() {}, updateBar() {}, showJudgeResult() {}, terminate() {},
    setData() { this.rebuilt = (this.rebuilt || 0) + 1; }
});
function Game_Troop() {}
function Game_Interpreter() {}
Game_Interpreter.prototype.updateWaitMode = function() { return false; };
function Game_Enemy() {}
Game_Enemy.prototype.isActionValid = function() { return true; };
Game_Enemy.prototype.enemy = () => enemyData;
function Sprite_NewEnemy() {}
function UiSprite() { this.children=[];this.x=0;this.y=0;this.rotation=0; }
UiSprite.prototype.addChild = function(child) {
    if(child.parent)child.parent.removeChild(child);
    this.children.push(child);child.parent=this;return child;
};
UiSprite.prototype.removeChild = function(child) {
    const index=this.children.indexOf(child);
    if(index>=0){this.children.splice(index,1);child.parent=null;}
    return child;
};
function Window_Base() {}
Window_Base.prototype._popupTailCharacterCenterToBmp = () => null;
Window_Base.prototype._fukidashiGlobalToBmpPos = (bmp,x,y) => ({x,y});
function Filter(vertex, fragment, uniforms) { this.uniforms = uniforms; }
Filter.prototype.destroy = function() {};
const enemy = {enemy: () => enemyData, isAlive: () => true};
const enemySprite = {_battler:enemy,_turnActions:[{turn:99}],_actions:[],_movementDuration:0,scale:{x:2,y:2}};
Object.assign(enemySprite, {_frameSize:200,anchor:{x:0.5,y:1},_homeX:600,_homeY:312,
    _offsetX:0,_offsetY:0,x:600,y:312,_animationFrames:7,
    setAnimation(){},startJump(x,y,frames,height){this.jump={x,y,frames,height};}});
const scene = new Scene_NewBattle();
scene._messageWindow = new Window_Base();
Object.assign(scene, {_enemySprites:[enemySprite],_actorSprites:[],_buttonSprites:[],_textSprites:[],
    _barSprite:Object.assign(new UiSprite(),{width:720,height:72,x:48,y:360,_meshSprite:new UiSprite()}),_turn:0,children:[]});
const troop = new Game_Troop();
troop._turnCount = 0;
troop.members = () => [enemy];
let turnEnd = false, messagesCleared = 0, effects = 0, popupPosition;
const debrisAnimations=[];
scene.playAnimation=function(animation,x,y){
    const sprite={animation,x,y,scale:{x:1,y:1}};
    debrisAnimations.push(sprite);return sprite;
};
const context = {window:{},Scene_NewBattle,Game_Troop,Game_Interpreter,Game_Enemy,Sprite_NewEnemy,Window_Base,Sprite:UiSprite,
    SceneManager:{_scene:scene},BattleManager:{isTurnEnd:()=>turnEnd},$gameTroop:troop,
    $gameSwitches:{value:()=>false},$dataSkills:skills,$dataAnimations:animations,
    ImageManager:{loadAnimation(){}},
    $gameSystem:{clearMessagePopupFree(){messagesCleared++;},clearMessagePopup(){},playSe(){effects++;},
        setMessagePopupFree(x,y){popupPosition={x,y};}},
    $gameMessage:{},$gameVariables:{setValue(){}},$gameScreen:{startShake(){effects++;}},
    PIXI:{Filter}, Math};
vm.createContext(context);
const core = read('js/rpg_objects.js');
vm.runInContext(core.slice(core.indexOf('Game_Troop.prototype.meetsConditions ='),
    core.indexOf('Game_Troop.prototype.setupBattleEvent =')), context);
vm.runInContext(read('js/plugins/KNH_ZXC_Battle_Gnuro.js'), context);
scene.createDisplayObjects();
assert.equal(enemySprite.scale.x,2,'the original boss scale is preserved');
const hero={_battler:{actorId:()=>2},x:270,y:312};
const mii={_battler:{actorId:()=>3},x:110,y:312,_frameSize:144,scale:{x:2,y:2}};
const yume={_battler:{actorId:()=>4},x:88,y:352,_frameSize:144,scale:{x:2,y:2}};
scene._actorSprites=[hero,yume,mii];
assert.equal(scene.gnuroSpeaker('mii'),true);
assert.equal(popupPosition.x,mii.x,'Mii speaks from actor 3 even after party reordering');
assert.equal(scene._gnuro.speaker,'mii');
assert.equal(scene._messageWindow._popupTailCharacterCenterToBmp({}).x,mii.x,
    'the bubble tail aims at Mii rather than the protagonist');
assert.equal(scene.gnuroSpeaker('yume'),true);
assert.equal(popupPosition.x,yume.x,'Yume speaks from actor 4');
assert.equal(scene._messageWindow._popupTailCharacterCenterToBmp({}).x,yume.x);
assert.equal(new Window_Base()._popupTailCharacterCenterToBmp({}),null,
    'other popup windows keep their normal tail target');
scene._actorSprites=[hero];
assert.equal(scene.gnuroSpeaker('mii'),false,'missing companions never fall back to the protagonist');
assert.equal(scene._gnuro.speaker,null);
scene._actorSprites=[];
const bend = context.window.KNH_ZXC_Battle_Gnuro.bendPoint;
assert.equal(bend(0,36,720,90,7).y,36);
assert.equal(bend(360,36,720,90,7).y,126);
assert.equal(bend(720,36,720,90,7).y,36);
assert.equal(bend(180,36,720,90,7).y,bend(540,36,720,90,7).y);
for (const [a,b] of [[[20,10],[300,62]],[[400,8],[680,60]]]) {
    const p=bend(a[0],a[1],720,90,7),q=bend(b[0],b[1],720,90,7);
    assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-Math.hypot(a[0]-b[0],a[1]-b[1]))<1e-7,
        'each half rotates without stretching or shearing the bar and its notes');
}
assert.equal(scene._barSprite.width,720,'the logical timeline width is never stretched');
assert.equal(troop.meetsConditions(troops[43].pages[0]),true);
turnEnd = true;
enemy.hpRate = () => 0.2;
scene._turn = 1;
assert.equal(troop.meetsConditions(troops[43].pages[1]),true,'75% event accepts a large HP jump');
assert.equal(troops[43].pages.length,4,'the post-break reaction event is removed');
assert.equal(troop.meetsConditions(troops[43].pages[2]),false,'50% introduction waits for bar breaking');
scene.beginGnuroEvent();
assert.equal(troop.meetsConditions(troops[43].pages[1]),false,'an active event cannot re-enter');
scene.endGnuroEvent(1);
assert.equal(enemySprite._turnActions[0].turn,1,'resume schedules this round, not an extra round later');
assert.ok(messagesCleared);
assert.equal(troop.meetsConditions(troops[43].pages[2]),false,'leave one playable round after bar breaking');
scene._turn = 2;
assert.equal(troop.meetsConditions(troops[43].pages[2]),true,'50% event follows bar breaking without the deleted reaction');
assert.equal(troop.meetsConditions(troops[43].pages[3]),false,'25% event waits for the stomp introduction');
scene.endGnuroEvent(3);
assert.equal(troop.meetsConditions(troops[43].pages[3]),false,'leave one playable round before the final event');
scene._turn = 3;
assert.equal(troop.meetsConditions(troops[43].pages[3]),true);
const battler = new Game_Enemy();
const valid = id => battler.isActionValid({skillId:id});
assert.ok(valid(111));
assert.equal(valid(112),false,'low HP alone must not unlock an unintroduced attack');
assert.equal(valid(113),false);
scene.setGnuroAttackPhase(1);
assert.ok(valid(112));
assert.equal(valid(113),false);
scene.setGnuroAttackPhase(2);
assert.equal(valid(112),false);
assert.ok(valid(113));
const interpreter = new Game_Interpreter();
interpreter._waitMode = 'gnuroIdle';
enemySprite._actions.push({});
assert.equal(interpreter.updateWaitMode(),true,'dialogue waits for existing attacks');
enemySprite._actions.length = 0;
assert.equal(interpreter.updateWaitMode(),false);
assert.equal(interpreter._waitMode,'');
const before = effects;
new Sprite_NewEnemy().processExtraActionCommand('gnuroStomp',[-1],{test:true});
assert.equal(effects,before,'timing measurement does not shake the screen or play sounds');
scene.gnuroAimAtBar(24,64);
const bladeOffset=context.window.KNH_ZXC_Battle_Gnuro.axeBladeOffset(enemySprite);
assert.equal(enemySprite._homeX+enemySprite.jump.x+bladeOffset.x,408);
assert.equal(enemySprite._homeY+enemySprite.jump.y+bladeOffset.y,396,
    'jump aims the cutting edge at the bar, including the blank space below the sprite artwork');
scene.gnuroAimAtBar(24,64,8);
assert.equal(enemySprite._homeY+enemySprite.jump.y+bladeOffset.y,404,'explicit extra clearance remains supported');
scene.gnuroHoldAxe(true);
scene.breakGnuroBar(90,50);
assert.equal(debrisAnimations[0].animation.id,24,'reuse the existing rock-break debris');
assert.equal(debrisAnimations[0].x,408);
assert.equal(debrisAnimations[0].y,396,'debris starts where the blade hits the unbent bar');
for(let tick=0;tick<50;tick++) {
    scene.updateBar();
    const contact=scene.gnuroBarContactPoint();
    assert.ok(Math.abs(enemySprite.y+bladeOffset.y-contact.y)<1e-8,
        'held blade follows the fold and bar lift instead of floating above it');
}
scene.gnuroHoldAxe(false);
const releasedY=enemySprite.y;
scene.updateBar();
assert.equal(enemySprite.y,releasedY,'release stops contact tracking before the return jump');
assert.equal(scene._gnuro.depth,90);
assert.equal(scene._gnuro.gap,7);
assert.equal(scene._barSprite.width,720);
const bar=scene._barSprite,button=new UiSprite(),cursor=new UiSprite(),combo=new UiSprite(),tail=new UiSprite();
button.x=cursor.x=360;button.y=cursor.y=36;
button.addChild(tail);cursor.addChild(combo);bar.addChild(button);bar.addChild(cursor);
scene._buttonSprites=[button];scene._carCursorSprite=cursor;
scene.updateBar();
assert.ok(bar._meshSprite.filters.includes(scene._gnuro.filter),'only the visible bar artwork receives the cut');
assert.equal((bar.filters||[]).length,0,'the cut never applies to the bar UI container');
for(const ui of [button,cursor,combo,tail]) {
    for(let parent=ui;parent;parent=parent.parent)
        assert.ok(!(parent.filters||[]).includes(scene._gnuro.filter),'UI stays whole at the center cut');
}
assert.equal(button.x,360,'native note coordinates remain unchanged for input and effects');
assert.equal(cursor.x,360,'native cursor coordinates remain unchanged');
assert.equal(combo.parent,cursor,'combo moves with one intact cursor');
bar.addChild(button);scene.updateBar();
bar.removeChild(button);
assert.equal(button.parent,null,'native button removal also removes a wrapped note');
scene._buttonSprites=[];
enemy.isAlive = () => false;
assert.equal(troop.meetsConditions(troops[43].pages[3]),false,'victory takes priority over remaining dialogue');
for(const file of ['Troops','Enemies','Skills']) {
    const live=JSON.parse(read('data/'+file+'.json'));
    const test=JSON.parse(read('data/testData/Test_'+file+'.json'));
    for(const id of file==='Troops'?[43]:file==='Enemies'?[22]:[111,112,113])
        assert.deepEqual(live[id],test[id],'saved battle-test data matches '+file+' '+id);
}
for(const [id,applies] of [[111,1],[112,1],[113,2]])
    assert.equal(skills[id].meta.animation.split('\n').filter(s=>s.trim()==='apply').length,applies);
assert.ok(troops[43].pages.every(p=>p.span===0),'all dialogue pages run once per battle');
const dialogue = troops[43].pages.flatMap(p=>p.list.filter(c=>c.code===401).map(c=>c.parameters[0]));
assert.ok(dialogue.every(line=>!line.includes('\u3002')),'dialogue has no Japanese full stops');
const speakerCommands=troops[43].pages.flatMap(p=>p.list.filter(c=>c.code===355&&c.parameters[0].includes('.gnuroSpeaker(')));
assert.ok(speakerCommands.some(c=>c.parameters[0].includes("'mii'")));
assert.ok(speakerCommands.some(c=>c.parameters[0].includes("'yume'")));
assert.ok(speakerCommands.every(c=>!/['"](?:ally|hero)['"]/.test(c.parameters[0])),
    'the troop never routes a line to the protagonist or an ambiguous ally');
for(const p of troops[43].pages)for(let i=0;i<p.list.length;i++)if(p.list[i].code===355){
    let script=p.list[i].parameters[0];
    while(p.list[i+1]&&p.list[i+1].code===655)script+='\n'+p.list[++i].parameters[0];
    assert.doesNotThrow(()=>new Function(script),'saved event scripts compile');
}
const captureSource=read('tools/capture_gnuro_battle.cjs')+read('tools/gnuro_battle_preview/runtime.js');
assert.ok(!/setValue\(17,\s*true\)/.test(captureSource),'recording never disables ally attacks');
scene.breakGnuroBar(165,24,125);
scene.updateBar();
assert.ok(scene._gnuro.depth>90,'another strike starts from the current fold instead of snapping straight');
for(let tick=1;tick<24;tick++)scene.updateBar();
assert.equal(scene._gnuro.depth,165);
scene.restoreGnuroBar(120);
interpreter._waitMode='gnuroBar';
assert.equal(interpreter.updateWaitMode(),true,'an explicit bar wait blocks until its animation finishes');
for(let tick=0;tick<120;tick++)scene.updateBar();
assert.equal(scene._gnuro.depth,0);
assert.equal(scene._gnuro.gap,0);
assert.equal(bar.y,scene._gnuro.baseBarY);
assert.equal(interpreter.updateWaitMode(),false);
scene.breakGnuroBar(326,36,286);
for(let tick=0;tick<36;tick++)scene.updateBar();
assert.equal(scene._gnuro.depth,326,'the final blow can make a steep V beyond the original shallow limit');
assert.equal(bar.y+scene.gnuroBarPoint(360,36).y,436,'the deep fold remains above the status windows');
scene._gnuro.filter.destroy = undefined;
scene.terminate();
assert.equal(scene._gnuro,null,'battle exit also works with the project Pixi 4 filter lifecycle');
scene.createDisplayObjects();
assert.equal(scene._gnuro.phase,0,'a new battle starts with a fresh phase');
assert.equal(scene._gnuro.depth,0,'a new battle starts with an unbroken bar');
console.log('Gnuro phase, event, geometry, skill gating and test-database checks passed');
