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
    createBuffer(folder, name) {
        const buffer = {
            folder, name, playing: false, stops: 0,
            play(loop) { this.loop = loop; this.playing = true; playedSe.push(this); },
            isPlaying() { return this.playing; },
            stop() { this.playing = false; this.stops++; }
        };
        return buffer;
    },
    updateSeParameters(buffer, se) { buffer.se = se; },
    playSe(se) {
        this._seBuffers = this._seBuffers.filter(buffer => buffer.isPlaying());
        const buffer = this.createBuffer('se', se.name);
        this.updateSeParameters(buffer, se);
        buffer.play(false);
        this._seBuffers.push(buffer);
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
            clearRect(x, y, width, height) { bitmap.lastClear = { x, y, width, height }; },
            save() {}, restore() {}, translate() {},
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
    ImageManager: {
        loadSvActor: () => ({ addLoadListener(listener) { listener(); } }),
        loadBitmap: () => ({})
    },
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
assert.equal(firstMoveSe.se.volume, 8);
assert.ok(firstMoveSe.se.pitch >= 96 && firstMoveSe.se.pitch <= 104,
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
assert.equal(manager.foregroundLayer.parent, null);

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
assert.ok(deployedArm.barrelSprite._yuraInfo, 'the static gun drawing keeps yura while moving');
assert.equal(barrelMesh.visible, true, 'transport does not hide the active weapon mesh');
assert.equal(deployedArm.barrelSprite._baseBitmap, barrelBaseBitmap,
    'the moving weapon retains the original drawing behind its active mesh');
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
assert.equal(barrelMesh.visible, false, 'the rotor transition hides the old static-gun mesh');
assert.equal(deployedArm.barrelSprite.bitmap, barrelBaseBitmap);
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
assert.deepEqual(Array.from(context.KNH_ZXC_Battle_Yume.poseNames), ['random', 'overhead', 'targetUpperLeft', 'targetLeft']);
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
const soundA = soundArmA.moveSeBuffer;
soundArmB.out('gun2', 'random', 0, 0, 20, 1);
const soundB = soundArmB.moveSeBuffer;
assert.ok(soundA && soundB && soundA !== soundB,
    'each movement request creates its own buffer');
assert.equal(soundA.stops, 1, 'a new arm movement stops the previous shared movement sound');
assert.equal(soundArmA.moveSeBuffer, null, 'the superseded arm releases the shared voice');
for (let frame = 0; frame < 12; frame++) {
    soundArmA.update();
    soundArmB.update();
}
assert.equal(soundA.stops, 1, 'finishing the old movement does not stop it twice');
assert.equal(soundB.stops, 0, 'the other arm keeps sounding until its movement ends');
soundArmA.scheduleIn(0, 12);
const returnSound = soundArmA.moveSeBuffer;
assert.equal(soundB.stops, 1, 'returning to the pack also replaces the shared movement voice');
assert.equal(returnSound.se.name, 'Machine', 'returning to the backpack has its own movement sound');
for (let frame = 0; frame < 12; frame++) soundArmA.update();
assert.equal(returnSound.stops, 1, 'the return sound stops when retraction finishes');
manager.random = () => 0;
soundArmB.move('random', 0, 0, 8);
const replacementSound = soundArmB.moveSeBuffer;
assert.equal(soundB.stops, 1, 'repositioning replaces the previous sound on that arm');
assert.notEqual(replacementSound, soundB);
assert.equal(replacementSound.se.pitch, 96);
manager.random = () => 0.999;
soundArmB.move('random', 0, 0, 8);
assert.equal(replacementSound.stops, 1);
assert.equal(soundArmB.moveSeBuffer.se.pitch, 104,
    'pitch variation reaches both ends of the narrow range');
const finalSound = soundArmB.moveSeBuffer;
soundArmA.startMoveSe('00_drill', 70, 100);
const cuttingSound = soundArmA.moveSeBuffer;
assert.equal(finalSound.stops, 0, 'cutting does not replace another arm movement');
AudioManager.playSe({ name: 'Shot2', volume: 34, pitch: 80 });
const independentShot = AudioManager._seBuffers.at(-1);
const otherYume = new ActorSprite();
battleLayer.addChild(otherYume);
const otherMove = { skillId: 101, test: false, wait: 0 };
otherYume.processExtraActionCommand('yumeArmOut', ['gun1', 'random', 12], otherMove, false);
const otherManager = otherYume._yumeArmManager;
const otherSound = otherManager.armFor(101).moveSeBuffer;
assert.equal(finalSound.stops, 1, 'movement sharing also spans separate arm managers');
assert.equal(cuttingSound.stops, 0, 'a new movement leaves the drill sound playing');
assert.equal(independentShot.stops, 0, 'a new movement leaves the shot sound playing');
const originalPlaySe = AudioManager.playSe;
AudioManager.playSe = () => {};
soundArmB.startMoveSe();
AudioManager.playSe = originalPlaySe;
assert.equal(otherSound.stops, 0, 'a suppressed SE request does not silence the current movement');
manager.clear();
assert.equal(finalSound.stops, 1, 'clearing the arms stops their owned sounds');
assert.equal(cuttingSound.stops, 1, 'clearing the cutting arm stops its own drill sound');
assert.equal(otherSound.stops, 0, 'clearing an old manager does not stop the new movement');
otherManager.clear();
assert.equal(otherSound.stops, 1);
assert.equal(independentShot.stops, 0, 'arm cleanup leaves independent shots alone');
independentShot.stop();
battleLayer.removeChild(otherYume);
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
// Cannon uses the separate sheet, waits with yura, then plays all six cells
// before looping only the three smoke cells through retraction.
yume.clearYumeArms();
const cannonSheet = { addLoadListener(listener) { listener(); } };
yume._bitmaps[1] = cannonSheet;
const cannonAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['cannon', 'overhead', 36, 'wait'], cannonAction, false);
const cannon = manager.armFor(101);
assert.equal(cannonAction.wait, 36);
assert.equal(cannon.weaponFiring, false, 'deploying the cannon must not fire it');
assert.equal(cannon.sequenceFrame, 0);
assert.ok(cannon.barrelSprite._yuraInfo, 'the first cannon cell sways during deployment too');
assert.equal(cannon.sequenceBitmaps.length, 6);
assert.equal(cannon.sequenceBitmaps[0].lastBlit.source, cannonSheet);
assert.equal(cannon.sequenceBitmaps[0].lastBlit.x, 0);
assert.equal(cannon.sequenceBitmaps[0].lastBlit.y, 0);
assert.equal(cannon.sequenceBitmaps[5].lastBlit.x, 5 * 144);
for (const cell of cannon.sequenceBitmaps) {
    assert.equal(cell.lastBlit.width, 144, 'the full source cell preserves the right edge of the smoke');
    assert.equal(cell.lastBlit.height, 144, 'the full source cell preserves the cannon underside');
    assert.equal(cell.width, 144);
    assert.equal(cell.height, 144);
}
assert.equal(cannon.barrelSprite.anchor.x, 0.5);
assert.equal(cannon.barrelSprite.anchor.y, 0.5);
assert.equal(cannon.toPoints.at(-1).x, 12);
assert.equal(cannon.toPoints.at(-1).y, -142);
for (const [offsetX, offsetY] of [[0, 0], [-32, 32]]) {
    const points = cannon.poseTarget('overhead', offsetX, offsetY, null).points;
    const tip = points.at(-1), rear = points.at(-2);
    assert.ok(rear.x < tip.x - 24, 'the last cannon link enters from the left');
    assert.equal(rear.y, tip.y, 'the cannon rear link is horizontal');
    assert.ok(points.slice(1, -1).filter(p => p.y <= tip.y + 12).every(p => p.x < tip.x - 18),
        'upper arm joints remain outside the left edge of the cannon');
}
for (let i = 0; i < 60; i++) yume.update();
assert.equal(cannon.sequenceFrame, 0, 'the first cell stays still before firing');
assert.ok(cannon.barrelSprite._yuraInfo, 'the waiting cannon uses yurayura');
assert.equal(cannon.rotorSprite.visible, false);

// The first firing pose keeps yura; switching to cell two must clear that mesh.
const cannonIdleBitmap = cannon.barrelSprite.bitmap;
cannon.barrelSprite._baseBitmap = cannonIdleBitmap;
cannon.barrelSprite.bitmap = new Bitmap(224, 224);
cannon.barrelSprite._meshSprite = { visible: true };
yume.processExtraActionCommand('yumeArmWeaponAnime', ['cannon', 36], cannonAction, false);
assert.ok(cannon.barrelSprite._yuraInfo, 'the initial firing cell does not freeze');
assert.ok(cannon.armSprite._yuraInfo, 'the deployed arm sways during firing');
const cannonCells = [];
const smokeChanges = [];
for (let i = 0; i < 60; i++) {
    if (i % 6 === 0) cannonCells.push(cannon.sequenceFrame);
    const previousCell = cannon.sequenceFrame;
    yume.update();
    if (cannon.sequenceFrame >= 3 && cannon.sequenceFrame !== previousCell) smokeChanges.push(i + 1);
    assert.ok(cannon.armSprite._yuraInfo, 'the arm keeps swaying through firing and smoke');
    if (i === 5) {
        assert.equal(cannon.barrelSprite._yuraInfo, null);
        assert.equal(cannon.barrelSprite._meshSprite.visible, false);
        assert.equal(cannon.barrelSprite.bitmap, cannon.sequenceBitmaps[1],
            'the next authored cell has no stale first-cell mesh');
    }
}
assert.deepEqual(cannonCells, [0, 1, 2, 3, 3, 4, 5, 3, 3, 4]);
assert.equal(smokeChanges[0], 18, 'the firing poses reach smoke at the original time');
for (let i = 1; i < smokeChanges.length; i++)
    assert.equal(smokeChanges[i] - smokeChanges[i - 1], cannon.armSprite._yuraInfo[2],
        'smoke changes at the same interval as regular arm yurayura');
assert.equal(cannon.barrelSprite._yuraInfo, null, 'smoke uses its drawn animation');
yume.processExtraActionCommand('yumeArmIn', [8, 36], cannonAction, false);
assert.equal(cannon.sequenceFrame, 0, 'smoke disappears before the packing grace period');
assert.equal(cannon.barrelSprite.bitmap, cannonIdleBitmap);
assert.ok(cannon.barrelSprite._yuraInfo, 'cell one resumes yurayura before packing');
for (let i = 0; i < 24; i++) yume.update();
assert.equal(cannon.phase, 'retracting');
assert.ok(Math.abs(cannon.toAngle + Math.PI / 2 - Math.atan2(16, 42)) < 1e-9,
    'the cannon turns its authored barrel axis upright when packing');
assert.equal(cannon.sequenceFrame, 0, 'packing keeps the smoke-free first cell');
assert.ok(cannon.barrelSprite._yuraInfo, 'the packed body keeps its first-cell yurayura while moving');
let sawSoftCannonReturn = false, previousCannonAlpha = 1;
for (let i = 0; i < 30; i++) {
    yume.update();
    if (cannon.toPoints) {
        assert.equal(cannon.sequenceFrame, 0);
        assert.ok(cannon.barrelSprite._yuraInfo);
        assert.ok(cannon.weaponRoot.alpha <= previousCannonAlpha,
            'the cannon fades toward the pack without flashing back');
        assert.ok(cannon.weaponScale >= 0.5 && cannon.weaponScale <= 1);
        if (cannon.moveElapsed >= 24) {
            assert.equal(cannon.weaponRoot.visible, true,
                'the cannon stays visible through its final folding poses');
            if (cannon.weaponRoot.alpha > 0 && cannon.weaponRoot.alpha < 1) sawSoftCannonReturn = true;
        }
        previousCannonAlpha = cannon.weaponRoot.alpha;
    }
}
assert.equal(sawSoftCannonReturn, true);
assert.equal(manager.armFor(101), null, 'the cannon is removed after returning');
assert.equal(cannon.moveSeBuffer, null);
assert.equal(validate('yumeArmOut', ['cannon', 'overhead', '36', 'wait']).valid, true);
assert.equal(validate('yumeArmWeaponAnime', ['cannon']).valid, true);

const cannonRepeat = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['cannon', 'overhead', 0], cannonRepeat, false);
const reusedCannon = manager.armFor(101);
assert.equal(reusedCannon.sequenceBitmaps[0], cannonIdleBitmap, 'cropped cells are cached');
yume.processExtraActionCommand('yumeArmWeaponAnime', ['cannon', 'wait'], cannonRepeat, false);
assert.equal(cannonRepeat.wait, 36, 'the default shot covers all six cells');
for (let i = 0; i < 50; i++) yume.update();
yume.processExtraActionCommand('yumeArmIn', [8, 36], cannonRepeat, false);
const interruptedCannon = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['cannon', 'overhead', 0], interruptedCannon, false);
assert.equal(manager.armFor(101), reusedCannon, 'repeated casts reuse the deployed arm');
assert.equal(reusedCannon.phase, 'active', 'a new cast cancels pending retraction');
assert.equal(reusedCannon.sequenceFrame, 0, 'a new cast returns to the waiting cell');
assert.ok(reusedCannon.barrelSprite._yuraInfo);
yume.clearYumeArms();

