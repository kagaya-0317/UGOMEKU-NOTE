//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Edit
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editing operations v0.3.0
 * @author kagaya
 * @help
 * Internal module loaded by KNH_ZXC_EventEditor_Timeline.js.
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
    var COMMAND_CODE = SH.COMMAND_CODE;
    SH.beginModule('edit');

    //-------------------------------------------------------------------------
    // Timeline editing, insertion, clipboard, and selection operations
    //-------------------------------------------------------------------------

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
        var choiceBranchViewMode = '';
        if (e && e.command && Number(e.command.code || 0) === 111 && typeof this.getIfBranchViewModeForEntry === 'function') {
            try { ifBranchViewMode = this.sanitizeIfBranchViewMode(this.getIfBranchViewModeForEntry(e)); } catch (_) { ifBranchViewMode = ''; }
        }
        if (e && e.command && Number(e.command.code || 0) === 102 && typeof this.getChoiceBranchViewModeForEntry === 'function') {
            try { choiceBranchViewMode = this.sanitizeChoiceBranchViewMode(this.getChoiceBranchViewModeForEntry(e)); } catch (_) { choiceBranchViewMode = ''; }
        }
        return {
            source: 'command',
            uid: uid,
            frame: frame,
            includeSameFrameOnAfter: true,
            defaultFrames: 60,
            ifBranchViewMode: ifBranchViewMode,
            choiceBranchViewMode: choiceBranchViewMode
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
            var cvm = String(c.choiceBranchViewMode || '').toLowerCase();
            if (cvm === 'auto' || cvm === 'cancel' || /^\d+$/.test(cvm)) c.choiceBranchViewMode = cvm;
            else c.choiceBranchViewMode = '';
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
        return SH.findEntryIndexByUid(list, uid);
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

    EE.prototype.resolveChoiceBranchInsertionInfoByUid = function(uid, tr) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return null;
        var choiceEntry = this.findEntryInSelectedTrack(uid);
        if (!choiceEntry || !choiceEntry.command || Number(choiceEntry.command.code || 0) !== 102) return null;
        tr = tr || this.resolveTrackForIfBranchEntry(choiceEntry);
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return null;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var list = Array.isArray(info.list) ? info.list : [];
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        var block = null;
        for (var i = 0; i < blocks.length; i++) {
            if (Math.floor(Number(blocks[i] && blocks[i].choiceUid || 0)) === uid) {
                block = blocks[i];
                break;
            }
        }
        if (!block) return null;
        var modeMap = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);
        var range = this.choiceBranchActiveRangeForBlock(tr, info, block, modeMap);
        if (!range) return null;
        var markerIndex = Math.max(0, Math.floor(Number(range.startIndex || 0)) - 1);
        var markerEntry = markerIndex >= 0 && markerIndex < list.length ? list[markerIndex] : null;
        var markerCode = Math.floor(Number(markerEntry && markerEntry.command && markerEntry.command.code || 0));
        if (markerCode !== 402 && markerCode !== 403) return null;
        var firstBranchEntry = null;
        for (i = range.startIndex; i < range.stopIndex && i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            if (code === 402 || code === 403 || code === 404) continue;
            firstBranchEntry = e;
            break;
        }
        var endIndex = Math.floor(Number(block.endIndex == null ? list.length : block.endIndex));
        if (endIndex < 0 || endIndex > list.length) endIndex = list.length;
        return {
            choiceUid: uid,
            choiceEntry: choiceEntry,
            block: block,
            list: list,
            info: info,
            anchorEntry: markerEntry,
            anchorIndex: markerIndex,
            firstBranchEntry: firstBranchEntry,
            branchIndent: Math.max(0, Math.floor(Number(choiceEntry.command.indent || 0))) + 1,
            startIndex: range.startIndex,
            stopIndex: range.stopIndex,
            endIndex: endIndex,
            endIndexInclusive: Math.max(0, list.length - 1)
        };
    };

    EE.prototype.resolveChoiceBranchScopeForEntryUid = function(uid, tr) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return null;
        var entry = this.findEntryInSelectedTrack(uid);
        if (!entry || !entry.command) return null;
        tr = tr || this.resolveTrackForIfBranchEntry(entry);
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return null;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var list = Array.isArray(info.list) ? info.list : [];
        var entryIndex = this.ifBranchFindEntryIndexByUid(list, uid);
        if (entryIndex < 0) return null;
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        var best = null;
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            if (!block || !Array.isArray(block.branches)) continue;
            for (var bi = 0; bi < block.branches.length; bi++) {
                var branch = block.branches[bi];
                if (!branch) continue;
                var startIndex = Math.max(0, Math.floor(Number(branch.startIndex || 0)));
                var stopIndex = Math.floor(Number(branch.endIndex == null ? block.endIndex : branch.endIndex));
                if (stopIndex < startIndex || stopIndex > list.length) stopIndex = list.length;
                if (entryIndex < startIndex || entryIndex >= stopIndex) continue;
                var candidate = { block: block, branch: branch, startIndex: startIndex, stopIndex: stopIndex };
                if (!best || Math.floor(Number(block.indent || 0)) > Math.floor(Number(best.block.indent || 0)) ||
                    (Math.floor(Number(block.indent || 0)) === Math.floor(Number(best.block.indent || 0)) &&
                     stopIndex - startIndex < best.stopIndex - best.startIndex)) {
                    best = candidate;
                }
            }
        }
        if (!best) return null;
        var endIndex = Math.floor(Number(best.block.endIndex == null ? list.length : best.block.endIndex));
        if (endIndex < 0 || endIndex > list.length) endIndex = list.length;
        return {
            tr: tr,
            info: info,
            list: list,
            entry: entry,
            entryIndex: entryIndex,
            block: best.block,
            branch: best.branch,
            branchIndent: Math.max(0, Math.floor(Number(best.block.indent || 0))) + 1,
            startIndex: best.startIndex,
            stopIndex: best.stopIndex,
            endIndex: endIndex,
            endIndexInclusive: Math.max(0, list.length - 1)
        };
    };

    EE.prototype.resolveBranchScopeForEntryUid = function(uid, tr) {
        var ifScope = this.resolveIfBranchScopeForEntryUid(uid, tr);
        var choiceScope = this.resolveChoiceBranchScopeForEntryUid(uid, tr);
        if (!ifScope) return choiceScope;
        if (!choiceScope) return ifScope;
        var ifIndent = Math.max(0, Math.floor(Number(ifScope.block && ifScope.block.indent || 0)));
        var choiceIndent = Math.max(0, Math.floor(Number(choiceScope.block && choiceScope.block.indent || 0)));
        if (choiceIndent > ifIndent) return choiceScope;
        if (ifIndent > choiceIndent) return ifScope;
        var ifSpan = Math.max(1, ifScope.stopIndex - ifScope.startIndex);
        var choiceSpan = Math.max(1, choiceScope.stopIndex - choiceScope.startIndex);
        return choiceSpan < ifSpan ? choiceScope : ifScope;
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
            branchOwnerUid: 0,
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
                    out.branchOwnerUid = Math.floor(Number(branchInfo.ifUid || 0));
                    if (Array.isArray(branchInfo.list) && branchInfo.anchorIndex >= 0) {
                        out.branchShiftUidMap = this.buildIfBranchShiftUidMap(
                            branchInfo.list,
                            branchInfo.anchorIndex + 1,
                            branchInfo.endIndexInclusive
                        );
                    }
                }
            } else if (anchor && anchor.command && Number(anchor.command.code || 0) === 102 && pos === 'after') {
                var choiceInfo = this.resolveChoiceBranchInsertionInfoByUid(out.uid);
                if (choiceInfo && choiceInfo.anchorEntry) {
                    out.uid = Math.floor(Number(choiceInfo.anchorEntry.uid || out.uid));
                    out.frame = Math.max(0, Math.floor(Number(choiceInfo.anchorEntry.frame || out.frame)));
                    out.branchInsertIndent = Math.max(0, Math.floor(Number(choiceInfo.branchIndent || 0)));
                    out.branchOwnerUid = Math.floor(Number(choiceInfo.choiceUid || 0));
                    out.branchShiftUidMap = this.buildIfBranchShiftUidMap(
                        choiceInfo.list,
                        choiceInfo.anchorIndex + 1,
                        choiceInfo.endIndexInclusive
                    );
                }
            } else {
                var scope = this.resolveBranchScopeForEntryUid(out.uid);
                if (scope && scope.entry && scope.entry.command) {
                    out.branchInsertIndent = Math.max(0, Math.floor(Number(
                        scope.branchIndent == null ? scope.entry.command.indent : scope.branchIndent
                    )));
                    out.branchOwnerUid = Math.floor(Number(
                        (scope.block && (scope.block.ifUid || scope.block.choiceUid)) || 0
                    ));
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
            branchOwnerUid: Math.floor(Number(c.branchOwnerUid || c.branchIfUid || 0)),
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
        this.commitTrackMutation({ earliestChangedFrame: startFrame });
        this.seek(this.frame);
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
        this.commitTrackMutation({ earliestChangedFrame: minShiftFrame });
        this.seek(this.frame);
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
        this.selUid = Number(entry.uid || 0);
        this.selRouteListIndex = selRouteIdx;
        this.frame = Math.max(0, Math.floor(Number(insFrame || this.frame || 0)));
        this.commitTrackMutation({ earliestChangedFrame: entry.frame });
        this.seek(this.frame);
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
        this.commitTrackMutation({ earliestChangedFrame: e.frame });
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
        this.charCtxShiftAdjustBtn.textContent = hasTargetEvent ? 'シフト調整' : 'イベントのみ';
        this.charCtxOriginAdjustBtn.disabled = !hasTargetEvent;
        this.charCtxOriginAdjustBtn.textContent = hasTargetEvent ? '原点Y調整' : 'イベントのみ';
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

    EE.prototype.battleEventSettingsTargetTroopData = function() {
        var tid = Math.max(1, Math.floor(Number(this.battleEventSettingsTargetTroopId || this.currentBattleTroopId() || 0)));
        if (this.battleEventSettingsDraftTroop && Number(this.battleEventSettingsDraftTroop.id || 0) === tid) {
            return this.battleEventSettingsDraftTroop;
        }
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

    EE.prototype.battleEventSettingsCreateDraft = function(troop) {
        if (!troop || !Array.isArray(troop.pages)) return null;
        var draft = clone(troop);
        var troopId = Math.max(1, Math.floor(Number(draft.id || this.battleEventSettingsTargetTroopId || 0)));
        var tracks = this.model && this.model.tracks ? this.model.tracks : {};
        var keys = Object.keys(tracks);
        for (var i = 0; i < keys.length; i++) {
            var tr = tracks[keys[i]];
            if (!tr || Number(tr.eventId || 0) !== troopId) continue;
            var pageIndex = Math.max(0, Math.floor(Number(tr.pageIndex || 0)));
            if (!draft.pages[pageIndex] || typeof this.listFromTrack !== 'function') continue;
            draft.pages[pageIndex].list = clone(this.listFromTrack(tr));
        }
        this.battleEventSettingsDraftOriginal = clone(draft);
        return draft;
    };

    EE.prototype.battleEventSettingsStoreCurrentPageToDraft = function() {
        var troop = this.battleEventSettingsTargetTroopData();
        if (!troop || troop !== this.battleEventSettingsDraftTroop || !Array.isArray(troop.pages) || !troop.pages.length) return false;
        var pageIndex = Math.max(0, Math.floor(Number(this.battleEventSettingsTargetPageIndex || 0)));
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
        return true;
    };

    EE.prototype.battleEventSettingsChangePage = function(pageIndex) {
        var troop = this.battleEventSettingsTargetTroopData();
        if (!troop || !Array.isArray(troop.pages) || !troop.pages.length) return;
        this.battleEventSettingsStoreCurrentPageToDraft();
        var next = Math.max(0, Math.floor(Number(pageIndex || 0)));
        if (next >= troop.pages.length) next = troop.pages.length - 1;
        if (this.battleEventSettingsPageSelect) this.battleEventSettingsPageSelect.value = String(next);
        this.loadBattleEventSettingsPageFromForm();
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
        this.battleEventSettingsDraftTroop = this.battleEventSettingsCreateDraft(troop);
        if (!this.battleEventSettingsDraftTroop) return;
        troop = this.battleEventSettingsDraftTroop;
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
        this.battleEventSettingsDraftTroop = null;
        this.battleEventSettingsDraftOriginal = null;
    };

    EE.prototype.applyBattleEventSettingsEditor = function() {
        var troop = this.battleEventSettingsTargetTroopData();
        if (!troop || !Array.isArray(troop.pages) || !troop.pages.length) {
            this.closeBattleEventSettingsEditor();
            return;
        }
        if (!this.battleEventSettingsStoreCurrentPageToDraft()) {
            this.closeBattleEventSettingsEditor();
            return;
        }
        var troopId = Math.max(1, Math.floor(Number(this.battleEventSettingsTargetTroopId || 0)));
        var pageIndex = Math.max(0, Math.floor(Number(this.battleEventSettingsTargetPageIndex || 0)));
        var changed = true;
        try { changed = JSON.stringify(troop) !== JSON.stringify(this.battleEventSettingsDraftOriginal); } catch (_) { changed = true; }
        if (!changed) {
            this.closeBattleEventSettingsEditor();
            this.msg('戦闘イベント設定: 変更なし');
            return;
        }
        if (!this._documentUndoTroopIds) this._documentUndoTroopIds = {};
        this._documentUndoTroopIds[troopId] = true;
        this.pushSnap('battle-event-settings');
        $dataTroops[troopId] = clone(troop);
        if (!this.documentDirty) this.documentDirty = { events: {}, troops: {} };
        if (!this.documentDirty.troops) this.documentDirty.troops = {};
        this.documentDirty.troops[troopId] = true;
        this.selectBattleTrack(troopId, pageIndex);
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
                    self.eventSettingsChangePage(idx);
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
        if (this.eventSettingsDraftEvent && Number(this.eventSettingsDraftEvent.id || 0) === eid &&
            Array.isArray(this.eventSettingsDraftEvent.pages)) {
            return this.eventSettingsDraftEvent;
        }
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
        if (!evData || !Array.isArray(evData.pages)) return null;
        return evData;
    };

    EE.prototype.eventSettingsDefaultPageData = function() {
        return this.eventSettingsEnsurePage({});
    };

    EE.prototype.eventSettingsMarkPageStructureChanged = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        if (!this.eventSettingsDraftEvent || Number(this.eventSettingsDraftEvent.id || 0) !== eventId) return;
        this.timelineDirty = true;
    };

    EE.prototype.eventSettingsChangePage = function(pageIndex) {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        if (typeof this.eventSettingsStoreCurrentPageToDraft === 'function') {
            this.eventSettingsStoreCurrentPageToDraft();
        }
        var next = Math.max(0, Math.floor(Number(pageIndex || 0)));
        if (next >= evData.pages.length) next = evData.pages.length - 1;
        if (this.eventSettingsPageSelect) this.eventSettingsPageSelect.value = String(next);
        this.loadEventSettingsEditorPageFromForm();
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
        this.eventSettingsStoreCurrentPageToDraft();
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        var insertAt = Math.max(0, idx + 1);
        evData.pages.splice(insertAt, 0, this.eventSettingsDefaultPageData());
        this.eventSettingsDraftPageTokens.splice(insertAt, 0, 'new:' + String(this.eventSettingsDraftNextPageToken++));
        this.eventSettingsMarkPageStructureChanged(this.eventSettingsTargetEventId);
        this.eventSettingsRebuildPageSelectOptions(evData, insertAt);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページ作成');
    };

    EE.prototype.eventSettingsCopyPage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        this.eventSettingsStoreCurrentPageToDraft();
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
        this.eventSettingsStoreCurrentPageToDraft();
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        evData.pages[idx] = this.eventSettingsEnsurePage(clone(this.eventSettingsPageClipboard));
        this.eventSettingsDraftPageTokens[idx] = 'new:' + String(this.eventSettingsDraftNextPageToken++);
        this.eventSettingsMarkPageStructureChanged(this.eventSettingsTargetEventId);
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
        this.eventSettingsStoreCurrentPageToDraft();
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        evData.pages.splice(idx, 1);
        this.eventSettingsDraftPageTokens.splice(idx, 1);
        var next = Math.max(0, Math.min(evData.pages.length - 1, idx));
        this.eventSettingsMarkPageStructureChanged(this.eventSettingsTargetEventId);
        this.eventSettingsRebuildPageSelectOptions(evData, next);
        this.loadEventSettingsEditorPageFromForm();
        this.eventSettingsRefreshPageActionButtons();
        this.msg('EVページ削除');
    };

    EE.prototype.eventSettingsClearPage = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) return;
        this.eventSettingsStoreCurrentPageToDraft();
        var idx = Math.max(0, Math.floor(Number(this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || 0)));
        if (idx >= evData.pages.length) idx = evData.pages.length - 1;
        evData.pages[idx] = this.eventSettingsDefaultPageData();
        this.eventSettingsDraftPageTokens[idx] = 'new:' + String(this.eventSettingsDraftNextPageToken++);
        this.eventSettingsMarkPageStructureChanged(this.eventSettingsTargetEventId);
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
            var bmp = (SH.loadCharacterBitmapIfExists ? SH.loadCharacterBitmapIfExists(name) : ImageManager.loadCharacter(name));
            if (!bmp) {
                if (this.eventSettingsImageInfo) this.eventSettingsImageInfo.textContent = '画像が見つかりません: ' + name;
                return;
            }
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
        var self = this;
        this.openEditorPromptDialog({
            title: '自律移動ルートの編集',
            label: 'route.list 配列、または route オブジェクト（Ctrl+Enterで確定）',
            multiline: true,
            value: JSON.stringify(src.list, null, 2),
            onApply: function(raw) { return self.applyEventSettingsMoveRouteJson(src, raw); }
        });
    };

    EE.prototype.applyEventSettingsMoveRouteJson = function(src, raw) {
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
            return true;
        } catch (e) {
            this.err('E_EVENT_SETTINGS_ROUTE_JSON', e);
            return false;
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

    EE.prototype.openCharacterImagePickerPromptFallback = function(options) {
        options = options || {};
        var value = options.value || {};
        var curName = String(value.fileName || '');
        var curIndex = Math.max(0, Math.min(7, Math.floor(Number(value.index || 0) || 0)));
        var curDir = this.normalizeDirection8(Number(value.direction || 2), 2);
        var curPat = Math.max(0, Math.min(2, Math.floor(Number(value.pattern == null ? 1 : value.pattern) || 0)));
        var dflt = curName + ',' + curIndex + ',' + curDir + ',' + curPat;
        var self = this;
        return this.openEditorPromptDialog({
            title: 'キャラクター画像の指定',
            label: '画像名, 番号(0-7), 向き(2/4/6/8), パターン(0-2)',
            value: dflt,
            onApply: function(raw) {
                var a = String(raw || '').split(',');
                var name = String(a[0] == null ? curName : a[0]).trim().replace(/\.png$/i, '');
                if (options.allowNone === false && !name.length) {
                    self.msg('画像名を入力してください');
                    return false;
                }
                var result = {
                    fileName: name,
                    index: Math.max(0, Math.min(7, Math.floor(Number(a[1] == null ? curIndex : a[1]) || curIndex))),
                    direction: self.normalizeDirection8(Number(a[2] == null ? curDir : a[2]), 2),
                    pattern: Math.max(0, Math.min(2, Math.floor(Number(a[3] == null ? curPat : a[3]) || curPat)))
                };
                if (typeof options.onApply === 'function') options.onApply(result);
                return true;
            }
        });
    };

    EE.prototype.applyCharacterImagePickerResultToEventSettings = function(result) {
        if (!result) return;
        if (this.eventSettingsUseTile) this.eventSettingsUseTile.checked = false;
        if (this.eventSettingsCharName) this.eventSettingsCharName.value = String(result.fileName || '');
        if (this.eventSettingsCharIndex) this.eventSettingsCharIndex.value = String(result.index || 0);
        if (this.eventSettingsDirection) this.eventSettingsDirection.value = String(result.direction || 2);
        if (this.eventSettingsPattern) this.eventSettingsPattern.value = String(result.pattern == null ? 1 : result.pattern);
        if (this.eventSettingsNoteInput && result.cssRectTouched) {
            this.eventSettingsNoteInput.value = this.upsertEventSettingsCssRectInNote(
                String(this.eventSettingsNoteInput.value || ''),
                result.cssRect
            );
        }
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
        var request = this.characterImagePickerRequest || {};
        if (!request.allowCssRect) return false;
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
        var request = this.characterImagePickerRequest || {};
        var all = request.allowNone === false ? names.slice(0) : [''].concat(names);
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
            var bmp = (SH.loadCharacterBitmapIfExists ? SH.loadCharacterBitmapIfExists(name) : ImageManager.loadCharacter(name));
            this.eventSettingsImagePickerBitmap = bmp || null;
            if (!bmp) {
                if (info) info.textContent = '画像が見つかりません: ' + name;
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
        var request = this.characterImagePickerRequest || null;
        if (apply) {
            var name = String(this.eventSettingsImagePickerName || '');
            var idx = Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsImagePickerIndex || 0))));
            var dir = Math.floor(Number(this.eventSettingsImagePickerDirection || 2));
            if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
            var pat = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsImagePickerPattern == null ? 1 : this.eventSettingsImagePickerPattern))));
            if (name.length && typeof ImageManager !== 'undefined' && ImageManager && typeof ImageManager.isBigCharacter === 'function') {
                if (ImageManager.isBigCharacter(name)) idx = 0;
            }
            if (!request || request.allowNone !== false || name.length) {
                var result = {
                    fileName: name,
                    index: idx,
                    direction: dir,
                    pattern: pat,
                    cssRectTouched: !!this.eventSettingsImagePickerCssRectTouched,
                    cssRect: this.eventSettingsImagePickerCssRectDraft
                };
                if (request && typeof request.onApply === 'function') request.onApply(result);
            }
        }
        this.eventSettingsImagePickerCssRectMode = false;
        this.eventSettingsImagePickerCssRectTouched = false;
        this.eventSettingsImagePickerCssRectDragging = null;
        this.eventSettingsImagePickerModal.classList.remove('on');
        this.characterImagePickerRequest = null;
        if (this.characterImagePickerTitle) this.characterImagePickerTitle.firstChild.nodeValue = '画像の選択';
    };

    EE.prototype.openCharacterImagePicker = function(options) {
        options = options || {};
        if (!this.eventSettingsImagePickerModal || !this.eventSettingsImagePickerList || !this.eventSettingsImagePickerCanvas) {
            return this.openCharacterImagePickerPromptFallback(options);
        }
        var value = options.value || {};
        var curName = String(value.fileName || '').replace(/\.png$/i, '');
        var curIndex = Math.max(0, Math.min(7, Math.floor(Number(value.index || 0) || 0)));
        var curDir = this.normalizeDirection8(Number(value.direction || 2), 2);
        var curPat = Math.max(0, Math.min(2, Math.floor(Number(value.pattern == null ? 1 : value.pattern) || 0)));
        var names = this.eventSettingsCharacterImageNames();
        if (curName.length && names.indexOf(curName) < 0) names.unshift(curName);
        this.eventSettingsImagePickerNames = names;
        this.eventSettingsImagePickerName = curName;
        this.eventSettingsImagePickerIndex = curIndex;
        this.eventSettingsImagePickerDirection = curDir;
        this.eventSettingsImagePickerPattern = curPat;
        this.eventSettingsImagePickerBitmap = null;
        this.characterImagePickerRequest = {
            allowNone: options.allowNone !== false,
            allowCssRect: !!options.allowCssRect,
            onApply: typeof options.onApply === 'function' ? options.onApply : null
        };
        if (this.characterImagePickerTitle) this.characterImagePickerTitle.firstChild.nodeValue = String(options.title || '画像の選択');
        var parsedCssRect = options.cssRect || null;
        this.eventSettingsImagePickerCssRectDraft = parsedCssRect
            ? this.normalizeEventSettingsCssRect(parsedCssRect, { x: 0, y: 0, width: 0, height: 0 })
            : { x: 0, y: 0, width: 0, height: 0 };
        this.eventSettingsImagePickerCssRectMode = false;
        this.eventSettingsImagePickerCssRectTouched = false;
        this.eventSettingsImagePickerCssRectDragging = null;
        var showCssRect = !!options.allowCssRect;
        if (this.eventSettingsImagePickerCssRectModeBtn) this.eventSettingsImagePickerCssRectModeBtn.style.display = showCssRect ? '' : 'none';
        if (this.eventSettingsImagePickerCssRectClearBtn) this.eventSettingsImagePickerCssRectClearBtn.style.display = showCssRect ? '' : 'none';
        if (this.eventSettingsImagePickerCssRectStatus) this.eventSettingsImagePickerCssRectStatus.style.display = showCssRect ? '' : 'none';
        this.renderEventSettingsImagePickerList();
        this.renderEventSettingsImagePickerSheet();
        this.eventSettingsRefreshImagePickerCssRectUi();
        this.eventSettingsImagePickerModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.eventSettingsImagePickerModal);
        this.scheduleEventSettingsImagePickerScrollSync();
        return true;
    };

    EE.prototype.openEventSettingsImagePickerPrompt = function() {
        var self = this;
        var parsedCssRect = this.parseEventSettingsCssRectNote(
            String(this.eventSettingsNoteInput && this.eventSettingsNoteInput.value || '')
        );
        return this.openCharacterImagePicker({
            title: 'イベント画像の選択',
            allowNone: true,
            allowCssRect: true,
            cssRect: parsedCssRect,
            value: {
                fileName: String(this.eventSettingsCharName && this.eventSettingsCharName.value || ''),
                index: Number(this.eventSettingsCharIndex && this.eventSettingsCharIndex.value || 0),
                direction: Number(this.eventSettingsDirection && this.eventSettingsDirection.value || 2),
                pattern: Number(this.eventSettingsPattern && this.eventSettingsPattern.value || 1)
            },
            onApply: function(result) { self.applyCharacterImagePickerResultToEventSettings(result); }
        });
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
        var editingDraft = !!(this.eventSettingsDraftEvent && Number(this.eventSettingsDraftEvent.id || 0) === eventId);
        var tr = (!editingDraft && this.model && this.model.tracks) ? this.model.tracks[key] : null;
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
        var evData = this.eventSettingsTargetEventData();
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

    EE.prototype.eventSettingsCreateDraft = function(evData) {
        if (!evData || !Array.isArray(evData.pages)) return null;
        var draft = clone(evData);
        var eventId = Math.max(1, Math.floor(Number(draft.id || 0)));
        var tracks = this.model && this.model.tracks ? this.model.tracks : {};
        var keys = Object.keys(tracks);
        for (var i = 0; i < keys.length; i++) {
            var tr = tracks[keys[i]];
            if (!tr || Number(tr.eventId || 0) !== eventId) continue;
            var pageIndex = Math.max(0, Math.floor(Number(tr.pageIndex || 0)));
            if (!draft.pages[pageIndex] || typeof this.listFromTrack !== 'function') continue;
            draft.pages[pageIndex].list = clone(this.listFromTrack(tr));
        }
        this.eventSettingsDraftPageTokens = [];
        for (var p = 0; p < draft.pages.length; p++) this.eventSettingsDraftPageTokens.push('orig:' + String(p));
        this.eventSettingsDraftNextPageToken = 1;
        this.eventSettingsDraftOriginal = clone(draft);
        return draft;
    };

    EE.prototype.eventSettingsStoreCurrentPageToDraft = function() {
        var evData = this.eventSettingsTargetEventData();
        if (!evData || evData !== this.eventSettingsDraftEvent || !Array.isArray(evData.pages) || !evData.pages.length) return false;
        var pageIndex = Math.max(0, Math.floor(Number(this.eventSettingsTargetPageIndex || 0)));
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;
        var page = this.eventSettingsEnsurePage(evData.pages[pageIndex] || {});
        evData.pages[pageIndex] = page;
        evData.name = String(this.eventSettingsNameInput ? this.eventSettingsNameInput.value : evData.name || '');
        evData.note = String(this.eventSettingsNoteInput ? this.eventSettingsNoteInput.value : evData.note || '');

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
        c.selfSwitchCh = /^[ABCD]$/.test(selfCh) ? selfCh : 'A';
        c.itemValid = !!(this.eventSettingsItemValid && this.eventSettingsItemValid.checked);
        c.itemId = Math.max(1, Math.floor(Number(this.eventSettingsItemId && this.eventSettingsItemId.value || 1)));
        c.actorValid = !!(this.eventSettingsActorValid && this.eventSettingsActorValid.checked);
        c.actorId = Math.max(1, Math.floor(Number(this.eventSettingsActorId && this.eventSettingsActorId.value || 1)));
        c.scriptValid = !!(this.eventSettingsScriptCondValid && this.eventSettingsScriptCondValid.checked);
        c.scriptText = this.eventSettingsNormalizeScriptConditionText(this.eventSettingsScriptCondText && this.eventSettingsScriptCondText.value || '');
        if (typeof this.eventSettingsApplyScriptConditionToEventList === 'function') {
            this.eventSettingsApplyScriptConditionToEventList(page, c.scriptValid, c.scriptText);
        }

        var img = page.image || (page.image = {});
        var useTile = !!(this.eventSettingsUseTile && this.eventSettingsUseTile.checked);
        var dir = Math.floor(Number(this.eventSettingsDirection && this.eventSettingsDirection.value || 2));
        if (dir !== 2 && dir !== 4 && dir !== 6 && dir !== 8) dir = 2;
        img.tileId = useTile ? Math.max(0, Math.floor(Number(this.eventSettingsTileId && this.eventSettingsTileId.value || 0))) : 0;
        img.characterName = useTile ? '' : String(this.eventSettingsCharName && this.eventSettingsCharName.value || '');
        img.characterIndex = useTile ? 0 : Math.max(0, Math.min(7, Math.floor(Number(this.eventSettingsCharIndex && this.eventSettingsCharIndex.value || 0))));
        img.direction = dir;
        img.pattern = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPattern && this.eventSettingsPattern.value || 1))));

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
            : clone(page.moveRoute || this.defaultMoveRoute());
        if (transparentStartOn) {
            draftRoute = this.eventSettingsTransparentStartPresetRoute();
        } else {
            if (!Array.isArray(draftRoute.list)) draftRoute.list = [{ code: 0, parameters: [] }];
            if (!draftRoute.list.length || Number(draftRoute.list[draftRoute.list.length - 1].code || 0) !== 0) {
                draftRoute.list.push({ code: 0, parameters: [] });
            }
            draftRoute.repeat = !!(this.eventSettingsMoveRepeat && this.eventSettingsMoveRepeat.checked);
            draftRoute.skippable = !!(this.eventSettingsMoveSkippable && this.eventSettingsMoveSkippable.checked);
            draftRoute.wait = !!(this.eventSettingsMoveWait && this.eventSettingsMoveWait.checked);
        }
        page.moveRoute = draftRoute;
        page.eeTransparentStart = transparentStartOn;
        page.walkAnime = !!(this.eventSettingsWalkAnime && this.eventSettingsWalkAnime.checked);
        page.stepAnime = !!(this.eventSettingsStepAnime && this.eventSettingsStepAnime.checked);
        page.directionFix = !!(this.eventSettingsDirectionFix && this.eventSettingsDirectionFix.checked);
        page.through = !!(this.eventSettingsThrough && this.eventSettingsThrough.checked);
        page.priorityType = Math.max(0, Math.min(2, Math.floor(Number(this.eventSettingsPriorityType && this.eventSettingsPriorityType.value || 1))));
        page.trigger = Math.max(0, Math.min(4, Math.floor(Number(this.eventSettingsTrigger && this.eventSettingsTrigger.value || 0))));
        return true;
    };

    EE.prototype.loadEventSettingsEditorPageFromForm = function() {
        var eid = Math.max(0, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = this.eventSettingsTargetEventData();
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
        this.eventSettingsDraftEvent = this.eventSettingsCreateDraft(evData);
        if (!this.eventSettingsDraftEvent) return;
        evData = this.eventSettingsDraftEvent;
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

    EE.prototype.trackDocumentEventForUndo = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        if (!this._documentUndoEventIds) this._documentUndoEventIds = {};
        this._documentUndoEventIds[eventId] = true;
    };

    EE.prototype.markDocumentEventDirty = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        if (!this.documentDirty) this.documentDirty = { events: {}, troops: {} };
        if (!this.documentDirty.events) this.documentDirty.events = {};
        this.documentDirty.events[eventId] = true;
        this.timelineDirty = true;
    };

    EE.prototype.rebaseEventTracksFromPageDraft = function(eventId, pageTokens) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        pageTokens = Array.isArray(pageTokens) ? pageTokens.slice() : [];
        var selectedOldPage = (Number(this.selEid || 0) === eventId) ? Math.max(0, Math.floor(Number(this.selPage || 0))) : -1;
        var api = NS._eeDocument;
        if (!api || typeof api.rebaseEventTracks !== 'function') throw new Error('document utilities are not loaded');
        var result = api.rebaseEventTracks({
            eventId: eventId,
            tracks: this.model && this.model.tracks ? this.model.tracks : {},
            dirty: this.dirty || {},
            pageTokens: pageTokens,
            selectedOldPage: selectedOldPage,
            fallbackPage: Number(this.eventSettingsTargetPageIndex || 0)
        });
        this.model.tracks = result.tracks;
        this.dirty = result.dirty;
        if (selectedOldPage >= 0) {
            var selectedNewPage = result.selectedNewPage;
            this.selPage = selectedNewPage;
            this.selKey = this.key(eventId, selectedNewPage);
            this.selUid = 0;
            this.selRouteListIndex = -1;
        }
    };

    EE.prototype.refreshDocumentEventRuntime = function(eventId) {
        eventId = Math.max(1, Math.floor(Number(eventId || 0)));
        if (!$gameMap || !Array.isArray($gameMap._events)) return;
        var data = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eventId] : null;
        var runtime = $gameMap._events[eventId] || null;
        var spriteset = this.s && this.s._spriteset;
        var sprites = spriteset && Array.isArray(spriteset._characterSprites) ? spriteset._characterSprites : null;
        if (!data) {
            if (sprites && runtime) {
                for (var i = sprites.length - 1; i >= 0; i--) {
                    if (!sprites[i] || sprites[i]._character !== runtime) continue;
                    var removedSprite = sprites[i];
                    if (removedSprite.parent) removedSprite.parent.removeChild(removedSprite);
                    sprites.splice(i, 1);
                    if (typeof removedSprite.destroy === 'function') {
                        try { removedSprite.destroy({ children: true, texture: false, baseTexture: false }); } catch (_) {}
                    }
                }
            }
            $gameMap._events[eventId] = null;
            return;
        }
        if (!runtime && typeof Game_Event !== 'undefined') {
            runtime = new Game_Event($gameMap.mapId(), eventId);
            $gameMap._events[eventId] = runtime;
            if (sprites && typeof Sprite_Character !== 'undefined') {
                var sprite = new Sprite_Character(runtime);
                sprites.push(sprite);
                if (spriteset._tilemap && typeof spriteset._tilemap.addChild === 'function') spriteset._tilemap.addChild(sprite);
            }
        }
        if (runtime) {
            runtime._setCss = false;
            runtime._cssRect = null;
            if (typeof runtime.locate === 'function' && data.x != null && data.y != null) {
                runtime.locate(Math.floor(Number(data.x || 0)), Math.floor(Number(data.y || 0)));
            }
            if (typeof runtime.refresh === 'function') runtime.refresh();
        }
        if ($gameMap.requestRefresh) $gameMap.requestRefresh();
    };

    EE.prototype.commitEventSettingsDraft = function() {
        if (typeof this.closeEventSettingsNoteZoom === 'function') this.closeEventSettingsNoteZoom(true);
        if (!this.eventSettingsStoreCurrentPageToDraft()) {
            this.closeEventSettingsEditor();
            return false;
        }
        var eventId = Math.max(1, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var draft = clone(this.eventSettingsDraftEvent);
        var original = this.eventSettingsDraftOriginal || null;
        var pageTokens = Array.isArray(this.eventSettingsDraftPageTokens)
            ? this.eventSettingsDraftPageTokens.slice()
            : [];
        var changed = true;
        try { changed = JSON.stringify(draft) !== JSON.stringify(original); } catch (_) { changed = true; }
        if (!changed) {
            this.closeEventSettingsEditor();
            this.msg('イベント設定: 変更なし');
            return true;
        }

        this.trackDocumentEventForUndo(eventId);
        this.pushSnap('event-settings');
        this.rebaseEventTracksFromPageDraft(eventId, pageTokens);
        $dataMap.events[eventId] = draft;
        if (typeof DataManager !== 'undefined' && DataManager && typeof DataManager.extractMetadata === 'function') {
            try { DataManager.extractMetadata(draft); } catch (_) {}
        }
        this.markDocumentEventDirty(eventId);
        this.refreshDocumentEventRuntime(eventId);
        this.closeEventSettingsEditor();

        if (this.selEid === eventId) {
            this.ensureTrack(eventId, this.selPage);
            this.selectEvent(eventId);
        } else {
            this.refreshEventInfo();
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            this.timelineDirty = true;
        }
        this.rebuildSchedule({ skipRouteNormalize: true });
        this.msg('イベント設定を更新');
        return true;
    };

    EE.prototype.jumpToTimelineEditorFromEventSettingsExec = function() {
        var eid = Math.max(1, Math.floor(Number(this.eventSettingsTargetEventId || 0)));
        var evData = this.eventSettingsTargetEventData();
        if (!evData || !Array.isArray(evData.pages) || !evData.pages.length) {
            this.msg('イベントページがありません');
            return;
        }
        var pageIndex = Math.max(0, Math.floor(Number(
            this.eventSettingsPageSelect && this.eventSettingsPageSelect.value || this.eventSettingsTargetPageIndex || 0
        )));
        if (pageIndex >= evData.pages.length) pageIndex = evData.pages.length - 1;

        if (!this.commitEventSettingsDraft()) return;
        this.selectEvent(eid);
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
        this.eventSettingsDraftEvent = null;
        this.eventSettingsDraftOriginal = null;
        this.eventSettingsDraftPageTokens = [];
        this.eventSettingsDraftNextPageToken = 1;
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
        return this.commitEventSettingsDraft();
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


    SH.registerModule('edit', ['render'], []);
})();
