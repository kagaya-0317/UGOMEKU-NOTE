const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const skills = {
    101: { meta: { animation: 'yumeArmOut:gun1,random,12,wait\nyumeArmIn:8,10' } },
    102: { meta: { animation: 'yumeArmOut:gun2,random,12,wait\nyumeArmIn:8,10' } }
};
const databaseAnimation = { id: 7, name: 'test effect', frames: [[]] };
const animations = [];
animations[7] = databaseAnimation;
const animationCalls = [];
const playedSe = [];
const AudioManager = {
    _seBuffers: [],
    playSe(se) {
        this._seBuffers = this._seBuffers.filter(buffer => buffer.isPlaying());
        const buffer = {
            se, playing: true, stops: 0,
            isPlaying() { return this.playing; },
            stop() { this.playing = false; this.stops++; }
        };
        this._seBuffers.push(buffer);
        playedSe.push(buffer);
    }
};
let randomSeed = 0x7a31c65d;
const seededMath = Object.create(Math);
seededMath.random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 0x100000000;
};

class Sprite {
    constructor(bitmap) {
        this.children = [];
        this.parent = null;
        this.bitmap = bitmap || null;
        this.anchor = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
        this.scale = { x: 1, y: 1 };
        this.rotation = 0;
        this.visible = true;
    }
    addChild(child) {
        if (child.parent) child.parent.removeChild(child);
        this.children.push(child);
        child.parent = this;
        return child;
    }
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) this.children.splice(index, 1);
        child.parent = null;
        return child;
    }
    setFrame(x, y, w, h) {
        this.frame = [x, y, w, h];
        this._frame = { x, y, width: w, height: h };
    }
}

class Bitmap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.dirtyCount = 0;
        this.uploadCount = 0;
        const strokes = this.strokes = [];
        const strokeColors = this.strokeColors = [];
        const arcs = this.arcs = [];
        const fills = this.fills = [];
        const moves = this.moves = [];
        const lines = this.lines = [];
        const clips = this.clips = [];
        const bitmap = this;
        this._context = {
            clearRect() {}, save() {}, restore() {}, translate() {},
            beginPath() {}, moveTo(x, y) { moves.push({ x, y }); },
            lineTo(x, y) { lines.push({ x, y }); }, closePath() {},
            rect(x, y, width, height) { bitmap.lastClipRect = { x, y, width, height }; },
            clip() { clips.push(bitmap.lastClipRect); },
            fill() { fills.push(this.fillStyle); },
            arc(x, y, radius) { arcs.push(radius); },
            stroke() { strokes.push(this.lineWidth); strokeColors.push(this.strokeStyle); },
            getImageData() { return { data: new Uint8ClampedArray([
                71, 78, 81, 127, 230, 230, 230, 255,
                130, 130, 130, 220, 255, 255, 255, 200
            ]) }; },
            putImageData(pixels) { bitmap.lastPixels = Array.from(pixels.data); }
        };
    }
    _setDirty() { this.dirtyCount++; }
    checkDirty() { this.uploadCount++; }
    blt(source, x, y, width, height, dx, dy) {
        this.lastBlit = { source, x, y, width, height, dx, dy };
    }
}

class GraphicsMask {
    beginFill() { return this; }
    drawRect(x, y, width, height) {
        this.rect = { x, y, width, height };
        return this;
    }
    endFill() { return this; }
}

class ActorSprite extends Sprite {
    constructor() {
        super();
        this.scale.x = this.scale.y = 2;
        this.z = 3;
        this._battler = {
            isActor: () => true,
            actorId: () => 4,
            isDead: () => false,
            battlerName: () => '003'
        };
        this._bitmaps = [{ addLoadListener(listener) { listener(); } }];
        this._animationType = 0;
        this._actions = [];
        this.resetCount = 0;
    }
    getAnimationType(type) { return type === 'attack1' ? 7 : 0; }
    setAnimation(type, loop, wait, duration) {
        this.lastAnimationRequest = { type, loop, wait, duration };
        this._animationType = this.getAnimationType(type);
        if (!type) this.resetCount++;
    }
    startAction(skillId) {
        const action = {
            skillId,
            list: skills[skillId].meta.animation.split('\n'),
            test: !!this._actionTest,
            wait: 0
        };
        this._actions.push(action);
        if (!this.keepAnimationOnActionStart || !this.keepAnimationOnActionStart(action))
            this.setAnimation('', true);
        return action;
    }
    update() {}
}

class BattleScene { terminate() {} }

const context = {
    Sprite,
    Bitmap,
    PIXI: { Graphics: GraphicsMask },
    Sprite_NewActor: ActorSprite,
    Scene_NewBattle: BattleScene,
    ImageManager: { loadSvActor: () => ({ addLoadListener(listener) { listener(); } }) },
    $dataSkills: skills,
    $dataAnimations: animations,
    AudioManager,
    SceneManager: { _scene: {
        _battleContainer: { toLocal: point => ({ x: point.x - 10, y: point.y - 20 }) },
        playAnimation(animation, x, y, mirror) { animationCalls.push({ animation, x, y, mirror }); }
    } },
    Math: seededMath,
    Number,
    Object,
    Array
};
context.window = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'KNH_ZXC_Battle_Yume.js'), 'utf8'), context);

const yume = new ActorSprite();
const battleLayer = new Sprite();
battleLayer.addChild(yume);
const linkLengths = points => points.slice(1).map((point, i) =>
    Math.hypot(point.x - points[i].x, point.y - points[i].y));

const first = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 20, 'wait'], first, false);
yume.update();
const manager = yume._yumeArmManager;
const arm = manager.armFor(101);
yume.toGlobal = point => ({ x: 140 + point.x * 2, y: 220 + point.y * 2 });
yume.toLocal = point => ({ x: (point.x - 140) / 2, y: (point.y - 220) / 2 });
assert.ok(arm);
assert.equal(manager.hasArms(), true);
assert.equal(arm.weaponDuration, 16, 'Out plays both 8-frame rotor cells by default');
const firstMoveSe = arm.moveSeBuffer;
assert.equal(firstMoveSe.se.name, 'Machine');
assert.equal(firstMoveSe.se.volume, 60);
assert.ok(firstMoveSe.se.pitch >= 95 && firstMoveSe.se.pitch <= 105,
    'each moving arm plays Machine with a small pitch variation');
assert.equal(yume._animationType, 7);
assert.deepEqual(yume.lastAnimationRequest,
    { type: 'attack1', loop: true, wait: 0, duration: Infinity },
    'Yume attack1 loops on the same music-driven clock as wait');
assert.equal(arm.rotorSprite.visible, true, 'the spinning gun frame is selected during deployment');
assert.equal(arm.weaponRoot.visible, false, 'the gun stays hidden while still inside the backpack');
assert.ok(!arm.weaponRoot.mask, 'the emerging gun does not use a PIXI mask');
assert.equal(arm.weaponClip, undefined, 'no persistent weapon mask is created');
assert.equal(arm.armSprite.visible, false, 'the folded arm is hidden before it emerges');
assert.equal(arm.armBitmap.clips.length, 0,
    'the arm bitmap is not clipped over the lower backpack');
assert.equal(arm.barrelSprite.visible, false, 'the normal gun is hidden during deployment');
assert.equal(arm.barrelSprite._yuraInfo, null, 'the final gun cell does not sway while hidden');
assert.equal(arm.rotorSprite.anchor.x * 38 + 66, 72,
    'the spinning gun pivots at the 144px cell center');
assert.equal(arm.rotorSprite.anchor.y * 34 + 49, 72);
assert.equal(arm.barrelSprite.anchor.x * 31 + 67, 72,
    'the resting gun keeps the same cell-center attachment');
assert.equal(arm.barrelSprite.anchor.y * 22 + 60, 72);
assert.equal(arm.barrelSprite.x, 0);
assert.equal(arm.barrelSprite.y, 0);
assert.deepEqual(arm.barrelSprite.frame, [0, 0, 31, 22],
    'the final gun uses its own tightly cropped bitmap for direct yura rendering');