// Drill idle and cutting are separate authored loops, with no translucent
// actor guides, no mesh left behind, and exact screen-space motion.
const drillEnemy = {
    width: 144, height: 144, z: 3, anchor: { x: 0.5, y: 1 },
    toGlobal(point) { return { x: 640 + point.x * 2, y: 480 + point.y * 2 }; }
};
yume.targetSprite = () => drillEnemy;
const drillAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['drill', 'overhead', 0], drillAction, false);
const drill = manager.armFor(101);
assert.equal(drill.sequenceBitmaps[0].lastBlit.source, cannonSheet);
assert.equal(drill.sequenceBitmaps[0].lastBlit.y, 144 + 64);
assert.equal(drill.sequenceBitmaps[0].lastPixels[3], 0, 'translucent actor guides are removed');
assert.equal(drill.barrelSprite.anchor.x * 60 + 64, 76, 'the drill attaches at its rear bearing');
assert.equal(drill.weaponFiring, false);
assert.equal(drill.weaponRoot.parent, manager.foregroundLayer, 'a deployed drill uses its own foreground layer');
assert.equal(drill.armSprite.parent, manager.backLayer, 'the backpack arm remains behind Yume');
const idleCells = [];
for (let i = 0; i < 36; i++) {
    if (i % 6 === 0) idleCells.push(drill.sequenceFrame);
    yume.update();
}
assert.deepEqual(idleCells, [0, 1, 2, 0, 1, 2]);
assert.ok(manager.foregroundLayer.z > drillEnemy.z, 'the drill draws in front of the enemy');
assert.equal(drill.barrelSprite._yuraInfo, null, 'the authored idle loop supplies the wobble');
yume.processExtraActionCommand('yumeArmMove', ['targetUpperLeft', 0], drillAction, false);
const drillStart = yume.toGlobal(drill.points.at(-1));
assert.equal(drillStart.x, 576);
assert.equal(drillStart.y, 288);
assert.ok(Math.abs(drill.angle + Math.atan2(30, 28) - Math.atan2(48, 64)) < 1e-9,
    'the drill axis points from the upper-left staging point into the enemy');
yume.processExtraActionCommand('yumeArmDrill', [60, 24, 'wait'], drillAction, false);
const drillBuffer = drill.moveSeBuffer;
assert.equal(drillBuffer.se.name, '00_drill');
assert.equal(drillAction.wait, 60);
const cuttingCells = [];
for (let i = 0; i < 60; i++) {
    if (i % 6 === 0) cuttingCells.push(drill.sequenceFrame);
    yume.update();
    const tip = yume.toGlobal(drill.points.at(-1));
    const advance = (i + 1) / 60;
    assert.ok(Math.abs(tip.x - drillStart.x - 19.2 * advance - drill.drillShakeX) < 1e-9,
        'horizontal shake is exactly one screen pixel independently of the actor scale');
    assert.ok(Math.abs(tip.y - drillStart.y - 14.4 * advance) < 1e-9);
    if (i < 59) assert.ok(drill.drillMotion, 'cutting runs for the full second');
}
assert.deepEqual(cuttingCells, [3, 4, 5, 3, 4, 5, 3, 4, 5, 3]);
assert.equal(drill.drillMotion, null);
assert.equal(drill.weaponFiring, false);
assert.equal(drill.drillShakeX, 0);
assert.equal(drillBuffer.stops, 1, 'cutting sound stops at the end of the second');
assert.equal(drill.sequenceFrame, 0);
yume.processExtraActionCommand('yumeArmDrill', [60, 24], drillAction, false);
const interruptedBuffer = drill.moveSeBuffer;
for (let i = 0; i < 10; i++) yume.update();
const drillAgain = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['drill', 'overhead', 0], drillAgain, false);
assert.equal(interruptedBuffer.stops, 1, 'a recast stops the previous cutting sound');
assert.equal(drill.drillMotion, null);
assert.equal(drill.sequenceFrame, 0);
yume.processExtraActionCommand('yumeArmDrill', [60, 24], drillAgain, false);
const switchedBuffer = drill.moveSeBuffer;
drill.setWeapon('gun1');
assert.equal(switchedBuffer.stops, 1, 'switching weapons also cancels the cutting sound');
assert.equal(drill.drillMotion, null);
drill.setWeapon('drill');
yume.processExtraActionCommand('yumeArmIn', [0, 36], drillAgain, false);
for (let i = 0; i < 38; i++) yume.update();
assert.equal(manager.armFor(101), null);
const drillTimingProbe = { skillId: 101, test: true, wait: 0 };
yume.processExtraActionCommand('yumeArmDrill', [60, 24, 'wait'], drillTimingProbe, false);
assert.equal(drillTimingProbe.wait, 60);
assert.equal(manager.hasArms(), false, 'timing probes do not create cutting effects');
assert.equal(validate('yumeArmDrill', ['60', '24', 'wait']).valid, true);
assert.equal(validate('yumeArmDrill', ['0', '24']).valid, false);
assert.equal(validate('yumeArmDrill', ['60', '-1']).valid, false);
assert.equal(validate('yumeArmOut', ['drill', 'targetUpperLeft', '30', 'wait']).valid, true);

