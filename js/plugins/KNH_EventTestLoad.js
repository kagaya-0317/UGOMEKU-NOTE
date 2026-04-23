/*:
 * @plugindesc [MV] Event Test Reload System (save/test_save/<name>.rpgsave) + interpreter hot-swap (fingerprint) + BGM/BGS + $gameMessage FULL snapshot v1.6.0
 * @author ChatGPT
 *
 * @help
 * ■ 目的
 * マップイベント実行中に任意タイミングで「テスト用セーブ」を save/test_save/<name>.rpgsave に作成し、
 * そのセーブをロードして「セーブ地点から再開」してイベントテストを高速化します。
 *
 * ■ 重要仕様
 * - コモンイベント中の保存は非対応（保存要求したら警告して中止）
 * - ロード後、$gameMap._interpreter._list を「最新のイベントコマンド列」に差し替え
 * - 復帰位置は fingerprint により補正（直前or直後のどちらか1つでも一致したらその位置に復帰）
 * - pageIndex が変わるような編集は想定外（その場合はセーブし直してください）
 * - いったん中継シーンに移動してからロード処理（Scene_Map上でのゴチャつきを回避）
 * - セーブ時にBGM/BGSも記録し、ロード後に再生（map autoplay などの後で上書き）
 * - セーブ時に $gameMessage を「可能な限り全部」スナップショット保存し、ロード後に復元
 *
 * ■ $gameMessage FULL snapshot について
 * - $gameMessage の「インスタンスが持つ enumerable なプロパティ」を全て保存します
 *   （あなたが追加したプロパティも含めて保存されます）
 * - 関数（コールバック等）はJSON化できないので保存しません
 * - 「選択肢 / 数値入力 / アイテム選択」の最中は非対応（コールバック復元が困難）
 *   → その状態で TestSave すると警告して中止します
 * - 文章の表示途中（何文字目まで表示など）は復元しません（先頭から再描画になります）
 *
 * ■ 前提
 * - NW.js（ローカル実行）専用です。ブラウザ実行では動きません。
 * - save/test_save/ フォルダを自動作成します。
 *
 * ■ 使い方（イベントコマンド「スクリプト」 / コンソール）
 * 1) 保存（名前入力）
 *   TestReload.saveHere();
 *
 * 2) 保存（名前指定）
 *   TestReload.saveHere("boss2");
 *
 * 3) ロード（名前指定）
 *   TestReload.load("boss2");
 *
 * ■ プラグインコマンド
 *   TestSave                // 名前入力して保存
 *   TestSave boss2          // boss2で保存
 *   TestLoad boss2          // boss2をロード
 */