assert.equal(arm.barrelSprite._yuraDirect, true);
assert.equal(arm.barrelSprite.bitmap.uploadCount, 1);
assert.equal(arm.points.length, 5, 'one intermediate joint has been removed');
assert.notEqual(arm.points[2].y, arm.points[3].y);
const weaponTip = arm.points[arm.points.length - 1];
yume.processExtraActionCommand('yumeArmAnimation', [7, 12, -6], first, false);
assert.deepEqual(animationCalls[0], {
    animation: databaseAnimation,
    x: 130 + weaponTip.x * 2 + 12,
    y: 200 + weaponTip.y * 2 - 6,
    mirror: false
}, 'the database animation starts at this skill arm weapon with screen-pixel offsets');
yume.processExtraActionCommand('yumeArmAnimation', [7], first, false);
assert.equal(animationCalls[1].x, 130 + weaponTip.x * 2, 'offsets default to zero');
assert.equal(animationCalls[1].y, 200 + weaponTip.y * 2);
assert.equal(animationCalls[1].mirror, false, 'existing animation commands stay unmirrored');
yume.processExtraActionCommand('yumeArmAnimation', [7, 12, -6, 'mirror'], first, false);
assert.deepEqual(animationCalls[2], {
    animation: databaseAnimation,
    x: 130 + weaponTip.x * 2 + 12,
    y: 200 + weaponTip.y * 2 - 6,
    mirror: true
}, 'the optional mirror flag flips an offset weapon animation');
yume.processExtraActionCommand('yumeArmAnimation', [7, 'mirror'], first, false);
assert.equal(animationCalls[3].mirror, true, 'mirror works without offsets');
assert.equal(animationCalls[3].x, 130 + weaponTip.x * 2);
assert.equal(animationCalls[3].y, 200 + weaponTip.y * 2);
const animationCallCount = animationCalls.length;
yume.processExtraActionCommand('yumeArmAnimation', [7], { skillId: 101, test: true }, false);
assert.equal(animationCalls.length, animationCallCount, 'timing probes do not start animations');
for (const pose of Array.from({ length: 7 }, () => 'random')) {
    const points = arm.randomTarget(0, 0).points;
    const tip = points.at(-1);
    assert.ok(tip.x >= -80 && tip.x <= 80 && tip.y >= -120 && tip.y <= -100,
        `${pose} resolves to the random gun band`);
    const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
    assert.ok(Math.max(...lengths) / Math.min(...lengths) < 1.25,
        `${pose} keeps its zigzag with roughly even link lengths`);
    const turns = points.slice(1, -1).map((joint, i) => {
        const a = points[i], b = points[i + 2];
        const ax = joint.x - a.x, ay = joint.y - a.y;
        const bx = b.x - joint.x, by = b.y - joint.y;
        return Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    });
    assert.ok(Math.min(...turns) >= Math.PI * 2 / 9 - 0.01,
        `${pose} keeps a visible angle at every joint within normal reach`);
}
const farPoints = arm.randomTarget(120, 0).points;
const farTip = farPoints[farPoints.length - 1];
assert.ok(farTip.x >= 40 && farTip.x <= 200,
    'local offsets shift the random position range');
assert.equal(arm.armSprite._yuraInfo, null, 'yura stays off during deployment and rotor animation');
assert.equal(arm.armSprite._yuraDirect, true);
assert.equal(arm.armSprite._yuraLockGeometry, true);
assert.equal(manager.backLayer.scale.x, 2);
assert.equal(arm.armSprite.parent, manager.backLayer);
assert.equal(arm.weaponRoot.parent, manager.frontLayer);
assert.ok(manager.backLayer.z < manager.frontLayer.z && manager.frontLayer.z < yume.z,
    'the arm and weapon both render behind Yume, with the weapon over the arm');
assert.ok(arm.armBitmap.strokes.every(width => width === 2), 'x2 battle scale makes two bitmap pixels a 4px outline');
assert.deepEqual(arm.armBitmap.lastPixels, [
    0, 0, 0, 0, 255, 255, 255, 255,
    71, 78, 81, 255, 255, 255, 255, 255
], 'the arm bitmap contains no antialiased or semitransparent pixels');
assert.ok(arm.armBitmap.dirtyCount > 0 && arm.armBitmap.uploadCount > 0);
const fakeMesh = arm.armSprite._meshSprite = { _meshDirty: false, updates: 0, updateMesh() { this.updates++; } };
const strokesBeforeRender = arm.armBitmap.strokes.length;
const arcsBeforeRender = arm.armBitmap.arcs.length;
const fillsBeforeRender = arm.armBitmap.fills.length;
const movesBeforeRender = arm.armBitmap.moves.length;
const linesBeforeRender = arm.armBitmap.lines.length;
arm.unfolding = false;
arm.render();
assert.equal(fakeMesh._meshDirty, false);
assert.equal(fakeMesh.updates, 0, 'a disabled yura mesh is not recomputed during motion');
assert.equal(arm.armBitmap.strokes.length - strokesBeforeRender, (arm.points.length - 1) * 2,
    'each link and each joint has a single outline');
assert.equal(arm.armBitmap.arcs.length - arcsBeforeRender, arm.points.length - 1,
    'joints do not have an inner ring');
assert.deepEqual(arm.armBitmap.arcs.slice(arcsBeforeRender), [2.85, 3.2, 3.2, 3.2],
    'joint radii are half their original size');
assert.ok(arm.armBitmap.fills.slice(fillsBeforeRender).every(color => color === '#ffffff'),
    'links and joints use white fill');
assert.ok(arm.armBitmap.strokeColors.slice(strokesBeforeRender).every(color => color === '#474e51'),
    'arm outlines match Yume sprite pixels');
const linkStart = arm.armBitmap.moves[movesBeforeRender];
const linkOtherSide = arm.armBitmap.lines[linesBeforeRender + 2];
assert.ok(Math.abs(Math.hypot(linkStart.x - linkOtherSide.x, linkStart.y - linkOtherSide.y) - 4.16) < 1e-9,
    'link width is 80% of its original 5.2px');
arm.unfolding = true;
arm.render();
assert.equal(arm.weaponRoot.visible, false, 'redrawing during the folded phase does not reveal the gun');

const foldedShape = arm.points.map(point => ({ ...point }));
const deployedShape = arm.toPoints.map(point => ({ ...point }));
const foldedLengths = linkLengths(foldedShape);
const deployedLengths = linkLengths(deployedShape);
assert.ok(Math.max(...foldedLengths) / Math.min(...foldedLengths) < 1.01,
    'the folded arm stores full-length links instead of shortening them');
