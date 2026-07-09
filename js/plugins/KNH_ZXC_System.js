//=============================================================================
// KNH_ZXC_System.js
//=============================================================================

const { SocketAddress } = require('net');

/*:
 * @plugindesc ZXCシステム
 * @author kagaya
 *
 * @help
 */

const version = 'v0.2-demo';

const ZXC = function() {
    return $gameSystem.ZXC();
};

//言語取得　0：日本語 1：英語 2：韓国語 3：中国語
Object.defineProperty(window, '_lg', {
    get: function () {
        const normalizeLang = function(v) {
            const n = Number(v);
            if (!Number.isFinite(n)) return null;
            if (n < 0) return 0;
            return Math.floor(n);
        };

        // 互換維持: debug.language が 0 以外のときのみ最優先
        try {
            if (window._debug && typeof window._debug.get === 'function') {
                const debugLang = normalizeLang(window._debug.get('language'));
                if (debugLang != null) return debugLang;
            }
        } catch (e) {
            // noop
        }

        // オプション画面では、変更直後の Config 言語を最優先で返す
        // （$gameVariables 側は保存時反映なので、即時表示切替のため）
        try {
            const inOptions =
                typeof Scene_Options !== 'undefined' &&
                typeof SceneManager !== 'undefined' &&
                SceneManager &&
                SceneManager._scene instanceof Scene_Options;
            if (inOptions && typeof ConfigManager !== 'undefined' && ConfigManager) {
                const optionConfigLang = normalizeLang(ConfigManager.String0);
                if (optionConfigLang != null) return optionConfigLang;
            }
        } catch (e) {
            // noop
        }

        try {
            if (typeof $gameVariables !== 'undefined' && $gameVariables && typeof $gameVariables.value === 'function') {
                const gameVarLang = normalizeLang($gameVariables.value(31));
                if (gameVarLang != null) return gameVarLang;
            }
        } catch (e) {
            // noop
        }

        // タイトルなど $gameVariables 未生成時は Config 側から補完
        try {
            if (typeof ConfigManager !== 'undefined' && ConfigManager) {
                const configLang = normalizeLang(ConfigManager.String0);
                if (configLang != null) return configLang;
            }
        } catch (e) {
            // noop
        }

        return 0;
    },
    configurable: true
});
//翻訳テーブルから翻訳を取得
function _isTestPlayLogEnabled() {
    try {
        if (typeof Utils !== 'undefined' && typeof Utils.isOptionValid === 'function') {
            return !!Utils.isOptionValid('test');
        }
    } catch (e) {
        // noop
    }
    try {
        return !!($gameTemp && typeof $gameTemp.isPlaytest === 'function' && $gameTemp.isPlaytest());
    } catch (e) {
        return false;
    }
}
function _tl(text) {
    if (_lg === 0) return text; // 日本語ならそのまま
    const table = window.TRANSLATION_DATA;
    if (table && table[text] && table[text][_lg]) {
        return table[text][_lg];
    } else {
        if (_isTestPlayLogEnabled()) console.warn(`Translation for "${text}" not found (language: ${_lg})`);
    }
    return text; // 翻訳がないときも日本語で返す
};

function Sprite_Yurayura() {
    this.initialize.apply(this, arguments);
};

const _outlineFilter = new PIXI.Filter(
    `attribute vec2 aVertexPosition; attribute vec2 aTextureCoord; uniform mat3 projectionMatrix; varying vec2 vTextureCoord; void main(void){ gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); vTextureCoord = aTextureCoord; }`,
    `precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform vec2 pixelSize; uniform float blackScale; uniform float whiteScale; void main(void){ float alpha = texture2D(uSampler, vTextureCoord).a; float whiteOutline = 0.0; for (float x = -2.0; x <= 2.0; x += 1.0) { for (float y = -2.0; y <= 2.0; y += 1.0) { if (x != 0.0 || y != 0.0) { vec2 offset = vec2(x, y) * pixelSize * whiteScale; whiteOutline = max(whiteOutline, texture2D(uSampler, vTextureCoord + offset).a); } } } float blackOutline = 0.0; for (float x = -1.0; x <= 1.0; x += 1.0) { for (float y = -1.0; y <= 1.0; y += 1.0) { if (x != 0.0 || y != 0.0) { vec2 offset = vec2(x, y) * pixelSize * blackScale; blackOutline = max(blackOutline, texture2D(uSampler, vTextureCoord + offset).a); } } } if (alpha > 0.01) { gl_FragColor = texture2D(uSampler, vTextureCoord); } else if (blackOutline > 0.01) { gl_FragColor = vec4(0.2784, 0.3059, 0.3176, 1.0); } else if (whiteOutline > 0.01) { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); } else { gl_FragColor = vec4(0.0); } }`,
        {
            pixelSize: [1 / 64, 1 / 64],
                blackScale: 2.0,
                    whiteScale: 4.0
        }
);
const _outlineVertexSrc = `attribute vec2 aVertexPosition; attribute vec2 aTextureCoord; uniform mat3 projectionMatrix; varying vec2 vTextureCoord; void main(void){ gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); vTextureCoord = aTextureCoord; }`;
const _outlineFragmentSrc = `precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform vec2 pixelSize; uniform float blackScale; uniform float whiteScale; void main(void){ float alpha = texture2D(uSampler, vTextureCoord).a; float whiteOutline = 0.0; for (float x = -2.0; x <= 2.0; x += 1.0) { for (float y = -2.0; y <= 2.0; y += 1.0) { if (x != 0.0 || y != 0.0) { vec2 offset = vec2(x, y) * pixelSize * whiteScale; whiteOutline = max(whiteOutline, texture2D(uSampler, vTextureCoord + offset).a); } } } float blackOutline = 0.0; for (float x = -1.0; x <= 1.0; x += 1.0) { for (float y = -1.0; y <= 1.0; y += 1.0) { if (x != 0.0 || y != 0.0) { vec2 offset = vec2(x, y) * pixelSize * blackScale; blackOutline = max(blackOutline, texture2D(uSampler, vTextureCoord + offset).a); } } } if (alpha > 0.01) { gl_FragColor = texture2D(uSampler, vTextureCoord); } else if (blackOutline > 0.01) { gl_FragColor = vec4(0.2784, 0.3059, 0.3176, 1.0); } else if (whiteOutline > 0.01) { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); } else { gl_FragColor = vec4(0.0); } }`;
const _createOutlineFilter = function(w, h, bw, ww) {
    var f = new PIXI.Filter(_outlineVertexSrc, _outlineFragmentSrc, {
        pixelSize: [1 / 64, 1 / 64],
        blackScale: 2.0,
        whiteScale: 4.0
    });
    f.uniforms.pixelSize = [1 / w, 1 / h];
    f.uniforms.blackScale = bw;
    f.uniforms.whiteScale = ww;
    return f;
};


