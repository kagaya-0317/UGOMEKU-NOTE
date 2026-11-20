/*:
 * @plugindesc Event-based toggle panels with the existing spike-floor gimmick.
 * @help
 * Map: <spikePanelPuzzle:progressVariable,commonEvent>
 * Panel: <spikePanel> (self switch A is the persistent ON state)
 * Trap: <spikePanelTrap:width,height,wall|timed,phase>
 * Trap rectangles start 0.25 tiles above/left of their editor/half-step position.
 * A parallel controller calls KNH_SpikePanel.update(this).
 * Each panel calls the same common event: KNH_SpikePanel.toggle(this._eventId).
 * Damage, target selection, locks and safe-floor return are entirely native.
 */
(function() {
    'use strict';
    var api = window.KNH_SpikePanel = {};
    var CYCLE = 255;

    function config() {
        var value = $dataMap && $dataMap.meta && $dataMap.meta.spikePanelPuzzle;
        if (!value) return null;
        var parts = String(value).split(',').map(Number);
        return { variable: parts[0], commonEvent: parts[1] };
    }
    function isPanel(event) {
        return event && event.event().meta && event.event().meta.spikePanel;
    }
    function inside(character, rect) {
        return character._realX >= rect.x && character._realX < rect.x + rect.w &&
            character._realY >= rect.y && character._realY < rect.y + rect.h;
    }
    api.panelRect = function(event) {
        return { x: event.x - 0.75, y: event.y - 0.75, w: 1.5, h: 1.5 };
    };
    api.trapRect = function(event) {
        var p = String(event.event().meta.spikePanelTrap).split(',');
        return { x: event.x - 0.25, y: event.y - 0.25,
            w: Number(p[0]), h: Number(p[1]), mode: p[2], phase: Number(p[3]) || 0 };
    };
    function state() {
        if (!$gameMap._spikePanelRuntime) {
            var s = $gameMap._spikePanelRuntime = {
                clock: 0, panels: [], traps: [], cameraHeld: false,
                cameraX: $gameMap._scrollToX, cameraY: $gameMap._scrollToY,
                cameraOffset: ($gamePlayer._centerXy || [0, 0]).slice()
            };
            for (var i = 0; i < $gameMap._events.length; i++) {
                var e = $gameMap._events[i];
                if (isPanel(e)) s.panels.push(i);
                if (e && e.event().meta && e.event().meta.spikePanelTrap) s.traps.push(i);
            }
        }
        return $gameMap._spikePanelRuntime;
    }
    function panelOn(event) {
        return !!$gameSelfSwitches.value([$gameMap.mapId(), event.eventId(), 'A']);
    }
    api.status = function() {
        var cfg = config();
        if (!cfg) return null;
        var s = state(), on = [];
        s.panels.forEach(function(id) { if (panelOn($gameMap.event(id))) on.push(id); });
        return { clock: s.clock, total: s.panels.length, on: on,
            complete: $gameVariables.value(cfg.variable) >= 2 };
    };
    api.releaseCamera = function() {
        var s = $gameMap._spikePanelRuntime;
        if (s && s.cameraHeld) {
            $gameMap._scrollToX = s.cameraX;
            $gameMap._scrollToY = s.cameraY;
            s.cameraHeld = false;
        }
    };
    api.restoreCamera = function() {
        var s = $gameMap._spikePanelRuntime;
        api.releaseCamera();
        if (s) $gameMap.scrollCamera(s.cameraOffset[0], s.cameraOffset[1], 60);
    };
    api.toggle = function(eventId) {
        var cfg = config(), event = $gameMap.event(eventId);
        if (!cfg || !isPanel(event) || $gameVariables.value(cfg.variable) >= 2 ||
            event._spikePanelHeld || $gamePlayer.isJumping() ||
            $gamePlayer._spikeFloorDamageState || state().returning ||
            !inside($gamePlayer, api.panelRect(event))) return;
        event._spikePanelHeld = true;
        var on = !panelOn(event);
        $gameSelfSwitches.setValue([$gameMap.mapId(), eventId, 'A'], on);
        event.refresh();
        event.startFrameAnimation(on ? [1, 4, 7, 10] : [10, 7, 4, 1], 3, false);
        event.playSe('Switch2', 75, on ? 110 : 90);
        var status = api.status();
        if (status.total > 0 && status.on.length === status.total) {
            $gameVariables.setValue(cfg.variable, 2);
            KNH_CastleUpper.refreshEvents();
        }
    };
    var waitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'spikePanelLanding') {
            if ($gamePlayer.isMoving()) return true;
            this._waitMode = '';
            return false;
        }
        return waitMode.apply(this, arguments);
    };
    function styleTrap(event, rect) {
        if (event._spikePanelStyled) return;
        // The native floor cells occupy x=44..438, y=136..440 of a 480px cell.
        // Match that visible footprint to the exact native damage rectangle.
        var sx = rect.w * 48 / 394, sy = rect.h * 48 / 304;
        event.setOrigin(0, 0);
        event.setScale(sx * 100, sy * 100);
        event.shiftPosition(-36 - 44 * sx, -54 - 136 * sy);
        event._spikePanelStyled = true;
    }
    function trapCell(phase) {
        if (phase < 140 || phase >= 237) return 6;
        if (phase < 149) return 5 - Math.floor((phase - 140) / 3);
        if (phase < 219) return 3;
        return 4 + Math.floor((phase - 219) / 6);
    }
    api.update = function(interpreter) {
        var cfg = config();
        if (!cfg) return;
        var s = state(), complete = $gameVariables.value(cfg.variable) >= 2;
        if (!complete) {
            $gameMap._scrollToX = 10.5;
            $gameMap._scrollToY = 19;
            s.cameraHeld = true;
        } else api.releaseCamera();
        var sounded = false;
        for (var i = 0; i < s.traps.length; i++) {
            var event = $gameMap.event(s.traps[i]), rect = api.trapRect(event);
            styleTrap(event, rect);
            var phase = (s.clock + rect.phase) % CYCLE;
            var cell = complete ? 6 : rect.mode === 'wall' ? 3 : trapCell(phase);
            event._spikeFloorActive = !complete && (rect.mode === 'wall' || (phase >= 140 && phase < 219));
            if (event._spikePanelCell !== cell) {
                event.startFrameAnimation([cell], 1, false);
                event._spikePanelCell = cell;
            }
            if (!complete && rect.mode === 'timed' && phase === 140 && !sounded) {
                event.playSe('Close3', 30, 150);
                event.playSe('Sword4', 40, 130);
                sounded = true;
            }
            // This is the same entry point used by Map050 event 7. No custom
            // hit tests, damage changes or return-position overrides.
            interpreter.command_updateSpikeFloor(event.eventId(), rect.x, rect.y, rect.w, rect.h);
        }
        if ($gamePlayer._spikeFloorDamageState) s.returning = true;
        var landed = s.returning && !$gamePlayer._spikeFloorDamageState &&
            !$gamePlayer.isJumping() && !$gamePlayer.isMoving();
        for (var j = 0; j < s.panels.length; j++) {
            var panel = $gameMap.event(s.panels[j]);
            // A native damage return is not a new deliberate panel entry.
            if (landed) panel._spikePanelHeld = inside($gamePlayer, api.panelRect(panel));
            else if (!s.returning && !inside($gamePlayer, api.panelRect(panel))) panel._spikePanelHeld = false;
        }
        if (landed) s.returning = false;
        if (!$gameMessage.isBusy() && !$gameMap.isEventRunning()) s.clock++;
    };
    var setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        api.releaseCamera();
        this._spikePanelRuntime = null;
        setup.apply(this, arguments);
    };
})();
