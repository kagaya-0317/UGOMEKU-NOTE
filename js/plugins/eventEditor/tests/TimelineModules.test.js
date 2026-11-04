'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var sandbox = {
    console: console,
    require: require,
    process: process,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.$dataMap = null;
sandbox.KNH_ZXC_EventEditor = { EE: function EE() {} };
[
    'beginTileMove', 'updateTileDrag',
    'playFrom', 'seek', 'pre', 'execAt', 'copy', 'cut', 'paste',
    'rebuildSchedule', 'save', 'snap', 'loadSnap'
].forEach(function(name) {
    sandbox.KNH_ZXC_EventEditor.EE.prototype[name] = function() {};
});
sandbox.Game_CharacterBase = function Game_CharacterBase() {};
sandbox.Game_CharacterBase.prototype.initMembers = function() {};
vm.createContext(sandbox);

var moduleFiles = [
    'KNH_ZXC_EventEditor_Document.js',
    'KNH_ZXC_EventEditor_Services.js',
    'KNH_ZXC_EventEditor_Model.js',
    'KNH_ZXC_EventEditor_Timeline_Shared.js',
    'KNH_ZXC_EventEditor_Style.js',
    'KNH_ZXC_EventEditor_Timeline_Core.js',
    'KNH_ZXC_EventEditor_RouteSchemas.js',
    'KNH_ZXC_EventEditor_Debug.js',
    'KNH_ZXC_EventEditor_Timeline_Schema.js',
    'KNH_ZXC_EventEditor_CommandSchemas.js',
    'KNH_ZXC_EventEditor_Timeline_Preview.js',
    'KNH_ZXC_EventEditor_Timeline_Branch.js',
    'KNH_ZXC_EventEditor_Timeline_Render.js',
    'KNH_ZXC_EventEditor_Timeline_Edit.js',
    'KNH_ZXC_EventEditor_Timeline_Canvas.js',
    'KNH_ZXC_EventEditor_Timeline_Input.js'
];
var root = path.resolve(__dirname, '..');
for (var i = 0; i < moduleFiles.length; i++) {
    var file = moduleFiles[i];
    var source = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
    vm.runInContext(source, sandbox, { filename: file });
}

var namespace = sandbox.KNH_ZXC_EventEditor;
var shared = namespace._eeTimelineShared;
assert.ok(namespace._eeDocument);
assert.ok(namespace._eeServices && namespace._eeServices.storage);
assert.ok(namespace._eeModel);
assert.ok(typeof namespace._eeStyleText === 'string' && namespace._eeStyleText.length > 1000);
assert.ok(namespace._eeStyleText.indexOf('.cv-overlay') >= 0);
assert.ok(shared && shared.ready);
assert.ok(shared.hasModules(['shared', 'core', 'route_schemas', 'debug', 'schema', 'command_schemas', 'preview', 'branch', 'render', 'edit', 'canvas', 'input']));
assert.strictEqual(typeof namespace.EE.prototype.save, 'function');
assert.strictEqual(typeof namespace.EE.prototype.drawTimeline, 'function');
assert.strictEqual(typeof namespace.EE.prototype.openEditorPromptDialog, 'function');
assert.strictEqual(shared.methodOwners.drawTimeline, 'canvas');
assert.strictEqual(shared.methodOwners.rebuildSchedule, 'input');
assert.strictEqual(shared.methodOwners.isCalcDebugEnabled, 'debug');
assert.strictEqual(shared.methodOwners.ensureRouteEditorSchemas, 'route_schemas');
assert.strictEqual(shared.methodOwners.ensureEditorSchemas, 'command_schemas');
assert.strictEqual(shared.methodOwners.computeIfBranchViewStateForTrack, 'branch');
assert.strictEqual(shared.methodOwners.copy, 'render');
assert.deepStrictEqual(Array.prototype.slice.call(shared.modules.preview.actualOverrides).sort(), [
    'beginTileMove', 'updateTileDrag'
]);

(function testFixedLabelColumnIsNotTimelineRulerInput() {
    var e = Object.create(namespace.EE.prototype);
    e.labelW = 185;
    e.rulerH = 28;
    e.th = 400;
    e.timelineWrap = { scrollLeft: 100, scrollTop: 0 };
    assert.strictEqual(e.isPointInTimelineFixedLabel(150), true);
    assert.strictEqual(e.isTimelineRulerPoint(150, 10, true), false);
    assert.strictEqual(e.isTimelineRulerPoint(150, 10, false), false);
    assert.strictEqual(e.isTimelineRulerPoint(300, 10, true), true);
})();

(function testBranchHighlightRemainsVisiblePastFixedLabel() {
    var e = Object.create(namespace.EE.prototype);
    var rule = {
        labelLeft: 200,
        labelRight: 350,
        rulerTop: 0,
        rulerBottom: 28,
        totalWidth: 1000,
        totalHeight: 400
    };
    var crossing = e.ifBranchShapeOverlayDecision({ x: 100, y: 40, w: 300, h: 40 }, rule);
    assert.strictEqual(crossing.overlap, true);
    assert.strictEqual(crossing.hide, false);
    var covered = e.ifBranchShapeOverlayDecision({ x: 100, y: 40, w: 250, h: 40 }, rule);
    assert.strictEqual(covered.hide, true);
})();

(function testBranchBoundaryTooltipKeepsOnlyItsName() {
    var e = Object.create(namespace.EE.prototype);
    var lines = e.commandTooltipLinesForHit({ branchBoundary: 'end', branchType: 'choice', frame: 929 });
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].text, '○選択肢分岐終了');
    assert.strictEqual(lines[0].color, e.choiceBranchHighlightFillColorForDepth(0));
    var nestedCondition = e.commandTooltipLinesForHit({
        branchBoundary: 'start',
        branchType: 'if',
        branchNestingDepth: 2
    });
    assert.strictEqual(nestedCondition[0].text, '○条件分岐開始');
    assert.strictEqual(nestedCondition[0].color, e.ifBranchHighlightFillColorForDepth(2));
})();

(function testBranchBoundaryColorIsKeptInFrameTooltipList() {
    var e = Object.create(namespace.EE.prototype);
    var choiceEnd = { uid: 10, rowKey: 'main', command: { code: 404, indent: 0, parameters: [] } };
    var conditionEnd = { uid: 20, rowKey: 'main', command: { code: 412, indent: 0, parameters: [] } };
    e.resolveBranchBoundaryContextForEntry = function(entry) {
        return Number(entry && entry.command && entry.command.code || 0) === 404
            ? { type: 'choice', nestingDepth: 0 }
            : { type: 'if', nestingDepth: 2 };
    };
    e.commandTooltipDetailText = function() { return ''; };
    var choiceLines = e.tooltipLinesForEntry(choiceEnd, '', {});
    var conditionLines = e.tooltipLinesForEntry(conditionEnd, '', {});
    assert.strictEqual(choiceLines[0].color, e.choiceBranchHighlightFillColorForDepth(0));
    assert.strictEqual(choiceLines[0].bulletColor, e.choiceBranchHighlightFillColorForDepth(0));
    assert.strictEqual(conditionLines[0].color, e.ifBranchHighlightFillColorForDepth(2));
    assert.strictEqual(conditionLines[0].bulletColor, e.ifBranchHighlightFillColorForDepth(2));
})();

(function testDecliningRecoveryDiscardsOnlyThatSnapshot() {
    var e = Object.create(namespace.EE.prototype);
    var clearCount = 0;
    e._recoverySnapshotDecision = '';
    e.clearRecoverySnapshot = function() {
        clearCount++;
        return true;
    };
    assert.strictEqual(e.discardRecoverySnapshot(), true);
    assert.strictEqual(clearCount, 1);
    assert.strictEqual(e._recoverySnapshotDecision, 'discarded');
})();

(function testRecoveryNormalizesTemporalBranchNestingBeforeRebuild() {
    var e = Object.create(namespace.EE.prototype);
    var repaired = [];
    e.repairTemporalBranchNesting = function(track) { repaired.push(track); return false; };
    e.rebuildSchedule = function() { assert.strictEqual(repaired.length, 2); };
    e.simTo = function() {};
    e.pushSnap = function() {};
    e.msg = function() {};
    e.undoS = [];
    e.redoS = [];
    var recovery = {
        model: { tracks: { a: { commands: [] }, b: { commands: [] } } },
        selection: { eventId: 1, pageIndex: 0, key: 'a', uid: 0, frame: 0 },
        documentEvents: {},
        documentTroops: {}
    };
    assert.strictEqual(e.applyRecoverySnapshot(recovery), true);
    assert.strictEqual(repaired.length, 2);
})();

