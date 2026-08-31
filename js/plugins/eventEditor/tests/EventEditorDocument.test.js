'use strict';

var assert = require('assert');
var documentApi = require('../KNH_ZXC_EventEditor_Document.js');

function command(code) {
    return { code: code, indent: 0, parameters: [] };
}

function page(list) {
    return { conditions: {}, list: list || [command(0)] };
}

(function testEventPageRebase() {
    var result = documentApi.rebaseEventTracks({
        eventId: 10,
        tracks: {
            '10:0': { eventId: 10, pageIndex: 0, name: 'first' },
            '10:1': { eventId: 10, pageIndex: 1, name: 'second' },
            '99:0': { eventId: 99, pageIndex: 0, name: 'other' }
        },
        dirty: { '10:0': true, '99:0': true, orphan: true },
        pageTokens: ['orig:1', 'new:1', 'orig:0'],
        selectedOldPage: 0,
        fallbackPage: 1
    });
    assert.deepStrictEqual(Object.keys(result.tracks).sort(), ['10:0', '10:2', '99:0']);
    assert.strictEqual(result.tracks['10:0'].name, 'second');
    assert.strictEqual(result.tracks['10:0'].pageIndex, 0);
    assert.strictEqual(result.tracks['10:2'].name, 'first');
    assert.strictEqual(result.tracks['10:2'].pageIndex, 2);
    assert.strictEqual(result.dirty['10:2'], true);
    assert.strictEqual(result.dirty['99:0'], true);
    assert.strictEqual(result.dirty.orphan, true);
    assert.strictEqual(result.selectedNewPage, 2);
})();

(function testDeletedSelectedPageUsesFallback() {
    var result = documentApi.rebaseEventTracks({
        eventId: 5,
        tracks: { '5:0': { eventId: 5, pageIndex: 0 }, '5:1': { eventId: 5, pageIndex: 1 } },
        dirty: {},
        pageTokens: ['orig:1'],
        selectedOldPage: 0,
        fallbackPage: 8
    });
    assert.strictEqual(result.selectedNewPage, 0);
    assert.ok(result.tracks['5:0']);
    assert.strictEqual(result.tracks['5:1'], undefined);
})();

(function testMapMergePreservesLatestDiskChanges() {
    var latest = {
        displayName: 'changed outside editor',
        events: [null,
            { id: 1, name: 'latest event', pages: [page([command(1), command(0)])] },
            { id: 2, name: 'old event', pages: [page()] }
        ]
    };
    var currentEvents = [null,
        { id: 1, name: 'stale memory', pages: [page()] },
        {
            id: 2,
            name: 'edited event',
            note: '<x>',
            meta: { x: true },
            metaArray: { persistent: ['a', 'b'] },
            pages: [page()]
        }
    ];
    var merged = documentApi.mergeLatestDocument({
        battle: false,
        latestDocument: latest,
        documentDirty: { events: { 2: true }, troops: {} },
        currentEvents: currentEvents,
        tracks: { '1:0': { eventId: 1, pageIndex: 0 } },
        trackKeys: ['1:0'],
        preparedLists: { '1:0': [command(99), command(0)] }
    });
    assert.strictEqual(merged.displayName, 'changed outside editor');
    assert.strictEqual(merged.events[1].name, 'latest event');
    assert.strictEqual(merged.events[1].pages[0].list[0].code, 99);
    assert.strictEqual(merged.events[2].name, 'edited event');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(merged.events[2], 'meta'), false);
    assert.deepStrictEqual(merged.events[2].metaArray, { persistent: ['a', 'b'] });
    assert.strictEqual(latest.events[1].pages[0].list[0].code, 1);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(currentEvents[2], 'meta'), true);
})();

(function testMapDocumentCreateAndDelete() {
    var latest = {
        events: [null,
            { id: 1, name: 'keep', pages: [page()] },
            { id: 2, name: 'delete me', pages: [page()] }
        ]
    };
    var currentEvents = [null,
        { id: 1, name: 'stale memory', pages: [page()] },
        null,
        { id: 3, name: 'created', meta: { runtime: true }, pages: [page()] }
    ];
    var merged = documentApi.mergeLatestDocument({
        battle: false,
        latestDocument: latest,
        documentDirty: { events: { 2: true, 3: true }, troops: {} },
        currentEvents: currentEvents
    });
    assert.strictEqual(merged.events[1].name, 'keep');
    assert.strictEqual(merged.events[2], null);
    assert.strictEqual(merged.events[3].name, 'created');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(merged.events[3], 'meta'), false);
})();

(function testBattleMergeAndMissingPageGuard() {
    var latest = [null, { id: 1, name: 'latest troop', pages: [page()] }];
    var current = [null, { id: 1, name: 'edited troop', meta: {}, pages: [page()] }];
    var merged = documentApi.mergeLatestDocument({
        battle: true,
        latestDocument: latest,
        documentDirty: { events: {}, troops: { 1: true } },
        currentTroops: current,
        tracks: { '1:0': { eventId: 1, pageIndex: 0 } },
        trackKeys: ['1:0'],
        preparedLists: { '1:0': [command(88), command(0)] }
    });
    assert.strictEqual(merged[1].name, 'edited troop');
    assert.strictEqual(merged[1].pages[0].list[0].code, 88);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(merged[1], 'meta'), false);

    assert.throws(function() {
        documentApi.mergeLatestDocument({
            battle: false,
            latestDocument: { events: [null, { id: 1, pages: [] }] },
            tracks: { '1:3': { eventId: 1, pageIndex: 3 } },
            trackKeys: ['1:3'],
            preparedLists: { '1:3': [command(0)] }
        });
    }, /save target page not found/);
})();

console.log('EventEditorDocument tests: OK');