assert.equal(arm.unfolding, true);
let wavySamples = 0;
const waveSigns = [];
const reachX = deployedShape.at(-1).x - foldedShape[0].x;
const reachY = deployedShape.at(-1).y - foldedShape[0].y;
const reachLength = Math.hypot(reachX, reachY);
const normalX = -reachY / reachLength, normalY = reachX / reachLength;
for (let frame = 2; frame <= 20; frame++) {
    const before = arm.points.map(point => ({ ...point }));
    yume.update();
    if (frame % 6 !== 0 && frame !== 20) {
        assert.deepEqual(arm.points.map(point => ({ ...point })), before,
            `the unfolding shape stays still between 6f updates at frame ${frame}`);
        continue;
    }
    const eased = 1 - Math.pow(1 - frame / 20, 3);
    const lengths = linkLengths(arm.points);
    lengths.forEach((length, i) => {
        const expected = foldedLengths[i] + (deployedLengths[i] - foldedLengths[i]) * eased;
        assert.ok(Math.abs(length - expected) < 3,
            `link ${i + 1} keeps nearly the same length during unfolding at frame ${frame}`);
    });
    if (frame < 20) {
        const visiblePoints = arm.unfoldDrawPoints(arm.points.at(-1));
        assert.equal(visiblePoints.length, Math.ceil(frame / 20 * 4) + 1,
            'one additional joint emerges at each 6f drawing step');
        assert.deepEqual({ ...visiblePoints[0] }, { x: -9, y: -53 },
            'the visible chain starts at the backpack opening');
        assert.ok(Math.hypot(visiblePoints.at(-1).x - arm.points.at(-1).x,
            visiblePoints.at(-1).y - arm.points.at(-1).y) < 0.001,
            'the emerging chain stays connected to the weapon');
        assert.ok(visiblePoints.every(point => point.y <= -53 + 0.001),
            'emerging joints stay above the backpack opening without clipping');
        if (frame === 6) {
            assert.equal(arm.weaponRoot.visible, true,
                'the gun appears only after clearing the backpack opening');
            assert.equal(arm.armSprite.visible, true, 'the emerging arm is visible above the opening');
        }
        if (frame === 12) assert.ok(arm.points.at(-1).y < deployedShape.at(-1).y - 5,
            'the weapon rises above its destination before moving across to the pose');
        const signedOffsets = [];
        const maxWave = Math.max(...arm.points.slice(1, -1).map((point, i) => {
            const index = i + 1;
            const linearX = foldedShape[index].x +
                (deployedShape[index].x - foldedShape[index].x) * eased;
            const linearY = foldedShape[index].y +
                (deployedShape[index].y - foldedShape[index].y) * eased;
            signedOffsets.push((point.x - linearX) * normalX +
                (point.y - linearY) * normalY);
            return Math.hypot(point.x - linearX, point.y - linearY);
        }));
        waveSigns.push(signedOffsets);
        if (maxWave > 5) wavySamples++;
    }
}
assert.ok(wavySamples >= 2, 'multiple unfolding poses visibly bend away from a straight tween');
assert.ok(waveSigns[0].some((value, i) => value * waveSigns[1][i] < 0),
    'the arm reverses its lateral bend instead of following a single smooth arc');
assert.equal(arm.unfolding, false);
assert.equal(firstMoveSe.stops, 1, 'the movement sound stops at the exact ending frame');
assert.equal(arm.moveSeBuffer, null);
assert.ok(!arm.weaponRoot.mask, 'the fully deployed weapon remains mask-free');
assert.equal(arm.weaponRoot.visible, true, 'the weapon remains visible when deployment completes');
assert.equal(arm.armSprite.visible, true, 'the arm remains visible when deployment completes');
assert.deepEqual(arm.points.map(point => ({ ...point })), deployedShape,
    'the unfolding ends exactly on the requested pose');
assert.ok(arm.points.at(-1).x >= -80 && arm.points.at(-1).x <= 80 &&
    arm.points.at(-1).y >= -120 && arm.points.at(-1).y <= -100,
    'the first gun shot stays in the requested random band');

const positionBeforeRepeat = { ...arm.points.at(-1) };
const resetCountBeforeRepeat = yume.resetCount;
const second = yume.startAction(101);
assert.equal(yume.resetCount, resetCountBeforeRepeat);
assert.ok(second._yumeSequence > first._yumeSequence);
const callsBeforeOldAction = animationCalls.length;
yume.processExtraActionCommand('yumeArmAnimation', [7], first, false);
assert.equal(animationCalls.length, callsBeforeOldAction + 1,
    'an older overlapping action still plays its queued weapon effect on time');
assert.equal(animationCalls[animationCalls.length - 1].x, 130 + arm.points.at(-1).x * 2,
    'the queued effect uses the current weapon position');
yume.processExtraActionCommand('yumeArmIn', [0, 10], first, false);
assert.equal(arm.phase, 'active', 'an older action cannot retract the reused arm');
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 8], second, false);
assert.equal(manager.armFor(101), arm, 'the same skill reuses its arm');
assert.equal(arm.unfolding, false, 'an already deployed arm is repositioned without unfolding again');
assert.equal(arm.weaponElapsed, 0, 'calling the gun restarts its animation');
assert.equal(arm.rotorSprite.visible, true);
assert.equal(arm.barrelSprite.visible, false);
assert.equal(arm.barrelSprite._yuraInfo, null, 'restarting a shot disables weapon yura');
assert.deepEqual({ ...arm.points.at(-1) }, positionBeforeRepeat, 'retargeting starts at the visible position');
assert.ok(Math.hypot(arm.toPoints.at(-1).x - positionBeforeRepeat.x,
    arm.toPoints.at(-1).y - positionBeforeRepeat.y) >= 24,
    'repeating the same gun skill chooses a different position');

const other = yume.startAction(102);
yume.processExtraActionCommand('yumeArmOut', ['gun2', 'random', 12], other, false);
assert.equal(Object.keys(manager.arms).length, 2, 'different skills have independent arms');
assert.notEqual(manager.armFor(101), manager.armFor(102));
assert.equal(manager.armFor(102).rotorSprite.visible, true);
assert.equal(manager.armFor(102).barrelSprite.visible, false);
assert.equal(manager.armFor(102).rotorSprite.anchor.x * 47 + 54, 72);
assert.equal(manager.armFor(102).rotorSprite.anchor.y * 39 + 41, 72);
assert.equal(manager.armFor(102).barrelSprite.anchor.x * 39 + 67, 72);
assert.equal(manager.armFor(102).barrelSprite.anchor.y * 23 + 59, 72);
const otherTip = manager.armFor(102).points.at(-1);
yume.processExtraActionCommand('yumeArmAnimation', [7, -5, 9], other, false);
assert.equal(animationCalls[animationCalls.length - 1].x, 130 + otherTip.x * 2 - 5,
    'the effect uses the arm belonging to its own skill');
assert.equal(animationCalls[animationCalls.length - 1].y, 200 + otherTip.y * 2 + 9);

yume.processExtraActionCommand('yumeArmIn', [8, 10], second, false);
assert.equal(arm.phase, 'pending');
const third = yume.startAction(101);
assert.equal(arm.phase, 'active', 'a new action cancels pending retraction');
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 8], third, false);
yume.processExtraActionCommand('yumeArmWeaponAnime', ['attack2'], third, false);
assert.equal(arm.weaponElapsed, 0, 'fire restarts an unfinished gun animation');
assert.equal(arm.weaponDuration, 16, 'WeaponAnime defaults to both 8-frame cells');
assert.equal(arm.rotorSprite.visible, true);
assert.equal(arm.barrelSprite.visible, false);
yume.processExtraActionCommand('yumeArmWeaponAnime', ['attack2', 6], third, false);
assert.equal(arm.weaponDuration, 6, 'an explicit total duration remains supported');

yume.processExtraActionCommand('yumeArmIn', [0, 3], third, false);
for (let i = 0; i < 4; i++) yume.update();
assert.equal(manager.armFor(101), null);
assert.ok(manager.armFor(102));
yume.clearYumeArms();
assert.equal(manager.hasArms(), false);
assert.equal(manager.backLayer.parent, null);
assert.equal(manager.frontLayer.parent, null);

const delayedOld = yume.startAction(101);
const delayedNew = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 8], delayedOld, false);
assert.equal(manager.armFor(101), null, 'an old delayed command cannot create an arm');
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 8], delayedNew, false);
assert.ok(manager.armFor(101));
for (let i = 0; i < 16; i++) yume.update();
assert.equal(manager.armFor(101).rotorSprite.visible, false, 'the spinning gun is hidden after deployment');
assert.equal(manager.armFor(101).barrelSprite.visible, true, 'the normal gun replaces it');
assert.deepEqual(Array.from(manager.armFor(101).barrelSprite._yuraInfo), [10, 8, 8, true],
    'the final gun cell sways after movement and rotation stop');
assert.equal(manager.isAnimating(), false, 'a deployed idle arm does not block preview replay');
const deployedArm = manager.armFor(101);
assert.deepEqual(Array.from(deployedArm.armSprite._yuraInfo), [10, 8, 8, true],
    'yura resumes once both movement and frame animation stop');