(function testSameFrameExecutionOrderIsAlsoSaveOrder() {
    var routeA = { uid: 1, executionOrder: 1, frame: 20, wait: 0, command: { code: 205, indent: 0 } };
    var messageA = { uid: 2, executionOrder: 2, frame: 20, wait: 0, command: { code: 101, indent: 0 } };
    var routeB = { uid: 3, executionOrder: 3, frame: 20, wait: 0, command: { code: 205, indent: 0 } };
    var messageB = { uid: 4, executionOrder: 4, frame: 20, wait: 0, command: { code: 101, indent: 0 } };
    var saved = shared.commandsInSaveOrder({ commands: [messageB, routeB, messageA, routeA] });
    assert.deepStrictEqual(Array.prototype.map.call(saved, function(entry) { return entry.command.code; }), [205, 101, 205, 101]);
})();

(function testBranchBoundaryLanesAndMainOnlyHighlight() {
    var e = Object.create(namespace.EE.prototype);
    e.rulerH = 28;
    e.rowH = 36;
    e.mainLaneTop = 12;
    e.mainLaneGap = 12;
    e.frameToX = function(frame) { return 100 + Number(frame || 0) * 5; };
    var choice = {
        uid: 1, executionOrder: 1, frame: 0, rowType: 'main', rowKey: 'main',
        command: { code: 102, indent: 0, parameters: [['A', 'B'], -1, 0, 2, 0] }
    };
    var branchA = { uid: 2, executionOrder: 2, frame: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [0, 'A'] } };
    var messageA = { uid: 3, executionOrder: 3, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } };
    var branchB = { uid: 4, executionOrder: 4, frame: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [1, 'B'] } };
    var messageB = { uid: 5, executionOrder: 5, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } };
    var end = { uid: 6, executionOrder: 6, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 404, indent: 0, parameters: [] } };
    var route = { uid: 7, executionOrder: 7, frame: 10, rowType: 'char', rowKey: 'char:2', charId: 2, command: { code: 205, indent: 0, parameters: [2, { wait: false }] } };
    var track = { eventId: 1, pageIndex: 0, commands: [choice, branchA, messageA, branchB, messageB, end, route] };
    var hidden = { '2': true, '4': true, '5': true };
    var lanes = e.buildMainLaneMap(track, hidden);
    assert.strictEqual(lanes.laneByUid[1], 0);
    assert.strictEqual(lanes.branchStartLaneByUid[1], 1);
    assert.strictEqual(lanes.laneByUid[3], 0);
    assert.strictEqual(lanes.laneByUid[6], 1);
    assert.strictEqual(lanes.laneByUid[7], 2);
    assert.strictEqual(e.mainVisibleStackCountAtFrame(track, 0, hidden), 2);
    assert.strictEqual(e.mainVisibleStackCountAtFrame(track, 10, hidden), 3);

    e._mainLaneByUid = lanes.laneByUid;
    e._branchStartLaneByUid = lanes.branchStartLaneByUid;
    var ownerPoint = e.commandNodePointForEntry(choice, { main: 0 }, [{ top: 28, height: 48, center: 52 }]);
    var startPoint = e.branchStartBoundaryNodePointForEntry(choice, { main: 0 }, [{ top: 28, height: 48, center: 52 }]);
    assert.strictEqual(startPoint.x, ownerPoint.x);
    assert.strictEqual(startPoint.y - ownerPoint.y, e.mainLaneGap);
    var contexts = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(contexts.contexts.length, 1);
    assert.strictEqual(contexts.startByUid['1'].endEntry, end);
    var shape = e.makeMainLaneBranchHighlightShape(contexts.contexts[0], { main: 0 }, [{ top: 28, height: 48, center: 52 }]);
    assert.ok(shape);
    assert.strictEqual(shape.branchType, 'choice');
    assert.ok(shape.y >= 29);
    assert.ok(shape.y + shape.h <= 75);
})();

(function testNestedBranchesUseStructuralDepthAndInsetHighlight() {
    var e = Object.create(namespace.EE.prototype);
    e.rulerH = 28;
    e.rowH = 80;
    e.mainLaneTop = 12;
    e.mainLaneGap = 12;
    e.frameToX = function(frame) { return 100 + Number(frame || 0) * 5; };
    var commands = [
        { uid: 1, executionOrder: 1, frame: 0, wait: 0, command: { code: 102, indent: 0, parameters: [['A'], -1, 0, 2, 0] } },
        { uid: 2, executionOrder: 2, frame: 0, wait: 0, command: { code: 402, indent: 0, parameters: [0, 'A'] } },
        { uid: 3, executionOrder: 3, frame: 2, wait: 0, command: { code: 102, indent: 1, parameters: [['B'], -1, 0, 2, 0] } },
        { uid: 4, executionOrder: 4, frame: 2, wait: 0, command: { code: 402, indent: 1, parameters: [0, 'B'] } },
        { uid: 5, executionOrder: 5, frame: 4, wait: 0, command: { code: 102, indent: 2, parameters: [['C'], -1, 0, 2, 0] } },
        { uid: 6, executionOrder: 6, frame: 4, wait: 0, command: { code: 402, indent: 2, parameters: [0, 'C'] } },
        { uid: 7, executionOrder: 7, frame: 5, wait: 0, command: { code: 121, indent: 3, parameters: [] } },
        { uid: 8, executionOrder: 8, frame: 6, wait: 0, command: { code: 404, indent: 2, parameters: [] } },
        { uid: 9, executionOrder: 9, frame: 8, wait: 0, command: { code: 404, indent: 1, parameters: [] } },
        { uid: 10, executionOrder: 10, frame: 10, wait: 0, command: { code: 404, indent: 0, parameters: [] } }
    ];
    for (var i = 0; i < commands.length; i++) {
        commands[i].rowType = 'main';
        commands[i].rowKey = 'main';
    }
    var track = { eventId: 1, pageIndex: 0, commands: commands };
    var boundaryInfo = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(boundaryInfo.startByUid['1'].nestingDepth, 0);
    assert.strictEqual(boundaryInfo.startByUid['3'].nestingDepth, 1);
    assert.strictEqual(boundaryInfo.startByUid['5'].nestingDepth, 2);

    var lanes = e.buildMainLaneMap(track, {});
    e._mainLaneByUid = lanes.laneByUid;
    e._branchStartLaneByUid = lanes.branchStartLaneByUid;
    var rowMap = { main: 0 };
    var metrics = [{ top: 28, height: 80, center: 68 }];
    var outerShape = e.makeMainLaneBranchHighlightShape(boundaryInfo.startByUid['1'], rowMap, metrics);
    var middleShape = e.makeMainLaneBranchHighlightShape(boundaryInfo.startByUid['3'], rowMap, metrics);
    var innerShape = e.makeMainLaneBranchHighlightShape(boundaryInfo.startByUid['5'], rowMap, metrics);
    assert.strictEqual(outerShape.verticalInset, 0);
    assert.ok(middleShape.verticalInset > outerShape.verticalInset);
    assert.ok(innerShape.verticalInset >= middleShape.verticalInset);
    assert.ok(middleShape.y > outerShape.y);
    assert.ok(middleShape.y + middleShape.h < outerShape.y + outerShape.h);
    assert.ok(middleShape.outlineStyle);
    assert.ok(innerShape.outlineStyle);
    assert.notStrictEqual(outerShape.fillStyle, middleShape.fillStyle);
    assert.notStrictEqual(middleShape.fillStyle, innerShape.fillStyle);

    var previousInset = 0;
    for (var depth = 1; depth <= 32; depth++) {
        var inset = e.branchHighlightInsetForDepth(depth, 80);
        assert.ok(inset >= previousInset);
        assert.ok(inset <= 34);
        previousInset = inset;
    }
})();

