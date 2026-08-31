//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Schema
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.3.0 (KNH_ZXC_EventEditor_Timeline_Schema)
 * @author kagaya
 * @help
 * KNH_ZXC_EventEditor.js の自動ロード用分割モジュールです。
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;

    var SH = NS._eeTimelineShared;
    if (!SH || !SH.ready) return;
    var clone = SH.clone;
    var compareEntriesByFrameWaitUid = SH.compareEntriesByFrameWaitUid;
    var RE_COMPACT_SELECT_KEY = SH.RE_COMPACT_SELECT_KEY;
    var RE_COMPACT_NUMBER_KEY = SH.RE_COMPACT_NUMBER_KEY;
    var RE_COMPACT_TEXT_KEY = SH.RE_COMPACT_TEXT_KEY;
    SH.beginModule('schema');

    // Command schemas, field bindings, and schema-driven editor controls.
    EE.prototype.paramToEditText = function(v) {
        if (typeof v === 'string') return v;
        if (v === null) return 'null';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        try { return JSON.stringify(v); } catch (_) { return String(v); }
    };

    EE.prototype.parseEditParamText = function(s, idx) {
        var t = String(s == null ? '' : s);
        var tr = t.trim();
        if (!tr.length) return '';
        if (tr === 'true') return true;
        if (tr === 'false') return false;
        if (tr === 'null') return null;
        if (/^-?\d+(\.\d+)?$/.test(tr)) return Number(tr);
        var c0 = tr.charAt(0);
        if (c0 === '{' || c0 === '[' || c0 === '"') {
            try { return JSON.parse(tr); } catch (e) {
                throw new Error('param' + (idx + 1) + ' JSON parse error: ' + e.message);
            }
        }
        return t;
    };

    EE.prototype.renderParamEditors = function(params) {
        params = Array.isArray(params) ? params : [];
        this.edParamInputs = [];
        if (!this.edParamList) return;
        this.edParamList.innerHTML = '';
        if (!params.length) {
            this.edParamList.appendChild(this.el('div', 'pempty', '(パラメータなし)'));
            return;
        }
        for (var i = 0; i < params.length; i++) {
            var row = this.el('div', 'prow');
            row.appendChild(this.el('div', 'plbl', 'param' + (i + 1)));
            var inp = this.el('textarea', '');
            inp.value = this.paramToEditText(params[i]);
            inp.rows = (typeof params[i] === 'string' && String(params[i]).indexOf('\n') >= 0) ? 3 : 2;
            row.appendChild(inp);
            this.edParamList.appendChild(row);
            this.edParamInputs.push(inp);
        }
    };

    EE.prototype.collectParamEditors = function() {
        var out = [];
        var ins = this.edParamInputs || [];
        for (var i = 0; i < ins.length; i++) out.push(this.parseEditParamText(ins[i].value, i));
        return out;
    };

    EE.prototype.getCachedSchemaOptions = function(key, builder) {
        if (!this._schemaOptionCache) this._schemaOptionCache = {};
        if (Object.prototype.hasOwnProperty.call(this._schemaOptionCache, key)) return this._schemaOptionCache[key];
        var out = [];
        try { out = builder.call(this) || []; } catch (_) { out = []; }
        this._schemaOptionCache[key] = out;
        return out;
    };

    EE.prototype.databaseOptionsForSchema = function(cacheKey, records, missingName, emptyLabel, useRecordId) {
        return this.getCachedSchemaOptions(cacheKey, function() {
            var out = [];
            var arr = Array.isArray(records) ? records : [];
            for (var i = 1; i < arr.length; i++) {
                var record = arr[i];
                if (!record) continue;
                var id = useRecordId ? Number(record.id || i) : i;
                var fallback = typeof missingName === 'function' ? missingName(id) : String(missingName || '(no name)');
                out.push({ value: id, label: ('0000' + id).slice(-4) + ' ' + String(record.name || fallback) });
            }
            if (!out.length) out.push({ value: 1, label: '0001 ' + String(emptyLabel || '(未設定)') });
            return out;
        });
    };

    EE.prototype.namedArrayOptionsForSchema = function(cacheKey, names, emptyLabel) {
        return this.getCachedSchemaOptions(cacheKey, function() {
            var out = [];
            var arr = Array.isArray(names) ? names : [];
            var fallback = String(emptyLabel || '(未設定)');
            for (var i = 1; i < arr.length; i++) {
                var name = String(arr[i] || fallback);
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + name });
            }
            if (!out.length) out.push({ value: 1, label: '0001 ' + fallback });
            return out;
        });
    };

    EE.prototype.actorOptionsForSchema = function() {
        return this.databaseOptionsForSchema('actors', $dataActors, function(id) { return 'Actor ' + id; }, '(未設定)', true);
    };

    EE.prototype.variableOptionsForSchema = function() {
        var names = ($dataSystem && Array.isArray($dataSystem.variables)) ? $dataSystem.variables : [];
        return this.namedArrayOptionsForSchema('variables', names, '(未設定)');
    };

    EE.prototype.commonEventOptionsForSchema = function() {
        return this.databaseOptionsForSchema('commonEvents', $dataCommonEvents, '(名称なし)', '(未設定)');
    };

    EE.prototype.itemTypeOptionsForSchema = function() {
        return [
            { value: 1, label: '通常アイテム' },
            { value: 2, label: '大事なもの' },
            { value: 3, label: '隠しアイテムA' },
            { value: 4, label: '隠しアイテムB' }
        ];
    };

    EE.prototype.buttonOptionsForSchema = function() {
        return [
            { value: 'ok', label: '決定 (ok)' },
            { value: 'cancel', label: 'キャンセル (cancel)' },
            { value: 'shift', label: 'Shift (shift)' },
            { value: 'control', label: 'Ctrl (control)' },
            { value: 'tab', label: 'Tab (tab)' },
            { value: 'pageup', label: 'PageUp (pageup)' },
            { value: 'pagedown', label: 'PageDown (pagedown)' },
            { value: 'up', label: '上 (up)' },
            { value: 'down', label: '下 (down)' },
            { value: 'left', label: '左 (left)' },
            { value: 'right', label: '右 (right)' }
        ];
    };

    EE.prototype.labelOptionsForSchema = function() {
        var out = [];
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return out;
        var used = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 118) continue;
            var name = String((e.command.parameters || [''])[0] || '');
            if (!name.length || used[name]) continue;
            used[name] = true;
            out.push({ value: name, label: name });
        }
        return out;
    };

    EE.prototype.mapInfoOptionsForSchema = function() {
        return this.getCachedSchemaOptions('mapInfos', function() {
            var out = [];
            var infos = $dataMapInfos || {};
            var keys = Object.keys(infos).map(function(k) { return Number(k); }).filter(function(n) { return !isNaN(n) && n > 0; });
            keys.sort(function(a, b) { return a - b; });
            for (var i = 0; i < keys.length; i++) {
                var id = keys[i];
                var it = infos[id];
                if (!it) continue;
                out.push({ value: id, label: ('0000' + id).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no map)' });
            return out;
        });
    };

    EE.prototype.tilesetOptionsForSchema = function() {
        return this.databaseOptionsForSchema('tilesets', $dataTilesets, '(no name)', '(no tileset)');
    };

    EE.prototype.enemyOptionsForSchema = function() {
        return this.databaseOptionsForSchema('enemies', $dataEnemies, '(no name)', '(no enemy)');
    };

    EE.prototype.stateOptionsForSchema = function() {
        return this.databaseOptionsForSchema('states', $dataStates, '(no name)', '(no state)');
    };

    EE.prototype.animationOptionsForSchema = function() {
        return this.databaseOptionsForSchema('animations', $dataAnimations, '(no name)', '(no animation)');
    };

    EE.prototype.itemOptionsForSchema = function() {
        return this.databaseOptionsForSchema('items', $dataItems, '(no name)', '(no item)');
    };

    EE.prototype.weaponOptionsForSchema = function() {
        return this.databaseOptionsForSchema('weapons', $dataWeapons, '(no name)', '(no weapon)');
    };

    EE.prototype.armorOptionsForSchema = function() {
        return this.databaseOptionsForSchema('armors', $dataArmors, '(no name)', '(no armor)');
    };

    EE.prototype.skillOptionsForSchema = function() {
        return this.databaseOptionsForSchema('skills', $dataSkills, '(no name)', '(no skill)');
    };

    EE.prototype.classOptionsForSchema = function() {
        return this.databaseOptionsForSchema('classes', $dataClasses, '(no name)', '(no class)');
    };

    EE.prototype.equipTypeOptionsForSchema = function() {
        var names = ($dataSystem && Array.isArray($dataSystem.equipTypes)) ? $dataSystem.equipTypes : [];
        return this.namedArrayOptionsForSchema('equipTypes', names, '(未設定)');
    };

    EE.prototype.characterTargetOptionsForSchema = function(withPlayer, withThisEvent) {
        var mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? Number($gameMap.mapId() || 0) : 0;
        var cacheKey = 'charTargets:' + mapId + ':' + (withPlayer !== false ? '1' : '0') + ':' + (withThisEvent !== false ? '1' : '0');
        return this.getCachedSchemaOptions(cacheKey, function() {
            var out = [];
            if (withPlayer !== false) out.push({ value: -1, label: '-1 プレイヤー' });
            if (withThisEvent !== false) out.push({ value: 0, label: '0 このイベント' });
            var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
            for (var i = 1; i < evs.length; i++) {
                var ev = evs[i];
                if (!ev) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(ev.name || '(no event)') });
            }
            if (!out.length) out.push({ value: 0, label: '0 このイベント' });
            return out;
        });
    };

    EE.prototype.balloonOptionsForSchema = function() {
        return [
            { value: 1, label: 'びっくり' },
            { value: 2, label: 'はてな' },
            { value: 3, label: '音符' },
            { value: 4, label: 'ハート' },
            { value: 5, label: '怒り' },
            { value: 6, label: '汗' },
            { value: 7, label: 'くしゃくしゃ' },
            { value: 8, label: '沈黙' },
            { value: 9, label: '電球' },
            { value: 10, label: 'zzz' },
            { value: 11, label: 'ユーザー定義1' },
            { value: 12, label: 'ユーザー定義2' },
            { value: 13, label: 'ユーザー定義3' },
            { value: 14, label: 'ユーザー定義4' },
            { value: 15, label: 'ユーザー定義5' }
        ];
    };

    EE.prototype.normalizeBalloonIdForSchema = function(value) {
        var id = Math.floor(Number(value || 1) || 1);
        return Math.max(1, Math.min(15, id));
    };

    EE.prototype.troopOptionsForSchema = function() {
        return this.databaseOptionsForSchema('troops', $dataTroops, '(no name)', '(no troop)');
    };

    EE.prototype.vehicleTypeOptionsForSchema = function() {
        return [
            { value: 0, label: '小型船' },
            { value: 1, label: '大型船' },
            { value: 2, label: '飛行船' }
        ];
    };

    EE.prototype.linesFromText = function(text, keepEmpty) {
        var s = String(text == null ? '' : text);
        if (!s.length) return keepEmpty ? [''] : [];
        var lines = s.split(/\r?\n/);
        while (lines.length > 0 && String(lines[lines.length - 1] || '').length === 0) lines.pop();
        if (!keepEmpty) {
            var out = [];
            for (var i = 0; i < lines.length; i++) {
                var t = String(lines[i] || '');
                if (t.length) out.push(t);
            }
            return out;
        }
        return lines;
    };

    EE.prototype.normalizeMessageWindowType = function(v) {
        v = Math.floor(Number(v || 0));
        if (v === -1 || v === 0 || v === 1 || v === 2) return v;
        return -1;
    };

    EE.prototype.normalizeMessageTailDir = function(v) {
        v = Math.floor(Number(v || 0));
        if (v < 1) return 1;
        if (v > 9) return 9;
        return v;
    };

    EE.prototype.normalizeMessageTargetCharId = function(v) {
        v = Math.floor(Number(v || 0));
        if (v === -1) return -1;
        if (v > 0) return v;
        return 0;
    };

    EE.prototype.sanitizeMessageExtState = function(st) {
        st = st || {};
        var mode = (String(st.targetMode || '') === 'coord') ? 'coord' : 'char';
        var x = Number(st.targetX == null ? 0 : st.targetX);
        var y = Number(st.targetY == null ? 0 : st.targetY);
        var addX = Number(st.addX == null ? 0 : st.addX);
        var addY = Number(st.addY == null ? 0 : st.addY);
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        return {
            windowType: this.normalizeMessageWindowType(st.windowType),
            tailDir: this.normalizeMessageTailDir(st.tailDir == null ? 5 : st.tailDir),
            targetMode: mode,
            targetCharId: this.normalizeMessageTargetCharId(st.targetCharId),
            targetX: Math.round(x),
            targetY: Math.round(y),
            addX: Math.round(addX),
            addY: Math.round(addY)
        };
    };

    EE.prototype.popupPortraitDefaults = function() {
        var api = window.KNH_ZXC_PopupPortrait;
        var source = api && api.defaults ? api.defaults : {};
        var animation = source.animation || {};
        return {
            fileName: '',
            index: Math.max(0, Math.min(7, Math.floor(Number(source.index || 0) || 0))),
            direction: this.normalizeDirection8(Number(source.direction || 2), 2),
            side: String(source.side || 'right') === 'left' ? 'left' : 'right',
            pattern: Math.max(0, Math.min(2, Math.floor(Number(source.pattern == null ? 1 : source.pattern) || 0))),
            offsetX: isFinite(Number(source.offsetX)) ? Number(source.offsetX) : 0,
            offsetY: isFinite(Number(source.offsetY)) ? Number(source.offsetY) : 0,
            viewWidth: Math.max(1, Number(source.viewWidth || 72) || 72),
            textGap: Math.max(0, Number(source.textGap == null ? 8 : source.textGap) || 0),
            animationType: String(animation.type || 'yura') === 'pattern' ? 'pattern' : 'fixed',
            timing: String(animation.timing || 'custom') === 'yura' ? 'yura' : 'custom',
            wait: Math.max(1, Math.floor(Number(animation.wait || 10) || 10)),
            sequence: this.normalizePopupPortraitPatternSequence(animation.sequence, [0, 1, 2, 1])
        };
    };

    EE.prototype.normalizePopupPortraitPatternSequence = function(value, fallback) {
        var source = value;
        if (typeof source === 'string') {
            var text = String(source || '').trim();
            if (text.length && text.charAt(0) !== '[') text = '[' + text + ']';
            try { source = JSON.parse(text); } catch (_) { source = null; }
        }
        if (!Array.isArray(source) || !source.length) source = Array.isArray(fallback) ? fallback : [0, 1, 2, 1];
        var out = [];
        for (var i = 0; i < source.length; i++) {
            var pattern = Math.floor(Number(source[i]));
            if (!isFinite(pattern) || pattern < 0 || pattern > 2) continue;
            out.push(pattern);
        }
        return out.length ? out : [1];
    };

    EE.prototype.parsePopupPortraitPatternSequence = function(value) {
        var text = String(value == null ? '' : value).trim();
        if (!text.length) return null;
        if (text.charAt(0) !== '[') text = '[' + text + ']';
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (_) { return null; }
        if (!Array.isArray(parsed) || !parsed.length) return null;
        var out = [];
        for (var i = 0; i < parsed.length; i++) {
            var pattern = Number(parsed[i]);
            if (!isFinite(pattern) || Math.floor(pattern) !== pattern || pattern < 0 || pattern > 2) return null;
            out.push(pattern);
        }
        return out.length ? out : null;
    };

    EE.prototype.popupPortraitSequenceLiteral = function(value) {
        return JSON.stringify(this.normalizePopupPortraitPatternSequence(value, [0, 1, 2, 1]));
    };

    EE.prototype.sanitizePopupPortrait = function(value) {
        if (!value || typeof value !== 'object') return null;
        var fileName = String(value.fileName == null ? '' : value.fileName).replace(/\.png$/i, '').trim();
        if (!fileName.length) return null;
        var api = window.KNH_ZXC_PopupPortrait;
        var normalized = api && typeof api.normalize === 'function' ? api.normalize(value) : null;
        var source = normalized || value;
        var defaults = this.popupPortraitDefaults();
        var animation = source.animation || {};
        var type = String(animation.type || defaults.animationType).toLowerCase();
        return {
            fileName: fileName,
            index: Math.max(0, Math.min(7, Math.floor(Number(source.index == null ? defaults.index : source.index) || 0))),
            direction: this.normalizeDirection8(Number(source.direction == null ? defaults.direction : source.direction), 2),
            side: String(source.side || defaults.side).toLowerCase() === 'left' ? 'left' : 'right',
            pattern: Math.max(0, Math.min(2, Math.floor(Number(source.pattern == null ? defaults.pattern : source.pattern) || 0))),
            offsetX: isFinite(Number(source.offsetX)) ? Number(source.offsetX) : defaults.offsetX,
            offsetY: isFinite(Number(source.offsetY)) ? Number(source.offsetY) : defaults.offsetY,
            viewWidth: Math.max(1, Number(source.viewWidth || defaults.viewWidth) || defaults.viewWidth),
            textGap: Math.max(0, Number(source.textGap == null ? defaults.textGap : source.textGap) || 0),
            animation: {
                type: type === 'pattern' ? 'pattern' : 'yura',
                timing: String(animation.timing || defaults.timing).toLowerCase() === 'yura' ? 'yura' : 'custom',
                wait: Math.max(1, Math.floor(Number(animation.wait || defaults.wait) || defaults.wait)),
                sequence: this.normalizePopupPortraitPatternSequence(animation.sequence, defaults.sequence)
            }
        };
    };

    EE.prototype.popupPortraitEditorState = function(value) {
        var defaults = this.popupPortraitDefaults();
        var portrait = this.sanitizePopupPortrait(value);
        if (!portrait) {
            return {
                specialMode: 'none',
                portraitFileName: defaults.fileName,
                portraitIndex: defaults.index,
                portraitDirection: defaults.direction,
                portraitSide: defaults.side,
                portraitAnimationType: defaults.animationType,
                portraitPattern: defaults.pattern,
                portraitPatternSequence: this.popupPortraitSequenceLiteral(defaults.sequence),
                portraitTiming: defaults.timing,
                portraitWait: defaults.wait,
                portraitOffsetX: defaults.offsetX,
                portraitOffsetY: defaults.offsetY,
                portraitViewWidth: defaults.viewWidth,
                portraitTextGap: defaults.textGap
            };
        }
        return {
            specialMode: 'portrait',
            portraitFileName: portrait.fileName,
            portraitIndex: portrait.index,
            portraitDirection: portrait.direction,
            portraitSide: portrait.side,
            portraitAnimationType: portrait.animation.type === 'pattern' ? 'pattern' : 'fixed',
            portraitPattern: portrait.pattern,
            portraitPatternSequence: this.popupPortraitSequenceLiteral(portrait.animation.sequence),
            portraitTiming: portrait.animation.timing,
            portraitWait: portrait.animation.wait,
            portraitOffsetX: portrait.offsetX,
            portraitOffsetY: portrait.offsetY,
            portraitViewWidth: portrait.viewWidth,
            portraitTextGap: portrait.textGap
        };
    };

    EE.prototype.popupPortraitFromEditorState = function(state) {
        state = state || {};
        if (String(state.specialMode || 'none') !== 'portrait') return null;
        var sequence = this.parsePopupPortraitPatternSequence(state.portraitPatternSequence);
        if (!sequence) sequence = this.popupPortraitDefaults().sequence;
        return this.sanitizePopupPortrait({
            fileName: state.portraitFileName,
            index: state.portraitIndex,
            direction: state.portraitDirection,
            side: state.portraitSide,
            pattern: state.portraitPattern,
            offsetX: state.portraitOffsetX,
            offsetY: state.portraitOffsetY,
            viewWidth: state.portraitViewWidth,
            textGap: state.portraitTextGap,
            animation: {
                type: String(state.portraitAnimationType || 'fixed') === 'pattern' ? 'pattern' : 'yura',
                timing: String(state.portraitTiming || this.popupPortraitDefaults().timing) === 'yura' ? 'yura' : 'custom',
                wait: state.portraitWait,
                sequence: sequence
            }
        });
    };

    EE.prototype.popupPortraitScriptOptions = function(value) {
        var portrait = this.sanitizePopupPortrait(value);
        if (!portrait) return null;
        var defaults = this.popupPortraitDefaults();
        var out = { fileName: portrait.fileName };
        if (portrait.index !== defaults.index) out.index = portrait.index;
        if (portrait.direction !== defaults.direction) out.direction = portrait.direction;
        if (portrait.side !== defaults.side) out.side = portrait.side;
        if (portrait.pattern !== defaults.pattern) out.pattern = portrait.pattern;
        if (portrait.offsetX !== defaults.offsetX) out.offsetX = portrait.offsetX;
        if (portrait.offsetY !== defaults.offsetY) out.offsetY = portrait.offsetY;
        if (portrait.viewWidth !== defaults.viewWidth) out.viewWidth = portrait.viewWidth;
        if (portrait.textGap !== defaults.textGap) out.textGap = portrait.textGap;
        var animation = portrait.animation;
        var animOut = {};
        if (animation.type === 'pattern') animOut.type = 'pattern';
        if (animation.type === 'pattern' && animation.timing !== defaults.timing) animOut.timing = animation.timing;
        if (animation.type === 'pattern' && animation.timing === 'custom' && animation.wait !== defaults.wait) animOut.wait = animation.wait;
        if (animation.type === 'pattern' && JSON.stringify(animation.sequence) !== JSON.stringify(defaults.sequence)) {
            animOut.sequence = animation.sequence.slice(0);
        }
        if (Object.keys(animOut).length) out.animation = animOut;
        return out;
    };

    EE.prototype.popupPortraitFromScriptEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var lines = Array.isArray(entry.scriptLines) ? entry.scriptLines : [];
        if (lines.length > 1) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        var match = String(line || '').trim().match(/^\$gameMessage\.setPopupPortrait\((\{.*\})\)\s*;?$/);
        if (!match) return null;
        var value = null;
        try { value = JSON.parse(match[1]); } catch (_) { return null; }
        return this.sanitizePopupPortrait(value);
    };

    EE.prototype.popupPortraitCommandFromEntry = function(entry) {
        if (!entry || Number((entry.command && entry.command.code) || 0) !== 101) return null;
        var options = this.popupPortraitScriptOptions(entry.popupPortrait);
        if (!options) return null;
        return {
            code: 355,
            indent: Math.max(0, Math.floor(Number(entry.command.indent || 0))),
            parameters: ['$gameMessage.setPopupPortrait(' + JSON.stringify(options) + ');']
        };
    };

    EE.prototype.defaultMessageExtState = function() {
        var st = {
            windowType: -1,
            tailDir: 5,
            targetMode: 'char',
            targetCharId: 0,
            targetX: 0,
            targetY: 0,
            addX: 0,
            addY: 0
        };
        try {
            if ($gameVariables && typeof $gameVariables.value === 'function') st.windowType = Number($gameVariables.value(14));
        } catch (_) {}
        try {
            if ($gameMessage) st.tailDir = Number($gameMessage._tailDir == null ? 5 : $gameMessage._tailDir);
        } catch (_) {}
        try {
            if ($gameSystem && typeof $gameSystem.getMessagePopupFree === 'function') {
                var fr = $gameSystem.getMessagePopupFree();
                if (fr && fr.x != null && fr.y != null) {
                    st.targetMode = 'coord';
                    st.targetX = Number(fr.x || 0);
                    st.targetY = Number(fr.y || 0);
                }
            }
        } catch (_) {}
        try {
            if ($gameSystem && typeof $gameSystem.getPopupAdjustPosition === 'function') {
                var adj = $gameSystem.getPopupAdjustPosition();
                if (adj && adj.length >= 2) {
                    st.addX = Number(adj[0] == null ? 0 : adj[0]);
                    st.addY = Number(adj[1] == null ? 0 : adj[1]);
                }
            }
        } catch (_) {}
        if (st.targetMode !== 'coord') {
            try {
                if ($gameSystem && $gameSystem._messagePopupCharacterId != null) {
                    st.targetCharId = this.normalizeMessageTargetCharId(Number($gameSystem._messagePopupCharacterId || 0));
                }
            } catch (_) {}
        }
        return this.sanitizeMessageExtState(st);
    };

    EE.prototype.findEventIdByMessageTargetName = function(name) {
        var t = String(name == null ? '' : name).trim();
        if (!t.length) return 0;
        var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
        for (var i = 1; i < evs.length; i++) {
            var ev = evs[i];
            if (!ev) continue;
            if (String(ev.name || '') === t) return i;
        }
        return 0;
    };

    EE.prototype.messageTargetTokenForOutput = function(charId) {
        var cid = this.normalizeMessageTargetCharId(charId);
        if (cid <= 0) return String(cid);
        var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[cid] : null;
        var name = ev && ev.name ? String(ev.name) : '';
        return name.length ? name : String(cid);
    };

    EE.prototype.stripTrailingLineComment = function(line) {
        var s = String(line == null ? '' : line);
        var idx = s.indexOf('//');
        if (idx >= 0) s = s.slice(0, idx);
        return s.trim();
    };

    EE.prototype.singleScriptCodeLineFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return '';
        var lines = [];
        if (Array.isArray(entry.scriptLines) && entry.scriptLines.length) lines = entry.scriptLines.slice(0);
        else lines = [String((entry.command.parameters || [''])[0] || '')];
        var codeLines = [];
        for (var i = 0; i < lines.length; i++) {
            var ln = String(lines[i] || '').trim();
            if (!ln.length) continue;
            if (/^\/\//.test(ln)) continue;
            codeLines.push(ln);
        }
        if (codeLines.length !== 1) return '';
        return codeLines[0];
    };

    EE.prototype.parseCameraMoveScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var m = src.match(/^\$gameMap\.(scrollCamera|scrollCameraTo)\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s*;?$/i);
        if (!m) return null;
        var kindRaw = String(m[1] || '').toLowerCase();
        var kind = (kindRaw === 'scrollcamerato') ? 'scrollTo' : 'scroll';
        return {
            kind: kind,
            x: Number(m[2]),
            y: Number(m[3]),
            d: Math.max(1, Math.floor(Number(m[4]) || 1))
        };
    };

    EE.prototype.cameraMoveSpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseCameraMoveScriptLine(line);
    };

    EE.prototype.parseCharacterRequestAnimationScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var m = src.match(/^this\.character\(\s*(-?\d+)\s*\)\.requestAnimation(?:Ex)?\(\s*(\d+)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*)?)?)?\)\s*;?$/i);
        if (!m) return null;
        var targetId = this.normalizeMoveTarget(Number(m[1] || 0));
        var animationId = Math.max(1, Math.floor(Number(m[2] || 1) || 1));
        var addX = (m[3] == null) ? 0 : Number(m[3]);
        var addY = (m[4] == null) ? 0 : Number(m[4]);
        var scale = (m[5] == null) ? 1 : Number(m[5]);
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        return {
            targetId: targetId,
            animationId: animationId,
            addX: addX,
            addY: addY,
            scale: scale
        };
    };

    EE.prototype.animationRequestSpecFromEntry = function(entry) {
        if (!entry || !entry.command) return null;
        var cmd = entry.command;
        var code = Number(cmd.code || 0);
        if (code === 355) {
            var line = this.singleScriptCodeLineFromEntry(entry);
            if (!line.length) return null;
            return this.parseCharacterRequestAnimationScriptLine(line);
        }
        if (code === 212) {
            var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
            return {
                targetId: this.normalizeMoveTarget(Number(p[0] || 0)),
                animationId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                addX: 0,
                addY: 0,
                scale: 1,
                wait: !!p[2]
            };
        }
        return null;
    };

    EE.prototype.parseCharacterTeleportScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var mPlayer = src.match(/^\$gamePlayer\.locateTo\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*\)\s*;?$/i);
        if (mPlayer) {
            return {
                targetId: -1,
                x: Number(mPlayer[1]),
                y: Number(mPlayer[2])
            };
        }
        var m = src.match(/^this\.character\(\s*(-?\d+)\s*\)\.locateTo\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*\)\s*;?$/i);
        if (!m) return null;
        return {
            targetId: this.normalizeMoveTarget(Number(m[1] || 0)),
            x: Number(m[2]),
            y: Number(m[3])
        };
    };

    EE.prototype.teleportSpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseCharacterTeleportScriptLine(line);
    };

    EE.prototype.parseMapBgmAutoplayScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        return /^\$gameMap\.autoplay\(\s*\)\s*;?$/i.test(src) ? {} : null;
    };

    EE.prototype.mapBgmAutoplaySpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseMapBgmAutoplayScriptLine(line);
    };

    EE.prototype.parseScreenFadeZxcScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var mOut = src.match(/^\$gameScreen\.startFadeOutZXC\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?$/i);
        if (mOut) {
            return {
                kind: 'fadeOut',
                d: Math.max(1, Math.floor(Number(mOut[1] || 1) || 1)),
                c: Math.max(0, Math.min(1, Math.floor(Number(mOut[2] || 0) || 0)))
            };
        }
        var mIn = src.match(/^\$gameScreen\.startFadeInZXC\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?$/i);
        if (mIn) {
            return {
                kind: 'fadeIn',
                d: Math.max(1, Math.floor(Number(mIn[1] || 1) || 1)),
                c: Math.max(0, Math.min(1, Math.floor(Number(mIn[2] || 0) || 0)))
            };
        }
        return null;
    };

    EE.prototype.screenFadeZxcSpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseScreenFadeZxcScriptLine(line);
    };

    EE.prototype.mainCommandDisplayCodeForEntry = function(entry) {
        if (!entry || !entry.command) return 0;
        var code = Number(entry.command.code || 0);
        if (code !== 355) return code;
        var camSpec = this.cameraMoveSpecFromEntry(entry);
        if (camSpec) return (camSpec.kind === 'scrollTo') ? 35551 : 35550;
        var teleportSpec = this.teleportSpecFromEntry(entry);
        if (teleportSpec) return 35552;
        var mapBgmSpec = this.mapBgmAutoplaySpecFromEntry(entry);
        if (mapBgmSpec) return 35553;
        var fadeSpec = this.screenFadeZxcSpecFromEntry(entry);
        if (fadeSpec) {
            // NOTE: Display code mapping is intentionally inverted to match requested labels.
            return (fadeSpec.kind === 'fadeOut') ? 35554 : 35555;
        }
        var ssShowSpec = this.spriteSheetPictureShowSpecFromEntry(entry);
        if (ssShowSpec) return 35556;
        var ssPlaySpec = this.spriteSheetPicturePlaySpecFromEntry(entry);
        if (ssPlaySpec) return 35557;
        var ssStopSpec = this.spriteSheetPictureStopSpecFromEntry(entry);
        if (ssStopSpec) return 35558;
        var animSpec = this.animationRequestSpecFromEntry(entry);
        if (animSpec) return 212;
        return code;
    };

    EE.prototype.makeCameraMoveScript = function(kind, x, y, duration) {
        var k = (String(kind || '') === 'scrollTo') ? 'scrollTo' : 'scroll';
        var fn = (k === 'scrollTo') ? 'scrollCameraTo' : 'scrollCamera';
        var sx = this.formatCoordText(Number(x || 0), 2, false);
        var sy = this.formatCoordText(Number(y || 0), 2, false);
        var d = Math.max(1, Math.floor(Number(duration || 60) || 60));
        return '$gameMap.' + fn + '(' + sx + ', ' + sy + ', ' + d + ')';
    };

    EE.prototype.makeCharacterRequestAnimationScript = function(targetId, animationId, addX, addY, scale) {
        var tid = this.normalizeMoveTarget(Number(targetId || 0));
        var aid = Math.max(1, Math.floor(Number(animationId || 1) || 1));
        var x = this.formatCoordText(Number(addX || 0), 2, false);
        var y = this.formatCoordText(Number(addY || 0), 2, false);
        var s = Number(scale == null ? 1 : scale);
        if (!isFinite(s) || s <= 0) s = 1;
        var sc = this.formatCoordText(s, 2, false);
        return 'this.character(' + tid + ').requestAnimation(' + aid + ', ' + x + ', ' + y + ', ' + sc + ')';
    };

    EE.prototype.makeCharacterTeleportScript = function(targetId, x, y) {
        var tid = this.normalizeMoveTarget(Number(targetId || 0));
        var tx = this.formatCoordText(Number(x || 0), 2, false);
        var ty = this.formatCoordText(Number(y || 0), 2, false);
        if (tid === -1) return '$gamePlayer.locateTo(' + tx + ', ' + ty + ')';
        return 'this.character(' + tid + ').locateTo(' + tx + ', ' + ty + ')';
    };

    EE.prototype.splitTopLevelCallArgs = function(argText) {
        var s = String(argText == null ? '' : argText);
        var out = [];
        var cur = '';
        var depthParen = 0;
        var depthBrack = 0;
        var depthBrace = 0;
        var inS = false;
        var inD = false;
        var esc = false;
        for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i);
            cur += ch;
            if (esc) { esc = false; continue; }
            if (ch === '\\') { esc = true; continue; }
            if (inS) { if (ch === "'") inS = false; continue; }
            if (inD) { if (ch === '"') inD = false; continue; }
            if (ch === "'") { inS = true; continue; }
            if (ch === '"') { inD = true; continue; }
            if (ch === '(') { depthParen++; continue; }
            if (ch === ')') { depthParen = Math.max(0, depthParen - 1); continue; }
            if (ch === '[') { depthBrack++; continue; }
            if (ch === ']') { depthBrack = Math.max(0, depthBrack - 1); continue; }
            if (ch === '{') { depthBrace++; continue; }
            if (ch === '}') { depthBrace = Math.max(0, depthBrace - 1); continue; }
            if (ch === ',' && depthParen === 0 && depthBrack === 0 && depthBrace === 0) {
                out.push(cur.slice(0, -1).trim());
                cur = '';
            }
        }
        if (cur.trim().length) out.push(cur.trim());
        return out;
    };

    EE.prototype.parseSchemaScriptArg = function(token) {
        var t = String(token == null ? '' : token).trim();
        if (!t.length) return '';
        if (t === 'null') return null;
        if (t === 'true') return true;
        if (t === 'false') return false;
        if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
        if ((t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') ||
            (t.charAt(0) === "'" && t.charAt(t.length - 1) === "'")) {
            if (t.charAt(0) === '"') {
                try { return JSON.parse(t); } catch (_) { return t.slice(1, -1); }
            }
            var body = t.slice(1, -1);
            body = body.replace(/\\\\/g, '\\').replace(/\\'/g, "'");
            return body;
        }
        if (t.charAt(0) === '[' || t.charAt(0) === '{') {
            try { return JSON.parse(t); } catch (_) { return t; }
        }
        return t;
    };

    EE.prototype.parseInterpreterCommandCallLine = function(scriptLine, commandName) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var re = new RegExp('^this\\.' + String(commandName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\((.*)\\)\\s*;?$', 'i');
        var m = src.match(re);
        if (!m) return null;
        return this.splitTopLevelCallArgs(String(m[1] || ''));
    };

    EE.prototype.parseShowSpriteSheetPictureScriptLine = function(scriptLine) {
        var args = this.parseInterpreterCommandCallLine(scriptLine, 'command_showSpriteSheetPicture');
        if (!args || args.length < 11) return null;
        var v = [];
        for (var i = 0; i < args.length; i++) v.push(this.parseSchemaScriptArg(args[i]));
        return {
            pictureId: Math.max(1, Math.floor(Number(v[0] || 1) || 1)),
            pictureName: String(v[1] == null ? '' : v[1]),
            rows: Math.max(1, Math.floor(Number(v[2] || 1) || 1)),
            cols: Math.max(1, Math.floor(Number(v[3] || 1) || 1)),
            origin: Math.max(0, Math.min(1, Math.floor(Number(v[4] || 0) || 0))),
            x: Number(v[5] || 0),
            y: Number(v[6] || 0),
            scaleX: Number(v[7] == null ? 100 : v[7]),
            scaleY: Number(v[8] == null ? 100 : v[8]),
            opacity: Math.max(0, Math.min(255, Math.floor(Number(v[9] == null ? 255 : v[9]) || 255))),
            blendMode: Math.max(0, Math.min(3, Math.floor(Number(v[10] || 0) || 0)))
        };
    };

    EE.prototype.parsePlaySpriteSheetPictureScriptLine = function(scriptLine) {
        var args = this.parseInterpreterCommandCallLine(scriptLine, 'command_playSpriteSheetPicture');
        if (!args || args.length < 4) return null;
        var v = [];
        for (var i = 0; i < args.length; i++) v.push(this.parseSchemaScriptArg(args[i]));
        var orderSpec = '';
        if (Array.isArray(v[1])) orderSpec = '[' + v[1].join(',') + ']';
        else if (v[1] != null) orderSpec = String(v[1]);
        return {
            pictureId: Math.max(1, Math.floor(Number(v[0] || 1) || 1)),
            orderSpec: String(orderSpec || ''),
            frameWait: Math.max(1, Math.floor(Number(v[2] || 1) || 1)),
            loop: !!v[3]
        };
    };

    EE.prototype.parseStopSpriteSheetPictureScriptLine = function(scriptLine) {
        var args = this.parseInterpreterCommandCallLine(scriptLine, 'command_stopSpriteSheetPicture');
        if (!args || args.length < 1) return null;
        var v = this.parseSchemaScriptArg(args[0]);
        return {
            pictureId: Math.max(1, Math.floor(Number(v || 1) || 1))
        };
    };

    EE.prototype.spriteSheetPictureShowSpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseShowSpriteSheetPictureScriptLine(line);
    };

    EE.prototype.spriteSheetPicturePlaySpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parsePlaySpriteSheetPictureScriptLine(line);
    };

    EE.prototype.spriteSheetPictureStopSpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseStopSpriteSheetPictureScriptLine(line);
    };

    EE.prototype.makeShowSpriteSheetPictureScript = function(state) {
        state = state || {};
        var id = Math.max(1, Math.floor(Number(state.pictureId || 1) || 1));
        var name = String(state.pictureName == null ? '' : state.pictureName);
        var rows = Math.max(1, Math.floor(Number(state.rows || 1) || 1));
        var cols = Math.max(1, Math.floor(Number(state.cols || 1) || 1));
        var origin = Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0)));
        var x = this.formatCoordText(Number(state.x || 0), 2, false);
        var y = this.formatCoordText(Number(state.y || 0), 2, false);
        var scaleX = this.formatCoordText(Number(state.scaleX == null ? 100 : state.scaleX), 2, false);
        var scaleY = this.formatCoordText(Number(state.scaleY == null ? 100 : state.scaleY), 2, false);
        var opacity = Math.max(0, Math.min(255, Math.floor(Number(state.opacity == null ? 255 : state.opacity) || 255)));
        var blendMode = Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0)));
        return 'this.command_showSpriteSheetPicture('
            + id + ', ' + JSON.stringify(name) + ', ' + rows + ', ' + cols + ', '
            + origin + ', ' + x + ', ' + y + ', ' + scaleX + ', ' + scaleY + ', ' + opacity + ', ' + blendMode
            + ');';
    };

    EE.prototype.makePlaySpriteSheetPictureScript = function(state) {
        state = state || {};
        var id = Math.max(1, Math.floor(Number(state.pictureId || 1) || 1));
        var orderSpec = String(state.orderSpec == null ? '' : state.orderSpec).trim();
        var orderArg = 'null';
        if (orderSpec.length) {
            if (/^[-+]?\d+(?:\.\d+)?$/.test(orderSpec)) orderArg = String(Math.floor(Number(orderSpec) || 0));
            else orderArg = JSON.stringify(orderSpec);
        }
        var fw = Math.max(1, Math.floor(Number(state.frameWait || 1) || 1));
        var lp = !!state.loop;
        return 'this.command_playSpriteSheetPicture(' + id + ', ' + orderArg + ', ' + fw + ', ' + (lp ? 'true' : 'false') + ');';
    };

    EE.prototype.makeStopSpriteSheetPictureScript = function(state) {
        state = state || {};
        var id = Math.max(1, Math.floor(Number(state.pictureId || 1) || 1));
        return 'this.command_stopSpriteSheetPicture(' + id + ');';
    };

    EE.prototype.messageSettingPatchFromEntry = function(entry) {
        if (!entry || !entry.command) return null;
        var cmd = entry.command;
        var code = Number(cmd.code || 0);
        var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
        if (code === 122) {
            var a = Math.floor(Number(p[0] || 0));
            var b = Math.floor(Number(p[1] || 0));
            var op = Math.floor(Number(p[2] || 0));
            var ot = Math.floor(Number(p[3] || 0));
            if (a === 14 && b === 14 && op === 0 && ot === 0) {
                return { windowType: Math.floor(Number(p[4] || 0)) };
            }
            return null;
        }
        if (code === 355) {
            var line = this.singleScriptCodeLineFromEntry(entry);
            if (!line.length) return null;
            var src = this.stripTrailingLineComment(line);
            var mTail = src.match(/^\$gameMessage\._tailDir\s*=\s*(-?\d+)\s*;?$/i);
            if (mTail) return { tailDir: Math.floor(Number(mTail[1] || 0)) };
            var mSet = src.match(/^\$gameSystem\.setMessagePopupFree\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*;?$/i);
            if (mSet) {
                return {
                    targetMode: 'coord',
                    targetX: Number(mSet[1]),
                    targetY: Number(mSet[2])
                };
            }
            if (/^\$gameSystem\.clearMessagePopupFree\(\s*\)\s*;?$/i.test(src)) {
                return { targetMode: 'char' };
            }
            return null;
        }
        if (code === 356) {
            var txt = String(p[0] || '').trim();
            var mAdj = txt.match(/^フキダシウィンドウ調整\s+位置\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
            if (mAdj) {
                return {
                    addX: Number(mAdj[1]),
                    addY: Number(mAdj[2])
                };
            }
            if (txt.indexOf('フキダシウィンドウ有効化') !== 0) return null;
            var rest = txt.slice('フキダシウィンドウ有効化'.length).trim();
            if (!rest.length) return null;
            var parts = rest.split(/\s+/);
            var tok = String(parts[0] || '');
            if (!tok.length) return null;
            var cid = 0;
            if (/^-?\d+$/.test(tok)) cid = this.normalizeMessageTargetCharId(Number(tok));
            else {
                var evId = this.findEventIdByMessageTargetName(tok);
                if (!evId) return null;
                cid = this.normalizeMessageTargetCharId(evId);
            }
            return { targetMode: 'char', targetCharId: cid };
        }
        return null;
    };

    EE.prototype.applyMessageSettingPatch = function(state, patch) {
        state = this.sanitizeMessageExtState(state || {});
        if (!patch || typeof patch !== 'object') return state;
        if (Object.prototype.hasOwnProperty.call(patch, 'windowType')) state.windowType = this.normalizeMessageWindowType(patch.windowType);
        if (Object.prototype.hasOwnProperty.call(patch, 'tailDir')) state.tailDir = this.normalizeMessageTailDir(patch.tailDir);
        if (Object.prototype.hasOwnProperty.call(patch, 'targetMode')) {
            var mode = (String(patch.targetMode || '') === 'coord') ? 'coord' : 'char';
            state.targetMode = mode;
            if (mode === 'char' && Object.prototype.hasOwnProperty.call(patch, 'targetCharId')) {
                state.targetCharId = this.normalizeMessageTargetCharId(patch.targetCharId);
            }
            if (mode === 'coord') {
                var nx = Number(patch.targetX == null ? state.targetX : patch.targetX);
                var ny = Number(patch.targetY == null ? state.targetY : patch.targetY);
                if (isFinite(nx)) state.targetX = Math.round(nx);
                if (isFinite(ny)) state.targetY = Math.round(ny);
            }
        } else if (Object.prototype.hasOwnProperty.call(patch, 'targetCharId')) {
            state.targetMode = 'char';
            state.targetCharId = this.normalizeMessageTargetCharId(patch.targetCharId);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'addX')) {
            var nax = Number(patch.addX == null ? state.addX : patch.addX);
            if (isFinite(nax)) state.addX = Math.round(nax);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'addY')) {
            var nay = Number(patch.addY == null ? state.addY : patch.addY);
            if (isFinite(nay)) state.addY = Math.round(nay);
        }
        return this.sanitizeMessageExtState(state);
    };

    EE.prototype.messageExtStateAtPoint = function(tr, frame, uidLimit) {
        var st = this.defaultMessageExtState();
        if (!tr || !Array.isArray(tr.commands)) return st;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        uidLimit = (uidLimit == null) ? Infinity : Math.floor(Number(uidLimit || 0));
        var list = tr.commands.slice(0);
        list.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var ef = Math.max(0, Math.floor(Number(e.frame || 0)));
            var eu = Math.floor(Number(e.uid || 0));
            if (ef > frame) break;
            if (ef === frame && eu >= uidLimit) break;
            if (Number(e.command.code || 0) === 101 && e.messageExt) {
                st = this.sanitizeMessageExtState(e.messageExt);
                continue;
            }
            var pt = this.messageSettingPatchFromEntry(e);
            if (pt) st = this.applyMessageSettingPatch(st, pt);
        }
        return this.sanitizeMessageExtState(st);
    };

    EE.prototype.mergeMessageSettingsIntoShowTextEntries = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return;
        SH.sortTrackCommands(tr);
        var st = this.defaultMessageExtState();
        var remove = Object.create(null);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command) continue;
            var code = Number(e.command.code || 0);
            if (code === 101) {
                e.popupPortrait = null;
                var portraitEntry = i > 0 ? tr.commands[i - 1] : null;
                if (portraitEntry && Number(portraitEntry.frame || 0) === Number(e.frame || 0) &&
                    Number((portraitEntry.command && portraitEntry.command.indent) || 0) === Number((e.command && e.command.indent) || 0)) {
                    var portrait = this.popupPortraitFromScriptEntry(portraitEntry);
                    if (portrait) {
                        e.popupPortrait = portrait;
                        remove[Math.floor(Number(portraitEntry.uid || 0))] = true;
                    }
                }
                for (var j = i - 1; j >= 0; j--) {
                    var p = tr.commands[j];
                    if (!p) continue;
                    if (Number(p.frame || 0) !== Number(e.frame || 0)) break;
                    var pp = this.messageSettingPatchFromEntry(p);
                    if (!pp) continue;
                    remove[Math.floor(Number(p.uid || 0))] = true;
                }
                e.messageExt = this.sanitizeMessageExtState(st);
                st = this.sanitizeMessageExtState(e.messageExt);
                continue;
            }
            var patch = this.messageSettingPatchFromEntry(e);
            if (patch) st = this.applyMessageSettingPatch(st, patch);
        }
        tr.commands = tr.commands.filter(function(e2) {
            var u = Math.floor(Number(e2 && e2.uid || 0));
            return !remove[u];
        });
    };

    EE.prototype.messageExtCommandsFromEntry = function(entry) {
        if (!entry || Number((entry.command && entry.command.code) || 0) !== 101 || !entry.messageExt) return [];
        var ext = this.sanitizeMessageExtState(entry.messageExt);
        var indent = Math.max(0, Math.floor(Number((entry.command && entry.command.indent) || 0)));
        var out = [];
        out.push({ code: 122, indent: indent, parameters: [14, 14, 0, 0, Math.floor(Number(ext.windowType || 0))] });
        if (ext.targetMode === 'coord') {
            out.push({ code: 355, indent: indent, parameters: ['$gameSystem.setMessagePopupFree(' + Math.round(Number(ext.targetX || 0)) + ', ' + Math.round(Number(ext.targetY || 0)) + ')'] });
        } else {
            var tok = this.messageTargetTokenForOutput(ext.targetCharId);
            out.push({ code: 355, indent: indent, parameters: ['$gameSystem.clearMessagePopupFree()'] });
            out.push({ code: 356, indent: indent, parameters: ['フキダシウィンドウ有効化 ' + tok + ' 1'] });
            out.push({ code: 356, indent: indent, parameters: ['フキダシウィンドウ調整 位置 ' + Math.round(Number(ext.addX || 0)) + ' ' + Math.round(Number(ext.addY || 0))] });
        }
        out.push({ code: 355, indent: indent, parameters: ['$gameMessage._tailDir = ' + Math.floor(Number(ext.tailDir || 0))] });
        return out;
    };

    EE.prototype.messageExtDeltaForOutput = function(entry, prevState) {
        var prev = prevState ? this.sanitizeMessageExtState(prevState) : null;
        if (!entry || Number((entry.command && entry.command.code) || 0) !== 101 || !entry.messageExt) {
            return { commands: [], nextState: prev };
        }
        var ext = this.sanitizeMessageExtState(entry.messageExt);
        var indent = Math.max(0, Math.floor(Number((entry.command && entry.command.indent) || 0)));
        var out = [];
        if (!prev || prev.windowType !== ext.windowType) {
            out.push({ code: 122, indent: indent, parameters: [14, 14, 0, 0, Math.floor(Number(ext.windowType || 0))] });
        }
        var targetChanged = !prev || prev.targetMode !== ext.targetMode;
        if (!targetChanged) {
            if (ext.targetMode === 'coord') {
                targetChanged = (prev.targetX !== ext.targetX || prev.targetY !== ext.targetY);
            } else {
                targetChanged = (prev.targetCharId !== ext.targetCharId);
            }
        }
        if (targetChanged) {
            if (ext.targetMode === 'coord') {
                out.push({ code: 355, indent: indent, parameters: ['$gameSystem.setMessagePopupFree(' + Math.round(Number(ext.targetX || 0)) + ', ' + Math.round(Number(ext.targetY || 0)) + ')'] });
            } else {
                var tok = this.messageTargetTokenForOutput(ext.targetCharId);
                out.push({ code: 355, indent: indent, parameters: ['$gameSystem.clearMessagePopupFree()'] });
                out.push({ code: 356, indent: indent, parameters: ['フキダシウィンドウ有効化 ' + tok + ' 1'] });
            }
        }
        if (ext.targetMode === 'char') {
            var prevAddX = 0;
            var prevAddY = 0;
            if (prev) {
                prevAddX = Math.round(Number(prev.addX || 0));
                prevAddY = Math.round(Number(prev.addY || 0));
            } else {
                var def = this.defaultMessageExtState();
                prevAddX = Math.round(Number(def.addX || 0));
                prevAddY = Math.round(Number(def.addY || 0));
            }
            if (prevAddX !== ext.addX || prevAddY !== ext.addY) {
                out.push({ code: 356, indent: indent, parameters: ['フキダシウィンドウ調整 位置 ' + Math.round(Number(ext.addX || 0)) + ' ' + Math.round(Number(ext.addY || 0))] });
            }
        }
        if (!prev || prev.tailDir !== ext.tailDir) {
            out.push({ code: 355, indent: indent, parameters: ['$gameMessage._tailDir = ' + Math.floor(Number(ext.tailDir || 0))] });
        }
        return { commands: out, nextState: ext };
    };

    EE.prototype.getEditorSchema = function(code) {
        this.ensureEditorSchemas();
        return this._editorSchemas[Number(code || 0)] || null;
    };

    EE.prototype.schemaWithPendingAddWaitLimit = function(schema, entry) {
        if (!schema || !entry) return schema;
        if (!this._pendingNewUid || Number(entry.uid || 0) !== Number(this._pendingNewUid)) return schema;
        var maxWait = Math.floor(Number(entry._pendingWaitMaxFrames || 0));
        if (maxWait < 1) return schema;
        var fields = Array.isArray(schema.fields) ? schema.fields : null;
        if (!fields || !fields.length) return schema;
        var changed = false;
        var nextFields = [];
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            if (!f || f.type !== 'number' || String(f.key || '') !== 'duration') {
                nextFields.push(f);
                continue;
            }
            var nf = {};
            for (var k in f) nf[k] = f[k];
            nf.min = Math.max(1, Math.floor(Number(nf.min == null ? 1 : nf.min) || 1));
            nf.max = maxWait;
            if (nf.hint) nf.hint = String(nf.hint) + ' / 新規追加時の上限: ' + maxWait + 'f';
            else nf.hint = '新規追加時の上限: ' + maxWait + 'f';
            nextFields.push(nf);
            changed = true;
        }
        if (!changed) return schema;
        var out = {};
        for (k in schema) out[k] = schema[k];
        out.fields = nextFields;
        return out;
    };

    EE.prototype.resolveSchemaOptions = function(field, state) {
        if (!field) return [];
        if (typeof field.options === 'function') {
            try { return field.options.call(this, state) || []; } catch (_) { return []; }
        }
        return Array.isArray(field.options) ? field.options : [];
    };

    EE.prototype.normalizeSchemaOption = function(op) {
        if (op == null) return { value: '', label: '' };
        if (typeof op === 'object') {
            return {
                value: (op.value == null ? '' : op.value),
                label: String(op.label == null ? op.value : op.label)
            };
        }
        return { value: op, label: String(op) };
    };

    EE.prototype.normalizeSchemaOptions = function(options) {
        var src = Array.isArray(options) ? options : [];
        if (!this._schemaNormalizedOptionCache && typeof WeakMap !== 'undefined') {
            this._schemaNormalizedOptionCache = new WeakMap();
        }
        var wm = this._schemaNormalizedOptionCache;
        if (wm && wm.has(src)) return wm.get(src);
        var out = new Array(src.length);
        var sig = 'n=' + String(src.length);
        for (var i = 0; i < src.length; i++) {
            var it = this.normalizeSchemaOption(src[i]);
            var lbl = String(it.label == null ? '' : it.label);
            var val = String(it.value == null ? '' : it.value);
            sig += '\x1f' + val + '\x1e' + lbl;
            out[i] = {
                value: it.value,
                label: lbl,
                _labelLc: lbl.toLowerCase(),
                _valueLc: val.toLowerCase()
            };
        }
        out._eeOptionSig = sig;
        if (wm) wm.set(src, out);
        return out;
    };

    EE.prototype.schemaOptionsSignature = function(options) {
        var arr = Array.isArray(options) ? options : [];
        if (arr._eeOptionSig != null) return String(arr._eeOptionSig);
        var sig = 'n=' + String(arr.length);
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            var val = (it && typeof it === 'object' && Object.prototype.hasOwnProperty.call(it, 'value')) ? it.value : it;
            var lbl = (it && typeof it === 'object' && Object.prototype.hasOwnProperty.call(it, 'label')) ? it.label : it;
            sig += '\x1f' + String(val == null ? '' : val) + '\x1e' + String(lbl == null ? '' : lbl);
        }
        arr._eeOptionSig = sig;
        return sig;
    };

    EE.prototype.schemaFieldShouldCompact = function(field, state) {
        if (!field || field.full) return false;
        if (field.compact === true) return true;
        if (field.compact === false) return false;
        if (field.type === 'textarea' || field.type === 'list' || field.type === 'bool') return false;

        var key = String(field.key || '');
        if (field.type === 'select') {
            var opts = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state));
            if (!opts.length) return false;
            var maxLen = 0;
            for (var i = 0; i < opts.length; i++) {
                var ln = String(opts[i].label || '').trim().length;
                if (ln > maxLen) maxLen = ln;
            }
            if (maxLen <= 8 && opts.length <= 16) return true;
            if (RE_COMPACT_SELECT_KEY.test(key)) return true;
            return false;
        }

        if (field.type === 'number') {
            var hasMin = (field.min != null && isFinite(Number(field.min)));
            var hasMax = (field.max != null && isFinite(Number(field.max)));
            if (hasMin && hasMax) {
                var min = Number(field.min);
                var max = Number(field.max);
                if (Math.abs(max - min) <= 999999) return true;
            }
            if (RE_COMPACT_NUMBER_KEY.test(key)) return true;
            return false;
        }

        if (field.type === 'text') {
            if (field.maxLength != null && Number(field.maxLength) <= 12) return true;
            if (RE_COMPACT_TEXT_KEY.test(key) && String(field.label || '').length <= 8) return true;
        }
        return false;
    };

    EE.prototype.fillSchemaSelect = function(select, options, value) {
        if (!select) return;
        var valueStr = (value == null ? '' : String(value));
        var sig = this.schemaOptionsSignature(options) + '\x1d' + valueStr;
        if (select._eeSchemaFillSig === sig) {
            if (value != null && select.value !== valueStr) select.value = valueStr;
            if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
            return;
        }
        select.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < options.length; i++) {
            var src = options[i];
            var it = (src && typeof src === 'object' &&
                Object.prototype.hasOwnProperty.call(src, 'label') &&
                Object.prototype.hasOwnProperty.call(src, 'value'))
                ? src
                : this.normalizeSchemaOption(src);
            var op = document.createElement('option');
            op.value = String(it.value);
            op.textContent = it.label;
            frag.appendChild(op);
        }
        select.appendChild(frag);
        if (value != null) select.value = valueStr;
        if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
        select._eeSchemaFillSig = sig;
    };

    EE.prototype.fitSchemaFieldLabel = function(label) {
        if (!label || !label.style) return;
        label.style.fontSize = '';
        var available = Math.floor(Number(label.clientWidth || 0));
        if (available <= 0) return;

        var baseSize = 12;
        label.style.fontSize = baseSize + 'px';
        var required = Math.ceil(Number(label.scrollWidth || 0));
        if (required <= available) return;

        var low = 1;
        var high = baseSize;
        var best = low;
        label.style.fontSize = low + 'px';
        if (Number(label.scrollWidth || 0) > available) return;
        for (var i = 0; i < 12; i++) {
            var size = (low + high) / 2;
            label.style.fontSize = size + 'px';
            if (Number(label.scrollWidth || 0) <= available) {
                best = size;
                low = size;
            } else {
                high = size;
            }
        }
        label.style.fontSize = Math.floor(best * 10) / 10 + 'px';
    };

    EE.prototype.fitSchemaFieldLabels = function() {
        if (!this.edSchemaFields || !this.edSchemaFields.querySelectorAll) return;
        var labels = this.edSchemaFields.querySelectorAll('.sfr-label');
        for (var i = 0; i < labels.length; i++) this.fitSchemaFieldLabel(labels[i]);
    };

    EE.prototype.scheduleSchemaFieldLabelFit = function() {
        if (this._schemaLabelFitPending) return;
        this._schemaLabelFitPending = true;
        var self = this;
        var run = function() {
            self._schemaLabelFitPending = false;
            self.fitSchemaFieldLabels();
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
        else setTimeout(run, 0);
    };

    EE.prototype.ensureSchemaFieldLabelFitObserver = function() {
        var target = this.edSchemaFields;
        if (!target) return;
        if (this._schemaLabelFitObservedTarget === target) return;
        if (this._schemaLabelFitObserver && this._schemaLabelFitObserver.disconnect) {
            this._schemaLabelFitObserver.disconnect();
        }
        this._schemaLabelFitObservedTarget = target;
        this._schemaLabelFitObservedWidth = -1;
        var self = this;
        if (typeof ResizeObserver !== 'undefined') {
            this._schemaLabelFitObserver = new ResizeObserver(function(entries) {
                var entry = entries && entries[0];
                var width = entry && entry.contentRect ? Number(entry.contentRect.width || 0) : Number(target.clientWidth || 0);
                if (Math.abs(width - Number(self._schemaLabelFitObservedWidth || 0)) < 0.5) return;
                self._schemaLabelFitObservedWidth = width;
                self.scheduleSchemaFieldLabelFit();
            });
            this._schemaLabelFitObserver.observe(target);
        } else if (typeof window !== 'undefined' && window.addEventListener && !this._schemaLabelFitResizeHandler) {
            this._schemaLabelFitResizeHandler = function() { self.scheduleSchemaFieldLabelFit(); };
            window.addEventListener('resize', this._schemaLabelFitResizeHandler);
        }
    };

    EE.prototype.renderSchemaField = function(field, value, state) {
        var selfEE = this;
        var makeFieldLabel = function(text) {
            return selfEE.el('label', 'sfr-label', String(text == null ? '' : text));
        };
        var isMessageTextField = !!(
            this.editSchema &&
            Number(this.editSchema.code || 0) === 101 &&
            String(field && field.key || '') === 'text' &&
            String(field && field.type || '') === 'textarea'
        );
        var emojiDefs = isMessageTextField ? [
            { glyph: '❗️', code: '\\i[16]' },
            { glyph: '‼️', code: '\\i[17]' },
            { glyph: '⁉️', code: '\\i[18]' },
            { glyph: '🎶', code: '\\i[19]' },
            { glyph: '🎵', code: '\\i[20]' }
        ] : null;
        var emojiDisplayFromControlText = function(text) {
            text = String(text == null ? '' : text);
            if (!emojiDefs || !emojiDefs.length) return text;
            for (var i = 0; i < emojiDefs.length; i++) {
                var em = emojiDefs[i];
                text = text.replace(new RegExp(String(em.code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(em.glyph));
            }
            return text;
        };
        var emojiControlFromDisplayText = function(text) {
            text = String(text == null ? '' : text);
            if (!emojiDefs || !emojiDefs.length) return text;
            for (var i = 0; i < emojiDefs.length; i++) {
                var em = emojiDefs[i];
                text = text.split(String(em.glyph)).join(String(em.code));
            }
            return text;
        };
        var insertControlTextAtCursor = function(input, insertText) {
            if (!input) return;
            insertText = String(insertText == null ? '' : insertText);
            var val = String(input.value || '');
            var start = Number(input.selectionStart);
            var end = Number(input.selectionEnd);
            if (!isFinite(start) || !isFinite(end)) {
                input.value = val + insertText;
                try { input.focus(); } catch (_) {}
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
            if (start < 0) start = 0;
            if (end < start) end = start;
            input.value = val.slice(0, start) + insertText + val.slice(end);
            var nextPos = start + insertText.length;
            try { input.focus(); } catch (_) {}
            try { input.setSelectionRange(nextPos, nextPos); } catch (_) {}
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        var row = this.el('div', 'sfr' + (field.full ? ' full' : ''));
        if (field && field.span != null) {
            var sp = Math.max(1, Math.min(4, Math.floor(Number(field.span || 0) || 0)));
            if (sp > 0) row.style.gridColumn = 'span ' + sp;
        }
        row.setAttribute('data-fkey', String(field && field.key || ''));
        var binding = { field: field, row: row, input: null, getValue: null, visible: true, searchInput: null, optionSource: null };
        if (field.type === 'bool') row.classList.add('bool');
        if (field.type === 'list') row.classList.add('list');
        if (this.schemaFieldShouldCompact(field, state)) row.classList.add('compact');

        if (field.type !== 'bool') {
            if (isMessageTextField) {
                var head = this.el('div', 'sfrh');
                var lbl = makeFieldLabel(field.label || field.key || '');
                head.appendChild(lbl);
                var tool = this.el('div', 'txemo-bar');
                for (var ei = 0; ei < emojiDefs.length; ei++) {
                    var em = emojiDefs[ei];
                    var eb = this.el('button', 'txemo-item', String(em.glyph));
                    eb.type = 'button';
                    eb.setAttribute('data-code', String(em.code));
                    eb.title = String(em.code);
                    eb.addEventListener('click', (function(code) {
                        return function(ev) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            if (binding && binding.input) insertControlTextAtCursor(binding.input, emojiDisplayFromControlText(String(code)));
                        };
                    })(em.code));
                    tool.appendChild(eb);
                }
                head.appendChild(tool);
                row.appendChild(head);
            } else {
                row.appendChild(makeFieldLabel(field.label || field.key || ''));
            }
        }

        if (field.type === 'textarea') {
            var ta = this.el('textarea', '');
            ta.value = isMessageTextField
                ? emojiDisplayFromControlText(String(value == null ? '' : value))
                : String(value == null ? '' : value);
            if (field.rows) ta.rows = Math.max(2, Number(field.rows || 0));
            if (this.editSchema && Number(this.editSchema.code || 0) === 101 && String(field.key || '') === 'text') {
                ta.rows = 4;
                ta.style.minHeight = '76px';
                ta.style.height = '76px';
                ta.style.maxHeight = '76px';
            }
            if (isMessageTextField) {
                ta.addEventListener('blur', function() {
                    var cur = String(ta.value || '');
                    var next = emojiDisplayFromControlText(cur);
                    if (cur !== next) ta.value = next;
                });
            }
            row.appendChild(ta);
            binding.input = ta;
            binding.getValue = function() {
                var t = String(ta.value || '');
                return isMessageTextField ? emojiControlFromDisplayText(t) : t;
            };
        } else if (field.type === 'text') {
            var tx = this.el('input', '');
            tx.type = 'text';
            tx.value = String(value == null ? '' : value);
            row.appendChild(tx);
            binding.input = tx;
            binding.getValue = function() { return String(tx.value || ''); };
        } else if (field.type === 'characterImage') {
            var imageField = this.el('div', 'charimg-field');
            var imageName = this.el('input', '');
            imageName.type = 'text';
            imageName.value = String(value == null ? '' : value);
            var imagePick = this.el('button', 'charimg-pick', '画像を選択');
            imagePick.type = 'button';
            imagePick.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof selfEE.openCharacterImagePickerForSchemaBinding === 'function') {
                    selfEE.openCharacterImagePickerForSchemaBinding(binding);
                }
            });
            imageField.appendChild(imageName);
            imageField.appendChild(imagePick);
            row.appendChild(imageField);
            binding.input = imageName;
            binding.pickButton = imagePick;
            binding.getValue = function() {
                var name = String(imageName.value || '').trim().replace(/\.png$/i, '');
                if (field.required && !name.length) throw new Error((field.label || field.key) + ' を選択してください');
                return name;
            };
        } else if (field.type === 'patternSequence') {
            var sequenceInput = this.el('input', '');
            sequenceInput.type = 'text';
            sequenceInput.value = String(value == null ? '[0,1,2,1]' : value);
            row.appendChild(sequenceInput);
            binding.input = sequenceInput;
            binding.getValue = function() {
                var sequence = selfEE.parsePopupPortraitPatternSequence(sequenceInput.value);
                if (!sequence) throw new Error((field.label || field.key) + ' は 0～2 の配列で入力してください');
                return JSON.stringify(sequence);
            };
        } else if (field.type === 'bool') {
            var cb = this.el('input', '');
            cb.type = 'checkbox';
            cb.checked = !!value;
            row.appendChild(makeFieldLabel(field.label || field.key || ''));
            row.appendChild(cb);
            binding.input = cb;
            binding.getValue = function() { return !!cb.checked; };
        } else if (field.type === 'switch') {
            var sw = this.el('input', '');
            sw.type = 'text';
            sw.readOnly = true;
            sw.title = 'クリックでスイッチ選択';
            if (selfEE.setSwitchEditorFieldValue) selfEE.setSwitchEditorFieldValue(sw, value == null ? 1 : value);
            else sw.value = String(value == null ? 1 : value);
            sw.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof selfEE.openSwitchPickerForSchemaBinding === 'function') {
                    selfEE.openSwitchPickerForSchemaBinding(binding);
                }
            });
            sw.addEventListener('keydown', function(e) {
                var k = String(e && e.key || '');
                if (k !== 'Enter' && k !== ' ') return;
                e.preventDefault();
                if (typeof selfEE.openSwitchPickerForSchemaBinding === 'function') {
                    selfEE.openSwitchPickerForSchemaBinding(binding);
                }
            });
            row.appendChild(sw);
            binding.input = sw;
            binding.getValue = function() {
                if (selfEE.switchEditorFieldValue) return selfEE.switchEditorFieldValue(sw, value == null ? 1 : value);
                return Math.max(1, Math.floor(Number(sw.value || 1) || 1));
            };
        } else if (field.type === 'variable') {
            var vr = this.el('input', '');
            vr.type = 'text';
            vr.readOnly = true;
            vr.title = 'クリックで変数選択';
            if (selfEE.setVariableEditorFieldValue) selfEE.setVariableEditorFieldValue(vr, value == null ? 1 : value);
            else vr.value = String(value == null ? 1 : value);
            vr.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof selfEE.openVariablePickerForSchemaBinding === 'function') {
                    selfEE.openVariablePickerForSchemaBinding(binding);
                }
            });
            vr.addEventListener('keydown', function(e) {
                var k = String(e && e.key || '');
                if (k !== 'Enter' && k !== ' ') return;
                e.preventDefault();
                if (typeof selfEE.openVariablePickerForSchemaBinding === 'function') {
                    selfEE.openVariablePickerForSchemaBinding(binding);
                }
            });
            row.appendChild(vr);
            binding.input = vr;
            binding.getValue = function() {
                if (selfEE.variableEditorFieldValue) return selfEE.variableEditorFieldValue(vr, value == null ? 1 : value);
                return Math.max(1, Math.floor(Number(vr.value || 1) || 1));
            };
        } else if (field.type === 'number') {
            var nu = this.el('input', '');
            nu.type = 'number';
            if (field.min != null) nu.min = String(field.min);
            if (field.max != null) nu.max = String(field.max);
            if (field.step != null) nu.step = String(field.step);
            nu.value = String(value == null ? (field.defaultValue == null ? '' : field.defaultValue) : value);
            this.attachNumberWheelInput(nu);
            row.appendChild(nu);
            binding.input = nu;
            binding.getValue = function() {
                var n = Number(nu.value);
                if (!isFinite(n)) throw new Error((field.label || field.key) + ' は数値で入力してください');
                if (field.integer !== false) n = Math.floor(n);
                if (field.min != null && n < field.min) throw new Error((field.label || field.key) + ' は ' + field.min + ' 以上で入力してください');
                if (field.max != null && n > field.max) throw new Error((field.label || field.key) + ' は ' + field.max + ' 以下で入力してください');
                return n;
            };
        } else if (field.type === 'taildir') {
            var cur = this.normalizeMessageTailDir(value == null ? 5 : value);
            var hidden = this.el('input', '');
            hidden.type = 'hidden';
            hidden.value = String(cur);
            var grid = this.el('div', 'tdg');
            var order = [7, 8, 9, 4, 5, 6, 1, 2, 3];
            var marks = {
                7: '↖', 8: '↑', 9: '↗',
                4: '←', 5: '・', 6: '→',
                1: '↙', 2: '↓', 3: '↘'
            };
            var btns = [];
            var refreshGrid = function() {
                var sel = Math.floor(Number(hidden.value || 5) || 5);
                for (var bi = 0; bi < btns.length; bi++) {
                    var b = btns[bi];
                    b.classList.toggle('on', Number(b.getAttribute('data-dir') || 0) === sel);
                }
            };
            for (var di = 0; di < order.length; di++) {
                var dir = order[di];
                var bt = this.el('button', 'tdgb', String(marks[dir] || dir));
                bt.type = 'button';
                bt.setAttribute('data-dir', String(dir));
                bt.title = String(dir);
                bt.addEventListener('click', (function(d) {
                    return function(ev) {
                        ev.preventDefault();
                        hidden.value = String(d);
                        refreshGrid();
                        selfEE.refreshSchemaFieldVisibility();
                    };
                })(dir));
                btns.push(bt);
                grid.appendChild(bt);
            }
            refreshGrid();
            row.appendChild(grid);
            row.appendChild(hidden);
            binding.input = hidden;
            binding.getValue = function() {
                return selfEE.normalizeMessageTailDir(hidden.value);
            };
        } else if (field.type === 'select' || field.type === 'list') {
            var search = null;
            if (field.type === 'list' && field.search) {
                search = this.el('input', '');
                search.type = 'text';
                search.placeholder = '検索...';
                row.appendChild(search);
            }
            var sl = this.el('select', '');
            if (field.type === 'list') sl.size = (String(field.key || '') === 'actorId') ? 6 : 10;
            this.attachSelectWheelInput(sl);
            var allOptions = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state));
            binding.optionSource = allOptions;
            this.fillSchemaSelect(sl, allOptions, value);
            if (search) {
                search.addEventListener('input', function() {
                    selfEE.applySchemaListFilter(binding);
                    selfEE.refreshSchemaFieldVisibility();
                });
                binding.searchInput = search;
            }
            row.appendChild(sl);
            binding.input = sl;
            binding.getValue = function() {
                var v = sl.value;
                if (field.valueType === 'number') return Math.floor(Number(v || 0) || 0);
                return String(v == null ? '' : v);
            };
        } else {
            var unk = this.el('input', '');
            unk.type = 'text';
            unk.value = String(value == null ? '' : value);
            row.appendChild(unk);
            binding.input = unk;
            binding.getValue = function() { return String(unk.value || ''); };
        }

        if (binding.input) {
            var triggerVis = function() {
                selfEE.refreshSchemaFieldVisibility();
                if (field.affectsPreviewMode && selfEE.refreshAnimationPreviewPanel) {
                    selfEE.refreshAnimationPreviewPanel(true);
                    return;
                }
                if (selfEE.shouldShowAnimationPreviewInEditor && selfEE.shouldShowAnimationPreviewInEditor() &&
                    selfEE.requestAnimationPreviewPlayback) {
                    selfEE.requestAnimationPreviewPlayback(false);
                }
            };
            binding.input.addEventListener('change', triggerVis);
            if (field.type !== 'bool') binding.input.addEventListener('input', triggerVis);
        }
        if (field.hint) row.appendChild(this.el('div', 'hint', String(field.hint)));
        return binding;
    };

    EE.prototype.renderEditorSchema = function(schema, state) {
        this.editSchemaBindings = [];
        this._schemaVisRefreshGuard = false;
        this._schemaVisRefreshPending = false;
        if (!this.edSchemaWrap || !this.edSchemaFields) return;
        this.edSchemaHead.textContent = String(schema && schema.title || '');
        this.edSchemaDesc.textContent = String(schema && schema.description || '');
        this.edSchemaFields.innerHTML = '';
        var scode = Number(schema && schema.code || 0);
        this.edSchemaFields.classList.toggle('msg101', scode === 101);
        var fs = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
        state = state || {};
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (!f || !f.key) continue;
            var v = (state.hasOwnProperty(f.key)) ? state[f.key] : f.defaultValue;
            var b = this.renderSchemaField(f, v, state);
            this.edSchemaFields.appendChild(b.row);
            this.editSchemaBindings.push(b);
        }
        this.ensureSchemaFieldLabelFitObserver();
        this.refreshSchemaFieldVisibility();
        this.scheduleSchemaFieldLabelFit();
    };

    EE.prototype.rawSchemaBindingValue = function(binding) {
        if (!binding || !binding.field || !binding.input) return undefined;
        var field = binding.field;
        var inp = binding.input;
        if (field.type === 'bool') return !!inp.checked;
        if (field.type === 'switch') {
            if (this.switchEditorFieldValue) return this.switchEditorFieldValue(inp, field.defaultValue == null ? 1 : field.defaultValue);
            return Math.max(1, Math.floor(Number(inp.value || 1) || 1));
        }
        if (field.type === 'variable') {
            if (this.variableEditorFieldValue) return this.variableEditorFieldValue(inp, field.defaultValue == null ? 1 : field.defaultValue);
            return Math.max(1, Math.floor(Number(inp.value || 1) || 1));
        }
        if (field.type === 'number') {
            var n = Number(inp.value);
            if (!isFinite(n)) n = (field.defaultValue == null ? 0 : Number(field.defaultValue || 0));
            if (!isFinite(n)) n = 0;
            if (field.integer !== false) n = Math.floor(n);
            return n;
        }
        if (field.type === 'select' || field.type === 'list') {
            var v = inp.value;
            if (field.valueType === 'number') return Math.floor(Number(v || 0) || 0);
            return String(v == null ? '' : v);
        }
        return String(inp.value == null ? '' : inp.value);
    };

    EE.prototype.collectEditorSchemaStateRaw = function() {
        var out = {};
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field) continue;
            out[b.field.key] = this.rawSchemaBindingValue(b);
        }
        return out;
    };

    EE.prototype.schemaBindingByKey = function(key) {
        key = String(key || '');
        var bindings = this.editSchemaBindings || [];
        for (var i = 0; i < bindings.length; i++) {
            if (bindings[i] && bindings[i].field && String(bindings[i].field.key || '') === key) return bindings[i];
        }
        return null;
    };

    EE.prototype.setSchemaBindingRawValue = function(key, value) {
        var binding = this.schemaBindingByKey(key);
        if (!binding || !binding.input) return false;
        var field = binding.field || {};
        if (field.type === 'bool') binding.input.checked = !!value;
        else binding.input.value = String(value == null ? '' : value);
        return true;
    };

    EE.prototype.openCharacterImagePickerForSchemaBinding = function(binding) {
        if (!binding || !binding.field || typeof this.openCharacterImagePicker !== 'function') return false;
        var self = this;
        var field = binding.field;
        var raw = this.collectEditorSchemaStateRaw();
        return this.openCharacterImagePicker({
            title: String(field.pickerTitle || 'キャラ画像の選択'),
            allowNone: !field.required,
            allowCssRect: false,
            value: {
                fileName: raw[field.key],
                index: raw[field.indexKey],
                direction: raw[field.directionKey],
                pattern: raw[field.patternKey]
            },
            onApply: function(result) {
                if (!result) return;
                self.setSchemaBindingRawValue(field.key, result.fileName);
                if (field.indexKey) self.setSchemaBindingRawValue(field.indexKey, result.index);
                if (field.directionKey) self.setSchemaBindingRawValue(field.directionKey, result.direction);
                if (field.patternKey) self.setSchemaBindingRawValue(field.patternKey, result.pattern);
                self.refreshSchemaFieldVisibility();
                if (self.shouldShowAnimationPreviewInEditor() && self.requestAnimationPreviewPlayback) {
                    self.requestAnimationPreviewPlayback(true);
                }
            }
        });
    };

    EE.prototype.applySchemaListFilter = function(binding, preferredValue, force) {
        if (!binding || !binding.field || !binding.input) return;
        var field = binding.field;
        if (!(field.type === 'list' || field.type === 'select')) return;
        var options = Array.isArray(binding.optionSource) ? binding.optionSource : [];
        var q = '';
        if (binding.searchInput) q = String(binding.searchInput.value || '').toLowerCase();
        var old = (preferredValue == null) ? binding.input.value : preferredValue;
        if (!force &&
            binding._filterLastQuery === q &&
            binding._filterLastSource === options &&
            binding._filterLastValue === old) {
            return;
        }
        var filtered = [];
        for (var i = 0; i < options.length; i++) {
            var it = options[i];
            if (!q.length || String(it._labelLc || '').indexOf(q) >= 0 || String(it._valueLc || '').indexOf(q) >= 0) filtered.push(it);
        }
        this.fillSchemaSelect(binding.input, filtered, old);
        binding._filterLastQuery = q;
        binding._filterLastSource = options;
        binding._filterLastValue = binding.input.value;
    };

    EE.prototype.schemaFieldVisible = function(field, state) {
        if (!field) return true;
        if (typeof field.visibleWhen === 'function') {
            try { return !!field.visibleWhen.call(this, state || {}, field); } catch (_) { return true; }
        }
        if (field.visibleWhen && typeof field.visibleWhen === 'object') {
            var c = field.visibleWhen;
            var k = c.key;
            if (k != null) {
                var v = state ? state[k] : undefined;
                if (c.hasOwnProperty('eq') && v !== c.eq) return false;
                if (c.hasOwnProperty('ne') && v === c.ne) return false;
                if (Array.isArray(c.in) && c.in.indexOf(v) < 0) return false;
                if (Array.isArray(c.notIn) && c.notIn.indexOf(v) >= 0) return false;
            }
            if (Array.isArray(c.all)) {
                for (var ai = 0; ai < c.all.length; ai++) {
                    var cc = c.all[ai];
                    if (!this.schemaFieldVisible({ visibleWhen: cc }, state)) return false;
                }
            }
            if (Array.isArray(c.any) && c.any.length) {
                var ok = false;
                for (var aj = 0; aj < c.any.length; aj++) {
                    var c2 = c.any[aj];
                    if (this.schemaFieldVisible({ visibleWhen: c2 }, state)) { ok = true; break; }
                }
                if (!ok) return false;
            }
            return true;
        }
        return this.schemaFieldAutoVisible(field, state || {});
    };

    EE.prototype.schemaFieldAutoVisible = function(field, state) {
        var key = String(field.key || '');
        function has(k) { return Object.prototype.hasOwnProperty.call(state, k); }

        if (has('scopeType') && key === 'toVar') return Number(state.scopeType || 0) !== 0;

        if (has('targetType') && has('actorId') && has('actorVarId')) {
            if (key === 'actorId') return Number(state.targetType || 0) === 0;
            if (key === 'actorVarId') return Number(state.targetType || 0) === 1;
        }

        if (has('mode') && has('troopId') && has('troopVarId')) {
            if (key === 'troopId') return Number(state.mode || 0) === 0;
            if (key === 'troopVarId') return Number(state.mode || 0) === 1;
        }

        if (has('priceType') && key === 'price') return Number(state.priceType || 0) === 1;

        if (has('locType')) {
            var lt = Number(state.locType || 0);
            if (key === 'mapId' && has('mapVarId')) return lt === 0;
            if (key === 'mapVarId') return lt === 1;
            if ((key === 'x' || key === 'y') && has('xVarId') && has('yVarId')) return lt === 0;
            if (key === 'xVarId' || key === 'yVarId') return lt === 1;
            if (key === 'swapTargetId') return lt === 2;
        }

        if (has('coordType')) {
            var ct = Number(state.coordType || 0);
            if ((key === 'x' || key === 'y') && has('xVarId') && has('yVarId')) return ct === 0;
            if (key === 'xVarId' || key === 'yVarId') return ct === 1;
        }

        if (has('operandType')) {
            var ot = Number(state.operandType || 0);
            if (key === 'constValue') return ot === 0;
            if (key === 'operandVarId') return ot === 1;
            if (key === 'randMin' || key === 'randMax') return ot === 2;
            if (key === 'gameDataType' || key === 'gameDataP1' || key === 'gameDataP2') return ot === 3;
            if (key === 'script' && has('constValue')) return ot === 4;
        }

        if (has('condType')) {
            var cd = Number(state.condType || 0);
            if (key === 'switchId' || key === 'switchValue') return cd === 0;
            if (key === 'varId' || key === 'varOperandType' || key === 'varOperand' || key === 'varCompareType') return cd === 1;
            if (key === 'selfSwitch' || key === 'selfSwitchValue') return cd === 2;
            if (key === 'timerSec' || key === 'timerCmp') return cd === 3;
            if (key === 'buttonName') return cd === 11;
            if (key === 'script') return cd === 12;
        }

        if (has('allEnemies') && key === 'enemyIndex') return !state.allEnemies;
        if (has('loopX') && key === 'sx') return !!state.loopX;
        if (has('loopY') && key === 'sy') return !!state.loopY;

        return true;
    };

    EE.prototype.refreshSchemaDynamicOptions = function(state) {
        var bs = this.editSchemaBindings || [];
        var changed = false;
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.input) continue;
            var f = b.field;
            if (!(f.type === 'select' || f.type === 'list')) continue;
            if (typeof f.options !== 'function') continue;
            var nextOptions = this.normalizeSchemaOptions(this.resolveSchemaOptions(f, state));
            if (b.optionSource === nextOptions) continue;
            var old = b.input.value;
            b.optionSource = nextOptions;
            if (b.searchInput) this.applySchemaListFilter(b, old, true);
            else this.fillSchemaSelect(b.input, b.optionSource, old);
            changed = true;
        }
        return changed;
    };

    EE.prototype.refreshSchemaFieldVisibility = function() {
        if (this._schemaVisRefreshGuard) {
            this._schemaVisRefreshPending = true;
            return;
        }
        this._schemaVisRefreshGuard = true;
        try {
            var state = this.collectEditorSchemaStateRaw();
            var optionChanged = this.refreshSchemaDynamicOptions(state);
            if (optionChanged) state = this.collectEditorSchemaStateRaw();
            var bs = this.editSchemaBindings || [];
            var visibilityChanged = false;
            for (var i = 0; i < bs.length; i++) {
                var b = bs[i];
                if (!b || !b.field || !b.row) continue;
                var vis = this.schemaFieldVisible(b.field, state);
                var nextVisible = !!vis;
                if (b.visible !== nextVisible) {
                    b.visible = nextVisible;
                    visibilityChanged = true;
                }
                var nextDisplay = vis ? '' : 'none';
                if (b.row.style.display !== nextDisplay) b.row.style.display = nextDisplay;
            }
            if (this.shouldShowAnimationPreviewInEditor() && (optionChanged || visibilityChanged)) {
                this.requestAnimationPreviewPlayback(false);
            }
        } finally {
            this._schemaVisRefreshGuard = false;
        }
        if (this._schemaVisRefreshPending) {
            this._schemaVisRefreshPending = false;
            this.refreshSchemaFieldVisibility();
        }
        this.scheduleSchemaFieldLabelFit();
    };

    EE.prototype.collectEditorSchemaState = function() {
        var out = {};
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.getValue) continue;
            var v = (b.visible === false) ? this.rawSchemaBindingValue(b) : b.getValue();
            out[b.field.key] = v;
        }
        return out;
    };

    EE.prototype.currentEditingEntry = function() {
        return this.findTrackEntryByUid(this.selectedTrack(), this.editUid);
    };

    EE.prototype.currentEditingRouteTargetId = function() {
        var rli = (this.editRouteListIndex == null) ? -1 : Number(this.editRouteListIndex);
        if (rli < 0) return 0;
        var e = this.currentEditingEntry();
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return 0;
        var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
        return this.normalizeMoveTarget(Number(p[0] || e.charId || 0));
    };

    EE.prototype.editorPreviewMode = function() {
        if (!this.editSchema) return '';
        if (!this.edSchemaWrap || this.edSchemaWrap.style.display === 'none') return '';
        var code = Number(this.editSchema.code || 0);
        if (code === 101) {
            var specialMode = this.schemaBindingByKey('specialMode');
            if (specialMode && String(this.rawSchemaBindingValue(specialMode) || '') === 'portrait') return 'portrait';
        }
        if (code === 212) return 'animation';
        var rli = (this.editRouteListIndex == null) ? -1 : Number(this.editRouteListIndex);
        if (rli < 0) {
            if (code === 231) return 'picture';
            if (code === 35556 || code === 35557) return 'pictureSheet';
        }
        if (rli >= 0) {
            if (code === 4510 || code === 4511) return 'frame';
            if (code === 4521) return 'cssRectFrame';
            if (code === 4514) return 'image';
        }
        return '';
    };

    EE.prototype.shouldShowAnimationPreviewInEditor = function() {
        return this.editorPreviewMode().length > 0;
    };
    SH.registerModule('schema', ['core']);
})();

