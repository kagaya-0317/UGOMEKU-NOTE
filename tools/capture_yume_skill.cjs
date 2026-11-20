// Capture a saved Yume skill with the real NW.js renderer, one game tick per frame.
// Start an isolated playtest with --remote-debugging-port=9335 before running this.
// Usage: node tools/capture_yume_skill.cjs record --skill=49
// Use record-memory to pipe PNG buffers straight to ffmpeg without saving frames.
// Use --preview for the isolated battle entry point when map plugins are unavailable.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..');
const audioShowcase = process.argv.includes('--audio-showcase');
const yuraShowcase = process.argv.includes('--yura-showcase');
const multiWeapon = process.argv.includes('--multi-weapon') || audioShowcase || yuraShowcase;
const skillId = Number((process.argv.find(arg => arg.startsWith('--skill=')) || '--skill=48').split('=')[1]);
const skillName = yuraShowcase ? 'yura-improvements' : audioShowcase ? 'audio-balance' : multiWeapon ? 'multi-weapon' : { 46: 'gun-1', 47: 'gun-2', 48: 'cannon', 49: 'drill', 50: 'flamethrower', 51: 'charge-cannon', 52: 'machine-gun', 53: 'gatling', 54: 'homing-missile' }[skillId];
if (!skillName) throw new Error('Supported skill IDs: 46..54');
const take = (process.argv.find(arg => arg.startsWith('--take=')) || '--take=').split('=')[1];
const preview = process.argv.includes('--preview');
if (take && !/^[a-z0-9-]+$/.test(take)) throw new Error('Invalid take name');
const captureFrames = audioShowcase ? 1200 : skillId === 54 && ['zigzag-detour', 'upper-detour'].includes(take) ? 960 : 720;
const castInterval = captureFrames === 960 ? 300 : 240;
const artifactDir = path.join(root, 'artifacts', 'yume-' + skillName + (take ? '-' + take : ''));
const work = path.join(artifactDir, '_capture');
const output = path.join(artifactDir, 'yume_' + skillName.replace(/-/g, '_') + (take ? '_' + take.replace(/-/g, '_') : '') + '.mp4');
const ffmpeg = path.join(root, 'tools', 'bgm_video_maker', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
fs.mkdirSync(work, { recursive: true });

async function connect() {
    let page;
    for (let attempt = 0; attempt < 80 && !page; attempt++) {
        try {
            const pages = await (await fetch('http://127.0.0.1:9335/json')).json();
            page = pages.find(p => /\/index.html$/.test(p.url));
        } catch (_) {}
        if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!page) throw new Error('No isolated NW.js game target on port 9335');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
    });
    let next = 0;
    const pending = new Map();
    ws.addEventListener('message', e => {
        const message = JSON.parse(e.data);
        const p = pending.get(message.id);
        if (!p) return;
        pending.delete(message.id);
        if (message.error) p.reject(new Error(JSON.stringify(message.error)));
        else p.resolve(message.result);
    });
    const call = (method, params) => new Promise((resolve, reject) => {
        const id = ++next;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
    return {
        call,
        close: () => ws.close(),
        async evaluate(expression) {
            const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (r.exceptionDetails || r.wasThrown) throw new Error(JSON.stringify(r));
            return r.result.value;
        }
    };
}

async function prepare(cdp) {
    for (let i = 0; i < 600; i++) {
        if (await cdp.evaluate(`(function() {
            var ready = typeof Scene_SkillEditor === 'function' && !!window.$dataSkills &&
                !!SceneManager._sceneStarted && !SceneManager._nextScene;
            if (ready && !window.$gameParty && DataManager.isDatabaseLoaded()) DataManager.setupNewGame();
            return ready && !!window.$gameScreen && !!window.$gameParty;
        })()`)) break;
        if (i === 599) throw new Error('Game plugins/database did not finish loading');
        await new Promise(r => setTimeout(r, 100));
    }
    await cdp.evaluate(`(function() {
        if (window.__yumeSkillQA) {
            SceneManager.updateMain = __yumeSkillQA.originalMain;
            AudioManager.playSe = __yumeSkillQA.originalPlaySe;
            KNH_ZXC_Battle_Yume.playLoopSe = __yumeSkillQA.originalPlayLoopSe;
            if (__yumeSkillQA.originalRealTimeFrame)
                $gameSystem.getRealTimeFrame60 = __yumeSkillQA.originalRealTimeFrame;
        }
        SceneManager._stopped = false;
        SceneManager.requestUpdate();
        SceneManager.goto(Scene_SkillEditor);
        return true;
    })()`);
    for (let i = 0; i < 100; i++) {
        if (await cdp.evaluate('SceneManager._scene instanceof Scene_SkillEditor && !!SceneManager._scene._root && !SceneManager._nextScene && !!SceneManager._sceneStarted')) break;
        if (i === 99) throw new Error('Skill editor scene did not finish starting');
        await new Promise(r => setTimeout(r, 100));
    }
    await cdp.evaluate(`(function() {
        var s = SceneManager._scene;
        s.stopSimulation();
        s.clearPlaybackObjects();
        $gameScreen.clearFade();
        $gameScreen.clearTone();
        $gameScreen.clearFlash();
        $gameScreen.clearShake();
        s._actorId = 4; s._enemyId = 13; s._skillId = ${skillId};
        s._actorCastEnabled = true; s._enemyCastEnabled = false;
        s.rebuildBattlers();
        s._root.style.display = 'none';
        AudioManager.stopAll();
        ImageManager.loadSvActor('003');
        ImageManager.loadSvActor('003_1');
        ImageManager.loadSvActor('003_2');
        ImageManager.loadBitmap('img/bullets/', 'artilleryShell');
        ImageManager.loadBitmap('img/bullets/', 'chargedShot');
        ImageManager.loadBitmap('img/bullets/', 'missile');
        return true;
    })()`);
    for (let i = 0; i < 100; i++) {
        if (await cdp.evaluate('ImageManager.isReady()')) break;
        await new Promise(r => setTimeout(r, 100));
    }
    return cdp.evaluate(`(function() {
        var s = SceneManager._scene;
        SceneManager._stopped = true;
        s.stopSimulation();
        s.clearPlaybackObjects();
        s._fadeDuration = 0;
        if (s._fadeSprite) s._fadeSprite.opacity = 0;
        s._actorSprite._forward = false;
        s._actorSprite._homeX = Math.round(Graphics.boxWidth * 0.32);
        s._actorSprite._homeY = Math.round(Graphics.boxHeight * 0.79);
        s._actorSprite._offsetX = s._actorSprite._offsetY = 0;
        s._actorSprite._movementDuration = 0;
        s._enemySprite._homeX = Math.round(Graphics.boxWidth * 0.77);
        s._enemySprite._homeY = Math.round(Graphics.boxHeight * 0.77);
        s._enemyBattler.paramBase = function(id) { return id === 0 ? 99999 : 10; };
        s._enemyBattler.recoverAll();
        var q = window.__yumeSkillQA = { frame: 0, audio: [], audioBuffers: [], trace: [], hits: [],
            originalMain:SceneManager.updateMain, originalPlaySe:AudioManager.playSe,
            originalPlayLoopSe:KNH_ZXC_Battle_Yume.playLoopSe,
            originalRealTimeFrame:$gameSystem.getRealTimeFrame60 };
        // Yurayura uses real time during editor playback. Advance that clock
        // with the captured game ticks rather than the screenshot throughput.
        $gameSystem.getRealTimeFrame60 = function() { return q.frame; };
        // A queued RAF can still run after _stopped is set. Block its updateMain
        // so every game tick in the recording comes from q.step only.
        SceneManager.updateMain = function() {};
        var play = AudioManager.playSe;
        q.recordSound = function(buffer, se, looping) {
            if (buffer) {
                var event = { frame:q.frame, name:se.name, volume:se.volume, pitch:se.pitch,
                    loop:!!looping, kind:se.name === 'Machine' || se.name === 'Equip1' ? 'movement' : 'weapon' };
                q.audio.push(event);
                q.audioBuffers.push(buffer);
                buffer._yumeCaptureEvent = event;
                // Natural SE endings must follow captured ticks, not screenshot speed.
                buffer._removeEndTimer();
                buffer._createEndTimer = function() {
                    if (!looping) event.endFrame = event.frame + Math.ceil(this._totalTime / this._pitch * 60);
                };
                if (buffer.isReady()) buffer._createEndTimer();
                var stop = buffer.stop;
                buffer.stop = function() {
                    if (event.stopFrame === undefined) event.stopFrame = q.frame;
                    return stop.apply(this, arguments);
                };
            }
        };
        AudioManager.playSe = function(se) {
            var before = this._seBuffers.slice();
            play.call(this, se);
            q.recordSound(this._seBuffers.filter(function(b) { return before.indexOf(b) < 0; })[0], se, false);
        };
        var loopSe = KNH_ZXC_Battle_Yume.playLoopSe;
        KNH_ZXC_Battle_Yume.playLoopSe = function(se) {
            var buffer = loopSe(se);
            q.recordSound(buffer, se, true);
            return buffer;
        };
        var apply = s.applyDamage;
        s.applyDamage = function(subject, target, id) {
            q.hits.push({ frame:q.frame, skillId:id });
            return apply.apply(this, arguments);
        };
        q.step = function(count, capture) {
            for (var i = 0; i < count; i++) {
                q.audioBuffers.forEach(function(buffer) {
                    var event = buffer._yumeCaptureEvent;
                    if (event.stopFrame === undefined && event.endFrame !== undefined &&
                        q.frame >= event.endFrame) buffer.stop();
                });
                if (${yuraShowcase}) {
                    if (q.frame === 40) s._actorSprite.startAction(46);
                    if (q.frame === 280) s._actorSprite.startAction(47);
                    if (q.frame === 520) s._actorSprite.startAction(50);
                } else if (${audioShowcase} && q.frame < 720) {
                    if (q.frame === 40) s._actorSprite.startAction(46);
                    if (q.frame === 100) s._actorSprite.startAction(47);
                    if (q.frame === 200) s._actorSprite.startAction(48);
                    if (q.frame === 420) {
                        q.chargeButton = { _pressing:true };
                        q.holdFrames = 120;
                        s._actorSprite.startAction(51, null, 0, q.chargeButton);
                    }
                } else if (${multiWeapon}) {
                    var wave = ${audioShowcase} ? 720 : q.frame < 320 ? 0 : 320;
                    var tick = q.frame - wave;
                    var skills = [48, 49, 50, 51, 52, 53, 54];
                    var index = (tick - 40) / 6;
                    if (index >= 0 && index < skills.length && index === Math.floor(index)) {
                        var id = skills[index];
                        if (id === 51) {
                            q.chargeButton = { _pressing:true };
                            q.holdFrames = ${audioShowcase} ? 120 : wave === 0 ? 96 : 150;
                            s._actorSprite.startAction(id, null, 0, q.chargeButton);
                        } else if (id !== 53) s._actorSprite.startAction(id);
                    }
                    if (tick === 70) q.rushButton = { _judged:false, _info:{rush:true} };
                    if (tick >= 70 && tick <= 118 && (tick - 70) % 6 === 0)
                        s._actorSprite.startAction(53, null, 0, q.rushButton);
                    if (tick === 130) {
                        q.rushButton._judged = true;
                        s._actorSprite.startAction(53, null, 0, q.rushButton);
                    }
                } else if (${skillId} === 53) {
                    var base = Math.floor(q.frame / 240) * 240;
                    var relative = q.frame - base;
                    var beltDemo = ${take === 'belt' || take === 'belt-loop'} && base === 0;
                    var gatlingDemo = ${take === 'rush' || take === 'continuous-spin' || take === 'fire-only'} && base === 0;
                    var pressFrames = gatlingDemo ? [40, 130, 136, 142, 148, 154, 160, 166, 172, 178, 184] :
                        beltDemo ? [40, 76, 94, 112, 130, 148, 154, 160, 166, 172, 178] :
                        [40, 43, 46, 49, 70, 76, 82, 88, 94, 100, 106];
                    if (relative === 40) q.rushButton = { _judged:false, _info:{rush:true} };
                    if (pressFrames.indexOf(relative) >= 0) s._actorSprite.startAction(${skillId}, null, 0, q.rushButton);
                    if (relative === (gatlingDemo ? 205 : beltDemo ? 185 : 125)) {
                        q.rushButton._judged = true;
                        s._actorSprite.startAction(${skillId}, null, 0, q.rushButton);
                    }
                }
                if (!${multiWeapon} && (q.frame === 40 || q.frame === ${40 + castInterval} || q.frame === ${40 + castInterval * 2})) {
                    if (${skillId} === 51) {
                        q.chargeButton = { _pressing: true };
                        q.holdFrames = [36, 12, 60][Math.floor(q.frame / 240)];
                        s._actorSprite.startAction(${skillId}, null, 0, q.chargeButton);
                    } else if (${skillId} !== 53) s._actorSprite.startAction(${skillId});
                }
                var chargingArm = s._actorSprite._yumeArmManager && s._actorSprite._yumeArmManager.armFor(${multiWeapon ? 51 : skillId});
                if (q.chargeButton && chargingArm && chargingArm.chargeMotion &&
                    chargingArm.chargeMotion.elapsed >= q.holdFrames) q.chargeButton._pressing = false;
                s.update();
                SceneManager.updateEasing();
                Graphics.frameCount++;
                var arm = s._actorSprite._yumeArmManager && s._actorSprite._yumeArmManager.armFor(${skillId});
                var manager = s._actorSprite._yumeArmManager;
                var rigs = manager ? Object.keys(manager.arms).map(function(key) {
                    var rig = manager.arms[key], buffer = rig.moveSeBuffer;
                    var event = buffer && buffer._yumeCaptureEvent;
                    return { skillId:Number(key), weapon:rig.weapon, phase:rig.phase,
                        visible:rig.weaponRoot.visible, sound:event && event.name,
                        soundKind:event && event.kind, soundPlaying:!!(buffer && buffer.isPlaying()),
                        moving:!!rig.toPoints, firing:rig.weaponFiring,
                        drilling:!!rig.drillMotion, spraying:!!rig.flameMotion,
                        charging:!!rig.chargeMotion, recoiling:!!rig.recoilMotion,
                        armYura:!!rig.armSprite._yuraInfo,
                        armMesh:!!(rig.armSprite._meshSprite && rig.armSprite._meshSprite.visible),
                        bodyYura:!!rig.barrelSprite._yuraInfo,
                        bodyMesh:!!(rig.barrelSprite._meshSprite && rig.barrelSprite._meshSprite.visible),
                        cell:rig.sequenceFrame, rotor:rig.rotorSprite.visible,
                        rotorFrame:rig.rotorFrame, bodyOffset:{x:rig.barrelSprite.x,y:rig.barrelSprite.y},
                        points:rig.points.map(function(p) { return {x:p.x,y:p.y}; }),
                        support:rig.supportPoints && rig.supportPoints.map(function(p) { return {x:p.x,y:p.y}; }),
                        scale:rig.weaponScale, angle:rig.angle, alpha:rig.weaponRoot.alpha };
                }) : [];
                var tip = arm && s._actorSprite.toGlobal(arm.points[arm.points.length - 1]);
                q.trace.push({ frame:q.frame, phase:arm && arm.phase, cell:arm && arm.sequenceFrame,
                    yura:!!(arm && arm.barrelSprite._yuraInfo), visible:!!(arm && arm.weaponRoot.visible),
                    drilling:!!(arm && arm.drillMotion), shake:arm && arm.drillShakeX, tip:tip,
                    flame:arm && arm.flameFrame, spraying:!!(arm && arm.flameMotion),
                    weaponScale:arm && arm.weaponScale,
                    weaponAlpha:arm && arm.weaponRoot.alpha,
                    armAlpha:arm && arm.armSprite.alpha,
                    angle:arm && arm.angle,
                    charging:!!(arm && arm.chargeMotion), chargeScale:arm && arm.chargeScale,
                    chargeCell:arm && arm.chargeFrame, lastShotScale:arm && arm.lastShotScale,
                    bodyOffset:arm && {x:arm.barrelSprite.x,y:arm.barrelSprite.y},
                    chargeAge:arm && arm.chargeMotion && arm.chargeMotion.elapsed,
                    recoilAge:arm && arm.recoilMotion && arm.recoilMotion.elapsed,
                    machineGun:arm && arm.machineGunMotion && {
                        queued:arm.machineGunMotion.queue.length, hits:arm.machineGunMotion.hits.length,
                        fired:arm.machineGunMotion.fired, closing:arm.machineGunMotion.closing,
                    cooldown:arm.machineGunMotion.cooldown, beltUsed:arm.machineBeltUsed,
                    firing:arm.weaponFiring
                    },
                    armYura:!!(arm && arm.armSprite._yuraInfo),
                    armLinks:arm && arm.points.length - 1,
                    armLengths:arm && arm.points.slice(1).map(function(p, i) {
                        return Math.hypot(p.x - arm.points[i].x, p.y - arm.points[i].y);
                    }),
                    armMesh:!!(arm && arm.armSprite._meshSprite && arm.armSprite._meshSprite.visible),
                    weaponMesh:!!(arm && arm.barrelSprite._meshSprite && arm.barrelSprite._meshSprite.visible),
                    chargeCenter:arm && arm.chargeSprite && arm.chargeSprite.toGlobal({ x:0, y:0 }),
                    support:arm && arm.supportPoints && s._actorSprite.toGlobal(arm.supportPoints[arm.supportPoints.length - 1]),
                    bullets:s._bulletSprites.map(function(b) {
                        return { x:b.x, y:b.y, tx:b._tx, ty:b._ty, finish:b._finish || 0,
                            cell:Math.floor(b._count / b._frameCount) % b._frames,
                            chargeScale:b._yumeChargeScale, scale:b.scale.x, diameter:b._yumeChargeDiameter,
                            poseAge:b._yumePoseAge,
                            shownCell:b._frame.x / (b.bitmap.width / b._frames),
                            heading:b.rotation, missileAge:b._yumeMissileState && b._yumeMissileState.elapsed,
                            missileSpeed:b._yumeMissileState && b._yumeMissileState.speed,
                            missileDetour:b._yumeMissileState && b._yumeMissileState.detourIndex,
                            missileGuideHeading:b._yumeMissileState && b._yumeMissileState.angle,
                            shownRow:b._frame.y / (b.bitmap.height / 2) };
                    }),
                    rigs:rigs, actions:s._actorSprite._actions.length });
                q.frame++;
            }
            Graphics._renderer.render(s);
            if (capture) return Graphics._canvas.toDataURL('image/png').split(',')[1];
            return q.trace[q.trace.length - 1];
        };
        q.step(0, false);
        return { width:Graphics.width, height:Graphics.height, scene:s.constructor.name,
            skill:$dataSkills[${skillId}].note, actor:s._actorBattler.name() };
    })()`);
}

async function encode(audio, frames, buffers) {
    const args = buffers ? ['-hide_banner', '-y', '-f', 'image2pipe', '-framerate', '60', '-i', 'pipe:0'] :
        ['-hide_banner', '-y', '-framerate', '60', '-i', path.join(work, 'frame-%04d.png')];
    const filters = [];
    const streams = [];
    const events = audio.filter(e => e.name && (e.stopFrame === undefined || e.stopFrame > e.frame) &&
        fs.existsSync(path.join(root, 'audio', 'se', e.name + '.ogg')));
    events.forEach((event, index) => {
        if (event.loop) args.push('-stream_loop', '-1');
        args.push('-i', path.join(root, 'audio', 'se', event.name + '.ogg'));
        const label = 's' + index;
        const endFrame = event.stopFrame === undefined && event.loop ? frames : event.stopFrame;
        const trim = endFrame === undefined ? '' :
            ',atrim=duration=' + Math.max(1 / 60, (endFrame - event.frame) / 60);
        filters.push('[' + (index + 1) + ':a]aresample=44100,asetrate=' +
            (44100 * (event.pitch || 100) / 100) + ',aresample=44100' + trim +
            ',volume=' + ((event.volume || 0) / 100) + ',adelay=' +
            Math.round(event.frame / 60 * 1000) + ':all=1[' + label + ']');
        streams.push('[' + label + ']');
    });
    if (!streams.length) throw new Error('No recorded sound events');
    filters.push(streams.join('') + 'amix=inputs=' + streams.length +
        ':normalize=0,apad,atrim=duration=' + frames / 60 + ',alimiter=limit=0.95[a]');
    args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-t', String(frames / 60), '-movflags', '+faststart', output);
    if (buffers) {
        const encoder = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
        let log = '';
        encoder.stderr.on('data', chunk => { log += chunk.toString(); });
        encoder.stdin.on('error', () => {});
        const completed = new Promise((resolve, reject) => {
            encoder.on('error', reject);
            encoder.on('close', code => code ? reject(new Error(log)) : resolve());
        });
        completed.catch(() => {});
        try {
            for (const buffer of buffers) {
                if (!encoder.stdin.write(buffer)) await Promise.race([once(encoder.stdin, 'drain'), completed]);
            }
            encoder.stdin.end();
            await completed;
        } finally { fs.writeFileSync(path.join(work, 'encode.log'), log); }
    } else {
        const result = spawnSync(ffmpeg, args, { encoding: 'utf8', maxBuffer: 5e6 });
        fs.writeFileSync(path.join(work, 'encode.log'), result.stderr);
        if (result.status) throw new Error(result.stderr);
    }
    console.log(JSON.stringify({ output, bytes: fs.statSync(output).size, soundEvents: events.length, frames }));
}

(async () => {
    const mode = process.argv[2] || 'prepare';
    if (mode === 'encode') {
        await encode(JSON.parse(fs.readFileSync(path.join(work, 'audio.json'))), captureFrames);
        return;
    }
    const cdp = await connect();
    try {
        if (preview) {
            const url = await cdp.evaluate("new URL('tools/yume_skill_preview/index.html', document.baseURI).href");
            await cdp.call('Page.navigate', { url });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (mode === 'reload') {
            await cdp.call('Page.reload', {});
            await new Promise(r => setTimeout(r, 1000));
            console.log('Reloaded isolated playtest');
        } else if (mode === 'prepare') console.log(JSON.stringify(await prepare(cdp)));
        else if (mode === 'audit') {
            await prepare(cdp);
            const data = await cdp.evaluate(`(function() {
                WebAudio.setMasterVolume(0);
                for (var frame = 0; frame < 720; frame++) __yumeSkillQA.step(1, false);
                return { traces:__yumeSkillQA.trace.map(function(t) {
                    return {frame:t.frame,rigs:t.rigs,bullets:t.bullets,actions:t.actions};
                }), hits:__yumeSkillQA.hits };
            })()`);
            const staticRuns = (part, keyFor) => {
                const runs = [];
                for (const row of data.traces) for (const rig of row.rigs) {
                    if (!rig.visible || (part === 'arm' ? rig.armYura : rig.bodyYura)) continue;
                    const key = rig.skillId + ':' + keyFor(rig);
                    const last = runs.at(-1);
                    if (last && last.key === key && last.end === row.frame - 1) last.end = row.frame;
                    else runs.push({key,start:row.frame,end:row.frame,phase:rig.phase,
                        moving:rig.moving,firing:rig.firing,drilling:rig.drilling,
                        spraying:rig.spraying,recoiling:rig.recoiling});
                }
                return runs.filter(r => r.end - r.start + 1 > 8).map(({key,...r}) =>
                    ({...r,frames:r.end-r.start+1}));
            };
            const summary = {skillId,skillName,hits:data.hits.length,
                armStatic:staticRuns('arm', r=>JSON.stringify([r.points,r.support])),
                bodyStatic:staticRuns('body', r=>JSON.stringify([r.points.at(-1),r.scale,r.angle,
                    r.bodyOffset,r.cell,r.rotor,r.rotor?r.rotorFrame:null,r.alpha])),
                bodyArtStatic:staticRuns('body', r=>JSON.stringify([r.cell,r.rotor,r.rotor?r.rotorFrame:null])),
                phases:[...new Set(data.traces.flatMap(t=>t.rigs.filter(r=>r.visible).map(r=>
                    JSON.stringify({phase:r.phase,moving:r.moving,armYura:r.armYura,bodyYura:r.bodyYura,
                        firing:r.firing,drilling:r.drilling,spraying:r.spraying,recoiling:r.recoiling}))))].map(s=>JSON.parse(s))};
            const bulletRuns = [];
            for (const row of data.traces) for (const b of row.bullets) {
                const key = JSON.stringify([b.x,b.y,b.heading,b.shownCell,b.shownRow,b.finish]);
                const last = bulletRuns.at(-1);
                if (last && last.key === key && last.end === row.frame - 1) last.end = row.frame;
                else bulletRuns.push({key,start:row.frame,end:row.frame});
            }
            summary.bulletStatic = bulletRuns.filter(r=>r.end-r.start+1>8).map(({key,...r})=>
                ({...r,frames:r.end-r.start+1}));
            fs.writeFileSync(path.join(work, 'audit.json'), JSON.stringify(summary,null,2));
            console.log(JSON.stringify(summary));
        }
        else if (mode === 'sample') {
            const count = Number(process.argv[3] || 1);
            const data = await cdp.evaluate('__yumeSkillQA.step(' + count + ', true)');
            const file = path.join(work, 'sample-' + Date.now() + '.png');
            fs.writeFileSync(file, Buffer.from(data, 'base64'));
            console.log(JSON.stringify({ file, state: await cdp.evaluate('__yumeSkillQA.trace.slice(-1)[0]') }));
        } else if (mode === 'record' || mode === 'record-memory') {
            // Re-enter the scene to reset all playback state before the take.
            console.log(JSON.stringify(await prepare(cdp)));
            const buffers = mode === 'record-memory' ? [] : null;
            for (let frame = 0; frame < captureFrames; frame++) {
                const data = await cdp.evaluate('__yumeSkillQA.step(1, true)');
                const buffer = Buffer.from(data, 'base64');
                if (buffers) buffers.push(buffer);
                else fs.writeFileSync(path.join(work, 'frame-' + String(frame).padStart(4, '0') + '.png'), buffer);
                if (frame % 120 === 0) console.log('Captured ' + frame + '/' + captureFrames);
            }
            const audio = await cdp.evaluate('__yumeSkillQA.audio');
            fs.writeFileSync(path.join(work, 'audio.json'), JSON.stringify(audio, null, 2));
            fs.writeFileSync(path.join(work, 'trace.json'), JSON.stringify(await cdp.evaluate('__yumeSkillQA.trace')));
            fs.writeFileSync(path.join(work, 'hits.json'), JSON.stringify(await cdp.evaluate('__yumeSkillQA.hits')));
            await encode(audio, captureFrames, buffers);
        } else throw new Error('Unknown mode: ' + mode);
    } finally { cdp.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