// Deployment emerges upward and approaches from above-left along a single
// curve, without a waypoint stop or a second positioning movement.
const directAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['drill', 'targetUpperLeft', 30, 'wait'], directAction, false);
const directDrill = manager.armFor(101);
assert.equal(directDrill.unfoldDirect, true);
const directEnd = yume.toGlobal(directDrill.toPoints.at(-1));
const directRoot = yume.toGlobal({ x: -9, y: -53 });
const approachSteps = [];
for (let i = 1; i <= 30; i++) {
    yume.update();
    if (i % 6 !== 0) continue;
    const tip = yume.toGlobal(directDrill.points.at(-1));
    approachSteps.push(tip);
    assert.equal(directDrill.weaponRoot.visible, true, 'the weapon remains visible along the approach');
    assert.equal(directDrill.weaponRoot.parent, i < 30 ? manager.frontLayer : manager.foregroundLayer,
        'emergence stays behind Yume and contact switches in front of the enemy');
}
assert.ok(approachSteps[0].y < directRoot.y, 'the first visible motion rises out of the backpack');
assert.ok(directRoot.y - approachSteps[0].y > Math.abs(approachSteps[0].x - directRoot.x),
    'the initial direction is predominantly upward');
for (let i = 1; i < approachSteps.length; i++) {
    assert.ok(approachSteps[i].x > approachSteps[i - 1].x, 'the curve keeps advancing without a waypoint stop');
}
assert.ok(approachSteps.at(-2).x < directEnd.x && approachSteps.at(-2).y < directEnd.y,
    'the final approach enters from the upper-left');
assert.ok(Math.abs(approachSteps.at(-1).x - directEnd.x) < 1e-9);
assert.ok(Math.abs(approachSteps.at(-1).y - directEnd.y) < 1e-9);
assert.equal(directDrill.unfoldDirect, false);
const appliedAtStart = [];
const originalActionApply = yume.actionApply;
yume.actionApply = function(action) {
    action.appliedNum = (action.appliedNum || 0) + 1;
    if (!action.test) appliedAtStart.push({ cutting: !!directDrill.drillMotion, elapsed: directDrill.drillMotion.elapsed });
};
yume.processExtraActionCommand('yumeArmDrill', [60, 24, 'apply', 'wait'], directAction, false);
assert.deepEqual(appliedAtStart, [{ cutting: true, elapsed: 0 }], 'damage happens on the same tick cutting starts');
assert.equal(directAction.wait, 60);
for (let i = 0; i < 60; i++) yume.update();
assert.equal(appliedAtStart.length, 1, 'finishing the cut does not apply damage a second time');
yume.clearYumeArms();
const directProbe = { skillId: 101, test: true, wait: 0, appliedNum: 0 };
yume.processExtraActionCommand('yumeArmDrill', [60, 24, 'apply', 'wait'], directProbe, false);
assert.equal(directProbe.appliedNum, 1, 'timing probes count the inline apply');
assert.equal(directProbe.wait, 60);
assert.equal(appliedAtStart.length, 1, 'timing probes do not deal damage');
assert.equal(manager.hasArms(), false);
if (originalActionApply) yume.actionApply = originalActionApply;
else delete yume.actionApply;
assert.equal(validate('yumeArmDrill', ['60', '24', 'apply', 'wait']).valid, true);
assert.equal(validate('yumeArmDrill', ['60', '24', 'unknown', 'wait']).valid, false);

// Shell launch uses the live muzzle, including the expanded-frame recoil,
// rather than the actor's body position or the arm's attachment joint.
const shellCalls = [];
context.SceneManager._scene.newBullet = (...args) => { shellCalls.push(args); return args; };
const shellAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['cannon', 'overhead', 0], shellAction, false);
yume.processExtraActionCommand('yumeArmWeaponAnime', ['cannon', 36], shellAction, false);
for (let i = 0; i < 6; i++) yume.update();
yume.processExtraActionCommand('yumeArmBullet', ['artilleryShell', 36, 'wait'], shellAction, false);
assert.equal(shellAction.wait, 36);
assert.equal(shellCalls.length, 1);
assert.equal(shellCalls[0][0], 'artilleryShell');
assert.equal(shellCalls[0][1], 212, 'muzzle X includes 7 source pixels of recoil');
assert.equal(shellCalls[0][2], -101, 'muzzle Y follows the center of the expanded opening and recoil');
assert.equal(shellCalls[0][3], 630);
assert.equal(shellCalls[0][4], 316);
assert.equal(shellCalls[0][5], 'parabola');
assert.ok(shellCalls[0][7] < 0, 'the arc launches upward');
assert.ok(Math.abs(shellCalls[0][6] * 3 * 35 - Math.hypot(418, 417)) < 1e-5,
    'the speed matches the requested impact time');
const newerShell = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['cannon', 'overhead', 0], newerShell, false);
yume.processExtraActionCommand('yumeArmBullet', ['artilleryShell', 36], shellAction, false);
assert.equal(shellCalls.length, 2, 'an already queued earlier shot keeps its visual effect');
const oldShellTarget = yume.targetSprite;
yume.targetSprite = () => { throw new Error('a timing probe must not inspect the target'); };
const shellProbe = { skillId: 101, test: true, wait: 0 };
yume.processExtraActionCommand('yumeArmBullet', ['artilleryShell', 36, 'wait'], shellProbe, false);
assert.equal(shellProbe.wait, 36);
assert.equal(shellCalls.length, 2, 'timing probes must not create projectiles');
yume.targetSprite = oldShellTarget;
assert.equal(validate('yumeArmBullet', ['artilleryShell', '36', 'wait']).valid, true);
assert.equal(validate('yumeArmBullet', ['', '36']).valid, false);
assert.equal(validate('yumeArmBullet', ['artilleryShell', '1']).valid, false);
yume.clearYumeArms();

