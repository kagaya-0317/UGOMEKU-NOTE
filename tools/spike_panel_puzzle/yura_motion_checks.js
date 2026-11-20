// Isolate spike silhouettes in the native renderer and measure actual tip motion.
(function() {
    var floor = SceneManager._scene._spriteset._spikePanelFloor;
    var cell = [3,4,5].indexOf(window.__yuraProbeCell) >= 0 ? window.__yuraProbeCell : 3;
    var tipY = cell === 3 ? 6 : cell === 4 ? 18 : 30;
    var bitmap = new Bitmap(floor.bitmap.width, floor.bitmap.height), placements = [];
    floor._regions.forEach(function(region) { region.spikes.forEach(function(p) {
        bitmap._context.drawImage(floor._spikes[cell][0], p.x, p.y); placements.push(p);
    }); });
    bitmap._setDirty(); bitmap.checkDirty();
    var probe = new Sprite(bitmap);
    probe.x = floor.x; probe.y = floor.y;
    probe._yuraFilterArea = new PIXI.Rectangle(0, 0, Graphics.width, Graphics.height);
    probe._yuraFilterOffset = floor._yuraFilterOffset ? floor._yuraFilterOffset.slice() : [0, 0];
    probe.setYuraFilterZXC(floor._yuraFilterInfo);
    var texture = PIXI.RenderTexture.create(Graphics.width, Graphics.height);
    var filter = probe._yuraFilterZXC, step = floor._yuraFilterZXC.uniforms.stepCount;
    var samples = placements.map(function(p) {
        return { x: Math.round(floor.x + p.x + 18), y: Math.round(floor.y + p.y + tipY - 2), hashes: {}, alpha: 0 };
    }).filter(function(p) { return p.x >= 2 && p.y >= 2 && p.x + 12 < Graphics.width - 2 && p.y + 18 < Graphics.height - 2; });
    try {
        for (var phase = 0; phase < 16; phase++) {
            filter.uniforms.stepCount = step + phase;
            Graphics._renderer.render(probe, texture);
            var canvas = Graphics._renderer.extract.canvas(texture);
            var data = canvas.getContext('2d').getImageData(0, 0, Graphics.width, Graphics.height).data;
            samples.forEach(function(p) {
                var hash = 2166136261, alpha = 0;
                for (var y = p.y; y < p.y + 18; y++) for (var x = p.x; x < p.x + 12; x++) {
                    var value = data[(y * Graphics.width + x) * 4 + 3];
                    hash = Math.imul(hash ^ value, 16777619); alpha += value;
                }
                p.hashes[hash >>> 0] = true; p.alpha = Math.max(p.alpha, alpha);
            });
        }
        return {
            cell: cell,
            maxShake: floor._yuraFilterInfo.maxShake,
            effectiveMaximumPixels: floor._yuraFilterInfo.maxShake / 5,
            samples: samples.length,
            emptySamples: samples.filter(function(p) { return p.alpha === 0; }).length,
            staticTips: samples.filter(function(p) { return Object.keys(p.hashes).length === 1; }).length,
            minimumDistinctTipPoses: Math.min.apply(null, samples.map(function(p) { return Object.keys(p.hashes).length; })),
            distinctPoses: samples.map(function(p) { return Object.keys(p.hashes).length; })
        };
    } finally {
        probe.clearYuraFilterZXC(); if (filter.destroy) filter.destroy(); probe.destroy(); texture.destroy(true);
        if (bitmap.destroy) bitmap.destroy(); else if (bitmap._baseTexture) bitmap._baseTexture.destroy();
    }
})();