(function testBranchScopedInsertionKeepsNestedSourceOrderAcrossFrames() {
    var e = Object.create(namespace.EE.prototype);
    e.model = { nextUid: 100 };
    e.frame = 0;
    e.selUid = 0;
    e.hoverUid = 0;
    e.routeRangeCtxUid = 0;
    e.editUid = 0;
    e._pendingNewUid = 0;
    e.pushSnap = function() {};
    e.isFrameLockedForFrameCommandAdd = function() { return false; };
    e.computeAddFrameFromPlacementContext = function() { return 12; };
    e.commitTrackMutation = function() {};
    e.playFrom = function() {};
    e.advanceTargetFrameByWait = function(frame, wait) { return frame + wait; };
    e.isBattleEventMode = function() { return false; };
    e.commandWaitFrames = function() { return 0; };

    var outerEnd = {
        uid: 4, executionOrder: 4, frame: 30, wait: 0,
        rowType: 'main', rowKey: 'main', command: { code: 404, indent: 0, parameters: [] }
    };
    var tr = {
        eventId: 1,
        pageIndex: 0,
        commands: [
            { uid: 1, executionOrder: 1, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 102, indent: 0, parameters: [['Outer'], -1, 0, 2, 0] } },
            { uid: 2, executionOrder: 2, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [0, 'Outer'] } },
            { uid: 3, executionOrder: 3, frame: 5, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } },
            outerEnd
        ]
    };
    var innerChoice = {
        uid: 99, executionOrder: 99, frame: 12, wait: 0,
        rowType: 'main', rowKey: 'main', command: { code: 102, indent: 0, parameters: [['Inner'], -1, 0, 2, 0] }
    };
    var placement = {
        mode: 'after',
        source: 'command',
        frame: 5,
        uid: 3,
        routeListIndex: -1,
        branchInsertIndent: 1,
        branchOwnerUid: 1,
        branchShiftUidMap: { '4': true }
    };

    assert.strictEqual(e.applyCommandAddWithPlacement(tr, innerChoice, placement, { skipSnapshot: true }), true);
    assert.strictEqual(innerChoice.command.indent, 1);
    assert.ok(innerChoice.uid < outerEnd.uid);
    var source = shared.commandsInSourceOrder(tr);
    assert.ok(source.indexOf(innerChoice) < source.indexOf(outerEnd));
    assert.strictEqual(e.synchronizeChoiceBranchStructure(tr, innerChoice), true);
    var boundaries = e.branchBoundaryDisplayInfoForTrack(tr);
    assert.strictEqual(boundaries.startByUid[String(innerChoice.uid)].nestingDepth, 1);
    assert.ok(boundaries.startByUid[String(innerChoice.uid)].endEntry.uid < outerEnd.uid);

    e.rulerH = 28;
    e.rowH = 80;
    e.mainLaneTop = 12;
    e.mainLaneGap = 12;
    e.frameToX = function(frame) { return 100 + Number(frame || 0) * 5; };
    var lanes = e.buildMainLaneMap(tr, {});
    e._mainLaneByUid = lanes.laneByUid;
    e._branchStartLaneByUid = lanes.branchStartLaneByUid;
    var rowMap = { main: 0 };
    var metrics = [{ top: 28, height: 80, center: 68 }];
    var outerShape = e.makeMainLaneBranchHighlightShape(boundaries.startByUid['1'], rowMap, metrics);
    var innerShape = e.makeMainLaneBranchHighlightShape(boundaries.startByUid[String(innerChoice.uid)], rowMap, metrics);
    assert.ok(innerShape.outlineStyle);
    assert.ok(innerShape.verticalInset > outerShape.verticalInset);
    assert.notStrictEqual(innerShape.fillStyle, outerShape.fillStyle);
})();

(function testLegacyOutOfOrderNestedChoiceStillGetsVisualDepth() {
    var e = Object.create(namespace.EE.prototype);
    var track = {
        eventId: 1,
        pageIndex: 0,
        commands: [
            { uid: 1, executionOrder: 1, frame: 0, wait: 0, command: { code: 102, indent: 0, parameters: [['Outer'], -1, 0, 2, 0] } },
            { uid: 2, executionOrder: 2, frame: 0, wait: 0, command: { code: 402, indent: 0, parameters: [0, 'Outer'] } },
            { uid: 3, executionOrder: 3, frame: 30, wait: 0, command: { code: 404, indent: 0, parameters: [] } },
            { uid: 4, executionOrder: 4, frame: 10, wait: 0, command: { code: 102, indent: 1, parameters: [['Inner'], -1, 0, 2, 0] } },
            { uid: 5, executionOrder: 5, frame: 10, wait: 0, command: { code: 402, indent: 1, parameters: [0, 'Inner'] } },
            { uid: 6, executionOrder: 6, frame: 25, wait: 0, command: { code: 404, indent: 1, parameters: [] } },
            { uid: 7, executionOrder: 7, frame: 15, wait: 0, command: { code: 102, indent: 2, parameters: [['Deep'], -1, 0, 2, 0] } },
            { uid: 8, executionOrder: 8, frame: 15, wait: 0, command: { code: 402, indent: 2, parameters: [0, 'Deep'] } },
            { uid: 9, executionOrder: 9, frame: 20, wait: 0, command: { code: 404, indent: 2, parameters: [] } }
        ]
    };
    var boundaries = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(boundaries.startByUid['1'].nestingDepth, 0);
    assert.strictEqual(boundaries.startByUid['4'].nestingDepth, 1);
    assert.strictEqual(boundaries.startByUid['7'].nestingDepth, 2);
})();

(function testFramePlacedChoiceIsRepairedIntoContainingChoiceBranch() {
    var e = Object.create(namespace.EE.prototype);
    var outer = { uid: 1, executionOrder: 1, frame: 0, wait: 0, command: { code: 102, indent: 0, parameters: [['Outer'], -1, 0, 2, 0] } };
    var outerMarker = { uid: 2, executionOrder: 2, frame: 0, wait: 0, command: { code: 402, indent: 0, parameters: [0, 'Outer'] } };
    var outerContent = { uid: 3, executionOrder: 3, frame: 20, wait: 0, command: { code: 101, indent: 1, parameters: [] } };
    var outerEnd = { uid: 4, executionOrder: 4, frame: 30, wait: 0, command: { code: 404, indent: 0, parameters: [] } };
    var inner = { uid: 5, executionOrder: 5, frame: 10, wait: 0, command: { code: 102, indent: 0, parameters: [['Inner'], -1, 0, 2, 0] } };
    var innerMarker = { uid: 6, executionOrder: 6, frame: 10, wait: 0, command: { code: 402, indent: 0, parameters: [0, 'Inner'] } };
    var innerEnd = { uid: 7, executionOrder: 7, frame: 15, wait: 0, command: { code: 404, indent: 0, parameters: [] } };
    var track = {
        eventId: 1,
        pageIndex: 0,
        _eeV2: true,
        _eeChoiceBranchViewModes: { '1': '0' },
        commands: [outer, outerMarker, outerContent, outerEnd, inner, innerMarker, innerEnd]
    };
    e.selKey = '1:0';
    e.model = { nextUid: 8, tracks: { '1:0': track } };
    e.selUid = inner.uid;

    var placement = e.makeAddPlacementContextFromFrame(inner.frame);
    assert.strictEqual(placement.branchOwnerUid, outer.uid);
    assert.strictEqual(placement.branchInsertIndent, 1);
    assert.strictEqual(e.branchSourceInsertionAnchorUid(track, placement), outerContent.uid);
    var visualBeforeRepair = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(visualBeforeRepair.startByUid[String(inner.uid)].nestingDepth, 1);

    assert.strictEqual(e.repairTemporalBranchNesting(track), true);
    var source = shared.commandsInSourceOrder(track);
    assert.deepStrictEqual(Array.prototype.map.call(source, function(entry) { return entry; }), [
        outer, outerMarker, inner, innerMarker, innerEnd, outerContent, outerEnd
    ]);
    assert.strictEqual(inner.command.indent, 1);
    assert.strictEqual(innerMarker.command.indent, 1);
    assert.strictEqual(innerEnd.command.indent, 1);
    var repairedBoundaries = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(repairedBoundaries.startByUid[String(inner.uid)].nestingDepth, 1);
    assert.strictEqual(e.repairTemporalBranchNesting(track), false);
})();

(function testFramePlacedChoiceBeforeParentSourceIsRepairedIntoContainingBranch() {
    var e = Object.create(namespace.EE.prototype);
    var inner = { uid: 1, executionOrder: 1, frame: 10, wait: 0, command: { code: 102, indent: 1, parameters: [['Inner'], -1, 0, 2, 0] } };
    var innerMarker = { uid: 2, executionOrder: 2, frame: 10, wait: 0, command: { code: 402, indent: 1, parameters: [0, 'Inner'] } };
    var innerEnd = { uid: 3, executionOrder: 3, frame: 15, wait: 0, command: { code: 404, indent: 1, parameters: [] } };
    var outer = { uid: 4, executionOrder: 4, frame: 0, wait: 0, command: { code: 102, indent: 0, parameters: [['Outer'], -1, 0, 2, 0] } };
    var outerMarker = { uid: 5, executionOrder: 5, frame: 0, wait: 0, command: { code: 402, indent: 0, parameters: [0, 'Outer'] } };
    var outerContent = { uid: 6, executionOrder: 6, frame: 20, wait: 0, command: { code: 101, indent: 1, parameters: [] } };
    var outerEnd = { uid: 7, executionOrder: 7, frame: 30, wait: 0, command: { code: 404, indent: 0, parameters: [] } };
    var track = {
        eventId: 1,
        pageIndex: 0,
        _eeV2: true,
        _eeChoiceBranchViewModes: { '4': '0' },
        commands: [inner, innerMarker, innerEnd, outer, outerMarker, outerContent, outerEnd]
    };
    e.selKey = '1:0';
    e.model = { nextUid: 8, tracks: { '1:0': track } };
    e.selUid = inner.uid;

    assert.strictEqual(e.repairTemporalBranchNesting(track), true);
    var source = shared.commandsInSourceOrder(track);
    assert.deepStrictEqual(Array.prototype.map.call(source, function(entry) { return entry; }), [
        outer, outerMarker, inner, innerMarker, innerEnd, outerContent, outerEnd
    ]);
    var repairedBoundaries = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(repairedBoundaries.startByUid[String(inner.uid)].parentOwnerUid, outer.uid);
    assert.strictEqual(repairedBoundaries.startByUid[String(inner.uid)].nestingDepth, 1);
    assert.strictEqual(e.repairTemporalBranchNesting(track), false);
})();

