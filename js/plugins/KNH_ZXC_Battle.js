//=============================================================================
// KNH_ZXC_Battle.js
//=============================================================================

/*:
 * @plugindesc ZXC戦闘
 * @author kagaya
 *
 * @help
 */

function Scene_NewBattle() {
    this.initialize.apply(this, arguments);
};
function Sprite_NewBattler() {
    this.initialize.apply(this, arguments);
};
function Sprite_NewActor() {
    this.initialize.apply(this, arguments);
};
function Sprite_NewEnemy() {
    this.initialize.apply(this, arguments);
};
function Sprite_Bullet() {
    this.initialize.apply(this, arguments);
};

(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_Battle';

    //-----------------------------------------------------------------------------
    // ★デバッグ
    //-----------------------------------------------------------------------------

    var testAuto = 0;           //自動化
    var testAutoQuality = 10;    //自動化精度 1～10

    var battleSim = 0;          //戦闘を高速化
    var simRate = 5;           //高速化速度

    var testInitDifficulty = 0; //初期レベル

    var skillTest = 0;          //スキル固定
    var enemySkillTest = 0;     //敵のスキル固定

    //-----------------------------------------------------------------------------
    // BGMの現在再生フレームを取得
    //-----------------------------------------------------------------------------

    Game_System.prototype.getCurrentBgmFrame = function() {
        const buffer = AudioManager._bgmBuffer;
        if (buffer && buffer._startTime !== undefined) {
            const now = WebAudio._context.currentTime;
            const elapsed = now - buffer._startTime + (buffer._startOffset || 0);
            return Math.floor(elapsed * 60);
        }
        return 0;
    };

    var _WebAudio_play = WebAudio.prototype.play;
    WebAudio.prototype.play = function(loop, offset) {
        _WebAudio_play.apply(this, arguments);
        if (this._source) {
            // AudioContextのcurrentTimeを記録！
            this._startTime = WebAudio._context.currentTime;
            this._startOffset = offset || 0;
        }
    };

    //イントロの長さ
    Game_System.prototype.getIntroTurn = function () {
        if (SceneManager._scene._bgmName === '00_New_Battle1_New') return 2;
        if (SceneManager._scene._bgmName === '00_New_Battle2') return 2;
        if (SceneManager._scene._bgmName === '00_New_Battle4') return 2;
        if (SceneManager._scene._bgmName === '00_New_Battle5') return 0;
        return 0;
    };
    
    //-----------------------------------------------------------------------------
    // 戦闘
    //-----------------------------------------------------------------------------

    // イベント戦闘処理
    Game_Interpreter.prototype.command301 = function() {
        if (!$gameParty.inBattle()) {
            var troopId;
            if (this._params[0] === 0) {  // Direct designation
                troopId = this._params[1];
            } else if (this._params[0] === 1) {  // Designation with a variable
                troopId = $gameVariables.value(this._params[1]);
            } else {  // Same as Random Encounter
                troopId = $gamePlayer.makeEncounterTroopId();
            }
            if ($dataTroops[troopId]) {
                BattleManager.setup(troopId, this._params[2], this._params[3]);
                BattleManager.setEventCallback(function(n) {
                    this._branch[this._indent] = n;
                }.bind(this));
                $gamePlayer.makeEncounterCount();
                SceneManager.push(battleSim ? Scene_NewBattle_Sim : Scene_NewBattle);
            }
        }
        return true;
    };
    //エンカウント処理
    Scene_Map.prototype.updateEncounter = function() {
        if ($gamePlayer.executeEncounter()) {
            SceneManager.push(battleSim ? Scene_NewBattle_Sim : Scene_NewBattle);
        }
    };
    SceneManager.isNextScene = function(sceneClass) {
        return this._nextScene &&
            (this._nextScene.constructor === sceneClass ||
            (sceneClass === Scene_Battle && this._nextScene.constructor === Scene_NewBattle) ||
            (sceneClass === Scene_Battle && this._nextScene.constructor === Scene_NewBattle_Sim));
    };
    Scene_Map.prototype.needsFadeIn = function() {
        return (SceneManager.isPreviousScene(Scene_NewBattle) || SceneManager.isPreviousScene(Scene_NewBattle_Sim) ||
                SceneManager.isPreviousScene(Scene_Load));
    };
    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if ((SceneManager.isPreviousScene(Scene_NewBattle) || SceneManager.isPreviousScene(Scene_NewBattle_Sim)) &&
            $gameMap.isEventRunning()) return; //イベント戦後はフェードインしない
        if (this.needsFadeIn()) $gameScreen.startFadeIn(24);
    };
    BattleManager.onEncounter = function() {}; //先制や後攻をなくす

    //チュートリアル用エンカウント
    Game_Player.prototype.executeEncounter = function () {
        if (this.x >= 19.5 && this.x <= 21) return false; //画面中央でエンカウントしない
        if (this.y < 3) return false; //画面上端でエンカウントしない
        if (!$gameMap.isEventRunning() && this._encounterCount <= 0) {
            this.makeEncounterCount();
            var troopId = this.makeEncounterTroopId();
            if ($dataTroops[troopId]) {
                var tutorial = false;
                if ($gameVariables.value(25) === 1) troopId = 3, $gameVariables.setValue(25, 2), tutorial = true;
                else if ($gameVariables.value(25) === 2) troopId = 4, $gameVariables.setValue(25, -1), tutorial = true;
                else if ($gameVariables.value(25) === 3) troopId = 5, $gameVariables.setValue(25, -1), tutorial = true;
                BattleManager._tutorial = tutorial;
                BattleManager.setup(troopId, true, false);
                BattleManager.onEncounter();
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    };
    
    //エンカウントエフェクト
    Scene_Map.prototype.launchBattle = function () {
        BattleManager.saveBgmAndBgs();
        if (!$gameSwitches.value(5)) {
            this.stopAudioOnBattleStart();
            SoundManager.playBattleStart();
        }
        this.startEncounterEffect();
        this._mapNameWindow.hide();
    };
    Scene_Map.prototype.startEncounterEffect = function() {
        this._encounterEffectDuration = this.encounterEffectSpeed();
    };
    Scene_Map.prototype.updateEncounterEffect = function() {
        if (this._encounterEffectDuration > 0) {
            this._encounterEffectDuration--;
            var speed = this.encounterEffectSpeed();
            if (this._encounterEffectDuration === speed - 1) {
                $gamePlayer.requestBalloon(11);
            } else if (this._encounterEffectDuration === speed - 31) {
                $gamePlayer.requestBalloon(15);
                $gameSystem.playSe('00_dora', 30);
                $gameScreen.startShake(4, 3, 30);
            } else if (this._encounterEffectDuration === speed - 59) {
                $gameTemp._snap = SceneManager.snap();
            } else if (this._encounterEffectDuration === speed - 60) {
                var pos = $gameMap.getPagePosition();
                var dir = [3, 6, 9, 1, 4, 7][[-1, -2, -3, 1, 2, 3].indexOf(pos)];
                $gameTemp._battlePageRight = pos < 0;
                this.startPageTurnEffect(60, dir);
                $gameSystem.playSe('Book2', 90);
            }
        }
    };
    Scene_Map.prototype.encounterEffectSpeed = function() {
        return $gameSwitches.value(18) ? 0 : 120;
    }; 
    
    //エンカウント歩数調整
    Game_Player.prototype.makeEncounterCount = function () {
        var n = $gameMap.encounterStep();
        this._encounterCount = Math.floor(_rand(75, 125) / 100 * n);
    };
    
    //戦闘テスト処理
    const _Scene_Boot_start    = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.apply(this, arguments);
        if ($gameTemp.isPlaytest()) {
            testAuto = _debug.get('testAuto');
            testAutoQuality = _debug.get('testAutoQuality');
            battleSim = _debug.get('battleSim');
            simRate = 8;
            testInitDifficulty = _debug.get('testInitDifficulty');
            skillTest = _debug.get('skillTest');
            enemySkillTest = _debug.get('enemySkillTest');
        }
        if (DataManager.isBattleTest()) SceneManager.goto(battleSim ? Scene_NewBattle_Sim : Scene_NewBattle);
    };
    
    // -----------------------------------------------------------------------------
    // Scene_NewBattle
    // -----------------------------------------------------------------------------
    
    Scene_NewBattle.prototype = Object.create(Scene_Battle.prototype);
    Scene_NewBattle.prototype.constructor = Scene_NewBattle;

    Scene_NewBattle.prototype.initialize = function() {
        Scene_Base.prototype.initialize.call(this);
        this._lastBgmCount = -1;
        this._lastBgmCount2 = 0;
        this._turn = 0;
        this._lastChangeTurn = 0;
        this._turnActorIndex = 0;
        this._difficulty = testInitDifficulty || 2;
        this._difficultyGauge = 20;
        this._results = [];
        this._combo = 0;
        this._totalDamages = [];
        this._numOfSkill = [];
        this._onUseItem = false;
        this._usedItem = false;
        this._seedId = Math.randomInt(100000);
        this._seedAdd = 0;
        this._data = [];
        this._targetIndex = 0;
        this._skip = false;
        this._lastCount = 0;
        this._forceSkip = true;
        this._simMode = false;
        if (DataManager.isBattleTest()) {
            $gameScreen._brightness = 0;
            this.startFadeOut(1);
            ConfigManager.exportCustomParams();
        }
    };

    Scene_NewBattle.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this.createDisplayObjects();
    };

    Scene_NewBattle.prototype.start = function() {
        Scene_Base.prototype.start.call(this);

        this._bgmName = $dataEnemies[$gameTroop.troop().members[0].enemyId].meta.bgm || '00_New_Battle1_New';
        if (!$gameSwitches.value(5)) {
            AudioManager.stopBgm();
            AudioManager.stopBgs();
            AudioManager.playBgm({ name: this._bgmName, volume: 90, pitch: 100, pan: 0 });
        }

        $gameSystem.onBattleStart();
        $gameParty.onBattleStart();
        $gameTroop.onBattleStart();

        $gameMessage._fukidashi = false;

        $gameScreen.startFadeIn(30);
        if (!$gameSwitches.value(18)) _timeOut(function() {
            $gameSystem.setMessagePopupFree(Graphics.boxWidth / 2, Graphics.boxHeight / 2 + 33 * 3);
            BattleManager.displayStartMessages();
            _timeOut(() => {
                var texts = (this.targetEnemySprite()._battler.enemy().meta.startTexts || '').split('\n').filter(t => t);
                if (texts.length > 0) {
                    var text = texts[Math.randomInt(texts.length)];
                    var shiftPos = (this.targetEnemySprite()._battler.enemy().meta.startTextPos || '')
                        .split(',').map(t => Number(t));
                    var x = this.targetEnemySprite().x + (shiftPos[0] || 0);
                    var y = this.targetEnemySprite().y - 160 + (shiftPos[1] || 0);
                    $gameScreen.addSmallMessage(_tl(text), x, y, 120);
                }
            }, 50);
        }.bind(this), 16)
        if (this._simMode) this.setData(true), this.updateTurn(true);
        else _timeOut(function () {
            this.setData(true);
            this.updateTurn(true);
        }.bind(this), 60)
    };
    

    Scene_NewBattle.prototype.needsSlowFadeOut = function() {
        return (SceneManager.isNextScene(Scene_Title) ||
                SceneManager.isNextScene(Scene_Gameover));
    };

    // createDisplayObjects
    Scene_NewBattle.prototype.createDisplayObjects = function() {
        
        //背景
        var bs = this._backSprite = new Sprite();
        if ($dataEnemies[$gameTroop.troop().members[0].enemyId].meta.back) {
            bs.bitmap = ImageManager.loadBattleback1($dataEnemies[$gameTroop.troop().members[0].enemyId].meta.back);
        } else {
            bs.bitmap = ImageManager.loadBattleback1('back');
        }
        bs._yuraInfo = [10, 15];
        bs.anchor.x = bs.anchor.y = 0.5, bs.x = Graphics.boxWidth / 2, bs.y = Graphics.boxHeight / 2;
        this.addChild(bs);
        
        //Container
        var bc = this._battleContainer = new Sprite();
        this.addChild(bc);
        
        //味方
        var ass = this._actorSprites = [];
        var n = $gameParty.members().length;
        for (var i = 0; i < n; i++) {
            var as = ass[i] = new Sprite_NewActor($gameParty.members()[i]);
            as._homeX = Graphics.boxWidth / 6 - i * 24;
            as._homeY = Graphics.boxHeight / 2 + (i - n / 2 + 0.5) * 40;
            if (!i) as.forward();
            bc.addChild(as);
        }
        //敵
        var ess = this._enemySprites = [];
        this._enPosType = Number($dataEnemies[$gameTroop.troop().members[0].enemyId].meta.posType) || 1;
        var n = $gameTroop.members().length;
        for (var i = 0; i < n; i++) {
            var es = ess[i] = new Sprite_NewEnemy($gameTroop.members()[i]);
            if (this._enPosType === 1) {
                es._homeX = Graphics.boxWidth / 3 * 2 + (i - n / 2 + 0.5) * 100 * (1 - 0.3 * n / 5);
                es._homeY = Graphics.boxHeight / 2 + (i % 2 ? -64 : 0);
            } else if (this._enPosType === 2) {
                es._homeX = Graphics.boxWidth / 3 * 2 + (i - n / 2 + 0.5) * 200 * (1 - 0.3 * n / 5);
                es._homeY = Graphics.boxHeight / 2 + (i % 2 ? 0 : -24);
            }
            bc.addChild(es);
        }
        
        //弾
        this._bulletSprites = []; //弾スプライトを管理する配列

        //アイテム
        var its = this._itemSprite = new Sprite_Base();
        its.visible = false, its.anchor = new Point(0.5, 0.5), its.z = 4;
        its._yuraInfo = [], its.scale.x = its.scale.y = 0.6;
        bc.addChild(its);
        
        //アニメーション書き込み用
        var pas = this._playAnimationSprite = new Sprite_Base();
        pas.move(0, 0, Graphics.boxWidth, Graphics.boxHeight);
        pas.z = 4;
        bc.addChild(pas);

        //ターゲット選択用矢印
        var tas = this._targetArrowSprite = new Sprite(ImageManager.loadSystem('UI_battle_targetArrow'));
        tas.visible = false, tas.z = 6, tas._yuraInfo = [];
        tas.anchor = new Point(0.1, 0.9);
        bc.addChild(tas);
        
        //テキストポップ
        var tps = this._textPopSprites = [];
        tps[0] = new Sprite_Base();
        tps[1] = new Sprite_Base();
        tps[0].bitmap = tps[1].bitmap = ImageManager.loadSystem('UI_battle_textPop');
        tps[0].anchor = tps[1].anchor = new Point(0.5, 0.5);
        tps[0]._count = tps[1]._count = 0, tps[0]._maxCount = tps[1]._maxCount = 60;
        tps[0].opacity = tps[1].opacity = 0;
        tps[0].z = tps[1].z = 5;
        tps[0]._yuraInfo = tps[1]._yuraInfo = [];
        tps[0].x = 216, tps[0].y = 84, tps[0]._basePos = [tps[0].x, tps[0].y];
        tps[1].x = 484, tps[1].y = 84, tps[1]._basePos = [tps[1].x, tps[1].y];
        if (!this._simMode) bc.addChild(tps[0]), bc.addChild(tps[1]);

        //レベルアップ用
        var lls = this._levelUpLightSprite = new Sprite(ImageManager.loadSystem('spotlight'));
        lls.x = Graphics.boxWidth / 2, lls.y = levelUpDisplayY, lls.z = 1;
        lls.anchor = new Point(0.5, 1), lls.scale = new Point(2, 2);
        lls._yuraInfo = [];
        lls.visible = false;
        bc.addChild(lls);
        var lts = this._levelUpTextSprite = new Sprite(ImageManager.loadSystem('UI_battle_levelUp'));
        lts.x = Graphics.boxWidth / 2, lts.y = lts._baseY = levelUpDisplayY - 180, lts.z = 5;
        lts.anchor = new Point(0.5, 0.5);
        lts._yuraInfo = [];
        lts.visible = false;
        bc.addChild(lts);

        //トータルダメージ
        var tds = this._totalDamageSprite = new Sprite(ImageManager.loadSystem('UI_battle_total'));
        tds.z = 6;
        tds.anchor = new Point(0.5, 0.5);
        tds._yuraInfo = [];
        tds.visible = false;
        bc.addChild(tds);

        //フィニッシュ
        var fns = this._finishSprite = new Sprite(ImageManager.loadSystem('UI_battle_finish'));
        fns.x = 270, fns.y = 90, fns.z = 6;
        fns.anchor = new Point(0.5, 0.5);
        fns._yuraInfo = [8, 20];
        fns.visible = false;
        bc.addChild(fns);

        //ステータスウィンドウ
        var w = 360, h = 135;
        var sw = this._statusWindow = new Window_Base(32, Graphics.boxHeight - h - 32, w, h);
        sw.openness = 0;
        this.addChild(sw);
        
        //コマンドウィンドウ
        var w = 180, h = sw.fittingHeight(3);
        var cw = this._commandWindow = new Window_Command(Graphics.boxWidth - w - 32, Graphics.boxHeight - h - 32);
        cw.makeCommandList = function() {
            this.addCommand('アイテム', 'item');
            this.addCommand('オプション', 'option');
            this.addCommand('逃げる', 'run');
        }.bind(cw);
        cw.makeCommandList();
        cw.setHandler('item',   this.commandItem.bind(this));
        cw.setHandler('option', this.commandOption.bind(this));
        cw.setHandler('run',    this.commandRun.bind(this));
        cw.setHandler('cancel', this.commandCancel.bind(this));
        cw.width = w, cw.height = cw.windowHeight();
        cw.refresh();
        cw.openness = 0;
        if (!this._simMode) this.addChild(cw);
        //文字表示
        var ct = this._commandText = new Window_Free(Graphics.boxWidth - w - 32, Graphics.boxHeight - h - 32, w, h);
        if (!this._simMode) this.addChild(ct);

        //インフォウィンドウ
        var w = 180, h = sw.fittingHeight(3);
        var iw = this._infoWindow = new Window_Base(sw.x + sw.width, sw.y, w, h);
        iw.openness = 0;
        this.addChild(iw);
        var iwa = iw._animationSprite = new Sprite_Base();
        iw.addChild(iwa);
        
        //バー
        var bar = this._barSprite = new Sprite_Base();
        bar.bitmap = ImageManager.loadSystem('UI_battle_bar_bar');
        bar.x = 48, bar.y = Graphics.boxHeight / 2 + 48;
        bar._yuraInfo = [0, 10, $gameSystem.animationWait()];
        this.addChild(bar);
        //ボタン
        this._buttonSprites = [];
        //判定テキスト
        this._textSprites = [];
        //カーソル
        var cus = this._carCursorSprite = new Sprite_Base();
        cus.bitmap = ImageManager.loadSystem('UI_battle_bar_cursor');
        cus.anchor.x = 0.5, cus.anchor.y = 0.5;
        cus._yuraInfo = [20, 12, $gameSystem.animationWait()];
        bar.addChild(cus);
        //コンボ数テキスト
        var cmt = this._comboText = new Window_Free(0, 0, 140, 140);
        cus.addChild(cmt);

        //スプライトセット（ピクチャ表示用）
        this._spriteset = new Spriteset_Base();
        this.addChild(this._spriteset);
        this._spriteset._baseSprite.visible = false;
        
        //カウントダウン
        var cds = this._countdownSprite = new Sprite(ImageManager.loadSystem('UI_battle_countdown'));
        cds.anchor.x = 0.5, cds.anchor.y = 0.5;
        cds.x = Graphics.boxWidth / 2, cds.y = Graphics.boxHeight / 2;
        cds.setFrame(1200, 0, 240, 240);
        cds._yuraInfo = [40, 16];
        cds.visible = false;
        if (!this._simMode) this.addChild(cds);
        //待機中文字表示
        var w = Graphics.boxWidth, h = 96;
        var st = this._skipText = new Window_Free((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2 - 22, w, h);
        if (!this._simMode) this.addChild(st);

        //ウィンドウレイヤー
        this.createWindowLayer();

        //ポップメッセージ
        var pw = this._popWindow = new Window_Base(0, 0, 200, 200);
        pw.openness = 0;
        if (!this._simMode) this.addWindow(pw);
        
        this.createMessageWindow();
        this.createScrollTextWindow();
        this.createNoteLine();
    };
    
    Scene_NewBattle.prototype.progress = function() {
        return $gameSystem.sceneCount() % this.maxCount();
    };
    
    Scene_NewBattle.prototype.maxCount = function() {
        return $gameSystem.animationWait() * 16 * this.maxCountRate();
    };

    Scene_NewBattle.prototype.maxCountRate = function () {
        var a = 1;
        if (this._bgmName === '00_New_Battle1_New') a = 2;
        else if (this._bgmName === '00_New_Battle5') a = 2;
        return a;
    };

    Scene_NewBattle.prototype.turnActorSprite = function() {
        return this._actorSprites[Math.max(this._turnActorIndex, 0)];
    };
    
    Scene_NewBattle.prototype.targetEnemySprite = function() {
        return this._enemySprites[this._targetIndex];
    };

    //メンバー交代
    Scene_NewBattle.prototype.changeMember = function () {
        var ass = this._actorSprites;
        var lastIndex = this._turnActorIndex;
        for (var i = 0; i < $gameParty.members().length; i++) {
            this._turnActorIndex = (this._turnActorIndex + 1) % $gameParty.members().length;
            if ($gameParty.members()[this._turnActorIndex].isAlive()) break;
        }
        if (lastIndex !== this._turnActorIndex) {
            if (lastIndex >= 0) ass[lastIndex].backward();
            ass[this._turnActorIndex].forward();
        }
    };


    Game_Enemy.prototype.makeActionTimes = function () {
        return this.actionPlusSet().reduce(function (r, p) {
            return (this._seed ? this._seed.random() : Math.random()) < p ? r + 1 : r;
        }.bind(this), 1);
    };
    Game_Enemy.prototype.selectAction = function (actionList, ratingZero) {
        var sum = actionList.reduce(function (r, a) {
            return r + a.rating - ratingZero;
        }, 0);
        if (sum > 0) {
            var value = this._seed ? this._seed.randomInt(sum) : Math.randomInt(sum);
            for (var i = 0; i < actionList.length; i++) {
                var action = actionList[i];
                value -= action.rating - ratingZero;
                if (value < 0) {
                    return action;
                }
            }
        } else {
            return null;
        }
    };

    Scene_NewBattle.prototype.setData = function(init) {
        var bar = this._barSprite, bss = this._buttonSprites;

        var actorIndex = this._turnActorIndex;
        if (!init) for (var i = 0; i < $gameParty.members().length; i++) {
            actorIndex = (actorIndex + 1) % $gameParty.members().length;
            if ($gameParty.members()[actorIndex].isAlive()) break;
        }

        if (init) { //難易度設定
            if (!testInitDifficulty) {
                var lvTot = 0, isBoss = false;
                $gameTroop.members().forEach(enemy => {
                    if (enemy.enemy().meta.boss) isBoss = true;
                    lvTot += Number(enemy.enemy().meta.lv || 1);
                })
                var lvAve = lvTot / $gameTroop.members().length;
                if (isBoss) this._difficulty = 1;
                else this._difficulty = Math.ceil(
                    0.8 + $gameParty.highestLevel() * 0.2 + ($gameParty.highestLevel() - lvAve) * 1.2
                ).clamp(1, 20);
            }
        }

        //    譜面作成
        var data = [], eData = [], aData = [], seed;
        var lv = this._difficulty;
        var numCount = 0;
        //敵の攻撃
        var changeTurns = Infinity;
        this._enemySprites.forEach(es => changeTurns = Math.min(es._changeTurns, changeTurns));
        var realTurn = Math.floor($gameSystem.getCurrentBgmFrame() / this.maxCount()) + 1;
        var isChangeTurn = 
            !$gameSwitches.value(28) && changeTurns !== Infinity && this._turn > 0 && !this._inFinish &&
            (realTurn - $gameSystem.getIntroTurn()) % changeTurns === 0 &&
            this._turn >= this._lastChangeTurn + changeTurns / 2;
        if (this._forceChangeEnemyAttack) isChangeTurn = true, this._forceChangeEnemyAttack = null;
        if (isChangeTurn) {
            this._seedAdd += 100;
            this._lastChangeTurn = this._turn;
        }
        var INDMAX = 60;
        var seedNum = this._seedId + this._seedAdd;
        seed = new _randomSeed(seedNum, 100);
        var n = this._enemySprites.length;
        for (var i = 0; i < n; i++) {
            var es = this._enemySprites[i];
            if (!es._battler.isAlive()) continue;
            es._battler._seed = seed;
            var actionNum = es._battler.makeActionTimes(seed);
            es._turnActions = [];
            for (var j = 0, I = 0; j < actionNum && I < 100; j++, I++) {
                //スキル決定
                es._battler.makeActions(seed);
                var skillId = es._battler._actions[0].item().id;
                if ($gameTemp.isPlaytest() && enemySkillTest) skillId = enemySkillTest;
                var waits = es.getActionWaits(skillId);
                if (this._simMode) waits = waits.map(a => a / this.simRate());

                //indexを決める
                var _i = numCount + seed.rand(4, 15);
                var splitNum = ([32, 16, 8, 4].filter(function(a) {return _i >= a})[0] || 4) * 2;
                var indMax = es._battler.enemy().meta.osamu ? 44 : INDMAX;
                var indMin = 8;
                var indKouho = [];
                var interval = 6; //最小間隔（フレーム）
                for (
                    var _ind = indMin; _ind <= indMax;
                    _ind = Math.floor((_ind + 64 / splitNum) / (64 / splitNum)) * (64 / splitNum)
                ) {
                    var _timing = _ind * this.maxCount() / 64 - waits[waits.length - 1];
                    if (_timing < 0) continue; //譜面に収まる
                    if (eData.some((_data, _ind2) => {
                        return (_timing >= _data.timing && _timing <= _ind2 * this.maxCount() / 64 + interval) ||
                            (_ind * this.maxCount() / 64 >= _data.timing &&
                             _ind * this.maxCount() / 64 <= _ind2 * this.maxCount() / 64 + interval) ||
                            (_data.timing >= _timing && _data.timing <= _ind * this.maxCount() / 64 + interval);
                    })) continue; //他とかぶらない
                    indKouho.push(_ind);
                }
                if (!indKouho.length) { j--; continue };
                if (actionNum >= 3 && indKouho.length > 2) indKouho = [indKouho[0], indKouho[indKouho.length - 1]]; //詰める
                var ind = indKouho[seed.randomInt(indKouho.length)];
                if (es._battler.enemy().meta.driver) ind = 32;

                //データ登録
                var timing = ind / 64 * this.maxCount() - waits[waits.length - 1];
                waits.forEach((wait, wInd) => {
                    var IND = Math.round((timing + wait) / this.maxCount() * 64);
                    var isChild = wInd < waits.length - 1;
                    eData[IND] = { button: 'B', enemy: es._battler, skillId: skillId, timing: timing, applyIndex: wInd };
                    es._turnActions.push({
                        skillId: skillId, timing: timing,
                        turn: this._turn + (init ? 0 : 1), isChild: isChild
                    });
                })
                numCount++;
            }
        }
        //アクター攻撃
        seed = new _randomSeed(this._seedId);
        $gameParty.members().forEach(actor => actor._lastSkillIndex = 0);
        var num = (3 + lv).clamp(1, 40);
        if ($gameSwitches.value(17)) num = 0;
        for (var i = 0, I = 0; i < num && I < 100; i++, I++) {
            //スキル決定
            var isBack = $gameParty.members().length > 1 && i % (2 + $gameParty.members().length) >= 3; //後衛かどうか
            var actor = isBack ?
                $gameParty.members().filter(function (a, i) { return i !== actorIndex }.bind(this))[i % (2 + $gameParty.members().length) - 3] :
                $gameParty.members()[actorIndex];
            var as = this._actorSprites.filter(as => { return as._battler === actor })[0];
            var button = isBack ? 'X' : 'A';
            var skills = actor._skills.filter(function (skId) { return $dataSkills[skId].meta.button === button });
            var skillId = skills[actor._lastSkillIndex] || skills[0];
            actor._lastSkillIndex = (actor._lastSkillIndex + 1) % skills.length;
            if ($gameTemp.isPlaytest() && skillTest) skillId = skillTest;
            var size = Number($dataSkills[skillId].meta.size);
            var long = !!$dataSkills[skillId].meta.long;
            var rush = !!$dataSkills[skillId].meta.rush
            var length = long || rush ? 16 : 1;

            //indexを決める
            var _i = numCount + seed.randomInt(8);
            var splitNum = ([32, 16, 8, 4].filter(function(a) {return _i >= a})[0] || 4) * 2;
            var indMin = [4, 32][i] || 8, indMax = i === 0 ? 16 : INDMAX;
            var indKouho = [];
            for (
                var _ind = indMin; _ind <= indMax;
                _ind = Math.floor((_ind + 64 / splitNum) / (64 / splitNum)) * (64 / splitNum)
            ) {
                if (aData.some(function (_data, _ind2) {
                    return (_ind >= _ind2 && _ind <= _ind2 + _data.length - 1) ||
                        (_ind + length - 1 >= _ind2 && _ind + length - 1 <= _ind2 + _data.length - 1) ||
                        (_ind2 >= _ind && _ind2 <= _ind + length)
                })) continue; //他とかぶらない
                if (_ind > 64 - length) continue; //譜面におさまる
                indKouho.push(_ind);
            }
            if (!indKouho.length) { i--; continue };
            var ind = indKouho[seed.randomInt(indKouho.length)];

            //長さを決める
            if (long || rush) {
                var minLength = Math.max(64 / splitNum, 8);
                var maxLength = Math.min(16, 32);
                aData.forEach((_data, _ind2) => {
                    if (_ind2 > ind) maxLength = Math.min(maxLength, _ind2 - ind);
                })
                length = seed.rand(minLength, maxLength);
                length -= length % (64 / splitNum);
            }

            //データ登録
            aData[ind] = {
                button: button, actor: actor, skillId: skillId, size: size,
                length: length, long: long, rush: rush
            };
            numCount++;
        }
        //ブッキングする部分は敵の攻撃優先
        data = [].concat(eData);
        aData.forEach((a, i) => {
            if (!data[i]) data[i] = a;
        })

        //順にデータに反映させる
        this._data = [];
        for (var i = 0; i < 64; i++) {
            if (this._simMode) this._data[i] = data[i];
            else _timeOut(function (a, i) { this._data[i] = a }.bind(this, data[i], i), Math.floor(i / 64 * 24) - 2);
        }
        this._trueData = data;

        //敵の行動変化メッセージ
        var isChange = false;
        if (isChangeTurn) {
            var info = eData.join(',');
            if (this._lastInfoEData !== info) {
                this._lastInfoEData = info;
                this.popChangeMessage();
                $gameSystem.playSe('01_Alarm', 120, 100)
                isChange = true;
            }
        }
        
        this.refreshData(isChange, true);
    };

    Scene_NewBattle.prototype.refreshData = function (isChange, animation) {
        if (this._simMode) animation = false;
        var bar = this._barSprite, bss = this._buttonSprites;
        var data = this._trueData;

        var _duration = i => Math.floor(i / 64 * 24)
        var _a = (f, d) => animation ? _timeOut(f.bind(this), d) : f.call(this);
        var _sort = this._buttonSprites.sort((a, b) => a._index - b._index);

        //余剰ボタン削除
        var deleteList = bss.filter(function (bs) { //削除条件
            return !data[bs._index] || (bs._info.button === 'B' && (bs._info.enemy.isDead()));
        });
        deleteList.forEach(function (bs) {
            _a(function(bs) {
                //アニメーション
                if (bs.opacity) {
                    var sp = bar.startAnimation($dataAnimations[10], false, 0);
                    sp.x = bar.x + bs.x, sp.y = bar.y + bs.y, sp.z = 4;
                    sp._noUpdatePosition = true;
                }
                //削除
                if (bs._particle) bs._particle.end();
                bss.splice(this._buttonSprites.indexOf(bs), 1);
                bar.removeChild(bs);
            }.bind(this, bs), _duration(this._buttonSprites.indexOf(bs)) - 1)
        }.bind(this))

        //ボタン表示
        data.forEach(function (info, ind) {
            _a(function (info, ind) {
                var bs = bss.filter(function (bs) { return bs._index === ind })[0];
                if (bs) {
                    bs._info = info;
                    if (info.button === 'B' && isChange) bs.opacity = 0;
                    if (bs.opacity) bs.opacity = 255;
                } else {
                    bs = new Sprite_Base();
                    bs.bitmap = ImageManager.loadSystem('UI_battle_bar_buttons');
                    bs.setFrame(0, 0, 0, 0);
                    bs.anchor.x = bs.anchor.y = 0.5;
                    bs._index = ind;
                    bs._info = info;
                    if (info.button === 'B') bs.opacity = 0;
                    bss.push(bs);
                }
                bs.scale.x = bs.scale.y = info.size > 1 ? 1.25 : 1;
                bs._waitCount = 24 - _duration(ind);
                if (info.rush) bs._rushCount = 0;
                if (bs._particle) bs._particle.end(), bs._particle = null;
                bar.addChild(bs);
            }.bind(this, info, ind), _duration(ind))
        })
    };

    //ポップメッセージ表示
    Scene_NewBattle.prototype.popMessage = function (text) {
        text = _tl(text);
        var pw = this._popWindow;
        var tInfo = pw.drawTextKNH(text, 0, 0);
        pw.width = tInfo.w + pw.padding * 3;
        pw.height = tInfo.h + pw.padding * 3;
        pw.refreshYurayura();
        pw.createContents();
        pw.drawTextKNH(text, (pw.contents.width - tInfo.w) / 2, (pw.contents.height - tInfo.h) / 2);
        pw.x = (Graphics.boxWidth - pw.width) / 2, pw.y = 340 - pw.height;
        pw.openness = 0, pw.open();
        _timeOut(() => pw.close(), 80);
    };
    //ポップメッセージ（敵の行動パターン変化）
    Scene_NewBattle.prototype.popChangeMessage = function () {
        this.popMessage('敵の攻撃パターンが変化した！');
    };

    //アニメーション再生
    Scene_NewBattle.prototype.playAnimation = function(animation, x, y, mirror) {
        var sp = this._playAnimationSprite.startAnimation(animation, !!mirror, 0);
        sp.x = x, sp.y = y, sp.z = 4;
        sp._noUpdatePosition = true;
        return sp;
    };

    //ダメージアニメーション再生
    Scene_NewBattle.prototype.playDamageAnimation = function(ssp, tsp, skillId, judgment) {
        var sk = $dataSkills[skillId];
        if (sk && sk.animationId) {
            //固有のアニメーション
            var anim = $dataAnimations[sk.animationId];
            this.playAnimation(
                $dataAnimations[sk.animationId], tsp.x,
                tsp.y - (anim.position === 2 ? 0 : tsp.height / 2 * tsp.scale.y + (tsp._dummy ? 40 : 0)) 
            );
            //星アニメーション
            if (judgment < 2)
                this.playAnimation($dataAnimations[judgment ? 17 : 18], tsp.x, tsp.y - tsp.height / 2 * tsp.scale.y, tsp._battler.isActor());
            //テキストポップ
            this.showTextPop(tsp._battler.isActor() ? 0 : 1, judgment, tsp.x, tsp.y);
        }
    };

    //ダメージ適用
    Scene_NewBattle.prototype.applyDamage = function(subject, target, skillId) {
        subject.clearActions();
        var action = new Game_Action(subject, true);
        action.setSkill(skillId);
        action.apply(target);
        if (target.isEnemy()) this.addTotalDamage(target, target.result().hpDamage);
        target.startDamagePopup();
        var es = SceneManager._scene._enemySprites.filter(esp => esp._battler === target)[0];
        if (target.isEnemy() && !es._collapsePhase) {
            if (!$gameTroop.aliveMembers().length || this._inFinish) {
                if (this.canContinueFinish(true)) {
                    //フィニッシュ開始
                    target.setHp(1), target.addState(3);
                    this._inFinish = true;
                } else {
                    target.removeState(3), target.setHp(0);
                    target.performCollapse();
                    this._inFinish = false;
                }
            } else if (target.isDead()) {
                target.performCollapse();
            }
        }
    };

    //アクター回復
    Scene_NewBattle.prototype.actorGainHp = function (actor, value) {
        if (actor.isDead()) return;
        value = Math.min(actor.mhp - actor.hp, value);
        if (value > 0) {
            actor.clearResult();
            actor.gainHp(value);
            actor.startDamagePopup();
            actor.performRecovery();
        }
    }
    
    //弾を生成
    Scene_NewBattle.prototype.newBullet = function(image, x, y, tx, ty, moveType, param1, param2, param3) {
        var b = new Sprite_Bullet(image, x, y, tx, ty, moveType, param1, param2, param3);
        this._bulletSprites.push(b);
        this._battleContainer.addChild(b);
        b.z = 4;
        return b;
    };
    Scene_NewBattle.prototype.getBulletWait = function(image, x, y, tx, ty, moveType, param1, param2, param3) {
        var bullet = new Sprite_Bullet(image, x, y, tx, ty, moveType, param1, param2, param3);
        bullet.setTest();
        var frames  = 0;
        var safety  = 10000;
        while (!bullet._finish && frames < safety) {
            bullet.update();
            frames++;
        }
        bullet = null;
        return frames < safety ? frames : 0;
    };

    Scene_NewBattle.prototype.update = function() {
        var active = this.isActive();
        for (let i = 0; i < (SceneManager.isRapid && SceneManager.isRapid() ? 8 : 1); i++) {
            $gameTimer.update(active);
            $gameScreen.update();
        }
        Scene_Base.prototype.update.call(this);

        var active = false;
        if ($gameTroop.isEventRunning() || $gameMessage.isBusy()) this._forceSkip = true;
        if (!this.updateVictory()) {
            if (this.barVisible() && !BattleManager.updateEvent()) {
                if (!this.updateSkip() && this.isBattleActive()) {
                    active = true;
                }
            }
        }
        $gameSystem.setKeyAndGamepadConfig(active);
        if (active) {
            this.updateInputJudge();
            this.updateTurn();
        }
        this.updateJudgeTexts();
        this.updateBar();
        this.updateTotalDamage();
        this.updateFinish();
        this.updateActors();
        this.updateEnemies();
        this.updateBullets();

        this.updateOsamuRock();
        if (this._qte) this._qteCount++;

        this.updateUI();
        this.updateNoteLine();

        //表示順
        this._battleContainer.children.sort(Tilemap.prototype._compareChildOrder.bind(this));

        //シェイク対応
        if (!this._noShake) {
            this.x = this.y = 0;
            if ($gameScreen.shake()) this._shake = $gameScreen.shake();
            else this._shake > 0 ? this._shake -= 0.5 : this._shake = 0;
            if (this._shake) {
                this.x += _rand(-this._shake * 2, +this._shake * 2);
                this.y += _rand(-this._shake * 2, +this._shake * 2);
            }
        }

    };
    
    //勝利判定
    Scene_NewBattle.prototype.updateVictory = function() {
        if (BattleManager._phase === 'battleEnd') {
            if (BattleManager._escaped) {
                this._skipText.visible = false;
                if (!$gameMessage.isBusy()) this.updateBattleEnd();
                return true;
            }
            if (!this._victoryMotion) {
                _timeOut(function() {
                    this._actorSprites.forEach(function(sp) {
                        sp.resetForAction();
                        if (sp._battler.isAlive()) sp.setAnimation('win', false, 0, Infinity);
                    })
                }.bind(this), 40)
                this._victoryMotion = true;
            }
            if ($gameMessage.isBusy()) return true;
            if ($gameTroop.isEventRunning()) {
                $gameTroop.updateInterpreter();
                return true;
            }
            if (this._todomeCount && !$gameSwitches.value(29) && !BattleManager.isBattleTest()) {
                $gameTroop._interpreter = new Game_Interpreter();
                $gameTroop._interpreter.setup($dataCommonEvents[17].list, 0);
            } else if ($gameTemp._lvUpInfos) {
                $gameTroop._interpreter = new Game_Interpreter();
                $gameTroop._interpreter.setup($dataCommonEvents[10].list, 0);
            } else if ($gameTemp._skLvUpInfos) {
                $gameTroop._interpreter = new Game_Interpreter();
                $gameTroop._interpreter.setup($dataCommonEvents[11].list, 0);
            } else if ($gameTemp._itemRewards) {
                $gameTroop._interpreter = new Game_Interpreter();
                $gameTroop._interpreter.setup($dataCommonEvents[16].list, 0);
            }
            this.updateBattleEnd();
            return true;
        }
    };

    Scene_NewBattle.prototype.updateBattleEnd = function () {
        var c = this._battleEndCount = this._battleEndCount || 0, a = 60;
        if (c === a) {
            this.removeChild(this._barSprite);
            BattleManager._tutorial = false;

            $gameTemp._snap = SceneManager.snap();
        } else if (c === a + 1) {
            if (!$gameSwitches.value(18)) {
                var pos = $gameTemp._battlePageRight ? 1 : -1;
                var dir = [3, 6, 9, 1, 4, 7][[-1, -2, -3, 1, 2, 3].indexOf(pos)];
                this.startPageTurnEffect(60, dir);
                $gameSystem.playSe('Book2', 90);
            }
        } else if (c === a + 60) {
            if (!BattleManager.isBattleTest() && !BattleManager._escaped &&
                $gameParty.isAllDead() && !BattleManager._canLose) {
                SceneManager.goto(Scene_Gameover);
            } else {
                $gameParty.reviveBattleMembers();
                SceneManager.pop();
            }
        }
        this._battleEndCount++;
    };

    //スキップが行われたかどうかを判定
    Scene_NewBattle.prototype.updateSkip = function() {
        if (this._openningCommand && this.progress() < 6) {
            this._forceSkip = true;
        }
        var count = $gameSystem.sceneCount();
        if (count - this._lastCount > 12 || this._forceSkip) {
            this._skip = true;
            this._skipCount = 60;
            if (!this._forceSkip) this._combo = 0; //不正なスキップには死を

            if (this._forceSkip) {
                this._noAddTurn = true;
                this._forceSkip = false;
            }
            this.updateTurn();
            this.restoreButtons();
        }
        this._lastCount = count;
        
        if (this._skip) {
            if (!this._setEnemyAttacksTurn) //敵の攻撃ターンを設定し直す
                this._enemySprites.forEach(es => { es._turnActions.forEach(ac => { ac.turn = this._turn }) })
            this._setEnemyAttacksTurn = true;

            if (!this.inCommand() && !this._simMode) {
                if (!this._skipCount && this.progress() < 6) {
                    this._skip = false;
                    this._noAddTurn = true;
                }
                if (this._skipCount) this._skipCount--;
            } else {
                this._skipCount = 60;
            }
            return true;
        } else {
            this._setEnemyAttacksTurn = false;
        }
        this._countdownSprite.visible = this._skipText.visible = false;
        return false;
    };
    
    //    判定
    Scene_NewBattle.prototype.updateInputJudge = function () {
        var triggered = Input.isTriggered('right') || Input.isTriggered('right2') || Input.isTriggered('ok') ? 'A' :
            Input.isTriggered('down') || Input.isTriggered('down2') || Input.isTriggered('cancel') ? 'B' :
            Input.isTriggered('up') || Input.isTriggered('up2') ? 'X' :
            Input.isTriggered('left') || Input.isTriggered('left2') ? 'Y' : '';
        var pressed = Input.isPressed('right') || Input.isPressed('right2') || Input.isPressed('ok') ? 'A' :
            Input.isPressed('down') || Input.isPressed('down2') || Input.isPressed('cancel') ? 'B' :
            Input.isPressed('up') || Input.isPressed('up2') ? 'X' :
            Input.isPressed('left') || Input.isPressed('left2') ? 'Y' : '';
        var a = 0; //補正値
        var curProgress = (this.progress() + a) / this.maxCount() * 64; //補正あり
        var progress = this.progress() / this.maxCount() * 64; // 補正なし
        var isAuto = (testAuto || this._simMode) && !TouchInput.isPressed();
        if (triggered) {
            var bestDist = 0, bestDifference = 0, bestButton = null;
            var isGuard = triggered === 'B';
            var actor = $gameParty.members()[this._turnActorIndex];
            var judgeFrames = [3, 8, 12];
            var msValue = actor.metaStateValue(isGuard ? 'judgmentGuard' : 'judgmentAttack');
            judgeFrames[0] = (judgeFrames[0] + msValue).clamp(1, 10);
            judgeFrames[1] = (judgeFrames[1] + msValue * 2).clamp(2, 16);
            var _judge = function (dist) {
                if (dist <= judgeFrames[0]) return 0;
                else if (dist <= judgeFrames[1]) return 1;
                else if (dist <= judgeFrames[2]) return 2;
                return 3;
            }

            var inRushButton = null;
            var targetButtons = this._buttonSprites.filter(bs => {
                if (triggered !== 'B' && bs._info.rush &&
                    curProgress >= bs._index && curProgress <= bs._index + bs._info.length)
                    inRushButton = bs;
                return !bs._judged && bs._waitCount <= 0 &&
                    !(bs._info.button !== 'B' && this.inOsamuRock(bs._index)) &&
                    !($gameSwitches.value(16) && bs._info.button === 'B');
            });
            targetButtons.sort((a, b) => a._index - b._index);
            bestButton = [].concat(targetButtons).sort((a, b) => {
                Math.abs(curProgress - a._index) - Math.abs(curProgress - b._index) ||
                (a._index - b._index)})[0];
            for (var i = 0; i < targetButtons.length; i++) { //先頭のボタンを優先
                var bs = targetButtons[i];
                if (_judge((bs._index - curProgress) / 64 * this.maxCount()) < 2) {
                    bestButton = bs;
                    break;
                }
            }
            if (inRushButton) bestButton = inRushButton;
            else if (bestButton && bestButton._info.rush) inRushButton = bestButton;
            bestDifference = bestButton ? (bestButton._index - curProgress) / 64 * this.maxCount() : 0;
            bestDist = Math.abs(bestDifference);
            
            if (triggered !== 'B' && this.inOsamuRock(curProgress)) { //岩を壊す処理を優先
                this.damageOsamuRock(curProgress);
            } else if (
                bestButton && (bestDist < 16 || (bestButton._info.rush && bestDifference <= 0)) &&
                triggered === bestButton._info.button &&
                !($gameSwitches.value(16) && isGuard)
            ) {
                var judgment = 3;
                if (triggered === bestButton._info.button) {
                    if (inRushButton) judgment = ++bestButton._rushCount > 2 ? 0 : 1;
                    else judgment = _judge(bestDist);
                }
                if (bestButton._info.long && judgment < 2) {
                    bestButton._pressing = true;
                    bestButton._pressCount = bestButton._info.length / 64 * this.maxCount();
                }
                this.showJudgeResult(bestButton, judgment);
            }
        }

        // 長押しボタンの判定
        this._buttonSprites.filter(bs => {
            if (bs._pressing) {
                if (bs._pressCount > 0 && (pressed === bs._info.button || isAuto)) { //長押し中
                    bs._pressCount--;
                } else { //長押し終了
                    var judgment = 3;
                    if (bs._pressCount < 12) judgment = 0;
                    else if (bs._pressCount < 24) judgment = 1;
                    else if (bs._pressCount < 36) judgment = 2;
                    this.showJudgeResult(bs, judgment, false, true);
                    bs._pressing = false;
                }
            }
        })

        // 通り過ぎたボタンの自動Miss判定
        for (var i = this._buttonSprites.length - 1; i >= 0; i--) {
            var bs = this._buttonSprites[i];
            if (bs._judged || bs._waitCount > 0 || this.inOsamuRock(bs._index)) continue;

            var difference = (bs._index - curProgress) / 64 * this.maxCount();
            var dist = Math.abs(difference);
            if (!($gameSwitches.value(16) && bs._info.button === 'B')) {
                if (isAuto && difference <= 0) { //自動モード
                    var n = Math.randomInt(10) * (!bs.opacity ? 0.5 + 0.5 * testAutoQuality / 10 : 1);
                    var j = n < testAutoQuality * 0.8 ? 0 : n < testAutoQuality ? 1 : n < testAutoQuality * 1.2 ? 2 : 3;
                    if (bs._info.long) {
                        if (!bs._pressing) {
                            this.showJudgeResult(bs, j, true);
                            bs._pressing = true, bs._pressCount = bs._info.length / 64 * this.maxCount() - 4;
                        }
                    } else if (bs._info.rush) {
                        if (curProgress <= bs._index + bs._info.length) {
                            if (!Math.randomInt(10)) this.showJudgeResult(bs, 0);
                        }
                        else this.showJudgeResult(bs, 0, true);
                    } else {
                        this.showJudgeResult(bs, j, true);
                    }
                } else { //自動モードではない
                    if (bs._info.rush) {
                        if (curProgress > bs._index + bs._info.length) {
                            this.showJudgeResult(bs, bs._rushCount > 2 ? 0 : bs._rushCount > 0 ? 1 : 3, true);
                        }
                    } else if (dist >= (bs._info.button === 'B' ? 6 : 12) && bs._index < curProgress) {
                        if (!(bs._info.long && bs._pressCount)) {
                            this.showJudgeResult(bs, 3, true);
                        }
                    }
                }
            }
        }
    };

    Scene_NewBattle.prototype.showJudgeResult = function(bs, judgment, through, release) {
        var isGuard = bs._info.button === 'B';
        //判定テキストを表示
        if (
            !(bs._info.rush && through && judgment < 2) && //連打終わりは表示しない（完全スルー時を除く）
            !(isGuard && !bs.opacity && through) //防御（表示前）のスルー時は表示しない
        ) {
            var text = new Sprite_Base();
            text.bitmap = ImageManager.loadSystem('UI_battle_bar_texts');
            text.anchor.x = text.anchor.y = 0.5;
            text.setFrame(0, judgment * 44, 56, 44);
            text.x = this._barSprite.x + bs.x;
            if (release || (bs._info.rush && !through)) text.x = this._barSprite.x + this._carCursorSprite.x;
            text.y = this._barSprite.y + bs.y - 36;
            text._life = 30;
            this._textSprites.push(text);
            this.addChild(text);
        }

        //該当ボタンを判定済みに
        if (
            !(bs._info.long && !release && judgment < 2) && //長押し時の最初のプレスで成功時は判定済みにしない
            !(bs._info.rush && !through) //連打時の終わり以外は判定済みにしない
        ) {
            bs._judged = true;
            this.controlDifficultyGauge(judgment); //難易度上下への影響
        }
        //ボタンを半透明に
        if (
            !(isGuard && !bs.opacity && judgment > 2) && //失敗時、非表示の防御ボタンは半透明にしない
            !(bs._info.long && !release) && //長押し時の最初のプレスでは半透明にしない
            !(bs._info.rush && !through) //連打時の終わり以外は半透明にしない
        ) {
            bs.opacity = 128;
        }

        if (!this._simMode) {
            //効果音
            if (!(bs._info.rush && through)) { //連打終わりは鳴らさない
                if (bs._info.long && !release) {
                    if (judgment === 2) $gameSystem.playSe('00_result3');
                    else if (judgment < 2) $gameTemp._tameSeBuffer = $gameSystem.playSe('Up2', 70, 70); //ためSE
                } else {
                    if (release && $gameTemp._tameSeBuffer) { //ためSEを止める
                        $gameTemp._tameSeBuffer.stop();
                        AudioManager._seBuffers.splice(AudioManager._seBuffers.indexOf($gameTemp._tameSeBuffer), 1);
                        $gameTemp._tameSeBuffer = null;
                    }
                    //通常SE
                    if (judgment === 0) $gameSystem.playSe('00_result1');
                    if (judgment === 1) $gameSystem.playSe('00_result2');
                    if (judgment === 2) $gameSystem.playSe('00_result3');
                }
            }

            //アニメーション
            if (judgment < 2 && !(bs._info.rush && through)) { //連打終わりは鳴らさない
                var sp = bs.startAnimation($dataAnimations[[13, 12][judgment]], false, 0);
                sp.x = bs.x, sp.y = bs.y, sp.z = 4;
                if (release) sp.x = this._carCursorSprite.x;
                sp._noUpdatePosition = true;
            }

            //失敗エフェクト
            if (bs.opacity && judgment > 1) {
                if (bs._particle) bs._particle.end();
                bs._particle = new Sprite_Particle('buttonFailed');
                bs.addChild(bs._particle);
            }
        }
        
        //コンボ
        this._combo = judgment < 2 ? this._combo + 1 : 0;

        //トータルダメージへの影響
        if (!isGuard && judgment >= 2 && this._totalDamages[0] && !this._totalDamages[0].phase) {
            this._totalDamages[0].count = 60;
            this._totalDamages[0].phase = 1;
        }
        
        //キャラアクション
        if (!release) {
            if (isGuard) { //防御
                this.turnActorSprite()._guards.push({ result: judgment, info: bs._info });
                if (judgment <= 1 && $gameVariables.value(2) === 2 && !$gameSwitches.value(7)) $gameSwitches.setValue(7, true); //バイクマン戦闘用
            } else {
                var actor = bs._info.actor, skillId = bs._info.skillId;
                var sp = this._actorSprites.filter(function (as) { return as._battler === actor })[0];
                if (judgment <= 2) { //攻撃
                    if (actor.isAlive()) sp.startAction(skillId, null, judgment, bs);
                } else { //失敗
                    if (!through) sp.setAnimation('failed', false, 5);
                }
            }
        }
    };

    Scene_NewBattle.prototype.updateJudgeTexts = function() {
        this._textSprites.forEach(function(sprite, i) {
            sprite._life--;
            sprite.y -= sprite._life / 30;
            sprite._frame.x = 56 * (Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait()) % 3);
            sprite._refresh();
        }.bind(this));
        this._textSprites = this._textSprites.filter(sprite => {
            if (sprite._life <= 0) {
                this.removeChild(sprite);
                return false;
            }
            return true;
        });
    };

    //トータルダメージ表示
    var _tdScale = 0.7, _tdMaxDuration = 130;
    Scene_NewBattle.prototype.addTotalDamage = function (enemy, damage) {
        var c = a => a.enemy === enemy && (!a.phase || enemy.isDead());
        if (!this._totalDamages.some(c)) {
            var info = {
                damage: 0, time : 0, count: 0, phase : 0, enemy : enemy
            }
            this._totalDamages.push(info);
        }
        var kouho = this._totalDamages.filter(c);
        if (enemy.isDead()) while (kouho.length > 1) {
            this._totalDamages.splice(this._totalDamages.indexOf(kouho.shift()), 1);
        }
        var info = kouho[0];
        if (damage > 0) {
            info.damage += damage;
            info.time++;
            info.count = 0;
        }
    };
    Scene_NewBattle.prototype.updateTotalDamage = function () {
        var tds = this._totalDamageSprite;
        var info = this._totalDamages[0];
        if (!info) {
            tds.visible = false;
            this._lastInfoTotalDamage = null;
        } else {
            var text = '' + info.damage;
            var es = SceneManager._scene._enemySprites.filter(esp => esp._battler === info.enemy)[0];
            var init = info.count === 0;
            tds.visible = info.time > 1 || info.enemy.isDead();

            if (info.enemy.isDead() && !info.phase) info.count = 60, info.phase = 1;
            //数値更新
            if (info.count <= 60) {
                var _info = [info.damage].toString();
                if (this._lastInfoTotalDamage !== _info) {
                    this._lastInfoTotalDamage = _info;
                    if (tds._damageSprite) tds.removeChild(tds._damageSprite), tds._damageSprite = null;
                    var ds = tds._damageSprite = new Sprite_Damage();
                    ds._isTotal = true;
                    ds._updateScale = false;
                    ds._duration = ds._total_maxDuration = _tdMaxDuration;
                    ds.x = 0, ds.y = -14;
                    ds.createDigits(2, info.damage);
                    ds.scale.x = ds.scale.y = _tdScale;
                    tds.addChild(ds);
                }
            }
            //位置更新
            if (init) {
                var ex = info.enemy.isDead() ? es._homeX : es.x, ey = info.enemy.isDead() ? es._homeY : es.y;
                tds.x = (ex + es.damageOffsetX()).clamp(0, 700);
                tds.y = ey + es.damageOffsetY() + 60;
            }
            var ds = tds._damageSprite;
            ds.opacity = 255;

            //拡大率
            if (info.count <= 6) {
                var t = info.count, b = 1.1, c = -0.1, d = 6;
                tds.scale.x = tds.scale.y = c * (t / d) + b;
            } else if (info.count >= 60 && info.count < 60 + 20) {
                var t = info.count - 60, b = 1, c = 0.2, d = 20;
                tds.scale.x = tds.scale.y = c * ((t = t / d - 1) * t * t + 1) + b
            }
            else if (info.count >= 60 + 20) tds.scale.x = tds.scale.y = 1.25;
            else tds.scale.x = tds.scale.y = 1

            //更新
            if (info.count < 60) {
                ds.update();
                tds.x += 0.2;
            } else if (info.count === 60) {
                info.phase = 1;
                if (info.time <= 1) info.count = _tdMaxDuration;
            } else if (info.count > 60 && info.count < _tdMaxDuration) {
                tds.x += 0.4;
            } else if (info.count >= _tdMaxDuration) {
                this._totalDamages.shift();
                tds.removeChild(tds._damageSprite), tds._damageSprite = null;
                this._lastInfoTotalDamage = null;
            }
            info.count++;
            if (this._inFinish || this._buttonSprites.some(bs => bs._pressing)) info.count = Math.min(info.count, 1);
        }
    };

    //フィニッシュ
    Scene_NewBattle.prototype.canContinueFinish = function (onAttack) {
        var info = $gameSystem.sceneCount();
        if (this._lastInfoContinueFinish !== info || onAttack) {
            this._lastInfoContinueFinish !== info;
            this._canContinueFinish = false;
            if (this._combo < 10 && this._results.filter(j => j > 2).length) this._canContinueFinish = false;
            else if (this._openningCommand) this._canContinueFinish = false;
            else if (BattleManager._tutorial) this._canContinueFinish = false;
            else if (
                this._buttonSprites.some(bs => bs._pressing) ||
                (
                    this._totalDamages.some(a => !a.phase) &&
                    (!onAttack || this._trueData.some(function (a, i) {
                        var timing = i / 64 * this.maxCount();
                        return a && a.button !== 'B' &&
                            timing + (timing < this.progress() ? this.maxCount() : 0) - this.progress() < 120;
                    }.bind(this)))
                )
            ) this._canContinueFinish = true;
        }
        return this._canContinueFinish;
    };
    Scene_NewBattle.prototype.updateFinish = function () {
        var fns = this._finishSprite;
        var lastVisible = fns.visible;
        fns.visible = this._inFinish && !this._inTodome && BattleManager._phase !== 'battleEnd';
        if (this._forceFnsVisible) fns.visible = true;
        if (fns.visible) {
            var enemy = $gameTroop.members()[this._targetIndex], es = this.targetEnemySprite();
            if (!lastVisible) {
                $gameSystem.playSe('Skill3', 90, 120);
                fns._lastFrame = null;
                fns.bitmap = fns._baseBitmap = 
                    ImageManager.loadSystem($gameVariables.value(32) ? 'UI_battle_finish_g' : 'UI_battle_finish');
            }
            fns.scale.x = fns.scale.y = !(Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait()) % 2) ? 1.2 : 1;
            if (!this._forceFnsVisible) {
                if (!this.canContinueFinish()) { //自然終了
                    this._inFinish = false;
                    enemy.removeState(3), enemy.setHp(0)
                    if (!es._collapsePhase) enemy.performCollapse();
                    fns.visible = false;
                } else if (Input.isTriggered('left') || Input.isTriggered('left2')) { //とどめ開始
                    this._inTodome = true;
                    this._todomeCount = 0;
                    fns.visible = false;
                }
            }
        }
        if (this._inTodome) {
            var as = this.turnActorSprite(), es = this.targetEnemySprite();
            var scale = 1.5;
            var cx = Math.min(es._homeX - 50, Graphics.boxWidth * (1 - 1 / (scale * 2)));
            var cy = es._homeY + es._floatHeight - 90, isUp = false;
            if (cy < 208) cy = 208, isUp = true;
            if (!this._todomeCount) {
                as.resetForAction();
                as._actions = [];
                as.startMove(
                    es._homeX + es.baseOffsetX() + 200 - as._homeX,
                    es._homeY + es.baseOffsetY() - as._homeY + 6, 0
                );
                as.startMove(
                    es._homeX + es.baseOffsetX() - 100 - as._homeX,
                    es._homeY + es.baseOffsetY() - as._homeY + 6, 4
                );
                es._shake = 8;
                as._forceFrame = [1, 2];
                //効果音
                var a = 16, seName = 'Sword4';
                $gameSystem.playSe(seName, 100, 100);
                _timeOut(() => $gameSystem.playSe(seName, 50, 100), a);
                _timeOut(() => $gameSystem.playSe(seName, 30, 100), a * 2);
                _timeOut(() => $gameSystem.playSe(seName, 20, 100), a * 3);
                _timeOut(() => $gameSystem.playSe(seName, 10, 100), a * 4);
                //アニメーション
                var sp = this.playAnimation($dataAnimations[46], es.x, es.y - es.height / 2 - 60);
                sp.z = 5.1;
                //ズーム
                SceneManager.setEasing(this.scale, 'x', 'easeOutExpo', 1, scale, 80);
                SceneManager.setEasing(this.scale, 'y', 'easeOutExpo', 1, scale, 80);
                SceneManager.setEasing(this, 'x', 'easeOutExpo', 0, -(cx * scale - Graphics.boxWidth / 2), 80);
                SceneManager.setEasing(this, 'y', 'easeOutExpo', 0, -(cy * scale - Graphics.boxHeight / 2), 80);
                this._noShake = true;
            } else if (this._todomeCount === 4) {
                as.startMove(
                    es._homeX + es.baseOffsetX() - 140 - as._homeX,
                    es._homeY + es.baseOffsetY() - as._homeY + 6, 90
                );
                //アニメーション
                var sp = this.playAnimation($dataAnimations[isUp ? 45 : 44], cx, cy);
                sp.z = 5.2;
            } else if (this._todomeCount === 94) {
                es._battler.removeState(3), es._battler.setHp(0)
                es._battler.performCollapse();
                as._forceFrame = null;
                as.setAnimation('', true);
                as.startMove(as.baseOffsetX(), as.baseOffsetY(), 20);
                SceneManager.setEasing(this.scale, 'x', 'easeOutCubic', this.scale.x, 1, 45);
                SceneManager.setEasing(this.scale, 'y', 'easeOutCubic', this.scale.y, 1, 45);
                SceneManager.setEasing(this, 'x', 'easeOutCubic', this.x, 0, 45);
                SceneManager.setEasing(this, 'y', 'easeOutCubic', this.y, 0, 45);
                this._inTodome = false;
                this._inFinish = false;
                BattleManager.checkBattleEnd();
            }
            this._todomeCount++;
        }
    };


    Scene_NewBattle.prototype.updateActors = function() {
    };

    Scene_NewBattle.prototype.updateEnemies = function() {
        var target = $gameTroop.members()[this._targetIndex];
        var lastIndex = this._targetIndex;
        if (target.isDead()) this._targetIndex = 
            $gameTroop.members().indexOf($gameTroop.members().filter(function(enemy) {return enemy.isAlive()})[0]);
        if (this._targetIndex < 0) this._targetIndex = lastIndex;
    };

    Scene_NewBattle.prototype.updateBullets = function() {
        var deletes = [];
        this._bulletSprites.forEach(function(bs){
            if (bs._finish == 2) deletes.push(bs);
        });
        deletes.forEach(function(bs) {
            this._bulletSprites.splice(this._bulletSprites.indexOf(bs), 1);
            this._battleContainer.removeChild(bs);
        }.bind(this))
    };
    
    Scene_NewBattle.prototype.showTextPop = function(position, judgment, x, y) {
        var tps = this._textPopSprites, tp = tps[position];
        tp._count = tp._maxCount;
        tp.setFrame(0, judgment * 64, 128, 64);
        tp.x = (x + (position ? -1 : 1) * 64 + _rand(-12, 12)).clamp(128, Graphics.boxWidth - 128);
        tp.y = (y - 240 + _rand(-12, 12)).clamp(24, Graphics.boxHeight - 24);
        tp.rotation = _rand(-12, -3) / 180 * Math.PI;
    };

    Scene_NewBattle.prototype.updateUI = function() {
        //ターゲット選択用矢印更新
        var tas = this._targetArrowSprite;
        tas.visible = SceneManager._scene._actorWindow && SceneManager._scene._actorWindow.active &&
            !SceneManager._scene._onUseItem;
        if (tas.visible) {
            var index = SceneManager._scene._actorWindow.index();
            var as = this._actorSprites[index];
            tas.x = as.x + 40, tas.y = as.y - 140;
            tas.scale.x = tas.scale.y =
            [1, 0.9, 0.85, 0.9][Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait()) % 4];
        }

        //テキストポップ更新
        var tps = this._textPopSprites;
        for (var i = 0; i < 2; i++) {
            var tp = tps[i];
            if (tp._count > 0) {
                tp.opacity = 255;
                tp.scale.x = tp.scale.y = Math.max(1.5 - (tp._maxCount - tp._count) / 6 * 0.5, 1.2);
                tp._count--;
            } else {
                tp.opacity = 0;
            }
        }
        
        var rate = this.progress() / this.maxCount();
        var startRate = 1 - 1 / (2 * this.maxCountRate());
        var cmVisible = this._skip && !$gameTroop.isEventRunning() && !$gameSwitches.value(18) && !$gameScreen._fadeZXCActive;
        //カウントダウン
        var cds = this._countdownSprite;
        if (!this.inCommand() && !this._simMode) {
            cds.visible =
                cmVisible && this.barVisible() && rate > startRate && !this._onUseItem &&
                this.progress() + this._skipCount < this.maxCount();
            var index = Math.min(Math.floor((rate - startRate) / ((1 - startRate) / 4)), 3);
            if (cds.visible) {
                var w = index === 3 ? 2 : 1;
                cds.setFrame(240 * index, 0, 240 * w, 240);
            } else cds.setFrame(0, 0, 240, 240);
        }
        //待機中テキスト
        var st = this._skipText;
        st.visible = cmVisible && !cds.visible && this._skip && !this._onUseItem && !BattleManager._escaped;
        var text = this.inCommand() ? 'コマンド入力中' : '待機中', aw = $gameSystem.animationWait() * 2;
        text = _tl(text);
        text += ['', '.', '..', '...'][Math.floor(($gameSystem.sceneCount() % (aw * 4)) / aw)]
        if (st._lastText !== text) {
            st._lastText = text;
            st.refreshYurayura();
            st.contents.clear(), st.resetTextColor();
            for (var i = 0; i < 5; i++) {
                st.contents.outlineWidth = [28, 20, 20, 12, 8][i], st.contents.outlineColor = [2].contains(i) ? 'black' : 'white';
                var a = [0, 2].contains(i) ? 2 : 0;
                st.drawTextKNH(text, a, st.height / 2 * st.scale.y + a, st.width, 'center', 'center', 34);
            }
        }
        
        //ステータスウィンドウ更新
        var sw = this._statusWindow;
        this.barVisible() && !$gameSwitches.value(21) ? sw.open() : sw.close();
        var info = [this._turnActorIndex].concat($gameParty.members().map(function(actor) {return actor.hp})).toString();
        if (sw._lastInfo !== info) {
            sw._lastInfo = info;
            var _index = (3 - ($gameParty.members().length - 1)) / 2;
            sw.refreshYurayura();
            sw.contents.clear(), sw.resetTextColor(), sw.contents.fontsize = 24;
            $gameParty.members().forEach(function(actor, i) {
                var index = i === this._turnActorIndex ? 3 : _index++;
                var x = index === 3 ? sw.contents.width / 2 : 0;
                var y = (index === 3 ? 1 : index) * sw.contents.height / 3;
                var tw = 70;
                sw.drawText(actor._name, x, y, tw, 'center');
                var bw = sw.contents.width / 2 - tw - 8, bh = 18, a = 4;
                x += tw + 4, y += 8;
                sw.contents.fillRect(x, y, bw, bh, 'black');
                sw.contents.clearRect(x + a, y + a, Math.ceil((bw - 2 * a) * actor.hpRate()), bh - 2 * a);
            }.bind(this))
        }
        
        //インフォウィンドウ更新
        var iw = this._infoWindow;
        iw.openness = sw.openness;
        if (!iw.openness)
            iw._animationSprite._animationSprites.forEach(sp => sp.remove()), iw._animationSprite._animationSprites = [];
        var info = [this._turn, this._difficulty].toString();
        if (iw._lastInfo !== info) {
            iw._lastInfo = info;
            iw.refreshYurayura();
            iw.contents.clearRect(0, 0, iw.contents.width, iw.lineHeight() * 2);
            iw.drawText(_tl('ターン'), 0, 0, iw.contents.width, 'left');
            iw.drawText(this._turn + 1, 0, 0, iw.contents.width, 'right');
            iw.drawText(_tl('ないんど'), 0, iw.lineHeight(), iw.contents.width, 'left');
            iw.drawText(this._difficulty, 0, iw.lineHeight(), iw.contents.width, 'right');
        }
        if (this._difficultyGauge < 100) iw._difficultyMaxCount = 0;
        var info = [this._difficultyGauge, Math.floor(iw._difficultyMaxCount / 5)].toString();
        if (iw._lastInfo2 !== info) {
            iw._lastInfo2 = info;
            iw.refreshYurayura();
            iw.contents.clearRect(0, iw.lineHeight() * 2, iw.contents.width, iw.lineHeight());
            if ((Math.floor(iw._difficultyMaxCount / 5) % 3) < 2 || this._difficultyGauge < 100) {
                var n = 12;
                for (var i = 0; i < n; i++) {
                    if (this._difficultyGauge < 100 / n * (i + 1)) break;
                    iw.contents.fillRect(3 + i * 12, iw.lineHeight() * 2 + 8, 8, 20);
                }
            }
        }
        if (this._difficultyGauge >= 100) iw._difficultyMaxCount++;
        
        //コマンドウィンドウ更新
        var cw = this._commandWindow, ct = this._commandText;
        var ctVisible = this.barVisible() && !$gameSwitches.value(21) && !this._inFinish && !this._sceneInfo
        //呼び出し処理
        if (ctVisible) {
            if ((Input.isTriggered('R') && !this._openningCommand && !this._onUseItem) ||
                (this._onUseItem && !$gameMessage.isBusy())) {
                if (!this._commandWindow.isClosed()) {
                    SoundManager.playCancel();
                    this._commandWindow.close();
                } else {
                    if (this._onUseItem) {
                        this._onUseItem = false;
                    } else {
                        SoundManager.playOk();
                        this._openningCommand = true;
                    }
                }
            }
        }
        if (this._openningCommand && this._skip) {
            this._openningCommand = false;
            this.startCommand();
        }
        //テキスト更新
        ct.visible = ctVisible && !this.inCommand() && !this._onUseItem;
        var info = [this._openningCommand].toString();
        if (this._lastInfoCommandText !== info) {
            this._lastInfoCommandText = info;
            ct.refreshYurayura();
            ct.contents.clear(), ct.resetTextColor();
            var text = this._openningCommand ? _tl('コマンド\n  呼び出し中…') : _tl('\\i[%1]コマンド').format(
                !$gameVariables.value(32) ? 12 : 6
            );
            ct.drawTextKNH(text, 0, ct.height / 2, ct.width, 'center', 'center');
        }
    };

    Scene_NewBattle.prototype.startCommand = function() {
        var cw = this._commandWindow;
        cw.refresh();
        cw._list[0].enabled = !this._usedItem;
        if (!cw._list[0].enabled) {
            cw.contents.fillRect(12, 12, cw.contents.width - 24, 2, 'black');
            cw.contents.fillRect(12, 20, cw.contents.width - 24, 2, 'black');
        }
        cw._list[2].enabled = BattleManager.canEscape();
        if (!cw._list[2].enabled) {
            cw.contents.fillRect(12, 12 + 66, cw.contents.width - 24, 2, 'black');
            cw.contents.fillRect(12, 20 + 66, cw.contents.width - 24, 2, 'black');
        }
        cw.openness = 1, cw.open();
        cw.activate();
    };
    Scene_NewBattle.prototype.commandItem = function() {
        this._commandWindow.openness = 0;
        this.startItem();
    };
    Scene_NewBattle.prototype.commandOption = function() {
        this._commandWindow.openness = 0;
        this.startOption();
    };
    Scene_NewBattle.prototype.commandRun = function() {
        this._commandWindow.openness = 0;
        $gameMessage._fukidashi = false;
        $gameMessage._popupHeight = 99;
        $gameSystem.setMessagePopupFree(Graphics.boxWidth / 2, Graphics.boxHeight / 2 + 33 * 3);
        BattleManager._escapeRatio = 1;
        BattleManager.processEscape();
        this._actorSprites.forEach(as => as.startAction(5));
    };
    Scene_NewBattle.prototype.commandCancel = function() {
        var cw = this._commandWindow;
        cw.close();
    };

    //アイテム使用処理
    Scene_NewBattle.prototype.sc_onActorOk = function () {
        var user = Scene_Item.prototype.user.call(this);
        if (user.canUse(this._itemWindow.item())) {
            this._itemWindow.close();
            this._actorWindow.close();
            this._helpWindow.close();

            $gameMessage._fukidashi = false;
            $gameMessage._popupHeight = 99;
            $gameSystem.setMessagePopupFree(Graphics.boxWidth / 2, Graphics.boxHeight / 2 + 33 * 4);
            
            var item = this._itemWindow.item();
            var text = (item.meta.text || '%1は %2を使った！').format(user.name(), item.name);
            text = text.replace(/\\n/g, '\n');
            text += '\\bu ';
            $gameMessage.add(text);
            this._onUseItem = true;
            this._usedItem = true;

            var as = this._actorSprites[this._actorWindow.index()];
            as._forceFrame = [1, 3];
            var its = this._itemSprite;
            var pd = window.KNH_PlayerDrawing;
            var imageInfo = pd && pd.itemImageInfo ? pd.itemImageInfo(item) : null;
            if (!imageInfo && item.meta.image) {
                var legacyImageInfo = item.meta.image.split(',');
                imageInfo = { name: legacyImageInfo[0] || '', index: Number(legacyImageInfo[1] || 0) };
            }
            its.bitmap = pd && pd.loadItemImageBitmap ? pd.loadItemImageBitmap(imageInfo) : ImageManager.loadItem(imageInfo ? imageInfo.name || '' : '');
            its.bitmap.addLoadListener(() => {
                const imageIndex = Number(imageInfo && imageInfo.index || 0);
                const frame = pd && pd.itemImageFrame ? pd.itemImageFrame(its.bitmap, imageInfo) : {
                    x: (imageIndex % 4) * (its.bitmap.width / 4),
                    y: Math.floor(imageIndex / 4) * (its.bitmap.height / 2),
                    width: its.bitmap.width / 4,
                    height: its.bitmap.height / 2
                };
                its.setFrame(frame.x, frame.y, frame.width, frame.height);
                its.setOutline(1, 2);
                its.x = as.x, its.y = as.y - 184;
                its.opacity = 255;
            })
            _timeOut(() => {
                its.opacity = 0;
                var sp = as.startAnimation($dataAnimations[16]);
                sp.x = its.x, sp.y = its.y;
                sp._noUpdatePosition = true;
                as._forceFrame = null;
                as.setAnimation('', true);

                as._battler.clearResult();
                this.sc_useItem();
                as._battler.startDamagePopup();
                as._battler.performRecovery();
                this.endScene();
            }, 60)
        } else {
            SoundManager.playBuzzer();
        }
    };
    
    //ボタン判定復活
    Scene_NewBattle.prototype.restoreButtons = function(){
        this._buttonSprites.forEach(function(bs) {
            bs._judged = false;
        })
    };

    //難易度調整用
    Scene_NewBattle.prototype.controlDifficultyGauge = function (judgment) {
        if ($gameSwitches.value(17)) return;
        var value = [25, 15, -10, -20][judgment];
        var missSpan = Math.min(Math.max(this._results.indexOf(2), -1), Math.max(this._results.indexOf(3), -1));
        var missNum = this._results.filter(j => j > 2).length;
        if (value >= 0) {
            value *= 100 / 25 / (1 + this._difficulty * 2); //難易度が高いほど上がりにくい
        } else {
            if (missSpan >= 0) value *= 1 + 1 / (missSpan + 1); //最近のミスが近いほど下がりやすい
            if (missNum > 0) value *= 1 + missNum * 0.7; //最近のミスが多いほど下がりやすい
        }
        value *= this.maxCount() / 300; //曲のテンポが早いほど変動しにくい

        this._difficultyGauge = (this._difficultyGauge + value).clamp(-50, 120);
        this._results.unshift(judgment);
        this._results.length = Math.min(this._results.length, 3 + this._difficulty);
    };

    Scene_NewBattle.prototype.updateTurn = function(init) {
        //index 0 地点での更新
        if (($gameSystem.sceneCount()) / this.maxCount() - 1 >= this._lastBgmCount) {
            if (!init) this._lastBgmCount = Math.ceil(($gameSystem.sceneCount()) / this.maxCount() - 1);
            if (this._noAddTurn) return this._noAddTurn = false;
            //ターン更新
            if (!init) {
                this._turn++, $gameTroop.increaseTurn();
                this.changeMember();
                $gameParty.members().forEach(actor => {
                    if (actor.metaState('gainHpRateTurn')) {
                        var value = Math.ceil(actor.mhp * actor.metaStateValue('gainHpRateTurn') / 100);
                        this.actorGainHp(actor, value);
                    }
                })
            }
            this.restoreButtons();
            BattleManager._phase = 'turnEnd';
        } else {
            BattleManager._phase = 'turn';
        }

        //index 62 地点付近での更新
        var a = 24;
        if (($gameSystem.sceneCount() + a) / this.maxCount() - 1 >= this._lastBgmCount2 &&
            this.progress() >= this.maxCount() - a) {
            this._lastBgmCount2 = Math.ceil(($gameSystem.sceneCount() + a) / this.maxCount() - 1);
            //　難易度判定　判定をもとにレベルアップ or ダウン判定
            if ($gameSwitches.value(16)) return;
            if (this._difficultyGauge >= 100) { //難易度上昇
                this._difficulty++;
                this._difficultyGauge = 20;
                $gameSystem.playSe('00_difficultyUp');
                var sp = this._infoWindow._animationSprite.startAnimation($dataAnimations[37], false, 0);
                sp.x = 208, sp.y = 70, sp.z = 4;
                sp._noUpdatePosition = true;

                $gameParty.members().forEach(actor => {
                    if (actor.metaState('gainHpRateDifUp')) {
                        var value = Math.ceil(actor.mhp * actor.metaStateValue('gainHpRateDifUp') / 100);
                        this.actorGainHp(actor, value);
                    }
                })

            } else if (this._difficultyGauge <= 0 && this._difficulty > 1) { //難易度低下
                this._difficulty = Math.max(this._difficulty - 1, 1);
                this._difficultyGauge = 66.6;
                $gameSystem.playSe('00_difficultyDown');
                var sp = this._infoWindow._animationSprite.startAnimation($dataAnimations[38], false, 0);
                sp.x = 208, sp.y = 70, sp.z = 4;
                sp._noUpdatePosition = true;
            }

            if (this._noAddTurn) return;
            //譜面作成＆準備
            this.setData();
            this._usedItem = false;
        }
    };

    Scene_NewBattle.prototype.updateBar = function() {
        //バー更新
        var bar = this._barSprite;
        bar.visible = this.barVisible() && !$gameSwitches.value(21);
        if (bar.visible) {
            //ボタン更新
            var bss = this._buttonSprites;
            bss.forEach(function(bs) {
                //位置
                bs.x = bar.width * bs._index / 64;
                bs.y = bar.height / 2 + (bs._index % 2 ? 18 : 0);
                //フレーム
                var animeIndex = Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait()) % 4;
                bs.setFrame(animeIndex * 44,
                    (['A', 'B', 'X', 'Y'].indexOf(bs._info.button) + (!$gameVariables.value(32) ? 4 : 0)) * 44, 44, 44);
                //長いボタンの場合
                if (bs._info.length > 1) {
                    if (!bs._tailSprite) { //しっぽスプライト作成
                        var ts = bs._tailSprite = new Sprite();
                        var w = bar.width * bs._info.length / 64 + 44;
                        if (this._data[bs._index + bs._info.length]) w -= 28;
                        else if (this._data[bs._index + bs._info.length + 1]) w -= 14;
                        ts.bitmap = new Bitmap(w, 44);
                        ts.anchor = new Point(0, 0.5), ts.x = -22;
                        bs.addChild(ts);
                    }
                    var ts = bs._tailSprite;
                    var f = JSON.parse(JSON.stringify(bs._frame));
                    var animeIndex2 = bs._info.rush ?
                        Math.floor($gameSystem.sceneCount() / $gameSystem.animationWait() * 2) % 2 : 0;
                    var info = [animeIndex, animeIndex2].toString();
                    if (bs._lastInfoTailFrame !== info) { //しっぽスプライト描写
                        bs._lastInfoTailFrame = info;
                        ts.bitmap.clear();
                        ts.bitmap._context.imageSmoothingEnabled = false;
                        //しっぽ
                        for (var x = 22; x < ts.width - 44; x += 44) {
                            ts.bitmap.blt(bs.bitmap, (animeIndex % 2) * 88, 8 * 44, Math.min(44, ts.width - 44 - x), 44,
                            x, 0, Math.min(44, ts.width - 44 - x), 44);
                        }
                        ts.bitmap.blt(bs.bitmap, (animeIndex % 2) * 88 + 44, 8 * 44, 44, 44, ts.width - 44, 0, 44, 44);
                        //頭
                        ts.bitmap.blt(bs.bitmap, f.x, f.y, f.width, f.height, 0, 0);
                        if (animeIndex2 % 2) ts.bitmap.blt(bs.bitmap, f.x, f.y + 4, f.width, f.height - 4, 0, 0);
                    }
                } else if (bs._tailSprite) {
                    bs.removeChild(bs._tailSprite);
                    bs._tailSprite = null;
                }
                if ($gameTroop.isEventRunning()) {
                    if (this._qte) bs.opacity = 255;
                    else if (bs.opacity > 128 && !bs._judged) bs.opacity = 128;
                } else {
                    if (bs.opacity > 0 && !bs._judged) bs.opacity = 255;
                };
                bar.addChild(bs);
                //表示アニメーション
                if (!bs._displayedAnimation && bs.opacity) {
                    var sp = bar.startAnimation($dataAnimations[9], false, 0);
                    sp.x = bar.x + bs.x, sp.y = bar.y + bs.y, sp.z = 4;
                    sp._noUpdatePosition = true;
                    bs._displayedAnimation = true;
                }
                if (bs._waitCount > 0) bs._waitCount--;
            }, this)

            // 死亡した敵のボタン削除
            var deleteList = bss.filter(function(bs) {
                return bs._info.button === 'B' && (bs._info.enemy.isDead() || this._inFinish);
            }.bind(this));
            deleteList.forEach(function(bs) {
                bss.splice(this._buttonSprites.indexOf(bs), 1);
                bar.removeChild(bs);
            }.bind(this))

            //(岩更新)
            if (this._rockSprites) this._rockSprites.forEach(rs => bar.addChild(rs));

            //カーソル更新
            var cus = this._carCursorSprite;
            var rate = this.progress() / this.maxCount();
            if ($gameSwitches.value(19)) cus.x = 0;
            else if (this._qte) cus.x = Math.min(this._qteCount * bar.width / this.maxCount() * 2, bar.width / 2);
            else cus.x = Math.round(bar.width * rate);
            cus.y = bar.height / 2;
            cus.scale.x = cus.scale.y = 1 + 0.1 * Math.abs(Math.sin(rate * 8 * Math.PI));
            cus.opacity = (this.isBattleActive() || this._qte) ? 255 : 128;
            bar.addChild(cus);

            //コンボ数テキスト更新
            var cmt = this._comboText;
            cmt.scale.x = cmt.scale.y = 1 / cus.scale.x;
            cmt.x = -cmt.width * cmt.scale.x / 2, cmt.y = -60 - 120 * cmt.scale.y / 2;
            var combo = this._combo >= 10 ? this._combo : 0;
            var info = [combo].toString();
            if (cmt._lastInfo !== info) {
                cmt._lastInfo = info;
                cmt.refreshYurayura();
                cmt.contents.clear(), cmt.resetTextColor();
                if (combo) {
                    var bc = 'black';
                    for (var i = 0; i < 2; i++) {
                        cmt.contents.textColor = ['white', bc][i];
                        cmt.contents.outlineWidth = [10, 0][i];
                        cmt.contents.outlineColor = ['white', bc][i];
                        var a = [0, 0][i]
                        cmt.setFontSize(20);
                        cmt.contents.fontBold = true;
                        cmt.drawText('COMBO', a, 12 + a, cmt.width, 'center');
                        cmt.setFontSize(32);
                        cmt.contents.fontBold = true;
                        cmt.drawText(this._combo, a + 1, 36 + a + 1, cmt.width, 'center');
                    }
                }
                cmt._windowContentsSprite.setOutline(2, 2);
            }
            cus.addChild(cmt);
        } else {
            var bss = this._buttonSprites;
            bss.forEach(function (bs) {
                if (bs._particle) bs._particle.end(), bs._particle = null;
            }.bind(this))
        }
    };

    Scene_NewBattle.prototype.inCommand = function() {
        return !this._commandWindow.isClosed() || !!this._sceneInfo;
    };
    Scene_NewBattle.prototype.isBattleActive = function() {
        return !$gameTroop.isEventRunning() && !SceneManager._scene._skip && this.barVisible() && !this.inCommand();
    };
    Scene_NewBattle.prototype.barVisible = function () {
        return (
            $gameTroop.isEventRunning() || this._onUseItem ||
            !this._messageWindow.isOpen() || this._messageWindow._closing
        ) &&
            !$gameScreen._fadeInDuration &&
            !this._inTodome &&
            BattleManager._phase !== 'battleEnd';
    };

    Scene_NewBattle.prototype.stop = function() {
        Scene_Base.prototype.stop.call(this);
    };

    Scene_NewBattle.prototype.terminate = function() {
        Scene_Base.prototype.terminate.call(this);
        $gameParty.onBattleEnd();
        $gameTroop.onBattleEnd();
        AudioManager.stopMe();
        ImageManager.clearRequest();

        $gameMessage._fukidashi = true;
    };

    // -----------------------------------------------------------------------------
    // BattleManager
    // -----------------------------------------------------------------------------

    BattleManager.isBusy = function() {
        return ($gameMessage.isBusy() && !SceneManager._scene._onUseItem);
    };
    var _BattleManager_endBattle = BattleManager.endBattle;
    BattleManager.endBattle = function(result) {
        _BattleManager_endBattle.apply(this, arguments);
        $gameMessage._fukidashi = false;
        $gameMessage._popupHeight = 99;
        $gameSystem.setMessagePopupFree(Graphics.boxWidth / 2, Graphics.boxHeight / 2 + 33 * 4);
    };

    //戦闘の中断
    BattleManager.checkAbort = function () {
        if ($gameParty.isEmpty() || this.isAborting()) {
            if (!this._silentAbort) SoundManager.playEscape();
            this._escaped = true;
            this.processAbort();
        }
        return false;
    };
    Game_Interpreter.prototype.command340 = function () {
        BattleManager._silentAbort = true;
        BattleManager.abort();
        return true;
    };

    //報酬
    BattleManager.makeRewards = function () {
        this._rewards = {};
        this._rewards.gold = Math.ceil($gameTroop.goldTotal() * (SceneManager._scene._todomeCount ? 1.2 : 1));
        this._rewards.exp = Math.ceil($gameTroop.expTotal() * (SceneManager._scene._todomeCount ? 1.2 : 1));
        this._rewards.items = $gameTroop.makeDropItems();
    };
    //スキル経験値
    const _BattleManager_gainExp = BattleManager.gainExp;
    BattleManager.gainExp = function () {
        _BattleManager_gainExp.apply(this, arguments);
        SceneManager._scene._numOfSkill.forEach(function(num, skillId) {
            var actor = $gameParty.members().filter(a => a._skills.contains(skillId))[0];
            if (!actor) return;
            var exp = Math.ceil(num * 0.75);
            actor.gainSkillExp(skillId, exp);
        })
    };

    //報酬のセリフ
    BattleManager.displayExp = function () {
        var exp = this._rewards.exp;
        if (exp > 0) {
            var text = TextManager.obtainExp.format(exp, TextManager.exp);
            if (SceneManager._scene._todomeCount) text += ' (×1.2)';
            $gameMessage.add('\\.' + text);
        }
    };
    BattleManager.displayGold = function () {
        var gold = this._rewards.gold;
        if (gold > 0) {
            var text = TextManager.obtainGold.format(gold);
            if (SceneManager._scene._todomeCount) text += ' (×1.2)';
            $gameMessage.add('\\.' + text);
        }
    };

    //倍速機能を戦闘イベントにも
    const _BattleManager_updateEventMain = BattleManager.updateEventMain;
    BattleManager.updateEventMain = function () {
        var value;
        for (let i = 0; i < (SceneManager.isRapid && SceneManager.isRapid() ? 8 : 1); i++) {
            value = _BattleManager_updateEventMain.apply(this, arguments);
        }
        return value;
    };
    
    // -----------------------------------------------------------------------------
    // Sprite_NewBattler
    // -----------------------------------------------------------------------------

    Sprite_NewBattler.prototype = Object.create(Sprite_Enemy.prototype);
    Sprite_NewBattler.prototype.constructor = Sprite_NewBattler;
    window.Sprite_NewBattler = Sprite_NewBattler;
    
    Sprite_NewBattler.prototype.initialize = function(battler) {
        Sprite_Enemy.prototype.initialize.call(this, battler);
        this.z = 3;
        this.scale.x = this.scale.y = 2;
        this._displayMirror = false;
        this._frameSize = 144;
        this._animationType = 0;
        this._animationIndex = 0;
        this._animationFrames = 0;
        this._animationLoop = false;
        this._animationWait = 0;
        this._animationCount = 0;
        this._live2d = null;
        this._actions = [];
        // action.count = 0;
        // action.wait = 0;
        // action.list = null;
        // this._actionMirror = false;
        this._cachesActionWait = [];
    };

    Sprite_NewBattler.prototype.setDisplayMirror = function(mirror) {
        this._displayMirror = !!mirror;
        this.refreshDisplayMirror();
    };

    Sprite_NewBattler.prototype.refreshDisplayMirror = function() {
        var scaleX = Math.abs(this.scale.x);
        this.scale.x = this._displayMirror ? -scaleX : scaleX;
    };

    Sprite_NewBattler.prototype.setAnimation = function(type, loop, wait, duration) {
        if ((this._battler.isDead() && !this._battler.isStateAffected(3)) &&
            (type !== 'wait' && type !== 'dead' && type !== 'smile')) return;
        if (this._live2d) return;
        if (type === '' || type === 'wait') this.setDisplayMirror(false);
        this._animationType = this.getAnimationType(type);
        this._animationIndex = 0;
        this._animationFrames = 1;
        this.updateBitmap();
        var bitmap = this._baseBitmap || this.bitmap;
        if (bitmap) bitmap.addLoadListener(function() {
            this._animationFrames = 0;
            for (var x = 0, y = (this._animationType % 10) * this._frameSize; x < bitmap.width; x += this._frameSize) {
                if (bitmap.getPixel(x + 24, y + 24) === '#ff0000') break;
                this._animationFrames++;
            }
            bitmap.smooth = false;
//            this._yuraInfo = this._animationFrames <= 1 ? [24, 24] : null;
        }.bind(this))
        this._animationLoop = !!loop;
        this._animationWait = wait || 0;
        this._animationDuration = duration || (loop ? 60 : 0);
        this._animationCount = 0;
        this.setFrame(this._animationIndex * this._frameSize, (this._animationType % 10) * this._frameSize, this._frameSize, this._frameSize);
    };
    
    Sprite_NewBattler.prototype.updateFrame = function() {
        if (this._live2d) return;
        if (this._forceFrame) {
            this.bitmap = this._bitmaps[0];
            this._animationType = this._forceFrame[0];
            this.setFrame(this._forceFrame[1] * this._frameSize, this._forceFrame[0] * this._frameSize, this._frameSize, this._frameSize);
            this._yuraInfo = [];
            return;
        } else if (this._yuraInfo && !this._collapsePhase) {
            this._yuraInfo = null;
        }
        if (!this._animationLoop) {
            this._animationIndex = Math.min(Math.floor((this._animationCount / this.animationWait())), this._animationFrames - 1);
            if (this._animationType && Math.floor((this._animationCount / this.animationWait())) >= this._animationFrames) {
                //ループなしで最終フレームへ到達
                if (this._animationCount >= this._animationDuration) return this.setAnimation('', true); //終了
                else if (this._animationDuration === Infinity) { //最終3枚フレームをアニメさせる
                    this._animationIndex = this._animationFrames - 3 + (Math.floor((this._animationCount / this.animationWait())) - this._animationFrames) % 3;
                }
            }
                
        } else { //曲にのる
            if (this._animationType && this._animationCount >= this._animationDuration) return this.setAnimation('', true);
            this._animationIndex = Math.floor(($gameSystem.sceneCount() % (this.animationWait() * this._animationFrames)) / this.animationWait());
        }
        this._animationCount++;
        this.setFrame(this._animationIndex * this._frameSize, (this._animationType % 10) * this._frameSize, this._frameSize, this._frameSize);
    };
    
    Sprite_NewBattler.prototype.animationWait = function() {
        if (this._waitAnimationType === 2 && this._animationType === 0) return $gameSystem.animationWait() / 3 * 2;
        return this._animationWait || $gameSystem.animationWait();
    };
    
    Sprite_NewBattler.prototype.baseOffsetX = function() {
        return 0;
    };
    Sprite_NewBattler.prototype.baseOffsetY = function() {
        return 0;
    };
    
    Sprite_NewBattler.prototype.update = function() {
        Sprite_Enemy.prototype.update.call(this);
        if (this._actions.length) this.updateActions();
        if (this._live2d) this.updateLive2d();

        //シェイク対応
        if (this._shake) {
            this.x += _rand(-this._shake * 2, +this._shake * 2);
            this.y += _rand(-this._shake * 2, +this._shake * 2);
            this._shake--;
        }
        this.refreshDisplayMirror();
    };
    
    Sprite_NewBattler.prototype.updatePosition = function() {
        if (this._noUpdatePosition) return;
        Sprite_Battler.prototype.updatePosition.call(this);
    };
    
    Sprite_NewBattler.prototype.startAction = function (skillId, actionInfo, judgment, buttonSprite) {
        var sk = $dataSkills[skillId];
        var action = {};
        action.skillId = skillId;
        action.info = actionInfo || null;
        action.judgment = judgment || 0;
        action.list = (sk.meta.animation || '').split('\n').filter(function(a) {return a}) || [];
        action.buttonSprite = buttonSprite || null;
        action.count = 0;
        action.wait = 0;
        action.waitRelease = false;
        action.applyList = [];
        action.applied = false;
        action.appliedNum = 0;
        action.test = !!this._actionTest;
        this._actions.push(action);
        this.resetForAction();
        if (!action.test) {
            this.setAnimation('', true);
            if (this._battler.isActor() && SceneManager._scene._numOfSkill)
                SceneManager._scene._numOfSkill[skillId] = (SceneManager._scene._numOfSkill[skillId] || 0) + 1;
        }
        return action;
    };

    Sprite_NewBattler.prototype.resetForAction = function() {
        this._offsetX = this.baseOffsetX(), this._offsetY = this.baseOffsetY();
        this._jumpOffsetY = this._jumpHeight = 0;
        this._targetOffsetX = this._targetOffsetY = NaN;
        this._movementDuration = 0;
        this.rotation = 0, this._targetRotation = NaN, this._rotateDuration = 0;
        this._rotateOffsetX = this._rotateOffsetY = 0;
        if (this._particle) this._particle._params = [];
    };
    
    Sprite_NewBattler.prototype.updateActions = function(forceAction) {
        var deleteList = [];
        var actions = forceAction ? [forceAction] : this._actions;
        actions.forEach((action, index) => {
            //applyList処理（並列apply）
            if (action.applyList.shift()) this.actionApply(action);

            action.count++;
            //wait処理
            if (action.wait > 0) return action.wait--;
            if (!action.list.length && !action.applyList.length) return deleteList.push(action);
            if (!action.list.length) return;
            var bs = action.buttonSprite || null;
            if (action.waitRelease) {
                if ((!bs && action.count < 45) || (bs && bs._pressing)) return;
                else action.waitRelease = false;
            }

            //===
            var data = action.list.shift();
            var args = (data.split(':')[1] || '').split(',').map(function (a) { return Number(a) || Number(a) === 0 ? Number(a) : a });
            var nowAction = (data.split(':')[0] || data).trim();
            var target = this.targetSprite();
            var xRate = this._actionMirror ? -1 : 1;
            var isTest = action.test;
            var isLast = !action.list.length;
            var isMain = index === this._actions.length - 1;

            //x1, y1 = this._homeX + this.baseOffsetX(), this._homeY + this.baseOffsetY()
            //x2, y2 = target._homeX + target.baseOffsetX(), target._homeY + target.baseOffsetY()
            //x = this.x + args[0]
            if (args[1] === 'fitX') {
                var x1 = this._homeX + this.baseOffsetX(), y1 = this._homeY + this.baseOffsetY();
                var x2 = target._homeX + target.baseOffsetX(), y2 = target._homeY + target.baseOffsetY();
                var x = this.x + args[0] * xRate;
                args[1] = y1 + (y2 - y1) * (x - x1) / (x2 - x1) - this.y;
            }

            if (nowAction === 'apply') { //スキル適用
                this.actionApply(action);

            } else if (nowAction === 'setAnime') { //モーション
                if (!isTest && isMain) {
                    if (this._live2d) this._live2d.setAnimation(0, [args[0], 'wait'], 'sequential', 'continue', true);
                    else this.setAnimation(args[0], args[1] === 'true', args[2], args[3]);
                }

            } else if (nowAction === 'setRandomAttackAnime') { //攻撃モーションを範囲内でランダム
                if (!isTest && isMain) {
                    this.setAnimation('attack' + _rand(Number(args[0]), Number(args[1])), args[2] === 'true', args[3], args[4]);
                }

            } else if (nowAction === 'setEasing') { //移動イージングをセット
                if (!isTest && isMain) this._moveEasing = args[0];

            } else if (nowAction === 'mirror') { //表示を左右反転
                if (!isTest && isMain) this.setDisplayMirror(true);

            } else if (nowAction === 'noMirror') { //表示反転を解除
                if (!isTest && isMain) this.setDisplayMirror(false);

            } else if (nowAction === 'move') { //移動
                if (!isTest && isMain) this.startMove(this._offsetX + args[0] * xRate, this._offsetY + args[1], args[2]);
                if (args.contains('wait') || isLast) action.wait = args[2];

            } else if (nowAction === 'moveToTarget') { //ターゲットへ移動
                if (!isTest && isMain) this.startMove(
                    target._homeX + target.baseOffsetX() - this._homeX + args[0] * xRate + this.baseOffsetX(),
                    target._homeY + target.baseOffsetY() - this._homeY + args[1] + this.baseOffsetY(), args[2]
                );
                if (args.contains('wait') || isLast) action.wait = args[2];

            } else if (nowAction === 'moveRandom') { //ランダム移動 (こうもり用)
                while (true) {
                    var tx = _rand(target._homeX + target.baseOffsetX() - this._homeX + 100, this.baseOffsetX());
                    var ty = _rand(34, 272) - this._homeY + this._floatHeight + 100;
                    if (Math.sqrt(Math.pow(tx - this._offsetX, 2) + Math.pow(ty - this._offsetY, 2), 2) > 100) break;
                }
                if (!isTest && isMain) this.startMove(tx, ty, args[0]);
                if (args.contains('wait') || isLast) action.wait = args[0];

            } else if (nowAction === 'back') { //定位置へ
                if (!isTest && isMain) this.startMove(this.baseOffsetX(), this.baseOffsetY(), args[0]);
                if (args.contains('wait') || isLast) action.wait = args[0];

            } else if (nowAction === 'backJump') { //定位置へジャンプ
                if (!isTest && isMain) this.startJump(this.baseOffsetX(), this.baseOffsetY(), args[0], args[1]);
                if (args.contains('wait') || isLast) action.wait = args[0];

            } else if (nowAction === 'jump') { //ジャンプ
                if (!isTest && isMain) this.startJump(
                    this._offsetX - this.baseOffsetX() + args[0] * xRate + this.baseOffsetX(),
                    this._offsetY - this.baseOffsetY() + args[1] + this.baseOffsetY(), args[2], args[3]
                );
                if (args.contains('wait') || isLast) action.wait = args[2];

            } else if (nowAction === 'jumpToTarget') { //ターゲットへジャンプ
                if (!isTest && isMain) this.startJump(
                    target._homeX + target.baseOffsetX() - this._homeX + args[0] * xRate + this.baseOffsetX(),
                    target._homeY + target.baseOffsetY() - this._homeY + args[1] + this.baseOffsetY(), args[2], args[3]
                );
                if (args.contains('wait') || isLast) action.wait = args[2];

            } else if (nowAction === 'rotate') { //回転
                if (!isTest && isMain) this.startRotate(args[0], args[1]);
                if (args.contains('wait') || isLast) action.wait = args[1];

            } else if (nowAction === 'bullet') { //弾発射
                var x = this._homeX + this.baseOffsetX() + args[1];
                var y = this._homeY + this.baseOffsetY() - this.height / 2 * this.scale.y + args[2];
                var tx = target._homeX + target.baseOffsetX() + args[3];
                var ty = target._homeY + target.baseOffsetY() - target.height / 2 * target.scale.y + args[4];
                for (var nArgs = [], i = 6; i <= 8; i++) nArgs[i] = Number(args[i]) || 0;
                if (!isTest) SceneManager._scene.newBullet(args[0], x, y, tx, ty, args[5], nArgs[6], nArgs[7], nArgs[8]);
                if (args.contains('wait') || isLast)
                    action.wait = SceneManager._scene.getBulletWait(args[0], x, y, tx, ty, args[5], nArgs[6], nArgs[7], nArgs[8]);
                if (args.contains('apply')) {
                    var wait = SceneManager._scene.getBulletWait(args[0], x, y, tx, ty, args[5], nArgs[6], nArgs[7], nArgs[8]);
                    action.applyList[wait] = true;
                }

            } else if (nowAction === 'bulletRiv') { //弾発射(逆方向)
                var x = target._homeX + target.baseOffsetX() + args[1];
                var y = target._homeY + target.baseOffsetY() - target.height / 2 * target.scale.y + args[2];
                var tx = this._homeX + this.baseOffsetX() + args[1];
                var ty = this._homeY + this.baseOffsetY() - this.height / 2 * this.scale.y + args[2];
                for (var nArgs = [], i = 6; i <= 8; i++) nArgs[i] = Number(args[i]) || 0;
                if (!isTest) SceneManager._scene.newBullet(args[0], x, y, tx, ty, args[5], nArgs[6], nArgs[7], nArgs[8]);
                if (args.contains('wait') || isLast)
                    action.wait = SceneManager._scene.getBulletWait(args[0], x, y, tx, ty, args[5], nArgs[6], nArgs[7], nArgs[8]);

            } else if (nowAction === 'playSe') { //効果音を再生
                if (!isTest) {
                    $gameSystem.playSe(args[0], args[1] || 80, args[2] || 100);
                }

            } else if (nowAction === 'startAnimation') { //アニメーションを再生
                if (!isTest) {
                    var sp = this.startAnimation($dataAnimations[args[0]]);
                    sp.x = this.x + (args[1] || 0), sp.y = this.y + (args[2] || 0), sp.z = 4;
                    sp._noUpdatePosition = true;
                }
            } else if (nowAction === 'startAnimationTarget') { //ターゲットにアニメーションを再生
                if (!isTest) {
                    var sp = this.startAnimation($dataAnimations[args[0]]);
                    sp.x = target.x + (args[1] || 0), sp.y = target.y + (args[2] || 0), sp.z = 4;
                    sp._noUpdatePosition = true;
                }

            } else if (nowAction === 'particleParam') { //パーティクルを操作
                if (this._particle) this._particle._params = args;

            } else if (nowAction === 'wait') { //ウェイト
                action.wait = args[0];

            } else if (nowAction === 'waitRelease') { //ボタンを離すまでウェイト
                action.waitRelease = true;
            }
        })
        deleteList.forEach(action => this._actions.splice(this._actions.indexOf(action), 1));
    };

    Sprite_NewBattler.prototype.actionApply = function (action) {
        if (this._battler.isActor()) {
            //エネミーダメージ
            var ts = this.targetSprite();
            SceneManager._scene.playDamageAnimation(this, ts, action.skillId, action.judgment);
            SceneManager._scene.applyDamage(this._battler, ts._battler, action.skillId);
            if ((!ts._actions.length || SceneManager._scene._inFinish) && !ts._noDamageAnime) {
                if (SceneManager._scene._inFinish) {
                    ts.resetForAction(), ts._actions = [];
                    ts.setAnimation('damage', false, 6, Infinity);
                } else ts.setAnimation('damage', false, 6);
            }
        } else if (action.info) {
            //アクターダメージ　ガードの結果を待ってから処理
            var button = SceneManager._scene._buttonSprites.filter(function (bs) {
                return bs._info.enemy && bs._info.timing === action.info.timing &&
                    bs._info.applyIndex === action.appliedNum;
            }.bind(this))[0];
            if (button) this.targetSprite().reserveDamaged(button._info);
        }
        if (!action.list.contains('apply') && !action.applyList.length) action.applied = true;
        action.appliedNum++;
    }

    //アクションがapplyされるまでの時間を取得
    Sprite_NewBattler.prototype.getActionWaits = function(skillId) {
        var cachePass = [skillId, this.x, this.y, this.width, this.height];
        var cache = this._cachesActionWait[cachePass];
        if (cache) return cache;
        this._actionTest = true;
        var action = this.startAction(skillId);
        var waits = [0];
        var lastAppliedNum = 0;
        while (action.list.length || !action.applied) {
            this.updateActions(action);
            waits[waits.length - 1]++;
            if (action.appliedNum !== lastAppliedNum) {
                waits.push(waits[waits.length - 1]);
                lastAppliedNum = action.appliedNum;
            }
        }
        waits.pop(); //最後一つ余分になるので消す
        this.resetForAction();
        this._actionTest = false;
        this._cachesActionWait[cachePass] = waits;
        return waits;
    };
    
    Sprite_NewBattler.prototype.setupDamagePopup = function() {
        if (this._battler.isDamagePopupRequested()) {
            if (this._battler.isSpriteVisible()) {
                var sprite = new Sprite_Damage();
                sprite.x = this.x + this.damageOffsetX(), sprite.y = this.y + this.damageOffsetY(), sprite.z = 5;
                sprite.setup(this._battler);
                sprite.scale.x = sprite.scale.y = 0.75;
                this._damages.push(sprite);
                SceneManager._scene._battleContainer.addChild(sprite);
            }
            this._battler.clearDamagePopup();
            this._battler.clearResult();
        }
    };

    //Live2D
    Sprite_NewBattler.prototype.setLive2d = function(name) {
        this._live2dName = name;
        this._live2d = new Game_Live2D();
        var sprite = this._live2dSprite = new Sprite_Live2D(this._live2d);
        this.addChild(sprite);
        this.live2dModel().setAnimation(0, 'wait');
        this._live2d.setScale(0.25, 0.25);
    };
    Sprite_NewBattler.prototype.live2dModel = function () {
        return this._live2d.setModel(this._live2dName);
    };

    Sprite_NewBattler.prototype.updateLive2d = function () {
        var ls = this._live2dSprite;
        if (ls._data && !ls._homeX) {
            ls._homeX = -ls._data.width * this._live2d._scale.x / 2 - 30;
            ls._homeY = -ls._data.height * this._live2d._scale.y;
            this.width = ls._data.width * this._live2d._scale.x;
            this.height = ls._data.height * this._live2d._scale.y * 0.5;
        }
        ls.x = ls._homeX || 0;
        ls.y = ls._homeY || 0;
        this.bitmap = null;
    };
    Sprite_NewBattler.prototype.updateStateSprite = function () {
        this._stateIconSprite.y = -Math.round((this.height + 40) * 0.9);
        if (this._stateIconSprite.y < 20 - this.y) {
            this._stateIconSprite.y = 20 - this.y;
        }
    };

    // -----------------------------------------------------------------------------
    // Sprite_NewActor
    // -----------------------------------------------------------------------------

    Sprite_NewActor.prototype = Object.create(Sprite_NewBattler.prototype);
    Sprite_NewActor.prototype.constructor = Sprite_NewActor;
    window.Sprite_NewActor = Sprite_NewActor;

    Sprite_NewActor.prototype.initialize = function(battler) {
        Sprite_NewBattler.prototype.initialize.call(this, battler);
        this._reservedDamaged = [];
        this._guards = [];
    };
    
    Sprite_NewActor.prototype.setBattler = function(battler) {
        Sprite_Battler.prototype.setBattler.call(this, battler);
        this._stateIconSprite.setup(battler);
    };

    Sprite_NewActor.prototype.updateBitmap = function() {
        var name = this._battler.battlerName();
        if (this._battlerName !== name) {
            this._battlerName = name;
            this._bitmaps = [];
            this._bitmaps[0] = ImageManager.loadSvActor(name);
            this._bitmaps[1] = ImageManager.loadSvActor(name + '_1');
            this._bitmaps[2] = ImageManager.loadSvActor(name + '_2');
            this.setAnimation('', true);
        }
        if (this._bitmaps) this.bitmap = this._bitmaps[Math.floor(this._animationType / 10)];
    };

    Sprite_NewActor.prototype.getAnimationType = function(type) {
        var arr = ['wait', 'guard', 'damage', 'failed', 'win', 'dead', 'run'];
        for (var i = 1; i <= 23; i++) arr.push('attack' + i);
        return Math.max(arr.indexOf(type), 0);
    };
    
    //前進
    Sprite_NewActor.prototype.forward = function() {
        this._forward = true;
        this.startMove(this.baseOffsetX(), this.baseOffsetY(), 8);
    };
    //後退
    Sprite_NewActor.prototype.backward = function() {
        this._forward = false;
        this.startMove(0, 0, 8);
    };
    
    Sprite_NewActor.prototype.baseOffsetX = function() {
        return this._forward ? Graphics.boxWidth / 3 - this._homeX : 0;
    };
    Sprite_NewActor.prototype.baseOffsetY = function() {
        return this._forward ? Graphics.boxHeight / 2 - this._homeY : 0;
    };
    
    Sprite_NewActor.prototype.targetSprite = function() {
        return SceneManager._scene.targetEnemySprite();
    };
    
    //ダメージを受ける予約（判定後に実際にダメージ）
    Sprite_NewActor.prototype.reserveDamaged = function(info) {
        this._reservedDamaged.push({info : info});
    };
    
    Sprite_NewActor.prototype.update = function() {
        Sprite_NewBattler.prototype.update.call(this);

        //ダメージを受ける予約を判定・実行
        var deleteList = [];
        var doList = this._reservedDamaged.filter(function(damage, i) {
            if (this._guards.some(function (guard, j) {
                if (guard.info === damage.info) {
                    damage.result = guard.result;
                    deleteList.push(guard)
                    return true;
                }
            }.bind(this))) return true;
        }.bind(this))
        deleteList.forEach(guard => this._guards.splice(this._guards.indexOf(guard), 1));
        doList.forEach(function(damage) {
            var evaded = false;
            if (this._battler.isAlive()) {
                if (damage.result < 2) {
                    this._battler.addState(2);
                    this._battler._guardType = damage.result;
                    $gameSystem.playSe(!damage.result ? 'Sword2' : '00_guard');
                    this.startAction(2);
                    this.setAnimation('guard', false, 6, 30);
                    if (this._battler.metaState('gainHpRateGuard')) {
                        _timeOut(() => {
                            var value = Math.ceil(this._battler.mhp * this._battler.metaStateValue('gainHpRateGuard') / 100);
                            SceneManager._scene.actorGainHp(this._battler, value);
                        }, 6)
                    }
                } else {
                    if (this._battler.metaState('evasionRate') &&
                        Math.random() < this._battler.metaStateValue('evasionRate') / 100) { //回避
                        $gameSystem.playSe('Evasion1');
                        $gameSystem.playSe('Jump1', 70, 120);
                        this.startAction(3);
                        evaded = true;
                    } else {
                        if (this._actions.length) this.resetForAction();
                        this.setAnimation('damage', false, 6);
                    }
                }
            }
            if (this._battler.isAlive()) {
                var sp = SceneManager._scene._enemySprites.filter(function (esp) { return esp._battler === damage.info.enemy })[0];
                if (!evaded) {
                    SceneManager._scene.playDamageAnimation(damage.info.enemy, this, damage.info.skillId, damage.result);
                    SceneManager._scene.applyDamage(damage.info.enemy, this._battler, damage.info.skillId);
                }
                this._battler.removeState(2);
            }
            this._reservedDamaged.splice(this._reservedDamaged.indexOf(damage), 1);
            if (this._battler.isDead() && this._animationType !== this.getAnimationType('dead')) {
                this.setAnimation('dead', true, 10, Infinity);
                var sp = this.startAnimation($dataAnimations[41 + this._battler._actorId - 2]);
                sp.x = sp._ox = this.x, sp.y = this.y - 50;
                sp._noUpdatePosition = true, sp.__count = 0;
                sp.setMaskRect(0, sp.y - 70, Graphics.boxWidth, Graphics.boxHeight - (sp.y - 70));
                sp.update = function() {
                    Sprite_Animation.prototype.update.apply(this, arguments);
                    if (sp.__count % 2 === 0)
                        sp.x = sp._ox + 12 * Math.sin(sp.__count / 10), sp.y -= 2.4;
                    sp.__count++;
                }
            }
        }.bind(this))
    };
    
    Sprite_NewActor.prototype.damageOffsetX = function() {
        return 0;
    };
    Sprite_NewActor.prototype.damageOffsetY = function() {
        return -32;
    };

    // -----------------------------------------------------------------------------
    // Sprite_NewEnemy
    // -----------------------------------------------------------------------------

    Sprite_NewEnemy.prototype = Object.create(Sprite_NewBattler.prototype);
    Sprite_NewEnemy.prototype.constructor = Sprite_NewEnemy;
    window.Sprite_NewEnemy = Sprite_NewEnemy;

    Sprite_NewEnemy.prototype.initialize = function(battler) {
        Sprite_NewBattler.prototype.initialize.call(this, battler);
        let meta = battler.enemy().meta;
        this._frameSize = Number(meta.frameSize) || 144;
        this._floatHeight = Number(meta.float) || 0;
        this._actionMirror = true;
        this._turnActions = [];
        this._waitAnimationType = Number(meta.waitAnimationType) || 1;
        this._changeTurns = Number(meta.changeTurns) || Infinity;
        if (meta.mii) {
            $gameSwitches.setValue(17, true); //攻撃しないフラグON
        }
        if (meta.live2d) {
            this.setLive2d(meta.live2d);
        }
    };
    
    Sprite_NewEnemy.prototype.targetSprite = function() {
        return SceneManager._scene.turnActorSprite();
    };
    
    Sprite_NewEnemy.prototype.updateBitmap = function() {
        var name = this._battler.battlerName();
        if (this._battlerName !== name) {
            this._battlerName = name;
            this.bitmap = ImageManager.loadSvEnemy(name);
            this.setAnimation('', true);
        }
    };
    
    Sprite_NewEnemy.prototype.getAnimationType = function(type) {
        return Math.max(['wait', 'damage', 'smile', 'attack1', 'attack2', 'attack3', 'attack4', 'attack5'].indexOf(type), 0);
    };

    Sprite_NewEnemy.prototype.update = function() {
        Sprite_NewBattler.prototype.update.call(this);
        if (this._battler.isAlive() && !SceneManager._scene._inFinish && !this._dummy) {
            if (SceneManager._scene.isBattleActive() && !$gameSwitches.value(16)) {
                //アクション開始処理
                this._turnActions.forEach(function(action) {
                    if (!action.did && action.turn === SceneManager._scene._turn &&
                        SceneManager._scene.progress() >= action.timing && !action.isChild) {
                        action.did = true;
                        this.startAction(action.skillId, action);
                    }
                }.bind(this))
                //固有行動
                if (this._battler.enemy().meta.osamu) this.updateOsamu();
            }
        }

        //パーティクル
        if (this._battler.enemy().meta.particle) {
            var info = this._battler.enemy().meta.particle.split(',');
            if (!this._setParticle) {
                this._particle = new Sprite_Particle(info[0]);
                this._particle.z = 3;
                SceneManager._scene._battleContainer.addChild(this._particle);
                this._setParticle = true;
            }
            if (this._particle) {
                this._particle.x = this.x + Number(info[1]), this._particle.y = this.y + Number(info[2]);
            }
        }
    };

    //死亡演出
    Sprite_NewEnemy.prototype.startCollapse = function() {
        if (this._battler.enemy().meta.specialCollapse) {
            this.resetForAction();
            this.setAnimation('smile', false, 0, Infinity);
            this._appeared = false;
            return;
        }

        this._effectDuration = 150;
        this._maxEffectDuration = this._effectDuration;
        this._appeared = false;

        this._collapsePhase = 'up';
        const baseAngle = -90;
        const angleOffset = 9;
        const rad = (baseAngle + angleOffset) * Math.PI / 180;
        this._collapseDirX = Math.cos(rad);
        this._collapseDirY = Math.sin(rad);
        this._collapseRotSpeed = (Math.randomInt(2) * 2 - 1) * 0.5 + (Math.random() - 0.5) * 0.2;
        this.resetForAction();
        this.updatePosition();
        this._collapseOriginX = this.x;
        this._collapseOriginY = this.y;
        if (this._yuraInfo) {
            this._yuraInfo = null;
            var f = JSON.parse(JSON.stringify(this._frame));
            this.bitmap = this._baseBitmap, this._baseBitmap = null;
            this.setFrame(f.x, f.y, f.width, f.height);
        }

        this.anchor.y = 0.5;
        this._noUpdatePosition = true;
        this.x = this._homeX, this.y = this._homeY - this.height / 2 * this.scale.y;

        this.setAnimation('', true);
        if (this._particle) this._particle.end();
        
        //撃破アニメーション
        var sp = this.startAnimation($dataAnimations[14]);
        sp.x = this.x, sp.y = this.y; // + this._floatHeight;
        sp.z = 3;
        sp._noUpdatePosition = true;
    };

    Sprite_NewEnemy.prototype.updateCollapse = function() {
        if (this._collapsePhase === 'up') {
            const speed = 24;
            this.x += this._collapseDirX * speed;
            this.y += this._collapseDirY * speed;
            this.rotation += this._collapseRotSpeed;
            if (this.y < -100) {
                this._collapsePhase = 'fall';
                this.x = this._collapseOriginX + this._collapseDirX * 400;
                this.y = -30;
                this.__a = this._effectDuration;
                this._yuraInfo = [];
                this._particle = new Sprite_Particle('collapseSmog');
                this.addChild(this._particle);
            }
        } else if (this._collapsePhase === 'fall') {
            const t = this._effectDuration;
            const total = this._maxEffectDuration;
            const speed = 4;

            this.x += this._collapseDirX * speed;
            this.y -= this._collapseDirY * speed * (1 - t / total) * 0.5;
            this.rotation += this._collapseRotSpeed;
            if (t < this.__a - 1) {
                this.scale.x = this.scale.y = 0.2 + t / total * 0.4;
                this.setOutline(Math.ceil(5 - t / total));
            }

            if (t === 1) {
                this._collapsePhase = 'smile';
                this._effectDuration = 140;
                this.scale.x = this.scale.y = 2.8;
                this.rotation = 0;
                this.opacity = 0;

                //キラーンアニメーション
                var sp = this.startAnimation($dataAnimations[6]);
                sp.x = this.x, sp.y = this.y;
                sp._noUpdatePosition = true;
                $gameSystem.playSe('00_kiran')

                this.setAnimation('smile', true, 0);
                this.setOutline(0);
                this.z = 1;
                this._particle.end(), this._particle = null;
            }
        } else if (this._collapsePhase === 'smile') {
            var d = this._effectDuration;
            if (d === 100) {
                var index = $gameTroop._enemies.indexOf(this._battler), len = $gameTroop._enemies.length;
                var w = 120;
                this.x = 580 + (0.5 - len / 2 + index) * w;
                this.y = 96 + 12 * (index % 2 ? 1 : -1);
            }
            if (d <= 100 && d >= 40) this.opacity = (100 - d) / 60 * 128;
            if (d < 40) this.opacity =  128;
            if (SceneManager._scene._inTodome) this.opacity = 0;
            if (d === 1 || d === 40 || d === 80) {
                //キラキラアニメーション
                var sp = this.startAnimation($dataAnimations[6]);
                sp.z = 1;
                sp._rate = 8, sp.setupDuration();
                var rad = Math.randomInt(360) / 180 * Math.PI;
                sp._addX = 0.2 * this.width  * this.scale.x * Math.sin(rad) * _rand(80, 100) / 100;
                sp._addY = 0.2 * this.height * this.scale.y * Math.cos(rad) * _rand(80, 100) / 100;
                sp._scale = _rand(50, 80) / 100, sp.opacity = this.opacity;
                if (d === 1) this._effectDuration = _rand(10, 40);
                this.setAnimation('smile', true, 0);
            }
        }
    };

    Sprite_NewEnemy.prototype.damageOffsetX = function() {
        return 0;
    };
    Sprite_NewEnemy.prototype.damageOffsetY = function() {
        return -32;
    };

    // -----------------------------------------------------------------------------
    // 細かいやつ
    // -----------------------------------------------------------------------------
    
    //ダメージ計算
    Game_Action.prototype.evalDamageFormula = function(target) {
        try {
            var item = this.item();
            var a = this.subject(), b = target;
            var v = $gameVariables._data;
            var dam = function() { //基本ダメージ
                return Math.ceil(a.atk / b.def * 5 + 2) * (b.isActor() ? 1.5 : 0.5);
            }
            var damA = function (power) { //アクター攻撃ダメージ
                power += a.skillLevel(item.id) - 1;
                var value = dam() * power / 5 + Math.sqrt(power);
                value *= 1 + (SceneManager._scene._combo / 100);
                return value;
            }
            var sign = ([3, 4].contains(item.damage.type) ? -1 : 1);
            var value = Math.max(eval(item.damage.formula), 0) * sign;
            if (isNaN(value)) value = 0;
            return value;
        } catch (e) {
            return 0;
        }
    };
    
    //ガード比率を計算
    Game_Action.prototype.applyGuard = function(damage, target) {
        return damage * (target.isGuard() ? [0, 0.5][target._guardType] : 1);
    };
    
    //戦闘テスト用設定
    DataManager.setupBattleTest = function() {
        this.createGameObjects();
        $gameParty.setupBattleTest();
        BattleManager.setup($dataSystem.testTroopId, true, false);
        BattleManager.setBattleTest(true);
    };
    
    //エンカウントメッセージ
    BattleManager.displayStartMessages = function() {
        $gameTroop.enemyNames().forEach(function(name, i) {
            var text = TextManager.emerge.format(name);
            if (i === $gameTroop.enemyNames().length - 1) text += '\\|\\.\\.\\^'
            $gameMessage.add(text);
        });
    };

    //戦闘終了時処理
    Game_Actor.prototype.onBattleEnd = function () {
        Game_Battler.prototype.onBattleEnd.apply(this, arguments);
        if (this.metaState('gainHpBattleEnd')) {
            var value = Math.floor(this.mhp * this.metaStateValue('gainHpBattleEnd') / 100);
            this.gainHp(value);
        }
    };

    //ダメージスプライト
    Sprite_Damage.prototype.setup = function (target) {
        var result = target.result();
        if (result.missed || result.evaded) {
            this.createMiss();
        } else if (result.hpAffected) {
            this.createDigits(target.isActor() ? 1 : 0, result.hpDamage);
        }
        if (result.critical) {
            this.setupCriticalEffect();
        }
    };

    const _Sprite_Damage_updateChild = Sprite_Damage.prototype.updateChild;
    Sprite_Damage.prototype.updateChild = function (sprite) {
        if (this._isTotal) {
            if (this._duration > this._total_maxDuration - 90) {
                var a = 0.3;
                sprite.ry2 = sprite.ry2 || (sprite.ry * a);
                sprite.dy += 0.7;
                sprite.ry += sprite.dy;
                sprite.ry2 += sprite.dy * a;
                if (sprite.ry >= 0) {
                    sprite.ry = sprite.ry2 = 0;
                    sprite.dy *= -0.8;
                }
                sprite.x = Math.round(sprite.rx);
                sprite.y = Math.round(sprite.ry2);
            }
            this._duration = Math.max(this._duration, 10);
        } else {
            _Sprite_Damage_updateChild.apply(this, arguments);
        }
    };

    // -----------------------------------------------------------------------------
    // Sprite_Bullet
    // -----------------------------------------------------------------------------

    Sprite_Bullet.prototype             = Object.create(Sprite_Base.prototype);
    Sprite_Bullet.prototype.constructor = Sprite_Bullet;

    Sprite_Bullet.prototype.initialize = function(image, x, y, tx, ty, moveType, param1, param2, param3) {
        Sprite_Base.prototype.initialize.call(this);
        this.x = x, this.y = y;
        this._ox = x, this._oy = y; //開始座標
        this._tx = tx, this._ty = ty; //ターゲット座標
        this._count = 0;
        this.anchor.x = this.anchor.y = 0.5;
        this._moveType = moveType;
        this._moveParam1 = param1;
        this._moveParam2 = param2;
        this._moveParam3 = param3;
        this.setupBitmap(image);
    };

    Sprite_Bullet.prototype.setupBitmap = function(imageName) {
        var bmp  = ImageManager.loadBitmap('img/bullets/', imageName);
        this.bitmap = bmp;
        if (imageName === 'arrow') this._frames = 1, this._frameCount = 8, this._autoRotation = true;
        else if (imageName === 'laser') this._frames = 3, this._frameCount = 6, this._autoRotation = true, this._laser = true;
        else if (imageName === 'bowling') this._frames = 6, this._frameCount = 6;
        else if (imageName === 'pigBreath') this._frames = 6, this._frameCount = 8;
        else if (imageName === 'biribiri') this._frames = 6, this._frameCount = 6, this._moveParam3 = Math.randomInt(360);
        else if (imageName === 'hikidashi') this._frames = 3, this._frameCount = 8, this._autoRotation = true;
        else if (imageName === 'flagShot') this._frames = 4, this._frameCount = 3, this._autoRotation = true;
        else                                this._frames = 3, this._frameCount = 8;

        if (this.bitmap.isReady()) {
            var w = this.bitmap.width, h = this.bitmap.height;
            var fw = Math.floor(w / this._frames), fh = Math.floor(h / 2);
            var index = Math.floor(this._count / this._frameCount) % this._frames;
            this.setFrame(index * fw, 0, fw, fh);
        }
    };

    Sprite_Bullet.prototype.setTest = function () {
        this.bitmap = new Bitmap(1, 1);
        this._test = true;
    }
    
    Sprite_Bullet.prototype.update = function() {
        Sprite_Base.prototype.update.call(this);
        
        //画像更新
        if (this.bitmap.isReady() && !this._test) {
            var w = this.bitmap.width, h = this.bitmap.height;
            var fw = Math.floor(w / this._frames), fh = Math.floor(h / 2);
            var index = Math.floor(this._count / this._frameCount) % this._frames;
            this.setFrame(index * fw, this._finish ? fh : 0, fw, fh);
            if (this._laser) this.updateLaser();
        }
        
        if (this._finish === 1) { //消滅更新
            if (this._count >= this._frameCount * this._frames) {
                this._finish = 2;
                this.visible = false;
                if (this._laser) while (this._laserTrail.length) {
                    var old = this._laserTrail.shift();
                    if (old && old.parent) old.parent.removeChild(old);
                }
            }
            
        } else if (!this._finish) {
            //移動更新
            if (this._moveType === 'straight') { //直線移動 <param1 : 速度 param2 : 回転>
                var dx = this._tx - this._ox, dy = this._ty - this._oy;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var nx = dx / dist, ny = dy / dist;
                var moveDistance = this._moveParam1 * this._count * 3;
                this.x = Math.round((this._ox + nx * moveDistance) * 100) / 100;
                this.y = Math.round((this._oy + ny * moveDistance) * 100) / 100;
                this.rotation = Math.floor(this._count / this._frameCount) * this._moveParam2 / 180 * Math.PI;
                
            } else if (this._moveType === 'parabola') { //放物線移動 <param1 : 速度 param2 : 山の高さ param3 : 回転>
                var dx = this._tx - this._ox, dy = this._ty - this._oy;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var nx = dx / dist, ny = dy / dist;
                var moveDistance = this._moveParam1 * this._count * 3;
                var baseX = this._ox + nx * moveDistance, baseY = this._oy + ny * moveDistance;
                var t = moveDistance / dist;
                var height = 4 * this._moveParam2 * t * (1 - t);
                this.x = Math.round(baseX * 100) / 100, this.y = Math.round((baseY + height) * 100) / 100;
                this.rotation = Math.floor(this._count / this._frameCount) * this._moveParam3 / 180 * Math.PI;
            }
            if (this._autoRotation) {  // 進行方向に合わせて自動回転
                if (this._prevX !== undefined) {
                    var vx = this.x - this._prevX;
                    var vy = this.y - this._prevY;
                    if (vx !== 0 || vy !== 0) this.rotation = Math.atan2(vy, vx); // 0rad＝右向き
                }
                this._prevX = this.x;
                this._prevY = this.y;
            }
            if (moveDistance >= dist) { //到達
                this.x = this._tx;
                this.y = this._ty;
                this._finish = 1;
                this._count = 0;
            }
        }
        
        this._count++;
    };

    //レーザー軌跡表示
    var laserChildNum = 20;
    var laserInterval = 1;      // 2～3あたりが見栄え良い
    var laserLife = 20;         // 白丸が縮みきるフレーム数（お好みで調整）

    Sprite_Bullet.prototype.updateLaser = function () {
        // 初期化：配列と共通ビットマップ（白丸）
        if (!this._laserTrail) this._laserTrail = [];
        if (!Sprite_Bullet._trailBitmap) {
            var r = 20, d = r * 2;
            var bmp = new Bitmap(d, d);
            var ctx = bmp._context;
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(r, r, r, r / 2, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.restore();
            bmp._setDirty();
            Sprite_Bullet._trailBitmap = bmp; // 使い回し
        }

        // 一定間隔で白丸を設置（親に直付けして「追従しない」ようにする）
        if (this.parent && this._count % laserInterval === 0 && !this._finish) {
            var dot = new Sprite(Sprite_Bullet._trailBitmap);
            dot.anchor.x = dot.anchor.y = 0.5;
            dot.x = this.x;
            dot.y = this.y;
            dot.z = this.z;
            dot.scale.x = dot.scale.y = 1.0;
            dot.rotation = this.rotation;
            dot._life = laserLife; // 寿命（残りフレーム）
            this.parent.addChild(dot);
            this._laserTrail.push(dot);

            // 個数制限（古いものから削除）
            while (this._laserTrail.length > laserChildNum) {
                var old = this._laserTrail.shift();
                if (old && old.parent) old.parent.removeChild(old);
            }
        }

        // 既存白丸の更新（縮小→消滅）
        for (var i = this._laserTrail.length - 1; i >= 0; i--) {
            var s = this._laserTrail[i];
            if (!s) continue;

            s._life--;
            var t = Math.max(0, s._life) / laserLife; // 1→0
            s.scale.x = s.scale.y = t;

            if (s._life <= 4) {
                if (s.parent) s.parent.removeChild(s);
                this._laserTrail.splice(i, 1);
            }
        }
    };

    // -----------------------------------------------------------------------------
    // レベルアップ演出
    // -----------------------------------------------------------------------------

    var levelUpDisplayY = 280;

    //レベルアップ演出用
    const _Game_Actor_changeExp = Game_Actor.prototype.changeExp;
    Game_Actor.prototype.changeExp = function (exp, show) {
        this._lastInfoLevelUp = {
            lastLv : this._level,
            lastParams : [this.mhp, this.atk, this.def]
        }
        _Game_Actor_changeExp.apply(this, arguments);
        this._lastInfoLevelUp = null;
    };
    Game_Actor.prototype.displayLevelUp = function (newSkills) {
        $gameTemp._lvUpInfos = $gameTemp._lvUpInfos || [];
        var info = { actor: this, lastLv: this._lastInfoLevelUp.lastLv,
            lastParams: this._lastInfoLevelUp.lastParams, newSkills: newSkills };
        $gameTemp._lvUpInfos.push(info);
    };
    Game_Interpreter.prototype.command_displayLevelUp = function (process) {
        var scene = SceneManager._scene;
        var info = this.__info;
        if (!process) {
            info = this.__info = $gameTemp._lvUpInfos.shift();
            if (!$gameTemp._lvUpInfos.length) $gameTemp._lvUpInfos = null;
            var sp = scene._actorSprites.filter(asp => asp._battler === info.actor)[0];
            sp.startMove(Graphics.boxWidth / 2 - sp._homeX, levelUpDisplayY - sp._homeY, 10);
        } else if (process === 1) {
            //決めポーズ
            var sp = scene._actorSprites.filter(asp => asp._battler === info.actor)[0];
            sp.setAnimation('win', false, 0, Infinity)
            //スポットライト
            scene._levelUpLightSprite.visible = true;
        } else if (process === 2) {
            //LevelUp!の文字
            var lts = scene._levelUpTextSprite;
            lts.visible = true;
            lts.y = lts._baseY;
            SceneManager.setEasing(lts, 'y', 'easeOutBack', lts.y, lts.y - 24, 30);
            //便利変数へ代入
            $gameVariables.setValue(3, info.actor.name());
            $gameVariables.setValue(4, info.actor.level);
            $gameSystem.setMessagePopupFree(Graphics.boxWidth / 2, Graphics.boxHeight / 2 + 33 * 5);
        } else if (process === 3) {
            //能力増減ウィンドウ
            var w = 200, h = 33 * 3 + 48;
            var wd = scene._levelUpParamsWindow = new Window_Base(Graphics.boxWidth / 2, 430 - h, w, h);
            wd.openness = 0, wd.open();
            [0, 2, 3].forEach((paramId, i) => {
                wd.drawText(TextManager.param(paramId), 8, 8 + i * 33, wd.contents.width - 16, 'left');
                var plus = info.actor.param(paramId) - info.lastParams[i];
                var text = (plus > 0 ? '+' : plus < 0 ? '' : '±') + plus;
                wd.drawText(text, 8, 8 + i * 33, wd.contents.width - 16, 'right');
            })
            scene.addWindow(wd);
        } else if (process === 4) {
            scene._windowLayer.removeChild(scene._levelUpParamsWindow);
            scene._levelUpParamsWindow = null;
        } else if (process === 5) {
            var skill = info.newSkills[0];
            $gameVariables.setValue(3, info.actor.name());
            $gameVariables.setValue(4, Window_Base.prototype.getSkillNameText.call(this, skill));
        } else if (process === 6) {
            var skill = info.newSkills[0];
            //スキル説明ウィンドウ
            var wd = scene._helpWindow = new Window_Help(2);
            wd.x = (Graphics.boxWidth - wd.width) / 2, wd.y = (Graphics.boxHeight - wd.height) / 2 - 3;
            wd.setItem(skill);
            wd.openness = 0, wd.open();
            scene.addWindow(wd);
        } else if (process === 7) {
            scene._windowLayer.removeChild(scene._helpWindow);
            scene._helpWindow = null;
            info.newSkills.shift();
        } else if (process === 99) {
            scene._levelUpTextSprite.visible = false;
            if ($gameTemp._lvUpInfos || $gameTemp._itemRewards) {
                scene._levelUpLightSprite.visible = false;
                var sp = scene._actorSprites.filter(asp => asp._battler === info.actor)[0];
                sp.startMove(sp.baseOffsetX(), sp.baseOffsetY(), 10);
            }
        }
    };

    // -----------------------------------------------------------------------------
    // ドロップアイテム演出
    // -----------------------------------------------------------------------------

    BattleManager.displayDropItems = function () {
        var items = this._rewards.items;
        $gameTemp._itemRewards = items.length ? items : null;
    };
    Game_Interpreter.prototype.command_displayDropItems = function (process) {
        var scene = SceneManager._scene;
        var items = $gameTemp._itemRewards;
        var as = scene.turnActorSprite();
        if (!process) {
            //アイテム落とす
            var dis = scene._dropItemSprites = [];
            items.forEach((item, i) => {
                var pd = window.KNH_PlayerDrawing;
                var imageInfo = pd && pd.itemImageInfo ? pd.itemImageInfo(item) : null;
                if (!imageInfo && item.meta.image) {
                    var legacyImageInfo = item.meta.image.split(',');
                    imageInfo = { name: legacyImageInfo[0] || '', index: Number(legacyImageInfo[1] || 0) };
                }
                var its = new Sprite_Base();
                its.anchor = new Point(0.5, 0.5), its.z = 4, its._yuraInfo = [], its.scale.x = its.scale.y = 0.6;
                its.bitmap = pd && pd.loadItemImageBitmap ? pd.loadItemImageBitmap(imageInfo) : ImageManager.loadItem(imageInfo ? imageInfo.name || '' : '');
                its.bitmap.addLoadListener(() => {
                    const imageIndex = Number(imageInfo && imageInfo.index || 0);
                    const frame = pd && pd.itemImageFrame ? pd.itemImageFrame(its.bitmap, imageInfo) : {
                        x: (imageIndex % 4) * (its.bitmap.width / 4),
                        y: Math.floor(imageIndex / 4) * (its.bitmap.height / 2),
                        width: its.bitmap.width / 4,
                        height: its.bitmap.height / 2
                    };
                    its.setFrame(frame.x, frame.y, frame.width, frame.height);
                    its.setOutline(1, 2);
                })
                its.x = 450 + 50 * i + _rand(-20, 20), its.y = _rand(180, 250);
                its.opacity = 0;
                _timeOut(function(its) {
                    its.opacity = 255;
                    SceneManager.setEasing(its, 'y', 'easeInBack', its.y - 24, its.y, 10);
                    SceneManager.setEasing(its.scale, 'x', 'easeInOutBack', 0.5, 0.6, 10);
                    SceneManager.setEasing(its.scale, 'y', 'easeInOutBack', 0.7, 0.6, 10);
                    $gameSystem.playSe('01_Item', 90, _rand(110, 125))
                }.bind(this, its), i * 9);
                dis.push(its);
                scene._battleContainer.addChild(its);
            })
            $gameVariables.setValue(3, ($gameTroop.members().length > 1 ? _tl('%1たち') : '%1').format($gameTroop.members()[0].name()));
        } else if (process === 1) {
            //アイテムを入手
            var its = scene._dropItemSprites[0];
            as._forceFrame = [1, 3];
            its.x = as.x, its.y = as.y - 180;
        } else if (process === 2) {
            //説明を表示
            this.displayItemInfo(this.__item, 0, 250)
        } else if (process === 3) {
            //アイテムを消す
            var its = scene._dropItemSprites.shift();
            var sp = as.startAnimation($dataAnimations[16]);
            sp.x = its.x, sp.y = its.y + 30;
            sp._noUpdatePosition = true;
            if (scene._dropItemSprites.length) {
                as._forceFrame = null;
                as.setAnimation('', true);
            }
            scene._battleContainer.removeChild(its);
        }
    };

    // -----------------------------------------------------------------------------
    // QTE演出
    // -----------------------------------------------------------------------------

    Game_Interpreter.prototype.command_startQTE = function () {
        var scene = SceneManager._scene;
        scene._data = [];
        var actor = $gameParty.members()[this._turnActorIndex];
        scene._data[32] = {
            button: 'A', actor: actor, skillId: 0, size: 2,
            length: 1, long: false, rush: false
        };
        scene.refreshData();
        scene._qte = true;
        scene._qteCount = 0;
        this.wait(Math.ceil(scene.maxCount() / 4) - 6);
        this.setWaitMode('ok');
    };


    // -----------------------------------------------------------------------------
    // 個別演出
    // -----------------------------------------------------------------------------

    //おさむ　岩配置
    Scene_NewBattle.prototype.putOsamuRock = function (size) {
        this._rockSprites = this._rockSprites || [];
        var bar = this._barSprite;
        for (var a = [24, 20, 16, 0][size], pos, i = 0; i < 100; i++) { //位置を決める
            pos = 64 / 2 + _rand(-a, a);
            if (!this._rockSprites.length ||
                this._rockSprites.every(rs => !rs.opacity || Math.abs(rs._pos - pos) > [4, 6, 8, 16][size] * 2)) break;
        }
        var tx = pos / 64 * bar.width;
        var rs = new Sprite_Base();
        rs.anchor = new Point(0.5, 0.5);
        rs.bitmap = ImageManager.loadBitmap('img/bullets/', 'osamuBattleRock');
        rs.bitmap.addLoadListener(function (rs, size) {
            rs._yuraInfo = [];
            var es = this.targetEnemySprite(); //おさむのスプライト
            rs.x = es.x - bar.x, rs.y = es.y - rs.height / 8 - bar.y;
            var w = rs.bitmap.width / 2;
            if (size < 3) rs.setFrame(Math.randomInt(2) * w, size * w, w, w);
            else rs.setFrame(0, 3 * w, 2 * w, 2 * w);
            //以下、岩を放り投げて配置するアニメ
            var d = 60;
            SceneManager.setEasing(rs, 'x', 'linear', rs.x, tx, d);
            SceneManager.setEasing(rs, 'y', 'easeOutCubic', rs.y, -rs.height * 2 - bar.y, d / 2);
            rs._throw = {
                count: 0,
                duration: d,
                half: d / 2,
                tx: tx,
                endY: bar.height / 2,
                size: size,
                falling: false
            };
        }.bind(this, rs, size))
        rs._size = size, rs._pos = pos;
        rs._hp = rs._mhp = [3, 5, 10, 30][size];
        bar.addChild(rs);
        this._rockSprites.push(rs);
    };
    //岩にダメージ progress = 0～63
    Scene_NewBattle.prototype.damageOsamuRock = function (progress, noJudge) {
        var rs = this.inOsamuRock(progress);
        rs._hp--;
        if (rs._hp <= 0) { //破壊
            //岩に接するボタンをすべて判定GOD
            if (!noJudge) this._buttonSprites.forEach(bs => {
                if (!bs._judged && bs._info.button !== 'B' && this.inOsamuRock(bs._index) === rs)
                    this.showJudgeResult(bs, 0);
            })
            this.crashOsamuRock(rs);

        } else { //ダメージ
            rs._shake = 1 + 2 * (1 - rs._hp / rs._mhp);
            $gameSystem.playSe('Earth3');
        }
    };
    //岩を破壊
    Scene_NewBattle.prototype.crashOsamuRock = function (rs) {
        var sp = rs.startAnimation($dataAnimations[rs._size < 1 ? 24 : 28], !!Math.randomInt(2));
        sp.x = rs.x, sp.y = rs.y, sp.scale.x = sp.scale.y = [1, 0.75, 1, 2][rs._size];
        sp._rate = [6, 6, 7, 8][rs._size], sp.setupDuration();
        sp._noUpdatePosition = true;
        $gameSystem.playSe('Earth1');
        rs.opacity = 0;
        rs._crashCountdown = 120;
        $gameSwitches.setValue(12, true); //フラグ
    };
    //全岩を破壊
    Scene_NewBattle.prototype.crashAllOsamuRock = function () {
        if (this._rockSprites) this._rockSprites.forEach(rs => this.crashOsamuRock(rs));
    };
    //岩更新
    Scene_NewBattle.prototype.updateOsamuRock = function () {
        if (!this._rockSprites) return;
        for (var i = this._rockSprites.length - 1; i >= 0; i--) {
            var rs = this._rockSprites[i];
            if (rs._throw) {
                rs._throw.count++;
                if (!rs._throw.falling && rs._throw.count >= rs._throw.half) {
                    rs._throw.falling = true;
                    SceneManager.setEasing(rs, 'y', 'easeInCubic', rs.y, rs._throw.endY, rs._throw.half);
                }
                if (rs._throw.count >= rs._throw.duration) {
                    rs._baseX = rs._throw.tx;
                    rs._baseY = rs._throw.endY;
                    rs._put = true;
                    var size = rs._throw.size;
                    var sp = rs.startAnimation($dataAnimations[size < 1 ? 23 : 27], !!Math.randomInt(2));
                    sp.x = rs._baseX, sp.y = rs._baseY, sp.scale.x = sp.scale.y = [1, 0.75, 1, 2][size];
                    sp._rate = [6, 7, 8, 12][size], sp.setupDuration();
                    sp._noUpdatePosition = true;
                    $gameScreen.startShake([6, 6, 7, 9][size], 5, 20);
                    $gameSystem.playSe('Earth5');
                    if (size >= 3) $gameSystem.playSe('Earth1', 80, 60);
                    rs._throw = null;
                }
            }
            if (rs._crashCountdown !== undefined) {
                rs._crashCountdown--;
                if (rs._crashCountdown <= 0) {
                    this._rockSprites.splice(i, 1);
                    if (rs.parent) this._barSprite.removeChild(rs);
                    continue;
                }
            }
            if (rs._baseX) {
                rs.x = rs._baseX, rs.y = rs._baseY;
                rs._shake > 0 ? rs._shake -= 0.2 : rs._shake = 0;
                if (rs._shake) {
                    rs.x += _rand(-rs._shake * 2, +rs._shake * 2);
                    rs.y += _rand(-rs._shake * 2, +rs._shake * 2);
                }
            }
        }
    };
    Scene_NewBattle.prototype.inOsamuRock = function (progress) {
        if (!this._rockSprites) return false;
        return this._rockSprites.filter(function (rs) {
            return rs.opacity && rs._put && Math.abs(progress - rs._pos) <= [4, 6, 8, 16][rs._size];
        })[0] || false;
    };
    //おさむ更新
    Sprite_NewEnemy.prototype.updateOsamu = function () {
        if (this._battler.isDead()) return;
        //ターン終わりあたりで岩を投げてくる
        if (this._battler.hpRate() < 0.7 &&
            SceneManager._scene.progress() / SceneManager._scene.maxCount() * 64 >= 56) {
            var rss = SceneManager._scene._rockSprites;
            if (rss && rss.some(rs => rs.opacity && rs._size >= 3)) return;
            if (rss && rss.filter(rs => rs.opacity).length >= (this._battler.hpRate() <= 0.25 ? 2 : 1)) return;
            if (this._actions[0] && !this._actions[0].applied) return;
            if (SceneManager._scene._turn < (this._lastRockTurn || 0) + (
                this._battler.hpRate() <= 0.25 ? 2 : this._battler.hpRate() <= 0.5 ? 4 : 6
            )) return;
            this.resetForAction();
            this.setAnimation('attack3', false, 8);
            this._noDamageAnime = true;
            this._osamuRockAttack = { count: 0 };
            this._lastRockTurn = SceneManager._scene._turn;
        }
        if (this._osamuRockAttack) {
            this._osamuRockAttack.count++;
            if (this._osamuRockAttack.count === 24) {
                this.startAnimation($dataAnimations[25]);
                $gameSystem.playSe('Earth3');
                $gameSystem.playSe('Earth4', 90, 120);
                $gameScreen.startShake(5, 5, 20);
                SceneManager._scene.putOsamuRock(_rand(0, this._battler.hpRate() <= 0.4 ? 2 : 1));
            }
            if (this._osamuRockAttack.count >= 48) {
                this._noDamageAnime = false;
                this._osamuRockAttack = null;
            }
        }
    };

    // -----------------------------------------------------------------------------
    // 高速シミュレーションモード
    // -----------------------------------------------------------------------------
    function Scene_NewBattle_Sim() {
        this.initialize.apply(this, arguments);
    };
    Scene_NewBattle_Sim.prototype = Object.create(Scene_NewBattle.prototype);
    Scene_NewBattle_Sim.prototype.constructor = Scene_NewBattle_Sim;

    Scene_NewBattle_Sim.prototype.initialize = function () {
        Scene_NewBattle.prototype.initialize.call(this);
        this._simMode = true;
        this._simCount = 0;
        $gameScreen._brightness = 255;
        this.startFadeIn(1);
    };

    Scene_NewBattle_Sim.prototype.simRate = function () {
        if ($gameTroop.isEventRunning() || this._inTodome || BattleManager._phase === 'battleEnd') return 1;
        return simRate;
    };

    Scene_NewBattle_Sim.prototype.maxCount = function () {
        return Scene_NewBattle.prototype.maxCount.apply(this, arguments) / this.simRate();
    };

    Scene_NewBattle_Sim.prototype.popMessage = function (text) {};
    Scene_NewBattle_Sim.prototype.playDamageAnimation = function (ssp, tsp, skillId, judgment) {};

    Scene_NewBattle_Sim.prototype.getBulletWait = function (image, x, y, tx, ty, moveType, param1, param2, param3) {
        return 1;
    };

    Scene_NewBattle_Sim.prototype.update = function () {
        var active = this.isActive();
        $gameTimer.update(active);
        $gameScreen.update();
        var canInput = false;
        if ($gameTroop.isEventRunning() || $gameMessage.isBusy()) this._forceSkip = true;
        if (!this.updateVictory()) {
            if (this.barVisible() && !BattleManager.updateEvent()) {
                if (!this.updateSkip() && this.isBattleActive()) {
                    canInput = true;
                }
            }
        }
        for (var i = 0; i < this.simRate(); i++) {
            Scene_Base.prototype.update.call(this);
            if (canInput) {
                this.updateInputJudge();
                this.updateTurn();
            }
            this.updateJudgeTexts();
            this.updateBar();
            this.updateTotalDamage();
            this.updateFinish();
            this.updateActors();
            this.updateEnemies();
            this.updateBullets();
            this._simCount++;
        }
        this.updateUI();
        this.updateNoteLine();
        this._battleContainer.children.sort(Tilemap.prototype._compareChildOrder.bind(this));
        Graphics.frameCount += this.simRate() - 1;
    };

    Scene_NewBattle_Sim.prototype.updateSkip = function () {
        return false;
    };

    Scene_NewBattle_Sim.prototype.showTextPop = function (position, judgment, x, y) {};
    Scene_NewBattle_Sim.prototype.startCommand = function () { };

    const _BattleManager_displayVictoryMessage = BattleManager.displayVictoryMessage;
    BattleManager.displayVictoryMessage = function () {
        if (SceneManager._scene._simMode) {
            var text = '経過時間 %1秒'.format(Math.round(SceneManager._scene._simCount / 60))
            $gameMessage.add(text);
        } else _BattleManager_displayVictoryMessage.apply(this, arguments);
    };

})();
