'use strict';

var assert = require('assert');
var modelApi = require('../KNH_ZXC_EventEditor_Model.js');

var first = { uid: 1, frame: 2 };
var second = { uid: 2, frame: 8 };
var tracks = {
    '1:0': { commands: [first] },
    '2:0': { commands: [second] }
};
var full = modelApi.rebuildSchedule({ tracks: tracks });
assert.deepStrictEqual(full.schedule[2], [first]);
assert.deepStrictEqual(full.schedule[8], [second]);
var untouchedContribution = full.byTrack['2:0'];

first.frame = 5;
var incremental = modelApi.rebuildSchedule({
    tracks: tracks,
    schedule: full.schedule,
    byTrack: full.byTrack,
    changedTrackKeys: ['1:0']
});
assert.strictEqual(incremental.schedule[2], undefined);
assert.deepStrictEqual(incremental.schedule[5], [first]);
assert.deepStrictEqual(incremental.schedule[8], [second]);
assert.strictEqual(incremental.byTrack['2:0'], untouchedContribution);

var cache = {};
var snap1 = modelApi.snapshotModel({ nextUid: 3, tracks: tracks }, cache);
var snap2 = modelApi.snapshotModel({ nextUid: 3, tracks: tracks }, snap1.cache);
assert.strictEqual(snap1.model.tracks['1:0'], snap2.model.tracks['1:0']);
assert.strictEqual(snap1.model.tracks['2:0'], snap2.model.tracks['2:0']);
second.frame = 9;
var snap3 = modelApi.snapshotModel({ nextUid: 3, tracks: tracks }, snap2.cache);
assert.strictEqual(snap2.model.tracks['1:0'], snap3.model.tracks['1:0']);
assert.notStrictEqual(snap2.model.tracks['2:0'], snap3.model.tracks['2:0']);

delete tracks['1:0'];
var afterDelete = modelApi.rebuildSchedule({
    tracks: tracks,
    schedule: incremental.schedule,
    byTrack: incremental.byTrack,
    changedTrackKeys: ['1:0']
});
assert.strictEqual(afterDelete.schedule[5], undefined);
assert.strictEqual(afterDelete.byTrack['1:0'], undefined);
var snap4 = modelApi.snapshotModel({ nextUid: 3, tracks: tracks }, snap3.cache);
assert.strictEqual(Object.prototype.hasOwnProperty.call(snap4.cache, '1:0'), false);

(function testCanonicalTrackOrdering() {
    var waitingLong = { uid: 1, executionOrder: 30, frame: 4, wait: 60 };
    var waitingShort = { uid: 2, executionOrder: 20, frame: 4, wait: 15 };
    var immediate = { uid: 3, executionOrder: 10, frame: 4, wait: 0 };
    var earlier = { uid: 4, frame: 1, wait: 30 };
    var track = { commands: [waitingShort, immediate, waitingLong, earlier] };
    modelApi.sortTrackCommands(track);
    assert.deepStrictEqual(track.commands, [earlier, immediate, waitingShort, waitingLong]);
})();

(function testExecutionOrderKeepsAlternatingSameFrameCommands() {
    var routeA = { uid: 10, executionOrder: 1, frame: 8, wait: 0, command: { code: 205 } };
    var messageA = { uid: 11, executionOrder: 2, frame: 8, wait: 0, command: { code: 101 } };
    var routeB = { uid: 12, executionOrder: 3, frame: 8, wait: 0, command: { code: 205 } };
    var messageB = { uid: 13, executionOrder: 4, frame: 8, wait: 0, command: { code: 101 } };
    var track = { commands: [messageB, routeB, messageA, routeA] };
    modelApi.sortTrackCommands(track);
    assert.deepStrictEqual(track.commands, [routeA, messageA, routeB, messageB]);
})();

(function testEquivalentHistoryRefreshesUiState() {
    var undo = [{ content: 'same', selUid: 10, frame: 2 }];
    var redo = [{ content: 'future' }];
    var current = { content: 'same', selUid: 20, frame: 8 };
    var pushed = modelApi.pushHistorySnapshot({
        undo: undo,
        redo: redo,
        snapshot: current,
        equals: function(a, b) { return a.content === b.content; },
        limit: 80
    });
    assert.strictEqual(pushed, false);
    assert.strictEqual(undo.length, 1);
    assert.strictEqual(undo[0], current);
    assert.strictEqual(undo[0].selUid, 20);
    assert.strictEqual(redo.length, 0);
})();

(function testHistoryLimit() {
    var undo = [{ id: 1 }, { id: 2 }];
    var redo = [];
    modelApi.pushHistorySnapshot({
        undo: undo,
        redo: redo,
        snapshot: { id: 3 },
        equals: function(a, b) { return a.id === b.id; },
        limit: 2
    });
    assert.deepStrictEqual(undo, [{ id: 2 }, { id: 3 }]);
})();

console.log('Event editor model: OK');
