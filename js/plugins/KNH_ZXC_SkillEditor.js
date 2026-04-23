//=============================================================================
// KNH_ZXC_SkillEditor.js
//=============================================================================

/*:
 * @plugindesc [MV][Playtest] Skill memo live editor (skillEditMode) v0.1.0
 * @author kagaya
 *
 * @help
 * _debug.get('startMode') === 'skillEditMode' のとき、Scene_Map開始時に
 * スキル編集シミュレーション画面を起動します。
 * - 1体のアクターと1体の敵を表示
 * - Actor / Enemy / Skill を下部UIで選択
 * - 40fごとにスキル再生
 * - メモ欄はキー入力ごとに反映
 * - 読み取り失敗時は最後に成功したメモ内容で再生
 * - Copyでメモ欄をクリップボードにコピー
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_SkillEditor = window.KNH_ZXC_SkillEditor || {};
    var CAST_INTERVAL = 40;
    var SAVE_INTERVAL = 60;
    var SAVE_KEY = 'KNH_ZXC_SkillEditor:lastState';
    var ACTION_ARG_HINTS = {
        apply: '引数なし。現在のスキル効果を適用します。',
        setAnime: "タイプ('wait','attack1'など), ループ(true/false), 間隔(フレーム), 継続時間(フレーム)",
        setRandomAttackAnime: "攻撃モーション開始番号, 攻撃モーション終了番号, ループ(true/false), 間隔(フレーム), 継続時間(フレーム)",
        setEasing: "イージング名(例: 'easeInOutCubic')",
        mirror: '引数なし。表示を左右反転します。',
        noMirror: '引数なし。表示の左右反転を解除します。',
        move: "X移動量, Y移動量(数値 or 'fitX'), 移動時間(フレーム), オプション('wait')",
        moveToTarget: "ターゲット基準X移動量, ターゲット基準Y移動量(数値 or 'fitX'), 移動時間(フレーム), オプション('wait')",
        moveRandom: "移動時間(フレーム), オプション('wait')",
        back: "移動時間(フレーム), オプション('wait')",
        backJump: "移動時間(フレーム), ジャンプ高さ, オプション('wait')",
        jump: "X移動量, Y移動量(数値 or 'fitX'), 移動時間(フレーム), ジャンプ高さ, オプション('wait')",
        jumpToTarget: "ターゲット基準X移動量, ターゲット基準Y移動量(数値 or 'fitX'), 移動時間(フレーム), ジャンプ高さ, オプション('wait')",
        rotate: "回転角度(度), 回転時間(フレーム), オプション('wait')",
        bullet: "弾画像名, 発射X補正, 発射Y補正, 着弾X補正, 着弾Y補正, 移動種別('straight'/'parabola'), param1(速度), param2(直線:回転速度/放物線:山の高さ), param3(放物線時の回転速度), オプション('wait'/'apply')",
        bulletRiv: "弾画像名, 発射X補正, 発射Y補正, 着弾X補正, 着弾Y補正, 移動種別('straight'/'parabola'), param1(速度), param2(直線:回転速度/放物線:山の高さ), param3(放物線時の回転速度), オプション('wait')",
        playSe: 'SE名, 音量(省略時80), ピッチ(省略時100)',
        startAnimation: 'アニメーションID, X補正, Y補正',
        startAnimationTarget: 'アニメーションID, X補正, Y補正（ターゲット基準）',
        particleParam: 'パーティクル用パラメータ列（そのまま _particle._params に渡されます）',
        wait: '待機時間(フレーム)',
        waitRelease: '引数なし。ボタンを離すまで待機します。'
    };
    if (typeof Scene_NewBattle !== 'function') {
        console.error('[KNH_ZXC_SkillEditor] Scene_NewBattle not found');
        return;
    }

    function isPlaytest() {
        try { return !!($gameTemp && $gameTemp.isPlaytest && $gameTemp.isPlaytest()); }
        catch (_) { return false; }
    }

    function isSkillEditEnabled() {
        try { return !!(window._debug && _debug.get && _debug.get('startMode') === 'skillEditMode'); }
        catch (_) { return false; }
    }

    function clone(v) {
        return JSON.parse(JSON.stringify(v));
    }

    function isTypingTargetElement(el) {
        if (!el) return false;
        if (el.isContentEditable) return true;
        var tag = el.tagName ? String(el.tagName).toUpperCase() : '';
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function installInputPreventDefaultGuardForTextEditing() {
        try {
            if (typeof Input === 'undefined' || !Input || typeof Input._shouldPreventDefault !== 'function') return;
            if (Input._seTextEditGuardInstalled) return;
            Input._seTextEditGuardInstalled = true;
            var _baseShouldPreventDefault = Input._shouldPreventDefault;
            Input._shouldPreventDefault = function(keyCode) {
                var ae = null;
                try { ae = (typeof document !== 'undefined' && document) ? document.activeElement : null; } catch (_) { ae = null; }
                if (isTypingTargetElement(ae)) return false;
                return _baseShouldPreventDefault.call(this, keyCode);
            };
        } catch (_) {}
    }

    function extractMetadataSafe(obj) {
        if (!obj) return;
        if (obj.note == null) obj.note = '';
        obj.note = String(obj.note);
        if (DataManager && typeof DataManager.extractMetadata === 'function') {
            DataManager.extractMetadata(obj);
        } else if (!obj.meta || typeof obj.meta !== 'object') {
            obj.meta = {};
        }
    }

    function firstValidDataId(arr, startId) {
        startId = Math.max(1, Math.floor(Number(startId || 1)));
        if (!Array.isArray(arr)) return 1;
        for (var i = startId; i < arr.length; i++) {
            if (arr[i]) return i;
        }
        for (var j = 1; j < arr.length; j++) {
            if (arr[j]) return j;
        }
        return 1;
    }

    function hasRenderableBattlerData(data, isEnemy) {
        if (!data) return false;
        var bname = String(data.battlerName || '').trim();
        if (bname) return true;
        if (isEnemy && data.meta && String(data.meta.live2d || '').trim()) return true;
        return false;
    }

    function firstRenderableBattlerId(arr, startId, isEnemy) {
        startId = Math.max(1, Math.floor(Number(startId || 1)));
        if (!Array.isArray(arr)) return 1;
        for (var i = startId; i < arr.length; i++) {
            if (hasRenderableBattlerData(arr[i], !!isEnemy)) return i;
        }
        for (var j = 1; j < arr.length; j++) {
            if (hasRenderableBattlerData(arr[j], !!isEnemy)) return j;
        }
        return firstValidDataId(arr, startId);
    }

    function skillSnapshot(skill) {
        return {
            note: String((skill && skill.note) || ''),
            meta: clone((skill && skill.meta) || {})
        };
    }

    function restoreSkillSnapshot(skill, snap) {
        if (!skill || !snap) return;
        skill.note = String(snap.note || '');
        skill.meta = clone(snap.meta || {});
    }

    function isSkillEditorSceneActive() {
        try {
            return !!(SceneManager && SceneManager._scene && SceneManager._scene.constructor === Scene_SkillEditor);
        } catch (_) {
            return false;
        }
    }

    function installLoadingErrorSuppressor() {
        if (NS._seLoadingErrorSuppressorInstalled) return;
        NS._seLoadingErrorSuppressorInstalled = true;

        if (Graphics && typeof Graphics.printLoadingError === 'function' && !NS._seBasePrintLoadingError) {
            NS._seBasePrintLoadingError = Graphics.printLoadingError;
            Graphics.printLoadingError = function(url) {
                if (isSkillEditorSceneActive()) {
                    console.warn('[SkillEditor] ignored loading error:', url);
                    return;
                }
                return NS._seBasePrintLoadingError.apply(this, arguments);
            };
        }

        if (SceneManager && typeof SceneManager.stop === 'function' && !NS._seBaseSceneStop) {
            NS._seBaseSceneStop = SceneManager.stop;
            SceneManager.stop = function() {
                if (isSkillEditorSceneActive()) {
                    return;
                }
                return NS._seBaseSceneStop.apply(this, arguments);
            };
        }
    }

    function uninstallLoadingErrorSuppressor() {
        if (!NS._seLoadingErrorSuppressorInstalled) return;
        NS._seLoadingErrorSuppressorInstalled = false;

        if (Graphics && NS._seBasePrintLoadingError) {
            Graphics.printLoadingError = NS._seBasePrintLoadingError;
            NS._seBasePrintLoadingError = null;
        }
        if (SceneManager && NS._seBaseSceneStop) {
            SceneManager.stop = NS._seBaseSceneStop;
            NS._seBaseSceneStop = null;
        }
    }

    function clearSuppressedLoadingErrors() {
        try {
            if (!ResourceHandler || !ResourceHandler._reloaders) return;
            if (ResourceHandler._reloaders.length > 0) {
                ResourceHandler._reloaders.length = 0;
                if (Graphics && typeof Graphics.eraseLoadingError === 'function') Graphics.eraseLoadingError();
                if (SceneManager && typeof SceneManager.resume === 'function') SceneManager.resume();
            }
        } catch (_) {}
    }

    function Scene_SkillEditor() {
        this.initialize.apply(this, arguments);
    }

    window.Scene_SkillEditor = Scene_SkillEditor;

    Scene_SkillEditor.prototype = Object.create(Scene_NewBattle.prototype);
    Scene_SkillEditor.prototype.constructor = Scene_SkillEditor;

    Scene_SkillEditor.prototype.initialize = function() {
        Scene_NewBattle.prototype.initialize.call(this);
        installInputPreventDefaultGuardForTextEditing();

        this._root = null;
        this._statusEl = null;
        this._casterTypeSelect = null;
        this._actorCastCheckbox = null;
        this._enemyCastCheckbox = null;
        this._actorSelect = null;
        this._enemySelect = null;
        this._skillSelect = null;
        this._noteArea = null;
        this._noteHintEl = null;

        this._casterType = 'actor';
        this._actorId = firstRenderableBattlerId($dataActors, 2, false);
        this._enemyId = firstRenderableBattlerId($dataEnemies, 13, true);
        this._skillId = firstValidDataId($dataSkills, 6);

        this._frame = 0;
        this._nextCastAt = 0;
        this._running = false;
        this._waitCastIntervalAfterAction = false;

        this._backSprite = null;
        this._battleContainer = null;
        this._playAnimationSprite = null;
        this._bulletSprites = [];
        this._actorSprites = [];
        this._enemySprites = [];
        this._actorSprite = null;
        this._enemySprite = null;
        this._actorBattler = null;
        this._enemyBattler = null;
        this._turnActorIndex = 0;
        this._targetIndex = 0;
        this._inFinish = false;
        this._buttonSprites = [];
        this._combo = 0;

        this._noteDraftBySkillId = Object.create(null);
        this._lastGoodBySkillId = Object.create(null);
        this._stateSaveDirty = false;
        this._nextStateSaveAt = 0;

        this.loadSavedEditorState();
    };

    Scene_SkillEditor.prototype.create = function() {
        Scene_NewBattle.prototype.create.call(this);
    };

    Scene_SkillEditor.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        installLoadingErrorSuppressor();
        try {
            if (AudioManager && typeof AudioManager.stopBgm === 'function') AudioManager.stopBgm();
        } catch (_) {}
        this.startFadeIn(this.fadeSpeed(), false);
        this.createEditorDom();
        this.refreshEditorOptions();
        this.rebuildBattlers();
        this.applySkillDraftForCurrentSelection(false);
        this.startSimulation();
    };

    Scene_SkillEditor.prototype.update = function() {
        var active = this.isActive();
        $gameTimer.update(active);
        $gameScreen.update();
        Scene_Base.prototype.update.call(this);

        if (this._battleContainer && this._battleContainer.children && this._battleContainer.children.length) {
            this._battleContainer.children.sort(Tilemap.prototype._compareChildOrder.bind(this));
        }
        clearSuppressedLoadingErrors();
        this.flushSavedEditorState();
        this.updateBullets();
        this.updateSimulation();
        this._frame++;
    };

    Scene_SkillEditor.prototype.terminate = function() {
        this.saveEditorState(true);
        this.destroyEditorDom();
        this.stopSimulation();
        uninstallLoadingErrorSuppressor();
        Scene_Base.prototype.terminate.call(this);
    };

    Scene_SkillEditor.prototype.createDisplayObjects = function() {
        var bs = this._backSprite = new Sprite();
        bs.anchor.x = 0.5;
        bs.anchor.y = 0.5;
        bs.x = Graphics.boxWidth / 2;
        bs.y = Graphics.boxHeight / 2;
        this.addChild(bs);
        this.refreshBattleback();

        this._battleContainer = new Sprite();
        this.addChild(this._battleContainer);

        var pas = this._playAnimationSprite = new Sprite_Base();
        pas.move(0, 0, Graphics.boxWidth, Graphics.boxHeight);
        pas.z = 4;
        this._battleContainer.addChild(pas);

        // KNH_ZXC_Setting.js の Sprite_Particle は Scene._spriteset に addChild するため、
        // SkillEditor でも Scene_NewBattle と同じ受け皿を用意しておく。
        this._spriteset = new Spriteset_Base();
        this.addChild(this._spriteset);
        if (this._spriteset._baseSprite) this._spriteset._baseSprite.visible = false;
    };

    Scene_SkillEditor.prototype.refreshBattleback = function() {
        if (!this._backSprite) return;
        var name = 'back';
        var enemy = $dataEnemies && $dataEnemies[this._enemyId];
        if (enemy && enemy.meta && enemy.meta.back) name = String(enemy.meta.back || 'back');
        this._backSprite.bitmap = ImageManager.loadBattleback1(name);
    };

    Scene_SkillEditor.prototype.rebuildBattlers = function() {
        if (!this._battleContainer) return;

        // Auto-fallback to renderable battlers so both sides are always visible by default.
        var actorData = $dataActors && $dataActors[this._actorId];
        if (!hasRenderableBattlerData(actorData, false)) {
            this._actorId = firstRenderableBattlerId($dataActors, this._actorId + 1, false);
            if (this._actorSelect) this._actorSelect.value = String(this._actorId);
        }
        var enemyData = $dataEnemies && $dataEnemies[this._enemyId];
        if (!hasRenderableBattlerData(enemyData, true)) {
            this._enemyId = firstRenderableBattlerId($dataEnemies, this._enemyId + 1, true);
            if (this._enemySelect) this._enemySelect.value = String(this._enemyId);
        }

        this.refreshBattleback();

        if (this._actorSprite && this._actorSprite.parent) this._actorSprite.parent.removeChild(this._actorSprite);
        if (this._enemySprite && this._enemySprite.parent) this._enemySprite.parent.removeChild(this._enemySprite);

        this._actorBattler = new Game_Actor(this._actorId);
        this._enemyBattler = new Game_Enemy(this._enemyId, 0, 0);
        if (this._actorBattler.recoverAll) this._actorBattler.recoverAll();
        if (this._enemyBattler.recoverAll) this._enemyBattler.recoverAll();

        if (typeof Sprite_NewActor === 'function') this._actorSprite = new Sprite_NewActor(this._actorBattler);
        else this._actorSprite = new Sprite_Actor(this._actorBattler);
        if (typeof Sprite_NewEnemy === 'function') this._enemySprite = new Sprite_NewEnemy(this._enemyBattler);
        else this._enemySprite = new Sprite_Enemy(this._enemyBattler);

        this._actorSprite._homeX = Math.floor(Graphics.boxWidth * 0.27);
        this._actorSprite._homeY = Math.floor(Graphics.boxHeight * 0.56);
        this._enemySprite._homeX = Math.floor(Graphics.boxWidth * 0.73);
        this._enemySprite._homeY = Math.floor(Graphics.boxHeight * 0.52);
        this._actorSprite.z = 3;
        this._enemySprite.z = 3;

        if (typeof this._actorSprite.forward === 'function') this._actorSprite.forward();

        this._battleContainer.addChild(this._actorSprite);
        this._battleContainer.addChild(this._enemySprite);
        this._actorSprites = [this._actorSprite];
        this._enemySprites = [this._enemySprite];
        this._turnActorIndex = 0;
        this._targetIndex = 0;

        this._waitCastIntervalAfterAction = false;
        this._nextCastAt = this._frame + 1;
    };

    Scene_SkillEditor.prototype.turnActorSprite = function() {
        return this._actorSprites[this._turnActorIndex] || this._actorSprite || null;
    };

    Scene_SkillEditor.prototype.targetEnemySprite = function() {
        return this._enemySprites[this._targetIndex] || this._enemySprite || null;
    };

    Scene_SkillEditor.prototype.isBattleActive = function() {
        return true;
    };

    Scene_SkillEditor.prototype.playAnimation = function(animation, x, y, mirror) {
        return Scene_NewBattle.prototype.playAnimation.apply(this, arguments);
    };

    Scene_SkillEditor.prototype.playDamageAnimation = function(ssp, tsp, skillId, judgment) {
        Scene_NewBattle.prototype.playDamageAnimation.apply(this, arguments);
    };

    Scene_SkillEditor.prototype.showTextPop = function() {
    };

    Scene_SkillEditor.prototype.applyDamage = function(subject, target, skillId) {
        if (!subject || !target) return;
        try {
            if (subject.clearActions) subject.clearActions();
            var action = new Game_Action(subject, true);
            action.setSkill(skillId);
            action.apply(target);
            if (target.startDamagePopup) target.startDamagePopup();
        } catch (_) {}
    };

    Scene_SkillEditor.prototype.actorGainHp = function(actor, value) {
        if (!actor || actor.isDead && actor.isDead()) return;
        var v = Math.max(0, Math.floor(Number(value || 0)));
        if (v <= 0) return;
        actor.clearResult();
        actor.gainHp(v);
        actor.startDamagePopup();
        actor.performRecovery();
    };

    Scene_SkillEditor.prototype.newBullet = function(image, x, y, tx, ty, moveType, param1, param2, param3) {
        return Scene_NewBattle.prototype.newBullet.apply(this, arguments);
    };

    Scene_SkillEditor.prototype.getBulletWait = function(image, x, y, tx, ty, moveType, param1, param2, param3) {
        var v = Scene_NewBattle.prototype.getBulletWait.apply(this, arguments);
        return Math.max(1, Math.floor(Number(v || 0)));
    };

    Scene_SkillEditor.prototype.updateBullets = function() {
        Scene_NewBattle.prototype.updateBullets.apply(this, arguments);
    };

    Scene_SkillEditor.prototype.currentSkill = function() {
        var id = Math.max(1, Math.floor(Number(this._skillId || 0)));
        return ($dataSkills && $dataSkills[id]) ? $dataSkills[id] : null;
    };

    Scene_SkillEditor.prototype.currentCasterSprite = function() {
        return this._casterType === 'enemy' ? this.targetEnemySprite() : this.turnActorSprite();
    };

    Scene_SkillEditor.prototype.currentTargetSprite = function() {
        return this._casterType === 'enemy' ? this.turnActorSprite() : this.targetEnemySprite();
    };

    Scene_SkillEditor.prototype.savedEditorState = function() {
        return {
            casterType: this._casterType === 'enemy' ? 'enemy' : 'actor',
            targetType: this._casterType === 'enemy' ? 'enemy' : 'actor',
            actorId: Math.max(1, Math.floor(Number(this._actorId || 1))),
            enemyId: Math.max(1, Math.floor(Number(this._enemyId || 1))),
            targetIndex: Math.max(0, Math.floor(Number(this._targetIndex || 0))),
            skillId: Math.max(1, Math.floor(Number(this._skillId || 1)))
        };
    };

    Scene_SkillEditor.prototype.loadSavedEditorState = function() {
        try {
            if (typeof localStorage === 'undefined' || !localStorage) return;
            var raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            var data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return;

            var type = String(data.casterType || data.targetType || 'actor');
            this._casterType = (type === 'enemy') ? 'enemy' : 'actor';

            this._actorId = firstValidDataId($dataActors, Number(data.actorId || this._actorId || 1));
            this._enemyId = firstValidDataId($dataEnemies, Number(data.enemyId || this._enemyId || 1));
            this._skillId = firstValidDataId($dataSkills, Number(data.skillId || this._skillId || 1));
            this._targetIndex = Math.max(0, Math.floor(Number(data.targetIndex || 0)));
        } catch (_) {}
    };

    Scene_SkillEditor.prototype.saveEditorState = function(force) {
        try {
            if (typeof localStorage === 'undefined' || !localStorage) return false;
            var frame = Math.max(0, Math.floor(Number(this._frame || 0)));
            if (!force && frame < this._nextStateSaveAt) return false;
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.savedEditorState()));
            this._stateSaveDirty = false;
            this._nextStateSaveAt = frame + SAVE_INTERVAL;
            return true;
        } catch (_) {
            return false;
        }
    };

    Scene_SkillEditor.prototype.markEditorStateDirty = function() {
        this._stateSaveDirty = true;
        this.saveEditorState(false);
    };

    Scene_SkillEditor.prototype.flushSavedEditorState = function() {
        if (!this._stateSaveDirty) return;
        this.saveEditorState(false);
    };

    Scene_SkillEditor.prototype.ensureLastGoodSnapshot = function(skillId) {
        skillId = Math.max(1, Math.floor(Number(skillId || 0)));
        if (this._lastGoodBySkillId[skillId]) return;
        var skill = $dataSkills && $dataSkills[skillId];
        if (!skill) return;
        this._lastGoodBySkillId[skillId] = skillSnapshot(skill);
    };

    Scene_SkillEditor.prototype.restoreLastGoodSnapshot = function(skillId) {
        skillId = Math.max(1, Math.floor(Number(skillId || 0)));
        var sk = $dataSkills && $dataSkills[skillId];
        var snap = this._lastGoodBySkillId[skillId];
        if (!sk || !snap) return false;
        restoreSkillSnapshot(sk, snap);
        return true;
    };

    Scene_SkillEditor.prototype.validateSkillPlayback = function(skillId) {
        var caster = this.currentCasterSprite();
        if (!caster || typeof caster.getActionWaits !== 'function') return true;
        try {
            caster.getActionWaits(skillId);
            return true;
        } catch (e) {
            console.error('[SkillEditor] skill parse failed', e);
            return false;
        }
    };

    Scene_SkillEditor.prototype.applySkillDraftForCurrentSelection = function(showStatus) {
        var skill = this.currentSkill();
        if (!skill) return false;
        var skillId = Math.max(1, Math.floor(Number(this._skillId || 0)));
        this.ensureLastGoodSnapshot(skillId);
        var txt = this._noteArea ? String(this._noteArea.value || '') : String(skill.note || '');
        this._noteDraftBySkillId[skillId] = txt;

        var backup = skillSnapshot(skill);
        skill.note = txt;
        extractMetadataSafe(skill);
        if (this.validateSkillPlayback(skillId)) {
            this._lastGoodBySkillId[skillId] = skillSnapshot(skill);
            if (showStatus) this.setStatus('メモを反映しました');
            this._nextCastAt = this._frame + 1;
            return true;
        }
        restoreSkillSnapshot(skill, this._lastGoodBySkillId[skillId] || backup);
        if (showStatus) this.setStatus('読み取り失敗: 最後に成功した内容で再生中');
        return false;
    };

    Scene_SkillEditor.prototype.startSimulation = function() {
        this._running = true;
        this._waitCastIntervalAfterAction = false;
        this._nextCastAt = this._frame + 1;
    };

    Scene_SkillEditor.prototype.stopSimulation = function() {
        this._running = false;
        this._waitCastIntervalAfterAction = false;
    };

    Scene_SkillEditor.prototype.clearPlaybackObjects = function() {
        if (this._bulletSprites && this._bulletSprites.length > 0) {
            this._bulletSprites.forEach(function(sp) {
                if (sp && sp.parent) sp.parent.removeChild(sp);
            });
            this._bulletSprites.length = 0;
        }

        if (this._playAnimationSprite && this._playAnimationSprite._animationSprites) {
            var list = this._playAnimationSprite._animationSprites.slice();
            list.forEach(function(sp) {
                if (sp && sp.parent) sp.parent.removeChild(sp);
            });
            this._playAnimationSprite._animationSprites.length = 0;
        }

        [this._actorSprite, this._enemySprite].forEach(function(sp) {
            if (!sp) return;
            if (sp._actions) sp._actions.length = 0;
            if (sp._reservedDamaged) sp._reservedDamaged.length = 0;
            if (sp._guards) sp._guards.length = 0;
            if (sp._damages && sp._damages.length > 0) {
                while (sp._damages.length > 0) {
                    var d = sp._damages.shift();
                    if (d && d.parent) d.parent.removeChild(d);
                }
            }
        });
    };

    Scene_SkillEditor.prototype.restartSimulationFromBeginning = function() {
        this.stopSimulation();
        this.clearPlaybackObjects();
        this.rebuildBattlers();
        this.startSimulation();
    };

    Scene_SkillEditor.prototype.prepareEnemyApplyPlaceholders = function(skillId, timing) {
        // Scene_NewBattle の enemy actionApply は _buttonSprites の _info を参照して
        // actor 側に reserveDamaged するため、SkillEditor では最低限の情報を疑似生成する。
        var list = [];
        var guards = [];
        var maxApply = 32;
        var t = Math.max(0, Math.floor(Number(timing || 0)));
        for (var i = 0; i < maxApply; i++) {
            var info = {
                enemy: this._enemyBattler,
                skillId: skillId,
                timing: t,
                applyIndex: i
            };
            list.push({
                _info: info
            });
            // SkillEditor では入力判定がないため、常に「被弾(2)」として処理を進める。
            guards.push({ result: 2, info: info });
        }
        this._buttonSprites = list;
        var actorSprite = this.turnActorSprite();
        if (actorSprite) actorSprite._guards = guards;
    };

    Scene_SkillEditor.prototype.recoverBattlers = function() {
        if (this._actorBattler && this._actorBattler.recoverAll) this._actorBattler.recoverAll();
        if (this._enemyBattler && this._enemyBattler.recoverAll) this._enemyBattler.recoverAll();
        if (this._actorBattler && this._actorBattler.clearResult) this._actorBattler.clearResult();
        if (this._enemyBattler && this._enemyBattler.clearResult) this._enemyBattler.clearResult();
    };

    Scene_SkillEditor.prototype.isSpritePlaybackBusy = function(sp) {
        if (!sp) return false;
        if (sp._actions && sp._actions.length > 0) return true;
        if (sp._reservedDamaged && sp._reservedDamaged.length > 0) return true;
        if (sp._movementDuration > 0) return true;
        if (sp._rotateDuration > 0) return true;
        if ((sp._jumpHeight || 0) > 0) return true;
        if (Math.abs(Number(sp._jumpOffsetY || 0)) > 0.01) return true;
        if (Number(sp._animationType || 0) > 0) return true;
        if (sp._damages && sp._damages.length > 0) return true;
        if (typeof sp.isAnimationPlaying === 'function' && sp.isAnimationPlaying()) return true;
        return false;
    };

    Scene_SkillEditor.prototype.isSkillPlaybackBusy = function() {
        if (this._bulletSprites && this._bulletSprites.length > 0) return true;
        if (this._playAnimationSprite &&
            typeof this._playAnimationSprite.isAnimationPlaying === 'function' &&
            this._playAnimationSprite.isAnimationPlaying()) return true;
        if (this.isSpritePlaybackBusy(this._actorSprite)) return true;
        if (this.isSpritePlaybackBusy(this._enemySprite)) return true;
        if (this._actorBattler && this._actorBattler.isDamagePopupRequested && this._actorBattler.isDamagePopupRequested()) return true;
        if (this._enemyBattler && this._enemyBattler.isDamagePopupRequested && this._enemyBattler.isDamagePopupRequested()) return true;
        return false;
    };

    Scene_SkillEditor.prototype.updateSimulation = function() {
        if (!this._running) return;
        var skill = this.currentSkill();
        var caster = this.currentCasterSprite();
        if (!skill || !caster) return;
        if (this._waitCastIntervalAfterAction) {
            if (this.isSkillPlaybackBusy()) return;
            this._waitCastIntervalAfterAction = false;
            this._nextCastAt = this._frame + CAST_INTERVAL;
            return;
        }
        if (this._frame < this._nextCastAt) return;

        var skillId = Math.max(1, Math.floor(Number(this._skillId || 0)));
        this.ensureLastGoodSnapshot(skillId);
        if (!this.applySkillDraftForCurrentSelection(false)) {
            this.restoreLastGoodSnapshot(skillId);
        }

        this.recoverBattlers();
        try {
            if (typeof caster.startAction === 'function') {
                if (this._casterType === 'enemy') {
                    this.prepareEnemyApplyPlaceholders(skillId, 0);
                    caster.startAction(skillId, {
                        enemy: this._enemyBattler,
                        skillId: skillId,
                        timing: 0,
                        applyIndex: 0
                    }, 2);
                } else {
                    caster.startAction(skillId, null, 2);
                }
                this._waitCastIntervalAfterAction = true;
            } else {
                this.fallbackCast(skillId);
                this._waitCastIntervalAfterAction = true;
            }
        } catch (e) {
            console.error('[SkillEditor] cast failed', e);
            if (this.restoreLastGoodSnapshot(skillId)) {
                try {
                    if (typeof caster.startAction === 'function') {
                        if (this._casterType === 'enemy') {
                            this.prepareEnemyApplyPlaceholders(skillId, 0);
                            caster.startAction(skillId, { enemy: this._enemyBattler, skillId: skillId, timing: 0, applyIndex: 0 }, 2);
                        } else {
                            caster.startAction(skillId, null, 2);
                        }
                        this._waitCastIntervalAfterAction = true;
                    } else {
                        this.fallbackCast(skillId);
                        this._waitCastIntervalAfterAction = true;
                    }
                    this.setStatus('読み取り失敗: 最後に成功した内容で再生中');
                } catch (_) {
                    this.setStatus('再生エラー');
                }
            } else {
                this.setStatus('再生エラー');
            }
        }
    };

    Scene_SkillEditor.prototype.fallbackCast = function(skillId) {
        var skill = $dataSkills && $dataSkills[skillId];
        var ssp = this.currentCasterSprite();
        var tsp = this.currentTargetSprite();
        if (!skill || !ssp || !tsp) return;
        this.playDamageAnimation(ssp, tsp, skillId, 0);
        this.applyDamage(this._casterType === 'enemy' ? this._enemyBattler : this._actorBattler,
            this._casterType === 'enemy' ? this._actorBattler : this._enemyBattler,
            skillId);
        var aid = Math.max(0, Math.floor(Number(skill.animationId || 0)));
        if (aid && $dataAnimations && $dataAnimations[aid] && tsp._battler && tsp._battler.startAnimation) {
            tsp._battler.startAnimation(aid, false, 0);
        }
    };

    Scene_SkillEditor.prototype.refreshEditorOptions = function() {
        this.refreshActorOptions();
        this.refreshEnemyOptions();
        this.refreshSkillOptions();
        this.syncCasterCheckboxes();
        if (this._noteArea) {
            var skill = this.currentSkill();
            var id = Math.max(1, Math.floor(Number(this._skillId || 0)));
            this._noteArea.value = (this._noteDraftBySkillId[id] != null) ? String(this._noteDraftBySkillId[id]) : String((skill && skill.note) || '');
        }
        this.updateNoteActionHint();
    };

    Scene_SkillEditor.prototype.refreshActorOptions = function() {
        if (!this._actorSelect) return;
        this._actorSelect.innerHTML = '';
        if (!$dataActors) return;
        for (var i = 1; i < $dataActors.length; i++) {
            var a = $dataActors[i];
            if (!a) continue;
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = i + ': ' + String(a.name || '(no name)');
            this._actorSelect.appendChild(op);
        }
        this._actorSelect.value = String(this._actorId);
    };

    Scene_SkillEditor.prototype.refreshEnemyOptions = function() {
        if (!this._enemySelect) return;
        this._enemySelect.innerHTML = '';
        if (!$dataEnemies) return;
        for (var i = 1; i < $dataEnemies.length; i++) {
            var e = $dataEnemies[i];
            if (!e) continue;
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = i + ': ' + String(e.name || '(no name)');
            this._enemySelect.appendChild(op);
        }
        this._enemySelect.value = String(this._enemyId);
    };

    Scene_SkillEditor.prototype.refreshSkillOptions = function() {
        if (!this._skillSelect) return;
        this._skillSelect.innerHTML = '';
        if (!$dataSkills) return;
        for (var i = 1; i < $dataSkills.length; i++) {
            var s = $dataSkills[i];
            if (!s) continue;
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = i + ': ' + String(s.name || '(no name)');
            this._skillSelect.appendChild(op);
        }
        this._skillSelect.value = String(this._skillId);
    };

    Scene_SkillEditor.prototype.firstSkillIdByNamePrefix = function(prefix) {
        if (!$dataSkills) return 0;
        var p = String(prefix || '').toLowerCase();
        if (!p) return 0;
        for (var i = 1; i < $dataSkills.length; i++) {
            var s = $dataSkills[i];
            if (!s) continue;
            var name = String(s.name || '').toLowerCase();
            if (name.indexOf(p) === 0) return i;
        }
        return 0;
    };

    Scene_SkillEditor.prototype.autoSelectSkillForCurrentCaster = function() {
        var prefix = '';
        var fallbackId = 1;
        if (this._casterType === 'enemy') {
            prefix = 'e' + String(Math.max(1, Math.floor(Number(this._enemyId || 1))));
            fallbackId = 87;
        } else {
            prefix = 'a' + String(Math.max(0, Math.floor(Number(this._actorId || 1)) - 1));
            fallbackId = 6;
        }
        var nextId = this.firstSkillIdByNamePrefix(prefix);
        if (!nextId) nextId = fallbackId;
        nextId = Math.max(1, Math.floor(Number(nextId || 1)));
        this._skillId = nextId;
        if (this._skillSelect) this._skillSelect.value = String(this._skillId);
        if (this._noteArea) {
            var sk = this.currentSkill();
            this._noteArea.value = (this._noteDraftBySkillId[this._skillId] != null)
                ? String(this._noteDraftBySkillId[this._skillId])
                : String((sk && sk.note) || '');
        }
        this.updateNoteActionHint();
        this.applySkillDraftForCurrentSelection(false);
        this.markEditorStateDirty();
    };

    Scene_SkillEditor.prototype.findActionArgHint = function(actionName) {
        var name = String(actionName || '').trim();
        if (!name) return '';
        if (Object.prototype.hasOwnProperty.call(ACTION_ARG_HINTS, name)) return ACTION_ARG_HINTS[name];
        var lower = name.toLowerCase();
        for (var key in ACTION_ARG_HINTS) {
            if (!Object.prototype.hasOwnProperty.call(ACTION_ARG_HINTS, key)) continue;
            if (String(key).toLowerCase() === lower) return ACTION_ARG_HINTS[key];
        }
        return '';
    };

    Scene_SkillEditor.prototype.currentNoteActionName = function() {
        if (!this._noteArea) return '';
        var text = String(this._noteArea.value || '');
        var pos = 0;
        if (typeof this._noteArea.selectionStart === 'number') pos = this._noteArea.selectionStart;
        else pos = text.length;
        pos = Math.max(0, Math.min(pos, text.length));
        var lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1));
        lineStart = (lineStart < 0) ? 0 : lineStart + 1;
        var lineEnd = text.indexOf('\n', pos);
        if (lineEnd < 0) lineEnd = text.length;
        var line = text.slice(lineStart, lineEnd);
        line = line.replace(/\s*\/\/.*$/, '').trim();
        if (!line || line === '>' || line.charAt(0) === '<') return '';
        var colonAt = line.indexOf(':');
        var action = (colonAt >= 0 ? line.slice(0, colonAt) : line).trim();
        if (!action || action.charAt(0) === '#') return '';
        return action;
    };

    Scene_SkillEditor.prototype.updateNoteActionHint = function() {
        if (!this._noteHintEl) return;
        var action = this.currentNoteActionName();
        if (!action) {
            this._noteHintEl.textContent = '引数ヒント: カーソル行に action:arg1,arg2... 形式のコマンドを書くと説明を表示します';
            return;
        }
        var hint = this.findActionArgHint(action);
        if (!hint) {
            this._noteHintEl.textContent = '引数ヒント [' + action + ']: 未対応コマンドです';
            return;
        }
        this._noteHintEl.textContent = '引数ヒント [' + action + ']: ' + hint;
    };

    Scene_SkillEditor.prototype.syncCasterCheckboxes = function() {
        if (this._actorCastCheckbox) this._actorCastCheckbox.checked = (this._casterType === 'actor');
        if (this._enemyCastCheckbox) this._enemyCastCheckbox.checked = (this._casterType === 'enemy');
    };

    Scene_SkillEditor.prototype.setCasterTypeFromCheckbox = function(type) {
        this._casterType = (type === 'enemy') ? 'enemy' : 'actor';
        this.syncCasterCheckboxes();
        this.autoSelectSkillForCurrentCaster();
        this.markEditorStateDirty();
        this.startSimulation();
        this.setStatus('使用者を更新');
    };

    Scene_SkillEditor.prototype.createEditorDom = function() {
        if (typeof document === 'undefined' || !document || this._root) return;

        var root = document.createElement('div');
        root.style.position = 'fixed';
        root.style.left = '0';
        root.style.right = '0';
        root.style.bottom = '0';
        root.style.zIndex = '99999';
        root.style.padding = '8px 10px';
        root.style.background = 'rgba(0,0,0,0.78)';
        root.style.borderTop = '1px solid rgba(255,255,255,0.18)';
        root.style.color = '#fff';
        root.style.font = '12px/1.4 monospace';
        root.style.boxSizing = 'border-box';
        root.style.pointerEvents = 'auto';

        var row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.flexWrap = 'wrap';
        row1.style.alignItems = 'center';
        row1.style.gap = '8px';
        row1.style.marginBottom = '6px';

        function mkLabel(text) {
            var lb = document.createElement('span');
            lb.textContent = text;
            lb.style.opacity = '0.9';
            return lb;
        }

        function mkSelect(minW) {
            var s = document.createElement('select');
            s.style.minWidth = minW;
            s.style.maxWidth = '420px';
            s.style.background = '#101010';
            s.style.color = '#fff';
            s.style.border = '1px solid #666';
            s.style.borderRadius = '4px';
            s.style.padding = '2px 4px';
            return s;
        }

        this._actorSelect = mkSelect('180px');
        this._enemySelect = mkSelect('180px');
        this._skillSelect = mkSelect('240px');

        function mkCasterCheckbox(labelText) {
            var wrap = document.createElement('label');
            wrap.style.display = 'inline-flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '4px';
            wrap.style.cursor = 'pointer';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.style.margin = '0';
            cb.style.verticalAlign = 'middle';
            wrap.appendChild(cb);
            wrap.appendChild(document.createTextNode(labelText));

            return { wrap: wrap, cb: cb };
        }

        var actorCbPack = mkCasterCheckbox('Actor');
        var enemyCbPack = mkCasterCheckbox('Enemy');
        this._actorCastCheckbox = actorCbPack.cb;
        this._enemyCastCheckbox = enemyCbPack.cb;

        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy';
        copyBtn.style.padding = '3px 10px';
        copyBtn.style.borderRadius = '4px';
        copyBtn.style.border = '1px solid #777';
        copyBtn.style.background = '#1f1f1f';
        copyBtn.style.color = '#fff';
        copyBtn.style.cursor = 'pointer';

        row1.appendChild(actorCbPack.wrap);
        row1.appendChild(this._actorSelect);
        row1.appendChild(enemyCbPack.wrap);
        row1.appendChild(this._enemySelect);
        row1.appendChild(mkLabel('Skill'));
        row1.appendChild(this._skillSelect);
        row1.appendChild(copyBtn);

        this._noteArea = document.createElement('textarea');
        this._noteArea.spellcheck = false;
        this._noteArea.wrap = 'off';
        this._noteArea.style.display = 'block';
        this._noteArea.style.width = '100%';
        this._noteArea.style.height = '180px';
        this._noteArea.style.resize = 'vertical';
        this._noteArea.style.background = '#0b0b0b';
        this._noteArea.style.color = '#fff';
        this._noteArea.style.border = '1px solid #555';
        this._noteArea.style.borderRadius = '4px';
        this._noteArea.style.padding = '6px';
        this._noteArea.style.boxSizing = 'border-box';
        this._noteArea.style.font = '12px/1.4 Consolas, monospace';

        this._noteHintEl = document.createElement('div');
        this._noteHintEl.style.marginTop = '6px';
        this._noteHintEl.style.opacity = '0.95';
        this._noteHintEl.style.color = '#c6dcff';
        this._noteHintEl.style.whiteSpace = 'pre-wrap';
        this._noteHintEl.style.font = '10px/1.35 Consolas, monospace';

        this._statusEl = document.createElement('div');
        this._statusEl.style.marginTop = '6px';
        this._statusEl.style.opacity = '0.9';
        this._statusEl.textContent = 'ready';

        root.appendChild(row1);
        root.appendChild(this._noteArea);
        root.appendChild(this._noteHintEl);
        root.appendChild(this._statusEl);
        document.body.appendChild(root);
        this._root = root;
        this.syncCasterCheckboxes();
        this.updateNoteActionHint();

        this._actorCastCheckbox.addEventListener('change', function() {
            if (!this._actorCastCheckbox.checked) {
                this.syncCasterCheckboxes();
                return;
            }
            this.setCasterTypeFromCheckbox('actor');
        }.bind(this));

        this._enemyCastCheckbox.addEventListener('change', function() {
            if (!this._enemyCastCheckbox.checked) {
                this.syncCasterCheckboxes();
                return;
            }
            this.setCasterTypeFromCheckbox('enemy');
        }.bind(this));

        this._actorSelect.addEventListener('change', function() {
            this._actorId = Math.max(1, Math.floor(Number(this._actorSelect.value || 1)));
            this.rebuildBattlers();
            if (this._casterType === 'actor') this.autoSelectSkillForCurrentCaster();
            this.markEditorStateDirty();
            this.startSimulation();
            this.setStatus('Actorを更新');
        }.bind(this));

        this._enemySelect.addEventListener('change', function() {
            this._enemyId = Math.max(1, Math.floor(Number(this._enemySelect.value || 1)));
            this.rebuildBattlers();
            if (this._casterType === 'enemy') this.autoSelectSkillForCurrentCaster();
            this.markEditorStateDirty();
            this.startSimulation();
            this.setStatus('Enemyを更新');
        }.bind(this));

        this._skillSelect.addEventListener('change', function() {
            this._skillId = Math.max(1, Math.floor(Number(this._skillSelect.value || 1)));
            var sk = this.currentSkill();
            var sid = this._skillId;
            this._noteArea.value = (this._noteDraftBySkillId[sid] != null) ? String(this._noteDraftBySkillId[sid]) : String((sk && sk.note) || '');
            this.updateNoteActionHint();
            this.applySkillDraftForCurrentSelection(true);
            this.markEditorStateDirty();
            this.startSimulation();
        }.bind(this));

        this._noteArea.addEventListener('input', function() {
            this.applySkillDraftForCurrentSelection(true);
            this.updateNoteActionHint();
            this.restartSimulationFromBeginning();
        }.bind(this));
        this._noteArea.addEventListener('click', this.updateNoteActionHint.bind(this));
        this._noteArea.addEventListener('keyup', this.updateNoteActionHint.bind(this));
        this._noteArea.addEventListener('select', this.updateNoteActionHint.bind(this));
        this._noteArea.addEventListener('focus', this.updateNoteActionHint.bind(this));

        copyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.copyNoteToClipboard();
        }.bind(this));
    };

    Scene_SkillEditor.prototype.destroyEditorDom = function() {
        if (!this._root) return;
        if (this._root.parentNode) this._root.parentNode.removeChild(this._root);
        this._root = null;
        this._statusEl = null;
        this._casterTypeSelect = null;
        this._actorCastCheckbox = null;
        this._enemyCastCheckbox = null;
        this._actorSelect = null;
        this._enemySelect = null;
        this._skillSelect = null;
        this._noteArea = null;
        this._noteHintEl = null;
    };

    Scene_SkillEditor.prototype.setStatus = function(text) {
        if (!this._statusEl) return;
        this._statusEl.textContent = String(text || '');
    };

    Scene_SkillEditor.prototype.copyNoteToClipboard = function() {
        var text = this._noteArea ? String(this._noteArea.value || '') : '';
        var done = function(ok) {
            this.setStatus(ok ? 'コピーしました' : 'コピー失敗');
        }.bind(this);

        try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function() { done(true); }).catch(function() { done(false); });
                return;
            }
        } catch (_) {}

        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            var ok = false;
            try { ok = !!document.execCommand('copy'); } catch (_) { ok = false; }
            if (ta.parentNode) ta.parentNode.removeChild(ta);
            done(ok);
        } catch (_) {
            done(false);
        }
    };

    NS.enabled = function() {
        return isPlaytest() && isSkillEditEnabled();
    };

    var _Scene_Map_start_SkillEditor = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start_SkillEditor.apply(this, arguments);
        if (!NS.enabled()) return;
        if (SceneManager.isSceneChanging && SceneManager.isSceneChanging()) return;
        SceneManager.push(Scene_SkillEditor);
    };
})();