const armBaseBitmap = deployedArm.armSprite.bitmap;
deployedArm.armSprite._baseBitmap = armBaseBitmap;
deployedArm.armSprite.bitmap = new Bitmap(224, 224);
const activeMesh = deployedArm.armSprite._meshSprite = {
    visible: true, _meshDirty: false, updateMesh() {}
};
const barrelBaseBitmap = deployedArm.barrelSprite.bitmap;
const barrelFrame = deployedArm.barrelSprite.frame.slice();
deployedArm.barrelSprite._baseBitmap = barrelBaseBitmap;
deployedArm.barrelSprite.bitmap = new Bitmap(224, 224);
const barrelMesh = deployedArm.barrelSprite._meshSprite = { visible: true };
const moveStartTip = { ...deployedArm.points.at(-1) };
const moveStartAngle = deployedArm.angle;
deployedArm.move('random', 0, 0, 8);
const expectedMoveTip = { ...deployedArm.toPoints.at(-1) };
assert.equal(deployedArm.armSprite._yuraInfo, null, 'starting a new move disables yura immediately');
assert.equal(activeMesh.visible, false, 'the yura mesh is hidden without a stale frame');
assert.equal(deployedArm.armSprite.bitmap, armBaseBitmap, 'the undistorted bitmap is restored');
assert.equal(deployedArm.armSprite._baseBitmap, null);
assert.equal(deployedArm.barrelSprite._yuraInfo, null, 'moving the weapon disables its yura');
assert.equal(barrelMesh.visible, false, 'the weapon mesh is hidden immediately');
assert.equal(deployedArm.barrelSprite.bitmap, barrelBaseBitmap,
    'the weapon source sheet is restored when yura stops');
assert.deepEqual(deployedArm.barrelSprite.frame, barrelFrame,
    'the final weapon cell remains selected after restoring its source sheet');
let sixthFrameTip;
for (let frame = 0; frame < 8; frame++) {
    const drawsBefore = deployedArm.armBitmap.dirtyCount;
    deployedArm.update();
    if (frame < 5) {
        assert.deepEqual({ ...deployedArm.points.at(-1) }, moveStartTip,
            `frame ${frame + 1} holds the weapon until the next 6f step`);
        assert.equal(deployedArm.angle, moveStartAngle);
        assert.equal(deployedArm.armBitmap.dirtyCount, drawsBefore);
    } else if (frame === 5) {
        sixthFrameTip = { ...deployedArm.points.at(-1) };
        assert.notDeepEqual(sixthFrameTip, moveStartTip, 'frame 6 advances the weapon');
        assert.ok(deployedArm.armBitmap.dirtyCount > drawsBefore);
    } else if (frame === 6) {
        assert.deepEqual({ ...deployedArm.points.at(-1) }, sixthFrameTip,
            'frame 7 holds the sixth-frame pose');
        assert.equal(deployedArm.armBitmap.dirtyCount, drawsBefore);
    }
    if (frame < 7) assert.equal(deployedArm.armSprite._yuraInfo, null);
    const movingPoints = deployedArm.points;
    const movingTurns = movingPoints.slice(1, -1).map((joint, i) => {
        const a = movingPoints[i], b = movingPoints[i + 2];
        const ax = joint.x - a.x, ay = joint.y - a.y;
        const bx = b.x - joint.x, by = b.y - joint.y;
        return Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    });
    assert.ok(Math.min(...movingTurns) >= Math.PI * 7 / 36 - 0.01,
        `frame ${frame + 1} keeps every moving link visibly bent (${Math.min(...movingTurns)})`);
    const movingLengths = movingPoints.slice(1).map((point, i) =>
        Math.hypot(point.x - movingPoints[i].x, point.y - movingPoints[i].y));
    const movingRatio = Math.max(...movingLengths) / Math.min(...movingLengths);
    assert.ok(movingRatio < 1.4,
        `frame ${frame + 1} keeps moving links roughly even (${movingRatio})`);
}
assert.deepEqual({ ...deployedArm.points.at(-1) }, expectedMoveTip,
    'a non-multiple-of-six duration still lands exactly on its final frame');
assert.deepEqual(Array.from(deployedArm.armSprite._yuraInfo), [10, 8, 8, true],
    'yura resumes after the final movement step');
assert.deepEqual(Array.from(deployedArm.barrelSprite._yuraInfo), [10, 8, 8, true],
    'weapon yura resumes after the final movement step');
deployedArm.restartWeaponAnimation(16);
assert.equal(deployedArm.armSprite._yuraInfo, null, 'weapon frame animation alone disables yura');
assert.equal(deployedArm.barrelSprite._yuraInfo, null, 'weapon yura stops when rotation restarts');
const firstRotorFrame = deployedArm.rotorFrame;
for (let frame = 0; frame < 16; frame++) {
    deployedArm.update();
    if (frame === 6) assert.equal(deployedArm.rotorFrame, firstRotorFrame,
        'the first rotor cell lasts a full 8 frames');
    if (frame === 7) assert.notEqual(deployedArm.rotorFrame, firstRotorFrame,
        'the second rotor cell starts after 8 frames');
    if (frame < 15) assert.equal(deployedArm.armSprite._yuraInfo, null);
}
assert.equal(deployedArm.barrelSprite.visible, true);
assert.deepEqual(Array.from(deployedArm.armSprite._yuraInfo), [10, 8, 8, true],
    'yura resumes after weapon frame animation ends');
assert.deepEqual(Array.from(deployedArm.barrelSprite._yuraInfo), [10, 8, 8, true],
    'the final gun cell starts swaying when rotation ends');
deployedArm.move('random', 0, 0, 6);
deployedArm.restartWeaponAnimation(10);
for (let frame = 0; frame < 6; frame++) deployedArm.update();
assert.equal(deployedArm.toPoints, null, 'movement has ended');
assert.equal(deployedArm.armSprite._yuraInfo, null,
    'yura remains off while overlapping weapon animation continues');
assert.equal(deployedArm.barrelSprite._yuraInfo, null,
    'weapon yura remains off while overlapping animation continues');
for (let frame = 0; frame < 4; frame++) deployedArm.update();
assert.deepEqual(Array.from(deployedArm.armSprite._yuraInfo), [10, 8, 8, true]);
assert.deepEqual(Array.from(deployedArm.barrelSprite._yuraInfo), [10, 8, 8, true]);
const enemyTarget = {
    width: 60,
    height: 80,
    anchor: { x: 0.5, y: 1 },
    toGlobal: point => ({ x: 600 + point.x * 2, y: 300 + point.y * 2 })
};
yume.targetSprite = () => enemyTarget;
const targetMoveStart = { ...deployedArm.points.at(-1) };
const oldArmWidth = deployedArm.armBitmap.width;
yume.processExtraActionCommand('yumeArmMoveToTarget', [12, -16, 8, 'wait'], delayedNew, false);
assert.equal(delayedNew.wait, 8);
assert.equal(deployedArm.preserveBends, false, 'the target move does not enforce the old zigzag');
assert.deepEqual({ ...deployedArm.toPoints.at(-1) }, { x: 236, y: -8 },
    'screen-pixel offsets are converted with the enemy center into actor-local coordinates');
assert.ok(deployedArm.armBitmap.width > oldArmWidth, 'the arm bitmap expands to cover the enemy');
assert.equal(deployedArm.armSprite.bitmap, deployedArm.armBitmap);
assert.deepEqual(deployedArm.armSprite.frame, [0, 0,
    deployedArm.armBitmap.width, deployedArm.armBitmap.height]);
