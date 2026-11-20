// Native-engine geometry and draw-order checks for the permanent trap footprint.
(function() {
    var floor = SceneManager._scene._spriteset._spikePanelFloor, boundary = floor._boundary;
    var cells = boundary.cells, expectedEdges = {}, actualEdges = {}, internalEdges = 0;
    function edgeKey(x, y, nx, ny) {
        var a = x + ',' + y, b = nx + ',' + ny;
        return a < b ? a + ':' + b : b + ':' + a;
    }
    Object.keys(cells).forEach(function(key) {
        var p = key.split(',').map(Number), x = p[0], y = p[1];
        [[x,y-1,x,y,x+1,y],[x+1,y,x+1,y,x+1,y+1],
            [x,y+1,x,y+1,x+1,y+1],[x-1,y,x,y,x,y+1]].forEach(function(n) {
            if (!cells[n[0] + ',' + n[1]]) expectedEdges[edgeKey(n[2],n[3],n[4],n[5])] = true;
        });
    });
    function edgesOf(contours, output) {
        contours.forEach(function(points) {
            points.forEach(function(p, i) {
                var next = points[(i + 1) % points.length];
                var x = (p.x - 12) / 24, y = (p.y - 30) / 24;
                var nx = (next.x - 12) / 24, ny = (next.y - 30) / 24;
                var dx = Math.sign(nx - x), dy = Math.sign(ny - y);
                for (var j = 0; j < Math.abs(nx - x) + Math.abs(ny - y); j++) {
                    output[edgeKey(x + dx*j, y + dy*j, x + dx*(j+1), y + dy*(j+1))] = true;
                }
            });
        });
    }
    edgesOf(boundary.contours, actualEdges);
    floor._regions.forEach(function(group) {
        var edges = {}; edgesOf(group.contours, edges);
        Object.keys(edges).forEach(function(key) { if (!expectedEdges[key]) internalEdges++; });
    });
    var missing = Object.keys(expectedEdges).filter(function(key) { return !actualEdges[key]; });
    var extra = Object.keys(actualEdges).filter(function(key) { return !expectedEdges[key]; });
    var ctx = floor.bitmap._context, originalBegin = ctx.beginPath, originalStroke = ctx.stroke;
    var originalDraw = ctx.drawImage, originalPath = floor.regionPath, tag = false, calls = [], widths = [], results = [];
    var traps = $gameMap._events.filter(function(e) { return e && e.event().meta.spikePanelTrap; });
    var saved = traps.map(function(e) { return e._spikePanelCell; });
    ctx.beginPath = function() { tag = false; return originalBegin.apply(this, arguments); };
    floor.regionPath = function(context, group) { originalPath.apply(this, arguments); tag = group === boundary; };
    ctx.stroke = function() { if (tag) { calls.push('boundary'); widths.push(this.lineWidth); } return originalStroke.apply(this, arguments); };
    ctx.drawImage = function(image) {
        if ([3,4,5].some(function(cell) { return image === floor._spikes[cell][0]; })) calls.push('spike');
        return originalDraw.apply(this, arguments);
    };
    try {
        [6,3,4,5].forEach(function(cell) {
            calls = []; widths = []; traps.forEach(function(e) { e._spikePanelCell = cell; });
            floor._lastSurface = ''; floor.redraw();
            results.push({ cell: cell, width: widths[0], boundaryDraws: calls.filter(function(c) { return c === 'boundary'; }).length,
                spikeDraws: calls.filter(function(c) { return c === 'spike'; }).length,
                behindSpikes: calls.indexOf('spike') < 0 || calls.indexOf('boundary') < calls.indexOf('spike') });
        });
    } finally {
        ctx.beginPath = originalBegin; ctx.stroke = originalStroke; ctx.drawImage = originalDraw; floor.regionPath = originalPath;
        traps.forEach(function(e, i) { e._spikePanelCell = saved[i]; }); floor._lastSurface = ''; floor.redraw();
    }
    return { unionCells: Object.keys(cells).length, contours: boundary.contours.length,
        expectedEdges: Object.keys(expectedEdges).length, actualEdges: Object.keys(actualEdges).length,
        missingEdges: missing.length, internalEdgesDrawn: extra.length,
        removedSectionInterfaceEdges: internalEdges, poses: results };
})();
