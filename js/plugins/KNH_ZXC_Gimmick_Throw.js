/*:
 * @plugindesc KNH_ZXC_Gimmick_Throw - Scene_Map上で動く投擲ミニゲーム（v1.2.2） v1.1.0
 * @author KNH
 *
 * @help
 * ■概要
 * Scene_Map上で、プレイヤーから右方向に弾を投げて、指定イベント（ターゲットRect）に当てるミニゲームです。
 * 矢印（img/system/UI_throwArrow.png）は右向き画像を回転させて表示します。
 * 弾画像は img/bullets/ 配下から読み込みます。
 *
 * ■今回追加（v1.1.0）
 *  - 弾を連続で投げられる（前の弾の終了を待たずに次の投擲が可能）
 *  - 次の投擲開始時に矢印角度をリセットしない
 *  - 弾が地面に2回当たると消滅し、任意の消滅アニメを弾位置で再生（vanishAnimationId）
 *  - 弾が対象物にHitしたとき、任意のHitアニメを弾位置で再生（hitAnimationId）
 *  - 終了は「投擲回数を使い切り、全弾が判定済み、かつ再生中アニメが無くなった時」に行う
 *
 * ■開始（イベントコマンド「スクリプト」）
 *   KNH_ZXC_Throw.start({
 *     targetEventId: 3,              // 当てたいイベントID（必須）
 *     throwCount: 3,                 // 投げる回数（default 1）
 *     bulletFile: "stone.png",       // img/bullets/ 内のファイル名（必須）
 *     bulletRadius: 12,              // 円判定半径px（default 12）
 *     bulletSpeed: 18,               // 初速（px/frame）（default 18）
 *     trajectory: "gravity",         // "linear" or "gravity"（default "gravity"）
 *     gravityBase: 0.45,             // 重力（default 0.45）※trajectory="gravity"で有効
 *     weight: 1.0,                   // 重さ（default 1.0）重いほどバウンド減衰/落下強め
 *
 *     rectW: 48,                     // ターゲットRect幅px（default 48）
 *     rectH: 48,                     // ターゲットRect高さpx（default 48）
 *     rectOffsetX: 0,                // イベント中心からの補正px（default 0）
 *     rectOffsetY: -24,              // イベント足元からの補正px（default -tileH/2）
 *
 *     angleMinDeg: -90,              // 矢印角度最小（default -90）
 *     angleMaxDeg:  15,              // 矢印角度最大（default 15）
 *     angleSpeedDeg: 3.0,            // 角度の往復速度（deg/frame）（default 3）
 *
 *     startOffsetX: 24,              // 投擲開始点：プレイヤー中心から右へpx（default 24）
 *     startLiftY: 50,                // 投擲開始点：地面より上へpx（default 50）
 *
 *     passMargin: 64,                // ターゲット右端をどれだけ通過したらMISSか（default 64）
 *     stopSpeed: 0.35,               // 速度がこれ未満なら停止MISS（default 0.35）
 *
 *     restitutionBase: 0.72,         // 地面反発の基礎（default 0.72）
 *     frictionBase: 0.4,             // 地面摩擦の基礎（default 0.4）
 *
 *     hitAnimationId: 0,             // 命中時に再生するアニメID（$dataAnimations[n]）
 *     vanishAnimationId: 0           // 地面2回で消滅時に再生するアニメID（$dataAnimations[n]）
 *   });
 *
 * ■終了
 *   KNH_ZXC_Throw.end();
 *
 * ■結果
 *   - 1投ごとに $gameTemp._throwResult[index] に格納されます（配列、index=投擲順0..）
 *   - 直近の判定は $gameTemp._throwJudge に入ります
 *   grade: "GOD" / "OK" / "MISS"
 *
 * ■制御
 *   - ミニゲーム中はプレイヤー移動＆メニューを禁止します
 *   - $gameMap._interpreter が isRunning() の間はミニゲームを一時停止します（物理・矢印の往復停止）
 *
 * ■注意
 *   - セーブ/ロードは加味しません（ミニゲーム中にセーブされない想定）
 *   - ターゲットイベントが存在しない場合、投げた弾は「通過/停止/地面2回」でMISSになります
 */