// The flamethrower keeps two arm tips on its independent nozzle/tank joints,
// while body and flame advance on separate clocks using full source cells.
yume.targetSprite = () => drillEnemy;
const flameAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 36, 'wait'], flameAction, false);
const flame = manager.armFor(101);
assert.equal(flame.weaponScale, 0.5, 'the flamethrower starts at half size inside the backpack');
assert.equal(flame.angle, -Math.PI / 2, 'the stored nozzle points vertically upward');
let previousFlameScale = flame.weaponScale;
let previousFlameAngle = flame.angle;
for (let i = 0; i < 36; i++) {
    yume.update();
    if (i % 6 !== 5) continue;
    assert.ok(flame.weaponScale >= previousFlameScale, 'deployment grows without shrinking back');
    assert.equal(flame.weaponRoot.scale.x, flame.weaponScale);
    assert.equal(flame.weaponRoot.scale.y, flame.weaponScale);
    if (i === 5) assert.equal(flame.weaponScale, 0.5, 'the first emerged pose shows the packed body');
    if (i >= 11) assert.equal(flame.weaponScale, 1, 'expansion finishes in the next six-frame pose step');
    assert.ok(flame.angle >= previousFlameAngle - 1e-9 && flame.angle <= flame.toAngle + 1e-9,
        'deployment turns continuously toward the enemy');
    if (i === 5) assert.equal(flame.angle, -Math.PI / 2, 'the first emerged pose remains vertical');
    previousFlameAngle = flame.angle;
    previousFlameScale = flame.weaponScale;
    const tank = flame.supportTarget(flame.points.at(-1), flame.angle);
    assert.ok(Math.hypot(tank.x - flame.supportPoints.at(-1).x, tank.y - flame.supportPoints.at(-1).y) < 1e-9);
    assert.ok(Math.abs(Math.hypot(tank.x - flame.points.at(-1).x, tank.y - flame.points.at(-1).y) -
        Math.hypot(48, 8) * flame.weaponScale) < 1e-9, 'the tank joint follows the scaled body');
}
assert.equal(flame.weaponScale, 1, 'deployment finishes at the normal firing size');
assert.ok(Math.abs(flame.angle - Math.atan2(74, 288)) < 1e-9, 'the deployed nozzle aims toward the enemy');
assert.equal(yume.toGlobal(flame.points.at(-1)).x, 352, 'the nozzle base stays 288 screen pixels left of the enemy center');
assert.equal(flame.sequenceBitmaps.length, 8);
assert.ok(flame.sequenceBitmaps.every(b => b.width === 144 && b.height === 144));
assert.equal(flame.sequenceBitmaps[0].lastBlit.y, 288);
assert.equal(flame.supportPoints.length, 5);
const flameHits = [];
const preFlameApply = yume.actionApply;
yume.actionApply = function(action) {
    action.appliedNum = (action.appliedNum || 0) + 1;
    if (!action.test) flameHits.push(manager.armFor(action.skillId).flameFrame);
};
yume.processExtraActionCommand('yumeArmFlame', [60, 'apply', 'wait'], flameAction, false);
assert.ok(flame.armSprite._yuraInfo, 'the bitmap containing both support arms sways during spraying');
assert.equal(flameAction.wait, 66);
assert.equal(flame.flameFrame, 3);
assert.deepEqual(flameHits, [], 'the short emergence has not reached the enemy center fixture');
const bodyLoop = [], flameLoop = [];
for (let i = 0; i < 66; i++) {
    if (i % 6 === 0) { bodyLoop.push(flame.sequenceFrame); flameLoop.push(flame.flameFrame); }
    yume.update();
    assert.ok(flame.armSprite._yuraInfo, 'both flamethrower arms keep yura throughout the spray');
}
assert.deepEqual(flameLoop, [3, 4, 5, 6, 4, 5, 6, 4, 5, 6, 7]);
assert.ok(bodyLoop.every(cell => cell >= 0 && cell <= 2));
assert.equal(new Set(bodyLoop).size, 3, 'the body keeps its three-cell loop while firing');
assert.deepEqual(flameHits, [4], 'damage applies once when the first full flame reaches the enemy');
assert.equal(flame.flameSprite.visible, false);
assert.equal(flame.flameMotion, null);
flame.startFlame(60, () => flameHits.push('unexpected'));
const flameSound = flame.moveSeBuffer;
flame.move('targetLeft', 0, 0, 12, manager.enemyCenterLocal(drillEnemy, 0, 0));
assert.equal(flame.flameMotion, null);
assert.equal(flame.flameSprite.visible, false);
assert.equal(flameSound.stops, 1, 'interrupting the cast stops the flame sound');
yume.clearYumeArms();
const flameProbe = { skillId: 101, test: true, wait: 0, appliedNum: 0, applyList: [] };
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 36, 'wait'], flameProbe, false);
yume.processExtraActionCommand('yumeArmFlame', [60, 'apply', 'wait'], flameProbe, false);
assert.equal(flameProbe.wait, 66);
assert.equal(flameProbe.applyList[4], true, 'timing probes include the rig update on the command tick');
assert.equal(manager.hasArms(), false, 'flame timing probes do not allocate sprites');
const genericFlameProbe = { skillId: 101, test: true, wait: 0 };
yume.processExtraActionCommand('yumeArmWeaponAnime', ['flamethrower', 'wait'], genericFlameProbe, false);
assert.equal(genericFlameProbe.wait, 66, 'generic weapon playback also waits for extinction');
// A visible enemy edge can be reached by the short opening flame. Hit then,
// rather than waiting for its center or for the full-length flame to appear.
const visibleEnemy = new Bitmap(144, 144);
visibleEnemy.isReady = () => true;
visibleEnemy._context.getImageData = () => {
    const data = new Uint8ClampedArray(144 * 144 * 4);
    for (let y = 48; y < 112; y++) for (let x = 8; x < 104; x++) data[(y * 144 + x) * 4 + 3] = 255;
    return { data };
};
drillEnemy.bitmap = visibleEnemy;
drillEnemy._frame = { x: 0, y: 0, width: 144, height: 144 };
const edgeAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 0], edgeAction, false);
yume.processExtraActionCommand('yumeArmFlame', [60, 'apply', 'wait'], edgeAction, false);
assert.deepEqual(flameHits, [4, 3], 'the opening flame damages immediately upon touching the visible enemy');
const edgeProbe = { skillId: 101, test: true, wait: 0, appliedNum: 0, applyList: [] };
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 36, 'wait'], edgeProbe, false);
yume.processExtraActionCommand('yumeArmFlame', [60, 'apply', 'wait'], edgeProbe, false);
assert.equal(edgeProbe.appliedNum, 1, 'the immediate-contact timing probe counts the same opening hit');
assert.equal(flameHits.length, 2, 'the probe itself causes no damage');
yume.clearYumeArms();
delete drillEnemy.bitmap;
delete drillEnemy._frame;
if (preFlameApply) yume.actionApply = preFlameApply;
else delete yume.actionApply;

// Packing is visible before backpack occlusion, and a recast resumes from the
// current size instead of snapping to a fully enlarged weapon.
const packedAction = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 36, 'wait'], packedAction, false);
const packedFlame = manager.armFor(101);
for (let i = 0; i < 36; i++) yume.update();
packedFlame.scheduleIn(0, 36);
let returnScale = 1, lastVisibleScale = 1;
for (let i = 0; i < 18; i++) {
    yume.update();
    assert.ok(packedFlame.weaponScale <= returnScale, 'returning to the backpack shrinks the body');
    assert.ok(packedFlame.weaponScale >= 0.5, 'the minimum scale stays at fifty percent');
    if (i >= 5) assert.equal(packedFlame.weaponScale, 0.5, 'packing finishes within six frames');
    assert.ok(packedFlame.angle <= packedFlame.fromAngle && packedFlame.angle >= -Math.PI / 2);
    returnScale = packedFlame.weaponScale;
    if (packedFlame.weaponRoot.visible) lastVisibleScale = returnScale;
}
assert.equal(lastVisibleScale, 0.5, 'the weapon becomes compact while still visible');
assert.equal(packedFlame.angle, -Math.PI / 2, 'the nozzle is vertical before descending into the backpack');
const recastFlame = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 36, 'wait'], recastFlame, false);
assert.equal(manager.armFor(101), packedFlame);
assert.equal(packedFlame.weaponScale, returnScale, 'interrupting retraction preserves the current size');
for (let i = 0; i < 36; i++) yume.update();
assert.equal(packedFlame.weaponScale, 1);
packedFlame.scheduleIn(0, 36);
for (let i = 0; i < 36; i++) yume.update();
assert.equal(packedFlame.weaponScale, 0.5);
assert.equal(packedFlame.angle, -Math.PI / 2, 'the packed rig finishes vertical');
assert.equal(manager.hasArms(), false, 'the packed rig is removed after returning');

assert.equal(validate('yumeArmFlame', ['60', 'apply', 'wait']).valid, true);
assert.equal(validate('yumeArmFlame', ['0', 'apply']).valid, false);
assert.equal(validate('yumeArmOut', ['flamethrower', 'targetLeft', '36', 'wait']).valid, true);