(function testNewChoiceEndStartsAtChoiceFrameInsteadOfFollowingCommandFrame() {
    var e = Object.create(namespace.EE.prototype);
    e.model = { nextUid: 3 };
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    e.isBattleEventMode = function() { return false; };
    e.commandWaitFrames = function() { return 0; };
    var choice = {
        uid: 1, executionOrder: 1, frame: 10, wait: 0,
        rowType: 'main', rowKey: 'main',
        command: { code: 102, indent: 0, parameters: [['Only'], -1, 0, 2, 0] }
    };
    var following = {
        uid: 2, executionOrder: 2, frame: 20, wait: 0,
        rowType: 'main', rowKey: 'main',
        command: { code: 121, indent: 0, parameters: [] }
    };
    var track = { eventId: 1, pageIndex: 0, commands: [choice, following] };

    assert.strictEqual(e.synchronizeChoiceBranchStructure(track, choice), true);
    var source = shared.commandsInSourceOrder(track);
    var marker = source.filter(function(entry) { return entry.command.code === 402; })[0];
    var end = source.filter(function(entry) { return entry.command.code === 404; })[0];
    assert.ok(marker && end);
    assert.deepStrictEqual(Array.prototype.map.call(source, function(entry) { return entry; }), [
        choice, marker, end, following
    ]);
    assert.strictEqual(marker.frame, choice.frame);
    assert.strictEqual(end.frame, choice.frame);
    assert.strictEqual(following.frame, 20);

    var hidden = e.computeBranchHiddenUidMapForTrack(track);
    assert.strictEqual(!!hidden[String(marker.uid)], true);
    assert.strictEqual(!!hidden[String(end.uid)], false);
    var lanes = e.buildMainLaneMap(track, hidden);
    assert.notStrictEqual(lanes.laneByUid[String(choice.uid)], lanes.laneByUid[String(end.uid)]);
    assert.notStrictEqual(lanes.branchStartLaneByUid[String(choice.uid)], lanes.laneByUid[String(end.uid)]);

    e.rulerH = 28;
    e.rowH = 64;
    e.mainLaneTop = 12;
    e.mainLaneGap = 12;
    e.frameToX = function(frame) { return 100 + Number(frame || 0) * 5; };
    e._mainLaneByUid = lanes.laneByUid;
    e._branchStartLaneByUid = lanes.branchStartLaneByUid;
    var rowMap = { main: 0 };
    var metrics = [{ top: 28, height: 64, center: 60 }];
    var choicePoint = e.commandNodePointForEntry(choice, rowMap, metrics);
    var startPoint = e.branchStartBoundaryNodePointForEntry(choice, rowMap, metrics);
    var endPoint = e.commandNodePointForEntry(end, rowMap, metrics);
    assert.strictEqual(choicePoint.x, startPoint.x);
    assert.strictEqual(choicePoint.x, endPoint.x);
    assert.notStrictEqual(choicePoint.y, startPoint.y);
    assert.notStrictEqual(choicePoint.y, endPoint.y);
    assert.notStrictEqual(startPoint.y, endPoint.y);

    e.hitNodes = [
        { uid: choice.uid, x: choicePoint.x, y: choicePoint.y, r: 5, branchDragBoundary: 'start', branchOwnerUid: choice.uid },
        { uid: choice.uid, x: startPoint.x, y: startPoint.y, r: 6, branchBoundary: 'start', branchDragBoundary: 'start', branchOwnerUid: choice.uid },
        { uid: end.uid, x: endPoint.x, y: endPoint.y, r: 6, branchBoundary: 'end', branchDragBoundary: 'end', branchOwnerUid: choice.uid }
    ];
    assert.strictEqual(e.hitTestNode(choicePoint.x, choicePoint.y).uid, choice.uid);
    assert.strictEqual(e.hitTestNode(choicePoint.x, choicePoint.y).branchBoundary, undefined);
    assert.strictEqual(e.hitTestNode(endPoint.x, endPoint.y).uid, end.uid);
    assert.strictEqual(e.hitTestNode(endPoint.x, endPoint.y).branchBoundary, 'end');
})();

(function testPendingChoiceCommitsOnlyAfterItsStructureIsComplete() {
    var e = Object.create(namespace.EE.prototype);
    var following = {
        uid: 1, executionOrder: 1, frame: 10, wait: 0,
        rowType: 'main', rowKey: 'main',
        command: { code: 121, indent: 0, parameters: [] }
    };
    var choice = {
        uid: 2, executionOrder: 2, frame: 10, wait: 0,
        rowType: 'main', rowKey: 'main',
        command: { code: 102, indent: 0, parameters: [['Only'], -1, 0, 2, 0] },
        _pendingAddPlacement: { mode: 'before', source: 'command', uid: following.uid, frame: 10 }
    };
    var track = { eventId: 1, pageIndex: 0, commands: [following, choice] };
    e.model = { nextUid: 3, tracks: { '1:0': track } };
    e.selKey = '1:0';
    e.selEid = 1;
    e.selPage = 0;
    e.selUid = choice.uid;
    e._pendingNewUid = choice.uid;
    e.frame = 10;
    e.resolveAddPlacementContext = function(placement) { return placement; };
    e.computeAddFrameFromPlacementContext = function() { return 10; };
    e.isFrameLockedForFrameCommandAdd = function() { return false; };
    e.advanceTargetFrameByWait = function(frame) { return frame; };
    e.isBattleEventMode = function() { return false; };
    e.commandWaitFrames = function() { return 0; };
    e.pushSnap = function() {};
    e.msg = function() {};
    e.removeTrackEntryByUid = function(uid) {
        var index = track.commands.map(function(entry) { return entry.uid; }).indexOf(uid);
        if (index < 0) return false;
        track.commands.splice(index, 1);
        return true;
    };
    var commits = [];
    e.commitTrackMutation = function() {
        commits.push(shared.commandsInSourceOrder(track).map(function(entry) {
            return { code: entry.command.code, frame: entry.frame };
        }));
    };
    var playCount = 0;
    e.playFrom = function() { playCount++; };

    assert.strictEqual(e.finalizePendingAddEntry(track, choice), true);
    assert.strictEqual(commits.length, 1);
    assert.deepStrictEqual(commits[0], [
        { code: 102, frame: 10 },
        { code: 402, frame: 10 },
        { code: 404, frame: 10 },
        { code: 121, frame: 10 }
    ]);
    assert.strictEqual(playCount, 1);
})();

(function testChoiceStructureMarkerCannotEscapeBeforeSparseOwnerUid() {
    var e = Object.create(namespace.EE.prototype);
    e.model = { nextUid: 79 };
    e.isBattleEventMode = function() { return false; };
    e.commandWaitFrames = function() { return 0; };
    var owner = {
        uid: 77, executionOrder: 77, frame: 10, wait: 0,
        command: { code: 102, indent: 0, parameters: [['Only'], -1, 0, 2, 0] }
    };
    var end = {
        uid: 78, executionOrder: 78, frame: 20, wait: 0,
        command: { code: 404, indent: 0, parameters: [] }
    };
    var track = { eventId: 1, pageIndex: 0, commands: [owner, end] };
    assert.strictEqual(e.synchronizeChoiceBranchStructure(track, owner), true);
    var source = shared.commandsInSourceOrder(track);
    assert.strictEqual(source[0], owner);
    assert.strictEqual(source[1].command.code, 402);
    assert.strictEqual(source[2], end);
    assert.ok(source[1].uid > owner.uid && source[1].uid < end.uid);
})();

(function testDeleteCountRemainsEntryCount() {
    var e = Object.create(namespace.EE.prototype);
    var branchOwner = {
        uid: 1, executionOrder: 1, frame: 0, rowType: 'main', rowKey: 'main',
        command: { code: 102, indent: 0, parameters: [['A'], -1, 0, 2, 0] }
    };
    e.selKey = '1:0';
    e.model = { tracks: { '1:0': { commands: [branchOwner] } } };
    e.pushSnap = function() {};
    e.commitTrackMutation = function() {};
    e.playFrom = function() {};
    assert.strictEqual(e.deleteEntriesByUidList([1], 'test'), 1);
})();

