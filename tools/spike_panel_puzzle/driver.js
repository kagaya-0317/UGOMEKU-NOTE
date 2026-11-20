// QA/recording only: actual half-step walking, native panels and native hazards.
(function() {
    var d = window.__spikeDriver = { job: null, trace: [], autoMessage: true, pauseAt: 0 };
    var update = SceneManager.updateScene;
    SceneManager.updateScene = function() {
        var result = update.apply(this, arguments);
        tick();
        return result;
    };
    var triggered = Window_Message.prototype.isTriggered;
    Window_Message.prototype.isTriggered = function() {
        return (d.autoMessage && this.pause && performance.now() - d.pauseAt > 1250) ||
            triggered.apply(this, arguments);
    };
    function idle() {
        return SceneManager._scene instanceof Scene_Map && !SceneManager._nextScene &&
            !$gamePlayer.isTransferring() && !$gameMap.isEventRunning() &&
            !$gameMessage.isBusy() && !$gamePlayer.isMoving() && !$gamePlayer.isJumping() &&
            !$gamePlayer._spikeFloorDamageState;
    }
    function tick() {
        var mw = SceneManager._scene && SceneManager._scene._messageWindow;
        if (!mw || !mw.pause) d.pauseAt = performance.now();
        var j = d.job;
        if (!j) return;
        if (performance.now() - j.started > 30000) {
            d.job = null; j.reject(Error('Walking timeout ' + JSON.stringify(d.status()))); return;
        }
        if (!idle()) return;
        if ($gamePlayer.x === j.x && $gamePlayer.y === j.y) {
            if (++j.hold < 25) return;
            d.trace.push({ x: j.x, y: j.y, frame: Graphics.frameCount,
                panels: KNH_SpikePanel.status(), hp: $gameParty.leader().hp });
            d.job = null; j.resolve(true); return;
        }
        if (!j.begun && j.trap) {
            var r = KNH_SpikePanel.trapRect($gameMap.event(j.trap));
            var phase = (KNH_SpikePanel.status().clock + r.phase) % 255;
            var safeFrames = phase < 140 ? 140 - phase : phase >= 237 ? 255 - phase + 140 : 0;
            var distance = Math.abs(j.x - $gamePlayer.x) + Math.abs(j.y - $gamePlayer.y);
            if (safeFrames < distance / $gamePlayer.distancePerFrame() + 36) return;
        }
        j.begun = true;
        var dir;
        if (j.path) dir = j.path.shift();
        else dir = $gamePlayer.x < j.x ? 6 : $gamePlayer.x > j.x ? 4 : $gamePlayer.y < j.y ? 2 : 8;
        if (!dir || !$gamePlayer.canPass($gamePlayer.x, $gamePlayer.y, dir)) {
            d.job = null; j.reject(Error('Blocked walking step ' + JSON.stringify(d.status()))); return;
        }
        $gamePlayer.moveStraight(dir);
    }
    d.status = function() {
        return { map: $gameMap.mapId(), xy: [$gamePlayer.x, $gamePlayer.y],
            real: [$gamePlayer._realX, $gamePlayer._realY], moving: $gamePlayer.isMoving(),
            event: $gameMap._interpreter._eventId, busy: $gameMap.isEventRunning(),
            text: $gameMessage._texts, damage: $gamePlayer._spikeFloorDamageState,
            panels: KNH_SpikePanel.status(), body: document.body.innerText };
    };
    d.walk = function(x, y, trap, path) {
        if (d.job) return Promise.reject(Error('Walk already active'));
        return new Promise(function(resolve, reject) {
            d.job = { x: x, y: y, trap: trap || 0, path: path, hold: 0,
                started: performance.now(), resolve: resolve, reject: reject };
        });
    };
    d.route = function(x, y) {
        var original = $gameMap.events;
        $gameMap.events = function() { return this._events.filter(Boolean); };
        try {
            var start = [$gamePlayer.x, $gamePlayer.y], queue = [start], seen = {}, prev = {}, dirs = [8, 6, 2, 4];
            function key(x, y) { return Math.round(x * 2) + ',' + Math.round(y * 2); }
            var first = key(start[0], start[1]), last = key(x, y); seen[first] = true;
            for (var i = 0; i < queue.length && !seen[last]; i++) {
                var a = queue[i];
                dirs.forEach(function(dir) {
                    if (!$gamePlayer.canPass(a[0], a[1], dir)) return;
                    var nx = a[0] + (dir === 4 ? -.5 : dir === 6 ? .5 : 0);
                    var ny = a[1] + (dir === 8 ? -.5 : dir === 2 ? .5 : 0), k = key(nx, ny);
                    if (!seen[k]) { seen[k] = true; prev[k] = { at: key(a[0], a[1]), dir: dir }; queue.push([nx, ny]); }
                });
            }
            if (!seen[last]) throw Error('No walking route to ' + last);
            var path = [];
            for (var k = last; k !== first; k = prev[k].at) path.push(prev[k].dir);
            return path.reverse();
        } finally { $gameMap.events = original; }
    };
    d.go = function(x, y) { return d.walk(x, y, 0, d.route(x, y)); };
    return 'Native walking driver installed';
})();