// Charging preserves its release size, including early release, and hands
// damage to the actual projectile impact rather than an independent timer.
const chargeShots = [], chargeDamage = [];
const beforeChargeApply = yume.actionApply;
yume.actionApply = function(action) {
    if (!action.test) chargeDamage.push(action.skillId);
};
context.SceneManager._scene.newBullet = (...args) => {
    const bullet = new Sprite();
    bullet.bitmap = { width: 1344, height: 448, isReady: () => true, addLoadListener(listener) { listener(); } };
    bullet.ticks = 0;
    bullet.update = function() { if (++this.ticks === 18) this._finish = 1; };
    chargeShots.push({ args, bullet });
    return bullet;
};
for (const heldFrames of [0, 12, 36, 72]) {
    yume.clearYumeArms();
    const action = yume.startAction(101);
    yume.processExtraActionCommand('yumeArmOut', ['chargeCannon', 'overhead', 10, 56, 0], action, false);
    const rig = manager.armFor(101);
    assert.equal(rig.sequenceBitmaps.length, 6);
    assert.equal(rig.sequenceBitmaps[0].lastBlit.y, 432);
    assert.equal(rig.barrelSprite.anchor.x * 144, 73);
    assert.equal(rig.barrelSprite.anchor.y * 144, 74);
    assert.equal(yume.toGlobal(rig.points.at(-1)).x, 184, 'the grip is 32 screen pixels left of the previous 26px offset');
    const restingPoints = rig.points.map(p => ({ ...p }));
    yume.processExtraActionCommand('yumeArmCharge', [36], action, false);
    const chargeSound = rig.moveSeBuffer;
    assert.deepEqual([chargeSound.se.name, chargeSound.se.volume, chargeSound.se.pitch], ['Magic1', 18, 90]);
    assert.equal(rig.chargeScale, 0.5);
    assert.ok(rig.armSprite._yuraInfo, 'the arm keeps its yurayura mesh throughout charging');
    assert.equal(rig.barrelSprite._yuraInfo, null, 'the authored body loop supplies its own wobble');
    let previousSize = 0.5;
    const chargeCells = new Set(), bodyCells = new Set();
    for (let i = 0; i < heldFrames; i++) {
        const beforePose = [rig.chargeScale, rig.chargeFrame, rig.barrelSprite.x, rig.chargeSprite.x, rig.sequenceFrame];
        yume.update();
        assert.ok(rig.armSprite._yuraInfo, 'yurayura also remains active while holding maximum charge');
        assert.ok(rig.chargeScale >= previousSize && rig.chargeScale <= 1.5);
        if ((i + 1) % 6 !== 0) {
            assert.deepEqual([rig.chargeScale, rig.chargeFrame, rig.barrelSprite.x, rig.chargeSprite.x, rig.sequenceFrame],
                beforePose, 'charge growth, wobble and body cells hold between shared pose steps');
        }
        assert.equal(rig.chargeFrame, rig.sequenceFrame + 3, 'body and charge cells advance together');
        previousSize = rig.chargeScale;
        chargeCells.add(rig.chargeFrame);
        bodyCells.add(rig.sequenceFrame);
    }
    if (heldFrames >= 36) {
        assert.equal(rig.chargeScale, 1.5, 'a long hold stays capped at one and a half');
        assert.deepEqual([...chargeCells].sort(), [3, 4, 5]);
        assert.deepEqual([...bodyCells].sort(), [0, 1, 2]);
        assert.equal(rig.moveSeBuffer.se.name, 'YumeChargeHold');
        assert.equal(rig.moveSeBuffer.loop, true, 'maximum charge has a continuous quiet hold sound');
        assert.equal(rig.moveSeBuffer.stops, 0);
    }
    const heldSound = rig.moveSeBuffer;
    const releasedSize = rig.chargeScale;
    const tip = rig.points.at(-1), cos = Math.cos(rig.angle), sin = Math.sin(rig.angle);
    const center = yume.toGlobal({
        x: tip.x + rig.chargeSprite.x * cos - rig.chargeSprite.y * sin,
        y: tip.y + rig.chargeSprite.x * sin + rig.chargeSprite.y * cos
    });
    yume.processExtraActionCommand('yumeArmChargeShot', ['chargedShot', 18, 'apply', 'wait'], action, false);
    const { args, bullet } = chargeShots.at(-1);
    assert.equal(action.wait, 18);
    const shotSound = playedSe.at(-1).se;
    assert.deepEqual([shotSound.name, shotSound.volume, shotSound.pitch], ['Shot2', 26, 88]);
    assert.equal(heldSound.stops, 1, 'release stops either the charge-up or held loop');
    assert.equal(bullet._yumeChargeScale, releasedSize);
    assert.ok(Math.abs(bullet.scale.x * 96 - 44 * 2 * releasedSize) < 1e-9,
        'the projectile orb has the same visible diameter as the charge sphere');
    assert.ok(Math.hypot(args[1] - (center.x - 10), args[2] - (center.y - 20)) < 1e-9,
        'the shot starts at the live charge center, including its shake');
    assert.equal(args[5], 'straight');
    assert.equal(rig.chargeMotion, null);
    assert.equal(rig.chargeSprite.visible, false);
    assert.equal(chargeSound.stops, 1);
    assert.ok(rig.recoilMotion);
    assert.equal(rig.armSprite._yuraInfo, null, 'recoil retains its synchronized pose updates');
    const damageBeforeFlight = chargeDamage.length;
    const impactsBeforeFlight = playedSe.filter(b => b.se.name === 'Thunder3').length;
    for (let i = 0; i < 16; i++) {
        const previousTicks = bullet.ticks;
        bullet.update();
        if ((i + 2) % 6 !== 0) assert.equal(bullet.ticks, previousTicks, 'flight logic also holds between pose steps');
    }
    assert.equal(chargeDamage.length, damageBeforeFlight, 'no damage before impact');
    bullet.update();
    assert.equal(chargeDamage.length, damageBeforeFlight + 1);
    assert.equal(playedSe.filter(b => b.se.name === 'Thunder3').length, impactsBeforeFlight + 1);
    for (let i = 0; i < 24; i++) bullet.update();
    assert.equal(chargeDamage.length, damageBeforeFlight + 1, 'the impact callback applies only once');
    assert.equal(playedSe.filter(b => b.se.name === 'Thunder3').length, impactsBeforeFlight + 1,
        'the impact sound also plays exactly once');
    for (let i = 0; i < 18; i++) yume.update();
    assert.deepEqual(rig.points.map(p => ({ ...p })), restingPoints, 'recoil settles without drifting');
    assert.equal(rig.recoilMotion, null);
    assert.equal(manager.fireChargedShot(rig, 'chargedShot', 18, null), null, 'a consumed charge cannot fire twice');
    if (heldFrames === 36) {
        yume.update();
        yume.update();
        rig.scheduleIn(0, 36);
        for (let frame = 0; frame < 36; frame++) {
            const beforeReturn = rig.points.map(p => ({ ...p }));
            yume.update();
            if (rig.toPoints && rig.idleElapsed % 6 !== 0) {
                assert.deepEqual(rig.points.map(p => ({ ...p })), beforeReturn,
                    'a return started between pose boundaries still shares the body/projectile cadence');
            }
        }
    }
}
yume.clearYumeArms();
const chargeCancel = yume.startAction(101);
yume.processExtraActionCommand('yumeArmOut', ['chargeCannon', 'overhead', 36], chargeCancel, false);
const chargeMoveSound = manager.armFor(101).moveSeBuffer.se;
assert.deepEqual([chargeMoveSound.name, chargeMoveSound.volume, chargeMoveSound.pitch], ['Equip1', 18, 88]);
for (let i = 0; i < 36; i++) yume.update();
yume.processExtraActionCommand('yumeArmCharge', [36], chargeCancel, false);
const canceledRig = manager.armFor(101), canceledSound = canceledRig.moveSeBuffer;
canceledRig.startCharge(0);
assert.equal(canceledRig.chargeScale, 0.5, 'zero-duration generic playback still starts with a finite size');
yume.update();
assert.equal(canceledRig.chargeScale, 1.5);
const canceledHoldSound = canceledRig.moveSeBuffer;
assert.equal(canceledHoldSound.loop, true);
yume.clearYumeArms();
assert.equal(canceledRig.chargeSprite.visible, false);
assert.equal(canceledSound.stops, 1, 'canceling a charge stops its audio and effect');
assert.equal(canceledHoldSound.stops, 1, 'canceling maximum charge stops its loop too');
const shotsBeforeProbe = chargeShots.length;
for (const duration of [2, 18, 36]) {
    const probe = { skillId: 101, test: true, wait: 0, applyList: [] };
    yume.processExtraActionCommand('yumeArmOut', ['chargeCannon', 'overhead', 36, 'wait'], probe, false);
    yume.processExtraActionCommand('yumeArmCharge', [36], probe, false);
    yume.processExtraActionCommand('yumeArmChargeShot', ['chargedShot', duration, 'apply', 'wait'], probe, false);
    assert.equal(probe.wait, duration);
    assert.equal(probe.applyList[duration - 2], true);
}
assert.equal(manager.hasArms(), false, 'charge timing probes create no weapon sprites');
assert.equal(chargeShots.length, shotsBeforeProbe, 'charge timing probes create no bullets');
if (beforeChargeApply) yume.actionApply = beforeChargeApply;
else delete yume.actionApply;
assert.equal(validate('yumeArmCharge', ['36']).valid, true);
assert.equal(validate('yumeArmCharge', ['0']).valid, false);
assert.equal(validate('yumeArmCharge', ['36', 'wait']).valid, false);
assert.equal(validate('yumeArmChargeShot', ['chargedShot', '18', 'apply', 'wait']).valid, true);
assert.equal(validate('yumeArmChargeShot', ['chargedShot', '1']).valid, false);
assert.equal(validate('yumeArmChargeShot', ['otherImage', '18']).valid, false);

