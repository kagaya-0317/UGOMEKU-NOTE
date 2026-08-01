//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Shared
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Shared infrastructure for the event timeline editor
 * @author kagaya
 * @help
 * Internal module. Load before the other timeline modules.
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;

    var SH = NS._eeTimelineShared || (NS._eeTimelineShared = {});
    if (SH.ready) return;

    SH.modules = Object.create(null);
    SH.registerModule = function(name, dependencies, overrides) {
        name = String(name || '');
        dependencies = Array.isArray(dependencies) ? dependencies : [];
        overrides = Array.isArray(overrides) ? overrides.slice(0) : [];
        if (!name.length) throw new Error('Timeline module name is required');
        for (var i = 0; i < dependencies.length; i++) {
            var dependency = String(dependencies[i] || '');
            if (dependency && !SH.modules[dependency]) {
                throw new Error('Timeline module dependency missing: ' + name + ' -> ' + dependency);
            }
        }
        SH.modules[name] = {
            dependencies: dependencies.slice(0),
            overrides: overrides
        };
    };

    SH.hasModules = function(names) {
        names = Array.isArray(names) ? names : [];
        for (var i = 0; i < names.length; i++) {
            if (!SH.modules[String(names[i] || '')]) return false;
        }
        return true;
    };

    var U = NS._eeUtils || {};
    SH.clone = U.clone || function(v) { return JSON.parse(JSON.stringify(v)); };
    SH.maximizeWindowForEditor = U.maximizeWindowForEditor || function() { return false; };
    SH.installEscapeConvertFallback = U.installEscapeConvertFallback || function() {};
    SH.RE_COMPACT_SELECT_KEY = U.RE_COMPACT_SELECT_KEY || /type|mode|op|operand|scope|target|operation|blend|dir|designate/i;
    SH.RE_COMPACT_NUMBER_KEY = U.RE_COMPACT_NUMBER_KEY || /id$|index|mode|type|value|x$|y$|z$|r$|g$|b$|a$|wait|time|frame|duration|speed|pan|pitch|volume|opacity/i;
    SH.RE_COMPACT_TEXT_KEY = U.RE_COMPACT_TEXT_KEY || /id$|tag|code|label|name/i;

    SH.COMMAND_CODE = {
        SHOW_CHOICES: 102,
        CONDITIONAL_BRANCH: 111,
        MOVE_ROUTE: 205,
        WAIT: 230,
        CHOICE_BRANCH: 402,
        CHOICE_CANCEL: 403,
        CHOICE_END: 404,
        CONDITIONAL_ELSE: 411,
        CONDITIONAL_END: 412
    };

    SH.entryUid = function(entry) {
        return Math.floor(Number(entry && entry.uid || 0));
    };

    SH.entryCode = function(entry) {
        return Math.floor(Number(entry && entry.command && entry.command.code || 0));
    };

    SH.trackCommands = function(track) {
        return track && Array.isArray(track.commands) ? track.commands : [];
    };

    SH.compareEntriesByFrameWaitUid = function(a, b) {
        var af = Math.max(0, Math.floor(Number(a && a.frame || 0)));
        var bf = Math.max(0, Math.floor(Number(b && b.frame || 0)));
        if (af !== bf) return af - bf;
        var aw = Math.max(0, Math.floor(Number(a && a.wait || 0))) > 0 ? 1 : 0;
        var bw = Math.max(0, Math.floor(Number(b && b.wait || 0))) > 0 ? 1 : 0;
        if (aw !== bw) return aw - bw;
        return SH.entryUid(a) - SH.entryUid(b);
    };

    SH.sortTrackCommands = function(track) {
        var commands = SH.trackCommands(track);
        commands.sort(SH.compareEntriesByFrameWaitUid);
        return commands;
    };

    SH.compareEntriesBySourceOrder = function(a, b) {
        return SH.entryUid(a) - SH.entryUid(b);
    };

    SH.commandsInSourceOrder = function(track) {
        return SH.trackCommands(track).slice(0).sort(SH.compareEntriesBySourceOrder);
    };

    SH.commandsInSaveOrder = function(track) {
        var source = SH.commandsInSourceOrder(track);
        if (!source.length) return source;

        // UID order describes branch membership, but it does not describe the
        // timeline after commands have been moved. Build structural sequences
        // from UID order, then sort only the executable items in each sequence.
        var index = 0;
        var valid = true;

        var entryCode = function(entry) {
            return Math.floor(Number(entry && entry.command && entry.command.code || 0));
        };
        var entryIndent = function(entry) {
            return Math.max(0, Math.floor(Number(entry && entry.command && entry.command.indent || 0)));
        };

        var parseSequence;
        var parseIf = function() {
            var owner = source[index++];
            var indent = entryIndent(owner);
            var thenSequence = parseSequence(indent, { 411: true, 412: true });
            var elseMarker = null;
            var elseSequence = null;
            var endMarker = null;
            if (index < source.length && entryIndent(source[index]) === indent && entryCode(source[index]) === 411) {
                elseMarker = source[index++];
                elseSequence = parseSequence(indent, { 412: true });
            }
            if (index < source.length && entryIndent(source[index]) === indent && entryCode(source[index]) === 412) {
                endMarker = source[index++];
            } else {
                valid = false;
            }
            return {
                type: 'if',
                anchor: owner,
                owner: owner,
                thenSequence: thenSequence,
                elseMarker: elseMarker,
                elseSequence: elseSequence,
                endMarker: endMarker
            };
        };

        var parseChoice = function() {
            var owner = source[index++];
            var indent = entryIndent(owner);
            var branches = [];
            var endMarker = null;
            while (index < source.length) {
                var marker = source[index];
                var code = entryCode(marker);
                if (entryIndent(marker) !== indent) {
                    valid = false;
                    break;
                }
                if (code === 404) {
                    endMarker = marker;
                    index++;
                    break;
                }
                if (code !== 402 && code !== 403) {
                    valid = false;
                    break;
                }
                index++;
                branches.push({
                    marker: marker,
                    sequence: parseSequence(indent, { 402: true, 403: true, 404: true })
                });
            }
            if (!endMarker || !branches.length) valid = false;
            return {
                type: 'choice',
                anchor: owner,
                owner: owner,
                branches: branches,
                endMarker: endMarker
            };
        };

        parseSequence = function(stopIndent, stopCodes) {
            var items = [];
            while (index < source.length) {
                var entry = source[index];
                var code = entryCode(entry);
                if (stopCodes && entryIndent(entry) === stopIndent && stopCodes[code]) break;
                if (code === 402 || code === 403 || code === 404 || code === 411 || code === 412) {
                    valid = false;
                }
                if (code === 111) items.push(parseIf());
                else if (code === 102) items.push(parseChoice());
                else {
                    index++;
                    items.push({ type: 'entry', anchor: entry, entry: entry });
                }
            }
            return { items: items };
        };

        var appendSequence;
        var appendNode = function(node, out) {
            if (node.type === 'entry') {
                out.push(node.entry);
                return;
            }
            out.push(node.owner);
            if (node.type === 'if') {
                appendSequence(node.thenSequence, out);
                if (node.elseMarker) {
                    out.push(node.elseMarker);
                    appendSequence(node.elseSequence, out);
                }
                if (node.endMarker) out.push(node.endMarker);
                return;
            }
            for (var i = 0; i < node.branches.length; i++) {
                out.push(node.branches[i].marker);
                appendSequence(node.branches[i].sequence, out);
            }
            if (node.endMarker) out.push(node.endMarker);
        };
        appendSequence = function(sequence, out) {
            var items = sequence.items.slice(0).sort(function(a, b) {
                return SH.compareEntriesByFrameWaitUid(a.anchor, b.anchor);
            });
            for (var i = 0; i < items.length; i++) appendNode(items[i], out);
        };

        var root = parseSequence(-1, null);
        var out = [];
        appendSequence(root, out);
        // Preserve malformed source data byte-for-byte in command order rather
        // than guessing at a broken branch structure.
        return valid && index === source.length && out.length === source.length ? out : source;
    };

    SH.createBranchFrameState = function() {
        return { stack: [] };
    };

    SH.openBranchFrame = function(state, code, indent, frame) {
        state = state || SH.createBranchFrameState();
        code = Math.floor(Number(code || 0));
        var type = code === SH.COMMAND_CODE.SHOW_CHOICES
            ? 'choice'
            : (code === SH.COMMAND_CODE.CONDITIONAL_BRANCH ? 'if' : '');
        if (!type) return frame;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        state.stack.push({
            type: type,
            indent: Math.max(0, Math.floor(Number(indent || 0))),
            baseFrame: frame,
            maxEndFrame: frame
        });
        return frame;
    };

    SH.branchFrameBeforeBoundary = function(state, code, indent, frame) {
        if (!state || !Array.isArray(state.stack) || !state.stack.length) return frame;
        code = Math.floor(Number(code || 0));
        indent = Math.max(0, Math.floor(Number(indent || 0)));
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var type = '';
        var close = false;
        if (code === SH.COMMAND_CODE.CHOICE_BRANCH || code === SH.COMMAND_CODE.CHOICE_CANCEL) type = 'choice';
        else if (code === SH.COMMAND_CODE.CHOICE_END) { type = 'choice'; close = true; }
        else if (code === SH.COMMAND_CODE.CONDITIONAL_ELSE) type = 'if';
        else if (code === SH.COMMAND_CODE.CONDITIONAL_END) { type = 'if'; close = true; }
        if (!type) return frame;
        for (var i = state.stack.length - 1; i >= 0; i--) {
            var branch = state.stack[i];
            if (!branch || branch.type !== type || branch.indent !== indent) continue;
            branch.maxEndFrame = Math.max(branch.maxEndFrame, frame);
            if (!close) return branch.baseFrame;
            state.stack.splice(i, 1);
            return branch.maxEndFrame;
        }
        return frame;
    };

    SH.findEntryIndexByUid = function(commands, uid) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0 || !Array.isArray(commands)) return -1;
        for (var i = 0; i < commands.length; i++) {
            if (SH.entryUid(commands[i]) === uid) return i;
        }
        return -1;
    };

    SH.findEntryByUid = function(track, uid) {
        var commands = SH.trackCommands(track);
        var index = SH.findEntryIndexByUid(commands, uid);
        return index >= 0 ? commands[index] : null;
    };

    SH.buildEntryUidMap = function(track) {
        var map = Object.create(null);
        var commands = SH.trackCommands(track);
        for (var i = 0; i < commands.length; i++) {
            var entry = commands[i];
            var uid = SH.entryUid(entry);
            if (uid > 0) map[String(uid)] = entry;
        }
        return map;
    };

    EE.prototype.selectedTrack = function() {
        if (!this.model || !this.model.tracks || !this.selKey) return null;
        return this.model.tracks[this.selKey] || null;
    };

    EE.prototype.sortTrackCommands = function(track) {
        return SH.sortTrackCommands(track);
    };

    EE.prototype.findTrackEntryIndexByUid = function(track, uid) {
        return SH.findEntryIndexByUid(SH.trackCommands(track), uid);
    };

    EE.prototype.findTrackEntryByUid = function(track, uid) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return null;
        if (this._trackReadCache && this._trackReadCache.track === track) {
            return this._trackReadCache.byUid[String(uid)] || null;
        }
        return SH.findEntryByUid(track, uid);
    };

    EE.prototype.beginTrackReadCache = function(track) {
        this._trackReadCache = {
            track: track || null,
            byUid: SH.buildEntryUidMap(track)
        };
    };

    EE.prototype.endTrackReadCache = function() {
        this._trackReadCache = null;
    };

    SH.characterImageFileExists = function(name) {
        name = String(name || '');
        if (!name.length) return false;
        try {
            if (typeof require !== 'function' || typeof process === 'undefined') return true;
            var fs = require('fs');
            var path = require('path');
            var roots = [];
            if (process && process.cwd) roots.push(process.cwd());
            if (process && process.mainModule && process.mainModule.filename) {
                roots.push(path.dirname(process.mainModule.filename));
            }
            for (var i = 0; i < roots.length; i++) {
                var root = roots[i];
                if (!root) continue;
                var dir = path.resolve(root, 'img', 'characters');
                var base = path.resolve(dir, name);
                if (base.indexOf(dir + path.sep) !== 0) continue;
                if (fs.existsSync(base + '.png') || fs.existsSync(base + '.rpgmvp')) return true;
            }
            return false;
        } catch (_) {
            return true;
        }
    };

    SH.loadCharacterBitmapIfExists = function(name) {
        if (!SH.characterImageFileExists(name)) return null;
        if (typeof ImageManager === 'undefined' || !ImageManager || typeof ImageManager.loadCharacter !== 'function') return null;
        return ImageManager.loadCharacter(name);
    };

    var EE_AnimationPreviewCharacter = function() {
        this.initialize.apply(this, arguments);
    };
    EE_AnimationPreviewCharacter.prototype = Object.create(Game_CharacterBase.prototype);
    EE_AnimationPreviewCharacter.prototype.constructor = EE_AnimationPreviewCharacter;
    EE_AnimationPreviewCharacter.prototype.initialize = function() {
        Game_CharacterBase.prototype.initMembers.call(this);
    };
    EE_AnimationPreviewCharacter.prototype.syncFrom = function(src) {
        if (!src) return;
        var keys = [
            '_x', '_y', '_realX', '_realY',
            '_moveSpeed', '_moveFrequency',
            '_opacity', '_blendMode', '_bushDepth', '_priorityType',
            '_direction', '_pattern', '_animationCount', '_stopCount',
            '_tileId', '_characterName', '_characterIndex', '_isObjectCharacter',
            '_walkAnime', '_stepAnime', '_directionFix', '_through', '_transparent',
            '_jumpCount', '_jumpPeak', '_moving',
            '_moveRouteForcing', '_movementSuccess',
            '_balloonId', '_balloonPlaying',
            '_animationId', '_animationPlaying',
            '_cssRect', '_cssRectAnimSourceRect',
            '_cssRectFrameAnimation', '_cssRectAnimRows', '_cssRectAnimCols',
            '_cssRectAnimSequence', '_cssRectAnimWait', '_cssRectAnimLoop',
            '_cssRectAnimIndex', '_cssRectAnimCounter'
        ];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (Object.prototype.hasOwnProperty.call(src, key)) this[key] = src[key];
        }
    };
    SH.EE_AnimationPreviewCharacter = EE_AnimationPreviewCharacter;

    if (!NS._eeAnimPreviewPositionPatchApplied && typeof Sprite_Animation !== 'undefined') {
        NS._eeAnimPreviewPositionPatchApplied = true;
        var _SpriteAnimation_updatePosition = Sprite_Animation.prototype.updatePosition;
        Sprite_Animation.prototype.updatePosition = function() {
            _SpriteAnimation_updatePosition.apply(this, arguments);
            var viewport = this._eePreviewViewport;
            if (!viewport || !this._animation) return;
            if (Number(this._animation.position || 0) === 3) {
                this.x = Math.floor(Number(viewport.w || 0) / 2);
                this.y = Math.floor(Number(viewport.h || 0) / 2);
            }
        };
    }

    SH.ready = true;
    SH.registerModule('shared');
})();