assert.equal(deployedArm.armSprite.x, -deployedArm.bitmapOffset.x);
assert.equal(deployedArm.armSprite._yuraInfo, null);
assert.equal(activeMesh._meshDirty, true, 'the old yura mesh is invalidated after resizing');
for (let frame = 0; frame < 8; frame++) {
    deployedArm.update();
    if (frame < 5) assert.deepEqual({ ...deployedArm.points.at(-1) }, targetMoveStart);
    if (frame === 5) assert.notDeepEqual({ ...deployedArm.points.at(-1) }, targetMoveStart);
}
assert.deepEqual({ ...deployedArm.points.at(-1) }, { x: 236, y: -8 });
for (let i = 0; i < deployedArm.points.length; i++) {
    const ratio = i / (deployedArm.points.length - 1);
    assert.ok(Math.abs(deployedArm.points[i].x - (-9 + (236 + 9) * ratio)) < 1e-9);
    assert.ok(Math.abs(deployedArm.points[i].y - (-53 + (-8 + 53) * ratio)) < 1e-9);
}
assert.deepEqual(Array.from(deployedArm.armSprite._yuraInfo), [10, 8, 8, true]);
const targetBitmap = deployedArm.armBitmap;
yume.processExtraActionCommand('yumeArmMoveToTarget', [0], delayedNew, false);
assert.deepEqual({ ...deployedArm.points.at(-1) }, { x: 230, y: 0 },
    'a zero-duration command reaches the unoffset enemy center immediately');
assert.equal(deployedArm.armBitmap, targetBitmap, 'repeating the target move reuses the enlarged bitmap');
yume.targetSprite = () => null;
yume.processExtraActionCommand('yumeArmMoveToTarget', [6], delayedNew, false);
assert.deepEqual({ ...deployedArm.points.at(-1) }, { x: 230, y: 0 },
    'a missing enemy target does not move the weapon');
yume.clearYumeArms();

const timingProbe = { skillId: 101, test: true, wait: 0 };
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 12, 'wait'], timingProbe, false);
assert.equal(timingProbe.wait, 12);
yume.processExtraActionCommand('yumeArmMoveToTarget', [0, -16, 8, 'wait'], timingProbe, false);
assert.equal(timingProbe.wait, 8, 'timing probes include target movement duration');
assert.equal(manager.hasArms(), false, 'timing probes never create visual state');

const validate = context.KNH_ZXC_Battle_Yume.validateActionLine;
assert.equal(validate('yumeArmMove', ['random', '8', 'wait']).valid, true);
assert.equal(validate('yumeArmMoveToTarget', ['12', 'wait']).valid, true);
assert.equal(validate('yumeArmMoveToTarget', ['0', '-16', '8', 'wait']).valid, true);
assert.equal(validate('yumeArmMoveToTarget', ['0', '-16']).valid, false);
assert.equal(validate('yumeArmMoveToTarget', ['0', '-16', '-1']).valid, false);
assert.equal(validate('yumeArmOut', ['gun1', 'random', '12', '-6', '12']).valid, true);
assert.equal(validate('yumeArmOut', ['attack2', 'random', '20', 'wait']).valid, true);
for (const oldPose of ['shotA', 'shotB', 'shotAB', 'shotC', 'high', 'low']) {
    assert.equal(validate('yumeArmOut', ['gun1', oldPose, '12']).valid, false);
    assert.equal(validate('yumeArmMove', [oldPose, '8']).valid, false);
}
assert.deepEqual(Array.from(context.KNH_ZXC_Battle_Yume.poseNames), ['random']);
assert.equal(validate('yumeArmOut', ['gun1', 'random', '12']).valid, true);
assert.equal(validate('yumeArmMove', ['random', '8']).valid, true);
assert.equal(validate('yumeArmOut', ['gun1', 'missing', '12']).valid, false);
assert.equal(validate('yumeArmIn', ['8', '10']).valid, true);
assert.equal(validate('yumeArmAnimation', ['7', '12', '-6']).valid, true);
assert.equal(validate('yumeArmAnimation', ['7', '12', '-6', 'mirror']).valid, true);
assert.equal(validate('yumeArmAnimation', ['7', 'mirror']).valid, true);
assert.equal(validate('yumeArmAnimation', ['7']).valid, true);
assert.equal(validate('yumeArmAnimation', ['999']).valid, false);
assert.equal(validate('yumeArmAnimation', ['7', '12']).valid, false);
assert.equal(validate('yumeArmAnimation', ['7', '12', 'mirror']).valid, false);
assert.equal(validate('yumeArmAnimation', ['7', '12', '-6', 'unknown']).valid, false);
assert.equal(validate('yumeArmAnimation', ['7', 'left', '0']).valid, false);

const retractProbe = manager.ensureArm(103, 'gun1');
retractProbe.out('gun1', 'random', 0, 0, 12, 1);
for (let frame = 0; frame < 12; frame++) retractProbe.update();
assert.equal(retractProbe.weaponClip, undefined, 'deployment did not create a weapon mask');
const retractStart = { ...retractProbe.points.at(-1) };
const retractStartLengths = linkLengths(retractProbe.points);
retractProbe.scheduleIn(0, 30);
assert.equal(retractProbe.retractingViaTop, true);
assert.ok(!retractProbe.weaponRoot.mask, 'retraction also remains mask-free');
assert.equal(retractProbe.retractDrawPoints(retractProbe.points.at(-1)).length, 5,
    'all four links are visible when retraction begins');
const retractEnd = { ...retractProbe.toPoints.at(-1) };
const retractEndLengths = linkLengths(retractProbe.toPoints);
let lastVisibleCount = 5;
for (let frame = 1; frame <= 30; frame++) {
    const finished = retractProbe.update();
    if (frame % 6 === 0) {
        const eased = 1 - Math.pow(1 - frame / 30, 3);
        linkLengths(retractProbe.points).forEach((length, i) => {
            const expected = retractStartLengths[i] +
                (retractEndLengths[i] - retractStartLengths[i]) * eased;
            assert.ok(Math.abs(length - expected) < 3,
                `returning link ${i + 1} keeps nearly the same length at frame ${frame}`);
        });
    }
    if (frame === 6) assert.ok(retractProbe.points.at(-1).y <= -100,
        'the weapon first returns to the space above the backpack');
    if (frame === 12) assert.ok(retractProbe.points.at(-1).y < retractEnd.y - 40,
        'the weapon approaches the backpack from above');
    if (frame === 6 || frame === 12 || frame === 18) {
        const visiblePoints = retractProbe.retractDrawPoints(retractProbe.points.at(-1));
        assert.ok(visiblePoints.length <= lastVisibleCount && visiblePoints.length >= 2,
            'backpack-side joints disappear progressively during retraction');
        lastVisibleCount = visiblePoints.length;
        assert.ok(Math.hypot(visiblePoints[0].x + 9, visiblePoints[0].y + 53) < 0.001,
            'the shortened chain remains anchored at the backpack');
        assert.ok(Math.hypot(visiblePoints.at(-1).x - retractProbe.points.at(-1).x,
            visiblePoints.at(-1).y - retractProbe.points.at(-1).y) < 0.001,
            'the shortened chain remains connected to the weapon');
        assert.ok(visiblePoints.every(point => point.y <= -53 + 0.001),
            `returning joints stay above the backpack opening without clipping (frame ${frame}, maxY ${Math.max(...visiblePoints.map(point => point.y))})`);
    }
    if (frame === 12) {
        assert.equal(retractProbe.weaponRoot.visible, true,
            'the intact weapon remains visible on its way back');
        assert.ok(!retractProbe.weaponRoot.mask);
    }
    if (frame === 24) {
        assert.equal(retractProbe.weaponRoot.visible, false,
            'the weapon disappears once it reaches the backpack entrance');
        assert.equal(retractProbe.armSprite.visible, false,
            'the returning links disappear with the weapon');
    }
    if (frame < 30) assert.equal(finished, false);
    else assert.equal(finished, true);
}
assert.equal(retractProbe.armBitmap.clips.length, 0,
    'returning arm links never use a lower-backpack clip');
