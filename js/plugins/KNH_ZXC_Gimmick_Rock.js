//=============================================================================
// KNH_ZXC_Gimmick_Rock.js
//=============================================================================

/*:
 * @plugindesc 岩
 * @author kagaya
 *
 * @help
 */


(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_Gimmick_Rock';

    //-----------------------------------------------------------------------------
    // 岩を持ち上げる・下ろす
    //-----------------------------------------------------------------------------
    
    const ANIM_FRAMES = 12;          // 持ち上げ／降ろしの補間フレーム数
    const TILE_H      = 64;         // 頭上オフセット（タイルの半分）
    
    const _Game_Player_moveByInput = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function() {
        if (this._heldRockEventId) {
            const dir = Input.dir4;
            if (dir) this.setDirection(dir);   // 向きだけ変える
            return;
        }
        _Game_Player_moveByInput.call(this);
    };
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this.updateRockLift();
    };
    Scene_Map.prototype.updateRockLift = function() {
        const p = $gamePlayer;
        if ($gameMap.isEventRunning() || SceneManager._scene._sceneInfo || $gameVariables.value(13) < 3) return;
        if (!Input.isTriggered('ok')) return;
        if (p._heldRockEventId) { //おろす
            const rock = $gameMap.event(p._heldRockEventId);
            if (rock._rockFrame) return;
            if (!rock) { p._heldRockEventId = 0; return; }
            const dir = p.direction(), tx = p.x + [0, -2, 2, 0][dir / 2 - 1], ty = p.y + [2, 0, 0, -2][dir / 2 - 1];
            const canDrop = !$gameMap.isAllNp(Math.round(tx), Math.round(ty));
            if (!canDrop) return;
            rock.startRockDrop(tx, ty);
            _timeOut(function() {p._heldRockEventId = 0}, ANIM_FRAMES)
            return;
        } else { //もちあげる
            const dir = p.direction();
            const targets = this.getRockEvents(p.x + [0, -2, 2, 0][dir / 2 - 1], p.y + [2, 0, 0, -2][dir / 2 - 1], dir);
            const target = targets.find(e => !e._rockState);
            if (target) {
                target.startRockLift();
                p._heldRockEventId = target.eventId();
                p._x = target.x + [0, 2, -2, 0][dir / 2 - 1];
                p._y = target.y + [-2, 0, 0, 2][dir / 2 - 1];
            }
        }
    };
    Scene_Map.prototype.getRockEvents = function(fx, fy) {
        var targets = [];
        for (var i = 0; i < 9; i++)
            targets = targets.concat($gameMap.eventsXyNt(fx + (i % 3) / 2 - 0.5, fy + Math.floor(i / 3) / 2 - 0.5));
        return targets.filter(e => e.event().meta.rock && !e._noRock);
    };
    Game_Event.prototype.startRockLift = function() {
        this._rockState = 'lifting';
        this._rockFrame = 0;
        this._rockOriginalPrio = this._priorityType, this._rockOriginalThru = this.isThrough();
        this.setThrough(true), this.setPriorityType(2);     // 通常より上
        this.playSe('Jump1', 100, 120);
    };
    Game_Event.prototype.startRockDrop = function(tx, ty) {
        this._rockState   = 'dropping';
        this._rockFrame   = 0;
        this._dropTargetX = tx, this._dropTargetY = ty;
        this.playSe('Wind7', 100, 80);
    };
    const _Game_Event_update2 = Game_Event.prototype.update;
    Game_Event.prototype.update = function() {
        _Game_Event_update2.call(this);
        if (this._rockState) this.updateRockCarry();
    };
    Game_Event.prototype.updateRockCarry = function() {
        const p = $gamePlayer;
        switch (this._rockState) {
            case 'lifting': {           // 0 →  -TILE_H へ補間
                this._rockFrame++;
                const t = this._rockFrame / ANIM_FRAMES;
                this._rockOffsetY = -TILE_H * t;
                this._x = p.x, this._y = p.y, this._moveSpeed = 5;
                if (this._rockFrame >= ANIM_FRAMES) this._rockState = 'held';
                break;
            }
            case 'held': {              // 常時プレイヤーに追従
                this._rockFrame   = 0;
                this._rockOffsetY = -TILE_H;
                break;
            }
            case 'dropping': {          // -TILE_H → 0 へ補間
                if (!this._rockFrame) SceneManager.setEasing(this, '_rockOffsetY', 'easeInBack', -TILE_H, 0, ANIM_FRAMES - 1)
                this._rockFrame++;
                if (this._rockFrame >= ANIM_FRAMES) {
                    // 最終配置
                    this._rockState   = null;
                    this._rockOffsetY = 0;
                    this.setThrough(this._rockOriginalThru);
                    this.setPriorityType(this._rockOriginalPrio);
                    this.locate(this._dropTargetX, this._dropTargetY);
                    this.requestAnimation(23);
                    //そこに他の岩があったら壊れる
                    var ev = $gameMap.events().filter(
                         e => e !== this && e.event().meta.rock && !e._noRock && e.distanceFrom(this) <= 1.5
                    )[0];
                    if (ev) {
                        ev._through = true, ev._transparent = true;
                        this._through = true, this._transparent = true;
                        _timeOut(function() {this.requestAnimation(24)}.bind(this), 1);
                        ev.requestAnimation(23);
                        _timeOut(function() {ev.requestAnimation(24)}.bind(this), 1);
                        this.playSe('Break', 100, 90);
                        $gameScreen.startShake(2, 3, 12);
                    } else {
                        this.playSe('Earth3', 60);
                        $gameScreen.startShake(1, 3, 6);
                    }
                } else {
                    // 補間中はプレイヤーから離れつつ置き位置まで線形移動
                    this._x = this._dropTargetX, this._y = this._dropTargetY, this._moveSpeed = 5;
                }
                break;
            }
        }
    };
    const _Sprite_Character_updatePosition = Sprite_Character.prototype.updatePosition;
    Sprite_Character.prototype.updatePosition = function() {
        _Sprite_Character_updatePosition.call(this);
        const c = this._character;
        if (c && c._rockOffsetY) this.y += c._rockOffsetY;
    };

    
    
    // ------------------------------------------------------------
    // 焼き鳥
    // ------------------------------------------------------------
    
    const MAX_SKEWER = 3;                 // 串に刺せる最大数
    const SEARCH_OFF = [[0, 2], [-2,0], [2,0], [0,-2]];
    const SWING_FRAMES = 30;              // 焼き鳥スイング持続フレーム

    // ------------------------------------------------------------
    // 効果音ユーティリティ
    // ------------------------------------------------------------
    function playSwing() {
        AudioManager.playSe({name:'Wind7', volume:90, pitch:100, pan:0});
    }

    // ------------------------------------------------------------
    // Game_Player 拡張
    // ------------------------------------------------------------
    const _GP_initMembers = Game_Player.prototype.initMembers;
    Game_Player.prototype.initMembers = function() {
        _GP_initMembers.call(this);
        this._rockSkewer   = [];  // 刺さった岩の index 配列
        this._yakitoriReady = false;
        this._yakitoriSwing = 0;  // スイング残フレーム
    };

    Game_Player.prototype.rockSkewerCount = function() {
        return this._rockSkewer.length;
    };

    Game_Player.prototype.addRockToSkewer = function(ev) {
        if (this._rockSkewer.length >= MAX_SKEWER) return false;
        ev._skewered = true;          // 二重刺し防止
        ev.setThrough(true);
        ev.setTransparent(true);
        this._rockSkewer.push(ev.direction() / 2 - 1);

        // 焼き鳥完成判定
        if (this._rockSkewer.length >= MAX_SKEWER) {
            this._yakitoriReady = true;
            ImageManager.reserveCharacter('$001_2');
            ImageManager.reserveCharacter('$001_3');
        }
        return true;
    };

    // スイング残カウントを毎フレーム減算
    const _GP_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _GP_update.call(this, sceneActive);
        if (this._yakitoriSwing > 0) this._yakitoriSwing--;
    };

    // ------------------------------------------------------------
    // Scene_Map 拡張 : 串刺し & 焼き鳥スイング
    // ------------------------------------------------------------
    const _SM_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _SM_update.call(this);
        this.updateRockSkewer();
    };

    Scene_Map.prototype.updateRockSkewer = function() {
        if ($gameMap.isEventRunning() || SceneManager._scene._sceneInfo || $gameVariables.value(13) < 5) return;
        if (!Input.isTriggered('E')) return;

        const p = $gamePlayer;

        // 振りモーション中は受け付けない
        if (p._yakitoriSwing > 0) {
            //フリモーション
            return;
        }

        // 焼き鳥完成済み：振る
        if (p._yakitoriReady) {
            p._yakitoriSwing = SWING_FRAMES;
            playSwing();
            this.applyYakitoriHit();
            p.setImage([2, 8].contains(p.direction()) ? '$001_2' : '$001_3');
            p.setOrigin(50, 168 / 288 * 100);
            p.startFrameAnimation([2, 4].contains(p.direction()) ? [0, 1, 2, 3, 4] : [6, 7, 8, 9, 10], SWING_FRAMES / 5);
            p._customPriority = 4;
            var lastDir = p.direction();
            _timeOut(function() {
                p.setImage('$001'), p.setOrigin(50, 100);
                p._walkAnime = true, p._directionFix = false, p._direction = lastDir;
                p.sprite()._yuraInfo = [20, 15, 10];
                p._frameAnimation = false;
                p._customPriority = null;
            }, SWING_FRAMES);
            return;
        }

        // まだ刺す段階：MAXなら不可
        if (p.rockSkewerCount() >= MAX_SKEWER) return;

        // 正面2dot先（独自座標系）の中心
        const dir = p.direction();
        const dx  = SEARCH_OFF[dir/2-1][0];
        const dy  = SEARCH_OFF[dir/2-1][1];
        const fx  = p.x + dx;
        const fy  = p.y + dy;
        const candidates = this.getRockEvents(fx, fy);
        const rock = candidates.find(e => e.event().meta.rock && !e._noRock && !e._skewered && !e._rockState);
        if (rock) {
            p.addRockToSkewer(rock) ? SoundManager.playOk() : SoundManager.playBuzzer();
        }
    };

    // 焼き鳥攻撃判定
    Scene_Map.prototype.applyYakitoriHit = function() {
        const p   = $gamePlayer;
        const dir = p.direction();
        const fx  = p.x + SEARCH_OFF[dir/2-1][0];
        const fy  = p.y + SEARCH_OFF[dir/2-1][1];

        // 前方3x3 破壊
        for (let dx=-2; dx<=2; dx++) {
            for (let dy=-2; dy<=2; dy++) {
                this.getRockEvents(fx+dx, fy+dy)
                    .filter(ev=>ev.event().meta.rock && !ev._noRock && !ev._skewered && !ev._rockState)
                    .forEach(ev=>{
                    var r = Math.atan2(ev.x - p.x, ev.y - p.y);
                    var baseR = [202, 360-12, 360-158, 12][p.direction() / 2 - 1] / 180 * Math.PI;
                    var dr = ((p.direction() === 6 ? baseR - r : r - baseR) + Math.PI * 4) % (Math.PI * 2);
                    _timeOut(function(ev) {
                        ev._through = true;
                        ev._transparent = true;
                        $gameMap.requestMapAnimation(24, ev.x, ev.y);
                        ev.playSe('Break', _rand(70, 90), _rand(90, 120));
                        ev.startShake(2, 3, 6);
                    }.bind(this, ev), Math.max(dr * 6 + _rand(-6, 6), 0))
                });
            }
        }

        // 串リセット
        p._rockSkewer   = [];
        p._yakitoriReady = false;
    };

    // ------------------------------------------------------------
    // Sprite_RockWeapon : プレイヤー子スプライト（串 or 焼き鳥）
    // ------------------------------------------------------------
    function Sprite_RockWeapon() { this.initialize.apply(this, arguments); }
    Sprite_RockWeapon.prototype = Object.create(Sprite_Base.prototype);
    Sprite_RockWeapon.prototype.constructor = Sprite_RockWeapon;

    Sprite_RockWeapon.prototype.initialize = function() {
        Sprite_Base.prototype.initialize.call(this);
        this.anchor.x = 0.5;
        this.anchor.y = 1.0;
        this._currentCount = -1;
        this._yakitariShown = false;
        this.updateBitmap();
    };

    Sprite_RockWeapon.prototype.update = function() {
        Sprite_Base.prototype.update.call(this);
        this.updateBitmap();
        this.updatePosition();
    };

    Sprite_RockWeapon.prototype.updateBitmap = function() {
        const player = $gamePlayer;

        if ($gamePlayer._yakitoriSwing) return;
        // 非所持
        if (!player._yakitoriReady && player.rockSkewerCount() === 0) {
            this.bitmap = null;
            this._yuraInfo = null;
            if (this._rockSprites) {
                this._rockSprites.forEach(sp => {
                    this.removeChild(sp);
                });
                this._rockSprites = null;
            }
            this._yakitariShown = false;
            return;
        }
        if (!this.bitmap) {
            this.bitmap = new Bitmap(96, 280);
            this.bitmap.fillRect((this.bitmap.width - 4) / 2, 0, 4, this.bitmap.height, '#474e51');
            // this._yuraInfo = [20, 15];
//            this.setOutline(0, 1);
        }
        if (!player.sprite()) return;

        const cnt = player.rockSkewerCount();
        if (cnt !== this._currentCount) {
            this._currentCount = cnt;
            var sps = this._rockSprites = this._rockSprites || [];
            $gamePlayer._rockSkewer.forEach(function(index, i) {
                if (sps[i * 2]) return;
                if (i > 0) { //ネギ
                    var nsp = new Sprite_Base();
                    nsp.bitmap = ImageManager.loadSystem('negima');
                    nsp.anchor.x = nsp.anchor.y = 0.5;
                    nsp.y = -20 + -80 * i;
                    nsp._yuraInfo = [20, 20];
                    this.addChild(nsp), sps.push(nsp);
                }
                var sp = new Sprite_Base();
                sp.bitmap = ImageManager.loadCharacter($dataMap.meta.rockBlack ? '$rocks_b' : '$rocks');
                sp.setFrame(96, index * 96, 96, 96);
                sp.anchor.x = sp.anchor.y = 0.5;
                sp.y = -70 + -80 * i;
                sp._yuraInfo = [20, 20];
                this.addChild(sp), sps.push(sp);
            }.bind(this))
        }
    };

    // 持ち位置 & スイング演出
    Sprite_RockWeapon.prototype.updatePosition = function() {
        if (!this.bitmap) return;
        const pdir = $gamePlayer.direction(), pptr = $gamePlayer.pattern();
        if ($gamePlayer._yakitoriSwing > 0) {
            var isUD = $gamePlayer._characterName === '$001_2';
            switch (pdir) { //スイング中
                case 2:
                    this.x = isUD ? [  6, -57, -47][pptr] : [-23, -48, -38][pptr];
                    this.y = isUD ? [-90, -74, -14][pptr] : [-95, -53, -12][pptr];
                    this.rotation = (isUD ? [22, -49, -135] : [-12, -77, -138])[pptr] / 180 * Math.PI;
                    break;
                case 4:
                    this.x = isUD ? [ 32,  45,   0][pptr] : [-18, -18,   0][pptr];
                    this.y = isUD ? [ -6, -28,   0][pptr] : [ -5,  -5,   0][pptr];
                    this.rotation = (isUD ? [156, 123, 0] : [-170, -170, 0])[pptr] / 180 * Math.PI;
                    break;
                case 6:
                    this.x = isUD ? [-23,  34,  33][pptr] : [ 23,  48,  38][pptr];
                    this.y = isUD ? [ -7, -10, -88][pptr] : [-95, -53, -12][pptr];
                    this.rotation = (isUD ? [-158, 131, 45] : [12, 77, 138])[pptr] / 180 * Math.PI;
                    break;
                case 8:
                    this.x = isUD ? [-24, -37,   0][pptr] : [ 18,  18,   0][pptr];
                    this.y = isUD ? [-98, -82,   0][pptr] : [ -5,  -5,   0][pptr];
                    this.rotation = (isUD ? [-24, -57, 0] : [170, 170, 0])[pptr] / 180 * Math.PI;
                    break;
            }
            if ($gamePlayer._yakitoriSwing === 15) {
                this._rockSprites.forEach(sp => _timeOut(function() {
                    sp.startBreakEffect(5);
                    $gameSystem.playSe('Break', _rand(70, 90), _rand(90, 120));
                }, _rand(0, 14)));
            }
        } else {
            switch (pdir) {
                case 2:   // ↓
                    this.x = [-30, -40, -33][pptr];
                    this.y = [-42, -50, -53][pptr];
                    this.rotation = [-10, -15, -10][pptr] / 180 * Math.PI;
                    break;
                case 4:   // ←
                    this.x = [-32, -31, -42][pptr];
                    this.y = [-53, -53, -53][pptr];
                    this.rotation = [3, -5, -10][pptr] / 180 * Math.PI;
                    break;
                case 6:   // →
                    this.x = [32, 31, 42][pptr];
                    this.y = [-53, -53, -53][pptr];
                    this.rotation = [-3, 5, 10][pptr] / 180 * Math.PI;
                    break;
                case 8:   // ↑
                    this.x = [30, 40, 33][pptr];
                    this.y = [-42, -50, -53][pptr];
                    this.rotation = [10, 15, 10][pptr] / 180 * Math.PI;
                    break;
            }
        }
        
        if (this.parent) this.parent.addChild(this);
    };

    // ------------------------------------------------------------
    // Spriteset_Map 拡張 : プレイヤースプライトに addChild
    // ------------------------------------------------------------
    const _SSM_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function () {
        _SSM_createCharacters.call(this);
        this._rockWeaponSprite = new Sprite_RockWeapon();
        this._rockWeaponAttached = false;
    };
    const _SSM_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function () {
        _SSM_update.call(this);
        // まだアタッチできてないなら、取れるまで毎フレーム試す
        if (this._rockWeaponSprite && !this._rockWeaponSprite.parent && !this._rockWeaponAttached) {
            const pspr = $gamePlayer.sprite();
            if (pspr) {
                pspr.addChild(this._rockWeaponSprite);
                this._rockWeaponAttached = true;
            }
        }
    };
    
    //-----------------------------------------------------------------------------
    // 破壊エフェクト
    //-----------------------------------------------------------------------------

    Sprite_Base.prototype.startBreakEffect = function(num) {
        num = num.clamp(3, 90);
        if (!this._breakPartsSprites) this._breakPartsSprites = [];
        for (var i = 0; i < num; i++) {
            for (var j = 0; j < 10; j++) {
                var x = _rand(this._frame.x, this._frame.x + this._frame.width);
                var y = _rand(this._frame.y, this._frame.y + this._frame.height);
                var color = (this._baseBitmap || this.bitmap).getPixel(x, y);
                if (color !== '#000000') {
                    var parent = SceneManager._scene._spriteset._tilemap;
                    const dx = (x - this.bitmap.width  * this.anchor.x) * this.scale.x;
                    const dy = (y - this.bitmap.height * this.anchor.y) * this.scale.y;

                    // (2) 親を含む全階層の行列を適用し、ワールド座標へ
                    const pt = this.worldTransform.apply(new PIXI.Point(dx, dy));

                    const px = pt.x;      // ← this.parent の rotation や移動も全部込み！
                    const py = pt.y;
                    var sprite = new Sprite_BreakParts(this, px, py);
                    parent.addChild(sprite);
                    break;
                }
            }
        }
    };
    Sprite_Base.prototype.eraseBreakEffect = function(sprite) {
        var parent = SceneManager._scene._spriteset._tilemap;
        parent.removeChild(sprite);
        this._breakPartsSprites.splice(this._breakPartsSprites.indexOf(sprite), 1);
        sprite = null;
    };

    function Sprite_BreakParts() {
        this.initialize.apply(this, arguments);
    };

    Sprite_BreakParts.prototype = Object.create(Sprite.prototype);
    Sprite_BreakParts.prototype.constructor = Sprite_BreakParts;

    Sprite_BreakParts.prototype.initialize = function(target, x, y, color) {
        Sprite.prototype.initialize.call(this);
        this._target = target;
        this.x = x, this.y = y;
        this.anchor.x = this.anchor.y = 0.5;
        this.z = 11;
        this.rotation = _rand(0, 360) / 180 * Math.PI;
        this._dx = _rand(-15, 15) / 10, this._dy = _rand(-30, -10) / 10;
        this._dr = _rand(-12, 12) / 180 * Math.PI;
        this.bitmap = ImageManager.loadSystem('rockParts');
        this.setFrame(64 * Math.randomInt(4), 0, 64, 64);
        this.scale.x = this.scale.y = _rand(50, 100) / 100;
        this._count = 0;
        this._erase = false;
    };
    Sprite_BreakParts.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (this._count % 4 === 0) for (var i = 0; i < 4; i++) {
            this.x += this._dx;
            this.y += this._dy, this._dy += 0.1;
            this.rotation = (this.rotation + this._dr + Math.PI * 2) % (Math.PI * 2);
        }
        this._count++;
        if (this._erase || this._count >= _rand(30, 60)) {
            this._erase = true;
            this._target.eraseBreakEffect(this);
        }
    };
    
    

    // ------------------------------------------------------------
    // 操作方法ウィンドウ
    // ------------------------------------------------------------
    
    Game_Interpreter.prototype.command_updateRockHelpWindow = function(posType) {
        var flag = $gameVariables.value(13);
        var info = [
            flag, $gamePlayer._heldRockEventId, $gameVariables.value(32)
        ].concat($gamePlayer._rockSkewer || []).toString();
        if (this._lastInfoRockHelp !== info) {
            this._lastInfoRockHelp = info;
            if (!$gameTemp._rockHelpWindow) {
                var wd = $gameTemp._rockHelpWindow = new Window_Base(33, 0, 300, 0);
                SceneManager._scene.addWindow(wd);
                wd.openness = 0;
            }
            wd = $gameTemp._rockHelpWindow;
            var can1 = flag >= 1 && !$gamePlayer._heldRockEventId && !$gamePlayer._rockSkewer.length;
            var can2 = flag >= 3 && !$gamePlayer._rockSkewer.length;
            var can3 = flag >= 5 && !$gamePlayer._heldRockEventId;
            wd.height = wd.fittingHeight((can1 ? 1 : 0) + (can2 ? 1 : 0) + (can3 ? 1 : 0));
            wd.y = Graphics.boxHeight - wd.height - 33;
            wd.refreshYurayura();
            wd.createContents();
            var y = 0, w = wd.contents.width / 2;
            if (can1) {
                wd.drawText((!$gameVariables.value(32) ? _tl('方向キー長押し') : _tl('方向ボタン長押し')) + '：', 0, y, wd.contents.width - w, 'left');
                wd.drawText(_tl('岩を押す'), wd.contents.width - w, y, w, 'right', 'down');
                y += 33;
            }
            if (can2) {
                if (!$gameVariables.value(32)) wd.drawText(_tl('Enterキー') + '：', 0, y, wd.contents.width - w, 'left');
                else wd.drawTextKNH('\\i[1]：', 0, y, wd.contents.width - w, 'left', 'down');
                wd.drawText($gamePlayer._heldRockEventId ? _tl('岩をおろす') : _tl('岩を持ち上げる'), wd.contents.width - w, y, w, 'right', 'down');
                y += 33;
            }
            if (can3) {
                wd.drawTextKNH(!$gameVariables.value(32) ? _tl('Eキー') + '：' : '\\i[3]：', 0, y, wd.contents.width - w, 'left', 'down');
                wd.drawText($gamePlayer._rockSkewer && $gamePlayer._rockSkewer.length >= 3 ?
                    _tl('焼き鳥をふる') : _tl('岩を串に刺す'),
                    wd.contents.width - w, y, w, 'right', 'down');
            }
            
        }
        var wd = $gameTemp._rockHelpWindow;
        if (!wd) { this._lastInfoRockHelp = null; return; }
        SceneManager._scene.addWindow(wd);
        wd.x = $gameMap.parallaxOx() >= 1000 - Graphics.boxWidth / 2 ? Graphics.boxWidth - wd.width - 33 : 33;
        if (posType === 1) wd.x = Graphics.boxWidth - wd.width - 33, wd.y = 33;
        if ($gameMap.isEventRunning() || SceneManager._scene._sceneInfo) wd.openness = 0;
        else wd.open();
    };

})();
