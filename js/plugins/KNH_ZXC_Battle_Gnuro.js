//=============================================================================
// KNH_ZXC_Battle_Gnuro.js
//=============================================================================
/*:
 * @plugindesc Gnuro boss: troop-authored dialogue, broken rhythm bar and stomps.
 * @author Codex
 * @help
 * Load after KNH_ZXC_Battle and KNH_ZXC_Battle_Yume.
 * Enemy note: <gnuro>. The normal battler scale is preserved.
 * Skill notes: <gnuroMinPhase:1>, <gnuroMaxPhase:1>.
 * Troop page comment: <GnuroGate:phase,minimumRounds>.
 * Standard troop conditions and Battle span still control HP and one-shot pages.
 * Phases: 0 normal, 1 broken, 3 stomps, 4 final (2 is unused).
 * All cutscene timing and dialogue belong in the troop event, not this plugin.
 *
 * Event script API (SceneManager._scene):
 *   beginGnuroEvent(); this.setWaitMode('gnuroIdle');
 *   gnuroSpeaker('enemy'|'mii'|'yume'); clearGnuroSpeaker();
 *   mii and yume always resolve actor IDs 3 and 4, never the party leader.
 *   gnuroAimAtBar(jumpFrames,jumpHeight,extraY);
 *   gnuroHoldAxe(true|false); // Hold the last swing cell with normal yurayura.
 *   breakGnuroBar(depthPixels,settleFrames,liftPixels);
 *   restoreGnuroBar(settleFrames); this.setWaitMode('gnuroBar');
 *   gnuroStompImpact(enemySprite,side);
 *   setGnuroAttackPhase(0|1|2);
 *   endGnuroEvent(nextPhase);
 * Skill animation command: gnuroStomp:-1 (or 1). No effect in timing probes.
 * Only the bar artwork is cut. Buttons, holds and cursor/combo stay whole.
 * Input timing and the original bar dimensions remain unchanged.
 */