assert.deepEqual({ ...retractProbe.points.at(-1) }, retractEnd);
assert.equal(retractProbe.retractingViaTop, false);
assert.equal(retractProbe.weaponRoot.visible, false, 'a fully retracted weapon stays hidden');
assert.equal(retractProbe.armSprite.visible, false, 'a fully retracted arm stays hidden');
manager.clear();
const rapidGun = manager.ensureArm(104, 'gun1');
let rapidPrevious = null;
let rapidLinkLengths = null;
Array.from({ length: 10 }, () => 'random').forEach((pose, index) => {
    const weapon = index < 8 ? 'gun1' : 'gun2';
    rapidGun.out(weapon, pose, 0, 0, 0, index + 1);
    const tip = rapidGun.points.at(-1);
    assert.ok(tip.x >= -80 && tip.x <= 80 && tip.y >= -120 && tip.y <= -100,
        `${pose} chooses a spot inside the gun band`);
    if (rapidPrevious) {
        const travel = Math.hypot(tip.x - rapidPrevious.x, tip.y - rapidPrevious.y);
        assert.ok(travel >= 24, `${pose} moves the reused gun to a new spot`);
        assert.ok(travel <= 50, `${pose} keeps a repeated shot near the previous position when unobstructed`);
    }
    const lengths = linkLengths(rapidGun.points);
    if (rapidLinkLengths) lengths.forEach((length, link) => {
        assert.ok(Math.abs(length - rapidLinkLengths[link]) < 10,
            `${pose} keeps link ${link + 1} close to its previous length`);
    });
    rapidLinkLengths = lengths;
rapidPrevious = { ...tip };
});
rapidGun.out('gun2', 'random', 0, 0, 18, 11);
const inFlightDestination = { ...rapidGun.toPoints.at(-1) };
for (let i = 0; i < 6; i++) rapidGun.update();
const inFlightPosition = { ...rapidGun.points.at(-1) };
rapidGun.out('gun2', 'random', 0, 0, 18, 12);
assert.deepEqual({ ...rapidGun.points.at(-1) }, inFlightPosition,
    'an interrupted shot starts from the visible in-flight position');
assert.ok(Math.hypot(rapidGun.toPoints.at(-1).x - inFlightPosition.x,
    rapidGun.toPoints.at(-1).y - inFlightPosition.y) >= 24,
    'the new shot visibly moves away from the current tip');
assert.ok(Math.hypot(rapidGun.toPoints.at(-1).x - inFlightDestination.x,
    rapidGun.toPoints.at(-1).y - inFlightDestination.y) >= 24,
    'the new shot also avoids the abandoned destination');
manager.clear();
const crowdRandom = manager.random;
manager.random = () => 0.5;
const crowdedGun = manager.ensureArm(107, 'gun1');
crowdedGun.out('gun1', 'random', 0, 0, 0, 1);
const crowdedStart = { ...crowdedGun.points.at(-1) };
const blockers = [-40, 40].map(x => ({
    hasDeployed: true, weapon: 'gun1', angle: 0,
    points: [{ x: crowdedStart.x + x, y: crowdedStart.y }]
}));
manager.arms.blockerLeft = blockers[0];
manager.arms.blockerRight = blockers[1];
crowdedGun.out('gun1', 'random', 0, 0, 0, 2);
const crowdedEnd = crowdedGun.points.at(-1);
assert.ok(Math.hypot(crowdedEnd.x - crowdedStart.x, crowdedEnd.y - crowdedStart.y) > 44,
    'a repeated gun moves farther when nearby positions are occupied');
const crowdedBounds = manager.weaponBounds('gun1', crowdedEnd, crowdedGun.angle);
blockers.forEach(blocker => {
    const occupied = manager.weaponBounds('gun1', blocker.points[0], blocker.angle);
    assert.ok(crowdedBounds.right <= occupied.left || occupied.right <= crowdedBounds.left ||
        crowdedBounds.bottom <= occupied.top || occupied.bottom <= crowdedBounds.top,
    'a farther repeated shot still avoids occupied weapon bounds');
});
delete manager.arms.blockerLeft;
delete manager.arms.blockerRight;
manager.random = crowdRandom;
manager.clear();
const wiggleRandom = manager.random;
manager.random = () => 0.5;
const wiggleGun = manager.ensureArm(106, 'gun1');
wiggleGun.out('gun1', 'random', 0, 0, 0, 1);
wiggleGun.move('random', 0, 0, 18);
wiggleGun.wigglePhase = Math.PI / 2;
wiggleGun.wiggleAmplitude = 15;
const wiggleFrom = wiggleGun.fromPoints.map(point => ({ ...point }));
const wiggleTo = wiggleGun.toPoints.map(point => ({ ...point }));
for (let i = 0; i < 6; i++) wiggleGun.update();
const wiggleEase = 1 - Math.pow(1 - 6 / 18, 3);
const deviations = wiggleGun.points.slice(1, -1).map((point, index) => {
    const from = wiggleFrom[index + 1], to = wiggleTo[index + 1];
    return Math.hypot(point.x - (from.x + (to.x - from.x) * wiggleEase),
        point.y - (from.y + (to.y - from.y) * wiggleEase));
});
assert.ok(Math.max(...deviations) > 2,
    'the joints deliberately sway away from a simple eased interpolation');
const wiggleLengths = linkLengths(wiggleGun.points);
assert.ok(Math.max(...wiggleLengths) / Math.min(...wiggleLengths) < 1.35,
    'joint swaying keeps the four links approximately even');
const wiggleFromLengths = linkLengths(wiggleFrom);
const wiggleToLengths = linkLengths(wiggleTo);
wiggleLengths.forEach((length, link) => {
    const expected = wiggleFromLengths[link] +
        (wiggleToLengths[link] - wiggleFromLengths[link]) * wiggleEase;
    assert.ok(Math.abs(length - expected) < 8,
        `swaying link ${link + 1} stays near its interpolated length`);
});
manager.random = wiggleRandom;
manager.clear();
const secondGun = manager.ensureArm(105, 'gun2');
secondGun.out('gun2', 'random', 0, 0, 0, 1);
const secondGunStart = { ...secondGun.points.at(-1) };
secondGun.out('gun2', 'random', 0, 0, 0, 2);
assert.ok(Math.hypot(secondGun.points.at(-1).x - secondGunStart.x,
    secondGun.points.at(-1).y - secondGunStart.y) >= 24,
    'the second gun independently chooses a new position');
secondGun.move('random', 0, 0, 0);
secondGun.out('gun2', 'random', 0, 0, 8, 3);
for (let i = 0; i < 8; i++) secondGun.update();
assert.ok(secondGun.points.at(-1).x >= -80 && secondGun.points.at(-1).x <= 80,
    'the completed repeated shot lands in the random band');
assert.ok(Math.hypot(secondGun.points[4].x - secondGun.points[2].x,
    secondGun.points[4].y - secondGun.points[2].y) >= 18,
    'the completed movement does not bunch the middle joints');
manager.clear();

const gunA = manager.ensureArm(201, 'gun1');
const gunB = manager.ensureArm(202, 'gun2');
const weaponBounds = gun => manager.weaponBounds(gun.weapon, gun.points.at(-1), gun.angle);
const separated = (a, b) => a.right <= b.left || b.right <= a.left ||
    a.bottom <= b.top || b.bottom <= a.top;
const assertSeparated = message => assert.ok(separated(weaponBounds(gunA), weaponBounds(gunB)), message);
gunA.out('gun1', 'random', 0, 0, 0, 1);
gunB.out('gun2', 'random', 0, 0, 0, 1);
assert.ok(gunA.points.at(-1).x >= -80 && gunA.points.at(-1).x <= 80 &&
    gunA.points.at(-1).y >= -120 && gunA.points.at(-1).y <= -100,
    'the first arm chooses a position within the requested band');
