// Real-engine checks and GIF capture against an isolated NW.js game.
// node js/plugins/tests/KNH_ZXC_RocketLaunch.test.js [debug-port] [artifact-directory]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

async function connect(port) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(t => /\/index\.html(?:\?|$)/.test(t.url));
    assert.ok(target, 'an isolated game must be running with remote debugging');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let serial = 0;
    const pending = new Map();
    socket.onmessage = event => {
        const response = JSON.parse(event.data);
        const request = pending.get(response.id);
        if (!request) return;
        pending.delete(response.id);
        clearTimeout(request.timer);
        if (response.error) request.reject(new Error(JSON.stringify(response.error)));
        else request.resolve(response.result);
    };
    return {
        async evaluate(fn, ...args) {
            const id = ++serial;
            const result = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error('game evaluation timed out'));
                }, 60000);
                pending.set(id, { resolve, reject, timer });
                socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: {
                    expression: `(${fn.toString()})(${args.map(a => JSON.stringify(a)).join(',')})`,
                    awaitPromise: true, returnByValue: true
                } }));
            });
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
        },
        close() { socket.close(); }
    };
}

async function setupScene() {
    function wait() { return new Promise(function(resolve) { setTimeout(resolve, 16); }); }
    async function until(predicate) {
        for (var i = 0; i < 900; i++) {
            if (predicate()) return;
            await wait();
        }
        throw new Error('map assets did not become ready');
    }
    SceneManager.stop();
    await wait();
    await wait();
    if (SceneManager._scene) SceneManager._scene.terminate();
    DataManager.setupNewGame();
    $gameParty.addActor(2);
    $gameParty.addActor(3);
    $gamePlayer.reserveTransfer(55, 6, 15, 8, 2);
    var scene = new Scene_Map();
    SceneManager._scene = scene;
    SceneManager._nextScene = null;
    scene.create();
    await until(function() { return scene.isReady(); });
    SceneManager._sceneStarted = true;
    $gameSwitches.setValue(1, false);
    $gameScreen.setZoom(0, 0, 1);
    $gameMap.setDisplayPos(0, 4.5);
    ImageManager.loadCharacter('rocketSmog');
    ImageManager.loadCharacter('rocketSmog2');
    for (var i = 0; i < 20; i++) {
        $gameMap.updateEvents();
        scene._spriteset.update();
        await wait();
    }
    await until(function() { return ImageManager.isReady(); });
    scene._spriteset.update();
    Graphics._renderer.render(scene);
    window._rocketTestScene = scene;
    return { mapId: $gameMap.mapId(), webgl: Graphics.isWebGL(), pixi: PIXI.VERSION };
}