// Reading a lazy Bitmap context before its image loads permanently captures a
// blank canvas. Timing probes must wait before touching either pixel buffer.
const unloaded = { isReady: () => false };
Object.defineProperty(unloaded, '_context', { get() { throw Error('unloaded pixel buffer accessed'); } });
const previousSheet = yume._bitmaps[1];
yume._bitmaps[1] = unloaded;
drillEnemy.bitmap = unloaded;
drillEnemy._frame = { x: 0, y: 0, width: 144, height: 144 };
const unloadedProbe = { skillId: 101, test: true, wait: 0, applyList: [] };
yume.processExtraActionCommand('yumeArmOut', ['flamethrower', 'targetLeft', 36, 'wait'], unloadedProbe, false);
yume.processExtraActionCommand('yumeArmFlame', [60, 'apply', 'wait'], unloadedProbe, false);
yume._bitmaps[1] = previousSheet;
delete drillEnemy.bitmap;
delete drillEnemy._frame;

// Gatling rush presses share one deployed rig and retain their individual action/
// judgment until each shot lands. The rush-end judgment is not an extra press.
yume._actions = [];
skills[104] = { meta: { animation: 'yumeArmGatling' } };
skills[105] = { meta: { animation: 'yumeArmMachineGun' } };
animations[54] = { id: 54, frames: [[]], timings: [{ frame: 0,
    se: { name: '00_shot1', volume: 40, pitch: 100, pan: 0 } }] };
let machineFrame = 0;
const machineInputs = [], machineShots = [], machineHits = [];
const previousMachineApply = yume.actionApply;
const previousMachineAnimation = context.SceneManager._scene.playAnimation;
yume.actionApply = action => { machineHits.push({ action, frame: machineFrame }); action.appliedNum = (action.appliedNum || 0) + 1; };
context.SceneManager._scene.playAnimation = (animation, x, y, mirror) => {
    const flash = { x, y, rotation: 0 };
    const rig = manager.armFor(104) || manager.armFor(105);
    machineShots.push({ frame: machineFrame, animation, x, y, mirror, flash,
        beltUsed: rig.machineBeltUsed, bodyBitmap: rig.barrelSprite.bitmap, cell: rig.sequenceFrame,
        barrelAngle: rig.angle });
    return flash;
};
function machinePress(button) {
    const action = yume.startAction(104, null, machineInputs.length % 2, button);
    if (!action) return action;
    action.buttonSprite = button || null;
    action.judgment = machineInputs.length % 2;
    machineInputs.push(action);
    yume.processExtraActionCommand('yumeArmGatling', [0], action, true);
    action.list = [];
    return action;
}
function machineTick() {
    yume._actions = yume._actions.filter(action => {
        if (action.list.length) return true;
        if (action.wait > 0) { action.wait--; return true; }
        return false;
    });
    yume.update();
}
const rushButton = { _judged: false, _info: { rush: true } };
let machineRig = null;
const machineBodyCells = new Set();
const machineSpinCells = [];
for (machineFrame = 0; machineFrame < 200; machineFrame++) {
    if ([0, 3, 6, 9, 40, 46, 52, 58, 64, 70, 76].includes(machineFrame)) {
        machinePress(rushButton);
        const rig = manager.armFor(104);
        if (!machineRig) {
            machineRig = rig;
            const end = rig.toPoints.at(-1);
            assert.equal(end.x, -24, 'the heavy weapon is staged left of Yume');
            assert.equal(end.y, -122);
            assert.equal(rig.supportPoints, null, 'the gatling uses one arm');
            assert.equal(rig.toPoints.length, 6, 'five rods add two intermediate joints');
        }
        else assert.equal(rig, machineRig, 'repeated presses reuse the deployed rig');
        assert.equal(rig.useCount, 1, 'queued presses do not restart deployment');
        assert.equal(rig.sequenceBitmaps[0].lastBlit.y, 720, 'the gatling uses sheet row six');
    }
    if (machineFrame === 95) {
        rushButton._judged = true;
        const beforeEnd = yume._actions.length;
        assert.equal(yume.startAction(104, null, 0, rushButton), null, 'rush-end success is not another shot');
        assert.equal(yume._actions.length, beforeEnd);
    }
    machineTick();
    if (machineRig && manager.hasArms()) {
        assert.equal(machineRig.points.length, 6);
        assert.ok(machineRig.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
            'the five-link chain stays valid during deployment, recoil and packing');
        if (machineRig.phase === 'retracting' && machineRig.toPoints) {
            assert.ok(machineRig.points.at(-1).y >= machineRig.fromPoints.at(-1).y - 0.001,
                'packing lowers the gatling without an upward detour');
        }
        if (!machineRig.toPoints && !machineRig.machineGunMotion.closing) {
            const lengths = linkLengths(machineRig.points);
            assert.ok(Math.max(...lengths) - Math.min(...lengths) < 0.01,
                `the five gatling rods keep one length during idle and recoil: ${lengths}`);
            const tip = machineRig.points.at(-1), cos = Math.cos(machineRig.angle), sin = Math.sin(machineRig.angle);
            const lower = machineRig.points.at(-2);
            assert.ok(-(lower.x - tip.x) * sin + (lower.y - tip.y) * cos > 18,
                'the final rod connects to the socket from below, including during recoil');
            assert.ok(machineRig.points.every(p => p.y >= tip.y),
                'no rod detours above the socket to hang the gun');
        }
        machineBodyCells.add(machineRig.sequenceFrame);
        if (!machineRig.toPoints && machineRig.weaponFiring) {
            assert.ok(machineRig.sequenceFrame >= 3 && machineRig.sequenceFrame <= 5,
                'only an actual shot uses the authored rotation cells');
            if (machineSpinCells.at(-1) !== machineRig.sequenceFrame)
                machineSpinCells.push(machineRig.sequenceFrame);
        } else {
            assert.ok(machineRig.sequenceFrame >= 0 && machineRig.sequenceFrame <= 2,
                'waiting and packing use only the authored idle cells');
        }
        if (!machineRig.toPoints && !machineRig.machineGunMotion.closing)
            assert.ok(machineRig.armSprite._yuraInfo, 'the arm wobbles between and during shots');
        if (machineFrame >= 85 && machineFrame < 95)
            assert.equal(machineRig.phase, 'active', 'the open rush window keeps the weapon out during pauses');
    }
}
assert.equal(machineInputs.length, 11);
assert.equal(machineShots.length, 11);
assert.equal(machineHits.length, 11);
assert.equal(machineShots[0].frame, 35, 'the initial inputs fire as soon as deployment finishes');
for (let i = 0; i < machineShots.length; i++) {
    if (i) assert.ok(machineShots[i].frame - machineShots[i - 1].frame >= 6);
    assert.equal(machineHits[i].frame - machineShots[i].frame, 6, 'damage follows the same gun-animation delay');
    assert.equal(machineHits[i].action, machineInputs[i], 'the queue preserves input order and judgment');
    assert.equal(machineShots[i].animation.id, 54);
    assert.equal(machineShots[i].animation.frames, animations[54].frames);
    assert.equal(machineShots[i].animation.timings[0].se.volume, 9);
    assert.ok(machineShots[i].cell >= 3 && machineShots[i].cell <= 5);
    assert.equal(machineShots[i].flash.rotation, machineShots[i].barrelAngle, 'the shared flash follows the barrel angle');
}
assert.equal(animations[54].timings[0].se.volume, 40, 'the shared gun animation is unchanged');
assert.deepEqual([...machineBodyCells].sort(), [0, 1, 2, 3, 4, 5]);
for (let i = 1; i < machineSpinCells.length; i++) {
    assert.ok((machineSpinCells[i - 1] === 4) !== (machineSpinCells[i] === 4),
        'the middle rotation pose separates the visually matching end poses');
}
assert.equal(manager.hasArms(), false, 'the rig is packed after the window ends and queued hits finish');
assert.equal(yume._actions.length, 0, 'the retained controller action is released after packing');

// A slow rush stops rotating while input is absent, then fires and rotates
// immediately on the next press without an empty motor startup.
const pauseButton = { _judged: false, _info: { rush: true } };
const beforePauseShots = machineShots.length, beforePauseHits = machineHits.length;
machinePress(pauseButton);
const pauseRig = manager.armFor(104);
for (machineFrame = 0; machineFrame < 240; machineFrame++) {
    if (machineFrame === 140) machinePress(pauseButton);
    if (machineFrame === 150) pauseButton._judged = true;
    machineTick();
    if (machineFrame >= 41 && machineFrame < 140) {
        assert.ok(pauseRig.sequenceFrame >= 0 && pauseRig.sequenceFrame <= 2,
            'the motor is idle when no shot is firing');
        assert.equal(machineShots.length, beforePauseShots + 1,
            'an open rush window does not fire without an input');
    }
    if (machineFrame >= 140 && machineFrame < 146) {
        assert.ok(pauseRig.sequenceFrame >= 3 && pauseRig.sequenceFrame <= 5,
            'the next shot resumes rotation immediately');
    }
}
assert.deepEqual(machineShots.slice(beforePauseShots).map(s => s.frame), [35, 140]);
assert.deepEqual(machineHits.slice(beforePauseHits).map(h => h.frame), [41, 146]);
assert.equal(manager.hasArms(), false, 'the motor stops and packs after the rush closes');
assert.equal(yume._actions.length, 0);

