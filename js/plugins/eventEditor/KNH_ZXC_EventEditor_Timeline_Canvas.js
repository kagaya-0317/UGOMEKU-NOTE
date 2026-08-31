//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Canvas
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline canvas renderer v0.3.0
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
    SH.beginModule('canvas');

    //-------------------------------------------------------------------------
    // Canvas primitives and final timeline rendering
    //-------------------------------------------------------------------------

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
            if (!this.isMainLaneDisplayEntry(e)) continue;
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
        } else if (entry.command && Number(entry.command.code || 0) === 205) {
            var charLane = this._charLaneByUid && this._charLaneByUid.hasOwnProperty(entry.uid) ? this._charLaneByUid[entry.uid] : 0;
            y = met.top + this.charLaneTop + charLane * this.charLaneGap;
        }
        return {
            x: this.frameToX(Math.max(0, Math.floor(Number(entry.frame || 0)))),
            y: Math.floor(Number(y || 0))
        };
    };

    EE.prototype.mainProxyNodePointForEntry = function(entry, rowMap, rmets) {
        if (!entry || !rowMap || !rmets || rowMap.main == null) return null;
        var met = rmets[rowMap.main] || { top: this.rulerH, height: this.rowH };
        var lane = this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(entry.uid)
            ? this._mainLaneByUid[entry.uid]
            : 0;
        return {
            x: this.frameToX(Math.max(0, Math.floor(Number(entry.frame || 0)))),
            y: Math.floor(Number(met.top || this.rulerH) + this.mainLaneTop + lane * this.mainLaneGap)
        };
    };

    EE.prototype.drawMainMoveRouteProxy = function(ctx, entry, rowMap, rmets, hideCircles, pulseNow) {
        if (!ctx || !entry || !entry.command || Number(entry.command.code || 0) !== 205) return false;
        var pt = this.mainProxyNodePointForEntry(entry, rowMap, rmets);
        if (!pt) return false;
        var route = entry.command.parameters && entry.command.parameters[1];
        var waitOn = !!(route && route.wait);
        var color = waitOn ? 'rgba(194,146,104,.98)' : 'rgba(176,128,90,.98)';
        var span = Math.max(1, Math.floor(Number(this.routeExecutionSpanFramesForEntry(entry) || 1)));
        if (waitOn && span > 1) {
            var endX = this.frameToX(Math.max(0, Math.floor(Number(entry.frame || 0))) + span);
            this.drawTimelineWaitStem(ctx, pt.x, endX, pt.y, 'rgba(148,102,68,.58)', 4);
            this.hitBars.push({
                uid: entry.uid,
                x1: Math.min(pt.x, endX),
                x2: Math.max(pt.x, endX),
                y: pt.y,
                frame: entry.frame,
                rowKey: 'main',
                mainRouteProxy: true
            });
        }
        if (hideCircles) return false;
        ctx.strokeStyle = 'rgba(40,24,12,.96)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.scaleTimelineCircleRadius(4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.scaleTimelineCircleRadius(4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        var pulsed = this.drawExecutionPulse(ctx, entry.uid, -1, pt.x, pt.y, 4, pulseNow);
        var selected = (entry.uid === this.selUid && this.nodeRouteIndex(this.selRouteListIndex) < 0) ||
            this.isEntryInRangeSelection(entry.uid);
        var hovered = this.isNodeHovered(entry.uid, -1);
        if (selected || hovered) {
            ctx.strokeStyle = selected ? 'rgba(214,166,124,.98)' : 'rgba(234,202,174,.95)';
            ctx.lineWidth = selected ? 2 : 1;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, this.scaleTimelineCircleRadius(selected ? 7 : 6), 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
        this.hitNodes.push({
            uid: entry.uid,
            x: pt.x,
            y: pt.y,
            r: 6,
            frame: entry.frame,
            rowKey: 'main',
            mainRouteProxy: true,
            routeListIndex: -1
        });
        return pulsed;
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
            if (Math.floor(Number(br.choiceIndex == null ? -1 : br.choiceIndex)) !== Math.floor(Number(selected || 0))) continue;
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
            var choiceIndex = Math.floor(Number(b.choiceIndex == null ? -1 : b.choiceIndex));
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
        var pt = (entry.command && Number(entry.command.code || 0) === 205)
            ? this.mainProxyNodePointForEntry(entry, rowMap, rmets)
            : this.commandNodePointForEntry(entry, rowMap, rmets);
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

    EE.prototype.drawSelectedBranchModeButtons = function(ctx, rowMap, rmets) {
        if (!ctx) return;
        if (!this.selUid || this.nodeRouteIndex(this.selRouteListIndex) >= 0) return;
        var entry = this.findEntryInSelectedTrack(this.selUid);
        if (!entry || !entry.command) return;
        var commandCode = Math.floor(Number(entry.command.code || 0));
        if (commandCode !== 111 && commandCode !== 102) return;
        if (!this.isTimelineEntryVisibleByBranchMode(entry, this.selectedTrack())) {
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
                { forceVisible: Math.max(0, Math.floor(Number(entry.frame || 0))) === 0 }
            );
            if (nodeDecision && nodeDecision.hide) return;
        }
        var isChoice = commandCode === 102;
        var mode = isChoice ? this.getChoiceBranchViewModeForEntry(entry) : this.getIfBranchViewModeForEntry(entry);
        var defs = [{ mode: 'auto', label: 'auto' }];
        if (isChoice) {
            var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
            var choices = Array.isArray(p[0]) ? p[0].slice(0, 6) : [];
            for (var di = 0; di < choices.length; di++) {
                defs.push({ mode: String(di), label: String(di + 1) });
            }
            if (Math.floor(Number(p[1] == null ? -2 : p[1])) === -2) {
                defs.push({ mode: 'cancel', label: 'cancel' });
            }
        } else {
            defs.push({ mode: 'then', label: 'then' });
            defs.push({ mode: 'else', label: 'else' });
        }
        ctx.save();
        var scale = 1.4;
        ctx.font = Math.max(9, Math.round(9 * scale)) + 'px sans-serif';
        var h = Math.max(13, Math.round(13 * scale));
        var gap = Math.max(2, Math.round(2 * scale));
        var padX = Math.max(4, Math.round(4 * scale));
        var minW = Math.max(18, Math.round(18 * scale));
        var corner = Math.max(3, Math.round(3 * scale));
        var maxW = 0;
        for (var i = 0; i < defs.length; i++) {
            var w = Math.max(minW, Math.ceil(ctx.measureText(String(defs[i].label || '')).width) + padX * 2);
            if (w > maxW) maxW = w;
        }
        var columns = isChoice && defs.length > 4 ? 2 : 1;
        var rows = Math.max(1, Math.ceil(defs.length / columns));
        var totalW = columns * maxW + Math.max(0, columns - 1) * gap;
        var totalH = rows * h + Math.max(0, rows - 1) * gap;
        var x = Math.floor(Number(pt.x || 0) - Math.round(10 * scale) - totalW);
        var y = Math.floor(Number(pt.y || 0) - totalH * 0.5);
        // Keep buttons on the left side of the branch node even at frame 0.
        x = Math.max(2, x);
        y = Math.max(this.rulerH + 1, Math.min(Math.max(this.rulerH + 1, this.th - totalH - 2), y));
        for (i = 0; i < defs.length; i++) {
            var d = defs[i];
            var w2 = maxW;
            var selected = (mode === d.mode);
            var col = Math.floor(i / rows);
            var row = i % rows;
            var bx = x + col * (maxW + gap);
            var by = y + row * (h + gap);
            ctx.fillStyle = selected
                ? (isChoice ? 'rgba(205,64,184,.97)' : 'rgba(54,132,225,.97)')
                : 'rgba(54,62,72,.82)';
            this.fillRoundedRect(ctx, bx, by, w2, h, corner);
            ctx.strokeStyle = selected
                ? (isChoice ? 'rgba(255,214,246,.95)' : 'rgba(202,230,255,.95)')
                : 'rgba(144,158,176,.70)';
            ctx.lineWidth = 1;
            this.strokeRoundedRect(ctx, bx + 0.5, by + 0.5, Math.max(1, w2 - 1), Math.max(1, h - 1), corner);
            ctx.fillStyle = selected ? 'rgba(233,244,255,.98)' : 'rgba(232,238,248,.92)';
            ctx.fillText(String(d.label || ''), bx + padX, by + Math.floor(h * 0.72));
            this.hitIfBranchButtons.push({
                uid: Math.floor(Number(entry.uid || 0)),
                mode: String(d.mode || 'then'),
                commandCode: commandCode,
                x1: bx,
                y1: by,
                x2: bx + w2,
                y2: by + h
            });
        }
        ctx.restore();
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

        ctx.restore();
    };

    EE.prototype.drawTimelineDynamicOverlay = function() {
        if (!this.timelineOverlay) return;
        var ctx = this.timelineOverlay.getContext('2d');
        if (!ctx) return;
        var width = Math.max(1, Math.floor(Number(this.tw || this.timelineOverlay.width || 1)));
        var height = Math.max(1, Math.floor(Number(this.th || this.timelineOverlay.height || 1)));
        ctx.clearRect(0, 0, width, height);
        var hoverFrame = Math.floor(Number(this.hoverFrame));
        if (isFinite(hoverFrame) && hoverFrame >= 0) {
            var hoverX = this.frameToX(hoverFrame) + 0.5;
            ctx.strokeStyle = 'rgba(210,230,255,.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hoverX, this.rulerH);
            ctx.lineTo(hoverX, height);
            ctx.stroke();
            var rulerY = this.timelineRulerTopY(height);
            var fixedLabelX = this.timelineWrap ? Math.max(0, Math.floor(Number(this.timelineWrap.scrollLeft || 0))) : 0;
            var labelRight = fixedLabelX + this.labelW;
            var hoverText = String(hoverFrame) + 'f';
            ctx.font = 'bold 10px sans-serif';
            var textWidth = Math.ceil(ctx.measureText(hoverText).width) + 8;
            var textX = Math.max(labelRight + 1, Math.min(Math.floor(hoverX - textWidth / 2), width - textWidth - 1));
            ctx.fillStyle = 'rgba(0,0,0,.78)';
            ctx.fillRect(textX, rulerY + 2, textWidth, 12);
            ctx.strokeStyle = 'rgba(210,230,255,.85)';
            ctx.strokeRect(textX + .5, rulerY + 2.5, textWidth - 1, 11);
            ctx.fillStyle = 'rgba(240,248,255,.98)';
            ctx.fillText(hoverText, textX + 4, rulerY + 11);
        }
        var cursorX = this.frameToX(this.frame) + 0.5;
        ctx.strokeStyle = 'rgba(100,255,175,.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, height);
        ctx.stroke();
        this.timelineCursorDirty = false;
        if (this.tInfo) {
            var oldText = String(this.tInfo.textContent || '');
            var nextText = /^フレーム:\s*[^|]*/.test(oldText)
                ? oldText.replace(/^フレーム:\s*[^|]*/, 'フレーム: ' + String(this.frame) + ' ')
                : ('フレーム: ' + String(this.frame));
            if (this.tInfo.textContent !== nextText) this.tInfo.textContent = nextText;
        }
    };

    EE.prototype.drawTimeline = function() {
        if (!this.timelineDirty) {
            if (this.timelineCursorDirty) this.drawTimelineDynamicOverlay();
            return;
        }
        this.timelineDirty = false;
        try {
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

        var tr = this.selectedTrack();
        this.beginTrackReadCache(tr);
        var rows = this._rows || [{ key: 'main', label: 'Main' }];
        var rmets = this._rowMetrics || [];
        var hideCircles = !!this.hideTimelineCircles;
        var hideHandles = !!this.hideRouteHandles;
        var selectedRowKey = (this.panelSelectedCharId == null)
            ? 'main'
            : ('char:' + this.normalizeMoveTarget(Number(this.panelSelectedCharId || 0)));
        var hiddenByIf = tr ? this.computeIfBranchHiddenUidMapForTrack(tr) : Object.create(null);
        this._timelineBranchHiddenTrack = tr;
        this._timelineBranchHiddenUidMap = hiddenByIf;
        var laneInfo = this.buildMainLaneMap(tr, hiddenByIf);
        this._mainLaneByUid = laneInfo.laneByUid || {};
        this._mainStackMax = laneInfo.maxStack || this._mainStackMax || 1;
        var charLaneInfo = this.buildCharRouteLaneMap(tr, hiddenByIf);
        this._charLaneByUid = charLaneInfo.laneByUid || {};
        this._charStackByRow = charLaneInfo.stackByRow || {};
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
                var ee = ef + this.timelineEntryVisualSpanFrames(e);
                if (ee < commandCullStart || ef > commandCullEnd) continue;
                var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
                var ri = rowMap[rk];
                if (ri == null) continue;
                var met = rmets[ri] || { top: this.rulerH + ri * this.rowH, height: this.rowH, center: this.rulerH + ri * this.rowH + Math.floor(this.rowH / 2) };
                var cy = met.center;
                if (rk === 'main') {
                    var lane = this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(e.uid) ? this._mainLaneByUid[e.uid] : 0;
                    cy = met.top + this.mainLaneTop + lane * this.mainLaneGap;
                } else if (e.command && Number(e.command.code || 0) === 205) {
                    var charLane = this._charLaneByUid && this._charLaneByUid.hasOwnProperty(e.uid) ? this._charLaneByUid[e.uid] : 0;
                    cy = met.top + this.charLaneTop + charLane * this.charLaneGap;
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
                    if (this.drawMainMoveRouteProxy(c, e, rowMap, rmets, hideCircles, pulseNow)) pulseActive = true;
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
                    if (de && de.command && Number(de.command.code || 0) === 205) {
                        var dragLane = this._charLaneByUid && this._charLaneByUid.hasOwnProperty(de.uid) ? this._charLaneByUid[de.uid] : 0;
                        dcy = dmet.top + this.charLaneTop + dragLane * this.charLaneGap;
                    }
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
                    var dragMet = rmets[di] || { top: this.rulerH + di * this.rowH, height: this.rowH, center: this.rulerH + di * this.rowH + Math.floor(this.rowH / 2) };
                    var dy = dragMet.center;
                    if (ds.mainRouteProxy) {
                        var dragEntry = this.findEntryInSelectedTrack(ds.uid);
                        var proxyPt = this.mainProxyNodePointForEntry(dragEntry, rowMap, rmets);
                        if (proxyPt) dy = proxyPt.y;
                    }
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
        this.drawSelectedBranchModeButtons(c, rowMap, rmets);
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
                if (dsInfo) dragInfoText = ' | 範囲選択: ' + dsInfo.frameCount + 'F';
            }
            this.tInfo.textContent = 'フレーム: ' + this.frame + ' | 選択: ' + sid + ' | イベント: ' + (this.selEid || '-') + ' | 行数: ' + rows.length + dragInfoText;
        }
        this.refreshMemoScrollLane(maxF);
        this.timelineCursorDirty = true;
        this.drawTimelineDynamicOverlay();
        this._timelineBranchHiddenTrack = null;
        this._timelineBranchHiddenUidMap = null;
        } catch (e) {
            this.timelineDirty = false;
            if (typeof this.err === 'function') this.err('E_TIMELINE_DRAW', e);
        } finally {
            this._timelineCircleOverlayRule = null;
            this._timelineIfBranchButtonOverlayRule = null;
            this._timelineIfBranchOverlayRule = null;
            this._timelineBranchHiddenTrack = null;
            this._timelineBranchHiddenUidMap = null;
            this.endTrackReadCache();
        }
    };

    EE.prototype.niceFrameStep = function(target) {
        target = Math.max(1, Number(target || 1));
        var step = 30;
        while (step < target) step *= 2;
        return step;
    };

    SH.registerModule('canvas', ['edit'], []);
})();