function engineChecks() {
    var scene = window._rocketTestScene;
    scene._simMode = true;
    scene._simCount = 0;
    var results = [];
    function check(value, message) {
        if (!value) throw new Error(message);
        results.push(message);
    }
    function near(a, b) { return Math.abs(a - b) < 0.01; }
    function tick(owner, frames) {
        for (var i = 0; i < frames; i++) {
            scene._simCount++;
            owner.update();
            scene._spriteset.update();
        }
    }
    var target = $gameMap.event(4);
    var source = target.sprite();
    var originalAngle = target.angle();
    target.setAngle(11);
    source.update();
    var baseRotation = source.rotation;
    var before = JSON.stringify([target._characterName, target._cssRect, target._scaleX,
        target._scaleY, target._through, target._priorityType, target._opacity, target._transparent, target.angle()]);
    check(target.characterName() === 'characters3', 'the real corridor example uses characters3');
    check(source._meshSprite && source._meshSprite.visible, 'the body uses the real yurayura mesh');
    var x = target.x, y = target.y;
    check(target.startRocketLaunch({ shakeFrames: 12, flightFrames: 30, height: 360,
        frameWait: 3, footOffsetY: -8 }), 'a regular map event can launch');
    check(!target.startRocketLaunch(), 'duplicate starts do not restart an active launch');
    tick(target, 4);
    var firstShake = target._rocketLaunch.shakeX;
    check(near(source.x - target.screenX(), firstShake) && near(source.y, target.screenY()),
        'only the body vibrates before lift-off');
    var firstTilt = source.rotation - baseRotation;
    check(Math.abs(firstShake) < 1 && Math.abs(firstTilt) < Math.PI / 180,
        'preparation starts with a small random tilt and vibration');
    source.update();
    check(near(source.rotation, baseRotation + firstTilt), 'repeated sprite updates do not accumulate tilt');
    check(target.x === x && target.y === y && !target.isThrough(), 'preparation preserves logical position and collision');
    tick(target, 1);
    check(near(source.rotation, baseRotation + firstTilt) && near(target._rocketLaunch.shakeX, firstShake),
        'the initial slow vibration holds its random pose between shake ticks');
    tick(target, 22);
    var state = target._rocketLaunch;
    var smoke = source._rocketSmoke;
    check(smoke && smoke._yuraFilterZXC && smoke._segments.length > 0,
        'smoke is rendered by shared-image segments under one yurayura filter');
    check(smoke._segments.every(function(s) { return !s._meshSprite; }), 'individual smoke segments do not allocate yurayura meshes');
    check(smoke._segments.every(function(s) { return smoke.getChildIndex(s) > smoke.getChildIndex(smoke._puff); }),
        'the entire smoke-two trail draws in front of smoke one');
    check(source._meshSprite.visible && source._baseBitmap, 'launching preserves the visible body mesh and its source bitmap');
    check(near(source.x - target.screenX(), state.shakeX) && Math.abs(state.shakeX) >= 1.8 &&
        near(source.rotation, baseRotation + state.shakeRotation) && Math.abs(state.shakeRotation) <= Math.PI / 40,
        'stronger horizontal vibration and random tilt continue after lift-off');
    check(near(smoke.y - state.height, source.y - 8), 'the growing smoke meets the configured foot position');
    check(smoke._segments[0]._frame.height > 0 && smoke._segments[0]._frame.height < 96,
        'the growing tip is cropped smoothly between complete tiles');
    check(target.x === x && target.y === y && target.isThrough(), 'flight changes display height and releases ground collision');
    var oldGroundY = smoke.y, oldBodyY = source.y;
    $gameMap.setDisplayPos(0, 6.5);
    scene._spriteset.update();
    check(near(smoke.y, oldGroundY - 96) && near(source.y, oldBodyY - 96), 'body and launch point follow camera scrolling together');
    $gameMap.setDisplayPos(0, 4.5);
    scene._spriteset.update();
    Graphics._renderer.render(scene);
    var pixels = Graphics._renderer.extract.pixels(smoke);
    check(pixels.some(function(v, i) { return i % 4 === 3 && v > 0; }), 'the smoke produces actual WebGL pixels');
    var restored = JsonEx.parse(JsonEx.stringify(target));
    var savedFrame = restored._rocketLaunch.frame;
    restored.updateRocketLaunch();
    check(restored instanceof Game_Event && restored._rocketLaunch.frame === savedFrame + 1 &&
        restored._rocketLaunch.height > state.height, 'saved character state resumes its flight without serialized rendering objects');
    tick(target, 15);
    check(!source.visible && smoke._segments.length === 4, 'the body leaves while the complete trail stays alive');
    tick(target, 14);
    check(smoke._segments[0]._frame.y === 96 && smoke._segments[1]._frame.y === 0 &&
        smoke._segments[2]._frame.y === 0, 'only the ground segment starts fading while all higher segments keep looping');
    tick(target, 1);
    check(smoke._segments[0].visible && smoke._segments[0]._frame.x === 96 &&
        smoke._segments[1]._frame.y === 96 && smoke._segments[2]._frame.y === 0,
        'the next fade starts one cell before the previous segment becomes transparent');
    tick(target, 3);
    check(!smoke._segments[0].visible && smoke._segments[1]._frame.y === 96 &&
        smoke._segments[2]._frame.y === 96, 'the fade chain advances while retaining both visible fade cells');
    tick(target, 35);
    check(!target.isRocketLaunching() && !source._rocketSmoke && !source.visible,
        'completion removes all smoke while leaving the launched character hidden');
    check(ImageManager.loadCharacter('rocketSmog2')._baseTexture.source,
        'completion preserves shared image textures');
    target.clearRocketLaunch();
    source.update();
    check(source.visible && near(source.y, target.screenY()) && !target.isThrough(), 'clear restores display position, visibility and collision');
    check(near(source.rotation, baseRotation), 'clear restores the original nonzero character angle');
    check(before === JSON.stringify([target._characterName, target._cssRect, target._scaleX,
        target._scaleY, target._through, target._priorityType, target._opacity, target._transparent, target.angle()]),
        'launch and clear preserve the original image, crop, scale and character settings');
    target.setAngle(originalAngle);
    source.update();
    target.startRocketLaunch();
    var shakes = [], previousShakeFrame = 0;
    for (var frame = 1; frame <= 60; frame++) {
        tick(target, 1);
        var shakeState = target._rocketLaunch;
        if (shakeState.shakeNextFrame !== previousShakeFrame) {
            shakes.push({ frame: frame, wait: shakeState.shakeNextFrame - frame,
                x: shakeState.shakeX, rotation: shakeState.shakeRotation });
            previousShakeFrame = shakeState.shakeNextFrame;
        }
    }
    var first = shakes[0], last = shakes[shakes.length - 1];
    check(first.wait === 5 && last.wait === 2 && shakes.every(function(s, i) {
        return !i || s.wait <= shakes[i - 1].wait;
    }), 'vibration progressively accelerates from five-frame to two-frame intervals');
    check(Math.abs(first.x) < 0.5 && Math.abs(last.x) >= 1.8 && Math.abs(last.x) <= 3,
        'the vibration envelope grows from subpixel movement to full launch strength');
    var flightAngles = shakes.filter(function(s) { return s.frame >= 48; });
    check(flightAngles.length > 3 && flightAngles.every(function(s) { return Math.abs(s.rotation) <= Math.PI / 40; }) &&
        new Set(flightAngles.map(function(s) { return s.rotation; })).size > 3,
        'flight samples fresh random angles instead of alternating fixed tilts');
    target.clearRocketLaunch();
    source.update();
    scene._simCount = 1003;
    target.startRocketLaunch({ shakeFrames: 0, flightFrames: 200, height: 360 });
    tick(target, 6);
    var syncedSmoke = source._rocketSmoke;
    var initialAnimationFrame = target._rocketLaunch.animationFrame;
    check(target._rocketLaunch.animationStep === 100 && source._meshSprite._lastMeshStep === 100 &&
        syncedSmoke._yuraFilterZXC.uniforms.stepCount === 100 && initialAnimationFrame === 1,
        'an off-beat launch holds its smoke cells on the same clock step as the body mesh and filter');
    tick(target, 11);
    check(syncedSmoke._puff._frame.x === 222 && syncedSmoke._segments[0]._frame.x === 96 &&
        source._meshSprite._lastMeshStep === 102 && syncedSmoke._yuraFilterZXC.uniforms.stepCount === 102,
        'both smoke sheets switch cells on the shared yurayura boundary');
    tick(target, 9);
    check(syncedSmoke._puff._frame.x === 222 && syncedSmoke._segments[0]._frame.x === 96 &&
        target._rocketLaunch.animationFrame === 17,
        'smoke cells do not advance between shared clock boundaries');
    tick(target, 1);
    check(syncedSmoke._puff._frame.x === 444 && syncedSmoke._segments[0]._frame.x === 192 &&
        source._meshSprite._lastMeshStep === 103 && syncedSmoke._yuraFilterZXC.uniforms.stepCount === 103,
        'puff, trail and both yurayura paths advance together on the next boundary');
    $gameSwitches.setValue(1, true);
    tick(target, 10);
    check(target._rocketLaunch.animationFrame === 27 && syncedSmoke._puff._frame.x === 444 &&
        syncedSmoke._yuraFilterZXC.uniforms.stepCount === 103 && source._meshSprite._lastMeshStep === 103,
        'the yurayura stop switch freezes both smoke animations and distortion together');
    $gameSwitches.setValue(1, false);
    tick(target, 1);
    check(target._rocketLaunch.animationStep === 104 && syncedSmoke._yuraFilterZXC.uniforms.stepCount === 104 &&
        source._meshSprite._lastMeshStep === 104, 'resume rejoins the same shared clock step');
    target.clearRocketLaunch();
    target.startRocketLaunch();
    check(target._rocketLaunch.fadeStart >= target._rocketLaunch.puffStart + target._rocketLaunch.options.frameWait * 15,
        'the trail waits until the background puff has disappeared before starting any fade');
    tick(target, 2);
    var cancelled = source._rocketSmoke;
    target.clearRocketLaunch();
    check(cancelled._rocketDisposed && !source._rocketSmoke, 'mid-flight cancellation immediately releases its scene sprites');
    var important = target._important;
    target._important = false;
    target.locate(200, 200);
    target.startRocketLaunch();
    check(!target.needNotUpdate() && $gameMap.events().indexOf(target) >= 0,
        'active launches continue even outside the optimized nearby-event collection');
    var previousFrame = target._rocketLaunch.frame;
    $gameMap.updateEvents();
    check(target._rocketLaunch.frame > previousFrame, 'the map really updates an offscreen launching event');
    scene._spriteset.update();
    var offscreenSmoke = source._rocketSmoke;
    while (target.isRocketLaunching()) {
        scene._simCount++;
        target.update();
    }
    $gameMap.rejudgeEvents();
    check(offscreenSmoke._rocketDisposed && !source._rocketSmoke,
        'offscreen completion releases smoke before the owner can be culled');
    target.clearRocketLaunch();
    target.locate(x, y);
    target._important = important;
    $gameMap.rejudgeEvents();

    var follower = $gamePlayer.followers().follower(1);
    var interpreter = new Game_Interpreter();
    check(follower.actor() && interpreter.command_startRocketLaunch(-1,
        { shakeFrames: 0, flightFrames: 20, height: 160 }, true) &&
        follower.startRocketLaunch({ shakeFrames: 6, flightFrames: 24, height: 200 }),
        'the same feature launches the player and a spacer-aware visible follower concurrently');
    check(!$gamePlayer.canMove() && interpreter.updateWaitMode(), 'player movement locks and the interpreter can wait for the whole effect');
    var followerX = follower.x, followerY = follower.y;
    follower.chaseCharacter($gamePlayer);
    check(follower.x === followerX && follower.y === followerY, 'a launched follower does not chase the follow chain');
    for (var f = 0; f < 10; f++) {
        scene._simCount++;
        $gamePlayer.updateRocketLaunch();
        follower.updateRocketLaunch();
        scene._spriteset.update();
    }
    check($gamePlayer.sprite()._rocketSmoke && follower.sprite()._rocketSmoke &&
        $gamePlayer.sprite()._rocketSmoke !== follower.sprite()._rocketSmoke,
        'different character graphics own independent visible smoke effects');
    $gamePlayer.reserveTransfer(55, 6, 15, 8, 2);
    $gamePlayer.performTransfer();
    scene._spriteset.update();
    check(!$gamePlayer._rocketLaunch && !follower._rocketLaunch && !interpreter.updateWaitMode(),
        'transfer restores player/followers and releases an outstanding wait');

    var erasedTarget = $gameMap.event(2);
    erasedTarget.startRocketLaunch();
    tick(erasedTarget, 2);
    var erasedSmoke = erasedTarget.sprite()._rocketSmoke;
    erasedTarget.erase();
    check(!erasedTarget._rocketLaunch && erasedSmoke._rocketDisposed,
        'erasing an event immediately cancels its effect');
    target.startRocketLaunch({ shakeFrames: 0 });
    tick(target, 3);
    var owned = source._rocketSmoke;
    var disposable = new PIXI.Container();
    disposable.addChild(source);
    disposable.addChild(owned);
    disposable.destroy({ children: true, texture: false, baseTexture: false });
    check(owned._rocketDisposed && !source._rocketSmoke, 'scene-style container destruction disposes smoke safely without double destruction');
    return { passed: results.length, checks: results };
}

