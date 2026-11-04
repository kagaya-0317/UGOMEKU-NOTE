//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Branch
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline branch view module v0.3.0
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
    var COMMAND_CODE = SH.COMMAND_CODE;
    SH.beginModule('branch');

    //-------------------------------------------------------------------------
    // Branch structure, view modes, runtime filtering, and persistence
    //-------------------------------------------------------------------------

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
            var storage = NS._eeServices && NS._eeServices.storage;
            var obj;
            if (storage && typeof storage.exists === 'function' && typeof storage.readJson === 'function') {
                if (!storage.exists(filePath)) return {};
                obj = storage.readJson(filePath);
            } else {
                var fs = require('fs');
                if (!fs.existsSync(filePath)) return {};
                var raw = fs.readFileSync(filePath, 'utf8');
                if (!raw || !String(raw).trim().length) return {};
                obj = JSON.parse(raw);
            }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
            if (obj.views && typeof obj.views === 'object' && !Array.isArray(obj.views)) return obj.views;
            return obj;
        } catch (e) {
            if (typeof this.err === 'function') this.err('E_TIMELINE_VIEW_READ', e);
            return {};
        }
    };

    EE.prototype.writeTimelineViewStoreForMap = function(contextId, store) {
        var filePath = this.timelineViewStorageFilePath(contextId);
        if (!filePath) return false;
        store = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
        try {
            this.writeJsonFileAtomic(filePath, store, 2);
            return true;
        } catch (e) {
            if (typeof this.err === 'function') this.err('E_TIMELINE_VIEW_WRITE', e);
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

    EE.prototype.branchViewModeSpec = function(kindOrCode) {
        if (kindOrCode === 'choice' || Number(kindOrCode) === COMMAND_CODE.SHOW_CHOICES) {
            return {
                kind: 'choice',
                code: COMMAND_CODE.SHOW_CHOICES,
                trackProperty: '_eeChoiceBranchViewModes',
                ordinalProperty: 'choiceUidToOrdinal',
                defaultMode: 'auto'
            };
        }
        if (kindOrCode === 'if' || Number(kindOrCode) === COMMAND_CODE.CONDITIONAL_BRANCH) {
            return {
                kind: 'if',
                code: COMMAND_CODE.CONDITIONAL_BRANCH,
                trackProperty: '_eeIfBranchViewModes',
                ordinalProperty: 'ifUidToOrdinal',
                defaultMode: 'then'
            };
        }
        return null;
    };

    EE.prototype.sanitizeBranchViewMode = function(spec, mode) {
        if (!spec) return '';
        return spec.kind === 'choice'
            ? this.sanitizeChoiceBranchViewMode(mode)
            : this.sanitizeIfBranchViewMode(mode);
    };

    EE.prototype.normalizeBranchViewModes = function(src, spec) {
        var out = Object.create(null);
        if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
        var keys = Object.keys(src);
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i] || '');
            if (!k.length) continue;
            out[k] = this.sanitizeBranchViewMode(spec, src[k]);
        }
        return out;
    };

    EE.prototype.normalizeIfBranchViewModes = function(src) {
        return this.normalizeBranchViewModes(src, this.branchViewModeSpec('if'));
    };

    EE.prototype.normalizeChoiceBranchViewModes = function(src) {
        return this.normalizeBranchViewModes(src, this.branchViewModeSpec('choice'));
    };

    EE.prototype.resolveTrackForEntry = function(entry) {
        if (entry && this.model && this.model.tracks) {
            var k = this.key(Number(entry.eventId || 0), Number(entry.pageIndex || 0));
            if (this.model.tracks[k]) return this.model.tracks[k];
        }
        return this.selectedTrack();
    };

    EE.prototype.resolveTrackForIfBranchEntry = function(entry) {
        return this.resolveTrackForEntry(entry);
    };

    EE.prototype.computeIfBranchDisplayInfoForTrack = function(tr) {
        var info = {
            list: [],
            blocks: [],
            ifUidToOrdinal: Object.create(null)
        };
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return info;
        var list = SH.commandsInSourceOrder(tr);
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
        var list = SH.commandsInSourceOrder(tr);
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

    EE.prototype.isBranchOwnerEntry = function(entry) {
        if (!entry || !entry.command) return false;
        var code = Math.floor(Number(entry.command.code || 0));
        return code === COMMAND_CODE.SHOW_CHOICES || code === COMMAND_CODE.CONDITIONAL_BRANCH;
    };

    EE.prototype.isBranchEndEntry = function(entry) {
        if (!entry || !entry.command) return false;
        var code = Math.floor(Number(entry.command.code || 0));
        return code === COMMAND_CODE.CHOICE_END || code === COMMAND_CODE.CONDITIONAL_END;
    };

    EE.prototype.branchBoundaryDisplayInfoForTrack = function(tr) {
        var out = {
            contexts: [],
            startByUid: Object.create(null),
            endByUid: Object.create(null)
        };
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return out;

        var append = function(type, info, block, ownerIndex, endIndex) {
            var list = info && Array.isArray(info.list) ? info.list : [];
            ownerIndex = Math.floor(Number(ownerIndex == null ? -1 : ownerIndex));
            endIndex = Math.floor(Number(endIndex == null ? -1 : endIndex));
            var ownerEntry = ownerIndex >= 0 && ownerIndex < list.length ? list[ownerIndex] : null;
            var endEntry = endIndex >= 0 && endIndex < list.length ? list[endIndex] : null;
            if (!ownerEntry || !endEntry) return;
            var expectedEndCode = type === 'choice' ? COMMAND_CODE.CHOICE_END : COMMAND_CODE.CONDITIONAL_END;
            if (!endEntry.command || Math.floor(Number(endEntry.command.code || 0)) !== expectedEndCode) return;
            var context = {
                type: type,
                info: info,
                list: list,
                block: block,
                ownerEntry: ownerEntry,
                endEntry: endEntry,
                indent: Math.max(0, Math.floor(Number(block && block.indent || 0)))
            };
            var ownerUid = Math.floor(Number(ownerEntry.uid || 0));
            var endUid = Math.floor(Number(endEntry.uid || 0));
            if (ownerUid <= 0 || endUid <= 0) return;
            out.contexts.push(context);
            out.startByUid[String(ownerUid)] = context;
            out.endByUid[String(endUid)] = context;
        };

        var ifInfo = this.computeIfBranchDisplayInfoForTrack(tr);
        var ifBlocks = Array.isArray(ifInfo.blocks) ? ifInfo.blocks : [];
        for (var i = 0; i < ifBlocks.length; i++) {
            var ifBlock = ifBlocks[i];
            if (!ifBlock) continue;
            append('if', ifInfo, ifBlock, ifBlock.ifIndex, ifBlock.endIndex);
        }

        var choiceInfo = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var choiceBlocks = Array.isArray(choiceInfo.blocks) ? choiceInfo.blocks : [];
        for (i = 0; i < choiceBlocks.length; i++) {
            var choiceBlock = choiceBlocks[i];
            if (!choiceBlock) continue;
            append('choice', choiceInfo, choiceBlock, choiceBlock.choiceIndex, choiceBlock.endIndex);
        }

        var source = SH.commandsInSourceOrder(tr);
        for (i = 0; i < out.contexts.length; i++) {
            var sourceContext = out.contexts[i];
            sourceContext.sourceOwnerIndex = SH.findEntryIndexByUid(
                source,
                Math.floor(Number(sourceContext.ownerEntry && sourceContext.ownerEntry.uid || 0))
            );
            sourceContext.sourceEndIndex = SH.findEntryIndexByUid(
                source,
                Math.floor(Number(sourceContext.endEntry && sourceContext.endEntry.uid || 0))
            );
            sourceContext.ownerUid = Math.floor(Number(sourceContext.ownerEntry && sourceContext.ownerEntry.uid || 0));
            sourceContext.endUid = Math.floor(Number(sourceContext.endEntry && sourceContext.endEntry.uid || 0));
            sourceContext.parentOwnerUid = 0;
            sourceContext.childOwnerUids = [];
        }
        for (i = 0; i < out.contexts.length; i++) {
            var childContext = out.contexts[i];
            var nearestParent = null;
            var nearestSpan = Infinity;
            for (var parentIndex = 0; parentIndex < out.contexts.length; parentIndex++) {
                if (parentIndex === i) continue;
                var structuralParent = out.contexts[parentIndex];
                if (structuralParent.sourceOwnerIndex >= childContext.sourceOwnerIndex ||
                    structuralParent.sourceEndIndex <= childContext.sourceEndIndex) continue;
                var structuralSpan = structuralParent.sourceEndIndex - structuralParent.sourceOwnerIndex;
                if (!nearestParent || structuralSpan < nearestSpan) {
                    nearestParent = structuralParent;
                    nearestSpan = structuralSpan;
                }
            }
            if (!nearestParent) continue;
            childContext.parentOwnerUid = Math.floor(Number(nearestParent.ownerUid || 0));
            nearestParent.childOwnerUids.push(Math.floor(Number(childContext.ownerUid || 0)));
        }
        for (i = 0; i < out.contexts.length; i++) {
            var nestedContext = out.contexts[i];
            var nestingDepth = 0;
            for (var ni = 0; ni < out.contexts.length; ni++) {
                if (ni === i) continue;
                var parentContext = out.contexts[ni];
                if (parentContext.sourceOwnerIndex < nestedContext.sourceOwnerIndex &&
                    parentContext.sourceEndIndex > nestedContext.sourceEndIndex) nestingDepth++;
            }
            nestedContext.nestingDepth = nestingDepth;
        }
        var byIndent = out.contexts.slice(0).sort(function(a, b) {
            var indentDelta = Math.floor(Number(a && a.indent || 0)) - Math.floor(Number(b && b.indent || 0));
            if (indentDelta) return indentDelta;
            return Math.floor(Number(a && a.sourceOwnerIndex || 0)) - Math.floor(Number(b && b.sourceOwnerIndex || 0));
        });
        for (i = 0; i < byIndent.length; i++) {
            nestedContext = byIndent[i];
            var nestedIndent = Math.max(0, Math.floor(Number(nestedContext && nestedContext.indent || 0)));
            if (nestedIndent <= 0) continue;
            var nestedStartFrame = Math.max(0, Math.floor(Number(nestedContext.ownerEntry && nestedContext.ownerEntry.frame || 0)));
            var nestedEndFrame = Math.max(nestedStartFrame, Math.floor(Number(nestedContext.endEntry && nestedContext.endEntry.frame || 0)));
            var temporalParent = null;
            for (var pi = 0; pi < byIndent.length; pi++) {
                var parentCandidate = byIndent[pi];
                if (!parentCandidate || parentCandidate === nestedContext) continue;
                var parentIndent = Math.max(0, Math.floor(Number(parentCandidate.indent || 0)));
                if (parentIndent >= nestedIndent) continue;
                var parentStartFrame = Math.max(0, Math.floor(Number(parentCandidate.ownerEntry && parentCandidate.ownerEntry.frame || 0)));
                var parentEndFrame = Math.max(parentStartFrame, Math.floor(Number(parentCandidate.endEntry && parentCandidate.endEntry.frame || 0)));
                if (parentStartFrame > nestedStartFrame || parentEndFrame < nestedEndFrame) continue;
                var candidateSpan = parentEndFrame - parentStartFrame;
                var currentParentIndent = temporalParent
                    ? Math.max(0, Math.floor(Number(temporalParent.indent || 0)))
                    : -1;
                var currentParentStart = temporalParent
                    ? Math.max(0, Math.floor(Number(temporalParent.ownerEntry && temporalParent.ownerEntry.frame || 0)))
                    : 0;
                var currentParentEnd = temporalParent
                    ? Math.max(currentParentStart, Math.floor(Number(temporalParent.endEntry && temporalParent.endEntry.frame || 0)))
                    : Infinity;
                if (!temporalParent || parentIndent > currentParentIndent ||
                    (parentIndent === currentParentIndent && candidateSpan < currentParentEnd - currentParentStart)) {
                    temporalParent = parentCandidate;
                }
            }
            if (!temporalParent) continue;
            var temporalParentIndent = Math.max(0, Math.floor(Number(temporalParent.indent || 0)));
            var inferredDepth = Math.max(0, Math.floor(Number(temporalParent.nestingDepth || 0))) +
                Math.max(1, nestedIndent - temporalParentIndent);
            nestedContext.nestingDepth = Math.max(
                Math.max(0, Math.floor(Number(nestedContext.nestingDepth || 0))),
                inferredDepth
            );
        }
        for (i = 0; i < out.contexts.length; i++) {
            nestedContext = out.contexts[i];
            var orphanStart = Math.max(0, Math.floor(Number(nestedContext.ownerEntry && nestedContext.ownerEntry.frame || 0)));
            var orphanEnd = Math.max(orphanStart, Math.floor(Number(nestedContext.endEntry && nestedContext.endEntry.frame || 0)));
            var temporalContainer = null;
            var temporalContainerSpan = Infinity;
            for (ni = 0; ni < out.contexts.length; ni++) {
                if (ni === i) continue;
                parentContext = out.contexts[ni];
                if (!parentContext || nestedContext.sourceOwnerIndex <= parentContext.sourceEndIndex) continue;
                var containerStart = Math.max(0, Math.floor(Number(parentContext.ownerEntry && parentContext.ownerEntry.frame || 0)));
                var containerEnd = Math.max(containerStart, Math.floor(Number(parentContext.endEntry && parentContext.endEntry.frame || 0)));
                if (containerStart >= orphanStart || containerEnd <= orphanEnd) continue;
                var containerSpan = containerEnd - containerStart;
                if (!temporalContainer || containerSpan < temporalContainerSpan) {
                    temporalContainer = parentContext;
                    temporalContainerSpan = containerSpan;
                }
            }
            if (!temporalContainer) continue;
            nestedContext.nestingDepth = Math.max(
                Math.max(0, Math.floor(Number(nestedContext.nestingDepth || 0))),
                Math.max(0, Math.floor(Number(temporalContainer.nestingDepth || 0))) + 1
            );
        }
        return out;
    };

    EE.prototype.resolveBranchBoundaryContextForEntry = function(entry, tr) {
        if (!entry) return null;
        tr = tr || this.resolveTrackForEntry(entry);
        if (!tr) return null;
        var info = this.branchBoundaryDisplayInfoForTrack(tr);
        var uid = String(Math.floor(Number(entry.uid || 0)));
        return info.startByUid[uid] || info.endByUid[uid] || null;
    };

    EE.prototype.branchExecutionPathHasPrefix = function(path, prefix) {
        path = Array.isArray(path) ? path : [];
        prefix = Array.isArray(prefix) ? prefix : [];
        if (path.length < prefix.length) return false;
        for (var i = 0; i < prefix.length; i++) {
            var a = path[i] || {};
            var b = prefix[i] || {};
            if (a.type !== b.type || Number(a.ownerUid || 0) !== Number(b.ownerUid || 0) ||
                Number(a.value) !== Number(b.value)) return false;
        }
        return true;
    };

    EE.prototype.branchBoundaryContextForOwnerUid = function(tr, ownerUid, boundaryInfo) {
        if (!tr || !Array.isArray(tr.commands)) return null;
        boundaryInfo = boundaryInfo || this.branchBoundaryDisplayInfoForTrack(tr);
        ownerUid = Math.floor(Number(ownerUid || 0));
        return ownerUid > 0 && boundaryInfo.startByUid
            ? (boundaryInfo.startByUid[String(ownerUid)] || null)
            : null;
    };

    EE.prototype.isBranchStructuralMarkerEntry = function(entry) {
        var code = Math.floor(Number(entry && entry.command && entry.command.code || 0));
        return code === COMMAND_CODE.CHOICE_BRANCH || code === COMMAND_CODE.CHOICE_CANCEL ||
            code === COMMAND_CODE.CHOICE_END || code === COMMAND_CODE.CONDITIONAL_ELSE ||
            code === COMMAND_CODE.CONDITIONAL_END;
    };

    EE.prototype.branchBoundaryParentContext = function(context, boundaryInfo) {
        if (!context || !boundaryInfo || !boundaryInfo.startByUid) return null;
        var parentOwnerUid = Math.floor(Number(context.parentOwnerUid || 0));
        return parentOwnerUid > 0 ? (boundaryInfo.startByUid[String(parentOwnerUid)] || null) : null;
    };

    EE.prototype.branchStartBoundaryMinimumFrame = function(tr, context, boundaryInfo) {
        if (!tr || !context || !context.ownerEntry) return 0;
        var parent = this.branchBoundaryParentContext(context, boundaryInfo);
        return parent && parent.ownerEntry
            ? Math.max(0, Math.floor(Number(parent.ownerEntry.frame || 0)))
            : 0;
    };

    EE.prototype.branchStartBoundaryMaximumFrame = function(tr, context) {
        if (!tr || !context || !context.ownerEntry || !context.endEntry) return 0;
        var list = Array.isArray(context.list) ? context.list : [];
        var ownerIndex = Math.floor(Number(context.sourceOwnerIndex == null ? -1 : context.sourceOwnerIndex));
        var endIndex = Math.floor(Number(context.sourceEndIndex == null ? -1 : context.sourceEndIndex));
        var maximum = Math.max(0, Math.floor(Number(context.endEntry.frame || 0)));
        if (ownerIndex < 0 || endIndex <= ownerIndex || endIndex > list.length) return maximum;
        for (var i = ownerIndex + 1; i < endIndex; i++) {
            var entry = list[i];
            if (!entry || this.isBranchStructuralMarkerEntry(entry)) continue;
            maximum = Math.min(maximum, Math.max(0, Math.floor(Number(entry.frame || 0))));
        }
        return maximum;
    };

    EE.prototype.branchEndBoundaryMinimumFrame = function(tr, endEntry, context) {
        if (!tr || !Array.isArray(tr.commands) || !this.isBranchEndEntry(endEntry)) return 0;
        context = context || this.resolveBranchBoundaryContextForEntry(endEntry, tr);
        if (!context || context.endEntry !== endEntry) return Math.max(0, Math.floor(Number(endEntry.frame || 0)));
        var list = Array.isArray(context.list) ? context.list : [];
        var ownerIndex = Math.floor(Number(context.sourceOwnerIndex == null ? -1 : context.sourceOwnerIndex));
        var endIndex = Math.floor(Number(context.sourceEndIndex == null ? -1 : context.sourceEndIndex));
        var minimum = Math.max(0, Math.floor(Number(context.ownerEntry && context.ownerEntry.frame || 0)));
        if (ownerIndex < 0 || endIndex <= ownerIndex || endIndex > list.length) return minimum;
        for (var i = ownerIndex + 1; i < endIndex; i++) {
            var entry = list[i];
            if (!entry) continue;
            var frame = Math.max(0, Math.floor(Number(entry.frame || 0)));
            var wait = Math.max(0, Math.floor(Number(entry.wait || 0)));
            minimum = Math.max(minimum, frame + wait);
        }
        return minimum;
    };

    EE.prototype.branchEndBoundaryMaximumFrame = function(tr, context, boundaryInfo) {
        if (!tr || !context || !context.endEntry) return Infinity;
        var maximum = Infinity;
        var parent = this.branchBoundaryParentContext(context, boundaryInfo);
        if (parent && parent.endEntry) {
            maximum = Math.max(0, Math.floor(Number(parent.endEntry.frame || 0)));
        }
        var source = Array.isArray(context.list) ? context.list : SH.commandsInSourceOrder(tr);
        var endIndex = Math.floor(Number(context.sourceEndIndex == null ? -1 : context.sourceEndIndex));
        if (endIndex < 0 || endIndex >= source.length) return maximum;
        var pathMap = this.computeBranchExecutionPathMapForTrack(tr);
        var parentPath = pathMap[String(Math.floor(Number(context.endEntry.uid || 0)))] || [];
        for (var i = endIndex + 1; i < source.length; i++) {
            var entry = source[i];
            if (!entry || this.isBranchStructuralMarkerEntry(entry)) continue;
            var entryPath = pathMap[String(Math.floor(Number(entry.uid || 0)))] || [];
            if (!this.branchExecutionPathHasPrefix(entryPath, parentPath)) continue;
            maximum = Math.min(maximum, Math.max(0, Math.floor(Number(entry.frame || 0))));
        }
        return maximum;
    };

    EE.prototype.branchBoundaryMovePlan = function(tr, ownerUid, edge, targetFrame, boundaryInfo) {
        edge = String(edge || '') === 'end' ? 'end' : 'start';
        if (!tr || !Array.isArray(tr.commands)) return null;
        boundaryInfo = boundaryInfo || this.branchBoundaryDisplayInfoForTrack(tr);
        var context = this.branchBoundaryContextForOwnerUid(tr, ownerUid, boundaryInfo);
        if (!context || !context.ownerEntry || !context.endEntry) return null;
        var entry = edge === 'end' ? context.endEntry : context.ownerEntry;
        var minimumFrame = edge === 'end'
            ? this.branchEndBoundaryMinimumFrame(tr, context.endEntry, context)
            : this.branchStartBoundaryMinimumFrame(tr, context, boundaryInfo);
        var maximumFrame = edge === 'end'
            ? this.branchEndBoundaryMaximumFrame(tr, context, boundaryInfo)
            : this.branchStartBoundaryMaximumFrame(tr, context);
        var oldFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        var requestedFrame = Math.max(0, Math.floor(Number(targetFrame || 0)));
        var valid = maximumFrame >= minimumFrame;
        var frame = valid ? Math.max(minimumFrame, requestedFrame) : oldFrame;
        if (valid && isFinite(maximumFrame)) frame = Math.min(frame, maximumFrame);
        var reason = valid ? '' : 'invalid-branch-range';
        if (valid && edge === 'start' && frame !== oldFrame && typeof this.canPlaceEntry === 'function' &&
            !this.canPlaceEntry(tr, entry, frame, 'main', entry.uid)) {
            valid = false;
            frame = oldFrame;
            reason = 'timeline-overlap';
        }
        return {
            kind: 'branchBoundary',
            edge: edge,
            ownerUid: Math.floor(Number(context.ownerEntry.uid || 0)),
            entryUid: Math.floor(Number(entry.uid || 0)),
            context: context,
            entry: entry,
            oldFrame: oldFrame,
            requestedFrame: requestedFrame,
            frame: frame,
            minimumFrame: minimumFrame,
            maximumFrame: maximumFrame,
            clamped: valid && frame !== requestedFrame,
            valid: valid,
            reason: reason,
            changed: valid && frame !== oldFrame
        };
    };

    EE.prototype.applyBranchBoundaryMovePlan = function(tr, plan) {
        if (!tr || !plan || !plan.valid || !plan.entry) return null;
        if (plan.changed) {
            plan.entry.frame = Math.max(0, Math.floor(Number(plan.frame || 0)));
            SH.sortTrackCommands(tr);
        }
        return {
            changed: !!plan.changed,
            edge: plan.edge,
            ownerUid: plan.ownerUid,
            entryUid: plan.entryUid,
            frame: Math.max(0, Math.floor(Number(plan.frame || 0))),
            minimumFrame: plan.minimumFrame,
            maximumFrame: plan.maximumFrame,
            clamped: !!plan.clamped,
            valid: true,
            earliestChangedFrame: Math.min(plan.oldFrame, plan.frame)
        };
    };

    EE.prototype.moveBranchBoundaryToFrame = function(tr, ownerUid, edge, targetFrame) {
        var plan = this.branchBoundaryMovePlan(tr, ownerUid, edge, targetFrame);
        if (!plan) return null;
        if (!plan.valid) return {
            changed: false,
            edge: plan.edge,
            ownerUid: plan.ownerUid,
            entryUid: plan.entryUid,
            frame: plan.oldFrame,
            minimumFrame: plan.minimumFrame,
            maximumFrame: plan.maximumFrame,
            clamped: false,
            valid: false,
            reason: plan.reason,
            earliestChangedFrame: plan.oldFrame
        };
        return this.applyBranchBoundaryMovePlan(tr, plan);
    };

    EE.prototype.moveBranchStartBoundaryToFrame = function(tr, ownerEntry, targetFrame) {
        if (!tr || !ownerEntry || !this.isBranchOwnerEntry(ownerEntry)) return null;
        return this.moveBranchBoundaryToFrame(tr, ownerEntry.uid, 'start', targetFrame);
    };

    EE.prototype.moveBranchEndBoundaryToFrame = function(tr, endEntry, targetFrame) {
        if (!tr || !endEntry || !this.isBranchEndEntry(endEntry)) return null;
        var context = this.resolveBranchBoundaryContextForEntry(endEntry, tr);
        if (!context || context.endEntry !== endEntry || !context.ownerEntry) return null;
        return this.moveBranchBoundaryToFrame(tr, context.ownerEntry.uid, 'end', targetFrame);
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
            var branch = branches[i];
            if (!branch) continue;
            if (selected === -1) {
                if (String(branch.type || '') === 'cancel') {
                    selectedBranch = branch;
                    break;
                }
                continue;
            }
            if (String(branch.type || '') !== 'choice') continue;
            if (Math.floor(Number(branch.choiceIndex == null ? -1 : branch.choiceIndex)) !== Math.floor(Number(selected || 0))) continue;
            selectedBranch = branch;
            break;
        }
        var startIndex = choiceIndex + 1;
        var stopIndex = startIndex;
        if (selectedBranch) {
            startIndex = Math.max(0, Math.floor(Number(selectedBranch.startIndex || startIndex)));
            var branchEnd = Math.floor(Number(selectedBranch.endIndex == null ? endIndex : selectedBranch.endIndex));
            if (branchEnd < 0 || branchEnd > list.length) branchEnd = endIndex;
            stopIndex = Math.max(startIndex, branchEnd);
        }
        startIndex = Math.max(0, Math.min(list.length, startIndex));
        stopIndex = Math.max(startIndex, Math.min(list.length, stopIndex));
        return {
            selected: selected,
            available: !!selectedBranch,
            choiceIndex: choiceIndex,
            endIndex: endIndex,
            endIndexInclusive: Math.max(startIndex - 1, Math.min(list.length - 1, Math.max(0, endIndex - 1))),
            startIndex: startIndex,
            stopIndex: stopIndex
        };
    };

    EE.prototype.branchBoundaryActiveRange = function(tr, context) {
        if (!tr || !context || !context.block) return null;
        var block = context.block;
        var info = context.info || {};
        var list = Array.isArray(context.list) ? context.list : [];
        if (!list.length) return null;
        if (context.type === 'choice') {
            var choiceModes = this.normalizeChoiceBranchViewModes(tr._eeChoiceBranchViewModes);
            return this.choiceBranchActiveRangeForBlock(tr, info, block, choiceModes);
        }
        var ifModes = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        var mode = this.ifBranchEffectiveModeForBlock(tr, info, block, ifModes);
        var endIndex = Math.max(0, Math.min(list.length, Math.floor(Number(block.endIndex || 0))));
        var elseIndex = Math.floor(Number(block.elseIndex == null ? -1 : block.elseIndex));
        var startIndex;
        var stopIndex;
        if (mode === 'else' && elseIndex >= 0) {
            startIndex = Math.min(list.length, elseIndex + 1);
            stopIndex = endIndex;
        } else if (mode === 'else') {
            startIndex = endIndex;
            stopIndex = endIndex;
        } else {
            startIndex = Math.min(list.length, Math.max(0, Math.floor(Number(block.ifIndex || 0))) + 1);
            stopIndex = elseIndex >= 0 ? Math.min(endIndex, elseIndex) : endIndex;
        }
        return {
            mode: mode,
            available: mode !== 'else' || elseIndex >= 0,
            startIndex: Math.max(0, startIndex),
            stopIndex: Math.max(Math.max(0, startIndex), stopIndex),
            endIndex: endIndex
        };
    };

    EE.prototype.branchSourceGroupForEntry = function(tr, list, entry) {
        list = Array.isArray(list) ? list : [];
        var index = SH.findEntryIndexByUid(list, Math.floor(Number(entry && entry.uid || 0)));
        if (index < 0) return null;
        var endIndex = index;
        var code = Math.floor(Number(entry && entry.command && entry.command.code || 0));
        if (code === COMMAND_CODE.CONDITIONAL_BRANCH) {
            var ifInfo = this.computeIfBranchDisplayInfoForTrack(tr);
            var ifBlocks = Array.isArray(ifInfo.blocks) ? ifInfo.blocks : [];
            for (var i = 0; i < ifBlocks.length; i++) {
                var ifBlock = ifBlocks[i];
                if (!ifBlock || Math.floor(Number(ifBlock.ifIndex == null ? -1 : ifBlock.ifIndex)) !== index) continue;
                endIndex = Math.floor(Number(ifBlock.endIndex || index));
                break;
            }
        } else if (code === COMMAND_CODE.SHOW_CHOICES) {
            var choiceInfo = this.computeChoiceBranchDisplayInfoForTrack(tr);
            var choiceBlocks = Array.isArray(choiceInfo.blocks) ? choiceInfo.blocks : [];
            for (i = 0; i < choiceBlocks.length; i++) {
                var choiceBlock = choiceBlocks[i];
                if (!choiceBlock || Math.floor(Number(choiceBlock.choiceIndex == null ? -1 : choiceBlock.choiceIndex)) !== index) continue;
                endIndex = Math.floor(Number(choiceBlock.endIndex || index));
                break;
            }
        }
        endIndex = Math.max(index, Math.min(list.length - 1, endIndex));
        return { startIndex: index, endIndex: endIndex, entries: list.slice(index, endIndex + 1) };
    };

    EE.prototype.branchEndBoundaryMovePlan = function(tr, endEntry, dir, hiddenByBranch) {
        dir = String(dir || 'prev') === 'next' ? 'next' : 'prev';
        if (!tr || !Array.isArray(tr.commands) || !this.isBranchEndEntry(endEntry)) return null;
        var context = this.resolveBranchBoundaryContextForEntry(endEntry, tr);
        if (!context || context.endEntry !== endEntry) return null;
        var list = Array.isArray(context.list) ? context.list : [];
        var active = this.branchBoundaryActiveRange(tr, context);
        if (!list.length || !active || active.available === false) return null;

        hiddenByBranch = hiddenByBranch || this.computeBranchHiddenUidMapForTrack(tr);
        var frame = Math.max(0, Math.floor(Number(endEntry.frame || 0)));
        var ordered = tr.commands.filter(function(entry) {
            if (!entry || !this.isMainLaneDisplayEntry(entry)) return false;
            var uid = Math.floor(Number(entry.uid || 0));
            if (uid > 0 && hiddenByBranch[String(uid)]) return false;
            return Math.max(0, Math.floor(Number(entry.frame || 0))) === frame;
        }, this).sort(SH.compareEntriesByFrameWaitUid);
        var displayIndex = -1;
        for (var oi = 0; oi < ordered.length; oi++) {
            if (ordered[oi] === endEntry) {
                displayIndex = oi;
                break;
            }
        }
        if (displayIndex < 0) return null;
        var candidate = dir === 'prev' ? ordered[displayIndex - 1] : ordered[displayIndex + 1];
        if (!candidate || !candidate.command) return null;
        var candidateCode = Math.floor(Number(candidate.command.code || 0));
        if (candidateCode === COMMAND_CODE.CHOICE_BRANCH || candidateCode === COMMAND_CODE.CHOICE_CANCEL ||
            candidateCode === COMMAND_CODE.CONDITIONAL_ELSE || this.isBranchEndEntry(candidate)) return null;

        var group = this.branchSourceGroupForEntry(tr, list, candidate);
        if (!group || !group.entries.length) return null;
        var baseIndent = Math.max(0, Math.floor(Number(context.indent || 0)));
        var candidateIndent = Math.max(0, Math.floor(Number(candidate.command.indent || 0)));
        var endSourceIndex = SH.findEntryIndexByUid(list, Math.floor(Number(endEntry.uid || 0)));
        if (endSourceIndex < 0) return null;
        var activeStart = Math.max(0, Math.floor(Number(active.startIndex || 0)));
        var activeStop = Math.max(activeStart, Math.floor(Number(active.stopIndex || activeStart)));
        var insertAnchor = null;
        var indentDelta = 0;

        if (dir === 'prev') {
            if (candidateIndent !== baseIndent + 1) return null;
            if (group.startIndex < activeStart || group.endIndex >= activeStop) return null;
            insertAnchor = endEntry;
            indentDelta = -1;
        } else {
            if (candidateIndent !== baseIndent) return null;
            if (group.startIndex <= endSourceIndex) return null;
            insertAnchor = activeStop >= 0 && activeStop < list.length ? list[activeStop] : endEntry;
            if (!insertAnchor) return null;
            indentDelta = 1;
        }

        var desired = list.slice(0);
        var moving = desired.splice(group.startIndex, group.entries.length);
        var anchorIndex = desired.indexOf(insertAnchor);
        if (anchorIndex < 0) return null;
        if (dir === 'prev') anchorIndex++;
        desired.splice.apply(desired, [anchorIndex, 0].concat(moving));
        return {
            dir: dir,
            frame: frame,
            context: context,
            endEntry: endEntry,
            candidate: candidate,
            groupEntries: group.entries,
            indentDelta: indentDelta,
            sourceBefore: list,
            sourceAfter: desired
        };
    };

    EE.prototype.applyBranchSourceOrderPlan = function(tr, plan) {
        if (!tr || !plan || !Array.isArray(plan.sourceBefore) || !Array.isArray(plan.sourceAfter)) return false;
        var before = plan.sourceBefore;
        var after = plan.sourceAfter;
        if (before.length !== after.length || !before.length) return false;

        var group = Array.isArray(plan.groupEntries) ? plan.groupEntries : [];
        var indentDelta = Math.floor(Number(plan.indentDelta || 0));
        for (var gi = 0; gi < group.length; gi++) {
            var groupEntry = group[gi];
            if (!groupEntry || !groupEntry.command) continue;
            var oldIndent = Math.max(0, Math.floor(Number(groupEntry.command.indent || 0)));
            groupEntry.command.indent = Math.max(0, oldIndent + indentDelta);
        }

        var endEntry = plan.executionEntryA || plan.endEntry;
        var candidate = plan.executionEntryB || plan.candidate;
        var endOrder = Number(endEntry && endEntry.executionOrder);
        var candidateOrder = Number(candidate && candidate.executionOrder);
        if (!isFinite(endOrder)) endOrder = Number(endEntry && endEntry.uid || 0);
        if (!isFinite(candidateOrder)) candidateOrder = Number(candidate && candidate.uid || 0);
        if (endEntry && candidate) {
            endEntry.executionOrder = candidateOrder;
            candidate.executionOrder = endOrder;
        }

        var uidSlots = [];
        var oldUidByEntry = [];
        for (var i = 0; i < before.length; i++) uidSlots.push(Math.floor(Number(before[i] && before[i].uid || 0)));
        for (i = 0; i < after.length; i++) oldUidByEntry.push(Math.floor(Number(after[i] && after[i].uid || 0)));
        var uidMap = Object.create(null);
        for (i = 0; i < after.length; i++) {
            var oldUid = oldUidByEntry[i];
            var newUid = uidSlots[i];
            if (oldUid > 0 && newUid > 0) uidMap[String(oldUid)] = newUid;
        }
        for (i = 0; i < after.length; i++) after[i].uid = uidSlots[i];
        if (typeof this.remapCommandUidReferences === 'function') this.remapCommandUidReferences(uidMap);
        SH.sortTrackCommands(tr);
        return true;
    };

    EE.prototype.applyBranchEndBoundaryMovePlan = function(tr, plan) {
        return this.applyBranchSourceOrderPlan(tr, plan);
    };

    EE.prototype.repairTemporalBranchNesting = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length || this._repairingTemporalBranchNesting) return false;
        if (typeof this.branchFrameInsertionPlacement !== 'function') return false;
        this._repairingTemporalBranchNesting = true;
        var changed = false;
        try {
            var maxPasses = Math.max(1, tr.commands.length);
            for (var pass = 0; pass < maxPasses; pass++) {
                var boundaryInfo = this.branchBoundaryDisplayInfoForTrack(tr);
                var contexts = Array.isArray(boundaryInfo.contexts) ? boundaryInfo.contexts : [];
                var repaired = false;
                for (var i = 0; i < contexts.length; i++) {
                    var child = contexts[i];
                    if (!child || !child.ownerEntry || !child.endEntry) continue;
                    var childFrame = Math.max(0, Math.floor(Number(child.ownerEntry.frame || 0)));
                    var placement = this.branchFrameInsertionPlacement(childFrame, tr);
                    if (!placement || Number(placement.branchOwnerUid || 0) === Number(child.ownerEntry.uid || 0)) continue;
                    var parent = boundaryInfo.startByUid[String(Math.floor(Number(placement.branchOwnerUid || 0)))];
                    if (!parent) continue;
                    var source = SH.commandsInSourceOrder(tr);
                    var group = this.branchSourceGroupForEntry(tr, source, child.ownerEntry);
                    if (!group || !group.entries.length) continue;
                    var parentStartIndex = Math.floor(Number(parent.sourceOwnerIndex == null ? -1 : parent.sourceOwnerIndex));
                    var parentEndIndex = Math.floor(Number(parent.sourceEndIndex == null ? -1 : parent.sourceEndIndex));
                    var outsideBeforeParent = group.endIndex < parentStartIndex;
                    var outsideAfterParent = group.startIndex > parentEndIndex;
                    if (!outsideBeforeParent && !outsideAfterParent) continue;
                    var anchorUid = this.branchSourceInsertionAnchorUid(tr, placement);
                    var anchorIndex = SH.findEntryIndexByUid(source, anchorUid);
                    if (anchorIndex < 0 || (anchorIndex >= group.startIndex && anchorIndex <= group.endIndex)) continue;

                    var sourceAfter = source.slice(0);
                    var moving = sourceAfter.splice(group.startIndex, group.entries.length);
                    var anchorEntry = source[anchorIndex];
                    var targetIndex = sourceAfter.indexOf(anchorEntry);
                    if (targetIndex < 0) continue;
                    sourceAfter.splice.apply(sourceAfter, [targetIndex, 0].concat(moving));
                    var childIndent = Math.max(0, Math.floor(Number(child.indent || 0)));
                    if (!this.applyBranchSourceOrderPlan(tr, {
                        sourceBefore: source,
                        sourceAfter: sourceAfter,
                        groupEntries: group.entries,
                        indentDelta: Math.floor(Number(placement.branchInsertIndent || 0)) - childIndent
                    })) continue;
                    changed = true;
                    repaired = true;
                    break;
                }
                if (!repaired) break;
            }
        } finally {
            this._repairingTemporalBranchNesting = false;
        }
        if (changed && typeof this.normalizeChoiceBranchStructuresForTrack === 'function') {
            this.normalizeChoiceBranchStructuresForTrack(tr);
        }
        return changed;
    };

    EE.prototype.captureChoiceBranchStructure = function(tr, choiceEntry) {
        if (!tr || !Array.isArray(tr.commands) || !choiceEntry || !choiceEntry.command ||
            Number(choiceEntry.command.code || 0) !== 102) return null;
        var list = SH.commandsInSourceOrder(tr);
        var choiceUid = Math.floor(Number(choiceEntry.uid || 0));
        var choiceIndex = this.ifBranchFindEntryIndexByUid(list, choiceUid);
        if (choiceIndex < 0) return null;
        var baseIndent = Math.max(0, Math.floor(Number(choiceEntry.command.indent || 0)));
        var out = {
            choiceUid: choiceUid,
            baseIndent: baseIndent,
            valid: false,
            list: list,
            segments: [],
            endEntry: null,
            endIndex: -1
        };
        var current = null;
        for (var i = choiceIndex + 1; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var code = Math.floor(Number(e.command.code || 0));
            var indent = Math.max(0, Math.floor(Number(e.command.indent || 0)));
            if (indent === baseIndent && (code === 402 || code === 403)) {
                current = {
                    type: code === 403 ? 'cancel' : 'choice',
                    choiceIndex: code === 402
                        ? Math.max(0, Math.floor(Number((e.command.parameters || [0])[0] || 0)))
                        : -1,
                    marker: e,
                    markerIndex: i,
                    entries: []
                };
                out.segments.push(current);
                continue;
            }
            if (indent === baseIndent && code === 404) {
                out.endEntry = e;
                out.endIndex = i;
                out.valid = true;
                break;
            }
            if (!current) {
                if (indent <= baseIndent) break;
                continue;
            }
            current.entries.push(e);
        }
        return out;
    };

    EE.prototype.removeChoiceBranchEntries = function(tr, entries, fallbackUid) {
        if (!tr || !Array.isArray(tr.commands) || !Array.isArray(entries) || !entries.length) return;
        var remove = Object.create(null);
        for (var i = 0; i < entries.length; i++) {
            var uid = Math.floor(Number(entries[i] && entries[i].uid || 0));
            if (uid > 0) remove[String(uid)] = true;
        }
        tr.commands = tr.commands.filter(function(e) {
            return !e || !remove[String(Math.floor(Number(e.uid || 0)))];
        });
        fallbackUid = Math.max(0, Math.floor(Number(fallbackUid || 0)));
        if (remove[String(Math.floor(Number(this.selUid || 0)))]) this.selUid = fallbackUid;
        if (remove[String(Math.floor(Number(this.hoverUid || 0)))]) this.hoverUid = 0;
        if (remove[String(Math.floor(Number(this.editUid || 0)))]) this.editUid = fallbackUid;
    };

    EE.prototype.createChoiceStructureEntryBefore = function(tr, anchorEntry, choiceEntry, command, options) {
        if (!tr || !Array.isArray(tr.commands) || !choiceEntry || !anchorEntry) return null;
        options = options || {};
        var uid = this.reserveUidBetween(
            tr,
            Math.floor(Number(choiceEntry.uid || 0)),
            Math.floor(Number(anchorEntry.uid || 0))
        );
        var frameSource = options.frame == null
            ? (anchorEntry.frame == null ? choiceEntry.frame : anchorEntry.frame)
            : options.frame;
        var frame = Math.max(0, Math.floor(Number(frameSource || 0)));
        var e = this.entryFromCommand(
            clone(command),
            Number(choiceEntry.eventId || 0),
            Number(choiceEntry.pageIndex || 0),
            frame,
            uid
        );
        if (!e) return null;
        tr.commands.push(e);
        SH.sortTrackCommands(tr);
        return e;
    };

    EE.prototype.createChoiceStructureEndEntry = function(tr, choiceEntry, command) {
        if (!tr || !Array.isArray(tr.commands) || !choiceEntry) return null;
        var source = SH.commandsInSourceOrder(tr);
        var choiceIndex = this.ifBranchFindEntryIndexByUid(source, Math.floor(Number(choiceEntry.uid || 0)));
        var next = (choiceIndex >= 0 && choiceIndex + 1 < source.length) ? source[choiceIndex + 1] : null;
        var frame = Math.max(0, Math.floor(Number(choiceEntry.frame || 0)));
        if (next) return this.createChoiceStructureEntryBefore(tr, next, choiceEntry, command, { frame: frame });
        var uid = Math.max(1, Math.floor(Number(this.model.nextUid || 1)));
        this.model.nextUid = uid + 1;
        var e = this.entryFromCommand(
            clone(command),
            Number(choiceEntry.eventId || 0),
            Number(choiceEntry.pageIndex || 0),
            frame,
            uid
        );
        if (!e) return null;
        tr.commands.push(e);
        SH.sortTrackCommands(tr);
        return e;
    };

    EE.prototype.synchronizeChoiceBranchStructure = function(tr, choiceEntry, captured) {
        if (!tr || !Array.isArray(tr.commands) || !choiceEntry || !choiceEntry.command ||
            Number(choiceEntry.command.code || 0) !== 102) return false;
        captured = captured || this.captureChoiceBranchStructure(tr, choiceEntry);
        var p = Array.isArray(choiceEntry.command.parameters) ? choiceEntry.command.parameters : [];
        var choices = Array.isArray(p[0]) ? p[0].slice(0, 6).map(function(v) { return String(v || ''); }) : [];
        if (!choices.length) choices = ['選択肢1'];
        p[0] = choices;
        choiceEntry.command.parameters = p;
        var wantsCancel = Math.floor(Number(p[1] == null ? -2 : p[1])) === -2;
        var baseIndent = Math.max(0, Math.floor(Number(choiceEntry.command.indent || 0)));
        var oldBaseIndent = captured ? Math.max(0, Math.floor(Number(captured.baseIndent || 0))) : baseIndent;
        var deltaIndent = baseIndent - oldBaseIndent;
        var segments = captured && captured.valid && Array.isArray(captured.segments)
            ? captured.segments.slice(0)
            : [];
        var endEntry = captured && captured.valid ? captured.endEntry : null;
        var choiceSegments = Object.create(null);
        var cancelSegment = null;
        var removeEntries = [];
        var seenChoice = Object.create(null);
        var oldMergeFrame = captured && captured.endEntry
            ? Math.max(0, Math.floor(Number(captured.endEntry.frame || 0)))
            : Math.max(0, Math.floor(Number(choiceEntry.frame || 0)));
        var oldBranchPathMap = this.computeBranchExecutionPathMapForTrack(tr);
        var choiceParentPath = oldBranchPathMap[String(Math.floor(Number(choiceEntry.uid || 0)))] || [];

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            if (!seg || !seg.marker || !seg.marker.command) continue;
            seg.marker.command.indent = baseIndent;
            var members = Array.isArray(seg.entries) ? seg.entries : [];
            for (var mi = 0; mi < members.length; mi++) {
                var member = members[mi];
                if (!member || !member.command) continue;
                var memberIndent = Math.max(0, Math.floor(Number(member.command.indent || 0)));
                member.command.indent = Math.max(baseIndent + 1, memberIndent + deltaIndent);
            }
            if (seg.type === 'cancel') {
                if (!cancelSegment) cancelSegment = seg;
                else {
                    removeEntries = removeEntries.concat([seg.marker], members);
                }
                continue;
            }
            var idx = Math.max(0, Math.floor(Number(seg.choiceIndex || 0)));
            if (idx >= choices.length || seenChoice[String(idx)]) {
                removeEntries = removeEntries.concat([seg.marker], members);
                continue;
            }
            seenChoice[String(idx)] = true;
            choiceSegments[String(idx)] = seg;
        }

        if (!wantsCancel && cancelSegment) {
            removeEntries = removeEntries.concat([cancelSegment.marker], cancelSegment.entries || []);
            cancelSegment = null;
        }
        if (removeEntries.length) this.removeChoiceBranchEntries(tr, removeEntries, choiceEntry.uid);

        if (!endEntry || tr.commands.indexOf(endEntry) < 0) {
            endEntry = this.createChoiceStructureEndEntry(tr, choiceEntry, {
                code: 404,
                indent: baseIndent,
                parameters: []
            });
        }
        if (!endEntry || !endEntry.command) return false;
        endEntry.command.code = 404;
        endEntry.command.indent = baseIndent;
        endEntry.command.parameters = [];

        if (wantsCancel) {
            if (!cancelSegment || tr.commands.indexOf(cancelSegment.marker) < 0) {
                var cancelMarker = this.createChoiceStructureEntryBefore(tr, endEntry, choiceEntry, {
                    code: 403,
                    indent: baseIndent,
                    parameters: []
                });
                cancelSegment = { type: 'cancel', choiceIndex: -1, marker: cancelMarker, entries: [] };
            }
            if (cancelSegment.marker && cancelSegment.marker.command) {
                cancelSegment.marker.frame = Math.max(0, Math.floor(Number(choiceEntry.frame || 0)));
                cancelSegment.marker.command.code = 403;
                cancelSegment.marker.command.indent = baseIndent;
                cancelSegment.marker.command.parameters = [];
            }
        }

        var anchor = (wantsCancel && cancelSegment && cancelSegment.marker) ? cancelSegment.marker : endEntry;
        for (i = choices.length - 1; i >= 0; i--) {
            var existing = choiceSegments[String(i)];
            if (!existing || !existing.marker || tr.commands.indexOf(existing.marker) < 0) {
                var marker = this.createChoiceStructureEntryBefore(tr, anchor, choiceEntry, {
                    code: 402,
                    indent: baseIndent,
                    parameters: [i, choices[i]]
                });
                existing = { type: 'choice', choiceIndex: i, marker: marker, entries: [] };
                choiceSegments[String(i)] = existing;
            }
            if (existing.marker && existing.marker.command) {
                existing.marker.frame = Math.max(0, Math.floor(Number(choiceEntry.frame || 0)));
                existing.marker.command.code = 402;
                existing.marker.command.indent = baseIndent;
                existing.marker.command.parameters = [i, choices[i]];
                anchor = existing.marker;
            }
        }
        var updated = this.captureChoiceBranchStructure(tr, choiceEntry);
        var newMergeFrame = Math.max(0, Math.floor(Number(choiceEntry.frame || 0)));
        var updatedSegments = updated && Array.isArray(updated.segments) ? updated.segments : [];
        for (var usi = 0; usi < updatedSegments.length; usi++) {
            var updatedEntries = Array.isArray(updatedSegments[usi].entries) ? updatedSegments[usi].entries : [];
            for (var uei = 0; uei < updatedEntries.length; uei++) {
                var updatedEntry = updatedEntries[uei];
                if (!updatedEntry) continue;
                var updatedEnd = Math.max(0, Math.floor(Number(updatedEntry.frame || 0))) +
                    Math.max(0, Math.floor(Number(updatedEntry.wait || 0)));
                if (updatedEnd > newMergeFrame) newMergeFrame = updatedEnd;
            }
        }
        var newBoundaryFrame = Math.max(newMergeFrame, Math.max(0, Math.floor(Number(endEntry.frame || 0))));
        var mergeDelta = newBoundaryFrame - oldMergeFrame;
        endEntry.frame = newBoundaryFrame;
        if (mergeDelta) {
            var sourceAfter = SH.commandsInSourceOrder(tr);
            var endSourceIndex = SH.findEntryIndexByUid(sourceAfter, endEntry.uid);
            for (var sai = endSourceIndex + 1; sai < sourceAfter.length; sai++) {
                var afterEntry = sourceAfter[sai];
                if (!afterEntry) continue;
                var afterPath = oldBranchPathMap[String(Math.floor(Number(afterEntry.uid || 0)))] || [];
                if (!this.branchExecutionPathHasPrefix(afterPath, choiceParentPath)) continue;
                afterEntry.frame = Math.max(0, Math.floor(Number(afterEntry.frame || 0)) + mergeDelta);
            }
        }
        SH.sortTrackCommands(tr);
        return true;
    };

    EE.prototype.removeOrphanChoiceBranchMarkers = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return false;
        var info = this.computeChoiceBranchDisplayInfoForTrack(tr);
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        var attached = Object.create(null);
        for (var i = 0; i < blocks.length; i++) {
            var branches = Array.isArray(blocks[i] && blocks[i].branches) ? blocks[i].branches : [];
            for (var bi = 0; bi < branches.length; bi++) {
                var branch = branches[bi];
                var markerIndex = branch && branch.markerIndex != null
                    ? Math.floor(Number(branch.markerIndex))
                    : -1;
                var marker = markerIndex >= 0 && markerIndex < info.list.length ? info.list[markerIndex] : null;
                var markerUid = Math.floor(Number(marker && marker.uid || 0));
                if (markerUid > 0) attached[String(markerUid)] = true;
            }
        }
        var orphaned = tr.commands.filter(function(entry) {
            var code = Math.floor(Number(entry && entry.command && entry.command.code || 0));
            var uid = Math.floor(Number(entry && entry.uid || 0));
            return (code === COMMAND_CODE.CHOICE_BRANCH || code === COMMAND_CODE.CHOICE_CANCEL) &&
                uid > 0 && !attached[String(uid)];
        });
        if (!orphaned.length) return false;
        this.removeChoiceBranchEntries(tr, orphaned, 0);
        SH.sortTrackCommands(tr);
        return true;
    };

    EE.prototype.normalizeChoiceBranchStructuresForTrack = function(tr) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        var choices = tr.commands.filter(function(e) {
            return !!(e && e.command && Number(e.command.code || 0) === 102);
        });
        choices.sort(SH.compareEntriesBySourceOrder);
        var changed = false;
        for (var i = choices.length - 1; i >= 0; i--) {
            if (this.synchronizeChoiceBranchStructure(tr, choices[i])) changed = true;
        }
        if (this.removeOrphanChoiceBranchMarkers(tr)) changed = true;
        return changed;
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
        var idx = Math.floor(Number((block && block.choiceIndex != null) ? block.choiceIndex : -1));
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

    EE.prototype.ifBranchViewMetaForTrack = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) {
            return { info: { list: [], blocks: [] }, modeMap: Object.create(null), autoBlocks: [] };
        }
        var trackKey = this.key(Number(tr.eventId || 0), Number(tr.pageIndex || 0));
        var revision = Math.floor(Number(this._trackRevisionByKey && this._trackRevisionByKey[trackKey] || 0));
        var modeMap = this.normalizeIfBranchViewModes(tr._eeIfBranchViewModes);
        var modeSig = JSON.stringify(modeMap);
        var cached = this._ifBranchViewMetaCache;
        if (cached && cached.track === tr && cached.revision === revision && cached.modeSig === modeSig) return cached;
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var blocks = info.blocks || [];
        var autoBlocks = [];
        for (var i = 0; i < blocks.length; i++) {
            if (this.ifBranchConfiguredModeForBlock(modeMap, blocks[i]) === 'auto') autoBlocks.push(blocks[i]);
        }
        cached = {
            track: tr,
            revision: revision,
            modeSig: modeSig,
            info: info,
            modeMap: modeMap,
            autoBlocks: autoBlocks
        };
        this._ifBranchViewMetaCache = cached;
        return cached;
    };

    EE.prototype.trackHasAutoIfBranchViewMode = function(tr) {
        return this.ifBranchViewMetaForTrack(tr).autoBlocks.length > 0;
    };

    EE.prototype.autoIfBranchViewSignatureForTrack = function(tr) {
        var meta = this.ifBranchViewMetaForTrack(tr);
        var blocks = meta.autoBlocks;
        if (!blocks.length) return '';
        var list = meta.info && Array.isArray(meta.info.list) ? meta.info.list : [];
        var parts = [meta.modeSig];
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i] || {};
            var index = Math.floor(Number(block.ifIndex == null ? -1 : block.ifIndex));
            var entry = index >= 0 && index < list.length ? list[index] : null;
            parts.push(String(Math.floor(Number(block.ifUid || 0))) + ':' +
                (this.evaluateIfConditionAutoForEntry(entry) ? '1' : '0'));
        }
        return parts.join('|');
    };

    EE.prototype.refreshAutoIfBranchViewSignature = function(tr) {
        var next = this.autoIfBranchViewSignatureForTrack(tr);
        var previous = String(this._timelineAutoIfViewSignature || '');
        var previousTrack = this._timelineAutoIfViewTrack;
        this._timelineAutoIfViewTrack = tr || null;
        this._timelineAutoIfViewSignature = next;
        var changed = previousTrack !== (tr || null) || previous !== next;
        if (changed && (previous.length || next.length)) this.timelineDirty = true;
        return changed;
    };

    EE.prototype.computeIfBranchViewStateForTrack = function(tr) {
        var meta = this.ifBranchViewMetaForTrack(tr);
        var out = {
            info: meta.info,
            hidden: Object.create(null),
            highlights: Object.create(null)
        };
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return out;
        var info = out.info || {};
        var list = Array.isArray(info.list) ? info.list : [];
        var blocks = Array.isArray(info.blocks) ? info.blocks : [];
        if (!list.length) return out;

        var modeMap = meta.modeMap;
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
                // The end marker is a visible Main-lane boundary. Hide it only
                // when an enclosing branch is not the active display path.
                if (!parentVisible && uid > 0) out.hidden[uidKey] = true;
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
            var activeIndex = Math.floor(Number(ctx.activeChoiceIndex == null ? -999 : ctx.activeChoiceIndex));
            var phaseIndex = Math.floor(Number(ctx.phaseChoiceIndex == null ? -998 : ctx.phaseChoiceIndex));
            return activeIndex === phaseIndex;
        }
        if (phase === 'cancel') {
            return Math.floor(Number(ctx.activeChoiceIndex == null ? -999 : ctx.activeChoiceIndex)) === -1;
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
                // Choice-end is rendered as the explicit end boundary. An end
                // nested in an inactive parent branch remains hidden.
                if (!parentVisible && uid > 0) hidden[String(uid)] = true;
                for (var cs = stack.length - 1; cs >= 0; cs--) {
                    if (Math.max(0, Math.floor(Number(stack[cs].indent || 0))) >= indent) stack.splice(cs, 1);
                }
                continue;
            }

            if (!parentVisible && uid > 0) hidden[String(uid)] = true;
        }
        return hidden;
    };

    EE.prototype.computeBranchHiddenUidMapForTrack = function(tr) {
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

    EE.prototype.computeIfBranchHiddenUidMapForTrack = function(tr) {
        return this.computeBranchHiddenUidMapForTrack(tr);
    };

    EE.prototype.isTimelineEntryVisibleByBranchMode = function(entry, tr) {
        if (!entry) return true;
        tr = tr || this.resolveTrackForEntry(entry);
        if (!tr) return true;
        var uid = Math.floor(Number(entry.uid || 0));
        if (uid <= 0) return true;
        var hidden = (this._timelineBranchHiddenTrack === tr && this._timelineBranchHiddenUidMap)
            ? this._timelineBranchHiddenUidMap
            : this.computeBranchHiddenUidMapForTrack(tr);
        return !hidden[String(uid)];
    };

    EE.prototype.branchDisplayInfoForSpec = function(tr, spec) {
        if (!spec) return null;
        return spec.kind === 'choice'
            ? this.computeChoiceBranchDisplayInfoForTrack(tr)
            : this.computeIfBranchDisplayInfoForTrack(tr);
    };

    EE.prototype.getBranchViewModeForEntry = function(entry, kindOrCode) {
        var spec = this.branchViewModeSpec(kindOrCode);
        if (!spec || !entry || !entry.command || Number(entry.command.code || 0) !== spec.code) {
            return spec ? spec.defaultMode : '';
        }
        var tr = this.resolveTrackForEntry(entry);
        if (!tr) return spec.defaultMode;
        var info = this.branchDisplayInfoForSpec(tr, spec) || {};
        var uid = String(Math.floor(Number(entry.uid || 0)));
        var ordinalMap = info[spec.ordinalProperty] || Object.create(null);
        var ordinal = Math.floor(Number(ordinalMap[uid] || 0));
        var modes = this.normalizeBranchViewModes(tr[spec.trackProperty], spec);
        var stored = ordinal > 0 ? modes[String(ordinal)] : modes[uid];
        return this.sanitizeBranchViewMode(spec, stored);
    };

    EE.prototype.setBranchViewModeForEntry = function(entry, mode, kindOrCode) {
        var spec = this.branchViewModeSpec(kindOrCode);
        if (!spec || !entry || !entry.command || Number(entry.command.code || 0) !== spec.code) return false;
        var tr = this.resolveTrackForEntry(entry);
        if (!tr) return false;
        var info = this.branchDisplayInfoForSpec(tr, spec) || {};
        var uid = String(Math.floor(Number(entry.uid || 0)));
        var ordinalMap = info[spec.ordinalProperty] || Object.create(null);
        var ordinal = Math.floor(Number(ordinalMap[uid] || 0));
        var modes = this.normalizeBranchViewModes(tr[spec.trackProperty], spec);
        var key = ordinal > 0 ? String(ordinal) : uid;
        var normalized = this.sanitizeBranchViewMode(spec, mode);
        if (normalized === spec.defaultMode) delete modes[key];
        else modes[key] = normalized;
        if (key !== uid) delete modes[uid];
        tr[spec.trackProperty] = modes;
        if (this.selKey === this.key(tr.eventId, tr.pageIndex)) this.timelineDirty = true;
        return true;
    };

    EE.prototype.getChoiceBranchViewModeForEntry = function(entry) {
        return this.getBranchViewModeForEntry(entry, 'choice');
    };

    EE.prototype.setChoiceBranchViewModeForEntry = function(entry, mode) {
        return this.setBranchViewModeForEntry(entry, mode, 'choice');
    };

    EE.prototype.getIfBranchViewModeForEntry = function(entry) {
        return this.getBranchViewModeForEntry(entry, 'if');
    };

    EE.prototype.setIfBranchViewModeForEntry = function(entry, mode) {
        return this.setBranchViewModeForEntry(entry, mode, 'if');
    };

    EE.prototype.applyStoredBranchViewModeByUid = function(uid, mode, kindOrCode) {
        var spec = this.branchViewModeSpec(kindOrCode);
        uid = Math.floor(Number(uid || 0));
        if (!spec || uid <= 0) return false;
        var entry = this.findEntryInSelectedTrack(uid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== spec.code) return false;
        if (!this.setBranchViewModeForEntry(entry, mode, spec.kind)) return false;
        this.resetIfBranchRuntimeState();
        var wasPlaying = !!this.play;
        var targetFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (wasPlaying) this.playFrom(targetFrame);
        else this.seek(targetFrame);
        this.timelineDirty = true;
        this.persistSelectedTimelineViewStateToDisk();
        return true;
    };

    EE.prototype.applyIfBranchViewModeByUid = function(uid, mode) {
        return this.applyStoredBranchViewModeByUid(uid, mode, 'if');
    };

    EE.prototype.applyChoiceBranchViewModeByUid = function(uid, mode) {
        return this.applyStoredBranchViewModeByUid(uid, mode, 'choice');
    };

    EE.prototype.applyBranchViewModeByUid = function(uid, mode) {
        var e = this.findEntryInSelectedTrack(Math.floor(Number(uid || 0)));
        if (!e || !e.command) return false;
        var code = Math.floor(Number(e.command.code || 0));
        if (code === COMMAND_CODE.SHOW_CHOICES) return this.applyChoiceBranchViewModeByUid(uid, mode);
        if (code === COMMAND_CODE.CONDITIONAL_BRANCH) return this.applyIfBranchViewModeByUid(uid, mode);
        return false;
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
                choiceStack: [],
                branchResults: Object.create(null),
                branchPathMap: null
            };
        } else {
            if (!Array.isArray(tracks[key].ifStack)) {
                tracks[key].ifStack = Array.isArray(tracks[key].stack) ? tracks[key].stack : [];
            }
            if (!Array.isArray(tracks[key].choiceStack)) tracks[key].choiceStack = [];
            if (!tracks[key].branchResults) tracks[key].branchResults = Object.create(null);
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

    EE.prototype.computeBranchExecutionPathMapForTrack = function(tr) {
        var out = Object.create(null);
        if (!tr || !Array.isArray(tr.commands)) return out;
        var list = SH.commandsInSourceOrder(tr);
        var stack = [];
        var setBranchValue = function(type, indent, value) {
            for (var i = stack.length - 1; i >= 0; i--) {
                var ctx = stack[i];
                if (!ctx || ctx.type !== type || ctx.indent !== indent) continue;
                ctx.value = value;
                return;
            }
        };
        var closeBranch = function(type, indent) {
            for (var i = stack.length - 1; i >= 0; i--) {
                var ctx = stack[i];
                if (!ctx || ctx.type !== type || ctx.indent !== indent) continue;
                stack.splice(i, 1);
                return;
            }
        };
        for (var li = 0; li < list.length; li++) {
            var entry = list[li];
            if (!entry || !entry.command) continue;
            var code = Math.floor(Number(entry.command.code || 0));
            var indent = Math.max(0, Math.floor(Number(entry.command.indent || 0)));
            var uid = Math.floor(Number(entry.uid || 0));
            var path = [];
            for (var si = 0; si < stack.length; si++) {
                var branch = stack[si];
                if (!branch || indent <= branch.indent || branch.value == null) continue;
                path.push({
                    type: branch.type,
                    ownerUid: branch.ownerUid,
                    value: branch.value
                });
            }
            if (uid > 0) out[String(uid)] = path;

            if (code === COMMAND_CODE.CONDITIONAL_BRANCH) {
                stack.push({ type: 'if', ownerUid: uid, indent: indent, value: true });
            } else if (code === COMMAND_CODE.CONDITIONAL_ELSE) {
                setBranchValue('if', indent, false);
            } else if (code === COMMAND_CODE.CONDITIONAL_END) {
                closeBranch('if', indent);
            } else if (code === COMMAND_CODE.SHOW_CHOICES) {
                stack.push({ type: 'choice', ownerUid: uid, indent: indent, value: null });
            } else if (code === COMMAND_CODE.CHOICE_BRANCH) {
                var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
                setBranchValue('choice', indent, Math.max(0, Math.floor(Number(p[0] || 0))));
            } else if (code === COMMAND_CODE.CHOICE_CANCEL) {
                setBranchValue('choice', indent, -1);
            } else if (code === COMMAND_CODE.CHOICE_END) {
                closeBranch('choice', indent);
            }
        }
        return out;
    };

    EE.prototype.isEntryActiveByBranchExecutionPath = function(entry, state, trackKey) {
        if (!entry || !state) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[String(trackKey || '')] : null;
        if (!tr) return true;
        if (!state.branchPathMap) state.branchPathMap = this.computeBranchExecutionPathMapForTrack(tr);
        var path = state.branchPathMap[String(Math.floor(Number(entry.uid || 0)))] || [];
        var results = state.branchResults || (state.branchResults = Object.create(null));
        for (var i = 0; i < path.length; i++) {
            var part = path[i];
            if (!part) continue;
            var ownerKey = String(Math.floor(Number(part.ownerUid || 0)));
            if (!Object.prototype.hasOwnProperty.call(results, ownerKey)) {
                var owner = this.findTrackEntryByUid(tr, Number(part.ownerUid || 0));
                if (!owner) return false;
                results[ownerKey] = part.type === 'choice'
                    ? this.resolveChoiceBranchResultForEntry(owner)
                    : !!this.resolveIfBranchResultForEntry(owner);
            }
            var result = results[ownerKey];
            if (part.type === 'choice') {
                if (Math.floor(Number(result)) !== Math.floor(Number(part.value))) return false;
            } else if (!!result !== !!part.value) {
                return false;
            }
        }
        return true;
    };

    EE.prototype.shouldExecuteEntryByIfBranchRuntime = function(entry) {
        if (!entry || !entry.command) return false;
        var code = Math.floor(Number(entry.command.code || 0));
        var indent = Math.max(0, Math.floor(Number(entry.command.indent || 0)));
        var trackKey = this.key(Number(entry.eventId || 0), Number(entry.pageIndex || 0));
        var state = this.ifBranchRuntimeStateForTrackKey(trackKey);
        var ifStack = state.ifStack || (state.ifStack = []);
        var choiceStack = state.choiceStack || (state.choiceStack = []);

        var active = this.isEntryActiveByBranchExecutionPath(entry, state, trackKey);
        var i;
        var shouldLog = active && !this._simToRunning && !this._eeInlineCommandExecution;
        var logFrame = Math.max(0, Math.floor(Number((this._simToRunning ? this._simExecFrame : this.frame) || 0)));

        if (code === 111) {
            if (active) {
                var ifResult = !!this.resolveIfBranchResultForEntry(entry);
                state.branchResults[String(Math.floor(Number(entry.uid || 0)))] = ifResult;
                for (i = ifStack.length - 1; i >= 0; i--) {
                    if (Math.max(0, Math.floor(Number(ifStack[i].indent || 0))) >= indent) ifStack.splice(i, 1);
                }
                ifStack.push({
                    indent: indent,
                    result: ifResult,
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
                var choiceResult = Math.floor(Number(this.resolveChoiceBranchResultForEntry(entry)));
                state.branchResults[String(Math.floor(Number(entry.uid || 0)))] = choiceResult;
                for (i = choiceStack.length - 1; i >= 0; i--) {
                    if (Math.max(0, Math.floor(Number(choiceStack[i].indent || 0))) >= indent) choiceStack.splice(i, 1);
                }
                choiceStack.push({
                    indent: indent,
                    activeChoiceIndex: choiceResult,
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

    EE.prototype.rememberSelectedTimelineViewState = function() {
        if (!this.selEid || this.selPage < 0 || !this.selKey) return false;
        var st = this.captureCurrentTimelineViewState();
        if (!st) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (tr) {
            var ifModes = this.exportIfBranchViewModesForTrack(tr);
            if (Object.keys(ifModes).length) st.ifBranchModes = ifModes;
            var choiceModes = this.exportChoiceBranchViewModesForTrack(tr);
            if (Object.keys(choiceModes).length) st.choiceBranchModes = choiceModes;
        }
        if (!this._timelineViewSessionStore) this._timelineViewSessionStore = {};
        this._timelineViewSessionStore[this.timelineViewStoreKey(this.selEid, this.selPage)] = st;
        return true;
    };

    EE.prototype.persistAllTimelineViewStatesToDisk = function() {
        var contextId = (typeof this.timelineViewStorageContextId === 'function') ? this.timelineViewStorageContextId() : 0;
        if (contextId <= 0) return false;
        this.rememberSelectedTimelineViewState();
        var store = this.readTimelineViewStoreForMap(contextId);
        var sessionStore = this._timelineViewSessionStore || {};
        var keys = Object.keys(sessionStore);
        for (var i = 0; i < keys.length; i++) store[keys[i]] = clone(sessionStore[keys[i]]);
        return this.writeTimelineViewStoreForMap(contextId, store);
    };

    EE.prototype.persistSelectedTimelineViewStateToDisk = function() {
        return this.persistAllTimelineViewStatesToDisk();
    };

    EE.prototype.queueTimelineViewRestoreForTrack = function(eventId, pageIndex) {
        var contextId = (typeof this.timelineViewStorageContextId === 'function') ? this.timelineViewStorageContextId() : 0;
        if (contextId <= 0) {
            this._timelineViewPending = null;
            return;
        }
        var key = this.timelineViewStoreKey(eventId, pageIndex);
        var store = this.readTimelineViewStoreForMap(contextId);
        var sessionStore = this._timelineViewSessionStore || {};
        var st = sessionStore[key] || (store && typeof store === 'object' ? store[key] : null);
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


    SH.registerModule('branch', ['preview'], []);
})();
