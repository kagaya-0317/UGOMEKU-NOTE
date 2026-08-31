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

(function testSameFrameExecutionOrderIsAlsoSaveOrder() {
    var routeA = { uid: 1, executionOrder: 1, frame: 20, wait: 0, command: { code: 205, indent: 0 } };
    var messageA = { uid: 2, executionOrder: 2, frame: 20, wait: 0, command: { code: 101, indent: 0 } };
    var routeB = { uid: 3, executionOrder: 3, frame: 20, wait: 0, command: { code: 205, indent: 0 } };
    var messageB = { uid: 4, executionOrder: 4, frame: 20, wait: 0, command: { code: 101, indent: 0 } };
    var saved = shared.commandsInSaveOrder({ commands: [messageB, routeB, messageA, routeA] });
    assert.deepStrictEqual(Array.prototype.map.call(saved, function(entry) { return entry.command.code; }), [205, 101, 205, 101]);
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