(function testChoiceEndBoundaryMoveChangesStructureAndCanBeReversed() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    e._trackRevisionByKey = {};
    var choice = {
        uid: 1, executionOrder: 1, frame: 0, rowType: 'main', rowKey: 'main',
        command: { code: 102, indent: 0, parameters: [['A', 'B'], -1, 0, 2, 0] }
    };
    var branchA = { uid: 2, executionOrder: 2, frame: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [0, 'A'] } };
    var messageA = { uid: 3, executionOrder: 3, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } };
    var branchB = { uid: 4, executionOrder: 4, frame: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [1, 'B'] } };
    var messageB = { uid: 5, executionOrder: 5, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } };
    var end = { uid: 6, executionOrder: 6, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 404, indent: 0, parameters: [] } };
    var outside = { uid: 7, executionOrder: 7, frame: 10, rowType: 'main', rowKey: 'main', command: { code: 205, indent: 0, parameters: [2, { wait: false }] } };
    var track = { eventId: 1, pageIndex: 0, commands: [choice, branchA, messageA, branchB, messageB, end, outside] };

    var hidden = e.computeBranchHiddenUidMapForTrack(track);
    assert.strictEqual(!!hidden[String(end.uid)], false);
    var upPlan = e.branchEndBoundaryMovePlan(track, end, 'prev', hidden);
    assert.ok(upPlan);
    assert.strictEqual(upPlan.candidate, messageA);
    assert.strictEqual(e.applyBranchEndBoundaryMovePlan(track, upPlan), true);
    assert.strictEqual(messageA.command.indent, 0);
    assert.deepStrictEqual(Array.prototype.map.call(shared.commandsInSourceOrder(track), function(entry) { return entry.command.code; }), [102, 402, 402, 101, 404, 101, 205]);
    assert.deepStrictEqual(Array.prototype.map.call(shared.commandsInSaveOrder(track), function(entry) { return entry.command.code; }), [102, 402, 402, 101, 404, 101, 205]);

    hidden = e.computeBranchHiddenUidMapForTrack(track);
    var downPlan = e.branchEndBoundaryMovePlan(track, end, 'next', hidden);
    assert.ok(downPlan);
    assert.strictEqual(downPlan.candidate, messageA);
    assert.strictEqual(e.applyBranchEndBoundaryMovePlan(track, downPlan), true);
    assert.strictEqual(messageA.command.indent, 1);
    assert.deepStrictEqual(Array.prototype.map.call(shared.commandsInSourceOrder(track), function(entry) { return entry.command.code; }), [102, 402, 101, 402, 101, 404, 205]);
})();

(function testConditionalEndBoundaryIsVisibleAndShared() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    e._trackRevisionByKey = {};
    var condition = { uid: 1, executionOrder: 1, frame: 0, rowType: 'main', rowKey: 'main', command: { code: 111, indent: 0, parameters: [0, 1, 0] } };
    var thenMessage = { uid: 2, executionOrder: 2, frame: 4, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } };
    var otherwise = { uid: 3, executionOrder: 3, frame: 0, rowType: 'main', rowKey: 'main', command: { code: 411, indent: 0, parameters: [] } };
    var elseMessage = { uid: 4, executionOrder: 4, frame: 4, rowType: 'main', rowKey: 'main', command: { code: 101, indent: 1, parameters: [] } };
    var end = { uid: 5, executionOrder: 5, frame: 4, rowType: 'main', rowKey: 'main', command: { code: 412, indent: 0, parameters: [] } };
    var track = { eventId: 1, pageIndex: 0, commands: [condition, thenMessage, otherwise, elseMessage, end], _eeIfBranchViewModes: { '1': 'then' } };
    var hidden = e.computeBranchHiddenUidMapForTrack(track);
    assert.strictEqual(!!hidden['4'], true);
    assert.strictEqual(!!hidden['5'], false);
    var contexts = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(contexts.contexts.length, 1);
    assert.strictEqual(contexts.contexts[0].type, 'if');
    assert.strictEqual(contexts.startByUid['1'].endEntry, end);

    var outside = { uid: 6, executionOrder: 6, frame: 4, rowType: 'main', rowKey: 'main', command: { code: 205, indent: 0, parameters: [2, { wait: false }] } };
    track.commands.push(outside);
    var upPlan = e.branchEndBoundaryMovePlan(track, end, 'prev');
    assert.ok(upPlan);
    assert.strictEqual(upPlan.candidate, thenMessage);
    assert.strictEqual(e.applyBranchEndBoundaryMovePlan(track, upPlan), true);
    assert.strictEqual(thenMessage.command.indent, 0);
    var downPlan = e.branchEndBoundaryMovePlan(track, end, 'next');
    assert.ok(downPlan);
    assert.strictEqual(downPlan.candidate, thenMessage);
    assert.strictEqual(e.applyBranchEndBoundaryMovePlan(track, downPlan), true);
    assert.strictEqual(thenMessage.command.indent, 1);

    e.selKey = '1:0';
    e.selUid = end.uid;
    e.selRouteListIndex = -1;
    e.routeCtxMode = 'timeline';
    e.model = { tracks: { '1:0': track } };
    e.msg = function(message) { this.lastMessage = message; };
    e.pushSnap = function() {};
    e.commitTrackMutation = function() {};
    e.seek = function(frame) { this.frame = frame; };
    var endFrame = end.frame;
    assert.strictEqual(e.nudgeEntriesByFrames([end.uid], 1, false), false);
    assert.strictEqual(end.frame, endFrame);
    assert.strictEqual(outside.frame, endFrame);
    assert.strictEqual(e.selectedCommandEntryForColorContext(), null);
})();

(function testBranchEndFrameMoveClampsWithoutShiftingFollowingTimeline() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    var condition = { uid: 1, executionOrder: 1, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 111, indent: 0, parameters: [] } };
    var thenCommand = { uid: 2, executionOrder: 2, frame: 4, wait: 2, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } };
    var otherwise = { uid: 3, executionOrder: 3, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 411, indent: 0, parameters: [] } };
    var elseCommand = { uid: 4, executionOrder: 4, frame: 3, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } };
    var end = { uid: 5, executionOrder: 5, frame: 6, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 412, indent: 0, parameters: [] } };
    var outside = { uid: 6, executionOrder: 6, frame: 8, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 0, parameters: [] } };
    var track = { eventId: 1, pageIndex: 0, commands: [condition, thenCommand, otherwise, elseCommand, end, outside], endFrame: 10 };

    assert.strictEqual(e.branchEndBoundaryMinimumFrame(track, end), 6);
    var moved = e.moveBranchEndBoundaryToFrame(track, end, 10);
    assert.ok(moved && moved.changed);
    assert.strictEqual(end.frame, 8);
    assert.strictEqual(outside.frame, 8);
    assert.strictEqual(track.endFrame, 10);

    moved = e.moveBranchEndBoundaryToFrame(track, end, 0);
    assert.ok(moved && moved.changed);
    assert.strictEqual(end.frame, 6);
    assert.strictEqual(outside.frame, 8);
    assert.strictEqual(track.endFrame, 10);
})();

(function testNestedBranchEndMoveDoesNotPropagateIntoParentOrFollowingTimeline() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    var entries = [
        { uid: 1, executionOrder: 1, frame: 0, wait: 0, command: { code: 111, indent: 0, parameters: [] } },
        { uid: 2, executionOrder: 2, frame: 0, wait: 0, command: { code: 111, indent: 1, parameters: [] } },
        { uid: 3, executionOrder: 3, frame: 4, wait: 0, command: { code: 121, indent: 2, parameters: [] } },
        { uid: 4, executionOrder: 4, frame: 0, wait: 0, command: { code: 411, indent: 1, parameters: [] } },
        { uid: 5, executionOrder: 5, frame: 4, wait: 0, command: { code: 121, indent: 2, parameters: [] } },
        { uid: 6, executionOrder: 6, frame: 4, wait: 0, command: { code: 412, indent: 1, parameters: [] } },
        { uid: 7, executionOrder: 7, frame: 7, wait: 0, command: { code: 121, indent: 1, parameters: [] } },
        { uid: 8, executionOrder: 8, frame: 0, wait: 0, command: { code: 411, indent: 0, parameters: [] } },
        { uid: 9, executionOrder: 9, frame: 8, wait: 0, command: { code: 121, indent: 1, parameters: [] } },
        { uid: 10, executionOrder: 10, frame: 8, wait: 0, command: { code: 412, indent: 0, parameters: [] } },
        { uid: 11, executionOrder: 11, frame: 9, wait: 0, command: { code: 121, indent: 0, parameters: [] } }
    ];
    for (var i = 0; i < entries.length; i++) {
        entries[i].rowType = 'main';
        entries[i].rowKey = 'main';
    }
    var track = { eventId: 1, pageIndex: 0, commands: entries, endFrame: 9 };
    var innerEnd = entries[5];
    var afterInner = entries[6];
    var outerElseCommand = entries[8];
    var outerEnd = entries[9];
    var outside = entries[10];

    e.moveBranchEndBoundaryToFrame(track, innerEnd, 6);
    assert.strictEqual(innerEnd.frame, 6);
    assert.strictEqual(afterInner.frame, 7);
    assert.strictEqual(outerElseCommand.frame, 8);
    assert.strictEqual(outerEnd.frame, 8);
    assert.strictEqual(outside.frame, 9);

    e.moveBranchEndBoundaryToFrame(track, innerEnd, 10);
    assert.strictEqual(innerEnd.frame, 7);
    assert.strictEqual(afterInner.frame, 7);
    assert.strictEqual(outerElseCommand.frame, 8);
    assert.strictEqual(outerEnd.frame, 8);
    assert.strictEqual(outside.frame, 9);

    e.moveBranchEndBoundaryToFrame(track, innerEnd, 0);
    assert.strictEqual(innerEnd.frame, 4);
    assert.strictEqual(afterInner.frame, 7);
    assert.strictEqual(outerEnd.frame, 8);
    assert.strictEqual(outside.frame, 9);
})();

