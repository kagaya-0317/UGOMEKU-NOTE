const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'KNH_ZXC_Battle.js'), 'utf8');
const start = source.indexOf('    Sprite_NewBattler.prototype.actionApply = function (action) {');
const end = source.indexOf('\n    var ACTION_WAIT_TEST_LIMIT', start);
assert.ok(start >= 0 && end > start, 'the battle actionApply implementation is present');

function Sprite_NewBattler() {}
const calls = [];
const scene = {
    _inFinish: false,
    _buttonSprites: [],
    playDamageAnimation() { calls.push('animation'); },
    applyDamage() { calls.push('damage'); }
};
const runtime = {
    Sprite_NewBattler,
    SceneManager: { _scene: scene }
};
vm.runInNewContext(source.slice(start, end), runtime);

function makeAction(test, remainingLines) {
    const list = remainingLines || [];
    list.contains = value => list.includes(value);
    return {
        test,
        skillId: 46,
        judgment: 2,
        list,
        applyList: [],
        applied: false,
        appliedNum: 0
    };
}

const actor = new Sprite_NewBattler();
actor._battler = { isActor: () => true };
actor.targetSprite = () => { throw new Error('timing probe must not inspect the target'); };
const probe = makeAction(true, ['apply']);
actor.actionApply(probe);
assert.deepEqual(calls, [], 'a timing probe causes no damage or visual effects');
assert.equal(probe.appliedNum, 1, 'the timing probe still counts the apply');
assert.equal(probe.applied, false, 'a later apply remains pending');

const lastProbe = makeAction(true);
actor.actionApply(lastProbe);
assert.equal(lastProbe.applied, true, 'the final apply still completes timing bookkeeping');

const target = { _battler: {}, _actions: [], _noDamageAnime: true };
actor.targetSprite = () => target;
const real = makeAction(false);
actor.actionApply(real);
assert.deepEqual(calls, ['animation', 'damage'], 'a real apply still deals damage once');
assert.equal(real.appliedNum, 1);

const enemy = new Sprite_NewBattler();
enemy._battler = { isActor: () => false };
enemy.targetSprite = () => { throw new Error('enemy timing probe must not reserve damage'); };
const enemyProbe = makeAction(true);
enemyProbe.info = { timing: 0 };
enemy.actionApply(enemyProbe);
assert.equal(enemyProbe.appliedNum, 1);
assert.deepEqual(calls, ['animation', 'damage']);

const waitStart = source.indexOf('    var ACTION_WAIT_TEST_LIMIT', end);
const waitEnd = source.indexOf('\n    Sprite_NewBattler.prototype.setupDamagePopup', waitStart);
assert.ok(waitStart >= 0 && waitEnd > waitStart);
vm.runInNewContext(source.slice(waitStart, waitEnd), runtime);
const measuringActor = new Sprite_NewBattler();
measuringActor._battler = { isActor: () => true };
measuringActor._actions = [];
measuringActor._cachesActionWait = [];
measuringActor.targetSprite = () => { throw new Error('measurement must not inspect the target'); };
measuringActor.startAction = function(skillId) {
    const action = makeAction(!!this._actionTest, ['apply']);
    action.skillId = skillId;
    this._actions.push(action);
    return action;
};
measuringActor.updateActions = function(action) {
    action.list.shift();
    this.actionApply(action);
};
measuringActor.resetForAction = function() {};
assert.deepEqual(Array.from(measuringActor.getActionWaits(46)), [1]);
assert.deepEqual(calls, ['animation', 'damage'],
    'measuring an actor skill containing apply must not create another hit');
assert.equal(measuringActor._actionTest, false);
assert.equal(measuringActor._actions.length, 0);

console.log('Battle action apply tests passed');