// A new rush during retraction reopens the existing rig. Cancellation drops
// unfired inputs without late damage or a stuck action wait.
const priorHitCount = machineHits.length;
const firstReopen = machinePress(null);
const reopenRig = manager.armFor(104);
for (machineFrame = 0; machineFrame < 80; machineFrame++) machineTick();
assert.equal(reopenRig.phase, 'retracting');
const nextRush = { _judged: false, _info: { rush: true } };
machinePress(nextRush);
assert.equal(manager.armFor(104), reopenRig);
for (machineFrame = 80; machineFrame < 200; machineFrame++) {
    if (machineFrame === 130) nextRush._judged = true;
    machineTick();
}
assert.equal(machineHits.length, priorHitCount + 2);
assert.equal(firstReopen.wait, 0);
assert.equal(manager.hasArms(), false);
const beforeCancelHits = machineHits.length;
machinePress(null);
machinePress(null);
const cancelState = manager.armFor(104).machineGunMotion;
yume.clearYumeArms();
assert.ok(cancelState.queue.every(action => action.wait === 0));
for (let i = 0; i < 50; i++) machineTick();
assert.equal(machineHits.length, beforeCancelHits, 'canceled queued inputs cannot damage later');
assert.equal(yume._actions.length, 0);
const machineProbe = { skillId: 104, test: true, wait: 0, applyList: [] };
yume.processExtraActionCommand('yumeArmGatling', [], machineProbe, true);
assert.equal(machineProbe.applyList[40], true);
assert.equal(manager.hasArms(), false);
assert.equal(machineHits.length, beforeCancelHits);
assert.equal(validate('yumeArmMachineGun', []).valid, true);
assert.equal(validate('yumeArmMachineGun', ['']).valid, true);
assert.equal(validate('yumeArmMachineGun', ['0']).valid, true);
assert.equal(validate('yumeArmMachineGun', ['6']).valid, false);
assert.equal(validate('yumeArmGatling', []).valid, true);

// A large machine-gun attack empties exactly one five-round belt with a single
// judged input. It neither requires more presses nor refills during the burst.
const autoBeforeShots = machineShots.length, autoBeforeHits = machineHits.length;
const largeButton = { _judged: true, _info: { rush: false } };
const autoAction = yume.startAction(105, null, 0, largeButton);
autoAction.buttonSprite = largeButton;
yume.processExtraActionCommand('yumeArmMachineGun', [0], autoAction, true);
yume.processExtraActionCommand('yumeArmMachineGun', [0], autoAction, true);
autoAction.list = [];
const autoRig = manager.armFor(105);
assert.equal(autoRig.machineGunMotion.queue.length, 5, 'one input queues one full belt, without duplicates');
assert.equal(autoRig.beltBitmaps.length, 6);
for (let used = 1; used <= 4; used++) for (const bitmap of autoRig.beltBitmaps[used]) {
    assert.deepEqual(bitmap.lastClear, { x: 86, y: 90 - used * 3, width: 16, height: used * 3 });
    assert.ok(bitmap.dirtyCount && bitmap.uploadCount);
}
for (const bitmap of autoRig.beltBitmaps[5])
    assert.deepEqual(bitmap.lastClear, { x: 86, y: 75, width: 10, height: 3 }, 'the last round clears the feed segment');
for (machineFrame = 0; machineFrame < 140; machineFrame++) {
    machineTick();
    if (autoRig.machineGunMotion) {
        assert.equal(autoRig.machineBeltUsed, autoRig.machineGunMotion.fired);
        assert.equal(autoRig.barrelSprite.bitmap, autoRig.beltBitmaps[autoRig.machineBeltUsed][autoRig.sequenceFrame]);
    }
}
assert.equal(machineShots.length - autoBeforeShots, 5);
assert.equal(machineHits.length - autoBeforeHits, 5);
assert.deepEqual(machineShots.slice(autoBeforeShots).map(s => s.beltUsed), [1, 2, 3, 4, 5]);
assert.deepEqual(machineHits.slice(autoBeforeHits).map(h => h.frame), [25, 31, 37, 43, 49]);
assert.ok(machineHits.slice(autoBeforeHits).every(h => h.action === autoAction));
assert.equal(autoRig.machineBeltUsed, 5);
assert.equal(manager.hasArms(), false);
assert.equal(yume._actions.length, 0);
const autoProbe = { skillId: 105, test: true, wait: 0, applyList: [] };
yume.processExtraActionCommand('yumeArmMachineGun', [], autoProbe, true);
assert.deepEqual(Array.from(autoProbe.applyList).map((v, i) => v ? i : -1).filter(i => i >= 0), [24, 30, 36, 42, 48]);
if (previousMachineApply) yume.actionApply = previousMachineApply;
else delete yume.actionApply;
context.SceneManager._scene.playAnimation = previousMachineAnimation;
// A missile follows the live target on held six-frame poses. Contact owns the
// only apply; the lower row explodes while the same launcher packs vertically.
skills[106] = { meta: { animation: 'yumeArmOut:missile,overhead,-36,20,36,wait' } };
const previousMissileBullet = context.SceneManager._scene.newBullet;
const previousMissileApply = yume.actionApply, previousMissileTarget = yume.targetSprite;
let missileTargetOffset = 0, missileDead = false;
const missileTarget = { ...drillEnemy,
    _battler: { isDead: () => missileDead },
    toGlobal(point) { return { x: 640 + missileTargetOffset + point.x * 2, y: 480 + point.y * 2 }; }
};
yume.targetSprite = () => missileTarget;
const missileShots = [], missileDamage = [];
context.SceneManager._scene.newBullet = (...args) => {
    const bullet = new Sprite();
    bullet.x = args[1]; bullet.y = args[2]; bullet._count = 0;
    bullet.bitmap = { width: 432, height: 144, isReady: () => true, addLoadListener(fn) { fn(); } };
    missileShots.push(bullet);
    return bullet;
};
yume.actionApply = action => { missileDamage.push(action); };
const missileAction = yume.startAction(106);
yume.processExtraActionCommand('yumeArmOut', ['missile', 'overhead', -36, 20, 36, 'wait'], missileAction, false);
const launcher = manager.armFor(106), missileIdle = new Set();
assert.equal(launcher.supportPoints, null);
assert.equal(launcher.sequenceBitmaps[0].lastBlit.y, 864);
assert.equal(launcher.barrelSprite.anchor.x * 144, 27);
assert.equal(launcher.barrelSprite.anchor.y * 144, 62);
for (let i = 0; i < 36; i++) { yume.update(); missileIdle.add(launcher.sequenceFrame); }
assert.deepEqual([...missileIdle].sort(), [0, 1, 2]);
yume.processExtraActionCommand('yumeArmMissile', [48, 'apply', 'wait'], missileAction, false);
const guided = missileShots.at(-1), missileStart = { x: guided.x, y: guided.y };
const missilePath = [{ x: guided.x, y: guided.y }], missileSearchHeights = [], detourPhases = new Set();
const smokeCells = new Set(), explosionCells = new Set();
let startedPacking = false, hitTick = null;
for (let tick = 1; tick < 240; tick++) {
    if (tick === 19) missileTargetOffset = 80;
    const before = [guided.x, guided.y, guided.rotation, guided._frame];
    guided.update(); yume.update();
    detourPhases.add(guided._yumeMissileState.detourIndex);
    if (!guided._finish && guided._yumeMissileState.detourIndex < 2) missileSearchHeights.push(guided.y);
    if (!guided._finish && (tick + 1) % 6 === 0) missilePath.push({ x: guided.x, y: guided.y });
    if (!startedPacking) smokeCells.add(launcher.sequenceFrame);
    if (!guided._finish && (tick + 1) % 6) assert.deepEqual(
        [guided.x, guided.y, guided.rotation, guided._frame], before, 'flight holds between pose steps');
    if (tick === 12) assert.ok(guided.y < missileStart.y, 'launch initially rises along the tube');
    if (!missileDamage.length) assert.equal(missileAction.wait, 1, 'wait tracks actual flight');
    if (guided._finish === 1) {
        explosionCells.add(guided._frame.x / 72);
        assert.equal(guided._frame.y, 72);
        assert.equal(guided.rotation, 0);
        if (!startedPacking) {
            startedPacking = true; hitTick = tick;
            assert.equal(missileAction.wait, 0);
            assert.ok(guided.x >= 702 && guided.x <= 718, 'impact follows the moved target');
            launcher.scheduleIn(6, 36);
        }
    }
    if (guided._finish === 2 && hitTick && tick >= hitTick + 42) break;
}
assert.equal(missileDamage.length, 1);
assert.equal(missileDamage[0], missileAction);
assert.deepEqual([...detourPhases].sort(), [0, 1, 2], 'both searching turns finish before the homing approach');
assert.ok(Math.max(...missileSearchHeights) < missileStart.y + 48,
    'searching loops remain high instead of diving toward the enemy feet');