(function testNestedChoiceBoundaryMoveKeepsAncestorsAndFollowingCommandsFixed() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    var entries = [
        { uid: 1, executionOrder: 1, frame: 0, wait: 0, command: { code: 102, indent: 0, parameters: [['outer'], -1, 0, 2, 0] } },
        { uid: 2, executionOrder: 2, frame: 0, wait: 0, command: { code: 402, indent: 0, parameters: [0, 'outer'] } },
        { uid: 3, executionOrder: 3, frame: 2, wait: 0, command: { code: 102, indent: 1, parameters: [['inner'], -1, 0, 2, 0] } },
        { uid: 4, executionOrder: 4, frame: 2, wait: 0, command: { code: 402, indent: 1, parameters: [0, 'inner'] } },
        { uid: 5, executionOrder: 5, frame: 4, wait: 0, command: { code: 102, indent: 2, parameters: [['deep'], -1, 0, 2, 0] } },
        { uid: 6, executionOrder: 6, frame: 4, wait: 0, command: { code: 402, indent: 2, parameters: [0, 'deep'] } },
        { uid: 7, executionOrder: 7, frame: 6, wait: 0, command: { code: 121, indent: 3, parameters: [] } },
        { uid: 8, executionOrder: 8, frame: 7, wait: 0, command: { code: 404, indent: 2, parameters: [] } },
        { uid: 9, executionOrder: 9, frame: 8, wait: 0, command: { code: 121, indent: 2, parameters: [] } },
        { uid: 10, executionOrder: 10, frame: 9, wait: 0, command: { code: 404, indent: 1, parameters: [] } },
        { uid: 11, executionOrder: 11, frame: 10, wait: 0, command: { code: 121, indent: 1, parameters: [] } },
        { uid: 12, executionOrder: 12, frame: 12, wait: 0, command: { code: 404, indent: 0, parameters: [] } },
        { uid: 13, executionOrder: 13, frame: 14, wait: 0, command: { code: 121, indent: 0, parameters: [] } }
    ];
    for (var i = 0; i < entries.length; i++) {
        entries[i].rowType = 'main';
        entries[i].rowKey = 'main';
    }
    var track = { eventId: 1, pageIndex: 0, commands: entries, endFrame: 16 };
    var outer = entries[0];
    var inner = entries[2];
    var deep = entries[4];
    var deepEnd = entries[7];
    var innerEnd = entries[9];
    var outerEnd = entries[11];
    var outside = entries[12];

    var info = e.branchBoundaryDisplayInfoForTrack(track);
    assert.strictEqual(info.startByUid[String(inner.uid)].parentOwnerUid, outer.uid);
    assert.strictEqual(info.startByUid[String(deep.uid)].parentOwnerUid, inner.uid);
    assert.strictEqual(info.startByUid[String(deep.uid)].nestingDepth, 2);

    var moved = e.moveBranchStartBoundaryToFrame(track, deep, 0);
    assert.ok(moved && moved.changed);
    assert.strictEqual(deep.frame, inner.frame);
    assert.strictEqual(inner.frame, 2);
    assert.strictEqual(outer.frame, 0);
    assert.strictEqual(deepEnd.frame, 7);

    moved = e.moveBranchStartBoundaryToFrame(track, deep, 20);
    assert.ok(moved && moved.changed);
    assert.strictEqual(deep.frame, 6);
    assert.strictEqual(inner.frame, 2);
    assert.strictEqual(outer.frame, 0);
    assert.strictEqual(deepEnd.frame, 7);

    moved = e.moveBranchEndBoundaryToFrame(track, deepEnd, 20);
    assert.ok(moved && moved.changed);
    assert.strictEqual(deepEnd.frame, 8);
    assert.strictEqual(innerEnd.frame, 9);
    assert.strictEqual(outerEnd.frame, 12);
    assert.strictEqual(outside.frame, 14);

    moved = e.moveBranchEndBoundaryToFrame(track, innerEnd, 0);
    assert.ok(moved && moved.changed);
    assert.strictEqual(innerEnd.frame, 8);
    assert.strictEqual(deepEnd.frame, 8);
    assert.strictEqual(outerEnd.frame, 12);
    assert.strictEqual(outside.frame, 14);

    moved = e.moveBranchEndBoundaryToFrame(track, outerEnd, 0);
    assert.ok(moved && moved.changed);
    assert.strictEqual(outerEnd.frame, 10);
    assert.strictEqual(innerEnd.frame, 8);
    assert.strictEqual(deepEnd.frame, 8);
    assert.strictEqual(outside.frame, 14);
})();

(function testBranchBoundaryHitPrefersNearestThenDeepestCircle() {
    var e = Object.create(namespace.EE.prototype);
    e.scaleTimelineCircleRadius = function(radius) { return Number(radius || 0); };
    e.hitNodes = [
        { uid: 1, x: 10, y: 10, r: 6, branchBoundary: 'start', branchNestingDepth: 0 },
        { uid: 2, x: 12, y: 10, r: 6, branchBoundary: 'start', branchNestingDepth: 2 }
    ];
    assert.strictEqual(e.hitTestNode(12, 10).uid, 2);

    e.hitNodes = [
        { uid: 2, x: 10, y: 10, r: 6, branchBoundary: 'start', branchNestingDepth: 2 },
        { uid: 1, x: 10, y: 10, r: 6, branchBoundary: 'start', branchNestingDepth: 0 }
    ];
    assert.strictEqual(e.hitTestNode(10, 10).uid, 2);

    e.hitNodes = [
        { uid: 3, x: 10, y: 10, r: 6, branchDragBoundary: 'start', branchNestingDepth: 2 },
        { uid: 3, x: 10, y: 10, r: 6, branchBoundary: 'start', branchNestingDepth: 2 }
    ];
    assert.strictEqual(e.hitTestNode(10, 10).branchBoundary, 'start');

    e.hitNodes = [
        { uid: 4, x: 10, y: 10, r: 6 },
        { uid: 5, x: 14, y: 10, r: 6 }
    ];
    assert.strictEqual(e.hitTestNode(10, 10).uid, 5);
})();

(function testBoundaryDragUsesExactNestedOwnerWithoutMovingParent() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    var outer = { uid: 1, executionOrder: 1, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 102, indent: 0, parameters: [['outer'], -1, 0, 2, 0] } };
    var outerMarker = { uid: 2, executionOrder: 2, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [0, 'outer'] } };
    var inner = { uid: 3, executionOrder: 3, frame: 5, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 102, indent: 1, parameters: [['inner'], -1, 0, 2, 0] } };
    var innerMarker = { uid: 4, executionOrder: 4, frame: 5, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 1, parameters: [0, 'inner'] } };
    var innerContent = { uid: 5, executionOrder: 5, frame: 8, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 2, parameters: [] } };
    var innerEnd = { uid: 6, executionOrder: 6, frame: 10, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 404, indent: 1, parameters: [] } };
    var afterInner = { uid: 7, executionOrder: 7, frame: 18, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } };
    var outerEnd = { uid: 8, executionOrder: 8, frame: 20, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 404, indent: 0, parameters: [] } };
    var track = { eventId: 1, pageIndex: 0, commands: [outer, outerMarker, inner, innerMarker, innerContent, innerEnd, afterInner, outerEnd] };
    e.selKey = '1:0';
    e.model = { tracks: { '1:0': track } };
    e.pushSnap = function() {};
    e.commitTrackMutation = function() {};
    e.seek = function(frame) { this.frame = frame; };
    e.msg = function(message) { this.lastMessage = message; };

    e.dragState = {
        uid: innerEnd.uid,
        branchBoundary: 'end',
        branchDragBoundary: 'end',
        branchOwnerUid: inner.uid,
        startFrame: innerEnd.frame,
        targetFrame: 15,
        moved: true,
        valid: true
    };
    e.onTimelineUp();
    assert.strictEqual(innerEnd.frame, 15);
    assert.strictEqual(outer.frame, 0);
    assert.strictEqual(outerEnd.frame, 20);
    assert.strictEqual(afterInner.frame, 18);

    e.dragState = {
        uid: inner.uid,
        branchBoundary: '',
        branchDragBoundary: 'start',
        branchOwnerUid: inner.uid,
        startFrame: inner.frame,
        targetFrame: 7,
        moved: true,
        valid: true
    };
    e.onTimelineUp();
    assert.strictEqual(inner.frame, 7);
    assert.strictEqual(innerEnd.frame, 15);
    assert.strictEqual(outer.frame, 0);
    assert.strictEqual(outerEnd.frame, 20);
})();

