const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function Scene_NewBattle() {}
function Scene_Map() {}
Scene_Map.prototype.start = function() {};

const context = { Scene_NewBattle, Scene_Map, console };
context.window = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'KNH_ZXC_SkillEditor.js'), 'utf8'), context);
const prototype = context.Scene_SkillEditor.prototype;

function preview(casterType) {
    const scene = Object.create(prototype);
    const oldAction = { skillId: 1, applied: false };
    const caster = {
        _actions: [oldAction],
        startAction(skillId, info) {
            const action = { skillId, info, applied: false };
            this._actions.push(action);
            return action;
        }
    };
    const actor = { _guards: [], _reservedDamaged: [] };
    scene._casterType = casterType;
    scene._skillId = 1;
    scene._frame = 10;
    scene._running = true;
    scene._waitCastIntervalAfterAction = true;
    scene._buttonSprites = [];
    scene._previewEnemyCastSerial = 0;
    scene._enemyBattler = { name: 'target' };
    scene._actorSprite = actor;
    scene._enemySprite = casterType === 'enemy' ? caster : null;
    scene.currentSkill = () => ({ id: 1 });
    scene.currentCasterSprite = () => caster;
    scene.turnActorSprite = () => actor;
    scene.isSkillPlaybackBusy = () => caster._actions.length > 0;
    scene.ensureLastGoodSnapshot = () => { scene.snapshotCount = (scene.snapshotCount || 0) + 1; };
    scene.applySkillDraftForCurrentSelection = () => {
        scene.validationCount = (scene.validationCount || 0) + 1;
        return true;
    };
    scene.recoverBattlers = () => { scene.recoveryCount = (scene.recoveryCount || 0) + 1; };
    scene.setStatus = value => { scene.status = value; };
    return { scene, caster, actor, oldAction };
}

const actorPreview = preview('actor');
actorPreview.scene.playSkillNow();
assert.equal(actorPreview.caster._actions.length, 2, 'manual play appends an action');
assert.equal(actorPreview.caster._actions[0], actorPreview.oldAction, 'the old action is retained');
assert.equal(actorPreview.scene.recoveryCount || 0, 0, 'an overlapping play does not reset damage state');
assert.equal(actorPreview.scene.validationCount || 0, 0,
    'an overlapping play does not run a timing probe that resets the sprite');
assert.equal(actorPreview.scene._waitCastIntervalAfterAction, true);
actorPreview.caster._actions[0].applied = true;
actorPreview.caster._actions[1].applied = true;
assert.equal(actorPreview.caster._actions.filter(action => action.applied).length, 2,
    'both actions remain available to apply damage');
actorPreview.scene.updateSimulation();
assert.equal(actorPreview.caster._actions.length, 2,
    'automatic looping does not add another cast while overlapping actions run');
actorPreview.caster._actions.length = 0;
actorPreview.scene.updateSimulation();
assert.equal(actorPreview.scene._nextCastAt, actorPreview.scene._frame + 40,
    'automatic looping resumes after all overlapping actions finish');

const enemyPreview = preview('enemy');
enemyPreview.scene.playSkillNow();
const firstInfo = enemyPreview.caster._actions[1].info;
enemyPreview.scene.playSkillNow();
const secondInfo = enemyPreview.caster._actions[2].info;
assert.notEqual(firstInfo.timing, secondInfo.timing, 'overlapping enemy casts use distinct judgments');
assert.equal(enemyPreview.scene._buttonSprites.length, 64, 'both casts retain their apply placeholders');
assert.equal(enemyPreview.actor._guards.length, 64, 'both casts retain their damage judgments');
assert.equal(enemyPreview.scene._buttonSprites[0]._info.timing, firstInfo.timing);
assert.equal(enemyPreview.scene._buttonSprites[32]._info.timing, secondInfo.timing);
enemyPreview.caster._actions.splice(0, 2);
enemyPreview.actor._reservedDamaged.push({ info: enemyPreview.scene._buttonSprites[0]._info });
enemyPreview.scene.pruneEnemyApplyPlaceholders();
assert.equal(enemyPreview.scene._buttonSprites.length, 64,
    'a queued hit keeps its placeholders after its action ends');
enemyPreview.actor._reservedDamaged.length = 0;
enemyPreview.scene.pruneEnemyApplyPlaceholders();
assert.equal(enemyPreview.scene._buttonSprites.length, 32, 'finished casts release their placeholders');

function element(tagName) {
    return {
        tagName,
        style: {},
        children: [],
        listeners: {},
        appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
    };
}
const body = element('BODY');
context.document = {
    body,
    createElement: element,
    createTextNode: text => ({ textContent: text })
};
const ui = Object.create(prototype);
ui.syncCasterCheckboxes = () => {};
ui.updateNoteActionHint = () => {};
ui.playSkillNow = () => { ui.playCount = (ui.playCount || 0) + 1; };
ui.createEditorDom();
const row = body.children[0].children[0];
const playButton = row.children.find(child => child.tagName === 'button' && child.textContent === '\u518d\u751f');
assert.ok(playButton, 'the editor shows a play button');
playButton.listeners.click({ preventDefault() {}, stopPropagation() {} });
assert.equal(ui.playCount, 1, 'the play button starts an extra cast');

console.log('Skill editor manual play tests passed');