function prepareCapture() {
    var scene = window._rocketTestScene;
    $gameMap.events(true).forEach(function(event) {
        if (event.eventId() !== 4) event.sprite().visible = false;
    });
    // Keep this recording focused on the actual effect, using the real map/renderer.
    $gamePlayer.setTransparent(true);
    $gamePlayer.followers().forEach(function(follower) { follower.setTransparent(true); });
    var target = $gameMap.event(4);
    target.clearRocketLaunch();
    target.sprite().update();
    $gameMap.setDisplayPos(0, 4.5);
    scene._spriteset.update();
    Graphics._renderer.render(scene);
    window._rocketCaptureFrame = 0;
    scene._simMode = true;
    scene._simCount = 0;
}

function captureFrame() {
    var scene = window._rocketTestScene;
    var target = $gameMap.event(4);
    var first = window._rocketCaptureFrame;
    for (var sub = 0; sub < 3; sub++) {
        $gameMap.refreshIfNeeded();
        scene._simCount++;
        if (window._rocketCaptureFrame === 30) {
            // Execute the saved event commands, including their wait and self switch.
            $gameMap._interpreter.setup(target.list(), target.eventId());
        }
        $gameMap._interpreter.update();
        target.update();
        Graphics.frameCount++;
        scene._spriteset.update();
        $gameMap.events(true).forEach(function(event) {
            if (event.eventId() !== 4) event.sprite().visible = false;
        });
        window._rocketCaptureFrame++;
    }
    Graphics._renderer.render(scene);
    return { frame: first, image: Graphics._renderer.extract.canvas().toDataURL('image/png') };
}