(function testBranchEndPaddingSavesAfterMergeAndRestoresMarkerFrame() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    var track = {
        eventId: 1,
        pageIndex: 0,
        endFrame: 10,
        commands: [
            { uid: 1, executionOrder: 1, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 111, indent: 0, parameters: [] } },
            { uid: 2, executionOrder: 2, frame: 5, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } },
            { uid: 3, executionOrder: 3, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 411, indent: 0, parameters: [] } },
            { uid: 4, executionOrder: 4, frame: 3, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } },
            { uid: 5, executionOrder: 5, frame: 8, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 412, indent: 0, parameters: [] } },
            { uid: 6, executionOrder: 6, frame: 10, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 0, parameters: [] } }
        ]
    };
    var saved = e.listFromTrack(track);
    var endIndex = -1;
    for (var i = 0; i < saved.length; i++) {
        if (saved[i] && saved[i].code === 412) {
            endIndex = i;
            break;
        }
    }
    assert.ok(endIndex >= 0);
    assert.strictEqual(saved[endIndex + 1].code, 230);
    assert.strictEqual(saved[endIndex + 1].indent, 0);
    assert.strictEqual(saved[endIndex + 1].parameters[0], 3);
    assert.strictEqual(saved[endIndex + 1]._eeBranchEndWait, true);

    sandbox.$dataMap = { events: [null, { pages: [{ list: saved }] }] };
    var parsedEditor = Object.create(namespace.EE.prototype);
    parsedEditor.model = { tracks: {}, nextUid: 1 };
    parsedEditor.key = e.key;
    parsedEditor.isBattleEventMode = function() { return false; };
    parsedEditor.trackPageSourceList = function() { return saved; };
    parsedEditor.mergeMessageSettingsIntoShowTextEntries = function() {};
    parsedEditor.loadIfBranchViewModesForTrack = function() {};
    parsedEditor._eeReadTracePhase = 'startup';
    var parsed = parsedEditor.ensureTrack(1, 0);
    var parsedEnd = parsed.commands.filter(function(entry) { return entry.command.code === 412; })[0];
    var parsedOutside = parsed.commands.filter(function(entry) {
        return entry.command.code === 121 && entry.command.indent === 0;
    })[0];
    assert.strictEqual(parsedEnd.frame, 8);
    assert.strictEqual(parsedOutside.frame, 10);
    assert.strictEqual(parsed.endFrame, 10);
    sandbox.$dataMap = null;
})();

(function testChoiceNormalizationPreservesManualEndPadding() {
    var e = Object.create(namespace.EE.prototype);
    e.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
    var track = {
        eventId: 1,
        pageIndex: 0,
        endFrame: 10,
        commands: [
            { uid: 1, executionOrder: 1, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 102, indent: 0, parameters: [['A', 'B'], -1, 0, 2, 0] } },
            { uid: 2, executionOrder: 2, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [0, 'A'] } },
            { uid: 3, executionOrder: 3, frame: 5, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } },
            { uid: 4, executionOrder: 4, frame: 0, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 402, indent: 0, parameters: [1, 'B'] } },
            { uid: 5, executionOrder: 5, frame: 3, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 1, parameters: [] } },
            { uid: 6, executionOrder: 6, frame: 8, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 404, indent: 0, parameters: [] } },
            { uid: 7, executionOrder: 7, frame: 10, wait: 0, rowType: 'main', rowKey: 'main', command: { code: 121, indent: 0, parameters: [] } }
        ]
    };
    var end = track.commands[5];
    var saved = e.listFromTrack(track);
    assert.strictEqual(end.frame, 8);
    var endIndex = saved.map(function(command) { return command.code; }).indexOf(404);
    assert.ok(endIndex >= 0);
    assert.strictEqual(saved[endIndex + 1].code, 230);
    assert.strictEqual(saved[endIndex + 1].parameters[0], 3);
    assert.strictEqual(saved[endIndex + 1]._eeBranchEndWait, true);
})();

(function testMoveRouteSymbolsAndOverlapLanes() {
    var e = Object.create(namespace.EE.prototype);
    e.normalizeMoveTarget = function(v) { return Number(v || 0); };
    assert.strictEqual(e.routeSymbolFromOrdinal(1), 'A');
    assert.strictEqual(e.routeSymbolFromOrdinal(26), 'Z');
    assert.strictEqual(e.routeSymbolFromOrdinal(27), 'AA');

    var routeA = { uid: 1, executionOrder: 1, frame: 0, rowType: 'char', rowKey: 'char:2', charId: 2, visualSpan: 20, command: { code: 205, parameters: [2, {}] } };
    var routeB = { uid: 2, executionOrder: 2, frame: 10, rowType: 'char', rowKey: 'char:2', charId: 2, visualSpan: 20, command: { code: 205, parameters: [2, {}] } };
    var routeC = { uid: 3, executionOrder: 3, frame: 30, rowType: 'char', rowKey: 'char:2', charId: 2, visualSpan: 5, command: { code: 205, parameters: [2, {}] } };
    var track = { commands: [routeA, routeB, routeC] };
    e.normalizeTrackExecutionMetadata(track);
    assert.deepStrictEqual([routeA.routeSymbolOrdinal, routeB.routeSymbolOrdinal, routeC.routeSymbolOrdinal], [1, 2, 3]);
    e.computeIfBranchHiddenUidMapForTrack = function() { return {}; };
    e.routeExecutionSpanFramesForEntry = function(entry) { return entry.visualSpan; };
    var lanes = e.buildCharRouteLaneMap(track, {});
    assert.strictEqual(lanes.laneByUid[1], 0);
    assert.strictEqual(lanes.laneByUid[2], 1);
    assert.strictEqual(lanes.laneByUid[3], 0);
    assert.strictEqual(lanes.stackByRow['char:2'], 2);
})();

(function testNonWaitingMoveRoutesMayOverlap() {
    var e = Object.create(namespace.EE.prototype);
    e.isIntervalLockedByMoveRouteWait = function() { return false; };
    e.isMoveRouteWaitEnabledEntry = function() { return false; };
    var routeA = { uid: 1, frame: 0, wait: 0, rowType: 'char', rowKey: 'char:2', command: { code: 205, parameters: [2, { wait: false }] } };
    var routeB = { uid: 2, frame: 10, wait: 0, rowType: 'char', rowKey: 'char:2', command: { code: 205, parameters: [2, { wait: false }] } };
    assert.strictEqual(e.canPlaceEntry({ commands: [routeA] }, routeB, 10, 'char:2', routeB.uid), true);
})();

(function testMoveRouteInterruptionLogOnlyForActiveRoute() {
    var e = Object.create(namespace.EE.prototype);
    e.execLogView = {};
    e.execLogLines = [];
    e.execLogMax = 240;
    e.renderExecutionLog = function() {};
    e.normalizeMoveTarget = function(v) { return Number(v || 0); };
    e.rowLabelForCharId = function() { return 'Event 2: kanbu2'; };
    e._simToRunning = false;
    e._eeInlineCommandExecution = false;
    var oldRoute = {};
    var character = { _moveRouteForcing: true, _moveRoute: oldRoute };
    e._activeEditorMoveRoutes = [{ character: character, route: oldRoute, symbol: 'C' }];
    var next = { uid: 2, routeSymbolOrdinal: 4, charId: 2, command: { code: 205, parameters: [2, {}] } };
    e.beginEditorMoveRouteExecution({ character: function() { return character; } }, next.command.parameters, next, 960);
    assert.strictEqual(e.execLogLines.length, 1);
    assert.ok(e.execLogLines[0].text.indexOf('移動ルートCが、移動ルートDの開始により中断されました') >= 0);

    e.execLogLines = [];
    character._moveRouteForcing = false;
    e._activeEditorMoveRoutes = [{ character: character, route: oldRoute, symbol: 'C' }];
    e.beginEditorMoveRouteExecution({ character: function() { return character; } }, next.command.parameters, next, 980);
    assert.strictEqual(e.execLogLines.length, 0);
})();

(function testWaitingMoveRouteDefersRemainingSameFrameEntries() {
    var e = Object.create(namespace.EE.prototype);
    var character = { _moveRouteForcing: true };
    var deferred = { uid: 9 };
    e._editorMoveRouteWaitState = { character: character, pending: [], pendingIndex: 0 };
    e._frameExecState = {};
    var frameState = { list: [{ uid: 8 }, deferred], index: 1 };
    assert.strictEqual(e.captureEditorMoveRouteWaitRemainder(frameState), true);
    assert.strictEqual(e.drainEditorMoveRouteWait(10), 'waiting');
    character._moveRouteForcing = false;
    var executed = [];
    e.isPlaybackBlocked = function() { return false; };
    e.shouldExecuteEntryByIfBranchRuntime = function() { return true; };
    e.execEntry = function(entry) { executed.push(entry.uid); };
    assert.strictEqual(e.drainEditorMoveRouteWait(30), 'ready');
    assert.deepStrictEqual(executed, [9]);
})();

