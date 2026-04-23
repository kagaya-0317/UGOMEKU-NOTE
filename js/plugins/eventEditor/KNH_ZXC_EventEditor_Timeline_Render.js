//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Render
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.2 (KNH_ZXC_EventEditor_Timeline_Render)
 * @author kagaya
 * @help
 * KNH_ZXC_EventEditor.js の自動ロード用分割モジュールです。
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;

    var U = NS._eeUtils || {};
    var clone = U.clone || function(v) { return JSON.parse(JSON.stringify(v)); };
    var maximizeWindowForEditor = U.maximizeWindowForEditor || function() { return false; };
    var installEscapeConvertFallback = U.installEscapeConvertFallback || function() {};
    var RE_COMPACT_SELECT_KEY = U.RE_COMPACT_SELECT_KEY || /type|mode|op|operand|scope|target|operation|blend|dir|designate/i;
    var RE_COMPACT_NUMBER_KEY = U.RE_COMPACT_NUMBER_KEY || /id$|index|mode|type|value|x$|y$|z$|r$|g$|b$|a$|wait|time|frame|duration|speed|pan|pitch|volume|opacity/i;
    var RE_COMPACT_TEXT_KEY = U.RE_COMPACT_TEXT_KEY || /id$|tag|code|label|name/i;

    var SH = NS._eeTimelineShared || (NS._eeTimelineShared = {});
    var compareEntriesByFrameWaitUid = SH.compareEntriesByFrameWaitUid;
    if (!compareEntriesByFrameWaitUid) {
        compareEntriesByFrameWaitUid = function(a, b) {
            var af = Math.max(0, Math.floor(Number(a && a.frame || 0)));
            var bf = Math.max(0, Math.floor(Number(b && b.frame || 0)));
            if (af !== bf) return af - bf;
            var aw = Math.max(0, Math.floor(Number(a && a.wait || 0))) > 0 ? 1 : 0;
            var bw = Math.max(0, Math.floor(Number(b && b.wait || 0))) > 0 ? 1 : 0;
            if (aw !== bw) return aw - bw;
            return Math.floor(Number(a && a.uid || 0)) - Math.floor(Number(b && b.uid || 0));
        };
        SH.compareEntriesByFrameWaitUid = compareEntriesByFrameWaitUid;
    }

    var EE_AnimationPreviewCharacter = SH.EE_AnimationPreviewCharacter;
    if (!EE_AnimationPreviewCharacter) {
        EE_AnimationPreviewCharacter = function() {
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
                '_animationId', '_animationPlaying'
            ];
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (Object.prototype.hasOwnProperty.call(src, k)) this[k] = src[k];
            }
        };
        SH.EE_AnimationPreviewCharacter = EE_AnimationPreviewCharacter;
    }

    if (!NS._eeAnimPreviewPositionPatchApplied && typeof Sprite_Animation !== 'undefined') {
        NS._eeAnimPreviewPositionPatchApplied = true;
        var _EE_SpriteAnimation_updatePosition_Preview = Sprite_Animation.prototype.updatePosition;
        Sprite_Animation.prototype.updatePosition = function() {
            _EE_SpriteAnimation_updatePosition_Preview.apply(this, arguments);
            var pv = this._eePreviewViewport;
            if (!pv || !this._animation) return;
            if (Number(this._animation.position || 0) === 3) {
                this.x = Math.floor(Number(pv.w || 0) / 2);
                this.y = Math.floor(Number(pv.h || 0) / 2);
            }
        };
    }
    EE.prototype.post = function() {
        if (!this.on) return;
        var battleMode = this.isBattleEventMode();
        if (!this.play) {
            // Playback OFF must always hide/close runtime message UI immediately.
            this.clearMessageRuntimeState();
        } else {
            // Recover from any forced-hide state so messages can appear during playback.
            if (typeof this.ensureMessageRuntimeStateForPlayback === 'function') {
                this.ensureMessageRuntimeStateForPlayback();
            }
        }
        if (!this.controlMode) {
            this.ensureEditorDisplayState();
            var beforeApplyDisplayX = null;
            var beforeApplyDisplayY = null;
            if ($gameMap) {
                beforeApplyDisplayX = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
                beforeApplyDisplayY = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
                var prevRuntimeDisplayX = (this.runtimeDisplayX == null) ? null : Number(this.runtimeDisplayX);
                var prevRuntimeDisplayY = (this.runtimeDisplayY == null) ? null : Number(this.runtimeDisplayY);
                var mapDisplayX = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
                var mapDisplayY = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
                if (this.gameFramePinned) {
                    // Pinned mode: keep the frame centered by following runtime camera directly.
                    this.runtimeDisplayX = mapDisplayX;
                    this.runtimeDisplayY = mapDisplayY;
                    this.editorDisplayX = mapDisplayX;
                    this.editorDisplayY = mapDisplayY;
                } else {
                    var hasPrevRuntime = (prevRuntimeDisplayX != null && prevRuntimeDisplayY != null);
                    var shouldCaptureRuntime = !!this.play || !hasPrevRuntime;
                    if (shouldCaptureRuntime) {
                        var skipOnPlayStart = false;
                        if (this.keepRuntimeDisplayOnPlayStart &&
                            prevRuntimeDisplayX != null && prevRuntimeDisplayY != null &&
                            this.editorDisplayX != null && this.editorDisplayY != null) {
                            var ex = Number(this.editorDisplayX);
                            var ey = Number(this.editorDisplayY);
                            skipOnPlayStart =
                                Math.abs(mapDisplayX - ex) <= 1e-6 &&
                                Math.abs(mapDisplayY - ey) <= 1e-6;
                        }
                        if (!skipOnPlayStart) {
                            this.runtimeDisplayX = mapDisplayX;
                            this.runtimeDisplayY = mapDisplayY;
                        }
                    }
                }
                if (this.keepRuntimeDisplayOnPlayStart) this.keepRuntimeDisplayOnPlayStart = false;
            }
            this.applyEditorDisplayState();
            if ($gameMap && beforeApplyDisplayX != null && beforeApplyDisplayY != null) {
                var afterApplyDisplayX = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
                var afterApplyDisplayY = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
                if (Math.abs(afterApplyDisplayX - beforeApplyDisplayX) > 1e-6 ||
                    Math.abs(afterApplyDisplayY - beforeApplyDisplayY) > 1e-6) {
                    this.stepVisualRuntime();
                }
            }
        }
        if (battleMode) {
            this.applyGameViewport();
            this.updateGameFrameVisual();
            this.updateMouseCoordInfo();
            if (!this._charPanelNextRefresh || (Graphics && Graphics.frameCount >= this._charPanelNextRefresh)) {
                this.refreshCharacterPanel(false);
                this.refreshSelectedCharacterInfo(false);
                this._charPanelNextRefresh = (Graphics ? Graphics.frameCount : 0) + 6;
            }
            this.autoScrollTimelineForPlayback();
            this.updatePointer();
            this.updateAnimationPreview();
            var battleAutoTrack = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            if (battleAutoTrack && this.trackHasAutoIfBranchViewMode(battleAutoTrack)) this.timelineDirty = true;
            this.drawTimeline();
            return;
        }
        this.applyGameViewport();
        this.updateGameFrameVisual();
        this.updateMouseCoordInfo();
        if (typeof this.updateEmptyMapHoverTileMarker === 'function') this.updateEmptyMapHoverTileMarker();
        if (!this._charPanelNextRefresh || (Graphics && Graphics.frameCount >= this._charPanelNextRefresh)) {
        this.refreshCharacterPanel(false);
        this.refreshSelectedCharacterInfo(false);
        this._charPanelNextRefresh = (Graphics ? Graphics.frameCount : 0) + 6;
        }
        this.refreshCharacterOverlay(false);
        this.updateContextEventAdjustVisual();
        this.autoScrollTimelineForPlayback();
        this.updateRouteEditorMapPicker();
        this.updatePointer();
        this.updateAnimationPreview();
        var autoTrack = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (autoTrack && this.trackHasAutoIfBranchViewMode(autoTrack)) this.timelineDirty = true;
        this.drawTimeline();
    };

    var _eeBasePlayFrom_Timeline = EE.prototype.playFrom;
    EE.prototype.playFrom = function(f) {
        var wasPlaying = !!this.play;
        _eeBasePlayFrom_Timeline.call(this, this.clampFrameToSelectedTrackEnd(f));
        if (!wasPlaying && this.play) {
            this.keepRuntimeDisplayOnPlayStart = true;
            this.ensurePlaybackCursorVisibleOnStart();
        }
    };

    var _eeBaseSeek_Timeline = EE.prototype.seek;
    EE.prototype.seek = function(f) {
        _eeBaseSeek_Timeline.call(this, this.clampFrameToSelectedTrackEnd(f));
    };

    EE.prototype.pre = function() {
        if (!this.on) return;
        if (!this.play) return;
        this._eeExecAbortFrame = null;
        this._eePlaybackStoppedByAbort = false;
        var endFrame = this.selectedTrackEndFrame();
        // Allow commands on endFrame, then stop at the end marker.
        if (Math.max(0, Math.floor(Number(this.frame || 0))) > endFrame) {
            this.frame = endFrame;
            this._simFrame = endFrame;
        }
        if (this.isPlaybackBlocked()) return;
        if (!this.execAt(this.frame)) return;
        if (!this.play || this._eePlaybackStoppedByAbort) {
            this.play = false;
            this.setPlayBtn();
            this.stopEditorAudioPlayback();
            this.clearMessageRuntimeState();
            this.timelineDirty = true;
            return;
        }
        this.frame++;
        this._simFrame = this.frame;
        this.pruneSimAudioState(this.frame);
        if (this.frame > endFrame) {
            this.frame = endFrame;
            this._simFrame = endFrame;
            this.play = false;
            this.setPlayBtn();
            this.stopEditorAudioPlayback();
            this.clearMessageRuntimeState();
        }
        var cap = endFrame + this.timelineEndPaddingFrames();
        if (cap > this.maxF) this.maxF = cap;
        this.timelineDirty = true;
    };

    EE.prototype.runInitialVisualRefresh = function() {
        try {
            if (this.isBattleEventMode()) {
                this.applyGameViewport();
                this.updateGameFrameVisual();
                this.timelineDirty = true;
                return;
            }
            this.applyGameViewport();
            if ($gameMap && $gameMap.update) $gameMap.update(true);
            if ($gamePlayer && $gamePlayer.update) $gamePlayer.update(true);
            if ($gameTimer && $gameTimer.update) $gameTimer.update(true);
            if ($gameScreen && $gameScreen.update) $gameScreen.update();
            this.stepVisualRuntime();
            this.updateGameFrameVisual();
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            this.timelineDirty = true;
        } catch (_) {}
    };

    EE.prototype.normalizeMoveTarget = function(id) {
        id = Math.floor(Number(id || 0));
        if (id === -1) return -1;
        if (id > 0) return id;
        return 0;
    };

    EE.prototype.moveStepFrames = function(speed) {
        speed = Math.max(1, Math.min(6, Number(speed || 4)));
        return Math.max(1, Math.round(256 / Math.pow(2, speed)));
    };

    EE.prototype.moveRouteTimelineRaw = function(route) {
        var out = { items: [], totalFrames: 0 };
        if (!route || !route.list || !route.list.length) return out;
        var t = 0;
        var speedState = 4;
        for (var i = 0; i < route.list.length; i++) {
            var rc = route.list[i];
            if (!rc) continue;
            var code = Number(rc.code || 0);
            if (code === 0) continue;
            var step = Math.max(1, Math.floor(Number(this.routeCommandRuntimeSpanForRecalc(rc, speedState) || 1)));
            out.items.push({ command: rc, offset: t, span: step, listIndex: i });
            t += step;
            speedState = this.routeSpeedStateAfterCommandForRecalc(rc, speedState);
        }
        out.totalFrames = t;
        return out;
    };

    EE.prototype.moveRouteTimeline = function(route) {
        var raw = this.moveRouteTimelineRaw(route);
        var out = { items: [], totalFrames: 0 };
        var items = raw.items || [];
        var t = 0;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var rc = it && it.command ? it.command : null;
            var code = Number((rc && rc.code) || 0);
            if (!rc || code <= 0) continue;
            var dcode = this.routeDisplayCodeForCommand(rc);
            if (dcode === 4500) {
                var span = this.routeTileGotoCommandWaitFrames(rc);
                var next = (i + 1 < items.length) ? items[i + 1] : null;
                if (span <= 1 && next && next.command && Number(next.command.code || 0) === 15) {
                    span += Math.max(1, Math.floor(Number(next.span || 1)));
                    i++;
                }
                out.items.push({
                    command: rc,
                    offset: t,
                    span: span,
                    listIndex: Number(it.listIndex || 0),
                    displayCode: dcode
                });
                t += span;
                continue;
            }
            out.items.push({
                command: rc,
                offset: t,
                span: Math.max(1, Math.floor(Number(it.span || 1))),
                listIndex: Number(it.listIndex || 0),
                displayCode: dcode
            });
            t += Math.max(1, Math.floor(Number(it.span || 1)));
        }
        out.totalFrames = t;
        return out;
    };

    EE.prototype.moveRouteFrames = function(route) {
        var tl = this.moveRouteTimelineRaw(route);
        return Math.max(1, Number(tl.totalFrames || 0));
    };

    EE.prototype.ensureMoveRouteTerminal = function(route) {
        if (!route || typeof route !== 'object') route = {};
        if (!Array.isArray(route.list)) route.list = [];
        if (!route.list.length || Number(route.list[route.list.length - 1].code || 0) !== 0) {
            route.list.push({ code: 0, parameters: [] });
        }
        return route;
    };

    EE.prototype.moveRouteTerminalIndex = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        return Math.max(0, route.list.length - 1);
    };

    EE.prototype.moveRouteTrimTrailingWaitCommands = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        var end = this.moveRouteTerminalIndex(route);
        var removed = 0;
        while (end > 0) {
            var rc = route.list[end - 1];
            if (!rc || Number(rc.code || 0) !== 15) break;
            route.list.splice(end - 1, 1);
            end--;
            removed++;
        }
        return removed;
    };

    EE.prototype.moveRouteBaseFramesWithoutTrailingWait = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        var list = route.list;
        var end = this.moveRouteTerminalIndex(route);
        while (end > 0) {
            var rc = list[end - 1];
            if (!rc || Number(rc.code || 0) !== 15) break;
            end--;
        }
        var t = 0;
        var speedState = 4;
        for (var i = 0; i < end; i++) {
            var rc2 = list[i];
            var c = Number((rc2 && rc2.code) || 0);
            if (c <= 0) continue;
            t += this.routeCommandRuntimeSpanForRecalc(rc2, speedState);
            speedState = this.routeSpeedStateAfterCommandForRecalc(rc2, speedState);
        }
        return Math.max(1, t);
    };

    EE.prototype.moveRouteLeadingWaitFrames = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        var list = route.list;
        var t = 0;
        for (var i = 0; i < list.length; i++) {
            var rc = list[i];
            var code = Number((rc && rc.code) || 0);
            if (code === 0) break;
            if (code !== 15) break;
            t += Math.max(1, Math.floor(Number(((rc.parameters || [0])[0]) || 0)));
        }
        return Math.max(0, t);
    };

    EE.prototype.shiftMoveRouteLeftBoundary = function(cmd, deltaFrames) {
        if (!cmd || Number(cmd.code || 0) !== 205) return false;
        if (!Array.isArray(cmd.parameters)) cmd.parameters = [0, this.defaultMoveRoute()];
        var route = this.ensureMoveRouteTerminal(cmd.parameters[1]);
        cmd.parameters[1] = route;
        var list = route.list;
        var d = Math.floor(Number(deltaFrames || 0) || 0);
        if (d === 0) return true;
        if (d > 0) {
            list.splice(0, 0, { code: 15, parameters: [d] });
            return true;
        }
        var need = Math.abs(d);
        var i = 0;
        while (need > 0 && i < list.length) {
            var rc = list[i];
            var code = Number((rc && rc.code) || 0);
            if (code !== 15) break;
            var w = Math.max(1, Math.floor(Number(((rc.parameters || [0])[0]) || 0)));
            if (w <= need) {
                list.splice(i, 1);
                need -= w;
                continue;
            }
            rc.parameters = [w - need];
            list[i] = rc;
            need = 0;
            break;
        }
        return need <= 0;
    };

    EE.prototype.setMoveRouteDuration = function(cmd, targetFrames) {
        if (!cmd || Number(cmd.code || 0) !== 205) return 0;
        if (!Array.isArray(cmd.parameters)) cmd.parameters = [0, this.defaultMoveRoute()];
        var route = cmd.parameters[1];
        route = this.ensureMoveRouteTerminal(route);
        cmd.parameters[1] = route;
        var base = this.moveRouteBaseFramesWithoutTrailingWait(route);
        var target = Math.max(base, Math.floor(Number(targetFrames || 0) || 0));
        this.moveRouteTrimTrailingWaitCommands(route);
        var diff = target - base;
        if (diff > 0) {
            var end = this.moveRouteTerminalIndex(route);
            route.list.splice(end, 0, { code: 15, parameters: [diff] });
        }
        return this.moveRouteFrames(route);
    };

    EE.prototype.findCharRouteEntryAtFrame = function(tr, charId, frame) {
        if (!tr || !Array.isArray(tr.commands)) return null;
        charId = this.normalizeMoveTarget(charId);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char' || Number(e.charId || 0) !== Number(charId)) continue;
            if (!e.command || Number(e.command.code || 0) !== 205) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(1, Math.floor(Number(e.wait || 1)));
            var ed = s + w;
            if (frame >= s && frame <= ed) return e;
        }
        return null;
    };

    EE.prototype.insertRouteCommandIntoEntry = function(entry, routeCmd, frame) {
        if (!entry || !routeCmd || !entry.command || Number(entry.command.code || 0) !== 205) return -1;
        var route = entry.command.parameters && entry.command.parameters[1];
        route = this.ensureMoveRouteTerminal(route);
        entry.command.parameters[1] = route;
        var list = route.list;
        var end = this.moveRouteTerminalIndex(route);
        var tl = this.moveRouteTimeline(route);
        var offset = Math.max(0, Math.floor(Number(frame || 0)) - Math.floor(Number(entry.frame || 0)));
        var inserted = clone(routeCmd);
        for (var i = 0; i < tl.items.length; i++) {
            var it = tl.items[i];
            if (!it || !it.command) continue;
            var st = Math.max(0, Math.floor(Number(it.offset || 0)));
            var sp = Math.max(1, Math.floor(Number(it.span || 1)));
            var ed = st + sp;
            var li = Math.max(0, Math.floor(Number(it.listIndex || 0)));
            if (offset <= st) {
                list.splice(li, 0, inserted);
                return li;
            }
            if (offset > st && offset < ed && Number(it.command.code || 0) === 15) {
                var left = Math.max(0, offset - st);
                var right = Math.max(0, sp - left - 1);
                if (left > 0) {
                    it.command.parameters = [left];
                    list[li] = it.command;
                    list.splice(li + 1, 0, inserted);
                    if (right > 0) list.splice(li + 2, 0, { code: 15, parameters: [right] });
                    return li + 1;
                }
                list.splice(li, 1, inserted);
                if (right > 0) list.splice(li + 1, 0, { code: 15, parameters: [right] });
                return li;
            }
        }
        list.splice(end, 0, inserted);
        return end;
    };

    EE.prototype.commandWaitFrames = function(cmd) {
        if (!cmd) return 0;
        var code = Number(cmd.code || 0), p = cmd.parameters || [];
        if (code === 117) return this.commonEventWaitFramesById(p[0]);
        if (code === 205) {
            var route = p[1] || null;
            // Keep wait semantics consistent with isMoveRouteWaitEnabledEntry():
            // only explicit true means "wait for completion".
            var waitForCompletion = !!(route && route.wait === true);
            return waitForCompletion ? this.moveRouteFrames(route) : 0;
        }
        if (code === 230) return Math.max(0, Math.floor(Number(p[0] || 0)));
        if (code === 221 || code === 222) return 30;
        if (code === 223) return p[2] ? Math.max(0, Math.floor(Number(p[1] || 0))) : 0;
        if (code === 224) return p[2] ? Math.max(0, Math.floor(Number(p[1] || 0))) : 0;
        if (code === 225) return p[3] ? Math.max(0, Math.floor(Number(p[2] || 0))) : 0;
        if (code === 232) {
            var isV12 = Array.isArray(p) && p.length >= 12;
            var dur = isV12 ? Number(p[10] || 0) : Number(p[9] || 0);
            var wait = isV12 ? !!p[11] : !!p[10];
            return wait ? Math.max(0, Math.floor(dur || 0)) : 0;
        }
        if (code === 234) return p[3] ? Math.max(0, Math.floor(Number(p[2] || 0))) : 0;
        if (code === 236) return p[3] ? Math.max(0, Math.floor(Number(p[2] || 0))) : 0;
        if (code === 204) {
            var dist = Math.max(0, Number(p[1] || 0));
            var sp = Math.max(1, Math.min(6, Number(p[2] || 4)));
            return Math.max(0, Math.ceil(dist * 256 / Math.pow(2, sp)));
        }
        if (code === 201) return 12;
        if (code === 212) return p[2] ? 60 : 0;
        if (code === 213) return p[2] ? 60 : 0;
        if (code === 217) return 45;
        if (code === 261) return 120;
        if (code === 339) return 30;
        if (code === 103 || code === 104 || code === 105) return 60;
        return 0;
    };

    EE.prototype.commonEventMaxDepth = function() {
        return 8;
    };

    EE.prototype.normalizeCommonEventId = function(commonEventId) {
        return Math.max(0, Math.floor(Number(commonEventId || 0)));
    };

    EE.prototype.commonEventDataById = function(commonEventId) {
        var id = this.normalizeCommonEventId(commonEventId);
        if (id <= 0) return null;
        if (typeof $dataCommonEvents === 'undefined' || !$dataCommonEvents) return null;
        var ce = $dataCommonEvents[id];
        if (!ce || !Array.isArray(ce.list)) return null;
        return ce;
    };

    EE.prototype.commonEventListById = function(commonEventId) {
        var ce = this.commonEventDataById(commonEventId);
        return ce ? ce.list : null;
    };

    EE.prototype.commonEventWaitFramesById = function(commonEventId) {
        var id = this.normalizeCommonEventId(commonEventId);
        if (id <= 0) return 0;
        if (!this._eeCommonEventWaitCache || typeof this._eeCommonEventWaitCache !== 'object') {
            this._eeCommonEventWaitCache = Object.create(null);
        }
        var key = String(id);
        if (Object.prototype.hasOwnProperty.call(this._eeCommonEventWaitCache, key)) {
            return Math.max(0, Math.floor(Number(this._eeCommonEventWaitCache[key] || 0)));
        }
        var wait = this.commonEventWaitFramesByIdRecursive(id, 1, Object.create(null));
        this._eeCommonEventWaitCache[key] = Math.max(0, Math.floor(Number(wait || 0)));
        return this._eeCommonEventWaitCache[key];
    };

    EE.prototype.commonEventWaitFramesByIdRecursive = function(commonEventId, depth, stack) {
        var id = this.normalizeCommonEventId(commonEventId);
        if (id <= 0) return 0;
        depth = Math.max(1, Math.floor(Number(depth || 1)));
        var maxDepth = this.commonEventMaxDepth();
        if (depth > maxDepth) return 0;
        if (!stack || typeof stack !== 'object') stack = Object.create(null);
        var stackKey = String(id) + ':' + String(depth);
        if (stack[stackKey]) return 0;
        stack[stackKey] = true;
        var list = this.commonEventListById(id);
        var total = 0;
        if (Array.isArray(list)) {
            for (var i = 0; i < list.length; i++) {
                var cmd = list[i];
                var code = Math.floor(Number(cmd && cmd.code || 0));
                if (code <= 0) break;
                var p = Array.isArray(cmd && cmd.parameters) ? cmd.parameters : [];
                if (code === 230) {
                    total += Math.max(0, Math.floor(Number(p[0] || 0)));
                    continue;
                }
                if (code === 117 && depth < maxDepth) {
                    total += this.commonEventWaitFramesByIdRecursive(p[0], depth + 1, stack);
                }
            }
        }
        delete stack[stackKey];
        return Math.max(0, Math.floor(Number(total || 0)));
    };

    EE.prototype.makeInlineEntryForCommonEventCommand = function(baseEntry, cmd) {
        return {
            uid: Math.floor(Number(baseEntry && baseEntry.uid || 0)),
            frame: Math.max(0, Math.floor(Number((this._simToRunning ? this._simExecFrame : this.frame) || 0))),
            eventId: Math.floor(Number(baseEntry && baseEntry.eventId || this.selEid || 0)),
            pageIndex: Math.floor(Number(baseEntry && baseEntry.pageIndex || this.selPage || 0)),
            rowType: String(baseEntry && baseEntry.rowType || 'main'),
            rowKey: String(baseEntry && baseEntry.rowKey || 'main'),
            charId: (baseEntry && baseEntry.charId != null) ? Number(baseEntry.charId) : null,
            command: clone(cmd || { code: 0, indent: 0, parameters: [] }),
            wait: 0
        };
    };

    EE.prototype.stopPlaybackForCommonEventDepthError = function(commonEventId, frame) {
        commonEventId = this.normalizeCommonEventId(commonEventId);
        frame = Math.max(0, Math.floor(Number(frame || this.frame || 0)));
        this._eeExecAbortFrame = frame;
        this.play = false;
        if (typeof this.stopEditorAudioPlayback === 'function') this.stopEditorAudioPlayback();
        if (typeof this.stopTimelineAutoScrollAnimation === 'function') this.stopTimelineAutoScrollAnimation();
        if (typeof this.clearMessageRuntimeState === 'function') this.clearMessageRuntimeState();
        if (typeof this.setPlayBtn === 'function') this.setPlayBtn();
        this.timelineDirty = true;
        this.err('E_COMMON_EVENT_DEPTH', new Error('common event recursion depth exceeded (>8): ' + String(commonEventId)));
    };

    EE.prototype.executionAbortTrackKey = function(entry) {
        if (!entry) return '';
        var eid = Math.max(0, Math.floor(Number(entry.eventId == null ? this.selEid : entry.eventId)));
        var pg = Math.max(-1, Math.floor(Number(entry.pageIndex == null ? this.selPage : entry.pageIndex)));
        if (eid <= 0 || pg < 0) return '';
        return String(eid) + ':' + String(pg);
    };

    EE.prototype.clearExecutionAbortTrackMap = function() {
        this._eeExecAbortTrackFrameByKey = Object.create(null);
    };

    EE.prototype.markExecutionAbortForTrack = function(entry, frame) {
        var key = this.executionAbortTrackKey(entry);
        if (!key) return;
        if (!this._eeExecAbortTrackFrameByKey) this._eeExecAbortTrackFrameByKey = Object.create(null);
        var f = Math.max(0, Math.floor(Number(frame || 0)));
        var cur = this._eeExecAbortTrackFrameByKey[key];
        if (cur == null || !isFinite(Number(cur)) || f < Number(cur)) this._eeExecAbortTrackFrameByKey[key] = f;
    };

    EE.prototype.isExecutionAbortedForTrackAtFrame = function(entry, frame) {
        var key = this.executionAbortTrackKey(entry);
        if (!key || !this._eeExecAbortTrackFrameByKey) return false;
        var af = this._eeExecAbortTrackFrameByKey[key];
        if (!isFinite(Number(af))) return false;
        return Math.max(0, Math.floor(Number(frame || 0))) >= Math.max(0, Math.floor(Number(af || 0)));
    };

    EE.prototype.execCommonEventInline = function(commonEventId, sourceEntry) {
        var id = this.normalizeCommonEventId(commonEventId);
        if (id <= 0) return true;
        var list = this.commonEventListById(id);
        if (!list) {
            this.err('E_COMMON_EVENT_INVALID', new Error('common event not found: ' + String(id)));
            return true;
        }
        var af = this._simToRunning ? this._simExecFrame : this.frame;
        af = Math.max(0, Math.floor(Number(af || 0)));
        var maxDepth = this.commonEventMaxDepth();
        var depth = Math.max(0, Math.floor(Number(this._eeCommonEventExecDepth || 0)));
        if (depth >= maxDepth) {
            this.stopPlaybackForCommonEventDepthError(id, af);
            return false;
        }
        var prevInline = !!this._eeInlineCommandExecution;
        this._eeCommonEventExecDepth = depth + 1;
        this._eeInlineCommandExecution = true;
        try {
            for (var i = 0; i < list.length; i++) {
                var cmd = list[i];
                var code = Math.floor(Number(cmd && cmd.code || 0));
                if (code <= 0) break;
                this.execEntry(this.makeInlineEntryForCommonEventCommand(sourceEntry, cmd));
                if (Math.floor(Number(this._eeExecAbortFrame || -1)) === af) return false;
            }
        } finally {
            this._eeInlineCommandExecution = prevInline;
            this._eeCommonEventExecDepth = depth;
        }
        return true;
    };

    EE.prototype.entryFromCommand = function(cmd, eid, page, frame, uid) {
        if (!cmd || cmd.code === 0) return null;
        if (cmd.code === 230) return null;
        var battleMode = this.isBattleEventMode();
        var e = {
            uid: uid || this.model.nextUid++,
            frame: Math.max(0, Math.floor(Number(frame || 0))),
            eventId: eid,
            pageIndex: page,
            command: clone(cmd),
            wait: 0,
            rowType: 'main',
            rowKey: 'main',
            charId: null,
            isComment: false,
            commentLines: null,
            isMemo: false,
            memoSize: 'S',
            memoText: '',
            isMessage: false,
            messageLines: null,
            messageExt: null,
            isScrollMessage: false,
            scrollLines: null,
            isScript: false,
            scriptLines: null
        };
        if (e.command.code === 108) {
            e.isComment = true;
            e.commentLines = [String((e.command.parameters || [''])[0] || '')];
            this.memoApplyParsedStateToEntry(e);
            if (e.isMemo) {
                e.commentLines = [this.memoCommentLine(e.memoSize, e.memoText)];
                e.command.parameters = [e.commentLines[0]];
            }
            e.wait = 0;
        } else if (e.command.code === 101) {
            e.wait = 0;
            e.isMessage = true;
            e.messageLines = [];
        } else if (e.command.code === 355) {
            e.wait = 0;
            e.isScript = true;
            e.scriptLines = [String((e.command.parameters || [''])[0] || '')];
        } else if (e.command.code === 105) {
            e.wait = 0;
            e.isScrollMessage = true;
            e.scrollLines = [];
        } else if (e.command.code === 205) {
            if (battleMode) {
                e.rowType = 'main';
                e.rowKey = 'main';
                e.charId = null;
            } else {
                e.rowType = 'char';
                e.charId = this.normalizeMoveTarget(Number((e.command.parameters || [0])[0] || 0));
                e.rowKey = 'char:' + e.charId;
                e.command.parameters[0] = e.charId;
            }
            // During initial track parse, runtime character positions are not yet
            // aligned to each command frame. Skip eager auto-wait calc here and
            // normalize later via simulation pass.
            if (!this._eeTrackParseMode) this.recalculateRouteTileGotoWaitMetaForEntry(e);
            e.wait = this.commandWaitFrames(e.command);
        } else {
            e.wait = this.commandWaitFrames(e.command);
        }
        return e;
    };

    EE.prototype.timelineEndPaddingFrames = function() {
        var n = Math.floor(Number(this.endMarkerPadFrames == null ? 40 : this.endMarkerPadFrames));
        return Math.max(8, n);
    };

    EE.prototype.trackComputedEndFrame = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return 0;
        var m = 0;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            var end = s + w;
            if (end > m) m = end;
        }
        return m;
    };

    EE.prototype.normalizeTrackEndFrame = function(tr) {
        if (!tr) return 0;
        var computed = this.trackComputedEndFrame(tr);
        var stored = Number(tr.endFrame);
        if (!isFinite(stored)) stored = computed;
        stored = Math.max(0, Math.floor(stored));
        // End marker should never be before the actual last command end.
        var normalized = Math.max(computed, stored);
        if (Number(tr.endFrame) !== normalized) tr.endFrame = normalized;
        return normalized;
    };

    EE.prototype.selectedTrackEndFrame = function() {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return 0;
        return this.normalizeTrackEndFrame(tr);
    };

    EE.prototype.clampFrameToSelectedTrackEnd = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return frame;
        var endFrame = this.normalizeTrackEndFrame(tr);
        return Math.max(0, Math.min(frame, endFrame));
    };

    EE.prototype.ensureTrack = function(eid, page) {
        var k = this.key(eid, page);
        var battleMode = this.isBattleEventMode();
        if (this.model.tracks[k] && this.model.tracks[k]._eeV2) {
            if (!Array.isArray(this.model.tracks[k].extraCharRows)) this.model.tracks[k].extraCharRows = [];
            if (!Array.isArray(this.model.tracks[k].tempCharRows)) this.model.tracks[k].tempCharRows = [];
            if (!this.model.tracks[k]._eeIfBranchViewModes) this.loadIfBranchViewModesForTrack(this.model.tracks[k]);
            if (battleMode && typeof this.normalizeTrackRowsForCurrentMode === 'function') {
                this.normalizeTrackRowsForCurrentMode(this.model.tracks[k]);
            }
            this.normalizeTrackEndFrame(this.model.tracks[k]);
            return this.model.tracks[k];
        }
        var tr = { eventId: eid, pageIndex: page, commands: [], extraCharRows: [], tempCharRows: [], endFrame: 0, _eeV2: true };
        var list = (typeof this.trackPageSourceList === 'function')
            ? this.trackPageSourceList(eid, page)
            : (((($dataMap.events[eid] || {}).pages || [])[page] || {}).list) || [];
        var f = 0;
        this._eeTrackParseMode = true;
        try {
            for (var i = 0; i < list.length; i++) {
                var cmd = list[i];
                if (!cmd || cmd.code === 0) continue;
                if (cmd.code === 230) {
                    f += Math.max(0, Math.floor(Number((cmd.parameters || [0])[0] || 0)));
                    continue;
                }
                if (cmd.code === 408 || cmd.code === 505) continue;
                if (cmd.code === 108) {
                    var commentHead = String((cmd.parameters || [''])[0] || '');
                    if (typeof this.eventSettingsDecodeScriptConditionComment === 'function' &&
                        this.eventSettingsDecodeScriptConditionComment(commentHead) != null) {
                        while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 408) i++;
                        continue;
                    }
                    var ce = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                    ce.commentLines = [String((cmd.parameters || [''])[0] || '')];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 408) {
                        i++;
                        ce.commentLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    this.memoApplyParsedStateToEntry(ce);
                    if (ce.isMemo) ce.commentLines = [this.memoCommentLine(ce.memoSize, ce.memoText)];
                    ce.command.parameters = [ce.commentLines[0] || ''];
                    tr.commands.push(ce);
                    continue;
                }
                if (cmd.code === 101) {
                    var me = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
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
                    var se = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
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
                    // Fallback: preserve malformed standalone 655 as a 355 single-line script.
                    var scmd = {
                        code: 355,
                        indent: Number(cmd.indent || 0),
                        parameters: [String((cmd.parameters || [''])[0] || '')]
                    };
                    var sfe = this.entryFromCommand(scmd, eid, page, f, this.model.nextUid++);
                    sfe.isScript = true;
                    sfe.scriptLines = [String((scmd.parameters || [''])[0] || '')];
                    tr.commands.push(sfe);
                    continue;
                }
                if (cmd.code === 105) {
                    var sce = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                    sce.isScrollMessage = true;
                    sce.scrollLines = [];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 405) {
                        i++;
                        sce.scrollLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    tr.commands.push(sce);
                    continue;
                }
                if (cmd.code === 405) continue;
                if (cmd.code === 401) continue;
                var e = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                if (!e) continue;
                tr.commands.push(e);
                f += Math.max(0, Math.floor(e.wait || 0));
            }
        } finally {
            this._eeTrackParseMode = false;
        }
        // Keep trailing wait (if any) as explicit timeline end marker frame.
        tr.endFrame = Math.max(0, Math.floor(Number(f || 0)));
        if (battleMode && typeof this.normalizeTrackRowsForCurrentMode === 'function') {
            this.normalizeTrackRowsForCurrentMode(tr);
        }
        this.normalizeTrackEndFrame(tr);
        this.mergeMessageSettingsIntoShowTextEntries(tr);
        // Register track before tile-goto wait normalization so simulation
        // can replay this newly parsed track and read true execution position.
        this.model.tracks[k] = tr;
        var deferStartupNormalize = (this._eeReadTracePhase === 'startup');
        if (!deferStartupNormalize) {
            this.rebuildSchedule({ skipRouteNormalize: true });
            this.normalizeTrackRouteTileGotoWaitMeta(tr);
        }
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.loadIfBranchViewModesForTrack(tr);
        if (this._eeReadTracePhase === 'startup' && typeof this.printReadTraceForTrack === 'function') {
            try {
                this.printReadTraceForTrack(k, eid, page, list, tr, 'startup');
            } catch (_) {}
        }
        return tr;
    };

    EE.prototype.collectStartupTrackTargets = function() {
        if (this.isBattleEventMode()) {
            var outBattle = [];
            var seenBattle = Object.create(null);
            var tid = this.currentBattleTroopId();
            var troop = this.currentBattleTroopData();
            var pages = troop && Array.isArray(troop.pages) ? troop.pages : [];
            for (var bi = 0; bi < pages.length; bi++) {
                var bk = this.key(tid, bi);
                if (seenBattle[bk]) continue;
                seenBattle[bk] = true;
                outBattle.push({ eventId: tid, pageIndex: bi });
            }
            return outBattle;
        }
        var out = [];
        var seen = Object.create(null);
        var events = ($gameMap && typeof $gameMap.events === 'function') ? $gameMap.events() : [];
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (!ev) continue;
            var eid = (typeof ev.eventId === 'function') ? Number(ev.eventId() || 0) : Number(ev._eventId || 0);
            var page = Math.floor(Number(ev._pageIndex == null ? -1 : ev._pageIndex));
            if (eid <= 0 || page < 0) continue;
            var key = this.key(eid, page);
            if (seen[key]) continue;
            seen[key] = true;
            out.push({ eventId: eid, pageIndex: page });
        }
        if (this.selEid > 0 && this.selPage >= 0) {
            var selectedKey = this.key(this.selEid, this.selPage);
            if (!seen[selectedKey]) {
                seen[selectedKey] = true;
                out.push({ eventId: Number(this.selEid), pageIndex: Number(this.selPage) });
            }
        }
        return out;
    };

    EE.prototype.shouldPreloadAllStartupTracks = function() {
        try {
            return !!(window._debug && typeof _debug.get === 'function' && _debug.get('eventEditorStartupPreloadAllTracks') === true);
        } catch (_) {
            return false;
        }
    };

    EE.prototype.ensureStartupTracksLoaded = function() {
        var targets = this.collectStartupTrackTargets();
        for (var i = 0; i < targets.length; i++) {
            var t = targets[i];
            if (!t) continue;
            this.ensureTrack(Math.floor(Number(t.eventId || 0)), Math.floor(Number(t.pageIndex || 0)));
        }
    };

    EE.prototype.normalizeLoadedTracksRouteWaitMetaOnce = function() {
        if (this.isBattleEventMode()) return;
        if (!this.model || !this.model.tracks) return;
        var keys = Object.keys(this.model.tracks);
        if (!keys.length) return;
        this.rebuildSchedule({ skipRouteNormalize: true });
        for (var i = 0; i < keys.length; i++) {
            var tr = this.model.tracks[keys[i]];
            if (!tr || !Array.isArray(tr.commands)) continue;
            this.normalizeTrackRouteTileGotoWaitMeta(tr);
            tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        }
    };

    EE.prototype.normalizeRouteWaitMetaAfterStartupLoad = function() {
        if (this.isBattleEventMode()) {
            this._eeStartupTrackNormalizeDone = true;
            return;
        }
        if (this._eeReadTracePhase !== 'startup') return;
        if (this._eeStartupTrackNormalizeDone) return;
        if (this.shouldPreloadAllStartupTracks()) this.ensureStartupTracksLoaded();
        this.normalizeLoadedTracksRouteWaitMetaOnce();
        this._eeStartupTrackNormalizeDone = true;
    };

    EE.prototype.executionTrackKey = function() {
        var scoped = (this._eeExecTrackKey == null) ? '' : String(this._eeExecTrackKey || '');
        if (scoped.length > 0) return scoped;
        if (this.selEid > 0 && this.selPage >= 0 && this.selKey) return String(this.selKey);
        return '';
    };

    EE.prototype.isEntryInExecutionTrack = function(entry, trackKey) {
        if (!entry) return false;
        var key = String(trackKey || '');
        if (!key.length) return false;
        var entryKey = this.key(
            Math.floor(Number(entry.eventId || 0)),
            Math.floor(Number(entry.pageIndex || 0))
        );
        return entryKey === key;
    };

    EE.prototype.executionEntriesAtFrame = function(frame, trackKey) {
        var ls = this.sortedEntriesAtFrame(frame);
        if (!ls.length) return [];
        var key = String(trackKey || this.executionTrackKey() || '');
        if (!key.length) return [];
        var out = [];
        for (var i = 0; i < ls.length; i++) {
            var e = ls[i];
            if (this.isEntryInExecutionTrack(e, key)) out.push(e);
        }
        return out;
    };

    EE.prototype.execAt = function(f, opt) {
        opt = opt || {};
        var forceComplete = !!opt.forceComplete;
        var sf = Math.max(0, Math.floor(Number(f || 0)));
        this.prepareIfBranchRuntimeStateForFrame(sf);
        var trackKey = this.executionTrackKey();
        var ls = this.executionEntriesAtFrame(sf, trackKey);
        if (!ls.length) {
            if (!forceComplete && this._frameExecState && this._frameExecState.frame === sf) {
                this._frameExecState = null;
            }
            return true;
        }

        if (forceComplete) {
            for (var fi = 0; fi < ls.length; fi++) {
                var fe = ls[fi];
                if (!this.shouldExecuteEntryByIfBranchRuntime(fe)) continue;
                this.execEntry(fe);
                if (this.isPlaybackBlocked()) this.clearMessageRuntimeState();
            }
            return true;
        }

        var st = this._frameExecState;
        if (!st || st.frame !== sf || st.rev !== this._scheduleRev || st.trackKey !== trackKey) {
            st = {
                frame: sf,
                index: 0,
                list: ls,
                rev: this._scheduleRev,
                trackKey: trackKey
            };
            this._frameExecState = st;
        }

        while (st.index < st.list.length) {
            if (this.isPlaybackBlocked()) return false;
            var e = st.list[st.index];
            st.index++;
            if (!this.shouldExecuteEntryByIfBranchRuntime(e)) continue;
            this.execEntry(e);
            if (this.isPlaybackBlocked()) return false;
        }

        this._frameExecState = null;
        return true;
    };

    EE.prototype.execEntry = function(e) {
        if (!e || !e.command) return;
        var c = e.command, code = c.code, p = clone(c.parameters || []);
        var af = this._simToRunning ? this._simExecFrame : this.frame;
        af = Math.max(0, Math.floor(Number(af || 0)));
        var abortFrame = Math.floor(Number(this._eeExecAbortFrame == null ? -1 : this._eeExecAbortFrame));
        if (abortFrame === af) return;
        if (abortFrame >= 0 && abortFrame !== af) this._eeExecAbortFrame = null;
        if (this.isExecutionAbortedForTrackAtFrame(e, af)) return;
        if (!this._simToRunning && !this._eeInlineCommandExecution) {
            this.appendExecutionLog(code, af, e);
            this.triggerExecutionPulse(Number(e.uid || 0), -1);
            if (code === 205) this.triggerRouteExecutionPulses(e);
        }
        if (code === 115) {
            this.markExecutionAbortForTrack(e, af);
            this._eeExecAbortFrame = af;
            if (!this._simToRunning && this.isEditorPlaybackActive && this.isEditorPlaybackActive()) {
                this.play = false;
                this._eePlaybackStoppedByAbort = true;
            }
        }
        if (code === 117) {
            this.execCommonEventInline(p[0], e);
            return;
        }
        if (code === 230) return;
        if (this.shouldSkipTransferCommandInEditorPlayback(code)) return;
        if (this.handleAudioCommand(code, p, af)) return;
        if (code === 356) installEscapeConvertFallback();
        var it = new Game_Interpreter();
        it._mapId = $gameMap.mapId();
        it._eventId = e.eventId || 0;
        it._params = p;
        var lst = [];
        if (code === 101) {
            var pre = this.messageExtCommandsFromEntry(e);
            for (var pi = 0; pi < pre.length; pi++) {
                var pc = pre[pi];
                if (pc && Number(pc.code || 0) === 356) installEscapeConvertFallback();
                lst.push(clone(pc));
            }
            lst.push({ code: code, indent: Number(c.indent || 0), parameters: p });
        } else {
            lst.push({ code: code, indent: Number(c.indent || 0), parameters: p });
        }
        if (code === 101 && e.messageLines && e.messageLines.length) {
            for (var i = 0; i < e.messageLines.length; i++) {
                lst.push({ code: 401, indent: Number(c.indent || 0), parameters: [String(e.messageLines[i] || '')] });
            }
        } else if (code === 355) {
            var slines = (e.scriptLines && e.scriptLines.length)
                ? e.scriptLines
                : [String((c.parameters || [''])[0] || '')];
            lst[0].parameters = [String(slines[0] || '')];
            for (var si = 1; si < slines.length; si++) {
                lst.push({ code: 655, indent: Number(c.indent || 0), parameters: [String(slines[si] || '')] });
            }
        } else if (code === 105) {
            var tlines = (e.scrollLines && e.scrollLines.length)
                ? e.scrollLines
                : [];
            for (var ti = 0; ti < tlines.length; ti++) {
                lst.push({ code: 405, indent: Number(c.indent || 0), parameters: [String(tlines[ti] || '')] });
            }
        }
        lst.push({ code: 0, indent: 0, parameters: [] });
        it._list = lst;
        it._index = 0;
        try {
            // Execute sequentially until a command requests wait (returns false)
            // or the temporary list is consumed.
            while (it._list && it._index < it._list.length) {
                if (!it.executeCommand()) break;
            }
        } catch (er) {
            if (code === 356) {
                this.fatal('E_EXEC_356', er);
                return;
            }
            this.err('E_EXEC_' + code, er);
        }
    };

    EE.prototype.isEditorPlaybackActive = function() {
        return !!this.play;
    };

    EE.prototype.shouldSkipTransferCommandInEditorPlayback = function(code) {
        return Math.floor(Number(code || 0)) === 201 && this.isEditorPlaybackActive();
    };

    EE.prototype.renderExecutionLog = function(forceScrollBottom) {
        if (!this.execLogView) return;
        var self = this;
        var loc = (typeof this.localizeEditorDisplayText === 'function')
            ? function(v) { return self.localizeEditorDisplayText(v); }
            : function(v) { return String(v == null ? '' : v); };
        var lines = Array.isArray(this.execLogLines) ? this.execLogLines : [];
        this.execLogView.innerHTML = '';
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            var txt = (ln && typeof ln === 'object') ? loc(ln.text || '') : loc(ln || '');
            var row = this.el('div', 'elog-item', '');
            if (ln && typeof ln === 'object' && (ln.nameText != null || ln.detailText != null)) {
                var mainParts = (ln.mainParts && Array.isArray(ln.mainParts)) ? ln.mainParts : null;
                if (mainParts && mainParts.length) {
                    for (var mp = 0; mp < mainParts.length; mp++) {
                        var part = mainParts[mp];
                        if (!part || part.text == null) continue;
                        var partSpan = this.el('span', 'elog-main', loc(part.text));
                        if (part.color) partSpan.style.color = String(part.color);
                        row.appendChild(partSpan);
                    }
                } else {
                    var mainSpan = this.el('span', 'elog-main', loc(ln.nameText == null ? '' : ln.nameText));
                    if (ln.mainColor) mainSpan.style.color = String(ln.mainColor);
                    if (ln.mainBold) mainSpan.style.fontWeight = '700';
                    row.appendChild(mainSpan);
                }
                var dText = loc(ln.detailText == null ? '' : ln.detailText).trim();
                if (dText.length) {
                    var detailSpan = this.el('span', 'elog-detail', ' : ' + dText);
                    if (ln.detailColor) detailSpan.style.color = String(ln.detailColor);
                    row.appendChild(detailSpan);
                }
            } else {
                row.textContent = txt;
            }
            var indentLevel = (ln && typeof ln === 'object')
                ? Math.max(0, Math.floor(Number(ln.indentLevel || 0)))
                : 0;
            if (indentLevel > 0) row.style.paddingLeft = Math.max(2, 2 + indentLevel * 12) + 'px';
            var uid = (ln && typeof ln === 'object') ? Math.floor(Number(ln.uid || 0)) : 0;
            var rli = (ln && typeof ln === 'object') ? this.nodeRouteIndex(ln.routeListIndex) : -1;
            var logAction = (ln && typeof ln === 'object') ? String(ln.logAction || '') : '';
            var playbackLogClickable = (logAction === 'playback-start' || logAction === 'playback-stop');
            if (uid > 0 || playbackLogClickable) {
                row.classList.add('hit');
                (function(uu, rr, action, frame) {
                    row.addEventListener('mouseenter', function() {
                        if (uu > 0) self.triggerExecutionPulse(uu, rr);
                    });
                    row.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (action === 'playback-start' || action === 'playback-stop') {
                            self.focusPlaybackStateLogTarget(action, frame);
                        } else {
                            self.focusExecutionLogTarget(uu, rr);
                        }
                    });
                })(uid, rli, logAction, (ln && typeof ln === 'object') ? ln.frame : null);
            }
            this.execLogView.appendChild(row);
        }
        if (forceScrollBottom) {
            this.execLogView.scrollTop = this.execLogView.scrollHeight;
        }
    };

    EE.prototype.stopTimelineAutoScrollAnimation = function() {
        var st = this._timelineAutoScrollAnim;
        if (!st) return;
        if (st.rafId != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(st.rafId);
        }
        this._timelineAutoScrollAnim = null;
    };

    EE.prototype.animateTimelineScrollTo = function(targetLeft, targetTop, durationMs) {
        if (!this.timelineWrap) return;
        var wrap = this.timelineWrap;
        var maxLeft = Math.max(0, Math.floor(Number(wrap.scrollWidth || 0) - Number(wrap.clientWidth || 0)));
        var maxTop = Math.max(0, Math.floor(Number(wrap.scrollHeight || 0) - Number(wrap.clientHeight || 0)));
        var tLeft = Math.max(0, Math.min(maxLeft, Math.floor(Number(targetLeft || 0))));
        var tTop = Math.max(0, Math.min(maxTop, Math.floor(Number(targetTop || 0))));
        var sLeft = Math.max(0, Math.floor(Number(wrap.scrollLeft || 0)));
        var sTop = Math.max(0, Math.floor(Number(wrap.scrollTop || 0)));
        var dx = tLeft - sLeft;
        var dy = tTop - sTop;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        this.stopTimelineAutoScrollAnimation();
        if (typeof requestAnimationFrame !== 'function') {
            wrap.scrollLeft = tLeft;
            wrap.scrollTop = tTop;
            this.timelineDirty = true;
            return;
        }
        var self = this;
        var st = {
            start: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
            duration: Math.max(80, Math.floor(Number(durationMs || 180))),
            startLeft: sLeft,
            startTop: sTop,
            targetLeft: tLeft,
            targetTop: tTop,
            rafId: null
        };
        var step = function(now) {
            if (!self._timelineAutoScrollAnim || self._timelineAutoScrollAnim !== st) return;
            var t = Math.min(1, Math.max(0, (Number(now || 0) - st.start) / Math.max(1, st.duration)));
            var eased = 1 - Math.pow(1 - t, 3);
            wrap.scrollLeft = Math.round(st.startLeft + (st.targetLeft - st.startLeft) * eased);
            wrap.scrollTop = Math.round(st.startTop + (st.targetTop - st.startTop) * eased);
            self.timelineDirty = true;
            if (t < 1) {
                st.rafId = requestAnimationFrame(step);
            } else {
                self._timelineAutoScrollAnim = null;
            }
        };
        this._timelineAutoScrollAnim = st;
        st.rafId = requestAnimationFrame(step);
    };

    EE.prototype.autoScrollTimelineForPlayback = function() {
        if (!this.play || !this.timelineWrap) return;
        var wrap = this.timelineWrap;
        var viewW = Math.max(1, Math.floor(Number(wrap.clientWidth || 0)));
        var labelW = Math.max(0, Math.floor(Number(this.labelW || 0)));
        if (viewW <= labelW + 16) return;
        if ((Number(wrap.scrollWidth || 0) - viewW) <= 1) return;
        var margin = 18;
        var cursorX = this.frameToX(Math.max(0, Math.floor(Number(this.frame || 0))));
        var rightEdge = Number(wrap.scrollLeft || 0) + viewW - margin;
        if (cursorX <= rightEdge) return;
        if (this._timelineAutoScrollAnim) return;
        var pageSpan = Math.max(24, viewW - labelW - 16);
        var targetLeft = Math.floor(Number(wrap.scrollLeft || 0) + pageSpan);
        var minLeftForCursor = Math.floor(cursorX - (viewW - margin - 1));
        if (targetLeft < minLeftForCursor) targetLeft = minLeftForCursor;
        this.animateTimelineScrollTo(targetLeft, Number(wrap.scrollTop || 0), 120);
    };

    EE.prototype.ensurePlaybackCursorVisibleOnStart = function() {
        if (!this.timelineWrap) return;
        var wrap = this.timelineWrap;
        var viewW = Math.max(1, Math.floor(Number(wrap.clientWidth || 0)));
        var labelW = Math.max(0, Math.floor(Number(this.labelW || 0)));
        if (viewW <= labelW + 16) return;
        if ((Number(wrap.scrollWidth || 0) - viewW) <= 1) return;
        var margin = 18;
        var cursorX = this.frameToX(Math.max(0, Math.floor(Number(this.frame || 0))));
        var leftEdge = Number(wrap.scrollLeft || 0) + labelW + margin;
        var rightEdge = Number(wrap.scrollLeft || 0) + viewW - margin;
        if (cursorX >= leftEdge && cursorX <= rightEdge) return;
        var targetLeft = Number(wrap.scrollLeft || 0);
        if (cursorX < leftEdge) {
            targetLeft = Math.floor(cursorX - labelW - margin);
        } else if (cursorX > rightEdge) {
            targetLeft = Math.floor(cursorX - (viewW - margin - 1));
        }
        this.animateTimelineScrollTo(targetLeft, Number(wrap.scrollTop || 0), 170);
    };

    EE.prototype.isTimelinePointVisible = function(x, y, margin) {
        if (!this.timelineWrap) return true;
        margin = Math.max(0, Math.floor(Number(margin == null ? 18 : margin)));
        var wrap = this.timelineWrap;
        var left = Math.max(0, Number(wrap.scrollLeft || 0) + Number(this.labelW || 0) + margin);
        var right = Math.max(left, Number(wrap.scrollLeft || 0) + Number(wrap.clientWidth || 0) - margin);
        var top = Math.max(0, Number(wrap.scrollTop || 0) + margin);
        var bottom = Math.max(top, Number(wrap.scrollTop || 0) + Number(wrap.clientHeight || 0) - margin);
        return Number(x || 0) >= left && Number(x || 0) <= right && Number(y || 0) >= top && Number(y || 0) <= bottom;
    };

    EE.prototype.findExecutionNodePosition = function(uid, routeListIndex) {
        uid = Math.floor(Number(uid || 0));
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (uid <= 0) return null;
        this.drawTimeline();
        var hits = Array.isArray(this.hitNodes) ? this.hitNodes : [];
        var i, n;
        for (i = hits.length - 1; i >= 0; i--) {
            n = hits[i];
            if (!n) continue;
            if (Math.floor(Number(n.uid || 0)) !== uid) continue;
            if (routeListIndex >= 0 && this.nodeRouteIndex(n.routeListIndex) !== routeListIndex) continue;
            if (routeListIndex < 0 && this.nodeRouteIndex(n.routeListIndex) >= 0) continue;
            return {
                uid: uid,
                routeListIndex: this.nodeRouteIndex(n.routeListIndex),
                frame: Math.max(0, Math.floor(Number(n.frame || 0))),
                x: Number(n.x || 0),
                y: Number(n.y || 0)
            };
        }
        var e = this.findEntryInSelectedTrack(uid);
        if (!e) return null;
        var frame = Math.max(0, Math.floor(Number(e.frame || 0)));
        var resolvedRouteIndex = routeListIndex;
        if (routeListIndex >= 0 && e.command && Number(e.command.code || 0) === 205) {
            var route = e.command.parameters && e.command.parameters[1];
            var tl = this.moveRouteTimeline(route);
            var items = tl && Array.isArray(tl.items) ? tl.items : [];
            var matched = false;
            for (i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it) continue;
                if (this.nodeRouteIndex(it.listIndex) !== routeListIndex) continue;
                frame = Math.max(0, Math.floor(Number(e.frame || 0)) + Math.max(0, Math.floor(Number(it.offset || 0))));
                matched = true;
                break;
            }
            if (!matched) resolvedRouteIndex = -1;
        } else {
            resolvedRouteIndex = -1;
        }
        var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
        var ri = this.rowIndexByKey(rk);
        var met = (ri >= 0 && this._rowMetrics && this._rowMetrics[ri]) ? this._rowMetrics[ri] : null;
        var y = met ? Number(met.center || 0) : (this.rulerH + Math.floor(this.rowH / 2));
        if (rk === 'main' && met) {
            var lane = (this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(uid)) ? Number(this._mainLaneByUid[uid] || 0) : 0;
            y = Number(met.top || this.rulerH) + this.mainLaneTop + lane * this.mainLaneGap;
        }
        return {
            uid: uid,
            routeListIndex: resolvedRouteIndex,
            frame: frame,
            x: this.frameToX(frame),
            y: y
        };
    };

    EE.prototype.ensureTimelineNodeVisible = function(pos) {
        if (!pos || !this.timelineWrap) return;
        if (this.isTimelinePointVisible(pos.x, pos.y, 18)) return;
        var wrap = this.timelineWrap;
        var viewW = Math.max(1, Number(wrap.clientWidth || 1));
        var viewH = Math.max(1, Number(wrap.clientHeight || 1));
        var targetLeft = Number(pos.x || 0) - (viewW * 0.5 + Number(this.labelW || 0) * 0.5);
        var targetTop = Number(pos.y || 0) - viewH * 0.5;
        this.animateTimelineScrollTo(targetLeft, targetTop, 170);
    };

    EE.prototype.focusExecutionLogTarget = function(uid, routeListIndex) {
        uid = Math.floor(Number(uid || 0));
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (uid <= 0) return;
        var pos = this.findExecutionNodePosition(uid, routeListIndex);
        if (!pos) return;
        if (this.hasRangeSelection()) this.clearRangeSelection();
        this.selUid = uid;
        this.selRouteListIndex = (pos.routeListIndex >= 0) ? pos.routeListIndex : -1;
        this.frame = Math.max(0, Math.floor(Number(pos.frame || 0)));
        this.setHoverNode({ uid: uid, routeListIndex: this.selRouteListIndex });
        this.triggerExecutionPulse(uid, this.selRouteListIndex);
        this.seek(this.frame);
        this.ensureTimelineNodeVisible(pos);
        this.timelineDirty = true;
    };

    EE.prototype.focusPlaybackStateLogTarget = function(action, frame) {
        action = String(action || '');
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        if (action === 'playback-start') {
            this.playFrom(frame);
            this.timelineDirty = true;
            return;
        }
        if (action === 'playback-stop') {
            var wasPlaying = !!this.play;
            if (wasPlaying) {
                this.play = false;
                if (typeof this.clearMessageRuntimeState === 'function') this.clearMessageRuntimeState();
                if (typeof this.stopEditorAudioPlayback === 'function') this.stopEditorAudioPlayback();
                if (typeof this.stopTimelineAutoScrollAnimation === 'function') this.stopTimelineAutoScrollAnimation();
                if (typeof this.setPlayBtn === 'function') this.setPlayBtn();
            }
            this.seek(frame);
            this.timelineDirty = true;
        }
    };

    EE.prototype.executionEventLabelForEntry = function(entry) {
        var eid = Math.floor(Number(entry && entry.eventId || 0));
        var nm = '(no name)';
        try {
            var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
            if (ev && ev.name) nm = String(ev.name);
        } catch (_) {}
        return '[Event ' + eid + ':' + nm + ']';
    };

    EE.prototype.executionMoveRouteTargetLabelForEntry = function(entry) {
        var targetId = 0;
        if (entry && entry.command && Number(entry.command.code || 0) === 205) {
            var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
            var fromEntry = (entry.charId == null) ? Number(p[0] || 0) : Number(entry.charId || 0);
            targetId = this.normalizeMoveTarget(fromEntry);
        }
        if (targetId === 0 && entry && Number(entry.eventId || 0) > 0) {
            targetId = Number(entry.eventId || 0);
        }
        if (targetId === -1) return '[Player]';
        if (targetId === 0) return '[This Event]';
        var nm = '(no name)';
        try {
            var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[targetId] : null;
            if (ev && ev.name) nm = String(ev.name);
        } catch (_) {}
        return '[Event ' + targetId + ':' + nm + ']';
    };

    EE.prototype.executionLogText = function(base, name, detail) {
        var t = String(base || '') + String(name || '');
        detail = String(detail == null ? '' : detail).replace(/\r?\n/g, ' / ').trim();
        if (detail.length) t += ' : ' + detail;
        t = t.replace(/\s+/g, ' ').trim();
        var maxLen = 180;
        if (t.length > maxLen) t = t.slice(0, maxLen - 3) + '...';
        return t;
    };

    EE.prototype.executionLogTextParts = function(base, name, detail) {
        var nameText = String(base || '') + String(name || '');
        nameText = nameText.replace(/\s+/g, ' ').trim();
        detail = String(detail == null ? '' : detail).replace(/\r?\n/g, ' / ').trim();
        if (detail.length > 140) detail = detail.slice(0, 137) + '...';
        return { nameText: nameText, detailText: detail };
    };

    EE.prototype.executionLogIndentLevelForEntry = function(entry) {
        if (!entry || !entry.command) return 0;
        return Math.max(0, Math.floor(Number(entry.command.indent || 0)));
    };

    EE.prototype.executionLogRecordsForEntry = function(code, frame, entry) {
        var out = [];
        var c = Math.floor(Number(code || 0));
        var f = Math.max(0, Math.floor(Number(frame || 0)));
        var base = String(f) + 'f  ';
        var indentLevel = this.executionLogIndentLevelForEntry(entry);
        var rowKey = entry ? (entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main')) : 'main';
        if (c === 205 && entry) {
            var head = this.executionMoveRouteTargetLabelForEntry(entry);
            var route = entry.command && entry.command.parameters ? entry.command.parameters[1] : null;
            var tl = this.moveRouteTimeline(route);
            var items = tl && Array.isArray(tl.items) ? tl.items : [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it) continue;
                var cmd = it.command || null;
                var dcode = Number((it.displayCode != null) ? it.displayCode : (cmd ? cmd.code : 0));
                if (dcode <= 0 || dcode === 15) continue;
                var nm = (dcode === 4500) ? 'タイル移動' : this.routeCommandNameJa(dcode);
                var detail = '';
                if (dcode === 4500) detail = this.routeTileGotoTooltipText(entry, it.listIndex, it.span);
                else detail = this.routeCommandTooltipDetailText(cmd);
                var p1 = this.executionLogTextParts(base, head + nm, detail);
                var routeListIndex = this.nodeRouteIndex(it.listIndex);
                var cmdColor = this.commandTextColorForEntry(entry, routeListIndex, rowKey);
                out.push({
                    text: this.executionLogText(base, head + nm, detail),
                    nameText: p1.nameText,
                    mainParts: [
                        { text: base, color: 'rgba(238,245,255,.98)' },
                        { text: head, color: cmdColor },
                        { text: nm, color: cmdColor }
                    ],
                    detailText: p1.detailText,
                    detailColor: cmdColor,
                    uid: Number(entry.uid || 0),
                    routeListIndex: routeListIndex,
                    indentLevel: indentLevel
                });
            }
            if (!out.length) {
                var routeDetail = this.commandTooltipDetailText(entry);
                var p2 = this.executionLogTextParts(base, head + '移動ルートの設定', routeDetail);
                var routeColor = this.commandTextColorForEntry(entry, -1, rowKey);
                out.push({
                    text: this.executionLogText(base, head + '移動ルートの設定', routeDetail),
                    nameText: p2.nameText,
                    mainParts: [
                        { text: base, color: 'rgba(238,245,255,.98)' },
                        { text: head, color: routeColor },
                        { text: '移動ルートの設定', color: routeColor }
                    ],
                    detailText: p2.detailText,
                    detailColor: routeColor,
                    uid: Number(entry.uid || 0),
                    routeListIndex: -1,
                    indentLevel: indentLevel
                });
            }
            return out;
        }
        var dcode = this.mainCommandDisplayCodeForEntry(entry);
        var mainCode = dcode || c;
        var name = '';
        if (mainCode === 111) name = '条件分岐開始';
        else if (mainCode === 412) name = '条件分岐終了';
        else {
            name = (typeof this.commandNameJa === 'function')
                ? this.commandNameJa(mainCode)
                : ('コマンド' + mainCode);
        }
        var mainDetail = (mainCode === 412) ? '' : this.commandTooltipDetailText(entry);
        var p3 = this.executionLogTextParts(base, name, mainDetail);
        var cmdMainColor = this.commandTextColorForEntry(entry, -1, rowKey);
        out.push({
            text: this.executionLogText(base, name, mainDetail),
            nameText: p3.nameText,
            mainParts: [
                { text: base, color: 'rgba(238,245,255,.98)' },
                { text: name, color: cmdMainColor }
            ],
            detailText: p3.detailText,
            detailColor: cmdMainColor,
            mainColor: cmdMainColor,
            uid: Number(entry && entry.uid || 0),
            routeListIndex: -1,
            indentLevel: indentLevel
        });
        return out;
    };

    EE.prototype.appendExecutionLog = function(code, frame, entry) {
        if (!this.execLogView) return;
        if (!Array.isArray(this.execLogLines)) this.execLogLines = [];
        var records = this.executionLogRecordsForEntry(code, frame, entry);
        for (var i = 0; i < records.length; i++) this.execLogLines.push(records[i]);
        var lim = Math.max(20, Math.floor(Number(this.execLogMax || 240)));
        if (this.execLogLines.length > lim) {
            this.execLogLines.splice(0, this.execLogLines.length - lim);
        }
        this.renderExecutionLog(true);
    };

    EE.prototype.appendPlaybackStateLog = function(isPlaying, frame) {
        if (!this.execLogView) return;
        if (!Array.isArray(this.execLogLines)) this.execLogLines = [];
        var atFrame = Math.max(0, Math.floor(Number(frame == null ? this.frame : frame) || 0));
        this.execLogLines.push({
            text: isPlaying ? '再生開始' : '再生停止',
            nameText: isPlaying ? '再生開始' : '再生停止',
            mainColor: 'rgba(255,130,190,.98)',
            mainBold: true,
            logAction: isPlaying ? 'playback-start' : 'playback-stop',
            frame: atFrame,
            uid: 0,
            routeListIndex: -1,
            indentLevel: 0
        });
        var lim = Math.max(20, Math.floor(Number(this.execLogMax || 240)));
        if (this.execLogLines.length > lim) {
            this.execLogLines.splice(0, this.execLogLines.length - lim);
        }
        this.renderExecutionLog(true);
    };

    EE.prototype.executionPulseKey = function(uid, routeListIndex) {
        var u = Math.floor(Number(uid || 0));
        var r = this.nodeRouteIndex(routeListIndex);
        return String(u) + ':' + String(r);
    };

    EE.prototype.triggerExecutionPulse = function(uid, routeListIndex) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return;
        if (!this._execNodePulses || typeof this._execNodePulses !== 'object') {
            this._execNodePulses = Object.create(null);
        }
        this._execNodePulses[this.executionPulseKey(uid, routeListIndex)] = Date.now();
        this.timelineDirty = true;
    };

    EE.prototype.triggerRouteExecutionPulses = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return;
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var items = tl && Array.isArray(tl.items) ? tl.items : [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it) continue;
            var cmd = it.command || null;
            var displayCode = Number((it.displayCode != null) ? it.displayCode : (cmd ? cmd.code : 0));
            if (displayCode <= 0 || displayCode === 15) continue;
            var listIndex = this.nodeRouteIndex(it.listIndex);
            if (listIndex < 0) continue;
            this.triggerExecutionPulse(Number(entry.uid || 0), listIndex);
        }
    };

    EE.prototype.pruneExecutionPulses = function(nowMs) {
        if (!this._execNodePulses || typeof this._execNodePulses !== 'object') return false;
        var now = Math.max(0, Number(nowMs || 0));
        var dur = 420;
        var has = false;
        for (var k in this._execNodePulses) {
            if (!Object.prototype.hasOwnProperty.call(this._execNodePulses, k)) continue;
            var st = Number(this._execNodePulses[k] || 0);
            if (!isFinite(st) || now - st > dur) {
                delete this._execNodePulses[k];
                continue;
            }
            has = true;
        }
        return has;
    };

    EE.prototype.drawExecutionPulse = function(ctx, uid, routeListIndex, x, y, baseRadius, nowMs) {
        if (!ctx || !this._execNodePulses) return false;
        var key = this.executionPulseKey(uid, routeListIndex);
        var st = Number(this._execNodePulses[key] || 0);
        if (!st) return false;
        var now = Math.max(0, Number(nowMs || Date.now()));
        var dur = 420;
        var t = (now - st) / dur;
        if (!isFinite(t) || t < 0) t = 0;
        if (t >= 1) {
            delete this._execNodePulses[key];
            return false;
        }
        var alpha = Math.max(0, (1 - t) * (1 - t) * 0.95);
        var scale = this.timelineCircleScale();
        var rad = this.scaleTimelineCircleRadius(Math.max(1, Number(baseRadius || 4))) + (2 + t * 14) * scale;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = (0.8 + (1 - t) * 2.0) * scale;
        ctx.beginPath();
        ctx.arc(Number(x || 0), Number(y || 0), rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return true;
    };

    EE.prototype.getTrackRows = function(tr) {
        var rows = [{ key: 'main', type: 'main', label: 'Main' }];
        if (this.isBattleEventMode()) return rows;
        if (!tr) return rows;
        var used = {};
        var extra = Array.isArray(tr.extraCharRows) ? tr.extraCharRows : [];
        for (var ei = 0; ei < extra.length; ei++) {
            var ex = this.normalizeMoveTarget(Number(extra[ei] || 0));
            used[ex] = true;
        }
        var temp = Array.isArray(tr.tempCharRows) ? tr.tempCharRows : [];
        for (var ti = 0; ti < temp.length; ti++) {
            var tx = this.normalizeMoveTarget(Number(temp[ti] || 0));
            used[tx] = true;
        }
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char') continue;
            used[e.charId] = true;
        }
        var ids = Object.keys(used).map(function(v) { return Number(v); });
        ids.sort(function(a, b) {
            if (a === -1) return -1;
            if (b === -1) return 1;
            if (a === 0 && b !== -1) return -1;
            if (b === 0 && a !== -1) return 1;
            return a - b;
        });
        for (var j = 0; j < ids.length; j++) {
            rows.push({ key: 'char:' + ids[j], type: 'char', charId: ids[j], label: this.rowLabelForCharId(ids[j]) });
        }
        return rows;
    };

    EE.prototype.rowLabelForCharId = function(id) {
        if (this.isBattleEventMode()) return 'Main';
        if (id === -1) return 'Player';
        if (id === 0) return 'This Event';
        var ev = $dataMap && $dataMap.events ? $dataMap.events[id] : null;
        var n = ev && ev.name ? ev.name : '(event)';
        return 'Event ' + id + ': ' + n;
    };

    EE.prototype.trackHasCharRow = function(tr, charId) {
        if (!tr) return false;
        charId = this.normalizeMoveTarget(charId);
        var extra = Array.isArray(tr.extraCharRows) ? tr.extraCharRows : [];
        for (var i = 0; i < extra.length; i++) {
            if (this.normalizeMoveTarget(extra[i]) === charId) return true;
        }
        var cmds = Array.isArray(tr.commands) ? tr.commands : [];
        for (i = 0; i < cmds.length; i++) {
            var e = cmds[i];
            if (!e || e.rowType !== 'char') continue;
            if (this.normalizeMoveTarget(e.charId) === charId) return true;
        }
        return false;
    };

    EE.prototype.canAddCharRowToTimeline = function(charId) {
        if (!this.selEid || this.selPage < 0 || !this.selKey) return false;
        var tr = this.model.tracks[this.selKey] || this.ensureTrack(this.selEid, this.selPage);
        return !this.trackHasCharRow(tr, charId);
    };

    EE.prototype.addCharRowToTimeline = function(charId) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        charId = this.normalizeMoveTarget(charId);
        if (this.trackHasCharRow(tr, charId)) return false;
        this.pushSnap('addCharRow');
        if (!Array.isArray(tr.extraCharRows)) tr.extraCharRows = [];
        tr.extraCharRows.push(charId);
        tr.extraCharRows.sort(function(a, b) {
            a = Number(a || 0);
            b = Number(b || 0);
            if (a === -1) return -1;
            if (b === -1) return 1;
            if (a === 0 && b !== -1) return -1;
            if (b === 0 && a !== -1) return 1;
            return a - b;
        });
        if (Array.isArray(tr.tempCharRows)) {
            tr.tempCharRows = tr.tempCharRows.filter(function(v) { return Number(v) !== Number(charId); });
        }
        this.timelineDirty = true;
        this.refreshCharacterPanel(true);
        return true;
    };

    EE.prototype.trackHasCharCommands = function(tr, charId) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        charId = this.normalizeMoveTarget(charId);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char') continue;
            if (this.normalizeMoveTarget(e.charId) === charId) return true;
        }
        return false;
    };

    EE.prototype.removeCharRowFromExtra = function(tr, charId) {
        if (!tr || !Array.isArray(tr.extraCharRows)) return;
        charId = this.normalizeMoveTarget(charId);
        tr.extraCharRows = tr.extraCharRows.filter(function(v) {
            return Number(v) !== Number(charId);
        });
    };

    EE.prototype.ensureTemporaryCharRow = function(charId) {
        if (!this.selKey) return false;
        var tr = this.model.tracks[this.selKey] || this.ensureTrack(this.selEid, this.selPage);
        charId = this.normalizeMoveTarget(charId);
        if (this.trackHasCharRow(tr, charId)) return false;
        if (!Array.isArray(tr.tempCharRows)) tr.tempCharRows = [];
        for (var i = 0; i < tr.tempCharRows.length; i++) {
            if (Number(tr.tempCharRows[i]) === Number(charId)) return false;
        }
        tr.tempCharRows.push(charId);
        if (!Array.isArray(tr.extraCharRows)) tr.extraCharRows = [];
        tr.extraCharRows.push(charId);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.cleanupTemporaryCharRows = function(keepCharId) {
        if (!this.selKey) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr || !Array.isArray(tr.tempCharRows) || !tr.tempCharRows.length) return;
        var keep = (keepCharId == null) ? null : this.normalizeMoveTarget(keepCharId);
        var next = [];
        var changed = false;
        for (var i = 0; i < tr.tempCharRows.length; i++) {
            var id = this.normalizeMoveTarget(Number(tr.tempCharRows[i] || 0));
            if (this.trackHasCharCommands(tr, id)) { changed = true; continue; }
            if (keep != null && Number(keep) === Number(id)) {
                next.push(id);
                continue;
            }
            this.removeCharRowFromExtra(tr, id);
            changed = true;
        }
        tr.tempCharRows = next;
        if (changed) {
            this.timelineDirty = true;
            this.refreshCharacterPanel(true);
        }
    };

    EE.prototype.confirmCharRowPermanent = function(charId) {
        if (!this.selKey) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr || !Array.isArray(tr.tempCharRows)) return;
        var id = this.normalizeMoveTarget(charId);
        var oldLen = tr.tempCharRows.length;
        tr.tempCharRows = tr.tempCharRows.filter(function(v) { return Number(v) !== Number(id); });
        if (tr.tempCharRows.length !== oldLen) this.refreshCharacterPanel(true);
    };

    EE.prototype.selectCharacterForTimeline = function(charId, source) {
        if (this.dragMode === 'tile') return;
        charId = this.normalizeMoveTarget(charId);
        if (!this.selKey && charId > 0) this.selectEvent(charId, true);
        this.cleanupTemporaryCharRows(charId);
        this.panelSelectedCharId = charId;
        if (this.selKey) this.ensureTemporaryCharRow(charId);
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        if (source === 'map') this.msg('キャラ選択: ' + this.rowLabelForCharId(charId));
    };

    EE.prototype.characterPanelEntryName = function(id) {
        if (id === -1) return 'プレイヤー';
        if (id === 0) return 'このイベント';
        var ev = $dataMap && Array.isArray($dataMap.events) ? $dataMap.events[id] : null;
        var nm = ev && ev.name ? String(ev.name) : '(event)';
        return nm;
    };

    EE.prototype.currentSelectedCharacterId = function() {
        return (this.panelSelectedCharId == null)
            ? (this.selEid > 0 ? Number(this.selEid) : null)
            : Number(this.panelSelectedCharId);
    };

    EE.prototype.characterByPanelId = function(id) {
        id = Number(id || 0);
        if (id === -1) return $gamePlayer || null;
        if (id === 0) return this.selEid > 0 ? ($gameMap ? $gameMap.event(this.selEid) : null) : null;
        return $gameMap ? $gameMap.event(id) : null;
    };

    EE.prototype.selectedCharacterInfoKey = function(id) {
        id = Number(id);
        if (id === -1) return 'player';
        if (id === 0) return 'thisEvent:' + String(Math.max(0, Math.floor(Number(this.selEid || 0))));
        return 'event:' + String(Math.max(0, Math.floor(id || 0)));
    };

    EE.prototype.characterStateEntries = function(id, ch) {
        var entries = [];
        var sid = this.normalizeMoveTarget(id);
        var push = function(key, label, value) {
            var v = String(value == null ? '' : value);
            entries.push({ key: String(key || ''), value: v, text: String(label || '') + ': ' + v });
        };
        push('id', 'ID', String(id));
        push('name', '名前', this.characterPanelEntryName(id));
        if (!ch) {
            push('state', '状態', '取得できません');
            return entries;
        }
        var inTimeline = this.trackHasCharRow(this.selKey ? this.model.tracks[this.selKey] : null, sid);
        push('timelineRow', 'タイムライン行', inTimeline ? 'あり' : 'なし');
        push('onScreen', '画面内', this.isCharacterVisibleOnScreen(ch) ? '表示中' : '画面外/非表示');
        push('tilePos', '座標', '(' + Number(ch.x || 0) + ', ' + Number(ch.y || 0) + ')');
        push('realPos', '実座標', '('
            + Number(ch._realX == null ? ch.x || 0 : ch._realX).toFixed(2)
            + ', '
            + Number(ch._realY == null ? ch.y || 0 : ch._realY).toFixed(2)
            + ')');
        var dir = (typeof ch.direction === 'function') ? Number(ch.direction() || 0) : Number(ch._direction || 0);
        push('direction', '向き', dir);
        push('image', '画像', String(ch._characterName || '') + ' [' + Number(ch._characterIndex || 0) + ']');
        push('opacity', '不透明度', Number(ch._opacity == null ? 255 : ch._opacity));
        push('blend', '合成', Number(ch._blendMode || 0));
        push('moveSpeed', '移動速度', Number(ch._moveSpeed || 0));
        push('moveFreq', '頻度', Number(ch._moveFrequency || 0));
        push('through', 'すり抜け', ch._through ? 'ON' : 'OFF');
        push('transparent', '透明', ch._transparent ? 'ON' : 'OFF');
        push('walkAnime', '歩行アニメ', ch._walkAnime ? 'ON' : 'OFF');
        push('stepAnime', '足踏みアニメ', ch._stepAnime ? 'ON' : 'OFF');
        push('dirFix', '向き固定', ch._directionFix ? 'ON' : 'OFF');
        if (typeof Game_Event !== 'undefined' && ch instanceof Game_Event) {
            var eid = (typeof ch.eventId === 'function') ? Number(ch.eventId() || 0) : Number(ch._eventId || 0);
            var ep = Math.max(-1, Number(ch._pageIndex == null ? -1 : ch._pageIndex));
            var ed = (typeof ch.event === 'function') ? ch.event() : null;
            var maxP = ed && Array.isArray(ed.pages) ? ed.pages.length : 0;
            push('eventId', 'イベントID', eid);
            push('page', 'ページ', (ep >= 0 ? (ep + 1) : '-'));
            push('pageCount', '総ページ数', maxP);
            push('erased', '一時消去', ch._erased ? 'ON' : 'OFF');
        } else if (id === -1) {
            var vType = (typeof ch.vehicle === 'function' && ch.vehicle()) ? String(ch.vehicle()._type || '') : '';
            push('playerState', 'プレイヤー状態', vType ? ('乗り物=' + vType) : '徒歩');
        }
        return entries;
    };

    EE.prototype.characterStateLines = function(id, ch) {
        var es = this.characterStateEntries(id, ch);
        var out = [];
        for (var i = 0; i < es.length; i++) out.push(String(es[i].text || ''));
        return out;
    };

    EE.prototype.characterStateStartupBaselineMap = function(id, entries) {
        entries = Array.isArray(entries) ? entries : [];
        var map = Object.create(null);
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i] || {};
            map[String(e.key || '')] = String(e.value == null ? '' : e.value);
        }
        var sid = this.normalizeMoveTarget(id);
        var startup = null;
        var eventId = 0;
        if (sid === -1) {
            startup = this.base && this.base.pl ? this.base.pl : null;
        } else {
            eventId = Math.max(0, Math.floor(Number(sid === 0 ? (this.selEid || 0) : sid)));
            startup = (this.base && this.base.ev) ? this.base.ev[eventId] : null;
        }
        if (!startup) return map;

        map.tilePos = '(' + Number(startup.x || 0) + ', ' + Number(startup.y || 0) + ')';
        map.realPos = '('
            + Number(startup.rx == null ? startup.x || 0 : startup.rx).toFixed(2)
            + ', '
            + Number(startup.ry == null ? startup.y || 0 : startup.ry).toFixed(2)
            + ')';
        map.direction = String(Number(startup.dir || 0));
        map.image = String(startup.nm || '') + ' [' + Number(startup.ix || 0) + ']';
        map.opacity = String(Number(startup.op == null ? 255 : startup.op));
        map.blend = String(Number(startup.bm || 0));
        map.moveSpeed = String(Number(startup.ms || 0));
        map.moveFreq = String(Number(startup.mf || 0));
        map.through = startup.th ? 'ON' : 'OFF';
        map.transparent = startup.tr ? 'ON' : 'OFF';
        map.walkAnime = startup.wa ? 'ON' : 'OFF';
        map.stepAnime = startup.sa ? 'ON' : 'OFF';
        map.dirFix = startup.df ? 'ON' : 'OFF';

        var ex = startup.ex && typeof startup.ex === 'object' ? startup.ex : null;
        if (sid !== -1) {
            map.eventId = String(eventId);
            var pageIndex = ex && ex._pageIndex != null ? Math.floor(Number(ex._pageIndex || 0)) : -1;
            map.page = pageIndex >= 0 ? String(pageIndex + 1) : '-';
            map.erased = ex && ex._erased ? 'ON' : 'OFF';
        }
        return map;
    };

    EE.prototype.captureCharInfoStartupBaselines = function() {
        if (this._charInfoStartupBaselineCaptured) return;
        this._charInfoStartupBaselineCaptured = true;
        if (!this._charInfoBaselineMap || typeof this._charInfoBaselineMap !== 'object') {
            this._charInfoBaselineMap = Object.create(null);
        }
        var ids = [-1];
        var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
        for (var ei = 1; ei < evs.length; ei++) {
            if (evs[ei]) ids.push(ei);
        }
        if (this.selEid > 0) ids.push(0);

        for (var i = 0; i < ids.length; i++) {
            var id = Number(ids[i] || 0);
            var key = this.selectedCharacterInfoKey(id);
            if (key && this._charInfoBaselineMap[key]) continue;
            var entries = this.characterStateEntries(id, this.characterByPanelId(id));
            var baseline = this.characterStateStartupBaselineMap(id, entries);
            if (key) this._charInfoBaselineMap[key] = baseline;
            if (id > 0) {
                var aliasKey = 'thisEvent:' + String(id);
                if (!this._charInfoBaselineMap[aliasKey]) this._charInfoBaselineMap[aliasKey] = baseline;
            }
        }
    };

    EE.prototype.battlePagePanelEntries = function() {
        var out = [];
        var troopId = this.currentBattleTroopId();
        var troop = this.currentBattleTroopData();
        var pages = troop && Array.isArray(troop.pages) ? troop.pages : [];
        var selectedPage = Math.max(0, Math.floor(Number(this.selPage || 0)));
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i] || {};
            var cond = (page.conditions && typeof page.conditions === 'object') ? page.conditions : {};
            var span = Math.max(0, Math.floor(Number(page.span || 0)));
            var summary = this.battleConditionSummary(cond);
            var cmdCount = 0;
            var list = Array.isArray(page.list) ? page.list : [];
            for (var li = 0; li < list.length; li++) {
                if (Math.floor(Number(list[li] && list[li].code || 0)) > 0) cmdCount++;
            }
            out.push({
                troopId: troopId,
                pageIndex: i,
                selected: i === selectedPage,
                text: 'P' + String(i + 1) + ' [S:' + String(span) + '] ' + summary,
                detail: 'Cmd:' + String(cmdCount)
            });
        }
        return out;
    };

    EE.prototype.selectBattlePageFromPanel = function(pageIndex) {
        var troopId = this.currentBattleTroopId();
        this.selectBattleTrack(troopId, Math.max(0, Math.floor(Number(pageIndex || 0))), true);
    };

    EE.prototype.refreshSelectedCharacterInfo = function(force) {
        if (!this.charInfo) return;
        if (this.isBattleEventMode()) {
            var troopId = this.currentBattleTroopId();
            var troop = this.currentBattleTroopData();
            var pages = troop && Array.isArray(troop.pages) ? troop.pages : [];
            if (!troop || !pages.length) {
                this.charInfo.textContent = '戦闘ページなし';
                this._charInfoSig = 'battle:none';
                return;
            }
            var pi = Math.max(0, Math.min(pages.length - 1, Math.floor(Number(this.selPage || 0))));
            var page = pages[pi] || {};
            var cond = (page.conditions && typeof page.conditions === 'object') ? page.conditions : {};
            var lines = [
                'Troop: ' + String(troopId) + ' / ' + String(troop.name || '(名前なし)'),
                'Page: ' + String(pi + 1) + ' / ' + String(pages.length),
                '条件: ' + this.battleConditionSummary(cond),
                'Span: ' + String(Math.max(0, Math.floor(Number(page.span || 0)))),
                'turnEnding: ' + (cond.turnEnding ? 'ON' : 'OFF'),
                'turn: ' + (cond.turnValid ? ('ON (' + Math.max(0, Math.floor(Number(cond.turnA || 0))) + ' + ' + Math.max(0, Math.floor(Number(cond.turnB || 0))) + 'n)') : 'OFF'),
                'enemy: ' + (cond.enemyValid ? ('ON (index=' + Math.max(1, Math.floor(Number(cond.enemyIndex || 0)) + 1) + ', hp<=' + Math.max(0, Math.floor(Number(cond.enemyHp == null ? 100 : cond.enemyHp))) + ')') : 'OFF'),
                'actor: ' + (cond.actorValid ? ('ON (id=' + Math.max(1, Math.floor(Number(cond.actorId || 1))) + ', hp<=' + Math.max(0, Math.floor(Number(cond.actorHp == null ? 100 : cond.actorHp))) + ')') : 'OFF'),
                'switch: ' + (cond.switchValid ? ('ON (id=' + Math.max(1, Math.floor(Number(cond.switchId || 1))) + ')') : 'OFF')
            ];
            var sigBattle = lines.join('|');
            if (!force && sigBattle === this._charInfoSig) return;
            this._charInfoSig = sigBattle;
            this.charInfo.innerHTML = '';
            for (var bi = 0; bi < lines.length; bi++) {
                this.charInfo.appendChild(this.el('div', 'line', lines[bi]));
            }
            return;
        }
        if (typeof this.captureCharInfoStartupBaselines === 'function') this.captureCharInfoStartupBaselines();
        var id = this.currentSelectedCharacterId();
        var entries = [];
        var infoKey = '';
        if (id == null) {
            entries = [{ key: 'none', value: '未選択', text: '未選択' }];
        } else {
            infoKey = this.selectedCharacterInfoKey(id);
            entries = this.characterStateEntries(id, this.characterByPanelId(id));
        }

        if (!this._charInfoBaselineMap || typeof this._charInfoBaselineMap !== 'object') {
            this._charInfoBaselineMap = Object.create(null);
        }
        if (!this._charInfoTouchedMap || typeof this._charInfoTouchedMap !== 'object') {
            this._charInfoTouchedMap = Object.create(null);
        }

        var baseMap = null;
        var touched = null;
        if (infoKey) {
            baseMap = this._charInfoBaselineMap[infoKey];
            if (!baseMap) {
                baseMap = this.characterStateStartupBaselineMap(id, entries);
                this._charInfoBaselineMap[infoKey] = baseMap;
            }
            touched = this._charInfoTouchedMap[infoKey];
            if (!touched) {
                touched = Object.create(null);
                this._charInfoTouchedMap[infoKey] = touched;
            }
            for (var ti = 0; ti < entries.length; ti++) {
                var te = entries[ti];
                var k = String(te.key || '');
                var cur = String(te.value == null ? '' : te.value);
                var b = String(baseMap[k] == null ? '' : baseMap[k]);
                if (cur !== b) touched[k] = true;
            }
        }

        var sigParts = [];
        for (var si = 0; si < entries.length; si++) {
            var se = entries[si];
            var sk = String(se.key || '');
            var mark = (touched && touched[sk]) ? '1' : '0';
            sigParts.push(sk + ':' + String(se.value == null ? '' : se.value) + ':' + mark);
        }
        var sig = sigParts.join('|');
        if (!force && sig === this._charInfoSig) return;
        this._charInfoSig = sig;

        this.charInfo.innerHTML = '';
        for (var ri = 0; ri < entries.length; ri++) {
            var re = entries[ri];
            var line = this.el('div', 'line', String(re.text || ''));
            if (touched && touched[String(re.key || '')]) line.classList.add('chg');
            this.charInfo.appendChild(line);
        }
    };

    EE.prototype.characterOverlayItems = function() {
        if (this.isBattleEventMode()) return [];
        var out = [];
        var ss = this.s && this.s._spriteset;
        var ls = ss && ss._characterSprites;
        if (!ls || !ls.length) return out;
        var minOverlayPx = 24;
        var selectedId = this.currentSelectedCharacterId();
        for (var i = 0; i < ls.length; i++) {
            var sp = ls[i];
            if (!sp || !sp.visible || !sp._character || !sp.getBounds) continue;
            var ch = sp._character;
            var cid = null;
            try {
                if (typeof Game_Player !== 'undefined' && ch instanceof Game_Player) cid = -1;
                else if (typeof Game_Event !== 'undefined' && ch instanceof Game_Event && ch.eventId) {
                    if (ch._erased) continue;
                    cid = Number(ch.eventId() || 0);
                }
            } catch (_) { cid = null; }
            if (cid == null) continue;
            var b = sp.getBounds();
            var bx = Number(b && b.x || 0);
            var by = Number(b && b.y || 0);
            var bw = Math.max(0, Number(b && b.width || 0));
            var bh = Math.max(0, Number(b && b.height || 0));
            if (bw <= 0 || bh <= 0) {
                var sx = 0, sy = 0;
                try { sx = Number(ch && ch.screenX ? ch.screenX() : (sp.x || 0)); } catch (_) { sx = Number(sp.x || 0); }
                try { sy = Number(ch && ch.screenY ? ch.screenY() : (sp.y || 0)); } catch (_) { sy = Number(sp.y || 0); }
                bw = minOverlayPx;
                bh = minOverlayPx;
                bx = sx - bw / 2;
                by = sy - bh;
            }
            var sr = this.canvasToScreenRect(bx, by, bw, bh);
            if (!sr) continue;
            var sw = Math.max(minOverlayPx, Number(sr.w || 0));
            var sh = Math.max(minOverlayPx, Number(sr.h || 0));
            var sx2 = Number(sr.x || 0) - Math.max(0, (sw - Number(sr.w || 0)) / 2);
            var sy2 = Number(sr.y || 0) - Math.max(0, (sh - Number(sr.h || 0)) / 2);
            var name = (cid === -1) ? 'プレイヤー' : this.characterPanelEntryName(cid);
            out.push({
                id: cid,
                name: name,
                x: Math.floor(sx2),
                y: Math.floor(sy2),
                w: Math.max(1, Math.floor(sw)),
                h: Math.max(1, Math.floor(sh)),
                sel: (selectedId != null && Number(selectedId) === Number(cid))
            });
        }
        return out;
    };

    EE.prototype.fitOverlayName = function(name, boxWidthPx) {
        name = String(name == null ? '' : name);
        if (!name) return '';
        var maxPx = Math.max(1, Math.floor(Number(boxWidthPx || 0)) - 8);
        if (maxPx <= 0) return name.charAt(0);
        if (!this._overlayNameMeasureCanvas) this._overlayNameMeasureCanvas = document.createElement('canvas');
        var ctx = this._overlayNameMeasureCanvas && this._overlayNameMeasureCanvas.getContext
            ? this._overlayNameMeasureCanvas.getContext('2d')
            : null;
        if (!ctx) return name;
        ctx.font = '10px "Yu Gothic UI","Meiryo UI",sans-serif';
        if (ctx.measureText(name).width <= maxPx) return name;
        var ell = '…';
        var first = name.charAt(0);
        if (name.length <= 1) return first;
        if (ctx.measureText(first + ell).width > maxPx) return first;
        var lo = 1, hi = name.length, best = first;
        while (lo <= hi) {
            var mid = Math.floor((lo + hi) / 2);
            var cand = name.slice(0, mid) + ell;
            if (ctx.measureText(cand).width <= maxPx) {
                best = cand;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best || first;
    };

    EE.prototype.refreshCharacterOverlay = function(force) {
        if (!this.charOverlayLayer) return;
        if (this.isBattleEventMode()) {
            this.charOverlayLayer.style.display = 'none';
            this.charOverlayLayer.innerHTML = '';
            this._charOverlaySig = 'battle';
            return;
        }
        if (this.play) {
            if (this.charOverlayLayer.style.display !== 'none') this.charOverlayLayer.style.display = 'none';
            this._charOverlaySig = '';
            return;
        }
        this.charOverlayLayer.style.display = 'block';
        var items = this.characterOverlayItems();
        var sig = '';
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            sig += it.id + ':' + it.x + ':' + it.y + ':' + it.w + ':' + it.h + ':' + (it.sel ? 1 : 0) + '|';
        }
        if (!force && sig === this._charOverlaySig) return;
        this._charOverlaySig = sig;
        this.charOverlayLayer.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (i = 0; i < items.length; i++) {
            var it2 = items[i];
            var box = this.el('div', 'ovit' + (it2.sel ? ' sel' : ''));
            box.setAttribute('data-char-id', String(Number(it2.id || 0)));
            box.style.left = it2.x + 'px';
            box.style.top = it2.y + 'px';
            box.style.width = it2.w + 'px';
            box.style.height = it2.h + 'px';
            var nm = this.el('div', 'ovnm', this.fitOverlayName(it2.name, it2.w));
            nm.setAttribute('data-char-id', String(Number(it2.id || 0)));
            nm.title = String(it2.name || '');
            box.appendChild(nm);
            frag.appendChild(box);
        }
        this.charOverlayLayer.appendChild(frag);
    };

    EE.prototype.isCharacterVisibleOnScreen = function(ch) {
        if (!ch) return false;
        try {
            if (ch._erased) return false;
            if (typeof ch.isTransparent === 'function' && ch.isTransparent()) return false;
        } catch (_) {}
        var sx = 0, sy = 0;
        try { sx = Number(ch.screenX ? ch.screenX() : 0); } catch (_) { sx = 0; }
        try { sy = Number(ch.screenY ? ch.screenY() : 0); } catch (_) { sy = 0; }
        return sx >= -48 && sx <= Graphics.boxWidth + 48 && sy >= -48 && sy <= Graphics.boxHeight + 48;
    };

    EE.prototype.buildCharacterPanelEntries = function() {
        if (this.isBattleEventMode()) return [];
        var ids = [-1, 0];
        var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
        for (var i = 1; i < evs.length; i++) if (evs[i]) ids.push(i);
        var tr = this.selKey ? (this.model.tracks[this.selKey] || null) : null;
        var selectedId = this.currentSelectedCharacterId();
        var out = [];
        for (i = 0; i < ids.length; i++) {
            var id = Number(ids[i] || 0);
            var ch = this.characterByPanelId(id);
            var vis = this.isCharacterVisibleOnScreen(ch);
            var txt = String(id) + ' ' + this.characterPanelEntryName(id);
            out.push({
                id: id,
                text: txt,
                visible: vis,
                selected: (selectedId != null && selectedId === id),
                inTimeline: this.trackHasCharRow(tr, id)
            });
        }
        out.sort(function(a, b) {
            if (a.visible !== b.visible) return a.visible ? -1 : 1;
            return a.id - b.id;
        });
        return out;
    };

    EE.prototype.closeCharContextMenu = function() {
        this.charCtxTargetId = null;
        if (this.charCtx) this.charCtx.classList.remove('on');
    };

    EE.prototype.isContextEventAdjustModeActive = function() {
        return !!(this.contextEventAdjustState && typeof this.contextEventAdjustState === 'object');
    };

    EE.prototype.hideContextEventAdjustVisual = function() {
        if (this.contextEventOriginLine && this.contextEventOriginLine.style) {
            this.contextEventOriginLine.style.display = 'none';
        }
        if (this.contextEventRangeLayer && this.contextEventRangeLayer.style) {
            this.contextEventRangeLayer.style.display = 'none';
            this.contextEventRangeLayer.innerHTML = '';
        }
    };

    EE.prototype.endContextEventAdjustMode = function(silent) {
        if (!this.isContextEventAdjustModeActive()) return;
        this.contextEventAdjustState = null;
        this.hideContextEventAdjustVisual();
        if (!silent) this.msg('調整モード終了');
    };

    EE.prototype.contextEventAdjustEventData = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        return ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eventId] : null;
    };

    EE.prototype.contextEventAdjustEventObject = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        if (!$gameMap || typeof $gameMap.event !== 'function') return null;
        return $gameMap.event(eventId);
    };

    EE.prototype.contextEventAdjustRuntimeSprite = function(eventId) {
        var ev = this.contextEventAdjustEventObject(eventId);
        if (!ev || typeof ev.sprite !== 'function') return null;
        try { return ev.sprite(); } catch (_) { return null; }
    };

    EE.prototype.formatContextEventAdjustNumber = function(value, maxDigits) {
        value = Number(value || 0);
        if (!isFinite(value)) value = 0;
        maxDigits = Math.max(0, Math.floor(Number(maxDigits == null ? 3 : maxDigits) || 0));
        var rounded = Number(value.toFixed(maxDigits));
        if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
        return String(rounded).replace(/(\.\d*?[1-9])0+$/g, '$1').replace(/\.0+$/g, '');
    };

    EE.prototype.parseContextCgShiftFromNote = function(note) {
        var s = String(note == null ? '' : note);
        var m = s.match(/<(?:CGShift|CGシフト)\s*:\s*([^,>]+)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*>/i);
        if (!m) return null;
        return {
            target: String(m[1] || ''),
            x: Math.round(Number(m[2] || 0)),
            y: Math.round(Number(m[3] || 0))
        };
    };

    EE.prototype.parseContextCgOriginFromNote = function(note) {
        var s = String(note == null ? '' : note);
        var m = s.match(/<(?:CGOrigin|CG原点)\s*:\s*([^,>]+)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*>/i);
        if (!m) return null;
        return {
            target: String(m[1] || ''),
            x: Number(m[2] || 50),
            y: Number(m[3] || 100)
        };
    };

    EE.prototype.upsertContextCgShiftInNote = function(note, x, y) {
        var cleaned = String(note == null ? '' : note).replace(/<(?:CGShift|CGシフト)\s*:[^>]*>/ig, '').trim();
        var tag = '<CGShift:A,' + String(Math.round(Number(x || 0))) + ',' + String(Math.round(Number(y || 0))) + '>';
        if (!cleaned.length) return tag;
        return /[>\s]$/.test(cleaned) ? (cleaned + tag) : (cleaned + ' ' + tag);
    };

    EE.prototype.upsertContextCgOriginInNote = function(note, y) {
        var cleaned = String(note == null ? '' : note).replace(/<(?:CGOrigin|CG原点)\s*:[^>]*>/ig, '').trim();
        var tag = '<CGOrigin:A,50,' + this.formatContextEventAdjustNumber(y, 3) + '>';
        if (!cleaned.length) return tag;
        return /[>\s]$/.test(cleaned) ? (cleaned + tag) : (cleaned + ' ' + tag);
    };

    EE.prototype.contextEventRangeUnit = function() {
        var unit = (typeof Game_Map !== 'undefined' && Game_Map && Game_Map.tileUnit) ? Number(Game_Map.tileUnit || 0.5) : 0.5;
        if (!isFinite(unit) || unit <= 0) unit = 0.5;
        return unit;
    };

    EE.prototype.contextEventRangeToIndex = function(v) {
        var unit = this.contextEventRangeUnit();
        return Math.round(Number(v || 0) / unit);
    };

    EE.prototype.contextEventRangeToValue = function(index) {
        return Number(index || 0) * this.contextEventRangeUnit();
    };

    EE.prototype.contextEventRangeMapKey = function(ix, iy) {
        return String(Math.floor(Number(ix || 0))) + ',' + String(Math.floor(Number(iy || 0)));
    };

    EE.prototype.cloneContextEventRangeMap = function(src) {
        var out = Object.create(null);
        if (!src || typeof src !== 'object') return out;
        for (var k in src) {
            if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
            if (!src[k]) continue;
            out[k] = true;
        }
        return out;
    };

    EE.prototype.hasAnyContextEventRangeCell = function(rangeMap) {
        if (!rangeMap || typeof rangeMap !== 'object') return false;
        for (var k in rangeMap) {
            if (Object.prototype.hasOwnProperty.call(rangeMap, k) && rangeMap[k]) return true;
        }
        return false;
    };

    EE.prototype.defaultContextEventRangeMap = function() {
        var out = Object.create(null);
        out[this.contextEventRangeMapKey(0, 0)] = true;
        out[this.contextEventRangeMapKey(1, 0)] = true;
        out[this.contextEventRangeMapKey(0, 1)] = true;
        out[this.contextEventRangeMapKey(1, 1)] = true;
        return out;
    };

    EE.prototype.parseContextEventRangeValue = function(value) {
        if (value === undefined || value === null) return null;
        var text = String(value).trim();
        if (!text.length || text.charAt(0) !== '[') return null;
        var jsonText = (text.charAt(1) === '[') ? text : ('[' + text + ']');
        var data = null;
        try { data = JSON.parse(jsonText); } catch (_) { data = null; }
        if (!Array.isArray(data)) return null;
        var out = Object.create(null);
        var hasAny = false;
        for (var i = 0; i < data.length; i++) {
            var pair = data[i];
            if (!Array.isArray(pair) || pair.length < 2) continue;
            var dx = Number(pair[0]);
            var dy = Number(pair[1]);
            if (!isFinite(dx) || !isFinite(dy)) continue;
            out[this.contextEventRangeMapKey(this.contextEventRangeToIndex(dx), this.contextEventRangeToIndex(dy))] = true;
            hasAny = true;
        }
        return hasAny ? out : null;
    };

    EE.prototype.parseContextEventRangeFromNote = function(note) {
        var s = String(note == null ? '' : note);
        var m = s.match(/<(?:range|Range)\s*:\s*([^>]*)>/i);
        if (!m) return null;
        return this.parseContextEventRangeValue(m[1]);
    };

    EE.prototype.contextEventRangeMapToTagBody = function(rangeMap) {
        if (!this.hasAnyContextEventRangeCell(rangeMap)) return '';
        var keys = [];
        for (var k in rangeMap) {
            if (Object.prototype.hasOwnProperty.call(rangeMap, k) && rangeMap[k]) keys.push(k);
        }
        keys.sort(function(a, b) {
            var ap = String(a).split(',');
            var bp = String(b).split(',');
            var ax = Math.floor(Number(ap[0] || 0));
            var ay = Math.floor(Number(ap[1] || 0));
            var bx = Math.floor(Number(bp[0] || 0));
            var by = Math.floor(Number(bp[1] || 0));
            if (ay !== by) return ay - by;
            return ax - bx;
        });
        var out = [];
        for (var i = 0; i < keys.length; i++) {
            var p = String(keys[i]).split(',');
            var ix = Math.floor(Number(p[0] || 0));
            var iy = Math.floor(Number(p[1] || 0));
            var x = this.formatContextEventAdjustNumber(this.contextEventRangeToValue(ix), 3);
            var y = this.formatContextEventAdjustNumber(this.contextEventRangeToValue(iy), 3);
            out.push('[' + x + ',' + y + ']');
        }
        return out.join(',');
    };

    EE.prototype.upsertContextRangeInNote = function(note, rangeMap) {
        var cleaned = String(note == null ? '' : note).replace(/<(?:range|Range)\s*:[^>]*>/ig, '').trim();
        var body = this.contextEventRangeMapToTagBody(rangeMap);
        if (!body.length) return cleaned;
        var tag = '<range:' + body + '>';
        if (!cleaned.length) return tag;
        return /[>\s]$/.test(cleaned) ? (cleaned + tag) : (cleaned + ' ' + tag);
    };

    EE.prototype.contextEventRangeEditBounds = function(rangeMap) {
        var minX = 0, maxX = 1, minY = 0, maxY = 1;
        if (rangeMap && typeof rangeMap === 'object') {
            for (var k in rangeMap) {
                if (!Object.prototype.hasOwnProperty.call(rangeMap, k) || !rangeMap[k]) continue;
                var p = String(k).split(',');
                var ix = Math.floor(Number(p[0] || 0));
                var iy = Math.floor(Number(p[1] || 0));
                if (!isFinite(ix) || !isFinite(iy)) continue;
                if (ix < minX) minX = ix;
                if (ix > maxX) maxX = ix;
                if (iy < minY) minY = iy;
                if (iy > maxY) maxY = iy;
            }
        }
        minX -= 2; maxX += 2; minY -= 2; maxY += 2;
        var maxSpan = 16;
        if ((maxX - minX + 1) > maxSpan) {
            var cx = Math.round((minX + maxX) / 2);
            minX = cx - Math.floor(maxSpan / 2);
            maxX = minX + maxSpan - 1;
        }
        if ((maxY - minY + 1) > maxSpan) {
            var cy = Math.round((minY + maxY) / 2);
            minY = cy - Math.floor(maxSpan / 2);
            maxY = minY + maxSpan - 1;
        }
        return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
    };

    EE.prototype.contextEventAdjustMarkDirty = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        this.dirty['es_pages:' + String(eventId)] = true;
        this.timelineDirty = true;
    };

    EE.prototype.contextEventAdjustOriginStepPercent = function(eventId) {
        var sp = this.contextEventAdjustRuntimeSprite(eventId);
        var h = 0;
        if (sp && typeof sp.getBounds === 'function') {
            var b = sp.getBounds();
            h = Math.abs(Number(b && b.height || 0));
        }
        if (!h && sp && sp._frame) h = Math.abs(Number(sp._frame.height || 0));
        if (!h && sp && typeof sp.patternHeight === 'function') h = Math.abs(Number(sp.patternHeight() || 0));
        if (!h) h = 100;
        return 100 / Math.max(1, h);
    };

    EE.prototype.applyContextEventAdjustState = function(state, writeNote) {
        if (!state || typeof state !== 'object') return false;
        var eventId = Math.max(1, Math.floor(Number(state.eventId || 0)));
        var evData = this.contextEventAdjustEventData(eventId);
        var ev = this.contextEventAdjustEventObject(eventId);
        if (!evData || !ev) return false;
        var type = String(state.type || '');
        if (type === 'shift') {
            state.shiftX = Math.round(Number(state.shiftX || 0));
            state.shiftY = Math.round(Number(state.shiftY || 0));
            if (typeof ev.shiftPosition === 'function') ev.shiftPosition(state.shiftX, state.shiftY);
            else {
                ev._additionalX = state.shiftX;
                ev._additionalY = state.shiftY;
            }
        } else if (type === 'originY') {
            state.originY = Number(state.originY || 100);
            if (!isFinite(state.originY)) state.originY = 100;
            if (typeof ev.setOrigin === 'function') ev.setOrigin(50, state.originY);
            else {
                ev._originX = 0.5;
                ev._originY = state.originY / 100;
            }
        }

        if (writeNote) {
            var prevNote = String(evData.note || '');
            var nextNote = prevNote;
            if (type === 'shift') nextNote = this.upsertContextCgShiftInNote(prevNote, state.shiftX, state.shiftY);
            else if (type === 'originY') nextNote = this.upsertContextCgOriginInNote(prevNote, state.originY);
            if (nextNote !== prevNote) {
                evData.note = nextNote;
                if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.extractMetadata === 'function') {
                    try { DataManager.extractMetadata(evData); } catch (_) {}
                }
                this.contextEventAdjustMarkDirty(eventId);
                if (this.eventSettingsModal && this.eventSettingsModal.classList &&
                    this.eventSettingsModal.classList.contains('on') &&
                    Math.floor(Number(this.eventSettingsTargetEventId || 0)) === eventId &&
                    this.eventSettingsNoteInput) {
                    this.eventSettingsNoteInput.value = nextNote;
                }
            }
        }
        // Keep preview baseline in sync so per-frame resim does not revert shift/origin immediately.
        if (this.base && this.base.ev) {
            if (!this.base.ev[eventId] && typeof this.captureCanonicalEventState === 'function') {
                try { this.base.ev[eventId] = this.captureCanonicalEventState(eventId, ev); } catch (_) {}
            }
            var bst = this.base.ev[eventId];
            if (bst) {
                if (!bst.ex || typeof bst.ex !== 'object') bst.ex = {};
                if (type === 'shift') {
                    bst.ex._additionalX = Math.round(Number(state.shiftX || 0));
                    bst.ex._additionalY = Math.round(Number(state.shiftY || 0));
                } else if (type === 'originY') {
                    bst.ex._originX = 0.5;
                    bst.ex._originY = Number(state.originY || 100) / 100;
                }
            }
        }
        if (this._eeCalcDebugBaseFlagsByEvent && typeof this._eeCalcDebugBaseFlagsByEvent === 'object') {
            try { delete this._eeCalcDebugBaseFlagsByEvent[String(eventId)]; } catch (_) {}
        }
        if (typeof this.stepVisualRuntime === 'function') this.stepVisualRuntime();
        this.refreshCharacterOverlay(true);
        this.refreshSelectedCharacterInfo(true);
        return true;
    };

    EE.prototype.beginContextEventAdjustMode = function(type) {
        type = String(type || '');
        if (type !== 'shift' && type !== 'originY' && type !== 'range') return;
        var eventId = Math.max(0, Math.floor(Number(this.charCtxTargetId || 0)));
        this.closeCharContextMenu();
        if (eventId <= 0) {
            this.msg('イベントのみ調整できます');
            return;
        }
        var evData = this.contextEventAdjustEventData(eventId);
        var ev = this.contextEventAdjustEventObject(eventId);
        if (!evData || !ev) {
            this.msg('イベントが見つかりません');
            return;
        }
        var note = String(evData.note || '');
        var shiftTag = this.parseContextCgShiftFromNote(note);
        var originTag = this.parseContextCgOriginFromNote(note);
        var shiftX = shiftTag ? Math.round(Number(shiftTag.x || 0)) : Math.round(Number(ev._additionalX || 0));
        var shiftY = shiftTag ? Math.round(Number(shiftTag.y || 0)) : Math.round(Number(ev._additionalY || 0));
        var originY = originTag ? Number(originTag.y || 100) : (
            (typeof ev.originY === 'function' && isFinite(Number(ev.originY()))) ? Number(ev.originY()) * 100 : 100
        );
        if (!isFinite(originY)) originY = 100;
        var rangeMap = this.parseContextEventRangeFromNote(note) || this.defaultContextEventRangeMap();
        this.contextEventAdjustState = {
            type: type,
            eventId: eventId,
            shiftX: shiftX,
            shiftY: shiftY,
            originY: originY,
            rangeMap: this.cloneContextEventRangeMap(rangeMap),
            rangeInitialMap: this.cloneContextEventRangeMap(rangeMap),
            rangeBounds: this.contextEventRangeEditBounds(rangeMap)
        };
        if (type === 'shift' || type === 'originY') this.applyContextEventAdjustState(this.contextEventAdjustState, false);
        this.updateContextEventAdjustVisual();
        if (type === 'shift') this.msg('Shift調整: ←→↑↓で1px / Escで終了');
        else if (type === 'originY') this.msg('OriginY調整: ↑↓で1px / Escで終了');
        else this.msg('当たり判定設定: 赤=有効 / クリックで切替 / Enterで確定 / Escで取消');
    };

    EE.prototype.beginContextEventShiftAdjust = function() {
        this.beginContextEventAdjustMode('shift');
    };

    EE.prototype.beginContextEventOriginYAdjust = function() {
        this.beginContextEventAdjustMode('originY');
    };

    EE.prototype.beginContextEventRangeAdjust = function() {
        this.beginContextEventAdjustMode('range');
    };

    EE.prototype.toggleContextEventRangeCell = function(ix, iy) {
        var st = this.contextEventAdjustState;
        if (!st || String(st.type || '') !== 'range') return false;
        if (!st.rangeMap || typeof st.rangeMap !== 'object') st.rangeMap = Object.create(null);
        var key = this.contextEventRangeMapKey(ix, iy);
        if (st.rangeMap[key]) delete st.rangeMap[key];
        else st.rangeMap[key] = true;
        return true;
    };

    EE.prototype.confirmContextEventRangeAdjust = function() {
        var st = this.contextEventAdjustState;
        if (!st || String(st.type || '') !== 'range') return false;
        var eventId = Math.max(1, Math.floor(Number(st.eventId || 0)));
        var evData = this.contextEventAdjustEventData(eventId);
        var ev = this.contextEventAdjustEventObject(eventId);
        if (!evData || !ev) return false;
        var prevNote = String(evData.note || '');
        var nextNote = this.upsertContextRangeInNote(prevNote, st.rangeMap || Object.create(null));
        if (nextNote !== prevNote) {
            evData.note = nextNote;
            if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.extractMetadata === 'function') {
                try { DataManager.extractMetadata(evData); } catch (_) {}
            }
            if (typeof ev.refresh === 'function') {
                try { ev.refresh(); } catch (_) {}
            }
            this.contextEventAdjustMarkDirty(eventId);
            if (this.eventSettingsModal && this.eventSettingsModal.classList &&
                this.eventSettingsModal.classList.contains('on') &&
                Math.floor(Number(this.eventSettingsTargetEventId || 0)) === eventId &&
                this.eventSettingsNoteInput) {
                this.eventSettingsNoteInput.value = nextNote;
            }
        }
        this.endContextEventAdjustMode(true);
        this.refreshCharacterOverlay(true);
        this.refreshSelectedCharacterInfo(true);
        this.msg('当たり判定を保存');
        return true;
    };

    EE.prototype.cancelContextEventRangeAdjust = function() {
        var st = this.contextEventAdjustState;
        if (!st || String(st.type || '') !== 'range') return false;
        this.endContextEventAdjustMode(true);
        this.msg('当たり判定設定をキャンセル');
        return true;
    };

    EE.prototype.onContextEventRangeLayerClick = function(e) {
        // Range cells are toggled on mousedown (immediate), because this layer is
        // re-rendered every frame and click (up) may miss after DOM replacement.
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    EE.prototype.onContextEventRangeCellMouseDown = function(e, ix, iy) {
        var st = this.contextEventAdjustState;
        if (!st || String(st.type || '') !== 'range') return;
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!this.toggleContextEventRangeCell(ix, iy)) return;
        this.updateContextEventAdjustVisual();
    };

    EE.prototype.handleContextEventAdjustKeyDown = function(e, isTypingTarget) {
        var st = this.contextEventAdjustState;
        if (!st || typeof st !== 'object') return false;
        var key = String(e && e.key || '');
        if (key === 'Escape') {
            e.preventDefault();
            if (String(st.type || '') === 'range') this.cancelContextEventRangeAdjust();
            else this.endContextEventAdjustMode(false);
            return true;
        }
        if (String(st.type || '') === 'range') {
            if (key === 'Enter') {
                e.preventDefault();
                this.confirmContextEventRangeAdjust();
                return true;
            }
            return false;
        }
        if (isTypingTarget || !e || e.ctrlKey || e.altKey || e.metaKey) return false;
        var changed = false;
        if (st.type === 'shift') {
            if (key === 'ArrowLeft') st.shiftX -= 1, changed = true;
            else if (key === 'ArrowRight') st.shiftX += 1, changed = true;
            else if (key === 'ArrowUp') st.shiftY -= 1, changed = true;
            else if (key === 'ArrowDown') st.shiftY += 1, changed = true;
        } else if (st.type === 'originY') {
            var step = this.contextEventAdjustOriginStepPercent(st.eventId);
            if (key === 'ArrowUp') st.originY += step, changed = true;
            else if (key === 'ArrowDown') st.originY -= step, changed = true;
        }
        if (!changed) return false;
        e.preventDefault();
        this.applyContextEventAdjustState(st, true);
        this.updateContextEventAdjustVisual();
        return true;
    };

    EE.prototype.updateContextEventAdjustVisual = function() {
        var st = this.contextEventAdjustState;
        if (!st || typeof st !== 'object') {
            this.hideContextEventAdjustVisual();
            return;
        }
        if (String(st.type || '') === 'range') {
            if (!this.contextEventRangeLayer || !this.contextEventRangeLayer.style) return;
            var ev = this.contextEventAdjustEventObject(st.eventId);
            if (!ev || !st.rangeBounds) {
                this.hideContextEventAdjustVisual();
                return;
            }
            var unit = this.contextEventRangeUnit();
            var baseX = Number(ev.x || 0);
            var baseY = Number(ev.y || 0);
            var bnd = st.rangeBounds;
            var frag = document.createDocumentFragment();
            for (var iy = Math.floor(Number(bnd.minY || 0)); iy <= Math.floor(Number(bnd.maxY || 0)); iy++) {
                for (var ix = Math.floor(Number(bnd.minX || 0)); ix <= Math.floor(Number(bnd.maxX || 0)); ix++) {
                    var sr = this.mapRectToScreen(baseX + ix * unit, baseY + iy * unit, unit, unit);
                    if (!sr) continue;
                    var cw = Math.max(4, Math.floor(Number(sr.w || 0)));
                    var ch = Math.max(4, Math.floor(Number(sr.h || 0)));
                    var cell = this.el('div', 'radjcell' + (st.rangeMap && st.rangeMap[this.contextEventRangeMapKey(ix, iy)] ? ' on' : ''));
                    cell.setAttribute('data-range-cell', '1');
                    cell.setAttribute('data-ix', String(ix));
                    cell.setAttribute('data-iy', String(iy));
                    cell.style.left = Math.floor(Number(sr.x || 0)) + 'px';
                    cell.style.top = Math.floor(Number(sr.y || 0)) + 'px';
                    cell.style.width = cw + 'px';
                    cell.style.height = ch + 'px';
                    (function(cix, ciy) {
                        cell.addEventListener('mousedown', function(ev2) {
                            this.onContextEventRangeCellMouseDown(ev2, cix, ciy);
                        }.bind(this));
                        cell.addEventListener('click', function(ev2) {
                            ev2.preventDefault();
                            ev2.stopPropagation();
                        });
                    }).call(this, ix, iy);
                    frag.appendChild(cell);
                }
            }
            this.contextEventRangeLayer.innerHTML = '';
            this.contextEventRangeLayer.appendChild(frag);
            this.contextEventRangeLayer.style.display = 'block';
            if (this.contextEventOriginLine && this.contextEventOriginLine.style) this.contextEventOriginLine.style.display = 'none';
            return;
        }
        var type = String(st.type || '');
        if (type !== 'originY' && type !== 'shift') {
            this.hideContextEventAdjustVisual();
            return;
        }
        if (!this.contextEventOriginLine || !this.contextEventOriginLine.style) return;
        var sp = this.contextEventAdjustRuntimeSprite(st.eventId);
        if (!sp || typeof sp.getBounds !== 'function') {
            this.hideContextEventAdjustVisual();
            return;
        }
        var b = sp.getBounds();
        var bx = Number(b && b.x || 0);
        var by = Number(b && b.y || 0);
        var bw = Math.max(1, Number(b && b.width || 0));
        var bh = Math.max(1, Number(b && b.height || 0));
        var sr = this.canvasToScreenRect(bx, by + bh, bw, 1);
        if (!sr) {
            this.hideContextEventAdjustVisual();
            return;
        }
        var lineW = Math.max(24, Math.floor(Number(sr.w || 0)));
        this.contextEventOriginLine.style.display = 'block';
        this.contextEventOriginLine.style.left = Math.floor(Number(sr.x || 0)) + 'px';
        this.contextEventOriginLine.style.top = Math.floor(Number(sr.y || 0)) + 'px';
        this.contextEventOriginLine.style.width = lineW + 'px';
        if (this.contextEventOriginLineLabel) {
            if (type === 'originY') {
                this.contextEventOriginLineLabel.textContent =
                    'OriginY=' + this.formatContextEventAdjustNumber(st.originY, 3) + ' (↑↓ 1px / Esc)';
            } else {
                this.contextEventOriginLineLabel.textContent =
                    'Shift X=' + String(Math.round(Number(st.shiftX || 0))) +
                    ' / Y=' + String(Math.round(Number(st.shiftY || 0))) +
                    ' (←→↑↓ 1px / Esc)';
            }
        }
    };

    EE.prototype.closeCameraContextMenu = function() {
        if (this.cameraCtx) this.cameraCtx.classList.remove('on');
        this.closeMapCreateContextMenu();
    };

    EE.prototype.closeMapCreateContextMenu = function() {
        if (this.mapCreateCtx) this.mapCreateCtx.classList.remove('on');
        this.mapCreateCtxMapX = 0;
        this.mapCreateCtxMapY = 0;
    };

    EE.prototype.updateMapCreateContextPointFromScreen = function(screenX, screenY) {
        var cp = this.screenPointToCanvas(Number(screenX || 0), Number(screenY || 0));
        var mp = cp ? this.screenToMap(cp.x, cp.y, true) : null;
        this.mapCreateCtxMapX = Number(mp && mp.x != null ? mp.x : 0);
        this.mapCreateCtxMapY = Number(mp && mp.y != null ? mp.y : 0);
        return mp;
    };

    EE.prototype.placeMenuInViewport = function(menu, screenX, screenY, pad) {
        if (!menu) return;
        pad = Math.max(0, Math.floor(Number(pad == null ? 4 : pad) || 0));
        var ww = Math.max(1, Math.floor(Number(window.innerWidth || 1)));
        var wh = Math.max(1, Math.floor(Number(window.innerHeight || 1)));
        var x = Math.max(pad, Math.floor(Number(screenX || 0)));
        var y = Math.max(pad, Math.floor(Number(screenY || 0)));
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        var rect = menu.getBoundingClientRect ? menu.getBoundingClientRect() : null;
        var mw = Math.max(1, Math.ceil(Number(rect && rect.width || menu.offsetWidth || 1)));
        var mh = Math.max(1, Math.ceil(Number(rect && rect.height || menu.offsetHeight || 1)));
        var maxX = Math.max(pad, ww - mw - pad);
        var maxY = Math.max(pad, wh - mh - pad);
        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;
        if (x < pad) x = pad;
        if (y < pad) y = pad;
        menu.style.left = Math.floor(x) + 'px';
        menu.style.top = Math.floor(y) + 'px';
    };

    EE.prototype.cameraContextMapPointIsValid = function(mapPoint) {
        if (!$dataMap || !Array.isArray($dataMap.events)) return false;
        if (!mapPoint || typeof mapPoint !== 'object') return false;
        var x = Number(mapPoint.x);
        var y = Number(mapPoint.y);
        if (!isFinite(x) || !isFinite(y)) return false;
        var w = Math.max(0, Math.floor(Number($dataMap.width || 0)));
        var h = Math.max(0, Math.floor(Number($dataMap.height || 0)));
        if (w <= 0 || h <= 0) return false;
        return x >= 0 && y >= 0 && x < w && y < h;
    };

    EE.prototype.openMapCreateContextMenu = function(screenX, screenY, mapPoint) {
        if (!this.mapCreateCtx || !this.mapCreateCtxCreateBtn) return;
        var canCreateEvent = this.cameraContextMapPointIsValid(mapPoint);
        this.mapCreateCtxCreateBtn.disabled = !canCreateEvent;
        this.mapCreateCtxCreateBtn.textContent = canCreateEvent ? 'イベント新規作成' : 'イベント新規作成(範囲外)';
        this.mapCreateCtxMapX = Number(mapPoint && mapPoint.x != null ? mapPoint.x : 0);
        this.mapCreateCtxMapY = Number(mapPoint && mapPoint.y != null ? mapPoint.y : 0);
        this.mapCreateCtx.classList.add('on');
        this.placeMenuInViewport(this.mapCreateCtx, Number(screenX || 0) + 20, screenY, 4);
    };

    EE.prototype.nextAvailableMapEventId = function() {
        var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : null;
        if (!evs) return 0;
        for (var i = 1; i < evs.length; i++) {
            if (!evs[i]) return i;
        }
        return Math.max(1, evs.length);
    };

    EE.prototype.hasHalfTileOffset = function(value) {
        value = Number(value);
        if (!isFinite(value)) return false;
        var frac = value - Math.floor(value);
        return Math.abs(frac - 0.5) <= 1e-4;
    };

    EE.prototype.mapPointToEventPlacement = function(mapPoint) {
        var rawX = Number(mapPoint && mapPoint.x != null ? mapPoint.x : 0);
        var rawY = Number(mapPoint && mapPoint.y != null ? mapPoint.y : 0);
        if (!isFinite(rawX)) rawX = 0;
        if (!isFinite(rawY)) rawY = 0;
        var x = Math.max(0, Math.floor(rawX));
        var y = Math.max(0, Math.floor(rawY));
        var noteLines = [];
        if (this.hasHalfTileOffset(rawX)) noteLines.push('<HM初期半歩X:+>');
        if (this.hasHalfTileOffset(rawY)) noteLines.push('<HM初期半歩Y:+>');
        return {
            x: x,
            y: y,
            note: noteLines.join('\n')
        };
    };

    EE.prototype.buildDefaultMapEventData = function(eventId, x, y, note) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        x = Math.max(0, Math.floor(Number(x || 0)));
        y = Math.max(0, Math.floor(Number(y || 0)));
        note = note == null ? '' : String(note);
        var page = (typeof this.eventSettingsDefaultPageData === 'function')
            ? this.eventSettingsDefaultPageData()
            : this.eventSettingsEnsurePage({});
        return {
            id: eventId,
            name: 'EV' + ('000' + eventId).slice(-3),
            note: note,
            meta: {},
            pages: [page],
            x: x,
            y: y
        };
    };

    EE.prototype.ensureRuntimeEventDataMetadata = function(evData) {
        if (!evData || typeof evData !== 'object') return;
        if (evData.note == null) evData.note = '';
        if (!evData.meta || typeof evData.meta !== 'object') evData.meta = {};
        if (!evData.metaArray || typeof evData.metaArray !== 'object') {
            if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.extractMetadata === 'function') {
                try { DataManager.extractMetadata(evData); } catch (_) {}
            }
            if (!evData.meta || typeof evData.meta !== 'object') evData.meta = {};
            if (!evData.metaArray || typeof evData.metaArray !== 'object') evData.metaArray = {};
        }
    };

    EE.prototype.attachRuntimeMapEventSprite = function(eventObj, eventId) {
        if (!eventObj || typeof Sprite_Character === 'undefined') return null;
        var ss = this.s && this.s._spriteset;
        var ls = ss && ss._characterSprites;
        if (!ss || !Array.isArray(ls)) return null;
        for (var i = 0; i < ls.length; i++) {
            var sp = ls[i];
            var ch = sp && sp._character;
            if (!ch || typeof ch.eventId !== 'function') continue;
            if (Math.floor(Number(ch.eventId() || 0)) === Math.floor(Number(eventId || 0))) return sp;
        }
        var sprite = new Sprite_Character(eventObj);
        ls.push(sprite);
        if (ss._tilemap && ss._tilemap.addChild) ss._tilemap.addChild(sprite);
        if (ss._tilemap && typeof ss._tilemap._sortChildren === 'function') ss._tilemap._sortChildren();
        return sprite;
    };

    EE.prototype.attachRuntimeMapEvent = function(eventId) {
        if (!$gameMap || typeof Game_Event === 'undefined') return null;
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eventId] : null;
        this.ensureRuntimeEventDataMetadata(evData);
        var mapId = Math.max(1, Math.floor(Number($gameMap.mapId ? $gameMap.mapId() : 0)));
        if (!Array.isArray($gameMap._events)) $gameMap._events = [];
        var evObj = null;
        try {
            evObj = new Game_Event(mapId, eventId);
        } catch (e) {
            if (typeof this.err === 'function') this.err('E_CREATE_RUNTIME_EVENT', e);
            evObj = null;
        }
        if (!evObj) return null;
        $gameMap._events[eventId] = evObj;
        try { if (typeof evObj.refresh === 'function') evObj.refresh(); } catch (_) {}
        // Invalidate map event caches used by custom map-event optimization plugins.
        if (Object.prototype.hasOwnProperty.call($gameMap, '_nearEvents')) $gameMap._nearEvents = [];
        if (Object.prototype.hasOwnProperty.call($gameMap, '_periEvents')) $gameMap._periEvents = [];
        if (Object.prototype.hasOwnProperty.call($gameMap, '_lastPlayerXyInfo')) $gameMap._lastPlayerXyInfo = null;
        if (Object.prototype.hasOwnProperty.call($gameMap, '_lastPlayerXyInfo2')) $gameMap._lastPlayerXyInfo2 = null;
        this.attachRuntimeMapEventSprite(evObj, eventId);
        if (typeof $gameMap.rejudgeEvents === 'function') {
            try { $gameMap.rejudgeEvents(); } catch (_) {}
        }
        return evObj;
    };

    EE.prototype.createMapEventFromContextMenu = function() {
        var mapPoint = {
            x: Number(this.mapCreateCtxMapX),
            y: Number(this.mapCreateCtxMapY)
        };
        this.closeMapCreateContextMenu();
        if (!this.cameraContextMapPointIsValid(mapPoint)) {
            this.msg('イベント作成不可: マップ範囲外です');
            return;
        }
        var eventId = this.nextAvailableMapEventId();
        if (eventId <= 0) {
            this.msg('イベント作成に失敗しました');
            return;
        }
        var placement = this.mapPointToEventPlacement(mapPoint);
        $dataMap.events[eventId] = this.buildDefaultMapEventData(eventId, placement.x, placement.y, placement.note);
        this.ensureRuntimeEventDataMetadata($dataMap.events[eventId]);
        var evObj = this.attachRuntimeMapEvent(eventId);
        if (!evObj || !($gameMap && typeof $gameMap.event === 'function' && $gameMap.event(eventId))) {
            this.msg('イベント新規作成: ランタイム反映に失敗 (ID:' + eventId + ')');
            return;
        }
        var key = this.key(eventId, 0);
        this.ensureTrack(eventId, 0);
        this.dirty[key] = true;
        if (this.base && this.base.ev && evObj && typeof this.capCh === 'function') {
            try { this.base.ev[eventId] = this.capCh(evObj); } catch (_) {}
        }
        if ($gameMap && typeof $gameMap.requestRefresh === 'function') $gameMap.requestRefresh();
        // Keep current selection intact when creating a new event from map context.
        this.refreshEventInfo();
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        this.msg('イベント新規作成: ID:' + eventId + ' (' + placement.x + ', ' + placement.y + ')');
    };

    EE.prototype.openCameraContextMenu = function(screenX, screenY, mapPoint) {
        if (!this.cameraCtx || !this.cameraCtxScrollBtn || !this.cameraCtxScrollToBtn) return;
        var hasTrack = !!(this.selEid && this.selPage >= 0 && this.selKey);
        this.cameraCtxScrollBtn.disabled = !hasTrack;
        this.cameraCtxScrollToBtn.disabled = !hasTrack;
        this.cameraCtxScrollBtn.textContent = hasTrack ? 'カメラ移動' : 'イベント未選択';
        this.cameraCtxScrollToBtn.textContent = hasTrack ? 'カメラ移動(直接指定)' : 'イベント未選択';
        this.cameraCtxMapX = Number(mapPoint && mapPoint.x != null ? mapPoint.x : 0);
        this.cameraCtxMapY = Number(mapPoint && mapPoint.y != null ? mapPoint.y : 0);
        this.cameraCtx.classList.add('on');
        this.placeMenuInViewport(this.cameraCtx, Number(screenX || 0) + 20, screenY, 4);
    };

    EE.prototype.contextMenuCharIdFromTarget = function(target) {
        var n = target;
        while (n && n !== document && n !== window) {
            if (n.getAttribute) {
                var raw = n.getAttribute('data-char-id');
                if (raw != null && String(raw).length) {
                    var id = Number(raw);
                    if (isFinite(id)) return this.normalizeMoveTarget(id);
                }
            }
            if (n === this.root) break;
            n = n.parentNode;
        }
        return null;
    };

    EE.prototype.onGameFrameContextMenu = function(e) {
        if (!this.on || !this.root) return;
        e.preventDefault();
        e.stopPropagation();
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        var mp = null;
        var cp = this.screenPointToCanvas(Number(e.clientX || 0), Number(e.clientY || 0));
        if (cp) mp = this.screenToMap(cp.x, cp.y, true);
        var onFrameBorder = this.isPointOnGameFrameBorder(Number(e.clientX || 0), Number(e.clientY || 0));
        if (onFrameBorder) {
            this.openCameraContextMenu(e.clientX, e.clientY, mp);
            return;
        }
        var inViewport = this.isPointInFixedViewportRect(Number(e.clientX || 0), Number(e.clientY || 0));
        var hitCharId = this.contextMenuCharIdFromTarget(e.target);
        if (typeof this.pickCharacterIdAtScreen === 'function') {
            if (hitCharId == null) {
                if (cp) hitCharId = this.pickCharacterIdAtScreen(Number(cp.x || 0), Number(cp.y || 0));
                else hitCharId = this.pickCharacterIdAtScreen(Number(e.clientX || 0), Number(e.clientY || 0));
            }
        }
        if (inViewport && hitCharId != null) {
            this.selectCharacterForTimeline(hitCharId, 'map');
            this.openCharContextMenu(hitCharId, e.clientX, e.clientY);
        } else if (inViewport && hitCharId == null && this.cameraContextMapPointIsValid(mp)) {
            this.openMapCreateContextMenu(e.clientX, e.clientY, mp);
        } else {
            this.openCameraContextMenu(e.clientX, e.clientY, mp);
        }
    };

    EE.prototype.addCameraMoveCommandFromContextMenu = function(kind) {
        this.closeCameraContextMenu();
        if (!this.needSelTrack()) return;
        kind = (String(kind || '') === 'scrollTo') ? 'scrollTo' : 'scroll';
        var x = 0;
        var y = 0;
        if (kind === 'scrollTo') {
            var hasPicked = isFinite(Number(this.cameraCtxMapX)) && isFinite(Number(this.cameraCtxMapY));
            if (hasPicked) {
                x = Number(this.cameraCtxMapX || 0);
                y = Number(this.cameraCtxMapY || 0);
            } else {
                x = Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0);
                y = Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0);
            }
        }
        var script = this.makeCameraMoveScript(kind, x, y, 60);
        var added = this.addCmd({ code: 355, indent: 0, parameters: [script] }, this.frame);
        if (!added) return;
        this.openEditor(Number(added.uid || 0));
    };

    EE.prototype.isAnyContextMenuOpen = function() {
        if (this.routeCtx && this.routeCtx.classList && this.routeCtx.classList.contains('on')) return true;
        if (this.charCtx && this.charCtx.classList && this.charCtx.classList.contains('on')) return true;
        if (this.cameraCtx && this.cameraCtx.classList && this.cameraCtx.classList.contains('on')) return true;
        if (this.mapCreateCtx && this.mapCreateCtx.classList && this.mapCreateCtx.classList.contains('on')) return true;
        return false;
    };

    EE.prototype.closeRouteRangeContextMenu = function() {
        this.routeRangeCtxUid = 0;
        this.routeCtxMode = 'route';
        this.routeCtxSqueezeEnabled = false;
        this.routeCtxWaitArrangeEnabled = false;
        this.routeCtxMergeEnabled = false;
        this.routeCtxMessageBubbleBulkEnabled = false;
        this.routeCtxWaitInsertContext = null;
        if (this.routeCtx) this.routeCtx.classList.remove('on');
    };

    EE.prototype.openMemoCreateFromContextMenu = function() {
        if (!this.needSelTrack()) return;
        var ctx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        var frame = this.frame;
        if (ctx && ctx.frame != null) frame = ctx.frame;
        else if (ctx && ctx.frameStart != null) frame = ctx.frameStart;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        this.closeRouteRangeContextMenu();
        this.openMemoEditorForNew(frame);
    };

    EE.prototype.openFrameAddCommandFromContextMenu = function() {
        if (!this.needSelTrack()) return;
        var ctx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        if (String(ctx.source || '') !== 'frame') return;
        var frame = Math.max(0, Math.floor(Number(ctx.frame || 0)));
        var rowKey = String(ctx.rowKey || 'main');
        this.closeRouteRangeContextMenu();
        if (rowKey.indexOf('char:') === 0) {
            this.openRouteCommandPanel(frame, rowKey);
            return;
        }
        if (this.isFrameLockedForFrameCommandAdd(frame)) return;
        this.openAddCommandPanel(frame, 'main', this.makeAddPlacementContextFromFrame(frame));
    };

    EE.prototype.openRelativeAddCommandFromContextMenu = function(pos) {
        if (!this.needSelTrack()) return;
        pos = (String(pos || 'before') === 'after') ? 'after' : 'before';
        var ctx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        var src = String(ctx.source || '');
        if (src !== 'command' && src !== 'routeCmd') return;
        var placement = this.makeAddPlacementContextFromWaitInsertContext(ctx, pos);
        var previewFrame = this.computeAddFrameFromPlacementContext(placement, 0);
        this.closeRouteRangeContextMenu();
        if (src === 'routeCmd') {
            var re = this.findEntryInSelectedTrack(Math.floor(Number(ctx.uid || 0)));
            if (re && re.command && Number(re.command.code || 0) === 205 && String(re.rowKey || '').indexOf('char:') === 0) {
                this.openRouteCommandPanel(previewFrame, re.rowKey, placement);
                return;
            }
        }
        this.openAddCommandPanel(previewFrame, 'main', placement);
    };

    EE.prototype.shiftSelectedTrackEndFrameFromContextMenu = function(deltaFrames) {
        this.closeRouteRangeContextMenu();
        if (!this.needSelTrack()) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return false;
        deltaFrames = Math.floor(Number(deltaFrames || 0));
        if (!isFinite(deltaFrames) || deltaFrames === 0) return false;
        var oldEnd = this.normalizeTrackEndFrame(tr);
        var minEnd = this.trackComputedEndFrame(tr);
        var nextEnd = Math.max(minEnd, oldEnd + deltaFrames);
        if (nextEnd === oldEnd) {
            this.seek(oldEnd);
            this.msg('終了位置は変更なし');
            return true;
        }
        this.pushSnap('endMarker');
        tr.endFrame = nextEnd;
        this.normalizeTrackEndFrame(tr);
        this.dirty[this.selKey] = true;
        this.seek(nextEnd);
        this.msg('終了位置: ' + nextEnd + 'f');
        return true;
    };

    EE.prototype.snapSelectedTrackEndFrameToLastCommandFromContextMenu = function() {
        this.closeRouteRangeContextMenu();
        if (!this.needSelTrack()) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return false;
        var oldEnd = this.normalizeTrackEndFrame(tr);
        var nextEnd = Math.max(0, Math.floor(Number(this.trackComputedEndFrame(tr) || 0)));
        if (nextEnd === oldEnd) {
            this.seek(oldEnd);
            this.msg('終了位置: 最後のコマンド位置');
            return true;
        }
        this.pushSnap('endMarker');
        tr.endFrame = nextEnd;
        this.normalizeTrackEndFrame(tr);
        this.dirty[this.selKey] = true;
        this.seek(nextEnd);
        this.msg('終了位置: 最後のコマンド位置 (' + nextEnd + 'f)');
        return true;
    };

    EE.prototype.isSameFrameReorderTargetEntry = function(entry) {
        if (!entry || !entry.command) return false;
        var rk = String(entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main'));
        if (rk !== 'main') return false;
        var code = Math.floor(Number(entry.command.code || 0));
        // Exclude note comments and move-route commands from ▲▼ reorder targets.
        if (code === 108 || code === 205) return false;
        return true;
    };

    EE.prototype.sameFrameCommandMoveInfo = function(uid) {
        var out = { show: false, canPrev: false, canNext: false, uid: Math.floor(Number(uid || 0)), frame: 0 };
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return out;
        var tr = (this.model && this.model.tracks) ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return out;
        var e = this.findEntryInSelectedTrack(out.uid);
        if (!e) return out;
        if (!this.isSameFrameReorderTargetEntry(e)) return out;
        out.frame = Math.max(0, Math.floor(Number(e.frame || 0)));
        if (Math.max(0, Math.floor(Number(e.wait || 0))) > 0) return out;
        var ordered = tr.commands.filter(function(ce) {
            return ce &&
                this.isSameFrameReorderTargetEntry(ce) &&
                Math.max(0, Math.floor(Number(ce.frame || 0))) === out.frame &&
                Math.max(0, Math.floor(Number(ce.wait || 0))) <= 0;
        }, this).sort(compareEntriesByFrameWaitUid);
        if (ordered.length <= 1) return out;
        var idx = -1;
        for (var i = 0; i < ordered.length; i++) {
            if (Number(ordered[i].uid || 0) === out.uid) { idx = i; break; }
        }
        if (idx < 0) return out;
        out.show = true;
        out.canPrev = idx > 0;
        out.canNext = idx >= 0 && idx < ordered.length - 1;
        return out;
    };

    EE.prototype.moveSameFrameCommand = function(uid, dir) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return false;
        var info = this.sameFrameCommandMoveInfo(uid);
        if (!info.show) return false;
        dir = (String(dir || 'prev') === 'next') ? 'next' : 'prev';
        if (dir === 'prev' && !info.canPrev) return false;
        if (dir === 'next' && !info.canNext) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        var ordered = tr.commands.filter(function(ce) {
            return ce &&
                this.isSameFrameReorderTargetEntry(ce) &&
                Math.max(0, Math.floor(Number(ce.frame || 0))) === info.frame &&
                Math.max(0, Math.floor(Number(ce.wait || 0))) <= 0;
        }, this).sort(compareEntriesByFrameWaitUid);
        var idx = -1;
        for (var i = 0; i < ordered.length; i++) {
            if (Number(ordered[i].uid || 0) === uid) { idx = i; break; }
        }
        if (idx < 0) return false;
        var target = (dir === 'prev') ? ordered[idx - 1] : ordered[idx + 1];
        var selfEntry = this.findEntryInSelectedTrack(uid);
        if (!selfEntry || !target) return false;
        this.pushSnap('reorderFrame');
        this.swapCommandUids(tr, selfEntry, target);
        tr.commands.sort(compareEntriesByFrameWaitUid);
        this.selUid = Number(selfEntry.uid || 0);
        this.selRouteListIndex = -1;
        this.frame = Math.max(0, Math.floor(Number(selfEntry.frame || info.frame || this.frame || 0)));
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        return true;
    };

    EE.prototype.hasTimelineNudgeTarget = function() {
        if (this.hasRangeSelection && this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            if (Array.isArray(rs.items) && rs.items.length > 0) return true;
        }
        return Number(this.selUid || 0) > 0;
    };

    EE.prototype.shiftCurrentRangeSelectionByFrames = function(delta) {
        if (!(this.hasRangeSelection && this.hasRangeSelection())) return;
        delta = Math.floor(Number(delta || 0));
        if (!delta) return;
        var rs = this.rangeSelection || {};
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        rs.frameStart = Math.max(0, fs + delta);
        rs.frameEnd = Math.max(rs.frameStart, fe + delta);
        var shiftPx = Number(this.pxPerFrame || 0) * delta;
        if (Math.abs(shiftPx) > 1e-7 && Array.isArray(rs.rects)) {
            var minX = Number(this.labelW || 0);
            for (var i = 0; i < rs.rects.length; i++) {
                var rc = rs.rects[i];
                if (!rc) continue;
                rc.x1 = Math.max(minX, Number(rc.x1 || 0) + shiftPx);
                rc.x2 = Math.max(minX, Number(rc.x2 || 0) + shiftPx);
            }
        }
        this.timelineDirty = true;
    };

    EE.prototype.nudgeRouteCmdItemsByFrames = function(routeItems, delta, fromRangeSelection) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        routeItems = this.normalizeRangeSelectionItems(routeItems || []).filter(function(it) {
            return it && String(it.kind || '') === 'routeCmd';
        });
        if (!routeItems.length) return false;
        var uid0 = Math.floor(Number(routeItems[0].uid || 0));
        if (uid0 <= 0) return false;
        for (var i = 1; i < routeItems.length; i++) {
            if (Math.floor(Number(routeItems[i].uid || 0)) !== uid0) return false;
        }
        var entry = this.findEntryInSelectedTrack(uid0);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return false;
        var preview = this.buildRangeMoveRoutePreview({
            kind: 'routeCmd',
            routeItems: routeItems,
            previewRouteUid: uid0
        }, delta);
        if (!preview || !preview.valid || !Array.isArray(preview.blocks)) return false;
        this.pushSnap('nudgeRoute');
        var route = entry.command.parameters && entry.command.parameters[1];
        if (!route || typeof route !== 'object') route = this.defaultMoveRoute();
        route.list = this.routeListFromBlocks(preview.blocks);
        if (!Array.isArray(entry.command.parameters)) entry.command.parameters = [entry.charId || 0, route];
        entry.command.parameters[1] = route;
        entry.wait = this.commandWaitFrames(entry.command);
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (tr && Array.isArray(tr.commands)) tr.commands.sort(compareEntriesByFrameWaitUid);
        if (fromRangeSelection && this.hasRangeSelection && this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            var kind = String(rs.kind || 'rect');
            if (kind !== 'memory' && kind !== 'rect') kind = 'rect';
            var nextSel = [];
            for (i = 0; i < preview.selectedListIndexes.length; i++) {
                nextSel.push({ kind: 'routeCmd', uid: uid0, routeListIndex: this.nodeRouteIndex(preview.selectedListIndexes[i]) });
            }
            this.setRangeSelection(kind, nextSel, {
                frameStart: Math.max(0, Math.floor(Number(rs.frameStart || 0))),
                frameEnd: Math.max(0, Math.floor(Number(rs.frameEnd || 0))),
                rects: Array.isArray(rs.rects) ? clone(rs.rects) : [],
                nonContiguous: !!rs.nonContiguous
            });
            this.shiftCurrentRangeSelectionByFrames(delta);
        } else {
            this.selUid = uid0;
            this.selRouteListIndex = preview.selectedListIndexes.length ? this.nodeRouteIndex(preview.selectedListIndexes[0]) : -1;
            var sit = this.routeCommandTimelineItemByListIndex(entry, this.selRouteListIndex);
            if (sit) {
                this.frame = Math.max(0, Math.floor(Number(entry.frame || 0)) + Math.max(0, Math.floor(Number(sit.offset || 0))));
            } else {
                this.frame = Math.max(0, Math.floor(Number(entry.frame || this.frame || 0)));
            }
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.nudgeEntriesByFrames = function(entryUids, delta, fromRangeSelection) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var seen = Object.create(null);
        var moved = [];
        entryUids = Array.isArray(entryUids) ? entryUids : [];
        for (var i = 0; i < entryUids.length; i++) {
            var uid = Math.floor(Number(entryUids[i] || 0));
            if (uid <= 0 || seen[uid]) continue;
            seen[uid] = true;
            var e = this.findEntryInSelectedTrack(uid);
            if (!e) continue;
            var nf = Math.floor(Number(e.frame || 0)) + delta;
            if (nf < 0) return false;
            var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            moved.push({ entry: e, frame: nf, rowKey: rk });
        }
        if (!moved.length) return false;
        if (!this.batchCanPlaceEntries(tr, moved)) return false;
        this.pushSnap('nudgeEntry');
        var selFrame = null;
        for (i = 0; i < moved.length; i++) {
            var it = moved[i];
            if (!it || !it.entry) continue;
            var de = it.entry;
            de.frame = Math.max(0, Math.floor(Number(it.frame || 0)));
            if (Number(de.uid || 0) === Number(this.selUid || 0)) selFrame = de.frame;
        }
        tr.commands.sort(compareEntriesByFrameWaitUid);
        if (fromRangeSelection && this.hasRangeSelection && this.hasRangeSelection()) {
            this.shiftCurrentRangeSelectionByFrames(delta);
        } else if (selFrame != null) {
            this.frame = Math.max(0, Math.floor(Number(selFrame || 0)));
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.nudgeSelectedTimelineByFrames = function(delta) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        if (!this.selKey || !this.model || !this.model.tracks) return false;
        var tr = this.model.tracks[this.selKey];
        if (!tr || !Array.isArray(tr.commands)) return false;
        var hasRange = !!(this.hasRangeSelection && this.hasRangeSelection());
        var routeItems = hasRange ? this.selectedRouteCmdItemsFromRange() : [];
        var entryUids = hasRange ? this.selectedEntryUidsFromRange() : [];
        if (!hasRange || (!routeItems.length && !entryUids.length)) {
            var uid = Math.floor(Number(this.selUid || 0));
            if (uid <= 0) return false;
            var rli = this.nodeRouteIndex(this.selRouteListIndex);
            if (rli >= 0) {
                routeItems = [{ kind: 'routeCmd', uid: uid, routeListIndex: rli }];
                entryUids = [];
            } else {
                routeItems = [];
                entryUids = [uid];
            }
            hasRange = false;
        }
        if (routeItems.length && !entryUids.length) {
            return this.nudgeRouteCmdItemsByFrames(routeItems, delta, hasRange);
        }
        return this.nudgeEntriesByFrames(entryUids, delta, hasRange);
    };

    EE.prototype.timelineClipboardCopyReasonText = function(reason) {
        reason = String(reason || '');
        if (reason === 'no_track') return 'イベント未選択です';
        if (reason === 'no_selection') return 'コマンドを選択してください';
        if (reason === 'no_entry_selection') return '選択範囲にコマンドがありません';
        if (reason === 'mixed_row_type') return 'メイン行とキャラ行の同時コピーはできません';
        if (reason === 'mixed_char_row') return '複数キャラ行の同時コピーはできません';
        return 'コピーできません';
    };

    EE.prototype.timelineClipboardPasteReasonText = function(reason) {
        reason = String(reason || '');
        if (reason === 'no_track') return 'イベント未選択です';
        if (reason === 'no_clipboard') return 'コピー済みコマンドがありません';
        if (reason === 'main_to_char_forbidden') return 'メイン→キャラへの貼り付けはできません';
        if (reason === 'char_to_main_forbidden') return 'キャラ→メインへの貼り付けはできません';
        if (reason === 'invalid_clipboard') return 'クリップボード形式が不正です';
        if (reason === 'invalid_entry') return '貼り付け対象のコマンド形式が不正です';
        if (reason === 'overlap') return '貼り付け先でコマンドが重なります';
        return '貼り付けできません';
    };

    EE.prototype.collectTimelineClipboardEntries = function() {
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return { ok: false, reason: 'no_track' };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return { ok: false, reason: 'no_track' };
        var uids = [];
        if (this.hasRangeSelection && this.hasRangeSelection()) {
            uids = this.selectedEntryUidsFromRange();
            if (!uids.length) return { ok: false, reason: 'no_entry_selection' };
        } else {
            var uid = Math.floor(Number(this.selUid || 0));
            if (uid <= 0) return { ok: false, reason: 'no_selection' };
            uids = [uid];
        }
        var uniq = Object.create(null);
        var out = [];
        for (var i = 0; i < uids.length; i++) {
            var u = Math.floor(Number(uids[i] || 0));
            if (u <= 0 || uniq[u]) continue;
            uniq[u] = true;
            var e = this.findEntryInSelectedTrack(u);
            if (!e || !e.command || Number(e.command.code || 0) <= 0) continue;
            out.push(e);
        }
        if (!out.length) return { ok: false, reason: 'no_selection' };
        out.sort(compareEntriesByFrameWaitUid);
        var first = out[0];
        var rowType = (first && first.rowType === 'char') ? 'char' : 'main';
        var rowKey = String(first.rowKey || (rowType === 'char' ? ('char:' + first.charId) : 'main'));
        if (rowType !== 'char') rowKey = 'main';
        for (i = 0; i < out.length; i++) {
            var re = out[i];
            var rt = (re && re.rowType === 'char') ? 'char' : 'main';
            if (rt !== rowType) return { ok: false, reason: 'mixed_row_type' };
            if (rowType === 'char') {
                var rk = String(re.rowKey || ('char:' + re.charId));
                if (rk !== rowKey) return { ok: false, reason: 'mixed_char_row' };
            }
        }
        return {
            ok: true,
            rowType: rowType,
            rowKey: rowKey,
            entries: out
        };
    };

    EE.prototype.buildTimelineClipboardFromSelection = function() {
        var picked = this.collectTimelineClipboardEntries();
        if (!picked.ok) return picked;
        var entries = picked.entries || [];
        var minFrame = Infinity;
        for (var i = 0; i < entries.length; i++) {
            var f = Math.max(0, Math.floor(Number(entries[i].frame || 0)));
            if (f < minFrame) minFrame = f;
        }
        if (!isFinite(minFrame)) minFrame = 0;
        var items = [];
        for (i = 0; i < entries.length; i++) {
            var e = entries[i];
            items.push({
                offsetFrame: Math.max(0, Math.floor(Number(e.frame || 0)) - minFrame),
                command: clone(e.command || { code: 0, indent: 0, parameters: [] }),
                entry: clone(e)
            });
        }
        var uidList = [];
        for (i = 0; i < entries.length; i++) uidList.push(Math.floor(Number(entries[i].uid || 0)));
        return {
            ok: true,
            clip: {
                type: 'timeline_entries_v1',
                rowType: picked.rowType,
                rowKey: picked.rowKey,
                anchorFrame: minFrame,
                items: items
            },
            sourceUids: uidList
        };
    };

    EE.prototype.currentTimelineRowKeyForPaste = function() {
        var uid = Math.floor(Number(this.selUid || 0));
        if (uid > 0) {
            var e = this.findEntryInSelectedTrack(uid);
            if (e) {
                var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
                if (rk.indexOf('char:') === 0) {
                    return 'char:' + this.normalizeMoveTarget(Number(rk.replace('char:', '')));
                }
            }
        }
        if (this.panelSelectedCharId != null) {
            return 'char:' + this.normalizeMoveTarget(Number(this.panelSelectedCharId || 0));
        }
        return 'main';
    };

    EE.prototype.timelinePasteTargetFromContext = function(ctx) {
        var base = this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        var c = this.resolveWaitInsertContext(ctx || base);
        var frame = 0;
        if (String(c.source || '') === 'selection') frame = Math.max(0, Math.floor(Number(this.frame || 0)));
        else frame = Math.max(0, Math.floor(Number(c.frame || this.frame || 0)));
        var rowKey = String(c.rowKey || '');
        if (rowKey.indexOf('char:') !== 0) rowKey = '';
        if (!rowKey && Number(c.uid || 0) > 0) {
            var e = this.findEntryInSelectedTrack(Math.floor(Number(c.uid || 0)));
            if (e) rowKey = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
        }
        if (rowKey.indexOf('char:') === 0) {
            rowKey = 'char:' + this.normalizeMoveTarget(Number(rowKey.replace('char:', '')));
        } else {
            rowKey = this.currentTimelineRowKeyForPaste();
            if (rowKey.indexOf('char:') !== 0) rowKey = 'main';
        }
        return { frame: frame, rowKey: rowKey };
    };

    EE.prototype.prepareTimelineClipboardEntriesForPaste = function(clip, target) {
        clip = (clip && typeof clip === 'object') ? clip : null;
        target = target || { frame: this.frame, rowKey: 'main' };
        if (!clip || clip.type !== 'timeline_entries_v1' || !Array.isArray(clip.items) || !clip.items.length) {
            return { ok: false, reason: 'invalid_clipboard' };
        }
        var rowType = String(clip.rowType || 'main') === 'char' ? 'char' : 'main';
        var rowKey = String(target.rowKey || 'main');
        if (rowType === 'main' && rowKey !== 'main') return { ok: false, reason: 'main_to_char_forbidden' };
        if (rowType === 'char' && rowKey.indexOf('char:') !== 0) return { ok: false, reason: 'char_to_main_forbidden' };
        var frameBase = Math.max(0, Math.floor(Number(target.frame || 0)));
        var charId = 0;
        if (rowType === 'char') charId = this.normalizeMoveTarget(Number(rowKey.replace('char:', '')));
        var out = [];
        for (var i = 0; i < clip.items.length; i++) {
            var it = clip.items[i];
            var ef = frameBase + Math.max(0, Math.floor(Number(it.offsetFrame || 0)));
            var e = null;
            if (it && it.entry && it.entry.command) {
                e = clone(it.entry);
                if (!e || !e.command) return { ok: false, reason: 'invalid_entry' };
                e.uid = -(i + 1);
                e.frame = ef;
                e.eventId = this.selEid;
                e.pageIndex = this.selPage;
                if (!Array.isArray(e.command.parameters)) e.command.parameters = [];
                var code = Number(e.command.code || 0);
                if (code <= 0) return { ok: false, reason: 'invalid_entry' };
                if (code === 101) {
                    if (!Array.isArray(e.messageLines)) e.messageLines = [];
                } else if (code === 108) {
                    if (!Array.isArray(e.commentLines) || !e.commentLines.length) {
                        e.commentLines = [String((e.command.parameters || [''])[0] || '')];
                    }
                    e.command.parameters = [String(e.commentLines[0] || '')];
                    this.memoApplyParsedStateToEntry(e);
                } else if (code === 355) {
                    if (!Array.isArray(e.scriptLines) || !e.scriptLines.length) {
                        e.scriptLines = [String((e.command.parameters || [''])[0] || '')];
                    }
                    e.command.parameters = [String(e.scriptLines[0] || '')];
                } else if (code === 105) {
                    if (!Array.isArray(e.scrollLines)) e.scrollLines = [];
                }
            } else {
                if (!it || !it.command) return { ok: false, reason: 'invalid_entry' };
                var cmd = clone(it.command);
                if (rowType === 'char') {
                    if (Number(cmd.code || 0) !== 205) return { ok: false, reason: 'invalid_entry' };
                    if (!Array.isArray(cmd.parameters)) cmd.parameters = [charId, this.defaultMoveRoute()];
                    cmd.parameters[0] = charId;
                }
                e = this.entryFromCommand(cmd, this.selEid, this.selPage, ef, -(i + 1));
                if (!e) return { ok: false, reason: 'invalid_entry' };
            }
            if (rowType === 'main') {
                e.rowType = 'main';
                e.rowKey = 'main';
                e.charId = null;
                if (Number((e.command && e.command.code) || 0) !== 205) {
                    e.wait = this.commandWaitFrames(e.command);
                }
            } else {
                e.rowType = 'char';
                e.rowKey = 'char:' + charId;
                e.charId = charId;
                if (e.command && Number(e.command.code || 0) === 205) {
                    if (!Array.isArray(e.command.parameters)) e.command.parameters = [charId, this.defaultMoveRoute()];
                    e.command.parameters[0] = charId;
                    this.recalculateRouteTileGotoWaitMetaForEntry(e);
                    e.wait = this.commandWaitFrames(e.command);
                } else {
                    return { ok: false, reason: 'invalid_entry' };
                }
            }
            out.push(e);
        }
        out.sort(compareEntriesByFrameWaitUid);
        return { ok: true, entries: out };
    };

    EE.prototype.canPastePreparedTimelineEntries = function(tr, entries) {
        if (!tr || !Array.isArray(tr.commands)) return { ok: false, reason: 'no_track' };
        entries = Array.isArray(entries) ? entries : [];
        if (!entries.length) return { ok: false, reason: 'invalid_clipboard' };
        var temp = { commands: tr.commands.map(function(e) { return clone(e); }) };
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e) continue;
            if (!this.canPlaceEntry(temp, e, e.frame, e.rowKey, 0)) {
                return { ok: false, reason: 'overlap', conflictEntry: e, tempTrack: temp };
            }
            temp.commands.push(clone(e));
            temp.commands.sort(compareEntriesByFrameWaitUid);
        }
        return { ok: true };
    };

    EE.prototype.timelineClipboardPasteCapability = function(ctx) {
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return { enabled: false, reason: 'no_track' };
        var clip = this.timelineCommandClipboard;
        if (!clip) return { enabled: false, reason: 'no_clipboard' };
        var target = this.timelinePasteTargetFromContext(ctx);
        var prepared = this.prepareTimelineClipboardEntriesForPaste(clip, target);
        if (!prepared.ok) return { enabled: false, reason: prepared.reason, target: target };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        var check = this.canPastePreparedTimelineEntries(tr, prepared.entries);
        if (!check.ok) return { enabled: false, reason: check.reason, target: target, conflictEntry: check.conflictEntry, tempTrack: check.tempTrack };
        return { enabled: true, target: target, entries: prepared.entries };
    };

    EE.prototype.copy = function() {
        var pack = this.buildTimelineClipboardFromSelection();
        if (!pack.ok) {
            this.msg('Copy不可: ' + this.timelineClipboardCopyReasonText(pack.reason));
            return false;
        }
        this.timelineCommandClipboard = clone(pack.clip);
        this.clip = (pack.clip.items && pack.clip.items.length) ? clone(pack.clip.items[0].command) : null;
        this.msg('Copy ' + pack.sourceUids.length + '件');
        return true;
    };

    EE.prototype.deleteEntriesByUidList = function(uids, snapLabel) {
        if (!this.selKey) return 0;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return 0;
        uids = Array.isArray(uids) ? uids : [];
        var del = Object.create(null);
        var count = 0;
        for (var i = 0; i < uids.length; i++) {
            var uid = Math.floor(Number(uids[i] || 0));
            if (uid <= 0 || del[uid]) continue;
            del[uid] = true;
            count++;
        }
        if (!count) return 0;
        this.pushSnap(String(snapLabel || 'del'));
        tr.commands = tr.commands.filter(function(e) {
            return !del[Math.floor(Number((e && e.uid) || 0))];
        });
        tr.commands.sort(compareEntriesByFrameWaitUid);
        this.selUid = 0;
        this.selRouteListIndex = -1;
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        return count;
    };

    EE.prototype.cut = function() {
        var pack = this.buildTimelineClipboardFromSelection();
        if (!pack.ok) {
            this.msg('Cut不可: ' + this.timelineClipboardCopyReasonText(pack.reason));
            return false;
        }
        this.timelineCommandClipboard = clone(pack.clip);
        this.clip = (pack.clip.items && pack.clip.items.length) ? clone(pack.clip.items[0].command) : null;
        var removed = this.deleteEntriesByUidList(pack.sourceUids, 'cut');
        if (removed <= 0) return false;
        this.msg('Cut ' + removed + '件');
        return true;
    };

    EE.prototype.paste = function() {
        var baseCtx = this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        var cap = this.timelineClipboardPasteCapability(baseCtx);
        if (!cap.enabled) {
            if (String(cap.reason || '') === 'overlap' && cap.conflictEntry) {
                try { this.logDropConflictDetail(cap.tempTrack || (this.model && this.model.tracks ? this.model.tracks[this.selKey] : null), cap.conflictEntry, cap.conflictEntry.frame, cap.conflictEntry.rowKey, 0, 'paste'); } catch (_) {}
            }
            this.msg('Paste不可: ' + this.timelineClipboardPasteReasonText(cap.reason));
            return false;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        this.pushSnap('paste');
        var entries = cap.entries || [];
        var first = null;
        for (var i = 0; i < entries.length; i++) {
            var e = clone(entries[i]);
            e.uid = this.model.nextUid++;
            if (!first) first = e;
            tr.commands.push(e);
            if (e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        }
        tr.commands.sort(compareEntriesByFrameWaitUid);
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        if (first) {
            this.selUid = Number(first.uid || 0);
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(first.frame || this.frame || 0)));
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.msg('Paste ' + entries.length + '件');
        return true;
    };

    EE.prototype.copyFromContextMenu = function() {
        this.closeRouteRangeContextMenu();
        return this.copy();
    };

    EE.prototype.cutFromContextMenu = function() {
        this.closeRouteRangeContextMenu();
        return this.cut();
    };

    EE.prototype.pasteFromContextMenu = function() {
        var ctx = this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        this.closeRouteRangeContextMenu();
        var cap = this.timelineClipboardPasteCapability(ctx);
        if (!cap.enabled) {
            if (String(cap.reason || '') === 'overlap' && cap.conflictEntry) {
                try { this.logDropConflictDetail(cap.tempTrack || (this.model && this.model.tracks ? this.model.tracks[this.selKey] : null), cap.conflictEntry, cap.conflictEntry.frame, cap.conflictEntry.rowKey, 0, 'paste_ctx'); } catch (_) {}
            }
            this.msg('Paste不可: ' + this.timelineClipboardPasteReasonText(cap.reason));
            return false;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        this.pushSnap('paste');
        var entries = cap.entries || [];
        var first = null;
        for (var i = 0; i < entries.length; i++) {
            var e = clone(entries[i]);
            e.uid = this.model.nextUid++;
            if (!first) first = e;
            tr.commands.push(e);
            if (e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        }
        tr.commands.sort(compareEntriesByFrameWaitUid);
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        if (first) {
            this.selUid = Number(first.uid || 0);
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(first.frame || this.frame || 0)));
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.msg('Paste ' + entries.length + '件');
        return true;
    };

    EE.prototype.findRouteRangeEntryByUid = function(uid) {
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return null;
        if (e.rowType !== 'char') return null;
        return e;
    };

    EE.prototype.commandMarkerColorPalette = function() {
        return [
            { id: 'red', label: '赤', fill: 'rgba(236,92,92,.98)', border: 'rgba(112,34,34,.95)', textColor: 'rgba(40,12,12,.96)' },
            { id: 'orange', label: '橙', fill: 'rgba(236,156,74,.98)', border: 'rgba(112,68,28,.95)', textColor: 'rgba(42,24,8,.96)' },
            { id: 'yellow', label: '黄', fill: 'rgba(236,214,90,.98)', border: 'rgba(126,106,24,.95)', textColor: 'rgba(42,34,8,.96)' },
            { id: 'lime', label: '緑', fill: 'rgba(108,210,108,.98)', border: 'rgba(28,92,28,.95)', textColor: 'rgba(12,36,12,.96)' },
            { id: 'cyan', label: '水', fill: 'rgba(92,208,224,.98)', border: 'rgba(24,94,104,.95)', textColor: 'rgba(10,30,34,.96)' },
            { id: 'blue', label: '青', fill: 'rgba(96,156,246,.98)', border: 'rgba(28,60,122,.95)', textColor: 'rgba(10,22,38,.96)' },
            { id: 'purple', label: '紫', fill: 'rgba(176,130,242,.98)', border: 'rgba(76,46,120,.95)', textColor: 'rgba(24,14,42,.96)' },
            { id: 'gray', label: '灰', fill: 'rgba(176,186,198,.98)', border: 'rgba(74,82,92,.95)', textColor: 'rgba(20,24,30,.96)' }
        ];
    };

    EE.prototype.normalizeCommandMarkerColor = function(colorId) {
        var v = String(colorId == null ? '' : colorId).trim().toLowerCase();
        if (!v) return '';
        var palette = this.commandMarkerColorPalette();
        for (var i = 0; i < palette.length; i++) {
            var id = String(palette[i] && palette[i].id || '').trim().toLowerCase();
            if (id && id === v) return id;
        }
        return '';
    };

    EE.prototype.commandMarkerColorInfo = function(colorId) {
        var id = this.normalizeCommandMarkerColor(colorId);
        if (!id) return null;
        var palette = this.commandMarkerColorPalette();
        for (var i = 0; i < palette.length; i++) {
            var it = palette[i];
            if (String(it && it.id || '') === id) return it;
        }
        return null;
    };

    EE.prototype.commandMarkerColorOfEntry = function(entry, routeListIndex) {
        if (!entry || !entry.command) return '';
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (routeListIndex >= 0 && Number(entry.command.code || 0) === 205 && entry.rowType === 'char') {
            var route = entry.command.parameters && entry.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            if (routeListIndex < list.length) {
                var rc = list[routeListIndex];
                return this.normalizeCommandMarkerColor(rc && rc._eeMarkerColor);
            }
            return '';
        }
        return this.normalizeCommandMarkerColor(entry.command._eeMarkerColor);
    };

    EE.prototype.commandMarkerFillColor = function(defaultColor, entry, routeListIndex) {
        var info = this.commandMarkerColorInfo(this.commandMarkerColorOfEntry(entry, routeListIndex));
        return info && info.fill ? String(info.fill) : String(defaultColor || 'rgba(220,220,220,.98)');
    };

    EE.prototype.commandCircleGroupCodeSpec = function() {
        if (this._commandCircleGroupCodeSpec) return this._commandCircleGroupCodeSpec;
        this._commandCircleGroupCodeSpec = [
            { group: 'blue', codes: [111, 112, 113, 117, 118, 119, 301, 356, 411, 412] },
            { group: 'red', codes: [121, 122, 123, 124] },
            { group: 'orange', codes: [125, 126, 127, 128, 129, 230, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 324, 325, 326] },
            { group: 'lime', codes: [221, 222, 223, 224, 225, 236] },
            { group: 'magenta', codes: [102, 103, 104, 105, 132, 133, 134, 135, 136, 137, 138, 139, 140, 231, 232, 233, 234, 235, 302, 303, 322, 323, 35556, 35557, 35558] },
            { group: 'rose', codes: [281, 282, 283, 284, 285] },
            { group: 'cyan', codes: [241, 242, 243, 244, 245, 246, 249, 250, 251, 261, 351, 352, 353, 354, 35553] },
            { group: 'purple', codes: [331, 332, 333, 334, 335, 336, 337, 339, 340, 341, 342] },
            { group: 'brown', codes: [201, 202, 203, 204, 205, 206, 211, 212, 213, 214, 216, 217, 355, 35550, 35551, 35552, 35554, 35555] }
        ];
        return this._commandCircleGroupCodeSpec;
    };

    EE.prototype.commandCircleColorConfig = function() {
        if (this._commandCircleColorConfig) return this._commandCircleColorConfig;
        this._commandCircleColorConfig = {
            baseDefault: 'rgba(220,220,220,.98)',
            rowMainDefault: 'rgba(236,245,255,.98)',
            rowOtherDefault: 'rgba(182,134,94,.98)',
            specialCodeColors: {
                101: 'rgba(236, 130, 225, 0.98)',
                108: 'rgba(66,182,76,.98)',
                115: 'rgba(170,170,170,.98)',
                355: 'rgba(236,245,255,.98)',
                356: 'rgba(236,245,255,.98)'
            },
            groupColors: {
                red: 'rgba(225,48,48,.98)',
                blue: 'rgba(36,86,224,.98)',
                orange: 'rgba(236,142,44,.98)',
                lime: 'rgba(186,224,118,.98)',
                magenta: 'rgba(222,64,210,.98)',
                rose: 'rgba(232,82,142,.98)',
                cyan: 'rgba(44,221,244,.98)',
                purple: 'rgba(144,74,226,.98)',
                brown: 'rgba(182,134,94,.98)'
            }
        };
        return this._commandCircleColorConfig;
    };

    EE.prototype.commandCircleGroupForCode = function(code) {
        code = Math.floor(Number(code || 0));
        if (!code) return 'default';
        var map = this._commandCircleGroupMap;
        if (!map) {
            map = Object.create(null);
            var spec = this.commandCircleGroupCodeSpec();
            for (var i = 0; i < spec.length; i++) {
                var row = spec[i];
                if (!row || !row.group || !Array.isArray(row.codes)) continue;
                for (var ci = 0; ci < row.codes.length; ci++) {
                    var c = Math.floor(Number(row.codes[ci] || 0));
                    if (c > 0) map[String(c)] = String(row.group);
                }
            }
            this._commandCircleGroupMap = map;
        }
        return String(map[String(code)] || 'default');
    };

    EE.prototype.commandCircleDefaultColorForEntry = function(entry, rowKey) {
        var cfg = this.commandCircleColorConfig();
        if (!entry || !entry.command) return String(cfg.baseDefault || 'rgba(220,220,220,.98)');
        var displayCode = this.mainCommandDisplayCodeForEntry(entry);
        var code = Math.floor(Number(displayCode || entry.command.code || 0));
        var special = cfg.specialCodeColors && cfg.specialCodeColors[code];
        if (special) return String(special);
        var g = this.commandCircleGroupForCode(code);
        var groupColor = cfg.groupColors && cfg.groupColors[g];
        if (groupColor) return String(groupColor);
        if (String(rowKey || '') === 'main') return String(cfg.rowMainDefault || cfg.baseDefault);
        return String(cfg.rowOtherDefault || cfg.baseDefault);
    };

    EE.prototype.commandNodeFillColorForEntry = function(entry, routeListIndex, rowKey) {
        var cfg = this.commandCircleColorConfig();
        if (!entry || !entry.command) return String(cfg.baseDefault || 'rgba(220,220,220,.98)');
        var rk = String(rowKey || entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main'));
        var rli = this.nodeRouteIndex(routeListIndex);
        var defaultColor = this.commandCircleDefaultColorForEntry(entry, rk);
        return this.commandMarkerFillColor(defaultColor, entry, rli);
    };

    EE.prototype.mixColorWithWhite = function(color, ratio) {
        color = String(color == null ? '' : color).trim();
        ratio = Math.max(0, Math.min(1, Number(ratio == null ? 0.5 : ratio)));
        var m = color.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
        if (!m) return color;
        var r = Math.max(0, Math.min(255, Number(m[1] || 0)));
        var g = Math.max(0, Math.min(255, Number(m[2] || 0)));
        var b = Math.max(0, Math.min(255, Number(m[3] || 0)));
        var a = (m[4] == null) ? 1 : Math.max(0, Math.min(1, Number(m[4] || 1)));
        r = Math.round(r + (255 - r) * ratio);
        g = Math.round(g + (255 - g) * ratio);
        b = Math.round(b + (255 - b) * ratio);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + ')';
    };

    EE.prototype.commandTextColorForEntry = function(entry, routeListIndex, rowKey) {
        return this.mixColorWithWhite(this.commandNodeFillColorForEntry(entry, routeListIndex, rowKey), 0.5);
    };

    EE.prototype.selectedCommandEntryForColorContext = function() {
        var mode = String(this.routeCtxMode || 'route');
        if (mode === 'selection') return null;
        var uid = 0;
        var routeListIndex = -1;
        if (mode === 'route' && Number(this.routeRangeCtxUid || 0) > 0) {
            uid = Math.floor(Number(this.routeRangeCtxUid || 0));
            routeListIndex = -1;
        } else if (Number(this.selUid || 0) > 0) {
            uid = Math.floor(Number(this.selUid || 0));
            routeListIndex = this.nodeRouteIndex(this.selRouteListIndex);
        } else {
            return null;
        }
        if (uid <= 0) return null;
        var entry = this.findEntryInSelectedTrack(uid);
        if (!entry || !entry.command || Number(entry.command.code || 0) <= 0) return null;
        if (routeListIndex >= 0) {
            if (Number(entry.command.code || 0) !== 205 || entry.rowType !== 'char') return null;
            var route = entry.command.parameters && entry.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            if (routeListIndex >= list.length) return null;
            var rc = list[routeListIndex];
            if (!rc || Number(rc.code || 0) <= 0) return null;
        } else {
            routeListIndex = -1;
            if (mode === 'route' && (Number(entry.command.code || 0) !== 205 || entry.rowType !== 'char')) return null;
        }
        return { uid: uid, entry: entry, routeListIndex: routeListIndex };
    };

    EE.prototype.applySelectedCommandMarkerColorFromContext = function(colorId) {
        var target = this.selectedCommandEntryForColorContext();
        if (!target) return false;
        var entry = target.entry;
        var routeListIndex = this.nodeRouteIndex(target.routeListIndex);
        var next = this.normalizeCommandMarkerColor(colorId);
        var prev = this.commandMarkerColorOfEntry(entry, routeListIndex);
        if (next === prev) return true;
        this.pushSnap('markerColor');
        if (routeListIndex >= 0 && Number(entry.command.code || 0) === 205 && entry.rowType === 'char') {
            var route = entry.command.parameters && entry.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            if (routeListIndex >= list.length) return false;
            var rc = list[routeListIndex];
            if (!rc || typeof rc !== 'object') return false;
            if (next) rc._eeMarkerColor = next;
            else delete rc._eeMarkerColor;
            list[routeListIndex] = rc;
        } else {
            if (next) entry.command._eeMarkerColor = next;
            else delete entry.command._eeMarkerColor;
        }
        this.dirty[this.selKey] = true;
        this.timelineDirty = true;
        this.refreshRouteRangeContextMenu();
        var info = this.commandMarkerColorInfo(next);
        this.msg('◯色: ' + (info ? info.label : '解除'));
        return true;
    };

    EE.prototype.refreshRouteRangeContextMenu = function() {
        if (!this.routeCtx || !this.routeCtx.classList.contains('on')) return;
        var mode = String(this.routeCtxMode || 'route');
        var isRouteMode = (mode === 'route');
        var isTimelineMode = (mode === 'timeline');
        var isEndMarkerMode = (mode === 'endMarker');
        var isSelectionMode = (mode === 'selection');
        var canShowAdd = isRouteMode || isTimelineMode;
        var addCtx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        var addSource = String(addCtx.source || 'frame');
        var showFrameAdd = canShowAdd && addSource === 'frame';
        var showRelativeAdd = canShowAdd && (addSource === 'command' || addSource === 'routeCmd');
        var hasTrack = !!(this.selEid && this.selPage >= 0 && this.selKey);
        var trEndMenu = hasTrack && this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        var endMenuFrame = trEndMenu ? this.normalizeTrackEndFrame(trEndMenu) : 0;
        var endMenuMinFrame = trEndMenu ? this.trackComputedEndFrame(trEndMenu) : 0;
        var colorTarget = this.selectedCommandEntryForColorContext();
        var canColorPick = !!(hasTrack && colorTarget);
        if (this.routeCtxAddBtn) {
            var addFrame = Math.max(0, Math.floor(Number(addCtx.frame || 0)));
            var addLocked = showFrameAdd && this.isFrameLockedForFrameCommandAdd(addFrame);
            var canAdd = showFrameAdd && hasTrack && !addLocked;
            this.routeCtxAddBtn.style.display = canAdd ? '' : 'none';
            this.routeCtxAddBtn.disabled = !canAdd;
            this.routeCtxAddBtn.textContent = 'コマンド追加';
        }
        if (this.routeCtxAddBeforeBtn) {
            var canAddBefore = showRelativeAdd && hasTrack;
            this.routeCtxAddBeforeBtn.style.display = canAddBefore ? '' : 'none';
            this.routeCtxAddBeforeBtn.disabled = !canAddBefore;
            this.routeCtxAddBeforeBtn.textContent = '直前にコマンド追加';
        }
        if (this.routeCtxAddAfterBtn) {
            var canAddAfter = showRelativeAdd && hasTrack;
            this.routeCtxAddAfterBtn.style.display = canAddAfter ? '' : 'none';
            this.routeCtxAddAfterBtn.disabled = !canAddAfter;
            this.routeCtxAddAfterBtn.textContent = '直後にコマンド追加';
        }
        if (this.routeCtxMemoBtn) {
            this.routeCtxMemoBtn.style.display = hasTrack ? '' : 'none';
            this.routeCtxMemoBtn.disabled = !hasTrack;
            this.routeCtxMemoBtn.textContent = 'メモ作成';
        }
        var copyProbe = this.collectTimelineClipboardEntries();
        var canCopy = !!copyProbe.ok;
        var pasteProbe = this.timelineClipboardPasteCapability(addCtx);
        var canPaste = !!pasteProbe.enabled;
        if (this.routeCtxCopyBtn) {
            this.routeCtxCopyBtn.style.display = canCopy ? '' : 'none';
            this.routeCtxCopyBtn.disabled = !canCopy;
            this.routeCtxCopyBtn.textContent = 'コピー';
        }
        if (this.routeCtxCutBtn) {
            this.routeCtxCutBtn.style.display = canCopy ? '' : 'none';
            this.routeCtxCutBtn.disabled = !canCopy;
            this.routeCtxCutBtn.textContent = '切り取り';
        }
        if (this.routeCtxPasteBtn) {
            this.routeCtxPasteBtn.style.display = canPaste ? '' : 'none';
            this.routeCtxPasteBtn.disabled = !canPaste;
            this.routeCtxPasteBtn.textContent = '貼り付け';
        }
        if (this.routeCtxColorLabel) {
            this.routeCtxColorLabel.style.display = canColorPick ? '' : 'none';
            this.routeCtxColorLabel.textContent = '◯の色';
        }
        if (this.routeCtxColorWrap) {
            this.routeCtxColorWrap.style.display = canColorPick ? 'flex' : 'none';
        }
        if (this.routeCtxColorBtns && this.routeCtxColorBtns.length) {
            var activeColorId = canColorPick
                ? this.commandMarkerColorOfEntry(colorTarget.entry, colorTarget.routeListIndex)
                : '';
            for (var ci = 0; ci < this.routeCtxColorBtns.length; ci++) {
                var cb = this.routeCtxColorBtns[ci];
                if (!cb) continue;
                cb.disabled = !canColorPick;
                var rawId = String(cb.dataset && cb.dataset.markerColor != null ? cb.dataset.markerColor : '');
                var btnId = this.normalizeCommandMarkerColor(rawId);
                var isClear = rawId === '';
                var isSel = canColorPick && ((activeColorId && btnId === activeColorId) || (!activeColorId && isClear));
                if (isSel) cb.classList.add('sel');
                else cb.classList.remove('sel');
            }
        }
        if (this.routeCtxSkippableBtn) this.routeCtxSkippableBtn.style.display = isRouteMode ? '' : 'none';
        if (this.routeCtxRepeatBtn) this.routeCtxRepeatBtn.style.display = isRouteMode ? '' : 'none';
        if (this.routeCtxWaitBtn) this.routeCtxWaitBtn.style.display = isRouteMode ? '' : 'none';
        if (isRouteMode) {
            var e = this.findRouteRangeEntryByUid(this.routeRangeCtxUid);
            if (!e) {
                this.closeRouteRangeContextMenu();
                return;
            }
            var route = e.command.parameters && e.command.parameters[1];
            if (!route || typeof route !== 'object') route = {};
            if (this.routeCtxSkippableBtn) {
                this.routeCtxSkippableBtn.textContent = '移動できない場合は飛ばす: ' + (route.skippable ? 'ON' : 'OFF');
            }
            if (this.routeCtxRepeatBtn) {
                this.routeCtxRepeatBtn.textContent = '動作を繰り返す: ' + (route.repeat ? 'ON' : 'OFF');
            }
            if (this.routeCtxWaitBtn) {
                this.routeCtxWaitBtn.textContent = '完了までウェイト: ' + (route.wait ? 'ON' : 'OFF');
            }
        }
        if (this.routeCtxInsertWaitBtn) {
            this.routeCtxInsertWaitBtn.style.display = hasTrack ? '' : 'none';
            this.routeCtxInsertWaitBtn.disabled = !hasTrack;
            this.routeCtxInsertWaitBtn.textContent = 'ウェイトの挿入...';
        }
        if (this.routeCtxSqueezeBtn) {
            this.routeCtxSqueezeBtn.style.display = 'none';
            this.routeCtxSqueezeEnabled = false;
            if (!isTimelineMode) {
                var sq = this.selectionSqueezeCapability();
                var canShowSqueeze = !isEndMarkerMode && !!sq.enabled;
                this.routeCtxSqueezeEnabled = canShowSqueeze;
                this.routeCtxSqueezeBtn.style.display = canShowSqueeze ? '' : 'none';
                this.routeCtxSqueezeBtn.disabled = !canShowSqueeze;
                this.routeCtxSqueezeBtn.textContent = '詰める';
            }
        }
        if (this.routeCtxWaitArrangeBtn) {
            this.routeCtxWaitArrangeBtn.style.display = 'none';
            if (isSelectionMode) {
                var wa = this.selectionMessageWaitArrangeCapability();
                this.routeCtxWaitArrangeEnabled = !!wa.enabled;
                this.routeCtxWaitArrangeBtn.style.display = wa.enabled ? '' : 'none';
                this.routeCtxWaitArrangeBtn.disabled = !wa.enabled;
                this.routeCtxWaitArrangeBtn.textContent = 'ウェイトを整理';
            } else {
                this.routeCtxWaitArrangeEnabled = false;
            }
        }
        if (this.routeCtxMergeBtn) {
            this.routeCtxMergeBtn.style.display = 'none';
            if (isSelectionMode) {
                var mc = this.selectionRouteMergeCapability();
                this.routeCtxMergeEnabled = !!mc.enabled;
                this.routeCtxMergeBtn.style.display = mc.enabled ? '' : 'none';
                this.routeCtxMergeBtn.disabled = !mc.enabled;
                this.routeCtxMergeBtn.textContent = '移動ルートの結合';
            } else {
                this.routeCtxMergeEnabled = false;
            }
        }
        if (this.routeCtxMessageBubbleBulkBtn) {
            this.routeCtxMessageBubbleBulkBtn.style.display = 'none';
            if (isSelectionMode) {
                var mbc = this.selectionMessageBubbleBulkCapability();
                this.routeCtxMessageBubbleBulkEnabled = !!mbc.enabled;
                this.routeCtxMessageBubbleBulkBtn.style.display = mbc.enabled ? '' : 'none';
                this.routeCtxMessageBubbleBulkBtn.disabled = !mbc.enabled;
                this.routeCtxMessageBubbleBulkBtn.textContent = 'ふきだし位置一括設定';
            } else {
                this.routeCtxMessageBubbleBulkEnabled = false;
            }
        }
        if (this.routeCtxEndPlus300Btn) {
            var canEndPlus = isEndMarkerMode && hasTrack;
            this.routeCtxEndPlus300Btn.style.display = canEndPlus ? '' : 'none';
            this.routeCtxEndPlus300Btn.disabled = !canEndPlus;
            this.routeCtxEndPlus300Btn.textContent = '300f後ろへ';
        }
        if (this.routeCtxEndToLastCmdBtn) {
            var canEndToLast = isEndMarkerMode && hasTrack && endMenuFrame !== endMenuMinFrame;
            this.routeCtxEndToLastCmdBtn.style.display = canEndToLast ? '' : 'none';
            this.routeCtxEndToLastCmdBtn.disabled = !canEndToLast;
            this.routeCtxEndToLastCmdBtn.textContent = '最後のコマンド位置へ';
        }
        var rx = Number(this.routeCtx.style && this.routeCtx.style.left != null ? parseFloat(this.routeCtx.style.left) : 0);
        var ry = Number(this.routeCtx.style && this.routeCtx.style.top != null ? parseFloat(this.routeCtx.style.top) : 0);
        if (!isFinite(rx)) rx = 4;
        if (!isFinite(ry)) ry = 4;
        this.placeMenuInViewport(this.routeCtx, rx, ry, 4);
    };

    EE.prototype.waitInsertDefaultFramesFromSelection = function() {
        if (!this.hasRangeSelection()) return 60;
        var rs = this.rangeSelection || {};
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        var n = Math.max(1, fe - fs + 1);
        return n;
    };

    EE.prototype.makeWaitInsertContextFromFrame = function(frame, rowKey) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        rowKey = String(rowKey || 'main');
        if (rowKey.indexOf('char:') !== 0) rowKey = 'main';
        return {
            source: 'frame',
            frame: frame,
            rowKey: rowKey,
            defaultFrames: 60
        };
    };

    EE.prototype.makeWaitInsertContextFromSelection = function() {
        if (!this.hasRangeSelection()) return this.makeWaitInsertContextFromFrame(this.frame);
        var rs = this.rangeSelection || {};
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        return {
            source: 'selection',
            frameStart: fs,
            frameEnd: fe,
            defaultFrames: this.waitInsertDefaultFramesFromSelection()
        };
    };

    EE.prototype.makeWaitInsertContextFromCommand = function(uid, fallbackFrame) {
        uid = Math.floor(Number(uid || 0));
        var e = this.findEntryInSelectedTrack(uid);
        var frame = (e ? e.frame : fallbackFrame);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var ifBranchViewMode = '';
        if (e && e.command && Number(e.command.code || 0) === 111 && typeof this.getIfBranchViewModeForEntry === 'function') {
            try { ifBranchViewMode = this.sanitizeIfBranchViewMode(this.getIfBranchViewModeForEntry(e)); } catch (_) { ifBranchViewMode = ''; }
        }
        return {
            source: 'command',
            uid: uid,
            frame: frame,
            includeSameFrameOnAfter: true,
            defaultFrames: 60,
            ifBranchViewMode: ifBranchViewMode
        };
    };

    EE.prototype.makeWaitInsertContextFromRouteCommand = function(uid, routeListIndex, fallbackFrame) {
        uid = Math.floor(Number(uid || 0));
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        var e = this.findEntryInSelectedTrack(uid);
        var frame = Math.max(0, Math.floor(Number(fallbackFrame || 0)));
        if (e && e.command && Number(e.command.code || 0) === 205) {
            frame = Math.max(0, Math.floor(Number(e.frame || 0)));
            var route = e.command.parameters && e.command.parameters[1];
            var tl = this.moveRouteTimeline(route);
            var items = tl && Array.isArray(tl.items) ? tl.items : [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it) continue;
                if (this.nodeRouteIndex(it.listIndex) !== routeListIndex) continue;
                frame = Math.max(0, Math.floor(Number(e.frame || 0)) + Math.max(0, Math.floor(Number(it.offset || 0))));
                break;
            }
        }
        return {
            source: 'routeCmd',
            uid: uid,
            routeListIndex: routeListIndex,
            frame: frame,
            defaultFrames: 60
        };
    };

    EE.prototype.resolveWaitInsertContext = function(ctx) {
        var c = (ctx && typeof ctx === 'object') ? clone(ctx) : {};
        var source = String(c.source || 'frame');
        if (source !== 'selection' && source !== 'command' && source !== 'routeCmd' && source !== 'frame') source = 'frame';
        c.source = source;
        if (source === 'selection') {
            var fs = Math.max(0, Math.floor(Number(c.frameStart || 0)));
            var fe = Math.max(fs, Math.floor(Number(c.frameEnd == null ? fs : c.frameEnd)));
            c.frameStart = fs;
            c.frameEnd = fe;
            c.defaultFrames = Math.max(1, Math.floor(Number(c.defaultFrames || (fe - fs + 1) || 60)));
        } else {
            c.frame = Math.max(0, Math.floor(Number(c.frame || this.frame || 0)));
            c.rowKey = String(c.rowKey || 'main');
            if (c.rowKey.indexOf('char:') !== 0) c.rowKey = 'main';
            c.defaultFrames = Math.max(1, Math.floor(Number(c.defaultFrames || 60)));
            c.uid = Math.floor(Number(c.uid || 0));
            c.routeListIndex = this.nodeRouteIndex(c.routeListIndex);
            c.includeSameFrameOnAfter = !!c.includeSameFrameOnAfter;
            var ivm = String(c.ifBranchViewMode || '').toLowerCase();
            if (ivm === 'then' || ivm === 'else' || ivm === 'auto') c.ifBranchViewMode = ivm;
            else c.ifBranchViewMode = '';
        }
        return c;
    };

    EE.prototype.waitInsertContextInfoText = function(ctx) {
        ctx = this.resolveWaitInsertContext(ctx);
        if (ctx.source === 'selection') {
            var len = Math.max(1, Math.floor(Number(ctx.frameEnd - ctx.frameStart + 1)));
            return '範囲: ' + ctx.frameStart + 'f - ' + ctx.frameEnd + 'f (' + len + 'f)';
        }
        if (ctx.source === 'command') {
            var nm = '';
            var e = this.findEntryInSelectedTrack(ctx.uid);
            if (e && e.command) nm = this.commandNameJa(this.mainCommandDisplayCodeForEntry(e));
            var suffix = nm ? (' [' + nm + ']') : '';
            return '基準コマンド: frame ' + ctx.frame + 'f' + suffix;
        }
        if (ctx.source === 'routeCmd') {
            var re = this.findEntryInSelectedTrack(ctx.uid);
            var head = re ? this.executionEventLabelForEntry(re) : '';
            var routeName = '';
            if (re && re.command && Number(re.command.code || 0) === 205) {
                var route = re.command.parameters && re.command.parameters[1];
                var tl = this.moveRouteTimeline(route);
                var items = tl && Array.isArray(tl.items) ? tl.items : [];
                for (var i = 0; i < items.length; i++) {
                    var it = items[i];
                    if (!it) continue;
                    if (this.nodeRouteIndex(it.listIndex) !== this.nodeRouteIndex(ctx.routeListIndex)) continue;
                    var dcode = Number((it.displayCode != null) ? it.displayCode : (it.command ? it.command.code : 0));
                    routeName = (dcode === 4500) ? 'タイル移動' : this.routeCommandNameJa(dcode);
                    break;
                }
            }
            var label = routeName ? (head + routeName) : (head + '移動ルート');
            return '基準: ' + label + ' @ ' + ctx.frame + 'f';
        }
        return '基準フレーム: ' + ctx.frame + 'f';
    };

    EE.prototype.ifBranchFindEntryIndexByUid = function(list, uid) {
        if (!Array.isArray(list) || !list.length) return -1;
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return -1;
        for (var i = 0; i < list.length; i++) {
            if (Math.floor(Number(list[i] && list[i].uid || 0)) === uid) return i;
        }
        return -1;
    };

    EE.prototype.ifBranchActiveRangeForBlock = function(tr, info, block) {
        if (!block) return null;
        info = info || {};
        var list = Array.isArray(info.list) ? info.list : [];
        if (!list.length) return null;
        var modeMap = this.normalizeIfBranchViewModes(tr && tr._eeIfBranchViewModes);
        var mode = this.ifBranchEffectiveModeForBlock(tr, info, block, modeMap);
        if (mode !== 'else') mode = 'then';
        var ifIndex = Math.max(0, Math.floor(Number(block.ifIndex || 0)));
        var elseIndex = Math.floor(Number(block.elseIndex || -1));
        var endIndex = Math.floor(Number(block.endIndex || -1));
        if (endIndex < 0 || endIndex > list.length) endIndex = list.length;
        var startIndex = ifIndex + 1;
        var stopIndex = (elseIndex >= 0) ? elseIndex : endIndex;
        if (mode === 'else') {
            if (elseIndex >= 0) {
                startIndex = elseIndex + 1;
                stopIndex = endIndex;
            } else {
                mode = 'then';
                startIndex = ifIndex + 1;
                stopIndex = endIndex;
            }
        }
        startIndex = Math.max(0, Math.min(list.length, startIndex));
        stopIndex = Math.max(startIndex, Math.min(list.length, stopIndex));
        var endIndexInclusive = Math.max(startIndex - 1, Math.min(list.length - 1, Math.max(0, endIndex - 1)));
        return {
            mode: mode,
            ifIndex: ifIndex,
            elseIndex: elseIndex,
            endIndex: endIndex,
            endIndexInclusive: endIndexInclusive,
            startIndex: startIndex,
            stopIndex: stopIndex
        };
    };

    EE.prototype.buildIfBranchShiftUidMap = function(list, fromIndex, toIndex) {
        var map = Object.create(null);
        if (!Array.isArray(list) || !list.length) return map;
        fromIndex = Math.max(0, Math.floor(Number(fromIndex || 0)));
        toIndex = Math.min(list.length - 1, Math.floor(Number(toIndex == null ? (list.length - 1) : toIndex)));
        if (toIndex < fromIndex) return map;
        for (var i = fromIndex; i <= toIndex; i++) {
            var e = list[i];
            if (!e) continue;
            var uid = Math.floor(Number(e.uid || 0));
            if (uid > 0) map[String(uid)] = true;
        }
        return map;
    };

    EE.prototype.resolveIfBranchInsertionInfoByUid = function(uid, tr, modeHint) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return null;
        var ifEntry = this.findEntryInSelectedTrack(uid);
        if (!ifEntry || !ifEntry.command || Number(ifEntry.command.code || 0) !== 111) return null;
        tr = tr || this.resolveTrackForIfBranchEntry(ifEntry);
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return null;

        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var list = Array.isArray(info.list) ? info.list : [];
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        var block = null;
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            if (Math.floor(Number(b.ifUid || 0)) === uid) {
                block = b;
                break;
            }
        }
        if (!block) return null;

        var range = this.ifBranchActiveRangeForBlock(tr, info, block);
        if (!range) return null;

        var ifIndex = Math.max(0, Math.floor(Number(block.ifIndex || 0)));
        var elseIndex = Math.floor(Number(block.elseIndex || -1));
        var endIndex = Math.floor(Number(block.endIndex || -1));
        if (endIndex < 0 || endIndex > list.length) endIndex = list.length;

        // For explicit THEN/ELSE selection, trust the configured UI mode first.
        var mode = String(range.mode || 'then');
        var hintedMode = this.sanitizeIfBranchViewMode(modeHint || '');
        var configuredMode = 'then';
        if (typeof this.getIfBranchViewModeForEntry === 'function') {
            try {
                configuredMode = this.sanitizeIfBranchViewMode(this.getIfBranchViewModeForEntry(ifEntry));
            } catch (_) {
                configuredMode = 'then';
            }
        }
        if (hintedMode === 'then' || hintedMode === 'else') mode = hintedMode;
        else if (configuredMode === 'then' || configuredMode === 'else') mode = configuredMode;
        if (mode !== 'else') mode = 'then';
        if (mode === 'else' && elseIndex < 0) mode = 'then';

        var startIndex = ifIndex + 1;
        var stopIndex = (elseIndex >= 0) ? elseIndex : endIndex;
        if (mode === 'else') {
            startIndex = elseIndex + 1;
            stopIndex = endIndex;
        }
        startIndex = Math.max(0, Math.min(list.length, startIndex));
        stopIndex = Math.max(startIndex, Math.min(list.length, stopIndex));
        var endIndexInclusive = Math.max(startIndex - 1, Math.min(list.length - 1, Math.max(0, endIndex - 1)));

        var elseEntry = (elseIndex >= 0 && elseIndex < list.length) ? list[elseIndex] : null;
        var anchorEntry = ifEntry;
        if (mode === 'else' && elseEntry && elseEntry.command && Number(elseEntry.command.code || 0) === 411) {
            anchorEntry = elseEntry;
        }

        var firstBranchEntry = null;
        for (i = startIndex; i < stopIndex; i++) {
            var be = list[i];
            if (!be || !be.command) continue;
            var bcode = Math.floor(Number(be.command.code || 0));
            if (bcode === 411 || bcode === 412) continue;
            firstBranchEntry = be;
            break;
        }

        return {
            ifUid: uid,
            ifEntry: ifEntry,
            block: block,
            mode: mode,
            list: list,
            info: info,
            anchorEntry: anchorEntry || ifEntry,
            anchorIndex: this.ifBranchFindEntryIndexByUid(list, Math.floor(Number((anchorEntry || ifEntry).uid || 0))),
            firstBranchEntry: firstBranchEntry,
            branchIndent: Math.max(0, Math.floor(Number(ifEntry.command.indent || 0))) + 1,
            startIndex: startIndex,
            stopIndex: stopIndex,
            endIndex: endIndex,
            endIndexInclusive: endIndexInclusive
        };
    };

    EE.prototype.resolveIfBranchScopeForEntryUid = function(uid, tr) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return null;
        var entry = this.findEntryInSelectedTrack(uid);
        if (!entry || !entry.command) return null;
        tr = tr || this.resolveTrackForIfBranchEntry(entry);
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return null;
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var list = Array.isArray(info.list) ? info.list : [];
        if (!list.length) return null;
        var idx = this.ifBranchFindEntryIndexByUid(list, uid);
        if (idx < 0) return null;
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        var best = null;
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var range = this.ifBranchActiveRangeForBlock(tr, info, b);
            if (!range) continue;
            if (idx < range.startIndex || idx >= range.stopIndex) continue;
            if (!best) {
                best = { block: b, range: range };
                continue;
            }
            var bIndent = Math.floor(Number(b.indent || 0));
            var bestIndent = Math.floor(Number(best.block && best.block.indent || 0));
            if (bIndent > bestIndent) {
                best = { block: b, range: range };
                continue;
            }
            if (bIndent === bestIndent) {
                var span = Math.max(1, range.stopIndex - range.startIndex);
                var bestSpan = Math.max(1, best.range.stopIndex - best.range.startIndex);
                if (span < bestSpan) best = { block: b, range: range };
            }
        }
        if (!best) return null;
        return {
            tr: tr,
            info: info,
            list: list,
            entry: entry,
            entryIndex: idx,
            block: best.block,
            mode: best.range.mode,
            startIndex: best.range.startIndex,
            stopIndex: best.range.stopIndex,
            endIndex: best.range.endIndex,
            endIndexInclusive: best.range.endIndexInclusive
        };
    };

    EE.prototype.makeAddPlacementContextFromFrame = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        return {
            mode: 'frame',
            source: 'frame',
            frame: frame,
            uid: 0,
            routeListIndex: -1
        };
    };

    EE.prototype.makeAddPlacementContextFromWaitInsertContext = function(ctx, mode) {
        ctx = this.resolveWaitInsertContext(ctx || this.makeWaitInsertContextFromFrame(this.frame));
        mode = String(mode || 'frame');
        if (mode !== 'before' && mode !== 'after' && mode !== 'frame') mode = 'frame';
        var out = {
            mode: mode,
            source: String(ctx.source || 'frame'),
            frame: Math.max(0, Math.floor(Number(ctx.frame || 0))),
            uid: Math.floor(Number(ctx.uid || 0)),
            routeListIndex: this.nodeRouteIndex(ctx.routeListIndex),
            branchInsertIndent: null,
            branchIfUid: 0,
            branchShiftUidMap: null
        };
        if (out.source === 'command' && out.uid > 0 && (out.mode === 'before' || out.mode === 'after')) {
            var anchor = this.findEntryInSelectedTrack(out.uid);
            var pos = out.mode;
            if (anchor && anchor.command && Number(anchor.command.code || 0) === 111 && pos === 'after') {
                var branchInfo = this.resolveIfBranchInsertionInfoByUid(out.uid, null, ctx.ifBranchViewMode);
                if (branchInfo && branchInfo.anchorEntry) {
                    out.uid = Math.floor(Number(branchInfo.anchorEntry.uid || out.uid));
                    out.frame = Math.max(0, Math.floor(Number(branchInfo.anchorEntry.frame || out.frame)));
                    out.branchInsertIndent = Math.max(0, Math.floor(Number(branchInfo.branchIndent || 0)));
                    out.branchIfUid = Math.floor(Number(branchInfo.ifUid || 0));
                    if (Array.isArray(branchInfo.list) && branchInfo.anchorIndex >= 0) {
                        out.branchShiftUidMap = this.buildIfBranchShiftUidMap(
                            branchInfo.list,
                            branchInfo.anchorIndex + 1,
                            branchInfo.endIndexInclusive
                        );
                    }
                }
            } else {
                var scope = this.resolveIfBranchScopeForEntryUid(out.uid);
                if (scope && scope.entry && scope.entry.command) {
                    out.branchInsertIndent = Math.max(0, Math.floor(Number(scope.entry.command.indent || 0)));
                    out.branchIfUid = Math.floor(Number(scope.block && scope.block.ifUid || 0));
                    var fromIdx = (pos === 'before') ? scope.entryIndex : (scope.entryIndex + 1);
                    fromIdx = Math.max(scope.startIndex, fromIdx);
                    out.branchShiftUidMap = this.buildIfBranchShiftUidMap(
                        scope.list,
                        fromIdx,
                        scope.endIndexInclusive
                    );
                }
            }
        }
        return out;
    };

    EE.prototype.resolveAddPlacementContext = function(ctx, fallbackFrame) {
        var c = (ctx && typeof ctx === 'object') ? clone(ctx) : {};
        var mode = String(c.mode || 'frame');
        if (mode !== 'before' && mode !== 'after' && mode !== 'frame') mode = 'frame';
        var source = String(c.source || 'frame');
        if (source !== 'command' && source !== 'routeCmd' && source !== 'frame') source = 'frame';
        var frame = Math.max(0, Math.floor(Number(c.frame == null ? fallbackFrame : c.frame)));
        if (!isFinite(frame)) frame = Math.max(0, Math.floor(Number(fallbackFrame || 0)));
        var branchIndent = (c.branchInsertIndent == null) ? null : Math.floor(Number(c.branchInsertIndent));
        if (branchIndent != null) {
            if (!isFinite(branchIndent)) branchIndent = null;
            else branchIndent = Math.max(0, branchIndent);
        }
        var shiftMap = null;
        if (c.branchShiftUidMap && typeof c.branchShiftUidMap === 'object' && !Array.isArray(c.branchShiftUidMap)) {
            shiftMap = Object.create(null);
            var keys = Object.keys(c.branchShiftUidMap);
            for (var i = 0; i < keys.length; i++) {
                var k = String(keys[i] || '');
                if (!k.length) continue;
                if (!c.branchShiftUidMap[k]) continue;
                shiftMap[k] = true;
            }
        }
        return {
            mode: mode,
            source: source,
            frame: frame,
            uid: Math.floor(Number(c.uid || 0)),
            routeListIndex: this.nodeRouteIndex(c.routeListIndex),
            branchInsertIndent: branchIndent,
            branchIfUid: Math.floor(Number(c.branchIfUid || 0)),
            branchShiftUidMap: shiftMap
        };
    };

    EE.prototype.resolveAddAnchorFromPlacementContext = function(ctx) {
        ctx = this.resolveAddPlacementContext(ctx, this.frame);
        var out = {
            source: ctx.source,
            frame: Math.max(0, Math.floor(Number(ctx.frame || 0))),
            span: 0
        };
        if (ctx.source === 'command') {
            var e = this.findEntryInSelectedTrack(ctx.uid);
            if (e) {
                out.frame = Math.max(0, Math.floor(Number(e.frame || 0)));
                out.span = Math.max(0, Math.floor(Number(e.wait || 0)));
            }
        } else if (ctx.source === 'routeCmd') {
            var re = this.findEntryInSelectedTrack(ctx.uid);
            if (re && re.command && Number(re.command.code || 0) === 205) {
                out.frame = Math.max(0, Math.floor(Number(re.frame || 0)));
                var route = re.command.parameters && re.command.parameters[1];
                var tl = this.moveRouteTimeline(route);
                var items = tl && Array.isArray(tl.items) ? tl.items : [];
                for (var i = 0; i < items.length; i++) {
                    var it = items[i];
                    if (!it) continue;
                    if (this.nodeRouteIndex(it.listIndex) !== this.nodeRouteIndex(ctx.routeListIndex)) continue;
                    out.frame = Math.max(0, Math.floor(Number(re.frame || 0)) + Math.max(0, Math.floor(Number(it.offset || 0))));
                    out.span = Math.max(0, Math.floor(Number(it.span || 0)));
                    break;
                }
            }
        }
        return out;
    };

    EE.prototype.computeAddFrameFromPlacementContext = function(ctx, newWait) {
        ctx = this.resolveAddPlacementContext(ctx, this.frame);
        newWait = Math.max(0, Math.floor(Number(newWait || 0)));
        var anc = this.resolveAddAnchorFromPlacementContext(ctx);
        if (ctx.mode === 'before') return Math.max(0, Math.floor(Number(anc.frame || 0)));
        if (ctx.mode === 'after') {
            var base = Math.max(0, Math.floor(Number(anc.frame || 0)));
            var span = Math.max(0, Math.floor(Number(anc.span || 0)));
            if (span > 0) return base + span;
            return base;
        }
        return Math.max(0, Math.floor(Number(anc.frame || 0)));
    };

    EE.prototype.isFrameLockedForFrameCommandAdd = function(frame) {
        if (!this.needSelTrack()) return true;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return true;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            if (w <= 0) continue;
            var isMain = (String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main')) === 'main');
            var isRouteWait = this.isMoveRouteWaitEnabledEntry(e);
            if (!isMain && !isRouteWait) continue;
            var ed = s + w;
            if (frame > s && frame < ed) return true;
        }
        return false;
    };

    EE.prototype.waitInsertStartFrameForContext = function(ctx, pos) {
        ctx = this.resolveWaitInsertContext(ctx);
        pos = String(pos || 'before') === 'after' ? 'after' : 'before';
        if (ctx.source === 'selection') {
            return (pos === 'before') ? ctx.frameStart : (ctx.frameEnd + 1);
        }
        if (ctx.source === 'routeCmd') {
            return ctx.frame;
        }
        if (ctx.source === 'command') {
            // Command-context insertion treats the whole frame as one block so
            // sibling commands on the same frame move together.
            if (pos === 'after' && !ctx.includeSameFrameOnAfter) return Math.max(0, ctx.frame + 1);
            return ctx.frame;
        }
        return (pos === 'before') ? ctx.frame : Math.max(0, ctx.frame + 1);
    };

    EE.prototype.shiftRangeSelectionAfterWaitInsert = function(startFrame, frames) {
        if (!this.hasRangeSelection()) return;
        var rs = this.rangeSelection || null;
        if (!rs) return;
        startFrame = Math.max(0, Math.floor(Number(startFrame || 0)));
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        if (fe < startFrame) return;
        if (fs >= startFrame) {
            rs.frameStart = fs + frames;
            rs.frameEnd = fe + frames;
        } else {
            rs.frameStart = fs;
            rs.frameEnd = fe + frames;
        }
        var shiftPx = frames * Number(this.pxPerFrame || 0);
        if (shiftPx > 0 && Array.isArray(rs.rects) && rs.rects.length) {
            var sx = this.frameToX(startFrame);
            for (var i = 0; i < rs.rects.length; i++) {
                var rc = rs.rects[i];
                if (!rc) continue;
                if (Number(rc.x1 || 0) >= sx) rc.x1 += shiftPx;
                if (Number(rc.x2 || 0) >= sx) rc.x2 += shiftPx;
            }
        }
    };

    EE.prototype.applyWaitFrameInsertion = function(startFrame, frames) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        startFrame = Math.max(0, Math.floor(Number(startFrame || 0)));
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        this.pushSnap('waitGap');
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var old = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (old >= startFrame) e.frame = old + frames;
        }
        if (Math.max(0, Math.floor(Number(this.frame || 0))) >= startFrame) {
            this.frame = Math.max(0, Math.floor(Number(this.frame || 0))) + frames;
        }
        this.shiftRangeSelectionAfterWaitInsert(startFrame, frames);
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.applyIfBranchScopedWaitInsertionByUidMap = function(uidMap, frames) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        if (!uidMap || typeof uidMap !== 'object') return false;
        frames = Math.max(1, Math.floor(Number(frames || 1)));

        var targets = [];
        var minShiftFrame = Infinity;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var euid = Math.floor(Number(e.uid || 0));
            if (euid <= 0 || !uidMap[String(euid)]) continue;
            targets.push(e);
            var ef = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (ef < minShiftFrame) minShiftFrame = ef;
        }
        if (!targets.length) return true;

        this.pushSnap('waitGap');
        for (i = 0; i < targets.length; i++) {
            var te = targets[i];
            te.frame = Math.max(0, Math.floor(Number(te.frame || 0))) + frames;
        }

        if (!isFinite(minShiftFrame)) minShiftFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (Math.max(0, Math.floor(Number(this.frame || 0))) >= minShiftFrame) {
            this.frame = Math.max(0, Math.floor(Number(this.frame || 0))) + frames;
        }
        this.shiftRangeSelectionAfterWaitInsert(minShiftFrame, frames);
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.applyWaitInsertionFromIfBranchCommandContext = function(ctx, pos, frames) {
        ctx = this.resolveWaitInsertContext(ctx);
        pos = String(pos || 'before') === 'after' ? 'after' : 'before';
        if (String(ctx.source || '') !== 'command') return false;
        var uid = Math.floor(Number(ctx.uid || 0));
        if (uid <= 0) return false;
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command) return false;
        var resolveBranchShiftEndIndex = function(scopeLike) {
            if (!scopeLike || !Array.isArray(scopeLike.list)) return -1;
            var endIdx = Math.floor(Number(scopeLike.endIndex || -1));
            if (endIdx >= 0 && endIdx < scopeLike.list.length) return endIdx; // include 412
            return Math.floor(Number(scopeLike.endIndexInclusive || -1));
        };
        var uidMap = null;
        if (Number(e.command.code || 0) === 111 && pos === 'after') {
            var branchInfo = this.resolveIfBranchInsertionInfoByUid(uid);
            if (branchInfo && Array.isArray(branchInfo.list) && branchInfo.anchorIndex >= 0) {
                var endTo = resolveBranchShiftEndIndex(branchInfo);
                uidMap = this.buildIfBranchShiftUidMap(
                    branchInfo.list,
                    branchInfo.anchorIndex + 1,
                    endTo
                );
            }
        } else {
            var scope = this.resolveIfBranchScopeForEntryUid(uid);
            if (scope && Array.isArray(scope.list) && scope.entryIndex >= 0) {
                var fromIdx = (pos === 'before') ? scope.entryIndex : (scope.entryIndex + 1);
                fromIdx = Math.max(scope.startIndex, fromIdx);
                var scopeEndTo = resolveBranchShiftEndIndex(scope);
                uidMap = this.buildIfBranchShiftUidMap(
                    scope.list,
                    fromIdx,
                    scopeEndTo
                );
            }
        }
        if (!uidMap) return false;
        return this.applyIfBranchScopedWaitInsertionByUidMap(uidMap, frames);
    };

    EE.prototype.routeCommandTimelineItemByListIndex = function(entry, routeListIndex) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return null;
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (routeListIndex < 0) return null;
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var items = tl && Array.isArray(tl.items) ? tl.items : [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it) continue;
            if (this.nodeRouteIndex(it.listIndex) === routeListIndex) return it;
        }
        return null;
    };

    EE.prototype.shiftFollowingCommandsAllRows = function(tr, startFrame, frames, ignoreUid) {
        if (!tr || !Array.isArray(tr.commands)) return;
        startFrame = Math.max(0, Math.floor(Number(startFrame || 0)));
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        ignoreUid = Math.floor(Number(ignoreUid || 0));
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (ignoreUid > 0 && Math.floor(Number(e.uid || 0)) === ignoreUid) continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f >= startFrame) e.frame = f + frames;
        }
    };

    EE.prototype.applyRouteCommandWaitInsertion = function(ctx, pos, frames) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        ctx = this.resolveWaitInsertContext(ctx);
        if (String(ctx.source || '') !== 'routeCmd') return false;
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        pos = (String(pos || 'before') === 'after') ? 'after' : 'before';
        var entry = this.findEntryInSelectedTrack(ctx.uid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return false;
        var it = this.routeCommandTimelineItemByListIndex(entry, ctx.routeListIndex);
        if (!it) {
            var fallback = this.routeTimelineItemAtFrame(entry, ctx.frame);
            if (fallback && this.nodeRouteIndex(fallback.listIndex) >= 0) {
                ctx.routeListIndex = this.nodeRouteIndex(fallback.listIndex);
                it = this.routeCommandTimelineItemByListIndex(entry, ctx.routeListIndex);
            }
            if (!it) return false;
        }
        this.pushSnap('waitGapRouteCmd');
        var oldCmd = clone(entry.command);
        var oldWait = Math.max(1, Math.floor(Number(entry.wait || 1)));
        var insertOffset = Math.max(0, Math.floor(Number(it.offset || 0)));
        if (pos === 'after') insertOffset += Math.max(1, Math.floor(Number(it.span || 1)));
        var insFrame = Math.max(0, Math.floor(Number(entry.frame || 0)) + insertOffset);
        var insertedIdx = this.insertRouteCommandIntoEntry(entry, { code: 15, parameters: [frames] }, insFrame);
        if (insertedIdx < 0) {
            entry.command = oldCmd;
            entry.wait = oldWait;
            return false;
        }
        entry.wait = this.commandWaitFrames(entry.command);
        var newWait = Math.max(1, Math.floor(Number(entry.wait || 1)));
        var delta = Math.max(0, newWait - oldWait);
        var route = this.routeOptionsFromEntry(entry);
        var routeWaitOn = !!(route && route.wait);
        var shifted = [];
        if (routeWaitOn && delta > 0) {
            var startSlide = Math.max(0, Math.floor(Number(entry.frame || 0)) + oldWait);
            for (var si = 0; si < tr.commands.length; si++) {
                var se = tr.commands[si];
                if (!se) continue;
                if (Number(se.uid || 0) === Number(entry.uid || 0)) continue;
                var sf = Math.max(0, Math.floor(Number(se.frame || 0)));
                if (sf >= startSlide) {
                    shifted.push({ e: se, old: sf });
                    se.frame = sf + delta;
                }
            }
            if (Math.max(0, Math.floor(Number(this.frame || 0))) >= startSlide) this.frame += delta;
            this.shiftRangeSelectionAfterWaitInsert(startSlide, delta);
        }
        if (!this.canPlaceEntry(tr, entry, entry.frame, entry.rowKey, entry.uid)) {
            for (var ri = 0; ri < shifted.length; ri++) shifted[ri].e.frame = shifted[ri].old;
            entry.command = oldCmd;
            entry.wait = oldWait;
            return false;
        }
        var selRouteIdx = this.nodeRouteIndex(ctx.routeListIndex);
        if (selRouteIdx >= 0 && pos === 'before') selRouteIdx += 1;
        if (selRouteIdx >= 0 && !this.routeCommandTimelineItemByListIndex(entry, selRouteIdx)) {
            var alt = this.nodeRouteIndex(ctx.routeListIndex);
            selRouteIdx = this.routeCommandTimelineItemByListIndex(entry, alt) ? alt : -1;
        }
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.selUid = Number(entry.uid || 0);
        this.selRouteListIndex = selRouteIdx;
        this.frame = Math.max(0, Math.floor(Number(insFrame || this.frame || 0)));
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.openWaitInsertDialog = function(ctx) {
        if (!this.waitInsertModal || !this.waitInsertFrameInput || !this.waitInsertPosBefore || !this.waitInsertPosAfter) return;
        this.waitInsertDialogContext = this.resolveWaitInsertContext(ctx || this.makeWaitInsertContextFromFrame(this.frame));
        var def = Math.max(1, Math.floor(Number(this.waitInsertDialogContext.defaultFrames || 60)));
        this.waitInsertPosBefore.checked = false;
        this.waitInsertPosAfter.checked = true;
        this.waitInsertFrameInput.value = String(def);
        if (this.waitInsertInfo) this.waitInsertInfo.textContent = this.waitInsertContextInfoText(this.waitInsertDialogContext);
        this.waitInsertModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.waitInsertModal);
        this.waitInsertFrameInput.focus();
        this.waitInsertFrameInput.select();
    };

    EE.prototype.closeWaitInsertDialog = function() {
        this.waitInsertDialogContext = null;
        if (this.waitInsertModal) this.waitInsertModal.classList.remove('on');
    };

    EE.prototype.submitWaitInsertDialog = function() {
        if (!this.waitInsertDialogContext) return;
        var frames = Math.max(1, Math.floor(Number(this.waitInsertFrameInput && this.waitInsertFrameInput.value || 0) || 1));
        var pos = (this.waitInsertPosAfter && this.waitInsertPosAfter.checked) ? 'after' : 'before';
        var ctx = this.waitInsertDialogContext;
        var ok = false;
        if (String(ctx && ctx.source || '') === 'routeCmd') {
            ok = this.applyRouteCommandWaitInsertion(ctx, pos, frames);
            if (ok) {
                this.closeWaitInsertDialog();
                this.msg('移動ルート内ウェイト挿入: ' + frames + 'f');
                return;
            }
        } else {
            if (this.applyWaitInsertionFromIfBranchCommandContext(ctx, pos, frames)) {
                this.closeWaitInsertDialog();
                this.msg('分岐内ウェイト挿入: ' + frames + 'f');
                return;
            }
            var startFrame = this.waitInsertStartFrameForContext(ctx, pos);
            ok = this.applyWaitFrameInsertion(startFrame, frames);
            if (ok) {
                this.closeWaitInsertDialog();
                this.msg('ウェイト挿入: ' + startFrame + 'f から ' + frames + 'f');
                return;
            }
        }
        this.msg('ウェイト挿入失敗');
    };

    EE.prototype.openWaitInsertDialogFromContextMenu = function() {
        var ctx = this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame);
        if (ctx && this.hasRangeSelection()) {
            ctx = clone(ctx);
            ctx.defaultFrames = this.waitInsertDefaultFramesFromSelection();
        }
        this.closeRouteRangeContextMenu();
        this.openWaitInsertDialog(ctx);
    };

    EE.prototype.openRouteRangeContextMenu = function(uid, screenX, screenY, waitInsertContext) {
        if (!this.routeCtx) return;
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return;
        this.routeCtxMode = 'route';
        this.routeRangeCtxUid = uid;
        this.routeCtxWaitInsertContext = this.resolveWaitInsertContext(waitInsertContext || this.makeWaitInsertContextFromCommand(uid, this.frame));
        this.routeCtx.classList.add('on');
        this.placeMenuInViewport(this.routeCtx, Number(screenX || 0) + 20, screenY, 4);
        this.refreshRouteRangeContextMenu();
    };

    EE.prototype.openSelectionContextMenu = function(screenX, screenY, waitInsertContext) {
        if (!this.routeCtx) return;
        this.routeCtxMode = 'selection';
        this.routeRangeCtxUid = 0;
        this.routeCtxWaitInsertContext = this.resolveWaitInsertContext(waitInsertContext || this.makeWaitInsertContextFromSelection());
        this.routeCtx.classList.add('on');
        this.placeMenuInViewport(this.routeCtx, Number(screenX || 0) + 20, screenY, 4);
        this.refreshRouteRangeContextMenu();
    };

    EE.prototype.openTimelineContextMenu = function(screenX, screenY, waitInsertContext) {
        if (!this.routeCtx) return;
        var rawCtx = waitInsertContext || this.makeWaitInsertContextFromFrame(this.frame);
        var isEndMarkerContext = !!(rawCtx && typeof rawCtx === 'object' && rawCtx.endMarker);
        this.routeCtxMode = isEndMarkerContext ? 'endMarker' : 'timeline';
        this.routeRangeCtxUid = 0;
        this.routeCtxWaitInsertContext = this.resolveWaitInsertContext(rawCtx);
        if (isEndMarkerContext && this.routeCtxWaitInsertContext) this.routeCtxWaitInsertContext.endMarker = true;
        this.routeCtx.classList.add('on');
        this.placeMenuInViewport(this.routeCtx, Number(screenX || 0) + 20, screenY, 4);
        this.refreshRouteRangeContextMenu();
    };

    EE.prototype.toggleRouteRangeOption = function(key) {
        if (key !== 'repeat' && key !== 'skippable' && key !== 'wait') return;
        var e = this.findRouteRangeEntryByUid(this.routeRangeCtxUid);
        if (!e) return;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return;
        var route = e.command.parameters && e.command.parameters[1];
        if (!route || typeof route !== 'object') return;
        var next = !route[key];
        if (key === 'wait' && next) {
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var ed = s + Math.max(0, Math.floor(Number(e.wait || 0)));
            if (this.hasMainCommandInRange(tr, s, ed, 0)) {
                this.err('E_ROUTE_WAIT_MAIN_CONFLICT', new Error('main command exists in route wait range'));
                this.msg('完了までウェイトON不可: main範囲内にコマンドがあります');
                return;
            }
        }
        if (key === 'wait') {
            var probeCmd = clone(e.command || { code: 205, parameters: [0, this.defaultMoveRoute()] });
            if (!Array.isArray(probeCmd.parameters)) probeCmd.parameters = [0, this.defaultMoveRoute()];
            var probeRoute = probeCmd.parameters[1];
            if (!probeRoute || typeof probeRoute !== 'object') probeRoute = this.defaultMoveRoute();
            probeCmd.parameters[1] = probeRoute;
            probeRoute.wait = next;
            var probe = clone(e);
            probe.command = probeCmd;
            probe.wait = this.commandWaitFrames(probeCmd);
            if (!this.canPlaceEntry(tr, probe, probe.frame, probe.rowKey, probe.uid)) {
                this.msg('完了までウェイト変更不可: 移動ルートが重なります');
                return;
            }
        }
        this.pushSnap('routeOption');
        route[key] = next;
        e.wait = this.commandWaitFrames(e.command);
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        var label = (key === 'repeat')
            ? '動作を繰り返す'
            : (key === 'skippable' ? '移動できない場合は飛ばす' : '完了までウェイト');
        this.msg(label + ': ' + (route[key] ? 'ON' : 'OFF'));
    };

    EE.prototype.openCharContextMenu = function(charId, screenX, screenY) {
        if (!this.charCtx || !this.charCtxCmdAddBtn || !this.charCtxTileMoveBtn || !this.charCtxTeleportBtn || !this.charCtxInitPosBtn || !this.charCtxEditBtn ||
            !this.charCtxShiftAdjustBtn || !this.charCtxOriginAdjustBtn || !this.charCtxRangeAdjustBtn || !this.charCtxCreateBtn) return;
        this.closeCameraContextMenu();
        this.charCtxTargetId = this.normalizeMoveTarget(charId);
        var hasTrack = !!(this.selEid && this.selPage >= 0 && this.selKey);
        var targetRawId = Math.floor(Number(this.charCtxTargetId || 0));
        var targetId = Math.max(0, targetRawId);
        var isPlayerTarget = (targetRawId === -1);
        var hasTargetEvent = !!($dataMap && Array.isArray($dataMap.events) && targetRawId > 0 && $dataMap.events[targetRawId]);
        var mp = this.updateMapCreateContextPointFromScreen(screenX, screenY);
        var canCreateEvent = this.isPointInFixedViewportRect(Number(screenX || 0), Number(screenY || 0)) &&
            this.cameraContextMapPointIsValid(mp);
        this.charCtxCmdAddBtn.disabled = !hasTrack;
        this.charCtxCmdAddBtn.textContent = hasTrack ? 'コマンド追加' : 'イベント未選択';
        this.charCtxTileMoveBtn.disabled = !hasTrack;
        this.charCtxTileMoveBtn.textContent = hasTrack ? 'タイル移動' : 'イベント未選択';
        this.charCtxTeleportBtn.disabled = !hasTrack;
        this.charCtxTeleportBtn.textContent = hasTrack ? '瞬間移動' : 'イベント未選択';
        this.charCtxInitPosBtn.disabled = !hasTargetEvent;
        this.charCtxInitPosBtn.textContent = hasTargetEvent ? '初期位置編集' : 'イベントのみ';
        this.charCtxEditBtn.disabled = !hasTargetEvent;
        this.charCtxEditBtn.textContent = hasTargetEvent ? '編集' : 'イベントのみ';
        this.charCtxShiftAdjustBtn.disabled = !hasTargetEvent;
        this.charCtxShiftAdjustBtn.textContent = hasTargetEvent ? 'Shift調整' : 'イベントのみ';
        this.charCtxOriginAdjustBtn.disabled = !hasTargetEvent;
        this.charCtxOriginAdjustBtn.textContent = hasTargetEvent ? 'OriginY調整' : 'イベントのみ';
        this.charCtxRangeAdjustBtn.disabled = !hasTargetEvent;
        this.charCtxRangeAdjustBtn.textContent = hasTargetEvent ? '当たり判定設定' : 'イベントのみ';
        this.charCtxEditBtn.style.display = isPlayerTarget ? 'none' : 'block';
        this.charCtxInitPosBtn.style.display = isPlayerTarget ? 'none' : 'block';
        this.charCtxShiftAdjustBtn.style.display = isPlayerTarget ? 'none' : 'block';
        this.charCtxOriginAdjustBtn.style.display = isPlayerTarget ? 'none' : 'block';
        this.charCtxRangeAdjustBtn.style.display = isPlayerTarget ? 'none' : 'block';
        this.charCtxCreateBtn.disabled = !canCreateEvent;
        this.charCtxCreateBtn.textContent = canCreateEvent ? 'イベント新規作成' : 'イベント新規作成(範囲外)';
        this.charCtx.classList.add('on');
        this.placeMenuInViewport(this.charCtx, Number(screenX || 0) + 20, screenY, 4);
    };

    EE.prototype.openContextCharacterRouteCommandPanel = function() {
        var id = this.charCtxTargetId;
        this.closeCharContextMenu();
        if (id == null) return;
        var cid = this.normalizeMoveTarget(id);
        if (!this.needSelTrack()) return;
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = cid;
        this.cleanupTemporaryCharRows(cid);
        this.refreshCharacterPanel(true);
        this.timelineDirty = true;
        this.openRouteCommandPanel(this.frame, 'char:' + cid);
    };

    EE.prototype.beginTileMoveForContextCharacter = function() {
        var id = this.charCtxTargetId;
        this.closeCharContextMenu();
        if (id == null) return;
        this.beginTileMoveForCharacter(id, 'route');
    };

    EE.prototype.beginTeleportForContextCharacter = function() {
        var id = this.charCtxTargetId;
        this.closeCharContextMenu();
        if (id == null) return;
        this.beginTeleportForCharacter(id);
    };

    EE.prototype.beginInitialPositionEditForContextCharacter = function() {
        var eventId = Math.max(0, Math.floor(Number(this.charCtxTargetId || 0)));
        this.closeCharContextMenu();
        if (eventId <= 0) {
            this.msg('イベントのみ編集できます');
            return;
        }
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eventId] : null;
        if (!evData) {
            this.msg('イベントが見つかりません');
            return;
        }
        if (typeof this.beginInitialPositionEditForCharacter === 'function') {
            this.beginInitialPositionEditForCharacter(eventId);
        }
    };

    EE.prototype.createMapEventFromCharContextMenu = function() {
        this.closeCharContextMenu();
        this.createMapEventFromContextMenu();
    };

    EE.prototype.eventSettingsSwitchOptions = function() {
        var out = [];
        var arr = ($dataSystem && Array.isArray($dataSystem.switches)) ? $dataSystem.switches : [];
        for (var i = 1; i < arr.length; i++) {
            var name = String(arr[i] || '');
            if (!name.length) name = '(未設定)';
            out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + name });
        }
        if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
        return out;
    };

    EE.prototype.eventSettingsFallbackDbOptions = function(arr, emptyLabel) {
        var out = [];
        arr = Array.isArray(arr) ? arr : [];
        for (var i = 1; i < arr.length; i++) {
            var it = arr[i];
            if (!it) continue;
            var name = String(it.name || it.label || it.title || '');
            if (!name.length) name = '(未設定)';
            out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + name });
        }
        if (!out.length) out.push({ value: 1, label: '0001 ' + String(emptyLabel || '(未設定)') });
        return out;
    };

    EE.prototype.eventSettingsFillSelect = function(select, options, value) {
        if (!select) return;
        options = Array.isArray(options) ? options : [];
        var prev = (value == null) ? String(select.value || '') : String(value);
        select.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < options.length; i++) {
            var src = options[i] || {};
            var op = document.createElement('option');
            op.value = String(src.value == null ? '' : src.value);
            op.textContent = String(src.label == null ? op.value : src.label);
            frag.appendChild(op);
        }
        select.appendChild(frag);
        if (options.length) {
            select.value = prev;
            if (select.selectedIndex < 0) select.selectedIndex = 0;
        }
    };

    EE.prototype.eventSettingsPromptSelectId = function(select, titleText) {
        if (!select || select.disabled) return;
        var cur = Math.max(1, Math.floor(Number(select.value || 1)));
        var msg = String(titleText || 'ID') + ' を入力してください';
        var raw = window.prompt(msg, String(cur));
        if (raw == null) return;
        var id = Math.max(1, Math.floor(Number(raw || cur) || cur));
        var found = false;
        for (var i = 0; i < select.options.length; i++) {
            if (String(select.options[i].value || '') !== String(id)) continue;
            found = true;
            break;
        }
        if (found) select.value = String(id);
        else if (select.options.length) select.selectedIndex = Math.max(0, Math.min(select.options.length - 1, id - 1));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    EE.prototype.battleEventSettingsTargetTroopData = function() {
        var tid = Math.max(1, Math.floor(Number(this.battleEventSettingsTargetTroopId || this.currentBattleTroopId() || 0)));
        var troop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[tid] : null;
        if (!troop) return null;
        if (!Array.isArray(troop.pages)) troop.pages = [];
        return troop;
    };

    EE.prototype.battleEventSettingsEnsurePage = function(page) {
        if (!page || typeof page !== 'object') page = {};
        if (!page.conditions || typeof page.conditions !== 'object') page.conditions = {};
        var c = page.conditions;
        if (c.turnEnding == null) c.turnEnding = false;
        if (c.turnValid == null) c.turnValid = false;
        if (c.turnA == null) c.turnA = 0;
        if (c.turnB == null) c.turnB = 0;
        if (c.enemyValid == null) c.enemyValid = false;
        if (c.enemyIndex == null) c.enemyIndex = 0;
        if (c.enemyHp == null) c.enemyHp = 100;
        if (c.actorValid == null) c.actorValid = false;
        if (c.actorId == null) c.actorId = 1;
        if (c.actorHp == null) c.actorHp = 100;
        if (c.switchValid == null) c.switchValid = false;
        if (c.switchId == null) c.switchId = 1;
        if (page.span == null) page.span = 0;
        if (!Array.isArray(page.list)) page.list = [{ code: 0, indent: 0, parameters: [] }];
        return page;
    };

    EE.prototype.battleEventSettingsPopulateConditionLists = function() {
        var actorOptions = (typeof this.actorOptionsForSchema === 'function')
            ? this.actorOptionsForSchema()
            : this.eventSettingsFallbackDbOptions($dataActors, '(アクターなし)');
        var swOptions = this.eventSettingsSwitchOptions();
        this.eventSettingsFillSelect(this.battleEventActorId, actorOptions);
        this.eventSettingsFillSelect(this.battleEventSwitchId, swOptions);
    };

    EE.prototype.syncBattleEventSettingsFormEnabled = function() {
        if (!this.battleEventSettingsModal) return;
        var turnOn = !!(this.battleEventTurnValid && this.battleEventTurnValid.checked);
        var enemyOn = !!(this.battleEventEnemyValid && this.battleEventEnemyValid.checked);
        var actorOn = !!(this.battleEventActorValid && this.battleEventActorValid.checked);
        var swOn = !!(this.battleEventSwitchValid && this.battleEventSwitchValid.checked);
        if (this.battleEventTurnA) this.battleEventTurnA.disabled = !turnOn;
        if (this.battleEventTurnB) this.battleEventTurnB.disabled = !turnOn;
        if (this.battleEventEnemyIndex) this.battleEventEnemyIndex.disabled = !enemyOn;
        if (this.battleEventEnemyHp) this.battleEventEnemyHp.disabled = !enemyOn;
        if (this.battleEventActorId) this.battleEventActorId.disabled = !actorOn;
        if (this.battleEventActorHp) this.battleEventActorHp.disabled = !actorOn;
        if (this.battleEventSwitchId) this.battleEventSwitchId.disabled = !swOn;
    };

    EE.prototype.battleEventSettingsRebuildPageSelectOptions = function(troop, selectedIndex) {
        if (!this.battleEventSettingsPageSelect || !troop || !Array.isArray(troop.pages)) return;
        this.battleEventSettingsPageSelect.innerHTML = '';
        for (var i = 0; i < troop.pages.length; i++) {
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = String(i + 1);
            this.battleEventSettingsPageSelect.appendChild(op);
        }
        var idx = Math.max(0, Math.floor(Number(selectedIndex || 0)));
        if (idx >= troop.pages.length) idx = troop.pages.length - 1;
        this.battleEventSettingsPageSelect.value = String(Math.max(0, idx));
        this.battleEventSettingsTargetPageIndex = Math.max(0, idx);
    };

    EE.prototype.loadBattleEventSettingsPageFromForm = function() {
        var troop = this.battleEventSettingsTargetTroopData();
        if (!troop || !Array.isArray(troop.pages) || !troop.pages.length) return;
        var pageIndex = Math.max(0, Math.floor(Number(this.battleEventSettingsPageSelect && this.battleEventSettingsPageSelect.value || 0)));
        if (pageIndex >= troop.pages.length) pageIndex = troop.pages.length - 1;
        if (this.battleEventSettingsPageSelect) this.battleEventSettingsPageSelect.value = String(pageIndex);
        this.battleEventSettingsTargetPageIndex = pageIndex;
        var page = this.battleEventSettingsEnsurePage(troop.pages[pageIndex] || {});
        troop.pages[pageIndex] = page;
        var c = (page.conditions && typeof page.conditions === 'object') ? page.conditions : {};
        if (this.battleEventTurnEnding) this.battleEventTurnEnding.checked = !!c.turnEnding;
        if (this.battleEventTurnValid) this.battleEventTurnValid.checked = !!c.turnValid;
        if (this.battleEventTurnA) this.battleEventTurnA.value = String(Math.max(0, Math.floor(Number(c.turnA || 0))));
        if (this.battleEventTurnB) this.battleEventTurnB.value = String(Math.max(0, Math.floor(Number(c.turnB || 0))));
        if (this.battleEventEnemyValid) this.battleEventEnemyValid.checked = !!c.enemyValid;
        if (this.battleEventEnemyIndex) this.battleEventEnemyIndex.value = String(Math.max(1, Math.floor(Number(c.enemyIndex || 0)) + 1));
        if (this.battleEventEnemyHp) this.battleEventEnemyHp.value = String(Math.max(0, Math.floor(Number(c.enemyHp == null ? 100 : c.enemyHp))));
        if (this.battleEventActorValid) this.battleEventActorValid.checked = !!c.actorValid;
        if (this.battleEventActorId) this.battleEventActorId.value = String(Math.max(1, Math.floor(Number(c.actorId || 1))));
        if (this.battleEventActorHp) this.battleEventActorHp.value = String(Math.max(0, Math.floor(Number(c.actorHp == null ? 100 : c.actorHp))));
        if (this.battleEventSwitchValid) this.battleEventSwitchValid.checked = !!c.switchValid;
        if (this.battleEventSwitchId) this.battleEventSwitchId.value = String(Math.max(1, Math.floor(Number(c.switchId || 1))));
        if (this.battleEventSpan) this.battleEventSpan.value = String(Math.max(0, Math.min(2, Math.floor(Number(page.span || 0)))));
        if (this.battleEventSettingsHead) {
            this.battleEventSettingsHead.textContent =
                'Troop:' + this.battleEventSettingsTargetTroopId + ' - 戦闘イベント設定 (Page ' + (pageIndex + 1) + ')';
        }
        this.syncBattleEventSettingsFormEnabled();
    };

    EE.prototype.openBattleEventSettingsEditor = function(troopId) {
        if (!this.isBattleEventMode()) return;
        if (!this.battleEventSettingsModal || !this.battleEventSettingsPageSelect) return;
        if (this.eventSettingsModal && this.eventSettingsModal.classList.contains('on')) {
            this.closeEventSettingsEditor();
        }
        troopId = Math.max(1, Math.floor(Number(troopId || this.currentBattleTroopId() || 0)));
        var troop = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops[troopId] : null;
        if (!troop || !Array.isArray(troop.pages) || !troop.pages.length) {
            this.msg('戦闘ページがありません');
            return;
        }
        this.battleEventSettingsTargetTroopId = troopId;
        var pageIndex = (this.selEid === troopId && this.selPage >= 0) ? this.selPage : 0;
        this.battleEventSettingsPopulateConditionLists();
        this.battleEventSettingsRebuildPageSelectOptions(troop, pageIndex);
        this.loadBattleEventSettingsPageFromForm();
        this.battleEventSettingsModal.classList.add('on');
    };

    EE.prototype.closeBattleEventSettingsEditor = function() {
        if (!this.battleEventSettingsModal) return;
        this.battleEventSettingsModal.classList.remove('on');
        this.battleEventSettingsTargetTroopId = 0;
        this.battleEventSettingsTargetPageIndex = 0;
    };

    EE.prototype.applyBattleEventSettingsEditor = function() {
        var troop = this.battleEventSettingsTargetTroopData();
        if (!troop || !Array.isArray(troop.pages) || !troop.pages.length) {
            this.closeBattleEventSettingsEditor();
            return;
        }
        var troopId = Math.max(1, Math.floor(Number(this.battleEventSettingsTargetTroopId || 0)));
        var pageIndex = Math.max(0, Math.floor(Number(this.battleEventSettingsPageSelect && this.battleEventSettingsPageSelect.value || this.battleEventSettingsTargetPageIndex || 0)));
        if (pageIndex >= troop.pages.length) pageIndex = troop.pages.length - 1;
        var page = this.battleEventSettingsEnsurePage(troop.pages[pageIndex] || {});
        troop.pages[pageIndex] = page;
        var c = (page.conditions && typeof page.conditions === 'object') ? page.conditions : (page.conditions = {});
        c.turnEnding = !!(this.battleEventTurnEnding && this.battleEventTurnEnding.checked);
        c.turnValid = !!(this.battleEventTurnValid && this.battleEventTurnValid.checked);
        c.turnA = Math.max(0, Math.floor(Number(this.battleEventTurnA && this.battleEventTurnA.value || 0)));
        c.turnB = Math.max(0, Math.floor(Number(this.battleEventTurnB && this.battleEventTurnB.value || 0)));
        c.enemyValid = !!(this.battleEventEnemyValid && this.battleEventEnemyValid.checked);
        c.enemyIndex = Math.max(0, Math.floor(Number(this.battleEventEnemyIndex && this.battleEventEnemyIndex.value || 1)) - 1);
        c.enemyHp = Math.max(0, Math.floor(Number(this.battleEventEnemyHp && this.battleEventEnemyHp.value || 100)));
        c.actorValid = !!(this.battleEventActorValid && this.battleEventActorValid.checked);
        c.actorId = Math.max(1, Math.floor(Number(this.battleEventActorId && this.battleEventActorId.value || 1)));
        c.actorHp = Math.max(0, Math.floor(Number(this.battleEventActorHp && this.battleEventActorHp.value || 100)));
        c.switchValid = !!(this.battleEventSwitchValid && this.battleEventSwitchValid.checked);
        c.switchId = Math.max(1, Math.floor(Number(this.battleEventSwitchId && this.battleEventSwitchId.value || 1)));
        page.span = Math.max(0, Math.min(2, Math.floor(Number(this.battleEventSpan && this.battleEventSpan.value || 0))));
        if (!Array.isArray(page.list)) page.list = [{ code: 0, indent: 0, parameters: [] }];

        var dirtyKey = this.key(troopId, pageIndex);
        this.ensureTrack(troopId, pageIndex);
        this.dirty[dirtyKey] = true;
        this.selectBattleTrack(troopId, pageIndex, true);
        this.closeBattleEventSettingsEditor();
        this.msg('戦闘イベント設定を更新');
    };

    EE.prototype.eventSettingsRenderPageTabs = function(total, selectedIndex) {
        if (!this.eventSettingsPageTabs) return;
        var n = Math.max(0, Math.floor(Number(total || 0)));
        var si = Math.max(0, Math.floor(Number(selectedIndex || 0)));
        this.eventSettingsPageTabs.innerHTML = '';
        for (var i = 0; i < n; i++) {
            var b = this.el('button', 'es-tab' + (i === si ? ' on' : ''), String(i + 1));
            b.type = 'button';
            (function(idx, self) {
                b.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (!self.eventSettingsPageSelect) return;
                    self.eventSettingsPageSelect.value = String(idx);
                    self.loadEventSettingsEditorPageFromForm();
                });
            })(i, this);
            this.eventSettingsPageTabs.appendChild(b);
        }
    };

    EE.prototype.eventSettingsSyncPageTabsFromSelect = function() {
        if (!this.eventSettingsPageSelect) return;
        var total = this.eventSettingsPageSelect.options ? this.eventSettingsPageSelect.options.length : 0;
        var selectedIndex = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect.selectedIndex >= 0
            ? this.eventSettingsPageSelect.selectedIndex
            : this.eventSettingsPageSelect.value || 0)));
        this.eventSettingsRenderPageTabs(total, selectedIndex);
    };

    EE.prototype.eventSettingsTargetEventData = function() {
        var eid = Math.max(1, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        if (!evData || !Array.isArray(evData.pages)) return null;
        return evData;
    };

    EE.prototype.eventSettingsDefaultPageData = function() {
        return this.eventSettingsEnsurePage({});
    };

    EE.prototype.eventSettingsMarkDirtyForPageOps = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        this.dirty['es_pages:' + String(eventId)] = true;
        this.timelineDirty = true;
    };

    EE.prototype.eventSettingsRebuildPageSelectOptions = function(evData, selectedIndex) {
        if (!this.eventSettingsPageSelect || !evData || !Array.isArray(evData.pages)) return;
        this.eventSettingsPageSelect.innerHTML = '';
        for (var i = 0; i < evData.pages.length; i++) {
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = String(i + 1);
            this.eventSettingsPageSelect.appendChild(op);
        }
        var idx = Math.max(0, Math.floor(Number(selectedIndex || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        this.eventSettingsPageSelect.value = String(Math.max(0, idx));
        this.eventSettingsSyncPageTabsFromSelect();
        this.eventSettingsTargetPageIndex = Math.max(0, idx);
    };

    EE.prototype.eventSettingsRefreshPageActionButtons = function() {
        var evData = this.eventSettingsTargetEventData();
        var hasEvent = !!(evData && Array.isArray(evData.pages));
        var pageCount = hasEvent ? evData.pages.length : 0;
        var canPaste = !!(this.eventSettingsPageClipboard && typeof this.eventSettingsPageClipboard === 'object');
        if (this.eventSettingsPageCreateBtn) this.eventSettingsPageCreateBtn.disabled = !hasEvent;
        if (this.eventSettingsPageCopyBtn) this.eventSettingsPageCopyBtn.disabled = !hasEvent || pageCount <= 0;
        if (this.eventSettingsPagePasteBtn) this.eventSettingsPagePasteBtn.disabled = !hasEvent || !canPaste || pageCount <= 0;
        if (this.eventSettingsPageDeleteBtn) this.eventSettingsPageDeleteBtn.disabled = !hasEvent || pageCount <= 1;
        if (this.eventSettingsPageClearBtn) this.eventSettingsPageClearBtn.disabled = !hasEvent || pageCount <= 0;
    };

    EE.prototype.eventSettingsCreatePage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages)) return;
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        var insertAt = Math.max(0, idx + 1);
        evData.pages.splice(insertAt, 0, this.eventSettingsDefaultPageData());
        this.eventSettingsMarkDirtyForPageOps(this.eventSettingsTargetEventId);
        this.eventSettingsRebuildPageSelectOptions(evData, insertAt);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページ作成');
    };

    EE.prototype.eventSettingsCopyPage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        this.eventSettingsPageClipboard = clone(this.eventSettingsEnsurePage(evData.pages[idx] || {}));
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページコピー');
    };

    EE.prototype.eventSettingsPastePage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        if (!this.eventSettingsPageClipboard || typeof this.eventSettingsPageClipboard !== 'object') {
            this.msg('貼り付け元ページがありません');
            return;
        }
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        evData.pages[idx] = this.eventSettingsEnsurePage(clone(this.eventSettingsPageClipboard));
        this.eventSettingsMarkDirtyForPageOps(this.eventSettingsTargetEventId);
        this.eventSettingsRebuildPageSelectOptions(evData, idx);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページ貼り付け');
    };

    EE.prototype.eventSettingsDeletePage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || evData.pages.length <= 1) {
            this.msg('EVページは1枚未満にできません');
            return;
        }
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        evData.pages.splice(idx, 1);
        var next = Math.max(0, Math.min(evData.pages.length - 1, idx));
        this.eventSettingsMarkDirtyForPageOps(this.eventSettingsTargetEventId);
        this.eventSettingsRebuildPageSelectOptions(evData, next);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページ削除');
    };

    EE.prototype.eventSettingsClearPage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        evData.pages[idx] = this.eventSettingsDefaultPageData();
        this.eventSettingsMarkDirtyForPageOps(this.eventSettingsTargetEventId);
        this.eventSettingsRebuildPageSelectOptions(evData, idx);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページクリア');
    };

    EE.prototype.refreshEventSettingsImagePreview = function() {
        var cv = this.eventSettingsImagePreview;
        if (!cv || typeof cv.getContext !== 'function') return;
        var ctx = cv.getContext('2d');
        if (!ctx) return;
        var w = Math.max(1, Number(cv.width || 84));
        var h = Math.max(1, Number(cv.height || 112));
        ctx.clearRect(0, 0, w, h);
        var cs = 12;
        for (var y = 0; y < h; y += cs) {
            for (var x = 0; x < w; x += cs) {
                var odd = (((x / cs) | 0) + ((y / cs) | 0)) % 2;
                ctx.fillStyle = odd ? 'rgba(228,228,228,.88)' : 'rgba(198,198,198,.88)';
                ctx.fillRect(x, y, cs, cs);
            }
        }
        var useTile = !!(this.eventSettingsUseTile && this.eventSettingsUseTile.checked);
        if (useTile) {
            var tid = Math.max(0, Math.floor(Number(this.eventSettingsTileId && this.eventSettingsTileId.value || 0)));
            ctx.fillStyle = 'rgba(24,24,24,.82)';
            ctx.fillRect(0, h - 18, w, 18);
            ctx.fillStyle = 'rgba(244,244,244,.98)';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Tile ' + tid, Math.floor(w / 2), h - 9);
            if (this.eventSettingsImageInfo) this.eventSettingsImageInfo.textContent = 'タイルID: ' + tid;
            return;
        }

        var name = String(this.eventSettingsCharName && this.eventSettingsCharName.value || '');
        var index = Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsCharIndex && this.eventSettingsCharIndex.value || 0))));
        var dir = Math.floor(Number(this.eventSettingsDirection && this.eventSettingsDirection.value || 2));
        if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
        var patt = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPattern && this.eventSettingsPattern.value || 1))));
        if (this.eventSettingsImageInfo) {
            if (name.length) this.eventSettingsImageInfo.textContent = name + ' [' + index + ']';
            else this.eventSettingsImageInfo.textContent = '(画像未設定)';
        }
        if (!name.length || typeof ImageManager === 'undefined' || !ImageManager || typeof ImageManager.loadCharacter !== 'function') return;
        var self = this;
        try {
            var bmp = ImageManager.loadCharacter(name);
            if (!bmp) return;
            if (!bmp.isReady || !bmp.isReady()) {
                if (typeof bmp.addLoadListener === 'function') bmp.addLoadListener(function() { self.refreshEventSettingsImagePreview(); });
                return;
            }
            var bw = Math.max(1, Number(bmp.width || 1));
            var bh = Math.max(1, Number(bmp.height || 1));
            var big = (typeof ImageManager.isBigCharacter === 'function') ? !!ImageManager.isBigCharacter(name) : false;
            var pw = big ? Math.floor(bw / 3) : Math.floor(bw / 12);
            var ph = big ? Math.floor(bh / 4) : Math.floor(bh / 8);
            var dirIdx = (dir === 2) ? 0 : (dir === 4 ? 1 : (dir === 6 ? 2 : 3));
            var sx = 0;
            var sy = 0;
            if (big) {
                sx = patt * pw;
                sy = dirIdx * ph;
            } else {
                var bx = (index % 4) * 3;
                var by = Math.floor(index / 4) * 4;
                sx = (bx + patt) * pw;
                sy = (by + dirIdx) * ph;
            }
            var scale = Math.min((w - 8) / pw, (h - 8) / ph);
            if (!isFinite(scale) || scale <= 0) scale = 1;
            var dw = Math.max(1, Math.floor(pw * scale));
            var dh = Math.max(1, Math.floor(ph * scale));
            var dx = Math.floor((w - dw) / 2);
            var dy = Math.floor((h - dh) / 2);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bmp.canvas || bmp._canvas || bmp, sx, sy, pw, ph, dx, dy, dw, dh);
        } catch (_) {}
    };

    EE.prototype.eventSettingsRefreshMoveRouteButtonLabel = function() {
        if (!this.eventSettingsMoveRouteBtn) return;
        var route = (this.eventSettingsMoveRouteDraft && typeof this.eventSettingsMoveRouteDraft === 'object')
            ? this.eventSettingsMoveRouteDraft
            : null;
        var list = route && Array.isArray(route.list) ? route.list : [];
        var count = 0;
        for (var i = 0; i < list.length; i++) {
            if (Math.floor(Number(list[i] && list[i].code || 0)) > 0) count++;
        }
        this.eventSettingsMoveRouteBtn.textContent = 'ルート... (' + count + ')';
    };

    EE.prototype.openEventSettingsMoveRoutePrompt = function() {
        if (this.eventSettingsTransparentStart && this.eventSettingsTransparentStart.checked) {
            this.msg('「透明化で開始」がONの間はルート編集できません');
            return;
        }
        var src = (this.eventSettingsMoveRouteDraft && typeof this.eventSettingsMoveRouteDraft === 'object')
            ? clone(this.eventSettingsMoveRouteDraft)
            : this.defaultMoveRoute();
        if (!Array.isArray(src.list)) src.list = [{ code: 0, parameters: [] }];
        var raw = window.prompt('移動ルート list(JSON) または route(JSON) を編集してください', JSON.stringify(src.list));
        if (raw == null) return;
        try {
            var parsed = JSON.parse(String(raw || '[]'));
            if (Array.isArray(parsed)) {
                src.list = parsed;
            } else if (parsed && typeof parsed === 'object') {
                src = clone(parsed);
                if (!Array.isArray(src.list)) throw new Error('route.list(配列) が必要です');
            } else {
                throw new Error('配列またはオブジェクトで指定してください');
            }
            if (!src.list.length || Math.floor(Number(src.list[src.list.length - 1].code || 0)) !== 0) {
                src.list.push({ code: 0, parameters: [] });
            }
            if (src.repeat == null) {
                src.repeat = !!(this.eventSettingsMoveRepeat && this.eventSettingsMoveRepeat.checked);
            } else {
                src.repeat = !!src.repeat;
            }
            if (src.skippable == null) {
                src.skippable = !!(this.eventSettingsMoveSkippable && this.eventSettingsMoveSkippable.checked);
            } else {
                src.skippable = !!src.skippable;
            }
            if (src.wait == null) {
                src.wait = !!(this.eventSettingsMoveWait && this.eventSettingsMoveWait.checked);
            } else {
                src.wait = !!src.wait;
            }
            this.eventSettingsMoveRouteDraft = src;
            if (this.eventSettingsMoveRepeat) this.eventSettingsMoveRepeat.checked = !!src.repeat;
            if (this.eventSettingsMoveSkippable) this.eventSettingsMoveSkippable.checked = !!src.skippable;
            if (this.eventSettingsMoveWait) this.eventSettingsMoveWait.checked = !!src.wait;
            this.eventSettingsRefreshMoveRouteButtonLabel();
            this.msg('移動ルートを更新');
        } catch (e) {
            this.err('E_EVENT_SETTINGS_ROUTE_JSON', e);
        }
    };

    EE.prototype.eventSettingsCharacterImageNames = function() {
        var names = [];
        try {
            var fs = require('fs');
            var path = require('path');
            var dir = path.join(process.cwd(), 'img', 'characters');
            if (!fs.existsSync(dir)) return names;
            var files = fs.readdirSync(dir);
            var seen = Object.create(null);
            for (var i = 0; i < files.length; i++) {
                var fn = String(files[i] || '');
                var m = fn.match(/^(.*)\.(png|webp|rpgmvp)$/i);
                if (!m) continue;
                var key = String(m[1] || '').trim();
                if (!key.length || seen[key]) continue;
                seen[key] = true;
                names.push(key);
            }
            names.sort(function(a, b) {
                return String(a || '').toLowerCase().localeCompare(String(b || '').toLowerCase());
            });
        } catch (_) {}
        return names;
    };

    EE.prototype.openEventSettingsImagePickerPromptFallback = function() {
        var curName = String(this.eventSettingsCharName && this.eventSettingsCharName.value || '');
        var curIndex = Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsCharIndex && this.eventSettingsCharIndex.value || 0))));
        var curDir = Math.floor(Number(this.eventSettingsDirection && this.eventSettingsDirection.value || 2));
        var curPat = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPattern && this.eventSettingsPattern.value || 1))));
        var dflt = curName + ',' + curIndex + ',' + curDir + ',' + curPat;
        var raw = window.prompt('キャラ画像名,キャラ番号(0-7),向き(2/4/6/8),パターン(0-2)', dflt);
        if (raw == null) return;
        var a = String(raw || '').split(',');
        var name = String((a[0] == null ? curName : a[0])).trim();
        var idx = Math.max(0, Math.min(7, Math.floor(Number(a[1] == null ? curIndex : a[1]) || curIndex)));
        var dir = Math.floor(Number(a[2] == null ? curDir : a[2]) || curDir);
        if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
        var pat = Math.max(0, Math.min(2, Math.floor(Number(a[3] == null ? curPat : a[3]) || curPat)));
        if (this.eventSettingsUseTile) this.eventSettingsUseTile.checked = false;
        if (this.eventSettingsCharName) this.eventSettingsCharName.value = name;
        if (this.eventSettingsCharIndex) this.eventSettingsCharIndex.value = String(idx);
        if (this.eventSettingsDirection) this.eventSettingsDirection.value = String(dir);
        if (this.eventSettingsPattern) this.eventSettingsPattern.value = String(pat);
        this.syncEventSettingsEditorFormEnabled();
        this.refreshEventSettingsImagePreview();
    };

    EE.prototype.parseEventSettingsCssRectNote = function(note) {
        var s = String(note == null ? '' : note);
        var m = s.match(/<cssRect\s*:\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*>/i);
        if (!m) return null;
        return {
            x: Math.floor(Number(m[1] || 0)),
            y: Math.floor(Number(m[2] || 0)),
            width: Math.floor(Number(m[3] || 0)),
            height: Math.floor(Number(m[4] || 0))
        };
    };

    EE.prototype.normalizeEventSettingsCssRect = function(rect, fallback) {
        fallback = fallback && typeof fallback === 'object' ? fallback : { x: 0, y: 0, width: 0, height: 0 };
        var src = rect && typeof rect === 'object' ? rect : fallback;
        return {
            x: Math.floor(Number(src.x == null ? fallback.x : src.x) || 0),
            y: Math.floor(Number(src.y == null ? fallback.y : src.y) || 0),
            width: Math.max(0, Math.floor(Number(src.width == null ? fallback.width : src.width) || 0)),
            height: Math.max(0, Math.floor(Number(src.height == null ? fallback.height : src.height) || 0))
        };
    };

    EE.prototype.makeEventSettingsCssRectTag = function(rect) {
        var r = this.normalizeEventSettingsCssRect(rect, { x: 0, y: 0, width: 0, height: 0 });
        return '<cssRect:' + r.x + ',' + r.y + ',' + r.width + ',' + r.height + '>';
    };

    EE.prototype.upsertEventSettingsCssRectInNote = function(note, rect) {
        var cleaned = String(note == null ? '' : note).replace(/<cssRect\s*:[^>]*>/ig, '').trim();
        if (!rect) return cleaned;
        var tag = this.makeEventSettingsCssRectTag(rect);
        if (!cleaned.length) return tag;
        return /[>\s]$/.test(cleaned) ? (cleaned + tag) : (cleaned + ' ' + tag);
    };

    EE.prototype.eventSettingsCanEditCssRectInPicker = function() {
        var useTile = !!(this.eventSettingsUseTile && this.eventSettingsUseTile.checked);
        var name = String(this.eventSettingsImagePickerName || '');
        return !useTile && name.length > 0;
    };

    EE.prototype.eventSettingsRefreshImagePickerCssRectUi = function() {
        var canEdit = this.eventSettingsCanEditCssRectInPicker();
        if (!canEdit) {
            this.eventSettingsImagePickerCssRectMode = false;
            this.eventSettingsImagePickerCssRectDragging = null;
        }
        var mode = !!this.eventSettingsImagePickerCssRectMode;
        var rect = this.eventSettingsImagePickerCssRectDraft;
        if (this.eventSettingsImagePickerCssRectModeBtn) {
            this.eventSettingsImagePickerCssRectModeBtn.disabled = !canEdit;
            if (this.eventSettingsImagePickerCssRectModeBtn.classList) {
                this.eventSettingsImagePickerCssRectModeBtn.classList.toggle('on', mode && canEdit);
            }
            this.eventSettingsImagePickerCssRectModeBtn.textContent = mode && canEdit ? 'cssRect調整中' : 'cssRect調整';
        }
        if (this.eventSettingsImagePickerCssRectClearBtn) {
            this.eventSettingsImagePickerCssRectClearBtn.disabled = !canEdit;
        }
        if (this.eventSettingsImagePickerCssRectStatus) {
            var status = '';
            if (!canEdit) {
                status = 'cssRect: 画像キャラ時のみ調整可';
            } else if (rect && typeof rect === 'object') {
                var r = this.normalizeEventSettingsCssRect(rect, { x: 0, y: 0, width: 0, height: 0 });
                status = 'cssRect: ' + r.x + ',' + r.y + ',' + r.width + ',' + r.height;
            } else {
                status = 'cssRect: (未設定)';
            }
            if (mode && canEdit) status += ' / ドラッグ: 範囲選択 (Shift=16px)';
            this.eventSettingsImagePickerCssRectStatus.textContent = status;
        }
    };

    EE.prototype.toggleEventSettingsImagePickerCssRectMode = function() {
        if (!this.eventSettingsCanEditCssRectInPicker()) return;
        this.eventSettingsImagePickerCssRectMode = !this.eventSettingsImagePickerCssRectMode;
        this.eventSettingsImagePickerCssRectDragging = null;
        this.eventSettingsRefreshImagePickerCssRectUi();
    };

    EE.prototype.clearEventSettingsImagePickerCssRect = function() {
        if (!this.eventSettingsCanEditCssRectInPicker()) return;
        this.eventSettingsImagePickerCssRectDraft = null;
        this.eventSettingsImagePickerCssRectTouched = true;
        this.eventSettingsImagePickerCssRectDragging = null;
        this.eventSettingsRefreshImagePickerCssRectUi();
        this.renderEventSettingsImagePickerSheet();
    };

    EE.prototype.eventSettingsImagePickerCanvasPointFromMouse = function(e) {
        if (!e || !this.eventSettingsImagePickerCanvas) return null;
        var cv = this.eventSettingsImagePickerCanvas;
        var rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        var rx = (Number(e.clientX || 0) - rect.left) / rect.width;
        var ry = (Number(e.clientY || 0) - rect.top) / rect.height;
        if (!isFinite(rx) || !isFinite(ry)) return null;
        rx = Math.max(0, Math.min(1, rx));
        ry = Math.max(0, Math.min(1, ry));
        return {
            x: Math.floor(rx * Number(cv.width || 1)),
            y: Math.floor(ry * Number(cv.height || 1))
        };
    };

    EE.prototype.snapEventSettingsImagePickerPoint16 = function(point, maxW, maxH) {
        var x = Math.round(Number(point && point.x || 0) / 16) * 16;
        var y = Math.round(Number(point && point.y || 0) / 16) * 16;
        x = Math.max(0, Math.min(Math.max(0, Math.floor(Number(maxW || 0))), x));
        y = Math.max(0, Math.min(Math.max(0, Math.floor(Number(maxH || 0))), y));
        return { x: x, y: y };
    };

    EE.prototype.updateEventSettingsCssRectDraftFromDrag = function(e) {
        var drag = this.eventSettingsImagePickerCssRectDragging;
        if (!drag || !this.eventSettingsImagePickerCanvas) return;
        var p = this.eventSettingsImagePickerCanvasPointFromMouse(e);
        if (!p) return;
        drag.endX = p.x;
        drag.endY = p.y;
        var cv = this.eventSettingsImagePickerCanvas;
        var maxW = Math.max(0, Math.floor(Number(cv.width || 0)));
        var maxH = Math.max(0, Math.floor(Number(cv.height || 0)));
        var sx = Math.floor(Number(drag.startX || 0));
        var sy = Math.floor(Number(drag.startY || 0));
        var ex = Math.floor(Number(drag.endX || 0));
        var ey = Math.floor(Number(drag.endY || 0));
        if (e && e.shiftKey) {
            var sp = this.snapEventSettingsImagePickerPoint16({ x: sx, y: sy }, maxW, maxH);
            var ep = this.snapEventSettingsImagePickerPoint16({ x: ex, y: ey }, maxW, maxH);
            sx = sp.x; sy = sp.y; ex = ep.x; ey = ep.y;
        }
        sx = Math.max(0, Math.min(maxW, sx));
        sy = Math.max(0, Math.min(maxH, sy));
        ex = Math.max(0, Math.min(maxW, ex));
        ey = Math.max(0, Math.min(maxH, ey));
        var x1 = Math.min(sx, ex);
        var y1 = Math.min(sy, ey);
        var x2 = Math.max(sx, ex);
        var y2 = Math.max(sy, ey);
        this.eventSettingsImagePickerCssRectDraft = {
            x: x1,
            y: y1,
            width: Math.max(0, x2 - x1),
            height: Math.max(0, y2 - y1)
        };
        this.eventSettingsImagePickerCssRectTouched = true;
        this.eventSettingsRefreshImagePickerCssRectUi();
        this.renderEventSettingsImagePickerSheet();
    };

    EE.prototype.onEventSettingsImagePickerCanvasMouseDown = function(e) {
        if (!e || Number(e.button || 0) !== 0) return;
        if (!this.eventSettingsImagePickerCssRectMode || !this.eventSettingsCanEditCssRectInPicker()) return;
        var p = this.eventSettingsImagePickerCanvasPointFromMouse(e);
        if (!p) return;
        this.eventSettingsImagePickerCssRectDragging = { startX: p.x, startY: p.y, endX: p.x, endY: p.y };
        this.updateEventSettingsCssRectDraftFromDrag(e);
        e.preventDefault();
    };

    EE.prototype.onEventSettingsImagePickerCanvasMouseMove = function(e) {
        if (!this.eventSettingsImagePickerCssRectDragging) return;
        if (e && Number(e.buttons || 0) === 0) {
            this.eventSettingsImagePickerCssRectDragging = null;
            return;
        }
        this.updateEventSettingsCssRectDraftFromDrag(e);
        if (e) e.preventDefault();
    };

    EE.prototype.onEventSettingsImagePickerCanvasMouseUp = function(e) {
        if (!this.eventSettingsImagePickerCssRectDragging) return;
        this.updateEventSettingsCssRectDraftFromDrag(e);
        this.eventSettingsImagePickerCssRectDragging = null;
        if (e) e.preventDefault();
    };

    EE.prototype.syncEventSettingsImagePickerScrollbars = function() {
        var list = this.eventSettingsImagePickerList;
        if (list && list.style) {
            var listNeedsY = Number(list.scrollHeight || 0) > Number(list.clientHeight || 0) + 1;
            list.style.overflowX = 'hidden';
            list.style.overflowY = listNeedsY ? 'scroll' : 'hidden';
        }
        var vp = this.eventSettingsImagePickerViewport;
        if (vp && vp.style) {
            var w = Number(vp.clientWidth || 0);
            var h = Number(vp.clientHeight || 0);
            if (w > 0 && h > 0) {
                // Re-evaluate after applying each axis because one scrollbar can
                // reduce viewport size and make the other axis overflow.
                var ox = 'hidden';
                var oy = 'hidden';
                vp.style.overflowX = ox;
                vp.style.overflowY = oy;
                for (var i = 0; i < 4; i++) {
                    var needsX = Number(vp.scrollWidth || 0) > Number(vp.clientWidth || 0) + 1;
                    var needsY = Number(vp.scrollHeight || 0) > Number(vp.clientHeight || 0) + 1;
                    var nox = needsX ? 'scroll' : 'hidden';
                    var noy = needsY ? 'scroll' : 'hidden';
                    if (nox === ox && noy === oy) break;
                    ox = nox;
                    oy = noy;
                    vp.style.overflowX = ox;
                    vp.style.overflowY = oy;
                }
            } else {
                vp.style.overflowX = 'hidden';
                vp.style.overflowY = 'hidden';
            }
        }
    };

    EE.prototype.scheduleEventSettingsImagePickerScrollSync = function() {
        if (this._eventSettingsImagePickerScrollSyncQueued) return;
        this._eventSettingsImagePickerScrollSyncQueued = true;
        var self = this;
        var run = function() {
            self._eventSettingsImagePickerScrollSyncQueued = false;
            self.syncEventSettingsImagePickerScrollbars();
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() {
                self.syncEventSettingsImagePickerScrollbars();
                requestAnimationFrame(run);
            });
        } else {
            setTimeout(run, 0);
        }
    };

    EE.prototype.renderEventSettingsImagePickerList = function() {
        if (!this.eventSettingsImagePickerList) return;
        var self = this;
        var list = this.eventSettingsImagePickerList;
        list.innerHTML = '';
        var frag = document.createDocumentFragment();
        var names = Array.isArray(this.eventSettingsImagePickerNames) ? this.eventSettingsImagePickerNames : [];
        var all = [''].concat(names);
        for (var i = 0; i < all.length; i++) {
            (function(name) {
                var label = name.length ? name : '(なし)';
                var b = self.el('button', 'eip-item' + (String(self.eventSettingsImagePickerName || '') === name ? ' on' : ''), label);
                b.type = 'button';
                b.addEventListener('click', function() {
                    self.eventSettingsImagePickerName = String(name || '');
                    if (!self.eventSettingsImagePickerName.length) self.eventSettingsImagePickerIndex = 0;
                    self.eventSettingsRefreshImagePickerCssRectUi();
                    self.renderEventSettingsImagePickerList();
                    self.renderEventSettingsImagePickerSheet();
                });
                frag.appendChild(b);
            })(all[i]);
        }
        list.appendChild(frag);
        this.scheduleEventSettingsImagePickerScrollSync();
    };

    EE.prototype.renderEventSettingsImagePickerSheet = function() {
        var cv = this.eventSettingsImagePickerCanvas;
        if (!cv || typeof cv.getContext !== 'function') return;
        var ctx = cv.getContext('2d');
        if (!ctx) return;
        var displayScale = 0.5;
        var applyDisplayScale = function(pxW, pxH) {
            var w = Math.max(1, Math.floor(Number(pxW || 1) * displayScale));
            var h = Math.max(1, Math.floor(Number(pxH || 1) * displayScale));
            cv.style.width = String(w) + 'px';
            cv.style.height = String(h) + 'px';
        };
        var name = String(this.eventSettingsImagePickerName || '');
        var info = this.eventSettingsImagePickerInfo;
        var dirRowToValue = [2, 4, 6, 8];
        var dirValueToRow = { '2': 0, '4': 1, '6': 2, '8': 3 };
        var dirLabel = function(dir) {
            if (dir === 2) return '下';
            if (dir === 4) return '左';
            if (dir === 6) return '右';
            if (dir === 8) return '上';
            return '下';
        };
        if (!name.length) {
            cv.width = 384;
            cv.height = 256;
            applyDisplayScale(cv.width, cv.height);
            ctx.clearRect(0, 0, cv.width, cv.height);
            var cs = 16;
            for (var y = 0; y < cv.height; y += cs) {
                for (var x = 0; x < cv.width; x += cs) {
                    var odd = (((x / cs) | 0) + ((y / cs) | 0)) % 2;
                    ctx.fillStyle = odd ? 'rgba(228,228,228,.88)' : 'rgba(198,198,198,.88)';
                    ctx.fillRect(x, y, cs, cs);
                }
            }
            if (info) info.textContent = '画像: (なし)';
            this.eventSettingsRefreshImagePickerCssRectUi();
            this.scheduleEventSettingsImagePickerScrollSync();
            return;
        }
        if (typeof ImageManager === 'undefined' || !ImageManager || typeof ImageManager.loadCharacter !== 'function') {
            this.eventSettingsRefreshImagePickerCssRectUi();
            this.scheduleEventSettingsImagePickerScrollSync();
            return;
        }
        var self = this;
        try {
            var bmp = ImageManager.loadCharacter(name);
            this.eventSettingsImagePickerBitmap = bmp || null;
            if (!bmp) {
                this.eventSettingsRefreshImagePickerCssRectUi();
                this.scheduleEventSettingsImagePickerScrollSync();
                return;
            }
            if (!bmp.isReady || !bmp.isReady()) {
                if (info) info.textContent = '読み込み中: ' + name;
                if (typeof bmp.addLoadListener === 'function') {
                    bmp.addLoadListener(function() {
                        if (String(self.eventSettingsImagePickerName || '') === name) self.renderEventSettingsImagePickerSheet();
                    });
                }
                this.eventSettingsRefreshImagePickerCssRectUi();
                this.scheduleEventSettingsImagePickerScrollSync();
                return;
            }
            var bw = Math.max(1, Math.floor(Number(bmp.width || 1)));
            var bh = Math.max(1, Math.floor(Number(bmp.height || 1)));
            cv.width = bw;
            cv.height = bh;
            applyDisplayScale(bw, bh);
            ctx.clearRect(0, 0, bw, bh);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bmp.canvas || bmp._canvas || bmp, 0, 0);

            var big = (typeof ImageManager.isBigCharacter === 'function') ? !!ImageManager.isBigCharacter(name) : false;
            var idx = Math.max(0, Math.floor(Number(this.eventSettingsImagePickerIndex || 0)));
            var dir = Math.floor(Number(this.eventSettingsImagePickerDirection || 2));
            if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
            var pat = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsImagePickerPattern == null ? 1 : this.eventSettingsImagePickerPattern))));
            if (big) idx = 0;
            else idx = Math.max(0, Math.min(7, idx));
            this.eventSettingsImagePickerIndex = idx;
            this.eventSettingsImagePickerDirection = dir;
            this.eventSettingsImagePickerPattern = pat;

            ctx.save();
            ctx.strokeStyle = 'rgba(34,34,34,.55)';
            ctx.lineWidth = 1;
            var blockX = 0;
            var blockY = 0;
            var blockW = bw;
            var blockH = bh;
            var cellW = bw / 3;
            var cellH = bh / 4;
            if (big) {
                ctx.strokeRect(0.5, 0.5, Math.max(0, bw - 1), Math.max(0, bh - 1));
            } else {
                var cw = bw / 4;
                var ch = bh / 2;
                blockW = cw;
                blockH = ch;
                blockX = (idx % 4) * cw;
                blockY = Math.floor(idx / 4) * ch;
                cellW = cw / 3;
                cellH = ch / 4;
                for (var gy = 0; gy < 2; gy++) {
                    for (var gx = 0; gx < 4; gx++) {
                        ctx.strokeRect(Math.floor(gx * cw) + 0.5, Math.floor(gy * ch) + 0.5, Math.max(0, Math.floor(cw) - 1), Math.max(0, Math.floor(ch) - 1));
                    }
                }
            }
            ctx.fillStyle = 'rgba(86,132,196,.22)';
            ctx.fillRect(Math.floor(blockX), Math.floor(blockY), Math.max(1, Math.floor(blockW)), Math.max(1, Math.floor(blockH)));
            ctx.strokeStyle = 'rgba(188,220,255,.92)';
            ctx.lineWidth = 2;
            ctx.strokeRect(Math.floor(blockX) + 1, Math.floor(blockY) + 1, Math.max(0, Math.floor(blockW) - 2), Math.max(0, Math.floor(blockH) - 2));

            ctx.strokeStyle = 'rgba(40,52,70,.78)';
            ctx.lineWidth = 1;
            for (var vx = 1; vx < 3; vx++) {
                var lx = Math.floor(blockX + cellW * vx) + 0.5;
                var y0 = Math.floor(blockY) + 0.5;
                var y1 = Math.floor(blockY + blockH) - 0.5;
                ctx.beginPath();
                ctx.moveTo(lx, y0);
                ctx.lineTo(lx, y1);
                ctx.stroke();
            }
            for (var vy = 1; vy < 4; vy++) {
                var ly = Math.floor(blockY + cellH * vy) + 0.5;
                var x0 = Math.floor(blockX) + 0.5;
                var x1 = Math.floor(blockX + blockW) - 0.5;
                ctx.beginPath();
                ctx.moveTo(x0, ly);
                ctx.lineTo(x1, ly);
                ctx.stroke();
            }

            var dirRow = dirValueToRow[String(dir)] == null ? 0 : Number(dirValueToRow[String(dir)]);
            var selX = Math.floor(blockX + cellW * pat);
            var selY = Math.floor(blockY + cellH * dirRow);
            var selW = Math.max(1, Math.floor(cellW));
            var selH = Math.max(1, Math.floor(cellH));
            ctx.fillStyle = 'rgba(170,212,255,.34)';
            ctx.fillRect(selX, selY, selW, selH);
            ctx.strokeStyle = 'rgba(232,246,255,.98)';
            ctx.lineWidth = 2;
            ctx.strokeRect(selX + 1, selY + 1, Math.max(0, selW - 2), Math.max(0, selH - 2));

            var cssRect = this.eventSettingsImagePickerCssRectDraft;
            if (cssRect && typeof cssRect === 'object') {
                var cr = this.normalizeEventSettingsCssRect(cssRect, { x: 0, y: 0, width: 0, height: 0 });
                var rx = Math.max(0, Math.min(bw, cr.x));
                var ry = Math.max(0, Math.min(bh, cr.y));
                var rw = Math.max(0, Math.min(bw - rx, cr.width));
                var rh = Math.max(0, Math.min(bh - ry, cr.height));
                ctx.fillStyle = this.eventSettingsImagePickerCssRectMode
                    ? 'rgba(255,184,86,.26)'
                    : 'rgba(118,248,212,.22)';
                if (rw > 0 && rh > 0) ctx.fillRect(rx, ry, rw, rh);
                ctx.strokeStyle = this.eventSettingsImagePickerCssRectMode
                    ? 'rgba(255,214,128,.98)'
                    : 'rgba(172,255,232,.98)';
                ctx.lineWidth = 2;
                ctx.strokeRect(Math.floor(rx) + 0.5, Math.floor(ry) + 0.5, Math.max(0, Math.floor(rw)), Math.max(0, Math.floor(rh)));
                if (rw === 0 || rh === 0) {
                    ctx.fillStyle = 'rgba(255,232,168,.98)';
                    ctx.fillRect(Math.floor(rx) - 1, Math.floor(ry) - 1, 3, 3);
                }
            }
            ctx.restore();
            if (info) {
                if (big) {
                    info.textContent = '画像: ' + name + '\n大キャラ (index固定:0) / 向き:' + dirLabel(dir) + ' / パターン:' + pat;
                } else {
                    info.textContent = '画像: ' + name + '\nキャラ番号:' + idx + ' (0-7) / 向き:' + dirLabel(dir) + ' / パターン:' + pat;
                }
            }
        } catch (_) {}
        this.eventSettingsRefreshImagePickerCssRectUi();
        this.scheduleEventSettingsImagePickerScrollSync();
    };

    EE.prototype.onEventSettingsImagePickerCanvasClick = function(e) {
        if (!e || !this.eventSettingsImagePickerCanvas) return;
        if (this.eventSettingsImagePickerCssRectMode) return;
        var name = String(this.eventSettingsImagePickerName || '');
        if (!name.length) return;
        var cv = this.eventSettingsImagePickerCanvas;
        var rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        var rx = (Number(e.clientX || 0) - rect.left) / rect.width;
        var ry = (Number(e.clientY || 0) - rect.top) / rect.height;
        if (!isFinite(rx) || !isFinite(ry)) return;
        rx = Math.max(0, Math.min(0.999999, rx));
        ry = Math.max(0, Math.min(0.999999, ry));
        var dirRowToValue = [2, 4, 6, 8];
        var big = (typeof ImageManager !== 'undefined' && ImageManager && typeof ImageManager.isBigCharacter === 'function')
            ? !!ImageManager.isBigCharacter(name)
            : false;
        if (big) {
            this.eventSettingsImagePickerIndex = 0;
            this.eventSettingsImagePickerPattern = Math.max(0, Math.min(2, Math.floor(rx * 3)));
            this.eventSettingsImagePickerDirection = dirRowToValue[Math.max(0, Math.min(3, Math.floor(ry * 4)))] || 2;
        } else {
            var gx = Math.max(0, Math.min(11, Math.floor(rx * 12)));
            var gy = Math.max(0, Math.min(7, Math.floor(ry * 8)));
            var charX = Math.floor(gx / 3);
            var charY = Math.floor(gy / 4);
            this.eventSettingsImagePickerIndex = charY * 4 + charX;
            this.eventSettingsImagePickerPattern = gx % 3;
            this.eventSettingsImagePickerDirection = dirRowToValue[gy % 4] || 2;
        }
        this.renderEventSettingsImagePickerSheet();
        this.renderEventSettingsImagePickerList();
    };

    EE.prototype.closeEventSettingsImagePicker = function(apply) {
        if (!this.eventSettingsImagePickerModal) return;
        if (apply) {
            var name = String(this.eventSettingsImagePickerName || '');
            var idx = Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsImagePickerIndex || 0))));
            var dir = Math.floor(Number(this.eventSettingsImagePickerDirection || 2));
            if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
            var pat = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsImagePickerPattern == null ? 1 : this.eventSettingsImagePickerPattern))));
            if (name.length && typeof ImageManager !== 'undefined' && ImageManager && typeof ImageManager.isBigCharacter === 'function') {
                if (ImageManager.isBigCharacter(name)) idx = 0;
            }
            if (this.eventSettingsUseTile) this.eventSettingsUseTile.checked = false;
            if (this.eventSettingsCharName) this.eventSettingsCharName.value = name;
            if (this.eventSettingsCharIndex) this.eventSettingsCharIndex.value = String(idx);
            if (this.eventSettingsDirection) this.eventSettingsDirection.value = String(dir);
            if (this.eventSettingsPattern) this.eventSettingsPattern.value = String(pat);
            this.syncEventSettingsEditorFormEnabled();
            this.refreshEventSettingsImagePreview();
            if (this.eventSettingsNoteInput && this.eventSettingsImagePickerCssRectTouched) {
                var nextNote = this.upsertEventSettingsCssRectInNote(
                    String(this.eventSettingsNoteInput.value || ''),
                    this.eventSettingsImagePickerCssRectDraft
                );
                this.eventSettingsNoteInput.value = nextNote;
            }
        }
        this.eventSettingsImagePickerCssRectMode = false;
        this.eventSettingsImagePickerCssRectTouched = false;
        this.eventSettingsImagePickerCssRectDragging = null;
        this.eventSettingsImagePickerModal.classList.remove('on');
    };

    EE.prototype.openEventSettingsImagePickerPrompt = function() {
        if (!this.eventSettingsImagePickerModal || !this.eventSettingsImagePickerList || !this.eventSettingsImagePickerCanvas) {
            this.openEventSettingsImagePickerPromptFallback();
            return;
        }
        var curName = String(this.eventSettingsCharName && this.eventSettingsCharName.value || '');
        var curIndex = Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsCharIndex && this.eventSettingsCharIndex.value || 0))));
        var curDir = Math.floor(Number(this.eventSettingsDirection && this.eventSettingsDirection.value || 2));
        if (curDir !== 2 && curDir !== 4 && curDir !== 6 && curDir !== 8) curDir = 2;
        var curPat = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPattern && this.eventSettingsPattern.value || 1))));
        var names = this.eventSettingsCharacterImageNames();
        if (curName.length && names.indexOf(curName) < 0) names.unshift(curName);
        this.eventSettingsImagePickerNames = names;
        this.eventSettingsImagePickerName = curName;
        this.eventSettingsImagePickerIndex = curIndex;
        this.eventSettingsImagePickerDirection = curDir;
        this.eventSettingsImagePickerPattern = curPat;
        this.eventSettingsImagePickerBitmap = null;
        var parsedCssRect = this.parseEventSettingsCssRectNote(
            String(this.eventSettingsNoteInput && this.eventSettingsNoteInput.value || '')
        );
        this.eventSettingsImagePickerCssRectDraft = parsedCssRect
            ? this.normalizeEventSettingsCssRect(parsedCssRect, { x: 0, y: 0, width: 0, height: 0 })
            : { x: 0, y: 0, width: 0, height: 0 };
        this.eventSettingsImagePickerCssRectMode = false;
        this.eventSettingsImagePickerCssRectTouched = false;
        this.eventSettingsImagePickerCssRectDragging = null;
        this.renderEventSettingsImagePickerList();
        this.renderEventSettingsImagePickerSheet();
        this.eventSettingsRefreshImagePickerCssRectUi();
        this.eventSettingsImagePickerModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.eventSettingsImagePickerModal);
        this.scheduleEventSettingsImagePickerScrollSync();
    };

    EE.prototype.eventSettingsTransparentStartPresetRoute = function() {
        return {
            repeat: false,
            skippable: false,
            wait: false,
            list: [
                { code: 39, indent: null },
                { code: 0, parameters: [] }
            ]
        };
    };

    EE.prototype.eventSettingsDetectTransparentStartFromPage = function(page) {
        if (!page || typeof page !== 'object') return false;
        if (page.eeTransparentStart != null) return !!page.eeTransparentStart;
        var moveType = Math.max(0, Math.min(3, Math.floor(Number(page.moveType || 0))));
        var moveFrequency = Math.max(1, Math.min(5, Math.floor(Number(page.moveFrequency || 3))));
        if (moveType !== 3 || moveFrequency !== 5) return false;
        var route = page.moveRoute && typeof page.moveRoute === 'object' ? page.moveRoute : null;
        if (!route || !Array.isArray(route.list)) return false;
        if (route.repeat) return false;
        if (route.list.length !== 2) return false;
        var first = route.list[0] || {};
        var end = route.list[1] || {};
        if (Math.floor(Number(first.code || 0)) !== 39) return false;
        if (first.indent != null) return false;
        if (Math.floor(Number(end.code || 0)) !== 0) return false;
        var endParams = Array.isArray(end.parameters) ? end.parameters : [];
        if (endParams.length !== 0) return false;
        return true;
    };

    EE.prototype.eventSettingsApplyTransparentStartPresetToForm = function() {
        if (!(this.eventSettingsTransparentStart && this.eventSettingsTransparentStart.checked)) return;
        if (this.eventSettingsMoveType) this.eventSettingsMoveType.value = '3';
        if (this.eventSettingsMoveFrequency) this.eventSettingsMoveFrequency.value = '5';
        this.eventSettingsMoveRouteDraft = this.eventSettingsTransparentStartPresetRoute();
        if (this.eventSettingsMoveRepeat) this.eventSettingsMoveRepeat.checked = false;
        if (this.eventSettingsMoveSkippable) this.eventSettingsMoveSkippable.checked = false;
        if (this.eventSettingsMoveWait) this.eventSettingsMoveWait.checked = false;
        this.eventSettingsRefreshMoveRouteButtonLabel();
    };

    EE.prototype.eventSettingsCaptureTransparentStartRestoreFromForm = function() {
        var out = {
            moveType: Math.max(0, Math.min(3, Math.floor(Number(this.eventSettingsMoveType && this.eventSettingsMoveType.value || 0)))),
            moveFrequency: Math.max(1, Math.min(5, Math.floor(Number(this.eventSettingsMoveFrequency && this.eventSettingsMoveFrequency.value || 3)))),
            moveRouteDraft: null,
            moveRepeat: !!(this.eventSettingsMoveRepeat && this.eventSettingsMoveRepeat.checked),
            moveSkippable: !!(this.eventSettingsMoveSkippable && this.eventSettingsMoveSkippable.checked),
            moveWait: !!(this.eventSettingsMoveWait && this.eventSettingsMoveWait.checked)
        };
        var draft = (this.eventSettingsMoveRouteDraft && typeof this.eventSettingsMoveRouteDraft === 'object')
            ? clone(this.eventSettingsMoveRouteDraft)
            : this.defaultMoveRoute();
        if (!Array.isArray(draft.list)) draft.list = [{ code: 0, parameters: [] }];
        if (!draft.list.length || Number(draft.list[draft.list.length - 1].code || 0) !== 0) {
            draft.list.push({ code: 0, parameters: [] });
        }
        out.moveRouteDraft = draft;
        return out;
    };

    EE.prototype.eventSettingsRestoreTransparentStartStateToForm = function(st) {
        if (!st || typeof st !== 'object') return;
        if (this.eventSettingsMoveType) this.eventSettingsMoveType.value = String(Math.max(0, Math.min(3, Math.floor(Number(st.moveType || 0)))));
        if (this.eventSettingsMoveFrequency) this.eventSettingsMoveFrequency.value = String(Math.max(1, Math.min(5, Math.floor(Number(st.moveFrequency || 3)))));
        var draft = (st.moveRouteDraft && typeof st.moveRouteDraft === 'object')
            ? clone(st.moveRouteDraft)
            : this.defaultMoveRoute();
        if (!Array.isArray(draft.list)) draft.list = [{ code: 0, parameters: [] }];
        if (!draft.list.length || Number(draft.list[draft.list.length - 1].code || 0) !== 0) {
            draft.list.push({ code: 0, parameters: [] });
        }
        this.eventSettingsMoveRouteDraft = draft;
        if (this.eventSettingsMoveRepeat) this.eventSettingsMoveRepeat.checked = !!st.moveRepeat;
        if (this.eventSettingsMoveSkippable) this.eventSettingsMoveSkippable.checked = !!st.moveSkippable;
        if (this.eventSettingsMoveWait) this.eventSettingsMoveWait.checked = !!st.moveWait;
        this.eventSettingsRefreshMoveRouteButtonLabel();
    };

    EE.prototype.eventSettingsEnsurePage = function(page) {
        if (!page || typeof page !== 'object') page = {};
        if (!page.conditions || typeof page.conditions !== 'object') page.conditions = {};
        var c = page.conditions;
        if (c.switch1Valid == null) c.switch1Valid = false;
        if (c.switch1Id == null) c.switch1Id = 1;
        if (c.switch2Valid == null) c.switch2Valid = false;
        if (c.switch2Id == null) c.switch2Id = 1;
        if (c.variableValid == null) c.variableValid = false;
        if (c.variableId == null) c.variableId = 1;
        if (c.variableValue == null) c.variableValue = 0;
        if (c.selfSwitchValid == null) c.selfSwitchValid = false;
        if (c.selfSwitchCh == null) c.selfSwitchCh = 'A';
        if (c.itemValid == null) c.itemValid = false;
        if (c.itemId == null) c.itemId = 1;
        if (c.actorValid == null) c.actorValid = false;
        if (c.actorId == null) c.actorId = 1;
        if (c.scriptValid == null) c.scriptValid = false;
        if (c.scriptText == null) c.scriptText = '';

        if (!page.image || typeof page.image !== 'object') page.image = {};
        var img = page.image;
        if (img.tileId == null) img.tileId = 0;
        if (img.characterName == null) img.characterName = '';
        if (img.characterIndex == null) img.characterIndex = 0;
        if (img.direction == null) img.direction = 2;
        if (img.pattern == null) img.pattern = 1;

        if (!page.moveRoute || typeof page.moveRoute !== 'object') page.moveRoute = this.defaultMoveRoute();
        if (!Array.isArray(page.moveRoute.list)) page.moveRoute.list = [{ code: 0, parameters: [] }];
        if (!page.moveRoute.list.length || Number(page.moveRoute.list[page.moveRoute.list.length - 1].code || 0) !== 0) {
            page.moveRoute.list.push({ code: 0, parameters: [] });
        }
        if (page.moveRoute.repeat == null) page.moveRoute.repeat = false;
        if (page.moveRoute.skippable == null) page.moveRoute.skippable = false;
        if (page.moveRoute.wait == null) page.moveRoute.wait = false;

        if (page.moveType == null) page.moveType = 0;
        if (page.moveSpeed == null) page.moveSpeed = 3;
        if (page.moveFrequency == null) page.moveFrequency = 3;
        if (page.walkAnime == null) page.walkAnime = true;
        if (page.stepAnime == null) page.stepAnime = false;
        if (page.directionFix == null) page.directionFix = false;
        if (page.through == null) page.through = false;
        if (page.eeTransparentStart == null) page.eeTransparentStart = this.eventSettingsDetectTransparentStartFromPage(page);
        page.eeTransparentStart = !!page.eeTransparentStart;
        if (page.priorityType == null) page.priorityType = 1;
        if (page.trigger == null) page.trigger = 0;
        if (!Array.isArray(page.list)) page.list = [{ code: 0, indent: 0, parameters: [] }];
        if (typeof this.eventSettingsScriptConditionFromEventList === 'function') {
            var scriptCond = this.eventSettingsScriptConditionFromEventList(page.list);
            if (scriptCond != null) {
                c.scriptValid = true;
                c.scriptText = this.eventSettingsNormalizeScriptConditionText(scriptCond);
            }
        }
        return page;
    };

    EE.prototype.eventSettingsPopulateConditionLists = function() {
        var swOptions = this.eventSettingsSwitchOptions();
        var varOptions = (typeof this.variableOptionsForSchema === 'function')
            ? this.variableOptionsForSchema()
            : this.eventSettingsFallbackDbOptions($dataSystem && $dataSystem.variables, '(変数なし)');
        var itemOptions = (typeof this.itemOptionsForSchema === 'function')
            ? this.itemOptionsForSchema()
            : this.eventSettingsFallbackDbOptions($dataItems, '(アイテムなし)');
        var actorOptions = (typeof this.actorOptionsForSchema === 'function')
            ? this.actorOptionsForSchema()
            : this.eventSettingsFallbackDbOptions($dataActors, '(アクターなし)');
        this.eventSettingsFillSelect(this.eventSettingsSw1Id, swOptions);
        this.eventSettingsFillSelect(this.eventSettingsSw2Id, swOptions);
        this.eventSettingsFillSelect(this.eventSettingsVarId, varOptions);
        this.eventSettingsFillSelect(this.eventSettingsItemId, itemOptions);
        this.eventSettingsFillSelect(this.eventSettingsActorId, actorOptions);
    };

    EE.prototype.syncEventSettingsEditorFormEnabled = function() {
        if (!this.eventSettingsModal) return;
        var sw1On = !!(this.eventSettingsSw1Valid && this.eventSettingsSw1Valid.checked);
        var sw2On = !!(this.eventSettingsSw2Valid && this.eventSettingsSw2Valid.checked);
        var varOn = !!(this.eventSettingsVarValid && this.eventSettingsVarValid.checked);
        var selfOn = !!(this.eventSettingsSelfValid && this.eventSettingsSelfValid.checked);
        var itemOn = !!(this.eventSettingsItemValid && this.eventSettingsItemValid.checked);
        var actorOn = !!(this.eventSettingsActorValid && this.eventSettingsActorValid.checked);
        var scriptOn = !!(this.eventSettingsScriptCondValid && this.eventSettingsScriptCondValid.checked);
        var forceShown = function(el) {
            if (!el || !el.style) return;
            el.style.display = '';
        };
        var setMaskedInputText = function(el, masked) {
            if (!el || !el.style) return;
            if (masked) {
                el.style.setProperty('color', 'transparent', 'important');
                el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
                el.style.setProperty('text-shadow', 'none', 'important');
                el.style.setProperty('caret-color', 'transparent', 'important');
            } else {
                el.style.removeProperty('color');
                el.style.removeProperty('-webkit-text-fill-color');
                el.style.removeProperty('text-shadow');
                el.style.removeProperty('caret-color');
            }
        };

        if (this.eventSettingsSw1Id) this.eventSettingsSw1Id.disabled = !sw1On;
        if (this.eventSettingsSw1PickBtn) this.eventSettingsSw1PickBtn.disabled = !sw1On;
        if (this.eventSettingsSw2Id) this.eventSettingsSw2Id.disabled = !sw2On;
        if (this.eventSettingsSw2PickBtn) this.eventSettingsSw2PickBtn.disabled = !sw2On;
        if (this.eventSettingsVarId) this.eventSettingsVarId.disabled = !varOn;
        if (this.eventSettingsVarValue) this.eventSettingsVarValue.disabled = !varOn;
        if (this.eventSettingsVarPickBtn) this.eventSettingsVarPickBtn.disabled = !varOn;
        if (this.eventSettingsSelfCh) this.eventSettingsSelfCh.disabled = !selfOn;
        if (this.eventSettingsItemId) this.eventSettingsItemId.disabled = !itemOn;
        if (this.eventSettingsItemPickBtn) this.eventSettingsItemPickBtn.disabled = !itemOn;
        if (this.eventSettingsActorId) this.eventSettingsActorId.disabled = !actorOn;
        if (this.eventSettingsActorPickBtn) this.eventSettingsActorPickBtn.disabled = !actorOn;
        if (this.eventSettingsScriptCondText) this.eventSettingsScriptCondText.disabled = !scriptOn;

        forceShown(this.eventSettingsSw1Id);
        forceShown(this.eventSettingsSw1PickBtn);
        forceShown(this.eventSettingsSw2Id);
        forceShown(this.eventSettingsSw2PickBtn);
        forceShown(this.eventSettingsVarId);
        forceShown(this.eventSettingsVarPickBtn);
        forceShown(this.eventSettingsSelfCh);
        forceShown(this.eventSettingsItemId);
        forceShown(this.eventSettingsItemPickBtn);
        forceShown(this.eventSettingsActorId);
        forceShown(this.eventSettingsActorPickBtn);
        forceShown(this.eventSettingsScriptCondText);
        if (this.eventSettingsVarValue && this.eventSettingsVarValue.parentNode) {
            forceShown(this.eventSettingsVarValue.parentNode);
        }
        setMaskedInputText(this.eventSettingsSw1Id, !sw1On);
        setMaskedInputText(this.eventSettingsSw2Id, !sw2On);
        setMaskedInputText(this.eventSettingsVarId, !varOn);
        setMaskedInputText(this.eventSettingsVarValue, !varOn);
        setMaskedInputText(this.eventSettingsSelfCh, !selfOn);
        setMaskedInputText(this.eventSettingsItemId, !itemOn);
        setMaskedInputText(this.eventSettingsActorId, !actorOn);
        setMaskedInputText(this.eventSettingsScriptCondText, !scriptOn);

        var useTile = !!(this.eventSettingsUseTile && this.eventSettingsUseTile.checked);
        if (this.eventSettingsTileId) this.eventSettingsTileId.disabled = !useTile;
        if (this.eventSettingsCharName) this.eventSettingsCharName.disabled = useTile;
        if (this.eventSettingsCharIndex) this.eventSettingsCharIndex.disabled = useTile;
        if (this.eventSettingsDirection) this.eventSettingsDirection.disabled = useTile;
        if (this.eventSettingsPattern) this.eventSettingsPattern.disabled = useTile;
        if (this.eventSettingsImagePickBtn) this.eventSettingsImagePickBtn.disabled = false;
        var transparentStartOn = !!(this.eventSettingsTransparentStart && this.eventSettingsTransparentStart.checked);
        var prevTransparentStartOn = !!this.eventSettingsTransparentStartPrevOn;
        if (transparentStartOn && !prevTransparentStartOn) {
            this.eventSettingsTransparentStartRestore = this.eventSettingsCaptureTransparentStartRestoreFromForm();
        } else if (!transparentStartOn && prevTransparentStartOn) {
            if (this.eventSettingsTransparentStartRestore) {
                this.eventSettingsRestoreTransparentStartStateToForm(this.eventSettingsTransparentStartRestore);
            }
            this.eventSettingsTransparentStartRestore = null;
        }
        this.eventSettingsTransparentStartPrevOn = transparentStartOn;
        if (transparentStartOn) this.eventSettingsApplyTransparentStartPresetToForm();
        if (this.eventSettingsMoveType) this.eventSettingsMoveType.disabled = transparentStartOn;
        if (this.eventSettingsMoveFrequency) this.eventSettingsMoveFrequency.disabled = transparentStartOn;
        var moveType = Math.max(0, Math.floor(Number(this.eventSettingsMoveType && this.eventSettingsMoveType.value || 0)));
        var customRoute = (moveType === 3);
        var routeControlLocked = transparentStartOn || !customRoute;
        if (this.eventSettingsMoveRouteBtn) {
            this.eventSettingsMoveRouteBtn.disabled = routeControlLocked;
            if (this.eventSettingsMoveRouteBtn.classList) {
                this.eventSettingsMoveRouteBtn.classList.toggle('is-disabled', routeControlLocked);
            }
        }
        if (this.eventSettingsMoveRepeat) this.eventSettingsMoveRepeat.disabled = routeControlLocked;
        if (this.eventSettingsMoveSkippable) this.eventSettingsMoveSkippable.disabled = routeControlLocked;
        if (this.eventSettingsMoveWait) this.eventSettingsMoveWait.disabled = routeControlLocked;
    };

    EE.prototype.eventSettingsExecutionEntriesForPage = function(eventId, pageIndex, page) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        pageIndex = Math.max(0, Math.floor(Number(pageIndex || 0)));
        var key = this.key(eventId, pageIndex);
        var tr = this.model && this.model.tracks ? this.model.tracks[key] : null;
        if (!tr && typeof this.debugParseTrackFromEventList === 'function') {
            var srcList = (page && Array.isArray(page.list)) ? page.list : [];
            tr = this.debugParseTrackFromEventList(eventId, pageIndex, srcList, 0);
        }
        if (!tr || !Array.isArray(tr.commands)) return [];
        var out = [];
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            if (code <= 0) continue;
            if (typeof this.isEventSettingsScriptConditionEntry === 'function' &&
                this.isEventSettingsScriptConditionEntry(e)) continue;
            out.push(e);
        }
        out.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        return out;
    };

    EE.prototype.eventSettingsExecutionNameText = function(entry) {
        if (!entry || !entry.command) return '';
        var code = this.mainCommandDisplayCodeForEntry(entry);
        var name = this.commandNameJa(code);
        if (Number(entry.command.code || 0) === 205) {
            var targetId = (entry.charId == null)
                ? Number((((entry.command || {}).parameters || [0])[0] || 0))
                : Number(entry.charId || 0);
            name += ' [' + this.rowLabelForCharId(this.normalizeMoveTarget(targetId)) + ']';
        }
        return String(name || ('コマンド' + code));
    };

    EE.prototype.renderEventSettingsExecutionList = function() {
        if (!this.eventSettingsExecList) return;
        var listEl = this.eventSettingsExecList;
        var eid = Math.max(0, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        var pageIndex = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || this.eventSettingsTargetPageIndex || 0)));
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) {
            listEl.innerHTML = '';
            listEl.appendChild(this.el('div', 'es-exec-empty', '実行内容はありません。'));
            this.eventSettingsExecSig = 'none';
            return;
        }
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;
        var page = this.eventSettingsEnsurePage(evData.pages[pageIndex] || {});
        var entries = this.eventSettingsExecutionEntriesForPage(eid, pageIndex, page);
        var sig = String(eid) + ':' + String(pageIndex) + ':' + String(entries.length);
        for (var si = 0; si < entries.length; si++) {
            var se = entries[si];
            sig += '|' + String(Math.floor(Number(se.uid || 0))) + ':' +
                String(Math.max(0, Math.floor(Number(se.frame || 0)))) + ':' +
                String(Math.floor(Number((se.command && se.command.code) || 0)));
        }
        if (this.eventSettingsExecSig === sig) return;
        this.eventSettingsExecSig = sig;
        listEl.innerHTML = '';
        if (!entries.length) {
            listEl.appendChild(this.el('div', 'es-exec-empty', '実行内容はありません。'));
            return;
        }
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var row = this.el('div', 'es-exec-row');
            var idx = this.el('div', 'es-exec-idx', String(i + 1));
            var textWrap = this.el('div', 'es-exec-text');
            var name = this.el('div', 'es-exec-name', this.eventSettingsExecutionNameText(e));
            var detailText = this.commandTooltipDetailText(e);
            var indent = Math.max(0, Math.floor(Number((e.command && e.command.indent) || 0)));
            var rowKey = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            var cmdColor = this.commandTextColorForEntry(e, -1, rowKey);
            name.style.color = cmdColor;
            if (indent > 0) {
                var pad = Math.min(56, indent * 12);
                name.style.paddingLeft = String(pad) + 'px';
            }
            textWrap.appendChild(name);
            if (detailText) {
                var detail = this.el('div', 'es-exec-detail', detailText);
                detail.style.color = cmdColor;
                if (indent > 0) detail.style.paddingLeft = name.style.paddingLeft;
                textWrap.appendChild(detail);
            }
            row.appendChild(idx);
            row.appendChild(textWrap);
            listEl.appendChild(row);
        }
    };

    EE.prototype.syncEventSettingsExecHeightToLeft = function() {
        if (!this.eventSettingsExecSec) return;
        var sec = this.eventSettingsExecSec;
        var body = this.eventSettingsExecBody;
        var list = this.eventSettingsExecList;
        var fixed = Math.max(0, Math.floor(Number(this.eventSettingsExecFixedHeight || 0)));
        if (fixed <= 0) {
            var h = 0;
            var left = this.eventSettingsLeftPane;
            if (left && typeof left.getBoundingClientRect === 'function') {
                try { h = Math.floor(Number(left.getBoundingClientRect().height || 0)); } catch (_) { h = 0; }
            }
            if (h <= 0 && sec.parentNode && typeof sec.parentNode.getBoundingClientRect === 'function') {
                try { h = Math.floor(Number(sec.parentNode.getBoundingClientRect().height || 0)); } catch (_) { h = 0; }
            }
            if (h > 0) {
                fixed = h;
                this.eventSettingsExecFixedHeight = h;
            }
        }
        if (fixed > 0) {
            var px = String(fixed) + 'px';
            sec.style.boxSizing = 'border-box';
            sec.style.flex = '0 0 auto';
            sec.style.height = px;
            sec.style.minHeight = px;
            sec.style.maxHeight = px;
            if (body) {
                body.style.height = '100%';
                body.style.minHeight = '0';
                body.style.maxHeight = '100%';
            }
            if (list) {
                list.style.height = '100%';
                list.style.minHeight = '0';
                list.style.maxHeight = '100%';
            }
            return;
        }
        sec.style.boxSizing = '';
        sec.style.flex = '';
        sec.style.height = '';
        sec.style.minHeight = '';
        sec.style.maxHeight = '';
        if (body) {
            body.style.height = '';
            body.style.minHeight = '';
            body.style.maxHeight = '';
        }
        if (list) {
            list.style.height = '';
            list.style.minHeight = '';
            list.style.maxHeight = '';
        }
    };

    EE.prototype.scheduleEventSettingsExecHeightSync = function() {
        var self = this;
        var run = function() {
            if (typeof self.syncEventSettingsExecHeightToLeft === 'function') {
                self.syncEventSettingsExecHeightToLeft();
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() { requestAnimationFrame(run); });
        } else {
            setTimeout(run, 0);
        }
    };

    EE.prototype.eventSettingsExpandNoteForZoom = function(text) {
        var s = String(text == null ? '' : text);
        s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        s = s.replace(/>\s*</g, '>\n<');
        return s;
    };

    EE.prototype.eventSettingsCompactNoteFromZoom = function(text) {
        var s = String(text == null ? '' : text);
        s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        s = s.replace(/\n+/g, '');
        return s;
    };

    EE.prototype.openEventSettingsNoteZoomFromClick = function() {
        if (!this.eventSettingsModal || !this.eventSettingsModal.classList || !this.eventSettingsModal.classList.contains('on')) return;
        if (!this.eventSettingsNoteInput || !this.eventSettingsNoteZoomModal || !this.eventSettingsNoteZoomInput) return;
        var now = Date.now();
        if (now < Math.max(0, Number(this.eventSettingsNoteZoomIgnoreUntil || 0))) return;
        if (this.eventSettingsNoteZoomModal.classList.contains('on')) return;
        var source = String(this.eventSettingsNoteInput.value || '');
        this.eventSettingsNoteZoomInput.value = this.eventSettingsExpandNoteForZoom(source);
        this.eventSettingsNoteZoomModal.classList.add('on');
        try { this.eventSettingsNoteInput.blur(); } catch (_) {}
        var self = this;
        setTimeout(function() {
            try {
                if (!self.eventSettingsNoteZoomModal || !self.eventSettingsNoteZoomModal.classList.contains('on')) return;
                self.eventSettingsNoteZoomInput.focus();
            } catch (_) {}
        }, 0);
    };

    EE.prototype.closeEventSettingsNoteZoom = function(apply) {
        if (!this.eventSettingsNoteZoomModal || !this.eventSettingsNoteZoomModal.classList) return;
        if (!this.eventSettingsNoteZoomModal.classList.contains('on')) return;
        if (apply && this.eventSettingsNoteInput && this.eventSettingsNoteZoomInput) {
            var compact = this.eventSettingsCompactNoteFromZoom(this.eventSettingsNoteZoomInput.value);
            var maxLen = Math.max(0, Math.floor(Number(this.eventSettingsNoteInput.maxLength || 0)));
            if (maxLen > 0 && compact.length > maxLen) compact = compact.slice(0, maxLen);
            this.eventSettingsNoteInput.value = compact;
        }
        this.eventSettingsNoteZoomModal.classList.remove('on');
        this.eventSettingsNoteZoomIgnoreUntil = Date.now() + 220;
    };

    EE.prototype.loadEventSettingsEditorPageFromForm = function() {
        var eid = Math.max(0, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        var pageIndex = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;
        if (this.eventSettingsPageSelect) this.eventSettingsPageSelect.value = String(pageIndex);
        this.eventSettingsSyncPageTabsFromSelect();
        this.eventSettingsTargetPageIndex = pageIndex;
        var page = this.eventSettingsEnsurePage(evData.pages[pageIndex] || {});
        evData.pages[pageIndex] = page;
        var c = page.conditions || {};
        var img = page.image || {};
        var route = page.moveRoute || this.defaultMoveRoute();
        this.eventSettingsPopulateConditionLists();
        this.eventSettingsSw1Valid.checked = !!c.switch1Valid;
        this.eventSettingsSw1Id.value = String(Math.max(1, Math.floor(Number(c.switch1Id || 1))));
        this.eventSettingsSw2Valid.checked = !!c.switch2Valid;
        this.eventSettingsSw2Id.value = String(Math.max(1, Math.floor(Number(c.switch2Id || 1))));
        this.eventSettingsVarValid.checked = !!c.variableValid;
        this.eventSettingsVarId.value = String(Math.max(1, Math.floor(Number(c.variableId || 1))));
        this.eventSettingsVarValue.value = String(Math.floor(Number(c.variableValue || 0)));
        this.eventSettingsSelfValid.checked = !!c.selfSwitchValid;
        this.eventSettingsSelfCh.value = String(c.selfSwitchCh || 'A').toUpperCase();
        this.eventSettingsItemValid.checked = !!c.itemValid;
        this.eventSettingsItemId.value = String(Math.max(1, Math.floor(Number(c.itemId || 1))));
        this.eventSettingsActorValid.checked = !!c.actorValid;
        this.eventSettingsActorId.value = String(Math.max(1, Math.floor(Number(c.actorId || 1))));
        if (this.eventSettingsScriptCondValid) this.eventSettingsScriptCondValid.checked = !!c.scriptValid;
        if (this.eventSettingsScriptCondText) {
            this.eventSettingsScriptCondText.value = this.eventSettingsNormalizeScriptConditionText(c.scriptText || '');
        }
        this.eventSettingsUseTile.checked = Math.floor(Number(img.tileId || 0)) > 0;
        this.eventSettingsTileId.value = String(Math.max(0, Math.floor(Number(img.tileId || 0))));
        this.eventSettingsCharName.value = String(img.characterName || '');
        this.eventSettingsCharIndex.value = String(Math.max(0, Math.min(7, Math.floor(Number(img.characterIndex || 0)))));
        this.eventSettingsDirection.value = String(Number(img.direction || 2));
        this.eventSettingsPattern.value = String(Math.max(0, Math.min(2, Math.floor(Number(img.pattern == null ? 1 : img.pattern)))));
        this.eventSettingsMoveType.value = String(Math.max(0, Math.min(3, Math.floor(Number(page.moveType || 0)))));
        this.eventSettingsMoveSpeed.value = String(Math.max(1, Math.min(6, Math.floor(Number(page.moveSpeed || 3)))));
        this.eventSettingsMoveFrequency.value = String(Math.max(1, Math.min(5, Math.floor(Number(page.moveFrequency || 3)))));
        this.eventSettingsMoveRepeat.checked = !!route.repeat;
        this.eventSettingsMoveSkippable.checked = !!route.skippable;
        this.eventSettingsMoveWait.checked = !!route.wait;
        this.eventSettingsMoveRouteDraft = clone(route);
        if (this.eventSettingsTransparentStart) {
            this.eventSettingsTransparentStart.checked = this.eventSettingsDetectTransparentStartFromPage(page);
        }
        if (this.eventSettingsTransparentStart && this.eventSettingsTransparentStart.checked) {
            this.eventSettingsApplyTransparentStartPresetToForm();
        }
        this.eventSettingsTransparentStartRestore = null;
        this.eventSettingsTransparentStartPrevOn = !!(this.eventSettingsTransparentStart && this.eventSettingsTransparentStart.checked);
        this.eventSettingsRefreshMoveRouteButtonLabel();
        this.eventSettingsWalkAnime.checked = !!page.walkAnime;
        this.eventSettingsStepAnime.checked = !!page.stepAnime;
        this.eventSettingsDirectionFix.checked = !!page.directionFix;
        this.eventSettingsThrough.checked = !!page.through;
        this.eventSettingsPriorityType.value = String(Math.max(0, Math.min(2, Math.floor(Number(page.priorityType || 0)))));
        this.eventSettingsTrigger.value = String(Math.max(0, Math.min(4, Math.floor(Number(page.trigger || 0)))));
        this.syncEventSettingsEditorFormEnabled();
        this.refreshEventSettingsImagePreview();
        this.eventSettingsExecSig = '';
        this.renderEventSettingsExecutionList();
        this.eventSettingsRefreshPageActionButtons();
        if (this.eventSettingsHead) this.eventSettingsHead.textContent = 'ID:' + eid + ' - イベントエディター';
        if (typeof this.scheduleEventSettingsExecHeightSync === 'function') this.scheduleEventSettingsExecHeightSync();
    };

    EE.prototype.openEventSettingsEditorFromContext = function() {
        if (this.isBattleEventMode()) {
            this.closeCharContextMenu();
            this.openBattleEventSettingsEditor(this.currentBattleTroopId());
            return;
        }
        var id = Math.max(0, Math.floor(Number(this.charCtxTargetId || 0)));
        this.closeCharContextMenu();
        if (id <= 0) {
            this.msg('イベントのみ編集できます');
            return;
        }
        this.openEventSettingsEditor(id);
    };

    EE.prototype.openEventSettingsEditor = function(eventId) {
        if (this.isBattleEventMode()) {
            this.openBattleEventSettingsEditor(this.currentBattleTroopId());
            return;
        }
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        if (!this.eventSettingsModal || !this.eventSettingsNameInput || !this.eventSettingsPageSelect) return;
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eventId] : null;
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) {
            this.msg('イベントページがありません');
            return;
        }
        var evObj = $gameMap && typeof $gameMap.event === 'function' ? $gameMap.event(eventId) : null;
        this.eventSettingsTargetEventId = eventId;
        this.eventSettingsMoveRouteDraft = null;
        this.eventSettingsTransparentStartRestore = null;
        this.eventSettingsTransparentStartPrevOn = false;
        this.eventSettingsNameInput.value = String(evData.name || '');
        this.eventSettingsNoteInput.value = String(evData.note || '');
        var pageIndex = 0;
        if (evObj && Number(evObj._pageIndex || -1) >= 0) pageIndex = Math.floor(Number(evObj._pageIndex || 0));
        else if (this.selEid === eventId && this.selPage >= 0) pageIndex = Math.floor(Number(this.selPage || 0));
        if (pageIndex < 0) pageIndex = 0;
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;
        this.eventSettingsExecFixedHeight = 0;
        this.eventSettingsRebuildPageSelectOptions(evData, pageIndex);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.eventSettingsModal);
        if (typeof this.scheduleEventSettingsExecHeightSync === 'function') this.scheduleEventSettingsExecHeightSync();
        this.eventSettingsNameInput.focus();
        this.eventSettingsNameInput.select();
    };

    EE.prototype.jumpToTimelineEditorFromEventSettingsExec = function() {
        var eid = Math.max(1, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) {
            this.msg('イベントページがありません');
            return;
        }
        var pageIndex = Math.max(0, Math.floor(Number(
            this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || this.eventSettingsTargetPageIndex || 0
        )));
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;

        this.closeEventSettingsEditor();
        this.selectEvent(eid, true);
        if (this.selEid !== eid) return;

        var targetKey = this.key(eid, pageIndex);
        if (this.selPage !== pageIndex || String(this.selKey || '') !== String(targetKey)) {
            this.selPage = pageIndex;
            this.selKey = targetKey;
            this.ensureTrack(eid, pageIndex);
            this.queueTimelineViewRestoreForTrack(eid, pageIndex);
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.panelSelectedCharId = Number(eid || 0);
            this.refreshEventInfo();
            this.rebuildSchedule({ skipRouteNormalize: true });
            this.timelineDirty = true;
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
        }
        this.msg('イベント編集に移動: ID:' + eid + ' / Page:' + String(pageIndex + 1));
    };

    EE.prototype.closeEventSettingsEditor = function() {
        if (!this.eventSettingsModal) return;
        if (typeof this.closeEventSettingsNoteZoom === 'function') this.closeEventSettingsNoteZoom(true);
        if (this.eventSettingsImagePickerModal && this.eventSettingsImagePickerModal.classList.contains('on')) {
            this.closeEventSettingsImagePicker(false);
        }
        this.eventSettingsModal.classList.remove('on');
        this.eventSettingsTargetEventId = 0;
        this.eventSettingsTargetPageIndex = 0;
        this.eventSettingsMoveRouteDraft = null;
        this.eventSettingsTransparentStartRestore = null;
        this.eventSettingsTransparentStartPrevOn = false;
        this.eventSettingsExecFixedHeight = 0;
        if (typeof this.syncEventSettingsExecHeightToLeft === 'function') this.syncEventSettingsExecHeightToLeft();
        if (this.eventSettingsPageTabs) this.eventSettingsPageTabs.innerHTML = '';
        if (this.eventSettingsExecList) this.eventSettingsExecList.innerHTML = '';
        this.eventSettingsExecSig = '';
    };

    EE.prototype.applyEventSettingsEditor = function() {
        if (this.isBattleEventMode()) {
            this.applyBattleEventSettingsEditor();
            return;
        }
        if (typeof this.closeEventSettingsNoteZoom === 'function') this.closeEventSettingsNoteZoom(true);
        var eid = Math.max(1, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) {
            this.closeEventSettingsEditor();
            return;
        }
        var pageIndex = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || this.eventSettingsTargetPageIndex || 0)));
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;
        var page = this.eventSettingsEnsurePage(evData.pages[pageIndex] || {});
        evData.pages[pageIndex] = page;
        evData.name = String(this.eventSettingsNameInput ? this.eventSettingsNameInput.value : evData.name || '');
        evData.note = String(this.eventSettingsNoteInput ? this.eventSettingsNoteInput.value : evData.note || '');
        if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.extractMetadata === 'function') {
            try { DataManager.extractMetadata(evData); } catch (_) {}
        }
        var c = page.conditions || (page.conditions = {});
        c.switch1Valid = !!(this.eventSettingsSw1Valid && this.eventSettingsSw1Valid.checked);
        c.switch1Id = Math.max(1, Math.floor(Number(this.eventSettingsSw1Id && this.eventSettingsSw1Id.value || 1)));
        c.switch2Valid = !!(this.eventSettingsSw2Valid && this.eventSettingsSw2Valid.checked);
        c.switch2Id = Math.max(1, Math.floor(Number(this.eventSettingsSw2Id && this.eventSettingsSw2Id.value || 1)));
        c.variableValid = !!(this.eventSettingsVarValid && this.eventSettingsVarValid.checked);
        c.variableId = Math.max(1, Math.floor(Number(this.eventSettingsVarId && this.eventSettingsVarId.value || 1)));
        c.variableValue = Math.floor(Number(this.eventSettingsVarValue && this.eventSettingsVarValue.value || 0));
        c.selfSwitchValid = !!(this.eventSettingsSelfValid && this.eventSettingsSelfValid.checked);
        var selfCh = String(this.eventSettingsSelfCh && this.eventSettingsSelfCh.value || 'A').toUpperCase();
        if (!/^[ABCD]$/.test(selfCh)) selfCh = 'A';
        c.selfSwitchCh = selfCh;
        c.itemValid = !!(this.eventSettingsItemValid && this.eventSettingsItemValid.checked);
        c.itemId = Math.max(1, Math.floor(Number(this.eventSettingsItemId && this.eventSettingsItemId.value || 1)));
        c.actorValid = !!(this.eventSettingsActorValid && this.eventSettingsActorValid.checked);
        c.actorId = Math.max(1, Math.floor(Number(this.eventSettingsActorId && this.eventSettingsActorId.value || 1)));
        c.scriptValid = !!(this.eventSettingsScriptCondValid && this.eventSettingsScriptCondValid.checked);
        c.scriptText = this.eventSettingsNormalizeScriptConditionText(this.eventSettingsScriptCondText && this.eventSettingsScriptCondText.value || '');
        if (typeof this.eventSettingsApplyScriptConditionToEventList === 'function') {
            this.eventSettingsApplyScriptConditionToEventList(page, c.scriptValid, c.scriptText);
            c = page.conditions || c;
        }

        var img = page.image || (page.image = {});
        var useTile = !!(this.eventSettingsUseTile && this.eventSettingsUseTile.checked);
        var tileId = Math.max(0, Math.floor(Number(this.eventSettingsTileId && this.eventSettingsTileId.value || 0)));
        var charName = String(this.eventSettingsCharName && this.eventSettingsCharName.value || '');
        var charIndex = Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsCharIndex && this.eventSettingsCharIndex.value || 0))));
        var dir = Math.floor(Number(this.eventSettingsDirection && this.eventSettingsDirection.value || 2));
        if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
        var patt = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPattern && this.eventSettingsPattern.value || 1))));
        img.tileId = useTile ? tileId : 0;
        img.characterName = useTile ? '' : charName;
        img.characterIndex = useTile ? 0 : charIndex;
        img.direction = dir;
        img.pattern = patt;

        page.moveSpeed = Math.max(1, Math.min(6, Math.floor(Number(this.eventSettingsMoveSpeed && this.eventSettingsMoveSpeed.value || 3))));
        var transparentStartOn = !!(this.eventSettingsTransparentStart && this.eventSettingsTransparentStart.checked);
        if (transparentStartOn) this.eventSettingsApplyTransparentStartPresetToForm();
        page.moveType = transparentStartOn
            ? 3
            : Math.max(0, Math.min(3, Math.floor(Number(this.eventSettingsMoveType && this.eventSettingsMoveType.value || 0))));
        page.moveFrequency = transparentStartOn
            ? 5
            : Math.max(1, Math.min(5, Math.floor(Number(this.eventSettingsMoveFrequency && this.eventSettingsMoveFrequency.value || 3))));
        var draftRoute = (this.eventSettingsMoveRouteDraft && typeof this.eventSettingsMoveRouteDraft === 'object')
            ? clone(this.eventSettingsMoveRouteDraft)
            : null;
        if (!draftRoute) {
            draftRoute = page.moveRoute && typeof page.moveRoute === 'object'
                ? clone(page.moveRoute)
                : this.defaultMoveRoute();
        }
        if (transparentStartOn) {
            draftRoute = this.eventSettingsTransparentStartPresetRoute();
        } else {
            if (!Array.isArray(draftRoute.list)) draftRoute.list = [{ code: 0, parameters: [] }];
            if (!draftRoute.list.length || Number(draftRoute.list[draftRoute.list.length - 1].code || 0) !== 0) {
                draftRoute.list.push({ code: 0, parameters: [] });
            }
            if (this.eventSettingsMoveRepeat) draftRoute.repeat = !!this.eventSettingsMoveRepeat.checked;
            else if (draftRoute.repeat == null) draftRoute.repeat = false;
            if (this.eventSettingsMoveSkippable) draftRoute.skippable = !!this.eventSettingsMoveSkippable.checked;
            else if (draftRoute.skippable == null) draftRoute.skippable = false;
            if (this.eventSettingsMoveWait) draftRoute.wait = !!this.eventSettingsMoveWait.checked;
            else if (draftRoute.wait == null) draftRoute.wait = false;
        }
        page.moveRoute = draftRoute;
        page.eeTransparentStart = transparentStartOn;
        page.walkAnime = !!(this.eventSettingsWalkAnime && this.eventSettingsWalkAnime.checked);
        page.stepAnime = !!(this.eventSettingsStepAnime && this.eventSettingsStepAnime.checked);
        page.directionFix = !!(this.eventSettingsDirectionFix && this.eventSettingsDirectionFix.checked);
        page.through = !!(this.eventSettingsThrough && this.eventSettingsThrough.checked);
        page.priorityType = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPriorityType && this.eventSettingsPriorityType.value || 1))));
        page.trigger = Math.max(0, Math.min(4, Math.floor(Number(this.eventSettingsTrigger && this.eventSettingsTrigger.value || 0))));

        var dirtyKey = this.key(eid, pageIndex);
        this.ensureTrack(eid, pageIndex);
        this.dirty[dirtyKey] = true;
        if ($gameMap && $gameMap.requestRefresh) $gameMap.requestRefresh();
        var evObj = $gameMap && typeof $gameMap.event === 'function' ? $gameMap.event(eid) : null;
        if (evObj) {
            evObj._setCss = false;
            evObj._cssRect = null;
            if (typeof evObj.refresh === 'function') evObj.refresh();
        }
        this.closeEventSettingsEditor();
        if (this.selEid === eid) {
            this.selectEvent(eid, true);
        } else {
            this.refreshEventInfo();
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            this.timelineDirty = true;
        }
        this.msg('イベント設定を更新');
    };

    EE.prototype.selectCharacterFromPanel = function(charId) {
        this.selectCharacterForTimeline(Number(charId || 0), 'panel');
    };

    EE.prototype.refreshCharacterPanel = function(force) {
        if (!this.charList) return;
        if (this.isBattleEventMode()) {
            var battleEntries = this.battlePagePanelEntries();
            var sigBattle = '';
            for (var bi = 0; bi < battleEntries.length; bi++) {
                var be = battleEntries[bi];
                sigBattle += String(be.pageIndex) + ':' + (be.selected ? 1 : 0) + ':' + String(be.text) + '|';
            }
            sigBattle += '#' + String(this.selKey || '');
            if (!force && sigBattle === this._charPanelSig) {
                this.refreshSelectedCharacterInfo(false);
                return;
            }
            this._charPanelSig = sigBattle;
            this.charList.innerHTML = '';
            if (!battleEntries.length) {
                this.charList.appendChild(this.el('div', 'charhint', 'バトルページが見つかりません'));
                this.refreshSelectedCharacterInfo(true);
                return;
            }
            var fragBattle = document.createDocumentFragment();
            var selfBattle = this;
            for (var bj = 0; bj < battleEntries.length; bj++) {
                (function(en) {
                    var cls = 'charit' + (en.selected ? ' sel' : '');
                    var b = selfBattle.el('button', cls, en.text);
                    b.type = 'button';
                    b.title = en.text + ' / ' + en.detail;
                    b.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        selfBattle.selectBattlePageFromPanel(en.pageIndex);
                    });
                    b.addEventListener('dblclick', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        selfBattle.selectBattlePageFromPanel(en.pageIndex);
                        selfBattle.openBattleEventSettingsEditor(en.troopId);
                    });
                    fragBattle.appendChild(b);
                })(battleEntries[bj]);
            }
            this.charList.appendChild(fragBattle);
            this.refreshSelectedCharacterInfo(true);
            return;
        }
        var entries = this.buildCharacterPanelEntries();
        var sig = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            sig += e.id + ':' + (e.visible ? 1 : 0) + ':' + (e.selected ? 1 : 0) + ':' + (e.inTimeline ? 1 : 0) + '|';
        }
        sig += '#' + String(this.selKey || '');
        if (!force && sig === this._charPanelSig) {
            this.refreshSelectedCharacterInfo(false);
            return;
        }
        this._charPanelSig = sig;
        this.charList.innerHTML = '';
        var self = this;
        var frag = document.createDocumentFragment();
        for (i = 0; i < entries.length; i++) {
            (function(en) {
                var b = self.el('button', 'charit' + (en.visible ? ' v' : '') + (en.selected ? ' sel' : ''), en.text);
                b.type = 'button';
                b.title = String(en.text || '');
                b.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.selectCharacterFromPanel(en.id);
                });
                b.addEventListener('dblclick', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.selectCharacterFromPanel(en.id);
                    var id = Math.max(0, Math.floor(Number(en.id || 0)));
                    var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[id] : null;
                    if (!evData) {
                        self.msg('イベントのみ編集できます');
                        return;
                    }
                    self.openEventSettingsEditor(id);
                });
                b.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.openCharContextMenu(en.id, e.clientX, e.clientY);
                });
                frag.appendChild(b);
            })(entries[i]);
        }
        this.charList.appendChild(frag);
        this.refreshSelectedCharacterInfo(true);
    };

    EE.prototype.timelineViewStorageContextId = function() {
        if (this.isBattleEventMode()) return Math.max(1, Math.floor(Number(this.currentBattleTroopId() || 0)));
        return ($gameMap && typeof $gameMap.mapId === 'function') ? Math.floor(Number($gameMap.mapId() || 0)) : 0;
    };

    EE.prototype.timelineViewStorageFilePath = function(contextId) {
        contextId = Math.max(1, Math.floor(Number(contextId || 0)));
        try {
            var path = require('path');
            var prefix = this.isBattleEventMode() ? 'Troop' : 'Map';
            var file = prefix + ('000' + contextId).slice(-3) + '.timelineView.json';
            return path.join(process.cwd(), 'data', '_event_editor', file);
        } catch (_) {
            return '';
        }
    };

    EE.prototype.readTimelineViewStoreForMap = function(contextId) {
        var filePath = this.timelineViewStorageFilePath(contextId);
        if (!filePath) return {};
        try {
            var fs = require('fs');
            if (!fs.existsSync(filePath)) return {};
            var raw = fs.readFileSync(filePath, 'utf8');
            if (!raw || !String(raw).trim().length) return {};
            var obj = JSON.parse(raw);
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
            if (obj.views && typeof obj.views === 'object' && !Array.isArray(obj.views)) return obj.views;
            return obj;
        } catch (_) {
            return {};
        }
    };

    EE.prototype.writeTimelineViewStoreForMap = function(contextId, store) {
        var filePath = this.timelineViewStorageFilePath(contextId);
        if (!filePath) return false;
        store = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
        try {
            var fs = require('fs');
            var path = require('path');
            var dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
            return true;
        } catch (_) {
            return false;
        }
    };

    EE.prototype.timelineViewStoreKey = function(eventId, pageIndex) {
        return String(Math.floor(Number(eventId || 0))) + ':' + String(Math.floor(Number(pageIndex || 0)));
    };

    EE.prototype.sanitizeIfBranchViewMode = function(mode) {
        var m = String(mode || '').toLowerCase();
        if (m === 'auto') return 'auto';
        if (m === 'else') return 'else';
        return 'then';
    };

    EE.prototype.normalizeIfBranchViewModes = function(src) {
        var out = Object.create(null);
        if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
        var keys = Object.keys(src);
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i] || '');
            if (!k.length) continue;
            out[k] = this.sanitizeIfBranchViewMode(src[k]);
        }
        return out;
    };

    EE.prototype.sanitizeChoiceBranchViewMode = function(mode) {
        var m = String(mode == null ? '' : mode).toLowerCase();
        if (m === 'auto') return 'auto';
        if (m === 'cancel') return 'cancel';
        if (/^-?\d+$/.test(m)) {
            var n = Math.floor(Number(m || 0));
            if (n >= 0 && n <= 5) return String(n);
        }
        return 'auto';
    };

    EE.prototype.normalizeChoiceBranchViewModes = function(src) {
        var out = Object.create(null);
        if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
        var keys = Object.keys(src);
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i] || '');
            if (!k.length) continue;
            out[k] = this.sanitizeChoiceBranchViewMode(src[k]);
        }
        return out;
    };

    EE.prototype.resolveTrackForIfBranchEntry = function(entry) {
        if (entry && this.model && this.model.tracks) {
            var k = this.key(Number(entry.eventId || 0), Number(entry.pageIndex || 0));
            if (this.model.tracks[k]) return this.model.tracks[k];
        }
        if (this.model && this.model.tracks && this.model.tracks[this.selKey]) return this.model.tracks[this.selKey];
        return null;
    };

    EE.prototype.computeIfBranchDisplayInfoForTrack = function(tr) {
        var info = {
            list: [],
            blocks: [],
            ifUidToOrdinal: Object.create(null)
        };
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return info;
        var list = tr.commands.slice(0);
        list.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        var stack = [];
        var blocks = [];
        var ifUidToOrdinal = Object.create(null);
        var ordinal = 0;
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            var indent = Math.floor(Number(e.command.indent || 0));
            var uid = Math.floor(Number(e.uid || 0));
            if (code === 111) {
                ordinal++;
                var ctx = {
                    ifUid: uid,
                    ifIndex: i,
                    indent: indent,
                    elseIndex: -1,
                    endIndex: -1,
                    ordinal: ordinal
                };
                stack.push(ctx);
                if (uid > 0) ifUidToOrdinal[String(uid)] = ordinal;
                continue;
            }
            if (code === 411) {
                for (var j = stack.length - 1; j >= 0; j--) {
                    if (stack[j].indent !== indent) continue;
                    if (stack[j].elseIndex < 0) stack[j].elseIndex = i;
                    break;
                }
                continue;
            }
            if (code === 412) {
                for (j = stack.length - 1; j >= 0; j--) {
                    if (stack[j].indent !== indent) continue;
                    var done = stack.splice(j, 1)[0];
                    done.endIndex = i;
                    blocks.push(done);
                    break;
                }
            }
        }
        while (stack.length) {
            var rest = stack.pop();
            rest.endIndex = list.length;
            blocks.push(rest);
        }
        blocks.sort(function(a, b) {
            var ai = Math.floor(Number(a && a.ifIndex || 0));
            var bi = Math.floor(Number(b && b.ifIndex || 0));
            if (ai !== bi) return ai - bi;
            return Math.floor(Number(a && a.ordinal || 0)) - Math.floor(Number(b && b.ordinal || 0));
        });
        info.list = list;
        info.blocks = blocks;
        info.ifUidToOrdinal = ifUidToOrdinal;
        return info;
    };

    EE.prototype.computeChoiceBranchDisplayInfoForTrack = function(tr) {
        var info = {
            list: [],
            blocks: [],
            choiceUidToOrdinal: Object.create(null)
        };
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return info;
        var list = tr.commands.slice(0);
        list.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        var stack = [];
        var blocks = [];
        var choiceUidToOrdinal = Object.create(null);
        var ordinal = 0;
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            var indent = Math.floor(Number(e.command.indent || 0));
            var uid = Math.floor(Number(e.uid || 0));
            if (code === 102) {
                ordinal++;
                var b = {
                    choiceUid: uid,
                    choiceIndex: i,
                    indent: indent,
                    endIndex: list.length,
                    branches: [],
                    ordinal: ordinal
                };
                stack.push(b);
                blocks.push(b);
                if (uid > 0) choiceUidToOrdinal[String(uid)] = ordinal;
                continue;
            }
            if (code === 402 || code === 403) {
                for (var j = stack.length - 1; j >= 0; j--) {
                    var open = stack[j];
                    if (!open || open.indent !== indent) continue;
                    var brs = Array.isArray(open.branches) ? open.branches : (open.branches = []);
                    if (brs.length) {
                        var prev = brs[brs.length - 1];
                        if (prev && (prev.endIndex == null || prev.endIndex > i)) prev.endIndex = i;
                    }
                    var choiceIndex = -1;
                    if (code === 402) {
                        var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
                        choiceIndex = Math.max(0, Math.floor(Number(p[0] || 0)));
                    }
                    brs.push({
                        type: (code === 402) ? 'choice' : 'cancel',
                        choiceIndex: choiceIndex,
                        markerIndex: i,
                        startIndex: i + 1,
                        endIndex: open.endIndex
                    });
                    break;
                }
                continue;
            }
            if (code === 404) {
                for (j = stack.length - 1; j >= 0; j--) {
                    if (!stack[j] || stack[j].indent !== indent) continue;
                    var done = stack.splice(j, 1)[0];
                    done.endIndex = i;
                    if (Array.isArray(done.branches) && done.branches.length) {
                        var lastBranch = done.branches[done.branches.length - 1];
                        if (lastBranch && (lastBranch.endIndex == null || lastBranch.endIndex > i)) lastBranch.endIndex = i;
                    }
                    break;
                }
            }
        }
        while (stack.length) {
            var rest = stack.pop();
            rest.endIndex = list.length;
            if (Array.isArray(rest.branches) && rest.branches.length) {
                var tail = rest.branches[rest.branches.length - 1];
                if (tail && (tail.endIndex == null || tail.endIndex > rest.endIndex)) tail.endIndex = rest.endIndex;
            }
        }
        blocks.sort(function(a, b) {
            var ai = Math.floor(Number(a && a.choiceIndex || 0));
            var bi = Math.floor(Number(b && b.choiceIndex || 0));
            if (ai !== bi) return ai - bi;
            return Math.floor(Number(a && a.ordinal || 0)) - Math.floor(Number(b && b.ordinal || 0));
        });
        info.list = list;
        info.blocks = blocks;
        info.choiceUidToOrdinal = choiceUidToOrdinal;
        return info;
    };

    EE.prototype.choiceBranchConfiguredModeForBlock = function(modeMap, block) {
        modeMap = modeMap || Object.create(null);
        block = block || {};
        var ord = String(Math.floor(Number(block.ordinal || 0)));
        var uid = String(Math.floor(Number(block.choiceUid || 0)));
        return this.sanitizeChoiceBranchViewMode(modeMap[ord] || modeMap[uid]);
    };

    EE.prototype.evaluateChoiceBranchAutoForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 102) return 0;
        var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
        var choices = Array.isArray(p[0]) ? p[0] : [];
        var len = choices.length;
        if (len <= 0) return -1;
        var def = Math.floor(Number(p[2] || 0));
        if (def >= 0 && def < len) return def;
        return 0;
    };

    EE.prototype.choiceBranchCountForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 102) return 0;
        var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
        var choices = Array.isArray(p[0]) ? p[0] : [];
        return Math.max(0, Math.floor(Number(choices.length || 0)));
    };

    EE.prototype.choiceBranchEffectiveResultForBlock = function(tr, info, block, modeMap) {
        var mode = this.choiceBranchConfiguredModeForBlock(modeMap, block);
        var list = (info && Array.isArray(info.list)) ? info.list : [];
        var idx = Math.floor(Number(block && block.choiceIndex || -1));
        var entry = (idx >= 0 && idx < list.length) ? list[idx] : null;
        if (mode === 'cancel') return -1;
        if (mode !== 'auto' && /^-?\d+$/.test(String(mode))) {
            var forced = Math.floor(Number(mode || 0));
            var len = this.choiceBranchCountForEntry(entry);
            if (forced >= 0 && forced < len) return forced;
        }
        return this.evaluateChoiceBranchAutoForEntry(entry);
    };

    EE.prototype.ifBranchConfiguredModeForBlock = function(modeMap, block) {
        modeMap = modeMap || Object.create(null);
        block = block || {};
        var ord = String(Math.floor(Number(block.ordinal || 0)));
        var uid = String(Math.floor(Number(block.ifUid || 0)));
        return this.sanitizeIfBranchViewMode(modeMap[ord] || modeMap[uid]);
    };

    EE.prototype.ifBranchEffectiveModeForBlock = function(tr, info, block, modeMap) {
        var mode = this.ifBranchConfiguredModeForBlock(modeMap, block);
        if (mode !== 'auto') return mode;
        var list = (info && Array.isArray(info.list)) ? info.list : [];
        var ifIdx = Math.floor(Number(block && block.ifIndex || -1));
        var ifEntry = (ifIdx >= 0 && ifIdx < list.length) ? list[ifIdx] : null;
        return this.evaluateIfConditionAutoForEntry(ifEntry) ? 'then' : 'else';
    };

    EE.prototype.trackHasAutoIfBranchViewMode = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return false;
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var blocks = info.blocks || [];
        var modeMap = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        for (var i = 0; i < blocks.length; i++) {
            if (this.ifBranchConfiguredModeForBlock(modeMap, blocks[i]) === 'auto') return true;
        }
        return false;
    };

    EE.prototype.computeIfBranchViewStateForTrack = function(tr) {
        var out = {
            info: this.computeIfBranchDisplayInfoForTrack(tr),
            hidden: Object.create(null),
            highlights: Object.create(null)
        };
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return out;
        var info = out.info || {};
        var list = Array.isArray(info.list) ? info.list : [];
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        if (!list.length) return out;

        var modeMap = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        var blockByUid = Object.create(null);
        for (var bi = 0; bi < blocks.length; bi++) {
            var bb = blocks[bi];
            if (!bb) continue;
            var buid = Math.floor(Number(bb.ifUid || 0));
            if (buid <= 0) continue;
            blockByUid[String(buid)] = bb;
            out.highlights[String(buid)] = { block: bb, start: null, entries: [] };
        }

        var stack = [];
        var self = this;
        var branchActive = function(ctx) {
            if (!ctx) return true;
            return (ctx.phase === 'else') ? !ctx.result : !!ctx.result;
        };
        var isVisibleForIndent = function(indent) {
            indent = Math.max(0, Math.floor(Number(indent || 0)));
            for (var si = 0; si < stack.length; si++) {
                var sc = stack[si];
                if (!sc) continue;
                if (indent <= Math.max(0, Math.floor(Number(sc.indent || 0)))) continue;
                if (!branchActive(sc)) return false;
            }
            return true;
        };
        var pushEntryToActiveAncestors = function(entry, indent) {
            indent = Math.max(0, Math.floor(Number(indent || 0)));
            for (var si = 0; si < stack.length; si++) {
                var sc = stack[si];
                if (!sc) continue;
                if (indent <= Math.max(0, Math.floor(Number(sc.indent || 0)))) continue;
                if (!branchActive(sc)) continue;
                var hk = String(sc.blockUid || '');
                if (!hk.length || !out.highlights[hk]) continue;
                out.highlights[hk].entries.push(entry);
            }
        };

        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            var indent = Math.max(0, Math.floor(Number(e.command.indent || 0)));
            var uid = Math.floor(Number(e.uid || 0));
            var uidKey = String(uid);
            var parentVisible = isVisibleForIndent(indent);

            if (code === 111) {
                if (parentVisible) pushEntryToActiveAncestors(e, indent);
                if (!parentVisible && uid > 0) out.hidden[uidKey] = true;

                for (var ps = stack.length - 1; ps >= 0; ps--) {
                    if (Math.max(0, Math.floor(Number(stack[ps].indent || 0))) >= indent) stack.splice(ps, 1);
                }

                var block = blockByUid[uidKey] || {
                    ifUid: uid,
                    ifIndex: i,
                    indent: indent,
                    elseIndex: -1,
                    endIndex: -1,
                    ordinal: Math.floor(Number((info.ifUidToOrdinal || Object.create(null))[uidKey] || 0))
                };
                if (!out.highlights[uidKey]) out.highlights[uidKey] = { block: block, start: null, entries: [] };
                out.highlights[uidKey].start = e;

                var mode = self.ifBranchEffectiveModeForBlock(tr, info, block, modeMap);
                stack.push({
                    indent: indent,
                    result: (mode === 'else') ? false : true,
                    phase: 'then',
                    blockUid: uidKey
                });
                continue;
            }

            if (code === 411) {
                if (uid > 0) out.hidden[uidKey] = true;
                for (var es = stack.length - 1; es >= 0; es--) {
                    if (Math.max(0, Math.floor(Number(stack[es].indent || 0))) !== indent) continue;
                    stack[es].phase = 'else';
                    break;
                }
                continue;
            }

            if (code === 412) {
                if (uid > 0) out.hidden[uidKey] = true;
                for (var cs = stack.length - 1; cs >= 0; cs--) {
                    if (Math.max(0, Math.floor(Number(stack[cs].indent || 0))) >= indent) stack.splice(cs, 1);
                }
                continue;
            }

            if (!parentVisible) {
                if (uid > 0) out.hidden[uidKey] = true;
                continue;
            }
            pushEntryToActiveAncestors(e, indent);
        }
        return out;
    };

    EE.prototype.choiceBranchRuntimeIsActive = function(ctx) {
        if (!ctx) return true;
        var phase = String(ctx.phase || '');
        if (phase === 'choice') {
            return Math.floor(Number(ctx.activeChoiceIndex || -999)) === Math.floor(Number(ctx.phaseChoiceIndex || -998));
        }
        if (phase === 'cancel') {
            return Math.floor(Number(ctx.activeChoiceIndex || -999)) === -1;
        }
        return false;
    };

    EE.prototype.computeChoiceBranchHiddenUidMapForTrack = function(tr) {
        var hidden = Object.create(null);
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return hidden;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var list = Array.isArray(info.list) ? info.list : [];
        if (!list.length) return hidden;
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        var modeMap = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);
        var blockByUid = Object.create(null);
        for (var bi = 0; bi < blocks.length; bi++) {
            var bb = blocks[bi];
            if (!bb) continue;
            var buid = Math.floor(Number(bb.choiceUid || 0));
            if (buid <= 0) continue;
            blockByUid[String(buid)] = bb;
        }

        var stack = [];
        var isVisibleForIndent = function(indent) {
            indent = Math.max(0, Math.floor(Number(indent || 0)));
            for (var si = 0; si < stack.length; si++) {
                var sc = stack[si];
                if (!sc) continue;
                if (indent <= Math.max(0, Math.floor(Number(sc.indent || 0)))) continue;
                if (!this.choiceBranchRuntimeIsActive(sc)) return false;
            }
            return true;
        }.bind(this);

        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            var indent = Math.max(0, Math.floor(Number(e.command.indent || 0)));
            var uid = Math.floor(Number(e.uid || 0));
            var parentVisible = isVisibleForIndent(indent);

            if (code === 102) {
                if (!parentVisible) {
                    if (uid > 0) hidden[String(uid)] = true;
                    continue;
                }
                for (var ps = stack.length - 1; ps >= 0; ps--) {
                    if (Math.max(0, Math.floor(Number(stack[ps].indent || 0))) >= indent) stack.splice(ps, 1);
                }
                var block = blockByUid[String(uid)] || null;
                var selected = this.choiceBranchEffectiveResultForBlock(tr, info, block, modeMap);
                stack.push({
                    indent: indent,
                    activeChoiceIndex: Math.floor(Number(selected || 0)),
                    phase: 'none',
                    phaseChoiceIndex: -999
                });
                stack.sort(function(a, b) { return Math.floor(Number(a.indent || 0)) - Math.floor(Number(b.indent || 0)); });
                continue;
            }

            if (code === 402) {
                if (uid > 0) hidden[String(uid)] = true;
                for (var ws = stack.length - 1; ws >= 0; ws--) {
                    if (Math.max(0, Math.floor(Number(stack[ws].indent || 0))) !== indent) continue;
                    var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
                    stack[ws].phase = 'choice';
                    stack[ws].phaseChoiceIndex = Math.max(0, Math.floor(Number(p[0] || 0)));
                    break;
                }
                continue;
            }

            if (code === 403) {
                if (uid > 0) hidden[String(uid)] = true;
                for (ws = stack.length - 1; ws >= 0; ws--) {
                    if (Math.max(0, Math.floor(Number(stack[ws].indent || 0))) !== indent) continue;
                    stack[ws].phase = 'cancel';
                    stack[ws].phaseChoiceIndex = -1;
                    break;
                }
                continue;
            }

            if (code === 404) {
                if (uid > 0) hidden[String(uid)] = true;
                for (var cs = stack.length - 1; cs >= 0; cs--) {
                    if (Math.max(0, Math.floor(Number(stack[cs].indent || 0))) >= indent) stack.splice(cs, 1);
                }
                continue;
            }

            if (!parentVisible && uid > 0) hidden[String(uid)] = true;
        }
        return hidden;
    };

    EE.prototype.computeIfBranchHiddenUidMapForTrack = function(tr) {
        var ifHidden = this.computeIfBranchViewStateForTrack(tr).hidden;
        var choiceHidden = this.computeChoiceBranchHiddenUidMapForTrack(tr);
        var ck = Object.keys(choiceHidden || {});
        if (!ck.length) return ifHidden;
        var out = Object.create(null);
        var ik = Object.keys(ifHidden || {});
        for (var i = 0; i < ik.length; i++) out[ik[i]] = true;
        for (i = 0; i < ck.length; i++) out[ck[i]] = true;
        return out;
    };

    EE.prototype.isTimelineEntryVisibleByIfBranchMode = function(entry, tr) {
        if (!entry) return true;
        tr = tr || this.resolveTrackForIfBranchEntry(entry);
        if (!tr) return true;
        var uid = Math.floor(Number(entry.uid || 0));
        if (uid <= 0) return true;
        var hidden = this.computeIfBranchHiddenUidMapForTrack(tr);
        return !hidden[String(uid)];
    };

    EE.prototype.getChoiceBranchViewModeForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 102) return 'auto';
        var tr = this.resolveTrackForIfBranchEntry(entry);
        if (!tr) return 'auto';
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var uid = String(Math.floor(Number(entry.uid || 0)));
        var ord = Math.floor(Number((info.choiceUidToOrdinal || Object.create(null))[uid] || 0));
        var map = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);
        if (ord > 0) return this.sanitizeChoiceBranchViewMode(map[String(ord)]);
        return this.sanitizeChoiceBranchViewMode(map[uid]);
    };

    EE.prototype.setChoiceBranchViewModeForEntry = function(entry, mode) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 102) return false;
        var tr = this.resolveTrackForIfBranchEntry(entry);
        if (!tr) return false;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var uid = String(Math.floor(Number(entry.uid || 0)));
        var ord = Math.floor(Number((info.choiceUidToOrdinal || Object.create(null))[uid] || 0));
        var map = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);
        var key = (ord > 0) ? String(ord) : uid;
        var m = this.sanitizeChoiceBranchViewMode(mode);
        if (m === 'auto') delete map[key];
        else map[key] = m;
        if (key !== uid) delete map[uid];
        tr._eeChoiceBranchViewModes = map;
        if (this.selKey === this.key(tr.eventId, tr.pageIndex)) {
            this.timelineDirty = true;
        }
        return true;
    };

    EE.prototype.getIfBranchViewModeForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 111) return 'then';
        var tr = this.resolveTrackForIfBranchEntry(entry);
        if (!tr) return 'then';
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var uid = String(Math.floor(Number(entry.uid || 0)));
        var ord = Math.floor(Number(info.ifUidToOrdinal[uid] || 0));
        var map = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        if (ord > 0) return this.sanitizeIfBranchViewMode(map[String(ord)]);
        return this.sanitizeIfBranchViewMode(map[uid]);
    };

    EE.prototype.setIfBranchViewModeForEntry = function(entry, mode) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 111) return false;
        var tr = this.resolveTrackForIfBranchEntry(entry);
        if (!tr) return false;
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var uid = String(Math.floor(Number(entry.uid || 0)));
        var ord = Math.floor(Number(info.ifUidToOrdinal[uid] || 0));
        var map = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        var key = (ord > 0) ? String(ord) : uid;
        var m = this.sanitizeIfBranchViewMode(mode);
        if (m === 'then') delete map[key];
        else map[key] = m;
        if (key !== uid) delete map[uid];
        tr._eeIfBranchViewModes = map;
        if (this.selKey === this.key(tr.eventId, tr.pageIndex)) {
            this.timelineDirty = true;
        }
        return true;
    };

    EE.prototype.applyIfBranchViewModeByUid = function(uid, mode) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return false;
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 111) return false;
        if (!this.setIfBranchViewModeForEntry(e, mode)) return false;
        this.resetIfBranchRuntimeState();
        var wasPlaying = !!this.play;
        var targetFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (wasPlaying) this.playFrom(targetFrame);
        else this.seek(targetFrame);
        this.timelineDirty = true;
        this.persistSelectedTimelineViewStateToDisk();
        return true;
    };

    EE.prototype.resetIfBranchRuntimeState = function() {
        this._eeIfBranchRuntime = {
            rev: (this._scheduleRev >>> 0) || 0,
            lastFrame: -1,
            tracks: Object.create(null)
        };
    };

    EE.prototype.prepareIfBranchRuntimeStateForFrame = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var rev = (this._scheduleRev >>> 0) || 0;
        var st = this._eeIfBranchRuntime;
        var last = st ? Math.floor(Number(st.lastFrame == null ? -1 : st.lastFrame)) : -1;
        if (!st || st.rev !== rev || frame < last) {
            this._eeIfBranchRuntime = {
                rev: rev,
                lastFrame: frame,
                tracks: Object.create(null)
            };
            return;
        }
        st.lastFrame = frame;
    };

    EE.prototype.ifBranchRuntimeStateForTrackKey = function(trackKey) {
        if (!this._eeIfBranchRuntime || typeof this._eeIfBranchRuntime !== 'object') {
            this.resetIfBranchRuntimeState();
        }
        var key = String(trackKey || '');
        var tracks = this._eeIfBranchRuntime.tracks;
        if (!tracks[key]) {
            tracks[key] = {
                ifStack: [],
                choiceStack: []
            };
        } else {
            if (!Array.isArray(tracks[key].ifStack)) {
                tracks[key].ifStack = Array.isArray(tracks[key].stack) ? tracks[key].stack : [];
            }
            if (!Array.isArray(tracks[key].choiceStack)) tracks[key].choiceStack = [];
        }
        return tracks[key];
    };

    EE.prototype.evaluateIfConditionAutoForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 111) return false;
        try {
            var c = entry.command;
            var indent = Math.max(0, Math.floor(Number(c.indent || 0)));
            var params = clone(c.parameters || []);
            var it = new Game_Interpreter();
            it._mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? $gameMap.mapId() : 0;
            it._eventId = Math.max(0, Math.floor(Number(entry.eventId || 0)));
            it._branch = {};
            it._indent = indent;
            it._params = params;
            it._list = [
                { code: 111, indent: indent, parameters: params },
                { code: 0, indent: 0, parameters: [] }
            ];
            it._index = 0;
            if (typeof it.command111 !== 'function') return false;
            it.command111();
            return !!it._branch[indent];
        } catch (_) {
            return false;
        }
    };

    EE.prototype.resolveIfBranchResultForEntry = function(entry) {
        var mode = this.getIfBranchViewModeForEntry(entry);
        if (mode === 'then') return true;
        if (mode === 'else') return false;
        return this.evaluateIfConditionAutoForEntry(entry);
    };

    EE.prototype.resolveChoiceBranchResultForEntry = function(entry) {
        var mode = this.getChoiceBranchViewModeForEntry(entry);
        if (mode === 'cancel') return -1;
        if (mode !== 'auto' && /^-?\d+$/.test(String(mode))) {
            var forced = Math.floor(Number(mode || 0));
            var len = this.choiceBranchCountForEntry(entry);
            if (forced >= 0 && forced < len) return forced;
        }
        return this.evaluateChoiceBranchAutoForEntry(entry);
    };

    EE.prototype.shouldExecuteEntryByIfBranchRuntime = function(entry) {
        if (!entry || !entry.command) return false;
        var code = Math.floor(Number(entry.command.code || 0));
        var indent = Math.max(0, Math.floor(Number(entry.command.indent || 0)));
        var trackKey = this.key(Number(entry.eventId || 0), Number(entry.pageIndex || 0));
        var state = this.ifBranchRuntimeStateForTrackKey(trackKey);
        var ifStack = state.ifStack || (state.ifStack = []);
        var choiceStack = state.choiceStack || (state.choiceStack = []);

        var active = true;
        for (var i = 0; i < ifStack.length; i++) {
            var ctx = ifStack[i];
            if (!ctx || indent <= Math.max(0, Math.floor(Number(ctx.indent || 0)))) continue;
            var branchActive = (ctx.phase === 'else') ? !ctx.result : !!ctx.result;
            if (!branchActive) {
                active = false;
                break;
            }
        }
        if (active) {
            for (i = 0; i < choiceStack.length; i++) {
                ctx = choiceStack[i];
                if (!ctx || indent <= Math.max(0, Math.floor(Number(ctx.indent || 0)))) continue;
                if (!this.choiceBranchRuntimeIsActive(ctx)) {
                    active = false;
                    break;
                }
            }
        }
        var shouldLog = active && !this._simToRunning && !this._eeInlineCommandExecution;
        var logFrame = Math.max(0, Math.floor(Number((this._simToRunning ? this._simExecFrame : this.frame) || 0)));

        if (code === 111) {
            if (active) {
                for (i = ifStack.length - 1; i >= 0; i--) {
                    if (Math.max(0, Math.floor(Number(ifStack[i].indent || 0))) >= indent) ifStack.splice(i, 1);
                }
                ifStack.push({
                    indent: indent,
                    result: !!this.resolveIfBranchResultForEntry(entry),
                    phase: 'then'
                });
                ifStack.sort(function(a, b) { return Math.floor(Number(a.indent || 0)) - Math.floor(Number(b.indent || 0)); });
                if (shouldLog) {
                    this.appendExecutionLog(111, logFrame, entry);
                    this.triggerExecutionPulse(Number(entry.uid || 0), -1);
                }
            }
            return false;
        }

        if (code === 411) {
            for (i = ifStack.length - 1; i >= 0; i--) {
                if (Math.max(0, Math.floor(Number(ifStack[i].indent || 0))) !== indent) continue;
                ifStack[i].phase = 'else';
                break;
            }
            return false;
        }

        if (code === 412) {
            for (i = ifStack.length - 1; i >= 0; i--) {
                if (Math.max(0, Math.floor(Number(ifStack[i].indent || 0))) >= indent) ifStack.splice(i, 1);
            }
            if (shouldLog) {
                this.appendExecutionLog(412, logFrame, entry);
                this.triggerExecutionPulse(Number(entry.uid || 0), -1);
            }
            return false;
        }

        if (code === 102) {
            if (active) {
                for (i = choiceStack.length - 1; i >= 0; i--) {
                    if (Math.max(0, Math.floor(Number(choiceStack[i].indent || 0))) >= indent) choiceStack.splice(i, 1);
                }
                choiceStack.push({
                    indent: indent,
                    activeChoiceIndex: Math.floor(Number(this.resolveChoiceBranchResultForEntry(entry) || 0)),
                    phase: 'none',
                    phaseChoiceIndex: -999
                });
                choiceStack.sort(function(a, b) { return Math.floor(Number(a.indent || 0)) - Math.floor(Number(b.indent || 0)); });
                if (shouldLog) {
                    this.appendExecutionLog(102, logFrame, entry);
                    this.triggerExecutionPulse(Number(entry.uid || 0), -1);
                }
            }
            return false;
        }

        if (code === 402) {
            for (i = choiceStack.length - 1; i >= 0; i--) {
                if (Math.max(0, Math.floor(Number(choiceStack[i].indent || 0))) !== indent) continue;
                var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
                choiceStack[i].phase = 'choice';
                choiceStack[i].phaseChoiceIndex = Math.max(0, Math.floor(Number(p[0] || 0)));
                break;
            }
            return false;
        }

        if (code === 403) {
            for (i = choiceStack.length - 1; i >= 0; i--) {
                if (Math.max(0, Math.floor(Number(choiceStack[i].indent || 0))) !== indent) continue;
                choiceStack[i].phase = 'cancel';
                choiceStack[i].phaseChoiceIndex = -1;
                break;
            }
            return false;
        }

        if (code === 404) {
            for (i = choiceStack.length - 1; i >= 0; i--) {
                if (Math.max(0, Math.floor(Number(choiceStack[i].indent || 0))) >= indent) choiceStack.splice(i, 1);
            }
            return false;
        }

        return active;
    };

    EE.prototype.exportIfBranchViewModesForTrack = function(tr) {
        var out = Object.create(null);
        if (!tr) return out;
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var map = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        var blocks = info.blocks || [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var ord = String(Math.floor(Number(b.ordinal || 0)));
            if (!ord.length || ord === '0') continue;
            var uid = String(Math.floor(Number(b.ifUid || 0)));
            var m = this.sanitizeIfBranchViewMode(map[ord] || map[uid]);
            if (m !== 'then') out[ord] = m;
        }
        return out;
    };

    EE.prototype.exportChoiceBranchViewModesForTrack = function(tr) {
        var out = Object.create(null);
        if (!tr) return out;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var map = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);
        var blocks = info.blocks || [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var ord = String(Math.floor(Number(b.ordinal || 0)));
            if (!ord.length || ord === '0') continue;
            var uid = String(Math.floor(Number(b.choiceUid || 0)));
            var m = this.sanitizeChoiceBranchViewMode(map[ord] || map[uid]);
            if (m !== 'auto') out[ord] = m;
        }
        return out;
    };

    EE.prototype.loadIfBranchViewModesForTrack = function(tr) {
        if (!tr) return;
        tr._eeIfBranchViewModes = Object.create(null);
        tr._eeChoiceBranchViewModes = Object.create(null);
        var contextId = (typeof this.timelineViewStorageContextId === 'function') ? this.timelineViewStorageContextId() : 0;
        if (contextId <= 0) return;
        var store = this.readTimelineViewStoreForMap(contextId);
        var key = this.timelineViewStoreKey(tr.eventId, tr.pageIndex);
        var st = (store && typeof store === 'object') ? store[key] : null;
        if (!st || typeof st !== 'object') return;
        tr._eeIfBranchViewModes = this.normalizeIfBranchViewModes(st.ifBranchModes);
        tr._eeChoiceBranchViewModes = this.normalizeChoiceBranchViewModes(st.choiceBranchModes);
    };

    EE.prototype.captureCurrentTimelineViewState = function() {
        if (!this.timelineWrap) return null;
        var px = Number(this.pxPerFrame);
        var sl = Number(this.timelineWrap.scrollLeft || 0);
        var st = Number(this.timelineWrap.scrollTop || 0);
        if (!isFinite(px) || px <= 0) return null;
        if (!isFinite(sl)) sl = 0;
        if (!isFinite(st)) st = 0;
        return {
            pxPerFrame: px,
            scrollLeft: Math.max(0, Math.floor(sl)),
            scrollTop: Math.max(0, Math.floor(st))
        };
    };

    EE.prototype.persistSelectedTimelineViewStateToDisk = function() {
        if (!this.selEid || this.selPage < 0 || !this.selKey) return false;
        var contextId = (typeof this.timelineViewStorageContextId === 'function') ? this.timelineViewStorageContextId() : 0;
        if (contextId <= 0) return false;
        var st = this.captureCurrentTimelineViewState();
        if (!st) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (tr) {
            var ifModes = this.exportIfBranchViewModesForTrack(tr);
            if (Object.keys(ifModes).length) st.ifBranchModes = ifModes;
            var choiceModes = this.exportChoiceBranchViewModesForTrack(tr);
            if (Object.keys(choiceModes).length) st.choiceBranchModes = choiceModes;
        }
        var store = this.readTimelineViewStoreForMap(contextId);
        store[this.timelineViewStoreKey(this.selEid, this.selPage)] = st;
        return this.writeTimelineViewStoreForMap(contextId, store);
    };

    EE.prototype.queueTimelineViewRestoreForTrack = function(eventId, pageIndex) {
        var contextId = (typeof this.timelineViewStorageContextId === 'function') ? this.timelineViewStorageContextId() : 0;
        if (contextId <= 0) {
            this._timelineViewPending = null;
            return;
        }
        var key = this.timelineViewStoreKey(eventId, pageIndex);
        var store = this.readTimelineViewStoreForMap(contextId);
        var st = store && typeof store === 'object' ? store[key] : null;
        if (!st || typeof st !== 'object') {
            this._timelineViewPending = null;
            return;
        }
        this._timelineViewPending = {
            selKey: this.key(eventId, pageIndex),
            pxPerFrame: Number(st.pxPerFrame),
            scrollLeft: Number(st.scrollLeft),
            scrollTop: Number(st.scrollTop)
        };
    };

    EE.prototype.applyPendingTimelineViewRestore = function() {
        var p = this._timelineViewPending;
        if (!p || !this.timelineWrap) return;
        if (String(p.selKey || '') !== String(this.selKey || '')) return;
        var wrap = this.timelineWrap;
        var maxLeft = Math.max(0, Math.floor(Number(wrap.scrollWidth || 0) - Number(wrap.clientWidth || 0)));
        var maxTop = Math.max(0, Math.floor(Number(wrap.scrollHeight || 0) - Number(wrap.clientHeight || 0)));
        var left = isFinite(Number(p.scrollLeft)) ? Math.floor(Number(p.scrollLeft || 0)) : 0;
        var top = isFinite(Number(p.scrollTop)) ? Math.floor(Number(p.scrollTop || 0)) : 0;
        wrap.scrollLeft = Math.max(0, Math.min(maxLeft, left));
        wrap.scrollTop = Math.max(0, Math.min(maxTop, top));
        this._timelineViewPending = null;
        this.timelineDirty = true;
    };

    EE.prototype.syncTimelineSize = function(maxF) {
        if (!this.timeline || !this.timelineWrap) return;
        var p = this._timelineViewPending;
        if (p && String(p.selKey || '') === String(this.selKey || '')) {
            var ppf = Number(p.pxPerFrame);
            if (isFinite(ppf) && ppf > 0) {
                this.pxPerFrame = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, ppf));
            }
        }
        var tr = this.model.tracks[this.selKey];
        var rows = this.getTrackRows(tr);
        this._rows = rows;
        this._mainStackMax = this.mainStackMax(tr);
        this._rowMetrics = this.buildRowMetrics(rows, this._mainStackMax);
        if (!isFinite(Number(maxF)) || Number(maxF) <= 0) maxF = this.maxFrame();
        else maxF = Math.max(1, Math.floor(Number(maxF)));
        // Canvas width has a hard implementation limit (NW.js/Chromium).
        // If we exceed it, drawing can disappear while hit-tests still work.
        var canvasMaxW = 16384;
        var reserveW = this.labelW + 160;
        var maxTrackW = Math.max(64, canvasMaxW - reserveW);
        if (maxF > 0) {
            var fitPx = maxTrackW / maxF;
            if (fitPx > 0 && this.pxPerFrame > fitPx) {
                // Allow auto-fit below user zoom minimum to preserve visibility.
                this.pxPerFrame = Math.max(1 / 4096, fitPx);
            }
        }
        var vw = Math.max(1, Math.floor(this.timelineWrap.clientWidth || 1));
        var bodyH = 0;
        for (var i = 0; i < this._rowMetrics.length; i++) bodyH += this._rowMetrics[i].height;
        var ch = Math.max(120, this.rulerH + bodyH + 10);
        var cw = Math.max(vw - 2, Math.ceil(this.labelW + maxF * this.pxPerFrame + 160));
        if (cw > canvasMaxW) cw = canvasMaxW;
        this.tw = cw;
        this.th = ch;
        this.timeline.width = this.tw;
        this.timeline.height = this.th;
        this.timeline.style.width = this.tw + 'px';
        this.timeline.style.height = this.th + 'px';
        if (this.zoomInfo) {
            this.zoomInfo.textContent = 'scale: ' + this.pxPerFrame.toFixed(3) + ' px/frame (ruler wheel: ' +
                this.minPxPerFrame.toFixed(3) + ' .. ' + this.maxPxPerFrame.toFixed(3) + ')';
        }
        this.applyPendingTimelineViewRestore();
    };

    EE.prototype.mainVisibleStackCountAtFrame = function(tr, frame, hiddenByIf) {
        if (!tr || !tr.commands) return 0;
        hiddenByIf = hiddenByIf || this.computeIfBranchHiddenUidMapForTrack(tr);
        var targetFrame = Math.max(0, Math.floor(Number(frame || 0)));
        var count = 0;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (hiddenByIf[String(Math.floor(Number(e.uid || 0)))]) continue;
            if (e.isComment || (e.command && Number(e.command.code || 0) === 108)) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f !== targetFrame) continue;
            count++;
        }
        return Math.max(0, Math.floor(Number(count || 0)));
    };

    EE.prototype.mainStackMax = function(tr) {
        if (!tr || !tr.commands) return 1;
        var hiddenByIf = this.computeIfBranchHiddenUidMapForTrack(tr);
        var c = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (hiddenByIf[String(Math.floor(Number(e.uid || 0)))]) continue;
            if (e.isComment || (e.command && Number(e.command.code || 0) === 108)) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            c[f] = (c[f] || 0) + 1;
        }
        var m = 1, ks = Object.keys(c);
        for (var j = 0; j < ks.length; j++) m = Math.max(m, Number(c[ks[j]] || 0));
        var endFrame = this.normalizeTrackEndFrame(tr);
        var endTailStack = this.mainVisibleStackCountAtFrame(tr, endFrame, hiddenByIf) + 1;
        m = Math.max(m, endTailStack);
        return Math.max(1, m);
    };

    EE.prototype.mainRowHeight = function(maxStack) {
        maxStack = Math.max(1, Number(maxStack || 1));
        var h = this.mainLaneTop + this.mainLaneBottom + (maxStack - 1) * this.mainLaneGap;
        return Math.max(this.rowH, h);
    };

    EE.prototype.buildRowMetrics = function(rows, maxMainStack) {
        rows = rows || [];
        var out = [];
        var y = this.rulerH;
        for (var i = 0; i < rows.length; i++) {
            var h = (rows[i].key === 'main') ? this.mainRowHeight(maxMainStack) : this.rowH;
            out.push({ top: y, height: h, center: y + Math.floor(h / 2), key: rows[i].key });
            y += h;
        }
        return out;
    };

    EE.prototype.maxFrame = function() {
        var m = 300;
        var tr = this.model.tracks[this.selKey];
        if (tr) {
            var endFrame = this.normalizeTrackEndFrame(tr);
            m = Math.max(m, endFrame + this.timelineEndPaddingFrames());
        }
        var curFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (tr) curFrame = Math.min(curFrame, this.normalizeTrackEndFrame(tr));
        var need = Math.max(300, curFrame + this.timelineEndPaddingFrames());
        if (need > m) m = Math.ceil(need / 120) * 120;
        this.maxF = m;
        return m;
    };

    EE.prototype.frameToX = function(f) {
        return this.labelW + Math.round(Math.max(0, Number(f || 0)) * this.pxPerFrame);
    };

    EE.prototype.xToFrame = function(x) {
        var px = Math.max(1 / 4096, Number(this.pxPerFrame || this.minPxPerFrame || 1));
        return Math.max(0, Math.floor((x - this.labelW) / px));
    };

    EE.prototype.visibleTimelinePixelRange = function(totalWidth) {
        totalWidth = Math.max(1, Math.floor(Number(totalWidth || this.tw || 1)));
        if (!this.timelineWrap) return { left: 0, right: totalWidth };
        var left = Math.max(0, Math.floor(Number(this.timelineWrap.scrollLeft || 0)));
        var right = Math.max(left + 1, Math.floor(left + Number(this.timelineWrap.clientWidth || 1)));
        return {
            left: Math.max(0, Math.min(totalWidth, left)),
            right: Math.max(1, Math.min(totalWidth, right))
        };
    };

    EE.prototype.visibleTimelineFrameRange = function(maxF, padFrames, totalWidth) {
        maxF = Math.max(0, Math.floor(Number(maxF || 0)));
        padFrames = Math.max(0, Math.floor(Number(padFrames || 0)));
        var px = this.visibleTimelinePixelRange(totalWidth);
        var start = Math.max(0, this.xToFrame(px.left) - padFrames);
        var end = Math.min(maxF, this.xToFrame(px.right) + padFrames);
        if (end < start) end = start;
        return { start: start, end: end };
    };

    EE.prototype.frameFromTimeline = function(e) {
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left;
        return this.xToFrame(x);
    };

    EE.prototype.timelineRulerTopY = function(totalHeight) {
        var h = Math.max(1, Math.floor(Number(totalHeight == null ? this.th : totalHeight) || 1));
        var y = 0;
        if (this.timelineWrap) y = Math.max(0, Math.floor(Number(this.timelineWrap.scrollTop || 0)));
        return Math.max(0, Math.min(h - this.rulerH, y));
    };

    EE.prototype.isTimelineRulerY = function(y, totalHeight) {
        y = Number(y || 0);
        var top = this.timelineRulerTopY(totalHeight);
        return y >= top && y <= (top + this.rulerH);
    };

    EE.prototype.isTimelineRulerPoint = function(x, y, includeLabel, totalHeight) {
        if (!this.isTimelineRulerY(y, totalHeight)) return false;
        if (includeLabel) return true;
        x = Number(x || 0);
        return x >= Number(this.labelW || 0);
    };

    EE.prototype.rowFromY = function(y) {
        if (!this._rows || !this._rows.length) return null;
        if (this.isTimelineRulerY(y)) return null;
        var ms = this._rowMetrics || [];
        for (var i = 0; i < ms.length; i++) {
            if (y >= ms[i].top && y < ms[i].top + ms[i].height) return this._rows[i];
        }
        return null;
    };

    EE.prototype.hitTestNode = function(x, y) {
        for (var i = this.hitNodes.length - 1; i >= 0; i--) {
            var n = this.hitNodes[i];
            if (this.timelineCircleHitPoint(x, y, n.x, n.y, this.scaleTimelineCircleRadius(Number(n.r || 0)) + 4)) return n;
        }
        return null;
    };

    EE.prototype.hitTestComment = function(x, y) {
        for (var i = this.hitComments.length - 1; i >= 0; i--) {
            var n = this.hitComments[i];
            if (this.timelineCircleHitPoint(x, y, n.x, n.y, this.scaleTimelineCircleRadius(Math.max(3, Number(n.r || 3))) + 4)) return n;
        }
        return null;
    };

    EE.prototype.hitTestBar = function(x, y) {
        if (!this.hitBars) return null;
        for (var i = this.hitBars.length - 1; i >= 0; i--) {
            var b = this.hitBars[i];
            if (x >= b.x1 - 3 && x <= b.x2 + 3 && Math.abs(y - b.y) <= 6) return b;
        }
        return null;
    };

    EE.prototype.hitTestOrderButton = function(x, y) {
        if (!Array.isArray(this.hitOrderButtons)) return null;
        x = Number(x || 0);
        y = Number(y || 0);
        for (var i = this.hitOrderButtons.length - 1; i >= 0; i--) {
            var b = this.hitOrderButtons[i];
            if (!b) continue;
            if (x < Number(b.x1 || 0) || x > Number(b.x2 || 0)) continue;
            if (y < Number(b.y1 || 0) || y > Number(b.y2 || 0)) continue;
            return b;
        }
        return null;
    };

    EE.prototype.hitTestIfBranchModeButton = function(x, y) {
        if (!Array.isArray(this.hitIfBranchButtons)) return null;
        x = Number(x || 0);
        y = Number(y || 0);
        for (var i = this.hitIfBranchButtons.length - 1; i >= 0; i--) {
            var b = this.hitIfBranchButtons[i];
            if (!b) continue;
            if (x < Number(b.x1 || 0) || x > Number(b.x2 || 0)) continue;
            if (y < Number(b.y1 || 0) || y > Number(b.y2 || 0)) continue;
            return b;
        }
        return null;
    };

    EE.prototype.hitTestRouteCommandNodeNear = function(uid, x, y, extraRadius) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0 || !Array.isArray(this.hitNodes)) return null;
        var px = Number(x || 0);
        var py = Number(y || 0);
        var best = null;
        var bestDist2 = Infinity;
        var ex = Math.max(0, Number(extraRadius == null ? 5 : extraRadius));
        for (var i = this.hitNodes.length - 1; i >= 0; i--) {
            var n = this.hitNodes[i];
            if (!n) continue;
            if (Math.floor(Number(n.uid || 0)) !== uid) continue;
            var rli = this.nodeRouteIndex(n.routeListIndex);
            if (rli < 0) continue;
            var rr = this.timelineCircleHitRadiusScaled(this.scaleTimelineCircleRadius(Math.max(1, Number(n.r || 5))) + 4 + ex);
            var d2 = this.timelineCircleHitDistance2(px, py, n.x, n.y);
            if (d2 > rr * rr) continue;
            if (d2 < bestDist2) {
                best = n;
                bestDist2 = d2;
            }
        }
        return best;
    };

    EE.prototype.timelineCircleHitRadiusScaled = function(radius) {
        var base = Math.max(1, Number(radius || 0));
        // Reduce all circle hover/hit areas by 20%.
        return Math.max(1, base * 0.8);
    };

    EE.prototype.timelineCircleHitPoint = function(px, py, cx, cy, radius) {
        var rr = this.timelineCircleHitRadiusScaled(Math.max(0, Number(radius || 0)));
        var d2 = this.timelineCircleHitDistance2(px, py, cx, cy);
        return d2 <= (rr * rr);
    };

    EE.prototype.timelineCircleHitDistance2 = function(px, py, cx, cy) {
        var dx = Number(px || 0) - Number(cx || 0);
        var dy = Number(py || 0) - Number(cy || 0);
        return dx * dx + dy * dy;
    };

    EE.prototype.nodeRouteIndex = function(routeListIndex) {
        return (routeListIndex == null) ? -1 : Number(routeListIndex);
    };

    EE.prototype.isNodeHovered = function(uid, routeListIndex) {
        if (!this.hoverUid) return false;
        if (Number(uid || 0) !== Number(this.hoverUid || 0)) return false;
        return this.nodeRouteIndex(routeListIndex) === this.nodeRouteIndex(this.hoverRouteListIndex);
    };

    EE.prototype.setHoverNode = function(node) {
        var uid = node ? Number(node.uid || 0) : 0;
        var routeListIndex = node ? this.nodeRouteIndex(node.routeListIndex) : -1;
        var changed = (uid !== Number(this.hoverUid || 0)) || (routeListIndex !== this.nodeRouteIndex(this.hoverRouteListIndex));
        this.hoverUid = uid;
        this.hoverRouteListIndex = routeListIndex;
        if (changed) this.timelineDirty = true;
    };

    EE.prototype.rangeSelectionItemKey = function(item) {
        if (!item) return '';
        if (String(item.kind || '') === 'routeCmd') {
            var rli = (item.routeListIndex == null) ? -1 : Number(item.routeListIndex);
            return 'r:' + Math.floor(Number(item.uid || 0)) + ':' + Math.floor(rli);
        }
        return 'e:' + Math.floor(Number(item.uid || 0));
    };

    EE.prototype.normalizeRangeSelectionItems = function(items) {
        var out = [];
        var map = Object.create(null);
        items = Array.isArray(items) ? items : [];
        for (var i = 0; i < items.length; i++) {
            var src = items[i];
            if (!src) continue;
            var kind = (String(src.kind || '') === 'routeCmd') ? 'routeCmd' : 'entry';
            var uid = Math.floor(Number(src.uid || 0));
            if (uid <= 0) continue;
            var it = { kind: kind, uid: uid };
            if (kind === 'routeCmd') it.routeListIndex = this.nodeRouteIndex(src.routeListIndex);
            var key = this.rangeSelectionItemKey(it);
            if (!key || map[key]) continue;
            map[key] = true;
            out.push(it);
        }
        return out;
    };

    EE.prototype.setRangeSelection = function(kind, items, opt) {
        opt = opt || {};
        kind = String(kind || 'none');
        if (kind !== 'memory' && kind !== 'rect') kind = 'none';
        var normalized = (kind === 'none') ? [] : this.normalizeRangeSelectionItems(items);
        var keepEmpty = !!opt.keepEmpty;
        var map = Object.create(null);
        for (var i = 0; i < normalized.length; i++) map[this.rangeSelectionItemKey(normalized[i])] = true;
        if (!this.rangeSelection || typeof this.rangeSelection !== 'object') this.rangeSelection = {};
        this.rangeSelection.kind = (kind !== 'none' && (normalized.length || keepEmpty)) ? kind : 'none';
        this.rangeSelection.items = normalized;
        this.rangeSelection.itemMap = map;
        this.rangeSelection.frameStart = Math.max(0, Math.floor(Number(opt.frameStart == null ? 0 : opt.frameStart)));
        this.rangeSelection.frameEnd = Math.max(this.rangeSelection.frameStart, Math.floor(Number(opt.frameEnd == null ? this.rangeSelection.frameStart : opt.frameEnd)));
        this.rangeSelection.rects = Array.isArray(opt.rects) ? opt.rects.slice(0) : [];
        this.rangeSelection.nonContiguous = !!opt.nonContiguous;
        if (!normalized.length) {
            this.selUid = 0;
            this.selRouteListIndex = -1;
        }
        this.timelineDirty = true;
    };

    EE.prototype.clearRangeSelection = function() {
        this.setRangeSelection('none', [], { frameStart: 0, frameEnd: 0, rects: [], nonContiguous: false });
    };

    EE.prototype.hasRangeSelection = function() {
        var rs = this.rangeSelection || {};
        var kind = String(rs.kind || 'none');
        if (kind === 'none') return false;
        if (Array.isArray(rs.items) && rs.items.length > 0) return true;
        if (kind === 'memory') return Number(rs.frameEnd || 0) >= Number(rs.frameStart || 0);
        return false;
    };

    EE.prototype.isEntryInRangeSelection = function(uid) {
        var rs = this.rangeSelection || {};
        if (!rs.itemMap) return false;
        return !!rs.itemMap['e:' + Math.floor(Number(uid || 0))];
    };

    EE.prototype.isRouteCmdInRangeSelection = function(uid, routeListIndex) {
        var rs = this.rangeSelection || {};
        if (!rs.itemMap) return false;
        return !!rs.itemMap['r:' + Math.floor(Number(uid || 0)) + ':' + this.nodeRouteIndex(routeListIndex)];
    };

    EE.prototype.selectedEntryUidsFromRange = function() {
        var rs = this.rangeSelection || {};
        var items = Array.isArray(rs.items) ? rs.items : [];
        var out = [];
        var seen = Object.create(null);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || String(it.kind || '') !== 'entry') continue;
            var uid = Math.floor(Number(it.uid || 0));
            if (uid <= 0 || seen[uid]) continue;
            seen[uid] = true;
            out.push(uid);
        }
        return out;
    };

    EE.prototype.selectedRouteCmdItemsFromRange = function() {
        var rs = this.rangeSelection || {};
        var items = Array.isArray(rs.items) ? rs.items : [];
        var out = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || String(it.kind || '') !== 'routeCmd') continue;
            out.push({ kind: 'routeCmd', uid: Math.floor(Number(it.uid || 0)), routeListIndex: this.nodeRouteIndex(it.routeListIndex) });
        }
        return this.normalizeRangeSelectionItems(out);
    };

    EE.prototype.rangeSelectionFrameRectFromFrames = function(a, b) {
        a = Math.max(0, Math.floor(Number(a || 0)));
        b = Math.max(a, Math.floor(Number(b || a)));
        return {
            x1: this.frameToX(a),
            x2: this.frameToX(b + 1),
            y1: 0,
            y2: this.rulerH
        };
    };

    EE.prototype.normalizeCanvasRect = function(x1, y1, x2, y2) {
        var ax = Math.min(Number(x1 || 0), Number(x2 || 0));
        var bx = Math.max(Number(x1 || 0), Number(x2 || 0));
        var ay = Math.min(Number(y1 || 0), Number(y2 || 0));
        var by = Math.max(Number(y1 || 0), Number(y2 || 0));
        return { x1: ax, y1: ay, x2: bx, y2: by };
    };

    EE.prototype.canvasRectFrameRange = function(rect) {
        rect = rect || {};
        var a = this.xToFrame(Number(rect.x1 || 0));
        var b = this.xToFrame(Number(rect.x2 || 0));
        if (a > b) { var t = a; a = b; b = t; }
        return { start: a, end: b };
    };

    EE.prototype.collectMemoryRangeSelectionItems = function(startFrame, endFrame) {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return [];
        var a = Math.max(0, Math.floor(Number(startFrame || 0)));
        var b = Math.max(a, Math.floor(Number(endFrame == null ? a : endFrame)));
        var out = [];
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) <= 0) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (Number(e.command.code || 0) === 205) {
                var ed = s + Math.max(1, Math.floor(Number(e.wait || 1)));
                if (ed < a || s > b) continue;
                out.push({ kind: 'entry', uid: e.uid });
                continue;
            }
            if (s < a || s > b) continue;
            out.push({ kind: 'entry', uid: e.uid });
        }
        return this.normalizeRangeSelectionItems(out);
    };

    EE.prototype.collectRectSelectionItems = function(rect) {
        rect = rect || {};
        var x1 = Math.min(Number(rect.x1 || 0), Number(rect.x2 || 0));
        var x2 = Math.max(Number(rect.x1 || 0), Number(rect.x2 || 0));
        var y1 = Math.min(Number(rect.y1 || 0), Number(rect.y2 || 0));
        var y2 = Math.max(Number(rect.y1 || 0), Number(rect.y2 || 0));
        var routeCmdCand = [];
        var entryCand = [];
        for (var i = 0; i < this.hitNodes.length; i++) {
            var n = this.hitNodes[i];
            if (!n) continue;
            var nr = Math.max(1, Number(n.r || 5)) + 2;
            var nx1 = Number(n.x || 0) - nr;
            var nx2 = Number(n.x || 0) + nr;
            var ny1 = Number(n.y || 0) - nr;
            var ny2 = Number(n.y || 0) + nr;
            if (nx2 < x1 || nx1 > x2 || ny2 < y1 || ny1 > y2) continue;
            if (n.routeListIndex != null && Number(n.routeListIndex) >= 0) {
                routeCmdCand.push({ kind: 'routeCmd', uid: Number(n.uid || 0), routeListIndex: Number(n.routeListIndex) });
            } else {
                var ee = this.findEntryInSelectedTrack(Number(n.uid || 0));
                if (ee && ee.isComment) continue;
                entryCand.push({ kind: 'entry', uid: Number(n.uid || 0) });
            }
        }
        for (i = 0; i < this.hitBars.length; i++) {
            var b = this.hitBars[i];
            if (!b || !b.routeRangeUid || String(b.routeRangePart || '') !== 'body') continue;
            var bx1 = Math.min(Number(b.x1 || 0), Number(b.x2 || 0));
            var bx2 = Math.max(Number(b.x1 || 0), Number(b.x2 || 0));
            var by1 = Number(b.y || 0) - 6;
            var by2 = Number(b.y || 0) + 6;
            if (bx2 < x1 || bx1 > x2 || by2 < y1 || by1 > y2) continue;
            entryCand.push({ kind: 'entry', uid: Number(b.routeRangeUid || 0) });
        }
        routeCmdCand = this.normalizeRangeSelectionItems(routeCmdCand);
        entryCand = this.normalizeRangeSelectionItems(entryCand);

        if (routeCmdCand.length) {
            var uid0 = Number(routeCmdCand[0].uid || 0);
            var sameRoute = true;
            for (i = 0; i < routeCmdCand.length; i++) {
                if (Number(routeCmdCand[i].uid || 0) !== uid0) { sameRoute = false; break; }
            }
            if (sameRoute) {
                for (i = 0; i < entryCand.length; i++) {
                    if (Number(entryCand[i].uid || 0) !== uid0) { sameRoute = false; break; }
                }
            }
            if (sameRoute) {
                var re = this.findRouteRangeEntryByUid(uid0);
                if (re) {
                    var rsx = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))));
                    var rex = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))) + Math.max(1, Math.floor(Number(re.wait || 1))));
                    // Include handle extents in horizontal in-range test.
                    // Left handle extends about 9px from body start, right handle about 7px.
                    var rx1 = Math.min(rsx, rex) - 9;
                    var rx2 = Math.max(rsx, rex) + 7;
                    var routeXMargin = 8;
                    var withinRouteX = (x1 >= rx1 - routeXMargin && x2 <= rx2 + routeXMargin);
                    if (withinRouteX) return routeCmdCand;
                    return this.normalizeRangeSelectionItems([{ kind: 'entry', uid: uid0 }]);
                }
            }
            for (i = 0; i < routeCmdCand.length; i++) entryCand.push({ kind: 'entry', uid: Number(routeCmdCand[i].uid || 0) });
        }
        return this.normalizeRangeSelectionItems(entryCand);
    };

    EE.prototype.routeBlocksFromList = function(routeList) {
        var list = Array.isArray(routeList) ? routeList : [];
        var blocks = [];
        var t = 0;
        for (var i = 0; i < list.length; i++) {
            var cmd = list[i];
            var code = Number((cmd && cmd.code) || 0);
            if (code === 0) break;
            if (code === 15) {
                var wf = Math.max(1, Math.floor(Number(((cmd && cmd.parameters) || [0])[0] || 0)));
                t += wf;
                continue;
            }
            var dur = 1;
            var j = i + 1;
            while (j < list.length) {
                var wcmd = list[j];
                var wcode = Number((wcmd && wcmd.code) || 0);
                if (wcode !== 15) break;
                dur += Math.max(1, Math.floor(Number(((wcmd && wcmd.parameters) || [0])[0] || 0)));
                j++;
            }
            blocks.push({
                start: t,
                dur: dur,
                listIndex: i,
                command: clone(cmd)
            });
            t += dur;
            i = j - 1;
        }
        return { blocks: blocks, total: t };
    };

    EE.prototype.routeListFromBlocks = function(blocks) {
        var out = [];
        var cur = 0;
        blocks = Array.isArray(blocks) ? blocks : [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.max(0, Math.floor(Number(b.start || 0)));
            var dur = Math.max(1, Math.floor(Number(b.dur || 1)));
            if (st > cur) out.push({ code: 15, parameters: [st - cur] });
            out.push(clone(b.command || { code: 0, parameters: [] }));
            if (dur > 1) out.push({ code: 15, parameters: [dur - 1] });
            cur = st + dur;
        }
        out.push({ code: 0, parameters: [] });
        return out;
    };

    EE.prototype.batchCanPlaceEntries = function(tr, movedEntries) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        movedEntries = Array.isArray(movedEntries) ? movedEntries : [];
        var removeMap = Object.create(null);
        for (var i = 0; i < movedEntries.length; i++) {
            var m = movedEntries[i];
            if (!m || !m.entry) continue;
            removeMap[Math.floor(Number(m.entry.uid || 0))] = true;
        }
        var temp = {
            commands: tr.commands.filter(function(e) {
                return !removeMap[Math.floor(Number((e && e.uid) || 0))];
            }).map(function(e) { return clone(e); })
        };
        var sorted = movedEntries.slice(0).sort(function(a, b) {
            var af = Math.floor(Number((a && a.frame) || 0));
            var bf = Math.floor(Number((b && b.frame) || 0));
            if (af !== bf) return af - bf;
            return Math.floor(Number((a && a.entry && a.entry.uid) || 0)) - Math.floor(Number((b && b.entry && b.entry.uid) || 0));
        });
        for (i = 0; i < sorted.length; i++) {
            var it = sorted[i];
            if (!it || !it.entry) continue;
            var e = clone(it.entry);
            e.frame = Math.max(0, Math.floor(Number(it.frame || 0)));
            e.rowKey = String(it.rowKey || e.rowKey || 'main');
            if (e.rowKey.indexOf('char:') === 0) {
                var cid = this.normalizeMoveTarget(Number(e.rowKey.replace('char:', '')));
                e.rowType = 'char';
                e.charId = cid;
                if (e.command && Number(e.command.code || 0) === 205) {
                    if (!Array.isArray(e.command.parameters)) e.command.parameters = [cid, this.defaultMoveRoute()];
                    e.command.parameters[0] = cid;
                }
            } else {
                e.rowType = 'main';
                e.charId = null;
            }
            if (!this.canPlaceEntry(temp, e, e.frame, e.rowKey, e.uid)) return false;
            // Include already-validated moved entries so collisions between moved
            // commands are also rejected (e.g. wait:false move-routes overlap).
            temp.commands.push(clone(e));
        }
        return true;
    };

    EE.prototype.routeBlocksAfterRemovingSelection = function(blocks, selectedMap) {
        blocks = Array.isArray(blocks) ? blocks : [];
        selectedMap = selectedMap || Object.create(null);
        var out = [];
        var removedBefore = 0;
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var key = Math.floor(Number(b.listIndex == null ? -1 : b.listIndex));
            if (selectedMap[key]) {
                removedBefore += Math.max(1, Math.floor(Number(b.dur || 1)));
                continue;
            }
            out.push({
                start: Math.max(0, Math.floor(Number(b.start || 0))) - removedBefore,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Number(b.listIndex || 0),
                command: clone(b.command || { code: 0, parameters: [] })
            });
        }
        return out;
    };

    EE.prototype.deleteRangeSelection = function() {
        if (!this.hasRangeSelection()) return;
        if (!this.selKey) return;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return;
        var entryUids = this.selectedEntryUidsFromRange();
        var routeItems = this.selectedRouteCmdItemsFromRange();
        var routeByUid = Object.create(null);
        for (var i = 0; i < routeItems.length; i++) {
            var ri = routeItems[i];
            if (!ri || !ri.uid || ri.routeListIndex < 0) continue;
            if (!routeByUid[ri.uid]) routeByUid[ri.uid] = Object.create(null);
            routeByUid[ri.uid][Math.floor(Number(ri.routeListIndex == null ? -1 : ri.routeListIndex))] = true;
        }
        if (!entryUids.length && !routeItems.length) return;

        this.pushSnap('delRange');
        var entryMap = Object.create(null);
        for (i = 0; i < entryUids.length; i++) entryMap[Math.floor(Number(entryUids[i] || 0))] = true;

        for (i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 205) continue;
            var uid = Math.floor(Number(e.uid || 0));
            if (!routeByUid[uid]) continue;
            if (entryMap[uid]) continue; // entry delete has priority
            var route = e.command.parameters && e.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : null;
            if (!list) continue;
            var parsed = this.routeBlocksFromList(list);
            var blocks = parsed.blocks || [];
            if (!blocks.length) continue;
            var nextBlocks = this.routeBlocksAfterRemovingSelection(blocks, routeByUid[uid]);
            route.list = this.routeListFromBlocks(nextBlocks);
            e.wait = this.commandWaitFrames(e.command);
        }

        if (entryUids.length) {
            tr.commands = tr.commands.filter(function(e2) {
                return !entryMap[Math.floor(Number((e2 && e2.uid) || 0))];
            });
        }

        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.clearRangeSelection();
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
    };

    EE.prototype.rangeSelectionHitAtPoint = function(x, y) {
        x = Number(x || 0);
        y = Number(y || 0);
        var hn = this.hitTestNode(x, y);
        if (hn) {
            var hri = this.nodeRouteIndex(hn.routeListIndex);
            if (hri >= 0 && this.isRouteCmdInRangeSelection(hn.uid, hri)) {
                return { kind: 'routeCmd', uid: Number(hn.uid || 0), routeListIndex: hri, node: hn };
            }
            if (this.isEntryInRangeSelection(hn.uid)) {
                return { kind: 'entry', uid: Number(hn.uid || 0), node: hn };
            }
        }
        var hb = this.hitTestBar(x, y);
        if (hb && hb.routeRangeUid && this.isEntryInRangeSelection(hb.routeRangeUid)) {
            return { kind: 'entry', uid: Number(hb.routeRangeUid || 0), bar: hb };
        }
        if (hb && hb.uid && this.isEntryInRangeSelection(hb.uid)) {
            return { kind: 'entry', uid: Number(hb.uid || 0), bar: hb };
        }
        return null;
    };

    EE.prototype.isPointInsideCurrentRangeSelection = function(x, y) {
        if (!this.hasRangeSelection()) return false;
        var hit = this.rangeSelectionHitAtPoint(x, y);
        if (hit) return true;
        var rs = this.rangeSelection || {};
        var rects = Array.isArray(rs.rects) ? rs.rects : [];
        for (var i = 0; i < rects.length; i++) {
            var rc = rects[i];
            if (!rc) continue;
            if (x >= Number(rc.x1 || 0) && x <= Number(rc.x2 || 0) && y >= Number(rc.y1 || 0) && y <= Number(rc.y2 || 0)) return true;
        }
        return false;
    };

    EE.prototype.rowIndexByKey = function(rowKey) {
        var rows = this._rows || [];
        for (var i = 0; i < rows.length; i++) if (String(rows[i].key || '') === String(rowKey || '')) return i;
        return -1;
    };

    EE.prototype.beginRangeSelectionDrag = function(mode, x, y, e) {
        mode = String(mode || '');
        if (mode !== 'memory' && mode !== 'rect') return false;
        var add = false, sub = false;
        if (mode === 'rect') {
            add = !!(e && e.shiftKey);
            sub = !!(e && e.ctrlKey);
            if (add && sub) sub = false;
        }
        this.rangeSelectDrag = {
            mode: mode,
            startX: Number(x || 0),
            startY: Number(y || 0),
            currentX: Number(x || 0),
            currentY: Number(y || 0),
            moved: false,
            additive: add,
            subtractive: sub
        };
        this.rangeMoveDrag = null;
        this.dragState = null;
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.updateRangeSelectionDrag = function(x, y) {
        var rsd = this.rangeSelectDrag;
        if (!rsd) return false;
        rsd.currentX = Number(x || 0);
        rsd.currentY = Number(y || 0);
        var dx = Math.abs(rsd.currentX - rsd.startX);
        var dy = Math.abs(rsd.currentY - rsd.startY);
        rsd.moved = (dx > 2 || dy > 2);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.rangeSelectDragFrameInfo = function(rsd) {
        if (!rsd) return null;
        var mode = String(rsd.mode || '');
        var rect;
        if (mode === 'memory') rect = this.normalizeCanvasRect(rsd.startX, 0, rsd.currentX, this.th);
        else rect = this.normalizeCanvasRect(rsd.startX, rsd.startY, rsd.currentX, rsd.currentY);
        var fr = this.canvasRectFrameRange(rect);
        var start = Math.max(0, Math.floor(Number(fr.start || 0)));
        var end = Math.max(start, Math.floor(Number(fr.end == null ? start : fr.end)));
        return {
            rect: rect,
            frameStart: start,
            frameEnd: end,
            frameCount: Math.max(1, end - start + 1)
        };
    };

    EE.prototype.finalizeRangeSelectionDrag = function() {
        var rsd = this.rangeSelectDrag;
        this.rangeSelectDrag = null;
        if (!rsd) return false;
        var mode = String(rsd.mode || '');
        if (mode === 'memory' && !rsd.moved) {
            if (this.hasRangeSelection()) this.clearRangeSelection();
            var targetFrame = this.xToFrame(Number(rsd.currentX == null ? rsd.startX : rsd.currentX));
            this.seek(Math.max(0, Math.floor(Number(targetFrame || 0))));
            this.timelineDirty = true;
            return true;
        }
        var rect;
        var items = [];
        var frameRange = { start: 0, end: 0 };
        if (mode === 'memory') {
            var mRect = this.normalizeCanvasRect(rsd.startX, 0, rsd.currentX, this.th);
            frameRange = this.canvasRectFrameRange(mRect);
            items = this.collectMemoryRangeSelectionItems(frameRange.start, frameRange.end);
            rect = this.rangeSelectionFrameRectFromFrames(frameRange.start, frameRange.end);
            rect.y1 = 0;
            rect.y2 = this.th;
            this.setRangeSelection('memory', items, {
                frameStart: frameRange.start,
                frameEnd: frameRange.end,
                rects: [rect],
                nonContiguous: false,
                keepEmpty: true
            });
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.timelineDirty = true;
            return true;
        }
        rect = this.normalizeCanvasRect(rsd.startX, rsd.startY, rsd.currentX, rsd.currentY);
        frameRange = this.canvasRectFrameRange(rect);
        items = this.collectRectSelectionItems(rect);
        if (!rsd.additive && !rsd.subtractive) {
            this.setRangeSelection('rect', items, {
                frameStart: frameRange.start,
                frameEnd: frameRange.end,
                rects: [rect],
                nonContiguous: false
            });
        } else {
            var cur = this.rangeSelection || {};
            var curItems = Array.isArray(cur.items) ? cur.items.slice(0) : [];
            var curRects = Array.isArray(cur.rects) ? cur.rects.slice(0) : [];
            var map = Object.create(null);
            var out = [];
            var i, key, it;
            for (i = 0; i < curItems.length; i++) {
                it = curItems[i];
                key = this.rangeSelectionItemKey(it);
                if (!key || map[key]) continue;
                map[key] = true;
                out.push(clone(it));
            }
            if (rsd.subtractive) {
                var remMap = Object.create(null);
                for (i = 0; i < items.length; i++) remMap[this.rangeSelectionItemKey(items[i])] = true;
                out = out.filter(function(v) { return !remMap[this.rangeSelectionItemKey(v)]; }, this);
            } else {
                for (i = 0; i < items.length; i++) {
                    it = items[i];
                    key = this.rangeSelectionItemKey(it);
                    if (!key || map[key]) continue;
                    map[key] = true;
                    out.push(clone(it));
                }
            }
            curRects.push(rect);
            var fs = Math.max(0, Math.floor(Number(cur.frameStart == null ? frameRange.start : cur.frameStart)));
            var fe = Math.max(fs, Math.floor(Number(cur.frameEnd == null ? frameRange.end : cur.frameEnd)));
            fs = Math.min(fs, frameRange.start);
            fe = Math.max(fe, frameRange.end);
            this.setRangeSelection('rect', out, {
                frameStart: fs,
                frameEnd: fe,
                rects: curRects,
                nonContiguous: true
            });
        }
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.beginRangeMoveDrag = function(x, y, hit) {
        if (!this.hasRangeSelection()) return false;
        hit = hit || this.rangeSelectionHitAtPoint(x, y);
        if (!hit) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var rs = this.rangeSelection || {};
        var mode = String(rs.kind || '');
        var drag = {
            kind: String(hit.kind || 'entry'),
            startX: Number(x || 0),
            startY: Number(y || 0),
            moved: false,
            valid: false,
            invalidReason: '',
            frameDelta: 0,
            rowShift: 0,
            mode: mode,
            hitUid: Number(hit.uid || 0),
            hitRouteListIndex: this.nodeRouteIndex(hit.routeListIndex),
            previewEntries: [],
            previewRouteBlocks: null,
            previewRouteDisplayOffsets: [],
            previewRouteUid: 0,
            previewRouteSelection: [],
            allowVertical: false
        };
        if (drag.kind === 'routeCmd') {
            var routeItems = this.selectedRouteCmdItemsFromRange();
            if (!routeItems.length) return false;
            var uid0 = Number(routeItems[0].uid || 0);
            for (var i = 0; i < routeItems.length; i++) {
                if (Number(routeItems[i].uid || 0) !== uid0) return false;
            }
            drag.routeItems = routeItems;
            drag.previewRouteUid = uid0;
        } else {
            var entryUids = this.selectedEntryUidsFromRange();
            if (!entryUids.length) return false;
            drag.entryUids = entryUids;
            var canV = true;
            for (var j = 0; j < entryUids.length; j++) {
                var e = this.findEntryInSelectedTrack(entryUids[j]);
                if (!e || !e.command || Number(e.command.code || 0) !== 205 || String(e.rowKey || '').indexOf('char:') !== 0) {
                    canV = false;
                    break;
                }
            }
            drag.allowVertical = canV && mode === 'rect';
            var anchorEntry = this.findEntryInSelectedTrack(drag.hitUid);
            if (!anchorEntry) anchorEntry = this.findEntryInSelectedTrack(entryUids[0]);
            drag.anchorRowKey = anchorEntry ? String(anchorEntry.rowKey || 'main') : 'main';
            drag.anchorRowIndex = this.rowIndexByKey(drag.anchorRowKey);
        }
        this.rangeMoveDrag = drag;
        this.rangeSelectDrag = null;
        this.dragState = null;
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.buildRangeMoveRoutePreview = function(drag, frameDelta) {
        var out = { valid: false, reason: '', blocks: null, selectedListIndexes: [] };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) { out.reason = 'no-track'; return out; }
        var entry = this.findEntryInSelectedTrack(drag.previewRouteUid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) { out.reason = 'no-route'; return out; }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list) { out.reason = 'no-list'; return out; }
        var parsed = this.routeBlocksFromList(list);
        var blocks = parsed.blocks || [];
        var selMap = Object.create(null);
        for (var i = 0; i < drag.routeItems.length; i++) {
            selMap[Math.floor(Number(drag.routeItems[i].routeListIndex == null ? -1 : drag.routeItems[i].routeListIndex))] = true;
        }
        var next = [];
        for (i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.floor(Number(b.start || 0));
            var listIndex = Math.floor(Number(b.listIndex == null ? -1 : b.listIndex));
            if (selMap[listIndex]) st += frameDelta;
            var nb = {
                start: st,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: listIndex,
                command: clone(b.command || { code: 0, parameters: [] }),
                _sel: !!selMap[listIndex]
            };
            if (nb.start < 0) {
                out.blocks = next;
                out.reason = 'minus';
                return out;
            }
            next.push(nb);
        }
        next.sort(function(a, b) {
            if (a.start !== b.start) return a.start - b.start;
            // Place unselected block first on same frame so selected block can be
            // treated as an insertion target into the wait span.
            if (a._sel !== b._sel) return a._sel ? 1 : -1;
            return a.listIndex - b.listIndex;
        });
        for (i = 1; i < next.length; i++) {
            var prev = next[i - 1];
            var cur = next[i];
            if (cur.start < prev.start + prev.dur) {
                // Allow dropping a no-wait selected node into the "empty" wait span
                // of an unselected previous node by splitting that wait span.
                var overlapResolved = false;
                var curDur = Math.max(1, Math.floor(Number(cur.dur || 1)));
                var prevDur = Math.max(1, Math.floor(Number(prev.dur || 1)));
                var prevEnd = prev.start + prevDur;
                var isCurInsidePrev = (cur.start >= prev.start && cur.start < prevEnd);
                if (isCurInsidePrev && !!cur._sel && !prev._sel && curDur === 1) {
                    // If cursor quantization lands on the previous command frame,
                    // snap to the first frame inside that command's wait span.
                    var targetStart = Math.max(prev.start + 1, cur.start);
                    if (targetStart < prevEnd) {
                        var head = targetStart - prev.start; // >= 1
                        var tail = Math.max(0, prevEnd - targetStart - 1);
                        cur.start = targetStart;
                        prev.dur = head;
                        cur.dur = 1 + tail;
                        overlapResolved = true;
                    }
                }
                // Allow moving a selected command rightward within its own wait span:
                // trim the selected block's trailing wait so the next unselected block stays in place.
                if (!overlapResolved && !!prev._sel && !cur._sel) {
                    var newPrevDur = cur.start - prev.start;
                    if (newPrevDur >= 1 && newPrevDur < prevDur) {
                        prev.dur = newPrevDur;
                        overlapResolved = true;
                    }
                }
                if (!overlapResolved && cur.start < prev.start + Math.max(1, Math.floor(Number(prev.dur || 1)))) {
                    out.blocks = next;
                    out.reason = 'overlap';
                    return out;
                }
            }
        }
        var probe = clone(entry);
        var probeCmd = clone(entry.command);
        var probeRoute = probeCmd.parameters && probeCmd.parameters[1] ? clone(probeCmd.parameters[1]) : this.defaultMoveRoute();
        probeRoute.list = this.routeListFromBlocks(next);
        if (!Array.isArray(probeCmd.parameters)) probeCmd.parameters = [entry.charId || 0, probeRoute];
        probeCmd.parameters[1] = probeRoute;
        probe.command = probeCmd;
        probe.wait = this.commandWaitFrames(probeCmd);
        if (!this.canPlaceEntry(tr, probe, probe.frame, probe.rowKey, probe.uid)) {
            out.blocks = next;
            out.reason = 'collision';
            return out;
        }
        var curFrame = 0;
        var cmdIndex = 0;
        var selectedList = [];
        for (i = 0; i < next.length; i++) {
            var nb2 = next[i];
            var st2 = Math.max(0, Math.floor(Number(nb2.start || 0)));
            var dur2 = Math.max(1, Math.floor(Number(nb2.dur || 1)));
            if (st2 > curFrame) cmdIndex++;
            if (nb2._sel) selectedList.push(cmdIndex);
            cmdIndex++;
            if (dur2 > 1) cmdIndex++;
            curFrame = st2 + dur2;
        }
        out.valid = true;
        out.blocks = next;
        out.selectedListIndexes = selectedList;
        return out;
    };

    EE.prototype.buildRangeMoveEntryPreview = function(drag, frameDelta, rowShift, pointerY) {
        var out = { valid: false, reason: '', moved: [] };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) { out.reason = 'no-track'; return out; }
        var moved = [];
        var i;
        var rows = this._rows || [];
        var targetRow = this.rowFromY(pointerY);
        var useShift = 0;
        if (drag.allowVertical && targetRow) {
            var targetIdx = this.rowIndexByKey(targetRow.key);
            if (targetIdx >= 0 && drag.anchorRowIndex >= 0) useShift = targetIdx - drag.anchorRowIndex;
        }
        if (!drag.allowVertical) useShift = 0;
        for (i = 0; i < drag.entryUids.length; i++) {
            var uid = Number(drag.entryUids[i] || 0);
            var e = this.findEntryInSelectedTrack(uid);
            if (!e) continue;
            var nf = Math.max(0, Math.floor(Number(e.frame || 0)) + frameDelta);
            var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            if (useShift !== 0) {
                if (!drag.allowVertical) { out.reason = 'vertical-disabled'; return out; }
                var srcIdx = this.rowIndexByKey(rk);
                if (srcIdx < 0) { out.reason = 'row-missing'; return out; }
                var dstIdx = srcIdx + useShift;
                if (dstIdx < 0 || dstIdx >= rows.length) { out.reason = 'row-range'; return out; }
                var dst = rows[dstIdx];
                if (!dst || String(dst.key || '').indexOf('char:') !== 0) { out.reason = 'row-not-char'; return out; }
                rk = String(dst.key || rk);
            }
            moved.push({ entry: e, frame: nf, rowKey: rk });
        }
        if (!moved.length) { out.reason = 'no-entry'; return out; }
        if (!this.batchCanPlaceEntries(tr, moved)) {
            out.reason = 'collision';
            out.moved = moved;
            return out;
        }
        out.valid = true;
        out.moved = moved;
        out.rowShift = useShift;
        return out;
    };

    EE.prototype.updateRangeMoveDrag = function(x, y) {
        var drag = this.rangeMoveDrag;
        if (!drag) return false;
        x = Number(x || 0);
        y = Number(y || 0);
        var df = this.xToFrame(x) - this.xToFrame(drag.startX);
        var dx = Math.abs(x - drag.startX);
        var dy = Math.abs(y - drag.startY);
        if (!drag.moved && (dx > 2 || dy > 2)) drag.moved = true;
        drag.frameDelta = Math.floor(Number(df || 0));
        drag.valid = false;
        drag.invalidReason = '';
        if (!drag.moved) {
            drag.valid = true;
            drag.previewEntries = [];
            drag.previewRouteBlocks = null;
            drag.previewRouteDisplayOffsets = [];
            this.timelineDirty = true;
            return true;
        }
        if (drag.kind === 'routeCmd') {
            var rp = this.buildRangeMoveRoutePreview(drag, drag.frameDelta);
            drag.valid = !!rp.valid;
            drag.invalidReason = String(rp.reason || '');
            drag.previewRouteBlocks = rp.blocks || null;
            drag.previewRouteSelection = rp.selectedListIndexes || [];
            drag.previewRouteDisplayOffsets = [];
            if (drag.previewRouteBlocks && drag.previewRouteBlocks.length && drag.previewRouteSelection.length) {
                var pe = this.findEntryInSelectedTrack(Number(drag.previewRouteUid || 0));
                var pr = pe && pe.command && pe.command.parameters ? pe.command.parameters[1] : null;
                var preRoute = (pr && typeof pr === 'object') ? clone(pr) : this.defaultMoveRoute();
                preRoute.list = this.routeListFromBlocks(drag.previewRouteBlocks || []);
                var preTl = this.moveRouteTimeline(preRoute);
                var selMap = Object.create(null);
                var si;
                for (si = 0; si < drag.previewRouteSelection.length; si++) {
                    var sidx = Math.floor(Number(drag.previewRouteSelection[si] == null ? -1 : drag.previewRouteSelection[si]));
                    if (sidx >= 0) selMap[sidx] = true;
                }
                var pitems = preTl && Array.isArray(preTl.items) ? preTl.items : [];
                for (var pi = 0; pi < pitems.length; pi++) {
                    var pit = pitems[pi];
                    if (!pit) continue;
                    var li = Math.floor(Number(pit.listIndex == null ? -1 : pit.listIndex));
                    if (li < 0 || !selMap[li]) continue;
                    var dcode = Number((pit.displayCode != null) ? pit.displayCode : this.routeDisplayCodeForCommand(pit.command));
                    if (dcode <= 0 || dcode === 15) continue;
                    drag.previewRouteDisplayOffsets.push(Math.max(0, Math.floor(Number(pit.offset || 0))));
                }
            }
        } else {
            var ep = this.buildRangeMoveEntryPreview(drag, drag.frameDelta, drag.rowShift, y);
            drag.valid = !!ep.valid;
            drag.invalidReason = String(ep.reason || '');
            drag.previewEntries = ep.moved || [];
            drag.rowShift = Number(ep.rowShift || 0);
        }
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.rangeMoveBlocksForDebug = function(blocks) {
        blocks = Array.isArray(blocks) ? blocks : [];
        var out = [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            out.push({
                start: Math.max(0, Math.floor(Number(b.start || 0))),
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Math.floor(Number(b.listIndex == null ? -1 : b.listIndex)),
                sel: !!b._sel,
                code: Math.floor(Number((b.command && b.command.code) || 0))
            });
        }
        return out;
    };

    EE.prototype.makeRangeMoveDropFailureDebug = function(drag) {
        drag = drag || {};
        var payload = {
            type: 'range_move_drop_failure',
            reason: String(drag.invalidReason || 'unknown'),
            kind: String(drag.kind || ''),
            frameDelta: Math.floor(Number(drag.frameDelta || 0)),
            rowShift: Math.floor(Number(drag.rowShift || 0)),
            hitUid: Math.floor(Number(drag.hitUid || 0)),
            hitRouteListIndex: Math.floor(Number(drag.hitRouteListIndex == null ? -1 : drag.hitRouteListIndex)),
            selection: Array.isArray(this.rangeSelection && this.rangeSelection.items) ? clone(this.rangeSelection.items) : [],
            editorFrame: Math.max(0, Math.floor(Number(this.frame || 0))),
            trackKey: String(this.selKey || '')
        };
        if (String(payload.kind) === 'routeCmd') {
            var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            var entry = this.findEntryInSelectedTrack(Number(drag.previewRouteUid || 0));
            var route = entry && entry.command && entry.command.parameters ? entry.command.parameters[1] : null;
            var list = route && Array.isArray(route.list) ? route.list : [];
            var srcParsed = this.routeBlocksFromList(list);
            payload.route = {
                uid: Math.floor(Number(drag.previewRouteUid || 0)),
                entryFrame: Math.max(0, Math.floor(Number(entry && entry.frame || 0))),
                rowKey: String(entry && entry.rowKey || ''),
                entryWait: Math.max(0, Math.floor(Number(entry && entry.wait || 0))),
                selectedRouteItems: Array.isArray(drag.routeItems) ? clone(drag.routeItems) : [],
                sourceBlocks: this.rangeMoveBlocksForDebug(srcParsed.blocks || []),
                previewBlocks: this.rangeMoveBlocksForDebug(drag.previewRouteBlocks || []),
                previewSelection: Array.isArray(drag.previewRouteSelection) ? drag.previewRouteSelection.slice(0) : [],
                previewDisplayOffsets: Array.isArray(drag.previewRouteDisplayOffsets) ? drag.previewRouteDisplayOffsets.slice(0) : []
            };
            if (payload.reason === 'collision' && tr && entry && entry.command && Number(entry.command.code || 0) === 205) {
                var probe = clone(entry);
                var probeCmd = clone(entry.command);
                var probeRoute = probeCmd.parameters && probeCmd.parameters[1] ? clone(probeCmd.parameters[1]) : this.defaultMoveRoute();
                probeRoute.list = this.routeListFromBlocks(drag.previewRouteBlocks || []);
                if (!Array.isArray(probeCmd.parameters)) probeCmd.parameters = [entry.charId || 0, probeRoute];
                probeCmd.parameters[1] = probeRoute;
                probe.command = probeCmd;
                probe.wait = this.commandWaitFrames(probeCmd);
                payload.collision = this.collectCanPlaceEntryConflicts(
                    tr, probe, probe.frame, String(probe.rowKey || ''), Math.floor(Number(probe.uid || 0))
                );
            }
        } else {
            var moved = Array.isArray(drag.previewEntries) ? drag.previewEntries : [];
            payload.entries = [];
            for (var i = 0; i < moved.length; i++) {
                var it = moved[i];
                if (!it || !it.entry) continue;
                payload.entries.push({
                    uid: Math.floor(Number(it.entry.uid || 0)),
                    fromFrame: Math.max(0, Math.floor(Number(it.entry.frame || 0))),
                    toFrame: Math.max(0, Math.floor(Number(it.frame || 0))),
                    fromRowKey: String(it.entry.rowKey || ''),
                    toRowKey: String(it.rowKey || '')
                });
            }
        }
        return payload;
    };

    EE.prototype.logRangeMoveDropFailure = function(drag) {
        var payload = this.makeRangeMoveDropFailureDebug(drag);
        this._eeLastRangeMoveDropFailure = payload;
        this._eeLastRangeMoveDropFailureText = JSON.stringify(payload, null, 2);
        if (typeof window !== 'undefined') window.__EE_LAST_RANGE_MOVE_FAIL__ = payload;
        if (typeof console !== 'undefined' && console) {
            if (console.groupCollapsed) console.groupCollapsed('[EE] 範囲移動ドロップ失敗');
            if (console.warn) console.warn('EE_RANGE_MOVE_FAIL', payload);
            if (console.log) console.log('EE_RANGE_MOVE_FAIL_JSON\n' + this._eeLastRangeMoveDropFailureText);
            if (console.trace) console.trace();
            if (console.groupEnd) console.groupEnd();
        }
        return payload;
    };

    EE.prototype.applyRangeMoveDrag = function() {
        var drag = this.rangeMoveDrag;
        this.rangeMoveDrag = null;
        if (!drag || !drag.moved) return false;
        if (!drag.valid) {
            this.logRangeMoveDropFailure(drag);
            this.msg('ドロップ失敗（詳細ログ: F8 -> EE_RANGE_MOVE_FAIL_JSON）');
            this.timelineDirty = true;
            return false;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        this.pushSnap('rangeMove');
        if (drag.kind === 'routeCmd') {
            var e = this.findEntryInSelectedTrack(drag.previewRouteUid);
            if (!e || !e.command || Number(e.command.code || 0) !== 205) return false;
            var route = e.command.parameters && e.command.parameters[1];
            if (!route || typeof route !== 'object') route = this.defaultMoveRoute();
            route.list = this.routeListFromBlocks(drag.previewRouteBlocks || []);
            if (!Array.isArray(e.command.parameters)) e.command.parameters = [e.charId || 0, route];
            e.command.parameters[1] = route;
            e.wait = this.commandWaitFrames(e.command);
            var nextSel = [];
            for (var i = 0; i < drag.previewRouteSelection.length; i++) {
                nextSel.push({ kind: 'routeCmd', uid: e.uid, routeListIndex: drag.previewRouteSelection[i] });
            }
            this.setRangeSelection('rect', nextSel, {
                frameStart: this.rangeSelection && this.rangeSelection.frameStart != null ? this.rangeSelection.frameStart : 0,
                frameEnd: this.rangeSelection && this.rangeSelection.frameEnd != null ? this.rangeSelection.frameEnd : 0,
                rects: this.rangeSelection && Array.isArray(this.rangeSelection.rects) ? this.rangeSelection.rects : [],
                nonContiguous: !!(this.rangeSelection && this.rangeSelection.nonContiguous)
            });
        } else {
            var moved = drag.previewEntries || [];
            for (var m = 0; m < moved.length; m++) {
                var it = moved[m];
                if (!it || !it.entry) continue;
                var de = it.entry;
                de.frame = Math.max(0, Math.floor(Number(it.frame || 0)));
                de.rowKey = String(it.rowKey || de.rowKey || 'main');
                if (de.rowKey.indexOf('char:') === 0) {
                    var cid = this.normalizeMoveTarget(Number(de.rowKey.replace('char:', '')));
                    de.rowType = 'char';
                    de.charId = cid;
                    if (de.command && Number(de.command.code || 0) === 205) {
                        if (!Array.isArray(de.command.parameters)) de.command.parameters = [cid, this.defaultMoveRoute()];
                        de.command.parameters[0] = cid;
                    }
                } else {
                    de.rowType = 'main';
                    de.charId = null;
                }
            }
        }
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        return true;
    };

    EE.prototype.globalSqueezeRemovableFrames = function(tr, startFrame, endFrameEx) {
        var out = [];
        if (!tr || !Array.isArray(tr.commands)) return out;
        var s = Math.max(0, Math.floor(Number(startFrame || 0)));
        var e = Math.max(s, Math.floor(Number(endFrameEx == null ? s : endFrameEx)));
        for (var f = s; f < e; f++) {
            var occ = false;
            for (var i = 0; i < tr.commands.length; i++) {
                var cmd = tr.commands[i];
                if (!cmd) continue;
                var cs = Math.max(0, Math.floor(Number(cmd.frame || 0)));
                var cw = Math.max(0, Math.floor(Number(cmd.wait || 0)));
                var ce = cs + cw;
                if (cw > 0) {
                    if (f >= cs && f < ce) { occ = true; break; }
                } else if (f === cs) {
                    occ = true;
                    break;
                }
            }
            if (!occ) out.push(f);
        }
        return out;
    };

    EE.prototype.routeSqueezeRemovableOffsets = function(entry, startFrame, endFrameEx) {
        var out = [];
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return out;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list) return out;
        var parsed = this.routeBlocksFromList(list);
        var blocks = parsed.blocks || [];
        var total = Math.max(0, Math.floor(Number(parsed.total || 0)));
        var rs = Math.max(0, Math.floor(Number(startFrame || 0)) - Math.floor(Number(entry.frame || 0)));
        var re = Math.max(rs, Math.floor(Number(endFrameEx == null ? rs : endFrameEx)) - Math.floor(Number(entry.frame || 0)));
        rs = Math.max(0, Math.min(total, rs));
        re = Math.max(rs, Math.min(total, re));
        for (var off = rs; off < re; off++) {
            var occ = false;
            for (var i = 0; i < blocks.length; i++) {
                var b = blocks[i];
                if (!b) continue;
                var bs = Math.max(0, Math.floor(Number(b.start || 0)));
                var be = bs + Math.max(1, Math.floor(Number(b.dur || 1)));
                if (off >= bs && off < be) { occ = true; break; }
            }
            if (!occ) out.push(off);
        }
        return out;
    };

    EE.prototype.selectionSqueezeCapability = function() {
        var off = { enabled: false, mode: '', reason: 'no-selection', start: 0, end: 0, uid: 0, removedFrames: 0 };
        if (!this.hasRangeSelection()) {
            var singleUid = 0;
            if (Number(this.routeRangeCtxUid || 0) > 0) singleUid = Number(this.routeRangeCtxUid || 0);
            else if (Number(this.selUid || 0) > 0 && Number(this.selRouteListIndex == null ? -1 : this.selRouteListIndex) < 0) singleUid = Number(this.selUid || 0);
            if (singleUid > 0) {
                var tr0 = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
                var entry0 = this.findRouteRangeEntryByUid(singleUid);
                if (tr0 && entry0) {
                    var s0 = Math.max(0, Math.floor(Number(entry0.frame || 0)));
                    var e0 = s0 + Math.max(1, Math.floor(Number(entry0.wait || 1)));
                    var rem0 = this.routeSqueezeRemovableOffsets(entry0, s0, e0);
                    if (rem0.length > 0) {
                        return { enabled: true, mode: 'route', reason: '', start: s0, end: e0, uid: singleUid, removedFrames: rem0.length };
                    }
                    off.reason = 'no-gap';
                    return off;
                }
            }
            return off;
        }
        var rs = this.rangeSelection || {};
        if (rs.nonContiguous) {
            off.reason = 'non-contiguous';
            return off;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            off.reason = 'no-track';
            return off;
        }
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd || fs)));
        if (String(rs.kind || '') === 'memory') {
            var rem = this.globalSqueezeRemovableFrames(tr, fs, fe + 1);
            if (!rem.length) {
                off.reason = 'no-gap';
                return off;
            }
            return { enabled: true, mode: 'global', reason: '', start: fs, end: fe + 1, uid: 0, removedFrames: rem.length };
        }
        var rsItems = Array.isArray(rs.items) ? rs.items : [];
        for (var si = 0; si < rsItems.length; si++) {
            if (!rsItems[si] || String(rsItems[si].kind || '') !== 'routeCmd') {
                off.reason = 'not-route-cmd';
                return off;
            }
        }
        var routeItems = this.selectedRouteCmdItemsFromRange();
        if (!routeItems.length) {
            off.reason = 'not-route-cmd';
            return off;
        }
        var uid0 = Number(routeItems[0].uid || 0);
        for (var i = 0; i < routeItems.length; i++) {
            if (Number(routeItems[i].uid || 0) !== uid0) {
                off.reason = 'multi-route';
                return off;
            }
        }
        var entry = this.findRouteRangeEntryByUid(uid0);
        if (!entry) {
            off.reason = 'route-missing';
            return off;
        }
        var rem2 = this.routeSqueezeRemovableOffsets(entry, fs, fe + 1);
        if (!rem2.length) {
            off.reason = 'no-gap';
            return off;
        }
        return { enabled: true, mode: 'route', reason: '', start: fs, end: fe + 1, uid: uid0, removedFrames: rem2.length };
    };

    EE.prototype.shrinkCurrentRangeSelectionAfterSqueeze = function(removedFrames) {
        var rm = Math.max(0, Math.floor(Number(removedFrames || 0)));
        if (rm <= 0) return;
        var rs = this.rangeSelection || null;
        if (!rs || String(rs.kind || 'none') === 'none') return;
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd || fs)));
        var oldEndEx = fe + 1;
        var newEndEx = Math.max(fs + 1, oldEndEx - rm);
        rs.frameStart = fs;
        rs.frameEnd = Math.max(fs, newEndEx - 1);
        var shrinkPx = Math.max(0, this.frameToX(oldEndEx) - this.frameToX(newEndEx));
        var rects = Array.isArray(rs.rects) ? rs.rects : [];
        if (String(rs.kind || '') === 'memory') {
            var rr = this.rangeSelectionFrameRectFromFrames(rs.frameStart, rs.frameEnd);
            rr.y1 = 0;
            rr.y2 = this.th;
            rs.rects = [rr];
        } else if (shrinkPx > 0 && rects.length) {
            var nextRects = [];
            for (var i = 0; i < rects.length; i++) {
                var rc = rects[i];
                if (!rc) continue;
                var nx = clone(rc);
                if (Number(nx.x1 || 0) <= Number(nx.x2 || 0)) {
                    nx.x2 = Math.max(Number(nx.x1 || 0), Number(nx.x2 || 0) - shrinkPx);
                } else {
                    nx.x1 = Math.max(Number(nx.x2 || 0), Number(nx.x1 || 0) - shrinkPx);
                }
                nextRects.push(nx);
            }
            rs.rects = nextRects;
        }
        this.timelineDirty = true;
    };

    EE.prototype.applyGlobalSqueeze = function(startFrame, endFrameEx) {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var removable = this.globalSqueezeRemovableFrames(tr, startFrame, endFrameEx);
        if (!removable.length) return false;
        var remMap = Object.create(null);
        for (var i = 0; i < removable.length; i++) remMap[Math.floor(Number(removable[i] || 0))] = true;
        var s = Math.max(0, Math.floor(Number(startFrame || 0)));
        var e = Math.max(s, Math.floor(Number(endFrameEx == null ? s : endFrameEx)));
        var shiftBefore = function(frame) {
            var cnt = 0;
            for (var f = s; f < Math.min(e, frame); f++) if (remMap[f]) cnt++;
            if (frame >= e) cnt = removable.length;
            return cnt;
        };
        for (i = 0; i < tr.commands.length; i++) {
            var cmd = tr.commands[i];
            if (!cmd) continue;
            var old = Math.max(0, Math.floor(Number(cmd.frame || 0)));
            var sh = shiftBefore(old);
            cmd.frame = Math.max(0, old - sh);
        }
        return true;
    };

    EE.prototype.applyRouteSqueeze = function(uid, startFrame, endFrameEx) {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var e = this.findRouteRangeEntryByUid(uid);
        if (!e) return false;
        var route = e.command.parameters && e.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list) return false;
        var blocks = this.routeBlocksFromList(list).blocks || [];
        var removable = this.routeSqueezeRemovableOffsets(e, startFrame, endFrameEx);
        if (!removable.length) return false;
        var remMap = Object.create(null);
        for (var i = 0; i < removable.length; i++) remMap[Math.floor(Number(removable[i] || 0))] = true;
        var rs = Math.max(0, Math.floor(Number(startFrame || 0)) - Math.floor(Number(e.frame || 0)));
        var re = Math.max(rs, Math.floor(Number(endFrameEx == null ? startFrame : endFrameEx)) - Math.floor(Number(e.frame || 0)));
        var shiftBefore = function(off) {
            var cnt = 0;
            for (var f = rs; f < Math.min(re, off); f++) if (remMap[f]) cnt++;
            if (off >= re) cnt = removable.length;
            return cnt;
        };
        var next = [];
        for (i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.max(0, Math.floor(Number(b.start || 0)));
            st = Math.max(0, st - shiftBefore(st));
            next.push({
                start: st,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Math.floor(Number(b.listIndex == null ? -1 : b.listIndex)),
                command: clone(b.command || { code: 0, parameters: [] })
            });
        }
        var oldCmd = clone(e.command);
        var oldWait = Math.max(1, Math.floor(Number(e.wait || 1)));
        route.list = this.routeListFromBlocks(next);
        e.wait = this.commandWaitFrames(e.command);
        if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
            e.command = oldCmd;
            e.wait = oldWait;
            return false;
        }
        return true;
    };

    EE.prototype.executeSelectionSqueezeFromContextMenu = function() {
        var cap = this.selectionSqueezeCapability();
        if (!cap.enabled) {
            this.msg('詰める不可');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var ok = false;
        this.pushSnap('rangeSqueeze');
        if (cap.mode === 'global') ok = this.applyGlobalSqueeze(cap.start, cap.end);
        else if (cap.mode === 'route') ok = this.applyRouteSqueeze(cap.uid, cap.start, cap.end);
        if (!ok) {
            this.msg('詰める失敗');
            return;
        }
        this.shrinkCurrentRangeSelectionAfterSqueeze(cap.removedFrames);
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (tr && Array.isArray(tr.commands)) tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        this.msg('詰める実行');
    };

    EE.prototype.selectionMessageWaitArrangeCapability = function() {
        var off = {
            enabled: false,
            reason: 'no-selection',
            frameStart: 0,
            frameEnd: 0,
            mainEntryCount: 0
        };
        if (!this.hasRangeSelection || !this.hasRangeSelection()) return off;
        var rs = this.rangeSelection || {};
        if (String(rs.kind || '') !== 'memory') {
            off.reason = 'not-frame-selection';
            return off;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            off.reason = 'no-track';
            return off;
        }
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        var count = 0;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) <= 0) continue;
            var rowKey = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            if (rowKey !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f < fs || f > fe) continue;
            count++;
        }
        off.frameStart = fs;
        off.frameEnd = fe;
        off.mainEntryCount = count;
        if (count <= 0) {
            off.reason = 'no-main-entry';
            return off;
        }
        return {
            enabled: true,
            reason: '',
            frameStart: fs,
            frameEnd: fe,
            mainEntryCount: count
        };
    };

    EE.prototype.messageWaitArrangeSignature = function(entry, tr) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 101) return '';
        var ext = entry.messageExt
            ? this.sanitizeMessageExtState(entry.messageExt)
            : this.messageExtStateAtPoint(tr, entry ? entry.frame : 0, entry ? entry.uid : Infinity);
        ext = this.sanitizeMessageExtState(ext || {});
        var key = [
            'wt=' + Math.floor(Number(ext.windowType || 0)),
            'td=' + Math.floor(Number(ext.tailDir || 5)),
            'tm=' + String(ext.targetMode || 'char')
        ];
        if (String(ext.targetMode || '') === 'coord') {
            key.push('x=' + Math.floor(Number(ext.targetX || 0)));
            key.push('y=' + Math.floor(Number(ext.targetY || 0)));
        } else {
            key.push('cid=' + this.normalizeMessageTargetCharId(ext.targetCharId));
            key.push('ax=' + Math.floor(Number(ext.addX || 0)));
            key.push('ay=' + Math.floor(Number(ext.addY || 0)));
        }
        return key.join('|');
    };

    EE.prototype.executeSelectionMessageWaitArrangeFromContextMenu = function() {
        var cap = this.selectionMessageWaitArrangeCapability();
        if (!cap.enabled) {
            this.msg('ウェイト整理不可: 範囲フレーム選択を確認してください');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            this.msg('ウェイト整理失敗');
            return;
        }
        var fs = Math.max(0, Math.floor(Number(cap.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(cap.frameEnd == null ? fs : cap.frameEnd)));
        var oldEndEx = fe + 1;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });

        var startCursor = fs;
        for (var pi = 0; pi < tr.commands.length; pi++) {
            var pe = tr.commands[pi];
            if (!pe || !pe.command || Number(pe.command.code || 0) <= 0) continue;
            var prowKey = String(pe.rowKey || (pe.rowType === 'char' ? ('char:' + pe.charId) : 'main'));
            if (prowKey !== 'main') continue;
            var pf = Math.max(0, Math.floor(Number(pe.frame || 0)));
            if (pf >= fs) continue;
            var pEnd = pf + Math.max(0, Math.floor(Number(pe.wait || 0)));
            if (pEnd > startCursor) startCursor = pEnd;
        }

        var mainInRange = [];
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) <= 0) continue;
            var rowKey = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            if (rowKey !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f < fs || f > fe) continue;
            mainInRange.push(e);
        }
        if (!mainInRange.length) {
            this.msg('ウェイト整理: 対象コマンドなし');
            this.refreshRouteRangeContextMenu();
            return;
        }
        this.pushSnap('waitArrange');
        mainInRange.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });

        var reorderTargets = [];
        for (i = 0; i < mainInRange.length; i++) {
            var me = mainInRange[i];
            if (Number(me.command.code || 0) === 230) continue;
            reorderTargets.push(me);
        }

        var cursor = startCursor;
        var touchedMap = Object.create(null);
        var insertedCount = 0;
        var previousMessageSignature = '';
        var previousMessageSeen = false;
        for (i = 0; i < reorderTargets.length; i++) {
            var cur = reorderTargets[i];
            if (!cur || !cur.command) continue;
            var isMessage = Number(cur.command.code || 0) === 101;
            var msgSig = isMessage ? this.messageWaitArrangeSignature(cur, tr) : '';
            if (previousMessageSeen && isMessage && previousMessageSignature !== msgSig) {
                insertedCount++;
                cursor += 24;
            }
            cur.frame = cursor;
            touchedMap[Math.floor(Number(cur.uid || 0))] = true;
            cursor += Math.max(0, Math.floor(Number(cur.wait || 0)));
            if (isMessage) {
                previousMessageSeen = true;
                previousMessageSignature = msgSig;
            }
        }

        var newEndEx = Math.max(startCursor, cursor);
        var delta = newEndEx - oldEndEx;

        if (delta !== 0) {
            for (i = 0; i < tr.commands.length; i++) {
                var te = tr.commands[i];
                if (!te || !te.command || Number(te.command.code || 0) <= 0) continue;
                var tuid = Math.floor(Number(te.uid || 0));
                if (touchedMap[tuid]) continue;
                var tf = Math.max(0, Math.floor(Number(te.frame || 0)));
                if (tf < oldEndEx) continue;
                te.frame = Math.max(0, tf + delta);
            }
        }

        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        if (Math.max(0, Math.floor(Number(this.frame || 0))) >= oldEndEx) {
            this.frame = Math.max(0, Math.floor(Number(this.frame || 0)) + delta);
        }
        if (this.rangeSelection && String(this.rangeSelection.kind || '') === 'memory') {
            var nfe = Math.max(fs, newEndEx - 1);
            var nitems = this.collectMemoryRangeSelectionItems(fs, nfe);
            var nrect = this.rangeSelectionFrameRectFromFrames(fs, nfe);
            this.setRangeSelection('memory', nitems, {
                frameStart: fs,
                frameEnd: nfe,
                rects: nrect ? [nrect] : [],
                nonContiguous: false,
                keepEmpty: true
            });
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        this.refreshRouteRangeContextMenu();
        this.msg('ウェイト整理: 追加 ' + insertedCount + ' / シフト ' + delta + 'f');
    };

    EE.prototype.routeExecutionSpanFramesForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return Math.max(0, Math.floor(Number(entry && entry.wait || 0)));
        var route = entry.command.parameters && entry.command.parameters[1];
        var waitSpan = Math.max(0, Math.floor(Number(entry.wait || 0)));
        var runtimeSpan = Math.max(1, Math.floor(Number(this.moveRouteFrames(route) || 1)));
        return Math.max(1, waitSpan || runtimeSpan);
    };

    EE.prototype.selectionRouteMergeCapability = function() {
        var off = { enabled: false, reason: 'no-selection', entries: [] };
        if (!this.hasRangeSelection()) return off;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            off.reason = 'no-track';
            return off;
        }
        var uids = this.selectedEntryUidsFromRange();
        if (!uids.length) {
            off.reason = 'not-entry-selection';
            return off;
        }
        if (uids.length < 2) {
            off.reason = 'need-multiple';
            return off;
        }
        var entries = [];
        for (var i = 0; i < uids.length; i++) {
            var e = this.findEntryInSelectedTrack(Number(uids[i] || 0));
            if (!e || !e.command || Number(e.command.code || 0) !== 205 || String(e.rowType || '') !== 'char') {
                off.reason = 'not-route-entry';
                return off;
            }
            entries.push(e);
        }
        entries.sort(function(a, b) {
            return compareEntriesByFrameWaitUid(a, b);
        });
        var first = entries[0];
        var firstRoute = this.routeOptionsFromEntry(first);
        if (!firstRoute) {
            off.reason = 'route-missing';
            return off;
        }
        var firstCharId = this.normalizeMoveTarget(Number(first.charId || 0));
        var firstWait = (firstRoute.wait !== false);
        var firstRepeat = !!firstRoute.repeat;
        var firstSkippable = !!firstRoute.skippable;
        for (i = 0; i < entries.length; i++) {
            var cur = entries[i];
            if (this.normalizeMoveTarget(Number(cur.charId || 0)) !== firstCharId) {
                off.reason = 'multi-char';
                return off;
            }
            var curRoute = this.routeOptionsFromEntry(cur);
            if (!curRoute) {
                off.reason = 'route-missing';
                return off;
            }
            var curWait = (curRoute.wait !== false);
            if (curWait !== firstWait || !!curRoute.repeat !== firstRepeat || !!curRoute.skippable !== firstSkippable) {
                off.reason = 'option-mismatch';
                return off;
            }
            if (i <= 0) continue;
            var prev = entries[i - 1];
            var prevEnd = Math.max(0, Math.floor(Number(prev.frame || 0))) + this.routeExecutionSpanFramesForEntry(prev);
            if (Math.max(0, Math.floor(Number(cur.frame || 0))) < prevEnd) {
                off.reason = 'overlap';
                return off;
            }
        }
        return { enabled: true, reason: '', entries: entries };
    };

    EE.prototype.executeSelectionRouteMergeFromContextMenu = function() {
        var cap = this.selectionRouteMergeCapability();
        if (!cap.enabled) {
            this.msg('移動ルートの結合不可');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var entries = cap.entries || [];
        if (entries.length < 2) {
            this.msg('移動ルートの結合不可');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            this.msg('移動ルートの結合失敗');
            return;
        }
        var keep = entries[0];
        var keepUid = Math.floor(Number(keep.uid || 0));
        if (keepUid <= 0) {
            this.msg('移動ルートの結合失敗');
            return;
        }
        var removeMap = Object.create(null);
        for (var i = 1; i < entries.length; i++) removeMap[Math.floor(Number(entries[i].uid || 0))] = true;

        var mergedRoute = clone(this.routeOptionsFromEntry(keep) || {});
        var mergedList = [];
        var prevEndFrame = null;
        for (i = 0; i < entries.length; i++) {
            var srcEntry = entries[i];
            var srcStart = Math.max(0, Math.floor(Number(srcEntry.frame || 0)));
            if (prevEndFrame != null) {
                var gap = Math.max(0, srcStart - Math.max(0, Math.floor(Number(prevEndFrame || 0))));
                if (gap > 0) mergedList.push({ code: 15, parameters: [gap] });
            }
            var route = this.routeOptionsFromEntry(srcEntry);
            var list = route && Array.isArray(route.list) ? route.list : [];
            for (var j = 0; j < list.length; j++) {
                var cmd = list[j];
                var code = Number((cmd && cmd.code) || 0);
                if (code === 0) break;
                mergedList.push(clone(cmd));
            }
            prevEndFrame = srcStart + this.routeExecutionSpanFramesForEntry(srcEntry);
        }
        mergedList.push({ code: 0, parameters: [] });
        mergedRoute.list = mergedList;

        var mergedCommand = clone(keep.command || { code: 205, parameters: [] });
        if (!Array.isArray(mergedCommand.parameters)) mergedCommand.parameters = [0, this.defaultMoveRoute()];
        mergedCommand.parameters[0] = this.normalizeMoveTarget(Number(keep.charId || 0));
        mergedCommand.parameters[1] = mergedRoute;

        var mergedEntry = clone(keep);
        mergedEntry.command = mergedCommand;
        mergedEntry.wait = this.commandWaitFrames(mergedCommand);
        mergedEntry.rowType = 'char';
        mergedEntry.charId = this.normalizeMoveTarget(Number(keep.charId || 0));
        mergedEntry.rowKey = 'char:' + mergedEntry.charId;

        var tempCommands = [];
        for (i = 0; i < tr.commands.length; i++) {
            var src = tr.commands[i];
            if (!src) continue;
            var uid = Math.floor(Number(src.uid || 0));
            if (uid !== keepUid && removeMap[uid]) continue;
            if (uid === keepUid) tempCommands.push(clone(mergedEntry));
            else tempCommands.push(clone(src));
        }
        var tempTrack = { commands: tempCommands };
        if (!this.canPlaceEntry(tempTrack, mergedEntry, mergedEntry.frame, mergedEntry.rowKey, mergedEntry.uid)) {
            this.msg('移動ルートの結合失敗');
            this.refreshRouteRangeContextMenu();
            return;
        }

        this.pushSnap('routeMerge');
        var nextCommands = [];
        for (i = 0; i < tr.commands.length; i++) {
            var cur = tr.commands[i];
            if (!cur) continue;
            var curUid = Math.floor(Number(cur.uid || 0));
            if (curUid !== keepUid && removeMap[curUid]) continue;
            if (curUid === keepUid) {
                cur.command = clone(mergedCommand);
                cur.wait = Math.max(0, Math.floor(Number(mergedEntry.wait || 0)));
                cur.rowType = 'char';
                cur.charId = mergedEntry.charId;
                cur.rowKey = mergedEntry.rowKey;
            }
            nextCommands.push(cur);
        }
        tr.commands = nextCommands;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        if (this.hasRangeSelection()) this.clearRangeSelection();
        this.selUid = keepUid;
        this.selRouteListIndex = -1;
        this.frame = Math.max(0, Math.floor(Number(keep.frame || 0)));
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        this.msg('移動ルートを結合');
    };

    EE.prototype.selectionMessageBubbleBulkCapability = function() {
        var off = {
            enabled: false,
            reason: 'no-selection',
            entries: [],
            selectedCount: 0,
            targetCharId: 0,
            seedExt: null
        };
        if (!this.hasRangeSelection || !this.hasRangeSelection()) return off;
        var uids = this.selectedEntryUidsFromRange ? this.selectedEntryUidsFromRange() : [];
        if (!uids.length) {
            off.reason = 'no-entry-selection';
            return off;
        }
        if (uids.length < 2) {
            off.reason = 'need-multiple';
            return off;
        }
        var entries = [];
        var ignored = 0;
        for (var i = 0; i < uids.length; i++) {
            var e = this.findEntryInSelectedTrack(Math.floor(Number(uids[i] || 0)));
            if (!e || !e.command) { ignored++; continue; }
            if (Number(e.command.code || 0) !== 101) { ignored++; continue; }
            entries.push(e);
        }
        off.ignoredCount = ignored;
        if (entries.length < 2) {
            off.reason = 'need-multiple';
            return off;
        }
        var seed = null;
        var sameChar = true;
        var commonChar = null;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        for (i = 0; i < entries.length; i++) {
            var msg = entries[i];
            var ext = msg && msg.messageExt
                ? this.sanitizeMessageExtState(msg.messageExt)
                : (this.messageExtStateAtPoint ? this.messageExtStateAtPoint(tr, msg ? msg.frame : 0, msg ? msg.uid : Infinity) : null);
            if (!ext) ext = this.sanitizeMessageExtState({});
            if (!seed) seed = this.sanitizeMessageExtState(ext);
            if (String(ext.targetMode || '') !== 'char') {
                sameChar = false;
                continue;
            }
            var cid = this.normalizeMessageTargetCharId
                ? this.normalizeMessageTargetCharId(ext.targetCharId)
                : Math.floor(Number(ext.targetCharId || 0));
            if (commonChar == null) commonChar = cid;
            else if (commonChar !== cid) sameChar = false;
        }
        var targetCharId = 0;
        if (sameChar && commonChar != null) targetCharId = commonChar;
        else if (seed && String(seed.targetMode || '') === 'char') {
            targetCharId = this.normalizeMessageTargetCharId
                ? this.normalizeMessageTargetCharId(seed.targetCharId)
                : Math.floor(Number(seed.targetCharId || 0));
        }
        return {
            enabled: true,
            reason: '',
            entries: entries,
            selectedCount: entries.length,
            targetCharId: targetCharId,
            seedExt: seed || this.sanitizeMessageExtState({})
        };
    };

    EE.prototype.populateMessageBubbleBulkTargetOptions = function(selectedCharId) {
        var select = this.messageBubbleBulkTargetCharId;
        if (!select) return;
        var opts = (typeof this.characterTargetOptionsForSchema === 'function')
            ? this.characterTargetOptionsForSchema(true, true)
            : [{ value: -1, label: '-1 プレイヤー' }, { value: 0, label: '0 このイベント' }];
        select.innerHTML = '';
        for (var i = 0; i < opts.length; i++) {
            var sp = opts[i] || {};
            var op = document.createElement('option');
            op.value = String(Math.floor(Number(sp.value || 0)));
            op.textContent = String(sp.label || op.value);
            select.appendChild(op);
        }
        var wanted = this.normalizeMessageTargetCharId
            ? this.normalizeMessageTargetCharId(selectedCharId)
            : Math.floor(Number(selectedCharId || 0));
        var found = false;
        for (var si = 0; si < select.options.length; si++) {
            if (Math.floor(Number(select.options[si].value || 0)) === wanted) {
                select.selectedIndex = si;
                found = true;
                break;
            }
        }
        if (!found && select.options.length > 0) select.selectedIndex = 0;
    };

    EE.prototype.refreshMessageBubbleBulkDialogEnabledState = function() {
        if (this.messageBubbleBulkWindowType) {
            this.messageBubbleBulkWindowType.disabled = !(this.messageBubbleBulkWindowTypeCheck && this.messageBubbleBulkWindowTypeCheck.checked);
        }
        if (this.messageBubbleBulkTailDir) {
            this.messageBubbleBulkTailDir.disabled = !(this.messageBubbleBulkTailDirCheck && this.messageBubbleBulkTailDirCheck.checked);
        }
        if (this.messageBubbleBulkAddX) {
            this.messageBubbleBulkAddX.disabled = !(this.messageBubbleBulkAddXCheck && this.messageBubbleBulkAddXCheck.checked);
        }
        if (this.messageBubbleBulkAddY) {
            this.messageBubbleBulkAddY.disabled = !(this.messageBubbleBulkAddYCheck && this.messageBubbleBulkAddYCheck.checked);
        }
    };

    EE.prototype.openMessageBubbleBulkDialogFromContextMenu = function() {
        var cap = this.selectionMessageBubbleBulkCapability();
        if (!cap.enabled) {
            this.msg('ふきだし位置一括設定: 文章の表示を複数選択してください');
            this.refreshRouteRangeContextMenu();
            return;
        }
        this.closeRouteRangeContextMenu();
        this.openMessageBubbleBulkDialog(cap);
    };

    EE.prototype.openMessageBubbleBulkDialog = function(cap) {
        if (!this.messageBubbleBulkModal || !this.messageBubbleBulkTargetCharId) return;
        cap = (cap && cap.enabled) ? cap : this.selectionMessageBubbleBulkCapability();
        if (!cap.enabled) return;
        var seed = this.sanitizeMessageExtState(cap.seedExt || {});
        this.messageBubbleBulkDialogContext = {
            targetCharId: Math.floor(Number(cap.targetCharId || 0)),
            selectedCount: Math.max(0, Math.floor(Number(cap.selectedCount || 0)))
        };
        this.populateMessageBubbleBulkTargetOptions(this.messageBubbleBulkDialogContext.targetCharId);

        if (this.messageBubbleBulkWindowTypeCheck) this.messageBubbleBulkWindowTypeCheck.checked = false;
        if (this.messageBubbleBulkTailDirCheck) this.messageBubbleBulkTailDirCheck.checked = false;
        if (this.messageBubbleBulkAddXCheck) this.messageBubbleBulkAddXCheck.checked = false;
        if (this.messageBubbleBulkAddYCheck) this.messageBubbleBulkAddYCheck.checked = false;

        if (this.messageBubbleBulkWindowType) this.messageBubbleBulkWindowType.value = String(Math.floor(Number(seed.windowType || 0)));
        if (this.messageBubbleBulkTailDir) this.messageBubbleBulkTailDir.value = String(Math.max(1, Math.min(9, Math.floor(Number(seed.tailDir || 5)))));
        if (this.messageBubbleBulkAddX) this.messageBubbleBulkAddX.value = String(Math.floor(Number(seed.addX || 0)));
        if (this.messageBubbleBulkAddY) this.messageBubbleBulkAddY.value = String(Math.floor(Number(seed.addY || 0)));

        if (this.messageBubbleBulkInfo) {
            this.messageBubbleBulkInfo.textContent =
                '選択中: ' + this.messageBubbleBulkDialogContext.selectedCount + '件の文章の表示\n' +
                'OKで、対象キャラを参照している文章の表示をこのイベント内で一括更新します。';
        }
        this.refreshMessageBubbleBulkDialogEnabledState();
        this.messageBubbleBulkModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.messageBubbleBulkModal);
        this.messageBubbleBulkTargetCharId.focus();
    };

    EE.prototype.closeMessageBubbleBulkDialog = function() {
        this.messageBubbleBulkDialogContext = null;
        if (this.messageBubbleBulkModal) this.messageBubbleBulkModal.classList.remove('on');
    };

    EE.prototype.submitMessageBubbleBulkDialog = function() {
        if (!this.messageBubbleBulkDialogContext) return;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            this.msg('ふきだし位置一括設定失敗');
            return;
        }
        var applyWindowType = !!(this.messageBubbleBulkWindowTypeCheck && this.messageBubbleBulkWindowTypeCheck.checked);
        var applyTailDir = !!(this.messageBubbleBulkTailDirCheck && this.messageBubbleBulkTailDirCheck.checked);
        var applyAddX = !!(this.messageBubbleBulkAddXCheck && this.messageBubbleBulkAddXCheck.checked);
        var applyAddY = !!(this.messageBubbleBulkAddYCheck && this.messageBubbleBulkAddYCheck.checked);
        if (!applyWindowType && !applyTailDir && !applyAddX && !applyAddY) {
            this.msg('変更項目にチェックを入れてください');
            return;
        }
        var targetCharId = this.normalizeMessageTargetCharId
            ? this.normalizeMessageTargetCharId(Number(this.messageBubbleBulkTargetCharId && this.messageBubbleBulkTargetCharId.value || 0))
            : Math.floor(Number(this.messageBubbleBulkTargetCharId && this.messageBubbleBulkTargetCharId.value || 0));
        var windowType = this.normalizeMessageWindowType
            ? this.normalizeMessageWindowType(Number(this.messageBubbleBulkWindowType && this.messageBubbleBulkWindowType.value || -1))
            : Math.floor(Number(this.messageBubbleBulkWindowType && this.messageBubbleBulkWindowType.value || -1));
        var tailDir = this.normalizeMessageTailDir
            ? this.normalizeMessageTailDir(Number(this.messageBubbleBulkTailDir && this.messageBubbleBulkTailDir.value || 5))
            : Math.max(1, Math.min(9, Math.floor(Number(this.messageBubbleBulkTailDir && this.messageBubbleBulkTailDir.value || 5))));
        var addX = Math.floor(Number(this.messageBubbleBulkAddX && this.messageBubbleBulkAddX.value || 0));
        var addY = Math.floor(Number(this.messageBubbleBulkAddY && this.messageBubbleBulkAddY.value || 0));
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;

        var updates = [];
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 101) continue;
            var ext = e.messageExt
                ? this.sanitizeMessageExtState(e.messageExt)
                : (this.messageExtStateAtPoint ? this.messageExtStateAtPoint(tr, e.frame, e.uid) : this.sanitizeMessageExtState({}));
            if (String(ext.targetMode || '') !== 'char') continue;
            var curTargetChar = this.normalizeMessageTargetCharId
                ? this.normalizeMessageTargetCharId(ext.targetCharId)
                : Math.floor(Number(ext.targetCharId || 0));
            if (curTargetChar !== targetCharId) continue;
            var next = this.sanitizeMessageExtState(ext);
            var changed = false;
            if (applyWindowType && next.windowType !== windowType) {
                next.windowType = windowType;
                changed = true;
            }
            if (applyTailDir && next.tailDir !== tailDir) {
                next.tailDir = tailDir;
                changed = true;
            }
            if (applyAddX && next.addX !== addX) {
                next.addX = addX;
                changed = true;
            }
            if (applyAddY && next.addY !== addY) {
                next.addY = addY;
                changed = true;
            }
            if (!changed) continue;
            updates.push({ entry: e, ext: this.sanitizeMessageExtState(next) });
        }
        if (!updates.length) {
            this.msg('一致する文章の表示がないか、変更不要です');
            return;
        }

        this.pushSnap('messageBubbleBulk');
        for (i = 0; i < updates.length; i++) {
            updates[i].entry.messageExt = updates[i].ext;
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        this.closeMessageBubbleBulkDialog();
        this.msg('ふきだし位置一括設定: ' + updates.length + '件');
    };

    EE.prototype.showTipAt = function(screenX, screenY, text) {
        if (!this.tip) return;
        if (!text) {
            this.tip.style.display = 'none';
            return;
        }
        var baseX = Math.floor(Number(screenX || 0) + 12);
        var baseY = Math.floor(Number(screenY || 0) + 12);
        this.tip.style.display = 'block';
        this.tip.style.left = baseX + 'px';
        this.tip.style.top = baseY + 'px';
        if (Array.isArray(text)) {
            var lines = text;
            var html = '';
            for (var i = 0; i < lines.length; i++) {
                var it = lines[i];
                if (typeof it === 'string') {
                    html += this.escapeHtml(it);
                } else if (it && typeof it.text === 'string') {
                    var col = '';
                    if (it.color) {
                        col = String(it.color);
                    } else if (it.detail) {
                        col = it.dim ? 'rgba(118,164,182,.95)' : 'rgba(132,224,255,.98)';
                    } else {
                        col = it.dim ? 'rgba(170,176,188,.95)' : 'rgba(238,245,255,.98)';
                    }
                    var fw = it.bold ? '700' : '400';
                    var lineText = String(it.text || '');
                    if (it.bulletWhite) {
                        var bi = lineText.indexOf('●');
                        if (bi >= 0) {
                            var pre = lineText.slice(0, bi);
                            var post = lineText.slice(bi + 1);
                            var bulletCol = it.bulletColor ? String(it.bulletColor) : col;
                            html += '<span style="color:' + col + ';font-weight:' + fw + ';">' + this.escapeHtml(pre) + '</span>';
                            html += '<span style="color:' + bulletCol + ';font-weight:' + fw + ';">●</span>';
                            html += '<span style="color:' + col + ';font-weight:' + fw + ';">' + this.escapeHtml(post) + '</span>';
                        } else {
                            html += '<span style="color:' + col + ';font-weight:' + fw + ';">' + this.escapeHtml(lineText) + '</span>';
                        }
                    } else {
                        html += '<span style="color:' + col + ';font-weight:' + fw + ';">' + this.escapeHtml(lineText) + '</span>';
                    }
                } else {
                    html += this.escapeHtml(String(it));
                }
                if (i !== lines.length - 1) html += '<br>';
            }
            this.tip.innerHTML = html;
        } else {
            this.tip.textContent = String(text);
        }
        var pad = 8;
        var vw = 0;
        var vh = 0;
        try {
            vw = Math.max(0, Math.floor(Number(window.innerWidth || 0)));
            vh = Math.max(0, Math.floor(Number(window.innerHeight || 0)));
        } catch (_) {
            vw = 0;
            vh = 0;
        }
        if (!vw || !vh) return;
        var rect = null;
        try { rect = this.tip.getBoundingClientRect ? this.tip.getBoundingClientRect() : null; } catch (_) { rect = null; }
        if (!rect) return;
        var w = Math.max(0, Math.ceil(Number(rect.width || 0)));
        var h = Math.max(0, Math.ceil(Number(rect.height || 0)));
        var x = baseX;
        var y = baseY;
        if (x + w + pad > vw) x = Math.max(pad, vw - w - pad);
        if (y + h + pad > vh) y = Math.max(pad, vh - h - pad);
        if (x < pad) x = pad;
        if (y < pad) y = pad;
        this.tip.style.left = Math.floor(x) + 'px';
        this.tip.style.top = Math.floor(y) + 'px';
    };

    EE.prototype.escapeHtml = function(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    EE.prototype.commandNameFromCatalog = function(code) {
        code = Number(code || 0);
        if (!code) return '';
        if (!this._commandNameCache) {
            this._commandNameCache = {};
            this.ensureAddCommandCatalog();
            var cat = this._addCommandCatalog || {};
            var pages = [1, 2, 3, 4];
            for (var pi = 0; pi < pages.length; pi++) {
                var pg = cat[pages[pi]];
                if (!pg) continue;
                var cols = [pg.left, pg.right];
                for (var ci = 0; ci < cols.length; ci++) {
                    var groups = Array.isArray(cols[ci]) ? cols[ci] : [];
                    for (var gi = 0; gi < groups.length; gi++) {
                        var items = Array.isArray(groups[gi] && groups[gi].items) ? groups[gi].items : [];
                        for (var ii = 0; ii < items.length; ii++) {
                            var it = items[ii];
                            var c = Number(it && it.code || 0);
                            if (!c || this._commandNameCache[c]) continue;
                            var nm = String(it && it.label || '');
                            nm = nm.replace(/\.\.\.$/, '');
                            if (nm) this._commandNameCache[c] = nm;
                        }
                    }
                }
            }
        }
        return String(this._commandNameCache[code] || '');
    };

    EE.prototype.commandNameJa = function(code) {
        var n = {
            101: '文章の表示',
            102: '選択肢の表示',
            103: '数値入力の処理',
            104: 'アイテム選択の処理',
            105: '文章のスクロール表示',
            108: '注釈',
            111: '条件分岐',
            112: 'ループ',
            113: 'ループの中断',
            117: 'コモンイベント',
            118: 'ラベル',
            119: 'ラベルジャンプ',
            411: 'それ以外のとき',
            412: '分岐終了',
            121: 'スイッチの操作',
            122: '変数の操作',
            123: 'セルフスイッチの操作',
            124: 'タイマーの操作',
            125: '増減の操作',
            201: '場所移動',
            205: '移動ルートの設定',
            230: 'ウェイト',
            250: 'SEの演奏',
            261: 'ムービーの再生',
            303: '名前入力の処理',
            355: 'スクリプト',
            35550: 'カメラ移動',
            35551: 'カメラ移動(直接指定)',
            35552: 'キャラの瞬間移動',
            35556: 'ピクチャSS表示',
            35557: 'ピクチャSS再生',
            35558: 'ピクチャSS停止',
            356: 'プラグインコマンド'
        };
        var c = Number(code || 0);
        if (n[c]) return n[c];
        var catName = this.commandNameFromCatalog(c);
        if (catName) return catName;
        var schema = this.getEditorSchema(c);
        if (schema && schema.title) return String(schema.title);
        return 'コマンド' + c;
    };

    EE.prototype.tooltipShortText = function(v, maxLen) {
        maxLen = Math.max(8, Math.floor(Number(maxLen || 60)));
        var s = String(v == null ? '' : v).replace(/\r?\n/g, ' / ').trim();
        if (s.length > maxLen) s = s.slice(0, Math.max(1, maxLen - 3)) + '...';
        return s;
    };

    EE.prototype.tooltipAudioParamText = function(v) {
        if (!v || typeof v !== 'object') return '';
        var hasAny = (v.name != null || v.volume != null || v.pitch != null || v.pan != null);
        if (!hasAny) return '';
        var name = this.tooltipShortText(v.name || '(なし)', 26);
        var vol = Math.max(0, Math.floor(Number(v.volume == null ? 90 : v.volume)));
        var pit = Math.max(0, Math.floor(Number(v.pitch == null ? 100 : v.pitch)));
        var pan = Math.max(-100, Math.min(100, Math.floor(Number(v.pan == null ? 0 : v.pan))));
        return name + ' (vol:' + vol + ' pitch:' + pit + ' pan:' + pan + ')';
    };

    EE.prototype.tooltipDbNameById = function(arr, id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        var nm = (arr && arr[id] && arr[id].name) ? String(arr[id].name) : '';
        if (!nm.length) nm = '(未設定)';
        return nm;
    };

    EE.prototype.tooltipVarIdText = function(id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        return ('0000' + id).slice(-4);
    };

    EE.prototype.tooltipVariableNameById = function(id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        var arr = ($dataSystem && Array.isArray($dataSystem.variables)) ? $dataSystem.variables : null;
        var nm = arr && arr[id] ? String(arr[id]) : '';
        if (!nm.length) nm = '(未設定)';
        return nm;
    };

    EE.prototype.tooltipVariableLabel = function(id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        return 'ID' + this.tooltipVarIdText(id) + ' ' + this.tooltipVariableNameById(id);
    };

    EE.prototype.tooltipOperandText = function(type, p, constIndex, varIndex) {
        type = Math.max(0, Math.floor(Number(type || 0)));
        p = Array.isArray(p) ? p : [];
        var ci = Math.max(0, Math.floor(Number(constIndex || 0)));
        var vi = Math.max(0, Math.floor(Number(varIndex == null ? constIndex : varIndex)));
        if (type === 1) {
            return this.tooltipVariableLabel(Number(p[vi] || 1));
        }
        return this.tooltipParamValueText(p[ci], 0);
    };

    EE.prototype.tooltipVariableOperationText = function(p) {
        p = Array.isArray(p) ? p : [];
        var v1 = Math.max(1, Math.floor(Number(p[0] || 1)));
        var v2 = Math.max(v1, Math.floor(Number(p[1] || v1)));
        var op = Math.max(0, Math.min(5, Math.floor(Number(p[2] || 0))));
        var operandType = Math.max(0, Math.min(4, Math.floor(Number(p[3] || 0))));
        var opSym = ['=', '+=', '-=', '*=', '/=', '%='][op];
        var left = (v1 === v2)
            ? this.tooltipVariableLabel(v1)
            : ('ID' + this.tooltipVarIdText(v1) + '〜ID' + this.tooltipVarIdText(v2));
        var right = '';
        if (operandType === 0) right = this.tooltipParamValueText(p[4], 0);
        else if (operandType === 1) right = this.tooltipVariableLabel(Number(p[4] || 1));
        else if (operandType === 2) right = '乱数(' + Math.floor(Number(p[4] || 0)) + '〜' + Math.floor(Number(p[5] || 0)) + ')';
        else if (operandType === 3) right = 'ゲームデータ(' + [p[4], p[5], p[6]].map(function(v) { return Math.floor(Number(v || 0)); }).join(',') + ')';
        else if (operandType === 4) right = 'script:' + this.tooltipShortText(p[4], 40);
        else right = this.tooltipParamsText(p.slice(4));
        return left + ' ' + opSym + ' ' + right;
    };

    EE.prototype.tooltipTransferText = function(p) {
        p = Array.isArray(p) ? p : [];
        var loc = Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0))));
        var dir = Math.floor(Number(p[4] || 0));
        var fade = Math.floor(Number(p[5] || 0));
        var dirText = { 0: '向き維持', 2: '下', 4: '左', 6: '右', 8: '上' }[dir] || ('向き' + dir);
        var fadeText = { 0: '黒', 1: '白', 2: 'なし' }[fade] || String(fade);
        var where = '';
        if (loc === 0) {
            where = 'マップ' + Math.floor(Number(p[1] || 0)) + ' (' +
                Math.floor(Number(p[2] || 0)) + ',' + Math.floor(Number(p[3] || 0)) + ')';
        } else if (loc === 1) {
            where = '変数指定 M:' + this.tooltipVariableLabel(Number(p[1] || 1)) +
                ' X:' + this.tooltipVariableLabel(Number(p[2] || 1)) +
                ' Y:' + this.tooltipVariableLabel(Number(p[3] || 1));
        } else {
            where = '現在位置';
        }
        return where + ' / 向き:' + dirText + ' / フェード:' + fadeText;
    };

    EE.prototype.tooltipSchemaFieldText = function(field, value, state) {
        if (!field) return '';
        var type = String(field.type || '');
        if (type === 'bool') return value ? 'ON' : 'OFF';
        if (type === 'select' || type === 'list') {
            var opts = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state || {}));
            var sv = String(value == null ? '' : value);
            for (var i = 0; i < opts.length; i++) {
                if (String(opts[i].value) === sv) return String(opts[i].label || sv);
            }
            return this.tooltipParamValueText(value, 0);
        }
        if (type === 'number') {
            var n = Number(value);
            if (!isFinite(n)) return String(value == null ? '' : value);
            if (field.integer) return String(Math.floor(n));
            return this.formatCoordText(n, 2, false);
        }
        if (type === 'text' || type === 'textarea') return this.tooltipShortText(value, 48);
        return this.tooltipParamValueText(value, 0);
    };

    EE.prototype.tooltipSchemaSummaryFromState = function(schema, state) {
        if (!schema || !state || typeof state !== 'object') return '';
        var fs = Array.isArray(schema.fields) ? schema.fields : [];
        if (!fs.length) return '';
        var parts = [];
        var total = 0;
        var limit = 4;
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (!f || !f.key) continue;
            if (!this.schemaFieldVisible(f, state)) continue;
            var k = String(f.key || '');
            if (!Object.prototype.hasOwnProperty.call(state, k)) continue;
            var v = state[k];
            if ((v == null || v === '') && String(f.type || '') !== 'bool') continue;
            var txt = this.tooltipSchemaFieldText(f, v, state);
            if (!txt.length) continue;
            total++;
            if (parts.length < limit) {
                var label = String(f.label || k);
                parts.push(label + ':' + txt);
            }
        }
        if (!parts.length) return '';
        if (total > parts.length) parts.push('…+' + (total - parts.length));
        return parts.join(' / ');
    };

    EE.prototype.tooltipMainSchemaSummary = function(entry, code) {
        var schema = this.getEditorSchema(code);
        if (!schema || typeof schema.fromEntry !== 'function') return '';
        var st = null;
        try { st = schema.fromEntry.call(this, entry); } catch (_) { st = null; }
        return this.tooltipSchemaSummaryFromState(schema, st);
    };

    EE.prototype.tooltipRouteSchemaSummary = function(routeCmd) {
        var schema = this.getRouteEditorSchemaForCommand(routeCmd);
        if (!schema || typeof schema.fromRouteCommand !== 'function') return '';
        var st = null;
        try { st = schema.fromRouteCommand.call(this, routeCmd, null, -1); } catch (_) { st = null; }
        return this.tooltipSchemaSummaryFromState(schema, st);
    };

    EE.prototype.tooltipParamValueText = function(v, depth) {
        depth = Math.max(0, Math.floor(Number(depth || 0)));
        if (v == null) return 'null';
        var t = typeof v;
        if (t === 'string') return this.tooltipShortText(v, depth > 0 ? 32 : 48);
        if (t === 'number') {
            if (!isFinite(v)) return String(v);
            return (Math.floor(v) === v) ? String(v) : this.formatCoordText(v, 2, false);
        }
        if (t === 'boolean') return v ? 'on' : 'off';
        if (Array.isArray(v)) {
            if (!v.length) return '[]';
            var lim = (depth > 0) ? 2 : 3;
            var out = [];
            for (var i = 0; i < v.length && i < lim; i++) out.push(this.tooltipParamValueText(v[i], depth + 1));
            if (v.length > lim) out.push('…+' + (v.length - lim));
            return '[' + out.join(', ') + ']';
        }
        if (t === 'object') {
            var audio = this.tooltipAudioParamText(v);
            if (audio) return audio;
            if (v.list && Array.isArray(v.list) && (v.wait != null || v.repeat != null || v.skippable != null)) {
                var cnt = Math.max(0, v.list.length - 1);
                return '{wait:' + (v.wait ? 'on' : 'off') +
                    ', repeat:' + (v.repeat ? 'on' : 'off') +
                    ', skip:' + (v.skippable ? 'on' : 'off') +
                    ', cmds:' + cnt + '}';
            }
            var ks = Object.keys(v);
            if (!ks.length) return '{}';
            var maxK = (depth > 0) ? 2 : 3;
            var parts = [];
            for (var ki = 0; ki < ks.length && ki < maxK; ki++) {
                var k = ks[ki];
                parts.push(k + ':' + this.tooltipParamValueText(v[k], depth + 1));
            }
            if (ks.length > maxK) parts.push('…+' + (ks.length - maxK) + 'keys');
            return '{' + parts.join(', ') + '}';
        }
        return this.tooltipShortText(v, 40);
    };

    EE.prototype.tooltipParamsText = function(params) {
        var p = Array.isArray(params) ? params : [];
        if (!p.length) return '';
        if (p.length === 1) return this.tooltipParamValueText(p[0], 0);
        var lim = 3;
        var out = [];
        for (var i = 0; i < p.length && i < lim; i++) {
            out.push('p' + (i + 1) + ':' + this.tooltipParamValueText(p[i], 0));
        }
        if (p.length > lim) out.push('…+' + (p.length - lim));
        return out.join(' / ');
    };

    EE.prototype.commandTooltipDetailText = function(entry) {
        if (!entry || !entry.command) return '';
        var code = Number(entry.command.code || 0);
        var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
        var text = '';
        if (code === 101) {
            var ml = Array.isArray(entry.messageLines) ? entry.messageLines : [];
            text = ml.join(' / ');
        } else if (code === 108) {
            this.memoApplyParsedStateToEntry(entry);
            if (entry.isMemo) text = 'メモ[' + this.memoNormalizeSize(entry.memoSize) + '] ' + this.memoNormalizeText(entry.memoText);
            else {
                var cl = Array.isArray(entry.commentLines) ? entry.commentLines : [];
                if (!cl.length) cl = [String((p[0] || ''))];
                text = cl.join(' / ');
            }
        } else if (code === 102) {
            var choices = Array.isArray(p[0]) ? p[0] : [];
            text = '選択肢: ' + this.tooltipShortText(choices.join(' / '), 90);
        } else if (code === 103) {
            text = this.tooltipVariableLabel(Number(p[0] || 1)) + ' / 桁数:' + Math.max(1, Math.floor(Number(p[1] || 1)));
        } else if (code === 104) {
            var itType = Math.max(1, Math.min(4, Math.floor(Number(p[1] || 2))));
            var itTypeText = { 1: '通常アイテム', 2: '大事なもの', 3: '隠しA', 4: '隠しB' }[itType] || String(itType);
            text = this.tooltipVariableLabel(Number(p[0] || 1)) + ' / 種別:' + itTypeText;
        } else if (code === 105) {
            var slines = Array.isArray(entry.scrollLines) ? entry.scrollLines : [];
            text = slines.join(' / ');
        } else if (code === 121) {
            var s1 = Math.max(1, Math.floor(Number(p[0] || 1)));
            var s2 = Math.max(s1, Math.floor(Number(p[1] || s1)));
            var sv = Math.floor(Number(p[2] || 0)) === 0 ? 'ON' : 'OFF';
            if (s1 === s2) text = 'ID' + this.tooltipVarIdText(s1) + ' ' + this.switchNameById(s1) + ' = ' + sv;
            else text = 'ID' + this.tooltipVarIdText(s1) + '〜ID' + this.tooltipVarIdText(s2) + ' = ' + sv;
        } else if (code === 122) {
            text = this.tooltipVariableOperationText(p);
        } else if (code === 123) {
            text = 'セルフスイッチ ' + String(p[0] || 'A') + ' = ' + (Math.floor(Number(p[1] || 0)) === 0 ? 'ON' : 'OFF');
        } else if (code === 124) {
            var tmOp = Math.floor(Number(p[0] || 0));
            text = (tmOp === 0 ? '開始' : '停止') + (tmOp === 0 ? (' ' + Math.max(0, Math.floor(Number(p[1] || 0))) + '秒') : '');
        } else if (code === 125) {
            var gOp = Math.floor(Number(p[0] || 0));
            var gVal = this.tooltipOperandText(Number(p[1] || 0), p, 2, 2);
            text = '所持金 ' + (gOp === 0 ? '+=' : '-=') + ' ' + gVal;
        } else if (code === 126 || code === 127 || code === 128) {
            var db = (code === 126) ? $dataItems : (code === 127 ? $dataWeapons : $dataArmors);
            var kind = (code === 126) ? 'アイテム' : (code === 127 ? '武器' : '防具');
            var nm = this.tooltipDbNameById(db, Number(p[0] || 0));
            var op = Math.floor(Number(p[1] || 0));
            var val = this.tooltipOperandText(Number(p[2] || 0), p, 3, 3);
            text = kind + ' ' + nm + ' ' + (op === 0 ? '+=' : '-=') + ' ' + val;
        } else if (code === 129) {
            var actorId = Math.max(1, Math.floor(Number(p[0] || 1)));
            var actorNm = this.tooltipDbNameById($dataActors, actorId);
            text = 'アクター ' + actorNm + ' (' + actorId + ') ' + (Math.floor(Number(p[1] || 0)) === 0 ? '加入' : '離脱');
        } else if (code === 201) {
            text = this.tooltipTransferText(p);
        } else if (code === 355) {
            var cam = this.cameraMoveSpecFromEntry(entry);
            if (cam) {
                text = 'x:' + this.formatCoordText(cam.x, 2, false) +
                    ' y:' + this.formatCoordText(cam.y, 2, false) +
                    ' d:' + Math.max(1, Math.floor(Number(cam.d || 1))) + 'f';
            } else {
                var anim = this.animationRequestSpecFromEntry(entry);
                if (anim) {
                    var anmName = this.tooltipDbNameById($dataAnimations, Number(anim.animationId || 1));
                    text = '対象:' + this.rowLabelForCharId(this.normalizeMoveTarget(Number(anim.targetId || 0))) +
                        ' / アニメ:' + anmName + ' (' + Math.max(1, Math.floor(Number(anim.animationId || 1) || 1)) + ')' +
                        ' / addX:' + this.formatCoordText(Number(anim.addX || 0), 2, false) +
                        ' / addY:' + this.formatCoordText(Number(anim.addY || 0), 2, false) +
                        ' / scale:' + this.formatCoordText(Number(anim.scale == null ? 1 : anim.scale), 2, false);
                } else {
                    var sl = Array.isArray(entry.scriptLines) ? entry.scriptLines : [];
                    if (!sl.length && p.length) sl = [String(p[0] || '')];
                    text = sl.join(' / ');
                }
            }
        } else if (code === 230) {
            text = Math.max(1, Math.floor(Number(p[0] || 1))) + 'フレーム';
        } else if (code === 241) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 242) {
            text = this.formatCoordText(Math.max(0, Number(p[0] || 0)), 1, false) + '秒';
        } else if (code === 245) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 246) {
            text = this.formatCoordText(Math.max(0, Number(p[0] || 0)), 1, false) + '秒';
        } else if (code === 249) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 250) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 261) {
            text = this.tooltipShortText(String(p[0] || ''), 80);
        } else if (code === 356) {
            text = String(p[0] || '');
        } else if (code === 205) {
            var target = this.rowLabelForCharId(this.normalizeMoveTarget(Number(p[0] || 0)));
            var route = (p[1] && typeof p[1] === 'object') ? p[1] : null;
            var cmds = route && Array.isArray(route.list) ? Math.max(0, route.list.length - 1) : 0;
            text = '対象:' + target + (route ? ' / 完了までウェイト:' + (route.wait ? 'ON' : 'OFF') + ' / コマンド数:' + cmds : '');
        } else {
            text = this.tooltipMainSchemaSummary(entry, code);
            if (!text.length) {
                var generic = this.tooltipParamsText(p);
                text = generic ? ('引数: ' + generic) : '';
            }
        }
        text = String(text || '').replace(/\r?\n/g, ' / ').trim();
        if (text.length > 120) text = text.slice(0, 117) + '...';
        return text;
    };

    EE.prototype.tooltipFrameEntries = function(tr, frame, hiddenByIf) {
        tr = tr || (this.model && this.model.tracks ? this.model.tracks[this.selKey] : null);
        if (!tr || !Array.isArray(tr.commands)) return [];
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        hiddenByIf = hiddenByIf || this.computeIfBranchHiddenUidMapForTrack(tr);
        var rows = this._rows || [];
        var rowOrder = Object.create(null);
        for (var i = 0; i < rows.length; i++) rowOrder[String(rows[i].key || '')] = i;
        var list = tr.commands.filter(function(e) {
            if (!e || e.isComment) return false;
            var uid = Math.floor(Number(e.uid || 0));
            if (uid > 0 && hiddenByIf[String(uid)]) return false;
            return Math.max(0, Math.floor(Number(e.frame || 0))) === frame;
        });
        list.sort(function(a, b) {
            var ra = rowOrder[String(a.rowKey || 'main')];
            var rb = rowOrder[String(b.rowKey || 'main')];
            if (ra == null) ra = 999;
            if (rb == null) rb = 999;
            if (ra !== rb) return ra - rb;
            return Math.floor(Number(a.uid || 0)) - Math.floor(Number(b.uid || 0));
        });
        return list;
    };

    EE.prototype.tooltipLinesForEntry = function(entry, indent, opt) {
        if (!entry || !entry.command) return [];
        indent = String(indent == null ? '' : indent);
        opt = opt || {};
        if (opt.excludeMoveRoute205 && Number(entry.command.code || 0) === 205) return [];
        var rowKey = String(entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main'));
        var cmdRawColor = this.commandNodeFillColorForEntry(entry, -1, rowKey);
        var cmdColor = opt.color || this.commandTextColorForEntry(entry, -1, rowKey);
        var bulletColor = opt.bulletColor || cmdRawColor;
        var detailColor = opt.detailColor || cmdColor;
        var code = this.mainCommandDisplayCodeForEntry(entry);
        var nm = this.commandNameJa(code);
        if (entry.command && Number(entry.command.code || 0) === 205) {
            nm += ' [' + this.rowLabelForCharId(this.normalizeMoveTarget(entry.charId)) + ']';
        }
        var out = [{ text: indent + '●' + nm, dim: !!opt.dim, color: cmdColor, bold: !!opt.bold, bulletWhite: true, bulletColor: bulletColor }];
        var detail = this.commandTooltipDetailText(entry);
        if (detail) out.push({
            text: indent + '　' + detail,
            dim: !!opt.dim,
            color: detailColor,
            bold: !!opt.detailBold,
            detail: !opt.detailColor
        });
        return out;
    };

    EE.prototype.resolveIfBranchTooltipContextForEntry = function(entry, tr) {
        if (!entry || !entry.command) return null;
        tr = tr || this.resolveTrackForIfBranchEntry(entry);
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return null;
        var code = Math.floor(Number(entry.command.code || 0));
        if (code === 111) {
            var direct = this.resolveIfBranchInsertionInfoByUid(Math.floor(Number(entry.uid || 0)), tr);
            if (!direct || !direct.block || !Array.isArray(direct.list)) return null;
            return {
                ifEntry: direct.ifEntry || entry,
                block: direct.block,
                list: direct.list,
                info: direct.info || this.computeIfBranchDisplayInfoForTrack(tr),
                mode: String(direct.mode || 'then'),
                startIndex: Math.max(0, Math.floor(Number(direct.startIndex || 0))),
                stopIndex: Math.max(0, Math.floor(Number(direct.stopIndex || 0))),
                endIndex: Math.max(-1, Math.floor(Number(direct.endIndex || -1))),
                tr: tr
            };
        }
        var scope = this.resolveIfBranchScopeForEntryUid(Math.floor(Number(entry.uid || 0)), tr);
        if (!scope || !scope.block || !Array.isArray(scope.list)) return null;
        var ifIdx = Math.max(0, Math.floor(Number(scope.block.ifIndex || 0)));
        var ifEntry = (ifIdx >= 0 && ifIdx < scope.list.length) ? scope.list[ifIdx] : null;
        if (!ifEntry || !ifEntry.command || Number(ifEntry.command.code || 0) !== 111) return null;
        return {
            ifEntry: ifEntry,
            block: scope.block,
            list: scope.list,
            info: scope.info || this.computeIfBranchDisplayInfoForTrack(tr),
            mode: String(scope.mode || 'then'),
            startIndex: Math.max(0, Math.floor(Number(scope.startIndex || 0))),
            stopIndex: Math.max(0, Math.floor(Number(scope.stopIndex || 0))),
            endIndex: Math.max(-1, Math.floor(Number(scope.endIndex || -1))),
            tr: tr
        };
    };

    EE.prototype.ifBranchStructuredTooltipLinesForEntry = function(entry, hit) {
        if (!entry || !entry.command) return null;
        var tr = this.resolveTrackForIfBranchEntry(entry);
        if (!tr) return null;
        var ctx = this.resolveIfBranchTooltipContextForEntry(entry, tr);
        if (!ctx || !ctx.ifEntry || !ctx.ifEntry.command || Number(ctx.ifEntry.command.code || 0) !== 111) return null;
        var yellow = 'rgba(82,154,255,.98)';
        var hiddenByIf = this.computeIfBranchHiddenUidMapForTrack(tr);
        var targetFrame = Math.max(0, Math.floor(Number((hit && hit.frame != null) ? hit.frame : entry.frame || 0)));
        var list = Array.isArray(ctx.list) ? ctx.list : [];
        var branchUidMap = Object.create(null);
        var lines = [];

        var ifTop = this.tooltipLinesForEntry(ctx.ifEntry, '', { dim: false });
        for (var i = 0; i < ifTop.length; i++) lines.push(ifTop[i]);

        var phase = (String(ctx.mode || '').toLowerCase() === 'else') ? 'else' : 'then';
        lines.push({ text: '　' + phase, color: yellow, bold: true });

        var start = Math.max(0, Math.floor(Number(ctx.startIndex || 0)));
        var stop = Math.max(start, Math.floor(Number(ctx.stopIndex || 0)));
        for (i = start; i < stop && i < list.length; i++) {
            var be = list[i];
            if (!be || !be.command) continue;
            var buid = Math.floor(Number(be.uid || 0));
            if (buid > 0) branchUidMap[String(buid)] = true;
            var bcode = Math.floor(Number(be.command.code || 0));
            if (bcode === 411 || bcode === 412) continue;
            if (buid > 0 && hiddenByIf[String(buid)]) continue;
            if (Math.max(0, Math.floor(Number(be.frame || 0))) !== targetFrame) continue;
            var inLines = this.tooltipLinesForEntry(be, '　', { dim: false, excludeMoveRoute205: false });
            for (var li = 0; li < inLines.length; li++) lines.push(inLines[li]);
        }

        lines.push({ text: '　end', color: yellow, bold: true });

        var frameEntries = this.tooltipFrameEntries(tr, targetFrame, hiddenByIf);
        for (i = 0; i < frameEntries.length; i++) {
            var fe = frameEntries[i];
            if (!fe || !fe.command) continue;
            var fuid = String(Math.floor(Number(fe.uid || 0)));
            if (Number(fe.uid || 0) === Number(ctx.ifEntry.uid || 0)) continue;
            if (branchUidMap[fuid]) continue;
            var tail = this.tooltipLinesForEntry(fe, '', { dim: false, excludeMoveRoute205: String(hit && hit.rowKey || '') === 'main' });
            for (li = 0; li < tail.length; li++) lines.push(tail[li]);
        }

        return lines;
    };

    EE.prototype.commandTooltipItemsAtFrame = function(frame, highlightUid, opt) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands) return [];
        opt = opt || {};
        var hiddenByIf = this.computeIfBranchHiddenUidMapForTrack(tr);
        var ls = this.tooltipFrameEntries(tr, frame, hiddenByIf);
        var out = [];
        for (var i = 0; i < ls.length; i++) {
            var e = ls[i];
            var dim = !!highlightUid && Number(e.uid) !== Number(highlightUid);
            var lines = this.tooltipLinesForEntry(e, '', { dim: dim, excludeMoveRoute205: !!opt.excludeMoveRoute205 });
            for (var li = 0; li < lines.length; li++) out.push(lines[li]);
        }
        return out;
    };

    EE.prototype.findEntryInSelectedTrack = function(uid) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands || !uid) return null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === uid) return tr.commands[i];
        }
        return null;
    };

    EE.prototype.routeCommandNameJa = function(code) {
        var c = Number(code || 0);
        if (!this._routeCommandNameCache) {
            this._routeCommandNameCache = {};
            var cat = this.routeCommandCatalog();
            var cols = [cat.left, cat.mid, cat.right, cat.ext];
            for (var ci = 0; ci < cols.length; ci++) {
                var list = Array.isArray(cols[ci]) ? cols[ci] : [];
                for (var li = 0; li < list.length; li++) {
                    var it = list[li];
                    var ic = Number(it && it.code || 0);
                    if (!ic || this._routeCommandNameCache[ic]) continue;
                    var nm = String(it && it.label || '').replace(/\.\.\.$/, '');
                    if (nm) this._routeCommandNameCache[ic] = nm;
                }
            }
        }
        if (this._routeCommandNameCache[c]) return String(this._routeCommandNameCache[c]);
        if (c === 0) return '移動ルート終了';
        return '移動コマンド' + c;
    };

    EE.prototype.routeCommandTooltipDetailText = function(routeCmd) {
        if (!routeCmd) return '';
        var code = Number(routeCmd.code || 0);
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        var text = '';
        if (code >= 16 && code <= 19) return '';
        if (code === 45) {
            var dcode = this.routeDisplayCodeForCommand(routeCmd);
            if (dcode >= 16 && dcode <= 19) return '';
            if (dcode === 4500) return '';
            if (dcode !== 45) {
                text = this.tooltipRouteSchemaSummary(routeCmd);
            } else {
                text = String(p[0] || '');
            }
        } else {
            text = this.tooltipRouteSchemaSummary(routeCmd);
            if (!text.length) text = this.tooltipParamsText(p);
        }
        text = String(text || '').replace(/\r?\n/g, ' / ').trim();
        if (text.length > 120) text = text.slice(0, 117) + '...';
        return text;
    };

    EE.prototype.routeTileGotoTooltipText = function(entry, listIndex, spanFrames) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return '';
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.floor(Number(listIndex == null ? -1 : listIndex));
        if (idx < 0 || idx >= list.length) return '';
        var p = this.parseRouteTileGotoCommand(list[idx]);
        if (!p) return '';
        var wf = (spanFrames == null) ? this.routeTileGotoWaitFrames(entry, idx) : Math.max(1, Math.floor(Number(spanFrames || 1)));
        return '(' + this.tileMoveCoordText(p.x) + ', ' + this.tileMoveCoordText(p.y) + ') wait:' + wf + 'f';
    };

    EE.prototype.routeCommandFromHit = function(hit) {
        if (!hit || hit.routeCmdCode == null) return null;
        var e = this.findEntryInSelectedTrack(hit.uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return null;
        var route = e.command.parameters && e.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.floor(Number(hit.routeListIndex == null ? -1 : hit.routeListIndex));
        if (idx < 0 || idx >= list.length) return null;
        var rc = list[idx];
        if (!rc || Number(rc.code || 0) <= 0) return null;
        return rc;
    };

    EE.prototype.routeTimelineItemAtFrame = function(entry, frame) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return null;
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var items = tl && Array.isArray(tl.items) ? tl.items : [];
        var baseFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var rc = it && it.command ? it.command : null;
            if (!rc) continue;
            var rawCode = Number((it && it.displayCode != null) ? it.displayCode : (rc.code || 0));
            var effectiveCode = (rawCode > 0) ? rawCode : this.routeDisplayCodeForCommand(rc);
            if (effectiveCode <= 0 || effectiveCode === 15) continue;
            var st = baseFrame + Math.max(0, Math.floor(Number(it.offset || 0)));
            var sp = Math.max(1, Math.floor(Number(it.span || 1)));
            if (frame < st || frame >= (st + sp)) continue;
            return {
                listIndex: Math.floor(Number(it.listIndex == null ? -1 : it.listIndex)),
                frame: st,
                routeCmdCode: effectiveCode
            };
        }
        return null;
    };

    EE.prototype.routeTooltipLinesFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return [];
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var list = tl.items || [];
        var out = [];
        var rowKey = String(entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main'));
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            var rc = it && it.command ? it.command : null;
            var rcode = Number((it && it.displayCode != null) ? it.displayCode : ((rc && rc.code) || 0));
            if (!rc || rcode === 0 || rcode === 15) continue;
            var routeListIndex = this.nodeRouteIndex(it.listIndex);
            var routeRawColor = this.commandNodeFillColorForEntry(entry, routeListIndex, rowKey);
            var routeColor = this.commandTextColorForEntry(entry, routeListIndex, rowKey);
            out.push({ text: '●+' + Number(it.offset || 0) + 'f ' + this.routeCommandNameJa(rcode), dim: false, color: routeColor, bulletWhite: true, bulletColor: routeRawColor });
            var detail = '';
            if (rcode === 4500) detail = this.routeTileGotoTooltipText(entry, it.listIndex, it.span);
            else detail = this.routeCommandTooltipDetailText(rc);
            if (detail) out.push({ text: '  ' + detail, dim: false, detail: true, color: routeColor });
        }
        if (!out.length) out.push({ text: '●(移動ルート内コマンドなし)', dim: false, bulletWhite: true });
        return out;
    };

    EE.prototype.commandTooltipLinesForHit = function(hit) {
        if (!hit) return [];
        if (hit.isEndMarker) {
            return [
                { text: '終了', dim: false },
                { text: 'frame: ' + Math.max(0, Math.floor(Number(hit.frame || 0))), dim: false, detail: true }
            ];
        }
        var routeOwnerLabel = '';
        var routeOwnerUid = 0;
        if (hit.routeRangeUid != null && Number(hit.routeRangeUid || 0) > 0) {
            routeOwnerUid = Number(hit.routeRangeUid || 0);
        } else if (hit.routeCmdCode != null || (hit.routeListIndex != null && Number(hit.routeListIndex) >= 0)) {
            routeOwnerUid = Number(hit.uid || 0);
        }
        if (routeOwnerUid > 0) {
            var routeOwnerEntry = this.findEntryInSelectedTrack(routeOwnerUid);
            if (routeOwnerEntry && routeOwnerEntry.command && Number(routeOwnerEntry.command.code || 0) === 205) {
                var routeOwnerCharId = (routeOwnerEntry.charId == null)
                    ? Number((((routeOwnerEntry.command || {}).parameters || [0])[0] || 0))
                    : Number(routeOwnerEntry.charId || 0);
                routeOwnerLabel = this.rowLabelForCharId(this.normalizeMoveTarget(routeOwnerCharId));
            }
        }
        if (hit.routeCmdCode != null) {
            if (Number(hit.routeCmdCode || 0) === 15) return [];
            var routeOwner = this.findEntryInSelectedTrack(hit.uid);
            var routeRowKey = routeOwner
                ? String(routeOwner.rowKey || (routeOwner.rowType === 'char' ? ('char:' + routeOwner.charId) : 'main'))
                : 'main';
            var routeColor = routeOwner
                ? this.commandTextColorForEntry(routeOwner, hit.routeListIndex, routeRowKey)
                : '';
            var routeRawColor = routeOwner
                ? this.commandNodeFillColorForEntry(routeOwner, hit.routeListIndex, routeRowKey)
                : routeColor;
            var out = [{ text: '●' + this.routeCommandNameJa(hit.routeCmdCode), dim: false, color: routeColor, bulletWhite: true, bulletColor: routeRawColor }];
            var routeCmd = this.routeCommandFromHit(hit);
            var detail = '';
            if (Number(hit.routeCmdCode || 0) === 4500) {
                var e2 = this.findEntryInSelectedTrack(hit.uid);
                detail = this.routeTileGotoTooltipText(e2, hit.routeListIndex, null);
            } else {
                detail = this.routeCommandTooltipDetailText(routeCmd);
            }
            if (detail) out.push({ text: '  ' + detail, dim: false, detail: true, color: routeColor });
            if (routeOwnerLabel) out.unshift({ text: routeOwnerLabel, dim: false });
            return out;
        }
        var e = this.findEntryInSelectedTrack(hit.uid);
        if (e && e.command) {
            var ifStructured = this.ifBranchStructuredTooltipLinesForEntry(e, hit);
            if (ifStructured && ifStructured.length) return ifStructured;
        }
        if (e && e.rowType === 'char' && e.command && Number(e.command.code || 0) === 205) {
            var routeOut = this.routeTooltipLinesFromEntry(e);
            if (!routeOwnerLabel) {
                var eCharId = (e.charId == null)
                    ? Number((((e.command || {}).parameters || [0])[0] || 0))
                    : Number(e.charId || 0);
                routeOwnerLabel = this.rowLabelForCharId(this.normalizeMoveTarget(eCharId));
            }
            if (routeOwnerLabel) routeOut.unshift({ text: routeOwnerLabel, dim: false });
            return routeOut;
        }
        return this.commandTooltipItemsAtFrame(hit.frame, hit.uid, { excludeMoveRoute205: hit.rowKey === 'main' });
    };

    EE.prototype.commentTooltipLinesAtFrame = function(frame) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands) return [];
        var ls = tr.commands.filter(function(e) {
            return !!e.isComment && Number(e.frame || 0) === Number(frame || 0);
        });
        ls.sort(function(a, b) { return a.uid - b.uid; });
        var out = [];
        for (var i = 0; i < ls.length; i++) {
            var e = ls[i];
            this.memoApplyParsedStateToEntry(e);
            if (e.isMemo) {
                out.push('メモ[' + this.memoNormalizeSize(e.memoSize) + ']');
                out.push(this.memoNormalizeText(e.memoText || ''));
            } else {
                out.push('注釈 ' + (i + 1));
                out.push((e.commentLines || ['']).join('\n'));
            }
            if (i !== ls.length - 1) out.push('');
        }
        return out;
    };

    EE.prototype.wrapCanvasTextByWidth = function(ctx, text, maxWidth) {
        text = String(text == null ? '' : text);
        maxWidth = Math.max(8, Number(maxWidth || 120));
        if (!text.length) return [''];
        var out = [];
        var cur = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (ch === '\r') continue;
            if (ch === '\n') {
                out.push(cur);
                cur = '';
                continue;
            }
            var next = cur + ch;
            if (ctx.measureText(next).width <= maxWidth || !cur.length) {
                cur = next;
            } else {
                out.push(cur);
                cur = ch;
            }
        }
        out.push(cur);
        return out;
    };

    EE.prototype.drawMemoLabelOnTimeline = function(ctx, x, y, size, text) {
        if (!ctx) return;
        text = this.memoNormalizeText(text);
        if (!text.length) return;
        size = this.memoNormalizeSize(size);
        if (size === 'S') return;
        var fontSize = (size === 'L') ? 12 : 10;
        var maxWidth = (size === 'L') ? 180 : 120;
        ctx.save();
        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        var lines = this.wrapCanvasTextByWidth(ctx, text, maxWidth);
        var lineH = fontSize + 2;
        var widest = 0;
        for (var i = 0; i < lines.length; i++) {
            widest = Math.max(widest, Math.ceil(ctx.measureText(lines[i]).width));
        }
        var padX = 4;
        var padY = 3;
        var boxW = widest + padX * 2;
        var boxH = lines.length * lineH + padY * 2;
        var bx = Math.floor(x - boxW / 2);
        var offsetY = (size === 'L') ? -40 : -20;
        var by = Math.floor(y + offsetY);
        // Allow requested offset even near the top of timeline.
        // Keep only a very loose clamp so the box can still be mostly visible.
        var minY = -boxH + 2;
        if (by < minY) by = minY;
        ctx.fillStyle = 'rgba(8,16,12,.72)';
        ctx.strokeStyle = 'rgba(70,178,98,.52)';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeRect(bx + 0.5, by + 0.5, Math.max(1, boxW - 1), Math.max(1, boxH - 1));
        ctx.fillStyle = 'rgba(214,255,220,.98)';
        for (i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx + padX, by + padY + fontSize + i * lineH);
        }
        ctx.restore();
    };

    EE.prototype.renderMemoLabelOverlay = function(items) {
        if (!this.memoLabelLayer || !this.timelineWrap || !this.timeline) return;
        items = Array.isArray(items) ? items : [];
        if (!items.length) {
            if (this.memoLabelLayer.childNodes && this.memoLabelLayer.childNodes.length) this.memoLabelLayer.innerHTML = '';
            this._memoLabelLayerSig = '';
            return;
        }
        var wrap = this.timelineWrap;
        var cv = this.timeline;
        var wr = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : null;
        var cr = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!wr || !cr) return;
        var sig = String(Math.floor(cr.left)) + '|' + String(Math.floor(wr.top)) + '|' +
            String(Math.floor(Number(wrap.scrollLeft || 0))) + '|';
        var i;
        for (i = 0; i < items.length; i++) {
            var it = items[i] || {};
            sig += [Number(it.x || 0), Number(it.y || 0), String(it.size || ''), String(it.text || '')].join(':') + '|';
        }
        if (sig === this._memoLabelLayerSig) return;
        this._memoLabelLayerSig = sig;
        this.memoLabelLayer.innerHTML = '';
        for (i = 0; i < items.length; i++) {
            var m = items[i] || {};
            var sz = this.memoNormalizeSize(m.size);
            if (sz === 'S') continue;
            var txt = this.memoNormalizeText(m.text || '');
            if (!txt.length) continue;
            var dotX = Number(m.x || 0);
            var dotY = Number(m.y || 0);
            // Keep memo labels on the sticky comment lane even when vertical scroll moves.
            var sx = cr.left + dotX;
            var sy = wr.top + dotY;
            var offsetY = (sz === 'L') ? -40 : -20;
            var b = this.el('div', 'mmlbl ' + (sz === 'L' ? 'l' : 'm'));
            b.textContent = txt;
            b.style.left = Math.floor(sx) + 'px';
            b.style.top = Math.floor(sy + offsetY) + 'px';
            b.style.transform = 'translateX(-50%)';
            this.memoLabelLayer.appendChild(b);
        }
    };

    EE.prototype.collectLargeMemoMarkersForSelectedTrack = function() {
        var out = [];
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return out;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.isComment) continue;
            this.memoApplyParsedStateToEntry(e);
            if (!e.isMemo) continue;
            if (this.memoNormalizeSize(e.memoSize) !== 'L') continue;
            out.push({
                uid: Math.floor(Number(e.uid || 0)),
                frame: Math.max(0, Math.floor(Number(e.frame || 0))),
                text: this.memoNormalizeText(e.memoText || '')
            });
        }
        out.sort(function(a, b) {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return a.uid - b.uid;
        });
        return out;
    };

    EE.prototype.refreshMemoScrollLane = function(maxFrame) {
        if (!this.memoScrollLane || !this.timelineWrap) return;
        var lane = this.memoScrollLane;
        var markers = this.collectLargeMemoMarkersForSelectedTrack();
        if (!markers.length) {
            lane.style.display = 'none';
            if (lane.childNodes && lane.childNodes.length) lane.innerHTML = '';
            this._memoScrollLaneSig = '';
            return;
        }
        var wr = this.timelineWrap.getBoundingClientRect ? this.timelineWrap.getBoundingClientRect() : null;
        if (!wr || wr.width <= 4 || wr.height <= 8) {
            lane.style.display = 'none';
            return;
        }
        var left = Math.floor(wr.left + 2);
        var top = Math.floor(wr.bottom - 10);
        var width = Math.max(8, Math.floor(wr.width - 4));
        var height = 8;
        maxFrame = Math.max(1, Math.floor(Number(maxFrame || this.maxFrame() || 1)));
        var sig = String(left) + '|' + String(top) + '|' + String(width) + '|' + String(maxFrame) + '|';
        for (var i = 0; i < markers.length; i++) {
            sig += markers[i].uid + ':' + markers[i].frame + ':' + markers[i].text + '|';
        }
        lane.style.display = 'block';
        lane.style.left = left + 'px';
        lane.style.top = top + 'px';
        lane.style.width = width + 'px';
        lane.style.height = height + 'px';
        if (sig === this._memoScrollLaneSig) return;
        this._memoScrollLaneSig = sig;
        lane.innerHTML = '';
        var self = this;
        for (i = 0; i < markers.length; i++) {
            (function(m) {
                var dot = self.el('div', 'mmdot');
                var lbl = self.el('div', 'mmdotlbl', String(m.text || ''));
                var ratio = Math.max(0, Math.min(1, Number(m.frame || 0) / maxFrame));
                var px = Math.floor(ratio * (width - 2) + 1);
                dot.style.left = px + 'px';
                dot.style.top = '4px';
                lbl.style.left = px + 'px';
                dot.addEventListener('mousedown', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                dot.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    // Reuse existing "select + smooth reveal" behavior.
                    self.focusExecutionLogTarget(Number(m.uid || 0), -1);
                });
                lane.appendChild(dot);
                lane.appendChild(lbl);
            })(markers[i]);
        }
    };

    EE.prototype.routeOptionsFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return null;
        var route = entry.command.parameters && entry.command.parameters[1];
        if (!route || typeof route !== 'object') return null;
        return route;
    };

    EE.prototype.isMoveRouteWaitEnabledEntry = function(entry) {
        var route = this.routeOptionsFromEntry(entry);
        return !!(route && route.wait);
    };

    EE.prototype.isMoveRouteWaitDisabledEntry = function(entry) {
        var route = this.routeOptionsFromEntry(entry);
        // In event data, route.wait may be omitted (undefined) which is
        // effectively OFF. Treat anything other than explicit true as wait:OFF.
        return !!(route && route.wait !== true);
    };

    EE.prototype.collectMoveRouteWaitRanges = function(tr, ignoreUid) {
        var out = [];
        if (!tr || !Array.isArray(tr.commands)) return out;
        ignoreUid = Number(ignoreUid || 0);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (ignoreUid > 0 && Number(e.uid || 0) === ignoreUid) continue;
            if (!this.isMoveRouteWaitEnabledEntry(e)) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            if (w <= 0) continue;
            out.push({
                uid: Number(e.uid || 0),
                start: s,
                end: s + w,
                charId: Number(e.charId || 0)
            });
        }
        return out;
    };

    EE.prototype.isIntervalLockedByMoveRouteWait = function(tr, frame, end, ignoreUid) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        end = Math.max(frame + 1, Math.floor(Number(end == null ? (frame + 1) : end)));
        var ranges = this.collectMoveRouteWaitRanges(tr, ignoreUid);
        for (var i = 0; i < ranges.length; i++) {
            var r = ranges[i];
            var rs = Math.max(0, Math.floor(Number(r.start || 0)));
            var re = Math.max(rs + 1, Math.floor(Number(r.end == null ? (rs + 1) : r.end)));
            // Allow placement at the route start frame (before execution),
            // but keep the interval after start locked.
            var lockStart = rs + 1;
            if (lockStart < re && frame < re && lockStart < end) return true;
        }
        return false;
    };

    EE.prototype.hasMainCommandInRange = function(tr, frame, end, ignoreUid) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        end = Math.max(frame + 1, Math.floor(Number(end == null ? (frame + 1) : end)));
        ignoreUid = Number(ignoreUid || 0);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (ignoreUid > 0 && Number(e.uid || 0) === ignoreUid) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            var ed = s + w;
            if (w > 0) {
                var ms = s + 1;
                if (ms < ed && frame < ed && ms < end) return true;
            } else {
                if (s > frame && s < end) return true;
            }
        }
        return false;
    };

    EE.prototype.canPlaceEntry = function(tr, entry, frame, rowKey, ignoreUid) {
        if (!tr || !entry) return false;
        if (entry.rowType === 'main' && rowKey !== 'main') return false;
        if (entry.rowType === 'char' && (!rowKey || rowKey.indexOf('char:') !== 0)) return false;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var end = frame + Math.max(0, Math.floor(Number(entry.wait || 0)));
        var endEx = (Math.max(0, Math.floor(Number(entry.wait || 0))) > 0) ? end : (frame + 1);
        if (rowKey === 'main' && this.isIntervalLockedByMoveRouteWait(tr, frame, endEx, ignoreUid)) return false;
        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitEnabledEntry(entry) && this.hasMainCommandInRange(tr, frame, end, ignoreUid)) return false;
        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitDisabledEntry(entry)) {
            var routeRuntimeStart = frame;
            var routeRuntimeEnd = routeRuntimeStart + this.routeExecutionSpanFramesForEntry(entry);
            for (var ri = 0; ri < tr.commands.length; ri++) {
                var re = tr.commands[ri];
                if (!re) continue;
                if (ignoreUid > 0 && Number(re.uid || 0) === ignoreUid) continue;
                if (!this.isMoveRouteWaitDisabledEntry(re)) continue;
                var rrk = re.rowKey || (re.rowType === 'char' ? ('char:' + re.charId) : 'main');
                if (String(rrk) !== rowKey) continue;
                var rs = Math.max(0, Math.floor(Number(re.frame || 0)));
                var red = rs + this.routeExecutionSpanFramesForEntry(re);
                if (routeRuntimeStart < red && rs < routeRuntimeEnd) return false;
            }
        }
        for (var i = 0; i < tr.commands.length; i++) {
            var o = tr.commands[i];
            if (!o || o.uid === ignoreUid) continue;
            var ork = o.rowKey || (o.rowType === 'char' ? ('char:' + o.charId) : 'main');
            if (ork !== rowKey) continue;
            var os = Math.max(0, Math.floor(Number(o.frame || 0)));
            var ow = Math.max(0, Math.floor(Number(o.wait || 0)));
            var oe = os + ow;
            if (entry.wait > 0) {
                if (ow > 0) {
                    if (frame < oe && os < end) return false;
                } else {
                    // Non-wait commands at the same frame can run before this wait command.
                    if (os > frame && os < end) return false;
                }
            } else {
                if (ow > 0) {
                    // Allow same-frame placement; wait command executes last on that frame.
                    if (frame > os && frame < oe) return false;
                }
            }
        }
        return true;
    };

    EE.prototype.entryConflictDebugInfo = function(e) {
        if (!e) return null;
        var cmd = e.command || {};
        var code = Math.floor(Number(cmd.code || 0));
        var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
        var info = {
            uid: Math.floor(Number(e.uid || 0)),
            eventId: Math.floor(Number(e.eventId || 0)),
            pageIndex: Math.floor(Number(e.pageIndex || 0)),
            rowType: String(e.rowType || ''),
            rowKey: String(e.rowKey || ''),
            charId: (e.charId == null) ? null : Math.floor(Number(e.charId || 0)),
            frame: Math.max(0, Math.floor(Number(e.frame || 0))),
            wait: Math.max(0, Math.floor(Number(e.wait || 0))),
            code: code,
            commandName: (typeof this.commandNameJa === 'function') ? String(this.commandNameJa(code) || '') : ''
        };
        if (code === 205) {
            var route = p[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            info.route = {
                targetId: Math.floor(Number(p[0] || 0)),
                wait: !!(route && route.wait),
                repeat: !!(route && route.repeat),
                skippable: !!(route && route.skippable),
                listLength: list.length
            };
        }
        return info;
    };

    EE.prototype.collectCanPlaceEntryConflicts = function(tr, entry, frame, rowKey, ignoreUid) {
        var out = {
            ok: true,
            reasons: [],
            blockers: [],
            overlap: {
                attemptStart: 0,
                attemptEnd: 0,
                attemptEndExclusive: 0
            }
        };
        if (!tr || !entry) {
            out.ok = false;
            out.reasons.push('invalid_input');
            return out;
        }
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        rowKey = String(rowKey || '');
        ignoreUid = Math.floor(Number(ignoreUid || 0));
        var wait = Math.max(0, Math.floor(Number(entry.wait || 0)));
        var end = frame + wait;
        var endEx = (wait > 0) ? end : (frame + 1);
        out.overlap.attemptStart = frame;
        out.overlap.attemptEnd = end;
        out.overlap.attemptEndExclusive = endEx;

        if (entry.rowType === 'main' && rowKey !== 'main') {
            out.ok = false;
            out.reasons.push('row_type_main_mismatch');
        }
        if (entry.rowType === 'char' && (!rowKey || rowKey.indexOf('char:') !== 0)) {
            out.ok = false;
            out.reasons.push('row_type_char_mismatch');
        }

        if (rowKey === 'main') {
            var ranges = this.collectMoveRouteWaitRanges(tr, ignoreUid);
            for (var i = 0; i < ranges.length; i++) {
                var rg = ranges[i];
                var rs = Math.max(0, Math.floor(Number(rg.start || 0)));
                var re = Math.max(rs + 1, Math.floor(Number(rg.end == null ? (rs + 1) : rg.end)));
                var lockStart = rs + 1;
                if (!(lockStart < re && frame < re && lockStart < endEx)) continue;
                out.ok = false;
                out.reasons.push('locked_by_route_wait');
                var be = this.findEntryInSelectedTrack(Number(rg.uid || 0));
                out.blockers.push({
                    type: 'route_wait_lock',
                    lockStart: lockStart,
                    lockEnd: re,
                    charId: Math.floor(Number(rg.charId || 0)),
                    blocker: this.entryConflictDebugInfo(be)
                });
            }
        }

        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitEnabledEntry(entry)) {
            for (var j = 0; j < tr.commands.length; j++) {
                var mc = tr.commands[j];
                if (!mc) continue;
                if (ignoreUid > 0 && Number(mc.uid || 0) === ignoreUid) continue;
                var mrk = mc.rowKey || (mc.rowType === 'char' ? ('char:' + mc.charId) : 'main');
                if (mrk !== 'main') continue;
                var ms = Math.max(0, Math.floor(Number(mc.frame || 0)));
                var mw = Math.max(0, Math.floor(Number(mc.wait || 0)));
                var med = ms + mw;
                var hit = false;
                if (mw > 0) {
                    var mws = ms + 1;
                    if (mws < med && frame < med && mws < end) hit = true;
                } else {
                    if (ms > frame && ms < end) hit = true;
                }
                if (!hit) continue;
                out.ok = false;
                out.reasons.push('route_wait_hits_main');
                out.blockers.push({
                    type: 'main_command_overlap_with_route_wait',
                    overlapStart: frame,
                    overlapEnd: end,
                    blocker: this.entryConflictDebugInfo(mc)
                });
            }
        }

        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitDisabledEntry(entry)) {
            var runStart = frame;
            var runEnd = runStart + this.routeExecutionSpanFramesForEntry(entry);
            for (j = 0; j < tr.commands.length; j++) {
                var rc = tr.commands[j];
                if (!rc) continue;
                if (ignoreUid > 0 && Number(rc.uid || 0) === ignoreUid) continue;
                if (!this.isMoveRouteWaitDisabledEntry(rc)) continue;
                var rrk = rc.rowKey || (rc.rowType === 'char' ? ('char:' + rc.charId) : 'main');
                if (String(rrk) !== rowKey) continue;
                var rcs = Math.max(0, Math.floor(Number(rc.frame || 0)));
                var rce = rcs + this.routeExecutionSpanFramesForEntry(rc);
                if (!(runStart < rce && rcs < runEnd)) continue;
                out.ok = false;
                out.reasons.push('same_char_route_wait_false_overlap');
                out.blockers.push({
                    type: 'same_char_route_wait_false_overlap',
                    overlapStart: Math.max(runStart, rcs),
                    overlapEnd: Math.min(runEnd, rce),
                    blockerRangeStart: rcs,
                    blockerRangeEnd: rce,
                    blocker: this.entryConflictDebugInfo(rc)
                });
            }
        }

        for (var k = 0; k < tr.commands.length; k++) {
            var o = tr.commands[k];
            if (!o) continue;
            if (ignoreUid > 0 && Number(o.uid || 0) === ignoreUid) continue;
            var ork = o.rowKey || (o.rowType === 'char' ? ('char:' + o.charId) : 'main');
            if (String(ork) !== rowKey) continue;
            var os = Math.max(0, Math.floor(Number(o.frame || 0)));
            var ow = Math.max(0, Math.floor(Number(o.wait || 0)));
            var oe = os + ow;
            var collide = false;
            var ctype = '';
            if (wait > 0) {
                if (ow > 0) {
                    if (frame < oe && os < end) {
                        collide = true;
                        ctype = 'same_row_wait_vs_wait';
                    }
                } else if (os > frame && os < end) {
                    collide = true;
                    ctype = 'same_row_wait_vs_instant';
                }
            } else if (ow > 0) {
                if (frame > os && frame < oe) {
                    collide = true;
                    ctype = 'same_row_instant_inside_wait';
                }
            }
            if (!collide) continue;
            out.ok = false;
            out.reasons.push(ctype);
            out.blockers.push({
                type: ctype,
                blockerRangeStart: os,
                blockerRangeEnd: oe,
                blocker: this.entryConflictDebugInfo(o)
            });
        }

        if (out.ok) return out;
        var uniq = Object.create(null);
        var compactReasons = [];
        for (var ri = 0; ri < out.reasons.length; ri++) {
            var rk2 = String(out.reasons[ri] || '');
            if (!rk2 || uniq[rk2]) continue;
            uniq[rk2] = true;
            compactReasons.push(rk2);
        }
        out.reasons = compactReasons;
        return out;
    };

    EE.prototype.logDropConflictDetail = function(tr, entry, frame, rowKey, ignoreUid, context) {
        var payload = {
            tag: 'drop_conflict',
            context: String(context || ''),
            mapId: ($gameMap && typeof $gameMap.mapId === 'function') ? Math.floor(Number($gameMap.mapId() || 0)) : 0,
            selected: {
                selEid: Math.floor(Number(this.selEid || 0)),
                selPage: Math.floor(Number(this.selPage == null ? -1 : this.selPage)),
                selKey: String(this.selKey || ''),
                selUid: Math.floor(Number(this.selUid || 0)),
                selRouteListIndex: this.nodeRouteIndex(this.selRouteListIndex),
                frame: Math.max(0, Math.floor(Number(this.frame || 0)))
            },
            attempt: {
                frame: Math.max(0, Math.floor(Number(frame || 0))),
                rowKey: String(rowKey || ''),
                ignoreUid: Math.floor(Number(ignoreUid || 0)),
                entry: this.entryConflictDebugInfo(entry)
            },
            track: {
                eventId: Math.floor(Number(tr && tr.eventId || 0)),
                pageIndex: Math.floor(Number(tr && tr.pageIndex || 0)),
                commandCount: Array.isArray(tr && tr.commands) ? tr.commands.length : 0
            }
        };
        payload.conflict = this.collectCanPlaceEntryConflicts(tr, entry, frame, rowKey, ignoreUid);
        try {
            console.log('[EE_DROP_CONFLICT] ' + JSON.stringify(payload));
        } catch (_) {
            try { console.log('[EE_DROP_CONFLICT]', payload); } catch (_) {}
        }
    };

    EE.prototype.buildMainLaneMap = function(tr, hiddenByIf) {
        var laneByUid = {};
        var maxStack = 1;
        if (!tr || !tr.commands) return { laneByUid: laneByUid, maxStack: maxStack };
        hiddenByIf = hiddenByIf || this.computeIfBranchHiddenUidMapForTrack(tr);
        var byFrame = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (hiddenByIf[String(Math.floor(Number(e.uid || 0)))]) continue;
            // Comments are drawn in a separate marker lane, so they must not
            // consume main command stack slots.
            if (e.isComment || (e.command && Number(e.command.code || 0) === 108)) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (!byFrame[f]) byFrame[f] = [];
            byFrame[f].push(e);
        }
        var frames = Object.keys(byFrame).map(function(v) { return Number(v); }).sort(function(a, b) { return a - b; });
        for (var j = 0; j < frames.length; j++) {
            var ls = byFrame[frames[j]];
            ls.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
            for (var k = 0; k < ls.length; k++) laneByUid[ls[k].uid] = k;
            if (ls.length > maxStack) maxStack = ls.length;
        }
        return { laneByUid: laneByUid, maxStack: Math.max(1, maxStack) };
    };

    EE.prototype.timelineCircleScale = function() {
        return 1.3;
    };

    EE.prototype.scaleTimelineCircleRadius = function(radius) {
        radius = Math.max(0, Number(radius || 0));
        return radius * this.timelineCircleScale();
    };

    EE.prototype.timelineCircleOverlayDecision = function(x, y, radius, labelRight, rulerBottom, options) {
        var r = this.scaleTimelineCircleRadius(radius);
        x = Number(x || 0);
        y = Number(y || 0);
        labelRight = Number(labelRight || 0);
        rulerBottom = Number(rulerBottom || 0);
        options = options || {};
        var forceVisible = !!options.forceVisible;
        var overlapLeft = (x - r) < labelRight;
        var overlapTop = (y - r) < rulerBottom;
        var overlap = overlapLeft || overlapTop;
        // More than half overlapped with either cover area => hide.
        var hide = overlap && !forceVisible && (x < labelRight || y < rulerBottom);
        return { overlap: overlap, hide: hide, radius: r };
    };

    EE.prototype.rectIntersectionArea = function(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
        var ix1 = Math.max(Number(ax1 || 0), Number(bx1 || 0));
        var iy1 = Math.max(Number(ay1 || 0), Number(by1 || 0));
        var ix2 = Math.min(Number(ax2 || 0), Number(bx2 || 0));
        var iy2 = Math.min(Number(ay2 || 0), Number(by2 || 0));
        var iw = Math.max(0, ix2 - ix1);
        var ih = Math.max(0, iy2 - iy1);
        return iw * ih;
    };

    EE.prototype.ifBranchShapeOverlayDecision = function(shape, overlayRule) {
        if (!shape || !overlayRule) return { overlap: false, hide: false, clips: [] };
        var bd = this.ifBranchHighlightShapeBounds(shape);
        if (!bd) return { overlap: false, hide: false, clips: [] };
        var x1 = Number(bd.x1 || 0);
        var y1 = Number(bd.y1 || 0);
        var x2 = Number(bd.x2 || 0);
        var y2 = Number(bd.y2 || 0);
        var area = Math.max(1, Number(bd.area || ((x2 - x1) * (y2 - y1))) || 1);

        var leftRect = {
            x1: Number(overlayRule.labelLeft || 0),
            y1: 0,
            x2: Number(overlayRule.labelRight || 0),
            y2: Number(overlayRule.totalHeight || 0)
        };
        var topRect = {
            x1: 0,
            y1: Number(overlayRule.rulerTop || 0),
            x2: Number(overlayRule.totalWidth || 0),
            y2: Number(overlayRule.rulerBottom || 0)
        };

        var areaLeft = this.rectIntersectionArea(x1, y1, x2, y2, leftRect.x1, leftRect.y1, leftRect.x2, leftRect.y2);
        var areaTop = this.rectIntersectionArea(x1, y1, x2, y2, topRect.x1, topRect.y1, topRect.x2, topRect.y2);
        var areaBoth = this.rectIntersectionArea(
            x1, y1, x2, y2,
            Math.max(leftRect.x1, topRect.x1),
            Math.max(leftRect.y1, topRect.y1),
            Math.min(leftRect.x2, topRect.x2),
            Math.min(leftRect.y2, topRect.y2)
        );
        var overlapArea = Math.max(0, areaLeft + areaTop - areaBoth);
        var overlap = overlapArea > 0;
        var hide = overlap && overlapArea >= area * 0.5;

        var clips = [];
        if (overlap && !hide) {
            if (areaLeft > 0) clips.push({ x: leftRect.x1, y: leftRect.y1, w: Math.max(0, leftRect.x2 - leftRect.x1), h: Math.max(0, leftRect.y2 - leftRect.y1) });
            if (areaTop > 0) clips.push({ x: topRect.x1, y: topRect.y1, w: Math.max(0, topRect.x2 - topRect.x1), h: Math.max(0, topRect.y2 - topRect.y1) });
        }
        return { overlap: overlap, hide: hide, clips: clips };
    };

    EE.prototype.fillCircleWithBlackOutline = function(ctx, x, y, radius, options) {
        if (!ctx) return;
        var xNum = Number(x || 0);
        var yNum = Number(y || 0);
        var radiusRaw = Math.max(0, Number(radius || 0));
        options = options || {};
        var decision = null;
        var overlayRule = this._timelineCircleOverlayRule;
        if (overlayRule && overlayRule.active) {
            decision = this.timelineCircleOverlayDecision(
                xNum, yNum, radiusRaw,
                Number(overlayRule.labelRight || 0),
                Number(overlayRule.rulerBottom || 0),
                { forceVisible: !!options.forceVisible }
            );
            if (decision.hide) return;
        }
        var radiusScaled = decision ? decision.radius : this.scaleTimelineCircleRadius(radiusRaw);
        ctx.beginPath();
        ctx.arc(xNum, yNum, radiusScaled, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.98)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (decision && decision.overlap && overlayRule && Array.isArray(overlayRule.queue)) {
            overlayRule.queue.push({
                x: xNum,
                y: yNum,
                radius: radiusScaled,
                fillStyle: ctx.fillStyle
            });
        }
    };

    EE.prototype.fillRoundedRect = function(ctx, x, y, w, h, r) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        r = Math.max(0, Math.min(Number(r || 0), w * 0.5, h * 0.5));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.fill();
    };

    EE.prototype.pathHandleRect = function(ctx, x, y, w, h, r, roundLeft, roundRight) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        r = Math.max(0, Math.min(Number(r || 0), w * 0.5, h * 0.5));
        var rl = roundLeft ? r : 0;
        var rr = roundRight ? r : 0;
        ctx.beginPath();
        ctx.moveTo(x + rl, y);
        ctx.lineTo(x + w - rr, y);
        if (rr > 0) ctx.arcTo(x + w, y, x + w, y + rr, rr);
        else ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - rr);
        if (rr > 0) ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
        else ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + rl, y + h);
        if (rl > 0) ctx.arcTo(x, y + h, x, y + h - rl, rl);
        else ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + rl);
        if (rl > 0) ctx.arcTo(x, y, x + rl, y, rl);
        else ctx.lineTo(x, y);
        ctx.closePath();
    };

    EE.prototype.fillHandleRect = function(ctx, x, y, w, h, r, roundLeft, roundRight) {
        this.pathHandleRect(ctx, x, y, w, h, r, roundLeft, roundRight);
        ctx.fill();
    };

    EE.prototype.timelineWaitBarHeight = function(nodeRadiusRaw) {
        var circleR = this.scaleTimelineCircleRadius(Math.max(1, Number(nodeRadiusRaw || 4)));
        // Slightly thinner than the node diameter.
        var h = circleR * 2 - this.scaleTimelineCircleRadius(1);
        return Math.max(2, Math.min(h, this.rowH * 0.72));
    };

    EE.prototype.drawTimelineWaitStem = function(ctx, fromX, toX, centerY, color, nodeRadiusRaw) {
        if (!ctx) return;
        var x1 = Number(fromX || 0);
        var x2 = Number(toX || 0);
        var y = Number(centerY || 0);
        var toRight = (x2 >= x1);
        var tailShrink = this.scaleTimelineCircleRadius(Math.max(1, Number(nodeRadiusRaw || 4)));
        // Shorten the tail side by one node radius.
        x2 = toRight ? (x2 - tailShrink) : (x2 + tailShrink);
        var w = Math.abs(x2 - x1);
        if (w < 1) return;
        var left = Math.min(x1, x2);
        var h = this.timelineWaitBarHeight(nodeRadiusRaw);
        var top = y - h * 0.5;
        var rr = Math.max(1, Math.min(h * 0.5, w * 0.5));
        ctx.fillStyle = String(color || 'rgba(114,205,255,.95)');
        // Start side (node side) is square, tail side is rounded.
        this.fillHandleRect(ctx, left, top, w, h, rr, !toRight, !!toRight);
    };

    EE.prototype.pathRoundRectCorners = function(ctx, x, y, w, h, tl, tr, br, bl) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        var maxR = Math.max(0, Math.min(w * 0.5, h * 0.5));
        tl = Math.max(0, Math.min(maxR, Number(tl || 0)));
        tr = Math.max(0, Math.min(maxR, Number(tr || 0)));
        br = Math.max(0, Math.min(maxR, Number(br || 0)));
        bl = Math.max(0, Math.min(maxR, Number(bl || 0)));
        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        if (tr > 0) ctx.arcTo(x + w, y, x + w, y + tr, tr);
        else ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - br);
        if (br > 0) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
        else ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + bl, y + h);
        if (bl > 0) ctx.arcTo(x, y + h, x, y + h - bl, bl);
        else ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + tl);
        if (tl > 0) ctx.arcTo(x, y, x + tl, y, tl);
        else ctx.lineTo(x, y);
        ctx.closePath();
    };

    EE.prototype.fillRoundRectCorners = function(ctx, x, y, w, h, tl, tr, br, bl) {
        this.pathRoundRectCorners(ctx, x, y, w, h, tl, tr, br, bl);
        ctx.fill();
    };

    EE.prototype.strokeHandleRect = function(ctx, x, y, w, h, r, roundLeft, roundRight) {
        this.pathHandleRect(ctx, x, y, w, h, r, roundLeft, roundRight);
        ctx.stroke();
    };

    EE.prototype.strokeRoundedRect = function(ctx, x, y, w, h, r) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        r = Math.max(0, Math.min(Number(r || 0), w * 0.5, h * 0.5));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        ctx.stroke();
    };

    EE.prototype.commandNodePointForEntry = function(entry, rowMap, rmets) {
        if (!entry || !rowMap || !rmets) return null;
        var rk = entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main');
        var ri = rowMap[rk];
        if (ri == null) return null;
        var met = rmets[ri] || { top: this.rulerH + ri * this.rowH, height: this.rowH, center: this.rulerH + ri * this.rowH + Math.floor(this.rowH / 2) };
        var y = met.center;
        if (rk === 'main') {
            var lane = this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(entry.uid) ? this._mainLaneByUid[entry.uid] : 0;
            y = met.top + this.mainLaneTop + lane * this.mainLaneGap;
        }
        return {
            x: this.frameToX(Math.max(0, Math.floor(Number(entry.frame || 0)))),
            y: Math.floor(Number(y || 0))
        };
    };

    EE.prototype.ifBranchHighlightFillColorForDepth = function(depth) {
        depth = Math.max(0, Math.floor(Number(depth || 0)));
        var factor = Math.pow(0.88, depth);
        var r = Math.max(24, Math.min(255, Math.round(82 * factor)));
        var g = Math.max(24, Math.min(255, Math.round(154 * factor)));
        var b = Math.max(16, Math.min(255, Math.round(255 * factor)));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    };

    EE.prototype.choiceBranchHighlightFillColorForDepth = function(depth) {
        depth = Math.max(0, Math.floor(Number(depth || 0)));
        var factor = Math.pow(0.90, depth);
        var r = Math.max(36, Math.min(255, Math.round(255 * factor)));
        var g = Math.max(20, Math.min(255, Math.round(108 * factor)));
        var b = Math.max(44, Math.min(255, Math.round(188 * factor)));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    };

    EE.prototype.ifBranchHighlightRadiusForEntry = function(entry) {
        if (!entry || !entry.command) return this.scaleTimelineCircleRadius(4);
        var code = Math.floor(Number(entry.command.code || 0));
        if (code === 111) return this.scaleTimelineCircleRadius(4);
        if (entry.isComment || code === 108) {
            this.memoApplyParsedStateToEntry(entry);
            var memoSize = entry.isMemo ? this.memoNormalizeSize(entry.memoSize) : 'S';
            return this.scaleTimelineCircleRadius(this.memoCircleRadiusForSize(memoSize));
        }
        return this.scaleTimelineCircleRadius(4);
    };

    EE.prototype.ifBranchHighlightEndXForEntry = function(entry, fallbackX) {
        var x = Number(fallbackX || 0);
        if (!entry) return x;
        var baseFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        var span = Math.max(0, Math.floor(Number(entry.wait || 0)));
        if (entry.command && Number(entry.command.code || 0) === 205) {
            span = Math.max(span, Math.max(1, this.routeExecutionSpanFramesForEntry(entry)));
        }
        if (span > 1) {
            var ex = this.frameToX(baseFrame + span);
            if (isFinite(ex)) x = Math.max(x, Number(ex));
        }
        return x;
    };

    EE.prototype.ifBranchHighlightShapeBounds = function(shape) {
        if (!shape) return null;
        if (Array.isArray(shape.segments) && shape.segments.length) {
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            var area = 0;
            for (var i = 0; i < shape.segments.length; i++) {
                var sg = shape.segments[i];
                if (!sg) continue;
                var x = Number(sg.x || 0);
                var y = Number(sg.y || 0);
                var w = Math.max(0, Number(sg.w || 0));
                var h = Math.max(0, Number(sg.h || 0));
                if (w <= 0 || h <= 0) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + w);
                maxY = Math.max(maxY, y + h);
                area += w * h;
            }
            if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
            return { x1: minX, y1: minY, x2: maxX, y2: maxY, area: Math.max(1, area) };
        }
        var x1 = Number(shape.x || 0);
        var y1 = Number(shape.y || 0);
        var x2 = x1 + Math.max(0, Number(shape.w || 0));
        var y2 = y1 + Math.max(0, Number(shape.h || 0));
        return { x1: x1, y1: y1, x2: x2, y2: y2, area: Math.max(1, (x2 - x1) * (y2 - y1)) };
    };

    EE.prototype.drawIfBranchHighlightShape = function(ctx, shape) {
        if (!ctx || !shape) return;
        if (Array.isArray(shape.segments) && shape.segments.length) {
            for (var i = 0; i < shape.segments.length; i++) {
                var sg = shape.segments[i];
                if (!sg) continue;
                var x = Number(sg.x || 0);
                var y = Number(sg.y || 0);
                var w = Math.max(0, Number(sg.w || 0));
                var h = Math.max(0, Number(sg.h || 0));
                if (w <= 0 || h <= 0) continue;
                if (sg.kind === 'rect') {
                    ctx.fillRect(x, y, w, h);
                    continue;
                }
                if (sg.kind === 'cornerRect') {
                    this.fillRoundRectCorners(
                        ctx,
                        x,
                        y,
                        w,
                        h,
                        Math.max(0, Number(sg.tl || 0)),
                        Math.max(0, Number(sg.tr || 0)),
                        Math.max(0, Number(sg.br || 0)),
                        Math.max(0, Number(sg.bl || 0))
                    );
                    continue;
                }
                this.fillHandleRect(
                    ctx,
                    x,
                    y,
                    w,
                    h,
                    Math.max(0, Number(sg.r || 0)),
                    !!sg.roundLeft,
                    !!sg.roundRight
                );
            }
            return;
        }
        this.fillRoundedRect(
            ctx,
            Number(shape.x || 0),
            Number(shape.y || 0),
            Math.max(0, Number(shape.w || 0)),
            Math.max(0, Number(shape.h || 0)),
            Math.max(0, Number(shape.r || 0))
        );
    };

    EE.prototype.collectIfBranchHighlightShapes = function(tr, rowMap, rmets, hiddenByIf) {
        var out = [];
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return out;
        var view = this.computeIfBranchViewStateForTrack(tr);
        var highlights = view.highlights || Object.create(null);
        var info = view.info || {};
        var allList = Array.isArray(info.list) ? info.list : [];
        hiddenByIf = hiddenByIf || view.hidden || Object.create(null);

        var addPoint = function(box, x, y, r) {
            box.minX = Math.min(box.minX, x - r);
            box.maxX = Math.max(box.maxX, x + r);
            box.minY = Math.min(box.minY, y - r);
            box.maxY = Math.max(box.maxY, y + r);
        };

        var keys = Object.keys(highlights);
        for (var i = 0; i < keys.length; i++) {
            var hk = String(keys[i] || '');
            if (!hk.length) continue;
            var hctx = highlights[hk];
            if (!hctx) continue;
            var b = hctx.block || null;
            var startEntry = hctx.start || null;
            if (!startEntry || !startEntry.command || Number(startEntry.command.code || 0) !== 111) continue;
            var startUid = String(Math.floor(Number(startEntry.uid || 0)));
            if (hiddenByIf[startUid]) continue;

            var box = {
                minX: Infinity,
                maxX: -Infinity,
                minY: Infinity,
                maxY: -Infinity
            };

            var startPt = this.commandNodePointForEntry(startEntry, rowMap, rmets);
            if (!startPt) continue;
            var startRadius = this.ifBranchHighlightRadiusForEntry(startEntry);
            addPoint(box, Number(startPt.x || 0), Number(startPt.y || 0), startRadius);

            var endEntry = null;
            var endIdx = Math.floor(Number((b && b.endIndex) || -1));
            if (endIdx >= 0 && endIdx < allList.length) {
                var endCand = allList[endIdx];
                if (endCand && endCand.command && Number(endCand.command.code || 0) === 412) endEntry = endCand;
            }

            var members = Array.isArray(hctx.entries) ? hctx.entries : [];
            var seen = Object.create(null);
            var lastMember = null;
            for (var li = 0; li < members.length; li++) {
                var e = members[li];
                if (!e || !e.command) continue;
                var euid = Math.floor(Number(e.uid || 0));
                if (euid > 0) {
                    if (seen[euid]) continue;
                    seen[euid] = true;
                }
                var code = Math.floor(Number(e.command.code || 0));
                if (code === 411 || code === 412) continue;
                var uid = String(euid);
                if (hiddenByIf[uid]) continue;
                var pt = this.commandNodePointForEntry(e, rowMap, rmets);
                if (!pt) continue;
                var px = Number(pt.x || 0);
                var py = Number(pt.y || 0);
                addPoint(box, px, py, this.ifBranchHighlightRadiusForEntry(e));
                if (code === 205) {
                    var span = Math.max(1, this.routeExecutionSpanFramesForEntry(e));
                    var ex = this.frameToX(Math.max(0, Math.floor(Number(e.frame || 0))) + span);
                    var rr = this.scaleTimelineCircleRadius(4);
                    addPoint(box, Number(ex || px), py, rr);
                }
                if (!lastMember || compareEntriesByFrameWaitUid(e, lastMember) > 0) lastMember = e;
            }
            if (!endEntry) endEntry = lastMember || startEntry;
            var endPt = this.commandNodePointForEntry(endEntry, rowMap, rmets) || startPt;
            var endX = this.ifBranchHighlightEndXForEntry(endEntry, Number(endPt.x || 0));
            var endRadius = this.ifBranchHighlightRadiusForEntry(endEntry);
            addPoint(box, endX, Number(endPt.y || 0), endRadius);

            if (!isFinite(box.minX) || !isFinite(box.maxX) || !isFinite(box.minY) || !isFinite(box.maxY)) continue;
            var pad = this.scaleTimelineCircleRadius(2);
            var yTop = Math.floor(box.minY - pad);
            var yBottom = Math.ceil(box.maxY + pad);
            var sxL = Math.floor(Number(startPt.x || 0) - startRadius - pad);
            var sxR = Math.ceil(Number(startPt.x || 0) + startRadius + pad);
            var exL = Math.floor(endX - endRadius - pad);
            var exR = Math.ceil(endX + endRadius + pad);
            var startTop = Math.max(yTop, Math.min(yBottom, Math.floor(Number(startPt.y || 0) - startRadius - pad)));
            var endBottom = Math.max(yTop, Math.min(yBottom, Math.ceil(Number(endPt.y || 0) + endRadius + pad)));
            var capR = Math.max(this.scaleTimelineCircleRadius(1.6), Math.min((sxR - sxL) * 0.49, (yBottom - yTop) * 0.49));

            var fillStyle = this.ifBranchHighlightFillColorForDepth(Math.floor(Number((b && b.indent) || 0)));
            var segments = [];
            if (sxR < exL) {
                var bodyW = Math.max(1, exL - sxR);
                var bodyH = Math.max(1, yBottom - yTop);
                var bodyCornerR = Math.max(
                    this.scaleTimelineCircleRadius(1.0),
                    Math.min(capR, Math.min(bodyW, bodyH) * 0.45)
                );
                var topAlignedWithStart = Math.abs(Number(yTop || 0) - Number(startTop || 0)) <= 0.5;
                var bottomAlignedWithEnd = Math.abs(Number(yBottom || 0) - Number(endBottom || 0)) <= 0.5;
                var bodyTl = topAlignedWithStart ? 0 : bodyCornerR;
                var bodyBr = bottomAlignedWithEnd ? 0 : bodyCornerR;
                segments.push({
                    kind: 'handle',
                    x: sxL,
                    y: startTop,
                    w: Math.max(1, sxR - sxL),
                    h: Math.max(1, yBottom - startTop),
                    r: capR,
                    roundLeft: true,
                    roundRight: false
                });
                segments.push({
                    kind: 'cornerRect',
                    x: sxR,
                    y: yTop,
                    w: bodyW,
                    h: bodyH,
                    tl: bodyTl,
                    tr: 0,
                    br: bodyBr,
                    bl: 0
                });
                segments.push({
                    kind: 'handle',
                    x: exL,
                    y: yTop,
                    w: Math.max(1, exR - exL),
                    h: Math.max(1, endBottom - yTop),
                    r: capR,
                    roundLeft: false,
                    roundRight: true
                });
            } else {
                var x = Math.floor(Math.min(sxL, exL, box.minX - pad));
                var y = Math.floor(Math.min(startTop, yTop));
                var w = Math.max(2, Math.ceil(Math.max(sxR, exR, box.maxX + pad) - x));
                var h = Math.max(2, Math.ceil(Math.max(yBottom, endBottom) - y));
                var r = Math.max(this.scaleTimelineCircleRadius(2.2), Math.min(w, h) * 0.46);
                segments.push({ kind: 'roundRect', x: x, y: y, w: w, h: h, r: r, roundLeft: true, roundRight: true });
            }

            var area = 0;
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var si = 0; si < segments.length; si++) {
                var sg = segments[si];
                if (!sg) continue;
                var sw = Math.max(0, Number(sg.w || 0));
                var sh = Math.max(0, Number(sg.h || 0));
                if (sw <= 0 || sh <= 0) continue;
                var sx = Number(sg.x || 0);
                var sy = Number(sg.y || 0);
                minX = Math.min(minX, sx);
                minY = Math.min(minY, sy);
                maxX = Math.max(maxX, sx + sw);
                maxY = Math.max(maxY, sy + sh);
                area += sw * sh;
            }
            if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) continue;
            out.push({
                kind: 'branchStep',
                x: minX,
                y: minY,
                w: Math.max(1, maxX - minX),
                h: Math.max(1, maxY - minY),
                area: Math.max(1, area),
                segments: segments,
                fillStyle: fillStyle
            });
        }
        return out;
    };

    EE.prototype.choiceBranchActiveRangeForBlock = function(tr, info, block, modeMap) {
        if (!block) return null;
        info = info || {};
        var list = Array.isArray(info.list) ? info.list : [];
        if (!list.length) return null;
        var choiceIndex = Math.max(0, Math.floor(Number(block.choiceIndex || 0)));
        var endIndex = Math.floor(Number(block.endIndex || -1));
        if (endIndex < 0 || endIndex > list.length) endIndex = list.length;
        var selected = this.choiceBranchEffectiveResultForBlock(tr, info, block, modeMap);
        var branches = Array.isArray(block.branches) ? block.branches : [];
        var selectedBranch = null;
        for (var i = 0; i < branches.length; i++) {
            var br = branches[i];
            if (!br) continue;
            if (selected === -1) {
                if (String(br.type || '') === 'cancel') {
                    selectedBranch = br;
                    break;
                }
                continue;
            }
            if (String(br.type || '') !== 'choice') continue;
            if (Math.floor(Number(br.choiceIndex || -1)) !== Math.floor(Number(selected || 0))) continue;
            selectedBranch = br;
            break;
        }
        var startIndex = choiceIndex + 1;
        var stopIndex = startIndex;
        if (selectedBranch) {
            startIndex = Math.max(0, Math.floor(Number(selectedBranch.startIndex || startIndex)));
            var brEnd = Math.floor(Number(selectedBranch.endIndex == null ? endIndex : selectedBranch.endIndex));
            if (brEnd < 0 || brEnd > list.length) brEnd = endIndex;
            stopIndex = Math.max(startIndex, brEnd);
        }
        startIndex = Math.max(0, Math.min(list.length, startIndex));
        stopIndex = Math.max(startIndex, Math.min(list.length, stopIndex));
        var endIndexInclusive = Math.max(startIndex - 1, Math.min(list.length - 1, Math.max(0, endIndex - 1)));
        return {
            selected: selected,
            choiceIndex: choiceIndex,
            endIndex: endIndex,
            endIndexInclusive: endIndexInclusive,
            startIndex: startIndex,
            stopIndex: stopIndex
        };
    };

    EE.prototype.collectChoiceBranchHighlightShapes = function(tr, rowMap, rmets, hiddenByIf) {
        var out = [];
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return out;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var allList = Array.isArray(info.list) ? info.list : [];
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        if (!allList.length || !blocks.length) return out;
        hiddenByIf = hiddenByIf || this.computeIfBranchHiddenUidMapForTrack(tr);
        var modeMap = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);

        var addPoint = function(box, x, y, r) {
            box.minX = Math.min(box.minX, x - r);
            box.maxX = Math.max(box.maxX, x + r);
            box.minY = Math.min(box.minY, y - r);
            box.maxY = Math.max(box.maxY, y + r);
        };

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var choiceIndex = Math.floor(Number(b.choiceIndex || -1));
            if (choiceIndex < 0 || choiceIndex >= allList.length) continue;
            var startEntry = allList[choiceIndex];
            if (!startEntry || !startEntry.command || Number(startEntry.command.code || 0) !== 102) continue;
            var startUid = String(Math.floor(Number(startEntry.uid || 0)));
            if (hiddenByIf[startUid]) continue;
            var range = this.choiceBranchActiveRangeForBlock(tr, info, b, modeMap);
            if (!range) continue;

            var box = {
                minX: Infinity,
                maxX: -Infinity,
                minY: Infinity,
                maxY: -Infinity
            };
            var startPt = this.commandNodePointForEntry(startEntry, rowMap, rmets);
            if (!startPt) continue;
            var startRadius = this.ifBranchHighlightRadiusForEntry(startEntry);
            addPoint(box, Number(startPt.x || 0), Number(startPt.y || 0), startRadius);

            var endEntry = null;
            var endIdx = Math.floor(Number((b && b.endIndex) || -1));
            if (endIdx >= 0 && endIdx < allList.length) {
                var endCand = allList[endIdx];
                if (endCand && endCand.command && Number(endCand.command.code || 0) === 404) endEntry = endCand;
            }

            var lastMember = null;
            for (var li = range.startIndex; li < range.stopIndex; li++) {
                var e = allList[li];
                if (!e || !e.command) continue;
                var code = Math.floor(Number(e.command.code || 0));
                if (code === 402 || code === 403 || code === 404) continue;
                var uidNum = Math.floor(Number(e.uid || 0));
                if (uidNum > 0 && hiddenByIf[String(uidNum)]) continue;
                var pt = this.commandNodePointForEntry(e, rowMap, rmets);
                if (!pt) continue;
                var px = Number(pt.x || 0);
                var py = Number(pt.y || 0);
                addPoint(box, px, py, this.ifBranchHighlightRadiusForEntry(e));
                if (code === 205) {
                    var span = Math.max(1, this.routeExecutionSpanFramesForEntry(e));
                    var ex = this.frameToX(Math.max(0, Math.floor(Number(e.frame || 0))) + span);
                    var rr = this.scaleTimelineCircleRadius(4);
                    addPoint(box, Number(ex || px), py, rr);
                }
                if (!lastMember || compareEntriesByFrameWaitUid(e, lastMember) > 0) lastMember = e;
            }
            if (!endEntry) endEntry = lastMember || startEntry;
            var endPt = this.commandNodePointForEntry(endEntry, rowMap, rmets) || startPt;
            var endX = this.ifBranchHighlightEndXForEntry(endEntry, Number(endPt.x || 0));
            var endRadius = this.ifBranchHighlightRadiusForEntry(endEntry);
            addPoint(box, endX, Number(endPt.y || 0), endRadius);

            if (!isFinite(box.minX) || !isFinite(box.maxX) || !isFinite(box.minY) || !isFinite(box.maxY)) continue;
            var pad = this.scaleTimelineCircleRadius(2);
            var yTop = Math.floor(box.minY - pad);
            var yBottom = Math.ceil(box.maxY + pad);
            var sxL = Math.floor(Number(startPt.x || 0) - startRadius - pad);
            var sxR = Math.ceil(Number(startPt.x || 0) + startRadius + pad);
            var exL = Math.floor(endX - endRadius - pad);
            var exR = Math.ceil(endX + endRadius + pad);
            var startTop = Math.max(yTop, Math.min(yBottom, Math.floor(Number(startPt.y || 0) - startRadius - pad)));
            var endBottom = Math.max(yTop, Math.min(yBottom, Math.ceil(Number(endPt.y || 0) + endRadius + pad)));
            var capR = Math.max(this.scaleTimelineCircleRadius(1.6), Math.min((sxR - sxL) * 0.49, (yBottom - yTop) * 0.49));

            var fillStyle = this.choiceBranchHighlightFillColorForDepth(Math.floor(Number((b && b.indent) || 0)));
            var segments = [];
            if (sxR < exL) {
                var bodyW = Math.max(1, exL - sxR);
                var bodyH = Math.max(1, yBottom - yTop);
                var bodyCornerR = Math.max(
                    this.scaleTimelineCircleRadius(1.0),
                    Math.min(capR, Math.min(bodyW, bodyH) * 0.45)
                );
                var topAlignedWithStart = Math.abs(Number(yTop || 0) - Number(startTop || 0)) <= 0.5;
                var bottomAlignedWithEnd = Math.abs(Number(yBottom || 0) - Number(endBottom || 0)) <= 0.5;
                var bodyTl = topAlignedWithStart ? 0 : bodyCornerR;
                var bodyBr = bottomAlignedWithEnd ? 0 : bodyCornerR;
                segments.push({
                    kind: 'handle',
                    x: sxL,
                    y: startTop,
                    w: Math.max(1, sxR - sxL),
                    h: Math.max(1, yBottom - startTop),
                    r: capR,
                    roundLeft: true,
                    roundRight: false
                });
                segments.push({
                    kind: 'cornerRect',
                    x: sxR,
                    y: yTop,
                    w: bodyW,
                    h: bodyH,
                    tl: bodyTl,
                    tr: 0,
                    br: bodyBr,
                    bl: 0
                });
                segments.push({
                    kind: 'handle',
                    x: exL,
                    y: yTop,
                    w: Math.max(1, exR - exL),
                    h: Math.max(1, endBottom - yTop),
                    r: capR,
                    roundLeft: false,
                    roundRight: true
                });
            } else {
                var x = Math.floor(Math.min(sxL, exL, box.minX - pad));
                var y = Math.floor(Math.min(startTop, yTop));
                var w = Math.max(2, Math.ceil(Math.max(sxR, exR, box.maxX + pad) - x));
                var h = Math.max(2, Math.ceil(Math.max(yBottom, endBottom) - y));
                var r = Math.max(this.scaleTimelineCircleRadius(2.2), Math.min(w, h) * 0.46);
                segments.push({ kind: 'roundRect', x: x, y: y, w: w, h: h, r: r, roundLeft: true, roundRight: true });
            }

            var area = 0;
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var si = 0; si < segments.length; si++) {
                var sg = segments[si];
                if (!sg) continue;
                var sw = Math.max(0, Number(sg.w || 0));
                var sh = Math.max(0, Number(sg.h || 0));
                if (sw <= 0 || sh <= 0) continue;
                var sx = Number(sg.x || 0);
                var sy = Number(sg.y || 0);
                minX = Math.min(minX, sx);
                minY = Math.min(minY, sy);
                maxX = Math.max(maxX, sx + sw);
                maxY = Math.max(maxY, sy + sh);
                area += sw * sh;
            }
            if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) continue;
            out.push({
                kind: 'branchStep',
                x: minX,
                y: minY,
                w: Math.max(1, maxX - minX),
                h: Math.max(1, maxY - minY),
                area: Math.max(1, area),
                segments: segments,
                fillStyle: fillStyle
            });
        }
        return out;
    };

    EE.prototype.drawIfBranchHighlightShapes = function(ctx, shapes) {
        if (!ctx || !Array.isArray(shapes) || !shapes.length) return;
        var overlayRule = this._timelineIfBranchOverlayRule;
        for (var i = 0; i < shapes.length; i++) {
            var s = shapes[i];
            if (!s) continue;
            var decision = null;
            if (overlayRule && overlayRule.active) {
                decision = this.ifBranchShapeOverlayDecision(s, overlayRule);
                if (decision.hide) continue;
            }
            ctx.fillStyle = String(s.fillStyle || 'rgb(82,154,255)');
            this.drawIfBranchHighlightShape(ctx, s);
            if (decision && decision.overlap && overlayRule && Array.isArray(overlayRule.queue) && decision.clips.length) {
                overlayRule.queue.push({
                    shape: clone(s),
                    clips: decision.clips
                });
            }
        }
    };

    EE.prototype.drawIfBranchHighlightShapesFront = function(ctx, queue) {
        if (!ctx || !Array.isArray(queue) || !queue.length) return;
        for (var i = 0; i < queue.length; i++) {
            var q = queue[i];
            if (!q || !q.shape || !Array.isArray(q.clips)) continue;
            var s = q.shape;
            for (var ci = 0; ci < q.clips.length; ci++) {
                var clip = q.clips[ci];
                if (!clip) continue;
                var cw = Math.max(0, Number(clip.w || 0));
                var ch = Math.max(0, Number(clip.h || 0));
                if (cw <= 0 || ch <= 0) continue;
                ctx.save();
                ctx.beginPath();
                ctx.rect(Number(clip.x || 0), Number(clip.y || 0), cw, ch);
                ctx.clip();
                ctx.fillStyle = String(s.fillStyle || 'rgb(82,154,255)');
                this.drawIfBranchHighlightShape(ctx, s);
                ctx.restore();
            }
        }
    };

    EE.prototype.drawSelectedCommandOrderButtons = function(ctx, rowMap, rmets) {
        if (!ctx) return;
        if (!this.selUid || this.nodeRouteIndex(this.selRouteListIndex) >= 0) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var info = this.sameFrameCommandMoveInfo(this.selUid);
        if (!info.show) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var entry = this.findEntryInSelectedTrack(this.selUid);
        if (!entry) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var pt = this.commandNodePointForEntry(entry, rowMap, rmets);
        if (!pt) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var bw = 16;
        var bh = 11;
        var gap = 2;
        var x = Math.floor(pt.x + 10);
        if (this.orderButtonAnchorEntry !== entry) {
            this.orderButtonAnchorEntry = entry;
            this.orderButtonAnchorY = Math.floor(Number(pt.y || 0));
        }
        var anchorY = Math.floor(Number(this.orderButtonAnchorY || pt.y || 0));
        var yTop = Math.floor(anchorY - (bh * 2 + gap) * 0.5);
        x = Math.max(this.labelW + 2, Math.min(Math.max(this.labelW + 2, this.tw - bw - 2), x));
        var self = this;
        var drawBtn = function(dir, y, enabled) {
            var x1 = x;
            var y1 = y;
            var x2 = x1 + bw;
            var y2 = y1 + bh;
            ctx.fillStyle = enabled ? 'rgba(54,132,225,.95)' : 'rgba(52,58,68,.72)';
            self.fillRoundedRect(ctx, x1, y1, bw, bh, 3);
            ctx.strokeStyle = enabled ? 'rgba(202,230,255,.92)' : 'rgba(128,140,156,.62)';
            ctx.lineWidth = 1;
            self.strokeRoundedRect(ctx, x1 + 0.5, y1 + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1), 3);
            ctx.fillStyle = enabled ? 'rgba(245,251,255,.98)' : 'rgba(166,178,194,.74)';
            var cx = x1 + Math.floor(bw / 2);
            var cy = y1 + Math.floor(bh / 2);
            ctx.beginPath();
            if (dir === 'prev') {
                ctx.moveTo(cx, cy - 3);
                ctx.lineTo(cx - 4, cy + 2);
                ctx.lineTo(cx + 4, cy + 2);
            } else {
                ctx.moveTo(cx, cy + 3);
                ctx.lineTo(cx - 4, cy - 2);
                ctx.lineTo(cx + 4, cy - 2);
            }
            ctx.closePath();
            ctx.fill();
            self.hitOrderButtons.push({
                uid: Math.floor(Number(entry.uid || 0)),
                dir: dir,
                enabled: !!enabled,
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2
            });
        };
        drawBtn('prev', yTop, !!info.canPrev);
        drawBtn('next', yTop + bh + gap, !!info.canNext);
    };

    EE.prototype.drawSelectedIfBranchModeButtons = function(ctx, rowMap, rmets) {
        if (!ctx) return;
        if (!this.selUid || this.nodeRouteIndex(this.selRouteListIndex) >= 0) return;
        var entry = this.findEntryInSelectedTrack(this.selUid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 111) return;
        if (typeof this.isTimelineEntryVisibleByIfBranchMode === 'function' &&
            !this.isTimelineEntryVisibleByIfBranchMode(entry, this.model && this.model.tracks ? this.model.tracks[this.selKey] : null)) {
            return;
        }
        var pt = this.commandNodePointForEntry(entry, rowMap, rmets);
        if (!pt) return;
        var nodeOverlayRule = this._timelineIfBranchButtonOverlayRule;
        if (nodeOverlayRule && nodeOverlayRule.active) {
            var nodeDecision = this.timelineCircleOverlayDecision(
                Number(pt.x || 0),
                Number(pt.y || 0),
                4,
                Number(nodeOverlayRule.labelRight || 0),
                Number(nodeOverlayRule.rulerBottom || 0),
                { forceVisible: Number(entry && entry.command && entry.command.code || 0) === 111 && Math.max(0, Math.floor(Number(entry.frame || 0))) === 0 }
            );
            if (nodeDecision && nodeDecision.hide) return;
        }
        var mode = this.getIfBranchViewModeForEntry(entry);
        var defs = [
            { mode: 'auto', label: 'auto' },
            { mode: 'then', label: 'then' },
            { mode: 'else', label: 'else' }
        ];
        ctx.save();
        var scale = 1.4;
        ctx.font = Math.max(9, Math.round(9 * scale)) + 'px sans-serif';
        var h = Math.max(13, Math.round(13 * scale));
        var gap = Math.max(2, Math.round(2 * scale));
        var padX = Math.max(4, Math.round(4 * scale));
        var minW = Math.max(18, Math.round(18 * scale));
        var corner = Math.max(3, Math.round(3 * scale));
        var widths = [];
        var maxW = 0;
        for (var i = 0; i < defs.length; i++) {
            var w = Math.max(minW, Math.ceil(ctx.measureText(String(defs[i].label || '')).width) + padX * 2);
            widths.push(w);
            if (w > maxW) maxW = w;
        }
        var totalH = defs.length * h + Math.max(0, defs.length - 1) * gap;
        var x = Math.floor(Number(pt.x || 0) - Math.round(10 * scale) - maxW);
        var y = Math.floor(Number(pt.y || 0) - totalH * 0.5);
        // Keep buttons on the left side of the branch node even at frame 0.
        x = Math.max(2, x);
        y = Math.max(this.rulerH + 1, Math.min(Math.max(this.rulerH + 1, this.th - totalH - 2), y));
        for (i = 0; i < defs.length; i++) {
            var d = defs[i];
            var w2 = maxW;
            var selected = (mode === d.mode);
            ctx.fillStyle = selected ? 'rgba(54,132,225,.97)' : 'rgba(54,62,72,.82)';
            this.fillRoundedRect(ctx, x, y, w2, h, corner);
            ctx.strokeStyle = selected ? 'rgba(202,230,255,.95)' : 'rgba(144,158,176,.70)';
            ctx.lineWidth = 1;
            this.strokeRoundedRect(ctx, x + 0.5, y + 0.5, Math.max(1, w2 - 1), Math.max(1, h - 1), corner);
            ctx.fillStyle = selected ? 'rgba(233,244,255,.98)' : 'rgba(232,238,248,.92)';
            ctx.fillText(String(d.label || ''), x + padX, y + Math.floor(h * 0.72));
            this.hitIfBranchButtons.push({
                uid: Math.floor(Number(entry.uid || 0)),
                mode: String(d.mode || 'then'),
                x1: x,
                y1: y,
                x2: x + w2,
                y2: y + h
            });
            y += h + gap;
        }
        ctx.restore();
    };

    EE.prototype.fitTimelineRangeLabel = function(ctx, text, maxPx) {
        if (!ctx) return '';
        text = String(text == null ? '' : text);
        if (!text) return '';
        maxPx = Math.max(0, Math.floor(Number(maxPx || 0)));
        if (maxPx <= 0) return '';
        if (ctx.measureText(text).width <= maxPx) return text;
        var first = text.charAt(0);
        if (!first) return '';
        if (ctx.measureText(first).width > maxPx) return '';
        var ell = '...';
        if (ctx.measureText(first + ell).width > maxPx) return first;
        var lo = 1, hi = text.length, best = first;
        while (lo <= hi) {
            var mid = Math.floor((lo + hi) / 2);
            if (mid >= text.length) {
                hi = mid - 1;
                continue;
            }
            var cand = text.slice(0, mid) + ell;
            if (ctx.measureText(cand).width <= maxPx) {
                best = cand;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best;
    };

    EE.prototype.drawFixedLabelColumn = function(ctx, rows, rmets, selectedRowKey, scrollLeft, totalHeight) {
        if (!ctx) return;
        rows = Array.isArray(rows) ? rows : [];
        rmets = Array.isArray(rmets) ? rmets : [];
        var fx = Math.max(0, Math.floor(Number(scrollLeft || 0)));
        var h = Math.max(1, Math.floor(Number(totalHeight || 1)));
        ctx.save();
        ctx.fillStyle = 'rgba(8,14,20,.98)';
        ctx.fillRect(fx, 0, this.labelW, h);
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.moveTo(fx + this.labelW + .5, 0);
        ctx.lineTo(fx + this.labelW + .5, h);
        ctx.stroke();
        for (var i = 0; i < rows.length; i++) {
            var mt = rmets[i] || { top: this.rulerH + i * this.rowH, height: this.rowH };
            var y = mt.top;
            var isSelRow = (rows[i] && rows[i].key === selectedRowKey);
            if (isSelRow) {
                ctx.fillStyle = 'rgba(146,102,68,.20)';
                ctx.fillRect(fx, y, this.labelW, mt.height);
                ctx.strokeStyle = 'rgba(186,136,98,.52)';
                ctx.strokeRect(fx + .5, y + .5, this.labelW - 1, Math.max(1, mt.height - 1));
            }
            ctx.strokeStyle = 'rgba(255,255,255,.14)';
            ctx.beginPath();
            ctx.moveTo(fx, y + .5);
            ctx.lineTo(fx + this.labelW, y + .5);
            ctx.stroke();
            ctx.font = isSelRow ? 'bold 11px sans-serif' : '11px sans-serif';
            ctx.fillStyle = isSelRow ? 'rgba(232,214,196,.98)' : 'rgba(220,230,240,.88)';
            ctx.fillText(rows[i].label, fx + 8, y + 17);
        }
        var lastY = this.rulerH;
        if (rmets.length) {
            var lm = rmets[rmets.length - 1];
            lastY = lm.top + lm.height;
        } else {
            lastY = this.rulerH + rows.length * this.rowH;
        }
        ctx.strokeStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath();
        ctx.moveTo(fx, lastY + .5);
        ctx.lineTo(fx + this.labelW, lastY + .5);
        ctx.stroke();
        ctx.restore();
    };

    EE.prototype.drawStickyTimelineRuler = function(ctx, maxF, fixedLabelX, totalWidth, totalHeight) {
        if (!ctx) return;
        totalWidth = Math.max(1, Math.floor(Number(totalWidth || 1)));
        totalHeight = Math.max(1, Math.floor(Number(totalHeight || 1)));
        var rulerY = this.timelineRulerTopY(totalHeight);
        var fx = Math.max(0, Math.floor(Number(fixedLabelX || 0)));
        var labelRight = fx + this.labelW;
        var visiblePx = this.visibleTimelinePixelRange(totalWidth);
        var visibleLeft = Math.max(labelRight, visiblePx.left - 1);
        var visibleRight = Math.min(totalWidth, visiblePx.right + 1);

        ctx.save();
        ctx.fillStyle = 'rgba(8,14,20,.98)';
        ctx.fillRect(fx, rulerY, this.labelW, this.rulerH);
        ctx.fillStyle = 'rgba(8,14,20,.95)';
        ctx.fillRect(labelRight, rulerY, Math.max(1, totalWidth - labelRight), this.rulerH);

        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.moveTo(labelRight + .5, rulerY);
        ctx.lineTo(labelRight + .5, rulerY + this.rulerH);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.moveTo(fx, rulerY + this.rulerH + .5);
        ctx.lineTo(totalWidth, rulerY + this.rulerH + .5);
        ctx.stroke();

        var pxPerFrame = Math.max(1 / 4096, Number(this.pxPerFrame || this.minPxPerFrame || 1));
        var step = Math.max(1, this.niceFrameStep(80 / pxPerFrame));
        var minorDiv = 6;
        var frameStart = Math.max(0, this.xToFrame(visibleLeft) - step);
        var frameEnd = Math.min(maxF, this.xToFrame(visibleRight) + step);
        var majorStart = Math.floor(frameStart / step) * step;
        for (var ms = majorStart; ms <= frameEnd; ms += step) {
            for (var md = 1; md < minorDiv; md++) {
                var mf = ms + step * (md / minorDiv);
                if (mf > frameEnd || mf > maxF) break;
                if (mf < frameStart) continue;
                var mx = this.frameToX(mf) + .5;
                if (mx < visibleLeft || mx > visibleRight) continue;
                ctx.strokeStyle = 'rgba(255,255,255,.10)';
                ctx.beginPath();
                ctx.moveTo(mx, rulerY + this.rulerH - 5);
                ctx.lineTo(mx, rulerY + this.rulerH);
                ctx.stroke();
            }
        }

        ctx.font = '10px sans-serif';
        for (var f = majorStart; f <= frameEnd; f += step) {
            if (f < frameStart || f > maxF) continue;
            var x = this.frameToX(f) + .5;
            if (x < visibleLeft || x > visibleRight) continue;
            ctx.strokeStyle = 'rgba(255,255,255,.20)';
            ctx.beginPath();
            ctx.moveTo(x, rulerY + this.rulerH - 8);
            ctx.lineTo(x, rulerY + this.rulerH);
            ctx.stroke();
            ctx.fillStyle = 'rgba(230,236,243,.88)';
            ctx.fillText(String(f), x + 2, rulerY + 11);
        }

        if (Number(this.hoverFrame) >= 0) {
            var hf = Math.max(0, Math.floor(Number(this.hoverFrame || 0)));
            var hx = this.frameToX(hf) + .5;
            var ht = String(hf) + 'f';
            ctx.font = 'bold 10px sans-serif';
            var hw = Math.ceil(ctx.measureText(ht).width) + 8;
            var hxBox = Math.max(labelRight + 1, Math.min(Math.floor(hx - hw / 2), totalWidth - hw - 1));
            var hyBox = rulerY + 2;
            ctx.fillStyle = 'rgba(0,0,0,.78)';
            ctx.fillRect(hxBox, hyBox, hw, 12);
            ctx.strokeStyle = 'rgba(210,230,255,.85)';
            ctx.strokeRect(hxBox + .5, hyBox + .5, hw - 1, 11);
            ctx.fillStyle = 'rgba(240,248,255,.98)';
            ctx.fillText(ht, hxBox + 4, hyBox + 9);
            ctx.strokeStyle = 'rgba(210,230,255,.55)';
            ctx.beginPath();
            ctx.moveTo(hx, rulerY);
            ctx.lineTo(hx, rulerY + this.rulerH);
            ctx.stroke();
        }

        var px = this.frameToX(this.frame);
        ctx.strokeStyle = 'rgba(100,255,175,.95)';
        ctx.beginPath();
        ctx.moveTo(px + .5, rulerY);
        ctx.lineTo(px + .5, rulerY + this.rulerH);
        ctx.stroke();
        ctx.restore();
    };

    EE.prototype.drawTimeline = function() {
        if (!this.timelineDirty) return;
        this.timelineDirty = false;
        var pulseNow = Date.now();
        var pulseActive = this.pruneExecutionPulses(pulseNow);
        var maxF = this.maxFrame();
        this.syncTimelineSize(maxF);
        var c = this.timeline.getContext('2d'), w = this.tw, h = this.th;
        var fixedLabelX = this.timelineWrap ? Math.max(0, Math.floor(Number(this.timelineWrap.scrollLeft || 0))) : 0;
        var fixedLabelRight = fixedLabelX + this.labelW;
        var stickyRulerTop = this.timelineRulerTopY(h);
        var stickyRulerBottom = stickyRulerTop + this.rulerH;
        var circleFrontQueue = [];
        var ifBranchFrontQueue = [];
        this._timelineCircleOverlayRule = {
            active: true,
            labelRight: fixedLabelRight,
            rulerBottom: stickyRulerBottom,
            queue: circleFrontQueue
        };
        this._timelineIfBranchButtonOverlayRule = {
            active: true,
            labelRight: fixedLabelRight,
            rulerBottom: stickyRulerBottom
        };
        this._timelineIfBranchOverlayRule = {
            active: true,
            labelLeft: fixedLabelX,
            labelRight: fixedLabelRight,
            rulerTop: stickyRulerTop,
            rulerBottom: stickyRulerBottom,
            totalWidth: w,
            totalHeight: h,
            queue: ifBranchFrontQueue
        };
        c.clearRect(0, 0, w, h);
        c.fillStyle = 'rgba(4,10,16,.95)';
        c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(8,14,20,.95)';
        c.fillRect(0, 0, this.labelW, h);
        c.fillStyle = 'rgba(8,14,20,.95)';
        c.fillRect(this.labelW, 0, w - this.labelW, this.rulerH);

        c.strokeStyle = 'rgba(255,255,255,.18)';
        c.beginPath();
        c.moveTo(this.labelW + .5, 0);
        c.lineTo(this.labelW + .5, h);
        c.stroke();

        var pxPerFrame = Math.max(1 / 4096, Number(this.pxPerFrame || this.minPxPerFrame || 1));
        var step = Math.max(1, this.niceFrameStep(80 / pxPerFrame));
        var visibleFrames = this.visibleTimelineFrameRange(maxF, step, w);
        var gridFrameStart = visibleFrames.start;
        var gridFrameEnd = visibleFrames.end;
        var gridMajorStart = Math.floor(gridFrameStart / step) * step;
        var minorDiv = 6;
        for (var ms = gridMajorStart; ms <= gridFrameEnd; ms += step) {
            for (var md = 1; md < minorDiv; md++) {
                var mf = ms + step * (md / minorDiv);
                if (mf > gridFrameEnd || mf > maxF) break;
                if (mf < gridFrameStart) continue;
                var mx = this.frameToX(mf) + .5;
                c.strokeStyle = 'rgba(255,255,255,.07)';
                c.beginPath();
                c.moveTo(mx, this.rulerH);
                c.lineTo(mx, h);
                c.stroke();
            }
        }
        c.font = '10px sans-serif';
        for (var f = gridMajorStart; f <= gridFrameEnd; f += step) {
            if (f < gridFrameStart || f > maxF) continue;
            var x = this.frameToX(f) + .5;
            c.strokeStyle = 'rgba(255,255,255,.14)';
            c.beginPath();
            c.moveTo(x, this.rulerH);
            c.lineTo(x, h);
            c.stroke();
            c.fillStyle = 'rgba(230,236,243,.75)';
            c.fillText(String(f), x + 2, 11);
        }
        if (Number(this.hoverFrame) >= 0) {
            var hf = Math.max(0, Math.floor(Number(this.hoverFrame || 0)));
            var hx = this.frameToX(hf) + .5;
            var ht = String(hf) + 'f';
            c.font = 'bold 10px sans-serif';
            var hw = Math.ceil(c.measureText(ht).width) + 8;
            var hxBox = Math.max(fixedLabelX + this.labelW + 1, Math.min(Math.floor(hx - hw / 2), w - hw - 1));
            var hyBox = 2;
            c.fillStyle = 'rgba(0,0,0,.78)';
            c.fillRect(hxBox, hyBox, hw, 12);
            c.strokeStyle = 'rgba(210,230,255,.85)';
            c.strokeRect(hxBox + .5, hyBox + .5, hw - 1, 11);
            c.fillStyle = 'rgba(240,248,255,.98)';
            c.fillText(ht, hxBox + 4, hyBox + 9);
            c.strokeStyle = 'rgba(210,230,255,.55)';
            c.beginPath();
            c.moveTo(hx, 0);
            c.lineTo(hx, this.rulerH);
            c.stroke();
        }

        var tr = this.model.tracks[this.selKey];
        var rows = this._rows || [{ key: 'main', label: 'Main' }];
        var rmets = this._rowMetrics || [];
        var hideCircles = !!this.hideTimelineCircles;
        var hideHandles = !!this.hideRouteHandles;
        var selectedRowKey = (this.panelSelectedCharId == null)
            ? 'main'
            : ('char:' + this.normalizeMoveTarget(Number(this.panelSelectedCharId || 0)));
        var hiddenByIf = tr ? this.computeIfBranchHiddenUidMapForTrack(tr) : Object.create(null);
        var laneInfo = this.buildMainLaneMap(tr, hiddenByIf);
        this._mainLaneByUid = laneInfo.laneByUid || {};
        this._mainStackMax = laneInfo.maxStack || this._mainStackMax || 1;
        var rowMap = {};
        for (var i = 0; i < rows.length; i++) {
            rowMap[rows[i].key] = i;
            var mt = rmets[i] || { top: this.rulerH + i * this.rowH, height: this.rowH };
            var y = mt.top;
            var isSelRow = (rows[i] && rows[i].key === selectedRowKey);
            if (isSelRow) {
                c.fillStyle = 'rgba(146,102,68,.14)';
                c.fillRect(this.labelW, y, w - this.labelW, mt.height);
                c.fillStyle = 'rgba(146,102,68,.20)';
                c.fillRect(0, y, this.labelW, mt.height);
                c.strokeStyle = 'rgba(186,136,98,.52)';
                c.strokeRect(.5, y + .5, this.labelW - 1, Math.max(1, mt.height - 1));
            }
            c.strokeStyle = 'rgba(255,255,255,.14)';
            c.beginPath();
            c.moveTo(0, y + .5);
            c.lineTo(w, y + .5);
            c.stroke();
            c.font = isSelRow ? 'bold 11px sans-serif' : '11px sans-serif';
            c.fillStyle = isSelRow ? 'rgba(232,214,196,.98)' : 'rgba(220,230,240,.88)';
            c.fillText(rows[i].label, 8, y + 17);
        }
        var lastY = this.rulerH;
        if (rmets.length) {
            var lm = rmets[rmets.length - 1];
            lastY = lm.top + lm.height;
        } else {
            lastY = this.rulerH + rows.length * this.rowH;
        }
        c.strokeStyle = 'rgba(255,255,255,.14)';
        c.beginPath();
        c.moveTo(0, lastY + .5);
        c.lineTo(w, lastY + .5);
        c.stroke();
        if (tr) {
            var shadeEndFrame = this.normalizeTrackEndFrame(tr);
            var shadeX = Math.max(this.labelW, Math.floor(this.frameToX(shadeEndFrame)) + 1);
            var visiblePx = this.visibleTimelinePixelRange(w);
            var shadeVisibleLeft = Math.max(this.labelW, visiblePx.left);
            var shadeVisibleRight = Math.max(shadeVisibleLeft, visiblePx.right);
            var shadeDrawX = Math.max(shadeX, shadeVisibleLeft);
            var shadeY = this.rulerH;
            var shadeH = Math.max(1, lastY - shadeY);
            var shadeW = Math.max(0, shadeVisibleRight - shadeDrawX);
            if (shadeW > 0 && shadeH > 0) {
                c.save();
                c.beginPath();
                c.rect(shadeDrawX, shadeY, shadeW, shadeH);
                c.clip();
                c.fillStyle = 'rgba(120,120,120,.10)';
                c.fillRect(shadeDrawX, shadeY, shadeW, shadeH);
                c.strokeStyle = 'rgba(190,190,190,.24)';
                c.lineWidth = 1;
                var hatchStep = 10;
                var hatchStart = Math.floor(shadeDrawX - shadeH);
                var hatchEnd = Math.ceil(shadeDrawX + shadeW + shadeH);
                for (var hxi = hatchStart; hxi <= hatchEnd; hxi += hatchStep) {
                    c.beginPath();
                    c.moveTo(hxi, shadeY + shadeH);
                    c.lineTo(hxi + shadeH, shadeY);
                    c.stroke();
                }
                c.restore();
                c.strokeStyle = 'rgba(200,200,200,.44)';
                c.beginPath();
                c.moveTo(shadeDrawX + .5, shadeY);
                c.lineTo(shadeDrawX + .5, shadeY + shadeH);
                c.stroke();
            }
        }

        if (tr && tr.commands) {
            var overlayFrameStart = Math.max(0, gridFrameStart - step);
            var overlayFrameEnd = Math.min(maxF + 1, gridFrameEnd + step);
            var ranges = this.collectMoveRouteWaitRanges(tr, 0);
            var overlayTop = this.rulerH;
            var overlayBottom = Math.max(overlayTop + 1, lastY);
            var overlayHeight = Math.max(1, overlayBottom - overlayTop);
            for (var wr = 0; wr < ranges.length; wr++) {
                var rg = ranges[wr];
                if (hiddenByIf[String(Math.floor(Number(rg && rg.uid || 0)))]) continue;
                var rs = Math.max(overlayFrameStart, Math.floor(Number(rg.start || 0)));
                var re = Math.min(overlayFrameEnd, Math.floor(Number(rg.end || 0)));
                if (re <= rs) continue;
                var sxr = this.frameToX(rs);
                var exr = this.frameToX(re);
                var bxr = Math.min(sxr, exr);
                var bwr = Math.max(2, Math.abs(exr - sxr));
                c.fillStyle = 'rgba(150,104,70,.10)';
                c.fillRect(bxr, overlayTop, bwr, overlayHeight);
                c.save();
                c.beginPath();
                c.rect(bxr, overlayTop, bwr, overlayHeight);
                c.clip();
                c.strokeStyle = 'rgba(186,136,98,.30)';
                c.lineWidth = 1;
                var hatchStep = 8;
                var hatchStart = Math.floor(bxr - overlayHeight);
                var hatchEnd = Math.ceil(bxr + bwr + overlayHeight);
                for (var hx = hatchStart; hx <= hatchEnd; hx += hatchStep) {
                    c.beginPath();
                    c.moveTo(hx, overlayBottom);
                    c.lineTo(hx + overlayHeight, overlayTop);
                    c.stroke();
                }
                c.restore();
                c.strokeStyle = 'rgba(186,136,98,.50)';
                c.beginPath();
                c.moveTo(bxr + 0.5, overlayTop);
                c.lineTo(bxr + 0.5, overlayBottom);
                c.moveTo(bxr + bwr - 0.5, overlayTop);
                c.lineTo(bxr + bwr - 0.5, overlayBottom);
                c.stroke();
            }
        }

        var ifBranchShapes = this.collectIfBranchHighlightShapes(tr, rowMap, rmets, hiddenByIf);
        this.drawIfBranchHighlightShapes(c, ifBranchShapes);
        var choiceBranchShapes = this.collectChoiceBranchHighlightShapes(tr, rowMap, rmets, hiddenByIf);
        this.drawIfBranchHighlightShapes(c, choiceBranchShapes);

        this.hitNodes = [];
        this.hitComments = [];
        this.hitBars = [];
        this.hitOrderButtons = [];
        this.hitIfBranchButtons = [];
        var memoLabelQueue = [];
        var commentFrontQueue = [];
        var drawnCommentAt = {};
        var endMarkerGeom = null;
        if (tr) {
            var minEndFrame = this.trackComputedEndFrame(tr);
            var baseEndFrame = this.normalizeTrackEndFrame(tr);
            var drawEndFrame = baseEndFrame;
            if (this.dragState && this.dragState.endMarker) {
                var dsEnd = this.dragState;
                var dTarget = (dsEnd.targetFrame == null) ? dsEnd.startFrame : dsEnd.targetFrame;
                drawEndFrame = Math.max(minEndFrame, Math.floor(Number(dTarget || 0)));
            }
            endMarkerGeom = {
                frame: drawEndFrame
            };
        }
        if (tr && tr.commands) {
            var commandCullStart = Math.max(0, gridFrameStart - Math.max(step, 8));
            var commandCullEnd = Math.min(maxF + 1, gridFrameEnd + Math.max(step, 8));
            for (i = 0; i < tr.commands.length; i++) {
                var e = tr.commands[i];
                if (!e) continue;
                if (hiddenByIf[String(Math.floor(Number(e.uid || 0)))]) continue;
                var ef = Math.max(0, Math.floor(Number(e.frame || 0)));
                var ew = Math.max(0, Math.floor(Number(e.wait || 0)));
                var ee = ef + Math.max(1, ew);
                if (ee < commandCullStart || ef > commandCullEnd) continue;
                var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
                var ri = rowMap[rk];
                if (ri == null) continue;
                var met = rmets[ri] || { top: this.rulerH + ri * this.rowH, height: this.rowH, center: this.rulerH + ri * this.rowH + Math.floor(this.rowH / 2) };
                var cy = met.center;
                if (rk === 'main') {
                    var lane = this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(e.uid) ? this._mainLaneByUid[e.uid] : 0;
                    cy = met.top + this.mainLaneTop + lane * this.mainLaneGap;
                }
                var cx = this.frameToX(e.frame);
                var wait = ew;
                var sel = (e.uid === this.selUid && (this.selRouteListIndex == null || this.selRouteListIndex < 0)) || this.isEntryInRangeSelection(e.uid);
                if (e.isComment || e.command.code === 108) {
                    var ckey = rk + ':' + String(Math.max(0, Math.floor(Number(e.frame || 0))));
                    if (drawnCommentAt[ckey]) continue;
                    drawnCommentAt[ckey] = true;
                    this.memoApplyParsedStateToEntry(e);
                    var msize = e.isMemo ? this.memoNormalizeSize(e.memoSize) : 'S';
                    var cr = this.memoCircleRadiusForSize(msize);
                    // Keep comment marker on the border between ruler and timeline body.
                    var ay = Math.max(0, Math.floor(Number(this.rulerH || 0))) + 1;
                    if (!hideCircles) {
                        var commentNodeColor = this.commandCircleDefaultColorForEntry(e, rk);
                        c.fillStyle = this.commandMarkerFillColor(commentNodeColor, e, -1);
                        this.fillCircleWithBlackOutline(c, cx, ay, cr);
                        if (this.drawExecutionPulse(c, e.uid, -1, cx, ay, cr, pulseNow)) pulseActive = true;
                        if (e.isMemo && msize !== 'S') memoLabelQueue.push({ x: cx, y: ay, size: msize, text: e.memoText || '' });
                        commentFrontQueue.push({
                            uid: e.uid,
                            rowKey: rk,
                            x: cx,
                            y: ay,
                            r: cr,
                            sel: !!sel,
                            hov: !!this.isNodeHovered(e.uid, -1)
                        });
                    }
                    if (!hideCircles) {
                        this.hitComments.push({
                            uid: e.uid,
                            x: cx,
                            y: ay,
                            r: cr,
                            frame: e.frame,
                            rowKey: rk,
                            text: e.isMemo ? this.memoNormalizeText(e.memoText || '') : (e.commentLines || ['']).join('\n')
                        });
                    }
                    if (!hideCircles) this.hitNodes.push({ uid: e.uid, x: cx, y: ay, r: Math.max(4, cr + 1), frame: e.frame, rowKey: rk });
                    var hsel = sel;
                    var hhov = this.isNodeHovered(e.uid, -1);
                    if (!hideCircles && (hsel || hhov)) {
                        c.strokeStyle = hsel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                        c.lineWidth = hsel ? 2 : 1;
                        c.beginPath();
                        c.arc(cx, ay, this.scaleTimelineCircleRadius((hsel ? 4 : 3) + cr), 0, Math.PI * 2);
                        c.stroke();
                        c.lineWidth = 1;
                    }
                    continue;
                }
                if (e.command && Number(e.command.code || 0) === 205 && rk.indexOf('char:') === 0) {
                    var route = e.command.parameters && e.command.parameters[1];
                    var routeWaitOn = !!(route && route.wait);
                    var routeBarFillColor = routeWaitOn ? 'rgba(148,102,68,.38)' : 'rgba(132,92,62,.20)';
                    var routeNodeDefaultColor = routeWaitOn ? 'rgba(194,146,104,.98)' : 'rgba(176,128,90,.98)';
                    var routeNodeEntryColor = this.commandMarkerFillColor(routeNodeDefaultColor, e, -1);
                    var routeHandleBaseColor = routeWaitOn ? 'rgba(170,122,84,1)' : 'rgba(156,112,78,1)';
                    var tl = this.moveRouteTimeline(route);
                    var total = Math.max(1, Math.floor(Number(e.wait || tl.totalFrames || 1)));
                    var sx = this.frameToX(e.frame);
                    var ex205 = this.frameToX(e.frame + total);
                    var bx = Math.min(sx, ex205);
                    var bw205 = Math.max(2, Math.abs(ex205 - sx));
                    var by = cy - 7;
                    var bh = 14;
                    var hW = 7, hH = 12, hR = 3;
                    var lhx = bx - hW - 2;
                    var lhy = cy - Math.floor(hH / 2);
                    var rhx = bx + bw205;
                    var rhy = cy - Math.floor(hH / 2);
                    // Extend visual range start to the left handle edge so no visual gap appears.
                    var vbx = Math.min(bx, lhx + hW - 2);
                    var vbw = Math.max(2, bw205 + (bx - vbx));
                    c.fillStyle = routeBarFillColor;
                    c.fillRect(vbx, by, vbw, bh);
                    var rangeSel = (e.uid === this.selUid && (this.selRouteListIndex == null || this.selRouteListIndex < 0)) || this.isEntryInRangeSelection(e.uid);
                    var rangeHover = this.isNodeHovered(e.uid, -1);
                    var routeHx = Math.floor(lhx - 1);
                    var routeHy = Math.floor(cy - Math.floor(hH / 2) - 1);
                    var routeHw = Math.max(6, Math.ceil((rhx + hW) - lhx + 2));
                    var routeHh = Math.max(6, Math.ceil(hH + 2));
                    if (rangeSel || rangeHover) {
                        if (rangeSel) {
                            c.strokeStyle = 'rgba(40,24,12,.96)';
                            c.lineWidth = 3;
                            this.strokeRoundedRect(c, routeHx + .5, routeHy + .5, Math.max(1, routeHw - 1), Math.max(1, routeHh - 1), 4);
                            c.strokeStyle = 'rgba(194,146,104,.98)';
                            c.lineWidth = 2;
                            this.strokeRoundedRect(c, routeHx + 1.5, routeHy + 1.5, Math.max(1, routeHw - 3), Math.max(1, routeHh - 3), 3);
                        } else {
                            c.strokeStyle = 'rgba(214,182,152,.95)';
                            c.lineWidth = 1;
                            this.strokeRoundedRect(c, routeHx + .5, routeHy + .5, Math.max(1, routeHw - 1), Math.max(1, routeHh - 1), 4);
                        }
                        c.lineWidth = 1;
                    }
                    var hColor = rangeSel ? 'rgba(194,146,104,1)' : (rangeHover ? 'rgba(214,182,152,1)' : routeHandleBaseColor);
                    var kx = bx + Math.floor(bw205 / 2);
                    var ky = by;
                    var kW = 8, kH = 4, kr = 2;
                    var kx1 = kx - Math.floor(kW / 2) - 1, ky1 = ky - Math.floor(kH / 2);
                    if (!hideHandles) {
                        c.fillStyle = hColor;
                        // Left handle: anchorX=1 (right edge at bx), inner(right) side is square.
                        this.fillHandleRect(c, lhx, lhy, hW, hH, hR, true, false);
                        // Right handle: anchorX=0 (left edge at bx+bw205), inner(left) side is square.
                        this.fillHandleRect(c, rhx, rhy, hW, hH, hR, false, true);
                        this.fillRoundedRect(c, kx1, ky1, kW, kH, kr);
                    }
                    var hru = Number(this.hoverRangeUid || 0);
                    var hrp = String(this.hoverRangePart || '');
                    if (!hideHandles && hru === Number(e.uid || 0)) {
                        var hs = rangeSel ? 'rgba(194,146,104,.98)' : 'rgba(214,182,152,.95)';
                        c.strokeStyle = hs;
                        c.lineWidth = rangeSel ? 2 : 1;
                        if (hrp === 'left') this.strokeHandleRect(c, lhx + .5, lhy + .5, Math.max(1, hW - 1), Math.max(1, hH - 1), hR, true, false);
                        else if (hrp === 'right') this.strokeHandleRect(c, rhx + .5, rhy + .5, Math.max(1, hW - 1), Math.max(1, hH - 1), hR, false, true);
                        else if (hrp === 'move') this.strokeRoundedRect(c, kx1 + .5, ky1 + .5, Math.max(1, kW - 1), Math.max(1, kH - 1), kr);
                        c.lineWidth = 1;
                    }
                    this.hitBars.push({
                        uid: e.uid, x1: bx, x2: bx + bw205, y: cy, frame: e.frame, rowKey: rk,
                        routeRangeUid: e.uid, routeRangePart: 'body', frameStart: e.frame, waitFrames: total
                    });
                    var items = tl.items || [];
                    var hasVisibleRouteCmd = false;
                    if (!items.length) {
                        if (!hideCircles) {
                            c.fillStyle = routeNodeEntryColor;
                            this.fillCircleWithBlackOutline(c, cx, cy, 4);
                        }
                        var rsel0 = sel;
                        var rhov0 = this.isNodeHovered(e.uid, -1);
                            if (!hideCircles && (rsel0 || rhov0)) {
                                if (rsel0) {
                                    c.strokeStyle = 'rgba(40,24,12,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(cx, cy, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(194,146,104,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(cx, cy, this.scaleTimelineCircleRadius(7), 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(214,182,152,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(cx, cy, this.scaleTimelineCircleRadius(6), 0, Math.PI * 2);
                                    c.stroke();
                                }
                                c.lineWidth = 1;
                            }
                        if (!hideCircles) {
                            this.hitNodes.push({
                                uid: e.uid, x: cx, y: cy, r: 5, frame: e.frame, rowKey: rk,
                                routeCmdCode: null, routeListIndex: -1
                            });
                        }
                    } else {
                        for (var m = 0; m < items.length; m++) {
                            var it = items[m];
                            var rcode = Number((it && it.displayCode != null) ? it.displayCode : 0);
                            var displayCode = rcode;
                            if (displayCode <= 0 || displayCode === 15) continue;
                            hasVisibleRouteCmd = true;
                            var rf = e.frame + Math.max(0, Math.floor(Number(it.offset || 0)));
                            var rcx = this.frameToX(rf);
                            var spanFrames = Math.max(1, Math.floor(Number(it.span || 1)));
                            var rli = Number(it.listIndex == null ? -1 : it.listIndex);
                            var routeNodeFillColor = this.commandMarkerFillColor(routeNodeDefaultColor, e, rli);
                            if (spanFrames > 1) {
                                var rex = this.frameToX(rf + spanFrames);
                                this.drawTimelineWaitStem(c, rcx, rex, cy, routeNodeFillColor, 4);
                            }
                            if (!hideCircles) {
                                c.fillStyle = routeNodeFillColor;
                                this.fillCircleWithBlackOutline(c, rcx, cy, 4);
                                if (this.drawExecutionPulse(c, e.uid, rli, rcx, cy, 4, pulseNow)) pulseActive = true;
                            }
                            var rsel = (e.uid === this.selUid && this.selRouteListIndex === rli) || this.isRouteCmdInRangeSelection(e.uid, rli);
                            var rhov = this.isNodeHovered(e.uid, rli);
                            if (!hideCircles && (rsel || rhov)) {
                                if (rsel) {
                                    c.strokeStyle = 'rgba(40,24,12,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(rcx, cy, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(194,146,104,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(rcx, cy, this.scaleTimelineCircleRadius(7), 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(214,182,152,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(rcx, cy, this.scaleTimelineCircleRadius(6), 0, Math.PI * 2);
                                    c.stroke();
                                }
                                c.lineWidth = 1;
                            }
                            if (!hideCircles) {
                                this.hitNodes.push({
                                    uid: e.uid, x: rcx, y: cy, r: 5, frame: rf, rowKey: rk,
                                    routeCmdCode: displayCode, routeOffset: Number(it.offset || 0), routeIndex: m, routeListIndex: rli
                                });
                            }
                        }
                        if (!hasVisibleRouteCmd) {
                            if (!hideCircles) {
                                c.fillStyle = routeNodeEntryColor;
                                this.fillCircleWithBlackOutline(c, cx, cy, 4);
                                if (this.drawExecutionPulse(c, e.uid, -1, cx, cy, 4, pulseNow)) pulseActive = true;
                            }
                            var rsel1 = sel;
                            var rhov1 = this.isNodeHovered(e.uid, -1);
                            if (!hideCircles && (rsel1 || rhov1)) {
                                if (rsel1) {
                                    c.strokeStyle = 'rgba(40,24,12,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(cx, cy, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(194,146,104,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(cx, cy, this.scaleTimelineCircleRadius(7), 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(214,182,152,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(cx, cy, this.scaleTimelineCircleRadius(6), 0, Math.PI * 2);
                                    c.stroke();
                                }
                                c.lineWidth = 1;
                            }
                            if (!hideCircles) {
                                this.hitNodes.push({
                                    uid: e.uid, x: cx, y: cy, r: 5, frame: e.frame, rowKey: rk,
                                    routeCmdCode: null, routeListIndex: -1
                                });
                            }
                        }
                    }
                    if (!hideHandles) {
                        this.hitBars.push({
                            uid: e.uid, x1: lhx, x2: lhx + hW, y: cy, frame: e.frame, rowKey: rk,
                            routeRangeUid: e.uid, routeRangePart: 'left', frameStart: e.frame, waitFrames: total
                        });
                        this.hitBars.push({
                            uid: e.uid, x1: rhx, x2: rhx + hW, y: cy, frame: e.frame, rowKey: rk,
                            routeRangeUid: e.uid, routeRangePart: 'right', frameStart: e.frame, waitFrames: total
                        });
                        this.hitBars.push({
                            uid: e.uid, x1: kx - 10, x2: kx + 10, y: ky, frame: e.frame, rowKey: rk,
                            routeRangeUid: e.uid, routeRangePart: 'move', frameStart: e.frame, waitFrames: total
                        });
                    }
                    continue;
                }
                var defaultNodeColor = this.commandCircleDefaultColorForEntry(e, rk);
                var nodeFillColor = this.commandMarkerFillColor(defaultNodeColor, e, -1);
                if (wait > 1 && Number(e.command && e.command.code || 0) !== 115) {
                    var ex = this.frameToX(e.frame + wait);
                    this.drawTimelineWaitStem(c, cx, ex, cy, nodeFillColor, 4);
                    this.hitBars.push({ uid: e.uid, x1: Math.min(cx, ex), x2: Math.max(cx, ex), y: cy, frame: e.frame, rowKey: rk });
                }
                var cmdCode = (e.command ? Number(e.command.code || 0) : 0);
                var isIfCommand = (cmdCode === 111);
                var isAbortCommand = (cmdCode === 115);
                var nodeRadius = isAbortCommand ? 5 : 4;
                c.fillStyle = nodeFillColor;
                if (!hideCircles) this.fillCircleWithBlackOutline(c, cx, cy, nodeRadius, {
                    forceVisible: isIfCommand && Math.max(0, Math.floor(Number(e.frame || 0))) === 0
                });
                if (!hideCircles && this.drawExecutionPulse(c, e.uid, -1, cx, cy, nodeRadius, pulseNow)) pulseActive = true;
                var gsel = sel;
                var ghov = this.isNodeHovered(e.uid, -1);
                if (!hideCircles && (gsel || ghov)) {
                    c.strokeStyle = isAbortCommand
                        ? (gsel ? 'rgba(236,236,236,.98)' : 'rgba(210,220,236,.95)')
                        : (isIfCommand
                            ? (gsel ? 'rgba(54,126,225,.98)' : 'rgba(180,218,255,.95)')
                            : (gsel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)'));
                    c.lineWidth = gsel ? 2 : 1;
                    c.beginPath();
                    c.arc(cx, cy, this.scaleTimelineCircleRadius(gsel ? (nodeRadius + 3) : (nodeRadius + 2)), 0, Math.PI * 2);
                    c.stroke();
                    c.lineWidth = 1;
                }
                if (!hideCircles) this.hitNodes.push({ uid: e.uid, x: cx, y: cy, r: nodeRadius + 1, frame: e.frame, rowKey: rk });
            }
        }

        if (endMarkerGeom) {
            var mainRiEnd = rowMap.main;
            var mainMetEnd = (mainRiEnd != null) ? (rmets[mainRiEnd] || null) : null;
            var endTailLane = Math.max(0, this.mainVisibleStackCountAtFrame(tr, endMarkerGeom.frame, hiddenByIf));
            endMarkerGeom.x = this.frameToX(endMarkerGeom.frame);
            endMarkerGeom.y = mainMetEnd
                ? (Number(mainMetEnd.top || this.rulerH) + this.mainLaneTop + endTailLane * this.mainLaneGap)
                : (this.rulerH + Math.floor(this.rowH / 2));
            endMarkerGeom.r = 5;
            if (!hideCircles) {
                c.fillStyle = 'rgba(170,170,170,.98)';
                this.fillCircleWithBlackOutline(c, endMarkerGeom.x, endMarkerGeom.y, endMarkerGeom.r);
                var endActive = !!(this.dragState && this.dragState.endMarker) || !!this.hoverEndMarker;
                if (endActive) {
                    c.strokeStyle = (this.dragState && this.dragState.endMarker) ? 'rgba(236,236,236,.98)' : 'rgba(210,220,236,.95)';
                    c.lineWidth = (this.dragState && this.dragState.endMarker) ? 2 : 1;
                    c.beginPath();
                    c.arc(endMarkerGeom.x, endMarkerGeom.y, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                    c.stroke();
                    c.lineWidth = 1;
                }
                this.hitNodes.push({
                    uid: 0,
                    isEndMarker: true,
                    x: endMarkerGeom.x,
                    y: endMarkerGeom.y,
                    r: 6,
                    frame: endMarkerGeom.frame,
                    rowKey: 'main'
                });
            }
        }

        this.drawSelectedCommandOrderButtons(c, rowMap, rmets);

        if (this.dragState && this.dragState.uid && this.dragState.moved) {
            var ds = this.dragState;
            if (ds.isRangeDrag) {
                var de = this.findEntryInSelectedTrack(ds.uid);
                var drk = de ? (de.rowKey || (de.rowType === 'char' ? ('char:' + de.charId) : 'main')) : ds.targetRowKey;
                var dri = rowMap[drk];
                if (dri != null) {
                    var dmet = rmets[dri] || { top: this.rulerH + dri * this.rowH, height: this.rowH, center: this.rulerH + dri * this.rowH + Math.floor(this.rowH / 2) };
                    var dcy = dmet.center;
                    var dby = dcy - 7, dbh = 14;
                    var oldStart = Math.max(0, Math.floor(Number(ds.startEntryFrame || (de ? de.frame : 0))));
                    var oldWaitBase = Number(ds.startWait || 0);
                    if (oldWaitBase <= 0 && de && de.command && Number(de.command.code || 0) === 205 &&
                        typeof this.routeExecutionSpanFramesForEntry === 'function') {
                        oldWaitBase = Number(this.routeExecutionSpanFramesForEntry(de) || 0);
                    }
                    if (oldWaitBase <= 0) oldWaitBase = Number(de ? de.wait : 1);
                    var oldWait = Math.max(1, Math.floor(oldWaitBase));
                    var newStart = Math.max(0, Math.floor(Number(ds.targetFrame || oldStart)));
                    var newWait = Math.max(1, Math.floor(Number(ds.targetWait || oldWait)));
                    var ox1 = this.frameToX(oldStart), ox2 = this.frameToX(oldStart + oldWait);
                    var nx1 = this.frameToX(newStart), nx2 = this.frameToX(newStart + newWait);
                    var obx = Math.min(ox1, ox2), obw = Math.max(2, Math.abs(ox2 - ox1));
                    var nbx = Math.min(nx1, nx2), nbw = Math.max(2, Math.abs(nx2 - nx1));

                    c.fillStyle = 'rgba(255,255,255,.08)';
                    c.fillRect(obx, dby, obw, dbh);
                    c.strokeStyle = 'rgba(255,255,255,.24)';
                    c.lineWidth = 1;
                    c.strokeRect(obx + .5, dby + .5, Math.max(1, obw - 1), Math.max(1, dbh - 1));

                    c.fillStyle = ds.valid ? 'rgba(100,255,170,.28)' : 'rgba(255,120,120,.28)';
                    c.fillRect(nbx, dby, nbw, dbh);
                    c.strokeStyle = ds.valid ? 'rgba(100,255,170,.94)' : 'rgba(255,120,120,.94)';
                    c.lineWidth = 2;
                    c.strokeRect(nbx + .5, dby + .5, Math.max(1, nbw - 1), Math.max(1, dbh - 1));
                    c.lineWidth = 1;

                    var dPart = String(ds.rangePart || '');
                    if (dPart === 'left' || dPart === 'right') {
                        var dFrame = newWait - oldWait;
                        var dText = (dFrame >= 0 ? '+' : '') + dFrame + 'f';
                        c.font = 'bold 11px sans-serif';
                        var tw = Math.ceil(c.measureText(dText).width) + 8;
                        var tx = Math.floor(nbx + nbw / 2 - tw / 2);
                        var ty = Math.floor(dby - 18);
                        c.fillStyle = 'rgba(0,0,0,.78)';
                        c.fillRect(tx, ty, tw, 14);
                        c.strokeStyle = 'rgba(255,255,255,.22)';
                        c.strokeRect(tx + .5, ty + .5, tw - 1, 13);
                        c.fillStyle = ds.valid ? 'rgba(170,255,205,.98)' : 'rgba(255,196,196,.98)';
                        c.fillText(dText, tx + 4, ty + 10);
                    }
                }
            } else {
                var di = rowMap[ds.targetRowKey];
                if (di != null) {
                    var dy = this.rulerH + di * this.rowH + Math.floor(this.rowH / 2);
                    var dx = this.frameToX(ds.targetFrame);
                    if (!hideCircles) {
                        c.fillStyle = ds.valid ? 'rgba(100,255,170,.9)' : 'rgba(255,120,120,.9)';
                        this.fillCircleWithBlackOutline(c, dx, dy, 5);
                    }
                }
            }
        }

        if (this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            var srects = Array.isArray(rs.rects) ? rs.rects : [];
            for (var sri = 0; sri < srects.length; sri++) {
                var src = srects[sri];
                if (!src) continue;
                var sx1 = Math.min(Number(src.x1 || 0), Number(src.x2 || 0));
                var sx2 = Math.max(Number(src.x1 || 0), Number(src.x2 || 0));
                var sy1 = Math.min(Number(src.y1 || 0), Number(src.y2 || 0));
                var sy2 = Math.max(Number(src.y1 || 0), Number(src.y2 || 0));
                var sw = Math.max(1, sx2 - sx1);
                var sh = Math.max(1, sy2 - sy1);
                c.fillStyle = 'rgba(88,168,255,.10)';
                c.fillRect(sx1, sy1, sw, sh);
                c.strokeStyle = 'rgba(118,198,255,.78)';
                c.lineWidth = 1;
                c.strokeRect(sx1 + .5, sy1 + .5, Math.max(1, sw - 1), Math.max(1, sh - 1));
            }
        }

        if (this.rangeSelectDrag) {
            var rsd = this.rangeSelectDrag;
            var rsi = this.rangeSelectDragFrameInfo(rsd);
            var dr = rsi && rsi.rect ? rsi.rect : this.normalizeCanvasRect(rsd.startX, rsd.startY, rsd.currentX, rsd.currentY);
            var dx1 = Math.min(Number(dr.x1 || 0), Number(dr.x2 || 0));
            var dx2 = Math.max(Number(dr.x1 || 0), Number(dr.x2 || 0));
            var dy1 = Math.min(Number(dr.y1 || 0), Number(dr.y2 || 0));
            var dy2 = Math.max(Number(dr.y1 || 0), Number(dr.y2 || 0));
            var dw = Math.max(1, dx2 - dx1);
            var dh = Math.max(1, dy2 - dy1);
            c.fillStyle = 'rgba(88,168,255,.16)';
            c.fillRect(dx1, dy1, dw, dh);
            c.strokeStyle = 'rgba(128,212,255,.95)';
            c.lineWidth = 1;
            c.strokeRect(dx1 + .5, dy1 + .5, Math.max(1, dw - 1), Math.max(1, dh - 1));
            if (rsi) {
                var dragText = '選択中: ' + rsi.frameCount + 'f';
                c.save();
                c.font = 'bold 12px sans-serif';
                var padX = 7;
                var padY = 4;
                var tw2 = Math.ceil(c.measureText(dragText).width);
                var bw2 = tw2 + padX * 2;
                var bh2 = 20;
                var bx2 = Math.floor(dx1 + 4);
                var by2 = Math.floor(dy1 - bh2 - 4);
                if (by2 < 2) by2 = Math.floor(dy2 + 4);
                if (bx2 + bw2 > this.tw - 2) bx2 = Math.max(2, Math.floor(this.tw - bw2 - 2));
                c.fillStyle = 'rgba(14,30,42,.92)';
                this.fillRoundedRect(c, bx2, by2, bw2, bh2, 4);
                c.strokeStyle = 'rgba(128,212,255,.92)';
                c.lineWidth = 1;
                this.strokeRoundedRect(c, bx2 + .5, by2 + .5, Math.max(1, bw2 - 1), Math.max(1, bh2 - 1), 4);
                c.fillStyle = 'rgba(208,236,255,.98)';
                c.fillText(dragText, bx2 + padX, by2 + 14);
                c.restore();
            }
        }

        if (this.rangeMoveDrag && this.rangeMoveDrag.moved) {
            var rmd = this.rangeMoveDrag;
            var okCol = rmd.valid ? 'rgba(100,255,170,.94)' : 'rgba(255,120,120,.94)';
            var okFill = rmd.valid ? 'rgba(100,255,170,.24)' : 'rgba(255,120,120,.24)';
            if (rmd.kind === 'routeCmd') {
                var re = this.findEntryInSelectedTrack(Number(rmd.previewRouteUid || 0));
                var rrk = re ? String(re.rowKey || 'main') : '';
                var rri = rowMap[rrk];
                if (rri != null && re && rmd.previewRouteBlocks && rmd.previewRouteBlocks.length) {
                    var rmet = rmets[rri] || { top: this.rulerH + rri * this.rowH, height: this.rowH, center: this.rulerH + rri * this.rowH + Math.floor(this.rowH / 2) };
                    var rcy = rmet.center;
                    c.strokeStyle = okCol;
                    c.fillStyle = okFill;
                    var roffs = Array.isArray(rmd.previewRouteDisplayOffsets) ? rmd.previewRouteDisplayOffsets : [];
                    if (roffs.length) {
                        for (var roi = 0; roi < roffs.length; roi++) {
                            var roff = Math.max(0, Math.floor(Number(roffs[roi] || 0)));
                            var rfx = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))) + roff);
                            this.fillCircleWithBlackOutline(c, rfx, rcy, 5);
                            c.beginPath();
                            c.arc(rfx, rcy, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                            c.stroke();
                        }
                    } else {
                        for (var rbi = 0; rbi < rmd.previewRouteBlocks.length; rbi++) {
                            var rb = rmd.previewRouteBlocks[rbi];
                            if (!rb || !rb._sel) continue;
                            var rfx2 = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))) + Math.max(0, Math.floor(Number(rb.start || 0))));
                            this.fillCircleWithBlackOutline(c, rfx2, rcy, 5);
                            c.beginPath();
                            c.arc(rfx2, rcy, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                            c.stroke();
                        }
                    }
                }
            } else if (Array.isArray(rmd.previewEntries) && rmd.previewEntries.length) {
                for (var pei = 0; pei < rmd.previewEntries.length; pei++) {
                    var pe = rmd.previewEntries[pei];
                    if (!pe || !pe.entry) continue;
                    var prk = String(pe.rowKey || pe.entry.rowKey || 'main');
                    var pri = rowMap[prk];
                    if (pri == null) continue;
                    var pmet = rmets[pri] || { top: this.rulerH + pri * this.rowH, height: this.rowH, center: this.rulerH + pri * this.rowH + Math.floor(this.rowH / 2) };
                    var pcy = pmet.center;
                    var pfx = this.frameToX(Math.max(0, Math.floor(Number(pe.frame || 0))));
                    var isMoveRouteEntry = !!(pe.entry && pe.entry.command && Number(pe.entry.command.code || 0) === 205);
                    if (isMoveRouteEntry) {
                        var pspan = Math.max(1, this.routeExecutionSpanFramesForEntry(pe.entry));
                        var pexr = this.frameToX(Math.max(0, Math.floor(Number(pe.frame || 0))) + pspan);
                        var px1r = Math.min(pfx, pexr);
                        var pwr = Math.max(2, Math.abs(pexr - pfx));
                        var pby = Math.floor(pcy - 7);
                        var pbh = 14;
                        c.fillStyle = okFill;
                        c.fillRect(px1r, pby, pwr, pbh);
                        c.strokeStyle = okCol;
                        c.lineWidth = 2;
                        c.strokeRect(px1r + .5, pby + .5, Math.max(1, pwr - 1), Math.max(1, pbh - 1));
                        c.lineWidth = 1;
                        continue;
                    }
                    var pwait = Math.max(0, Math.floor(Number(pe.entry.wait || 0)));
                    if (pwait > 1) {
                        var pex = this.frameToX(Math.max(0, Math.floor(Number(pe.frame || 0))) + pwait);
                        this.drawTimelineWaitStem(c, pfx, pex, pcy, okCol, 5);
                    }
                    c.fillStyle = okFill;
                    this.fillCircleWithBlackOutline(c, pfx, pcy, 5);
                    c.strokeStyle = okCol;
                    c.beginPath();
                    c.arc(pfx, pcy, this.scaleTimelineCircleRadius(8), 0, Math.PI * 2);
                    c.stroke();
                }
            }
        }

        if (pulseActive) this.timelineDirty = true;

        // Keep left label column fixed while horizontal scrolling.
        this.drawFixedLabelColumn(c, rows, rmets, selectedRowKey, fixedLabelX, h);

        if (Number(this.hoverFrame) >= 0) {
            var hvf = Math.max(0, Math.floor(Number(this.hoverFrame || 0)));
            var hvx = this.frameToX(hvf) + 0.5;
            c.strokeStyle = 'rgba(210,230,255,.35)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(hvx, this.rulerH);
            c.lineTo(hvx, h);
            c.stroke();
        }

        var px = this.frameToX(this.frame);
        c.strokeStyle = 'rgba(100,255,175,.95)';
        c.beginPath();
        c.moveTo(px + .5, 0);
        c.lineTo(px + .5, h);
        c.stroke();

        // Keep top ruler fixed while vertical scrolling.
        this.drawStickyTimelineRuler(c, maxF, fixedLabelX, w, h);
        this._timelineIfBranchOverlayRule = null;
        this.drawIfBranchHighlightShapesFront(c, ifBranchFrontQueue);
        this._timelineCircleOverlayRule = null;
        for (var cfqi = 0; cfqi < circleFrontQueue.length; cfqi++) {
            var cfq = circleFrontQueue[cfqi];
            if (!cfq) continue;
            c.fillStyle = cfq.fillStyle || 'rgba(255,255,255,.98)';
            c.beginPath();
            c.arc(Number(cfq.x || 0), Number(cfq.y || 0), Math.max(0, Number(cfq.radius || 0)), 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,.98)';
            c.lineWidth = 1;
            c.stroke();
        }
        this.drawSelectedIfBranchModeButtons(c, rowMap, rmets);
        var frontPulse = false;
        for (var cqi = 0; cqi < commentFrontQueue.length; cqi++) {
            var cq = commentFrontQueue[cqi];
            if (!cq) continue;
            var cqRule = this.timelineCircleOverlayDecision(cq.x, cq.y, cq.r, fixedLabelRight, stickyRulerBottom);
            if (cqRule.hide) continue;
            var cqEntry = this.findEntryInSelectedTrack(Number(cq.uid || 0));
            var cqRowKey = String(cq.rowKey || (cqEntry ? (cqEntry.rowKey || (cqEntry.rowType === 'char' ? ('char:' + cqEntry.charId) : 'main')) : 'main'));
            var cqDefaultColor = this.commandCircleDefaultColorForEntry(cqEntry, cqRowKey);
            c.fillStyle = this.commandMarkerFillColor(cqDefaultColor, cqEntry, -1);
            this.fillCircleWithBlackOutline(c, cq.x, cq.y, cq.r);
            if (this.drawExecutionPulse(c, cq.uid, -1, cq.x, cq.y, cq.r, pulseNow)) frontPulse = true;
            if (cq.sel || cq.hov) {
                c.strokeStyle = cq.sel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                c.lineWidth = cq.sel ? 2 : 1;
                c.beginPath();
                c.arc(cq.x, cq.y, this.scaleTimelineCircleRadius((cq.sel ? 4 : 3) + cq.r), 0, Math.PI * 2);
                c.stroke();
                c.lineWidth = 1;
            }
        }
        if (frontPulse) this.timelineDirty = true;
        this._timelineIfBranchButtonOverlayRule = null;
        this.renderMemoLabelOverlay(memoLabelQueue);

        if (this.tInfo) {
            var sid = (this.selUid || '-');
            if (this.selRouteListIndex != null && this.selRouteListIndex >= 0) sid += '/route[' + this.selRouteListIndex + ']';
            var dragInfoText = '';
            if (this.rangeSelectDrag) {
                var dsInfo = this.rangeSelectDragFrameInfo(this.rangeSelectDrag);
                if (dsInfo) dragInfoText = ' | selecting: ' + dsInfo.frameCount + 'f';
            }
            this.tInfo.textContent = 'frame: ' + this.frame + ' | selected: ' + sid + ' | event: ' + (this.selEid || '-') + ' | rows: ' + rows.length + dragInfoText;
        }
        this.refreshMemoScrollLane(maxF);
    };

    EE.prototype.niceFrameStep = function(target) {
        target = Math.max(1, Number(target || 1));
        var step = 30;
        while (step < target) step *= 2;
        return step;
    };


})();