(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_System';
    
    var getNumber = function(text, max, min) {
        text = applyCharacters(text);
        if (isNaN(text)) return NaN;
        return Math.max(Math.min(Number(text), max || Infinity), min || -Infinity);
    };
    
    var applyCharacters = function(text) {
        if (text === null) text = '';
        text = '' + text;
        text = text.replace(/\\/g, '\x1b');
        text = text.replace(/\x1b\x1b/g, '\\');
        text = text.replace(/\x1bV\[(\d+)\]/gi, function() {
            return $gameVariables.value(parseInt(arguments[1], 10));
        }.bind(this));
        text = text.replace(/\x1bV\[(\d+)\]/gi, function() {
            return $gameVariables.value(parseInt(arguments[1], 10));
        }.bind(this));
        text = text.replace(/\x1bN\[(\d+)\]/gi, function() {
            var actor = parseInt(arguments[1], 10) >= 1 ? $gameActors.actor(parseInt(arguments[1], 10)) : null;
            return actor ? actor.name() : '';
        }.bind(this));
        text = text.replace(/\x1bP\[(\d+)\]/gi, function() {
            var actor = parseInt(arguments[1], 10) >= 1 ? $gameParty.members()[parseInt(arguments[1], 10) - 1] : null;
            return actor ? actor.name() : '';
        }.bind(this));
        if ($dataSystem) text = text.replace(/\x1bG/gi, TextManager.currencyUnit);
        return text;
    };
    
    var getMeta = function(text, str) {
        var re = /<([^<>:]+)(:?)([^>]*)>/g;
        var meta = {};
        for (;;) {
            var match = re.exec(text);
            if (match) {
                if (match[2] === ':') {
                    meta[match[1]] = match[3];
                } else {
                    meta[match[1]] = true;
                }
            } else {
                break;
            }
        }
        return meta['' + str];
    };

    //-----------------------------------------------------------------------------
    // Scene_Boot
    //-----------------------------------------------------------------------------

    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function () {
        _Scene_Boot_start.apply(this, arguments);
        if (_debug.get('recordMode')) SceneManager.executeDevCommand108();
    };
    
    //-----------------------------------------------------------------------------
    // Game_System
    //-----------------------------------------------------------------------------
    
    Game_System.prototype.ZXC = function() {
        if (!this._ZXC) {
            this._ZXC = {
                pagePosition : -1,
                husenId      : 1,
                husenColors  : [],
            }
        }
        return this._ZXC;
    };

    Game_System.prototype.animationWait = function() {
        if (!$gameParty.inBattle()) return 10;
        var BPM = 182;
        if (SceneManager._scene._bgmName === '00_New_Battle1') BPM = 94 * 2;
        if (SceneManager._scene._bgmName === '00_New_Battle1_New') BPM = 182;
        if (SceneManager._scene._bgmName === '00_New_Battle2') BPM = 138;
        if (SceneManager._scene._bgmName === '00_New_Battle4') BPM = 161;
        if (SceneManager._scene._bgmName === '00_New_Battle5') BPM = 151;
        return 1800 / BPM;
    };

    Game_System.prototype.getRealTimeFrame60 = function () { // ★
        return Math.floor(performance.now() / 1000 * 60);
    };

    Game_System.prototype.sceneCount = function () {
        if (!$gameParty.inBattle() || SceneManager._scene instanceof Scene_SkillEditor) {
            if (SceneManager._scene && SceneManager._scene._simMode) return SceneManager._scene._simCount;
            return this.getRealTimeFrame60(); // ★
        }
        var count = this.getCurrentBgmFrame();
        if (!count && count < SceneManager._scene._lastSceneCount)
            count = SceneManager._scene._lastSceneCount + (this.getRealTimeFrame60() - SceneManager._scene._lastGFCount);
        else SceneManager._scene._lastSceneCount = count, SceneManager._scene._lastGFCount = this.getRealTimeFrame60();
        return count;
        
    };

    //-----------------------------------------------------------------------------
    // Game_Battler
    //-----------------------------------------------------------------------------

    //特定のmetaを含むか(traitsを参照　防具のmetaも適用)
    Game_Battler.prototype.metaState = function (metaName, traitObjects) {
        var _object = null;
        (traitObjects || this.traitObjects()).forEach(function (object) {
            if (object.meta[metaName]) _object = object;
        })
        return _object;
    };
    //特定のmetaの合計を取得　true→1に換算
    // type 0:足し算 1:掛け算 2:リスト
    Game_Battler.prototype.metaStateValue = function (metaName, type, traitObjects) {
        type = type || 0;
        var value = [0, 1, []][type];
        (traitObjects || this.traitObjects()).forEach(function (object) {
            if (!object.meta[metaName]) return;
            var n = ($dataStates.contains(object) ? this._stateTurns[object.id] : 0) || 0;
            var a = Number(object.meta[metaName]);
            if (a || a === 0) {
                if (type === 0) value += a;
                else if (type === 1) value *= a;
            }
            if (type === 2) value.push(object.meta[metaName][object.meta[metaName].length - 1]);
        }, this)
        return value;
    };

    //-----------------------------------------------------------------------------
    // Game_Actor
    //-----------------------------------------------------------------------------

    const _Game_Actor_initialize = Game_Actor.prototype.initialize;
    Game_Actor.prototype.initialize = function (actorId) {
        _Game_Actor_initialize.apply(this, arguments);
        this._skillLevels = [];
        this._skillExps = [];
    };

    //スロット編成
    Game_Actor.prototype.equipSlots = function() {
        var slots = [];
        for (var i = 0; i < 3; i++) slots.push(5);
        return slots;
    };

    //スキルレベル実装
    Game_Actor.prototype.skillLevel = function (skillId) {
        if (!this._skillLevels[skillId]) this._skillLevels[skillId] = 1;
        return this._skillLevels[skillId];
    };
    Game_Actor.prototype.skillExp = function (skillId) {
        if (!this._skillExps[skillId]) this._skillExps[skillId] = 0;
        return this._skillExps[skillId];
    };
    Game_Actor.prototype.expForSkillLevel = function (skillId, level) {
        var sk = $dataSkills[skillId];
        var c = this.currentClass();
        var basis = c.expParams[0], extra = c.expParams[1], acc_a = c.expParams[2], acc_b = c.expParams[3];
        var value = Math.round(basis * (Math.pow(level - 1, 0.9 + acc_a / 250)) * level *
            (level + 1) / (6 + Math.pow(level, 2) / 50 / acc_b) + (level - 1) * extra);
        value = Math.ceil(value * (Number(sk.meta.expRate) || 1));
        return value;
    };
    Game_Actor.prototype.currentSkillLevelExp = function (skillId) {
        return this.expForSkillLevel(skillId, this.skillLevel(skillId));
    };
    Game_Actor.prototype.nextSkillLevelExp = function (skillId) {
        return this.expForSkillLevel(skillId, this.skillLevel(skillId) + 1);
    };
    Game_Actor.prototype.maxSkillLevel = function (skillId) {
        return 10;
    };
    Game_Actor.prototype.changeSkillExp = function (skillId, exp, show) {
        this._skillExps[skillId] = Math.max(exp, 0);
        var lastLevel = this.skillLevel(skillId);
        while (this._skillLevels[skillId] < this.maxSkillLevel(skillId) &&
            this.skillExp(skillId) >= this.nextSkillLevelExp(skillId)) {
            this._skillLevels[skillId]++;
        }
        while (this.skillExp(skillId) < this.currentSkillLevelExp(skillId)) {
            this._skillLevels[skillId]--;
        }
        if (show && this._skillLevels[skillId] > lastLevel) {
            this.displaySkillLevelUp(skillId, lastLevel);
        }
    };
    Game_Actor.prototype.displaySkillLevelUp = function (skillId, lastLv) {
        $gameTemp._skLvUpInfos = $gameTemp._skLvUpInfos || [];
        var info = {
            actor: this, skillId: skillId, lv: this.skillLevel(skillId), lastLv: lastLv
        };
        $gameTemp._skLvUpInfos.push(info);
    };
    Game_Actor.prototype.gainSkillExp = function (skillId, exp) {
        var newExp = this.skillExp(skillId) + Math.round(exp);
        this.changeSkillExp(skillId, newExp, this.shouldDisplayLevelUp());
    };

    //-----------------------------------------------------------------------------
    // Game_Party
    //-----------------------------------------------------------------------------

    //ゆめちゃん非メンバー扱い（歩行には参加）
    var ACTOR_ID = 4;
    var SWITCH_ID = 34;
    var _Game_Party_battleMembers = Game_Party.prototype.battleMembers;
    Game_Party.prototype.battleMembers = function () {
        var members = _Game_Party_battleMembers.apply(this, arguments);
        if ($gameSwitches.value(SWITCH_ID)) {
            members = members.filter(function (actor) {
                return actor && actor.actorId() !== ACTOR_ID;
            });
        }
        return members;
    };
    var _Game_Party_members = Game_Party.prototype.members;
    Game_Party.prototype.members = function () {
        var members = _Game_Party_members.apply(this, arguments);
        if ($gameSwitches.value(SWITCH_ID) && !this.inBattle()) {
            var inMenu = !!SceneManager._scene._sceneInfo;
            if (inMenu) {
                members = members.filter(function (actor) {
                    return actor && actor.actorId() !== ACTOR_ID;
                });
            }
        }
        return members;
    };
    Game_Follower.prototype.actor = function () {
        return $gameParty.members()[this._memberIndex % 2 ? 5 : this._memberIndex / 2];
    };

    //-----------------------------------------------------------------------------
    // Game_CharacterBase
    //-----------------------------------------------------------------------------
    
    //スイッチ1 ONで自律移動拒否
    const _Game_Character_updateRoutineMove = Game_Character.prototype.updateRoutineMove;
    Game_Character.prototype.updateRoutineMove = function () {
        if (!this._moveRouteForcing && $gameSwitches.value(1)) return;
        _Game_Character_updateRoutineMove.apply(this, arguments);
    };

    // CSSRect を行列で分割して再生（order は配列 or 数値指定）
    Game_Character.prototype.command_playCssRectAnimation = function (rows, cols, order, frameWait, loop) {
        var r = Math.max(1, Math.floor(getNumber(rows, Infinity, 1) || 1));
        var c = Math.max(1, Math.floor(getNumber(cols, Infinity, 1) || 1));
        var fw = Math.max(1, Math.floor(getNumber(frameWait, Infinity, 1) || 1));
        var lp = toBoolSpriteSheet_(loop);
        var total = Math.max(1, r * c);
        var seq = normalizeSpriteSheetOrder_(order, total);
        var srcWhole = this.cssRectWholeImageSource ? this.cssRectWholeImageSource() : null;
        if (!srcWhole) srcWhole = this._cssRectAnimSourceRect || null;
        if (!srcWhole || srcWhole.width <= 0 || srcWhole.height <= 0) return false;
        if (srcWhole) {
            this._cssRectAnimSourceRect = {
                x: srcWhole.x,
                y: srcWhole.y,
                width: srcWhole.width,
                height: srcWhole.height
            };
            this._cssRect = {
                x: srcWhole.x,
                y: srcWhole.y,
                width: srcWhole.width,
                height: srcWhole.height
            };
        }
        if (this.startCssRectFrameAnimation) {
            return this.startCssRectFrameAnimation(r, c, seq, fw, lp);
        }
        return false;
    };
    Game_Character.prototype.command_stopCssRectAnimation = function () {
        if (this.endCssRectFrameAnimation) {
            this.endCssRectFrameAnimation(false);
            return true;
        }
        return false;
    };

    function resetCharacterAnimationSync(character) {
        if (!character) return;
        character._animeCountNum = 0;
        character._animeWait = null;
        character._isAnimeFrame = false;
    }

    Game_CharacterBase.prototype.updateAnimation = function () {
        if ($gameSwitches.value(1)) return;
        //足踏みアニメをゆらゆらに合わせる
        this._isAnimeFrame = false;
        this._animeCountNum = Number(this._animeCountNum || 0);
        if (!isFinite(this._animeCountNum)) this._animeCountNum = 0;
        if (this._cssRectFrameAnimation) return this.updateCssRectFrameAnimation();
        if (this._frameAnimation) return this.updateFrameAnimation();
        var stopCount = this._stopCount || 0;
        var isWalkAnimating = this.hasWalkAnime() && (this.isMoving() || stopCount <= 1);
        if (isWalkAnimating || this.hasStepAnime() || !this.isOriginalPattern()) {
            var wait = this.animationWait();
            var sceneCount = $gameSystem.sceneCount();
            var nextFrame = this._animeCountNum * wait + wait - 1;
            if (this._animeWait !== wait || nextFrame > sceneCount + wait) {
                this._animeWait = wait;
                this._animeCountNum = Math.max(0, Math.ceil(sceneCount / wait) - 1);
                nextFrame = this._animeCountNum * wait + wait - 1;
            }
            if (sceneCount >= nextFrame) {
                this.updatePattern();
                this._animeCountNum = Math.ceil(sceneCount / wait);
                this._isAnimeFrame = true;
            }
        }
        //自動でゆらゆらさせる
        if (!this._noYura) {
            if ((!this.isMoving() && this.isOriginalPattern() && this._stopCount > 0) || !this.hasWalkAnime()) {
                if (!this._yurayura && this.sprite()) {
                    this._yurayura = true;
                    this.sprite()._yuraInfo = this._yuraInfo || [20, 15, 10, false];
                }
            } else {
                if (this._yurayura) {
                    this._yurayura = false;
                    this.sprite()._yuraInfo = null;
                }
            }
        }
    };
    Game_CharacterBase.prototype.animationWait = function() {
        var stopCount = this._stopCount || 0;
        if (this.hasWalkAnime() && (this.isMoving() || stopCount <= 1)) return 7;
        return $gameSystem.animationWait();
    };

    //ロード時にアニメカウントリセット
    var _Game_System_onAfterLoad = Game_System.prototype.onAfterLoad;
    Game_System.prototype.onAfterLoad = function () {
        _Game_System_onAfterLoad.apply(this, arguments);
        resetCharacterAnimationSync($gamePlayer);
        $gamePlayer.followers().forEach(resetCharacterAnimationSync);
        $gameMap._events.forEach(e => {
            resetCharacterAnimationSync(e);
        });
    };

    //フレームアニメーションを開始
    Game_CharacterBase.prototype.startFrameAnimation = function(cells, wait, loop) {
        const length   = typeof cells === 'number' ? cells : cells.length;
        cells          = typeof cells === 'number' ? Array.from({ length }, (_, i) => i) : cells.slice(0, length);
        wait           = wait || 6;

        if (this._frameAnimation) this.endFrameAnimation();

        /* 設定 */
        this._frameAnimCells   = cells;
        this._frameAnimWait    = wait;
        this._frameAnimLoop    = !!loop;
        this._frameAnimIndex   = 0;
        this._frameAnimCounter = 0;
        this._frameAnimation   = true;

        this._lastInfoForFA = [this._walkAnime, this._stepAnime, this._directionFix];
        this._walkAnime = this._stepAnime = false;
        this._directionFix = true;
        if (this.sprite()) this.sprite()._yuraInfo = null;
        this._noYura = true, this._yurayura = false;

        this._applyFrameAnim();      // 1コマ目即時反映
    };
    Game_CharacterBase.prototype.startCssRectFrameAnimation = function(rows, cols, sequence, wait, loop) {
        var src = this._cssRectAnimSourceRect;
        if (!src || src.width <= 0 || src.height <= 0) {
            var base = this._cssRect;
            if (!base) return false;
            src = {
                x: Number(base.x || 0),
                y: Number(base.y || 0),
                width: Math.floor(Number(base.width || 0)),
                height: Math.floor(Number(base.height || 0))
            };
        }
        if (src.width <= 0 || src.height <= 0) return false;
        rows = Math.max(1, Math.floor(Number(rows || 1) || 1));
        cols = Math.max(1, Math.floor(Number(cols || 1) || 1));
        wait = Math.max(1, Math.floor(Number(wait || 1) || 1));
        var total = Math.max(1, rows * cols);
        var seq = Array.isArray(sequence) ? sequence.slice(0) : [];
        if (!seq.length) {
            for (var i = 0; i < total; i++) seq.push(i);
        }
        for (var j = 0; j < seq.length; j++) {
            var n = Math.floor(Number(seq[j] || 0) || 0);
            if (!isFinite(n) || n < 0 || n >= total) n = 0;
            seq[j] = n;
        }
        if (!seq.length) seq = [0];

        if (this._cssRectFrameAnimation) this.endCssRectFrameAnimation(false);
        if (this._frameAnimation) this.endFrameAnimation();

        this._cssRectAnimSourceRect = {
            x: src.x, y: src.y, width: src.width, height: src.height
        };
        this._cssRectAnimRows = rows;
        this._cssRectAnimCols = cols;
        this._cssRectAnimSequence = seq;
        this._cssRectAnimWait = wait;
        this._cssRectAnimLoop = !!loop;
        this._cssRectAnimIndex = 0;
        this._cssRectAnimCounter = 0;
        this._cssRectFrameAnimation = true;

        this._lastInfoForCssFA = [this._walkAnime, this._stepAnime, this._directionFix];
        this._walkAnime = this._stepAnime = false;
        this._directionFix = true;
        if (this.sprite()) this.sprite()._yuraInfo = null;
        this._noYura = true;
        this._yurayura = false;

        this._applyCssRectAnimFrame();
        return true;
    };
    Game_CharacterBase.prototype.cssRectWholeImageSource = function() {
        var spr = (this.sprite && typeof this.sprite === 'function') ? this.sprite() : null;
        if (spr && spr.updateBitmap) {
            try { spr.updateBitmap(); } catch (_) {}
        }
        var bmp = spr ? (spr._baseBitmap || spr.bitmap) : null;
        if ((!bmp || !bmp.isReady || !bmp.isReady()) && this._characterName && typeof ImageManager !== 'undefined' && ImageManager && ImageManager.loadCharacter) {
            bmp = ImageManager.loadCharacter(String(this._characterName || ''));
        }
        if (!bmp || !bmp.isReady || !bmp.isReady()) return null;
        var w = Math.floor(Number(bmp.width || 0));
        var h = Math.floor(Number(bmp.height || 0));
        if (w <= 0 || h <= 0) return null;
        return { x: 0, y: 0, width: w, height: h };
    };
    Game_CharacterBase.prototype.updateCssRectFrameAnimation = function() {
        if (!this._cssRectFrameAnimation) return;
        if (++this._cssRectAnimCounter < this._cssRectAnimWait) return;
        this._cssRectAnimCounter = 0;
        this._cssRectAnimIndex++;
        if (this._cssRectAnimIndex >= this._cssRectAnimSequence.length) {
            if (this._cssRectAnimLoop) {
                this._cssRectAnimIndex = 0;
            } else {
                this.endCssRectFrameAnimation(false);
                return;
            }
        }
        this._applyCssRectAnimFrame();
    };
    Game_CharacterBase.prototype.endCssRectFrameAnimation = function(resetRect) {
        if (!this._cssRectFrameAnimation) return;
        this._cssRectFrameAnimation = false;
        this._cssRectAnimRows = 0;
        this._cssRectAnimCols = 0;
        this._cssRectAnimSequence = null;
        this._cssRectAnimWait = 0;
        this._cssRectAnimLoop = false;
        this._cssRectAnimIndex = 0;
        this._cssRectAnimCounter = 0;
        if (resetRect && this._cssRectAnimSourceRect) {
            var src = this._cssRectAnimSourceRect;
            this._cssRect = { x: src.x, y: src.y, width: src.width, height: src.height };
        }
        this._noYura = this._yurayura = false;
        if (this.sprite()) this.sprite()._yuraInfo = this._yuraInfo || [];
        if (this._lastInfoForCssFA) {
            this._walkAnime = this._lastInfoForCssFA[0];
            this._stepAnime = this._lastInfoForCssFA[1];
            this._directionFix = this._lastInfoForCssFA[2];
        }
        this._lastInfoForCssFA = null;
        this._stopCount = 0;
        this._patternFix = true;
    };
    Game_CharacterBase.prototype._applyCssRectAnimFrame = function() {
        var src = this._cssRectAnimSourceRect;
        if (!src || src.width <= 0 || src.height <= 0) return;
        var rows = Math.max(1, Math.floor(Number(this._cssRectAnimRows || 1) || 1));
        var cols = Math.max(1, Math.floor(Number(this._cssRectAnimCols || 1) || 1));
        var seq = this._cssRectAnimSequence || [0];
        var idx = Math.max(0, Math.floor(Number(seq[this._cssRectAnimIndex] || 0) || 0));
        var total = Math.max(1, rows * cols);
        if (idx >= total) idx = total - 1;
        var cellW = Math.floor(src.width / cols);
        var cellH = Math.floor(src.height / rows);
        if (cellW <= 0 || cellH <= 0) return;
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        this._cssRect = {
            x: src.x + col * cellW,
            y: src.y + row * cellH,
            width: cellW,
            height: cellH
        };
        this.setSizeForMessagePopup(cellW, cellH);
    };
    Game_CharacterBase.prototype.updateFrameAnimation = function() {
        if (!this._frameAnimation) return;

        if (++this._frameAnimCounter < this._frameAnimWait) return;
        this._frameAnimCounter = 0;
        this._frameAnimIndex++;

        /* 終端処理／ループ */
        if (this._frameAnimIndex >= this._frameAnimCells.length) {
            if (this._frameAnimLoop) {
                this._frameAnimIndex = 0;
            } else {
                this.endFrameAnimation();
                return;
            }
        }
        this._applyFrameAnim();
    };
    Game_CharacterBase.prototype.endFrameAnimation = function () {
        this._frameAnimation = false;
        this._frameAnimCells = null;
        this._frameAnimWait = 0;
        this._frameAnimLoop = false;
        this._frameAnimIndex = 0;
        this._frameAnimCounter = 0;
        this._noYura = this._yurayura = false;
        if (this.sprite()) this.sprite()._yuraInfo = this._yuraInfo || [];
        this._walkAnime = this._lastInfoForFA[0];
        this._stepAnime = this._lastInfoForFA[1];
        this._directionFix = this._lastInfoForFA[2];
        this._lastInfoForFA = null;
        this._stopCount = 0;
        this._patternFix = true; // 最終フレームを維持
    };
    Game_CharacterBase.prototype._applyFrameAnim = function() {
        const idx      = this._frameAnimCells[this._frameAnimIndex];
        this._pattern  = idx % 3;
        this._direction = (Math.floor(idx / 3) + 1) * 2;
    };

    Game_CharacterBase.prototype.updatePattern = function () {
        if (this._patternFix) return;
        if (!this.hasStepAnime() && this._stopCount > 0) {
            this.resetPattern();
        } else {
            this._pattern = (this._pattern + 1) % this.maxPattern(); 
        }
    };

    // Mask fade for characters (fadeWhite 3x3)
    const MASK_FADE_FRAMES = 7;
    const _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        _Game_CharacterBase_initMembers.call(this);
        this.clearMaskFade();
    };
    Game_CharacterBase.prototype.clearMaskFade = function() {
        this._maskFade = { active: false, dir: 0, queue: null, index: 0, frame: 0, stage: -1, hidden: false, endHold: 0 };
    };
    Game_CharacterBase.prototype._buildMaskFadeQueueOut = function(steps) {
        if (steps <= 1) return [8];
        return Array.from({ length: steps }, function(_, j) { return Math.round(j * 8 / (steps - 1)); });
    };
    Game_CharacterBase.prototype._buildMaskFadeQueueIn = function(steps) {
        if (steps <= 1) return [0];
        return Array.from({ length: steps }, function(_, j) { return Math.round(8 - j * 8 / (steps - 1)); });
    };
    Game_CharacterBase.prototype._startMaskFade = function(duration, dir) {
        duration = Math.max(0, Number(duration) || 0);
        if (!this._maskFade) this.clearMaskFade();
        var f = this._maskFade;
        var steps = Math.max(1, Math.floor(duration / MASK_FADE_FRAMES) || 0);
        f.active = true; f.dir = dir;
        f.queue = dir > 0 ? this._buildMaskFadeQueueOut(steps) : this._buildMaskFadeQueueIn(steps);
        f.index = 0; f.frame = 0; f.stage = f.queue[0]; f.hidden = false; f.endHold = 0;
        if (duration <= 0) { f.active = false; f.queue = null; f.stage = dir > 0 ? 8 : -1; f.hidden = dir > 0; }
    };
    Game_CharacterBase.prototype.startMaskFadeOut = function(duration) { this._startMaskFade(duration, 1); };
    Game_CharacterBase.prototype.startMaskFadeIn = function(duration) { this._startMaskFade(duration, -1); };
    Game_CharacterBase.prototype.updateMaskFade = function() {
        var f = this._maskFade;
        if (!f) return;
        if (f.endHold > 0) return (--f.endHold <= 0) ? (f.dir > 0 ? f.hidden = true : f.stage = -1) : void 0;
        if (!f.active || !f.queue) return;
        if (f.frame === 0) f.stage = f.queue[f.index];
        if (++f.frame < MASK_FADE_FRAMES) return;
        f.frame = 0;
        if (++f.index < f.queue.length) return void(f.stage = f.queue[f.index]);
        f.active = false; f.queue = null;
        if (f.dir > 0) { f.stage = 8; f.endHold = 1; }
        else { f.stage = -1; f.hidden = false; f.endHold = 0; }
    };
    Game_CharacterBase.prototype.maskFadeIndex = function() {
        return this._maskFade ? this._maskFade.stage : -1;
    };
    Game_CharacterBase.prototype.isMaskFadeHidden = function() {
        return !!(this._maskFade && this._maskFade.hidden);
    };
    
    //パーティクルを設定
    Game_CharacterBase.prototype.setParticle = function(name, x, y) {
        var sp = this.sprite();
        sp._particle = new Sprite_Particle(name);
        sp._particle.x = x, sp._particle.y = y;
        sp.addChild(sp._particle);
    };
    //パーティクルを削除
    Game_CharacterBase.prototype.eraseParticle = function() {
        var sp = this.sprite();
        if (sp._particle) {
            sp._particle.end();
            sp.removeChild(sp._particle);
            sp._particle = null;
        }
    };

    //-----------------------------------------------------------------------------
    // Game_Player
    //-----------------------------------------------------------------------------

    const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function () {
        if (this.isTransferring()) {
            $gameMap._mizutamariZones = null;
        }
        _Game_Player_performTransfer.apply(this, arguments);
    };
    
    //-----------------------------------------------------------------------------
    // Game_Event
    //-----------------------------------------------------------------------------

    Game_Event.prototype.setupCssRectFromMeta = function() {
        if (this.event() && this.event().meta.cssRect && !this._setCss) {
            var info = this.event().meta.cssRect.split(',').map(function(a) {return Number(a)});
            this._cssRect = {x : info[0], y : info[1], width : info[2], height : info[3]};
            this._setCss = true;
        }
    };
    
    var _Game_Event_update = Game_Event.prototype.update;
    Game_Event.prototype.update = function() {
        //ゆらゆら設定
        if (this.event() && this.event().meta.yura && !this._yurayura && this.sprite()) {
            var info = ('' + this.event().meta.yura).split(',');
            if (typeof this.event().meta.yura !== 'string') info = [];
            this._yuraInfo = [Number(info[0]) || 0, Number(info[1]) || 0, Number(info[2]) || 0, false];
            // this._yurayura = true;
        }
        if (this.event() && this.event().meta.noYura) this._noYura = true;
        
        //スプライトシート機能
        this.setupCssRectFromMeta();
        
        //パーティクル
        if (this.event() && this._pageIndex >= 0 && this.event().meta.particle && !this._particle && this.sprite()) {
            this._particle = true;
            var info = this.event().meta.particle.split(',');
            var sp = this.sprite();
            sp._particle = new Sprite_Particle(info[0]);
            sp._particle.x = Number(info[1]), sp._particle.y = Number(info[2]);
            sp.addChild(sp._particle);
        }

        //特殊：付箋
        if (this.event() && !this._husen && this._pageIndex >= 0 && this.event().meta.husen) {
            this._husen = true;
            var color = ZXC().husenColors[this.event().pages[0].conditions.variableId];
            this._direction = this._originalDirection = ((color % 4) + 1) * 2;
            this._pattern = this._originalPattern = Math.floor(color / 4);
            $gameMap.rejudgeEvents();
        }

        _Game_Event_update.call(this);
    };

    Game_Event.prototype.maxPattern = function () {
        if (!this._maxPattern)
            this._maxPattern = this.event().meta.pattern3 ? 3 : 4;
        return this._maxPattern;
    };

    //-----------------------------------------------------------------------------
    // アイテム実装
    //-----------------------------------------------------------------------------
    
    const _Game_Event_initialize = Game_Event.prototype.initialize;
    Game_Event.prototype.initialize = function(mapId, eventId) {
        _Game_Event_initialize.apply(this, arguments);
        this._itemImageInfo = null;

        if (this.event().meta.itemId) {
            const itemId = Number(this.event().meta.itemId);
            const item = $dataItems[itemId];
            this.setItem(item);
        } else if (this.event().meta.armorId) {
            const itemId = Number(this.event().meta.armorId);
            const item = $dataArmors[itemId];
            this.setItem(item);
        }

        //その他
        if (this.event().meta.noRef) this._noRef = true;
        if (this.event().meta.suisya) this._suisya = true;
    };
    Game_Event.prototype.setItem = function(item) {
        this._item = item || null;
        this._itemImageInfo = null;
        if (item) this._scaleX = this._scaleY = 60;
        if (item && item.meta.image) {
            const name = item.meta.image.split(',')[0];
            const index = Number(item.meta.image.split(',')[1] || 0);
            this._itemImageInfo = [name, index];
        }
    };
    Game_Event.prototype.itemImageInfo = function() {
        return this._itemImageInfo;
    };
    
    const _Sprite_Character_setCharacterBitmap = Sprite_Character.prototype.setCharacterBitmap;
    Sprite_Character.prototype.setCharacterBitmap = function() {
        const char = this._character;
        if (char instanceof Game_Event && char.itemImageInfo()) {
            const [name, index] = char.itemImageInfo();
            this.bitmap = ImageManager.loadItem(name);
            this._baseBitmap = null;

            this.bitmap.addLoadListener(() => {
                const pw = this.bitmap.width / 4, ph = this.bitmap.height / 2;
                const sx = (index % 4) * pw, sy = Math.floor(index / 4) * ph;
                this.setFrame(sx, sy, pw, ph);
                this.anchor.x = 0.5, this.anchor.y = 1;
                this.setOutline(1, 2);
                this._yuraInfo = [24, 24];
            });

        } else {
            _Sprite_Character_setCharacterBitmap.apply(this, arguments);
            this._baseBitmap = null;
        }
    };
    const _Sprite_Character_updateCharacterFrame = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function() {
        const char = this._character;
        if (char instanceof Game_Event && char.itemImageInfo()) {
            // アイテム画像を使うキャラはフレーム更新不要
            return;
        } else {
            _Sprite_Character_updateCharacterFrame.apply(this, arguments);
        }
    };
    
    //x, yにアイテムを配置する
    Game_Map.prototype.putItem = function(item, x, y, num) {
        // テンプレートマップ内でイベント名が "item" のイベントIDを取得
        const tpl = DataManager.searchDataItem($dataTemplateEvents, 'name', 'item');
        if (tpl) {
            var ev = $gameMap.spawnEvent(tpl.id, x, y, true);
            ev.setItem(item);
            ev._itemNum = num || 1;
            this.rejudgeEvents();
            return ev;
        }
    };

    //アイテム入手（Interpreter）
    Game_Interpreter.prototype.getItem = function (item, num) {
        var ev = $gameMap.putItem(item, $gamePlayer.x, $gamePlayer.y);
        ev._itemNum = num || 1;
        this.setupChild(ev.list(), ev.eventId());
    };

    //アイテムの説明を表示
    Game_Interpreter.prototype.displayItemInfo = function(item, ax, ay) {
        var w = 360, h = 66 + 36;
        var y2 = (ay || 430) + $gameMap.parallaxOy(), y = (y2 - y2 % 33.3125 + 22) - $gameMap.parallaxOy();
        var x = $gameMap.getCenterXForUI() - w / 2 + (ax || 0);
        var wd = $gameTemp._itemInfoWindow = new Window_Base(x, y, w, h);
        SceneManager._scene.addWindow(wd);
        wd.openness = 0, wd.open();
        wd.drawTextNL(item.description, 0, 0, wd.contents.width);
    };
    Game_Interpreter.prototype.endItemInfo = function() {
        SceneManager._scene._windowLayer.removeChild($gameTemp._itemInfoWindow);
        $gameTemp._itemInfoWindow = null;
    };

    //ページの境目を避けた中央x
    Game_Map.prototype.getCenterXForUI = function() {
        var isVertical = $dataMap && $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
        if (isVertical) return Graphics.boxWidth / 2;
        var px = $gameMap.parallaxOx();
        return px >= 1000 - Graphics.boxWidth && px < 1000 - Graphics.boxWidth / 2 ? (1000 - px) / 2 :
        px >= 1000 - Graphics.boxWidth / 2 && px < 1000 ? (px + Graphics.boxWidth + 1000) / 2 - px :
        Graphics.boxWidth / 2;
    };
    
    //-----------------------------------------------------------------------------
    // ノート風表示
    //-----------------------------------------------------------------------------

    var _Spriteset_Map_createTilemap = Spriteset_Map.prototype.createTilemap;
    Spriteset_Map.prototype.createTilemap = function() {
        _Spriteset_Map_createTilemap.apply(this, arguments);
        SceneManager._scene.createNoteLine();
    };

    Spriteset_Map.prototype._canvasReAddParallax = function () {
        var index = this._baseSprite.children.indexOf(this._parallax);
        this._baseSprite.removeChild(this._parallax);
        this._parallax = new TilingSprite();
        var a = $dataMap.meta.noRescale ? 1 : 2;
        this._parallax.move(0, 0, Graphics.width / a, Graphics.height / a);
        var bmp = ImageManager.loadParallax(this._parallaxName);
        bmp.addLoadListener(function (bmp) {
            var bmp2 = new Bitmap(bmp.width / a, bmp.height / a);
            bmp2.blt(bmp, 0, 0, bmp.width, bmp.height, 0, 0, bmp2.width, bmp2.height);
            this._parallax.bitmap = bmp2;
            this._parallax.scale.x = this._parallax.scale.y = a;
            if (!$dataMap.meta.noYura) this._parallax._yuraInfo = [12 / a, 10 / a];
        }.bind(this, bmp))
        this._baseSprite.addChildAt(this._parallax, index);
    };
    Spriteset_Map.prototype.updateParallax = function () {
        var a = $dataMap.meta && $dataMap.meta.noRescale ? 1 : 2;
        if (this._parallaxName !== $gameMap.parallaxName()) {
            this._parallaxName = $gameMap.parallaxName();

            if (this._parallax.bitmap && Graphics.isWebGL() != true) {
                this._canvasReAddParallax();
            } else {
                var bmp = ImageManager.loadParallax(this._parallaxName);
                bmp.addLoadListener(function (bmp) {
                    var bmp2 = new Bitmap(bmp.width / a, bmp.height / a);
                    bmp2.blt(bmp, 0, 0, bmp.width, bmp.height, 0, 0, bmp2.width, bmp2.height);
                    this._parallax.bitmap = bmp2;
                    this._parallax.scale.x = this._parallax.scale.y = a;
                }.bind(this, bmp))
            }
        }
        if (this._parallax.bitmap) {
            if (!($dataMap.meta && $dataMap.meta.noYura)) this._parallax._yuraInfo = [12 / a, 10 / a];
            this._parallax.origin.x = $gameMap.parallaxOx() / a;
            this._parallax.origin.y = $gameMap.parallaxOy() / a;
        }
    };
    var _Spriteset_Map_updateParallax = Spriteset_Map.prototype.updateParallax;
    Spriteset_Map.prototype.updateParallax = function() {
        _Spriteset_Map_updateParallax.apply(this, arguments);
        
        //マップの手前描写部分
        if (!($dataMap.meta && $dataMap.meta.noFront)) {
            if (!this._parallax_f && this._parallaxName) {
                this._parallax_f = new TilingSprite();
                this._parallax_f.move(0, 0, Graphics.width / 2, Graphics.height / 2);
                var bmp = ImageManager.loadParallax(this._parallaxName + '_f');
                bmp.addLoadListener(function (bmp) {
                    var bmp2 = new Bitmap(bmp.width / 2, bmp.height / 2);
                    bmp2.blt(bmp, 0, 0, bmp.width, bmp.height, 0, 0, bmp2.width, bmp2.height);
                    this._parallax_f.bitmap = bmp2;
                    this._parallax_f.scale.x = this._parallax_f.scale.y = 2;
                    if (!$dataMap.meta.noYura) this._parallax_f._yuraInfo = [6, 5];
                    this._parallax_f.z = 4;
                }.bind(this, bmp))
                this._tilemap.addChild(this._parallax_f);
            }
            if (this._parallax_f) {
                this._parallax_f.origin.x = $gameMap.parallaxOx() / 2;
                this._parallax_f.origin.y = $gameMap.parallaxOy() / 2;
            }
        }
        
        //描写禁止部分（白く塗る）
        if (!SceneManager._scene._whiteLine) {
            var isVertical = $dataMap && $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
            var wl = SceneManager._scene._whiteLine = new TilingSprite();
            wl.move(0, 0, Graphics.width, Graphics.height);
            wl.scale.x= wl.scale.y = 2;
            var a = 24;
            var w = ($dataMap ? ($gameMap.width() - (isVertical ? 0.5 : 0)) : 41) * 48;
            var h = ($dataMap ? ($gameMap.height() - (!isVertical ? 0.5 : 1)) : 30) * 48;
            var bmp = wl.bitmap = new Bitmap(w / 2, h / 2);
            bmp.fillAll('white');
            bmp.clearRect(a / 2, a / 2, w / 2 - a, h / 2 - a);
            if (!$gameSwitches.value(18)) {
                if (isVertical) bmp.fillRect(0, 938 / 2, w, a, 'white');
                else bmp.fillRect(972 / 2, 0, a, h, 'white');
            }
            wl._yuraInfo = [6, 30];
        }
        if (SceneManager._scene._whiteLine) {
            SceneManager._scene._whiteLine.origin.x = $gameMap.parallaxOx() / 2;
            SceneManager._scene._whiteLine.origin.y = $gameMap.parallaxOy() / 2;
        }
        
        //さらに背景
        if ($dataMap.meta && $dataMap.meta.back) {
            if (!this._backParallax) {
                this._backParallax = new TilingSprite();
                this._backParallax.move(0, 0, Graphics.width, Graphics.height);
                var bmp = ImageManager.loadParallax($dataMap.meta.back);
                bmp.addLoadListener(function (bmp) {
                    var bmp2 = new Bitmap(bmp.width / 2, bmp.height / 2);
                    bmp2.blt(bmp, 0, 0, bmp.width, bmp.height, 0, 0, bmp2.width, bmp2.height);
                    this._backParallax.bitmap = bmp2;
                    this._backParallax.scale.x = this._backParallax.scale.y = 2;
                    this._backParallax._yuraInfo = [6, 5];
                }.bind(this, bmp))
                this._baseSprite.addChildAt(this._backParallax, 1);
            }
            this._backParallax.origin.x = $gameMap.parallaxOx() * 0.425;
            this._backParallax.origin.y = $gameMap.parallaxOy() * 0.425;
        }

        //水エフェクト
        if ($dataMap.meta && $dataMap.meta.waterEffect) {
            if (!this._waterEffect) {
                this._waterEffect = new TilingSprite();
                this._waterEffect.move(0, 0, Graphics.width / 2, Graphics.height / 2);
                var bmp = ImageManager.loadParallax(this._parallaxName + '_water');
                bmp.addLoadListener(function (bmp) {
                    var bmp2 = new Bitmap(bmp.width / 2, bmp.height / 2);
                    bmp2.blt(bmp, 0, 0, bmp.width, bmp.height, 0, 0, bmp2.width, bmp2.height);
                    this._waterEffect.bitmap = bmp2;
                    this._waterEffect.scale.x = this._waterEffect.scale.y = 2;
                    this._waterEffect._yuraInfo = [12, 40];
                }.bind(this, bmp))
                this._baseSprite.addChildAt(this._waterEffect, 1);
            }
            this._waterEffect.origin.x = $gameMap.parallaxOx() / 2;
            this._waterEffect.origin.y = $gameMap.parallaxOy() / 2;
        }
        
        //反射スプライトの更新
        if ($dataMap.meta && $dataMap.meta.reflection) {
            if (!this._reflectionLayer) {
                this._reflectionLayer = new TilingSprite();
                this._reflectionLayer.move(0, 0, Graphics.width, Graphics.height);
                var bmp = ImageManager.loadParallax($dataMap.meta.reflectionImage || 'cloud');
                bmp.addLoadListener(function (bmp) {
                    var bmp2 = new Bitmap(bmp.width / 2, bmp.height / 2);
                    bmp2.blt(bmp, 0, 0, bmp.width, bmp.height, 0, 0, bmp2.width, bmp2.height);
                    this._reflectionLayer.bitmap = bmp2;
                    this._reflectionLayer.scale.x = this._reflectionLayer.scale.y = 2;
                    this._reflectionLayer._yuraInfo = [12, 15];
                }.bind(this, bmp))
                this._baseSprite.addChildAt(this._reflectionLayer, 1); // キャラより下にしたければ 0
            }
            this._reflectionLayer.origin.x = $gameMap.parallaxOx() * 0.45;
            this._reflectionLayer.origin.y = $gameMap.parallaxOy() * 0.45;
            
            if (!this._reflectionSprites) this._reflectionSprites = [];

            const sprites = this._characterSprites.filter(sp => !sp._character._noRef);
            const layer = this._reflectionLayer;

            // スプライト数が合ってなければ再構築
            if (this._reflectionSprites.length !== sprites.length) {
                // 一旦クリア
                for (const r of this._reflectionSprites) layer.removeChild(r);
                this._reflectionSprites = [];

                // 新たに生成
                for (const s of sprites) {
                    const r = new Sprite();
                    r.anchor.x = s.anchor.x, r.anchor.y = 1 - s.anchor.y;
                    r.scale.y = -1;
                    layer.addChild(r);
                    this._reflectionSprites.push(r);
                }
            }

            // 毎フレーム、全反射スプライトを更新
            for (let i = 0; i < sprites.length; i++) {
                const src = sprites[i];
                const ref = this._reflectionSprites[i];
                ref._yuraInfo = src._character._noYura ? null : [30, 40];
                ref.x = src.x / 2, ref.y = src.y / 2 + src.height * 0.4 + src._character.jumpHeight() + (
                    src._character.regionId() === 8 ? 25 : src._character.regionId() === 9 ? 10 : -10
                );
                ref.scale.x = src.scale.x / 2;
                ref.scale.y = src.scale.y * -1 * 0.8 / 2;
                ref.visible = src.visible;
                if (src._character._suisya) { //水車
                    ref.bitmap = ImageManager.loadCharacter('suisya_ref');
                    ref.setFrame(src._frame.x, src._frame.y, src._frame.width, src._frame.height);
                    ref.scale.y = src.scale.y * -1 * 1 / 2;
                    ref.y += 32;
                    ref._yuraInfo = null;
                } else {
                    if (src._yuraInfo && src._lastFrame) {
                        if (!ref._baseBitmap) ref.bitmap = src._baseBitmap;
                        ref.setFrame(src._lastFrame.x, src._lastFrame.y, src._lastFrame.width, src._lastFrame.height);
                    } else {
                        if (!ref._baseBitmap) ref.bitmap = src.bitmap;
                        ref.setFrame(src._frame.x, src._frame.y, src._frame.width, src._frame.height);
                    }
                }
            }
        }

        //各メッシュスプライトの位置更新
        [this._parallax, this._parallax_f, SceneManager._scene._whiteLine,
            this._backParallax, this._waterEffect, this._reflectionLayer].forEach(sp => {
                if (sp && sp._meshSprite && sp._meshSprite.visible) {
                    sp._meshSprite.x = -sp.origin.x;
                    sp._meshSprite.y = -sp.origin.y;
                }
            })
        
        SceneManager._scene.updateNoteLine();
    };
    
    var noteLineAlpha = function() {
        var sc = (typeof SceneManager !== 'undefined' && SceneManager) ? SceneManager._scene : null;
        var ee = sc && sc._knhEE;
        return (ee && ee.on) ? 250 : 24;
    };
    Scene_Base.prototype.createNoteLine = function () {
        var isVertical = $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
        var nAlpha = noteLineAlpha();
        //罫線
        this._noteLine = new TilingSprite();
        this._noteLine.move(-nAlpha, -nAlpha,
            (isVertical ? Graphics.height : Graphics.width) + nAlpha * 2,
            (isVertical ? Graphics.width : Graphics.height) + nAlpha * 2);
        this._noteLine.bitmap = ImageManager.loadSystem('note');
        if (isVertical) {
            this._noteLine.rotation = -Math.PI / 2;
            this._noteLine.y += Graphics.height + nAlpha * 2;
        }
        //ノートの影
        this._noteEffect = new TilingSprite();
        this._noteEffect.move(-nAlpha, -nAlpha,
            (isVertical ? Graphics.height : Graphics.width) + nAlpha * 2,
            (isVertical ? Graphics.width : Graphics.height) + nAlpha * 2);
        this._noteEffect.bitmap = ImageManager.loadSystem('note_effect');
        if (isVertical) {
            this._noteEffect.rotation = -Math.PI / 2;
            this._noteEffect.y += Graphics.height + nAlpha * 2;
        }
        //それらより前に表示される
        this._frontSprite = new Sprite();
    };
    
    Scene_Base.prototype.updateNoteLine = function() {
        //罫線・ノートの影更新
        if (_debug.get('recordMode') !== 2) { //録画モード2の時は非表示
            var inBattle = (this instanceof Scene_NewBattle);
            var isRight = ((this instanceof Scene_Map) && ($dataMap.meta && $dataMap.meta.pageRight)) ||
                (inBattle && $gameTemp._battlePageRight);
            var isVertical = $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
            var nAlpha = noteLineAlpha();
            if (this._whiteLine) this.addChild(this._whiteLine);
            if (this._noteLine.bitmap) {
                if (this._noteLine._noteLineAlpha !== nAlpha) {
                    this._noteLine.move(-nAlpha, -nAlpha,
                        (isVertical ? Graphics.height : Graphics.width) + nAlpha * 2,
                        (isVertical ? Graphics.width : Graphics.height) + nAlpha * 2);
                    this._noteLine._noteLineAlpha = nAlpha;
                    this._noteLine.rotation = isVertical ? (-Math.PI / 2) : 0;
                    this._noteLine.y = isVertical ? (Graphics.height + nAlpha * 2) : 0;
                }
                if (this._noteEffect._noteLineAlpha !== nAlpha) {
                    this._noteEffect.move(-nAlpha, -nAlpha,
                        (isVertical ? Graphics.height : Graphics.width) + nAlpha * 2,
                        (isVertical ? Graphics.width : Graphics.height) + nAlpha * 2);
                    this._noteEffect._noteLineAlpha = nAlpha;
                    this._noteEffect.rotation = isVertical ? (-Math.PI / 2) : 0;
                    this._noteEffect.y = isVertical ? (Graphics.height + nAlpha * 2) : 0;
                }
                var px = $gameMap.parallaxOx(true), py = $gameMap.parallaxOy(true);
                if (isVertical) px = 1414 - $gameMap.parallaxOy(true) - 80, py = $gameMap.parallaxOx(true);
                this._noteLine.origin.x = px - nAlpha;
                if (isRight) this._noteLine.origin.x += 1000 - 12 + (inBattle ? 100 : 0);
                this._noteLine.origin.y = py - nAlpha + 24;
                this.addChild(this._noteLine);

                this._noteEffect.origin.x = px - nAlpha;
                if (isRight) this._noteEffect.origin.x += 1000 - 12 + (inBattle ? 100 : 0);
                this._noteEffect.origin.y = py - nAlpha + 24;
                this.addChild(this._noteEffect);
            }
        }
        if (this._cursorSprite) this.addChild(this._cursorSprite);
        if (this._fadeSprite) this.addChild(this._fadeSprite);
        if (this._pageTurnPlane) this.addChild(this._pageTurnPlane);
        if (this._frontSprite) this.addChild(this._frontSprite);
    };
    
    var _Game_Map_parallaxOx = Game_Map.prototype.parallaxOx;
    Game_Map.prototype.parallaxOx = function(fix) {
        if ($gameParty.inBattle() || (fix && $gameSwitches.value(18))) return 68;
        return _Game_Map_parallaxOx.apply(this, arguments);
    };
    var _Game_Map_parallaxOy = Game_Map.prototype.parallaxOy;
    Game_Map.prototype.parallaxOy = function(fix) {
        if ($gameParty.inBattle() || (fix && $gameSwitches.value(18))) return 0;
        return _Game_Map_parallaxOy.apply(this, arguments);
    };

    //ノートにおける位置を取得
    Game_Map.prototype.getPagePosition = function() {
        if (!$dataMap) return -2;
        var isRight = !!$dataMap.meta.pageRight;
        var pos = 2;
        if ($gameMap.displayX() <= 2 || $gameMap.displayX() >= 23.5 - 2) {
            if ($gameMap.displayY() >= $gameMap.height() - 13 - 1) pos  = 3;
            else if ($gameMap.displayY() <= 1) pos = 1;
        }
        if ($gameVariables.value(46)) pos *= $gameVariables.value(46) > 0 ? 1 : -1;
        else pos *= isRight || $gameMap.displayX() >= 12.5 ? 1 : -1;
        $gameVariables.setValue(46, 0);
        return pos;
    };
    
    //-----------------------------------------------------------------------------
    // TileCは描写しない
    //-----------------------------------------------------------------------------
    
    Spriteset_Map.prototype.loadTileset = function() {
        var flag = !_debug.get('tileC'); //debug
        this._tileset = $gameMap.tileset();
        if (this._tileset) {
            var tilesetNames = this._tileset.tilesetNames;
            for (var i = 0; i < tilesetNames.length; i++) {
                var name = flag && tilesetNames[i] === '_C' ? '' : tilesetNames[i];
                this._tilemap.bitmaps[i] = ImageManager.loadTileset(name);
            }
            var newTilesetFlags = $gameMap.tilesetFlags();
            this._tilemap.refreshTileset();
            if (!this._tilemap.flags.equals(newTilesetFlags)) {
                this._tilemap.refresh();
            }
            this._tilemap.flags = newTilesetFlags;
        }
    };

    //-----------------------------------------------------------------------------
    // 手書き風ゆらゆら表示
    //-----------------------------------------------------------------------------

    // Sprite拡張
    function kggYuraResetMeshVertices_(mesh, width, height) {
        const verts = mesh.vertices;
        const cols = mesh._cols;
        const rows = mesh._rows;
        mesh._originalVertices = new Float32Array(verts.length);
        for (let i = 0; i < verts.length; i += 2) {
            const ix = (i / 2) % (cols + 1);
            const iy = Math.floor(i / 2 / (cols + 1));
            verts[i] = mesh._originalVertices[i] = (width / cols) * ix;
            verts[i + 1] = mesh._originalVertices[i + 1] = (height / rows) * iy;
        }
        mesh._meshDirty = true;
        mesh._lastMeshStep = null;
        mesh._lastPattern = null;
    }
    var _Sprite_update = Sprite.prototype.update;
    Sprite.prototype.update = function () {
        _Sprite_update.call(this);
        if (this._yuraFilterInfo || this._yuraFilterZXC) this.updateYuraFilterZXC();

        const yura = this._yuraInfo, mesh = this._meshSprite, frame = this._frame;
        const bitmapReady = this.bitmap && this.bitmap.isReady();

        if (!yura && mesh && mesh.visible) {
            if (this._baseBitmap) {
                var f = JSON.parse(JSON.stringify(this._frame));
                this.bitmap = this._baseBitmap, this._baseBitmap = null;
                this.setFrame(f.x, f.y, f.width, f.height);
            }
            mesh.visible = false;
            this._lastFrame = null;
            return;
        }

        if (yura) {
            const info = yura.toString();
            if (this._lastInfoYura !== info) {
                if (mesh) this.removeChild(mesh);
                this._meshSprite = null;
                this._lastInfoYura = info;
            }
            if (!this._meshSprite && bitmapReady && frame.width) {
                // 初回メッシュ生成
                const bmp = new Bitmap(frame.width, frame.height);
                const params = [bmp, yura[0], yura[1], yura[2], yura[3]];
                this._meshSprite = new Sprite_Yurayura(...params);
                this._meshSprite._useOwnStep = !!this._yuraUseOwnStep;
                this._meshSprite.visible = true;
                this.addChild(this._meshSprite);
                this._lastFrame = null;
            }
            if (this._meshSprite) {
                this._meshSprite._useOwnStep = !!this._yuraUseOwnStep;
                this._meshSprite._lockGeometry = !!this._yuraLockGeometry;
                if (this._meshSprite._lockGeometry) {
                    const tex = this._meshSprite._texture;
                    if (tex && !this._meshSprite._lockGeometrySize) {
                        this._meshSprite._lockGeometrySize = { w: tex.width, h: tex.height };
                    }
                } else {
                    this._meshSprite._lockGeometrySize = null;
                }
                this._meshSprite.visible = true;
            }

            if (this._meshSprite && this._meshSprite.visible) {
                if (!this._baseBitmap && bitmapReady) {
                    //baseBitmapの設定
                    var f = JSON.parse(JSON.stringify(this._frame));
                    this._baseBitmap = this.bitmap;
                    this.bitmap = new Bitmap(this.bitmap.width, this.bitmap.height);
                    this.setFrame(f.x, f.y, f.width, f.height);
                }
                const mesh = this._meshSprite;
                const srcBmp = this._baseBitmap || this.bitmap;
                const a = this._frame, b = this._lastFrame;
                const changed = !b || a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
                const direct = !!this._yuraDirect && srcBmp && a.x === 0 && a.y === 0 &&
                    a.width === srcBmp.width && a.height === srcBmp.height;
                if (direct) {
                    const tex = mesh.texture;
                    const base = tex ? tex.baseTexture : null;
                    const needReset = mesh._bitmap !== srcBmp || base !== srcBmp._baseTexture ||
                        mesh.width !== a.width || mesh.height !== a.height;
                    if (needReset) {
                        mesh._bitmap = srcBmp;
                        mesh.texture = new PIXI.Texture(srcBmp._baseTexture);
                        mesh.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                        if (mesh._lockGeometry) {
                            mesh._lockGeometrySize = { w: a.width, h: a.height };
                        }
                        kggYuraResetMeshVertices_(mesh, a.width, a.height);
                    }
                    if (changed) this._lastFrame = {x: a.x, y: a.y, width: a.width, height: a.height};
                } else if (changed) {
                    // frameが変わったら再描画
                    // _p("Yura redraw:", a, 'from', b, this);
                    const cropped = new Bitmap(a.width, a.height);
                    cropped.blt(srcBmp, a.x, a.y, a.width, a.height, 0, 0);
                    cropped._kggSourceFontFace = srcBmp && srcBmp.fontFace;
                    if (typeof this._kggSemiWhiteEdgeAlphaThreshold === 'number') {
                        cropped._kggSemiWhiteEdgeAlphaThreshold = this._kggSemiWhiteEdgeAlphaThreshold;
                    } else if (srcBmp && typeof srcBmp._kggSemiWhiteEdgeAlphaThreshold === 'number') {
                        cropped._kggSemiWhiteEdgeAlphaThreshold = srcBmp._kggSemiWhiteEdgeAlphaThreshold;
                    }
                    if (this._yuraInfo[3]) cropped._applyNormalColorMask(!!this._maskWhite);
                    mesh._bitmap = cropped;

                    mesh.texture = new PIXI.Texture(cropped._baseTexture);
                    mesh.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                    kggYuraResetMeshVertices_(mesh, a.width, a.height);
                    this._lastFrame = {x: a.x, y: a.y, width: a.width, height: a.height};
                }
                // anchor補正
                const w = this.width, h = this.height;
                this._meshSprite.x = -this.anchor.x * w;
                this._meshSprite.y = -this.anchor.y * h;
                //update
                this._meshSprite.updateMesh();
            }
        }
    };

    // Sprite_Yurayura本体
    function Sprite_Yurayura(bitmap, blockSize, maxShake, frame, noMask) {
        this.initialize(bitmap, blockSize, maxShake, frame, noMask);
    }

    Sprite_Yurayura.prototype = Object.create(PIXI.mesh.Plane.prototype);
    Sprite_Yurayura.prototype.constructor = Sprite_Yurayura;

    Sprite_Yurayura.prototype.initialize = function (bitmap, blockSize, maxShake, frame, noMask) {
        blockSize = blockSize || 12;
        maxShake = maxShake || 10;
        frame = frame || 10;
        frame = Number($gameSystem && $gameSystem.animationWait ? $gameSystem.animationWait() : frame);
        if (!isFinite(frame) || frame <= 0) frame = 1;
        noMask = noMask !== undefined ? noMask : true;

        const cols = Math.ceil(bitmap.width / blockSize);
        const rows = Math.ceil(bitmap.height / blockSize);

        const texture = new PIXI.Texture(bitmap._baseTexture);
        texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

        PIXI.mesh.Plane.call(this, texture, cols + 1, rows + 1);
        this._bitmap = bitmap;
        this._cols = cols;
        this._rows = rows;
        this._maxShake = maxShake;
        this._frameCount = frame;
        this._noMask = noMask;
        this._meshDirty = true;
        this._lastMeshStep = null;
        this._lastPattern = null;
        this.width = bitmap.width;
        this.height = bitmap.height;
        this._frame = new Rectangle(0, 0, bitmap.width, bitmap.height);
        this._originalVertices = new Float32Array(this.vertices);
        var n = $gameParty.inBattle() ? 4 : 3;
        Sprite_Yurayura._patternCache = Sprite_Yurayura._patternCache || {};
        const key = cols + 'x' + rows + ':' + this._maxShake + ':' + n;
        let patterns = Sprite_Yurayura._patternCache[key];
        if (!patterns) {
            patterns = [];
            for (let i = 0; i < n; i++) {
                patterns.push(i === 3 ? patterns[1] : this._createRandomDistortion());
            }
            Sprite_Yurayura._patternCache[key] = patterns;
        }
        this._distortPatterns = patterns;
        this._patternOffset = (Math.random() * patterns.length) | 0;
    };

    Sprite_Yurayura.prototype._createRandomDistortion = function() {
        const pattern = new Float32Array(this._originalVertices.length);
        const rate = this._maxShake / 5;
        for (let i = 0; i < pattern.length; i += 2) {
            pattern[i] = (Math.random() - 0.5) * rate;
            pattern[i + 1] = (Math.random() - 0.5) * rate;
        }
        return pattern;
    };

    // geometry固定時は refresh 内の _refresh() を抑制する
    Sprite_Yurayura.prototype.refresh = function(forceUpdate) {
        if (this._lockGeometry) {
            const tex = this._texture;
            const size = this._lockGeometrySize;
            const w = tex ? tex.width : 0;
            const h = tex ? tex.height : 0;
            if (!size || size.w !== w || size.h !== h) {
                this._lockGeometrySize = tex ? { w: w, h: h } : null;
                return PIXI.mesh.Plane.prototype.refresh.call(this, forceUpdate);
            }
            if (this._uvTransform.update(forceUpdate)) {
                if (!this.uploadUvTransform) {
                    this._uvTransform.multiplyUvs(this.uvs);
                }
            }
            return;
        }
        return PIXI.mesh.Plane.prototype.refresh.call(this, forceUpdate);
    };

    // texture 更新時に Plane の refresh が走ると頂点がグリッドに戻るため、
    // geometry 固定モードでは refresh を抑制して揺れを維持する
    Sprite_Yurayura.prototype._onTextureUpdate = function() {
        if (this._lockGeometry) {
            const tex = this._texture;
            const size = this._lockGeometrySize;
            if (!size || !tex || tex.width !== size.w || tex.height !== size.h) {
                this._lockGeometrySize = tex ? { w: tex.width, h: tex.height } : null;
                PIXI.mesh.Plane.prototype._onTextureUpdate.call(this);
                return;
            }
            if (this._uvTransform) {
                this._uvTransform.texture = this._texture;
                this._uvTransform.update(true);
            }
            return;
        }
        PIXI.mesh.Plane.prototype._onTextureUpdate.call(this);
    };

    Sprite_Yurayura.prototype.updateMesh = function() {
        if (!$gameSystem) return;
        if ($gameSwitches.value(1)) return;
        if (!this.visible || this.worldAlpha <= 0) return;
        if (!this._distortPatterns || !this._distortPatterns.length) return;
        const baseCount = this._useOwnStep
            ? (this._ownStep = (this._ownStep || 0) + 1)
            : (this._useFrameCount ? Graphics.frameCount : $gameSystem.sceneCount());
        const frameCount = Math.max(1, Number(this._frameCount || 1));
        const step = Math.floor(baseCount / frameCount);
        if (this._lastMeshStep === step && !this._meshDirty) return;
        this._lastMeshStep = step;
        const verts = this.vertices;
        const orig = this._originalVertices;
        if (!verts || !orig || orig.length < verts.length) return;
        const plen = this._distortPatterns.length;
        const poff = Math.floor(Number(this._patternOffset || 0));
        const pidx = ((step + poff) % plen + plen) % plen;
        const pattern = this._distortPatterns[pidx];
        if (!pattern || pattern.length < verts.length) return;
        if (this._lastPattern === pattern && !this._meshDirty) return;
        this._lastPattern = pattern;
        this._meshDirty = false;
        for (let i = 0; i < verts.length; i++) verts[i] = orig[i] + pattern[i];
        if (this.dirty !== undefined) this.dirty++;
        if (this.vertexDirty !== undefined) this.vertexDirty++;
        if (this.geometry && this.geometry.invalidate) this.geometry.invalidate();
    };

    // Filter based yura. This is for already composed display objects.
    const _kggYuraFilterFragmentSrc =
        'precision mediump float;' +
        'varying vec2 vTextureCoord;' +
        'uniform sampler2D uSampler;' +
        'uniform vec4 filterArea;' +
        'uniform float blockSize;' +
        'uniform float maxShake;' +
        'uniform float stepCount;' +
        'uniform float seed;' +
        'uniform float pixelSnap;' +
        'uniform vec2 noiseOffset;' +
        'vec2 mapCoord(vec2 coord){coord*=filterArea.xy;coord+=filterArea.zw;return coord;}' +
        'vec2 unmapCoord(vec2 coord){coord-=filterArea.zw;coord/=filterArea.xy;return coord;}' +
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}' +
        'vec2 rand2(vec2 p){return vec2(hash(p+seed),hash(p+seed+19.19))*2.0-1.0;}' +
        'vec2 yuraNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);' +
        'vec2 a=rand2(i);vec2 b=rand2(i+vec2(1.0,0.0));vec2 c=rand2(i+vec2(0.0,1.0));vec2 d=rand2(i+vec2(1.0,1.0));' +
        'return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}' +
        'void main(void){' +
        'vec2 px=mapCoord(vTextureCoord);' +
        'vec2 cell=(px+noiseOffset)/max(blockSize,1.0);' +
        'vec2 offset=yuraNoise(cell+vec2(stepCount*13.0,stepCount*17.0))*(maxShake/5.0);' +
        'vec2 samplePx=px+offset;' +
        'if(pixelSnap>0.5){samplePx=floor(samplePx)+vec2(0.5);}' +
        'vec2 uv=clamp(unmapCoord(samplePx),vec2(0.0),vec2(1.0));' +
        'gl_FragColor=texture2D(uSampler,uv);' +
        '}';

    function Filter_Yurayura() {
        PIXI.Filter.call(this, PIXI.Filter.defaultVertexSrc, _kggYuraFilterFragmentSrc, {
            blockSize: 12,
            maxShake: 10,
            stepCount: 0,
            seed: 0,
            pixelSnap: 1,
            noiseOffset: [0, 0]
        });
        this.padding = 32;
    }
    Filter_Yurayura.prototype = Object.create(PIXI.Filter.prototype);
    Filter_Yurayura.prototype.constructor = Filter_Yurayura;
    window.Filter_Yurayura = Filter_Yurayura;

    function kggYuraFilterNumber(value, fallback) {
        const n = Number(value);
        return isFinite(n) ? n : fallback;
    }

    function kggNormalizeYuraFilterInfo(info) {
        if (!info) return null;
        if (Array.isArray(info)) {
            return {
                blockSize: kggYuraFilterNumber(info[0], 12),
                maxShake: kggYuraFilterNumber(info[1], 10),
                frame: Math.max(1, kggYuraFilterNumber(info[2], 10)),
                pixelSnap: info[3] !== false,
                seed: kggYuraFilterNumber(info[4], 0),
                filterArea: info[5] || null,
                offsetX: kggYuraFilterNumber(info[6], 0),
                offsetY: kggYuraFilterNumber(info[7], 0)
            };
        }
        if (info.enabled === false) return null;
        return {
            blockSize: kggYuraFilterNumber(info.blockSize, 12),
            maxShake: kggYuraFilterNumber(info.maxShake, 10),
            frame: Math.max(1, kggYuraFilterNumber(info.frame, 10)),
            pixelSnap: info.pixelSnap !== false,
            seed: kggYuraFilterNumber(info.seed, 0),
            filterArea: info.filterArea || null,
            offsetX: kggYuraFilterNumber(info.offsetX, 0),
            offsetY: kggYuraFilterNumber(info.offsetY, 0)
        };
    }

    function kggCanUseYuraFilter() {
        const graphics = typeof Graphics !== 'undefined' ? Graphics : null;
        return !!PIXI.Filter && !(graphics && typeof graphics.isWebGL === 'function' && !graphics.isWebGL());
    }

    function kggRemoveYuraFilter(target) {
        const filter = target._yuraFilterZXC;
        if (!filter || !target.filters) return;
        const filters = target.filters.slice();
        const index = filters.indexOf(filter);
        if (index >= 0) filters.splice(index, 1);
        target.filters = filters.length ? filters : null;
    }

    function kggEnsureYuraFilter(target) {
        if (!target._yuraFilterZXC) target._yuraFilterZXC = new Filter_Yurayura();
        const filter = target._yuraFilterZXC;
        const filters = target.filters ? target.filters.slice() : [];
        if (filters.indexOf(filter) < 0) {
            filters.push(filter);
            target.filters = filters;
        }
        return filter;
    }

    function kggYuraFilterFrameCount(info) {
        const gameSystem = typeof $gameSystem !== 'undefined' ? $gameSystem : null;
        const graphics = typeof Graphics !== 'undefined' ? Graphics : null;
        const base = gameSystem && gameSystem.sceneCount ? gameSystem.sceneCount() : (graphics && graphics.frameCount || 0);
        const frameValue = gameSystem && gameSystem.animationWait ? gameSystem.animationWait() : info.frame;
        const frame = Math.max(1, Number(frameValue) || 1);
        return Math.floor(base / frame);
    }

    function kggUpdateYuraFilter(target) {
        const info = kggNormalizeYuraFilterInfo(target._yuraFilterInfo);
        if (!info || !kggCanUseYuraFilter()) {
            kggRemoveYuraFilter(target);
            return;
        }
        const filter = kggEnsureYuraFilter(target);
        filter.uniforms.blockSize = Math.max(1, info.blockSize);
        filter.uniforms.maxShake = info.maxShake;
        if (typeof $gameSwitches === 'undefined' || !$gameSwitches || !$gameSwitches.value(1)) {
            filter.uniforms.stepCount = kggYuraFilterFrameCount(info);
        }
        filter.uniforms.seed = info.seed;
        filter.uniforms.pixelSnap = info.pixelSnap ? 1 : 0;
        const offset = target._yuraFilterOffset || null;
        const noiseOffset = filter.uniforms.noiseOffset || (filter.uniforms.noiseOffset = [0, 0]);
        noiseOffset[0] = offset ? kggYuraFilterNumber(offset[0], 0) : info.offsetX;
        noiseOffset[1] = offset ? kggYuraFilterNumber(offset[1], 0) : info.offsetY;
        filter.padding = Math.max(0, Math.ceil(Math.abs(info.maxShake) + info.blockSize));
        target.filterArea = info.filterArea || target._yuraFilterArea || target.filterArea || null;
    }

    function kggSetYuraFilterInfo(info) {
        this._yuraFilterInfo = info || null;
        this.updateYuraFilterZXC();
    }

    function kggClearYuraFilterInfo() {
        this._yuraFilterInfo = null;
        this.updateYuraFilterZXC();
    }

    Sprite.prototype.setYuraFilterZXC = kggSetYuraFilterInfo;
    Sprite.prototype.clearYuraFilterZXC = kggClearYuraFilterInfo;
    Sprite.prototype.updateYuraFilterZXC = function() {
        kggUpdateYuraFilter(this);
    };

    function _kggCurrentLanguageIdForMask() {
        try {
            if (typeof window._lg === 'function') return Number(window._lg()) || 0;
            return Number(window._lg || 0) || 0;
        } catch (e) {
            return 0;
        }
    }

    function _kggShouldUseWhiteMaskForGray(bitmap) {
        if (_kggCurrentLanguageIdForMask() !== 1) return false; // 英語時のみ
        const face = String((bitmap && (bitmap._kggSourceFontFace || bitmap.fontFace)) || '').toLowerCase();
        if (!face) return false;
        return /schoolbell|patrick/.test(face);
    }
    const _kggDefaultSemiWhiteEdgeAlphaThreshold = 25; // 0-255: デフォルト（その他のウィンドウ）
    function _kggGetSemiWhiteEdgeAlphaThreshold(bitmap) {
        const v = bitmap && bitmap._kggSemiWhiteEdgeAlphaThreshold;
        if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(255, v));
        return _kggDefaultSemiWhiteEdgeAlphaThreshold;
    }

    //ドット風に描写
    Bitmap.prototype._applyNormalColorMask = function(white) {
        const ctx = this._context, w = this.width, h = this.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const data32 = new Uint32Array(imageData.data.buffer);
        const softenSemiTransparentEdgeBlack = !white && _kggShouldUseWhiteMaskForGray(this);
        const softenSemiTransparentEdgeWhite = !!white && _kggShouldUseWhiteMaskForGray(this);
        const color = white ? '#FFFFFF' : '#474e51';
        const r0 = parseInt(color.substr(1, 2), 16);
        const g0 = parseInt(color.substr(3, 2), 16);
        const b0 = parseInt(color.substr(5, 2), 16);
        const mask32 = (255 << 24) | (b0 << 16) | (g0 << 8) | r0;
        let changed = false;
        for (let i = 0; i < data32.length; i++) {
            const p = data32[i];
            const alpha = (p >>> 24) & 0xFF;
            if (alpha === 0) continue; // 完全に透明 → スキップ
            // 英語フォントの白マスク時は、半透明エッジを白化せず黒化（透明度は保持）
            if (softenSemiTransparentEdgeWhite && alpha !== 0xFF && alpha <= _kggGetSemiWhiteEdgeAlphaThreshold(this)) {
                const blackWithSameAlpha = (alpha << 24) | 0x00000000;
                if (p !== blackWithSameAlpha) {
                    data32[i] = blackWithSameAlpha;
                    changed = true;
                }
                continue;
            }
            if ((p & 0x00FFFFFF) === 0x00FFFFFF) {
                // 英語フォント時は、半透明白を不透明化しない（線が太く見えるのを抑える）
                if (!softenSemiTransparentEdgeBlack && !softenSemiTransparentEdgeWhite && alpha !== 0xFF) {
                    data32[i] = 0xFFFFFFFF; // 半透明の白→不透明に
                    changed = true;
                }
                continue; // 白→スキップ
            }
            // 英語フォントの黒マスク時は、半透明エッジを黒化せず白化（透明度は保持）
            if (softenSemiTransparentEdgeBlack && alpha !== 0xFF && alpha <= _kggGetSemiWhiteEdgeAlphaThreshold(this)) {
                const whiteWithSameAlpha = (alpha << 24) | 0x00FFFFFF;
                if (p !== whiteWithSameAlpha) {
                    data32[i] = whiteWithSameAlpha;
                    changed = true;
                }
                continue;
            }
            if (p !== mask32) {
                data32[i] = mask32;
                changed = true;
            }
        }
        if (changed) {
            ctx.putImageData(imageData, 0, 0);
            this._setDirty();
        }
    };

    //TilingSpriteにもゆらゆらを適用可
    TilingSprite.prototype.setYuraFilterZXC = kggSetYuraFilterInfo;
    TilingSprite.prototype.clearYuraFilterZXC = kggClearYuraFilterInfo;
    TilingSprite.prototype.updateYuraFilterZXC = function() {
        kggUpdateYuraFilter(this);
    };

    var _TilingSprite_update = TilingSprite.prototype.update;
    TilingSprite.prototype.update = function() {
        _TilingSprite_update.call(this);
        if (this._yuraFilterInfo || this._yuraFilterZXC) this.updateYuraFilterZXC();

        const yura = this._yuraInfo;
        const mesh = this._meshSprite;
        const bitmapReady = this._bitmap && this._bitmap.isReady();

        if (!yura && mesh && mesh.visible) {
            if (this._baseBitmap) this._bitmap = this._baseBitmap, this._baseBitmap = null;
            mesh.visible = false;
            return;
        }

        if (yura) {
            const info = yura.toString();
            if (this._lastInfoYura !== info) {
                if (mesh) this.removeChild(mesh);
                this._meshSprite = null;
                this._lastInfoYura = info;
            }
            if (!this._meshSprite && bitmapReady) {
                // メッシュ初回生成
                const bmp = new Bitmap(this._bitmap.width, this._bitmap.height);
                bmp.blt(this._bitmap, 0, 0, bmp.width, bmp.height, 0, 0);

                const params = [bmp, yura[0], yura[1], yura[2], yura[3]];
                const newMesh = new Sprite_Yurayura(...params);
                newMesh.visible = true;
                newMesh.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
                this._meshSprite = newMesh;
                this.addChild(newMesh);

                // baseBitmap化
                this._baseBitmap = this._bitmap;
                this._bitmap = new Bitmap(this._baseBitmap.width, this._baseBitmap.height);
            }
            if (this._meshSprite) {
                this._meshSprite._useOwnStep = !!this._yuraUseOwnStep;
                this._meshSprite.visible = true;
            }
        }

        if (this._meshSprite && this._meshSprite.visible) {
            // mesh位置合わせ（origin対応）
            this._meshSprite.x = -this.origin.x;
            this._meshSprite.y = -this.origin.y;

            this._meshSprite.updateMesh();
        }
    };

    //-----------------------------------------------------------------------------
    // アウトライン自動表示
    //-----------------------------------------------------------------------------
    
    Sprite.prototype.setOutline = function(bw, ww) {
        var f = _createOutlineFilter(this.width, this.height, bw, ww);
        this.filters = [f];
    }

    Window_Base.prototype.kggSemiWhiteEdgeAlphaThreshold = function() {
        return 25;
    };

    //-----------------------------------------------------------------------------
    // メッセージウィンドウのデザイン変更
    //-----------------------------------------------------------------------------

    Window_Message.prototype.updateBackground = function() {
        this._background = $gameMessage.background();
        if (this._background === 0 && ($gameMessage._fukidashi && $gameVariables.value(14) >= 0)) {
            this.setBackgroundType(2);
            this._windowFrameSprite._yuraInfo = null;
            this.setFukidashi();
        } else {
            if (this._fukidashiSprite) {
                this.removeChild(this._fukidashiSprite);
                this._fukidashiSprite = null;
            }
            this.setBackgroundType(this._background);
        }
    };

    Window_Message.prototype.setFukidashi = function(forceTailDir) {
        if (!this._fukidashiSprite) {
            this._fukidashiSprite = new Sprite();
            this.addChildAt(this._fukidashiSprite, this.children.indexOf(this._windowSpriteContainer));
        }

        const width = this.width * 1.5;
        const height = this.height * 1.5;
        const offsetX = this.width / 2;
        const offsetY = this.height / 2;
        
        var sp = this._fukidashiSprite;
        sp.bitmap = new Bitmap(width / 2, height / 2);
        sp.anchor.x = sp.anchor.y = 0.5;
        sp.x = offsetX, sp.y = offsetY;
        sp.scale.x = sp.scale.y = 2;
        var drawType = this instanceof Window_Message ? Number($gameVariables.value(14) || 0) : 0;
        sp._fukidashiDrawType = drawType;
        sp._fukidashiForceTailDir = forceTailDir;
        sp._fukidashiAnimStartStep = this._fukidashiSpikeAnimStep();
        sp._fukidashiAnimLastStep = null;
        sp._fukidashiAnimLastKey = null;
        sp._fukidashiGeomLock = null;
        if (this instanceof Window_Message) {
            if (drawType === 1) {
                var profile = this._fukidashiSpikeAnimProfile(sp._fukidashiAnimStartStep, sp._fukidashiAnimStartStep);
                sp._fukidashiGeomLock = {};
                profile.lock = sp._fukidashiGeomLock;
                this._drawHanddrawnFukidashi2(sp.bitmap, forceTailDir, profile);
                sp._fukidashiAnimLastStep = sp._fukidashiAnimStartStep;
                sp._fukidashiAnimLastKey = profile.key;
            }
            else if (drawType === 2) this._drawHanddrawnFukidashi3(sp.bitmap, forceTailDir);
            else if (drawType === 11) sp.bitmap = ImageManager.loadSystem('UI_message1');
            else this._drawHanddrawnFukidashi(sp.bitmap, forceTailDir);
        } else {
            this._drawHanddrawnFukidashi(sp.bitmap, forceTailDir);
        }
        sp._yuraInfo = [sp.width / 8, 5 + width / 20, 10];
        sp._baseBitmap = null, sp._lastFrame = null;
        sp.update();
    };

    var _Window_Message_update = Window_Message.prototype.update;
    Window_Message.prototype.update = function() {
        _Window_Message_update.apply(this, arguments);

        if (this._fukidashiSprite) this.updateFukidashi();
        
        if (!this._contents2) {
            this._contents2 = new Sprite();
            this._contents2._yuraInfo = [4, 15, 10, true];
            this._contents2._maskWhite = this._windowskinId === 3;
            if (typeof this.kggSemiWhiteEdgeAlphaThreshold === 'function') {
                this._contents2._kggSemiWhiteEdgeAlphaThreshold = this.kggSemiWhiteEdgeAlphaThreshold();
            }
            this._windowContentsSprite.addChild(this._contents2);
        }
        var info = JSON.stringify(this._textState);
        if (this._lastInfoTextState !== info) {
            this._lastInfoTextState = info;
            this._contents2.bitmap = this.contents;
            this._contents2._lastFrame = null;
            this._contents2._baseBitmap = null;
        }
    };

    var _Window_Message_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function(textState) {
        _Window_Message_newPage.apply(this, arguments);
        if (this._contents2) {
            this._contents2.bitmap.clear();
            if (this._contents2._meshSprite)
                this._contents2._meshSprite.texture = PIXI.Texture.from(this._contents2.bitmap);
        }
    };
    
    Window_Message.prototype.updateFukidashi = function() {
        var sp = this._fukidashiSprite;
        this._updateFukidashiSpikeAnimation(sp);
        sp.scale.x = sp.scale.y = this.isOpen() ? 2 : 1.5;
    };
    Window_Message.prototype.openSpeed = function() {
        return this._fukidashiSprite ? 255 / 6 : 32;
    };


    //-----------------------------------------------------------------------------
    // テキストアニメーション効果
    //-----------------------------------------------------------------------------
    const EF_JITTER = { amplitudePx: 2, intervalFrames: 5, jitterIcons: true };
    function snapshotTextStyle(bitmap) {
        return { fontFace: bitmap.fontFace, fontSize: bitmap.fontSize, fontBold: bitmap.fontBold,
            fontItalic: bitmap.fontItalic, textColor: bitmap.textColor, outlineColor: bitmap.outlineColor,
            outlineWidth: bitmap.outlineWidth, paintOpacity: bitmap.paintOpacity };
    };
    function applyTextStyle(bitmap, style) {
        bitmap.fontFace = style.fontFace, bitmap.fontSize = style.fontSize, bitmap.fontBold = style.fontBold;
        bitmap.fontItalic = style.fontItalic, bitmap.textColor = style.textColor, bitmap.outlineColor = style.outlineColor;
        bitmap.outlineWidth = style.outlineWidth, bitmap.paintOpacity = style.paintOpacity;
    };
    Window_Message.prototype._ensureEfJitter = function () {
        if (!this._efJitter) this._efJitter = { mode: false, items: [], layer: null, step: -1 };
        const j = this._efJitter;
        if (j.sprite) { try { j.sprite.parent && j.sprite.parent.removeChild(j.sprite); } catch (e) { } j.sprite = null; }
        if (j.layer && !j.layer.parent) j.layer = null;
        if (!j.layer) {
            j.layer = new Sprite(); j.layer.visible = false;
            if (this._windowContentsSprite) this._windowContentsSprite.addChild(j.layer); else this.addChild(j.layer);
        }
        if (j.layer.parent && j.layer.parent.setChildIndex) {
            const p = j.layer.parent; p.setChildIndex(j.layer, p.children.length - 1);
        }
        return j;
    };
    Window_Message.prototype._clearEfJitter = function () {
        if (!this._efJitter) return;
        const j = this._efJitter; j.mode = false; j.items.length = 0; j.step = -1;
        if (j.layer) {
            j.layer.visible = false;
            while (j.layer.children.length) {
                const sp = j.layer.removeChildAt(j.layer.children.length - 1); if (sp && sp.bitmap) sp.bitmap = null;
            }
        }
    };
    Window_Message.prototype._updateEfJitter = function () {
        if (!this._efJitter) return;
        const j = this._efJitter, has = j.items.length > 0; if (j.layer) j.layer.visible = has; if (!has) return;
        const interval = Math.max(1, EF_JITTER.intervalFrames | 0), sc = $gameSystem.sceneCount(), step = Math.floor(sc / interval);
        const t = (sc - step * interval) / interval, e = t * t * (3 - 2 * t), amp = Math.max(0, EF_JITTER.amplitudePx | 0);
        if (step !== j.step) {
            j.step = step;
            for (let i = 0; i < j.items.length; i++) {
                const it = j.items[i];
                it.sx = (it.dx !== undefined ? it.dx : 0); it.sy = (it.dy !== undefined ? it.dy : 0);
                const prevTx = (it.tx !== undefined ? it.tx : it.sx), prevTy = (it.ty !== undefined ? it.ty : it.sy);
                let tx = 0, ty = 0, tries = 0;
                if (amp > 0) {
                    do {
                        var r = _rand(0, 360);
                        tx = Math.round(Math.sin(r * Math.PI / 180) * amp);
                        ty = Math.round(Math.cos(r * Math.PI / 180) * amp);
                        tries++;
                    } while (Math.sqrt((tx - prevTx) * (tx - prevTx) + (ty - prevTy) * (ty - prevTy), 2) < 2 && tries < 20);
                    if (tx === prevTx && ty === prevTy) tx = (prevTx === amp ? -amp : amp);
                }
                it.tx = tx; it.ty = ty;
            }
        }
        for (let i = 0; i < j.items.length; i++) {
            const it = j.items[i];
            const sx = (it.sx !== undefined ? it.sx : 0), sy = (it.sy !== undefined ? it.sy : 0);
            const tx = (it.tx !== undefined ? it.tx : sx), ty = (it.ty !== undefined ? it.ty : sy);
            it.dx = sx + (tx - sx) * e; it.dy = sy + (ty - sy) * e;
            it.sp.x = it.bx + it.dx; it.sp.y = it.by + it.dy;
        }
    };

    const _kggEf_processEscapeCharacter = Window_Message.prototype.processEscapeCharacter;
    Window_Message.prototype.processEscapeCharacter = function (code, textState) {
        if (code === 'EF') {
            const j = this._ensureEfJitter(); textState._efMode = !textState._efMode; j.mode = textState._efMode; return;
        }
        if (EF_JITTER.jitterIcons && code === 'I' && textState && textState._efMode) {
            const j = this._ensureEfJitter(), iconIndex = this.obtainEscapeParam(textState);
            const pw = Window_Base._iconWidth, ph = Window_Base._iconHeight, fontSize = this.contents.fontSize;
            const ss = Math.floor(pw * fontSize / 32), sx = (iconIndex % 16) * pw, sy = Math.floor(iconIndex / 16) * ph;
            const bmp = new Bitmap(Math.max(1, ss), Math.max(1, ss)); bmp._context.imageSmoothingEnabled = false;
            const iconset = ImageManager.loadSystem('IconSet'); if (iconset.isReady()) bmp.blt(iconset, sx, sy, pw, ph, 0, 0, ss, ss);
            const sp = new Sprite(bmp); sp._yuraInfo = [4, 15, 10, true]; sp._maskWhite = (this._windowskinId === 3);
            if (typeof this.kggSemiWhiteEdgeAlphaThreshold === 'function') {
                sp._kggSemiWhiteEdgeAlphaThreshold = this.kggSemiWhiteEdgeAlphaThreshold();
            }
            const x = textState.x, y = Math.ceil(textState.y + 10 - fontSize / 3);
            sp.x = x; sp.y = y; j.layer.addChild(sp);
            const amp = Math.max(0, EF_JITTER.amplitudePx | 0), dx0 = _rand(-amp, amp), dy0 = _rand(-amp, amp);
            j.items.push({ type: 'icon', sp: sp, bx: sp.x, by: sp.y, dx: dx0, dy: dy0, sx: dx0, sy: dy0, tx: dx0, ty: dy0 });
            textState.x += (pw + 2) * fontSize / 32; if (iconIndex === 16) textState.x -= 10 * fontSize / 32;
            return;
        }
        return _kggEf_processEscapeCharacter.call(this, code, textState);
    };

    const _kggEf_processNormalCharacter = Window_Message.prototype.processNormalCharacter;
    Window_Message.prototype.processNormalCharacter = function (textState) {
        if (!textState || !textState._efMode) return _kggEf_processNormalCharacter.call(this, textState);
        const j = this._ensureEfJitter(), c = textState.text[textState.index++];
        const style = snapshotTextStyle(this.contents), w = this.textWidth(c), h = textState.height;
        const pad = 4, bw = Math.ceil(w * 2) + pad * 2, bh = Math.ceil(h) + pad * 2;
        const bmp = new Bitmap(Math.max(1, bw), Math.max(1, bh));
        applyTextStyle(bmp, style); bmp.drawText(c, pad, pad, bw - pad * 2, bh - pad * 2, 'left');
        const sp = new Sprite(bmp); sp._yuraInfo = [4, 15, 10, true]; sp._maskWhite = (this._windowskinId === 3);
        if (typeof this.kggSemiWhiteEdgeAlphaThreshold === 'function') {
            sp._kggSemiWhiteEdgeAlphaThreshold = this.kggSemiWhiteEdgeAlphaThreshold();
        }
        sp.x = textState.x - pad; sp.y = textState.y - pad; j.layer.addChild(sp);
        const amp = Math.max(0, EF_JITTER.amplitudePx | 0), dx0 = _rand(-amp, amp), dy0 = _rand(-amp, amp);
        j.items.push({ type: 'char', sp: sp, bx: sp.x, by: sp.y, dx: dx0, dy: dy0, sx: dx0, sy: dy0, tx: dx0, ty: dy0 });
        textState.x += w; this.processCharSE();
    };

    const _kggEf_startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        this._ensureEfJitter(); this._clearEfJitter(); _kggEf_startMessage.call(this);
        if (this._textState) this._textState._efMode = false;
    };
    const _kggEf_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function (textState) {
        _kggEf_newPage.call(this, textState); this._ensureEfJitter(); this._clearEfJitter();
        if (textState) textState._efMode = false;
    };
    const _kggEf_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function () { _kggEf_terminateMessage.call(this); this._clearEfJitter(); };
    const _kggEf_update = Window_Message.prototype.update;
    Window_Message.prototype.update = function () {
        _kggEf_update.apply(this, arguments);
        if (this._efJitter && this._efJitter.items && this._efJitter.items.length > 0) this._updateEfJitter();
    };

    //特殊処理
    const _Window_Message_processNormalCharacter = Window_Message.prototype.processNormalCharacter;
    Window_Message.prototype.processNormalCharacter = function (textState) {
        var c = textState.text[textState.index];
        if (c === 'ー' && textState.text[textState.index - 1] === c) textState.x -= 4 * this.contents.fontSize / 32;
        if (c === '～' && textState.text[textState.index - 1] === c) textState.x -= 6 * this.contents.fontSize / 32;
        _Window_Message_processNormalCharacter.apply(this, arguments);
    };
    
    //選択肢ウィンドウ
    function knhIsSystemChoicePopup() {
        var scene = SceneManager._scene;
        var info = scene && scene._sceneInfo;
        return !!($gameSwitches.value(4) || (info && (info.shop || info.systemMessage ||
            (info.type === 'playerDrawing' && info.phase === 'doneConfirm'))));
    }

    function knhIsPlayerDrawingDoneConfirm() {
        var scene = SceneManager._scene;
        var info = scene && scene._sceneInfo;
        return !!(info && info.type === 'playerDrawing' && info.phase === 'doneConfirm');
    }

    function knhPlacePopupBelowMessage(win) {
        var scene = SceneManager._scene;
        var messageWindow = scene && scene._messageWindow;
        var margin = 8;
        var gap = 8;
        if (messageWindow) {
            win.x = messageWindow.x + messageWindow.width / 2 - win.width / 2;
            win.y = messageWindow.y + messageWindow.height + gap;
            if (win.y + win.height > Graphics.boxHeight - margin) {
                win.y = messageWindow.y - win.height - gap;
            }
        } else {
            win.x = Graphics.boxWidth / 2 - win.width / 2;
            win.y = Graphics.boxHeight / 2 + gap;
        }
        win.x = Math.max(margin, Math.min(win.x, Graphics.boxWidth - win.width - margin));
        win.y = Math.max(margin, Math.min(win.y, Graphics.boxHeight - win.height - margin));
    }

    Window_ChoiceList.prototype.isPopup = function () {
        return true;
    };
    const _Window_ChoiceList_updatePlacement = Window_ChoiceList.prototype.updatePlacement;
    Window_ChoiceList.prototype.updatePlacement = function () {
        _Window_ChoiceList_updatePlacement.apply(this, arguments);
        if (SceneManager._scene._messageWindow.isClosed()) this.updatePlacementPopup();
    };
    Window_ChoiceList.prototype.updatePlacementPopup = function() {
        var skipGridSnap = false;
        if (knhIsPlayerDrawingDoneConfirm()) {
            knhPlacePopupBelowMessage(this);
            skipGridSnap = true;
        } else if (knhIsSystemChoicePopup()) { //システムメッセージ
            this.x = Graphics.boxWidth / 2 - this.width / 2;
            this.y = Graphics.boxHeight / 2 - this.height / 2;
        } else if ($gameParty.inBattle()) {
            var sp = SceneManager._scene.turnActorSprite();
            this.x = sp.x - this.width / 2;
            this.y = sp.y - 150 - this.height;
        } else if ($gameSwitches.value(31)) {
            this.x = 300 - this.width / 2, this.y = 400 - this.height / 2;
        } else {
            this.x = $gamePlayer.screenX() - this.width / 2;
            this.y = $gamePlayer.screenY() - ($gameSwitches.value(23) ? -33 : (120 + this.height));
        }
        if (skipGridSnap) return;
        var y2 = this.y + $gameMap.parallaxOy(), gh = 33.3125;
        this.y = (y2 - y2 % gh) - $gameMap.parallaxOy();
    };
    var _Window_ChoiceList_maxChoiceWidth = Window_ChoiceList.prototype.maxChoiceWidth;
    Window_ChoiceList.prototype.maxChoiceWidth = function() {
        return Math.ceil(_Window_ChoiceList_maxChoiceWidth.apply(this, arguments)) + 12;
    };
    Window_ChoiceList.prototype.updateBackground = function() {
        Window_Message.prototype.updateBackground.apply(this, arguments);
        if (this._background === 2) {
            this.setBackgroundType(2);
            this._windowFrameSprite._yuraInfo = null;
            this.setFukidashi();
        }
    };
    Window_ChoiceList.prototype.setFukidashi = function() {
        var dir = SceneManager._scene._sceneInfo && SceneManager._scene._sceneInfo.shop ? 5 :
            $gameSwitches.value(31) ? 5 : 
            $gameSwitches.value(23) ? 8 : 2;
        Window_Message.prototype.setFukidashi.call(this, dir);
    };

    var _Window_ChoiceList_update = Window_ChoiceList.prototype.update;
    Window_ChoiceList.prototype.update = function() {
        _Window_ChoiceList_update.apply(this, arguments);
        if (this._fukidashiSprite) this.updateFukidashi();
    };
    Window_ChoiceList.prototype.updateFukidashi = function() {
        var sp = this._fukidashiSprite;
        this._updateFukidashiSpikeAnimation(sp);
        sp.scale.x = sp.scale.y = this.isOpen() ? 2 : 1.5;
    };
    Window_ChoiceList.prototype.openSpeed = function() {
        return this._fukidashiSprite ? 255 / 6 : 32;
    };
    Window_ChoiceList.prototype.drawItem = function(index) {
        var rect = this.itemRectForText(index);
        this.drawTextEx(this.commandName(index), rect.x + 12, rect.y);
    };

    //数値入力ウィンドウ
    Window_NumberInput.prototype.updatePlacementPopup = function () {
        if (knhIsSystemChoicePopup()) { //システムメッセージ
            this.x = Graphics.boxWidth / 2 - this.width / 2;
            this.y = Graphics.boxHeight / 2 - this.height / 2;
        } else {
            this.x = $gamePlayer.screenX() - this.width / 2;
            this.y = $gamePlayer.screenY() - 120 - this.height;
        }
        var y2 = this.y + $gameMap.parallaxOy(), gh = 33.3125;
        this.y = (y2 - y2 % gh + 6) - $gameMap.parallaxOy();
    };
    Window_NumberInput.prototype.updateBackground = function () {
        Window_Message.prototype.updateBackground.apply(this, arguments);
    };
    Window_NumberInput.prototype.setFukidashi = function () {
        var dir = SceneManager._scene._sceneInfo && SceneManager._scene._sceneInfo.shop ? 5 : 2;
        Window_Message.prototype.setFukidashi.call(this, dir);
    };

    var _Window_NumberInput_update = Window_NumberInput.prototype.update;
    Window_NumberInput.prototype.update = function () {
        _Window_NumberInput_update.apply(this, arguments);
        if (this._fukidashiSprite) this.updateFukidashi();
    };
    Window_NumberInput.prototype.updateFukidashi = function () {
        var sp = this._fukidashiSprite;
        this._updateFukidashiSpikeAnimation(sp);
        sp.scale.x = sp.scale.y = this.isOpen() ? 2 : 1.5;
    };
    Window_NumberInput.prototype.openSpeed = function () {
        return this._fukidashiSprite ? 255 / 6 : 32;
    };

    //-----------------------------------------------------------------------------
    // 手描きふきだし描画 - $gameMessage._tailDir (1～9／5はしっぽ無し) で方位指定
    //-----------------------------------------------------------------------------
    
    // shape tuning (0: ellipse, 1: rectangle)
    const FUKI_SHAPE_SQUARE = 0.5;
    const FUKI_SHAPE_PAD = 0;
    const FUKI_SHAPE_N_MAX = 5;
    const FUKI_TAIL_W = 9;
    const FUKI_TAIL_H = 12;
    const FUKI_SPIKE_OUT = 12;
    const FUKI_SPIKE_IN = 8;
    const FUKI_SPIKE_PITCH = 18;
    const FUKI_SPIKE_MIN = 16;
    const FUKI_SPIKE_DEBUG = false;
    const FUKI_TAIL_PULL = 0.65;
    const FUKI_SPIKE_ANIM_B_SCALE = 1.02;
    const FUKI_SPIKE_ANIM_C_SCALE = 1.04;
    const FUKI_SPIKE_ANIM_B_OUT_ADD = 1;
    const FUKI_SPIKE_ANIM_C_OUT_ADD = 5;
    const FUKI_SPIKE_ANIM_SEQ = ['A', 'B', 'C', 'B'];
    const FUKI_SPIKE_ANIM_SEQ_BATTLE = ['C', 'B', 'A', 'B'];

    var _fukiSign = function(v) { return v === 0 ? 0 : (v > 0 ? 1 : -1); };

    Window_Base.prototype._fukidashiShapeInfo = function (baseW, baseH) {
        var bw = Math.max(1, baseW);
        var bh = Math.max(1, baseH);
        var sBase = Math.max(0, Math.min(1, FUKI_SHAPE_SQUARE));
        var ratio = Math.min(bw, bh) / Math.max(bw, bh);
        var s = sBase * (1 - ratio);
        var pad = FUKI_SHAPE_PAD * s;
        var a0 = bw / 2;
        var b0 = bh / 2;
        var a1 = (bw + pad * 2) / 2;
        var b1 = (bh + pad * 2) / 2;
        var a = a0 + (a1 - a0) * s;
        var b = b0 + (b1 - b0) * s;
        var n = 2 + (FUKI_SHAPE_N_MAX - 2) * s;
        return { a: a, b: b, aRect: a1, bRect: b1, square: s, n: n };
    };

    Window_Base.prototype._fukidashiTailSize = function (baseW, baseH) {
        var bw = Math.max(1, baseW);
        var bh = Math.max(1, baseH);
        var maxW = Math.max(1, bw * 0.6);
        var maxH = Math.max(1, bh * 0.8);
        var w = Math.min(FUKI_TAIL_W, maxW);
        var h = Math.min(FUKI_TAIL_H, maxH);
        return { w: w, h: h };
    };

    Window_Base.prototype._fukidashiSpikeAnimStep = function() {
        var frame = Number($gameSystem && $gameSystem.animationWait ? $gameSystem.animationWait() : 10);
        if (!isFinite(frame) || frame <= 0) frame = 1;
        var count = ($gameSystem && $gameSystem.sceneCount) ? $gameSystem.sceneCount() : Graphics.frameCount;
        var meshStep = Math.floor(count / frame);
        var phase = ((count % frame) + frame) % frame;
        var halfStep = (phase * 2 >= frame) ? 1 : 0;
        // Even step: synchronized with mesh pattern switch. Odd step: midpoint extra update.
        return meshStep * 2 + halfStep;
    };

    Window_Base.prototype._fukidashiSpikeAnimProfile = function(step, startStep) {
        var seq = ($gameParty && $gameParty.inBattle && $gameParty.inBattle()) ? FUKI_SPIKE_ANIM_SEQ_BATTLE : FUKI_SPIKE_ANIM_SEQ;
        var base = (typeof startStep === 'number' && isFinite(startStep)) ? startStep : step;
        var adv = step - base;
        var idx = (adv % seq.length + seq.length) % seq.length;
        var key = seq[idx];
        var scale = 1;
        var spikeOutAdd = 0;
        if (key === 'B') {
            scale = FUKI_SPIKE_ANIM_B_SCALE;
            spikeOutAdd = FUKI_SPIKE_ANIM_B_OUT_ADD;
        } else if (key === 'C') {
            scale = FUKI_SPIKE_ANIM_C_SCALE;
            spikeOutAdd = FUKI_SPIKE_ANIM_C_OUT_ADD;
        }
        return { key: key, scale: scale, tailScale: scale, spikeOutAdd: spikeOutAdd };
    };

    Window_Base.prototype._updateFukidashiSpikeAnimation = function(sp) {
        if (!sp || sp._fukidashiDrawType !== 1) return;
        var step = this._fukidashiSpikeAnimStep();
        if (sp._fukidashiAnimLastStep === step) return;
        var profile = this._fukidashiSpikeAnimProfile(step, sp._fukidashiAnimStartStep);
        profile.lock = sp._fukidashiGeomLock || null;
        var targetBmp = sp._baseBitmap || sp.bitmap;
        if (!targetBmp || typeof targetBmp.clear !== 'function') return;
        targetBmp.clear();
        this._drawHanddrawnFukidashi2(targetBmp, sp._fukidashiForceTailDir, profile);
        sp._fukidashiAnimLastStep = step;
        sp._fukidashiAnimLastKey = profile.key;
        sp._lastFrame = null;
        if (sp._meshSprite) {
            sp._meshSprite._meshDirty = true;
            sp._meshSprite._lastPattern = null;
        }
    };

    Window_Base.prototype._fukidashiBoundaryPoint = function (cx, cy, shape, theta) {
        var ct = Math.cos(theta);
        var st = Math.sin(theta);
        if (shape.square >= 1) {
            var dx = ct;
            var dy = st;
            var kx = shape.aRect / Math.max(0.0001, Math.abs(dx));
            var ky = shape.bRect / Math.max(0.0001, Math.abs(dy));
            var k = Math.min(kx, ky);
            return { x: cx + dx * k, y: cy + dy * k };
        }
        var n = shape.n || 2;
        var x = shape.a * _fukiSign(ct) * Math.pow(Math.abs(ct), 2 / n);
        var y = shape.b * _fukiSign(st) * Math.pow(Math.abs(st), 2 / n);
        return { x: cx + x, y: cy + y };
    };

    // 画面方向角(レイ角) -> 輪郭パラメータ角
    Window_Base.prototype._fukidashiDirectionToParamAngle = function(shape, theta) {
        if (shape.square >= 1) return theta;
        var twoPi = Math.PI * 2;
        var ang = ((theta % twoPi) + twoPi) % twoPi;
        var ct = Math.cos(ang);
        var st = Math.sin(ang);
        var eps = 0.0000001;
        if (Math.abs(ct) <= eps) return st >= 0 ? Math.PI / 2 : Math.PI * 1.5;
        if (Math.abs(st) <= eps) return ct >= 0 ? 0 : Math.PI;
        var a = Math.max(0.0001, shape.a);
        var b = Math.max(0.0001, shape.b);
        var n = Math.max(0.0001, shape.n || 2);
        var alpha = Math.atan(Math.abs(st / ct));
        var tanT = Math.pow((a / b) * Math.tan(alpha), n / 2);
        var tAbs = Math.atan(Math.max(0, tanT));
        if (ct > 0 && st > 0) return tAbs;
        if (ct < 0 && st > 0) return Math.PI - tAbs;
        if (ct < 0 && st < 0) return Math.PI + tAbs;
        return twoPi - tAbs;
    };

    // 指定角度のしっぽ根本点（角度レイと輪郭の交点）
    Window_Base.prototype._fukidashiBoundaryPointByRay = function (cx, cy, shape, theta) {
        var t = this._fukidashiDirectionToParamAngle(shape, theta);
        return this._fukidashiBoundaryPoint(cx, cy, shape, t);
    };

    Window_Base.prototype._fukidashiBmpToWindowPos = function(bmp, x, y) {
        var sp = this._fukidashiSprite;
        if (!sp || !sp.bitmap || sp.bitmap !== bmp) return null;
        var ax = sp.anchor ? sp.anchor.x : 0;
        var ay = sp.anchor ? sp.anchor.y : 0;
        var sx = sp.scale ? sp.scale.x : 1;
        var sy = sp.scale ? sp.scale.y : 1;
        var lx = sp.x + (x - bmp.width * ax) * sx;
        var ly = sp.y + (y - bmp.height * ay) * sy;
        return {
            x: lx,
            y: ly,
            gx: this.x + lx,
            gy: this.y + ly
        };
    };

    Window_Base.prototype._fukidashiGlobalToBmpPos = function(bmp, gx, gy) {
        var sp = this._fukidashiSprite;
        if (!sp || !sp.bitmap || sp.bitmap !== bmp) return null;
        var ax = sp.anchor ? sp.anchor.x : 0;
        var ay = sp.anchor ? sp.anchor.y : 0;
        var sx = sp.scale ? sp.scale.x : 1;
        var sy = sp.scale ? sp.scale.y : 1;
        if (Math.abs(sx) < 0.0001 || Math.abs(sy) < 0.0001) return null;
        var lx = gx - this.x;
        var ly = gy - this.y;
        return {
            x: (lx - sp.x) / sx + bmp.width * ax,
            y: (ly - sp.y) / sy + bmp.height * ay
        };
    };

    Window_Base.prototype._popupTailCharacterCenterToBmp = function(bmp) {
        if (!(this instanceof Window_Message)) return null;
        if (!$gameMessage) return null;
        if (this._popupFreePos) return null;
        if (!$gameSystem || !$gameSystem.getMessagePopupId || !$gameSystem.getMessagePopupFree) return null;
        if (!$gameSystem.getMessagePopupId() || $gameSystem.getMessagePopupFree()) return null;
        var gx = $gameMessage._popupTailCharacterCenterX;
        var gy = $gameMessage._popupTailCharacterCenterY;
        if (!isFinite(gx) || !isFinite(gy)) return null;
        return this._fukidashiGlobalToBmpPos(bmp, gx, gy);
    };

    Window_Base.prototype._fukidashiNearestBoundaryToPoint = function(cx, cy, shape, target, samples) {
        if (!target) return null;
        var n = Math.max(24, samples || 180);
        var twoPi = Math.PI * 2;
        var bestT = 0;
        var bestP = null;
        var bestD2 = Infinity;
        for (var i = 0; i < n; i++) {
            var t = twoPi * i / n;
            var p = this._fukidashiBoundaryPoint(cx, cy, shape, t);
            var dx = p.x - target.x;
            var dy = p.y - target.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                bestT = t;
                bestP = p;
            }
        }
        var step = twoPi / n;
        for (var pass = 0; pass < 4; pass++) {
            var start = bestT - step;
            var end = bestT + step;
            for (var j = 0; j <= 12; j++) {
                var tt = start + (end - start) * j / 12;
                var pp = this._fukidashiBoundaryPoint(cx, cy, shape, tt);
                var ddx = pp.x - target.x;
                var ddy = pp.y - target.y;
                var dd2 = ddx * ddx + ddy * ddy;
                if (dd2 < bestD2) {
                    bestD2 = dd2;
                    bestT = tt;
                    bestP = pp;
                }
            }
            step /= 3;
        }
        return {
            t: bestT,
            point: bestP,
            dist: Math.sqrt(bestD2)
        };
    };

    // ランダム揺れ
    Window_Base.prototype._fukidashiJitter = function (w) {
        return (Math.random() * 12 - 6) * (w / 800) / 10;
    };

    // しっぽ３点（左右・先端）を返す
    Window_Base.prototype._fukidashiTailPoints = function (
    cx, cy, shape, angle, tW, tH, isLong, noJitter, rootOverride
    ) {
        if (angle === null || angle === undefined) return null;

        const out = angle * Math.PI / 180;
        const per = out + Math.PI / 2;
        const b = rootOverride || this._fukidashiBoundaryPointByRay(cx, cy, shape, out);
        const bx = b.x;
        const by = b.y;
        const j = noJitter ? function() { return 0; } : this._fukidashiJitter.bind(this);
        const w = (shape.aRect || shape.a) * 2;
        const m = 1;

        const R = { x: bx - Math.cos(per) * tW / 2 + j(w), y: by - Math.sin(per) * tW / 2 + j(w) };
        const L = { x: bx + Math.cos(per) * tW / 2 + j(w), y: by + Math.sin(per) * tW / 2 + j(w) };
        const T = { x: bx + Math.cos(out) * tH * m + j(w), y: by + Math.sin(out) * tH * m + j(w) };
        const pOut = this._fukidashiDirectionToParamAngle(shape, out);
        const bParam = this._fukidashiBoundaryPoint(cx, cy, shape, pOut);
        this._fukidashiTailDebug = {
            cx: cx, cy: cy, bx: bx, by: by, angle: angle,
            outRad: out, paramRad: pOut,
            bParamX: bParam.x, bParamY: bParam.y,
            shapeA: shape.a, shapeB: shape.b, shapeN: shape.n, shapeSquare: shape.square,
            tW: tW, tH: tH, L: L, T: T, R: R
        };

        return [L, T, R, angle];
    };

    Window_Base.prototype._fukidashiDirToAngle = function(dir) {
        return {1: 120, 2: 90, 3: 60, 4: 180, 5: null, 6: 0, 7: 240, 8: 270, 9: 300}[dir];
    };

    Window_Base.prototype._hasComputedPopupTailAngle = function() {
        if (!(this instanceof Window_Message)) return false;
        if (!$gameMessage || !$gameMessage._fukidashi) return false;
        if (typeof $gameMessage._realTailAngle !== 'number' || !isFinite($gameMessage._realTailAngle)) return false;
        if (!$gameSystem || !$gameSystem.getMessagePopupId || !$gameSystem.getMessagePopupFree) return false;
        return !!$gameSystem.getMessagePopupId() && !$gameSystem.getMessagePopupFree();
    };

    Window_Base.prototype._resolveFukidashiTailAngle = function(tailDir, forceTailDir) {
        var canUseAutoTail = this._hasComputedPopupTailAngle();
        if (tailDir !== undefined && tailDir !== null) {
            return this._fukidashiDirToAngle(tailDir);
        }
        var msgTailDir = $gameMessage ? Number($gameMessage._tailDir) : NaN;
        if (!forceTailDir && msgTailDir === 5) {
            return null;
        }
        if (!forceTailDir && canUseAutoTail && typeof $gameMessage._realTailAngle === 'number' && isFinite($gameMessage._realTailAngle)) {
            return ($gameMessage._realTailAngle % 360 + 360) % 360;
        }
        const dir = $gameMessage._realTailDir || $gameMessage._tailDir || 2;
        return this._fukidashiDirToAngle(dir);
    };

    // 塗りつぶし＆外線描画
    Window_Base.prototype._fukidashiRender = function (bmp, pts, tailPts, type, useLine) {
        const c = bmp._context;
        const quad = (a, b) => c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        const quadTo = (a, b) => c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2, b.x, b.y);
        const quadCtrl = (ctrl, end) => c.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
        this._fukidashiTailDebugRender = null;

        for (let pass = 0; pass < 2; pass++) {
            c.save();
            c.imageSmoothingEnabled = false;
            bmp._baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

            c.beginPath();
            c.moveTo(pts[0].x, pts[0].y);
            if (type === 2 && pts.length >= 3 && !useLine) {
                if (pts[0] && pts[0].peak === false) {
                    c.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                        const p = pts[i];
                        if (p.peak) {
                            c.lineTo(p.x, p.y);
                        } else {
                            if (i + 1 < pts.length) {
                                const nextPeak = pts[i + 1];
                                c.quadraticCurveTo(p.x, p.y, nextPeak.x, nextPeak.y);
                                i++;
                            } else {
                                c.lineTo(p.x, p.y);
                            }
                        }
                    }
                } else {
                    for (let i = 1; i < pts.length - 1; i += 2) {
                        const valley = pts[i];
                        const nextPeak = pts[i + 1];
                        c.quadraticCurveTo(valley.x, valley.y, nextPeak.x, nextPeak.y);
                    }
                }
            } else {
                for (let i = 1; i < pts.length; i++) {
                    if (useLine) c.lineTo(pts[i].x, pts[i].y);
                    else if (type === 2) {
                        if (i % 2) c.lineTo(pts[i].x, pts[i].y);
                        else quadTo(pts[i - 1], pts[i]);
                    } else {
                        quad(pts[i - 1], pts[i]);
                    }
                }
            }

            if (tailPts) {
                if (type === 2 && tailPts.length === 3 && pts.length >= 2) {
                    const tailPeak = tailPts[0];
                    const ctrlStart = tailPts[1];
                    const ctrlEnd = tailPts[2];
                    const pLast = pts[pts.length - 1];
                    const pFirst = pts[0];
                    const d = (a, b) => {
                        const dx = a.x - b.x;
                        const dy = a.y - b.y;
                        return Math.sqrt(dx * dx + dy * dy);
                    };
                    let safeCtrlEnd = ctrlEnd;
                    let safeCtrlStart = ctrlStart;
                    const seam = d(pLast, pFirst);
                    const ctrlTh = Math.max(18, seam * 1.4);
                    const endDist = d(ctrlEnd, pLast);
                    const startDist = d(ctrlStart, pFirst);
                    let fallback = false;
                    if (endDist > ctrlTh) {
                        safeCtrlEnd = {
                            x: pLast.x + (tailPeak.x - pLast.x) * 0.35,
                            y: pLast.y + (tailPeak.y - pLast.y) * 0.35
                        };
                        fallback = true;
                    }
                    if (startDist > ctrlTh) {
                        safeCtrlStart = {
                            x: pFirst.x + (tailPeak.x - pFirst.x) * 0.35,
                            y: pFirst.y + (tailPeak.y - pFirst.y) * 0.35
                        };
                        fallback = true;
                    }
                    this._fukidashiTailDebugRender = {
                        fallback: fallback,
                        seamDist: (d({ x: (pLast.x + pFirst.x) / 2, y: (pLast.y + pFirst.y) / 2 }, tailPeak)),
                        seamChord: seam,
                        threshold: ctrlTh,
                        drawSeq: 'last->ctrlEnd->peak->ctrlStart->first(type2)'
                    };
                    quadCtrl(safeCtrlEnd, tailPeak);
                    quadCtrl(safeCtrlStart, pts[0]);
                } else {
                    const [L, T, R, ang, cL, cR] = tailPts;
                    let l = L;
                    let t = T;
                    let r = R;
                    let fallback = false;
                    let seamDist = 0;
                    let seamChord = 0;
                    if (type === 1 && pts && pts.length >= 2) {
                        const firstP = pts[0];
                        const lastP = pts[pts.length - 1];
                        const rootX = (l.x + r.x) / 2;
                        const rootY = (l.y + r.y) / 2;
                        const seamMidX = (firstP.x + lastP.x) / 2;
                        const seamMidY = (firstP.y + lastP.y) / 2;
                        seamDist = Math.sqrt((rootX - seamMidX) * (rootX - seamMidX) + (rootY - seamMidY) * (rootY - seamMidY));
                        seamChord = Math.sqrt((firstP.x - lastP.x) * (firstP.x - lastP.x) + (firstP.y - lastP.y) * (firstP.y - lastP.y));
                        const th = Math.max(24, seamChord * 0.75);
                        if (seamDist > th) {
                            const dx = t.x - rootX;
                            const dy = t.y - rootY;
                            const len = Math.sqrt(dx * dx + dy * dy) || 1;
                            const ux = dx / len;
                            const uy = dy / len;
                            l = { x: lastP.x, y: lastP.y };
                            r = { x: firstP.x, y: firstP.y };
                            t = { x: seamMidX + ux * len, y: seamMidY + uy * len };
                            fallback = true;
                        }
                        this._fukidashiTailDebugRender = {
                            fallback: fallback,
                            seamDist: seamDist,
                            seamChord: seamChord,
                            threshold: Math.max(24, seamChord * 0.75),
                            drawSeq: 'last->L->T->R->first'
                        };
                    }
                    if (type === 1) {
                        c.lineTo(l.x, l.y);
                        c.lineTo(t.x, t.y);
                        c.lineTo(r.x, r.y);
                        c.lineTo(pts[0].x, pts[0].y);
                    } else if (type === 2 && cL && cR) {
                        quadCtrl(cL, L);
                        quadCtrl(cL, T);
                        quadCtrl(cR, R);
                        quadCtrl(cR, pts[0]);
                    } else {
                        quad(pts[pts.length - 1], l);
                        quad(l, t);
                        c.lineTo(t.x, t.y);
                        quad(t, r);
                        quad(r, pts[0]);
                    }
                }
            } else {
                quad(pts[pts.length - 1], pts[0]);
            }
            c.closePath();

            c.fillStyle = 'white';
            c.fill();
            c.strokeStyle = ['white', this.normalColor()][pass];
            c.lineJoin = c.lineCap = 'round';
            c.lineWidth = [6, 2][pass];
            c.stroke();
            c.restore();
        }
        bmp._setDirty();
        bmp._applyNormalColorMask();

    };

    //1 基本ふきだし
    Window_Base.prototype._drawHanddrawnFukidashi = function (bmp, tailDir, forceTailDir) {
        const W = bmp.width, H = bmp.height, M = 8;
        const baseW = (W * 0.8 - M * 2);
        const baseH = (H * 0.8 - M * 2);
        const shape = this._fukidashiShapeInfo(baseW, baseH);
        const CX = W / 2, CY = H / 2;
        const tailSize = this._fukidashiTailSize(baseW, baseH);
        const tW = tailSize.w, tH = tailSize.h;
        let angDir = this._resolveFukidashiTailAngle(tailDir, forceTailDir);
        let tail = angDir !== null;
        let angParam = tail ? this._fukidashiDirectionToParamAngle(shape, angDir * Math.PI / 180) * 180 / Math.PI : null;
        let rootOverride = null;
        let targetBmp = null;
        let nearest = null;
        let rootSource = 'dirRay';
        if (tail) {
            targetBmp = this._popupTailCharacterCenterToBmp(bmp);
            if (targetBmp) {
                nearest = this._fukidashiNearestBoundaryToPoint(CX, CY, shape, targetBmp, 180);
                if (nearest && nearest.point) {
                    rootOverride = nearest.point;
                    angParam = ((nearest.t * 180 / Math.PI) % 360 + 360) % 360;
                    angDir = (Math.atan2(targetBmp.y - rootOverride.y, targetBmp.x - rootOverride.x) * 180 / Math.PI + 360) % 360;
                    rootSource = 'nearestToCharacterCenter';
                }
            }
        }
        const gap = 12;
        const pts = [];
        const j = this._fukidashiJitter.bind(this);
        const useLine = shape.square >= 1;

        const seamAngle = (angParam === null || angParam === undefined) ? 90 : angParam;
        for (let d = seamAngle - 10; d >= seamAngle - 350; d -= 10) {
            const a = (d + 360) % 360;
            if (tail && Math.abs(((a - angParam + 540) % 360) - 180) < gap) continue;
            const r = d * Math.PI / 180;
            const p = this._fukidashiBoundaryPoint(CX, CY, shape, r);
            pts.push({ x: p.x + j(W), y: p.y + j(W) });
        }

        const tailPts = this._fukidashiTailPoints(CX, CY, shape, angDir, tW, tH, false, true, rootOverride);
        if (this._fukidashiTailDebug) {
            this._fukidashiTailDebug.rootSource = rootSource;
            this._fukidashiTailDebug.targetX = targetBmp ? targetBmp.x : null;
            this._fukidashiTailDebug.targetY = targetBmp ? targetBmp.y : null;
            this._fukidashiTailDebug.nearestDist = nearest ? nearest.dist : null;
        }
        this._fukidashiRender(bmp, pts, tailPts, 1, useLine);
    };

    //2　ギザギザふきだし
    Window_Base.prototype._drawHanddrawnFukidashi2 = function (bmp, tailDir, animProfile) {
        this._fukidashiTailDebug = null;
        const profile = animProfile || {};
        const lock = profile.lock || null;
        const shapeScale = Math.max(0.5, Number(profile.scale || 1));
        const tailScale = Math.max(0.5, Number(profile.tailScale || shapeScale));
        const spikeOut = Math.max(0, FUKI_SPIKE_OUT + Number(profile.spikeOutAdd || 0));
        const W = bmp.width, H = bmp.height, M = 8;
        const baseW = (W * 0.7 - M * 2) * shapeScale;       // 少し小さめにしてスパイクを際立たせる
        const baseH = (H * 0.7 - M * 2) * shapeScale;
        const shape = this._fukidashiShapeInfo(baseW, baseH);
        const tailShape = this._fukidashiShapeInfo(baseW * 1.25, baseH * 1.25);
        const CX = W / 2, CY = H / 2;
        const tailSize = this._fukidashiTailSize(baseW, baseH);
        const tW = tailSize.w * tailScale, tH = tailSize.h * tailScale;
        const angDir0 = this._resolveFukidashiTailAngle(tailDir);
        const tail = angDir0 !== null;
        const angParam0 = tail ? this._fukidashiDirectionToParamAngle(shape, angDir0 * Math.PI / 180) * 180 / Math.PI : null;
        let angDir = angDir0;
        let angParam = angParam0;
        let targetBmp = null;
        let nearest = null;
        let rootSource = 'dirRay';
        if (tail) {
            if (lock && typeof lock.angParam === 'number' && isFinite(lock.angParam)) {
                angParam = ((lock.angParam % 360) + 360) % 360;
                if (typeof lock.angDir === 'number' && isFinite(lock.angDir)) {
                    angDir = ((lock.angDir % 360) + 360) % 360;
                }
                rootSource = 'lockedRoot';
            } else {
                targetBmp = this._popupTailCharacterCenterToBmp(bmp);
                if (targetBmp) {
                    nearest = this._fukidashiNearestBoundaryToPoint(CX, CY, shape, targetBmp, 180);
                    if (nearest && nearest.point) {
                        angParam = ((nearest.t * 180 / Math.PI) % 360 + 360) % 360;
                        angDir = (Math.atan2(targetBmp.y - nearest.point.y, targetBmp.x - nearest.point.x) * 180 / Math.PI + 360) % 360;
                        rootSource = 'nearestToCharacterCenter';
                    }
                }
                if (lock) {
                    lock.angParam = angParam;
                    lock.angDir = angDir;
                }
            }
        }

        const perimEllipse = Math.PI * (3 * (shape.a + shape.b) - Math.sqrt((3 * shape.a + shape.b) * (shape.a + 3 * shape.b)));
        const perimRect = 4 * (shape.aRect + shape.bRect);
        const perim = perimEllipse + (perimRect - perimEllipse) * shape.square;
        let spikeCount = lock && typeof lock.spikeCount === 'number' && isFinite(lock.spikeCount)
            ? Math.max(3, Math.floor(lock.spikeCount))
            : Math.max(FUKI_SPIKE_MIN, Math.round(perim / FUKI_SPIKE_PITCH));
        if (tail) {
            if (spikeCount % 2 === 0) spikeCount++;
        } else {
            // No-tail seam uses peak endpoints (first/last), so keep odd count.
            if (spikeCount % 2 === 0) spikeCount++;
        }
        if (lock && !(typeof lock.spikeCount === 'number' && isFinite(lock.spikeCount))) {
            lock.spikeCount = spikeCount;
        }
        const baseStep = 360 / spikeCount;
        const gap = tail ? baseStep * 0.6 : 0;
        const available = 360 - gap;
        const step = available / spikeCount;
        const start = (tail ? angParam : 90) - 10 - gap / 2;
        const useLine = shape.square >= 1;

        const segs = Math.max(64, spikeCount * 8);
        const arcPts = [];
        const arcLens = [];
        let totalLen = 0;
        let prev = this._fukidashiBoundaryPoint(CX, CY, shape, start * Math.PI / 180);
        arcPts.push(prev);
        arcLens.push(0);
        for (let s = 1; s <= segs; s++) {
            const ang = start - available * (s / segs);
            const p = this._fukidashiBoundaryPoint(CX, CY, shape, ang * Math.PI / 180);
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;
            totalLen += Math.sqrt(dx * dx + dy * dy);
            arcPts.push(p);
            arcLens.push(totalLen);
            prev = p;
        }
        const pointAtLen = function(len, isPeak) {
            let l = len % totalLen;
            if (l < 0) l += totalLen;
            let idx = 0;
            while (idx < arcLens.length - 1 && arcLens[idx + 1] < l) idx++;
            const l0 = arcLens[idx];
            const l1 = arcLens[idx + 1] || l0 + 1;
            const tt = (l - l0) / (l1 - l0);
            const p0 = arcPts[idx];
            const p1 = arcPts[idx + 1] || p0;
            const px = p0.x + (p1.x - p0.x) * tt;
            const py = p0.y + (p1.y - p0.y) * tt;
            const vx = px - CX;
            const vy = py - CY;
            const len2 = Math.sqrt(vx * vx + vy * vy) || 1;
            const delta = isPeak ? spikeOut : -FUKI_SPIKE_IN;
            const scale = Math.max(1, len2 + delta) / len2;
            return { x: CX + vx * scale, y: CY + vy * scale };
        };

        let angPeak = 0;
        let baseTail = null;
        let baseValley = null;
        let per = 0;
        let tailUx = 0;
        let tailUy = 0;
        let tailPeak = null;
        let phaseLen = 0;
        const phaseLocked = !!(lock && typeof lock.phaseNorm === 'number' && isFinite(lock.phaseNorm));
        if (phaseLocked) {
            phaseLen = totalLen * lock.phaseNorm;
        }
        if (tail) {
            if (nearest && nearest.point) {
                angPeak = nearest.t;
                baseValley = nearest.point;
                baseTail = this._fukidashiBoundaryPoint(CX, CY, tailShape, angPeak);
            } else {
                // Keep tail root on the requested direction ray (do not apply seam offset here).
                angPeak = angParam * Math.PI / 180;
                baseTail = this._fukidashiBoundaryPoint(CX, CY, tailShape, angPeak);
                baseValley = this._fukidashiBoundaryPoint(CX, CY, shape, angPeak);
            }
            let dirX = 0;
            let dirY = 0;
            if (targetBmp) {
                dirX = targetBmp.x - baseValley.x;
                dirY = targetBmp.y - baseValley.y;
            }
            let dLen = Math.sqrt(dirX * dirX + dirY * dirY);
            if (dLen < 0.0001) {
                const out = angDir * Math.PI / 180;
                dirX = Math.cos(out);
                dirY = Math.sin(out);
                dLen = 1;
            }
            const oux = dirX / dLen;
            const ouy = dirY / dLen;
            tailUx = oux;
            tailUy = ouy;
            per = Math.atan2(ouy, oux) + Math.PI / 2;
            const T = { x: baseTail.x + oux * tH, y: baseTail.y + ouy * tH };
            tailPeak = { x: T.x, y: T.y, peak: true };

            if (!phaseLocked && spikeCount >= 5) {
                const stepLen = totalLen / spikeCount;
                const samples = 24;
                let best = 0;
                let bestDiff = Infinity;
                for (let s = -samples; s <= samples; s++) {
                    const ph = (stepLen * s) / (samples * 2);
                    const p1 = pointAtLen(stepLen * 1 + ph, true);
                    const pLast = pointAtLen(stepLen * (spikeCount - 2) + ph, ((spikeCount - 2) % 2) === 1);
                    const d1 = (p1.x - tailPeak.x) * (p1.x - tailPeak.x) + (p1.y - tailPeak.y) * (p1.y - tailPeak.y);
                    const d2 = (pLast.x - tailPeak.x) * (pLast.x - tailPeak.x) + (pLast.y - tailPeak.y) * (pLast.y - tailPeak.y);
                    const diff = Math.abs(d1 - d2);
                    if (diff < bestDiff) { bestDiff = diff; best = ph; }
                }
                phaseLen = best;
            }
            if (!phaseLocked && spikeCount >= 3 && baseValley) {
                // Keep existing spiky/rounded design, only align seam phase closer to tail root.
                // Optimize for both proximity and left/right balance of the two seam-adjacent vertices.
                const stepLen = totalLen / spikeCount;
                const samplesAlign = 48;
                const maxShift = stepLen * 1.0;
                const lastIsPeak = ((spikeCount - 2) % 2) === 1;
                let bestShift = 0;
                let bestCost = Infinity;
                for (let s = -samplesAlign; s <= samplesAlign; s++) {
                    const shift = maxShift * s / samplesAlign;
                    const pFirst = pointAtLen(stepLen * 1 + phaseLen + shift, true);
                    const pLast = pointAtLen(stepLen * (spikeCount - 2) + phaseLen + shift, lastIsPeak);
                    const d1x = pFirst.x - baseValley.x;
                    const d1y = pFirst.y - baseValley.y;
                    const d2x = pLast.x - baseValley.x;
                    const d2y = pLast.y - baseValley.y;
                    const d1 = Math.sqrt(d1x * d1x + d1y * d1y);
                    const d2 = Math.sqrt(d2x * d2x + d2y * d2y);
                    const balance = Math.abs(d1 - d2);
                    const seamDx = pFirst.x - pLast.x;
                    const seamDy = pFirst.y - pLast.y;
                    const seam = Math.sqrt(seamDx * seamDx + seamDy * seamDy);
                    const cost = (d1 + d2) + balance * 1.35 + seam * 0.12;
                    if (cost < bestCost) {
                        bestCost = cost;
                        bestShift = shift;
                    }
                }
                phaseLen += bestShift;
            }
        }
        if (lock && !phaseLocked && totalLen > 0) {
            lock.phaseNorm = phaseLen / totalLen;
        }

        const pts = [];
        for (let i = 0; i < spikeCount; i++) {
            const isPeak = tail ? (i % 2 === 1) : (i % 2 === 0);
            let target = (totalLen / spikeCount) * i + phaseLen;
            if (target < 0 || target >= totalLen) {
                target = target % totalLen;
                if (target < 0) target += totalLen;
            }
            let idx = 0;
            while (idx < arcLens.length - 1 && arcLens[idx + 1] < target) idx++;
            const l0 = arcLens[idx];
            const l1 = arcLens[idx + 1] || l0 + 1;
            const t = (target - l0) / (l1 - l0);
            const p0 = arcPts[idx];
            const p1 = arcPts[idx + 1] || p0;
            const px = p0.x + (p1.x - p0.x) * t;
            const py = p0.y + (p1.y - p0.y) * t;
            const vx = px - CX;
            const vy = py - CY;
            const len = Math.sqrt(vx * vx + vy * vy) || 1;
            const delta = isPeak ? spikeOut : -FUKI_SPIKE_IN;
            const scale = Math.max(1, len + delta) / len;
            pts.push({ x: CX + vx * scale, y: CY + vy * scale, peak: isPeak });
        }
        if (!tail && pts.length >= 2) {
            // Collapse seam to one shared peak so the no-tail outline closes cleanly.
            pts[pts.length - 1] = { x: pts[0].x, y: pts[0].y, peak: true };
        }

        let tailPts = null;
        let orderedPts = pts;
        let drawPts = orderedPts;
        if (tail && pts.length >= 3) {

            const tx = Math.cos(per);
            const ty = Math.sin(per);
            const gap = 12;
            const hgap = gap / 2;
            const seamInset = Math.max(1, Math.min(FUKI_SPIKE_IN, tW * 0.35));
            const vcx = baseValley.x - tailUx * seamInset;
            const vcy = baseValley.y - tailUy * seamInset;
            const vA = { x: vcx + tx * hgap, y: vcy + ty * hgap, peak: false };
            const vB = { x: vcx - tx * hgap, y: vcy - ty * hgap, peak: false };

            const redFirst = orderedPts[1] || orderedPts[0];
            const redLast = orderedPts[orderedPts.length - 2] || orderedPts[orderedPts.length - 1];
            const dA1 = (vA.x - redFirst.x) * (vA.x - redFirst.x) + (vA.y - redFirst.y) * (vA.y - redFirst.y);
            const dB1 = (vB.x - redFirst.x) * (vB.x - redFirst.x) + (vB.y - redFirst.y) * (vB.y - redFirst.y);
            const dA2 = (vA.x - redLast.x) * (vA.x - redLast.x) + (vA.y - redLast.y) * (vA.y - redLast.y);
            const dB2 = (vB.x - redLast.x) * (vB.x - redLast.x) + (vB.y - redLast.y) * (vB.y - redLast.y);
            let valley0 = dA1 <= dB1 ? vA : vB;
            let valleyLast = dA2 <= dB2 ? vA : vB;
            if (valley0 === valleyLast) {
                valleyLast = valley0 === vA ? vB : vA;
            }

            orderedPts[0] = valley0;
            orderedPts[orderedPts.length - 1] = valleyLast;

            const ctrlStart = orderedPts[0];
            const ctrlEnd = orderedPts[orderedPts.length - 1];
            drawPts = orderedPts.length > 2 ? orderedPts.slice(1, -1) : orderedPts.slice();
            tailPts = [tailPeak, ctrlStart, ctrlEnd];
            this._fukidashiTailDebug = {
                cx: CX, cy: CY, bx: baseValley.x, by: baseValley.y, angle: angDir,
                outRad: (angDir * Math.PI / 180), paramRad: angPeak,
                bParamX: baseValley.x, bParamY: baseValley.y,
                shapeA: shape.a, shapeB: shape.b, shapeN: shape.n, shapeSquare: shape.square,
                tW: tW, tH: tH, L: ctrlStart, T: tailPeak, R: ctrlEnd,
                rootSource: rootSource,
                targetX: targetBmp ? targetBmp.x : null,
                targetY: targetBmp ? targetBmp.y : null,
                nearestDist: nearest ? nearest.dist : null
            };
        }
        this._fukidashiRender(bmp, drawPts, tailPts, 2, useLine);
    };

    //3 考え中ふきだし
    Window_Base.prototype._drawHanddrawnFukidashi3 = function (bmp, tailDir) {
        this._fukidashiTailDebug = null;
        // 1) 本体（楕円）は①をそのまま使用（しっぽ無し=5）
        this._drawHanddrawnFukidashi(bmp, 5, true);

        // 2) ドットしっぽの計算
        const W = bmp.width, H = bmp.height, M = 8;
        const baseW = (W * 0.8 - M * 2);
        const baseH = (H * 0.8 - M * 2);
        const shape = this._fukidashiShapeInfo(baseW, baseH);
        const CX = W / 2, CY = H / 2;

        const ang0 = this._resolveFukidashiTailAngle(tailDir); // null ならしっぽ無し
        if (ang0 === null) return; // 5 ならドットもしっぽ無し

        let out = ang0 * Math.PI / 180;
        let b = this._fukidashiBoundaryPointByRay(CX, CY, shape, out);
        let ang = ang0;
        let targetBmp = this._popupTailCharacterCenterToBmp(bmp);
        let nearest = null;
        let rootSource = 'dirRay';
        if (targetBmp) {
            nearest = this._fukidashiNearestBoundaryToPoint(CX, CY, shape, targetBmp, 180);
            if (nearest && nearest.point) {
                b = nearest.point;
                ang = (Math.atan2(targetBmp.y - b.y, targetBmp.x - b.x) * 180 / Math.PI + 360) % 360;
                out = ang * Math.PI / 180;
                rootSource = 'nearestToCharacterCenter';
            }
        }
        const bx = b.x;   // 境界の接点
        const by = b.y;

        const tailSize = this._fukidashiTailSize(baseW, baseH);

        // 半径（だんだん小さく）と間隔
        const R0 = Math.max(1, tailSize.w * 0.58);      // 本体に一番近い丸
        const R1 = R0 * 0.62;
        const R2 = R0 * 0.48;
        const d0 = Math.max(1, tailSize.h * 0.24);        // 境界からの押し出し量（少し重なる感じ）
        const d1 = Math.max(1, tailSize.h * 1.0);         // 2個目までの距離
        const d2 = Math.max(1, tailSize.h * 1.35);        // 3個目までの距離

        // 位置を先に固定（2パスでズレないように）
        const dots = [
            { x: bx + Math.cos(out) * d0, y: by + Math.sin(out) * d0, r: R0 },
            { x: bx + Math.cos(out) * d1, y: by + Math.sin(out) * d1, r: R1 },
            // { x: bx + Math.cos(out) * d2 + j(W), y: by + Math.sin(out) * d2 + j(W), r: R2 },
        ];
        const pOut = this._fukidashiDirectionToParamAngle(shape, out);
        this._fukidashiTailDebug = {
            cx: CX, cy: CY, bx: bx, by: by, angle: ang,
            outRad: out, paramRad: nearest && nearest.point ? nearest.t : pOut,
            bParamX: b.x, bParamY: b.y,
            shapeA: shape.a, shapeB: shape.b, shapeN: shape.n, shapeSquare: shape.square,
            tW: tailSize.w, tH: tailSize.h,
            L: { x: dots[0].x, y: dots[0].y },
            T: { x: dots[1].x, y: dots[1].y },
            R: { x: dots[1].x, y: dots[1].y },
            rootSource: rootSource,
            targetX: targetBmp ? targetBmp.x : null,
            targetY: targetBmp ? targetBmp.y : null,
            nearestDist: nearest ? nearest.dist : null
        };

        // 3) ①と同じ見た目（白塗り＋太白縁→細い通常色縁）で円を描く
        const c = bmp._context;
        for (let pass = 0; pass < 2; pass++) {
            c.save();
            c.imageSmoothingEnabled = false;
            bmp._baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

            c.fillStyle = 'white';
            c.strokeStyle = ['white', this.normalColor()][pass];
            c.lineJoin = c.lineCap = 'round';
            c.lineWidth = [6, 2][pass];

            for (const p of dots) {
                c.beginPath();
                c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                c.closePath();
                c.fill();
                c.stroke();
            }
            c.restore();
        }
        bmp._setDirty();
        bmp._applyNormalColorMask();
    };

    //-----------------------------------------------------------------------------
    // Small Message
    //-----------------------------------------------------------------------------

    function Window_SmallMessage() {
        this.initialize.apply(this, arguments);
    }

    Window_SmallMessage.prototype = Object.create(Window_Base.prototype);
    Window_SmallMessage.prototype.constructor = Window_SmallMessage;

    Window_SmallMessage.prototype.initialize = function (data) {
        Window_Base.prototype.initialize.call(this, 0, 0, 1, 1);
        this.openness = 0;
        this._noYura = true;
        if (this._windowContentsSprite) this._windowContentsSprite._yuraInfo = null;
        this.opacity = 0;
        this.contentsOpacity = 255;
        this._data = null;
        this._text = '';
        this._wrappedText = '';
        this._maxWidth = 240;
        this._textState = null;
        this._textFinished = false;
        this._waitCount = 0;
        this._lineShowFast = false;
        this._textSpeed = 1;
        this._textSpeedWait = 0;
        this._contents2 = null;
        this._contentsYuraDirty = false;
        this._fukidashiSprite = null;
        if (data) this.setup(data);
    };

    // Window_SmallMessage.prototype.standardFontSize = function () { return 22 };

    Window_SmallMessage.prototype.setup = function (data) {
        this._data = data;
        this._data._window = this;
        this._text = data.text || '';
        this._maxWidth = Math.max(1, Number(data.maxWidth || 240));
        this._textFinished = false;
        this._waitCount = 0;
        this._lineShowFast = false;
        this._textSpeed = this.messageSpeed();
        this._textSpeedWait = 0;
        if (this._textSpeed <= 0) this._lineShowFast = true;
        this.refresh();
        if (this._text) this.openness = 0, this.open();
    };

    Window_SmallMessage.prototype.messageSpeed = function () {
        if (Window_Message.prototype.messageSpeed) {
            var s = Number(Window_Message.prototype.messageSpeed.call(this));
            if (isFinite(s)) return s;
        }
        return 1;
    };

    Window_SmallMessage.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (!this._data) return;
        this.updatePlacement();

        if (this._contentsYuraDirty) {
            this._contentsYuraDirty = false;
            this._refreshContentsYura();
        }

        if (this._data.closing) {
            if (this.isOpen()) this.close();
            if (this.isClosed()) this._data._erase = true;
            if (this._fukidashiSprite) this._fukidashiSprite.visible = !this.isClosed();
            return;
        }

        if (!this._textFinished) this.updateMessage();
        if (this._fukidashiSprite) {
            this._updateFukidashiSpikeAnimation(this._fukidashiSprite);
            this._fukidashiSprite.scale.x = this._fukidashiSprite.scale.y = this.isOpen() ? 2 : 1.5;
            this._fukidashiSprite.visible = this.openness > 0;
        }
    };

    Window_SmallMessage.prototype.updateMessage = function () {
        if (!this._textState) return;
        if (this._waitCount > 0) {
            this._waitCount--;
            return;
        }

        if (this._lineShowFast) {
            while (!this.isEndOfText(this._textState)) {
                this.processCharacter(this._textState);
                if (this._waitCount > 0) break;
            }
            this._contentsYuraDirty = true;
        } else {
            if (this._textSpeedWait > 0) {
                this._textSpeedWait--;
                return;
            }
            this.processCharacter(this._textState);
            this._textSpeedWait = this._textSpeed;
            this._contentsYuraDirty = true;
        }

        if (this.isEndOfText(this._textState)) {
            this._textFinished = true;
            this._data.done = true;
            this._data.elapsed = 0;
        }
    };

    Window_SmallMessage.prototype.isEndOfText = function (textState) {
        return !textState || textState.index >= textState.text.length;
    };

    Window_SmallMessage.prototype.processEscapeCharacter = function (code, textState) {
        switch (code) {
        case '.':
            this.startWait(15);
            break;
        case '|':
            this.startWait(60);
            break;
        case '!':
            this.startWait(10);
            break;
        case '>':
            this._lineShowFast = true;
            break;
        case '<':
            this._lineShowFast = false;
            break;
        default:
            Window_Base.prototype.processEscapeCharacter.call(this, code, textState);
            break;
        }
    };

    Window_SmallMessage.prototype.startWait = function (count) {
        this._waitCount = count;
    };

    Window_SmallMessage.prototype.refresh = function () {
        var text = this._text || '';
        var layout = this._buildTextLayout(text, this._maxWidth);
        var pad = this.standardPadding();
        var textPad = this.textPadding();
        var outline = this.contents ? (this.contents.outlineWidth || 0) : 0;
        var minW = pad * 2 + 24;
        var needW = Math.ceil(layout.width) + pad * 2 + textPad * 2 + outline * 2;
        this.width = Math.max(minW, needW);
        this.height = this.fittingHeight(layout.lines);
        this.createContents();
        this.contents.clear();
        this.resetFontSettings();
        this._wrappedText = layout.text;
        var x = this.textPadding();
        this._textState = { index: 0, x: x, y: 0, left: x };
        this._textState.text = this._wrappedText;
        this._textState.height = this.calcTextHeight(this._textState, false);
        this._refreshContentsYura();
        this.updatePlacement();
        this.refreshFukidashi();
    };

    Window_SmallMessage.prototype.updatePlacement = function () {
        var x = Number(this._data.x) || 0;
        var y = Number(this._data.y) || 0;
        this.x = Math.round(x - this.width / 2);
        this.y = Math.round(y - this.height * 1.25);
    };

    Window_SmallMessage.prototype.refreshFukidashi = function () {
        if (!this._fukidashiSprite) {
            this._fukidashiSprite = new Sprite();
            this.addChildAt(this._fukidashiSprite, this.children.indexOf(this._windowSpriteContainer));
        }

        const width = this.width * 1.5;
        const height = this.height * 1.5;
        const offsetX = this.width / 2;
        const offsetY = this.height / 2;

        var sp = this._fukidashiSprite;
        sp.bitmap = new Bitmap(width / 2, height / 2);
        sp.anchor.x = sp.anchor.y = 0.5;
        sp.x = offsetX;
        sp.y = offsetY;
        sp.scale.x = sp.scale.y = 2;
        var drawType = Number($gameVariables.value(14) || 0);
        sp._fukidashiDrawType = drawType;
        sp._fukidashiForceTailDir = 2;
        sp._fukidashiAnimStartStep = this._fukidashiSpikeAnimStep();
        sp._fukidashiAnimLastStep = null;
        sp._fukidashiAnimLastKey = null;
        sp._fukidashiGeomLock = null;
        if (drawType === 1) {
            var profile = this._fukidashiSpikeAnimProfile(sp._fukidashiAnimStartStep, sp._fukidashiAnimStartStep);
            sp._fukidashiGeomLock = {};
            profile.lock = sp._fukidashiGeomLock;
            this._drawHanddrawnFukidashi2(sp.bitmap, 2, profile);
            sp._fukidashiAnimLastStep = sp._fukidashiAnimStartStep;
            sp._fukidashiAnimLastKey = profile.key;
        }
        else if (drawType === 2) this._drawHanddrawnFukidashi3(sp.bitmap, 2);
        else if (drawType === 11) sp.bitmap = ImageManager.loadSystem('UI_message1');
        else this._drawHanddrawnFukidashi(sp.bitmap, 2);
        sp._yuraInfo = [sp.width / 8, 5 + width / 20, 10];
        sp._baseBitmap = null;
        sp._lastFrame = null;
        sp.visible = false;
        sp.update();
    };

    Window_SmallMessage.prototype._ensureContentsYura = function () {
        if (this._contents2) return;
        this._contents2 = new Sprite();
        this._contents2._yuraInfo = [4, 15, 10, true];
        this._contents2._maskWhite = this._skinId === 3;
        if (typeof this.kggSemiWhiteEdgeAlphaThreshold === 'function') {
            this._contents2._kggSemiWhiteEdgeAlphaThreshold = this.kggSemiWhiteEdgeAlphaThreshold();
        }
        if (this._windowContentsSprite) this._windowContentsSprite.addChild(this._contents2);
    };

    Window_SmallMessage.prototype._refreshContentsYura = function () {
        this._ensureContentsYura();
        if (!this._contents2) return;
        this._contents2._maskWhite = this._skinId === 3;
        this._contents2.bitmap = this.contents;
        this._contents2._lastFrame = null;
        this._contents2._baseBitmap = null;
    };

    Window_SmallMessage.prototype.standardPadding = function () {
        return Window_Base.prototype.standardPadding.call(this) + 8;
    };

    Window_SmallMessage.prototype._buildTextLayout = function (text, maxWidth) {
        var NG_PUNCT = /[。、　., ]/;
        var noBreakTokens = ['HP', 'GOD'];
        var isDigit = function(c) { return /\d/.test(c); };
        var tokens = Array.isArray(noBreakTokens) ? noBreakTokens : (this._noBreakTokens || []);

        var textState = { index: 0, x: 0, left: 0, y: 0 };
        textState.text = this.convertEscapeCharacters(text);
        textState.height = this.calcTextHeight(textState, false);
        this.resetFontSettings();

        var out = '';
        var lines = 1;
        var maxLine = 0;
        var right = maxWidth > 0 ? maxWidth : Infinity;

        var wrapLine = function() {
            maxLine = Math.max(maxLine, textState.x);
            textState.x = textState.left;
            textState.y += textState.height;
            lines++;
            out += '\n';
        };

        var between = function() {
            return this.getBetweenCharacters ? this.getBetweenCharacters() : 0;
        }.bind(this);

        var measureStringWidth = function(str) {
            var w = 0;
            for (var i = 0; i < str.length; i++) {
                w += this.textWidth(str[i]);
                w += between();
            }
            return w;
        }.bind(this);

        while (textState.index < textState.text.length) {
            var ch = textState.text[textState.index];
            if (ch === '\n' || ch === '\f') {
                out += '\n';
                maxLine = Math.max(maxLine, textState.x);
                textState.x = 0;
                textState.index++;
                lines++;
                continue;
            }

            var startIndex = textState.index;

            if (ch === '\x1b') {
                var code = this.obtainEscapeCode(textState);
                if (code === 'C') {
                    var pC = this.obtainEscapeParam(textState);
                } else if (code === 'I') {
                    var pI = this.obtainEscapeParam(textState);
                    var wI = (Window_Base._iconWidth + 2) * this.contents.fontSize / 32;
                    if (pI === 16) wI -= 10 * this.contents.fontSize / 32;
                    if (right !== Infinity && textState.x + wI > right && textState.x > 0) {
                        wrapLine();
                    }
                    textState.x += wI;
                } else if (code === '{') {
                    this.makeFontBigger();
                } else if (code === '}') {
                    this.makeFontSmaller();
                } else if (code === 'B') {
                    this.contents.fontBold = !this.contents.fontBold;
                } else if (code === 'S') {
                    this.setFontSize(this.obtainEscapeParam(textState));
                } else if (code === 'PS') {
                    this.contents.fontSize += this.obtainEscapeParam(textState);
                } else if (code === 'MS') {
                    this.contents.fontSize -= this.obtainEscapeParam(textState);
                } else if (code === 'X') {
                    textState.x += this.obtainEscapeParam(textState);
                } else if (code === 'MX') {
                    textState.x -= this.obtainEscapeParam(textState);
                } else if (code === 'Y') {
                    textState.y += this.obtainEscapeParam(textState);
                } else if (code === 'MY') {
                    textState.y -= this.obtainEscapeParam(textState);
                } else {
                    // そのまま通す（必要なら追加処理）
                }

                out += textState.text.slice(startIndex, textState.index);
                continue;
            }

            // 1) 改行禁止トークン
            var matchedToken = null;
            if (tokens && tokens.length) {
                for (var ti = 0; ti < tokens.length; ti++) {
                    var t = tokens[ti];
                    if (!t) continue;
                    if (textState.text.startsWith(t, textState.index) && (!matchedToken || t.length > matchedToken.length)) {
                        matchedToken = t;
                    }
                }
            }
            if (matchedToken) {
                var tokenW = measureStringWidth(matchedToken);
                var tokenEnd = textState.index + matchedToken.length;
                if (tokenW > maxWidth && maxWidth > 0) tokenW = this.textWidth(ch);
                if (right !== Infinity && textState.x + tokenW > right && textState.x > 0) {
                    wrapLine();
                    continue;
                }
                textState.x += tokenW;
                textState.index = tokenEnd;
                out += matchedToken;
                continue;
            }

            // 2) 数字列＋小数点＋％
            if (isDigit(ch)) {
                var end = textState.index;
                while (end < textState.text.length && (isDigit(textState.text[end]) || textState.text[end] === '.')) end++;
                if (textState.text[end] === '%' || textState.text[end] === '％') end++;
                var token = textState.text.slice(textState.index, end);
                var tokenW2 = measureStringWidth(token);
                if (tokenW2 > maxWidth && maxWidth > 0) {
                    token = ch;
                    tokenW2 = this.textWidth(ch) + between();
                    end = textState.index + 1;
                }
                if (right !== Infinity && textState.x + tokenW2 > right && textState.x > 0) {
                    wrapLine();
                    continue;
                }
                textState.x += tokenW2;
                textState.index = end;
                out += token;
                continue;
            }

            // 3) 通常文字
            var w = this.textWidth(ch) + between();
            if (right !== Infinity && textState.x + w > right) {
                if (NG_PUNCT.test(ch)) {
                    textState.x += w;
                    textState.index++;
                    out += ch;
                    wrapLine();
                } else {
                    wrapLine();
                }
                continue;
            }
            textState.x += w;
            textState.index++;
            out += ch;
        }

        maxLine = Math.max(maxLine, textState.x);
        if (maxLine < 1) maxLine = 1;
        this.resetFontSettings();
        return { text: out, width: maxLine, lines: lines };
    };

    // Game_Screen (Small Message)
    Game_Screen.prototype.initSmallMessages = function () {
        this._smallMessages = [];
        this._smallMessageSeed = 1;
    };

    Game_Screen.prototype.addSmallMessage = function (text, x, y, time, maxWidth) {
        if (!this._smallMessages) this.initSmallMessages();
        var msg = {
            id: this._smallMessageSeed++,
            text: '' + (text || ''),
            x: Number(x) || 0,
            y: Number(y) || 0,
            time: Math.max(0, Number(time) || 0),
            maxWidth: Math.max(1, Number(maxWidth || 240)),
            done: false,
            elapsed: 0,
            closing: false,
            _erase: false
        };
        this._smallMessages.push(msg);
        return msg.id;
    };

    Game_Screen.prototype.smallMessages = function () {
        if (!this._smallMessages) this.initSmallMessages();
        return this._smallMessages;
    };

    Game_Screen.prototype.eraseSmallMessage = function (id) {
        if (!this._smallMessages) return;
        for (var i = 0; i < this._smallMessages.length; i++) {
            if (this._smallMessages[i].id === id) {
                var msg = this._smallMessages[i];
                msg.done = true;
                msg.closing = true;
                msg._erase = false;
                if (msg._window && msg._window.isOpen && msg._window.isOpen()) {
                    msg._window.close();
                }
                break;
            }
        }
    };

    Game_Screen.prototype.updateSmallMessages = function () {
        if (!this._smallMessages) return;
        for (var i = this._smallMessages.length - 1; i >= 0; i--) {
            var msg = this._smallMessages[i];
            if (msg._erase) {
                this._smallMessages.splice(i, 1);
                continue;
            }
            if (msg.done && !msg.closing) {
                msg.elapsed = (msg.elapsed || 0) + 1;
                if (msg.elapsed >= msg.time) {
                    msg.closing = true;
                    if (msg._window && msg._window.isOpen && msg._window.isOpen()) {
                        msg._window.close();
                    }
                }
            }
        }
    };

    // Scene_Base (Small Message)
    const _Scene_Base_createWindowLayer = Scene_Base.prototype.createWindowLayer;
    Scene_Base.prototype.createWindowLayer = function () {
        _Scene_Base_createWindowLayer.call(this);
        this.createSmallMessageLayer();
    };

    Scene_Base.prototype.createSmallMessageLayer = function () {
        if (!this._windowLayer) return;
        this._smallMessageLayer = new Sprite();
        this._smallMessageWindows = {};
        this._windowLayer.addChild(this._smallMessageLayer);
    };

    Scene_Base.prototype.updateSmallMessages = function () {
        if (!this._smallMessageLayer || !this._smallMessageWindows) return;
        if (this._smallMessageLayer.parent && this._smallMessageLayer.parent.setChildIndex) {
            var p = this._smallMessageLayer.parent;
            p.setChildIndex(this._smallMessageLayer, p.children.length - 1);
        }
        var list = $gameScreen ? $gameScreen.smallMessages() : [];
        var exists = {};
        for (var i = 0; i < list.length; i++) {
            var msg = list[i];
            exists[msg.id] = true;
            if (!this._smallMessageWindows[msg.id]) {
                var win = new Window_SmallMessage(msg);
                this._smallMessageLayer.addChild(win);
                this._smallMessageWindows[msg.id] = win;
            }
        }
        for (var id in this._smallMessageWindows) {
            if (!exists[id]) {
                var oldWin = this._smallMessageWindows[id];
                this._smallMessageLayer.removeChild(oldWin);
                if (oldWin && oldWin.destroy) oldWin.destroy({ children: true });
                delete this._smallMessageWindows[id];
            }
        }
    };



    //-----------------------------------------------------------------------------
    // ゆらゆらを各種描写に適応
    //-----------------------------------------------------------------------------

    //ウィンドウフレーム
    var _Window_refreshFrame = Window.prototype._refreshFrame;
    Window.prototype._refreshFrame = function() {
        _Window_refreshFrame.apply(this, arguments);
        this._windowFrameSprite._baseBitmap = null;
        this._windowFrameSprite._lastFrame = null;
        this._windowFrameSprite._yuraInfo = [[30, 14], [30, 20], [30, 14]][(this._skinId || 1) - 1];
    };
    Window.prototype.setWindowSkin = function(id) {
        id = id || 1;
        this._skinId = id;
        this.windowskin = ImageManager.loadSystem('Window' + (id > 1 ? id : ''));
    };
    
    //ウィンドウコンテンツ
    var _Window_refreshContents = Window.prototype._refreshContents;
    Window.prototype._refreshContents = function() {
        _Window_refreshContents.apply(this, arguments);
        if (this instanceof Window_Message) return;
        if (this instanceof Window_ScrollText) return;
        this._windowContentsSprite._yuraInfo = !this._noYura ? [12, 10, 10, true] : null;
        this._windowContentsSprite._maskWhite = this._skinId === 3;
    };
    Window_Base.prototype.refreshYurayura = function() {
        var sp = this._windowContentsSprite;
        sp._lastFrame = null;
        if (sp._baseBitmap) sp.bitmap = sp._baseBitmap, sp._baseBitmap = null;
    };
    
    //矢印
    var _Window_refreshArrows = Window.prototype._refreshArrows;
    Window.prototype._refreshArrows = function() {
        _Window_refreshArrows.apply(this, arguments);
        this._upArrowSprite._yuraInfo = [12, 15];
        this._downArrowSprite._yuraInfo = [12, 15];
    };
    
    //Window_Selectable
    var _Window_Selectable_refresh = Window_Selectable.prototype.refresh;
    Window_Selectable.prototype.refresh = function() {
        this.refreshYurayura();
        _Window_Selectable_refresh.apply(this, arguments);
    };
    var _Window_Selectable_redrawItem = Window_Selectable.prototype.redrawItem;
    Window_Selectable.prototype.redrawItem = function(index) {
        this.refreshYurayura();
        _Window_Selectable_redrawItem.apply(this, arguments);
    };
    //Window_Command
    var _Window_Command_refresh = Window_Command.prototype.refresh;
    Window_Command.prototype.refresh = function() {
        this.refreshYurayura();
        _Window_Command_refresh.apply(this, arguments);
    };

    //Window_ScrollText
    Window_ScrollText.prototype.refresh = function () {
        var textState = { index: 0 };
        textState.text = this.convertEscapeCharacters(this._text);
        this.resetFontSettings();
        this._allTextHeight = this.calcTextHeight(textState, true);
        this.height = 2000;
        this.createContents();
        this.contents.textColor = 'white';
        this.contents.fontBold = true;
        this.y = Graphics.boxHeight;
        for (var i = 0; i < 5; i++) this.drawTextKNH(this._text, this.textPadding(), 1, this.contents.width, 'center');
        this.refreshYurayura();
    };
    Window_ScrollText.prototype.updateMessage = function () {
        this.y -= this.scrollSpeed();
        if (this.y < -this.height) {
            this.terminateMessage();
        }
    };
    
    //ダメージスプライト
    var _Sprite_Damage_createDigits = Sprite_Damage.prototype.createDigits;
    Sprite_Damage.prototype.createDigits = function(baseRow, value) {
        _Sprite_Damage_createDigits.apply(this, arguments);
        for (var i = 0; i < this.children.length; i++) {
            var sp = this.children[i];
            sp._yuraInfo = [12, 15];
        }
    };
    
    //キャラを別シーン中継後に再度ゆらゆらさせる処理
    var _Sprite_Character_initialize = Sprite_Character.prototype.initialize;
    Sprite_Character.prototype.initialize = function(character) {
        _Sprite_Character_initialize.apply(this, arguments);
        this._character._yurayura = false;
        this._maskFadeSprite = null;
        this._lastMaskFadeIndex = -999;
    };

    Sprite_Character.prototype._ensureMaskFadeSprite = function() {
        if (this._maskFadeSprite) return this._maskFadeSprite;
        var sp = new Sprite();
        sp.bitmap = new Bitmap(1, 1);
        sp.renderable = false;
        sp.visible = true;
        sp.anchor.x = 0;
        sp.anchor.y = 0;
        sp._maskCellW = 0;
        sp._maskCellH = 0;
        this._maskFadeSprite = sp;
        this.addChild(sp);
        this._maskFadeSource = ImageManager.loadSystem('fadeWhite');
        this._maskFadeBitmaps = [];
        return sp;
    };
    Sprite_Character.prototype._getMaskFadeBitmap = function(index) {
        if (this._maskFadeBitmaps && this._maskFadeBitmaps[index]) {
            return this._maskFadeBitmaps[index];
        }
        var src = this._maskFadeSource || ImageManager.loadSystem('fadeWhite');
        if (!src || !src.isReady()) return null;
        var cellW = Math.floor(src.width / 3);
        var cellH = Math.floor(src.height / 3);
        if (cellW <= 0 || cellH <= 0) return null;
        var col = index % 3;
        var row = Math.floor(index / 3);
        var sx = col * cellW;
        var sy = row * cellH;
        var bmp = new Bitmap(cellW, cellH);
        bmp._context.imageSmoothingEnabled = false;
        bmp.blt(src, sx, sy, cellW, cellH, 0, 0, cellW * 2, cellH * 2);
        var ctx = bmp._context;
        var imageData = ctx.getImageData(0, 0, cellW, cellH);
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
            var a = data[i + 3];
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255 - a;
        }
        ctx.putImageData(imageData, 0, 0);
        bmp._setDirty();
        this._maskFadeBitmaps[index] = bmp;
        return bmp;
    };
    Sprite_Character.prototype._applyMaskFadeIndex = function(index) {
        var sp = this._ensureMaskFadeSprite();
        var bmp = this._getMaskFadeBitmap(index);
        if (!bmp) return;
        if (sp.bitmap !== bmp) sp.bitmap = bmp;
        var cellW = bmp.width;
        var cellH = bmp.height;
        if (cellW <= 0 || cellH <= 0) return;

        var frame = this._frame || {};
        var w = frame.width || this.width || cellW;
        var h = frame.height || this.height || cellH;
        if (w <= 0 || h <= 0) return;
        sp.scale.x = w / cellW;
        sp.scale.y = h / cellH;
        sp.x = -this.anchor.x * w;
        sp.y = -this.anchor.y * h;
        if (this.mask !== sp) this.mask = sp;
        sp.visible = true;
        sp.renderable = false;
    };
    Sprite_Character.prototype._clearMaskFade = function() {
        if (this.mask === this._maskFadeSprite) this.mask = null;
        if (this._maskFadeSprite) {
            this._maskFadeSprite.renderable = false;
            this._maskFadeSprite.visible = false;
        }
    };
    Sprite_Character.prototype.updateMaskFade = function() {
        var ch = this._character;
        if (!ch || !ch.updateMaskFade) return;
        ch.updateMaskFade();
        if (ch.isMaskFadeHidden && ch.isMaskFadeHidden()) {
            this.visible = false;
            return;
        }
        var index = ch.maskFadeIndex ? ch.maskFadeIndex() : -1;
        if (index >= 0) {
            if (this._lastMaskFadeIndex !== index) {
                if (this._yuraInfo) this._lastFrame = null;
                this._lastMaskFadeIndex = index;
            }
            this._applyMaskFadeIndex(index);
        } else if (this._lastMaskFadeIndex !== -999) {
            this._lastMaskFadeIndex = -999;
            if (this._yuraInfo) this._lastFrame = null;
            this._clearMaskFade();
        }
    };
    var _Sprite_Character_update = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        _Sprite_Character_update.apply(this, arguments);
        this.updateMaskFade();
    };

    //キャラの画像指定　ゆらゆら対応版
    Game_CharacterBase.prototype.setImageZXC = function (characterName, characterIndex, direction) {
        this._tileId = 0;
        this._characterName = characterName;
        this._isObjectCharacter = ImageManager.isObjectCharacter(characterName);
        if (characterIndex !== undefined) this._characterIndex = characterIndex;
        if (direction !== undefined) this._direction = direction;
        var sp = this.sprite();
        if (sp) {
            sp.updateBitmap();
            sp.update();
        }
    };

    //-----------------------------------------------------------------------------
    // 敵スプライトのマップ表示
    //-----------------------------------------------------------------------------

    const _Game_Event_initialize2 = Game_Event.prototype.initialize;
    Game_Event.prototype.initialize = function (mapId, eventId) {
        _Game_Event_initialize2.apply(this, arguments);
        this._enemySpriteInfo = null;
        if (this.event() && this.event().meta && this.event().meta.enemy) {
            const id = Number(this.event().meta.enemy);
            if (id && $dataEnemies && $dataEnemies[id]) {
                const enemy = $dataEnemies[id];
                const meta = enemy.meta || {};
                this._enemySpriteInfo = {
                    id: id, name: enemy.battlerName,
                    frameSize: Number(meta.frameSize) || 144,
                    waitAnimationType: Number(meta.waitAnimationType) || 1
                };
                this._scaleX = this._scaleY = 200;
                this.setOrigin(50, 80);
            }
        }
    };
    Game_Event.prototype.enemySpriteInfo = function () {
        return this._enemySpriteInfo;
    };
    if (!Sprite_Character.prototype.animationWait) {
        Sprite_Character.prototype.animationWait = function () {
            if (this._character && this._character.animationWait) return this._character.animationWait();
            return $gameSystem.animationWait();
        };
    }
    const _Sprite_Character_setCharacterBitmap2 = Sprite_Character.prototype.setCharacterBitmap;
    Sprite_Character.prototype.setCharacterBitmap = function () {
        const ch = this._character;
        if (ch instanceof Game_Event && ch.enemySpriteInfo && ch.enemySpriteInfo()) {
            const info = ch.enemySpriteInfo();
            this.bitmap = ImageManager.loadSvEnemy(info.name);
            this._baseBitmap = null, this._yuraInfo = null;
            this._enemySprite = true;
            this._frameSize = info.frameSize || 144;
            this._waitAnimationType = info.waitAnimationType || 1;
            this.scale.x = this.scale.y = 2;
            this._live2d = null, this._forceFrame = null, this._collapsePhase = null;
            this._animationType = 0, this._animationIndex = 0;
            this._animationFrames = 1, this._animationLoop = true;
            this._animationWait = 0, this._animationDuration = 0, this._animationCount = 0;
            this.getAnimationType = Sprite_NewEnemy.prototype.getAnimationType;
            this._needEnemyAnimInit = true;
            if (!this._enemyBattlerDummy) {
                this._enemyBattlerDummy = {
                    isDead: function () { return false; },
                    isStateAffected: function () { return false; }
                };
            }
            this._battler = this._enemyBattlerDummy;
            return;
        }
        this._enemySprite = false;
        this._needEnemyAnimInit = false;
        _Sprite_Character_setCharacterBitmap2.apply(this, arguments);
    };
    const _Sprite_Character_update2 = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function () {
        _Sprite_Character_update2.apply(this, arguments);
        if (this._enemySprite) {
            if (this._needEnemyAnimInit) {
                this._needEnemyAnimInit = false;
                Sprite_NewBattler.prototype.setAnimation.call(this, 'wait', true);
            }
            this.scale.y = 2;
            this.scale.x = [6, 8].contains(this._character._direction) ? -2 : 2;
            this.anchor.x = 0.5, this.anchor.y = 0.8;
        }
    };
    const _Sprite_Character_updateCharacterFrame3 = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function () {
        if (this._enemySprite) return Sprite_NewBattler.prototype.updateFrame.call(this);
        _Sprite_Character_updateCharacterFrame3.apply(this, arguments);
    };
    Sprite_Character.prototype.setAnimation = function (type, loop, wait, duration) {
        if (this._enemySprite) return Sprite_NewBattler.prototype.setAnimation.call(this, type, loop, wait, duration);
    };
    Game_CharacterBase.prototype.setAnimation = function (type, loop, wait, duration) {
        var sp = this.sprite && this.sprite();
        if (sp && sp.setAnimation) return sp.setAnimation(type, loop, wait, duration);
    };
    Sprite_Character.prototype.setDisplayMirror = function () {
        if (this._enemySprite) return Sprite_NewBattler.prototype.setDisplayMirror.apply(this, arguments);
    };
    Sprite_Character.prototype.refreshDisplayMirror = function () {
        if (this._enemySprite) return Sprite_NewBattler.prototype.refreshDisplayMirror.apply(this, arguments);
    };

    //-----------------------------------------------------------------------------
    // 自作フェード
    //-----------------------------------------------------------------------------

    // スプライト。0～8はシート、9は全面白。-1は非表示
    function Sprite_FadeZXC() {
        this.initialize.apply(this, arguments);
    }
    Sprite_FadeZXC.prototype = Object.create(Sprite.prototype);
    Sprite_FadeZXC.prototype.constructor = Sprite_FadeZXC;

    Sprite_FadeZXC.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._sheet = new Sprite_Base();
        this._white = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        this._white.visible = false;
        this.addChild(this._sheet);
        this.addChild(this._white);
        this.setBitmap();
        this.visible = false;
        this._lastStage = -1;
    };
    Sprite_FadeZXC.prototype.setBitmap = function () {
        var black = !!$gameScreen._fadeZXCColor;
        this._white.bitmap.fillAll(black ? 'black' : 'white');
        this._bitmap = ImageManager.loadSystem(black ? 'fadeBlack' : 'fadeWhite');
        this._bitmap.addLoadListener(function () {
            this._cellW = Math.floor(this._bitmap.width / 3);
            this._cellH = Math.floor(this._bitmap.height / 3);
            this._sheet.bitmap = this._bitmap;
            this._sheet.scale.x = Graphics.boxWidth / this._cellW;
            this._sheet.scale.y = Graphics.boxHeight / this._cellH;
        }.bind(this));
    };
    Sprite_FadeZXC.prototype.setStage = function (stage) {
        if (stage === this._lastStage) return;
        this._lastStage = stage;
        var none = stage < 0;
        var full = stage === 9;
        this.visible = !none;
        this._white.visible = full;
        this._sheet.visible = !none && !full;
        if (this._sheet.visible && this._bitmap && this._bitmap.isReady()) {
            var col = stage % 3;
            var row = Math.floor(stage / 3);
            this._sheet.setFrame(col * this._cellW, row * this._cellH, this._cellW, this._cellH);
        }
    };
    Sprite_FadeZXC.prototype.update = function () {
        Sprite.prototype.update.call(this);
        if ($gameScreen._fadeZXCRequestUpdate) {
            this.setBitmap();
            $gameScreen._fadeZXCRequestUpdate = false;
        }
    };
    // Spriteset_Base に載せる（常に最上位付近）
    const _Spriteset_Base_createUpperLayer = Spriteset_Base.prototype.createUpperLayer;
    Spriteset_Base.prototype.createUpperLayer = function () {
        _Spriteset_Base_createUpperLayer.call(this);
        this._fadeZXC = new Sprite_FadeZXC();
        this.addChild(this._fadeZXC);
    };
    const _Spriteset_Base_update = Spriteset_Base.prototype.update;
    Spriteset_Base.prototype.update = function () {
        _Spriteset_Base_update.apply(this, arguments);
        if (this._fadeZXC) {
            var stage = $gameScreen.fadeZXCStage();
            this._fadeZXC.setStage(stage);
            this._fadeZXC._sheet._yuraInfo = ($gameSwitches.value(18) && stage === 1) ? [5, 10] : null;
        }
    };
    // Game_Screen 拡張
    const _Game_Screen_initialize = Game_Screen.prototype.initialize;
    Game_Screen.prototype.initialize = function () {
        _Game_Screen_initialize.call(this);
        this.clearFadeZXC();
        this.initSmallMessages();
    };
    Game_Screen.prototype.clearFadeZXC = function () {
        this._fadeZXCQueue = null;
        this._fadeZXCIndex = 0;
        this._fadeZXCFrame = 0;
        this._fadeZXCActive = false;
        this._fadeZXCStage = -1;
        this._fadeZXCPresent = false;
        this._fadeZXCColor = 0;
        this._fadeZXCRequestUpdate = false;
    };
    Game_Screen.prototype.fadeZXCStage = function () {
        if (this._fadeZXCStage === undefined) this._fadeZXCStage = -1;
        var value = this._fadeZXCStage;
        return $gameSwitches.value(18) ? Math.max(value, 1) : value;
    };
    Game_Screen.prototype.startFadeInZXC = function (duration, color) {
        if (this._fadeZXCPresent) return;
        this._fadeZXCColor = color ? 1 : 0;
        this._startZXC(this._buildInQueue(this._zxcSteps(duration)));
    };
    Game_Screen.prototype.startFadeOutZXC = function (duration, color) {
        if (!this._fadeZXCPresent || this._fadeZXCStage !== 9) return;
        this._fadeZXCColor = color ? 1 : 0;
        this._startZXC(this._buildOutQueue(this._zxcSteps(duration)));
    };
    Game_Screen.prototype._zxcSteps = function (duration) {
        duration = Math.max(0, Math.min(100, Number(duration) || 0));
        return Math.max(1, Math.min(10, Math.floor(duration / 10) || 0));
    };
    Game_Screen.prototype._startZXC = function (queue) {
        this._fadeZXCQueue = queue.slice();
        this._fadeZXCIndex = 0;
        this._fadeZXCFrame = 0;
        this._fadeZXCActive = true;
        this._fadeZXCPresent = true;
        this._fadeZXCRequestUpdate = true;
    };
    Game_Screen.prototype._buildInQueue = function (steps) {
        return this._buildZXCQueue(steps, 0, 8, 9);
    };
    Game_Screen.prototype._buildOutQueue = function (steps) {
        return this._buildZXCQueue(steps, 8, 0, -1);
    };
    Game_Screen.prototype._buildZXCQueue = function (steps, from, to, last) {
        if (steps <= 1) return [last];
        var k = steps - 1;
        var arr = [];
        for (var j = 0; j < k; j++) {
            arr.push(Math.round(from + (to - from) * j / (k - 1)));
        }
        arr.push(last);
        return arr;
    };
    const _Game_Screen_update = Game_Screen.prototype.update;
    Game_Screen.prototype.update = function () {
        _Game_Screen_update.call(this);
        this._updateFadeZXC();
        this.updateSmallMessages();
    };
    Game_Screen.prototype._updateFadeZXC = function () {
        if (!this._fadeZXCActive || !this._fadeZXCQueue) return;
        if (this._fadeZXCFrame === 0) this._applyZXCStage(this._fadeZXCQueue[this._fadeZXCIndex]);
        if (++this._fadeZXCFrame >= 10) {
            this._fadeZXCFrame = 0;
            if (++this._fadeZXCIndex >= this._fadeZXCQueue.length) {
                this._fadeZXCActive = false;
            } else {
                this._applyZXCStage(this._fadeZXCQueue[this._fadeZXCIndex]);
            }
        }
    };
    Game_Screen.prototype._applyZXCStage = function (stage) {
        this._fadeZXCStage = stage;
        this._fadeZXCPresent = stage >= 0;
    };

    //-----------------------------------------------------------------------------
    // 天候
    //-----------------------------------------------------------------------------

    const _Weather__updateSprite = Weather.prototype._updateSprite;
    Weather.prototype._updateSprite = function (sprite) {
        if (this.type === 'ash') this._updateAshSprite(sprite); //塵
        if (this.type === 'bubble') this._updateBubbleSprite(sprite); //水中の泡
        _Weather__updateSprite.apply(this, arguments);
    };

    Weather.prototype._updateAshSprite = function (sprite) { //塵
        if (!this._ashBitmap) this._ashBitmap = ImageManager.loadSystem('weather_ash');
        if (!sprite._set) {
            sprite.bitmap = this._ashBitmap;
            sprite.setFrame(3 * Math.randomInt(8), 0, 3, 3);
            sprite._count = sprite._count === undefined ? 1 : _rand(80, 120);
            sprite.opacity = 255;
            sprite.scale.x = sprite.scale.y = _rand(100, 300) / 100;
            sprite._set = true;
        }
        var a = 5;
        if (sprite._count % a === 0) {
            var rotation = Math.PI / 16;
            sprite.ax -= 6 * Math.sin(rotation) * sprite.scale.x * -0.9 * a + _rand(-8, 8);
            sprite.ay += 6 * Math.cos(rotation) * sprite.scale.x * 0.3 * a + _rand(-8, 8);
        }
        if (sprite._count-- <= 0) {
            sprite._set = false;
            this._rebornSprite(sprite);
        }
    };

    Weather.prototype._updateBubbleSprite = function (sprite) { //水中の泡
        if (!this._bubbleBitmap) this._bubbleBitmap = ImageManager.loadSystem('weather_bubble');
        if (!sprite._set) {
            sprite.bitmap = this._bubbleBitmap;
            sprite.bitmap.addLoadListener(function (index) {
                var w = sprite.bitmap.width / 3, h = sprite.bitmap.height;
                sprite.setFrame([0, 1, 2, 0][index] * w, 0, w, h);
            }.bind(this, sprite._bc));
            sprite._count = sprite._count === undefined ? _rand(1, 120) : _rand(2400, 3600);
            sprite.opacity = 255;
            sprite._set = true;
        }
        var a = 5;
        if (sprite._count % a === 0) {
            sprite.ax -= 2 * Math.sin(sprite._count / sprite._bsi * Math.PI) * sprite.scale.x;
            sprite.ay -= 3 * sprite.scale.y;
        }
        if (sprite._count-- <= 0 || sprite.y < -32 || sprite.y >= Graphics.height + 32) {
            sprite._set = false;
            this._rebornSprite(sprite);
        }
    };
    const _Weather__rebornSprite = Weather.prototype._rebornSprite;
    Weather.prototype._rebornSprite = function (sprite) {
        if (this.type === 'bubble') {
            if (!this._spot || !this._spot.count) this._spot = {
                x: Math.randomInt(Graphics.width + 100) - 100,
                y: Math.randomInt(Graphics.height),
                scale: _rand(100, 300) / 100, swingInterval: _rand(15, 30),
                count: _rand(2, 4)
            }
            if (($gameTemp._bubblePlayer && Math.randomInt(10)) || !Math.randomInt(10)) 
                this._spot.x = $gamePlayer.screenX() + _rand(-24, 24), this._spot.y = $gamePlayer.screenY(),
                this._spot.scale = _rand(100, 200) / 100;
            sprite.ax = this._spot.x + _rand(-10, 10) * this._spot.scale + this.origin.x;
            sprite.ay = this._spot.y + _rand(-20, 20) * this._spot.scale + this.origin.y;
            sprite.scale.x = sprite.scale.y = this._spot.scale;
            sprite._bsi = this._spot.swingInterval;
            sprite._bc = this._spot.count - 1;
            this._spot.count--;
        } else {
            _Weather__rebornSprite.apply(this, arguments);
        }
    };


    //-----------------------------------------------------------------------------
    // ページめくり演出
    //-----------------------------------------------------------------------------

    SceneManager.snap = function () {
        this._scene.removeChild(this._scene._frontSprite);
        var bmp = Bitmap.snap(this._scene);
        if (this._scene._frontSprite) this._scene.addChild(this._scene._frontSprite);
        return bmp;
    };
    Scene_Base.prototype.startPageTurnEffect = function(duration, dir) {
        if (!this._fadeSprite) {
            this._fadeSprite = new ScreenSprite();
            this._fadeSprite.setBlack();
            this.addChild(this._fadeSprite);
        }
        this._fadeSprite.opacity = 255;
        $gameScreen._brightness = 0;
        let snapBitmap = $gameTemp._snap;
        var upsideDown = [3, 1].contains(dir);
        var rotate90 = dir === 4, rotateMinus90 = dir === 6;
        const W = Graphics.width, H = Graphics.height;
        var rotated = false;
        if (upsideDown) {
            const flippedBitmap = new Bitmap(snapBitmap.width, snapBitmap.height);
            const ctx = flippedBitmap._context;
            ctx.save();
            ctx.translate(0, snapBitmap.height);
            ctx.scale(1, -1);
            ctx.drawImage(snapBitmap._canvas, 0, 0);
            ctx.restore();
            flippedBitmap._setDirty();
            snapBitmap = flippedBitmap;
        }
        if (rotate90 || rotateMinus90) {
            // 回転用 bitmap を作成
            const rotatedBitmap = new Bitmap(H, W); // サイズを90度回転させる
            const ctx = rotatedBitmap._context;
            ctx.save();
            if (rotate90) {
                ctx.translate(H, 0);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(snapBitmap._canvas, 0, 0);
            } else {
                ctx.translate(0, W);
                ctx.rotate(-Math.PI / 2);
                ctx.drawImage(snapBitmap._canvas, 0, 0);
            }
            ctx.restore();
            rotatedBitmap._setDirty();
            snapBitmap = rotatedBitmap;
            rotated = true;
        }
        const texture = PIXI.Texture.fromCanvas(snapBitmap._canvas);
        const cols = 200, rows = 200;
        const mesh = new PIXI.mesh.Plane(texture, cols + 1, rows + 1);
        mesh.position.set(0, 0);
        mesh.visible = true;
        mesh.alpha = 1;
        if (upsideDown) mesh.scale.y = -1, mesh.y = Graphics.height;
        else if (rotate90) mesh.rotation = -90 / 180 * Math.PI, mesh.y = Graphics.height;
        else if (rotateMinus90) mesh.rotation = 90 / 180 * Math.PI, mesh.x = Graphics.width;
        this.addChild(mesh);
        this._pageTurnPlane = mesh;
        this._pageTurnVertices0 = [];
        const vert = mesh.vertices;
        for (let i = 0; i < vert.length / 2; i++) {
            this._pageTurnVertices0.push({ x: vert[i * 2], y: vert[i * 2 + 1] });
        }
        let tx, ty;
        switch (dir) {
            case 1: tx = -W;     ty = -H;     break; // 右上 → 左下
            case 7: tx = -W;     ty = -H;     break; // 右下 → 左上
            case 3: tx = W * 2;  ty = -H;     break; // 左上 → 右下
            case 9: tx = W * 2;  ty = -H;     break; // 左下 → 右上
            case 4: tx = W / 2;  ty = -H;     break; // 右 → 左
            case 6: tx = W / 2;  ty = -H;     break; // 左 → 右
            default: tx = -W;    ty = H * 2;  break;
        }
        this._pageTurnDirection = dir;
        this._pageTurnTarget = { x: tx, y: ty };
        this._pageTurnDuration = duration;
        this._pageTurnTotal = duration;
    };

    const _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        _Scene_Base_update.call(this);
        this.updatePageTurnEffect();
        this.updateSmallMessages();
        if ($gameScreen) {
            this.createFadeSprite();
            this._fadeSprite.opacity = 255 - $gameScreen.brightness();
        }
    };
    const _Scene_Base_fadeOutAll = Scene_Base.prototype.fadeOutAll;
    Scene_Base.prototype.fadeOutAll = function () {
        _Scene_Base_fadeOutAll.apply(this, arguments);
        $gameScreen.startFadeOut(this.slowFadeSpeed());
    };
    Scene_Base.prototype.updatePageTurnEffect = function() {
        if (this._pageTurnDuration > 0) {
            this._pageTurnDuration--;
            const t = 1 - (this._pageTurnDuration / this._pageTurnTotal);
            const mesh = this._pageTurnPlane;
            const vert = mesh.vertices;
            const basePos = this._pageTurnVertices0;
            const isHorizontal = [4, 6].contains(this._pageTurnDirection);
            const W = isHorizontal ? Graphics.height : Graphics.width;
            const H = isHorizontal ? Graphics.width : Graphics.height;
            const tx = this._pageTurnTarget.x, ty = this._pageTurnTarget.y;
            let baseX, baseY;
            switch (this._pageTurnDirection) {
                case 1:
                case 7: baseX = 1;   baseY = 1; break;
                case 3:
                case 9: baseX = 0;   baseY = 1; break;
                case 4: baseX = 0.5; baseY = 1; break;
                case 6: baseX = 0.5; baseY = 1; break;
                default: baseX = 1;  baseY = 0; break;
            }
            for (let i = 0; i < basePos.length; i++) {
                const origX = basePos[i].x;
                const origY = basePos[i].y;
                let xNorm = origX / W;
                let yNorm = origY / H;
                if (isHorizontal) xNorm = 0;
                let w = ((1 - Math.abs(xNorm - baseX)) + (1 - Math.abs(yNorm - baseY))) / 2;
                w = Math.max(0, Math.min(1, w));
                let tv = t < 1 - w ? 0 : (t - (1 - w)) / w;
                tv = Math.min(1, tv);
                if (isHorizontal) {
                    vert[i * 2]     = origX - tv * (W / 2 - origX) * 1;
                    tv = (tv + 0.2 * tv * Math.sin(tv * Math.PI)) / 1.2;
                    vert[i * 2 + 1] = origY + tv * (ty - origY);
                } else {
                    tv = (4 * tv - Math.sin(tv * Math.PI)) / 4;
                    vert[i * 2]     = origX + tv * (tx - origX);
                    vert[i * 2 + 1] = origY + tv * (ty - origY);
                }
            }
            if (this._pageTurnDuration === 0) {
                this.removeChild(this._pageTurnPlane);
                this._pageTurnPlane.destroy({ texture: true, baseTexture: false });
                this._pageTurnPlane = null;
                this._pageTurnVertices0 = null;
            }
        }
    };
    Spriteset_Base.prototype.updateScreenSprites = function () {
        var color = $gameScreen.flashColor();
        this._flashSprite.setColor(color[0], color[1], color[2]);
        this._flashSprite.opacity = color[3];
    };

    //-----------------------------------------------------------------------------
    // 暗闇
    //-----------------------------------------------------------------------------

    const PLAYER_LIGHT_RADIUS = 100;
    const DARKNESS_CELL_SIZE = 2;
    const DARKNESS_PATTERN_SCALE = 2;
    const DARKNESS_YURA_FILTER_INFO = {
        blockSize: 5,
        maxShake: 10,
        frame: 10,
        pixelSnap: true,
        seed: 43
    };
    const DARKNESS_SHEET_COLUMNS = 3;
    const DARKNESS_SHEET_ROWS = 3;
    const DARKNESS_LAYERS = [
        { brightness: 0, frameIndex: 8 },
        { brightness: 1, frameIndex: 6 },
        { brightness: 2, frameIndex: 4 },
        { brightness: 3, frameIndex: 2 }
    ];
    const PLAYER_LIGHT_DIR_OFFSETS = {
        2: [-36, -64],
        4: [-47, -64],
        6: [35, -64],
        8: [30, -78]
    };

    function darknessNumber(value, fallback) {
        const n = Number(value);
        return isFinite(n) ? n : fallback;
    }

    function darknessScreenWidth() {
        return Math.max(1, Math.ceil(Graphics.width || Graphics.boxWidth || 1));
    }

    function darknessScreenHeight() {
        return Math.max(1, Math.ceil(Graphics.height || Graphics.boxHeight || 1));
    }

    function Sprite_Darkness() {
        this.initialize.apply(this, arguments);
    }
    Sprite_Darkness.prototype = Object.create(Sprite.prototype);
    Sprite_Darkness.prototype.constructor = Sprite_Darkness;

    Sprite_Darkness.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._sourceBitmap = ImageManager.loadSystem('fadeBlack');
        this._layers = [];
        this._maskW = 0;
        this._maskH = 0;
        this._screenW = 0;
        this._screenH = 0;
        this._brightness = null;
        this._lastFrameWidth = 0;
        this._lastFrameHeight = 0;
        this._lastLightHash = null;
        this._darknessView = new Sprite();
        this._darknessView._yuraFilterOffset = [0, 0];
        this._darknessView.setYuraFilterZXC(DARKNESS_YURA_FILTER_INFO);
        this.addChild(this._darknessView);
        this._createLayers();
        this._sourceBitmap.addLoadListener(this._refreshPatternFrames.bind(this));
        this.visible = false;
    };

    Sprite_Darkness.prototype._createLayers = function () {
        for (let i = 0; i < DARKNESS_LAYERS.length; i++) {
            const info = DARKNESS_LAYERS[i];
            const sprite = new TilingSprite(this._sourceBitmap);
            const mask = new Sprite();
            sprite.tileScale.x = DARKNESS_PATTERN_SCALE;
            sprite.tileScale.y = DARKNESS_PATTERN_SCALE;
            mask.visible = true;
            mask.renderable = false;
            sprite.mask = mask;
            this._darknessView.addChild(sprite);
            this._darknessView.addChild(mask);
            this._layers.push({
                brightness: info.brightness,
                frameIndex: info.frameIndex,
                sprite: sprite,
                mask: mask,
                maskBitmap: null,
                imageData: null
            });
        }
    };

    Sprite_Darkness.prototype._isDarkMap = function () {
        return !!($dataMap && $dataMap.meta && $dataMap.meta.dark);
    };

    Sprite_Darkness.prototype._refreshPatternFrames = function () {
        if (!this._sourceBitmap || !this._sourceBitmap.isReady()) return;
        const frameW = Math.floor(this._sourceBitmap.width / DARKNESS_SHEET_COLUMNS);
        const frameH = Math.floor(this._sourceBitmap.height / DARKNESS_SHEET_ROWS);
        if (frameW <= 0 || frameH <= 0) return;
        if (this._lastFrameWidth === frameW && this._lastFrameHeight === frameH) return;
        this._lastFrameWidth = frameW;
        this._lastFrameHeight = frameH;
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            const sx = (layer.frameIndex % DARKNESS_SHEET_COLUMNS) * frameW;
            const sy = Math.floor(layer.frameIndex / DARKNESS_SHEET_COLUMNS) * frameH;
            layer.sprite.bitmap = this._sourceBitmap;
            layer.sprite.setFrame(sx, sy, frameW, frameH);
        }
    };

    Sprite_Darkness.prototype._refreshLayout = function () {
        const screenW = darknessScreenWidth();
        const screenH = darknessScreenHeight();
        const maskW = Math.max(1, Math.ceil(screenW / DARKNESS_CELL_SIZE));
        const maskH = Math.max(1, Math.ceil(screenH / DARKNESS_CELL_SIZE));
        if (this._screenW === screenW && this._screenH === screenH &&
                this._maskW === maskW && this._maskH === maskH) {
            return false;
        }
        this._screenW = screenW;
        this._screenH = screenH;
        this._maskW = maskW;
        this._maskH = maskH;
        this._brightness = new Uint8Array(maskW * maskH);
        this._darknessView.x = 0;
        this._darknessView.y = 0;

        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            const sprite = layer.sprite;
            sprite.move(0, 0, screenW, screenH);

            const maskBitmap = new Bitmap(maskW, maskH);
            maskBitmap.smooth = false;
            const imageData = maskBitmap._context.createImageData(maskW, maskH);
            const data = imageData.data;
            for (let p = 0; p < data.length; p += 4) {
                data[p] = 255;
                data[p + 1] = 255;
                data[p + 2] = 255;
                data[p + 3] = 0;
            }
            maskBitmap._context.putImageData(imageData, 0, 0);
            maskBitmap._setDirty();

            layer.maskBitmap = maskBitmap;
            layer.imageData = imageData;
            layer.mask.bitmap = maskBitmap;
            layer.mask.x = 0;
            layer.mask.y = 0;
            layer.mask.scale.x = DARKNESS_CELL_SIZE;
            layer.mask.scale.y = DARKNESS_CELL_SIZE;
        }
        return true;
    };

    Sprite_Darkness.prototype._updateTileOrigins = function () {
        const ox = $gameMap.displayX() * $gameMap.tileWidth();
        const oy = $gameMap.displayY() * $gameMap.tileHeight();
        for (let i = 0; i < this._layers.length; i++) {
            this._layers[i].sprite.origin.x = ox;
            this._layers[i].sprite.origin.y = oy;
        }
    };

    Sprite_Darkness.prototype._updateYuraFilter = function () {
        const view = this._darknessView;
        if (!view) return;
        const pad = Math.ceil(Math.abs(DARKNESS_YURA_FILTER_INFO.maxShake) + DARKNESS_YURA_FILTER_INFO.blockSize);
        const width = this._screenW + pad * 2;
        const height = this._screenH + pad * 2;
        let area = view._yuraFilterArea;
        if (!area) {
            area = view._yuraFilterArea = new PIXI.Rectangle(-pad, -pad, width, height);
        } else {
            area.x = -pad;
            area.y = -pad;
            area.width = width;
            area.height = height;
        }
        view._yuraFilterInfo = DARKNESS_YURA_FILTER_INFO;
        view._yuraFilterOffset[0] = $gameMap.displayX() * $gameMap.tileWidth();
        view._yuraFilterOffset[1] = $gameMap.displayY() * $gameMap.tileHeight();
        view.updateYuraFilterZXC();
    };

    Sprite_Darkness.prototype._screenPos = function (ch) {
        const th = $gameMap.tileHeight();
        return { x: ch.screenX(), y: ch.screenY() - th / 2 };
    };

    Sprite_Darkness.prototype._pushLight = function (lights, ch, radius, offsetX, offsetY) {
        if (!ch) return;
        const r = Math.max(0, darknessNumber(radius, 0));
        if (r <= 0) return;
        const dx = darknessNumber(offsetX, 0);
        const dy = darknessNumber(offsetY, 0);
        const pos = this._screenPos(ch);
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (x + r < 0 || x - r > this._screenW || y + r < 0 || y - r > this._screenH) return;
        lights.push({ x: x, y: y, r: r });
    };

    Sprite_Darkness.prototype._collectPlayerLight = function (lights) {
        if (!$gamePlayer) return;
        let r = PLAYER_LIGHT_RADIUS;
        let dx = darknessNumber($gamePlayer._lightOffsetX, 0);
        let dy = darknessNumber($gamePlayer._lightOffsetY, 0);
        const dir = ($gamePlayer.direction && $gamePlayer.direction()) || 0;
        const dirOffset = PLAYER_LIGHT_DIR_OFFSETS[dir] || [0, 0];
        dx += dirOffset[0];
        dy += dirOffset[1];
        if ($gamePlayer._lightRadius != null) r = darknessNumber($gamePlayer._lightRadius, 0);
        this._pushLight(lights, $gamePlayer, r, dx, dy);
    };

    Sprite_Darkness.prototype._collectCharacterLight = function (lights, ch) {
        if (!ch || ch._lightRadius == null) return;
        const r = darknessNumber(ch._lightRadius, 0);
        const dx = darknessNumber(ch._lightOffsetX, 0);
        const dy = darknessNumber(ch._lightOffsetY, 0);
        this._pushLight(lights, ch, r, dx, dy);
    };

    Sprite_Darkness.prototype._collectEventLight = function (lights, ev) {
        if (!ev || ev._erased) return;
        if (ev._lightRadius != null) {
            this._collectCharacterLight(lights, ev);
            return;
        }
        if (!ev.event || !ev.event()) return;
        const meta = ev.event().meta && ev.event().meta.light;
        if (meta == null) return;
        const args = String(meta).split(',');
        const r = darknessNumber(args[0], 0);
        const dx = darknessNumber(args[1], 0);
        const dy = darknessNumber(args[2], 0);
        this._pushLight(lights, ev, r, dx, dy);
    };

    Sprite_Darkness.prototype._collectLights = function () {
        const lights = [];
        this._collectPlayerLight(lights);

        if ($gamePlayer && $gamePlayer.followers) {
            const followers = $gamePlayer.followers().visibleFollowers();
            for (let i = 0; i < followers.length; i++) this._collectCharacterLight(lights, followers[i]);
        }

        const events = $gameMap.events();
        for (let i = 0; i < events.length; i++) this._collectEventLight(lights, events[i]);

        const vehicles = $gameMap.vehicles ? $gameMap.vehicles() : [];
        for (let i = 0; i < vehicles.length; i++) this._collectCharacterLight(lights, vehicles[i]);
        return lights;
    };

    Sprite_Darkness.prototype._makeLightHash = function (lights) {
        let hash = '';
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            hash += Math.round(light.x * 100) + ',' +
                Math.round(light.y * 100) + ',' +
                Math.round(light.r * 100) + ';';
        }
        return hash;
    };

    Sprite_Darkness.prototype._clearBrightness = function () {
        if (this._brightness) this._brightness.fill(0);
    };

    Sprite_Darkness.prototype._applyLight = function (light) {
        const r = light.r;
        const full = r * 0.5;
        const outer = Math.max(1, r - full);
        const r2 = r * r;
        const full2 = full * full;
        const cell = DARKNESS_CELL_SIZE;
        const minX = Math.max(0, Math.floor((light.x - r) / cell));
        const maxX = Math.min(this._maskW - 1, Math.floor((light.x + r) / cell));
        const minY = Math.max(0, Math.floor((light.y - r) / cell));
        const maxY = Math.min(this._maskH - 1, Math.floor((light.y + r) / cell));

        for (let y = minY; y <= maxY; y++) {
            const py = y * cell + cell / 2;
            const dy = py - light.y;
            const dy2 = dy * dy;
            if (dy2 > r2) continue;
            let index = y * this._maskW + minX;
            for (let x = minX; x <= maxX; x++, index++) {
                const current = this._brightness[index];
                if (current >= 4) continue;
                const px = x * cell + cell / 2;
                const dx = px - light.x;
                const d2 = dx * dx + dy2;
                if (d2 > r2) continue;

                let add = 0;
                if (d2 <= full2) {
                    add = 4;
                } else {
                    const t = (Math.sqrt(d2) - full) / outer;
                    add = 4 - Math.ceil(t * 3);
                    if (add < 1) add = 1;
                    if (add > 3) add = 3;
                }
                const next = current + add;
                this._brightness[index] = next >= 4 ? 4 : next;
            }
        }
    };

    Sprite_Darkness.prototype._applyLights = function (lights) {
        for (let i = 0; i < lights.length; i++) this._applyLight(lights[i]);
    };

    Sprite_Darkness.prototype._writeMasks = function () {
        const count = this._maskW * this._maskH;
        for (let i = 0; i < count; i++) {
            const b = this._brightness[i];
            const p = i * 4 + 3;
            for (let j = 0; j < this._layers.length; j++) {
                const layer = this._layers[j];
                layer.imageData.data[p] = b === layer.brightness ? 255 : 0;
            }
        }
        for (let i = 0; i < this._layers.length; i++) {
            const layer = this._layers[i];
            layer.maskBitmap._context.putImageData(layer.imageData, 0, 0);
            layer.maskBitmap._setDirty();
            layer.maskBitmap.checkDirty();
        }
    };

    Sprite_Darkness.prototype.update = function () {
        Sprite.prototype.update.call(this);
        if (!this._isDarkMap()) {
            this.visible = false;
            return;
        }
        this.visible = true;
        this._refreshPatternFrames();
        const layoutChanged = this._refreshLayout();
        this._updateTileOrigins();
        this._updateYuraFilter();
        const lights = this._collectLights();
        const lightHash = this._makeLightHash(lights);
        if (!layoutChanged && this._lastLightHash === lightHash) return;
        this._lastLightHash = lightHash;
        this._clearBrightness();
        this._applyLights(lights);
        this._writeMasks();
    };
    const _Spriteset_Map_createWeather = Spriteset_Map.prototype.createWeather;
    Spriteset_Map.prototype.createWeather = function () {
        _Spriteset_Map_createWeather.apply(this, arguments);
        this._darkness = new Sprite_Darkness();
        this.addChild(this._darkness);
    };

    //-----------------------------------------------------------------------------
    // スプライトシート実装
    //-----------------------------------------------------------------------------

    Game_Interpreter.prototype.startCharacterSpriteSheetTest = function (skipRect) {
        if (!$gameTemp.isPlaytest()) return;
        this._testCharacterSpriteSheet = true;
        this._testCharacterSpriteSheetFlag = 0;
        this._testCharacterSpriteSheetInfo = {};
        var ch = this.character(0);
        ch.setOrigin(50, 100);
        ch.shiftPosition(0, 0);
        if (skipRect) {
            this._testCharacterSpriteSheetFlag = 2;
            const sprite = ch.sprite();
            this._testCharacterSpriteSheetInfo.rect =
                { x: 0, y: 0, width: sprite._baseBitmap.width, height: sprite._baseBitmap.height };
        }
    };
    Game_Interpreter.prototype.updateCharacterSpriteSheetTest = function () {
        var f = this._testCharacterSpriteSheetFlag || 0;
        var info = this._testCharacterSpriteSheetInfo || (this._testCharacterSpriteSheetInfo = {});
        if (f === 0) {
            const sprite = this.character(0).sprite();
            if (!sprite || !sprite._baseBitmap || !sprite._baseBitmap.isReady()) return;
            const bitmap = sprite._baseBitmap;
            const width = bitmap.width, height = bitmap.height;
            const win = new Window_Base(0, 0, width + 36, height + 36);
            win.opacity = 255;
            SceneManager._scene.addChild(win);
            win.contents.blt(bitmap, 0, 0, width, height, 0, 0);
            $gameTemp._testCharacterSpriteSheetWindow = win;
            info.rectG = new PIXI.Graphics();
            win.addChild(info.rectG);
            info.mouseDown = false;
            info.startPos = { x: 0, y: 0 };
            this._testCharacterSpriteSheetFlag = 1;
        }
        else if (f === 1) {
            const win = $gameTemp._testCharacterSpriteSheetWindow;
            win.open();
            const rectG = info.rectG, padding = win.padding;
            var mouseX = (TouchInput.x - win.x).clamp(padding, win.contents.width + padding);
            var mouseY = (TouchInput.y - win.y).clamp(padding, win.contents.height + padding);
            if (Input.isPressed('shift')) {
                mouseX = padding + Math.round((mouseX - padding) / 32) * 32;
                mouseY = padding + Math.round((mouseY - padding) / 32) * 32;
            }
            var ch = info.crosshair;
            if (!ch) SceneManager._scene.addChild(ch = info.crosshair = new PIXI.Graphics());
            ch.clear();
            ch.lineStyle(1, 0x00ffff, 1);
            ch.moveTo(mouseX + win.x, 0), ch.lineTo(mouseX + win.x, Graphics.height);
            ch.moveTo(0, mouseY + win.y), ch.lineTo(Graphics.width, mouseY + win.y);
            if (TouchInput.isPressed()) {
                if (!info.mouseDown) {
                    info.mouseDown = true;
                    info.startPos = { x: mouseX, y: mouseY };
                }
                const start = info.startPos;
                const x = Math.min(start.x, mouseX), y = Math.min(start.y, mouseY);
                const w = Math.abs(start.x - mouseX), h = Math.abs(start.y - mouseY);
                // 矩形描画更新
                rectG.clear();
                rectG.lineStyle(2, 0xff0000, 1);
                rectG.drawRect(x, y, w, h);
            } else if (info.mouseDown) {
                info.mouseDown = false;
                const start = info.startPos;
                const x = Math.min(start.x, mouseX) - padding, y = Math.min(start.y, mouseY) - padding;
                const w = Math.abs(start.x - mouseX), h = Math.abs(start.y - mouseY);
                info.rect = { x: x, y: y, width: w, height: h };
                SceneManager._scene.removeChild(info.crosshair);
                info.crosshair = null;
                win.removeChild(info.rectG);
                info.rectG = null;
                this._testCharacterSpriteSheetFlag = 2;
            }
        }
        else if (f === 2) {
            const win = $gameTemp._testCharacterSpriteSheetWindow;
            if (win) win.close();
            const ch = this.character(0), sprite = ch.sprite(), rect = info.rect;
            if (!sprite || !rect) return;
            sprite.setFrame(rect.x, rect.y, rect.width, rect.height);
            if (Input.isTriggered('left') || Input.isRepeated('left')) ch._additionalX -= 1;
            else if (Input.isTriggered('right') || Input.isRepeated('right')) ch._additionalX += 1;
            if (Input.isTriggered('up') || Input.isRepeated('up')) ch._additionalY -= 1;
            else if (Input.isTriggered('down') || Input.isRepeated('down')) ch._additionalY += 1;
            if (Input.isTriggered('ok')) {
                info.shift = { x: ch._additionalX, y: ch._additionalY };
                this._testCharacterSpriteSheetFlag = 3;
            }
        }
        else if (f === 3) {
            const sprite = this.character(0).sprite(), rect = info.rect;
            sprite.setFrame(rect.x, rect.y, rect.width, rect.height);
            if (!info.anchorLine) {
                info.anchorLine = new PIXI.Graphics();
                SceneManager._scene.addChild(info.anchorLine);
                info.anchorYPos = sprite.y - sprite.height / 2;
            }
            const line = info.anchorLine;
            if (Input.isTriggered('up') || Input.isRepeated('up')) info.anchorYPos -= 1;
            if (Input.isTriggered('down') || Input.isRepeated('down')) info.anchorYPos += 1;
            line.clear();
            line.lineStyle(2, 0xff0000, 1);
            const sx = sprite.x - rect.width, ex = sprite.x + rect.width;
            line.moveTo(sx, info.anchorYPos), line.lineTo(ex, info.anchorYPos);
            if (Input.isTriggered('ok')) {
                info.anchorY = ((info.anchorYPos - sprite.y + sprite.anchor.y * sprite.height) / sprite.height).clamp(0, 1);
                sprite.anchor.y = info.anchorY;
                info.shift.y -= Math.round((1 - info.anchorY) * rect.height);
                SceneManager._scene.removeChild(info.anchorLine);
                info.anchorLine = null;
                var text = '<CGShift:A,%1,%2><CGOrigin:A,50,%3><cssRect:%4,%5,%6,%7><yura:12,10>'.format(
                    info.shift.x, info.shift.y, Math.round(info.anchorY * 100), rect.x, rect.y, rect.width, rect.height
                );
                _p(text);
                const t = document.createElement("textarea");
                t.value = text;
                document.body.appendChild(t);
                t.select();
                document.execCommand("copy");
                document.body.removeChild(t);
                this._testCharacterSpriteSheet = false;
                this._testCharacterSpriteSheetFlag = 0;
                this._testCharacterSpriteSheetInfo = null;
            }
        }
    };
    var _Sprite_Character_updateCharacterFrame2 = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function () {
        if (this._character._cssRect) {
            var rect = this._character._cssRect;
            this._character.setSizeForMessagePopup(rect.width, rect.height);
            return this.setFrame(rect.x, rect.y, rect.width, rect.height);
        }
        _Sprite_Character_updateCharacterFrame2.apply(this, arguments);
    };
    var _Game_Interpreter_executeCommand = Game_Interpreter.prototype.executeCommand;
    Game_Interpreter.prototype.executeCommand = function () {
        if (this._testCharacterSpriteSheet && $gameTemp.isPlaytest()) return this.updateCharacterSpriteSheetTest();
        return _Game_Interpreter_executeCommand.apply(this, arguments);
    };

    //-----------------------------------------------------------------------------
    // スプライトシート作成＆ダウンロード機能
    //-----------------------------------------------------------------------------

    //キャラクターの画像をダウンロードファイルに保存
    Game_Interpreter.prototype.command_saveYurayuraBitmap = function (w, h) {
        try {
            const ch = this.character(0);
            if (!ch || !ch.sprite) throw new Error('character(0) が見つからない/スプライト未生成');
            const spr = ch.sprite();
            if (!spr) throw new Error('Sprite_Character が未生成');

            spr.update();
            const f = spr._frame || { x: 0, y: 0, width: 0, height: 0 };
            let fw = Math.floor(f.width), fh = Math.floor(f.height);
            if (!fw || !fh) {
                if (typeof spr.patternWidth === 'function') fw = spr.patternWidth();
                if (typeof spr.patternHeight === 'function') fh = spr.patternHeight();
            }
            if (!fw || !fh) throw new Error('描画サイズが取得できない');
            const slotW = Math.max(1, Math.floor(w || fw));
            const slotH = Math.max(1, Math.floor(h || fh));
            const y = spr._yuraInfo ? spr._yuraInfo : (ch._yuraInfo || []);
            const blockSize = y[0] || 12;
            const maxShake = y[1] || 10;
            const frameWait = y[2] || $gameSystem.animationWait();
            const applyMask = !!y[3];
            const srcBmp = spr._baseBitmap || spr.bitmap;
            if (!srcBmp) throw new Error('元ビットマップが無い');
            const out = new Bitmap(slotW * 3, slotH);
            const octx = out._context;
            octx.imageSmoothingEnabled = false;
            const sx = f.x || 0, sy = f.y || 0;
            const renderYura = (patternIndex) => {
                const cropped = new Bitmap(fw, fh);
                cropped._context.imageSmoothingEnabled = false;
                cropped.blt(srcBmp, sx, sy, fw, fh, 0, 0);
                if (applyMask && Bitmap.prototype._applyNormalColorMask) {
                    cropped._applyNormalColorMask();
                }
                const mesh = new Sprite_Yurayura(cropped, blockSize, maxShake, frameWait, applyMask);
                const verts = mesh.vertices, orig = mesh._originalVertices;
                const pats = mesh._distortPatterns;
                const pat = pats[(patternIndex % pats.length + pats.length) % pats.length];
                for (let i = 0; i < verts.length; i++) verts[i] = orig[i] + pat[i];
                const container = new PIXI.Container();
                container.addChild(mesh);
                const canvas = Graphics._renderer.extract.canvas(container);
                container.destroy({ children: true, texture: false, baseTexture: false });
                return canvas;
            };
            const drawWithAnchor = (canvas, slotIndex) => {
                const imgW = canvas.width, imgH = canvas.height;
                const dstX = Math.floor(slotW * slotIndex + slotW / 2 - imgW / 2);
                const dstY = Math.floor(slotH - imgH);
                octx.drawImage(canvas, dstX, dstY);
                out._setDirty();
            };
            drawWithAnchor(renderYura(0), 0);
            {
                const centerBmp = new Bitmap(fw, fh);
                centerBmp._context.imageSmoothingEnabled = false;
                centerBmp.blt(srcBmp, sx, sy, fw, fh, 0, 0);
                drawWithAnchor(centerBmp._canvas, 1);
            }
            drawWithAnchor(renderYura(1), 2);
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const home = os.homedir();
            const candidates = [
                process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Downloads') : null,
                process.env.OneDrive ? path.join(process.env.OneDrive, 'Downloads') : null,
                path.join(home, 'Downloads'),
                path.join(home, 'ダウンロード')
            ].filter(Boolean);
            let dir = candidates.find(p => { try { return p && fs.existsSync(p); } catch (_) { return false; } });
            if (!dir) { dir = candidates[0]; try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { } }
            const d = new Date();
            const pad = n => String(n).padStart(2, '0');
            const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
            let fname = `${ts}.png`;
            let idx = 1;
            while (fs.existsSync(path.join(dir, fname))) fname = `${ts}_${String(idx++).padStart(2, '0')}.png`;
            const outPath = path.join(dir, fname);
            const dataUrl = out._canvas.toDataURL('image/png');
            const b64 = dataUrl.split(',')[1];
            fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
            console.log('[saveYurayuraBitmap] saved:', outPath);
            return outPath;
        } catch (e) {
            console.error('[saveYurayuraBitmap] ', e);
            return null;
        }
    };

    //-----------------------------------------------------------------------------
    // ピクチャスプライトシート
    //-----------------------------------------------------------------------------

    Game_Picture.prototype.clearSpriteSheetAnimation = function () {
        this._ssActive = false;
        this._ssRows = 1;
        this._ssCols = 1;
        this._ssFrameWait = 1;
        this._ssLoop = false;
        this._ssFrame = 0;
        this._ssCount = 0;
        this._ssSequence = [0];
        this._ssSeqPos = 0;
        this._ssEnabled = false;
        this._ssFinished = false;
    };

    Game_Picture.prototype.setSpriteSheetGrid = function (rows, cols) {
        this._ssRows = Math.max(1, Math.floor(Number(rows) || 1));
        this._ssCols = Math.max(1, Math.floor(Number(cols) || 1));
        this._ssActive = true;
        this._ssFrame = 0;
        this._ssCount = 0;
        this._ssSequence = [0];
        this._ssSeqPos = 0;
        this._ssEnabled = false;
        this._ssFinished = false;
    };

    Game_Picture.prototype.setSpriteSheetPlayback = function (order, frameWait, loop) {
        var total = Math.max(1, this.spriteSheetRows() * this.spriteSheetCols());
        var seq = normalizeSpriteSheetOrder_(order, total);
        this._ssFrameWait = Math.max(1, Math.floor(Number(frameWait) || 1));
        this._ssLoop = !!loop;
        this._ssSequence = seq;
        this._ssSeqPos = 0;
        this._ssFrame = seq[0] || 0;
        this._ssCount = 0;
        this._ssActive = true;
        this._ssEnabled = true;
        this._ssFinished = false;
    };

    Game_Picture.prototype.stopSpriteSheetPlayback = function () {
        this._ssEnabled = false;
        this._ssFinished = true;
        this._ssCount = 0;
    };

    Game_Picture.prototype.isSpriteSheetPicture = function () {
        return !!this._ssActive;
    };

    Game_Picture.prototype.isSpriteSheetAnimation = function () {
        return !!this._ssEnabled && !this._ssFinished;
    };

    Game_Picture.prototype.spriteSheetRows = function () {
        return Math.max(1, this._ssRows || 1);
    };

    Game_Picture.prototype.spriteSheetCols = function () {
        return Math.max(1, this._ssCols || 1);
    };

    Game_Picture.prototype.spriteSheetFrame = function () {
        return Math.max(0, this._ssFrame || 0);
    };

    Game_Picture.prototype.updateSpriteSheetAnimation = function () {
        if (!this._ssActive || !this._ssEnabled || this._ssFinished) return;
        this._ssCount++;
        if (this._ssCount < this._ssFrameWait) return;
        this._ssCount = 0;
        var seq = (this._ssSequence && this._ssSequence.length) ? this._ssSequence : [this._ssFrame || 0];
        var nextPos = this._ssSeqPos + 1;
        if (nextPos >= seq.length) {
            if (this._ssLoop) nextPos = 0;
            else {
                nextPos = seq.length - 1;
                this._ssFinished = true;
                this._ssEnabled = false;
            }
        }
        this._ssSeqPos = nextPos;
        var total = Math.max(1, this.spriteSheetRows() * this.spriteSheetCols());
        var frame = Math.floor(Number(seq[nextPos]));
        if (!isFinite(frame)) frame = 0;
        this._ssFrame = Math.max(0, Math.min(total - 1, frame));
    };

    var _Game_Picture_show_KNH_ZXC_System_SpriteSheet = Game_Picture.prototype.show;
    Game_Picture.prototype.show = function (name, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        _Game_Picture_show_KNH_ZXC_System_SpriteSheet.apply(this, arguments);
        this.clearSpriteSheetAnimation();
    };

    var _Game_Picture_erase_KNH_ZXC_System_SpriteSheet = Game_Picture.prototype.erase;
    Game_Picture.prototype.erase = function () {
        _Game_Picture_erase_KNH_ZXC_System_SpriteSheet.apply(this, arguments);
        this.clearSpriteSheetAnimation();
    };

    var _Game_Picture_update_KNH_ZXC_System_SpriteSheet = Game_Picture.prototype.update;
    Game_Picture.prototype.update = function () {
        _Game_Picture_update_KNH_ZXC_System_SpriteSheet.apply(this, arguments);
        this.updateSpriteSheetAnimation();
    };

    var _Sprite_Picture_update_KNH_ZXC_System_SpriteSheet = Sprite_Picture.prototype.update;
    Sprite_Picture.prototype.update = function () {
        _Sprite_Picture_update_KNH_ZXC_System_SpriteSheet.apply(this, arguments);
        this.ensureDefaultYuraInfoAfterBitmapReady();
        this.updateSpriteSheetFrame();
    };

    Sprite_Picture.prototype.ensureDefaultYuraInfoAfterBitmapReady = function () {
        if (!this.bitmap || !this.bitmap.isReady()) return;
        if (typeof this._yuraInfo === "undefined") this._yuraInfo = [];
    };

    Sprite_Picture.prototype.updateSpriteSheetFrame = function () {
        var picture = this.picture();
        if (!picture || !this.bitmap || !this.bitmap.isReady()) return;
        var bw = Math.floor(this.bitmap.width || 0);
        var bh = Math.floor(this.bitmap.height || 0);
        if (bw <= 0 || bh <= 0) return;

        if (!picture.isSpriteSheetPicture || !picture.isSpriteSheetPicture()) {
            if (this._ssFrameApplied) this.setFrame(0, 0, bw, bh);
            this._ssFrameApplied = false;
            return;
        }

        var rows = Math.max(1, picture.spriteSheetRows ? picture.spriteSheetRows() : 1);
        var cols = Math.max(1, picture.spriteSheetCols ? picture.spriteSheetCols() : 1);
        var cellW = Math.floor(bw / cols);
        var cellH = Math.floor(bh / rows);
        if (cellW <= 0 || cellH <= 0) return;
        var total = Math.max(1, rows * cols);
        var frame = picture.spriteSheetFrame ? picture.spriteSheetFrame() : 0;
        frame = Math.max(0, Math.min(total - 1, frame));
        var sx = (frame % cols) * cellW;
        var sy = Math.floor(frame / cols) * cellH;
        this.setFrame(sx, sy, cellW, cellH);
        this._ssFrameApplied = true;
    };

    function normalizeSpriteSheetOrder_(order, total) {
        total = Math.max(1, Math.floor(Number(total) || 1));
        var scalarCount = null;
        if (typeof order === "number" && isFinite(order)) {
            scalarCount = Math.floor(order);
        } else if (typeof order === "string") {
            var scalarText = applyCharacters(order == null ? "" : order).trim();
            if (/^[-+]?\d+(?:\.\d+)?$/.test(scalarText)) {
                scalarCount = Math.floor(Number(scalarText));
            }
        }
        if (scalarCount != null && scalarCount > 0) {
            var scalarSeq = [];
            for (var si = 0; si < scalarCount && si < total; si++) scalarSeq.push(si);
            if (!scalarSeq.length) scalarSeq.push(0);
            return scalarSeq;
        }
        var raw = [];
        if (Array.isArray(order)) {
            raw = order.slice();
        } else {
            var text = applyCharacters(order == null ? "" : order).trim();
            if (text) {
                try {
                    if (text[0] !== "[") text = "[" + text + "]";
                    var parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) raw = parsed;
                } catch (e) {
                    raw = text.split(",");
                }
            }
        }
        if (!raw.length) {
            for (var i = 0; i < total; i++) raw.push(i);
        }
        var seq = [];
        for (var j = 0; j < raw.length; j++) {
            var n = Math.floor(Number(raw[j]));
            if (!isFinite(n)) continue;
            if (n < 0 || n >= total) continue;
            seq.push(n);
        }
        if (!seq.length) seq.push(0);
        return seq;
    };

    function toBoolSpriteSheet_(value) {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        var text = applyCharacters(value == null ? "" : value).trim().toLowerCase();
        if (!text) return false;
        if (text === "true" || text === "on" || text === "yes" || text === "loop") return true;
        var n = Number(text);
        if (!isNaN(n)) return n !== 0;
        return false;
    };

    // ピクチャをスプライトシートとして表示
    Game_Interpreter.prototype.command_showSpriteSheetPicture = function (pictureId, pictureName, rows, cols, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        var id = Math.max(1, Math.floor(getNumber(pictureId, Infinity, 1) || 1));
        var name = applyCharacters(pictureName || "");
        var r = Math.max(1, Math.floor(getNumber(rows, Infinity, 1) || 1));
        var c = Math.max(1, Math.floor(getNumber(cols, Infinity, 1) || 1));
        var o = Math.max(0, Math.min(1, Math.floor(getNumber(origin, 1, 0) || 0)));
        var nx = getNumber(x); if (isNaN(nx)) nx = 0;
        var ny = getNumber(y); if (isNaN(ny)) ny = 0;
        var sx = getNumber(scaleX); if (isNaN(sx)) sx = 100;
        var sy = getNumber(scaleY); if (isNaN(sy)) sy = 100;
        var op = getNumber(opacity, 255, 0); if (isNaN(op)) op = 255;
        var bm = getNumber(blendMode, 3, 0); if (isNaN(bm)) bm = 0;

        $gameScreen.showPicture(id, name, o, nx, ny, sx, sy, op, bm);
        var pic = $gameScreen.picture(id);
        if (pic && pic.setSpriteSheetGrid) {
            pic.setSpriteSheetGrid(r, c);
        }
        return pic;
    };

    // スプライトシート再生
    Game_Interpreter.prototype.command_playSpriteSheetPicture = function (pictureId, order, frameWait, loop) {
        var id = Math.max(1, Math.floor(getNumber(pictureId, Infinity, 1) || 1));
        var pic = $gameScreen.picture(id);
        if (!pic) return null;
        var fw = Math.max(1, Math.floor(getNumber(frameWait, Infinity, 1) || 1));
        var lp = toBoolSpriteSheet_(loop);
        var total = Math.max(1, pic.spriteSheetRows() * pic.spriteSheetCols());
        var seq = normalizeSpriteSheetOrder_(order, total);
        if (pic.setSpriteSheetPlayback) {
            pic.setSpriteSheetPlayback(seq, fw, lp);
        }
        return pic;
    };

    // スプライトシート停止
    Game_Interpreter.prototype.command_stopSpriteSheetPicture = function (pictureId) {
        var id = Math.max(1, Math.floor(getNumber(pictureId, Infinity, 1) || 1));
        var pic = $gameScreen.picture(id);
        if (pic && pic.stopSpriteSheetPlayback) {
            pic.stopSpriteSheetPlayback();
        }
        return pic;
    };

    // 互換: 旧API（表示+再生一括）
    Game_Interpreter.prototype.command_showPictureSpriteSheet = function (pictureId, pictureName, rows, cols, frameWait, loop, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        var pic = this.command_showSpriteSheetPicture(
            pictureId, pictureName, rows, cols, origin, x, y, scaleX, scaleY, opacity, blendMode
        );
        if (pic) this.command_playSpriteSheetPicture(pictureId, null, frameWait, loop);
        return pic;
    };
    Game_Interpreter.prototype.command_playPictureSpriteSheet = function () {
        return this.command_playSpriteSheetPicture.apply(this, arguments);
    };
    Game_Interpreter.prototype.command_stopPictureSpriteSheet = function () {
        return this.command_stopSpriteSheetPicture.apply(this, arguments);
    };

    //-----------------------------------------------------------------------------
    // コマンド
    //-----------------------------------------------------------------------------

    //横階段
    Game_Interpreter.prototype.command_stairs = function(ox, oy, px, py, tileX) {
        var rx = $gamePlayer._realX, ry = $gamePlayer._realY;
        if (rx >= ox && rx <= px && ry >= oy && ry <= py) {
            var info = Math.floor(rx / Math.abs(tileX));
            if (this._lastStairsPx !== info) {
                var ay = (this._lastStairsPx > info ? 1 : -1) * (tileX > 0 ? 1 : -1) * 0.5;
                if (!Input.isPressed('down') && !Input.isPressed('up')) {
                    $gamePlayer._y += ay;
                    $gamePlayer._realY += ay;
                }
                this._lastStairsPx = info;
            }
        }
    };

    //横入力で斜め移動
    Game_Interpreter.prototype.command_rectDiagonalMove = function (x, y, w, h, mode) {
        x = Number(x) || 0; y = Number(y) || 0; w = Number(w) || 0; h = Number(h) || 0;
        var m = Number(mode) ? 1 : 0;
        if (w <= 0 || h <= 0) return;
        var rects = $gameTemp._rectDiagonalMoveRects || ($gameTemp._rectDiagonalMoveRects = []);
        for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            if (r.x === x && r.y === y && r.w === w && r.h === h) { r.m = m; return; }
        }
        rects.push({ x: x, y: y, w: w, h: h, m: m });
    };
    var _Game_Player_moveByInput = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function () {
        if (!this.isMoving() && this.canMove()) {
            var rects = $gameTemp._rectDiagonalMoveRects;
            if (rects && rects.length) {
                var left = Input.isPressed('left'), right = !left && Input.isPressed('right');
                var up = !left && !right && Input.isPressed('up'), down = !left && !right && !up && Input.isPressed('down');
                if (left || right || up || down) {
                    var px = this.x, py = this.y;
                    for (var i = 0; i < rects.length; i++) {
                        var r = rects[i];
                        if (px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h) {
                            var dir, face;
                            if (left) { dir = r.m ? 1 : 7; face = 4; }
                            else if (right) { dir = r.m ? 9 : 3; face = 6; }
                            else if (up) { dir = r.m ? 9 : 7; face = r.m ? 6 : 4; }
                            else { dir = r.m ? 1 : 3; face = r.m ? 4 : 6; }
                            this.executeMove(dir);
                            this.setDirection(face);
                            return;
                        }
                    }
                }
            }
            _Game_Player_moveByInput.call(this);
        }
    };

    //章イラストの表示
    Game_Interpreter.prototype.command_displayIllust = function (phase) {
        if (!phase) {
            var w = 700, h = 33 * 6 + 36;
            var x = (Graphics.boxWidth - w) / 2, y = 160;
            var wd = $gameTemp._illustWindow = new Window_Base(x, y, w, h);
            SceneManager._scene.addWindow(wd);
            wd.openness = 0, wd.open();

            var bmp =  ImageManager.loadPicture('illust%1_1'.format($gameVariables.value(3)));
            var bmp2 = ImageManager.loadPicture('illust%1_2'.format($gameVariables.value(3)));
            bmp.addLoadListener(() => {
                bmp2.addLoadListener(() => {
                    var sp = wd._sp = new Sprite();
                    sp.x = sp.y = 18, sp._count = 0, sp.scale.x = sp.scale.y = 2, sp._yuraInfo = [5, 12];
                    var a = 5;
                    sp.update = function () {
                        var index = Math.max(59 - Math.floor(this._count / a), 0);
                        sp.bitmap = sp._baseBitmap = index < 30 ? bmp : bmp2;
                        var w = bmp.width / 3, h = bmp.height / 10;
                        var x = ((index % 30) % 3) * w, y = Math.floor((index % 30) / 3) * h;
                        sp.setFrame(x, y, w, h);
                        sp._count++;
                        Sprite.prototype.update.call(this);
                    }
                    wd.addChild(sp);
                })
            });
            $gameSystem.setMessagePopupFree(Graphics.boxWidth / 2, Graphics.boxHeight / 2 + 33 * 5);
            $gameMessage._fukidashi = false;

        } else {
            SceneManager._scene._windowLayer.removeChild($gameTemp._illustWindow);
            $gameTemp._illustWindow = null;
        }
    };

    //簡単にスプライト表示
    Game_Interpreter.prototype.command_addSprite = function (id, sprite, x, y) {
        if (!sprite) return;
        const key = String(id);
        this.command_removeSprite(key); // 既存があれば削除
        const st = store_(), lay = layer_();
        if (!lay) return;
        const xs = (typeof x === "string") ? x.toLowerCase() : x;
        const ys = (typeof y === "string") ? y.toLowerCase() : y;
        sprite._cmdCenterX = (xs === "center");
        sprite._cmdCenterY = (ys === "center");
        if (!sprite._cmdCenterX) sprite.x = Number(x) || 0;
        if (!sprite._cmdCenterY) sprite.y = Number(y) || 0;
        lay.addChild(sprite);
        if (!sprite._cmdUpdateWrapped) { // "center" は画像ロード後にサイズが確定するので、updateで追従
            sprite._cmdUpdateWrapped = true;
            sprite._cmdUpdateOrig = sprite.update;
            sprite.update = function () {
                if (this._cmdUpdateOrig) this._cmdUpdateOrig.call(this);
                if (this._cmdCenterX || this._cmdCenterY) applyCenter_(this);
            };
        }
        if (sprite._cmdCenterX || sprite._cmdCenterY) applyCenter_(sprite);
        st[key] = sprite;
        return sprite;
    };
    Game_Interpreter.prototype.command_removeSprite = function (id) {
        if (!$gameTemp || !$gameTemp._cmdSprites) return;
        const st = $gameTemp._cmdSprites;
        const key = String(id);
        const spr = st[key];
        if (!spr) return;
        if (spr.parent) spr.parent.removeChild(spr);
        delete st[key];
    };
    function store_() {
        $gameTemp._cmdSprites = $gameTemp._cmdSprites || Object.create(null);
        return $gameTemp._cmdSprites;
    };
    function layer_() {
        const scene = SceneManager._scene;
        if (!scene) return null;
        if (!scene._cmdSpriteLayer) {
            scene._cmdSpriteLayer = new Sprite();
            scene.addChild(scene._cmdSpriteLayer);
        }
        return scene._cmdSpriteLayer;
    };
    function applyCenter_(spr) {
        const w = Graphics.boxWidth || Graphics.width;
        const h = Graphics.boxHeight || Graphics.height;
        const ax = (spr.anchor && typeof spr.anchor.x === "number") ? spr.anchor.x : 0;
        const ay = (spr.anchor && typeof spr.anchor.y === "number") ? spr.anchor.y : 0;
        const sw = (typeof spr.width === "number") ? spr.width : 0; // scale反映済み
        const sh = (typeof spr.height === "number") ? spr.height : 0;
        if (spr._cmdCenterX) spr.x = (w * 0.5) - ((0.5 - ax) * sw);
        if (spr._cmdCenterY) spr.y = (h * 0.5) - ((0.5 - ay) * sh);
    };

    //簡単にウィンドウ表示
    Game_Interpreter.prototype.command_addWindow = function (id, x, y, width, height) {
        const key = String(id);
        removeWindowImmediate_(key);
        const st = storeW_();
        const scene = SceneManager._scene;
        if (!scene) return;
        const w = Math.max(1, Number(width) | 0);
        const h = Math.max(1, Number(height) | 0);
        const win = new Window_Base(0, 0, w, h);
        const xs = (typeof x === "string") ? x.toLowerCase() : x;
        const ys = (typeof y === "string") ? y.toLowerCase() : y;
        win._cmdId = key;
        win._cmdCenterX = (xs === "center");
        win._cmdCenterY = (ys === "center");
        win._cmdClosing = false;
        if (!win._cmdCenterX) win.x = Number(x) || 0;
        if (!win._cmdCenterY) win.y = Number(y) || 0;
        if (win._cmdCenterX || win._cmdCenterY) applyCenterW_(win);
        win.openness = 0, win.open();
        if (scene.addWindow) scene.addWindow(win);
        else scene.addChild(win);
        if (!win._cmdUpdateWrapped) { //閉じきったら消す処理
            win._cmdUpdateWrapped = true;
            const _upd = win.update;
            win.update = function () {
                _upd.call(this);
                if (this._cmdCenterX || this._cmdCenterY) applyCenterW_(this);
                if (this._cmdClosing && this.openness <= 0) {
                    removeWindowImmediate_(this._cmdId);
                }
            };
        }
        st[key] = win;
        return win;
    };
    Game_Interpreter.prototype.command_removeWindow = function (id) {
        if (!$gameTemp || !$gameTemp._cmdWindows) return;
        const st = $gameTemp._cmdWindows;
        const key = String(id);
        const win = st[key];
        if (!win) return;
        if (!win._cmdClosing) {
            win._cmdClosing = true;
            win.close();
        }
    };
    function storeW_() {
        $gameTemp._cmdWindows = $gameTemp._cmdWindows || Object.create(null);
        return $gameTemp._cmdWindows;
    };
    function removeWindowImmediate_(key) {
        if (!$gameTemp || !$gameTemp._cmdWindows) return;
        const st = $gameTemp._cmdWindows;
        const win = st[String(key)];
        if (!win) return;
        if (win.parent) win.parent.removeChild(win);
        delete st[String(key)];
    };
    function applyCenterW_(win) {
        const w = Graphics.boxWidth || Graphics.width;
        const h = Graphics.boxHeight || Graphics.height;
        if (win._cmdCenterX) win.x = ((w - win.width) * 0.5) | 0;
        if (win._cmdCenterY) win.y = ((h - win.height) * 0.5) | 0;
    };
})();
