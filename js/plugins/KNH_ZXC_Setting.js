//=============================================================================
// KNH_ZXC_Setting.js
//=============================================================================

/*:
 * @plugindesc ZXCセッティング
 * @author kagaya
 *
 * @help
 */

function Sprite_Particle() {
    this.initialize.apply(this, arguments);
};

(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_Setting';
    
    //-----------------------------------------------------------------------------
    // 
    //-----------------------------------------------------------------------------

    Input.keyMapper[27] = 'cancel';
    Input.keyMapper[87] = 'up';         //W
    Input.keyMapper[65] = 'left';       //A
    Input.keyMapper[83] = 'down';       //S
    Input.keyMapper[68] = 'right';      //D
    Input.keyMapper[90] = 'L';          //Z
    Input.keyMapper[67] = 'R';          //C
    Input.keyMapper[69] = 'E';          //E
    Input.keyMapper[81] = 'Q';          //Q
    
    Input.gamepadMapper = {
        0: 'ok',         // A
        1: 'cancel',     // B
        2: 'E',          // X
        3: 'Q',          // Y
        4: 'L',          // L1
        5: 'R',          // R1
        6: 'L',          //L2
        7: 'R',          //R2
        8: 'cancel',     //select
        9: 'cancel',     //start

        12: 'up',        // D-pad up
        13: 'down',      // D-pad down
        14: 'left',      // D-pad left
        15: 'right',     // D-pad right
    };

    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function () {
        _Scene_Boot_start.apply(this, arguments);
        $gameSystem.setKeyAndGamepadConfig();
    };
    var _ConfigManager_exportCustomParams = ConfigManager.exportCustomParams;
    ConfigManager.exportCustomParams = function () {
        _ConfigManager_exportCustomParams.apply(this, arguments);
        $gameSystem.setKeyAndGamepadConfig();
    };

    //音量設定関係
    Object.defineProperty(ConfigManager, 'masterVolume', {
        get: function() {
            return this._masterVolume == null ? 100 : this._masterVolume;
        },
        set: function(value) {
            this._masterVolume = Number(value).clamp(0, 100);
            AudioManager.masterVolume = this._masterVolume / 100;
        },
        configurable: true
    });
    Object.defineProperty(ConfigManager, 'bgmMeVolume', {
        get: function() {
            return AudioManager._bgmVolume;
        },
        set: function(value) {
            var volume = Number(value).clamp(0, 100);
            AudioManager.bgmVolume = volume;
            AudioManager.meVolume = volume;
        },
        configurable: true
    });
    Object.defineProperty(ConfigManager, 'bgsSeVolume', {
        get: function() {
            return AudioManager._bgsVolume;
        },
        set: function(value) {
            var volume = Number(value).clamp(0, 100);
            AudioManager.bgsVolume = volume;
            AudioManager.seVolume = volume;
        },
        configurable: true
    });
    var _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function() {
        var config = _ConfigManager_makeData.apply(this, arguments);
        config.masterVolume = this.masterVolume;
        return config;
    };
    var _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        _ConfigManager_applyData.apply(this, arguments);
        this.masterVolume = this.readVolume(config, 'masterVolume');
        this.bgmMeVolume = this.bgmVolume;
        this.bgsSeVolume = this.bgsVolume;
    };
    Window_Options.prototype.addVolumeOptions = function() {
        this.addCommand('全体音量', 'masterVolume');
        this.addCommand('BGMの音量', 'bgmMeVolume');
        this.addCommand('効果音の音量', 'bgsSeVolume');
    };

    //キーコンフィグ関係
    Game_System.prototype.setKeyAndGamepadConfig = function (inBattle) {
        var info = [inBattle, $gameSwitches.value(33), $gameSwitches.value(34), $gameSwitches.value(35)].toString();
        if (this._lastInfoConfig !== info) {
            this._lastInfoConfig = info;
        } else return;
        //キーボード
        if (inBattle) {
            Input.keyMapper[87] = 'up2';         //W
            Input.keyMapper[65] = 'left2';       //A
            Input.keyMapper[83] = 'down2';       //S
            Input.keyMapper[68] = 'right2';      //D
            if ($gameVariables.value(35)) { //左右反転
                var l = Input.keyMapper[65], r = Input.keyMapper[68];
                Input.keyMapper[65] = r;
                Input.keyMapper[68] = l;
            }
        } else {
            Input.keyMapper[87] = 'up';         //W
            Input.keyMapper[65] = 'left';       //A
            Input.keyMapper[83] = 'down';       //S
            Input.keyMapper[68] = 'right';      //D
        }
        //ゲームパッド
        Input.gamepadMapper[0] = 'ok';
        Input.gamepadMapper[1] = 'cancel';
        Input.gamepadMapper[14] = 'left';       //D-pad left
        Input.gamepadMapper[15] = 'right';      //D-pad right
        if (inBattle) {
            Input.gamepadMapper[2] = 'up2';
            Input.gamepadMapper[3] = 'left2';
            if ($gameVariables.value(35)) { //左右反転
                var l = Input.gamepadMapper[14], r = Input.gamepadMapper[15];
                Input.gamepadMapper[14] = r;
                Input.gamepadMapper[15] = l;
            }
        } else {
            Input.gamepadMapper[2] = 'E';
            Input.gamepadMapper[3] = 'Q';
        }
        if ($gameVariables.value(33)) { //AB反転
            var a = Input.gamepadMapper[0], b = Input.gamepadMapper[1];
            Input.gamepadMapper[0] = b;
            Input.gamepadMapper[1] = a;
        }
        if ($gameVariables.value(34)) { //XY反転
            var x = Input.gamepadMapper[2], y = Input.gamepadMapper[3];
            Input.gamepadMapper[2] = y;
            Input.gamepadMapper[3] = x;
        }
    };
    
    //-----------------------------------------------------------------------------
    // 
    //-----------------------------------------------------------------------------

    // ジャンプ中でもルート移動を進める（character._allowRouteMoveDuringJump = true）
    var _Game_CharacterBase_update2 = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function() {
        if (this._allowRouteMoveDuringJump && this.isJumping() && this._moveRouteForcing) {
            this.updateStop();
        }
        _Game_CharacterBase_update2.call(this);
    };

    //キャラ基準のアニメーション表示拡張
    //requestAnimation(animationId, addX, addY, scale) で指定可能
    var _Game_CharacterBase_requestAnimation_ZXC = Game_CharacterBase.prototype.requestAnimation;
    Game_CharacterBase.prototype.requestAnimation = function(animationId, addX, addY, scale) {
        _Game_CharacterBase_requestAnimation_ZXC.call(this, animationId);

        if (arguments.length >= 2) {
            var x = Number(addX);
            var y = Number(addY);
            var s = scale == null ? 1 : Number(scale);
            if (!isFinite(x)) x = 0;
            if (!isFinite(y)) y = 0;
            if (!isFinite(s) || s <= 0) s = 1;
            this._animationExInfo = { addX: x, addY: y, scale: s };
        } else {
            this._animationExInfo = null;
        }
    };
    Game_CharacterBase.prototype.requestAnimationEx = function(animationId, addX, addY, scale) {
        this.requestAnimation(animationId, addX, addY, scale);
    };

    var _Sprite_Character_setupAnimation_ZXC = Sprite_Character.prototype.setupAnimation;
    Sprite_Character.prototype.setupAnimation = function() {
        var beforeLength = this._animationSprites ? this._animationSprites.length : 0;
        _Sprite_Character_setupAnimation_ZXC.apply(this, arguments);

        var character = this._character;
        if (!character || !character._animationExInfo) return;

        var afterLength = this._animationSprites ? this._animationSprites.length : 0;
        if (afterLength <= beforeLength) return;

        var sprite = this._animationSprites[afterLength - 1];
        if (sprite) {
            var info = character._animationExInfo;
            sprite._addX = info.addX;
            sprite._addY = info.addY;
            sprite._scale = info.scale;
            sprite.scale.x = info.scale;
            sprite.scale.y = info.scale;
        }
        character._animationExInfo = null;
    };

    //プレイヤーを画面中央よりy+1
    Game_Player.prototype.centerY = function() {
        return (Graphics.height / $gameMap.tileHeight() - 1) / 2.0 + 1;
    };
    
    //マップの最大下限または右限を-0.5
    Game_Map.prototype.adjustX = function (x) {
        var a = this.width() >= 30 && $dataMap.meta && $dataMap.meta.vertical ? 0.5 : 0;
        if (this.isLoopHorizontal() && x < this._displayX - (this.width() - a - this.screenTileX()) / 2)
            return x - this._displayX + $dataMap.width;
        else return x - this._displayX;
    };
    Game_Map.prototype.adjustY = function (y) {
        var a = this.height() >= 30 && $dataMap.meta && $dataMap.meta.vertical ? 0 : 0.5;
        if (this.isLoopVertical() && y < this._displayY - (this.height() - a - this.screenTileY()) / 2)
            return y - this._displayY + $dataMap.height;
        else return y - this._displayY;
    };
    Game_Map.prototype.setDisplayPos = function(x, y) {
        var isVertical = $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
        if (this.isLoopHorizontal()) {
            this._displayX = x.mod(this.width());
            this._parallaxX = x;
        } else {
            var endX = this.width() - (isVertical ? 0.5 : 0) - this.screenTileX();
            this._displayX = endX < 0 ? endX / 2 : x.clamp(0, endX);
            this._parallaxX = this._displayX;
        }
        if (this.isLoopVertical()) {
            this._displayY = y.mod(this.height());
            this._parallaxY = y;
        } else {
            var endY = this.height() - (isVertical ? 0 : 0.5) - this.screenTileY();
            this._displayY = endY < 0 ? endY / 2 : y.clamp(0, endY);
            this._parallaxY = this._displayY;
        }
    };
    
    //スクロールを滑らかに
    var _Game_Player_initialize = Game_Player.prototype.initialize;
    Game_Player.prototype.initialize = function() {
        _Game_Player_initialize.call(this);
        this._centerXy = [0, 0];
    };
    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        var ee = SceneManager && SceneManager._scene && SceneManager._scene._knhEE;
        var eeSimRunning = !!(ee && ee.on && ee._simToRunning);
        if (ee && ee.on) {
            if (ee.dragMode === 'tile' && !eeSimRunning) return;
            // EventEditor playback should allow camera scroll in both GAME/EDIT interaction modes.
            if (!eeSimRunning && !ee.play) return;
        }
        if (eeSimRunning && SceneManager && typeof SceneManager.updateEasing === 'function') {
            SceneManager.updateEasing();
        }
        if ($gameSwitches.value(2) || !!KGG_MiniGame._rt) return;
        var isVertical = $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
        this._centerXy = this._centerXy || [0, 0];
        var target = $gameMap._scrollTarget || this;
        var cx = ($gameMap._scrollToX || ((target._realX || target.x) + 0.5 + this._centerXy[0])).clamp
            (8.5, $gameMap.width() - 8.5 - (isVertical ? 0.5 : 0));
        var cy = ($gameMap._scrollToY || ((target._realY || target.y) - 0.5 + this._centerXy[1])).clamp
            (6.5, $gameMap.height() - 7.5 + (!isVertical ? 0.5 : 0));
        this._displayCx = this._displayCx || cx, this._displayCy = this._displayCy || cy;
        var a = SceneManager._scene._sceneInfo || $gameTemp._itemInfoWindow ? 0 : $gameMap.isEventRunning() ? 0.08 : 0.15;
        this._displayCx += (cx - (this._displayCx)) * a;
        this._displayCy += (cy - (this._displayCy)) * a;
        this._displayBx = 0, this._displayBy = 0;
        
        var lastX = $gameMap._displayX, lastY = $gameMap._displayY;
        $gameMap._displayX = this._displayCx + this._displayBx - ($gameMap._addScrollX || 0) - (Graphics.boxWidth / 2) / $gameScreen.zoomScale() / 48;
        $gameMap._displayY = this._displayCy + this._displayBy - (Graphics.boxHeight / 2) / $gameScreen.zoomScale() / 48;
        $gameMap._parallaxX += $gameMap._displayX - lastX;
        $gameMap._parallaxY += $gameMap._displayY - lastY;
        if (eeSimRunning && ee && !ee.controlMode) {
            ee.runtimeDisplayX = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
            ee.runtimeDisplayY = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
        }
    };
    var _Game_Player_locate = Game_Player.prototype.locate;
    Game_Player.prototype.locate = function(x, y) {
        _Game_Player_locate.apply(this, arguments);
        var isVertical = $dataMap.meta && $dataMap.meta.vertical && !$gameParty.inBattle();
        var cx = ($gameMap._scrollToX || ((this._realX || this.x) + 0.5)).clamp(8.5, $gameMap.width() - 8.5 -(isVertical ? 0.5 : 0));
        var cy = ($gameMap._scrollToY || ((this._realY || this.y) - 0.5)).clamp(6.5, $gameMap.height() - 7.5 + (!isVertical ? 0.5 : 0));
        this._displayCx = cx, this._displayCy = cy;
    };

    Game_Map.prototype.scrollCamera = function(ax, ay, duration) {
        duration = Math.max(1, Math.round((duration || 60) * 0.8));
        $gamePlayer._centerXy = $gamePlayer._centerXy || [0, 0];
        if (SceneManager && typeof SceneManager.clearEasing === 'function') {
            SceneManager.clearEasing($gamePlayer._centerXy, [0, 1]);
        }
        if (SceneManager && typeof SceneManager.setEasing === 'function') {
            SceneManager.setEasing($gamePlayer._centerXy, 0, 'easeOutQuad', $gamePlayer._centerXy[0], ax, duration);
            SceneManager.setEasing($gamePlayer._centerXy, 1, 'easeOutQuad', $gamePlayer._centerXy[1], ay, duration);
        } else {
            $gamePlayer._centerXy[0] = ax;
            $gamePlayer._centerXy[1] = ay;
        }
    };
    Game_Map.prototype.scrollCameraTo = function(tx, ty, duration) {
        duration = Math.max(1, Math.round((duration || 60) * 0.8));
        $gamePlayer._centerXy = $gamePlayer._centerXy || [0, 0];
        if (SceneManager && typeof SceneManager.clearEasing === 'function') {
            SceneManager.clearEasing($gamePlayer._centerXy, [0, 1]);
        }
        if (SceneManager && typeof SceneManager.setEasing === 'function') {
            SceneManager.setEasing($gamePlayer._centerXy, 0, 'easeOutQuad', $gamePlayer._centerXy[0], tx - $gamePlayer.x, duration);
            SceneManager.setEasing($gamePlayer._centerXy, 1, 'easeOutQuad', $gamePlayer._centerXy[1], ty - $gamePlayer.y, duration);
        } else {
            $gamePlayer._centerXy[0] = tx - $gamePlayer.x;
            $gamePlayer._centerXy[1] = ty - $gamePlayer.y;
        }
    };
    Game_Map.prototype.resetCamera = function () {
        $gamePlayer._centerXy = [0, 0];
    };
    //瞬時にスクロールを動かす　スクロール禁止中でも可
    Game_Map.prototype.forceScrollCamera = function (ax, ay) {
        $gamePlayer._centerXy = [ax, ay];
        var target = $gameMap._scrollTarget || $gamePlayer;
        var cx = ($gameMap._scrollToX || ((target._realX || target.x) + 0.5 + $gamePlayer._centerXy[0])).clamp(8.5, $gameMap.width() - 8.5),
            cy = ($gameMap._scrollToY || ((target._realY || target.y) - 0.5 + $gamePlayer._centerXy[1])).clamp(6.5, $gameMap.height() - 7);
        $gamePlayer._displayCx = $gamePlayer._displayCx || cx, $gamePlayer._displayCy = $gamePlayer._displayCy || cy;
        var a = 1;
        $gamePlayer._displayCx += (cx - ($gamePlayer._displayCx)) * a;
        $gamePlayer._displayCy += (cy - ($gamePlayer._displayCy)) * a;

        var lastX = $gameMap._displayX, lastY = $gameMap._displayY;
        $gameMap._displayX = $gamePlayer._displayCx + $gamePlayer._displayBx - ($gameMap._addScrollX || 0) - (Graphics.boxWidth / 2) / $gameScreen.zoomScale() / 48;
        $gameMap._displayY = $gamePlayer._displayCy + $gamePlayer._displayBy - (Graphics.boxHeight / 2) / $gameScreen.zoomScale() / 48;
        $gameMap._parallaxX += $gameMap._displayX - lastX;
        $gameMap._parallaxY += $gameMap._displayY - lastY;
    };
    
    //瞬時にプレイヤーを半歩ずらす　場所移動の補正など
    Game_Player.prototype.shiftPos = function(ax, ay) {
        this._x += ax;
        this._realX += ax;
        this._displayCx += ax;
        this._y += ay;
        this._realY += ay;
        this._displayCy += ay;
    };


    // 短い方向入力はその場で向き変更
    var _Game_Player_moveByInput_ZXC = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function () {
        var wait = 3; //入力待ちフレーム数
        var dir8 = Input.dir8;
        if (dir8 % 2 === 1 && dir8 !== 5) {
            this._dirTapDir = 0;
            this._dirTapCount = 0;
            return _Game_Player_moveByInput_ZXC.call(this);
        }
        if (!this.isMoving() && this.canMove()) {
            var dir = Input.dir4;
            if (dir > 0) {
                var isPending = (this._dirTapDir === dir && this._dirTapCount > 0);
                if (!isPending && dir === this.direction()) {
                    this._dirTapDir = 0;
                    this._dirTapCount = 0;
                    return _Game_Player_moveByInput_ZXC.call(this);
                }
                if (!isPending) {
                    this._dirTapDir = dir;
                    this._dirTapCount = 0;
                }
                this._dirTapCount = (this._dirTapCount || 0) + 1;
                this.setDirection(dir);
                if (this._dirTapCount <= wait) return;
                this._dirTapDir = 0;
                this._dirTapCount = 0;
            } else {
                this._dirTapDir = 0;
                this._dirTapCount = 0;
            }
        }
        return _Game_Player_moveByInput_ZXC.call(this);
    };
    
    
    //キャラに一枚絵スプライトをセットする機能　自動でアニメーション
    Game_Event.prototype.setEnemyImage = function(enemy, size) {
        this.setImage(enemy.battlerName, 0);
        this._customResource = 'Enemy';
        this._graphicColumns = 1;
        this._graphicRows    = 1;
        this._hue = enemy.battlerHue;
        this._onePicAnimation = true;
        this._onePicScale = 
            Math.max(33, 72 * (size || 1) / ($dataZXC.en[enemy.imageId].size[0] + $dataZXC.en[enemy.imageId].size[1]) * 2 * 100);
        this._onePicMirrorX = !!$dataZXC.en[enemy.imageId].mirrorX;
    };
    var _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function() {
        _Game_CharacterBase_update.call(this);
        if (this._onePicAnimation) {
            var scale = this._onePicScale;
            var a = 
            this._scaleX = (scale + scale * 0.04 * Math.sin((this._pattern + 0.5) / 6 * Math.PI * 2)) * (this._onePicMirrorX ? -1 : 1);
            this._scaleY = scale + scale * 0.04 * Math.cos(Math.PI / 2 + (this._pattern + 0.5) / 6 * Math.PI * 2);
        }
        if (this._shiftInfo) {
            var sxy = this._shiftInfo[this._direction / 2 - 1];
            this.shiftPosition(sxy[0], sxy[1]);
            this.setShadowPosition(this._shadowInfo[0] - this._additionalX, this._shadowInfo[1] - this._additionalY);
        }
        
        //足音再生用
        var changed = (this._lastPattern !== this._pattern && this._pattern % 2 === 0 && this.isMoving(true) && !this.isJumping());
        if (changed) this.playStep();
        this._lastPattern = this._pattern;
    };
    Game_CharacterBase.prototype.maxPattern = function() {
        return this._onePicAnimation ? 6 : 4;
    };
    var _Sprite_Character_isImageChanged = Sprite_Character.prototype.isImageChanged;
    Sprite_Character.prototype.isImageChanged = function() {
        return _Sprite_Character_isImageChanged.apply(this, arguments) ||
            this._customResource !== this._character.customResource() ||
            this._hue !== this._character._hue;
    };
    var _Sprite_Character_updateBitmap = Sprite_Character.prototype.updateBitmap;
    Sprite_Character.prototype.updateBitmap = function() {
        _Sprite_Character_updateBitmap.apply(this, arguments);
        this._hue = this._character._hue;
    };
    var _Sprite_Character_setCharacterBitmap = Sprite_Character.prototype.setCharacterBitmap;
    Sprite_Character.prototype.setCharacterBitmap = function() {
        if (this._customResource && this._character._hue) {
            var hue = this._character._hue;
            this.bitmap = ImageManager['load' + this._customResource](this._characterName, hue);
        } else _Sprite_Character_setCharacterBitmap.apply(this, arguments);
    };
    var _Sprite_Battler_setBreathMembers = Sprite_Battler.prototype.setBreathMembers;
    Sprite_Battler.prototype.setBreathMembers = function () {
        _Sprite_Battler_setBreathMembers.apply(this, arguments);
        var enemy = this._battler.enemy();
        if (!$dataZXC.en[enemy.imageId]) return;
        if (enemy.meta.boss) this._zX = this._zY = 
            Math.max(33, 72 / ($dataZXC.en[enemy.imageId].size[0] + $dataZXC.en[enemy.imageId].size[1]) * 2 * 100) / 33;
    };

    Game_CharacterBase.prototype.goTo = function (x, y) {
        if (this.x !== x || this.y !== y) this.turnTowardCharacter({ _realX: x, _realY: y });
        this._x = x;
        this._y = y;
    };
    Game_CharacterBase.prototype.locateTo = function (x, y) {
        this._x = this._realX = x;
        this._y = this._realY = y;
    };
    var _Game_Player_locateTo = Game_Player.prototype.locateTo;
    Game_Player.prototype.locateTo = function (x, y) {
        _Game_Player_locateTo.apply(this, arguments);
        if (this._followers && typeof this._followers.forEach === 'function') {
            this._followers.forEach(function (follower) {
                if (follower && typeof follower.locateTo === 'function') follower.locateTo(x, y);
            });
        }
    };
    //キャラクターをキャラクターのもとに向かわせる（重ならせる）
    Game_CharacterBase.prototype.goToCharacter = function(character) {
        this.turnTowardCharacter(character);
        this.goTo(character.x, character.y);
    };
    Game_CharacterBase.prototype.locateToCharacter = function(character) {
        this.locateTo(character.x, character.y);
    };

    //ジャンプ仕様改善
    Game_CharacterBase.prototype.jump = function (xPlus, yPlus, heightRate, durationRate) {
        heightRate = heightRate === undefined ? 1 : heightRate;
        durationRate = durationRate === undefined ? 1 : durationRate;

        if (Math.abs(xPlus) > Math.abs(yPlus)) {
            if (xPlus !== 0) this.setDirection(xPlus < 0 ? 4 : 6);
        } else {
            if (yPlus !== 0) this.setDirection(yPlus < 0 ? 8 : 2);
        }
        this._x += xPlus;
        this._y += yPlus;
        const distance = Math.round(Math.hypot(xPlus, yPlus));
        const basePeak = 10 + distance - this._moveSpeed;

        this._jumpDurationRate = durationRate;
        this._jumpPeak = Math.round(basePeak * heightRate);
        this._jumpCount = Math.round(this._jumpPeak * 2 * durationRate);

        this.resetStopCount();
        this.straighten();
    };
    Game_CharacterBase.prototype.jumpHeight = function () {
        const rate = this._jumpDurationRate || 1;
        const vCount = this._jumpCount / rate;
        return (this._jumpPeak * this._jumpPeak -
            Math.pow(Math.abs(vCount - this._jumpPeak), 2)) / 2;
    };
    Game_Player.prototype.jump = function (xPlus, yPlus, heightRate, durationRate) {
        Game_Character.prototype.jump.apply(this, arguments);
        this._followers.jumpAll();
    };
    
    //ウィンドウ基本設定
    Window_Base.prototype.lineHeight = function() {
        return 33;
    };
    
    //ウィンドウ開閉設定
    Window_Base.prototype.openSpeed = function() {
        return 32;
    };
    Window_Base.prototype.updateOpen = function () {
        if ($gameTemp.isPlaytest() && SceneManager.isRapid() && this._opening) this.openness = 255;
        if (this._opening) {
            this.openness += this.openSpeed();
            if (this.isOpen()) this._opening = false;
        }
    };
    Window_Base.prototype.updateClose = function () {
        if ($gameTemp.isPlaytest() && SceneManager.isRapid() && this._opening) this.openness = 0;
        if (this._closing) {
            this.openness -= this.openSpeed();
            if (this.isClosed()) this._closing = false;
        }
    };
    //ウィンドウ開閉アニメーション
    Object.defineProperty(Window.prototype, 'openness', {
        get: function() {return this._openness},
        set: function(value) {
            if (this._openness !== value) {
                this._openness = value.clamp(0, 255);
                var scaleX = !this._openness ? 0 : this.isOpen() ? 1 : (this.width - 24) / this.width;
                var scaleY = !this._openness ? 0 : this.isOpen() ? 1 : (this.height - 24) / this.height;
                this._windowSpriteContainer.scale.x = scaleX, this._windowSpriteContainer.scale.y = scaleY;
                this._windowSpriteContainer.x = this.width  / 2 * (1 - scaleX);
                this._windowSpriteContainer.y = this.height / 2 * (1 - scaleY);
            }
        },
        configurable: true
    });
    
    //メッセージ音
    Window_Message.prototype.playCharSE = function(){
        var t = this._textState.text[this._textState.index];
        if (!t || t == ' ') return;
        if ($dataMap && $dataMap.meta && $dataMap.meta.noMessageSe) return;
        
        $gameSystem.playStaticSe('00_pen' + _rand(1, 26), 150, _rand(100, 120));
    };
    Game_System.prototype.setToneBySpeaker = function(ind) {
        if (ind === null) return $gameTemp._messageTone = 0;
        var sexInd = ZXC().gptData.actorSexes.filter(function(a, i) {return a === ZXC().gptData.actorSexes[ind] && i < ind}).length;
        if (ZXC().gptData.actorSexes[ind] === '♂') $gameTemp._messageTone = [1, 6, 1, 6, 1, 6][sexInd];
        if (ZXC().gptData.actorSexes[ind] === '♀') $gameTemp._messageTone = [0, 4, 0, 4, 0, 4][sexInd];
    };

    //制御文字追加
    var _Window_Base_processEscapeCharacter = Window_Base.prototype.processEscapeCharacter;
    Window_Base.prototype.processEscapeCharacter = function (code, textState) {
        switch (code) {
            case 'EM': //イベントを強制的に先へ進める
                var interpreter = $gameMap._interpreter;
                interpreter._waitMode = '';
                break;
            case 'CL': //レベルアップコマンド実行
                var interpreter = $gameTroop._interpreter;
                interpreter.command_displayLevelUp(this.obtainEscapeParam(textState));
                break;
            case 'CD': //ドロップアイテムコマンド実行
                var interpreter = $gameTroop._interpreter;
                interpreter.command_displayDropItems(this.obtainEscapeParam(textState));
                break;
            case 'BU': //戦闘中　アイテム使うまで待つ
                if (SceneManager._scene._itemSprite.opacity) this.startWait(50);
                break;
            default:
                _Window_Base_processEscapeCharacter.call(this, code, textState);
                break;
        }
    };

    // TouchInput.initialize からイベントハンドラ登録を削除
    TouchInput.initialize = function () {
        this.clear();   // 状態だけ初期化して、イベントは一切登録しない
        if (Utils.isOptionValid('test')) this._setupEventHandlers();
    };
    
    //ボタンの上にカーソルがある
    Scene_Map.prototype.isTouchedInsideButton = function() {
        var x = TouchInput.x, y = TouchInput.y;
        var objs = [];
        objs.push(SceneManager._debugWindow);
        objs.push(SceneManager._changeAutoWindow);
        objs.push(SceneManager._debugRoomStartWindow);
        return objs.some(function(obj) {
            if (!obj) return false;
            var b = obj;
            var px = obj.parent ? obj.parent.x : 0, py = obj.parent ? obj.parent.y : 0;
            if (obj.anchor) px -= obj.anchor.x * obj.width, py -= obj.anchor.y * obj.height;
            return b.visible && b.openness !== 0 &&
                x >= b.x + px && y >= b.y + py && x < b.x + px + b.width && y < b.y + py + b.height;
        })
    };
    //マップタッチ時の反応条件
    var _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function() {
        if (this.isTouchedInsideButton()) return;
        _Scene_Map_processMapTouch.apply(this, arguments);
    };

    //ウィンドウ外タッチでキャンセル（または決定）実行
    var _Window_Selectable_processTouch = Window_Selectable.prototype.processTouch;
    Window_Selectable.prototype.processTouch = function() {
        _Window_Selectable_processTouch.apply(this, arguments);
        if (!this._invalidCancelByTouchingOut &&
            this.isOpenAndActive() && this._openness >= 255 &&
            TouchInput.isTriggered() && !this.isTouchedInsideFrame()) {
            var command = 'cancel';
            var s = SceneManager._scene;
            if (SceneManager._changeAutoWindow && SceneManager._changeAutoWindow.isTouchedInsideFrame()) return;
            if (s instanceof Scene_Menu && this === s._commandWindow && s._statusWindow.isTouchedInsideFrame()) {
                if (this._index >= 1 && this._index <= 3) command = 'ok'; else return;
            } else if (s instanceof Scene_Item && this === s._categoryWindow && s._itemWindow.isTouchedInsideFrame()) command = 'ok';
            else if (s instanceof Scene_Skill && this === s._skillTypeWindow && s._itemWindow.isTouchedInsideFrame()) command = 'ok';
            else if (s instanceof Scene_Equip && this === s._commandWindow && s._slotWindow.isTouchedInsideFrame()) this._index = 0, command = 'ok';
            else if (s instanceof Scene_Equip && this === s._slotWindow && s._itemWindow.isTouchedInsideFrame()) command = 'ok';
            else if (s instanceof Scene_Shop && this === s._commandWindow && s._dummyWindow.isTouchedInsideFrame()) command = 'ok';
            else if (s instanceof Scene_Shop && this === s._categoryWindow && s._sellWindow.isTouchedInsideFrame()) command = 'ok';
            if (command === 'ok') {
                if (this.isOkEnabled()) this.processOk();
                else if (this.onOk) this.onOk();
            } else if (command === 'cancel') {
                if (this.isCancelEnabled()) this.processCancel();
                else if (this.onCancel) this.onCancel();
            }
        }
    };

    //ウィンドウスキン変更機能
    Window_Base.prototype.loadWindowskin = function () {
        this.windowskin = ImageManager.loadSystem('Window' + (this._windowskinId || ''));
    };

    //マップカーソル
    Sprite_Destination.prototype.createBitmap = function() {
        var tileWidth = $gameMap.tileWidth();
        var tileHeight = $gameMap.tileHeight();
        this.bitmap = ImageManager.loadSystem('mapTouch');
        this.setFrame(0, 0, 48, 48);
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
    };
    Sprite_Destination.prototype.updateAnimation = function() {
        this._frameCount++;
        var c = Math.floor(this._frameCount / 6) % 6;
        this.setFrame([0, 1, 2, 3, 2, 1][c] * 48, 0, 48, 48);
    };
    
    //ダメージスプライト
    var _Sprite_Damage_update = Sprite_Damage.prototype.update;
    Sprite_Damage.prototype.update = function() {
        if (this._duration % 2 === 1) {
            this._duration--;
            return;
        }
        _Sprite_Damage_update.call(this);
    };
    Sprite_Damage.prototype.setupCriticalEffect = function() {
        this._updateScale = true;
        this._crticalDuration = 5;
        for (var i = 0; i < this.children.length; i++) {
            var sprite = this.children[i];
            sprite.scale.x = sprite.scale.y = 3.5;
            sprite._targetX = sprite.x + 48 * (i - this.children.length / 2 + 0.5);
            sprite.x += 96 * (i - this.children.length / 2 + 0.5);
        }
        this._shake = 25;
        this._flashDuration = 30;
        $gameSystem.playSe('Damage5', 90, _rand(100, 120));
    };
    Sprite_Damage.prototype.updateFlash = function() {
        if (!this._updateScale) return;
        for (var i = 0; i < this.children.length; i++) {
            var sprite = this.children[i];
            if (sprite.scale.x > 1.25 && !sprite._ups) {
                sprite.scale.x += (1.25 - sprite.scale.x) / this._crticalDuration;
                sprite.scale.y = sprite.scale.x;
                sprite.x += (sprite._targetX - sprite.x) / this._crticalDuration;
            } else {
                sprite.scale.x = sprite.scale.y = 1.25;
                sprite._ups = true;
            }
        }
        if (this._flashDuration > 0) {
            var d = this._flashDuration--;
        }
    };
    Sprite_Damage.prototype.updateOpacity = function() {
        this.opacity = this._duration > 0 ? 255 : 0;
    };
    var _Sprite_Damage_createDigits = Sprite_Damage.prototype.createDigits;
    Sprite_Damage.prototype.createDigits = function(baseRow, value) {
        _Sprite_Damage_createDigits.apply(this, arguments);
        var string = Math.abs(value).toString();
        var dx = _rand(-20, 20) / 10, dy = _rand(-20, -10) / 10;
        for (var i = 0; i < this.children.length; i++) {
            var sp = this.children[i];
            sp.x = (i - (string.length - 1) / 2) * (this.digitWidth() - 8);
            sp.rx = sp.x;
            sp.dx = dx;
            sp.dy += dy;
        }
    };
    Sprite_Damage.prototype.updateChild = function(sprite) {
        sprite.dx *= 0.95;
        sprite.rx += sprite.dx;
        
        sprite.dy += 0.5;
        sprite.ry += sprite.dy;
        if (sprite.ry >= 0) {
            sprite.ry = 0;
            sprite.dy *= -0.6;
        }
        sprite.x = Math.round(sprite.rx);
        sprite.y = Math.round(sprite.ry);
        if (this._shake) {
            sprite.x += _rand(-this._shake, this._shake);
            sprite.y += _rand(-this._shake, this._shake);
            this._shake--;
        }
        sprite.setBlendColor(this._flashColor);
    };
    
    //足音
    Game_CharacterBase.prototype.playStep = function() {
        var isFollower = this instanceof Game_Follower;
        if (this !== $gamePlayer && !isFollower) return;
        if (isFollower) {
            if (!this.actor()) return;
            if (this.stepSeType() === $gamePlayer.stepSeType()) return;
        }
        var name, name2, vol, pit;
        var type = this.stepSeType();
        if (!type) return;
        if (type === 1) { //土
            name = '00_step1', vol = 60, pit = 100;
        } else if (type === 2) { //草
            name = '00_step2', vol = 8, pit = 100;
        } else if (type === 3) { //石
            name = '00_step3', vol = 30, pit = 100;
        } else if (type === 4) { //絨毯
            name = '00_step4', vol = 80, pit = 100;
        } else if (type === 5) { //水たまり
            name = '00_mizutamari1', vol = 30, pit = 130;
            name2 = '00_mizutamari2';
        }
        if (isFollower) vol = Math.round(vol * 0.75);
        if (name2 && Math.randomInt(2)) name = name2;
        if (this._pattern === 0) {
            this.playSe(name, vol, _rand(pit + 4, pit + 12));
        } else {
            this.playSe(name, vol, _rand(pit - 8, pit));
        }
    };
    Game_CharacterBase.prototype.stepSeType = function () {
        if (this.regionId() === 9) return 0;
        if (this.inMizutamari()) return 5;
        if (this.regionId() === 5 || this.regionId() === 8) return 2; //草
        if (this.regionId() === 3) return 3; //石
        if (this.regionId() === 7) return 4; //絨毯
        return 1; //土
    };
    //水たまり判定
    Game_CharacterBase.prototype.inMizutamari = function () {
        if (!$gameMap._mizutamariZones) {
            var s = ($dataMap && $dataMap.meta && $dataMap.meta.mizutamari) || "";
            if (!s) $gameMap._mizutamariZones = [];
            else {
                s = String(s).replace(/\n/g, "");
                try {
                    const zones = JSON.parse("[" + s + "]"); // "[12,4,2],[2.5,12,1]" -> [[12,4,2],[2.5,12,1]]
                    $gameMap._mizutamariZones = Array.isArray(zones) ? zones : [];
                } catch (e) {
                    $gameMap._mizutamariZones = [];
                }
            }
        }
        const zones = $gameMap._mizutamariZones;
        if (!zones || zones.length === 0) return false;
        const x = this._realX, y = this._realY + 0.5;
        for (let i = 0; i < zones.length; i++) {
            const a = zones[i];
            if (!a || a.length < 3) continue;
            const zx = +a[0], zy = +a[1], r = +a[2];
            if (!isFinite(zx) || !isFinite(zy) || !isFinite(r)) continue;
            const dx = x - zx, dy = y - zy;
            if (dx * dx + dy * dy <= r * r + 1e-8) return true;
        }
        return false;
    };

    //BGM自動再生禁止機能
    Game_Map.prototype.autoplay = function () {
        if ($dataMap.autoplayBgm && !$gameSwitches.value(5)) {
            if ($gamePlayer.isInVehicle()) {
                $gameSystem.saveWalkingBgm2();
            } else {
                AudioManager.playBgm($dataMap.bgm);
            }
        }
        if ($dataMap.autoplayBgs && !$gameSwitches.value(5)) {
            AudioManager.playBgs($dataMap.bgs);
        }
    };
    BattleManager.playBattleBgm = function () {
        if (!$gameSwitches.value(5)) {
            AudioManager.playBgm($gameSystem.battleBgm());
            AudioManager.stopBgs();
        }
    };
    
    //ウィンドウカーソルアニメーション
    Window.prototype._updateCursor = function () {
        var a = 10;
        var info = [this._windowCursorSprite.x, this._windowCursorSprite.y].toString();
        if (this._lastInfoUpdateCursor !== info) {
            this._lastInfoUpdateCursor = info;
            this._animationCount = a;
        }
        this._windowCursorSprite.alpha = this.active ? Math.floor((this._animationCount % (a * 3.5)) / a).clamp(0, 1) : 1;
        this._windowCursorSprite.visible = this.isOpen();
    };
    
    //〇〇から接触 のトリガーは決定ボタンで実行不可
    Game_Player.prototype.triggerButtonAction = function() {
        if (Input.isTriggered('ok')) {
            if (this.getOnOffVehicle()) {
                return true;
            }
            this.checkEventTriggerHere([0]);
            if ($gameMap.setupStartingEvent()) {
                return true;
            }
            this.checkEventTriggerThere([0]);
            if ($gameMap.setupStartingEvent()) {
                return true;
            }
        }
        return false;
    };

    //敵の名前から[ev]などを排除
    Game_Enemy.prototype.originalName = function () {
        return this.enemy().name.replace(/\[[^\]]*\]/g, '');
    };

    //キャラがブルブル震える
    var SHIVER_X_PX = 2, SHIVER_X_FRAMES = 2;
    Game_CharacterBase.prototype.startShiverX = function () {
        this._shiverX = true, this._shiverCount = 0;
        var amp = Math.max(1, Math.floor(SHIVER_X_PX || 1));
        if (this._shiverOffsetX !== amp && this._shiverOffsetX !== -amp) this._shiverOffsetX = amp;
    };
    Game_CharacterBase.prototype.stopShiverX = function () {
        this._shiverX = false, this._shiverCount = 0, this._shiverOffsetX = 0;
    };

    //キャラがガタガタ震える
    Game_CharacterBase.prototype.startGatagata = function () {
        this._gatagata = true, this._gatagataCount = 0, this._gatagataPos = { x: 0, y: 0 };
    };
    Game_CharacterBase.prototype.stopGatagata = function () {
        this._gatagata = false, this._gatagataCount = 0, this._gatagataPos = { x: 0, y: 0 };
    };

    //上記震え実装
    var _Game_CharacterBase_screenX_shake = Game_CharacterBase.prototype.screenX;
    Game_CharacterBase.prototype.screenX = function () {
        var p = this._gatagataPos;
        return _Game_CharacterBase_screenX_shake.apply(this, arguments) + (this._shiverOffsetX || 0) + (p ? p.x : 0);
    };
    var _Game_CharacterBase_screenY_shake = Game_CharacterBase.prototype.screenY;
    Game_CharacterBase.prototype.screenY = function () {
        var p = this._gatagataPos;
        return _Game_CharacterBase_screenY_shake.apply(this, arguments) + (p ? p.y : 0);
    };
    var _Game_CharacterBase_update_shake = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function () {
        _Game_CharacterBase_update_shake.apply(this, arguments);
        if (this._shiverX) {
            this._shiverCount = (this._shiverCount || 0) + 1;
            var wait = Math.max(1, Math.floor(SHIVER_X_FRAMES || 1)), amp = Math.max(1, Math.floor(SHIVER_X_PX || 1));
            if (this._shiverCount >= wait) this._shiverOffsetX = (this._shiverOffsetX === amp ? -amp : amp), this._shiverCount = 0;
        } else if (this._shiverOffsetX) this._shiverOffsetX = 0;
        if (this._gatagata) {
            this._gatagataCount = (this._gatagataCount || 0) + 1;
            if (this._gatagataCount >= 3) {
                var rad = Math.random() * Math.PI * 2;
                this._gatagataPos = { x: Math.round(Math.cos(rad) * 2), y: Math.round(Math.sin(rad) * 2) };
                this._gatagataCount = 0;
            }
        } else if (this._gatagataPos && (this._gatagataPos.x || this._gatagataPos.y)) this._gatagataPos = { x: 0, y: 0 };
    };
    


    //メッセージスキップ　1回目の文章は不可にする
    var _Window_Message_updateWait = Window_Message.prototype.updateWait;
    Window_Message.prototype.updateWait = function () {
        var value = _Window_Message_updateWait.apply(this, arguments);

        var info = [this._textState ? this._textState.text : '', Input.isTriggered('cancel')].toString();
        if (this._lastInfoSkip !== info) {
            this._lastInfoSkip = info;
            if (info) {
                $gameSystem._shownMessageInfo = $gameSystem._shownMessageInfo || [];
                var interpreter = $gameTroop._interpreter.isRunning() ? $gameTroop._interpreter :
                    $gameMap._interpreter.isRunning() ? $gameMap._interpreter : null;
                if (!interpreter || $gameSwitches.value(30)) {
                    this._canSkip = true;
                } else {
                    var child = interpreter.getLastChild();
                    var a = [$gameMap.mapId(), interpreter._index];
                    if ($gameTroop._interpreter.isRunning()) a.push('t', interpreter._troopId, interpreter._troopPageIndex);
                    else a.push('m', interpreter._eventId, interpreter._mapPageIndex);
                    if (child !== interpreter) a.push(child._index, child._commonEventId);
                    this._canSkip = !!$gameSystem._shownMessageInfo[a] || Input.isTriggered('cancel');
                    $gameSystem._shownMessageInfo[a] = true;
                }
            }
        }
        if (!this._canSkip && this._showAll) this._showAll = false;

        return value;
    };

    //Interpreterに情報を追加しておく
    const _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
    Game_Interpreter.prototype.setup = function (list, eventId) {
        _Game_Interpreter_setup.apply(this, arguments);
        if (this === $gameMap._interpreter) {
            if (!$gameMap.event(this._eventId)) return;
            const idx = $gameMap.event(this._eventId).event().pages.findIndex(p => p.list === list);
            this._mapPageIndex = idx;
        } else if (this === $gameTroop._interpreter) {
            const idx = $gameTroop.troop().pages.findIndex(p => p.list === list);
            this._troopId = $gameTroop.troop().id;
            this._troopPageIndex = idx;
        }
    };
    //コモンイベントの際にも
    const _Game_Interpreter_command117 = Game_Interpreter.prototype.command117;
    Game_Interpreter.prototype.command117 = function () {
        var r = _Game_Interpreter_command117.apply(this, arguments);
        const id = this._params[0];
        if (this._childInterpreter) this._childInterpreter._commonEventId = id;
        return r;
    };
    //そのinterpreterの末端のchildを返す
    Game_Interpreter.prototype.getLastChild = function () {
        let itp = this;
        while (itp && itp._childInterpreter && itp._childInterpreter.isRunning()) {
            itp = itp._childInterpreter;
        }
        return itp;
    };

    //-----------------------------------------------------------------------------
    // Sprite_Battlerに機能追加
    //-----------------------------------------------------------------------------

    //ジャンプ移動
    Sprite_Battler.prototype.startJump = function(x, y, duration, jumpHeight = 36) {
        this._targetOffsetX = x;
        this._targetOffsetY = y;
        this._movementDuration = duration;

        this._jumpHeight = jumpHeight;
        this._jumpPeak = duration / 2;

        if (duration === 0) {
            this._offsetX = x;
            this._offsetY = y;
            this._jumpHeight = 0;
            this._jumpOffsetY = 0;
        }
    };
    var _Sprite_Battler_startMove = Sprite_Battler.prototype.startMove;
    Sprite_Battler.prototype.startMove = function (x, y, duration) {
        _Sprite_Battler_startMove.apply(this, arguments);
        this._jumpOffsetY = this._jumpHeight = 0;
    };

    //回転
    Sprite_Battler.prototype.startRotate = function (angle, duration) {
        this._targetRotation = angle / 180 * Math.PI;
        this._rotateDuration = duration;
        if (duration === 0) {
            this.roration = this._targetRotation;
            var a = 24;
            this._rotateOffsetX = -(this.height * this.scale.y / 2 - a) * Math.sin(this.rotation);
            this._rotateOffsetY = (this.height * this.scale.y / 2 - a) * (Math.cos(this.rotation) - 1);
        }
    };

    Sprite_Battler.prototype.updateMove = function() {
        if (this._movementDuration > 0) {
            const d = this._movementDuration;
            this._offsetX = (this._offsetX * (d - 1) + this._targetOffsetX) / d;
            this._offsetY = (this._offsetY * (d - 1) + this._targetOffsetY) / d;

            // 放物線ジャンプ（自然な山）
            if (this._jumpHeight > 0 && this._jumpPeak > 0) {
                const t = this._jumpPeak;
                const progress = (t - d) / t; // -1 → 1
                const jumpRate = 1 - progress * progress; // 放物線
                this._jumpOffsetY = -this._jumpHeight * jumpRate;
            } else {
                this._jumpOffsetY = 0;
            }

            this._movementDuration--;
            if (this._movementDuration === 0) {
                this._jumpOffsetY = this._jumpHeight = 0;
                this.onMoveEnd();
            }
        }

        if (this._rotateDuration > 0) { //回転更新
            const d = this._rotateDuration;
            this.rotation = (this.rotation * (d - 1) + this._targetRotation) / d;
            var a = 24;
            this._rotateOffsetX = -(this.height * this.scale.y / 2 - a) * Math.sin(this.rotation);
            this._rotateOffsetY = (this.height * this.scale.y / 2 - a) * (Math.cos(this.rotation) - 1);
            this._rotateDuration--;
            if (this._rotateDuration === 0) {
                this.roration = this._targetRotation;
            }
        }
    };
    Sprite_Battler.prototype.updatePosition = function() {
        this.x = this._homeX + this._offsetX + (this._rotateOffsetX || 0);
        this.y = this._homeY + this._offsetY + (this._rotateOffsetY || 0) +
            (this._jumpOffsetY || 0) - (this._floatHeight || 0);
    };
    
    //ジャンプを加味したソート
    Tilemap.prototype._compareChildOrder = function(a, b) {
        var ay = a.y - (a._jumpOffsetY || 0) + (a._floatHeight || 0);
        var by = b.y - (b._jumpOffsetY || 0) + (b._floatHeight || 0);
        if (a.z !== b.z) {
            return a.z - b.z;
        } else if (ay !== by) {
            return ay - by;
        } else {
            return a.spriteId - b.spriteId;
        }
    };
    
    //イージングを利用した移動
    var _Sprite_Battler_startMove2 = Sprite_Battler.prototype.startMove;
    Sprite_Battler.prototype.startMove = function(x, y, duration) {
        if (this._moveEasing) {
            SceneManager.setEasing(this, '_offsetX', this._moveEasing, this._offsetX, x, duration);
            SceneManager.setEasing(this, '_offsetY', this._moveEasing, this._offsetY, y, duration);
        } else _Sprite_Battler_startMove2.apply(this, arguments);
    };

    //window._noInput がONのとき、入力を受け付けない（チュートリアル用）
    const _Window_Selectable_processCursorMove = Window_Selectable.prototype.processCursorMove;
    Window_Selectable.prototype.processCursorMove = function () {
        if (this._noInput) return;
        _Window_Selectable_processCursorMove.apply(this, arguments);
    };
    const _Window_Selectable_processHandling = Window_Selectable.prototype.processHandling;
    Window_Selectable.prototype.processHandling = function () {
        if (this._noInput) return;
        _Window_Selectable_processHandling.apply(this, arguments);
    };

    //ローディング画像の表示改変
    Graphics._paintUpperCanvas = function () {
        this._clearUpperCanvas();
        if (this._loadingImage && this._loadingCount >= 20) {
            var context = this._upperCanvas.getContext('2d');
            var dx = (this._width - this._loadingImage.width) - 24;
            var dy = (this._height - this._loadingImage.height) - 24;
            var alpha = ((this._loadingCount - 10) / 20).clamp(0, 1);
            context.save();
            context.globalAlpha = alpha;
            context.drawImage(this._loadingImage, dx, dy);
            context.restore();
        }
    };

    //倍速禁止（テストモードではOK）
    const _Scene_Map_isFastForward = Scene_Map.prototype.isFastForward;
    Scene_Map.prototype.isFastForward = function () {
        return _Scene_Map_isFastForward.apply(this, arguments) && $gameTemp.isPlaytest();
    };

    //-----------------------------------------------------------------------------
    // パーティ歩行の間隔を開ける && 隊列特殊処理
    //-----------------------------------------------------------------------------
    
    Game_Followers.prototype.initialize = function () {
        this._visible = $dataSystem.optFollowers;
        this._gathering = false;
        this._data = [];
        for (var i = 1; i < $gameParty.maxBattleMembers() * 2 - 1; i++) {
            this._data.push(new Game_Follower(i));
        }
    };
    Game_Follower.prototype.actor = function () {
        return $gameParty.battleMembers()[this._memberIndex % 2 ? 5 : this._memberIndex / 2];
    };
    var _Game_Player_reserveTransfer_ZXC = Game_Player.prototype.reserveTransfer;
    Game_Player.prototype.reserveTransfer = function (mapId, x, y, d, fadeType) {
        this._fadeInOnTransfer = $gameSwitches.value(32);
        _Game_Player_reserveTransfer_ZXC.apply(this, arguments);
    };
    var _Game_Player_performTransfer_ZXC = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function () {
        var wasTransferring = this.isTransferring();
        _Game_Player_performTransfer_ZXC.apply(this, arguments);
        if (!wasTransferring) return;
        var unit = 1, dx = 0, dy = 0;
        switch (this.direction()) {
            case 2: dy = -unit; break; case 8: dy =  unit; break;
            case 4: dx =  unit; break; case 6: dx = -unit; break;
            default: break;
        }
        if (dx === 0 && dy === 0) return;
        this.followers().forEach(function (follower, index) {
            var offset = index + 1;
            follower.locate(this.x + dx * offset, this.y + dy * offset);
            follower.setDirection(this.direction());
        }, this);
        if (this.resetPrevPos) this.resetPrevPos();
        var fadeSwitchOn = this._fadeInOnTransfer === true;
        this._fadeInOnTransfer = false;
        if (fadeSwitchOn) $gameSwitches.setValue(32, false);
        var fadeTargetX = this.x;
        var fadeTargetY = this.y;
        this.followers().forEach(function (follower) {
            if (fadeSwitchOn) {
                follower._fadeInPending = true;
                follower._fadeInTargetX = fadeTargetX, follower._fadeInTargetY = fadeTargetY;
                follower.setOpacity(0);
            } else if (follower._fadeInPending) {
                follower._fadeInPending = false;
                follower._fadeInTargetX = follower._fadeInTargetY = null;
                follower.setOpacity(255);
            }
        }, this);
    };
    var _Game_Follower_update_ZXC = Game_Follower.prototype.update;
    Game_Follower.prototype.update = function () {
        _Game_Follower_update_ZXC.apply(this, arguments);
        if (!this._fadeInPending) return;
        var targetX = this._fadeInTargetX, targetY = this._fadeInTargetY;
        if (targetX === undefined || targetY === undefined) return;
        var reached = this.posUnit ? this.posUnit(targetX, targetY) : this.pos(targetX, targetY);
        if (reached) {
            this._fadeInPending = false;
            this._fadeInTargetX = this._fadeInTargetY = null;
            this.setOpacity(255);
        } else {
            this.setOpacity(0);
        }
    };
    var _Game_Follower_canPass_ZXC = Game_Follower.prototype.canPass;
    Game_Follower.prototype.canPass = function (x, y, d) {
        if (d % 2 !== 0 && this.divideDirection) {
            var divide = this.divideDirection(d);
            var x2d = $gameMap.roundXWithDirection(x, divide.horizon), y2d = $gameMap.roundYWithDirection(y, divide.vertical);
            if (!$gameMap.isValid(x2d, y2d)) return true;
        } else {
            var x2 = $gameMap.roundXWithDirection(x, d), y2 = $gameMap.roundYWithDirection(y, d);
            if (!$gameMap.isValid(x2, y2)) return true;
        }
        return _Game_Follower_canPass_ZXC.apply(this, arguments);
    };

    //-----------------------------------------------------------------------------
    // 疑似パーティクル機能
    //-----------------------------------------------------------------------------
    
    Sprite_Particle.prototype = Object.create(Sprite_Base.prototype);
    Sprite_Particle.prototype.constructor = Sprite_Particle;

    Sprite_Particle.prototype.initialize = function(type) {
        Sprite_Base.prototype.initialize.call(this);
        this._type = type;
        this._count = 0;
        this._params = [];
    };

    Sprite_Particle.prototype.addAnimation = function(animation) {
        var sprite = new Sprite_Animation();
        sprite.z = 3;
        sprite.setup(this, animation);
        SceneManager._scene._spriteset.addChild(sprite);
        this._animationSprites.push(sprite);
        return sprite;
    };
    
    Sprite_Particle.prototype.update = function() {
        Sprite_Base.prototype.update.call(this);
        if (this._type === 'smog') { //煙
            if (this._count % (this._params[0] || 16) === 0) {
                var sp = this.addAnimation($dataAnimations[_rand(7, 8)]);
                sp._particleAnimation = true;
                sp.scale.x = sp.scale.y = _rand(80, 120) / 100 * this.parent.scale.x;
                var r = _rand(0, 360) / 180 * Math.PI;
                for (var p = this.parent, ox = this.x, oy = this.y; p; ) ox += p.x || 0, oy += p.y || 0, p = p.parent;
                sp.x = ox + _rand(0, 24) * Math.sin(r), sp.y = oy + _rand(0, 24) * Math.cos(r)
                sp._rate = 6, sp.setupDuration();
                sp.updatePosition();
            }
            if (this._count > Infinity) this._end = true;
            
        } else if (this._type === 'collapseSmog') { //倒した時の煙
            if (this._count % (this._params[0] || 12) === 0) {
                var sp = this.addAnimation($dataAnimations[_rand(7, 8)]);
                sp._particleAnimation = true;
                sp.scale.x = sp.scale.y = _rand(50, 100) / 100 * (180 - this._count) / 120;
                for (var p = this.parent, ox = this.x, oy = this.y; p; ) ox += p.x || 0, oy += p.y || 0, p = p.parent;
                sp.x = ox, sp.y = oy;
                sp._rate = 6, sp.setupDuration();
                sp.updatePosition();
            }
            if (this._count > Infinity) this._end = true;
            
        } else if (this._type === 'buttonFailed') { //ボタン失敗後
            if (this._count % 16 === 0) {
                var sp = this.addAnimation($dataAnimations[11]);
                sp._particleAnimation = true;
                for (var p = this.parent, ox = this.x, oy = this.y; p; ) ox += p.x || 0, oy += p.y || 0, p = p.parent;
                sp.x = ox, sp.y = oy;
                sp.updatePosition();
            }
            if (this._count > Infinity) this._end = true;
            
        } else if (this._type === 'smogOsmRun') { //「おさむ」の走る煙
            if (this._count % (15) === 0) {
                var sp = this.addAnimation($dataAnimations[26]);
                sp._particleAnimation = true;
                for (var p = this.parent, ox = this.x, oy = this.y; p; ) ox += p.x || 0, oy += p.y || 0, p = p.parent;
                sp.x = ox, sp.y = oy;
                sp.updatePosition();
            }
            if (this._count > Infinity) this._end = true;

        } else if (this._type === 'biribiri') { //「みぃー」の電気纏
            if (!$gameSwitches.value(18) && this._count % (this._params[0] || 90) === 0) {
                var sp = this.addAnimation($dataAnimations[_rand(31, 33)]);
                sp._particleAnimation = true;
                for (var p = this.parent, ox = this.x, oy = this.y; p;) ox += p.x || 0, oy += p.y || 0, p = p.parent;
                sp.x = ox, sp.y = oy;
                var r = _rand(0, 360) / 180 * Math.PI;
                sp.x += 60 + 160 * Math.sin(r);
                sp.y += -150 + 100 * Math.cos(r);
                sp.rotation = r - Math.PI / 2;
                sp.scale.x = sp.scale.y = _rand(60, 100) / 100;
                sp.scale.x *= Math.randomInt(2) ? -1 : 1;
                sp.updatePosition();
            }
            if (this._count > Infinity) this._end = true;
        }

            
        this._count++;
    };

    Sprite_Particle.prototype.end = function() {
        this._animationSprites.forEach(function(sp) {
            SceneManager._scene._spriteset.removeChild(sp);
        })
        this._animationSprites = [];
        this.parent.removeChild(this);
    };
    
    var _Sprite_Animation_updatePosition = Sprite_Animation.prototype.updatePosition;
    Sprite_Animation.prototype.updatePosition = function() {
        if (!this._particleAnimation) _Sprite_Animation_updatePosition.apply(this, arguments);
    };

    var _Sprite_Animation_loadBitmaps = Sprite_Animation.prototype.loadBitmaps;
    Sprite_Animation.prototype.loadBitmaps = function() {
        _Sprite_Animation_loadBitmaps.apply(this, arguments);
        if (this._bitmap1) this._bitmap1.smooth = false;
        if (this._bitmap2) this._bitmap2.smooth = false;
    };
    
    //-----------------------------------------------------------------------------
    // ニューゲーム初期位置の差し替え
    //-----------------------------------------------------------------------------

    var _DataManager_setupNewGame_ZXC = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame_ZXC.apply(this, arguments);
        if (!$gameTemp.isPlaytest() || _debug.get('startMode') === 'newGame') {
            $gamePlayer.reserveTransfer(3, 10, 6);
        }
    };

    //-----------------------------------------------------------------------------
    // セーブする項目を整備
    //-----------------------------------------------------------------------------

    DataManager.makeSaveContents = function() {
        var contents = {};

        contents.system       = JsonEx.makeDeepCopy($gameSystem);
        contents.screen       = $gameScreen;
        //        contents.timer        = $gameTimer;
        contents.switches     = $gameSwitches;
        contents.variables    = $gameVariables;
        contents.selfSwitches = $gameSelfSwitches;
        contents.actors       = $gameActors;
        contents.party        = $gameParty;
        contents.map          = $gameMap;
        contents.player       = $gamePlayer;

        return contents;
    };

    DataManager.extractSaveContents = function(contents) {
        $gameSystem        = contents.system;
        $gameScreen        = contents.screen;
        $gameTimer         = new Game_Timer();
        $gameSwitches      = contents.switches;
        $gameVariables     = contents.variables;
        $gameSelfSwitches  = contents.selfSwitches;
        $gameActors        = contents.actors;
        $gameParty         = contents.party;
        $gameMap           = contents.map;
        if ($gameMap._mapGenerator) $gameMap._mapGenerator = null;
        $gamePlayer        = contents.player;

        $gameTemp._loaded = true;
    };

    //-----------------------------------------------------------------------------
    // 軽量化
    //-----------------------------------------------------------------------------

    var _Game_Event_refresh = Game_Event.prototype.refresh;
    Game_Event.prototype.refresh = function() {
        if (!this.event()) return;
        _Game_Event_refresh.apply(this, arguments);
        this._important = !!this.event().meta.important;
        this._sizeBuffer = Number(this.event().meta.sizeBuffer) || 0;
    };
    
    Game_CharacterBase.prototype.isInsideRange = function(sx, sy, a) {
        var w = this._KNHBlockWidth || 1, h = this._KNHBlockHeight || 2;
        var x = this.x - (Math.ceil(w / 2) - 0.5), y = this.y - h;
        var cx = $gameMap.displayX() + 8.5, cy = $gameMap.displayY() + 6.5;
        return (x + w >= cx - sx - a) && (x < cx + sx + a) &&
            (y + h >= cy - sy - a) && (y <= cy + sy + a);
    };
    //近くにいるか
    Game_CharacterBase.prototype.isNearPlayer = function() {
        return this.isInsideRange(1, 1, 0);
    };
    //画面外にいるか
    Game_CharacterBase.prototype.isOutOfScreen = function() {
        return !this.isInsideRange(8, 6, 3 + (this._sizeBuffer || 0));
    };
    
    //軽量化用
    Game_CharacterBase.prototype.needNotUpdate = function() {
        if (!$dataMap || !this._eventId || !this.event()) return false;
        return !this._important &&
            (this.isOutOfScreen() || this._pageIndex < 0);
    };

    Game_CharacterBase.prototype.needNotSprite = function() {
        if (!$dataMap || !this._eventId || !this.event()) return true;
        return this.needNotUpdate();
    };

    Game_CharacterBase.prototype.needNot = function() {
        if (!$dataMap || !this._eventId || !this.event()) return false;
        return this.needNotUpdate() && !this.isInsideRange(16, 12, 2);
    };
    
    Game_Map.prototype.events = function(all) {
        if (all) return this._events.filter(function(event) {
            return !!event;
        });

        var info = [$gameMap.displayX(), $gameMap.displayY()];
        if (!this._nearEvents || !this._nearEvents.length || !this._lastPlayerXyInfo ||
            this._lastPlayerXyInfo[0] !== info[0] || this._lastPlayerXyInfo[1] !== info[1]) {
            this._lastPlayerXyInfo = info;
            if (!this._periEvents || !this._periEvents.length || !this._lastPlayerXyInfo2 ||
                Math.abs(this._lastPlayerXyInfo2[0] - info[0]) > 12 ||
                Math.abs(this._lastPlayerXyInfo2[1] - info[1]) > 6)
            {
                this._lastPlayerXyInfo2 = info;
                this._periEvents = this._events.filter(function(event) {
                    return !!event && !event.needNot();
                });
            }
            this._nearEvents = this._periEvents.filter(function(event) {
                return !event.needNotUpdate();
            });
        }
        return this._nearEvents;
    };

    Game_Map.prototype.rejudgeEvents = function() {
        this._lastPlayerXyInfo = this._lastPlayerXyInfo2 = null;
        if (SceneManager._scene._spriteset) SceneManager._scene._spriteset.refreshChildCharacters();
    };

    Game_Map.prototype.setupEvents = function() {
        if ($gamePlayer.isNeedMapReload()) this.unlinkPrefabEvents();
        
        this._events = [];
        this._periEvents = [];
        this._nearEvents = [];
        for (var i = 0; i < $dataMap.events.length; i++) {
            if ($dataMap.events[i] && ($gameTemp.isPlaytest() && !_debug.get('recordMode') || $dataMap.events[i].name !== 'debug')) 
                this._events[i] = new Game_Event(this._mapId, i);
        }
        this._commonEvents = this.parallelCommonEvents().map(function(commonEvent) {
            return new Game_CommonEvent(commonEvent.id);
        });
        this.refreshTileEvents();
        this.rejudgeEvents();
        
        this._eventIdSequence = this._events.length || 1;
        this.setupInitialSpawnEvents();
    };


    var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        this._characterSprites = null;
        this._characterSprites = [];
        var frame = 0;
        var self = this;
        $gameMap.events(true).forEach(function(event) {
            setTimeout(function() {
                self._characterSprites.push(new Sprite_Character(event));
            }, frame);
            if (!$gameTemp.isPlaytest()) frame++;
        }, this);
        $gameMap.vehicles().forEach(function(vehicle) {
            //this._characterSprites.push(new Sprite_Character(vehicle));
        }, this);
        $gamePlayer.followers().reverseEach(function(follower) {
            this._characterSprites.push(new Sprite_Character(follower));
        }, this);
        setTimeout(function() {
            self._characterSprites.push(new Sprite_Character($gamePlayer));
            SceneManager._scene._created = 1;
        }, frame);
        SceneManager._scene._requestWaitCreating = true;

        this._playAnimationSprite = new Sprite_Base();
        this._playAnimationSprite.move(0, 0, Graphics.boxWidth, Graphics.boxHeight);
        this._baseSprite.addChild(this._playAnimationSprite);
    };

    var _Scene_Map_isReady = Scene_Map.prototype.isReady;
    Scene_Map.prototype.isReady = function() {
        if (this._created === 0) {
        } else if (this._created >= 1) {
            if (++this._created >= 30) {
                $gameMap.rejudgeEvents();
                this._requestWaitCreating = false;
                return true;
            }
        } else if (_Scene_Map_isReady.apply(this, arguments)) {
            if (this._requestWaitCreating) this._created = 0;
            else return true;
        }
        return false
    };

    Spriteset_Map.prototype.refreshChildCharacters = function() {
        this._characterSprites.forEach(function(sprite) {
            var ch = sprite._character;
            if (sprite._drawed) {
                this._tilemap.removeChild(sprite);
                if (sprite._shadowSprite) this._tilemap.removeChild(sprite._shadowSprite);
            }
            if (!ch || !ch._eventId || !ch.needNotSprite()) {
                var parent = ch._husen? SceneManager._scene._noteLine : this._tilemap;
                if (sprite._shadowSprite) parent.addChild(sprite._shadowSprite);
                parent.addChild(sprite);
                sprite._drawed = true;
            } else {
                sprite.opacity = 0;
                sprite._drawed = false;
            }
        }, this);
        this._tilemap._sortChildren();
    };

    var __Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        __Spriteset_Map_update.apply(this, arguments);
        var info = [$gameMap.displayX(), $gameMap.displayY()];
        if (!this._lastPlayerXyInfo ||
            Math.abs(this._lastPlayerXyInfo[0] - info[0]) >= 2 ||
            Math.abs(this._lastPlayerXyInfo[1] - info[1]) >= 2)
        {
            this._lastPlayerXyInfo = info;
            this.refreshChildCharacters();
        }
    };

    var _Game_Map_refresh = Game_Map.prototype.refresh;
    Game_Map.prototype.refresh = function() {
        _Game_Map_refresh.apply(this, arguments);
    };

    //メモリリーク防止用
    var _DataManager_loadMapData = DataManager.loadMapData;
    DataManager.loadMapData = function(mapId) {
        if ($dataMap) $dataMap = null;
        _DataManager_loadMapData.apply(this, arguments);
    };
    
})();
