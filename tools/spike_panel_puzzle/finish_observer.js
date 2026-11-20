// QA only: observe the real final-panel transition after native canvas renders.
(function() {
    var qa = window.__spikeFinishQA = { before: null, frames: [], savedMidRetraction: null };
    var render = Graphics.render;
    Graphics.render = function(stage) {
        var rendered = this._skipCount === 0;
        render.apply(this, arguments);
        if (!rendered || !window.$gameMap || $gameMap.mapId() !== 61 || !SceneManager._sceneStarted) return;
        var status = KNH_SpikePanel.status(), runtime = $gameMap._spikePanelRuntime;
        if (!status || !runtime) return;
        if (!status.complete && status.on.length !== 7) return;
        var row = { frame: Graphics.frameCount, seconds: window.__puzzleRecording ? (performance.now() - __puzzleRecording.started) / 1000 : null,
            complete: status.complete, retracting: status.retracting, elapsed: runtime.retraction ? runtime.retraction.elapsed : null,
            cells: runtime.traps.map(function(id) { return [id, $gameMap.event(id)._spikePanelCell]; }),
            active: runtime.traps.filter(function(id) { return $gameMap.event(id)._spikeFloorActive; }).length,
            camera: [$gameMap._scrollToX, $gameMap._scrollToY], cameraHeld: runtime.cameraHeld };
        if (!status.complete) { qa.before = row; return; }
        if (qa.frames.length < 240) qa.frames.push(row);
        if (!qa.savedMidRetraction && status.retracting && runtime.retraction.elapsed >= 6) {
            qa.savedElapsed = runtime.retraction.elapsed;
            qa.savedMidRetraction = JsonEx.stringify(DataManager.makeSaveContents());
        }
    };
    return true;
})();