(function () {
    'use strict';

    // ============================================================
    // Utilities
    // ============================================================
    function isLocalMode() {
        return StorageManager && StorageManager.isLocalMode && StorageManager.isLocalMode();
    }

    function sanitizeName(name) {
        name = String(name || '').trim();
        if (!name) return 'test';
        // Windows等でNGな文字を置換（日本語OK）
        name = name.replace(/[\\\/:\*\?"<>\|]/g, '_');
        name = name.replace(/^[\.\s]+/, '').replace(/[\.\s]+$/, '');
        return name || 'test';
    }

    function ensureDir(path) {
        var fs = require('fs');
        try {
            if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        } catch (e) {
            try { fs.mkdirSync(path); } catch (_) { }
        }
    }

    function hash32(str) {
        str = String(str || '');
        var h = 2166136261 >>> 0; // FNV-1a
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    }

    function paramSig(params) {
        var s;
        try {
            s = JSON.stringify(params || []);
        } catch (e) {
            s = String(params || '');
        }
        var head = s.slice(0, 60);
        return { h: hash32(s), len: s.length, head: head };
    }

    function makeFingerprint(cmd) {
        if (!cmd) return null;
        return {
            code: cmd.code,
            indent: cmd.indent,
            sig: paramSig(cmd.parameters)
        };
    }

    function matchFingerprint(cmd, fp) {
        if (!cmd || !fp) return false;
        if (cmd.code !== fp.code) return false;
        if (cmd.indent !== fp.indent) return false;
        var sig = paramSig(cmd.parameters);
        return sig.h === fp.sig.h && sig.len === fp.sig.len && sig.head === fp.sig.head;
    }

    function clamp(n, a, b) {
        return Math.max(a, Math.min(b, n));
    }

    function deepCopy(obj) {
        return JsonEx.parse(JsonEx.stringify(obj));
    }

    // ============================================================
    // TestReload Core
    // ============================================================
    var TestReload = (window.TestReload = window.TestReload || {});
    TestReload._pendingMeta = null;
    TestReload._pendingAudio = null;
    TestReload._pendingMessageRaw = null;
    TestReload._pendingContents = null;
    TestReload._lastName = 'test';

    // 実行中の interpreter を（可能な範囲で）捕捉
    TestReload._currentInterpreter = null;
    TestReload._inExecuteCommand = false;


    // ---- Interpreter Gate (ロード完了チェック) ----
    // 目的：テストロード直後に interpreter が走り出し、キャラ参照が null になる等の「初期化途中」を避ける。
    // - stage 0: Scene_Map.onMapLoaded で interpreter patch / audio 適用が完了するまで止める
    // - stage 1: Scene_Map の spriteset / player sprite 等が揃うまで止める（フレーム固定ではなく条件判定）
    // - fail-safe: 一定フレーム超で解放（無限停止回避）
    TestReload._interpGate = null; // {active, stage, startFrame, mapId, eventId, pageIndex}

    TestReload._startInterpreterGate = function (meta) {
        this._interpGate = {
            active: true,
            stage: 0,
            startFrame: (Graphics && Graphics.frameCount) ? Graphics.frameCount : 0,
            mapId: meta ? meta.mapId : 0,
            eventId: meta ? meta.eventId : 0,
            pageIndex: meta ? meta.pageIndex : -1
        };
    };

    TestReload._markInterpreterGatePatched = function () {
        if (this._interpGate && this._interpGate.active) this._interpGate.stage = 1;
    };

    TestReload._isInterpreterGateReady = function () {
        var g = this._interpGate;
        if (!g || !g.active) return true;

        var nowFrame = (Graphics && Graphics.frameCount) ? Graphics.frameCount : 0;
        if ((nowFrame - (g.startFrame || 0)) > 300) { // 約5秒@60fps
            console.warn('[TestReload] interpreter gate timeout; releasing.');
            g.active = false;
            return true;
        }

        if (g.stage < 1) return false;

        if (!DataManager || !DataManager.isMapLoaded || !DataManager.isMapLoaded()) return false;
        if (!$gameMap || !$gamePlayer) return false;
        if (g.mapId && $gameMap.mapId && $gameMap.mapId() !== g.mapId) return false;

        var scene = SceneManager ? SceneManager._scene : null;
        if (!scene || !(scene instanceof Scene_Map)) return false;
        if (!scene._spriteset || !scene._spriteset._tilemap) return false;

        var cs = scene._spriteset._characterSprites;
        if (!cs || !cs.length) return false;

        // this.character(0) が確実に有効になる目印として、プレイヤースプライトの生成を確認
        var hasPlayerSprite = false;
        for (var i = 0; i < cs.length; i++) {
            var sp = cs[i];
            if (sp && sp._character === $gamePlayer) { hasPlayerSprite = true; break; }
        }
        if (!hasPlayerSprite) return false;

        g.active = false;
        return true;
    };

    TestReload._getActiveInterpreter = function () {
        // 直近の executeCommand 中ならそれを優先。そうでなければ map interpreter。
        return this._currentInterpreter || ($gameMap ? $gameMap._interpreter : null);
    };

    TestReload._isCommonEventInterpreter = function (itp) {
        // MV仕様：マップイベントは _eventId > 0、コモンイベント等は 0
        return !itp || !(itp._eventId > 0);
    };

    TestReload._shouldAdvanceIndexOnSave = function (itp) {
        // コマンド実行中に saveHere() された場合は、同コマンド再実行を避けるため +1
        return this._inExecuteCommand && this._currentInterpreter === itp;
    };

    TestReload._testDir = function () {
        // .../www/save/test_save/
        var base = StorageManager.localFileDirectoryPath();
        return base + 'test_save/';
    };

    TestReload._testFilePath = function (name) {
        return this._testDir() + sanitizeName(name) + '.rpgsave';
    };

    TestReload._saveContentsToTestFile = function (name, contents) {
        if (!isLocalMode()) throw new Error('Local mode (NW.js) only.');
        var fs = require('fs');
        var dir = this._testDir();
        ensureDir(dir);

        var json = JsonEx.stringify(contents);
        var data = LZString.compressToBase64(json);
        var filePath = this._testFilePath(name);
        fs.writeFileSync(filePath, data, { encoding: 'utf8' });
    };

    TestReload._loadContentsFromTestFile = function (name) {
        if (!isLocalMode()) throw new Error('Local mode (NW.js) only.');
        var fs = require('fs');
        var filePath = this._testFilePath(name);
        if (!fs.existsSync(filePath)) return null;

        var data = fs.readFileSync(filePath, { encoding: 'utf8' });
        var json = LZString.decompressFromBase64(data);
        if (!json) return null;
        return JsonEx.parse(json);
    };

    // ---- Interpreter meta (fingerprint) ----
    TestReload._collectMeta = function (itp, resumeIndex) {
        var mapId = $gameMap.mapId();
        var eventId = itp._eventId;
        var ev = $gameMap.event(eventId);
        var pageIndex = ev ? ev._pageIndex : -1;

        var list = itp._list || [];
        var prevCmd = list[resumeIndex - 1];
        var nextCmd = list[resumeIndex];

        return {
            v: 1,
            savedAt: Date.now(),
            mapId: mapId,
            eventId: eventId,
            pageIndex: pageIndex,
            indexExpected: resumeIndex,
            fpPrev: makeFingerprint(prevCmd),
            fpNext: makeFingerprint(nextCmd)
        };
    };

    TestReload._resolveResumeIndex = function (newList, expected, fpPrev, fpNext) {
        var len = newList ? newList.length : 0;
        if (!len) return 0;

        var exp = clamp(Number(expected || 0), 0, len); // len も許す（末尾）
        var radius = 80;

        var candidates = [];
        function addCandidate(resumeIndex) {
            var r = clamp(resumeIndex, 0, len);
            candidates.push({ idx: r, dist: Math.abs(r - exp) });
        }

        function tryAt(i) {
            if (i < 0 || i >= len) return;
            var cmd = newList[i];
            // 直後一致 → i が復帰位置
            if (matchFingerprint(cmd, fpNext)) addCandidate(i);
            // 直前一致 → i+1 が復帰位置
            if (matchFingerprint(cmd, fpPrev)) addCandidate(i + 1);
        }

        // まず expected 近傍を探索
        for (var d = 0; d <= radius; d++) {
            tryAt(Math.floor(exp) + d);
            if (d !== 0) tryAt(Math.floor(exp) - d);
            if (candidates.length && d >= 6) break;
        }

        // 見つからなければ全体
        if (!candidates.length) {
            for (var i = 0; i < len; i++) tryAt(i);
        }

        if (candidates.length) {
            candidates.sort(function (a, b) { return a.dist - b.dist; });
            return candidates[0].idx;
        }

        return exp;
    };

    TestReload._applyInterpreterPatch = function (meta) {
        if (!meta) return;

        if ($gameMap.mapId() !== meta.mapId) {
            console.warn('[TestReload] mapId mismatch:', $gameMap.mapId(), meta.mapId);
            return;
        }

        var evData = $dataMap && $dataMap.events ? $dataMap.events[meta.eventId] : null;
        var page = evData && evData.pages ? evData.pages[meta.pageIndex] : null;
        var newList = page && page.list ? page.list : null;

        if (!newList) {
            console.warn('[TestReload] event/page not found:', meta.eventId, meta.pageIndex);
            return;
        }

        var itp = $gameMap._interpreter;
        if (!itp) {
            console.warn('[TestReload] interpreter not found');
            return;
        }

        var copiedList = deepCopy(newList);
        itp._list = copiedList;

        var idx = this._resolveResumeIndex(copiedList, meta.indexExpected, meta.fpPrev, meta.fpNext);
        itp._index = idx;

        console.log('[TestReload] patched interpreter list. resume index =', idx);
    };

    // ---- Audio save / restore ----
    TestReload._collectAudio = function () {
        return {
            bgm: AudioManager.saveBgm ? AudioManager.saveBgm() : null,
            bgs: AudioManager.saveBgs ? AudioManager.saveBgs() : null
        };
    };

    TestReload._applyAudio = function (audio) {
        if (!audio) return;

        var bgm = audio.bgm;
        var bgs = audio.bgs;

        AudioManager.stopBgm();
        AudioManager.stopBgs();

        if (bgm && bgm.name) AudioManager.playBgm(bgm, bgm.pos || 0);
        if (bgs && bgs.name) AudioManager.playBgs(bgs, bgs.pos || 0);
    };

    // ---- $gameMessage FULL snapshot / restore ----
    TestReload._isUnsupportedMessageMode = function () {
        if (!$gameMessage) return false;

        // MV標準メソッドがあれば優先
        var isChoice = $gameMessage.isChoice ? $gameMessage.isChoice() : ($gameMessage._choices && $gameMessage._choices.length > 0);
        var isNum = $gameMessage.isNumberInput ? $gameMessage.isNumberInput() : !!($gameMessage._numInputVariableId);
        var isItem = $gameMessage.isItemChoice ? $gameMessage.isItemChoice() : !!($gameMessage._itemChoiceVariableId);

        return !!(isChoice || isNum || isItem);
    };

    TestReload._collectMessageRaw = function () {
        if (!$gameMessage) return null;

        // インスタンスの enumerable なプロパティを可能な限り全部保存
        var snap = {};
        for (var k in $gameMessage) {
            if (!$gameMessage.hasOwnProperty(k)) continue;
            var v = $gameMessage[k];
            if (typeof v === 'function') continue; // 関数は保存できない
            snap[k] = v;
        }
        // deepCopy で参照を切る（JsonEx -> JSONなので関数は落ちる）
        return deepCopy(snap);
    };

    TestReload._applyMessageRaw = function (snap) {
        if (!$gameMessage) return;

        // まず標準のクリア（存在するなら）
        if ($gameMessage.clear) $gameMessage.clear();

        // snap が無いなら、クリア済みのまま
        if (!snap) return;

        // 保存したプロパティを全て上書き・追加
        for (var k in snap) {
            if (!snap.hasOwnProperty(k)) continue;
            $gameMessage[k] = deepCopy(snap[k]);
        }
    };

    // ============================================================
    // Map reload (Scene_Load.reloadMapIfUpdated 相当) + merge new events
    // ============================================================
    // 注意：MV標準の reloadMapIfUpdated は「System.json の versionId 差」を見ます。
    // ここではその条件を再現し、true のときだけ MapXXX.json を再読み込み→新規イベントを生成します。
    TestReload._shouldReloadMapIfUpdated = function () {
        try {
            if (!$gameSystem || !$dataSystem || !$gameSystem.versionId) return false;
            var saveVer = Number($gameSystem.versionId());
            var curVer = Number($dataSystem.versionId || 0);
            return saveVer !== curVer;
        } catch (e) {
            return false;
        }
    };

    // マップ再セットアップ（= $gameMap.setup）をすると interpreter が消えるので、
    // $dataMap を最新化したあと「追加されたイベントだけ」Game_Event を生成して足します。
    // 既存イベントは（実行中イベント以外）refresh してページ判定を最新に寄せます。
    TestReload._mergeNewEventsFromDataMap = function (meta) {
        if (!$gameMap || !$dataMap || !$dataMap.events) return;

        var mapId = $gameMap.mapId();
        var events = $gameMap._events || ($gameMap._events = []);
        var skipId = meta && meta.eventId ? meta.eventId : 0;

        for (var id = 1; id < $dataMap.events.length; id++) {
            var evData = $dataMap.events[id];
            if (!evData) continue;

            if (!events[id]) {
                events[id] = new Game_Event(mapId, id);
            } else {
                if (id !== skipId && events[id].refresh) events[id].refresh();
            }
        }
    };


    // ============================================================
    // Public API
    // ============================================================
    TestReload.saveHere = function (nameOpt) {
        if (_debug.get('editEventMode')) return;

        if (!isLocalMode()) {
            alert('TestReload: NW.js（ローカルモード）専用です。');
            return false;
        }

        var itp = this._getActiveInterpreter();
        if (!itp || !itp.isRunning || !itp.isRunning()) {
            alert('TestReload: イベント実行中のみ保存できます。');
            return false;
        }

        if (this._isCommonEventInterpreter(itp)) {
            alert('TestReload: コモンイベント中の保存は非対応です。');
            return false;
        }

        if (this._isUnsupportedMessageMode()) {
            alert('TestReload: 選択肢/数値入力/アイテム選択の最中は非対応です。\n（文章のみの状態で保存してください）');
            return false;
        }

        var name = sanitizeName(
            (nameOpt != null && nameOpt !== '') ? nameOpt : (prompt('テストセーブ名を入力してね', this._lastName) || '')
        );
        if (!name || name === this._lastName) return false;
        this._lastName = name;

        var resumeIndex = itp._index + (this._shouldAdvanceIndexOnSave(itp) ? 1 : 0);

        var contents = DataManager.makeSaveContents();
        contents.__testReloadMeta = this._collectMeta(itp, resumeIndex);
        contents.__testReloadAudio = this._collectAudio();
        contents.__testReloadMessageRaw = this._collectMessageRaw();

        try {
            this._saveContentsToTestFile(name, contents);
            console.log('[TestReload] saved:', this._testFilePath(name));
            return true;
        } catch (e) {
            console.error(e);
            alert('TestReload: 保存に失敗しました。\n' + String(e));
            return false;
        }
    };

    TestReload.load = function (nameOpt) {
        if (!isLocalMode()) {
            alert('TestReload: NW.js（ローカルモード）専用です。');
            return false;
        }

        var name = sanitizeName(
            (nameOpt != null && nameOpt !== '') ? nameOpt : (prompt('ロードするテストセーブ名', this._lastName) || '')
        );
        if (!name) return false;
        this._lastName = name;

        try {
            var contents = this._loadContentsFromTestFile(name);
            if (!contents) {
                alert('TestReload: セーブが見つからないか、読み込みに失敗しました。');
                return false;
            }
            var meta = contents.__testReloadMeta;
            if (!meta) {
                alert('TestReload: これはテストセーブではありません（metaがありません）。');
                return false;
            }

            this._pendingContents = contents;
            this._pendingMeta = meta;
            this._pendingAudio = contents.__testReloadAudio || null;
            // ★ raw snapshot を保持
            this._pendingMessageRaw = (contents.__testReloadMessageRaw !== undefined) ? contents.__testReloadMessageRaw : null;

            // interpreter gate: ロード完了（Scene_Map初期化）まで interpreter を止める
            this._startInterpreterGate(meta);

            SceneManager.goto(Scene_TestReload);
            return true;
        } catch (e) {
            console.error(e);
            alert('TestReload: ロードに失敗しました。\n' + String(e));
            return false;
        }
    };

    // ============================================================
    // Scene_TestReload (中継シーン)
    // ============================================================
    function Scene_TestReload() {
        this.initialize.apply(this, arguments);
    }

    Scene_TestReload.prototype = Object.create(Scene_Base.prototype);
    Scene_TestReload.prototype.constructor = Scene_TestReload;

    Scene_TestReload.prototype.initialize = function () {
        Scene_Base.prototype.initialize.call(this);
        this._done = false;
        this._phase = 0; // 0: extract save, 1: waiting map json reload
        this._mapReloadRequested = false;
        this._mapIdToReload = 0;
    };

    Scene_TestReload.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
    };

    Scene_TestReload.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (this._done) return;

        // ------------------------------------------------------------
        // Phase 0: extract save contents (Scene_Map以外で実行)
        // ------------------------------------------------------------
        if (this._phase === 0) {
            var contents = TestReload._pendingContents;
            if (!contents) {
                this._done = true;
                SceneManager.goto(Scene_Map);
                return;
            }

            TestReload._pendingContents = null;

            Input.clear();
            TouchInput.clear();

            DataManager.createGameObjects();
            DataManager.extractSaveContents(contents);
            if ($gameSystem && $gameSystem.onAfterLoad) $gameSystem.onAfterLoad();

            // ★ $gameMessage を raw snapshot で復元（Scene_Mapへ行く前）
            if (TestReload._pendingMessageRaw !== null) {
                var msgRaw = TestReload._pendingMessageRaw;
                TestReload._pendingMessageRaw = null;
                TestReload._applyMessageRaw(msgRaw);
            } else {
                // 旧ファイル互換など：nullならクリアだけにする
                if ($gameMessage && $gameMessage.clear) $gameMessage.clear();
            }

            // ------------------------------------------------------------
            // Scene_Load.reloadMapIfUpdated() が true 相当なら MapXXX.json を再読み込み
            // ※ $gameMap.setup すると interpreter が消えるので、$dataMap を最新化した後に
            //   「追加イベントだけ」生成して足す（進行中イベントは壊さない）
            // ------------------------------------------------------------
            if (TestReload._shouldReloadMapIfUpdated()) {
                var mapId = $gameMap ? $gameMap.mapId() : 0;
                if (mapId > 0 && DataManager.loadMapData && DataManager.isMapLoaded) {
                    this._mapIdToReload = mapId;
                    this._mapReloadRequested = true;
                    this._phase = 1;

                    DataManager.loadMapData(mapId); // async
                    return;
                }
            }

            this._done = true;
            SceneManager.goto(Scene_Map);
            return;
        }

        // ------------------------------------------------------------
        // Phase 1: wait MapXXX.json load, then merge events
        // ------------------------------------------------------------
        if (this._phase === 1) {
            if (!DataManager.isMapLoaded || !DataManager.isMapLoaded()) return;

            if (this._mapReloadRequested) {
                this._mapReloadRequested = false;
                TestReload._mergeNewEventsFromDataMap(TestReload._pendingMeta);
            }

            this._done = true;
            SceneManager.goto(Scene_Map);
            return;
        }
    };

    window.Scene_TestReload = Scene_TestReload;

    // ============================================================
    // Hooks
    // ============================================================
    var _Game_Interpreter_executeCommand = Game_Interpreter.prototype.executeCommand;
    Game_Interpreter.prototype.executeCommand = function () {
        TestReload._currentInterpreter = this;
        TestReload._inExecuteCommand = true;
        try {
            return _Game_Interpreter_executeCommand.apply(this, arguments);
        } finally {
            TestReload._inExecuteCommand = false;
        }
    };


    // ---- Interpreter gate hook (ロード完了まで interpreter 更新を停止) ----
    var _Game_Map_updateInterpreter = Game_Map.prototype.updateInterpreter;
    Game_Map.prototype.updateInterpreter = function () {
        if (TestReload && TestReload._interpGate && TestReload._interpGate.active) {
            if (!TestReload._isInterpreterGateReady()) return;
        }
        return _Game_Map_updateInterpreter.apply(this, arguments);
    };


    var _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.apply(this, arguments);

        if (TestReload._pendingMeta) {
            var meta = TestReload._pendingMeta;
            TestReload._pendingMeta = null;
            TestReload._applyInterpreterPatch(meta);
        }

        if (TestReload._pendingAudio) {
            var a = TestReload._pendingAudio;
            TestReload._pendingAudio = null;
            TestReload._applyAudio(a);
        }

        // interpreter gate: onMapLoaded のパッチ適用が終わったので stage を進める
        TestReload._markInterpreterGatePatched();
    };

    // ============================================================
    // Plugin Commands
    // ============================================================
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.apply(this, arguments);
        command = String(command || '');

        if (command === 'TestSave') {
            var name = (args && args.length) ? args.join(' ') : '';
            TestReload.saveHere(name);
        } else if (command === 'TestLoad') {
            var name2 = (args && args.length) ? args.join(' ') : '';
            if (!name2) {
                alert('TestReload: TestLoad は名前指定が必要です。');
                return;
            }
            TestReload.load(name2);
        }
    };

    // ============================================================
    // Audio Null-Guards (crash fix)
    // ============================================================
    (function () {
        var _isCurrentBgm = AudioManager.isCurrentBgm;
        AudioManager.isCurrentBgm = function (bgm) {
            if (!bgm || !bgm.name) return false;
            return _isCurrentBgm.call(this, bgm);
        };

        var _isCurrentBgs = AudioManager.isCurrentBgs;
        if (_isCurrentBgs) {
            AudioManager.isCurrentBgs = function (bgs) {
                if (!bgs || !bgs.name) return false;
                return _isCurrentBgs.call(this, bgs);
            };
        }

        var _playBgm = AudioManager.playBgm;
        AudioManager.playBgm = function (bgm, pos) {
            if (!bgm || !bgm.name) {
                this.stopBgm();
                this._currentBgm = null;
                this._bgmPosition = 0;
                return;
            }
            return _playBgm.call(this, bgm, pos);
        };

        var _playBgs = AudioManager.playBgs;
        AudioManager.playBgs = function (bgs, pos) {
            if (!bgs || !bgs.name) {
                this.stopBgs();
                this._currentBgs = null;
                this._bgsPosition = 0;
                return;
            }
            return _playBgs.call(this, bgs, pos);
        };
    })();

})();