assertSeparated('two simultaneous guns have non-overlapping animation and barrel bounds');
for (let i = 1; i < 5; i++) {
    assert.ok(Math.hypot(gunA.points[i].x - gunB.points[i].x,
        gunA.points[i].y - gunB.points[i].y) >= 12,
    `the two arms keep joint ${i} visibly separate`);
}
const gunBPosition = { ...gunB.points.at(-1) };
const gunBLengths = linkLengths(gunB.points);
assert.ok(Math.max(...gunBLengths) / Math.min(...gunBLengths) < 1.25,
    'the second arm keeps approximately even link lengths');
gunB.out('gun2', 'random', 0, 0, 0, 2);
assert.ok(Math.hypot(gunB.points.at(-1).x - gunBPosition.x,
    gunB.points.at(-1).y - gunBPosition.y) >= 24,
    'repeated shots move to a new position without losing their separate lane');
gunA.out('gun1', 'random', 0, 0, 0, 2);
assertSeparated('repositioning the first gun keeps it separate from the second gun');
gunB.out('gun2', 'random', 0, 0, 0, 3);
assertSeparated('repositioning the second gun keeps both guns separate');
const gunC = manager.ensureArm(203, 'gun1');
gunC.out('gun1', 'random', 0, 0, 0, 1);
assert.ok(separated(weaponBounds(gunA), weaponBounds(gunC)) &&
    separated(weaponBounds(gunB), weaponBounds(gunC)),
    'a third active arm also chooses an unoccupied gun position');
manager.clear();

const unfoldingA = manager.ensureArm(204, 'gun1');
const unfoldingB = manager.ensureArm(205, 'gun2');
unfoldingA.out('gun1', 'random', 0, 0, 20, 1);
unfoldingB.out('gun2', 'random', 0, 0, 20, 1);
for (let i = 0; i < 20; i++) {
    unfoldingA.update();
    unfoldingB.update();
}
assert.ok(separated(weaponBounds(unfoldingA), weaponBounds(unfoldingB)),
    'simultaneously unfolded guns finish without overlapping');
for (let i = 1; i < 5; i++) {
    assert.ok(Math.hypot(unfoldingA.points[i].x - unfoldingB.points[i].x,
        unfoldingA.points[i].y - unfoldingB.points[i].y) >= 12,
    `simultaneous unfolding finishes with separate joint ${i}`);
}
manager.clear();

const manyArms = [];
for (let i = 0; i < 5; i++) {
    const weapon = i % 2 ? 'gun2' : 'gun1';
    const activeArm = manager.ensureArm(300 + i, weapon);
    activeArm.out(weapon, 'random', 0, 0, 0, 1);
    const crowdedTip = activeArm.points.at(-1);
    assert.ok(crowdedTip.x >= -80 && crowdedTip.x <= 80 &&
        crowdedTip.y >= -168 && crowdedTip.y <= -52,
        'crowded guns use only the normal band or one nearby extra row');
    for (const earlierArm of manyArms) {
        assert.ok(separated(weaponBounds(activeArm), weaponBounds(earlierArm)),
            `active gun ${i + 1} avoids each earlier gun`);
        for (const joint of activeArm.points.slice(1, -1)) {
            for (const earlierJoint of earlierArm.points.slice(1, -1)) {
                assert.ok(Math.hypot(joint.x - earlierJoint.x, joint.y - earlierJoint.y) >= 8,
                    `active arm ${i + 1} keeps its joints separate from earlier arms`);
            }
        }
    }
    manyArms.push(activeArm);
}
manager.clear();
const originalRandom = manager.random;
for (const [sampleIndex, sample] of [0, 0.5, 0.999].entries()) {
    manager.random = () => sample;
    const edgeArm = manager.ensureArm(390 + sampleIndex, 'gun1');
    edgeArm.out('gun1', 'random', 0, 0, 20, 1);
    for (let frame = 0; frame < 20; frame++) {
        edgeArm.update();
        if (!edgeArm.armSprite.visible) continue;
        const draw = edgeArm.unfolding ? edgeArm.unfoldDrawPoints(edgeArm.points.at(-1)) : edgeArm.points;
        assert.ok(draw.every(point => point.y <= -53 + 0.001),
            `sample ${sampleIndex} emerges above the opening without a clip`);
    }
    edgeArm.scheduleIn(0, 30);
    for (let frame = 0; frame < 30; frame++) {
        edgeArm.update();
        if (!edgeArm.armSprite.visible) continue;
        const draw = edgeArm.retractDrawPoints(edgeArm.points.at(-1));
        assert.ok(draw.every(point => point.y <= -53 + 0.001),
            `sample ${sampleIndex} returns above the opening without a clip`);
    }
    manager.clear();
}
manager.random = originalRandom;
const soundArmA = manager.ensureArm(501, 'gun1');
const soundArmB = manager.ensureArm(502, 'gun2');
soundArmA.out('gun1', 'random', 0, 0, 12, 1);
soundArmB.out('gun2', 'random', 0, 0, 20, 1);
const soundA = soundArmA.moveSeBuffer;
const soundB = soundArmB.moveSeBuffer;
assert.ok(soundA && soundB && soundA !== soundB,
    'simultaneous arms own separate Machine buffers');
for (let frame = 0; frame < 12; frame++) {
    soundArmA.update();
    soundArmB.update();
}
assert.equal(soundA.stops, 1, 'the first arm stops only its own sound at its ending frame');
assert.equal(soundB.stops, 0, 'the other arm keeps sounding until its movement ends');
soundArmA.scheduleIn(0, 12);
const returnSound = soundArmA.moveSeBuffer;
assert.equal(returnSound.se.name, 'Machine', 'returning to the backpack has its own movement sound');
for (let frame = 0; frame < 12; frame++) soundArmA.update();
assert.equal(returnSound.stops, 1, 'the return sound stops when retraction finishes');
manager.random = () => 0;
soundArmB.move('random', 0, 0, 8);
const replacementSound = soundArmB.moveSeBuffer;
assert.equal(soundB.stops, 1, 'repositioning replaces the previous sound on that arm');
assert.notEqual(replacementSound, soundB);
assert.equal(replacementSound.se.pitch, 95);
manager.random = () => 0.999;
soundArmB.move('random', 0, 0, 8);
assert.equal(replacementSound.stops, 1);
assert.equal(soundArmB.moveSeBuffer.se.pitch, 105,
    'pitch variation reaches both ends of the narrow range');
const finalSound = soundArmB.moveSeBuffer;
manager.clear();
assert.equal(finalSound.stops, 1, 'clearing the arms stops their owned sounds');
manager.random = originalRandom;
const aimedEnemy = {
    width: 60,
    height: 80,
    anchor: { x: 0.5, y: 1 },
    toGlobal: point => ({ x: 600 + point.x * 2, y: 300 + point.y * 2 })
};
yume.targetSprite = () => aimedEnemy;
const aimAction = { skillId: 401, test: false, wait: 0 };
yume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 0], aimAction, false);
const aimedArm = manager.armFor(401);
const aimAt = manager.enemyCenterLocal(aimedEnemy, 0, 0);
const expectedAim = point => Math.atan2(aimAt.y - point.y, aimAt.x - point.x);
const tipAlignment = gun => {
    const tip = gun.points.at(-1), joint = gun.points.at(-2);
    const dx = tip.x - joint.x, dy = tip.y - joint.y;
    return (dx * Math.cos(gun.angle) + dy * Math.sin(gun.angle)) / Math.hypot(dx, dy);
};
const gunLinkDepth = gun => {
    const tip = gun.points.at(-1), joint = gun.points.at(-2);
    const length = Math.hypot(joint.x - tip.x, joint.y - tip.y);
    const cos = Math.cos(gun.angle), sin = Math.sin(gun.angle);
    const dx = ((joint.x - tip.x) * cos + (joint.y - tip.y) * sin) / length;
    const dy = (-(joint.x - tip.x) * sin + (joint.y - tip.y) * cos) / length;
    const frames = gun.weapon === 'gun1' ? [[-6, -23, 32, 11], [-5, -12, 26, 10]] :
        [[-18, -31, 29, 8], [-5, -13, 34, 10]];
    return Math.max(...frames.map(([left, top, right, bottom]) => {
        left -= 2.08; top -= 2.08; right += 2.08; bottom += 2.08;
        return Math.min(length,
            dx > 0.001 ? right / dx : dx < -0.001 ? left / dx : Infinity,
            dy > 0.001 ? bottom / dy : dy < -0.001 ? top / dy : Infinity);
    }));
};
assert.ok(Math.abs(aimedArm.angle - expectedAim(aimedArm.points.at(-1))) < 1e-9,
    'a deployed gun points from its chosen tip toward the enemy center');
