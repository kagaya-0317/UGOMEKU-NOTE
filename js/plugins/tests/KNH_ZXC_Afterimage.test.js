// Real-engine integration test. Run against a separate NW.js game launched with
// --remote-debugging-port=9337. This changes only that process's in-memory state.
// node js/plugins/tests/KNH_ZXC_Afterimage.test.js [port] [screenshot-directory]
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function connect(port) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(t => /\/index\.html(?:\?|$)/.test(t.url));
    assert.ok(target, 'the game must be running in a separate debugging instance');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
    });
    let serial = 0;
    const pending = new Map();
    socket.onmessage = event => {
        const result = JSON.parse(event.data);
        const request = pending.get(result.id);
        if (!request) return;
        pending.delete(result.id);
        clearTimeout(request.timer);
        if (result.error) request.reject(new Error(JSON.stringify(result.error)));
        else request.resolve(result.result);
    };
    return {
        async evaluate(fn, ...args) {
            const id = ++serial;
            const result = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error('game evaluation timed out'));
                }, 30000);
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

async function engineChecks() {
    var results = [];
    function check(value, message) {
        if (!value) throw new Error(message);
        results.push(message);
    }
    function near(a, b) { return Math.abs(a - b) < 0.001; }
    function wait() { return new Promise(function(resolve) { setTimeout(resolve, 16); }); }
    async function until(predicate) {
        for (var i = 0; i < 900; i++) {
            if (predicate()) return;
            await wait();
        }
        throw new Error('assets or scene did not become ready');
    }
    function pixels(texture) { return Graphics._renderer.extract.pixels(texture); }
    function samePixels(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
    }
    function hasPixels(data) {
        for (var i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
        return false;
    }
    function visiblePixels(data) {
        var count = 0;
        for (var i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
        return count;
    }
    function renderedPixels(sprite) {
        var texture = PIXI.RenderTexture.create(256, 256);
        var matrix = new PIXI.Matrix();
        matrix.tx = 128 - sprite.x;
        matrix.ty = 192 - sprite.y;
        Graphics._renderer.render(sprite, texture, true, matrix);
        var data = pixels(texture);
        texture.destroy(true);
        sprite.getBounds();
        return data;
    }

    SceneManager.stop();
    await wait();
    await wait();
    if (SceneManager._scene) SceneManager._scene.terminate();
    DataManager.setupNewGame();
    $gamePlayer.reserveTransfer(36, 20, 16, 6, 2);
    var scene = new Scene_Map();
    SceneManager._scene = scene;
    SceneManager._nextScene = null;
    scene.create();
    await until(function() { return scene.isReady(); });
    SceneManager._sceneStarted = true;
    $gameSwitches.setValue(1, false);
    $gamePlayer.setImage('$001', 0);
    $gamePlayer.setWalkAnime(false);
    $gamePlayer.setStepAnime(false);
    $gamePlayer._noYura = true;
    $gamePlayer.setDirection(6);
    var source = $gamePlayer.sprite();
    source._yuraInfo = [20, 15, 10, false];
    source.update();
    await until(function() { return source.bitmap && source.bitmap.isReady(); });
    source.update();
    source.update();
    scene._spriteset.update();
    Graphics._renderer.render(scene);
    check(!!source._meshSprite && source._meshSprite.visible, 'test uses the real visible yurayura mesh');

    var hatch = KNH_Afterimage.HatchMask;
    await until(function() { return hatch.ready(); });
    for (var stage = 0; stage < 9; stage++) hatch.bitmap(stage);
    check(hatch.bitmaps.length === 9 && hatch.bitmaps.every(function(b) { return !b._dirty; }),
        'all nine shared hatch masks are uploaded before being used as non-renderable masks');
    check(source._getMaskFadeBitmap(2) === hatch.bitmap(2), 'character fade and afterimages share the same mask bitmap cache');
    $gamePlayer.startMaskFadeOut(21);
    source.update();
    check(source.mask === source._maskFadeSprite && source._maskFadeSprite.bitmap === hatch.bitmap(0),
        'existing character fade still applies its first shared mask');
    for (var f = 0; f < 22; f++) source.update();
    check($gamePlayer.isMaskFadeHidden() && !source.visible, 'existing character mask fade still reaches fully hidden');
    $gamePlayer.startMaskFadeIn(21);
    for (var f = 0; f < 22; f++) source.update();
    check(!$gamePlayer.isMaskFadeHidden() && source.visible && !source.mask,
        'existing character mask fade in still restores its unmasked body');
    $gamePlayer.clearMaskFade();
    source.update();

    $gamePlayer.startAfterimage({ interval: 1, life: 12, maxCount: 4, opacity: 32 });
    source.update();
    var manager = scene._knhAfterimageManager;
    function tick(dx, dy) {
        $gamePlayer._realX += dx || 0;
        $gamePlayer._realY += dy || 0;
        source.update();
        manager.update();
    }
    tick();
    check(manager.trails.length === 0, 'stationary yurayura does not emit');
    tick(0.25);
    check(manager.trails.length === 1, 'moving map character emits one image');
    var trail = manager.trails[0];
    var frozen = pixels(trail.texture);
    check(hasPixels(frozen), 'afterimage RenderTexture contains actual rendered pixels');
    check(trail.sprite.alpha === 1 && trail.stage === 2, 'afterimages start fully opaque with hatching, ignoring old opacity options');
    check(trail.sprite.mask && trail.sprite.mask.bitmap === hatch.bitmap(2) && !trail.sprite.mask.renderable,
        'afterimages use the shared diagonal bitmap as a non-renderable mask');
    var birthPixels = renderedPixels(trail.sprite);
    var birthMask = trail.sprite.mask;
    trail.sprite.mask = null;
    birthMask.renderable = false;
    var unmaskedPixels = renderedPixels(trail.sprite);
    trail.sprite.mask = birthMask;
    check(visiblePixels(birthPixels) > 0 && visiblePixels(birthPixels) < visiblePixels(unmaskedPixels),
        'the first rendered afterimage already has actual pixels cut out by the hatching');
    var intactAlpha = true;
    for (var p = 3; p < birthPixels.length; p += 4) {
        if (birthPixels[p] && birthPixels[p] !== unmaskedPixels[p]) intactAlpha = false;
    }
    check(intactAlpha, 'surviving pixels retain their original alpha instead of becoming translucent');
    check(trail.sprite.parent === source.parent, 'afterimage shares the map depth parent');
    check(trail.sprite.z === source.z && trail.sprite.spriteId < source.spriteId,
        'depth priority is preserved and equal-position images sort behind the body');
    var expected = manager.capture(source);
    check(samePixels(frozen, pixels(expected.texture)), 'snapshot matches the current rendered mesh exactly');
    manager.returnTexture(expected.texture);

    var direct = PIXI.RenderTexture.create(Graphics.width, Graphics.height);
    var ghost = PIXI.RenderTexture.create(Graphics.width, Graphics.height);
    var originalMask = trail.sprite.mask;
    trail.sprite.mask = null;
    originalMask.renderable = false;
    Graphics._renderer.render(source, direct, true);
    Graphics._renderer.render(trail.sprite, ghost, true);
    check(samePixels(pixels(direct), pixels(ghost)), 'rendered afterimage aligns pixel-for-pixel with the actual live character');
    trail.sprite.mask = originalMask;
    direct.destroy(true);
    ghost.destroy(true);
    source.getBounds();

    for (var v = 0; v < source._meshSprite.vertices.length; v += 2) source._meshSprite.vertices[v] += 9;
    source._meshSprite.dirty++;
    source._meshSprite.vertexDirty++;
    var changed = manager.capture(source);
    check(!samePixels(frozen, pixels(changed.texture)), 'changing the live mesh really changes its rendered pose');
    check(samePixels(frozen, pixels(trail.texture)), 'old afterimage pixels remain frozen when the live mesh changes');
    manager.returnTexture(changed.texture);

    var oldX = trail.sprite.x, oldY = trail.sprite.y;
    var count = manager.trails.length;
    $gameMap._displayX += 2;
    $gameMap._displayY += 1;
    tick();
    check(near(trail.sprite.x, oldX - 96) && near(trail.sprite.y, oldY - 48), 'map scrolling repositions old images by the camera delta');
    check(manager.trails.length === count, 'camera scrolling alone does not emit images');

    var particle = source._particle = new Sprite(new Bitmap(16, 16));
    particle.bitmap.fillAll('#ff0000');
    particle.x = 1000;
    source.addChild(particle);
    source.scale.set(-1.4, 1.2);
    source.rotation = 0.23;
    source.pivot.set(3, 4);
    source.alpha = 0.6;
    source.setOutline(1, 2);
    source.getBounds();
    var originalTransform = source.transform;
    var originalWorld = source.worldTransform.clone();
    var originalParent = source.parent;
    var filterArea = source.filterArea = new PIXI.Rectangle(10, 20, 30, 40);
    var transformed = manager.capture(source);
    check(transformed.texture.width < 512 && particle.visible, 'particle is excluded from capture bounds and restored afterward');
    check(source.transform === originalTransform && source.parent === originalParent && source.alpha === 0.6,
        'capture restores the live source transform, parent and opacity');
    check(source.filterArea === filterArea && near(source.worldTransform.a, originalWorld.a) && near(source.worldTransform.tx, originalWorld.tx),
        'capture restores filter area and world placement');
    check(hasPixels(pixels(transformed.texture)), 'filtered mirrored and rotated character captures successfully');
    manager.returnTexture(transformed.texture);
    manager.emit(manager.entries.get(source), $gamePlayer._knhAfterimage, manager.position(manager.entries.get(source)));
    var transformedTrail = manager.trails[manager.trails.length - 1];
    check(near(transformedTrail.sprite.scale.x, -1.4) && near(transformedTrail.sprite.rotation, 0.23) &&
        transformedTrail.sprite.mask.parent === transformedTrail.sprite && hasPixels(renderedPixels(transformedTrail.sprite)),
        'diagonal masking also renders on mirrored rotated and outlined afterimages');

    var render = Graphics._renderer.render;
    Graphics._renderer.render = function(object) {
        if (object === source) throw new Error('intentional capture failure');
        return render.apply(this, arguments);
    };
    var failed = false;
    try { manager.capture(source); } catch (e) { failed = true; }
    Graphics._renderer.render = render;
    check(failed && source.transform === originalTransform && source.parent === originalParent && particle.visible && source.filterArea === filterArea,
        'render failure also restores all temporary source changes');
    source.filterArea = null;
    source.filters = null;
    source.removeChild(particle);
    particle.destroy({ texture: false, baseTexture: false });
    source._particle = null;
    source.pivot.set(0, 0);
    source.rotation = 0;
    source.scale.set(1, 1);
    source.alpha = 1;

    var mask = new Sprite(new Bitmap(144, 144));
    mask.bitmap.fillRect(0, 0, 72, 144, '#ffffff');
    mask.x = -72;
    mask.y = -144;
    source.addChild(mask);
    source.mask = mask;
    mask.renderable = false;
    var masked = manager.capture(source);
    var maskedPixels = pixels(masked.texture);
    check(hasPixels(maskedPixels) && !mask.bitmap._dirty, 'non-renderable bitmap mask is uploaded during capture');
    mask.bitmap.clear();
    var emptyMask = manager.capture(source);
    check(!hasPixels(pixels(emptyMask.texture)), 'updated non-renderable mask changes the captured image');
    manager.returnTexture(masked.texture);
    manager.returnTexture(emptyMask.texture);
    source.mask = null;
    source.removeChild(mask);
    mask.destroy({ texture: false, baseTexture: false });

    source._yuraInfo = null;
    source.update();
    source.update();
    var normal = manager.capture(source);
    check(hasPixels(pixels(normal.texture)) && !source._meshSprite.visible, 'normal non-mesh character graphics also capture');
    manager.returnTexture(normal.texture);
    $gamePlayer._bushDepth = 24;
    source.update();
    source.update();
    var bush = manager.capture(source);
    check(source._frame.width === 0 && source._upperBody.visible && hasPixels(pixels(bush.texture)),
        'split upper/lower body sprites capture even when the base frame is empty');
    manager.returnTexture(bush.texture);
    $gamePlayer._bushDepth = 0;
    source.update();
    source.update();
    source._yuraInfo = [20, 15, 10, false];
    source.update();
    source.update();

    $gamePlayer.clearAfterimages();
    check(manager.trails.length === 0, 'clear removes existing images immediately');
    check(manager.spritePool.every(function(s) { return !s.mask && !s._knhAfterimageMask.visible; }),
        'pooled sprites release their active mask without destroying shared bitmaps');
    $gamePlayer.startAfterimage({ interval: 1, life: 30, maxCount: 2 });
    tick();
    tick(0.1);
    tick(0.1);
    var reusedSprites = manager.trails.map(function(t) { return t.sprite; });
    for (var i = 0; i < 30; i++) tick(0.1);
    check(manager.trails.length === 2 && manager.pool.length <= 16, 'long emission obeys count and pool limits');
    check(manager.trails.every(function(t) { return reusedSprites.indexOf(t.sprite) >= 0; }),
        'continuous emission reuses expired sprites as well as textures');
    check(manager.trails.every(function(t) { return t.sprite.children.length === 1 && t.sprite.visible === (t.stage < 8); }),
        'reused afterimages keep exactly one reusable mask and reset their visibility');
    var newest = manager.trails[manager.trails.length - 1];
    var alpha = newest.sprite.alpha;
    var oldStage = newest.stage;
    var beforeFade = visiblePixels(renderedPixels(newest.sprite));
    for (var i = 0; i < 5; i++) tick();
    var afterFade = visiblePixels(renderedPixels(newest.sprite));
    check(newest.sprite.alpha === alpha && alpha === 1 && newest.stage > oldStage && afterFade < beforeFade,
        'stationary afterimages lose actual pixels as the hatch advances, without reducing opacity');
    $gameSwitches.setValue(1, true);
    var age = newest.age;
    tick(0.1);
    check(newest.age === age, 'game pause freezes image lifetime');
    $gameSwitches.setValue(1, false);
    tick(10);
    check(manager.trails.length === 0, 'teleport clears the previous trail without connecting distant positions');

    $gamePlayer.startAfterimage({ interval: 1, life: 18, startStage: 0 });
    tick();
    tick(0.1);
    var staged = manager.trails[0], stages = [staged.stage];
    $gamePlayer.stopAfterimage();
    for (var i = 0; i < 17; i++) {
        tick();
        if (stages.indexOf(staged.stage) < 0) stages.push(staged.stage);
    }
    check(stages.length === 9 && stages[0] === 0 && staged.stage === 8 && !staged.sprite.visible,
        'even an 18-update lifetime visits all nine mask stages and ends fully invisible');
    $gamePlayer.clearAfterimages();

    $gamePlayer.startAfterimage({ interval: 1, life: 4 });
    tick();
    tick(0.1);
    $gamePlayer.stopAfterimage();
    for (var i = 0; i < 4; i++) tick(0.1);
    check(manager.trails.length === 0 && manager.entries.size === 0, 'stop lets images expire and releases the source registration');
    $gamePlayer.startAfterimage({ interval: 1, life: 4 });
    var sceneUpdate = scene.update;
    var updates = 0;
    scene.update = function() { updates++; source.update(); };
    SceneManager.updateScene();
    $gamePlayer._realX += 0.2;
    SceneManager.updateScene();
    check(updates === 2 && manager.trails.length === 1, 'scene hook captures after normal updates without updating the character twice');
    scene.update = sceneUpdate;
    $gamePlayer.clearAfterimages();
    $gamePlayer.startAfterimage({ interval: 1, life: 20 });
    tick();
    tick(0.1);
    var sourceParent = source.parent;
    sourceParent.removeChild(source);
    for (var i = 0; i < 21; i++) manager.update();
    check(manager.trails.length === 0 && manager.entries.size === 0, 'detaching a source drains its images and releases its registration');
    sourceParent.addChild(source);

    // A real battle sprite exercises the other adapter and its own coordinates.
    var actor = $gameActors.actor(2);
    var battler = new Sprite_NewActor(actor);
    battler.setHome(460, 420);
    sourceParent.addChild(battler);
    battler.update();
    await until(function() { return battler.bitmap && battler.bitmap.isReady(); });
    battler.update();
    battler.startAfterimage({ interval: 1, life: 8 });
    battler.update();
    manager.update();
    battler._offsetX = 24;
    battler.update();
    manager.update();
    var battleTrail = manager.trails.filter(function(t) { return t.entry.owner === actor; })[0];
    check(!!battleTrail && !battleTrail.map && hasPixels(pixels(battleTrail.texture)), 'real Sprite_NewActor emits rendered battle afterimages');
    var battleX = battleTrail.sprite.x;
    $gameMap._displayX += 1;
    manager.update();
    check(battleTrail.sprite.x === battleX, 'battle afterimages do not receive map scroll correction');
    battler.stopAfterimage().clearAfterimages();
    sourceParent.removeChild(battler);
    battler.destroy({ children: true, texture: false, baseTexture: false });

    $gamePlayer.startAfterimage({ interval: 1 });
    tick();
    tick(0.1);
    $gamePlayer.reserveTransfer(36, 20, 16, 6, 2);
    $gamePlayer.performTransfer();
    check(manager.trails.length === 0 && manager.entries.size === 0, 'same-map transfer clears stale images and registrations');
    var textures = manager.pool.slice();
    manager.dispose();
    check(manager.pool.length === 0 && manager.spritePool.length === 0 && manager.trails.length === 0 && textures.every(function(t) { return !t.baseTexture; }),
        'disposing a scene destroys its owned RenderTextures');
    check(hatch.bitmaps.every(function(b) { return b._baseTexture && b._baseTexture.source; }),
        'scene disposal preserves shared masks for other scenes and character fades');
    delete scene._knhAfterimageManager;
    $gamePlayer.stopAfterimage();

    ['terminate', 'destroy'].forEach(function(method) {
        var disposable = new Scene_Base();
        var owned = disposable._knhAfterimageManager = new KNH_Afterimage.Manager(disposable);
        var texture = owned.takeTexture(32, 32);
        owned.returnTexture(texture);
        disposable[method]();
        check(!texture.baseTexture && !disposable._knhAfterimageManager,
            'scene ' + method + ' hook releases owned render resources');
    });

    window._knhAfterimageCheck = { scene: scene, source: source };
    return { passed: results.length, checks: results, webgl: Graphics.isWebGL(), pixi: PIXI.VERSION };
}

async function screenshotScenario() {
    var scene = window._knhAfterimageCheck.scene;
    var source = window._knhAfterimageCheck.source;
    $gamePlayer.setImageZXC('$001', 0, 6);
    $gamePlayer._realX = $gamePlayer._x = 24.5;
    $gamePlayer._realY = $gamePlayer._y = 25;
    $gamePlayer.setDirection(6);
    $gamePlayer._displayCx = 28;
    $gamePlayer._displayCy = 24;
    $gameMap.setDisplayPos(28 - Graphics.width / 96, 24 - Graphics.height / 96);
    source._yuraInfo = [20, 15, 10, false];
    // Parallax effects can request further assets on their first update.
    for (var ready = 0; ready < 20; ready++) {
        scene._spriteset.update();
        await new Promise(function(resolve) { setTimeout(resolve, 16); });
    }
    $gamePlayer.startAfterimage({ interval: 3, life: 24, startStage: 2, maxCount: 8 });
    scene._spriteset.update();
    var manager = scene._knhAfterimageManager;
    for (var i = 0; i < 23; i++) {
        $gamePlayer._realX += 0.25;
        $gamePlayer._x = $gamePlayer._realX;
        $gamePlayer._pattern = i % 4;
        source.update();
        manager.update();
    }
    // This is the actual game scene and renderer, with only movement staged.
    Graphics._renderer.render(scene);
    return Graphics._renderer.extract.canvas().toDataURL('image/png');
}

(async () => {
    const client = await connect(Number(process.argv[2]) || 9337);
    try {
        const result = await client.evaluate(engineChecks);
        console.log(JSON.stringify(result, null, 2));
        if (process.argv[3]) {
            const directory = path.resolve(process.argv[3]);
            await fs.mkdir(directory, { recursive: true });
            const data = await client.evaluate(screenshotScenario);
            const filename = path.join(directory, 'afterimage-mask-map.png');
            await fs.writeFile(filename, Buffer.from(data.split(',')[1], 'base64'));
            console.log('Screenshot: ' + filename);
        }
    } finally {
        client.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