function modalNode(open) {
    return { classList: { contains: function(name) { return name === 'on' && open; } } };
}
var editor = Object.create(namespace.EE.prototype);
var closed = [];
editor._editorModalRegistry = [];
editor.baseModal = modalNode(true);
editor.childModal = modalNode(true);
editor.registerEditorModal('base', 'baseModal', function() { closed.push('base'); });
editor.registerEditorModal('child', 'childModal', function() { closed.push('child'); });
assert.strictEqual(editor.isAnyRegisteredEditorModalOpen(), true);
assert.strictEqual(editor.openEditorModalRecord().name, 'child');
assert.strictEqual(editor.closeTopEditorModalOnEscape(), true);
assert.deepStrictEqual(closed, ['child']);

function uiNode(tag, className, textContent) {
    return {
        tagName: tag,
        className: className || '',
        textContent: textContent || '',
        children: [],
        style: {},
        appendChild: function(child) { this.children.push(child); return child; },
        addEventListener: function() {}
    };
}
editor.el = uiNode;
editor.btn = function(label, className) { return uiNode('button', className, label); };
editor.attachSelectWheelInput = function() {};
var pickerRoot = uiNode('div');
editor.buildSwitchPickerModal(pickerRoot);
editor.buildVariablePickerModal(pickerRoot);
assert.ok(editor.switchPickerModal && editor.switchPickerRangeList && editor.switchPickerSwitchList);
assert.ok(editor.variablePickerModal && editor.variablePickerRangeList && editor.variablePickerVariableList);
assert.strictEqual(pickerRoot.children.length, 2);

var bounds = editor.characterSpriteCanvasBounds({
    _frame: { width: 20, height: 40 },
    anchor: { x: 0.5, y: 1 },
    worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 120 }
}, null);
assert.strictEqual(bounds.x, 90);
assert.strictEqual(bounds.y, 80);
assert.strictEqual(bounds.width, 20);
assert.strictEqual(bounds.height, 40);

editor.ensureEditorSchemas();
var noParamsSchema = editor.getEditorSchema(351);
assert.strictEqual(noParamsSchema.title, 'メニュー画面を開く');
assert.strictEqual(noParamsSchema.toParams({}).length, 0);
var audioSchema = editor.getEditorSchema(132);
var audioState = audioSchema.fromEntry({
    command: { parameters: [{ name: 'Battle1', volume: 0, pitch: 200, pan: -120 }] }
});
assert.strictEqual(audioState.name, 'Battle1');
assert.strictEqual(audioState.volume, 0);
assert.strictEqual(audioState.pitch, 150);
assert.strictEqual(audioState.pan, -100);
var audioParams = audioSchema.toParams({ name: 'Battle2', volume: 80, pitch: 110, pan: 5 });
assert.strictEqual(audioParams[0].volume, 80);
var binarySchema = editor.getEditorSchema(134);
assert.strictEqual(binarySchema.fromEntry({ command: { parameters: [1] } }).mode, 1);
assert.strictEqual(binarySchema.toParams({ mode: 0 })[0], 0);

sandbox.$dataSystem = {
    switches: ['', 'Door'],
    variables: ['', 'Score', 'Count']
};
assert.strictEqual(editor.switchDisplayText(1), '0001 Door');
assert.strictEqual(editor.variableDisplayText(2), '0002 Count');
assert.strictEqual(editor.clampSwitchId(99), 1);
assert.strictEqual(editor.clampVariableId(99), 2);
editor.switchPickerSelectedId = 1;
editor.switchPickerNameInput = { value: 'Gate' };
editor.switchPickerSwitchList = {
    selectedIndex: 0,
    value: '1',
    options: [{ textContent: '' }]
};
editor.onSwitchPickerNameInput();
assert.strictEqual(sandbox.$dataSystem.switches[1], 'Gate');
assert.strictEqual(editor.switchPickerSwitchList.options[0].textContent, '0001 Gate');

var branchEditor = Object.create(namespace.EE.prototype);
var autoResult = false;
var branchInfoBuilds = 0;
var ifEntry = { uid: 10, eventId: 1, pageIndex: 0, command: { code: 111, indent: 0, parameters: [] } };
var branchTrack = {
    eventId: 1,
    pageIndex: 0,
    commands: [ifEntry],
    _eeIfBranchViewModes: { '1': 'auto' }
};
branchEditor._trackRevisionByKey = { '1:0': 1 };
branchEditor.key = function(eventId, pageIndex) { return String(eventId) + ':' + String(pageIndex); };
branchEditor.computeIfBranchDisplayInfoForTrack = function() {
    branchInfoBuilds++;
    return {
        list: [ifEntry],
        blocks: [{ ifUid: 10, ifIndex: 0, ordinal: 1 }],
        ifUidToOrdinal: { '10': 1 }
    };
};
branchEditor.evaluateIfConditionAutoForEntry = function() { return autoResult; };
assert.strictEqual(branchEditor.trackHasAutoIfBranchViewMode(branchTrack), true);
assert.strictEqual(branchEditor.trackHasAutoIfBranchViewMode(branchTrack), true);
assert.strictEqual(branchInfoBuilds, 1);
var falseSignature = branchEditor.autoIfBranchViewSignatureForTrack(branchTrack);
autoResult = true;
var trueSignature = branchEditor.autoIfBranchViewSignatureForTrack(branchTrack);
assert.notStrictEqual(falseSignature, trueSignature);
branchEditor.timelineDirty = false;
branchEditor._timelineAutoIfViewTrack = branchTrack;
branchEditor._timelineAutoIfViewSignature = falseSignature;
assert.strictEqual(branchEditor.refreshAutoIfBranchViewSignature(branchTrack), true);
assert.strictEqual(branchEditor.timelineDirty, true);
branchEditor._trackRevisionByKey['1:0'] = 2;
branchEditor.trackHasAutoIfBranchViewMode(branchTrack);
assert.strictEqual(branchInfoBuilds, 2);

var rangeEditor = Object.create(namespace.EE.prototype);
var committedRangeFrame = -1;
rangeEditor.selKey = '1:0';
rangeEditor.frame = 50;
rangeEditor.model = { tracks: { '1:0': { commands: [{ uid: 1, frame: 42, command: { code: 1 } }] } } };
rangeEditor.rangeSelection = { kind: 'items', frameStart: 42, frameEnd: 42 };
rangeEditor.hasRangeSelection = function() { return true; };
rangeEditor.selectedEntryUidsFromRange = function() { return [1]; };
rangeEditor.selectedRouteCmdItemsFromRange = function() { return []; };
rangeEditor.pushSnap = function() {};
rangeEditor.clearRangeSelection = function() {
    this.rangeSelection = { kind: 'none', frameStart: 0, frameEnd: 0 };
};
rangeEditor.commitTrackMutation = function(options) { committedRangeFrame = options.earliestChangedFrame; };
rangeEditor.seek = function() {};
rangeEditor.deleteRangeSelection();
assert.strictEqual(committedRangeFrame, 42);

var playbackEditor = Object.create(namespace.EE.prototype);
playbackEditor.controlMode = false;
playbackEditor.manualPause = false;
playbackEditor.play = false;
playbackEditor.frame = 24;
playbackEditor.clearMessageRuntimeState = function() {};
playbackEditor.rebuildSimAudioPlayback = function() {};
playbackEditor.stopEditorAudioPlayback = function() {};
playbackEditor.stopTimelineAutoScrollAnimation = function() {};
playbackEditor.setPlayBtn = function() {};
playbackEditor.updateGameFrameVisual = function() {};
playbackEditor.refreshCharacterOverlay = function() {};
playbackEditor.msg = function() {};
playbackEditor.ensurePlaybackCursorVisibleOnStart = function() { this.cursorRevealCount = (this.cursorRevealCount || 0) + 1; };
sandbox.$gameMap = null;
playbackEditor.setInteractionMode('game', 'test');
assert.strictEqual(playbackEditor.controlMode, true);
assert.strictEqual(playbackEditor.play, true);
assert.strictEqual(playbackEditor.playStartFrame, 24);
assert.strictEqual(playbackEditor.cursorRevealCount, 1);
playbackEditor.setInteractionMode('timeline', 'test');
assert.strictEqual(playbackEditor.play, false);
assert.strictEqual(playbackEditor.manualPause, false);

var shortcutEditor = Object.create(namespace.EE.prototype);
shortcutEditor.play = true;
shortcutEditor.playStartFrame = 17;
shortcutEditor.seek = function(frame) { this.seekedFrame = frame; this.play = false; };
shortcutEditor.msg = function(message) { this.lastMessage = message; };
shortcutEditor.handleCtrlRShortcut();
assert.strictEqual(shortcutEditor.seekedFrame, 17);
assert.strictEqual(shortcutEditor.play, false);
assert.strictEqual(shortcutEditor.manualPause, true);
shortcutEditor.controlMode = true;
shortcutEditor.setInteractionMode = function(mode) { this.requestedMode = mode; };
shortcutEditor.handleCtrlRShortcut();
assert.strictEqual(shortcutEditor.requestedMode, 'timeline');
shortcutEditor.controlMode = false;
shortcutEditor.handleCtrlRShortcut();
assert.strictEqual(shortcutEditor.requestedMode, 'game');

console.log('Timeline module evaluation: OK');
