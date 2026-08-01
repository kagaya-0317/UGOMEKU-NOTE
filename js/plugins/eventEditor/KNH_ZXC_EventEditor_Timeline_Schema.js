//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Schema
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.2 (KNH_ZXC_EventEditor_Timeline_Schema)
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

    EE.prototype.actorOptionsForSchema = function() {
        return this.getCachedSchemaOptions('actors', function() {
            var out = [];
            var arr = ($dataActors && Array.isArray($dataActors)) ? $dataActors : [];
            for (var i = 1; i < arr.length; i++) {
                var a = arr[i];
                if (!a) continue;
                var id = Number(a.id || i);
                var nm = String(a.name || ('Actor ' + id));
                out.push({ value: id, label: ('0000' + id).slice(-4) + ' ' + nm });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
    };

    EE.prototype.variableOptionsForSchema = function() {
        return this.getCachedSchemaOptions('variables', function() {
            var out = [];
            var arr = ($dataSystem && Array.isArray($dataSystem.variables)) ? $dataSystem.variables : [];
            for (var i = 1; i < arr.length; i++) {
                var nm = String(arr[i] || '');
                if (!nm.length) nm = '(未設定)';
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + nm });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
    };

    EE.prototype.commonEventOptionsForSchema = function() {
        return this.getCachedSchemaOptions('commonEvents', function() {
            var out = [];
            var arr = ($dataCommonEvents && Array.isArray($dataCommonEvents)) ? $dataCommonEvents : [];
            for (var i = 1; i < arr.length; i++) {
                var ce = arr[i];
                if (!ce) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(ce.name || '(名称なし)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
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
        return this.getCachedSchemaOptions('tilesets', function() {
            var out = [];
            var arr = ($dataTilesets && Array.isArray($dataTilesets)) ? $dataTilesets : [];
            for (var i = 1; i < arr.length; i++) {
                var ts = arr[i];
                if (!ts) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(ts.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no tileset)' });
            return out;
        });
    };

    EE.prototype.enemyOptionsForSchema = function() {
        return this.getCachedSchemaOptions('enemies', function() {
            var out = [];
            var arr = ($dataEnemies && Array.isArray($dataEnemies)) ? $dataEnemies : [];
            for (var i = 1; i < arr.length; i++) {
                var e = arr[i];
                if (!e) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(e.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no enemy)' });
            return out;
        });
    };

    EE.prototype.stateOptionsForSchema = function() {
        return this.getCachedSchemaOptions('states', function() {
            var out = [];
            var arr = ($dataStates && Array.isArray($dataStates)) ? $dataStates : [];
            for (var i = 1; i < arr.length; i++) {
                var s = arr[i];
                if (!s) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(s.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no state)' });
            return out;
        });
    };

    EE.prototype.animationOptionsForSchema = function() {
        return this.getCachedSchemaOptions('animations', function() {
            var out = [];
            var arr = ($dataAnimations && Array.isArray($dataAnimations)) ? $dataAnimations : [];
            for (var i = 1; i < arr.length; i++) {
                var a = arr[i];
                if (!a) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(a.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no animation)' });
            return out;
        });
    };

    EE.prototype.itemOptionsForSchema = function() {
        return this.getCachedSchemaOptions('items', function() {
            var out = [];
            var arr = ($dataItems && Array.isArray($dataItems)) ? $dataItems : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no item)' });
            return out;
        });
    };

    EE.prototype.weaponOptionsForSchema = function() {
        return this.getCachedSchemaOptions('weapons', function() {
            var out = [];
            var arr = ($dataWeapons && Array.isArray($dataWeapons)) ? $dataWeapons : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no weapon)' });
            return out;
        });
    };

    EE.prototype.armorOptionsForSchema = function() {
        return this.getCachedSchemaOptions('armors', function() {
            var out = [];
            var arr = ($dataArmors && Array.isArray($dataArmors)) ? $dataArmors : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no armor)' });
            return out;
        });
    };

    EE.prototype.skillOptionsForSchema = function() {
        return this.getCachedSchemaOptions('skills', function() {
            var out = [];
            var arr = ($dataSkills && Array.isArray($dataSkills)) ? $dataSkills : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no skill)' });
            return out;
        });
    };

    EE.prototype.classOptionsForSchema = function() {
        return this.getCachedSchemaOptions('classes', function() {
            var out = [];
            var arr = ($dataClasses && Array.isArray($dataClasses)) ? $dataClasses : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no class)' });
            return out;
        });
    };

    EE.prototype.equipTypeOptionsForSchema = function() {
        return this.getCachedSchemaOptions('equipTypes', function() {
            var out = [];
            var arr = ($dataSystem && Array.isArray($dataSystem.equipTypes)) ? $dataSystem.equipTypes : [];
            for (var i = 1; i < arr.length; i++) {
                var nm = String(arr[i] || '');
                if (!nm.length) nm = '(未設定)';
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + nm });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
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
        return this.getCachedSchemaOptions('troops', function() {
            var out = [];
            var arr = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops : [];
            for (var i = 1; i < arr.length; i++) {
                var t = arr[i];
                if (!t) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(t.name || '(no troop)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no troop)' });
            return out;
        });
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

    EE.prototype.copyMessageExtState = function(st) {
        return this.sanitizeMessageExtState(st || {});
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

    EE.prototype.ensureEditorSchemas = function() {
        if (this._editorSchemas) return;
        this._editorSchemas = {};
        var self = this;
        function reg(code, schema) { self._editorSchemas[Number(code || 0)] = schema; }

        reg(35550, {
            code: 35550,
            commandCode: 355,
            script355: true,
            title: 'カメラ移動',
            description: '$gameMap.scrollCamera(x, y, d) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true },
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.cameraMoveSpecFromEntry(entry);
                if (!spec || spec.kind !== 'scroll') return { x: 0, y: 0, d: 60 };
                return { x: Number(spec.x || 0), y: Number(spec.y || 0), d: Math.max(1, Math.floor(Number(spec.d || 60))) };
            },
            toParams: function(state) {
                return [this.makeCameraMoveScript('scroll', Number(state.x || 0), Number(state.y || 0), Number(state.d || 60))];
            }
        });

        reg(35551, {
            code: 35551,
            commandCode: 355,
            script355: true,
            title: 'カメラ移動(直接指定)',
            description: '$gameMap.scrollCameraTo(x, y, d) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true },
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.cameraMoveSpecFromEntry(entry);
                if (!spec || spec.kind !== 'scrollTo') return { x: 0, y: 0, d: 60 };
                return { x: Number(spec.x || 0), y: Number(spec.y || 0), d: Math.max(1, Math.floor(Number(spec.d || 60))) };
            },
            toParams: function(state) {
                return [this.makeCameraMoveScript('scrollTo', Number(state.x || 0), Number(state.y || 0), Number(state.d || 60))];
            }
        });

        reg(35552, {
            code: 35552,
            commandCode: 355,
            script355: true,
            title: 'キャラの瞬間移動',
            description: 'this.character(targetId).locateTo(x, y) / $gamePlayer.locateTo(x, y) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.teleportSpecFromEntry(entry);
                if (!spec) {
                    var defTarget = 0;
                    if (typeof this.currentSelectedCharacterId === 'function') defTarget = this.currentSelectedCharacterId();
                    if (defTarget == null && Number(this.selEid || 0) > 0) defTarget = Number(this.selEid || 0);
                    return {
                        targetId: self.normalizeMoveTarget(Number(defTarget == null ? 0 : defTarget)),
                        x: 0,
                        y: 0
                    };
                }
                return {
                    targetId: self.normalizeMoveTarget(Number(spec.targetId || 0)),
                    x: Number(spec.x || 0),
                    y: Number(spec.y || 0)
                };
            },
            toParams: function(state) {
                return [this.makeCharacterTeleportScript(
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Number(state.x || 0),
                    Number(state.y || 0)
                )];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35553, {
            code: 35553,
            commandCode: 355,
            script355: true,
            title: 'マップBGMの再生',
            description: '$gameMap.autoplay(); を実行します（保存時はスクリプト355）。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return ['$gameMap.autoplay();']; },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35554, {
            code: 35554,
            commandCode: 355,
            script355: true,
            title: '画面のフェードインZXC',
            description: '$gameScreen.startFadeOutZXC(d, c); を実行します（仕様どおり名称と呼び出しは逆）。',
            fields: [
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true },
                { key: 'c', type: 'select', label: '色', valueType: 'number', compact: true, options: [{ value: 0, label: '白(0)' }, { value: 1, label: '黒(1)' }] }
            ],
            fromEntry: function(entry) {
                var spec = this.screenFadeZxcSpecFromEntry(entry);
                if (!spec || spec.kind !== 'fadeOut') return { d: 60, c: 1 };
                return { d: Math.max(1, Math.floor(Number(spec.d || 60) || 60)), c: Math.max(0, Math.min(1, Math.floor(Number(spec.c || 0) || 0))) };
            },
            toParams: function(state) {
                var d = Math.max(1, Math.floor(Number(state.d || 60) || 60));
                var c = Math.max(0, Math.min(1, Math.floor(Number(state.c || 0) || 0)));
                return ['$gameScreen.startFadeOutZXC(' + d + ', ' + c + ');'];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35555, {
            code: 35555,
            commandCode: 355,
            script355: true,
            title: '画面のフェードアウトZXC',
            description: '$gameScreen.startFadeInZXC(d, c); を実行します（仕様どおり名称と呼び出しは逆）。',
            fields: [
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true },
                { key: 'c', type: 'select', label: '色', valueType: 'number', compact: true, options: [{ value: 0, label: '白(0)' }, { value: 1, label: '黒(1)' }] }
            ],
            fromEntry: function(entry) {
                var spec = this.screenFadeZxcSpecFromEntry(entry);
                if (!spec || spec.kind !== 'fadeIn') return { d: 60, c: 1 };
                return { d: Math.max(1, Math.floor(Number(spec.d || 60) || 60)), c: Math.max(0, Math.min(1, Math.floor(Number(spec.c || 0) || 0))) };
            },
            toParams: function(state) {
                var d = Math.max(1, Math.floor(Number(state.d || 60) || 60));
                var c = Math.max(0, Math.min(1, Math.floor(Number(state.c || 0) || 0)));
                return ['$gameScreen.startFadeInZXC(' + d + ', ' + c + ');'];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35556, {
            code: 35556,
            commandCode: 355,
            script355: true,
            title: 'ピクチャSS表示',
            description: 'this.command_showSpriteSheetPicture(...) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャID', min: 1, step: 1, integer: true, compact: true },
                { key: 'pictureName', type: 'text', label: 'ピクチャ名', full: true, compact: true },
                { key: 'rows', type: 'number', label: '行数', min: 1, step: 1, integer: true, compact: true },
                { key: 'cols', type: 'number', label: '列数', min: 1, step: 1, integer: true, compact: true },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', compact: true, options: [{ value: 0, label: '左上(0)' }, { value: 1, label: '中央(1)' }] },
                { key: 'x', type: 'number', label: 'X', step: 1, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 1, integer: false, compact: true },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1, integer: false, compact: true },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1, integer: false, compact: true },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1, integer: true, compact: true },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', compact: true, options: [{ value: 0, label: '通常(0)' }, { value: 1, label: '加算(1)' }, { value: 2, label: '乗算(2)' }, { value: 3, label: 'スクリーン(3)' }] }
            ],
            fromEntry: function(entry) {
                var spec = this.spriteSheetPictureShowSpecFromEntry(entry);
                if (!spec) {
                    return {
                        pictureId: 1,
                        pictureName: '',
                        rows: 1,
                        cols: 1,
                        origin: 0,
                        x: 0,
                        y: 0,
                        scaleX: 100,
                        scaleY: 100,
                        opacity: 255,
                        blendMode: 0
                    };
                }
                return spec;
            },
            toParams: function(state) {
                return [this.makeShowSpriteSheetPictureScript(state)];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35557, {
            code: 35557,
            commandCode: 355,
            script355: true,
            title: 'ピクチャSS再生',
            description: 'this.command_playSpriteSheetPicture(...) を編集します。再生順は配列文字列([0,1,2]) または数字(4)を指定できます（保存時はスクリプト355）。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャID', min: 1, step: 1, integer: true, compact: true },
                { key: 'orderSpec', type: 'text', label: '再生順', full: true, compact: true },
                { key: 'frameWait', type: 'number', label: 'ウェイト(f)', min: 1, step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ' }
            ],
            fromEntry: function(entry) {
                var spec = this.spriteSheetPicturePlaySpecFromEntry(entry);
                if (!spec) {
                    return {
                        pictureId: 1,
                        orderSpec: '[0,1,2,3]',
                        frameWait: 6,
                        loop: true
                    };
                }
                return spec;
            },
            toParams: function(state) {
                return [this.makePlaySpriteSheetPictureScript(state)];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35558, {
            code: 35558,
            commandCode: 355,
            script355: true,
            title: 'ピクチャSS停止',
            description: 'this.command_stopSpriteSheetPicture(...) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャID', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.spriteSheetPictureStopSpecFromEntry(entry);
                return spec || { pictureId: 1 };
            },
            toParams: function(state) {
                return [this.makeStopSpriteSheetPictureScript(state)];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(303, {
            code: 303,
            title: '名前入力の処理',
            description: '対象アクターと最大文字数を設定します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 11, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'maxLength', type: 'number', label: '最大文字数', min: 1, max: 12, step: 1, hint: '入力できる文字数の上限' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), maxLength: Math.max(1, Math.floor(Number(p[1] || 8) || 8)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.actorId || 1) || 1)), Math.max(1, Math.floor(Number(state.maxLength || 8) || 8))];
            }
        });

        reg(301, {
            code: 301,
            title: '戦闘の処理',
            description: '戦闘する敵グループと敗北時挙動を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '敵グループ指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }, { value: 2, label: 'ランダムエンカウント' }] },
                { key: 'troopId', type: 'list', label: '敵グループ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.troopOptionsForSchema(); } },
                { key: 'troopVarId', type: 'variable', label: '敵グループ変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'canEscape', type: 'bool', label: '逃走を許可' },
                { key: 'canLose', type: 'bool', label: '負けてもゲームオーバーにしない' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var mode = Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0)));
                return {
                    mode: mode,
                    troopId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    troopVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    canEscape: !!p[2],
                    canLose: !!p[3]
                };
            },
            toParams: function(state) {
                var mode = Math.max(0, Math.min(2, Math.floor(Number(state.mode || 0) || 0)));
                var ref = 0;
                if (mode === 0) ref = Math.max(1, Math.floor(Number(state.troopId || 1) || 1));
                else if (mode === 1) ref = Math.max(1, Math.floor(Number(state.troopVarId || 1) || 1));
                return [mode, ref, !!state.canEscape, !!state.canLose];
            }
        });

        reg(302, {
            code: 302,
            title: 'ショップの処理',
            description: '販売商品を1件分設定します（追加商品605は別コマンド）。',
            fields: [
                { key: 'goodsType', type: 'select', label: '商品種別', valueType: 'number', options: [{ value: 0, label: 'アイテム' }, { value: 1, label: '武器' }, { value: 2, label: '防具' }] },
                { key: 'goodsId', type: 'list', label: '商品ID', full: true, size: 10, search: true, valueType: 'number', options: function(state) {
                    var t = Math.max(0, Math.min(2, Math.floor(Number(state && state.goodsType || 0) || 0)));
                    if (t === 1) return self.weaponOptionsForSchema();
                    if (t === 2) return self.armorOptionsForSchema();
                    return self.itemOptionsForSchema();
                } },
                { key: 'priceType', type: 'select', label: '価格', valueType: 'number', options: [{ value: 0, label: '標準価格' }, { value: 1, label: '指定価格' }] },
                { key: 'price', type: 'number', label: '指定価格', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    goodsType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    goodsId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    priceType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    price: Math.max(0, Math.floor(Number(p[3] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.goodsType || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.goodsId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.priceType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.price || 0) || 0))
                ];
            }
        });

        reg(351, {
            code: 351,
            title: 'メニュー画面を開く',
            description: 'メニュー画面を開きます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(352, {
            code: 352,
            title: 'セーブ画面を開く',
            description: 'セーブ画面を開きます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(353, {
            code: 353,
            title: 'ゲームオーバー',
            description: 'ゲームオーバー画面へ遷移します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(354, {
            code: 354,
            title: 'タイトル画面に戻す',
            description: 'タイトル画面へ戻します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(132, {
            code: 132,
            title: '戦闘BGMの変更',
            description: '戦闘BGMを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(133, {
            code: 133,
            title: '勝利MEの変更',
            description: '勝利MEを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(139, {
            code: 139,
            title: '敗北MEの変更',
            description: '敗北MEを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(140, {
            code: 140,
            title: '乗り物BGMの変更',
            description: '指定乗り物のBGMを変更します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: function() { return self.vehicleTypeOptionsForSchema(); } },
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[1] && typeof p[1] === 'object') ? p[1] : self.emptyAudioParam();
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    {
                        name: String(state.name || ''),
                        volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                        pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                        pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                    }
                ];
            }
        });

        reg(134, {
            code: 134,
            title: 'セーブ禁止の変更',
            description: 'セーブの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'セーブ', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(135, {
            code: 135,
            title: 'メニュー禁止の変更',
            description: 'メニューの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'メニュー', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(136, {
            code: 136,
            title: 'エンカウント禁止の変更',
            description: 'エンカウントの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'エンカウント', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(137, {
            code: 137,
            title: '並び替え禁止の変更',
            description: '並び替えの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '並び替え', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(138, {
            code: 138,
            title: 'ウィンドウカラーの変更',
            description: 'ウィンドウカラー(色調)を変更します。',
            fields: [
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[0] && Array.isArray(p[0])) ? p[0] : [0, 0, 0, 0];
                return {
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [[
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                    Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                ]];
            }
        });

        reg(322, {
            code: 322,
            title: 'アクターの画像変更',
            description: 'アクターの歩行/顔/SV画像を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'characterName', type: 'text', label: '歩行グラフィック名', full: true },
                { key: 'characterIndex', type: 'number', label: '歩行インデックス', min: 0, max: 7, step: 1 },
                { key: 'faceName', type: 'text', label: '顔グラフィック名', full: true },
                { key: 'faceIndex', type: 'number', label: '顔インデックス', min: 0, max: 7, step: 1 },
                { key: 'battlerName', type: 'text', label: 'SVバトラー名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    characterName: String(p[1] || ''),
                    characterIndex: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0))),
                    faceName: String(p[3] || ''),
                    faceIndex: Math.max(0, Math.min(7, Math.floor(Number(p[4] || 0) || 0))),
                    battlerName: String(p[5] || '')
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.characterName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.characterIndex || 0) || 0))),
                    String(state.faceName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.faceIndex || 0) || 0))),
                    String(state.battlerName || '')
                ];
            }
        });

        reg(323, {
            code: 323,
            title: '乗り物の画像変更',
            description: '乗り物の歩行画像を変更します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: function() { return self.vehicleTypeOptionsForSchema(); } },
                { key: 'characterName', type: 'text', label: '歩行グラフィック名', full: true },
                { key: 'characterIndex', type: 'number', label: '歩行インデックス', min: 0, max: 7, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    characterName: String(p[1] || ''),
                    characterIndex: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    String(state.characterName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.characterIndex || 0) || 0)))
                ];
            }
        });

        reg(101, {
            code: 101,
            title: '文章の表示',
            description: '本文と、ウィンドウタイプ/しっぽ方向/ふきだし対象/addX/addY を設定します。',
            fields: [
                { key: 'text', type: 'textarea', label: '本文 (1行=401)', full: true, rows: 4 },
                { key: 'windowType', type: 'select', label: 'ウィンドウタイプ', valueType: 'number', options: [
                    { value: -1, label: '-1 四角' },
                    { value: 0, label: '0 ふきだし' },
                    { value: 1, label: '1 ギザギザふきだし' },
                    { value: 2, label: '2 思考ふきだし' }
                ] },
                { key: 'targetMode', type: 'select', label: 'ふきだし対象', options: [
                    { value: 'char', label: 'キャラ' },
                    { value: 'coord', label: '座標' }
                ] },
                { key: 'tailDir', type: 'taildir', label: 'しっぽ方向', compact: true },
                { key: 'addX', type: 'number', label: 'addX(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'char' } },
                { key: 'addY', type: 'number', label: 'addY(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'char' } },
                { key: 'targetX', type: 'number', label: '画面X(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } },
                { key: 'targetY', type: 'number', label: '画面Y(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } },
                { key: 'targetCharId', type: 'list', label: '対象キャラ', full: true, size: 10, search: true, valueType: 'number',
                    visibleWhen: { key: 'targetMode', eq: 'char' },
                    options: function() { return self.characterTargetOptionsForSchema(true, true); }
                }
            ],
            fromEntry: function(entry) {
                var lines = Array.isArray(entry && entry.messageLines) ? entry.messageLines : [];
                var tr = entry ? self.ensureTrack(entry.eventId, entry.pageIndex) : null;
                var st = entry && entry.messageExt
                    ? self.sanitizeMessageExtState(entry.messageExt)
                    : self.messageExtStateAtPoint(tr, entry ? entry.frame : 0, entry ? entry.uid : Infinity);
                return {
                    text: lines.join('\n'),
                    windowType: st.windowType,
                    tailDir: st.tailDir,
                    targetMode: st.targetMode,
                    targetCharId: st.targetCharId,
                    addX: st.addX,
                    addY: st.addY,
                    targetX: st.targetX,
                    targetY: st.targetY
                };
            },
            toParams: function(state, source) {
                var p = (source && source.command && Array.isArray(source.command.parameters))
                    ? clone(source.command.parameters)
                    : ['', 0, 0, 2];
                if (!Array.isArray(p) || p.length < 4) p = ['', 0, 0, 2];
                return p;
            },
            applyEntry: function(entry, state) {
                entry.isMessage = true;
                entry.messageLines = self.linesFromText(state && state.text, true);
                entry.messageExt = self.sanitizeMessageExtState({
                    windowType: state && state.windowType,
                    tailDir: state && state.tailDir,
                    targetMode: state && state.targetMode,
                    targetCharId: state && state.targetCharId,
                    addX: state && state.addX,
                    addY: state && state.addY,
                    targetX: state && state.targetX,
                    targetY: state && state.targetY
                });
            }
        });

        reg(102, {
            code: 102,
            title: '選択肢の表示',
            description: '選択肢の文言と、既定/キャンセル/表示位置を設定します。',
            fields: [
                {
                    key: 'choiceBranchViewMode',
                    type: 'select',
                    label: '表示枝',
                    options: function(state) {
                        var out = [{ value: 'auto', label: 'AUTO' }];
                        var cs = self.linesFromText(state && state.choicesText, true);
                        if (!cs.length) cs = ['選択肢1'];
                        if (cs.length > 6) cs = cs.slice(0, 6);
                        for (var i = 0; i < cs.length; i++) {
                            out.push({ value: String(i), label: '選択肢' + String(i + 1) });
                        }
                        var cancelRaw = (state && state.cancelType != null) ? state.cancelType : -2;
                        var cancel = Math.floor(Number(cancelRaw) || 0);
                        if (cancel === -2) out.push({ value: 'cancel', label: 'キャンセル' });
                        return out;
                    }
                },
                { key: 'choicesText', type: 'textarea', label: '選択肢 (1行=1択)', full: true, rows: 7 },
                { key: 'defaultType', type: 'number', label: '既定選択(0開始)', min: 0, step: 1 },
                { key: 'cancelType', type: 'number', label: 'キャンセル(-1禁止 / -2分岐)', min: -2, step: 1 },
                { key: 'positionType', type: 'select', label: 'ウィンドウ位置', valueType: 'number', options: [{ value: 0, label: '左' }, { value: 1, label: '中' }, { value: 2, label: '右' }] },
                { key: 'background', type: 'select', label: '背景', valueType: 'number', options: [{ value: 0, label: 'ウィンドウ' }, { value: 1, label: '暗くする' }, { value: 2, label: '透明' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var cs = Array.isArray(p[0]) ? p[0] : [];
                var choiceBranchViewMode = 'auto';
                if (entry && typeof self.getChoiceBranchViewModeForEntry === 'function') {
                    try { choiceBranchViewMode = self.getChoiceBranchViewModeForEntry(entry); } catch (_) { choiceBranchViewMode = 'auto'; }
                }
                return {
                    choiceBranchViewMode: String(choiceBranchViewMode || 'auto'),
                    choicesText: cs.join('\n'),
                    cancelType: Number(p[1] == null ? -2 : p[1]),
                    defaultType: Number(p[2] == null ? 0 : p[2]),
                    positionType: Number(p[3] == null ? 2 : p[3]),
                    background: Number(p[4] == null ? 0 : p[4])
                };
            },
            toParams: function(state) {
                var cs = self.linesFromText(state.choicesText, true);
                if (!cs.length) cs = ['選択肢1'];
                if (cs.length > 6) cs = cs.slice(0, 6);
                var def = Math.max(0, Math.floor(Number(state.defaultType || 0) || 0));
                if (def >= cs.length) def = 0;
                var cancel = Math.floor(Number(state.cancelType == null ? -2 : state.cancelType) || 0);
                if (cancel >= cs.length) cancel = -2;
                if (cancel < -2) cancel = -2;
                return [
                    cs,
                    cancel,
                    def,
                    Math.max(0, Math.min(2, Math.floor(Number(state.positionType || 2) || 0))),
                    Math.max(0, Math.min(2, Math.floor(Number(state.background || 0) || 0)))
                ];
            },
            applyEntry: function(entry, state) {
                if (!entry || typeof self.setChoiceBranchViewModeForEntry !== 'function') return;
                try {
                    self.setChoiceBranchViewModeForEntry(entry, state ? state.choiceBranchViewMode : 'auto');
                } catch (_) {}
            }
        });

        reg(103, {
            code: 103,
            title: '数値入力の処理',
            description: '入力先の変数と桁数を設定します。',
            fields: [
                { key: 'variableId', type: 'variable', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'digits', type: 'number', label: '桁数', min: 1, max: 8, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), digits: Math.max(1, Math.floor(Number(p[1] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.variableId || 1) || 1)), Math.max(1, Math.min(8, Math.floor(Number(state.digits || 1) || 1)))];
            }
        });

        reg(104, {
            code: 104,
            title: 'アイテム選択の処理',
            description: '選択したアイテムIDを変数に格納します。',
            fields: [
                { key: 'variableId', type: 'variable', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'itemType', type: 'select', label: '対象アイテム種別', valueType: 'number', options: function() { return self.itemTypeOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), itemType: Math.max(1, Math.min(4, Math.floor(Number(p[1] || 2) || 2))) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.variableId || 1) || 1)), Math.max(1, Math.min(4, Math.floor(Number(state.itemType || 2) || 2)))];
            }
        });

        reg(105, {
            code: 105,
            title: '文章のスクロール表示',
            description: 'スクロール速度と本文を設定します。',
            fields: [
                { key: 'speed', type: 'number', label: 'スクロール速度', min: 1, max: 8, step: 1 },
                { key: 'noFast', type: 'bool', label: '早送り禁止' },
                { key: 'text', type: 'textarea', label: '本文 (1行=405)', full: true, rows: 10 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var lines = Array.isArray(entry && entry.scrollLines) ? entry.scrollLines : [];
                return { speed: Math.max(1, Math.floor(Number(p[0] || 2) || 2)), noFast: !!p[1], text: lines.join('\n') };
            },
            toParams: function(state) {
                return [Math.max(1, Math.min(8, Math.floor(Number(state.speed || 2) || 2))), !!state.noFast];
            },
            applyEntry: function(entry, state) {
                entry.isScrollMessage = true;
                entry.scrollLines = self.linesFromText(state.text, true);
            }
        });

        reg(122, {
            code: 122,
            title: '変数の操作',
            description: '範囲・演算・オペランドを設定します（主要形式を対応）。',
            fields: [
                { key: 'scopeType', type: 'select', label: '対象', valueType: 'number', options: [{ value: 0, label: '単独' }, { value: 1, label: '範囲' }] },
                { key: 'fromVar', type: 'variable', label: '開始変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'toVar', type: 'variable', label: '終了変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'opType', type: 'select', label: '演算', valueType: 'number', options: [{ value: 0, label: '代入' }, { value: 1, label: '加算' }, { value: 2, label: '減算' }, { value: 3, label: '乗算' }, { value: 4, label: '除算' }, { value: 5, label: '剰余' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }, { value: 2, label: '乱数' }, { value: 3, label: 'ゲームデータ' }, { value: 4, label: 'スクリプト' }] },
                { key: 'constValue', type: 'number', label: '定数値', step: 1 },
                { key: 'operandVarId', type: 'variable', label: '参照変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'randMin', type: 'number', label: '乱数最小', step: 1 },
                { key: 'randMax', type: 'number', label: '乱数最大', step: 1 },
                { key: 'gameDataType', type: 'number', label: 'ゲームデータ種別ID', min: 0, step: 1, hint: '必要時のみ。詳細はMV仕様準拠。' },
                { key: 'gameDataP1', type: 'number', label: 'ゲームデータparam1', step: 1 },
                { key: 'gameDataP2', type: 'number', label: 'ゲームデータparam2', step: 1 },
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 4 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = Math.max(1, Math.floor(Number(p[0] || 1) || 1));
                var b = Math.max(1, Math.floor(Number(p[1] || a) || a));
                return {
                    scopeType: (a === b ? 0 : 1),
                    fromVar: a,
                    toVar: b,
                    opType: Math.max(0, Math.min(5, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(4, Math.floor(Number(p[3] || 0) || 0))),
                    constValue: Math.floor(Number(p[4] || 0) || 0),
                    operandVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1)),
                    randMin: Math.floor(Number(p[4] || 0) || 0),
                    randMax: Math.floor(Number(p[5] || 0) || 0),
                    gameDataType: Math.floor(Number(p[4] || 0) || 0),
                    gameDataP1: Math.floor(Number(p[5] || 0) || 0),
                    gameDataP2: Math.floor(Number(p[6] || 0) || 0),
                    script: String(p[4] || '')
                };
            },
            toParams: function(state) {
                var a = Math.max(1, Math.floor(Number(state.fromVar || 1) || 1));
                var b = Math.max(1, Math.floor(Number(state.toVar || a) || a));
                if (Number(state.scopeType || 0) === 0) b = a;
                if (a > b) { var t = a; a = b; b = t; }
                var op = Math.max(0, Math.min(5, Math.floor(Number(state.opType || 0) || 0)));
                var ot = Math.max(0, Math.min(4, Math.floor(Number(state.operandType || 0) || 0)));
                if (ot === 0) return [a, b, op, 0, Math.floor(Number(state.constValue || 0) || 0)];
                if (ot === 1) return [a, b, op, 1, Math.max(1, Math.floor(Number(state.operandVarId || 1) || 1))];
                if (ot === 2) {
                    var mn = Math.floor(Number(state.randMin || 0) || 0);
                    var mx = Math.floor(Number(state.randMax || 0) || 0);
                    if (mn > mx) { var tt = mn; mn = mx; mx = tt; }
                    return [a, b, op, 2, mn, mx];
                }
                if (ot === 3) return [a, b, op, 3, Math.floor(Number(state.gameDataType || 0) || 0), Math.floor(Number(state.gameDataP1 || 0) || 0), Math.floor(Number(state.gameDataP2 || 0) || 0)];
                return [a, b, op, 4, String(state.script || '')];
            }
        });

        reg(123, {
            code: 123,
            title: 'セルフスイッチの操作',
            description: '現在イベントのセルフスイッチを操作します。',
            fields: [
                { key: 'selfSwitch', type: 'select', label: 'セルフスイッチ', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }] },
                { key: 'value', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { selfSwitch: String(p[0] || 'A'), value: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))) };
            },
            toParams: function(state) {
                var ss = String(state.selfSwitch || 'A').toUpperCase();
                if (!/^[ABCD]$/.test(ss)) ss = 'A';
                return [ss, Math.max(0, Math.min(1, Math.floor(Number(state.value || 0) || 0)))];
            }
        });

        reg(124, {
            code: 124,
            title: 'タイマーの操作',
            description: '開始/停止と開始時秒数を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '開始' }, { value: 1, label: '停止' }] },
                { key: 'seconds', type: 'number', label: '秒数(開始時)', min: 1, max: 5999, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))), seconds: Math.max(1, Math.floor(Number(p[1] || 60) || 60)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0))), Math.max(1, Math.floor(Number(state.seconds || 60) || 60))];
            }
        });

        reg(117, {
            code: 117,
            title: 'コモンイベント',
            description: '実行するコモンイベントを選択します。',
            fields: [{ key: 'commonEventId', type: 'list', label: 'コモンイベント', full: true, size: 11, search: true, valueType: 'number', options: function() { return self.commonEventOptionsForSchema(); } }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { commonEventId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) { return [Math.max(1, Math.floor(Number(state.commonEventId || 1) || 1))]; }
        });

        reg(118, {
            code: 118,
            title: 'ラベル',
            description: 'ラベル名を設定します。',
            fields: [{ key: 'labelName', type: 'text', label: 'ラベル名' }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { labelName: String(p[0] || '') };
            },
            toParams: function(state) { return [String(state.labelName || '')]; }
        });

        reg(119, {
            code: 119,
            title: 'ラベルジャンプ',
            description: '移動先ラベル名を設定します。',
            fields: [
                { key: 'jumpLabel', type: 'list', label: 'ラベル一覧', full: true, size: 8, search: true, options: function() { return self.labelOptionsForSchema(); } },
                { key: 'jumpLabelText', type: 'text', label: 'ジャンプ先ラベル名', hint: '一覧になければ手入力可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var name = String(p[0] || '');
                return { jumpLabel: name, jumpLabelText: name };
            },
            toParams: function(state) {
                var name = String(state.jumpLabelText || state.jumpLabel || '');
                return [name];
            }
        });

        reg(111, {
            code: 111,
            title: '条件分岐',
            description: '主要な条件分岐形式を設定します（第一段）。',
            fields: [
                { key: 'branchViewMode', type: 'select', label: '表示枝', options: [{ value: 'auto', label: 'AUTO' }, { value: 'then', label: 'THEN' }, { value: 'else', label: 'ELSE' }] },
                { key: 'condType', type: 'select', label: '条件種別', valueType: 'number', options: [{ value: 0, label: 'スイッチ' }, { value: 1, label: '変数' }, { value: 2, label: 'セルフスイッチ' }, { value: 3, label: 'タイマー' }, { value: 11, label: 'ボタン' }, { value: 12, label: 'スクリプト' }] },
                { key: 'switchId', type: 'switch', label: 'スイッチID', min: 1, step: 1 },
                { key: 'switchValue', type: 'select', label: 'スイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'varId', type: 'variable', label: '変数ID', min: 1, step: 1 },
                { key: 'varOperandType', type: 'select', label: '比較対象', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'varOperand', type: 'number', label: '比較値/比較変数ID', step: 1 },
                { key: 'varCompareType', type: 'select', label: '比較演算', valueType: 'number', options: [{ value: 0, label: '==' }, { value: 1, label: '>=' }, { value: 2, label: '<=' }, { value: 3, label: '>' }, { value: 4, label: '<' }, { value: 5, label: '!=' }] },
                { key: 'selfSwitch', type: 'select', label: 'セルフスイッチ', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }] },
                { key: 'selfSwitchValue', type: 'select', label: 'セルフスイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'timerSec', type: 'number', label: 'タイマー秒数', min: 0, step: 1 },
                { key: 'timerCmp', type: 'select', label: 'タイマー比較', valueType: 'number', options: [{ value: 0, label: '以上' }, { value: 1, label: '以下' }] },
                { key: 'buttonName', type: 'select', label: 'ボタン', options: function() { return self.buttonOptionsForSchema(); } },
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 4 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var branchViewMode = 'then';
                if (entry && typeof self.getIfBranchViewModeForEntry === 'function') {
                    try { branchViewMode = self.getIfBranchViewModeForEntry(entry); } catch (_) { branchViewMode = 'then'; }
                }
                var branchMode = String(branchViewMode || '').toLowerCase();
                if (branchMode !== 'auto' && branchMode !== 'else') branchMode = 'then';
                return {
                    branchViewMode: branchMode,
                    condType: Math.floor(Number(p[0] || 0) || 0),
                    switchId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    switchValue: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    varId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    varOperandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    varOperand: Math.floor(Number(p[3] || 0) || 0),
                    varCompareType: Math.max(0, Math.min(5, Math.floor(Number(p[4] || 0) || 0))),
                    selfSwitch: String(p[1] || 'A'),
                    selfSwitchValue: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    timerSec: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    timerCmp: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    buttonName: String(p[1] || 'ok'),
                    script: String(p[1] || '')
                };
            },
            toParams: function(state, entry) {
                var t = Math.floor(Number(state.condType || 0) || 0);
                if (t === 0) return [0, Math.max(1, Math.floor(Number(state.switchId || 1) || 1)), Math.max(0, Math.min(1, Math.floor(Number(state.switchValue || 0) || 0)))];
                if (t === 1) return [1, Math.max(1, Math.floor(Number(state.varId || 1) || 1)), Math.max(0, Math.min(1, Math.floor(Number(state.varOperandType || 0) || 0))), Math.floor(Number(state.varOperand || 0) || 0), Math.max(0, Math.min(5, Math.floor(Number(state.varCompareType || 0) || 0)))];
                if (t === 2) {
                    var ss = String(state.selfSwitch || 'A').toUpperCase();
                    if (!/^[ABCD]$/.test(ss)) ss = 'A';
                    return [2, ss, Math.max(0, Math.min(1, Math.floor(Number(state.selfSwitchValue || 0) || 0)))];
                }
                if (t === 3) return [3, Math.max(0, Math.floor(Number(state.timerSec || 0) || 0)), Math.max(0, Math.min(1, Math.floor(Number(state.timerCmp || 0) || 0)))];
                if (t === 11) return [11, String(state.buttonName || 'ok')];
                if (t === 12) return [12, String(state.script || '')];
                return Array.isArray(entry && entry.command && entry.command.parameters) ? clone(entry.command.parameters) : [];
            },
            applyEntry: function(entry, state) {
                if (!entry || typeof self.setIfBranchViewModeForEntry !== 'function') return;
                try {
                    self.setIfBranchViewModeForEntry(entry, state ? state.branchViewMode : 'then');
                } catch (_) {}
            }
        });

        reg(281, {
            code: 281,
            title: 'マップ名表示の変更',
            description: 'マップ名ウィンドウの表示/非表示を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '表示設定', valueType: 'number', options: [{ value: 0, label: '表示する' }, { value: 1, label: '表示しない' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(282, {
            code: 282,
            title: 'タイルセットの変更',
            description: '切り替えるタイルセットを選択します。',
            fields: [
                { key: 'tilesetId', type: 'list', label: 'タイルセット', full: true, size: 12, search: true, valueType: 'number', options: function() { return self.tilesetOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { tilesetId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.tilesetId || 1) || 1))];
            }
        });

        reg(283, {
            code: 283,
            title: '戦闘背景の変更',
            description: '戦闘背景1/2の画像名を設定します。',
            fields: [
                { key: 'bb1', type: 'text', label: '戦闘背景1ファイル名' },
                { key: 'bb2', type: 'text', label: '戦闘背景2ファイル名' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { bb1: String(p[0] || ''), bb2: String(p[1] || '') };
            },
            toParams: function(state) {
                return [String(state.bb1 || ''), String(state.bb2 || '')];
            }
        });

        reg(284, {
            code: 284,
            title: '遠景の変更',
            description: '遠景画像・ループ・スクロール速度を設定します。',
            fields: [
                { key: 'name', type: 'text', label: '遠景ファイル名' },
                { key: 'loopX', type: 'bool', label: '横方向にループ' },
                { key: 'loopY', type: 'bool', label: '縦方向にループ' },
                { key: 'sx', type: 'number', label: '横スクロール速度', step: 1 },
                { key: 'sy', type: 'number', label: '縦スクロール速度', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    name: String(p[0] || ''),
                    loopX: !!p[1],
                    loopY: !!p[2],
                    sx: Math.floor(Number(p[3] || 0) || 0),
                    sy: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    String(state.name || ''),
                    !!state.loopX,
                    !!state.loopY,
                    Math.floor(Number(state.sx || 0) || 0),
                    Math.floor(Number(state.sy || 0) || 0)
                ];
            }
        });

        reg(285, {
            code: 285,
            title: '指定位置の情報取得',
            description: '指定座標の情報を変数へ格納します。',
            fields: [
                { key: 'variableId', type: 'variable', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'infoType', type: 'select', label: '取得情報', valueType: 'number', options: [{ value: 0, label: '地形タグ' }, { value: 1, label: 'イベントID' }, { value: 2, label: 'タイルID(レイヤー1)' }, { value: 3, label: 'タイルID(レイヤー2)' }, { value: 4, label: 'タイルID(レイヤー3)' }, { value: 5, label: 'タイルID(レイヤー4)' }, { value: 6, label: 'リージョンID' }] },
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X (値 / 変数ID)', step: 1 },
                { key: 'y', type: 'number', label: 'Y (値 / 変数ID)', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    infoType: Math.max(0, Math.min(6, Math.floor(Number(p[1] || 0) || 0))),
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    x: Math.floor(Number(p[3] || 0) || 0),
                    y: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.variableId || 1) || 1)),
                    Math.max(0, Math.min(6, Math.floor(Number(state.infoType || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0))),
                    Math.floor(Number(state.x || 0) || 0),
                    Math.floor(Number(state.y || 0) || 0)
                ];
            }
        });

        reg(201, {
            code: 201,
            title: '場所移動',
            description: 'プレイヤーの場所移動先を設定します。',
            fields: [
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'mapId', type: 'list', label: 'マップ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.mapInfoOptionsForSchema(); } },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'mapVarId', type: 'variable', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 0, label: 'そのまま' }, { value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] },
                { key: 'fadeType', type: 'select', label: 'フェード', valueType: 'number', options: [{ value: 0, label: '黒' }, { value: 1, label: '白' }, { value: 2, label: 'なし' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    mapId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    x: Math.floor(Number(p[2] || 0) || 0),
                    y: Math.floor(Number(p[3] || 0) || 0),
                    mapVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    xVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    direction: Math.floor(Number(p[4] || 0) || 0),
                    fadeType: Math.max(0, Math.min(2, Math.floor(Number(p[5] || 0) || 0)))
                };
            },
            toParams: function(state) {
                var locType = Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0)));
                var mapRef = (locType === 0)
                    ? Math.max(1, Math.floor(Number(state.mapId || 1) || 1))
                    : Math.max(1, Math.floor(Number(state.mapVarId || 1) || 1));
                var xRef = (locType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (locType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                var direction = Math.floor(Number(state.direction || 0) || 0);
                if ([0, 2, 4, 6, 8].indexOf(direction) < 0) direction = 0;
                return [locType, mapRef, xRef, yRef, direction, Math.max(0, Math.min(2, Math.floor(Number(state.fadeType || 0) || 0)))];
            }
        });

        reg(202, {
            code: 202,
            title: '乗り物の位置設定',
            description: '乗り物の配置位置を設定します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: [{ value: 0, label: '小型船' }, { value: 1, label: '大型船' }, { value: 2, label: '飛行船' }] },
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'mapId', type: 'list', label: 'マップ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.mapInfoOptionsForSchema(); } },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'mapVarId', type: 'variable', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    mapId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    x: Math.floor(Number(p[3] || 0) || 0),
                    y: Math.floor(Number(p[4] || 0) || 0),
                    mapVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    xVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1))
                };
            },
            toParams: function(state) {
                var locType = Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0)));
                var mapRef = (locType === 0)
                    ? Math.max(1, Math.floor(Number(state.mapId || 1) || 1))
                    : Math.max(1, Math.floor(Number(state.mapVarId || 1) || 1));
                var xRef = (locType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (locType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    locType,
                    mapRef,
                    xRef,
                    yRef
                ];
            }
        });

        reg(203, {
            code: 203,
            title: 'イベントの位置設定',
            description: '対象キャラクターの位置を変更します。',
            fields: [
                { key: 'targetId', type: 'list', label: '移動対象', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'locType', type: 'select', label: '移動方法', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }, { value: 2, label: '他キャラと交換' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'swapTargetId', type: 'list', label: '交換対象', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 0, label: 'そのまま' }, { value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    locType: Math.max(0, Math.min(2, Math.floor(Number(p[1] || 0) || 0))),
                    x: Math.floor(Number(p[2] || 0) || 0),
                    y: Math.floor(Number(p[3] || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    swapTargetId: self.normalizeMoveTarget(Number(p[2] || 0)),
                    direction: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                var targetId = self.normalizeMoveTarget(Number(state.targetId || 0));
                var locType = Math.max(0, Math.min(2, Math.floor(Number(state.locType || 0) || 0)));
                var direction = Math.floor(Number(state.direction || 0) || 0);
                if ([0, 2, 4, 6, 8].indexOf(direction) < 0) direction = 0;
                if (locType === 0) {
                    return [targetId, 0, Math.floor(Number(state.x || 0) || 0), Math.floor(Number(state.y || 0) || 0), direction];
                }
                if (locType === 1) {
                    return [targetId, 1, Math.max(1, Math.floor(Number(state.xVarId || 1) || 1)), Math.max(1, Math.floor(Number(state.yVarId || 1) || 1)), direction];
                }
                return [targetId, 2, self.normalizeMoveTarget(Number(state.swapTargetId || 0)), 0, direction];
            }
        });

        reg(204, {
            code: 204,
            title: 'マップのスクロール',
            description: 'マップを指定方向へスクロールします。',
            fields: [
                { key: 'direction', type: 'select', label: '方向', valueType: 'number', options: [{ value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] },
                { key: 'distance', type: 'number', label: '距離', min: 1, step: 1 },
                { key: 'speed', type: 'number', label: '速度', min: 1, max: 6, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    direction: [2, 4, 6, 8].indexOf(Number(p[0])) >= 0 ? Number(p[0]) : 2,
                    distance: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    speed: Math.max(1, Math.min(6, Math.floor(Number(p[2] || 4) || 4)))
                };
            },
            toParams: function(state) {
                var direction = Math.floor(Number(state.direction || 2) || 2);
                if ([2, 4, 6, 8].indexOf(direction) < 0) direction = 2;
                return [
                    direction,
                    Math.max(1, Math.floor(Number(state.distance || 1) || 1)),
                    Math.max(1, Math.min(6, Math.floor(Number(state.speed || 4) || 4)))
                ];
            }
        });

        reg(205, {
            code: 205,
            title: '移動ルートの設定',
            description: '対象キャラクターと移動ルートを設定します（JSON形式）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'repeat', type: 'bool', label: '繰り返す' },
                { key: 'skippable', type: 'bool', label: '移動できない場合は飛ばす' },
                { key: 'wait', type: 'bool', label: '完了までウェイト' },
                { key: 'routeListJson', type: 'textarea', label: 'ルートコマンド配列(JSON)', full: true, rows: 10, hint: '例: [{\"code\":1,\"parameters\":[]},{\"code\":15,\"parameters\":[30]}]' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var route = (p[1] && typeof p[1] === 'object') ? clone(p[1]) : { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] };
                var list = Array.isArray(route.list) ? route.list : [];
                var viewList = [];
                for (var i = 0; i < list.length; i++) {
                    var rc = list[i];
                    if (!rc || Number(rc.code || 0) <= 0) continue;
                    viewList.push({ code: Math.floor(Number(rc.code || 0) || 0), parameters: Array.isArray(rc.parameters) ? clone(rc.parameters) : [] });
                }
                var jsonText = '[]';
                try { jsonText = JSON.stringify(viewList, null, 2); } catch (_) {}
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    repeat: !!route.repeat,
                    skippable: !!route.skippable,
                    wait: !!route.wait,
                    routeListJson: jsonText
                };
            },
            toParams: function(state) {
                var list = [];
                var raw = String(state.routeListJson || '').trim();
                if (raw.length) {
                    var arr = JSON.parse(raw);
                    if (!Array.isArray(arr)) throw new Error('ルートコマンド配列(JSON)は配列で指定してください');
                    for (var i = 0; i < arr.length; i++) {
                        var rc = arr[i];
                        if (!rc) continue;
                        var code = Math.floor(Number(rc.code || 0) || 0);
                        if (code <= 0) continue;
                        list.push({
                            code: code,
                            parameters: Array.isArray(rc.parameters) ? rc.parameters : []
                        });
                    }
                }
                list.push({ code: 0, parameters: [] });
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    {
                        repeat: !!state.repeat,
                        skippable: !!state.skippable,
                        wait: !!state.wait,
                        list: list
                    }
                ];
            }
        });

        reg(206, {
            code: 206,
            title: '乗り物の乗降',
            description: 'プレイヤーを乗り物に乗降させます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(211, {
            code: 211,
            title: '透明状態の変更',
            description: 'プレイヤーの透明状態を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '透明状態', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(212, {
            code: 212,
            commandCode: 355,
            script355: true,
            title: 'アニメーションの表示',
            description: 'this.character(targetId).requestAnimation(animationId, addX, addY, scale) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'animationId', type: 'list', label: 'アニメーション', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.animationOptionsForSchema(); } },
                { key: 'addX', type: 'number', label: 'addX(px)', step: 1, compact: true },
                { key: 'addY', type: 'number', label: 'addY(px)', step: 1, compact: true },
                { key: 'scale', type: 'number', label: 'scale', min: 0.01, step: 0.1, integer: false, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.animationRequestSpecFromEntry(entry);
                if (!spec) {
                    return {
                        targetId: 0,
                        animationId: 1,
                        addX: 0,
                        addY: 0,
                        scale: 1
                    };
                }
                return {
                    targetId: self.normalizeMoveTarget(Number(spec.targetId || 0)),
                    animationId: Math.max(1, Math.floor(Number(spec.animationId || 1) || 1)),
                    addX: Number(spec.addX || 0),
                    addY: Number(spec.addY || 0),
                    scale: Number(spec.scale == null ? 1 : spec.scale)
                };
            },
            toParams: function(state) {
                return [this.makeCharacterRequestAnimationScript(
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Math.max(1, Math.floor(Number(state.animationId || 1) || 1)),
                    Number(state.addX || 0),
                    Number(state.addY || 0),
                    Number(state.scale == null ? 1 : state.scale)
                )];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(213, {
            code: 213,
            title: 'フキダシアイコンの表示',
            description: '対象キャラクターにフキダシを表示します。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'balloonId', type: 'select', label: 'フキダシ', valueType: 'number', options: function() { return self.balloonOptionsForSchema(); } },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    balloonId: self.normalizeBalloonIdForSchema(p[1]),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    self.normalizeBalloonIdForSchema(state.balloonId),
                    !!state.wait
                ];
            }
        });

        reg(214, {
            code: 214,
            title: 'イベントの一時消去',
            description: 'このイベントを一時消去します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(216, {
            code: 216,
            title: '隊列歩行の変更',
            description: '隊列歩行のON/OFFを切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '隊列歩行', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(217, {
            code: 217,
            title: '隊列メンバーの集合',
            description: '隊列メンバーを集合させます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(231, {
            code: 231,
            title: 'ピクチャの表示',
            description: 'ピクチャを表示します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'name', type: 'text', label: 'ファイル名', full: true },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', options: [{ value: 0, label: '左上' }, { value: 1, label: '中央' }] },
                { key: 'coordType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1 },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1 },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1 },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', options: [{ value: 0, label: '通常' }, { value: 1, label: '加算' }, { value: 2, label: '乗算' }, { value: 3, label: 'スクリーン' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    name: String(p[1] || ''),
                    origin: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    coordType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    x: Math.floor(Number(p[4] || 0) || 0),
                    y: Math.floor(Number(p[5] || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[5] || 1) || 1)),
                    scaleX: Math.floor(Number(p[6] || 100) || 100),
                    scaleY: Math.floor(Number(p[7] || 100) || 100),
                    opacity: Math.max(0, Math.min(255, Math.floor(Number(p[8] || 255) || 255))),
                    blendMode: Math.max(0, Math.min(3, Math.floor(Number(p[9] || 0) || 0)))
                };
            },
            toParams: function(state) {
                var coordType = Math.max(0, Math.min(1, Math.floor(Number(state.coordType || 0) || 0)));
                var xRef = (coordType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (coordType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    String(state.name || ''),
                    Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0))),
                    coordType,
                    xRef,
                    yRef,
                    Math.floor(Number(state.scaleX || 100) || 100),
                    Math.floor(Number(state.scaleY || 100) || 100),
                    Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255))),
                    Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0)))
                ];
            }
        });

        reg(232, {
            code: 232,
            title: 'ピクチャの移動',
            description: 'ピクチャを移動/変形します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'param1', type: 'number', label: '内部param1', step: 1, hint: 'MV内部仕様用。通常は0。' },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', options: [{ value: 0, label: '左上' }, { value: 1, label: '中央' }] },
                { key: 'coordType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1 },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1 },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1 },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', options: [{ value: 0, label: '通常' }, { value: 1, label: '加算' }, { value: 2, label: '乗算' }, { value: 3, label: 'スクリーン' }] },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var n = p.length;
                var isV12 = n >= 12;
                var origin = isV12 ? Number(p[2] || 0) : Number(p[1] || 0);
                var coordType = isV12 ? Number(p[3] || 0) : Number(p[2] || 0);
                var xRef = isV12 ? Number(p[4] || 0) : Number(p[3] || 0);
                var yRef = isV12 ? Number(p[5] || 0) : Number(p[4] || 0);
                var scaleX = isV12 ? Number(p[6] || 100) : Number(p[5] || 100);
                var scaleY = isV12 ? Number(p[7] || 100) : Number(p[6] || 100);
                var opacity = isV12 ? Number(p[8] || 255) : Number(p[7] || 255);
                var blendMode = isV12 ? Number(p[9] || 0) : Number(p[8] || 0);
                var duration = isV12 ? Number(p[10] || 0) : Number(p[9] || 0);
                var wait = isV12 ? !!p[11] : !!p[10];
                var param1 = isV12 ? Number(p[1] || 0) : 0;
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    param1: Math.floor(Number(param1 || 0) || 0),
                    origin: Math.max(0, Math.min(1, Math.floor(origin || 0))),
                    coordType: Math.max(0, Math.min(1, Math.floor(coordType || 0))),
                    x: Math.floor(Number(xRef || 0) || 0),
                    y: Math.floor(Number(yRef || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(xRef || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(yRef || 1) || 1)),
                    scaleX: Math.floor(Number(scaleX || 100) || 100),
                    scaleY: Math.floor(Number(scaleY || 100) || 100),
                    opacity: Math.max(0, Math.min(255, Math.floor(Number(opacity || 255) || 255))),
                    blendMode: Math.max(0, Math.min(3, Math.floor(Number(blendMode || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(duration || 0) || 0)),
                    wait: wait
                };
            },
            toParams: function(state) {
                var coordType = Math.max(0, Math.min(1, Math.floor(Number(state.coordType || 0) || 0)));
                var xRef = (coordType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (coordType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    Math.floor(Number(state.param1 || 0) || 0),
                    Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0))),
                    coordType,
                    xRef,
                    yRef,
                    Math.floor(Number(state.scaleX || 100) || 100),
                    Math.floor(Number(state.scaleY || 100) || 100),
                    Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255))),
                    Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(233, {
            code: 233,
            title: 'ピクチャの回転',
            description: 'ピクチャの回転速度を設定します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'speed', type: 'number', label: '回転速度', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    speed: Math.floor(Number(p[1] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    Math.floor(Number(state.speed || 0) || 0)
                ];
            }
        });

        reg(234, {
            code: 234,
            title: 'ピクチャの色調変更',
            description: 'ピクチャの色調を変更します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[1] && Array.isArray(p[1])) ? p[1] : [0, 0, 0, 0];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    [
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(235, {
            code: 235,
            title: 'ピクチャの消去',
            description: '指定ピクチャを消去します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.pictureId || 1) || 1))];
            }
        });

        reg(221, {
            code: 221,
            title: '画面のフェードアウト',
            description: '画面をフェードアウトします。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(222, {
            code: 222,
            title: '画面のフェードイン',
            description: '画面をフェードインします。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(223, {
            code: 223,
            title: '画面の色調変更',
            description: '画面色調を変更します。',
            fields: [
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[0] && Array.isArray(p[0])) ? p[0] : [0, 0, 0, 0];
                return {
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    [
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(224, {
            code: 224,
            title: '画面のフラッシュ',
            description: '画面をフラッシュさせます。',
            fields: [
                { key: 'r', type: 'number', label: '赤', min: 0, max: 255, step: 1 },
                { key: 'g', type: 'number', label: '緑', min: 0, max: 255, step: 1 },
                { key: 'b', type: 'number', label: '青', min: 0, max: 255, step: 1 },
                { key: 'a', type: 'number', label: '強さ(アルファ)', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var c = (p[0] && Array.isArray(p[0])) ? p[0] : [255, 255, 255, 255];
                return {
                    r: Math.max(0, Math.min(255, Math.floor(Number(c[0] || 0) || 0))),
                    g: Math.max(0, Math.min(255, Math.floor(Number(c[1] || 0) || 0))),
                    b: Math.max(0, Math.min(255, Math.floor(Number(c[2] || 0) || 0))),
                    a: Math.max(0, Math.min(255, Math.floor(Number(c[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    [
                        Math.max(0, Math.min(255, Math.floor(Number(state.r || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.g || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.b || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.a || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(225, {
            code: 225,
            title: '画面のシェイク',
            description: '画面をシェイクさせます。',
            fields: [
                { key: 'power', type: 'number', label: '強さ', min: 0, max: 9, step: 1 },
                { key: 'speed', type: 'number', label: '速さ', min: 1, max: 9, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    power: Math.max(0, Math.min(9, Math.floor(Number(p[0] || 0) || 0))),
                    speed: Math.max(1, Math.min(9, Math.floor(Number(p[1] || 5) || 5))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(9, Math.floor(Number(state.power || 0) || 0))),
                    Math.max(1, Math.min(9, Math.floor(Number(state.speed || 5) || 5))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(236, {
            code: 236,
            title: '天候の設定',
            description: '天候と強さを設定します。',
            fields: [
                { key: 'weatherType', type: 'select', label: '天候', valueType: 'number', options: [{ value: 0, label: 'なし' }, { value: 1, label: '雨' }, { value: 2, label: '嵐' }, { value: 3, label: '雪' }] },
                { key: 'power', type: 'number', label: '強さ', min: 0, max: 9, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    weatherType: Math.max(0, Math.min(3, Math.floor(Number(p[0] || 0) || 0))),
                    power: Math.max(0, Math.min(9, Math.floor(Number(p[1] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(3, Math.floor(Number(state.weatherType || 0) || 0))),
                    Math.max(0, Math.min(9, Math.floor(Number(state.power || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(241, {
            code: 241,
            title: 'BGMの演奏',
            description: 'BGMを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(242, {
            code: 242,
            title: 'BGMのフェードアウト',
            description: 'BGMをフェードアウトします。',
            fields: [
                { key: 'seconds', type: 'number', label: '時間(秒)', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { seconds: Math.max(0, Math.floor(Number(p[0] || 0) || 0)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.floor(Number(state.seconds || 0) || 0))];
            }
        });

        reg(243, {
            code: 243,
            title: 'BGMの保存',
            description: '現在のBGMを保存します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(244, {
            code: 244,
            title: 'BGMの再開',
            description: '保存したBGMを再開します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(245, {
            code: 245,
            title: 'BGSの演奏',
            description: 'BGSを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGSファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(246, {
            code: 246,
            title: 'BGSのフェードアウト',
            description: 'BGSをフェードアウトします。',
            fields: [
                { key: 'seconds', type: 'number', label: '時間(秒)', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { seconds: Math.max(0, Math.floor(Number(p[0] || 0) || 0)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.floor(Number(state.seconds || 0) || 0))];
            }
        });

        reg(249, {
            code: 249,
            title: 'MEの演奏',
            description: 'MEを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(250, {
            code: 250,
            title: 'SEの演奏',
            description: 'SEを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'SEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(251, {
            code: 251,
            title: 'SEの停止',
            description: '再生中のSEを停止します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(261, {
            code: 261,
            title: 'ムービーの再生',
            description: 'ムービーを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'ムービーファイル名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { name: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.name || '')];
            }
        });

        reg(125, {
            code: 125,
            title: '所持金の増減',
            description: '所持金を増減します。',
            fields: [
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[2] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(126, {
            code: 126,
            title: 'アイテムの増減',
            description: '指定アイテムを増減します。',
            fields: [
                { key: 'itemId', type: 'list', label: 'アイテム', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.itemOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    itemId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.itemId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(127, {
            code: 127,
            title: '武器の増減',
            description: '指定武器を増減します。',
            fields: [
                { key: 'weaponId', type: 'list', label: '武器', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.weaponOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 },
                { key: 'includeEquip', type: 'bool', label: '装備中を含む(減少時)' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    weaponId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0)),
                    includeEquip: !!p[4]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.weaponId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.includeEquip
                ];
            }
        });

        reg(128, {
            code: 128,
            title: '防具の増減',
            description: '指定防具を増減します。',
            fields: [
                { key: 'armorId', type: 'list', label: '防具', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.armorOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 },
                { key: 'includeEquip', type: 'bool', label: '装備中を含む(減少時)' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    armorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0)),
                    includeEquip: !!p[4]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.armorId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.includeEquip
                ];
            }
        });

        reg(129, {
            code: 129,
            title: 'メンバーの入れ替え',
            description: 'パーティメンバーの加入/離脱を設定します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '加入' }, { value: 1, label: '離脱' }] },
                { key: 'initialize', type: 'bool', label: '加入時に初期化する' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    initialize: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    !!state.initialize
                ];
            }
        });

        reg(311, {
            code: 311,
            title: 'HPの増減',
            description: '対象アクターのHPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'allowDeath', type: 'bool', label: '戦闘不能を許可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    allowDeath: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.allowDeath
                ];
            }
        });

        reg(312, {
            code: 312,
            title: 'MPの増減',
            description: '対象アクターのMPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(326, {
            code: 326,
            title: 'TPの増減',
            description: '対象アクターのTPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(313, {
            code: 313,
            title: 'ステートの変更',
            description: '対象アクターのステートを付与/解除します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '付与' }, { value: 1, label: '解除' }] },
                { key: 'stateId', type: 'list', label: 'ステート', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.stateOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    stateId: Math.max(1, Math.floor(Number(p[3] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.stateId || 1) || 1))
                ];
            }
        });

        reg(314, {
            code: 314,
            title: '全回復',
            description: '対象アクターを全回復します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [targetType, targetRef];
            }
        });

        reg(315, {
            code: 315,
            title: '経験値の増減',
            description: '対象アクターの経験値を増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'showLevelUp', type: 'bool', label: 'レベルアップ表示を行う' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    showLevelUp: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.showLevelUp
                ];
            }
        });

        reg(316, {
            code: 316,
            title: 'レベルの増減',
            description: '対象アクターのレベルを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'showLevelUp', type: 'bool', label: 'レベルアップ表示を行う' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    showLevelUp: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.showLevelUp
                ];
            }
        });

        reg(317, {
            code: 317,
            title: '能力値の増減',
            description: '対象アクターの能力値を増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'paramId', type: 'select', label: '能力値', valueType: 'number', options: [{ value: 0, label: '最大HP' }, { value: 1, label: '最大MP' }, { value: 2, label: '攻撃力' }, { value: 3, label: '防御力' }, { value: 4, label: '魔法力' }, { value: 5, label: '魔法防御' }, { value: 6, label: '敏捷性' }, { value: 7, label: '運' }] },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    paramId: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0))),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[4] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[5] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(7, Math.floor(Number(state.paramId || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(318, {
            code: 318,
            title: 'スキルの増減',
            description: '対象アクターにスキルを習得/忘却させます。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '習得' }, { value: 1, label: '忘却' }] },
                { key: 'skillId', type: 'list', label: 'スキル', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.skillOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    skillId: Math.max(1, Math.floor(Number(p[3] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.skillId || 1) || 1))
                ];
            }
        });

        reg(319, {
            code: 319,
            title: '装備の変更',
            description: '対象アクターの装備スロットを変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'equipTypeId', type: 'list', label: '装備タイプ', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.equipTypeOptionsForSchema(); } },
                { key: 'itemId', type: 'number', label: '装備ID', min: 0, step: 1, hint: '0で装備を外す。武器/防具IDは装備タイプに対応したIDを指定。' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    equipTypeId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    itemId: Math.max(0, Math.floor(Number(p[2] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(1, Math.floor(Number(state.equipTypeId || 1) || 1)),
                    Math.max(0, Math.floor(Number(state.itemId || 0) || 0))
                ];
            }
        });

        reg(320, {
            code: 320,
            title: '名前の変更',
            description: '対象アクターの名前を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'name', type: 'text', label: '新しい名前', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    name: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.name == null ? '' : state.name)
                ];
            }
        });

        reg(321, {
            code: 321,
            title: '職業の変更',
            description: '対象アクターの職業を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'classId', type: 'list', label: '職業', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.classOptionsForSchema(); } },
                { key: 'keepExp', type: 'bool', label: '経験値を維持する' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    classId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    keepExp: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(1, Math.floor(Number(state.classId || 1) || 1)),
                    !!state.keepExp
                ];
            }
        });

        reg(324, {
            code: 324,
            title: '二つ名の変更',
            description: '対象アクターの二つ名を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'nickname', type: 'text', label: '新しい二つ名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    nickname: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.nickname == null ? '' : state.nickname)
                ];
            }
        });

        reg(325, {
            code: 325,
            title: 'プロフィールの変更',
            description: '対象アクターのプロフィール文を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'profile', type: 'textarea', label: 'プロフィール', full: true, rows: 8 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    profile: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.profile == null ? '' : state.profile)
                ];
            }
        });

        reg(331, {
            code: 331,
            title: '敵キャラのHP増減',
            description: '対象敵のHPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 },
                { key: 'allowDeath', type: 'bool', label: '戦闘不能を許可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0), allowDeath: !!p[4] };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0), !!state.allowDeath];
            }
        });

        reg(332, {
            code: 332,
            title: '敵キャラのMP増減',
            description: '対象敵のMPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0)];
            }
        });

        reg(342, {
            code: 342,
            title: '敵キャラのTP増減',
            description: '対象敵のTPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0)];
            }
        });

        reg(333, {
            code: 333,
            title: '敵キャラのステート変更',
            description: '対象敵にステートを付与/解除します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'mode', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '付与' }, { value: 1, label: '解除' }] },
                { key: 'stateId', type: 'list', label: 'ステート', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.stateOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), mode: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), stateId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0))), Math.max(1, Math.floor(Number(state.stateId || 1) || 1))];
            }
        });

        reg(334, {
            code: 334,
            title: '敵キャラの全回復',
            description: '対象敵を全回復します。',
            fields: [{ key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0) };
            },
            toParams: function(state) { return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0)]; }
        });

        reg(335, {
            code: 335,
            title: '敵キャラの出現',
            description: '対象敵を出現させます。',
            fields: [{ key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0) };
            },
            toParams: function(state) { return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0)]; }
        });

        reg(336, {
            code: 336,
            title: '敵キャラの変身',
            description: '対象敵を別の敵キャラに変身させます。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'enemyId', type: 'list', label: '変身先敵キャラ', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.enemyOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), enemyId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(1, Math.floor(Number(state.enemyId || 1) || 1))];
            }
        });

        reg(337, {
            code: 337,
            title: '戦闘アニメーションの表示',
            description: '対象敵にアニメーションを表示します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号', min: -1, step: 1, hint: '全体指定ON時は無視されます' },
                { key: 'animationId', type: 'list', label: 'アニメーション', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.animationOptionsForSchema(); } },
                { key: 'allEnemies', type: 'bool', label: '敵グループ全体に表示' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), animationId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)), allEnemies: !!p[2] };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(1, Math.floor(Number(state.animationId || 1) || 1)), !!state.allEnemies];
            }
        });

        reg(339, {
            code: 339,
            title: '戦闘行動の強制',
            description: '敵/アクターにスキル使用を強制します。',
            fields: [
                { key: 'battlerType', type: 'select', label: '対象種別', valueType: 'number', options: [{ value: 0, label: '敵キャラ' }, { value: 1, label: 'アクター' }] },
                { key: 'targetId', type: 'number', label: '対象ID', min: -1, step: 1, hint: '敵: 番号(-1=全体) / アクター: アクターID' },
                { key: 'skillId', type: 'number', label: 'スキルID', min: 1, step: 1 },
                { key: 'forceTarget', type: 'number', label: '行動対象インデックス', step: 1, hint: '-2=最後の対象, -1=ランダム' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    battlerType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    targetId: Math.floor(Number(p[1] || 0) || 0),
                    skillId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    forceTarget: Math.floor(Number(p[3] == null ? -2 : p[3]) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(1, Math.floor(Number(state.battlerType || 0) || 0))),
                    Math.floor(Number(state.targetId || 0) || 0),
                    Math.max(1, Math.floor(Number(state.skillId || 1) || 1)),
                    Math.floor(Number(state.forceTarget == null ? -2 : state.forceTarget) || 0)
                ];
            }
        });

        reg(340, { code: 340, title: 'バトルの中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });

        reg(356, {
            code: 356,
            title: 'プラグインコマンド',
            description: '実行するプラグインコマンド行を入力します。',
            fields: [
                { key: 'pluginLine', type: 'text', label: 'コマンド行', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { pluginLine: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.pluginLine || '')];
            }
        });

        reg(112, { code: 112, title: 'ループ', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
        reg(113, { code: 113, title: 'ループの中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
        reg(115, { code: 115, title: 'イベント処理の中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
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

    EE.prototype.renderSchemaField = function(field, value, state) {
        var selfEE = this;
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
                var lbl = this.el('label', '', String(field.label || field.key || ''));
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
                row.appendChild(this.el('label', '', String(field.label || field.key || '')));
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
        } else if (field.type === 'bool') {
            var cb = this.el('input', '');
            cb.type = 'checkbox';
            cb.checked = !!value;
            row.appendChild(this.el('label', '', String(field.label || field.key || '')));
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
        this.refreshSchemaFieldVisibility();
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