(function() {
    'use strict';

    var NS = window.KNH_ZXC_Battle_Gnuro = {};

    NS.bendPoint = function(x, y, width, depth, gap, height) {
        var half = Math.max(1, width / 2), centerY = (height === undefined ? 72 : height) / 2;
        var sine = Math.max(-0.95, Math.min(0.95, depth / half)), cosine = Math.sqrt(1 - sine * sine);
        var side = x < half ? -1 : 1, dx = x - half, dy = y - centerY;
        return {x: half + side * gap / 2 + cosine * dx + side * sine * dy,
            y: centerY + depth - side * sine * dx + cosine * dy};
    };

    // The cutting edge in the last attack2 cell of battler 018 (200 px cells).
    // Use the actual anchor and scale; the visible yurayura mesh uses this frame.
    NS.axeBladeOffset = function(sprite) {
        var size = sprite._frameSize;
        return {x: size * (0.1625 - sprite.anchor.x) * sprite.scale.x,
            y: size * (0.87 - sprite.anchor.y) * sprite.scale.y};
    };

    function gnuroEnemy(scene) {
        return scene && scene._enemySprites && scene._enemySprites.filter(function(sp) {
            return sp._battler.enemy().meta.gnuro;
        })[0];
    }

    function activeScene() {
        var scene = SceneManager._scene;
        return scene && scene._gnuro ? scene : null;
    }

    var _create = Scene_NewBattle.prototype.createDisplayObjects;
    Scene_NewBattle.prototype.createDisplayObjects = function() {
        _create.apply(this, arguments);
        var enemy = gnuroEnemy(this);
        if (enemy) {
            this._gnuro = {phase: 0, attackPhase: 0, sinceTurn: 0, eventRunning: false,
                depth: 0, gap: 0, age: 0, duration: 0, targetDepth: 0, shakeAge: 99,
                baseBarY: this._barSprite.y, lift: 50, speaker: null,
                fromDepth: 0, fromGap: 0, fromLift: 0, targetGap: 7, wobble: 12};
        }
    };

    var _meetsConditions = Game_Troop.prototype.meetsConditions;
    Game_Troop.prototype.meetsConditions = function(page) {
        if (!_meetsConditions.apply(this, arguments)) return false;
        var scene = activeScene();
        if (!scene) return true;
        var gate = page.list.filter(function(c) { return c.code === 108 || c.code === 408; })
            .map(function(c) { return c.parameters[0]; }).join('\n').match(/<GnuroGate:(\d+),(\d+)>/i);
        if (!gate) return true;
        var state = scene._gnuro;
        return !!gnuroEnemy(scene)._battler.isAlive() && !scene._inFinish && !state.eventRunning &&
            state.phase === Number(gate[1]) && scene._turn - state.sinceTurn >= Number(gate[2]);
    };

    Scene_NewBattle.prototype.beginGnuroEvent = function() {
        if (!this._gnuro) return;
        this._gnuro.eventRunning = true;
        // A hold ending at the bar boundary must not keep waitRelease alive in dialogue.
        this._buttonSprites.forEach(function(bs) { bs._pressing = false; });
        this._forceSkip = true;
    };

    var _updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'gnuroBar') {
            var barScene = activeScene();
            var moving = barScene && barScene._gnuro.age < barScene._gnuro.duration;
            if (!moving) this._waitMode = '';
            return !!moving;
        }
        if (this._waitMode === 'gnuroIdle') {
            var scene = activeScene();
            var busy = scene && scene._actorSprites.concat(scene._enemySprites).some(function(sp) {
                return sp._actions.length || sp._movementDuration > 0;
            });
            if (!busy) this._waitMode = '';
            return !!busy;
        }
        return _updateWaitMode.apply(this, arguments);
    };

    Scene_NewBattle.prototype.gnuroSpeakerSprite = function(who) {
        if (who === 'enemy') return gnuroEnemy(this);
        var actorId = who === 'mii' ? 3 : who === 'yume' ? 4 : 0;
        return this._actorSprites.filter(function(sprite) {
            return actorId && sprite._battler.actorId() === actorId;
        })[0];
    };

    Scene_NewBattle.prototype.gnuroSpeaker = function(who) {
        if (!gnuroEnemy(this)) return false;
        var sp = this.gnuroSpeakerSprite(who);
        if (!sp) {
            this.clearGnuroSpeaker();
            return false;
        }
        $gameSystem.clearMessagePopup();
        $gameSystem.clearMessagePopupFree();
        $gameMessage._fukidashi = true;
        $gameMessage._tailDir = who === 'enemy' ? 9 : 7;
        $gameVariables.setValue(14, 0);
        $gameSystem.setMessagePopupFree(sp.x, Math.max(130, sp.y - (who === 'enemy' ? 110 : 72)));
        this._gnuro.speaker = who;
        return true;
    };

    // Free popup placement has no character target. Supply the battle speaker so
    // the existing hand-drawn tail aims at that character instead of a fixed corner.
    if (typeof Window_Base !== 'undefined' && Window_Base.prototype._popupTailCharacterCenterToBmp) {
        var _tailTarget = Window_Base.prototype._popupTailCharacterCenterToBmp;
        Window_Base.prototype._popupTailCharacterCenterToBmp = function(bmp) {
            var scene = activeScene();
            var sp = scene && this === scene._messageWindow && scene.gnuroSpeakerSprite(scene._gnuro.speaker);
            if (!sp) return _tailTarget.apply(this, arguments);
            var headY = sp.y - sp._frameSize * Math.abs(sp.scale.y) * 0.42;
            return this._fukidashiGlobalToBmpPos(bmp, sp.x, headY);
        };
    }

    Scene_NewBattle.prototype.clearGnuroSpeaker = function() {
        if (this._gnuro) this._gnuro.speaker = null;
        $gameSystem.clearMessagePopupFree();
        $gameSystem.clearMessagePopup();
        $gameMessage._fukidashi = false;
        $gameMessage._tailDir = 5;
        $gameVariables.setValue(14, 0);
    };

    Scene_NewBattle.prototype.setGnuroAttackPhase = function(phase) {
        if (this._gnuro) this._gnuro.attackPhase = Math.max(0, Math.min(2, Number(phase) || 0));
    };

    Scene_NewBattle.prototype.endGnuroEvent = function(phase) {
        if (!this._gnuro) return;
        var state = this._gnuro;
        state.phase = Number(phase) || 0;
        state.sinceTurn = this._turn;
        state.eventRunning = false;
        this.clearGnuroSpeaker();
        // setData normally schedules the NEXT round. A cutscene resumes this round.
        this.setData();
        this._enemySprites.forEach(function(sp) {
            sp._turnActions.forEach(function(action) { action.turn = this._turn; }, this);
        }, this);
        this._forceSkip = true;
    };

    var _isActionValid = Game_Enemy.prototype.isActionValid;
    Game_Enemy.prototype.isActionValid = function(action) {
        if (!_isActionValid.apply(this, arguments)) return false;
        if (!this.enemy().meta.gnuro) return true;
        var scene = activeScene();
        var phase = scene ? scene._gnuro.attackPhase : 0;
        var meta = $dataSkills[action.skillId].meta;
        return (meta.gnuroMinPhase === undefined || phase >= Number(meta.gnuroMinPhase)) &&
            (meta.gnuroMaxPhase === undefined || phase <= Number(meta.gnuroMaxPhase));
    };

    Scene_NewBattle.prototype.gnuroAimAtBar = function(frames, height, extraY) {
        var sp = gnuroEnemy(this), bar = this._barSprite;
        if (!sp) return;
        var blade = NS.axeBladeOffset(sp), contact = this.gnuroBarContactPoint();
        var animation = $dataAnimations[24];
        ImageManager.loadAnimation(animation.animation1Name, animation.animation1Hue);
        sp.setAnimation('', true);
        sp.startJump(contact.x - blade.x - sp._homeX,
            contact.y - blade.y + (Number(extraY) || 0) - sp._homeY,
            Math.max(1, Number(frames) || 24),
            height === undefined ? 64 : Math.max(0, Number(height) || 0));
    };

    Scene_NewBattle.prototype.gnuroBarContactPoint = function() {
        var bar = this._barSprite;
        return {x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 + this._gnuro.depth};
    };

    Scene_NewBattle.prototype.gnuroHoldAxe = function(hold) {
        var sp = gnuroEnemy(this);
        if (sp) sp._gnuroAxeHold = hold ? Math.max(0, sp._animationFrames - 1) : null;
        if (hold) this.syncGnuroAxeContact();
    };

    Scene_NewBattle.prototype.syncGnuroAxeContact = function() {
        var sp = gnuroEnemy(this);
        if (!sp || sp._gnuroAxeHold == null || sp._movementDuration) return;
        var contact = this.gnuroBarContactPoint(), blade = NS.axeBladeOffset(sp);
        var dx = contact.x - (sp.x + blade.x), dy = contact.y - (sp.y + blade.y);
        sp._offsetX += dx; sp._offsetY += dy;
        sp._targetOffsetX = sp._offsetX; sp._targetOffsetY = sp._offsetY;
        sp.x += dx; sp.y += dy;
    };

    var _enemyFrame = Sprite_NewEnemy.prototype.updateFrame;
    Sprite_NewEnemy.prototype.updateFrame = function() {
        if (this._gnuroAxeHold !== undefined && this._gnuroAxeHold !== null) {
            this._animationIndex = this._gnuroAxeHold;
            this.setFrame(this._animationIndex * this._frameSize,
                (this._animationType % 10) * this._frameSize, this._frameSize, this._frameSize);
            this._yuraInfo = [];
            return;
        }
        return _enemyFrame.apply(this, arguments);
    };

    function setBarArtwork(bar, bitmap) {
        if (!bitmap) return;
        if (bar._baseBitmap) bar._baseBitmap = bitmap;
        else bar.bitmap = bitmap;
        bar._lastFrame = null;
    }

    function prepareCutBar(bar, state) {
        if (state.cutBarBitmap) return setBarArtwork(bar, state.cutBarBitmap);
        var source = bar._baseBitmap || bar.bitmap;
        if (!source) return;
        state.wholeBarBitmap = source;
        source.addLoadListener(function() {
            var bitmap = new Bitmap(source.width, source.height), half = Math.floor(source.width / 2);
            bitmap.blt(source, 0, 0, source.width, source.height, 0, 0);
            // Remove only the central beat tick, which otherwise becomes two spikes.
            bitmap.clearRect(half - 8, 0, 16, source.height);
            bitmap.blt(source, half - 24, 0, 16, source.height, half - 8, 0);
            state.cutBarBitmap = bitmap;
            setBarArtwork(bar, bitmap);
        });
    }

    var fragment = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'uniform sampler2D uSampler;',
        'uniform vec4 filterArea;',
        'uniform vec4 filterClamp;',
        'uniform vec4 barFrame;',
        'uniform float barWidth;',
        'uniform float barHeight;',
        'uniform float depth;',
        'uniform float gap;',
        'vec4 halfColor(vec2 p,float side){',
        'float halfWidth=max(1.0,barWidth*0.5),centerY=barHeight*0.5;',
        'float sn=clamp(depth/halfWidth,-0.95,0.95),cs=sqrt(1.0-sn*sn);',
        'vec2 d=p-vec2(halfWidth+side*gap*0.5,centerY+depth);',
        'vec2 source=vec2(halfWidth+cs*d.x-side*sn*d.y,centerY+side*sn*d.x+cs*d.y);',
        // One small, stable notch instead of a noisy, screen-aligned cut.
        'float t=clamp((source.y-centerY+12.0)/24.0,0.0,1.0);',
        'float notch=t<0.5?mix(-0.8,1.8,t*2.0):mix(1.8,-0.8,(t-0.5)*2.0);',
        'float inside=side*(source.x-halfWidth-notch);',
        'if(inside<0.0)return vec4(0.0);',
        'vec2 uv=(source*barFrame.zw+barFrame.xy-filterArea.zw)/filterArea.xy;',
        'if(uv.x<filterClamp.x||uv.y<filterClamp.y||uv.x>filterClamp.z||uv.y>filterClamp.w)return vec4(0.0);',
        'vec4 color=texture2D(uSampler,uv);',
        'if(gap>0.01&&inside<2.0&&abs(source.y-centerY)<11.5)color=vec4(71.0/255.0,78.0/255.0,81.0/255.0,1.0);',
        'return color;',
        '}',
        'void main(void){',
        'vec2 screen=vTextureCoord*filterArea.xy+filterArea.zw;',
        'vec2 p=(screen-barFrame.xy)/barFrame.zw;',
        'vec4 left=halfColor(p,-1.0),right=halfColor(p,1.0);',
        'gl_FragColor=left+right*(1.0-left.a);',
        '}'
    ].join('\n');

    Scene_NewBattle.prototype.breakGnuroBar = function(depth, frames, lift) {
        if (!this._gnuro) return;
        var state = this._gnuro, bar = this._barSprite;
        state.fromDepth = state.depth;
        state.fromGap = state.gap;
        state.fromLift = state.baseBarY - bar.y;
        state.targetDepth = Math.max(0, Math.min(bar.width * 0.475, Number(depth) || 90));
        state.targetGap = 7;
        state.wobble = 12;
        state.restoring = false;
        state.duration = Math.max(1, Number(frames) || 50);
        state.lift = lift === undefined ? 50 : Math.max(0, Math.min(bar.width / 2, Number(lift) || 0));
        state.age = 0;
        prepareCutBar(bar, state);
        var contact = this.gnuroBarContactPoint();
        var debris = this.playAnimation($dataAnimations[24], contact.x, contact.y);
        debris.scale.x = debris.scale.y = 0.75;
        if (!state.filter) {
            var filter = state.filter = new PIXI.Filter(PIXI.Filter.defaultVertexSrc, fragment,
                {barFrame: [0, 0, 1, 1], barWidth: 720, barHeight: 72, depth: 0, gap: 0});
            filter.apply = function(manager, input, output, clear, currentState) {
                var transform = bar.worldTransform;
                this.uniforms.barFrame = [transform.tx, transform.ty, transform.a, transform.d];
                this.uniforms.barWidth = bar.width;
                this.uniforms.barHeight = bar.height;
                this.uniforms.depth = state.depth;
                this.uniforms.gap = state.gap;
                manager.applyFilter(this, input, output, clear, currentState);
            };
            this.syncGnuroBarFilter();
        }
        state.filter.padding = Math.ceil(Math.max(144, state.targetDepth + 80));
        $gameSystem.playSe('Earth1', 90, 110);
        $gameSystem.playSe('Break', 80, 80);
        $gameScreen.startShake(4, 4, 16);
    };

    Scene_NewBattle.prototype.restoreGnuroBar = function(frames) {
        if (!this._gnuro) return;
        var state = this._gnuro;
        state.fromDepth = state.depth;
        state.fromGap = state.gap;
        state.fromLift = state.baseBarY - this._barSprite.y;
        state.targetDepth = state.targetGap = state.lift = state.wobble = 0;
        state.duration = Math.max(1, Number(frames) || 120);
        state.age = 0;
        state.shakeAge = 99;
        state.restoring = true;
    };

    Scene_NewBattle.prototype.gnuroStompImpact = function(sp, side) {
        if (!sp || !this._gnuro) return;
        var foot = sp._frameSize * Math.abs(sp.scale.x) * 0.11;
        var smoke = this.playAnimation($dataAnimations[25], sp.x + (Number(side) || -1) * foot, sp.y);
        smoke.scale.x = smoke.scale.y = 0.7;
        $gameSystem.playSe('Earth3', 85, 80);
        $gameScreen.startShake(2, 4, 12);
        this._gnuro.shakeAge = 0;
    };

    var _extraCommand = Sprite_NewEnemy.prototype.processExtraActionCommand;
    Sprite_NewEnemy.prototype.processExtraActionCommand = function(name, args, action, isLast) {
        if (name === 'gnuroStomp') {
            if (!action.test && activeScene()) activeScene().gnuroStompImpact(this, args[0]);
        } else if (_extraCommand) _extraCommand.apply(this, arguments);
    };

    Scene_NewBattle.prototype.gnuroBarPoint = function(x, y) {
        var state = this._gnuro;
        return state ? NS.bendPoint(x, y, this._barSprite.width, state.depth, state.gap, this._barSprite.height) : {x:x, y:y};
    };

    Scene_NewBattle.prototype.syncGnuroBarFilter = function() {
        var state = this._gnuro, art = this._barSprite._meshSprite;
        if (!state || !state.filter || !art || state.filterTarget === art) return;
        if (state.filterTarget) state.filterTarget.filters = (state.filterTarget.filters || [])
            .filter(function(filter) { return filter !== state.filter; });
        art.filters = (art.filters || []).concat([state.filter]);
        state.filterTarget = art;
    };

    Scene_NewBattle.prototype.positionGnuroBarUi = function(child) {
        if (!child) return;
        var state = this._gnuro, bar = this._barSprite;
        if (!state.removeBarChild) {
            state.removeBarChild = bar.removeChild;
            // Native refresh/death paths remove buttons from the logical bar.
            bar.removeChild = function(sprite) {
                var wrapper = sprite && sprite._gnuroBarWrapper;
                if (wrapper && sprite.parent === wrapper && wrapper.parent === this) {
                    wrapper.removeChild(sprite);
                    if (!wrapper.children.length) state.removeBarChild.call(this, wrapper);
                    return sprite;
                }
                return state.removeBarChild.apply(this, arguments);
            };
        }
        var wrapper = child._gnuroBarWrapper;
        if (!wrapper) wrapper = child._gnuroBarWrapper = new Sprite();
        if (wrapper.parent !== bar) bar.addChild(wrapper);
        if (child.parent !== wrapper) wrapper.addChild(child);
        // Keep native x/y and parent-dependent effects in logical bar coordinates.
        // The wrapper rotates the entire UI object, including its tails and text.
        var point = this.gnuroBarPoint(child.x, child.y);
        var angle = Math.asin(Math.max(-0.95, Math.min(0.95, state.depth / Math.max(1, bar.width / 2))));
        if (child.x >= bar.width / 2) angle = -angle;
        var cosine = Math.cos(angle), sine = Math.sin(angle);
        wrapper.rotation = angle;
        wrapper.x = point.x - cosine * child.x + sine * child.y;
        wrapper.y = point.y - sine * child.x - cosine * child.y;
        bar.addChild(wrapper);
    };

    var _updateBar = Scene_NewBattle.prototype.updateBar;
    Scene_NewBattle.prototype.updateBar = function() {
        var state = this._gnuro;
        if (state) {
            state.shakeAge++;
            if (state.duration) {
                var t = Math.min(1, ++state.age / state.duration);
                var fall = 1 - Math.pow(1 - t, 3);
                state.depth = state.fromDepth + (state.targetDepth - state.fromDepth) * fall +
                    Math.sin(t * Math.PI * 5) * (1 - t) * state.wobble;
                state.gap = state.fromGap + (state.targetGap - state.fromGap) * fall;
                // Leave space for the status windows below the broken bar.
                this._barSprite.y = state.baseBarY - (state.fromLift + (state.lift - state.fromLift) * fall);
                if (t === 1 && state.restoring) {
                    setBarArtwork(this._barSprite, state.wholeBarBitmap);
                    state.restoring = false;
                }
            }
            if (state.shakeAge < 12 && state.duration)
                state.depth += Math.sin(state.shakeAge * 2) * (12 - state.shakeAge) * 0.2;
        }
        _updateBar.apply(this, arguments);
        if (!state || !state.duration) return;
        this.syncGnuroAxeContact();
        this.syncGnuroBarFilter();
        this._buttonSprites.forEach(this.positionGnuroBarUi, this);
        this.positionGnuroBarUi(this._carCursorSprite);
        // Bar-owned scene effects use native coordinates; map their anchor once.
        this.children.forEach(function(child) {
            if (child._target !== this._barSprite || child._gnuroMapped || !child._noUpdatePosition) return;
            var point = this.gnuroBarPoint(child.x - this._barSprite.x, child.y - this._barSprite.y);
            child.x = this._barSprite.x + point.x;
            child.y = this._barSprite.y + point.y;
            child._gnuroMapped = true;
        }, this);
    };

    var _showJudge = Scene_NewBattle.prototype.showJudgeResult;
    Scene_NewBattle.prototype.showJudgeResult = function() {
        var before = this._textSprites.length;
        _showJudge.apply(this, arguments);
        if (!this._gnuro || !this._gnuro.duration) return;
        for (var i = before; i < this._textSprites.length; i++) {
            var text = this._textSprites[i], bar = this._barSprite;
            var point = this.gnuroBarPoint(text.x - bar.x, text.y - bar.y);
            text.x = bar.x + point.x;
            text.y = bar.y + point.y;
        }
    };

    var _terminate = Scene_NewBattle.prototype.terminate;
    Scene_NewBattle.prototype.terminate = function() {
        if (this._gnuro) {
            this.clearGnuroSpeaker();
            var filter = this._gnuro.filter;
            if (filter) {
                var target = this._gnuro.filterTarget;
                if (target) target.filters = (target.filters || []).filter(function(f) { return f !== filter; });
                // The project's Pixi 4 Filter does not expose destroy().
                if (filter.destroy) filter.destroy();
            }
            if (this._gnuro.removeBarChild) this._barSprite.removeChild = this._gnuro.removeBarChild;
            this._gnuro = null;
        }
        _terminate.apply(this, arguments);
    };
})();