(async () => {
    const client = await connect(Number(process.argv[2]) || 9338);
    try {
        console.log(JSON.stringify(await client.evaluate(setupScene)));
        const result = await client.evaluate(engineChecks);
        console.log(JSON.stringify(result, null, 2));
        if (process.argv[3]) {
            const directory = path.resolve(process.argv[3]);
            const frames = path.join(directory, 'frames');
            await fs.mkdir(frames, { recursive: true });
            await fs.writeFile(path.join(directory, 'checks.json'), JSON.stringify(result, null, 2) + '\n');
            await client.evaluate(setupScene);
            await client.evaluate(prepareCapture);
            let frameCount = 100;
            for (let i = 0; i < frameCount; i++) {
                const frame = await client.evaluate(captureFrame);
                await fs.writeFile(path.join(frames, String(i).padStart(4, '0') + '.png'),
                    Buffer.from(frame.image.split(',')[1], 'base64'));
                if (i === 10) {
                    const endFrame = await client.evaluate(function() { return $gameMap.event(4)._rocketLaunch.endFrame; });
                    frameCount = Math.max(frameCount, Math.ceil((30 + endFrame + 30) / 3));
                }
                if (i % 20 === 0) console.log('Captured frame ' + i + '/' + frameCount);
            }
            const completed = await client.evaluate(function() {
                return $gameSelfSwitches.value([55, 4, 'A']) && $gameMap.event(4)._pageIndex === 1 &&
                    !$gameMap.event(4).isRocketLaunching() && !$gameMap.event(4).sprite()._rocketSmoke;
            });
            assert.ok(completed, 'the saved example event finishes its wait, switches pages and clears smoke');
            const ffmpeg = require('../../../tools/bgm_video_maker/node_modules/ffmpeg-static');
            const output = path.join(directory, 'rocket-launch.gif');
            const encoded = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', '20',
                '-i', path.join(frames, '%04d.png'), '-filter_complex',
                '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
                '-loop', '0', output], { encoding: 'utf8', windowsHide: true });
            assert.equal(encoded.status, 0, encoded.stderr);
            console.log('GIF: ' + output);
        }
    } finally { client.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
