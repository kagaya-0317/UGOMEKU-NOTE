//=============================================================================
// KNH_ZXC_EventEditor_Document
//=============================================================================

(function(root, factory) {
    'use strict';
    var api = factory();
    if (root) {
        var ns = root.KNH_ZXC_EventEditor = root.KNH_ZXC_EventEditor || {};
        ns._eeDocument = api;
    }
    if (typeof window === 'undefined' && typeof module === 'object' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function id(value) {
        return Math.max(0, Math.floor(Number(value || 0)));
    }

    function trackKey(eventId, pageIndex) {
        return String(eventId) + ':' + String(pageIndex);
    }

    function rebaseEventTracks(options) {
        options = options || {};
        var eventId = Math.max(1, id(options.eventId));
        var tracks = options.tracks || {};
        var dirty = options.dirty || {};
        var tokens = Array.isArray(options.pageTokens) ? options.pageTokens : [];
        var selectedOldPage = options.selectedOldPage == null ? -1 : Math.floor(Number(options.selectedOldPage));
        if (!isFinite(selectedOldPage)) selectedOldPage = -1;
        var fallbackPage = id(options.fallbackPage);
        var nextTracks = {};
        var nextDirty = {};
        var sourceTracks = {};
        var sourceDirty = {};
        var keys = Object.keys(tracks);
        var i;
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            var track = tracks[key];
            if (!track || id(track.eventId) !== eventId) {
                nextTracks[key] = track;
                if (dirty[key]) nextDirty[key] = true;
                continue;
            }
            var oldPage = id(track.pageIndex);
            sourceTracks[oldPage] = track;
            sourceDirty[oldPage] = !!dirty[key];
        }
        var dirtyKeys = Object.keys(dirty);
        for (i = 0; i < dirtyKeys.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(tracks, dirtyKeys[i])) nextDirty[dirtyKeys[i]] = dirty[dirtyKeys[i]];
        }
        var selectedNewPage = -1;
        for (i = 0; i < tokens.length; i++) {
            var match = /^orig:(\d+)$/.exec(String(tokens[i] || ''));
            if (!match) continue;
            var sourcePage = id(match[1]);
            var sourceTrack = sourceTracks[sourcePage];
            if (sourceTrack) {
                var rebased = clone(sourceTrack);
                rebased.eventId = eventId;
                rebased.pageIndex = i;
                var nextKey = trackKey(eventId, i);
                nextTracks[nextKey] = rebased;
                if (sourceDirty[sourcePage]) nextDirty[nextKey] = true;
            }
            if (sourcePage === selectedOldPage) selectedNewPage = i;
        }
        if (selectedOldPage >= 0 && selectedNewPage < 0) {
            selectedNewPage = Math.max(0, Math.min(tokens.length - 1, fallbackPage));
        }
        return {
            tracks: nextTracks,
            dirty: nextDirty,
            selectedNewPage: selectedNewPage
        };
    }

    function stripRuntimeMeta(record) {
        if (record && Object.prototype.hasOwnProperty.call(record, 'meta')) delete record.meta;
        return record;
    }

    function mergeLatestDocument(options) {
        options = options || {};
        var battle = !!options.battle;
        var merged = clone(options.latestDocument);
        var documentDirty = options.documentDirty || { events: {}, troops: {} };
        var sourceEvents = Array.isArray(options.currentEvents) ? options.currentEvents : [];
        var sourceTroops = Array.isArray(options.currentTroops) ? options.currentTroops : [];
        var dirtyIds;
        var i;
        if (battle) {
            if (!Array.isArray(merged)) throw new Error('Troops.json root must be an array');
            dirtyIds = Object.keys(documentDirty.troops || {});
            for (i = 0; i < dirtyIds.length; i++) {
                var troopId = id(dirtyIds[i]);
                merged[troopId] = sourceTroops[troopId] == null ? null : stripRuntimeMeta(clone(sourceTroops[troopId]));
            }
        } else {
            if (!merged || typeof merged !== 'object' || !Array.isArray(merged.events)) {
                throw new Error('Map JSON root must contain an events array');
            }
            dirtyIds = Object.keys(documentDirty.events || {});
            for (i = 0; i < dirtyIds.length; i++) {
                var eventId = id(dirtyIds[i]);
                merged.events[eventId] = sourceEvents[eventId] == null ? null : stripRuntimeMeta(clone(sourceEvents[eventId]));
            }
        }

        var tracks = options.tracks || {};
        var preparedLists = options.preparedLists || {};
        var keys = Array.isArray(options.trackKeys) ? options.trackKeys : [];
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            var track = tracks[key];
            if (!track || !Object.prototype.hasOwnProperty.call(preparedLists, key)) continue;
            var ownerId = id(track.eventId);
            var owner = battle ? merged[ownerId] : merged.events[ownerId];
            var pageIndex = id(track.pageIndex);
            if (!owner || !Array.isArray(owner.pages) || !owner.pages[pageIndex]) {
                throw new Error('save target page not found: ' + String(track.eventId) + ':' + String(pageIndex));
            }
            owner.pages[pageIndex].list = clone(preparedLists[key]);
        }
        return merged;
    }

    return {
        clone: clone,
        rebaseEventTracks: rebaseEventTracks,
        mergeLatestDocument: mergeLatestDocument
    };
});
