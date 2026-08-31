//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Core
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.3.0 (KNH_ZXC_EventEditor_Timeline_Core)
 * @author kagaya
 * @help
 * KNH_ZXC_EventEditor.js の自動ロード用分割モジュールです。
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;

    var SH = NS._eeTimelineShared;
    if (!SH || !SH.ready) return;
    var clone = SH.clone;
    var maximizeWindowForEditor = SH.maximizeWindowForEditor;
    var compareEntriesByFrameWaitUid = SH.compareEntriesByFrameWaitUid;
    var COMMAND_CODE = SH.COMMAND_CODE;
    SH.beginModule('core');

    // Lifecycle, UI construction, command catalogs, and command insertion.
    EE.prototype.start = function() {
        if (this.on) return;
        this.on = true;
        this.minPxPerFrame = 4 / 30;
        this.maxPxPerFrame = 8;
        if (this.pxPerFrame == null) this.pxPerFrame = this.maxPxPerFrame;
        this.labelW = 140;
        this.rulerH = 22;
        this.rowH = 28;
        this.mainLaneGap = 10;
        this.mainLaneTop = 14;
        this.mainLaneBottom = 14;
        this.charLaneGap = 18;
        this.charLaneTop = 14;
        this.charLaneBottom = 14;
        this.hitNodes = [];
        this.hitComments = [];
        this.hitBars = [];
        this.hitOrderButtons = [];
        this.hitIfBranchButtons = [];
        this.orderButtonAnchorEntry = null;
        this.orderButtonAnchorY = 0;
        this.suppressTimelineDblClickUntil = 0;
        this.dragState = null;
        this.timelineWrap = null;
        this.timelinePanel = null;
        this.timelineOverlay = null;
        this.timelineCursorDirty = true;
        this._timelineRowLayoutSig = '';
        this._ifBranchViewMetaCache = null;
        this._timelineAutoIfViewTrack = null;
        this._timelineAutoIfViewSignature = '';
        this.zoomInfo = null;
        this.tip = null;
        this.modal = null;
        this._editorModalRegistry = [];
        this.simplePromptModal = null;
        this.simplePromptTitle = null;
        this.simplePromptLabel = null;
        this.simplePromptInput = null;
        this.simplePromptTextarea = null;
        this.simplePromptOkButton = null;
        this.simplePromptCancelButton = null;
        this.simplePromptRequest = null;
        this._recoverySnapshotDecision = '';
        this.gameFrame = null;
        this.gameViewportFrame = null;
        this.gameViewportGuards = null;
        this.gameBottomMask = null;
        this.mouseCoordInfo = null;
        this.controlMode = false;
        this.manualPause = false;
        this.playStartFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.spaceDown = false;
        this.panState = null;
        this.lastPointerClientX = 0;
        this.lastPointerClientY = 0;
        this._spaceCursor = '';
        this._gameFramePanDx = 0;
        this._gameFramePanDy = 0;
        this._gameFrameCenterAnim = null;
        this.gameFramePinned = true;
        this.editorDisplayX = null;
        this.editorDisplayY = null;
        this.runtimeDisplayX = null;
        this.runtimeDisplayY = null;
        this.keepRuntimeDisplayOnPlayStart = false;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = null;
        this.hoverUid = 0;
        this.hoverRouteListIndex = -1;
        this.hoverFrame = -1;
        this.hoverRangeUid = 0;
        this.hoverRangePart = '';
        this.hoverEndMarker = false;
        this.endMarkerPadFrames = 40;
        this.hideTimelineCircles = false;
        this.hideRouteHandles = false;
        this.charCtxTargetId = null;
        this.charCtxShiftAdjustBtn = null;
        this.charCtxOriginAdjustBtn = null;
        this.charCtxRangeAdjustBtn = null;
        this.charCtxCreateBtn = null;
        this.contextEventAdjustState = null;
        this.contextEventOriginLine = null;
        this.contextEventOriginLineLabel = null;
        this.contextEventRangeLayer = null;
        this.cameraCtx = null;
        this.cameraCtxScrollBtn = null;
        this.cameraCtxScrollToBtn = null;
        this.cameraCtxMapX = 0;
        this.cameraCtxMapY = 0;
        this.mapCreateCtx = null;
        this.mapCreateCtxCreateBtn = null;
        this.mapCreateCtxMapX = 0;
        this.mapCreateCtxMapY = 0;
        this.routeAddFrame = 0;
        this.routeAddCharId = 0;
        this.routeAddPlacementContext = null;
        this.routeRangeCtxUid = 0;
        this.routeCtxMode = 'route';
        this.routeCtxSqueezeEnabled = false;
        this.routeCtxWaitArrangeEnabled = false;
        this.routeCtxMergeEnabled = false;
        this.routeCtxMessageBubbleBulkEnabled = false;
        this.routeCtxWaitInsertContext = null;
        this.routeCtxAddBtn = null;
        this.routeCtxAddBeforeBtn = null;
        this.routeCtxAddAfterBtn = null;
        this.routeCtxMemoBtn = null;
        this.routeCtxCopyBtn = null;
        this.routeCtxCutBtn = null;
        this.routeCtxPasteBtn = null;
        this.routeCtxColorLabel = null;
        this.routeCtxColorWrap = null;
        this.routeCtxColorBtns = null;
        this.routeCtxEndPlus300Btn = null;
        this.routeCtxEndToLastCmdBtn = null;
        this.routeCtxWaitArrangeBtn = null;
        this.routeCtxMergeBtn = null;
        this.routeCtxMessageBubbleBulkBtn = null;
        this.timelineCommandClipboard = null;
        this.addPlacementContext = null;
        this.waitInsertModal = null;
        this.waitInsertDialogContext = null;
        this.waitInsertPosBefore = null;
        this.waitInsertPosAfter = null;
        this.waitInsertFrameInput = null;
        this.waitInsertInfo = null;
        this.messageBubbleBulkModal = null;
        this.messageBubbleBulkDialogContext = null;
        this.messageBubbleBulkTargetCharId = null;
        this.messageBubbleBulkWindowTypeCheck = null;
        this.messageBubbleBulkWindowType = null;
        this.messageBubbleBulkTailDirCheck = null;
        this.messageBubbleBulkTailDir = null;
        this.messageBubbleBulkAddXCheck = null;
        this.messageBubbleBulkAddX = null;
        this.messageBubbleBulkAddYCheck = null;
        this.messageBubbleBulkAddY = null;
        this.messageBubbleBulkInfo = null;
        this.memoModal = null;
        this.memoEditMode = 'new';
        this.memoEditUid = 0;
        this.memoEditFrame = 0;
        this.memoEditSize = 'M';
        this.memoHead = null;
        this.memoSizeSelect = null;
        this.memoTextInput = null;
        this.memoDeleteBtn = null;
        this.eventSettingsModal = null;
        this.eventSettingsHead = null;
        this.eventSettingsTargetEventId = 0;
        this.eventSettingsTargetPageIndex = 0;
        this.eventSettingsDraftEvent = null;
        this.eventSettingsDraftOriginal = null;
        this.eventSettingsDraftPageTokens = [];
        this.eventSettingsDraftNextPageToken = 1;
        this.eventSettingsNameInput = null;
        this.eventSettingsNoteInput = null;
        this.eventSettingsNoteZoomModal = null;
        this.eventSettingsNoteZoomWindow = null;
        this.eventSettingsNoteZoomInput = null;
        this.eventSettingsNoteZoomIgnoreUntil = 0;
        this.eventSettingsPageSelect = null;
        this.eventSettingsPageTabs = null;
        this.eventSettingsPageCreateBtn = null;
        this.eventSettingsPageCopyBtn = null;
        this.eventSettingsPagePasteBtn = null;
        this.eventSettingsPageDeleteBtn = null;
        this.eventSettingsPageClearBtn = null;
        this.eventSettingsPageClipboard = null;
        this.eventSettingsSw1Valid = null;
        this.eventSettingsSw1Id = null;
        this.eventSettingsSw1PickBtn = null;
        this.eventSettingsSw2Valid = null;
        this.eventSettingsSw2Id = null;
        this.eventSettingsSw2PickBtn = null;
        this.eventSettingsVarValid = null;
        this.eventSettingsVarId = null;
        this.eventSettingsVarValue = null;
        this.eventSettingsVarPickBtn = null;
        this.eventSettingsSelfValid = null;
        this.eventSettingsSelfCh = null;
        this.eventSettingsItemValid = null;
        this.eventSettingsItemId = null;
        this.eventSettingsItemPickBtn = null;
        this.eventSettingsActorValid = null;
        this.eventSettingsActorId = null;
        this.eventSettingsActorPickBtn = null;
        this.eventSettingsScriptCondValid = null;
        this.eventSettingsScriptCondText = null;
        this.eventSettingsUseTile = null;
        this.eventSettingsTileId = null;
        this.eventSettingsCharName = null;
        this.eventSettingsCharIndex = null;
        this.eventSettingsDirection = null;
        this.eventSettingsPattern = null;
        this.eventSettingsImagePreview = null;
        this.eventSettingsImageInfo = null;
        this.eventSettingsImagePickBtn = null;
        this.eventSettingsLeftPane = null;
        this.eventSettingsExecSec = null;
        this.eventSettingsImagePickerModal = null;
        this.eventSettingsImagePickerList = null;
        this.eventSettingsImagePickerViewport = null;
        this.eventSettingsImagePickerCanvasWrap = null;
        this.eventSettingsImagePickerCanvas = null;
        this.eventSettingsImagePickerInfo = null;
        this.eventSettingsImagePickerNames = [];
        this.eventSettingsImagePickerName = '';
        this.eventSettingsImagePickerIndex = 0;
        this.eventSettingsImagePickerDirection = 2;
        this.eventSettingsImagePickerPattern = 1;
        this.eventSettingsImagePickerBitmap = null;
        this.eventSettingsImagePickerCssRectMode = false;
        this.eventSettingsImagePickerCssRectTouched = false;
        this.eventSettingsImagePickerCssRectDraft = null;
        this.eventSettingsImagePickerCssRectDragging = null;
        this.eventSettingsImagePickerCssRectModeBtn = null;
        this.eventSettingsImagePickerCssRectClearBtn = null;
        this.eventSettingsImagePickerCssRectStatus = null;
        this.characterImagePickerRequest = null;
        this.characterImagePickerTitle = null;
        this.sePickerModal = null;
        this.sePickerWindow = null;
        this.sePickerList = null;
        this.sePickerPlayBtn = null;
        this.sePickerStopBtn = null;
        this.sePickerVolumeRange = null;
        this.sePickerVolumeInput = null;
        this.sePickerPitchRange = null;
        this.sePickerPitchInput = null;
        this.sePickerPanRange = null;
        this.sePickerPanInput = null;
        this.sePickerNames = [];
        this.sePickerName = '';
        this.sePickerVolume = 90;
        this.sePickerPitch = 100;
        this.sePickerPan = 0;
        this.sePickerEditUid = 0;
        this.eventSettingsMoveType = null;
        this.eventSettingsMoveSpeed = null;
        this.eventSettingsMoveFrequency = null;
        this.eventSettingsMoveRouteBtn = null;
        this.eventSettingsMoveRouteDraft = null;
        this.eventSettingsMoveRepeat = null;
        this.eventSettingsMoveSkippable = null;
        this.eventSettingsMoveWait = null;
        this.eventSettingsWalkAnime = null;
        this.eventSettingsStepAnime = null;
        this.eventSettingsDirectionFix = null;
        this.eventSettingsThrough = null;
        this.eventSettingsTransparentStart = null;
        this.eventSettingsTransparentStartRestore = null;
        this.eventSettingsTransparentStartPrevOn = false;
        this.eventSettingsPriorityType = null;
        this.eventSettingsTrigger = null;
        this.eventSettingsExecBody = null;
        this.eventSettingsExecList = null;
        this.eventSettingsExecJumpBtn = null;
        this.eventSettingsExecSig = '';
        this.eventSettingsExecFixedHeight = 0;
        this.battleEventSettingsBtn = null;
        this.battleEventSettingsModal = null;
        this.battleEventSettingsHead = null;
        this.battleEventSettingsTargetTroopId = 0;
        this.battleEventSettingsTargetPageIndex = 0;
        this.battleEventSettingsDraftTroop = null;
        this.battleEventSettingsDraftOriginal = null;
        this.battleEventSettingsPageSelect = null;
        this.battleEventTurnEnding = null;
        this.battleEventTurnValid = null;
        this.battleEventTurnA = null;
        this.battleEventTurnB = null;
        this.battleEventEnemyValid = null;
        this.battleEventEnemyIndex = null;
        this.battleEventEnemyHp = null;
        this.battleEventActorValid = null;
        this.battleEventActorId = null;
        this.battleEventActorHp = null;
        this.battleEventSwitchValid = null;
        this.battleEventSwitchId = null;
        this.battleEventSpan = null;
        this.switchPickerModal = null;
        this.switchPickerRangeList = null;
        this.switchPickerSwitchList = null;
        this.switchPickerNameInput = null;
        this.switchPickerResizeBtn = null;
        this.switchPickerLastUsedId = 0;
        this.variablePickerModal = null;
        this.variablePickerRangeList = null;
        this.variablePickerVariableList = null;
        this.variablePickerNameInput = null;
        this.variablePickerResizeBtn = null;
        this.variablePickerLastUsedId = 0;
        this.memoScrollLane = null;
        this._memoScrollLaneSig = '';
        this.memoLabelLayer = null;
        this._memoLabelLayerSig = '';
        this.animPreviewWrap = null;
        this.animPreviewViewport = null;
        this.animPreviewTitle = null;
        this.animPreviewSheetBtn = null;
        this.animPreviewInfo = null;
        this.animPreviewSheetWrap = null;
        this.animPreviewSheetCanvas = null;
        this.animPreviewSheetInfo = null;
        this.animPreviewSheetVisible = false;
        this.animPreviewSheetLastKey = '';
        this.animPreviewOverlay = null;
        this.animPreviewOverlayBox = null;
        this.animPreviewOverlayCanvas = null;
        this.animPreviewOverlayInfo = null;
        this.animPreviewRenderer = null;
        this.animPreviewRendererW = 0;
        this.animPreviewRendererH = 0;
        this.animPreviewStage = null;
        this.animPreviewBack = null;
        this.animPreviewWorld = null;
        this.animPreviewSprite = null;
        this.animPreviewProxyChar = null;
        this.animPreviewSourceChar = null;
        this.animPreviewTargetId = null;
        this.animPreviewPortraitSprite = null;
        this.animPreviewPortraitSpecSig = '';
        this.animPreviewPortraitStartedFrame = 0;
        this.animPreviewPendingSpec = null;
        this.animPreviewPendingSig = '';
        this.animPreviewPendingAt = 0;
        this.animPreviewLastAutoSig = '';
        this.animPreviewLoopNextAt = 0;
        this.animPreviewLogView = null;
        this.animPreviewLogLines = [];
        this.animPreviewPanX = 0;
        this.animPreviewPanY = 0;
        this.animPreviewPanDragging = false;
        this.animPreviewPanLastX = 0;
        this.animPreviewPanLastY = 0;
        this.rangeSelection = {
            kind: 'none',
            items: [],
            itemMap: Object.create(null),
            frameStart: 0,
            frameEnd: 0,
            rects: [],
            nonContiguous: false
        };
        this.timelineSelectionAnchor = null;
        this.rangeSelectDrag = null;
        this.rangeMoveDrag = null;
        this._charPanelSig = '';
        this._charInfoSig = '';
        this._charInfoBaselineMap = Object.create(null);
        this._charInfoTouchedMap = Object.create(null);
        this._charInfoStartupBaselineCaptured = false;
        this._charOverlaySig = '';
        this._overlayClickLastId = null;
        this._overlayClickLastAt = 0;
        this._charPanelNextRefresh = 0;
        this._simToRunning = false;
        this._simExecFrame = -1;
        this.resetSimAudioState();
        this.addModal = null;
        this.addPage = 1;
        this.addFrame = 0;
        this.addRowKey = 'main';
        this._pendingNewUid = 0;
        this._pendingNewConfirmed = false;
        this.tileMoveState = null;
        this.tileMoveMarker = null;
        this.tileMoveMarkerLabel = null;
        this.tileMoveStartMarker = null;
        this.tileMoveStartMarkerLabel = null;
        this.hoverTileMarker = null;
        this.hoverTileMarkerLabel = null;
        this.tileMoveStartGhost = null;
        this.routeTileEditorPickState = null;
        this.routeJumpEditorPickState = null;
        this.execLogLines = [];
        this.execLogMax = 240;
        this.execLogView = null;
        this._execNodePulses = Object.create(null);
        this._activeEditorMoveRoutes = [];
        this._editorMoveRouteWaitState = null;
        this._timelineAutoScrollAnim = null;
        this._timelineViewPending = null;
        this._timelineViewSessionStore = {};
        maximizeWindowForEditor(true);
        setTimeout(function() { maximizeWindowForEditor(true); }, 16);
        setTimeout(function() { maximizeWindowForEditor(true); }, 120);
        setTimeout(function() { maximizeWindowForEditor(true); }, 360);
        setTimeout(function() { maximizeWindowForEditor(true); }, 900);
        this.startWindowGuard();
        this.captureBase();
        if (typeof this.loadEePropReferenceDebug === 'function' && this.isCalcDebugEnabled()) {
            this.loadEePropReferenceDebug();
        }
        this.shrink();
        this._eeStartupTrackNormalizeDone = false;
        this._eeReadTracePhase = 'startup';
        this.buildUi();
        this.bind();
        this.setInteractionMode('timeline', 'start');
        this.selectInitial();
        if (typeof this.restoreRecoverySnapshotIfAvailable === 'function') this.restoreRecoverySnapshotIfAvailable();
        if (typeof this.normalizeRouteWaitMetaAfterStartupLoad === 'function') {
            this.normalizeRouteWaitMetaAfterStartupLoad();
        }
        this.pushSnap('init');
        this.rebuildSchedule({ skipRouteNormalize: true });
        this.runInitialVisualRefresh();
        this._eeReadTracePhase = 'runtime';
        this.msg('イベントエディタ起動（タイムライン編集モード）');
    };

    EE.prototype.injectStyle = function() {
        if (!NS._eeStyleText) throw new Error('Event editor style module is not loaded');
        var style = document.getElementById('knh-ee-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'knh-ee-style';
            document.head.appendChild(style);
        }
        if (style.textContent !== NS._eeStyleText) style.textContent = NS._eeStyleText;
    };

    EE.prototype.buildUi = function() {
        var self = this;
        this.injectStyle();
        var r = this.el('div', '');
        r.id = 'knh-ee';
        if (this.isBattleEventMode()) r.classList.add('ee-battle');
        this.gameBottomMask = this.el('div', 'gbm', '');
        r.appendChild(this.gameBottomMask);

        var l = this.el('div', 'p l');
        l.appendChild(this.el('div', 'ti', this.isBattleEventMode() ? 'バトルページ一覧' : 'キャラ＆イベント一覧'));
        this.charList = this.el('div', 'charlist');
        this.charList.addEventListener('wheel', function(e) {
            if (typeof self.onCharacterListWheel === 'function') self.onCharacterListWheel(e);
        }, { passive: false });
        l.appendChild(this.charList);
        r.appendChild(l);
        var ld = this.el('div', 'p ld');
        ld.appendChild(this.el('div', 'ti', this.isBattleEventMode() ? '条件サマリ' : '選択キャラ情報'));
        this.charInfo = this.el('div', 'cinfo', '未選択');
        ld.appendChild(this.charInfo);
        r.appendChild(ld);

        var rr = this.el('div', 'p r');
        rr.appendChild(this.el('div', 'ti', '選択イベント'));
        this.eventInfo = this.el('div', 'i', 'イベント未選択');
        rr.appendChild(this.eventInfo);
        this.battleEventSettingsBtn = this.btn('戦闘ページ設定', '', function() {
            self.openBattleEventSettingsEditor();
        });
        if (!this.isBattleEventMode()) this.battleEventSettingsBtn.style.display = 'none';
        rr.appendChild(this.battleEventSettingsBtn);
        rr.appendChild(this.el('div', 'ti', '実行ログ'));
        this.execLogView = this.el('div', 'elog', '');
        this.execLogView.addEventListener('wheel', function(e) { self.onExecutionLogWheel(e); }, { passive: false });
        rr.appendChild(this.execLogView);
        this.renderExecutionLog(true);
        r.appendChild(rr);

        var t = this.el('div', 'p t');
        this.timelinePanel = t;
        t.appendChild(this.el('div', 'ti', 'タイムライン'));
        this.timelineWrap = this.el('div', 'tv');
        this.timeline = this.el('canvas', 'cv');
        this.timelineWrap.appendChild(this.timeline);
        this.timelineOverlay = this.el('canvas', 'cv-overlay');
        this.timelineWrap.appendChild(this.timelineOverlay);
        t.appendChild(this.timelineWrap);
        this.memoLabelLayer = this.el('div', 'mmlbl-layer');
        r.appendChild(this.memoLabelLayer);
        this.memoScrollLane = this.el('div', 'mmlane');
        r.appendChild(this.memoScrollLane);
        this.tInfo = this.el('div', 'i', 'フレーム: 0');
        t.appendChild(this.tInfo);
        r.appendChild(t);

        this.status = this.el('div', 's', '');
        r.appendChild(this.status);
        this.mouseCoordInfo = this.el('div', 'mc', '');
        r.appendChild(this.mouseCoordInfo);

        this.tip = this.el('div', 'tk', '');
        r.appendChild(this.tip);
        this.gameFrame = this.el('div', 'gf', '');
        this.gameFrame.addEventListener('contextmenu', function(e) {
            self.onGameFrameContextMenu(e);
        });
        r.appendChild(this.gameFrame);
        this.gameViewportGuards = {
            top: this.el('div', 'gvg', ''),
            left: this.el('div', 'gvg', ''),
            right: this.el('div', 'gvg', ''),
            bottom: this.el('div', 'gvg', '')
        };
        r.appendChild(this.gameViewportGuards.top);
        r.appendChild(this.gameViewportGuards.left);
        r.appendChild(this.gameViewportGuards.right);
        r.appendChild(this.gameViewportGuards.bottom);
        this.gameViewportFrame = this.el('div', 'gfv', '');
        this.gameViewportFrame.addEventListener('contextmenu', function(e) {
            self.onGameFrameContextMenu(e);
        });
        r.appendChild(this.gameViewportFrame);
        this.charOverlayLayer = this.el('div', 'ovl');
        this.charOverlayLayer.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            var n = e.target;
            while (n && n !== self.charOverlayLayer && (!n.getAttribute || !n.getAttribute('data-char-id'))) {
                n = n.parentNode;
            }
            if (!n || n === self.charOverlayLayer) return;
            var cid = Number(n.getAttribute('data-char-id'));
            if (!isFinite(cid)) return;
            if (self.dragMode === 'tile') return;
            e.preventDefault();
            e.stopPropagation();
            self.selectCharacterForTimeline(cid, 'overlayName');
            var now = Date.now();
            var isDouble = (Number(self._overlayClickLastId) === Number(cid)) &&
                (now - Number(self._overlayClickLastAt || 0) <= 320);
            self._overlayClickLastId = Number(cid);
            self._overlayClickLastAt = now;
            if (!isDouble) return;
            var id = (typeof self.normalizeMoveTarget === 'function')
                ? self.normalizeMoveTarget(cid)
                : Math.floor(Number(cid || 0));
            id = Math.max(0, Math.floor(Number(id || 0)));
            var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[id] : null;
            if (!evData) {
                self.msg('イベントのみ編集できます');
                return;
            }
            self.openEventSettingsEditor(id);
        });
        this.charOverlayLayer.addEventListener('contextmenu', function(e) {
            var n = e.target;
            while (n && n !== self.charOverlayLayer && (!n.getAttribute || !n.getAttribute('data-char-id'))) {
                n = n.parentNode;
            }
            if (!n || n === self.charOverlayLayer) return;
            var cid = Number(n.getAttribute('data-char-id'));
            if (!isFinite(cid)) return;
            if (self.dragMode === 'tile') return;
            e.preventDefault();
            e.stopPropagation();
            self.selectCharacterForTimeline(cid, 'overlayName');
            self.openCharContextMenu(cid, e.clientX, e.clientY);
        });
        r.appendChild(this.charOverlayLayer);
        this.contextEventOriginLine = this.el('div', 'oadjline');
        this.contextEventOriginLineLabel = this.el('div', 'oadjlbl', '');
        this.contextEventOriginLine.appendChild(this.contextEventOriginLineLabel);
        r.appendChild(this.contextEventOriginLine);
        this.contextEventRangeLayer = this.el('div', 'radj');
        this.contextEventRangeLayer.addEventListener('mousedown', function(e) {
            if (!self.contextEventAdjustState || String(self.contextEventAdjustState.type || '') !== 'range') return;
            e.preventDefault();
            e.stopPropagation();
        });
        this.contextEventRangeLayer.addEventListener('mouseup', function(e) {
            if (!self.contextEventAdjustState || String(self.contextEventAdjustState.type || '') !== 'range') return;
            e.preventDefault();
            e.stopPropagation();
        });
        this.contextEventRangeLayer.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        this.contextEventRangeLayer.addEventListener('click', function(e) {
            if (self.contextEventAdjustState && String(self.contextEventAdjustState.type || '') === 'range') {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof self.onContextEventRangeLayerClick === 'function') {
                self.onContextEventRangeLayerClick(e);
            }
        });
        r.appendChild(this.contextEventRangeLayer);
        this.tileMoveStartGhost = this.el('canvas', 'tmg');
        r.appendChild(this.tileMoveStartGhost);
        this.tileMoveMarker = this.el('div', 'tmk');
        this.tileMoveMarkerLabel = this.el('div', 'tmkl', '');
        this.tileMoveMarker.appendChild(this.tileMoveMarkerLabel);
        r.appendChild(this.tileMoveMarker);
        this.tileMoveStartMarker = this.el('div', 'tmk start');
        this.tileMoveStartMarkerLabel = this.el('div', 'tmkl', '');
        this.tileMoveStartMarker.appendChild(this.tileMoveStartMarkerLabel);
        r.appendChild(this.tileMoveStartMarker);
        this.hoverTileMarker = this.el('div', 'tmk hover');
        this.hoverTileMarkerLabel = this.el('div', 'tmkl', '');
        this.hoverTileMarker.appendChild(this.hoverTileMarkerLabel);
        r.appendChild(this.hoverTileMarker);
        this.charCtx = this.el('div', 'chctx');
        this.charCtxCmdAddBtn = this.el('button', '', 'コマンド追加');
        this.charCtxCmdAddBtn.type = 'button';
        this.charCtxCmdAddBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openContextCharacterRouteCommandPanel();
        });
        this.charCtxTileMoveBtn = this.el('button', '', 'タイル移動');
        this.charCtxTileMoveBtn.type = 'button';
        this.charCtxTileMoveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.beginTileMoveForContextCharacter();
        });
        this.charCtxTeleportBtn = this.el('button', '', '瞬間移動');
        this.charCtxTeleportBtn.type = 'button';
        this.charCtxTeleportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.beginTeleportForContextCharacter();
        });
        this.charCtxInitPosBtn = this.el('button', '', '初期位置編集');
        this.charCtxInitPosBtn.type = 'button';
        this.charCtxInitPosBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.beginInitialPositionEditForContextCharacter();
        });
        this.charCtxEditBtn = this.el('button', '', '編集');
        this.charCtxEditBtn.type = 'button';
        this.charCtxEditBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openEventSettingsEditorFromContext();
        });
        this.charCtxShiftAdjustBtn = this.el('button', '', 'シフト調整');
        this.charCtxShiftAdjustBtn.type = 'button';
        this.charCtxShiftAdjustBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof self.beginContextEventShiftAdjust === 'function') self.beginContextEventShiftAdjust();
        });
        this.charCtxOriginAdjustBtn = this.el('button', '', '原点Y調整');
        this.charCtxOriginAdjustBtn.type = 'button';
        this.charCtxOriginAdjustBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof self.beginContextEventOriginYAdjust === 'function') self.beginContextEventOriginYAdjust();
        });
        this.charCtxRangeAdjustBtn = this.el('button', '', '当たり判定設定');
        this.charCtxRangeAdjustBtn.type = 'button';
        this.charCtxRangeAdjustBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof self.beginContextEventRangeAdjust === 'function') self.beginContextEventRangeAdjust();
        });
        this.charCtxCreateBtn = this.el('button', '', 'イベント新規作成');
        this.charCtxCreateBtn.type = 'button';
        this.charCtxCreateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof self.createMapEventFromCharContextMenu === 'function') self.createMapEventFromCharContextMenu();
        });
        this.charCtx.appendChild(this.charCtxCmdAddBtn);
        this.charCtx.appendChild(this.charCtxTileMoveBtn);
        this.charCtx.appendChild(this.charCtxTeleportBtn);
        this.charCtx.appendChild(this.charCtxInitPosBtn);
        this.charCtx.appendChild(this.charCtxEditBtn);
        this.charCtx.appendChild(this.charCtxShiftAdjustBtn);
        this.charCtx.appendChild(this.charCtxOriginAdjustBtn);
        this.charCtx.appendChild(this.charCtxRangeAdjustBtn);
        this.charCtx.appendChild(this.charCtxCreateBtn);
        r.appendChild(this.charCtx);
        this.charCtxTargetId = null;
        this.cameraCtx = this.el('div', 'camctx');
        this.cameraCtxScrollBtn = this.el('button', '', 'カメラ移動');
        this.cameraCtxScrollBtn.type = 'button';
        this.cameraCtxScrollBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.addCameraMoveCommandFromContextMenu('scroll');
        });
        this.cameraCtxScrollToBtn = this.el('button', '', 'カメラ移動(直接指定)');
        this.cameraCtxScrollToBtn.type = 'button';
        this.cameraCtxScrollToBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.addCameraMoveCommandFromContextMenu('scrollTo');
        });
        this.cameraCtx.appendChild(this.cameraCtxScrollBtn);
        this.cameraCtx.appendChild(this.cameraCtxScrollToBtn);
        r.appendChild(this.cameraCtx);
        this.mapCreateCtx = this.el('div', 'mpctx');
        this.mapCreateCtxCreateBtn = this.el('button', '', 'イベント新規作成');
        this.mapCreateCtxCreateBtn.type = 'button';
        this.mapCreateCtxCreateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.createMapEventFromContextMenu();
        });
        this.mapCreateCtx.appendChild(this.mapCreateCtxCreateBtn);
        r.appendChild(this.mapCreateCtx);
        this.routeCtx = this.el('div', 'rtctx');
        this.routeCtxAddBtn = this.el('button', '', 'コマンド追加');
        this.routeCtxAddBtn.type = 'button';
        this.routeCtxAddBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openFrameAddCommandFromContextMenu();
        });
        this.routeCtxAddBeforeBtn = this.el('button', '', '直前にコマンド追加');
        this.routeCtxAddBeforeBtn.type = 'button';
        this.routeCtxAddBeforeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openRelativeAddCommandFromContextMenu('before');
        });
        this.routeCtxAddAfterBtn = this.el('button', '', '直後にコマンド追加');
        this.routeCtxAddAfterBtn.type = 'button';
        this.routeCtxAddAfterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openRelativeAddCommandFromContextMenu('after');
        });
        this.routeCtxMemoBtn = this.el('button', '', 'メモ作成');
        this.routeCtxMemoBtn.type = 'button';
        this.routeCtxMemoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openMemoCreateFromContextMenu();
        });
        this.routeCtxCopyBtn = this.el('button', '', 'コピー');
        this.routeCtxCopyBtn.type = 'button';
        this.routeCtxCopyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.copyFromContextMenu();
        });
        this.routeCtxCutBtn = this.el('button', '', '切り取り');
        this.routeCtxCutBtn.type = 'button';
        this.routeCtxCutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.cutFromContextMenu();
        });
        this.routeCtxPasteBtn = this.el('button', '', '貼り付け');
        this.routeCtxPasteBtn.type = 'button';
        this.routeCtxPasteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.pasteFromContextMenu();
        });
        this.routeCtxColorLabel = this.el('div', 'rtctxclrlabel', '◯の色');
        this.routeCtxColorWrap = this.el('div', 'rtctxclr');
        this.routeCtxColorBtns = [];
        var markerPalette = (typeof this.commandMarkerColorPalette === 'function')
            ? this.commandMarkerColorPalette()
            : [
                { id: 'lime', label: '緑' },
                { id: 'yellow', label: '青' },
                { id: 'orange', label: '橙' },
                { id: 'red', label: '赤' },
                { id: 'blue', label: '青' },
                { id: 'cyan', label: '水' },
                { id: 'purple', label: '紫' },
                { id: 'gray', label: '灰' }
            ];
        for (var pi = 0; pi < markerPalette.length; pi++) {
            var clrSpec = markerPalette[pi] || {};
            var clrBtn = this.el('button', '', '');
            var clrId = String(clrSpec.id == null ? '' : clrSpec.id);
            clrBtn.type = 'button';
            clrBtn.dataset.markerColor = clrId;
            clrBtn.title = String(clrSpec.label || clrId || '色');
            if (clrSpec.fill) clrBtn.style.background = String(clrSpec.fill);
            if (clrSpec.textColor) clrBtn.style.color = String(clrSpec.textColor);
            if (clrSpec.border) clrBtn.style.borderColor = String(clrSpec.border);
            (function(colorId) {
                clrBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.applySelectedCommandMarkerColorFromContext(colorId);
                });
            })(clrId);
            this.routeCtxColorWrap.appendChild(clrBtn);
            this.routeCtxColorBtns.push(clrBtn);
        }
        var clrClearBtn = this.el('button', '', '×');
        clrClearBtn.type = 'button';
        clrClearBtn.dataset.markerColor = '';
        clrClearBtn.title = '色を解除';
        clrClearBtn.style.background = 'rgba(52,58,64,.96)';
        clrClearBtn.style.color = 'rgba(244,248,255,.96)';
        clrClearBtn.style.borderColor = 'rgba(180,196,214,.58)';
        clrClearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.applySelectedCommandMarkerColorFromContext('');
        });
        this.routeCtxColorWrap.appendChild(clrClearBtn);
        this.routeCtxColorBtns.push(clrClearBtn);
        this.routeCtxSkippableBtn = this.el('button', '', '移動できない場合は飛ばす: OFF');
        this.routeCtxSkippableBtn.type = 'button';
        this.routeCtxSkippableBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.toggleRouteRangeOption('skippable');
        });
        this.routeCtxRepeatBtn = this.el('button', '', '動作を繰り返す: OFF');
        this.routeCtxRepeatBtn.type = 'button';
        this.routeCtxRepeatBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.toggleRouteRangeOption('repeat');
        });
        this.routeCtxWaitBtn = this.el('button', '', '完了までウェイト: ON');
        this.routeCtxWaitBtn.type = 'button';
        this.routeCtxWaitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.toggleRouteRangeOption('wait');
        });
        this.routeCtxInsertWaitBtn = this.el('button', '', 'ウェイトの挿入...');
        this.routeCtxInsertWaitBtn.type = 'button';
        this.routeCtxInsertWaitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openWaitInsertDialogFromContextMenu();
        });
        this.routeCtxSqueezeBtn = this.el('button', '', '詰める');
        this.routeCtxSqueezeBtn.type = 'button';
        this.routeCtxSqueezeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.executeSelectionSqueezeFromContextMenu();
        });
        this.routeCtxWaitArrangeBtn = this.el('button', '', 'ウェイトを整理');
        this.routeCtxWaitArrangeBtn.type = 'button';
        this.routeCtxWaitArrangeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.executeSelectionMessageWaitArrangeFromContextMenu();
        });
        this.routeCtxMergeBtn = this.el('button', '', '移動ルートの結合');
        this.routeCtxMergeBtn.type = 'button';
        this.routeCtxMergeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.executeSelectionRouteMergeFromContextMenu();
        });
        this.routeCtxMessageBubbleBulkBtn = this.el('button', '', 'ふきだし位置一括設定');
        this.routeCtxMessageBubbleBulkBtn.type = 'button';
        this.routeCtxMessageBubbleBulkBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openMessageBubbleBulkDialogFromContextMenu();
        });
        this.routeCtxEndPlus300Btn = this.el('button', '', '300f後ろへ');
        this.routeCtxEndPlus300Btn.type = 'button';
        this.routeCtxEndPlus300Btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.shiftSelectedTrackEndFrameFromContextMenu(300);
        });
        this.routeCtxEndToLastCmdBtn = this.el('button', '', '最後のコマンド位置へ');
        this.routeCtxEndToLastCmdBtn.type = 'button';
        this.routeCtxEndToLastCmdBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.snapSelectedTrackEndFrameToLastCommandFromContextMenu();
        });
        this.routeCtx.appendChild(this.routeCtxAddBtn);
        this.routeCtx.appendChild(this.routeCtxAddBeforeBtn);
        this.routeCtx.appendChild(this.routeCtxAddAfterBtn);
        this.routeCtx.appendChild(this.routeCtxMemoBtn);
        this.routeCtx.appendChild(this.routeCtxCopyBtn);
        this.routeCtx.appendChild(this.routeCtxCutBtn);
        this.routeCtx.appendChild(this.routeCtxPasteBtn);
        this.routeCtx.appendChild(this.routeCtxSkippableBtn);
        this.routeCtx.appendChild(this.routeCtxRepeatBtn);
        this.routeCtx.appendChild(this.routeCtxWaitBtn);
        this.routeCtx.appendChild(this.routeCtxInsertWaitBtn);
        this.routeCtx.appendChild(this.routeCtxSqueezeBtn);
        this.routeCtx.appendChild(this.routeCtxWaitArrangeBtn);
        this.routeCtx.appendChild(this.routeCtxMergeBtn);
        this.routeCtx.appendChild(this.routeCtxMessageBubbleBulkBtn);
        this.routeCtx.appendChild(this.routeCtxEndPlus300Btn);
        this.routeCtx.appendChild(this.routeCtxEndToLastCmdBtn);
        this.routeCtx.appendChild(this.routeCtxColorLabel);
        this.routeCtx.appendChild(this.routeCtxColorWrap);
        r.appendChild(this.routeCtx);
        this.routeRangeCtxUid = 0;

        this.buildEditorModal(r);
        this.buildSimplePromptModal(r);
        this.buildSwitchPickerModal(r);
        this.buildVariablePickerModal(r);
        this.buildAddCommandModal(r);
        this.buildWaitInsertModal(r);
        this.buildMessageBubbleBulkModal(r);
        this.buildMemoModal(r);
        this.buildRouteCommandModal(r);
        this.buildEventSettingsModal(r);
        this.buildEventSettingsNoteZoomModal(r);
        this.buildEventSettingsImagePickerModal(r);
        this.buildBattleEventSettingsModal(r);
        this.buildSePickerModal(r);
        this.setupEditorModalRegistry();

        document.body.appendChild(r);
        this.root = r;
        this.refreshCharacterPanel(true);
        this.syncTimelineSize();
    };

    EE.prototype.registerEditorModal = function(name, propertyName, close) {
        if (!name || !propertyName) return;
        if (!Array.isArray(this._editorModalRegistry)) this._editorModalRegistry = [];
        this._editorModalRegistry.push({
            name: String(name),
            propertyName: String(propertyName),
            close: typeof close === 'function' ? close : null
        });
    };

    EE.prototype.setupEditorModalRegistry = function() {
        var self = this;
        this._editorModalRegistry = [];
        this.registerEditorModal('command', 'modal', function() { self.closeEditor(); });
        this.registerEditorModal('addCommand', 'addModal', function() { self.closeAddCommandPanel(); });
        this.registerEditorModal('waitInsert', 'waitInsertModal', function() { self.closeWaitInsertDialog(); });
        this.registerEditorModal('messageBubbleBulk', 'messageBubbleBulkModal', function() { self.closeMessageBubbleBulkDialog(); });
        this.registerEditorModal('memo', 'memoModal', function() { self.closeMemoEditor(); });
        this.registerEditorModal('routeCommand', 'routeModal', function() { self.closeRouteCommandPanel(); });
        this.registerEditorModal('eventSettings', 'eventSettingsModal', function() { self.closeEventSettingsEditor(); });
        this.registerEditorModal('eventSettingsNote', 'eventSettingsNoteZoomModal', function() { self.closeEventSettingsNoteZoom(true); });
        this.registerEditorModal('eventSettingsImage', 'eventSettingsImagePickerModal', function() { self.closeEventSettingsImagePicker(false); });
        this.registerEditorModal('battleSettings', 'battleEventSettingsModal', function() { self.closeBattleEventSettingsEditor(); });
        this.registerEditorModal('soundPicker', 'sePickerModal', function() { self.closeSePicker(false); });
        this.registerEditorModal('switchPicker', 'switchPickerModal', function() { self.closeSwitchPickerForEditor(false); });
        this.registerEditorModal('variablePicker', 'variablePickerModal', function() { self.closeVariablePickerForEditor(false); });
        this.registerEditorModal('prompt', 'simplePromptModal', function() { self.closeEditorPromptDialog(false); });
    };

    EE.prototype.openEditorModalRecord = function(name) {
        var registry = Array.isArray(this._editorModalRegistry) ? this._editorModalRegistry : [];
        for (var i = registry.length - 1; i >= 0; i--) {
            var record = registry[i];
            if (name && record.name !== name) continue;
            var node = this[record.propertyName];
            if (node && node.classList && node.classList.contains('on')) return record;
        }
        return null;
    };

    EE.prototype.isAnyRegisteredEditorModalOpen = function() {
        return !!this.openEditorModalRecord();
    };

    EE.prototype.closeTopEditorModalOnEscape = function(e) {
        var record = this.openEditorModalRecord();
        if (!record || typeof record.close !== 'function') return false;
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        record.close();
        return true;
    };

    EE.prototype.buildSimplePromptModal = function(root) {
        var self = this;
        var mb = this.el('div', 'mb ee-prompt');
        var w = this.el('div', 'mw');
        mb.appendChild(w);
        this.simplePromptTitle = this.el('div', 'h', '入力');
        w.appendChild(this.simplePromptTitle);
        var sec = this.el('div', 'sec');
        this.simplePromptLabel = this.el('label', '', '値');
        this.simplePromptLabel.style.whiteSpace = 'pre-wrap';
        sec.appendChild(this.simplePromptLabel);
        this.simplePromptInput = this.el('input', '');
        this.simplePromptInput.type = 'text';
        sec.appendChild(this.simplePromptInput);
        this.simplePromptTextarea = this.el('textarea', '');
        this.simplePromptTextarea.rows = 12;
        this.simplePromptTextarea.style.display = 'none';
        sec.appendChild(this.simplePromptTextarea);
        w.appendChild(sec);
        var buttons = this.el('div', 'ed-btns');
        this.simplePromptOkButton = this.btn('OK', 'good', function() { self.closeEditorPromptDialog(true); });
        this.simplePromptCancelButton = this.btn('キャンセル', '', function() { self.closeEditorPromptDialog(false); });
        buttons.appendChild(this.simplePromptOkButton);
        buttons.appendChild(this.simplePromptCancelButton);
        w.appendChild(buttons);
        mb.addEventListener('click', function(e) {
            if (e.target === mb) self.closeEditorPromptDialog(false);
        });
        mb.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                self.closeEditorPromptDialog(false);
                return;
            }
            var multiline = !!(self.simplePromptRequest && self.simplePromptRequest.multiline);
            if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                self.closeEditorPromptDialog(true);
            }
        });
        this.simplePromptModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.openEditorPromptDialog = function(options) {
        options = options || {};
        if (!this.simplePromptModal || !this.simplePromptInput || !this.simplePromptTextarea) return false;
        this.simplePromptRequest = options;
        var confirmOnly = !!options.confirmOnly;
        var multiline = !!options.multiline;
        var field = multiline ? this.simplePromptTextarea : this.simplePromptInput;
        this.simplePromptTitle.textContent = String(options.title || '入力');
        this.simplePromptLabel.textContent = String(options.message == null ? (options.label || '値') : options.message);
        this.simplePromptInput.style.display = confirmOnly || multiline ? 'none' : '';
        this.simplePromptTextarea.style.display = confirmOnly || !multiline ? 'none' : '';
        if (!confirmOnly && !multiline) {
            this.simplePromptInput.type = String(options.type || 'text');
            this.simplePromptInput.min = options.min == null ? '' : String(options.min);
            this.simplePromptInput.max = options.max == null ? '' : String(options.max);
            this.simplePromptInput.step = options.step == null ? '' : String(options.step);
        }
        if (!confirmOnly) field.value = String(options.value == null ? '' : options.value);
        if (this.simplePromptOkButton) this.simplePromptOkButton.textContent = String(options.okText || 'OK');
        if (this.simplePromptCancelButton) this.simplePromptCancelButton.textContent = String(options.cancelText || 'キャンセル');
        this.simplePromptModal.classList.add('on');
        var focusTarget = confirmOnly ? this.simplePromptOkButton : field;
        setTimeout(function() {
            try {
                focusTarget.focus();
                if (!confirmOnly && focusTarget.select) focusTarget.select();
            } catch (_) {}
        }, 0);
        return true;
    };

    EE.prototype.closeEditorPromptDialog = function(apply) {
        if (!this.simplePromptModal || !this.simplePromptModal.classList.contains('on')) return false;
        var request = this.simplePromptRequest || {};
        var field = request.multiline ? this.simplePromptTextarea : this.simplePromptInput;
        if (apply && typeof request.onApply === 'function') {
            try {
                if (request.onApply(String(field && field.value || '')) === false) return false;
            } catch (e) {
                if (typeof this.err === 'function') this.err('E_PROMPT_APPLY', e);
                return false;
            }
        }
        if (!apply && typeof request.onCancel === 'function') {
            try { request.onCancel(); } catch (e2) {
                if (typeof this.err === 'function') this.err('E_PROMPT_CANCEL', e2);
            }
        }
        this.simplePromptModal.classList.remove('on');
        this.simplePromptRequest = null;
        return true;
    };

    EE.prototype.openEditorConfirmDialog = function(options) {
        options = options || {};
        return this.openEditorPromptDialog({
            confirmOnly: true,
            title: String(options.title || '確認'),
            message: String(options.message || ''),
            okText: String(options.okText || 'OK'),
            cancelText: String(options.cancelText || 'キャンセル'),
            onApply: options.onConfirm,
            onCancel: options.onCancel
        });
    };

    EE.prototype.openEditorIntegerPrompt = function(title, value, min, max, onApply) {
        var self = this;
        return this.openEditorPromptDialog({
            title: title,
            label: String(min) + '〜' + String(max) + ' の整数',
            type: 'number',
            value: value,
            min: min,
            max: max,
            step: 1,
            onApply: function(raw) {
                var number = Number(raw);
                if (!isFinite(number) || Math.floor(number) !== number || number < min || number > max) {
                    self.msg(String(min) + '〜' + String(max) + ' の整数で入力してください');
                    return false;
                }
                return typeof onApply === 'function' ? onApply(number) : true;
            }
        });
    };

    EE.prototype.buildEditorModal = function(root) {
        var self = this;
        var mb = this.el('div', 'mb');
        this.modalTilePickMask = {
            top: this.el('div', 'mbtp', ''),
            left: this.el('div', 'mbtp', ''),
            right: this.el('div', 'mbtp', ''),
            bottom: this.el('div', 'mbtp', '')
        };
        var closeFromMask = function(e) {
            if (!self.isRouteEditorMapPickerMode || !self.isRouteEditorMapPickerMode()) return;
            e.preventDefault();
            e.stopPropagation();
            self.closeEditor();
        };
        this.modalTilePickMask.top.addEventListener('mousedown', closeFromMask);
        this.modalTilePickMask.left.addEventListener('mousedown', closeFromMask);
        this.modalTilePickMask.right.addEventListener('mousedown', closeFromMask);
        this.modalTilePickMask.bottom.addEventListener('mousedown', closeFromMask);
        mb.appendChild(this.modalTilePickMask.top);
        mb.appendChild(this.modalTilePickMask.left);
        mb.appendChild(this.modalTilePickMask.right);
        mb.appendChild(this.modalTilePickMask.bottom);
        var w = this.el('div', 'mw');
        mb.appendChild(w);
        this.modalWin = w;
        this.editUid = 0;
        this.editRouteListIndex = -1;
        this.edHead = this.el('div', 'h', 'コマンド編集');
        w.appendChild(this.edHead);
        var sec = this.el('div', 'sec');
        w.appendChild(sec);
        this.edGenericWrap = this.el('div', '');
        sec.appendChild(this.edGenericWrap);
        this.edGenericWrap.appendChild(this.el('label', '', 'コード'));
        this.edCode = this.el('input', '');
        this.edCode.type = 'number';
        this.edCode.readOnly = true;
        this.attachNumberWheelInput(this.edCode);
        this.edGenericWrap.appendChild(this.edCode);
        this.edGenericWrap.appendChild(this.el('label', '', 'インデント'));
        this.edIndent = this.el('input', '');
        this.edIndent.type = 'number';
        this.edIndent.step = '1';
        this.attachNumberWheelInput(this.edIndent);
        this.edGenericWrap.appendChild(this.edIndent);
        this.edParamListLabel = this.el('label', '', 'パラメータ');
        this.edGenericWrap.appendChild(this.edParamListLabel);
        this.edParamList = this.el('div', 'plist');
        this.edGenericWrap.appendChild(this.edParamList);
        this.edParamInputs = [];
        this.edParams = this.el('textarea', '');
        this.edParams.style.display = 'none';
        this.edGenericWrap.appendChild(this.edParams);

        this.ed101Wrap = this.el('div', 'ed101');
        this.ed101Wrap.style.display = 'none';
        this.ed101Wrap.appendChild(this.el('label', '', '文章 (1行=401)'));
        this.ed101Text = this.el('textarea', '');
        this.ed101Wrap.appendChild(this.ed101Text);
        sec.appendChild(this.ed101Wrap);

        this.ed121Wrap = this.el('div', 'ed121');
        this.ed121Wrap.style.display = 'none';
        var sSwitch = this.el('div', 'ed121-box');
        sSwitch.appendChild(this.el('div', 'ed121-title', 'スイッチ'));
        var typeRadio = this.el('div', 'ed121-radio');
        this.ed121Single = this.el('input', '');
        this.ed121Single.type = 'radio';
        this.ed121Single.name = 'knh-ee-swtype';
        this.ed121Single.value = 'single';
        this.ed121Range = this.el('input', '');
        this.ed121Range.type = 'radio';
        this.ed121Range.name = 'knh-ee-swtype';
        this.ed121Range.value = 'range';
        var l1 = this.el('label', '', '');
        l1.appendChild(this.ed121Single);
        l1.appendChild(this.el('span', '', ' 単独'));
        var l2 = this.el('label', '', '');
        l2.appendChild(this.ed121Range);
        l2.appendChild(this.el('span', '', ' 範囲'));
        typeRadio.appendChild(l1);
        typeRadio.appendChild(l2);
        sSwitch.appendChild(typeRadio);
        var sNumRow = this.el('div', 'ed121-num');
        this.ed121From = this.el('input', '');
        this.ed121From.type = 'text';
        this.ed121From.readOnly = true;
        this.ed121From.title = 'クリックでスイッチ選択';
        this.ed121To = this.el('input', '');
        this.ed121To.type = 'text';
        this.ed121To.readOnly = true;
        this.ed121To.title = 'クリックでスイッチ選択';
        sNumRow.appendChild(this.ed121From);
        this.ed121RangeSep = this.el('div', 'ed121-sep', '~');
        sNumRow.appendChild(this.ed121RangeSep);
        sNumRow.appendChild(this.ed121To);
        sSwitch.appendChild(sNumRow);
        this.ed121Wrap.appendChild(sSwitch);

        var sOp = this.el('div', 'ed121-box');
        sOp.appendChild(this.el('div', 'ed121-title', '操作'));
        var opRow = this.el('div', 'ed121-op');
        this.ed121On = this.el('input', '');
        this.ed121On.type = 'radio';
        this.ed121On.name = 'knh-ee-swop';
        this.ed121On.value = '0';
        this.ed121Off = this.el('input', '');
        this.ed121Off.type = 'radio';
        this.ed121Off.name = 'knh-ee-swop';
        this.ed121Off.value = '1';
        var o1 = this.el('label', '', '');
        o1.appendChild(this.ed121On);
        o1.appendChild(this.el('span', '', ' ON'));
        var o2 = this.el('label', '', '');
        o2.appendChild(this.ed121Off);
        o2.appendChild(this.el('span', '', ' OFF'));
        opRow.appendChild(o1);
        opRow.appendChild(o2);
        sOp.appendChild(opRow);
        this.ed121Wrap.appendChild(sOp);

        this.ed121RangeList = null;
        this.ed121SwitchList = null;
        this.ed121Note = null;
        sec.appendChild(this.ed121Wrap);
        this.edSchemaWrap = this.el('div', 'sf');
        this.edSchemaWrap.style.display = 'none';
        this.edSchemaHead = this.el('div', 'sfh', '');
        this.edSchemaDesc = this.el('div', 'sfd', '');
        this.edSchemaBody = this.el('div', 'sfbody');
        this.edSchemaFields = this.el('div', 'sff');
        this.edSchemaWrap.appendChild(this.edSchemaHead);
        this.edSchemaWrap.appendChild(this.edSchemaDesc);
        this.edSchemaBody.appendChild(this.edSchemaFields);
        this.animPreviewWrap = this.el('div', 'apv');
        this.animPreviewWrap.style.display = 'none';
        var apvHd = this.el('div', 'apv-hd');
        this.animPreviewTitle = this.el('div', 'apv-ttl', 'プレビュー（自動再生）');
        apvHd.appendChild(this.animPreviewTitle);
        var apvCtl = this.el('div', 'apv-ctl');
        this.animPreviewSheetBtn = this.el('button', 'apv-btn', '現在画像');
        this.animPreviewSheetBtn.type = 'button';
        this.animPreviewSheetBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.openAnimationPreviewImageOverlayFromEditor();
        });
        apvCtl.appendChild(this.animPreviewSheetBtn);
        apvHd.appendChild(apvCtl);
        this.animPreviewWrap.appendChild(apvHd);
        this.animPreviewViewport = this.el('div', 'apv-vp');
        this.animPreviewViewport.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            if (!self.isAnimationPreviewEditorActive()) return;
            e.preventDefault();
            e.stopPropagation();
            self.startAnimationPreviewPanDrag(Number(e.clientX || 0), Number(e.clientY || 0));
        });
        this.animPreviewViewport.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.animPreviewPanX = 0;
            self.animPreviewPanY = 0;
            self.pushAnimationPreviewLog('pan reset');
        });
        this.animPreviewWrap.appendChild(this.animPreviewViewport);
        this.animPreviewInfo = this.el('div', 'apv-info', '');
        this.animPreviewWrap.appendChild(this.animPreviewInfo);
        this.animPreviewSheetWrap = this.el('div', 'apv-sheet');
        this.animPreviewSheetCanvas = document.createElement('canvas');
        this.animPreviewSheetCanvas.width = 64;
        this.animPreviewSheetCanvas.height = 64;
        this.animPreviewSheetWrap.appendChild(this.animPreviewSheetCanvas);
        this.animPreviewSheetInfo = this.el('div', 'apv-sheet-info', '');
        this.animPreviewSheetWrap.appendChild(this.animPreviewSheetInfo);
        this.animPreviewWrap.appendChild(this.animPreviewSheetWrap);
        this.animPreviewLogView = this.el('div', 'apv-log', '');
        this.animPreviewWrap.appendChild(this.animPreviewLogView);
        this.edSchemaBody.appendChild(this.animPreviewWrap);
        this.edSchemaWrap.appendChild(this.edSchemaBody);
        sec.appendChild(this.edSchemaWrap);
        this.editSchema = null;
        this.editSchemaBindings = [];
        this.ed121PickTarget = 'from';
        var self2 = this;
        this.ed121Single.addEventListener('change', function() { self2.syncSwitchEditorType(); });
        this.ed121Range.addEventListener('change', function() { self2.syncSwitchEditorType(); });
        this.ed121From.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof self2.openSwitchPickerForEditor === 'function') self2.openSwitchPickerForEditor('from');
        });
        this.ed121To.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof self2.openSwitchPickerForEditor === 'function') self2.openSwitchPickerForEditor('to');
        });
        this.ed121From.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            if (typeof self2.openSwitchPickerForEditor === 'function') self2.openSwitchPickerForEditor('from');
        });
        this.ed121To.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            if (typeof self2.openSwitchPickerForEditor === 'function') self2.openSwitchPickerForEditor('to');
        });

        this.edMessageLabel = this.el('label', '', '文章行 (1行=401)');
        this.edMessageText = this.el('textarea', '');
        this.edMessageLabel.style.display = 'none';
        this.edMessageText.style.display = 'none';
        sec.appendChild(this.edMessageLabel);
        sec.appendChild(this.edMessageText);
        this.edCommentLabel = this.el('label', '', '注釈テキスト (1行=108/408)');
        this.edCommentText = this.el('textarea', '');
        this.edCommentLabel.style.display = 'none';
        this.edCommentText.style.display = 'none';
        sec.appendChild(this.edCommentLabel);
        sec.appendChild(this.edCommentText);
        this.edScriptLabel = this.el('label', '', 'スクリプト行 (355 + 655)');
        this.edScriptText = this.el('textarea', 'ed-script355-text');
        this.edScriptText.rows = 21;
        this.edScriptText.addEventListener('input', function() {
            if (typeof self.updateScriptEditorOkState === 'function') self.updateScriptEditorOkState();
        });
        this.edScriptLabel.style.display = 'none';
        this.edScriptText.style.display = 'none';
        sec.appendChild(this.edScriptLabel);
        sec.appendChild(this.edScriptText);
        var rw = this.el('div', 'ed-btns');
        this.edOkBtn = this.btn('OK', 'good', function() { self.applyEditor(); });
        this.edDeleteBtn = this.btn('削除', 'warn', function() { self.delSel(); self.closeEditor(); });
        this.edCancelBtn = this.btn('キャンセル', '', function() { self.closeEditor(); });
        rw.appendChild(this.edOkBtn);
        rw.appendChild(this.edDeleteBtn);
        rw.appendChild(this.edCancelBtn);
        w.appendChild(rw);
        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            if (self.isRouteEditorMapPickerMode && self.isRouteEditorMapPickerMode()) return;
            self.closeEditor();
        });
        this.modal = mb;
        root.appendChild(mb);

        this.animPreviewOverlay = this.el('div', 'apvov');
        this.animPreviewOverlayBox = this.el('div', 'apvov-box');
        this.animPreviewOverlayCanvas = document.createElement('canvas');
        this.animPreviewOverlayCanvas.width = 128;
        this.animPreviewOverlayCanvas.height = 128;
        this.animPreviewOverlayInfo = this.el('div', 'apvov-info', '');
        this.animPreviewOverlayBox.appendChild(this.animPreviewOverlayCanvas);
        this.animPreviewOverlayBox.appendChild(this.animPreviewOverlayInfo);
        this.animPreviewOverlay.appendChild(this.animPreviewOverlayBox);
        this.animPreviewOverlay.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.closeAnimationPreviewImageOverlay();
        });
        root.appendChild(this.animPreviewOverlay);
    };

    EE.prototype.buildSwitchPickerModal = function(root) {
        this.buildSystemNamePickerModal(root, 'switch');
    };

    EE.prototype.buildVariablePickerModal = function(root) {
        this.buildSystemNamePickerModal(root, 'variable');
    };

    EE.prototype.buildSystemNamePickerModal = function(root, kind) {
        var self = this;
        var variable = String(kind || '') === 'variable';
        var config = variable ? {
            label: '変数', modalKey: 'variablePickerModal', rangeKey: 'variablePickerRangeList',
            itemKey: 'variablePickerVariableList', nameKey: 'variablePickerNameInput',
            resizeKey: 'variablePickerResizeBtn', refreshMethod: 'refreshVariablePickerVariableList',
            selectionMethod: 'onVariablePickerSelectionChange', nameMethod: 'onVariablePickerNameInput',
            resizeMethod: 'promptVariablePickerResize', closeMethod: 'closeVariablePickerForEditor'
        } : {
            label: 'スイッチ', modalKey: 'switchPickerModal', rangeKey: 'switchPickerRangeList',
            itemKey: 'switchPickerSwitchList', nameKey: 'switchPickerNameInput',
            resizeKey: 'switchPickerResizeBtn', refreshMethod: 'refreshSwitchPickerSwitchList',
            selectionMethod: 'onSwitchPickerSelectionChange', nameMethod: 'onSwitchPickerNameInput',
            resizeMethod: 'promptSwitchPickerResize', closeMethod: 'closeSwitchPickerForEditor'
        };
        var call = function(methodName, args) {
            if (typeof self[methodName] === 'function') return self[methodName].apply(self, args || []);
        };
        var mb = this.el('div', 'swpmb');
        var w = this.el('div', 'swpw');
        mb.appendChild(w);
        var hd = this.el('div', 'swp-h');
        hd.appendChild(this.el('div', '', config.label + 'の選択'));
        var closeBtn = this.el('button', 'swp-x', '×');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', function() { call(config.closeMethod, [false]); });
        hd.appendChild(closeBtn);
        w.appendChild(hd);

        var body = this.el('div', 'swp-body');
        var left = this.el('div', 'swp-sec');
        left.appendChild(this.el('div', 'swp-ttl', config.label));
        var rangeList = this[config.rangeKey] = this.el('select', 'swp-list swp-list-range');
        rangeList.size = 20;
        this.attachSelectWheelInput(rangeList);
        rangeList.addEventListener('change', function() {
            call(config.refreshMethod, [Number(rangeList.value || 0)]);
        });
        left.appendChild(rangeList);
        body.appendChild(left);

        var right = this.el('div', 'swp-sec swp-sec-main');
        var itemList = this[config.itemKey] = this.el('select', 'swp-list swp-list-main');
        itemList.size = 20;
        this.attachSelectWheelInput(itemList);
        itemList.addEventListener('change', function() { call(config.selectionMethod); });
        itemList.addEventListener('dblclick', function() { call(config.closeMethod, [true]); });
        right.appendChild(itemList);
        var nameRow = this.el('div', 'swp-name-row swp-name-row-main');
        nameRow.appendChild(this.el('label', '', '名前:'));
        var nameInput = this[config.nameKey] = this.el('input', '');
        nameInput.type = 'text';
        nameInput.maxLength = 128;
        nameInput.addEventListener('input', function() { call(config.nameMethod); });
        nameRow.appendChild(nameInput);
        right.appendChild(nameRow);
        body.appendChild(right);
        w.appendChild(body);

        var fo = this.el('div', 'swp-fo');
        var leftBtns = this.el('div', 'swp-fo-left');
        var resizeButton = this[config.resizeKey] = this.btn('最大数の変更...', '', function() {
            call(config.resizeMethod);
        });
        leftBtns.appendChild(resizeButton);
        fo.appendChild(leftBtns);
        var rightBtns = this.el('div', 'swp-fo-right');
        var ok = this.btn('OK', 'good', function() { call(config.closeMethod, [true]); });
        var cancel = this.btn('キャンセル', '', function() { call(config.closeMethod, [false]); });
        rightBtns.appendChild(ok);
        rightBtns.appendChild(cancel);
        fo.appendChild(rightBtns);
        w.appendChild(fo);

        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            call(config.closeMethod, [false]);
        });
        this[config.modalKey] = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildAddCommandModal = function(root) {
        var self = this;
        var mb = this.el('div', 'acmb');
        var w = this.el('div', 'acw');
        mb.appendChild(w);
        this.addModal = mb;
        this.addWin = w;
        this.addTabs = this.el('div', 'actabs');
        this.addTabBtns = [];
        for (var i = 1; i <= 4; i++) {
            (function(page) {
                var b = self.el('button', 'actab', String(page));
                b.type = 'button';
                b.addEventListener('click', function() {
                    self.addPage = page;
                    self.renderAddCommandPage();
                });
                self.addTabBtns.push(b);
                self.addTabs.appendChild(b);
            })(i);
        }
        w.appendChild(this.addTabs);
        this.addGrid = this.el('div', 'acgrid');
        this.addColL = this.el('div', 'accol');
        this.addColR = this.el('div', 'accol');
        this.addGrid.appendChild(this.addColL);
        this.addGrid.appendChild(this.addColR);
        w.appendChild(this.addGrid);
        var f = this.el('div', 'acf');
        this.addInfo = this.el('div', 'acinfo', '');
        var closeBtn = this.el('button', 'acclose', '閉じる');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', function() { self.closeAddCommandPanel(); });
        f.appendChild(this.addInfo);
        f.appendChild(closeBtn);
        w.appendChild(f);
        mb.addEventListener('click', function(e) { if (e.target === mb) self.closeAddCommandPanel(); });
        root.appendChild(mb);
    };

    EE.prototype.buildRouteCommandModal = function(root) {
        var self = this;
        var mb = this.el('div', 'rmcmb');
        var w = this.el('div', 'rmcw');
        mb.appendChild(w);
        w.appendChild(this.el('div', 'rmctt', '移動コマンド'));
        var grid = this.el('div', 'rmcgrid');
        this.routeColL = this.el('div', 'rmccol');
        this.routeColM = this.el('div', 'rmccol');
        this.routeColR = this.el('div', 'rmccol');
        this.routeColX = this.el('div', 'rmccol');
        grid.appendChild(this.routeColL);
        grid.appendChild(this.routeColM);
        grid.appendChild(this.routeColR);
        grid.appendChild(this.routeColX);
        w.appendChild(grid);
        var f = this.el('div', 'rmcf');
        var closeBtn = this.el('button', 'rmcclose', '閉じる');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', function() { self.closeRouteCommandPanel(); });
        f.appendChild(closeBtn);
        w.appendChild(f);
        mb.addEventListener('click', function(e) { if (e.target === mb) self.closeRouteCommandPanel(); });
        this.routeModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildWaitInsertModal = function(root) {
        var self = this;
        var mb = this.el('div', 'wimb');
        var w = this.el('div', 'wiw');
        mb.appendChild(w);
        w.appendChild(this.el('div', 'h', 'ウェイトの挿入'));
        var sec = this.el('div', 'sec wi-sec');
        sec.appendChild(this.el('label', '', '挿入位置'));
        var pos = this.el('div', 'wi-pos');
        var lb = this.el('label', '', '');
        this.waitInsertPosBefore = this.el('input', '');
        this.waitInsertPosBefore.type = 'radio';
        this.waitInsertPosBefore.name = 'knh-ee-wait-insert-pos';
        this.waitInsertPosBefore.value = 'before';
        lb.appendChild(this.waitInsertPosBefore);
        lb.appendChild(this.el('span', '', '前に挿入'));
        var la = this.el('label', '', '');
        this.waitInsertPosAfter = this.el('input', '');
        this.waitInsertPosAfter.type = 'radio';
        this.waitInsertPosAfter.name = 'knh-ee-wait-insert-pos';
        this.waitInsertPosAfter.value = 'after';
        la.appendChild(this.waitInsertPosAfter);
        la.appendChild(this.el('span', '', '後ろに挿入'));
        pos.appendChild(lb);
        pos.appendChild(la);
        sec.appendChild(pos);
        sec.appendChild(this.el('label', '', '挿入フレーム数'));
        var fr = this.el('div', 'wi-row');
        this.waitInsertFrameInput = this.el('input', '');
        this.waitInsertFrameInput.type = 'number';
        this.waitInsertFrameInput.min = '1';
        this.waitInsertFrameInput.step = '1';
        this.attachNumberWheelInput(this.waitInsertFrameInput);
        fr.appendChild(this.waitInsertFrameInput);
        fr.appendChild(this.el('span', '', 'F'));
        sec.appendChild(fr);
        this.waitInsertInfo = this.el('div', 'wi-note', '');
        sec.appendChild(this.waitInsertInfo);
        w.appendChild(sec);
        var rw = this.el('div', 'ed-btns');
        var ok = this.btn('挿入', 'good', function() { self.submitWaitInsertDialog(); });
        var cancel = this.btn('キャンセル', '', function() { self.closeWaitInsertDialog(); });
        rw.appendChild(ok);
        rw.appendChild(cancel);
        w.appendChild(rw);
        mb.addEventListener('click', function(e) { if (e.target === mb) self.closeWaitInsertDialog(); });
        this.waitInsertModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildMessageBubbleBulkModal = function(root) {
        var self = this;
        var addSelectOption = function(select, value, label) {
            var op = document.createElement('option');
            op.value = String(value);
            op.textContent = String(label);
            select.appendChild(op);
        };
        var mb = this.el('div', 'wimb');
        var w = this.el('div', 'wiw mbbw');
        mb.appendChild(w);
        w.appendChild(this.el('div', 'h', 'ふきだし位置一括設定'));
        var sec = this.el('div', 'mbb-sec');

        var rowTarget = this.el('div', 'mbb-row');
        rowTarget.appendChild(this.el('label', '', '対象キャラ'));
        this.messageBubbleBulkTargetCharId = this.el('select', '');
        this.attachSelectWheelInput(this.messageBubbleBulkTargetCharId);
        rowTarget.appendChild(this.messageBubbleBulkTargetCharId);
        sec.appendChild(rowTarget);

        var rowWindow = this.el('div', 'mbb-row');
        var windowCk = this.el('label', 'mbb-ck', '');
        this.messageBubbleBulkWindowTypeCheck = this.el('input', '');
        this.messageBubbleBulkWindowTypeCheck.type = 'checkbox';
        windowCk.appendChild(this.messageBubbleBulkWindowTypeCheck);
        windowCk.appendChild(this.el('span', '', 'ウィンドウタイプ'));
        rowWindow.appendChild(windowCk);
        this.messageBubbleBulkWindowType = this.el('select', '');
        this.attachSelectWheelInput(this.messageBubbleBulkWindowType);
        addSelectOption(this.messageBubbleBulkWindowType, -1, '-1 四角');
        addSelectOption(this.messageBubbleBulkWindowType, 0, '0 ふきだし');
        addSelectOption(this.messageBubbleBulkWindowType, 1, '1 ギザギザふきだし');
        addSelectOption(this.messageBubbleBulkWindowType, 2, '2 思考ふきだし');
        rowWindow.appendChild(this.messageBubbleBulkWindowType);
        sec.appendChild(rowWindow);

        var rowTail = this.el('div', 'mbb-row');
        var tailCk = this.el('label', 'mbb-ck', '');
        this.messageBubbleBulkTailDirCheck = this.el('input', '');
        this.messageBubbleBulkTailDirCheck.type = 'checkbox';
        tailCk.appendChild(this.messageBubbleBulkTailDirCheck);
        tailCk.appendChild(this.el('span', '', 'しっぽ方向'));
        rowTail.appendChild(tailCk);
        this.messageBubbleBulkTailDir = this.el('select', '');
        this.attachSelectWheelInput(this.messageBubbleBulkTailDir);
        for (var td = 1; td <= 9; td++) addSelectOption(this.messageBubbleBulkTailDir, td, String(td));
        rowTail.appendChild(this.messageBubbleBulkTailDir);
        sec.appendChild(rowTail);

        var rowAddX = this.el('div', 'mbb-row');
        var addXCk = this.el('label', 'mbb-ck', '');
        this.messageBubbleBulkAddXCheck = this.el('input', '');
        this.messageBubbleBulkAddXCheck.type = 'checkbox';
        addXCk.appendChild(this.messageBubbleBulkAddXCheck);
        addXCk.appendChild(this.el('span', '', 'addX(px)'));
        rowAddX.appendChild(addXCk);
        this.messageBubbleBulkAddX = this.el('input', '');
        this.messageBubbleBulkAddX.type = 'number';
        this.messageBubbleBulkAddX.step = '1';
        this.attachNumberWheelInput(this.messageBubbleBulkAddX);
        rowAddX.appendChild(this.messageBubbleBulkAddX);
        sec.appendChild(rowAddX);

        var rowAddY = this.el('div', 'mbb-row');
        var addYCk = this.el('label', 'mbb-ck', '');
        this.messageBubbleBulkAddYCheck = this.el('input', '');
        this.messageBubbleBulkAddYCheck.type = 'checkbox';
        addYCk.appendChild(this.messageBubbleBulkAddYCheck);
        addYCk.appendChild(this.el('span', '', 'addY(px)'));
        rowAddY.appendChild(addYCk);
        this.messageBubbleBulkAddY = this.el('input', '');
        this.messageBubbleBulkAddY.type = 'number';
        this.messageBubbleBulkAddY.step = '1';
        this.attachNumberWheelInput(this.messageBubbleBulkAddY);
        rowAddY.appendChild(this.messageBubbleBulkAddY);
        sec.appendChild(rowAddY);

        this.messageBubbleBulkInfo = this.el('div', 'mbb-note', '');
        sec.appendChild(this.messageBubbleBulkInfo);
        w.appendChild(sec);

        var onToggle = function() {
            if (typeof self.refreshMessageBubbleBulkDialogEnabledState === 'function') {
                self.refreshMessageBubbleBulkDialogEnabledState();
            }
        };
        this.messageBubbleBulkWindowTypeCheck.addEventListener('change', onToggle);
        this.messageBubbleBulkTailDirCheck.addEventListener('change', onToggle);
        this.messageBubbleBulkAddXCheck.addEventListener('change', onToggle);
        this.messageBubbleBulkAddYCheck.addEventListener('change', onToggle);

        var rw = this.el('div', 'ed-btns');
        var ok = this.btn('OK', 'good', function() { self.submitMessageBubbleBulkDialog(); });
        var cancel = this.btn('キャンセル', '', function() { self.closeMessageBubbleBulkDialog(); });
        rw.appendChild(ok);
        rw.appendChild(cancel);
        w.appendChild(rw);

        mb.addEventListener('click', function(e) { if (e.target === mb) self.closeMessageBubbleBulkDialog(); });
        this.messageBubbleBulkModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.memoNormalizeSize = function(size) {
        var s = String(size == null ? '' : size).trim().toUpperCase();
        if (s === 'M' || s === 'L') return s;
        return 'S';
    };

    EE.prototype.memoCircleRadiusForSize = function(size) {
        size = this.memoNormalizeSize(size);
        if (size === 'L') return 7;
        if (size === 'M') return 5;
        return 3;
    };

    EE.prototype.memoNormalizeText = function(text) {
        return String(text == null ? '' : text).replace(/\r?\n/g, ' ');
    };

    EE.prototype.memoCommentLine = function(size, text) {
        var sz = this.memoNormalizeSize(size);
        var body = this.memoNormalizeText(text);
        return '<MEMO:' + sz + '>' + body;
    };

    EE.prototype.memoMetaFromCommentLines = function(lines) {
        lines = Array.isArray(lines) ? lines : [String(lines == null ? '' : lines)];
        var first = String(lines.length ? lines[0] : '');
        var m = first.match(/^<MEMO:([SML])>([\s\S]*)$/i);
        if (!m) return null;
        var tail = String(m[2] || '');
        if (lines.length > 1) tail += '\n' + lines.slice(1).join('\n');
        return {
            size: this.memoNormalizeSize(m[1]),
            text: this.memoNormalizeText(tail)
        };
    };

    EE.prototype.memoApplyParsedStateToEntry = function(e) {
        if (!e) return;
        var lines = e.commentLines && e.commentLines.length
            ? e.commentLines
            : [String((e.command && e.command.parameters && e.command.parameters[0]) || '')];
        var meta = this.memoMetaFromCommentLines(lines);
        if (meta) {
            e.isMemo = true;
            e.memoSize = meta.size;
            e.memoText = meta.text;
        } else {
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
        }
    };

    EE.prototype.eventSettingsNormalizeScriptConditionText = function(text) {
        return String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    };

    EE.prototype.eventSettingsEncodeScriptConditionComment = function(scriptText) {
        var normalized = this.eventSettingsNormalizeScriptConditionText(scriptText);
        return '<EE_SCRIPT_COND:' + normalized + '>';
    };

    EE.prototype.eventSettingsDecodeScriptConditionComment = function(line) {
        var text = String(line == null ? '' : line);
        var m = text.match(/^<EE_SCRIPT_COND:([\s\S]*)>$/);
        if (!m) return null;
        var raw = String(m[1] || '');
        var rawNorm = this.eventSettingsNormalizeScriptConditionText(raw);
        if (raw.indexOf('%') < 0) return rawNorm;
        try {
            var decoded = decodeURIComponent(raw);
            // Backward compatibility: decode only legacy percent-encoded payloads.
            if (encodeURIComponent(decoded) === raw) {
                return this.eventSettingsNormalizeScriptConditionText(decoded);
            }
            return rawNorm;
        } catch (err) {
            return rawNorm;
        }
    };

    EE.prototype.eventSettingsScriptConditionFromEventList = function(list) {
        if (!Array.isArray(list)) return null;
        for (var i = 0; i < list.length; i++) {
            var cmd = list[i];
            if (!cmd) continue;
            if (Number(cmd.code || 0) !== 108) continue;
            var line = String((cmd.parameters || [''])[0] || '');
            var script = this.eventSettingsDecodeScriptConditionComment(line);
            if (script != null) return script;
        }
        return null;
    };

    EE.prototype.eventSettingsApplyScriptConditionToEventList = function(page, enabled, scriptText) {
        if (!page || typeof page !== 'object') return;
        var src = Array.isArray(page.list) ? page.list : [];
        var out = [];
        for (var i = 0; i < src.length; i++) {
            var cmd = src[i];
            if (cmd && Number(cmd.code || 0) === 108) {
                var line = String((cmd.parameters || [''])[0] || '');
                if (this.eventSettingsDecodeScriptConditionComment(line) != null) {
                    while (i + 1 < src.length && src[i + 1] && Number(src[i + 1].code || 0) === 408) i++;
                    continue;
                }
            }
            out.push(cmd);
        }
        var normalized = this.eventSettingsNormalizeScriptConditionText(scriptText);
        var hasScript = !!enabled && normalized.trim().length > 0;
        if (hasScript) {
            out.unshift({
                code: 108,
                indent: 0,
                parameters: [this.eventSettingsEncodeScriptConditionComment(normalized)]
            });
        }
        if (!out.length || Number(out[out.length - 1].code || 0) !== 0) {
            out.push({ code: 0, indent: 0, parameters: [] });
        }
        page.list = out;
        if (!page.conditions || typeof page.conditions !== 'object') page.conditions = {};
        page.conditions.scriptValid = hasScript;
        page.conditions.scriptText = hasScript ? normalized : '';
    };

    EE.prototype.isEventSettingsScriptConditionEntry = function(entry) {
        if (!entry || !entry.command) return false;
        if (Number(entry.command.code || 0) !== 108) return false;
        var lines = (entry.commentLines && entry.commentLines.length)
            ? entry.commentLines
            : [String((entry.command.parameters || [''])[0] || '')];
        return this.eventSettingsDecodeScriptConditionComment(lines[0]) != null;
    };

    EE.prototype.buildMemoModal = function(root) {
        var self = this;
        var mb = this.el('div', 'mmb');
        var w = this.el('div', 'mmw');
        mb.appendChild(w);
        this.memoHead = this.el('div', 'h', 'メモ編集');
        w.appendChild(this.memoHead);
        var sec = this.el('div', 'sec mm-sec');
        var top = this.el('div', 'mm-top');
        var sizeField = this.el('div', 'mm-field');
        sizeField.appendChild(this.el('label', '', 'サイズ'));
        this.memoSizeSelect = this.el('select', 'mm-size');
        var opts = [
            { value: 'S', label: '小 (S)' },
            { value: 'M', label: '中 (M)' },
            { value: 'L', label: '大 (L)' }
        ];
        for (var i = 0; i < opts.length; i++) {
            var op = document.createElement('option');
            op.value = opts[i].value;
            op.textContent = opts[i].label;
            this.memoSizeSelect.appendChild(op);
        }
        sizeField.appendChild(this.memoSizeSelect);
        top.appendChild(sizeField);
        var textField = this.el('div', 'mm-field');
        textField.appendChild(this.el('label', '', 'テキスト (1行)'));
        this.memoTextInput = this.el('input', 'mm-text');
        this.memoTextInput.type = 'text';
        this.memoTextInput.maxLength = 512;
        textField.appendChild(this.memoTextInput);
        top.appendChild(textField);
        sec.appendChild(top);
        sec.appendChild(this.el('div', 'mm-note', '保存形式: <MEMO:S|M|L>text'));
        w.appendChild(sec);
        var rw = this.el('div', 'ed-btns');
        var ok = this.btn('OK', 'good', function() { self.submitMemoEditor(); });
        this.memoDeleteBtn = this.btn('削除', 'warn', function() { self.deleteMemoFromEditor(); });
        var cancel = this.btn('キャンセル', '', function() { self.closeMemoEditor(); });
        rw.appendChild(ok);
        rw.appendChild(this.memoDeleteBtn);
        rw.appendChild(cancel);
        w.appendChild(rw);
        mb.addEventListener('click', function(e) { if (e.target === mb) self.closeMemoEditor(); });
        this.memoModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildEventSettingsModal = function(root) {
        var self = this;
        var addOpt = function(select, value, label) {
            var op = document.createElement('option');
            op.value = String(value);
            op.textContent = String(label);
            select.appendChild(op);
        };
        var mb = this.el('div', 'esmb');
        var w = this.el('div', 'esw');
        mb.appendChild(w);
        this.eventSettingsHead = this.el('div', 'es-h', 'イベント設定');
        w.appendChild(this.eventSettingsHead);
        var body = this.el('div', 'es-body');
        w.appendChild(body);

        var top = this.el('div', 'es-top');
        var topFields = this.el('div', 'es-top-fields');
        var nameField = this.el('div', 'es-field');
        nameField.appendChild(this.el('label', '', '名前:'));
        this.eventSettingsNameInput = this.el('input', '');
        this.eventSettingsNameInput.type = 'text';
        this.eventSettingsNameInput.maxLength = 128;
        nameField.appendChild(this.eventSettingsNameInput);
        var noteField = this.el('div', 'es-field');
        noteField.appendChild(this.el('label', '', 'メモ:'));
        this.eventSettingsNoteInput = this.el('input', '');
        this.eventSettingsNoteInput.type = 'text';
        this.eventSettingsNoteInput.maxLength = 512;
        this.eventSettingsNoteInput.readOnly = true;
        this.eventSettingsNoteInput.title = 'クリックでメモ編集';
        this.eventSettingsNoteInput.addEventListener('click', function() {
            if (typeof self.openEventSettingsNoteZoomFromClick === 'function') self.openEventSettingsNoteZoomFromClick();
        });
        noteField.appendChild(this.eventSettingsNoteInput);
        topFields.appendChild(nameField);
        topFields.appendChild(noteField);
        top.appendChild(topFields);
        var pageOps = this.el('div', 'es-page-ops');
        this.eventSettingsPageCreateBtn = this.el('button', 'esbtn', 'EVページ\n作成');
        this.eventSettingsPageCreateBtn.type = 'button';
        this.eventSettingsPageCreateBtn.addEventListener('click', function() {
            if (typeof self.eventSettingsCreatePage === 'function') self.eventSettingsCreatePage();
        });
        pageOps.appendChild(this.eventSettingsPageCreateBtn);
        this.eventSettingsPageCopyBtn = this.el('button', 'esbtn', 'EVページ\nコピー');
        this.eventSettingsPageCopyBtn.type = 'button';
        this.eventSettingsPageCopyBtn.addEventListener('click', function() {
            if (typeof self.eventSettingsCopyPage === 'function') self.eventSettingsCopyPage();
        });
        pageOps.appendChild(this.eventSettingsPageCopyBtn);
        this.eventSettingsPagePasteBtn = this.el('button', 'esbtn', 'EVページ\n貼り付け');
        this.eventSettingsPagePasteBtn.type = 'button';
        this.eventSettingsPagePasteBtn.addEventListener('click', function() {
            if (typeof self.eventSettingsPastePage === 'function') self.eventSettingsPastePage();
        });
        pageOps.appendChild(this.eventSettingsPagePasteBtn);
        this.eventSettingsPageDeleteBtn = this.el('button', 'esbtn', 'EVページ\n削除');
        this.eventSettingsPageDeleteBtn.type = 'button';
        this.eventSettingsPageDeleteBtn.addEventListener('click', function() {
            if (typeof self.eventSettingsDeletePage === 'function') self.eventSettingsDeletePage();
        });
        pageOps.appendChild(this.eventSettingsPageDeleteBtn);
        this.eventSettingsPageClearBtn = this.el('button', 'esbtn', 'EVページ\nクリア');
        this.eventSettingsPageClearBtn.type = 'button';
        this.eventSettingsPageClearBtn.addEventListener('click', function() {
            if (typeof self.eventSettingsClearPage === 'function') self.eventSettingsClearPage();
        });
        pageOps.appendChild(this.eventSettingsPageClearBtn);
        top.appendChild(pageOps);
        body.appendChild(top);

        var pageRow = this.el('div', 'es-page');
        this.eventSettingsPageTabs = this.el('div', 'es-tabs');
        pageRow.appendChild(this.eventSettingsPageTabs);
        this.eventSettingsPageSelect = this.el('select', 'es-page-select');
        this.attachSelectWheelInput(this.eventSettingsPageSelect);
        this.eventSettingsPageSelect.addEventListener('change', function() {
            self.eventSettingsChangePage(self.eventSettingsPageSelect.value);
        });
        pageRow.appendChild(this.eventSettingsPageSelect);
        body.appendChild(pageRow);

        var split = this.el('div', 'es-split');
        body.appendChild(split);
        var leftPane = this.el('div', 'es-left');
        split.appendChild(leftPane);
        this.eventSettingsLeftPane = leftPane;
        var main = this.el('div', 'es-main');
        leftPane.appendChild(main);

        var condSec = this.el('div', 'es-sec');
        condSec.appendChild(this.el('div', 'es-sec-ttl', '出現条件'));

        var sw1Row = this.el('div', 'es-row chk');
        this.eventSettingsSw1Valid = this.el('input', '');
        this.eventSettingsSw1Valid.type = 'checkbox';
        this.eventSettingsSw1Valid.id = 'knh-ee-es-cond-sw1';
        this.eventSettingsSw1Id = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsSw1Id);
        this.eventSettingsSw1Id.title = 'クリックでスイッチ選択';
        this.eventSettingsSw1Id.addEventListener('mousedown', function(e) {
            if (this.disabled) return;
            e.preventDefault();
            if (typeof self.openSwitchPickerForElement === 'function') self.openSwitchPickerForElement(this);
        });
        this.eventSettingsSw1Id.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (this.disabled) return;
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            if (typeof self.openSwitchPickerForElement === 'function') self.openSwitchPickerForElement(this);
        });
        sw1Row.appendChild(this.eventSettingsSw1Valid);
        var sw1Lbl = this.el('label', '', 'スイッチ');
        sw1Lbl.htmlFor = this.eventSettingsSw1Valid.id;
        sw1Row.appendChild(sw1Lbl);
        sw1Row.appendChild(this.eventSettingsSw1Id);
        condSec.appendChild(sw1Row);

        var sw2Row = this.el('div', 'es-row chk');
        this.eventSettingsSw2Valid = this.el('input', '');
        this.eventSettingsSw2Valid.type = 'checkbox';
        this.eventSettingsSw2Valid.id = 'knh-ee-es-cond-sw2';
        this.eventSettingsSw2Id = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsSw2Id);
        this.eventSettingsSw2Id.title = 'クリックでスイッチ選択';
        this.eventSettingsSw2Id.addEventListener('mousedown', function(e) {
            if (this.disabled) return;
            e.preventDefault();
            if (typeof self.openSwitchPickerForElement === 'function') self.openSwitchPickerForElement(this);
        });
        this.eventSettingsSw2Id.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (this.disabled) return;
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            if (typeof self.openSwitchPickerForElement === 'function') self.openSwitchPickerForElement(this);
        });
        sw2Row.appendChild(this.eventSettingsSw2Valid);
        var sw2Lbl = this.el('label', '', 'スイッチ');
        sw2Lbl.htmlFor = this.eventSettingsSw2Valid.id;
        sw2Row.appendChild(sw2Lbl);
        sw2Row.appendChild(this.eventSettingsSw2Id);
        condSec.appendChild(sw2Row);

        var varRow = this.el('div', 'es-row chk');
        this.eventSettingsVarValid = this.el('input', '');
        this.eventSettingsVarValid.type = 'checkbox';
        this.eventSettingsVarValid.id = 'knh-ee-es-cond-var';
        varRow.appendChild(this.eventSettingsVarValid);
        var varLbl = this.el('label', '', '変数');
        varLbl.htmlFor = this.eventSettingsVarValid.id;
        varRow.appendChild(varLbl);
        this.eventSettingsVarId = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsVarId);
        this.eventSettingsVarId.title = 'クリックで変数選択';
        this.eventSettingsVarId.addEventListener('mousedown', function(e) {
            if (this.disabled) return;
            e.preventDefault();
            if (typeof self.openVariablePickerForElement === 'function') self.openVariablePickerForElement(this);
        });
        this.eventSettingsVarId.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (this.disabled) return;
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            if (typeof self.openVariablePickerForElement === 'function') self.openVariablePickerForElement(this);
        });
        varRow.appendChild(this.eventSettingsVarId);
        condSec.appendChild(varRow);

        var varValueRow = this.el('div', 'es-row es-var-extra');
        varValueRow.appendChild(this.el('span', '', ''));
        varValueRow.appendChild(this.el('span', '', ''));
        varValueRow.appendChild(this.el('div', 'es-var-op', '>='));
        this.eventSettingsVarValue = this.el('input', '');
        this.eventSettingsVarValue.type = 'number';
        this.eventSettingsVarValue.step = '1';
        this.attachNumberWheelInput(this.eventSettingsVarValue);
        varValueRow.appendChild(this.eventSettingsVarValue);
        condSec.appendChild(varValueRow);

        var selfSwRow = this.el('div', 'es-row chk');
        this.eventSettingsSelfValid = this.el('input', '');
        this.eventSettingsSelfValid.type = 'checkbox';
        this.eventSettingsSelfValid.id = 'knh-ee-es-cond-selfsw';
        this.eventSettingsSelfCh = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsSelfCh);
        addOpt(this.eventSettingsSelfCh, 'A', 'A');
        addOpt(this.eventSettingsSelfCh, 'B', 'B');
        addOpt(this.eventSettingsSelfCh, 'C', 'C');
        addOpt(this.eventSettingsSelfCh, 'D', 'D');
        selfSwRow.appendChild(this.eventSettingsSelfValid);
        var selfSwLbl = this.el('label', '', 'セルフスイッチ');
        selfSwLbl.htmlFor = this.eventSettingsSelfValid.id;
        selfSwRow.appendChild(selfSwLbl);
        selfSwRow.appendChild(this.eventSettingsSelfCh);
        condSec.appendChild(selfSwRow);

        var itemRow = this.el('div', 'es-row chk');
        this.eventSettingsItemValid = this.el('input', '');
        this.eventSettingsItemValid.type = 'checkbox';
        this.eventSettingsItemValid.id = 'knh-ee-es-cond-item';
        this.eventSettingsItemId = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsItemId);
        itemRow.appendChild(this.eventSettingsItemValid);
        var itemLbl = this.el('label', '', 'アイテム');
        itemLbl.htmlFor = this.eventSettingsItemValid.id;
        itemRow.appendChild(itemLbl);
        itemRow.appendChild(this.eventSettingsItemId);
        condSec.appendChild(itemRow);

        var actorRow = this.el('div', 'es-row chk');
        this.eventSettingsActorValid = this.el('input', '');
        this.eventSettingsActorValid.type = 'checkbox';
        this.eventSettingsActorValid.id = 'knh-ee-es-cond-actor';
        this.eventSettingsActorId = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsActorId);
        actorRow.appendChild(this.eventSettingsActorValid);
        var actorLbl = this.el('label', '', 'アクター');
        actorLbl.htmlFor = this.eventSettingsActorValid.id;
        actorRow.appendChild(actorLbl);
        actorRow.appendChild(this.eventSettingsActorId);
        condSec.appendChild(actorRow);

        var scriptCondRow = this.el('div', 'es-row chk es-script-cond');
        this.eventSettingsScriptCondValid = this.el('input', '');
        this.eventSettingsScriptCondValid.type = 'checkbox';
        this.eventSettingsScriptCondValid.id = 'knh-ee-es-cond-script';
        this.eventSettingsScriptCondText = this.el('textarea', '');
        this.eventSettingsScriptCondText.rows = 2;
        this.eventSettingsScriptCondText.placeholder = '$gameSwitches.value(1) && $gameVariables.value(2) >= 10';
        scriptCondRow.appendChild(this.eventSettingsScriptCondValid);
        var scriptCondLbl = this.el('label', '', 'スクリプト');
        scriptCondLbl.htmlFor = this.eventSettingsScriptCondValid.id;
        scriptCondRow.appendChild(scriptCondLbl);
        scriptCondRow.appendChild(this.eventSettingsScriptCondText);
        condSec.appendChild(scriptCondRow);

        main.appendChild(condSec);

        var midRow = this.el('div', 'es-mid');
        main.appendChild(midRow);

        var imgSec = this.el('div', 'es-sec');
        imgSec.appendChild(this.el('div', 'es-sec-ttl', '画像'));
        var previewWrap = this.el('div', 'es-img-preview-wrap');
        this.eventSettingsImagePreview = document.createElement('canvas');
        this.eventSettingsImagePreview.className = 'es-img-preview';
        this.eventSettingsImagePreview.width = 84;
        this.eventSettingsImagePreview.height = 112;
        this.eventSettingsImagePreview.title = 'クリックで画像選択';
        this.eventSettingsImagePreview.style.cursor = 'pointer';
        this.eventSettingsImagePreview.addEventListener('click', function() {
            if (typeof self.openEventSettingsImagePickerPrompt === 'function') self.openEventSettingsImagePickerPrompt();
        });
        previewWrap.appendChild(this.eventSettingsImagePreview);
        imgSec.appendChild(previewWrap);

        var imgHidden = this.el('div', 'es-img-hidden');
        var tileRow = this.el('div', 'es-row chk');
        this.eventSettingsUseTile = this.el('input', '');
        this.eventSettingsUseTile.type = 'checkbox';
        this.eventSettingsTileId = this.el('input', '');
        this.eventSettingsTileId.type = 'number';
        this.eventSettingsTileId.step = '1';
        this.eventSettingsTileId.min = '0';
        this.attachNumberWheelInput(this.eventSettingsTileId);
        tileRow.appendChild(this.eventSettingsUseTile);
        tileRow.appendChild(this.el('label', '', 'タイルID'));
        tileRow.appendChild(this.eventSettingsTileId);
        imgHidden.appendChild(tileRow);
        var charNameField = this.el('div', 'es-field');
        charNameField.appendChild(this.el('label', '', 'キャラ画像名'));
        this.eventSettingsCharName = this.el('input', '');
        this.eventSettingsCharName.type = 'text';
        charNameField.appendChild(this.eventSettingsCharName);
        imgHidden.appendChild(charNameField);
        var imgRow = this.el('div', 'es-row two');
        this.eventSettingsCharIndex = this.el('input', '');
        this.eventSettingsCharIndex.type = 'number';
        this.eventSettingsCharIndex.step = '1';
        this.eventSettingsCharIndex.min = '0';
        this.eventSettingsCharIndex.max = '7';
        this.attachNumberWheelInput(this.eventSettingsCharIndex);
        this.eventSettingsDirection = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsDirection);
        addOpt(this.eventSettingsDirection, 2, '下');
        addOpt(this.eventSettingsDirection, 4, '左');
        addOpt(this.eventSettingsDirection, 6, '右');
        addOpt(this.eventSettingsDirection, 8, '上');
        imgRow.appendChild(this.eventSettingsCharIndex);
        imgRow.appendChild(this.eventSettingsDirection);
        imgHidden.appendChild(imgRow);
        var pattField = this.el('div', 'es-field');
        pattField.appendChild(this.el('label', '', 'パターン'));
        this.eventSettingsPattern = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsPattern);
        addOpt(this.eventSettingsPattern, 0, '左');
        addOpt(this.eventSettingsPattern, 1, '中央');
        addOpt(this.eventSettingsPattern, 2, '右');
        pattField.appendChild(this.eventSettingsPattern);
        imgHidden.appendChild(pattField);
        imgSec.appendChild(imgHidden);

        var imageSyncInputs = [
            this.eventSettingsUseTile,
            this.eventSettingsTileId,
            this.eventSettingsCharName,
            this.eventSettingsCharIndex,
            this.eventSettingsDirection,
            this.eventSettingsPattern
        ];
        for (var is = 0; is < imageSyncInputs.length; is++) {
            if (!imageSyncInputs[is]) continue;
            imageSyncInputs[is].addEventListener('change', function() {
                if (typeof self.refreshEventSettingsImagePreview === 'function') self.refreshEventSettingsImagePreview();
            });
            imageSyncInputs[is].addEventListener('input', function() {
                if (typeof self.refreshEventSettingsImagePreview === 'function') self.refreshEventSettingsImagePreview();
            });
        }
        midRow.appendChild(imgSec);

        var moveSec = this.el('div', 'es-sec');
        moveSec.appendChild(this.el('div', 'es-sec-ttl', '自律移動'));
        var moveTypeField = this.el('div', 'es-row kv');
        moveTypeField.appendChild(this.el('label', '', 'タイプ'));
        this.eventSettingsMoveType = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsMoveType);
        addOpt(this.eventSettingsMoveType, 0, '固定');
        addOpt(this.eventSettingsMoveType, 1, 'ランダム');
        addOpt(this.eventSettingsMoveType, 2, '近づく');
        addOpt(this.eventSettingsMoveType, 3, 'カスタム');
        moveTypeField.appendChild(this.eventSettingsMoveType);
        moveSec.appendChild(moveTypeField);
        this.eventSettingsMoveRouteBtn = this.el('button', 'esbtn es-route-btn', 'ルート...');
        this.eventSettingsMoveRouteBtn.type = 'button';
        this.eventSettingsMoveRouteBtn.addEventListener('click', function() {
            if (typeof self.openEventSettingsMoveRoutePrompt === 'function') self.openEventSettingsMoveRoutePrompt();
        });
        moveSec.appendChild(this.eventSettingsMoveRouteBtn);
        var speedRow = this.el('div', 'es-row kv');
        speedRow.appendChild(this.el('label', '', '速度'));
        this.eventSettingsMoveSpeed = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsMoveSpeed);
        addOpt(this.eventSettingsMoveSpeed, 1, '1: 1/8倍速');
        addOpt(this.eventSettingsMoveSpeed, 2, '2: 1/4倍速');
        addOpt(this.eventSettingsMoveSpeed, 3, '3: 1/2倍速');
        addOpt(this.eventSettingsMoveSpeed, 4, '4: 標準');
        addOpt(this.eventSettingsMoveSpeed, 5, '5: 2倍速');
        addOpt(this.eventSettingsMoveSpeed, 6, '6: 4倍速');
        speedRow.appendChild(this.eventSettingsMoveSpeed);
        moveSec.appendChild(speedRow);
        var freqRow = this.el('div', 'es-row kv');
        freqRow.appendChild(this.el('label', '', '頻度'));
        this.eventSettingsMoveFrequency = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsMoveFrequency);
        addOpt(this.eventSettingsMoveFrequency, 1, '1: 最低');
        addOpt(this.eventSettingsMoveFrequency, 2, '2: 低');
        addOpt(this.eventSettingsMoveFrequency, 3, '3: 標準');
        addOpt(this.eventSettingsMoveFrequency, 4, '4: 高');
        addOpt(this.eventSettingsMoveFrequency, 5, '5: 最高');
        freqRow.appendChild(this.eventSettingsMoveFrequency);
        moveSec.appendChild(freqRow);
        var routeOpt = this.el('div', 'es-opt es-opt-v es-route-flags');
        var repeatLbl = this.el('label', '', '');
        this.eventSettingsMoveRepeat = this.el('input', '');
        this.eventSettingsMoveRepeat.type = 'checkbox';
        repeatLbl.appendChild(this.eventSettingsMoveRepeat);
        repeatLbl.appendChild(this.el('span', '', '動作を繰り返す'));
        routeOpt.appendChild(repeatLbl);
        var skipLbl = this.el('label', '', '');
        this.eventSettingsMoveSkippable = this.el('input', '');
        this.eventSettingsMoveSkippable.type = 'checkbox';
        skipLbl.appendChild(this.eventSettingsMoveSkippable);
        skipLbl.appendChild(this.el('span', '', '移動できない場合は飛ばす'));
        routeOpt.appendChild(skipLbl);
        var waitLbl = this.el('label', '', '');
        this.eventSettingsMoveWait = this.el('input', '');
        this.eventSettingsMoveWait.type = 'checkbox';
        waitLbl.appendChild(this.eventSettingsMoveWait);
        waitLbl.appendChild(this.el('span', '', '完了までウェイト'));
        routeOpt.appendChild(waitLbl);
        moveSec.appendChild(routeOpt);
        midRow.appendChild(moveSec);

        var bottomRow = this.el('div', 'es-bottom');
        main.appendChild(bottomRow);

        var optSec = this.el('div', 'es-sec');
        optSec.appendChild(this.el('div', 'es-sec-ttl', 'オプション'));
        var basicOpt = this.el('div', 'es-opt es-opt-v es-opt-check');
        var walkLbl = this.el('label', '', '');
        this.eventSettingsWalkAnime = this.el('input', '');
        this.eventSettingsWalkAnime.type = 'checkbox';
        walkLbl.appendChild(this.eventSettingsWalkAnime);
        walkLbl.appendChild(this.el('span', '', '歩行アニメ'));
        basicOpt.appendChild(walkLbl);
        var stepLbl = this.el('label', '', '');
        this.eventSettingsStepAnime = this.el('input', '');
        this.eventSettingsStepAnime.type = 'checkbox';
        stepLbl.appendChild(this.eventSettingsStepAnime);
        stepLbl.appendChild(this.el('span', '', '足踏みアニメ'));
        basicOpt.appendChild(stepLbl);
        var dirFixLbl = this.el('label', '', '');
        this.eventSettingsDirectionFix = this.el('input', '');
        this.eventSettingsDirectionFix.type = 'checkbox';
        dirFixLbl.appendChild(this.eventSettingsDirectionFix);
        dirFixLbl.appendChild(this.el('span', '', '向き固定'));
        basicOpt.appendChild(dirFixLbl);
        var throughLbl = this.el('label', '', '');
        this.eventSettingsThrough = this.el('input', '');
        this.eventSettingsThrough.type = 'checkbox';
        throughLbl.appendChild(this.eventSettingsThrough);
        throughLbl.appendChild(this.el('span', '', 'すり抜け'));
        basicOpt.appendChild(throughLbl);
        var transparentStartLbl = this.el('label', '', '');
        this.eventSettingsTransparentStart = this.el('input', '');
        this.eventSettingsTransparentStart.type = 'checkbox';
        transparentStartLbl.appendChild(this.eventSettingsTransparentStart);
        transparentStartLbl.appendChild(this.el('span', '', '透明化で開始'));
        basicOpt.appendChild(transparentStartLbl);
        optSec.appendChild(basicOpt);
        bottomRow.appendChild(optSec);

        var rightCol = this.el('div', 'es-col es-stack');
        bottomRow.appendChild(rightCol);

        var ptSec = this.el('div', 'es-sec es-sec-compact');
        ptSec.appendChild(this.el('div', 'es-sec-ttl', 'プライオリティ'));
        this.eventSettingsPriorityType = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsPriorityType);
        addOpt(this.eventSettingsPriorityType, 0, '通常キャラの下');
        addOpt(this.eventSettingsPriorityType, 1, '通常キャラと同じ');
        addOpt(this.eventSettingsPriorityType, 2, '通常キャラの上');
        ptSec.appendChild(this.eventSettingsPriorityType);
        rightCol.appendChild(ptSec);

        var trSec = this.el('div', 'es-sec es-sec-compact');
        trSec.appendChild(this.el('div', 'es-sec-ttl', 'トリガー'));
        this.eventSettingsTrigger = this.el('select', '');
        this.attachSelectWheelInput(this.eventSettingsTrigger);
        addOpt(this.eventSettingsTrigger, 0, '決定ボタン');
        addOpt(this.eventSettingsTrigger, 1, 'プレイヤーから接触');
        addOpt(this.eventSettingsTrigger, 2, 'イベントから接触');
        addOpt(this.eventSettingsTrigger, 3, '自動実行');
        addOpt(this.eventSettingsTrigger, 4, '並列処理');
        trSec.appendChild(this.eventSettingsTrigger);
        rightCol.appendChild(trSec);

        var rightPane = this.el('div', 'es-right');
        split.appendChild(rightPane);
        var execSec = this.el('div', 'es-sec es-exec');
        this.eventSettingsExecSec = execSec;
        execSec.appendChild(this.el('div', 'es-sec-ttl', '実行内容'));
        this.eventSettingsExecBody = this.el('div', 'es-exec-body');
        this.eventSettingsExecBody.addEventListener('wheel', function(e) {
            if (typeof self.onEventSettingsExecWheel === 'function') self.onEventSettingsExecWheel(e);
        }, { passive: false });
        this.eventSettingsExecBody.addEventListener('mousewheel', function(e) {
            if (typeof self.onEventSettingsExecWheel === 'function') self.onEventSettingsExecWheel(e);
        }, { passive: false });
        this.eventSettingsExecList = this.el('div', 'es-exec-list');
        this.eventSettingsExecBody.appendChild(this.eventSettingsExecList);
        this.eventSettingsExecJumpBtn = this.el('div', 'es-exec-jump', '編集する');
        this.eventSettingsExecJumpBtn.setAttribute('role', 'button');
        this.eventSettingsExecJumpBtn.tabIndex = 0;
        this.eventSettingsExecJumpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof self.jumpToTimelineEditorFromEventSettingsExec === 'function') {
                self.jumpToTimelineEditorFromEventSettingsExec();
            }
        });
        this.eventSettingsExecJumpBtn.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            if (typeof self.jumpToTimelineEditorFromEventSettingsExec === 'function') {
                self.jumpToTimelineEditorFromEventSettingsExec();
            }
        });
        this.eventSettingsExecBody.appendChild(this.eventSettingsExecJumpBtn);
        execSec.appendChild(this.eventSettingsExecBody);
        rightPane.appendChild(execSec);
        this.eventSettingsExecSig = '';

        var syncInputs = [
            this.eventSettingsSw1Valid,
            this.eventSettingsSw2Valid,
            this.eventSettingsVarValid,
            this.eventSettingsSelfValid,
            this.eventSettingsItemValid,
            this.eventSettingsActorValid,
            this.eventSettingsScriptCondValid,
            this.eventSettingsUseTile,
            this.eventSettingsTransparentStart,
            this.eventSettingsMoveType,
            this.eventSettingsSw1Id,
            this.eventSettingsSw2Id,
            this.eventSettingsVarId,
            this.eventSettingsItemId,
            this.eventSettingsActorId
        ];
        for (var i = 0; i < syncInputs.length; i++) {
            if (!syncInputs[i]) continue;
            syncInputs[i].addEventListener('change', function() {
                self.syncEventSettingsEditorFormEnabled();
            });
        }

        var f = this.el('div', 'es-fo');
        var ok = this.el('button', 'esbtn good', '適用');
        ok.type = 'button';
        ok.addEventListener('click', function() { self.applyEventSettingsEditor(); });
        var cancel = this.el('button', 'esbtn', 'キャンセル');
        cancel.type = 'button';
        cancel.addEventListener('click', function() { self.closeEventSettingsEditor(); });
        f.appendChild(ok);
        f.appendChild(cancel);
        var syncApplyButtonWidthToCancel = function() {
            if (!ok || !cancel) return;
            ok.style.minWidth = '';
            ok.style.maxWidth = '';
            ok.style.width = '';
            var cw = Math.ceil(cancel.getBoundingClientRect().width || cancel.offsetWidth || 0);
            if (cw > 0) {
                var px = String(cw) + 'px';
                ok.style.width = px;
                ok.style.minWidth = px;
                ok.style.maxWidth = px;
            }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncApplyButtonWidthToCancel);
        else setTimeout(syncApplyButtonWidthToCancel, 0);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('resize', syncApplyButtonWidthToCancel);
            window.addEventListener('resize', function() {
                self.eventSettingsExecFixedHeight = 0;
                if (typeof self.scheduleEventSettingsExecHeightSync === 'function') {
                    self.scheduleEventSettingsExecHeightSync();
                }
            });
        }
        w.appendChild(f);

        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            self.closeEventSettingsEditor();
        });
        this.eventSettingsModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildEventSettingsNoteZoomModal = function(root) {
        var self = this;
        var mb = this.el('div', 'esnmb');
        var w = this.el('div', 'esnw');
        mb.appendChild(w);
        w.appendChild(this.el('div', 'esn-h', 'メモ編集'));
        var body = this.el('div', 'esn-body');
        this.eventSettingsNoteZoomInput = this.el('textarea', 'esn-ta');
        this.eventSettingsNoteZoomInput.spellcheck = false;
        body.appendChild(this.eventSettingsNoteZoomInput);
        body.appendChild(this.el('div', 'esn-note', '外側をクリックで確定して閉じます。'));
        w.appendChild(body);
        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            if (typeof self.closeEventSettingsNoteZoom === 'function') self.closeEventSettingsNoteZoom(true);
        });
        this.eventSettingsNoteZoomModal = mb;
        this.eventSettingsNoteZoomWindow = w;
        root.appendChild(mb);
    };

    EE.prototype.buildEventSettingsImagePickerModal = function(root) {
        var self = this;
        var mb = this.el('div', 'eipmb');
        var w = this.el('div', 'eipw');
        mb.appendChild(w);

        var h = this.el('div', 'eip-h', '画像の選択');
        this.characterImagePickerTitle = h;
        var closeBtn = this.el('button', 'eip-close', '×');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', function() {
            if (typeof self.closeEventSettingsImagePicker === 'function') self.closeEventSettingsImagePicker(false);
        });
        h.appendChild(closeBtn);
        w.appendChild(h);

        var body = this.el('div', 'eip-body');
        var left = this.el('div', 'eip-left');
        this.eventSettingsImagePickerList = this.el('div', 'eip-list');
        left.appendChild(this.eventSettingsImagePickerList);
        body.appendChild(left);

        var right = this.el('div', 'eip-right');
        this.eventSettingsImagePickerViewport = this.el('div', 'eip-vp');
        this.eventSettingsImagePickerCanvasWrap = this.el('div', 'eip-cv-wrap');
        this.eventSettingsImagePickerCanvas = document.createElement('canvas');
        this.eventSettingsImagePickerCanvas.className = 'eip-cv';
        this.eventSettingsImagePickerCanvas.width = 1;
        this.eventSettingsImagePickerCanvas.height = 1;
        this.eventSettingsImagePickerCanvas.addEventListener('mousedown', function(e) {
            if (typeof self.onEventSettingsImagePickerCanvasMouseDown === 'function') {
                self.onEventSettingsImagePickerCanvasMouseDown(e);
            }
        });
        this.eventSettingsImagePickerCanvas.addEventListener('mousemove', function(e) {
            if (typeof self.onEventSettingsImagePickerCanvasMouseMove === 'function') {
                self.onEventSettingsImagePickerCanvasMouseMove(e);
            }
        });
        this.eventSettingsImagePickerCanvas.addEventListener('mouseup', function(e) {
            if (typeof self.onEventSettingsImagePickerCanvasMouseUp === 'function') {
                self.onEventSettingsImagePickerCanvasMouseUp(e);
            }
        });
        this.eventSettingsImagePickerCanvas.addEventListener('click', function(e) {
            if (typeof self.onEventSettingsImagePickerCanvasClick === 'function') {
                self.onEventSettingsImagePickerCanvasClick(e);
            }
        });
        this.eventSettingsImagePickerCanvasWrap.appendChild(this.eventSettingsImagePickerCanvas);
        this.eventSettingsImagePickerViewport.appendChild(this.eventSettingsImagePickerCanvasWrap);
        right.appendChild(this.eventSettingsImagePickerViewport);
        this.eventSettingsImagePickerInfo = this.el('div', 'eip-info', '');
        right.appendChild(this.eventSettingsImagePickerInfo);
        var tools = this.el('div', 'eip-tools');
        this.eventSettingsImagePickerCssRectModeBtn = this.el('button', 'eip-btn toggle', 'cssRect調整');
        this.eventSettingsImagePickerCssRectModeBtn.type = 'button';
        this.eventSettingsImagePickerCssRectModeBtn.addEventListener('click', function() {
            if (typeof self.toggleEventSettingsImagePickerCssRectMode === 'function') {
                self.toggleEventSettingsImagePickerCssRectMode();
            }
        });
        tools.appendChild(this.eventSettingsImagePickerCssRectModeBtn);
        this.eventSettingsImagePickerCssRectClearBtn = this.el('button', 'eip-btn warn', 'cssRect解除');
        this.eventSettingsImagePickerCssRectClearBtn.type = 'button';
        this.eventSettingsImagePickerCssRectClearBtn.addEventListener('click', function() {
            if (typeof self.clearEventSettingsImagePickerCssRect === 'function') {
                self.clearEventSettingsImagePickerCssRect();
            }
        });
        tools.appendChild(this.eventSettingsImagePickerCssRectClearBtn);
        this.eventSettingsImagePickerCssRectStatus = this.el('div', 'eip-status', '');
        tools.appendChild(this.eventSettingsImagePickerCssRectStatus);
        right.appendChild(tools);
        body.appendChild(right);
        w.appendChild(body);

        var f = this.el('div', 'eip-fo');
        var ok = this.el('button', 'eip-btn good', 'OK');
        ok.type = 'button';
        ok.addEventListener('click', function() {
            if (typeof self.closeEventSettingsImagePicker === 'function') self.closeEventSettingsImagePicker(true);
        });
        var cancel = this.el('button', 'eip-btn', 'キャンセル');
        cancel.type = 'button';
        cancel.addEventListener('click', function() {
            if (typeof self.closeEventSettingsImagePicker === 'function') self.closeEventSettingsImagePicker(false);
        });
        f.appendChild(ok);
        f.appendChild(cancel);
        w.appendChild(f);

        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            if (typeof self.closeEventSettingsImagePicker === 'function') self.closeEventSettingsImagePicker(false);
        });

        this.eventSettingsImagePickerModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildBattleEventSettingsModal = function(root) {
        var self = this;
        var addOpt = function(select, value, label) {
            var op = document.createElement('option');
            op.value = String(value);
            op.textContent = String(label);
            select.appendChild(op);
        };
        var mb = this.el('div', 'besmb');
        var w = this.el('div', 'besw');
        mb.appendChild(w);
        this.battleEventSettingsHead = this.el('div', 'bes-h', '戦闘イベント設定');
        w.appendChild(this.battleEventSettingsHead);
        var body = this.el('div', 'bes-body');
        w.appendChild(body);

        var rowPage = this.el('div', 'bes-row');
        rowPage.appendChild(this.el('label', '', 'ページ'));
        this.battleEventSettingsPageSelect = this.el('select', '');
        this.attachSelectWheelInput(this.battleEventSettingsPageSelect);
        this.battleEventSettingsPageSelect.addEventListener('change', function() {
            self.battleEventSettingsChangePage(self.battleEventSettingsPageSelect.value);
        });
        rowPage.appendChild(this.battleEventSettingsPageSelect);
        body.appendChild(rowPage);

        var rowTurnEnding = this.el('div', 'bes-row chk');
        this.battleEventTurnEnding = this.el('input', '');
        this.battleEventTurnEnding.type = 'checkbox';
        rowTurnEnding.appendChild(this.battleEventTurnEnding);
        rowTurnEnding.appendChild(this.el('label', '', 'ターン終了時'));
        rowTurnEnding.appendChild(this.el('div', '', ''));
        body.appendChild(rowTurnEnding);

        var rowTurn = this.el('div', 'bes-row chk');
        this.battleEventTurnValid = this.el('input', '');
        this.battleEventTurnValid.type = 'checkbox';
        rowTurn.appendChild(this.battleEventTurnValid);
        rowTurn.appendChild(this.el('label', '', 'ターン条件'));
        var turnWrap = this.el('div', '');
        this.battleEventTurnA = this.el('input', '');
        this.battleEventTurnA.type = 'number';
        this.battleEventTurnA.step = '1';
        this.attachNumberWheelInput(this.battleEventTurnA);
        this.battleEventTurnB = this.el('input', '');
        this.battleEventTurnB.type = 'number';
        this.battleEventTurnB.step = '1';
        this.attachNumberWheelInput(this.battleEventTurnB);
        turnWrap.appendChild(this.battleEventTurnA);
        turnWrap.appendChild(this.el('span', '', ' + '));
        turnWrap.appendChild(this.battleEventTurnB);
        turnWrap.appendChild(this.el('span', '', 'n'));
        rowTurn.appendChild(turnWrap);
        body.appendChild(rowTurn);

        var rowEnemy = this.el('div', 'bes-row chk');
        this.battleEventEnemyValid = this.el('input', '');
        this.battleEventEnemyValid.type = 'checkbox';
        rowEnemy.appendChild(this.battleEventEnemyValid);
        rowEnemy.appendChild(this.el('label', '', '敵条件'));
        var enemyWrap = this.el('div', '');
        this.battleEventEnemyIndex = this.el('input', '');
        this.battleEventEnemyIndex.type = 'number';
        this.battleEventEnemyIndex.step = '1';
        this.battleEventEnemyIndex.min = '1';
        this.attachNumberWheelInput(this.battleEventEnemyIndex);
        this.battleEventEnemyHp = this.el('input', '');
        this.battleEventEnemyHp.type = 'number';
        this.battleEventEnemyHp.step = '1';
        this.battleEventEnemyHp.min = '0';
        this.battleEventEnemyHp.max = '100';
        this.attachNumberWheelInput(this.battleEventEnemyHp);
        enemyWrap.appendChild(this.battleEventEnemyIndex);
        enemyWrap.appendChild(this.el('span', '', ' HP<= '));
        enemyWrap.appendChild(this.battleEventEnemyHp);
        rowEnemy.appendChild(enemyWrap);
        body.appendChild(rowEnemy);

        var rowActor = this.el('div', 'bes-row chk');
        this.battleEventActorValid = this.el('input', '');
        this.battleEventActorValid.type = 'checkbox';
        rowActor.appendChild(this.battleEventActorValid);
        rowActor.appendChild(this.el('label', '', 'アクター条件'));
        var actorWrap = this.el('div', '');
        this.battleEventActorId = this.el('select', '');
        this.attachSelectWheelInput(this.battleEventActorId);
        this.battleEventActorHp = this.el('input', '');
        this.battleEventActorHp.type = 'number';
        this.battleEventActorHp.step = '1';
        this.battleEventActorHp.min = '0';
        this.battleEventActorHp.max = '100';
        this.attachNumberWheelInput(this.battleEventActorHp);
        actorWrap.appendChild(this.battleEventActorId);
        actorWrap.appendChild(this.el('span', '', ' HP<= '));
        actorWrap.appendChild(this.battleEventActorHp);
        rowActor.appendChild(actorWrap);
        body.appendChild(rowActor);

        var rowSwitch = this.el('div', 'bes-row chk');
        this.battleEventSwitchValid = this.el('input', '');
        this.battleEventSwitchValid.type = 'checkbox';
        rowSwitch.appendChild(this.battleEventSwitchValid);
        rowSwitch.appendChild(this.el('label', '', 'スイッチ条件'));
        this.battleEventSwitchId = this.el('select', '');
        this.attachSelectWheelInput(this.battleEventSwitchId);
        this.battleEventSwitchId.title = 'クリックでスイッチ選択';
        this.battleEventSwitchId.addEventListener('mousedown', function(e) {
            if (this.disabled) return;
            e.preventDefault();
            if (typeof self.openSwitchPickerForElement === 'function') self.openSwitchPickerForElement(this);
        });
        this.battleEventSwitchId.addEventListener('keydown', function(e) {
            var k = String(e && e.key || '');
            if (this.disabled) return;
            if (k !== 'Enter' && k !== ' ') return;
            e.preventDefault();
            if (typeof self.openSwitchPickerForElement === 'function') self.openSwitchPickerForElement(this);
        });
        rowSwitch.appendChild(this.battleEventSwitchId);
        body.appendChild(rowSwitch);

        var rowSpan = this.el('div', 'bes-row');
        rowSpan.appendChild(this.el('label', '', '実行間隔(Span)'));
        this.battleEventSpan = this.el('select', '');
        this.attachSelectWheelInput(this.battleEventSpan);
        addOpt(this.battleEventSpan, 0, '0: バトル');
        addOpt(this.battleEventSpan, 1, '1: ターン');
        addOpt(this.battleEventSpan, 2, '2: モーメント');
        rowSpan.appendChild(this.battleEventSpan);
        body.appendChild(rowSpan);

        var syncInputs = [
            this.battleEventTurnValid,
            this.battleEventEnemyValid,
            this.battleEventActorValid,
            this.battleEventSwitchValid
        ];
        for (var si = 0; si < syncInputs.length; si++) {
            if (!syncInputs[si]) continue;
            syncInputs[si].addEventListener('change', function() {
                self.syncBattleEventSettingsFormEnabled();
            });
        }

        var f = this.el('div', 'bes-fo');
        var ok = this.el('button', 'esbtn good', '適用');
        ok.type = 'button';
        ok.addEventListener('click', function() { self.applyBattleEventSettingsEditor(); });
        var cancel = this.el('button', 'esbtn', 'キャンセル');
        cancel.type = 'button';
        cancel.addEventListener('click', function() { self.closeBattleEventSettingsEditor(); });
        f.appendChild(ok);
        f.appendChild(cancel);
        w.appendChild(f);

        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            self.closeBattleEventSettingsEditor();
        });
        this.battleEventSettingsModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.buildSePickerModal = function(root) {
        var self = this;
        var mb = this.el('div', 'semb');
        var w = this.el('div', 'sew');
        mb.appendChild(w);
        this.sePickerWindow = w;

        var h = this.el('div', 'se-h', 'SEの演奏');
        var closeBtn = this.el('button', 'se-close', '×');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', function() {
            if (typeof self.closeSePicker === 'function') self.closeSePicker(false);
        });
        h.appendChild(closeBtn);
        w.appendChild(h);

        var body = this.el('div', 'se-body');
        var left = this.el('div', 'se-left');
        this.sePickerList = this.el('div', 'se-list');
        var onSeListWheel = function(e) {
            if (!self.sePickerList) return;
            var modeScale = 1;
            if (Number(e.deltaMode || 0) === 1) modeScale = 16;
            else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(window.innerHeight || 100));
            var dy = Number(e.deltaY || 0) * modeScale;
            if (Math.abs(dy) < 0.001 && e.wheelDelta != null) dy = -Number(e.wheelDelta || 0);
            self.sePickerList.scrollTop = Number(self.sePickerList.scrollTop || 0) + dy;
            e.preventDefault();
            e.stopPropagation();
        };
        this.sePickerList.addEventListener('wheel', onSeListWheel, { passive: false });
        this.sePickerList.addEventListener('mousewheel', onSeListWheel, { passive: false });
        left.appendChild(this.sePickerList);
        body.appendChild(left);

        var right = this.el('div', 'se-right');
        var playRow = this.el('div', 'se-play');
        this.sePickerPlayBtn = this.el('button', 'se-btn', '再生');
        this.sePickerPlayBtn.type = 'button';
        this.sePickerPlayBtn.addEventListener('click', function() {
            if (typeof self.playSePickerPreview === 'function') self.playSePickerPreview();
        });
        this.sePickerStopBtn = this.el('button', 'se-btn', '停止');
        this.sePickerStopBtn.type = 'button';
        this.sePickerStopBtn.addEventListener('click', function() {
            if (typeof self.stopSePickerPreview === 'function') self.stopSePickerPreview();
        });
        playRow.appendChild(this.sePickerPlayBtn);
        playRow.appendChild(this.sePickerStopBtn);
        right.appendChild(playRow);

        var mkNumBox = function(title, min, max, step, value) {
            var box = self.el('div', 'se-box');
            box.appendChild(self.el('div', 'se-ttl', title));
            var rg = self.el('input', 'se-range');
            rg.type = 'range';
            rg.min = String(min);
            rg.max = String(max);
            rg.step = String(step);
            rg.value = String(value);
            var nu = self.el('input', 'se-num');
            nu.type = 'number';
            nu.min = String(min);
            nu.max = String(max);
            nu.step = String(step);
            nu.value = String(value);
            self.attachNumberWheelInput(rg);
            self.attachNumberWheelInput(nu);
            box.appendChild(rg);
            box.appendChild(nu);
            return { box: box, range: rg, input: nu };
        };
        var vol = mkNumBox('音量', 0, 100, 1, 90);
        var pit = mkNumBox('ピッチ', 50, 150, 1, 100);
        var pan = mkNumBox('位相', -100, 100, 1, 0);
        this.sePickerVolumeRange = vol.range;
        this.sePickerVolumeInput = vol.input;
        this.sePickerPitchRange = pit.range;
        this.sePickerPitchInput = pit.input;
        this.sePickerPanRange = pan.range;
        this.sePickerPanInput = pan.input;
        right.appendChild(vol.box);
        right.appendChild(pit.box);
        right.appendChild(pan.box);
        body.appendChild(right);
        w.appendChild(body);

        var bindPair = function(rangeEl, numEl, key) {
            var onRange = function() {
                if (typeof self.setSePickerNumericValue === 'function') {
                    self.setSePickerNumericValue(key, rangeEl.value, 'range');
                }
            };
            var onInput = function() {
                if (typeof self.setSePickerNumericValue === 'function') {
                    self.setSePickerNumericValue(key, numEl.value, 'input');
                }
            };
            rangeEl.addEventListener('input', onRange);
            rangeEl.addEventListener('change', onRange);
            numEl.addEventListener('input', onInput);
            numEl.addEventListener('change', onInput);
        };
        bindPair(this.sePickerVolumeRange, this.sePickerVolumeInput, 'volume');
        bindPair(this.sePickerPitchRange, this.sePickerPitchInput, 'pitch');
        bindPair(this.sePickerPanRange, this.sePickerPanInput, 'pan');

        var f = this.el('div', 'se-fo');
        var ok = this.el('button', 'se-btn good', 'OK');
        ok.type = 'button';
        ok.addEventListener('click', function() {
            if (typeof self.closeSePicker === 'function') self.closeSePicker(true);
        });
        var cancel = this.el('button', 'se-btn', 'キャンセル');
        cancel.type = 'button';
        cancel.addEventListener('click', function() {
            if (typeof self.closeSePicker === 'function') self.closeSePicker(false);
        });
        f.appendChild(ok);
        f.appendChild(cancel);
        w.appendChild(f);

        mb.addEventListener('click', function(e) {
            if (e.target !== mb) return;
            if (typeof self.closeSePicker === 'function') self.closeSePicker(false);
        });

        this.sePickerModal = mb;
        root.appendChild(mb);
    };

    EE.prototype.openMemoEditorForNew = function(frame) {
        if (!this.memoModal || !this.memoSizeSelect || !this.memoTextInput) return;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        this.memoEditMode = 'new';
        this.memoEditUid = 0;
        this.memoEditFrame = frame;
        this.memoEditSize = 'M';
        this.memoHead.textContent = 'メモ作成';
        this.memoSizeSelect.value = 'M';
        this.memoTextInput.value = '';
        if (this.memoDeleteBtn) this.memoDeleteBtn.style.display = 'none';
        this.memoModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.memoModal);
        this.memoTextInput.focus();
        this.memoTextInput.select();
    };

    EE.prototype.openMemoEditorForEntry = function(uid) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0 || !this.memoModal || !this.memoSizeSelect || !this.memoTextInput) return;
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 108) return;
        this.memoApplyParsedStateToEntry(e);
        if (!e.isMemo) return;
        this.memoEditMode = 'edit';
        this.memoEditUid = uid;
        this.memoEditFrame = Math.max(0, Math.floor(Number(e.frame || 0)));
        this.memoEditSize = this.memoNormalizeSize(e.memoSize);
        this.memoHead.textContent = 'メモ編集';
        this.memoSizeSelect.value = this.memoEditSize;
        this.memoTextInput.value = this.memoNormalizeText(e.memoText);
        if (this.memoDeleteBtn) this.memoDeleteBtn.style.display = '';
        this.memoModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.memoModal);
        this.memoTextInput.focus();
        this.memoTextInput.select();
    };

    EE.prototype.closeMemoEditor = function() {
        if (!this.memoModal) return;
        this.memoModal.classList.remove('on');
        this.memoEditMode = 'new';
        this.memoEditUid = 0;
        this.memoEditFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        this.memoEditSize = 'M';
    };

    EE.prototype.submitMemoEditor = function() {
        if (!this.memoSizeSelect || !this.memoTextInput) return;
        var size = this.memoNormalizeSize(this.memoSizeSelect.value || 'M');
        var text = this.memoNormalizeText(this.memoTextInput.value || '');
        var encoded = this.memoCommentLine(size, text);
        if (this.memoEditMode === 'edit' && Number(this.memoEditUid || 0) > 0) {
            var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            if (!tr || !Array.isArray(tr.commands)) return;
            var uid = Math.floor(Number(this.memoEditUid || 0));
            var e = this.findEntryInSelectedTrack(uid);
            if (!e || !e.command || Number(e.command.code || 0) !== 108) {
                this.closeMemoEditor();
                return;
            }
            this.pushSnap('editMemo');
            e.command.parameters = [encoded];
            e.commentLines = [encoded];
            e.wait = 0;
            e.isComment = true;
            e.isMemo = true;
            e.memoSize = size;
            e.memoText = text;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
            SH.sortTrackCommands(tr);
            this.selUid = uid;
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(e.frame || this.frame || 0)));
            this.commitTrackMutation({ earliestChangedFrame: e.frame });
            this.playFrom(this.frame);
            this.closeMemoEditor();
            this.msg('メモ更新');
            return;
        }
        if (!this.needSelTrack()) return;
        var addFrame = Math.max(0, Math.floor(Number(this.memoEditFrame || this.frame || 0)));
        var added = this.addCmd({ code: 108, indent: 0, parameters: [encoded] }, addFrame);
        if (!added) return;
        added.isMemo = true;
        added.memoSize = size;
        added.memoText = text;
        added.commentLines = [encoded];
        this.closeMemoEditor();
        this.msg('メモ作成');
    };

    EE.prototype.deleteMemoFromEditor = function() {
        var uid = Math.floor(Number(this.memoEditUid || 0));
        if (uid <= 0) {
            this.closeMemoEditor();
            return;
        }
        this.selUid = uid;
        this.selRouteListIndex = -1;
        this.closeMemoEditor();
        this.delSel();
    };

    EE.prototype.ensureAddCommandCatalog = function() {
        if (this._addCommandCatalog) return;
        this._addCommandCatalog = {
            1: {
                left: [
                    {
                        title: 'シーン制御',
                        items: [
                            { code: 301, label: '戦闘の処理...' },
                            { code: 302, label: 'ショップの処理...' },
                            { code: 303, label: '名前入力の処理...' },
                            { code: 351, label: 'メニュー画面を開く' },
                            { code: 352, label: 'セーブ画面を開く' },
                            { code: 353, label: 'ゲームオーバー' },
                            { code: 354, label: 'タイトル画面に戻す' }
                        ]
                    },
                    {
                        title: 'システム設定',
                        items: [
                            { code: 132, label: '戦闘BGMの変更...' },
                            { code: 133, label: '勝利MEの変更...' },
                            { code: 139, label: '敗北MEの変更...' },
                            { code: 140, label: '乗り物BGMの変更...' },
                            { code: 134, label: 'セーブ禁止の変更...' },
                            { code: 135, label: 'メニュー禁止の変更...' },
                            { code: 136, label: 'エンカウント禁止の変更...' },
                            { code: 137, label: '並び替え禁止の変更...' },
                            { code: 138, label: 'ウィンドウカラーの変更...' },
                            { code: 322, label: 'アクターの画像変更...' },
                            { code: 323, label: '乗り物の画像変更...' }
                        ]
                    }
                ],
                right: [
                    {
                        title: 'マップ',
                        items: [
                            { code: 281, label: 'マップ名表示の変更...' },
                            { code: 282, label: 'タイルセットの変更...' },
                            { code: 283, label: '戦闘背景の変更...' },
                            { code: 284, label: '遠景の変更...' },
                            { code: 285, label: '指定位置の情報取得...' }
                        ]
                    },
                    {
                        title: 'バトル',
                        items: [
                            { code: 331, label: '敵キャラのHP増減...' },
                            { code: 332, label: '敵キャラのMP増減...' },
                            { code: 342, label: '敵キャラのTP増減...' },
                            { code: 333, label: '敵キャラのステート変更...' },
                            { code: 334, label: '敵キャラの全回復...' },
                            { code: 335, label: '敵キャラの出現...' },
                            { code: 336, label: '敵キャラの変身...' },
                            { code: 337, label: '戦闘アニメーションの表示...' },
                            { code: 339, label: '戦闘行動の強制...' },
                            { code: 340, label: 'バトルの中断' }
                        ]
                    },
                    {
                        title: '上級',
                        items: [
                            { code: 355, label: 'スクリプト...' },
                            { code: 356, label: 'プラグインコマンド...' }
                        ]
                    }
                ]
            },
            2: {
                left: [
                    {
                        title: '移動',
                        items: [
                            { code: 201, label: '場所移動...' },
                            { code: 202, label: '乗り物の位置設定...' },
                            { code: 203, label: 'イベントの位置設定...' },
                            { code: 204, label: 'マップのスクロール...' },
                            { code: 205, label: '移動ルートの設定...' },
                            { code: 206, label: '乗り物の乗降' }
                        ]
                    },
                    {
                        title: 'キャラクター',
                        items: [
                            { code: 211, label: '透明状態の変更...' },
                            { code: 216, label: '隊列歩行の変更...' },
                            { code: 217, label: '隊列メンバーの集合' },
                            { code: 212, label: 'アニメーションの表示...' },
                            { code: 213, label: 'フキダシアイコンの表示...' },
                            { code: 214, label: 'イベントの一時消去' }
                        ]
                    },
                    {
                        title: 'ピクチャ',
                        items: [
                            { code: 231, label: 'ピクチャの表示...' },
                            { code: 232, label: 'ピクチャの移動...' },
                            { code: 233, label: 'ピクチャの回転...' },
                            { code: 234, label: 'ピクチャの色調変更...' },
                            { code: 235, label: 'ピクチャの消去...' }
                        ]
                    }
                ],
                right: [
                    {
                        title: 'タイミング',
                        items: [
                            { code: 230, label: 'ウェイト...' }
                        ]
                    },
                    {
                        title: '画面',
                        items: [
                            { code: 221, label: '画面のフェードアウト' },
                            { code: 222, label: '画面のフェードイン' },
                            { code: 223, label: '画面の色調変更...' },
                            { code: 224, label: '画面のフラッシュ...' },
                            { code: 225, label: '画面のシェイク...' },
                            { code: 236, label: '天候の設定...' }
                        ]
                    },
                    {
                        title: 'オーディオ・ビデオ',
                        items: [
                            { code: 241, label: 'BGMの演奏...' },
                            { code: 242, label: 'BGMのフェードアウト...' },
                            { code: 243, label: 'BGMの保存' },
                            { code: 244, label: 'BGMの再開' },
                            { code: 245, label: 'BGSの演奏...' },
                            { code: 246, label: 'BGSのフェードアウト...' },
                            { code: 249, label: 'MEの演奏...' },
                            { code: 250, label: 'SEの演奏...' },
                            { code: 251, label: 'SEの停止' },
                            { code: 261, label: 'ムービーの再生...' }
                        ]
                    }
                ]
            },
            3: {
                left: [
                    {
                        title: 'メッセージ',
                        items: [
                            { code: 101, label: '文章の表示...' },
                            { code: 102, label: '選択肢の表示...' },
                            { code: 103, label: '数値入力の処理...' },
                            { code: 104, label: 'アイテム選択の処理...' },
                            { code: 105, label: '文章のスクロール表示...' }
                        ]
                    },
                    {
                        title: 'ゲーム進行',
                        items: [
                            { code: 121, label: 'スイッチの操作...' },
                            { code: 122, label: '変数の操作...' },
                            { code: 123, label: 'セルフスイッチの操作...' },
                            { code: 124, label: 'タイマーの操作...' }
                        ]
                    },
                    {
                        title: 'フロー制御',
                        items: [
                            { code: 111, label: '条件分岐...' },
                            { code: 112, label: 'ループ' },
                            { code: 113, label: 'ループの中断' },
                            { code: 115, label: 'イベント処理の中断' },
                            { code: 117, label: 'コモンイベント...' },
                            { code: 118, label: 'ラベル...' },
                            { code: 119, label: 'ラベルジャンプ...' },
                            { code: 108, label: '注釈...' }
                        ]
                    }
                ],
                right: [
                    {
                        title: 'パーティ',
                        items: [
                            { code: 125, label: '所持金の増減...' },
                            { code: 126, label: 'アイテムの増減...' },
                            { code: 127, label: '武器の増減...' },
                            { code: 128, label: '防具の増減...' },
                            { code: 129, label: 'メンバーの入れ替え...' }
                        ]
                    },
                    {
                        title: 'アクター',
                        items: [
                            { code: 311, label: 'HPの増減...' },
                            { code: 312, label: 'MPの増減...' },
                            { code: 326, label: 'TPの増減...' },
                            { code: 313, label: 'ステートの変更...' },
                            { code: 314, label: '全回復...' },
                            { code: 315, label: '経験値の増減...' },
                            { code: 316, label: 'レベルの増減...' },
                            { code: 317, label: '能力値の増減...' },
                            { code: 318, label: 'スキルの増減...' },
                            { code: 319, label: '装備の変更...' },
                            { code: 320, label: '名前の変更...' },
                            { code: 321, label: '職業の変更...' },
                            { code: 324, label: '二つ名の変更...' },
                            { code: 325, label: 'プロフィールの変更...' }
                        ]
                    }
                ]
            },
            4: {
                left: [
                    {
                        title: '独自',
                        items: [
                            { code: 35550, label: 'カメラ移動...' },
                            { code: 35551, label: 'カメラ移動(直接指定)...' },
                            { code: 35552, label: 'キャラの瞬間移動...' },
                            { code: 35553, label: 'マップBGMの再生' },
                            { code: 35554, label: '画面のフェードインZXC' },
                            { code: 35555, label: '画面のフェードアウトZXC' },
                            { code: 35556, label: 'ピクチャSS表示...' },
                            { code: 35557, label: 'ピクチャSS再生...' },
                            { code: 35558, label: 'ピクチャSS停止' }
                        ]
                    }
                ],
                right: []
            }
        };
    };

    EE.prototype.addCommandButtonStyleClassForCode = function(code) {
        code = Math.floor(Number(code || 0));
        if (code >= 201 && code <= 206) return 'brown'; // 移動
        if (code >= 211 && code <= 217) return 'brown'; // キャラクター
        return '';
    };

    EE.prototype.renderAddCommandGroup = function(parent, group) {
        if (!parent || !group) return;
        var self = this;
        var box = this.el('div', 'acgrp');
        box.appendChild(this.el('div', 'acgtt', String(group.title || '')));
        var list = Array.isArray(group.items) ? group.items : [];
        for (var i = 0; i < list.length; i++) {
            (function(item) {
                if (!item) return;
                var b = self.el('button', 'acbtn', String(item.label || ('コマンド' + item.code)));
                b.type = 'button';
                var code = Number(item.code || 0);
                var toneClass = self.addCommandButtonStyleClassForCode(code);
                if (toneClass) b.classList.add(toneClass);
                var disabled = !!item.disabled || code === 205 || code === 230;
                if (disabled) {
                    b.disabled = true;
                    b.classList.add('dis');
                } else {
                    b.addEventListener('click', function() {
                        var placement = self.addPlacementContext ? clone(self.addPlacementContext) : null;
                        self.closeAddCommandPanel();
                        self.beginAddCommandByCode(code, String(item.label || ''), placement);
                    });
                }
                box.appendChild(b);
            })(list[i]);
        }
        parent.appendChild(box);
    };

    EE.prototype.renderAddCommandPage = function() {
        this.ensureAddCommandCatalog();
        if (!this.addColL || !this.addColR) return;
        var pageNo = Math.max(1, Math.min(4, Number(this.addPage || 1)));
        var mappedPage = 1;
        if (pageNo === 1) mappedPage = 3;
        else if (pageNo === 2) mappedPage = 2;
        else if (pageNo === 3) mappedPage = 1;
        else mappedPage = 4;
        var pg = this._addCommandCatalog[mappedPage] || { left: [], right: [] };
        this.addColL.innerHTML = '';
        this.addColR.innerHTML = '';
        for (var i = 0; i < this.addTabBtns.length; i++) {
            if (i + 1 === pageNo) this.addTabBtns[i].classList.add('on');
            else this.addTabBtns[i].classList.remove('on');
        }
        var left = Array.isArray(pg.left) ? pg.left : [];
        var right = Array.isArray(pg.right) ? pg.right : [];
        for (i = 0; i < left.length; i++) this.renderAddCommandGroup(this.addColL, left[i]);
        for (i = 0; i < right.length; i++) this.renderAddCommandGroup(this.addColR, right[i]);
        if (this.addInfo) {
            var lane = String(this.addRowKey || 'main');
            if (lane.indexOf('char:') === 0) {
                var cid = Number(lane.replace('char:', ''));
                lane = this.rowLabelForCharId(isNaN(cid) ? 0 : cid);
            } else {
                lane = 'Main';
            }
            this.addInfo.textContent = '追加フレーム: ' + this.addFrame + '\n対象レーン: ' + lane;
        }
    };

    EE.prototype.openAddCommandPanel = function(frame, rowKey, placementContext) {
        if (!this.addModal) return;
        if (!this.needSelTrack()) return;
        this.closeRouteRangeContextMenu();
        this.addFrame = Math.max(0, Math.floor(Number(frame || 0)));
        this.addRowKey = String(rowKey || 'main');
        this.addPlacementContext = this.resolveAddPlacementContext(
            placementContext || this.makeAddPlacementContextFromFrame(this.addFrame),
            this.addFrame
        );
        if (this.modal && this.modal.classList.contains('on')) this.closeEditor();
        if (this.routeModal && this.routeModal.classList.contains('on')) this.closeRouteCommandPanel();
        this.renderAddCommandPage();
        this.addModal.classList.add('on');
    };

    EE.prototype.closeAddCommandPanel = function() {
        if (!this.addModal) return;
        this.addPlacementContext = null;
        this.addModal.classList.remove('on');
    };

    EE.prototype.routeCommandCatalog = function() {
        return {
            left: [
                { code: 1, label: '下に移動' }, { code: 2, label: '左に移動' }, { code: 3, label: '右に移動' }, { code: 4, label: '上に移動' },
                { code: 5, label: '左下に移動' }, { code: 6, label: '右下に移動' }, { code: 7, label: '左上に移動' }, { code: 8, label: '右上に移動' },
                { code: 9, label: 'ランダムに移動' }, { code: 10, label: 'プレイヤーに近づく' }, { code: 11, label: 'プレイヤーから遠ざかる' },
                { code: 12, label: '一歩前進' }, { code: 13, label: '一歩後退' }, { code: 14, label: 'ジャンプ...' }, { code: 15, label: 'ウェイト...' }
            ],
            mid: [
                { code: 16, label: '下を向く' }, { code: 17, label: '左を向く' }, { code: 18, label: '右を向く' }, { code: 19, label: '上を向く' },
                { code: 20, label: '右に90度回転' }, { code: 21, label: '左に90度回転' }, { code: 22, label: '180度回転' },
                { code: 23, label: '右か左に90度回転' }, { code: 24, label: 'ランダムに方向転換' }, { code: 25, label: 'プレイヤーの方を向く' },
                { code: 26, label: 'プレイヤーの逆を向く' }, { code: 27, label: 'スイッチON...' }, { code: 28, label: 'スイッチOFF...' },
                { code: 29, label: '移動速度の変更...' }, { code: 30, label: '移動頻度の変更...' }
            ],
            right: [
                { code: 31, label: '歩行アニメON' }, { code: 32, label: '歩行アニメOFF' }, { code: 33, label: '足踏みアニメON' }, { code: 34, label: '足踏みアニメOFF' },
                { code: 35, label: '向き固定ON' }, { code: 36, label: '向き固定OFF' }, { code: 37, label: 'すり抜けON' }, { code: 38, label: 'すり抜けOFF' },
                { code: 39, label: '透明化ON' }, { code: 40, label: '透明化OFF' }, { code: 41, label: '画像の変更...' }, { code: 42, label: '不透明度の変更...' },
                { code: 43, label: '合成方法の変更...' }, { code: 44, label: 'SEの演奏...' },
                { code: 45, label: 'スクリプト...' }
            ],
            ext: [
                { code: 4500, label: 'タイルへ移動...' },
                { code: 4512, label: '仲間の位置に合わせる...' },
                { code: 4519, label: '仲間の位置へ向かう...' },
                { code: 4520, label: 'マスクフェードイン...' },
                { code: 4513, label: 'マスクフェードアウト...' },
                { code: 4510, label: 'フレームアニメ再生...' },
                { code: 4523, label: 'フレームアニメ終了...' },
                { code: 4521, label: 'CSSアニメ再生...' },
                { code: 4522, label: 'CSSアニメ停止' },
                { code: 4514, label: '画像の変更ZXC...' },
                { code: 4515, label: '振動アニメ開始...' },
                { code: 4516, label: '振動アニメ停止' }
            ]
        };
    };

    EE.prototype.routeScriptLineBreakToken = function() {
        return '   ';
    };

    EE.prototype.routeScriptToSingleLineForOutput = function(script) {
        var t = String(script == null ? '' : script).replace(/\r\n?/g, '\n');
        var token = String(this.routeScriptLineBreakToken());
        if (!token.length) token = '   ';
        return t.replace(/\n+/g, token);
    };

    EE.prototype.routeScriptToMultilineForEditor = function(script) {
        var t = String(script == null ? '' : script).replace(/\r\n?/g, '\n');
        if (t.indexOf('\n') >= 0) return t;
        var token = String(this.routeScriptLineBreakToken());
        if (!token.length) token = '   ';
        return t.split(token).join('\n');
    };

    EE.prototype.getRouteEditorSchema = function(code) {
        this.ensureRouteEditorSchemas();
        return this._routeEditorSchemas[Number(code || 0)] || null;
    };

    EE.prototype.getRouteEditorSchemaForCommand = function(routeCmd) {
        var dcode = this.routeDisplayCodeForCommand(routeCmd);
        if (dcode > 0 && dcode !== 45) {
            var sc = this.getRouteEditorSchema(dcode);
            if (sc) return sc;
        }
        return this.getRouteEditorSchema(routeCmd && routeCmd.code);
    };

    EE.prototype.routeCommandNeedsEditorOnAdd = function(code, routeCmd) {
        var schema = this.getRouteEditorSchema(code);
        if (schema && Array.isArray(schema.fields) && schema.fields.length > 0) return true;
        var p = routeCmd && Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return p.length > 0;
    };

    EE.prototype.routeJumpRateValue = function(value, fallback) {
        var fb = Number(fallback == null ? 1 : fallback);
        if (!isFinite(fb) || fb <= 0) fb = 1;
        var n = Number(value);
        if (!isFinite(n) || n <= 0) n = fb;
        return Math.max(0.1, n);
    };

    EE.prototype.normalizeRouteMoveSpeed = function(value, fallback) {
        var fb = Number(fallback == null ? 4 : fallback);
        if (!isFinite(fb)) fb = 4;
        var n = Number(value);
        if (!isFinite(n)) n = fb;
        n = Math.max(1, Math.min(6, n));
        return Math.round(n * 10) / 10;
    };

    EE.prototype.routeMoveSpeedText = function(speed) {
        var n = this.normalizeRouteMoveSpeed(speed, 4);
        var rounded = Math.round(n);
        if (Math.abs(n - rounded) <= 1e-6) return String(rounded);
        return n.toFixed(1).replace(/\.0$/, '');
    };

    EE.prototype.routeJumpDurationFrames = function(dx, dy, speed, heightRate, durationRate) {
        var jx = Number(dx || 0);
        var jy = Number(dy || 0);
        var sp = this.normalizeRouteMoveSpeed(speed, 4);
        var hr = this.routeJumpRateValue(heightRate, 1);
        var dr = this.routeJumpRateValue(durationRate, 1);
        var dist = Math.round(Math.hypot(jx, jy));
        var basePeak = 10 + dist - sp;
        var jumpPeak = Math.round(basePeak * hr);
        var jumpCount = Math.round(jumpPeak * 2 * dr);
        return Math.max(1, jumpCount);
    };

    EE.prototype.parseRouteJumpExScript = function(script) {
        var s = this.stripTrailingLineComment(String(script || '')).trim();
        if (!s.length) return null;
        var m = s.match(/^this\.jump\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*)?\)\s*;?$/i);
        if (!m) return null;
        return {
            dx: this.tileMoveSnapCoord(Number(m[1] || 0)),
            dy: this.tileMoveSnapCoord(Number(m[2] || 0)),
            heightRate: this.routeJumpRateValue(m[3], 1),
            durationRate: this.routeJumpRateValue(m[4], 1)
        };
    };

    EE.prototype.parseRouteJumpExCommand = function(routeCmd) {
        if (!routeCmd) return null;
        var code = Number(routeCmd.code || 0);
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        if (code === 14) {
            return {
                dx: this.tileMoveSnapCoord(Number(p[0] || 0)),
                dy: this.tileMoveSnapCoord(Number(p[1] || 0)),
                heightRate: 1,
                durationRate: 1
            };
        }
        if (code !== 45) return null;
        return this.parseRouteJumpExScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteJumpExScript = function(dx, dy, heightRate, durationRate) {
        var jx = this.tileMoveSnapCoord(Number(dx || 0));
        var jy = this.tileMoveSnapCoord(Number(dy || 0));
        var hr = this.routeJumpRateValue(heightRate, 1);
        var dr = this.routeJumpRateValue(durationRate, 1);
        return 'this.jump(' + this.tileMoveCoordText(jx) + ', ' + this.tileMoveCoordText(jy) + ', ' + this.formatCoordText(hr, 2, false) + ', ' + this.formatCoordText(dr, 2, false) + ')';
    };

    EE.prototype.parseRouteSetMoveSpeedScript = function(script) {
        var s = this.stripTrailingLineComment(String(script || '')).trim();
        if (!s.length) return null;
        var m = s.match(/^this\.setMoveSpeed\(\s*([-+]?\d+(?:\.\d+)?)\s*\)\s*;?$/i);
        if (!m) m = s.match(/^this\._moveSpeed\s*=\s*([-+]?\d+(?:\.\d+)?)\s*;?$/i);
        if (!m) return null;
        return { speed: this.normalizeRouteMoveSpeed(m[1], 4) };
    };

    EE.prototype.parseRouteSetMoveSpeedCommand = function(routeCmd) {
        if (!routeCmd) return null;
        var code = Number(routeCmd.code || 0);
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        if (code === 29) {
            return { speed: this.normalizeRouteMoveSpeed((p[0] == null ? 4 : p[0]), 4) };
        }
        if (code !== 45) return null;
        return this.parseRouteSetMoveSpeedScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteSetMoveSpeedScript = function(speed) {
        return 'this.setMoveSpeed(' + this.routeMoveSpeedText(speed) + ')';
    };

    EE.prototype.parseRouteTileGotoScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.goTo\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*\)\s*;?$/i);
        if (!m) return null;
        return { x: Number(m[1]), y: Number(m[2]) };
    };

    EE.prototype.parseRouteTileGotoCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteTileGotoScript(String(p[0] || ''));
    };

    EE.prototype.isRouteTileGotoCommand = function(routeCmd) {
        return !!this.parseRouteTileGotoCommand(routeCmd);
    };

    EE.prototype.parseFrameAnimationFrameSpecLiteral = function(specText) {
        var raw = String(specText == null ? '' : specText).trim();
        if (!raw.length) return null;
        if (/^[-+]?\d+$/.test(raw)) {
            var n = Math.max(1, Math.floor(Number(raw) || 1));
            return { kind: 'number', literal: String(n), number: n };
        }
        var m = raw.match(/^\[\s*([^\]]*)\s*\]$/);
        if (!m) return null;
        var body = String(m[1] || '').trim();
        if (!body.length) return null;
        var parts = body.split(',');
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            var tok = String(parts[i] || '').trim();
            if (!/^[-+]?\d+$/.test(tok)) return null;
            out.push(Math.floor(Number(tok) || 0));
        }
        if (!out.length) return null;
        return { kind: 'array', literal: '[' + out.join(',') + ']', values: out };
    };

    EE.prototype.normalizeFrameAnimationFrameSpecLiteral = function(specText, fallbackLiteral) {
        var p = this.parseFrameAnimationFrameSpecLiteral(specText);
        if (p) return p.literal;
        var fb = this.parseFrameAnimationFrameSpecLiteral(fallbackLiteral);
        if (fb) return fb.literal;
        return '[8,9,10]';
    };

    EE.prototype.parseCssRectOrderSpecLiteral = function(specText) {
        var raw = String(specText == null ? '' : specText).trim();
        if (!raw.length) return null;
        if (/^[-+]?\d+(?:\.\d+)?$/.test(raw)) {
            var n = Math.max(1, Math.floor(Number(raw) || 1));
            return { kind: 'number', literal: String(n), number: n };
        }
        var m = raw.match(/^\[\s*([^\]]*)\s*\]$/);
        if (!m) return null;
        var body = String(m[1] || '').trim();
        if (!body.length) return null;
        var parts = body.split(',');
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            var tok = String(parts[i] || '').trim();
            if (!/^[-+]?\d+$/.test(tok)) return null;
            out.push(Math.floor(Number(tok) || 0));
        }
        if (!out.length) return null;
        return { kind: 'array', literal: '[' + out.join(',') + ']', values: out };
    };

    EE.prototype.normalizeCssRectOrderSpecLiteral = function(specText, fallbackLiteral) {
        var p = this.parseCssRectOrderSpecLiteral(specText);
        if (p) return p.literal;
        var fb = this.parseCssRectOrderSpecLiteral(fallbackLiteral);
        if (fb) return fb.literal;
        return '1';
    };

    EE.prototype.escapeSingleQuotedJsString = function(text) {
        return String(text == null ? '' : text)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, '\\\'');
    };

    EE.prototype.normalizeDirection8 = function(value, fallback) {
        var d = Math.floor(Number(value || 0) || 0);
        if (d !== 2 && d !== 4 && d !== 6 && d !== 8) d = Math.floor(Number(fallback || 2) || 2);
        if (d !== 2 && d !== 4 && d !== 6 && d !== 8) d = 2;
        return d;
    };

    EE.prototype.parseRouteStartFrameAnimationListScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.startFrameAnimation\(\s*(\[[^\]]+\]|[-+]?\d+)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*,\s*(true|false)\s*\)\s*;?$/i);
        if (!m) return null;
        var spec = this.parseFrameAnimationFrameSpecLiteral(m[1]);
        if (!spec) return null;
        var speed = Math.floor(Number(m[2] || 0) || 0);
        var loop = String(m[3] || '').toLowerCase() === 'true';
        return { frameSpec: spec.literal, speed: speed, loop: loop };
    };

    EE.prototype.parseRouteStartFrameAnimationListCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteStartFrameAnimationListScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteStartFrameAnimationListScript = function(frameSpec, speed, loop) {
        var spec = this.normalizeFrameAnimationFrameSpecLiteral(frameSpec, '[8,9,10]');
        var spd = Math.floor(Number(speed || 0) || 0);
        var lp = !!loop;
        return 'this.startFrameAnimation(' + spec + ', ' + spd + ', ' + (lp ? 'true' : 'false') + ')';
    };

    EE.prototype.parseRouteEndFrameAnimationScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        if (/^this\.endFrameAnimation\(\)\s*;?$/i.test(s)) {
            return { keepPatternFix: true };
        }
        if (/^this\.endFrameAnimation\(\)\s*[,;]\s*this\._patternFix\s*=\s*false\s*;?$/i.test(s)) {
            return { keepPatternFix: false };
        }
        return null;
    };

    EE.prototype.parseRouteEndFrameAnimationCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteEndFrameAnimationScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteEndFrameAnimationScript = function(keepPatternFix) {
        return keepPatternFix
            ? 'this.endFrameAnimation();'
            : 'this.endFrameAnimation(), this._patternFix = false;';
    };

    EE.prototype.parseRouteSetImageAndStartFrameAnimationScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.setImageZXC\(\s*(['"])(.*?)\1\s*,\s*([-+]?\d+)\s*,\s*([-+]?\d+)\s*\)\s*[;,]\s*this\.startFrameAnimation\(\s*(\[[^\]]+\]|[-+]?\d+)\s*,\s*([-+]?\d+)\s*,\s*(true|false)\s*\)\s*;?$/i);
        if (!m) return null;
        var spec = this.parseFrameAnimationFrameSpecLiteral(m[5]);
        if (!spec) return null;
        return {
            imageName: String(m[2] || ''),
            imageIndex: Math.floor(Number(m[3] || 0) || 0),
            imageDir: this.normalizeDirection8(Number(m[4] || 2), 2),
            frameSpec: spec.literal,
            speed: Math.floor(Number(m[6] || 0) || 0),
            loop: String(m[7] || '').toLowerCase() === 'true'
        };
    };

    EE.prototype.parseRouteSetImageAndStartFrameAnimationCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteSetImageAndStartFrameAnimationScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteSetImageAndStartFrameAnimationScript = function(imageName, imageIndex, imageDir, frameSpec, speed, loop) {
        var name = this.escapeSingleQuotedJsString(imageName);
        var idx = Math.floor(Number(imageIndex || 0) || 0);
        var dir = this.normalizeDirection8(imageDir, 2);
        var spec = this.normalizeFrameAnimationFrameSpecLiteral(frameSpec, '[8,9,10]');
        var spd = Math.floor(Number(speed || 0) || 0);
        var lp = !!loop;
        return "this.setImageZXC('" + name + "', " + idx + ', ' + dir + '), this.startFrameAnimation(' + spec + ', ' + spd + ', ' + (lp ? 'true' : 'false') + ')';
    };

    EE.prototype.parseRoutePlayCssRectAnimationScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.command_playCssRectAnimation\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*,\s*(\[[^\]]+\]|[-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*,\s*(true|false)\s*\)\s*;?$/i);
        if (!m) return null;
        var order = this.parseCssRectOrderSpecLiteral(m[3]);
        if (!order) return null;
        return {
            rows: Math.max(1, Math.floor(Number(m[1] || 1) || 1)),
            cols: Math.max(1, Math.floor(Number(m[2] || 1) || 1)),
            orderSpec: order.literal,
            frameWait: Math.max(1, Math.floor(Number(m[4] || 1) || 1)),
            loop: String(m[5] || '').toLowerCase() === 'true'
        };
    };

    EE.prototype.parseRoutePlayCssRectAnimationCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRoutePlayCssRectAnimationScript(String(p[0] || ''));
    };

    EE.prototype.makeRoutePlayCssRectAnimationScript = function(rows, cols, orderSpec, frameWait, loop) {
        var r = Math.max(1, Math.floor(Number(rows || 1) || 1));
        var c = Math.max(1, Math.floor(Number(cols || 1) || 1));
        var ord = this.normalizeCssRectOrderSpecLiteral(orderSpec, '1');
        var fw = Math.max(1, Math.floor(Number(frameWait || 1) || 1));
        var lp = !!loop;
        return 'this.command_playCssRectAnimation(' + r + ', ' + c + ', ' + ord + ', ' + fw + ', ' + (lp ? 'true' : 'false') + ')';
    };

    EE.prototype.parseRouteStopCssRectAnimationScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        if (!/^this\.command_stopCssRectAnimation\(\s*\)\s*;?$/i.test(s)) return null;
        return { stop: true };
    };

    EE.prototype.parseRouteStopCssRectAnimationCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteStopCssRectAnimationScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteStopCssRectAnimationScript = function() {
        return 'this.command_stopCssRectAnimation()';
    };

    EE.prototype.parseRouteSetImageZxcScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.setImageZXC\(\s*(['"])(.*?)\1\s*,\s*([-+]?\d+)\s*,\s*([-+]?\d+)\s*\)\s*;?$/i);
        if (!m) return null;
        return {
            name: String(m[2] || ''),
            x: Math.floor(Number(m[3] || 0) || 0),
            y: Math.floor(Number(m[4] || 0) || 0)
        };
    };

    EE.prototype.parseRouteSetImageZxcCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteSetImageZxcScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteSetImageZxcScript = function(name, x, y) {
        var imageName = this.escapeSingleQuotedJsString(name);
        var sx = Math.floor(Number(x || 0) || 0);
        var sy = Math.floor(Number(y || 0) || 0);
        return "this.setImageZXC('" + imageName + "', " + sx + ', ' + sy + ')';
    };

    EE.prototype.parseRouteLocateFollowerAndDirectionScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.locateToCharacter\(\s*\$gamePlayer\._followers\.follower\(\s*(\d+)\s*\)\s*\)\s*[;,]\s*this\._direction\s*=\s*(\d+)\s*;?$/i);
        if (!m) return null;
        return {
            followerIndex: Math.max(0, Math.floor(Number(m[1] || 0) || 0)),
            direction: this.normalizeDirection8(Number(m[2] || 2), 2)
        };
    };

    EE.prototype.parseRouteLocateFollowerAndDirectionCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteLocateFollowerAndDirectionScript(String(p[0] || ''));
    };

    EE.prototype.routePartyMemberToFollowerIndex = function(partyMember) {
        var m = Math.floor(Number(partyMember || 2) || 2);
        if (m <= 2) return 1;
        if (m === 3) return 3;
        return 5;
    };

    EE.prototype.routeFollowerIndexToPartyMember = function(followerIndex) {
        var idx = Math.max(0, Math.floor(Number(followerIndex || 0) || 0));
        if (idx >= 5) return 4;
        if (idx >= 3) return 3;
        return 2;
    };

    EE.prototype.makeRouteLocateFollowerAndDirectionScript = function(followerIndex, direction) {
        var idx = Math.max(0, Math.floor(Number(followerIndex || 0) || 0));
        var dir = this.normalizeDirection8(direction, 6);
        return 'this.locateToCharacter($gamePlayer._followers.follower(' + idx + ')), this._direction = ' + dir;
    };

    EE.prototype.parseRouteGoToFollowerScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.goToCharacter\(\s*\$gamePlayer\._followers\.follower\(\s*(\d+)\s*\)\s*\)\s*;?$/i);
        if (!m) return null;
        return { followerIndex: Math.max(0, Math.floor(Number(m[1] || 0) || 0)) };
    };

    EE.prototype.parseRouteGoToFollowerCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteGoToFollowerScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteGoToFollowerScript = function(followerIndex) {
        var idx = Math.max(0, Math.floor(Number(followerIndex || 0) || 0));
        return 'this.goToCharacter($gamePlayer._followers.follower(' + idx + '))';
    };

    EE.prototype.isRouteGoToFollowerCommand = function(routeCmd) {
        return !!this.parseRouteGoToFollowerCommand(routeCmd);
    };

    EE.prototype.parseRouteStartMaskFadeOutScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.startMaskFadeOut\(\s*(\d+)\s*\)\s*;?$/i);
        if (!m) return null;
        return { frames: Math.max(1, Math.floor(Number(m[1] || 1) || 1)) };
    };

    EE.prototype.parseRouteStartMaskFadeOutCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteStartMaskFadeOutScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteStartMaskFadeOutScript = function(frames) {
        var f = Math.max(1, Math.floor(Number(frames || 1) || 1));
        return 'this.startMaskFadeOut(' + f + ')';
    };

    EE.prototype.parseRouteStartMaskFadeInScript = function(script) {
        var s = String(script == null ? '' : script).trim();
        if (!s) return null;
        var m = s.match(/^this\.startMaskFadeIn\(\s*(\d+)\s*\)\s*;?$/i);
        if (!m) return null;
        return { frames: Math.max(1, Math.floor(Number(m[1] || 1) || 1)) };
    };

    EE.prototype.parseRouteStartMaskFadeInCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteStartMaskFadeInScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteStartMaskFadeInScript = function(frames) {
        var f = Math.max(1, Math.floor(Number(frames || 1) || 1));
        return 'this.startMaskFadeIn(' + f + ')';
    };

    EE.prototype.parseRouteShiverControlScript = function(script) {
        var s = this.stripTrailingLineComment(String(script || '')).trim();
        if (!s.length) return null;
        if (/^this\.startShiverX\(\s*\)\s*;?$/i.test(s)) return { action: 'start', shakeType: 'shiverX' };
        if (/^this\.startGatagata\(\s*\)\s*;?$/i.test(s)) return { action: 'start', shakeType: 'gatagata' };
        if (/^this\.stopShiverX\(\s*\)\s*;?$/i.test(s)) return { action: 'stop' };
        if (/^this\.stopGatagata\(\s*\)\s*;?$/i.test(s)) return { action: 'stop' };
        if (/^this\.stopShiverX\(\s*\)\s*[,;]\s*this\.stopGatagata\(\s*\)\s*;?$/i.test(s)) return { action: 'stop' };
        if (/^this\.stopGatagata\(\s*\)\s*[,;]\s*this\.stopShiverX\(\s*\)\s*;?$/i.test(s)) return { action: 'stop' };
        return null;
    };

    EE.prototype.parseRouteShiverControlCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteShiverControlScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteShiverStartScript = function(shakeType) {
        return String(shakeType || '') === 'gatagata'
            ? 'this.startGatagata()'
            : 'this.startShiverX()';
    };

    EE.prototype.makeRouteShiverStopScript = function() {
        return 'this.stopShiverX(), this.stopGatagata();';
    };

    EE.prototype.routeDisplayCodeCacheRead = function(routeCmd, scriptText) {
        if (!routeCmd) return null;
        var cache = routeCmd._eeRouteDisplayCache;
        if (!cache || Number(cache.code || 0) !== 45) return null;
        if (String(cache.scriptText || '') !== String(scriptText || '')) return null;
        var dcode = Math.floor(Number(cache.displayCode || 0));
        return dcode > 0 ? dcode : null;
    };

    EE.prototype.routeDisplayCodeCacheWrite = function(routeCmd, scriptText, displayCode) {
        if (!routeCmd) return;
        var payload = {
            code: 45,
            scriptText: String(scriptText || ''),
            displayCode: Math.floor(Number(displayCode || 45))
        };
        try {
            Object.defineProperty(routeCmd, '_eeRouteDisplayCache', {
                value: payload,
                writable: true,
                configurable: true,
                enumerable: false
            });
        } catch (_) {
            routeCmd._eeRouteDisplayCache = payload;
        }
    };

    EE.prototype.routeDisplayCodeForCommand = function(routeCmd) {
        if (!routeCmd) return 0;
        var code = Number(routeCmd.code || 0);
        if (code !== 45) return code;
        var params = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        var scriptText = String(params[0] || '');
        var cachedDisplayCode = this.routeDisplayCodeCacheRead(routeCmd, scriptText);
        if (cachedDisplayCode != null) return cachedDisplayCode;

        var out = 45;
        if (this.parseRouteJumpExCommand(routeCmd)) out = 14;
        else if (this.parseRouteSetMoveSpeedCommand(routeCmd)) out = 29;
        else if (this.isRouteTileGotoCommand(routeCmd)) out = 4500;
        else if (this.parseRouteStartFrameAnimationListCommand(routeCmd)) out = 4510;
        else if (this.parseRouteSetImageAndStartFrameAnimationCommand(routeCmd)) out = 4510;
        else if (this.parseRouteEndFrameAnimationCommand(routeCmd)) out = 4523;
        else if (this.parseRouteSetImageZxcCommand(routeCmd)) out = 4514;
        else if (this.parseRoutePlayCssRectAnimationCommand(routeCmd)) out = 4521;
        else if (this.parseRouteStopCssRectAnimationCommand(routeCmd)) out = 4522;
        else if (this.parseRouteLocateFollowerAndDirectionCommand(routeCmd)) out = 4512;
        else if (this.parseRouteGoToFollowerCommand(routeCmd)) out = 4519;
        else if (this.parseRouteStartMaskFadeOutCommand(routeCmd)) out = 4513;
        else if (this.parseRouteStartMaskFadeInCommand(routeCmd)) out = 4520;
        var shiver = (out === 45) ? this.parseRouteShiverControlCommand(routeCmd) : null;
        if (shiver) {
            out = shiver.action === 'start' ? 4515 : 4516;
        }
        this.routeDisplayCodeCacheWrite(routeCmd, scriptText, out);
        return out;
    };

    EE.prototype.makeRouteTileGotoScript = function(x, y) {
        var sx = this.tileMoveCoordText(Number(x || 0));
        var sy = this.tileMoveCoordText(Number(y || 0));
        return 'this.goTo(' + sx + ', ' + sy + ')';
    };

    EE.prototype.routeTileGotoWaitHardCap = function() {
        // Guard against runaway waits that can make timeline canvas exceed browser limits.
        return 6000;
    };

    EE.prototype.clampRouteTileGotoWaitFrames = function(waitFrames) {
        var v = Math.max(1, Math.floor(Number(waitFrames || 1) || 1));
        var cap = Math.max(1, Math.floor(Number(this.routeTileGotoWaitHardCap() || 1) || 1));
        return Math.min(v, cap);
    };

    EE.prototype.routeTileGotoCommandWaitFrames = function(routeCmd) {
        if (!this.isRouteTileGotoCommand(routeCmd)) return 1;
        return this.clampRouteTileGotoWaitFrames(routeCmd && routeCmd._eeTileWait);
    };

    EE.prototype.setRouteTileGotoCommandWaitFrames = function(routeCmd, waitFrames) {
        if (!routeCmd || !this.isRouteTileGotoCommand(routeCmd)) return;
        var wf = this.clampRouteTileGotoWaitFrames(waitFrames);
        if (wf <= 1) delete routeCmd._eeTileWait;
        else routeCmd._eeTileWait = wf;
    };

    EE.prototype.routeGoToFollowerCommandWaitFrames = function(routeCmd) {
        if (!this.isRouteGoToFollowerCommand(routeCmd)) return 1;
        return this.clampRouteTileGotoWaitFrames(routeCmd && routeCmd._eeGoToFollowerWait);
    };

    EE.prototype.setRouteGoToFollowerCommandWaitFrames = function(routeCmd, waitFrames) {
        if (!routeCmd || !this.isRouteGoToFollowerCommand(routeCmd)) return;
        var wf = this.clampRouteTileGotoWaitFrames(waitFrames);
        if (wf <= 1) delete routeCmd._eeGoToFollowerWait;
        else routeCmd._eeGoToFollowerWait = wf;
    };

    EE.prototype.routeTileGotoWaitFrames = function(entry, routeListIndex) {
        var wf = 1;
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return wf;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.max(0, Math.floor(Number(routeListIndex == null ? -1 : routeListIndex)));
        if (idx < 0 || idx >= list.length) return wf;
        var cur = list[idx];
        if (this.isRouteTileGotoCommand(cur)) {
            wf = this.routeTileGotoCommandWaitFrames(cur);
            if (wf > 1) return Math.max(1, wf);
        }
        var next = list[idx + 1];
        if (next && Number(next.code || 0) === 15) {
            wf += Math.max(1, Math.floor(Number((next.parameters || [0])[0] || 0)));
        }
        return Math.max(1, wf);
    };

    EE.prototype.routeGoToFollowerWaitFrames = function(entry, routeListIndex) {
        var wf = 1;
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return wf;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.max(0, Math.floor(Number(routeListIndex == null ? -1 : routeListIndex)));
        if (idx < 0 || idx >= list.length) return wf;
        var cur = list[idx];
        if (this.isRouteGoToFollowerCommand(cur)) {
            wf = this.routeGoToFollowerCommandWaitFrames(cur);
            if (wf > 1) return Math.max(1, wf);
        }
        var next = list[idx + 1];
        if (next && Number(next.code || 0) === 15) {
            wf += Math.max(1, Math.floor(Number((next.parameters || [0])[0] || 0)));
        }
        return Math.max(1, wf);
    };

    EE.prototype.routeCharacterByEntry = function(entry) {
        if (!entry) return null;
        var cid = (entry.charId == null)
            ? Number((((entry.command || {}).parameters || [0])[0] || 0))
            : Number(entry.charId || 0);
        cid = this.normalizeMoveTarget(cid);
        if (cid === 0) {
            var eid = Math.floor(Number(entry.eventId || 0));
            if (eid > 0 && $gameMap && typeof $gameMap.event === 'function') return $gameMap.event(eid) || null;
        }
        return this.characterByPanelId ? this.characterByPanelId(cid) : null;
    };

    EE.prototype.routeFollowerCharacterByIndex = function(followerIndex) {
        var idx = Math.max(0, Math.floor(Number(followerIndex || 0) || 0));
        if (!$gamePlayer || !$gamePlayer._followers || typeof $gamePlayer._followers.follower !== 'function') return null;
        return $gamePlayer._followers.follower(idx) || null;
    };

    EE.prototype.routeTileGotoStartPositionFromMapData = function(entry) {
        if (!entry) return null;
        var cid = (entry.charId == null)
            ? Number((((entry.command || {}).parameters || [0])[0] || 0))
            : Number(entry.charId || 0);
        cid = this.normalizeMoveTarget(cid);
        if (cid === 0) cid = this.normalizeMoveTarget(Number(entry.eventId || 0));
        if (cid <= 0) return null;
        var ev = ($dataMap && $dataMap.events) ? $dataMap.events[cid] : null;
        if (!ev) return null;
        var ex = Number(ev.x);
        var ey = Number(ev.y);
        if (!isFinite(ex) || !isFinite(ey)) return null;
        return { x: ex, y: ey };
    };

    EE.prototype.routeTileGotoAutoWaitFrames = function(entry, routeListIndex, targetX, targetY, startX, startY) {
        var fallback = this.routeTileGotoWaitFrames(entry, routeListIndex);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) {
            if (this.isCalcDebugEnabled()) this.logTileWaitDebug('auto_skip_invalid_entry', {
                fallback: fallback,
                routeListIndex: Math.floor(Number(routeListIndex == null ? -1 : routeListIndex))
            });
            return fallback;
        }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.max(0, Math.floor(Number(routeListIndex == null ? -1 : routeListIndex)));
        if (idx < 0 || idx >= list.length) {
            if (this.isCalcDebugEnabled()) this.logTileWaitDebug('auto_skip_out_of_range', {
                fallback: fallback,
                eventId: Math.floor(Number(entry.eventId || 0)),
                pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                uid: Math.floor(Number(entry.uid || 0)),
                routeListIndex: idx,
                routeLength: list.length
            });
            return fallback;
        }

        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!isFinite(tx) || !isFinite(ty)) {
            var cur = this.parseRouteTileGotoCommand(list[idx]);
            if (!cur) {
                if (this.isCalcDebugEnabled()) this.logTileWaitDebug('auto_skip_not_goto', {
                    fallback: fallback,
                    eventId: Math.floor(Number(entry.eventId || 0)),
                    pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                    uid: Math.floor(Number(entry.uid || 0)),
                    routeListIndex: idx
                });
                return fallback;
            }
            tx = Number(cur.x || 0);
            ty = Number(cur.y || 0);
        }

        var speed = 4;
        for (var i = 0; i < idx; i++) {
            var rc = list[i];
            if (!rc) continue;
            var speedCmd = this.parseRouteSetMoveSpeedCommand(rc);
            if (speedCmd) speed = speedCmd.speed;
        }

        var sx = Number(startX);
        var sy = Number(startY);
        var hasExplicitStart = isFinite(sx) && isFinite(sy);
        var startSource = hasExplicitStart ? 'explicit' : '';
        if (!hasExplicitStart) {
            sx = null;
            sy = null;
            for (i = idx - 1; i >= 0; i--) {
                var prev = this.parseRouteTileGotoCommand(list[i]);
                if (!prev) continue;
                sx = Number(prev.x || 0);
                sy = Number(prev.y || 0);
                startSource = 'prev_goto';
                break;
            }
        }
        if (sx == null || sy == null) {
            var ch = this.routeCharacterByEntry(entry);
            if (ch) {
                sx = Number(ch.x == null ? ch._x : ch.x);
                sy = Number(ch.y == null ? ch._y : ch.y);
                startSource = 'runtime_character';
            }
        }
        if (sx == null || sy == null) {
            var st = this.routeTileGotoStartPositionFromMapData(entry);
            if (st) {
                sx = Number(st.x);
                sy = Number(st.y);
                startSource = 'map_data_initial';
            }
        }
        if (!isFinite(Number(sx)) || !isFinite(Number(sy))) {
            if (this.isCalcDebugEnabled()) this.logTileWaitDebug('auto_invalid_start', {
                eventId: Math.floor(Number(entry.eventId || 0)),
                pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                uid: Math.floor(Number(entry.uid || 0)),
                routeListIndex: idx,
                targetX: Number(tx),
                targetY: Number(ty),
                speed: speed,
                fallback: fallback,
                startSource: startSource || 'none'
            });
            return fallback;
        }

        var dist = Math.abs(Number(tx || 0) - Number(sx || 0)) + Math.abs(Number(ty || 0) - Number(sy || 0));
        var step = this.moveStepFrames(Number(speed || 4));
        var waitFrames = this.clampRouteTileGotoWaitFrames(Math.ceil(dist * step));
        if (this.isCalcDebugEnabled()) this.logTileWaitDebug('auto_wait', {
            eventId: Math.floor(Number(entry.eventId || 0)),
            pageIndex: Math.floor(Number(entry.pageIndex || 0)),
            uid: Math.floor(Number(entry.uid || 0)),
            entryFrame: Math.max(0, Math.floor(Number(entry.frame || 0))),
            charId: Math.floor(Number(entry.charId == null ? (((entry.command || {}).parameters || [0])[0] || 0) : entry.charId || 0)),
            routeListIndex: idx,
            startX: Number(sx),
            startY: Number(sy),
            targetX: Number(tx),
            targetY: Number(ty),
            speed: speed,
            dist: dist,
            stepFrames: step,
            fallback: fallback,
            waitFrames: waitFrames,
            startSource: startSource || 'none'
        });
        return waitFrames;
    };

    EE.prototype.routeTileGotoRuntimeWaitFrames = function(ch, targetX, targetY) {
        if (!ch) {
            if (this.isCalcDebugEnabled()) this.logTileWaitDebug('runtime_skip_no_character', {
                targetX: Number(targetX),
                targetY: Number(targetY)
            });
            return 0;
        }
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!isFinite(tx) || !isFinite(ty)) {
            if (this.isCalcDebugEnabled()) this.logTileWaitDebug('runtime_skip_invalid_target', {
                targetX: Number(targetX),
                targetY: Number(targetY)
            });
            return 0;
        }
        var capWait = this.clampRouteTileGotoWaitFrames(Number(this.routeTileGotoWaitHardCap() || 1));
        var sxTile = Number(ch.x == null ? ch._x : ch.x);
        var syTile = Number(ch.y == null ? ch._y : ch.y);
        var speed = Math.max(1, Math.min(6, Number(ch._moveSpeed || 4)));
        var fallbackWait = this.clampRouteTileGotoWaitFrames(
            Math.ceil((Math.abs(tx - sxTile) + Math.abs(ty - syTile)) * this.moveStepFrames(speed))
        );
        var calcDebugEnabled = this.isCalcDebugEnabled();
        if (calcDebugEnabled) {
            this.logCalcDebugEventState('runtime_wait_begin', {
                routeCharacter: ch,
                targetX: tx,
                targetY: ty
            });
        }
        var debugReason = 'ok';
        var debugFrames = 0;
        var debugStagnant = 0;
        var followerSnap = null;
        if (ch === $gamePlayer && typeof this.captureFollowersState === 'function') {
            try { followerSnap = this.captureFollowersState(); } catch (_) { followerSnap = null; }
        }
        var snap = null;
        if (typeof this.capCh === 'function') {
            try { snap = this.capCh(ch); } catch (_) { snap = null; }
        }
        var fallback = null;
        if (!snap) {
            fallback = {
                x: Number(ch._x),
                y: Number(ch._y),
                rx: Number(ch._realX),
                ry: Number(ch._realY),
                dir: Number((typeof ch.direction === 'function') ? ch.direction() : ch._direction || 2),
                wait: Number(ch._waitCount || 0)
            };
        }
        try {
            if (typeof ch.goTo === 'function') ch.goTo(tx, ty);
            else {
                ch._x = tx;
                ch._y = ty;
            }
            var frames = 0;
            var limit = Math.max(1200, Math.min(360000, capWait * 8));
            var needFallback = false;
            var stagnant = 0;
            while (frames < limit) {
                var rx0 = Number(ch._realX == null ? ch.x : ch._realX);
                var ry0 = Number(ch._realY == null ? ch.y : ch._realY);
                var remain0 = Math.abs(tx - rx0) + Math.abs(ty - ry0);
                if (remain0 <= 1e-6) break;
                if (typeof ch.updateMove === 'function') {
                    ch.updateMove();
                } else {
                    var dpf = (typeof ch.distancePerFrame === 'function')
                        ? Number(ch.distancePerFrame() || 0)
                        : (1 / this.moveStepFrames(Number(ch._moveSpeed || 4)));
                    if (!(dpf > 0)) dpf = 1 / this.moveStepFrames(4);
                    if (Number(ch._x || 0) < Number(ch._realX || 0)) ch._realX = Math.max(Number(ch._realX || 0) - dpf, Number(ch._x || 0));
                    if (Number(ch._x || 0) > Number(ch._realX || 0)) ch._realX = Math.min(Number(ch._realX || 0) + dpf, Number(ch._x || 0));
                    if (Number(ch._y || 0) < Number(ch._realY || 0)) ch._realY = Math.max(Number(ch._realY || 0) - dpf, Number(ch._y || 0));
                    if (Number(ch._y || 0) > Number(ch._realY || 0)) ch._realY = Math.min(Number(ch._realY || 0) + dpf, Number(ch._y || 0));
                }
                var rx1 = Number(ch._realX == null ? ch.x : ch._realX);
                var ry1 = Number(ch._realY == null ? ch.y : ch._realY);
                var moved = Math.abs(rx1 - rx0) + Math.abs(ry1 - ry0);
                if (!(moved > 1e-7)) stagnant++;
                else stagnant = 0;
                if (stagnant >= 16) {
                    needFallback = true;
                    debugReason = 'fallback_stagnant';
                    break;
                }
                frames++;
            }
            if (frames >= limit) {
                needFallback = true;
                if (debugReason === 'ok') debugReason = 'fallback_limit';
            }
            debugFrames = Math.floor(Number(frames || 0));
            debugStagnant = Math.floor(Number(stagnant || 0));
            if (needFallback) {
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('runtime_wait_fallback', {
                        routeCharacter: ch,
                        targetX: tx,
                        targetY: ty,
                        reason: debugReason,
                        waitFrames: fallbackWait
                    });
                }
                if (this.isCalcDebugEnabled()) this.logTileWaitDebug('runtime_wait', {
                    reason: debugReason,
                    startX: sxTile,
                    startY: syTile,
                    targetX: tx,
                    targetY: ty,
                    speed: speed,
                    capWait: capWait,
                    fallbackWait: fallbackWait,
                    frames: debugFrames,
                    stagnant: debugStagnant,
                    limit: limit
                });
                return fallbackWait;
            }
            var waitFrames = this.clampRouteTileGotoWaitFrames(Math.floor(Number(frames || 0)));
            if (calcDebugEnabled) {
                this.logCalcDebugEventState('runtime_wait_success', {
                    routeCharacter: ch,
                    targetX: tx,
                    targetY: ty,
                    reason: 'ok',
                    waitFrames: waitFrames
                });
            }
            if (this.isCalcDebugEnabled()) this.logTileWaitDebug('runtime_wait', {
                reason: 'ok',
                startX: sxTile,
                startY: syTile,
                targetX: tx,
                targetY: ty,
                speed: speed,
                capWait: capWait,
                fallbackWait: fallbackWait,
                frames: debugFrames,
                stagnant: debugStagnant,
                limit: limit,
                waitFrames: waitFrames
            });
            return waitFrames;
        } finally {
            try {
                if (snap && typeof this.resCh === 'function') this.resCh(ch, snap);
                else if (fallback) {
                    ch._x = fallback.x;
                    ch._y = fallback.y;
                    ch._realX = fallback.rx;
                    ch._realY = fallback.ry;
                    ch._direction = fallback.dir;
                    ch._waitCount = fallback.wait;
                }
                if (followerSnap && typeof this.restoreFollowersState === 'function') {
                    this.restoreFollowersState(followerSnap);
                }
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('runtime_wait_restored', {
                        routeCharacter: ch,
                        targetX: tx,
                        targetY: ty
                    });
                }
            } catch (_) {}
        }
    };

    EE.prototype.routeGoToFollowerAutoWaitFrames = function(entry, routeListIndex, followerIndex, startX, startY, targetX, targetY) {
        var fallback = this.routeGoToFollowerWaitFrames(entry, routeListIndex);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return fallback;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.max(0, Math.floor(Number(routeListIndex == null ? -1 : routeListIndex)));
        if (idx < 0 || idx >= list.length) return fallback;
        var rc = list[idx];
        if (!this.isRouteGoToFollowerCommand(rc)) return fallback;
        var parsed = this.parseRouteGoToFollowerCommand(rc);
        var fi = Math.max(0, Math.floor(Number(followerIndex == null ? (parsed ? parsed.followerIndex : 0) : followerIndex) || 0));
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!isFinite(tx) || !isFinite(ty)) {
            var follower = this.routeFollowerCharacterByIndex(fi);
            if (!follower) return fallback;
            tx = Number(follower.x == null ? follower._x : follower.x);
            ty = Number(follower.y == null ? follower._y : follower.y);
        }
        if (!isFinite(tx) || !isFinite(ty)) return fallback;

        var speed = 4;
        for (var i = 0; i < idx; i++) {
            var prev = list[i];
            if (!prev) continue;
            var speedCmd = this.parseRouteSetMoveSpeedCommand(prev);
            if (speedCmd) speed = speedCmd.speed;
        }

        var sx = Number(startX);
        var sy = Number(startY);
        if (!isFinite(sx) || !isFinite(sy)) {
            var ch = this.routeCharacterByEntry(entry);
            if (ch) {
                sx = Number(ch.x == null ? ch._x : ch.x);
                sy = Number(ch.y == null ? ch._y : ch.y);
            }
        }
        if (!isFinite(sx) || !isFinite(sy)) {
            var st = this.routeTileGotoStartPositionFromMapData(entry);
            if (st) {
                sx = Number(st.x);
                sy = Number(st.y);
            }
        }
        if (!isFinite(sx) || !isFinite(sy)) return fallback;
        var dist = Math.abs(tx - sx) + Math.abs(ty - sy);
        return this.clampRouteTileGotoWaitFrames(Math.ceil(dist * this.moveStepFrames(speed)));
    };

    EE.prototype.routeGoToFollowerRuntimeWaitFrames = function(ch, followerIndex, targetCh) {
        if (!ch) return 0;
        var target = targetCh || this.routeFollowerCharacterByIndex(followerIndex);
        if (!target) return 0;
        var tx = Number(target.x == null ? target._x : target.x);
        var ty = Number(target.y == null ? target._y : target.y);
        if (!isFinite(tx) || !isFinite(ty)) return 0;
        return this.routeTileGotoRuntimeWaitFrames(ch, tx, ty);
    };

    EE.prototype.setRouteGoToFollowerWaitFrames = function(list, idx, waitFrames) {
        if (!Array.isArray(list)) return;
        idx = Math.max(0, Math.floor(Number(idx || 0)));
        var cur = list[idx];
        if (!cur || !this.isRouteGoToFollowerCommand(cur)) return;
        this.setRouteGoToFollowerCommandWaitFrames(cur, waitFrames);
        list[idx] = cur;
    };

    EE.prototype.setRouteTileGotoWaitFrames = function(list, idx, waitFrames) {
        if (!Array.isArray(list)) return;
        idx = Math.max(0, Math.floor(Number(idx || 0)));
        waitFrames = Math.max(1, Math.floor(Number(waitFrames || 1)));
        var cur = list[idx];
        if (!cur) return;
        if (!this.isRouteTileGotoCommand(cur)) return;
        this.setRouteTileGotoCommandWaitFrames(cur, waitFrames);
        list[idx] = cur;
        // Legacy migration: remove hidden wait command that used to be
        // inserted after tile-goto. Runtime now waits inside goTo itself.
        var next = list[idx + 1];
        if (next && Number(next.code || 0) === 15) list.splice(idx + 1, 1);
    };

    EE.prototype.recalculateRouteTileGotoWaitMetaForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list || !list.length) return;
        for (var i = 0; i < list.length; i++) {
            var rc = list[i];
            if (this.isRouteTileGotoCommand(rc)) {
                var wf = this.routeTileGotoAutoWaitFrames(entry, i);
                this.setRouteTileGotoWaitFrames(list, i, wf);
                if (this.isCalcDebugEnabled()) this.logTileWaitDebug('recalc_auto_apply', {
                    eventId: Math.floor(Number(entry.eventId || 0)),
                    pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                    uid: Math.floor(Number(entry.uid || 0)),
                    entryFrame: Math.max(0, Math.floor(Number(entry.frame || 0))),
                    routeListIndex: i,
                    appliedWaitFrames: wf
                });
                continue;
            }
            if (this.isRouteGoToFollowerCommand(rc)) {
                var go = this.parseRouteGoToFollowerCommand(rc);
                var goWf = this.routeGoToFollowerAutoWaitFrames(entry, i, go && go.followerIndex);
                this.setRouteGoToFollowerWaitFrames(list, i, goWf);
                if (this.isCalcDebugEnabled()) this.logTileWaitDebug('recalc_auto_apply_go_to_follower', {
                    eventId: Math.floor(Number(entry.eventId || 0)),
                    pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                    uid: Math.floor(Number(entry.uid || 0)),
                    entryFrame: Math.max(0, Math.floor(Number(entry.frame || 0))),
                    routeListIndex: i,
                    appliedWaitFrames: goWf
                });
            }
        }
    };

    EE.prototype.recalculateRouteTileGotoWaitMetaForEntryBySimulation = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return;
        if (typeof this.simTo !== 'function') {
            this.recalculateRouteTileGotoWaitMetaForEntry(entry);
            return;
        }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list || !list.length) return;
        var baseFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        var speedState = 4;
        var calcDebugEnabled = this.isCalcDebugEnabled();
        if (this.isCalcDebugEnabled()) this.logTileWaitDebug('sim_recalc_begin', {
            eventId: Math.floor(Number(entry.eventId || 0)),
            pageIndex: Math.floor(Number(entry.pageIndex || 0)),
            uid: Math.floor(Number(entry.uid || 0)),
            entryFrame: baseFrame,
            routeLength: list.length
        });
        if (calcDebugEnabled) {
            this.logCalcDebugEventState('sim_recalc_begin_before_base_simto', {
                entry: entry,
                simFrame: baseFrame
            });
        }
        this.simTo(baseFrame, false);
        if (calcDebugEnabled) {
            this.logCalcDebugEventState('sim_recalc_begin_after_base_simto', {
                entry: entry,
                simFrame: baseFrame,
                routeCharacter: this.routeCharacterByEntry(entry)
            });
        }
        var baseCh = this.routeCharacterByEntry(entry);
        if (baseCh) {
            speedState = this.normalizeRouteMoveSpeed(baseCh._moveSpeed, 4);
        }
        var offset = 0;
        var i = 0;
        while (i < list.length) {
            var rc = list[i];
            var code = Math.floor(Number((rc && rc.code) || 0));
            if (code <= 0) break;
            if (code === 15) {
                offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
                i++;
                continue;
            }
            if (this.isRouteTileGotoCommand(rc)) {
                var tg = this.parseRouteTileGotoCommand(rc);
                var simFrame = Math.max(0, Math.floor(baseFrame + offset));
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('sim_recalc_goto_before_simto', {
                        entry: entry,
                        routeListIndex: i,
                        simFrame: simFrame,
                        offset: offset
                    });
                }
                this.simTo(simFrame, false);
                var ch = this.routeCharacterByEntry(entry);
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('sim_recalc_goto_after_simto', {
                        entry: entry,
                        routeListIndex: i,
                        simFrame: simFrame,
                        offset: offset,
                        routeCharacter: ch,
                        targetX: tg && tg.x,
                        targetY: tg && tg.y
                    });
                }
                var sx = null, sy = null;
                if (ch) {
                    sx = Number(ch.x == null ? ch._x : ch.x);
                    sy = Number(ch.y == null ? ch._y : ch.y);
                }
                var heuristicWf = this.routeTileGotoAutoWaitFrames(entry, i, tg && tg.x, tg && tg.y, sx, sy);
                var wf = ch ? this.routeTileGotoRuntimeWaitFrames(ch, tg && tg.x, tg && tg.y) : 0;
                var wfRaw = wf;
                var applyReason = 'runtime';
                if (!(wf > 0)) {
                    wf = heuristicWf;
                    applyReason = 'runtime_nonpositive_to_heuristic';
                } else if (heuristicWf > 0) {
                    // Simulation can drift when absolute frame alignment is stale
                    // (e.g. initial import before all route waits are stabilized).
                    var allowedMax = Math.max(heuristicWf + 180, heuristicWf * 4);
                    if (wf > allowedMax) {
                        wf = heuristicWf;
                        applyReason = 'runtime_outlier_to_heuristic';
                    }
                }
                this.setRouteTileGotoWaitFrames(list, i, wf);
                if (this.isCalcDebugEnabled()) this.logTileWaitDebug('sim_recalc_goto', {
                    eventId: Math.floor(Number(entry.eventId || 0)),
                    pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                    uid: Math.floor(Number(entry.uid || 0)),
                    entryFrame: baseFrame,
                    routeListIndex: i,
                    simFrame: simFrame,
                    offset: Math.max(0, Math.floor(Number(offset || 0))),
                    chX: sx == null ? null : Number(sx),
                    chY: sy == null ? null : Number(sy),
                    targetX: tg && isFinite(Number(tg.x)) ? Number(tg.x) : null,
                    targetY: tg && isFinite(Number(tg.y)) ? Number(tg.y) : null,
                    speedState: this.normalizeRouteMoveSpeed(speedState, 4),
                    heuristicWait: heuristicWf,
                    runtimeWait: wfRaw,
                    finalWait: wf,
                    applyReason: applyReason
                });
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('sim_recalc_goto_after_apply', {
                        entry: entry,
                        routeListIndex: i,
                        simFrame: simFrame,
                        offset: offset,
                        targetX: tg && tg.x,
                        targetY: tg && tg.y,
                        waitFrames: wf,
                        reason: applyReason,
                        routeCharacter: ch
                    });
                }
                rc = list[i];
                offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
                i++;
                continue;
            }
            if (this.isRouteGoToFollowerCommand(rc)) {
                var gtf = this.parseRouteGoToFollowerCommand(rc);
                var simFrame = Math.max(0, Math.floor(baseFrame + offset));
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('sim_recalc_go_to_follower_before_simto', {
                        entry: entry,
                        routeListIndex: i,
                        simFrame: simFrame,
                        offset: offset
                    });
                }
                this.simTo(simFrame, false);
                var ch = this.routeCharacterByEntry(entry);
                var follower = this.routeFollowerCharacterByIndex(gtf && gtf.followerIndex);
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('sim_recalc_go_to_follower_after_simto', {
                        entry: entry,
                        routeListIndex: i,
                        simFrame: simFrame,
                        offset: offset,
                        routeCharacter: ch
                    });
                }
                var sx = null;
                var sy = null;
                var tx = null;
                var ty = null;
                if (ch) {
                    sx = Number(ch.x == null ? ch._x : ch.x);
                    sy = Number(ch.y == null ? ch._y : ch.y);
                }
                if (follower) {
                    tx = Number(follower.x == null ? follower._x : follower.x);
                    ty = Number(follower.y == null ? follower._y : follower.y);
                }
                var heuristicWf = this.routeGoToFollowerAutoWaitFrames(entry, i, gtf && gtf.followerIndex, sx, sy, tx, ty);
                var wf = (ch && follower)
                    ? this.routeGoToFollowerRuntimeWaitFrames(ch, gtf && gtf.followerIndex, follower)
                    : 0;
                var wfRaw = wf;
                var applyReason = 'runtime';
                if (!(wf > 0)) {
                    wf = heuristicWf;
                    applyReason = 'runtime_nonpositive_to_heuristic';
                } else if (heuristicWf > 0) {
                    var allowedMax = Math.max(heuristicWf + 180, heuristicWf * 4);
                    if (wf > allowedMax) {
                        wf = heuristicWf;
                        applyReason = 'runtime_outlier_to_heuristic';
                    }
                }
                this.setRouteGoToFollowerWaitFrames(list, i, wf);
                if (this.isCalcDebugEnabled()) this.logTileWaitDebug('sim_recalc_go_to_follower', {
                    eventId: Math.floor(Number(entry.eventId || 0)),
                    pageIndex: Math.floor(Number(entry.pageIndex || 0)),
                    uid: Math.floor(Number(entry.uid || 0)),
                    entryFrame: baseFrame,
                    routeListIndex: i,
                    simFrame: simFrame,
                    offset: Math.max(0, Math.floor(Number(offset || 0))),
                    chX: sx == null ? null : Number(sx),
                    chY: sy == null ? null : Number(sy),
                    targetX: tx == null ? null : Number(tx),
                    targetY: ty == null ? null : Number(ty),
                    speedState: this.normalizeRouteMoveSpeed(speedState, 4),
                    heuristicWait: heuristicWf,
                    runtimeWait: wfRaw,
                    finalWait: wf,
                    applyReason: applyReason
                });
                if (calcDebugEnabled) {
                    this.logCalcDebugEventState('sim_recalc_go_to_follower_after_apply', {
                        entry: entry,
                        routeListIndex: i,
                        simFrame: simFrame,
                        offset: offset,
                        targetX: tx,
                        targetY: ty,
                        waitFrames: wf,
                        reason: applyReason,
                        routeCharacter: ch
                    });
                }
                rc = list[i];
                offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
                i++;
                continue;
            }
            offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
            speedState = this.routeSpeedStateAfterCommandForRecalc(rc, speedState);
            i++;
        }
        if (calcDebugEnabled) {
            this.logCalcDebugEventState('sim_recalc_end', {
                entry: entry
            });
        }
    };

    EE.prototype.routeCommandRuntimeSpanForRecalc = function(routeCmd, speedState) {
        if (!routeCmd) return 0;
        var code = Math.floor(Number(routeCmd.code || 0));
        if (code <= 0) return 0;
        var speed = this.normalizeRouteMoveSpeed(speedState, 4);
        if (code === 15) {
            var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
            return Math.max(1, Math.floor(Number(p[0] || 0) || 0));
        }
        if (code === 45 && this.isRouteTileGotoCommand(routeCmd)) {
            return this.routeTileGotoCommandWaitFrames(routeCmd);
        }
        if (code === 45 && this.isRouteGoToFollowerCommand(routeCmd)) {
            return this.routeGoToFollowerCommandWaitFrames(routeCmd);
        }
        if (code === 45) {
            var jumpEx = this.parseRouteJumpExCommand(routeCmd);
            if (jumpEx) return this.routeJumpDurationFrames(jumpEx.dx, jumpEx.dy, speed, jumpEx.heightRate, jumpEx.durationRate);
        }
        // Move one tile / approach / away / forward / backward
        if (code >= 1 && code <= 13) return this.moveStepFrames(speed);
        // Jump(x, y[, heightRate, durationRate])
        if (code === 14) {
            var p14 = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
            return this.routeJumpDurationFrames(
                Number(p14[0] || 0),
                Number(p14[1] || 0),
                speed,
                Number(p14.length >= 3 ? p14[2] : 1),
                Number(p14.length >= 4 ? p14[3] : 1)
            );
        }
        return 1;
    };

    EE.prototype.routeSpeedStateAfterCommandForRecalc = function(routeCmd, speedState) {
        var speed = this.normalizeRouteMoveSpeed(speedState, 4);
        if (!routeCmd) return speed;
        var parsed = this.parseRouteSetMoveSpeedCommand(routeCmd);
        if (!parsed) return speed;
        return parsed.speed;
    };

    EE.prototype.entryHasAutoWaitRouteCommand = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return false;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        for (var i = 0; i < list.length; i++) {
            if (this.isRouteTileGotoCommand(list[i]) || this.isRouteGoToFollowerCommand(list[i])) return true;
        }
        return false;
    };

    EE.prototype.trackHasAutoWaitRouteCommands = function(tr) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        for (var i = 0; i < tr.commands.length; i++) {
            if (this.entryHasAutoWaitRouteCommand(tr.commands[i])) return true;
        }
        return false;
    };

    EE.prototype.normalizeTrackRouteTileGotoWaitMeta = function(tr) {
        if (!this.trackHasAutoWaitRouteCommands(tr)) return false;
        var restoreFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        var canSim = (typeof this.simTo === 'function') && !this.play;
        var prevExecTrackKey = this._eeExecTrackKey;
        var scopedTrackKey = this.key(
            Math.floor(Number(tr.eventId || 0)),
            Math.floor(Number(tr.pageIndex || 0))
        );
        this._eeExecTrackKey = scopedTrackKey;
        var sorted = tr.commands.slice(0).sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        try {
            for (var i = 0; i < sorted.length; i++) {
                var e = sorted[i];
                if (!this.entryHasAutoWaitRouteCommand(e)) continue;
                if (canSim) this.recalculateRouteTileGotoWaitMetaForEntryBySimulation(e);
                else this.recalculateRouteTileGotoWaitMetaForEntry(e);
                e.wait = this.commandWaitFrames(e.command);
            }
        } finally {
            if (canSim) {
                this.simTo(restoreFrame, false);
                this.frame = restoreFrame;
            }
            this._eeExecTrackKey = prevExecTrackKey;
        }
        return true;
    };

    EE.prototype.stripRouteEditorMeta = function(route) {
        // Keep editor wait metadata in exported route commands.
        // Without this, loading cannot reconstruct 205 wait length deterministically
        // and subsequent command frames can collapse forward.
        return route;
    };

    EE.prototype.eventCommandNeedsEditorOnAdd = function(code, cmd) {
        var schema = this.getEditorSchema(code);
        if (schema && Array.isArray(schema.fields) && schema.fields.length > 0) return true;
        var p = cmd && Array.isArray(cmd.parameters) ? cmd.parameters : [];
        return p.length > 0;
    };

    EE.prototype.advanceTargetFrameByWait = function(frame, waitFrames) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        waitFrames = Math.max(0, Math.floor(Number(waitFrames || 0)));
        return waitFrames > 0 ? (frame + waitFrames) : frame;
    };

    EE.prototype.routeCommandSpanFrames = function(routeCmd) {
        if (!routeCmd) return 0;
        var code = Math.floor(Number(routeCmd.code || 0));
        if (code <= 0) return 0;
        if (code === 15) {
            var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
            return Math.max(1, Math.floor(Number(p[0] || 0) || 0));
        }
        if (code === 45 && this.isRouteTileGotoCommand(routeCmd)) {
            return this.routeTileGotoCommandWaitFrames(routeCmd);
        }
        if (code === 45 && this.isRouteGoToFollowerCommand(routeCmd)) {
            return this.routeGoToFollowerCommandWaitFrames(routeCmd);
        }
        if (code === 45) {
            var jumpEx = this.parseRouteJumpExCommand(routeCmd);
            if (jumpEx) return this.routeJumpDurationFrames(jumpEx.dx, jumpEx.dy, 4, jumpEx.heightRate, jumpEx.durationRate);
        }
        if (code >= 1 && code <= 13) {
            return this.moveStepFrames(4);
        }
        if (code === 14) {
            var p14 = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
            return this.routeJumpDurationFrames(
                Number(p14[0] || 0),
                Number(p14[1] || 0),
                4,
                Number(p14.length >= 3 ? p14[2] : 1),
                Number(p14.length >= 4 ? p14[3] : 1)
            );
        }
        return 1;
    };

    EE.prototype.captureRouteCharacterImageStateAtFrame = function(frame, charId) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        charId = this.normalizeMoveTarget(charId);
        var restoreFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        var restorePlay = !!this.play;
        var attemptedSimulation = false;
        var state = null;
        try {
            if (typeof this.simTo === 'function') {
                attemptedSimulation = true;
                this.simTo(frame, false);
            }
            var ch = this.characterByPanelId ? this.characterByPanelId(charId) : null;
            if (ch) {
                var name = (typeof ch.characterName === 'function') ? ch.characterName() : ch._characterName;
                var index = (typeof ch.characterIndex === 'function') ? ch.characterIndex() : ch._characterIndex;
                var direction = (typeof ch.direction === 'function') ? ch.direction() : ch._direction;
                state = {
                    name: String(name == null ? '' : name),
                    index: Math.max(0, Math.floor(Number(index || 0) || 0)),
                    direction: this.normalizeDirection8(Number(direction || 2), 2)
                };
            }
        } catch (_) {
            state = null;
        } finally {
            if (attemptedSimulation) {
                try { this.simTo(restoreFrame, false); } catch (_) {}
                this.play = restorePlay;
                if (this.setPlayBtn) this.setPlayBtn();
                if (restorePlay && this.rebuildSimAudioPlayback) this.rebuildSimAudioPlayback(this.frame);
                else if (this.stopEditorAudioPlayback) this.stopEditorAudioPlayback();
            }
        }
        return state;
    };

    EE.prototype.defaultRouteCharacterImageState = function(context) {
        context = context || {};
        var frame = (context.frame == null) ? this.routeAddFrame : context.frame;
        var charId = (context.charId == null) ? this.routeAddCharId : context.charId;
        return this.captureRouteCharacterImageStateAtFrame(frame, charId) || {
            name: '',
            index: 0,
            direction: 2
        };
    };

    EE.prototype.defaultRouteCharacterImageStateForEntry = function(entry, routeListIndex) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) {
            return this.defaultRouteCharacterImageState();
        }
        var frame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        var route = entry.command.parameters && entry.command.parameters[1];
        var timeline = this.moveRouteTimeline ? this.moveRouteTimeline(route) : null;
        var items = timeline && Array.isArray(timeline.items) ? timeline.items : [];
        var targetIndex = this.nodeRouteIndex ? this.nodeRouteIndex(routeListIndex) : Math.floor(Number(routeListIndex || 0));
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemIndex = this.nodeRouteIndex ? this.nodeRouteIndex(item && item.listIndex) : Math.floor(Number(item && item.listIndex || 0));
            if (itemIndex !== targetIndex) continue;
            frame += Math.max(0, Math.floor(Number(item && item.offset || 0)));
            break;
        }
        var routeParameters = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
        var charId = (entry.charId == null)
            ? Number(routeParameters[0] || 0)
            : Number(entry.charId || 0);
        return this.defaultRouteCharacterImageState({ frame: frame, charId: charId });
    };

    EE.prototype.makeMoveRouteCommandByCode = function(code, context) {
        code = Math.floor(Number(code || 0));
        if (code <= 0) return null;
        var p = [];
        var imageDefaults = null;
        if (code === 41 || code === 4510 || code === 4511 || code === 4514) {
            imageDefaults = this.defaultRouteCharacterImageState(context);
        }
        if (code === 4500) {
            return { code: 45, parameters: [this.makeRouteTileGotoScript(0, 0)] };
        } else if (code === 4510) {
            return { code: 45, parameters: [this.makeRouteSetImageAndStartFrameAnimationScript(imageDefaults.name, imageDefaults.index, imageDefaults.direction, '[8,9,10]', 6, false)] };
        } else if (code === 4523) {
            return { code: 45, parameters: [this.makeRouteEndFrameAnimationScript(false)] };
        } else if (code === 4514) {
            return { code: 45, parameters: [this.makeRouteSetImageZxcScript(imageDefaults.name, imageDefaults.index, imageDefaults.direction)] };
        } else if (code === 4521) {
            return { code: 45, parameters: [this.makeRoutePlayCssRectAnimationScript(1, 1, '1', 6, true)] };
        } else if (code === 4522) {
            return { code: 45, parameters: [this.makeRouteStopCssRectAnimationScript()] };
        } else if (code === 4511) {
            return { code: 45, parameters: [this.makeRouteSetImageAndStartFrameAnimationScript(imageDefaults.name, imageDefaults.index, imageDefaults.direction, '[8,9,10]', 6, false)] };
        } else if (code === 4512) {
            return { code: 45, parameters: [this.makeRouteLocateFollowerAndDirectionScript(1, 6)] };
        } else if (code === 4519) {
            return { code: 45, parameters: [this.makeRouteGoToFollowerScript(1)] };
        } else if (code === 4513) {
            return { code: 45, parameters: [this.makeRouteStartMaskFadeOutScript(70)] };
        } else if (code === 4520) {
            return { code: 45, parameters: [this.makeRouteStartMaskFadeInScript(70)] };
        } else if (code === 4515) {
            return { code: 45, parameters: [this.makeRouteShiverStartScript('shiverX')] };
        } else if (code === 4516) {
            return { code: 45, parameters: [this.makeRouteShiverStopScript()] };
        } else if (code === 4517) {
            return { code: 45, parameters: [this.makeRouteShiverStartScript('shiverX')] };
        } else if (code === 4518) {
            return { code: 45, parameters: [this.makeRouteShiverStopScript()] };
        } else if (code === 14) {
            return { code: 45, parameters: [this.makeRouteJumpExScript(0, 0, 1, 1)] };
        } else if (code === 15) {
            p = [30];
        } else if (code === 27 || code === 28) {
            p = [1];
        } else if (code === 29) {
            p = [4];
        } else if (code === 30) {
            p = [3];
        } else if (code === 41) {
            p = [imageDefaults.name, imageDefaults.index];
        } else if (code === 42) {
            p = [255];
        } else if (code === 43) {
            p = [0];
        } else if (code === 44) {
            p = [{
                name: 'Cursor1',
                volume: 90,
                pitch: 100,
                pan: 0
            }];
        } else if (code === 45) {
            p = [''];
        }
        return { code: code, parameters: p };
    };

    EE.prototype.renderRouteCommandColumn = function(parent, list, options) {
        if (!parent) return;
        parent.innerHTML = '';
        var self = this;
        var items = Array.isArray(list) ? list : [];
        options = options || {};
        var isExt = !!options.ext;
        for (var i = 0; i < items.length; i++) {
            (function(it) {
                if (!it) return;
                var b = self.el('button', 'rmcbtn', String(it.label || ''));
                if (isExt) b.classList.add('ext');
                b.type = 'button';
                b.addEventListener('click', function() {
                    var rc = self.makeMoveRouteCommandByCode(Number(it.code || 0), {
                        frame: self.routeAddFrame,
                        charId: self.routeAddCharId
                    });
                    if (!rc) return;
                    var placement = self.routeAddPlacementContext ? clone(self.routeAddPlacementContext) : null;
                    self.closeRouteCommandPanel();
                    var addResult = self.addRouteCommandAt(
                        self.routeAddFrame,
                        self.routeAddCharId,
                        rc,
                        placement
                    );
                    if (!addResult) return;
                    if (!self.routeCommandNeedsEditorOnAdd(Number(it.code || 0), rc)) return;
                    self.openEditor(addResult.uid, addResult.routeListIndex);
                });
                parent.appendChild(b);
            })(items[i]);
        }
    };

    EE.prototype.findCharRouteEntryAtTimelineFrame = function(tr, charId, frame) {
        if (!tr || !Array.isArray(tr.commands)) return null;
        charId = this.normalizeMoveTarget(charId);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var best = null;
        var bestStart = -1;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char' || Number(e.charId || 0) !== Number(charId)) continue;
            if (!e.command || Number(e.command.code || 0) !== 205) continue;
            var route = e.command.parameters && e.command.parameters[1];
            var tl = this.moveRouteTimeline(route);
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(1, Math.floor(Number(tl && tl.totalFrames || 0)));
            var ed = s + w;
            if (frame < s || frame > ed) continue;
            if (s >= bestStart) {
                best = e;
                bestStart = s;
            }
        }
        return best;
    };

    EE.prototype.addRouteCommandAt = function(frame, charId, routeCmd, placementContext) {
        if (!this.needSelTrack()) return null;
        charId = this.normalizeMoveTarget(charId);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var placement = this.resolveAddPlacementContext(
            placementContext || this.makeAddPlacementContextFromFrame(frame),
            frame
        );
        var tr = this.ensureTrack(this.selEid, this.selPage);
        var inRange = null;
        if (String(placement.source || '') === 'routeCmd' && Number(placement.uid || 0) > 0) {
            var anchorEntry = this.findEntryInSelectedTrack(Number(placement.uid || 0));
            if (anchorEntry && anchorEntry.command && Number(anchorEntry.command.code || 0) === 205 &&
                Number(this.normalizeMoveTarget(anchorEntry.charId)) === Number(charId)) {
                inRange = anchorEntry;
            }
        }
        if (!inRange) inRange = this.findCharRouteEntryAtFrame(tr, charId, frame);
        if (!inRange) inRange = this.findCharRouteEntryAtTimelineFrame(tr, charId, frame);
        if (!inRange) {
            if (this.isIntervalLockedByMoveRouteWait(tr, frame, frame, 0)) {
                this.err('E_ROUTE_WAIT_LOCK', new Error('move-route wait lock on main'));
                return null;
            }
            var routeEntry = this.entryFromCommand({
                code: 205,
                indent: 0,
                parameters: [charId, { repeat: false, skippable: false, wait: false, list: [clone(routeCmd), { code: 0, parameters: [] }] }]
            }, this.selEid, this.selPage, frame, this.model.nextUid++);
            if (!routeEntry) return null;
            if (!this.applyCommandAddWithPlacement(tr, routeEntry, placement, { skipSnapshot: false })) return null;
            return { uid: routeEntry.uid, routeListIndex: 0 };
        }
        this.pushSnap('addRouteCmd');
        var oldCmd = clone(inRange.command);
        var oldWait = Number(inRange.wait || 0);
        var insertedIdx = -1;
        if (
            String(placement.source || '') === 'routeCmd' &&
            Number(placement.uid || 0) === Number(inRange.uid || 0) &&
            this.nodeRouteIndex(placement.routeListIndex) >= 0 &&
            (String(placement.mode || '') === 'before' || String(placement.mode || '') === 'after')
        ) {
            var route = inRange.command.parameters && inRange.command.parameters[1];
            route = this.ensureMoveRouteTerminal(route);
            inRange.command.parameters[1] = route;
            var list = route.list;
            var anchorIdx = this.nodeRouteIndex(placement.routeListIndex);
            if (anchorIdx >= 0 && anchorIdx < list.length && Number((list[anchorIdx] || {}).code || 0) !== 0) {
                var insIdx = anchorIdx + (String(placement.mode || '') === 'after' ? 1 : 0);
                var terminalIdx = this.moveRouteTerminalIndex(route);
                if (insIdx < 0) insIdx = 0;
                if (insIdx > terminalIdx) insIdx = terminalIdx;
                list.splice(insIdx, 0, clone(routeCmd));
                insertedIdx = insIdx;
            }
        }
        if (insertedIdx < 0) insertedIdx = this.insertRouteCommandIntoEntry(inRange, routeCmd, frame);
        inRange.wait = this.commandWaitFrames(inRange.command);
        if (!this.canPlaceEntry(tr, inRange, inRange.frame, inRange.rowKey, inRange.uid)) {
            inRange.command = oldCmd;
            inRange.wait = oldWait;
            this.err('E_ROUTE_COLLISION', new Error('move-route range overlaps after adding command'));
            return null;
        }
        this.confirmCharRowPermanent(charId);
        this.selUid = inRange.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(frame, this.routeCommandSpanFrames(routeCmd));
        this.commitTrackMutation({ earliestChangedFrame: frame });
        this.playFrom(this.frame);
        return { uid: inRange.uid, routeListIndex: Math.max(0, Math.floor(Number(insertedIdx == null ? -1 : insertedIdx))) };
    };

    EE.prototype.openRouteCommandPanel = function(frame, rowKey, placementContext) {
        if (!this.routeModal || !this.needSelTrack()) return;
        this.closeRouteRangeContextMenu();
        rowKey = String(rowKey || '');
        if (rowKey.indexOf('char:') !== 0) return;
        var cid = this.normalizeMoveTarget(Number(rowKey.replace('char:', '')));
        if (isNaN(cid)) return;
        this.routeAddFrame = Math.max(0, Math.floor(Number(frame || 0)));
        this.routeAddCharId = cid;
        this.routeAddPlacementContext = this.resolveAddPlacementContext(
            placementContext || this.makeAddPlacementContextFromFrame(this.routeAddFrame),
            this.routeAddFrame
        );
        var cat = this.routeCommandCatalog();
        this.renderRouteCommandColumn(this.routeColL, cat.left);
        this.renderRouteCommandColumn(this.routeColM, cat.mid);
        this.renderRouteCommandColumn(this.routeColR, cat.right);
        this.renderRouteCommandColumn(this.routeColX, cat.ext, { ext: true });
        if (this.modal && this.modal.classList.contains('on')) this.closeEditor();
        if (this.addModal && this.addModal.classList.contains('on')) this.closeAddCommandPanel();
        this.routeModal.classList.add('on');
    };

    EE.prototype.closeRouteCommandPanel = function() {
        if (!this.routeModal) return;
        this.routeAddPlacementContext = null;
        this.routeModal.classList.remove('on');
    };

    EE.prototype.emptyAudioParam = function() {
        return { name: '', volume: 90, pitch: 100, pan: 0 };
    };

    EE.prototype.makeDefaultCommandByCode = function(code, rowKey) {
        code = Math.floor(Number(code || 0));
        var cmd = { code: code, indent: 0, parameters: [] };
        switch (code) {
        case 101: cmd.parameters = ['', 0, 0, 2]; break;
        case 102: cmd.parameters = [['選択肢1'], -2, 0, 2, 0]; break;
        case 103: cmd.parameters = [1, 1]; break;
        case 104: cmd.parameters = [1, 2]; break;
        case 105: cmd.parameters = [2, false]; break;
        case 108: cmd.parameters = ['']; break;
        case 111: cmd.parameters = [0, 1, 0]; break;
        case 112: cmd.parameters = []; break;
        case 113: cmd.parameters = []; break;
        case 115: cmd.parameters = []; break;
        case 117: cmd.parameters = [1]; break;
        case 118: cmd.parameters = ['A']; break;
        case 119: cmd.parameters = ['A']; break;
        case 121: cmd.parameters = [1, 1, 0]; break;
        case 122: cmd.parameters = [1, 1, 0, 0, 0]; break;
        case 123: cmd.parameters = ['A', 0]; break;
        case 124: cmd.parameters = [0, 60]; break;
        case 125: cmd.parameters = [0, 0, 0]; break;
        case 126: cmd.parameters = [1, 0, 0, 1]; break;
        case 127: cmd.parameters = [1, 0, 0, 1, false]; break;
        case 128: cmd.parameters = [1, 0, 0, 1, false]; break;
        case 129: cmd.parameters = [1, 0, true]; break;
        case 132: cmd.parameters = [this.emptyAudioParam()]; break;
        case 133: cmd.parameters = [this.emptyAudioParam()]; break;
        case 134: cmd.parameters = [0]; break;
        case 135: cmd.parameters = [0]; break;
        case 136: cmd.parameters = [0]; break;
        case 137: cmd.parameters = [0]; break;
        case 138: cmd.parameters = [[0, 0, 0, 0]]; break;
        case 139: cmd.parameters = [this.emptyAudioParam()]; break;
        case 140: cmd.parameters = [0, this.emptyAudioParam()]; break;
        case 201: cmd.parameters = [0, 1, 0, 0, 2, 0]; break;
        case 202: cmd.parameters = [0, 0, 1, 0, 0]; break;
        case 203: cmd.parameters = [0, 0, 0, 0, 2]; break;
        case 204: cmd.parameters = [2, 1, 4]; break;
        case 205: {
            var cid = 0;
            if (String(rowKey || '').indexOf('char:') === 0) {
                var c = Number(String(rowKey).replace('char:', ''));
                if (!isNaN(c)) cid = this.normalizeMoveTarget(c);
            }
            cmd.parameters = [cid, { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] }];
            break;
        }
        case 206: cmd.parameters = []; break;
        case 211: cmd.parameters = [0]; break;
        case 212:
            cmd.code = 355;
            cmd.parameters = [this.makeCharacterRequestAnimationScript(0, 1, 0, 0, 1)];
            break;
        case 213: cmd.parameters = [0, 1, false]; break;
        case 214: cmd.parameters = []; break;
        case 216: cmd.parameters = [0]; break;
        case 217: cmd.parameters = []; break;
        case 221: cmd.parameters = []; break;
        case 222: cmd.parameters = []; break;
        case 223: cmd.parameters = [[0, 0, 0, 0], 60, true]; break;
        case 224: cmd.parameters = [[255, 255, 255, 255], 60, true]; break;
        case 225: cmd.parameters = [5, 5, 60, true]; break;
        case 230: cmd.parameters = [60]; break;
        case 231: cmd.parameters = [1, '', 0, 0, 0, 100, 100, 255, 0]; break;
        case 232: cmd.parameters = [1, 0, 0, 0, 0, 0, 100, 100, 255, 0, 60, true]; break;
        case 233: cmd.parameters = [1, 5]; break;
        case 234: cmd.parameters = [1, [0, 0, 0, 0], 60, true]; break;
        case 235: cmd.parameters = [1]; break;
        case 236: cmd.parameters = [0, 0, 60, true]; break;
        case 241: cmd.parameters = [this.emptyAudioParam()]; break;
        case 242: cmd.parameters = [10]; break;
        case 243: cmd.parameters = []; break;
        case 244: cmd.parameters = []; break;
        case 245: cmd.parameters = [this.emptyAudioParam()]; break;
        case 246: cmd.parameters = [10]; break;
        case 249: cmd.parameters = [this.emptyAudioParam()]; break;
        case 250: cmd.parameters = [this.emptyAudioParam()]; break;
        case 251: cmd.parameters = []; break;
        case 261: cmd.parameters = ['']; break;
        case 281: cmd.parameters = [0]; break;
        case 282: cmd.parameters = [1]; break;
        case 283: cmd.parameters = [0, '', '']; break;
        case 284: cmd.parameters = ['', false, false, 0, 0]; break;
        case 285: cmd.parameters = [1, 0, 0, 0, 0]; break;
        case 301: cmd.parameters = [0, 0, false, false]; break;
        case 302: cmd.parameters = [0, 1, 0, 0]; break;
        case 303: cmd.parameters = [1, 8]; break;
        case 311: cmd.parameters = [0, 1, 0, 0, 10, true]; break;
        case 312: cmd.parameters = [0, 1, 0, 0, 10]; break;
        case 313: cmd.parameters = [0, 1, 0, 1]; break;
        case 314: cmd.parameters = [0, 1]; break;
        case 315: cmd.parameters = [0, 1, 0, 0, 10, true]; break;
        case 316: cmd.parameters = [0, 1, 0, 0, 1, true]; break;
        case 317: cmd.parameters = [0, 1, 0, 0, 1]; break;
        case 318: cmd.parameters = [0, 1, 0, 1]; break;
        case 319: cmd.parameters = [1, 1, 0]; break;
        case 320: cmd.parameters = [1, '']; break;
        case 321: cmd.parameters = [1, 1, true]; break;
        case 322: cmd.parameters = [1, '', 0, '', 0]; break;
        case 323: cmd.parameters = [0, '', 0]; break;
        case 324: cmd.parameters = [1, '']; break;
        case 325: cmd.parameters = [1, '']; break;
        case 326: cmd.parameters = [0, 1, 0, 0, 10]; break;
        case 331: cmd.parameters = [0, 0, 0, 0, 10]; break;
        case 332: cmd.parameters = [0, 0, 0, 0, 10]; break;
        case 333: cmd.parameters = [0, 0, 1]; break;
        case 334: cmd.parameters = [0, 0]; break;
        case 335: cmd.parameters = [0]; break;
        case 336: cmd.parameters = [0, 1]; break;
        case 337: cmd.parameters = [0, 1, false]; break;
        case 339: cmd.parameters = [0, 0, 0]; break;
        case 340: cmd.parameters = []; break;
        case 351: cmd.parameters = []; break;
        case 352: cmd.parameters = []; break;
        case 353: cmd.parameters = []; break;
        case 354: cmd.parameters = []; break;
        case 355: cmd.parameters = ['']; break;
        case 35550:
            cmd.code = 355;
            cmd.parameters = [this.makeCameraMoveScript('scroll', 0, 0, 60)];
            break;
        case 35551:
            cmd.code = 355;
            cmd.parameters = [this.makeCameraMoveScript('scrollTo', 0, 0, 60)];
            break;
        case 35552: {
            var targetId = null;
            if (typeof this.currentSelectedCharacterId === 'function') targetId = this.currentSelectedCharacterId();
            if (targetId == null && Number(this.selEid || 0) > 0) targetId = Number(this.selEid || 0);
            targetId = this.normalizeMoveTarget(Number(targetId == null ? 0 : targetId));
            cmd.code = 355;
            if (typeof this.makeCharacterTeleportScript === 'function') {
                cmd.parameters = [this.makeCharacterTeleportScript(targetId, 0, 0)];
            } else {
                cmd.parameters = [String(targetId === -1
                    ? ('$gamePlayer.locateTo(0, 0)')
                    : ('this.character(' + String(targetId) + ').locateTo(0, 0)'))];
            }
            break;
        }
        case 35553:
            cmd.code = 355;
            cmd.parameters = ['$gameMap.autoplay();'];
            break;
        case 35554:
            cmd.code = 355;
            // NOTE: Name and runtime call are intentionally inverted by design.
            cmd.parameters = ['$gameScreen.startFadeOutZXC(60, 1);'];
            break;
        case 35555:
            cmd.code = 355;
            // NOTE: Name and runtime call are intentionally inverted by design.
            cmd.parameters = ['$gameScreen.startFadeInZXC(60, 1);'];
            break;
        case 35556:
            cmd.code = 355;
            cmd.parameters = ['this.command_showSpriteSheetPicture(1, "", 1, 1, 0, 0, 0, 100, 100, 255, 0);'];
            break;
        case 35557:
            cmd.code = 355;
            cmd.parameters = ['this.command_playSpriteSheetPicture(1, "[0,1,2,3]", 6, true);'];
            break;
        case 35558:
            cmd.code = 355;
            cmd.parameters = ['this.command_stopSpriteSheetPicture(1);'];
            break;
        case 356: cmd.parameters = ['']; break;
        default:
            cmd.parameters = [];
            break;
        }
        return cmd;
    };

    EE.prototype.applyPlacementIndentToEntry = function(entry, placement) {
        if (!entry || !entry.command || !placement || typeof placement !== 'object') return;
        var indent = placement.branchInsertIndent;
        if (indent == null) return;
        indent = Math.floor(Number(indent));
        if (!isFinite(indent)) return;
        entry.command.indent = Math.max(0, indent);
    };

    EE.prototype.applyCommandAddWithPlacement = function(tr, entry, placement, options) {
        if (!tr || !entry) return false;
        options = options || {};
        placement = this.resolveAddPlacementContext(placement, entry.frame);
        this.applyPlacementIndentToEntry(entry, placement);
        var targetFrame = this.computeAddFrameFromPlacementContext(placement, entry.wait);
        if (placement.mode === 'frame' && this.isFrameLockedForFrameCommandAdd(targetFrame)) {
            this.msg('コマンド追加不可: ウェイト実行中フレームです');
            return false;
        }
        var waitFrames = Math.max(0, Math.floor(Number(entry.wait || 0)));
        if (!options.skipSnapshot) this.pushSnap('addCmd');

        var anchorUid = 0;
        if ((placement.source === 'command' || placement.source === 'routeCmd') && Number(placement.uid || 0) > 0) {
            anchorUid = Math.floor(Number(placement.uid || 0));
        }
        var sameFrameOrdered = tr.commands.filter(function(ce) {
            return ce && Math.max(0, Math.floor(Number(ce.frame || 0))) === targetFrame;
        }).sort(compareEntriesByFrameWaitUid);
        var anchorIdx = -1;
        if (anchorUid > 0) {
            for (var ai = 0; ai < sameFrameOrdered.length; ai++) {
                if (Number(sameFrameOrdered[ai].uid || 0) === anchorUid) { anchorIdx = ai; break; }
            }
        }

        if (waitFrames > 0) {
            var scopedShiftMap = null;
            if (placement.branchShiftUidMap && typeof placement.branchShiftUidMap === 'object' && !Array.isArray(placement.branchShiftUidMap)) {
                scopedShiftMap = placement.branchShiftUidMap;
            }
            if (scopedShiftMap) {
                var minShiftFrame = Infinity;
                for (var si = 0; si < tr.commands.length; si++) {
                    var se = tr.commands[si];
                    if (!se) continue;
                    var su = Math.floor(Number(se.uid || 0));
                    if (su <= 0 || !scopedShiftMap[String(su)]) continue;
                    var sf = Math.max(0, Math.floor(Number(se.frame || 0)));
                    if (sf < minShiftFrame) minShiftFrame = sf;
                    se.frame = sf + waitFrames;
                }
                if (isFinite(minShiftFrame)) {
                    if (Math.max(0, Math.floor(Number(this.frame || 0))) >= minShiftFrame) this.frame += waitFrames;
                    this.shiftRangeSelectionAfterWaitInsert(minShiftFrame, waitFrames);
                }
            } else {
                var keepMap = Object.create(null);
                if (anchorIdx >= 0 && (placement.mode === 'before' || placement.mode === 'after')) {
                    var keepCount = (placement.mode === 'before') ? anchorIdx : (anchorIdx + 1);
                    for (var ki = 0; ki < keepCount && ki < sameFrameOrdered.length; ki++) {
                        keepMap[Math.floor(Number(sameFrameOrdered[ki].uid || 0))] = true;
                    }
                }
                for (si = 0; si < tr.commands.length; si++) {
                    se = tr.commands[si];
                    if (!se) continue;
                    sf = Math.max(0, Math.floor(Number(se.frame || 0)));
                    su = Math.floor(Number(se.uid || 0));
                    var shift = false;
                    if (sf > targetFrame) shift = true;
                    else if (sf === targetFrame && !keepMap[su]) shift = true;
                    if (shift) se.frame = sf + waitFrames;
                }
                if (Math.max(0, Math.floor(Number(this.frame || 0))) >= targetFrame) this.frame += waitFrames;
                this.shiftRangeSelectionAfterWaitInsert(targetFrame, waitFrames);
            }
        }

        entry.frame = targetFrame;
        if (waitFrames <= 0) {
            if (placement.mode === 'before') {
                if (anchorIdx >= 0 && anchorUid > 0) entry.uid = this.reserveUidBeforeAnchor(tr, anchorUid);
                else {
                    var firstUid = this.minCommandUidAtFrame(tr, targetFrame);
                    if (firstUid > 0) entry.uid = this.reserveUidBeforeAnchor(tr, firstUid);
                }
            } else if (placement.mode === 'after') {
                if (anchorIdx >= 0 && anchorUid > 0) {
                    var succ = (anchorIdx + 1 < sameFrameOrdered.length) ? sameFrameOrdered[anchorIdx + 1] : null;
                    if (succ) {
                        var succUid = Math.floor(Number(succ.uid || 0));
                        if (succUid > anchorUid) entry.uid = this.reserveUidBetween(tr, anchorUid, succUid);
                        else entry.uid = this.reserveUidBeforeAnchor(tr, succUid);
                    }
                }
            } else if (placement.mode === 'frame') {
                var anchor = this.minCommandUidAtFrame(tr, targetFrame);
                if (anchor > 0) entry.uid = this.reserveUidBeforeAnchor(tr, anchor);
            }
        }

        tr.commands.push(entry);
        SH.sortTrackCommands(tr);
        if (entry.rowType === 'char') this.confirmCharRowPermanent(entry.charId);
        this.selUid = entry.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(entry.frame, entry.wait);
        this.commitTrackMutation({ earliestChangedFrame: entry.frame });
        this.playFrom(this.frame);
        return true;
    };

    EE.prototype.finalizePendingAddEntry = function(tr, entry) {
        if (!tr || !entry) return false;
        var removed = this.removeTrackEntryByUid(entry.uid);
        var placement = this.resolveAddPlacementContext(
            entry._pendingAddPlacement || this.addPlacementContext || this.makeAddPlacementContextFromFrame(entry.frame),
            entry.frame
        );
        var ok = this.applyCommandAddWithPlacement(tr, entry, placement, { skipSnapshot: false });
        if (!ok) {
            if (removed) {
                tr.commands.push(entry);
                SH.sortTrackCommands(tr);
            }
            return false;
        }
        if (entry.command && Number(entry.command.code || 0) === COMMAND_CODE.SHOW_CHOICES &&
            typeof this.synchronizeChoiceBranchStructure === 'function') {
            this.synchronizeChoiceBranchStructure(tr, entry);
        }
        entry._pendingAddPlacement = null;
        this._pendingNewConfirmed = true;
        return true;
    };

    EE.prototype.minCommandUidAtFrame = function(tr, frame) {
        if (!tr || !Array.isArray(tr.commands)) return 0;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var minUid = 0;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (Math.max(0, Math.floor(Number(e.frame || 0))) !== frame) continue;
            var uid = Math.floor(Number(e.uid || 0));
            if (uid <= 0) continue;
            if (minUid <= 0 || uid < minUid) minUid = uid;
        }
        return minUid;
    };

    EE.prototype.shiftRangeSelectionUidAfter = function(fromUid, delta) {
        if (!this.rangeSelection || !Array.isArray(this.rangeSelection.items)) return;
        var items = this.rangeSelection.items;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || Number(it.uid || 0) < fromUid) continue;
            it.uid = Math.floor(Number(it.uid || 0)) + delta;
        }
        var map = Object.create(null);
        for (i = 0; i < items.length; i++) map[this.rangeSelectionItemKey(items[i])] = true;
        this.rangeSelection.itemMap = map;
    };

    EE.prototype.shiftCommandUidsFrom = function(tr, fromUid, delta) {
        if (!tr || !Array.isArray(tr.commands)) return;
        fromUid = Math.max(1, Math.floor(Number(fromUid || 1)));
        delta = Math.floor(Number(delta || 0));
        if (!delta) return;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var uid = Math.floor(Number(e.uid || 0));
            if (uid >= fromUid) e.uid = uid + delta;
        }
        if (Math.floor(Number(this.selUid || 0)) >= fromUid) this.selUid = Math.floor(Number(this.selUid || 0)) + delta;
        if (Math.floor(Number(this.hoverUid || 0)) >= fromUid) this.hoverUid = Math.floor(Number(this.hoverUid || 0)) + delta;
        if (Math.floor(Number(this.routeRangeCtxUid || 0)) >= fromUid) this.routeRangeCtxUid = Math.floor(Number(this.routeRangeCtxUid || 0)) + delta;
        if (Math.floor(Number(this._pendingNewUid || 0)) >= fromUid) this._pendingNewUid = Math.floor(Number(this._pendingNewUid || 0)) + delta;
        if (Math.floor(Number(this.editUid || 0)) >= fromUid) this.editUid = Math.floor(Number(this.editUid || 0)) + delta;
        if (this.timelineSelectionAnchor && String(this.timelineSelectionAnchor.trackKey || '') === String(this.selKey || '') &&
            Math.floor(Number(this.timelineSelectionAnchor.uid || 0)) >= fromUid) {
            this.timelineSelectionAnchor.uid = Math.floor(Number(this.timelineSelectionAnchor.uid || 0)) + delta;
        }
        this.shiftRangeSelectionUidAfter(fromUid, delta);
        var maxUid = 0;
        for (i = 0; i < tr.commands.length; i++) {
            var u = Math.floor(Number(tr.commands[i] && tr.commands[i].uid || 0));
            if (u > maxUid) maxUid = u;
        }
        this.model.nextUid = Math.max(Math.floor(Number(this.model.nextUid || 1)), maxUid + 1);
    };

    EE.prototype.remapCommandUidReferences = function(uidMap) {
        if (!uidMap || typeof uidMap !== 'object') return;
        function remap(v) {
            var key = String(Math.floor(Number(v || 0)));
            if (Object.prototype.hasOwnProperty.call(uidMap, key)) return Math.floor(Number(uidMap[key] || 0));
            return Math.floor(Number(v || 0));
        }
        this.selUid = remap(this.selUid);
        this.hoverUid = remap(this.hoverUid);
        this.routeRangeCtxUid = remap(this.routeRangeCtxUid);
        this._pendingNewUid = remap(this._pendingNewUid);
        this.editUid = remap(this.editUid);
        if (this.timelineSelectionAnchor && String(this.timelineSelectionAnchor.trackKey || '') === String(this.selKey || '')) {
            this.timelineSelectionAnchor.uid = remap(this.timelineSelectionAnchor.uid);
        }
        if (this.routeCtxWaitInsertContext && typeof this.routeCtxWaitInsertContext === 'object') {
            this.routeCtxWaitInsertContext.uid = remap(this.routeCtxWaitInsertContext.uid);
        }
        if (this.waitInsertDialogContext && typeof this.waitInsertDialogContext === 'object') {
            this.waitInsertDialogContext.uid = remap(this.waitInsertDialogContext.uid);
        }
        if (this.rangeSelection && Array.isArray(this.rangeSelection.items)) {
            for (var i = 0; i < this.rangeSelection.items.length; i++) {
                var it = this.rangeSelection.items[i];
                if (!it || it.uid == null) continue;
                it.uid = remap(it.uid);
            }
            var map = Object.create(null);
            for (i = 0; i < this.rangeSelection.items.length; i++) {
                map[this.rangeSelectionItemKey(this.rangeSelection.items[i])] = true;
            }
            this.rangeSelection.itemMap = map;
        }
    };

    EE.prototype.swapCommandUids = function(tr, a, b) {
        if (!tr || !a || !b) return;
        var au = Math.floor(Number(a.uid || 0));
        var bu = Math.floor(Number(b.uid || 0));
        if (au <= 0 || bu <= 0 || au === bu) return;
        a.uid = bu;
        b.uid = au;
        var map = Object.create(null);
        map[String(au)] = bu;
        map[String(bu)] = au;
        this.remapCommandUidReferences(map);
    };

    EE.prototype.reserveUidBeforeAnchor = function(tr, anchorUid) {
        if (!tr || !Array.isArray(tr.commands)) return Math.max(1, Math.floor(Number(anchorUid || 1)));
        anchorUid = Math.max(1, Math.floor(Number(anchorUid || 1)));
        var used = Object.create(null);
        for (var i = 0; i < tr.commands.length; i++) {
            var uid = Math.floor(Number(tr.commands[i] && tr.commands[i].uid || 0));
            if (uid > 0) used[uid] = true;
        }
        for (var cand = anchorUid - 1; cand >= 1; cand--) {
            if (!used[cand]) return cand;
        }
        this.shiftCommandUidsFrom(tr, anchorUid, 1);
        return anchorUid;
    };

    EE.prototype.reserveUidBetween = function(tr, lowExclusive, highExclusive) {
        if (!tr || !Array.isArray(tr.commands)) return Math.max(1, Math.floor(Number(highExclusive || 1)));
        lowExclusive = Math.max(0, Math.floor(Number(lowExclusive || 0)));
        highExclusive = Math.max(lowExclusive + 1, Math.floor(Number(highExclusive || (lowExclusive + 1))));
        var used = Object.create(null);
        for (var i = 0; i < tr.commands.length; i++) {
            var uid = Math.floor(Number(tr.commands[i] && tr.commands[i].uid || 0));
            if (uid > 0) used[uid] = true;
        }
        for (var cand = highExclusive - 1; cand > lowExclusive; cand--) {
            if (!used[cand]) return cand;
        }
        this.shiftCommandUidsFrom(tr, highExclusive, 1);
        return highExclusive;
    };

    EE.prototype.beginAddCommandByCode = function(code, label, placementOverride) {
        if (!this.needSelTrack()) return;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        var f = Math.max(0, Math.floor(Number(this.addFrame || this.frame || 0)));
        var placement = this.resolveAddPlacementContext(
            placementOverride || this.addPlacementContext || this.makeAddPlacementContextFromFrame(f),
            f
        );
        if (placement.mode === 'frame' && this.isFrameLockedForFrameCommandAdd(this.computeAddFrameFromPlacementContext(placement, 0))) {
            this.msg('コマンド追加不可: ウェイト実行中フレームです');
            return;
        }
        var cmd = this.makeDefaultCommandByCode(code, this.addRowKey);
        var e = this.entryFromCommand(clone(cmd), this.selEid, this.selPage, f, this.model.nextUid++);
        if (!e) return;
        this.applyPlacementIndentToEntry(e, placement);
        var needsEditor = this.eventCommandNeedsEditorOnAdd(Number(code || 0), cmd);
        if (!needsEditor) {
            this.applyCommandAddWithPlacement(tr, e, placement, { skipSnapshot: false });
            return;
        }
        e._pendingAddPlacement = clone(placement);
        e.frame = this.computeAddFrameFromPlacementContext(placement, e.wait);
        tr.commands.push(e);
        SH.sortTrackCommands(tr);
        this.selUid = e.uid;
        this.selRouteListIndex = -1;
        this.frame = e.frame;
        this._pendingNewUid = e.uid;
        this._pendingNewConfirmed = false;
        this.openEditor(e.uid);
        if (this.edHead && label) this.edHead.textContent = String(label).replace(/\.\.\.$/, '');
        if (this.edDeleteBtn) this.edDeleteBtn.style.display = 'none';
        this.timelineDirty = true;
    };
    SH.registerModule('core', ['shared']);
})();

