/*:
 * @plugindesc (MV) Scene_Map継承：線を引いてトランポリンで跳ねる縦スクロール擬似物理ミニゲーム v0.1
 * @author Kagaya+ChatGPT
 *
 * @help
 * ■開始（イベントのスクリプト）
 *   KGG_MiniGame.start({ x:10, y:20, unit:"tile" });
 *   KGG_MiniGame.start({ x:800, y:1200, unit:"pixel" });
 *
 * ■仕様
 * - Scene_Map継承なので、マップ/パララックス/イベント/Interpreterが動く
 * - プレイヤーは透明＆入力移動を一時無効化（終了時に復元）
 * - マウス/タッチで線を引く（線は太さなし判定、総延長500pxを超えると古い線から消える）
 * - ボールが線に当たると「速度を法線方向へ80%寄せ」て跳ねる（係数で速度倍率も可能）
 * - 画面上端はバウンドしない
 * - 画面下に触れたらゲームオーバー→ミニゲーム要素だけ初期化（線消し/ボール初期化/表示位置を開始地点へ）

 * - マップメモ欄に壁線分を定義できる（px指定）
 *   <MGWall: x1,y1,x2,y2> を複数行書く
 *   <MGWallDebug: 1> で壁を赤表示（デバッグ）
 */

(function () {
    "use strict";

    // ----------------------------
    // ユーティリティ
    // ----------------------------
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function clampAbs(v, maxAbs) {
        maxAbs = Math.max(0, Number(maxAbs || 0));
        if (maxAbs <= 0) return v; // 0以下なら制限なし扱いにしたい場合
        if (v > maxAbs) return maxAbs;
        if (v < -maxAbs) return -maxAbs;
        return v;
    }


    function hypot(x, y) {
        return Math.sqrt(x * x + y * y);
    }

    function closestPointOnSegment(px, py, ax, ay, bx, by) {
        const abx = bx - ax;
        const aby = by - ay;
        const apx = px - ax;
        const apy = py - ay;
        const ab2 = abx * abx + aby * aby;
        let t = 0;
        if (ab2 > 0.0000001) t = (apx * abx + apy * aby) / ab2;
        t = clamp(t, 0, 1);
        return { x: ax + abx * t, y: ay + aby * t };
    }

    function makeBallBitmap(radius) {
        const d = Math.max(2, Math.floor(radius * 2));
        const bmp = new Bitmap(d, d);
        // 白い球（見やすさ優先。必要なら好きに変えてOK）
        bmp.drawCircle(radius, radius, radius, "rgba(255,255,255,1)");
        // 輪郭
        bmp.context.save();
        bmp.context.strokeStyle = "rgba(0,0,0,1)";
        bmp.context.lineWidth = 3;
        bmp.context.beginPath();
        bmp.context.arc(radius, radius, Math.max(1, radius - 1.5), 0, Math.PI * 2);
        bmp.context.stroke();
        bmp.context.restore();
        bmp._setDirty();
        return bmp;
    }

    // ----------------------------
    // グローバルAPI（開始座標をスクリプト指定）
    // ----------------------------
    window.KGG_MiniGame = window.KGG_MiniGame || {};

    const DEFAULTS = {
        radius: 30,
        gravity: 400,                 // px/s^2
        scrollSpeed: 30,              // px/s（画面が上に流れる）
        wallRestitution: 0.9,
        trampolineRestitution: 1.2,
        normalRatio: 0.75,             // 速度の8割を法線方向へ

        maxVx: 800,                  // 横の最高速度(px/s)
        maxVy: 1000,                  // 縦の最高速度(px/s)
        minTrampolineNormalSpeed: 500,// トランポリン跳ね返りの最低法線速度(px/s)

        maxLineLength: 700,           // px
        minPointDistance: 8,          // px
        startOffsetFromBottom: 240,   // px（指定なし時の開始Y）

        followMode: "time",       // "distance":距離一定で追従 / "time":フレーム遅れ追従
        followSpacing: 50,            // 距離追従時のボール間隔(px)
        followDelayFrames: 16,         // 時間追従時の遅れ（1体あたりのフレーム / 60fps基準）
        followMinSpacing: 30,        // time追従時の最短間隔(px)。速ければ60以上空くこともある

        // 直線統合（ほぼまっすぐなら線分を増やさず1本にまとめる）
        straightMergeEnabled: true,
        straightMergeAngleDeg: 12,     // 許容角度（度）小さいほど厳しい
        straightMergeMaxOffset: 6,    // 直線からの許容ズレ(px) 小さいほど厳しい

        // 開始カウントダウン
        countdownStepSec: 0.5,        // 3→2→1 1コマの秒数
        countdownGoSec: 0.5,         // GO の表示秒数（この間も停止）
        countdownScale: 1.0,          // カウントダウン表示スケール

        startJumpVy: 200,             // カウントダウン終了後の初速(px/s) 上方向へ飛ばす

        // カメラ（横追従）
        scrollFollowXK: 8.0,          // 追従の強さ（大きいほど早い）
        // 成功時：カメラ追いつき（縦）
        successCamK: 14.0,             // 大きいほど早く追いつく（1/sec）

        // トランポリン命中演出
        trampolineBoingAmp: 30,       // ふくらみ(px)
        trampolineBoingDur: 0.2,     // 持続(sec)

        spinMoveMul: 0.1,            // 移動に応じた回転量（係数）
        spinBounceMul: 0.1,           // 反射に応じた回転量（係数）
        spinBounceRand: 0.98,          // 反射時回転のランダム度（0=ランダムなし / 1=強め）
        spinDamping: 1,            // 回転減衰（60fps基準, 1に近いほど減衰しない）

        keyCursorSpeed: 600,          // キーモードのカーソル速度(px/s)

        // 壁判定の簡易候補抽出
        wallCullEnabled: true,
        wallCullIntervalFrames: 10,    // 候補更新の間隔（frames）
        wallCullMovePx: 50,           // これ以上動いたら即更新(px)
        wallCullExtraMargin: 60,      // 余裕距離(px)
        wallCullGridSize: 128,        // 簡易グリッドサイズ(px)

        wallDebug: false,             // 壁デバッグ描画（trueで赤表示）
        wallDebugColor: "#ff0000"     // 壁デバッグ色
    };

    // 次回起動用のリクエスト
    function setRequest(opts) {
        if (!$gameTemp) return;
        $gameTemp._kggMiniGameReq = Object.assign({}, DEFAULTS, opts || {});
    }

    window.KGG_MiniGame.start = function (opts) {
        setRequest(opts);
        SceneManager.push(Scene_MiniGame);
    };
    window.KGG_MiniGame.retry = function () {
        const rt = window.KGG_MiniGame._rt;
        if (rt && rt.resetMiniGame) rt.resetMiniGame();
    };
    window.KGG_MiniGame.end = function () {
        if (SceneManager._scene && SceneManager._scene.constructor === Scene_MiniGame) {
            // SceneManager.pop();
        }
    };

    // ----------------------------
    // Scene_MiniGame（Scene_Map継承）
    // ----------------------------
    function Scene_MiniGame() {
        this.initialize.apply(this, arguments);
    }
    Scene_MiniGame.prototype = Object.create(Scene_Map.prototype);
    Scene_MiniGame.prototype.constructor = Scene_MiniGame;

    Scene_MiniGame.prototype.initialize = function () {
        Scene_Map.prototype.initialize.call(this);
        this._kggMG = null;
        this._kggPatchedUpdateScroll = null;
    };

    Scene_MiniGame.prototype.create = function () {
        Scene_Map.prototype.create.call(this);

        // マップタッチ移動は使わない
        $gameTemp.clearDestination();

        // ミニゲームレイヤー作成は start() で spriteset/tilemap が確実にある前提で行う
    };

    Scene_MiniGame.prototype.start = function () {
        Scene_Map.prototype.start.call(this);

        // プレイヤーを消して、入力移動を止める
        this._kggOldTransparent = $gamePlayer.isTransparent();
        $gamePlayer.setTransparent(true);

        this._kggPatchedMoveByInput = Game_Player.prototype.moveByInput;
        Game_Player.prototype.moveByInput = function () { /* mini game中は移動しない */ };

        // スクロール追従（プレイヤー中心化）も止める：自動スクロールと競合するため
        this._kggPatchedUpdateScroll = Game_Player.prototype.updateScroll;
        Game_Player.prototype.updateScroll = function () { /* mini game中は画面追従しない */ };

        // リクエスト取得
        const req = ($gameTemp && $gameTemp._kggMiniGameReq) ? $gameTemp._kggMiniGameReq : Object.assign({}, DEFAULTS);
        // 一応クリア（連打時の事故防止）
        if ($gameTemp) $gameTemp._kggMiniGameReq = null;

        this._kggMG = new KggMiniGameRuntime(this, req);
        this._kggMG.onStart();
    };

    Scene_MiniGame.prototype.terminate = function () {
        // 復元
        if (this._kggPatchedMoveByInput) {
            Game_Player.prototype.moveByInput = this._kggPatchedMoveByInput;
            this._kggPatchedMoveByInput = null;
        }

        if (this._kggPatchedUpdateScroll) {
            Game_Player.prototype.updateScroll = this._kggPatchedUpdateScroll;
            this._kggPatchedUpdateScroll = null;
        }
        if (this._kggOldTransparent != null) {
            $gamePlayer.setTransparent(this._kggOldTransparent);
            this._kggOldTransparent = null;
        }

        // レイヤー破棄
        if (this._kggMG) {
            this._kggMG.onTerminate();
            this._kggMG = null;
        }

        Scene_Map.prototype.terminate.call(this);
    };

    // マップタッチ移動は完全無効化（線描画の邪魔になる）
    Scene_MiniGame.prototype.processMapTouch = function () {
        // noop
    };

    Scene_MiniGame.prototype.updateDestination = function () {
        // 目的地移動も潰す
        $gameTemp.clearDestination();
    };

    Scene_MiniGame.prototype.update = function () {
        Scene_Map.prototype.update.call(this);
        if (this._kggMG) this._kggMG.update();
    };

    // ----------------------------
    // ランタイム本体
    // ----------------------------
    function KggMiniGameRuntime(scene, opts) {
        this._scene = scene;
        this._opts = opts;

        this._tilemap = null;
        this._ballSprite = null;   // 先頭（互換用）
        this._ballSprites = [];    // パーティ人数ぶん（最大4）
        this._ballsBitmap = null;  // img/system/balls.png
        this._ballsFrameReady = false;
        this._numBalls = 1;

        // 回転（先頭ボールのみ物理計算、他は追従）
        this._ballAngle = 0;       // rad
        this._ballSpinVel = 0;     // rad/s
        this._spinInfo = [];       // [{scale, offset, bounceMul}, ...]

        // 追従（距離一定 or フレーム遅れ）
        this._followMode = "distance"; // "distance" | "time"
        this._followSpacing = 0;      // px（distance mode）
        this._followDelayFrames = 0;  // frames（time mode）
        this._followMinSpacing = 0;  // px（time mode: 最短間隔）

        // 開始カウントダウン
        this._phase = "countdown";      // "countdown" | "play" | "gameover"
        this._countdownT = 0;
        this._countdownSprite = null;
        this._countdownBmp = null;
        this._countdownFrameW = 0;
        this._countdownFrameH = 0;

        // カメラ（横追従）
        this._camX = null;

        // トランポリン命中ボヨヨン
        this._segBoing = [];            // index -> {t,dur,amp,nx,ny}
        this._needsRedraw = false;

        // time-mode：先頭ボールの履歴から遅れて追いかける
        this._leadHist = [];          // [{x,y,angle}]
        this._leadHistMax = 0;

        // distance-mode：軌跡の距離（S）から一定距離で追従
        this._trail = [];             // [{x,y,angle,s}]
        this._trailMaxDist = 0;

        this._ballStates = [];        // 描画用（各ボールの状態）

        this._ballX = 0; // map pixel
        this._ballY = 0;
        this._vx = 0;
        this._vy = 0;

        this._segments = []; // {ax,ay,bx,by,len}
        this._totalLen = 0;

        this._overlay = null;

        this._lineSprite = null;
        this._lineBmp = null;
        this._lastOriginX = null;
        this._lastOriginY = null;

        // マップ壁（noteからロード）
        this._walls = []; // {ax,ay,bx,by,len}
        this._wallDebug = false;
        // 壁の候補抽出（軽量化）
        this._wallCandidates = null;
        this._wallCandCounter = 0;
        this._wallCandLastX = null;
        this._wallCandLastY = null;
        this._wallGrid = null;
        this._wallGridSize = 0;

        this._drawing = false;
        this._lastPoint = null;


        // 入力モード（最初はキーモード）
        this._pointerMode = "key";      // "key" | "mouse"
        this._cursorX = Graphics.width / 2;
        this._cursorY = Graphics.height / 2;
        this._keyCursorX = this._cursorX;
        this._keyCursorY = this._cursorY;
        this._mouseLastX = TouchInput.x;
        this._mouseLastY = TouchInput.y;
        this._pointerLastTimeMs = 0;

        // Enterキー（Enterのみ判定）
        this._enterDown = false;
        this._enterKeyDownHandler = null;
        this._enterKeyUpHandler = null;
        this._forceClearKeyHandler = null;

        // 描画を開始した入力元（"key"|"mouse"）
        this._drawingBy = null;

        this._lastTimeMs = 0;

        // リセット用
        this._startBall = { x: 0, y: 0 };
        this._startDisplay = { x: 0, y: 0 };

        // ゴール／成功
        this._goalTriggered = false;
        this._successCamActive = false;
        this._successCamTargetY = 0; // tile
        // 落下ゲームオーバー
        this._fallTriggered = false;

        this._scene._cursorSprite = null;
        this._oldCanvasCursor = null;
        this._oldBodyCursor = null;
        this._oldHtmlCursor = null;
        this._cursorHover = true;
        this._cursorHidden = false;
        this._cursorEnterHandler = null;
        this._cursorLeaveHandler = null;

        this._drawSeCounter = 0; // 線描画中SE用（15フレームごと）

        // 画面外（上）表示用の丸窓（ボール1の位置ガイド）
        this._offWin = null;

    }

    KggMiniGameRuntime.prototype.onStart = function () {
        this._tilemap = this._scene._spriteset && this._scene._spriteset._tilemap;
        if (!this._tilemap) return;

        // マップメモ欄から壁をロード
        this._loadWallsFromMapNote();

        // 追加：オーバーレイ（最前面）
        this._overlay = new PIXI.Container();
        this._scene._spriteset._baseSprite.addChild(this._overlay);

        // ここからは overlay に載せる
        // 画面固定の線スプライト（前面）
        this._initLineSprite_();

        // --- ボール（パーティ人数ぶん生成：img/system/balls.png 横4分割） ---
        this._ballsBitmap = ImageManager.loadSystem("balls");
        this._ballSprites = [];
        this._spinInfo = [];

        const partyCount = ($gameParty && $gameParty.members) ? $gameParty.members().length : 1;
        this._numBalls = clamp(partyCount | 0, 1, 4);

        for (let i = 0; i < this._numBalls; i++) {
            const sp = new Sprite(this._ballsBitmap);
            sp.anchor.x = 0.5;
            sp.anchor.y = 0.5;
            sp._yuraInfo = [20, 15];
            this._ballSprites.push(sp);

            // ボールごとに少し回転がズレる（見た目用）
            const scale = 1 + (Math.random() * 0.10 - 0.05);
            const offset = (Math.random() * 2 - 1) * 0.12;
            const bounceMul = 0.85 + Math.random() * 0.30;
            this._spinInfo.push({ scale: scale, offset: offset, bounceMul: bounceMul });
        }

        // 描画順：1個目 → 2個目 … の順に手前へ（0番を最前面）
        for (let i = this._ballSprites.length - 1; i >= 0; i--) {
            this._overlay.addChild(this._ballSprites[i]);
        }

        // 互換：旧コードが this._ballSprite を参照しても動くように
        this._ballSprite = this._ballSprites[0];


        // 開始座標の決定（指定があればそれを使う）
        this._applyStartPosition();
        this._resetWallCandidates_();

        // 表示位置を「ボールが画面下寄り」になるよう合わせ、開始displayを保存
        this._snapCameraToBallAtStart();
        this._startDisplay.x = $gameMap.displayX();
        this._startDisplay.y = $gameMap.displayY();

        // 初期化
        this._vx = 0;
        this._vy = 0;
        this._ballAngle = 0;
        this._ballSpinVel = 0;

        // 追従設定（先頭の履歴から遅れて追いかける）
        this._followDelayFrames = clamp(Math.floor(Number(this._opts.followDelayFrames || DEFAULTS.followDelayFrames)), 0, 240);

        // time-mode param：最短間隔（px）
        const minSpaceOpt = Number(this._opts.followMinSpacing);
        const minSpace = isFinite(minSpaceOpt) ? minSpaceOpt : Number(DEFAULTS.followMinSpacing);
        this._followMinSpacing = clamp(minSpace, 0, 9999);
        this._leadHist = [];
        this._ballStates = [];
        this._leadHistMax = (this._followDelayFrames * (this._numBalls - 1)) + 240;

        // 開始時点は全員同じ位置・角度になるよう履歴を埋める
        this._initLeadHistory_();
        this._updateBallSpritePos();

        // 開始カウントダウン（操作・線描画・スクロール停止）
        this._setupCountdown_();

        this._fallTriggered = false;

        // 独自カーソル（スプライトで偽カーソル）
        // ・線を描ける状態のときだけ「PC側カーソルを消す + 偽カーソル表示」
        // ・画面外（canvas外）では自動で通常カーソルに戻す
        const canvas = Graphics._canvas;
        if (canvas) {
            // 元のカーソル設定を退避
            this._oldCanvasCursor = canvas.style.cursor;
            this._oldBodyCursor = document.body ? document.body.style.cursor : null;
            this._oldHtmlCursor = document.documentElement ? document.documentElement.style.cursor : null;

            // 初期は通常カーソル（必要になったら update で none に切替）
            canvas.style.cursor = (this._oldCanvasCursor != null ? this._oldCanvasCursor : "");

            // hover 判定（mouseleave で確実に復帰させる）
            this._cursorHover = false;
            this._cursorEnterHandler = function () { this._cursorHover = true; }.bind(this);
            this._cursorLeaveHandler = function () { this._cursorHover = false; }.bind(this);
            canvas.addEventListener("mouseenter", this._cursorEnterHandler);
            canvas.addEventListener("mouseleave", this._cursorLeaveHandler);

            // 起動直後にマウスが既に乗ってるケース用の初期値（推定）
            this._cursorHover = (TouchInput.x >= 0 && TouchInput.y >= 0 && TouchInput.x < Graphics.width && TouchInput.y < Graphics.height);
        }

        // 偽カーソル（左上原点＝anchor 0,0）
        this._scene._cursorSprite = new Sprite(ImageManager.loadSystem("UI_cursor_pen"));
        this._scene._cursorSprite.anchor.x = 0;
        this._scene._cursorSprite.anchor.y = 0;
        this._scene._cursorSprite.opacity = 0;
        this._scene._cursorSprite.bitmap.smooth = false; // ドット感維持したい場合
        this._scene._cursorSprite.x = TouchInput.x;
        this._scene._cursorSprite.y = TouchInput.y;


        // 入力モード初期化（最初はキーモード）
        this._resetPointerMode_();
        this._scene._cursorSprite.x = this._cursorX - 8;
        this._scene._cursorSprite.y = this._cursorY - 16;

        // Enterキー監視（Enterのみ）
        if (!this._enterKeyDownHandler) {
            this._enterKeyDownHandler = function (e) {
                const isEnter = (e && (e.code === "Enter" || e.key === "Enter" || e.keyCode === 13));
                if (isEnter) this._enterDown = true;
            }.bind(this);
            this._enterKeyUpHandler = function (e) {
                const isEnter = (e && (e.code === "Enter" || e.key === "Enter" || e.keyCode === 13));
                if (isEnter) this._enterDown = false;
            }.bind(this);
            window.addEventListener("keydown", this._enterKeyDownHandler);
            window.addEventListener("keyup", this._enterKeyUpHandler);
        }

        // テストプレイ中のみ：F6で強制クリア
        if (Utils && Utils.isOptionValid && Utils.isOptionValid("test") && !this._forceClearKeyHandler) {
            this._forceClearKeyHandler = function (e) {
                const isF6 = (e && (e.code === "F6" || e.key === "F6" || e.keyCode === 117));
                if (!isF6) return;
                if (this._phase !== "success") this._onGoal_();
                if (e && e.preventDefault) e.preventDefault();
            }.bind(this);
            window.addEventListener("keydown", this._forceClearKeyHandler);
        }

        // windowLayer 最前面（メッセージ等より手前に出す）
        const layer = (this._scene && this._scene._windowLayer) ? this._scene._windowLayer : this._scene;
        if (layer) layer.addChild(this._scene._cursorSprite);


        // ----------------------------
        // 画面外（上）表示：丸窓（ボール1の周囲を表示）
        // ----------------------------
        this._offWin = {
            container: new PIXI.Container(),
            ring: new Sprite(ImageManager.loadSystem("UI_circleWindow")),
            view: null,
            mask: null,
            rt: null,
            size: 0,
            cx: 0,
            cy: 0,
            radius: 0,
            zoom: 0.8,
            marginTop: 6,      // 画面上端からの余白
            updateEvery: 2,    // 更新間隔（フレーム）
            counter: 0,
            ready: false,
            mat: new PIXI.Matrix()
        };
        this._offWin.container.visible = false;

        // まずリングだけ追加（bitmap isReady 後に中身を組み立てる）
        this._offWin.container.addChild(this._offWin.ring);

        // windowLayer 最前面に載せる（baseSprite には載せない＝キャプチャに写り込ませない）
        if (layer) layer.addChild(this._offWin.container);
        this._lastTimeMs = performance.now();
        KGG_MiniGame._rt = this;
    };

    // ----------------------------
    // マップメモ欄から壁線分をロード（px指定）
    // 例：
    //   <MGWall: 100,200, 300,200>
    //   <MGWall: 300,200, 300,400>
    //   <MGWallDebug: 1>
    // ----------------------------
    KggMiniGameRuntime.prototype._loadWallsFromMapNote = function () {
        this._walls.length = 0;

        // オプション側の既定（start()で渡してもOK）
        this._wallDebug = !!this._opts.wallDebug;

        const note = ($dataMap && $dataMap.note) ? String($dataMap.note) : "";
        if (!note) return;

        // デバッグ表示（note側があれば優先）
        const dbg = note.match(/<\s*MGWallDebug(?:\s*:\s*([^>]+))?\s*>/i);
        if (dbg) {
            const v = dbg[1];
            if (v == null || v === "") this._wallDebug = true;
            else this._wallDebug = !/^(0|false|off|no)$/i.test(String(v).trim());
        }

        const re = /<\s*MGWall\s*:\s*([^>]+)\s*>/gi;
        let m;
        while ((m = re.exec(note))) {
            const raw = String(m[1] || "");
            const parts = raw.split(/[\s,]+/).filter(Boolean);
            if (parts.length < 4) continue;

            const ax = Number(parts[0]);
            const ay = Number(parts[1]);
            const bx = Number(parts[2]);
            const by = Number(parts[3]);
            if (![ax, ay, bx, by].every(isFinite)) continue;

            const len = hypot(bx - ax, by - ay);
            if (len < 0.001) continue;
            const minX = Math.min(ax, bx);
            const minY = Math.min(ay, by);
            const maxX = Math.max(ax, bx);
            const maxY = Math.max(ay, by);
            this._walls.push({ ax: ax, ay: ay, bx: bx, by: by, len: len, minX: minX, minY: minY, maxX: maxX, maxY: maxY });
        }

        this._buildWallGrid_();
    };

    KggMiniGameRuntime.prototype._buildWallGrid_ = function () {
        const sizeOpt = Number(this._opts.wallCullGridSize || DEFAULTS.wallCullGridSize);
        const size = clamp(Math.floor(isFinite(sizeOpt) ? sizeOpt : Number(DEFAULTS.wallCullGridSize)), 64, 2048);
        this._wallGridSize = size;

        if (!this._walls || this._walls.length <= 0) {
            this._wallGrid = null;
            return;
        }

        const grid = Object.create(null);
        for (let i = 0; i < this._walls.length; i++) {
            const w = this._walls[i];
            const minX = (w.minX != null) ? w.minX : Math.min(w.ax, w.bx);
            const minY = (w.minY != null) ? w.minY : Math.min(w.ay, w.by);
            const maxX = (w.maxX != null) ? w.maxX : Math.max(w.ax, w.bx);
            const maxY = (w.maxY != null) ? w.maxY : Math.max(w.ay, w.by);

            const gx0 = Math.floor(minX / size);
            const gx1 = Math.floor(maxX / size);
            const gy0 = Math.floor(minY / size);
            const gy1 = Math.floor(maxY / size);

            for (let gy = gy0; gy <= gy1; gy++) {
                for (let gx = gx0; gx <= gx1; gx++) {
                    const key = gx + "," + gy;
                    if (!grid[key]) grid[key] = [];
                    grid[key].push(i);
                }
            }
        }

        this._wallGrid = grid;
    };

    KggMiniGameRuntime.prototype._updateWallCandidates_ = function () {
        if (!this._walls || this._walls.length <= 0) {
            this._wallCandidates = this._walls;
            return;
        }

        const enabled = (this._opts.wallCullEnabled !== undefined) ? !!this._opts.wallCullEnabled : true;
        if (!enabled) {
            this._wallCandidates = this._walls;
            return;
        }

        const intervalOpt = Number(this._opts.wallCullIntervalFrames);
        const intervalFrames = clamp(Math.floor(isFinite(intervalOpt) ? intervalOpt : Number(DEFAULTS.wallCullIntervalFrames)), 1, 120);
        const moveOpt = Number(this._opts.wallCullMovePx);
        const movePx = isFinite(moveOpt) ? moveOpt : Number(DEFAULTS.wallCullMovePx);
        const extraOpt = Number(this._opts.wallCullExtraMargin);
        const extra = isFinite(extraOpt) ? extraOpt : Number(DEFAULTS.wallCullExtraMargin);

        this._wallCandCounter = (this._wallCandCounter || 0) + 1;

        let moved = true;
        if (this._wallCandLastX != null && this._wallCandLastY != null) {
            const dx = this._ballX - this._wallCandLastX;
            const dy = this._ballY - this._wallCandLastY;
            moved = (dx * dx + dy * dy) >= (movePx * movePx);
        }

        if (!moved && this._wallCandCounter < intervalFrames && this._wallCandidates) return;

        this._wallCandCounter = 0;
        this._wallCandLastX = this._ballX;
        this._wallCandLastY = this._ballY;

        const r = Number(this._opts.radius || DEFAULTS.radius);
        const speed = hypot(this._vx, this._vy);
        const intervalSec = intervalFrames / 60;
        const margin = Math.max(0, r + extra + speed * intervalSec);

        const minX = this._ballX - margin;
        const maxX = this._ballX + margin;
        const minY = this._ballY - margin;
        const maxY = this._ballY + margin;

        const list = [];
        if (this._wallGrid && this._wallGridSize > 0) {
            const size = this._wallGridSize;
            const gx0 = Math.floor(minX / size);
            const gx1 = Math.floor(maxX / size);
            const gy0 = Math.floor(minY / size);
            const gy1 = Math.floor(maxY / size);
            const seen = Object.create(null);

            for (let gy = gy0; gy <= gy1; gy++) {
                for (let gx = gx0; gx <= gx1; gx++) {
                    const key = gx + "," + gy;
                    const arr = this._wallGrid[key];
                    if (!arr) continue;
                    for (let k = 0; k < arr.length; k++) {
                        const idx = arr[k];
                        if (seen[idx]) continue;
                        seen[idx] = true;
                        const w = this._walls[idx];
                        const wMinX = (w.minX != null) ? w.minX : Math.min(w.ax, w.bx);
                        const wMinY = (w.minY != null) ? w.minY : Math.min(w.ay, w.by);
                        const wMaxX = (w.maxX != null) ? w.maxX : Math.max(w.ax, w.bx);
                        const wMaxY = (w.maxY != null) ? w.maxY : Math.max(w.ay, w.by);
                        if (wMaxX < minX || wMinX > maxX || wMaxY < minY || wMinY > maxY) continue;
                        list.push(w);
                    }
                }
            }
        } else {
            for (let i = 0; i < this._walls.length; i++) {
                const w = this._walls[i];
                const wMinX = (w.minX != null) ? w.minX : Math.min(w.ax, w.bx);
                const wMinY = (w.minY != null) ? w.minY : Math.min(w.ay, w.by);
                const wMaxX = (w.maxX != null) ? w.maxX : Math.max(w.ax, w.bx);
                const wMaxY = (w.maxY != null) ? w.maxY : Math.max(w.ay, w.by);
                if (wMaxX < minX || wMinX > maxX || wMaxY < minY || wMinY > maxY) continue;
                list.push(w);
            }
        }
        this._wallCandidates = list;
    };


    KggMiniGameRuntime.prototype.onTerminate = function () {
        // NOTE: 描画は baseSprite / overlay 側で管理しているので tilemap から外す必要はない
        this._ballSprite = null;
        this._tilemap = null;

        if (this._overlay && this._scene._spriteset && this._scene._spriteset._baseSprite) {
            this._scene._spriteset._baseSprite.removeChild(this._overlay);
            this._scene._spriteset._baseSprite.removeChild(this._lineSprite);
        }
        this._lineBmp = null;

        this._overlay = null;

        if (this._countdownSprite && this._countdownSprite.parent) {
            this._countdownSprite.parent.removeChild(this._countdownSprite);
        }
        this._countdownSprite = null;

        // 画面外表示の丸窓を破棄
        this._destroyOffscreenCircleWindow_();

        // 独自カーソル削除
        if (this._scene._cursorSprite && this._scene._cursorSprite.parent) this._scene._cursorSprite.parent.removeChild(this._scene._cursorSprite);
        this._scene._cursorSprite = null;

        // hover監視を外す
        if (Graphics._canvas) {
            if (this._cursorEnterHandler) Graphics._canvas.removeEventListener("mouseenter", this._cursorEnterHandler);
            if (this._cursorLeaveHandler) Graphics._canvas.removeEventListener("mouseleave", this._cursorLeaveHandler);
        }
        this._cursorEnterHandler = null;
        this._cursorLeaveHandler = null;
        this._cursorHover = true;

        // Enterキー監視を外す
        if (this._enterKeyDownHandler) window.removeEventListener("keydown", this._enterKeyDownHandler);
        if (this._enterKeyUpHandler) window.removeEventListener("keyup", this._enterKeyUpHandler);
        this._enterKeyDownHandler = null;
        this._enterKeyUpHandler = null;
        this._enterDown = false;

        // F6強制クリア（テストプレイ用）を外す
        if (this._forceClearKeyHandler) window.removeEventListener("keydown", this._forceClearKeyHandler);
        this._forceClearKeyHandler = null;

        // カーソル復帰（canvas + body + html）
        if (Graphics._canvas) Graphics._canvas.style.cursor = (this._oldCanvasCursor != null ? this._oldCanvasCursor : "");
        if (document.body) document.body.style.cursor = (this._oldBodyCursor != null ? this._oldBodyCursor : "");
        if (document.documentElement) document.documentElement.style.cursor = (this._oldHtmlCursor != null ? this._oldHtmlCursor : "");
        this._oldCanvasCursor = null;
        this._oldBodyCursor = null;
        this._oldHtmlCursor = null;
        this._cursorHidden = false;

        if (window.KGG_MiniGame) window.KGG_MiniGame._rt = null;
    };

    // ----------------------------
    // 開始カウントダウン
    // ----------------------------
    KggMiniGameRuntime.prototype._setupCountdown_ = function () {
        this._phase = "countdown";
        this._countdownT = 0;
        this._goalTriggered = false;
        this._successCamActive = false;

        // 既存UIがあれば破棄
        if (this._countdownSprite && this._countdownSprite.parent) {
            this._countdownSprite.parent.removeChild(this._countdownSprite);
        }

        this._countdownBmp = ImageManager.loadSystem("UI_battle_countdown");

        const sp = new Sprite(this._countdownBmp);
        sp.anchor.x = 0.5;
        sp.anchor.y = 0.5;
        sp.x = Graphics.width / 2;
        sp.y = Graphics.height / 2;
        sp._yuraInfo = [];
        sp.setFrame(0, 0, 0, 0); // 初期フレーム無し

        const sc = Number(this._opts.countdownScale || DEFAULTS.countdownScale);
        sp.scale.x = sc;
        sp.scale.y = sc;

        this._countdownSprite = sp;
        this._scene.addChild(sp);

        this._countdownFrameW = 0;
        this._countdownFrameH = 0;
    };

    KggMiniGameRuntime.prototype._updateCountdown_ = function (dt) {
        if (!this._countdownSprite) return;

        this._countdownT += dt;

        const step = Number(this._opts.countdownStepSec || DEFAULTS.countdownStepSec);
        const goSec = Number(this._opts.countdownGoSec || DEFAULTS.countdownGoSec);
        const total = step * 3 + goSec;

        // ビットマップが準備できたら4分割で表示
        if (this._countdownBmp && this._countdownBmp.isReady && this._countdownBmp.isReady()) {
            if (this._countdownFrameW <= 0) {
                this._countdownFrameW = Math.floor(this._countdownBmp.width / 5);
                this._countdownFrameH = this._countdownBmp.height;
            }
            let idx = 0; // 0:3 1:2 2:1 3:GO
            if (this._countdownT < step) idx = 0;
            else if (this._countdownT < step * 2) idx = 1;
            else if (this._countdownT < step * 3) idx = 2;
            else idx = 3;

            const fw = this._countdownFrameW;
            const fh = this._countdownFrameH;
            this._countdownSprite.setFrame(fw * idx, 0, fw * (idx === 3 ? 2 : 1), fh);
        }

        // 終了
        if (this._countdownT >= total) {
            this._startPlayFromCountdown_();
        }
    };

    KggMiniGameRuntime.prototype._startPlayFromCountdown_ = function () {
        // UIを外す
        if (this._countdownSprite && this._countdownSprite.parent) {
            this._countdownSprite.parent.removeChild(this._countdownSprite);
        }
        this._countdownSprite = null;

        // 入力状態クリア（押しっぱで線が暴発しない）
        this._drawing = false;
        this._lastPoint = null;

        // カメラ追従初期値
        this._camX = $gameMap.displayX();

        // ちょいジャンプして開始
        const j = Math.abs(Number(this._opts.startJumpVy || DEFAULTS.startJumpVy));
        this._vy = -j;

        this._phase = "play";
    };

    // ----------------------------
    // カメラ：横追従（縦は自動スクロールに任せる）
    // ----------------------------
    KggMiniGameRuntime.prototype._updateFollowScrollX_ = function (dt) {
        const k = Number(this._opts.scrollFollowXK || DEFAULTS.scrollFollowXK);
        if (!(k > 0)) return;

        const tw = $gameMap.tileWidth();
        const screenTileX = $gameMap.screenTileX();
        const maxDx = Math.max(0, $gameMap.width() - screenTileX);

        let target = (this._ballX / tw) - (screenTileX * 0.5);
        target = clamp(target, 0, maxDx);

        if (this._camX == null) this._camX = $gameMap.displayX();

        // fps依存を弱めたスムージング
        const alpha = 1 - Math.exp(-k * dt);
        this._camX = this._camX + (target - this._camX) * alpha;

        // 縦は既存の displayY を維持
        this._setDisplayPosPx_(this._camX, $gameMap.displayY());
    };

    // ----------------------------
    // トランポリン命中：ボヨヨン演出タイマー
    // ----------------------------
    KggMiniGameRuntime.prototype._triggerTrampolineBoing_ = function (segIndex, nx, ny) {
        const dur = Number(this._opts.trampolineBoingDur || DEFAULTS.trampolineBoingDur);
        const ampBase = Number(this._opts.trampolineBoingAmp || DEFAULTS.trampolineBoingAmp);
        const amp = ampBase * (0.85 + Math.random() * 0.35);

        // 正規化
        const nlen = hypot(nx, ny) || 1;
        nx /= nlen;
        ny /= nlen;

        this._segBoing[segIndex] = { t: 0, dur: dur, amp: amp, nx: nx, ny: ny };
        this._needsRedraw = true;
    };

    KggMiniGameRuntime.prototype._updateTrampolineBoing_ = function (dt) {
        if (!this._segBoing || this._segBoing.length <= 0) return;
        let any = false;
        for (let i = 0; i < this._segBoing.length; i++) {
            const b = this._segBoing[i];
            if (!b) continue;
            b.t += dt;
            if (b.t >= b.dur) {
                this._segBoing[i] = null;
            } else {
                any = true;
            }
        }
        if (any) this._needsRedraw = true;
    };

    KggMiniGameRuntime.prototype._setDisplayPosPx_ = function (dx, dy) {
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();

        // displayX/Y（タイル単位）→ px単位にスナップ（= origin が整数pxになる）
        dx = Math.round(dx * tw) / tw;
        dy = Math.round(dy * th) / th;

        $gameMap.setDisplayPos(dx, dy);
    };



    KggMiniGameRuntime.prototype._applyStartPosition = function () {
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();

        const originX = this._tilemap.origin.x;
        const originY = this._tilemap.origin.y;

        let bx, by;

        // 指定がある場合
        if (this._opts && this._opts.x != null && this._opts.y != null) {
            const unit = String(this._opts.unit || "tile").toLowerCase();
            if (unit === "pixel") {
                bx = Number(this._opts.x);
                by = Number(this._opts.y);
            } else {
                // tile
                bx = (Number(this._opts.x) + 0.5) * tw;
                by = (Number(this._opts.y) + 0.5) * th;
            }
        } else {
            // 指定なし：画面下部（現在の表示基準から）
            bx = originX + Graphics.width * 0.5;
            by = originY + (Graphics.height - Number(this._opts.startOffsetFromBottom || DEFAULTS.startOffsetFromBottom));
        }

        this._ballX = bx;
        this._ballY = by;
        this._startBall.x = bx;
        this._startBall.y = by;
    };

    KggMiniGameRuntime.prototype._snapCameraToBallAtStart = function () {
        // 「ボールが画面下寄り」に見えるよう displayPos を合わせる
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();

        const desiredScreenX = Graphics.width * 0.5;
        const desiredScreenY = Graphics.height - Number(this._opts.startOffsetFromBottom || DEFAULTS.startOffsetFromBottom);

        const targetOriginX = this._ballX - desiredScreenX;
        const targetOriginY = this._ballY - desiredScreenY;

        let dx = targetOriginX / tw;
        let dy = targetOriginY / th;

        const maxDx = Math.max(0, $gameMap.width() - $gameMap.screenTileX());
        const maxDy = Math.max(0, $gameMap.height() - $gameMap.screenTileY());

        dx = clamp(dx, 0, maxDx);
        dy = clamp(dy, 0, maxDy);

        this._setDisplayPosPx_(dx, dy);
    };

    KggMiniGameRuntime.prototype.resetMiniGame = function () {
        this._fallTriggered = false;

        // ミニゲーム要素だけ初期化
        this._segments.length = 0;
        this._totalLen = 0;
        this._lastPoint = null;
        this._drawing = false;

        this._drawingBy = null;
        this._enterDown = false;
        this._resetPointerMode_();

        // 表示もクリア
        this._redrawLinesBitmap();

        // カメラを開始地点へ
        this._setDisplayPosPx_(this._startDisplay.x, this._startDisplay.y);
        this._camX = this._startDisplay.x;
        if (this._segBoing) this._segBoing.length = 0;
        this._needsRedraw = true;

        // ボール初期化
        this._ballX = this._startBall.x;
        this._ballY = this._startBall.y;
        this._vx = 0;
        this._vy = 0;
        this._ballAngle = 0;
        this._ballSpinVel = 0;
        this._resetWallCandidates_();

        this._initLeadHistory_();
        this._updateBallSpritePos();

        this._lastTimeMs = performance.now();

        // ゴール／成功状態リセット
        this._goalTriggered = false;
        this._successCamActive = false;
        this._successCamTargetY = 0;

        this._phase = "countdown";
        this._countdownT = 0;
        this._setupCountdown_(); // （あなたの実装名に合わせて）
    };


    //-----------------------------------------------------------------------------
    // 偽カーソル更新（PCカーソルを消して、スプライトで描画）
    //-----------------------------------------------------------------------------


    // -------------------------------------------------
    // 入力モード（キーボード／マウス）とカーソル
    // -------------------------------------------------
    KggMiniGameRuntime.prototype._resetPointerMode_ = function () {
        this._pointerMode = "key"; // 最初はキーモード

        // 初期カーソル位置：マウスが画面内ならそこ、なければ中央
        let sx = TouchInput.x;
        let sy = TouchInput.y;
        if (!(sx >= 0 && sy >= 0 && sx <= Graphics.width && sy <= Graphics.height)) {
            sx = Graphics.width / 2;
            sy = Graphics.height / 2;
        }

        this._keyCursorX = sx;
        this._keyCursorY = sy;
        this._cursorX = sx;
        this._cursorY = sy;

        this._mouseLastX = TouchInput.x;
        this._mouseLastY = TouchInput.y;
        this._pointerLastTimeMs = performance.now();

        this._enterDown = false;
        if (!this._drawing) this._drawingBy = null;
    };

    KggMiniGameRuntime.prototype._isAnyArrowPressed_ = function () {
        return Input.isPressed("left") || Input.isPressed("right") || Input.isPressed("up") || Input.isPressed("down");
    };

    KggMiniGameRuntime.prototype._updatePointerModeAndCursor_ = function () {
        // カーソル移動用 dt（fpsに依存しない）
        const now = performance.now();
        if (!this._pointerLastTimeMs) this._pointerLastTimeMs = now;
        let dt = (now - this._pointerLastTimeMs) / 1000;
        this._pointerLastTimeMs = now;
        dt = clamp(dt, 0, 1 / 30);

        const mx = TouchInput.x;
        const my = TouchInput.y;

        const movedMouse = (Math.abs(mx - (this._mouseLastX || 0)) >= 1) || (Math.abs(my - (this._mouseLastY || 0)) >= 1);
        this._mouseLastX = mx;
        this._mouseLastY = my;

        const arrow = this._isAnyArrowPressed_();

        // 「描画中」扱いのロック（押してる間は切替しない）
        const lockKey = (this._pointerMode === "key") && (this._enterDown || (this._drawing && this._drawingBy === "key"));
        const lockMouse = (this._pointerMode === "mouse") && (TouchInput.isPressed() || (this._drawing && this._drawingBy === "mouse"));

        // モード切替
        if (this._pointerMode === "key") {
            if (!lockKey && movedMouse) {
                this._pointerMode = "mouse";
            }
        } else { // mouse
            if (!lockMouse && arrow) {
                this._pointerMode = "key";
                // 切替直後のジャンプ防止：キー側カーソルを現在のマウス位置へ
                if (mx >= 0 && my >= 0 && mx <= Graphics.width && my <= Graphics.height) {
                    this._keyCursorX = mx;
                    this._keyCursorY = my;
                }
            }
        }

        // カーソル座標更新
        if (this._pointerMode === "mouse") {
            this._cursorX = mx;
            this._cursorY = my;
        } else {
            // 8方向移動（斜めは正規化）
            let dx = (Input.isPressed("right") ? 1 : 0) - (Input.isPressed("left") ? 1 : 0);
            let dy = (Input.isPressed("down") ? 1 : 0) - (Input.isPressed("up") ? 1 : 0);

            if (dx !== 0 || dy !== 0) {
                const len = hypot(dx, dy);
                if (len > 0) { dx /= len; dy /= len; }
                const spd = Number(this._opts.keyCursorSpeed || DEFAULTS.keyCursorSpeed);
                this._keyCursorX = clamp(this._keyCursorX + dx * spd * dt, 0, Graphics.width - 24);
                this._keyCursorY = clamp(this._keyCursorY + dy * spd * dt, 0, Graphics.height - 24);
            }

            this._cursorX = this._keyCursorX;
            this._cursorY = this._keyCursorY;
        }
    };

    KggMiniGameRuntime.prototype._updateFakeCursor_ = function () {
        const sp = this._scene._cursorSprite;
        if (!sp) return;

        // 位置は常に追従（表示切替直後にワープしないように）
        this._updatePointerModeAndCursor_();
        sp.x = this._cursorX - 8;
        sp.y = this._cursorY - 16;

        const canvas = Graphics._canvas;
        const hover = (this._pointerMode === "key") ? true : (this._cursorHover !== false); // 未初期化なら true 扱い
        const canDraw = (this._phase === "countdown" || this._phase === "play") && !$gameMap.isEventRunning();
        const show = !!canvas && hover && canDraw;

        sp.opacity += show ? 255 : (-255 / 15);

        // PC側カーソルの切替
        if (!canvas) return;

        if (show && !this._cursorHidden) {
            canvas.style.cursor = "none";
            if (document.body) document.body.style.cursor = "none";
            if (document.documentElement) document.documentElement.style.cursor = "none";
            this._cursorHidden = true;
        } else if (!show && this._cursorHidden) {
            canvas.style.cursor = (this._oldCanvasCursor != null ? this._oldCanvasCursor : "");
            if (document.body) document.body.style.cursor = (this._oldBodyCursor != null ? this._oldBodyCursor : "");
            if (document.documentElement) document.documentElement.style.cursor = (this._oldHtmlCursor != null ? this._oldHtmlCursor : "");
            this._cursorHidden = false;
        }
    };


    //-----------------------------------------------------------------------------
    // 画面外（上）表示：丸窓（ボール1の周囲を表示）
    //-----------------------------------------------------------------------------
    KggMiniGameRuntime.prototype._ensureOffscreenCircleWindowReady_ = function () {
        const ow = this._offWin;
        if (!ow || ow.ready) return;
        if (!ow.ring || !ow.ring.bitmap || !ow.ring.bitmap.isReady()) return;

        const w = ow.ring.bitmap.width | 0;
        const h = ow.ring.bitmap.height | 0;
        ow.ring.bitmap.smooth = false;
        this._offWin.ring._yuraInfo = [20, 15];
        if (w <= 0 || h <= 0) return;

        // 表示は「円形部分」だけ使う（直径 = w を想定）
        ow.size = w;
        ow.radius = w / 2;
        ow.cx = w / 2;
        ow.cy = h / 2;

        // RenderTexture（円の中身）
        if (ow.rt && ow.rt.destroy) ow.rt.destroy(true);
        ow.rt = PIXI.RenderTexture.create(ow.size, ow.size);
        ow.rt.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

        ow.view = new PIXI.Sprite(ow.rt);
        ow.view.anchor.x = 0.5;
        ow.view.anchor.y = 0.5;
        ow.view.x = 0;
        ow.view.y = 0;

        // 円形マスク
        ow.mask = new PIXI.Graphics();
        ow.mask.beginFill(0xffffff, 1);
        ow.mask.drawCircle(0, 0, ow.radius - 6);
        ow.mask.endFill();
        ow.view.mask = ow.mask;

        // リング位置（コンテナ原点＝円の中心）
        ow.ring.x = -ow.cx;
        ow.ring.y = -ow.cy;

        // コンテナ初期位置（上端固定）
        ow.container.x = ow.cx;
        ow.container.y = ow.cy + ow.marginTop;

        // 追加順：view → mask → ring（ringを最前面）
        ow.container.removeChildren();
        ow.container.addChild(ow.view);
        ow.container.addChild(ow.mask);
        ow.container.addChild(ow.ring);

        ow.ready = true;
    };

    KggMiniGameRuntime.prototype._renderOffscreenCircleWindow_ = function (ballX, ballY) {
        const ow = this._offWin;
        if (!ow || !ow.ready || !ow.rt) return;
        if (!Graphics || !Graphics._renderer) return;
        if (!this._scene || !this._scene._spriteset || !this._scene._spriteset._baseSprite) return;
        if (!this._tilemap || !this._overlay) return;

        const ss = this._scene._spriteset;
        const base = ss._baseSprite;
        const tilemap = this._tilemap;
        const parallax = ss._parallax; // TilingSprite（パララックス背景）
        const hasParallax = !!(parallax && parallax.origin);
        const px0 = hasParallax ? parallax.origin.x : 0;
        const py0 = hasParallax ? parallax.origin.y : 0;
        // 現在の表示状態を退避
        const ox0 = tilemap.origin.x;
        const oy0 = tilemap.origin.y;
        const ovx0 = this._overlay.x;
        const ovy0 = this._overlay.y;

        // 「ボールを画面中央に置く」ための一時 origin（px, 小数なし推奨）
        const tmpOx = Math.floor(ballX - Graphics.width * 0.5);
        const tmpOy = Math.floor(ballY - Graphics.height * 0.5);


        const dx = tmpOx - ox0;
        const dy = tmpOy - oy0;
        if (hasParallax) {
            parallax.origin.x = px0 + dx / 2;
            parallax.origin.y = py0 + dy / 2;
            parallax.update();
        }
        // 一時的に origin を差し替え
        tilemap.origin.x = tmpOx;
        tilemap.origin.y = tmpOy;
        this._overlay.x = -tmpOx;
        this._overlay.y = -tmpOy;

        // 線は screen 座標なので、origin に合わせて描き直す（重いので updateEvery で間引く）
        this._lastOriginX = null;
        this._lastOriginY = null;
        this._needsRedraw = true;
        this._redrawLinesBitmap();

        // 画面中央 → RenderTexture 中央へ（ズーム 0.8）
        const z = ow.zoom;
        const mat = ow.mat;
        mat.identity();
        mat.a = z;
        mat.d = z;
        mat.tx = ow.size * 0.5 - Graphics.width * 0.5 * z;
        mat.ty = ow.size * 0.5 - Graphics.height * 0.5 * z;

        //丸窓レンダリング中はトランポリン線を写さない ---
        this._lineSprite.visible = false;

        Graphics._renderer.render(base, ow.rt, true, mat, false);

        // 元に戻す
        this._lineSprite.visible = true;
        tilemap.origin.x = ox0;
        tilemap.origin.y = oy0;
        this._overlay.x = ovx0;
        this._overlay.y = ovy0;

        if (hasParallax) {
            parallax.origin.x = px0;
            parallax.origin.y = py0;
            parallax.update();
        }
        // 通常画面用に線を戻す
        this._lastOriginX = null;
        this._lastOriginY = null;
        this._needsRedraw = true;
        this._redrawLinesBitmap();

        // 以降の自動判定用に整合を取る
        this._lastOriginX = tilemap.origin.x;
        this._lastOriginY = tilemap.origin.y;
        this._needsRedraw = false;
    };

    KggMiniGameRuntime.prototype._updateOffscreenCircleWindow_ = function () {
        const ow = this._offWin;
        if (!ow) return;

        this._ensureOffscreenCircleWindowReady_();
        if (!ow.ready) return;

        // 表示条件：ボール1が画面より上（screenY < 0）＋プレイ中/ゲームオーバー中
        const phaseOK = (this._phase === "play" || this._phase === "gameover");
        const screenY = this._ballY - this._tilemap.origin.y;
        const show = phaseOK && (screenY < 0);

        ow.container.visible = show;
        if (!show) return;

        // x はボールに追従、y は固定
        const screenX = this._ballX - this._tilemap.origin.x;
        const cx = ow.radius;
        ow.container.x = clamp(Math.round(screenX), cx, Graphics.width - cx);

        // 更新間引き
        ow.counter = (ow.counter + 1) | 0;
        if (ow.counter % ow.updateEvery !== 0) return;

        this._renderOffscreenCircleWindow_(this._ballX, this._ballY);

        this._offWin.ring.update();
    };

    KggMiniGameRuntime.prototype._destroyOffscreenCircleWindow_ = function () {
        const ow = this._offWin;
        if (!ow) return;

        if (ow.container && ow.container.parent) ow.container.parent.removeChild(ow.container);
        if (ow.rt && ow.rt.destroy) ow.rt.destroy(true);
        ow.rt = null;
        this._offWin = null;
    };

    KggMiniGameRuntime.prototype.update = function () {
        this._updateFakeCursor_();


        if (!this._tilemap || !this._ballSprites || this._ballSprites.length <= 0) return;

        // メッセージ中は "play" だけ止める（成功中はカメラ追いつきが要るので止めない）
        if ($gameMessage && $gameMessage.isBusy() && this._phase === "play") {
            this._lastTimeMs = performance.now();
            return;
        }

        const now = performance.now();
        let dt = (now - this._lastTimeMs) / 1000;
        this._lastTimeMs = now;

        // 急なフリーズ後の暴走防止
        dt = clamp(dt, 0, 1 / 30);

        // 成功中：ボールは動かさない。必要ならカメラだけ上へ追いつく
        if (this._phase === "success") {
            this._drawing = false;
            this._lastPoint = null;

            this._updateSuccessCamera_(dt);
            this._updateFollowScrollX_(dt);

            // 反映（カメラが動くので描画同期は必要）
            this._updateBallSpritePos();
            const ox = this._tilemap.origin.x;
            const oy = this._tilemap.origin.y;
            if (this._needsRedraw || ox !== this._lastOriginX || oy !== this._lastOriginY) {
                this._lastOriginX = ox;
                this._lastOriginY = oy;
                this._needsRedraw = false;
                this._redrawLinesBitmap();
            }
            this._overlay.x = -this._tilemap.origin.x;
            this._overlay.y = -this._tilemap.origin.y;
            return;
        }

        // カウントダウン更新
        if (this._phase === "countdown" && !$gameMap.isEventRunning()) this._updateCountdown_(dt);

        // 入力（線描画）
        // gameover中はイベント側の演出を邪魔しないよう入力だけ止める（ボール物理は好みで）
        if (this._phase !== "gameover") {
            this._updateDrawing();
        } else {
            this._drawing = false;
            this._lastPoint = null;
        }

        // 自動スクロール（画面が上に流れる＝displayYを増やす）
        // gameover・countdown中は止める
        if (this._phase !== "gameover" && this._phase !== "countdown") this._updateAutoScroll(dt);

        // 横スクロール：先頭ボールに追従（なめらか）
        // gameover中は止める
        if (this._phase !== "gameover") this._updateFollowScrollX_(dt);

        // 壁判定の候補更新
        if (this._phase !== "gameover" && this._phase !== "countdown") this._updateWallCandidates_();

        // 物理（サブステップで貫通を少し抑える）
        // gameover・countdown中は止める
        if (this._phase !== "gameover" && this._phase !== "countdown") this._updatePhysics(dt);

        // ★ゴール判定（play中のみ）
        if (this._phase === "play" && !this._goalTriggered && this._isGoal_()) {
            this._onGoal_();
        }

        // 成功へ移行したフレームは、以降の更新をしない（止めたいので）
        if (this._phase !== "success") {
            // トランポリン命中演出タイマー
            this._updateTrampolineBoing_(dt);

            // 回転（先頭の速度・反射に応じて回す）
            this._updateRotation_(dt);

            // 追従（パーティ人数ぶん）
            this._updateFollowersFromHistory_();

            // ボヨヨンamime
            this._updateBallScaleBounce_(dt);
        }

        // 反映
        this._updateBallSpritePos();
        const ox = this._tilemap.origin.x;
        const oy = this._tilemap.origin.y;
        if (this._needsRedraw || ox !== this._lastOriginX || oy !== this._lastOriginY) {
            this._lastOriginX = ox;
            this._lastOriginY = oy;
            this._needsRedraw = false;
            this._redrawLinesBitmap();
        }

        this._overlay.x = -this._tilemap.origin.x;
        this._overlay.y = -this._tilemap.origin.y;
        this._updateOffscreenCircleWindow_();
    };


    KggMiniGameRuntime.prototype._updateDrawing = function () {
        // 入力モードによって「押下」を切り替える（描画中は開始した入力だけを受け付ける）
        const mousePressed = TouchInput.isPressed();
        const keyPressed = !!this._enterDown;

        let pressed = false;
        const mode = (this._pointerMode === "mouse") ? "mouse" : "key";

        if (this._drawing) {
            if (this._drawingBy === "mouse") pressed = mousePressed;
            else if (this._drawingBy === "key") pressed = keyPressed;
            else pressed = (mode === "mouse") ? mousePressed : keyPressed;
        } else {
            pressed = (mode === "mouse") ? mousePressed : keyPressed;
        }

        if (pressed) {
            const useMousePos = (this._drawingBy === "mouse") || (!this._drawing && mode === "mouse");
            const mx = useMousePos ? TouchInput.x : this._cursorX;
            const my = useMousePos ? TouchInput.y : this._cursorY;
            // 画面外に出たら終了（SEも止める）
            if (mx < 0 || my < 0 || mx > Graphics.width || my > Graphics.height) {
                this._drawing = false;
                this._lastPoint = null;
                this._drawSeCounter = 0;
                return;
            }

            const wx = mx + this._tilemap.origin.x;
            const wy = my + this._tilemap.origin.y;

            if (!this._drawing) {
                this._drawingBy = mode;
                this._drawing = true;
                this._lastPoint = { x: wx, y: wy };
                this._drawSeCounter = 0;
                return;
            }

            // ★15フレームごとにSE（線を引いてる間だけ）
            this._drawSeCounter++;
            if (this._drawSeCounter >= 10) {
                this._drawSeCounter = 0;
                $gameSystem.playStaticSe('00_pen' + _rand(1, 26), 150, _rand(100, 120));
            }

            const lp = this._lastPoint;
            const minD = Number(this._opts.minPointDistance || DEFAULTS.minPointDistance);
            const dx = wx - lp.x;
            const dy = wy - lp.y;
            const dist = hypot(dx, dy);

            if (dist >= minD) {
                this._addSegment(lp.x, lp.y, wx, wy);
                this._lastPoint = { x: wx, y: wy };
            }
        } else {
            this._drawing = false;
            this._drawingBy = null;
            this._lastPoint = null;
            this._drawSeCounter = 0; // ★離したら止める
        }
    };

    KggMiniGameRuntime.prototype._addSegment = function (ax, ay, bx, by) {
        const lenNew = hypot(bx - ax, by - ay);
        if (lenNew < 0.001) return;

        const maxLen = Number(this._opts.maxLineLength || DEFAULTS.maxLineLength);

        // --- 直線統合：直近がほぼ一直線なら「最後の線分を伸ばす」
        let merged = false;
        const mergeEnabled = (this._opts.straightMergeEnabled !== undefined)
            ? !!this._opts.straightMergeEnabled
            : !!DEFAULTS.straightMergeEnabled;

        if (mergeEnabled && this._segments.length > 0) {
            const last = this._segments[this._segments.length - 1];
            const v1x = last.bx - last.ax;
            const v1y = last.by - last.ay;
            const v2x = bx - last.bx;
            const v2y = by - last.by;
            const l1 = hypot(v1x, v1y);
            const l2 = hypot(v2x, v2y);

            if (l1 > 0.001 && l2 > 0.001) {
                const angleDeg = Number(this._opts.straightMergeAngleDeg || DEFAULTS.straightMergeAngleDeg);
                const maxOff = Number(this._opts.straightMergeMaxOffset || DEFAULTS.straightMergeMaxOffset);
                const cosThr = Math.cos(angleDeg * Math.PI / 180);
                const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);

                if (cos >= cosThr) {
                    // 点(bx,by)の「直線(last.a→last.b)」からの距離
                    const off = Math.abs((bx - last.ax) * v1y - (by - last.ay) * v1x) / l1;
                    if (off <= maxOff) {
                        const oldLen = last.len;
                        last.bx = bx; last.by = by;
                        last.len = hypot(last.bx - last.ax, last.by - last.ay);
                        this._totalLen += (last.len - oldLen);
                        merged = true;
                    }
                }
            }
        }

        if (!merged) {
            this._segments.push({ ax: ax, ay: ay, bx: bx, by: by, len: lenNew });
            this._totalLen += lenNew;
        }

        // --- 長さ制限（古い線から削る）。1本しかない場合は「先頭を詰める」
        // --- 長さ制限（古い線から px 単位で削る）
        if (this._totalLen > maxLen) {
            let excess = this._totalLen - maxLen; // 超過分(px)
            while (excess > 0.0001 && this._segments.length > 0) {
                const s = this._segments[0];
                const slen = s.len || hypot(s.bx - s.ax, s.by - s.ay);

                // 変な線分は捨てる
                if (slen <= 0.0001) {
                    this._segments.shift();
                    if (this._segBoing && this._segBoing.length > 0) this._segBoing.shift(); // index同期
                    continue;
                }

                if (excess < slen) {
                    // 先頭線分を excess ぶんだけ詰める
                    const ux = (s.bx - s.ax) / slen;
                    const uy = (s.by - s.ay) / slen;
                    s.ax += ux * excess;
                    s.ay += uy * excess;
                    s.len = slen - excess;
                    this._totalLen -= excess;
                    excess = 0;
                } else {
                    // 線分まるごと捨てて次へ
                    this._segments.shift();
                    if (this._segBoing && this._segBoing.length > 0) this._segBoing.shift(); // index同期
                    this._totalLen -= slen;
                    excess -= slen;
                }
            }

            if (this._segments.length <= 0) this._totalLen = 0;
        }

        if (this._totalLen > maxLen && this._segments.length === 1) {
            const s = this._segments[0];
            const excess = this._totalLen - maxLen;
            const slen = s.len || hypot(s.bx - s.ax, s.by - s.ay);
            if (slen > 0.001 && excess < slen) {
                const ux = (s.bx - s.ax) / slen;
                const uy = (s.by - s.ay) / slen;
                s.ax += ux * excess;
                s.ay += uy * excess;
                s.len = slen - excess;
                this._totalLen = maxLen;
            } else {
                this._segments.length = 0;
                this._totalLen = 0;
                if (this._segBoing) this._segBoing.length = 0;
            }
        }

        this._redrawLinesBitmap();
    };

    KggMiniGameRuntime.prototype._initLineSprite_ = function () {
        this._lineSprite = new Sprite();
        this._lineBmp = new Bitmap(Graphics.width, Graphics.height);
        this._lineSprite.bitmap = this._lineBmp;
        this._lineSprite._yuraInfo = [20, 20];
        // Bitmap直書き＋ゆらゆら向け最適化
        this._lineSprite._yuraDirect = true;
        this._lineSprite._yuraLockGeometry = true;
        this._lineSprite._yuraUseOwnStep = true;

        // baseSprite に載せる（スクリーン座標）
        this._scene._spriteset._baseSprite.addChild(this._lineSprite);

        // 初回描画
        this._lastOriginX = null;
        this._lastOriginY = null;
        this._redrawLinesBitmap();
    };

    KggMiniGameRuntime.prototype._redrawLinesBitmap = function () {
        if (!this._lineBmp) return;

        const bmp = this._lineBmp;
        bmp.clear();

        const ctx = bmp.context;
        ctx.save();

        // 見た目
        ctx.strokeStyle = "#474e51";
        ctx.lineWidth = 6;
        ctx.lineCap = "butt";
        ctx.lineJoin = "butt";

        // マップ→画面変換（originを引く）
        const ox = this._tilemap.origin.x;
        const oy = this._tilemap.origin.y;

        ctx.beginPath();
        for (let i = 0; i < this._segments.length; i++) {
            const s = this._segments[i];
            const ax = s.ax - ox, ay = s.ay - oy;
            const bx = s.bx - ox, by = s.by - oy;

            // 画面外は軽くスキップ（雑でOK）
            if ((ax < -50 && bx < -50) || (ax > Graphics.width + 50 && bx > Graphics.width + 50) ||
                (ay < -50 && by < -50) || (ay > Graphics.height + 50 && by > Graphics.height + 50)) {
                continue;
            }

            const bo = this._segBoing ? this._segBoing[i] : null;
            if (bo) {
                const p = clamp(bo.t / (bo.dur || 0.0001), 0, 1);

                // 最初：へこむ（負）→ 後半：盛り上がる（正）→ 終了で0
                const wave = -Math.sin(2 * Math.PI * p);   // 0→負→0→正→0
                const damp = (1 - p);                      // 減衰
                const bump = bo.amp * wave * damp;


                const dx2 = bx - ax;
                const dy2 = by - ay;

                // 盛り上がりを、1/3 と 2/3 に同じだけ入れる（対称カーブ）
                const cx1 = ax + dx2 * 0.33 + bo.nx * bump;
                const cy1 = ay + dy2 * 0.33 + bo.ny * bump;
                const cx2 = ax + dx2 * 0.66 + bo.nx * bump;
                const cy2 = ay + dy2 * 0.66 + bo.ny * bump;

                ctx.moveTo(ax, ay);
                ctx.bezierCurveTo(cx1, cy1, cx2, cy2, bx, by);

            } else {
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
            }
        }
        ctx.stroke();

        // 壁デバッグ（赤）
        if (this._wallDebug && this._walls && this._walls.length > 0) {
            ctx.strokeStyle = String(this._opts.wallDebugColor || DEFAULTS.wallDebugColor || "#ff0000");
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            for (let i = 0; i < this._walls.length; i++) {
                const w = this._walls[i];
                const ax = w.ax - ox, ay = w.ay - oy;
                const bx = w.bx - ox, by = w.by - oy;

                if ((ax < -50 && bx < -50) || (ax > Graphics.width + 50 && bx > Graphics.width + 50) ||
                    (ay < -50 && by < -50) || (ay > Graphics.height + 50 && by > Graphics.height + 50)) {
                    continue;
                }
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
            }
            ctx.stroke();
        }

        ctx.restore();
        bmp._setDirty();
        this._syncLineSpriteAfterRedraw_();
    };

    KggMiniGameRuntime.prototype._syncLineSpriteAfterRedraw_ = function () {
        const sp = this._lineSprite;
        if (!sp || !this._lineBmp) return;

        // baseBitmap未設定なら、bitmapを差し直して通常描画のまま保つ
        if (!sp._baseBitmap) sp.bitmap = this._lineBmp;

        // yuraDirect時は、bitmap更新に合わせてメッシュ側も更新
        if (sp._meshSprite && sp._yuraDirect && this._lineBmp.checkDirty) {
            this._lineBmp.checkDirty();
            sp._meshSprite._meshDirty = true;
            sp._meshSprite.updateMesh();
        }
    };

    KggMiniGameRuntime.prototype._resetWallCandidates_ = function () {
        this._wallCandCounter = 0;
        this._wallCandLastX = null;
        this._wallCandLastY = null;
        this._updateWallCandidates_();
    };


    KggMiniGameRuntime.prototype._updateAutoScroll = function (dt) {
        const sp = Number(this._opts.scrollSpeed || DEFAULTS.scrollSpeed); // px/sec
        if (sp <= 0) return;

        const th = $gameMap.tileHeight();

        // pxを貯めて、整数pxだけ進める
        this._autoScrollCarryPx = (this._autoScrollCarryPx || 0) + sp * dt;
        const stepPx = Math.floor(this._autoScrollCarryPx + 1e-6);
        if (stepPx <= 0) return;
        this._autoScrollCarryPx -= stepPx;

        const distTiles = stepPx / th;

        const maxDy = Math.max(0, $gameMap.height() - $gameMap.screenTileY());
        const curDy = $gameMap.displayY();
        const remain = maxDy - curDy;
        if (remain <= 0.00001) return;

        $gameMap.scrollUp(Math.min(distTiles, remain));

        // 念のためスナップ（scrollUp直後はdisplayYが小数になり得る）
        this._setDisplayPosPx_($gameMap.displayX(), $gameMap.displayY());
    };


    KggMiniGameRuntime.prototype._updatePhysics = function (dt) {
        const r = Number(this._opts.radius || DEFAULTS.radius);
        const g = Number(this._opts.gravity || DEFAULTS.gravity);

        // 速度に応じて分割（簡易）
        const vAbs = Math.max(Math.abs(this._vx), Math.abs(this._vy));
        const move = vAbs * dt;
        const steps = clamp(Math.ceil(move / Math.max(8, r * 0.5)), 1, 5);
        const sub = dt / steps;

        for (let i = 0; i < steps; i++) {
            // 重力
            this._vy += g * sub;
            this._clampVelocity();

            // 移動
            this._ballX += this._vx * sub;
            this._ballY += this._vy * sub;

            // 壁/画面端（上端はバウンドしない、下端はゲームオーバー）
            if (this._handleScreenBounds(r)) return;

            // マップ壁との衝突（線分壁：画面端と同じ反射）
            this._handleMapWallCollision(r);

            // 線との衝突（最大1回/ステップ）
            this._handleTrampolineCollision(r);
        }
    };

    KggMiniGameRuntime.prototype._clampVelocity = function () {
        const maxVx = this._opts.maxVx;
        const maxVy = this._opts.maxVy;
        this._vx = clampAbs(this._vx, maxVx);
        this._vy = clampAbs(this._vy, maxVy);
    };


    KggMiniGameRuntime.prototype._handleScreenBounds = function (r) {
        const ox = this._tilemap.origin.x;
        const oy = this._tilemap.origin.y;

        const sx = this._ballX - ox;
        const sy = this._ballY - oy;

        const wallE = Number(this._opts.wallRestitution || DEFAULTS.wallRestitution);

        // 左
        if (sx - r < 0) {
            const oldVx = this._vx;
            const oldVy = this._vy;

            this._ballX = ox + r;
            this._vx = -this._vx * wallE;
            this._clampVelocity();

            this._applyBounceSpin_(oldVx, oldVy, 1, 0);
        }
        // 右
        if (sx + r > Graphics.width) {
            const oldVx = this._vx;
            const oldVy = this._vy;

            this._ballX = ox + (Graphics.width - r);
            this._vx = -this._vx * wallE;
            this._clampVelocity();

            this._applyBounceSpin_(oldVx, oldVy, -1, 0);
        }

        // 上端はバウンドしない（何もしない）

        // 下端でゲームオーバー（即リトライしない：イベントへ委譲）
        if (sy + r > Graphics.height + 160) {
            this._onFallGameOver_();
            return true;
        }

        return false;
    };

    // ----------------------------
    // ゴール判定＆成功処理
    // ----------------------------
    KggMiniGameRuntime.prototype._isGoal_ = function () {
        const th = $gameMap.tileHeight();
        const tileY = Math.floor(this._ballY / th);
        return tileY < 2; // 画面上部2タイル以内でゴール扱い
    };

    KggMiniGameRuntime.prototype._onGoal_ = function () {
        if (this._goalTriggered) return;
        this._goalTriggered = true;

        // 成功イベント発火
        if ($gameVariables && $gameVariables.setValue) {
            $gameVariables.setValue(47, 2);
        }

        // 成功中はボールを止める
        this._vx = 0;
        this._vy = 0;
        this._ballSpinVel = 0;

        // カメラを最上端(=displayY 0)へ急いで追いつかせる
        this._successCamActive = true;

        this._phase = "success";
    };

    KggMiniGameRuntime.prototype._updateSuccessCamera_ = function (dt) {
        if (!this._successCamActive) return;

        const targetY = 0; // 最上端
        const curY = $gameMap.displayY();

        // なめらかに急いで追いつく（指数イージング）
        const k = Number(this._opts.successCamK || 14.0); // 好みで調整可
        const a = 1 - Math.exp(-k * dt);
        const nextY = curY + (targetY - curY) * a;

        if (Math.abs(nextY - targetY) < 0.001) {
            this._setDisplayPosPx_($gameMap.displayX(), targetY);
            this._successCamActive = false;
        } else {
            this._setDisplayPosPx_($gameMap.displayX(), nextY);
        }
    };



    KggMiniGameRuntime.prototype._handleMapWallCollision = function (r) {
        // マップメモ欄(<MGWall: ax,ay,bx,by>)で定義した線分壁との衝突
        const walls = this._wallCandidates ? this._wallCandidates : this._walls;
        if (!walls || walls.length === 0) return;

        const wallE = Number(this._opts.wallRestitution || DEFAULTS.wallRestitution);
        const rr = r * r;

        // 角の抜け対策で2回だけ解決
        for (let pass = 0; pass < 2; pass++) {
            let best = null;
            let bestC = null;
            let bestD2 = Infinity;

            for (let i = 0; i < walls.length; i++) {
                const w = walls[i];
                const c = closestPointOnSegment(this._ballX, this._ballY, w.ax, w.ay, w.bx, w.by);
                const dx = this._ballX - c.x;
                const dy = this._ballY - c.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < rr && d2 < bestD2) {
                    bestD2 = d2;
                    best = w;
                    bestC = c;
                }
            }

            if (!best) break;

            const dist = Math.sqrt(Math.max(0.000001, bestD2));
            const nx = (this._ballX - bestC.x) / dist;
            const ny = (this._ballY - bestC.y) / dist;

            // 押し出し（めり込み解消）
            const overlap = (r - dist) + 0.5;
            this._ballX += nx * overlap;
            this._ballY += ny * overlap;

            // 反射（画面端と同じ）
            const oldVx = this._vx;
            const oldVy = this._vy;

            const vn = this._vx * nx + this._vy * ny;
            if (vn < 0) {
                const j = (1 + wallE) * vn;
                this._vx -= j * nx;
                this._vy -= j * ny;
                this._clampVelocity();
                this._applyBounceSpin_(oldVx, oldVy, nx, ny);

                var vol = (60 + 50 * ((Math.hypot(this._vx, this._vy) - 300) / 400)).clamp(50, 120);
                var pit = (100 + 30 * ((Math.hypot(this._vx, this._vy) - 300) / 400)).clamp(100, 150) + _rand(-10, 10);
                $gameSystem.playStaticSe('00_powa', vol, pit);
                this._triggerBallScaleBounce_(0, Math.abs(vn));

            }
        }
    };


    KggMiniGameRuntime.prototype._handleTrampolineCollision = function (r) {
        if (!this._segments || this._segments.length <= 0) return;

        const rr = r * r;

        // 当たってる線分を1つだけ拾う（最も近い線分）
        let best = null, bestC = null, bestD2 = Infinity, bestI = -1;
        for (let i = 0; i < this._segments.length; i++) {
            const s = this._segments[i];
            const c = closestPointOnSegment(this._ballX, this._ballY, s.ax, s.ay, s.bx, s.by);
            const dx = this._ballX - c.x;
            const dy = this._ballY - c.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < rr && d2 < bestD2) {
                bestD2 = d2;
                best = s;
                bestC = c;
                bestI = i;
            }
        }
        if (!best) return;

        const dist = Math.sqrt(Math.max(0.000001, bestD2));
        const nx = (this._ballX - bestC.x) / dist;
        const ny = (this._ballY - bestC.y) / dist;

        // 押し出し
        const overlap = (r - dist) + 0.5;
        this._ballX += nx * overlap;
        this._ballY += ny * overlap;

        const oldVx = this._vx;
        const oldVy = this._vy;

        // 近づいてないなら、押し出すだけで終了（変な再反射防止）
        const vnIn = this._vx * nx + this._vy * ny;
        if (vnIn >= 0) return;

        const speed = hypot(this._vx, this._vy);
        const baseMin = Number(this._opts.minTrampolineNormalSpeed || DEFAULTS.minTrampolineNormalSpeed);

        if (speed < 0.0001) {
            this._vx = nx * baseMin;
            this._vy = ny * baseMin;
            this._clampVelocity();
            this._applyBounceSpin_(oldVx, oldVy, nx, ny);
            return;
        }

        // 接線方向（基本は速度から作る。ダメなら線分方向を使う）
        let tx = this._vx - vnIn * nx;
        let ty = this._vy - vnIn * ny;
        let tlen = hypot(tx, ty);

        if (tlen < 0.0001) {
            tx = best.bx - best.ax;
            ty = best.by - best.ay;
            tlen = hypot(tx, ty) || 1;
            // 進行方向に合わせて反転
            if ((this._vx * tx + this._vy * ty) < 0) { tx = -tx; ty = -ty; }
        }
        tx /= tlen;
        ty /= tlen;

        const normalRatio = clamp(Number(this._opts.normalRatio || DEFAULTS.normalRatio), 0, 1);
        const tangentRatio = 1 - normalRatio;
        const mixLen = hypot(normalRatio, tangentRatio) || 1;

        const mul = Number(this._opts.trampolineRestitution || DEFAULTS.trampolineRestitution);
        const newSpeed = speed * mul;

        this._vx = (normalRatio * nx + tangentRatio * tx) * (newSpeed / mixLen);
        this._vy = (normalRatio * ny + tangentRatio * ty) * (newSpeed / mixLen);

        // 最低射出（法線方向）
        const minN = Number(this._opts.minTrampolineNormalSpeed || 0);
        if (minN > 0) {
            const vn = this._vx * nx + this._vy * ny;
            if (vn < minN) {
                const add = (minN - vn);
                this._vx += nx * add;
                this._vy += ny * add;
            }
        }

        this._clampVelocity();
        this._applyBounceSpin_(oldVx, oldVy, nx, ny);
        if (bestI >= 0) this._triggerTrampolineBoing_(bestI, nx, ny);
        var vol = (60 + 50 * ((newSpeed - 300) / 400)).clamp(50, 120);
        var pit = (90 + 120 * ((Math.hypot(this._vx, this._vy) - 300) / 400)).clamp(90, 120) + _rand(-10, 10);
        $gameSystem.playStaticSe('00_Jump', vol, pit);
    };



    KggMiniGameRuntime.prototype._updateBallSpritePos = function () {
        if (!this._ballSprites || this._ballSprites.length <= 0) return;

        // img/system/balls.png のロード後にフレームをセット
        this._refreshBallFrames_();

        for (let i = 0; i < this._ballSprites.length; i++) {
            const sp = this._ballSprites[i];
            const st = this._ballStates[i];
            if (!sp || !st) continue;
            sp.x = st.x;
            sp.y = st.y;
            sp.rotation = st.angle;
            sp.update();
        }
    };

    KggMiniGameRuntime.prototype._onFallGameOver_ = function () {
        if (this._fallTriggered) return;
        this._fallTriggered = true;

        // ミニゲーム停止
        this._phase = "gameover";
        this._vx = 0;
        this._vy = 0;
        this._drawing = false;
        this._lastPoint = null;

        // イベント呼び出し
        $gameVariables.setValue(47, 1);
    };


    // ----------------------------
    // ボール表示（balls.png 4分割）
    // ----------------------------
    KggMiniGameRuntime.prototype._refreshBallFrames_ = function () {
        if (!this._ballsBitmap) return;
        if (!this._ballsBitmap.isReady || !this._ballsBitmap.isReady()) return;

        // 既にセット済みなら何もしない
        if (this._ballsFrameReady) return;

        const bw = this._ballsBitmap.width;
        const bh = this._ballsBitmap.height;
        const fw = Math.floor(bw / 4);
        const fh = bh;

        if (fw <= 0 || fh <= 0) return;

        for (let i = 0; i < this._ballSprites.length; i++) {
            const sp = this._ballSprites[i];
            sp.setFrame(fw * i, 0, fw, fh);
        }

        this._ballsFrameReady = true;
    };

    // 先頭ボールの履歴を初期化（追従の開始を安定させる）
    KggMiniGameRuntime.prototype._initLeadHistory_ = function () {
        this._ballsFrameReady = false;

        // followMode:
        //   "distance" : 先頭の軌跡から、距離一定で追従（速度が変わっても間隔が保たれやすい）
        //   "time"     : 従来どおり、フレーム遅れで追従
        const rawMode = (this._opts && this._opts.followMode != null) ? String(this._opts.followMode) : String(DEFAULTS.followMode || "time");
        const mode = rawMode.toLowerCase();
        this._followMode = (mode === "time") ? "time" : "distance";

        // time-mode param（0 も有効なので isFinite で判定）
        const delayOpt = Number(this._opts.followDelayFrames);
        const delay = isFinite(delayOpt) ? delayOpt : Number(DEFAULTS.followDelayFrames);
        this._followDelayFrames = clamp(Math.floor(delay), 0, 240);

        // distance-mode param
        const spacingOpt = Number(this._opts.followSpacing);
        const spacing = isFinite(spacingOpt) ? spacingOpt : Number(DEFAULTS.followSpacing);
        this._followSpacing = clamp(spacing, 0, 9999);

        if (this._followMode === "time") {
            // ===== 従来：フレーム遅れ追従 =====
            const need = this._followDelayFrames * (Math.max(1, this._numBalls) - 1) + 2;
            this._leadHist = [];
            for (let i = 0; i < need; i++) {
                this._leadHist.push({ x: this._ballX, y: this._ballY, angle: this._ballAngle, s: 0 });
            }
            // 履歴の上限（少し余裕）
            this._leadHistMax = need + 300;

            // distance-mode の値はクリア
            this._trail = [];
            this._trailMaxDist = 0;
        } else {
            // ===== 新：距離一定追従 =====
            this._leadHist = [];
            this._leadHistMax = 0;

            this._trail = [{ x: this._ballX, y: this._ballY, angle: this._ballAngle, s: 0 }];

            // 末尾が保持できれば OK なので、必要距離 + 余白 を保存する
            const needDist = this._followSpacing * (Math.max(1, this._numBalls) - 1);
            this._trailMaxDist = Math.max(600, needDist + this._followSpacing * 4 + 400);
        }

        // 描画用状態を初期化（開始時は全員同じ位置・角度）
        this._ballStates = [];
        for (let i = 0; i < this._numBalls; i++) {
            const info = this._spinInfo[i] || { scale: 1, offset: 0 };
            this._ballStates[i] = { x: this._ballX, y: this._ballY, angle: this._ballAngle * info.scale + info.offset };
        }
    };

    // 角度補間（-PI..PI の最短経路）
    KggMiniGameRuntime.prototype._lerpAngle_ = function (a, b, t) {
        let d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
    };

    // distance-mode：先頭の軌跡（距離S）を更新
    KggMiniGameRuntime.prototype._pushTrailPoint_ = function () {
        if (!this._trail) this._trail = [];
        const tr = this._trail;

        const last = tr.length > 0 ? tr[tr.length - 1] : null;
        if (!last) {
            tr.push({ x: this._ballX, y: this._ballY, angle: this._ballAngle, s: 0 });
            return;
        }

        const dx = this._ballX - last.x;
        const dy = this._ballY - last.y;
        const ds = Math.hypot(dx, dy);

        // ほぼ動いていない場合は角度だけ更新（停止中でも回転は反映）
        if (ds < 0.25) {
            last.angle = this._ballAngle;
            return;
        }

        tr.push({ x: this._ballX, y: this._ballY, angle: this._ballAngle, s: last.s + ds });

        // 古い軌跡をまとめて捨てる（一定距離だけ保持）
        const lastS = tr[tr.length - 1].s;
        if (lastS - tr[0].s > this._trailMaxDist) {
            let idx = 0;
            while (idx < tr.length - 2 && (lastS - tr[idx].s) > this._trailMaxDist) idx++;
            const remove = Math.max(0, idx - 1); // 補間用に1点残す
            if (remove > 0) tr.splice(0, remove);
        }
    };

    // distance-mode：末尾から backDist(px) 戻った位置をサンプル
    KggMiniGameRuntime.prototype._sampleTrailByBackDist_ = function (backDist) {
        const tr = this._trail;
        if (!tr || tr.length <= 0) return { x: this._ballX, y: this._ballY, angle: this._ballAngle };

        const last = tr[tr.length - 1];
        const targetS = last.s - backDist;

        if (targetS <= tr[0].s) {
            return { x: tr[0].x, y: tr[0].y, angle: tr[0].angle };
        }

        // 末尾から逆走して区間を探す（targetS は末尾付近になることが多い）
        let i = tr.length - 2;
        while (i >= 0 && tr[i].s > targetS) i--;
        if (i < 0) return { x: tr[0].x, y: tr[0].y, angle: tr[0].angle };

        const a = tr[i];
        const b = tr[i + 1] || a;
        const den = (b.s - a.s);
        let t = den > 0 ? (targetS - a.s) / den : 0;
        t = clamp(t, 0, 1);

        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const angle = this._lerpAngle_(a.angle, b.angle, t);

        return { x: x, y: y, angle: angle };
    };


    // time-mode：先頭履歴から「startIdx 以前で、s <= sMax を満たす最も新しい点」をサンプル（必要なら補間）
    KggMiniGameRuntime.prototype._sampleLeadHistBySMax_ = function (startIdx, sMax) {
        const hist = this._leadHist;
        if (!hist || hist.length <= 0) {
            return { x: this._ballX, y: this._ballY, angle: this._ballAngle, s: 0 };
        }

        startIdx = clamp(startIdx, 0, hist.length - 1);

        // 制約なし
        if (!isFinite(sMax)) {
            const h = hist[startIdx];
            return { x: h.x, y: h.y, angle: h.angle, s: isFinite(h.s) ? h.s : 0 };
        }

        const s0 = isFinite(hist[0].s) ? hist[0].s : 0;
        if (sMax <= s0) {
            const h = hist[0];
            return { x: h.x, y: h.y, angle: h.angle, s: isFinite(h.s) ? h.s : 0 };
        }

        const sStart = isFinite(hist[startIdx].s) ? hist[startIdx].s : 0;
        if (sStart <= sMax) {
            const h = hist[startIdx];
            return { x: h.x, y: h.y, angle: h.angle, s: isFinite(h.s) ? h.s : 0 };
        }

        // startIdx から過去へ辿って、s <= sMax になる点を探す
        let i = startIdx;
        while (i > 0 && (isFinite(hist[i].s) ? hist[i].s : 0) > sMax) i--;

        const a = hist[i];
        const b = hist[Math.min(i + 1, startIdx)];
        const as = isFinite(a.s) ? a.s : 0;
        const bs = isFinite(b.s) ? b.s : as + 1;

        const denom = bs - as;
        const t = denom > 1e-6 ? clamp((sMax - as) / denom, 0, 1) : 0;

        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const angle = this._lerpAngle_(a.angle, b.angle, t);

        return { x: x, y: y, angle: angle, s: sMax };
    };


    // 回転の更新（先頭のみ）
    KggMiniGameRuntime.prototype._updateRotation_ = function (dt) {
        // 減衰（60fps基準）
        const dampingBase = Number(this._opts.spinDamping || DEFAULTS.spinDamping);
        const damping = Math.pow(dampingBase, dt * 60);
        this._ballSpinVel *= damping;

        // 極小は0にスナップ（微妙なフラつき残り防止）
        if (Math.abs(this._ballSpinVel) < 0.0005) this._ballSpinVel = 0;

        this._ballAngle += this._ballSpinVel * dt;
    };


    // 追従更新（先頭の履歴から、人数ぶんの描画状態を作る）
    KggMiniGameRuntime.prototype._updateFollowersFromHistory_ = function () {
        if (!this._ballSprites || this._ballSprites.length <= 0) return;

        if (this._followMode === "time") {
            // ===== time-mode：フレーム遅れ追従 =====
            const prev = this._leadHist.length > 0 ? this._leadHist[this._leadHist.length - 1] : null;
            const prevS = prev && isFinite(prev.s) ? prev.s : 0;
            const ds = prev ? Math.hypot(this._ballX - prev.x, this._ballY - prev.y) : 0;
            const s = prevS + ds;
            this._leadHist.push({ x: this._ballX, y: this._ballY, angle: this._ballAngle, s: s });
            while (this._leadHist.length > this._leadHistMax) this._leadHist.shift();
        } else {
            // ===== distance-mode：距離一定追従 =====
            this._pushTrailPoint_();
        }

        // 描画用ステートを更新
        this._ballStates.length = this._numBalls;

        let prevS = null;


        for (let i = 0; i < this._numBalls; i++) {
            let src;

            if (this._followMode === "time") {
                const delayFrames = this._followDelayFrames * i;
                const baseIdx = Math.max(0, this._leadHist.length - 1 - delayFrames);

                if (i > 0 && this._followMinSpacing > 0) {
                    const sMax = (isFinite(prevS) ? prevS : 0) - this._followMinSpacing;
                    src = this._sampleLeadHistBySMax_(baseIdx, sMax);
                } else {
                    const h = this._leadHist[baseIdx] || this._leadHist[0] || { x: this._ballX, y: this._ballY, angle: this._ballAngle, s: 0 };
                    src = { x: h.x, y: h.y, angle: h.angle, s: isFinite(h.s) ? h.s : 0 };
                }

                prevS = src.s;
            } else {
                const backDist = this._followSpacing * i;
                src = this._sampleTrailByBackDist_(backDist);
            }

            const info = this._spinInfo[i] || { scale: 1, offset: 0 };
            const angle = src.angle * info.scale + info.offset;

            this._ballStates[i] = { x: src.x, y: src.y, angle: angle };
        }
    };

    // 反射で回転を足す（先頭のみ）: 符号は固定、ランダムは強さだけ
    KggMiniGameRuntime.prototype._applyBounceSpin_ = function (oldVx, oldVy, nx, ny) {
        const dvx = this._vx - oldVx;
        const dvy = this._vy - oldVy;
        const power = Math.hypot(dvx, dvy);
        if (power < 0.01) return;

        const r = Math.max(1, Number(this._opts.radius || DEFAULTS.radius));
        const bounceMul = Number(this._opts.spinBounceMul || DEFAULTS.spinBounceMul);

        const randOpt = Number(this._opts.spinBounceRand);
        const rand = isFinite(randOpt) ? randOpt : Number(DEFAULTS.spinBounceRand);
        const jitter = clamp(rand, 0, 3);

        const info = this._spinInfo[0] || { bounceMul: 1 };

        // 接線方向インパルス（符号だけ安定して使う）
        const tangentImpulse = dvx * (-ny) + dvy * (nx);

        let sign;
        if (Math.abs(tangentImpulse) < 0.001) {
            // ほぼ正面衝突：いま回ってる向きを維持（回ってないなら足さない）
            sign = this._ballSpinVel > 0 ? 1 : (this._ballSpinVel < 0 ? -1 : 0);
            if (sign === 0) return;
        } else {
            sign = tangentImpulse >= 0 ? 1 : -1;
        }

        // 大きさは衝突強さ(power)に比例。ランダムは倍率のみ（符号は触らない）
        const base = (power / r) * 4.0 * bounceMul * info.bounceMul;

        const magJitter = 0.25 * jitter; // 0〜0.75
        let mul = 1 + (Math.random() * 2 - 1) * magJitter;
        mul = Math.max(0.15, mul);

        this._ballSpinVel += sign * base * mul;
        this._ballSpinVel = this._ballSpinVel.clamp(-9, 9);
    };


    // ボール拡大縮小バウンドアニメ（ballIndex: 0～）
    KggMiniGameRuntime.prototype._triggerBallScaleBounce_ = function (ballIndex, impactSpeed) {
        if (!this._ballSprites || !this._ballSprites[ballIndex]) return;
        const sp = this._ballSprites[ballIndex];

        // 速いほど強く（好みで調整）
        const a = clamp((impactSpeed || 0) / 500, 1, 3);

        sp._scaleBounce = {
            t: 0,
            dur: 0.18,                 // 全体の長さ（秒）
            squash: 1 - 0.18 * a,       // 最初に縮む
            stretch: 1 + 0.14 * a       // その後ふくらむ
        };
    };

    KggMiniGameRuntime.prototype._updateBallScaleBounce_ = function (dt) {
        if (!this._ballSprites) return;

        for (let i = 0; i < this._ballSprites.length; i++) {
            const sp = this._ballSprites[i];
            const anim = sp && sp._scaleBounce;
            if (!anim) continue;

            anim.t += dt;
            const p = clamp(anim.t / anim.dur, 0, 1);

            // 0→縮む →ふくらむ →戻る（全部イージングで）
            const easeOut = (x) => 1 - Math.pow(1 - x, 3);
            let s;

            if (p < 0.33) {
                const q = easeOut(p / 0.33);
                s = 1 + (anim.squash - 1) * q;
            } else if (p < 0.66) {
                const q = easeOut((p - 0.33) / 0.33);
                s = anim.squash + (anim.stretch - anim.squash) * q;
            } else {
                const q = easeOut((p - 0.66) / 0.34);
                s = anim.stretch + (1 - anim.stretch) * q;
            }

            sp.scale.x = sp.scale.y = s;

            if (p >= 1) {
                sp.scale.x = sp.scale.y = 1;
                sp._scaleBounce = null;
            }
        }
    };


    // -------------------------------------------------------------------------
    // 壁作成用 開発ツール（通常のScene_Map上でドラッグして線分を作る）
    // -------------------------------------------------------------------------
    // 使い方：
    //   1) コンソール等から有効化： KGG_MiniGameWallDev.enable(true)
    //   2) 通常のマップ上で 左ドラッグ→赤線（離すと確定＆保持）
    //   3) Ctrl+Z：1本取り消し（確定分のみ）
    //   4) Ctrl+P：現在のマップの壁タグをコンソール出力＋（可能なら）クリップボードへコピー
    //
    // 保存先：$gameSystem._kggWallDevByMap[mapId] = [{ax,ay,bx,by}, ...]（px）
    //
    // ※ミニゲームシーン（Scene_MiniGame）では動作しない
    // -------------------------------------------------------------------------
    window.KGG_MiniGameWallDev = window.KGG_MiniGameWallDev || {};
    const KGG_WallDev = window.KGG_MiniGameWallDev;

    KGG_WallDev._enabled = false;
    KGG_WallDev._reqUndo = false;
    KGG_WallDev._reqExport = false;
    KGG_WallDev._listenerAdded = KGG_WallDev._listenerAdded || false;

    KGG_WallDev.enable = function (on) {
        this._enabled = (on !== false);
        console.log("[KGG_WallDev] enabled =", this._enabled, " (Ctrl+Z undo / Ctrl+P or Ctrl+E export)");
    };
    KGG_WallDev.disable = function () { this.enable(false); };
    KGG_WallDev.toggle = function () { this.enable(!this._enabled); };
    KGG_WallDev.isEnabled = function () { return !!this._enabled; };


    // 開発ツールON中は「タップ移動」を無効化（目的地設定を潰す）
    const _KGG_WallDev_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function () {
        if (KGG_WallDev.isEnabled && KGG_WallDev.isEnabled() && !(this instanceof Scene_MiniGame)) {
            $gameTemp.clearDestination();
            return;
        }
        _KGG_WallDev_processMapTouch.call(this);
    };

    const _KGG_WallDev_updateDestination = Scene_Map.prototype.updateDestination;
    Scene_Map.prototype.updateDestination = function () {
        if (KGG_WallDev.isEnabled && KGG_WallDev.isEnabled() && !(this instanceof Scene_MiniGame)) {
            $gameTemp.clearDestination();
            return;
        }
        _KGG_WallDev_updateDestination.call(this);
    };


    function kggWallDevData_() {
        if (!$gameSystem) return null;
        if (!$gameSystem._kggWallDevByMap) $gameSystem._kggWallDevByMap = {};
        return $gameSystem._kggWallDevByMap;
    }

    function kggTryCopy_(text) {
        // ブラウザ系
        try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).catch(function () { });
                return true;
            }
        } catch (e) { }

        // NW.js（RPGツクールMV実行環境）
        try {
            if (window.nw && nw.Clipboard && nw.Clipboard.get) {
                nw.Clipboard.get().set(text, "text");
                return true;
            }
        } catch (e2) { }

        return false;
    }

    function kggParseNoteWalls_() {
        const src = ($dataMap && $dataMap.note) ? String($dataMap.note) : "";
        if (!src) return [];
        const segs = [];
        const reTag = /<\s*MGWall\s*:\s*([^>]+)\s*>/gi;
        let m;
        while ((m = reTag.exec(src))) {
            const raw = String(m[1] || "");
            // "612,2,611,42" / "612, 2, 611, 42" / "612 2 611 42" どれでもOK
            const parts = raw.split(/[\s,]+/).filter(Boolean);
            if (parts.length < 4) continue;

            const ax = Number(parts[0]);
            const ay = Number(parts[1]);
            const bx = Number(parts[2]);
            const by = Number(parts[3]);
            if (![ax, ay, bx, by].every(Number.isFinite)) continue;
            const dx = bx - ax, dy = by - ay;
            if (dx * dx + dy * dy < 1e-6) continue;
            segs.push({ ax, ay, bx, by });
        }
        return segs;
    }


    KGG_WallDev.exportText = function (mapId) {
        mapId = mapId || ($gameMap ? $gameMap.mapId() : 0);
        const curMapId = $gameMap ? $gameMap.mapId() : 0;

        // 既にメモ欄に書いてある壁（※現在表示中のマップだけ読める）
        const noteSegs = (mapId === curMapId) ? kggParseNoteWalls_() : [];

        // 開発ツールで引いた壁
        const data = kggWallDevData_();
        const segs = (data && data[mapId]) ? data[mapId] : [];

        // 重複除去しつつ結合（メモ欄→開発ツールの順）
        const lines = [];
        const seen = Object.create(null);

        function pushSeg(ax, ay, bx, by) {
            const axr = Math.round(ax), ayr = Math.round(ay);
            const bxr = Math.round(bx), byr = Math.round(by);
            const key = axr + "," + ayr + "," + bxr + "," + byr;
            if (seen[key]) return;
            seen[key] = true;
            lines.push("<MGWall: " + axr + "," + ayr + "," + bxr + "," + byr + ">");
        }

        for (let i = 0; i < noteSegs.length; i++) {
            const s = noteSegs[i];
            pushSeg(s.ax, s.ay, s.bx, s.by);
        }
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            pushSeg(s.ax, s.ay, s.bx, s.by);
        }

        return lines.join("\n");
    };

    KGG_WallDev.exportNow = function () {
        const text = this.exportText();
        console.log("----- MGWall export (copy-paste to Map Note) -----\n" + text + "\n-----------------------------------------------");
        const ok = kggTryCopy_(text);
        console.log("[KGG_WallDev] clipboard:", ok ? "requested" : "not available");
        return text;
    };

    // キー監視（Ctrl+Z / Ctrl+P）
    if (!KGG_WallDev._listenerAdded && typeof document !== "undefined") {
        KGG_WallDev._listenerAdded = true;
        document.addEventListener("keydown", function (e) {
            if (!KGG_WallDev._enabled) return;

            // ミニゲーム中は無視
            if (SceneManager && SceneManager._scene && (SceneManager._scene instanceof Scene_MiniGame)) return;

            // Ctrl+Z（undo）
            const key = (e.key || "").toLowerCase();
            const code = e.keyCode || 0;

            if (e.ctrlKey && !e.shiftKey && !e.altKey && (key === "z" || code === 90)) {
                KGG_WallDev._reqUndo = true;
                e.preventDefault();
                return;
            }

            // Ctrl+P / Ctrl+E（export）
            if (e.ctrlKey && !e.altKey && ((key === "p" || code === 80) || (key === "e" || code === 69))) {
                KGG_WallDev._reqExport = true;
                e.preventDefault();
                return;
            }
        });
    }

    // ランタイム（Scene_Mapにぶら下げる）
    function KggWallDevRuntime(scene) {
        this._scene = scene;
        this._overlay = null;
        this._g = null;

        this._drawing = false;
        this._sx = 0; this._sy = 0;
        this._cx = 0; this._cy = 0;

        this._mapId = 0;
        this._segs = null;
        this._noteSegs = null;
        this._refreshMapRef();
        this._ensureOverlay();
    }

    KggWallDevRuntime.prototype._refreshMapRef = function () {
        const mapId = $gameMap ? $gameMap.mapId() : 0;
        if (mapId === this._mapId && this._segs && this._noteSegs) return;

        this._mapId = mapId;
        const data = kggWallDevData_();
        if (data) {
            if (!data[mapId]) data[mapId] = [];
            this._segs = data[mapId];
        } else {
            this._segs = [];
        }
        // メモ欄に書かれた既存の壁も読む（px）
        this._noteSegs = kggParseNoteWalls_();
        this._redraw();
    };

    KggWallDevRuntime.prototype._ensureOverlay = function () {
        if (this._overlay) return;
        if (!this._scene || !this._scene._spriteset) return;

        this._overlay = new PIXI.Container();
        this._g = new PIXI.Graphics();
        this._overlay.addChild(this._g);

        // 画面の上に出す：baseSpriteへ
        this._scene._spriteset._baseSprite.addChild(this._overlay);
        this._redraw();
    };

    KggWallDevRuntime.prototype.terminate = function () {
        try {
            if (this._overlay && this._scene && this._scene._spriteset && this._scene._spriteset._baseSprite) {
                this._scene._spriteset._baseSprite.removeChild(this._overlay);
            }
        } catch (e) { }
        this._overlay = null;
        this._g = null;
        this._scene = null;
    };

    KggWallDevRuntime.prototype._worldPosFromMouse = function () {
        const tilemap = this._scene && this._scene._spriteset ? this._scene._spriteset._tilemap : null;
        const ox = tilemap ? tilemap.origin.x : 0;
        const oy = tilemap ? tilemap.origin.y : 0;
        return { x: TouchInput.x + ox, y: TouchInput.y + oy, ox: ox, oy: oy };
    };

    KggWallDevRuntime.prototype._consumeCommands = function () {
        if (KGG_WallDev._reqUndo) {
            KGG_WallDev._reqUndo = false;
            if (this._segs && this._segs.length > 0) {
                this._segs.pop();
                this._redraw();
            }
        }
        if (KGG_WallDev._reqExport) {
            KGG_WallDev._reqExport = false;
            KGG_WallDev.exportNow();
        }
    };

    KggWallDevRuntime.prototype.update = function () {
        this._refreshMapRef();
        this._ensureOverlay();
        this._consumeCommands();

        if (!this._overlay || !this._g) return;

        // overlayをスクロールに追従（ワールド座標で描く）
        const tilemap = this._scene && this._scene._spriteset ? this._scene._spriteset._tilemap : null;
        if (tilemap) {
            this._overlay.x = -tilemap.origin.x;
            this._overlay.y = -tilemap.origin.y;
        }

        // 入力
        const pressed = TouchInput.isPressed();
        const triggered = TouchInput.isTriggered();
        const released = TouchInput.isReleased();

        if (triggered) {
            const p = this._worldPosFromMouse();
            this._drawing = true;
            this._sx = p.x; this._sy = p.y;
            this._cx = p.x; this._cy = p.y;
            this._redraw();
        } else if (pressed && this._drawing) {
            const p = this._worldPosFromMouse();
            if (p.x !== this._cx || p.y !== this._cy) {
                this._cx = p.x; this._cy = p.y;
                this._redraw();
            }
        } else if (released && this._drawing) {
            this._drawing = false;

            const dx = this._cx - this._sx;
            const dy = this._cy - this._sy;
            const len2 = dx * dx + dy * dy;

            if (len2 >= 1) {
                this._segs.push({ ax: this._sx, ay: this._sy, bx: this._cx, by: this._cy });
            }
            this._redraw();
        }
    };

    KggWallDevRuntime.prototype._redraw = function () {
        if (!this._g) return;

        this._g.clear();

        // 既存（メモ欄）の壁：薄赤
        if (this._noteSegs && this._noteSegs.length > 0) {
            this._g.lineStyle(4, 0xff0000, 0.45);
            for (let i = 0; i < this._noteSegs.length; i++) {
                const s = this._noteSegs[i];
                this._g.moveTo(s.ax, s.ay);
                this._g.lineTo(s.bx, s.by);
            }
        }

        // 開発ツールで確定した線：濃赤
        if (this._segs && this._segs.length > 0) {
            this._g.lineStyle(4, 0xff0000, 1.0);
            for (let i = 0; i < this._segs.length; i++) {
                const s = this._segs[i];
                this._g.moveTo(s.ax, s.ay);
                this._g.lineTo(s.bx, s.by);
            }
        }

        // プレビュー
        if (this._drawing) {
            this._g.lineStyle(3, 0xff0000, 0.6);
            this._g.moveTo(this._sx, this._sy);
            this._g.lineTo(this._cx, this._cy);
        }
    };

    // Scene_Mapにフック（ミニゲーム以外で有効）
    const _KGG_WallDev_SceneMap_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _KGG_WallDev_SceneMap_update.call(this);

        if (!KGG_WallDev._enabled) return;
        if (this instanceof Scene_MiniGame) return;
        if (!this._spriteset) return;

        if (!this._kggWallDevRt) this._kggWallDevRt = new KggWallDevRuntime(this);
        this._kggWallDevRt.update();
    };

    const _KGG_WallDev_SceneMap_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function () {
        if (this._kggWallDevRt) {
            this._kggWallDevRt.terminate();
            this._kggWallDevRt = null;
        }
        _KGG_WallDev_SceneMap_terminate.call(this);
    };

})();




