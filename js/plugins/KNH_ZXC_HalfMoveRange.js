/*:
 * @plugindesc HalfMove Range Collision Add-on (range note tag)
 * @author KNH
 * @help
 * Requires: HalfMove.js (place this below).
 *
 * Note tag (Event):
 *   <range:[0,0],[0.5,0],[0,0.5],[0.5,0.5]>
 *
 * The listed offsets (relative to event position, in 0.5 steps)
 * define the collision/trigger area. If an offset is omitted,
 * that half-tile cell has no collision.
 *
 * When <range:...> is present:
 * - HMWidth/HMHeight are ignored
 * - HM trigger expansion tags are ignored
 */

(function() {
    'use strict';

    if (typeof Game_Event === 'undefined' || !Game_Event.prototype.posExpansionNt) {
        return;
    }

    var RANGE_META_KEYS = ['range', 'Range'];
    var DEFAULT_UNIT = 0.5;
    var RANGE_ORIGIN_OFFSET_INDEX = 1;

    function getTileUnit() {
        return (typeof Game_Map !== 'undefined' && Game_Map.tileUnit) ? Game_Map.tileUnit : DEFAULT_UNIT;
    }

    function toUnitIndex(value) {
        var unit = getTileUnit();
        return Math.round(value / unit);
    }

    function getRangeMeta(event) {
        if (!event || !event.meta) return null;
        for (var i = 0; i < RANGE_META_KEYS.length; i++) {
            var key = RANGE_META_KEYS[i];
            if (event.meta.hasOwnProperty(key)) return event.meta[key];
        }
        return null;
    }

    function parseRangeValue(value) {
        if (value === undefined || value === null) return null;
        var text = String(value).trim();
        if (!text) return null;
        var jsonText;
        if (text[0] === '[') {
            jsonText = (text[1] === '[') ? text : '[' + text + ']';
        } else {
            return null;
        }

        var data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            return null;
        }
        if (!Array.isArray(data)) return null;

        var map = {};
        var hasAny = false;
        for (var i = 0; i < data.length; i++) {
            var pair = data[i];
            if (!Array.isArray(pair) || pair.length < 2) continue;
            var dx = Number(pair[0]);
            var dy = Number(pair[1]);
            if (!isFinite(dx) || !isFinite(dy)) continue;
            var key = toUnitIndex(dx) + ',' + toUnitIndex(dy);
            if (!map[key]) {
                map[key] = true;
                hasAny = true;
            }
        }
        return hasAny ? map : null;
    }

    function setupRangeForEvent(ev) {
        var raw = getRangeMeta(ev.event());
        var map = parseRangeValue(raw);
        ev._halfMoveRangeMap = map;
        if (map) {
            ev._eventWidth = null;
            ev._eventHeight = null;
            ev._triggerExpansion = false;
        }
    }

    var _Game_Event_initialize = Game_Event.prototype.initialize;
    Game_Event.prototype.initialize = function(mapId, eventId) {
        _Game_Event_initialize.apply(this, arguments);
        setupRangeForEvent(this);
    };

    var _Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function() {
        _Game_Event_setupPage.apply(this, arguments);
        setupRangeForEvent(this);
    };

    Game_Event.prototype.hasHalfMoveRange = function() {
        return !!this._halfMoveRangeMap;
    };

    Game_Event.prototype.isInHalfMoveRange = function(x, y) {
        if (!this._halfMoveRangeMap) return false;
        var dx = toUnitIndex(x - this.x) + RANGE_ORIGIN_OFFSET_INDEX;
        var dy = toUnitIndex(y - this.y) + RANGE_ORIGIN_OFFSET_INDEX;
        return !!this._halfMoveRangeMap[dx + ',' + dy];
    };

    var _Game_Event_pos = Game_Event.prototype.pos;
    Game_Event.prototype.pos = function(x, y) {
        if (this.hasHalfMoveRange()) {
            return this.isInHalfMoveRange(x, y);
        }
        return _Game_Event_pos.apply(this, arguments);
    };

    var _Game_Event_posExpansionNt = Game_Event.prototype.posExpansionNt;
    Game_Event.prototype.posExpansionNt = function(x, y) {
        if (this.hasHalfMoveRange()) {
            return this.isInHalfMoveRange(x, y) && !this.isThrough();
        }
        return _Game_Event_posExpansionNt.apply(this, arguments);
    };

    var _Game_Event_isTriggerExpansion = Game_Event.prototype.isTriggerExpansion;
    Game_Event.prototype.isTriggerExpansion = function(x, y) {
        if (this.hasHalfMoveRange()) {
            return this.isInHalfMoveRange(x, y);
        }
        return _Game_Event_isTriggerExpansion.apply(this, arguments);
    };

    if (typeof Game_Player !== 'undefined' && Game_Player.prototype.executeMoveRetry) {
        Game_Player.prototype.executeMoveRetry = function(d) {
            if (d === 2 || d === 8) {
                this.moveDiagonallyForRetry(4, d);
                this.moveDiagonallyForRetry(6, d);
            }
            if (d === 4 || d === 6) {
                this.moveDiagonallyForRetry(d, 2);
                this.moveDiagonallyForRetry(d, 8);
            }
        };
    }
})();
