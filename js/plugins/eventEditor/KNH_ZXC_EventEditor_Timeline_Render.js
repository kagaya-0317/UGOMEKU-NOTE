//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Render
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.3.0 (KNH_ZXC_EventEditor_Timeline_Render)
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
    var installEscapeConvertFallback = SH.installEscapeConvertFallback;
    var compareEntriesByFrameWaitUid = SH.compareEntriesByFrameWaitUid;
    var COMMAND_CODE = SH.COMMAND_CODE;
    SH.beginModule('render');

    //-------------------------------------------------------------------------
    // Timeline lifecycle, playback, and track model
    //-------------------------------------------------------------------------
    EE.prototype.post = function() {
        if (!this.on) return;
        var battleMode = this.isBattleEventMode();
        if (this._postLastPlaybackState !== !!this.play) {
            this._postLastPlaybackState = !!this.play;
            if (!this.play) {
                this.clearMessageRuntimeState();
            } else if (typeof this.ensureMessageRuntimeStateForPlayback === 'function') {
                this.ensureMessageRuntimeStateForPlayback();
            }
        }
        if (typeof this.writeRecoverySnapshot === 'function') this.writeRecoverySnapshot(false);
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
            this.refreshAutoIfBranchViewSignature(battleAutoTrack);
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
        this.refreshAutoIfBranchViewSignature(autoTrack);
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
        var staticDirty = !!this.timelineDirty;
        _eeBaseSeek_Timeline.call(this, this.clampFrameToSelectedTrackEnd(f));
        var track = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        var autoBranchChanged = this.refreshAutoIfBranchViewSignature(track);
        if (!staticDirty && !autoBranchChanged) this.timelineDirty = false;
        this.timelineCursorDirty = true;
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
            this.timelineCursorDirty = true;
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
        this.timelineCursorDirty = true;
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
        var entryUid = uid || this.model.nextUid++;
        var e = {
            uid: entryUid,
            executionOrder: entryUid,
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
            popupPortrait: null,
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

    EE.prototype.routeSymbolFromOrdinal = function(ordinal) {
        ordinal = Math.max(1, Math.floor(Number(ordinal || 1)));
        var out = '';
        while (ordinal > 0) {
            ordinal--;
            out = String.fromCharCode(65 + (ordinal % 26)) + out;
            ordinal = Math.floor(ordinal / 26);
        }
        return out;
    };

    EE.prototype.normalizeTrackExecutionMetadata = function(tr) {
        if (!tr || !Array.isArray(tr.commands)) return tr;
        var ordered = tr.commands.slice(0).sort(function(a, b) {
            return Math.floor(Number(a && a.uid || 0)) - Math.floor(Number(b && b.uid || 0));
        });
        var usedOrders = Object.create(null);
        var maxOrder = 0;
        var missingOrders = [];
        var i;
        for (i = 0; i < ordered.length; i++) {
            var e = ordered[i];
            if (!e) continue;
            var order = Number(e.executionOrder);
            var orderKey = (e.executionOrder != null && isFinite(order) && order > 0) ? String(order) : '';
            if (!orderKey || usedOrders[orderKey]) {
                missingOrders.push(e);
                continue;
            }
            usedOrders[orderKey] = true;
            maxOrder = Math.max(maxOrder, order);
        }
        for (i = 0; i < missingOrders.length; i++) {
            var fallback = Math.floor(Number(missingOrders[i].uid || 0));
            if (fallback > 0 && !usedOrders[String(fallback)]) {
                missingOrders[i].executionOrder = fallback;
                usedOrders[String(fallback)] = true;
                maxOrder = Math.max(maxOrder, fallback);
            } else {
                do { maxOrder++; } while (usedOrders[String(maxOrder)]);
                missingOrders[i].executionOrder = maxOrder;
                usedOrders[String(maxOrder)] = true;
            }
        }

        var routeGroups = Object.create(null);
        for (i = 0; i < ordered.length; i++) {
            e = ordered[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 205) continue;
            var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
            var charId = this.normalizeMoveTarget(e.charId == null ? Number(p[0] || 0) : Number(e.charId || 0));
            var groupKey = String(charId);
            if (!routeGroups[groupKey]) routeGroups[groupKey] = [];
            routeGroups[groupKey].push(e);
        }
        var groupKeys = Object.keys(routeGroups);
        for (var gi = 0; gi < groupKeys.length; gi++) {
            var group = routeGroups[groupKeys[gi]];
            var usedSymbols = Object.create(null);
            var needsSymbol = [];
            for (i = 0; i < group.length; i++) {
                e = group[i];
                var ordinal = Math.floor(Number(e.routeSymbolOrdinal || 0));
                if (ordinal <= 0 || usedSymbols[String(ordinal)]) {
                    needsSymbol.push(e);
                    continue;
                }
                usedSymbols[String(ordinal)] = true;
            }
            var nextOrdinal = 1;
            for (i = 0; i < needsSymbol.length; i++) {
                while (usedSymbols[String(nextOrdinal)]) nextOrdinal++;
                needsSymbol[i].routeSymbolOrdinal = nextOrdinal;
                usedSymbols[String(nextOrdinal)] = true;
                nextOrdinal++;
            }
        }
        return tr;
    };

    EE.prototype.routeSymbolForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return '';
        var ordinal = Math.floor(Number(entry.routeSymbolOrdinal || 0));
        if (ordinal <= 0) {
            var tr = this.selectedTrack ? this.selectedTrack() : null;
            this.normalizeTrackExecutionMetadata(tr);
            ordinal = Math.floor(Number(entry.routeSymbolOrdinal || 0));
        }
        return ordinal > 0 ? this.routeSymbolFromOrdinal(ordinal) : '';
    };

    EE.prototype.isMainLaneDisplayEntry = function(entry) {
        if (!entry || !entry.command) return false;
        if (entry.isComment || Number(entry.command.code || 0) === 108) return false;
        if (Number(entry.command.code || 0) === 205) return true;
        var rowKey = entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main');
        return rowKey === 'main';
    };

    EE.prototype.mainLaneDisplaySlotCountForEntry = function(entry) {
        if (!this.isMainLaneDisplayEntry(entry)) return 0;
        return this.isBranchOwnerEntry(entry) ? 2 : 1;
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
            if (typeof this.repairTemporalBranchNesting === 'function') {
                this.repairTemporalBranchNesting(this.model.tracks[k]);
            }
            this.normalizeTrackExecutionMetadata(this.model.tracks[k]);
            this.normalizeTrackEndFrame(this.model.tracks[k]);
            return this.model.tracks[k];
        }
        var tr = { eventId: eid, pageIndex: page, commands: [], extraCharRows: [], tempCharRows: [], endFrame: 0, _eeV2: true };
        var list = (typeof this.trackPageSourceList === 'function')
            ? this.trackPageSourceList(eid, page)
            : (((($dataMap.events[eid] || {}).pages || [])[page] || {}).list) || [];
        var f = 0;
        var branchFrameState = SH.createBranchFrameState();
        var pendingBranchEnd = null;
        this._eeTrackParseMode = true;
        try {
            for (var i = 0; i < list.length; i++) {
                var cmd = list[i];
                if (!cmd || cmd.code === 0) continue;
                var cmdIndent = Math.max(0, Math.floor(Number(cmd.indent || 0)));
                f = SH.branchFrameBeforeBoundary(branchFrameState, cmd.code, cmdIndent, f);
                if (cmd.code === 230) {
                    var waitFrames = Math.max(0, Math.floor(Number((cmd.parameters || [0])[0] || 0)));
                    f += waitFrames;
                    if (pendingBranchEnd && cmd._eeBranchEndWait === true &&
                        pendingBranchEnd.indent === cmdIndent) {
                        pendingBranchEnd.entry.frame = f;
                    } else {
                        pendingBranchEnd = null;
                    }
                    continue;
                }
                pendingBranchEnd = null;
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
                SH.openBranchFrame(branchFrameState, cmd.code, cmdIndent, f);
                f += Math.max(0, Math.floor(e.wait || 0));
                if (cmd.code === 404 || cmd.code === 412) {
                    pendingBranchEnd = { entry: e, indent: cmdIndent };
                }
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
        this.normalizeTrackExecutionMetadata(tr);
        SH.sortTrackCommands(tr);
        this.loadIfBranchViewModesForTrack(tr);
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
        var events = ($gameMap && Array.isArray($gameMap._events)) ? $gameMap._events : [];
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
            SH.sortTrackCommands(tr);
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
        if (!forceComplete) {
            var waitStatus = this.drainEditorMoveRouteWait(sf);
            if (waitStatus === 'waiting') return true;
            if (waitStatus === 'blocked') return false;
        }
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
            if (this.captureEditorMoveRouteWaitRemainder(st)) return true;
            if (this.isPlaybackBlocked()) return false;
        }

        this._frameExecState = null;
        return true;
    };

    EE.prototype.resetActiveEditorMoveRoutes = function() {
        this._activeEditorMoveRoutes = [];
        this._editorMoveRouteWaitState = null;
    };

    EE.prototype.captureEditorMoveRouteWaitRemainder = function(frameState) {
        var waitState = this._editorMoveRouteWaitState;
        if (!waitState || !frameState || !Array.isArray(frameState.list)) return false;
        waitState.pending = frameState.list.slice(Math.max(0, Math.floor(Number(frameState.index || 0))));
        waitState.pendingIndex = 0;
        frameState.index = frameState.list.length;
        this._frameExecState = null;
        return true;
    };

    EE.prototype.drainEditorMoveRouteWait = function(frame) {
        var state = this._editorMoveRouteWaitState;
        if (!state) return 'ready';
        if (state.character && state.character._moveRouteForcing) return 'waiting';
        this._editorMoveRouteWaitState = null;
        var pending = Array.isArray(state.pending) ? state.pending : [];
        var index = Math.max(0, Math.floor(Number(state.pendingIndex || 0)));
        while (index < pending.length) {
            if (this.isPlaybackBlocked()) {
                state.pendingIndex = index;
                this._editorMoveRouteWaitState = state;
                return 'blocked';
            }
            var entry = pending[index++];
            if (!this.shouldExecuteEntryByIfBranchRuntime(entry)) continue;
            this.execEntry(entry);
            var nextWait = this._editorMoveRouteWaitState;
            if (nextWait) {
                nextWait.pending = pending.slice(index);
                nextWait.pendingIndex = 0;
                return 'waiting';
            }
            if (this.isPlaybackBlocked()) {
                state.pending = pending;
                state.pendingIndex = index;
                this._editorMoveRouteWaitState = state;
                return 'blocked';
            }
        }
        return 'ready';
    };

    EE.prototype.activeEditorMoveRouteIndex = function(character) {
        var records = Array.isArray(this._activeEditorMoveRoutes) ? this._activeEditorMoveRoutes : [];
        for (var i = 0; i < records.length; i++) {
            if (records[i] && records[i].character === character) return i;
        }
        return -1;
    };

    EE.prototype.appendMoveRouteInterruptionLog = function(frame, oldRecord, newEntry) {
        if (!this.execLogView || !oldRecord || !newEntry) return;
        if (!Array.isArray(this.execLogLines)) this.execLogLines = [];
        var charId = (newEntry.charId == null)
            ? Number((((newEntry.command || {}).parameters || [0])[0] || 0))
            : Number(newEntry.charId || 0);
        var target = this.rowLabelForCharId(this.normalizeMoveTarget(charId));
        var oldSymbol = String(oldRecord.symbol || '');
        var newSymbol = String(this.routeSymbolForEntry(newEntry) || '');
        var text = '[' + Math.max(0, Math.floor(Number(frame || 0))) + 'f] ' + target +
            ' の移動ルート' + oldSymbol + 'が、移動ルート' + newSymbol + 'の開始により中断されました';
        this.execLogLines.push({
            text: text,
            nameText: text,
            mainColor: 'rgba(214,166,124,.98)',
            mainBold: true,
            logAction: 'move-route-interrupted',
            frame: Math.max(0, Math.floor(Number(frame || 0))),
            uid: Number(newEntry.uid || 0),
            routeListIndex: -1,
            indentLevel: 0
        });
        var lim = Math.max(20, Math.floor(Number(this.execLogMax || 240)));
        if (this.execLogLines.length > lim) this.execLogLines.splice(0, this.execLogLines.length - lim);
        this.renderExecutionLog(true);
    };

    EE.prototype.beginEditorMoveRouteExecution = function(interpreter, parameters, entry, frame) {
        if (!interpreter || !entry) return null;
        var character = null;
        try { character = interpreter.character(Number(parameters[0] || 0)); } catch (_) {}
        if (!character) return null;
        if (!Array.isArray(this._activeEditorMoveRoutes)) this._activeEditorMoveRoutes = [];
        var index = this.activeEditorMoveRouteIndex(character);
        if (index >= 0) {
            var oldRecord = this._activeEditorMoveRoutes[index];
            var stillActive = !!(character._moveRouteForcing && character._moveRoute === oldRecord.route);
            if (stillActive && !this._simToRunning && !this._eeInlineCommandExecution) {
                this.appendMoveRouteInterruptionLog(frame, oldRecord, entry);
            }
            this._activeEditorMoveRoutes.splice(index, 1);
        }
        return {
            character: character,
            route: parameters[1],
            entry: entry,
            symbol: this.routeSymbolForEntry(entry)
        };
    };

    EE.prototype.finishEditorMoveRouteExecution = function(state) {
        if (!state || !state.character || !state.route) return;
        if (state.character._moveRoute !== state.route) return;
        if (!Array.isArray(this._activeEditorMoveRoutes)) this._activeEditorMoveRoutes = [];
        var index = this.activeEditorMoveRouteIndex(state.character);
        if (index >= 0) this._activeEditorMoveRoutes.splice(index, 1);
        this._activeEditorMoveRoutes.push(state);
        var route = state.entry && state.entry.command && state.entry.command.parameters
            ? state.entry.command.parameters[1]
            : null;
        if (route && route.wait === true && !this._simToRunning && !this._eeInlineCommandExecution) {
            this._editorMoveRouteWaitState = {
                character: state.character,
                route: state.route,
                entry: state.entry,
                pending: [],
                pendingIndex: 0
            };
        }
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
        var moveRouteState = (code === 205)
            ? this.beginEditorMoveRouteExecution(it, p, e, af)
            : null;
        var lst = [];
        if (code === 101) {
            var pre = this.messageExtCommandsFromEntry(e);
            for (var pi = 0; pi < pre.length; pi++) {
                var pc = pre[pi];
                if (pc && Number(pc.code || 0) === 356) installEscapeConvertFallback();
                lst.push(clone(pc));
            }
            var portraitCommand = this.popupPortraitCommandFromEntry(e);
            if (portraitCommand) lst.push(clone(portraitCommand));
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
        var executed = false;
        try {
            // Execute sequentially until a command requests wait (returns false)
            // or the temporary list is consumed.
            while (it._list && it._index < it._list.length) {
                if (!it.executeCommand()) break;
            }
            executed = true;
        } catch (er) {
            if (code === 356) {
                this.fatal('E_EXEC_356', er);
                return;
            }
            this.err('E_EXEC_' + code, er);
        }
        if (executed && moveRouteState) this.finishEditorMoveRouteExecution(moveRouteState);
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

    //-------------------------------------------------------------------------
    // Timeline rows, character panels, and context editing
    //-------------------------------------------------------------------------

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
        if (!this.selKey && charId > 0) this.selectEvent(charId);
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
        this.selectBattleTrack(troopId, Math.max(0, Math.floor(Number(pageIndex || 0))));
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

    EE.prototype.characterSpriteCanvasBounds = function(sprite, character) {
        if (!sprite) return null;
        var frame = sprite._frame || sprite._lastFrame || null;
        var width = Math.max(0, Number(frame && frame.width || 0));
        var height = Math.max(0, Number(frame && frame.height || 0));
        if (width <= 0 || height <= 0) {
            try { width = Math.max(width, Number(sprite.patternWidth ? sprite.patternWidth() : 0)); } catch (_) {}
            try { height = Math.max(height, Number(sprite.patternHeight ? sprite.patternHeight() : 0)); } catch (_) {}
        }
        if (width <= 0 || height <= 0) return null;
        var anchorX = Number(sprite.anchor && sprite.anchor.x != null ? sprite.anchor.x : 0);
        var anchorY = Number(sprite.anchor && sprite.anchor.y != null ? sprite.anchor.y : 0);
        if (!isFinite(anchorX)) anchorX = 0;
        if (!isFinite(anchorY)) anchorY = 0;
        var pad = (sprite._yuraInfo && sprite._meshSprite) ? Math.max(2, Math.ceil(Math.max(width, height) * 0.08)) : 0;
        var left = -anchorX * width - pad;
        var top = -anchorY * height - pad;
        var right = left + width + pad * 2;
        var bottom = top + height + pad * 2;
        var wt = sprite.worldTransform;
        if (wt && isFinite(Number(wt.a)) && isFinite(Number(wt.d)) && isFinite(Number(wt.tx)) && isFinite(Number(wt.ty))) {
            var points = [
                { x: left, y: top }, { x: right, y: top },
                { x: left, y: bottom }, { x: right, y: bottom }
            ];
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < points.length; i++) {
                var px = Number(wt.a) * points[i].x + Number(wt.c || 0) * points[i].y + Number(wt.tx);
                var py = Number(wt.b || 0) * points[i].x + Number(wt.d) * points[i].y + Number(wt.ty);
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
            if (isFinite(minX) && isFinite(minY) && maxX > minX && maxY > minY) {
                return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }
        }
        var screenX = Number(sprite.x || 0);
        var screenY = Number(sprite.y || 0);
        try { if (character && character.screenX) screenX = Number(character.screenX()); } catch (_) {}
        try { if (character && character.screenY) screenY = Number(character.screenY()); } catch (_) {}
        return { x: screenX + left, y: screenY + top, width: right - left, height: bottom - top };
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
            if (!sp || !sp.visible || !sp._character) continue;
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
            var b = this.characterSpriteCanvasBounds(sp, ch);
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
        this.markDocumentEventDirty(eventId);
    };

    EE.prototype.contextEventAdjustOriginStepPercent = function(eventId) {
        var sp = this.contextEventAdjustRuntimeSprite(eventId);
        var h = 0;
        if (sp) {
            var b = this.characterSpriteCanvasBounds(sp, sp._character);
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
        if (type !== 'range') {
            this.trackDocumentEventForUndo(eventId);
            this.pushSnap('event-display-adjust');
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
        if (type === 'shift') this.msg('シフト調整: ←→↑↓で1px / Escで終了');
        else if (type === 'originY') this.msg('原点Y調整: ↑↓で1px / Escで終了');
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
            this.trackDocumentEventForUndo(eventId);
            this.pushSnap('event-range-adjust');
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
        if (!sp) {
            this.hideContextEventAdjustVisual();
            return;
        }
        var b = this.characterSpriteCanvasBounds(sp, sp._character);
        if (!b) {
            this.hideContextEventAdjustVisual();
            return;
        }
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
        this.trackDocumentEventForUndo(eventId);
        this.pushSnap('create-event');
        $dataMap.events[eventId] = this.buildDefaultMapEventData(eventId, placement.x, placement.y, placement.note);
        this.ensureRuntimeEventDataMetadata($dataMap.events[eventId]);
        var evObj = this.attachRuntimeMapEvent(eventId);
        if (!evObj || !($gameMap && typeof $gameMap.event === 'function' && $gameMap.event(eventId))) {
            $dataMap.events[eventId] = null;
            this.refreshDocumentEventRuntime(eventId);
            this.msg('イベント新規作成: ランタイム反映に失敗 (ID:' + eventId + ')');
            return;
        }
        var key = this.key(eventId, 0);
        this.ensureTrack(eventId, 0);
        this.commitTrackMutation({ trackKey: key, earliestChangedFrame: 0 });
        this.markDocumentEventDirty(eventId);
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
        this.commitTrackMutation({ rebuild: false, sort: false, earliestChangedFrame: oldEnd });
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
        this.commitTrackMutation({ rebuild: false, sort: false, earliestChangedFrame: oldEnd });
        this.seek(nextEnd);
        this.msg('終了位置: 最後のコマンド位置 (' + nextEnd + 'f)');
        return true;
    };

    EE.prototype.isSameFrameReorderTargetEntry = function(entry) {
        return this.isMainLaneDisplayEntry(entry);
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
        var hiddenByBranch = this.computeBranchHiddenUidMapForTrack(tr);
        if (this.isBranchEndEntry(e)) {
            out.canPrev = !!this.branchEndBoundaryMovePlan(tr, e, 'prev', hiddenByBranch);
            out.canNext = !!this.branchEndBoundaryMovePlan(tr, e, 'next', hiddenByBranch);
            out.show = out.canPrev || out.canNext;
            return out;
        }
        var ordered = tr.commands.filter(function(ce) {
            return ce &&
                !hiddenByBranch[String(Math.floor(Number(ce.uid || 0)))] &&
                this.isSameFrameReorderTargetEntry(ce) &&
                Math.max(0, Math.floor(Number(ce.frame || 0))) === out.frame;
        }, this).sort(compareEntriesByFrameWaitUid);
        if (ordered.length <= 1) return out;
        var idx = -1;
        for (var i = 0; i < ordered.length; i++) {
            if (Number(ordered[i].uid || 0) === out.uid) { idx = i; break; }
        }
        if (idx < 0) return out;
        var previous = idx > 0 ? ordered[idx - 1] : null;
        var next = idx < ordered.length - 1 ? ordered[idx + 1] : null;
        out.canPrev = !!previous && (!this.isBranchEndEntry(previous) || !!this.branchEndBoundaryMovePlan(tr, previous, 'next'));
        out.canNext = !!next && (!this.isBranchEndEntry(next) || !!this.branchEndBoundaryMovePlan(tr, next, 'prev'));
        out.show = out.canPrev || out.canNext;
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
        var hiddenByBranch = this.computeBranchHiddenUidMapForTrack(tr);
        var ordered = tr.commands.filter(function(ce) {
            return ce &&
                !hiddenByBranch[String(Math.floor(Number(ce.uid || 0)))] &&
                this.isSameFrameReorderTargetEntry(ce) &&
                Math.max(0, Math.floor(Number(ce.frame || 0))) === info.frame;
        }, this).sort(compareEntriesByFrameWaitUid);
        var idx = -1;
        for (var i = 0; i < ordered.length; i++) {
            if (Number(ordered[i].uid || 0) === uid) { idx = i; break; }
        }
        if (idx < 0) return false;
        var target = (dir === 'prev') ? ordered[idx - 1] : ordered[idx + 1];
        var selfEntry = this.findEntryInSelectedTrack(uid);
        if (!selfEntry || !target) return false;
        if (this.isBranchEndEntry(selfEntry)) {
            var boundaryPlan = this.branchEndBoundaryMovePlan(tr, selfEntry, dir);
            if (!boundaryPlan) return false;
            this.pushSnap('reorderBranchEnd');
            if (!this.applyBranchEndBoundaryMovePlan(tr, boundaryPlan)) return false;
            this.selUid = Math.floor(Number(selfEntry.uid || 0));
            this.selRouteListIndex = -1;
            this.selBranchBoundaryPart = 'end';
            this.frame = Math.max(0, Math.floor(Number(selfEntry.frame || info.frame || this.frame || 0)));
            this.commitTrackMutation({ earliestChangedFrame: info.frame });
            this.seek(this.frame);
            this.refreshRouteRangeContextMenu();
            return true;
        }
        if (this.isBranchEndEntry(target)) {
            var targetBoundaryDir = dir === 'prev' ? 'next' : 'prev';
            var targetBoundaryPlan = this.branchEndBoundaryMovePlan(tr, target, targetBoundaryDir);
            if (!targetBoundaryPlan) return false;
            this.pushSnap('reorderBranchEnd');
            if (!this.applyBranchEndBoundaryMovePlan(tr, targetBoundaryPlan)) return false;
            this.selUid = Math.floor(Number(selfEntry.uid || 0));
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(selfEntry.frame || info.frame || this.frame || 0)));
            this.commitTrackMutation({ earliestChangedFrame: info.frame });
            this.seek(this.frame);
            this.refreshRouteRangeContextMenu();
            return true;
        }
        this.pushSnap('reorderFrame');
        var selfOrder = Number(selfEntry.executionOrder);
        var targetOrder = Number(target.executionOrder);
        if (!isFinite(selfOrder)) selfOrder = Number(selfEntry.uid || 0);
        if (!isFinite(targetOrder)) targetOrder = Number(target.uid || 0);
        selfEntry.executionOrder = targetOrder;
        target.executionOrder = selfOrder;
        this.selUid = uid;
        this.selRouteListIndex = -1;
        this.frame = Math.max(0, Math.floor(Number(selfEntry.frame || info.frame || this.frame || 0)));
        this.commitTrackMutation({ earliestChangedFrame: info.frame });
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
        var earliestChangedFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        var route = entry.command.parameters && entry.command.parameters[1];
        if (!route || typeof route !== 'object') route = this.defaultMoveRoute();
        route.list = this.routeListFromBlocks(preview.blocks);
        if (!Array.isArray(entry.command.parameters)) entry.command.parameters = [entry.charId || 0, route];
        entry.command.parameters[1] = route;
        entry.wait = this.commandWaitFrames(entry.command);
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (fromRangeSelection && this.hasRangeSelection && this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            var kind = String(rs.kind || 'rect');
            if (kind !== 'memory' && kind !== 'rect' && kind !== 'items') kind = 'rect';
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
        this.commitTrackMutation({ earliestChangedFrame: earliestChangedFrame });
        this.seek(this.frame);
        return true;
    };

    EE.prototype.nudgeEntriesByFrames = function(entryUids, delta, fromRangeSelection) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var seen = Object.create(null);
        var moved = [];
        var earliestChangedFrame = Infinity;
        entryUids = Array.isArray(entryUids) ? entryUids : [];
        if (!fromRangeSelection && entryUids.length === 1) {
            var boundaryEntry = this.findEntryInSelectedTrack(Math.floor(Number(entryUids[0] || 0)));
            var boundaryEdge = this.isBranchEndEntry(boundaryEntry)
                ? 'end'
                : (this.isBranchOwnerEntry(boundaryEntry) ? 'start' : '');
            if (boundaryEdge) {
                var boundaryContext = this.resolveBranchBoundaryContextForEntry(boundaryEntry, tr);
                var boundaryOwnerUid = boundaryContext && boundaryContext.ownerEntry
                    ? Math.floor(Number(boundaryContext.ownerEntry.uid || 0))
                    : 0;
                var boundaryTarget = Math.floor(Number(boundaryEntry.frame || 0)) + delta;
                var boundaryPlan = this.branchBoundaryMovePlan(tr, boundaryOwnerUid, boundaryEdge, boundaryTarget);
                if (!boundaryPlan || !boundaryPlan.valid || !boundaryPlan.changed) return false;
                this.pushSnap(boundaryEdge === 'end' ? 'branchEndFrame' : 'branchStartFrame');
                var boundaryResult = this.applyBranchBoundaryMovePlan(tr, boundaryPlan);
                if (!boundaryResult || !boundaryResult.changed) return false;
                this.selUid = boundaryEntry.uid;
                this.selRouteListIndex = -1;
                if (boundaryEdge === 'end') this.selBranchBoundaryPart = 'end';
                this.frame = boundaryResult.frame;
                this.commitTrackMutation({ earliestChangedFrame: boundaryResult.earliestChangedFrame });
                this.seek(this.frame);
                return true;
            }
        }
        for (var i = 0; i < entryUids.length; i++) {
            var uid = Math.floor(Number(entryUids[i] || 0));
            if (uid <= 0 || seen[uid]) continue;
            seen[uid] = true;
            var e = this.findEntryInSelectedTrack(uid);
            if (!e) continue;
            var nf = Math.floor(Number(e.frame || 0)) + delta;
            if (nf < 0) return false;
            earliestChangedFrame = Math.min(earliestChangedFrame, Math.max(0, Math.floor(Number(e.frame || 0))), nf);
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
        if (fromRangeSelection && this.hasRangeSelection && this.hasRangeSelection()) {
            this.shiftCurrentRangeSelectionByFrames(delta);
        } else if (selFrame != null) {
            this.frame = Math.max(0, Math.floor(Number(selFrame || 0)));
        }
        this.commitTrackMutation({ earliestChangedFrame: earliestChangedFrame });
        this.seek(this.frame);
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
        if (reason === 'mixed_selection') return '通常コマンドと移動ルート内コマンドは同時コピーできません';
        if (reason === 'mixed_route') return '複数の移動ルートにまたがるコピーはできません';
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
        if (reason === 'route_target_required') return '移動ルート内またはキャラクター行の貼り付け先を選択してください';
        if (reason === 'overlap') return '貼り付け先でコマンドが重なります';
        return '貼り付けできません';
    };

    EE.prototype.collectMoveRouteClipboardCommands = function() {
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return { ok: false, reason: 'no_track' };
        var routeItems = [];
        if (this.hasRangeSelection && this.hasRangeSelection()) {
            routeItems = this.selectedRouteCmdItemsFromRange();
            if (!routeItems.length) return { ok: false, reason: 'no_selection' };
            if (this.selectedEntryUidsFromRange().length) return { ok: false, reason: 'mixed_selection' };
        } else {
            var uid = Math.floor(Number(this.selUid || 0));
            var routeListIndex = this.nodeRouteIndex(this.selRouteListIndex);
            if (uid <= 0 || routeListIndex < 0) return { ok: false, reason: 'no_selection' };
            routeItems = [{ kind: 'routeCmd', uid: uid, routeListIndex: routeListIndex }];
        }
        var ownerUid = Math.floor(Number(routeItems[0] && routeItems[0].uid || 0));
        if (ownerUid <= 0) return { ok: false, reason: 'no_selection' };
        var entry = this.findEntryInSelectedTrack(ownerUid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return { ok: false, reason: 'no_selection' };
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var indexes = [];
        var seen = Object.create(null);
        for (var i = 0; i < routeItems.length; i++) {
            var item = routeItems[i];
            if (Math.floor(Number(item && item.uid || 0)) !== ownerUid) return { ok: false, reason: 'mixed_route' };
            var idx = this.nodeRouteIndex(item.routeListIndex);
            if (idx < 0 || idx >= list.length || seen[idx] || Number((list[idx] || {}).code || 0) === 0) continue;
            seen[idx] = true;
            indexes.push(idx);
        }
        indexes.sort(function(a, b) { return a - b; });
        if (!indexes.length) return { ok: false, reason: 'no_selection' };
        var commands = [];
        for (i = 0; i < indexes.length; i++) commands.push(clone(list[indexes[i]]));
        return { ok: true, ownerUid: ownerUid, entry: entry, indexes: indexes, commands: commands };
    };

    EE.prototype.buildMoveRouteClipboardFromSelection = function() {
        var picked = this.collectMoveRouteClipboardCommands();
        if (!picked.ok) return picked;
        return {
            ok: true,
            clip: { type: 'move_route_commands_v1', commands: picked.commands },
            ownerUid: picked.ownerUid,
            sourceIndexes: picked.indexes
        };
    };

    EE.prototype.buildClipboardFromCurrentSelection = function() {
        var hasRouteSelection = this.nodeRouteIndex(this.selRouteListIndex) >= 0;
        if (this.hasRangeSelection && this.hasRangeSelection()) {
            hasRouteSelection = this.selectedRouteCmdItemsFromRange().length > 0;
        }
        return hasRouteSelection ? this.buildMoveRouteClipboardFromSelection() : this.buildTimelineClipboardFromSelection();
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
                e.executionOrder = null;
                e.routeSymbolOrdinal = 0;
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
            SH.sortTrackCommands(temp);
        }
        return { ok: true };
    };

    EE.prototype.timelineClipboardPasteCapability = function(ctx) {
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return { enabled: false, reason: 'no_track' };
        var clip = this.timelineCommandClipboard;
        if (!clip) return { enabled: false, reason: 'no_clipboard' };
        if (clip.type === 'move_route_commands_v1') return this.moveRouteClipboardPasteCapability(ctx);
        var target = this.timelinePasteTargetFromContext(ctx);
        var prepared = this.prepareTimelineClipboardEntriesForPaste(clip, target);
        if (!prepared.ok) return { enabled: false, reason: prepared.reason, target: target };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        var check = this.canPastePreparedTimelineEntries(tr, prepared.entries);
        if (!check.ok) return { enabled: false, reason: check.reason, target: target, conflictEntry: check.conflictEntry, tempTrack: check.tempTrack };
        return { enabled: true, target: target, entries: prepared.entries };
    };

    EE.prototype.currentMoveRoutePasteContext = function(ctx) {
        if (ctx && typeof ctx === 'object') return this.resolveWaitInsertContext(ctx);
        var uid = Math.floor(Number(this.selUid || 0));
        var idx = this.nodeRouteIndex(this.selRouteListIndex);
        if (uid > 0 && idx >= 0) return this.makeWaitInsertContextFromRouteCommand(uid, idx, this.frame);
        return this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
    };

    EE.prototype.prepareNewMoveRouteForClipboardPaste = function(clip, target) {
        var pasteTarget = this.timelinePasteTargetFromContext(target);
        var rowKey = String(pasteTarget.rowKey || 'main');
        if (rowKey.indexOf('char:') !== 0) return { ok: false, reason: 'route_target_required' };
        var charId = this.normalizeMoveTarget(Number(rowKey.replace('char:', '')));
        var commands = [];
        for (var i = 0; i < clip.commands.length; i++) {
            var command = clone(clip.commands[i]);
            if (!command || Number(command.code || 0) <= 0) return { ok: false, reason: 'invalid_clipboard' };
            commands.push(command);
        }
        commands.push({ code: 0, parameters: [] });
        var entry = this.entryFromCommand({
            code: 205,
            indent: 0,
            parameters: [charId, { repeat: false, skippable: false, wait: false, list: commands }]
        }, this.selEid, this.selPage, pasteTarget.frame, -1);
        if (!entry) return { ok: false, reason: 'invalid_entry' };
        this.recalculateRouteTileGotoWaitMetaForEntry(entry);
        entry.wait = this.commandWaitFrames(entry.command);
        return { ok: true, entry: entry, insertIndex: 0, count: commands.length - 1 };
    };

    EE.prototype.moveRouteClipboardPasteCapability = function(ctx) {
        var clip = this.timelineCommandClipboard;
        if (!clip || clip.type !== 'move_route_commands_v1' || !Array.isArray(clip.commands) || !clip.commands.length) {
            return { enabled: false, reason: 'invalid_clipboard' };
        }
        var target = this.currentMoveRoutePasteContext(ctx);
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (String(target.source || '') !== 'routeCmd') {
            var created = this.prepareNewMoveRouteForClipboardPaste(clip, target);
            if (!created.ok) return { enabled: false, reason: created.reason };
            if (!tr || this.isIntervalLockedByMoveRouteWait(tr, created.entry.frame, created.entry.frame, 0) ||
                !this.canPlaceEntry(tr, created.entry, created.entry.frame, created.entry.rowKey, 0)) {
                return { enabled: false, reason: 'overlap', conflictEntry: created.entry, tempTrack: tr };
            }
            return {
                enabled: true,
                createNew: true,
                previewEntry: created.entry,
                insertIndex: created.insertIndex,
                count: created.count
            };
        }
        var uid = Math.floor(Number(target.uid || 0));
        var anchorIndex = this.nodeRouteIndex(target.routeListIndex);
        var entry = this.findEntryInSelectedTrack(uid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return { enabled: false, reason: 'route_target_required' };
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        if (anchorIndex < 0 || anchorIndex >= list.length || Number((list[anchorIndex] || {}).code || 0) === 0) {
            return { enabled: false, reason: 'route_target_required' };
        }
        var previewEntry = clone(entry);
        var previewRoute = previewEntry.command.parameters && previewEntry.command.parameters[1];
        previewRoute = this.ensureMoveRouteTerminal(previewRoute);
        previewEntry.command.parameters[1] = previewRoute;
        var insertIndex = Math.min(anchorIndex + 1, this.moveRouteTerminalIndex(previewRoute));
        var pasted = [];
        for (var i = 0; i < clip.commands.length; i++) {
            var command = clone(clip.commands[i]);
            if (!command || Number(command.code || 0) <= 0) return { enabled: false, reason: 'invalid_clipboard' };
            previewRoute.list.splice(insertIndex + pasted.length, 0, command);
            pasted.push(command);
        }
        this.recalculateRouteTileGotoWaitMetaForEntry(previewEntry);
        previewEntry.wait = this.commandWaitFrames(previewEntry.command);
        if (!tr || !this.canPlaceEntry(tr, previewEntry, previewEntry.frame, previewEntry.rowKey, previewEntry.uid)) {
            return { enabled: false, reason: 'overlap', conflictEntry: previewEntry, tempTrack: tr };
        }
        return { enabled: true, entry: entry, previewEntry: previewEntry, insertIndex: insertIndex, count: pasted.length };
    };

    EE.prototype.copy = function() {
        var pack = this.buildClipboardFromCurrentSelection();
        if (!pack.ok) {
            this.msg('コピー不可: ' + this.timelineClipboardCopyReasonText(pack.reason));
            return false;
        }
        this.timelineCommandClipboard = clone(pack.clip);
        this.clip = (pack.clip.items && pack.clip.items.length) ? clone(pack.clip.items[0].command) : null;
        var count = pack.clip.type === 'move_route_commands_v1' ? pack.clip.commands.length : pack.sourceUids.length;
        this.msg('コピーしました: ' + count + '件');
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
        var earliestChangedFrame = Infinity;
        for (i = 0; i < tr.commands.length; i++) {
            if (del[Math.floor(Number((tr.commands[i] && tr.commands[i].uid) || 0))]) {
                earliestChangedFrame = Math.min(earliestChangedFrame, Math.max(0, Math.floor(Number(tr.commands[i].frame || 0))));
            }
        }
        this.pushSnap(String(snapLabel || 'del'));
        tr.commands = tr.commands.filter(function(e) {
            return !del[Math.floor(Number((e && e.uid) || 0))];
        });
        this.selUid = 0;
        this.selRouteListIndex = -1;
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        this.commitTrackMutation({ earliestChangedFrame: earliestChangedFrame });
        this.playFrom(this.frame);
        return count;
    };

    EE.prototype.cut = function() {
        var pack = this.buildClipboardFromCurrentSelection();
        if (!pack.ok) {
            this.msg('切り取り不可: ' + this.timelineClipboardCopyReasonText(pack.reason));
            return false;
        }
        this.timelineCommandClipboard = clone(pack.clip);
        this.clip = (pack.clip.items && pack.clip.items.length) ? clone(pack.clip.items[0].command) : null;
        if (pack.clip.type === 'move_route_commands_v1') {
            var entry = this.findEntryInSelectedTrack(pack.ownerUid);
            var route = entry && entry.command && entry.command.parameters && entry.command.parameters[1];
            if (!entry || !route || !Array.isArray(route.list)) return false;
            this.pushSnap('cutRouteCmd');
            for (var ri = pack.sourceIndexes.length - 1; ri >= 0; ri--) route.list.splice(pack.sourceIndexes[ri], 1);
            route = this.ensureMoveRouteTerminal(route);
            entry.command.parameters[1] = route;
            entry.wait = this.commandWaitFrames(entry.command);
            if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
            this.selUid = Number(entry.uid || 0);
            this.selRouteListIndex = -1;
            this.commitTrackMutation({ earliestChangedFrame: entry.frame });
            this.playFrom(this.frame);
            this.msg('切り取りました: ' + pack.sourceIndexes.length + '件');
            return true;
        }
        var removed = this.deleteEntriesByUidList(pack.sourceUids, 'cut');
        if (removed <= 0) return false;
        this.msg('切り取りました: ' + removed + '件');
        return true;
    };

    EE.prototype.paste = function() {
        var isRouteClipboard = !!(this.timelineCommandClipboard && this.timelineCommandClipboard.type === 'move_route_commands_v1');
        var baseCtx = isRouteClipboard
            ? this.currentMoveRoutePasteContext()
            : this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        var cap = this.timelineClipboardPasteCapability(baseCtx);
        if (!cap.enabled) {
            if (String(cap.reason || '') === 'overlap' && cap.conflictEntry) {
                try { this.logDropConflictDetail(cap.tempTrack || (this.model && this.model.tracks ? this.model.tracks[this.selKey] : null), cap.conflictEntry, cap.conflictEntry.frame, cap.conflictEntry.rowKey, 0, 'paste'); } catch (_) {}
            }
            this.msg('貼り付け不可: ' + this.timelineClipboardPasteReasonText(cap.reason));
            return false;
        }
        if (this.timelineCommandClipboard && this.timelineCommandClipboard.type === 'move_route_commands_v1') {
            return this.applyMoveRouteClipboardPaste(cap);
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
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        if (first) {
            this.selUid = Number(first.uid || 0);
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(first.frame || this.frame || 0)));
        }
        this.commitTrackMutation({
            earliestChangedFrame: entries.length
                ? Math.min.apply(null, entries.map(function(e) { return Math.max(0, Math.floor(Number(e && e.frame || 0))); }))
                : this.frame
        });
        this.playFrom(this.frame);
        this.msg('貼り付けました: ' + entries.length + '件');
        return true;
    };

    EE.prototype.applyMoveRouteClipboardPaste = function(cap) {
        if (!cap || !cap.enabled || !cap.previewEntry) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        if (!cap.createNew && !cap.entry) return false;
        this.pushSnap('pasteRouteCmd');
        var entry = cap.entry;
        if (cap.createNew) {
            entry = clone(cap.previewEntry);
            entry.uid = this.model.nextUid++;
            tr.commands.push(entry);
            this.confirmCharRowPermanent(entry.charId);
            this.frame = Math.max(0, Math.floor(Number(entry.frame || this.frame || 0)));
        } else {
            entry.command = clone(cap.previewEntry.command);
            entry.wait = this.commandWaitFrames(entry.command);
        }
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        this.selUid = Number(entry.uid || 0);
        this.selRouteListIndex = this.nodeRouteIndex(cap.insertIndex);
        var selectedItems = [];
        for (var i = 0; i < Math.max(0, Math.floor(Number(cap.count || 0))); i++) {
            selectedItems.push({ kind: 'routeCmd', uid: this.selUid, routeListIndex: cap.insertIndex + i });
        }
        if (selectedItems.length > 1) this.setRangeSelection('rect', selectedItems, { frameStart: this.frame, frameEnd: this.frame });
        this.commitTrackMutation({
            earliestChangedFrame: Math.min(
                Math.max(0, Math.floor(Number(entry.frame || 0))),
                Math.max(0, Math.floor(Number(cap.previewEntry.frame || 0)))
            )
        });
        this.playFrom(this.frame);
        this.msg('貼り付けました: ' + cap.count + '件');
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
            this.msg('貼り付け不可: ' + this.timelineClipboardPasteReasonText(cap.reason));
            return false;
        }
        if (this.timelineCommandClipboard && this.timelineCommandClipboard.type === 'move_route_commands_v1') {
            return this.applyMoveRouteClipboardPaste(cap);
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
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        if (first) {
            this.selUid = Number(first.uid || 0);
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(first.frame || this.frame || 0)));
        }
        this.commitTrackMutation({
            earliestChangedFrame: entries.length
                ? Math.min.apply(null, entries.map(function(e) { return Math.max(0, Math.floor(Number(e && e.frame || 0))); }))
                : this.frame
        });
        this.playFrom(this.frame);
        this.msg('貼り付けました: ' + entries.length + '件');
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
        if (this.isBranchEndEntry(entry)) return null;
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
        this.commitTrackMutation({ rebuild: false, sort: false, earliestChangedFrame: entry.frame });
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
        var copyProbe = this.buildClipboardFromCurrentSelection();
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

    //-------------------------------------------------------------------------
    // Timeline layout, hit testing, and range manipulation
    //-------------------------------------------------------------------------

    EE.prototype.syncTimelineSize = function(maxF) {
        if (!this.timeline || !this.timelineWrap) return;
        var p = this._timelineViewPending;
        if (p && String(p.selKey || '') === String(this.selKey || '')) {
            var ppf = Number(p.pxPerFrame);
            if (isFinite(ppf) && ppf > 0) {
                this.pxPerFrame = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, ppf));
            }
        }
        if (!isFinite(Number(maxF)) || Number(maxF) <= 0) maxF = this.maxFrame();
        else maxF = Math.max(1, Math.floor(Number(maxF)));
        var tr = this.selectedTrack();
        var trackRevision = this._trackRevisionByKey && this.selKey
            ? Math.floor(Number(this._trackRevisionByKey[this.selKey] || 0))
            : 0;
        var autoViewSignature = (tr && this._timelineAutoIfViewTrack === tr)
            ? String(this._timelineAutoIfViewSignature || '')
            : this.autoIfBranchViewSignatureForTrack(tr);
        var autoLayout = !!autoViewSignature;
        var rowLayoutSig = String(this.selKey || '') + '|' + String(this._scheduleRev || 0) + '|' +
            String(trackRevision) + '|' + String(tr && tr.endFrame || 0) + '|' + (autoLayout ? autoViewSignature : 'fixed');
        if (rowLayoutSig !== this._timelineRowLayoutSig || !Array.isArray(this._rowMetrics)) {
            var rows = this.getTrackRows(tr);
            this._rows = rows;
            var hiddenByIf = tr ? this.computeIfBranchHiddenUidMapForTrack(tr) : Object.create(null);
            var charLaneInfo = this.buildCharRouteLaneMap(tr, hiddenByIf);
            this._charLaneByUid = charLaneInfo.laneByUid || {};
            this._charStackByRow = charLaneInfo.stackByRow || {};
            this._mainStackMax = this.mainStackMax(tr);
            this._rowMetrics = this.buildRowMetrics(rows, this._mainStackMax, this._charStackByRow);
            this._timelineRowLayoutSig = rowLayoutSig;
        }
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
        if (Number(this.timeline.width || 0) !== this.tw) this.timeline.width = this.tw;
        if (Number(this.timeline.height || 0) !== this.th) this.timeline.height = this.th;
        if (this.timelineOverlay) {
            if (Number(this.timelineOverlay.width || 0) !== this.tw) this.timelineOverlay.width = this.tw;
            if (Number(this.timelineOverlay.height || 0) !== this.th) this.timelineOverlay.height = this.th;
        }
        var styleWidth = this.tw + 'px';
        var styleHeight = this.th + 'px';
        if (this.timeline.style.width !== styleWidth) this.timeline.style.width = styleWidth;
        if (this.timeline.style.height !== styleHeight) this.timeline.style.height = styleHeight;
        if (this.timelineOverlay) {
            if (this.timelineOverlay.style.width !== styleWidth) this.timelineOverlay.style.width = styleWidth;
            if (this.timelineOverlay.style.height !== styleHeight) this.timelineOverlay.style.height = styleHeight;
        }
        if (this.zoomInfo) {
            var zoomText = '表示倍率: ' + this.pxPerFrame.toFixed(3) + ' px/フレーム（目盛り上のホイール: ' +
                this.minPxPerFrame.toFixed(3) + ' ～ ' + this.maxPxPerFrame.toFixed(3) + '）';
            if (this.zoomInfo.textContent !== zoomText) this.zoomInfo.textContent = zoomText;
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
            if (!this.isMainLaneDisplayEntry(e)) continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f !== targetFrame) continue;
            count += this.mainLaneDisplaySlotCountForEntry(e);
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
            if (!this.isMainLaneDisplayEntry(e)) continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            c[f] = (c[f] || 0) + this.mainLaneDisplaySlotCountForEntry(e);
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

    EE.prototype.buildCharRouteLaneMap = function(tr, hiddenByIf) {
        var laneByUid = {};
        var stackByRow = {};
        if (!tr || !Array.isArray(tr.commands)) return { laneByUid: laneByUid, stackByRow: stackByRow };
        hiddenByIf = hiddenByIf || this.computeIfBranchHiddenUidMapForTrack(tr);
        var byRow = Object.create(null);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 205) continue;
            if (hiddenByIf[String(Math.floor(Number(e.uid || 0)))]) continue;
            var rowKey = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            if (rowKey.indexOf('char:') !== 0) continue;
            if (!byRow[rowKey]) byRow[rowKey] = [];
            byRow[rowKey].push(e);
        }
        var rowKeys = Object.keys(byRow);
        for (var ri = 0; ri < rowKeys.length; ri++) {
            var rk = rowKeys[ri];
            var entries = byRow[rk];
            entries.sort(compareEntriesByFrameWaitUid);
            var laneEnds = [];
            for (var ei = 0; ei < entries.length; ei++) {
                e = entries[ei];
                var start = Math.max(0, Math.floor(Number(e.frame || 0)));
                var end = start + Math.max(1, Math.floor(Number(this.routeExecutionSpanFramesForEntry(e) || 1)));
                var lane = 0;
                while (lane < laneEnds.length && laneEnds[lane] > start) lane++;
                if (lane === laneEnds.length) laneEnds.push(end);
                else laneEnds[lane] = end;
                laneByUid[e.uid] = lane;
            }
            stackByRow[rk] = Math.max(1, laneEnds.length);
        }
        return { laneByUid: laneByUid, stackByRow: stackByRow };
    };

    EE.prototype.charRowHeight = function(stackCount) {
        stackCount = Math.max(1, Math.floor(Number(stackCount || 1)));
        var h = this.charLaneTop + this.charLaneBottom + (stackCount - 1) * this.charLaneGap;
        return Math.max(this.rowH, h);
    };

    EE.prototype.buildRowMetrics = function(rows, maxMainStack, charStackByRow) {
        rows = rows || [];
        charStackByRow = charStackByRow || {};
        var out = [];
        var y = this.rulerH;
        for (var i = 0; i < rows.length; i++) {
            var h = (rows[i].key === 'main')
                ? this.mainRowHeight(maxMainStack)
                : this.charRowHeight(charStackByRow[rows[i].key] || 1);
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

    EE.prototype.timelineEntryVisualSpanFrames = function(entry) {
        if (!entry) return 1;
        var span = Math.max(0, Math.floor(Number(entry.wait || 0)));
        var command = entry.command;
        if (command && Number(command.code || 0) === 205) {
            var route = command.parameters && command.parameters[1];
            var timeline = this.moveRouteTimeline(route);
            span = Math.max(span, Math.floor(Number(timeline && timeline.totalFrames || 0)));
        }
        return Math.max(1, span);
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
        if (typeof this.isPointInTimelineFixedLabel === 'function' && this.isPointInTimelineFixedLabel(x)) return false;
        return true;
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
        if (!Array.isArray(this.hitNodes) || !this.hitNodes.length) return null;
        var best = null;
        var bestDistance = Infinity;
        var bestDepth = -1;
        var bestBoundaryPriority = -1;
        var bestIndex = -1;
        var legacyLastHit = null;
        var hasBranchHit = false;
        for (var i = 0; i < this.hitNodes.length; i++) {
            var n = this.hitNodes[i];
            var radius = this.scaleTimelineCircleRadius(Number(n.r || 0)) + 4;
            if (!this.timelineCircleHitPoint(x, y, n.x, n.y, radius)) continue;
            legacyLastHit = n;
            if (n.branchBoundary || n.branchDragBoundary) hasBranchHit = true;
            var distance = this.timelineCircleHitDistance2(x, y, n.x, n.y);
            var depth = Math.max(0, Math.floor(Number(n.branchNestingDepth || 0)));
            var boundaryPriority = n.branchBoundary ? 2 : (n.branchDragBoundary ? 1 : 0);
            var nearer = distance < bestDistance - 0.01;
            var sameDistance = Math.abs(distance - bestDistance) <= 0.01;
            if (!best || nearer || (sameDistance && (
                depth > bestDepth ||
                (depth === bestDepth && boundaryPriority > bestBoundaryPriority) ||
                (depth === bestDepth && boundaryPriority === bestBoundaryPriority && i > bestIndex)
            ))) {
                best = n;
                bestDistance = distance;
                bestDepth = depth;
                bestBoundaryPriority = boundaryPriority;
                bestIndex = i;
            }
        }
        return hasBranchHit ? best : legacyLastHit;
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

    EE.prototype.hitTestBranchModeButton = function(x, y) {
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
        var boundaryPart = node ? String(node.branchBoundary || '') : '';
        var changed = (uid !== Number(this.hoverUid || 0)) ||
            (routeListIndex !== this.nodeRouteIndex(this.hoverRouteListIndex)) ||
            (boundaryPart !== String(this.hoverBranchBoundaryPart || ''));
        this.hoverUid = uid;
        this.hoverRouteListIndex = routeListIndex;
        this.hoverBranchBoundaryPart = boundaryPart;
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
        if (kind !== 'memory' && kind !== 'rect' && kind !== 'items') kind = 'none';
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

    EE.prototype.normalizeTimelineSelectionItem = function(item) {
        var items = this.normalizeRangeSelectionItems(item ? [item] : []);
        return items.length ? items[0] : null;
    };

    EE.prototype.currentTimelineSelectionItem = function() {
        var uid = Math.floor(Number(this.selUid || 0));
        if (uid <= 0) return null;
        var routeListIndex = this.nodeRouteIndex(this.selRouteListIndex);
        return this.normalizeTimelineSelectionItem(routeListIndex >= 0
            ? { kind: 'routeCmd', uid: uid, routeListIndex: routeListIndex }
            : { kind: 'entry', uid: uid });
    };

    EE.prototype.timelineSelectionItemsWithCurrent = function() {
        var items = this.hasRangeSelection() && this.rangeSelection
            ? this.normalizeRangeSelectionItems(this.rangeSelection.items || [])
            : [];
        if (!items.length) {
            var current = this.currentTimelineSelectionItem();
            if (current) items.push(current);
        }
        return this.normalizeRangeSelectionItems(items);
    };

    EE.prototype.setTimelineSelectionAnchorItem = function(item) {
        var normalized = this.normalizeTimelineSelectionItem(item);
        if (!normalized) {
            this.timelineSelectionAnchor = null;
            return;
        }
        normalized.trackKey = String(this.selKey || '');
        this.timelineSelectionAnchor = normalized;
    };

    EE.prototype.timelineSelectionAnchorItem = function() {
        var anchor = this.timelineSelectionAnchor;
        if (!anchor || String(anchor.trackKey || '') !== String(this.selKey || '')) return null;
        var normalized = this.normalizeTimelineSelectionItem(anchor);
        if (!normalized) return null;
        var entry = this.findEntryInSelectedTrack(normalized.uid);
        if (!entry) return null;
        if (normalized.kind === 'routeCmd') {
            var route = entry.command && entry.command.parameters && entry.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            var idx = this.nodeRouteIndex(normalized.routeListIndex);
            if (idx < 0 || idx >= list.length || Number((list[idx] || {}).code || 0) <= 0) return null;
        }
        return normalized;
    };

    EE.prototype.timelineSelectionItemFrame = function(item) {
        item = this.normalizeTimelineSelectionItem(item);
        if (!item) return 0;
        var entry = this.findEntryInSelectedTrack(item.uid);
        if (!entry) return 0;
        var frame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        if (item.kind === 'routeCmd') {
            var timelineItem = this.routeCommandTimelineItemByListIndex(entry, item.routeListIndex);
            if (timelineItem) frame += Math.max(0, Math.floor(Number(timelineItem.offset || 0)));
        }
        return frame;
    };

    EE.prototype.timelineSelectionDomainKey = function(item) {
        item = this.normalizeTimelineSelectionItem(item);
        if (!item) return '';
        if (item.kind === 'routeCmd') return 'route:' + item.uid;
        var entry = this.findEntryInSelectedTrack(item.uid);
        if (!entry) return '';
        return 'row:' + String(entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main'));
    };

    EE.prototype.orderedTimelineSelectionItems = function(item) {
        item = this.normalizeTimelineSelectionItem(item);
        if (!item) return [];
        var out = [];
        if (item.kind === 'routeCmd') {
            var entry = this.findEntryInSelectedTrack(item.uid);
            var route = entry && entry.command && entry.command.parameters && entry.command.parameters[1];
            var timeline = this.moveRouteTimeline(route);
            var routeItems = timeline && Array.isArray(timeline.items) ? timeline.items : [];
            for (var i = 0; i < routeItems.length; i++) {
                var routeItem = routeItems[i];
                var code = Math.floor(Number(routeItem && routeItem.displayCode || 0));
                if (code <= 0 || code === 15) continue;
                out.push({ kind: 'routeCmd', uid: item.uid, routeListIndex: this.nodeRouteIndex(routeItem.listIndex) });
            }
            return this.normalizeRangeSelectionItems(out);
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return [];
        var domain = this.timelineSelectionDomainKey(item);
        var hidden = this.computeIfBranchHiddenUidMapForTrack
            ? this.computeIfBranchHiddenUidMapForTrack(tr)
            : Object.create(null);
        for (i = 0; i < tr.commands.length; i++) {
            var commandEntry = tr.commands[i];
            if (!commandEntry || !commandEntry.command || Number(commandEntry.command.code || 0) <= 0) continue;
            if (hidden[String(Math.floor(Number(commandEntry.uid || 0)))]) continue;
            var rowKey = String(commandEntry.rowKey || (commandEntry.rowType === 'char' ? ('char:' + commandEntry.charId) : 'main'));
            if (domain !== 'row:' + rowKey) continue;
            out.push({ kind: 'entry', uid: commandEntry.uid });
        }
        return this.normalizeRangeSelectionItems(out);
    };

    EE.prototype.timelineSelectionInclusiveRange = function(anchor, target) {
        anchor = this.normalizeTimelineSelectionItem(anchor);
        target = this.normalizeTimelineSelectionItem(target);
        if (!anchor || !target) return target ? [target] : [];
        if (this.timelineSelectionDomainKey(anchor) !== this.timelineSelectionDomainKey(target)) return [target];
        var ordered = this.orderedTimelineSelectionItems(target);
        var anchorKey = this.rangeSelectionItemKey(anchor);
        var targetKey = this.rangeSelectionItemKey(target);
        var ai = -1, ti = -1;
        for (var i = 0; i < ordered.length; i++) {
            var key = this.rangeSelectionItemKey(ordered[i]);
            if (key === anchorKey) ai = i;
            if (key === targetKey) ti = i;
        }
        if (ai < 0 || ti < 0) return [target];
        return ordered.slice(Math.min(ai, ti), Math.max(ai, ti) + 1);
    };

    EE.prototype.applyTimelineItemSelection = function(items, focusItem, nonContiguous) {
        items = this.normalizeRangeSelectionItems(items);
        focusItem = this.normalizeTimelineSelectionItem(focusItem);
        if (!items.length) {
            this.clearRangeSelection();
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.timelineDirty = true;
            return;
        }
        var selectedMap = Object.create(null);
        var frameStart = Infinity;
        var frameEnd = 0;
        for (var i = 0; i < items.length; i++) {
            selectedMap[this.rangeSelectionItemKey(items[i])] = true;
            var itemFrame = this.timelineSelectionItemFrame(items[i]);
            frameStart = Math.min(frameStart, itemFrame);
            frameEnd = Math.max(frameEnd, itemFrame);
        }
        if (!focusItem || !selectedMap[this.rangeSelectionItemKey(focusItem)]) focusItem = items[items.length - 1];
        if (items.length === 1) {
            this.clearRangeSelection();
        } else {
            this.setRangeSelection('items', items, {
                frameStart: isFinite(frameStart) ? frameStart : 0,
                frameEnd: frameEnd,
                rects: [],
                nonContiguous: !!nonContiguous
            });
        }
        this.selUid = Math.floor(Number(focusItem.uid || 0));
        this.selRouteListIndex = focusItem.kind === 'routeCmd'
            ? this.nodeRouteIndex(focusItem.routeListIndex)
            : -1;
        this.selBranchBoundaryPart = '';
        this.frame = this.timelineSelectionItemFrame(focusItem);
        this.timelineDirty = true;
    };

    EE.prototype.applyTimelineModifierSelection = function(target, inputEvent) {
        target = this.normalizeTimelineSelectionItem(target);
        if (!target) return false;
        inputEvent = inputEvent || {};
        var ctrl = !!(inputEvent.ctrlKey || inputEvent.metaKey);
        var shift = !!inputEvent.shiftKey;
        if (!ctrl && !shift) return false;
        var current = this.timelineSelectionItemsWithCurrent();
        var anchor = this.timelineSelectionAnchorItem() || this.currentTimelineSelectionItem() || (current.length ? current[0] : null);
        var next = [];
        if (shift) {
            var sameDomain = !!anchor && this.timelineSelectionDomainKey(anchor) === this.timelineSelectionDomainKey(target);
            var range = sameDomain ? this.timelineSelectionInclusiveRange(anchor, target) : [target];
            next = ctrl ? current.concat(range) : range;
            if (!sameDomain) this.setTimelineSelectionAnchorItem(target);
        } else {
            next = current.slice(0);
            var targetKey = this.rangeSelectionItemKey(target);
            var found = -1;
            for (var i = 0; i < next.length; i++) {
                if (this.rangeSelectionItemKey(next[i]) === targetKey) { found = i; break; }
            }
            if (found >= 0) next.splice(found, 1);
            else next.push(target);
            this.setTimelineSelectionAnchorItem(target);
        }
        next = this.normalizeRangeSelectionItems(next);
        this.applyTimelineItemSelection(next, target, ctrl);
        return true;
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
            // Include already-validated entries so wait locks and other real
            // conflicts are checked between items in the same batch as well.
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
        var earliestChangedFrame = Math.max(0, Math.floor(Number(this.rangeSelection && this.rangeSelection.frameStart || 0)));
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

        this.clearRangeSelection();
        this.commitTrackMutation({ earliestChangedFrame: earliestChangedFrame });
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
            this.selBranchBoundaryPart = '';
            var memoryItems = this.normalizeRangeSelectionItems(this.rangeSelection && this.rangeSelection.items || []);
            this.setTimelineSelectionAnchorItem(memoryItems.length ? memoryItems[0] : null);
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
        var finalItems = this.normalizeRangeSelectionItems(this.rangeSelection && this.rangeSelection.items || []);
        this.setTimelineSelectionAnchorItem(finalItems.length ? finalItems[0] : null);
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
        var selectedItems = this.normalizeRangeSelectionItems(rs.items || []);
        var hasEntryItems = false;
        var hasRouteItems = false;
        for (var si = 0; si < selectedItems.length; si++) {
            if (selectedItems[si].kind === 'routeCmd') hasRouteItems = true;
            else hasEntryItems = true;
        }
        if (hasEntryItems && hasRouteItems) return false;
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
                    var oldCharId = this.normalizeMoveTarget(Number(de.charId || 0));
                    var cid = this.normalizeMoveTarget(Number(de.rowKey.replace('char:', '')));
                    de.rowType = 'char';
                    de.charId = cid;
                    if (de.command && Number(de.command.code || 0) === 205) {
                        if (!Array.isArray(de.command.parameters)) de.command.parameters = [cid, this.defaultMoveRoute()];
                        de.command.parameters[0] = cid;
                        if (cid !== oldCharId) de.routeSymbolOrdinal = 0;
                    }
                } else {
                    de.rowType = 'main';
                    de.charId = null;
                }
            }
        }
        this.commitTrackMutation({ earliestChangedFrame: 0 });
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
        this.commitTrackMutation({ earliestChangedFrame: cap.start });
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
        SH.sortTrackCommands(tr);

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

        SH.sortTrackCommands(tr);
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
        this.commitTrackMutation({ earliestChangedFrame: fs });
        this.seek(this.frame);
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
        if (this.hasRangeSelection()) this.clearRangeSelection();
        this.selUid = keepUid;
        this.selRouteListIndex = -1;
        this.frame = Math.max(0, Math.floor(Number(keep.frame || 0)));
        this.commitTrackMutation({
            earliestChangedFrame: cap.entries.length
                ? Math.max(0, Math.floor(Number(cap.entries[0].frame || 0)))
                : keep.frame
        });
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
        this.commitTrackMutation({
            earliestChangedFrame: Math.min.apply(null, updates.map(function(update) {
                return Math.max(0, Math.floor(Number(update.entry && update.entry.frame || 0)));
            }))
        });
        this.seek(this.frame);
        this.closeMessageBubbleBulkDialog();
        this.msg('ふきだし位置一括設定: ' + updates.length + '件');
    };

    //-------------------------------------------------------------------------
    // Tooltips and command descriptions
    //-------------------------------------------------------------------------

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
            404: '選択肢分岐終了',
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
            var routeSymbol = this.routeSymbolForEntry(entry);
            text = '移動ルート' + routeSymbol + ' / 対象:' + target +
                (route ? ' / 完了までウェイト:' + (route.wait ? 'ON' : 'OFF') + ' / コマンド数:' + cmds : '');
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
            return SH.compareEntriesByFrameWaitUid(a, b);
        });
        return list;
    };

    EE.prototype.tooltipLinesForEntry = function(entry, indent, opt) {
        if (!entry || !entry.command) return [];
        indent = String(indent == null ? '' : indent);
        opt = opt || {};
        if (opt.excludeMoveRoute205 && Number(entry.command.code || 0) === 205) return [];
        var rowKey = String(entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main'));
        var rawCode = Math.floor(Number(entry.command.code || 0));
        var isBoundaryEnd = rawCode === COMMAND_CODE.CHOICE_END || rawCode === COMMAND_CODE.CONDITIONAL_END;
        var boundaryContext = isBoundaryEnd ? this.resolveBranchBoundaryContextForEntry(entry) : null;
        if (isBoundaryEnd && !boundaryContext) {
            boundaryContext = {
                type: rawCode === COMMAND_CODE.CHOICE_END ? 'choice' : 'if',
                nestingDepth: 0
            };
        }
        var boundaryColor = boundaryContext ? this.branchBoundaryColorForContext(boundaryContext) : '';
        var cmdRawColor = boundaryColor || this.commandNodeFillColorForEntry(entry, -1, rowKey);
        var cmdColor = opt.color || boundaryColor || this.commandTextColorForEntry(entry, -1, rowKey);
        var bulletColor = opt.bulletColor || cmdRawColor;
        var detailColor = opt.detailColor || cmdColor;
        var code = this.mainCommandDisplayCodeForEntry(entry);
        var nm = this.commandNameJa(code);
        if (entry.command && Number(entry.command.code || 0) === 205) {
            nm += this.routeSymbolForEntry(entry) + ' [' + this.rowLabelForCharId(this.normalizeMoveTarget(entry.charId)) + ']';
        }
        var bullet = (code === COMMAND_CODE.CHOICE_END || code === COMMAND_CODE.CONDITIONAL_END) ? '○' : '●';
        var out = [{ text: indent + bullet + nm, dim: !!opt.dim, color: cmdColor, bold: !!opt.bold, bulletWhite: true, bulletColor: bulletColor }];
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
        return this.findTrackEntryByUid(this.selectedTrack(), uid);
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
        if (hit.branchBoundary) {
            var branchKind = String(hit.branchType || '') === 'choice' ? '選択肢' : '条件';
            var boundaryName = String(hit.branchBoundary || '') === 'start' ? '分岐開始' : '分岐終了';
            var boundaryColor = this.branchBoundaryColorForContext({
                type: String(hit.branchType || '') === 'choice' ? 'choice' : 'if',
                nestingDepth: Math.max(0, Math.floor(Number(hit.branchNestingDepth || 0)))
            });
            return [{ text: '○' + branchKind + boundaryName, dim: false, color: boundaryColor }];
        }
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
                routeOwnerLabel = this.rowLabelForCharId(this.normalizeMoveTarget(routeOwnerCharId)) +
                    ' / 移動ルート' + this.routeSymbolForEntry(routeOwnerEntry);
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
                routeOwnerLabel = this.rowLabelForCharId(this.normalizeMoveTarget(eCharId)) +
                    ' / 移動ルート' + this.routeSymbolForEntry(e);
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
                    // Same-frame commands are serialized by executionOrder.
                    if (os > frame && os < end) return false;
                }
            } else {
                if (ow > 0) {
                    // Same-frame placement is valid; executionOrder decides which runs first.
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

    SH.registerModule('render', ['branch'], [
        'playFrom',
        'seek',
        'pre',
        'execAt',
        'copy',
        'cut',
        'paste'
    ]);
})();
