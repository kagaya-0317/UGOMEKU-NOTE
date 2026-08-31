//=============================================================================
// KNH_ZXC_EventEditor.js
//=============================================================================

/*:
 * @plugindesc [MV][Playtest] Event timeline editor (editEventMode) v0.3.0
 * @author kagaya
 *
 * @help
 * _debug.get('editEventMode') === true のとき、Scene_Mapでイベント編集UIを起動します。
 * タイムライン拡張は本プラグイン内で自動読み込みされます。
 * Ctrl+S: Map保存 + backup + diff
 * Ctrl+Shift+S: backupのみ
 * 保存後にRPGツクールMVエディタ再起動:
 *   _debug.get('eventEditorRestartMvEditorOnSave') === true
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var PLUGIN_NAME = 'KNH_ZXC_EventEditor';
    var PLUGIN_VERSION = '0.3.0';
    var RE_COMPACT_SELECT_KEY = /type|mode|op|operand|scope|target|operation|blend|dir|designate/i;
    var RE_COMPACT_NUMBER_KEY = /id$|index|mode|type|value|x$|y$|z$|r$|g$|b$|a$|wait|time|frame|duration|speed|pan|pitch|volume|opacity/i;
    var RE_COMPACT_TEXT_KEY = /id$|tag|code|label|name/i;
    var EE_DYNAMIC_SCRIPT_COND_TARGET_RESCAN_FRAMES = 45;
    var EE_LOCALIZE_CACHE_MAX = 1024;
    var EE_LOCALIZE_REPS = [
        [/No event selected/g, 'イベント未選択'],
        [/Selected Event/g, '選択イベント'],
        [/Execution Log/g, '実行ログ'],
        [/EventEditor ON \(timeline edit mode\)/g, 'イベントエディタ起動（タイムライン編集モード）'],
        [/Drop rejected \(range move collision\)/g, 'ドロップ失敗（範囲移動が衝突）'],
        [/move-route wait lock on main/g, 'main行で移動ルート待機ロック中です'],
        [/move-route range overlaps after adding command/g, 'コマンド追加後に移動ルート範囲が重なりました'],
        [/move-route range overlaps after tile move/g, 'タイル移動後に移動ルート範囲が重なりました'],
        [/main command exists in route wait range/g, '移動ルート待機範囲内にmainコマンドがあります'],
        [/command overlaps with wait-range/g, 'コマンドがウェイト範囲と重複しています'],
        [/common event recursion depth exceeded \(>8\):\s*/g, 'コモンイベント再帰が深すぎます（>8）: '],
        [/common event not found:\s*/g, 'コモンイベントが見つかりません: '],
        [/move route command not found/g, '移動ルートコマンドが見つかりません'],
        [/route command code must be positive/g, '移動ルートコマンドコードは正の値が必要です'],
        [/invalid reference json/g, '参照JSONが不正です'],
        [/map not found:\s*/g, 'マップが見つかりません: ']
    ];

    function clone(v) { return JSON.parse(JSON.stringify(v)); }
    function hashText32(text) {
        text = String(text == null ? '' : text);
        var hash = 2166136261 >>> 0;
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return ('00000000' + hash.toString(16)).slice(-8);
    }
    function snapshotTextFingerprint(text) {
        text = String(text == null ? '' : text);
        var hash = 5381 >>> 0;
        for (var i = 0; i < text.length; i++) hash = (Math.imul(hash, 33) ^ text.charCodeAt(i)) >>> 0;
        return String(text.length) + ':' + hashText32(text) + ':' + ('00000000' + hash.toString(16)).slice(-8);
    }
    function p3(n) { return ('000' + Number(n || 0)).slice(-3); }
    function ts() {
        var d = new Date();
        function p2(v) { return ('0' + v).slice(-2); }
        return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' +
            p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + '_' + ('00' + d.getMilliseconds()).slice(-3);
    }
    function ensureDir(path) {
        var fs = require('fs');
        try {
            if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        } catch (e) { try { fs.mkdirSync(path); } catch (_) {} }
    }
    function atomicWriteUtf8(fs, filePath, text) {
        var tempPath = filePath + '.event-editor-' + String(process.pid || 0) + '-' +
            String(Date.now()) + '-' + String(Math.floor(Math.random() * 1000000)) + '.tmp';
        var committed = false;
        try {
            fs.writeFileSync(tempPath, text, { encoding: 'utf8', flag: 'wx' });
            fs.renameSync(tempPath, filePath);
            committed = true;
        } finally {
            if (!committed) {
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
            }
        }
    }
    function uniqueBackupPath(fs, path, dirPath, fileName) {
        var dot = fileName.lastIndexOf('.json');
        var stem = dot >= 0 ? fileName.slice(0, dot) : fileName;
        var ext = dot >= 0 ? fileName.slice(dot) : '';
        var candidate = fileName;
        var suffix = 1;
        while (fs.existsSync(path.join(dirPath, candidate))) {
            candidate = stem + '-' + String(suffix++) + ext;
        }
        return path.join(dirPath, candidate);
    }
    function isEditEnabled() {
        try { return !!(window._debug && _debug.get && _debug.get('editEventMode') === true); }
        catch (e) { return false; }
    }
    function isPlaytest() {
        try { return !!($gameTemp && $gameTemp.isPlaytest && $gameTemp.isPlaytest()); }
        catch (e) { return false; }
    }
    function getStartModeTestSaveName() {
        try {
            if (!window._debug || typeof window._debug.get !== 'function') return '';
            var name = window._debug.get('startModeTestSave');
            if (name == null) return '';
            return String(name).trim();
        } catch (e) {
            return '';
        }
    }
    function isMvEditorRestartOnSaveEnabled() {
        try {
            if (!window._debug || typeof window._debug.get !== 'function') return false;
            return window._debug.get('eventEditorRestartMvEditorOnSave', false) === true;
        } catch (e) {
            return false;
        }
    }
    function findEscapeWindow() {
        try {
            var scene = SceneManager && SceneManager._scene;
            var wl = scene && scene._windowLayer;
            var cs = wl && wl.children;
            if (!cs || !cs.length) return null;
            for (var i = 0; i < cs.length; i++) {
                var w = cs[i];
                if (w && typeof w.convertEscapeCharacters === 'function') return w;
            }
        } catch (e) {}
        return null;
    }
    function safeConvertEscapeCharacters(text) {
        text = String(text == null ? '' : text);
        var w = findEscapeWindow();
        if (w) {
            try { return w.convertEscapeCharacters(text); } catch (_) {}
        }
        try {
            if (Window_Base && Window_Base.prototype && Window_Base.prototype.convertEscapeCharacters) {
                return Window_Base.prototype.convertEscapeCharacters.call({}, text);
            }
        } catch (_) {}
        return text;
    }
    function installEscapeConvertFallback() {
        try {
            if (typeof window.convertEscapeCharacters !== 'function') {
                window.convertEscapeCharacters = function(text) {
                    return safeConvertEscapeCharacters(text);
                };
            }
            // Some plugins call convertEscapeCharacters on sprites in _windowLayer.children.
            if (typeof Sprite !== 'undefined' && Sprite.prototype && typeof Sprite.prototype.convertEscapeCharacters !== 'function') {
                Sprite.prototype.convertEscapeCharacters = function(text) {
                    return safeConvertEscapeCharacters(text);
                };
            }
        } catch (e) {}
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
            if (Input._eeTextEditGuardInstalled) return;
            Input._eeTextEditGuardInstalled = true;
            var _baseShouldPreventDefault = Input._shouldPreventDefault;
            Input._shouldPreventDefault = function(keyCode) {
                var ae = null;
                try { ae = (typeof document !== 'undefined' && document) ? document.activeElement : null; } catch (_) { ae = null; }
                if (isTypingTargetElement(ae)) return false;
                return _baseShouldPreventDefault.call(this, keyCode);
            };
        } catch (_) {}
    }

    installInputPreventDefaultGuardForTextEditing();

    function eeNormalizeScriptConditionText(text) {
        return String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    }

    function eeDecodeScriptConditionComment(line) {
        var text = String(line == null ? '' : line);
        var m = text.match(/^<EE_SCRIPT_COND:([\s\S]*)>$/);
        if (!m) return null;
        var raw = String(m[1] || '');
        var rawNorm = eeNormalizeScriptConditionText(raw);
        if (raw.indexOf('%') < 0) return rawNorm;
        try {
            var decoded = decodeURIComponent(raw);
            // Backward compatibility: decode only legacy percent-encoded payloads.
            if (encodeURIComponent(decoded) === raw) {
                return eeNormalizeScriptConditionText(decoded);
            }
            return rawNorm;
        } catch (e) {
            return rawNorm;
        }
    }

    function eeScriptConditionFromEventList(list) {
        if (!Array.isArray(list)) return null;
        for (var i = 0; i < list.length; i++) {
            var cmd = list[i];
            if (!cmd || Number(cmd.code || 0) !== 108) continue;
            var line = String((cmd.parameters || [''])[0] || '');
            var script = eeDecodeScriptConditionComment(line);
            if (script != null) return script;
        }
        return null;
    }

    function eePageScriptConditionMeta(page) {
        if (!page || typeof page !== 'object') return { enabled: false, text: '' };
        var c = (page.conditions && typeof page.conditions === 'object') ? page.conditions : {};
        var scriptText = eeNormalizeScriptConditionText(c.scriptText || '');
        var hasText = scriptText.trim().length > 0;
        if (c.scriptValid && hasText) return { enabled: true, text: scriptText };
        var legacyText = eeScriptConditionFromEventList(page.list);
        if (legacyText != null && legacyText.trim().length > 0) return { enabled: true, text: legacyText };
        return { enabled: false, text: '' };
    }

    function eePageIndexByObject(ev, page) {
        try {
            var data = ev && typeof ev.event === 'function' ? ev.event() : null;
            var pages = data && Array.isArray(data.pages) ? data.pages : null;
            if (!pages || !pages.length) return -1;
            for (var i = 0; i < pages.length; i++) {
                if (pages[i] === page) return i;
            }
        } catch (e) {}
        return -1;
    }

    var _eeScriptCondErrorLogged = {};
    function eeLogScriptConditionErrorOnce(ev, page, scriptText, err) {
        try {
            var mapId = $gameMap && typeof $gameMap.mapId === 'function' ? Number($gameMap.mapId() || 0) : 0;
            var eventId = ev && typeof ev.eventId === 'function' ? Number(ev.eventId() || 0) : 0;
            var pageIndex = eePageIndexByObject(ev, page);
            var key = String(mapId) + ':' + String(eventId) + ':' + String(pageIndex) + ':' + String(scriptText || '');
            if (_eeScriptCondErrorLogged[key]) return;
            _eeScriptCondErrorLogged[key] = true;
            console.warn('[イベント出現条件:スクリプト] 評価エラー map=' + mapId + ' event=' + eventId + ' page=' + (pageIndex + 1) + ' script=' + String(scriptText || ''), err);
        } catch (_) {}
    }

    function eeEvaluatePageScriptCondition(ev, page, scriptText) {
        scriptText = eeNormalizeScriptConditionText(scriptText);
        if (!scriptText.trim().length) return true;
        var event = ev;
        var self = ev;
        var s = $gameSwitches;
        var v = $gameVariables;
        // Backward/compat aliases: allow both $gameXxx and gameXxx.
        var gamePlayer = $gamePlayer;
        var gameMap = $gameMap;
        var gameParty = $gameParty;
        var gameActors = $gameActors;
        var gameSystem = $gameSystem;
        var gameScreen = $gameScreen;
        var gameTimer = $gameTimer;
        var gameMessage = $gameMessage;
        var gameTemp = $gameTemp;
        var gameTroop = $gameTroop;
        var gameSwitches = $gameSwitches;
        var gameVariables = $gameVariables;
        var gameSelfSwitches = $gameSelfSwitches;
        try {
            return !!(function() { return eval(scriptText); }).call(ev);
        } catch (err) {
            eeLogScriptConditionErrorOnce(ev, page, scriptText, err);
            return false;
        }
    }

    var _GameEvent_meetsConditions_EE_ScriptCond = Game_Event.prototype.meetsConditions;
    Game_Event.prototype.meetsConditions = function(page) {
        if (!_GameEvent_meetsConditions_EE_ScriptCond.apply(this, arguments)) return false;
        var meta = eePageScriptConditionMeta(page);
        if (!meta.enabled) return true;
        return eeEvaluatePageScriptCondition(this, page, meta.text);
    };

    function eeEventHasDynamicScriptConditionPages(ev) {
        if (!ev || typeof ev.event !== 'function') return false;
        var data = null;
        try { data = ev.event(); } catch (_) { data = null; }
        if (!data || !Array.isArray(data.pages)) return false;
        if (ev._eeScriptCondPagesScanData === data && typeof ev._eeHasDynamicScriptCondPages === 'boolean') {
            return ev._eeHasDynamicScriptCondPages;
        }
        var found = false;
        for (var i = 0; i < data.pages.length; i++) {
            if (eePageScriptConditionMeta(data.pages[i]).enabled) {
                found = true;
                break;
            }
        }
        ev._eeScriptCondPagesScanData = data;
        ev._eeHasDynamicScriptCondPages = found;
        return found;
    }

    function eeRefreshEventPageIfDynamicScriptConditionChanged(ev) {
        if (!ev || typeof ev.findProperPageIndex !== 'function') return;
        if (!eeEventHasDynamicScriptConditionPages(ev)) return;
        var currentPageIndex = Number(ev._pageIndex);
        if (!isFinite(currentPageIndex)) currentPageIndex = -1;
        var newPageIndex = ev._erased ? -1 : ev.findProperPageIndex();
        if (currentPageIndex === newPageIndex) return;
        if (typeof ev.refresh === 'function') ev.refresh();
    }

    function eeCurrentFrameCount() {
        try {
            if (typeof Graphics !== 'undefined' && Graphics && Graphics.frameCount != null) {
                return Math.max(0, Math.floor(Number(Graphics.frameCount || 0)));
            }
        } catch (_) {}
        return -1;
    }

    function eeInvalidateDynamicScriptConditionCache(gameMap) {
        try {
            if (!gameMap) return;
            gameMap._eeDynamicScriptCondCache = null;
        } catch (_) {}
    }

    function eeCollectDynamicScriptConditionEvents(gameMap) {
        if (!gameMap) return [];
        var events = Array.isArray(gameMap._events) ? gameMap._events : null;
        if (!events || !events.length) return [];
        var mapId = 0;
        try {
            mapId = (typeof gameMap.mapId === 'function')
                ? Math.floor(Number(gameMap.mapId() || 0))
                : Math.floor(Number(gameMap._mapId || 0));
        } catch (_) { mapId = 0; }
        var frame = eeCurrentFrameCount();
        var cache = gameMap._eeDynamicScriptCondCache;
        var canReuse = false;
        if (cache && cache.eventsRef === events &&
            Number(cache.eventsLength || 0) === events.length &&
            Number(cache.mapId || 0) === mapId) {
            canReuse = true;
            var lastFrame = Math.floor(Number(cache.builtFrame == null ? -1 : cache.builtFrame));
            if (frame >= 0 && lastFrame >= 0) {
                if (frame - lastFrame >= EE_DYNAMIC_SCRIPT_COND_TARGET_RESCAN_FRAMES) canReuse = false;
            }
        }
        if (canReuse) return Array.isArray(cache.targets) ? cache.targets : [];

        var targets = [];
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (!ev) continue;
            if (eeEventHasDynamicScriptConditionPages(ev)) targets.push(ev);
        }
        gameMap._eeDynamicScriptCondCache = {
            eventsRef: events,
            eventsLength: events.length,
            mapId: mapId,
            builtFrame: frame,
            targets: targets
        };
        return targets;
    }

    var _GameMap_setup_EE_DynamicScriptCondCache = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _GameMap_setup_EE_DynamicScriptCondCache.apply(this, arguments);
        eeInvalidateDynamicScriptConditionCache(this);
    };

    var _GameMap_refresh_EE_DynamicScriptCondCache = Game_Map.prototype.refresh;
    Game_Map.prototype.refresh = function() {
        _GameMap_refresh_EE_DynamicScriptCondCache.apply(this, arguments);
        eeInvalidateDynamicScriptConditionCache(this);
    };

    var _GameMap_updateEvents_EE_DynamicScriptCond = Game_Map.prototype.updateEvents;
    Game_Map.prototype.updateEvents = function() {
        _GameMap_updateEvents_EE_DynamicScriptCond.apply(this, arguments);
        var targets = eeCollectDynamicScriptConditionEvents(this);
        if (!targets || !targets.length) return;
        for (var i = 0; i < targets.length; i++) {
            var ev = targets[i];
            if (!ev) continue;
            eeRefreshEventPageIfDynamicScriptConditionChanged(ev);
        }
    };

    function hasTimelineExtensionScriptTag() {
        try {
            var ls = document && document.getElementsByTagName ? document.getElementsByTagName('script') : null;
            if (!ls || !ls.length) return false;
            for (var i = 0; i < ls.length; i++) {
                var sc = ls[i];
                var src = String((sc && sc.getAttribute && sc.getAttribute('src')) || (sc && sc.src) || '');
                if (!src) continue;
                if (/KNH_ZXC_EventEditor_Timeline\.js(?:[?#].*)?$/i.test(src)) return true;
            }
        } catch (_) {}
        return false;
    }

    function resolveTimelineExtensionScriptPath() {
        var preferred = 'eventEditor/KNH_ZXC_EventEditor_Timeline.js';
        var fallback = 'KNH_ZXC_EventEditor_Timeline.js';
        try {
            var fs = require('fs');
            var path = require('path');
            var base = path.join(path.dirname(process.mainModule.filename), 'js', 'plugins');
            var p1 = path.join(base, preferred);
            if (fs.existsSync(p1)) return preferred;
            var p2 = path.join(base, fallback);
            if (fs.existsSync(p2)) return fallback;
        } catch (_) {}
        return preferred;
    }

    function requestTimelineExtensionAutoload() {
        if (!isPlaytest()) return;
        if (NS._eeTimelineAutoloadRequested) return;
        NS._eeTimelineAutoloadRequested = true;
        if (NS._timelineSplitLoaderApplied) return;
        if (hasTimelineExtensionScriptTag()) return;
        var file = resolveTimelineExtensionScriptPath();
        if (!file) return;

        try {
            if (PluginManager && typeof PluginManager.loadScript === 'function') {
                PluginManager.loadScript(file);
                return;
            }
        } catch (_) {}

        try {
            var url = 'js/plugins/' + String(file || '');
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.async = false;
            script._url = url;
            if (PluginManager && typeof PluginManager.onError === 'function') {
                script.onerror = PluginManager.onError.bind(PluginManager);
            }
            document.body.appendChild(script);
        } catch (_) {}
    }

    function hasTimelineExtensionReady() {
        return !!(NS.EE && NS.EE.prototype && typeof NS.EE.prototype.start === 'function');
    }

    function tryLoadTimelineExtensionSync() {
        if (hasTimelineExtensionReady()) return true;
        var file = resolveTimelineExtensionScriptPath();
        if (!file) return false;
        try {
            var fs = require('fs');
            var path = require('path');
            var full = path.join(path.dirname(process.mainModule.filename), 'js', 'plugins', String(file));
            if (!fs.existsSync(full)) return false;
            var code = fs.readFileSync(full, 'utf8');
            (0, eval)(code + '\n//# sourceURL=' + String(file));
        } catch (e) {
            try { console.warn('[EventEditor] timeline sync load failed:', e); } catch (_) {}
        }
        return hasTimelineExtensionReady();
    }

    function ensureTimelineExtensionReady(options) {
        options = options || {};
        var allowSyncFallback = (options.allowSyncFallback !== false);
        var syncFallbackDelayFrames = Math.max(0, Math.floor(Number(options.syncFallbackDelayFrames || 0)));
        if (hasTimelineExtensionReady()) {
            NS._timelineReadyRetryFrames = 0;
            return true;
        }
        requestTimelineExtensionAutoload();
        if (hasTimelineExtensionReady()) {
            NS._timelineReadyRetryFrames = 0;
            return true;
        }
        if (!allowSyncFallback) return false;
        if (syncFallbackDelayFrames > 0) {
            var waited = Math.max(0, Math.floor(Number(NS._timelineReadyRetryFrames || 0)));
            if (waited < syncFallbackDelayFrames) return false;
        }
        var ok = tryLoadTimelineExtensionSync();
        if (ok) NS._timelineReadyRetryFrames = 0;
        return ok;
    }

    NS.tryStartEditorOnScene = function(scene, mode) {
        if (NS._fatal || !isPlaytest()) return false;
        if (!scene) return false;
        mode = (mode === 'battle') ? 'battle' : 'map';
        if (scene._knhEE && scene._knhEE.on) return true;
        var frame = eeCurrentFrameCount();
        if (frame >= 0) {
            var nextTryFrame = Math.max(0, Math.floor(Number(scene._eeNextStartTryFrame || 0)));
            if (nextTryFrame > frame) return false;
        }

        var bootStart = (NS._boot && mode === 'map');
        var ready = ensureTimelineExtensionReady({
            allowSyncFallback: true,
            syncFallbackDelayFrames: bootStart ? Math.max(0, Math.floor(Number(NS._timelineSyncFallbackDelayFrames || 0))) : 0
        });
        if (!ready) {
            if (bootStart) {
                NS._timelineReadyRetryFrames = Math.max(0, Math.floor(Number(NS._timelineReadyRetryFrames || 0))) + 1;
                // While waiting for timeline extension load, keep the latest interpreter owner
                // so delayed editor startup can still select the intended running event.
                var waitOwner = NS.runtimeInterpreterOwnerInfoMap();
                var waitEventId = Math.max(0, Math.floor(Number(waitOwner && waitOwner.eventId || 0)));
                if (waitEventId > 0) {
                    NS._bootDeferredOwnerEventId = waitEventId;
                    NS._bootDeferredOwnerPageIndex = Math.max(-1, Math.floor(Number(waitOwner && waitOwner.pageIndex == null ? -1 : waitOwner.pageIndex)));
                }
            }
            if (frame >= 0) scene._eeNextStartTryFrame = frame + (bootStart ? 2 : 1);
            return false;
        }
        scene._eeNextStartTryFrame = 0;
        NS._timelineReadyRetryFrames = 0;

        if (mode === 'map' && NS._boot && !NS._initialTestLoadDone) {
            if (!NS.startInitialTestLoadOrFatal()) return false;
            if (!NS._initialTestLoadDone) return false;
        }

        var EEClass = NS.EE || EE;
        if (!scene._knhEE) scene._knhEE = new EEClass(scene);
        if (scene._knhEE) scene._knhEE._eeForcedMode = mode;
        if (scene._knhEE && typeof scene._knhEE.start === 'function') scene._knhEE.start();
        return !!(scene._knhEE && scene._knhEE.on);
    };

    function maximizeWindowForEditor(force) {
        try {
            var win = null;
            if (window.nw && window.nw.Window && window.nw.Window.get) {
                win = window.nw.Window.get();
            } else {
                var gui = require('nw.gui');
                if (gui && gui.Window && gui.Window.get) win = gui.Window.get();
            }
            if (!win) return false;

            if (!win._eeMinimizeHookInstalled && typeof win.on === 'function') {
                win._eeMinimizeHookInstalled = true;
                win._eeMinimized = false;
                try {
                    win.on('minimize', function() {
                        try { win._eeMinimized = true; } catch (_) {}
                    });
                    win.on('restore', function() {
                        try { win._eeMinimized = false; } catch (_) {}
                        try {
                            if (window.KNH_ZXC_EventEditor &&
                                typeof window.KNH_ZXC_EventEditor.enabled === 'function' &&
                                window.KNH_ZXC_EventEditor.enabled()) {
                                setTimeout(function() { maximizeWindowForEditor(true); }, 0);
                                setTimeout(function() { maximizeWindowForEditor(true); }, 120);
                            }
                        } catch (_) {}
                    });
                } catch (_) {}
            }

            // Allow minimizing while editor is active:
            // skip auto-maximize only while the window is minimized.
            var hardMinimized = !!win._eeMinimized;
            if (!hardMinimized && typeof win.isMinimized === 'function') {
                try { hardMinimized = !!win.isMinimized(); } catch (_) { hardMinimized = false; }
            }
            if (!hardMinimized && win.cWindow && typeof win.cWindow.isMinimized === 'function') {
                try { hardMinimized = !!win.cWindow.isMinimized(); } catch (_) { hardMinimized = false; }
            }
            if (!hardMinimized) {
                var ws = '';
                try { ws = String(win.windowState || win.state || (win.cWindow && (win.cWindow.windowState || win.cWindow.state)) || '').toLowerCase(); } catch (_) { ws = ''; }
                if (ws.indexOf('min') >= 0) hardMinimized = true;
            }
            if (!hardMinimized) {
                try {
                    if (isFinite(Number(win.x)) && isFinite(Number(win.y)) && (Number(win.x) <= -30000 || Number(win.y) <= -30000)) hardMinimized = true;
                } catch (_) {}
            }
            if (hardMinimized && force) {
                try {
                    if (typeof win.restore === 'function') win.restore();
                } catch (_) {}
                try {
                    if (typeof win.focus === 'function') win.focus();
                } catch (_) {}
                hardMinimized = false;
                if (typeof win.isMinimized === 'function') {
                    try { hardMinimized = !!win.isMinimized(); } catch (_) { hardMinimized = false; }
                }
                if (!hardMinimized && win.cWindow && typeof win.cWindow.isMinimized === 'function') {
                    try { hardMinimized = !!win.cWindow.isMinimized(); } catch (_) { hardMinimized = false; }
                }
            }
            var backgroundSuspended = false;
            if (!force && !hardMinimized) {
                try {
                    if (typeof document !== 'undefined' && document) {
                        if (document.hidden || String(document.visibilityState || '') === 'hidden') backgroundSuspended = true;
                        else if (typeof document.hasFocus === 'function' && !document.hasFocus()) backgroundSuspended = true;
                    }
                } catch (_) {}
            }
            try { win._eeMinimized = hardMinimized; } catch (_) {}
            if (hardMinimized || backgroundSuspended) return false;

            // Keep edit-event windowed mode and avoid maximize on fullscreen.
            if (typeof win.isFullscreen === 'function' && win.isFullscreen()) {
                if (typeof win.leaveFullscreen === 'function') win.leaveFullscreen();
            }
            if (typeof win.maximize === 'function') win.maximize();
            return true;
        } catch (e) {
            return false;
        }
    }
    function activateGameWindowOnceAfterEditorRestart() {
        try {
            if (NS._eeGameFrontTimer) clearTimeout(NS._eeGameFrontTimer);
        } catch (_) {}
        NS._eeGameFrontTimer = setTimeout(function() {
            try { NS._eeGameFrontTimer = 0; } catch (_) {}
            try {
                var win = null;
                if (window.nw && window.nw.Window && window.nw.Window.get) {
                    win = window.nw.Window.get();
                } else {
                    var gui = require('nw.gui');
                    if (gui && gui.Window && gui.Window.get) win = gui.Window.get();
                }
                if (!win) return;
                var minimized = false;
                try {
                    if (typeof win.isMinimized === 'function') minimized = !!win.isMinimized();
                } catch (_) { minimized = false; }
                if (!minimized) {
                    try {
                        if (win.cWindow && typeof win.cWindow.isMinimized === 'function') minimized = !!win.cWindow.isMinimized();
                    } catch (_) { minimized = false; }
                }
                if (minimized) {
                    try { if (typeof win.restore === 'function') win.restore(); } catch (_) {}
                    try { if (typeof win.show === 'function') win.show(); } catch (_) {}
                }
                try { if (typeof win.focus === 'function') win.focus(); } catch (_) {}
            } catch (_) {}
        }, 600);
    }

    function EE(scene) {
        this.s = scene;
        this.on = false;
        this.root = null;
        this.status = null;
        this.eventInfo = null;
        this.timeline = null;
        this.timelinePanel = null;
        this.tInfo = null;
        this.tw = 1;
        this.th = 1;
        this.model = { nextUid: 1, tracks: {} };
        this.schedule = {};
        this._scheduleEntriesByTrack = null;
        this._trackRevisionByKey = {};
        this._historyTrackSnapshotCache = {};
        this.dirty = {};
        this.documentDirty = { events: {}, troops: {} };
        this._documentUndoEventIds = {};
        this._documentUndoTroopIds = {};
        this.undoS = [];
        this.redoS = [];
        this.clip = null;
        this.selEid = 0;
        this.selPage = -1;
        this.selKey = '';
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = null;
        this.hoverUid = 0;
        this.hoverRouteListIndex = -1;
        this.hoverFrame = -1;
        this.hoverRangeUid = 0;
        this.hoverRangePart = '';
        this.hideTimelineCircles = false;
        this.hideRouteHandles = false;
        this.frame = 0;
        this.play = false;
        this._postLastPlaybackState = null;
        this.maxF = 600;
        this.dragMode = '';
        this.dragging = false;
        this.dragEid = 0;
        this.dragPos = null;
        this.base = null;
        this.savedScale = null;
        this.lastHoverAt = 0;
        this.timelineDirty = true;
        this.timelineCursorDirty = true;
        this.warned = {};
        this.kd = null;
        this.ku = null;
        this.rs = null;
        this._wb = null;
        this.winGuard = null;
        this.spaceDown = false;
        this.panState = null;
        this.lastPointerClientX = 0;
        this.lastPointerClientY = 0;
        this._spaceCursor = '';
        this._simFrame = null;
        this._simForceFull = true;
        this._simToRunning = false;
        this._simExecFrame = -1;
        this._simSeActive = [];
        this._simMeActive = [];
        this._simBgmState = null;
        this._simBgsState = null;
        this._simSavedBgm = null;
        this._simMePlaybackBuffers = [];
        this._schemaOptionCache = {};
        this._schemaNormalizedOptionCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
        this.charList = null;
        this.charHint = null;
        this.charInfo = null;
        this.charOverlayLayer = null;
        this.charCtx = null;
        this.charCtxAddBtn = null;
        this.charCtxTargetId = null;
        this.routeModal = null;
        this.routeAddFrame = 0;
        this.routeAddCharId = 0;
        this.routeColL = null;
        this.routeColM = null;
        this.routeColR = null;
        this.gameClipMask = null;
        this.gameBottomMask = null;
        this._charPanelSig = '';
        this._charInfoSig = '';
        this._charOverlaySig = '';
        this._charPanelNextRefresh = 0;
        this._scheduleRev = 0;
        this._frameExecState = null;
    }

    NS.EE = EE;

    EE.prototype.writeTextFileAtomic = function(filePath, text) {
        var storage = NS._eeServices && NS._eeServices.storage;
        if (storage) storage.writeTextAtomic(filePath, text);
        else atomicWriteUtf8(require('fs'), filePath, String(text == null ? '' : text));
        return true;
    };
    EE.prototype.writeJsonFileAtomic = function(filePath, value, spacing) {
        var storage = NS._eeServices && NS._eeServices.storage;
        if (storage) storage.writeJsonAtomic(filePath, value, spacing);
        else this.writeTextFileAtomic(filePath, JSON.stringify(value, null, spacing == null ? 2 : spacing));
        return true;
    };
    EE.prototype.pruneBackupFiles = function(dirPath, prefix, keepCount) {
        var storage = NS._eeServices && NS._eeServices.storage;
        return storage && typeof storage.pruneBackups === 'function'
            ? storage.pruneBackups(dirPath, prefix, keepCount)
            : [];
    };
    EE.prototype.writeBackupFile = function(options) {
        options = options || {};
        var storage = NS._eeServices && NS._eeServices.storage;
        var backupPath;
        if (storage) backupPath = storage.writeBackup(options.dirPath, options.fileName, options.text);
        else {
            var fs = require('fs');
            var path = require('path');
            ensureDir(options.dirPath);
            backupPath = uniqueBackupPath(fs, path, options.dirPath, options.fileName);
            fs.writeFileSync(backupPath, String(options.text == null ? '' : options.text), { encoding: 'utf8', flag: 'wx' });
        }
        if (options.prefix && options.keepCount != null) {
            this.pruneBackupFiles(options.dirPath, options.prefix, options.keepCount);
        }
        return backupPath;
    };
    EE.prototype.backupAndWriteJsonFileAtomic = function(options) {
        var storage = NS._eeServices && NS._eeServices.storage;
        if (storage) return storage.backupAndWriteJson(options);
        options = options || {};
        var fs = require('fs');
        var path = require('path');
        var originalText = fs.existsSync(options.filePath) ? fs.readFileSync(options.filePath, 'utf8') : '';
        var backupPath = '';
        if (originalText.length && options.backupDir && options.backupName) {
            ensureDir(options.backupDir);
            backupPath = uniqueBackupPath(fs, path, options.backupDir, options.backupName);
            fs.writeFileSync(backupPath, originalText, { encoding: 'utf8', flag: 'wx' });
        }
        this.writeJsonFileAtomic(options.filePath, options.value, options.spacing);
        if (backupPath && options.backupPrefix && options.keepBackups != null) {
            this.pruneBackupFiles(options.backupDir, options.backupPrefix, options.keepBackups);
        }
        return { filePath: options.filePath, backupPath: backupPath };
    };
    NS._eeUtils = NS._eeUtils || {};
    NS.VERSION = PLUGIN_VERSION;
    NS._eeUtils.clone = clone;
    NS._eeUtils.maximizeWindowForEditor = maximizeWindowForEditor;
    NS._eeUtils.installEscapeConvertFallback = installEscapeConvertFallback;
    NS._eeUtils.RE_COMPACT_SELECT_KEY = RE_COMPACT_SELECT_KEY;
    NS._eeUtils.RE_COMPACT_NUMBER_KEY = RE_COMPACT_NUMBER_KEY;
    NS._eeUtils.RE_COMPACT_TEXT_KEY = RE_COMPACT_TEXT_KEY;

    NS.isBattleScene = function(scene) {
        if (!scene) return false;
        if (typeof Scene_NewBattle !== 'undefined' && scene instanceof Scene_NewBattle) return true;
        return false;
    };
    NS.isMapScene = function(scene) {
        if (!scene) return false;
        return !!(scene instanceof Scene_Map);
    };

    EE.prototype.detectContextMode = function() {
        var forced = String(this._eeForcedMode || '');
        if (forced === 'battle' || forced === 'map') return forced;
        var sc = this.s || (SceneManager && SceneManager._scene);
        return NS.isBattleScene(sc) ? 'battle' : 'map';
    };

    EE.prototype.isBattleEventMode = function() {
        return this.detectContextMode() === 'battle';
    };

    EE.prototype.currentBattleTroopId = function() {
        var tid = Math.floor(Number($gameTroop && $gameTroop._troopId || 0));
        if (tid <= 0) {
            try {
                var liveTroop = ($gameTroop && typeof $gameTroop.troop === 'function') ? $gameTroop.troop() : null;
                if (liveTroop && $dataTroops && Array.isArray($dataTroops)) {
                    for (var i = 1; i < $dataTroops.length; i++) {
                        if ($dataTroops[i] === liveTroop) {
                            tid = i;
                            break;
                        }
                    }
                }
            } catch (_) {}
        }
        if (tid > 0) return tid;
        return Math.floor(Number(this.selEid || 0));
    };

    EE.prototype.currentBattleTroopData = function() {
        var tid = this.currentBattleTroopId();
        if (tid > 0 && $dataTroops && Array.isArray($dataTroops) && $dataTroops[tid]) {
            return $dataTroops[tid];
        }
        try {
            var liveTroop = ($gameTroop && typeof $gameTroop.troop === 'function') ? $gameTroop.troop() : null;
            if (liveTroop && typeof liveTroop === 'object') return liveTroop;
        } catch (_) {}
        return null;
    };

    EE.prototype.trackPageSourceData = function(eventId, pageIndex) {
        var eid = Math.max(0, Math.floor(Number(eventId || 0)));
        var pi = Math.max(0, Math.floor(Number(pageIndex || 0)));
        if (this.isBattleEventMode()) {
            var troop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[eid] : null;
            if (!troop || !Array.isArray(troop.pages) || !troop.pages[pi]) return null;
            return troop.pages[pi];
        }
        var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        if (!ev || !Array.isArray(ev.pages) || !ev.pages[pi]) return null;
        return ev.pages[pi];
    };

    EE.prototype.trackPageSourceList = function(eventId, pageIndex) {
        var page = this.trackPageSourceData(eventId, pageIndex);
        return page && Array.isArray(page.list) ? page.list : [];
    };

    EE.prototype.normalizeTrackRowsForCurrentMode = function(tr) {
        if (!this.isBattleEventMode() || !tr || !Array.isArray(tr.commands)) return;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (e.rowType !== 'main' || e.rowKey !== 'main' || e.charId != null) {
                e.rowType = 'main';
                e.rowKey = 'main';
                e.charId = null;
            }
        }
        tr.extraCharRows = [];
        tr.tempCharRows = [];
    };

    EE.prototype.battleConditionSummary = function(conditions) {
        var c = (conditions && typeof conditions === 'object') ? conditions : {};
        var parts = [];
        if (c.turnEnding) parts.push('ターン終了');
        if (c.turnValid) parts.push('ターン ' + Math.max(0, Math.floor(Number(c.turnA || 0))) + ' + ' + Math.max(0, Math.floor(Number(c.turnB || 0))) + 'n');
        if (c.enemyValid) {
            parts.push('敵' + String(Math.max(1, Math.floor(Number(c.enemyIndex || 0)) + 1)) +
                ' HP<= ' + String(Math.max(0, Math.floor(Number(c.enemyHp == null ? 100 : c.enemyHp)))));
        }
        if (c.actorValid) {
            parts.push('アクター' + String(Math.max(1, Math.floor(Number(c.actorId || 1)))) +
                ' HP<= ' + String(Math.max(0, Math.floor(Number(c.actorHp == null ? 100 : c.actorHp)))));
        }
        if (c.switchValid) parts.push('SW ' + String(Math.max(1, Math.floor(Number(c.switchId || 1)))));
        if (!parts.length) return 'なし';
        return parts.join(' / ');
    };

    EE.prototype.selectBattleTrack = function(troopId, pageIndex) {
        troopId = Math.max(1, Math.floor(Number(troopId || this.currentBattleTroopId() || 0)));
        var troop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[troopId] : null;
        if (!troop || !Array.isArray(troop.pages) || !troop.pages.length) {
            this.selEid = 0;
            this.selPage = -1;
            this.selKey = '';
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.refreshEventInfo();
            this.timelineDirty = true;
            if (this.charList) this.charList.innerHTML = '';
            if (this.charInfo) this.charInfo.textContent = '戦闘モード';
            return false;
        }
        var maxPage = troop.pages.length - 1;
        var pi = Math.max(0, Math.min(maxPage, Math.floor(Number(pageIndex || 0))));
        if (typeof this.rememberSelectedTimelineViewState === 'function') this.rememberSelectedTimelineViewState();
        this.selEid = troopId;
        this.selPage = pi;
        this.selKey = this.key(troopId, pi);
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = null;
        if (typeof this.closeEditor === 'function') this.closeEditor();
        if (typeof this.closeAddCommandPanel === 'function') this.closeAddCommandPanel();
        if (typeof this.closeRouteCommandPanel === 'function') this.closeRouteCommandPanel();
        if (typeof this.closeWaitInsertDialog === 'function') this.closeWaitInsertDialog();
        if (typeof this.closeMemoEditor === 'function') this.closeMemoEditor();
        if (typeof this.closeEventSettingsEditor === 'function') this.closeEventSettingsEditor();
        if (typeof this.closeBattleEventSettingsEditor === 'function') this.closeBattleEventSettingsEditor();
        if (typeof this.closeCharContextMenu === 'function') this.closeCharContextMenu();
        if (typeof this.closeCameraContextMenu === 'function') this.closeCameraContextMenu();
        if (typeof this.closeRouteRangeContextMenu === 'function') this.closeRouteRangeContextMenu();
        if (typeof this.ensureTrack === 'function') this.ensureTrack(troopId, pi);
        if (typeof this.queueTimelineViewRestoreForTrack === 'function') this.queueTimelineViewRestoreForTrack(troopId, pi);
        if (typeof this.refreshEventInfo === 'function') this.refreshEventInfo();
        if (typeof this.rebuildSchedule === 'function') this.rebuildSchedule({ skipRouteNormalize: true });
        this.timelineDirty = true;
        if (typeof this.refreshCharacterPanel === 'function') this.refreshCharacterPanel(true);
        if (typeof this.refreshSelectedCharacterInfo === 'function') this.refreshSelectedCharacterInfo(true);
        return true;
    };



    EE.prototype.stop = function() {
        if (!this.on) return;
        if (!this._skipRecoveryOnStop && typeof this.writeRecoverySnapshot === 'function') {
            this.writeRecoverySnapshot(true);
        }
        this._skipRecoveryOnStop = false;
        this.on = false;
        this.stopWindowGuard();
        this.unbind();
        this.stopEditorAudioPlayback();
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
        this.root = null;
        this.restoreShrink();
    };

    EE.prototype.startWindowGuard = function() {
        var self = this;
        this.stopWindowGuard();
        // Keep window maximized while editor is active.
        this.winGuard = setInterval(function() {
            if (!self.on) return;
            maximizeWindowForEditor();
        }, 120);
    };

    EE.prototype.stopWindowGuard = function() {
        if (!this.winGuard) return;
        clearInterval(this.winGuard);
        this.winGuard = null;
    };

    EE.prototype.pre = function() {
        if (!this.on) return;
        if (this.play) {
            if (this.isPlaybackBlocked()) return;
            if (!this.execAt(this.frame)) return;
            this.frame++;
            this._simFrame = this.frame;
            this.pruneSimAudioState(this.frame);
            if (this.frame + 120 > this.maxF) {
                this.maxF = Math.ceil((this.frame + 120) / 120) * 120;
            }
            this.timelineDirty = true;
        }
    };



    EE.prototype.el = function(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt !== undefined) e.textContent = txt;
        return e;
    };

    EE.prototype.btn = function(txt, cls, fn) {
        var b = this.el('button', 'b' + (cls ? ' ' + cls : ''), txt);
        b.type = 'button';
        b.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); fn(); });
        return b;
    };

    EE.prototype.syncButtonsToCancelWidth = function(container) {
        if (!container || typeof container.querySelectorAll !== 'function') return;
        var buttons = container.querySelectorAll('button');
        if (!buttons || !buttons.length) return;
        var normalizeLabel = function(text) {
            var s = String(text || '').replace(/\s+/g, '');
            s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(ch) {
                return String.fromCharCode(ch.charCodeAt(0) - 65248);
            });
            return s.toLowerCase();
        };
        var cancelBtn = null;
        for (var i = 0; i < buttons.length; i++) {
            if (normalizeLabel(buttons[i].textContent) === 'キャンセル') {
                cancelBtn = buttons[i];
                break;
            }
        }
        if (!cancelBtn) return;
        var cancelWidth = Math.ceil(cancelBtn.getBoundingClientRect().width || cancelBtn.offsetWidth || 0);
        if (cancelWidth <= 0) return;
        for (var j = 0; j < buttons.length; j++) {
            var btn = buttons[j];
            var label = normalizeLabel(btn.textContent);
            if (label === 'ok' || label === '削除' || label === '適用') {
                var px = String(cancelWidth) + 'px';
                btn.style.minWidth = px;
                if (label === '適用') {
                    btn.style.width = px;
                    btn.style.maxWidth = px;
                }
            }
        }
    };

    EE.prototype.syncButtonsToCancelWidthAsync = function(container) {
        var self = this;
        var apply = function() { self.syncButtonsToCancelWidth(container); };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() {
                apply();
                requestAnimationFrame(apply);
            });
        } else {
            setTimeout(apply, 0);
            setTimeout(apply, 16);
        }
    };






    EE.prototype.captureBase = function() {
        var b = {
            sw: clone($gameSwitches._data || []),
            va: clone($gameVariables._data || []),
            ss: clone(($gameSelfSwitches && $gameSelfSwitches._data) || {}),
            pl: this.capCh($gamePlayer),
            fl: this.captureFollowersState(),
            sc: this.captureGameScreenState(),
            ev: {},
            mapDisplayX: Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0),
            mapDisplayY: Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0),
            mapParallaxX: Number($gameMap && $gameMap._parallaxX != null ? $gameMap._parallaxX : 0),
            mapParallaxY: Number($gameMap && $gameMap._parallaxY != null ? $gameMap._parallaxY : 0)
        };
        var es = ($gameMap && Array.isArray($gameMap._events)) ? $gameMap._events : [];
        for (var i = 0; i < es.length; i++) {
            var ev = es[i];
            if (!ev) continue;
            var eid = (typeof ev.eventId === 'function') ? Number(ev.eventId() || 0) : Number(ev._eventId || 0);
            eid = Math.floor(eid);
            if (eid <= 0) continue;
            b.ev[eid] = this.captureCanonicalEventState(eid, ev);
        }
        this.base = b;
        this._eeCalcDebugBaseFlagsByEvent = Object.create(null);
    };

    EE.prototype.capCh = function(ch) {
        if (!ch) return null;
        return {
            x: Number(ch.x || 0), y: Number(ch.y || 0), rx: Number(ch._realX || ch.x || 0), ry: Number(ch._realY || ch.y || 0),
            dir: Number(ch.direction ? ch.direction() : ch._direction || 2),
            ms: Number(ch._moveSpeed || 4), mf: Number(ch._moveFrequency || 3),
            op: Number(ch._opacity || 255), bm: Number(ch._blendMode || 0),
            th: !!ch._through, tr: !!ch._transparent, wa: !!ch._walkAnime, sa: !!ch._stepAnime, df: !!ch._directionFix,
            pt: Number(ch.pattern ? ch.pattern() : ch._pattern || 1),
            nm: String(ch.characterName ? ch.characterName() : ch._characterName || ''),
            ix: Number(ch.characterIndex ? ch.characterIndex() : ch._characterIndex || 0),
            mr: (ch._moveRoute && ch._moveRoute.list) ? clone(ch._moveRoute) : null,
            mri: Number(ch._moveRouteIndex || 0),
            mrf: !!ch._moveRouteForcing,
            omr: (ch._originalMoveRoute && ch._originalMoveRoute.list) ? clone(ch._originalMoveRoute) : null,
            omri: Number(ch._originalMoveRouteIndex || 0),
            cxy: Array.isArray(ch._centerXy) ? [Number(ch._centerXy[0] || 0), Number(ch._centerXy[1] || 0)] : null,
            dcx: (ch._displayCx != null) ? Number(ch._displayCx) : null,
            dcy: (ch._displayCy != null) ? Number(ch._displayCy) : null,
            dbx: (ch._displayBx != null) ? Number(ch._displayBx) : null,
            dby: (ch._displayBy != null) ? Number(ch._displayBy) : null,
            ex: this.captureCharacterPrimitiveFlags(ch)
        };
    };

    EE.prototype.captureCanonicalEventState = function(eventId, fallbackEvent) {
        eventId = Math.floor(Number(eventId || 0));
        if (eventId <= 0) return this.capCh(fallbackEvent);
        try {
            if (typeof Game_Event === 'undefined' || !$gameMap || typeof $gameMap.mapId !== 'function') {
                return this.capCh(fallbackEvent);
            }
            var mapId = Math.floor(Number($gameMap.mapId() || 0));
            if (mapId <= 0) return this.capCh(fallbackEvent);
            // Build deterministic baseline from map-data defaults under current switch state.
            var probe = new Game_Event(mapId, eventId);
            var cap = this.capCh(probe);
            // Popup message placement depends on runtime sprite size (_size).
            // Probe events do not own sprites, so preserve live size if available.
            if (cap && cap.ex && fallbackEvent && Array.isArray(fallbackEvent._size)) {
                try { cap.ex._size = clone(fallbackEvent._size); } catch (_) { cap.ex._size = fallbackEvent._size; }
            }
            return cap;
        } catch (_) {
            return this.capCh(fallbackEvent);
        }
    };

    EE.prototype.isPrimitiveStateValue = function(v) {
        var t = typeof v;
        return v == null || t === 'boolean' || t === 'number' || t === 'string';
    };

    EE.prototype.isCloneableObjectStateValue = function(v) {
        if (!v || typeof v !== 'object') return false;
        if (Array.isArray(v)) return true;
        var proto = Object.getPrototypeOf(v);
        return proto === Object.prototype || proto === null;
    };

    EE.prototype.captureCharacterPrimitiveFlags = function(ch) {
        var out = {};
        if (!ch) return out;
        var keys = Object.keys(ch);
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i] || '');
            // Only custom-ish runtime fields (underscore-prefixed) are tracked here.
            if (!k || k.charAt(0) !== '_') continue;
            var v = ch[k];
            if (this.isPrimitiveStateValue(v)) {
                out[k] = v;
                continue;
            }
            if (!this.isCloneableObjectStateValue(v)) continue;
            try {
                out[k] = clone(v);
            } catch (_) {}
        }
        return out;
    };

    EE.prototype.restoreCharacterPrimitiveFlags = function(ch, flags) {
        if (!ch) return;
        var src = (flags && typeof flags === 'object') ? flags : {};
        var own = Object.keys(ch);
        for (var i = 0; i < own.length; i++) {
            var k = String(own[i] || '');
            if (!k || k.charAt(0) !== '_') continue;
            var cv = ch[k];
            var deletable = this.isPrimitiveStateValue(cv) || this.isCloneableObjectStateValue(cv);
            if (!Object.prototype.hasOwnProperty.call(src, k) && deletable) {
                try { delete ch[k]; } catch (_) {}
            }
        }
        var sk = Object.keys(src);
        for (var j = 0; j < sk.length; j++) {
            var key = String(sk[j] || '');
            if (!key || key.charAt(0) !== '_') continue;
            var sv = src[key];
            if (this.isPrimitiveStateValue(sv)) {
                ch[key] = sv;
                continue;
            }
            if (this.isCloneableObjectStateValue(sv)) {
                try { ch[key] = clone(sv); } catch (_) { ch[key] = sv; }
                continue;
            }
            ch[key] = sv;
        }
    };

    EE.prototype.captureFollowersState = function() {
        var out = [];
        try {
            var flw = ($gamePlayer && typeof $gamePlayer.followers === 'function') ? $gamePlayer.followers() : null;
            var data = flw && Array.isArray(flw._data) ? flw._data : [];
            for (var i = 0; i < data.length; i++) out.push(this.capCh(data[i]));
        } catch (_) {}
        return out;
    };

    EE.prototype.restoreFollowersState = function(states) {
        states = Array.isArray(states) ? states : [];
        try {
            var flw = ($gamePlayer && typeof $gamePlayer.followers === 'function') ? $gamePlayer.followers() : null;
            var data = flw && Array.isArray(flw._data) ? flw._data : [];
            var i;
            for (i = 0; i < data.length; i++) {
                if (!data[i]) continue;
                if (i < states.length && states[i]) {
                    this.resCh(data[i], states[i]);
                } else if ($gamePlayer) {
                    if (data[i].locateTo) data[i].locateTo($gamePlayer.x, $gamePlayer.y);
                    else if (data[i].locate) data[i].locate($gamePlayer.x, $gamePlayer.y);
                }
            }
            if (flw && typeof flw.refresh === 'function') flw.refresh();
        } catch (_) {}
    };

    EE.prototype.captureGameScreenState = function() {
        var gs = $gameScreen;
        if (!gs) return null;
        return {
            brightness: Number(gs._brightness == null ? 255 : gs._brightness),
            fadeOutDuration: Math.max(0, Math.floor(Number(gs._fadeOutDuration || 0))),
            fadeInDuration: Math.max(0, Math.floor(Number(gs._fadeInDuration || 0))),
            tone: clone(gs._tone || [0, 0, 0, 0]),
            toneTarget: clone(gs._toneTarget || [0, 0, 0, 0]),
            toneDuration: Math.max(0, Math.floor(Number(gs._toneDuration || 0))),
            flashColor: clone(gs._flashColor || [0, 0, 0, 0]),
            flashDuration: Math.max(0, Math.floor(Number(gs._flashDuration || 0))),
            shakePower: Number(gs._shakePower || 0),
            shakeSpeed: Number(gs._shakeSpeed || 0),
            shakeDuration: Math.max(0, Math.floor(Number(gs._shakeDuration || 0))),
            shakeDirection: Number(gs._shakeDirection || 1),
            shake: Number(gs._shake || 0),
            zoomX: Number(gs._zoomX || 0),
            zoomY: Number(gs._zoomY || 0),
            zoomScale: Number(gs._zoomScale == null ? 1 : gs._zoomScale),
            zoomScaleTarget: Number(gs._zoomScaleTarget == null ? 1 : gs._zoomScaleTarget),
            zoomDuration: Math.max(0, Math.floor(Number(gs._zoomDuration || 0))),
            weatherType: String(gs._weatherType || 'none'),
            weatherPower: Number(gs._weatherPower || 0),
            weatherPowerTarget: Number(gs._weatherPowerTarget || 0),
            weatherDuration: Math.max(0, Math.floor(Number(gs._weatherDuration || 0))),
            pictures: clone(gs._pictures || []),
            fadeZxc: this.captureGameScreenFadeZxcState(gs)
        };
    };

    EE.prototype.captureGameScreenFadeZxcState = function(gs) {
        if (!gs) return null;
        var hasState = false;
        hasState = hasState || Object.prototype.hasOwnProperty.call(gs, '_fadeZXCQueue');
        hasState = hasState || Object.prototype.hasOwnProperty.call(gs, '_fadeZXCStage');
        hasState = hasState || Object.prototype.hasOwnProperty.call(gs, '_fadeZXCPresent');
        if (!hasState && typeof gs.clearFadeZXC !== 'function' && typeof gs.fadeZXCStage !== 'function') return null;
        return {
            queue: Array.isArray(gs._fadeZXCQueue) ? clone(gs._fadeZXCQueue) : null,
            index: Math.max(0, Math.floor(Number(gs._fadeZXCIndex || 0))),
            frame: Math.max(0, Math.floor(Number(gs._fadeZXCFrame || 0))),
            active: !!gs._fadeZXCActive,
            stage: Math.floor(Number(gs._fadeZXCStage == null ? -1 : gs._fadeZXCStage)),
            present: !!gs._fadeZXCPresent,
            color: Math.max(0, Math.min(1, Math.floor(Number(gs._fadeZXCColor || 0) || 0))),
            requestUpdate: !!gs._fadeZXCRequestUpdate
        };
    };

    EE.prototype.restoreGameScreenFadeZxcState = function(gs, state) {
        if (!gs) return;
        if (typeof gs.clearFadeZXC === 'function') {
            try { gs.clearFadeZXC(); } catch (_) {}
        } else {
            gs._fadeZXCQueue = null;
            gs._fadeZXCIndex = 0;
            gs._fadeZXCFrame = 0;
            gs._fadeZXCActive = false;
            gs._fadeZXCStage = -1;
            gs._fadeZXCPresent = false;
            gs._fadeZXCColor = 0;
            gs._fadeZXCRequestUpdate = false;
        }
        var st = (state && typeof state === 'object') ? state : null;
        if (!st) {
            // Force sprite refresh so stale fade overlay is removed immediately.
            gs._fadeZXCRequestUpdate = true;
            return;
        }
        gs._fadeZXCQueue = Array.isArray(st.queue) ? clone(st.queue) : null;
        gs._fadeZXCIndex = Math.max(0, Math.floor(Number(st.index || 0)));
        gs._fadeZXCFrame = Math.max(0, Math.floor(Number(st.frame || 0)));
        gs._fadeZXCActive = !!st.active;
        gs._fadeZXCStage = Math.floor(Number(st.stage == null ? -1 : st.stage));
        gs._fadeZXCPresent = !!st.present;
        gs._fadeZXCColor = Math.max(0, Math.min(1, Math.floor(Number(st.color || 0) || 0)));
        gs._fadeZXCRequestUpdate = true;
    };

    EE.prototype.restoreGameScreenState = function(state) {
        var gs = $gameScreen;
        var st = (state && typeof state === 'object') ? state : null;
        if (!gs || !st) return;
        if (typeof gs.clear === 'function') gs.clear();
        gs._brightness = Number(st.brightness == null ? 255 : st.brightness);
        gs._fadeOutDuration = Math.max(0, Math.floor(Number(st.fadeOutDuration || 0)));
        gs._fadeInDuration = Math.max(0, Math.floor(Number(st.fadeInDuration || 0)));
        gs._tone = clone(st.tone || [0, 0, 0, 0]);
        gs._toneTarget = clone(st.toneTarget || [0, 0, 0, 0]);
        gs._toneDuration = Math.max(0, Math.floor(Number(st.toneDuration || 0)));
        gs._flashColor = clone(st.flashColor || [0, 0, 0, 0]);
        gs._flashDuration = Math.max(0, Math.floor(Number(st.flashDuration || 0)));
        gs._shakePower = Number(st.shakePower || 0);
        gs._shakeSpeed = Number(st.shakeSpeed || 0);
        gs._shakeDuration = Math.max(0, Math.floor(Number(st.shakeDuration || 0)));
        gs._shakeDirection = Number(st.shakeDirection || 1);
        gs._shake = Number(st.shake || 0);
        gs._zoomX = Number(st.zoomX || 0);
        gs._zoomY = Number(st.zoomY || 0);
        gs._zoomScale = Number(st.zoomScale == null ? 1 : st.zoomScale);
        gs._zoomScaleTarget = Number(st.zoomScaleTarget == null ? gs._zoomScale : st.zoomScaleTarget);
        gs._zoomDuration = Math.max(0, Math.floor(Number(st.zoomDuration || 0)));
        gs._weatherType = String(st.weatherType || 'none');
        gs._weatherPower = Number(st.weatherPower || 0);
        gs._weatherPowerTarget = Number(st.weatherPowerTarget || 0);
        gs._weatherDuration = Math.max(0, Math.floor(Number(st.weatherDuration || 0)));
        var srcPictures = Array.isArray(st.pictures) ? st.pictures : [];
        var restoredPictures = [];
        for (var pi = 0; pi < srcPictures.length; pi++) {
            var srcPic = srcPictures[pi];
            if (!srcPic) {
                restoredPictures[pi] = null;
                continue;
            }
            if (typeof srcPic.update === 'function') {
                restoredPictures[pi] = srcPic;
                continue;
            }
            if (typeof Game_Picture !== 'undefined') {
                var pic = new Game_Picture();
                var snap = (typeof srcPic === 'object') ? clone(srcPic) : {};
                var keys = Object.keys(snap);
                for (var ki = 0; ki < keys.length; ki++) {
                    var key = keys[ki];
                    try { pic[key] = snap[key]; } catch (_) {}
                }
                restoredPictures[pi] = pic;
            } else {
                restoredPictures[pi] = srcPic;
            }
        }
        gs._pictures = restoredPictures;
        this.restoreGameScreenFadeZxcState(gs, st.fadeZxc);
    };

    EE.prototype.defaultMoveRoute = function() {
        return { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] };
    };

    EE.prototype.restoreBaseCharacterState = function() {
        if (!this.base) return;
        this.resCh($gamePlayer, this.base.pl);
        this.restoreFollowersState(this.base.fl);
        var ks = Object.keys(this.base.ev || {});
        for (var i = 0; i < ks.length; i++) this.resCh($gameMap.event(Number(ks[i])), this.base.ev[ks[i]]);
    };

    EE.prototype.restoreBase = function() {
        if (!this.base) return;
        if (typeof this.resetActiveEditorMoveRoutes === 'function') this.resetActiveEditorMoveRoutes();
        var oldCenter = ($gamePlayer && Array.isArray($gamePlayer._centerXy)) ? $gamePlayer._centerXy : null;
        if (oldCenter && SceneManager && typeof SceneManager.clearEasing === 'function') {
            SceneManager.clearEasing(oldCenter, [0, 1]);
        }
        $gameSwitches._data = clone(this.base.sw || []);
        $gameVariables._data = clone(this.base.va || []);
        if ($gameSelfSwitches) $gameSelfSwitches._data = clone(this.base.ss || {});
        if ($gameMap && $gameMap.requestRefresh) $gameMap.requestRefresh();
        if ($gameMap && $gameMap.refreshIfNeeded) $gameMap.refreshIfNeeded();
        this.restoreBaseCharacterState();
        if (SceneManager && typeof SceneManager.clearEasing === 'function' && $gamePlayer && Array.isArray($gamePlayer._centerXy)) {
            SceneManager.clearEasing($gamePlayer._centerXy, [0, 1]);
        }
        if ($gameMap) {
            $gameMap._displayX = Number(this.base.mapDisplayX != null ? this.base.mapDisplayX : $gameMap._displayX || 0);
            $gameMap._displayY = Number(this.base.mapDisplayY != null ? this.base.mapDisplayY : $gameMap._displayY || 0);
            $gameMap._parallaxX = Number(this.base.mapParallaxX != null ? this.base.mapParallaxX : $gameMap._parallaxX || 0);
            $gameMap._parallaxY = Number(this.base.mapParallaxY != null ? this.base.mapParallaxY : $gameMap._parallaxY || 0);
        }
        if (this.base.sc) this.restoreGameScreenState(this.base.sc);
        else if ($gameScreen && typeof $gameScreen.clear === 'function') $gameScreen.clear();
        if ($gameMap && $gameMap._interpreter) $gameMap._interpreter.clear();
        if ($gameTroop && $gameTroop._interpreter) $gameTroop._interpreter.clear();
        this.clearMessageRuntimeState();
        this.clearVisualRuntimeState();
        this._simToRunning = false;
        this._simExecFrame = -1;
        this.resetSimAudioState();
        this.stopEditorAudioPlayback();
        if ($gameTemp && $gameTemp.clearDestination) $gameTemp.clearDestination();
    };

    EE.prototype.clearMessageRuntimeState = function() {
        try {
            if ($gameMessage && typeof $gameMessage.clear === 'function') $gameMessage.clear();
        } catch (_) {}
        try {
            if ($gameMap && $gameMap._interpreter) {
                $gameMap._interpreter._waitMode = '';
                $gameMap._interpreter._waitCount = 0;
            }
        } catch (_) {}
        try {
            if ($gameTroop && $gameTroop._interpreter) {
                $gameTroop._interpreter._waitMode = '';
                $gameTroop._interpreter._waitCount = 0;
            }
        } catch (_) {}
        try {
            var sc = SceneManager && SceneManager._scene;
            var mw = sc && sc._messageWindow;
            if (!mw) return;
            try { if (typeof mw.terminateMessage === 'function') mw.terminateMessage(); } catch (_) {}
            mw.pause = false;
            mw._textState = null;
            mw._waitCount = 0;
            mw._showFast = false;
            mw._lineShowFast = false;
            if (typeof mw.deactivate === 'function') mw.deactivate();
            if (typeof mw.close === 'function') mw.close();
            if (mw.openness != null) mw.openness = 0;
            mw._opening = false;
            mw._closing = false;
            var subs = ['_choiceWindow', '_numberWindow', '_itemWindow', '_goldWindow', '_nameWindow', '_nameBoxWindow'];
            for (var i = 0; i < subs.length; i++) {
                var w = mw[subs[i]];
                if (!w) continue;
                if (typeof w.deactivate === 'function') w.deactivate();
                if (typeof w.close === 'function') w.close();
                if (w.openness != null) w.openness = 0;
                w._opening = false;
                w._closing = false;
            }
        } catch (_) {}
    };

    EE.prototype.ensureMessageRuntimeStateForPlayback = function() {
        try {
            var sc = SceneManager && SceneManager._scene;
            var mw = sc && sc._messageWindow;
            if (!mw) return;
            mw.visible = true;
            var subs = ['_choiceWindow', '_numberWindow', '_itemWindow', '_goldWindow', '_nameWindow', '_nameBoxWindow'];
            for (var i = 0; i < subs.length; i++) {
                var w = mw[subs[i]];
                if (!w) continue;
                w.visible = true;
            }
        } catch (_) {}
    };

    EE.prototype.clearCharacterVisualState = function(ch) {
        if (!ch) return;
        try { ch._animationId = 0; } catch (_) {}
        try { ch._balloonId = 0; } catch (_) {}
        try { if (typeof ch.endAnimation === 'function') ch.endAnimation(); else ch._animationPlaying = false; } catch (_) {}
        try { if (typeof ch.endBalloon === 'function') ch.endBalloon(); else ch._balloonPlaying = false; } catch (_) {}
    };

    EE.prototype.resetEnemySpriteAnimation = function(sp) {
        if (!sp || !sp._enemySprite) return;
        try { sp._forceFrame = null; } catch (_) {}
        try { sp._needEnemyAnimInit = false; } catch (_) {}
        try {
            if (typeof sp.setAnimation === 'function') sp.setAnimation('wait', true);
            else if (typeof Sprite_NewBattler !== 'undefined' && Sprite_NewBattler.prototype && typeof Sprite_NewBattler.prototype.setAnimation === 'function') {
                Sprite_NewBattler.prototype.setAnimation.call(sp, 'wait', true);
            }
        } catch (_) {}
        try { if (typeof sp.updateCharacterFrame === 'function') sp.updateCharacterFrame(); } catch (_) {}
    };

    EE.prototype.clearEnemySpriteRuntimeState = function() {
        try {
            var sc = SceneManager && SceneManager._scene;
            var ss = sc && sc._spriteset;
            var ls = ss && ss._characterSprites ? ss._characterSprites : [];
            for (var i = 0; i < ls.length; i++) this.resetEnemySpriteAnimation(ls[i]);
        } catch (_) {}
    };

    EE.prototype.clearSpriteTransientRecursive = function(node) {
        if (!node) return;
        if (node._animationSprites && Array.isArray(node._animationSprites)) {
            for (var ai = 0; ai < node._animationSprites.length; ai++) {
                var as = node._animationSprites[ai];
                if (!as) continue;
                try { if (as.parent && as.parent.removeChild) as.parent.removeChild(as); } catch (_) {}
                try { if (typeof as.destroy === 'function') as.destroy(); } catch (_) {}
            }
            node._animationSprites.length = 0;
        }
        if (node._balloonSprite) {
            var bs = node._balloonSprite;
            try { if (bs.parent && bs.parent.removeChild) bs.parent.removeChild(bs); } catch (_) {}
            try { if (typeof bs.destroy === 'function') bs.destroy(); } catch (_) {}
            node._balloonSprite = null;
        }
        var cs = node.children;
        if (!cs || !cs.length) return;
        for (var i = cs.length - 1; i >= 0; i--) {
            var c = cs[i];
            this.clearSpriteTransientRecursive(c);
            var isAnim = false;
            var isBalloon = false;
            try { isAnim = (typeof Sprite_Animation !== 'undefined' && c instanceof Sprite_Animation); } catch (_) {}
            try { isBalloon = (typeof Sprite_Balloon !== 'undefined' && c instanceof Sprite_Balloon); } catch (_) {}
            if (!isAnim && !isBalloon) continue;
            try { if (c.parent && c.parent.removeChild) c.parent.removeChild(c); } catch (_) {}
            try { if (typeof c.destroy === 'function') c.destroy(); } catch (_) {}
        }
    };

    EE.prototype.clearVisualRuntimeState = function() {
        try { this.clearCharacterVisualState($gamePlayer); } catch (_) {}
        try {
            var es = ($gameMap && Array.isArray($gameMap._events)) ? $gameMap._events : [];
            for (var i = 0; i < es.length; i++) this.clearCharacterVisualState(es[i]);
        } catch (_) {}
        try {
            var sc = SceneManager && SceneManager._scene;
            var ss = sc && sc._spriteset;
            if (ss) this.clearSpriteTransientRecursive(ss);
        } catch (_) {}
        this.clearEnemySpriteRuntimeState();
    };

    EE.prototype.stepVisualRuntime = function() {
        try {
            var sc = SceneManager && SceneManager._scene;
            if (!sc) return;
            if (sc._spriteset && sc._spriteset.update) sc._spriteset.update();
        } catch (_) {}
    };

    EE.prototype.resetSimAudioState = function() {
        this._simSeActive = [];
        this._simMeActive = [];
        this._simBgmState = null;
        this._simBgsState = null;
        this._simSavedBgm = null;
        this._simMePlaybackBuffers = [];
    };

    EE.prototype.stopEditorAudioPlayback = function() {
        if (!AudioManager) return;
        try { if (AudioManager.stopSe) AudioManager.stopSe(); } catch (_) {}
        try { if (AudioManager.stopMe) AudioManager.stopMe(); } catch (_) {}
        try { if (AudioManager.stopBgm) AudioManager.stopBgm(); } catch (_) {}
        try { if (AudioManager.stopBgs) AudioManager.stopBgs(); } catch (_) {}
        var lbs = this._simMePlaybackBuffers || [];
        for (var i = 0; i < lbs.length; i++) {
            var b = lbs[i];
            if (!b) continue;
            try { if (typeof b.stop === 'function') b.stop(); } catch (_) {}
        }
        this._simMePlaybackBuffers = [];
    };

    EE.prototype.normalizeAudioParam = function(param, defaults) {
        defaults = defaults || {};
        var p = param && typeof param === 'object' ? param : {};
        return {
            name: String(p.name || ''),
            volume: Math.max(0, Math.min(100, Math.floor(Number(p.volume == null ? (defaults.volume == null ? 90 : defaults.volume) : p.volume) || 0))),
            pitch: Math.max(50, Math.min(150, Math.floor(Number(p.pitch == null ? (defaults.pitch == null ? 100 : defaults.pitch) : p.pitch) || 0))),
            pan: Math.max(-100, Math.min(100, Math.floor(Number(p.pan == null ? (defaults.pan == null ? 0 : defaults.pan) : p.pan) || 0)))
        };
    };

    EE.prototype.applyAudioBufferParams = function(kind, buffer, param) {
        if (!AudioManager || !buffer || !param) return;
        try {
            if (kind === 'se' && typeof AudioManager.updateSeParameters === 'function') {
                AudioManager.updateSeParameters(buffer, param);
                return;
            }
            if (kind === 'me' && typeof AudioManager.updateMeParameters === 'function') {
                AudioManager.updateMeParameters(buffer, param);
                return;
            }
            if (kind === 'bgm' && typeof AudioManager.updateBgmParameters === 'function') {
                AudioManager.updateBgmParameters(buffer, param);
                return;
            }
            if (kind === 'bgs' && typeof AudioManager.updateBgsParameters === 'function') {
                AudioManager.updateBgsParameters(buffer, param);
                return;
            }
            if (typeof AudioManager.updateBufferParameters === 'function') {
                AudioManager.updateBufferParameters(buffer, AudioManager._masterVolume || 1, param);
            }
        } catch (_) {}
    };

    EE.prototype.pushSimOneShotActive = function(kind, param, frame, listName) {
        if (!AudioManager || !AudioManager.createBuffer) return;
        var np = this.normalizeAudioParam(param);
        if (!np.name) return;
        var buffer = null;
        try { buffer = AudioManager.createBuffer(kind, String(np.name || '')); } catch (_) { buffer = null; }
        if (!buffer) return;
        this.applyAudioBufferParams(kind, buffer, np);
        var p = Number(buffer && buffer._pitch != null ? buffer._pitch : 1);
        if (!isFinite(p) || p <= 0) p = 1;
        if (!Array.isArray(this[listName])) this[listName] = [];
        this[listName].push({
            buffer: buffer,
            startFrame: Math.max(0, Math.floor(Number(frame || 0))),
            pitch: p
        });
    };

    EE.prototype.pushSimSeActive = function(se, frame) {
        this.pushSimOneShotActive('se', se, frame, '_simSeActive');
    };

    EE.prototype.pushSimMeActive = function(me, frame) {
        this._simMeActive = [];
        this.pushSimOneShotActive('me', me, frame, '_simMeActive');
    };

    EE.prototype.pruneOneShotList = function(listName, frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var src = Array.isArray(this[listName]) ? this[listName] : [];
        var keep = [];
        for (var i = 0; i < src.length; i++) {
            var it = src[i];
            if (!it || !it.buffer) continue;
            var pitch = Number(it.buffer._pitch != null ? it.buffer._pitch : it.pitch || 1);
            if (!isFinite(pitch) || pitch <= 0) pitch = 1;
            var elapsedSec = Math.max(0, (frame - Number(it.startFrame || 0)) / 60);
            var offsetSec = elapsedSec * pitch;
            var total = Number(it.buffer._totalTime || 0);
            if (total > 0 && offsetSec >= total) continue;
            keep.push(it);
        }
        this[listName] = keep;
    };

    EE.prototype.pruneSimSeActive = function(frame) {
        this.pruneOneShotList('_simSeActive', frame);
    };

    EE.prototype.loopOffsetSecAt = function(st, frame) {
        if (!st) return 0;
        var elapsedSec = Math.max(0, (frame - Number(st.startFrame || 0)) / 60);
        var pitchRate = Math.max(0.01, Number((st.param && st.param.pitch != null ? st.param.pitch : 100)) / 100);
        return Math.max(0, Number(st.startOffsetSec || 0) + elapsedSec * pitchRate);
    };

    EE.prototype.loopVolumeAt = function(st, frame) {
        if (!st || !st.param) return 0;
        var vol = Math.max(0, Math.min(100, Number(st.param.volume || 0)));
        if (st.fadeStartFrame != null && Number(st.fadeFrames || 0) > 0) {
            var dt = Math.max(0, frame - Number(st.fadeStartFrame || 0));
            var ff = Math.max(1, Number(st.fadeFrames || 1));
            if (dt >= ff) return 0;
            var fromVol = Math.max(0, Math.min(100, Number(st.fadeFromVolume == null ? vol : st.fadeFromVolume)));
            vol = Math.round(fromVol * Math.max(0, 1 - dt / ff));
        }
        return Math.max(0, Math.min(100, vol));
    };

    EE.prototype.buildLoopPlaybackState = function(st, frame) {
        if (!st || !st.param || !st.param.name) return null;
        var vol = this.loopVolumeAt(st, frame);
        if (vol <= 0) return null;
        var param = clone(st.param);
        param.volume = vol;
        var offsetSec = this.loopOffsetSecAt(st, frame);
        return { param: param, offsetSec: offsetSec };
    };

    EE.prototype.pruneLoopState = function(st, frame) {
        if (!st || !st.param || !st.param.name) return null;
        if (this.loopVolumeAt(st, frame) <= 0) return null;
        return st;
    };

    EE.prototype.pruneSimAudioState = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        this.pruneSimSeActive(frame);
        this.pruneOneShotList('_simMeActive', frame);
        this._simBgmState = this.pruneLoopState(this._simBgmState, frame);
        this._simBgsState = this.pruneLoopState(this._simBgsState, frame);
    };

    EE.prototype.replayOneShotList = function(listName, frame, onPlay) {
        var src = Array.isArray(this[listName]) ? this[listName] : [];
        for (var i = 0; i < src.length; i++) {
            var it = src[i];
            var b = it && it.buffer;
            if (!b) continue;
            var pitch = Number(b._pitch != null ? b._pitch : it.pitch || 1);
            if (!isFinite(pitch) || pitch <= 0) pitch = 1;
            var elapsedSec = Math.max(0, (frame - Number(it.startFrame || 0)) / 60);
            var offsetSec = elapsedSec * pitch;
            var total = Number(b._totalTime || 0);
            if (total > 0 && offsetSec >= total) continue;
            try { b.play(false, offsetSec); } catch (_) {}
            try { if (typeof onPlay === 'function') onPlay(b); } catch (_) {}
        }
    };

    EE.prototype.rebuildSimAudioPlayback = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        this.pruneSimAudioState(frame);
        this.stopEditorAudioPlayback();
        if (!this.play || !AudioManager) return;

        var bgm = this.buildLoopPlaybackState(this._simBgmState, frame);
        if (bgm && bgm.param && bgm.param.name && typeof AudioManager.playBgm === 'function') {
            try { AudioManager.playBgm(bgm.param, bgm.offsetSec); } catch (_) {}
        }

        var bgs = this.buildLoopPlaybackState(this._simBgsState, frame);
        if (bgs && bgs.param && bgs.param.name && typeof AudioManager.playBgs === 'function') {
            try { AudioManager.playBgs(bgs.param, bgs.offsetSec); } catch (_) {}
        }

        var self = this;
        this.replayOneShotList('_simMeActive', frame, function(b) {
            self._simMePlaybackBuffers.push(b);
            try { AudioManager._meBuffer = b; } catch (_) {}
        });

        this.replayOneShotList('_simSeActive', frame, function(b) {
            try {
                if (AudioManager._seBuffers && AudioManager._seBuffers.indexOf(b) < 0) AudioManager._seBuffers.push(b);
            } catch (_) {}
        });
    };

    EE.prototype.handleAudioCommand = function(code, params, frame) {
        code = Number(code || 0);
        params = Array.isArray(params) ? params : [];
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var runtimePlay = (!this._simToRunning && !!this.play);
        var fastSimulating = !!this._simToRunning;

        if (code === 250) {
            var se = (params && params.length > 0) ? params[0] : null;
            // During fast simulation (simTo seek/recalc), suppress SE completely.
            if (!fastSimulating) this.pushSimSeActive(se, frame);
            if (!fastSimulating && runtimePlay && AudioManager && typeof AudioManager.playSe === 'function') {
                try { AudioManager.playSe(se); } catch (_) {}
            }
            return true;
        }
        if (code === 251) {
            this._simSeActive = [];
            if (!this._simToRunning && AudioManager && typeof AudioManager.stopSe === 'function') {
                try { AudioManager.stopSe(); } catch (_) {}
            }
            return true;
        }

        if (code === 241) {
            var bgm = this.normalizeAudioParam(params[0], { volume: 90, pitch: 100, pan: 0 });
            if (!bgm.name) {
                this._simBgmState = null;
                if (!this._simToRunning && AudioManager && typeof AudioManager.stopBgm === 'function') {
                    try { AudioManager.stopBgm(); } catch (_) {}
                }
                return true;
            }
            this._simBgmState = { param: bgm, startFrame: frame, startOffsetSec: 0, fadeStartFrame: null, fadeFrames: 0, fadeFromVolume: null };
            if (runtimePlay && AudioManager && typeof AudioManager.playBgm === 'function') {
                try { AudioManager.playBgm(clone(bgm), 0); } catch (_) {}
            }
            return true;
        }
        if (code === 242) {
            var bsec = Math.max(0, Math.floor(Number(params[0] || 0) || 0));
            if (this._simBgmState) {
                if (bsec <= 0) {
                    this._simBgmState = null;
                } else {
                    this._simBgmState.fadeStartFrame = frame;
                    this._simBgmState.fadeFrames = bsec * 60;
                    this._simBgmState.fadeFromVolume = this.loopVolumeAt(this._simBgmState, frame);
                }
            }
            if (!this._simToRunning && AudioManager) {
                try {
                    if (bsec <= 0 && AudioManager.stopBgm) AudioManager.stopBgm();
                    else if (AudioManager.fadeOutBgm) AudioManager.fadeOutBgm(bsec);
                } catch (_) {}
            }
            return true;
        }
        if (code === 243) {
            var saved = this.buildLoopPlaybackState(this._simBgmState, frame);
            this._simSavedBgm = saved ? { param: clone(saved.param), posSec: Number(saved.offsetSec || 0) } : null;
            return true;
        }
        if (code === 244) {
            if (this._simSavedBgm && this._simSavedBgm.param) {
                this._simBgmState = {
                    param: clone(this._simSavedBgm.param),
                    startFrame: frame,
                    startOffsetSec: Math.max(0, Number(this._simSavedBgm.posSec || 0)),
                    fadeStartFrame: null,
                    fadeFrames: 0,
                    fadeFromVolume: null
                };
                if (runtimePlay && AudioManager && typeof AudioManager.playBgm === 'function') {
                    try { AudioManager.playBgm(clone(this._simSavedBgm.param), Math.max(0, Number(this._simSavedBgm.posSec || 0))); } catch (_) {}
                }
            }
            return true;
        }

        if (code === 245) {
            var bgs = this.normalizeAudioParam(params[0], { volume: 90, pitch: 100, pan: 0 });
            if (!bgs.name) {
                this._simBgsState = null;
                if (!this._simToRunning && AudioManager && typeof AudioManager.stopBgs === 'function') {
                    try { AudioManager.stopBgs(); } catch (_) {}
                }
                return true;
            }
            this._simBgsState = { param: bgs, startFrame: frame, startOffsetSec: 0, fadeStartFrame: null, fadeFrames: 0, fadeFromVolume: null };
            if (runtimePlay && AudioManager && typeof AudioManager.playBgs === 'function') {
                try { AudioManager.playBgs(clone(bgs), 0); } catch (_) {}
            }
            return true;
        }
        if (code === 246) {
            var ssec = Math.max(0, Math.floor(Number(params[0] || 0) || 0));
            if (this._simBgsState) {
                if (ssec <= 0) {
                    this._simBgsState = null;
                } else {
                    this._simBgsState.fadeStartFrame = frame;
                    this._simBgsState.fadeFrames = ssec * 60;
                    this._simBgsState.fadeFromVolume = this.loopVolumeAt(this._simBgsState, frame);
                }
            }
            if (!this._simToRunning && AudioManager) {
                try {
                    if (ssec <= 0 && AudioManager.stopBgs) AudioManager.stopBgs();
                    else if (AudioManager.fadeOutBgs) AudioManager.fadeOutBgs(ssec);
                } catch (_) {}
            }
            return true;
        }

        if (code === 249) {
            var me = this.normalizeAudioParam(params[0], { volume: 90, pitch: 100, pan: 0 });
            this._simMeActive = [];
            if (me.name) this.pushSimMeActive(me, frame);
            if (!this._simToRunning && AudioManager) {
                try {
                    if (runtimePlay && me.name && AudioManager.playMe) AudioManager.playMe(clone(me));
                    else if (AudioManager.stopMe) AudioManager.stopMe();
                } catch (_) {}
            }
            return true;
        }
        return false;
    };

    EE.prototype.resCh = function(ch, st) {
        if (!ch || !st) return;
        if (ch.locateTo) ch.locateTo(st.x, st.y); else if (ch.locate) ch.locate(st.x, st.y);
        ch._realX = st.rx; ch._realY = st.ry;
        var route = null;
        if (st.mr && st.mr.list) {
            route = clone(st.mr);
        } else if (ch.page && typeof ch.page === 'function' && ch.page() && ch.page().moveRoute) {
            route = clone(ch.page().moveRoute);
        } else {
            route = this.defaultMoveRoute();
        }
        if (typeof ch.setMoveRoute === 'function') ch.setMoveRoute(route); else ch._moveRoute = route;
        ch._moveRouteIndex = Math.max(0, Number(st.mri || 0));
        ch._moveRouteForcing = !!st.mrf;
        ch._originalMoveRoute = (st.omr && st.omr.list) ? clone(st.omr) : null;
        ch._originalMoveRouteIndex = Math.max(0, Number(st.omri || 0));
        if (Array.isArray(st.cxy)) ch._centerXy = [Number(st.cxy[0] || 0), Number(st.cxy[1] || 0)];
        if (st.dcx != null) ch._displayCx = Number(st.dcx);
        if (st.dcy != null) ch._displayCy = Number(st.dcy);
        if (st.dbx != null) ch._displayBx = Number(st.dbx);
        if (st.dby != null) ch._displayBy = Number(st.dby);
        ch._waitCount = 0;
        var dir = Number(st.dir == null ? 2 : st.dir);
        var dirFix = !!st.df;
        if (ch.setDirectionFix) ch.setDirectionFix(false); else ch._directionFix = false;
        if (ch.setDirection) ch.setDirection(dir); else ch._direction = dir;
        if (ch.setMoveSpeed) ch.setMoveSpeed(Number(st.ms == null ? 4 : st.ms)); else ch._moveSpeed = Number(st.ms == null ? 4 : st.ms);
        if (ch.setMoveFrequency) ch.setMoveFrequency(Number(st.mf == null ? 3 : st.mf)); else ch._moveFrequency = Number(st.mf == null ? 3 : st.mf);
        if (ch.setOpacity) ch.setOpacity(Number(st.op == null ? 255 : st.op)); else ch._opacity = Number(st.op == null ? 255 : st.op);
        if (ch.setBlendMode) ch.setBlendMode(Number(st.bm == null ? 0 : st.bm)); else ch._blendMode = Number(st.bm == null ? 0 : st.bm);
        if (ch.setThrough) ch.setThrough(!!st.th); else ch._through = !!st.th;
        if (ch.setTransparent) ch.setTransparent(!!st.tr); else ch._transparent = !!st.tr;
        if (ch.setWalkAnime) ch.setWalkAnime(!!st.wa); else ch._walkAnime = !!st.wa;
        if (ch.setStepAnime) ch.setStepAnime(!!st.sa); else ch._stepAnime = !!st.sa;
        if (ch.setDirectionFix) ch.setDirectionFix(dirFix); else ch._directionFix = dirFix;
        ch._pattern = Number(st.pt == null ? 1 : st.pt);
        if (this.isBattleEventMode()) {
            if (ch.setImage) ch.setImage(st.nm, st.ix);
            else if (ch.setImageZXC) {
                try { ch.setImageZXC(st.nm, st.ix, dir); } catch (_) {}
            }
        } else {
            if (ch.setImageZXC) ch.setImageZXC(st.nm, st.ix, dir);
            else if (ch.setImage) ch.setImage(st.nm, st.ix);
        }
        this.restoreCharacterPrimitiveFlags(ch, st.ex);
        // For events, refresh() reapplies page defaults and can overwrite restored runtime flags.
        var isEvent = (typeof Game_Event !== 'undefined') && (ch instanceof Game_Event);
        if (!isEvent && ch.refresh) ch.refresh();
    };

    EE.prototype.playFrom = function(f) {
        this.simTo(f, false);
        this.play = this.controlMode ? !this.manualPause : false;
        this.setPlayBtn();
        if (this.play) this.rebuildSimAudioPlayback(this.frame);
        else this.stopEditorAudioPlayback();
    };
    EE.prototype.seek = function(f) {
        this.simTo(f, false);
        this.play = false;
        this.setPlayBtn();
        this.stopEditorAudioPlayback();
    };


    EE.prototype.simTo = function(f, audible) {
        f = Math.max(0, Math.floor(f || 0));
        audible = !!audible;
        var battleMode = this.isBattleEventMode();
        this._frameExecState = null;
        var cur = (this._simFrame == null || isNaN(this._simFrame)) ? -1 : Math.max(0, Math.floor(Number(this._simFrame || 0)));
        var needFull = !!this._simForceFull || cur < 0 || f < cur || f === 0;
        if (needFull && typeof this.clearExecutionAbortTrackMap === 'function') this.clearExecutionAbortTrackMap();
        else if (!this._eeExecAbortTrackFrameByKey) this._eeExecAbortTrackFrameByKey = Object.create(null);
        var from = 0;
        if (needFull) {
            this.restoreBase();
            if ($gameMap && $gameMap.refreshIfNeeded) $gameMap.refreshIfNeeded();
            // Backward/full seek must not keep one-shot audio state from future frames.
            this.resetSimAudioState();
            this.stopEditorAudioPlayback();
            from = 0;
            this._simForceFull = false;
            this._simFrame = 0;
        } else {
            from = cur;
        }
        this._simToRunning = true;
        this._simExecFrame = -1;
        try {
            for (var i = from; i < f; i++) {
                this._simExecFrame = i;
                this.execAt(i, { forceComplete: true });
                if (battleMode) {
                    if ($gameTimer && $gameTimer.update) $gameTimer.update(true);
                    if ($gameScreen && $gameScreen.update) $gameScreen.update();
                } else {
                    $gameMap.update(true);
                    $gamePlayer.update(true);
                    $gameTimer.update(true);
                    $gameScreen.update();
                }
                this.stepVisualRuntime();
                this.pruneSimAudioState(i + 1);
            }
        } finally {
            this._simToRunning = false;
            this._simExecFrame = -1;
            this._frameExecState = null;
        }
        this.pruneSimAudioState(f);
        if (audible) this.rebuildSimAudioPlayback(f);
        else this.stopEditorAudioPlayback();
        // Seeking should never leave stale message windows open.
        this.clearMessageRuntimeState();
        if (!this.controlMode && $gameMap) {
            var prevRuntimeDisplayX = (this.runtimeDisplayX == null) ? null : Number(this.runtimeDisplayX);
            var prevRuntimeDisplayY = (this.runtimeDisplayY == null) ? null : Number(this.runtimeDisplayY);
            if (f === 0 && this.base) {
                var bx = Number(this.base.mapDisplayX != null ? this.base.mapDisplayX : ($gameMap._displayX == null ? 0 : $gameMap._displayX));
                var by = Number(this.base.mapDisplayY != null ? this.base.mapDisplayY : ($gameMap._displayY == null ? 0 : $gameMap._displayY));
                if ($gameMap.setDisplayPos) $gameMap.setDisplayPos(bx, by);
                $gameMap._displayX = Number($gameMap._displayX == null ? bx : $gameMap._displayX);
                $gameMap._displayY = Number($gameMap._displayY == null ? by : $gameMap._displayY);
            }
            this.runtimeDisplayX = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
            this.runtimeDisplayY = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
            if (this.editorDisplayX == null || this.editorDisplayY == null) {
                this.editorDisplayX = Number(this.runtimeDisplayX);
                this.editorDisplayY = Number(this.runtimeDisplayY);
            } else if (this.gameFramePinned && prevRuntimeDisplayX != null && prevRuntimeDisplayY != null) {
                this.editorDisplayX = Number(this.editorDisplayX) + (Number(this.runtimeDisplayX) - prevRuntimeDisplayX);
                this.editorDisplayY = Number(this.editorDisplayY) + (Number(this.runtimeDisplayY) - prevRuntimeDisplayY);
            }
        }
        this.frame = f;
        this._simFrame = f;
        this.timelineDirty = true;
    };

    EE.prototype.isPlaybackBlocked = function() {
        try {
            if ($gameMessage && typeof $gameMessage.isBusy === 'function' && $gameMessage.isBusy()) return true;
        } catch (e) {}
        return false;
    };

    EE.prototype.key = function(eid, page) { return String(eid) + ':' + String(page); };
    EE.prototype.rebuildSchedule = function(options) {
        options = options || {};
        var modelApi = NS._eeModel;
        if (!modelApi || typeof modelApi.rebuildSchedule !== 'function') {
            throw new Error('Event editor model service is not loaded');
        }
        var self = this;
        var rebuilt = modelApi.rebuildSchedule({
            tracks: this.model && this.model.tracks ? this.model.tracks : {},
            schedule: this.schedule,
            byTrack: this._scheduleEntriesByTrack,
            changedTrackKeys: options.changedTrackKeys,
            normalizeTrack: function(track) {
                if (typeof self.normalizeTrackRowsForCurrentMode === 'function') {
                    self.normalizeTrackRowsForCurrentMode(track);
                }
                if (typeof self.normalizeTrackExecutionMetadata === 'function') {
                    self.normalizeTrackExecutionMetadata(track);
                }
            }
        });
        this.schedule = rebuilt.schedule;
        this._scheduleEntriesByTrack = rebuilt.byTrack;
        this._scheduleRev = (this._scheduleRev + 1) >>> 0;
        var earliest = Number(options.earliestChangedFrame);
        var affectsCurrentFrame = !isFinite(earliest) || earliest <= Math.max(0, Math.floor(Number(this.frame || 0)));
        if (affectsCurrentFrame) {
            this._frameExecState = null;
            this._simForceFull = true;
        }
        this.timelineDirty = true;
    };

    EE.prototype.commitTrackMutation = function(options) {
        options = options || {};
        var keys = Array.isArray(options.trackKeys) ? options.trackKeys.slice(0) : [options.trackKey || this.selKey];
        var changed = [];
        var seen = Object.create(null);
        for (var i = 0; i < keys.length; i++) {
            var key = String(keys[i] || '');
            if (!key || seen[key]) continue;
            seen[key] = true;
            changed.push(key);
            if (options.markDirty !== false) this.dirty[key] = true;
            this._trackRevisionByKey[key] = (Math.floor(Number(this._trackRevisionByKey[key] || 0)) + 1) >>> 0;
            var track = this.model && this.model.tracks ? this.model.tracks[key] : null;
            if (track && typeof this.normalizeTrackExecutionMetadata === 'function') {
                this.normalizeTrackExecutionMetadata(track);
            }
            if (options.sort !== false && track && Array.isArray(track.commands)) {
                var modelApi = NS._eeModel;
                if (!modelApi || typeof modelApi.sortTrackCommands !== 'function') {
                    throw new Error('Event editor model ordering service is not loaded');
                }
                modelApi.sortTrackCommands(track);
            }
        }
        if (options.rebuild !== false) {
            this.rebuildSchedule({
                changedTrackKeys: changed,
                earliestChangedFrame: options.earliestChangedFrame,
                skipRouteNormalize: !!options.skipRouteNormalize
            });
        }
        this.timelineDirty = true;
        return changed;
    };
    EE.prototype.sortedEntriesAtFrame = function(f) {
        var ls = this.schedule[f];
        if (!ls || !ls.length) return [];
        var out = ls.slice(0);
        var modelApi = NS._eeModel;
        if (!modelApi || typeof modelApi.compareEntriesByFrameExecutionOrder !== 'function') {
            throw new Error('Event editor model ordering service is not loaded');
        }
        out.sort(modelApi.compareEntriesByFrameExecutionOrder);
        return out;
    };
    EE.prototype.execAt = function(f, opt) {
        opt = opt || {};
        var forceComplete = !!opt.forceComplete;
        var sf = Math.max(0, Math.floor(Number(f || 0)));
        var ls = this.sortedEntriesAtFrame(sf);
        if (!ls.length) {
            if (!forceComplete && this._frameExecState && this._frameExecState.frame === sf) {
                this._frameExecState = null;
            }
            return true;
        }

        if (forceComplete) {
            for (var fi = 0; fi < ls.length; fi++) {
                this.execEntry(ls[fi]);
                if (this.isPlaybackBlocked()) this.clearMessageRuntimeState();
            }
            return true;
        }

        var st = this._frameExecState;
        if (!st || st.frame !== sf || st.rev !== this._scheduleRev) {
            st = {
                frame: sf,
                index: 0,
                list: ls,
                rev: this._scheduleRev
            };
            this._frameExecState = st;
        }

        while (st.index < st.list.length) {
            if (this.isPlaybackBlocked()) return false;
            this.execEntry(st.list[st.index]);
            st.index++;
            if (this.isPlaybackBlocked()) return false;
        }

        this._frameExecState = null;
        return true;
    };

    EE.prototype.historySnapshotModel = function() {
        var modelApi = NS._eeModel;
        if (!modelApi || typeof modelApi.snapshotModel !== 'function') {
            throw new Error('Event editor model service is not loaded');
        }
        var result = modelApi.snapshotModel(this.model, this._historyTrackSnapshotCache || {});
        this._historyTrackSnapshotCache = result.cache;
        return result.model;
    };

    EE.prototype.snap = function(label) {
        var documentEvents = {};
        var trackedEventIds = Object.keys(this._documentUndoEventIds || {});
        for (var i = 0; i < trackedEventIds.length; i++) {
            var eventId = Math.max(0, Math.floor(Number(trackedEventIds[i] || 0)));
            documentEvents[eventId] = ($dataMap && Array.isArray($dataMap.events) && $dataMap.events[eventId])
                ? clone($dataMap.events[eventId])
                : null;
        }
        var documentTroops = {};
        var trackedTroopIds = Object.keys(this._documentUndoTroopIds || {});
        for (var j = 0; j < trackedTroopIds.length; j++) {
            var troopId = Math.max(0, Math.floor(Number(trackedTroopIds[j] || 0)));
            documentTroops[troopId] = ($dataTroops && Array.isArray($dataTroops) && $dataTroops[troopId])
                ? clone($dataTroops[troopId])
                : null;
        }
        return {
            label: label || '',
            model: this.historySnapshotModel(),
            dirty: clone(this.dirty),
            documentDirty: clone(this.documentDirty || { events: {}, troops: {} }),
            documentEvents: documentEvents,
            documentTroops: documentTroops,
            selEid: this.selEid,
            selPage: this.selPage,
            selKey: this.selKey,
            selUid: this.selUid,
            selRouteListIndex: this.selRouteListIndex == null ? -1 : Number(this.selRouteListIndex),
            frame: this.frame
        };
    };
    EE.prototype.snapSig = function(s) {
        if (!s) return '';
        if (typeof s._sig === 'string' && s._sig.length) return s._sig;
        var obj = {
            model: s.model || {},
            dirty: s.dirty || {},
            documentDirty: s.documentDirty || {},
            documentEvents: s.documentEvents || {},
            documentTroops: s.documentTroops || {}
        };
        try { s._sig = snapshotTextFingerprint(JSON.stringify(obj)); } catch (_) { s._sig = ''; }
        return s._sig;
    };
    EE.prototype.isSameSnap = function(a, b) {
        if (!a || !b) return false;
        return this.snapSig(a) === this.snapSig(b);
    };
    EE.prototype.pushSnap = function(label) {
        var s = this.snap(label);
        var modelApi = NS._eeModel;
        if (!modelApi || typeof modelApi.pushHistorySnapshot !== 'function') {
            throw new Error('Event editor history service is not loaded');
        }
        var self = this;
        modelApi.pushHistorySnapshot({
            undo: this.undoS,
            redo: this.redoS,
            snapshot: s,
            equals: function(a, b) { return self.isSameSnap(a, b); },
            limit: 80
        });
    };
    EE.prototype.loadSnap = function(s) {
        if (!s) return;
        this.model = clone(s.model); this.dirty = clone(s.dirty || {});
        this._scheduleEntriesByTrack = null;
        this._trackRevisionByKey = {};
        this.documentDirty = clone(s.documentDirty || { events: {}, troops: {} });
        var documentEvents = s.documentEvents || {};
        var eventIds = Object.keys(documentEvents);
        for (var i = 0; i < eventIds.length; i++) {
            var eventId = Math.max(0, Math.floor(Number(eventIds[i] || 0)));
            if (!$dataMap || !Array.isArray($dataMap.events)) continue;
            $dataMap.events[eventId] = documentEvents[eventIds[i]] == null
                ? null
                : clone(documentEvents[eventIds[i]]);
            if (typeof this.refreshDocumentEventRuntime === 'function') this.refreshDocumentEventRuntime(eventId);
        }
        var documentTroops = s.documentTroops || {};
        var troopIds = Object.keys(documentTroops);
        for (var j = 0; j < troopIds.length; j++) {
            var troopId = Math.max(0, Math.floor(Number(troopIds[j] || 0)));
            if (!$dataTroops || !Array.isArray($dataTroops)) continue;
            $dataTroops[troopId] = documentTroops[troopIds[j]] == null
                ? null
                : clone(documentTroops[troopIds[j]]);
        }
        this.selEid = s.selEid || 0; this.selPage = (s.selPage === undefined ? -1 : s.selPage); this.selKey = s.selKey || ''; this.selUid = s.selUid || 0;
        this.selRouteListIndex = (s.selRouteListIndex == null) ? -1 : Number(s.selRouteListIndex);
        this.frame = Math.max(0, s.frame || 0);
        this.rebuildSchedule(); this.simTo(this.frame); this.refreshEventInfo();
    };
    EE.prototype.undo = function() {
        // Many edits store "pre-change" snapshots. Ensure current state is on top
        // so one undo always rolls back exactly one user operation.
        var cur = this.snap('current');
        var last = this.undoS.length ? this.undoS[this.undoS.length - 1] : null;
        if (!last || !this.isSameSnap(last, cur)) {
            this.undoS.push(cur);
            if (this.undoS.length > 80) this.undoS.shift();
        }
        if (this.undoS.length <= 1) return;
        this.redoS.push(this.undoS.pop());
        this.loadSnap(this.undoS[this.undoS.length - 1]);
        this.msg('元に戻しました');
    };
    EE.prototype.redo = function() {
        if (!this.redoS.length) return;
        var s = this.redoS.pop();
        this.undoS.push(s);
        if (this.undoS.length > 80) this.undoS.shift();
        this.loadSnap(s);
        this.msg('やり直しました');
    };

    EE.prototype.needSelTrack = function() {
        if (!this.selEid || this.selPage < 0) { this.err('E_NO_SELECTED_EVENT', new Error('イベントを選択してください')); return false; }
        return true;
    };
    EE.prototype.delSel = function() {
        if (!this.selKey || !this.selUid) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr) return;
        var earliestChangedFrame = 0;
        for (var fi = 0; fi < tr.commands.length; fi++) {
            if (Number(tr.commands[fi] && tr.commands[fi].uid || 0) === Number(this.selUid || 0)) {
                earliestChangedFrame = Math.max(0, Math.floor(Number(tr.commands[fi].frame || 0)));
                break;
            }
        }
        this.pushSnap('del');
        var done = false;
        if (this.selRouteListIndex != null && this.selRouteListIndex >= 0) {
            for (var i = 0; i < tr.commands.length; i++) {
                var e = tr.commands[i];
                if (!e || e.uid !== this.selUid) continue;
                if (!e.command || Number(e.command.code || 0) !== 205) break;
                var route = e.command.parameters && e.command.parameters[1];
                var list = route && Array.isArray(route.list) ? route.list : null;
                if (!list) break;
                var idx = Number(this.selRouteListIndex);
                if (idx < 0 || idx >= list.length) break;
                if (Number((list[idx] || {}).code || 0) === 0) break;
                list.splice(idx, 1);
                if (!list.length || Number(list[list.length - 1].code || 0) !== 0) list.push({ code: 0, parameters: [] });
                e.wait = this.commandWaitFrames(e.command);
                done = true;
                break;
            }
        }
        if (!done) {
            var deleteUidMap = null;
            var selectedEntry = null;
            for (var si = 0; si < tr.commands.length; si++) {
                if (Number(tr.commands[si] && tr.commands[si].uid || 0) === Number(this.selUid || 0)) {
                    selectedEntry = tr.commands[si];
                    break;
                }
            }
            if (selectedEntry && selectedEntry.command && Number(selectedEntry.command.code || 0) === 102 &&
                typeof this.captureChoiceBranchStructure === 'function') {
                var choiceStructure = this.captureChoiceBranchStructure(tr, selectedEntry);
                if (choiceStructure && choiceStructure.valid) {
                    deleteUidMap = Object.create(null);
                    deleteUidMap[String(Math.floor(Number(selectedEntry.uid || 0)))] = true;
                    var choiceSegments = Array.isArray(choiceStructure.segments) ? choiceStructure.segments : [];
                    for (var cs = 0; cs < choiceSegments.length; cs++) {
                        var segment = choiceSegments[cs];
                        if (!segment) continue;
                        if (segment.marker) deleteUidMap[String(Math.floor(Number(segment.marker.uid || 0)))] = true;
                        var segmentEntries = Array.isArray(segment.entries) ? segment.entries : [];
                        for (var ce = 0; ce < segmentEntries.length; ce++) {
                            deleteUidMap[String(Math.floor(Number(segmentEntries[ce] && segmentEntries[ce].uid || 0)))] = true;
                        }
                    }
                    if (choiceStructure.endEntry) {
                        deleteUidMap[String(Math.floor(Number(choiceStructure.endEntry.uid || 0)))] = true;
                    }
                }
            }
            tr.commands = tr.commands.filter(function(e) {
                if (deleteUidMap) return !deleteUidMap[String(Math.floor(Number(e && e.uid || 0)))];
                return e.uid !== this.selUid;
            }, this);
        }
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.commitTrackMutation({ earliestChangedFrame: earliestChangedFrame });
        this.playFrom(this.frame);
    };
    EE.prototype.copy = function() {
        if (!this.selKey || !this.selUid) return;
        var tr = this.model.tracks[this.selKey];
        for (var i = 0; i < tr.commands.length; i++) if (tr.commands[i].uid === this.selUid) { this.clip = clone(tr.commands[i].command); this.msg('コピーしました'); return; }
    };
    EE.prototype.cut = function() { this.copy(); this.delSel(); this.msg('切り取りました'); };
    EE.prototype.paste = function() { if (!this.clip) return; this.addCmd(clone(this.clip), this.frame); this.msg('貼り付けました'); };

    EE.prototype.beginTileMove = function() {
        if (!this.needSelTrack()) return;
        this.dragMode = 'tile'; this.dragging = false; this.dragEid = this.selEid; this.dragPos = null;
        this.msg('タイル移動モード: マップ上で対象イベントをドラッグ');
    };

    EE.prototype.selectInitial = function() {
        var battleMode = this.isBattleEventMode();
        // On runtime Ctrl+R startup, select only interpreter owner event (if running).
        // If no running interpreter owner exists, keep selection empty.
        if (NS._runtimeStartPending) {
            var runtimeEventId = Math.max(0, Math.floor(Number(NS._runtimeStartEventId || 0)));
            var runtimePageIndex = Math.max(-1, Math.floor(Number(NS._runtimeStartPageIndex == null ? -1 : NS._runtimeStartPageIndex)));
            var runtimeMode = String(NS._runtimeStartMode || 'map');
            NS._runtimeStartPending = false;
            NS._runtimeStartEventId = 0;
            NS._runtimeStartPageIndex = -1;
            NS._runtimeStartMode = 'map';
            if (battleMode || runtimeMode === 'battle') {
                var battleTroopId = Math.max(1, runtimeEventId || this.currentBattleTroopId());
                var battleTroop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[battleTroopId] : null;
                var battlePages = battleTroop && Array.isArray(battleTroop.pages) ? battleTroop.pages : [];
                if (battlePages.length) {
                    var pi = (runtimePageIndex >= 0) ? runtimePageIndex : 0;
                    this.selectBattleTrack(battleTroopId, pi);
                }
                return;
            }
            if (runtimeEventId > 0 && $gameMap && $gameMap.event(runtimeEventId)) {
                this.selectEvent(runtimeEventId);
                if (this.selEid === runtimeEventId && runtimePageIndex >= 0) {
                    var page = this.trackPageSourceData(runtimeEventId, runtimePageIndex);
                    if (page) {
                        var targetKey = this.key(runtimeEventId, runtimePageIndex);
                        if (this.selPage !== runtimePageIndex || String(this.selKey || '') !== String(targetKey)) {
                            this.selPage = runtimePageIndex;
                            this.selKey = targetKey;
                            this.ensureTrack(runtimeEventId, runtimePageIndex);
                            this.queueTimelineViewRestoreForTrack(runtimeEventId, runtimePageIndex);
                            this.selUid = 0;
                            this.selRouteListIndex = -1;
                            this.panelSelectedCharId = Number(runtimeEventId || 0);
                            this.refreshEventInfo();
                            this.rebuildSchedule({ skipRouteNormalize: true });
                            this.timelineDirty = true;
                            this.refreshCharacterPanel(true);
                            this.refreshSelectedCharacterInfo(true);
                            this.refreshCharacterOverlay(true);
                        }
                    }
                }
            }
            return;
        }

        if (battleMode) {
            var troopId = this.currentBattleTroopId();
            var troop = this.currentBattleTroopData();
            var pages = troop && Array.isArray(troop.pages) ? troop.pages : [];
            if (troopId > 0 && pages.length) {
                this.selectBattleTrack(troopId, Math.max(0, this.selPage));
            } else {
                this.refreshEventInfo();
            }
            return;
        }

        // If startup was delayed while timeline extension loaded, honor the interpreter owner
        // captured during the wait period before falling back to nearby events.
        var deferredEventId = Math.max(0, Math.floor(Number(NS._bootDeferredOwnerEventId || 0)));
        var deferredPageIndex = Math.max(-1, Math.floor(Number(NS._bootDeferredOwnerPageIndex == null ? -1 : NS._bootDeferredOwnerPageIndex)));
        NS._bootDeferredOwnerEventId = 0;
        NS._bootDeferredOwnerPageIndex = -1;
        if (deferredEventId > 0 && $gameMap && $gameMap.event(deferredEventId)) {
            this.selectEvent(deferredEventId);
            if (this.selEid === deferredEventId && deferredPageIndex >= 0) {
                var deferredPage = this.trackPageSourceData(deferredEventId, deferredPageIndex);
                if (deferredPage) {
                    var deferredKey = this.key(deferredEventId, deferredPageIndex);
                    if (this.selPage !== deferredPageIndex || String(this.selKey || '') !== String(deferredKey)) {
                        this.selPage = deferredPageIndex;
                        this.selKey = deferredKey;
                        this.ensureTrack(deferredEventId, deferredPageIndex);
                        this.queueTimelineViewRestoreForTrack(deferredEventId, deferredPageIndex);
                        this.selUid = 0;
                        this.selRouteListIndex = -1;
                        this.panelSelectedCharId = Number(deferredEventId || 0);
                        this.refreshEventInfo();
                        this.rebuildSchedule({ skipRouteNormalize: true });
                        this.timelineDirty = true;
                        this.refreshCharacterPanel(true);
                        this.refreshSelectedCharacterInfo(true);
                        this.refreshCharacterOverlay(true);
                    }
                }
            }
            return;
        }

        // On testload startup, prefer the interpreter owner event as initial selection.
        if (NS._initialTestLoadDone) {
            var pickedEventId = 0;
            var tr = window.TestReload;
            var itp = null;
            if (tr && typeof tr._getActiveInterpreter === 'function') {
                try { itp = tr._getActiveInterpreter(); } catch (_) { itp = null; }
            }
            if (!itp && $gameMap && $gameMap._interpreter) itp = $gameMap._interpreter;
            var interpreterEventId = Math.max(0, Math.floor(Number(itp && itp._eventId || 0)));
            if (interpreterEventId > 0 && $gameMap.event(interpreterEventId)) {
                pickedEventId = interpreterEventId;
            } else {
                var metaEventId = Math.max(0, Math.floor(Number(NS._initialSelectEventId || 0)));
                if (metaEventId > 0 && $gameMap.event(metaEventId)) pickedEventId = metaEventId;
            }
            NS._initialSelectEventId = 0;
            if (pickedEventId > 0) {
                this.selectEvent(pickedEventId);
                return;
            }
        }

        var ev = null, at = $gameMap.eventsXy($gamePlayer.x, $gamePlayer.y);
        if (at && at.length) ev = at[0];
        if (!ev) { var es = $gameMap.events(); if (es.length) ev = es[0]; }
        if (ev) this.selectEvent(ev.eventId(), true);
    };
    EE.prototype.refreshEventInfo = function() {
        if (!this.eventInfo) return;
        if (this.isBattleEventMode()) {
            var troopId = Math.max(0, Math.floor(Number(this.selEid || this.currentBattleTroopId() || 0)));
            if (troopId <= 0) { this.eventInfo.textContent = '戦闘イベント未選択'; return; }
            var troop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[troopId] : null;
            var pages = troop && Array.isArray(troop.pages) ? troop.pages : null;
            if (!troop || !pages || !pages.length) {
                this.eventInfo.textContent = 'Troop ' + troopId + ' / ページなし';
                return;
            }
            var pi = Math.max(0, Math.min(pages.length - 1, Math.floor(Number(this.selPage || 0))));
            var page = pages[pi] || {};
            var cond = (page.conditions && typeof page.conditions === 'object') ? page.conditions : {};
            this.eventInfo.textContent =
                'Troop: ' + troopId +
                ' / 名前: ' + String(troop.name || '(名前なし)') +
                ' / ページ: ' + String(pi + 1) + '/' + String(pages.length) +
                ' / Span: ' + String(Math.max(0, Math.floor(Number(page.span || 0)))) +
                ' / 条件: ' + this.battleConditionSummary(cond);
            return;
        }
        if (!this.selEid) { this.eventInfo.textContent = 'イベント未選択'; return; }
        var ev = $gameMap.event(this.selEid), ed = ev && ev.event ? ev.event() : null;
        if (!ev) { this.eventInfo.textContent = 'イベント未選択'; return; }
        this.eventInfo.textContent = 'ID: ' + this.selEid +
            ' / 名前: ' + ((ed && ed.name) ? ed.name : '(名前なし)') +
            ' / ページ: ' + this.selPage;
    };

    EE.prototype.updateTileDrag = function() {
        var ev = $gameMap.event(this.dragEid);
        if (!ev) { this.dragMode = ''; return; }
        if (!this.dragging && TouchInput.isTriggered()) {
            var p = this.pickEvent(TouchInput.x, TouchInput.y);
            if (p && p.eventId() === this.dragEid) this.dragging = true;
        }
        if (this.dragging && TouchInput.isPressed()) {
            var pos = this.screenToMap(TouchInput.x, TouchInput.y, Input.isPressed('alt'));
            if (pos) {
                this.dragPos = pos;
                if (ev.locateTo) ev.locateTo(pos.x, pos.y); else if (ev.locate) ev.locate(Math.round(pos.x), Math.round(pos.y));
                this.refreshEventInfo();
            }
        }
        if (this.dragging && TouchInput.isReleased()) {
            this.dragging = false; this.dragMode = '';
            if (this.dragPos) {
                this.pushSnap('tileMove');
                this.addCmd(this.makeMoveScriptCmd('this.goTo(' + this.dragPos.x + ', ' + this.dragPos.y + ');'), this.frame);
                this.msg('タイル移動追加: (' + this.dragPos.x + ', ' + this.dragPos.y + ')');
            }
        }
    };
    EE.prototype.pickEvent = function(sx, sy) {
        var ss = this.s && this.s._spriteset;
        if (!ss || !ss._characterSprites) return null;
        var ls = ss._characterSprites;
        for (var i = ls.length - 1; i >= 0; i--) {
            var sp = ls[i];
            if (!sp || !sp.visible || !sp._character || !(sp._character instanceof Game_Event)) continue;
            var b = this.characterSpriteCanvasBounds ? this.characterSpriteCanvasBounds(sp, sp._character) :
                (sp.getBounds ? sp.getBounds() : null);
            if (!b) continue;
            if (sx >= b.x && sx <= b.x + b.width && sy >= b.y && sy <= b.y + b.height) return sp._character;
        }
        return null;
    };
    EE.prototype.localizeEditorDisplayText = function(t) {
        var s = String(t == null ? '' : t);
        if (!s.length) return s;
        if (!NS._eeLocalizeTextCache || typeof NS._eeLocalizeTextCache !== 'object') {
            NS._eeLocalizeTextCache = Object.create(null);
            NS._eeLocalizeTextCacheSize = 0;
        }
        var cache = NS._eeLocalizeTextCache;
        if (Object.prototype.hasOwnProperty.call(cache, s)) return cache[s];

        var out = s;
        for (var i = 0; i < EE_LOCALIZE_REPS.length; i++) out = out.replace(EE_LOCALIZE_REPS[i][0], EE_LOCALIZE_REPS[i][1]);
        out = out.replace(/\bCopy\b/g, 'コピー');
        out = out.replace(/\bCut\b/g, '切り取り');
        out = out.replace(/\bPaste\b/g, '貼り付け');
        out = out.replace(/\bTileMove\b/g, 'タイル移動');

        cache[s] = out;
        NS._eeLocalizeTextCacheSize = Math.max(0, Math.floor(Number(NS._eeLocalizeTextCacheSize || 0))) + 1;
        if (NS._eeLocalizeTextCacheSize > EE_LOCALIZE_CACHE_MAX) {
            NS._eeLocalizeTextCache = Object.create(null);
            NS._eeLocalizeTextCacheSize = 0;
        }
        return out;
    };

    EE.prototype.msg = function(t) {
        if (!this.status) return;
        var text = this.localizeEditorDisplayText(t);
        this.status.classList.remove('err'); this.status.classList.add('ok'); this.status.textContent = text;
        if (isPlaytest()) console.log('[EventEditor]', text);
    };
    EE.prototype.popupError = function(t) {
        if (!$gameScreen) return;
        var text = '[EE-ERR] ' + this.localizeEditorDisplayText(t);
        try {
            if ($gameScreen.popupSystemText) {
                $gameScreen.popupSystemText(text, 24);
                return;
            }
            if ($gameScreen.addSmallMessage) {
                $gameScreen.addSmallMessage(text, Graphics.boxWidth / 2, Math.floor(Graphics.boxHeight * 0.72), 180, 560);
            }
        } catch (_) {}
    };
    EE.prototype.err = function(code, e) {
        var t = code + (e ? ' : ' + this.localizeEditorDisplayText(String(e.message || e)) : '');
        if (this.status) { this.status.classList.remove('ok'); this.status.classList.add('err'); this.status.textContent = t; }
        console.error('[EventEditor][' + code + ']', e || '');
        this.popupError(t);
    };
    EE.prototype.fatal = function(code, e) {
        var t = code + (e ? ' : ' + this.localizeEditorDisplayText(String(e.message || e)) : '');
        if (this.status) { this.status.classList.remove('ok'); this.status.classList.add('err'); this.status.textContent = t; }
        console.error('[EventEditor][FATAL][' + code + ']', e || '');
        NS.raiseFatalError(code, '', e);
    };

    EE.prototype.saveTraceHash = function(text) {
        return hashText32(text);
    };

    EE.prototype.eeFileLogPath = function(name) {
        var path;
        try { path = require('path'); } catch (_) { return ''; }
        var key = String(name == null ? '' : name).trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
        if (!key) key = 'GENERIC';
        return path.join(process.cwd(), 'data', '_event_editor', 'logs', 'Log_' + key + '.text');
    };

    EE.prototype.eeAppendFileLog = function(name, payload) {
        if (!this.isCalcDebugEnabled || !this.isCalcDebugEnabled()) return;
        var fs, path;
        try { fs = require('fs'); path = require('path'); } catch (_) { return; }
        var filePath = this.eeFileLogPath(name);
        if (!filePath) return;
        try {
            ensureDir(path.dirname(filePath));
            if (!this._eeFileLogInit || typeof this._eeFileLogInit !== 'object') {
                this._eeFileLogInit = Object.create(null);
            }
            var key = String(name == null ? '' : name).trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_') || 'GENERIC';
            if (!this._eeFileLogInit[key]) {
                fs.writeFileSync(filePath, '', 'utf8');
                this._eeFileLogInit[key] = true;
            }
            var line = '';
            if (typeof payload === 'string') line = payload;
            else {
                try { line = JSON.stringify(payload); } catch (_) { line = String(payload); }
            }
            fs.appendFileSync(filePath, line + '\n', 'utf8');
        } catch (_) {}
    };

    EE.prototype.debugParseTrackFromEventList = function(eid, page, list, endFrameFallback) {
        if (typeof this.entryFromCommand !== 'function') return null;
        var tr = {
            eventId: Math.floor(Number(eid || 0)),
            pageIndex: Math.floor(Number(page || 0)),
            commands: [],
            extraCharRows: [],
            tempCharRows: [],
            endFrame: 0,
            _eeV2: true
        };
        list = Array.isArray(list) ? list : [];
        var f = 0;
        var uid = Math.max(1, Math.floor(Number(this.model && this.model.nextUid || 1)));
        var oldParseMode = !!this._eeTrackParseMode;
        this._eeTrackParseMode = true;
        try {
            for (var i = 0; i < list.length; i++) {
                var cmd = list[i];
                if (!cmd || cmd.code === 0) continue;
                if (cmd.code === 230) {
                    f += Math.max(0, Math.floor(Number((cmd.parameters || [0])[0] || 0)));
                    continue;
                }
                if (cmd.code === 408 || cmd.code === 505 || cmd.code === 401 || cmd.code === 405) continue;
                if (cmd.code === 108) {
                    var debugCommentHead = String((cmd.parameters || [''])[0] || '');
                    if (typeof this.eventSettingsDecodeScriptConditionComment === 'function' &&
                        this.eventSettingsDecodeScriptConditionComment(debugCommentHead) != null) {
                        while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 408) i++;
                        continue;
                    }
                    var ce = this.entryFromCommand(cmd, eid, page, f, uid++);
                    ce.commentLines = [String((cmd.parameters || [''])[0] || '')];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 408) {
                        i++;
                        ce.commentLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    if (typeof this.memoApplyParsedStateToEntry === 'function') this.memoApplyParsedStateToEntry(ce);
                    if (ce.isMemo && typeof this.memoCommentLine === 'function') ce.commentLines = [this.memoCommentLine(ce.memoSize, ce.memoText)];
                    ce.command.parameters = [ce.commentLines[0] || ''];
                    tr.commands.push(ce);
                    continue;
                }
                if (cmd.code === 101) {
                    var me = this.entryFromCommand(cmd, eid, page, f, uid++);
                    me.isMessage = true;
                    me.messageLines = [];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 401) {
                        i++;
                        me.messageLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    tr.commands.push(me);
                    continue;
                }
                if (cmd.code === 355) {
                    var se = this.entryFromCommand(cmd, eid, page, f, uid++);
                    se.isScript = true;
                    se.scriptLines = [String((cmd.parameters || [''])[0] || '')];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 655) {
                        i++;
                        se.scriptLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    se.command.parameters = [String(se.scriptLines[0] || '')];
                    tr.commands.push(se);
                    continue;
                }
                if (cmd.code === 655) {
                    var scmd = { code: 355, indent: Number(cmd.indent || 0), parameters: [String((cmd.parameters || [''])[0] || '')] };
                    var sfe = this.entryFromCommand(scmd, eid, page, f, uid++);
                    sfe.isScript = true;
                    sfe.scriptLines = [String((scmd.parameters || [''])[0] || '')];
                    tr.commands.push(sfe);
                    continue;
                }
                if (cmd.code === 105) {
                    var sce = this.entryFromCommand(cmd, eid, page, f, uid++);
                    sce.isScrollMessage = true;
                    sce.scrollLines = [];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 405) {
                        i++;
                        sce.scrollLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    tr.commands.push(sce);
                    continue;
                }
                var e = this.entryFromCommand(cmd, eid, page, f, uid++);
                if (!e) continue;
                tr.commands.push(e);
                f += Math.max(0, Math.floor(Number(e.wait || 0)));
            }
        } finally {
            this._eeTrackParseMode = oldParseMode;
        }
        var ef = Math.max(0, Math.floor(Number(endFrameFallback || 0)));
        if (f > ef) ef = f;
        tr.endFrame = ef;
        tr.commands.sort(function(a, b) {
            var af = Math.max(0, Math.floor(Number(a && a.frame || 0)));
            var bf = Math.max(0, Math.floor(Number(b && b.frame || 0)));
            if (af !== bf) return af - bf;
            var aw = Math.max(0, Math.floor(Number(a && a.wait || 0))) > 0 ? 1 : 0;
            var bw = Math.max(0, Math.floor(Number(b && b.wait || 0))) > 0 ? 1 : 0;
            if (aw !== bw) return aw - bw;
            return Math.floor(Number(a && a.uid || 0)) - Math.floor(Number(b && b.uid || 0));
        });
        return tr;
    };

    EE.prototype.eePropRefTargetEventId = function() {
        var n = Number(this._eeCalcDebugEventId);
        if (isFinite(n) && n > 0) return Math.floor(n);
        return 14;
    };

    EE.prototype.eePropRefFilePath = function(dataDir, mapFile) {
        var fs, path;
        try { fs = require('fs'); path = require('path'); } catch (_) { return ''; }
        try {
            var mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? Number($gameMap.mapId() || 0) : 0;
            var mf = String(mapFile || ('Map' + p3(mapId) + '.json'));
            var dd = String(dataDir || path.join(process.cwd(), 'data'));
            return path.join(dd, '_event_editor', mf.replace('.json', '.ee_prop_ref.json'));
        } catch (_) {}
        return '';
    };

    EE.prototype.eePropRefCaptureEventSnapshot = function(eventId, frame, sourceRows) {
        if (!$gameMap || typeof $gameMap.event !== 'function') return null;
        var target = $gameMap.event(Math.floor(Number(eventId || 0)));
        if (!target) return null;
        var flags = {};
        try { flags = this.captureCharacterPrimitiveFlags(target); } catch (_) { flags = {}; }
        var json = '';
        try { json = JSON.stringify(flags); } catch (_) { json = ''; }
        var dir = 2;
        try { dir = (typeof target.direction === 'function') ? Number(target.direction() || 2) : Number(target._direction || 2); } catch (_) { dir = 2; }
        return {
            frame: Math.max(0, Math.floor(Number(frame || 0))),
            eventId: Math.floor(Number(eventId || 0)),
            x: Number(target.x == null ? target._x : target.x),
            y: Number(target.y == null ? target._y : target.y),
            realX: Number(target._realX == null ? (target.x == null ? 0 : target.x) : target._realX),
            realY: Number(target._realY == null ? (target.y == null ? 0 : target.y) : target._realY),
            dir: dir,
            hash: this.saveTraceHash(json),
            primitiveFlags: flags,
            sourceRows: Array.isArray(sourceRows) ? clone(sourceRows) : []
        };
    };

    EE.prototype.eePropRefCollectFrameSourceRows = function(trackKeys, frame) {
        var out = [];
        var ks = Array.isArray(trackKeys) ? trackKeys : [];
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < ks.length; i++) {
            var key = String(ks[i] || '');
            if (!key) continue;
            var tr = this.model && this.model.tracks ? this.model.tracks[key] : null;
            if (!tr || !Array.isArray(tr.commands)) continue;
            for (var j = 0; j < tr.commands.length; j++) {
                var e = tr.commands[j];
                if (!e) continue;
                if (Math.max(0, Math.floor(Number(e.frame || 0))) !== frame) continue;
                var cmd = e.command || {};
                out.push({
                    key: key,
                    eventId: Math.floor(Number(e.eventId || tr.eventId || 0)),
                    pageIndex: Math.floor(Number(e.pageIndex || tr.pageIndex || 0)),
                    uid: Math.floor(Number(e.uid || 0)),
                    rowType: String(e.rowType || ''),
                    rowKey: String(e.rowKey || ''),
                    charId: (e.charId == null) ? null : Math.floor(Number(e.charId || 0)),
                    code: Math.floor(Number(cmd.code || 0)),
                    wait: Math.max(0, Math.floor(Number(e.wait || 0)))
                });
            }
        }
        return out;
    };

    EE.prototype.eePropRefBuildProbeFrames = function(trackKeys) {
        var map = Object.create(null);
        map['0'] = true;
        var ks = Array.isArray(trackKeys) ? trackKeys : [];
        for (var i = 0; i < ks.length; i++) {
            var key = String(ks[i] || '');
            if (!key) continue;
            var tr = this.model && this.model.tracks ? this.model.tracks[key] : null;
            if (!tr || !Array.isArray(tr.commands)) continue;
            for (var j = 0; j < tr.commands.length; j++) {
                var e = tr.commands[j];
                if (!e) continue;
                var f = Math.max(0, Math.floor(Number(e.frame || 0)));
                map[String(f)] = true;
            }
        }
        var cur = Math.max(0, Math.floor(Number(this.frame || 0)));
        map[String(cur)] = true;
        return Object.keys(map).map(function(v) { return Math.max(0, Math.floor(Number(v || 0))); }).sort(function(a, b) { return a - b; });
    };

    EE.prototype.eePropRefBuildRecord = function(trackKeys) {
        var targetEventId = this.eePropRefTargetEventId();
        var frames = this.eePropRefBuildProbeFrames(trackKeys);
        var record = {
            plugin: PLUGIN_NAME,
            mapId: ($gameMap && typeof $gameMap.mapId === 'function') ? Math.floor(Number($gameMap.mapId() || 0)) : 0,
            targetEventId: targetEventId,
            savedAt: new Date().toISOString(),
            frameCount: frames.length,
            frames: []
        };
        if (!frames.length || typeof this.simTo !== 'function') return record;
        var restoreFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        var restorePlay = !!this.play;
        try {
            for (var i = 0; i < frames.length; i++) {
                var f = Math.max(0, Math.floor(Number(frames[i] || 0)));
                this.simTo(f, false);
                var rows = this.eePropRefCollectFrameSourceRows(trackKeys, f);
                var snap = this.eePropRefCaptureEventSnapshot(targetEventId, f, rows);
                if (!snap) continue;
                record.frames.push(snap);
            }
        } finally {
            this.simTo(restoreFrame, false);
            this.play = restorePlay;
            this.setPlayBtn();
            if (restorePlay) this.rebuildSimAudioPlayback(this.frame);
            else this.stopEditorAudioPlayback();
        }
        return record;
    };

    EE.prototype.eePropRefBuildFrameIndex = function(record) {
        var idx = Object.create(null);
        var rs = record && Array.isArray(record.frames) ? record.frames : [];
        for (var i = 0; i < rs.length; i++) {
            var r = rs[i];
            if (!r) continue;
            var f = Math.max(0, Math.floor(Number(r.frame || 0)));
            idx[String(f)] = r;
        }
        return idx;
    };

    EE.prototype.writeEePropReferenceDebug = function(dataDir, mapFile, trackKeys) {
        if (!this.isCalcDebugEnabled || !this.isCalcDebugEnabled()) return;
        var fs, path;
        try { fs = require('fs'); path = require('path'); } catch (_) { return; }
        var filePath = this.eePropRefFilePath(dataDir, mapFile);
        if (!filePath) return;
        try {
            ensureDir(path.dirname(filePath));
            var record = this.eePropRefBuildRecord(trackKeys);
            record._frameIndex = this.eePropRefBuildFrameIndex(record);
            var out = clone(record);
            if (out && Object.prototype.hasOwnProperty.call(out, '_frameIndex')) delete out._frameIndex;
            this.writeJsonFileAtomic(filePath, out, 2);
            this._eePropRefDebug = record;
            if (isPlaytest()) {
                var savePayload = {
                    mapId: record.mapId,
                    targetEventId: record.targetEventId,
                    frameCount: record.frameCount,
                    file: filePath
                };
                this.eeAppendFileLog('SAVE', savePayload);
                var rows = Array.isArray(record.frames) ? record.frames : [];
                for (var i = 0; i < rows.length; i++) {
                    var r = rows[i];
                    if (!r) continue;
                    var rowPayload = {
                        frame: Math.max(0, Math.floor(Number(r.frame || 0))),
                        hash: String(r.hash || ''),
                        x: Number(r.x),
                        y: Number(r.y),
                        realX: Number(r.realX),
                        realY: Number(r.realY),
                        dir: Number(r.dir || 2),
                        sourceRows: Array.isArray(r.sourceRows) ? r.sourceRows : []
                    };
                    this.eeAppendFileLog('SAVE_FRAME', rowPayload);
                }
            }
        } catch (e) {
            this.err('E_EE_PROP_REF_SAVE', e);
        }
    };

    EE.prototype.loadEePropReferenceDebug = function(dataDir, mapFile) {
        if (!this.isCalcDebugEnabled || !this.isCalcDebugEnabled()) {
            this._eePropRefDebug = null;
            return null;
        }
        var fs;
        try { fs = require('fs'); } catch (_) { return null; }
        var filePath = this.eePropRefFilePath(dataDir, mapFile);
        if (!filePath || !fs.existsSync(filePath)) {
            this._eePropRefDebug = null;
            return null;
        }
        try {
            var raw = fs.readFileSync(filePath, 'utf8');
            var obj = JSON.parse(raw);
            if (!obj || typeof obj !== 'object') throw new Error('invalid reference json');
            obj._frameIndex = this.eePropRefBuildFrameIndex(obj);
            this._eePropRefDebug = obj;
            if (isPlaytest()) {
                var loadPayload = {
                    mapId: Math.floor(Number(obj.mapId || 0)),
                    targetEventId: Math.floor(Number(obj.targetEventId || 0)),
                    frameCount: Array.isArray(obj.frames) ? obj.frames.length : 0,
                    savedAt: String(obj.savedAt || ''),
                    file: filePath
                };
                this.eeAppendFileLog('LOAD', loadPayload);
            }
            return obj;
        } catch (e) {
            this._eePropRefDebug = null;
            this.err('E_EE_PROP_REF_LOAD', e);
            return null;
        }
    };

    EE.prototype.findEePropReferenceFrame = function(eventId, frame) {
        var ref = this._eePropRefDebug;
        if (!ref || typeof ref !== 'object') return null;
        var targetEventId = Math.floor(Number(eventId || 0));
        var refEventId = Math.floor(Number(ref.targetEventId || 0));
        if (refEventId > 0 && targetEventId > 0 && refEventId !== targetEventId) return null;
        var idx = ref._frameIndex;
        if (!idx || typeof idx !== 'object') {
            idx = this.eePropRefBuildFrameIndex(ref);
            ref._frameIndex = idx;
        }
        var f = Math.max(0, Math.floor(Number(frame || 0)));
        return idx[String(f)] || null;
    };

    EE.prototype.diffObj = function(keys, preparedLists, mergedDocument) {
        var ts2 = [];
        var battle = this.isBattleEventMode();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var tr = this.model.tracks[key];
            if (!tr) continue;
            var outList = null;
            if (preparedLists && Object.prototype.hasOwnProperty.call(preparedLists, key)) outList = clone(preparedLists[key]);
            else outList = this.listFromTrack(tr);
            ts2.push({ eventId: tr.eventId, pageIndex: tr.pageIndex, list: outList, timeline: clone(tr.commands) });
        }
        var out = {
            plugin: PLUGIN_NAME,
            version: PLUGIN_VERSION,
            savedAt: new Date().toISOString(),
            tracks: ts2,
            documents: { events: [], troops: [] }
        };
        var documentDirty = this.documentDirty || { events: {}, troops: {} };
        if (battle) {
            out.mode = 'battle';
            out.troopId = this.currentBattleTroopId();
            var troopIds = Object.keys(documentDirty.troops || {});
            for (var ti = 0; ti < troopIds.length; ti++) {
                var troopId = Math.max(0, Math.floor(Number(troopIds[ti] || 0)));
                out.documents.troops.push({
                    troopId: troopId,
                    data: mergedDocument && Array.isArray(mergedDocument) ? clone(mergedDocument[troopId] || null) : null
                });
            }
        } else {
            out.mode = 'map';
            out.mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? $gameMap.mapId() : 0;
            var eventIds = Object.keys(documentDirty.events || {});
            for (var ei = 0; ei < eventIds.length; ei++) {
                var eventId = Math.max(0, Math.floor(Number(eventIds[ei] || 0)));
                out.documents.events.push({
                    eventId: eventId,
                    data: mergedDocument && Array.isArray(mergedDocument.events) ? clone(mergedDocument.events[eventId] || null) : null
                });
            }
        }
        return out;
    };
    EE.prototype.mergeChangesIntoLatestDocument = function(latestDocument, keys, preparedLists) {
        var api = NS._eeDocument;
        if (!api || typeof api.mergeLatestDocument !== 'function') throw new Error('document utilities are not loaded');
        return api.mergeLatestDocument({
            battle: this.isBattleEventMode(),
            latestDocument: latestDocument,
            documentDirty: this.documentDirty || { events: {}, troops: {} },
            currentEvents: ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [],
            currentTroops: ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops : [],
            tracks: this.model && this.model.tracks ? this.model.tracks : {},
            trackKeys: keys,
            preparedLists: preparedLists
        });
    };
    EE.prototype.syncCommittedDocument = function(mergedDocument) {
        if (this.isBattleEventMode()) {
            $dataTroops = mergedDocument;
            if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.onLoad === 'function') {
                try { DataManager.onLoad($dataTroops); } catch (_) {}
            }
        } else {
            $dataMap = mergedDocument;
            if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.onLoad === 'function') {
                try { DataManager.onLoad($dataMap); } catch (_) {}
            }
            if ($gameMap && $gameMap.requestRefresh) $gameMap.requestRefresh();
        }
    };
    EE.prototype.restartRpgMakerMvEditor = function() {
        if (!isMvEditorRestartOnSaveEnabled()) return false;
        if (!process || process.platform !== 'win32') return false;
        var fs, path, cp;
        try { fs = require('fs'); path = require('path'); cp = require('child_process'); }
        catch (e) { return false; }
        var projectPath = path.join(process.cwd(), 'Game.rpgproject');
        if (!fs.existsSync(projectPath)) return false;
        try {
            this.eeAppendFileLog('RESTART', { stage: 'begin', projectPath: projectPath, at: new Date().toISOString() });
        } catch (_) {}
        try {
            // Never terminate RPG Maker MV here: it may contain unsaved editor work.
            // This opt-in action only asks Windows to open the project file.
            var args = ['/c', 'start', '', projectPath];
            cp.spawn('cmd.exe', args, {
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            }).unref();
            activateGameWindowOnceAfterEditorRestart();
            try {
                this.eeAppendFileLog('RESTART', { stage: 'spawned', cmd: 'cmd.exe', args: args, at: new Date().toISOString() });
            } catch (_) {}
            return true;
        } catch (e) {
            try { this.eeAppendFileLog('RESTART', { stage: 'failed', error: String(e && (e.stack || e.message || e) || e), at: new Date().toISOString() }); } catch (_) {}
            return false;
        }
    };
    EE.prototype.save = function(backupOnly) {
        var fs, path;
        this._lastSaveSucceeded = false;
        this._lastSaveWroteData = false;
        try { fs = require('fs'); path = require('path'); } catch (e) { this.err('E_NO_NODE', e); return false; }
        var battle = this.isBattleEventMode();
        var dataDir = path.join(process.cwd(), 'data');
        try {
            var targetFile = '';
            var targetPath = '';
            if (battle) {
                targetFile = 'Troops.json';
                targetPath = path.join(dataDir, targetFile);
            } else {
                var mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? $gameMap.mapId() : 0;
                targetFile = 'Map' + p3(mapId) + '.json';
                targetPath = path.join(dataDir, targetFile);
            }
            if (!fs.existsSync(targetPath)) throw new Error('data not found: ' + targetPath);
            var raw = fs.readFileSync(targetPath, 'utf8');
            var latestDocument = JSON.parse(raw);
            var bd = path.join(dataDir, '_backup'); ensureDir(bd);
            var backupName = battle ? ('Troops.' + ts() + '.json') : targetFile.replace('.json', '.' + ts() + '.json');
            var backupPrefix = battle ? 'Troops.' : targetFile.replace('.json', '.');
            this.writeBackupFile({
                dirPath: bd,
                fileName: backupName,
                text: raw,
                prefix: backupPrefix,
                keepCount: 80
            });
            if (backupOnly) {
                this._lastSaveSucceeded = true;
                this.msg('バックアップを保存しました');
                return true;
            }
            var ks = Object.keys(this.dirty);
            var documentDirty = this.documentDirty || { events: {}, troops: {} };
            var documentKeys = battle
                ? Object.keys(documentDirty.troops || {})
                : Object.keys(documentDirty.events || {});
            var exportListsByKey = {};
            var validTrackKeys = [];
            for (var i = 0; i < ks.length; i++) {
                var key = ks[i];
                var tr = this.model.tracks[key];
                if (!tr) continue;
                exportListsByKey[key] = this.listFromTrack(tr);
                validTrackKeys.push(key);
            }
            if (!validTrackKeys.length && !documentKeys.length) {
                this._lastSaveSucceeded = true;
                this.msg('変更はありません（バックアップのみ保存）');
                return true;
            }

            if (!battle && this.isCalcDebugEnabled && this.isCalcDebugEnabled()) {
                this.writeEePropReferenceDebug(dataDir, targetFile, validTrackKeys);
            }
            var mergedDocument = this.mergeChangesIntoLatestDocument(latestDocument, validTrackKeys, exportListsByKey);
            var mergedText = JSON.stringify(mergedDocument, null, 2);
            JSON.parse(mergedText);
            var dd = path.join(dataDir, '_event_editor'); ensureDir(dd);
            var diffFile = battle
                ? ('Troop' + p3(this.currentBattleTroopId()) + '.eventdiff.json')
                : targetFile.replace('.json', '.eventdiff.json');
            var diffText = JSON.stringify(this.diffObj(validTrackKeys, exportListsByKey, mergedDocument), null, 2);
            JSON.parse(diffText);
            this.writeTextFileAtomic(path.join(dd, diffFile), diffText);
            this.writeTextFileAtomic(targetPath, mergedText);
            this.syncCommittedDocument(mergedDocument);
            this.dirty = {};
            this.documentDirty = { events: {}, troops: {} };
            this._lastSaveSucceeded = true;
            this._lastSaveWroteData = true;
            this.msg('保存しました: ' + targetFile);
            this.restartRpgMakerMvEditor();
            return true;
        } catch (e) {
            this.err('E_SAVE_FAILED', e);
            return false;
        }
    };

    NS._boot = false;
    NS._runtimeEnabled = false;
    NS._runtimeHotkeyInstalled = false;
    NS._runtimeStartPending = false;
    NS._runtimeStartEventId = 0;
    NS._runtimeStartPageIndex = -1;
    NS._runtimeStartMode = 'map';
    NS._fatal = false;
    NS._initialTestLoadStarted = false;
    NS._initialTestLoadDone = false;
    NS._initialTestLoadName = '';
    NS._initialSelectEventId = 0;
    NS._timelineReadyRetryFrames = 0;
    NS._timelineSyncFallbackDelayFrames = 120;
    NS._bootDeferredOwnerEventId = 0;
    NS._bootDeferredOwnerPageIndex = -1;

    NS.enabled = function() {
        return !!((NS._boot || NS._runtimeEnabled) && !NS._fatal && isPlaytest());
    };

    NS.runtimeInterpreterOwnerInfoMap = function() {
        var out = { eventId: 0, pageIndex: -1, mode: 'map' };
        try {
            if (!$gameMap) return out;
            var itp = $gameMap._interpreter || null;
            while (itp) {
                var running = (typeof itp.isRunning === 'function') ? !!itp.isRunning() : true;
                if (running) {
                    var eid = Math.max(0, Math.floor(Number(itp._eventId || 0)));
                    var evObj = (eid > 0) ? $gameMap.event(eid) : null;
                    if (eid > 0 && evObj) {
                        out.eventId = eid;
                        var pageIndex = Math.max(-1, Math.floor(Number(evObj._pageIndex == null ? -1 : evObj._pageIndex)));
                        var evData = (typeof evObj.event === 'function')
                            ? evObj.event()
                            : (($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null);
                        var pages = (evData && Array.isArray(evData.pages)) ? evData.pages : null;
                        var listRef = itp._list || null;
                        if (listRef && pages && pages.length) {
                            for (var i = 0; i < pages.length; i++) {
                                if (pages[i] && pages[i].list === listRef) {
                                    pageIndex = i;
                                    break;
                                }
                            }
                        }
                        out.pageIndex = pageIndex;
                        return out;
                    }
                }
                itp = itp._childInterpreter || null;
            }
        } catch (_) {}
        return out;
    };

    NS.runtimeInterpreterOwnerInfoBattle = function() {
        var out = { eventId: 0, pageIndex: -1, mode: 'battle' };
        try {
            var troopId = Math.max(0, Math.floor(Number($gameTroop && $gameTroop._troopId || 0)));
            if (troopId <= 0) return out;
            out.eventId = troopId;
            var troop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[troopId] : null;
            var pages = troop && Array.isArray(troop.pages) ? troop.pages : null;
            var itp = ($gameTroop && $gameTroop._interpreter) ? $gameTroop._interpreter : null;
            while (itp) {
                var running = (typeof itp.isRunning === 'function') ? !!itp.isRunning() : true;
                if (running) {
                    var listRef = itp._list || null;
                    if (listRef && pages && pages.length) {
                        for (var i = 0; i < pages.length; i++) {
                            if (pages[i] && pages[i].list === listRef) {
                                out.pageIndex = i;
                                return out;
                            }
                        }
                    }
                }
                itp = itp._childInterpreter || null;
            }
        } catch (_) {}
        return out;
    };

    NS.runtimeInterpreterOwnerInfo = function() {
        var sc = SceneManager && SceneManager._scene;
        if (NS.isBattleScene(sc)) return NS.runtimeInterpreterOwnerInfoBattle();
        return NS.runtimeInterpreterOwnerInfoMap();
    };

    NS.runtimeInterpreterOwnerEventId = function() {
        var info = NS.runtimeInterpreterOwnerInfo();
        return Math.max(0, Math.floor(Number(info && info.eventId || 0)));
    };

    NS.openRuntimeEditorOnCurrentScene = function() {
        if (NS._fatal || !isPlaytest()) return false;
        var sc = SceneManager && SceneManager._scene;
        if (!sc || (!NS.isMapScene(sc) && !NS.isBattleScene(sc))) return false;
        NS._runtimeEnabled = true;
        var ownerInfo = NS.runtimeInterpreterOwnerInfo();
        NS._runtimeStartEventId = Math.max(0, Math.floor(Number(ownerInfo && ownerInfo.eventId || 0)));
        NS._runtimeStartPageIndex = Math.max(-1, Math.floor(Number(ownerInfo && ownerInfo.pageIndex == null ? -1 : ownerInfo.pageIndex)));
        NS._runtimeStartMode = String(ownerInfo && ownerInfo.mode || (NS.isBattleScene(sc) ? 'battle' : 'map'));
        NS._runtimeStartPending = true;
        var opened = NS.tryStartEditorOnScene(sc, NS.isBattleScene(sc) ? 'battle' : 'map');
        if (!opened && !hasTimelineExtensionReady()) {
            console.warn('[EventEditor] timeline extension is not ready.');
        }
        return opened;
    };
    NS.openRuntimeEditorOnCurrentMap = function() {
        return NS.openRuntimeEditorOnCurrentScene();
    };

    function installRuntimeCtrlROpenHotkey() {
        if (NS._runtimeHotkeyInstalled) return;
        NS._runtimeHotkeyInstalled = true;
        if (typeof window === 'undefined' || !window || !window.addEventListener) return;
        window.addEventListener('keydown', function(e) {
            if (!e || e.defaultPrevented || e.repeat) return;
            if (!e.ctrlKey || e.altKey || e.metaKey) return;
            var key = String(e.key || '').toLowerCase();
            var isR = (key === 'r') || (Number(e.keyCode || 0) === 82);
            if (!isR) return;
            var sc = SceneManager && SceneManager._scene;
            if (!sc || (!NS.isMapScene(sc) && !NS.isBattleScene(sc))) return;
            // Keep existing Ctrl+R behavior while EventEditor is already active.
            if (sc._knhEE && sc._knhEE.on) return;
            if (!isPlaytest() || NS._fatal) return;
            e.preventDefault();
            e.stopPropagation();
            NS.openRuntimeEditorOnCurrentScene();
        }, true);
    }

    NS.raiseFatalError = function(code, detail, err) {
        var msg = String(code || 'EE_FATAL');
        if (detail) msg += ': ' + String(detail);
        if (err) msg += '<br>' + String(err.message || err);
        console.error('[EventEditor][FATAL]', code, detail || '', err || '');
        NS._fatal = true;
        NS._boot = false;
        try {
            var sc = SceneManager._scene;
            if (sc && sc._knhEE) sc._knhEE.stop();
        } catch (_) {}
        try { if (AudioManager && AudioManager.stopAll) AudioManager.stopAll(); } catch (_) {}
        try { Graphics.printError('EventEditor Error', msg); } catch (_) {}
        try { SceneManager.stop(); } catch (_) {}
    };

    NS.startInitialTestLoadOrFatal = function() {
        if (NS._fatal) return false;
        if (NS._initialTestLoadDone) return true;
        if (NS._initialTestLoadStarted) return true;

        var name = getStartModeTestSaveName();
        if (!name) {
            NS.raiseFatalError('E_NO_TEST_SAVE_NAME', '_debug.get("startModeTestSave") is empty');
            return false;
        }

        var tr = window.TestReload;
        if (!tr) {
            NS.raiseFatalError('E_NO_TESTRELOAD', 'window.TestReload not found');
            return false;
        }
        if (typeof tr._loadContentsFromTestFile !== 'function' || typeof tr._startInterpreterGate !== 'function') {
            NS.raiseFatalError('E_TESTRELOAD_API', 'TestReload internal API missing');
            return false;
        }
        if (typeof window.Scene_TestReload !== 'function') {
            NS.raiseFatalError('E_SCENE_TESTRELOAD_MISSING', 'Scene_TestReload not found');
            return false;
        }

        try {
            var contents = tr._loadContentsFromTestFile(name);
            if (!contents) {
                NS.raiseFatalError('E_TESTLOAD_NOT_FOUND', 'save/test_save/' + name + '.rpgsave');
                return false;
            }
            var meta = contents.__testReloadMeta;
            if (!meta) {
                NS.raiseFatalError('E_TESTLOAD_META_MISSING', 'Not a test save: ' + name);
                return false;
            }

            tr._lastName = name;
            tr._pendingContents = contents;
            tr._pendingMeta = meta;
            tr._pendingAudio = contents.__testReloadAudio || null;
            tr._pendingMessageRaw = (contents.__testReloadMessageRaw !== undefined) ? contents.__testReloadMessageRaw : null;
            tr._startInterpreterGate(meta);

            NS._initialTestLoadName = name;
            NS._initialTestLoadStarted = true;
            NS._initialSelectEventId = Math.max(0, Math.floor(Number(meta.eventId || 0)));

            SceneManager.goto(Scene_TestReload);
            return true;
        } catch (e) {
            NS.raiseFatalError('E_TESTLOAD_EXCEPTION', 'Failed to load test save: ' + name, e);
            return false;
        }
    };

    var _Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Boot_start.apply(this, arguments);
        NS._boot = isEditEnabled();
        NS._runtimeEnabled = false;
        NS._runtimeHotkeyInstalled = false;
        NS._runtimeStartPending = false;
        NS._runtimeStartEventId = 0;
        NS._runtimeStartPageIndex = -1;
        NS._runtimeStartMode = 'map';
        NS._fatal = false;
        NS._initialTestLoadStarted = false;
        NS._initialTestLoadDone = false;
        NS._initialTestLoadName = '';
        NS._initialSelectEventId = 0;
        NS._timelineReadyRetryFrames = 0;
        NS._bootDeferredOwnerEventId = 0;
        NS._bootDeferredOwnerPageIndex = -1;
        installRuntimeCtrlROpenHotkey();
    };

    var _Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Map_onMapLoaded.apply(this, arguments);
        if (NS.enabled() && NS._initialTestLoadStarted && !NS._initialTestLoadDone) {
            NS._initialTestLoadDone = true;
        }
    };

    var _Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Map_start.apply(this, arguments);
        if (!NS.enabled()) return;
        NS.tryStartEditorOnScene(this, 'map');
    };

    var _Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        if (NS.enabled() && (!this._knhEE || !this._knhEE.on)) {
            NS.tryStartEditorOnScene(this, 'map');
        }
        var ee = this._knhEE;
        if (ee && ee.on) {
            ee.pre();
            if (ee.play) _Map_update.apply(this, arguments);
            ee.post();
            return;
        }
        _Map_update.apply(this, arguments);
    };

    var _Map_term = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        if (this._knhEE) this._knhEE.stop();
        _Map_term.apply(this, arguments);
    };

    if (typeof Scene_NewBattle !== 'undefined' && Scene_NewBattle && Scene_NewBattle.prototype) {
        var _Battle_start = Scene_NewBattle.prototype.start;
        Scene_NewBattle.prototype.start = function() {
            _Battle_start.apply(this, arguments);
            if (!NS.enabled()) return;
            NS.tryStartEditorOnScene(this, 'battle');
        };

        var _Battle_update = Scene_NewBattle.prototype.update;
        Scene_NewBattle.prototype.update = function() {
            if (NS.enabled() && (!this._knhEE || !this._knhEE.on)) {
                NS.tryStartEditorOnScene(this, 'battle');
            }
            var ee = this._knhEE;
            if (ee && ee.on) {
                ee.pre();
                if (ee.play) _Battle_update.apply(this, arguments);
                ee.post();
                return;
            }
            _Battle_update.apply(this, arguments);
        };

        var _Battle_term = Scene_NewBattle.prototype.terminate;
        Scene_NewBattle.prototype.terminate = function() {
            if (this._knhEE) this._knhEE.stop();
            _Battle_term.apply(this, arguments);
        };
    }

    var _Map_touch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function() {
        if (this._knhEE && this._knhEE.on && !this._knhEE.allowGameInput()) return;
        _Map_touch.apply(this, arguments);
    };

    function isEEActive() {
        var sc = SceneManager && SceneManager._scene;
        return !!(sc && sc._knhEE && sc._knhEE.on);
    }
    function isEEScrollLocked() {
        var sc = SceneManager && SceneManager._scene;
        var ee = sc && sc._knhEE;
        if (!ee || !ee.on) return false;
        if (ee._simToRunning) return false;
        if (ee.dragMode === 'tile') return true;
        // Allow camera scroll commands while playback is running, even in timeline mode.
        return !ee.play;
    }

    var _GameMap_updateInterpreter = Game_Map.prototype.updateInterpreter;
    Game_Map.prototype.updateInterpreter = function() {
        if (isEEActive()) return;
        _GameMap_updateInterpreter.apply(this, arguments);
    };

    var _GameTroop_updateInterpreter = Game_Troop.prototype.updateInterpreter;
    Game_Troop.prototype.updateInterpreter = function() {
        if (isEEActive()) return;
        _GameTroop_updateInterpreter.apply(this, arguments);
    };

    var _GameTroop_setupBattleEvent = Game_Troop.prototype.setupBattleEvent;
    Game_Troop.prototype.setupBattleEvent = function() {
        if (isEEActive()) return;
        _GameTroop_setupBattleEvent.apply(this, arguments);
    };

    var _GameEvent_updateParallel = Game_Event.prototype.updateParallel;
    Game_Event.prototype.updateParallel = function() {
        if (isEEActive()) return;
        _GameEvent_updateParallel.apply(this, arguments);
    };

    var _GameEvent_updateSelfMovement = Game_Event.prototype.updateSelfMovement;
    Game_Event.prototype.updateSelfMovement = function() {
        var sc = SceneManager && SceneManager._scene;
        var ee = sc && sc._knhEE;
        // Keep playback behavior unchanged, but freeze autonomous movement while simTo() seeks/recalculates.
        if (ee && ee.on && ee._simToRunning) return;
        _GameEvent_updateSelfMovement.apply(this, arguments);
    };

    var _GameCommonEvent_update = Game_CommonEvent.prototype.update;
    Game_CommonEvent.prototype.update = function() {
        if (isEEActive()) return;
        _GameCommonEvent_update.apply(this, arguments);
    };

    var _Map_updateCallMenu = Scene_Map.prototype.updateCallMenu;
    Scene_Map.prototype.updateCallMenu = function() {
        if (this._knhEE && this._knhEE.on && !this._knhEE.allowGameInput()) return;
        _Map_updateCallMenu.apply(this, arguments);
    };

    var _Player_moveByInput = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function() {
        var sc = SceneManager && SceneManager._scene;
        if (sc && sc._knhEE && sc._knhEE.on && !sc._knhEE.allowGameInput()) return;
        _Player_moveByInput.apply(this, arguments);
    };

    var _Player_updateScroll_EE = Game_Player.prototype.updateScroll;
    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        if (isEEScrollLocked()) return;
        _Player_updateScroll_EE.apply(this, arguments);
    };

    var _GameMap_scrollDown_EE = Game_Map.prototype.scrollDown;
    Game_Map.prototype.scrollDown = function(distance) {
        if (isEEScrollLocked()) return;
        _GameMap_scrollDown_EE.apply(this, arguments);
    };
    var _GameMap_scrollLeft_EE = Game_Map.prototype.scrollLeft;
    Game_Map.prototype.scrollLeft = function(distance) {
        if (isEEScrollLocked()) return;
        _GameMap_scrollLeft_EE.apply(this, arguments);
    };
    var _GameMap_scrollRight_EE = Game_Map.prototype.scrollRight;
    Game_Map.prototype.scrollRight = function(distance) {
        if (isEEScrollLocked()) return;
        _GameMap_scrollRight_EE.apply(this, arguments);
    };
    var _GameMap_scrollUp_EE = Game_Map.prototype.scrollUp;
    Game_Map.prototype.scrollUp = function(distance) {
        if (isEEScrollLocked()) return;
        _GameMap_scrollUp_EE.apply(this, arguments);
    };

    var _Window_Message_isTriggered_EE = Window_Message.prototype.isTriggered;
    Window_Message.prototype.isTriggered = function() {
        var sc = SceneManager && SceneManager._scene;
        if (sc && sc._knhEE && sc._knhEE.on) {
            if (!sc._knhEE.play) return false;
        }
        return _Window_Message_isTriggered_EE.apply(this, arguments);
    };

    if (typeof AudioManager !== 'undefined' && AudioManager && !AudioManager._eeSimSeMutePatchApplied) {
        AudioManager._eeSimSeMutePatchApplied = true;
        var _AudioManager_playSe_EE = AudioManager.playSe;
        AudioManager.playSe = function() {
            var sc = SceneManager && SceneManager._scene;
            var ee = sc && sc._knhEE;
            if (ee && ee.on && ee._simToRunning) return;
            return _AudioManager_playSe_EE.apply(this, arguments);
        };
        if (typeof AudioManager.playStaticSe === 'function') {
            var _AudioManager_playStaticSe_EE = AudioManager.playStaticSe;
            AudioManager.playStaticSe = function() {
                var sc2 = SceneManager && SceneManager._scene;
                var ee2 = sc2 && sc2._knhEE;
                if (ee2 && ee2.on && ee2._simToRunning) return;
                return _AudioManager_playStaticSe_EE.apply(this, arguments);
            };
        }
    }

    // Keep plugins.js simple: only KNH_ZXC_EventEditor is required.
    requestTimelineExtensionAutoload();
})();
