//=============================================================================
// KNH_ZXC_EventEditor_Debug
//=============================================================================

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;
    var SH = NS._eeTimelineShared;
    if (!SH || !SH.ready) return;
    var clone = SH.clone;
    SH.beginModule('debug');

    EE.prototype.logTileWaitDebug = function(tag, payload) {
        if (!this.isCalcDebugEnabled()) return;
        if (typeof this.eeAppendFileLog === 'function') {
            this.eeAppendFileLog('TILE_WAIT', { tag: String(tag || ''), payload: payload || null });
        }
    };

    EE.prototype.isCalcDebugEnabled = function() {
        if (this._eeCalcDebugEnabled) return true;
        if (NS && NS._eeCalcDebugEnabled) return true;
        if (typeof window !== 'undefined' && window.KNH_ZXC_EE_CALC_DEBUG) return true;
        return false;
    };

    EE.prototype.setCalcDebugEnabled = function(enabled) {
        this._eeCalcDebugEnabled = !!enabled;
        if (!this._eeCalcDebugEnabled) this._eeCalcDebugBaseFlagsByEvent = null;
    };

    EE.prototype.calcDebugTargetEventId = function() {
        var n = Number(this._eeCalcDebugEventId);
        if (isFinite(n) && n > 0) return Math.floor(n);
        return 14;
    };

    EE.prototype.captureCalcDebugRouteState = function(route, index) {
        if (!route || !Array.isArray(route.list)) return null;
        var idx = Math.max(0, Math.floor(Number(index || 0)));
        var list = route.list;
        var cur = (idx >= 0 && idx < list.length) ? list[idx] : null;
        return {
            index: idx,
            listLength: list.length,
            repeat: !!route.repeat,
            skippable: !!route.skippable,
            wait: !!route.wait,
            currentCode: cur ? Math.floor(Number(cur.code || 0)) : null,
            currentParameters: cur && Array.isArray(cur.parameters) ? clone(cur.parameters) : null
        };
    };

    EE.prototype.captureCalcDebugCharacterState = function(ch) {
        if (!ch) return null;
        var eid = null;
        try { if (typeof ch.eventId === 'function') eid = Math.floor(Number(ch.eventId() || 0)); } catch (_) { eid = null; }
        var dir = (typeof ch.direction === 'function') ? Number(ch.direction() || 2) : Number(ch._direction || 2);
        var primitive = null;
        if (typeof this.captureCharacterPrimitiveFlags === 'function') {
            try { primitive = this.captureCharacterPrimitiveFlags(ch); } catch (_) { primitive = null; }
        }
        return {
            eventId: eid,
            x: Number(ch.x == null ? ch._x : ch.x),
            y: Number(ch.y == null ? ch._y : ch.y),
            realX: Number(ch._realX == null ? (ch.x == null ? 0 : ch.x) : ch._realX),
            realY: Number(ch._realY == null ? (ch.y == null ? 0 : ch.y) : ch._realY),
            dir: dir,
            moveSpeed: Number(ch._moveSpeed || 4),
            moveFrequency: Number(ch._moveFrequency || 3),
            pattern: Number(ch._pattern || 0),
            opacity: Number(ch._opacity == null ? 255 : ch._opacity),
            blendMode: Number(ch._blendMode || 0),
            walkAnime: !!ch._walkAnime,
            stepAnime: !!ch._stepAnime,
            directionFix: !!ch._directionFix,
            through: !!ch._through,
            transparent: !!ch._transparent,
            stopCount: Number(ch._stopCount || 0),
            waitCount: Number(ch._waitCount || 0),
            jumpCount: Number(ch._jumpCount || 0),
            jumpPeak: Number(ch._jumpPeak || 0),
            moving: (typeof ch.isMoving === 'function') ? !!ch.isMoving() : !!ch._moving,
            jumping: (typeof ch.isJumping === 'function') ? !!ch.isJumping() : Number(ch._jumpCount || 0) > 0,
            moveRouteForcing: !!ch._moveRouteForcing,
            moveRoute: this.captureCalcDebugRouteState(ch._moveRoute, ch._moveRouteIndex),
            originalMoveRoute: this.captureCalcDebugRouteState(ch._originalMoveRoute, ch._originalMoveRouteIndex),
            primitiveFlags: primitive
        };
    };

    EE.prototype.shouldLogCalcDebugPropertyDiff = function(tag) {
        if (!this.isCalcDebugEnabled()) return false;
        tag = String(tag || '');
        return tag === 'sim_recalc_begin_before_base_simto' ||
            tag === 'sim_recalc_begin_after_base_simto' ||
            tag === 'sim_recalc_goto_after_simto' ||
            tag === 'sim_recalc_go_to_follower_after_simto' ||
            tag === 'sim_recalc_end' ||
            tag === 'runtime_wait_restored';
    };

    EE.prototype.captureCalcDebugBasePrimitiveFlags = function(eventId) {
        var id = Math.floor(Number(eventId || 0));
        if (id <= 0 || !this.base || !this.base.ev) return null;
        var st = this.base.ev[id];
        if (!st || !st.ex || typeof st.ex !== 'object') return null;
        try { return clone(st.ex); } catch (_) { return st.ex; }
    };

    EE.prototype.getCalcDebugBaselinePrimitiveFlags = function(eventId, currentPrimitiveFlags) {
        var id = Math.floor(Number(eventId || 0));
        if (id <= 0) return null;
        if (!this._eeCalcDebugBaseFlagsByEvent || typeof this._eeCalcDebugBaseFlagsByEvent !== 'object') {
            this._eeCalcDebugBaseFlagsByEvent = Object.create(null);
        }
        var key = String(id);
        if (Object.prototype.hasOwnProperty.call(this._eeCalcDebugBaseFlagsByEvent, key)) {
            var cached = this._eeCalcDebugBaseFlagsByEvent[key];
            try { return clone(cached); } catch (_) { return cached; }
        }
        var baseline = this.captureCalcDebugBasePrimitiveFlags(id);
        if (!baseline && currentPrimitiveFlags && typeof currentPrimitiveFlags === 'object') {
            try { baseline = clone(currentPrimitiveFlags); } catch (_) { baseline = currentPrimitiveFlags; }
        }
        if (!baseline || typeof baseline !== 'object') return null;
        this._eeCalcDebugBaseFlagsByEvent[key] = baseline;
        try { return clone(baseline); } catch (_) { return baseline; }
    };

    EE.prototype.calcDebugValuesEqual = function(a, b) {
        if (a === b) return true;
        var ta = typeof a;
        var tb = typeof b;
        if (ta !== tb) return false;
        if (ta === 'number') {
            if (isNaN(a) && isNaN(b)) return true;
            return Math.abs(Number(a) - Number(b)) <= 1e-9;
        }
        if (a == null || b == null) return false;
        try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) {}
        return false;
    };

    EE.prototype.calcDebugCompactValue = function(v) {
        if (v === undefined) return '__EE_UNDEFINED__';
        var t = typeof v;
        if (v == null || t === 'boolean' || t === 'number' || t === 'string') return v;
        try {
            var s = JSON.stringify(v);
            if (s.length > 320) return s.slice(0, 320) + '...(trimmed ' + String(s.length - 320) + ' chars)';
            return s;
        } catch (_) {}
        try { return String(v); } catch (_) {}
        return '__EE_UNSERIALIZABLE__';
    };

    EE.prototype.calcDebugPrimitiveFlagDiff = function(baseFlags, currentFlags, limit) {
        limit = Math.max(1, Math.floor(Number(limit || 120) || 120));
        if (!baseFlags || typeof baseFlags !== 'object') {
            return { available: false, reason: 'base_missing' };
        }
        if (!currentFlags || typeof currentFlags !== 'object') {
            return { available: false, reason: 'current_missing' };
        }
        var keysMap = Object.create(null);
        var bk = Object.keys(baseFlags);
        var ck = Object.keys(currentFlags);
        var i;
        for (i = 0; i < bk.length; i++) keysMap[String(bk[i] || '')] = true;
        for (i = 0; i < ck.length; i++) keysMap[String(ck[i] || '')] = true;
        var keys = Object.keys(keysMap).filter(function(k) { return !!k; }).sort();
        var total = 0;
        var changes = [];
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            var hasBase = Object.prototype.hasOwnProperty.call(baseFlags, key);
            var hasCurrent = Object.prototype.hasOwnProperty.call(currentFlags, key);
            if (hasBase && hasCurrent && this.calcDebugValuesEqual(baseFlags[key], currentFlags[key])) continue;
            total++;
            if (changes.length >= limit) continue;
            changes.push({
                key: key,
                base: hasBase ? this.calcDebugCompactValue(baseFlags[key]) : '__EE_MISSING__',
                current: hasCurrent ? this.calcDebugCompactValue(currentFlags[key]) : '__EE_MISSING__'
            });
        }
        return {
            available: true,
            changedCount: total,
            shownCount: changes.length,
            truncated: total > changes.length,
            changes: changes
        };
    };

    EE.prototype.logCalcDebugPropertyDiff = function(tag, targetEventId, currentPrimitiveFlags) {
        try {
            if (!this.isCalcDebugEnabled()) return;
            if (typeof console === 'undefined' || !console.log) return;
            var diff = this.calcDebugPrimitiveFlagDiff(
                this.getCalcDebugBaselinePrimitiveFlags(targetEventId, currentPrimitiveFlags),
                currentPrimitiveFlags,
                140
            );
            var payload = {
                tag: String(tag || ''),
                targetEventId: Math.floor(Number(targetEventId || 0)),
                editorFrame: Math.max(0, Math.floor(Number(this.frame || 0))),
                simFrame: Math.max(0, Math.floor(Number(this._simFrame || 0))),
                simExecFrame: Math.floor(Number(this._simExecFrame == null ? -1 : this._simExecFrame)),
                diff: diff
            };
            console.log('[EventEditor][EE_PROP_DIFF]', JSON.stringify(payload));
            if (typeof this.eeAppendFileLog === 'function') this.eeAppendFileLog('DIFF', payload);
        } catch (_) {}
    };

    EE.prototype.logCalcDebugReferenceCompare = function(tag, targetEventId, currentPrimitiveFlags) {
        try {
            if (!this.isCalcDebugEnabled()) return;
            if (typeof console === 'undefined' || !console.log) return;
            if (typeof this.findEePropReferenceFrame !== 'function') return;
            var frame = Math.max(0, Math.floor(Number(this.frame || 0)));
            var ref = this.findEePropReferenceFrame(targetEventId, frame);
            if (!ref) return;
            var refFlags = (ref.primitiveFlags && typeof ref.primitiveFlags === 'object') ? ref.primitiveFlags : null;
            var diff = this.calcDebugPrimitiveFlagDiff(refFlags, currentPrimitiveFlags, 180);
            var curJson = '';
            try { curJson = JSON.stringify(currentPrimitiveFlags || {}); } catch (_) { curJson = ''; }
            var payload = {
                tag: String(tag || ''),
                targetEventId: Math.floor(Number(targetEventId || 0)),
                editorFrame: frame,
                simFrame: Math.max(0, Math.floor(Number(this._simFrame || 0))),
                simExecFrame: Math.floor(Number(this._simExecFrame == null ? -1 : this._simExecFrame)),
                refSavedAt: (this._eePropRefDebug && this._eePropRefDebug.savedAt) ? String(this._eePropRefDebug.savedAt) : '',
                refHash: String(ref.hash || ''),
                currentHash: (typeof this.saveTraceHash === 'function') ? this.saveTraceHash(curJson) : '',
                refSourceRows: Array.isArray(ref.sourceRows) ? ref.sourceRows : [],
                diffAgainstSave: diff
            };
            if (typeof this.eeAppendFileLog === 'function') this.eeAppendFileLog('REF_CMP', payload);
        } catch (_) {}
    };

    EE.prototype.logCalcDebugEventState = function(tag, extra) {
        try {
            if (!this.isCalcDebugEnabled()) return;
            if (typeof console === 'undefined' || !console.log) return;
            var targetEventId = this.calcDebugTargetEventId();
            if (!$gameMap || typeof $gameMap.event !== 'function') return;
            var target = $gameMap.event(targetEventId);
            if (!target) return;
            var tagName = String(tag || '');
            if (!this.shouldLogCalcDebugPropertyDiff(tagName)) return;
            var eventState = this.captureCalcDebugCharacterState(target);
            var flags = eventState ? eventState.primitiveFlags : null;
            this.logCalcDebugPropertyDiff(tagName, targetEventId, flags);
            this.logCalcDebugReferenceCompare(tagName, targetEventId, flags);
        } catch (_) {}
    };
    SH.registerModule('debug', ['core']);
})();
