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
        if (event._spikePanelStyled === 2 && event.isTransparent() && event._noYura) return;
        // Events own the native hazard rectangles; a shared floor surface owns
        // their artwork. Never squeeze the 480px sheet into individual patches.
        event.setScale(200, 200);
        event.setTransparent(true);
        event._noYura = true;
        event._yuraInfo = null;
        event._yurayura = false;
        event._spikePanelStyled = 2;
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

    // One connected surface, one world-aligned texture scale and one yura
    // filter. Internal event/rectangle edges never become artwork seams.
    function Sprite_SpikePanelFloor() { this.initialize.apply(this, arguments); }
    Sprite_SpikePanelFloor.prototype = Object.create(Sprite.prototype);
    Sprite_SpikePanelFloor.prototype.constructor = Sprite_SpikePanelFloor;
    Sprite_SpikePanelFloor.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this._mapId = $gameMap.mapId();
        this._source = ImageManager.loadCharacter('$trap');
        this._textureScale = 2;
        this._patterns = null;
        this._lastSurface = '';
        this.z = 1;
        this.bitmap = new Bitmap($gameMap.width() * 48, $gameMap.height() * 48);
        this.setYuraFilterZXC({ blockSize: 12, maxShake: 1, pixelSnap: true });
        this._yuraFilterArea = new PIXI.Rectangle(0, 0, Graphics.width, Graphics.height);
    };
    Sprite_SpikePanelFloor.prototype.makePatterns = function() {
        var ctx = this.bitmap._context, source = this._source._canvas;
        this._patterns = {};
        for (var cell = 3; cell <= 6; cell++) {
            // Interior only: the source sheet's outside frame must not repeat.
            // Mirror horizontally to join matching edge pixels, while keeping
            // the upright spike direction in every repeated row.
            var tile = document.createElement('canvas');
            tile.width = 1408; tile.height = 512;
            var tc = tile.getContext('2d'); tc.imageSmoothingEnabled = false;
            var sx = cell % 3 * 480 + 60, sy = Math.floor(cell / 3) * 480 + 160;
            tc.drawImage(source, sx, sy, 352, 256, 0, 0, 704, 512);
            tc.save(); tc.translate(1408, 0); tc.scale(-1, 1);
            tc.drawImage(source, sx, sy, 352, 256, 0, 0, 704, 512); tc.restore();
            this._patterns[cell] = ctx.createPattern(tile, 'repeat');
        }
    };
    Sprite_SpikePanelFloor.prototype.redraw = function() {
        var s = state(), rects = [], keys = [], geometry = [];
        for (var i = 0; i < s.traps.length; i++) {
            var e = $gameMap.event(s.traps[i]), r = api.trapRect(e);
            r.cell = e._spikePanelCell == null ? 6 : e._spikePanelCell;
            rects.push(r);
            geometry.push([r.x, r.y, r.w, r.h].join(','));
            keys.push(r.cell);
        }
        var edgeKey = geometry.join(';'), key = edgeKey + '/' + keys.join(',');
        if (key === this._lastSurface) return;
        this._lastSurface = key;
        var ctx = this.bitmap._context, width = this.bitmap.width, height = this.bitmap.height;
        ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
        for (var cell = 6; cell >= 3; cell--) {
            ctx.save(); ctx.beginPath(); var count = 0;
            rects.forEach(function(r) {
                if (r.cell === cell) {
                    ctx.rect(r.x * 48 + 24, r.y * 48 + 42, r.w * 48, r.h * 48); count++;
                }
            });
            if (count) { ctx.clip(); ctx.fillStyle = this._patterns[cell]; ctx.fillRect(0, 0, width, height); }
            ctx.restore();
        }
        // Only the eight real safe islands get a rim. Never outline the
        // rectangle decomposition, fence cutouts or half-step terrain cells.
        ctx.lineJoin = 'round';
        s.panels.forEach(function(id) {
            var r = api.panelRect($gameMap.event(id)), x = r.x * 48 + 24, y = r.y * 48 + 42;
            var w = r.w * 48, h = r.h * 48, b = 6;
            ctx.beginPath(); ctx.moveTo(x + b, y); ctx.lineTo(x + w - b, y);
            ctx.lineTo(x + w, y + b); ctx.lineTo(x + w, y + h - b);
            ctx.lineTo(x + w - b, y + h); ctx.lineTo(x + b, y + h);
            ctx.lineTo(x, y + h - b); ctx.lineTo(x, y + b); ctx.closePath();
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.strokeStyle = '#474e51'; ctx.lineWidth = 2; ctx.stroke();
            [[10,10],[w-10,10],[10,h-10],[w-10,h-10]].forEach(function(p) {
                ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 1.5, 0, Math.PI * 2); ctx.fillStyle = '#474e51'; ctx.fill();
            });
        });
        this.bitmap._setDirty(); this.bitmap.checkDirty();
    };
    Sprite_SpikePanelFloor.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this.visible = this._mapId === $gameMap.mapId() && !!config();
        if (!this.visible || !this._source.isReady()) return;
        if (!this._patterns) this.makePatterns();
        this.x = -$gameMap.displayX() * 48;
        this.y = -$gameMap.displayY() * 48;
        this.redraw();
    };
    Sprite_SpikePanelFloor.prototype.destroy = function(options) {
        this.clearYuraFilterZXC();
        this._patterns = null;
        if (this.bitmap) {
            if (this.bitmap.destroy) this.bitmap.destroy();
            else if (this.bitmap._baseTexture) this.bitmap._baseTexture.destroy();
            this.bitmap = null;
        }
        Sprite.prototype.destroy.call(this, options);
    };
    var createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        createLowerLayer.apply(this, arguments);
        if (config()) {
            this._spikePanelFloor = new Sprite_SpikePanelFloor();
            // ShaderTilemap's character sorting can put a large filtered sprite
            // over later character meshes. Keep the floor below that entire
            // layer, immediately after the parallax instead.
            this._baseSprite.addChildAt(this._spikePanelFloor,
                this._baseSprite.children.indexOf(this._tilemap));
        }
    };
    var updateCharacterSprite = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        var character = this._character;
        var data = character && typeof character.event === 'function' ? character.event() : null;
        if (data && data.meta && data.meta.spikePanelTrap) {
            // These events retain their real native hit behavior, but have no
            // separate visible bitmap/mesh. The connected surface draws them.
            this.visible = false;
            return;
        }
        updateCharacterSprite.apply(this, arguments);
    };
})();
