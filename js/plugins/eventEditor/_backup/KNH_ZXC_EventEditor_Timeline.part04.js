    EE.prototype.rangeSelectionItemKey = function(item) {
        if (!item) return '';
        if (String(item.kind || '') === 'routeCmd') {
            return 'r:' + Math.floor(Number(item.uid || 0)) + ':' + Math.floor(Number(item.routeListIndex || -1));
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
            var key = Math.floor(Number(b.listIndex || -1));
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
            routeByUid[ri.uid][Math.floor(Number(ri.routeListIndex || -1))] = true;
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
            selMap[Math.floor(Number(drag.routeItems[i].routeListIndex || -1))] = true;
        }
        var next = [];
        for (i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.floor(Number(b.start || 0));
            if (selMap[Math.floor(Number(b.listIndex || -1))]) st += frameDelta;
            var nb = {
                start: st,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Math.floor(Number(b.listIndex || -1)),
                command: clone(b.command || { code: 0, parameters: [] }),
                _sel: !!selMap[Math.floor(Number(b.listIndex || -1))]
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
            if (a._sel !== b._sel) return a._sel ? -1 : 1;
            return a.listIndex - b.listIndex;
        });
        for (i = 1; i < next.length; i++) {
            var prev = next[i - 1];
            var cur = next[i];
            if (cur.start < prev.start + prev.dur) {
                out.blocks = next;
                out.reason = 'overlap';
                return out;
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
            this.timelineDirty = true;
            return true;
        }
        if (drag.kind === 'routeCmd') {
            var rp = this.buildRangeMoveRoutePreview(drag, drag.frameDelta);
            drag.valid = !!rp.valid;
            drag.invalidReason = String(rp.reason || '');
            drag.previewRouteBlocks = rp.blocks || null;
            drag.previewRouteSelection = rp.selectedListIndexes || [];
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

    EE.prototype.applyRangeMoveDrag = function() {
        var drag = this.rangeMoveDrag;
        this.rangeMoveDrag = null;
        if (!drag || !drag.moved) return false;
        if (!drag.valid) {
            this.msg('Drop rejected (range move collision)');
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
                listIndex: Math.floor(Number(b.listIndex || -1)),
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

    EE.prototype.showTipAt = function(screenX, screenY, text) {
        if (!this.tip) return;
        if (!text) {
            this.tip.style.display = 'none';
            return;
        }
        this.tip.style.display = 'block';
        this.tip.style.left = Math.floor(screenX + 12) + 'px';
        this.tip.style.top = Math.floor(screenY + 12) + 'px';
        if (Array.isArray(text)) {
            var html = '';
            for (var i = 0; i < text.length; i++) {
                var it = text[i];
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
                    html += '<span style="color:' + col + ';">' + this.escapeHtml(it.text) + '</span>';
                } else {
                    html += this.escapeHtml(String(it));
                }
                if (i !== text.length - 1) html += '<br>';
            }
            this.tip.innerHTML = html;
        } else {
            this.tip.textContent = String(text);
        }
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
            var pages = [1, 2, 3];
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

    EE.prototype.commandTooltipItemsAtFrame = function(frame, highlightUid, opt) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands) return [];
        opt = opt || {};
        var rows = this._rows || [];
        var rm = {};
        for (var i = 0; i < rows.length; i++) rm[rows[i].key] = i;
        var ls = tr.commands.filter(function(e) {
            return !e.isComment && Number(e.frame || 0) === Number(frame || 0);
        });
        ls.sort(function(a, b) {
            var ra = rm[a.rowKey || 'main']; if (ra == null) ra = 999;
            var rb = rm[b.rowKey || 'main']; if (rb == null) rb = 999;
            if (ra !== rb) return ra - rb;
            return a.uid - b.uid;
        });
        var out = [];
        for (i = 0; i < ls.length; i++) {
            var e = ls[i];
            if (opt.excludeMoveRoute205 && e.command && Number(e.command.code || 0) === 205) continue;
            var nm = this.commandNameJa(this.mainCommandDisplayCodeForEntry(e));
            if (e.command && e.command.code === 205) nm += ' [' + this.rowLabelForCharId(this.normalizeMoveTarget(e.charId)) + ']';
            var dim = !!highlightUid && Number(e.uid) !== Number(highlightUid);
            out.push({ text: '・' + nm, dim: dim });
            var detail = this.commandTooltipDetailText(e);
            if (detail) out.push({ text: '  ' + detail, dim: dim, detail: true });
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
            var cols = [cat.left, cat.mid, cat.right];
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
        if (code === 45) {
            var dcode = this.routeDisplayCodeForCommand(routeCmd);
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
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            var rc = it && it.command ? it.command : null;
            var rcode = Number((it && it.displayCode != null) ? it.displayCode : ((rc && rc.code) || 0));
            if (!rc || rcode === 0 || rcode === 15) continue;
            out.push({ text: '・+' + Number(it.offset || 0) + 'f ' + this.routeCommandNameJa(rcode), dim: false });
            var detail = '';
            if (rcode === 4500) detail = this.routeTileGotoTooltipText(entry, it.listIndex, it.span);
            else detail = this.routeCommandTooltipDetailText(rc);
            if (detail) out.push({ text: '  ' + detail, dim: false, detail: true });
        }
        if (!out.length) out.push({ text: '・(移動ルート内コマンドなし)', dim: false });
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
        } else if (hit.routeCmdCode != null || (hit.routeListIndex != null && Number(hit.routeListIndex || -1) >= 0)) {
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
            var out = [{ text: '・' + this.routeCommandNameJa(hit.routeCmdCode), dim: false }];
            var routeCmd = this.routeCommandFromHit(hit);
            var detail = '';
            if (Number(hit.routeCmdCode || 0) === 4500) {
                var e2 = this.findEntryInSelectedTrack(hit.uid);
                detail = this.routeTileGotoTooltipText(e2, hit.routeListIndex, null);
            } else {
                detail = this.routeCommandTooltipDetailText(routeCmd);
            }
            if (detail) out.push({ text: '  ' + detail, dim: false, detail: true });
            if (routeOwnerLabel) out.unshift({ text: routeOwnerLabel, dim: false });
            return out;
        }
        var e = this.findEntryInSelectedTrack(hit.uid);
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
        var offsetY = (size === 'L') ? -60 : -40;
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
        var sig = String(Math.floor(cr.left)) + '|' + String(Math.floor(cr.top)) + '|' +
            String(Math.floor(Number(wrap.scrollLeft || 0))) + '|' + String(Math.floor(Number(wrap.scrollTop || 0))) + '|';
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
            // cr already reflects wrap scroll; no extra scroll offset is needed here.
            var sx = cr.left + dotX;
            var sy = cr.top + dotY;
            var offsetY = (sz === 'L') ? -60 : -40;
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
                var ratio = Math.max(0, Math.min(1, Number(m.frame || 0) / maxFrame));
                dot.style.left = Math.floor(ratio * (width - 2) + 1) + 'px';
                dot.style.top = '4px';
                dot.addEventListener('mouseenter', function(ev) {
                    self.showTipAt(ev.clientX || (left + 8), ev.clientY || (top - 8), m.text || '');
                });
                dot.addEventListener('mousemove', function(ev) {
                    self.showTipAt(ev.clientX || (left + 8), ev.clientY || (top - 8), m.text || '');
                });
                dot.addEventListener('mouseleave', function() {
                    self.showTipAt(0, 0, '');
                });
                dot.addEventListener('mousedown', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                dot.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    // Reuse existing "select + smooth reveal" behavior.
                    self.focusExecutionLogTarget(Number(m.uid || 0), -1);
                    self.showTipAt(0, 0, '');
                });
                lane.appendChild(dot);
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

    EE.prototype.buildMainLaneMap = function(tr) {
        var laneByUid = {};
        var maxStack = 1;
        if (!tr || !tr.commands) return { laneByUid: laneByUid, maxStack: maxStack };
        var byFrame = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
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

    EE.prototype.fillCircleWithBlackOutline = function(ctx, x, y, radius) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(Number(x || 0), Number(y || 0), Math.max(0, Number(radius || 0)), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.98)';
        ctx.lineWidth = 1;
        ctx.stroke();
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

    EE.prototype.drawFixedLabelColumn = function(ctx, rows, rmets, selectedCharRowKey, scrollLeft, totalHeight) {
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
            var isSelCharRow = (rows[i] && rows[i].type === 'char' && rows[i].key === selectedCharRowKey);
            if (isSelCharRow) {
                ctx.fillStyle = 'rgba(255,170,90,.20)';
                ctx.fillRect(fx, y, this.labelW, mt.height);
                ctx.strokeStyle = 'rgba(255,198,132,.52)';
                ctx.strokeRect(fx + .5, y + .5, this.labelW - 1, Math.max(1, mt.height - 1));
            }
            ctx.strokeStyle = 'rgba(255,255,255,.14)';
            ctx.beginPath();
            ctx.moveTo(fx, y + .5);
            ctx.lineTo(fx + this.labelW, y + .5);
            ctx.stroke();
            ctx.font = isSelCharRow ? 'bold 11px sans-serif' : '11px sans-serif';
            ctx.fillStyle = isSelCharRow ? 'rgba(255,232,205,.98)' : 'rgba(220,230,240,.88)';
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
        for (var ms = 0; ms <= maxF; ms += step) {
            for (var md = 1; md < minorDiv; md++) {
                var mf = ms + step * (md / minorDiv);
                if (mf > maxF) break;
                var mx = this.frameToX(mf) + .5;
                if (mx < labelRight - 1 || mx > totalWidth + 1) continue;
                ctx.strokeStyle = 'rgba(255,255,255,.10)';
                ctx.beginPath();
                ctx.moveTo(mx, rulerY + this.rulerH - 5);
                ctx.lineTo(mx, rulerY + this.rulerH);
                ctx.stroke();
            }
        }

        ctx.font = '10px sans-serif';
        for (var f = 0; f <= maxF; f += step) {
            var x = this.frameToX(f) + .5;
            if (x < labelRight - 1 || x > totalWidth + 1) continue;
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
        var minorDiv = 6;
        for (var ms = 0; ms <= maxF; ms += step) {
            for (var md = 1; md < minorDiv; md++) {
                var mf = ms + step * (md / minorDiv);
                if (mf > maxF) break;
                var mx = this.frameToX(mf) + .5;
                c.strokeStyle = 'rgba(255,255,255,.07)';
                c.beginPath();
                c.moveTo(mx, this.rulerH);
                c.lineTo(mx, h);
                c.stroke();
            }
        }
        c.font = '10px sans-serif';
        for (var f = 0; f <= maxF; f += step) {
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
        var selectedCharId = this.currentSelectedCharacterId();
        var selectedCharRowKey = (selectedCharId == null) ? '' : ('char:' + this.normalizeMoveTarget(selectedCharId));
        var laneInfo = this.buildMainLaneMap(tr);
        this._mainLaneByUid = laneInfo.laneByUid || {};
        this._mainStackMax = laneInfo.maxStack || this._mainStackMax || 1;
        var rowMap = {};
        for (var i = 0; i < rows.length; i++) {
            rowMap[rows[i].key] = i;
            var mt = rmets[i] || { top: this.rulerH + i * this.rowH, height: this.rowH };
            var y = mt.top;
            var isSelCharRow = (rows[i] && rows[i].type === 'char' && rows[i].key === selectedCharRowKey);
            if (isSelCharRow) {
                c.fillStyle = 'rgba(255,170,90,.14)';
                c.fillRect(this.labelW, y, w - this.labelW, mt.height);
                c.fillStyle = 'rgba(255,170,90,.20)';
                c.fillRect(0, y, this.labelW, mt.height);
                c.strokeStyle = 'rgba(255,198,132,.52)';
                c.strokeRect(.5, y + .5, this.labelW - 1, Math.max(1, mt.height - 1));
            }
            c.strokeStyle = 'rgba(255,255,255,.14)';
            c.beginPath();
            c.moveTo(0, y + .5);
            c.lineTo(w, y + .5);
            c.stroke();
            c.font = isSelCharRow ? 'bold 11px sans-serif' : '11px sans-serif';
            c.fillStyle = isSelCharRow ? 'rgba(255,232,205,.98)' : 'rgba(220,230,240,.88)';
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
            var shadeY = this.rulerH;
            var shadeH = Math.max(1, lastY - shadeY);
            var shadeW = Math.max(0, w - shadeX);
            if (shadeW > 0 && shadeH > 0) {
                c.save();
                c.beginPath();
                c.rect(shadeX, shadeY, shadeW, shadeH);
                c.clip();
                c.fillStyle = 'rgba(120,120,120,.10)';
                c.fillRect(shadeX, shadeY, shadeW, shadeH);
                c.strokeStyle = 'rgba(190,190,190,.24)';
                c.lineWidth = 1;
                var hatchStep = 10;
                var hatchStart = Math.floor(shadeX - shadeH);
                var hatchEnd = Math.ceil(shadeX + shadeW + shadeH);
                for (var hxi = hatchStart; hxi <= hatchEnd; hxi += hatchStep) {
                    c.beginPath();
                    c.moveTo(hxi, shadeY + shadeH);
                    c.lineTo(hxi + shadeH, shadeY);
                    c.stroke();
                }
                c.restore();
                c.strokeStyle = 'rgba(200,200,200,.44)';
                c.beginPath();
                c.moveTo(shadeX + .5, shadeY);
                c.lineTo(shadeX + .5, shadeY + shadeH);
                c.stroke();
            }
        }

        if (tr && tr.commands) {
            var ranges = this.collectMoveRouteWaitRanges(tr, 0);
            var overlayTop = this.rulerH;
            var overlayBottom = Math.max(overlayTop + 1, lastY);
            var overlayHeight = Math.max(1, overlayBottom - overlayTop);
            for (var wr = 0; wr < ranges.length; wr++) {
                var rg = ranges[wr];
                var sxr = this.frameToX(rg.start);
                var exr = this.frameToX(rg.end);
                var bxr = Math.min(sxr, exr);
                var bwr = Math.max(2, Math.abs(exr - sxr));
                c.fillStyle = 'rgba(255,166,84,.10)';
                c.fillRect(bxr, overlayTop, bwr, overlayHeight);
                c.save();
                c.beginPath();
                c.rect(bxr, overlayTop, bwr, overlayHeight);
                c.clip();
                c.strokeStyle = 'rgba(255,176,96,.30)';
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
                c.strokeStyle = 'rgba(255,176,96,.50)';
                c.beginPath();
                c.moveTo(bxr + 0.5, overlayTop);
                c.lineTo(bxr + 0.5, overlayBottom);
                c.moveTo(bxr + bwr - 0.5, overlayTop);
                c.lineTo(bxr + bwr - 0.5, overlayBottom);
                c.stroke();
            }
        }

        this.hitNodes = [];
        this.hitComments = [];
        this.hitBars = [];
        this.hitOrderButtons = [];
        var memoLabelQueue = [];
        var commentFrontQueue = [];
        var drawnCommentAt = {};
        if (tr && tr.commands) {
            for (i = 0; i < tr.commands.length; i++) {
                var e = tr.commands[i];
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
                var wait = Math.max(0, Math.floor(Number(e.wait || 0)));
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
                        c.fillStyle = 'rgba(80,220,110,.98)';
                        this.fillCircleWithBlackOutline(c, cx, ay, cr);
                        if (this.drawExecutionPulse(c, e.uid, -1, cx, ay, cr, pulseNow)) pulseActive = true;
                        if (e.isMemo && msize !== 'S') memoLabelQueue.push({ x: cx, y: ay, size: msize, text: e.memoText || '' });
                        commentFrontQueue.push({
                            uid: e.uid,
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
                        c.arc(cx, ay, (hsel ? 4 : 3) + cr, 0, Math.PI * 2);
                        c.stroke();
                        c.lineWidth = 1;
                    }
                    continue;
                }
                if (e.command && Number(e.command.code || 0) === 205 && rk.indexOf('char:') === 0) {
                    var route = e.command.parameters && e.command.parameters[1];
                    var routeWaitOn = !!(route && route.wait);
                    var routeBarFillColor = routeWaitOn ? 'rgba(242,144,64,.38)' : 'rgba(255,170,90,.20)';
                    var routeNodeFillColor = routeWaitOn ? 'rgba(246,168,96,.98)' : 'rgba(255,186,118,.98)';
                    var routeHandleBaseColor = routeWaitOn ? 'rgba(246,162,84,1)' : 'rgba(255,180,110,1)';
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
                            c.strokeStyle = 'rgba(36,20,8,.96)';
                            c.lineWidth = 3;
                            this.strokeRoundedRect(c, routeHx + .5, routeHy + .5, Math.max(1, routeHw - 1), Math.max(1, routeHh - 1), 4);
                            c.strokeStyle = 'rgba(255,165,70,.98)';
                            c.lineWidth = 2;
                            this.strokeRoundedRect(c, routeHx + 1.5, routeHy + 1.5, Math.max(1, routeHw - 3), Math.max(1, routeHh - 3), 3);
                        } else {
                            c.strokeStyle = 'rgba(255,220,170,.95)';
                            c.lineWidth = 1;
                            this.strokeRoundedRect(c, routeHx + .5, routeHy + .5, Math.max(1, routeHw - 1), Math.max(1, routeHh - 1), 4);
                        }
                        c.lineWidth = 1;
                    }
                    var hColor = rangeSel ? 'rgba(255,170,88,1)' : (rangeHover ? 'rgba(255,220,170,1)' : routeHandleBaseColor);
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
                        var hs = rangeSel ? 'rgba(255,165,70,.98)' : 'rgba(255,220,170,.95)';
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
                            c.fillStyle = routeNodeFillColor;
                            this.fillCircleWithBlackOutline(c, cx, cy, 4);
                        }
                        var rsel0 = sel;
                        var rhov0 = this.isNodeHovered(e.uid, -1);
                        if (!hideCircles && (rsel0 || rhov0)) {
                            if (rsel0) {
                                c.strokeStyle = 'rgba(36,20,8,.96)';
                                c.lineWidth = 3;
                                c.beginPath();
                                c.arc(cx, cy, 8, 0, Math.PI * 2);
                                c.stroke();
                                c.strokeStyle = 'rgba(255,165,70,.98)';
                                c.lineWidth = 2;
                                c.beginPath();
                                c.arc(cx, cy, 7, 0, Math.PI * 2);
                                c.stroke();
                            } else {
                                c.strokeStyle = 'rgba(255,220,170,.95)';
                                c.lineWidth = 1;
                                c.beginPath();
                                c.arc(cx, cy, 6, 0, Math.PI * 2);
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
                            var rcmd = it && it.command ? it.command : null;
                            var rcode = Number((it && it.displayCode != null) ? it.displayCode : 0);
                            if (rcode <= 0 && rcmd) rcode = this.routeDisplayCodeForCommand(rcmd);
                            var displayCode = rcode;
                            if (displayCode <= 0 || displayCode === 15) continue;
                            hasVisibleRouteCmd = true;
                            var rf = e.frame + Math.max(0, Math.floor(Number(it.offset || 0)));
                            var rcx = this.frameToX(rf);
                            var spanFrames = Math.max(1, Math.floor(Number(it.span || 1)));
                            if (spanFrames > 1) {
                                var rex = this.frameToX(rf + spanFrames);
                                c.strokeStyle = routeNodeFillColor;
                                c.lineWidth = 2;
                                c.beginPath();
                                c.moveTo(rcx, cy);
                                c.lineTo(rex, cy);
                                c.stroke();
                                c.lineWidth = 1;
                            }
                            if (!hideCircles) {
                                c.fillStyle = routeNodeFillColor;
                                this.fillCircleWithBlackOutline(c, rcx, cy, 4);
                                if (this.drawExecutionPulse(c, e.uid, rli, rcx, cy, 4, pulseNow)) pulseActive = true;
                            }
                            var rli = Number(it.listIndex == null ? -1 : it.listIndex);
                            var rsel = (e.uid === this.selUid && this.selRouteListIndex === rli) || this.isRouteCmdInRangeSelection(e.uid, rli);
                            var rhov = this.isNodeHovered(e.uid, rli);
                            if (!hideCircles && (rsel || rhov)) {
                                if (rsel) {
                                    c.strokeStyle = 'rgba(36,20,8,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(rcx, cy, 8, 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(255,165,70,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(rcx, cy, 7, 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(255,220,170,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(rcx, cy, 6, 0, Math.PI * 2);
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
                                c.fillStyle = routeNodeFillColor;
                                this.fillCircleWithBlackOutline(c, cx, cy, 4);
                                if (this.drawExecutionPulse(c, e.uid, -1, cx, cy, 4, pulseNow)) pulseActive = true;
                            }
                            var rsel1 = sel;
                            var rhov1 = this.isNodeHovered(e.uid, -1);
                            if (!hideCircles && (rsel1 || rhov1)) {
                                if (rsel1) {
                                    c.strokeStyle = 'rgba(36,20,8,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(cx, cy, 8, 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(255,165,70,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(cx, cy, 7, 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(255,220,170,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(cx, cy, 6, 0, Math.PI * 2);
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
                if (wait > 1) {
                    var ex = this.frameToX(e.frame + wait);
                    c.strokeStyle = rk === 'main' ? 'rgba(114,205,255,.95)' : 'rgba(255,176,96,.95)';
                    c.lineWidth = 3;
                    c.beginPath();
                    c.moveTo(cx, cy);
                    c.lineTo(ex, cy);
                    c.stroke();
                    c.lineWidth = 1;
                    this.hitBars.push({ uid: e.uid, x1: Math.min(cx, ex), x2: Math.max(cx, ex), y: cy, frame: e.frame, rowKey: rk });
                }
                if (e.command && e.command.code === 101) c.fillStyle = 'rgba(255,100,190,.98)';
                else c.fillStyle = rk === 'main' ? 'rgba(122,210,255,.98)' : 'rgba(255,176,96,.98)';
                if (!hideCircles) this.fillCircleWithBlackOutline(c, cx, cy, 4);
                if (!hideCircles && this.drawExecutionPulse(c, e.uid, -1, cx, cy, 4, pulseNow)) pulseActive = true;
                var gsel = sel;
                var ghov = this.isNodeHovered(e.uid, -1);
                if (!hideCircles && (gsel || ghov)) {
                    c.strokeStyle = gsel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                    c.lineWidth = gsel ? 2 : 1;
                    c.beginPath();
                    c.arc(cx, cy, gsel ? 7 : 6, 0, Math.PI * 2);
                    c.stroke();
                    c.lineWidth = 1;
                }
                if (!hideCircles) this.hitNodes.push({ uid: e.uid, x: cx, y: cy, r: 5, frame: e.frame, rowKey: rk });
            }
        }

        if (tr) {
            var minEndFrame = this.trackComputedEndFrame(tr);
            var baseEndFrame = this.normalizeTrackEndFrame(tr);
            var drawEndFrame = baseEndFrame;
            if (this.dragState && this.dragState.endMarker) {
                var dsEnd = this.dragState;
                var dTarget = (dsEnd.targetFrame == null) ? dsEnd.startFrame : dsEnd.targetFrame;
                drawEndFrame = Math.max(minEndFrame, Math.floor(Number(dTarget || 0)));
            }
            var mainRi = rowMap.main;
            var mainMet = (mainRi != null) ? (rmets[mainRi] || null) : null;
            var endX = this.frameToX(drawEndFrame);
            var endY = mainMet ? (Number(mainMet.top || this.rulerH) + this.mainLaneTop) : (this.rulerH + Math.floor(this.rowH / 2));
            var endR = 5;
            if (!hideCircles) {
                c.fillStyle = 'rgba(170,170,170,.98)';
                this.fillCircleWithBlackOutline(c, endX, endY, endR);
                var endActive = !!(this.dragState && this.dragState.endMarker) || !!this.hoverEndMarker;
                if (endActive) {
                    c.strokeStyle = (this.dragState && this.dragState.endMarker) ? 'rgba(236,236,236,.98)' : 'rgba(210,220,236,.95)';
                    c.lineWidth = (this.dragState && this.dragState.endMarker) ? 2 : 1;
                    c.beginPath();
                    c.arc(endX, endY, 8, 0, Math.PI * 2);
                    c.stroke();
                    c.lineWidth = 1;
                }
                this.hitNodes.push({
                    uid: 0,
                    isEndMarker: true,
                    x: endX,
                    y: endY,
                    r: 6,
                    frame: drawEndFrame,
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
                    var oldWait = Math.max(1, Math.floor(Number(ds.startWait || (de ? de.wait : 1))));
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
                    for (var rbi = 0; rbi < rmd.previewRouteBlocks.length; rbi++) {
                        var rb = rmd.previewRouteBlocks[rbi];
                        if (!rb || !rb._sel) continue;
                        var rfx = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))) + Math.max(0, Math.floor(Number(rb.start || 0))));
                        this.fillCircleWithBlackOutline(c, rfx, rcy, 5);
                        c.beginPath();
                        c.arc(rfx, rcy, 8, 0, Math.PI * 2);
                        c.stroke();
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
                        c.strokeStyle = okCol;
                        c.lineWidth = 3;
                        c.beginPath();
                        c.moveTo(pfx, pcy);
                        c.lineTo(pex, pcy);
                        c.stroke();
                        c.lineWidth = 1;
                    }
                    c.fillStyle = okFill;
                    this.fillCircleWithBlackOutline(c, pfx, pcy, 5);
                    c.strokeStyle = okCol;
                    c.beginPath();
                    c.arc(pfx, pcy, 8, 0, Math.PI * 2);
                    c.stroke();
                }
            }
        }

        if (pulseActive) this.timelineDirty = true;

        // Keep left label column fixed while horizontal scrolling.
        this.drawFixedLabelColumn(c, rows, rmets, selectedCharRowKey, fixedLabelX, h);

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
        var frontPulse = false;
        for (var cqi = 0; cqi < commentFrontQueue.length; cqi++) {
            var cq = commentFrontQueue[cqi];
            c.fillStyle = 'rgba(80,220,110,.98)';
            this.fillCircleWithBlackOutline(c, cq.x, cq.y, cq.r);
            if (this.drawExecutionPulse(c, cq.uid, -1, cq.x, cq.y, cq.r, pulseNow)) frontPulse = true;
            if (cq.sel || cq.hov) {
                c.strokeStyle = cq.sel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                c.lineWidth = cq.sel ? 2 : 1;
                c.beginPath();
                c.arc(cq.x, cq.y, (cq.sel ? 4 : 3) + cq.r, 0, Math.PI * 2);
                c.stroke();
                c.lineWidth = 1;
            }
        }
        if (frontPulse) this.timelineDirty = true;
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
            this.timelineDirty = true;
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
        var r = this.timeline.getBoundingClientRect();
        if (e.clientX == null || e.clientY == null) return;
        var x = e.clientX - r.left, y = e.clientY - r.top;
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
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var hc = onRulerAny ? null : this.hitTestComment(x, y);
        var hn = onRulerAny ? null : this.hitTestNode(x, y);
        var hb = (onRulerAny || hn) ? null : this.hitTestBar(x, y);
        var hob = onRulerAny ? null : this.hitTestOrderButton(x, y);
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
        } else if (hob) {
            cursor = 'pointer';
        } else if (hn || hc || hb) {
            cursor = 'pointer';
        }
        if (this.timeline.style.cursor !== cursor) this.timeline.style.cursor = cursor;
        var hf = this.xToFrame(x);
        if (Number(this.hoverFrame) !== Number(hf)) {
            this.hoverFrame = Number(hf);
            this.timelineDirty = true;
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
            this.tInfo.textContent = 'frame: ' + this.frame + ' | hover: ' + hf + ' | selected: ' + sid;
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
        var tr = this.model.tracks[this.selKey];
        if (!tr) return;
        var de = null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === this.dragState.uid) { de = tr.commands[i]; break; }
        }
        if (!de) return;
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
        var frame = this.xToFrame(x);
        this.dragState.targetFrame = frame;
        this.dragState.targetRowKey = rowKey;
        this.dragState.valid = this.canPlaceEntry(tr, de, frame, rowKey, de.uid);
        this.timelineDirty = true;
    };

    EE.prototype.onTimelineDown = function(e) {
        if (e.button !== 0) return;
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (this.tryStartSpacePanOnTimeline(e, x, y)) return;
        if (this.controlMode) this.setInteractionMode('timeline', 'timeline');
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var onRulerTrack = this.isTimelineRulerPoint(x, y, false);
        var preNode = onRulerAny ? null : this.hitTestNode(x, y);
        var preComment = onRulerAny ? null : this.hitTestComment(x, y);
        var preBar = onRulerAny ? null : this.hitTestBar(x, y);
        var preOrderBtn = onRulerAny ? null : this.hitTestOrderButton(x, y);
        if (preOrderBtn) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.suppressTimelineDblClickUntil = Date.now() + 450;
            if (preOrderBtn.enabled) this.moveSameFrameCommand(Number(preOrderBtn.uid || 0), String(preOrderBtn.dir || 'prev'));
            return;
        }
        if (preNode && preNode.isEndMarker) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            if (this.hasRangeSelection()) this.clearRangeSelection();
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
        if (!onRulerAny && this.hasRangeSelection()) {
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
        if (this.hasRangeSelection()) this.clearRangeSelection();
        var node = this.hitTestNode(x, y);
        var hb = this.hitTestBar(x, y);
        if (hb && hb.routeRangeUid) {
            var rp = String(hb.routeRangePart || '');
            if (rp === 'body') {
                var nearRouteNode = this.hitTestRouteCommandNodeNear(Number(hb.routeRangeUid || 0), x, y, 5);
                if (nearRouteNode) node = nearRouteNode;
            }
            if (rp === 'left' || rp === 'right' || rp === 'move') {
                var isRouteSubNode = !!node &&
                    Number(node.uid || 0) === Number(hb.routeRangeUid || 0) &&
                    node.routeListIndex != null &&
                    Number(node.routeListIndex) >= 0;
                if (!isRouteSubNode) {
                    var nearHandleNode = this.hitTestRouteCommandNodeNear(Number(hb.routeRangeUid || 0), x, y, 6);
                    if (nearHandleNode) node = nearHandleNode;
                    else node = null;
                }
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
        var wasSelected = !!node && Number(this.selUid || 0) === Number(node.uid || 0) && prevRouteListIndex === nodeRouteListIndex;
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
        this.dragState = {
            uid: node ? node.uid : (rangeEntry ? rangeUid : 0),
            routeListIndex: node ? nodeRouteListIndex : null,
            startX: x,
            startY: y,
            startFrame: node ? node.frame : (rangeEntry ? this.xToFrame(x) : this.xToFrame(x)),
            startRowKey: rowKey,
            targetFrame: node ? node.frame : (rangeEntry ? Math.max(0, Math.floor(Number(rangeEntry.frame || 0))) : this.xToFrame(x)),
            targetRowKey: rowKey,
            wasSelected: wasSelected,
            moved: false,
            valid: true,
            emptyClick: !node && !rangeEntry,
            rangePart: rangeEntry ? String(hb.routeRangePart || 'body') : '',
            startWait: rangeEntry ? Math.max(1, Math.floor(Number(rangeEntry.wait || 1))) : 0,
            startEntryFrame: rangeEntry ? Math.max(0, Math.floor(Number(rangeEntry.frame || 0))) : 0,
            targetWait: rangeEntry ? Math.max(1, Math.floor(Number(rangeEntry.wait || 1))) : 0,
            isRangeDrag: !!rangeEntry && !(node && nodeRouteListIndex >= 0)
        };
        if (node) {
            this.selUid = node.uid;
            this.selRouteListIndex = nodeRouteListIndex;
            this.frame = node.frame;
            this.timelineDirty = true;
        } else if (rangeEntry) {
            this.selUid = rangeEntry.uid;
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(rangeEntry.frame || 0)));
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
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (this.isTimelineRulerY(y)) return;
        var frame = this.xToFrame(x);
        var hitNode = this.hitTestNode(x, y);
        if (hitNode) {
            if (hitNode.isEndMarker) {
                this.seek(Math.max(0, Math.floor(Number(hitNode.frame || 0))));
                return;
            }
            this.selUid = Number(hitNode.uid || 0);
            this.selRouteListIndex = this.nodeRouteIndex(hitNode.routeListIndex);
            this.frame = Math.max(0, Math.floor(Number(hitNode.frame || 0)));
            this.timelineDirty = true;
            if (this.selUid) this.openEditor(this.selUid, this.selRouteListIndex >= 0 ? this.selRouteListIndex : undefined);
            return;
        }
        var hitRange = this.hitTestBar(x, y);
        if (hitRange && hitRange.routeRangeUid) {
            var rangeEntry = this.findRouteRangeEntryByUid(Number(hitRange.routeRangeUid || 0));
            var routeHit = this.routeTimelineItemAtFrame(rangeEntry, frame);
            if (rangeEntry && routeHit && routeHit.listIndex >= 0) {
                this.selUid = Number(rangeEntry.uid || 0);
                this.selRouteListIndex = this.nodeRouteIndex(routeHit.listIndex);
                this.frame = Math.max(0, Math.floor(Number(routeHit.frame || frame)));
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
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        var clickedFrame = this.xToFrame(x);
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var hn = onRulerAny ? null : this.hitTestNode(x, y);
        var hb = onRulerAny ? null : this.hitTestBar(x, y);
        var hnrli = hn ? this.nodeRouteIndex(hn.routeListIndex) : -1;
        if (!onRulerAny && this.hasRangeSelection() && this.isPointInsideCurrentRangeSelection(x, y)) {
            this.openSelectionContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromSelection());
            return;
        }
        if (hn && hnrli >= 0) {
            var he = this.findEntryInSelectedTrack(Number(hn.uid || 0));
            if (he && he.command && Number(he.command.code || 0) === 205 && he.rowType === 'char') {
                this.selUid = Number(hn.uid || 0);
                this.selRouteListIndex = hnrli;
                this.frame = Math.max(0, Math.floor(Number(hn.frame || clickedFrame || 0)));
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
            this.selUid = uid;
            this.selRouteListIndex = -1;
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
                this.selUid = cmdUid;
                this.selRouteListIndex = (hn && Number(hn.uid || 0) === cmdUid)
                    ? this.nodeRouteIndex(hn.routeListIndex)
                    : -1;
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
                this.dirty[this.selKey] = true;
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
                    this.msg('Drop rejected (wait overlap / invalid range)');
                    this.timelineDirty = true;
                    return;
                }
                var oldFrame = Math.max(0, Math.floor(Number(re.frame || 0)));
                var oldWait = Math.max(1, Math.floor(Number(re.wait || 1)));
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
                        this.msg('Drop rejected (left range cannot shrink further)');
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
                    this.msg('Drop rejected (wait overlap / invalid range)');
                    this.timelineDirty = true;
                    return;
                }
                trr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
                this.selUid = re.uid;
                this.selRouteListIndex = -1;
                this.frame = re.frame;
                this.dirty[this.selKey] = true;
                this.rebuildSchedule();
                this.seek(this.frame);
                return;
            }
            if (ds.routeListIndex != null && ds.routeListIndex >= 0) {
                if (ds.moved) {
                    this.msg('Move-route sub-command drag is disabled');
                    this.timelineDirty = true;
                    return;
                }
                this.seek(ds.startFrame);
                if (ds.wasSelected) this.openEditor(ds.uid, ds.routeListIndex);
                return;
            }
            if (ds.moved) {
                var tr = this.model.tracks[this.selKey];
                if (!tr) return;
                var de = null;
                for (var i = 0; i < tr.commands.length; i++) if (tr.commands[i].uid === ds.uid) { de = tr.commands[i]; break; }
                if (!de) return;
                if (!ds.valid) {
                    this.msg('Drop rejected (wait overlap / invalid row)');
                    this.timelineDirty = true;
                    return;
                }
                this.pushSnap('drag');
                de.frame = Math.max(0, Math.floor(Number(ds.targetFrame || 0)));
                if (de.rowType === 'char') {
                    var cid = Number(String(ds.targetRowKey || '').replace('char:', ''));
                    if (!isNaN(cid)) {
                        de.charId = cid;
                        de.rowKey = 'char:' + cid;
                        if (de.command && de.command.code === 205) de.command.parameters[0] = cid;
                    }
                }
                tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
                this.selUid = de.uid;
                this.selRouteListIndex = -1;
                this.frame = de.frame;
                this.dirty[this.selKey] = true;
                this.rebuildSchedule();
                this.seek(this.frame);
                return;
            }
            this.selRouteListIndex = -1;
            this.seek(ds.startFrame);
            if (ds.wasSelected) this.openEditor(ds.uid);
            return;
        }
        if (ds.emptyClick && !ds.moved) {
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.closeEditor();
            this.seek(ds.startFrame);
        }
    };

    EE.prototype.onTimelineWheel = function(e) {
        if (!this.timelineWrap) return;
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        var onRuler = this.isTimelineRulerPoint(x, y, true);
        var doZoom = !!onRuler || !!e.ctrlKey;

        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(this.timelineWrap.clientHeight || 100));
        var dx = Number(e.deltaX || 0) * modeScale;
        var dy = Number(e.deltaY || 0) * modeScale;

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
        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(box.clientHeight || 100));
        var dx = Number(e.deltaX || 0) * modeScale;
        var dy = Number(e.deltaY || 0) * modeScale;
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

    EE.prototype.attachNumberWheelInput = function(input) {
        if (!input || !input.tagName) return;
        if (String(input.tagName).toUpperCase() !== 'INPUT') return;
        if (String(input.type || '').toLowerCase() !== 'number') return;
        if (input._eeWheelHandler) return;
        var self = this;
        var h = function(ev) { self.onEditorNumberWheel(ev); };
        input._eeWheelHandler = h;
        input.addEventListener('wheel', h, { passive: false });
        input.addEventListener('mousewheel', h, { passive: false });
    };

    EE.prototype.attachSelectWheelInput = function(select) {
        if (!select || !select.tagName) return;
        if (String(select.tagName).toUpperCase() !== 'SELECT') return;
        if (select._eeWheelHandler) return;
        var self = this;
        var h = function(ev) { self.onEditorSelectWheel(ev); };
        select._eeWheelHandler = h;
        select.addEventListener('wheel', h, { passive: false });
        select.addEventListener('mousewheel', h, { passive: false });
    };

    EE.prototype.isEditorDialogOpenForWheel = function() {
        return !!(
            (this.modal && this.modal.classList && this.modal.classList.contains('on')) ||
            (this.waitInsertModal && this.waitInsertModal.classList && this.waitInsertModal.classList.contains('on')) ||
            (this.memoModal && this.memoModal.classList && this.memoModal.classList.contains('on')) ||
            (this.routeModal && this.routeModal.classList && this.routeModal.classList.contains('on')) ||
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

        var delta = Number(e.deltaY || 0);
        if (Math.abs(delta) < 0.0001) delta = Number(e.deltaX || 0);
        if (Math.abs(delta) < 0.0001 && e && e.wheelDelta != null) delta = -Number(e.wheelDelta || 0);
        if (Math.abs(delta) < 0.0001) return false;

        var stepText = String(target.step || '');
        var step = Number(stepText);
        if (!isFinite(step) || step <= 0) step = 1;
        var nowValue = Number(target.value);
        if (!isFinite(nowValue)) nowValue = 0;
        var dir = (delta < 0) ? 1 : -1;
        var next = nowValue + step * dir;

        function inputAttrNumber(input, attr) {
            if (!input || !input.getAttribute) return NaN;
            var raw = input.getAttribute(attr);
            if (raw == null) return NaN;
            var text = String(raw).trim();
            if (!text.length) return NaN;
            var n = Number(text);
            return isFinite(n) ? n : NaN;
        }
        var min = inputAttrNumber(target, 'min');
        var max = inputAttrNumber(target, 'max');
        if (isFinite(min) && next < min) next = min;
        if (isFinite(max) && next > max) next = max;

        function countStepDecimals(text) {
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
        function trimTrailingZeros(valueText) {
            return String(valueText).replace(/(\.\d*?[1-9])0+$/g, '$1').replace(/\.0+$/g, '');
        }

        var digits = countStepDecimals(stepText);
        var pow = Math.pow(10, digits);
        if (digits > 0 && isFinite(pow) && pow > 0) next = Math.round(next * pow) / pow;
        target.value = (digits > 0) ? trimTrailingZeros(next.toFixed(digits)) : String(Math.round(next));

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

        var delta = Number(e.deltaY || 0);
        if (Math.abs(delta) < 0.0001) delta = Number(e.deltaX || 0);
        if (Math.abs(delta) < 0.0001 && e && e.wheelDelta != null) delta = -Number(e.wheelDelta || 0);
        if (Math.abs(delta) < 0.0001) return false;

        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(select.clientHeight || 100));

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
        if (this.routeModal && this.routeModal.classList && this.routeModal.classList.contains('on')) return true;
        if (this.modal && this.modal.classList && this.modal.classList.contains('on')) return true;
        if (this.addModal && this.addModal.classList && this.addModal.classList.contains('on')) return true;
        if (this.waitInsertModal && this.waitInsertModal.classList && this.waitInsertModal.classList.contains('on')) return true;
        if (this.memoModal && this.memoModal.classList && this.memoModal.classList.contains('on')) return true;
        if (this.memoScrollLane && this.memoScrollLane.style && this.memoScrollLane.style.display !== 'none') {
            var lr = this.memoScrollLane.getBoundingClientRect();
            if (x >= lr.left && x <= lr.right && y >= lr.top && y <= lr.bottom) return true;
        }
        if (this.cameraCtx && this.cameraCtx.classList && this.cameraCtx.classList.contains('on')) {
            var cr = this.cameraCtx.getBoundingClientRect();
            if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom) return true;
        }
        if (this.routeCtx && this.routeCtx.classList && this.routeCtx.classList.contains('on')) {
            var rr = this.routeCtx.getBoundingClientRect();
            if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) return true;
        }
        if (this.charCtx && this.charCtx.classList && this.charCtx.classList.contains('on')) {
            var mr = this.charCtx.getBoundingClientRect();
            if (x >= mr.left && x <= mr.right && y >= mr.top && y <= mr.bottom) return true;
        }
        var ps = this.root.querySelectorAll('.p');
        for (var i = 0; i < ps.length; i++) {
            var r = ps[i].getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
        }
        return false;
    };

    EE.prototype.selectEvent = function(eid, skipUndo) {
        // Drop transient character rows from the currently selected track
        // before switching selection.
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
            this.closeCharContextMenu();
            this.closeCameraContextMenu();
            this.closeRouteRangeContextMenu();
            this.refreshEventInfo(); this.timelineDirty = true;
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            return;
        }
        if (!skipUndo) this.pushSnap('select');
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
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        this.refreshEventInfo();
        this.rebuildSchedule();
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
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        if (e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        this.selUid = e.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(e.frame, e.wait);
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        return e;
    };

    EE.prototype.addWait = function() {
        if (!this.needSelTrack()) return;
        this.openWaitInsertDialog(this.makeWaitInsertContextFromFrame(this.frame));
    };

    EE.prototype.listFromTrack = function(tr) {
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        var out = [], lf = 0, prevMsgExt = null;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f > lf) out.push({ code: 230, indent: 0, parameters: [f - lf] });
            var cmd = clone(e.command || { code: 0, indent: 0, parameters: [] });
            if (cmd.code === 205) {
                if (!cmd.parameters) cmd.parameters = [0, { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] }];
                cmd.parameters[0] = this.normalizeMoveTarget(e.charId == null ? cmd.parameters[0] : e.charId);
                this.stripRouteEditorMeta(cmd.parameters[1]);
                out.push(cmd);
                var mr = cmd.parameters[1];
                var mrl = mr && Array.isArray(mr.list) ? mr.list : [];
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
                out.push({ code: 355, indent: Number(cmd.indent || 0), parameters: [animScript] });
                if (animSpec.wait) out.push({ code: 230, indent: Number(cmd.indent || 0), parameters: [60] });
            } else if (cmd.code === 108) {
                this.memoApplyParsedStateToEntry(e);
                if (e.isMemo) {
                    var memoLine = this.memoCommentLine(e.memoSize, e.memoText);
                    e.commentLines = [memoLine];
                    out.push({ code: 108, indent: Number(cmd.indent || 0), parameters: [memoLine] });
                } else {
                    var lines = e.commentLines && e.commentLines.length ? e.commentLines : [String((cmd.parameters || [''])[0] || '')];
                    out.push({ code: 108, indent: Number(cmd.indent || 0), parameters: [String(lines[0] || '')] });
                    for (var j = 1; j < lines.length; j++) {
                        out.push({ code: 408, indent: Number(cmd.indent || 0), parameters: [String(lines[j] || '')] });
                    }
                }
            } else if (cmd.code === 101) {
                var delta = this.messageExtDeltaForOutput(e, prevMsgExt);
                var pre = delta && Array.isArray(delta.commands) ? delta.commands : [];
                for (var pm = 0; pm < pre.length; pm++) out.push(pre[pm]);
                prevMsgExt = delta ? delta.nextState : prevMsgExt;
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
            lf = Math.max(lf, f + Math.max(0, Math.floor(Number(e.wait || 0))));
        }
        var endFrame = this.normalizeTrackEndFrame(tr);
        if (endFrame > lf) {
            out.push({ code: 230, indent: 0, parameters: [endFrame - lf] });
            lf = endFrame;
        }
        out.push({ code: 0, indent: 0, parameters: [] });
        return out;
    };

    var _eeBaseRebuildSchedule = EE.prototype.rebuildSchedule;
    EE.prototype.rebuildSchedule = function() {
        if (this._eeRebuildScheduleGuard) {
            _eeBaseRebuildSchedule.call(this);
            return;
        }
        this._eeRebuildScheduleGuard = true;
        try {
            // 1) Build latest schedule from current model so simTo() can see edits.
            _eeBaseRebuildSchedule.call(this);

            // 2) Auto-adjust tile-goto wait lengths after any edit/add/move.
            if (!this.play && this.model && this.model.tracks) {
                var ks = Object.keys(this.model.tracks);
                for (var i = 0; i < ks.length; i++) {
                    var tr = this.model.tracks[ks[i]];
                    if (!tr || !Array.isArray(tr.commands)) continue;
                    var hasRoute = false;
                    for (var j = 0; j < tr.commands.length; j++) {
                        var ce = tr.commands[j];
                        if (ce && ce.command && Number(ce.command.code || 0) === 205) { hasRoute = true; break; }
                    }
                    if (!hasRoute) continue;
                    this.normalizeTrackRouteTileGotoWaitMeta(tr);
                }
            }

            // 3) Rebuild once more to apply updated wait lengths to schedule/hit ranges.
            _eeBaseRebuildSchedule.call(this);
        } finally {
            this._eeRebuildScheduleGuard = false;
        }
    };

    var _eeBaseSave = EE.prototype.save;
    EE.prototype.save = function(backupOnly) {
        _eeBaseSave.call(this, backupOnly);
        if (backupOnly) return;
        this.persistSelectedTimelineViewStateToDisk();
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
            if (kind !== 'memory' && kind !== 'rect') kind = 'none';
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
        this.panelSelectedCharId = (s && s.panelSelectedCharId != null)
            ? Number(s.panelSelectedCharId)
            : (this.selEid > 0 ? Number(this.selEid) : null);
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
    };


})();
