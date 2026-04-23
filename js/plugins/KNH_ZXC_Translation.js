/*:
 * @target MV MZ
 * @plugindesc ZXC 翻訳総合
 * @author you
 *
 * @help
 * - translation_data.json を起動時に読み込み
 * - メッセージ/選択肢/UI文字列を実行時翻訳
 * - 英語時フォント/サイズ/表示マスクを調整
 * - テストプレイ時の抽出・自動反映（bat実行）に対応
 */
(() => {
    'use strict';

    // ===== 設定 =====
    const JOIN_CHOICES_IN_ONE_ROW = true;   // 102を1セルにまとめる（falseなら各選択肢を別セル行として出力）
    const WINDOW_W = 600;
    const WINDOW_H = 600;
    const REPLACE_TAB_WITH = ' ';           // タブはスプレッドシートで列ズレの原因になるので除去/置換
    const LOG_MISSING_RUNTIME_TRANSLATION = true;
    const ENGLISH_FONT_FACE = 'Patrick Hand, Segoe UI, Arial, sans-serif'; // 英語(_lg===1)時のUIフォント（先頭はフォールバック表記）
    const ENGLISH_FONT_SIZE_OFFSET = -2; // 必要なら調整
    const ENGLISH_FONT_FILE = 'fonts/Schoolbell-Regular.ttf'; // 空なら読み込みしない
    const ENGLISH_FONT_LOADED_NAME = 'Schoolbell-Regular';
    const ENGLISH_MASK_ALPHA_THRESHOLD_DEFAULT = 25;
    const ENGLISH_MASK_ALPHA_THRESHOLD_MESSAGE = 50;
    const ENGLISH_MASK_ALPHA_THRESHOLD_CHOICE = 50;
    const AUTO_TRANSLATE_APPLY_BAT_PATH = 'C:\\Users\\kgygn\\Dropbox\\ゲーム\\Game_NewGame\\翻訳データ自動反映くん\\autoTranslateApply.bat';

    // ===== 依存 =====
    const canUseNodeRequire = (typeof require === 'function');
    let fs = null;
    let path = null;
    if (canUseNodeRequire) {
        try {
            fs = require('fs');
            path = require('path');
        } catch (e) {
            fs = null;
            path = null;
        }
    }
    const clip = (typeof nw !== 'undefined' && nw && nw.Clipboard && typeof nw.Clipboard.get === 'function')
        ? nw.Clipboard.get()
        : null;
    const TRANSLATION_JSON_REL_PATH = path
        ? path.join('js', 'languages', 'translation_data.json')
        : 'js/languages/translation_data.json';

    const BLOCK_SEPARATOR = '#===========================================';
    const ALT_BLOCK_SEPARATOR = '#===========================================';
    const TROOP_NAME_PREFIX = 'VS';
    const RUNTIME_LOG_PREFIX = '[KNH_ZXC_Translation]';
    const _missingTranslationLogSet = new Set();
    const _choiceMismatchLogSet = new Set();
    let _knownItemTextSetsCache = null;
    let _knownItemTextSetsCacheStamp = '';
    let _knownMapNameSetCache = null;
    let _knownMapNameSetCacheStamp = '';
    let _knownEnemyNameSetCache = null;
    let _knownEnemyNameSetCacheStamp = '';
    let _autoTranslateApplyLaunched = false;
    let _initialTranslationRawText = null;
    let _autoTranslateReloadTriggered = false;

    function isTestPlayLogEnabled() {
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

    function warnTestPlay() {
        if (!isTestPlayLogEnabled()) return;
        console.warn.apply(console, arguments);
    }

    function errorTestPlay() {
        if (!isTestPlayLogEnabled()) return;
        console.error.apply(console, arguments);
    }

    function raiseTranslationLoadFatal(phase, file, error) {
        const errorText = (error && error.message) ? String(error.message) : String(error || '');
        const lines = [
            `${RUNTIME_LOG_PREFIX} translation_data.json load failed`,
            `phase=${String(phase || '')}`,
            `file=${String(file || '')}`,
            `error=${errorText}`
        ];
        throw new Error(lines.join('\n'));
    }

    function canUseNodeFs() {
        return !!(fs && path && typeof process !== 'undefined' && process && typeof process.cwd === 'function');
    }

    // ===== 共通ユーティリティ =====
    const normalizeLF = s => String(s || '').replace(/\r\n/g, '\n');
    const htmlEscape = s => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function sanitizeCellText(text) {
        return normalizeLF(text || '').replace(/\t/g, REPLACE_TAB_WITH).trim();
    }

    function normalizeEventName(name) {
        return String(name || '').replace(/\([^)]*\)/g, '').trim();
    }

    function makeRow(speaker, text) {
        return {
            speaker: sanitizeCellText(speaker || ''),
            text: sanitizeCellText(text || '')
        };
    }

    function makeBlankRow() {
        return { speaker: '', text: '', isBlank: true };
    }

    function resolveSpeakerNameFromToken(token, eventNameById) {
        const raw = String(token || '').trim();
        if (!raw) return '';
        if (/^-?\d+$/.test(raw)) {
            const id = Number(raw);
            if (eventNameById && eventNameById.has(id)) {
                return normalizeEventName(eventNameById.get(id) || '');
            }
            return '';
        }
        return normalizeEventName(raw);
    }

    function parseFukidashiSpeakerToken(cmd) {
        if (cmd.code === 356 && cmd.parameters && cmd.parameters[0]) {
            const parts = String(cmd.parameters[0]).trim().split(/\s+/);
            if (parts[0] !== 'フキダシウィンドウ有効化') return null;
            if (parts.length < 2) return null;
            return parts[1];
        }
        if (cmd.code === 357 && Array.isArray(cmd.parameters)) {
            const commandName = cmd.parameters[1];
            if (commandName !== 'フキダシウィンドウ有効化') return null;
            const args = cmd.parameters[2];
            if (args && typeof args === 'object') {
                if (Object.prototype.hasOwnProperty.call(args, 'speaker')) return args.speaker;
                const keys = Object.keys(args);
                if (keys.length) return args[keys[0]];
            }
        }
        return null;
    }

    const ICON_CODE_MAP = {
        16: '❗️',
        17: '‼️',
        18: '⁉️',
        19: '♪',
        20: '🎵'
    };

    function replaceIconCodes(text) {
        let result = String(text || '');
        result = result.split('\\i[16]').join(ICON_CODE_MAP[16]);
        result = result.split('\\i[17]').join(ICON_CODE_MAP[17]);
        result = result.split('\\i[18]').join(ICON_CODE_MAP[18]);
        result = result.split('\\i[19]').join(ICON_CODE_MAP[19]);
        result = result.split('\\i[20]').join(ICON_CODE_MAP[20]);
        return result;
    }

    function restoreIconCodes(text, langId = getLanguageIdSafe()) {
        let result = String(text || '');
        const isEnglish = Number(langId) === 1;
        const doubleExclamationCode = isEnglish ? 21 : 17;
        const interrobangCode = isEnglish ? 22 : 18;
        // 長い表記（VS16付き）を先に処理
        result = result.split('❗️').join('\\i[16]');
        result = result.split('‼️').join(`\\i[${doubleExclamationCode}]`);
        result = result.split('⁉️').join(`\\i[${interrobangCode}]`);
        result = result.split('🎵').join('\\i[20]');
        // 環境差でVS16なしになるケースも吸収
        result = result.split('❗').join('\\i[16]');
        result = result.split('‼').join(`\\i[${doubleExclamationCode}]`);
        result = result.split('⁉').join(`\\i[${interrobangCode}]`);
        result = result.split('♪').join('\\i[19]');
        return result;
    }

    function stripControlCodes(text) {
        return String(text || '')
            .replace(/\\sp\\[\\d+\\]/gi, '')
            .replace(/\\ef/gi, '')
            .replace(/\\[><{}]/g, '')
            .replace(/\\\./g, '')
            .replace(/\\x\\[\\d+\\]/gi, '')
            .replace(/\\mx\\[\\d+\\]/gi, '')
            .replace(/\\y\\[\\d+\\]/gi, '')
            .replace(/\\my\\[\\d+\\]/gi, '')
            .replace(/\\\|/g, '')
            .replace(/\\!/g, '');
    }

    function formatExtractedText(text, stripControl) {
        let result = replaceIconCodes(text);
        if (stripControl) {
            result = stripControlCodes(result);
            result = result.split(BLOCK_SEPARATOR).join(ALT_BLOCK_SEPARATOR);
        }
        return result;
    }

    function projectDataDir() {
        if (!canUseNodeFs()) return 'data';
        return path.join(process.cwd(), 'data');
    }

    function translationDataFilePath() {
        if (!canUseNodeFs()) return TRANSLATION_JSON_REL_PATH;
        return path.join(process.cwd(), TRANSLATION_JSON_REL_PATH);
    }

    function buildTranslationJsonFsCandidates() {
        const files = [];
        const push = function(file) {
            const f = String(file || '').trim();
            if (!f) return;
            if (files.indexOf(f) >= 0) return;
            files.push(f);
        };
        if (!canUseNodeFs()) return files;

        const rel = String(TRANSLATION_JSON_REL_PATH);
        push(path.join(process.cwd(), rel));
        push(path.join(process.cwd(), 'www', rel));

        try {
            if (process && process.mainModule && process.mainModule.filename) {
                const base = path.dirname(String(process.mainModule.filename));
                push(path.join(base, rel));
                push(path.join(base, 'www', rel));
            }
        } catch (e) {
            // noop
        }

        return files;
    }

    function buildTranslationJsonUrlCandidates() {
        const urls = [];
        const push = function (url) {
            const u = String(url || '').trim();
            if (!u) return;
            if (urls.indexOf(u) >= 0) return;
            urls.push(u);
        };

        const rel = String(TRANSLATION_JSON_REL_PATH).replace(/\\/g, '/');
        push(rel);
        push('./' + rel);

        try {
            if (typeof location !== 'undefined' && location && location.pathname) {
                const base = String(location.pathname).replace(/[^/]*$/, '');
                push(base + rel);
            }
        } catch (e) {
            // noop
        }

        try {
            if (typeof document !== 'undefined' && document && document.currentScript && document.currentScript.src) {
                const src = String(document.currentScript.src || '');
                const marker = '/js/plugins/';
                const idx = src.lastIndexOf(marker);
                if (idx >= 0) {
                    const root = src.slice(0, idx + 1); // trailing slash
                    push(root + rel);
                }
            }
        } catch (e) {
            // noop
        }

        return urls;
    }

    function readTranslationRawTextByXhr() {
        if (typeof XMLHttpRequest === 'undefined') throw new Error('XMLHttpRequest is unavailable');
        const urls = buildTranslationJsonUrlCandidates();
        let lastError = null;

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);
                if (typeof xhr.overrideMimeType === 'function') xhr.overrideMimeType('application/json');
                xhr.send();
                const status = Number(xhr.status || 0);
                const ok = (status === 0) || (status >= 200 && status < 400);
                if (!ok) throw new Error(`status=${status}`);
                const text = String(xhr.responseText || '');
                if (!text) throw new Error('empty response');
                return text;
            } catch (e) {
                lastError = new Error(`XHR failed: ${url} (${e && e.message ? e.message : e})`);
            }
        }

        if (lastError) throw lastError;
        throw new Error('XHR failed: no URL candidates');
    }

    function readTranslationRawText() {
        if (canUseNodeFs()) {
            const files = buildTranslationJsonFsCandidates();
            let lastFsError = null;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const text = fs.readFileSync(file, 'utf8');
                    return text;
                } catch (e) {
                    lastFsError = e;
                }
            }

            // Node 側の配置差分を吸収できない場合、URL 経路も試す
            try {
                const text = readTranslationRawTextByXhr();
                return text;
            } catch (xhrError) {
                const fsMessage = lastFsError && lastFsError.message ? lastFsError.message : String(lastFsError || 'no fs candidates');
                throw new Error(`fs+xhr failed: fs=${fsMessage} / xhr=${xhrError && xhrError.message ? xhrError.message : xhrError}`);
            }
        }
        return readTranslationRawTextByXhr();
    }

    function preloadEnglishFontIfNeeded() {
        if (!ENGLISH_FONT_FILE) return;
        if (typeof Graphics === 'undefined' || typeof Graphics.loadFont !== 'function') return;
        try {
            Graphics.loadFont(ENGLISH_FONT_LOADED_NAME, ENGLISH_FONT_FILE);
        } catch (e) {
            warnTestPlay(`${RUNTIME_LOG_PREFIX} 英語フォントの読み込みに失敗しました`, ENGLISH_FONT_FILE, e);
        }
    }

    function loadTranslationTableAtStartup() {
        const file = translationDataFilePath();
        let jsonText = '';
        try {
            jsonText = readTranslationRawText();
        } catch (e) {
            const message = `${RUNTIME_LOG_PREFIX} 翻訳テーブルの読み込みに失敗しました: ${file} (${e.message})`;
            errorTestPlay(message);
            raiseTranslationLoadFatal('read', file, e);
        }

        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            const message = `${RUNTIME_LOG_PREFIX} 翻訳テーブルJSONの解析に失敗しました: ${file} (${e.message})`;
            errorTestPlay(message);
            raiseTranslationLoadFatal('parse', file, e);
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            const message = `${RUNTIME_LOG_PREFIX} 翻訳テーブルJSONの形式が不正です: ${file}`;
            errorTestPlay(message, data);
            raiseTranslationLoadFatal('validate', file, new Error('JSON root must be plain object'));
        }

        window.TRANSLATION_DATA = data;
        if (_initialTranslationRawText === null) _initialTranslationRawText = jsonText;
        return data;
    }

    function getLanguageIdSafe() {
        try {
            return Number(window._lg || 0);
        } catch (e) {
            return 0;
        }
    }

    function isRuntimeTranslationEnabled() {
        return getLanguageIdSafe() !== 0;
    }

    function lookupTranslationByKey(key) {
        const langId = getLanguageIdSafe();
        if (langId === 0) return { found: true, text: String(key || ''), keyUsed: String(key || '') };

        const table = window.TRANSLATION_DATA;
        const lookupKey = String(key || '');
        if (!table || typeof table !== 'object') {
            return { found: false, text: lookupKey, keyUsed: lookupKey };
        }

        const row = table[lookupKey];
        if (!row || !row[langId]) {
            return { found: false, text: lookupKey, keyUsed: lookupKey };
        }

        if (typeof window._tl === 'function') {
            return { found: true, text: restoreIconCodes(String(window._tl(lookupKey)), langId), keyUsed: lookupKey };
        }
        return { found: true, text: restoreIconCodes(String(row[langId]), langId), keyUsed: lookupKey };
    }

    function logMissingTranslationOnce(kind, originalText) {
        if (!LOG_MISSING_RUNTIME_TRANSLATION) return;
        const langId = getLanguageIdSafe();
        if (!langId) return;
        const key = `${kind}::${langId}::${String(originalText || '')}`;
        if (_missingTranslationLogSet.has(key)) return;
        _missingTranslationLogSet.add(key);
        warnTestPlay(`${RUNTIME_LOG_PREFIX} 未翻訳 (${kind}, lang=${langId})`, String(originalText || ''));
    }

    function logChoiceSplitMismatchOnce(originalJoined, translatedJoined, originalCount, translatedCount) {
        const key = `${originalCount}->${translatedCount}::${String(originalJoined || '')}`;
        if (_choiceMismatchLogSet.has(key)) return;
        _choiceMismatchLogSet.add(key);
        warnTestPlay(
            `${RUNTIME_LOG_PREFIX} 選択肢翻訳の行数不一致のため原文を使用します (${originalCount} -> ${translatedCount})`,
            { original: String(originalJoined || ''), translated: String(translatedJoined || '') }
        );
    }

    function mayBeSourceJapaneseText(text) {
        const s = String(text || '');
        if (!s) return false;
        // ひらがな/カタカナ/漢字/全角記号の一部/日本語向け句読点
        return /[\u3040-\u30ff\u3400-\u9fff\uff01-\uff60\u3000-\u303f]/.test(s) || /\\[A-Za-z]/.test(s);
    }

    function translateRuntimeEventText(rawText, kind) {
        const original = String(rawText || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }

        logMissingTranslationOnce(kind, original);
        return original;
    }

    function translatePendingMessageTextBlockIfNeeded() {
        if (!isRuntimeTranslationEnabled()) return;
        if (typeof $gameMessage === 'undefined' || !$gameMessage) return;
        if (!Array.isArray($gameMessage._texts) || !$gameMessage._texts.length) return;

        const original = $gameMessage._texts.map(t => String(t || '')).join('\n');
        const translated = translateRuntimeEventText(original, 'message');
        if (translated === original) return;
        $gameMessage._texts = String(translated).split('\n');
    }

    function translateChoicesParamIfNeeded(params) {
        if (!isRuntimeTranslationEnabled()) return params;
        if (!Array.isArray(params) || !Array.isArray(params[0])) return params;

        const originalChoices = params[0].map(c => String(c || ''));
        if (!originalChoices.length) return params;

        const originalJoined = originalChoices.join('\n');
        const translatedJoined = translateRuntimeEventText(originalJoined, 'choices');
        if (translatedJoined === originalJoined) return params;

        const translatedChoices = String(translatedJoined).split('\n');
        if (translatedChoices.length !== originalChoices.length) {
            logChoiceSplitMismatchOnce(
                originalJoined,
                translatedJoined,
                originalChoices.length,
                translatedChoices.length
            );
            return params;
        }

        const patched = params.slice();
        patched[0] = translatedChoices;
        return patched;
    }

    function translateUiCommandNameIfNeeded(name) {
        const original = String(name || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }
        if (mayBeSourceJapaneseText(original)) {
            logMissingTranslationOnce('ui-command', original);
        }
        return original;
    }

    function translateActorNameIfNeeded(name) {
        const original = String(name || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }
        logMissingTranslationOnce('actor-name', original);
        return original;
    }

    function translateTextManagerValueIfNeeded(kind, value) {
        const original = String(value || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }

        if (mayBeSourceJapaneseText(original)) {
            logMissingTranslationOnce(`textmanager-${kind}`, original);
        }
        return original;
    }

    function isKnownActorNameText(text) {
        const target = String(text || '');
        if (!target) return false;

        if (typeof $gameActors !== 'undefined' && $gameActors && Array.isArray($gameActors._data)) {
            for (let i = 1; i < $gameActors._data.length; i++) {
                const actor = $gameActors._data[i];
                if (actor && String(actor._name || '') === target) return true;
            }
        }

        if (typeof $dataActors !== 'undefined' && Array.isArray($dataActors)) {
            for (let i = 1; i < $dataActors.length; i++) {
                const actorData = $dataActors[i];
                if (actorData && String(actorData.name || '') === target) return true;
            }
        }

        return false;
    }

    function canBuildItemTextSets() {
        return typeof $dataItems !== 'undefined' && Array.isArray($dataItems) &&
            typeof $dataWeapons !== 'undefined' && Array.isArray($dataWeapons) &&
            typeof $dataArmors !== 'undefined' && Array.isArray($dataArmors);
    }

    function itemTextSetsStamp() {
        if (!canBuildItemTextSets()) return '';
        return `${$dataItems.length}|${$dataWeapons.length}|${$dataArmors.length}`;
    }

    function ensureKnownItemTextSets() {
        const stamp = itemTextSetsStamp();
        if (!stamp) return null;
        if (_knownItemTextSetsCache && _knownItemTextSetsCacheStamp === stamp) return _knownItemTextSetsCache;

        const nameSet = new Set();
        const addRows = arr => {
            for (let i = 1; i < arr.length; i++) {
                const row = arr[i];
                if (!row) continue;
                if (row.name) nameSet.add(String(row.name));
            }
        };
        addRows($dataItems);
        addRows($dataWeapons);
        addRows($dataArmors);

        _knownItemTextSetsCache = { nameSet };
        _knownItemTextSetsCacheStamp = stamp;
        return _knownItemTextSetsCache;
    }

    function isKnownItemNameText(text) {
        const target = String(text || '');
        if (!target) return false;
        const sets = ensureKnownItemTextSets();
        return !!(sets && sets.nameSet.has(target));
    }

    function mapNameSetStamp() {
        if (typeof $dataMapInfos === 'undefined' || !Array.isArray($dataMapInfos)) return '';
        return String($dataMapInfos.length);
    }

    function ensureKnownMapNameSet() {
        const stamp = mapNameSetStamp();
        if (!stamp) return null;
        if (_knownMapNameSetCache && _knownMapNameSetCacheStamp === stamp) return _knownMapNameSetCache;

        const set = new Set();
        for (let i = 1; i < $dataMapInfos.length; i++) {
            const info = $dataMapInfos[i];
            if (info && info.name) set.add(String(info.name));
        }
        _knownMapNameSetCache = set;
        _knownMapNameSetCacheStamp = stamp;
        return set;
    }

    function isKnownMapNameText(text) {
        const target = String(text || '');
        if (!target) return false;
        const set = ensureKnownMapNameSet();
        if (set && set.has(target)) return true;

        if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.displayName) {
            if (String($dataMap.displayName) === target) return true;
        }
        return false;
    }

    function enemyNameSetStamp() {
        if (typeof $dataEnemies === 'undefined' || !Array.isArray($dataEnemies)) return '';
        return String($dataEnemies.length);
    }

    function ensureKnownEnemyNameSet() {
        const stamp = enemyNameSetStamp();
        if (!stamp) return null;
        if (_knownEnemyNameSetCache && _knownEnemyNameSetCacheStamp === stamp) return _knownEnemyNameSetCache;

        const set = new Set();
        for (let i = 1; i < $dataEnemies.length; i++) {
            const enemy = $dataEnemies[i];
            if (enemy && enemy.name) set.add(String(enemy.name));
        }
        _knownEnemyNameSetCache = set;
        _knownEnemyNameSetCacheStamp = stamp;
        return set;
    }

    function isKnownEnemyNameText(text) {
        const target = String(text || '');
        if (!target) return false;
        const set = ensureKnownEnemyNameSet();
        if (!set) return false;
        if (set.has(target)) return true;
        for (const base of set) {
            if (target.startsWith(base) && target.length > base.length) return true;
        }
        return false;
    }

    function isTranslatableItemObject(item) {
        if (!item) return false;
        if (typeof DataManager === 'undefined') return false;
        return !!(
            (DataManager.isItem && DataManager.isItem(item)) ||
            (DataManager.isWeapon && DataManager.isWeapon(item)) ||
            (DataManager.isArmor && DataManager.isArmor(item))
        );
    }

    function translateItemNameIfNeeded(name) {
        const original = String(name || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }
        logMissingTranslationOnce('item-name', original);
        return original;
    }

    function translateMapNameIfNeeded(name) {
        const original = String(name || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }
        if (mayBeSourceJapaneseText(original)) {
            logMissingTranslationOnce('map-name', original);
        }
        return original;
    }

    function translateEnemyNameIfNeeded(name) {
        const original = String(name || '');
        if (!original || !isRuntimeTranslationEnabled()) return original;

        const normalizedKey = replaceIconCodes(original);
        const first = lookupTranslationByKey(normalizedKey);
        if (first.found) return first.text;

        if (normalizedKey !== original) {
            const second = lookupTranslationByKey(original);
            if (second.found) return second.text;
        }
        if (mayBeSourceJapaneseText(original)) {
            logMissingTranslationOnce('enemy-name', original);
        }
        return original;
    }

    function cloneItemForTranslatedNameDisplay(item) {
        if (!isTranslatableItemObject(item)) return item;
        const translatedName = translateItemNameIfNeeded(item.name);
        if (translatedName === String(item.name || '')) return item;
        return Object.assign({}, item, { name: translatedName });
    }

    function installMvRuntimeTranslationHooks() {
        if (typeof Utils !== 'undefined' && Utils.RPGMAKER_NAME && Utils.RPGMAKER_NAME !== 'MV') {
            return;
        }
        if (typeof Game_Interpreter === 'undefined') return;
        if (Game_Interpreter.prototype._knhZxcTranslationRuntimeHooked) return;
        Game_Interpreter.prototype._knhZxcTranslationRuntimeHooked = true;

        const _Game_Interpreter_command101 = Game_Interpreter.prototype.command101;
        Game_Interpreter.prototype.command101 = function () {
            const result = _Game_Interpreter_command101.apply(this, arguments);
            // MVのcommand101は通常 false を返すため、戻り値では判定しない
            translatePendingMessageTextBlockIfNeeded();
            return result;
        };

        const _Game_Interpreter_setupChoices = Game_Interpreter.prototype.setupChoices;
        Game_Interpreter.prototype.setupChoices = function (params) {
            const patchedParams = translateChoicesParamIfNeeded(params);
            return _Game_Interpreter_setupChoices.call(this, patchedParams);
        };
    }

    function installCommandWindowNameTranslationHooks() {
        if (typeof Window_Command === 'undefined') return;
        if (Window_Command.prototype._knhZxcTranslationCommandNameHooked) return;
        Window_Command.prototype._knhZxcTranslationCommandNameHooked = true;

        const _Window_Command_addCommand = Window_Command.prototype.addCommand;
        Window_Command.prototype.addCommand = function (name, symbol, enabled, ext) {
            let nextName = name;

            // 選択肢はイベントコマンド102側でまとめ翻訳するため、ここでは触らない
            if (!(typeof Window_ChoiceList !== 'undefined' && this instanceof Window_ChoiceList)) {
                nextName = translateUiCommandNameIfNeeded(name);
            }

            return _Window_Command_addCommand.call(this, nextName, symbol, enabled, ext);
        };
    }

    function installActorNameTranslationHooks() {
        if (typeof Game_Actor !== 'undefined' && !Game_Actor.prototype._knhZxcTranslationNameHooked) {
            Game_Actor.prototype._knhZxcTranslationNameHooked = true;
            const _Game_Actor_name = Game_Actor.prototype.name;
            Game_Actor.prototype.name = function () {
                const rawName = _Game_Actor_name.apply(this, arguments);
                return translateActorNameIfNeeded(rawName);
            };
        }

        if (typeof Window_Base !== 'undefined' && !Window_Base.prototype._knhZxcTranslationDrawTextHooked) {
            Window_Base.prototype._knhZxcTranslationDrawTextHooked = true;
            const _Window_Base_drawText = Window_Base.prototype.drawText;
            Window_Base.prototype.drawText = function (text, x, y, maxWidth, align) {
                let nextText = text;
                if (typeof text === 'string' && text && isRuntimeTranslationEnabled()) {
                    if (isKnownActorNameText(text)) {
                        nextText = translateActorNameIfNeeded(text);
                    } else if (isKnownItemNameText(text)) {
                        nextText = translateItemNameIfNeeded(text);
                    } else if (isKnownMapNameText(text)) {
                        nextText = translateMapNameIfNeeded(text);
                    } else if (isKnownEnemyNameText(text)) {
                        nextText = translateEnemyNameIfNeeded(text);
                    }
                }
                return _Window_Base_drawText.call(this, nextText, x, y, maxWidth, align);
            };
        }
    }

    function installItemDisplayTranslationHooks() {
        if (typeof Window_Base !== 'undefined' && !Window_Base.prototype._knhZxcTranslationDrawItemNameHooked) {
            Window_Base.prototype._knhZxcTranslationDrawItemNameHooked = true;
            const _Window_Base_drawItemName = Window_Base.prototype.drawItemName;
            if (typeof _Window_Base_drawItemName === 'function') {
                Window_Base.prototype.drawItemName = function (item, x, y, width) {
                    return _Window_Base_drawItemName.call(this, cloneItemForTranslatedNameDisplay(item), x, y, width);
                };
            }
        }

    }

    function installTextManagerTranslationHooks() {
        if (typeof TextManager === 'undefined') return;
        if (TextManager._knhZxcTranslationHooked) return;
        TextManager._knhZxcTranslationHooked = true;

        const wrapMethod = (name, kind) => {
            const original = TextManager[name];
            if (typeof original !== 'function') return;
            TextManager[name] = function () {
                const result = original.apply(this, arguments);
                return translateTextManagerValueIfNeeded(kind, result);
            };
        };

        wrapMethod('basic', 'basic');
        wrapMethod('param', 'param');
        wrapMethod('command', 'command');
        wrapMethod('message', 'message');

        const currencyDesc = Object.getOwnPropertyDescriptor(TextManager, 'currencyUnit');
        if (currencyDesc && typeof currencyDesc.get === 'function') {
            const originalGet = currencyDesc.get;
            Object.defineProperty(TextManager, 'currencyUnit', {
                get: function () {
                    const value = originalGet.call(this);
                    return translateTextManagerValueIfNeeded('currencyUnit', value);
                },
                configurable: true
            });
        }
    }

    function installMapAndEnemyNameTranslationHooks() {
        if (typeof Game_Map !== 'undefined' && !Game_Map.prototype._knhZxcTranslationDisplayNameHooked) {
            Game_Map.prototype._knhZxcTranslationDisplayNameHooked = true;
            const _Game_Map_displayName = Game_Map.prototype.displayName;
            if (typeof _Game_Map_displayName === 'function') {
                Game_Map.prototype.displayName = function () {
                    const raw = _Game_Map_displayName.apply(this, arguments);
                    return translateMapNameIfNeeded(raw);
                };
            }
        }

        if (typeof Game_Enemy !== 'undefined' && !Game_Enemy.prototype._knhZxcTranslationEnemyNameHooked) {
            Game_Enemy.prototype._knhZxcTranslationEnemyNameHooked = true;
            const _Game_Enemy_name = Game_Enemy.prototype.name;
            if (typeof _Game_Enemy_name === 'function') {
                Game_Enemy.prototype.name = function () {
                    const raw = String(_Game_Enemy_name.apply(this, arguments) || '');
                    const suffix = (this && this._plural) ? String(this._letter || '') : '';
                    if (suffix && raw.endsWith(suffix)) {
                        const base = raw.slice(0, raw.length - suffix.length);
                        return translateEnemyNameIfNeeded(base) + suffix;
                    }
                    return translateEnemyNameIfNeeded(raw);
                };
            }
        }

        if (typeof Game_Troop !== 'undefined' && !Game_Troop.prototype._knhZxcTranslationEnemyNamesHooked) {
            Game_Troop.prototype._knhZxcTranslationEnemyNamesHooked = true;
            const _Game_Troop_enemyNames = Game_Troop.prototype.enemyNames;
            if (typeof _Game_Troop_enemyNames === 'function') {
                Game_Troop.prototype.enemyNames = function () {
                    const names = _Game_Troop_enemyNames.apply(this, arguments);
                    if (!Array.isArray(names) || !isRuntimeTranslationEnabled()) return names;
                    return names.map(name => translateEnemyNameIfNeeded(name));
                };
            }
        }
    }

    function installEnglishFontHooks() {
        if (typeof Window_Base === 'undefined') return;
        if (Window_Base.prototype._knhZxcTranslationEnglishFontHooked) return;
        Window_Base.prototype._knhZxcTranslationEnglishFontHooked = true;
        const shouldApplyEnglishSizeOffset = function (baseSize) {
            return Number(baseSize) > 20;
        };
        const hasJapaneseChars = function (text) {
            return /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/.test(String(text || ''));
        };

        const _Window_Base_standardFontFace = Window_Base.prototype.standardFontFace;
        Window_Base.prototype.standardFontFace = function () {
            if (getLanguageIdSafe() === 1) {
                return ENGLISH_FONT_FILE
                    ? `${ENGLISH_FONT_LOADED_NAME}, ${ENGLISH_FONT_FACE}`
                    : ENGLISH_FONT_FACE;
            }
            return _Window_Base_standardFontFace.apply(this, arguments);
        };
        Window_Base.prototype.kggFontFaceByText = function (text) {
            if (getLanguageIdSafe() !== 1) return this.standardFontFace();
            if (hasJapaneseChars(text)) return _Window_Base_standardFontFace.apply(this, arguments);
            return this.standardFontFace();
        };

        const _Window_Base_resetFontSettings = Window_Base.prototype.resetFontSettings;
        Window_Base.prototype.resetFontSettings = function () {
            const result = _Window_Base_resetFontSettings.apply(this, arguments);
            if (this.contents && getLanguageIdSafe() === 1 && this._kggFontTextHint != null) {
                this.contents.fontFace = this.kggFontFaceByText(this._kggFontTextHint);
            }
            return result;
        };

        const _Window_Base_drawText = Window_Base.prototype.drawText;
        Window_Base.prototype.drawText = function (text, x, y, maxWidth, align) {
            if (this.contents && getLanguageIdSafe() === 1) {
                const lastFace = this.contents.fontFace;
                this.contents.fontFace = this.kggFontFaceByText(text);
                const r = _Window_Base_drawText.call(this, text, x, y, maxWidth, align);
                this.contents.fontFace = lastFace;
                return r;
            }
            return _Window_Base_drawText.call(this, text, x, y, maxWidth, align);
        };

        const _Window_Base_drawTextEx = Window_Base.prototype.drawTextEx;
        Window_Base.prototype.drawTextEx = function (text, x, y) {
            const lastHint = this._kggFontTextHint;
            this._kggFontTextHint = text;
            const r = _Window_Base_drawTextEx.call(this, text, x, y);
            this._kggFontTextHint = lastHint;
            return r;
        };

        if (typeof Window_Base.prototype.drawTextNL === 'function') {
            const _Window_Base_drawTextNL = Window_Base.prototype.drawTextNL;
            Window_Base.prototype.drawTextNL = function (text, x, y, width, _fontReduce, _skipAutoResize) {
                const lastHint = this._kggFontTextHint;
                this._kggFontTextHint = text;
                const r = _Window_Base_drawTextNL.call(this, text, x, y, width, _fontReduce, _skipAutoResize);
                this._kggFontTextHint = lastHint;
                return r;
            };
        }

        if (ENGLISH_FONT_SIZE_OFFSET !== 0) {
            const _Window_Base_standardFontSize = Window_Base.prototype.standardFontSize;
            Window_Base.prototype.standardFontSize = function () {
                const base = _Window_Base_standardFontSize.apply(this, arguments);
                if (getLanguageIdSafe() === 1 && shouldApplyEnglishSizeOffset(base)) {
                    return Math.max(8, base + ENGLISH_FONT_SIZE_OFFSET);
                }
                return base;
            };
        }

        Window_Base.prototype.setFontSize = function (size, applyEnglishOffset) {
            if (!this.contents) return size;

            const numericSize = Number(size);
            if (!Number.isFinite(numericSize)) return this.contents.fontSize;

            let nextSize = numericSize;
            const shouldApplyOffset = applyEnglishOffset !== false;
            if (shouldApplyOffset && getLanguageIdSafe() === 1 && ENGLISH_FONT_SIZE_OFFSET !== 0) {
                // standardFontSize() は既に英語補正済みなので、同値の時は二重適用しない
                const currentStandard = (typeof this.standardFontSize === 'function')
                    ? Number(this.standardFontSize())
                    : NaN;
                if ((!Number.isFinite(currentStandard) || numericSize !== currentStandard) &&
                    shouldApplyEnglishSizeOffset(numericSize)) {
                    nextSize += ENGLISH_FONT_SIZE_OFFSET;
                }
            }

            nextSize = Math.max(8, Math.round(nextSize));
            this.contents.fontSize = nextSize;
            return nextSize;
        };

        if (typeof Window_Message !== 'undefined' && !Window_Message.prototype._knhZxcTranslationEnglishMessageFontHooked) {
            Window_Message.prototype._knhZxcTranslationEnglishMessageFontHooked = true;
            const _Window_Message_standardFontSize = Window_Message.prototype.standardFontSize;
            if (typeof _Window_Message_standardFontSize === 'function') {
                Window_Message.prototype.standardFontSize = function () {
                    const size = _Window_Message_standardFontSize.apply(this, arguments);
                    if (getLanguageIdSafe() !== 1 || ENGLISH_FONT_SIZE_OFFSET === 0) return size;
                    const isPopup = (typeof this.isPopup === 'function') ? this.isPopup() : false;
                    // MessageWindowPopup.js は popup 時に paramFontSize を直返しするため、ここで補正を重ねる
                    if (isPopup && shouldApplyEnglishSizeOffset(size)) return Math.max(8, size + ENGLISH_FONT_SIZE_OFFSET);
                    return size;
                };
            }

            const _Window_Message_resetFontSettings = Window_Message.prototype.resetFontSettings;
            if (typeof _Window_Message_resetFontSettings === 'function') {
                Window_Message.prototype.resetFontSettings = function () {
                    const result = _Window_Message_resetFontSettings.apply(this, arguments);
                    // 他プラグインが途中でサイズを書き換えても、メッセージ開始時に英語サイズを再適用
                    if (getLanguageIdSafe() === 1 && this.contents) {
                        this.contents.fontFace = this.standardFontFace();
                        this.setFontSize(this.standardFontSize(), false);
                    }
                    return result;
                };
            }
        }
    }

    function installEnglishMaskThresholdOverrides() {
        if (typeof Window_Message !== 'undefined') {
            Window_Message.prototype.kggSemiWhiteEdgeAlphaThreshold = function () {
                return ENGLISH_MASK_ALPHA_THRESHOLD_MESSAGE;
            };
        }
        if (typeof Window_ChoiceList !== 'undefined') {
            Window_ChoiceList.prototype.kggSemiWhiteEdgeAlphaThreshold = function () {
                return ENGLISH_MASK_ALPHA_THRESHOLD_CHOICE;
            };
        }
    }

    function installEnglishMaskThresholdWindowHooks() {
        if (typeof Window_Base === 'undefined') return;
        if (Window_Base.prototype._knhZxcTranslationMaskThresholdHooked) return;
        Window_Base.prototype._knhZxcTranslationMaskThresholdHooked = true;

        const _Window_Base_update = Window_Base.prototype.update;
        Window_Base.prototype.update = function () {
            _Window_Base_update.apply(this, arguments);

            let threshold = ENGLISH_MASK_ALPHA_THRESHOLD_DEFAULT;
            if (typeof this.kggSemiWhiteEdgeAlphaThreshold === 'function') {
                const v = Number(this.kggSemiWhiteEdgeAlphaThreshold());
                if (Number.isFinite(v)) threshold = v;
            }
            threshold = Math.max(0, Math.min(255, threshold));

            if (this.contents) this.contents._kggSemiWhiteEdgeAlphaThreshold = threshold;
            if (this._windowContentsSprite) this._windowContentsSprite._kggSemiWhiteEdgeAlphaThreshold = threshold;
            if (this._contents2) {
                this._contents2._kggSemiWhiteEdgeAlphaThreshold = threshold;
                if (this._contents2.bitmap) this._contents2.bitmap._kggSemiWhiteEdgeAlphaThreshold = threshold;
            }
        };
    }

    function runAutoTranslateApplyAsyncIfNeeded() {
        if (_autoTranslateApplyLaunched) return;
        if (!isTestPlayLogEnabled()) return;
        if (typeof Utils === 'undefined' || !Utils.isNwjs || !Utils.isNwjs()) return;
        if (!canUseNodeFs()) return;
        _autoTranslateApplyLaunched = true;

        const batPath = AUTO_TRANSLATE_APPLY_BAT_PATH;
        if (!batPath || !fs.existsSync(batPath)) {
            warnTestPlay(`${RUNTIME_LOG_PREFIX} 自動反映batが見つかりません: ${batPath}`);
            return;
        }

        let cp;
        try {
            cp = require('child_process');
        } catch (e) {
            warnTestPlay(`${RUNTIME_LOG_PREFIX} child_process の読み込みに失敗しました`, e);
            return;
        }

        try {
            const child = cp.spawn('cmd.exe', ['/c', batPath], {
                windowsHide: true,
                stdio: 'ignore'
            });

            child.on('error', function (e) {
                warnTestPlay(`${RUNTIME_LOG_PREFIX} 自動反映batの起動に失敗しました`, e);
            });

            child.on('close', function (code) {
                if (code !== 0) {
                    warnTestPlay(`${RUNTIME_LOG_PREFIX} 自動反映batが異常終了しました (code=${code})`);
                    return;
                }
                try {
                    const latestRawText = readTranslationRawText();
                    const changed = (_initialTranslationRawText !== null) && (latestRawText !== _initialTranslationRawText);
                    if (!changed) {
                        warnTestPlay(`${RUNTIME_LOG_PREFIX} 翻訳テーブルに変更がないため再起動は行いません`);
                        return;
                    }
                    loadTranslationTableAtStartup();
                    if (!_autoTranslateReloadTriggered) {
                        _autoTranslateReloadTriggered = true;
                        warnTestPlay(`${RUNTIME_LOG_PREFIX} 変更反映のためゲームを再起動します`);
                        if (typeof location !== 'undefined' && location && typeof location.reload === 'function') {
                            location.reload();
                        }
                    }
                    warnTestPlay(`${RUNTIME_LOG_PREFIX} 翻訳テーブルを自動再読み込みしました`);
                } catch (e) {
                    warnTestPlay(`${RUNTIME_LOG_PREFIX} 翻訳テーブルの自動再読み込みに失敗しました`, e);
                }
            });
        } catch (e) {
            warnTestPlay(`${RUNTIME_LOG_PREFIX} 自動反映batの実行で例外が発生しました`, e);
        }
    }

    function installAutoTranslateApplyAtBootHook() {
        if (typeof Scene_Boot === 'undefined') return;
        if (Scene_Boot.prototype._knhZxcTranslationAutoApplyHooked) return;
        Scene_Boot.prototype._knhZxcTranslationAutoApplyHooked = true;

        const _Scene_Boot_start = Scene_Boot.prototype.start;
        Scene_Boot.prototype.start = function () {
            runAutoTranslateApplyAsyncIfNeeded();
            return _Scene_Boot_start.apply(this, arguments);
        };
    }

    preloadEnglishFontIfNeeded();
    loadTranslationTableAtStartup();
    installAutoTranslateApplyAtBootHook();
    installMvRuntimeTranslationHooks();
    installCommandWindowNameTranslationHooks();
    installActorNameTranslationHooks();
    installItemDisplayTranslationHooks();
    installTextManagerTranslationHooks();
    installMapAndEnemyNameTranslationHooks();
    installEnglishFontHooks();
    installEnglishMaskThresholdOverrides();
    installEnglishMaskThresholdWindowHooks();

    // ====== Map読み込み ======
    function listMapIds() {
        const files = fs.readdirSync(projectDataDir());
        return files
            .filter(f => /^Map\d{3}\.json$/.test(f))
            .map(f => Number(f.match(/\d{3}/)[0]))
            .sort((a, b) => a - b);
    }

    function loadMapJson(mapId) {
        const file = path.join(projectDataDir(), `Map${String(mapId).padStart(3, '0')}.json`);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    function loadMapInfos() {
        const file = path.join(projectDataDir(), 'MapInfos.json');
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    function listMapIdsInEditorOrder(mapInfos) {
        if (Array.isArray(mapInfos)) {
            return mapInfos
                .filter(Boolean)
                .slice()
                .sort((a, b) => {
                    const aOrder = Number.isFinite(a.order) ? a.order : a.id;
                    const bOrder = Number.isFinite(b.order) ? b.order : b.id;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return (a.id || 0) - (b.id || 0);
                })
                .map(info => info.id);
        }
        return listMapIds();
    }

    // ====== Troops読み込み（戦闘グループ） ======
    function loadTroopsJson() {
        const file = path.join(projectDataDir(), 'Troops.json');
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    // ====== コマンドlistから抽出（Map/ Troop 共通） ======
    function extractRowsFromCommandList(list, context) {
        const state = context || { speaker: '', eventNameById: null };
        const rows = [];
        for (let i = 0; i < list.length; i++) {
            const cmd = list[i];

            const speakerToken = parseFukidashiSpeakerToken(cmd);
            if (speakerToken !== null) {
                state.speaker = resolveSpeakerNameFromToken(speakerToken, state.eventNameById);
                continue;
            }

            if (cmd.code === 117 && cmd.parameters && cmd.parameters[0] === 5) {
                state.speaker = '';
                continue;
            }

            // Show Text: 101 の後続 401 を結合（101のparametersは無視）
            if (cmd.code === 101) {
                const lines = [];
                let k = i + 1;
                while (list[k] && list[k].code === 401) {
                    lines.push(String(list[k].parameters[0] || ''));
                    k++;
                }
                i = k - 1; // 消費分スキップ

                if (lines.length > 0) {
                    const text = lines.join('\n');
                    if (text) rows.push(makeRow(state.speaker, text));
                }
            }

            // Show Choices: 102
            else if (cmd.code === 102) {
                const choices = (cmd.parameters && cmd.parameters[0]) ? cmd.parameters[0] : [];
                if (!choices.length) continue;

                if (JOIN_CHOICES_IN_ONE_ROW) {
                    const text = choices.map(c => String(c || '')).join('\n');
                    if (text) rows.push(makeRow('選択肢', text));
                } else {
                    for (const c of choices) {
                        const text = String(c || '');
                        if (text) rows.push(makeRow('選択肢', text));
                    }
                }
            }
        }
        return rows;
    }

    function compareEventsForExport(a, b) {
        const aNameRaw = String(a.name || '');
        const bNameRaw = String(b.name || '');
        const aAuto = aNameRaw.includes('自動実行') ? 0 : 1;
        const bAuto = bNameRaw.includes('自動実行') ? 0 : 1;
        if (aAuto !== bAuto) return aAuto - bAuto;

        const aName = normalizeEventName(aNameRaw);
        const bName = normalizeEventName(bNameRaw);
        if (aName !== bName) return aName < bName ? -1 : 1;
        return (a.id || 0) - (b.id || 0);
    }

    /**
     * 指定マップから、MapID→EventID→Page→Command の順で抽出
     * （重複除去はしない）
     */
    function extractOrderedRowsFromMap(map, mapId, mapName) {
        const rows = [];
        if (!map || !map.events) return rows;

        let mapHeaderAdded = false;
        let lastEventId = null;
        const events = map.events.filter(Boolean).sort(compareEventsForExport);
        const eventNameById = new Map();
        for (const ev of events) {
            eventNameById.set(ev.id || 0, normalizeEventName(ev.name || ''));
        }
        for (const ev of events) {
            const eventName = normalizeEventName(ev.name || '');
            const pages = ev.pages || [];
            let eventHeaderAdded = false;
            for (let p = 0; p < pages.length; p++) {
                const list = pages[p].list || [];
                const context = { speaker: eventName, eventNameById };
                const pageRows = extractRowsFromCommandList(list, context);
                if (!pageRows.length) continue;

                if (!mapHeaderAdded) {
                    if (rows.length > 0) rows.push(makeBlankRow());
                    rows.push(makeRow(buildMapHeader(mapId, mapName), ''));
                    mapHeaderAdded = true;
                }
                if (!eventHeaderAdded) {
                    if (lastEventId !== null) rows.push(makeBlankRow());
                    eventHeaderAdded = true;
                    lastEventId = ev.id || 0;
                }
                rows.push(makeRow(buildEventHeader(ev.id || 0, eventName, p + 1), ''));
                rows.push(...pageRows);
            }
        }
        return rows;
    }

    /**
     * Troops（戦闘グループ）から TroopID→Page→Command の順で抽出
     * （重複除去はしない）
     */
    function extractOrderedRowsFromTroops(troops) {
        const rows = [];
        if (!Array.isArray(troops)) return rows;

        // Troops.json は [null, troop1, troop2, ...] 形式が多い
        const list = troops.filter(Boolean).sort((a, b) => (a.id || 0) - (b.id || 0));

        for (const troop of list) {
            const pages = troop.pages || [];
            let troopHeaderAdded = false;
            for (let p = 0; p < pages.length; p++) {
                const cmdList = pages[p].list || [];
                const context = { speaker: '', eventNameById: null };
                const pageRows = extractRowsFromCommandList(cmdList, context);
                if (!pageRows.length) continue;

                if (!troopHeaderAdded) {
                    if (rows.length > 0) rows.push(makeBlankRow());
                    rows.push(makeRow(buildTroopHeader(troop.id || 0, troop.name || ''), ''));
                    troopHeaderAdded = true;
                }
                rows.push(...pageRows);
            }
        }
        return rows;
    }

    /** 全マップ → 全戦闘 の順で集め、初出順で一意化して配列で返す */
    function buildMapHeader(mapId, mapName) {
        return `${BLOCK_SEPARATOR}\n[マップ${mapId}]${mapName}\n${BLOCK_SEPARATOR}`;
    }

    function buildTroopHeader(troopId, troopName) {
        return `${BLOCK_SEPARATOR}\n[戦闘${troopId}]${TROOP_NAME_PREFIX}${troopName}\n${BLOCK_SEPARATOR}`;
    }

    function buildEventHeader(eventId, eventName, pageNumber) {
        const name = normalizeEventName(eventName || '');
        return `■[ev${eventId}]${name} <page:${pageNumber}>`;
    }

    function collectAllOrdered() {
        const result = [];
        const mapInfos = loadMapInfos();

        // ---- 1) マップ ----
        const mapIds = listMapIdsInEditorOrder(mapInfos);
        for (const id of mapIds) {
            try {
                const map = loadMapJson(id);
                if (map && String(map.note || '').includes('<noTextTranslate>')) {
                    continue;
                }
                const mapInfo = mapInfos && mapInfos[id] ? mapInfos[id] : null;
                const mapName = mapInfo && mapInfo.name ? mapInfo.name : '';
                const rows = extractOrderedRowsFromMap(map, id, mapName);
                if (rows.length && result.length) result.push(makeBlankRow());
                result.push(...rows);
            } catch (e) {
                warnTestPlay(`[TL_Extractor] Map${String(id).padStart(3, '0')} 読み込み失敗: ${e.message}`);
            }
        }

        // ---- 2) 戦闘（Troops） ----
        try {
            const troops = loadTroopsJson();
            if (!troops) {
                warnTestPlay('[TL_Extractor] Troops.json が見つかりませんでした（戦闘テキスト抽出スキップ）');
                return result;
            }

            const rows = extractOrderedRowsFromTroops(troops);
            if (rows.length && result.length) result.push(makeBlankRow());
            result.push(...rows);
        } catch (e) {
            warnTestPlay(`[TL_Extractor] Troops.json 読み込み失敗: ${e.message}`);
        }

        return result;
    }

    // ===== 2列HTML（スプレッドシートがセル内改行を維持） =====
    function buildHtmlTable1(list, includeHeader, stripControl = false) {
        const header = includeHeader ? '<tr><th>発言者</th><th>日本語</th></tr>\n' : '';
        const rows = list.map(row => {
            if (row.isBlank) return '<tr><td colspan="2"></td></tr>';
            const speakerText = formatExtractedText(row.speaker || '', stripControl);
            const cellText = formatExtractedText(row.text || '', stripControl);
            const speaker = htmlEscape(speakerText).replace(/\r?\n/g, '<br>');
            const cell = htmlEscape(cellText).replace(/\r?\n/g, '<br>');
            return `<tr><td>${speaker}</td><td>${cell}</td></tr>`;
        }).join('\n');
        return `<table border="0" cellpadding="0" cellspacing="0">${header}${rows}</table>`;
    }

    function toPlainText1(list, stripControl = false) {
        return list.map(row => {
            if (row.isBlank) return '';
            const speaker = normalizeLF(formatExtractedText(row.speaker || '', stripControl));
            const text = normalizeLF(formatExtractedText(row.text || '', stripControl));
            return `${speaker}\t${text}`;
        }).join('\r\n');
    }

    function toSpeakerText(list, stripControl = false) {
        return list.map(row => {
            if (row.isBlank) return '';
            const rawSpeaker = normalizeLF(formatExtractedText(row.speaker || '', stripControl));
            const rawText = normalizeLF(formatExtractedText(row.text || '', stripControl));
            if (!rawText && isHeaderSpeakerValue(rawSpeaker)) return rawSpeaker;

            let speaker = rawSpeaker.replace(/\r?\n/g, ' ');
            let text = rawText.replace(/\r?\n/g, ' ');
            if (!speaker) return text;
            if (!text) return speaker;
            return `${speaker}：${text}`;
        }).join('\r\n');
    }

    function csvEscape(value) {
        const text = String(value || '').replace(/"/g, '""');
        return `"${text}"`;
    }

    function toCsvText(list, includeHeader = false, stripControl = false) {
        const rows = [];
        if (includeHeader) rows.push(['発言者', '日本語']);
        for (const row of list) {
            if (row.isBlank) {
                rows.push(['', '']);
                continue;
            }
            let speaker = normalizeLF(formatExtractedText(row.speaker || '', stripControl));
            let text = normalizeLF(formatExtractedText(row.text || '', stripControl));
            if (!text && isHeaderSpeakerValue(speaker)) {
                text = speaker;
                speaker = '';
            }
            rows.push([speaker, text]);
        }
        return rows.map(cols => cols.map(csvEscape).join(',')).join('\r\n');
    }

    function isHeaderSpeakerValue(value) {
        const text = String(value || '');
        return text.includes('[マップ') ||
            text.includes('[戦闘') ||
            text.startsWith('■[ev') ||
            text.includes(BLOCK_SEPARATOR) ||
            text.includes(ALT_BLOCK_SEPARATOR);
    }

    /** 即コピー（環境によりHTMLが効かない場合あり） */
    window.TL_ExtractToClipboard = function (includeHeader = false) {
        const useTextMode = includeHeader === true;
        const stripControl = useTextMode;
        const list = collectAllOrdered();
        const table = buildHtmlTable1(list, includeHeader, false);
        const fragment = `<!--StartFragment-->${table}<!--EndFragment-->`;
        const txt = useTextMode ? toSpeakerText(list, stripControl) : toPlainText1(list, false);

        if (!clip || typeof clip.set !== 'function') {
            warnTestPlay('[TL_Extractor] clipboard API unavailable. fallback to copy window.');
            return window.TL_ExtractOpenCopyWindow(includeHeader);
        }

        try {
            if (!useTextMode) clip.set(fragment, 'html'); // HTML優先
            clip.set(txt, 'text');      // フォールバック
            const modeText = useTextMode ? 'テキスト' : '2列';
            alert(`? ${list.length} 行をコピーしました（${modeText}）。\nスプレッドシートに貼り付けてください。`);
        } catch (e) {
            errorTestPlay('[TL_Extractor] clipboard set failed:', e);
            clip.set(txt, 'text');
            alert('HTMLコピーに失敗したため、テキストでコピーしました。貼り付け結果を確認してください。');
        }
        return list.length;
    };

    /** 推奨：ポップアップを開いて確実にHTMLコピー */
    window.TL_ExtractOpenCopyWindow = function (includeHeader = false) {
        const list = collectAllOrdered();
        const useTextMode = includeHeader === true;
        const stripControl = useTextMode;
        const table = buildHtmlTable1(list, includeHeader, stripControl);
        const text = useTextMode ? toSpeakerText(list, stripControl) : toPlainText1(list, stripControl);

        const html = (
            `<!doctype html><html><head><meta charset="utf-8">
<title>翻訳抽出：${list.length} 行</title>
<style>
:root { --head-h: 56px; }
html,body{height:100%;margin:0;font:14px/1.6 system-ui, Segoe UI, sans-serif;color:#222;}
header{
position:sticky; top:0; z-index:10; height:var(--head-h);
display:flex; align-items:center; gap:8px; padding:8px 16px;
background:#fff; border-bottom:1px solid #ddd;
}
header h3{margin:0; font-size:16px; font-weight:600;}
#spacer{flex:1;}
button{padding:8px 14px; font-size:14px; border:1px solid #bbb; border-radius:8px; background:#f7f7f7; cursor:pointer;}
button.primary{background:#2f7cf6; color:#fff; border-color:#2f7cf6;}
#msg{margin-left:8px; color:#0a0; font-weight:600;}
#wrap{height:calc(100% - var(--head-h)); overflow:auto; padding:12px 16px;}
table{border-collapse:collapse; width:100%;}
td,th{border:1px solid #e1e1e1; padding:6px 8px; vertical-align:top; white-space:pre-wrap;}
th{background:#f5f5f5; position:sticky; top:0;}
</style>
</head><body>
<header>
<h3>翻訳抽出：${list.length} 行</h3>
<button id="copyBtn" class="primary">コピー</button><span id="msg"></span>
<div id="spacer"></div>
<button id="closeBtn" title="Esc でも閉じます">× 閉じる</button>
</header>
<div id="wrap"><div id="frag">${table}</div></div>
<script>
const textFallback = ${JSON.stringify(text)};
const textMode = ${includeHeader === true ? 'true' : 'false'};
function doCopy(){
if (textMode) {
let ok = false;
if (navigator.clipboard && navigator.clipboard.writeText) {
try{
navigator.clipboard.writeText(textFallback);
ok = true;
}catch(e){}
}
if (!ok) {
const ta = document.createElement('textarea');
ta.value = textFallback;
ta.style.position = 'fixed';
ta.style.opacity = '0';
document.body.appendChild(ta);
ta.select();
ok = document.execCommand('copy');
document.body.removeChild(ta);
}
document.getElementById('msg').textContent = ok ? 'コピーしました！' : 'コピーに失敗しました';
return;
}
const sel = window.getSelection();
const range = document.createRange();
range.selectNode(document.getElementById('frag'));
sel.removeAllRanges();
sel.addRange(range);
let ok = false;
if (navigator.clipboard && window.ClipboardItem) {
try{
const htmlBlob = new Blob([document.getElementById('frag').innerHTML], {type:'text/html'});
const textBlob = new Blob([textFallback], {type:'text/plain'});
navigator.clipboard.write([new ClipboardItem({'text/html': htmlBlob, 'text/plain': textBlob})]);
ok = true;
}catch(e){}
}
if (!ok) ok = document.execCommand('copy');
document.getElementById('msg').textContent = ok ? 'コピーしました！' : 'コピーに失敗しました';
}
document.getElementById('copyBtn').addEventListener('click', doCopy);
document.getElementById('closeBtn').addEventListener('click', ()=>window.close());
window.addEventListener('keydown', e=>{
if (e.key === 'Escape') window.close();
if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='c'){ e.preventDefault(); doCopy(); }
});
(function center(){
try{
window.resizeTo(${WINDOW_W}, ${WINDOW_H});
const x = Math.max(0,(screen.availWidth - ${WINDOW_W})/2);
const y = Math.max(0,(screen.availHeight- ${WINDOW_H})/2);
window.moveTo(x,y);
}catch(e){}
})();
</script>
</body></html>`
        );

        const win = window.open('about:blank', '_blank',
            `width=${WINDOW_W},height=${WINDOW_H},resizable=yes,scrollbars=yes`);
        win.document.open(); win.document.write(html); win.document.close();
        return list.length;
    };

    // デバッグ：文字列を直接取得したいとき用
    window.TL_GetExtractedPlainText = function () {
        return toPlainText1(collectAllOrdered(), false);
    };

})();
