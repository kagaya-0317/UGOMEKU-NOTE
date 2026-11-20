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
        if (event._spikePanelStyled === 3 && event.isTransparent() && event._noYura) return;
        // Events own the native hazard rectangles; a shared floor surface owns
        // their artwork. Never squeeze the 480px sheet into individual patches.
        event.setScale(100, 100);
        event.setTransparent(true);
        event._noYura = true;
        event._yuraInfo = null;
        event._yurayura = false;
        event._spikePanelStyled = 3;
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
        this._textureScale = 1;
        this._patterns = null;
        this._lastSurface = '';
        this.z = 1;
        this.bitmap = new Bitmap($gameMap.width() * 48, $gameMap.height() * 48);
        this.setYuraFilterZXC({ blockSize: 12, maxShake: 1, pixelSnap: true });
        this._yuraFilterArea = new PIXI.Rectangle(0, 0, Graphics.width, Graphics.height);
    };
    Sprite_SpikePanelFloor.prototype.makePatterns = function() {
        var ctx = this.bitmap._context, source = this._source._canvas;
        this._patterns = {}; this._spikes = {};
        var width = 352 * this._textureScale, height = 256 * this._textureScale;
        for (var raised = 0; raised < 2; raised++) {
            var tile = document.createElement('canvas');
            tile.width = width * 2; tile.height = height;
            var tc = tile.getContext('2d'); tc.imageSmoothingEnabled = false;
            // The retracted 1F cell supplies the floor hatching, without spikes
            // that could be cut by a pattern seam or a region boundary.
            tc.drawImage(source, 60, 1120, 352, 256, 0, 0, width, height);
            tc.save(); tc.translate(tile.width, 0); tc.scale(-1, 1);
            tc.drawImage(source, 60, 1120, 352, 256, 0, 0, width, height); tc.restore();
            if (raised) {
                var hatch = tc.getImageData(0, 0, tile.width, tile.height);
                for (var p = 0; p < hatch.data.length; p += 4) {
                    var white = hatch.data[p] > 160;
                    hatch.data[p] = white ? 71 : 255;
                    hatch.data[p + 1] = white ? 78 : 255;
                    hatch.data[p + 2] = white ? 81 : 255;
                }
                tc.putImageData(hatch, 0, 0);
            }
            var pattern = ctx.createPattern(tile, 'repeat');
            this._patterns[raised ? 3 : 5] = pattern;
            this._patterns[raised ? 4 : 6] = pattern;
        }
        // One complete 1F spike, including its point and the closed base. The
        // source pixels remain 1x; only the surrounding floor is alpha-trimmed.
        var outline = [[24,7],[28,16],[29,23],[34,31],[38,37],[38,43],
            [34,49],[29,53],[18,53],[12,49],[9,43],[9,36],[14,28],[19,21],[20,14]];
        var bounds = { x: 48, y: 72, right: 0, bottom: 0 };
        for (var cell = 3; cell <= 5; cell++) {
            var spike = document.createElement('canvas'); spike.width = 48; spike.height = 72;
            var sc = spike.getContext('2d'), top = cell === 3 ? 7 : cell === 4 ? 19 : 31;
            sc.beginPath();
            outline.forEach(function(p, i) {
                var y = top + (p[1] - 7) * (53 - top) / 46;
                if (i === 0) sc.moveTo(p[0], y); else sc.lineTo(p[0], y);
            });
            sc.closePath(); sc.clip();
            sc.drawImage(source, cell % 3 * 480 + 94, Math.floor(cell / 3) * 480 + 184,
                48, 72, 0, 0, 48, 72);
            var mirror = document.createElement('canvas'); mirror.width = 48; mirror.height = 72;
            var mc = mirror.getContext('2d'); mc.translate(48, 0); mc.scale(-1, 1); mc.drawImage(spike, 0, 0);
            this._spikes[cell] = [spike, mirror];
            this._spikes[cell].forEach(function(image) {
                var pixels = image.getContext('2d').getImageData(0, 0, 48, 72).data;
                for (var y = 0; y < 72; y++) for (var x = 0; x < 48; x++) {
                    if (!pixels[(y * 48 + x) * 4 + 3]) continue;
                    bounds.x = Math.min(bounds.x, x); bounds.y = Math.min(bounds.y, y);
                    bounds.right = Math.max(bounds.right, x + 1); bounds.bottom = Math.max(bounds.bottom, y + 1);
                }
            });
        }
        bounds.w = bounds.right - bounds.x; bounds.h = bounds.bottom - bounds.y;
        this._spikeBounds = bounds;
    };
    Sprite_SpikePanelFloor.prototype.fitSpikes = function(cells) {
        var seen = {}, placements = [], bounds = this._spikeBounds;
        function contains(component, x, y, w, h) {
            var x0 = Math.floor((x - 12) / 24), y0 = Math.floor((y - 30) / 24);
            var x1 = Math.floor((x + w - 0.001 - 12) / 24), y1 = Math.floor((y + h - 0.001 - 30) / 24);
            for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
                if (!component[xx + ',' + yy]) return false;
            }
            return true;
        }
        Object.keys(cells).forEach(function(first) {
            if (seen[first]) return;
            var queue = [first], component = {}, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            seen[first] = true;
            for (var i = 0; i < queue.length; i++) {
                var p = queue[i].split(',').map(Number), x = p[0], y = p[1];
                component[queue[i]] = true;
                x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
                [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(function(n) {
                    var key = n.join(',');
                    if (cells[key] && !seen[key]) { seen[key] = true; queue.push(key); }
                });
            }
            var left = x0 * 24 + 12, top = y0 * 24 + 30, right = x1 * 24 + 12, bottom = y1 * 24 + 30;
            // The 1F artwork has staggered rows at 48x24px. Pack complete
            // drawings up to both ends instead of centering a sparse lattice.
            var roomY = bottom - top - 2 - bounds.h;
            if (roomY < 0) return;
            var rows = Math.ceil(roomY / 24) + 1;
            var pitchY = rows > 1 ? roomY / (rows - 1) : 0;
            var startY = top + 1;
            for (var row = 0; row < rows; row++) {
                var py = Math.round(startY + row * pitchY), run = null;
                function finish(end) {
                    if (run == null) return;
                    var roomX = end - run;
                    var count = Math.min(Math.ceil(roomX / 48) + 1, Math.floor(roomX / 24) + 1);
                    // Alternating rows fill the gaps without dropping narrow
                    // rows. End spikes stay beside the real floor silhouette.
                    if (row % 2 && roomX / count >= 24) count++;
                    var pitchX = count > 1 ? roomX / (count - 1) : 0;
                    var start = count > 1 ? run : row % 2 ? end : run;
                    for (var col = 0; col < count; col++) placements.push({
                        x: Math.round(start + col * pitchX) - bounds.x,
                        y: py - bounds.y, flip: (row + col) % 2
                    });
                    run = null;
                }
                var maxX = Math.floor(right - bounds.w - 1);
                for (var px = Math.ceil(left + 1); px <= maxX; px++) {
                    if (contains(component, px - 1, py - 1, bounds.w + 2, bounds.h + 2)) {
                        if (run == null) run = px;
                    } else finish(px - 1);
                }
                finish(maxX);
            }
        });
        return placements;
    };
    Sprite_SpikePanelFloor.prototype.makeRegions = function(rects, geometryKey) {
        var groups = {}, order = [];
        rects.forEach(function(r, index) {
            // Always-raised rectangles are one surface, not separate plates.
            // Each independently timed crossing is a real floor section.
            var key = r.mode === 'wall' ? 'wall' : 'crossing-' + index;
            var group = groups[key];
            if (!group) { group = groups[key] = { cells: {}, index: index }; order.push(group); }
            var x0 = Math.round((r.x + 0.25) * 2), y0 = Math.round((r.y + 0.25) * 2);
            for (var y = y0; y < y0 + Math.round(r.h * 2); y++) {
                for (var x = x0; x < x0 + Math.round(r.w * 2); x++) group.cells[x + ',' + y] = true;
            }
        });
        var surface = this;
        order.forEach(function(group) {
            var cells = group.cells, edges = [], starts = {};
            function edge(x, y, nx, ny, direction) {
                var e = { x: x, y: y, nx: nx, ny: ny, direction: direction, used: false };
                edges.push(e);
                var key = x + ',' + y;
                (starts[key] || (starts[key] = [])).push(e);
            }
            Object.keys(cells).forEach(function(key) {
                var p = key.split(',').map(Number), x = p[0], y = p[1];
                if (!cells[x + ',' + (y - 1)]) edge(x, y, x + 1, y, 0);
                if (!cells[(x + 1) + ',' + y]) edge(x + 1, y, x + 1, y + 1, 1);
                if (!cells[x + ',' + (y + 1)]) edge(x + 1, y + 1, x, y + 1, 2);
                if (!cells[(x - 1) + ',' + y]) edge(x, y + 1, x, y, 3);
            });
            group.contours = [];
            edges.forEach(function(first) {
                if (first.used) return;
                var e = first, points = [], guard = 0;
                while (e && !e.used && guard++ <= edges.length) {
                    e.used = true; points.push({ x: e.x, y: e.y });
                    if (e.nx === first.x && e.ny === first.y) break;
                    var choices = starts[e.nx + ',' + e.ny] || [], next = null, rank = 5;
                    choices.forEach(function(candidate) {
                        if (candidate.used) return;
                        var turn = (candidate.direction - e.direction + 4) % 4;
                        var value = [1, 0, 3, 2].indexOf(turn);
                        if (value < rank) { rank = value; next = candidate; }
                    });
                    e = next;
                }
                if (points.length < 3) return;
                var simple = points.filter(function(p, i) {
                    var prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
                    return !((prev.x === p.x && p.x === next.x) || (prev.y === p.y && p.y === next.y));
                });
                group.contours.push(simple.map(function(p) { return { x: p.x * 24 + 12, y: p.y * 24 + 30 }; }));
            });
            group.spikes = surface.fitSpikes(cells);
        });
        this._regions = order;
        this._regionGeometry = geometryKey;
    };
    Sprite_SpikePanelFloor.prototype.regionPath = function(ctx, group) {
        ctx.beginPath();
        group.contours.forEach(function(points) {
            points.forEach(function(p, i) {
                var prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
                var before = Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
                var after = Math.sqrt(Math.pow(next.x - p.x, 2) + Math.pow(next.y - p.y, 2));
                var radius = Math.min(3, before / 2, after / 2);
                var bx = p.x + (prev.x - p.x) * radius / before, by = p.y + (prev.y - p.y) * radius / before;
                var ax = p.x + (next.x - p.x) * radius / after, ay = p.y + (next.y - p.y) * radius / after;
                if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
                ctx.quadraticCurveTo(p.x, p.y, ax, ay);
            });
            ctx.closePath();
        });
    };
    Sprite_SpikePanelFloor.prototype.redraw = function() {
        var s = state(), rects = [], keys = [], geometry = [];
        for (var i = 0; i < s.traps.length; i++) {
            var e = $gameMap.event(s.traps[i]), r = api.trapRect(e);
            r.cell = e._spikePanelCell == null ? 6 : e._spikePanelCell;
            rects.push(r);
            geometry.push([r.x, r.y, r.w, r.h, r.mode].join(','));
            keys.push(r.cell);
        }
        var edgeKey = geometry.join(';'), key = edgeKey + '/' + keys.join(',');
        if (key === this._lastSurface) return;
        this._lastSurface = key;
        if (this._regionGeometry !== edgeKey) this.makeRegions(rects, edgeKey);
        var ctx = this.bitmap._context, width = this.bitmap.width, height = this.bitmap.height;
        ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
        for (var regionIndex = 0; regionIndex < this._regions.length; regionIndex++) {
            var region = this._regions[regionIndex], cell = rects[region.index].cell;
            ctx.save(); this.regionPath(ctx, region); ctx.clip();
            ctx.fillStyle = this._patterns[cell]; ctx.fillRect(0, 0, width, height);
            ctx.restore();
            if (cell !== 6) {
                // Deliberately outside the clipping context: complete source
                // spikes are fitted inside the floor, never cropped to fit it.
                for (var spikeIndex = 0; spikeIndex < region.spikes.length; spikeIndex++) {
                    var placement = region.spikes[spikeIndex];
                    ctx.drawImage(this._spikes[cell][placement.flip], placement.x, placement.y);
                }
            }
        }
        // This line is the floor artwork's own silhouette, not an added cover
        // or frame. It follows real regions and has no internal rectangle seams.
        ctx.strokeStyle = '#474e51'; ctx.lineWidth = 1.5;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (var edgeIndex = 0; edgeIndex < this._regions.length; edgeIndex++) {
            this.regionPath(ctx, this._regions[edgeIndex]); ctx.stroke();
        }
        // Existing safe islands remain above the floor surface.
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
        this._spikes = null;
        this._regions = null;
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
