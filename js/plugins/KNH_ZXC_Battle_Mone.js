/*:
 * @plugindesc Mone: BGM-synchronized sine-wave rhythm bar (troop 46 only).
 * @help Load after KNH_ZXC_CastleUpper and KNH_ZXC_Battle_Gnuro.
 * Troop script: KNH_CastleUpper.queueMoneWave(24, 2);
 * In-dialogue reveal: KNH_CastleUpper.revealMoneWave(24, 2);
 * Then this.setWaitMode('moneWaveReveal') before companion reactions.
 * HP50 arrangement: disorderMoneWave(24, 2), then alignMoneWave().
 * Both use this.setWaitMode('moneWaveArrange').
 * HP25 finale: chaosMoneWave(24) + moneWaveArrange; lasts until battle ends.
 * Units: pixels and playable rhythm rounds. Input times and X coordinates stay native.
 */
(function() {
    'use strict';
    var NS = window.KNH_ZXC_Battle_Mone = {};
    var TAU = Math.PI * 2;
    function sceneIsMone(scene) {
        return scene instanceof Scene_NewBattle && $gameTroop._troopId === 46 &&
            scene._enemySprites.some(function(sp) { return sp._battler.enemyId() === 23; });
    }
    function smooth(value) {
        var t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    }
    NS.offset = function(x, width, amplitude, phase, disorder, chaos) {
        var u = Math.max(0, Math.min(1, x / Math.max(1, width)));
        var detail = Math.sin(7 * Math.PI * u + 0.6) + 0.45 * Math.sin(13 * Math.PI * u - 0.4);
        var regular = Math.sin(3 * Math.PI * u - phase) + (disorder || 0) * 0.3 * detail;
        var size = Math.sin(Math.PI * u + 0.2);
        var wild = 1.35 * (0.45 + 0.55 * size * size) * Math.sin(5 * Math.PI * u - phase * 0.55 + 0.8) +
            0.28 * Math.sin(19 * Math.PI * u + phase * 0.9 + 0.4) +
            0.15 * Math.sin(33 * Math.PI * u - phase * 0.7 - 0.5);
        var mix = chaos || 0;
        // Lift the finale's whole band so even its largest crest and cursor stay
        // above the status panels. The lift eases in with the chaotic shape.
        return amplitude * Math.pow(Math.sin(Math.PI * u), 2) * (regular + (wild - regular) * mix) - 72 * mix;
    };
    var fragment = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'uniform sampler2D uSampler;',
        'uniform vec4 filterArea;',
        'uniform vec4 filterClamp;',
        'uniform vec4 barFrame;',
        'uniform float barWidth;',
        'uniform float amplitude;',
        'uniform float phase;',
        'uniform float disorder;',
        'uniform float chaos;',
        'uniform float baseShift;',
        'void main(void){',
        'vec2 screen=vTextureCoord*filterArea.xy+filterArea.zw;',
        'float u=clamp((screen.x-barFrame.x)/barFrame.z/barWidth,0.0,1.0);',
        'float envelope=sin(3.14159265359*u);',
        'float detail=sin(21.9911485751*u+0.6)+0.45*sin(40.8407044967*u-0.4);',
        'float regular=sin(9.42477796077*u-phase)+disorder*0.3*detail;',
        'float size=sin(3.14159265359*u+0.2);',
        'float wild=1.35*(0.45+0.55*size*size)*sin(15.7079632679*u-phase*0.55+0.8)',
        '+0.28*sin(59.6902604182*u+phase*0.9+0.4)+0.15*sin(103.672557569*u-phase*0.7-0.5);',
        'float dy=amplitude*envelope*envelope*mix(regular,wild,chaos)-72.0*chaos-baseShift;',
        'vec2 uv=vTextureCoord-vec2(0.0,dy*barFrame.w/filterArea.y);',
        'if(uv.x<filterClamp.x||uv.y<filterClamp.y||uv.x>filterClamp.z||uv.y>filterClamp.w)',
        'gl_FragColor=vec4(0.0);else gl_FragColor=texture2D(uSampler,uv);',
        '}'
    ].join('\n');
    function restoreUi(state) {
        state.mapped.forEach(function(sp) {
            if (sp._moneWaveDy !== undefined) {
                sp.y -= sp._moneWaveDy;
                delete sp._moneWaveDy;
            }
        });
        state.mapped.length = 0;
    }
    function shift(state, sp, x) {
        if (!sp || sp._moneWaveDy !== undefined) return;
        var dy = NS.offset(x, state.scene._barSprite.width, state.amplitude, state.phase, state.disorder, state.chaos);
        sp.y += dy;
        sp._moneWaveDy = dy;
        state.mapped.push(sp);
    }
    function detach(record) {
        if (record.target) record.target.filters = (record.target.filters || []).filter(function(f) { return f !== record.filter; });
        record.target = null;
    }
    function makeFilter(state, tail, button) {
        var record = {target: null, tail: tail, button: button};
        var f = record.filter = new PIXI.Filter(PIXI.Filter.defaultVertexSrc, fragment,
            {barFrame:[0,0,1,1],barWidth:720,amplitude:0,phase:0,disorder:0,chaos:0,baseShift:0});
        f.padding = state.chaosMode ? 128 : state.maximum * 2 + 12;
        f.apply = function(manager, input, output, clear) {
            var bar = state.scene._barSprite, t = bar.worldTransform;
            this.uniforms.barFrame = [t.tx,t.ty,t.a,t.d];
            this.uniforms.barWidth = bar.width;
            this.uniforms.amplitude = state.amplitude;
            this.uniforms.phase = state.phase;
            this.uniforms.disorder = state.disorder || 0;
            this.uniforms.chaos = state.chaos || 0;
            this.uniforms.baseShift = button ? NS.offset(button.x,bar.width,state.amplitude,state.phase,state.disorder,state.chaos) : 0;
            manager.applyFilter(this,input,output,clear);
        };
        state.filters.push(record);
        return record;
    }
    function attach(record, target) {
        if (!target || record.target === target) return;
        detach(record);
        target.filters = (target.filters || []).concat([record.filter]);
        record.target = target;
    }
    function clearWave(scene) {
        var state = scene._moneWave;
        if (!state) return;
        restoreUi(state);
        state.filters.forEach(function(record) {
            detach(record);
            if (record.filter.destroy) record.filter.destroy();
            if (record.tail) delete record.tail._moneWaveFilter;
        });
        state.amplitude = 0;
        state.finished = true;
        scene._moneWaveLast = {started:state.started,elapsed:state.elapsed,total:state.total,maximum:state.maximum};
        delete scene._moneWave;
    }
    KNH_CastleUpper.queueMoneWave = function(amplitude, rounds) {
        var scene = SceneManager._scene;
        if (!sceneIsMone(scene)) return;
        clearWave(scene);
        var period = scene.maxCount();
        var state = scene._moneWave = {scene:scene,pending:true,started:false,elapsed:0,
            maximum:Math.max(0,Math.min(24,Number(amplitude)||0)),rounds:Math.max(1,Number(rounds)||2),
            period:period,total:Math.max(1,Number(rounds)||2)*period,beat:period/8,
            amplitude:0,phase:Math.PI,mapped:[],filters:[],lastClock:$gameSystem.sceneCount(),
            lastProgress:scene.progress(),lastActive:false};
        state.barFilter = makeFilter(state);
        var enemy = scene._enemySprites.filter(function(sp) { return sp._battler.enemyId() === 23; })[0];
        var light = scene.playAnimation($dataAnimations[6],enemy.x,enemy.y-80);
        light.scale.x = light.scale.y = 0.45;
        $gameSystem.playSe('00_kiran',70,120);
    };
    KNH_CastleUpper.clearMoneWave = function() { clearWave(SceneManager._scene); };
    // Reveal the bend inside the troop conversation, without consuming playable
    // rounds. Hold this pose through reactions, then animate it on battle resume.
    KNH_CastleUpper.revealMoneWave = function(amplitude, rounds) {
        KNH_CastleUpper.queueMoneWave(amplitude, rounds);
        var state = SceneManager._scene._moneWave;
        if (!state) return;
        state.revealed = true;
        state.revealing = true;
        state.revealAge = 0;
    };
    KNH_CastleUpper.disorderMoneWave = function(amplitude, rounds) {
        var scene = SceneManager._scene;
        if (!sceneIsMone(scene)) return;
        if (!scene._moneWave) KNH_CastleUpper.queueMoneWave(amplitude, rounds);
        var state = scene._moneWave;
        // A second spell may start after the first expired, or inherit its exact
        // current pose. Neither path jumps or consumes rounds during dialogue.
        state.heldPhase = state.phase;
        state.maximum = Math.max(0,Math.min(24,Number(amplitude)||0));
        state.period = scene.maxCount();state.beat = state.period / 8;
        state.total = Math.max(1,Number(rounds)||2) * state.period;
        state.elapsed = 0;state.pending = true;state.started = false;
        state.revealed = true;state.revealing = false;state.revealAge = state.beat;
        state.lastClock = $gameSystem.sceneCount();state.lastActive = false;
        state.arrangement = {age:0,duration:state.beat,fromAmp:state.amplitude,toAmp:state.maximum,
            fromDisorder:state.disorder||0,toDisorder:1};
    };
    KNH_CastleUpper.alignMoneWave = function() {
        var scene = SceneManager._scene;
        if (!sceneIsMone(scene) || !scene._moneWave) return;
        var state = scene._moneWave;
        state.arrangement = {age:0,duration:state.beat*2,fromAmp:state.amplitude,toAmp:state.amplitude,
            fromDisorder:state.disorder||0,toDisorder:0};
        state.lastClock = $gameSystem.sceneCount();
    };
    KNH_CastleUpper.chaosMoneWave = function(amplitude) {
        var scene = SceneManager._scene;
        if (!sceneIsMone(scene)) return;
        KNH_CastleUpper.disorderMoneWave(amplitude, 2);
        var state = scene._moneWave;
        state.chaosMode = state.persistent = true;
        state.arrangement.duration = state.beat * 2;
        state.arrangement.toDisorder = 0;
        state.arrangement.fromChaos = state.chaos || 0;
        state.arrangement.toChaos = 1;
        state.filters.forEach(function(record) { record.filter.padding = 128; });
    };
    var waitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'moneWaveArrange') {
            var arrangeScene = SceneManager._scene, arrangeState = arrangeScene && arrangeScene._moneWave;
            if (arrangeState && arrangeState.arrangement) return true;
            this._waitMode = '';
            return false;
        }
        if (this._waitMode === 'moneWaveReveal') {
            var scene = SceneManager._scene, state = scene && scene._moneWave;
            if (state && state.revealing) return true;
            this._waitMode = '';
            return false;
        }
        return waitMode.apply(this, arguments);
    };
    var update = Scene_NewBattle.prototype.update;
    Scene_NewBattle.prototype.update = function() {
        if (this._moneWave) restoreUi(this._moneWave);
        update.apply(this, arguments);
    };
    var updateBar = Scene_NewBattle.prototype.updateBar;
    Scene_NewBattle.prototype.updateBar = function() {
        updateBar.apply(this, arguments);
        var state = this._moneWave;
        if (!state) return;
        if (this._inFinish || this._inTodome || BattleManager._phase === 'battleEnd' ||
                !$gameTroop.members().some(function(enemy) { return enemy.isAlive(); })) {
            clearWave(this);return;
        }
        var clock = $gameSystem.sceneCount(), progress = this.progress(), active = this.isBattleActive();
        var delta = clock - state.lastClock;
        var arrangement = state.arrangement;
        if (arrangement) {
            if (delta >= 0 && delta < state.period / 2) arrangement.age += delta;
            var t = smooth(arrangement.age / arrangement.duration);
            state.amplitude = arrangement.fromAmp + (arrangement.toAmp - arrangement.fromAmp) * t;
            state.disorder = arrangement.fromDisorder + (arrangement.toDisorder - arrangement.fromDisorder) * t;
            if (arrangement.toChaos !== undefined)
                state.chaos = arrangement.fromChaos + (arrangement.toChaos - arrangement.fromChaos) * t;
            if (arrangement.age >= arrangement.duration) delete state.arrangement;
        } else if (state.revealing) {
            if (delta >= 0 && delta < state.period / 2) state.revealAge += delta;
            if (state.revealAge >= state.beat) state.revealing = false;
        } else if (state.pending && active && (progress < state.lastProgress || progress < 6)) {
            state.pending = false;state.started = true;state.elapsed = 0;
        } else if (state.started && active && state.lastActive && delta >= 0 && delta < state.period / 2) {
            state.elapsed += delta;
        }
        state.lastClock = clock;state.lastProgress = progress;state.lastActive = active;
        // Start on the upper crest at the cursor so it stays clear of the HUD.
        state.phase = (state.heldPhase === undefined ? Math.PI : state.heldPhase) + TAU * state.elapsed / state.period;
        var fadeIn = state.revealed ? smooth(state.revealAge/state.beat) : smooth(state.elapsed/state.beat);
        if (!arrangement) state.amplitude = state.maximum * fadeIn * (state.persistent ? 1 : smooth((state.total-state.elapsed)/state.beat));
        if (!state.persistent && state.elapsed >= state.total) { clearWave(this);return; }
        var bar = this._barSprite;
        attach(state.barFilter, bar._meshSprite);
        this._buttonSprites.forEach(function(button) {
            shift(state,button,button.x);
            var tail = button._tailSprite;
            if (tail) {
                if (!tail._moneWaveFilter) tail._moneWaveFilter = makeFilter(state,tail,button);
                attach(tail._moneWaveFilter,tail._meshSprite || tail);
            }
        });
        shift(state,this._carCursorSprite,this._carCursorSprite.x);
        this._textSprites.forEach(function(text) { shift(state,text,text.x-bar.x); });
        // Native fixed-position note effects are siblings of the bar, not children.
        this.children.forEach(function(effect) {
            if (effect._noUpdatePosition && (effect._target === bar || this._buttonSprites.indexOf(effect._target) >= 0))
                shift(state,effect,effect.x-bar.x);
        },this);
    };
    var terminate = Scene_NewBattle.prototype.terminate;
    Scene_NewBattle.prototype.terminate = function() {
        clearWave(this);
        return terminate.apply(this,arguments);
    };
})();
