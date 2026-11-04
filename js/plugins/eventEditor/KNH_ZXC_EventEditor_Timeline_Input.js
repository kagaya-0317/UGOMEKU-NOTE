//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Input
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.3.0 (KNH_ZXC_EventEditor_Timeline_Input)
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
    SH.beginModule('input');

    // Pointer/wheel input, track serialization, schedule rebuilds, and snapshots.

    function eeFrameTick() {
        if (typeof Graphics !== 'undefined' && Graphics && Graphics.frameCount != null) {
            return Math.max(0, Math.floor(Number(Graphics.frameCount || 0)));
        }
        return Math.floor(Date.now() / 16);
    }

    function eeRectPlain(r) {
        if (!r) return null;
        return {
            left: Number(r.left || 0),
            top: Number(r.top || 0),
            right: Number(r.right || 0),
            bottom: Number(r.bottom || 0)
        };
    }

    function eePointInRect(x, y, r) {
        if (!r) return false;
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function eeWheelModeScale(e, pagePixelStep) {
        var mode = Math.floor(Number(e && e.deltaMode || 0));
        if (mode === 1) return 16;
        if (mode === 2) return Math.max(100, Math.floor(Number(pagePixelStep || 100)));
        return 1;
    }

    function eeWheelPixelDelta(e, pagePixelStep) {
        var scale = eeWheelModeScale(e, pagePixelStep);
        return {
            dx: Number(e && e.deltaX || 0) * scale,
            dy: Number(e && e.deltaY || 0) * scale
        };
    }

    function eeWheelPrimaryDelta(e) {
        var delta = Number(e && e.deltaY || 0);
        if (Math.abs(delta) < 0.0001) delta = Number(e && e.deltaX || 0);
        if (Math.abs(delta) < 0.0001 && e && e.wheelDelta != null) delta = -Number(e.wheelDelta || 0);
        return delta;
    }

    function eeOverflowAllowsScroll(value) {
        value = String(value || '').toLowerCase();
        return value === 'auto' || value === 'scroll' || value === 'overlay';
    }

    function eeInputAttrNumber(input, attr) {
        if (!input || !input.getAttribute) return NaN;
        var raw = input.getAttribute(attr);
        if (raw == null) return NaN;
        var text = String(raw).trim();
        if (!text.length) return NaN;
        var n = Number(text);
        return isFinite(n) ? n : NaN;
    }

    function eeCountStepDecimals(text) {
        text = String(text || '').toLowerCase();
        if (!text.length || text === 'any') return 0;
        var expIdx = text.indexOf('e-');
        if (expIdx >= 0) {
            var exp = Number(text.slice(expIdx + 2));
            if (isFinite(exp) && exp > 0) return Math.floor(exp);
        }
        var dot = text.indexOf('.');
        return dot >= 0 ? Math.max(0, text.length - dot - 1) : 0;
    }

    function eeTrimTrailingZeros(valueText) {
        return String(valueText).replace(/(\.\d*?[1-9])0+$/g, '$1').replace(/\.0+$/g, '');
    }

    EE.prototype.timelineRectCached = function() {
        if (!this.timeline || !this.timeline.getBoundingClientRect) return null;
        var tick = eeFrameTick();
        var sx = this.timelineWrap ? Math.floor(Number(this.timelineWrap.scrollLeft || 0)) : 0;
        var sy = this.timelineWrap ? Math.floor(Number(this.timelineWrap.scrollTop || 0)) : 0;
        var cache = this._eeTimelineRectCache;
        if (cache && cache.tick === tick && cache.sx === sx && cache.sy === sy && cache.el === this.timeline && cache.rect) return cache.rect;
        var rect = eeRectPlain(this.timeline.getBoundingClientRect());
        this._eeTimelineRectCache = { tick: tick, sx: sx, sy: sy, el: this.timeline, rect: rect };
        return rect;
    };

    EE.prototype.timelinePointFromClient = function(clientX, clientY) {
        if (!this.timeline || clientX == null || clientY == null) return null;
        var r = this.timelineRectCached();
        if (!r) return null;
        return { x: clientX - r.left, y: clientY - r.top };
    };

    EE.prototype.isPointInTimelineFixedLabel = function(x) {
        var xNum = Number(x || 0);
        var sl = this.timelineWrap ? Math.max(0, Number(this.timelineWrap.scrollLeft || 0)) : 0;
        var sw = Math.max(0, Number(this.labelW || 0));
        // Accept both content-space and viewport-space x coordinates.
        return (xNum >= 0 && xNum < sw) ||
            (xNum >= sl && xNum < sl + sw) ||
            (xNum - sl >= 0 && xNum - sl < sw);
    };

    EE.prototype.uiHitRectsCached = function() {
        if (!this.root) return [];
        var tick = eeFrameTick();
        var cache = this._eeUiHitRectsCache;
        if (cache && cache.tick === tick && cache.root === this.root && Array.isArray(cache.rects)) return cache.rects;
        var rects = [];
        var pushRectFor = function(el) {
            if (!el || !el.getBoundingClientRect) return;
            var r = eeRectPlain(el.getBoundingClientRect());
            if (!r || r.right <= r.left || r.bottom <= r.top) return;
            rects.push(r);
        };
        if (this.memoScrollLane && this.memoScrollLane.style && this.memoScrollLane.style.display !== 'none') pushRectFor(this.memoScrollLane);
        if (this.cameraCtx && this.cameraCtx.classList && this.cameraCtx.classList.contains('on')) pushRectFor(this.cameraCtx);
        if (this.routeCtx && this.routeCtx.classList && this.routeCtx.classList.contains('on')) pushRectFor(this.routeCtx);
        if (this.charCtx && this.charCtx.classList && this.charCtx.classList.contains('on')) pushRectFor(this.charCtx);
        if (this.mapCreateCtx && this.mapCreateCtx.classList && this.mapCreateCtx.classList.contains('on')) pushRectFor(this.mapCreateCtx);
        var ps = this.root.getElementsByClassName ? this.root.getElementsByClassName('p') : [];
        for (var i = 0; i < ps.length; i++) pushRectFor(ps[i]);
        this._eeUiHitRectsCache = { tick: tick, root: this.root, rects: rects };
        return rects;
    };

    EE.prototype.isPointInOpenMenuRect = function(menu, x, y) {
        if (!menu || !menu.classList || !menu.classList.contains('on') || !menu.getBoundingClientRect) return false;
        var r = eeRectPlain(menu.getBoundingClientRect());
        return eePointInRect(Number(x || 0), Number(y || 0), r);
    };

    EE.prototype.isPointInOpenContextMenu = function(x, y) {
        if (this.isPointInOpenMenuRect(this.charCtx, x, y)) return true;
        if (this.isPointInOpenMenuRect(this.cameraCtx, x, y)) return true;
        if (this.isPointInOpenMenuRect(this.routeCtx, x, y)) return true;
        if (this.isPointInOpenMenuRect(this.mapCreateCtx, x, y)) return true;
        return false;
    };

    EE.prototype.onTimelineLeave = function() {
        if (this.panState && this.panState.mode === 'timeline') return;
        if (this.isAnyContextMenuOpen()) {
            this.showTipAt(0, 0, '');
            return;
        }
        this.setHoverNode(null);
        if (this.timeline) this.timeline.style.cursor = 'crosshair';
        if (Number(this.hoverFrame) !== -1) {
            this.hoverFrame = -1;
            this.timelineCursorDirty = true;
        }
        if (this.hoverEndMarker) {
            this.hoverEndMarker = false;
            this.timelineDirty = true;
        }
        if (Number(this.hoverRangeUid || 0) !== 0 || String(this.hoverRangePart || '') !== '') {
            this.hoverRangeUid = 0;
            this.hoverRangePart = '';
            this.timelineDirty = true;
        }
        this.showTipAt(0, 0, '');
    };

    EE.prototype.onTimelineMove = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        if (this.panState) {
            this.updateSpacePanDrag(e);
            return;
        }
        var p = this.timelinePointFromClient(e.clientX, e.clientY);
        if (!p) return;
        var x = p.x, y = p.y;
        this.lastMouseX = x;
        this.lastMouseY = y;
        if (this.isAnyContextMenuOpen()) {
            this.showTipAt(0, 0, '');
            return;
        }
        if (this.rangeSelectDrag) {
            this.updateRangeSelectionDrag(x, y);
            if (this.timeline.style.cursor !== 'crosshair') this.timeline.style.cursor = 'crosshair';
            this.showTipAt(0, 0, '');
            return;
        }
        if (this.rangeMoveDrag) {
            this.updateRangeMoveDrag(x, y);
            if (this.timeline.style.cursor !== 'move') this.timeline.style.cursor = 'move';
            this.showTipAt(0, 0, '');
            return;
        }
        if (this.isPointInTimelineFixedLabel(x)) {
            if (Number(this.hoverRangeUid || 0) !== 0 || String(this.hoverRangePart || '') !== '') {
                this.hoverRangeUid = 0;
                this.hoverRangePart = '';
                this.timelineDirty = true;
            }
            if (this.hoverEndMarker) {
                this.hoverEndMarker = false;
                this.timelineDirty = true;
            }
            this.setHoverNode(null);
            if (Number(this.hoverFrame) !== -1) {
                this.hoverFrame = -1;
                this.timelineCursorDirty = true;
            }
            if (this.timeline.style.cursor !== 'pointer') this.timeline.style.cursor = 'pointer';
            this.showTipAt(0, 0, '');
            return;
        }
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var preBranchBtn = onRulerAny ? null : this.hitTestBranchModeButton(x, y);
        var preOrderBtn = onRulerAny ? null : this.hitTestOrderButton(x, y);
        var preComment = onRulerAny ? null : this.hitTestComment(x, y);
        var preNode = onRulerAny ? null : this.hitTestNode(x, y);
        var hc = onRulerAny ? null : preComment;
        var hn = onRulerAny ? null : preNode;
        var hb = (onRulerAny || hn) ? null : this.hitTestBar(x, y);
        var hob = onRulerAny ? null : preOrderBtn;
        var hib = onRulerAny ? null : preBranchBtn;
        var hru = (hb && hb.routeRangeUid) ? Math.floor(Number(hb.routeRangeUid || 0)) : 0;
        var hrp = (hb && hb.routeRangeUid) ? String(hb.routeRangePart || '') : '';
        if (Number(this.hoverRangeUid || 0) !== hru || String(this.hoverRangePart || '') !== hrp) {
            this.hoverRangeUid = hru;
            this.hoverRangePart = hrp;
            this.timelineDirty = true;
        }
        var endHoverNow = !!(hn && hn.isEndMarker);
        if (!!this.hoverEndMarker !== endHoverNow) {
            this.hoverEndMarker = endHoverNow;
            this.timelineDirty = true;
        }
        var cursor = 'crosshair';
        if (this.dragState && this.dragState.endMarker) {
            cursor = 'ew-resize';
        } else if (this.dragState && this.dragState.uid && this.dragState.isRangeDrag) {
            var dragPart = String(this.dragState.rangePart || '');
            if (dragPart === 'left' || dragPart === 'right') cursor = 'ew-resize';
            else if (dragPart === 'move') cursor = 'move';
        } else if (hn && hn.isEndMarker) {
            cursor = 'ew-resize';
        } else if (hb && hb.routeRangeUid) {
            var hoverPart = String(hb.routeRangePart || '');
            if (hoverPart === 'left' || hoverPart === 'right') cursor = 'ew-resize';
            else if (hoverPart === 'move') cursor = 'move';
            else cursor = 'pointer';
        } else if (hib) {
            cursor = 'pointer';
        } else if (hob) {
            cursor = 'pointer';
        } else if (hn || hc || hb) {
            cursor = 'pointer';
        }
        if (this.timeline.style.cursor !== cursor) this.timeline.style.cursor = cursor;
        var hf = this.xToFrame(x);
        if (Number(this.hoverFrame) !== Number(hf)) {
            this.hoverFrame = Number(hf);
            this.timelineCursorDirty = true;
        }
        this.setHoverNode((hn && hn.isEndMarker) ? null : (hn || null));
        if (hc) {
            var cLines = this.commentTooltipLinesAtFrame(hc.frame);
            this.showTipAt(e.clientX, e.clientY, cLines);
        } else if (hn && hn.isEndMarker) {
            this.showTipAt(e.clientX, e.clientY, ['終了', Math.max(0, Math.floor(Number(hn.frame || 0))) + 'f']);
        } else if (hob) {
            this.showTipAt(e.clientX, e.clientY, hob.dir === 'prev' ? ['前へ'] : ['次へ']);
        } else if (hn || hb) {
            var hit = hn || hb;
            var lines = this.commandTooltipLinesForHit(hit);
            this.showTipAt(e.clientX, e.clientY, lines);
        } else {
            this.showTipAt(0, 0, '');
        }
        if (this.tInfo) {
            var sid = (this.selUid || '-');
            if (this.selRouteListIndex != null && this.selRouteListIndex >= 0) sid += '/route[' + this.selRouteListIndex + ']';
            this.tInfo.textContent = 'フレーム: ' + this.frame + ' | カーソル: ' + hf + ' | 選択: ' + sid;
        }

        if (this.dragState && this.dragState.endMarker) {
            var dxEnd = x - this.dragState.startX;
            var dyEnd = y - this.dragState.startY;
            if (!this.dragState.moved && (Math.abs(dxEnd) > 3 || Math.abs(dyEnd) > 3)) this.dragState.moved = true;
            if (!this.dragState.moved) return;
            var trEnd = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            var minEnd = this.trackComputedEndFrame(trEnd);
            this.dragState.targetFrame = Math.max(minEnd, this.xToFrame(x));
            this.timelineDirty = true;
            return;
        }

        if (!this.dragState || !this.dragState.uid) return;
        if (!this.model || !this.model.tracks) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr) return;
        var de = this.findEntryInSelectedTrack(Number(this.dragState.uid || 0));
        if (!de) return;
        var dragBoundaryEdge = String(this.dragState.branchDragBoundary || this.dragState.branchBoundary || '');
        if (dragBoundaryEdge) {
            var dxBoundary = x - this.dragState.startX;
            var dyBoundary = y - this.dragState.startY;
            if (!this.dragState.moved && (Math.abs(dxBoundary) > 3 || Math.abs(dyBoundary) > 3)) {
                this.dragState.moved = true;
            }
            if (!this.dragState.moved) return;
            var boundaryPlan = this.branchBoundaryMovePlan(
                tr,
                Math.floor(Number(this.dragState.branchOwnerUid || 0)),
                dragBoundaryEdge,
                this.xToFrame(x)
            );
            this.dragState.targetFrame = boundaryPlan
                ? Math.max(0, Math.floor(Number(boundaryPlan.frame || 0)))
                : Math.max(0, Math.floor(Number(this.dragState.startFrame || 0)));
            this.dragState.targetRowKey = 'main';
            this.dragState.valid = !!(boundaryPlan && boundaryPlan.valid);
            this.dragState.boundaryClamped = !!(boundaryPlan && boundaryPlan.clamped);
            this.dragState.boundaryInvalidReason = boundaryPlan ? String(boundaryPlan.reason || '') : 'missing-boundary';
            this.timelineDirty = true;
            return;
        }
        var dx = x - this.dragState.startX, dy = y - this.dragState.startY;
        if (!this.dragState.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) this.dragState.moved = true;
        if (!this.dragState.moved) return;

        if (this.dragState.routeListIndex != null && this.dragState.routeListIndex >= 0) {
            var dRouteListIndex = this.nodeRouteIndex(this.dragState.routeListIndex);
            var dRouteUid = Math.floor(Number(this.dragState.uid || 0));
            var dRouteFrame = Math.max(0, Math.floor(Number(this.dragState.startFrame || 0)));
            this.setRangeSelection('rect', [{ kind: 'routeCmd', uid: dRouteUid, routeListIndex: dRouteListIndex }], {
                frameStart: dRouteFrame,
                frameEnd: dRouteFrame,
                rects: [],
                nonContiguous: false
            });
            this.beginRangeMoveDrag(this.dragState.startX, this.dragState.startY, {
                kind: 'routeCmd',
                uid: dRouteUid,
                routeListIndex: dRouteListIndex
            });
            this.dragState = null;
            this.updateRangeMoveDrag(x, y);
            return;
        }

        if (this.dragState.isRangeDrag) {
            var part = String(this.dragState.rangePart || '');
            if (part !== 'left' && part !== 'right' && part !== 'move') {
                this.dragState.valid = true;
                return;
            }
            var pf = this.xToFrame(x);
            var baseMin = 1;
            var leadingWait = 0;
            if (de.command && Number(de.command.code || 0) === 205) {
                var rt = de.command.parameters && de.command.parameters[1];
                baseMin = Math.max(1, this.moveRouteBaseFramesWithoutTrailingWait(rt));
                leadingWait = Math.max(0, this.moveRouteLeadingWaitFrames(rt));
            }
            var ns = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)));
            var nw = Math.max(1, Math.floor(Number(this.dragState.startWait || 1)));
            if (part === 'left') {
                var baseStart = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)));
                var maxStart = baseStart + leadingWait;
                ns = Math.max(0, Math.min(maxStart, pf));
                nw = Math.max(1, Math.floor(Number(this.dragState.startWait || 1)) + (baseStart - ns));
            } else if (part === 'right') {
                ns = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)));
                nw = Math.max(1, pf - ns);
                if (nw < baseMin) nw = baseMin;
            } else if (part === 'move') {
                var delta = pf - Math.max(0, Math.floor(Number(this.dragState.startFrame || 0)));
                ns = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)) + delta);
                nw = Math.max(1, Math.floor(Number(this.dragState.startWait || 1)));
            }
            this.dragState.targetFrame = ns;
            this.dragState.targetWait = nw;
            var probe = clone(de);
            probe.frame = ns;
            probe.wait = nw;
            this.dragState.valid = this.canPlaceEntry(tr, probe, ns, de.rowKey, de.uid);
            this.timelineDirty = true;
            return;
        }

        var row = this.rowFromY(y);
        var rowKey = row ? row.key : this.dragState.startRowKey;
        if (this.dragState.mainRouteProxy) {
            rowKey = de.rowKey || (de.rowType === 'char' ? ('char:' + de.charId) : this.dragState.startRowKey);
        }
        var frame = this.xToFrame(x);
        this.dragState.targetFrame = frame;
        this.dragState.targetRowKey = rowKey;
        this.dragState.valid = this.canPlaceEntry(tr, de, frame, rowKey, de.uid);
        this.timelineDirty = true;
    };

    EE.prototype.onTimelineDown = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        if (e.button !== 0 && e.button !== 1) return;
        var p = this.timelinePointFromClient(e.clientX, e.clientY);
        if (!p) return;
        var x = p.x, y = p.y;
        if (this.tryStartSpacePanOnTimeline(e, x, y)) return;
        if (e.button !== 0) return;
        if (this.controlMode) this.setInteractionMode('timeline', 'timeline');
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var onRulerTrack = this.isTimelineRulerPoint(x, y, false);
        var preNode = onRulerAny ? null : this.hitTestNode(x, y);
        var preComment = onRulerAny ? null : this.hitTestComment(x, y);
        var preBar = onRulerAny ? null : this.hitTestBar(x, y);
        var preOrderBtn = onRulerAny ? null : this.hitTestOrderButton(x, y);
        var preBranchBtn = onRulerAny ? null : this.hitTestBranchModeButton(x, y);
        var commandModifier = !!(e.shiftKey || e.ctrlKey || e.metaKey);
        var inFixedLabel = this.isPointInTimelineFixedLabel(x);
        if (inFixedLabel) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            if (this.hasRangeSelection()) this.clearRangeSelection();
            this.setTimelineSelectionAnchorItem(null);
            if (this.isTimelineRulerY(y)) {
                this.showTipAt(0, 0, '');
                return;
            }
            var labelRow = this.rowFromY(y);
            if (!labelRow && this.timelineWrap) {
                var sy = Math.max(0, Number(this.timelineWrap.scrollTop || 0));
                if (sy > 0) labelRow = this.rowFromY(Number(y || 0) + sy);
            }
            var labelRowKey = labelRow ? String(labelRow.key || 'main') : 'main';
            if (labelRowKey.indexOf('char:') === 0) {
                var labelCid = this.normalizeMoveTarget(Number(labelRowKey.replace('char:', '')));
                this.panelSelectedCharId = labelCid;
                this.cleanupTemporaryCharRows(labelCid);
            } else {
                this.panelSelectedCharId = null;
                this.cleanupTemporaryCharRows(null);
            }
            this.refreshCharacterPanel(true);
            this.timelineDirty = true;
            return;
        }
        if (preOrderBtn) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.suppressTimelineDblClickUntil = Date.now() + 450;
            if (preOrderBtn.enabled) this.moveSameFrameCommand(Number(preOrderBtn.uid || 0), String(preOrderBtn.dir || 'prev'));
            return;
        }
        if (preBranchBtn) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.suppressTimelineDblClickUntil = Date.now() + 450;
            this.applyBranchViewModeByUid(Number(preBranchBtn.uid || 0), String(preBranchBtn.mode || 'auto'));
            return;
        }
        if (preNode && preNode.isEndMarker) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            if (this.hasRangeSelection()) this.clearRangeSelection();
            this.setTimelineSelectionAnchorItem(null);
            var endFrame = Math.max(0, Math.floor(Number(preNode.frame || 0)));
            this.dragState = {
                endMarker: true,
                startX: x,
                startY: y,
                startFrame: endFrame,
                targetFrame: endFrame,
                moved: false,
                valid: true
            };
            this.frame = endFrame;
            this.timelineDirty = true;
            return;
        }
        if (!commandModifier && !onRulerAny && this.hasRangeSelection()) {
            var preSelHit = this.rangeSelectionHitAtPoint(x, y);
            if (preSelHit && this.beginRangeMoveDrag(x, y, preSelHit)) {
                e.preventDefault();
                this.closeRouteRangeContextMenu();
                return;
            }
        }
        if (onRulerTrack) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.beginRangeSelectionDrag('memory', x, y, e);
            return;
        }
        if (!onRulerAny && y > this.rulerH && !preNode && !preBar && !preComment) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.beginRangeSelectionDrag('rect', x, y, e);
            return;
        }
        e.preventDefault();
        this.closeRouteRangeContextMenu();
        var node = preNode;
        var hb = preBar;
        if (hb && hb.routeRangeUid) {
            var rp = String(hb.routeRangePart || '');
            if (rp === 'body') {
                var nearRouteNode = this.hitTestRouteCommandNodeNear(Number(hb.routeRangeUid || 0), x, y, 5);
                if (nearRouteNode) node = nearRouteNode;
            }
            if (rp === 'left' || rp === 'right' || rp === 'move') {
                // Follow current hover/cursor intent:
                // - handle cursor (ew-resize/move) => prioritize handle drag
                // - pointer cursor on circle       => keep circle selection
                var hoverUid = Math.floor(Number(this.hoverRangeUid || 0));
                var hoverPart = String(this.hoverRangePart || '');
                var hoverOnHandle = (hoverUid === Math.floor(Number(hb.routeRangeUid || 0))) &&
                    (hoverPart === 'left' || hoverPart === 'right' || hoverPart === 'move');
                var cursorNow = String((this.timeline && this.timeline.style && this.timeline.style.cursor) || '');
                var cursorOnHandle = (cursorNow === 'ew-resize' || cursorNow === 'move');
                var nodeIsRouteCmd = !!(node && node.routeListIndex != null && Number(node.routeListIndex) >= 0);
                var nodeCoreHit = false;
                if (nodeIsRouteCmd && typeof this.timelineCircleHitPoint === 'function' && typeof this.scaleTimelineCircleRadius === 'function') {
                    // Use a tighter radius than generic hitTestNode so route handles remain operable.
                    var tightR = this.scaleTimelineCircleRadius(Math.max(1, Number(node.r || 5)));
                    nodeCoreHit = this.timelineCircleHitPoint(x, y, Number(node.x || 0), Number(node.y || 0), tightR);
                }
                // If actually clicking on the route command circle core, keep node priority.
                if ((hoverOnHandle || cursorOnHandle) && !nodeCoreHit) node = null;
            }
            else if (node && hb.routeCmdCode == null) {
                var isRouteSubNodeBody = (node.routeListIndex != null && Number(node.routeListIndex) >= 0);
                if (isRouteSubNodeBody) {
                    // Keep move-route sub-command node selection when clicking on a circle.
                } else {
                // Prioritize route-range body hit over node so whole-range selection is easier.
                var ne = this.findEntryInSelectedTrack(Number(node.uid || 0));
                if (ne && ne.command && Number(ne.command.code || 0) === 205 && ne.rowType === 'char') node = null;
                }
            }
        }
        var hoverNode = node;
        if (!hoverNode && hb && hb.routeRangeUid) hoverNode = { uid: hb.routeRangeUid, routeListIndex: -1 };
        this.setHoverNode(hoverNode || null);
        var nodeRouteListIndex = node ? this.nodeRouteIndex(node.routeListIndex) : -1;
        var prevRouteListIndex = this.nodeRouteIndex(this.selRouteListIndex);
        var nodeBoundaryPart = node ? String(node.branchBoundary || '') : '';
        var nodeDragBoundaryPart = node ? String(node.branchDragBoundary || nodeBoundaryPart) : '';
        var nodeBranchOwnerUid = node
            ? Math.floor(Number(node.branchOwnerUid || (nodeDragBoundaryPart === 'start' ? node.uid : 0)) || 0)
            : 0;
        var wasSelected = !!node && Number(this.selUid || 0) === Number(node.uid || 0) &&
            prevRouteListIndex === nodeRouteListIndex &&
            String(this.selBranchBoundaryPart || '') === nodeBoundaryPart;
        var rangeUid = (hb && hb.routeRangeUid) ? Math.floor(Number(hb.routeRangeUid || 0)) : 0;
        var rangeEntry = rangeUid > 0 ? this.findRouteRangeEntryByUid(rangeUid) : null;
        if (!node && rangeEntry) {
            wasSelected = Number(this.selUid || 0) === Number(rangeUid) && prevRouteListIndex < 0;
        }
        var row = this.rowFromY(y);
        var rowKey = node ? node.rowKey : (rangeEntry ? rangeEntry.rowKey : (row ? row.key : 'main'));
        if (String(rowKey || '').indexOf('char:') === 0) {
            var cid = this.normalizeMoveTarget(Number(String(rowKey).replace('char:', '')));
            this.cleanupTemporaryCharRows(cid);
            this.panelSelectedCharId = cid;
        } else {
            this.cleanupTemporaryCharRows(null);
            this.panelSelectedCharId = null;
        }
        this.refreshCharacterPanel(true);
        var modifierTarget = null;
        if (node) {
            modifierTarget = nodeRouteListIndex >= 0
                ? { kind: 'routeCmd', uid: Number(node.uid || 0), routeListIndex: nodeRouteListIndex }
                : { kind: 'entry', uid: Number(node.uid || 0) };
        } else if (rangeEntry) {
            modifierTarget = { kind: 'entry', uid: Number(rangeEntry.uid || 0) };
        }
        if (commandModifier && modifierTarget && this.applyTimelineModifierSelection(modifierTarget, e)) {
            this.dragState = null;
            this.rangeMoveDrag = null;
            return;
        }
        if (this.hasRangeSelection()) this.clearRangeSelection();
        var dragStartFrame = this.xToFrame(x);
        var rangeStartWait = rangeEntry ? Math.max(1, Math.floor(Number(rangeEntry.wait || 1))) : 0;
        if (rangeEntry && rangeEntry.command && Number(rangeEntry.command.code || 0) === 205 &&
            typeof this.routeExecutionSpanFramesForEntry === 'function') {
            var routeSpan = Math.max(1, Math.floor(Number(this.routeExecutionSpanFramesForEntry(rangeEntry) || rangeStartWait || 1)));
            rangeStartWait = routeSpan;
        }
        this.dragState = {
            uid: node ? node.uid : (rangeEntry ? rangeUid : 0),
            routeListIndex: node ? nodeRouteListIndex : null,
            startX: x,
            startY: y,
            startFrame: node ? node.frame : dragStartFrame,
            startRowKey: rowKey,
            targetFrame: node ? node.frame : (rangeEntry ? Math.max(0, Math.floor(Number(rangeEntry.frame || 0))) : dragStartFrame),
            targetRowKey: rowKey,
            wasSelected: wasSelected,
            moved: false,
            valid: true,
            emptyClick: !node && !rangeEntry,
            rangePart: rangeEntry ? String(hb.routeRangePart || 'body') : '',
            startWait: rangeEntry ? rangeStartWait : 0,
            startEntryFrame: rangeEntry ? Math.max(0, Math.floor(Number(rangeEntry.frame || 0))) : 0,
            targetWait: rangeEntry ? rangeStartWait : 0,
            isRangeDrag: !!rangeEntry && !(node && nodeRouteListIndex >= 0),
            mainRouteProxy: !!(node && node.mainRouteProxy),
            branchBoundary: nodeBoundaryPart,
            branchDragBoundary: nodeDragBoundaryPart,
            branchOwnerUid: nodeBranchOwnerUid
        };
        if (node) {
            this.selUid = node.uid;
            this.selRouteListIndex = nodeRouteListIndex;
            this.selBranchBoundaryPart = nodeBoundaryPart;
            this.frame = node.frame;
            this.setTimelineSelectionAnchorItem(nodeRouteListIndex >= 0
                ? { kind: 'routeCmd', uid: Number(node.uid || 0), routeListIndex: nodeRouteListIndex }
                : { kind: 'entry', uid: Number(node.uid || 0) });
            this.timelineDirty = true;
        } else if (rangeEntry) {
            this.selUid = rangeEntry.uid;
            this.selRouteListIndex = -1;
            this.selBranchBoundaryPart = '';
            this.frame = Math.max(0, Math.floor(Number(rangeEntry.frame || 0)));
            this.setTimelineSelectionAnchorItem({ kind: 'entry', uid: Number(rangeEntry.uid || 0) });
            this.timelineDirty = true;
        }
    };

    EE.prototype.onTimelineDblClick = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        if (Date.now() < Number(this.suppressTimelineDblClickUntil || 0)) {
            e.preventDefault();
            return;
        }
        if (this.controlMode) this.setInteractionMode('timeline', 'timeline');
        e.preventDefault();
        if (this.hasRangeSelection()) this.clearRangeSelection();
        var p = this.timelinePointFromClient(e.clientX, e.clientY);
        if (!p) return;
        var x = p.x, y = p.y;
        if (this.isPointInTimelineFixedLabel(x)) return;
        if (this.isTimelineRulerY(y)) return;
        var hitNode = this.hitTestNode(x, y);
        var hitRange = this.hitTestBar(x, y);
        var frame = this.xToFrame(x);
        if (hitNode) {
            if (hitNode.isEndMarker) {
                this.seek(Math.max(0, Math.floor(Number(hitNode.frame || 0))));
                return;
            }
            this.selUid = Number(hitNode.uid || 0);
            this.selRouteListIndex = this.nodeRouteIndex(hitNode.routeListIndex);
            this.selBranchBoundaryPart = String(hitNode.branchBoundary || '');
            this.frame = Math.max(0, Math.floor(Number(hitNode.frame || 0)));
            this.setTimelineSelectionAnchorItem(this.selRouteListIndex >= 0
                ? { kind: 'routeCmd', uid: this.selUid, routeListIndex: this.selRouteListIndex }
                : { kind: 'entry', uid: this.selUid });
            this.timelineDirty = true;
            if (this.selUid && this.selBranchBoundaryPart !== 'end') {
                this.openEditor(this.selUid, this.selRouteListIndex >= 0 ? this.selRouteListIndex : undefined);
            }
            return;
        }
        if (hitRange && hitRange.routeRangeUid) {
            var rangeEntry = this.findRouteRangeEntryByUid(Number(hitRange.routeRangeUid || 0));
            var routeHit = this.routeTimelineItemAtFrame(rangeEntry, frame);
            if (rangeEntry && routeHit && routeHit.listIndex >= 0) {
                this.selUid = Number(rangeEntry.uid || 0);
                this.selRouteListIndex = this.nodeRouteIndex(routeHit.listIndex);
                this.frame = Math.max(0, Math.floor(Number(routeHit.frame || frame)));
                this.setTimelineSelectionAnchorItem({ kind: 'routeCmd', uid: this.selUid, routeListIndex: this.selRouteListIndex });
                this.timelineDirty = true;
                if (this.selUid) this.openEditor(this.selUid, this.selRouteListIndex);
                return;
            }
        }
        var row = this.rowFromY(y);
        var hitBar = hitRange;
        if (hitBar && (!row || String(row.key || '').indexOf('char:') !== 0)) return;
        var rowKey = row ? row.key : 'main';
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.selBranchBoundaryPart = '';
        this.frame = frame;
        this.timelineDirty = true;
        if (String(rowKey || '').indexOf('char:') === 0) {
            var cid = this.normalizeMoveTarget(Number(String(rowKey).replace('char:', '')));
            this.panelSelectedCharId = cid;
            this.cleanupTemporaryCharRows(cid);
            this.refreshCharacterPanel(true);
            this.openRouteCommandPanel(frame, rowKey);
        } else {
            this.panelSelectedCharId = null;
            this.cleanupTemporaryCharRows(null);
            this.refreshCharacterPanel(true);
            if (this.isFrameLockedForFrameCommandAdd(frame)) {
                this.msg('コマンド追加不可: ウェイト実行中フレームです');
                return;
            }
            this.openAddCommandPanel(frame, rowKey, this.makeAddPlacementContextFromFrame(frame));
        }
    };

    EE.prototype.onTimelineContextMenu = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        e.preventDefault();
        this.closeCameraContextMenu();
        var p = this.timelinePointFromClient(e.clientX, e.clientY);
        if (!p) return;
        var x = p.x, y = p.y;
        if (this.isPointInTimelineFixedLabel(x)) {
            this.showTipAt(0, 0, '');
            return;
        }
        var clickedFrame = this.xToFrame(x);
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var hn = onRulerAny ? null : this.hitTestNode(x, y);
        var hb = onRulerAny ? null : this.hitTestBar(x, y);
        if (hn && hn.isEndMarker) {
            var endFrame = Math.max(0, Math.floor(Number(hn.frame || clickedFrame || 0)));
            this.frame = endFrame;
            this.timelineDirty = true;
            var endCtx = this.makeWaitInsertContextFromFrame(endFrame, 'main');
            endCtx.endMarker = true;
            this.openTimelineContextMenu(e.clientX, e.clientY, endCtx);
            return;
        }
        var hnrli = hn ? this.nodeRouteIndex(hn.routeListIndex) : -1;
        if (!onRulerAny && this.hasRangeSelection() && this.isPointInsideCurrentRangeSelection(x, y)) {
            this.openSelectionContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromSelection());
            return;
        }
        if (hn && hnrli >= 0) {
            var he = this.findEntryInSelectedTrack(Number(hn.uid || 0));
            if (he && he.command && Number(he.command.code || 0) === 205 && he.rowType === 'char') {
                if (this.hasRangeSelection()) this.clearRangeSelection();
                this.selUid = Number(hn.uid || 0);
                this.selRouteListIndex = hnrli;
                this.selBranchBoundaryPart = '';
                this.frame = Math.max(0, Math.floor(Number(hn.frame || clickedFrame || 0)));
                this.setTimelineSelectionAnchorItem({ kind: 'routeCmd', uid: this.selUid, routeListIndex: hnrli });
                this.timelineDirty = true;
                this.openTimelineContextMenu(
                    e.clientX,
                    e.clientY,
                    this.makeWaitInsertContextFromRouteCommand(Number(hn.uid || 0), hnrli, Number(hn.frame || clickedFrame || 0))
                );
                return;
            }
        }
        var uid = 0;
        if (hb && hb.routeRangeUid) {
            uid = Number(hb.routeRangeUid || 0);
        } else if (hb && hb.uid) {
            var be = this.findEntryInSelectedTrack(Number(hb.uid || 0));
            if (be && be.command && Number(be.command.code || 0) === 205 && be.rowType === 'char') {
                uid = Number(be.uid || 0);
            }
        } else if (hn) {
            var ne = this.findEntryInSelectedTrack(Number(hn.uid || 0));
            if (ne && ne.command && Number(ne.command.code || 0) === 205 && ne.rowType === 'char') {
                uid = Number(ne.uid || 0);
            }
        }
        if (uid > 0) {
            if (this.hasRangeSelection()) this.clearRangeSelection();
            this.selUid = uid;
            this.selRouteListIndex = -1;
            this.selBranchBoundaryPart = '';
            this.setTimelineSelectionAnchorItem({ kind: 'entry', uid: uid });
            var e2 = this.findEntryInSelectedTrack(uid);
            if (e2) this.frame = Math.max(0, Math.floor(Number(e2.frame || 0)));
            this.timelineDirty = true;
            this.openRouteRangeContextMenu(uid, e.clientX, e.clientY, this.makeWaitInsertContextFromCommand(uid, clickedFrame));
            return;
        }
        var cmdUid = 0;
        if (hn && Number(hn.uid || 0) > 0) cmdUid = Number(hn.uid || 0);
        if (!cmdUid && hb && Number(hb.uid || 0) > 0) cmdUid = Number(hb.uid || 0);
        if (cmdUid > 0) {
            var ce = this.findEntryInSelectedTrack(cmdUid);
            if (ce) {
                if (this.hasRangeSelection()) this.clearRangeSelection();
                this.selUid = cmdUid;
                this.selRouteListIndex = (hn && Number(hn.uid || 0) === cmdUid)
                    ? this.nodeRouteIndex(hn.routeListIndex)
                    : -1;
                this.selBranchBoundaryPart = (hn && Number(hn.uid || 0) === cmdUid)
                    ? String(hn.branchBoundary || '')
                    : '';
                this.setTimelineSelectionAnchorItem(this.selRouteListIndex >= 0
                    ? { kind: 'routeCmd', uid: cmdUid, routeListIndex: this.selRouteListIndex }
                    : { kind: 'entry', uid: cmdUid });
                this.frame = Math.max(0, Math.floor(Number(ce.frame || clickedFrame || 0)));
                this.timelineDirty = true;
            }
            this.openTimelineContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromCommand(cmdUid, clickedFrame));
            return;
        }
        var row = this.rowFromY(y);
        var rowKey = row ? String(row.key || 'main') : 'main';
        this.openTimelineContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromFrame(clickedFrame, rowKey));
    };

    EE.prototype.onTimelineUp = function() {
        if (this.panState) {
            this.endSpacePanDrag();
            this.timelineDirty = true;
            return;
        }
        if (this.rangeSelectDrag) {
            this.finalizeRangeSelectionDrag();
            return;
        }
        if (this.rangeMoveDrag) {
            this.applyRangeMoveDrag();
            return;
        }
        if (!this.dragState) return;
        var ds = this.dragState;
        this.dragState = null;
        if (ds.endMarker) {
            var trEnd = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            if (!trEnd) return;
            var oldEnd = this.normalizeTrackEndFrame(trEnd);
            var minEnd = this.trackComputedEndFrame(trEnd);
            var targetEnd = Math.max(minEnd, Math.floor(Number((ds.targetFrame == null ? ds.startFrame : ds.targetFrame) || 0)));
            if (ds.moved && targetEnd !== oldEnd) {
                this.pushSnap('endMarker');
                trEnd.endFrame = targetEnd;
                this.normalizeTrackEndFrame(trEnd);
                this.commitTrackMutation({ rebuild: false, sort: false, earliestChangedFrame: oldEnd });
            }
            this.seek(Math.max(0, Math.floor(Number(trEnd.endFrame || targetEnd || ds.startFrame || 0))));
            return;
        }
        if (ds.uid) {
            if (ds.isRangeDrag) {
                var trr = this.model.tracks[this.selKey];
                if (!trr) return;
                var re = null;
                for (var ri = 0; ri < trr.commands.length; ri++) {
                    if (trr.commands[ri].uid === ds.uid) { re = trr.commands[ri]; break; }
                }
                if (!re) return;
                var rp = String(ds.rangePart || '');
                if (rp !== 'left' && rp !== 'right' && rp !== 'move') {
                    this.seek(re.frame);
                    return;
                }
                if (!ds.moved) {
                    this.seek(re.frame);
                    return;
                }
                if (!ds.valid) {
                    this.msg('ドロップ失敗（ウェイト重複 / 範囲不正）');
                    this.timelineDirty = true;
                    return;
                }
                var oldFrame = Math.max(0, Math.floor(Number(re.frame || 0)));
                var oldWait = Math.max(1, Math.floor(Number(re.wait || 1)));
                if (re.command && Number(re.command.code || 0) === 205 &&
                    typeof this.routeExecutionSpanFramesForEntry === 'function') {
                    oldWait = Math.max(1, Math.floor(Number(this.routeExecutionSpanFramesForEntry(re) || oldWait)));
                }
                var oldCmd = clone(re.command);
                var newFrame = Math.max(0, Math.floor(Number(ds.targetFrame || oldFrame)));
                if (ds.rangePart === 'left' || ds.rangePart === 'right') {
                    var tw = Math.max(1, Math.floor(Number(ds.targetWait || oldWait)));
                    if (newFrame === oldFrame && tw === oldWait) {
                        this.seek(re.frame);
                        return;
                    }
                } else if (newFrame === oldFrame) {
                    this.seek(re.frame);
                    return;
                }
                this.pushSnap('routeRange');
                if (ds.rangePart === 'left') {
                    var deltaLeft = oldFrame - newFrame;
                    if (!this.shiftMoveRouteLeftBoundary(re.command, deltaLeft)) {
                        this.msg('ドロップ失敗（左端をこれ以上縮められません）');
                        this.timelineDirty = true;
                        return;
                    }
                    re.frame = newFrame;
                    re.wait = this.commandWaitFrames(re.command);
                } else if (ds.rangePart === 'right') {
                    re.frame = oldFrame;
                    this.setMoveRouteDuration(re.command, Math.max(1, Math.floor(Number(ds.targetWait || oldWait))));
                    re.wait = this.commandWaitFrames(re.command);
                } else {
                    re.frame = newFrame;
                    re.wait = this.commandWaitFrames(re.command);
                }
                if (!this.canPlaceEntry(trr, re, re.frame, re.rowKey, re.uid)) {
                    re.frame = oldFrame;
                    re.wait = oldWait;
                    re.command = oldCmd;
                    this.msg('ドロップ失敗（ウェイト重複 / 範囲不正）');
                    this.timelineDirty = true;
                    return;
                }
                this.selUid = re.uid;
                this.selRouteListIndex = -1;
                this.frame = re.frame;
                this.commitTrackMutation({ earliestChangedFrame: Math.min(oldFrame, newFrame) });
                this.seek(this.frame);
                return;
            }
            if (ds.routeListIndex != null && ds.routeListIndex >= 0) {
                if (ds.moved) {
                    this.msg('移動ルート内サブコマンドのドラッグは無効です');
                    this.timelineDirty = true;
                    return;
                }
                this.seek(ds.startFrame);
                if (ds.wasSelected) this.openEditor(ds.uid, ds.routeListIndex);
                return;
            }
            var boundaryDragEdge = String(ds.branchDragBoundary || ds.branchBoundary || '');
            if (boundaryDragEdge) {
                var branchTrack = this.model.tracks[this.selKey];
                var boundaryContext = branchTrack
                    ? this.branchBoundaryContextForOwnerUid(branchTrack, Math.floor(Number(ds.branchOwnerUid || 0)))
                    : null;
                var branchBoundaryEntry = boundaryContext
                    ? (boundaryDragEdge === 'end' ? boundaryContext.endEntry : boundaryContext.ownerEntry)
                    : null;
                if (!branchTrack || !branchBoundaryEntry) return;
                this.selUid = Math.floor(Number(ds.uid || branchBoundaryEntry.uid || 0));
                this.selRouteListIndex = -1;
                this.selBranchBoundaryPart = String(ds.branchBoundary || '');
                var branchTargetFrame = Math.max(0, Math.floor(Number(
                    ds.targetFrame == null ? ds.startFrame : ds.targetFrame
                ) || 0));
                if (ds.moved) {
                    var boundaryPlan = this.branchBoundaryMovePlan(
                        branchTrack,
                        Math.floor(Number(ds.branchOwnerUid || 0)),
                        boundaryDragEdge,
                        branchTargetFrame
                    );
                    if (!boundaryPlan || !boundaryPlan.valid) {
                        this.msg('ドロップ失敗（分岐範囲 / ウェイト重複）');
                        this.timelineDirty = true;
                        this.seek(Math.max(0, Math.floor(Number(branchBoundaryEntry.frame || ds.startFrame || 0))));
                        return;
                    }
                    if (boundaryPlan.changed) {
                        this.pushSnap(boundaryDragEdge === 'end' ? 'branchEndFrame' : 'branchStartFrame');
                        var boundaryResult = this.applyBranchBoundaryMovePlan(branchTrack, boundaryPlan);
                        if (boundaryResult && boundaryResult.changed) {
                            this.frame = boundaryResult.frame;
                            this.commitTrackMutation({ earliestChangedFrame: boundaryResult.earliestChangedFrame });
                            this.seek(this.frame);
                            return;
                        }
                    }
                }
                this.frame = Math.max(0, Math.floor(Number(branchBoundaryEntry.frame || ds.startFrame || 0)));
                this.seek(this.frame);
                if (!ds.moved && ds.wasSelected && ds.branchBoundary !== 'end') this.openEditor(ds.uid);
                return;
            }
            if (ds.moved) {
                var tr = this.model.tracks[this.selKey];
                if (!tr) return;
                var de = this.findEntryInSelectedTrack(Number(ds.uid || 0));
                if (!de) return;
                if (!ds.valid) {
                    this.msg('ドロップ失敗（ウェイト重複 / 行不正）');
                    this.timelineDirty = true;
                    return;
                }
                this.pushSnap('drag');
                de.frame = Math.max(0, Math.floor(Number(ds.targetFrame || 0)));
                if (de.rowType === 'char') {
                    var oldCharId = this.normalizeMoveTarget(Number(de.charId || 0));
                    var cid = Number(String(ds.targetRowKey || '').replace('char:', ''));
                    if (!isNaN(cid)) {
                        cid = this.normalizeMoveTarget(cid);
                        de.charId = cid;
                        de.rowKey = 'char:' + cid;
                        if (de.command && de.command.code === 205) de.command.parameters[0] = cid;
                        if (cid !== oldCharId) de.routeSymbolOrdinal = 0;
                    }
                }
                this.selUid = de.uid;
                this.selRouteListIndex = -1;
                this.selBranchBoundaryPart = String(ds.branchBoundary || '');
                this.frame = de.frame;
                this.commitTrackMutation({ earliestChangedFrame: Math.min(ds.startFrame, de.frame) });
                this.seek(this.frame);
                return;
            }
            this.selRouteListIndex = -1;
            this.selBranchBoundaryPart = String(ds.branchBoundary || '');
            this.seek(ds.startFrame);
            if (ds.wasSelected && ds.branchBoundary !== 'end') this.openEditor(ds.uid);
            return;
        }
        if (ds.emptyClick && !ds.moved) {
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.selBranchBoundaryPart = '';
            this.setTimelineSelectionAnchorItem(null);
            this.closeEditor();
            this.seek(ds.startFrame);
        }
    };

    EE.prototype.onTimelineWheel = function(e) {
        if (!this.timelineWrap) return;
        var p = this.timelinePointFromClient(e.clientX, e.clientY);
        if (!p) return;
        var x = p.x, y = p.y;
        var onRuler = this.isTimelineRulerPoint(x, y, true);
        var doZoom = !!onRuler || !!e.ctrlKey;
        var wheel = eeWheelPixelDelta(e, this.timelineWrap.clientHeight || 100);
        var dx = wheel.dx;
        var dy = wheel.dy;

        if (doZoom) {
            e.preventDefault();
            var beforeFrame = this.xToFrame(x);
            var beforeX = this.frameToX(beforeFrame);
            var px = this.pxPerFrame;
            var zDelta = (Math.abs(dy) >= Math.abs(dx)) ? dy : dx;
            if (zDelta < 0) px *= 1.15; else if (zDelta > 0) px /= 1.15;
            px = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, px));
            if (Math.abs(px - this.pxPerFrame) < 0.0001) return;
            this.stopTimelineAutoScrollAnimation();
            this.pxPerFrame = px;
            this.syncTimelineSize();
            var afterX = this.frameToX(beforeFrame);
            this.timelineWrap.scrollLeft += (afterX - beforeX);
            this.timelineDirty = true;
            return;
        }

        var wrap = this.timelineWrap;
        var canScrollX = (wrap.scrollWidth - wrap.clientWidth) > 1;
        var canScrollY = (wrap.scrollHeight - wrap.clientHeight) > 1;
        if (!canScrollX && !canScrollY) return;

        // If only horizontal overflow exists, treat vertical wheel as horizontal pan.
        if (canScrollX && !canScrollY && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (e.shiftKey && canScrollX && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }

        var prevLeft = wrap.scrollLeft;
        var prevTop = wrap.scrollTop;
        if (canScrollX && Math.abs(dx) > 0.01) wrap.scrollLeft += dx;
        if (canScrollY && Math.abs(dy) > 0.01) wrap.scrollTop += dy;
        if (wrap.scrollLeft !== prevLeft || wrap.scrollTop !== prevTop) {
            this.stopTimelineAutoScrollAnimation();
            e.preventDefault();
            this.timelineDirty = true;
        }
    };

    EE.prototype.onExecutionLogWheel = function(e) {
        if (!this.execLogView) return;
        var box = this.execLogView;
        var wheel = eeWheelPixelDelta(e, box.clientHeight || 100);
        var dx = wheel.dx;
        var dy = wheel.dy;
        var canScrollX = (box.scrollWidth - box.clientWidth) > 1;
        var canScrollY = (box.scrollHeight - box.clientHeight) > 1;
        if (!canScrollX && !canScrollY) return;
        if (canScrollX && !canScrollY && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (e.shiftKey && canScrollX && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        var prevLeft = box.scrollLeft;
        var prevTop = box.scrollTop;
        if (canScrollX && Math.abs(dx) > 0.01) box.scrollLeft += dx;
        if (canScrollY && Math.abs(dy) > 0.01) box.scrollTop += dy;
        if (box.scrollLeft !== prevLeft || box.scrollTop !== prevTop) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    EE.prototype.onCharacterListWheel = function(e) {
        if (!this.charList) return;
        var box = this.charList;
        var wheel = eeWheelPixelDelta(e, box.clientHeight || 100);
        var dx = wheel.dx;
        var dy = wheel.dy;
        var canScrollX = (box.scrollWidth - box.clientWidth) > 1;
        var canScrollY = (box.scrollHeight - box.clientHeight) > 1;
        if (!canScrollX && !canScrollY) return;
        if (canScrollX && !canScrollY && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (e.shiftKey && canScrollX && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        var prevLeft = box.scrollLeft;
        var prevTop = box.scrollTop;
        if (canScrollX && Math.abs(dx) > 0.01) box.scrollLeft += dx;
        if (canScrollY && Math.abs(dy) > 0.01) box.scrollTop += dy;
        if (box.scrollLeft !== prevLeft || box.scrollTop !== prevTop) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    EE.prototype.onEventSettingsExecWheel = function(e) {
        if (!this.eventSettingsExecList) return;
        var box = this.eventSettingsExecList;
        var wheel = eeWheelPixelDelta(e, box.clientHeight || 100);
        var dx = wheel.dx;
        var dy = wheel.dy;
        var canScrollX = (box.scrollWidth - box.clientWidth) > 1;
        var canScrollY = (box.scrollHeight - box.clientHeight) > 1;
        if (!canScrollX && !canScrollY) return;
        if (canScrollX && !canScrollY && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (e.shiftKey && canScrollX && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        var prevLeft = box.scrollLeft;
        var prevTop = box.scrollTop;
        if (canScrollX && Math.abs(dx) > 0.01) box.scrollLeft += dx;
        if (canScrollY && Math.abs(dy) > 0.01) box.scrollTop += dy;
        if (box.scrollLeft !== prevLeft || box.scrollTop !== prevTop) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    EE.prototype.onUiScrollableWheel = function(e) {
        if (!e || !this.root) return false;
        var target = e.target;
        if (!target || !this.root.contains(target)) return false;
        if (this.timeline && this.timeline.contains && this.timeline.contains(target)) return false;
        if (this.timelineWrap && this.timelineWrap.contains && this.timelineWrap.contains(target)) return false;

        var pxStep = 100;
        if (target && target.clientHeight != null && Number(target.clientHeight || 0) > 0) {
            pxStep = Math.floor(Number(target.clientHeight || 100));
        }
        var wheel = eeWheelPixelDelta(e, pxStep);
        var dx = Number(wheel.dx || 0);
        var dy = Number(wheel.dy || 0);
        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001 && e.wheelDelta != null) dy = -Number(e.wheelDelta || 0);
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false;

        var node = target;
        while (node && node !== this.root.parentElement) {
            if (node.nodeType !== 1) {
                node = node.parentElement;
                continue;
            }
            var canMeasure = (
                node.scrollHeight != null && node.clientHeight != null &&
                node.scrollWidth != null && node.clientWidth != null
            );
            if (canMeasure) {
                var cs = null;
                try { cs = window.getComputedStyle ? window.getComputedStyle(node) : null; } catch (_) { cs = null; }
                var oy = cs ? cs.overflowY : '';
                var ox = cs ? cs.overflowX : '';
                var canScrollY = eeOverflowAllowsScroll(oy) && (Number(node.scrollHeight || 0) - Number(node.clientHeight || 0) > 1);
                var canScrollX = eeOverflowAllowsScroll(ox) && (Number(node.scrollWidth || 0) - Number(node.clientWidth || 0) > 1);
                if (canScrollX || canScrollY) {
                    var sx = dx;
                    var sy = dy;
                    if (canScrollX && !canScrollY && Math.abs(sx) < 0.01 && Math.abs(sy) > 0.01) {
                        sx = sy;
                        sy = 0;
                    }
                    if (e.shiftKey && canScrollX && Math.abs(sx) < 0.01 && Math.abs(sy) > 0.01) {
                        sx = sy;
                        sy = 0;
                    }
                    var prevLeft = Number(node.scrollLeft || 0);
                    var prevTop = Number(node.scrollTop || 0);
                    if (canScrollX && Math.abs(sx) > 0.01) node.scrollLeft = prevLeft + sx;
                    if (canScrollY && Math.abs(sy) > 0.01) node.scrollTop = prevTop + sy;
                    if (Number(node.scrollLeft || 0) !== prevLeft || Number(node.scrollTop || 0) !== prevTop) {
                        e.preventDefault();
                        e.stopPropagation();
                        return true;
                    }
                }
            }
            if (node === this.root) break;
            node = node.parentElement;
        }
        return false;
    };

    EE.prototype.attachNumberWheelInput = function(input) {
        if (!input || !input.tagName) return;
        if (String(input.tagName).toUpperCase() !== 'INPUT') return;
        if (String(input.type || '').toLowerCase() !== 'number') return;
        if (input._eeWheelHandler) return;
        var self = this;
        var h = function(ev) { self.onEditorNumberWheel(ev); };
        input._eeWheelHandler = h;
        input.addEventListener('wheel', h, { passive: false });
    };

    EE.prototype.attachSelectWheelInput = function(select) {
        if (!select || !select.tagName) return;
        if (String(select.tagName).toUpperCase() !== 'SELECT') return;
        if (select._eeWheelHandler) return;
        var self = this;
        var h = function(ev) { self.onEditorSelectWheel(ev); };
        select._eeWheelHandler = h;
        select.addEventListener('wheel', h, { passive: false });
    };

    EE.prototype.isEditorDialogOpenForWheel = function() {
        return !!(
            (this.modal && this.modal.classList && this.modal.classList.contains('on')) ||
            (this.sePickerModal && this.sePickerModal.classList && this.sePickerModal.classList.contains('on')) ||
            (this.waitInsertModal && this.waitInsertModal.classList && this.waitInsertModal.classList.contains('on')) ||
            (this.messageBubbleBulkModal && this.messageBubbleBulkModal.classList && this.messageBubbleBulkModal.classList.contains('on')) ||
            (this.memoModal && this.memoModal.classList && this.memoModal.classList.contains('on')) ||
            (this.routeModal && this.routeModal.classList && this.routeModal.classList.contains('on')) ||
            (this.eventSettingsModal && this.eventSettingsModal.classList && this.eventSettingsModal.classList.contains('on')) ||
            (this.battleEventSettingsModal && this.battleEventSettingsModal.classList && this.battleEventSettingsModal.classList.contains('on')) ||
            (this.addModal && this.addModal.classList && this.addModal.classList.contains('on'))
        );
    };

    EE.prototype.onEditorNumberWheel = function(e) {
        var target = e && e.target ? e.target : null;
        if (!target || !target.tagName) return false;
        if (String(target.tagName).toUpperCase() !== 'INPUT') return false;
        if (String(target.type || '').toLowerCase() !== 'number') return false;
        if (!this.root || !this.root.contains(target)) return false;
        if (!this.isEditorDialogOpenForWheel()) return false;
        if (target.disabled || target.readOnly) return false;

        var delta = eeWheelPrimaryDelta(e);
        if (Math.abs(delta) < 0.0001) return false;

        var stepText = String(target.step || '');
        var step = Number(stepText);
        if (!isFinite(step) || step <= 0) step = 1;
        var nowValue = Number(target.value);
        if (!isFinite(nowValue)) nowValue = 0;
        var dir = (delta < 0) ? 1 : -1;
        var next = nowValue + step * dir;

        var min = eeInputAttrNumber(target, 'min');
        var max = eeInputAttrNumber(target, 'max');
        if (isFinite(min) && next < min) next = min;
        if (isFinite(max) && next > max) next = max;

        var digits = eeCountStepDecimals(stepText);
        var pow = Math.pow(10, digits);
        if (digits > 0 && isFinite(pow) && pow > 0) next = Math.round(next * pow) / pow;
        target.value = (digits > 0) ? eeTrimTrailingZeros(next.toFixed(digits)) : String(Math.round(next));

        try {
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.onEditorSelectWheel = function(e) {
        var target = e && e.target ? e.target : null;
        if (!target) return false;
        var select = null;
        var node = target;
        while (node) {
            if (node.tagName && String(node.tagName).toUpperCase() === 'SELECT') {
                select = node;
                break;
            }
            node = node.parentElement;
        }
        if (!select || !select.tagName) return false;
        if (!this.root || !this.root.contains(select)) return false;
        if (!this.isEditorDialogOpenForWheel()) return false;
        if (select.disabled) return false;
        var len = select.options ? select.options.length : 0;
        if (!len) return false;

        var delta = eeWheelPrimaryDelta(e);
        if (Math.abs(delta) < 0.0001) return false;

        var modeScale = eeWheelModeScale(e, select.clientHeight || 100);

        var isList = !!select.multiple || Number(select.size || 0) > 1;
        if (isList) {
            var prevTop = Number(select.scrollTop || 0);
            select.scrollTop = prevTop + delta * modeScale;
            var canScrollY = (Number(select.scrollHeight || 0) - Number(select.clientHeight || 0)) > 1;
            if (canScrollY) {
                e.preventDefault();
                e.stopPropagation();
                return true;
            }
        }

        var dir = (delta > 0) ? 1 : -1;
        var idx = Math.floor(Number(select.selectedIndex || 0));
        if (!isFinite(idx) || idx < 0) idx = 0;
        idx += dir;
        if (idx < 0) idx = 0;
        if (idx >= len) idx = len - 1;
        if (idx === Number(select.selectedIndex || 0) && Number(select.size || 0) <= 1) {
            e.preventDefault();
            e.stopPropagation();
            return true;
        }
        select.selectedIndex = idx;
        try {
            var opt = select.options[idx];
            if (opt && opt.scrollIntoView) opt.scrollIntoView({ block: 'nearest' });
        } catch (_) {}
        try {
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.onUi = function(x, y) {
        if (!this.root) return false;
        if (this.contextEventAdjustState && String(this.contextEventAdjustState.type || '') === 'range') return true;
        if (this.isPointInOpenContextMenu(x, y)) return true;
        if (this.isAnyRegisteredEditorModalOpen && this.isAnyRegisteredEditorModalOpen()) return true;
        var rects = this.uiHitRectsCached();
        for (var i = 0; i < rects.length; i++) {
            if (eePointInRect(x, y, rects[i])) return true;
        }
        return false;
    };

    EE.prototype.selectEvent = function(eid) {
        if (this.isBattleEventMode()) {
            this.cleanupTemporaryCharRows(null);
            if (typeof this.closeBattleEventSettingsEditor === 'function') this.closeBattleEventSettingsEditor();
            var battleTid = Math.max(1, Math.floor(Number(eid || this.currentBattleTroopId() || 0)));
            this.selectBattleTrack(battleTid, Math.max(0, this.selPage));
            return;
        }
        // Drop transient character rows from the currently selected track
        // before switching selection.
        if (typeof this.rememberSelectedTimelineViewState === 'function') this.rememberSelectedTimelineViewState();
        this.cleanupTemporaryCharRows(null);
        var ev = $gameMap.event(eid);
        if (!ev || ev._pageIndex < 0) {
            this.selEid = 0; this.selPage = -1; this.selKey = ''; this.selUid = 0; this.selRouteListIndex = -1;
            this._timelineViewPending = null;
            this.panelSelectedCharId = null;
            this.closeEditor();
            this.closeAddCommandPanel();
            this.closeRouteCommandPanel();
            this.closeWaitInsertDialog();
            this.closeMemoEditor();
            this.closeEventSettingsEditor();
            if (typeof this.closeBattleEventSettingsEditor === 'function') this.closeBattleEventSettingsEditor();
            this.closeCharContextMenu();
            this.closeCameraContextMenu();
            this.closeRouteRangeContextMenu();
            this.refreshEventInfo(); this.timelineDirty = true;
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            return;
        }
        this.selEid = eid;
        this.selPage = ev._pageIndex;
        this.selKey = this.key(eid, ev._pageIndex);
        this.ensureTrack(eid, ev._pageIndex);
        this.queueTimelineViewRestoreForTrack(eid, ev._pageIndex);
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = Number(eid || 0);
        this.closeEditor();
        this.closeAddCommandPanel();
        this.closeRouteCommandPanel();
        this.closeWaitInsertDialog();
        this.closeMemoEditor();
        this.closeEventSettingsEditor();
        if (typeof this.closeBattleEventSettingsEditor === 'function') this.closeBattleEventSettingsEditor();
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        this.refreshEventInfo();
        this.rebuildSchedule({ skipRouteNormalize: true });
        this.timelineDirty = true;
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
    };

    EE.prototype.makeMoveScriptCmd = function(script) {
        return {
            code: 205, indent: 0, parameters: [0, {
                repeat: false, skippable: false, wait: false,
                list: [{ code: Game_Character.ROUTE_SCRIPT, parameters: [String(script || '')] }, { code: 0, parameters: [] }]
            }]
        };
    };

    EE.prototype.addCmd = function(cmd, f) {
        if (!this.needSelTrack()) return;
        f = Math.max(0, Math.floor(f === undefined ? this.frame : f));
        var tr = this.ensureTrack(this.selEid, this.selPage);
        var e = this.entryFromCommand(clone(cmd), this.selEid, this.selPage, f);
        if (!e) return null;
        if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, 0)) {
            this.logDropConflictDetail(tr, e, e.frame, e.rowKey, 0, 'addCmd');
            this.err('E_DROP_CONFLICT', new Error('command overlaps with wait-range'));
            return null;
        }
        this.pushSnap('addCmd');
        tr.commands.push(e);
        SH.sortTrackCommands(tr);
        if (!this.isBattleEventMode() && e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        this.selUid = e.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(e.frame, e.wait);
        this.commitTrackMutation({ earliestChangedFrame: e.frame });
        this.playFrom(this.frame);
        return e;
    };

    EE.prototype.waitIndentForTrackInsertionIndex = function(tr, insertionIndex, fallbackIndent) {
        fallbackIndent = Math.max(0, Math.floor(Number(fallbackIndent || 0)));
        if (!tr || !Array.isArray(tr.commands) || typeof this.computeIfBranchDisplayInfoForTrack !== 'function') {
            return fallbackIndent;
        }
        var info = this.computeIfBranchDisplayInfoForTrack(tr);
        var list = Array.isArray(info && info.list) ? info.list : [];
        var blocks = Array.isArray(info && info.blocks) ? info.blocks : [];
        if (!list.length) return fallbackIndent;
        var pos = Math.max(0, Math.min(list.length, Math.floor(Number(insertionIndex || 0))));
        var bestIndent = fallbackIndent;
        var bestBlockIndent = -1;
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var blockIndent = Math.max(0, Math.floor(Number(b.indent || 0)));
            var ifIndex = Math.max(0, Math.floor(Number(b.ifIndex || 0)));
            var elseIndex = Math.floor(Number(b.elseIndex == null ? -1 : b.elseIndex));
            var endIndex = Math.floor(Number(b.endIndex == null ? list.length : b.endIndex));
            if (endIndex < 0 || endIndex > list.length) endIndex = list.length;
            var inBranch = false;
            var thenStart = Math.max(0, Math.min(list.length, ifIndex + 1));
            var thenStop = (elseIndex >= 0) ? elseIndex : endIndex;
            thenStop = Math.max(thenStart, Math.min(list.length, thenStop));
            if (pos >= thenStart && pos <= thenStop) inBranch = true;
            if (!inBranch && elseIndex >= 0) {
                var elseStart = Math.max(0, Math.min(list.length, elseIndex + 1));
                var elseStop = Math.max(elseStart, Math.min(list.length, endIndex));
                if (pos >= elseStart && pos <= elseStop) inBranch = true;
            }
            if (inBranch && blockIndent >= bestBlockIndent) {
                bestBlockIndent = blockIndent;
                bestIndent = blockIndent + 1;
            }
        }
        if (typeof this.computeChoiceBranchDisplayInfoForTrack === 'function') {
            var choiceInfo = this.computeChoiceBranchDisplayInfoForTrack(tr);
            var choiceBlocks = Array.isArray(choiceInfo && choiceInfo.blocks) ? choiceInfo.blocks : [];
            for (i = 0; i < choiceBlocks.length; i++) {
                var cb = choiceBlocks[i];
                if (!cb || !Array.isArray(cb.branches)) continue;
                var choiceIndent = Math.max(0, Math.floor(Number(cb.indent || 0)));
                for (var bi = 0; bi < cb.branches.length; bi++) {
                    var branch = cb.branches[bi];
                    if (!branch) continue;
                    var branchStart = Math.max(0, Math.min(list.length, Math.floor(Number(branch.startIndex || 0))));
                    var branchStop = Math.floor(Number(branch.endIndex == null ? cb.endIndex : branch.endIndex));
                    if (branchStop < branchStart || branchStop > list.length) branchStop = list.length;
                    if (pos < branchStart || pos > branchStop) continue;
                    if (choiceIndent >= bestBlockIndent) {
                        bestBlockIndent = choiceIndent;
                        bestIndent = choiceIndent + 1;
                    }
                }
            }
        }
        return Math.max(0, Math.floor(Number(bestIndent || 0)));
    };

    EE.prototype.listFromTrack = function(tr) {
        if (typeof this.normalizeChoiceBranchStructuresForTrack === 'function') {
            this.normalizeChoiceBranchStructuresForTrack(tr);
        }
        SH.sortTrackCommands(tr);
        var sourceCommands = SH.commandsInSaveOrder(tr);
        var branchFrameState = SH.createBranchFrameState();
        var out = [], lf = 0, prevMsgExt = null;
        for (var i = 0; i < sourceCommands.length; i++) {
            var e = sourceCommands[i];
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            var cmd = clone(e.command || { code: 0, indent: 0, parameters: [] });
            var cmdIndent = Math.max(0, Math.floor(Number(cmd.indent || 0)));
            var isBranchEnd = cmd.code === 404 || cmd.code === 412;
            lf = SH.branchFrameBeforeBoundary(branchFrameState, cmd.code, cmdIndent, lf);
            var branchEndPadding = isBranchEnd ? Math.max(0, f - lf) : 0;
            if (!isBranchEnd && f > lf) {
                out.push({
                    code: 230,
                    indent: this.waitIndentForTrackInsertionIndex(tr, i, cmdIndent),
                    parameters: [f - lf]
                });
            }
            if (cmd.code === 205) {
                if (!cmd.parameters) cmd.parameters = [0, { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] }];
                cmd.parameters[0] = this.normalizeMoveTarget(e.charId == null ? cmd.parameters[0] : e.charId);
                this.stripRouteEditorMeta(cmd.parameters[1]);
                var mr = cmd.parameters[1];
                var mrl = mr && Array.isArray(mr.list) ? mr.list : [];
                var toSingleLine = this.routeScriptToSingleLineForOutput;
                for (var rr = 0; rr < mrl.length; rr++) {
                    var routeCmd = mrl[rr];
                    if (!routeCmd || Number(routeCmd.code || 0) !== 45) continue;
                    if (!routeCmd.parameters) routeCmd.parameters = [''];
                    var routeScript = String(routeCmd.parameters[0] == null ? '' : routeCmd.parameters[0]);
                    routeCmd.parameters[0] = typeof toSingleLine === 'function'
                        ? toSingleLine.call(this, routeScript)
                        : routeScript.replace(/\r\n?/g, '\n').replace(/\n+/g, '   ');
                }
                out.push(cmd);
                for (var r = 0; r < mrl.length; r++) {
                    var mcmd = mrl[r];
                    if (!mcmd || Number(mcmd.code || 0) === 0) continue;
                    out.push({ code: 505, indent: Number(cmd.indent || 0), parameters: [clone(mcmd)] });
                }
            } else if (cmd.code === 212) {
                var animSpec = this.animationRequestSpecFromEntry({ command: cmd });
                if (!animSpec) {
                    animSpec = { targetId: 0, animationId: 1, addX: 0, addY: 0, scale: 1, wait: false };
                }
                var animScript = this.makeCharacterRequestAnimationScript(
                    animSpec.targetId,
                    animSpec.animationId,
                    animSpec.addX,
                    animSpec.addY,
                    animSpec.scale
                );
                var animOut = { code: 355, indent: Number(cmd.indent || 0), parameters: [animScript] };
                if (cmd._eeMarkerColor != null) animOut._eeMarkerColor = cmd._eeMarkerColor;
                out.push(animOut);
                if (animSpec.wait) out.push({ code: 230, indent: Number(cmd.indent || 0), parameters: [60] });
            } else if (cmd.code === 108) {
                this.memoApplyParsedStateToEntry(e);
                if (e.isMemo) {
                    var memoLine = this.memoCommentLine(e.memoSize, e.memoText);
                    e.commentLines = [memoLine];
                    var memoCmd = { code: 108, indent: Number(cmd.indent || 0), parameters: [memoLine] };
                    if (cmd._eeMarkerColor != null) memoCmd._eeMarkerColor = cmd._eeMarkerColor;
                    out.push(memoCmd);
                } else {
                    var lines = e.commentLines && e.commentLines.length ? e.commentLines : [String((cmd.parameters || [''])[0] || '')];
                    var noteCmd = { code: 108, indent: Number(cmd.indent || 0), parameters: [String(lines[0] || '')] };
                    if (cmd._eeMarkerColor != null) noteCmd._eeMarkerColor = cmd._eeMarkerColor;
                    out.push(noteCmd);
                    for (var j = 1; j < lines.length; j++) {
                        out.push({ code: 408, indent: Number(cmd.indent || 0), parameters: [String(lines[j] || '')] });
                    }
                }
            } else if (cmd.code === 101) {
                var delta = this.messageExtDeltaForOutput(e, prevMsgExt);
                var pre = delta && Array.isArray(delta.commands) ? delta.commands : [];
                for (var pm = 0; pm < pre.length; pm++) out.push(pre[pm]);
                prevMsgExt = delta ? delta.nextState : prevMsgExt;
                var portraitCommand = this.popupPortraitCommandFromEntry(e);
                if (portraitCommand) out.push(portraitCommand);
                out.push(cmd);
                var mls = Array.isArray(e.messageLines) ? e.messageLines : [];
                for (var k = 0; k < mls.length; k++) {
                    out.push({ code: 401, indent: Number(cmd.indent || 0), parameters: [String(mls[k] || '')] });
                }
            } else if (cmd.code === 355) {
                var sls = (e.scriptLines && e.scriptLines.length)
                    ? e.scriptLines
                    : [String((cmd.parameters || [''])[0] || '')];
                cmd.parameters = [String(sls[0] || '')];
                out.push(cmd);
                for (var si = 1; si < sls.length; si++) {
                    out.push({ code: 655, indent: Number(cmd.indent || 0), parameters: [String(sls[si] || '')] });
                }
            } else if (cmd.code === 105) {
                out.push(cmd);
                var tls = Array.isArray(e.scrollLines) ? e.scrollLines : [];
                for (var ti = 0; ti < tls.length; ti++) {
                    out.push({ code: 405, indent: Number(cmd.indent || 0), parameters: [String(tls[ti] || '')] });
                }
            } else {
                out.push(cmd);
            }
            SH.openBranchFrame(branchFrameState, cmd.code, cmdIndent, f);
            if (isBranchEnd) {
                if (branchEndPadding > 0) {
                    out.push({
                        code: 230,
                        indent: cmdIndent,
                        parameters: [branchEndPadding],
                        _eeBranchEndWait: true
                    });
                }
                lf = Math.max(lf, f) + Math.max(0, Math.floor(Number(e.wait || 0)));
            } else {
                lf = Math.max(lf, f + Math.max(0, Math.floor(Number(e.wait || 0))));
            }
        }
        var endFrame = this.normalizeTrackEndFrame(tr);
        if (endFrame > lf) {
            out.push({
                code: 230,
                indent: this.waitIndentForTrackInsertionIndex(tr, sourceCommands.length, 0),
                parameters: [endFrame - lf]
            });
            lf = endFrame;
        }
        out.push({ code: 0, indent: 0, parameters: [] });
        var evData = ($dataMap && Array.isArray($dataMap.events))
            ? $dataMap.events[Math.max(0, Math.floor(Number(tr && tr.eventId || 0)))]
            : null;
        var page = (evData && Array.isArray(evData.pages))
            ? evData.pages[Math.max(0, Math.floor(Number(tr && tr.pageIndex || 0)))]
            : null;
        if (page && typeof this.eventSettingsApplyScriptConditionToEventList === 'function') {
            var cond = (page.conditions && typeof page.conditions === 'object') ? page.conditions : {};
            var scriptValid = !!cond.scriptValid;
            var scriptText = this.eventSettingsNormalizeScriptConditionText(cond.scriptText || '');
            if (!scriptValid && !scriptText && typeof this.eventSettingsScriptConditionFromEventList === 'function') {
                var legacyScript = this.eventSettingsScriptConditionFromEventList(page.list);
                if (legacyScript != null) {
                    scriptValid = true;
                    scriptText = this.eventSettingsNormalizeScriptConditionText(legacyScript);
                }
            }
            var outPage = { list: out, conditions: cond };
            this.eventSettingsApplyScriptConditionToEventList(outPage, scriptValid, scriptText);
            out = Array.isArray(outPage.list) ? outPage.list : [];
        }
        return out;
    };

    var _eeBaseRebuildSchedule = EE.prototype.rebuildSchedule;
    EE.prototype.rebuildSchedule = function(options) {
        options = options || {};
        var skipRouteNormalize = !!options.skipRouteNormalize;
        if (this._eeRebuildScheduleGuard) {
            _eeBaseRebuildSchedule.call(this, options);
            return;
        }
        this._eeRebuildScheduleGuard = true;
        try {
            // 1) Build latest schedule from current model so simTo() can see edits.
            _eeBaseRebuildSchedule.call(this, options);

            if (skipRouteNormalize) return;

            // 2) Auto-adjust only dirty/selected tracks whose command data changed.
            var normalizedAny = false;
            var normalizedKeys = [];
            if (!this.play && this.model && this.model.tracks) {
                if (!this._routeWaitNormalizeSigByTrack) this._routeWaitNormalizeSigByTrack = {};
                var candidateMap = Object.create(null);
                var requestedKeys = Array.isArray(options.changedTrackKeys) ? options.changedTrackKeys : [];
                for (var rk = 0; rk < requestedKeys.length; rk++) candidateMap[String(requestedKeys[rk] || '')] = true;
                var dirtyKeys = Object.keys(this.dirty || {});
                for (var dk = 0; dk < dirtyKeys.length; dk++) candidateMap[String(dirtyKeys[dk] || '')] = true;
                if (this.selKey) candidateMap[String(this.selKey)] = true;
                var ks = Object.keys(candidateMap);
                for (var i = 0; i < ks.length; i++) {
                    var trackKey = ks[i];
                    var tr = this.model.tracks[trackKey];
                    if (!tr || !Array.isArray(tr.commands)) continue;
                    if (!this.trackHasAutoWaitRouteCommands(tr)) {
                        delete this._routeWaitNormalizeSigByTrack[trackKey];
                        continue;
                    }
                    var revision = this._trackRevisionByKey &&
                        Object.prototype.hasOwnProperty.call(this._trackRevisionByKey, trackKey)
                        ? Math.floor(Number(this._trackRevisionByKey[trackKey] || 0))
                        : null;
                    var beforeSig = revision == null ? '' : ('rev:' + String(revision));
                    if (revision == null) {
                        try { beforeSig = JSON.stringify(tr.commands); } catch (_) { beforeSig = String(Date.now()); }
                    }
                    if (this._routeWaitNormalizeSigByTrack[trackKey] === beforeSig) continue;
                    if (this.normalizeTrackRouteTileGotoWaitMeta(tr)) {
                        normalizedAny = true;
                        normalizedKeys.push(trackKey);
                    }
                    this._routeWaitNormalizeSigByTrack[trackKey] = beforeSig;
                }
            }

            // 3) Rebuild once more to apply updated wait lengths to schedule/hit ranges.
            if (normalizedAny) {
                _eeBaseRebuildSchedule.call(this, {
                    changedTrackKeys: normalizedKeys,
                    earliestChangedFrame: options.earliestChangedFrame
                });
            }
        } finally {
            this._eeRebuildScheduleGuard = false;
        }
    };

    var _eeBaseSave = EE.prototype.save;
    EE.prototype.save = function(backupOnly) {
        var saved = _eeBaseSave.call(this, backupOnly);
        if (backupOnly || !saved) return saved;
        this.persistSelectedTimelineViewStateToDisk();
        if (!this.hasUnsavedChanges() && typeof this.clearRecoverySnapshot === 'function' &&
            (this._lastSaveWroteData || this._recoverySnapshotDecision !== 'declined')) {
            if (this.clearRecoverySnapshot()) this._recoverySnapshotDecision = '';
        }
        return saved;
    };

    // Extend snapshot/restore for timeline-only UI state so undo/redo remains stable.
    var _eeBaseSnap = EE.prototype.snap;
    EE.prototype.snap = function(label) {
        var s = _eeBaseSnap.call(this, label);
        s.panelSelectedCharId = (this.panelSelectedCharId == null) ? null : Number(this.panelSelectedCharId);
        if (this.rangeSelection && typeof this.rangeSelection === 'object') {
            s.rangeSelection = {
                kind: String(this.rangeSelection.kind || 'none'),
                items: this.normalizeRangeSelectionItems(Array.isArray(this.rangeSelection.items) ? this.rangeSelection.items : []),
                frameStart: Math.max(0, Math.floor(Number(this.rangeSelection.frameStart || 0))),
                frameEnd: Math.max(0, Math.floor(Number(this.rangeSelection.frameEnd || 0))),
                rects: Array.isArray(this.rangeSelection.rects) ? clone(this.rangeSelection.rects) : [],
                nonContiguous: !!this.rangeSelection.nonContiguous
            };
        } else {
            s.rangeSelection = null;
        }
        s.timelineSelectionAnchor = this.timelineSelectionAnchor
            ? clone(this.timelineSelectionAnchor)
            : null;
        return s;
    };

    var _eeBaseLoadSnap = EE.prototype.loadSnap;
    EE.prototype.loadSnap = function(s) {
        _eeBaseLoadSnap.call(this, s);
        if (this.dragMode === 'tile' || this.tileMoveState) this.cancelTileMoveMode(true);
        if (this.panState) this.endSpacePanDrag();
        this.dragState = null;
        this.rangeSelectDrag = null;
        this.rangeMoveDrag = null;
        this.closeEditor();
        this.closeAddCommandPanel();
        this.closeRouteCommandPanel();
        this.closeWaitInsertDialog();
        this.closeMemoEditor();
        this.closeEventSettingsEditor();
        if (typeof this.closeBattleEventSettingsEditor === 'function') this.closeBattleEventSettingsEditor();
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        this.setHoverNode(null);
        this.hoverFrame = -1;
        this.hoverRangeUid = 0;
        this.hoverRangePart = '';
        this.hoverEndMarker = false;
        this.showTipAt(0, 0, '');
        var rs = s && s.rangeSelection ? s.rangeSelection : null;
        if (rs && typeof rs === 'object') {
            var kind = String(rs.kind || 'none');
            if (kind !== 'memory' && kind !== 'rect' && kind !== 'items') kind = 'none';
            var items = this.normalizeRangeSelectionItems(Array.isArray(rs.items) ? rs.items : []);
            var map = Object.create(null);
            for (var i = 0; i < items.length; i++) map[this.rangeSelectionItemKey(items[i])] = true;
            var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
            var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
            this.rangeSelection = {
                kind: (kind !== 'none' && (items.length || kind === 'memory')) ? kind : 'none',
                items: items,
                itemMap: map,
                frameStart: fs,
                frameEnd: fe,
                rects: Array.isArray(rs.rects) ? clone(rs.rects) : [],
                nonContiguous: !!rs.nonContiguous
            };
        } else {
            this.rangeSelection = {
                kind: 'none',
                items: [],
                itemMap: Object.create(null),
                frameStart: 0,
                frameEnd: 0,
                rects: [],
                nonContiguous: false
            };
        }
        this.timelineSelectionAnchor = s && s.timelineSelectionAnchor
            ? clone(s.timelineSelectionAnchor)
            : null;
        this.panelSelectedCharId = (s && s.panelSelectedCharId != null)
            ? Number(s.panelSelectedCharId)
            : (this.selEid > 0 ? Number(this.selEid) : null);
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
    };
    SH.registerModule('input', ['canvas'], [
        'rebuildSchedule',
        'save',
        'snap',
        'loadSnap'
    ]);
})();