assert.ok(missilePath.every((p, i) => i === 0 || p.x >= missilePath[i - 1].x - 1),
    'the shorter upper detour advances toward the target without a large return loop');
assert.ok([3, 4, 5].every(cell => smokeCells.has(cell)), 'all three smoke cells play before idling');
assert.deepEqual([...explosionCells].sort(), [0, 1, 2, 3, 4, 5]);
assert.equal(guided.visible, false);
assert.equal(launcher.weaponScale, 0.5);
assert.ok(Math.abs(launcher.angle - (-Math.PI / 2 + Math.atan2(19, 83))) < 1e-9);
assert.equal(manager.hasArms(), false);
assert.equal(manager.missileFlights.length, 0);

const shotsBeforeMissileProbe = missileShots.length;
const missileProbe = { skillId: 106, test: true, wait: 0, applyList: [] };
yume.processExtraActionCommand('yumeArmOut', ['missile', 'overhead', -36, 20, 36, 'wait'], missileProbe, false);
yume.processExtraActionCommand('yumeArmMissile', [48, 'apply', 'wait'], missileProbe, false);
assert.equal(missileProbe.applyList.filter(Boolean).length, 1);
assert.equal(missileShots.length, shotsBeforeMissileProbe, 'probes allocate no missiles');
assert.equal(manager.hasArms(), false);

for (const mode of ['cancel', 'escape', 'lost']) {
    const canceled = yume.startAction(106);
    yume.processExtraActionCommand('yumeArmOut', ['missile', 'overhead', -36, 20, 0], canceled, false);
    yume.processExtraActionCommand('yumeArmMissile', [48, 'apply', 'wait'], canceled, false);
    const shot = missileShots.at(-1);
    if (mode === 'cancel') yume.clearYumeArms();
    else if (mode === 'lost') missileDead = true;
    else missileTargetOffset = 1000000;
    for (let tick = 0; tick < 180; tick++) { shot.update(); yume.update(); }
    assert.equal(shot._finish, 2);
    assert.equal(shot.visible, false);
    assert.equal(canceled.wait, 0);
    assert.equal(missileDamage.length, 1, 'canceled or expired missiles never apply late damage');
    yume.clearYumeArms(); missileTargetOffset = 80; missileDead = false;
}
missileDead = true;
const deadTargetAction = yume.startAction(106);
yume.processExtraActionCommand('yumeArmOut', ['missile', 'overhead', -36, 20, 0], deadTargetAction, false);
const beforeDeadLaunch = missileShots.length;
yume.processExtraActionCommand('yumeArmMissile', [48, 'apply', 'wait'], deadTargetAction, false);
assert.equal(missileShots.length, beforeDeadLaunch);
assert.equal(deadTargetAction.wait, 0);
yume.clearYumeArms();
// A transparent corner inside the enemy bounds must not trigger impact. Check
// the mask using both the battle-container and target transforms.
missileDead = false;
const missilePixels = new Uint8ClampedArray(144 * 144 * 4);
for (let y = 0; y < 144; y++) for (let x = 0; x < 144; x++) {
    if (Math.hypot(x - 72, y - 72) <= 24) missilePixels[(y * 144 + x) * 4 + 3] = 255;
}
missileTarget.bitmap = { isReady: () => true, _context: { getImageData: () => ({ data: missilePixels }) } };
missileTarget._frame = { x: 0, y: 0, width: 144, height: 144 };
missileTarget.toLocal = point => ({ x: (point.x - 640 - missileTargetOffset) / 2, y: (point.y - 480) / 2 });
context.SceneManager._scene._battleContainer.toGlobal = point => ({ x: point.x + 10, y: point.y + 20 });
const maskedTarget = manager.missileTargetInfo();
assert.equal(maskedTarget.pixelContact({ x: maskedTarget.bounds.left + 1, y: maskedTarget.bounds.top + 1 }), false);
assert.equal(maskedTarget.pixelContact({ x: maskedTarget.x, y: maskedTarget.y }), true);
delete context.SceneManager._scene._battleContainer.toGlobal;
delete missileTarget.bitmap; delete missileTarget._frame; delete missileTarget.toLocal;
assert.equal(validate('yumeArmMissile', ['48', 'apply', 'wait']).valid, true);
for (const duration of ['0', '18', '25', '126']) assert.equal(validate('yumeArmMissile', [duration]).valid, false);
context.SceneManager._scene.newBullet = previousMissileBullet;
yume.targetSprite = previousMissileTarget;
if (previousMissileApply) yume.actionApply = previousMissileApply;
else delete yume.actionApply;
// Audio overrides are local to Yume and never mutate shared animations.
const damageSource = { timings: [{ frame: 0,
    se: { name: 'Blow1', volume: 90, pitch: 100, pan: 0 } }] };
manager.ensureArm(46, 'gun1');
const quieterDamage = context.KNH_ZXC_Battle_Yume.damageAnimation(yume, { id: 46 }, damageSource);
assert.equal(quieterDamage.timings[0].se.volume, 14);
assert.equal(quieterDamage.timings[0].se.pitch, 112);
assert.equal(damageSource.timings[0].se.volume, 90);
const nonYume = new ActorSprite();
nonYume._battler.actorId = () => 3;
assert.equal(context.KNH_ZXC_Battle_Yume.damageAnimation(nonYume, { id: 46 }, damageSource), damageSource);
const shellRig = manager.ensureArm(4801, 'cannon');
const beforeShellBullet = context.SceneManager._scene.newBullet;
const shellPixels = new Uint8ClampedArray(60 * 10 * 4);
const shellLeft = [2, 3, 1, 2, 3, 1], shellTop = [4, 4, 5, 4, 4, 5];
for (let cell = 0; cell < 6; cell++)
    for (let y = shellTop[cell]; y < shellTop[cell] + 4; y++)
        for (let x = shellLeft[cell]; x < shellLeft[cell] + 4; x++)
            shellPixels[(y * 60 + cell * 10 + x) * 4 + 3] = 255;
context.SceneManager._scene.newBullet = () => {
    const sprite = new Sprite({ width: 60, height: 20, isReady: () => true,
        addLoadListener(listener) { listener(); },
        _context: { getImageData: () => ({ data: shellPixels }) } });
    sprite.ticks = 0; sprite.x = 0; sprite._frames = 6; sprite._frameCount = 6;
    sprite.setFrame(0, 0, 10, 10);
    sprite.update = function() {
        this.setFrame(Math.floor(this.ticks / 6) % 6 * 10, this._finish ? 10 : 0, 10, 10);
        this.x = this.ticks;
        if (++this.ticks === 36) this._finish = 1;
    };
    return sprite;
};
const beforeShellImpacts = playedSe.filter(b => b.se.name === 'Explosion1' && b.se.pitch === 88).length;
const shell = manager.fireBullet(shellRig, 'artilleryShell', 36);
assert.equal(shell._yumePoseAge, undefined);
assert.equal(shell._frameCount, 6, 'the original six-frame cell rate is restored');
assert.equal(shell.anchor.x, 0.4, 'launch uses the visible ball center, not transparent padding');
assert.equal(shell.anchor.y, 0.6);
for (let age = 1; age < 36; age++) {
    shell.update();
    assert.equal(shell.x, age - 1, 'cannon movement updates each frame again');
    const cell = Math.floor((age - 1) / 6) % 6;
    assert.equal(shell.anchor.x, (shellLeft[cell] + 2) / 10);
    assert.equal(shell.anchor.y, (shellTop[cell] + 2) / 10);
    assert.equal(playedSe.filter(b => b.se.name === 'Explosion1' && b.se.pitch === 88).length, beforeShellImpacts);
}
shell.update();
assert.equal(shell.x, 35, 'the shell retains its thirty-six-tick flight');
assert.equal(shell.anchor.x, 0.5, 'impact restores the explosion sheet center');
assert.equal(shell.anchor.y, 0.5);
assert.equal(playedSe.filter(b => b.se.name === 'Explosion1' && b.se.pitch === 88).length, beforeShellImpacts + 1);
shell.update(); shell.update();
assert.equal(playedSe.filter(b => b.se.name === 'Explosion1' && b.se.pitch === 88).length, beforeShellImpacts + 1,
    'the cannon impact sound occurs once on arrival');
context.SceneManager._scene.newBullet = beforeShellBullet;
manager.clear();
console.log('Yume battle arm tests passed');
