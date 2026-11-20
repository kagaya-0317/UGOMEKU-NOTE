// Runs in the native QA engine. Compare actual floor pixels across all poses.
(function() {
    var floor = SceneManager._scene._spriteset._spikePanelFloor;
    var sample = document.createElement('canvas'); sample.width = 264; sample.height = 248;
    var ctx = sample.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = floor._patterns[6]; ctx.fillRect(0, 0, sample.width, sample.height);
    var actual = ctx.getImageData(0, 0, 264, 248).data;
    var native = floor._source._canvas.getContext('2d').getImageData(60, 1120, 264, 248).data;
    var sourceDifferences = 0, downLeft = 0, downRight = 0;
    for (var p = 0; p < actual.length; p++) if (actual[p] !== native[p]) sourceDifferences++;
    for (var y = 0; y < 246; y++) for (var x = 2; x < 262; x++) {
        var value = actual[(y * 264 + x) * 4];
        downLeft += Math.abs(value - actual[((y + 2) * 264 + x - 2) * 4]);
        downRight += Math.abs(value - actual[((y + 2) * 264 + x + 2) * 4]);
    }
    var mask = document.createElement('canvas'); mask.width = floor.bitmap.width; mask.height = floor.bitmap.height;
    var mc = mask.getContext('2d');
    floor._regions.forEach(function(region) {
        region.spikes.forEach(function(placement) {
            for (var cell = 3; cell <= 5; cell++) mc.drawImage(floor._spikes[cell][0], placement.x, placement.y);
        });
    });
    var pixels = mc.getImageData(0, 0, mask.width, mask.height).data;
    var traps = $gameMap._events.filter(function(e) { return e && e.event().meta.spikePanelTrap; });
    var saved = traps.map(function(e) { return e._spikePanelCell; }), poses = [];
    var floorCtx = floor.bitmap._context;
    try {
        traps.forEach(function(e) { e._spikePanelCell = 6; }); floor.redraw();
        var flat = floorCtx.getImageData(0, 0, mask.width, mask.height).data;
        for (var cell = 3; cell <= 5; cell++) {
            traps.forEach(function(e) { e._spikePanelCell = cell; }); floor.redraw();
            var raised = floorCtx.getImageData(0, 0, mask.width, mask.height).data;
            var changedOutsideSpikes = 0, changedInsideSpikes = 0;
            for (var p = 0; p < raised.length; p += 4) {
                var changed = false;
                for (var channel = 0; channel < 4; channel++) if (raised[p + channel] !== flat[p + channel]) changed = true;
                if (!changed) continue;
                if (pixels[p + 3]) changedInsideSpikes++; else changedOutsideSpikes++;
            }
            poses.push({ cell: cell, changedOutsideSpikes: changedOutsideSpikes, changedInsideSpikes: changedInsideSpikes });
        }
    } finally {
        traps.forEach(function(e, i) { e._spikePanelCell = saved[i]; }); floor.redraw();
    }
    return {
        sourceDifferences: sourceDifferences,
        comparedSourceChannels: actual.length,
        downLeftDifference: downLeft,
        downRightDifference: downRight,
        identicalFloorMaterial: [3,4,5,6].every(function(cell) { return floor._patterns[cell] === floor._patterns[6]; }),
        poses: poses
    };
})();