assert.ok(gunLinkDepth(aimedArm) <= 14 + 1e-9,
    'the last arm link stays outside the gun beyond its attachment point');
assert.ok(tipAlignment(aimedArm) < 0.2,
    'a clear side approach is kept instead of forcing the arm behind the gun');
assert.equal(aimedArm.weaponRoot.rotation, aimedArm.angle,
    'the computed direction rotates the visible weapon');
yume.processExtraActionCommand('yumeArmMove', ['random', 0], aimAction, false);
assert.ok(Math.abs(aimedArm.angle - expectedAim(aimedArm.points.at(-1))) < 1e-9,
    'repositioning recomputes the aim from the new gun position');
assert.ok(gunLinkDepth(aimedArm) <= 14 + 1e-9,
    'a repositioned gun still avoids overlapping its final arm link');
const leftEnemy = {
    width: 60,
    height: 80,
    anchor: { x: 0.5, y: 1 },
    toGlobal: point => ({ x: -240 + point.x * 2, y: 300 + point.y * 2 })
};
yume.targetSprite = () => leftEnemy;
yume.processExtraActionCommand('yumeArmMove', ['random', 0], aimAction, false);
const leftAim = manager.enemyCenterLocal(leftEnemy, 0, 0);
assert.ok(Math.abs(aimedArm.angle - Math.atan2(leftAim.y - aimedArm.points.at(-1).y,
    leftAim.x - aimedArm.points.at(-1).x)) < 1e-9,
    'the gun also turns toward an enemy on the other side');
assert.ok(gunLinkDepth(aimedArm) <= 14 + 1e-9,
    'the final arm link does not overlap the gun when aiming left');
manager.clear();
for (const weapon of ['gun1', 'gun2']) {
    for (const [sample, enemyX] of [[0, 230], [0.999, -190]]) {
        manager.random = () => sample;
        const edgeGun = manager.ensureArm(402, weapon);
        edgeGun.out(weapon, 'random', 0, 0, 0, 1, { x: enemyX, y: 0 });
        assert.ok(gunLinkDepth(edgeGun) <= 14 + 1e-9,
            `${weapon} at an extreme position avoids a visibly overlapping tip link`);
        const lengths = linkLengths(edgeGun.points);
        assert.ok(Math.max(...lengths) / Math.min(...lengths) < 1.3,
            'redirecting the final link preserves roughly even arm lengths');
        manager.clear();
    }
}
manager.random = () => 0.5;
const turningGun = manager.ensureArm(403, 'gun1');
turningGun.out('gun1', 'random', 0, 0, 0, 1, { x: 230, y: 0 });
turningGun.move('random', 0, 0, 18, { x: -190, y: 0 });
for (let frame = 1; frame <= 18; frame++) {
    turningGun.update();
    if (frame % 6 === 0) assert.ok(gunLinkDepth(turningGun) <= 14 + 1e-9,
        `the moving gun does not heavily overlap its final link at frame ${frame}`);
}
manager.clear();
for (const [from, to] of [[Math.PI - 0.01, -Math.PI + 0.01],
    [-Math.PI + 0.01, Math.PI - 0.01]]) {
    const angleGun = manager.ensureArm(404, 'gun1');
    angleGun.out('gun1', 'random', 0, 0, 0, 1);
    angleGun.angle = from;
    angleGun.moveTo(angleGun.points, to, 18, 'active', false);
    for (let frame = 0; frame < 6; frame++) angleGun.update();
    assert.ok(Math.abs(angleGun.angle - from) < 0.03,
        'the gun crosses the angle wrap by the short turn');
    for (let frame = 6; frame < 18; frame++) angleGun.update();
    assert.equal(angleGun.angle, to, 'the completed turn uses the requested angle exactly');
    manager.clear();
}
const cachedGunA = manager.ensureArm(601, 'gun1');
const cachedGunB = manager.ensureArm(602, 'gun1');
const cachedBarrel = cachedGunA.barrelSprite.bitmap;
assert.equal(cachedGunB.barrelSprite.bitmap, cachedBarrel,
    'arms using the same gun share its cropped barrel bitmap');
cachedGunA.setWeapon('gun2');
cachedGunA.setWeapon('gun1');
assert.equal(cachedGunA.barrelSprite.bitmap, cachedBarrel,
    'switching back to a gun reuses its cropped barrel bitmap');
const originalActorBitmap = yume._bitmaps[0];
cachedGunA.setWeapon('gun2');
yume._bitmaps[0] = { addLoadListener(listener) { listener(); } };
cachedGunA.setWeapon('gun1');
assert.notEqual(cachedGunA.barrelSprite.bitmap, cachedBarrel,
    'changing the source actor sheet refreshes the cached gun bitmap');
yume._bitmaps[0] = originalActorBitmap;
manager.clear();
manager.random = originalRandom;

// A crowded repeat can move less than 24px instead of jumping to the other side.
const tightGun = manager.ensureArm(701, 'gun1');
const tightNeighbor = manager.ensureArm(702, 'gun2');
tightGun.points = [
    { x: -9, y: -53 }, { x: -6.63, y: -88.11 }, { x: -39.17, y: -71.15 },
    { x: -72.74, y: -85.02 }, { x: -76, y: -120 }
];
tightNeighbor.points = [
    { x: -9, y: -53 }, { x: -23.75, y: -79.17 }, { x: 7.93, y: -74.73 },
    { x: -19.12, y: -90.87 }, { x: 0, y: -114 }
];
tightNeighbor.hasDeployed = tightGun.hasDeployed = true;
tightGun.useCount = 1;
tightNeighbor.angle = Math.atan2(114, 230);
manager.random = () => 0.5;
const tightStart = { ...tightGun.points.at(-1) };
tightGun.out('gun1', 'random', 0, 0, 0, 2, { x: 230, y: 0 });
const tightTravel = Math.hypot(tightGun.points.at(-1).x - tightStart.x,
    tightGun.points.at(-1).y - tightStart.y);
assert.ok(tightTravel > 0 && tightTravel <= 44,
    'a constrained repeat uses a short move rather than crossing the whole gun band');
assert.ok(separated(weaponBounds(tightGun), weaponBounds(tightNeighbor)),
    'the shorter repeat still keeps the two guns apart');
manager.clear();

for (const [index, target] of [null, { x: 230, y: 0 }, { x: -190, y: 0 }].entries()) {
    randomSeed = 1234;
    manager.random = seededMath.random;
    const pair = [manager.ensureArm(710, 'gun1'), manager.ensureArm(711, 'gun2')];
    for (let shot = 0; shot < 50; shot++) {
        const gun = pair[shot % 2];
        gun.out(gun.weapon, 'random', 0, 0, 0, shot + 1, target);
        const tip = gun.points.at(-1);
        assert.ok(tip.x >= -80 && tip.x <= 80 && tip.y >= -120 && tip.y <= -100,
            `pair ${index}, shot ${shot}: joint clearance never pushes a gun out of its band`);
        if (shot > 0) assert.ok(separated(weaponBounds(pair[0]), weaponBounds(pair[1])),
            `pair ${index}, shot ${shot}: the guns stay separate`);
    }
    manager.clear();
}
manager.random = originalRandom;
console.log('Yume battle arm tests passed');
