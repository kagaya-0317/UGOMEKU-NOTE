//=============================================================================
// KNH_ZXC_EventEditor_Model
//=============================================================================

(function(root, factory) {
    'use strict';
    var api = factory();
    if (root) {
        var ns = root.KNH_ZXC_EventEditor = root.KNH_ZXC_EventEditor || {};
        ns._eeModel = api;
    }
    if (typeof window === 'undefined' && typeof module === 'object' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    function hashText32(text) {
        var hash = 2166136261 >>> 0;
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return ('00000000' + hash.toString(16)).slice(-8);
    }

    function fingerprint(text) {
        text = String(text == null ? '' : text);
        return String(text.length) + ':' + hashText32(text);
    }

    function entryUid(entry) {
        return Math.floor(Number(entry && entry.uid || 0));
    }

    function entryExecutionOrder(entry) {
        var raw = entry && entry.executionOrder;
        var order = Number(raw);
        return raw != null && isFinite(order) ? order : entryUid(entry);
    }

    function compareEntriesByFrameExecutionOrder(a, b) {
        var af = Math.max(0, Math.floor(Number(a && a.frame || 0)));
        var bf = Math.max(0, Math.floor(Number(b && b.frame || 0)));
        if (af !== bf) return af - bf;
        var ao = entryExecutionOrder(a);
        var bo = entryExecutionOrder(b);
        if (ao !== bo) return ao - bo;
        return entryUid(a) - entryUid(b);
    }

    function sortTrackCommands(track) {
        var commands = track && Array.isArray(track.commands) ? track.commands : [];
        commands.sort(compareEntriesByFrameExecutionOrder);
        return commands;
    }

    function pushHistorySnapshot(options) {
        options = options || {};
        var undo = Array.isArray(options.undo) ? options.undo : null;
        var redo = Array.isArray(options.redo) ? options.redo : null;
        var snapshot = options.snapshot;
        var equals = options.equals;
        if (!undo || !redo || !snapshot || typeof equals !== 'function') {
            throw new Error('invalid history snapshot options');
        }
        var lastIndex = undo.length - 1;
        if (lastIndex >= 0 && equals(undo[lastIndex], snapshot)) {
            // Content equality intentionally ignores selection-only UI state.
            // Replace the record so Undo restores the current selection.
            undo[lastIndex] = snapshot;
            redo.length = 0;
            return false;
        }
        undo.push(snapshot);
        var limit = Math.max(1, Math.floor(Number(options.limit || 80)));
        if (undo.length > limit) undo.splice(0, undo.length - limit);
        redo.length = 0;
        return true;
    }

    function snapshotModel(model, cache) {
        var source = model || { nextUid: 1, tracks: {} };
        var result = {};
        var keys = Object.keys(source);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i] === 'tracks') continue;
            var serialized = JSON.stringify(source[keys[i]]);
            result[keys[i]] = serialized === undefined ? undefined : JSON.parse(serialized);
        }
        result.tracks = {};
        cache = cache || {};
        var tracks = source.tracks || {};
        var trackKeys = Object.keys(tracks);
        var liveTrackKeys = Object.create(null);
        for (i = 0; i < trackKeys.length; i++) liveTrackKeys[trackKeys[i]] = true;
        var cachedTrackKeys = Object.keys(cache);
        for (i = 0; i < cachedTrackKeys.length; i++) {
            if (!liveTrackKeys[cachedTrackKeys[i]]) delete cache[cachedTrackKeys[i]];
        }
        for (i = 0; i < trackKeys.length; i++) {
            var key = trackKeys[i];
            var text = JSON.stringify(tracks[key]);
            var sig = fingerprint(text);
            var cached = cache[key];
            if (!cached || cached.fingerprint !== sig || cached.text !== text) {
                cached = { fingerprint: sig, text: text, value: JSON.parse(text) };
                cache[key] = cached;
            }
            result.tracks[key] = cached.value;
        }
        return { model: result, cache: cache };
    }

    function rebuildSchedule(options) {
        options = options || {};
        var tracks = options.tracks || {};
        var requested = Array.isArray(options.changedTrackKeys) ? options.changedTrackKeys : [];
        var incremental = requested.length > 0 && options.schedule && options.byTrack;
        var schedule = incremental ? options.schedule : {};
        var byTrack = incremental ? options.byTrack : {};
        var keys = incremental ? requested : Object.keys(tracks);
        var seen = Object.create(null);
        for (var i = 0; i < keys.length; i++) {
            var key = String(keys[i] || '');
            if (!key || seen[key]) continue;
            seen[key] = true;
            if (incremental) {
                var previous = Array.isArray(byTrack[key]) ? byTrack[key] : [];
                for (var pi = 0; pi < previous.length; pi++) {
                    var old = previous[pi];
                    var bucket = old && schedule[old.frame];
                    if (!bucket) continue;
                    var index = bucket.indexOf(old.entry);
                    if (index >= 0) bucket.splice(index, 1);
                    if (!bucket.length) delete schedule[old.frame];
                }
                delete byTrack[key];
            }
            var track = tracks[key];
            if (!track || !Array.isArray(track.commands)) continue;
            if (typeof options.normalizeTrack === 'function') options.normalizeTrack(track);
            var contribution = [];
            for (var ci = 0; ci < track.commands.length; ci++) {
                var entry = track.commands[ci];
                var frame = Math.max(0, Math.floor(Number(entry && entry.frame || 0)));
                if (!schedule[frame]) schedule[frame] = [];
                schedule[frame].push(entry);
                contribution.push({ frame: frame, entry: entry });
            }
            byTrack[key] = contribution;
        }
        return { schedule: schedule, byTrack: byTrack, incremental: incremental };
    }

    return {
        fingerprint: fingerprint,
        entryUid: entryUid,
        entryExecutionOrder: entryExecutionOrder,
        compareEntriesByFrameExecutionOrder: compareEntriesByFrameExecutionOrder,
        // Compatibility name used by the split timeline modules.
        compareEntriesByFrameWaitUid: compareEntriesByFrameExecutionOrder,
        sortTrackCommands: sortTrackCommands,
        pushHistorySnapshot: pushHistorySnapshot,
        snapshotModel: snapshotModel,
        rebuildSchedule: rebuildSchedule
    };
});