(function () {
  'use strict';

  // =========================
  // Debug flags (edit in plugin code)
  // =========================
  // true: ターゲットRectを赤枠で表示（当たり判定の確認用）
  var DEBUG_DRAW_TARGET_RECT = true;

  // =========================
  // Utilities
  // =========================
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function degToRad(d) { return d * Math.PI / 180; }
  function radToDeg(r) { return r * 180 / Math.PI; }

  function tileW() { return $gameMap.tileWidth(); }
  function tileH() { return $gameMap.tileHeight(); }

  function playerCenterMapX() { return $gamePlayer._realX * tileW() + tileW() / 2; }
  function playerGroundMapY() { return $gamePlayer._realY * tileH() + tileH(); }
  function eventCenterMapX(ev) { return ev._realX * tileW() + tileW() / 2; }
  function eventFootMapY(ev) { return ev._realY * tileH() + tileH(); }

  function mapToScreenX(mapPxX) { return mapPxX - $gameMap.displayX() * tileW(); }
  function mapToScreenY(mapPxY) { return mapPxY - $gameMap.displayY() * tileH(); }

  // circle (cx,cy,r) vs rect (l,t,r,b)
  function circleRectHit(cx, cy, r, left, top, right, bottom) {
    var px = clamp(cx, left, right);
    var py = clamp(cy, top, bottom);
    var dx = cx - px;
    var dy = cy - py;
    return (dx * dx + dy * dy) <= (r * r);
  }

  // =========================
  // Manager
  // =========================
  var DEFAULTS = {
    targetEventId: 0,
    throwCount: 1,
    bulletFile: '',
    bulletRadius: 12,
    bulletSpeed: 20,
    trajectory: 'gravity', // 'linear' | 'gravity'
    gravityBase: 0.45,
    weight: 1.0,

    rectW: 48,
    rectH: 48,
    rectOffsetX: 0,
    rectOffsetY: null, // default -tileH/2

    angleMinDeg: -80,
    angleMaxDeg: 25,
    angleSpeedDeg: 3.0,

    startOffsetX: 24,
    startLiftY: 50,

    passMargin: 64,
    stopSpeed: 0.35,

    restitutionBase: 0.72,
    frictionBase: 0.4,

    godDist: 60,

    hitAnimationId: 0,
    vanishAnimationId: 0,

    // bullet rotation
    bulletRotateMode: 'none',            // 'none' | 'random' | 'velocity'
    bulletRotateRandomMinDeg: -12,       // random回転の角速度下限（deg/frame）
    bulletRotateRandomMaxDeg: 12,        // random回転の角速度上限（deg/frame）
    bulletRotateVelocityOffsetDeg: 0,    // velocity追従時の見た目補正（deg）

    maxGroundHits: 1 // 固定仕様（地面1回で消滅）
  };

  function ThrowManager() {
    this.active = false;
    this.paused = false;
    this.scene = null;

    this.opts = null;

    // aim
    this.angle = 0;
    this.angleDir = 1;

    // sine-wave aim
    this._aimPhase = 0; // rad

    // debug rect
    this._debugRectGfx = null;

    // counts
    this.shotsLeft = 0;
    this.shotSeq = 0;

    // sprites
    this.layer = null;
    this.arrow = null;
    this.bulletBitmap = null;
    this._debugRectGfx = null;

    // active bullets
    this.bullets = []; // {index,x,y,vx,vy,groundHits,groundY,sprite,done}

    // animations holders
    this.animHolders = []; // Sprite_Base with _knhMapX/_knhMapY

    // target rect (map px)
    this.tLeft = 0;
    this.tTop = 0;
    this.tRight = 0;
    this.tBottom = 0;
    this.tCx = 0;
    this.tCy = 0;

    this._textPopSprites = null;
    this._aimBgsCooldown = 0; 
    this._aimBgsSaved = null;
    this._aimBgsPlaying = false; 

    this._nextBulletSprite = null;
    this._bulletBmpCache = null;
    this._nextBulletBmpKey = null;
    this._nextPreviewDelay = 0;
  }

  ThrowManager.prototype._normalizeOpts = function (o) {
    var out = {};
    var k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    if (o) for (k in o) out[k] = o[k];

    out.throwCount = Math.max(1, Number(out.throwCount || 1));
    out.bulletRadius = Math.max(1, Number(out.bulletRadius || 12));
    out.bulletSpeed = Math.max(0, Number(out.bulletSpeed || 18));
    out.gravityBase = Number(out.gravityBase || 0);
    out.weight = Math.max(0.01, Number(out.weight || 1.0));

    out.rectW = Math.max(1, Number(out.rectW || 48));
    out.rectH = Math.max(1, Number(out.rectH || 48));
    out.rectOffsetX = Number(out.rectOffsetX || 0);

    if (out.rectOffsetY == null) out.rectOffsetY = -tileH() / 2;
    out.rectOffsetY = Number(out.rectOffsetY || 0);

    out.angleMinDeg = Number(out.angleMinDeg);
    out.angleMaxDeg = Number(out.angleMaxDeg);
    if (out.angleMinDeg > out.angleMaxDeg) { var tmp = out.angleMinDeg; out.angleMinDeg = out.angleMaxDeg; out.angleMaxDeg = tmp; }
    out.angleSpeedDeg = Math.max(0.01, Number(out.angleSpeedDeg || 3.0));

    out.startOffsetX = Number(out.startOffsetX || 0);
    out.startLiftY = Number(out.startLiftY || 50);

    out.passMargin = Math.max(0, Number(out.passMargin || 0));
    out.stopSpeed = Math.max(0, Number(out.stopSpeed || 0));

    out.restitutionBase = clamp(Number(out.restitutionBase || 0.72), 0.01, 0.99);
    out.frictionBase = clamp(Number(out.frictionBase || 0.4), 0.0, 0.9);

    if (!out.godDist && out.godDist !== 0) {
      out.godDist = Math.min(out.rectW, out.rectH) * 0.15;
    } else {
      out.godDist = Number(out.godDist);
    }

    out.hitAnimationId = Math.max(0, Number(out.hitAnimationId || 0));
    out.vanishAnimationId = Math.max(0, Number(out.vanishAnimationId || 0));
    out.maxGroundHits = Math.max(1, Number(out.maxGroundHits || 2));

    // bullet rotation
    out.bulletRotateMode = String(out.bulletRotateMode || 'none').toLowerCase();
    if (out.bulletRotateMode !== 'random' && out.bulletRotateMode !== 'velocity') out.bulletRotateMode = 'none';
    out.bulletRotateRandomMinDeg = Number(out.bulletRotateRandomMinDeg || -12);
    out.bulletRotateRandomMaxDeg = Number(out.bulletRotateRandomMaxDeg || 12);
    if (out.bulletRotateRandomMinDeg > out.bulletRotateRandomMaxDeg) {
      var t = out.bulletRotateRandomMinDeg;
      out.bulletRotateRandomMinDeg = out.bulletRotateRandomMaxDeg;
      out.bulletRotateRandomMaxDeg = t;
    }
    out.bulletRotateVelocityOffsetDeg = Number(out.bulletRotateVelocityOffsetDeg || 0);

    return out;
  };

  ThrowManager.prototype._ensureLayer = function (scene) {
    if (!scene || !scene._spriteset) return false;
    if (this.layer && this.layer.parent) return true;

    this.layer = new Sprite();
    this.layer.z = 9999;
    scene._spriteset.addChild(this.layer);
    return true;
  };

  ThrowManager.prototype._createArrow = function () {
    if (!this.layer) return;

    if (this.arrow && this.arrow.parent) this.layer.removeChild(this.arrow);

    this.arrow = new Sprite(ImageManager.loadSystem('UI_throwArrow'));
    this.arrow.anchor.x = 0;
    this.arrow.anchor.y = 0.5;
    this.arrow._yuraInfo = [];
    this.layer.addChild(this.arrow);
  };

  ThrowManager.prototype._loadBulletBitmap = function () {
    this.bulletBitmap = ImageManager.loadBitmap('img/bullets/', String(this.opts.bulletFile || ''), 0, true);
  };

  ThrowManager.prototype._createBulletSpriteInstance = function (bitmap) {
    var sp = new Sprite(bitmap || this.bulletBitmap);
    sp.anchor.x = 0.5;
    sp.anchor.y = 0.5;
    sp._yuraInfo = [];
    this.layer.addChild(sp);
    return sp;
  };


  ThrowManager.prototype._destroyAll = function () {
    // bullets
    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      if (b && b.sprite && b.sprite.parent) b.sprite.parent.removeChild(b.sprite);
    }
    this.bullets.length = 0;

    // arrow + layer
    if (this.layer) {
      if (this.arrow && this.arrow.parent) this.layer.removeChild(this.arrow);
      if (this._debugRectGfx && this._debugRectGfx.parent) this._debugRectGfx.parent.removeChild(this._debugRectGfx);
      if (this.layer.parent) this.layer.parent.removeChild(this.layer);
    }
    this.layer = null;
    this.arrow = null;
    this.bulletBitmap = null;
  };

  ThrowManager.prototype.start = function (opts) {
    if (this.active) this.end();

    opts = this._normalizeOpts(opts || {});
    if (!opts.targetEventId || opts.targetEventId <= 0) {
      console.warn('[KNH_ZXC_Throw] targetEventId is required.');
      return false;
    }
    if (!opts.bulletFile) {
      console.warn('[KNH_ZXC_Throw] bulletFile is required (img/bullets/...).');
      return false;
    }

    this.scene = SceneManager._scene;
    if (!this.scene || !(this.scene instanceof Scene_Map)) {
      console.warn('[KNH_ZXC_Throw] start() must be called on Scene_Map.');
      return false;
    }

    this.opts = opts;
    this.active = true;
    this.paused = false;

    // aim init (sine-wave)
    this._aimPhase = -Math.PI / 2; // sin=-1 => angleMin
    this.angleDir = 1;
    this.angle = degToRad(opts.angleMinDeg);

    // counts
    this.shotsLeft = opts.throwCount;
    this.shotSeq = 0;

    // results
    $gameTemp._throwResult = new Array(opts.throwCount);
    $gameTemp._throwJudge = null;

    // sprites
    this._ensureLayer(this.scene);
    this._createArrow();
    this._loadBulletBitmap();
    this._ensureTextPopSprites();
    this._updateNextBulletPreview_();
    this._nextPreviewDelay = 0;

    $gamePlayer.setImageZXC('$001_4', 0, 8);
    $gamePlayer.startFrameAnimation([9], 6);

    // clear runtime arrays
    this.bullets.length = 0;
    this.animHolders.length = 0;

    this._aimBgsCooldown = 0;
    this._aimBgsSaved = null;
    this._aimBgsPlaying = false;
    this._playAimBgs_();

    return true;
  };

  ThrowManager.prototype.end = function () {
    if (!this.active) return;

    this._destroyAll();
    this._stopAimBgs_();

    this.active = false;
    this.paused = false;
    this.scene = null;
    this.opts = null;

    this.shotsLeft = 0;
    this.shotSeq = 0;

    if (this._nextBulletSprite && this._nextBulletSprite.parent) {
      this._nextBulletSprite.parent.removeChild(this._nextBulletSprite);
    }
    this._nextBulletSprite = null;
    this._nextBulletBmpKey = null;

    _timeOut(() => { $gamePlayer.setImageZXC('$001', 0, 6), $gamePlayer.startFrameAnimation([7], 6)}, 18);
  };

  ThrowManager.prototype.isActive = function () { return !!this.active; };

  ThrowManager.prototype._pauseCheck = function () {
    try {
      if ($gameMap && $gameMap._interpreter && $gameMap._interpreter.isRunning()) return true;
    } catch (e) { }
    return false;
  };

  ThrowManager.prototype._updateTargetRect = function () {
    var ev = $gameMap.event(this.opts.targetEventId);
    if (!ev) return false;

    var cx = eventCenterMapX(ev) + Number(this.opts.rectOffsetX || 0);
    var cy = eventFootMapY(ev) + Number(this.opts.rectOffsetY || 0);

    var w = Number(this.opts.rectW || 48);
    var h = Number(this.opts.rectH || 48);

    this.tCx = cx;
    this.tCy = cy;
    this.tLeft = cx - w / 2;
    this.tRight = cx + w / 2;
    this.tTop = cy - h / 2;
    this.tBottom = cy + h / 2;
    return true;
  };

  ThrowManager.prototype._ensureDebugRectGfx = function () {
    if (!DEBUG_DRAW_TARGET_RECT) {
      if (this._debugRectGfx && this._debugRectGfx.parent) this._debugRectGfx.parent.removeChild(this._debugRectGfx);
      this._debugRectGfx = null;
      return;
    }
    if (!this.layer) return;
    if (this._debugRectGfx && this._debugRectGfx.parent) return;
    this._debugRectGfx = new PIXI.Graphics();
    this.layer.addChild(this._debugRectGfx);
  };

  ThrowManager.prototype._updateDebugRectGfx = function () {
    if (!DEBUG_DRAW_TARGET_RECT) return;
    this._ensureDebugRectGfx();
    if (!this._debugRectGfx) return;

    var ok = this._updateTargetRect();
    var g = this._debugRectGfx;
    g.clear();
    if (!ok) return;

    // map px -> screen px
    var l = mapToScreenX(this.tLeft);
    var t = mapToScreenY(this.tTop);
    var w = (this.tRight - this.tLeft);
    var h = (this.tBottom - this.tTop);

    // red stroke + light fill
    g.lineStyle(2, 0xFF0000, 1.0);
    g.beginFill(0xFF0000, 0.15);
    g.drawRect(l, t, w, h);
    g.endFill();
  };

  ThrowManager.prototype._updateArrowSprite = function () {
    if (!this.arrow) return;
    if (this.shotsLeft <= 0) {
      this.arrow.visible = false;
      return;
    }
    var oy = playerGroundMapY() - Number(this.opts.startLiftY || 50);

    // ※ユーザー編集版に合わせ、xはプレイヤー中心に固定
    this.arrow.x = mapToScreenX(playerCenterMapX());
    this.arrow.y = mapToScreenY(oy);
    this.arrow.rotation = this.angle;
    this.arrow.visible = true;
  };

  ThrowManager.prototype._updateAngle = function () {
    // サイン波で角度を往復：端がゆっくり・中間が速い
    var minA = degToRad(Number(this.opts.angleMinDeg));
    var maxA = degToRad(Number(this.opts.angleMaxDeg));
    var amp = (maxA - minA) / 2;
    var mid = (maxA + minA) / 2;

    if (amp <= 0) {
      this.angle = minA;
      return;
    }

    // opts.angleSpeedDeg は「中間付近の最大角速度（deg/frame）」として扱う
    var maxAngVel = degToRad(Number(this.opts.angleSpeedDeg || 3.0));
    var phaseSpeed = maxAngVel / amp;
    if (!isFinite(phaseSpeed) || phaseSpeed <= 0) phaseSpeed = 0.001;

    this._aimPhase += phaseSpeed;
    if (this._aimPhase > Math.PI * 2) this._aimPhase -= Math.PI * 2;

    this.angle = mid + amp * Math.sin(this._aimPhase);
  };

  ThrowManager.prototype._groundParams = function () {
    var w = Number(this.opts.weight || 1.0);

    // heavier => lower restitution, stronger friction
    var rest = Number(this.opts.restitutionBase || 0.72);
    rest = rest / Math.sqrt(w);
    rest = clamp(rest, 0.05, 0.95);

    var frBase = Number(this.opts.frictionBase || 0.4);
    var frMul = 1 - frBase * w;
    frMul = clamp(frMul, 0.05, 0.99);

    return { restitution: rest, frictionMul: frMul };
  };

  ThrowManager.prototype._playAnimationAt = function (animId, mapX, mapY) {
    var data = $dataAnimations[animId];
    if (!data) return;

    var scene = SceneManager._scene;
    if (!scene || !scene._spriteset) return;

    var parent = scene._spriteset._tilemap || scene._spriteset; // layerじゃなくこっちに付ける

    var holder = new Sprite_Base();
    holder._knhMapX = mapX;
    holder._knhMapY = mapY;
    holder.x = mapToScreenX(mapX);
    holder.y = mapToScreenY(mapY);

    // 自分で終わったら消える
    holder.update = function () {
      Sprite_Base.prototype.update.call(this);
      this.x = mapToScreenX(this._knhMapX);
      this.y = mapToScreenY(this._knhMapY);
      if (this.isAnimationPlaying && !this.isAnimationPlaying()) {
        if (this.parent) this.parent.removeChild(this);
      }
    };

    parent.addChild(holder);
    holder.startAnimation(data, false, 0);
  };


  ThrowManager.prototype._updateAnimHolders = function () {
    for (var i = this.animHolders.length - 1; i >= 0; i--) {
      var a = this.animHolders[i];
      if (!a) { this.animHolders.splice(i, 1); continue; }

      // keep following camera
      if (a._knhMapX != null) a.x = mapToScreenX(a._knhMapX);
      if (a._knhMapY != null) a.y = mapToScreenY(a._knhMapY);

      if (a.isAnimationPlaying && !a.isAnimationPlaying()) {
        if (a.parent) a.parent.removeChild(a);
        this.animHolders.splice(i, 1);
      }
    }
  };

  ThrowManager.prototype._ensureTextPopSprites = function () {
    if (this._textPopSprites) return;

    var scene = SceneManager._scene;
    if (!scene || !scene._spriteset) return;

    // ★重要：ミニゲームlayerじゃなく spriteset側にぶら下げる（end()で消えない）
    var parent = scene._spriteset._tilemap || scene._spriteset;

    var tps = this._textPopSprites = [];
    tps[0] = new Sprite_Base();
    tps[1] = new Sprite_Base();

    tps[0].bitmap = tps[1].bitmap = ImageManager.loadSystem('UI_battle_textPop');
    tps[0].anchor = tps[1].anchor = new Point(0.5, 0.5);

    tps[0]._count = tps[1]._count = 0;
    tps[0]._maxCount = tps[1]._maxCount = 60;

    tps[0].opacity = tps[1].opacity = 0;
    tps[0].z = tps[1].z = 9999; // 上に出したいなら高めに

    tps[0]._yuraInfo = tps[1]._yuraInfo = [];

    parent.addChild(tps[0]);
    parent.addChild(tps[1]);
  };

  // judgmentRow: 0=OK, 1=GOD, 2=MISS（※あなたの画像の並びに合わせて変えてOK）
  ThrowManager.prototype._showTextPop = function (judgmentRow, x, y, position) {
    this._ensureTextPopSprites();
    if (!this._textPopSprites) return;

    var tps = this._textPopSprites;
    var tp = tps[position ? 1 : 0];

    tp._count = tp._maxCount;

    // 横128 縦64 の行スプライト想定（battle側流用）
    tp.setFrame(0, judgmentRow * 64, 128, 64);

    tp.x = (x + (position ? -1 : 1) * 64 + _rand(-12, 12)).clamp(128, Graphics.boxWidth - 128);
    tp.y = (y - 120 + _rand(-12, 12)).clamp(24, Graphics.boxHeight - 24);

    tp.rotation = _rand(-12, -3) / 180 * Math.PI;
  };
  ThrowManager.prototype._updateTextPopSprites = function () {
    var tps = this._textPopSprites;
    if (!tps) return;

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
  };

  ThrowManager.prototype._isTextPopBusy = function () {
    var tps = this._textPopSprites;
    if (!tps) return false;
    return (tps[0]._count > 0) || (tps[1]._count > 0);
  };

  ThrowManager.prototype._playAimBgs_ = function () {
    // 例：optsで指定（なければ固定でもOK）
    var name = '00_piropiro';
    if (this._aimBgsPlaying) return;

    // saveBgsで位置を持ってるなら、そこから再開
    if (this._aimBgsSaved && this._aimBgsSaved.name === name) {
      AudioManager.replayBgs(this._aimBgsSaved);
    } else {
      AudioManager.playBgs({ name: name, volume: 90, pitch: 100, pan: 0, pos: 0 });
    }
    this._aimBgsPlaying = true;
  };

  ThrowManager.prototype._stopAimBgs_ = function () {
    if (!this._aimBgsPlaying) return;
    this._aimBgsSaved = AudioManager.saveBgs(); // 位置も保存される
    AudioManager.stopBgs();
    this._aimBgsPlaying = false;
  };

  ThrowManager.prototype._getBulletBitmapForShot_ = function (shotIndex) {
    var name = String(this.opts.bulletFile || '');
    if (this.opts.bulletFile === 'sekiban' && $gameTemp._sekibanBroken[shotIndex]) {
      name = 'sekiban_t';
    }

    // キャッシュしてloadBitmap（毎回ロードしない）
    this._bulletBmpCache = this._bulletBmpCache || {};
    if (!this._bulletBmpCache[name]) {
      this._bulletBmpCache[name] = ImageManager.loadBitmap('img/bullets/', name, 0, true);
    }
    return { key: name, bmp: this._bulletBmpCache[name] };
  };

  ThrowManager.prototype._ensureNextBulletPreview_ = function () {
    if (this._nextBulletSprite) return;
    if (!this.layer) return;

    var sp = new Sprite();
    sp.anchor.x = 0.5;
    sp.anchor.y = 0.5;
    sp._yuraInfo = [];
    sp.visible = false;
    this.layer.addChild(sp);
    this._nextBulletSprite = sp;
  };

  ThrowManager.prototype._updateNextBulletPreview_ = function () {
    this._ensureNextBulletPreview_();
    var sp = this._nextBulletSprite;
    if (!sp) return;

    // 矢印表示中（＝まだ投げ残しあり）のときだけ表示
    if (this.shotsLeft <= 0) { sp.visible = false; return; }

    if (this._nextPreviewDelay > 0) { sp.visible = false; return; }


    // 次に投げる弾（this.shotSeq）のbitmapを取得
    var info = this._getBulletBitmapForShot_(this.shotSeq);
    if (this._nextBulletBmpKey !== info.key) {
      sp.bitmap = sp._baseBitmap = info.bmp;
      sp._lastFrame = null;
      this._nextBulletBmpKey = info.key;
    }

    // プレイヤーの左側に表示（例：x-40）
    var groundY = playerGroundMapY();
    var x = playerCenterMapX() - 68;
    var y = groundY - Number(this.opts.startLiftY || 50);

    sp.x = mapToScreenX(x);
    sp.y = mapToScreenY(y);
    sp.visible = true;
  };


  ThrowManager.prototype._spawnBullet = function () {
    if (this.shotsLeft <= 0) return false;
    if (!this.layer || !this.bulletBitmap) return false;

    var groundY = playerGroundMapY();

    var x = playerCenterMapX() + Number(this.opts.startOffsetX || 0);
    var y = groundY - Number(this.opts.startLiftY || 50);

    var speed = Number(this.opts.bulletSpeed || 18);
    var a = this.angle;
    var vx = speed * Math.cos(a);
    var vy = speed * Math.sin(a);

    var info = this._getBulletBitmapForShot_(this.shotSeq);
    var sp = this._createBulletSpriteInstance(info.bmp);


    sp.x = mapToScreenX(x);
    sp.y = mapToScreenY(y);

    // rotation init
    var rotMode = String(this.opts.bulletRotateMode || 'none');
    var rot = 0;
    var rotVel = 0;
    var rotOffset = degToRad(Number(this.opts.bulletRotateVelocityOffsetDeg || 0));
    if (rotMode === 'random') {
      var rmin = Number(this.opts.bulletRotateRandomMinDeg || -12);
      var rmax = Number(this.opts.bulletRotateRandomMaxDeg || 12);
      if (rmin > rmax) { var tt = rmin; rmin = rmax; rmax = tt; }
      rotVel = degToRad(rmin + Math.random() * (rmax - rmin));
      rot = Math.random() * Math.PI * 2;
      sp.rotation = rot;
    } else if (rotMode === 'velocity') {
      rot = Math.atan2(vy, vx) + rotOffset;
      sp.rotation = rot;
    } else {
      rotMode = 'none';
    }

    var b = {
      index: this.shotSeq,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      rotMode: rotMode,
      rot: rot,
      rotVel: rotVel,
      rotOffset: rotOffset,
      groundY: groundY,
      groundHits: 0,
      sprite: sp,
      done: false
    };

    this.bullets.push(b);
    this.shotSeq += 1;
    this.shotsLeft = Math.max(0, this.shotsLeft - 1);
    this._updateNextBulletPreview_();
    return true;
  };

  ThrowManager.prototype._resolveBullet = function (b, hit, grade, reason, distFromCenter) {
    if (!b || b.done) return;
    b.done = true;

    var judge = {
      index: b.index,
      hit: !!hit,
      grade: String(grade || 'MISS'),
      reason: String(reason || ''),
      angleDeg: radToDeg(this.angle), // 解決時点の矢印角（参考値）
      bulletX: b.x,
      bulletY: b.y,
      distFromCenter: (distFromCenter == null ? null : distFromCenter)
    };

    $gameTemp._throwJudge = judge;
    if (!$gameTemp._throwResult) $gameTemp._throwResult = [];
    $gameTemp._throwResult[b.index] = judge;

    // show text pop
    var row = 2; // MISS
    if (judge.grade === 'GOD') row = 0;
    else if (judge.grade === 'OK') row = 1;
    if (row < 2) {
      var ev = $gameMap.event(this.opts.targetEventId);
      var x = ev._realX * 48, y = ev._realY * 48;
      this._showTextPop(row, x, 300, -1);
    }


    // remove sprite
    if (b.sprite && b.sprite.parent) b.sprite.parent.removeChild(b.sprite);
  };

  ThrowManager.prototype._applyGravityTo = function (b) {
    if (String(this.opts.trajectory || 'gravity') !== 'gravity') return;
    var g = Number(this.opts.gravityBase || 0);
    var w = Number(this.opts.weight || 1.0);
    b.vy += g * w;
  };

  ThrowManager.prototype._updateBulletSprite = function (b) {
    if (!b || !b.sprite) return;
    b.sprite.x = mapToScreenX(b.x);
    b.sprite.y = mapToScreenY(b.y);
  };

  ThrowManager.prototype._updateOneBullet = function (b) {
    if (!b || b.done) return;

    // integrate
    this._applyGravityTo(b);
    b.x += b.vx;
    b.y += b.vy;

    // ground collision
    if (b.y >= b.groundY) {
      b.y = b.groundY;

      if (b.vy > 0) {
        b.groundHits += 1;

        // disappear on N-th ground hit
        if (b.groundHits >= Number(this.opts.maxGroundHits || 2)) {
          this._playAnimationAt(Number(this.opts.vanishAnimationId || 0), b.x, b.y);
          this._resolveBullet(b, false, 'MISS', 'ground', null);
          return;
        }

        // bounce with damping
        var gp = this._groundParams();
        b.vy = -b.vy * gp.restitution;
        b.vx = b.vx * gp.frictionMul;

        if (Math.abs(b.vy) < 0.02) b.vy = 0;
        if (Math.abs(b.vx) < 0.02) b.vx = 0;
      }
    }

    // hit check
    if (this._updateTargetRect()) {
      var hit = circleRectHit(
        b.x, b.y, Number(this.opts.bulletRadius || 12),
        this.tLeft, this.tTop, this.tRight, this.tBottom
      );
      if (hit) {
        var dx = b.x - this.tCx;
        var dy = b.y - this.tCy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var grade = (dist <= Number(this.opts.godDist || 0)) ? 'GOD' : 'OK';

        this._playAnimationAt(Number(this.opts.hitAnimationId || 0), b.x, b.y);
        this._playAnimationAt(Number(grade === 'OK' ? 17 : 18), b.x, b.y);
        this._resolveBullet(b, true, grade, 'hit', dist);
        return;
      }
    }

    // // miss: stop
    // var stop = Number(this.opts.stopSpeed || 0.35);
    // var v2 = b.vx * b.vx + b.vy * b.vy;
    // if (v2 <= stop * stop) {
    //   this._resolveBullet(b, false, 'MISS', 'stop', null);
    //   return;
    // }

    // // miss: pass
    // if (this._updateTargetRect()) {
    //   var margin = Number(this.opts.passMargin || 64);
    //   if (b.x > (this.tRight + margin)) {
    //     this._resolveBullet(b, false, 'MISS', 'pass', null);
    //     return;
    //   }
    // }

    // rotation update
    if (b.sprite) {
      if (b.rotMode === 'random') {
        b.rot += b.rotVel;
        b.sprite.rotation = b.rot;
      } else if (b.rotMode === 'velocity') {
        b.rot = Math.atan2(b.vy, b.vx) + (b.rotOffset || 0);
        b.sprite.rotation = b.rot;
      }
    }

    // update sprite position
    this._updateBulletSprite(b);
  };

  ThrowManager.prototype.update = function (scene) {
    if (!this.active) return;

    // scene changed -> end
    if (!scene || !(scene instanceof Scene_Map)) {
      this.end();
      return;
    }
    this.scene = scene;

    // ensure layer exists
    this._ensureLayer(scene);
    if (!this.arrow) this._createArrow();
    if (!this.bulletBitmap) this._loadBulletBitmap();
    if (this._nextPreviewDelay > 0) this._nextPreviewDelay--;
    this._updateNextBulletPreview_();

    // pause check
    this.paused = this._pauseCheck();

    // update display anchors (even while paused)
    this._updateArrowSprite();
    for (var k = 0; k < this.bullets.length; k++) this._updateBulletSprite(this.bullets[k]);
    this._updateAnimHolders();
    this._updateDebugRectGfx();

    if (this.paused) return;

    // aim update always
    this._updateAngle();
    this._updateArrowSprite();

    // BGS
    if (this.shotsLeft > 0) {
      if (this._aimBgsCooldown > 0) {
        this._aimBgsCooldown--;
      } else {
        this._playAimBgs_();
      }
    } else {
      this._stopAimBgs_();
    }

    // spawn on OK
    if (this.shotsLeft > 0 && Input.isTriggered('ok')) {
      $gameSystem.playSe('Wind4', 90, 110);
      this._stopAimBgs_();
      this._aimBgsCooldown = 3;
      this._spawnBullet();
      $gamePlayer.setImageZXC('$001_4', 0, 8);
      $gamePlayer.startFrameAnimation(this.shotsLeft === 0 ? [10, 11] : [10, 11, 11, 9], 6);
      this._nextPreviewDelay = 18;
      if (this._nextBulletSprite) this._nextBulletSprite.visible = false;
    }

    // update bullets
    for (var i = 0; i < this.bullets.length; i++) {
      this._updateOneBullet(this.bullets[i]);
    }

    // cleanup done bullets
    for (var j = this.bullets.length - 1; j >= 0; j--) {
      if (this.bullets[j] && this.bullets[j].done) this.bullets.splice(j, 1);
    }

    // end condition:
    // - all shots used
    // - all bullets resolved
    // - no pending animations (so Hit/vanish animation is visible)
    if (this.shotsLeft <= 0 && this.bullets.length === 0 && this.animHolders.length === 0 && !this._isTextPopBusy()) {
      this.end();
    }

  };

  // =========================
  // Global API
  // =========================
  var _manager = new ThrowManager();

  window.KNH_ZXC_Throw = {
    start: function (opts) { return _manager.start(opts); },
    end: function () { return _manager.end(); },
    isActive: function () { return _manager.isActive(); },
    _updateOnSceneMap: function (scene) { _manager.update(scene); },
    _updateTextPopOnSceneMap: function () {
      if (_manager && _manager._updateTextPopSprites) _manager._updateTextPopSprites();
    },

  };

  // =========================
  // Hooks
  // =========================
  var _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    _Scene_Map_update.call(this);
    if (window.KNH_ZXC_Throw) window.KNH_ZXC_Throw._updateOnSceneMap(this);
    window.KNH_ZXC_Throw._updateTextPopOnSceneMap();
  };

  var _Scene_Map_terminate = Scene_Map.prototype.terminate;
  Scene_Map.prototype.terminate = function () {
    if (window.KNH_ZXC_Throw && window.KNH_ZXC_Throw.isActive()) {
      window.KNH_ZXC_Throw.end();
    }
    _Scene_Map_terminate.call(this);
  };

  // move disable
  var _Game_Player_canMove = Game_Player.prototype.canMove;
  Game_Player.prototype.canMove = function () {
    if (window.KNH_ZXC_Throw && window.KNH_ZXC_Throw.isActive()) return false;
    return _Game_Player_canMove.call(this);
  };

  // menu disable
  var _Game_System_isMenuEnabled = Game_System.prototype.isMenuEnabled;
  Game_System.prototype.isMenuEnabled = function () {
    if (window.KNH_ZXC_Throw && window.KNH_ZXC_Throw.isActive()) return false;
    return _Game_System_isMenuEnabled.call(this);
  };

})();