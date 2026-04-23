//=============================================================================
// KNH_ZXC_EventEditor_Timeline.js
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.2
 * @author kagaya
 * @help
 * KNH_ZXC_EventEditor.js の後に読み込んでください。
 */


(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;

    var U = NS._eeUtils || {};
    var clone = U.clone || function(v) { return JSON.parse(JSON.stringify(v)); };
    var maximizeWindowForEditor = U.maximizeWindowForEditor || function() { return false; };
    var installEscapeConvertFallback = U.installEscapeConvertFallback || function() {};
    var RE_COMPACT_SELECT_KEY = U.RE_COMPACT_SELECT_KEY || /type|mode|op|operand|scope|target|operation|blend|dir|designate/i;
    var RE_COMPACT_NUMBER_KEY = U.RE_COMPACT_NUMBER_KEY || /id$|index|mode|type|value|x$|y$|z$|r$|g$|b$|a$|wait|time|frame|duration|speed|pan|pitch|volume|opacity/i;
    var RE_COMPACT_TEXT_KEY = U.RE_COMPACT_TEXT_KEY || /id$|tag|code|label|name/i;
    function compareEntriesByFrameWaitUid(a, b) {
        var af = Math.max(0, Math.floor(Number(a && a.frame || 0)));
        var bf = Math.max(0, Math.floor(Number(b && b.frame || 0)));
        if (af !== bf) return af - bf;
        var aw = Math.max(0, Math.floor(Number(a && a.wait || 0))) > 0 ? 1 : 0;
        var bw = Math.max(0, Math.floor(Number(b && b.wait || 0))) > 0 ? 1 : 0;
        if (aw !== bw) return aw - bw;
        return Math.floor(Number(a && a.uid || 0)) - Math.floor(Number(b && b.uid || 0));
    }

    function EE_AnimationPreviewCharacter() {
        this.initialize.apply(this, arguments);
    }
    EE_AnimationPreviewCharacter.prototype = Object.create(Game_CharacterBase.prototype);
    EE_AnimationPreviewCharacter.prototype.constructor = EE_AnimationPreviewCharacter;
    EE_AnimationPreviewCharacter.prototype.initialize = function() {
        Game_CharacterBase.prototype.initMembers.call(this);
    };
    EE_AnimationPreviewCharacter.prototype.syncFrom = function(src) {
        if (!src) return;
        var keys = [
            '_x', '_y', '_realX', '_realY',
            '_moveSpeed', '_moveFrequency',
            '_opacity', '_blendMode', '_bushDepth', '_priorityType',
            '_direction', '_pattern', '_animationCount', '_stopCount',
            '_tileId', '_characterName', '_characterIndex', '_isObjectCharacter',
            '_walkAnime', '_stepAnime', '_directionFix', '_through', '_transparent',
            '_jumpCount', '_jumpPeak', '_moving',
            '_moveRouteForcing', '_movementSuccess',
            '_balloonId', '_balloonPlaying',
            '_animationId', '_animationPlaying'
        ];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (Object.prototype.hasOwnProperty.call(src, k)) this[k] = src[k];
        }
    };

    if (!NS._eeAnimPreviewPositionPatchApplied && typeof Sprite_Animation !== 'undefined') {
        NS._eeAnimPreviewPositionPatchApplied = true;
        var _EE_SpriteAnimation_updatePosition_Preview = Sprite_Animation.prototype.updatePosition;
        Sprite_Animation.prototype.updatePosition = function() {
            _EE_SpriteAnimation_updatePosition_Preview.apply(this, arguments);
            var pv = this._eePreviewViewport;
            if (!pv || !this._animation) return;
            if (Number(this._animation.position || 0) === 3) {
                this.x = Math.floor(Number(pv.w || 0) / 2);
                this.y = Math.floor(Number(pv.h || 0) / 2);
            }
        };
    }

    // -------------------------------------------------------------------------
    // v0.2 Timeline rewrite (row-based timeline + drag/drop + editor modal)
    // -------------------------------------------------------------------------
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
        this.hitNodes = [];
        this.hitComments = [];
        this.hitBars = [];
        this.hitOrderButtons = [];
        this.orderButtonAnchorEntry = null;
        this.orderButtonAnchorY = 0;
        this.suppressTimelineDblClickUntil = 0;
        this.dragState = null;
        this.timelineWrap = null;
        this.timelinePanel = null;
        this.zoomInfo = null;
        this.tip = null;
        this.modal = null;
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
        this.editorDisplayX = null;
        this.editorDisplayY = null;
        this.editorBaseDisplayX = null;
        this.editorBaseDisplayY = null;
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
        this.cameraCtx = null;
        this.cameraCtxScrollBtn = null;
        this.cameraCtxScrollToBtn = null;
        this.cameraCtxMapX = 0;
        this.cameraCtxMapY = 0;
        this.routeAddFrame = 0;
        this.routeAddCharId = 0;
        this.routeAddPlacementContext = null;
        this.routeRangeCtxUid = 0;
        this.routeCtxMode = 'route';
        this.routeCtxSqueezeEnabled = false;
        this.routeCtxMergeEnabled = false;
        this.routeCtxWaitInsertContext = null;
        this.routeCtxAddBtn = null;
        this.routeCtxAddBeforeBtn = null;
        this.routeCtxAddAfterBtn = null;
        this.routeCtxMemoBtn = null;
        this.routeCtxCopyBtn = null;
        this.routeCtxCutBtn = null;
        this.routeCtxPasteBtn = null;
        this.routeCtxMergeBtn = null;
        this.timelineCommandClipboard = null;
        this.addPlacementContext = null;
        this.waitInsertModal = null;
        this.waitInsertDialogContext = null;
        this.waitInsertPosBefore = null;
        this.waitInsertPosAfter = null;
        this.waitInsertFrameInput = null;
        this.waitInsertInfo = null;
        this.memoModal = null;
        this.memoEditMode = 'new';
        this.memoEditUid = 0;
        this.memoEditFrame = 0;
        this.memoEditSize = 'M';
        this.memoHead = null;
        this.memoSizeSelect = null;
        this.memoTextInput = null;
        this.memoDeleteBtn = null;
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
        this.rangeSelectDrag = null;
        this.rangeMoveDrag = null;
        this._charPanelSig = '';
        this._charInfoSig = '';
        this._charOverlaySig = '';
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
        this.tileMoveStartGhost = null;
        this.routeTileEditorPickState = null;
        this.routeJumpEditorPickState = null;
        this.execLogLines = [];
        this.execLogMax = 240;
        this.execLogView = null;
        this._execNodePulses = Object.create(null);
        this._timelineAutoScrollAnim = null;
        this._timelineViewPending = null;
        maximizeWindowForEditor();
        setTimeout(maximizeWindowForEditor, 16);
        setTimeout(maximizeWindowForEditor, 120);
        this.startWindowGuard();
        this.captureBase();
        this.shrink();
        this.buildUi();
        this.bind();
        this.setInteractionMode('timeline', 'start');
        this.selectInitial();
        this.pushSnap('init');
        this.rebuildSchedule();
        this.runInitialVisualRefresh();
        this.msg('EventEditor ON (timeline edit mode)');
    };

    EE.prototype.injectStyle = function() {
        var st = document.getElementById('knh-ee-style');
        if (!st) {
            st = document.createElement('style');
            st.id = 'knh-ee-style';
            document.head.appendChild(st);
        }
        st.textContent = [
            '#knh-ee{position:fixed;left:0;top:0;width:100%;height:100%;z-index:9999;pointer-events:none;font-family:"Yu Gothic UI","Meiryo UI",sans-serif;color:#eef3f6;}',
            '#knh-ee,#knh-ee *{scrollbar-width:thin;scrollbar-color:rgba(96,106,120,.95) rgba(8,12,18,.92);}',
            'html.knh-ee-cursor-move, html.knh-ee-cursor-move *{cursor:move !important;}',
            '#knh-ee::-webkit-scrollbar,#knh-ee *::-webkit-scrollbar{width:12px;height:12px;}',
            '#knh-ee::-webkit-scrollbar-track,#knh-ee *::-webkit-scrollbar-track{background:rgba(8,12,18,.92);}',
            '#knh-ee::-webkit-scrollbar-thumb,#knh-ee *::-webkit-scrollbar-thumb{background:rgba(96,106,120,.95);border:2px solid rgba(8,12,18,.92);border-radius:10px;}',
            '#knh-ee::-webkit-scrollbar-thumb:hover,#knh-ee *::-webkit-scrollbar-thumb:hover{background:rgba(126,138,154,.98);}',
            '#knh-ee::-webkit-scrollbar-corner,#knh-ee *::-webkit-scrollbar-corner{background:rgba(8,12,18,.92);}',
            '#knh-ee .p{position:absolute;z-index:20;background:rgba(10,16,22,.84);border:1px solid rgba(255,255,255,.25);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.36);pointer-events:auto;}',
            '#knh-ee .l{left:8px;top:8px;width:158px;max-height:calc(50% - 16px);padding:10px;overflow:auto;}',
            '#knh-ee .ld{left:178px;top:8px;width:162px;max-height:calc(50% - 16px);padding:10px;overflow:auto;}',
            '#knh-ee .r{right:8px;top:8px;width:340px;height:calc(50% - 16px);padding:10px;overflow:hidden;display:flex;flex-direction:column;}',
            '#knh-ee .t{left:8px;right:8px;top:calc(50% + 40px);bottom:8px;padding:8px 8px 0 8px;display:flex;flex-direction:column;}',
            '#knh-ee .ti{font-size:13px;font-weight:700;margin-bottom:6px;}',
            '#knh-ee .rw{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}',
            '#knh-ee .b{padding:4px 8px;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(34,56,74,.9);color:#f3f4f5;font-size:12px;cursor:pointer;}',
            '#knh-ee .b.good{background:rgba(22,86,38,.94);}',
            '#knh-ee .b.warn{background:rgba(102,40,20,.94);}',
            '#knh-ee .i{font-size:12px;line-height:1.4;white-space:pre-wrap;}',
            '#knh-ee .charlist{display:flex;flex-direction:column;gap:2px;max-height:calc(50vh - 86px);overflow:auto;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.24);padding:4px;}',
            '#knh-ee .charit{display:block;width:100%;box-sizing:border-box;text-align:left;padding:4px 6px;border:1px solid rgba(255,255,255,.18);border-radius:4px;background:rgba(34,56,74,.52);color:#e8f0ff;font-size:12px;line-height:1.2;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '#knh-ee .charit:hover{background:rgba(48,74,96,.68);}',
            '#knh-ee .charit.v{color:#d2ffd8;border-color:rgba(120,230,145,.5);background:rgba(24,78,42,.38);}',
            '#knh-ee .charit.sel{border-color:rgba(80,160,255,.92);box-shadow:0 0 0 1px rgba(145,198,255,.72) inset;background:rgba(38,68,108,.72);}',
            '#knh-ee .charhint{margin-top:6px;font-size:11px;color:rgba(195,210,232,.95);line-height:1.3;white-space:pre-wrap;}',
            '#knh-ee .cinfo{font-size:12px;line-height:1.35;white-space:pre-wrap;color:#dbe8ff;}',
            '#knh-ee .chctx{position:fixed;display:none;z-index:30;min-width:148px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
            '#knh-ee .chctx.on{display:block;}',
            '#knh-ee .chctx button{display:block;width:100%;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
            '#knh-ee .chctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
            '#knh-ee .camctx{position:fixed;display:none;z-index:30;min-width:184px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
            '#knh-ee .camctx.on{display:block;}',
            '#knh-ee .camctx button{display:block;width:100%;margin:0 0 3px 0;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
            '#knh-ee .camctx button:last-child{margin-bottom:0;}',
            '#knh-ee .camctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
            '#knh-ee .rtctx{position:fixed;display:none;z-index:31;min-width:200px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
            '#knh-ee .rtctx.on{display:block;}',
            '#knh-ee .rtctx button{display:block;width:100%;margin:0 0 3px 0;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
            '#knh-ee .rtctx button:last-child{margin-bottom:0;}',
            '#knh-ee .rtctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
            '#knh-ee .gbm{position:fixed;left:0;right:0;bottom:0;top:50%;background:rgba(2,6,10,.96);pointer-events:none;z-index:0;}',
            '#knh-ee .ovl{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:3;}',
            '#knh-ee .ovit{position:fixed;box-sizing:border-box;border:1px solid rgba(236,188,120,.45);background:rgba(205,150,90,.10);pointer-events:auto;cursor:pointer;}',
            '#knh-ee .ovit.sel{border:2px solid rgba(255,175,90,.96);background:rgba(255,140,60,.14);box-shadow:0 0 0 1px rgba(255,205,145,.75) inset;}',
            '#knh-ee .ovnm{position:absolute;left:0;top:-13px;display:block;max-width:100%;padding:1px 4px;box-sizing:border-box;border-radius:3px;background:rgba(8,14,22,.8);border:1px solid rgba(236,194,140,.46);color:#e3efff;font-size:8px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer;}',
            '#knh-ee .ovit.sel .ovnm{border-color:rgba(255,188,120,.78);color:#fff5ea;}',
            '#knh-ee .ovl.tilemode .ovit,#knh-ee .ovl.tilemode .ovnm{pointer-events:none !important;cursor:default !important;}',
            '#knh-ee .tmg{position:fixed;display:none;pointer-events:none;z-index:4;opacity:.48;image-rendering:pixelated;filter:saturate(.75) brightness(1.08);}',
            '#knh-ee .tmk{position:fixed;display:none;pointer-events:none;z-index:4;box-sizing:border-box;border:2px dashed rgba(255,216,125,.98);background:rgba(255,185,72,.20);box-shadow:0 0 0 1px rgba(255,243,196,.66) inset;}',
            '#knh-ee .tmkl{position:absolute;left:0;top:-18px;padding:2px 5px;border-radius:4px;background:rgba(8,14,22,.88);border:1px solid rgba(255,216,125,.82);color:#fff8e3;font-size:11px;line-height:1;white-space:nowrap;}',
            '#knh-ee .tmk.start{z-index:5;border-width:2px;border-style:dotted;border-color:rgba(168,206,238,.92);background:rgba(124,168,206,.14);box-shadow:0 0 0 1px rgba(218,236,255,.62) inset;opacity:.86;}',
            '#knh-ee .tmk.start .tmkl{border-color:rgba(168,206,238,.88);color:#edf6ff;background:rgba(10,16,24,.72);}',
            '#knh-ee .tv{position:relative;flex:1 1 auto;min-height:0;height:auto;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.38);overflow:auto;}',
            '#knh-ee .mmlane{position:fixed;display:none;z-index:24;pointer-events:none;}',
            '#knh-ee .mmdot{position:absolute;width:8px;height:8px;border-radius:999px;transform:translate(-50%,-50%);background:rgba(80,220,110,.98);border:1px solid rgba(16,54,20,.98);box-shadow:0 0 0 1px rgba(0,0,0,.45);pointer-events:auto;cursor:pointer;}',
            '#knh-ee .mmdot:hover{background:rgba(122,255,145,.98);}',
            '#knh-ee .mmlbl-layer{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:23;}',
            '#knh-ee .mmlbl{position:fixed;padding:3px 4px;border:1px solid rgba(70,178,98,.52);background:rgba(8,16,12,.72);color:rgba(214,255,220,.98);font-weight:700;line-height:1.15;text-align:center;white-space:nowrap;word-break:normal;overflow-wrap:normal;width:max-content;}',
            '#knh-ee .mmlbl.m{font-size:10px;}',
            '#knh-ee .mmlbl.l{font-size:12px;}',
            '#knh-ee .t > .i{margin:2px 0 0 0;flex:0 0 auto;}',
            '#knh-ee .cv{display:block;cursor:crosshair;}',
            '#knh-ee .s{position:absolute;z-index:21;left:50%;right:auto;transform:translateX(-50%);top:8px;min-height:24px;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.46);border:1px solid rgba(255,255,255,.2);font-size:12px;pointer-events:none;width:max-content;max-width:calc(100% - 24px);text-align:center;}',
            '#knh-ee .s.err{color:#ffd0d0;border-color:rgba(255,110,110,.66);}',
            '#knh-ee .s.ok{color:#d6ffe1;border-color:rgba(120,255,165,.66);}',
            '#knh-ee .mc{position:fixed;z-index:21;left:0;top:0;min-height:20px;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,.46);border:1px solid rgba(255,255,255,.2);font-size:11px;line-height:1.35;color:#dff3ff;white-space:normal;pointer-events:none;display:none;}',
            '#knh-ee .mc .mcr{display:flex;align-items:center;justify-content:space-between;gap:12px;}',
            '#knh-ee .mc .mcr .lbl{text-align:left;color:#cfe7ff;}',
            '#knh-ee .mc .mcr .val{text-align:right;min-width:92px;font-variant-numeric:tabular-nums;}',
            '#knh-ee .tk{position:absolute;z-index:22;max-width:460px;padding:6px 8px;border-radius:6px;background:rgba(7,16,10,.95);border:1px solid rgba(90,200,110,.7);font-size:12px;white-space:pre-wrap;pointer-events:none;display:none;}',
            '#knh-ee .gf{position:fixed;display:none;pointer-events:none;z-index:1;border:9px solid rgba(170,170,170,.95);box-shadow:0 0 0 1px rgba(230,230,230,.75) inset;border-radius:2px;}',
            '#knh-ee .gvg{position:fixed;display:none;pointer-events:auto;z-index:5;background:rgba(0,0,0,.98);}',
            '#knh-ee .gfv{position:fixed;display:none;pointer-events:none;z-index:6;border:1px solid rgba(0,0,0,.98);box-sizing:border-box;}',
            '#knh-ee .mb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.42);display:none;pointer-events:auto;z-index:40;}',
            '#knh-ee .mb.on{display:block;}',
            '#knh-ee .mb.tilepick{background:transparent;}',
            '#knh-ee .mb .mbtp{position:fixed;display:none;background:rgba(0,0,0,.42);pointer-events:auto;}',
            '#knh-ee .mb.tilepick .mbtp{display:block;}',
            '#knh-ee .mw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:410px;max-width:92vw;max-height:88vh;overflow:auto;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}',
            '#knh-ee .mw.with-apv{width:700px;max-width:96vw;}',
            '#knh-ee .mw .h{font-size:12px;line-height:1.1;font-weight:700px;margin:0;padding:5px 8px;background:#607eab;color:#eef3ff;border-radius:10px 10px 0 0;}',
            '#knh-ee .mw .sec{padding:12px 16px;}',
            '#knh-ee .mw label{display:block;font-size:12px;margin:8px 0 4px;color:#d7e3f6;}',
            '#knh-ee .mw input,#knh-ee .mw textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}',
            '#knh-ee .mw input[type=checkbox]{width:auto !important;transform:scale(2);transform-origin:center center;margin:0;accent-color:#67be7a;}',
            '#knh-ee .mw textarea{min-height:90px;resize:vertical;line-height:1.35;}',
            '#knh-ee .plist{display:flex;flex-direction:column;gap:8px;}',
            '#knh-ee .prow{display:flex;flex-direction:column;gap:4px;}',
            '#knh-ee .plbl{font-size:11px;color:rgba(180,205,240,.96);}',
            '#knh-ee .pempty{font-size:12px;color:rgba(190,200,210,.92);padding:6px 0;}',
            '#knh-ee .ed101{background:rgba(8,12,18,.24);border:1px solid rgba(170,185,208,.36);border-radius:6px;padding:10px;}',
            '#knh-ee .ed101 textarea{min-height:240px;}',
            '#knh-ee .mw select{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}',
            '#knh-ee .ed121{background:#30363e;border:1px solid rgba(130,168,222,.72);border-radius:6px;padding:12px;}',
            '#knh-ee .ed121-main{display:grid;grid-template-columns:168px 1fr;gap:12px;}',
            '#knh-ee .ed121-box{border:1px solid rgba(170,185,208,.36);background:rgba(8,12,18,.24);border-radius:6px;padding:8px;}',
            '#knh-ee .ed121-title{font-size:18px;line-height:1.1;font-weight:700;text-align:center;padding:6px 0;margin-bottom:8px;background:linear-gradient(#1c2430,#131920);border:1px solid rgba(190,205,228,.26);border-radius:4px;}',
            '#knh-ee .ed121-ranges{width:100%;height:auto;box-sizing:border-box;}',
            '#knh-ee .ed121-list{width:100%;height:auto;box-sizing:border-box;font-family:monospace;}',
            '#knh-ee .ed121-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start;}',
            '#knh-ee .ed121-radio{display:flex;gap:10px;align-items:center;margin:6px 0;color:#d7e3f6;}',
            '#knh-ee .ed121-num{display:grid;grid-template-columns:1fr 20px 1fr;gap:8px;align-items:center;}',
            '#knh-ee .ed121-num input{width:100%;}',
            '#knh-ee .ed121-op{display:flex;gap:20px;align-items:center;margin-top:8px;}',
            '#knh-ee .ed121-note{font-size:11px;color:rgba(182,198,220,.95);margin-top:8px;}',
            '#knh-ee .sf{background:rgba(8,12,18,.24);border:1px solid rgba(170,185,208,.36);border-radius:6px;padding:10px;}',
            '#knh-ee .sfh{font-size:14px;font-weight:700;color:#e9f1ff;margin-bottom:4px;}',
            '#knh-ee .sfd{font-size:12px;color:rgba(188,203,228,.95);margin-bottom:10px;}',
            '#knh-ee .sfbody{display:block;}',
            '#knh-ee .sf.with-apv .sfbody{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:10px;align-items:start;}',
            '#knh-ee .sff{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}',
            '#knh-ee .sfr{display:flex;flex-direction:column;gap:4px;grid-column:span 2;}',
            '#knh-ee .sfr[data-fkey="frameSpec"]{margin-top:6px;}',
            '#knh-ee .sfr.compact{grid-column:span 1;}',
            '#knh-ee .sfr.full{grid-column:1 / span 4;}',
            '#knh-ee .sfr label{margin:0;font-size:12px;color:#d7e3f6;}',
            '#knh-ee .sfr .hint{font-size:11px;color:rgba(178,194,220,.92);}',
            '#knh-ee .sfr textarea{min-height:110px;}',
            '#knh-ee .apv{margin-top:10px;padding:8px;border:1px solid rgba(128,172,225,.42);border-radius:6px;background:rgba(7,11,18,.42);}',
            '#knh-ee .sf.with-apv .apv{margin-top:0;}',
            '#knh-ee .apv-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}',
            '#knh-ee .apv-ttl{font-size:12px;font-weight:700;color:#dbe9ff;}',
            '#knh-ee .apv-ctl{display:flex;align-items:center;gap:8px;}',
            '#knh-ee .apv-ctl label{display:flex;align-items:center;gap:4px;margin:0;font-size:11px;color:rgba(186,205,232,.95);}',
            '#knh-ee .apv-btn{padding:3px 8px;border:1px solid rgba(150,178,220,.46);border-radius:6px;background:rgba(38,58,82,.88);color:#eef5ff;font-size:11px;cursor:pointer;}',
            '#knh-ee .apv-btn:hover{background:rgba(54,80,112,.92);}',
            '#knh-ee .apv-sheet{display:none;margin-top:6px;padding:6px;border:1px solid rgba(104,129,160,.42);border-radius:6px;background:rgba(0,0,0,.22);}',
            '#knh-ee .apv-sheet.on{display:block;}',
            '#knh-ee .apv-sheet canvas{display:block;max-width:100%;height:auto;image-rendering:pixelated;border:1px solid rgba(120,142,168,.45);background:rgba(10,16,24,.92);}',
            '#knh-ee .apv-sheet-info{margin-top:4px;font-size:10px;line-height:1.3;color:rgba(190,206,230,.95);white-space:pre-wrap;}',
            '#knh-ee .apvov{position:fixed;left:0;top:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.64);z-index:70;pointer-events:auto;}',
            '#knh-ee .apvov.on{display:flex;}',
            '#knh-ee .apvov-box{max-width:92vw;max-height:92vh;overflow:auto;padding:10px;border:1px solid rgba(132,169,219,.62);border-radius:10px;background:rgba(20,28,38,.96);box-shadow:0 18px 48px rgba(0,0,0,.56);}',
            '#knh-ee .apvov canvas{display:block;max-width:100%;height:auto;image-rendering:pixelated;border:1px solid rgba(140,172,214,.62);background:rgba(10,16,24,.96);}',
            '#knh-ee .apvov-info{margin-top:6px;font-size:12px;line-height:1.35;color:rgba(214,229,248,.96);white-space:pre-wrap;text-align:center;}',
            '#knh-ee .apv-vp{width:100%;height:248px;border:1px solid rgba(120,142,168,.48);border-radius:6px;background:radial-gradient(circle at 50% 24%, rgba(34,48,66,.95), rgba(11,16,24,.98));overflow:hidden;}',
            '#knh-ee .apv-vp canvas{display:block;width:100%;height:100%;image-rendering:pixelated;}',
            '#knh-ee .apv-vp{cursor:grab;}',
            '#knh-ee .apv-vp.dragging{cursor:grabbing;}',
            '#knh-ee .apv-info{margin-top:6px;min-height:1.3em;font-size:11px;line-height:1.35;color:rgba(182,200,228,.95);white-space:pre-wrap;}',
            '#knh-ee .apv-log{display:none !important;}',
            '#knh-ee .tdg{display:grid;grid-template-columns:repeat(3,20px);gap:4px;align-items:center;justify-content:flex-start;}',
            '#knh-ee .tdgb{width:20px;height:20px;padding:0;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(24,31,42,.85);color:#dbe8fb;font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;text-align:center;}',
            '#knh-ee .tdgb:hover{background:rgba(40,52,70,.92);}',
            '#knh-ee .tdgb.on{border-color:#9fc3f6;background:rgba(73,102,146,.88);color:#ffffff;box-shadow:0 0 0 1px rgba(168,201,255,.45) inset;}',
            '#knh-ee .elog{width:100%;flex:1 1 auto;min-height:0;height:auto;box-sizing:border-box;margin-top:6px;padding:6px;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.28);overflow:auto;white-space:normal;font-size:10px;line-height:1.35;color:#e6eefb;}',
            '#knh-ee .elog .elog-item{display:block;padding:1px 2px;border-radius:3px;cursor:default;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '#knh-ee .elog .elog-item .elog-main{color:#e6eefb;}',
            '#knh-ee .elog .elog-item .elog-detail{color:rgba(132,224,255,.98);}',
            '#knh-ee .elog .elog-item.hit{cursor:pointer;}',
            '#knh-ee .elog .elog-item:hover{background:rgba(120,160,220,.20);}',
            '#knh-ee .sff.msg101 .sfr[data-fkey="windowType"]{grid-column:1 / span 2;}',
            '#knh-ee .sff.msg101 .sfr[data-fkey="targetMode"]{grid-column:3 / span 1;}',
            '#knh-ee .sff.msg101 .sfr[data-fkey="tailDir"]{grid-column:4 / span 1;}',
            '#knh-ee .sfr.bool{grid-column:span 1;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:4px;padding-top:0;text-align:center;}',
            '#knh-ee .sfr.bool label{margin:0;text-align:center;}',
            '#knh-ee .sfr.bool input[type=checkbox]{align-self:center;margin-top:8px;}',
            '#knh-ee .sfr.list select{height:auto;min-height:0;font-family:monospace;}',
            '#knh-ee .sfr.list input{margin-bottom:6px;}',
            '#knh-ee .ed-btns{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px 14px;}',
            '#knh-ee .acmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:41;}',
            '#knh-ee .acmb.on{display:block;}',
            '#knh-ee .acw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:490px;max-width:96vw;max-height:92vh;overflow:auto;padding:8px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}',
            '#knh-ee .actabs{display:flex;gap:4px;margin-bottom:6px;}',
            '#knh-ee .actab{min-width:40px;padding:4px 8px;background:#2d343b;border:1px solid rgba(170,185,208,.36);border-radius:4px;color:#dce9ff;font-size:15px;line-height:1;cursor:pointer;}',
            '#knh-ee .actab.on{background:#1f2c3e;border-color:#7aa5dc;color:#f1f7ff;}',
            '#knh-ee .acgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
            '#knh-ee .accol{display:flex;flex-direction:column;gap:8px;}',
            '#knh-ee .acgrp{border:1px solid rgba(170,185,208,.36);background:rgba(8,12,18,.24);border-radius:6px;padding:6px;}',
            '#knh-ee .acgtt{font-size:13px;line-height:1.2;font-weight:700;color:#edf4ff;letter-spacing:.01em;margin:0 0 4px 0;}',
            '#knh-ee .acbtn{display:block;width:100%;margin:0 0 2px 0;padding:2px 6px;text-align:center;background:#535b62;border:1px solid rgba(185,196,212,.42);border-radius:4px;color:#eaf1ff;font-size:12px;line-height:1.1;cursor:pointer;}',
            '#knh-ee .acbtn:last-child{margin-bottom:0;}',
            '#knh-ee .acbtn:hover{background:#606971;}',
            '#knh-ee .acbtn.dis,#knh-ee .acbtn:disabled{background:#41474d;border-color:rgba(150,160,172,.28);color:#9ea8b5;cursor:not-allowed;}',
            '#knh-ee .acbtn.dis:hover,#knh-ee .acbtn:disabled:hover{background:#41474d;}',
            '#knh-ee .acf{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:6px;}',
            '#knh-ee .acinfo{font-size:11px;color:rgba(192,208,232,.95);white-space:pre-wrap;}',
            '#knh-ee .acclose{padding:4px 8px;background:#3e4750;border:1px solid rgba(170,185,208,.36);border-radius:4px;color:#eaf1ff;font-size:11px;cursor:pointer;}'
            ,'#knh-ee .wimb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:43;}'
            ,'#knh-ee .wimb.on{display:block;}'
            ,'#knh-ee .wiw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:360px;max-width:94vw;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}'
            ,'#knh-ee .wi-sec{padding-top:10px;padding-bottom:6px;}'
            ,'#knh-ee .wi-pos{display:flex;gap:12px;align-items:center;margin:2px 0 8px 0;}'
            ,'#knh-ee .wi-pos label{display:flex;align-items:center;gap:6px;margin:0;color:#e3ecfb;font-size:12px;}'
            ,'#knh-ee .wi-row{display:flex;align-items:center;gap:6px;}'
            ,'#knh-ee .wi-row input{width:110px;}'
            ,'#knh-ee .wi-note{margin-top:8px;font-size:11px;line-height:1.35;color:rgba(188,204,228,.96);white-space:pre-wrap;}'
            ,'#knh-ee .mmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:44;}'
            ,'#knh-ee .mmb.on{display:block;}'
            ,'#knh-ee .mmw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-width:94vw;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}'
            ,'#knh-ee .mm-sec{padding-top:10px;padding-bottom:8px;}'
            ,'#knh-ee .mm-size{width:120px;max-width:100%;}'
            ,'#knh-ee .mm-text{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}'
            ,'#knh-ee .mm-note{margin-top:8px;font-size:11px;line-height:1.35;color:rgba(188,204,228,.96);white-space:pre-wrap;}'
            ,'#knh-ee .rmcmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:42;}'
            ,'#knh-ee .rmcmb.on{display:block;}'
            ,'#knh-ee .rmcw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:640px;max-width:96vw;max-height:92vh;overflow:auto;padding:8px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}'
            ,'#knh-ee .rmctt{font-size:22px;line-height:1.1;font-weight:700;color:#edf4ff;margin:2px 2px 8px 2px;}'
            ,'#knh-ee .rmcgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}'
            ,'#knh-ee .rmccol{display:flex;flex-direction:column;gap:2px;}'
            ,'#knh-ee .rmcbtn{display:block;width:100%;padding:2px 6px;text-align:center;background:#535b62;border:1px solid rgba(185,196,212,.42);border-radius:4px;color:#eaf1ff;font-size:12px;line-height:1.15;cursor:pointer;}'
            ,'#knh-ee .rmcbtn:hover{background:#606971;}'
            ,'#knh-ee .rmcf{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}'
            ,'#knh-ee .rmcclose{padding:4px 8px;background:#3e4750;border:1px solid rgba(170,185,208,.36);border-radius:4px;color:#eaf1ff;font-size:11px;cursor:pointer;}'
        ].join('\n');
    };

    EE.prototype.buildUi = function() {
        var self = this;
        this.injectStyle();
        var r = this.el('div', '');
        r.id = 'knh-ee';
        this.gameBottomMask = this.el('div', 'gbm', '');
        r.appendChild(this.gameBottomMask);

        var l = this.el('div', 'p l');
        l.appendChild(this.el('div', 'ti', 'キャラ＆イベント一覧'));
        this.charList = this.el('div', 'charlist');
        l.appendChild(this.charList);
        this.charHint = this.el('div', 'charhint', '左クリック: 選択\n右クリック: タイムラインに追加');
        l.appendChild(this.charHint);
        r.appendChild(l);
        var ld = this.el('div', 'p ld');
        ld.appendChild(this.el('div', 'ti', '選択キャラ情報'));
        this.charInfo = this.el('div', 'cinfo', '未選択');
        ld.appendChild(this.charInfo);
        r.appendChild(ld);

        var rr = this.el('div', 'p r');
        rr.appendChild(this.el('div', 'ti', 'Selected Event'));
        this.eventInfo = this.el('div', 'i', 'No event selected');
        rr.appendChild(this.eventInfo);
        rr.appendChild(this.el('div', 'ti', 'Execution Log'));
        this.execLogView = this.el('div', 'elog', '');
        this.execLogView.addEventListener('wheel', function(e) { self.onExecutionLogWheel(e); }, { passive: false });
        rr.appendChild(this.execLogView);
        this.renderExecutionLog(true);
        r.appendChild(rr);

        var t = this.el('div', 'p t');
        this.timelinePanel = t;
        t.appendChild(this.el('div', 'ti', 'Timeline'));
        this.timelineWrap = this.el('div', 'tv');
        this.timeline = this.el('canvas', 'cv');
        this.timelineWrap.appendChild(this.timeline);
        t.appendChild(this.timelineWrap);
        this.memoLabelLayer = this.el('div', 'mmlbl-layer');
        r.appendChild(this.memoLabelLayer);
        this.memoScrollLane = this.el('div', 'mmlane');
        r.appendChild(this.memoScrollLane);
        this.tInfo = this.el('div', 'i', 'frame: 0');
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
        this.charCtx.appendChild(this.charCtxCmdAddBtn);
        this.charCtx.appendChild(this.charCtxTileMoveBtn);
        this.charCtx.appendChild(this.charCtxTeleportBtn);
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
        this.routeCtxMergeBtn = this.el('button', '', '移動ルートの結合');
        this.routeCtxMergeBtn.type = 'button';
        this.routeCtxMergeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.executeSelectionRouteMergeFromContextMenu();
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
        this.routeCtx.appendChild(this.routeCtxMergeBtn);
        r.appendChild(this.routeCtx);
        this.routeRangeCtxUid = 0;

        this.buildEditorModal(r);
        this.buildAddCommandModal(r);
        this.buildWaitInsertModal(r);
        this.buildMemoModal(r);
        this.buildRouteCommandModal(r);

        document.body.appendChild(r);
        this.root = r;
        this.refreshCharacterPanel(true);
        this.syncTimelineSize();
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
        this.edHead = this.el('div', 'h', 'Edit Command');
        w.appendChild(this.edHead);
        var sec = this.el('div', 'sec');
        w.appendChild(sec);
        this.edGenericWrap = this.el('div', '');
        sec.appendChild(this.edGenericWrap);
        this.edGenericWrap.appendChild(this.el('label', '', 'Code'));
        this.edCode = this.el('input', '');
        this.edCode.type = 'number';
        this.edCode.readOnly = true;
        this.attachNumberWheelInput(this.edCode);
        this.edGenericWrap.appendChild(this.edCode);
        this.edGenericWrap.appendChild(this.el('label', '', 'Indent'));
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
        var sMain = this.el('div', 'ed121-main');
        var sLeft = this.el('div', 'ed121-box');
        sLeft.appendChild(this.el('div', 'ed121-title', 'スイッチ'));
        this.ed121RangeList = this.el('select', 'ed121-ranges');
        this.ed121RangeList.size = 10;
        this.attachSelectWheelInput(this.ed121RangeList);
        sLeft.appendChild(this.ed121RangeList);
        sMain.appendChild(sLeft);
        var sRight = this.el('div', 'ed121-box');
        sRight.appendChild(this.el('label', '', 'スイッチ一覧'));
        this.ed121SwitchList = this.el('select', 'ed121-list');
        this.ed121SwitchList.size = 10;
        this.attachSelectWheelInput(this.ed121SwitchList);
        sRight.appendChild(this.ed121SwitchList);
        var sMode = this.el('div', 'ed121-row2');
        var sType = this.el('div', '');
        sType.appendChild(this.el('label', '', '対象'));
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
        sType.appendChild(typeRadio);
        sMode.appendChild(sType);
        var sNum = this.el('div', '');
        sNum.appendChild(this.el('label', '', '番号'));
        var sNumRow = this.el('div', 'ed121-num');
        this.ed121From = this.el('input', '');
        this.ed121From.type = 'number';
        this.ed121From.step = '1';
        this.ed121From.min = '1';
        this.attachNumberWheelInput(this.ed121From);
        this.ed121To = this.el('input', '');
        this.ed121To.type = 'number';
        this.ed121To.step = '1';
        this.ed121To.min = '1';
        this.attachNumberWheelInput(this.ed121To);
        sNumRow.appendChild(this.ed121From);
        sNumRow.appendChild(this.el('div', '', '~'));
        sNumRow.appendChild(this.ed121To);
        sNum.appendChild(sNumRow);
        sMode.appendChild(sNum);
        sRight.appendChild(sMode);
        sRight.appendChild(this.el('label', '', 'Operation'));
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
        sRight.appendChild(opRow);
        this.ed121Note = this.el('div', 'ed121-note', 'Pick from list, then set ON/OFF.');
        sRight.appendChild(this.ed121Note);
        sMain.appendChild(sRight);
        this.ed121Wrap.appendChild(sMain);
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
        this.ed121RangeList.addEventListener('change', function() {
            self2.refreshSwitchListByRange(Number(self2.ed121RangeList.value || 0));
        });
        this.ed121SwitchList.addEventListener('change', function() {
            self2.onSwitchListPick();
        });
        this.ed121Single.addEventListener('change', function() { self2.syncSwitchEditorType(); });
        this.ed121Range.addEventListener('change', function() { self2.syncSwitchEditorType(); });
        this.ed121From.addEventListener('focus', function() { self2.ed121PickTarget = 'from'; });
        this.ed121To.addEventListener('focus', function() { self2.ed121PickTarget = 'to'; });
        this.ed121From.addEventListener('input', function() { self2.syncSwitchFromInput(); });
        this.ed121To.addEventListener('input', function() { self2.syncSwitchToInput(); });

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
        this.edScriptText = this.el('textarea', '');
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

    EE.prototype.buildAddCommandModal = function(root) {
        var self = this;
        var mb = this.el('div', 'acmb');
        var w = this.el('div', 'acw');
        mb.appendChild(w);
        this.addModal = mb;
        this.addWin = w;
        this.addTabs = this.el('div', 'actabs');
        this.addTabBtns = [];
        for (var i = 1; i <= 3; i++) {
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
        grid.appendChild(this.routeColL);
        grid.appendChild(this.routeColM);
        grid.appendChild(this.routeColR);
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

    EE.prototype.memoTextFromEntry = function(e) {
        if (!e) return '';
        if (e.isMemo) return String(e.memoText || '');
        var lines = e.commentLines && e.commentLines.length
            ? e.commentLines
            : [String((e.command && e.command.parameters && e.command.parameters[0]) || '')];
        return String(lines.join('\n'));
    };

    EE.prototype.buildMemoModal = function(root) {
        var self = this;
        var mb = this.el('div', 'mmb');
        var w = this.el('div', 'mmw');
        mb.appendChild(w);
        this.memoHead = this.el('div', 'h', 'メモ編集');
        w.appendChild(this.memoHead);
        var sec = this.el('div', 'sec mm-sec');
        sec.appendChild(this.el('label', '', 'サイズ'));
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
        sec.appendChild(this.memoSizeSelect);
        sec.appendChild(this.el('label', '', 'テキスト (1行)'));
        this.memoTextInput = this.el('input', 'mm-text');
        this.memoTextInput.type = 'text';
        this.memoTextInput.maxLength = 512;
        sec.appendChild(this.memoTextInput);
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
            tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
            this.selUid = uid;
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(e.frame || this.frame || 0)));
            this.dirty[this.selKey] = true;
            this.rebuildSchedule();
            this.playFrom(this.frame);
            this.timelineDirty = true;
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
            }
        };
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
        var pageNo = Math.max(1, Math.min(3, Number(this.addPage || 1)));
        var mappedPage = (pageNo === 1) ? 3 : (pageNo === 3 ? 1 : 2);
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
                { code: 4510, label: 'フレームアニメ再生(数値/配列)...' },
                { code: 4514, label: '画像の変更(setImageZXC)...' },
                { code: 4512, label: '仲間の位置に合わせる...' },
                { code: 4519, label: '仲間の位置へ向かう...' },
                { code: 4513, label: 'マスクフェードアウト...' },
                { code: 4515, label: 'ブルブル開始' },
                { code: 4516, label: 'ブルブル停止' },
                { code: 4517, label: 'ガタガタ開始' },
                { code: 4518, label: 'ガタガタ停止' },
                { code: 4500, label: 'タイルへ移動...' }, { code: 45, label: 'スクリプト...' }
            ]
        };
    };

    EE.prototype.ensureRouteEditorSchemas = function() {
        if (this._routeEditorSchemas) return;
        this._routeEditorSchemas = {};
        var self = this;
        function reg(code, schema) { self._routeEditorSchemas[Number(code || 0)] = schema; }
        function regSimple(code, desc) {
            reg(code, {
                code: code,
                title: self.routeCommandNameJa(code),
                description: String(desc || 'このコマンドはパラメータを持ちません。'),
                fields: [],
                fromRouteCommand: function() { return {}; },
                toParams: function() { return []; }
            });
        }

        for (var c = 1; c <= 13; c++) regSimple(c);
        for (c = 16; c <= 26; c++) regSimple(c);
        for (c = 31; c <= 40; c++) regSimple(c);

        reg(14, {
            code: 14,
            routeCode: 45,
            title: 'ジャンプ',
            description: 'this.jump(x, y, 高さ倍率, 時間倍率) を編集します（保存時はスクリプト(45)）。ゲーム画面クリックで着地点指定できます。',
            fields: [
                { key: 'dx', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'dy', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true },
                { key: 'heightRate', type: 'number', label: '高さ倍率', min: 0.1, step: 0.1, compact: true },
                { key: 'durationRate', type: 'number', label: '時間倍率', min: 0.1, step: 0.1, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var parsed = this.parseRouteJumpExCommand(cmd);
                if (parsed) {
                    return {
                        dx: this.tileMoveSnapCoord(Number(parsed.dx || 0)),
                        dy: this.tileMoveSnapCoord(Number(parsed.dy || 0)),
                        heightRate: Math.max(0.1, Number(parsed.heightRate == null ? 1 : parsed.heightRate) || 1),
                        durationRate: Math.max(0.1, Number(parsed.durationRate == null ? 1 : parsed.durationRate) || 1)
                    };
                }
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return {
                    dx: this.tileMoveSnapCoord(Number(p[0] || 0)),
                    dy: this.tileMoveSnapCoord(Number(p[1] || 0)),
                    heightRate: 1,
                    durationRate: 1
                };
            },
            toParams: function(state) {
                return [this.makeRouteJumpExScript(
                    state && state.dx,
                    state && state.dy,
                    state && state.heightRate,
                    state && state.durationRate
                )];
            }
        });

        reg(15, {
            code: 15,
            title: 'ウェイト',
            description: '待機フレーム数を指定します。',
            fields: [
                { key: 'frames', type: 'number', label: 'フレーム', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { frames: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.frames || 1) || 1))];
            }
        });

        reg(27, {
            code: 27,
            title: 'スイッチON',
            description: 'ON にするスイッチIDを指定します。',
            fields: [
                { key: 'switchId', type: 'number', label: 'スイッチID', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { switchId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.switchId || 1) || 1))];
            }
        });

        reg(28, {
            code: 28,
            title: 'スイッチOFF',
            description: 'OFF にするスイッチIDを指定します。',
            fields: [
                { key: 'switchId', type: 'number', label: 'スイッチID', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { switchId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.switchId || 1) || 1))];
            }
        });

        reg(29, {
            code: 29,
            title: '移動速度の変更',
            description: '移動速度 (1〜6) を指定します。',
            fields: [
                { key: 'speed', type: 'number', label: '移動速度', min: 1, max: 6, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { speed: Math.max(1, Math.min(6, Math.floor(Number(p[0] || 4) || 4))) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.min(6, Math.floor(Number(state.speed || 4) || 4)))];
            }
        });

        reg(30, {
            code: 30,
            title: '移動頻度の変更',
            description: '移動頻度 (1〜5) を指定します。',
            fields: [
                { key: 'freq', type: 'number', label: '移動頻度', min: 1, max: 5, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { freq: Math.max(1, Math.min(5, Math.floor(Number(p[0] || 3) || 3))) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.min(5, Math.floor(Number(state.freq || 3) || 3)))];
            }
        });

        reg(41, {
            code: 41,
            title: '画像の変更',
            description: '画像名とインデックスを指定します。',
            fields: [
                { key: 'name', type: 'text', label: '画像名', full: true },
                { key: 'index', type: 'number', label: 'インデックス', min: 0, max: 7, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return {
                    name: String(p[0] || ''),
                    index: Math.max(0, Math.min(7, Math.floor(Number(p[1] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    String(state.name || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.index || 0) || 0)))
                ];
            }
        });

        reg(42, {
            code: 42,
            title: '不透明度の変更',
            description: '不透明度 (0〜255) を指定します。',
            fields: [
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { opacity: Math.max(0, Math.min(255, Math.floor(Number(p[0] || 255) || 255))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255)))];
            }
        });

        reg(43, {
            code: 43,
            title: '合成方法の変更',
            description: '合成方法を指定します。',
            fields: [
                {
                    key: 'blend',
                    type: 'select',
                    label: '合成方法',
                    valueType: 'number',
                    options: [
                        { value: 0, label: '通常' },
                        { value: 1, label: '加算' },
                        { value: 2, label: '乗算' },
                        { value: 3, label: 'スクリーン' }
                    ],
                    compact: true
                }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { blend: Math.max(0, Math.min(3, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(3, Math.floor(Number(state.blend || 0) || 0)))];
            }
        });

        reg(44, {
            code: 44,
            title: 'SEの演奏',
            description: 'SEパラメータを指定します。',
            fields: [
                { key: 'name', type: 'text', label: 'SE名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1, integer: true, compact: true },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1, integer: true, compact: true },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                var se = (p[0] && typeof p[0] === 'object') ? p[0] : {};
                return {
                    name: String(se.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(se.volume == null ? 90 : se.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(se.pitch == null ? 100 : se.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(se.pan == null ? 0 : se.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(45, {
            code: 45,
            title: 'スクリプト',
            description: '実行するスクリプトを入力します。',
            fields: [
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 6 }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { script: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.script || '')];
            }
        });

        reg(4510, {
            code: 4510,
            routeCode: 45,
            title: 'フレームアニメ再生',
            description: 'this.startFrameAnimation(...) を編集します。画像変更をONにすると this.setImageZXC(...), this.startFrameAnimation(...) 形式で保存します（スクリプト(45)）。',
            fields: [
                { key: 'useImage', type: 'bool', label: '画像変更を行う', full: true },
                { key: 'imageName', type: 'text', label: '画像名', full: true, visibleWhen: { key: 'useImage', eq: true } },
                { key: 'imageIndex', type: 'number', label: 'index', step: 1, integer: true, compact: true, visibleWhen: { key: 'useImage', eq: true } },
                { key: 'imageDir', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true, visibleWhen: { key: 'useImage', eq: true } },
                { key: 'frameSpec', type: 'text', label: 'フレーム指定(数値 or 配列)', full: true, hint: '例: 8 / [8,9,10]' },
                { key: 'speed', type: 'number', label: '速度', step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ再生' }
            ],
            fromRouteCommand: function(cmd) {
                var q = this.parseRouteSetImageAndStartFrameAnimationCommand(cmd);
                if (q) {
                    return {
                        useImage: true,
                        imageName: String(q.imageName || ''),
                        imageIndex: Math.floor(Number(q.imageIndex || 0) || 0),
                        imageDir: this.normalizeDirection8(q.imageDir, 2),
                        frameSpec: String(q.frameSpec || '[8,9,10]'),
                        speed: Math.floor(Number(q.speed || 6) || 6),
                        loop: !!q.loop
                    };
                }
                var p = this.parseRouteStartFrameAnimationListCommand(cmd);
                return {
                    useImage: p ? false : true,
                    imageName: '$003_2',
                    imageIndex: 0,
                    imageDir: 2,
                    frameSpec: p ? String(p.frameSpec || '[8,9,10]') : '[8,9,10]',
                    speed: p ? Math.floor(Number(p.speed || 6) || 6) : 6,
                    loop: p ? !!p.loop : false
                };
            },
            toParams: function(state) {
                var ps = this.parseFrameAnimationFrameSpecLiteral(state && state.frameSpec);
                if (!ps) throw new Error('フレーム指定は「数値」または「[1,2,3]」形式で入力してください');
                if (state && state.useImage) {
                    return [this.makeRouteSetImageAndStartFrameAnimationScript(
                        state && state.imageName,
                        state && state.imageIndex,
                        state && state.imageDir,
                        ps.literal,
                        state && state.speed,
                        state && state.loop
                    )];
                }
                return [this.makeRouteStartFrameAnimationListScript(ps.literal, state && state.speed, state && state.loop)];
            }
        });

        reg(4511, {
            code: 4511,
            routeCode: 45,
            title: '画像変更+フレームアニメ',
            description: 'this.setImageZXC(...), this.startFrameAnimation(...) を1コマンドで編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'imageName', type: 'text', label: '画像名', full: true },
                { key: 'imageIndex', type: 'number', label: '画像インデックス', step: 1, integer: true, compact: true },
                { key: 'imageDir', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true },
                { key: 'frameSpec', type: 'text', label: 'フレーム指定(数値 or 配列)', hint: '例: 8 / [8,9,10]' },
                { key: 'speed', type: 'number', label: '速度', step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ再生' }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteSetImageAndStartFrameAnimationCommand(cmd);
                return {
                    imageName: p ? String(p.imageName || '') : '$003_2',
                    imageIndex: p ? Math.floor(Number(p.imageIndex || 0) || 0) : 0,
                    imageDir: p ? this.normalizeDirection8(p.imageDir, 2) : 2,
                    frameSpec: p ? String(p.frameSpec || '[8,9,10]') : '[8,9,10]',
                    speed: p ? Math.floor(Number(p.speed || 6) || 6) : 6,
                    loop: p ? !!p.loop : false
                };
            },
            toParams: function(state) {
                var ps = this.parseFrameAnimationFrameSpecLiteral(state && state.frameSpec);
                if (!ps) throw new Error('フレーム指定は「数値」または「[1,2,3]」形式で入力してください');
                return [this.makeRouteSetImageAndStartFrameAnimationScript(
                    state && state.imageName,
                    state && state.imageIndex,
                    state && state.imageDir,
                    ps.literal,
                    state && state.speed,
                    state && state.loop
                )];
            }
        });

        reg(4514, {
            code: 4514,
            routeCode: 45,
            title: '画像の変更(setImageZXC)',
            description: 'this.setImageZXC(name, index, direction) を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'name', type: 'text', label: '画像名', full: true },
                { key: 'index', type: 'number', label: 'index', step: 1, integer: true, compact: true },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteSetImageZxcCommand(cmd);
                return {
                    name: p ? String(p.name || '') : '$003_2',
                    index: p ? Math.floor(Number(p.x || 0) || 0) : 0,
                    direction: p ? this.normalizeDirection8(Number(p.y || 2), 2) : 2
                };
            },
            toParams: function(state) {
                return [this.makeRouteSetImageZxcScript(
                    state && state.name,
                    state && state.index,
                    state && state.direction
                )];
            }
        });

        reg(4512, {
            code: 4512,
            routeCode: 45,
            title: '仲間の位置に合わせる',
            description: 'this.locateToCharacter($gamePlayer._followers.follower(n)), this._direction = d を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'partyMember', type: 'select', label: 'パーティメンバー', valueType: 'number', options: [{ value: 2, label: '2人目' }, { value: 3, label: '3人目' }, { value: 4, label: '4人目' }], compact: true },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteLocateFollowerAndDirectionCommand(cmd);
                return {
                    partyMember: this.routeFollowerIndexToPartyMember(p ? p.followerIndex : 1),
                    direction: p ? this.normalizeDirection8(p.direction, 6) : 6
                };
            },
            toParams: function(state) {
                return [this.makeRouteLocateFollowerAndDirectionScript(
                    this.routePartyMemberToFollowerIndex(state && state.partyMember),
                    state && state.direction
                )];
            }
        });

        reg(4519, {
            code: 4519,
            routeCode: 45,
            title: '仲間の位置へ向かう',
            description: 'this.goToCharacter($gamePlayer._followers.follower(n)) を編集します。ウェイトは移動距離と速度から自動計算で固定（保存時はスクリプト(45)）。',
            fields: [
                { key: 'partyMember', type: 'select', label: 'パーティメンバー', valueType: 'number', options: [{ value: 2, label: '2人目' }, { value: 3, label: '3人目' }, { value: 4, label: '4人目' }], compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteGoToFollowerCommand(cmd);
                return {
                    partyMember: this.routeFollowerIndexToPartyMember(p ? p.followerIndex : 1)
                };
            },
            toParams: function(state) {
                return [this.makeRouteGoToFollowerScript(this.routePartyMemberToFollowerIndex(state && state.partyMember))];
            },
            applyRouteCommand: function(list, idx, state, entry) {
                var wf = this.routeGoToFollowerAutoWaitFrames(entry, idx, this.routePartyMemberToFollowerIndex(state && state.partyMember));
                this.setRouteGoToFollowerWaitFrames(list, idx, wf);
            }
        });

        reg(4513, {
            code: 4513,
            routeCode: 45,
            title: 'マスクフェードアウト',
            description: 'this.startMaskFadeOut(70) を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'frames', type: 'number', label: 'フェードフレーム', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteStartMaskFadeOutCommand(cmd);
                return { frames: p ? Math.max(1, Math.floor(Number(p.frames || 1) || 1)) : 70 };
            },
            toParams: function(state) {
                return [this.makeRouteStartMaskFadeOutScript(state && state.frames)];
            }
        });

        reg(4515, {
            code: 4515,
            routeCode: 45,
            title: 'ブルブル開始',
            description: 'this.startGatagata() を実行します（保存時はスクリプト(45)）。',
            fields: [],
            fromRouteCommand: function() { return {}; },
            toParams: function() { return [this.makeRouteShiverControlScript('startGatagata')]; }
        });

        reg(4516, {
            code: 4516,
            routeCode: 45,
            title: 'ブルブル停止',
            description: 'this.stopGatagata() を実行します（保存時はスクリプト(45)）。',
            fields: [],
            fromRouteCommand: function() { return {}; },
            toParams: function() { return [this.makeRouteShiverControlScript('stopGatagata')]; }
        });

        reg(4517, {
            code: 4517,
            routeCode: 45,
            title: 'ガタガタ開始',
            description: 'this.startShiverX() を実行します（保存時はスクリプト(45)）。',
            fields: [],
            fromRouteCommand: function() { return {}; },
            toParams: function() { return [this.makeRouteShiverControlScript('startShiverX')]; }
        });

        reg(4518, {
            code: 4518,
            routeCode: 45,
            title: 'ガタガタ停止',
            description: 'this.stopShiverX() を実行します（保存時はスクリプト(45)）。',
            fields: [],
            fromRouteCommand: function() { return {}; },
            toParams: function() { return [this.makeRouteShiverControlScript('stopShiverX')]; }
        });

        reg(4500, {
            code: 4500,
            routeCode: 45,
            title: 'タイルへ移動',
            description: 'this.goTo(x, y) を編集します。ウェイトは移動距離と速度から自動計算で固定（セーブ上はスクリプト(45)のまま保存）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true }
            ],
            fromRouteCommand: function(cmd, entry, routeListIndex) {
                var p = this.parseRouteTileGotoCommand(cmd);
                return {
                    x: p ? Number(p.x || 0) : 0,
                    y: p ? Number(p.y || 0) : 0
                };
            },
            toParams: function(state) {
                return [this.makeRouteTileGotoScript(state && state.x, state && state.y)];
            },
            applyRouteCommand: function(list, idx, state, entry) {
                var wf = this.routeTileGotoAutoWaitFrames(entry, idx, state && state.x, state && state.y);
                this.setRouteTileGotoWaitFrames(list, idx, wf);
            }
        });
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

    EE.prototype.routeJumpDurationFrames = function(dx, dy, speed, heightRate, durationRate) {
        var jx = Number(dx || 0);
        var jy = Number(dy || 0);
        var sp = Math.max(1, Math.min(6, Math.floor(Number(speed || 4) || 4)));
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

    EE.prototype.parseFrameIdCsvText = function(text, fallback) {
        var src = String(text == null ? '' : text).trim();
        var arr = [];
        if (src.length) {
            var parts = src.split(',');
            for (var i = 0; i < parts.length; i++) {
                var v = Math.floor(Number(String(parts[i] || '').trim()) || 0);
                if (v > 0) arr.push(v);
            }
        }
        if (!arr.length) {
            var fb = Array.isArray(fallback) ? fallback : [8, 9, 10];
            for (var j = 0; j < fb.length; j++) {
                var fv = Math.floor(Number(fb[j] || 0) || 0);
                if (fv > 0) arr.push(fv);
            }
        }
        if (!arr.length) arr.push(1);
        return arr;
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

    EE.prototype.parseRouteShiverControlScript = function(script) {
        var s = this.stripTrailingLineComment(String(script || '')).trim();
        if (!s.length) return null;
        if (/^this\.startGatagata\(\s*\)\s*;?$/i.test(s)) return { kind: 'startGatagata' };
        if (/^this\.stopGatagata\(\s*\)\s*;?$/i.test(s)) return { kind: 'stopGatagata' };
        if (/^this\.startShiverX\(\s*\)\s*;?$/i.test(s)) return { kind: 'startShiverX' };
        if (/^this\.stopShiverX\(\s*\)\s*;?$/i.test(s)) return { kind: 'stopShiverX' };
        return null;
    };

    EE.prototype.parseRouteShiverControlCommand = function(routeCmd) {
        if (!routeCmd || Number(routeCmd.code || 0) !== 45) return null;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return this.parseRouteShiverControlScript(String(p[0] || ''));
    };

    EE.prototype.makeRouteShiverControlScript = function(kind) {
        kind = String(kind || '');
        if (kind === 'startGatagata') return 'this.startGatagata()';
        if (kind === 'stopGatagata') return 'this.stopGatagata()';
        if (kind === 'startShiverX') return 'this.startShiverX()';
        if (kind === 'stopShiverX') return 'this.stopShiverX()';
        return 'this.startGatagata()';
    };

    EE.prototype.routeDisplayCodeForCommand = function(routeCmd) {
        if (!routeCmd) return 0;
        var code = Number(routeCmd.code || 0);
        if (code !== 45) return code;
        if (this.parseRouteJumpExCommand(routeCmd)) return 14;
        if (this.isRouteTileGotoCommand(routeCmd)) return 4500;
        if (this.parseRouteStartFrameAnimationListCommand(routeCmd)) return 4510;
        if (this.parseRouteSetImageAndStartFrameAnimationCommand(routeCmd)) return 4510;
        if (this.parseRouteSetImageZxcCommand(routeCmd)) return 4514;
        if (this.parseRouteLocateFollowerAndDirectionCommand(routeCmd)) return 4512;
        if (this.parseRouteGoToFollowerCommand(routeCmd)) return 4519;
        if (this.parseRouteStartMaskFadeOutCommand(routeCmd)) return 4513;
        var shiver = this.parseRouteShiverControlCommand(routeCmd);
        if (shiver) {
            if (shiver.kind === 'startGatagata') return 4515;
            if (shiver.kind === 'stopGatagata') return 4516;
            if (shiver.kind === 'startShiverX') return 4517;
            if (shiver.kind === 'stopShiverX') return 4518;
        }
        return 45;
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

    // [EE_TILE_WAIT] debug logging removed.
    EE.prototype.logTileWaitDebug = function() {};

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
            this.logTileWaitDebug('auto_skip_invalid_entry', {
                fallback: fallback,
                routeListIndex: Math.floor(Number(routeListIndex == null ? -1 : routeListIndex))
            });
            return fallback;
        }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.max(0, Math.floor(Number(routeListIndex == null ? -1 : routeListIndex)));
        if (idx < 0 || idx >= list.length) {
            this.logTileWaitDebug('auto_skip_out_of_range', {
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
                this.logTileWaitDebug('auto_skip_not_goto', {
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
            if (Number(rc.code || 0) === 29) {
                var p29 = Array.isArray(rc.parameters) ? rc.parameters : [];
                speed = Math.max(1, Math.min(6, Math.floor(Number(p29[0] == null ? speed : p29[0]) || speed)));
            }
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
            this.logTileWaitDebug('auto_invalid_start', {
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
        this.logTileWaitDebug('auto_wait', {
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
            this.logTileWaitDebug('runtime_skip_no_character', {
                targetX: Number(targetX),
                targetY: Number(targetY)
            });
            return 0;
        }
        var tx = Number(targetX);
        var ty = Number(targetY);
        if (!isFinite(tx) || !isFinite(ty)) {
            this.logTileWaitDebug('runtime_skip_invalid_target', {
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
                this.logTileWaitDebug('runtime_wait', {
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
            this.logTileWaitDebug('runtime_wait', {
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
            if (Number(prev.code || 0) === 29) {
                var p29 = Array.isArray(prev.parameters) ? prev.parameters : [];
                speed = Math.max(1, Math.min(6, Math.floor(Number(p29[0] == null ? speed : p29[0]) || speed)));
            }
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
                this.logTileWaitDebug('recalc_auto_apply', {
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
                this.logTileWaitDebug('recalc_auto_apply_go_to_follower', {
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
        this.logTileWaitDebug('sim_recalc_begin', {
            eventId: Math.floor(Number(entry.eventId || 0)),
            pageIndex: Math.floor(Number(entry.pageIndex || 0)),
            uid: Math.floor(Number(entry.uid || 0)),
            entryFrame: baseFrame,
            routeLength: list.length
        });
        this.simTo(baseFrame, false);
        var baseCh = this.routeCharacterByEntry(entry);
        if (baseCh) {
            speedState = Math.max(1, Math.min(6, Math.floor(Number(baseCh._moveSpeed || 4) || 4)));
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
                this.simTo(simFrame, false);
                var ch = this.routeCharacterByEntry(entry);
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
                this.logTileWaitDebug('sim_recalc_goto', {
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
                    speedState: Math.max(1, Math.min(6, Math.floor(Number(speedState || 4) || 4))),
                    heuristicWait: heuristicWf,
                    runtimeWait: wfRaw,
                    finalWait: wf,
                    applyReason: applyReason
                });
                rc = list[i];
                offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
                i++;
                continue;
            }
            if (this.isRouteGoToFollowerCommand(rc)) {
                var gtf = this.parseRouteGoToFollowerCommand(rc);
                var simFrame = Math.max(0, Math.floor(baseFrame + offset));
                this.simTo(simFrame, false);
                var ch = this.routeCharacterByEntry(entry);
                var follower = this.routeFollowerCharacterByIndex(gtf && gtf.followerIndex);
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
                this.logTileWaitDebug('sim_recalc_go_to_follower', {
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
                    speedState: Math.max(1, Math.min(6, Math.floor(Number(speedState || 4) || 4))),
                    heuristicWait: heuristicWf,
                    runtimeWait: wfRaw,
                    finalWait: wf,
                    applyReason: applyReason
                });
                rc = list[i];
                offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
                i++;
                continue;
            }
            offset += this.routeCommandRuntimeSpanForRecalc(rc, speedState);
            speedState = this.routeSpeedStateAfterCommandForRecalc(rc, speedState);
            i++;
        }
    };

    EE.prototype.routeCommandRuntimeSpanForRecalc = function(routeCmd, speedState) {
        if (!routeCmd) return 0;
        var code = Math.floor(Number(routeCmd.code || 0));
        if (code <= 0) return 0;
        var speed = Math.max(1, Math.min(6, Math.floor(Number(speedState || 4) || 4)));
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
        var speed = Math.max(1, Math.min(6, Math.floor(Number(speedState || 4) || 4)));
        if (!routeCmd) return speed;
        var code = Math.floor(Number(routeCmd.code || 0));
        if (code !== 29) return speed;
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        return Math.max(1, Math.min(6, Math.floor(Number(p[0] == null ? speed : p[0]) || speed)));
    };

    EE.prototype.normalizeTrackRouteTileGotoWaitMeta = function(tr) {
        if (!tr || !Array.isArray(tr.commands)) return;
        var restoreFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        var canSim = (typeof this.simTo === 'function') && !this.play;
        var sorted = tr.commands.slice(0).sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        try {
            for (var i = 0; i < sorted.length; i++) {
                var e = sorted[i];
                if (!e || !e.command || Number(e.command.code || 0) !== 205) continue;
                if (canSim) this.recalculateRouteTileGotoWaitMetaForEntryBySimulation(e);
                else this.recalculateRouteTileGotoWaitMetaForEntry(e);
                e.wait = this.commandWaitFrames(e.command);
            }
        } finally {
            if (canSim) {
                this.simTo(restoreFrame, false);
                this.frame = restoreFrame;
            }
        }
    };

    EE.prototype.stripRouteEditorMeta = function(route) {
        if (!route || !Array.isArray(route.list)) return route;
        for (var i = 0; i < route.list.length; i++) {
            var rc = route.list[i];
            if (!rc || typeof rc !== 'object') continue;
            if (Object.prototype.hasOwnProperty.call(rc, '_eeTileWait')) delete rc._eeTileWait;
            if (Object.prototype.hasOwnProperty.call(rc, '_eeGoToFollowerWait')) delete rc._eeGoToFollowerWait;
        }
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

    EE.prototype.makeMoveRouteCommandByCode = function(code) {
        code = Math.floor(Number(code || 0));
        if (code <= 0) return null;
        var p = [];
        if (code === 4500) {
            return { code: 45, parameters: [this.makeRouteTileGotoScript(0, 0)] };
        } else if (code === 4510) {
            return { code: 45, parameters: [this.makeRouteSetImageAndStartFrameAnimationScript('$003_2', 0, 2, '[8,9,10]', 6, false)] };
        } else if (code === 4514) {
            return { code: 45, parameters: [this.makeRouteSetImageZxcScript('$003_2', 0, 2)] };
        } else if (code === 4511) {
            return { code: 45, parameters: [this.makeRouteSetImageAndStartFrameAnimationScript('$003_2', 0, 2, '[8,9,10]', 6, false)] };
        } else if (code === 4512) {
            return { code: 45, parameters: [this.makeRouteLocateFollowerAndDirectionScript(1, 6)] };
        } else if (code === 4519) {
            return { code: 45, parameters: [this.makeRouteGoToFollowerScript(1)] };
        } else if (code === 4513) {
            return { code: 45, parameters: [this.makeRouteStartMaskFadeOutScript(70)] };
        } else if (code === 4515) {
            return { code: 45, parameters: [this.makeRouteShiverControlScript('startGatagata')] };
        } else if (code === 4516) {
            return { code: 45, parameters: [this.makeRouteShiverControlScript('stopGatagata')] };
        } else if (code === 4517) {
            return { code: 45, parameters: [this.makeRouteShiverControlScript('startShiverX')] };
        } else if (code === 4518) {
            return { code: 45, parameters: [this.makeRouteShiverControlScript('stopShiverX')] };
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
            p = ['', 0];
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

    EE.prototype.renderRouteCommandColumn = function(parent, list) {
        if (!parent) return;
        parent.innerHTML = '';
        var self = this;
        var items = Array.isArray(list) ? list : [];
        for (var i = 0; i < items.length; i++) {
            (function(it) {
                if (!it) return;
                var b = self.el('button', 'rmcbtn', String(it.label || ''));
                b.type = 'button';
                b.addEventListener('click', function() {
                    var rc = self.makeMoveRouteCommandByCode(Number(it.code || 0));
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
            var prevLen = Array.isArray(tr.commands) ? tr.commands.length : 0;
            this.addCmd({
                code: 205,
                indent: 0,
                parameters: [charId, { repeat: false, skippable: false, wait: false, list: [clone(routeCmd), { code: 0, parameters: [] }] }]
            }, frame);
            if (!Array.isArray(tr.commands) || tr.commands.length <= prevLen || !this.selUid) return null;
            return { uid: this.selUid, routeListIndex: 0 };
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
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
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
        case 356: cmd.parameters = ['']; break;
        default:
            cmd.parameters = [];
            break;
        }
        return cmd;
    };

    EE.prototype.waitDurationFieldInfoForCommand = function(cmd) {
        if (!cmd) return null;
        var code = Math.floor(Number(cmd.code || 0));
        if (code === 223) return { durationIndex: 1, waitIndex: 2, minFrames: 1 };
        if (code === 224) return { durationIndex: 1, waitIndex: 2, minFrames: 1 };
        if (code === 225) return { durationIndex: 2, waitIndex: 3, minFrames: 1 };
        if (code === 232) {
            var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
            var isV12 = p.length >= 12;
            return { durationIndex: isV12 ? 10 : 9, waitIndex: isV12 ? 11 : 10, minFrames: 1 };
        }
        if (code === 234) return { durationIndex: 2, waitIndex: 3, minFrames: 1 };
        if (code === 236) return { durationIndex: 2, waitIndex: 3, minFrames: 1 };
        return null;
    };

    EE.prototype.maxWaitFramesBeforeNextConflict = function(tr, rowKey, frame, ignoreUid) {
        if (!tr || !rowKey) return -1;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var limit = -1;
        for (var i = 0; i < tr.commands.length; i++) {
            var o = tr.commands[i];
            if (!o || o.uid === ignoreUid) continue;
            var ork = o.rowKey || (o.rowType === 'char' ? ('char:' + o.charId) : 'main');
            if (ork !== rowKey) continue;
            var os = Math.max(0, Math.floor(Number(o.frame || 0)));
            var ow = Math.max(0, Math.floor(Number(o.wait || 0)));
            var oe = os + ow;
            if (frame >= os && frame <= oe) return -1;
            if (os > frame) {
                var gap = os - frame - 1;
                if (limit < 0 || gap < limit) limit = gap;
            }
        }
        return Math.max(-1, Math.floor(limit));
    };

    EE.prototype.applyAddEntryWaitFit = function(tr, entry) {
        if (!tr || !entry || !entry.command) return false;
        var info = this.waitDurationFieldInfoForCommand(entry.command);
        if (!info) return false;
        var p = entry.command.parameters;
        if (!Array.isArray(p)) return false;
        var wIdx = Math.floor(Number(info.waitIndex || 0));
        if (wIdx >= 0 && !p[wIdx]) return false;
        var maxFit = this.maxWaitFramesBeforeNextConflict(tr, entry.rowKey, entry.frame, entry.uid);
        if (maxFit < Math.max(1, Math.floor(Number(info.minFrames || 1)))) return false;
        var oldParams = clone(p);
        var oldWait = Math.max(0, Math.floor(Number(entry.wait || 0)));
        p[Math.floor(Number(info.durationIndex || 0))] = maxFit;
        entry.wait = this.commandWaitFrames(entry.command);
        if (entry.wait < 1 || !this.canPlaceEntry(tr, entry, entry.frame, entry.rowKey, entry.uid)) {
            entry.command.parameters = oldParams;
            entry.wait = oldWait;
            return false;
        }
        entry._pendingWaitMaxFrames = maxFit;
        return true;
    };

    EE.prototype.applyCommandAddWithPlacement = function(tr, entry, placement, options) {
        if (!tr || !entry) return false;
        options = options || {};
        placement = this.resolveAddPlacementContext(placement, entry.frame);
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
            var keepMap = Object.create(null);
            if (anchorIdx >= 0 && (placement.mode === 'before' || placement.mode === 'after')) {
                var keepCount = (placement.mode === 'before') ? anchorIdx : (anchorIdx + 1);
                for (var ki = 0; ki < keepCount && ki < sameFrameOrdered.length; ki++) {
                    keepMap[Math.floor(Number(sameFrameOrdered[ki].uid || 0))] = true;
                }
            }
            for (var si = 0; si < tr.commands.length; si++) {
                var se = tr.commands[si];
                if (!se) continue;
                var sf = Math.max(0, Math.floor(Number(se.frame || 0)));
                var su = Math.floor(Number(se.uid || 0));
                var shift = false;
                if (sf > targetFrame) shift = true;
                else if (sf === targetFrame && !keepMap[su]) shift = true;
                if (shift) se.frame = sf + waitFrames;
            }
            if (Math.max(0, Math.floor(Number(this.frame || 0))) >= targetFrame) this.frame += waitFrames;
            this.shiftRangeSelectionAfterWaitInsert(targetFrame, waitFrames);
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
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        if (entry.rowType === 'char') this.confirmCharRowPermanent(entry.charId);
        this.selUid = entry.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(entry.frame, entry.wait);
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.timelineDirty = true;
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
                tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
            }
            return false;
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
        var needsEditor = this.eventCommandNeedsEditorOnAdd(Number(code || 0), cmd);
        if (!needsEditor) {
            this.applyCommandAddWithPlacement(tr, e, placement, { skipSnapshot: false });
            return;
        }
        e._pendingAddPlacement = clone(placement);
        e.frame = this.computeAddFrameFromPlacementContext(placement, e.wait);
        tr.commands.push(e);
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
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

    EE.prototype.paramToEditText = function(v) {
        if (typeof v === 'string') return v;
        if (v === null) return 'null';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        try { return JSON.stringify(v); } catch (_) { return String(v); }
    };

    EE.prototype.parseEditParamText = function(s, idx) {
        var t = String(s == null ? '' : s);
        var tr = t.trim();
        if (!tr.length) return '';
        if (tr === 'true') return true;
        if (tr === 'false') return false;
        if (tr === 'null') return null;
        if (/^-?\d+(\.\d+)?$/.test(tr)) return Number(tr);
        var c0 = tr.charAt(0);
        if (c0 === '{' || c0 === '[' || c0 === '"') {
            try { return JSON.parse(tr); } catch (e) {
                throw new Error('param' + (idx + 1) + ' JSON parse error: ' + e.message);
            }
        }
        return t;
    };

    EE.prototype.renderParamEditors = function(params) {
        params = Array.isArray(params) ? params : [];
        this.edParamInputs = [];
        if (!this.edParamList) return;
        this.edParamList.innerHTML = '';
        if (!params.length) {
            this.edParamList.appendChild(this.el('div', 'pempty', '(パラメータなし)'));
            return;
        }
        for (var i = 0; i < params.length; i++) {
            var row = this.el('div', 'prow');
            row.appendChild(this.el('div', 'plbl', 'param' + (i + 1)));
            var inp = this.el('textarea', '');
            inp.value = this.paramToEditText(params[i]);
            inp.rows = (typeof params[i] === 'string' && String(params[i]).indexOf('\n') >= 0) ? 3 : 2;
            row.appendChild(inp);
            this.edParamList.appendChild(row);
            this.edParamInputs.push(inp);
        }
    };

    EE.prototype.collectParamEditors = function() {
        var out = [];
        var ins = this.edParamInputs || [];
        for (var i = 0; i < ins.length; i++) out.push(this.parseEditParamText(ins[i].value, i));
        return out;
    };

    EE.prototype.getCachedSchemaOptions = function(key, builder) {
        if (!this._schemaOptionCache) this._schemaOptionCache = {};
        if (Object.prototype.hasOwnProperty.call(this._schemaOptionCache, key)) return this._schemaOptionCache[key];
        var out = [];
        try { out = builder.call(this) || []; } catch (_) { out = []; }
        this._schemaOptionCache[key] = out;
        return out;
    };

    EE.prototype.actorOptionsForSchema = function() {
        return this.getCachedSchemaOptions('actors', function() {
            var out = [];
            var arr = ($dataActors && Array.isArray($dataActors)) ? $dataActors : [];
            for (var i = 1; i < arr.length; i++) {
                var a = arr[i];
                if (!a) continue;
                var id = Number(a.id || i);
                var nm = String(a.name || ('Actor ' + id));
                out.push({ value: id, label: ('0000' + id).slice(-4) + ' ' + nm });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
    };

    EE.prototype.variableOptionsForSchema = function() {
        return this.getCachedSchemaOptions('variables', function() {
            var out = [];
            var arr = ($dataSystem && Array.isArray($dataSystem.variables)) ? $dataSystem.variables : [];
            for (var i = 1; i < arr.length; i++) {
                var nm = String(arr[i] || '');
                if (!nm.length) nm = '(未設定)';
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + nm });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
    };

    EE.prototype.commonEventOptionsForSchema = function() {
        return this.getCachedSchemaOptions('commonEvents', function() {
            var out = [];
            var arr = ($dataCommonEvents && Array.isArray($dataCommonEvents)) ? $dataCommonEvents : [];
            for (var i = 1; i < arr.length; i++) {
                var ce = arr[i];
                if (!ce) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(ce.name || '(名称なし)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
    };

    EE.prototype.itemTypeOptionsForSchema = function() {
        return [
            { value: 1, label: '通常アイテム' },
            { value: 2, label: '大事なもの' },
            { value: 3, label: '隠しアイテムA' },
            { value: 4, label: '隠しアイテムB' }
        ];
    };

    EE.prototype.buttonOptionsForSchema = function() {
        return [
            { value: 'ok', label: '決定 (ok)' },
            { value: 'cancel', label: 'キャンセル (cancel)' },
            { value: 'shift', label: 'Shift (shift)' },
            { value: 'control', label: 'Ctrl (control)' },
            { value: 'tab', label: 'Tab (tab)' },
            { value: 'pageup', label: 'PageUp (pageup)' },
            { value: 'pagedown', label: 'PageDown (pagedown)' },
            { value: 'up', label: '上 (up)' },
            { value: 'down', label: '下 (down)' },
            { value: 'left', label: '左 (left)' },
            { value: 'right', label: '右 (right)' }
        ];
    };

    EE.prototype.labelOptionsForSchema = function() {
        var out = [];
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return out;
        var used = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 118) continue;
            var name = String((e.command.parameters || [''])[0] || '');
            if (!name.length || used[name]) continue;
            used[name] = true;
            out.push({ value: name, label: name });
        }
        return out;
    };

    EE.prototype.mapInfoOptionsForSchema = function() {
        return this.getCachedSchemaOptions('mapInfos', function() {
            var out = [];
            var infos = $dataMapInfos || {};
            var keys = Object.keys(infos).map(function(k) { return Number(k); }).filter(function(n) { return !isNaN(n) && n > 0; });
            keys.sort(function(a, b) { return a - b; });
            for (var i = 0; i < keys.length; i++) {
                var id = keys[i];
                var it = infos[id];
                if (!it) continue;
                out.push({ value: id, label: ('0000' + id).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no map)' });
            return out;
        });
    };

    EE.prototype.tilesetOptionsForSchema = function() {
        return this.getCachedSchemaOptions('tilesets', function() {
            var out = [];
            var arr = ($dataTilesets && Array.isArray($dataTilesets)) ? $dataTilesets : [];
            for (var i = 1; i < arr.length; i++) {
                var ts = arr[i];
                if (!ts) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(ts.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no tileset)' });
            return out;
        });
    };

    EE.prototype.enemyOptionsForSchema = function() {
        return this.getCachedSchemaOptions('enemies', function() {
            var out = [];
            var arr = ($dataEnemies && Array.isArray($dataEnemies)) ? $dataEnemies : [];
            for (var i = 1; i < arr.length; i++) {
                var e = arr[i];
                if (!e) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(e.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no enemy)' });
            return out;
        });
    };

    EE.prototype.stateOptionsForSchema = function() {
        return this.getCachedSchemaOptions('states', function() {
            var out = [];
            var arr = ($dataStates && Array.isArray($dataStates)) ? $dataStates : [];
            for (var i = 1; i < arr.length; i++) {
                var s = arr[i];
                if (!s) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(s.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no state)' });
            return out;
        });
    };

    EE.prototype.animationOptionsForSchema = function() {
        return this.getCachedSchemaOptions('animations', function() {
            var out = [];
            var arr = ($dataAnimations && Array.isArray($dataAnimations)) ? $dataAnimations : [];
            for (var i = 1; i < arr.length; i++) {
                var a = arr[i];
                if (!a) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(a.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no animation)' });
            return out;
        });
    };

    EE.prototype.itemOptionsForSchema = function() {
        return this.getCachedSchemaOptions('items', function() {
            var out = [];
            var arr = ($dataItems && Array.isArray($dataItems)) ? $dataItems : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no item)' });
            return out;
        });
    };

    EE.prototype.weaponOptionsForSchema = function() {
        return this.getCachedSchemaOptions('weapons', function() {
            var out = [];
            var arr = ($dataWeapons && Array.isArray($dataWeapons)) ? $dataWeapons : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no weapon)' });
            return out;
        });
    };

    EE.prototype.armorOptionsForSchema = function() {
        return this.getCachedSchemaOptions('armors', function() {
            var out = [];
            var arr = ($dataArmors && Array.isArray($dataArmors)) ? $dataArmors : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no armor)' });
            return out;
        });
    };

    EE.prototype.skillOptionsForSchema = function() {
        return this.getCachedSchemaOptions('skills', function() {
            var out = [];
            var arr = ($dataSkills && Array.isArray($dataSkills)) ? $dataSkills : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no skill)' });
            return out;
        });
    };

    EE.prototype.classOptionsForSchema = function() {
        return this.getCachedSchemaOptions('classes', function() {
            var out = [];
            var arr = ($dataClasses && Array.isArray($dataClasses)) ? $dataClasses : [];
            for (var i = 1; i < arr.length; i++) {
                var it = arr[i];
                if (!it) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(it.name || '(no name)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no class)' });
            return out;
        });
    };

    EE.prototype.equipTypeOptionsForSchema = function() {
        return this.getCachedSchemaOptions('equipTypes', function() {
            var out = [];
            var arr = ($dataSystem && Array.isArray($dataSystem.equipTypes)) ? $dataSystem.equipTypes : [];
            for (var i = 1; i < arr.length; i++) {
                var nm = String(arr[i] || '');
                if (!nm.length) nm = '(未設定)';
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + nm });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (未設定)' });
            return out;
        });
    };

    EE.prototype.characterTargetOptionsForSchema = function(withPlayer, withThisEvent) {
        var mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? Number($gameMap.mapId() || 0) : 0;
        var cacheKey = 'charTargets:' + mapId + ':' + (withPlayer !== false ? '1' : '0') + ':' + (withThisEvent !== false ? '1' : '0');
        return this.getCachedSchemaOptions(cacheKey, function() {
            var out = [];
            if (withPlayer !== false) out.push({ value: -1, label: '-1 プレイヤー' });
            if (withThisEvent !== false) out.push({ value: 0, label: '0 このイベント' });
            var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
            for (var i = 1; i < evs.length; i++) {
                var ev = evs[i];
                if (!ev) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(ev.name || '(no event)') });
            }
            if (!out.length) out.push({ value: 0, label: '0 このイベント' });
            return out;
        });
    };

    EE.prototype.balloonOptionsForSchema = function() {
        return [
            { value: 1, label: 'びっくり' },
            { value: 2, label: 'はてな' },
            { value: 3, label: '音符' },
            { value: 4, label: 'ハート' },
            { value: 5, label: '怒り' },
            { value: 6, label: '汗' },
            { value: 7, label: 'くしゃくしゃ' },
            { value: 8, label: '沈黙' },
            { value: 9, label: '電球' },
            { value: 10, label: 'zzz' }
        ];
    };

    EE.prototype.troopOptionsForSchema = function() {
        return this.getCachedSchemaOptions('troops', function() {
            var out = [];
            var arr = ($dataTroops && Array.isArray($dataTroops)) ? $dataTroops : [];
            for (var i = 1; i < arr.length; i++) {
                var t = arr[i];
                if (!t) continue;
                out.push({ value: i, label: ('0000' + i).slice(-4) + ' ' + String(t.name || '(no troop)') });
            }
            if (!out.length) out.push({ value: 1, label: '0001 (no troop)' });
            return out;
        });
    };

    EE.prototype.vehicleTypeOptionsForSchema = function() {
        return [
            { value: 0, label: '小型船' },
            { value: 1, label: '大型船' },
            { value: 2, label: '飛行船' }
        ];
    };

    EE.prototype.linesFromText = function(text, keepEmpty) {
        var s = String(text == null ? '' : text);
        if (!s.length) return keepEmpty ? [''] : [];
        var lines = s.split(/\r?\n/);
        while (lines.length > 0 && String(lines[lines.length - 1] || '').length === 0) lines.pop();
        if (!keepEmpty) {
            var out = [];
            for (var i = 0; i < lines.length; i++) {
                var t = String(lines[i] || '');
                if (t.length) out.push(t);
            }
            return out;
        }
        return lines;
    };

    EE.prototype.normalizeMessageWindowType = function(v) {
        v = Math.floor(Number(v || 0));
        if (v === -1 || v === 0 || v === 1 || v === 2) return v;
        return -1;
    };

    EE.prototype.normalizeMessageTailDir = function(v) {
        v = Math.floor(Number(v || 0));
        if (v < 1) return 1;
        if (v > 9) return 9;
        return v;
    };

    EE.prototype.normalizeMessageTargetCharId = function(v) {
        v = Math.floor(Number(v || 0));
        if (v === -1) return -1;
        if (v > 0) return v;
        return 0;
    };

    EE.prototype.sanitizeMessageExtState = function(st) {
        st = st || {};
        var mode = (String(st.targetMode || '') === 'coord') ? 'coord' : 'char';
        var x = Number(st.targetX == null ? 0 : st.targetX);
        var y = Number(st.targetY == null ? 0 : st.targetY);
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;
        return {
            windowType: this.normalizeMessageWindowType(st.windowType),
            tailDir: this.normalizeMessageTailDir(st.tailDir == null ? 5 : st.tailDir),
            targetMode: mode,
            targetCharId: this.normalizeMessageTargetCharId(st.targetCharId),
            targetX: Math.round(x),
            targetY: Math.round(y)
        };
    };

    EE.prototype.copyMessageExtState = function(st) {
        return this.sanitizeMessageExtState(st || {});
    };

    EE.prototype.defaultMessageExtState = function() {
        var st = {
            windowType: -1,
            tailDir: 5,
            targetMode: 'char',
            targetCharId: 0,
            targetX: 0,
            targetY: 0
        };
        try {
            if ($gameVariables && typeof $gameVariables.value === 'function') st.windowType = Number($gameVariables.value(14));
        } catch (_) {}
        try {
            if ($gameMessage) st.tailDir = Number($gameMessage._tailDir == null ? 5 : $gameMessage._tailDir);
        } catch (_) {}
        try {
            if ($gameSystem && typeof $gameSystem.getMessagePopupFree === 'function') {
                var fr = $gameSystem.getMessagePopupFree();
                if (fr && fr.x != null && fr.y != null) {
                    st.targetMode = 'coord';
                    st.targetX = Number(fr.x || 0);
                    st.targetY = Number(fr.y || 0);
                }
            }
        } catch (_) {}
        if (st.targetMode !== 'coord') {
            try {
                if ($gameSystem && $gameSystem._messagePopupCharacterId != null) {
                    st.targetCharId = this.normalizeMessageTargetCharId(Number($gameSystem._messagePopupCharacterId || 0));
                }
            } catch (_) {}
        }
        return this.sanitizeMessageExtState(st);
    };

    EE.prototype.findEventIdByMessageTargetName = function(name) {
        var t = String(name == null ? '' : name).trim();
        if (!t.length) return 0;
        var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
        for (var i = 1; i < evs.length; i++) {
            var ev = evs[i];
            if (!ev) continue;
            if (String(ev.name || '') === t) return i;
        }
        return 0;
    };

    EE.prototype.messageTargetTokenForOutput = function(charId) {
        var cid = this.normalizeMessageTargetCharId(charId);
        if (cid <= 0) return String(cid);
        var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[cid] : null;
        var name = ev && ev.name ? String(ev.name) : '';
        return name.length ? name : String(cid);
    };

    EE.prototype.stripTrailingLineComment = function(line) {
        var s = String(line == null ? '' : line);
        var idx = s.indexOf('//');
        if (idx >= 0) s = s.slice(0, idx);
        return s.trim();
    };

    EE.prototype.singleScriptCodeLineFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return '';
        var lines = [];
        if (Array.isArray(entry.scriptLines) && entry.scriptLines.length) lines = entry.scriptLines.slice(0);
        else lines = [String((entry.command.parameters || [''])[0] || '')];
        var codeLines = [];
        for (var i = 0; i < lines.length; i++) {
            var ln = String(lines[i] || '').trim();
            if (!ln.length) continue;
            if (/^\/\//.test(ln)) continue;
            codeLines.push(ln);
        }
        if (codeLines.length !== 1) return '';
        return codeLines[0];
    };

    EE.prototype.parseCameraMoveScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var m = src.match(/^\$gameMap\.(scrollCamera|scrollCameraTo)\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s*;?$/i);
        if (!m) return null;
        var kindRaw = String(m[1] || '').toLowerCase();
        var kind = (kindRaw === 'scrollcamerato') ? 'scrollTo' : 'scroll';
        return {
            kind: kind,
            x: Number(m[2]),
            y: Number(m[3]),
            d: Math.max(1, Math.floor(Number(m[4]) || 1))
        };
    };

    EE.prototype.cameraMoveSpecFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 355) return null;
        var line = this.singleScriptCodeLineFromEntry(entry);
        if (!line.length) return null;
        return this.parseCameraMoveScriptLine(line);
    };

    EE.prototype.parseCharacterRequestAnimationScriptLine = function(scriptLine) {
        var src = this.stripTrailingLineComment(String(scriptLine == null ? '' : scriptLine)).trim();
        if (!src.length) return null;
        var m = src.match(/^this\.character\(\s*(-?\d+)\s*\)\.requestAnimation(?:Ex)?\(\s*(\d+)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*(?:,\s*([-+]?\d+(?:\.\d+)?)\s*)?)?)?\)\s*;?$/i);
        if (!m) return null;
        var targetId = this.normalizeMoveTarget(Number(m[1] || 0));
        var animationId = Math.max(1, Math.floor(Number(m[2] || 1) || 1));
        var addX = (m[3] == null) ? 0 : Number(m[3]);
        var addY = (m[4] == null) ? 0 : Number(m[4]);
        var scale = (m[5] == null) ? 1 : Number(m[5]);
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        return {
            targetId: targetId,
            animationId: animationId,
            addX: addX,
            addY: addY,
            scale: scale
        };
    };

    EE.prototype.animationRequestSpecFromEntry = function(entry) {
        if (!entry || !entry.command) return null;
        var cmd = entry.command;
        var code = Number(cmd.code || 0);
        if (code === 355) {
            var line = this.singleScriptCodeLineFromEntry(entry);
            if (!line.length) return null;
            return this.parseCharacterRequestAnimationScriptLine(line);
        }
        if (code === 212) {
            var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
            return {
                targetId: this.normalizeMoveTarget(Number(p[0] || 0)),
                animationId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                addX: 0,
                addY: 0,
                scale: 1,
                wait: !!p[2]
            };
        }
        return null;
    };

    EE.prototype.mainCommandDisplayCodeForEntry = function(entry) {
        if (!entry || !entry.command) return 0;
        var code = Number(entry.command.code || 0);
        if (code !== 355) return code;
        var camSpec = this.cameraMoveSpecFromEntry(entry);
        if (camSpec) return (camSpec.kind === 'scrollTo') ? 35551 : 35550;
        var animSpec = this.animationRequestSpecFromEntry(entry);
        if (animSpec) return 212;
        return code;
    };

    EE.prototype.makeCameraMoveScript = function(kind, x, y, duration) {
        var k = (String(kind || '') === 'scrollTo') ? 'scrollTo' : 'scroll';
        var fn = (k === 'scrollTo') ? 'scrollCameraTo' : 'scrollCamera';
        var sx = this.formatCoordText(Number(x || 0), 2, false);
        var sy = this.formatCoordText(Number(y || 0), 2, false);
        var d = Math.max(1, Math.floor(Number(duration || 60) || 60));
        return '$gameMap.' + fn + '(' + sx + ', ' + sy + ', ' + d + ')';
    };

    EE.prototype.makeCharacterRequestAnimationScript = function(targetId, animationId, addX, addY, scale) {
        var tid = this.normalizeMoveTarget(Number(targetId || 0));
        var aid = Math.max(1, Math.floor(Number(animationId || 1) || 1));
        var x = this.formatCoordText(Number(addX || 0), 2, false);
        var y = this.formatCoordText(Number(addY || 0), 2, false);
        var s = Number(scale == null ? 1 : scale);
        if (!isFinite(s) || s <= 0) s = 1;
        var sc = this.formatCoordText(s, 2, false);
        return 'this.character(' + tid + ').requestAnimation(' + aid + ', ' + x + ', ' + y + ', ' + sc + ')';
    };

    EE.prototype.messageSettingPatchFromEntry = function(entry) {
        if (!entry || !entry.command) return null;
        var cmd = entry.command;
        var code = Number(cmd.code || 0);
        var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
        if (code === 122) {
            var a = Math.floor(Number(p[0] || 0));
            var b = Math.floor(Number(p[1] || 0));
            var op = Math.floor(Number(p[2] || 0));
            var ot = Math.floor(Number(p[3] || 0));
            if (a === 14 && b === 14 && op === 0 && ot === 0) {
                return { windowType: Math.floor(Number(p[4] || 0)) };
            }
            return null;
        }
        if (code === 355) {
            var line = this.singleScriptCodeLineFromEntry(entry);
            if (!line.length) return null;
            var src = this.stripTrailingLineComment(line);
            var mTail = src.match(/^\$gameMessage\._tailDir\s*=\s*(-?\d+)\s*;?$/i);
            if (mTail) return { tailDir: Math.floor(Number(mTail[1] || 0)) };
            var mSet = src.match(/^\$gameSystem\.setMessagePopupFree\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*;?$/i);
            if (mSet) {
                return {
                    targetMode: 'coord',
                    targetX: Number(mSet[1]),
                    targetY: Number(mSet[2])
                };
            }
            if (/^\$gameSystem\.clearMessagePopupFree\(\s*\)\s*;?$/i.test(src)) {
                return { targetMode: 'char' };
            }
            return null;
        }
        if (code === 356) {
            var txt = String(p[0] || '').trim();
            if (txt.indexOf('フキダシウィンドウ有効化') !== 0) return null;
            var rest = txt.slice('フキダシウィンドウ有効化'.length).trim();
            if (!rest.length) return null;
            var parts = rest.split(/\s+/);
            var tok = String(parts[0] || '');
            if (!tok.length) return null;
            var cid = 0;
            if (/^-?\d+$/.test(tok)) cid = this.normalizeMessageTargetCharId(Number(tok));
            else {
                var evId = this.findEventIdByMessageTargetName(tok);
                if (!evId) return null;
                cid = this.normalizeMessageTargetCharId(evId);
            }
            return { targetMode: 'char', targetCharId: cid };
        }
        return null;
    };

    EE.prototype.applyMessageSettingPatch = function(state, patch) {
        state = this.sanitizeMessageExtState(state || {});
        if (!patch || typeof patch !== 'object') return state;
        if (Object.prototype.hasOwnProperty.call(patch, 'windowType')) state.windowType = this.normalizeMessageWindowType(patch.windowType);
        if (Object.prototype.hasOwnProperty.call(patch, 'tailDir')) state.tailDir = this.normalizeMessageTailDir(patch.tailDir);
        if (Object.prototype.hasOwnProperty.call(patch, 'targetMode')) {
            var mode = (String(patch.targetMode || '') === 'coord') ? 'coord' : 'char';
            state.targetMode = mode;
            if (mode === 'char' && Object.prototype.hasOwnProperty.call(patch, 'targetCharId')) {
                state.targetCharId = this.normalizeMessageTargetCharId(patch.targetCharId);
            }
            if (mode === 'coord') {
                var nx = Number(patch.targetX == null ? state.targetX : patch.targetX);
                var ny = Number(patch.targetY == null ? state.targetY : patch.targetY);
                if (isFinite(nx)) state.targetX = Math.round(nx);
                if (isFinite(ny)) state.targetY = Math.round(ny);
            }
        } else if (Object.prototype.hasOwnProperty.call(patch, 'targetCharId')) {
            state.targetMode = 'char';
            state.targetCharId = this.normalizeMessageTargetCharId(patch.targetCharId);
        }
        return this.sanitizeMessageExtState(state);
    };

    EE.prototype.messageExtStateAtPoint = function(tr, frame, uidLimit) {
        var st = this.defaultMessageExtState();
        if (!tr || !Array.isArray(tr.commands)) return st;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        uidLimit = (uidLimit == null) ? Infinity : Math.floor(Number(uidLimit || 0));
        var list = tr.commands.slice(0);
        list.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.command) continue;
            var ef = Math.max(0, Math.floor(Number(e.frame || 0)));
            var eu = Math.floor(Number(e.uid || 0));
            if (ef > frame) break;
            if (ef === frame && eu >= uidLimit) break;
            if (Number(e.command.code || 0) === 101 && e.messageExt) {
                st = this.sanitizeMessageExtState(e.messageExt);
                continue;
            }
            var pt = this.messageSettingPatchFromEntry(e);
            if (pt) st = this.applyMessageSettingPatch(st, pt);
        }
        return this.sanitizeMessageExtState(st);
    };

    EE.prototype.mergeMessageSettingsIntoShowTextEntries = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        var st = this.defaultMessageExtState();
        var remove = Object.create(null);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command) continue;
            var code = Number(e.command.code || 0);
            if (code === 101) {
                for (var j = i - 1; j >= 0; j--) {
                    var p = tr.commands[j];
                    if (!p) continue;
                    if (Number(p.frame || 0) !== Number(e.frame || 0)) break;
                    var pp = this.messageSettingPatchFromEntry(p);
                    if (!pp) continue;
                    remove[Math.floor(Number(p.uid || 0))] = true;
                }
                e.messageExt = this.sanitizeMessageExtState(st);
                st = this.sanitizeMessageExtState(e.messageExt);
                continue;
            }
            var patch = this.messageSettingPatchFromEntry(e);
            if (patch) st = this.applyMessageSettingPatch(st, patch);
        }
        tr.commands = tr.commands.filter(function(e2) {
            var u = Math.floor(Number(e2 && e2.uid || 0));
            return !remove[u];
        });
    };

    EE.prototype.messageExtCommandsFromEntry = function(entry) {
        if (!entry || Number((entry.command && entry.command.code) || 0) !== 101 || !entry.messageExt) return [];
        var ext = this.sanitizeMessageExtState(entry.messageExt);
        var indent = Math.max(0, Math.floor(Number((entry.command && entry.command.indent) || 0)));
        var out = [];
        out.push({ code: 122, indent: indent, parameters: [14, 14, 0, 0, Math.floor(Number(ext.windowType || 0))] });
        if (ext.targetMode === 'coord') {
            out.push({ code: 355, indent: indent, parameters: ['$gameSystem.setMessagePopupFree(' + Math.round(Number(ext.targetX || 0)) + ', ' + Math.round(Number(ext.targetY || 0)) + ')'] });
        } else {
            var tok = this.messageTargetTokenForOutput(ext.targetCharId);
            out.push({ code: 355, indent: indent, parameters: ['$gameSystem.clearMessagePopupFree()'] });
            out.push({ code: 356, indent: indent, parameters: ['フキダシウィンドウ有効化 ' + tok + ' 1'] });
        }
        out.push({ code: 355, indent: indent, parameters: ['$gameMessage._tailDir = ' + Math.floor(Number(ext.tailDir || 0))] });
        return out;
    };

    EE.prototype.messageExtDeltaForOutput = function(entry, prevState) {
        var prev = prevState ? this.sanitizeMessageExtState(prevState) : null;
        if (!entry || Number((entry.command && entry.command.code) || 0) !== 101 || !entry.messageExt) {
            return { commands: [], nextState: prev };
        }
        var ext = this.sanitizeMessageExtState(entry.messageExt);
        var indent = Math.max(0, Math.floor(Number((entry.command && entry.command.indent) || 0)));
        var out = [];
        if (!prev || prev.windowType !== ext.windowType) {
            out.push({ code: 122, indent: indent, parameters: [14, 14, 0, 0, Math.floor(Number(ext.windowType || 0))] });
        }
        var targetChanged = !prev || prev.targetMode !== ext.targetMode;
        if (!targetChanged) {
            if (ext.targetMode === 'coord') {
                targetChanged = (prev.targetX !== ext.targetX || prev.targetY !== ext.targetY);
            } else {
                targetChanged = (prev.targetCharId !== ext.targetCharId);
            }
        }
        if (targetChanged) {
            if (ext.targetMode === 'coord') {
                out.push({ code: 355, indent: indent, parameters: ['$gameSystem.setMessagePopupFree(' + Math.round(Number(ext.targetX || 0)) + ', ' + Math.round(Number(ext.targetY || 0)) + ')'] });
            } else {
                var tok = this.messageTargetTokenForOutput(ext.targetCharId);
                out.push({ code: 355, indent: indent, parameters: ['$gameSystem.clearMessagePopupFree()'] });
                out.push({ code: 356, indent: indent, parameters: ['フキダシウィンドウ有効化 ' + tok + ' 1'] });
            }
        }
        if (!prev || prev.tailDir !== ext.tailDir) {
            out.push({ code: 355, indent: indent, parameters: ['$gameMessage._tailDir = ' + Math.floor(Number(ext.tailDir || 0))] });
        }
        return { commands: out, nextState: ext };
    };

    EE.prototype.ensureEditorSchemas = function() {
        if (this._editorSchemas) return;
        this._editorSchemas = {};
        var self = this;
        function reg(code, schema) { self._editorSchemas[Number(code || 0)] = schema; }

        reg(35550, {
            code: 35550,
            commandCode: 355,
            script355: true,
            title: 'カメラ移動',
            description: '$gameMap.scrollCamera(x, y, d) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.1, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.1, compact: true },
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.cameraMoveSpecFromEntry(entry);
                if (!spec || spec.kind !== 'scroll') return { x: 0, y: 0, d: 60 };
                return { x: Number(spec.x || 0), y: Number(spec.y || 0), d: Math.max(1, Math.floor(Number(spec.d || 60))) };
            },
            toParams: function(state) {
                return [this.makeCameraMoveScript('scroll', Number(state.x || 0), Number(state.y || 0), Number(state.d || 60))];
            }
        });

        reg(35551, {
            code: 35551,
            commandCode: 355,
            script355: true,
            title: 'カメラ移動(直接指定)',
            description: '$gameMap.scrollCameraTo(x, y, d) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.1, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.1, compact: true },
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.cameraMoveSpecFromEntry(entry);
                if (!spec || spec.kind !== 'scrollTo') return { x: 0, y: 0, d: 60 };
                return { x: Number(spec.x || 0), y: Number(spec.y || 0), d: Math.max(1, Math.floor(Number(spec.d || 60))) };
            },
            toParams: function(state) {
                return [this.makeCameraMoveScript('scrollTo', Number(state.x || 0), Number(state.y || 0), Number(state.d || 60))];
            }
        });

        reg(303, {
            code: 303,
            title: '名前入力の処理',
            description: '対象アクターと最大文字数を設定します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 11, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'maxLength', type: 'number', label: '最大文字数', min: 1, max: 12, step: 1, hint: '入力できる文字数の上限' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), maxLength: Math.max(1, Math.floor(Number(p[1] || 8) || 8)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.actorId || 1) || 1)), Math.max(1, Math.floor(Number(state.maxLength || 8) || 8))];
            }
        });

        reg(301, {
            code: 301,
            title: '戦闘の処理',
            description: '戦闘する敵グループと敗北時挙動を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '敵グループ指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }, { value: 2, label: 'ランダムエンカウント' }] },
                { key: 'troopId', type: 'list', label: '敵グループ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.troopOptionsForSchema(); } },
                { key: 'troopVarId', type: 'list', label: '敵グループ変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'canEscape', type: 'bool', label: '逃走を許可' },
                { key: 'canLose', type: 'bool', label: '負けてもゲームオーバーにしない' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var mode = Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0)));
                return {
                    mode: mode,
                    troopId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    troopVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    canEscape: !!p[2],
                    canLose: !!p[3]
                };
            },
            toParams: function(state) {
                var mode = Math.max(0, Math.min(2, Math.floor(Number(state.mode || 0) || 0)));
                var ref = 0;
                if (mode === 0) ref = Math.max(1, Math.floor(Number(state.troopId || 1) || 1));
                else if (mode === 1) ref = Math.max(1, Math.floor(Number(state.troopVarId || 1) || 1));
                return [mode, ref, !!state.canEscape, !!state.canLose];
            }
        });

        reg(302, {
            code: 302,
            title: 'ショップの処理',
            description: '販売商品を1件分設定します（追加商品605は別コマンド）。',
            fields: [
                { key: 'goodsType', type: 'select', label: '商品種別', valueType: 'number', options: [{ value: 0, label: 'アイテム' }, { value: 1, label: '武器' }, { value: 2, label: '防具' }] },
                { key: 'goodsId', type: 'list', label: '商品ID', full: true, size: 10, search: true, valueType: 'number', options: function(state) {
                    var t = Math.max(0, Math.min(2, Math.floor(Number(state && state.goodsType || 0) || 0)));
                    if (t === 1) return self.weaponOptionsForSchema();
                    if (t === 2) return self.armorOptionsForSchema();
                    return self.itemOptionsForSchema();
                } },
                { key: 'priceType', type: 'select', label: '価格', valueType: 'number', options: [{ value: 0, label: '標準価格' }, { value: 1, label: '指定価格' }] },
                { key: 'price', type: 'number', label: '指定価格', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    goodsType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    goodsId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    priceType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    price: Math.max(0, Math.floor(Number(p[3] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.goodsType || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.goodsId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.priceType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.price || 0) || 0))
                ];
            }
        });

        reg(351, {
            code: 351,
            title: 'メニュー画面を開く',
            description: 'メニュー画面を開きます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(352, {
            code: 352,
            title: 'セーブ画面を開く',
            description: 'セーブ画面を開きます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(353, {
            code: 353,
            title: 'ゲームオーバー',
            description: 'ゲームオーバー画面へ遷移します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(354, {
            code: 354,
            title: 'タイトル画面に戻す',
            description: 'タイトル画面へ戻します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(132, {
            code: 132,
            title: '戦闘BGMの変更',
            description: '戦闘BGMを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(133, {
            code: 133,
            title: '勝利MEの変更',
            description: '勝利MEを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(139, {
            code: 139,
            title: '敗北MEの変更',
            description: '敗北MEを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(140, {
            code: 140,
            title: '乗り物BGMの変更',
            description: '指定乗り物のBGMを変更します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: function() { return self.vehicleTypeOptionsForSchema(); } },
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[1] && typeof p[1] === 'object') ? p[1] : self.emptyAudioParam();
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    {
                        name: String(state.name || ''),
                        volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                        pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                        pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                    }
                ];
            }
        });

        reg(134, {
            code: 134,
            title: 'セーブ禁止の変更',
            description: 'セーブの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'セーブ', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(135, {
            code: 135,
            title: 'メニュー禁止の変更',
            description: 'メニューの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'メニュー', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(136, {
            code: 136,
            title: 'エンカウント禁止の変更',
            description: 'エンカウントの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'エンカウント', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(137, {
            code: 137,
            title: '並び替え禁止の変更',
            description: '並び替えの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '並び替え', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(138, {
            code: 138,
            title: 'ウィンドウカラーの変更',
            description: 'ウィンドウカラー(色調)を変更します。',
            fields: [
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[0] && Array.isArray(p[0])) ? p[0] : [0, 0, 0, 0];
                return {
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [[
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                    Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                ]];
            }
        });

        reg(322, {
            code: 322,
            title: 'アクターの画像変更',
            description: 'アクターの歩行/顔/SV画像を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'characterName', type: 'text', label: '歩行グラフィック名', full: true },
                { key: 'characterIndex', type: 'number', label: '歩行インデックス', min: 0, max: 7, step: 1 },
                { key: 'faceName', type: 'text', label: '顔グラフィック名', full: true },
                { key: 'faceIndex', type: 'number', label: '顔インデックス', min: 0, max: 7, step: 1 },
                { key: 'battlerName', type: 'text', label: 'SVバトラー名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    characterName: String(p[1] || ''),
                    characterIndex: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0))),
                    faceName: String(p[3] || ''),
                    faceIndex: Math.max(0, Math.min(7, Math.floor(Number(p[4] || 0) || 0))),
                    battlerName: String(p[5] || '')
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.characterName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.characterIndex || 0) || 0))),
                    String(state.faceName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.faceIndex || 0) || 0))),
                    String(state.battlerName || '')
                ];
            }
        });

        reg(323, {
            code: 323,
            title: '乗り物の画像変更',
            description: '乗り物の歩行画像を変更します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: function() { return self.vehicleTypeOptionsForSchema(); } },
                { key: 'characterName', type: 'text', label: '歩行グラフィック名', full: true },
                { key: 'characterIndex', type: 'number', label: '歩行インデックス', min: 0, max: 7, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    characterName: String(p[1] || ''),
                    characterIndex: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    String(state.characterName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.characterIndex || 0) || 0)))
                ];
            }
        });

        reg(101, {
            code: 101,
            title: '文章の表示',
            description: '本文と、ウィンドウタイプ/しっぽ方向/ふきだし対象を設定します。',
            fields: [
                { key: 'text', type: 'textarea', label: '本文 (1行=401)', full: true, rows: 4 },
                { key: 'windowType', type: 'select', label: 'ウィンドウタイプ', valueType: 'number', options: [
                    { value: -1, label: '-1 四角' },
                    { value: 0, label: '0 ふきだし' },
                    { value: 1, label: '1 ギザギザふきだし' },
                    { value: 2, label: '2 思考ふきだし' }
                ] },
                { key: 'targetMode', type: 'select', label: 'ふきだし対象', options: [
                    { value: 'char', label: 'キャラ' },
                    { value: 'coord', label: '座標' }
                ] },
                { key: 'tailDir', type: 'taildir', label: 'しっぽ方向', compact: true },
                { key: 'targetCharId', type: 'list', label: '対象キャラ', full: true, size: 10, search: true, valueType: 'number',
                    visibleWhen: { key: 'targetMode', eq: 'char' },
                    options: function() { return self.characterTargetOptionsForSchema(true, true); }
                },
                { key: 'targetX', type: 'number', label: '画面X(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } },
                { key: 'targetY', type: 'number', label: '画面Y(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } }
            ],
            fromEntry: function(entry) {
                var lines = Array.isArray(entry && entry.messageLines) ? entry.messageLines : [];
                var tr = entry ? self.ensureTrack(entry.eventId, entry.pageIndex) : null;
                var st = entry && entry.messageExt
                    ? self.sanitizeMessageExtState(entry.messageExt)
                    : self.messageExtStateAtPoint(tr, entry ? entry.frame : 0, entry ? entry.uid : Infinity);
                return {
                    text: lines.join('\n'),
                    windowType: st.windowType,
                    tailDir: st.tailDir,
                    targetMode: st.targetMode,
                    targetCharId: st.targetCharId,
                    targetX: st.targetX,
                    targetY: st.targetY
                };
            },
            toParams: function(state, source) {
                var p = (source && source.command && Array.isArray(source.command.parameters))
                    ? clone(source.command.parameters)
                    : ['', 0, 0, 2];
                if (!Array.isArray(p) || p.length < 4) p = ['', 0, 0, 2];
                return p;
            },
            applyEntry: function(entry, state) {
                entry.isMessage = true;
                entry.messageLines = self.linesFromText(state && state.text, true);
                entry.messageExt = self.sanitizeMessageExtState({
                    windowType: state && state.windowType,
                    tailDir: state && state.tailDir,
                    targetMode: state && state.targetMode,
                    targetCharId: state && state.targetCharId,
                    targetX: state && state.targetX,
                    targetY: state && state.targetY
                });
            }
        });

        reg(102, {
            code: 102,
            title: '選択肢の表示',
            description: '選択肢の文言と、既定/キャンセル/表示位置を設定します。',
            fields: [
                { key: 'choicesText', type: 'textarea', label: '選択肢 (1行=1択)', full: true, rows: 7 },
                { key: 'defaultType', type: 'number', label: '既定選択(0開始)', min: 0, step: 1 },
                { key: 'cancelType', type: 'number', label: 'キャンセル(-1禁止 / -2分岐)', min: -2, step: 1 },
                { key: 'positionType', type: 'select', label: 'ウィンドウ位置', valueType: 'number', options: [{ value: 0, label: '左' }, { value: 1, label: '中' }, { value: 2, label: '右' }] },
                { key: 'background', type: 'select', label: '背景', valueType: 'number', options: [{ value: 0, label: 'ウィンドウ' }, { value: 1, label: '暗くする' }, { value: 2, label: '透明' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var cs = Array.isArray(p[0]) ? p[0] : [];
                return {
                    choicesText: cs.join('\n'),
                    cancelType: Number(p[1] == null ? -2 : p[1]),
                    defaultType: Number(p[2] == null ? 0 : p[2]),
                    positionType: Number(p[3] == null ? 2 : p[3]),
                    background: Number(p[4] == null ? 0 : p[4])
                };
            },
            toParams: function(state) {
                var cs = self.linesFromText(state.choicesText, true);
                if (!cs.length) cs = ['選択肢1'];
                if (cs.length > 6) cs = cs.slice(0, 6);
                var def = Math.max(0, Math.floor(Number(state.defaultType || 0) || 0));
                if (def >= cs.length) def = 0;
                var cancel = Math.floor(Number(state.cancelType == null ? -2 : state.cancelType) || 0);
                if (cancel >= cs.length) cancel = -2;
                if (cancel < -2) cancel = -2;
                return [
                    cs,
                    cancel,
                    def,
                    Math.max(0, Math.min(2, Math.floor(Number(state.positionType || 2) || 0))),
                    Math.max(0, Math.min(2, Math.floor(Number(state.background || 0) || 0)))
                ];
            }
        });

        reg(103, {
            code: 103,
            title: '数値入力の処理',
            description: '入力先の変数と桁数を設定します。',
            fields: [
                { key: 'variableId', type: 'list', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'digits', type: 'number', label: '桁数', min: 1, max: 8, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), digits: Math.max(1, Math.floor(Number(p[1] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.variableId || 1) || 1)), Math.max(1, Math.min(8, Math.floor(Number(state.digits || 1) || 1)))];
            }
        });

        reg(104, {
            code: 104,
            title: 'アイテム選択の処理',
            description: '選択したアイテムIDを変数に格納します。',
            fields: [
                { key: 'variableId', type: 'list', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'itemType', type: 'select', label: '対象アイテム種別', valueType: 'number', options: function() { return self.itemTypeOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), itemType: Math.max(1, Math.min(4, Math.floor(Number(p[1] || 2) || 2))) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.variableId || 1) || 1)), Math.max(1, Math.min(4, Math.floor(Number(state.itemType || 2) || 2)))];
            }
        });

        reg(105, {
            code: 105,
            title: '文章のスクロール表示',
            description: 'スクロール速度と本文を設定します。',
            fields: [
                { key: 'speed', type: 'number', label: 'スクロール速度', min: 1, max: 8, step: 1 },
                { key: 'noFast', type: 'bool', label: '早送り禁止' },
                { key: 'text', type: 'textarea', label: '本文 (1行=405)', full: true, rows: 10 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var lines = Array.isArray(entry && entry.scrollLines) ? entry.scrollLines : [];
                return { speed: Math.max(1, Math.floor(Number(p[0] || 2) || 2)), noFast: !!p[1], text: lines.join('\n') };
            },
            toParams: function(state) {
                return [Math.max(1, Math.min(8, Math.floor(Number(state.speed || 2) || 2))), !!state.noFast];
            },
            applyEntry: function(entry, state) {
                entry.isScrollMessage = true;
                entry.scrollLines = self.linesFromText(state.text, true);
            }
        });

        reg(122, {
            code: 122,
            title: '変数の操作',
            description: '範囲・演算・オペランドを設定します（主要形式を対応）。',
            fields: [
                { key: 'scopeType', type: 'select', label: '対象', valueType: 'number', options: [{ value: 0, label: '単独' }, { value: 1, label: '範囲' }] },
                { key: 'fromVar', type: 'list', label: '開始変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'toVar', type: 'list', label: '終了変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'opType', type: 'select', label: '演算', valueType: 'number', options: [{ value: 0, label: '代入' }, { value: 1, label: '加算' }, { value: 2, label: '減算' }, { value: 3, label: '乗算' }, { value: 4, label: '除算' }, { value: 5, label: '剰余' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }, { value: 2, label: '乱数' }, { value: 3, label: 'ゲームデータ' }, { value: 4, label: 'スクリプト' }] },
                { key: 'constValue', type: 'number', label: '定数値', step: 1 },
                { key: 'operandVarId', type: 'list', label: '参照変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'randMin', type: 'number', label: '乱数最小', step: 1 },
                { key: 'randMax', type: 'number', label: '乱数最大', step: 1 },
                { key: 'gameDataType', type: 'number', label: 'ゲームデータ種別ID', min: 0, step: 1, hint: '必要時のみ。詳細はMV仕様準拠。' },
                { key: 'gameDataP1', type: 'number', label: 'ゲームデータparam1', step: 1 },
                { key: 'gameDataP2', type: 'number', label: 'ゲームデータparam2', step: 1 },
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 4 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = Math.max(1, Math.floor(Number(p[0] || 1) || 1));
                var b = Math.max(1, Math.floor(Number(p[1] || a) || a));
                return {
                    scopeType: (a === b ? 0 : 1),
                    fromVar: a,
                    toVar: b,
                    opType: Math.max(0, Math.min(5, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(4, Math.floor(Number(p[3] || 0) || 0))),
                    constValue: Math.floor(Number(p[4] || 0) || 0),
                    operandVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1)),
                    randMin: Math.floor(Number(p[4] || 0) || 0),
                    randMax: Math.floor(Number(p[5] || 0) || 0),
                    gameDataType: Math.floor(Number(p[4] || 0) || 0),
                    gameDataP1: Math.floor(Number(p[5] || 0) || 0),
                    gameDataP2: Math.floor(Number(p[6] || 0) || 0),
                    script: String(p[4] || '')
                };
            },
            toParams: function(state) {
                var a = Math.max(1, Math.floor(Number(state.fromVar || 1) || 1));
                var b = Math.max(1, Math.floor(Number(state.toVar || a) || a));
                if (Number(state.scopeType || 0) === 0) b = a;
                if (a > b) { var t = a; a = b; b = t; }
                var op = Math.max(0, Math.min(5, Math.floor(Number(state.opType || 0) || 0)));
                var ot = Math.max(0, Math.min(4, Math.floor(Number(state.operandType || 0) || 0)));
                if (ot === 0) return [a, b, op, 0, Math.floor(Number(state.constValue || 0) || 0)];
                if (ot === 1) return [a, b, op, 1, Math.max(1, Math.floor(Number(state.operandVarId || 1) || 1))];
                if (ot === 2) {
                    var mn = Math.floor(Number(state.randMin || 0) || 0);
                    var mx = Math.floor(Number(state.randMax || 0) || 0);
                    if (mn > mx) { var tt = mn; mn = mx; mx = tt; }
                    return [a, b, op, 2, mn, mx];
                }
                if (ot === 3) return [a, b, op, 3, Math.floor(Number(state.gameDataType || 0) || 0), Math.floor(Number(state.gameDataP1 || 0) || 0), Math.floor(Number(state.gameDataP2 || 0) || 0)];
                return [a, b, op, 4, String(state.script || '')];
            }
        });

        reg(123, {
            code: 123,
            title: 'セルフスイッチの操作',
            description: '現在イベントのセルフスイッチを操作します。',
            fields: [
                { key: 'selfSwitch', type: 'select', label: 'セルフスイッチ', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }] },
                { key: 'value', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { selfSwitch: String(p[0] || 'A'), value: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))) };
            },
            toParams: function(state) {
                var ss = String(state.selfSwitch || 'A').toUpperCase();
                if (!/^[ABCD]$/.test(ss)) ss = 'A';
                return [ss, Math.max(0, Math.min(1, Math.floor(Number(state.value || 0) || 0)))];
            }
        });

        reg(124, {
            code: 124,
            title: 'タイマーの操作',
            description: '開始/停止と開始時秒数を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '開始' }, { value: 1, label: '停止' }] },
                { key: 'seconds', type: 'number', label: '秒数(開始時)', min: 1, max: 5999, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))), seconds: Math.max(1, Math.floor(Number(p[1] || 60) || 60)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0))), Math.max(1, Math.floor(Number(state.seconds || 60) || 60))];
            }
        });

        reg(117, {
            code: 117,
            title: 'コモンイベント',
            description: '実行するコモンイベントを選択します。',
            fields: [{ key: 'commonEventId', type: 'list', label: 'コモンイベント', full: true, size: 11, search: true, valueType: 'number', options: function() { return self.commonEventOptionsForSchema(); } }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { commonEventId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) { return [Math.max(1, Math.floor(Number(state.commonEventId || 1) || 1))]; }
        });

        reg(118, {
            code: 118,
            title: 'ラベル',
            description: 'ラベル名を設定します。',
            fields: [{ key: 'labelName', type: 'text', label: 'ラベル名' }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { labelName: String(p[0] || '') };
            },
            toParams: function(state) { return [String(state.labelName || '')]; }
        });

        reg(119, {
            code: 119,
            title: 'ラベルジャンプ',
            description: '移動先ラベル名を設定します。',
            fields: [
                { key: 'jumpLabel', type: 'list', label: 'ラベル一覧', full: true, size: 8, search: true, options: function() { return self.labelOptionsForSchema(); } },
                { key: 'jumpLabelText', type: 'text', label: 'ジャンプ先ラベル名', hint: '一覧になければ手入力可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var name = String(p[0] || '');
                return { jumpLabel: name, jumpLabelText: name };
            },
            toParams: function(state) {
                var name = String(state.jumpLabelText || state.jumpLabel || '');
                return [name];
            }
        });

        reg(111, {
            code: 111,
            title: '条件分岐',
            description: '主要な条件分岐形式を設定します（第一段）。',
            fields: [
                { key: 'condType', type: 'select', label: '条件種別', valueType: 'number', options: [{ value: 0, label: 'スイッチ' }, { value: 1, label: '変数' }, { value: 2, label: 'セルフスイッチ' }, { value: 3, label: 'タイマー' }, { value: 11, label: 'ボタン' }, { value: 12, label: 'スクリプト' }] },
                { key: 'switchId', type: 'number', label: 'スイッチID', min: 1, step: 1 },
                { key: 'switchValue', type: 'select', label: 'スイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'varId', type: 'number', label: '変数ID', min: 1, step: 1 },
                { key: 'varOperandType', type: 'select', label: '比較対象', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'varOperand', type: 'number', label: '比較値/比較変数ID', step: 1 },
                { key: 'varCompareType', type: 'select', label: '比較演算', valueType: 'number', options: [{ value: 0, label: '==' }, { value: 1, label: '>=' }, { value: 2, label: '<=' }, { value: 3, label: '>' }, { value: 4, label: '<' }, { value: 5, label: '!=' }] },
                { key: 'selfSwitch', type: 'select', label: 'セルフスイッチ', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }] },
                { key: 'selfSwitchValue', type: 'select', label: 'セルフスイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'timerSec', type: 'number', label: 'タイマー秒数', min: 0, step: 1 },
                { key: 'timerCmp', type: 'select', label: 'タイマー比較', valueType: 'number', options: [{ value: 0, label: '以上' }, { value: 1, label: '以下' }] },
                { key: 'buttonName', type: 'select', label: 'ボタン', options: function() { return self.buttonOptionsForSchema(); } },
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 4 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    condType: Math.floor(Number(p[0] || 0) || 0),
                    switchId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    switchValue: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    varId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    varOperandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    varOperand: Math.floor(Number(p[3] || 0) || 0),
                    varCompareType: Math.max(0, Math.min(5, Math.floor(Number(p[4] || 0) || 0))),
                    selfSwitch: String(p[1] || 'A'),
                    selfSwitchValue: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    timerSec: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    timerCmp: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    buttonName: String(p[1] || 'ok'),
                    script: String(p[1] || '')
                };
            },
            toParams: function(state, entry) {
                var t = Math.floor(Number(state.condType || 0) || 0);
                if (t === 0) return [0, Math.max(1, Math.floor(Number(state.switchId || 1) || 1)), Math.max(0, Math.min(1, Math.floor(Number(state.switchValue || 0) || 0)))];
                if (t === 1) return [1, Math.max(1, Math.floor(Number(state.varId || 1) || 1)), Math.max(0, Math.min(1, Math.floor(Number(state.varOperandType || 0) || 0))), Math.floor(Number(state.varOperand || 0) || 0), Math.max(0, Math.min(5, Math.floor(Number(state.varCompareType || 0) || 0)))];
                if (t === 2) {
                    var ss = String(state.selfSwitch || 'A').toUpperCase();
                    if (!/^[ABCD]$/.test(ss)) ss = 'A';
                    return [2, ss, Math.max(0, Math.min(1, Math.floor(Number(state.selfSwitchValue || 0) || 0)))];
                }
                if (t === 3) return [3, Math.max(0, Math.floor(Number(state.timerSec || 0) || 0)), Math.max(0, Math.min(1, Math.floor(Number(state.timerCmp || 0) || 0)))];
                if (t === 11) return [11, String(state.buttonName || 'ok')];
                if (t === 12) return [12, String(state.script || '')];
                return Array.isArray(entry && entry.command && entry.command.parameters) ? clone(entry.command.parameters) : [];
            }
        });

        reg(281, {
            code: 281,
            title: 'マップ名表示の変更',
            description: 'マップ名ウィンドウの表示/非表示を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '表示設定', valueType: 'number', options: [{ value: 0, label: '表示する' }, { value: 1, label: '表示しない' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(282, {
            code: 282,
            title: 'タイルセットの変更',
            description: '切り替えるタイルセットを選択します。',
            fields: [
                { key: 'tilesetId', type: 'list', label: 'タイルセット', full: true, size: 12, search: true, valueType: 'number', options: function() { return self.tilesetOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { tilesetId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.tilesetId || 1) || 1))];
            }
        });

        reg(283, {
            code: 283,
            title: '戦闘背景の変更',
            description: '戦闘背景1/2の画像名を設定します。',
            fields: [
                { key: 'bb1', type: 'text', label: '戦闘背景1ファイル名' },
                { key: 'bb2', type: 'text', label: '戦闘背景2ファイル名' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { bb1: String(p[0] || ''), bb2: String(p[1] || '') };
            },
            toParams: function(state) {
                return [String(state.bb1 || ''), String(state.bb2 || '')];
            }
        });

        reg(284, {
            code: 284,
            title: '遠景の変更',
            description: '遠景画像・ループ・スクロール速度を設定します。',
            fields: [
                { key: 'name', type: 'text', label: '遠景ファイル名' },
                { key: 'loopX', type: 'bool', label: '横方向にループ' },
                { key: 'loopY', type: 'bool', label: '縦方向にループ' },
                { key: 'sx', type: 'number', label: '横スクロール速度', step: 1 },
                { key: 'sy', type: 'number', label: '縦スクロール速度', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    name: String(p[0] || ''),
                    loopX: !!p[1],
                    loopY: !!p[2],
                    sx: Math.floor(Number(p[3] || 0) || 0),
                    sy: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    String(state.name || ''),
                    !!state.loopX,
                    !!state.loopY,
                    Math.floor(Number(state.sx || 0) || 0),
                    Math.floor(Number(state.sy || 0) || 0)
                ];
            }
        });

        reg(285, {
            code: 285,
            title: '指定位置の情報取得',
            description: '指定座標の情報を変数へ格納します。',
            fields: [
                { key: 'variableId', type: 'list', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'infoType', type: 'select', label: '取得情報', valueType: 'number', options: [{ value: 0, label: '地形タグ' }, { value: 1, label: 'イベントID' }, { value: 2, label: 'タイルID(レイヤー1)' }, { value: 3, label: 'タイルID(レイヤー2)' }, { value: 4, label: 'タイルID(レイヤー3)' }, { value: 5, label: 'タイルID(レイヤー4)' }, { value: 6, label: 'リージョンID' }] },
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X (値 / 変数ID)', step: 1 },
                { key: 'y', type: 'number', label: 'Y (値 / 変数ID)', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    infoType: Math.max(0, Math.min(6, Math.floor(Number(p[1] || 0) || 0))),
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    x: Math.floor(Number(p[3] || 0) || 0),
                    y: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.variableId || 1) || 1)),
                    Math.max(0, Math.min(6, Math.floor(Number(state.infoType || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0))),
                    Math.floor(Number(state.x || 0) || 0),
                    Math.floor(Number(state.y || 0) || 0)
                ];
            }
        });

        reg(201, {
            code: 201,
            title: '場所移動',
            description: 'プレイヤーの場所移動先を設定します。',
            fields: [
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'mapId', type: 'list', label: 'マップ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.mapInfoOptionsForSchema(); } },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'mapVarId', type: 'list', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 0, label: 'そのまま' }, { value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] },
                { key: 'fadeType', type: 'select', label: 'フェード', valueType: 'number', options: [{ value: 0, label: '黒' }, { value: 1, label: '白' }, { value: 2, label: 'なし' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    mapId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    x: Math.floor(Number(p[2] || 0) || 0),
                    y: Math.floor(Number(p[3] || 0) || 0),
                    mapVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    xVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    direction: Math.floor(Number(p[4] || 0) || 0),
                    fadeType: Math.max(0, Math.min(2, Math.floor(Number(p[5] || 0) || 0)))
                };
            },
            toParams: function(state) {
                var locType = Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0)));
                var mapRef = (locType === 0)
                    ? Math.max(1, Math.floor(Number(state.mapId || 1) || 1))
                    : Math.max(1, Math.floor(Number(state.mapVarId || 1) || 1));
                var xRef = (locType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (locType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                var direction = Math.floor(Number(state.direction || 0) || 0);
                if ([0, 2, 4, 6, 8].indexOf(direction) < 0) direction = 0;
                return [locType, mapRef, xRef, yRef, direction, Math.max(0, Math.min(2, Math.floor(Number(state.fadeType || 0) || 0)))];
            }
        });

        reg(202, {
            code: 202,
            title: '乗り物の位置設定',
            description: '乗り物の配置位置を設定します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: [{ value: 0, label: '小型船' }, { value: 1, label: '大型船' }, { value: 2, label: '飛行船' }] },
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'mapId', type: 'list', label: 'マップ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.mapInfoOptionsForSchema(); } },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'mapVarId', type: 'list', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    mapId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    x: Math.floor(Number(p[3] || 0) || 0),
                    y: Math.floor(Number(p[4] || 0) || 0),
                    mapVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    xVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1))
                };
            },
            toParams: function(state) {
                var locType = Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0)));
                var mapRef = (locType === 0)
                    ? Math.max(1, Math.floor(Number(state.mapId || 1) || 1))
                    : Math.max(1, Math.floor(Number(state.mapVarId || 1) || 1));
                var xRef = (locType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (locType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    locType,
                    mapRef,
                    xRef,
                    yRef
                ];
            }
        });

        reg(203, {
            code: 203,
            title: 'イベントの位置設定',
            description: '対象キャラクターの位置を変更します。',
            fields: [
                { key: 'targetId', type: 'list', label: '移動対象', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'locType', type: 'select', label: '移動方法', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }, { value: 2, label: '他キャラと交換' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'swapTargetId', type: 'list', label: '交換対象', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 0, label: 'そのまま' }, { value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    locType: Math.max(0, Math.min(2, Math.floor(Number(p[1] || 0) || 0))),
                    x: Math.floor(Number(p[2] || 0) || 0),
                    y: Math.floor(Number(p[3] || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    swapTargetId: self.normalizeMoveTarget(Number(p[2] || 0)),
                    direction: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                var targetId = self.normalizeMoveTarget(Number(state.targetId || 0));
                var locType = Math.max(0, Math.min(2, Math.floor(Number(state.locType || 0) || 0)));
                var direction = Math.floor(Number(state.direction || 0) || 0);
                if ([0, 2, 4, 6, 8].indexOf(direction) < 0) direction = 0;
                if (locType === 0) {
                    return [targetId, 0, Math.floor(Number(state.x || 0) || 0), Math.floor(Number(state.y || 0) || 0), direction];
                }
                if (locType === 1) {
                    return [targetId, 1, Math.max(1, Math.floor(Number(state.xVarId || 1) || 1)), Math.max(1, Math.floor(Number(state.yVarId || 1) || 1)), direction];
                }
                return [targetId, 2, self.normalizeMoveTarget(Number(state.swapTargetId || 0)), 0, direction];
            }
        });

        reg(204, {
            code: 204,
            title: 'マップのスクロール',
            description: 'マップを指定方向へスクロールします。',
            fields: [
                { key: 'direction', type: 'select', label: '方向', valueType: 'number', options: [{ value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] },
                { key: 'distance', type: 'number', label: '距離', min: 1, step: 1 },
                { key: 'speed', type: 'number', label: '速度', min: 1, max: 6, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    direction: [2, 4, 6, 8].indexOf(Number(p[0])) >= 0 ? Number(p[0]) : 2,
                    distance: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    speed: Math.max(1, Math.min(6, Math.floor(Number(p[2] || 4) || 4)))
                };
            },
            toParams: function(state) {
                var direction = Math.floor(Number(state.direction || 2) || 2);
                if ([2, 4, 6, 8].indexOf(direction) < 0) direction = 2;
                return [
                    direction,
                    Math.max(1, Math.floor(Number(state.distance || 1) || 1)),
                    Math.max(1, Math.min(6, Math.floor(Number(state.speed || 4) || 4)))
                ];
            }
        });

        reg(205, {
            code: 205,
            title: '移動ルートの設定',
            description: '対象キャラクターと移動ルートを設定します（JSON形式）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'repeat', type: 'bool', label: '繰り返す' },
                { key: 'skippable', type: 'bool', label: '移動できない場合は飛ばす' },
                { key: 'wait', type: 'bool', label: '完了までウェイト' },
                { key: 'routeListJson', type: 'textarea', label: 'ルートコマンド配列(JSON)', full: true, rows: 10, hint: '例: [{\"code\":1,\"parameters\":[]},{\"code\":15,\"parameters\":[30]}]' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var route = (p[1] && typeof p[1] === 'object') ? clone(p[1]) : { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] };
                var list = Array.isArray(route.list) ? route.list : [];
                var viewList = [];
                for (var i = 0; i < list.length; i++) {
                    var rc = list[i];
                    if (!rc || Number(rc.code || 0) <= 0) continue;
                    viewList.push({ code: Math.floor(Number(rc.code || 0) || 0), parameters: Array.isArray(rc.parameters) ? clone(rc.parameters) : [] });
                }
                var jsonText = '[]';
                try { jsonText = JSON.stringify(viewList, null, 2); } catch (_) {}
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    repeat: !!route.repeat,
                    skippable: !!route.skippable,
                    wait: !!route.wait,
                    routeListJson: jsonText
                };
            },
            toParams: function(state) {
                var list = [];
                var raw = String(state.routeListJson || '').trim();
                if (raw.length) {
                    var arr = JSON.parse(raw);
                    if (!Array.isArray(arr)) throw new Error('ルートコマンド配列(JSON)は配列で指定してください');
                    for (var i = 0; i < arr.length; i++) {
                        var rc = arr[i];
                        if (!rc) continue;
                        var code = Math.floor(Number(rc.code || 0) || 0);
                        if (code <= 0) continue;
                        list.push({
                            code: code,
                            parameters: Array.isArray(rc.parameters) ? rc.parameters : []
                        });
                    }
                }
                list.push({ code: 0, parameters: [] });
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    {
                        repeat: !!state.repeat,
                        skippable: !!state.skippable,
                        wait: !!state.wait,
                        list: list
                    }
                ];
            }
        });

        reg(206, {
            code: 206,
            title: '乗り物の乗降',
            description: 'プレイヤーを乗り物に乗降させます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(211, {
            code: 211,
            title: '透明状態の変更',
            description: 'プレイヤーの透明状態を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '透明状態', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(212, {
            code: 212,
            commandCode: 355,
            script355: true,
            title: 'アニメーションの表示',
            description: 'this.character(targetId).requestAnimation(animationId, addX, addY, scale) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'animationId', type: 'list', label: 'アニメーション', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.animationOptionsForSchema(); } },
                { key: 'addX', type: 'number', label: 'addX(px)', step: 1, compact: true },
                { key: 'addY', type: 'number', label: 'addY(px)', step: 1, compact: true },
                { key: 'scale', type: 'number', label: 'scale', min: 0.01, step: 0.1, integer: false, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.animationRequestSpecFromEntry(entry);
                if (!spec) {
                    return {
                        targetId: 0,
                        animationId: 1,
                        addX: 0,
                        addY: 0,
                        scale: 1
                    };
                }
                return {
                    targetId: self.normalizeMoveTarget(Number(spec.targetId || 0)),
                    animationId: Math.max(1, Math.floor(Number(spec.animationId || 1) || 1)),
                    addX: Number(spec.addX || 0),
                    addY: Number(spec.addY || 0),
                    scale: Number(spec.scale == null ? 1 : spec.scale)
                };
            },
            toParams: function(state) {
                return [this.makeCharacterRequestAnimationScript(
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Math.max(1, Math.floor(Number(state.animationId || 1) || 1)),
                    Number(state.addX || 0),
                    Number(state.addY || 0),
                    Number(state.scale == null ? 1 : state.scale)
                )];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(213, {
            code: 213,
            title: 'フキダシアイコンの表示',
            description: '対象キャラクターにフキダシを表示します。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'balloonId', type: 'select', label: 'フキダシ', valueType: 'number', options: function() { return self.balloonOptionsForSchema(); } },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    balloonId: Math.max(1, Math.min(10, Math.floor(Number(p[1] || 1) || 1))),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Math.max(1, Math.min(10, Math.floor(Number(state.balloonId || 1) || 1))),
                    !!state.wait
                ];
            }
        });

        reg(214, {
            code: 214,
            title: 'イベントの一時消去',
            description: 'このイベントを一時消去します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(216, {
            code: 216,
            title: '隊列歩行の変更',
            description: '隊列歩行のON/OFFを切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '隊列歩行', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(217, {
            code: 217,
            title: '隊列メンバーの集合',
            description: '隊列メンバーを集合させます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(231, {
            code: 231,
            title: 'ピクチャの表示',
            description: 'ピクチャを表示します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'name', type: 'text', label: 'ファイル名', full: true },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', options: [{ value: 0, label: '左上' }, { value: 1, label: '中央' }] },
                { key: 'coordType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1 },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1 },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1 },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', options: [{ value: 0, label: '通常' }, { value: 1, label: '加算' }, { value: 2, label: '乗算' }, { value: 3, label: 'スクリーン' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    name: String(p[1] || ''),
                    origin: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    coordType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    x: Math.floor(Number(p[4] || 0) || 0),
                    y: Math.floor(Number(p[5] || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[5] || 1) || 1)),
                    scaleX: Math.floor(Number(p[6] || 100) || 100),
                    scaleY: Math.floor(Number(p[7] || 100) || 100),
                    opacity: Math.max(0, Math.min(255, Math.floor(Number(p[8] || 255) || 255))),
                    blendMode: Math.max(0, Math.min(3, Math.floor(Number(p[9] || 0) || 0)))
                };
            },
            toParams: function(state) {
                var coordType = Math.max(0, Math.min(1, Math.floor(Number(state.coordType || 0) || 0)));
                var xRef = (coordType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (coordType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    String(state.name || ''),
                    Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0))),
                    coordType,
                    xRef,
                    yRef,
                    Math.floor(Number(state.scaleX || 100) || 100),
                    Math.floor(Number(state.scaleY || 100) || 100),
                    Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255))),
                    Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0)))
                ];
            }
        });

        reg(232, {
            code: 232,
            title: 'ピクチャの移動',
            description: 'ピクチャを移動/変形します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'param1', type: 'number', label: '内部param1', step: 1, hint: 'MV内部仕様用。通常は0。' },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', options: [{ value: 0, label: '左上' }, { value: 1, label: '中央' }] },
                { key: 'coordType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1 },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1 },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1 },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', options: [{ value: 0, label: '通常' }, { value: 1, label: '加算' }, { value: 2, label: '乗算' }, { value: 3, label: 'スクリーン' }] },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var n = p.length;
                var isV12 = n >= 12;
                var origin = isV12 ? Number(p[2] || 0) : Number(p[1] || 0);
                var coordType = isV12 ? Number(p[3] || 0) : Number(p[2] || 0);
                var xRef = isV12 ? Number(p[4] || 0) : Number(p[3] || 0);
                var yRef = isV12 ? Number(p[5] || 0) : Number(p[4] || 0);
                var scaleX = isV12 ? Number(p[6] || 100) : Number(p[5] || 100);
                var scaleY = isV12 ? Number(p[7] || 100) : Number(p[6] || 100);
                var opacity = isV12 ? Number(p[8] || 255) : Number(p[7] || 255);
                var blendMode = isV12 ? Number(p[9] || 0) : Number(p[8] || 0);
                var duration = isV12 ? Number(p[10] || 0) : Number(p[9] || 0);
                var wait = isV12 ? !!p[11] : !!p[10];
                var param1 = isV12 ? Number(p[1] || 0) : 0;
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    param1: Math.floor(Number(param1 || 0) || 0),
                    origin: Math.max(0, Math.min(1, Math.floor(origin || 0))),
                    coordType: Math.max(0, Math.min(1, Math.floor(coordType || 0))),
                    x: Math.floor(Number(xRef || 0) || 0),
                    y: Math.floor(Number(yRef || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(xRef || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(yRef || 1) || 1)),
                    scaleX: Math.floor(Number(scaleX || 100) || 100),
                    scaleY: Math.floor(Number(scaleY || 100) || 100),
                    opacity: Math.max(0, Math.min(255, Math.floor(Number(opacity || 255) || 255))),
                    blendMode: Math.max(0, Math.min(3, Math.floor(Number(blendMode || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(duration || 0) || 0)),
                    wait: wait
                };
            },
            toParams: function(state) {
                var coordType = Math.max(0, Math.min(1, Math.floor(Number(state.coordType || 0) || 0)));
                var xRef = (coordType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (coordType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    Math.floor(Number(state.param1 || 0) || 0),
                    Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0))),
                    coordType,
                    xRef,
                    yRef,
                    Math.floor(Number(state.scaleX || 100) || 100),
                    Math.floor(Number(state.scaleY || 100) || 100),
                    Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255))),
                    Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(233, {
            code: 233,
            title: 'ピクチャの回転',
            description: 'ピクチャの回転速度を設定します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'speed', type: 'number', label: '回転速度', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    speed: Math.floor(Number(p[1] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    Math.floor(Number(state.speed || 0) || 0)
                ];
            }
        });

        reg(234, {
            code: 234,
            title: 'ピクチャの色調変更',
            description: 'ピクチャの色調を変更します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[1] && Array.isArray(p[1])) ? p[1] : [0, 0, 0, 0];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    [
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(235, {
            code: 235,
            title: 'ピクチャの消去',
            description: '指定ピクチャを消去します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.pictureId || 1) || 1))];
            }
        });

        reg(221, {
            code: 221,
            title: '画面のフェードアウト',
            description: '画面をフェードアウトします。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(222, {
            code: 222,
            title: '画面のフェードイン',
            description: '画面をフェードインします。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(223, {
            code: 223,
            title: '画面の色調変更',
            description: '画面色調を変更します。',
            fields: [
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[0] && Array.isArray(p[0])) ? p[0] : [0, 0, 0, 0];
                return {
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    [
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(224, {
            code: 224,
            title: '画面のフラッシュ',
            description: '画面をフラッシュさせます。',
            fields: [
                { key: 'r', type: 'number', label: '赤', min: 0, max: 255, step: 1 },
                { key: 'g', type: 'number', label: '緑', min: 0, max: 255, step: 1 },
                { key: 'b', type: 'number', label: '青', min: 0, max: 255, step: 1 },
                { key: 'a', type: 'number', label: '強さ(アルファ)', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var c = (p[0] && Array.isArray(p[0])) ? p[0] : [255, 255, 255, 255];
                return {
                    r: Math.max(0, Math.min(255, Math.floor(Number(c[0] || 0) || 0))),
                    g: Math.max(0, Math.min(255, Math.floor(Number(c[1] || 0) || 0))),
                    b: Math.max(0, Math.min(255, Math.floor(Number(c[2] || 0) || 0))),
                    a: Math.max(0, Math.min(255, Math.floor(Number(c[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    [
                        Math.max(0, Math.min(255, Math.floor(Number(state.r || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.g || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.b || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.a || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(225, {
            code: 225,
            title: '画面のシェイク',
            description: '画面をシェイクさせます。',
            fields: [
                { key: 'power', type: 'number', label: '強さ', min: 0, max: 9, step: 1 },
                { key: 'speed', type: 'number', label: '速さ', min: 1, max: 9, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    power: Math.max(0, Math.min(9, Math.floor(Number(p[0] || 0) || 0))),
                    speed: Math.max(1, Math.min(9, Math.floor(Number(p[1] || 5) || 5))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(9, Math.floor(Number(state.power || 0) || 0))),
                    Math.max(1, Math.min(9, Math.floor(Number(state.speed || 5) || 5))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(236, {
            code: 236,
            title: '天候の設定',
            description: '天候と強さを設定します。',
            fields: [
                { key: 'weatherType', type: 'select', label: '天候', valueType: 'number', options: [{ value: 0, label: 'なし' }, { value: 1, label: '雨' }, { value: 2, label: '嵐' }, { value: 3, label: '雪' }] },
                { key: 'power', type: 'number', label: '強さ', min: 0, max: 9, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    weatherType: Math.max(0, Math.min(3, Math.floor(Number(p[0] || 0) || 0))),
                    power: Math.max(0, Math.min(9, Math.floor(Number(p[1] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(3, Math.floor(Number(state.weatherType || 0) || 0))),
                    Math.max(0, Math.min(9, Math.floor(Number(state.power || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(241, {
            code: 241,
            title: 'BGMの演奏',
            description: 'BGMを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(242, {
            code: 242,
            title: 'BGMのフェードアウト',
            description: 'BGMをフェードアウトします。',
            fields: [
                { key: 'seconds', type: 'number', label: '時間(秒)', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { seconds: Math.max(0, Math.floor(Number(p[0] || 0) || 0)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.floor(Number(state.seconds || 0) || 0))];
            }
        });

        reg(243, {
            code: 243,
            title: 'BGMの保存',
            description: '現在のBGMを保存します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(244, {
            code: 244,
            title: 'BGMの再開',
            description: '保存したBGMを再開します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(245, {
            code: 245,
            title: 'BGSの演奏',
            description: 'BGSを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGSファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(246, {
            code: 246,
            title: 'BGSのフェードアウト',
            description: 'BGSをフェードアウトします。',
            fields: [
                { key: 'seconds', type: 'number', label: '時間(秒)', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { seconds: Math.max(0, Math.floor(Number(p[0] || 0) || 0)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.floor(Number(state.seconds || 0) || 0))];
            }
        });

        reg(249, {
            code: 249,
            title: 'MEの演奏',
            description: 'MEを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(250, {
            code: 250,
            title: 'SEの演奏',
            description: 'SEを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'SEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(251, {
            code: 251,
            title: 'SEの停止',
            description: '再生中のSEを停止します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(261, {
            code: 261,
            title: 'ムービーの再生',
            description: 'ムービーを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'ムービーファイル名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { name: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.name || '')];
            }
        });

        reg(125, {
            code: 125,
            title: '所持金の増減',
            description: '所持金を増減します。',
            fields: [
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[2] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(126, {
            code: 126,
            title: 'アイテムの増減',
            description: '指定アイテムを増減します。',
            fields: [
                { key: 'itemId', type: 'list', label: 'アイテム', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.itemOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    itemId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.itemId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(127, {
            code: 127,
            title: '武器の増減',
            description: '指定武器を増減します。',
            fields: [
                { key: 'weaponId', type: 'list', label: '武器', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.weaponOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 },
                { key: 'includeEquip', type: 'bool', label: '装備中を含む(減少時)' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    weaponId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0)),
                    includeEquip: !!p[4]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.weaponId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.includeEquip
                ];
            }
        });

        reg(128, {
            code: 128,
            title: '防具の増減',
            description: '指定防具を増減します。',
            fields: [
                { key: 'armorId', type: 'list', label: '防具', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.armorOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 },
                { key: 'includeEquip', type: 'bool', label: '装備中を含む(減少時)' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    armorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0)),
                    includeEquip: !!p[4]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.armorId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.includeEquip
                ];
            }
        });

        reg(129, {
            code: 129,
            title: 'メンバーの入れ替え',
            description: 'パーティメンバーの加入/離脱を設定します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '加入' }, { value: 1, label: '離脱' }] },
                { key: 'initialize', type: 'bool', label: '加入時に初期化する' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    initialize: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    !!state.initialize
                ];
            }
        });

        reg(311, {
            code: 311,
            title: 'HPの増減',
            description: '対象アクターのHPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'allowDeath', type: 'bool', label: '戦闘不能を許可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    allowDeath: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.allowDeath
                ];
            }
        });

        reg(312, {
            code: 312,
            title: 'MPの増減',
            description: '対象アクターのMPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(326, {
            code: 326,
            title: 'TPの増減',
            description: '対象アクターのTPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(313, {
            code: 313,
            title: 'ステートの変更',
            description: '対象アクターのステートを付与/解除します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '付与' }, { value: 1, label: '解除' }] },
                { key: 'stateId', type: 'list', label: 'ステート', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.stateOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    stateId: Math.max(1, Math.floor(Number(p[3] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.stateId || 1) || 1))
                ];
            }
        });

        reg(314, {
            code: 314,
            title: '全回復',
            description: '対象アクターを全回復します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [targetType, targetRef];
            }
        });

        reg(315, {
            code: 315,
            title: '経験値の増減',
            description: '対象アクターの経験値を増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'showLevelUp', type: 'bool', label: 'レベルアップ表示を行う' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    showLevelUp: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.showLevelUp
                ];
            }
        });

        reg(316, {
            code: 316,
            title: 'レベルの増減',
            description: '対象アクターのレベルを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'showLevelUp', type: 'bool', label: 'レベルアップ表示を行う' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    showLevelUp: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.showLevelUp
                ];
            }
        });

        reg(317, {
            code: 317,
            title: '能力値の増減',
            description: '対象アクターの能力値を増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'paramId', type: 'select', label: '能力値', valueType: 'number', options: [{ value: 0, label: '最大HP' }, { value: 1, label: '最大MP' }, { value: 2, label: '攻撃力' }, { value: 3, label: '防御力' }, { value: 4, label: '魔法力' }, { value: 5, label: '魔法防御' }, { value: 6, label: '敏捷性' }, { value: 7, label: '運' }] },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    paramId: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0))),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[4] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[5] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(7, Math.floor(Number(state.paramId || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(318, {
            code: 318,
            title: 'スキルの増減',
            description: '対象アクターにスキルを習得/忘却させます。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '習得' }, { value: 1, label: '忘却' }] },
                { key: 'skillId', type: 'list', label: 'スキル', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.skillOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    skillId: Math.max(1, Math.floor(Number(p[3] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.skillId || 1) || 1))
                ];
            }
        });

        reg(319, {
            code: 319,
            title: '装備の変更',
            description: '対象アクターの装備スロットを変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'equipTypeId', type: 'list', label: '装備タイプ', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.equipTypeOptionsForSchema(); } },
                { key: 'itemId', type: 'number', label: '装備ID', min: 0, step: 1, hint: '0で装備を外す。武器/防具IDは装備タイプに対応したIDを指定。' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    equipTypeId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    itemId: Math.max(0, Math.floor(Number(p[2] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(1, Math.floor(Number(state.equipTypeId || 1) || 1)),
                    Math.max(0, Math.floor(Number(state.itemId || 0) || 0))
                ];
            }
        });

        reg(320, {
            code: 320,
            title: '名前の変更',
            description: '対象アクターの名前を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'name', type: 'text', label: '新しい名前', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    name: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.name == null ? '' : state.name)
                ];
            }
        });

        reg(321, {
            code: 321,
            title: '職業の変更',
            description: '対象アクターの職業を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'classId', type: 'list', label: '職業', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.classOptionsForSchema(); } },
                { key: 'keepExp', type: 'bool', label: '経験値を維持する' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    classId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    keepExp: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(1, Math.floor(Number(state.classId || 1) || 1)),
                    !!state.keepExp
                ];
            }
        });

        reg(324, {
            code: 324,
            title: '二つ名の変更',
            description: '対象アクターの二つ名を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'nickname', type: 'text', label: '新しい二つ名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    nickname: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.nickname == null ? '' : state.nickname)
                ];
            }
        });

        reg(325, {
            code: 325,
            title: 'プロフィールの変更',
            description: '対象アクターのプロフィール文を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'profile', type: 'textarea', label: 'プロフィール', full: true, rows: 8 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    profile: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.profile == null ? '' : state.profile)
                ];
            }
        });

        reg(331, {
            code: 331,
            title: '敵キャラのHP増減',
            description: '対象敵のHPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 },
                { key: 'allowDeath', type: 'bool', label: '戦闘不能を許可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0), allowDeath: !!p[4] };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0), !!state.allowDeath];
            }
        });

        reg(332, {
            code: 332,
            title: '敵キャラのMP増減',
            description: '対象敵のMPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0)];
            }
        });

        reg(342, {
            code: 342,
            title: '敵キャラのTP増減',
            description: '対象敵のTPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0)];
            }
        });

        reg(333, {
            code: 333,
            title: '敵キャラのステート変更',
            description: '対象敵にステートを付与/解除します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'mode', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '付与' }, { value: 1, label: '解除' }] },
                { key: 'stateId', type: 'list', label: 'ステート', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.stateOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), mode: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), stateId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0))), Math.max(1, Math.floor(Number(state.stateId || 1) || 1))];
            }
        });

        reg(334, {
            code: 334,
            title: '敵キャラの全回復',
            description: '対象敵を全回復します。',
            fields: [{ key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0) };
            },
            toParams: function(state) { return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0)]; }
        });

        reg(335, {
            code: 335,
            title: '敵キャラの出現',
            description: '対象敵を出現させます。',
            fields: [{ key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0) };
            },
            toParams: function(state) { return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0)]; }
        });

        reg(336, {
            code: 336,
            title: '敵キャラの変身',
            description: '対象敵を別の敵キャラに変身させます。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'enemyId', type: 'list', label: '変身先敵キャラ', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.enemyOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), enemyId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(1, Math.floor(Number(state.enemyId || 1) || 1))];
            }
        });

        reg(337, {
            code: 337,
            title: '戦闘アニメーションの表示',
            description: '対象敵にアニメーションを表示します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号', min: -1, step: 1, hint: '全体指定ON時は無視されます' },
                { key: 'animationId', type: 'list', label: 'アニメーション', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.animationOptionsForSchema(); } },
                { key: 'allEnemies', type: 'bool', label: '敵グループ全体に表示' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), animationId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)), allEnemies: !!p[2] };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(1, Math.floor(Number(state.animationId || 1) || 1)), !!state.allEnemies];
            }
        });

        reg(339, {
            code: 339,
            title: '戦闘行動の強制',
            description: '敵/アクターにスキル使用を強制します。',
            fields: [
                { key: 'battlerType', type: 'select', label: '対象種別', valueType: 'number', options: [{ value: 0, label: '敵キャラ' }, { value: 1, label: 'アクター' }] },
                { key: 'targetId', type: 'number', label: '対象ID', min: -1, step: 1, hint: '敵: 番号(-1=全体) / アクター: アクターID' },
                { key: 'skillId', type: 'number', label: 'スキルID', min: 1, step: 1 },
                { key: 'forceTarget', type: 'number', label: '行動対象インデックス', step: 1, hint: '-2=最後の対象, -1=ランダム' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    battlerType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    targetId: Math.floor(Number(p[1] || 0) || 0),
                    skillId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    forceTarget: Math.floor(Number(p[3] == null ? -2 : p[3]) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(1, Math.floor(Number(state.battlerType || 0) || 0))),
                    Math.floor(Number(state.targetId || 0) || 0),
                    Math.max(1, Math.floor(Number(state.skillId || 1) || 1)),
                    Math.floor(Number(state.forceTarget == null ? -2 : state.forceTarget) || 0)
                ];
            }
        });

        reg(340, { code: 340, title: 'バトルの中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });

        reg(356, {
            code: 356,
            title: 'プラグインコマンド',
            description: '実行するプラグインコマンド行を入力します。',
            fields: [
                { key: 'pluginLine', type: 'text', label: 'コマンド行', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { pluginLine: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.pluginLine || '')];
            }
        });

        reg(112, { code: 112, title: 'ループ', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
        reg(113, { code: 113, title: 'ループの中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
        reg(115, { code: 115, title: 'イベント処理の中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
    };

    EE.prototype.getEditorSchema = function(code) {
        this.ensureEditorSchemas();
        return this._editorSchemas[Number(code || 0)] || null;
    };

    EE.prototype.schemaWithPendingAddWaitLimit = function(schema, entry) {
        if (!schema || !entry) return schema;
        if (!this._pendingNewUid || Number(entry.uid || 0) !== Number(this._pendingNewUid)) return schema;
        var maxWait = Math.floor(Number(entry._pendingWaitMaxFrames || 0));
        if (maxWait < 1) return schema;
        var fields = Array.isArray(schema.fields) ? schema.fields : null;
        if (!fields || !fields.length) return schema;
        var changed = false;
        var nextFields = [];
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            if (!f || f.type !== 'number' || String(f.key || '') !== 'duration') {
                nextFields.push(f);
                continue;
            }
            var nf = {};
            for (var k in f) nf[k] = f[k];
            nf.min = Math.max(1, Math.floor(Number(nf.min == null ? 1 : nf.min) || 1));
            nf.max = maxWait;
            if (nf.hint) nf.hint = String(nf.hint) + ' / 新規追加時の上限: ' + maxWait + 'f';
            else nf.hint = '新規追加時の上限: ' + maxWait + 'f';
            nextFields.push(nf);
            changed = true;
        }
        if (!changed) return schema;
        var out = {};
        for (k in schema) out[k] = schema[k];
        out.fields = nextFields;
        return out;
    };

    EE.prototype.resolveSchemaOptions = function(field, state) {
        if (!field) return [];
        if (typeof field.options === 'function') {
            try { return field.options.call(this, state) || []; } catch (_) { return []; }
        }
        return Array.isArray(field.options) ? field.options : [];
    };

    EE.prototype.normalizeSchemaOption = function(op) {
        if (op == null) return { value: '', label: '' };
        if (typeof op === 'object') {
            return {
                value: (op.value == null ? '' : op.value),
                label: String(op.label == null ? op.value : op.label)
            };
        }
        return { value: op, label: String(op) };
    };

    EE.prototype.normalizeSchemaOptions = function(options) {
        var src = Array.isArray(options) ? options : [];
        var wm = this._schemaNormalizedOptionCache;
        if (wm && wm.has(src)) return wm.get(src);
        var out = new Array(src.length);
        for (var i = 0; i < src.length; i++) {
            var it = this.normalizeSchemaOption(src[i]);
            var lbl = String(it.label == null ? '' : it.label);
            var val = String(it.value == null ? '' : it.value);
            out[i] = {
                value: it.value,
                label: lbl,
                _labelLc: lbl.toLowerCase(),
                _valueLc: val.toLowerCase()
            };
        }
        if (wm) wm.set(src, out);
        return out;
    };

    EE.prototype.schemaFieldShouldCompact = function(field, state) {
        if (!field || field.full) return false;
        if (field.compact === true) return true;
        if (field.compact === false) return false;
        if (field.type === 'textarea' || field.type === 'list' || field.type === 'bool') return false;

        var key = String(field.key || '');
        if (field.type === 'select') {
            var opts = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state));
            if (!opts.length) return false;
            var maxLen = 0;
            for (var i = 0; i < opts.length; i++) {
                var ln = String(opts[i].label || '').trim().length;
                if (ln > maxLen) maxLen = ln;
            }
            if (maxLen <= 8 && opts.length <= 16) return true;
            if (RE_COMPACT_SELECT_KEY.test(key)) return true;
            return false;
        }

        if (field.type === 'number') {
            var hasMin = (field.min != null && isFinite(Number(field.min)));
            var hasMax = (field.max != null && isFinite(Number(field.max)));
            if (hasMin && hasMax) {
                var min = Number(field.min);
                var max = Number(field.max);
                if (Math.abs(max - min) <= 999999) return true;
            }
            if (RE_COMPACT_NUMBER_KEY.test(key)) return true;
            return false;
        }

        if (field.type === 'text') {
            if (field.maxLength != null && Number(field.maxLength) <= 12) return true;
            if (RE_COMPACT_TEXT_KEY.test(key) && String(field.label || '').length <= 8) return true;
        }
        return false;
    };

    EE.prototype.fillSchemaSelect = function(select, options, value) {
        if (!select) return;
        select.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < options.length; i++) {
            var src = options[i];
            var it = (src && typeof src === 'object' &&
                Object.prototype.hasOwnProperty.call(src, 'label') &&
                Object.prototype.hasOwnProperty.call(src, 'value'))
                ? src
                : this.normalizeSchemaOption(src);
            var op = document.createElement('option');
            op.value = String(it.value);
            op.textContent = it.label;
            frag.appendChild(op);
        }
        select.appendChild(frag);
        if (value != null) select.value = String(value);
        if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
    };

    EE.prototype.renderSchemaField = function(field, value, state) {
        var selfEE = this;
        var row = this.el('div', 'sfr' + (field.full ? ' full' : ''));
        if (field && field.span != null) {
            var sp = Math.max(1, Math.min(4, Math.floor(Number(field.span || 0) || 0)));
            if (sp > 0) row.style.gridColumn = 'span ' + sp;
        }
        row.setAttribute('data-fkey', String(field && field.key || ''));
        var binding = { field: field, row: row, input: null, getValue: null, visible: true, searchInput: null, optionSource: null };
        if (field.type === 'bool') row.classList.add('bool');
        if (field.type === 'list') row.classList.add('list');
        if (this.schemaFieldShouldCompact(field, state)) row.classList.add('compact');

        if (field.type !== 'bool') row.appendChild(this.el('label', '', String(field.label || field.key || '')));

        if (field.type === 'textarea') {
            var ta = this.el('textarea', '');
            ta.value = String(value == null ? '' : value);
            if (field.rows) ta.rows = Math.max(2, Number(field.rows || 0));
            if (this.editSchema && Number(this.editSchema.code || 0) === 101 && String(field.key || '') === 'text') {
                ta.rows = 4;
                ta.style.minHeight = '76px';
                ta.style.height = '76px';
                ta.style.maxHeight = '76px';
            }
            row.appendChild(ta);
            binding.input = ta;
            binding.getValue = function() { return String(ta.value || ''); };
        } else if (field.type === 'text') {
            var tx = this.el('input', '');
            tx.type = 'text';
            tx.value = String(value == null ? '' : value);
            row.appendChild(tx);
            binding.input = tx;
            binding.getValue = function() { return String(tx.value || ''); };
        } else if (field.type === 'bool') {
            var cb = this.el('input', '');
            cb.type = 'checkbox';
            cb.checked = !!value;
            row.appendChild(this.el('label', '', String(field.label || field.key || '')));
            row.appendChild(cb);
            binding.input = cb;
            binding.getValue = function() { return !!cb.checked; };
        } else if (field.type === 'number') {
            var nu = this.el('input', '');
            nu.type = 'number';
            if (field.min != null) nu.min = String(field.min);
            if (field.max != null) nu.max = String(field.max);
            if (field.step != null) nu.step = String(field.step);
            nu.value = String(value == null ? (field.defaultValue == null ? '' : field.defaultValue) : value);
            this.attachNumberWheelInput(nu);
            row.appendChild(nu);
            binding.input = nu;
            binding.getValue = function() {
                var n = Number(nu.value);
                if (!isFinite(n)) throw new Error((field.label || field.key) + ' は数値で入力してください');
                if (field.integer !== false) n = Math.floor(n);
                if (field.min != null && n < field.min) throw new Error((field.label || field.key) + ' は ' + field.min + ' 以上で入力してください');
                if (field.max != null && n > field.max) throw new Error((field.label || field.key) + ' は ' + field.max + ' 以下で入力してください');
                return n;
            };
        } else if (field.type === 'taildir') {
            var cur = this.normalizeMessageTailDir(value == null ? 5 : value);
            var hidden = this.el('input', '');
            hidden.type = 'hidden';
            hidden.value = String(cur);
            var grid = this.el('div', 'tdg');
            var order = [7, 8, 9, 4, 5, 6, 1, 2, 3];
            var marks = {
                7: '↖', 8: '↑', 9: '↗',
                4: '←', 5: '・', 6: '→',
                1: '↙', 2: '↓', 3: '↘'
            };
            var btns = [];
            var refreshGrid = function() {
                var sel = Math.floor(Number(hidden.value || 5) || 5);
                for (var bi = 0; bi < btns.length; bi++) {
                    var b = btns[bi];
                    b.classList.toggle('on', Number(b.getAttribute('data-dir') || 0) === sel);
                }
            };
            for (var di = 0; di < order.length; di++) {
                var dir = order[di];
                var bt = this.el('button', 'tdgb', String(marks[dir] || dir));
                bt.type = 'button';
                bt.setAttribute('data-dir', String(dir));
                bt.title = String(dir);
                bt.addEventListener('click', (function(d) {
                    return function(ev) {
                        ev.preventDefault();
                        hidden.value = String(d);
                        refreshGrid();
                        selfEE.refreshSchemaFieldVisibility();
                    };
                })(dir));
                btns.push(bt);
                grid.appendChild(bt);
            }
            refreshGrid();
            row.appendChild(grid);
            row.appendChild(hidden);
            binding.input = hidden;
            binding.getValue = function() {
                return selfEE.normalizeMessageTailDir(hidden.value);
            };
        } else if (field.type === 'select' || field.type === 'list') {
            var search = null;
            if (field.type === 'list' && field.search) {
                search = this.el('input', '');
                search.type = 'text';
                search.placeholder = '検索...';
                row.appendChild(search);
            }
            var sl = this.el('select', '');
            if (field.type === 'list') sl.size = (String(field.key || '') === 'actorId') ? 6 : 10;
            this.attachSelectWheelInput(sl);
            var allOptions = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state));
            binding.optionSource = allOptions;
            this.fillSchemaSelect(sl, allOptions, value);
            if (search) {
                search.addEventListener('input', function() {
                    selfEE.applySchemaListFilter(binding);
                    selfEE.refreshSchemaFieldVisibility();
                });
                binding.searchInput = search;
            }
            row.appendChild(sl);
            binding.input = sl;
            binding.getValue = function() {
                var v = sl.value;
                if (field.valueType === 'number') return Math.floor(Number(v || 0) || 0);
                return String(v == null ? '' : v);
            };
        } else {
            var unk = this.el('input', '');
            unk.type = 'text';
            unk.value = String(value == null ? '' : value);
            row.appendChild(unk);
            binding.input = unk;
            binding.getValue = function() { return String(unk.value || ''); };
        }

        if (binding.input) {
            var triggerVis = function() { selfEE.refreshSchemaFieldVisibility(); };
            binding.input.addEventListener('change', triggerVis);
            if (field.type !== 'bool') binding.input.addEventListener('input', triggerVis);
        }
        if (field.hint) row.appendChild(this.el('div', 'hint', String(field.hint)));
        return binding;
    };

    EE.prototype.renderEditorSchema = function(schema, state) {
        this.editSchemaBindings = [];
        if (!this.edSchemaWrap || !this.edSchemaFields) return;
        this.edSchemaHead.textContent = String(schema && schema.title || '');
        this.edSchemaDesc.textContent = String(schema && schema.description || '');
        this.edSchemaFields.innerHTML = '';
        var scode = Number(schema && schema.code || 0);
        this.edSchemaFields.classList.toggle('msg101', scode === 101);
        var fs = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
        state = state || {};
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (!f || !f.key) continue;
            var v = (state.hasOwnProperty(f.key)) ? state[f.key] : f.defaultValue;
            var b = this.renderSchemaField(f, v, state);
            this.edSchemaFields.appendChild(b.row);
            this.editSchemaBindings.push(b);
        }
        this.refreshSchemaFieldVisibility();
    };

    EE.prototype.rawSchemaBindingValue = function(binding) {
        if (!binding || !binding.field || !binding.input) return undefined;
        var field = binding.field;
        var inp = binding.input;
        if (field.type === 'bool') return !!inp.checked;
        if (field.type === 'number') {
            var n = Number(inp.value);
            if (!isFinite(n)) n = (field.defaultValue == null ? 0 : Number(field.defaultValue || 0));
            if (!isFinite(n)) n = 0;
            if (field.integer !== false) n = Math.floor(n);
            return n;
        }
        if (field.type === 'select' || field.type === 'list') {
            var v = inp.value;
            if (field.valueType === 'number') return Math.floor(Number(v || 0) || 0);
            return String(v == null ? '' : v);
        }
        return String(inp.value == null ? '' : inp.value);
    };

    EE.prototype.collectEditorSchemaStateRaw = function() {
        var out = {};
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field) continue;
            out[b.field.key] = this.rawSchemaBindingValue(b);
        }
        return out;
    };

    EE.prototype.applySchemaListFilter = function(binding) {
        if (!binding || !binding.field || !binding.input) return;
        var field = binding.field;
        if (!(field.type === 'list' || field.type === 'select')) return;
        var options = Array.isArray(binding.optionSource) ? binding.optionSource : [];
        var q = '';
        if (binding.searchInput) q = String(binding.searchInput.value || '').toLowerCase();
        var filtered = [];
        for (var i = 0; i < options.length; i++) {
            var it = options[i];
            if (!q.length || String(it._labelLc || '').indexOf(q) >= 0 || String(it._valueLc || '').indexOf(q) >= 0) filtered.push(it);
        }
        var old = binding.input.value;
        this.fillSchemaSelect(binding.input, filtered, old);
    };

    EE.prototype.schemaFieldVisible = function(field, state) {
        if (!field) return true;
        if (typeof field.visibleWhen === 'function') {
            try { return !!field.visibleWhen.call(this, state || {}, field); } catch (_) { return true; }
        }
        if (field.visibleWhen && typeof field.visibleWhen === 'object') {
            var c = field.visibleWhen;
            var k = c.key;
            if (k != null) {
                var v = state ? state[k] : undefined;
                if (c.hasOwnProperty('eq') && v !== c.eq) return false;
                if (c.hasOwnProperty('ne') && v === c.ne) return false;
                if (Array.isArray(c.in) && c.in.indexOf(v) < 0) return false;
                if (Array.isArray(c.notIn) && c.notIn.indexOf(v) >= 0) return false;
            }
            if (Array.isArray(c.all)) {
                for (var ai = 0; ai < c.all.length; ai++) {
                    var cc = c.all[ai];
                    if (!this.schemaFieldVisible({ visibleWhen: cc }, state)) return false;
                }
            }
            if (Array.isArray(c.any) && c.any.length) {
                var ok = false;
                for (var aj = 0; aj < c.any.length; aj++) {
                    var c2 = c.any[aj];
                    if (this.schemaFieldVisible({ visibleWhen: c2 }, state)) { ok = true; break; }
                }
                if (!ok) return false;
            }
            return true;
        }
        return this.schemaFieldAutoVisible(field, state || {});
    };

    EE.prototype.schemaFieldAutoVisible = function(field, state) {
        var key = String(field.key || '');
        function has(k) { return Object.prototype.hasOwnProperty.call(state, k); }

        if (has('scopeType') && key === 'toVar') return Number(state.scopeType || 0) !== 0;

        if (has('targetType') && has('actorId') && has('actorVarId')) {
            if (key === 'actorId') return Number(state.targetType || 0) === 0;
            if (key === 'actorVarId') return Number(state.targetType || 0) === 1;
        }

        if (has('mode') && has('troopId') && has('troopVarId')) {
            if (key === 'troopId') return Number(state.mode || 0) === 0;
            if (key === 'troopVarId') return Number(state.mode || 0) === 1;
        }

        if (has('priceType') && key === 'price') return Number(state.priceType || 0) === 1;

        if (has('locType')) {
            var lt = Number(state.locType || 0);
            if (key === 'mapId' && has('mapVarId')) return lt === 0;
            if (key === 'mapVarId') return lt === 1;
            if ((key === 'x' || key === 'y') && has('xVarId') && has('yVarId')) return lt === 0;
            if (key === 'xVarId' || key === 'yVarId') return lt === 1;
            if (key === 'swapTargetId') return lt === 2;
        }

        if (has('coordType')) {
            var ct = Number(state.coordType || 0);
            if ((key === 'x' || key === 'y') && has('xVarId') && has('yVarId')) return ct === 0;
            if (key === 'xVarId' || key === 'yVarId') return ct === 1;
        }

        if (has('operandType')) {
            var ot = Number(state.operandType || 0);
            if (key === 'constValue') return ot === 0;
            if (key === 'operandVarId') return ot === 1;
            if (key === 'randMin' || key === 'randMax') return ot === 2;
            if (key === 'gameDataType' || key === 'gameDataP1' || key === 'gameDataP2') return ot === 3;
            if (key === 'script' && has('constValue')) return ot === 4;
        }

        if (has('condType')) {
            var cd = Number(state.condType || 0);
            if (key === 'switchId' || key === 'switchValue') return cd === 0;
            if (key === 'varId' || key === 'varOperandType' || key === 'varOperand' || key === 'varCompareType') return cd === 1;
            if (key === 'selfSwitch' || key === 'selfSwitchValue') return cd === 2;
            if (key === 'timerSec' || key === 'timerCmp') return cd === 3;
            if (key === 'buttonName') return cd === 11;
            if (key === 'script') return cd === 12;
        }

        if (has('allEnemies') && key === 'enemyIndex') return !state.allEnemies;
        if (has('loopX') && key === 'sx') return !!state.loopX;
        if (has('loopY') && key === 'sy') return !!state.loopY;

        return true;
    };

    EE.prototype.refreshSchemaDynamicOptions = function(state) {
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.input) continue;
            var f = b.field;
            if (!(f.type === 'select' || f.type === 'list')) continue;
            if (typeof f.options !== 'function') continue;
            var nextOptions = this.normalizeSchemaOptions(this.resolveSchemaOptions(f, state));
            if (b.optionSource === nextOptions) continue;
            var old = b.input.value;
            b.optionSource = nextOptions;
            this.fillSchemaSelect(b.input, b.optionSource, old);
            if (b.searchInput) this.applySchemaListFilter(b);
        }
    };

    EE.prototype.refreshSchemaFieldVisibility = function() {
        var state = this.collectEditorSchemaStateRaw();
        this.refreshSchemaDynamicOptions(state);
        state = this.collectEditorSchemaStateRaw();
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.row) continue;
            var vis = this.schemaFieldVisible(b.field, state);
            b.visible = !!vis;
            b.row.style.display = vis ? '' : 'none';
        }
        if (this.shouldShowAnimationPreviewInEditor()) {
            this.requestAnimationPreviewPlayback(false);
        }
    };

    EE.prototype.collectEditorSchemaState = function() {
        var out = {};
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.getValue) continue;
            var v = (b.visible === false) ? this.rawSchemaBindingValue(b) : b.getValue();
            out[b.field.key] = v;
        }
        return out;
    };

    EE.prototype.currentEditingEntry = function() {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return null;
        var uid = Math.floor(Number(this.editUid || 0));
        if (uid <= 0) return null;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (Math.floor(Number(e.uid || 0)) === uid) return e;
        }
        return null;
    };

    EE.prototype.currentEditingRouteTargetId = function() {
        var rli = (this.editRouteListIndex == null) ? -1 : Number(this.editRouteListIndex);
        if (rli < 0) return 0;
        var e = this.currentEditingEntry();
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return 0;
        var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
        return this.normalizeMoveTarget(Number(p[0] || e.charId || 0));
    };

    EE.prototype.editorPreviewMode = function() {
        if (!this.editSchema) return '';
        if (!this.edSchemaWrap || this.edSchemaWrap.style.display === 'none') return '';
        var code = Number(this.editSchema.code || 0);
        if (code === 212) return 'animation';
        var rli = (this.editRouteListIndex == null) ? -1 : Number(this.editRouteListIndex);
        if (rli >= 0) {
            if (code === 4510 || code === 4511) return 'frame';
            if (code === 4514) return 'image';
        }
        return '';
    };

    EE.prototype.shouldShowAnimationPreviewInEditor = function() {
        return this.editorPreviewMode().length > 0;
    };

    EE.prototype.isAnimationPreviewEditorActive = function() {
        if (!this.shouldShowAnimationPreviewInEditor()) return false;
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        return true;
    };

    EE.prototype.animationPreviewStateFromRaw = function(raw) {
        raw = (raw && typeof raw === 'object') ? raw : {};
        var mode = this.editorPreviewMode();
        if (mode === 'frame') {
            var tid = this.currentEditingRouteTargetId();
            var wait = Math.max(1, Math.floor(Number(raw.speed || 6) || 6));
            var loop = !!raw.loop;
            var frameSpec = '[8,9,10]';
            var cells = [8, 9, 10];
            var useImage = !!raw.useImage;
            if (!Object.prototype.hasOwnProperty.call(raw, 'useImage')) {
                var editCode = Number(this.editSchema && this.editSchema.code || 0);
                if (editCode === 4511) useImage = true;
            }
            var imageName = null;
            var imageIndex = 0;
            var imageDir = 2;
            var p = this.parseFrameAnimationFrameSpecLiteral(raw.frameSpec);
            if (!p && raw.animId != null) p = this.parseFrameAnimationFrameSpecLiteral(String(Math.max(1, Math.floor(Number(raw.animId || 1) || 1))));
            if (p) {
                frameSpec = String(p.literal || frameSpec);
                cells = (p.kind === 'number') ? Math.max(1, Math.floor(Number(p.number || 1) || 1)) : (Array.isArray(p.values) ? p.values.slice(0) : [8, 9, 10]);
            }
            if (useImage) {
                imageName = String(raw.imageName || '');
                imageIndex = Math.floor(Number(raw.imageIndex || 0) || 0);
                imageDir = this.normalizeDirection8(Number(raw.imageDir || 2), 2);
            }
            return {
                mode: 'frame',
                targetId: tid,
                frameSpec: frameSpec,
                cells: cells,
                wait: wait,
                loop: loop,
                useImage: useImage,
                imageName: imageName,
                imageIndex: imageIndex,
                imageDir: imageDir
            };
        }

        if (mode === 'image') {
            return {
                mode: 'image',
                targetId: this.currentEditingRouteTargetId(),
                imageName: String(raw.name || ''),
                imageIndex: Math.floor(Number(raw.index || 0) || 0),
                imageDir: this.normalizeDirection8(Number(raw.direction || 2), 2)
            };
        }

        var aid = Math.max(1, Math.floor(Number(raw.animationId || 1) || 1));
        var tid2 = this.normalizeMoveTarget(Number(raw.targetId || 0));
        var addX = Number(raw.addX || 0);
        var addY = Number(raw.addY || 0);
        var scale = Number(raw.scale == null ? 1 : raw.scale);
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        return {
            mode: 'animation',
            targetId: tid2,
            animationId: aid,
            addX: addX,
            addY: addY,
            scale: scale
        };
    };

    EE.prototype.animationPreviewStateSig = function(spec) {
        if (!spec) return '';
        if (String(spec.mode || '') === 'image') {
            return [
                'image',
                String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
                String(spec.imageName == null ? '' : spec.imageName),
                String(Math.floor(Number(spec.imageIndex || 0) || 0)),
                String(this.normalizeDirection8(Number(spec.imageDir || 2), 2))
            ].join('|');
        }
        if (String(spec.mode || '') === 'frame') {
            var useImage = !!spec.useImage;
            return [
                'frame',
                String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
                String(spec.frameSpec == null ? '' : spec.frameSpec),
                String(Math.max(1, Math.floor(Number(spec.wait || 6) || 6))),
                String(!!spec.loop),
                String(useImage),
                String(useImage ? (spec.imageName == null ? '' : spec.imageName) : ''),
                String(useImage ? Math.floor(Number(spec.imageIndex || 0) || 0) : 0),
                String(useImage ? this.normalizeDirection8(Number(spec.imageDir || 2), 2) : 2)
            ].join('|');
        }
        return [
            'animation',
            String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
            String(Math.max(1, Math.floor(Number(spec.animationId || 1) || 1))),
            String(Number(spec.addX || 0)),
            String(Number(spec.addY || 0)),
            String(Number(spec.scale == null ? 1 : spec.scale))
        ].join('|');
    };

    EE.prototype.updateAnimationPreviewTitle = function() {
        if (!this.animPreviewTitle) return;
        var mode = this.editorPreviewMode();
        if (mode === 'frame') this.animPreviewTitle.textContent = 'フレームアニメプレビュー（自動再生）';
        else if (mode === 'image') this.animPreviewTitle.textContent = '画像プレビュー（setImageZXC）';
        else this.animPreviewTitle.textContent = 'アニメーションプレビュー（自動再生）';
    };

    EE.prototype.animationPreviewTargetName = function(targetId) {
        targetId = this.normalizeMoveTarget(Number(targetId || 0));
        if (typeof this.rowLabelForCharId === 'function') return String(this.rowLabelForCharId(targetId) || '');
        if (targetId === -1) return 'プレイヤー';
        if (targetId === 0) return 'このイベント';
        return 'イベント ' + targetId;
    };

    EE.prototype.setAnimationPreviewInfo = function(text, isError) {
        if (!this.animPreviewInfo) return;
        this.animPreviewInfo.textContent = String(text || '');
        this.animPreviewInfo.style.color = isError
            ? 'rgba(255,170,170,.98)'
            : 'rgba(182,200,228,.95)';
    };

    EE.prototype.isAnimationPreviewOverlayOpen = function() {
        return !!(this.animPreviewOverlay && this.animPreviewOverlay.classList && this.animPreviewOverlay.classList.contains('on'));
    };

    EE.prototype.resolveAnimationPreviewOverlayImageState = function() {
        var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
        var mode = String(spec && spec.mode || 'animation');
        var name = '';
        var idx = 0;
        var dir = 2;
        var targetLabel = '';
        if (mode === 'image') {
            name = String(spec && spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec && spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec && spec.imageDir || 2), 2);
            targetLabel = 'setImageZXC';
            return { mode: mode, name: name, index: idx, direction: dir, targetLabel: targetLabel };
        }
        if (mode === 'frame' && spec && spec.useImage && String(spec.imageName || '').length) {
            name = String(spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec.imageDir || 2), 2);
            targetLabel = 'setImageZXC + startFrameAnimation';
            return { mode: mode, name: name, index: idx, direction: dir, targetLabel: targetLabel };
        }
        var targetId = this.normalizeMoveTarget(Number(spec && spec.targetId || 0));
        var src = this.animPreviewSourceChar || null;
        if (!src && this.characterByPanelId) src = this.characterByPanelId(targetId);
        if (!src) src = this.animPreviewProxyChar || null;
        if (src) {
            name = String(src._characterName || '');
            idx = Math.max(0, Math.floor(Number(src._characterIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(src._direction || 2), 2);
        }
        targetLabel = this.animationPreviewTargetName(targetId);
        return { mode: mode, name: name, index: idx, direction: dir, targetLabel: targetLabel };
    };

    EE.prototype.drawAnimationPreviewSheetCanvas = function(canvas, infoEl, name, idx, dir, opts) {
        opts = opts || {};
        var mode = String(opts.mode || '');
        var maxW = Math.max(64, Math.floor(Number(opts.maxW || 300) || 300));
        var maxH = Math.max(64, Math.floor(Number(opts.maxH || 220) || 220));
        var targetLabel = String(opts.targetLabel || '');
        var noHighlight = !!opts.noHighlight || mode === 'frame';
        if (!canvas || !canvas.getContext || !infoEl) return;
        name = String(name || '');
        idx = Math.max(0, Math.floor(Number(idx || 0) || 0));
        dir = this.normalizeDirection8(Number(dir || 2), 2);
        var ctx = canvas.getContext('2d');
        if (!name.length) {
            canvas.width = 64;
            canvas.height = 64;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            infoEl.textContent = '画像名が未設定です。';
            return;
        }
        var self = this;
        var bmp = ImageManager.loadCharacter(name);
        var draw = function() {
            if (!bmp || !bmp.width || !bmp.height) return;
            var src = bmp._canvas || bmp.canvas || bmp._image || null;
            if (!src) {
                canvas.width = 64;
                canvas.height = 64;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                infoEl.textContent = '画像を描画できません。';
                return;
            }
            var w = Math.max(1, Math.floor(Number(bmp.width || 1)));
            var h = Math.max(1, Math.floor(Number(bmp.height || 1)));
            var scale = Math.min(maxW / Math.max(1, w), maxH / Math.max(1, h));
            if (!isFinite(scale) || scale <= 0) scale = 1;
            var dw = Math.max(1, Math.floor(w * scale));
            var dh = Math.max(1, Math.floor(h * scale));
            canvas.width = dw;
            canvas.height = dh;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, dw, dh);
            ctx.drawImage(src, 0, 0, w, h, 0, 0, dw, dh);

            var row = (dir === 2) ? 0 : (dir === 4 ? 1 : (dir === 6 ? 2 : 3));
            var big = ImageManager.isBigCharacter(name);
            var rx = 0, ry = 0, rw = 1, rh = 1;
            if (big) {
                var bCellH = h / 4;
                rx = 0;
                ry = row * bCellH;
                rw = w;
                rh = bCellH;
            } else {
                var idxClamped = Math.max(0, Math.min(7, idx));
                var charW = w / 4;
                var charH = h / 2;
                var cx = (idxClamped % 4) * charW;
                var cy = Math.floor(idxClamped / 4) * charH;
                var cellH = charH / 4;
                rx = cx;
                ry = cy + row * cellH;
                rw = charW;
                rh = cellH;
            }
            var dx = Math.floor(rx * dw / w) + 0.5;
            var dy = Math.floor(ry * dh / h) + 0.5;
            var dww = Math.max(1, Math.floor(rw * dw / w));
            var dhh = Math.max(1, Math.floor(rh * dh / h));
            if (!noHighlight) {
                ctx.strokeStyle = 'rgba(255,170,70,.98)';
                ctx.lineWidth = 2;
                ctx.strokeRect(dx, dy, dww, dhh);
                ctx.fillStyle = 'rgba(255,150,40,.14)';
                ctx.fillRect(Math.floor(dx), Math.floor(dy), dww, dhh);
            }

            var info = 'name: ' + name + ' / index: ' + idx + ' / direction: ' + dir + ' / sheet: ' + w + 'x' + h;
            if (targetLabel.length) info = '対象: ' + targetLabel + ' / ' + info;
            infoEl.textContent = info;
        };
        if (bmp && typeof bmp.isError === 'function' && bmp.isError()) {
            infoEl.textContent = '画像を読み込めません。';
            return;
        }
        if (bmp && bmp.isReady && bmp.isReady()) draw();
        else if (bmp && bmp.addLoadListener) {
            infoEl.textContent = '画像読み込み中...';
            bmp.addLoadListener(function() {
                if (!self.animPreviewOverlay && !self.animPreviewSheetCanvas) return;
                if (bmp && typeof bmp.isError === 'function' && bmp.isError()) {
                    infoEl.textContent = '画像を読み込めません。';
                    return;
                }
                draw();
            });
        } else {
            infoEl.textContent = '画像を読み込めません。';
        }
    };

    EE.prototype.openAnimationPreviewImageOverlay = function(name, idx, dir, targetLabel, sourceMode) {
        if (!this.animPreviewOverlay || !this.animPreviewOverlayCanvas || !this.animPreviewOverlayInfo) return false;
        this.endAnimationPreviewPanDrag();
        this.animPreviewOverlay.classList.add('on');
        var vw = 0;
        var vh = 0;
        try {
            vw = Math.max(320, Math.floor(Number(window.innerWidth || 0) - 120));
            vh = Math.max(240, Math.floor(Number(window.innerHeight || 0) - 150));
        } catch (_) {
            vw = 640;
            vh = 480;
        }
        this.drawAnimationPreviewSheetCanvas(
            this.animPreviewOverlayCanvas,
            this.animPreviewOverlayInfo,
            name,
                idx,
                dir,
                {
                mode: String(sourceMode || 'overlay'),
                maxW: vw,
                maxH: vh,
                targetLabel: targetLabel,
                noHighlight: String(sourceMode || '') === 'frame'
            }
        );
        return true;
    };

    EE.prototype.openAnimationPreviewImageOverlayFromEditor = function() {
        var state = this.resolveAnimationPreviewOverlayImageState();
        return this.openAnimationPreviewImageOverlay(
            state && state.name,
            state && state.index,
            state && state.direction,
            state && state.targetLabel,
            state && state.mode
        );
    };

    EE.prototype.closeAnimationPreviewImageOverlay = function() {
        if (!this.animPreviewOverlay || !this.animPreviewOverlay.classList) return;
        this.animPreviewOverlay.classList.remove('on');
    };

    EE.prototype.refreshAnimationPreviewSheet = function(force) {
        if (!this.animPreviewSheetWrap || !this.animPreviewSheetCanvas || !this.animPreviewSheetInfo) return;
        var mode = this.editorPreviewMode();
        var visible = this.shouldShowAnimationPreviewInEditor() && (mode === 'image');
        this.animPreviewSheetWrap.classList.toggle('on', visible);
        if (this.animPreviewSheetBtn) {
            this.animPreviewSheetBtn.style.display = (mode === 'image') ? 'none' : '';
            this.animPreviewSheetBtn.textContent = '現在画像';
        }
        if (!visible) return;
        var name = '';
        var idx = 0;
        var dir = 2;
        if (mode === 'image') {
            var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
            name = String(spec && spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec && spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec && spec.imageDir || 2), 2);
        } else {
            var ch = this.animPreviewSourceChar || this.animPreviewProxyChar;
            if (!ch) {
                this.animPreviewSheetInfo.textContent = 'キャラ情報を取得できません。';
                return;
            }
            name = String(ch._characterName || '');
            idx = Math.max(0, Math.floor(Number(ch._characterIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(ch._direction || 2), 2);
        }
        var key = mode + '|' + name + '|' + idx + '|' + dir;
        if (!force && key === this.animPreviewSheetLastKey) return;
        this.animPreviewSheetLastKey = key;
        this.drawAnimationPreviewSheetCanvas(
            this.animPreviewSheetCanvas,
            this.animPreviewSheetInfo,
            name,
            idx,
            dir,
            {
                mode: mode,
                maxW: 300,
                maxH: 240,
                targetLabel: 'setImageZXC'
            }
        );
    };

    EE.prototype.animationPreviewLogTimestamp = function() {
        var d = new Date();
        function z2(v) { return ('0' + v).slice(-2); }
        function z3(v) { return ('00' + v).slice(-3); }
        return z2(d.getHours()) + ':' + z2(d.getMinutes()) + ':' + z2(d.getSeconds()) + '.' + z3(d.getMilliseconds());
    };

    EE.prototype.pushAnimationPreviewLog = function(text, isError) {
        text = String(text == null ? '' : text);
        var line = '[' + this.animationPreviewLogTimestamp() + '] ' + text;
        if (!Array.isArray(this.animPreviewLogLines)) this.animPreviewLogLines = [];
        this.animPreviewLogLines.push(line);
        if (this.animPreviewLogLines.length > 14) this.animPreviewLogLines.splice(0, this.animPreviewLogLines.length - 14);
        if (this.animPreviewLogView) {
            this.animPreviewLogView.textContent = this.animPreviewLogLines.join('\n');
            this.animPreviewLogView.scrollTop = this.animPreviewLogView.scrollHeight;
            this.animPreviewLogView.style.color = isError ? 'rgba(255,178,178,.98)' : 'rgba(198,214,236,.95)';
        }
        try {
            if (isError) console.warn('[EE Preview]', text);
            else console.log('[EE Preview]', text);
        } catch (_) {}
    };

    EE.prototype.clearAnimationPreviewLog = function() {
        this.animPreviewLogLines = [];
        if (this.animPreviewLogView) this.animPreviewLogView.textContent = '';
    };

    EE.prototype.startAnimationPreviewPanDrag = function(clientX, clientY) {
        if (!this.isAnimationPreviewEditorActive()) return false;
        this.animPreviewPanDragging = true;
        this.animPreviewPanLastX = Number(clientX || 0);
        this.animPreviewPanLastY = Number(clientY || 0);
        if (this.animPreviewViewport && this.animPreviewViewport.classList) this.animPreviewViewport.classList.add('dragging');
        return true;
    };

    EE.prototype.updateAnimationPreviewPanDrag = function(clientX, clientY) {
        if (!this.animPreviewPanDragging) return false;
        var x = Number(clientX || 0);
        var y = Number(clientY || 0);
        var dx = x - Number(this.animPreviewPanLastX || 0);
        var dy = y - Number(this.animPreviewPanLastY || 0);
        this.animPreviewPanLastX = x;
        this.animPreviewPanLastY = y;
        if (!isFinite(dx) || !isFinite(dy)) return false;
        this.animPreviewPanX = Math.max(-4096, Math.min(4096, Number(this.animPreviewPanX || 0) + dx));
        this.animPreviewPanY = Math.max(-4096, Math.min(4096, Number(this.animPreviewPanY || 0) + dy));
        return true;
    };

    EE.prototype.endAnimationPreviewPanDrag = function() {
        if (!this.animPreviewPanDragging) return false;
        this.animPreviewPanDragging = false;
        if (this.animPreviewViewport && this.animPreviewViewport.classList) this.animPreviewViewport.classList.remove('dragging');
        return true;
    };

    EE.prototype.clearAnimationPreviewCharacter = function() {
        if (this.animPreviewWorld && Array.isArray(this.animPreviewWorld.children)) {
            var children = this.animPreviewWorld.children.slice(0);
            for (var i = 0; i < children.length; i++) {
                var ch = children[i];
                if (!ch) continue;
                if (ch.parent) {
                    try { ch.parent.removeChild(ch); } catch (_) {}
                }
                if (ch.destroy) {
                    try { ch.destroy({ children: true }); } catch (_) {}
                }
            }
        }
        if (this.animPreviewSprite && this.animPreviewSprite.parent) {
            this.animPreviewSprite.parent.removeChild(this.animPreviewSprite);
        }
        if (this.animPreviewSprite && this.animPreviewSprite.destroy) {
            try { this.animPreviewSprite.destroy({ children: true }); } catch (_) {}
        }
        this.animPreviewSprite = null;
        this.animPreviewProxyChar = null;
        this.animPreviewSourceChar = null;
        this.animPreviewTargetId = null;
    };

    EE.prototype.pruneAnimationPreviewWorldChildren = function() {
        if (!this.animPreviewWorld || !Array.isArray(this.animPreviewWorld.children)) return;
        var children = this.animPreviewWorld.children.slice(0);
        for (var i = 0; i < children.length; i++) {
            var ch = children[i];
            if (!ch) continue;
            var remove = false;
            if (ch._destroyed || ch.destroyed) remove = true;
            if (!remove && ch.parent !== this.animPreviewWorld) remove = true;
            if (!remove && typeof Sprite_Animation !== 'undefined' && ch instanceof Sprite_Animation) {
                if (!ch._animation || !ch._target || ch._target._destroyed || !ch._target.parent) remove = true;
            }
            if (!remove) continue;
            if (ch.parent) {
                try { ch.parent.removeChild(ch); } catch (_) {}
            }
            if (ch.destroy) {
                try { ch.destroy({ children: true }); } catch (_) {}
            }
        }
    };

    EE.prototype.disposeAnimationPreviewRenderer = function() {
        this.clearAnimationPreviewCharacter();
        if (this.animPreviewRenderer && this.animPreviewRenderer.destroy) {
            try { this.animPreviewRenderer.destroy(true); } catch (_) {}
        }
        this.animPreviewRenderer = null;
        this.animPreviewRendererW = 0;
        this.animPreviewRendererH = 0;
        this.animPreviewStage = null;
        this.animPreviewBack = null;
        this.animPreviewWorld = null;
        if (this.animPreviewViewport) this.animPreviewViewport.innerHTML = '';
    };

    EE.prototype.redrawAnimationPreviewBackdrop = function() {
        if (!this.animPreviewBack) return;
        var w = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var h = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        var g = this.animPreviewBack;
        g.clear();
        g.beginFill(0x0b121a, 0.74);
        g.drawRect(0, 0, w, h);
        g.endFill();
        var gy = Math.floor(h * 0.78) + 0.5;
        g.lineStyle(1, 0x6f8fb6, 0.45);
        g.moveTo(0, gy);
        g.lineTo(w, gy);
        g.lineStyle(1, 0x35506f, 0.22);
        var cx = Math.floor(w * 0.5) + 0.5;
        g.moveTo(cx, 0);
        g.lineTo(cx, h);
    };

    EE.prototype.resizeAnimationPreviewRenderer = function() {
        if (!this.animPreviewRenderer || !this.animPreviewViewport) return;
        var w = Math.max(96, Math.floor(Number(this.animPreviewViewport.clientWidth || 0) || 220));
        var h = Math.max(96, Math.floor(Number(this.animPreviewViewport.clientHeight || 0) || 188));
        if (w === this.animPreviewRendererW && h === this.animPreviewRendererH) return;
        this.animPreviewRendererW = w;
        this.animPreviewRendererH = h;
        try { this.animPreviewRenderer.resize(w, h); } catch (_) {}
        this.redrawAnimationPreviewBackdrop();
        var spr = this.animPreviewSprite;
        var anims = spr && Array.isArray(spr._animationSprites) ? spr._animationSprites : [];
        for (var i = 0; i < anims.length; i++) {
            if (!anims[i]) continue;
            anims[i]._eePreviewViewport = { w: w, h: h };
        }
    };

    EE.prototype.ensureAnimationPreviewRenderer = function() {
        if (!this.animPreviewViewport) return false;
        if (typeof PIXI === 'undefined' || !PIXI.autoDetectRenderer || typeof Sprite_Character === 'undefined') {
            this.setAnimationPreviewInfo('プレビューを初期化できません (PIXI/Sprite_Character が未定義です)', true);
            this.pushAnimationPreviewLog('init failed: PIXI/Sprite_Character missing', true);
            return false;
        }
        if (!this.animPreviewRenderer) {
            try {
                this.animPreviewRenderer = PIXI.autoDetectRenderer(220, 188, {
                    transparent: true,
                    antialias: true,
                    preserveDrawingBuffer: false
                });
            } catch (er) {
                this.animPreviewRenderer = null;
                this.setAnimationPreviewInfo('プレビュー初期化失敗: ' + String(er && er.message || er), true);
                this.pushAnimationPreviewLog('renderer create error: ' + String(er && er.message || er), true);
                return false;
            }
            if (!this.animPreviewRenderer || !this.animPreviewRenderer.view) {
                this.setAnimationPreviewInfo('プレビュー初期化に失敗しました', true);
                this.pushAnimationPreviewLog('renderer create failed (no view)', true);
                return false;
            }
            this.animPreviewStage = new PIXI.Container();
            this.animPreviewBack = new PIXI.Graphics();
            this.animPreviewWorld = new PIXI.Container();
            this.animPreviewStage.addChild(this.animPreviewBack);
            this.animPreviewStage.addChild(this.animPreviewWorld);
            this.animPreviewViewport.innerHTML = '';
            this.animPreviewViewport.appendChild(this.animPreviewRenderer.view);
            this.animPreviewRendererW = 0;
            this.animPreviewRendererH = 0;
            this.pushAnimationPreviewLog('renderer created');
        }
        this.resizeAnimationPreviewRenderer();
        return true;
    };

    EE.prototype.ensureAnimationPreviewCharacter = function(targetId) {
        targetId = this.normalizeMoveTarget(Number(targetId || 0));
        var src = this.characterByPanelId ? this.characterByPanelId(targetId) : null;
        if (!src) {
            this.clearAnimationPreviewCharacter();
            this.animPreviewTargetId = targetId;
            this.pushAnimationPreviewLog('target not found: ' + this.animationPreviewTargetName(targetId), true);
            return false;
        }
        if (this.animPreviewSprite && this.animPreviewProxyChar && this.animPreviewSourceChar === src && this.animPreviewTargetId === targetId) {
            return true;
        }
        this.clearAnimationPreviewCharacter();
        this.animPreviewProxyChar = new EE_AnimationPreviewCharacter();
        this.animPreviewProxyChar.syncFrom(src);
        this.animPreviewSprite = new Sprite_Character(this.animPreviewProxyChar);
        if (this.animPreviewWorld) this.animPreviewWorld.addChild(this.animPreviewSprite);
        this.animPreviewSourceChar = src;
        this.animPreviewTargetId = targetId;
        this.pushAnimationPreviewLog('target sync: ' + this.animationPreviewTargetName(targetId));
        return true;
    };

    EE.prototype.playAnimationPreviewFrameNow = function(spec, proxy, spr) {
        if (!spec || !proxy || !spr) return false;
        var wait = Math.max(1, Math.floor(Number(spec.wait || 6) || 6));
        var loop = !!spec.loop;
        var cells = spec.cells;
        if (Array.isArray(cells)) {
            cells = cells.slice(0);
            if (!cells.length) cells = [0, 1, 2];
            for (var i = 0; i < cells.length; i++) cells[i] = Math.floor(Number(cells[i] || 0) || 0);
        } else {
            cells = Math.max(1, Math.floor(Number(cells || 1) || 1));
        }
        if (spec.useImage && spec.imageName != null && String(spec.imageName).length) {
            if (proxy.setImageZXC) proxy.setImageZXC(String(spec.imageName), Math.floor(Number(spec.imageIndex || 0) || 0), this.normalizeDirection8(Number(spec.imageDir || 2), 2));
            else {
                proxy._characterName = String(spec.imageName);
                proxy._characterIndex = Math.floor(Number(spec.imageIndex || 0) || 0);
                proxy._direction = this.normalizeDirection8(Number(spec.imageDir || 2), 2);
                if (spr.updateBitmap) {
                    try { spr.updateBitmap(); } catch (_) {}
                }
            }
        } else if (this.animPreviewSourceChar && proxy.syncFrom) {
            // "画像変更しない"時は現在キャラ状態の画像を使う。
            proxy.syncFrom(this.animPreviewSourceChar);
            if (spr.updateBitmap) {
                try { spr.updateBitmap(); } catch (_) {}
            }
        }
        if (!proxy.startFrameAnimation) {
            this.pushAnimationPreviewLog('play failed: startFrameAnimation missing', true);
            return false;
        }
        try {
            proxy.startFrameAnimation(cells, wait, loop);
            if (spr.update) spr.update();
            this.pushAnimationPreviewLog(
                'play frame: cells=' + (Array.isArray(cells) ? ('[' + cells.join(',') + ']') : String(cells)) +
                ' wait=' + wait + ' loop=' + String(loop)
            );
            return true;
        } catch (er) {
            this.pushAnimationPreviewLog('play frame error: ' + String(er && er.message || er), true);
            return false;
        }
    };

    EE.prototype.playAnimationPreviewNow = function(spec, proxy, spr) {
        if (!spec || !proxy || !spr) return false;
        if (String(spec.mode || '') === 'frame') {
            return this.playAnimationPreviewFrameNow(spec, proxy, spr);
        }
        this.pruneAnimationPreviewWorldChildren();
        var aid = Math.max(1, Math.floor(Number(spec.animationId || 1) || 1));
        var anim = ($dataAnimations && $dataAnimations[aid]) ? $dataAnimations[aid] : null;
        var addX = Number(spec.addX || 0);
        var addY = Number(spec.addY || 0);
        var scale = Number(spec.scale == null ? 1 : spec.scale);
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        if (!anim) {
            this.setAnimationPreviewInfo('未定義アニメーション: ' + aid, true);
            this.pushAnimationPreviewLog('play failed: animation ' + aid + ' not found', true);
            return false;
        }
        var beforeLen = Array.isArray(spr._animationSprites) ? spr._animationSprites.length : 0;
        this.pushAnimationPreviewLog(
            'play req: aid=' + aid +
            ' target=' + this.animationPreviewTargetName(spec.targetId) +
            ' add=(' + Number(spec.addX || 0) + ',' + Number(spec.addY || 0) + ')' +
            ' scale=' + Number(spec.scale == null ? 1 : spec.scale)
        );
        if (proxy.requestAnimation) {
            proxy.requestAnimation(
                aid,
                addX,
                addY,
                scale
            );
        }
        if (spr.setupAnimation) {
            try { spr.setupAnimation(); } catch (_) {}
        }
        var list = Array.isArray(spr._animationSprites) ? spr._animationSprites : [];
        if (list.length <= beforeLen && spr.startAnimation) {
            try { spr.startAnimation(anim, false, 0); } catch (_) {}
            list = Array.isArray(spr._animationSprites) ? spr._animationSprites : [];
        }
        var vw = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var vh = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        for (var i = beforeLen; i < list.length; i++) {
            var a = list[i];
            if (!a) continue;
            a._eePreviewViewport = { w: vw, h: vh };
            // Preview-side hard apply so addX/addY/scale is visible
            // even when runtime hook order differs.
            a._addX = addX;
            a._addY = addY;
            a._scale = scale;
            if (a.scale) {
                a.scale.x = scale;
                a.scale.y = scale;
            }
        }
        var afterLen = list.length;
        if (afterLen <= beforeLen) {
            this.pushAnimationPreviewLog('play result: animation sprite not added', true);
        } else {
            this.pushAnimationPreviewLog('play result: sprites ' + beforeLen + ' -> ' + afterLen);
            this.pushAnimationPreviewLog(
                'play apply: add=(' + addX + ',' + addY + ') scale=' + scale +
                ' animPos=' + Number(anim && anim.position || 0)
            );
        }
        return true;
    };

    EE.prototype.requestAnimationPreviewPlayback = function(immediate) {
        if (!this.shouldShowAnimationPreviewInEditor()) return;
        var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
        if (String(spec && spec.mode || '') === 'image') {
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
            this.refreshAnimationPreviewSheet(false);
            return false;
        }
        var sig = this.animationPreviewStateSig(spec);
        if (immediate && this.isAnimationPreviewEditorActive() && this.ensureAnimationPreviewRenderer()) {
            if (this.ensureAnimationPreviewCharacter(spec.targetId)) {
                var played = this.playAnimationPreviewNow(spec, this.animPreviewProxyChar, this.animPreviewSprite);
                if (played) {
                    this.animPreviewLastAutoSig = sig;
                    this.animPreviewLoopNextAt = Date.now() + this.animationPreviewLoopIntervalMs();
                }
                this.animPreviewPendingSpec = null;
                this.animPreviewPendingSig = '';
                this.animPreviewPendingAt = 0;
                return played;
            }
        }
        if (!immediate && sig === this.animPreviewPendingSig && this.animPreviewPendingSpec) return;
        this.animPreviewPendingSpec = spec;
        this.animPreviewPendingSig = sig;
        this.animPreviewPendingAt = immediate ? 0 : (Date.now() + 120);
        return false;
    };

    EE.prototype.refreshAnimationPreviewPanel = function(forcePlay) {
        var show = this.shouldShowAnimationPreviewInEditor();
        var mode = this.editorPreviewMode();
        if (this.animPreviewWrap) this.animPreviewWrap.style.display = show ? '' : 'none';
        if (this.edSchemaWrap && this.edSchemaWrap.classList) this.edSchemaWrap.classList.toggle('with-apv', !!show);
        if (this.modalWin && this.modalWin.classList) this.modalWin.classList.toggle('with-apv', !!show);
        if (!show) {
            this.endAnimationPreviewPanDrag();
            this.closeAnimationPreviewImageOverlay();
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
            this.animPreviewLastAutoSig = '';
            this.animPreviewLoopNextAt = 0;
            this.animPreviewSheetVisible = false;
            this.animPreviewSheetLastKey = '';
            if (this.animPreviewInfo) this.animPreviewInfo.textContent = '';
            this.clearAnimationPreviewLog();
            this.clearAnimationPreviewCharacter();
            this.refreshAnimationPreviewSheet(true);
            return;
        }
        this.updateAnimationPreviewTitle();
        if (this.animPreviewViewport) this.animPreviewViewport.style.display = (mode === 'image') ? 'none' : '';
        if (this.animPreviewInfo) this.animPreviewInfo.style.display = (mode === 'image') ? 'none' : '';
        if (this.animPreviewLogView) this.animPreviewLogView.style.display = (mode === 'image') ? 'none' : '';
        if (mode === 'image') this.animPreviewSheetVisible = true;
        this.refreshAnimationPreviewSheet(true);
        if (mode === 'image') return;
        if (!this.ensureAnimationPreviewRenderer()) return;
        if (forcePlay) this.requestAnimationPreviewPlayback(true);
    };

    EE.prototype.hasActiveAnimationPreviewSprite = function(spr) {
        if (!spr || !Array.isArray(spr._animationSprites)) return false;
        var list = spr._animationSprites;
        for (var i = 0; i < list.length; i++) {
            var a = list[i];
            if (!a || a._destroyed || a.destroyed) continue;
            if (a.parent == null) continue;
            if (typeof a.isPlaying === 'function') {
                try {
                    if (a.isPlaying()) return true;
                } catch (_) {}
            }
            if (a._duration == null || Number(a._duration || 0) > 0) return true;
        }
        return false;
    };

    EE.prototype.animationPreviewLoopIntervalFrames = function() {
        return 40;
    };

    EE.prototype.animationPreviewLoopIntervalMs = function() {
        var frames = Math.max(1, Math.floor(Number(this.animationPreviewLoopIntervalFrames() || 1) || 1));
        return Math.max(1, Math.round(frames * (1000 / 60)));
    };

    EE.prototype.updateAnimationPreview = function() {
        if (!this.isAnimationPreviewEditorActive()) return;
        var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
        var mode = String(spec && spec.mode || 'animation');
        if (mode === 'image') {
            this.refreshAnimationPreviewSheet(false);
            return;
        }
        if (!this.ensureAnimationPreviewRenderer()) return;
        if (!this.ensureAnimationPreviewCharacter(spec.targetId)) {
            this.setAnimationPreviewInfo('対象キャラを取得できません: ' + this.animationPreviewTargetName(spec.targetId), true);
            if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
            return;
        }
        var src = this.animPreviewSourceChar;
        var proxy = this.animPreviewProxyChar;
        var spr = this.animPreviewSprite;
        if (!src || !proxy || !spr) return;
        if (!(mode === 'frame' && proxy._frameAnimation)) {
            proxy.syncFrom(src);
        }
        var now = Date.now();
        if (this.animPreviewPendingSpec && now >= this.animPreviewPendingAt) {
            var ps = this.animPreviewPendingSpec;
            if (this.playAnimationPreviewNow(ps, proxy, spr)) {
                this.animPreviewLastAutoSig = this.animPreviewPendingSig || this.animationPreviewStateSig(ps);
                this.animPreviewLoopNextAt = now + this.animationPreviewLoopIntervalMs();
            } else {
                this.animPreviewLoopNextAt = now + 250;
            }
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
        }
        if (mode === 'frame' && proxy.updateAnimation) {
            try { proxy.updateAnimation(); } catch (er2) {
                this.pushAnimationPreviewLog('frame update error: ' + String(er2 && er2.message || er2), true);
            }
        }
        this.pruneAnimationPreviewWorldChildren();
        if (this.animPreviewWorld && Array.isArray(this.animPreviewWorld.children)) {
            var children = this.animPreviewWorld.children.slice(0);
            for (var ci = 0; ci < children.length; ci++) {
                var child = children[ci];
                if (!child || child._destroyed || child.destroyed) continue;
                if (child.parent !== this.animPreviewWorld) continue;
                if (typeof Sprite_Animation !== 'undefined' && child instanceof Sprite_Animation) {
                    if (!child._animation || !child._target || child._target._destroyed || !child._target.parent) continue;
                }
                if (typeof child.update !== 'function') continue;
                try {
                    child.update();
                } catch (er) {
                    this.pushAnimationPreviewLog('child update error: ' + String(er && er.message || er), true);
                }
            }
        } else if (spr.update) {
            spr.update();
        }
        var w = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var h = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        var sx = 0;
        var sy = 0;
        try { sx = Number(src.screenX ? src.screenX() : proxy.screenX()); } catch (_) { sx = Number(proxy.screenX ? proxy.screenX() : 0); }
        try { sy = Number(src.screenY ? src.screenY() : proxy.screenY()); } catch (_) { sy = Number(proxy.screenY ? proxy.screenY() : 0); }
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        if (this.animPreviewWorld) {
            this.animPreviewWorld.position.x = Math.floor(w * 0.5 + Number(this.animPreviewPanX || 0));
            this.animPreviewWorld.position.y = Math.floor(h * 0.78 + Number(this.animPreviewPanY || 0));
            this.animPreviewWorld.pivot.x = sx;
            this.animPreviewWorld.pivot.y = sy;
        }
        var hasActive = (mode === 'frame')
            ? !!(proxy && proxy._frameAnimation)
            : this.hasActiveAnimationPreviewSprite(spr);
        if (!hasActive && !this.animPreviewPendingSpec && now >= Number(this.animPreviewLoopNextAt || 0)) {
            var currentSig = this.animationPreviewStateSig(spec);
            if (this.playAnimationPreviewNow(spec, proxy, spr)) {
                this.animPreviewLastAutoSig = currentSig;
                this.animPreviewLoopNextAt = now + this.animationPreviewLoopIntervalMs();
            } else {
                this.animPreviewLoopNextAt = now + 250;
            }
        }
        if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
        var msg = '';
        if (mode === 'frame') {
            msg = '対象:' + this.animationPreviewTargetName(spec.targetId) +
                ' / frame:' + String(spec.frameSpec == null ? '' : spec.frameSpec) +
                ' / wait:' + Math.max(1, Math.floor(Number(spec.wait || 6) || 6)) +
                ' / loop:' + (spec.loop ? 'ON' : 'OFF') +
                ' / pan:(' + Math.round(Number(this.animPreviewPanX || 0)) + ',' + Math.round(Number(this.animPreviewPanY || 0)) + ')';
        } else {
            var animId = Math.max(1, Math.floor(Number(spec.animationId || 1) || 1));
            var animName = ($dataAnimations && $dataAnimations[animId] && $dataAnimations[animId].name)
                ? String($dataAnimations[animId].name)
                : '';
            msg = '対象:' + this.animationPreviewTargetName(spec.targetId) +
                ' / アニメ:' + ('0000' + animId).slice(-4) + (animName ? (' ' + animName) : '') +
                ' / pan:(' + Math.round(Number(this.animPreviewPanX || 0)) + ',' + Math.round(Number(this.animPreviewPanY || 0)) + ')';
        }
        this.setAnimationPreviewInfo(msg, false);
        this.refreshAnimationPreviewSheet(false);
    };

    EE.prototype.setEditorLayout = function(mode) {
        mode = String(mode || 'generic');
        var hideGeneric = (mode === 'message101' || mode === 'switch121' || mode === 'schema');
        if (this.edGenericWrap) this.edGenericWrap.style.display = hideGeneric ? 'none' : '';
        if (this.ed101Wrap) this.ed101Wrap.style.display = (mode === 'message101') ? '' : 'none';
        if (this.ed121Wrap) this.ed121Wrap.style.display = (mode === 'switch121') ? '' : 'none';
        if (this.edSchemaWrap) this.edSchemaWrap.style.display = (mode === 'schema') ? '' : 'none';
        this.edMessageLabel.style.display = 'none';
        this.edMessageText.style.display = 'none';
        this.edCommentLabel.style.display = (mode === 'comment') ? '' : 'none';
        this.edCommentText.style.display = (mode === 'comment') ? '' : 'none';
        this.edScriptLabel.style.display = (mode === 'script') ? '' : 'none';
        this.edScriptText.style.display = (mode === 'script') ? '' : 'none';
        this.refreshAnimationPreviewPanel(false);
    };

    EE.prototype.switchMaxId = function() {
        var arr = $dataSystem && Array.isArray($dataSystem.switches) ? $dataSystem.switches : null;
        return Math.max(1, arr ? (arr.length - 1) : 1);
    };

    EE.prototype.clampSwitchId = function(v) {
        var n = Math.floor(Number(v || 1) || 1);
        var mx = this.switchMaxId();
        if (n < 1) n = 1;
        if (n > mx) n = mx;
        return n;
    };

    EE.prototype.switchNameById = function(id) {
        id = this.clampSwitchId(id);
        var arr = $dataSystem && Array.isArray($dataSystem.switches) ? $dataSystem.switches : null;
        var nm = arr && arr[id] ? String(arr[id]) : '';
        if (!nm.length) nm = '(未設定)';
        return nm;
    };

    EE.prototype.switchIdText = function(id) {
        return ('0000' + this.clampSwitchId(id)).slice(-4);
    };

    EE.prototype.ensureSwitchRangeList = function() {
        if (!this.ed121RangeList) return;
        var mx = this.switchMaxId();
        var blocks = Math.max(1, Math.ceil(mx / 20));
        this.ed121RangeList.innerHTML = '';
        for (var i = 0; i < blocks; i++) {
            var s = i * 20 + 1;
            var e = Math.min(mx, s + 19);
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = '[ ' + this.switchIdText(s) + ' - ' + this.switchIdText(e) + ' ]';
            this.ed121RangeList.appendChild(op);
        }
    };

    EE.prototype.refreshSwitchListByRange = function(rangeIdx) {
        if (!this.ed121SwitchList) return;
        var mx = this.switchMaxId();
        var r = Math.max(0, Math.floor(Number(rangeIdx || 0)));
        var start = r * 20 + 1;
        var end = Math.min(mx, start + 19);
        this.ed121SwitchList.innerHTML = '';
        for (var i = start; i <= end; i++) {
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = this.switchIdText(i) + ' ' + this.switchNameById(i);
            this.ed121SwitchList.appendChild(op);
        }
    };

    EE.prototype.selectSwitchRangeForId = function(id) {
        id = this.clampSwitchId(id);
        var r = Math.max(0, Math.floor((id - 1) / 20));
        if (this.ed121RangeList) this.ed121RangeList.value = String(r);
        this.refreshSwitchListByRange(r);
        if (this.ed121SwitchList) this.ed121SwitchList.value = String(id);
    };

    EE.prototype.syncSwitchEditorType = function() {
        if (!this.ed121From || !this.ed121To || !this.ed121Single) return;
        var single = !!this.ed121Single.checked;
        if (single) this.ed121To.value = this.ed121From.value;
        this.ed121To.disabled = single;
    };

    EE.prototype.syncSwitchFromInput = function() {
        if (!this.ed121From) return;
        var v = this.clampSwitchId(this.ed121From.value);
        this.ed121From.value = String(v);
        if (this.ed121Single && this.ed121Single.checked) this.ed121To.value = String(v);
        this.selectSwitchRangeForId(v);
    };

    EE.prototype.syncSwitchToInput = function() {
        if (!this.ed121To) return;
        var v = this.clampSwitchId(this.ed121To.value);
        this.ed121To.value = String(v);
        this.selectSwitchRangeForId(v);
    };

    EE.prototype.onSwitchListPick = function() {
        if (!this.ed121SwitchList) return;
        var id = this.clampSwitchId(this.ed121SwitchList.value);
        if (this.ed121Single && this.ed121Single.checked) {
            this.ed121From.value = String(id);
            this.ed121To.value = String(id);
            return;
        }
        if (this.ed121PickTarget === 'to') this.ed121To.value = String(id);
        else this.ed121From.value = String(id);
    };

    EE.prototype.setupSwitchEditor = function(params) {
        params = Array.isArray(params) ? params : [];
        var a = this.clampSwitchId(params[0] || 1);
        var b = this.clampSwitchId(params[1] || a);
        var op = Number(params[2] || 0) ? 1 : 0;
        this.ensureSwitchRangeList();
        this.ed121From.value = String(a);
        this.ed121To.value = String(b);
        var single = (a === b);
        this.ed121Single.checked = single;
        this.ed121Range.checked = !single;
        this.syncSwitchEditorType();
        if (op === 0) this.ed121On.checked = true; else this.ed121Off.checked = true;
        this.selectSwitchRangeForId(a);
    };

    EE.prototype.collectSwitchEditorParams = function() {
        var a = this.clampSwitchId(this.ed121From && this.ed121From.value);
        var b = this.clampSwitchId(this.ed121To && this.ed121To.value);
        var single = !!(this.ed121Single && this.ed121Single.checked);
        if (single) b = a;
        if (a > b) {
            var t = a;
            a = b;
            b = t;
        }
        var op = (this.ed121Off && this.ed121Off.checked) ? 1 : 0;
        return [a, b, op];
    };

    EE.prototype.repositionEditorWindow = function() {
        if (!this.modalWin) return;
        var w = this.modalWin;
        var vw = Math.max(320, window.innerWidth || 1280);
        var vh = Math.max(240, window.innerHeight || 720);
        w.style.maxWidth = Math.floor(vw * 0.90) + 'px';
        w.style.maxHeight = Math.floor(vh * 0.84) + 'px';
        if (this.isRouteEditorMapPickerMode && this.isRouteEditorMapPickerMode()) {
            this.applyRouteTileEditorModalMode(true);
            w.style.left = '50%';
            w.style.top = Math.floor(vh * 0.74) + 'px';
            w.style.transform = 'translate(-50%,-50%)';
            var rt = w.getBoundingClientRect();
            var padt = 8;
            var halfH = Math.max(1, Number(rt.height || 0) * 0.5);
            var minCy = padt + halfH;
            var maxCy = vh - padt - halfH;
            var cy = Math.floor(Number(w.style.top.replace('px', '')) || Math.floor(vh * 0.74));
            cy = Math.max(minCy, Math.min(maxCy, cy));
            w.style.top = Math.floor(cy) + 'px';
            this.updateRouteTileEditorModalMask();
            return;
        }
        this.applyRouteTileEditorModalMode(false);
        w.style.left = '50%';
        w.style.top = '50%';
        w.style.transform = 'translate(-50%,-50%)';
        var r = w.getBoundingClientRect();
        var pad = 8;
        if (r.left >= pad && r.top >= pad && r.right <= vw - pad && r.bottom <= vh - pad) return;
        var nx = Math.max(pad, Math.min((vw - r.width) / 2, vw - r.width - pad));
        var ny = Math.max(pad, Math.min((vh - r.height) / 2, vh - r.height - pad));
        w.style.transform = 'none';
        w.style.left = Math.floor(nx) + 'px';
        w.style.top = Math.floor(ny) + 'px';
        this.updateRouteTileEditorModalMask();
    };

    EE.prototype.openEditor = function(uid, routeListIndex) {
        this.closeRouteRangeContextMenu();
        this.closeCameraContextMenu();
        var tr = this.model.tracks[this.selKey];
        if (!tr) return;
        var e = null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === uid) { e = tr.commands[i]; break; }
        }
        if (!e) return;
        this.editUid = uid;
        this.editRouteListIndex = -1;
        this.editSchema = null;
        this.editSchemaBindings = [];
        this.edCode.readOnly = true;
        this.edIndent.disabled = false;
        this.edCommentText.value = '';
        this.edScriptText.value = '';
        this.edMessageText.value = '';
        this.ed101Text.value = '';
        if (this.edDeleteBtn) this.edDeleteBtn.style.display = '';
        this.setEditorLayout('generic');
        var useRoute = (routeListIndex != null && routeListIndex >= 0 && e.command && Number(e.command.code || 0) === 205);
        if (useRoute) {
            var route = e.command.parameters && e.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            var rIdx = Math.floor(Number(routeListIndex || 0));
            var rc = (rIdx >= 0 && rIdx < list.length) ? list[rIdx] : null;
            if (rc && Number(rc.code || 0) !== 0) {
                this.editRouteListIndex = rIdx;
                this.edHead.textContent = '移動ルート内コマンド編集';
                this.edCode.value = String(Number(rc.code || 0));
                this.edCode.readOnly = false;
                this.edIndent.value = '0';
                this.edIndent.disabled = true;
                var routeSchema = this.getRouteEditorSchemaForCommand(rc);
                if (routeSchema) {
                    this.editSchema = routeSchema;
                    var rst = routeSchema.fromRouteCommand ? routeSchema.fromRouteCommand.call(this, rc, e, rIdx) : {};
                    this.renderEditorSchema(routeSchema, rst || {});
                    if (routeSchema.routeCode != null) {
                        this.edCode.value = String(Number(routeSchema.routeCode || 0));
                        this.edCode.readOnly = true;
                    }
                    if (routeSchema.title) this.edHead.textContent = String(routeSchema.title);
                    this.setEditorLayout('schema');
                } else {
                    this.renderParamEditors((rc.parameters || []));
                    this.setEditorLayout('route');
                }
                this.modal.classList.add('on');
                this.refreshAnimationPreviewPanel(false);
                this.repositionEditorWindow();
                var self = this;
                setTimeout(function() { self.repositionEditorWindow(); }, 0);
                return;
            }
        }
        this.edHead.textContent = 'コマンド編集';
        this.edCode.value = String(e.command && e.command.code || 0);
        this.edIndent.value = String(e.command && e.command.indent || 0);
        this.renderParamEditors((e.command && e.command.parameters) || []);
        var schemaCode = (e.command && Number(e.command.code || 0) === 355)
            ? this.mainCommandDisplayCodeForEntry(e)
            : (e.command && e.command.code);
        var schema = this.getEditorSchema(schemaCode);
        schema = this.schemaWithPendingAddWaitLimit(schema, e);
        if (schema) {
            this.editSchema = schema;
            var st = schema.fromEntry ? schema.fromEntry.call(this, e) : {};
            this.renderEditorSchema(schema, st || {});
            if (schema.commandCode != null) {
                this.edCode.value = String(Number(schema.commandCode || 0));
                this.edCode.readOnly = true;
            }
            if (schema.title) this.edHead.textContent = String(schema.title);
            this.setEditorLayout('schema');
        } else if (e.command && e.command.code === 101) {
            var mlines = (e.messageLines && e.messageLines.length ? e.messageLines : []);
            this.ed101Text.value = mlines.join('\n');
            this.edHead.textContent = '文章の表示';
            this.setEditorLayout('message101');
        } else if (e.command && e.command.code === 121) {
            this.setupSwitchEditor(e.command.parameters || []);
            this.edHead.textContent = 'スイッチの操作';
            this.setEditorLayout('switch121');
        } else if (e.command && e.command.code === 108) {
            this.memoApplyParsedStateToEntry(e);
            if (e.isMemo) {
                this.openMemoEditorForEntry(e.uid);
                return;
            }
            this.edCommentText.value = (e.commentLines && e.commentLines.length ? e.commentLines : [String((e.command.parameters || [''])[0] || '')]).join('\n');
            this.edHead.textContent = '注釈';
            this.setEditorLayout('comment');
        } else if (e.command && e.command.code === 355) {
            var slines = (e.scriptLines && e.scriptLines.length)
                ? e.scriptLines
                : [String((e.command.parameters || [''])[0] || '')];
            this.edScriptText.value = slines.join('\n');
            this.edHead.textContent = 'スクリプト';
            this.setEditorLayout('script');
        } else {
            this.setEditorLayout('generic');
        }
        if (this.edDeleteBtn && this._pendingNewUid && Number(uid) === Number(this._pendingNewUid)) {
            this.edDeleteBtn.style.display = 'none';
        }
        this.modal.classList.add('on');
        this.refreshAnimationPreviewPanel(true);
        this.repositionEditorWindow();
        var self = this;
        setTimeout(function() { self.repositionEditorWindow(); }, 0);
    };

    EE.prototype.removeTrackEntryByUid = function(uid) {
        uid = Number(uid || 0);
        if (!uid) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        for (var i = 0; i < tr.commands.length; i++) {
            if (Number(tr.commands[i].uid || 0) !== uid) continue;
            tr.commands.splice(i, 1);
            return true;
        }
        return false;
    };

    EE.prototype.closeEditor = function() {
        if (!this.modal) return;
        this.stopRouteTileEditorPicker();
        this.stopRouteJumpEditorPicker();
        var wasPending = (this._pendingNewUid && Number(this.editUid || 0) === Number(this._pendingNewUid));
        var confirmed = !!this._pendingNewConfirmed;
        this.modal.classList.remove('on');
        this.editUid = 0;
        this.editRouteListIndex = -1;
        this.editSchema = null;
        this.editSchemaBindings = [];
        this.refreshAnimationPreviewPanel(false);
        if (wasPending && !confirmed) {
            if (this.removeTrackEntryByUid(this._pendingNewUid)) {
                this.selUid = 0;
                this.selRouteListIndex = -1;
                this.rebuildSchedule();
                this.seek(this.frame);
                this.timelineDirty = true;
            }
        }
        this._pendingNewUid = 0;
        this._pendingNewConfirmed = false;
    };

    EE.prototype.applyEditor = function() {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !this.editUid) return;
        var e = null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === this.editUid) { e = tr.commands[i]; break; }
        }
        if (!e) { this.closeEditor(); return; }
        var isPendingNew = (this._pendingNewUid && Number(e.uid || 0) === Number(this._pendingNewUid));
        var indent = Math.max(0, Math.floor(Number(this.edIndent.value || 0) || 0));
        var params = [];
        var schemaState = null;
        var use101Layout = (this.editRouteListIndex == null || this.editRouteListIndex < 0) &&
            e.command && Number(e.command.code || 0) === 101 &&
            this.ed101Wrap && this.ed101Wrap.style.display !== 'none';
        var use121Layout = (this.editRouteListIndex == null || this.editRouteListIndex < 0) &&
            e.command && Number(e.command.code || 0) === 121 &&
            this.ed121Wrap && this.ed121Wrap.style.display !== 'none';
        var useSchemaLayout = !!this.editSchema &&
            this.edSchemaWrap && this.edSchemaWrap.style.display !== 'none';
        if (use101Layout) {
            // Keep current 101 visual/position parameters as-is; this layout edits text lines only.
            params = Array.isArray(e.command.parameters) ? clone(e.command.parameters) : [];
        } else if (use121Layout) {
            params = this.collectSwitchEditorParams();
        } else if (useSchemaLayout) {
            try {
                schemaState = this.collectEditorSchemaState();
                var schemaSource = e;
                if (this.editRouteListIndex != null && this.editRouteListIndex >= 0 && e.command && Number(e.command.code || 0) === 205) {
                    var srcRoute = e.command.parameters && e.command.parameters[1];
                    var srcList = srcRoute && Array.isArray(srcRoute.list) ? srcRoute.list : null;
                    var srcIdx = Math.floor(Number(this.editRouteListIndex || 0));
                    if (srcList && srcIdx >= 0 && srcIdx < srcList.length) schemaSource = srcList[srcIdx];
                }
                if (this.editSchema && typeof this.editSchema.toParams === 'function') {
                    params = this.editSchema.toParams.call(this, schemaState, schemaSource, e);
                } else {
                    params = [];
                }
                if (!Array.isArray(params)) throw new Error('schema toParams must return array');
            } catch (er2) {
                this.err('E_EDIT_SCHEMA', er2);
                return;
            }
        } else {
            try {
                params = this.collectParamEditors();
            } catch (er) {
                this.err('E_EDIT_PARAM_PARSE', er);
                return;
            }
        }
        if (this.editRouteListIndex != null && this.editRouteListIndex >= 0) {
            if (!e.command || Number(e.command.code || 0) !== 205) { this.closeEditor(); return; }
            var route = e.command.parameters && e.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : null;
            var idx = Math.floor(Number(this.editRouteListIndex || 0));
            if (!list || idx < 0 || idx >= list.length || Number((list[idx] || {}).code || 0) === 0) {
                this.err('E_EDIT_ROUTE_TARGET', new Error('move route command not found'));
                return;
            }
            var newCode = Math.floor(Number(this.edCode.value || 0) || 0);
            if (newCode <= 0) {
                this.err('E_EDIT_ROUTE_CODE', new Error('route command code must be positive'));
                return;
            }
            this.pushSnap('editRouteCmd');
            var oldList = clone(list);
            var oldWait = e.wait;
            if (this.editSchema && this.editSchema.routeCode != null) {
                newCode = Math.floor(Number(this.editSchema.routeCode || newCode));
            }
            list[idx].code = newCode;
            list[idx].parameters = params;
            if (useSchemaLayout && this.editSchema && typeof this.editSchema.applyRouteCommand === 'function') {
                try {
                    this.editSchema.applyRouteCommand.call(this, list, idx, schemaState || {}, e);
                } catch (er4) {
                    this.err('E_EDIT_SCHEMA_APPLY', er4);
                    return;
                }
            }
            e.wait = this.commandWaitFrames(e.command);
            if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
                route.list = oldList;
                e.wait = oldWait;
                this.err('E_EDIT_COLLISION', new Error('command overlaps with wait-range'));
                return;
            }
            this.dirty[this.selKey] = true;
            tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
            this.rebuildSchedule();
            this.seek(this.frame);
            if (isPendingNew) this._pendingNewConfirmed = true;
            this.closeEditor();
            return;
        }
        if (!isPendingNew) this.pushSnap('editCmd');
        e.command.indent = indent;
        e.command.parameters = params;
        if (useSchemaLayout && this.editSchema && typeof this.editSchema.applyEntry === 'function') {
            try {
                this.editSchema.applyEntry.call(this, e, schemaState || {});
            } catch (er3) {
                this.err('E_EDIT_SCHEMA_APPLY', er3);
                return;
            }
        }
        if (e.command.code === 101) {
            var schema101 = useSchemaLayout && this.editSchema && Number(this.editSchema.code || 0) === 101;
            var mtxt = '';
            if (schema101) mtxt = String((schemaState && schemaState.text) || '');
            else mtxt = String((use101Layout ? this.ed101Text.value : this.edMessageText.value) || '');
            var mlines = mtxt.length ? mtxt.split(/\r?\n/) : [];
            e.messageLines = mlines;
            e.wait = 0;
            e.isMessage = true;
            e.isComment = false;
            e.commentLines = null;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isScript = false;
            e.scriptLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else if (e.command.code === 108) {
            var lines = String(this.edCommentText.value || '').split(/\r?\n/);
            if (!lines.length) lines = [''];
            e.commentLines = lines;
            e.command.parameters = [lines[0]];
            e.wait = 0;
            e.isComment = true;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.isScript = false;
            e.scriptLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else if (e.command.code === 355) {
            var slines;
            if (useSchemaLayout && this.editSchema && this.editSchema.script355) {
                slines = [String((params && params.length) ? params[0] : '')];
            } else {
                var stxt = String(this.edScriptText.value || '');
                slines = stxt.length ? stxt.split(/\r?\n/) : [''];
            }
            e.scriptLines = slines;
            e.command.parameters = [String(slines[0] || '')];
            e.wait = 0;
            e.isScript = true;
            e.isComment = false;
            e.commentLines = null;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else if (e.command.code === 105) {
            if (!Array.isArray(e.scrollLines)) {
                e.scrollLines = this.linesFromText(schemaState && schemaState.text, true);
            }
            e.wait = 0;
            e.isScrollMessage = true;
            e.isComment = false;
            e.commentLines = null;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.isScript = false;
            e.scriptLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else {
            e.wait = this.commandWaitFrames(e.command);
            e.isComment = false;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.commentLines = null;
            e.isScript = false;
            e.scriptLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            if (e.command.code === 205) {
                e.rowType = 'char';
                e.charId = this.normalizeMoveTarget(Number(e.command.parameters[0] || 0));
                e.rowKey = 'char:' + e.charId;
                e.command.parameters[0] = e.charId;
            } else {
                e.rowType = 'main';
                e.charId = null;
                e.rowKey = 'main';
            }
        }
        if (!isPendingNew && !this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
            this.err('E_EDIT_COLLISION', new Error('command overlaps with wait-range'));
            return;
        }
        if (isPendingNew) {
            if (!this.finalizePendingAddEntry(tr, e)) return;
            this.closeEditor();
            return;
        }
        this.dirty[this.selKey] = true;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.closeEditor();
    };

    EE.prototype.bind = function() {
        var self = this;
        this.timeline.addEventListener('mousemove', function(e) {
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            self.onTimelineMove(e);
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        });
        this.timeline.addEventListener('mousedown', function(e) { self.onTimelineDown(e); });
        this.timeline.addEventListener('dblclick', function(e) { self.onTimelineDblClick(e); });
        this.timeline.addEventListener('contextmenu', function(e) { self.onTimelineContextMenu(e); });
        this.timeline.addEventListener('mouseleave', function() { self.onTimelineLeave(); });
        this.timeline.addEventListener('wheel', function(e) { self.onTimelineWheel(e); }, { passive: false });
        this.timelineWrap.addEventListener('scroll', function() { self.timelineDirty = true; });
        this._mm = function(e) {
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            if (self.updateAnimationPreviewPanDrag(self.lastPointerClientX, self.lastPointerClientY)) return;
            self.onTimelineMove(e);
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        };
        this._mu = function(e) {
            self.endAnimationPreviewPanDrag();
            self.onTimelineUp(e);
        };
        window.addEventListener('mousemove', this._mm, true);
        window.addEventListener('mouseup', this._mu, true);
        this.kd = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeAnimationPreviewImageOverlay();
                }
                return;
            }
            if (e.code === 'Space' || e.key === ' ') self.spaceDown = true;
            if (e.code === 'Space' || e.key === ' ') self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
            if (self.routeModal && self.routeModal.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeRouteCommandPanel();
                return;
            }
            if (self.charCtx && self.charCtx.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeCharContextMenu();
                return;
            }
            if (self.cameraCtx && self.cameraCtx.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeCameraContextMenu();
                return;
            }
            if (self.routeCtx && self.routeCtx.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeRouteRangeContextMenu();
                return;
            }
            if (self.waitInsertModal && self.waitInsertModal.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeWaitInsertDialog();
                return;
            }
            if (self.memoModal && self.memoModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeMemoEditor();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.submitMemoEditor();
                    return;
                }
                return;
            }
            if (self.addModal && self.addModal.classList.contains('on')) {
                if (e.key === 'Escape') { e.preventDefault(); self.closeAddCommandPanel(); }
                return;
            }
            if (self.modal && self.modal.classList.contains('on')) {
                if (e.key === 'Escape') { e.preventDefault(); self.closeEditor(); }
                return;
            }
            var target = e.target;
            var tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
            var isTypingTarget = !!(target && (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'));
            var key = (e.key || '').toLowerCase();
            if (!isTypingTarget && !self.play && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    var dir = (e.key === 'ArrowLeft') ? -1 : 1;
                    if (e.shiftKey) {
                        if (self.hasTimelineNudgeTarget && self.hasTimelineNudgeTarget()) {
                            self.nudgeSelectedTimelineByFrames(dir);
                            return;
                        }
                        self.seek(Math.max(0, Math.floor(Number(self.frame || 0)) + dir * 30));
                    } else {
                        self.seek(Math.max(0, Math.floor(Number(self.frame || 0)) + dir));
                    }
                    self.timelineDirty = true;
                    return;
                }
                if (key === 'delete' || key === 'backspace') {
                    if (self.hasRangeSelection && self.hasRangeSelection()) {
                        e.preventDefault();
                        self.deleteRangeSelection();
                    } else if (self.selUid) {
                        e.preventDefault();
                        self.delSel();
                    }
                    return;
                }
            }
            if (key === ' ' || e.code === 'Space') {
                if (self.controlMode) {
                    e.preventDefault();
                    var wasPlaying = !!self.play;
                    self.manualPause = !self.manualPause;
                    self.play = !self.manualPause;
                    if (!wasPlaying && self.play) self.playStartFrame = Math.max(0, Math.floor(Number(self.frame || 0)));
                    if (wasPlaying && !self.play) self.clearMessageRuntimeState();
                    self.setPlayBtn();
                    self.msg(self.play ? 'Play ON' : 'Play OFF (space)');
                }
                return;
            }
            if (e.ctrlKey && key === 'r') {
                e.preventDefault();
                if (self.play) {
                    self.seek(Math.max(0, Math.floor(Number(self.playStartFrame || 0))));
                    self.msg('play開始前フレームへ移動');
                    return;
                }
                self.setInteractionMode(self.controlMode ? 'timeline' : 'game', 'ctrl+r');
                return;
            }
            if (!e.ctrlKey) return;
            var k = key;
            if (k === 'z') { e.preventDefault(); self.undo(); }
            else if (k === 'y') { e.preventDefault(); self.redo(); }
            else if (k === 'c') { e.preventDefault(); self.copy(); }
            else if (k === 'v') { e.preventDefault(); self.paste(); }
            else if (k === 'x') { e.preventDefault(); self.cut(); }
            else if (k === 's') { e.preventDefault(); self.save(!!e.shiftKey); }
        };
        document.addEventListener('keydown', this.kd, true);
        this.ku = function(e) {
            if (e.code === 'Space' || e.key === ' ') {
                self.spaceDown = false;
                if (self.panState) self.endSpacePanDrag();
                self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
            }
        };
        document.addEventListener('keyup', this.ku, true);
        this._wb = function() {
            self.spaceDown = false;
            self.endAnimationPreviewPanDrag();
            if (self.panState) self.endSpacePanDrag();
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        };
        window.addEventListener('blur', this._wb, true);
        this._wh = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) return;
            if (self.onEditorNumberWheel(e)) return;
            self.onEditorSelectWheel(e);
        };
        document.addEventListener('wheel', this._wh, { capture: true, passive: false });
        this._md = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) return;
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            if (self.charCtx && self.charCtx.classList && self.charCtx.classList.contains('on')) {
                var mr = self.charCtx.getBoundingClientRect();
                var inMenu = (e.clientX >= mr.left && e.clientX <= mr.right && e.clientY >= mr.top && e.clientY <= mr.bottom);
                if (!inMenu) self.closeCharContextMenu();
            }
            if (self.cameraCtx && self.cameraCtx.classList && self.cameraCtx.classList.contains('on')) {
                var cr = self.cameraCtx.getBoundingClientRect();
                var inCamMenu = (e.clientX >= cr.left && e.clientX <= cr.right && e.clientY >= cr.top && e.clientY <= cr.bottom);
                if (!inCamMenu) self.closeCameraContextMenu();
            }
            if (self.routeCtx && self.routeCtx.classList && self.routeCtx.classList.contains('on')) {
                var rr = self.routeCtx.getBoundingClientRect();
                var inRouteMenu = (e.clientX >= rr.left && e.clientX <= rr.right && e.clientY >= rr.top && e.clientY <= rr.bottom);
                if (!inRouteMenu) self.closeRouteRangeContextMenu();
            }
            if (e.button !== 0) return;
            if (self.onUi(e.clientX, e.clientY)) {
                return;
            }
            if (self.tryCenterGameFrameOnClick(e)) return;
            if (self.tryStartSpacePanOnGame(e)) return;
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        };
        document.addEventListener('mousedown', this._md, true);
        this._cm = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) {
                e.preventDefault();
                e.stopPropagation();
                self.closeAnimationPreviewImageOverlay();
                return;
            }
            if (self.dragMode === 'tile') return;
            var sx = Number(e.clientX || 0);
            var sy = Number(e.clientY || 0);
            if (!self.isPointOnGameFrameBorder(sx, sy)) return;
            self.onGameFrameContextMenu(e);
        };
        document.addEventListener('contextmenu', this._cm, true);
        this.rs = function() {
            self.applyGameViewport();
            self.syncTimelineSize();
            self.resizeAnimationPreviewRenderer();
            if (self.modal && self.modal.classList.contains('on')) self.repositionEditorWindow();
            if (self.addModal && self.addModal.classList.contains('on')) self.renderAddCommandPage();
            self.timelineDirty = true;
        };
        window.addEventListener('resize', this.rs);
    };

    EE.prototype.unbind = function() {
        if (this.dragMode === 'tile') this.cancelTileMoveMode(true);
        this.stopRouteTileEditorPicker();
        this.stopRouteJumpEditorPicker();
        this.stopTimelineAutoScrollAnimation();
        this.stopGameFrameCenterAnimation();
        this.closeAnimationPreviewImageOverlay();
        this.disposeAnimationPreviewRenderer();
        if (this.kd) document.removeEventListener('keydown', this.kd, true);
        if (this.ku) document.removeEventListener('keyup', this.ku, true);
        if (this._md) document.removeEventListener('mousedown', this._md, true);
        if (this._cm) document.removeEventListener('contextmenu', this._cm, true);
        if (this.rs) window.removeEventListener('resize', this.rs);
        if (this._wb) window.removeEventListener('blur', this._wb, true);
        if (this._wh) document.removeEventListener('wheel', this._wh, true);
        if (this._mm) window.removeEventListener('mousemove', this._mm, true);
        if (this._mu) window.removeEventListener('mouseup', this._mu, true);
        this.endSpacePanDrag();
        this.spaceDown = false;
        this.refreshSpacePanCursor(this.lastPointerClientX, this.lastPointerClientY);
        this.kd = null;
        this.ku = null;
        this._md = null;
        this._cm = null;
        this.rs = null;
        this._wb = null;
        this._wh = null;
        this._mm = null;
        this._mu = null;
    };

    EE.prototype.shrink = function() {
        var sc = this.s;
        var ss = this.s && this.s._spriteset;
        if (!ss || !sc) return;
        this.savedSceneTransform = {
            sx: Number(sc.scale && sc.scale.x != null ? sc.scale.x : 1),
            sy: Number(sc.scale && sc.scale.y != null ? sc.scale.y : 1),
            x: Number(sc.x || 0),
            y: Number(sc.y || 0)
        };
        this.savedScale = { sx: ss.scale.x, sy: ss.scale.y, x: ss.x, y: ss.y };
        this.applyGameViewport();
    };

    EE.prototype.restoreShrink = function() {
        this.clearGameClipMask();
        var sc = this.s;
        var ss = this.s && this.s._spriteset;
        if (!ss || !this.savedScale) return;
        ss.scale.x = this.savedScale.sx;
        ss.scale.y = this.savedScale.sy;
        ss.x = this.savedScale.x;
        ss.y = this.savedScale.y;
        if (sc && this.savedSceneTransform) {
            sc.scale.x = this.savedSceneTransform.sx;
            sc.scale.y = this.savedSceneTransform.sy;
            sc.x = this.savedSceneTransform.x;
            sc.y = this.savedSceneTransform.y;
        }
    };

    EE.prototype.timelineTopInCanvasY = function() {
        var gh = Number(Graphics.boxHeight || Graphics.height || 624);
        var fallback = Math.max(1, Math.floor(gh * 0.5) - 4);
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        var panel = this.timelinePanel;
        if (!panel || !cr || !cr.height || !panel.getBoundingClientRect) return fallback;
        if (panel.style && panel.style.display === 'none') return fallback;
        var pr = panel.getBoundingClientRect();
        if (pr.height < 1) return fallback;
        var y = (pr.top - cr.top) * (gh / Math.max(1, cr.height));
        if (!isFinite(y)) return fallback;
        return Math.max(1, Math.min(gh, Math.floor(y)));
    };

    EE.prototype.timelineTopInScreenY = function() {
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr || !cr.height) return Math.max(0, Math.floor((window.innerHeight || 0) * 0.5));
        var gh = Number(Graphics.boxHeight || Graphics.height || 624);
        var cy = this.timelineTopInCanvasY();
        var sy = cr.top + cy * (cr.height / Math.max(1, gh));
        if (!isFinite(sy)) return Math.max(0, Math.floor((window.innerHeight || 0) * 0.5));
        return Math.max(0, Math.floor(sy));
    };

    EE.prototype.fixedViewportRectScreen = function() {
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        var leftPad = 380;
        var rightPad = 380;
        var topPad = 0;
        var fixedH = 420;
        var x = Math.max(0, Math.floor(leftPad));
        var y = Math.max(0, Math.floor(topPad));
        var w = Math.max(1, Math.floor(ww - leftPad - rightPad));
        if (x + w > ww) {
            x = 0;
            w = ww;
        }
        var h = Math.max(1, Math.floor(fixedH));
        if (y + h > wh) {
            y = Math.max(0, Math.floor(wh - h));
            if (y + h > wh) h = Math.max(1, wh - y);
        }
        return { x: x, y: y, w: w, h: h };
    };

    EE.prototype.fixedViewportRectCanvas = function() {
        var sr = this.fixedViewportRectScreen();
        if (!sr) return null;
        var p1 = this.screenPointToCanvas(sr.x, sr.y);
        var p2 = this.screenPointToCanvas(sr.x + sr.w, sr.y + sr.h);
        if (!p1 || !p2) return null;
        var x1 = Math.min(Number(p1.x || 0), Number(p2.x || 0));
        var y1 = Math.min(Number(p1.y || 0), Number(p2.y || 0));
        var x2 = Math.max(Number(p1.x || 0), Number(p2.x || 0));
        var y2 = Math.max(Number(p1.y || 0), Number(p2.y || 0));
        return {
            x: Math.floor(x1),
            y: Math.floor(y1),
            w: Math.max(1, Math.floor(x2 - x1)),
            h: Math.max(1, Math.floor(y2 - y1))
        };
    };

    EE.prototype.isPointInFixedViewportRect = function(x, y) {
        var r = this.fixedViewportRectScreen();
        if (!r) return false;
        x = Number(x || 0);
        y = Number(y || 0);
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };

    EE.prototype.updateGameViewportGuards = function() {
        var gs = this.gameViewportGuards;
        if (!gs) return;
        var r = this.fixedViewportRectScreen();
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        if (!r) {
            var all = [gs.top, gs.left, gs.right, gs.bottom];
            for (var i = 0; i < all.length; i++) if (all[i]) all[i].style.display = 'none';
            return;
        }
        var topH = Math.max(0, r.y);
        var leftW = Math.max(0, r.x);
        var rightX = Math.max(0, Math.floor(r.x + r.w));
        var rightW = Math.max(0, ww - rightX);
        var bottomY = Math.max(0, Math.floor(r.y + r.h));
        var bottomH = Math.max(0, wh - bottomY);
        if (gs.top) {
            gs.top.style.display = topH > 0 ? 'block' : 'none';
            gs.top.style.left = '0px';
            gs.top.style.top = '0px';
            gs.top.style.width = ww + 'px';
            gs.top.style.height = topH + 'px';
        }
        if (gs.left) {
            gs.left.style.display = leftW > 0 ? 'block' : 'none';
            gs.left.style.left = '0px';
            gs.left.style.top = r.y + 'px';
            gs.left.style.width = leftW + 'px';
            gs.left.style.height = Math.max(0, Math.floor(r.h)) + 'px';
        }
        if (gs.right) {
            gs.right.style.display = rightW > 0 ? 'block' : 'none';
            gs.right.style.left = rightX + 'px';
            gs.right.style.top = r.y + 'px';
            gs.right.style.width = rightW + 'px';
            gs.right.style.height = Math.max(0, Math.floor(r.h)) + 'px';
        }
        if (gs.bottom) {
            gs.bottom.style.display = bottomH > 0 ? 'block' : 'none';
            gs.bottom.style.left = '0px';
            gs.bottom.style.top = bottomY + 'px';
            gs.bottom.style.width = ww + 'px';
            gs.bottom.style.height = bottomH + 'px';
        }
    };

    EE.prototype.updateGameBottomMask = function() {
        var bm = this.gameBottomMask;
        if (!bm) return;
        bm.style.display = 'none';
    };

    EE.prototype.ensureEditorDisplayState = function() {
        if (!$gameMap) return;
        var gx = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
        var gy = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
        if (this.editorDisplayX == null || this.editorDisplayY == null) {
            this.editorDisplayX = gx;
            this.editorDisplayY = gy;
        }
        if (this.editorBaseDisplayX == null || this.editorBaseDisplayY == null) {
            this.editorBaseDisplayX = gx;
            this.editorBaseDisplayY = gy;
        }
    };

    EE.prototype.applyEditorDisplayState = function() {
        if (this.controlMode) return;
        if (!$gameMap || !$gameMap.setDisplayPos) return;
        this.ensureEditorDisplayState();
        $gameMap.setDisplayPos(Number(this.editorDisplayX || 0), Number(this.editorDisplayY || 0));
        this.editorDisplayX = Number($gameMap._displayX == null ? this.editorDisplayX : $gameMap._displayX);
        this.editorDisplayY = Number($gameMap._displayY == null ? this.editorDisplayY : $gameMap._displayY);
    };

    EE.prototype.updateOverlayClipMask = function() {
        var ov = this.charOverlayLayer;
        if (!ov) return;
        var vr = this.fixedViewportRectScreen();
        ov.style.top = '0px';
        ov.style.left = '0px';
        ov.style.right = '0px';
        ov.style.bottom = '0px';
        ov.style.height = '';
        ov.style.overflow = 'hidden';
        if (!vr || !isFinite(vr.x) || !isFinite(vr.y) || !isFinite(vr.w) || !isFinite(vr.h)) {
            ov.style.clipPath = '';
            ov.style.webkitClipPath = '';
            return;
        }
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        var top = Math.max(0, Math.floor(vr.y));
        var left = Math.max(0, Math.floor(vr.x));
        var right = Math.max(0, ww - Math.floor(vr.x + vr.w));
        var bottom = Math.max(0, wh - Math.floor(vr.y + vr.h));
        var inset = 'inset(' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px)';
        ov.style.clipPath = inset;
        ov.style.webkitClipPath = inset;
    };

    EE.prototype.updateGameClipMask = function() {
        var scene = this.s;
        if (!scene || typeof PIXI === 'undefined' || !PIXI.Graphics) return;
        var parent = scene.parent;
        if (!parent) return;
        if (!this.gameClipMask) this.gameClipMask = new PIXI.Graphics();
        var m = this.gameClipMask;
        if (m.parent !== parent) {
            try { if (m.parent && m.parent.removeChild) m.parent.removeChild(m); } catch (_) {}
            parent.addChild(m);
        }
        var vr = this.fixedViewportRectCanvas();
        var x = vr ? Number(vr.x || 0) : 0;
        var y = vr ? Number(vr.y || 0) : 0;
        var w = vr ? Math.max(1, Math.floor(Number(vr.w || 1))) : Math.max(1, Number(Graphics.boxWidth || Graphics.width || 816));
        var h = vr ? Math.max(1, Math.floor(Number(vr.h || 1))) : Math.max(1, Number(Graphics.boxHeight || Graphics.height || 624));
        m.clear();
        m.beginFill(0xffffff, 1);
        m.drawRect(x, y, w, h);
        m.endFill();
        if (scene.mask !== m) scene.mask = m;
    };

    EE.prototype.clearGameClipMask = function() {
        var scene = this.s;
        var m = this.gameClipMask;
        if (!m) return;
        if (scene && scene.mask === m) scene.mask = null;
        try { if (m.parent && m.parent.removeChild) m.parent.removeChild(m); } catch (_) {}
        try { if (m.destroy) m.destroy(); } catch (_) {}
        this.gameClipMask = null;
    };

    EE.prototype.applyGameViewport = function() {
        var scene = this.s;
        var ss = this.s && this.s._spriteset;
        if (!ss || !scene) return;
        var gw = Number(Graphics.boxWidth || Graphics.width || 816);
        var gh = Number(Graphics.boxHeight || Graphics.height || 624);
        var vr = this.fixedViewportRectCanvas();
        var vw = vr ? Math.max(1, Math.floor(Number(vr.w || 1))) : Math.max(120, gw - 16);
        var vh = vr ? Math.max(1, Math.floor(Number(vr.h || 1))) : Math.max(120, Math.floor(gh * 0.5) - 16);
        var scale = Math.min(vw / Math.max(1, gw), vh / Math.max(1, gh));
        scale *= 0.9;
        scale = Math.max(0.2, Math.min(1, scale));
        scene.scale.x = scale;
        scene.scale.y = scale;
        if (vr) {
            scene.x = Math.floor(Number(vr.x || 0) + (vw - gw * scale) / 2);
            scene.y = Math.floor(Number(vr.y || 0) + (vh - gh * scale) / 2);
        } else {
            scene.x = Math.floor((gw - gw * scale) / 2);
            scene.y = 8;
        }
        if (this.savedScale) {
            ss.scale.x = this.savedScale.sx;
            ss.scale.y = this.savedScale.sy;
            ss.x = this.savedScale.x;
            ss.y = this.savedScale.y;
        }
        this.updateGameClipMask();
        this.updateGameBottomMask();
        this.updateOverlayClipMask();
        this.updateGameViewportGuards();
        this.updateGameFrameVisual();
    };

    EE.prototype.gameRect = function() {
        var scene = this.s;
        if (!scene) return null;
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr) return null;
        var bw = Number(Graphics.width || Graphics.boxWidth || 816);
        var bh = Number(Graphics.height || Graphics.boxHeight || 624);
        var sx = Number(scene.scale && scene.scale.x != null ? scene.scale.x : 1);
        var sy = Number(scene.scale && scene.scale.y != null ? scene.scale.y : 1);
        var ux = cr.width / Math.max(1, bw);
        var uy = cr.height / Math.max(1, bh);
        var x = cr.left + Number(scene.x || 0) * ux;
        var y = cr.top + Number(scene.y || 0) * uy;
        var w = bw * sx * ux;
        var h = bh * sy * uy;
        return { x: x, y: y, w: w, h: h };
    };

    EE.prototype.canvasToScreenRect = function(x, y, w, h) {
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr) return null;
        var bw = Number(Graphics.width || Graphics.boxWidth || 816);
        var bh = Number(Graphics.height || Graphics.boxHeight || 624);
        var sx = cr.width / Math.max(1, bw);
        var sy = cr.height / Math.max(1, bh);
        var rx = cr.left + Number(x || 0) * sx;
        var ry = cr.top + Number(y || 0) * sy;
        var rw = Number(w || 0) * sx;
        var rh = Number(h || 0) * sy;
        return { x: rx, y: ry, w: rw, h: rh };
    };

    EE.prototype.isPointInGameRect = function(x, y) {
        var r = this.gameRect();
        if (!r) return false;
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };

    EE.prototype.isPointOnGameFrameBorder = function(x, y) {
        if (!this.gameFrame || !this.gameFrame.getBoundingClientRect) return false;
        if (this.gameFrame.style && this.gameFrame.style.display === 'none') return false;
        var r = this.gameFrame.getBoundingClientRect();
        if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) return false;
        var bw = 9;
        var inInner =
            x >= (r.left + bw) && x <= (r.right - bw) &&
            y >= (r.top + bw) && y <= (r.bottom - bw);
        return !inInner;
    };

    EE.prototype.updateGameFrameVisual = function() {
        if (!this.gameFrame) return;
        var r = this.gameRect();
        var vr = this.fixedViewportRectScreen();
        if (!r && !vr) {
            this.gameFrame.style.display = 'none';
            if (this.gameViewportFrame) this.gameViewportFrame.style.display = 'none';
            this.updateGameViewportGuards();
            return;
        }
        if (this.gameViewportFrame) {
            if (vr) {
                this.gameViewportFrame.style.display = 'block';
                this.gameViewportFrame.style.left = Math.floor(vr.x) + 'px';
                this.gameViewportFrame.style.top = Math.floor(vr.y) + 'px';
                this.gameViewportFrame.style.width = Math.max(1, Math.floor(vr.w)) + 'px';
                this.gameViewportFrame.style.height = Math.max(1, Math.floor(vr.h)) + 'px';
            } else {
                this.gameViewportFrame.style.display = 'none';
            }
        }
        this.updateGameViewportGuards();
        if (!r) {
            this.gameFrame.style.display = 'none';
            return;
        }
        // Grey frame follows actual game render size (1x => 816x624), not fixed viewport size.
        var gfLeft = Number(r.x || 0) - 9;
        var gfTop = Number(r.y || 0) - 9;
        var gfWidth = Math.max(1, Math.floor(Number(r.w || 1)));
        var gfHeight = Math.max(1, Math.floor(Number(r.h || 1)));
        if (!this.controlMode && r && this.s && $gameMap && this.editorBaseDisplayX != null && this.editorBaseDisplayY != null && this.editorDisplayX != null && this.editorDisplayY != null) {
            var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
            var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
            var bw = Number(Graphics.width || Graphics.boxWidth || 816);
            var bh = Number(Graphics.height || Graphics.boxHeight || 624);
            var ux = cr && cr.width ? (cr.width / Math.max(1, bw)) : 1;
            var uy = cr && cr.height ? (cr.height / Math.max(1, bh)) : 1;
            var scx = Number(this.s.scale && this.s.scale.x != null ? this.s.scale.x : 1);
            var scy = Number(this.s.scale && this.s.scale.y != null ? this.s.scale.y : 1);
            var tw = Number($gameMap.tileWidth ? $gameMap.tileWidth() : 48);
            var th = Number($gameMap.tileHeight ? $gameMap.tileHeight() : 48);
            var dxTiles = Number(this.editorBaseDisplayX || 0) - Number(this.editorDisplayX || 0);
            var dyTiles = Number(this.editorBaseDisplayY || 0) - Number(this.editorDisplayY || 0);
            gfLeft += dxTiles * tw * scx * ux;
            gfTop += dyTiles * th * scy * uy;
        }
        this.gameFrame.style.display = 'block';
        this.gameFrame.style.left = Math.floor(gfLeft) + 'px';
        this.gameFrame.style.top = Math.floor(gfTop) + 'px';
        this.gameFrame.style.width = gfWidth + 'px';
        this.gameFrame.style.height = gfHeight + 'px';
        if (this.play) {
            this.gameFrame.style.borderColor = 'rgba(255,60,170,.95)';
            this.gameFrame.style.boxShadow = '0 0 0 1px rgba(255,180,230,.95) inset';
        } else {
            this.gameFrame.style.borderColor = 'rgba(170,170,170,.95)';
            this.gameFrame.style.boxShadow = '0 0 0 1px rgba(230,230,230,.75) inset';
        }
    };

    EE.prototype.setPlayBtn = function() {
        if (!this.root) return;
        var b = this.root.querySelector('.r .b.good');
        if (!b) return;
        var m = this.controlMode ? 'GAME' : 'EDIT';
        b.textContent = 'Play:' + (this.play ? 'ON' : 'OFF') + ' [' + m + ']';
    };

    EE.prototype.setInteractionMode = function(mode, reason) {
        var m = String(mode || 'timeline').toLowerCase();
        var toGame = (m === 'game');
        var wasGame = !!this.controlMode;
        var wasPlaying = !!this.play;
        this.controlMode = toGame;
        if (!toGame && $gameMap && (wasGame || this.editorDisplayX == null || this.editorDisplayY == null)) {
            var gx = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
            var gy = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
            this.editorDisplayX = gx;
            this.editorDisplayY = gy;
            this.editorBaseDisplayX = gx;
            this.editorBaseDisplayY = gy;
        }
        if (wasGame && !toGame) this._simForceFull = true;
        if (!toGame) this.manualPause = false;
        this.play = toGame ? !this.manualPause : false;
        if (!wasPlaying && this.play) this.playStartFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (wasPlaying && !this.play) this.clearMessageRuntimeState();
        if (this.play) this.rebuildSimAudioPlayback(this.frame);
        else {
            this.stopEditorAudioPlayback();
            this.stopTimelineAutoScrollAnimation();
        }
        this.setPlayBtn();
        this.updateGameFrameVisual();
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        this.msg((toGame ? 'Game control mode' : 'Timeline edit mode') + (reason ? ' [' + reason + ']' : ''));
    };

    EE.prototype.allowGameInput = function() {
        if (!this.on || !this.controlMode) return false;
        if (this.modal && this.modal.classList && this.modal.classList.contains('on')) return false;
        if (this.addModal && this.addModal.classList && this.addModal.classList.contains('on')) return false;
        return true;
    };

    EE.prototype.togglePlay = function() {
        var wasPlaying = !!this.play;
        if (!this.controlMode) {
            this.play = false;
            if (wasPlaying) this.clearMessageRuntimeState();
            this.stopEditorAudioPlayback();
            this.stopTimelineAutoScrollAnimation();
            this.setPlayBtn();
            this.refreshCharacterOverlay(true);
            this.msg('Timeline edit mode: playback is fixed OFF');
            return;
        }
        this.manualPause = !this.manualPause;
        this.play = !this.manualPause;
        if (!wasPlaying && this.play) this.playStartFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (wasPlaying && !this.play) this.clearMessageRuntimeState();
        if (this.play) this.rebuildSimAudioPlayback(this.frame);
        else {
            this.stopEditorAudioPlayback();
            this.stopTimelineAutoScrollAnimation();
        }
        this.setPlayBtn();
        this.refreshCharacterOverlay(true);
        this.msg(this.play ? 'Play ON' : 'Play OFF');
    };

    EE.prototype.isPointInTimelineRect = function(sx, sy) {
        if (!this.timeline || !this.timeline.getBoundingClientRect) return false;
        var r = this.timeline.getBoundingClientRect();
        return sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom;
    };

    EE.prototype.canStartSpacePanAt = function(sx, sy) {
        if (!this.on || !this.isSpacePanModifierActive()) return false;
        sx = Number(sx || 0);
        sy = Number(sy || 0);
        if (this.isPointInTimelineRect(sx, sy)) {
            var r = this.timeline.getBoundingClientRect();
            var x = sx - r.left;
            var y = sy - r.top;
            if (this.hitTestNode(x, y) || this.hitTestBar(x, y) || this.hitTestComment(x, y)) return false;
            return true;
        }
        if (this.onUi(sx, sy)) return false;
        if (!this.isPointInFixedViewportRect(sx, sy)) return false;
        return true;
    };

    EE.prototype.refreshSpacePanCursor = function(sx, sy) {
        if (!this.on) {
            if (this._spaceCursor) {
                this._spaceCursor = '';
                this.setGlobalSpaceCursorClass('');
                if (document && document.body) document.body.style.cursor = '';
                if (document && document.documentElement) document.documentElement.style.cursor = '';
                if (this.root) this.root.style.cursor = '';
                if (Graphics && Graphics._canvas) Graphics._canvas.style.cursor = '';
                if (this.charOverlayLayer) this.charOverlayLayer.style.cursor = '';
                if (this.gameViewportFrame) this.gameViewportFrame.style.cursor = '';
                if (this.gameFrame) this.gameFrame.style.cursor = '';
                if (this.gameViewportGuards) {
                    if (this.gameViewportGuards.top) this.gameViewportGuards.top.style.cursor = '';
                    if (this.gameViewportGuards.left) this.gameViewportGuards.left.style.cursor = '';
                    if (this.gameViewportGuards.right) this.gameViewportGuards.right.style.cursor = '';
                    if (this.gameViewportGuards.bottom) this.gameViewportGuards.bottom.style.cursor = '';
                }
            }
            return;
        }
        var cursor = '';
        if (this.panState) cursor = 'move';
        else if (this.isSpacePanModifierActive()) cursor = 'move';
        else if (this.isPointOnGameFrameBorder(sx, sy)) cursor = 'pointer';
        if (this._spaceCursor === cursor) return;
        this._spaceCursor = cursor;
        this.setGlobalSpaceCursorClass(cursor);
        if (document && document.body) document.body.style.cursor = cursor;
        if (document && document.documentElement) document.documentElement.style.cursor = cursor;
        if (this.root) this.root.style.cursor = cursor;
        if (Graphics && Graphics._canvas) Graphics._canvas.style.cursor = cursor;
        if (this.charOverlayLayer) this.charOverlayLayer.style.cursor = cursor;
        if (this.gameViewportFrame) this.gameViewportFrame.style.cursor = cursor;
        if (this.gameFrame) this.gameFrame.style.cursor = cursor;
        if (this.gameViewportGuards) {
            if (this.gameViewportGuards.top) this.gameViewportGuards.top.style.cursor = cursor;
            if (this.gameViewportGuards.left) this.gameViewportGuards.left.style.cursor = cursor;
            if (this.gameViewportGuards.right) this.gameViewportGuards.right.style.cursor = cursor;
            if (this.gameViewportGuards.bottom) this.gameViewportGuards.bottom.style.cursor = cursor;
        }
        if (this.timeline && this.isPointInTimelineRect(sx, sy)) {
            this.timeline.style.cursor = cursor || 'crosshair';
        }
    };

    EE.prototype.isSpacePanModifierActive = function() {
        return !!this.spaceDown;
    };

    EE.prototype.setGlobalSpaceCursorClass = function(cursor) {
        var de = (typeof document !== 'undefined' && document && document.documentElement) ? document.documentElement : null;
        if (!de || !de.classList) return;
        de.classList.remove('knh-ee-cursor-move');
        if (cursor === 'move') de.classList.add('knh-ee-cursor-move');
    };

    EE.prototype.tryStartSpacePanOnTimeline = function(e, x, y) {
        if (!this.timelineWrap || e.button !== 0) return false;
        if (!this.isSpacePanModifierActive()) return false;
        if (this.hitTestNode(x, y) || this.hitTestBar(x, y) || this.hitTestComment(x, y)) return false;
        this.stopGameFrameCenterAnimation();
        if (this.controlMode) this.setInteractionMode('timeline', 'timeline');
        this._gameFramePanDx = 0;
        this._gameFramePanDy = 0;
        this.panState = {
            mode: 'timeline',
            startClientX: Number(e.clientX || 0),
            startClientY: Number(e.clientY || 0),
            startScrollLeft: Number(this.timelineWrap.scrollLeft || 0),
            startScrollTop: Number(this.timelineWrap.scrollTop || 0),
            moved: false
        };
        this.dragState = null;
        if (this.timeline) this.timeline.style.cursor = 'grabbing';
        this.refreshSpacePanCursor(Number(e.clientX || 0), Number(e.clientY || 0));
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.tryStartSpacePanOnGame = function(e) {
        if (e.button !== 0) return false;
        if (!this.isSpacePanModifierActive()) return false;
        var sx = Number(e.clientX || 0);
        var sy = Number(e.clientY || 0);
        if (!this.isPointInFixedViewportRect(sx, sy)) return false;
        this.stopGameFrameCenterAnimation();
        this.ensureEditorDisplayState();
        this.applyEditorDisplayState();
        var anchorCanvas = this.screenPointToCanvas(sx, sy);
        if (!anchorCanvas) return false;
        var anchor = this.screenToMap(anchorCanvas.x, anchorCanvas.y, 'raw');
        if (!anchor) return false;
        this._gameFramePanDx = 0;
        this._gameFramePanDy = 0;
        this.panState = {
            mode: 'game',
            startClientX: sx,
            startClientY: sy,
            startDisplayX: Number(this.editorDisplayX == null ? 0 : this.editorDisplayX),
            startDisplayY: Number(this.editorDisplayY == null ? 0 : this.editorDisplayY),
            anchorMapX: Number(anchor.x || 0),
            anchorMapY: Number(anchor.y || 0),
            moved: false
        };
        this.dragState = null;
        this.applyGameViewport();
        this.refreshSpacePanCursor(sx, sy);
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.updateSpacePanDrag = function(e) {
        var ps = this.panState;
        if (!ps || !e || e.clientX == null || e.clientY == null) return false;
        var dx = Number(e.clientX || 0) - Number(ps.startClientX || 0);
        var dy = Number(e.clientY || 0) - Number(ps.startClientY || 0);
        if (!ps.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) ps.moved = true;
        if (ps.mode === 'timeline') {
            if (!this.timelineWrap) return true;
            this.timelineWrap.scrollLeft = Math.max(0, Math.floor(Number(ps.startScrollLeft || 0) - dx));
            this.timelineWrap.scrollTop = Math.max(0, Math.floor(Number(ps.startScrollTop || 0) - dy));
            this.timelineDirty = true;
            return true;
        }
        if (ps.mode === 'game') {
            var cx = Number(e.clientX || 0);
            var cy = Number(e.clientY || 0);
            this._gameFramePanDx = dx;
            this._gameFramePanDy = dy;
            this.lastPointerClientX = cx;
            this.lastPointerClientY = cy;
            var cp = this.screenPointToCanvas(cx, cy);
            if (!cp) return true;
            var p = this.screenToMap(cp.x, cp.y, 'raw');
            if (!p) return true;
            this.ensureEditorDisplayState();
            this.editorDisplayX = Number(this.editorDisplayX || 0) + (Number(ps.anchorMapX || 0) - Number(p.x || 0));
            this.editorDisplayY = Number(this.editorDisplayY || 0) + (Number(ps.anchorMapY || 0) - Number(p.y || 0));
            this.applyEditorDisplayState();
            this.applyGameViewport();
            this.stepVisualRuntime();
            this.updateGameFrameVisual();
            this.refreshCharacterOverlay(true);
            this.timelineDirty = true;
            return true;
        }
        return false;
    };

    EE.prototype.stopGameFrameCenterAnimation = function() {
        var st = this._gameFrameCenterAnim;
        if (!st) return;
        if (st.rafId) {
            try { cancelAnimationFrame(st.rafId); } catch (_) {}
        }
        this._gameFrameCenterAnim = null;
    };

    EE.prototype.centerGameFrameIntoViewport = function(durationMs) {
        if (this.controlMode) return false;
        if (!$gameMap || !$gameMap.setDisplayPos) return false;
        if (!this.gameFrame || !this.gameFrame.getBoundingClientRect) return false;
        var vr = this.fixedViewportRectScreen();
        if (!vr) return false;
        var gr = this.gameFrame.getBoundingClientRect();
        if (!(gr.width > 0) || !(gr.height > 0)) return false;
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr || !(cr.width > 0) || !(cr.height > 0)) return false;
        var bw = Number(Graphics.width || Graphics.boxWidth || 816);
        var bh = Number(Graphics.height || Graphics.boxHeight || 624);
        var ux = cr.width / Math.max(1, bw);
        var uy = cr.height / Math.max(1, bh);
        var scx = Number(this.s && this.s.scale && this.s.scale.x != null ? this.s.scale.x : 1);
        var scy = Number(this.s && this.s.scale && this.s.scale.y != null ? this.s.scale.y : 1);
        var tw = Number($gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var pxPerTileX = tw * scx * ux;
        var pxPerTileY = th * scy * uy;
        if (!(pxPerTileX > 1e-6) || !(pxPerTileY > 1e-6)) return false;

        var gcx = Number(gr.left || 0) + Number(gr.width || 0) * 0.5;
        var gcy = Number(gr.top || 0) + Number(gr.height || 0) * 0.5;
        var vcx = Number(vr.x || 0) + Number(vr.w || 0) * 0.5;
        var vcy = Number(vr.y || 0) + Number(vr.h || 0) * 0.5;
        var dxPx = vcx - gcx;
        var dyPx = vcy - gcy;
        if (Math.abs(dxPx) < 0.25 && Math.abs(dyPx) < 0.25) return false;

        this.ensureEditorDisplayState();
        var sx = Number(this.editorDisplayX == null ? 0 : this.editorDisplayX);
        var sy = Number(this.editorDisplayY == null ? 0 : this.editorDisplayY);
        var tx = sx - dxPx / pxPerTileX;
        var ty = sy - dyPx / pxPerTileY;
        var dur = Math.max(80, Math.min(420, Math.floor(Number(durationMs == null ? 180 : durationMs) || 180)));

        this.stopGameFrameCenterAnimation();
        var self = this;
        var st = {
            rafId: 0,
            startAt: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
            duration: dur,
            sx: sx,
            sy: sy,
            tx: tx,
            ty: ty
        };
        this._gameFrameCenterAnim = st;
        var step = function(nowTs) {
            if (self._gameFrameCenterAnim !== st) return;
            var now = Number(nowTs || 0);
            if (!isFinite(now) || now <= 0) now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            var t = (now - Number(st.startAt || 0)) / Math.max(1, Number(st.duration || 1));
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            var ease = 1 - Math.pow(1 - t, 3);
            self.editorDisplayX = Number(st.sx || 0) + (Number(st.tx || 0) - Number(st.sx || 0)) * ease;
            self.editorDisplayY = Number(st.sy || 0) + (Number(st.ty || 0) - Number(st.sy || 0)) * ease;
            self.applyEditorDisplayState();
            self.applyGameViewport();
            self.stepVisualRuntime();
            self.updateGameFrameVisual();
            self.refreshCharacterOverlay(true);
            self.timelineDirty = true;
            if (t >= 1) {
                self._gameFrameCenterAnim = null;
                return;
            }
            st.rafId = requestAnimationFrame(step);
        };
        st.rafId = requestAnimationFrame(step);
        return true;
    };

    EE.prototype.tryCenterGameFrameOnClick = function(e) {
        if (!e || Number(e.button || 0) !== 0) return false;
        if (this.isSpacePanModifierActive()) return false;
        if (this.dragMode === 'tile') return false;
        var sx = Number(e.clientX || 0);
        var sy = Number(e.clientY || 0);
        if (!this.isPointOnGameFrameBorder(sx, sy)) return false;
        this.centerGameFrameIntoViewport(180);
        this.refreshSpacePanCursor(sx, sy);
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.endSpacePanDrag = function() {
        if (!this.panState) return;
        this.panState = null;
        this._gameFramePanDx = 0;
        this._gameFramePanDy = 0;
        this.applyEditorDisplayState();
        this.applyGameViewport();
        this.updateGameFrameVisual();
        this.refreshSpacePanCursor(this.lastPointerClientX, this.lastPointerClientY);
    };

    EE.prototype.tileMoveSnapCoord = function(v) {
        return Math.round(Number(v || 0) * 2) / 2;
    };

    EE.prototype.tileMoveCoordText = function(v) {
        var n = this.tileMoveSnapCoord(v);
        if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
        return n.toFixed(1);
    };

    EE.prototype.characterMoveSpeedForTileMove = function(ch) {
        var sp = 4;
        try {
            if (ch && typeof ch.realMoveSpeed === 'function') sp = Number(ch.realMoveSpeed() || 4);
            else if (ch && typeof ch.moveSpeed === 'function') sp = Number(ch.moveSpeed() || 4);
            else if (ch) sp = Number(ch._moveSpeed == null ? 4 : ch._moveSpeed);
        } catch (_) {
            sp = 4;
        }
        if (!isFinite(sp)) sp = 4;
        return Math.max(1, Math.min(6, sp));
    };

    EE.prototype.tileMoveWaitFrames = function(st, tx, ty) {
        if (!st) return 1;
        var dist = Math.abs(Number(tx || 0) - Number(st.startX || 0)) + Math.abs(Number(ty || 0) - Number(st.startY || 0));
        var step = this.moveStepFrames(Number(st.speed || 4));
        return Math.max(1, Math.ceil(dist * step));
    };

    EE.prototype.lockTileMoveDisplay = function(st) {
        if (!st || !$gameMap || !$gameMap.setDisplayPos) return;
        if (st.baseDisplayX == null || st.baseDisplayY == null) return;
        $gameMap.setDisplayPos(Number(st.baseDisplayX || 0), Number(st.baseDisplayY || 0));
    };

    EE.prototype.findCharacterSpriteByPanelId = function(id) {
        var ss = this.s && this.s._spriteset;
        var ls = ss && ss._characterSprites;
        if (!ls || !ls.length) return null;
        id = Number(id || 0);
        for (var i = ls.length - 1; i >= 0; i--) {
            var sp = ls[i];
            var ch = sp && sp._character;
            if (!sp || !ch) continue;
            try {
                if (id === -1 && typeof Game_Player !== 'undefined' && ch instanceof Game_Player) return sp;
                if (id > 0 && typeof Game_Event !== 'undefined' && ch instanceof Game_Event && ch.eventId && Number(ch.eventId() || 0) === id) return sp;
            } catch (_) {}
        }
        return null;
    };

    EE.prototype.mapPointToScreen = function(mx, my) {
        if (!$gameMap) return null;
        var tw = Number($gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var cx = (Number(mx || 0) - Number($gameMap._displayX || 0)) * tw + tw / 2;
        var cy = (Number(my || 0) - Number($gameMap._displayY || 0)) * th + th;
        var ss = this.s && this.s._spriteset;
        if (ss && ss.worldTransform && typeof PIXI !== 'undefined' && PIXI.Point) {
            try {
                var p = ss.worldTransform.apply(new PIXI.Point(cx, cy));
                return this.canvasPointToScreen(Number(p.x || 0), Number(p.y || 0));
            } catch (_) {}
        }
        return this.canvasPointToScreen(cx, cy);
    };

    EE.prototype.prepareTileMoveStartGhost = function(st) {
        if (!this.tileMoveStartGhost) return;
        this.tileMoveStartGhost.style.display = 'none';
        if (!st) return;
        var sp = this.findCharacterSpriteByPanelId(st.charId);
        if (!sp || !sp.bitmap) return;
        var bm = sp.bitmap;
        var ready = true;
        try { if (typeof bm.isReady === 'function') ready = !!bm.isReady(); } catch (_) {}
        if (!ready) return;
        var src = bm._canvas || bm.canvas || bm._image || null;
        if (!src) return;
        var fr = (sp.texture && sp.texture.frame) ? sp.texture.frame : sp._frame;
        if (!fr) return;
        var sx = Math.floor(Number(fr.x || 0));
        var sy = Math.floor(Number(fr.y || 0));
        var sw = Math.max(1, Math.floor(Number(fr.width || 0)));
        var sh = Math.max(1, Math.floor(Number(fr.height || 0)));
        var cv = this.tileMoveStartGhost;
        cv.width = sw;
        cv.height = sh;
        var ctx = cv.getContext ? cv.getContext('2d') : null;
        if (!ctx) return;
        var scaleX = Number(sp.scale && sp.scale.x != null ? sp.scale.x : 1);
        var scaleY = Number(sp.scale && sp.scale.y != null ? sp.scale.y : 1);
        var flipX = scaleX < 0;
        var flipY = scaleY < 0;
        ctx.clearRect(0, 0, sw, sh);
        ctx.save();
        ctx.translate(flipX ? sw : 0, flipY ? sh : 0);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.restore();
        st.startGhostReady = true;
        st.startGhostW = sw;
        st.startGhostH = sh;
        st.startGhostScaleX = Math.max(0.01, Math.abs(scaleX));
        st.startGhostScaleY = Math.max(0.01, Math.abs(scaleY));
        st.startGhostAnchorX = Number(sp.anchor && sp.anchor.x != null ? sp.anchor.x : 0.5);
        st.startGhostAnchorY = Number(sp.anchor && sp.anchor.y != null ? sp.anchor.y : 1.0);
    };

    EE.prototype.updateTileMoveStartGhost = function(st) {
        var cv = this.tileMoveStartGhost;
        if (!cv) return;
        if (st && !st.startGhostReady) this.prepareTileMoveStartGhost(st);
        if (!st || !st.startGhostReady) {
            cv.style.display = 'none';
            return;
        }
        var pt = this.mapPointToScreen(st.startX, st.startY);
        if (!pt) {
            cv.style.display = 'none';
            return;
        }
        var tileR = this.mapRectToScreen(Number(st.startX || 0), Number(st.startY || 0), 1, 1);
        var tw = Number($gameMap && $gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap && $gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var zx = tileR ? (Number(tileR.w || 0) / Math.max(1, tw)) : 1;
        var zy = tileR ? (Number(tileR.h || 0) / Math.max(1, th)) : 1;
        var dw = Math.max(1, Math.floor(Number(st.startGhostW || 0) * Number(st.startGhostScaleX || 1) * zx));
        var dh = Math.max(1, Math.floor(Number(st.startGhostH || 0) * Number(st.startGhostScaleY || 1) * zy));
        var ax = Number(st.startGhostAnchorX == null ? 0.5 : st.startGhostAnchorX);
        var ay = Number(st.startGhostAnchorY == null ? 1.0 : st.startGhostAnchorY);
        var left = Math.floor(Number(pt.x || 0) - dw * ax);
        var top = Math.floor(Number(pt.y || 0) - dh * ay);
        cv.style.display = 'block';
        cv.style.left = left + 'px';
        cv.style.top = top + 'px';
        cv.style.width = dw + 'px';
        cv.style.height = dh + 'px';
    };

    EE.prototype.setTileMoveOverlayPassthrough = function(on) {
        if (!this.charOverlayLayer || !this.charOverlayLayer.classList) return;
        if (on) this.charOverlayLayer.classList.add('tilemode');
        else this.charOverlayLayer.classList.remove('tilemode');
    };

    EE.prototype.mapRectToScreen = function(mx, my, mw, mh) {
        if (!$gameMap || !this.canvasToScreenRect) return null;
        var tw = Number($gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var cx = (Number(mx || 0) - Number($gameMap._displayX || 0)) * tw;
        var cy = (Number(my || 0) - Number($gameMap._displayY || 0)) * th;
        var cw = Number(mw || 0) * tw;
        var ch = Number(mh || 0) * th;
        var ss = this.s && this.s._spriteset;
        if (ss && ss.worldTransform && typeof PIXI !== 'undefined' && PIXI.Point) {
            try {
                var p1 = ss.worldTransform.apply(new PIXI.Point(cx, cy));
                var p2 = ss.worldTransform.apply(new PIXI.Point(cx + cw, cy + ch));
                var s1 = this.canvasPointToScreen(Number(p1.x || 0), Number(p1.y || 0));
                var s2 = this.canvasPointToScreen(Number(p2.x || 0), Number(p2.y || 0));
                if (s1 && s2) {
                    var x1 = Math.min(Number(s1.x || 0), Number(s2.x || 0));
                    var y1 = Math.min(Number(s1.y || 0), Number(s2.y || 0));
                    var x2 = Math.max(Number(s1.x || 0), Number(s2.x || 0));
                    var y2 = Math.max(Number(s1.y || 0), Number(s2.y || 0));
                    return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
                }
            } catch (_) {}
        }
        return this.canvasToScreenRect(cx, cy, cw, ch);
    };

    EE.prototype.canvasPointToScreen = function(cx, cy) {
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr) return null;
        var bw = Number(Graphics.width || Graphics.boxWidth || 816);
        var bh = Number(Graphics.height || Graphics.boxHeight || 624);
        return {
            x: cr.left + Number(cx || 0) * (cr.width / Math.max(1, bw)),
            y: cr.top + Number(cy || 0) * (cr.height / Math.max(1, bh))
        };
    };

    EE.prototype.screenPointToCanvas = function(sx, sy) {
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr) return null;
        var bw = Number(Graphics.width || Graphics.boxWidth || 816);
        var bh = Number(Graphics.height || Graphics.boxHeight || 624);
        return {
            x: (Number(sx || 0) - cr.left) * (bw / Math.max(1, cr.width)),
            y: (Number(sy || 0) - cr.top) * (bh / Math.max(1, cr.height))
        };
    };

    EE.prototype.updateTileMoveMarker = function(tx, ty, waitFrames, showWait) {
        if (!this.tileMoveMarker || !this.tileMoveMarkerLabel) return;
        if (tx == null || ty == null) {
            this.tileMoveMarker.style.display = 'none';
            return;
        }
        var sr = this.mapRectToScreen(Number(tx || 0) - 0.25, Number(ty || 0) - 0.25, 0.5, 0.5);
        if (!sr) {
            this.tileMoveMarker.style.display = 'none';
            return;
        }
        this.tileMoveMarker.style.display = 'block';
        this.tileMoveMarker.style.left = Math.floor(Number(sr.x || 0)) + 'px';
        this.tileMoveMarker.style.top = Math.floor(Number(sr.y || 0)) + 'px';
        this.tileMoveMarker.style.width = Math.max(8, Math.floor(Number(sr.w || 0))) + 'px';
        this.tileMoveMarker.style.height = Math.max(8, Math.floor(Number(sr.h || 0))) + 'px';
        if (showWait === false) {
            this.tileMoveMarkerLabel.textContent =
                '(' + this.tileMoveCoordText(tx) + ', ' + this.tileMoveCoordText(ty) + ')';
        } else {
            this.tileMoveMarkerLabel.textContent =
                '(' + this.tileMoveCoordText(tx) + ', ' + this.tileMoveCoordText(ty) + ') wait:' + Math.max(1, Math.floor(Number(waitFrames || 1))) + 'f';
        }
    };

    EE.prototype.updateTileMoveStartMarker = function(sx, sy) {
        if (!this.tileMoveStartMarker || !this.tileMoveStartMarkerLabel) return;
        if (sx == null || sy == null) {
            this.tileMoveStartMarker.style.display = 'none';
            return;
        }
        var sr = this.mapRectToScreen(Number(sx || 0) - 0.25, Number(sy || 0) - 0.25, 0.5, 0.5);
        if (!sr) {
            this.tileMoveStartMarker.style.display = 'none';
            return;
        }
        this.tileMoveStartMarker.style.display = 'block';
        this.tileMoveStartMarker.style.left = Math.floor(Number(sr.x || 0)) + 'px';
        this.tileMoveStartMarker.style.top = Math.floor(Number(sr.y || 0)) + 'px';
        this.tileMoveStartMarker.style.width = Math.max(12, Math.floor(Number(sr.w || 0))) + 'px';
        this.tileMoveStartMarker.style.height = Math.max(12, Math.floor(Number(sr.h || 0))) + 'px';
        this.tileMoveStartMarkerLabel.textContent =
            '開始 (' + this.tileMoveCoordText(sx) + ', ' + this.tileMoveCoordText(sy) + ')';
    };

    EE.prototype.clampTileMoveTargetToMap = function(x, y) {
        x = this.tileMoveSnapCoord(x);
        y = this.tileMoveSnapCoord(y);
        var w = Number($dataMap && $dataMap.width || 0);
        var h = Number($dataMap && $dataMap.height || 0);
        if (w > 0) x = Math.max(0, Math.min(Math.max(0, w - 0.5), x));
        if (h > 0) y = Math.max(0, Math.min(Math.max(0, h - 0.5), y));
        return { x: x, y: y };
    };

    EE.prototype.tileMoveTargetFromScreen = function(sx, sy, opt) {
        opt = opt || {};
        if (!opt.ignoreUi && this.onUi(sx, sy)) return null;
        if (opt.blockModal && this.modalWin && this.modal && this.modal.classList && this.modal.classList.contains('on')) {
            var mr = this.modalWin.getBoundingClientRect ? this.modalWin.getBoundingClientRect() : null;
            if (mr && sx >= mr.left && sx <= mr.right && sy >= mr.top && sy <= mr.bottom) return null;
        }
        if (!this.isPointInFixedViewportRect(sx, sy)) return null;
        var cp = this.screenPointToCanvas(sx, sy);
        if (!cp) return null;
        var p = this.screenToMap(cp.x, cp.y, true);
        if (!p) return null;
        return this.clampTileMoveTargetToMap(p.x, p.y);
    };

    EE.prototype.isRouteTileEditorPickerMode = function() {
        if (this.dragMode === 'tile') return false;
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        if (!this.editSchema || Number(this.editSchema.code || 0) !== 4500) return false;
        if (this.editRouteListIndex == null || Number(this.editRouteListIndex) < 0) return false;
        if (!this.edSchemaWrap || this.edSchemaWrap.style.display === 'none') return false;
        return true;
    };

    EE.prototype.isRouteJumpEditorPickerMode = function() {
        if (this.dragMode === 'tile') return false;
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        if (!this.editSchema || Number(this.editSchema.code || 0) !== 14) return false;
        if (this.editRouteListIndex == null || Number(this.editRouteListIndex) < 0) return false;
        if (!this.edSchemaWrap || this.edSchemaWrap.style.display === 'none') return false;
        return true;
    };

    EE.prototype.isRouteEditorMapPickerMode = function() {
        return !!(
            (this.isRouteTileEditorPickerMode && this.isRouteTileEditorPickerMode()) ||
            (this.isRouteJumpEditorPickerMode && this.isRouteJumpEditorPickerMode())
        );
    };

    EE.prototype.applyRouteTileEditorModalMode = function(active) {
        var on = !!active;
        if (this.modal && this.modal.classList) this.modal.classList.toggle('tilepick', on);
        if (this.modalWin && this.modalWin.classList) this.modalWin.classList.toggle('tilepick', on);
        this.updateRouteTileEditorModalMask();
    };

    EE.prototype.updateRouteTileEditorModalMask = function() {
        var m = this.modalTilePickMask;
        if (!m) return;
        var on = !!(this.modal && this.modal.classList && this.modal.classList.contains('tilepick'));
        var all = [m.top, m.left, m.right, m.bottom];
        for (var i = 0; i < all.length; i++) {
            if (!all[i]) continue;
            all[i].style.display = on ? 'block' : 'none';
        }
        if (!on) return;
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        var r = this.fixedViewportRectScreen ? this.fixedViewportRectScreen() : null;
        if (!r) {
            if (m.top) {
                m.top.style.left = '0px';
                m.top.style.top = '0px';
                m.top.style.width = ww + 'px';
                m.top.style.height = wh + 'px';
            }
            if (m.left) m.left.style.display = 'none';
            if (m.right) m.right.style.display = 'none';
            if (m.bottom) m.bottom.style.display = 'none';
            return;
        }
        var vx = Math.max(0, Math.floor(Number(r.x || 0)));
        var vy = Math.max(0, Math.floor(Number(r.y || 0)));
        var vw = Math.max(1, Math.floor(Number(r.w || 1)));
        var vh = Math.max(1, Math.floor(Number(r.h || 1)));
        var rightX = Math.max(0, Math.min(ww, vx + vw));
        var bottomY = Math.max(0, Math.min(wh, vy + vh));
        if (m.top) {
            m.top.style.left = '0px';
            m.top.style.top = '0px';
            m.top.style.width = ww + 'px';
            m.top.style.height = Math.max(0, vy) + 'px';
        }
        if (m.left) {
            m.left.style.left = '0px';
            m.left.style.top = vy + 'px';
            m.left.style.width = Math.max(0, vx) + 'px';
            m.left.style.height = Math.max(0, vh) + 'px';
        }
        if (m.right) {
            m.right.style.left = rightX + 'px';
            m.right.style.top = vy + 'px';
            m.right.style.width = Math.max(0, ww - rightX) + 'px';
            m.right.style.height = Math.max(0, vh) + 'px';
        }
        if (m.bottom) {
            m.bottom.style.left = '0px';
            m.bottom.style.top = bottomY + 'px';
            m.bottom.style.width = ww + 'px';
            m.bottom.style.height = Math.max(0, wh - bottomY) + 'px';
        }
    };

    EE.prototype.findEditorSchemaBindingByKey = function(key) {
        key = String(key || '');
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field) continue;
            if (String(b.field.key || '') === key) return b;
        }
        return null;
    };

    EE.prototype.setEditorSchemaNumberFieldValue = function(key, value) {
        var b = this.findEditorSchemaBindingByKey(key);
        if (!b || !b.input || !b.field || String(b.field.type || '') !== 'number') return false;
        var n = Number(value);
        if (!isFinite(n)) return false;
        var nextText = this.tileMoveCoordText(n);
        if (String(b.input.value || '') === nextText) return true;
        b.input.value = nextText;
        try { b.input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
        try { b.input.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        return true;
    };

    EE.prototype.stopRouteTileEditorPicker = function() {
        if (!this.isRouteJumpEditorPickerMode()) this.applyRouteTileEditorModalMode(false);
        if (!this.routeTileEditorPickState) return;
        this.restoreTileMovePreviewCharacter(this.routeTileEditorPickState);
        this.routeTileEditorPickState = null;
        this.updateTileMoveStartGhost(null);
        this.updateTileMoveStartMarker(null, null);
        this.updateTileMoveMarker(null, null, 0);
        if (this.dragMode !== 'tile' && !this.routeJumpEditorPickState) this.setTileMoveOverlayPassthrough(false);
    };

    EE.prototype.updateRouteTileEditorPicker = function() {
        if (!this.isRouteTileEditorPickerMode()) {
            this.stopRouteTileEditorPicker();
            return false;
        }
        this.applyRouteTileEditorModalMode(true);
        var entry = this.currentEditingEntry();
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) {
            this.stopRouteTileEditorPicker();
            return false;
        }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        var idx = Math.floor(Number(this.editRouteListIndex || 0));
        var routeCmd = (list && idx >= 0 && idx < list.length) ? list[idx] : null;
        if (!routeCmd || !this.isRouteTileGotoCommand(routeCmd)) {
            this.stopRouteTileEditorPicker();
            return false;
        }
        var cid = this.normalizeMoveTarget(Number(entry.charId == null ? ((entry.command.parameters || [0])[0] || 0) : entry.charId));
        var ch = this.characterByPanelId(cid);
        var sx = ch ? Number(ch._realX == null ? (ch.x || 0) : ch._realX) : 0;
        var sy = ch ? Number(ch._realY == null ? (ch.y || 0) : ch._realY) : 0;
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        var st = this.routeTileEditorPickState;
        if (!st ||
            Number(st.uid || 0) !== Number(entry.uid || 0) ||
            Number(st.routeListIndex || -1) !== idx ||
            Number(st.charId || 0) !== Number(cid || 0)) {
            st = {
                uid: Number(entry.uid || 0),
                routeListIndex: idx,
                charId: cid,
                startX: sx,
                startY: sy,
                speed: this.characterMoveSpeedForTileMove(ch),
                previewRelocate: true,
                appliedX: null,
                appliedY: null
            };
            this.routeTileEditorPickState = st;
            this.prepareTileMoveStartGhost(st);
        }
        this.setTileMoveOverlayPassthrough(true);
        this.updateTileMoveStartGhost(st);
        this.updateTileMoveStartMarker(st.startX, st.startY);

        var raw = this.collectEditorSchemaStateRaw();
        var tx = Number(raw && raw.x);
        var ty = Number(raw && raw.y);
        if (!isFinite(tx) || !isFinite(ty)) {
            var parsed = this.parseRouteTileGotoCommand(routeCmd);
            if (parsed) {
                tx = Number(parsed.x || 0);
                ty = Number(parsed.y || 0);
            }
        }
        var hasTarget = isFinite(tx) && isFinite(ty);
        if (hasTarget) {
            var clamped = this.clampTileMoveTargetToMap(tx, ty);
            tx = clamped.x;
            ty = clamped.y;
        }

        var spNow = this.canvasPointToScreen(Number(TouchInput.x || 0), Number(TouchInput.y || 0));
        var sxNow = spNow ? Number(spNow.x || 0) : Number(TouchInput.x || 0);
        var syNow = spNow ? Number(spNow.y || 0) : Number(TouchInput.y || 0);
        var hoverTarget = this.tileMoveTargetFromScreen(sxNow, syNow, { ignoreUi: true, blockModal: true });
        var pvx = null;
        var pvy = null;
        if (hoverTarget) {
            pvx = Number(hoverTarget.x || 0);
            pvy = Number(hoverTarget.y || 0);
        } else if (hasTarget) {
            pvx = tx;
            pvy = ty;
        }
        if (isFinite(pvx) && isFinite(pvy)) {
            var wf = this.routeTileGotoAutoWaitFrames(entry, idx, pvx, pvy, st.startX, st.startY);
            this.updateTileMoveMarker(pvx, pvy, wf, true);
            if (st.previewRelocate !== false && ch && (st.appliedX !== pvx || st.appliedY !== pvy)) {
                st.appliedX = pvx;
                st.appliedY = pvy;
                this.applyTileMovePreviewPosition(ch, pvx, pvy);
                this.stepVisualRuntime();
                this.lockTileMoveDisplay(st);
                this.refreshSelectedCharacterInfo(true);
                this.refreshCharacterOverlay(true);
            }
        } else {
            this.updateTileMoveMarker(null, null, 0);
            if (st.previewRelocate !== false && ch && (st.appliedX != null || st.appliedY != null)) {
                st.appliedX = null;
                st.appliedY = null;
                this.applyTileMovePreviewPosition(ch, Number(st.startX || 0), Number(st.startY || 0));
                this.stepVisualRuntime();
                this.lockTileMoveDisplay(st);
                this.refreshSelectedCharacterInfo(true);
                this.refreshCharacterOverlay(true);
            }
        }

        if (!TouchInput.isTriggered()) return true;
        var sp = this.canvasPointToScreen(Number(TouchInput.x || 0), Number(TouchInput.y || 0));
        var sxScr = sp ? Number(sp.x || 0) : Number(TouchInput.x || 0);
        var syScr = sp ? Number(sp.y || 0) : Number(TouchInput.y || 0);
        var target = this.tileMoveTargetFromScreen(sxScr, syScr, { ignoreUi: true, blockModal: true });
        if (!target) return true;
        this.setEditorSchemaNumberFieldValue('x', target.x);
        this.setEditorSchemaNumberFieldValue('y', target.y);
        return true;
    };

    EE.prototype.routeJumpRelativeFromTarget = function(st, tx, ty) {
        if (!st) return null;
        var sx = Number(st.startX || 0);
        var sy = Number(st.startY || 0);
        var dx = Number(tx || 0) - sx;
        var dy = Number(ty || 0) - sy;
        if (!isFinite(dx)) dx = 0;
        if (!isFinite(dy)) dy = 0;
        dx = this.tileMoveSnapCoord(dx);
        dy = this.tileMoveSnapCoord(dy);
        return {
            dx: dx,
            dy: dy,
            targetX: sx + dx,
            targetY: sy + dy
        };
    };

    EE.prototype.stopRouteJumpEditorPicker = function() {
        if (!this.isRouteTileEditorPickerMode()) this.applyRouteTileEditorModalMode(false);
        if (!this.routeJumpEditorPickState) return;
        this.restoreTileMovePreviewCharacter(this.routeJumpEditorPickState);
        this.routeJumpEditorPickState = null;
        this.updateTileMoveStartGhost(null);
        this.updateTileMoveStartMarker(null, null);
        this.updateTileMoveMarker(null, null, 0);
        if (this.dragMode !== 'tile' && !this.routeTileEditorPickState) this.setTileMoveOverlayPassthrough(false);
    };

    EE.prototype.updateRouteJumpPreviewCharacter = function(st, ch, dx, dy, hr, dr) {
        if (!st || !ch) return;
        dx = this.tileMoveSnapCoord(Number(dx || 0));
        dy = this.tileMoveSnapCoord(Number(dy || 0));
        hr = this.routeJumpRateValue(hr, 1);
        dr = this.routeJumpRateValue(dr, 1);
        var changed = (st.previewDx !== dx) ||
            (st.previewDy !== dy) ||
            (Math.abs(Number(st.previewHeightRate || 1) - hr) > 0.0001) ||
            (Math.abs(Number(st.previewDurationRate || 1) - dr) > 0.0001);
        if (changed) {
            st.previewDx = dx;
            st.previewDy = dy;
            st.previewHeightRate = hr;
            st.previewDurationRate = dr;
            st.jumpLoopDelay = 0;
            this.applyTileMovePreviewPosition(ch, Number(st.startX || 0), Number(st.startY || 0));
            if (ch._jumpCount != null) ch._jumpCount = 0;
            if (ch._jumpPeak != null) ch._jumpPeak = 0;
        }
        var isJumping = false;
        try {
            isJumping = !!(ch.isJumping && ch.isJumping());
        } catch (_) {
            isJumping = !!(Number(ch._jumpCount || 0) > 0);
        }
        if (!isJumping) {
            var delay = Math.max(0, Math.floor(Number(st.jumpLoopDelay || 0)));
            if (delay > 0) {
                st.jumpLoopDelay = delay - 1;
            } else if (dx !== 0 || dy !== 0) {
                this.applyTileMovePreviewPosition(ch, Number(st.startX || 0), Number(st.startY || 0));
                try {
                    if (typeof ch.jump === 'function') ch.jump(dx, dy, hr, dr);
                } catch (_) {
                    try { if (typeof ch.jump === 'function') ch.jump(dx, dy); } catch (_) {}
                }
                st.jumpLoopDelay = 8;
            }
        }
        this.stepVisualRuntime();
        this.lockTileMoveDisplay(st);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
    };

    EE.prototype.updateRouteJumpEditorPicker = function() {
        if (!this.isRouteJumpEditorPickerMode()) {
            this.stopRouteJumpEditorPicker();
            return false;
        }
        this.applyRouteTileEditorModalMode(true);
        var entry = this.currentEditingEntry();
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) {
            this.stopRouteJumpEditorPicker();
            return false;
        }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        var idx = Math.floor(Number(this.editRouteListIndex || 0));
        var routeCmd = (list && idx >= 0 && idx < list.length) ? list[idx] : null;
        var parsed = this.parseRouteJumpExCommand(routeCmd);
        if (!routeCmd || !parsed) {
            this.stopRouteJumpEditorPicker();
            return false;
        }
        var cid = this.normalizeMoveTarget(Number(entry.charId == null ? ((entry.command.parameters || [0])[0] || 0) : entry.charId));
        var ch = this.characterByPanelId(cid);
        if (!ch && this.routeCharacterByEntry) ch = this.routeCharacterByEntry(entry);
        var sx = ch ? Number(ch._x == null ? (ch.x == null ? ch._realX : ch.x) : ch._x) : 0;
        var sy = ch ? Number(ch._y == null ? (ch.y == null ? ch._realY : ch.y) : ch._y) : 0;
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        sx = this.tileMoveSnapCoord(sx);
        sy = this.tileMoveSnapCoord(sy);
        var st = this.routeJumpEditorPickState;
        if (!st ||
            Number(st.uid || 0) !== Number(entry.uid || 0) ||
            Number(st.routeListIndex || -1) !== idx ||
            Number(st.charId || 0) !== Number(cid || 0)) {
            st = {
                uid: Number(entry.uid || 0),
                routeListIndex: idx,
                charId: cid,
                startX: sx,
                startY: sy,
                speed: this.characterMoveSpeedForTileMove(ch),
                baseDisplayX: Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0),
                baseDisplayY: Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0),
                previewRelocate: true,
                appliedX: null,
                appliedY: null,
                previewDx: null,
                previewDy: null,
                previewHeightRate: 1,
                previewDurationRate: 1,
                jumpLoopDelay: 0
            };
            this.routeJumpEditorPickState = st;
            this.prepareTileMoveStartGhost(st);
        }
        this.setTileMoveOverlayPassthrough(true);
        this.updateTileMoveStartGhost(st);
        this.updateTileMoveStartMarker(st.startX, st.startY);

        var raw = this.collectEditorSchemaStateRaw();
        var dx = Number(raw && raw.dx);
        var dy = Number(raw && raw.dy);
        var hr = Number(raw && raw.heightRate);
        var dr = Number(raw && raw.durationRate);
        if (!isFinite(dx) || !isFinite(dy)) {
            dx = Number(parsed.dx || 0);
            dy = Number(parsed.dy || 0);
        }
        dx = this.tileMoveSnapCoord(Number(dx || 0));
        dy = this.tileMoveSnapCoord(Number(dy || 0));
        hr = this.routeJumpRateValue(isFinite(hr) ? hr : parsed.heightRate, 1);
        dr = this.routeJumpRateValue(isFinite(dr) ? dr : parsed.durationRate, 1);

        var spNow = this.canvasPointToScreen(Number(TouchInput.x || 0), Number(TouchInput.y || 0));
        var sxNow = spNow ? Number(spNow.x || 0) : Number(TouchInput.x || 0);
        var syNow = spNow ? Number(spNow.y || 0) : Number(TouchInput.y || 0);
        var hoverTarget = this.tileMoveTargetFromScreen(sxNow, syNow, { ignoreUi: true, blockModal: true });
        var rel = null;
        if (hoverTarget) rel = this.routeJumpRelativeFromTarget(st, hoverTarget.x, hoverTarget.y);
        if (!rel) rel = { dx: dx, dy: dy, targetX: Number(st.startX || 0) + dx, targetY: Number(st.startY || 0) + dy };
        var wf = this.routeJumpDurationFrames(rel.dx, rel.dy, st.speed, hr, dr);
        this.updateTileMoveMarker(rel.targetX, rel.targetY, wf, true);
        if (st.previewRelocate !== false && ch) {
            this.updateRouteJumpPreviewCharacter(st, ch, rel.dx, rel.dy, hr, dr);
        }

        if (!TouchInput.isTriggered()) return true;
        var sp = this.canvasPointToScreen(Number(TouchInput.x || 0), Number(TouchInput.y || 0));
        var sxScr = sp ? Number(sp.x || 0) : Number(TouchInput.x || 0);
        var syScr = sp ? Number(sp.y || 0) : Number(TouchInput.y || 0);
        var target = this.tileMoveTargetFromScreen(sxScr, syScr, { ignoreUi: true, blockModal: true });
        if (!target) return true;
        var clickRel = this.routeJumpRelativeFromTarget(st, target.x, target.y);
        if (!clickRel) return true;
        this.setEditorSchemaNumberFieldValue('dx', clickRel.dx);
        this.setEditorSchemaNumberFieldValue('dy', clickRel.dy);
        return true;
    };

    EE.prototype.updateRouteEditorMapPicker = function() {
        if (this.isRouteJumpEditorPickerMode()) {
            if (this.routeTileEditorPickState) this.stopRouteTileEditorPicker();
            this.updateRouteJumpEditorPicker();
            return;
        }
        if (this.isRouteTileEditorPickerMode()) {
            if (this.routeJumpEditorPickState) this.stopRouteJumpEditorPicker();
            this.updateRouteTileEditorPicker();
            return;
        }
        this.stopRouteTileEditorPicker();
        this.stopRouteJumpEditorPicker();
    };

    EE.prototype.applyTileMovePreviewPosition = function(ch, x, y) {
        if (!ch) return;
        var isPlayer = false;
        try { isPlayer = (typeof Game_Player !== 'undefined' && ch instanceof Game_Player); } catch (_) {}
        if (!isPlayer && typeof ch.locate === 'function') {
            ch.locate(x, y);
            return;
        }
        ch._x = x;
        ch._y = y;
        ch._realX = x;
        ch._realY = y;
    };

    EE.prototype.restoreTileMovePreviewCharacter = function(st) {
        if (!st) return;
        if (st.previewRelocate === false) {
            this.stepVisualRuntime();
            this.lockTileMoveDisplay(st);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            return;
        }
        var ch = this.characterByPanelId(st.charId);
        if (!ch) return;
        if (ch._jumpCount != null) ch._jumpCount = 0;
        if (ch._jumpPeak != null) ch._jumpPeak = 0;
        var x = Number(st.startX || 0);
        var y = Number(st.startY || 0);
        this.applyTileMovePreviewPosition(ch, x, y);
        this.stepVisualRuntime();
        this.lockTileMoveDisplay(st);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
    };

    EE.prototype.beginTileMove = function() {
        var cid = this.currentSelectedCharacterId();
        if (cid == null && this.selEid > 0) cid = this.selEid;
        if (cid == null) {
            this.err('E_TILEMOVE_TARGET', new Error('キャラを選択してください'));
            return;
        }
        this.beginTileMoveForCharacter(cid, 'route');
    };

    EE.prototype.beginTeleportForCharacter = function(charId) {
        return this.beginTileMoveForCharacter(charId, 'teleport');
    };

    EE.prototype.beginTileMoveForCharacter = function(charId, action) {
        if (!this.needSelTrack()) return false;
        var cid = this.normalizeMoveTarget(charId);
        var ch = this.characterByPanelId(cid);
        if (!ch) {
            this.err('E_TILEMOVE_TARGET', new Error('対象キャラを取得できません'));
            return false;
        }
        var act = String(action || 'route');
        if (act !== 'teleport') act = 'route';
        if (this.dragMode === 'tile') this.cancelTileMoveMode(true);
        this.panelSelectedCharId = cid;
        this.cleanupTemporaryCharRows(cid);
        if (this.selKey) this.ensureTemporaryCharRow(cid);
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        var sx = Number(ch._realX == null ? ch.x || 0 : ch._realX);
        var sy = Number(ch._realY == null ? ch.y || 0 : ch._realY);
        var tx = this.tileMoveSnapCoord(sx);
        var ty = this.tileMoveSnapCoord(sy);
        this.tileMoveState = {
            charId: cid,
            action: act,
            speed: this.characterMoveSpeedForTileMove(ch),
            startX: sx,
            startY: sy,
            baseDisplayX: Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0),
            baseDisplayY: Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0),
            previewRelocate: true,
            targetX: tx,
            targetY: ty,
            appliedX: null,
            appliedY: null
        };
        this.prepareTileMoveStartGhost(this.tileMoveState);
        this.dragMode = 'tile';
        this.setTileMoveOverlayPassthrough(true);
        this.updateTileMoveStartGhost(this.tileMoveState);
        this.updateTileMoveStartMarker(sx, sy);
        var wf = this.tileMoveWaitFrames(this.tileMoveState, tx, ty);
        this.updateTileMoveMarker(tx, ty, wf, act !== 'teleport');
        this.msg((act === 'teleport' ? '瞬間移動' : 'タイル移動') + ': マップ左クリックで確定 / 右クリックでキャンセル');
        return true;
    };

    EE.prototype.cancelTileMoveMode = function(silent) {
        if (this.dragMode !== 'tile' && !this.tileMoveState) return;
        var action = this.tileMoveState ? String(this.tileMoveState.action || 'route') : 'route';
        this.restoreTileMovePreviewCharacter(this.tileMoveState);
        this.dragMode = '';
        this.tileMoveState = null;
        this.setTileMoveOverlayPassthrough(false);
        this.updateTileMoveStartGhost(null);
        this.updateTileMoveStartMarker(null, null);
        this.updateTileMoveMarker(null, null, 0);
        if (!silent) this.msg((action === 'teleport' ? '瞬間移動' : 'タイル移動') + 'をキャンセル');
    };

    EE.prototype.addTeleportScriptCommand = function(frame, charId, tx, ty) {
        if (!this.needSelTrack()) return false;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        charId = this.normalizeMoveTarget(charId);
        var x = this.tileMoveCoordText(tx);
        var y = this.tileMoveCoordText(ty);
        var script = (charId === -1)
            ? ('$gamePlayer.locateTo(' + x + ', ' + y + ')')
            : ('this.character(' + String(charId) + ').locateTo(' + x + ', ' + y + ')');
        var added = this.addCmd({ code: 355, indent: 0, parameters: [script] }, frame);
        return !!added;
    };

    EE.prototype.addTileMoveRouteCommand = function(frame, charId, tx, ty, waitFrames) {
        if (!this.needSelTrack()) return false;
        charId = this.normalizeMoveTarget(charId);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        waitFrames = Math.max(1, Math.floor(Number(waitFrames || 1)));
        var script = 'this.goTo(' + this.tileMoveCoordText(tx) + ', ' + this.tileMoveCoordText(ty) + ')';
        var scriptCmd = { code: 45, parameters: [script] };
        this.setRouteTileGotoCommandWaitFrames(scriptCmd, waitFrames);
        var tr = this.ensureTrack(this.selEid, this.selPage);
        var inRange = this.findCharRouteEntryAtFrame(tr, charId, frame);
        if (!inRange) {
            if (this.isIntervalLockedByMoveRouteWait(tr, frame, frame, 0)) {
                this.err('E_ROUTE_WAIT_LOCK', new Error('move-route wait lock on main'));
                return false;
            }
            var list = [clone(scriptCmd)];
            list.push({ code: 0, parameters: [] });
            var added = this.addCmd({
                code: 205,
                indent: 0,
                parameters: [charId, { repeat: false, skippable: false, wait: false, list: list }]
            }, frame);
            return !!added;
        }
        this.pushSnap('tileMoveRoute');
        var oldCmd = clone(inRange.command);
        var oldWait = Number(inRange.wait || 0);
        this.insertRouteCommandIntoEntry(inRange, scriptCmd, frame);
        inRange.wait = this.commandWaitFrames(inRange.command);
        if (!this.canPlaceEntry(tr, inRange, inRange.frame, inRange.rowKey, inRange.uid)) {
            inRange.command = oldCmd;
            inRange.wait = oldWait;
            this.err('E_ROUTE_COLLISION', new Error('move-route range overlaps after tile move'));
            return false;
        }
        this.confirmCharRowPermanent(charId);
        this.selUid = inRange.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(frame, waitFrames);
        this.dirty[this.selKey] = true;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.rebuildSchedule();
        this.playFrom(this.frame);
        return true;
    };

    EE.prototype.finishTileMoveMode = function(applyCommand) {
        var st = this.tileMoveState;
        if (!st) {
            this.dragMode = '';
            this.updateTileMoveMarker(null, null, 0);
            return;
        }
        var tx = Number(st.targetX == null ? st.startX : st.targetX);
        var ty = Number(st.targetY == null ? st.startY : st.targetY);
        var wf = this.tileMoveWaitFrames(st, tx, ty);
        this.restoreTileMovePreviewCharacter(st);
        this.dragMode = '';
        this.tileMoveState = null;
        this.setTileMoveOverlayPassthrough(false);
        this.updateTileMoveStartGhost(null);
        this.updateTileMoveStartMarker(null, null);
        this.updateTileMoveMarker(null, null, 0);
        if (!applyCommand) return;
        if (String(st.action || 'route') === 'teleport') {
            if (this.addTeleportScriptCommand(this.frame, st.charId, tx, ty)) {
                this.msg('瞬間移動追加: (' + this.tileMoveCoordText(tx) + ', ' + this.tileMoveCoordText(ty) + ')');
            }
            return;
        }
        if (this.addTileMoveRouteCommand(this.frame, st.charId, tx, ty, wf)) {
            this.msg('タイル移動追加: (' + this.tileMoveCoordText(tx) + ', ' + this.tileMoveCoordText(ty) + ') wait:' + wf + 'f');
        }
    };

    EE.prototype.updateTileDrag = function() {
        var st = this.tileMoveState;
        if (!st) {
            this.dragMode = '';
            this.updateTileMoveStartGhost(null);
            this.updateTileMoveMarker(null, null, 0);
            return;
        }
        this.lockTileMoveDisplay(st);
        this.updateTileMoveStartGhost(st);
        if (TouchInput.isCancelled()) {
            this.cancelTileMoveMode();
            return;
        }
        var ch = this.characterByPanelId(st.charId);
        if (!ch) {
            this.cancelTileMoveMode();
            return;
        }
        var sp = this.canvasPointToScreen(Number(TouchInput.x || 0), Number(TouchInput.y || 0));
        var sx = sp ? Number(sp.x || 0) : Number(TouchInput.x || 0);
        var sy = sp ? Number(sp.y || 0) : Number(TouchInput.y || 0);
        var target = this.tileMoveTargetFromScreen(sx, sy);
        if (target) {
            st.targetX = Number(target.x || 0);
            st.targetY = Number(target.y || 0);
            if (st.previewRelocate !== false && (st.appliedX !== st.targetX || st.appliedY !== st.targetY)) {
                st.appliedX = st.targetX;
                st.appliedY = st.targetY;
                this.applyTileMovePreviewPosition(ch, st.targetX, st.targetY);
                this.stepVisualRuntime();
                this.lockTileMoveDisplay(st);
                this.refreshSelectedCharacterInfo(true);
                this.refreshCharacterOverlay(true);
            }
            if (st.previewRelocate === false) {
                st.appliedX = null;
                st.appliedY = null;
            }
            this.updateTileMoveStartMarker(st.startX, st.startY);
            this.updateTileMoveMarker(st.targetX, st.targetY, this.tileMoveWaitFrames(st, st.targetX, st.targetY), String(st.action || 'route') !== 'teleport');
        } else {
            if (st.previewRelocate !== false && (st.appliedX != null || st.appliedY != null)) {
                st.appliedX = null;
                st.appliedY = null;
                this.applyTileMovePreviewPosition(ch, Number(st.startX || 0), Number(st.startY || 0));
                this.stepVisualRuntime();
                this.lockTileMoveDisplay(st);
                this.refreshSelectedCharacterInfo(true);
                this.refreshCharacterOverlay(true);
            }
            this.updateTileMoveStartMarker(st.startX, st.startY);
            this.updateTileMoveMarker(null, null, 0);
        }
        if (!TouchInput.isTriggered()) return;
        if (!target) return;
        this.finishTileMoveMode(true);
    };

    EE.prototype.updatePointer = function() {
        if (!this.on) return;
        if (this.panState) return;
        if (this.dragMode === 'tile') { this.updateTileDrag(); return; }
        if (this.onUi(TouchInput.x, TouchInput.y)) return;
        if (!this.isPointInFixedViewportRect(TouchInput.x, TouchInput.y)) return;
        if (!TouchInput.isTriggered()) return;
        var cid = this.pickCharacterIdAtScreen(TouchInput.x, TouchInput.y);
        if (cid == null) {
            this.cleanupTemporaryCharRows(null);
            return;
        }
        this.selectCharacterForTimeline(cid, 'map');
    };

    EE.prototype.pickCharacterIdAtScreen = function(sx, sy) {
        var ss = this.s && this.s._spriteset;
        if (!ss || !ss._characterSprites) return null;
        var ls = ss._characterSprites;
        for (var i = ls.length - 1; i >= 0; i--) {
            var sp = ls[i];
            if (!sp || !sp.visible || !sp._character || !sp.getBounds) continue;
            var b = sp.getBounds();
            if (!(sx >= b.x && sx <= b.x + b.width && sy >= b.y && sy <= b.y + b.height)) continue;
            var ch = sp._character;
            try {
                if (typeof Game_Player !== 'undefined' && ch instanceof Game_Player) return -1;
                if (typeof Game_Event !== 'undefined' && ch instanceof Game_Event && ch.eventId) return Number(ch.eventId() || 0);
            } catch (_) {}
        }
        return null;
    };

    EE.prototype.screenToMap = function(sx, sy, dec) {
        var ss = this.s && this.s._spriteset;
        if (!ss || !ss.worldTransform || typeof PIXI === 'undefined' || !PIXI.Point) return null;
        var p = ss.worldTransform.applyInverse(new PIXI.Point(sx, sy));
        var mx = $gameMap._displayX + (p.x / $gameMap.tileWidth());
        var my = $gameMap._displayY + (p.y / $gameMap.tileHeight());
        if (dec === 'raw') {
            // no rounding
        } else if (!dec) {
            mx = Math.round(mx); my = Math.round(my);
        } else {
            mx = Math.round(mx * 10) / 10; my = Math.round(my * 10) / 10;
        }
        return { x: mx, y: my };
    };

    EE.prototype.formatCoordText = function(v, digits, fixed) {
        var n = Number(v || 0);
        if (!isFinite(n)) n = 0;
        if (digits == null) return String(Math.round(n * 1000) / 1000);
        var d = Math.max(0, Math.floor(Number(digits || 0)));
        if (fixed) return n.toFixed(d);
        var m = Math.pow(10, d);
        return String(Math.round(n * m) / m);
    };

    EE.prototype.updateMouseCoordInfo = function() {
        var box = this.mouseCoordInfo;
        if (!box) return;
        var sx = Number(this.lastPointerClientX || 0);
        var sy = Number(this.lastPointerClientY || 0);
        var inViewport = this.isPointInFixedViewportRect(sx, sy);
        var onFrameBorder = this.isPointOnGameFrameBorder(sx, sy);
        if ((!inViewport && !onFrameBorder) || this.onUi(sx, sy)) {
            if (box.style.display !== 'none') box.style.display = 'none';
            return;
        }
        var cp = this.screenPointToCanvas(sx, sy);
        if (!cp) {
            if (box.style.display !== 'none') box.style.display = 'none';
            return;
        }
        var mp = this.screenToMap(cp.x, cp.y, 'raw');
        if (!mp) {
            if (box.style.display !== 'none') box.style.display = 'none';
            return;
        }
        this.ensureEditorDisplayState();
        var dispX = this.controlMode
            ? Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0)
            : Number(this.editorDisplayX == null ? ($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0) : this.editorDisplayX);
        var dispY = this.controlMode
            ? Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0)
            : Number(this.editorDisplayY == null ? ($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0) : this.editorDisplayY);
        var tw = Number($gameMap && $gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap && $gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var relX = Math.round((Number(mp.x || 0) - dispX) * tw);
        var relY = Math.round((Number(mp.y || 0) - dispY) * th);
        box.innerHTML =
            '<div class="mcr"><span class="lbl">画面座標</span><span class="val">(' +
            this.formatCoordText(relX, 0) + ', ' + this.formatCoordText(relY, 0) +
            ')</span></div>' +
            '<div class="mcr"><span class="lbl">タイル座標</span><span class="val">(' +
            this.formatCoordText(mp.x, 1, true) + ', ' + this.formatCoordText(mp.y, 1, true) +
            ')</span></div>' +
            '<div class="mcr"><span class="lbl">displayXY</span><span class="val">(' +
            this.formatCoordText(dispX, 1, true) + ', ' + this.formatCoordText(dispY, 1, true) +
            ')</span></div>';
        if (box.style.display !== 'block') box.style.display = 'block';
        var fr = this.fixedViewportRectScreen();
        if (fr) {
            var margin = 4;
            var br = box.getBoundingClientRect ? box.getBoundingClientRect() : null;
            var bw = Math.max(1, Math.ceil(Number(br && br.width ? br.width : box.offsetWidth || 1)));
            var bh = Math.max(1, Math.ceil(Number(br && br.height ? br.height : box.offsetHeight || 1)));
            var x = Math.floor(Number(fr.x || 0) + Number(fr.w || 0) - bw - margin);
            var y = Math.floor(Number(fr.y || 0) + Number(fr.h || 0) - bh - margin);
            var minX = Math.floor(Number(fr.x || 0) + margin);
            var minY = Math.floor(Number(fr.y || 0) + margin);
            if (x < minX) x = minX;
            if (y < minY) y = minY;
            box.style.left = x + 'px';
            box.style.top = y + 'px';
            box.style.right = 'auto';
            box.style.bottom = 'auto';
        }
    };

    EE.prototype.post = function() {
        if (!this.on) return;
        if (!this.controlMode) {
            this.ensureEditorDisplayState();
            this.applyEditorDisplayState();
        }
        this.applyGameViewport();
        this.updateGameFrameVisual();
        this.updateMouseCoordInfo();
        if (!this._charPanelNextRefresh || (Graphics && Graphics.frameCount >= this._charPanelNextRefresh)) {
        this.refreshCharacterPanel(false);
        this.refreshSelectedCharacterInfo(false);
        this._charPanelNextRefresh = (Graphics ? Graphics.frameCount : 0) + 6;
        }
        this.refreshCharacterOverlay(false);
        this.autoScrollTimelineForPlayback();
        this.updateRouteEditorMapPicker();
        this.updatePointer();
        this.updateAnimationPreview();
        this.drawTimeline();
    };

    var _eeBasePlayFrom_Timeline = EE.prototype.playFrom;
    EE.prototype.playFrom = function(f) {
        _eeBasePlayFrom_Timeline.call(this, this.clampFrameToSelectedTrackEnd(f));
    };

    var _eeBaseSeek_Timeline = EE.prototype.seek;
    EE.prototype.seek = function(f) {
        _eeBaseSeek_Timeline.call(this, this.clampFrameToSelectedTrackEnd(f));
    };

    EE.prototype.pre = function() {
        if (!this.on) return;
        if (!this.play) return;
        var endFrame = this.selectedTrackEndFrame();
        // Allow commands on endFrame, then stop at the end marker.
        if (Math.max(0, Math.floor(Number(this.frame || 0))) > endFrame) {
            this.frame = endFrame;
            this._simFrame = endFrame;
        }
        if (this.isPlaybackBlocked()) return;
        if (!this.execAt(this.frame)) return;
        this.frame++;
        this._simFrame = this.frame;
        this.pruneSimAudioState(this.frame);
        if (this.frame > endFrame) {
            this.frame = endFrame;
            this._simFrame = endFrame;
            this.play = false;
            this.setPlayBtn();
            this.stopEditorAudioPlayback();
            this.clearMessageRuntimeState();
        }
        var cap = endFrame + this.timelineEndPaddingFrames();
        if (cap > this.maxF) this.maxF = cap;
        this.timelineDirty = true;
    };

    EE.prototype.runInitialVisualRefresh = function() {
        try {
            this.applyGameViewport();
            if ($gameMap && $gameMap.update) $gameMap.update(true);
            if ($gamePlayer && $gamePlayer.update) $gamePlayer.update(true);
            if ($gameTimer && $gameTimer.update) $gameTimer.update(true);
            if ($gameScreen && $gameScreen.update) $gameScreen.update();
            this.stepVisualRuntime();
            this.updateGameFrameVisual();
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            this.timelineDirty = true;
        } catch (_) {}
    };

    EE.prototype.normalizeMoveTarget = function(id) {
        id = Math.floor(Number(id || 0));
        if (id === -1) return -1;
        if (id > 0) return id;
        return 0;
    };

    EE.prototype.moveStepFrames = function(speed) {
        speed = Math.max(1, Math.min(6, Number(speed || 4)));
        return Math.max(1, Math.round(256 / Math.pow(2, speed)));
    };

    EE.prototype.moveRouteTimelineRaw = function(route) {
        var out = { items: [], totalFrames: 0 };
        if (!route || !route.list || !route.list.length) return out;
        var t = 0;
        var speedState = 4;
        for (var i = 0; i < route.list.length; i++) {
            var rc = route.list[i];
            if (!rc) continue;
            var code = Number(rc.code || 0);
            if (code === 0) continue;
            var step = Math.max(1, Math.floor(Number(this.routeCommandRuntimeSpanForRecalc(rc, speedState) || 1)));
            out.items.push({ command: rc, offset: t, span: step, listIndex: i });
            t += step;
            speedState = this.routeSpeedStateAfterCommandForRecalc(rc, speedState);
        }
        out.totalFrames = t;
        return out;
    };

    EE.prototype.moveRouteTimeline = function(route) {
        var raw = this.moveRouteTimelineRaw(route);
        var out = { items: [], totalFrames: 0 };
        var items = raw.items || [];
        var t = 0;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var rc = it && it.command ? it.command : null;
            var code = Number((rc && rc.code) || 0);
            if (!rc || code <= 0) continue;
            var dcode = this.routeDisplayCodeForCommand(rc);
            if (dcode === 4500) {
                var span = this.routeTileGotoCommandWaitFrames(rc);
                var next = (i + 1 < items.length) ? items[i + 1] : null;
                if (span <= 1 && next && next.command && Number(next.command.code || 0) === 15) {
                    span += Math.max(1, Math.floor(Number(next.span || 1)));
                    i++;
                }
                out.items.push({
                    command: rc,
                    offset: t,
                    span: span,
                    listIndex: Number(it.listIndex || 0),
                    displayCode: dcode
                });
                t += span;
                continue;
            }
            out.items.push({
                command: rc,
                offset: t,
                span: Math.max(1, Math.floor(Number(it.span || 1))),
                listIndex: Number(it.listIndex || 0),
                displayCode: dcode
            });
            t += Math.max(1, Math.floor(Number(it.span || 1)));
        }
        out.totalFrames = t;
        return out;
    };

    EE.prototype.moveRouteFrames = function(route) {
        var tl = this.moveRouteTimelineRaw(route);
        return Math.max(1, Number(tl.totalFrames || 0));
    };

    EE.prototype.ensureMoveRouteTerminal = function(route) {
        if (!route || typeof route !== 'object') route = {};
        if (!Array.isArray(route.list)) route.list = [];
        if (!route.list.length || Number(route.list[route.list.length - 1].code || 0) !== 0) {
            route.list.push({ code: 0, parameters: [] });
        }
        return route;
    };

    EE.prototype.moveRouteTerminalIndex = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        return Math.max(0, route.list.length - 1);
    };

    EE.prototype.moveRouteTrimTrailingWaitCommands = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        var end = this.moveRouteTerminalIndex(route);
        var removed = 0;
        while (end > 0) {
            var rc = route.list[end - 1];
            if (!rc || Number(rc.code || 0) !== 15) break;
            route.list.splice(end - 1, 1);
            end--;
            removed++;
        }
        return removed;
    };

    EE.prototype.moveRouteBaseFramesWithoutTrailingWait = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        var list = route.list;
        var end = this.moveRouteTerminalIndex(route);
        while (end > 0) {
            var rc = list[end - 1];
            if (!rc || Number(rc.code || 0) !== 15) break;
            end--;
        }
        var t = 0;
        var speedState = 4;
        for (var i = 0; i < end; i++) {
            var rc2 = list[i];
            var c = Number((rc2 && rc2.code) || 0);
            if (c <= 0) continue;
            t += this.routeCommandRuntimeSpanForRecalc(rc2, speedState);
            speedState = this.routeSpeedStateAfterCommandForRecalc(rc2, speedState);
        }
        return Math.max(1, t);
    };

    EE.prototype.moveRouteLeadingWaitFrames = function(route) {
        route = this.ensureMoveRouteTerminal(route);
        var list = route.list;
        var t = 0;
        for (var i = 0; i < list.length; i++) {
            var rc = list[i];
            var code = Number((rc && rc.code) || 0);
            if (code === 0) break;
            if (code !== 15) break;
            t += Math.max(1, Math.floor(Number(((rc.parameters || [0])[0]) || 0)));
        }
        return Math.max(0, t);
    };

    EE.prototype.shiftMoveRouteLeftBoundary = function(cmd, deltaFrames) {
        if (!cmd || Number(cmd.code || 0) !== 205) return false;
        if (!Array.isArray(cmd.parameters)) cmd.parameters = [0, this.defaultMoveRoute()];
        var route = this.ensureMoveRouteTerminal(cmd.parameters[1]);
        cmd.parameters[1] = route;
        var list = route.list;
        var d = Math.floor(Number(deltaFrames || 0) || 0);
        if (d === 0) return true;
        if (d > 0) {
            list.splice(0, 0, { code: 15, parameters: [d] });
            return true;
        }
        var need = Math.abs(d);
        var i = 0;
        while (need > 0 && i < list.length) {
            var rc = list[i];
            var code = Number((rc && rc.code) || 0);
            if (code !== 15) break;
            var w = Math.max(1, Math.floor(Number(((rc.parameters || [0])[0]) || 0)));
            if (w <= need) {
                list.splice(i, 1);
                need -= w;
                continue;
            }
            rc.parameters = [w - need];
            list[i] = rc;
            need = 0;
            break;
        }
        return need <= 0;
    };

    EE.prototype.setMoveRouteDuration = function(cmd, targetFrames) {
        if (!cmd || Number(cmd.code || 0) !== 205) return 0;
        if (!Array.isArray(cmd.parameters)) cmd.parameters = [0, this.defaultMoveRoute()];
        var route = cmd.parameters[1];
        route = this.ensureMoveRouteTerminal(route);
        cmd.parameters[1] = route;
        var base = this.moveRouteBaseFramesWithoutTrailingWait(route);
        var target = Math.max(base, Math.floor(Number(targetFrames || 0) || 0));
        this.moveRouteTrimTrailingWaitCommands(route);
        var diff = target - base;
        if (diff > 0) {
            var end = this.moveRouteTerminalIndex(route);
            route.list.splice(end, 0, { code: 15, parameters: [diff] });
        }
        return this.moveRouteFrames(route);
    };

    EE.prototype.findCharRouteEntryAtFrame = function(tr, charId, frame) {
        if (!tr || !Array.isArray(tr.commands)) return null;
        charId = this.normalizeMoveTarget(charId);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char' || Number(e.charId || 0) !== Number(charId)) continue;
            if (!e.command || Number(e.command.code || 0) !== 205) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(1, Math.floor(Number(e.wait || 1)));
            var ed = s + w;
            if (frame >= s && frame <= ed) return e;
        }
        return null;
    };

    EE.prototype.insertRouteCommandIntoEntry = function(entry, routeCmd, frame) {
        if (!entry || !routeCmd || !entry.command || Number(entry.command.code || 0) !== 205) return -1;
        var route = entry.command.parameters && entry.command.parameters[1];
        route = this.ensureMoveRouteTerminal(route);
        entry.command.parameters[1] = route;
        var list = route.list;
        var end = this.moveRouteTerminalIndex(route);
        var tl = this.moveRouteTimeline(route);
        var offset = Math.max(0, Math.floor(Number(frame || 0)) - Math.floor(Number(entry.frame || 0)));
        var inserted = clone(routeCmd);
        for (var i = 0; i < tl.items.length; i++) {
            var it = tl.items[i];
            if (!it || !it.command) continue;
            var st = Math.max(0, Math.floor(Number(it.offset || 0)));
            var sp = Math.max(1, Math.floor(Number(it.span || 1)));
            var ed = st + sp;
            var li = Math.max(0, Math.floor(Number(it.listIndex || 0)));
            if (offset <= st) {
                list.splice(li, 0, inserted);
                return li;
            }
            if (offset > st && offset < ed && Number(it.command.code || 0) === 15) {
                var left = Math.max(0, offset - st);
                var right = Math.max(0, sp - left - 1);
                if (left > 0) {
                    it.command.parameters = [left];
                    list[li] = it.command;
                    list.splice(li + 1, 0, inserted);
                    if (right > 0) list.splice(li + 2, 0, { code: 15, parameters: [right] });
                    return li + 1;
                }
                list.splice(li, 1, inserted);
                if (right > 0) list.splice(li + 1, 0, { code: 15, parameters: [right] });
                return li;
            }
        }
        list.splice(end, 0, inserted);
        return end;
    };

    EE.prototype.commandWaitFrames = function(cmd) {
        if (!cmd) return 0;
        var code = Number(cmd.code || 0), p = cmd.parameters || [];
        if (code === 205) {
            var route = p[1] || null;
            var waitForCompletion = !route || route.wait !== false;
            return waitForCompletion ? this.moveRouteFrames(route) : 0;
        }
        if (code === 230) return Math.max(0, Math.floor(Number(p[0] || 0)));
        if (code === 221 || code === 222) return 30;
        if (code === 223) return p[2] ? Math.max(0, Math.floor(Number(p[1] || 0))) : 0;
        if (code === 224) return p[2] ? Math.max(0, Math.floor(Number(p[1] || 0))) : 0;
        if (code === 225) return p[3] ? Math.max(0, Math.floor(Number(p[2] || 0))) : 0;
        if (code === 232) {
            var isV12 = Array.isArray(p) && p.length >= 12;
            var dur = isV12 ? Number(p[10] || 0) : Number(p[9] || 0);
            var wait = isV12 ? !!p[11] : !!p[10];
            return wait ? Math.max(0, Math.floor(dur || 0)) : 0;
        }
        if (code === 234) return p[3] ? Math.max(0, Math.floor(Number(p[2] || 0))) : 0;
        if (code === 236) return p[3] ? Math.max(0, Math.floor(Number(p[2] || 0))) : 0;
        if (code === 204) {
            var dist = Math.max(0, Number(p[1] || 0));
            var sp = Math.max(1, Math.min(6, Number(p[2] || 4)));
            return Math.max(0, Math.ceil(dist * 256 / Math.pow(2, sp)));
        }
        if (code === 201) return 12;
        if (code === 212) return p[2] ? 60 : 0;
        if (code === 213) return p[2] ? 60 : 0;
        if (code === 217) return 45;
        if (code === 261) return 120;
        if (code === 339) return 30;
        if (code === 103 || code === 104 || code === 105) return 60;
        return 0;
    };

    EE.prototype.entryFromCommand = function(cmd, eid, page, frame, uid) {
        if (!cmd || cmd.code === 0) return null;
        if (cmd.code === 230) return null;
        var e = {
            uid: uid || this.model.nextUid++,
            frame: Math.max(0, Math.floor(Number(frame || 0))),
            eventId: eid,
            pageIndex: page,
            command: clone(cmd),
            wait: 0,
            rowType: 'main',
            rowKey: 'main',
            charId: null,
            isComment: false,
            commentLines: null,
            isMemo: false,
            memoSize: 'S',
            memoText: '',
            isMessage: false,
            messageLines: null,
            messageExt: null,
            isScrollMessage: false,
            scrollLines: null,
            isScript: false,
            scriptLines: null
        };
        if (e.command.code === 108) {
            e.isComment = true;
            e.commentLines = [String((e.command.parameters || [''])[0] || '')];
            this.memoApplyParsedStateToEntry(e);
            if (e.isMemo) {
                e.commentLines = [this.memoCommentLine(e.memoSize, e.memoText)];
                e.command.parameters = [e.commentLines[0]];
            }
            e.wait = 0;
        } else if (e.command.code === 101) {
            e.wait = 0;
            e.isMessage = true;
            e.messageLines = [];
        } else if (e.command.code === 355) {
            e.wait = 0;
            e.isScript = true;
            e.scriptLines = [String((e.command.parameters || [''])[0] || '')];
        } else if (e.command.code === 105) {
            e.wait = 0;
            e.isScrollMessage = true;
            e.scrollLines = [];
        } else if (e.command.code === 205) {
            e.rowType = 'char';
            e.charId = this.normalizeMoveTarget(Number((e.command.parameters || [0])[0] || 0));
            e.rowKey = 'char:' + e.charId;
            e.command.parameters[0] = e.charId;
            // During initial track parse, runtime character positions are not yet
            // aligned to each command frame. Skip eager auto-wait calc here and
            // normalize later via simulation pass.
            if (!this._eeTrackParseMode) this.recalculateRouteTileGotoWaitMetaForEntry(e);
            e.wait = this.commandWaitFrames(e.command);
        } else {
            e.wait = this.commandWaitFrames(e.command);
        }
        return e;
    };

    EE.prototype.timelineEndPaddingFrames = function() {
        var n = Math.floor(Number(this.endMarkerPadFrames == null ? 40 : this.endMarkerPadFrames));
        return Math.max(8, n);
    };

    EE.prototype.trackComputedEndFrame = function(tr) {
        if (!tr || !Array.isArray(tr.commands) || !tr.commands.length) return 0;
        var m = 0;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            var end = s + w;
            if (end > m) m = end;
        }
        return m;
    };

    EE.prototype.normalizeTrackEndFrame = function(tr) {
        if (!tr) return 0;
        var computed = this.trackComputedEndFrame(tr);
        var stored = Number(tr.endFrame);
        if (!isFinite(stored)) stored = computed;
        stored = Math.max(0, Math.floor(stored));
        // End marker should never be before the actual last command end.
        var normalized = Math.max(computed, stored);
        if (Number(tr.endFrame) !== normalized) tr.endFrame = normalized;
        return normalized;
    };

    EE.prototype.selectedTrackEndFrame = function() {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return 0;
        return this.normalizeTrackEndFrame(tr);
    };

    EE.prototype.clampFrameToSelectedTrackEnd = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return frame;
        var endFrame = this.normalizeTrackEndFrame(tr);
        return Math.max(0, Math.min(frame, endFrame));
    };

    EE.prototype.ensureTrack = function(eid, page) {
        var k = this.key(eid, page);
        if (this.model.tracks[k] && this.model.tracks[k]._eeV2) {
            if (!Array.isArray(this.model.tracks[k].extraCharRows)) this.model.tracks[k].extraCharRows = [];
            if (!Array.isArray(this.model.tracks[k].tempCharRows)) this.model.tracks[k].tempCharRows = [];
            this.normalizeTrackEndFrame(this.model.tracks[k]);
            return this.model.tracks[k];
        }
        var tr = { eventId: eid, pageIndex: page, commands: [], extraCharRows: [], tempCharRows: [], endFrame: 0, _eeV2: true };
        var list = (((($dataMap.events[eid] || {}).pages || [])[page] || {}).list) || [];
        var f = 0;
        this._eeTrackParseMode = true;
        try {
            for (var i = 0; i < list.length; i++) {
                var cmd = list[i];
                if (!cmd || cmd.code === 0) continue;
                if (cmd.code === 230) {
                    f += Math.max(0, Math.floor(Number((cmd.parameters || [0])[0] || 0)));
                    continue;
                }
                if (cmd.code === 408 || cmd.code === 505) continue;
                if (cmd.code === 108) {
                    var ce = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                    ce.commentLines = [String((cmd.parameters || [''])[0] || '')];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 408) {
                        i++;
                        ce.commentLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    this.memoApplyParsedStateToEntry(ce);
                    if (ce.isMemo) ce.commentLines = [this.memoCommentLine(ce.memoSize, ce.memoText)];
                    ce.command.parameters = [ce.commentLines[0] || ''];
                    tr.commands.push(ce);
                    continue;
                }
                if (cmd.code === 101) {
                    var me = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                    me.isMessage = true;
                    me.messageLines = [];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 401) {
                        i++;
                        me.messageLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    tr.commands.push(me);
                    continue;
                }
                if (cmd.code === 355) {
                    var se = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                    se.isScript = true;
                    se.scriptLines = [String((cmd.parameters || [''])[0] || '')];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 655) {
                        i++;
                        se.scriptLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    se.command.parameters = [String(se.scriptLines[0] || '')];
                    tr.commands.push(se);
                    continue;
                }
                if (cmd.code === 655) {
                    // Fallback: preserve malformed standalone 655 as a 355 single-line script.
                    var scmd = {
                        code: 355,
                        indent: Number(cmd.indent || 0),
                        parameters: [String((cmd.parameters || [''])[0] || '')]
                    };
                    var sfe = this.entryFromCommand(scmd, eid, page, f, this.model.nextUid++);
                    sfe.isScript = true;
                    sfe.scriptLines = [String((scmd.parameters || [''])[0] || '')];
                    tr.commands.push(sfe);
                    continue;
                }
                if (cmd.code === 105) {
                    var sce = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                    sce.isScrollMessage = true;
                    sce.scrollLines = [];
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 405) {
                        i++;
                        sce.scrollLines.push(String((list[i].parameters || [''])[0] || ''));
                    }
                    tr.commands.push(sce);
                    continue;
                }
                if (cmd.code === 405) continue;
                if (cmd.code === 401) continue;
                var e = this.entryFromCommand(cmd, eid, page, f, this.model.nextUid++);
                if (!e) continue;
                tr.commands.push(e);
                f += Math.max(0, Math.floor(e.wait || 0));
            }
        } finally {
            this._eeTrackParseMode = false;
        }
        // Keep trailing wait (if any) as explicit timeline end marker frame.
        tr.endFrame = Math.max(0, Math.floor(Number(f || 0)));
        this.normalizeTrackEndFrame(tr);
        this.mergeMessageSettingsIntoShowTextEntries(tr);
        // Register track before tile-goto wait normalization so simulation
        // can replay this newly parsed track and read true execution position.
        this.model.tracks[k] = tr;
        this.rebuildSchedule();
        this.normalizeTrackRouteTileGotoWaitMeta(tr);
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.model.tracks[k] = tr;
        this.rebuildSchedule();
        return tr;
    };

    EE.prototype.execEntry = function(e) {
        if (!e || !e.command) return;
        var c = e.command, code = c.code, p = clone(c.parameters || []);
        var af = this._simToRunning ? this._simExecFrame : this.frame;
        af = Math.max(0, Math.floor(Number(af || 0)));
        if (!this._simToRunning) {
            this.appendExecutionLog(code, af, e);
            this.triggerExecutionPulse(Number(e.uid || 0), -1);
            if (code === 205) this.triggerRouteExecutionPulses(e);
        }
        if (code === 117) { if ($gameTemp && $gameTemp.reserveCommonEvent) $gameTemp.reserveCommonEvent(p[0]); return; }
        if (code === 230) return;
        if (this.handleAudioCommand(code, p, af)) return;
        if (code === 356) installEscapeConvertFallback();
        var it = new Game_Interpreter();
        it._mapId = $gameMap.mapId();
        it._eventId = e.eventId || 0;
        it._params = p;
        var lst = [];
        if (code === 101) {
            var pre = this.messageExtCommandsFromEntry(e);
            for (var pi = 0; pi < pre.length; pi++) {
                var pc = pre[pi];
                if (pc && Number(pc.code || 0) === 356) installEscapeConvertFallback();
                lst.push(clone(pc));
            }
            lst.push({ code: code, indent: Number(c.indent || 0), parameters: p });
        } else {
            lst.push({ code: code, indent: Number(c.indent || 0), parameters: p });
        }
        if (code === 101 && e.messageLines && e.messageLines.length) {
            for (var i = 0; i < e.messageLines.length; i++) {
                lst.push({ code: 401, indent: Number(c.indent || 0), parameters: [String(e.messageLines[i] || '')] });
            }
        } else if (code === 355) {
            var slines = (e.scriptLines && e.scriptLines.length)
                ? e.scriptLines
                : [String((c.parameters || [''])[0] || '')];
            lst[0].parameters = [String(slines[0] || '')];
            for (var si = 1; si < slines.length; si++) {
                lst.push({ code: 655, indent: Number(c.indent || 0), parameters: [String(slines[si] || '')] });
            }
        } else if (code === 105) {
            var tlines = (e.scrollLines && e.scrollLines.length)
                ? e.scrollLines
                : [];
            for (var ti = 0; ti < tlines.length; ti++) {
                lst.push({ code: 405, indent: Number(c.indent || 0), parameters: [String(tlines[ti] || '')] });
            }
        }
        lst.push({ code: 0, indent: 0, parameters: [] });
        it._list = lst;
        it._index = 0;
        try {
            // Execute sequentially until a command requests wait (returns false)
            // or the temporary list is consumed.
            while (it._list && it._index < it._list.length) {
                if (!it.executeCommand()) break;
            }
        } catch (er) {
            if (code === 356) {
                this.fatal('E_EXEC_356', er);
                return;
            }
            this.err('E_EXEC_' + code, er);
        }
    };

    EE.prototype.renderExecutionLog = function(forceScrollBottom) {
        if (!this.execLogView) return;
        var self = this;
        var lines = Array.isArray(this.execLogLines) ? this.execLogLines : [];
        this.execLogView.innerHTML = '';
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            var txt = (ln && typeof ln === 'object') ? String(ln.text || '') : String(ln || '');
            var row = this.el('div', 'elog-item', '');
            if (ln && typeof ln === 'object' && (ln.nameText != null || ln.detailText != null)) {
                var mainParts = (ln.mainParts && Array.isArray(ln.mainParts)) ? ln.mainParts : null;
                if (mainParts && mainParts.length) {
                    for (var mp = 0; mp < mainParts.length; mp++) {
                        var part = mainParts[mp];
                        if (!part || part.text == null) continue;
                        var partSpan = this.el('span', 'elog-main', String(part.text));
                        if (part.color) partSpan.style.color = String(part.color);
                        row.appendChild(partSpan);
                    }
                } else {
                    var mainSpan = this.el('span', 'elog-main', String(ln.nameText == null ? '' : ln.nameText));
                    row.appendChild(mainSpan);
                }
                var dText = String(ln.detailText == null ? '' : ln.detailText).trim();
                if (dText.length) {
                    var detailSpan = this.el('span', 'elog-detail', ' : ' + dText);
                    if (ln.detailColor) detailSpan.style.color = String(ln.detailColor);
                    row.appendChild(detailSpan);
                }
            } else {
                row.textContent = txt;
            }
            var uid = (ln && typeof ln === 'object') ? Math.floor(Number(ln.uid || 0)) : 0;
            var rli = (ln && typeof ln === 'object') ? this.nodeRouteIndex(ln.routeListIndex) : -1;
            if (uid > 0) {
                row.classList.add('hit');
                (function(uu, rr) {
                    row.addEventListener('mouseenter', function() {
                        self.triggerExecutionPulse(uu, rr);
                    });
                    row.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        self.focusExecutionLogTarget(uu, rr);
                    });
                })(uid, rli);
            }
            this.execLogView.appendChild(row);
        }
        if (forceScrollBottom) {
            this.execLogView.scrollTop = this.execLogView.scrollHeight;
        }
    };

    EE.prototype.stopTimelineAutoScrollAnimation = function() {
        var st = this._timelineAutoScrollAnim;
        if (!st) return;
        if (st.rafId != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(st.rafId);
        }
        this._timelineAutoScrollAnim = null;
    };

    EE.prototype.animateTimelineScrollTo = function(targetLeft, targetTop, durationMs) {
        if (!this.timelineWrap) return;
        var wrap = this.timelineWrap;
        var maxLeft = Math.max(0, Math.floor(Number(wrap.scrollWidth || 0) - Number(wrap.clientWidth || 0)));
        var maxTop = Math.max(0, Math.floor(Number(wrap.scrollHeight || 0) - Number(wrap.clientHeight || 0)));
        var tLeft = Math.max(0, Math.min(maxLeft, Math.floor(Number(targetLeft || 0))));
        var tTop = Math.max(0, Math.min(maxTop, Math.floor(Number(targetTop || 0))));
        var sLeft = Math.max(0, Math.floor(Number(wrap.scrollLeft || 0)));
        var sTop = Math.max(0, Math.floor(Number(wrap.scrollTop || 0)));
        var dx = tLeft - sLeft;
        var dy = tTop - sTop;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        this.stopTimelineAutoScrollAnimation();
        if (typeof requestAnimationFrame !== 'function') {
            wrap.scrollLeft = tLeft;
            wrap.scrollTop = tTop;
            this.timelineDirty = true;
            return;
        }
        var self = this;
        var st = {
            start: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
            duration: Math.max(80, Math.floor(Number(durationMs || 180))),
            startLeft: sLeft,
            startTop: sTop,
            targetLeft: tLeft,
            targetTop: tTop,
            rafId: null
        };
        var step = function(now) {
            if (!self._timelineAutoScrollAnim || self._timelineAutoScrollAnim !== st) return;
            var t = Math.min(1, Math.max(0, (Number(now || 0) - st.start) / Math.max(1, st.duration)));
            var eased = 1 - Math.pow(1 - t, 3);
            wrap.scrollLeft = Math.round(st.startLeft + (st.targetLeft - st.startLeft) * eased);
            wrap.scrollTop = Math.round(st.startTop + (st.targetTop - st.startTop) * eased);
            self.timelineDirty = true;
            if (t < 1) {
                st.rafId = requestAnimationFrame(step);
            } else {
                self._timelineAutoScrollAnim = null;
            }
        };
        this._timelineAutoScrollAnim = st;
        st.rafId = requestAnimationFrame(step);
    };

    EE.prototype.autoScrollTimelineForPlayback = function() {
        if (!this.play || !this.timelineWrap) return;
        var wrap = this.timelineWrap;
        var viewW = Math.max(1, Math.floor(Number(wrap.clientWidth || 0)));
        var labelW = Math.max(0, Math.floor(Number(this.labelW || 0)));
        if (viewW <= labelW + 16) return;
        if ((Number(wrap.scrollWidth || 0) - viewW) <= 1) return;
        var margin = 18;
        var cursorX = this.frameToX(Math.max(0, Math.floor(Number(this.frame || 0))));
        var rightEdge = Number(wrap.scrollLeft || 0) + viewW - margin;
        if (cursorX <= rightEdge) return;
        if (this._timelineAutoScrollAnim) return;
        var pageSpan = Math.max(24, viewW - labelW - 16);
        var targetLeft = Math.floor(Number(wrap.scrollLeft || 0) + pageSpan);
        var minLeftForCursor = Math.floor(cursorX - (viewW - margin - 1));
        if (targetLeft < minLeftForCursor) targetLeft = minLeftForCursor;
        this.animateTimelineScrollTo(targetLeft, Number(wrap.scrollTop || 0), 120);
    };

    EE.prototype.isTimelinePointVisible = function(x, y, margin) {
        if (!this.timelineWrap) return true;
        margin = Math.max(0, Math.floor(Number(margin == null ? 18 : margin)));
        var wrap = this.timelineWrap;
        var left = Math.max(0, Number(wrap.scrollLeft || 0) + Number(this.labelW || 0) + margin);
        var right = Math.max(left, Number(wrap.scrollLeft || 0) + Number(wrap.clientWidth || 0) - margin);
        var top = Math.max(0, Number(wrap.scrollTop || 0) + margin);
        var bottom = Math.max(top, Number(wrap.scrollTop || 0) + Number(wrap.clientHeight || 0) - margin);
        return Number(x || 0) >= left && Number(x || 0) <= right && Number(y || 0) >= top && Number(y || 0) <= bottom;
    };

    EE.prototype.findExecutionNodePosition = function(uid, routeListIndex) {
        uid = Math.floor(Number(uid || 0));
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (uid <= 0) return null;
        this.drawTimeline();
        var hits = Array.isArray(this.hitNodes) ? this.hitNodes : [];
        var i, n;
        for (i = hits.length - 1; i >= 0; i--) {
            n = hits[i];
            if (!n) continue;
            if (Math.floor(Number(n.uid || 0)) !== uid) continue;
            if (routeListIndex >= 0 && this.nodeRouteIndex(n.routeListIndex) !== routeListIndex) continue;
            if (routeListIndex < 0 && this.nodeRouteIndex(n.routeListIndex) >= 0) continue;
            return {
                uid: uid,
                routeListIndex: this.nodeRouteIndex(n.routeListIndex),
                frame: Math.max(0, Math.floor(Number(n.frame || 0))),
                x: Number(n.x || 0),
                y: Number(n.y || 0)
            };
        }
        var e = this.findEntryInSelectedTrack(uid);
        if (!e) return null;
        var frame = Math.max(0, Math.floor(Number(e.frame || 0)));
        var resolvedRouteIndex = routeListIndex;
        if (routeListIndex >= 0 && e.command && Number(e.command.code || 0) === 205) {
            var route = e.command.parameters && e.command.parameters[1];
            var tl = this.moveRouteTimeline(route);
            var items = tl && Array.isArray(tl.items) ? tl.items : [];
            var matched = false;
            for (i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it) continue;
                if (this.nodeRouteIndex(it.listIndex) !== routeListIndex) continue;
                frame = Math.max(0, Math.floor(Number(e.frame || 0)) + Math.max(0, Math.floor(Number(it.offset || 0))));
                matched = true;
                break;
            }
            if (!matched) resolvedRouteIndex = -1;
        } else {
            resolvedRouteIndex = -1;
        }
        var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
        var ri = this.rowIndexByKey(rk);
        var met = (ri >= 0 && this._rowMetrics && this._rowMetrics[ri]) ? this._rowMetrics[ri] : null;
        var y = met ? Number(met.center || 0) : (this.rulerH + Math.floor(this.rowH / 2));
        if (rk === 'main' && met) {
            var lane = (this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(uid)) ? Number(this._mainLaneByUid[uid] || 0) : 0;
            y = Number(met.top || this.rulerH) + this.mainLaneTop + lane * this.mainLaneGap;
        }
        return {
            uid: uid,
            routeListIndex: resolvedRouteIndex,
            frame: frame,
            x: this.frameToX(frame),
            y: y
        };
    };

    EE.prototype.ensureTimelineNodeVisible = function(pos) {
        if (!pos || !this.timelineWrap) return;
        if (this.isTimelinePointVisible(pos.x, pos.y, 18)) return;
        var wrap = this.timelineWrap;
        var viewW = Math.max(1, Number(wrap.clientWidth || 1));
        var viewH = Math.max(1, Number(wrap.clientHeight || 1));
        var targetLeft = Number(pos.x || 0) - (viewW * 0.5 + Number(this.labelW || 0) * 0.5);
        var targetTop = Number(pos.y || 0) - viewH * 0.5;
        this.animateTimelineScrollTo(targetLeft, targetTop, 170);
    };

    EE.prototype.focusExecutionLogTarget = function(uid, routeListIndex) {
        uid = Math.floor(Number(uid || 0));
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (uid <= 0) return;
        var pos = this.findExecutionNodePosition(uid, routeListIndex);
        if (!pos) return;
        if (this.hasRangeSelection()) this.clearRangeSelection();
        this.selUid = uid;
        this.selRouteListIndex = (pos.routeListIndex >= 0) ? pos.routeListIndex : -1;
        this.frame = Math.max(0, Math.floor(Number(pos.frame || 0)));
        this.setHoverNode({ uid: uid, routeListIndex: this.selRouteListIndex });
        this.triggerExecutionPulse(uid, this.selRouteListIndex);
        this.seek(this.frame);
        this.ensureTimelineNodeVisible(pos);
        this.timelineDirty = true;
    };

    EE.prototype.executionEventLabelForEntry = function(entry) {
        var eid = Math.floor(Number(entry && entry.eventId || 0));
        var nm = '(no name)';
        try {
            var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eid] : null;
            if (ev && ev.name) nm = String(ev.name);
        } catch (_) {}
        return '[Event ' + eid + ':' + nm + ']';
    };

    EE.prototype.executionMoveRouteTargetLabelForEntry = function(entry) {
        var targetId = 0;
        if (entry && entry.command && Number(entry.command.code || 0) === 205) {
            var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
            var fromEntry = (entry.charId == null) ? Number(p[0] || 0) : Number(entry.charId || 0);
            targetId = this.normalizeMoveTarget(fromEntry);
        }
        if (targetId === 0 && entry && Number(entry.eventId || 0) > 0) {
            targetId = Number(entry.eventId || 0);
        }
        if (targetId === -1) return '[Player]';
        if (targetId === 0) return '[This Event]';
        var nm = '(no name)';
        try {
            var ev = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[targetId] : null;
            if (ev && ev.name) nm = String(ev.name);
        } catch (_) {}
        return '[Event ' + targetId + ':' + nm + ']';
    };

    EE.prototype.executionLogText = function(base, name, detail) {
        var t = String(base || '') + String(name || '');
        detail = String(detail == null ? '' : detail).replace(/\r?\n/g, ' / ').trim();
        if (detail.length) t += ' : ' + detail;
        t = t.replace(/\s+/g, ' ').trim();
        var maxLen = 180;
        if (t.length > maxLen) t = t.slice(0, maxLen - 3) + '...';
        return t;
    };

    EE.prototype.executionLogTextParts = function(base, name, detail) {
        var nameText = String(base || '') + String(name || '');
        nameText = nameText.replace(/\s+/g, ' ').trim();
        detail = String(detail == null ? '' : detail).replace(/\r?\n/g, ' / ').trim();
        if (detail.length > 140) detail = detail.slice(0, 137) + '...';
        return { nameText: nameText, detailText: detail };
    };

    EE.prototype.executionLogRecordsForEntry = function(code, frame, entry) {
        var out = [];
        var c = Math.floor(Number(code || 0));
        var f = Math.max(0, Math.floor(Number(frame || 0)));
        var base = String(f) + 'f  ';
        if (c === 205 && entry) {
            var head = this.executionMoveRouteTargetLabelForEntry(entry);
            var headColor = 'rgba(255,186,118,.98)';
            var route = entry.command && entry.command.parameters ? entry.command.parameters[1] : null;
            var tl = this.moveRouteTimeline(route);
            var items = tl && Array.isArray(tl.items) ? tl.items : [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it) continue;
                var cmd = it.command || null;
                var dcode = Number((it.displayCode != null) ? it.displayCode : (cmd ? cmd.code : 0));
                if (dcode <= 0 || dcode === 15) continue;
                var nm = (dcode === 4500) ? 'タイル移動' : this.routeCommandNameJa(dcode);
                var detail = '';
                if (dcode === 4500) detail = this.routeTileGotoTooltipText(entry, it.listIndex, it.span);
                else detail = this.routeCommandTooltipDetailText(cmd);
                var p1 = this.executionLogTextParts(base, head + nm, detail);
                out.push({
                    text: this.executionLogText(base, head + nm, detail),
                    nameText: p1.nameText,
                    mainParts: [
                        { text: base },
                        { text: head, color: headColor },
                        { text: nm }
                    ],
                    detailText: p1.detailText,
                    uid: Number(entry.uid || 0),
                    routeListIndex: this.nodeRouteIndex(it.listIndex)
                });
            }
            if (!out.length) {
                var routeDetail = this.commandTooltipDetailText(entry);
                var p2 = this.executionLogTextParts(base, head + '移動ルートの設定', routeDetail);
                out.push({
                    text: this.executionLogText(base, head + '移動ルートの設定', routeDetail),
                    nameText: p2.nameText,
                    mainParts: [
                        { text: base },
                        { text: head, color: headColor },
                        { text: '移動ルートの設定' }
                    ],
                    detailText: p2.detailText,
                    uid: Number(entry.uid || 0),
                    routeListIndex: -1
                });
            }
            return out;
        }
        var dcode = this.mainCommandDisplayCodeForEntry(entry);
        var name = (typeof this.commandNameJa === 'function')
            ? this.commandNameJa(dcode || c)
            : ('コマンド' + (dcode || c));
        var mainDetail = this.commandTooltipDetailText(entry);
        var p3 = this.executionLogTextParts(base, name, mainDetail);
        var detailColor = (Number(dcode || c) === 108) ? 'rgba(80,220,110,.98)' : '';
        out.push({
            text: this.executionLogText(base, name, mainDetail),
            nameText: p3.nameText,
            detailText: p3.detailText,
            detailColor: detailColor,
            uid: Number(entry && entry.uid || 0),
            routeListIndex: -1
        });
        return out;
    };

    EE.prototype.appendExecutionLog = function(code, frame, entry) {
        if (!this.execLogView) return;
        if (!Array.isArray(this.execLogLines)) this.execLogLines = [];
        var records = this.executionLogRecordsForEntry(code, frame, entry);
        for (var i = 0; i < records.length; i++) this.execLogLines.push(records[i]);
        var lim = Math.max(20, Math.floor(Number(this.execLogMax || 240)));
        if (this.execLogLines.length > lim) {
            this.execLogLines.splice(0, this.execLogLines.length - lim);
        }
        this.renderExecutionLog(true);
    };

    EE.prototype.executionPulseKey = function(uid, routeListIndex) {
        var u = Math.floor(Number(uid || 0));
        var r = this.nodeRouteIndex(routeListIndex);
        return String(u) + ':' + String(r);
    };

    EE.prototype.triggerExecutionPulse = function(uid, routeListIndex) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return;
        if (!this._execNodePulses || typeof this._execNodePulses !== 'object') {
            this._execNodePulses = Object.create(null);
        }
        this._execNodePulses[this.executionPulseKey(uid, routeListIndex)] = Date.now();
        this.timelineDirty = true;
    };

    EE.prototype.triggerRouteExecutionPulses = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return;
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var items = tl && Array.isArray(tl.items) ? tl.items : [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it) continue;
            var cmd = it.command || null;
            var displayCode = Number((it.displayCode != null) ? it.displayCode : (cmd ? cmd.code : 0));
            if (displayCode <= 0 || displayCode === 15) continue;
            var listIndex = this.nodeRouteIndex(it.listIndex);
            if (listIndex < 0) continue;
            this.triggerExecutionPulse(Number(entry.uid || 0), listIndex);
        }
    };

    EE.prototype.pruneExecutionPulses = function(nowMs) {
        if (!this._execNodePulses || typeof this._execNodePulses !== 'object') return false;
        var now = Math.max(0, Number(nowMs || 0));
        var dur = 420;
        var has = false;
        for (var k in this._execNodePulses) {
            if (!Object.prototype.hasOwnProperty.call(this._execNodePulses, k)) continue;
            var st = Number(this._execNodePulses[k] || 0);
            if (!isFinite(st) || now - st > dur) {
                delete this._execNodePulses[k];
                continue;
            }
            has = true;
        }
        return has;
    };

    EE.prototype.drawExecutionPulse = function(ctx, uid, routeListIndex, x, y, baseRadius, nowMs) {
        if (!ctx || !this._execNodePulses) return false;
        var key = this.executionPulseKey(uid, routeListIndex);
        var st = Number(this._execNodePulses[key] || 0);
        if (!st) return false;
        var now = Math.max(0, Number(nowMs || Date.now()));
        var dur = 420;
        var t = (now - st) / dur;
        if (!isFinite(t) || t < 0) t = 0;
        if (t >= 1) {
            delete this._execNodePulses[key];
            return false;
        }
        var alpha = Math.max(0, (1 - t) * (1 - t) * 0.95);
        var rad = Math.max(1, Number(baseRadius || 4)) + 2 + t * 14;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = 0.8 + (1 - t) * 2.0;
        ctx.beginPath();
        ctx.arc(Number(x || 0), Number(y || 0), rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return true;
    };

    EE.prototype.getTrackRows = function(tr) {
        var rows = [{ key: 'main', type: 'main', label: 'Main' }];
        if (!tr) return rows;
        var used = {};
        var extra = Array.isArray(tr.extraCharRows) ? tr.extraCharRows : [];
        for (var ei = 0; ei < extra.length; ei++) {
            var ex = this.normalizeMoveTarget(Number(extra[ei] || 0));
            used[ex] = true;
        }
        var temp = Array.isArray(tr.tempCharRows) ? tr.tempCharRows : [];
        for (var ti = 0; ti < temp.length; ti++) {
            var tx = this.normalizeMoveTarget(Number(temp[ti] || 0));
            used[tx] = true;
        }
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char') continue;
            used[e.charId] = true;
        }
        var ids = Object.keys(used).map(function(v) { return Number(v); });
        ids.sort(function(a, b) {
            if (a === -1) return -1;
            if (b === -1) return 1;
            if (a === 0 && b !== -1) return -1;
            if (b === 0 && a !== -1) return 1;
            return a - b;
        });
        for (var j = 0; j < ids.length; j++) {
            rows.push({ key: 'char:' + ids[j], type: 'char', charId: ids[j], label: this.rowLabelForCharId(ids[j]) });
        }
        return rows;
    };

    EE.prototype.rowLabelForCharId = function(id) {
        if (id === -1) return 'Player';
        if (id === 0) return 'This Event';
        var ev = $dataMap && $dataMap.events ? $dataMap.events[id] : null;
        var n = ev && ev.name ? ev.name : '(event)';
        return 'Event ' + id + ': ' + n;
    };

    EE.prototype.trackHasCharRow = function(tr, charId) {
        if (!tr) return false;
        charId = this.normalizeMoveTarget(charId);
        var extra = Array.isArray(tr.extraCharRows) ? tr.extraCharRows : [];
        for (var i = 0; i < extra.length; i++) {
            if (this.normalizeMoveTarget(extra[i]) === charId) return true;
        }
        var cmds = Array.isArray(tr.commands) ? tr.commands : [];
        for (i = 0; i < cmds.length; i++) {
            var e = cmds[i];
            if (!e || e.rowType !== 'char') continue;
            if (this.normalizeMoveTarget(e.charId) === charId) return true;
        }
        return false;
    };

    EE.prototype.canAddCharRowToTimeline = function(charId) {
        if (!this.selEid || this.selPage < 0 || !this.selKey) return false;
        var tr = this.model.tracks[this.selKey] || this.ensureTrack(this.selEid, this.selPage);
        return !this.trackHasCharRow(tr, charId);
    };

    EE.prototype.addCharRowToTimeline = function(charId) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        charId = this.normalizeMoveTarget(charId);
        if (this.trackHasCharRow(tr, charId)) return false;
        this.pushSnap('addCharRow');
        if (!Array.isArray(tr.extraCharRows)) tr.extraCharRows = [];
        tr.extraCharRows.push(charId);
        tr.extraCharRows.sort(function(a, b) {
            a = Number(a || 0);
            b = Number(b || 0);
            if (a === -1) return -1;
            if (b === -1) return 1;
            if (a === 0 && b !== -1) return -1;
            if (b === 0 && a !== -1) return 1;
            return a - b;
        });
        if (Array.isArray(tr.tempCharRows)) {
            tr.tempCharRows = tr.tempCharRows.filter(function(v) { return Number(v) !== Number(charId); });
        }
        this.timelineDirty = true;
        this.refreshCharacterPanel(true);
        return true;
    };

    EE.prototype.trackHasCharCommands = function(tr, charId) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        charId = this.normalizeMoveTarget(charId);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || e.rowType !== 'char') continue;
            if (this.normalizeMoveTarget(e.charId) === charId) return true;
        }
        return false;
    };

    EE.prototype.removeCharRowFromExtra = function(tr, charId) {
        if (!tr || !Array.isArray(tr.extraCharRows)) return;
        charId = this.normalizeMoveTarget(charId);
        tr.extraCharRows = tr.extraCharRows.filter(function(v) {
            return Number(v) !== Number(charId);
        });
    };

    EE.prototype.ensureTemporaryCharRow = function(charId) {
        if (!this.selKey) return false;
        var tr = this.model.tracks[this.selKey] || this.ensureTrack(this.selEid, this.selPage);
        charId = this.normalizeMoveTarget(charId);
        if (this.trackHasCharRow(tr, charId)) return false;
        if (!Array.isArray(tr.tempCharRows)) tr.tempCharRows = [];
        for (var i = 0; i < tr.tempCharRows.length; i++) {
            if (Number(tr.tempCharRows[i]) === Number(charId)) return false;
        }
        tr.tempCharRows.push(charId);
        if (!Array.isArray(tr.extraCharRows)) tr.extraCharRows = [];
        tr.extraCharRows.push(charId);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.cleanupTemporaryCharRows = function(keepCharId) {
        if (!this.selKey) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr || !Array.isArray(tr.tempCharRows) || !tr.tempCharRows.length) return;
        var keep = (keepCharId == null) ? null : this.normalizeMoveTarget(keepCharId);
        var next = [];
        var changed = false;
        for (var i = 0; i < tr.tempCharRows.length; i++) {
            var id = this.normalizeMoveTarget(Number(tr.tempCharRows[i] || 0));
            if (this.trackHasCharCommands(tr, id)) { changed = true; continue; }
            if (keep != null && Number(keep) === Number(id)) {
                next.push(id);
                continue;
            }
            this.removeCharRowFromExtra(tr, id);
            changed = true;
        }
        tr.tempCharRows = next;
        if (changed) {
            this.timelineDirty = true;
            this.refreshCharacterPanel(true);
        }
    };

    EE.prototype.confirmCharRowPermanent = function(charId) {
        if (!this.selKey) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr || !Array.isArray(tr.tempCharRows)) return;
        var id = this.normalizeMoveTarget(charId);
        var oldLen = tr.tempCharRows.length;
        tr.tempCharRows = tr.tempCharRows.filter(function(v) { return Number(v) !== Number(id); });
        if (tr.tempCharRows.length !== oldLen) this.refreshCharacterPanel(true);
    };

    EE.prototype.selectCharacterForTimeline = function(charId, source) {
        if (this.dragMode === 'tile') return;
        charId = this.normalizeMoveTarget(charId);
        if (!this.selKey && charId > 0) this.selectEvent(charId, true);
        this.cleanupTemporaryCharRows(charId);
        this.panelSelectedCharId = charId;
        if (this.selKey) this.ensureTemporaryCharRow(charId);
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        if (source === 'map') this.msg('キャラ選択: ' + this.rowLabelForCharId(charId));
    };

    EE.prototype.characterPanelEntryName = function(id) {
        if (id === -1) return 'プレイヤー';
        if (id === 0) return 'このイベント';
        var ev = $dataMap && Array.isArray($dataMap.events) ? $dataMap.events[id] : null;
        var nm = ev && ev.name ? String(ev.name) : '(event)';
        return nm;
    };

    EE.prototype.currentSelectedCharacterId = function() {
        return (this.panelSelectedCharId == null)
            ? (this.selEid > 0 ? Number(this.selEid) : null)
            : Number(this.panelSelectedCharId);
    };

    EE.prototype.characterByPanelId = function(id) {
        id = Number(id || 0);
        if (id === -1) return $gamePlayer || null;
        if (id === 0) return this.selEid > 0 ? ($gameMap ? $gameMap.event(this.selEid) : null) : null;
        return $gameMap ? $gameMap.event(id) : null;
    };

    EE.prototype.characterStateLines = function(id, ch) {
        var lines = [];
        var sid = this.normalizeMoveTarget(id);
        lines.push('ID: ' + String(id));
        lines.push('名前: ' + this.characterPanelEntryName(id));
        if (!ch) {
            lines.push('状態: 取得できません');
            return lines;
        }
        var inTimeline = this.trackHasCharRow(this.selKey ? this.model.tracks[this.selKey] : null, sid);
        lines.push('タイムライン行: ' + (inTimeline ? 'あり' : 'なし'));
        lines.push('画面内: ' + (this.isCharacterVisibleOnScreen(ch) ? '表示中' : '画面外/非表示'));
        lines.push('座標: (' + Number(ch.x || 0) + ', ' + Number(ch.y || 0) + ')');
        lines.push('実座標: (' + Number(ch._realX == null ? ch.x || 0 : ch._realX).toFixed(2) + ', ' + Number(ch._realY == null ? ch.y || 0 : ch._realY).toFixed(2) + ')');
        var dir = (typeof ch.direction === 'function') ? Number(ch.direction() || 0) : Number(ch._direction || 0);
        lines.push('向き: ' + dir);
        lines.push('画像: ' + String(ch._characterName || '') + ' [' + Number(ch._characterIndex || 0) + ']');
        lines.push('不透明度: ' + Number(ch._opacity == null ? 255 : ch._opacity));
        lines.push('合成: ' + Number(ch._blendMode || 0));
        lines.push('移動速度: ' + Number(ch._moveSpeed || 0));
        lines.push('頻度: ' + Number(ch._moveFrequency || 0));
        lines.push('すり抜け: ' + (ch._through ? 'ON' : 'OFF'));
        lines.push('透明: ' + (ch._transparent ? 'ON' : 'OFF'));
        lines.push('歩行アニメ: ' + (ch._walkAnime ? 'ON' : 'OFF'));
        lines.push('足踏みアニメ: ' + (ch._stepAnime ? 'ON' : 'OFF'));
        lines.push('向き固定: ' + (ch._directionFix ? 'ON' : 'OFF'));
        if (typeof Game_Event !== 'undefined' && ch instanceof Game_Event) {
            var eid = (typeof ch.eventId === 'function') ? Number(ch.eventId() || 0) : Number(ch._eventId || 0);
            var ep = Math.max(-1, Number(ch._pageIndex == null ? -1 : ch._pageIndex));
            var ed = (typeof ch.event === 'function') ? ch.event() : null;
            var maxP = ed && Array.isArray(ed.pages) ? ed.pages.length : 0;
            lines.push('イベントID: ' + eid);
            lines.push('ページ: ' + (ep >= 0 ? (ep + 1) : '-'));
            lines.push('総ページ数: ' + maxP);
            lines.push('一時消去: ' + (ch._erased ? 'ON' : 'OFF'));
        } else if (id === -1) {
            var vType = (typeof ch.vehicle === 'function' && ch.vehicle()) ? String(ch.vehicle()._type || '') : '';
            lines.push('プレイヤー状態: ' + (vType ? ('乗り物=' + vType) : '徒歩'));
        }
        return lines;
    };

    EE.prototype.refreshSelectedCharacterInfo = function(force) {
        if (!this.charInfo) return;
        var id = this.currentSelectedCharacterId();
        var lines = [];
        if (id == null) {
            lines = ['未選択'];
        } else {
            lines = this.characterStateLines(id, this.characterByPanelId(id));
        }
        var text = lines.join('\n');
        if (!force && text === this._charInfoSig) return;
        this._charInfoSig = text;
        this.charInfo.textContent = text;
    };

    EE.prototype.characterOverlayItems = function() {
        var out = [];
        var ss = this.s && this.s._spriteset;
        var ls = ss && ss._characterSprites;
        if (!ls || !ls.length) return out;
        var minOverlayPx = 24;
        var selectedId = this.currentSelectedCharacterId();
        for (var i = 0; i < ls.length; i++) {
            var sp = ls[i];
            if (!sp || !sp.visible || !sp._character || !sp.getBounds) continue;
            var ch = sp._character;
            var cid = null;
            try {
                if (typeof Game_Player !== 'undefined' && ch instanceof Game_Player) cid = -1;
                else if (typeof Game_Event !== 'undefined' && ch instanceof Game_Event && ch.eventId) {
                    if (ch._erased) continue;
                    cid = Number(ch.eventId() || 0);
                }
            } catch (_) { cid = null; }
            if (cid == null) continue;
            var b = sp.getBounds();
            var bx = Number(b && b.x || 0);
            var by = Number(b && b.y || 0);
            var bw = Math.max(0, Number(b && b.width || 0));
            var bh = Math.max(0, Number(b && b.height || 0));
            if (bw <= 0 || bh <= 0) {
                var sx = 0, sy = 0;
                try { sx = Number(ch && ch.screenX ? ch.screenX() : (sp.x || 0)); } catch (_) { sx = Number(sp.x || 0); }
                try { sy = Number(ch && ch.screenY ? ch.screenY() : (sp.y || 0)); } catch (_) { sy = Number(sp.y || 0); }
                bw = minOverlayPx;
                bh = minOverlayPx;
                bx = sx - bw / 2;
                by = sy - bh;
            }
            var sr = this.canvasToScreenRect(bx, by, bw, bh);
            if (!sr) continue;
            var sw = Math.max(minOverlayPx, Number(sr.w || 0));
            var sh = Math.max(minOverlayPx, Number(sr.h || 0));
            var sx2 = Number(sr.x || 0) - Math.max(0, (sw - Number(sr.w || 0)) / 2);
            var sy2 = Number(sr.y || 0) - Math.max(0, (sh - Number(sr.h || 0)) / 2);
            var name = (cid === -1) ? 'プレイヤー' : this.characterPanelEntryName(cid);
            out.push({
                id: cid,
                name: name,
                x: Math.floor(sx2),
                y: Math.floor(sy2),
                w: Math.max(1, Math.floor(sw)),
                h: Math.max(1, Math.floor(sh)),
                sel: (selectedId != null && Number(selectedId) === Number(cid))
            });
        }
        return out;
    };

    EE.prototype.fitOverlayName = function(name, boxWidthPx) {
        name = String(name == null ? '' : name);
        if (!name) return '';
        var maxPx = Math.max(1, Math.floor(Number(boxWidthPx || 0)) - 8);
        if (maxPx <= 0) return name.charAt(0);
        if (!this._overlayNameMeasureCanvas) this._overlayNameMeasureCanvas = document.createElement('canvas');
        var ctx = this._overlayNameMeasureCanvas && this._overlayNameMeasureCanvas.getContext
            ? this._overlayNameMeasureCanvas.getContext('2d')
            : null;
        if (!ctx) return name;
        ctx.font = '10px "Yu Gothic UI","Meiryo UI",sans-serif';
        if (ctx.measureText(name).width <= maxPx) return name;
        var ell = '…';
        var first = name.charAt(0);
        if (name.length <= 1) return first;
        if (ctx.measureText(first + ell).width > maxPx) return first;
        var lo = 1, hi = name.length, best = first;
        while (lo <= hi) {
            var mid = Math.floor((lo + hi) / 2);
            var cand = name.slice(0, mid) + ell;
            if (ctx.measureText(cand).width <= maxPx) {
                best = cand;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best || first;
    };

    EE.prototype.refreshCharacterOverlay = function(force) {
        if (!this.charOverlayLayer) return;
        if (this.play) {
            if (this.charOverlayLayer.style.display !== 'none') this.charOverlayLayer.style.display = 'none';
            this._charOverlaySig = '';
            return;
        }
        this.charOverlayLayer.style.display = 'block';
        var items = this.characterOverlayItems();
        var sig = '';
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            sig += it.id + ':' + it.x + ':' + it.y + ':' + it.w + ':' + it.h + ':' + (it.sel ? 1 : 0) + '|';
        }
        if (!force && sig === this._charOverlaySig) return;
        this._charOverlaySig = sig;
        this.charOverlayLayer.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (i = 0; i < items.length; i++) {
            var it2 = items[i];
            var box = this.el('div', 'ovit' + (it2.sel ? ' sel' : ''));
            box.setAttribute('data-char-id', String(Number(it2.id || 0)));
            box.style.left = it2.x + 'px';
            box.style.top = it2.y + 'px';
            box.style.width = it2.w + 'px';
            box.style.height = it2.h + 'px';
            var nm = this.el('div', 'ovnm', this.fitOverlayName(it2.name, it2.w));
            nm.setAttribute('data-char-id', String(Number(it2.id || 0)));
            nm.title = String(it2.name || '');
            box.appendChild(nm);
            frag.appendChild(box);
        }
        this.charOverlayLayer.appendChild(frag);
    };

    EE.prototype.isCharacterVisibleOnScreen = function(ch) {
        if (!ch) return false;
        try {
            if (ch._erased) return false;
            if (typeof ch.isTransparent === 'function' && ch.isTransparent()) return false;
        } catch (_) {}
        var sx = 0, sy = 0;
        try { sx = Number(ch.screenX ? ch.screenX() : 0); } catch (_) { sx = 0; }
        try { sy = Number(ch.screenY ? ch.screenY() : 0); } catch (_) { sy = 0; }
        return sx >= -48 && sx <= Graphics.boxWidth + 48 && sy >= -48 && sy <= Graphics.boxHeight + 48;
    };

    EE.prototype.buildCharacterPanelEntries = function() {
        var ids = [-1, 0];
        var evs = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events : [];
        for (var i = 1; i < evs.length; i++) if (evs[i]) ids.push(i);
        var tr = this.selKey ? (this.model.tracks[this.selKey] || null) : null;
        var selectedId = this.currentSelectedCharacterId();
        var out = [];
        for (i = 0; i < ids.length; i++) {
            var id = Number(ids[i] || 0);
            var ch = this.characterByPanelId(id);
            var vis = this.isCharacterVisibleOnScreen(ch);
            var txt = String(id) + ' ' + this.characterPanelEntryName(id);
            out.push({
                id: id,
                text: txt,
                visible: vis,
                selected: (selectedId != null && selectedId === id),
                inTimeline: this.trackHasCharRow(tr, id)
            });
        }
        out.sort(function(a, b) {
            if (a.visible !== b.visible) return a.visible ? -1 : 1;
            return a.id - b.id;
        });
        return out;
    };

    EE.prototype.closeCharContextMenu = function() {
        this.charCtxTargetId = null;
        if (this.charCtx) this.charCtx.classList.remove('on');
    };

    EE.prototype.closeCameraContextMenu = function() {
        if (this.cameraCtx) this.cameraCtx.classList.remove('on');
    };

    EE.prototype.placeMenuInViewport = function(menu, screenX, screenY, pad) {
        if (!menu) return;
        pad = Math.max(0, Math.floor(Number(pad == null ? 4 : pad) || 0));
        var ww = Math.max(1, Math.floor(Number(window.innerWidth || 1)));
        var wh = Math.max(1, Math.floor(Number(window.innerHeight || 1)));
        var x = Math.max(pad, Math.floor(Number(screenX || 0)));
        var y = Math.max(pad, Math.floor(Number(screenY || 0)));
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        var rect = menu.getBoundingClientRect ? menu.getBoundingClientRect() : null;
        var mw = Math.max(1, Math.ceil(Number(rect && rect.width || menu.offsetWidth || 1)));
        var mh = Math.max(1, Math.ceil(Number(rect && rect.height || menu.offsetHeight || 1)));
        var maxX = Math.max(pad, ww - mw - pad);
        var maxY = Math.max(pad, wh - mh - pad);
        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;
        if (x < pad) x = pad;
        if (y < pad) y = pad;
        menu.style.left = Math.floor(x) + 'px';
        menu.style.top = Math.floor(y) + 'px';
    };

    EE.prototype.openCameraContextMenu = function(screenX, screenY, mapPoint) {
        if (!this.cameraCtx || !this.cameraCtxScrollBtn || !this.cameraCtxScrollToBtn) return;
        var hasTrack = !!(this.selEid && this.selPage >= 0 && this.selKey);
        this.cameraCtxScrollBtn.disabled = !hasTrack;
        this.cameraCtxScrollToBtn.disabled = !hasTrack;
        this.cameraCtxScrollBtn.textContent = hasTrack ? 'カメラ移動' : 'イベント未選択';
        this.cameraCtxScrollToBtn.textContent = hasTrack ? 'カメラ移動(直接指定)' : 'イベント未選択';
        this.cameraCtxMapX = Number(mapPoint && mapPoint.x != null ? mapPoint.x : 0);
        this.cameraCtxMapY = Number(mapPoint && mapPoint.y != null ? mapPoint.y : 0);
        this.cameraCtx.classList.add('on');
        this.placeMenuInViewport(this.cameraCtx, screenX, screenY, 4);
    };

    EE.prototype.onGameFrameContextMenu = function(e) {
        if (!this.on || !this.root) return;
        e.preventDefault();
        e.stopPropagation();
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        var mp = null;
        var cp = this.screenPointToCanvas(Number(e.clientX || 0), Number(e.clientY || 0));
        if (cp) mp = this.screenToMap(cp.x, cp.y, true);
        this.openCameraContextMenu(e.clientX, e.clientY, mp);
    };

    EE.prototype.addCameraMoveCommandFromContextMenu = function(kind) {
        this.closeCameraContextMenu();
        if (!this.needSelTrack()) return;
        kind = (String(kind || '') === 'scrollTo') ? 'scrollTo' : 'scroll';
        var x = 0;
        var y = 0;
        if (kind === 'scrollTo') {
            var hasPicked = isFinite(Number(this.cameraCtxMapX)) && isFinite(Number(this.cameraCtxMapY));
            if (hasPicked) {
                x = Number(this.cameraCtxMapX || 0);
                y = Number(this.cameraCtxMapY || 0);
            } else {
                x = Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0);
                y = Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0);
            }
        }
        var script = this.makeCameraMoveScript(kind, x, y, 60);
        var added = this.addCmd({ code: 355, indent: 0, parameters: [script] }, this.frame);
        if (!added) return;
        this.openEditor(Number(added.uid || 0));
    };

    EE.prototype.isAnyContextMenuOpen = function() {
        if (this.routeCtx && this.routeCtx.classList && this.routeCtx.classList.contains('on')) return true;
        if (this.charCtx && this.charCtx.classList && this.charCtx.classList.contains('on')) return true;
        if (this.cameraCtx && this.cameraCtx.classList && this.cameraCtx.classList.contains('on')) return true;
        return false;
    };

    EE.prototype.closeRouteRangeContextMenu = function() {
        this.routeRangeCtxUid = 0;
        this.routeCtxMode = 'route';
        this.routeCtxSqueezeEnabled = false;
        this.routeCtxMergeEnabled = false;
        this.routeCtxWaitInsertContext = null;
        if (this.routeCtx) this.routeCtx.classList.remove('on');
    };

    EE.prototype.openMemoCreateFromContextMenu = function() {
        if (!this.needSelTrack()) return;
        var ctx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        var frame = this.frame;
        if (ctx && ctx.frame != null) frame = ctx.frame;
        else if (ctx && ctx.frameStart != null) frame = ctx.frameStart;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        this.closeRouteRangeContextMenu();
        this.openMemoEditorForNew(frame);
    };

    EE.prototype.openFrameAddCommandFromContextMenu = function() {
        if (!this.needSelTrack()) return;
        var ctx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        if (String(ctx.source || '') !== 'frame') return;
        var frame = Math.max(0, Math.floor(Number(ctx.frame || 0)));
        var rowKey = String(ctx.rowKey || 'main');
        this.closeRouteRangeContextMenu();
        if (rowKey.indexOf('char:') === 0) {
            this.openRouteCommandPanel(frame, rowKey);
            return;
        }
        if (this.isFrameLockedForFrameCommandAdd(frame)) return;
        this.openAddCommandPanel(frame, 'main', this.makeAddPlacementContextFromFrame(frame));
    };

    EE.prototype.openRelativeAddCommandFromContextMenu = function(pos) {
        if (!this.needSelTrack()) return;
        pos = (String(pos || 'before') === 'after') ? 'after' : 'before';
        var ctx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        var src = String(ctx.source || '');
        if (src !== 'command' && src !== 'routeCmd') return;
        var placement = this.makeAddPlacementContextFromWaitInsertContext(ctx, pos);
        var previewFrame = this.computeAddFrameFromPlacementContext(placement, 0);
        this.closeRouteRangeContextMenu();
        if (src === 'routeCmd') {
            var re = this.findEntryInSelectedTrack(Math.floor(Number(ctx.uid || 0)));
            if (re && re.command && Number(re.command.code || 0) === 205 && String(re.rowKey || '').indexOf('char:') === 0) {
                this.openRouteCommandPanel(previewFrame, re.rowKey, placement);
                return;
            }
        }
        this.openAddCommandPanel(previewFrame, 'main', placement);
    };

    EE.prototype.sameFrameCommandMoveInfo = function(uid) {
        var out = { show: false, canPrev: false, canNext: false, uid: Math.floor(Number(uid || 0)), frame: 0 };
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return out;
        var tr = (this.model && this.model.tracks) ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return out;
        var e = this.findEntryInSelectedTrack(out.uid);
        if (!e) return out;
        out.frame = Math.max(0, Math.floor(Number(e.frame || 0)));
        var hasOtherSameFrame = false;
        for (var i = 0; i < tr.commands.length; i++) {
            var ce = tr.commands[i];
            if (!ce || Number(ce.uid || 0) === out.uid) continue;
            if (Math.max(0, Math.floor(Number(ce.frame || 0))) !== out.frame) continue;
            hasOtherSameFrame = true;
            break;
        }
        if (!hasOtherSameFrame) return out;
        if (Math.max(0, Math.floor(Number(e.wait || 0))) > 0) return out;
        var ordered = tr.commands.filter(function(ce) {
            return ce && Math.max(0, Math.floor(Number(ce.frame || 0))) === out.frame;
        }).sort(compareEntriesByFrameWaitUid);
        var movable = ordered.filter(function(ce) {
            return Math.max(0, Math.floor(Number(ce.wait || 0))) <= 0;
        });
        if (movable.length <= 1) return out;
        var idx = -1;
        for (i = 0; i < movable.length; i++) {
            if (Number(movable[i].uid || 0) === out.uid) { idx = i; break; }
        }
        if (idx < 0) return out;
        out.show = true;
        out.canPrev = idx > 0;
        out.canNext = idx >= 0 && idx < movable.length - 1;
        return out;
    };

    EE.prototype.moveSameFrameCommand = function(uid, dir) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return false;
        var info = this.sameFrameCommandMoveInfo(uid);
        if (!info.show) return false;
        dir = (String(dir || 'prev') === 'next') ? 'next' : 'prev';
        if (dir === 'prev' && !info.canPrev) return false;
        if (dir === 'next' && !info.canNext) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        var ordered = tr.commands.filter(function(ce) {
            return ce && Math.max(0, Math.floor(Number(ce.frame || 0))) === info.frame && Math.max(0, Math.floor(Number(ce.wait || 0))) <= 0;
        }).sort(compareEntriesByFrameWaitUid);
        var idx = -1;
        for (var i = 0; i < ordered.length; i++) {
            if (Number(ordered[i].uid || 0) === uid) { idx = i; break; }
        }
        if (idx < 0) return false;
        var target = (dir === 'prev') ? ordered[idx - 1] : ordered[idx + 1];
        var selfEntry = this.findEntryInSelectedTrack(uid);
        if (!selfEntry || !target) return false;
        this.pushSnap('reorderFrame');
        this.swapCommandUids(tr, selfEntry, target);
        tr.commands.sort(compareEntriesByFrameWaitUid);
        this.selUid = Number(selfEntry.uid || 0);
        this.selRouteListIndex = -1;
        this.frame = Math.max(0, Math.floor(Number(selfEntry.frame || info.frame || this.frame || 0)));
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        return true;
    };

    EE.prototype.hasTimelineNudgeTarget = function() {
        if (this.hasRangeSelection && this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            if (Array.isArray(rs.items) && rs.items.length > 0) return true;
        }
        return Number(this.selUid || 0) > 0;
    };

    EE.prototype.shiftCurrentRangeSelectionByFrames = function(delta) {
        if (!(this.hasRangeSelection && this.hasRangeSelection())) return;
        delta = Math.floor(Number(delta || 0));
        if (!delta) return;
        var rs = this.rangeSelection || {};
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        rs.frameStart = Math.max(0, fs + delta);
        rs.frameEnd = Math.max(rs.frameStart, fe + delta);
        var shiftPx = Number(this.pxPerFrame || 0) * delta;
        if (Math.abs(shiftPx) > 1e-7 && Array.isArray(rs.rects)) {
            var minX = Number(this.labelW || 0);
            for (var i = 0; i < rs.rects.length; i++) {
                var rc = rs.rects[i];
                if (!rc) continue;
                rc.x1 = Math.max(minX, Number(rc.x1 || 0) + shiftPx);
                rc.x2 = Math.max(minX, Number(rc.x2 || 0) + shiftPx);
            }
        }
        this.timelineDirty = true;
    };

    EE.prototype.nudgeRouteCmdItemsByFrames = function(routeItems, delta, fromRangeSelection) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        routeItems = this.normalizeRangeSelectionItems(routeItems || []).filter(function(it) {
            return it && String(it.kind || '') === 'routeCmd';
        });
        if (!routeItems.length) return false;
        var uid0 = Math.floor(Number(routeItems[0].uid || 0));
        if (uid0 <= 0) return false;
        for (var i = 1; i < routeItems.length; i++) {
            if (Math.floor(Number(routeItems[i].uid || 0)) !== uid0) return false;
        }
        var entry = this.findEntryInSelectedTrack(uid0);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return false;
        var preview = this.buildRangeMoveRoutePreview({
            kind: 'routeCmd',
            routeItems: routeItems,
            previewRouteUid: uid0
        }, delta);
        if (!preview || !preview.valid || !Array.isArray(preview.blocks)) return false;
        this.pushSnap('nudgeRoute');
        var route = entry.command.parameters && entry.command.parameters[1];
        if (!route || typeof route !== 'object') route = this.defaultMoveRoute();
        route.list = this.routeListFromBlocks(preview.blocks);
        if (!Array.isArray(entry.command.parameters)) entry.command.parameters = [entry.charId || 0, route];
        entry.command.parameters[1] = route;
        entry.wait = this.commandWaitFrames(entry.command);
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (tr && Array.isArray(tr.commands)) tr.commands.sort(compareEntriesByFrameWaitUid);
        if (fromRangeSelection && this.hasRangeSelection && this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            var kind = String(rs.kind || 'rect');
            if (kind !== 'memory' && kind !== 'rect') kind = 'rect';
            var nextSel = [];
            for (i = 0; i < preview.selectedListIndexes.length; i++) {
                nextSel.push({ kind: 'routeCmd', uid: uid0, routeListIndex: this.nodeRouteIndex(preview.selectedListIndexes[i]) });
            }
            this.setRangeSelection(kind, nextSel, {
                frameStart: Math.max(0, Math.floor(Number(rs.frameStart || 0))),
                frameEnd: Math.max(0, Math.floor(Number(rs.frameEnd || 0))),
                rects: Array.isArray(rs.rects) ? clone(rs.rects) : [],
                nonContiguous: !!rs.nonContiguous
            });
            this.shiftCurrentRangeSelectionByFrames(delta);
        } else {
            this.selUid = uid0;
            this.selRouteListIndex = preview.selectedListIndexes.length ? this.nodeRouteIndex(preview.selectedListIndexes[0]) : -1;
            var sit = this.routeCommandTimelineItemByListIndex(entry, this.selRouteListIndex);
            if (sit) {
                this.frame = Math.max(0, Math.floor(Number(entry.frame || 0)) + Math.max(0, Math.floor(Number(sit.offset || 0))));
            } else {
                this.frame = Math.max(0, Math.floor(Number(entry.frame || this.frame || 0)));
            }
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.nudgeEntriesByFrames = function(entryUids, delta, fromRangeSelection) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var seen = Object.create(null);
        var moved = [];
        entryUids = Array.isArray(entryUids) ? entryUids : [];
        for (var i = 0; i < entryUids.length; i++) {
            var uid = Math.floor(Number(entryUids[i] || 0));
            if (uid <= 0 || seen[uid]) continue;
            seen[uid] = true;
            var e = this.findEntryInSelectedTrack(uid);
            if (!e) continue;
            var nf = Math.floor(Number(e.frame || 0)) + delta;
            if (nf < 0) return false;
            var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            moved.push({ entry: e, frame: nf, rowKey: rk });
        }
        if (!moved.length) return false;
        if (!this.batchCanPlaceEntries(tr, moved)) return false;
        this.pushSnap('nudgeEntry');
        var selFrame = null;
        for (i = 0; i < moved.length; i++) {
            var it = moved[i];
            if (!it || !it.entry) continue;
            var de = it.entry;
            de.frame = Math.max(0, Math.floor(Number(it.frame || 0)));
            if (Number(de.uid || 0) === Number(this.selUid || 0)) selFrame = de.frame;
        }
        tr.commands.sort(compareEntriesByFrameWaitUid);
        if (fromRangeSelection && this.hasRangeSelection && this.hasRangeSelection()) {
            this.shiftCurrentRangeSelectionByFrames(delta);
        } else if (selFrame != null) {
            this.frame = Math.max(0, Math.floor(Number(selFrame || 0)));
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.nudgeSelectedTimelineByFrames = function(delta) {
        delta = Math.floor(Number(delta || 0));
        if (!delta) return false;
        if (!this.selKey || !this.model || !this.model.tracks) return false;
        var tr = this.model.tracks[this.selKey];
        if (!tr || !Array.isArray(tr.commands)) return false;
        var hasRange = !!(this.hasRangeSelection && this.hasRangeSelection());
        var routeItems = hasRange ? this.selectedRouteCmdItemsFromRange() : [];
        var entryUids = hasRange ? this.selectedEntryUidsFromRange() : [];
        if (!hasRange || (!routeItems.length && !entryUids.length)) {
            var uid = Math.floor(Number(this.selUid || 0));
            if (uid <= 0) return false;
            var rli = this.nodeRouteIndex(this.selRouteListIndex);
            if (rli >= 0) {
                routeItems = [{ kind: 'routeCmd', uid: uid, routeListIndex: rli }];
                entryUids = [];
            } else {
                routeItems = [];
                entryUids = [uid];
            }
            hasRange = false;
        }
        if (routeItems.length && !entryUids.length) {
            return this.nudgeRouteCmdItemsByFrames(routeItems, delta, hasRange);
        }
        return this.nudgeEntriesByFrames(entryUids, delta, hasRange);
    };

    EE.prototype.timelineClipboardCopyReasonText = function(reason) {
        reason = String(reason || '');
        if (reason === 'no_track') return 'イベント未選択です';
        if (reason === 'no_selection') return 'コマンドを選択してください';
        if (reason === 'no_entry_selection') return '選択範囲にコマンドがありません';
        if (reason === 'mixed_row_type') return 'メイン行とキャラ行の同時コピーはできません';
        if (reason === 'mixed_char_row') return '複数キャラ行の同時コピーはできません';
        return 'コピーできません';
    };

    EE.prototype.timelineClipboardPasteReasonText = function(reason) {
        reason = String(reason || '');
        if (reason === 'no_track') return 'イベント未選択です';
        if (reason === 'no_clipboard') return 'コピー済みコマンドがありません';
        if (reason === 'main_to_char_forbidden') return 'メイン→キャラへの貼り付けはできません';
        if (reason === 'char_to_main_forbidden') return 'キャラ→メインへの貼り付けはできません';
        if (reason === 'invalid_clipboard') return 'クリップボード形式が不正です';
        if (reason === 'invalid_entry') return '貼り付け対象のコマンド形式が不正です';
        if (reason === 'overlap') return '貼り付け先でコマンドが重なります';
        return '貼り付けできません';
    };

    EE.prototype.collectTimelineClipboardEntries = function() {
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return { ok: false, reason: 'no_track' };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return { ok: false, reason: 'no_track' };
        var uids = [];
        if (this.hasRangeSelection && this.hasRangeSelection()) {
            uids = this.selectedEntryUidsFromRange();
            if (!uids.length) return { ok: false, reason: 'no_entry_selection' };
        } else {
            var uid = Math.floor(Number(this.selUid || 0));
            if (uid <= 0) return { ok: false, reason: 'no_selection' };
            uids = [uid];
        }
        var uniq = Object.create(null);
        var out = [];
        for (var i = 0; i < uids.length; i++) {
            var u = Math.floor(Number(uids[i] || 0));
            if (u <= 0 || uniq[u]) continue;
            uniq[u] = true;
            var e = this.findEntryInSelectedTrack(u);
            if (!e || !e.command || Number(e.command.code || 0) <= 0) continue;
            out.push(e);
        }
        if (!out.length) return { ok: false, reason: 'no_selection' };
        out.sort(compareEntriesByFrameWaitUid);
        var first = out[0];
        var rowType = (first && first.rowType === 'char') ? 'char' : 'main';
        var rowKey = String(first.rowKey || (rowType === 'char' ? ('char:' + first.charId) : 'main'));
        if (rowType !== 'char') rowKey = 'main';
        for (i = 0; i < out.length; i++) {
            var re = out[i];
            var rt = (re && re.rowType === 'char') ? 'char' : 'main';
            if (rt !== rowType) return { ok: false, reason: 'mixed_row_type' };
            if (rowType === 'char') {
                var rk = String(re.rowKey || ('char:' + re.charId));
                if (rk !== rowKey) return { ok: false, reason: 'mixed_char_row' };
            }
        }
        return {
            ok: true,
            rowType: rowType,
            rowKey: rowKey,
            entries: out
        };
    };

    EE.prototype.buildTimelineClipboardFromSelection = function() {
        var picked = this.collectTimelineClipboardEntries();
        if (!picked.ok) return picked;
        var entries = picked.entries || [];
        var minFrame = Infinity;
        for (var i = 0; i < entries.length; i++) {
            var f = Math.max(0, Math.floor(Number(entries[i].frame || 0)));
            if (f < minFrame) minFrame = f;
        }
        if (!isFinite(minFrame)) minFrame = 0;
        var items = [];
        for (i = 0; i < entries.length; i++) {
            var e = entries[i];
            items.push({
                offsetFrame: Math.max(0, Math.floor(Number(e.frame || 0)) - minFrame),
                command: clone(e.command || { code: 0, indent: 0, parameters: [] })
            });
        }
        var uidList = [];
        for (i = 0; i < entries.length; i++) uidList.push(Math.floor(Number(entries[i].uid || 0)));
        return {
            ok: true,
            clip: {
                type: 'timeline_entries_v1',
                rowType: picked.rowType,
                rowKey: picked.rowKey,
                anchorFrame: minFrame,
                items: items
            },
            sourceUids: uidList
        };
    };

    EE.prototype.currentTimelineRowKeyForPaste = function() {
        var uid = Math.floor(Number(this.selUid || 0));
        if (uid > 0) {
            var e = this.findEntryInSelectedTrack(uid);
            if (e) {
                var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
                if (rk.indexOf('char:') === 0) {
                    return 'char:' + this.normalizeMoveTarget(Number(rk.replace('char:', '')));
                }
            }
        }
        if (this.panelSelectedCharId != null) {
            return 'char:' + this.normalizeMoveTarget(Number(this.panelSelectedCharId || 0));
        }
        return 'main';
    };

    EE.prototype.timelinePasteTargetFromContext = function(ctx) {
        var base = this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        var c = this.resolveWaitInsertContext(ctx || base);
        var frame = 0;
        if (String(c.source || '') === 'selection') frame = Math.max(0, Math.floor(Number(this.frame || 0)));
        else frame = Math.max(0, Math.floor(Number(c.frame || this.frame || 0)));
        var rowKey = String(c.rowKey || '');
        if (rowKey.indexOf('char:') !== 0) rowKey = '';
        if (!rowKey && Number(c.uid || 0) > 0) {
            var e = this.findEntryInSelectedTrack(Math.floor(Number(c.uid || 0)));
            if (e) rowKey = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
        }
        if (rowKey.indexOf('char:') === 0) {
            rowKey = 'char:' + this.normalizeMoveTarget(Number(rowKey.replace('char:', '')));
        } else {
            rowKey = this.currentTimelineRowKeyForPaste();
            if (rowKey.indexOf('char:') !== 0) rowKey = 'main';
        }
        return { frame: frame, rowKey: rowKey };
    };

    EE.prototype.prepareTimelineClipboardEntriesForPaste = function(clip, target) {
        clip = (clip && typeof clip === 'object') ? clip : null;
        target = target || { frame: this.frame, rowKey: 'main' };
        if (!clip || clip.type !== 'timeline_entries_v1' || !Array.isArray(clip.items) || !clip.items.length) {
            return { ok: false, reason: 'invalid_clipboard' };
        }
        var rowType = String(clip.rowType || 'main') === 'char' ? 'char' : 'main';
        var rowKey = String(target.rowKey || 'main');
        if (rowType === 'main' && rowKey !== 'main') return { ok: false, reason: 'main_to_char_forbidden' };
        if (rowType === 'char' && rowKey.indexOf('char:') !== 0) return { ok: false, reason: 'char_to_main_forbidden' };
        var frameBase = Math.max(0, Math.floor(Number(target.frame || 0)));
        var charId = 0;
        if (rowType === 'char') charId = this.normalizeMoveTarget(Number(rowKey.replace('char:', '')));
        var out = [];
        for (var i = 0; i < clip.items.length; i++) {
            var it = clip.items[i];
            if (!it || !it.command) return { ok: false, reason: 'invalid_entry' };
            var cmd = clone(it.command);
            if (rowType === 'char') {
                if (Number(cmd.code || 0) !== 205) return { ok: false, reason: 'invalid_entry' };
                if (!Array.isArray(cmd.parameters)) cmd.parameters = [charId, this.defaultMoveRoute()];
                cmd.parameters[0] = charId;
            }
            var ef = frameBase + Math.max(0, Math.floor(Number(it.offsetFrame || 0)));
            var e = this.entryFromCommand(cmd, this.selEid, this.selPage, ef, -(i + 1));
            if (!e) return { ok: false, reason: 'invalid_entry' };
            if (rowType === 'main') {
                e.rowType = 'main';
                e.rowKey = 'main';
                e.charId = null;
            } else {
                e.rowType = 'char';
                e.rowKey = 'char:' + charId;
                e.charId = charId;
                if (e.command && Number(e.command.code || 0) === 205) {
                    if (!Array.isArray(e.command.parameters)) e.command.parameters = [charId, this.defaultMoveRoute()];
                    e.command.parameters[0] = charId;
                    this.recalculateRouteTileGotoWaitMetaForEntry(e);
                    e.wait = this.commandWaitFrames(e.command);
                }
            }
            out.push(e);
        }
        out.sort(compareEntriesByFrameWaitUid);
        return { ok: true, entries: out };
    };

    EE.prototype.canPastePreparedTimelineEntries = function(tr, entries) {
        if (!tr || !Array.isArray(tr.commands)) return { ok: false, reason: 'no_track' };
        entries = Array.isArray(entries) ? entries : [];
        if (!entries.length) return { ok: false, reason: 'invalid_clipboard' };
        var temp = { commands: tr.commands.map(function(e) { return clone(e); }) };
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e) continue;
            if (!this.canPlaceEntry(temp, e, e.frame, e.rowKey, 0)) {
                return { ok: false, reason: 'overlap', conflictEntry: e, tempTrack: temp };
            }
            temp.commands.push(clone(e));
            temp.commands.sort(compareEntriesByFrameWaitUid);
        }
        return { ok: true };
    };

    EE.prototype.timelineClipboardPasteCapability = function(ctx) {
        if (!(this.selEid && this.selPage >= 0 && this.selKey)) return { enabled: false, reason: 'no_track' };
        var clip = this.timelineCommandClipboard;
        if (!clip) return { enabled: false, reason: 'no_clipboard' };
        var target = this.timelinePasteTargetFromContext(ctx);
        var prepared = this.prepareTimelineClipboardEntriesForPaste(clip, target);
        if (!prepared.ok) return { enabled: false, reason: prepared.reason, target: target };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        var check = this.canPastePreparedTimelineEntries(tr, prepared.entries);
        if (!check.ok) return { enabled: false, reason: check.reason, target: target, conflictEntry: check.conflictEntry, tempTrack: check.tempTrack };
        return { enabled: true, target: target, entries: prepared.entries };
    };

    EE.prototype.copy = function() {
        var pack = this.buildTimelineClipboardFromSelection();
        if (!pack.ok) {
            this.msg('Copy不可: ' + this.timelineClipboardCopyReasonText(pack.reason));
            return false;
        }
        this.timelineCommandClipboard = clone(pack.clip);
        this.clip = (pack.clip.items && pack.clip.items.length) ? clone(pack.clip.items[0].command) : null;
        this.msg('Copy ' + pack.sourceUids.length + '件');
        return true;
    };

    EE.prototype.deleteEntriesByUidList = function(uids, snapLabel) {
        if (!this.selKey) return 0;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return 0;
        uids = Array.isArray(uids) ? uids : [];
        var del = Object.create(null);
        var count = 0;
        for (var i = 0; i < uids.length; i++) {
            var uid = Math.floor(Number(uids[i] || 0));
            if (uid <= 0 || del[uid]) continue;
            del[uid] = true;
            count++;
        }
        if (!count) return 0;
        this.pushSnap(String(snapLabel || 'del'));
        tr.commands = tr.commands.filter(function(e) {
            return !del[Math.floor(Number((e && e.uid) || 0))];
        });
        tr.commands.sort(compareEntriesByFrameWaitUid);
        this.selUid = 0;
        this.selRouteListIndex = -1;
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        return count;
    };

    EE.prototype.cut = function() {
        var pack = this.buildTimelineClipboardFromSelection();
        if (!pack.ok) {
            this.msg('Cut不可: ' + this.timelineClipboardCopyReasonText(pack.reason));
            return false;
        }
        this.timelineCommandClipboard = clone(pack.clip);
        this.clip = (pack.clip.items && pack.clip.items.length) ? clone(pack.clip.items[0].command) : null;
        var removed = this.deleteEntriesByUidList(pack.sourceUids, 'cut');
        if (removed <= 0) return false;
        this.msg('Cut ' + removed + '件');
        return true;
    };

    EE.prototype.paste = function() {
        var baseCtx = this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        var cap = this.timelineClipboardPasteCapability(baseCtx);
        if (!cap.enabled) {
            if (String(cap.reason || '') === 'overlap' && cap.conflictEntry) {
                try { this.logDropConflictDetail(cap.tempTrack || (this.model && this.model.tracks ? this.model.tracks[this.selKey] : null), cap.conflictEntry, cap.conflictEntry.frame, cap.conflictEntry.rowKey, 0, 'paste'); } catch (_) {}
            }
            this.msg('Paste不可: ' + this.timelineClipboardPasteReasonText(cap.reason));
            return false;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        this.pushSnap('paste');
        var entries = cap.entries || [];
        var first = null;
        for (var i = 0; i < entries.length; i++) {
            var e = clone(entries[i]);
            e.uid = this.model.nextUid++;
            if (!first) first = e;
            tr.commands.push(e);
            if (e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        }
        tr.commands.sort(compareEntriesByFrameWaitUid);
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        if (first) {
            this.selUid = Number(first.uid || 0);
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(first.frame || this.frame || 0)));
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.msg('Paste ' + entries.length + '件');
        return true;
    };

    EE.prototype.copyFromContextMenu = function() {
        this.closeRouteRangeContextMenu();
        return this.copy();
    };

    EE.prototype.cutFromContextMenu = function() {
        this.closeRouteRangeContextMenu();
        return this.cut();
    };

    EE.prototype.pasteFromContextMenu = function() {
        var ctx = this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame, this.currentTimelineRowKeyForPaste());
        this.closeRouteRangeContextMenu();
        var cap = this.timelineClipboardPasteCapability(ctx);
        if (!cap.enabled) {
            if (String(cap.reason || '') === 'overlap' && cap.conflictEntry) {
                try { this.logDropConflictDetail(cap.tempTrack || (this.model && this.model.tracks ? this.model.tracks[this.selKey] : null), cap.conflictEntry, cap.conflictEntry.frame, cap.conflictEntry.rowKey, 0, 'paste_ctx'); } catch (_) {}
            }
            this.msg('Paste不可: ' + this.timelineClipboardPasteReasonText(cap.reason));
            return false;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        this.pushSnap('paste');
        var entries = cap.entries || [];
        var first = null;
        for (var i = 0; i < entries.length; i++) {
            var e = clone(entries[i]);
            e.uid = this.model.nextUid++;
            if (!first) first = e;
            tr.commands.push(e);
            if (e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        }
        tr.commands.sort(compareEntriesByFrameWaitUid);
        if (this.hasRangeSelection && this.hasRangeSelection()) this.clearRangeSelection();
        if (first) {
            this.selUid = Number(first.uid || 0);
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(first.frame || this.frame || 0)));
        }
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.msg('Paste ' + entries.length + '件');
        return true;
    };

    EE.prototype.findRouteRangeEntryByUid = function(uid) {
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return null;
        if (e.rowType !== 'char') return null;
        return e;
    };

    EE.prototype.refreshRouteRangeContextMenu = function() {
        if (!this.routeCtx || !this.routeCtx.classList.contains('on')) return;
        var mode = String(this.routeCtxMode || 'route');
        var isRouteMode = (mode === 'route');
        var isTimelineMode = (mode === 'timeline');
        var isSelectionMode = (mode === 'selection');
        var canShowAdd = isRouteMode || isTimelineMode;
        var addCtx = this.resolveWaitInsertContext(this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        var addSource = String(addCtx.source || 'frame');
        var showFrameAdd = canShowAdd && addSource === 'frame';
        var showRelativeAdd = canShowAdd && (addSource === 'command' || addSource === 'routeCmd');
        var hasTrack = !!(this.selEid && this.selPage >= 0 && this.selKey);
        if (this.routeCtxAddBtn) {
            this.routeCtxAddBtn.style.display = showFrameAdd ? '' : 'none';
            var addFrame = Math.max(0, Math.floor(Number(addCtx.frame || 0)));
            var addLocked = showFrameAdd && this.isFrameLockedForFrameCommandAdd(addFrame);
            this.routeCtxAddBtn.disabled = !hasTrack || addLocked;
            this.routeCtxAddBtn.textContent = hasTrack
                ? (addLocked ? 'コマンド追加 (不可)' : 'コマンド追加')
                : 'イベント未選択';
        }
        if (this.routeCtxAddBeforeBtn) {
            this.routeCtxAddBeforeBtn.style.display = showRelativeAdd ? '' : 'none';
            this.routeCtxAddBeforeBtn.disabled = !hasTrack;
            this.routeCtxAddBeforeBtn.textContent = hasTrack ? '直前にコマンド追加' : 'イベント未選択';
        }
        if (this.routeCtxAddAfterBtn) {
            this.routeCtxAddAfterBtn.style.display = showRelativeAdd ? '' : 'none';
            this.routeCtxAddAfterBtn.disabled = !hasTrack;
            this.routeCtxAddAfterBtn.textContent = hasTrack ? '直後にコマンド追加' : 'イベント未選択';
        }
        if (this.routeCtxMemoBtn) {
            this.routeCtxMemoBtn.style.display = '';
            this.routeCtxMemoBtn.disabled = !hasTrack;
            this.routeCtxMemoBtn.textContent = hasTrack ? 'メモ作成' : 'メモ作成 (不可)';
        }
        var copyProbe = this.collectTimelineClipboardEntries();
        var canCopy = !!copyProbe.ok;
        var pasteProbe = this.timelineClipboardPasteCapability(addCtx);
        var canPaste = !!pasteProbe.enabled;
        if (this.routeCtxCopyBtn) {
            this.routeCtxCopyBtn.style.display = '';
            this.routeCtxCopyBtn.disabled = !canCopy;
            this.routeCtxCopyBtn.textContent = canCopy ? 'コピー' : 'コピー (不可)';
        }
        if (this.routeCtxCutBtn) {
            this.routeCtxCutBtn.style.display = '';
            this.routeCtxCutBtn.disabled = !canCopy;
            this.routeCtxCutBtn.textContent = canCopy ? '切り取り' : '切り取り (不可)';
        }
        if (this.routeCtxPasteBtn) {
            this.routeCtxPasteBtn.style.display = '';
            this.routeCtxPasteBtn.disabled = !canPaste;
            this.routeCtxPasteBtn.textContent = canPaste ? '貼り付け' : '貼り付け (不可)';
        }
        if (this.routeCtxSkippableBtn) this.routeCtxSkippableBtn.style.display = isRouteMode ? '' : 'none';
        if (this.routeCtxRepeatBtn) this.routeCtxRepeatBtn.style.display = isRouteMode ? '' : 'none';
        if (this.routeCtxWaitBtn) this.routeCtxWaitBtn.style.display = isRouteMode ? '' : 'none';
        if (isRouteMode) {
            var e = this.findRouteRangeEntryByUid(this.routeRangeCtxUid);
            if (!e) {
                this.closeRouteRangeContextMenu();
                return;
            }
            var route = e.command.parameters && e.command.parameters[1];
            if (!route || typeof route !== 'object') route = {};
            if (this.routeCtxSkippableBtn) {
                this.routeCtxSkippableBtn.textContent = '移動できない場合は飛ばす: ' + (route.skippable ? 'ON' : 'OFF');
            }
            if (this.routeCtxRepeatBtn) {
                this.routeCtxRepeatBtn.textContent = '動作を繰り返す: ' + (route.repeat ? 'ON' : 'OFF');
            }
            if (this.routeCtxWaitBtn) {
                this.routeCtxWaitBtn.textContent = '完了までウェイト: ' + (route.wait ? 'ON' : 'OFF');
            }
        }
        if (this.routeCtxInsertWaitBtn) {
            this.routeCtxInsertWaitBtn.style.display = '';
            this.routeCtxInsertWaitBtn.disabled = !hasTrack;
            this.routeCtxInsertWaitBtn.textContent = hasTrack ? 'ウェイトの挿入...' : 'イベント未選択';
        }
        if (this.routeCtxSqueezeBtn) {
            this.routeCtxSqueezeBtn.style.display = isTimelineMode ? 'none' : '';
            if (!isTimelineMode) {
                var sq = this.selectionSqueezeCapability();
                this.routeCtxSqueezeEnabled = !!sq.enabled;
                this.routeCtxSqueezeBtn.disabled = !sq.enabled;
                this.routeCtxSqueezeBtn.textContent = sq.enabled ? '詰める' : '詰める (不可)';
            }
        }
        if (this.routeCtxMergeBtn) {
            this.routeCtxMergeBtn.style.display = isSelectionMode ? '' : 'none';
            if (isSelectionMode) {
                var mc = this.selectionRouteMergeCapability();
                this.routeCtxMergeEnabled = !!mc.enabled;
                this.routeCtxMergeBtn.disabled = !mc.enabled;
                this.routeCtxMergeBtn.textContent = mc.enabled ? '移動ルートの結合' : '移動ルートの結合 (不可)';
            } else {
                this.routeCtxMergeEnabled = false;
            }
        }
        var rx = Number(this.routeCtx.style && this.routeCtx.style.left != null ? parseFloat(this.routeCtx.style.left) : 0);
        var ry = Number(this.routeCtx.style && this.routeCtx.style.top != null ? parseFloat(this.routeCtx.style.top) : 0);
        if (!isFinite(rx)) rx = 4;
        if (!isFinite(ry)) ry = 4;
        this.placeMenuInViewport(this.routeCtx, rx, ry, 4);
    };

    EE.prototype.waitInsertDefaultFramesFromSelection = function() {
        if (!this.hasRangeSelection()) return 60;
        var rs = this.rangeSelection || {};
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        var n = Math.max(1, fe - fs + 1);
        return n;
    };

    EE.prototype.makeWaitInsertContextFromFrame = function(frame, rowKey) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        rowKey = String(rowKey || 'main');
        if (rowKey.indexOf('char:') !== 0) rowKey = 'main';
        return {
            source: 'frame',
            frame: frame,
            rowKey: rowKey,
            defaultFrames: 60
        };
    };

    EE.prototype.makeWaitInsertContextFromSelection = function() {
        if (!this.hasRangeSelection()) return this.makeWaitInsertContextFromFrame(this.frame);
        var rs = this.rangeSelection || {};
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        return {
            source: 'selection',
            frameStart: fs,
            frameEnd: fe,
            defaultFrames: this.waitInsertDefaultFramesFromSelection()
        };
    };

    EE.prototype.makeWaitInsertContextFromCommand = function(uid, fallbackFrame) {
        uid = Math.floor(Number(uid || 0));
        var e = this.findEntryInSelectedTrack(uid);
        var frame = (e ? e.frame : fallbackFrame);
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        return {
            source: 'command',
            uid: uid,
            frame: frame,
            includeSameFrameOnAfter: true,
            defaultFrames: 60
        };
    };

    EE.prototype.makeWaitInsertContextFromRouteCommand = function(uid, routeListIndex, fallbackFrame) {
        uid = Math.floor(Number(uid || 0));
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        var e = this.findEntryInSelectedTrack(uid);
        var frame = Math.max(0, Math.floor(Number(fallbackFrame || 0)));
        if (e && e.command && Number(e.command.code || 0) === 205) {
            frame = Math.max(0, Math.floor(Number(e.frame || 0)));
            var route = e.command.parameters && e.command.parameters[1];
            var tl = this.moveRouteTimeline(route);
            var items = tl && Array.isArray(tl.items) ? tl.items : [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it) continue;
                if (this.nodeRouteIndex(it.listIndex) !== routeListIndex) continue;
                frame = Math.max(0, Math.floor(Number(e.frame || 0)) + Math.max(0, Math.floor(Number(it.offset || 0))));
                break;
            }
        }
        return {
            source: 'routeCmd',
            uid: uid,
            routeListIndex: routeListIndex,
            frame: frame,
            defaultFrames: 60
        };
    };

    EE.prototype.resolveWaitInsertContext = function(ctx) {
        var c = (ctx && typeof ctx === 'object') ? clone(ctx) : {};
        var source = String(c.source || 'frame');
        if (source !== 'selection' && source !== 'command' && source !== 'routeCmd' && source !== 'frame') source = 'frame';
        c.source = source;
        if (source === 'selection') {
            var fs = Math.max(0, Math.floor(Number(c.frameStart || 0)));
            var fe = Math.max(fs, Math.floor(Number(c.frameEnd == null ? fs : c.frameEnd)));
            c.frameStart = fs;
            c.frameEnd = fe;
            c.defaultFrames = Math.max(1, Math.floor(Number(c.defaultFrames || (fe - fs + 1) || 60)));
        } else {
            c.frame = Math.max(0, Math.floor(Number(c.frame || this.frame || 0)));
            c.rowKey = String(c.rowKey || 'main');
            if (c.rowKey.indexOf('char:') !== 0) c.rowKey = 'main';
            c.defaultFrames = Math.max(1, Math.floor(Number(c.defaultFrames || 60)));
            c.uid = Math.floor(Number(c.uid || 0));
            c.routeListIndex = this.nodeRouteIndex(c.routeListIndex);
            c.includeSameFrameOnAfter = !!c.includeSameFrameOnAfter;
        }
        return c;
    };

    EE.prototype.waitInsertContextInfoText = function(ctx) {
        ctx = this.resolveWaitInsertContext(ctx);
        if (ctx.source === 'selection') {
            var len = Math.max(1, Math.floor(Number(ctx.frameEnd - ctx.frameStart + 1)));
            return '範囲: ' + ctx.frameStart + 'f - ' + ctx.frameEnd + 'f (' + len + 'f)';
        }
        if (ctx.source === 'command') {
            var nm = '';
            var e = this.findEntryInSelectedTrack(ctx.uid);
            if (e && e.command) nm = this.commandNameJa(this.mainCommandDisplayCodeForEntry(e));
            var suffix = nm ? (' [' + nm + ']') : '';
            return '基準コマンド: frame ' + ctx.frame + 'f' + suffix;
        }
        if (ctx.source === 'routeCmd') {
            var re = this.findEntryInSelectedTrack(ctx.uid);
            var head = re ? this.executionEventLabelForEntry(re) : '';
            var routeName = '';
            if (re && re.command && Number(re.command.code || 0) === 205) {
                var route = re.command.parameters && re.command.parameters[1];
                var tl = this.moveRouteTimeline(route);
                var items = tl && Array.isArray(tl.items) ? tl.items : [];
                for (var i = 0; i < items.length; i++) {
                    var it = items[i];
                    if (!it) continue;
                    if (this.nodeRouteIndex(it.listIndex) !== this.nodeRouteIndex(ctx.routeListIndex)) continue;
                    var dcode = Number((it.displayCode != null) ? it.displayCode : (it.command ? it.command.code : 0));
                    routeName = (dcode === 4500) ? 'タイル移動' : this.routeCommandNameJa(dcode);
                    break;
                }
            }
            var label = routeName ? (head + routeName) : (head + '移動ルート');
            return '基準: ' + label + ' @ ' + ctx.frame + 'f';
        }
        return '基準フレーム: ' + ctx.frame + 'f';
    };

    EE.prototype.makeAddPlacementContextFromFrame = function(frame) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        return {
            mode: 'frame',
            source: 'frame',
            frame: frame,
            uid: 0,
            routeListIndex: -1
        };
    };

    EE.prototype.makeAddPlacementContextFromWaitInsertContext = function(ctx, mode) {
        ctx = this.resolveWaitInsertContext(ctx || this.makeWaitInsertContextFromFrame(this.frame));
        mode = String(mode || 'frame');
        if (mode !== 'before' && mode !== 'after' && mode !== 'frame') mode = 'frame';
        return {
            mode: mode,
            source: String(ctx.source || 'frame'),
            frame: Math.max(0, Math.floor(Number(ctx.frame || 0))),
            uid: Math.floor(Number(ctx.uid || 0)),
            routeListIndex: this.nodeRouteIndex(ctx.routeListIndex)
        };
    };

    EE.prototype.resolveAddPlacementContext = function(ctx, fallbackFrame) {
        var c = (ctx && typeof ctx === 'object') ? clone(ctx) : {};
        var mode = String(c.mode || 'frame');
        if (mode !== 'before' && mode !== 'after' && mode !== 'frame') mode = 'frame';
        var source = String(c.source || 'frame');
        if (source !== 'command' && source !== 'routeCmd' && source !== 'frame') source = 'frame';
        var frame = Math.max(0, Math.floor(Number(c.frame == null ? fallbackFrame : c.frame)));
        if (!isFinite(frame)) frame = Math.max(0, Math.floor(Number(fallbackFrame || 0)));
        return {
            mode: mode,
            source: source,
            frame: frame,
            uid: Math.floor(Number(c.uid || 0)),
            routeListIndex: this.nodeRouteIndex(c.routeListIndex)
        };
    };

    EE.prototype.resolveAddAnchorFromPlacementContext = function(ctx) {
        ctx = this.resolveAddPlacementContext(ctx, this.frame);
        var out = {
            source: ctx.source,
            frame: Math.max(0, Math.floor(Number(ctx.frame || 0))),
            span: 0
        };
        if (ctx.source === 'command') {
            var e = this.findEntryInSelectedTrack(ctx.uid);
            if (e) {
                out.frame = Math.max(0, Math.floor(Number(e.frame || 0)));
                out.span = Math.max(0, Math.floor(Number(e.wait || 0)));
            }
        } else if (ctx.source === 'routeCmd') {
            var re = this.findEntryInSelectedTrack(ctx.uid);
            if (re && re.command && Number(re.command.code || 0) === 205) {
                out.frame = Math.max(0, Math.floor(Number(re.frame || 0)));
                var route = re.command.parameters && re.command.parameters[1];
                var tl = this.moveRouteTimeline(route);
                var items = tl && Array.isArray(tl.items) ? tl.items : [];
                for (var i = 0; i < items.length; i++) {
                    var it = items[i];
                    if (!it) continue;
                    if (this.nodeRouteIndex(it.listIndex) !== this.nodeRouteIndex(ctx.routeListIndex)) continue;
                    out.frame = Math.max(0, Math.floor(Number(re.frame || 0)) + Math.max(0, Math.floor(Number(it.offset || 0))));
                    out.span = Math.max(0, Math.floor(Number(it.span || 0)));
                    break;
                }
            }
        }
        return out;
    };

    EE.prototype.computeAddFrameFromPlacementContext = function(ctx, newWait) {
        ctx = this.resolveAddPlacementContext(ctx, this.frame);
        newWait = Math.max(0, Math.floor(Number(newWait || 0)));
        var anc = this.resolveAddAnchorFromPlacementContext(ctx);
        if (ctx.mode === 'before') return Math.max(0, Math.floor(Number(anc.frame || 0)));
        if (ctx.mode === 'after') {
            var base = Math.max(0, Math.floor(Number(anc.frame || 0)));
            var span = Math.max(0, Math.floor(Number(anc.span || 0)));
            if (span > 0) return base + span;
            return base;
        }
        return Math.max(0, Math.floor(Number(anc.frame || 0)));
    };

    EE.prototype.isFrameLockedForFrameCommandAdd = function(frame) {
        if (!this.needSelTrack()) return true;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return true;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            if (w <= 0) continue;
            var isMain = (String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main')) === 'main');
            var isRouteWait = this.isMoveRouteWaitEnabledEntry(e);
            if (!isMain && !isRouteWait) continue;
            var ed = s + w;
            if (frame > s && frame < ed) return true;
        }
        return false;
    };

    EE.prototype.waitInsertStartFrameForContext = function(ctx, pos) {
        ctx = this.resolveWaitInsertContext(ctx);
        pos = String(pos || 'before') === 'after' ? 'after' : 'before';
        if (ctx.source === 'selection') {
            return (pos === 'before') ? ctx.frameStart : (ctx.frameEnd + 1);
        }
        if (ctx.source === 'routeCmd') {
            return ctx.frame;
        }
        if (ctx.source === 'command') {
            // Command-context insertion treats the whole frame as one block so
            // sibling commands on the same frame move together.
            if (pos === 'after' && !ctx.includeSameFrameOnAfter) return Math.max(0, ctx.frame + 1);
            return ctx.frame;
        }
        return (pos === 'before') ? ctx.frame : Math.max(0, ctx.frame + 1);
    };

    EE.prototype.shiftRangeSelectionAfterWaitInsert = function(startFrame, frames) {
        if (!this.hasRangeSelection()) return;
        var rs = this.rangeSelection || null;
        if (!rs) return;
        startFrame = Math.max(0, Math.floor(Number(startFrame || 0)));
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
        if (fe < startFrame) return;
        if (fs >= startFrame) {
            rs.frameStart = fs + frames;
            rs.frameEnd = fe + frames;
        } else {
            rs.frameStart = fs;
            rs.frameEnd = fe + frames;
        }
        var shiftPx = frames * Number(this.pxPerFrame || 0);
        if (shiftPx > 0 && Array.isArray(rs.rects) && rs.rects.length) {
            var sx = this.frameToX(startFrame);
            for (var i = 0; i < rs.rects.length; i++) {
                var rc = rs.rects[i];
                if (!rc) continue;
                if (Number(rc.x1 || 0) >= sx) rc.x1 += shiftPx;
                if (Number(rc.x2 || 0) >= sx) rc.x2 += shiftPx;
            }
        }
    };

    EE.prototype.applyWaitFrameInsertion = function(startFrame, frames) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        startFrame = Math.max(0, Math.floor(Number(startFrame || 0)));
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        this.pushSnap('waitGap');
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var old = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (old >= startFrame) e.frame = old + frames;
        }
        if (Math.max(0, Math.floor(Number(this.frame || 0))) >= startFrame) {
            this.frame = Math.max(0, Math.floor(Number(this.frame || 0))) + frames;
        }
        this.shiftRangeSelectionAfterWaitInsert(startFrame, frames);
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.routeCommandTimelineItemByListIndex = function(entry, routeListIndex) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return null;
        routeListIndex = this.nodeRouteIndex(routeListIndex);
        if (routeListIndex < 0) return null;
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var items = tl && Array.isArray(tl.items) ? tl.items : [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it) continue;
            if (this.nodeRouteIndex(it.listIndex) === routeListIndex) return it;
        }
        return null;
    };

    EE.prototype.shiftFollowingCommandsAllRows = function(tr, startFrame, frames, ignoreUid) {
        if (!tr || !Array.isArray(tr.commands)) return;
        startFrame = Math.max(0, Math.floor(Number(startFrame || 0)));
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        ignoreUid = Math.floor(Number(ignoreUid || 0));
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (ignoreUid > 0 && Math.floor(Number(e.uid || 0)) === ignoreUid) continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f >= startFrame) e.frame = f + frames;
        }
    };

    EE.prototype.applyRouteCommandWaitInsertion = function(ctx, pos, frames) {
        if (!this.needSelTrack()) return false;
        var tr = this.ensureTrack(this.selEid, this.selPage);
        if (!tr || !Array.isArray(tr.commands)) return false;
        ctx = this.resolveWaitInsertContext(ctx);
        if (String(ctx.source || '') !== 'routeCmd') return false;
        frames = Math.max(1, Math.floor(Number(frames || 1)));
        pos = (String(pos || 'before') === 'after') ? 'after' : 'before';
        var entry = this.findEntryInSelectedTrack(ctx.uid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return false;
        var it = this.routeCommandTimelineItemByListIndex(entry, ctx.routeListIndex);
        if (!it) {
            var fallback = this.routeTimelineItemAtFrame(entry, ctx.frame);
            if (fallback && this.nodeRouteIndex(fallback.listIndex) >= 0) {
                ctx.routeListIndex = this.nodeRouteIndex(fallback.listIndex);
                it = this.routeCommandTimelineItemByListIndex(entry, ctx.routeListIndex);
            }
            if (!it) return false;
        }
        this.pushSnap('waitGapRouteCmd');
        var oldCmd = clone(entry.command);
        var oldWait = Math.max(1, Math.floor(Number(entry.wait || 1)));
        var insertOffset = Math.max(0, Math.floor(Number(it.offset || 0)));
        if (pos === 'after') insertOffset += Math.max(1, Math.floor(Number(it.span || 1)));
        var insFrame = Math.max(0, Math.floor(Number(entry.frame || 0)) + insertOffset);
        var insertedIdx = this.insertRouteCommandIntoEntry(entry, { code: 15, parameters: [frames] }, insFrame);
        if (insertedIdx < 0) {
            entry.command = oldCmd;
            entry.wait = oldWait;
            return false;
        }
        entry.wait = this.commandWaitFrames(entry.command);
        var newWait = Math.max(1, Math.floor(Number(entry.wait || 1)));
        var delta = Math.max(0, newWait - oldWait);
        var route = this.routeOptionsFromEntry(entry);
        var routeWaitOn = !!(route && route.wait);
        var shifted = [];
        if (routeWaitOn && delta > 0) {
            var startSlide = Math.max(0, Math.floor(Number(entry.frame || 0)) + oldWait);
            for (var si = 0; si < tr.commands.length; si++) {
                var se = tr.commands[si];
                if (!se) continue;
                if (Number(se.uid || 0) === Number(entry.uid || 0)) continue;
                var sf = Math.max(0, Math.floor(Number(se.frame || 0)));
                if (sf >= startSlide) {
                    shifted.push({ e: se, old: sf });
                    se.frame = sf + delta;
                }
            }
            if (Math.max(0, Math.floor(Number(this.frame || 0))) >= startSlide) this.frame += delta;
            this.shiftRangeSelectionAfterWaitInsert(startSlide, delta);
        }
        if (!this.canPlaceEntry(tr, entry, entry.frame, entry.rowKey, entry.uid)) {
            for (var ri = 0; ri < shifted.length; ri++) shifted[ri].e.frame = shifted[ri].old;
            entry.command = oldCmd;
            entry.wait = oldWait;
            return false;
        }
        var selRouteIdx = this.nodeRouteIndex(ctx.routeListIndex);
        if (selRouteIdx >= 0 && pos === 'before') selRouteIdx += 1;
        if (selRouteIdx >= 0 && !this.routeCommandTimelineItemByListIndex(entry, selRouteIdx)) {
            var alt = this.nodeRouteIndex(ctx.routeListIndex);
            selRouteIdx = this.routeCommandTimelineItemByListIndex(entry, alt) ? alt : -1;
        }
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.selUid = Number(entry.uid || 0);
        this.selRouteListIndex = selRouteIdx;
        this.frame = Math.max(0, Math.floor(Number(insFrame || this.frame || 0)));
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.openWaitInsertDialog = function(ctx) {
        if (!this.waitInsertModal || !this.waitInsertFrameInput || !this.waitInsertPosBefore || !this.waitInsertPosAfter) return;
        this.waitInsertDialogContext = this.resolveWaitInsertContext(ctx || this.makeWaitInsertContextFromFrame(this.frame));
        var def = Math.max(1, Math.floor(Number(this.waitInsertDialogContext.defaultFrames || 60)));
        this.waitInsertPosBefore.checked = true;
        this.waitInsertPosAfter.checked = false;
        this.waitInsertFrameInput.value = String(def);
        if (this.waitInsertInfo) this.waitInsertInfo.textContent = this.waitInsertContextInfoText(this.waitInsertDialogContext);
        this.waitInsertModal.classList.add('on');
        this.waitInsertFrameInput.focus();
        this.waitInsertFrameInput.select();
    };

    EE.prototype.closeWaitInsertDialog = function() {
        this.waitInsertDialogContext = null;
        if (this.waitInsertModal) this.waitInsertModal.classList.remove('on');
    };

    EE.prototype.submitWaitInsertDialog = function() {
        if (!this.waitInsertDialogContext) return;
        var frames = Math.max(1, Math.floor(Number(this.waitInsertFrameInput && this.waitInsertFrameInput.value || 0) || 1));
        var pos = (this.waitInsertPosAfter && this.waitInsertPosAfter.checked) ? 'after' : 'before';
        var ctx = this.waitInsertDialogContext;
        var ok = false;
        if (String(ctx && ctx.source || '') === 'routeCmd') {
            ok = this.applyRouteCommandWaitInsertion(ctx, pos, frames);
            if (ok) {
                this.closeWaitInsertDialog();
                this.msg('移動ルート内ウェイト挿入: ' + frames + 'f');
                return;
            }
        } else {
            var startFrame = this.waitInsertStartFrameForContext(ctx, pos);
            ok = this.applyWaitFrameInsertion(startFrame, frames);
            if (ok) {
                this.closeWaitInsertDialog();
                this.msg('ウェイト挿入: ' + startFrame + 'f から ' + frames + 'f');
                return;
            }
        }
        this.msg('ウェイト挿入失敗');
    };

    EE.prototype.openWaitInsertDialogFromContextMenu = function() {
        var ctx = this.routeCtxWaitInsertContext || this.makeWaitInsertContextFromFrame(this.frame);
        if (ctx && this.hasRangeSelection()) {
            ctx = clone(ctx);
            ctx.defaultFrames = this.waitInsertDefaultFramesFromSelection();
        }
        this.closeRouteRangeContextMenu();
        this.openWaitInsertDialog(ctx);
    };

    EE.prototype.openRouteRangeContextMenu = function(uid, screenX, screenY, waitInsertContext) {
        if (!this.routeCtx) return;
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return;
        this.routeCtxMode = 'route';
        this.routeRangeCtxUid = uid;
        this.routeCtxWaitInsertContext = this.resolveWaitInsertContext(waitInsertContext || this.makeWaitInsertContextFromCommand(uid, this.frame));
        this.routeCtx.classList.add('on');
        this.placeMenuInViewport(this.routeCtx, screenX, screenY, 4);
        this.refreshRouteRangeContextMenu();
    };

    EE.prototype.openSelectionContextMenu = function(screenX, screenY, waitInsertContext) {
        if (!this.routeCtx) return;
        this.routeCtxMode = 'selection';
        this.routeRangeCtxUid = 0;
        this.routeCtxWaitInsertContext = this.resolveWaitInsertContext(waitInsertContext || this.makeWaitInsertContextFromSelection());
        this.routeCtx.classList.add('on');
        this.placeMenuInViewport(this.routeCtx, screenX, screenY, 4);
        this.refreshRouteRangeContextMenu();
    };

    EE.prototype.openTimelineContextMenu = function(screenX, screenY, waitInsertContext) {
        if (!this.routeCtx) return;
        this.routeCtxMode = 'timeline';
        this.routeRangeCtxUid = 0;
        this.routeCtxWaitInsertContext = this.resolveWaitInsertContext(waitInsertContext || this.makeWaitInsertContextFromFrame(this.frame));
        this.routeCtx.classList.add('on');
        this.placeMenuInViewport(this.routeCtx, screenX, screenY, 4);
        this.refreshRouteRangeContextMenu();
    };

    EE.prototype.toggleRouteRangeOption = function(key) {
        if (key !== 'repeat' && key !== 'skippable' && key !== 'wait') return;
        var e = this.findRouteRangeEntryByUid(this.routeRangeCtxUid);
        if (!e) return;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr) return;
        var route = e.command.parameters && e.command.parameters[1];
        if (!route || typeof route !== 'object') return;
        var next = !route[key];
        if (key === 'wait' && next) {
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var ed = s + Math.max(0, Math.floor(Number(e.wait || 0)));
            if (this.hasMainCommandInRange(tr, s, ed, 0)) {
                this.err('E_ROUTE_WAIT_MAIN_CONFLICT', new Error('main command exists in route wait range'));
                this.msg('完了までウェイトON不可: main範囲内にコマンドがあります');
                return;
            }
        }
        if (key === 'wait') {
            var probeCmd = clone(e.command || { code: 205, parameters: [0, this.defaultMoveRoute()] });
            if (!Array.isArray(probeCmd.parameters)) probeCmd.parameters = [0, this.defaultMoveRoute()];
            var probeRoute = probeCmd.parameters[1];
            if (!probeRoute || typeof probeRoute !== 'object') probeRoute = this.defaultMoveRoute();
            probeCmd.parameters[1] = probeRoute;
            probeRoute.wait = next;
            var probe = clone(e);
            probe.command = probeCmd;
            probe.wait = this.commandWaitFrames(probeCmd);
            if (!this.canPlaceEntry(tr, probe, probe.frame, probe.rowKey, probe.uid)) {
                this.msg('完了までウェイト変更不可: 移動ルートが重なります');
                return;
            }
        }
        this.pushSnap('routeOption');
        route[key] = next;
        e.wait = this.commandWaitFrames(e.command);
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        var label = (key === 'repeat')
            ? '動作を繰り返す'
            : (key === 'skippable' ? '移動できない場合は飛ばす' : '完了までウェイト');
        this.msg(label + ': ' + (route[key] ? 'ON' : 'OFF'));
    };

    EE.prototype.openCharContextMenu = function(charId, screenX, screenY) {
        if (!this.charCtx || !this.charCtxCmdAddBtn || !this.charCtxTileMoveBtn || !this.charCtxTeleportBtn) return;
        this.closeCameraContextMenu();
        this.charCtxTargetId = this.normalizeMoveTarget(charId);
        var hasTrack = !!(this.selEid && this.selPage >= 0 && this.selKey);
        this.charCtxCmdAddBtn.disabled = !hasTrack;
        this.charCtxCmdAddBtn.textContent = hasTrack ? 'コマンド追加' : 'イベント未選択';
        this.charCtxTileMoveBtn.disabled = !hasTrack;
        this.charCtxTileMoveBtn.textContent = hasTrack ? 'タイル移動' : 'イベント未選択';
        this.charCtxTeleportBtn.disabled = !hasTrack;
        this.charCtxTeleportBtn.textContent = hasTrack ? '瞬間移動' : 'イベント未選択';
        this.charCtx.classList.add('on');
        this.placeMenuInViewport(this.charCtx, screenX, screenY, 4);
    };

    EE.prototype.openContextCharacterRouteCommandPanel = function() {
        var id = this.charCtxTargetId;
        this.closeCharContextMenu();
        if (id == null) return;
        var cid = this.normalizeMoveTarget(id);
        if (!this.needSelTrack()) return;
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = cid;
        this.cleanupTemporaryCharRows(cid);
        this.refreshCharacterPanel(true);
        this.timelineDirty = true;
        this.openRouteCommandPanel(this.frame, 'char:' + cid);
    };

    EE.prototype.beginTileMoveForContextCharacter = function() {
        var id = this.charCtxTargetId;
        this.closeCharContextMenu();
        if (id == null) return;
        this.beginTileMoveForCharacter(id, 'route');
    };

    EE.prototype.beginTeleportForContextCharacter = function() {
        var id = this.charCtxTargetId;
        this.closeCharContextMenu();
        if (id == null) return;
        this.beginTeleportForCharacter(id);
    };

    EE.prototype.selectCharacterFromPanel = function(charId) {
        this.selectCharacterForTimeline(Number(charId || 0), 'panel');
    };

    EE.prototype.refreshCharacterPanel = function(force) {
        if (!this.charList) return;
        var entries = this.buildCharacterPanelEntries();
        var sig = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            sig += e.id + ':' + (e.visible ? 1 : 0) + ':' + (e.selected ? 1 : 0) + ':' + (e.inTimeline ? 1 : 0) + '|';
        }
        sig += '#' + String(this.selKey || '');
        if (!force && sig === this._charPanelSig) {
            this.refreshSelectedCharacterInfo(false);
            return;
        }
        this._charPanelSig = sig;
        this.charList.innerHTML = '';
        var self = this;
        var frag = document.createDocumentFragment();
        for (i = 0; i < entries.length; i++) {
            (function(en) {
                var b = self.el('button', 'charit' + (en.visible ? ' v' : '') + (en.selected ? ' sel' : ''), en.text);
                b.type = 'button';
                b.title = String(en.text || '');
                b.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.selectCharacterFromPanel(en.id);
                });
                b.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.openCharContextMenu(en.id, e.clientX, e.clientY);
                });
                frag.appendChild(b);
            })(entries[i]);
        }
        this.charList.appendChild(frag);
        this.refreshSelectedCharacterInfo(true);
    };

    EE.prototype.timelineViewStorageFilePath = function(mapId) {
        mapId = Math.max(1, Math.floor(Number(mapId || 0)));
        try {
            var path = require('path');
            var file = 'Map' + ('000' + mapId).slice(-3) + '.timelineView.json';
            return path.join(process.cwd(), 'data', '_event_editor', file);
        } catch (_) {
            return '';
        }
    };

    EE.prototype.readTimelineViewStoreForMap = function(mapId) {
        var filePath = this.timelineViewStorageFilePath(mapId);
        if (!filePath) return {};
        try {
            var fs = require('fs');
            if (!fs.existsSync(filePath)) return {};
            var raw = fs.readFileSync(filePath, 'utf8');
            if (!raw || !String(raw).trim().length) return {};
            var obj = JSON.parse(raw);
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
            if (obj.views && typeof obj.views === 'object' && !Array.isArray(obj.views)) return obj.views;
            return obj;
        } catch (_) {
            return {};
        }
    };

    EE.prototype.writeTimelineViewStoreForMap = function(mapId, store) {
        var filePath = this.timelineViewStorageFilePath(mapId);
        if (!filePath) return false;
        store = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
        try {
            var fs = require('fs');
            var path = require('path');
            var dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
            return true;
        } catch (_) {
            return false;
        }
    };

    EE.prototype.timelineViewStoreKey = function(eventId, pageIndex) {
        return String(Math.floor(Number(eventId || 0))) + ':' + String(Math.floor(Number(pageIndex || 0)));
    };

    EE.prototype.captureCurrentTimelineViewState = function() {
        if (!this.timelineWrap) return null;
        var px = Number(this.pxPerFrame);
        var sl = Number(this.timelineWrap.scrollLeft || 0);
        var st = Number(this.timelineWrap.scrollTop || 0);
        if (!isFinite(px) || px <= 0) return null;
        if (!isFinite(sl)) sl = 0;
        if (!isFinite(st)) st = 0;
        return {
            pxPerFrame: px,
            scrollLeft: Math.max(0, Math.floor(sl)),
            scrollTop: Math.max(0, Math.floor(st))
        };
    };

    EE.prototype.persistSelectedTimelineViewStateToDisk = function() {
        if (!this.selEid || this.selPage < 0 || !this.selKey) return false;
        var mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? Math.floor(Number($gameMap.mapId() || 0)) : 0;
        if (mapId <= 0) return false;
        var st = this.captureCurrentTimelineViewState();
        if (!st) return false;
        var store = this.readTimelineViewStoreForMap(mapId);
        store[this.timelineViewStoreKey(this.selEid, this.selPage)] = st;
        return this.writeTimelineViewStoreForMap(mapId, store);
    };

    EE.prototype.queueTimelineViewRestoreForTrack = function(eventId, pageIndex) {
        var mapId = ($gameMap && typeof $gameMap.mapId === 'function') ? Math.floor(Number($gameMap.mapId() || 0)) : 0;
        if (mapId <= 0) {
            this._timelineViewPending = null;
            return;
        }
        var key = this.timelineViewStoreKey(eventId, pageIndex);
        var store = this.readTimelineViewStoreForMap(mapId);
        var st = store && typeof store === 'object' ? store[key] : null;
        if (!st || typeof st !== 'object') {
            this._timelineViewPending = null;
            return;
        }
        this._timelineViewPending = {
            selKey: this.key(eventId, pageIndex),
            pxPerFrame: Number(st.pxPerFrame),
            scrollLeft: Number(st.scrollLeft),
            scrollTop: Number(st.scrollTop)
        };
    };

    EE.prototype.applyPendingTimelineViewRestore = function() {
        var p = this._timelineViewPending;
        if (!p || !this.timelineWrap) return;
        if (String(p.selKey || '') !== String(this.selKey || '')) return;
        var wrap = this.timelineWrap;
        var maxLeft = Math.max(0, Math.floor(Number(wrap.scrollWidth || 0) - Number(wrap.clientWidth || 0)));
        var maxTop = Math.max(0, Math.floor(Number(wrap.scrollHeight || 0) - Number(wrap.clientHeight || 0)));
        var left = isFinite(Number(p.scrollLeft)) ? Math.floor(Number(p.scrollLeft || 0)) : 0;
        var top = isFinite(Number(p.scrollTop)) ? Math.floor(Number(p.scrollTop || 0)) : 0;
        wrap.scrollLeft = Math.max(0, Math.min(maxLeft, left));
        wrap.scrollTop = Math.max(0, Math.min(maxTop, top));
        this._timelineViewPending = null;
        this.timelineDirty = true;
    };

    EE.prototype.syncTimelineSize = function(maxF) {
        if (!this.timeline || !this.timelineWrap) return;
        var p = this._timelineViewPending;
        if (p && String(p.selKey || '') === String(this.selKey || '')) {
            var ppf = Number(p.pxPerFrame);
            if (isFinite(ppf) && ppf > 0) {
                this.pxPerFrame = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, ppf));
            }
        }
        var tr = this.model.tracks[this.selKey];
        var rows = this.getTrackRows(tr);
        this._rows = rows;
        this._mainStackMax = this.mainStackMax(tr);
        this._rowMetrics = this.buildRowMetrics(rows, this._mainStackMax);
        if (!isFinite(Number(maxF)) || Number(maxF) <= 0) maxF = this.maxFrame();
        else maxF = Math.max(1, Math.floor(Number(maxF)));
        // Canvas width has a hard implementation limit (NW.js/Chromium).
        // If we exceed it, drawing can disappear while hit-tests still work.
        var canvasMaxW = 16384;
        var reserveW = this.labelW + 160;
        var maxTrackW = Math.max(64, canvasMaxW - reserveW);
        if (maxF > 0) {
            var fitPx = maxTrackW / maxF;
            if (fitPx > 0 && this.pxPerFrame > fitPx) {
                // Allow auto-fit below user zoom minimum to preserve visibility.
                this.pxPerFrame = Math.max(1 / 4096, fitPx);
            }
        }
        var vw = Math.max(1, Math.floor(this.timelineWrap.clientWidth || 1));
        var bodyH = 0;
        for (var i = 0; i < this._rowMetrics.length; i++) bodyH += this._rowMetrics[i].height;
        var ch = Math.max(120, this.rulerH + bodyH + 10);
        var cw = Math.max(vw - 2, Math.ceil(this.labelW + maxF * this.pxPerFrame + 160));
        if (cw > canvasMaxW) cw = canvasMaxW;
        this.tw = cw;
        this.th = ch;
        this.timeline.width = this.tw;
        this.timeline.height = this.th;
        this.timeline.style.width = this.tw + 'px';
        this.timeline.style.height = this.th + 'px';
        if (this.zoomInfo) {
            this.zoomInfo.textContent = 'scale: ' + this.pxPerFrame.toFixed(3) + ' px/frame (ruler wheel: ' +
                this.minPxPerFrame.toFixed(3) + ' .. ' + this.maxPxPerFrame.toFixed(3) + ')';
        }
        this.applyPendingTimelineViewRestore();
    };

    EE.prototype.mainStackMax = function(tr) {
        if (!tr || !tr.commands) return 1;
        var c = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            c[f] = (c[f] || 0) + 1;
        }
        var m = 1, ks = Object.keys(c);
        for (var j = 0; j < ks.length; j++) m = Math.max(m, Number(c[ks[j]] || 0));
        return Math.max(1, m);
    };

    EE.prototype.mainRowHeight = function(maxStack) {
        maxStack = Math.max(1, Number(maxStack || 1));
        var h = this.mainLaneTop + this.mainLaneBottom + (maxStack - 1) * this.mainLaneGap;
        return Math.max(this.rowH, h);
    };

    EE.prototype.buildRowMetrics = function(rows, maxMainStack) {
        rows = rows || [];
        var out = [];
        var y = this.rulerH;
        for (var i = 0; i < rows.length; i++) {
            var h = (rows[i].key === 'main') ? this.mainRowHeight(maxMainStack) : this.rowH;
            out.push({ top: y, height: h, center: y + Math.floor(h / 2), key: rows[i].key });
            y += h;
        }
        return out;
    };

    EE.prototype.maxFrame = function() {
        var m = 300;
        var tr = this.model.tracks[this.selKey];
        if (tr) {
            var endFrame = this.normalizeTrackEndFrame(tr);
            m = Math.max(m, endFrame + this.timelineEndPaddingFrames());
        }
        var curFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        if (tr) curFrame = Math.min(curFrame, this.normalizeTrackEndFrame(tr));
        var need = Math.max(300, curFrame + this.timelineEndPaddingFrames());
        if (need > m) m = Math.ceil(need / 120) * 120;
        this.maxF = m;
        return m;
    };

    EE.prototype.frameToX = function(f) {
        return this.labelW + Math.round(Math.max(0, Number(f || 0)) * this.pxPerFrame);
    };

    EE.prototype.xToFrame = function(x) {
        var px = Math.max(1 / 4096, Number(this.pxPerFrame || this.minPxPerFrame || 1));
        return Math.max(0, Math.floor((x - this.labelW) / px));
    };

    EE.prototype.frameFromTimeline = function(e) {
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left;
        return this.xToFrame(x);
    };

    EE.prototype.timelineRulerTopY = function(totalHeight) {
        var h = Math.max(1, Math.floor(Number(totalHeight == null ? this.th : totalHeight) || 1));
        var y = 0;
        if (this.timelineWrap) y = Math.max(0, Math.floor(Number(this.timelineWrap.scrollTop || 0)));
        return Math.max(0, Math.min(h - this.rulerH, y));
    };

    EE.prototype.isTimelineRulerY = function(y, totalHeight) {
        y = Number(y || 0);
        var top = this.timelineRulerTopY(totalHeight);
        return y >= top && y <= (top + this.rulerH);
    };

    EE.prototype.isTimelineRulerPoint = function(x, y, includeLabel, totalHeight) {
        if (!this.isTimelineRulerY(y, totalHeight)) return false;
        if (includeLabel) return true;
        x = Number(x || 0);
        return x >= Number(this.labelW || 0);
    };

    EE.prototype.rowFromY = function(y) {
        if (!this._rows || !this._rows.length) return null;
        if (this.isTimelineRulerY(y)) return null;
        var ms = this._rowMetrics || [];
        for (var i = 0; i < ms.length; i++) {
            if (y >= ms[i].top && y < ms[i].top + ms[i].height) return this._rows[i];
        }
        return null;
    };

    EE.prototype.hitTestNode = function(x, y) {
        for (var i = this.hitNodes.length - 1; i >= 0; i--) {
            var n = this.hitNodes[i];
            var dx = x - n.x, dy = y - n.y;
            if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n;
        }
        return null;
    };

    EE.prototype.hitTestComment = function(x, y) {
        for (var i = this.hitComments.length - 1; i >= 0; i--) {
            var n = this.hitComments[i];
            var dx = x - n.x, dy = y - n.y;
            var rr = Math.max(3, Number(n.r || 3)) + 4;
            if (dx * dx + dy * dy <= rr * rr) return n;
        }
        return null;
    };

    EE.prototype.hitTestBar = function(x, y) {
        if (!this.hitBars) return null;
        for (var i = this.hitBars.length - 1; i >= 0; i--) {
            var b = this.hitBars[i];
            if (x >= b.x1 - 3 && x <= b.x2 + 3 && Math.abs(y - b.y) <= 6) return b;
        }
        return null;
    };

    EE.prototype.hitTestOrderButton = function(x, y) {
        if (!Array.isArray(this.hitOrderButtons)) return null;
        x = Number(x || 0);
        y = Number(y || 0);
        for (var i = this.hitOrderButtons.length - 1; i >= 0; i--) {
            var b = this.hitOrderButtons[i];
            if (!b) continue;
            if (x < Number(b.x1 || 0) || x > Number(b.x2 || 0)) continue;
            if (y < Number(b.y1 || 0) || y > Number(b.y2 || 0)) continue;
            return b;
        }
        return null;
    };

    EE.prototype.hitTestRouteCommandNodeNear = function(uid, x, y, extraRadius) {
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0 || !Array.isArray(this.hitNodes)) return null;
        x = Number(x || 0);
        y = Number(y || 0);
        var best = null;
        var bestDist2 = Infinity;
        var ex = Math.max(0, Number(extraRadius == null ? 5 : extraRadius));
        for (var i = this.hitNodes.length - 1; i >= 0; i--) {
            var n = this.hitNodes[i];
            if (!n) continue;
            if (Math.floor(Number(n.uid || 0)) !== uid) continue;
            var rli = this.nodeRouteIndex(n.routeListIndex);
            if (rli < 0) continue;
            var rr = Math.max(1, Number(n.r || 5)) + 4 + ex;
            var dx = x - Number(n.x || 0);
            var dy = y - Number(n.y || 0);
            var d2 = dx * dx + dy * dy;
            if (d2 > rr * rr) continue;
            if (d2 < bestDist2) {
                best = n;
                bestDist2 = d2;
            }
        }
        return best;
    };

    EE.prototype.nodeRouteIndex = function(routeListIndex) {
        return (routeListIndex == null) ? -1 : Number(routeListIndex);
    };

    EE.prototype.isNodeHovered = function(uid, routeListIndex) {
        if (!this.hoverUid) return false;
        if (Number(uid || 0) !== Number(this.hoverUid || 0)) return false;
        return this.nodeRouteIndex(routeListIndex) === this.nodeRouteIndex(this.hoverRouteListIndex);
    };

    EE.prototype.setHoverNode = function(node) {
        var uid = node ? Number(node.uid || 0) : 0;
        var routeListIndex = node ? this.nodeRouteIndex(node.routeListIndex) : -1;
        var changed = (uid !== Number(this.hoverUid || 0)) || (routeListIndex !== this.nodeRouteIndex(this.hoverRouteListIndex));
        this.hoverUid = uid;
        this.hoverRouteListIndex = routeListIndex;
        if (changed) this.timelineDirty = true;
    };

    EE.prototype.rangeSelectionItemKey = function(item) {
        if (!item) return '';
        if (String(item.kind || '') === 'routeCmd') {
            return 'r:' + Math.floor(Number(item.uid || 0)) + ':' + Math.floor(Number(item.routeListIndex || -1));
        }
        return 'e:' + Math.floor(Number(item.uid || 0));
    };

    EE.prototype.normalizeRangeSelectionItems = function(items) {
        var out = [];
        var map = Object.create(null);
        items = Array.isArray(items) ? items : [];
        for (var i = 0; i < items.length; i++) {
            var src = items[i];
            if (!src) continue;
            var kind = (String(src.kind || '') === 'routeCmd') ? 'routeCmd' : 'entry';
            var uid = Math.floor(Number(src.uid || 0));
            if (uid <= 0) continue;
            var it = { kind: kind, uid: uid };
            if (kind === 'routeCmd') it.routeListIndex = this.nodeRouteIndex(src.routeListIndex);
            var key = this.rangeSelectionItemKey(it);
            if (!key || map[key]) continue;
            map[key] = true;
            out.push(it);
        }
        return out;
    };

    EE.prototype.setRangeSelection = function(kind, items, opt) {
        opt = opt || {};
        kind = String(kind || 'none');
        if (kind !== 'memory' && kind !== 'rect') kind = 'none';
        var normalized = (kind === 'none') ? [] : this.normalizeRangeSelectionItems(items);
        var keepEmpty = !!opt.keepEmpty;
        var map = Object.create(null);
        for (var i = 0; i < normalized.length; i++) map[this.rangeSelectionItemKey(normalized[i])] = true;
        if (!this.rangeSelection || typeof this.rangeSelection !== 'object') this.rangeSelection = {};
        this.rangeSelection.kind = (kind !== 'none' && (normalized.length || keepEmpty)) ? kind : 'none';
        this.rangeSelection.items = normalized;
        this.rangeSelection.itemMap = map;
        this.rangeSelection.frameStart = Math.max(0, Math.floor(Number(opt.frameStart == null ? 0 : opt.frameStart)));
        this.rangeSelection.frameEnd = Math.max(this.rangeSelection.frameStart, Math.floor(Number(opt.frameEnd == null ? this.rangeSelection.frameStart : opt.frameEnd)));
        this.rangeSelection.rects = Array.isArray(opt.rects) ? opt.rects.slice(0) : [];
        this.rangeSelection.nonContiguous = !!opt.nonContiguous;
        if (!normalized.length) {
            this.selUid = 0;
            this.selRouteListIndex = -1;
        }
        this.timelineDirty = true;
    };

    EE.prototype.clearRangeSelection = function() {
        this.setRangeSelection('none', [], { frameStart: 0, frameEnd: 0, rects: [], nonContiguous: false });
    };

    EE.prototype.hasRangeSelection = function() {
        var rs = this.rangeSelection || {};
        var kind = String(rs.kind || 'none');
        if (kind === 'none') return false;
        if (Array.isArray(rs.items) && rs.items.length > 0) return true;
        if (kind === 'memory') return Number(rs.frameEnd || 0) >= Number(rs.frameStart || 0);
        return false;
    };

    EE.prototype.isEntryInRangeSelection = function(uid) {
        var rs = this.rangeSelection || {};
        if (!rs.itemMap) return false;
        return !!rs.itemMap['e:' + Math.floor(Number(uid || 0))];
    };

    EE.prototype.isRouteCmdInRangeSelection = function(uid, routeListIndex) {
        var rs = this.rangeSelection || {};
        if (!rs.itemMap) return false;
        return !!rs.itemMap['r:' + Math.floor(Number(uid || 0)) + ':' + this.nodeRouteIndex(routeListIndex)];
    };

    EE.prototype.selectedEntryUidsFromRange = function() {
        var rs = this.rangeSelection || {};
        var items = Array.isArray(rs.items) ? rs.items : [];
        var out = [];
        var seen = Object.create(null);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || String(it.kind || '') !== 'entry') continue;
            var uid = Math.floor(Number(it.uid || 0));
            if (uid <= 0 || seen[uid]) continue;
            seen[uid] = true;
            out.push(uid);
        }
        return out;
    };

    EE.prototype.selectedRouteCmdItemsFromRange = function() {
        var rs = this.rangeSelection || {};
        var items = Array.isArray(rs.items) ? rs.items : [];
        var out = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || String(it.kind || '') !== 'routeCmd') continue;
            out.push({ kind: 'routeCmd', uid: Math.floor(Number(it.uid || 0)), routeListIndex: this.nodeRouteIndex(it.routeListIndex) });
        }
        return this.normalizeRangeSelectionItems(out);
    };

    EE.prototype.rangeSelectionFrameRectFromFrames = function(a, b) {
        a = Math.max(0, Math.floor(Number(a || 0)));
        b = Math.max(a, Math.floor(Number(b || a)));
        return {
            x1: this.frameToX(a),
            x2: this.frameToX(b + 1),
            y1: 0,
            y2: this.rulerH
        };
    };

    EE.prototype.normalizeCanvasRect = function(x1, y1, x2, y2) {
        var ax = Math.min(Number(x1 || 0), Number(x2 || 0));
        var bx = Math.max(Number(x1 || 0), Number(x2 || 0));
        var ay = Math.min(Number(y1 || 0), Number(y2 || 0));
        var by = Math.max(Number(y1 || 0), Number(y2 || 0));
        return { x1: ax, y1: ay, x2: bx, y2: by };
    };

    EE.prototype.canvasRectFrameRange = function(rect) {
        rect = rect || {};
        var a = this.xToFrame(Number(rect.x1 || 0));
        var b = this.xToFrame(Number(rect.x2 || 0));
        if (a > b) { var t = a; a = b; b = t; }
        return { start: a, end: b };
    };

    EE.prototype.collectMemoryRangeSelectionItems = function(startFrame, endFrame) {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return [];
        var a = Math.max(0, Math.floor(Number(startFrame || 0)));
        var b = Math.max(a, Math.floor(Number(endFrame == null ? a : endFrame)));
        var out = [];
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) <= 0) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (Number(e.command.code || 0) === 205) {
                var ed = s + Math.max(1, Math.floor(Number(e.wait || 1)));
                if (ed < a || s > b) continue;
                out.push({ kind: 'entry', uid: e.uid });
                continue;
            }
            if (s < a || s > b) continue;
            out.push({ kind: 'entry', uid: e.uid });
        }
        return this.normalizeRangeSelectionItems(out);
    };

    EE.prototype.collectRectSelectionItems = function(rect) {
        rect = rect || {};
        var x1 = Math.min(Number(rect.x1 || 0), Number(rect.x2 || 0));
        var x2 = Math.max(Number(rect.x1 || 0), Number(rect.x2 || 0));
        var y1 = Math.min(Number(rect.y1 || 0), Number(rect.y2 || 0));
        var y2 = Math.max(Number(rect.y1 || 0), Number(rect.y2 || 0));
        var routeCmdCand = [];
        var entryCand = [];
        for (var i = 0; i < this.hitNodes.length; i++) {
            var n = this.hitNodes[i];
            if (!n) continue;
            var nr = Math.max(1, Number(n.r || 5)) + 2;
            var nx1 = Number(n.x || 0) - nr;
            var nx2 = Number(n.x || 0) + nr;
            var ny1 = Number(n.y || 0) - nr;
            var ny2 = Number(n.y || 0) + nr;
            if (nx2 < x1 || nx1 > x2 || ny2 < y1 || ny1 > y2) continue;
            if (n.routeListIndex != null && Number(n.routeListIndex) >= 0) {
                routeCmdCand.push({ kind: 'routeCmd', uid: Number(n.uid || 0), routeListIndex: Number(n.routeListIndex) });
            } else {
                var ee = this.findEntryInSelectedTrack(Number(n.uid || 0));
                if (ee && ee.isComment) continue;
                entryCand.push({ kind: 'entry', uid: Number(n.uid || 0) });
            }
        }
        for (i = 0; i < this.hitBars.length; i++) {
            var b = this.hitBars[i];
            if (!b || !b.routeRangeUid || String(b.routeRangePart || '') !== 'body') continue;
            var bx1 = Math.min(Number(b.x1 || 0), Number(b.x2 || 0));
            var bx2 = Math.max(Number(b.x1 || 0), Number(b.x2 || 0));
            var by1 = Number(b.y || 0) - 6;
            var by2 = Number(b.y || 0) + 6;
            if (bx2 < x1 || bx1 > x2 || by2 < y1 || by1 > y2) continue;
            entryCand.push({ kind: 'entry', uid: Number(b.routeRangeUid || 0) });
        }
        routeCmdCand = this.normalizeRangeSelectionItems(routeCmdCand);
        entryCand = this.normalizeRangeSelectionItems(entryCand);

        if (routeCmdCand.length) {
            var uid0 = Number(routeCmdCand[0].uid || 0);
            var sameRoute = true;
            for (i = 0; i < routeCmdCand.length; i++) {
                if (Number(routeCmdCand[i].uid || 0) !== uid0) { sameRoute = false; break; }
            }
            if (sameRoute) {
                for (i = 0; i < entryCand.length; i++) {
                    if (Number(entryCand[i].uid || 0) !== uid0) { sameRoute = false; break; }
                }
            }
            if (sameRoute) {
                var re = this.findRouteRangeEntryByUid(uid0);
                if (re) {
                    var rsx = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))));
                    var rex = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))) + Math.max(1, Math.floor(Number(re.wait || 1))));
                    // Include handle extents in horizontal in-range test.
                    // Left handle extends about 9px from body start, right handle about 7px.
                    var rx1 = Math.min(rsx, rex) - 9;
                    var rx2 = Math.max(rsx, rex) + 7;
                    var routeXMargin = 8;
                    var withinRouteX = (x1 >= rx1 - routeXMargin && x2 <= rx2 + routeXMargin);
                    if (withinRouteX) return routeCmdCand;
                    return this.normalizeRangeSelectionItems([{ kind: 'entry', uid: uid0 }]);
                }
            }
            for (i = 0; i < routeCmdCand.length; i++) entryCand.push({ kind: 'entry', uid: Number(routeCmdCand[i].uid || 0) });
        }
        return this.normalizeRangeSelectionItems(entryCand);
    };

    EE.prototype.routeBlocksFromList = function(routeList) {
        var list = Array.isArray(routeList) ? routeList : [];
        var blocks = [];
        var t = 0;
        for (var i = 0; i < list.length; i++) {
            var cmd = list[i];
            var code = Number((cmd && cmd.code) || 0);
            if (code === 0) break;
            if (code === 15) {
                var wf = Math.max(1, Math.floor(Number(((cmd && cmd.parameters) || [0])[0] || 0)));
                t += wf;
                continue;
            }
            var dur = 1;
            var j = i + 1;
            while (j < list.length) {
                var wcmd = list[j];
                var wcode = Number((wcmd && wcmd.code) || 0);
                if (wcode !== 15) break;
                dur += Math.max(1, Math.floor(Number(((wcmd && wcmd.parameters) || [0])[0] || 0)));
                j++;
            }
            blocks.push({
                start: t,
                dur: dur,
                listIndex: i,
                command: clone(cmd)
            });
            t += dur;
            i = j - 1;
        }
        return { blocks: blocks, total: t };
    };

    EE.prototype.routeListFromBlocks = function(blocks) {
        var out = [];
        var cur = 0;
        blocks = Array.isArray(blocks) ? blocks : [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.max(0, Math.floor(Number(b.start || 0)));
            var dur = Math.max(1, Math.floor(Number(b.dur || 1)));
            if (st > cur) out.push({ code: 15, parameters: [st - cur] });
            out.push(clone(b.command || { code: 0, parameters: [] }));
            if (dur > 1) out.push({ code: 15, parameters: [dur - 1] });
            cur = st + dur;
        }
        out.push({ code: 0, parameters: [] });
        return out;
    };

    EE.prototype.batchCanPlaceEntries = function(tr, movedEntries) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        movedEntries = Array.isArray(movedEntries) ? movedEntries : [];
        var removeMap = Object.create(null);
        for (var i = 0; i < movedEntries.length; i++) {
            var m = movedEntries[i];
            if (!m || !m.entry) continue;
            removeMap[Math.floor(Number(m.entry.uid || 0))] = true;
        }
        var temp = {
            commands: tr.commands.filter(function(e) {
                return !removeMap[Math.floor(Number((e && e.uid) || 0))];
            }).map(function(e) { return clone(e); })
        };
        var sorted = movedEntries.slice(0).sort(function(a, b) {
            var af = Math.floor(Number((a && a.frame) || 0));
            var bf = Math.floor(Number((b && b.frame) || 0));
            if (af !== bf) return af - bf;
            return Math.floor(Number((a && a.entry && a.entry.uid) || 0)) - Math.floor(Number((b && b.entry && b.entry.uid) || 0));
        });
        for (i = 0; i < sorted.length; i++) {
            var it = sorted[i];
            if (!it || !it.entry) continue;
            var e = clone(it.entry);
            e.frame = Math.max(0, Math.floor(Number(it.frame || 0)));
            e.rowKey = String(it.rowKey || e.rowKey || 'main');
            if (e.rowKey.indexOf('char:') === 0) {
                var cid = this.normalizeMoveTarget(Number(e.rowKey.replace('char:', '')));
                e.rowType = 'char';
                e.charId = cid;
                if (e.command && Number(e.command.code || 0) === 205) {
                    if (!Array.isArray(e.command.parameters)) e.command.parameters = [cid, this.defaultMoveRoute()];
                    e.command.parameters[0] = cid;
                }
            } else {
                e.rowType = 'main';
                e.charId = null;
            }
            if (!this.canPlaceEntry(temp, e, e.frame, e.rowKey, e.uid)) return false;
            // Include already-validated moved entries so collisions between moved
            // commands are also rejected (e.g. wait:false move-routes overlap).
            temp.commands.push(clone(e));
        }
        return true;
    };

    EE.prototype.routeBlocksAfterRemovingSelection = function(blocks, selectedMap) {
        blocks = Array.isArray(blocks) ? blocks : [];
        selectedMap = selectedMap || Object.create(null);
        var out = [];
        var removedBefore = 0;
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var key = Math.floor(Number(b.listIndex || -1));
            if (selectedMap[key]) {
                removedBefore += Math.max(1, Math.floor(Number(b.dur || 1)));
                continue;
            }
            out.push({
                start: Math.max(0, Math.floor(Number(b.start || 0))) - removedBefore,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Number(b.listIndex || 0),
                command: clone(b.command || { code: 0, parameters: [] })
            });
        }
        return out;
    };

    EE.prototype.deleteRangeSelection = function() {
        if (!this.hasRangeSelection()) return;
        if (!this.selKey) return;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return;
        var entryUids = this.selectedEntryUidsFromRange();
        var routeItems = this.selectedRouteCmdItemsFromRange();
        var routeByUid = Object.create(null);
        for (var i = 0; i < routeItems.length; i++) {
            var ri = routeItems[i];
            if (!ri || !ri.uid || ri.routeListIndex < 0) continue;
            if (!routeByUid[ri.uid]) routeByUid[ri.uid] = Object.create(null);
            routeByUid[ri.uid][Math.floor(Number(ri.routeListIndex || -1))] = true;
        }
        if (!entryUids.length && !routeItems.length) return;

        this.pushSnap('delRange');
        var entryMap = Object.create(null);
        for (i = 0; i < entryUids.length; i++) entryMap[Math.floor(Number(entryUids[i] || 0))] = true;

        for (i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.command || Number(e.command.code || 0) !== 205) continue;
            var uid = Math.floor(Number(e.uid || 0));
            if (!routeByUid[uid]) continue;
            if (entryMap[uid]) continue; // entry delete has priority
            var route = e.command.parameters && e.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : null;
            if (!list) continue;
            var parsed = this.routeBlocksFromList(list);
            var blocks = parsed.blocks || [];
            if (!blocks.length) continue;
            var nextBlocks = this.routeBlocksAfterRemovingSelection(blocks, routeByUid[uid]);
            route.list = this.routeListFromBlocks(nextBlocks);
            e.wait = this.commandWaitFrames(e.command);
        }

        if (entryUids.length) {
            tr.commands = tr.commands.filter(function(e2) {
                return !entryMap[Math.floor(Number((e2 && e2.uid) || 0))];
            });
        }

        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.clearRangeSelection();
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
    };

    EE.prototype.rangeSelectionHitAtPoint = function(x, y) {
        x = Number(x || 0);
        y = Number(y || 0);
        var hn = this.hitTestNode(x, y);
        if (hn) {
            var hri = this.nodeRouteIndex(hn.routeListIndex);
            if (hri >= 0 && this.isRouteCmdInRangeSelection(hn.uid, hri)) {
                return { kind: 'routeCmd', uid: Number(hn.uid || 0), routeListIndex: hri, node: hn };
            }
            if (this.isEntryInRangeSelection(hn.uid)) {
                return { kind: 'entry', uid: Number(hn.uid || 0), node: hn };
            }
        }
        var hb = this.hitTestBar(x, y);
        if (hb && hb.routeRangeUid && this.isEntryInRangeSelection(hb.routeRangeUid)) {
            return { kind: 'entry', uid: Number(hb.routeRangeUid || 0), bar: hb };
        }
        if (hb && hb.uid && this.isEntryInRangeSelection(hb.uid)) {
            return { kind: 'entry', uid: Number(hb.uid || 0), bar: hb };
        }
        return null;
    };

    EE.prototype.isPointInsideCurrentRangeSelection = function(x, y) {
        if (!this.hasRangeSelection()) return false;
        var hit = this.rangeSelectionHitAtPoint(x, y);
        if (hit) return true;
        var rs = this.rangeSelection || {};
        var rects = Array.isArray(rs.rects) ? rs.rects : [];
        for (var i = 0; i < rects.length; i++) {
            var rc = rects[i];
            if (!rc) continue;
            if (x >= Number(rc.x1 || 0) && x <= Number(rc.x2 || 0) && y >= Number(rc.y1 || 0) && y <= Number(rc.y2 || 0)) return true;
        }
        return false;
    };

    EE.prototype.rowIndexByKey = function(rowKey) {
        var rows = this._rows || [];
        for (var i = 0; i < rows.length; i++) if (String(rows[i].key || '') === String(rowKey || '')) return i;
        return -1;
    };

    EE.prototype.beginRangeSelectionDrag = function(mode, x, y, e) {
        mode = String(mode || '');
        if (mode !== 'memory' && mode !== 'rect') return false;
        var add = false, sub = false;
        if (mode === 'rect') {
            add = !!(e && e.shiftKey);
            sub = !!(e && e.ctrlKey);
            if (add && sub) sub = false;
        }
        this.rangeSelectDrag = {
            mode: mode,
            startX: Number(x || 0),
            startY: Number(y || 0),
            currentX: Number(x || 0),
            currentY: Number(y || 0),
            moved: false,
            additive: add,
            subtractive: sub
        };
        this.rangeMoveDrag = null;
        this.dragState = null;
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.updateRangeSelectionDrag = function(x, y) {
        var rsd = this.rangeSelectDrag;
        if (!rsd) return false;
        rsd.currentX = Number(x || 0);
        rsd.currentY = Number(y || 0);
        var dx = Math.abs(rsd.currentX - rsd.startX);
        var dy = Math.abs(rsd.currentY - rsd.startY);
        rsd.moved = (dx > 2 || dy > 2);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.rangeSelectDragFrameInfo = function(rsd) {
        if (!rsd) return null;
        var mode = String(rsd.mode || '');
        var rect;
        if (mode === 'memory') rect = this.normalizeCanvasRect(rsd.startX, 0, rsd.currentX, this.th);
        else rect = this.normalizeCanvasRect(rsd.startX, rsd.startY, rsd.currentX, rsd.currentY);
        var fr = this.canvasRectFrameRange(rect);
        var start = Math.max(0, Math.floor(Number(fr.start || 0)));
        var end = Math.max(start, Math.floor(Number(fr.end == null ? start : fr.end)));
        return {
            rect: rect,
            frameStart: start,
            frameEnd: end,
            frameCount: Math.max(1, end - start + 1)
        };
    };

    EE.prototype.finalizeRangeSelectionDrag = function() {
        var rsd = this.rangeSelectDrag;
        this.rangeSelectDrag = null;
        if (!rsd) return false;
        var mode = String(rsd.mode || '');
        if (mode === 'memory' && !rsd.moved) {
            if (this.hasRangeSelection()) this.clearRangeSelection();
            var targetFrame = this.xToFrame(Number(rsd.currentX == null ? rsd.startX : rsd.currentX));
            this.seek(Math.max(0, Math.floor(Number(targetFrame || 0))));
            this.timelineDirty = true;
            return true;
        }
        var rect;
        var items = [];
        var frameRange = { start: 0, end: 0 };
        if (mode === 'memory') {
            var mRect = this.normalizeCanvasRect(rsd.startX, 0, rsd.currentX, this.th);
            frameRange = this.canvasRectFrameRange(mRect);
            items = this.collectMemoryRangeSelectionItems(frameRange.start, frameRange.end);
            rect = this.rangeSelectionFrameRectFromFrames(frameRange.start, frameRange.end);
            rect.y1 = 0;
            rect.y2 = this.th;
            this.setRangeSelection('memory', items, {
                frameStart: frameRange.start,
                frameEnd: frameRange.end,
                rects: [rect],
                nonContiguous: false,
                keepEmpty: true
            });
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.timelineDirty = true;
            return true;
        }
        rect = this.normalizeCanvasRect(rsd.startX, rsd.startY, rsd.currentX, rsd.currentY);
        frameRange = this.canvasRectFrameRange(rect);
        items = this.collectRectSelectionItems(rect);
        if (!rsd.additive && !rsd.subtractive) {
            this.setRangeSelection('rect', items, {
                frameStart: frameRange.start,
                frameEnd: frameRange.end,
                rects: [rect],
                nonContiguous: false
            });
        } else {
            var cur = this.rangeSelection || {};
            var curItems = Array.isArray(cur.items) ? cur.items.slice(0) : [];
            var curRects = Array.isArray(cur.rects) ? cur.rects.slice(0) : [];
            var map = Object.create(null);
            var out = [];
            var i, key, it;
            for (i = 0; i < curItems.length; i++) {
                it = curItems[i];
                key = this.rangeSelectionItemKey(it);
                if (!key || map[key]) continue;
                map[key] = true;
                out.push(clone(it));
            }
            if (rsd.subtractive) {
                var remMap = Object.create(null);
                for (i = 0; i < items.length; i++) remMap[this.rangeSelectionItemKey(items[i])] = true;
                out = out.filter(function(v) { return !remMap[this.rangeSelectionItemKey(v)]; }, this);
            } else {
                for (i = 0; i < items.length; i++) {
                    it = items[i];
                    key = this.rangeSelectionItemKey(it);
                    if (!key || map[key]) continue;
                    map[key] = true;
                    out.push(clone(it));
                }
            }
            curRects.push(rect);
            var fs = Math.max(0, Math.floor(Number(cur.frameStart == null ? frameRange.start : cur.frameStart)));
            var fe = Math.max(fs, Math.floor(Number(cur.frameEnd == null ? frameRange.end : cur.frameEnd)));
            fs = Math.min(fs, frameRange.start);
            fe = Math.max(fe, frameRange.end);
            this.setRangeSelection('rect', out, {
                frameStart: fs,
                frameEnd: fe,
                rects: curRects,
                nonContiguous: true
            });
        }
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.beginRangeMoveDrag = function(x, y, hit) {
        if (!this.hasRangeSelection()) return false;
        hit = hit || this.rangeSelectionHitAtPoint(x, y);
        if (!hit) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var rs = this.rangeSelection || {};
        var mode = String(rs.kind || '');
        var drag = {
            kind: String(hit.kind || 'entry'),
            startX: Number(x || 0),
            startY: Number(y || 0),
            moved: false,
            valid: false,
            invalidReason: '',
            frameDelta: 0,
            rowShift: 0,
            mode: mode,
            hitUid: Number(hit.uid || 0),
            hitRouteListIndex: this.nodeRouteIndex(hit.routeListIndex),
            previewEntries: [],
            previewRouteBlocks: null,
            previewRouteUid: 0,
            previewRouteSelection: [],
            allowVertical: false
        };
        if (drag.kind === 'routeCmd') {
            var routeItems = this.selectedRouteCmdItemsFromRange();
            if (!routeItems.length) return false;
            var uid0 = Number(routeItems[0].uid || 0);
            for (var i = 0; i < routeItems.length; i++) {
                if (Number(routeItems[i].uid || 0) !== uid0) return false;
            }
            drag.routeItems = routeItems;
            drag.previewRouteUid = uid0;
        } else {
            var entryUids = this.selectedEntryUidsFromRange();
            if (!entryUids.length) return false;
            drag.entryUids = entryUids;
            var canV = true;
            for (var j = 0; j < entryUids.length; j++) {
                var e = this.findEntryInSelectedTrack(entryUids[j]);
                if (!e || !e.command || Number(e.command.code || 0) !== 205 || String(e.rowKey || '').indexOf('char:') !== 0) {
                    canV = false;
                    break;
                }
            }
            drag.allowVertical = canV && mode === 'rect';
            var anchorEntry = this.findEntryInSelectedTrack(drag.hitUid);
            if (!anchorEntry) anchorEntry = this.findEntryInSelectedTrack(entryUids[0]);
            drag.anchorRowKey = anchorEntry ? String(anchorEntry.rowKey || 'main') : 'main';
            drag.anchorRowIndex = this.rowIndexByKey(drag.anchorRowKey);
        }
        this.rangeMoveDrag = drag;
        this.rangeSelectDrag = null;
        this.dragState = null;
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.buildRangeMoveRoutePreview = function(drag, frameDelta) {
        var out = { valid: false, reason: '', blocks: null, selectedListIndexes: [] };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) { out.reason = 'no-track'; return out; }
        var entry = this.findEntryInSelectedTrack(drag.previewRouteUid);
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) { out.reason = 'no-route'; return out; }
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list) { out.reason = 'no-list'; return out; }
        var parsed = this.routeBlocksFromList(list);
        var blocks = parsed.blocks || [];
        var selMap = Object.create(null);
        for (var i = 0; i < drag.routeItems.length; i++) {
            selMap[Math.floor(Number(drag.routeItems[i].routeListIndex || -1))] = true;
        }
        var next = [];
        for (i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.floor(Number(b.start || 0));
            if (selMap[Math.floor(Number(b.listIndex || -1))]) st += frameDelta;
            var nb = {
                start: st,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Math.floor(Number(b.listIndex || -1)),
                command: clone(b.command || { code: 0, parameters: [] }),
                _sel: !!selMap[Math.floor(Number(b.listIndex || -1))]
            };
            if (nb.start < 0) {
                out.blocks = next;
                out.reason = 'minus';
                return out;
            }
            next.push(nb);
        }
        next.sort(function(a, b) {
            if (a.start !== b.start) return a.start - b.start;
            if (a._sel !== b._sel) return a._sel ? -1 : 1;
            return a.listIndex - b.listIndex;
        });
        for (i = 1; i < next.length; i++) {
            var prev = next[i - 1];
            var cur = next[i];
            if (cur.start < prev.start + prev.dur) {
                out.blocks = next;
                out.reason = 'overlap';
                return out;
            }
        }
        var probe = clone(entry);
        var probeCmd = clone(entry.command);
        var probeRoute = probeCmd.parameters && probeCmd.parameters[1] ? clone(probeCmd.parameters[1]) : this.defaultMoveRoute();
        probeRoute.list = this.routeListFromBlocks(next);
        if (!Array.isArray(probeCmd.parameters)) probeCmd.parameters = [entry.charId || 0, probeRoute];
        probeCmd.parameters[1] = probeRoute;
        probe.command = probeCmd;
        probe.wait = this.commandWaitFrames(probeCmd);
        if (!this.canPlaceEntry(tr, probe, probe.frame, probe.rowKey, probe.uid)) {
            out.blocks = next;
            out.reason = 'collision';
            return out;
        }
        var curFrame = 0;
        var cmdIndex = 0;
        var selectedList = [];
        for (i = 0; i < next.length; i++) {
            var nb2 = next[i];
            var st2 = Math.max(0, Math.floor(Number(nb2.start || 0)));
            var dur2 = Math.max(1, Math.floor(Number(nb2.dur || 1)));
            if (st2 > curFrame) cmdIndex++;
            if (nb2._sel) selectedList.push(cmdIndex);
            cmdIndex++;
            if (dur2 > 1) cmdIndex++;
            curFrame = st2 + dur2;
        }
        out.valid = true;
        out.blocks = next;
        out.selectedListIndexes = selectedList;
        return out;
    };

    EE.prototype.buildRangeMoveEntryPreview = function(drag, frameDelta, rowShift, pointerY) {
        var out = { valid: false, reason: '', moved: [] };
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) { out.reason = 'no-track'; return out; }
        var moved = [];
        var i;
        var rows = this._rows || [];
        var targetRow = this.rowFromY(pointerY);
        var useShift = 0;
        if (drag.allowVertical && targetRow) {
            var targetIdx = this.rowIndexByKey(targetRow.key);
            if (targetIdx >= 0 && drag.anchorRowIndex >= 0) useShift = targetIdx - drag.anchorRowIndex;
        }
        if (!drag.allowVertical) useShift = 0;
        for (i = 0; i < drag.entryUids.length; i++) {
            var uid = Number(drag.entryUids[i] || 0);
            var e = this.findEntryInSelectedTrack(uid);
            if (!e) continue;
            var nf = Math.max(0, Math.floor(Number(e.frame || 0)) + frameDelta);
            var rk = String(e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main'));
            if (useShift !== 0) {
                if (!drag.allowVertical) { out.reason = 'vertical-disabled'; return out; }
                var srcIdx = this.rowIndexByKey(rk);
                if (srcIdx < 0) { out.reason = 'row-missing'; return out; }
                var dstIdx = srcIdx + useShift;
                if (dstIdx < 0 || dstIdx >= rows.length) { out.reason = 'row-range'; return out; }
                var dst = rows[dstIdx];
                if (!dst || String(dst.key || '').indexOf('char:') !== 0) { out.reason = 'row-not-char'; return out; }
                rk = String(dst.key || rk);
            }
            moved.push({ entry: e, frame: nf, rowKey: rk });
        }
        if (!moved.length) { out.reason = 'no-entry'; return out; }
        if (!this.batchCanPlaceEntries(tr, moved)) {
            out.reason = 'collision';
            out.moved = moved;
            return out;
        }
        out.valid = true;
        out.moved = moved;
        out.rowShift = useShift;
        return out;
    };

    EE.prototype.updateRangeMoveDrag = function(x, y) {
        var drag = this.rangeMoveDrag;
        if (!drag) return false;
        x = Number(x || 0);
        y = Number(y || 0);
        var df = this.xToFrame(x) - this.xToFrame(drag.startX);
        var dx = Math.abs(x - drag.startX);
        var dy = Math.abs(y - drag.startY);
        if (!drag.moved && (dx > 2 || dy > 2)) drag.moved = true;
        drag.frameDelta = Math.floor(Number(df || 0));
        drag.valid = false;
        drag.invalidReason = '';
        if (!drag.moved) {
            drag.valid = true;
            drag.previewEntries = [];
            drag.previewRouteBlocks = null;
            this.timelineDirty = true;
            return true;
        }
        if (drag.kind === 'routeCmd') {
            var rp = this.buildRangeMoveRoutePreview(drag, drag.frameDelta);
            drag.valid = !!rp.valid;
            drag.invalidReason = String(rp.reason || '');
            drag.previewRouteBlocks = rp.blocks || null;
            drag.previewRouteSelection = rp.selectedListIndexes || [];
        } else {
            var ep = this.buildRangeMoveEntryPreview(drag, drag.frameDelta, drag.rowShift, y);
            drag.valid = !!ep.valid;
            drag.invalidReason = String(ep.reason || '');
            drag.previewEntries = ep.moved || [];
            drag.rowShift = Number(ep.rowShift || 0);
        }
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.applyRangeMoveDrag = function() {
        var drag = this.rangeMoveDrag;
        this.rangeMoveDrag = null;
        if (!drag || !drag.moved) return false;
        if (!drag.valid) {
            this.msg('Drop rejected (range move collision)');
            this.timelineDirty = true;
            return false;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        this.pushSnap('rangeMove');
        if (drag.kind === 'routeCmd') {
            var e = this.findEntryInSelectedTrack(drag.previewRouteUid);
            if (!e || !e.command || Number(e.command.code || 0) !== 205) return false;
            var route = e.command.parameters && e.command.parameters[1];
            if (!route || typeof route !== 'object') route = this.defaultMoveRoute();
            route.list = this.routeListFromBlocks(drag.previewRouteBlocks || []);
            if (!Array.isArray(e.command.parameters)) e.command.parameters = [e.charId || 0, route];
            e.command.parameters[1] = route;
            e.wait = this.commandWaitFrames(e.command);
            var nextSel = [];
            for (var i = 0; i < drag.previewRouteSelection.length; i++) {
                nextSel.push({ kind: 'routeCmd', uid: e.uid, routeListIndex: drag.previewRouteSelection[i] });
            }
            this.setRangeSelection('rect', nextSel, {
                frameStart: this.rangeSelection && this.rangeSelection.frameStart != null ? this.rangeSelection.frameStart : 0,
                frameEnd: this.rangeSelection && this.rangeSelection.frameEnd != null ? this.rangeSelection.frameEnd : 0,
                rects: this.rangeSelection && Array.isArray(this.rangeSelection.rects) ? this.rangeSelection.rects : [],
                nonContiguous: !!(this.rangeSelection && this.rangeSelection.nonContiguous)
            });
        } else {
            var moved = drag.previewEntries || [];
            for (var m = 0; m < moved.length; m++) {
                var it = moved[m];
                if (!it || !it.entry) continue;
                var de = it.entry;
                de.frame = Math.max(0, Math.floor(Number(it.frame || 0)));
                de.rowKey = String(it.rowKey || de.rowKey || 'main');
                if (de.rowKey.indexOf('char:') === 0) {
                    var cid = this.normalizeMoveTarget(Number(de.rowKey.replace('char:', '')));
                    de.rowType = 'char';
                    de.charId = cid;
                    if (de.command && Number(de.command.code || 0) === 205) {
                        if (!Array.isArray(de.command.parameters)) de.command.parameters = [cid, this.defaultMoveRoute()];
                        de.command.parameters[0] = cid;
                    }
                } else {
                    de.rowType = 'main';
                    de.charId = null;
                }
            }
        }
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        return true;
    };

    EE.prototype.globalSqueezeRemovableFrames = function(tr, startFrame, endFrameEx) {
        var out = [];
        if (!tr || !Array.isArray(tr.commands)) return out;
        var s = Math.max(0, Math.floor(Number(startFrame || 0)));
        var e = Math.max(s, Math.floor(Number(endFrameEx == null ? s : endFrameEx)));
        for (var f = s; f < e; f++) {
            var occ = false;
            for (var i = 0; i < tr.commands.length; i++) {
                var cmd = tr.commands[i];
                if (!cmd) continue;
                var cs = Math.max(0, Math.floor(Number(cmd.frame || 0)));
                var cw = Math.max(0, Math.floor(Number(cmd.wait || 0)));
                var ce = cs + cw;
                if (cw > 0) {
                    if (f >= cs && f < ce) { occ = true; break; }
                } else if (f === cs) {
                    occ = true;
                    break;
                }
            }
            if (!occ) out.push(f);
        }
        return out;
    };

    EE.prototype.routeSqueezeRemovableOffsets = function(entry, startFrame, endFrameEx) {
        var out = [];
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return out;
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list) return out;
        var parsed = this.routeBlocksFromList(list);
        var blocks = parsed.blocks || [];
        var total = Math.max(0, Math.floor(Number(parsed.total || 0)));
        var rs = Math.max(0, Math.floor(Number(startFrame || 0)) - Math.floor(Number(entry.frame || 0)));
        var re = Math.max(rs, Math.floor(Number(endFrameEx == null ? rs : endFrameEx)) - Math.floor(Number(entry.frame || 0)));
        rs = Math.max(0, Math.min(total, rs));
        re = Math.max(rs, Math.min(total, re));
        for (var off = rs; off < re; off++) {
            var occ = false;
            for (var i = 0; i < blocks.length; i++) {
                var b = blocks[i];
                if (!b) continue;
                var bs = Math.max(0, Math.floor(Number(b.start || 0)));
                var be = bs + Math.max(1, Math.floor(Number(b.dur || 1)));
                if (off >= bs && off < be) { occ = true; break; }
            }
            if (!occ) out.push(off);
        }
        return out;
    };

    EE.prototype.selectionSqueezeCapability = function() {
        var off = { enabled: false, mode: '', reason: 'no-selection', start: 0, end: 0, uid: 0, removedFrames: 0 };
        if (!this.hasRangeSelection()) {
            var singleUid = 0;
            if (Number(this.routeRangeCtxUid || 0) > 0) singleUid = Number(this.routeRangeCtxUid || 0);
            else if (Number(this.selUid || 0) > 0 && Number(this.selRouteListIndex == null ? -1 : this.selRouteListIndex) < 0) singleUid = Number(this.selUid || 0);
            if (singleUid > 0) {
                var tr0 = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
                var entry0 = this.findRouteRangeEntryByUid(singleUid);
                if (tr0 && entry0) {
                    var s0 = Math.max(0, Math.floor(Number(entry0.frame || 0)));
                    var e0 = s0 + Math.max(1, Math.floor(Number(entry0.wait || 1)));
                    var rem0 = this.routeSqueezeRemovableOffsets(entry0, s0, e0);
                    if (rem0.length > 0) {
                        return { enabled: true, mode: 'route', reason: '', start: s0, end: e0, uid: singleUid, removedFrames: rem0.length };
                    }
                    off.reason = 'no-gap';
                    return off;
                }
            }
            return off;
        }
        var rs = this.rangeSelection || {};
        if (rs.nonContiguous) {
            off.reason = 'non-contiguous';
            return off;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            off.reason = 'no-track';
            return off;
        }
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd || fs)));
        if (String(rs.kind || '') === 'memory') {
            var rem = this.globalSqueezeRemovableFrames(tr, fs, fe + 1);
            if (!rem.length) {
                off.reason = 'no-gap';
                return off;
            }
            return { enabled: true, mode: 'global', reason: '', start: fs, end: fe + 1, uid: 0, removedFrames: rem.length };
        }
        var rsItems = Array.isArray(rs.items) ? rs.items : [];
        for (var si = 0; si < rsItems.length; si++) {
            if (!rsItems[si] || String(rsItems[si].kind || '') !== 'routeCmd') {
                off.reason = 'not-route-cmd';
                return off;
            }
        }
        var routeItems = this.selectedRouteCmdItemsFromRange();
        if (!routeItems.length) {
            off.reason = 'not-route-cmd';
            return off;
        }
        var uid0 = Number(routeItems[0].uid || 0);
        for (var i = 0; i < routeItems.length; i++) {
            if (Number(routeItems[i].uid || 0) !== uid0) {
                off.reason = 'multi-route';
                return off;
            }
        }
        var entry = this.findRouteRangeEntryByUid(uid0);
        if (!entry) {
            off.reason = 'route-missing';
            return off;
        }
        var rem2 = this.routeSqueezeRemovableOffsets(entry, fs, fe + 1);
        if (!rem2.length) {
            off.reason = 'no-gap';
            return off;
        }
        return { enabled: true, mode: 'route', reason: '', start: fs, end: fe + 1, uid: uid0, removedFrames: rem2.length };
    };

    EE.prototype.shrinkCurrentRangeSelectionAfterSqueeze = function(removedFrames) {
        var rm = Math.max(0, Math.floor(Number(removedFrames || 0)));
        if (rm <= 0) return;
        var rs = this.rangeSelection || null;
        if (!rs || String(rs.kind || 'none') === 'none') return;
        var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
        var fe = Math.max(fs, Math.floor(Number(rs.frameEnd || fs)));
        var oldEndEx = fe + 1;
        var newEndEx = Math.max(fs + 1, oldEndEx - rm);
        rs.frameStart = fs;
        rs.frameEnd = Math.max(fs, newEndEx - 1);
        var shrinkPx = Math.max(0, this.frameToX(oldEndEx) - this.frameToX(newEndEx));
        var rects = Array.isArray(rs.rects) ? rs.rects : [];
        if (String(rs.kind || '') === 'memory') {
            var rr = this.rangeSelectionFrameRectFromFrames(rs.frameStart, rs.frameEnd);
            rr.y1 = 0;
            rr.y2 = this.th;
            rs.rects = [rr];
        } else if (shrinkPx > 0 && rects.length) {
            var nextRects = [];
            for (var i = 0; i < rects.length; i++) {
                var rc = rects[i];
                if (!rc) continue;
                var nx = clone(rc);
                if (Number(nx.x1 || 0) <= Number(nx.x2 || 0)) {
                    nx.x2 = Math.max(Number(nx.x1 || 0), Number(nx.x2 || 0) - shrinkPx);
                } else {
                    nx.x1 = Math.max(Number(nx.x2 || 0), Number(nx.x1 || 0) - shrinkPx);
                }
                nextRects.push(nx);
            }
            rs.rects = nextRects;
        }
        this.timelineDirty = true;
    };

    EE.prototype.applyGlobalSqueeze = function(startFrame, endFrameEx) {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var removable = this.globalSqueezeRemovableFrames(tr, startFrame, endFrameEx);
        if (!removable.length) return false;
        var remMap = Object.create(null);
        for (var i = 0; i < removable.length; i++) remMap[Math.floor(Number(removable[i] || 0))] = true;
        var s = Math.max(0, Math.floor(Number(startFrame || 0)));
        var e = Math.max(s, Math.floor(Number(endFrameEx == null ? s : endFrameEx)));
        var shiftBefore = function(frame) {
            var cnt = 0;
            for (var f = s; f < Math.min(e, frame); f++) if (remMap[f]) cnt++;
            if (frame >= e) cnt = removable.length;
            return cnt;
        };
        for (i = 0; i < tr.commands.length; i++) {
            var cmd = tr.commands[i];
            if (!cmd) continue;
            var old = Math.max(0, Math.floor(Number(cmd.frame || 0)));
            var sh = shiftBefore(old);
            cmd.frame = Math.max(0, old - sh);
        }
        return true;
    };

    EE.prototype.applyRouteSqueeze = function(uid, startFrame, endFrameEx) {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var e = this.findRouteRangeEntryByUid(uid);
        if (!e) return false;
        var route = e.command.parameters && e.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : null;
        if (!list) return false;
        var blocks = this.routeBlocksFromList(list).blocks || [];
        var removable = this.routeSqueezeRemovableOffsets(e, startFrame, endFrameEx);
        if (!removable.length) return false;
        var remMap = Object.create(null);
        for (var i = 0; i < removable.length; i++) remMap[Math.floor(Number(removable[i] || 0))] = true;
        var rs = Math.max(0, Math.floor(Number(startFrame || 0)) - Math.floor(Number(e.frame || 0)));
        var re = Math.max(rs, Math.floor(Number(endFrameEx == null ? startFrame : endFrameEx)) - Math.floor(Number(e.frame || 0)));
        var shiftBefore = function(off) {
            var cnt = 0;
            for (var f = rs; f < Math.min(re, off); f++) if (remMap[f]) cnt++;
            if (off >= re) cnt = removable.length;
            return cnt;
        };
        var next = [];
        for (i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!b) continue;
            var st = Math.max(0, Math.floor(Number(b.start || 0)));
            st = Math.max(0, st - shiftBefore(st));
            next.push({
                start: st,
                dur: Math.max(1, Math.floor(Number(b.dur || 1))),
                listIndex: Math.floor(Number(b.listIndex || -1)),
                command: clone(b.command || { code: 0, parameters: [] })
            });
        }
        var oldCmd = clone(e.command);
        var oldWait = Math.max(1, Math.floor(Number(e.wait || 1)));
        route.list = this.routeListFromBlocks(next);
        e.wait = this.commandWaitFrames(e.command);
        if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
            e.command = oldCmd;
            e.wait = oldWait;
            return false;
        }
        return true;
    };

    EE.prototype.executeSelectionSqueezeFromContextMenu = function() {
        var cap = this.selectionSqueezeCapability();
        if (!cap.enabled) {
            this.msg('詰める不可');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var ok = false;
        this.pushSnap('rangeSqueeze');
        if (cap.mode === 'global') ok = this.applyGlobalSqueeze(cap.start, cap.end);
        else if (cap.mode === 'route') ok = this.applyRouteSqueeze(cap.uid, cap.start, cap.end);
        if (!ok) {
            this.msg('詰める失敗');
            return;
        }
        this.shrinkCurrentRangeSelectionAfterSqueeze(cap.removedFrames);
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (tr && Array.isArray(tr.commands)) tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        this.msg('詰める実行');
    };

    EE.prototype.routeExecutionSpanFramesForEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return Math.max(0, Math.floor(Number(entry && entry.wait || 0)));
        var route = entry.command.parameters && entry.command.parameters[1];
        var waitSpan = Math.max(0, Math.floor(Number(entry.wait || 0)));
        var runtimeSpan = Math.max(1, Math.floor(Number(this.moveRouteFrames(route) || 1)));
        return Math.max(1, waitSpan || runtimeSpan);
    };

    EE.prototype.selectionRouteMergeCapability = function() {
        var off = { enabled: false, reason: 'no-selection', entries: [] };
        if (!this.hasRangeSelection()) return off;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            off.reason = 'no-track';
            return off;
        }
        var uids = this.selectedEntryUidsFromRange();
        if (!uids.length) {
            off.reason = 'not-entry-selection';
            return off;
        }
        if (uids.length < 2) {
            off.reason = 'need-multiple';
            return off;
        }
        var entries = [];
        for (var i = 0; i < uids.length; i++) {
            var e = this.findEntryInSelectedTrack(Number(uids[i] || 0));
            if (!e || !e.command || Number(e.command.code || 0) !== 205 || String(e.rowType || '') !== 'char') {
                off.reason = 'not-route-entry';
                return off;
            }
            entries.push(e);
        }
        entries.sort(function(a, b) {
            return compareEntriesByFrameWaitUid(a, b);
        });
        var first = entries[0];
        var firstRoute = this.routeOptionsFromEntry(first);
        if (!firstRoute) {
            off.reason = 'route-missing';
            return off;
        }
        var firstCharId = this.normalizeMoveTarget(Number(first.charId || 0));
        var firstWait = (firstRoute.wait !== false);
        var firstRepeat = !!firstRoute.repeat;
        var firstSkippable = !!firstRoute.skippable;
        for (i = 0; i < entries.length; i++) {
            var cur = entries[i];
            if (this.normalizeMoveTarget(Number(cur.charId || 0)) !== firstCharId) {
                off.reason = 'multi-char';
                return off;
            }
            var curRoute = this.routeOptionsFromEntry(cur);
            if (!curRoute) {
                off.reason = 'route-missing';
                return off;
            }
            var curWait = (curRoute.wait !== false);
            if (curWait !== firstWait || !!curRoute.repeat !== firstRepeat || !!curRoute.skippable !== firstSkippable) {
                off.reason = 'option-mismatch';
                return off;
            }
            if (i <= 0) continue;
            var prev = entries[i - 1];
            var prevEnd = Math.max(0, Math.floor(Number(prev.frame || 0))) + this.routeExecutionSpanFramesForEntry(prev);
            if (Math.max(0, Math.floor(Number(cur.frame || 0))) < prevEnd) {
                off.reason = 'overlap';
                return off;
            }
        }
        return { enabled: true, reason: '', entries: entries };
    };

    EE.prototype.executeSelectionRouteMergeFromContextMenu = function() {
        var cap = this.selectionRouteMergeCapability();
        if (!cap.enabled) {
            this.msg('移動ルートの結合不可');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var entries = cap.entries || [];
        if (entries.length < 2) {
            this.msg('移動ルートの結合不可');
            this.refreshRouteRangeContextMenu();
            return;
        }
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) {
            this.msg('移動ルートの結合失敗');
            return;
        }
        var keep = entries[0];
        var keepUid = Math.floor(Number(keep.uid || 0));
        if (keepUid <= 0) {
            this.msg('移動ルートの結合失敗');
            return;
        }
        var removeMap = Object.create(null);
        for (var i = 1; i < entries.length; i++) removeMap[Math.floor(Number(entries[i].uid || 0))] = true;

        var mergedRoute = clone(this.routeOptionsFromEntry(keep) || {});
        var mergedList = [];
        var prevEndFrame = null;
        for (i = 0; i < entries.length; i++) {
            var srcEntry = entries[i];
            var srcStart = Math.max(0, Math.floor(Number(srcEntry.frame || 0)));
            if (prevEndFrame != null) {
                var gap = Math.max(0, srcStart - Math.max(0, Math.floor(Number(prevEndFrame || 0))));
                if (gap > 0) mergedList.push({ code: 15, parameters: [gap] });
            }
            var route = this.routeOptionsFromEntry(srcEntry);
            var list = route && Array.isArray(route.list) ? route.list : [];
            for (var j = 0; j < list.length; j++) {
                var cmd = list[j];
                var code = Number((cmd && cmd.code) || 0);
                if (code === 0) break;
                mergedList.push(clone(cmd));
            }
            prevEndFrame = srcStart + this.routeExecutionSpanFramesForEntry(srcEntry);
        }
        mergedList.push({ code: 0, parameters: [] });
        mergedRoute.list = mergedList;

        var mergedCommand = clone(keep.command || { code: 205, parameters: [] });
        if (!Array.isArray(mergedCommand.parameters)) mergedCommand.parameters = [0, this.defaultMoveRoute()];
        mergedCommand.parameters[0] = this.normalizeMoveTarget(Number(keep.charId || 0));
        mergedCommand.parameters[1] = mergedRoute;

        var mergedEntry = clone(keep);
        mergedEntry.command = mergedCommand;
        mergedEntry.wait = this.commandWaitFrames(mergedCommand);
        mergedEntry.rowType = 'char';
        mergedEntry.charId = this.normalizeMoveTarget(Number(keep.charId || 0));
        mergedEntry.rowKey = 'char:' + mergedEntry.charId;

        var tempCommands = [];
        for (i = 0; i < tr.commands.length; i++) {
            var src = tr.commands[i];
            if (!src) continue;
            var uid = Math.floor(Number(src.uid || 0));
            if (uid !== keepUid && removeMap[uid]) continue;
            if (uid === keepUid) tempCommands.push(clone(mergedEntry));
            else tempCommands.push(clone(src));
        }
        var tempTrack = { commands: tempCommands };
        if (!this.canPlaceEntry(tempTrack, mergedEntry, mergedEntry.frame, mergedEntry.rowKey, mergedEntry.uid)) {
            this.msg('移動ルートの結合失敗');
            this.refreshRouteRangeContextMenu();
            return;
        }

        this.pushSnap('routeMerge');
        var nextCommands = [];
        for (i = 0; i < tr.commands.length; i++) {
            var cur = tr.commands[i];
            if (!cur) continue;
            var curUid = Math.floor(Number(cur.uid || 0));
            if (curUid !== keepUid && removeMap[curUid]) continue;
            if (curUid === keepUid) {
                cur.command = clone(mergedCommand);
                cur.wait = Math.max(0, Math.floor(Number(mergedEntry.wait || 0)));
                cur.rowType = 'char';
                cur.charId = mergedEntry.charId;
                cur.rowKey = mergedEntry.rowKey;
            }
            nextCommands.push(cur);
        }
        tr.commands = nextCommands;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        if (this.hasRangeSelection()) this.clearRangeSelection();
        this.selUid = keepUid;
        this.selRouteListIndex = -1;
        this.frame = Math.max(0, Math.floor(Number(keep.frame || 0)));
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.seek(this.frame);
        this.refreshRouteRangeContextMenu();
        this.msg('移動ルートを結合');
    };

    EE.prototype.showTipAt = function(screenX, screenY, text) {
        if (!this.tip) return;
        if (!text) {
            this.tip.style.display = 'none';
            return;
        }
        this.tip.style.display = 'block';
        this.tip.style.left = Math.floor(screenX + 12) + 'px';
        this.tip.style.top = Math.floor(screenY + 12) + 'px';
        if (Array.isArray(text)) {
            var html = '';
            for (var i = 0; i < text.length; i++) {
                var it = text[i];
                if (typeof it === 'string') {
                    html += this.escapeHtml(it);
                } else if (it && typeof it.text === 'string') {
                    var col = '';
                    if (it.color) {
                        col = String(it.color);
                    } else if (it.detail) {
                        col = it.dim ? 'rgba(118,164,182,.95)' : 'rgba(132,224,255,.98)';
                    } else {
                        col = it.dim ? 'rgba(170,176,188,.95)' : 'rgba(238,245,255,.98)';
                    }
                    html += '<span style="color:' + col + ';">' + this.escapeHtml(it.text) + '</span>';
                } else {
                    html += this.escapeHtml(String(it));
                }
                if (i !== text.length - 1) html += '<br>';
            }
            this.tip.innerHTML = html;
        } else {
            this.tip.textContent = String(text);
        }
    };

    EE.prototype.escapeHtml = function(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    EE.prototype.commandNameFromCatalog = function(code) {
        code = Number(code || 0);
        if (!code) return '';
        if (!this._commandNameCache) {
            this._commandNameCache = {};
            this.ensureAddCommandCatalog();
            var cat = this._addCommandCatalog || {};
            var pages = [1, 2, 3];
            for (var pi = 0; pi < pages.length; pi++) {
                var pg = cat[pages[pi]];
                if (!pg) continue;
                var cols = [pg.left, pg.right];
                for (var ci = 0; ci < cols.length; ci++) {
                    var groups = Array.isArray(cols[ci]) ? cols[ci] : [];
                    for (var gi = 0; gi < groups.length; gi++) {
                        var items = Array.isArray(groups[gi] && groups[gi].items) ? groups[gi].items : [];
                        for (var ii = 0; ii < items.length; ii++) {
                            var it = items[ii];
                            var c = Number(it && it.code || 0);
                            if (!c || this._commandNameCache[c]) continue;
                            var nm = String(it && it.label || '');
                            nm = nm.replace(/\.\.\.$/, '');
                            if (nm) this._commandNameCache[c] = nm;
                        }
                    }
                }
            }
        }
        return String(this._commandNameCache[code] || '');
    };

    EE.prototype.commandNameJa = function(code) {
        var n = {
            101: '文章の表示',
            102: '選択肢の表示',
            103: '数値入力の処理',
            104: 'アイテム選択の処理',
            105: '文章のスクロール表示',
            108: '注釈',
            111: '条件分岐',
            112: 'ループ',
            113: 'ループの中断',
            117: 'コモンイベント',
            118: 'ラベル',
            119: 'ラベルジャンプ',
            121: 'スイッチの操作',
            122: '変数の操作',
            123: 'セルフスイッチの操作',
            124: 'タイマーの操作',
            125: '増減の操作',
            201: '場所移動',
            205: '移動ルートの設定',
            230: 'ウェイト',
            250: 'SEの演奏',
            261: 'ムービーの再生',
            303: '名前入力の処理',
            355: 'スクリプト',
            35550: 'カメラ移動',
            35551: 'カメラ移動(直接指定)',
            356: 'プラグインコマンド'
        };
        var c = Number(code || 0);
        if (n[c]) return n[c];
        var catName = this.commandNameFromCatalog(c);
        if (catName) return catName;
        var schema = this.getEditorSchema(c);
        if (schema && schema.title) return String(schema.title);
        return 'コマンド' + c;
    };

    EE.prototype.tooltipShortText = function(v, maxLen) {
        maxLen = Math.max(8, Math.floor(Number(maxLen || 60)));
        var s = String(v == null ? '' : v).replace(/\r?\n/g, ' / ').trim();
        if (s.length > maxLen) s = s.slice(0, Math.max(1, maxLen - 3)) + '...';
        return s;
    };

    EE.prototype.tooltipAudioParamText = function(v) {
        if (!v || typeof v !== 'object') return '';
        var hasAny = (v.name != null || v.volume != null || v.pitch != null || v.pan != null);
        if (!hasAny) return '';
        var name = this.tooltipShortText(v.name || '(なし)', 26);
        var vol = Math.max(0, Math.floor(Number(v.volume == null ? 90 : v.volume)));
        var pit = Math.max(0, Math.floor(Number(v.pitch == null ? 100 : v.pitch)));
        var pan = Math.max(-100, Math.min(100, Math.floor(Number(v.pan == null ? 0 : v.pan))));
        return name + ' (vol:' + vol + ' pitch:' + pit + ' pan:' + pan + ')';
    };

    EE.prototype.tooltipDbNameById = function(arr, id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        var nm = (arr && arr[id] && arr[id].name) ? String(arr[id].name) : '';
        if (!nm.length) nm = '(未設定)';
        return nm;
    };

    EE.prototype.tooltipVarIdText = function(id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        return ('0000' + id).slice(-4);
    };

    EE.prototype.tooltipVariableNameById = function(id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        var arr = ($dataSystem && Array.isArray($dataSystem.variables)) ? $dataSystem.variables : null;
        var nm = arr && arr[id] ? String(arr[id]) : '';
        if (!nm.length) nm = '(未設定)';
        return nm;
    };

    EE.prototype.tooltipVariableLabel = function(id) {
        id = Math.max(0, Math.floor(Number(id || 0)));
        return 'ID' + this.tooltipVarIdText(id) + ' ' + this.tooltipVariableNameById(id);
    };

    EE.prototype.tooltipOperandText = function(type, p, constIndex, varIndex) {
        type = Math.max(0, Math.floor(Number(type || 0)));
        p = Array.isArray(p) ? p : [];
        var ci = Math.max(0, Math.floor(Number(constIndex || 0)));
        var vi = Math.max(0, Math.floor(Number(varIndex == null ? constIndex : varIndex)));
        if (type === 1) {
            return this.tooltipVariableLabel(Number(p[vi] || 1));
        }
        return this.tooltipParamValueText(p[ci], 0);
    };

    EE.prototype.tooltipVariableOperationText = function(p) {
        p = Array.isArray(p) ? p : [];
        var v1 = Math.max(1, Math.floor(Number(p[0] || 1)));
        var v2 = Math.max(v1, Math.floor(Number(p[1] || v1)));
        var op = Math.max(0, Math.min(5, Math.floor(Number(p[2] || 0))));
        var operandType = Math.max(0, Math.min(4, Math.floor(Number(p[3] || 0))));
        var opSym = ['=', '+=', '-=', '*=', '/=', '%='][op];
        var left = (v1 === v2)
            ? this.tooltipVariableLabel(v1)
            : ('ID' + this.tooltipVarIdText(v1) + '〜ID' + this.tooltipVarIdText(v2));
        var right = '';
        if (operandType === 0) right = this.tooltipParamValueText(p[4], 0);
        else if (operandType === 1) right = this.tooltipVariableLabel(Number(p[4] || 1));
        else if (operandType === 2) right = '乱数(' + Math.floor(Number(p[4] || 0)) + '〜' + Math.floor(Number(p[5] || 0)) + ')';
        else if (operandType === 3) right = 'ゲームデータ(' + [p[4], p[5], p[6]].map(function(v) { return Math.floor(Number(v || 0)); }).join(',') + ')';
        else if (operandType === 4) right = 'script:' + this.tooltipShortText(p[4], 40);
        else right = this.tooltipParamsText(p.slice(4));
        return left + ' ' + opSym + ' ' + right;
    };

    EE.prototype.tooltipTransferText = function(p) {
        p = Array.isArray(p) ? p : [];
        var loc = Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0))));
        var dir = Math.floor(Number(p[4] || 0));
        var fade = Math.floor(Number(p[5] || 0));
        var dirText = { 0: '向き維持', 2: '下', 4: '左', 6: '右', 8: '上' }[dir] || ('向き' + dir);
        var fadeText = { 0: '黒', 1: '白', 2: 'なし' }[fade] || String(fade);
        var where = '';
        if (loc === 0) {
            where = 'マップ' + Math.floor(Number(p[1] || 0)) + ' (' +
                Math.floor(Number(p[2] || 0)) + ',' + Math.floor(Number(p[3] || 0)) + ')';
        } else if (loc === 1) {
            where = '変数指定 M:' + this.tooltipVariableLabel(Number(p[1] || 1)) +
                ' X:' + this.tooltipVariableLabel(Number(p[2] || 1)) +
                ' Y:' + this.tooltipVariableLabel(Number(p[3] || 1));
        } else {
            where = '現在位置';
        }
        return where + ' / 向き:' + dirText + ' / フェード:' + fadeText;
    };

    EE.prototype.tooltipSchemaFieldText = function(field, value, state) {
        if (!field) return '';
        var type = String(field.type || '');
        if (type === 'bool') return value ? 'ON' : 'OFF';
        if (type === 'select' || type === 'list') {
            var opts = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state || {}));
            var sv = String(value == null ? '' : value);
            for (var i = 0; i < opts.length; i++) {
                if (String(opts[i].value) === sv) return String(opts[i].label || sv);
            }
            return this.tooltipParamValueText(value, 0);
        }
        if (type === 'number') {
            var n = Number(value);
            if (!isFinite(n)) return String(value == null ? '' : value);
            if (field.integer) return String(Math.floor(n));
            return this.formatCoordText(n, 2, false);
        }
        if (type === 'text' || type === 'textarea') return this.tooltipShortText(value, 48);
        return this.tooltipParamValueText(value, 0);
    };

    EE.prototype.tooltipSchemaSummaryFromState = function(schema, state) {
        if (!schema || !state || typeof state !== 'object') return '';
        var fs = Array.isArray(schema.fields) ? schema.fields : [];
        if (!fs.length) return '';
        var parts = [];
        var total = 0;
        var limit = 4;
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (!f || !f.key) continue;
            if (!this.schemaFieldVisible(f, state)) continue;
            var k = String(f.key || '');
            if (!Object.prototype.hasOwnProperty.call(state, k)) continue;
            var v = state[k];
            if ((v == null || v === '') && String(f.type || '') !== 'bool') continue;
            var txt = this.tooltipSchemaFieldText(f, v, state);
            if (!txt.length) continue;
            total++;
            if (parts.length < limit) {
                var label = String(f.label || k);
                parts.push(label + ':' + txt);
            }
        }
        if (!parts.length) return '';
        if (total > parts.length) parts.push('…+' + (total - parts.length));
        return parts.join(' / ');
    };

    EE.prototype.tooltipMainSchemaSummary = function(entry, code) {
        var schema = this.getEditorSchema(code);
        if (!schema || typeof schema.fromEntry !== 'function') return '';
        var st = null;
        try { st = schema.fromEntry.call(this, entry); } catch (_) { st = null; }
        return this.tooltipSchemaSummaryFromState(schema, st);
    };

    EE.prototype.tooltipRouteSchemaSummary = function(routeCmd) {
        var schema = this.getRouteEditorSchemaForCommand(routeCmd);
        if (!schema || typeof schema.fromRouteCommand !== 'function') return '';
        var st = null;
        try { st = schema.fromRouteCommand.call(this, routeCmd, null, -1); } catch (_) { st = null; }
        return this.tooltipSchemaSummaryFromState(schema, st);
    };

    EE.prototype.tooltipParamValueText = function(v, depth) {
        depth = Math.max(0, Math.floor(Number(depth || 0)));
        if (v == null) return 'null';
        var t = typeof v;
        if (t === 'string') return this.tooltipShortText(v, depth > 0 ? 32 : 48);
        if (t === 'number') {
            if (!isFinite(v)) return String(v);
            return (Math.floor(v) === v) ? String(v) : this.formatCoordText(v, 2, false);
        }
        if (t === 'boolean') return v ? 'on' : 'off';
        if (Array.isArray(v)) {
            if (!v.length) return '[]';
            var lim = (depth > 0) ? 2 : 3;
            var out = [];
            for (var i = 0; i < v.length && i < lim; i++) out.push(this.tooltipParamValueText(v[i], depth + 1));
            if (v.length > lim) out.push('…+' + (v.length - lim));
            return '[' + out.join(', ') + ']';
        }
        if (t === 'object') {
            var audio = this.tooltipAudioParamText(v);
            if (audio) return audio;
            if (v.list && Array.isArray(v.list) && (v.wait != null || v.repeat != null || v.skippable != null)) {
                var cnt = Math.max(0, v.list.length - 1);
                return '{wait:' + (v.wait ? 'on' : 'off') +
                    ', repeat:' + (v.repeat ? 'on' : 'off') +
                    ', skip:' + (v.skippable ? 'on' : 'off') +
                    ', cmds:' + cnt + '}';
            }
            var ks = Object.keys(v);
            if (!ks.length) return '{}';
            var maxK = (depth > 0) ? 2 : 3;
            var parts = [];
            for (var ki = 0; ki < ks.length && ki < maxK; ki++) {
                var k = ks[ki];
                parts.push(k + ':' + this.tooltipParamValueText(v[k], depth + 1));
            }
            if (ks.length > maxK) parts.push('…+' + (ks.length - maxK) + 'keys');
            return '{' + parts.join(', ') + '}';
        }
        return this.tooltipShortText(v, 40);
    };

    EE.prototype.tooltipParamsText = function(params) {
        var p = Array.isArray(params) ? params : [];
        if (!p.length) return '';
        if (p.length === 1) return this.tooltipParamValueText(p[0], 0);
        var lim = 3;
        var out = [];
        for (var i = 0; i < p.length && i < lim; i++) {
            out.push('p' + (i + 1) + ':' + this.tooltipParamValueText(p[i], 0));
        }
        if (p.length > lim) out.push('…+' + (p.length - lim));
        return out.join(' / ');
    };

    EE.prototype.commandTooltipDetailText = function(entry) {
        if (!entry || !entry.command) return '';
        var code = Number(entry.command.code || 0);
        var p = Array.isArray(entry.command.parameters) ? entry.command.parameters : [];
        var text = '';
        if (code === 101) {
            var ml = Array.isArray(entry.messageLines) ? entry.messageLines : [];
            text = ml.join(' / ');
        } else if (code === 108) {
            this.memoApplyParsedStateToEntry(entry);
            if (entry.isMemo) text = 'メモ[' + this.memoNormalizeSize(entry.memoSize) + '] ' + this.memoNormalizeText(entry.memoText);
            else {
                var cl = Array.isArray(entry.commentLines) ? entry.commentLines : [];
                if (!cl.length) cl = [String((p[0] || ''))];
                text = cl.join(' / ');
            }
        } else if (code === 102) {
            var choices = Array.isArray(p[0]) ? p[0] : [];
            text = '選択肢: ' + this.tooltipShortText(choices.join(' / '), 90);
        } else if (code === 103) {
            text = this.tooltipVariableLabel(Number(p[0] || 1)) + ' / 桁数:' + Math.max(1, Math.floor(Number(p[1] || 1)));
        } else if (code === 104) {
            var itType = Math.max(1, Math.min(4, Math.floor(Number(p[1] || 2))));
            var itTypeText = { 1: '通常アイテム', 2: '大事なもの', 3: '隠しA', 4: '隠しB' }[itType] || String(itType);
            text = this.tooltipVariableLabel(Number(p[0] || 1)) + ' / 種別:' + itTypeText;
        } else if (code === 105) {
            var slines = Array.isArray(entry.scrollLines) ? entry.scrollLines : [];
            text = slines.join(' / ');
        } else if (code === 121) {
            var s1 = Math.max(1, Math.floor(Number(p[0] || 1)));
            var s2 = Math.max(s1, Math.floor(Number(p[1] || s1)));
            var sv = Math.floor(Number(p[2] || 0)) === 0 ? 'ON' : 'OFF';
            if (s1 === s2) text = 'ID' + this.tooltipVarIdText(s1) + ' ' + this.switchNameById(s1) + ' = ' + sv;
            else text = 'ID' + this.tooltipVarIdText(s1) + '〜ID' + this.tooltipVarIdText(s2) + ' = ' + sv;
        } else if (code === 122) {
            text = this.tooltipVariableOperationText(p);
        } else if (code === 123) {
            text = 'セルフスイッチ ' + String(p[0] || 'A') + ' = ' + (Math.floor(Number(p[1] || 0)) === 0 ? 'ON' : 'OFF');
        } else if (code === 124) {
            var tmOp = Math.floor(Number(p[0] || 0));
            text = (tmOp === 0 ? '開始' : '停止') + (tmOp === 0 ? (' ' + Math.max(0, Math.floor(Number(p[1] || 0))) + '秒') : '');
        } else if (code === 125) {
            var gOp = Math.floor(Number(p[0] || 0));
            var gVal = this.tooltipOperandText(Number(p[1] || 0), p, 2, 2);
            text = '所持金 ' + (gOp === 0 ? '+=' : '-=') + ' ' + gVal;
        } else if (code === 126 || code === 127 || code === 128) {
            var db = (code === 126) ? $dataItems : (code === 127 ? $dataWeapons : $dataArmors);
            var kind = (code === 126) ? 'アイテム' : (code === 127 ? '武器' : '防具');
            var nm = this.tooltipDbNameById(db, Number(p[0] || 0));
            var op = Math.floor(Number(p[1] || 0));
            var val = this.tooltipOperandText(Number(p[2] || 0), p, 3, 3);
            text = kind + ' ' + nm + ' ' + (op === 0 ? '+=' : '-=') + ' ' + val;
        } else if (code === 129) {
            var actorId = Math.max(1, Math.floor(Number(p[0] || 1)));
            var actorNm = this.tooltipDbNameById($dataActors, actorId);
            text = 'アクター ' + actorNm + ' (' + actorId + ') ' + (Math.floor(Number(p[1] || 0)) === 0 ? '加入' : '離脱');
        } else if (code === 201) {
            text = this.tooltipTransferText(p);
        } else if (code === 355) {
            var cam = this.cameraMoveSpecFromEntry(entry);
            if (cam) {
                text = 'x:' + this.formatCoordText(cam.x, 2, false) +
                    ' y:' + this.formatCoordText(cam.y, 2, false) +
                    ' d:' + Math.max(1, Math.floor(Number(cam.d || 1))) + 'f';
            } else {
                var anim = this.animationRequestSpecFromEntry(entry);
                if (anim) {
                    var anmName = this.tooltipDbNameById($dataAnimations, Number(anim.animationId || 1));
                    text = '対象:' + this.rowLabelForCharId(this.normalizeMoveTarget(Number(anim.targetId || 0))) +
                        ' / アニメ:' + anmName + ' (' + Math.max(1, Math.floor(Number(anim.animationId || 1) || 1)) + ')' +
                        ' / addX:' + this.formatCoordText(Number(anim.addX || 0), 2, false) +
                        ' / addY:' + this.formatCoordText(Number(anim.addY || 0), 2, false) +
                        ' / scale:' + this.formatCoordText(Number(anim.scale == null ? 1 : anim.scale), 2, false);
                } else {
                    var sl = Array.isArray(entry.scriptLines) ? entry.scriptLines : [];
                    if (!sl.length && p.length) sl = [String(p[0] || '')];
                    text = sl.join(' / ');
                }
            }
        } else if (code === 230) {
            text = Math.max(1, Math.floor(Number(p[0] || 1))) + 'フレーム';
        } else if (code === 241) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 242) {
            text = this.formatCoordText(Math.max(0, Number(p[0] || 0)), 1, false) + '秒';
        } else if (code === 245) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 246) {
            text = this.formatCoordText(Math.max(0, Number(p[0] || 0)), 1, false) + '秒';
        } else if (code === 249) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 250) {
            text = this.tooltipAudioParamText(p[0] || {});
        } else if (code === 261) {
            text = this.tooltipShortText(String(p[0] || ''), 80);
        } else if (code === 356) {
            text = String(p[0] || '');
        } else if (code === 205) {
            var target = this.rowLabelForCharId(this.normalizeMoveTarget(Number(p[0] || 0)));
            var route = (p[1] && typeof p[1] === 'object') ? p[1] : null;
            var cmds = route && Array.isArray(route.list) ? Math.max(0, route.list.length - 1) : 0;
            text = '対象:' + target + (route ? ' / 完了までウェイト:' + (route.wait ? 'ON' : 'OFF') + ' / コマンド数:' + cmds : '');
        } else {
            text = this.tooltipMainSchemaSummary(entry, code);
            if (!text.length) {
                var generic = this.tooltipParamsText(p);
                text = generic ? ('引数: ' + generic) : '';
            }
        }
        text = String(text || '').replace(/\r?\n/g, ' / ').trim();
        if (text.length > 120) text = text.slice(0, 117) + '...';
        return text;
    };

    EE.prototype.commandTooltipItemsAtFrame = function(frame, highlightUid, opt) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands) return [];
        opt = opt || {};
        var rows = this._rows || [];
        var rm = {};
        for (var i = 0; i < rows.length; i++) rm[rows[i].key] = i;
        var ls = tr.commands.filter(function(e) {
            return !e.isComment && Number(e.frame || 0) === Number(frame || 0);
        });
        ls.sort(function(a, b) {
            var ra = rm[a.rowKey || 'main']; if (ra == null) ra = 999;
            var rb = rm[b.rowKey || 'main']; if (rb == null) rb = 999;
            if (ra !== rb) return ra - rb;
            return a.uid - b.uid;
        });
        var out = [];
        for (i = 0; i < ls.length; i++) {
            var e = ls[i];
            if (opt.excludeMoveRoute205 && e.command && Number(e.command.code || 0) === 205) continue;
            var nm = this.commandNameJa(this.mainCommandDisplayCodeForEntry(e));
            if (e.command && e.command.code === 205) nm += ' [' + this.rowLabelForCharId(this.normalizeMoveTarget(e.charId)) + ']';
            var dim = !!highlightUid && Number(e.uid) !== Number(highlightUid);
            out.push({ text: '・' + nm, dim: dim });
            var detail = this.commandTooltipDetailText(e);
            if (detail) out.push({ text: '  ' + detail, dim: dim, detail: true });
        }
        return out;
    };

    EE.prototype.findEntryInSelectedTrack = function(uid) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands || !uid) return null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === uid) return tr.commands[i];
        }
        return null;
    };

    EE.prototype.routeCommandNameJa = function(code) {
        var c = Number(code || 0);
        if (!this._routeCommandNameCache) {
            this._routeCommandNameCache = {};
            var cat = this.routeCommandCatalog();
            var cols = [cat.left, cat.mid, cat.right];
            for (var ci = 0; ci < cols.length; ci++) {
                var list = Array.isArray(cols[ci]) ? cols[ci] : [];
                for (var li = 0; li < list.length; li++) {
                    var it = list[li];
                    var ic = Number(it && it.code || 0);
                    if (!ic || this._routeCommandNameCache[ic]) continue;
                    var nm = String(it && it.label || '').replace(/\.\.\.$/, '');
                    if (nm) this._routeCommandNameCache[ic] = nm;
                }
            }
        }
        if (this._routeCommandNameCache[c]) return String(this._routeCommandNameCache[c]);
        if (c === 0) return '移動ルート終了';
        return '移動コマンド' + c;
    };

    EE.prototype.routeCommandTooltipDetailText = function(routeCmd) {
        if (!routeCmd) return '';
        var code = Number(routeCmd.code || 0);
        var p = Array.isArray(routeCmd.parameters) ? routeCmd.parameters : [];
        var text = '';
        if (code === 45) {
            var dcode = this.routeDisplayCodeForCommand(routeCmd);
            if (dcode === 4500) return '';
            if (dcode !== 45) {
                text = this.tooltipRouteSchemaSummary(routeCmd);
            } else {
                text = String(p[0] || '');
            }
        } else {
            text = this.tooltipRouteSchemaSummary(routeCmd);
            if (!text.length) text = this.tooltipParamsText(p);
        }
        text = String(text || '').replace(/\r?\n/g, ' / ').trim();
        if (text.length > 120) text = text.slice(0, 117) + '...';
        return text;
    };

    EE.prototype.routeTileGotoTooltipText = function(entry, listIndex, spanFrames) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return '';
        var route = entry.command.parameters && entry.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.floor(Number(listIndex == null ? -1 : listIndex));
        if (idx < 0 || idx >= list.length) return '';
        var p = this.parseRouteTileGotoCommand(list[idx]);
        if (!p) return '';
        var wf = (spanFrames == null) ? this.routeTileGotoWaitFrames(entry, idx) : Math.max(1, Math.floor(Number(spanFrames || 1)));
        return '(' + this.tileMoveCoordText(p.x) + ', ' + this.tileMoveCoordText(p.y) + ') wait:' + wf + 'f';
    };

    EE.prototype.routeCommandFromHit = function(hit) {
        if (!hit || hit.routeCmdCode == null) return null;
        var e = this.findEntryInSelectedTrack(hit.uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return null;
        var route = e.command.parameters && e.command.parameters[1];
        var list = route && Array.isArray(route.list) ? route.list : [];
        var idx = Math.floor(Number(hit.routeListIndex == null ? -1 : hit.routeListIndex));
        if (idx < 0 || idx >= list.length) return null;
        var rc = list[idx];
        if (!rc || Number(rc.code || 0) <= 0) return null;
        return rc;
    };

    EE.prototype.routeTimelineItemAtFrame = function(entry, frame) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return null;
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var items = tl && Array.isArray(tl.items) ? tl.items : [];
        var baseFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var rc = it && it.command ? it.command : null;
            if (!rc) continue;
            var rawCode = Number((it && it.displayCode != null) ? it.displayCode : (rc.code || 0));
            var effectiveCode = (rawCode > 0) ? rawCode : this.routeDisplayCodeForCommand(rc);
            if (effectiveCode <= 0 || effectiveCode === 15) continue;
            var st = baseFrame + Math.max(0, Math.floor(Number(it.offset || 0)));
            var sp = Math.max(1, Math.floor(Number(it.span || 1)));
            if (frame < st || frame >= (st + sp)) continue;
            return {
                listIndex: Math.floor(Number(it.listIndex == null ? -1 : it.listIndex)),
                frame: st,
                routeCmdCode: effectiveCode
            };
        }
        return null;
    };

    EE.prototype.routeTooltipLinesFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return [];
        var route = entry.command.parameters && entry.command.parameters[1];
        var tl = this.moveRouteTimeline(route);
        var list = tl.items || [];
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            var rc = it && it.command ? it.command : null;
            var rcode = Number((it && it.displayCode != null) ? it.displayCode : ((rc && rc.code) || 0));
            if (!rc || rcode === 0 || rcode === 15) continue;
            out.push({ text: '・+' + Number(it.offset || 0) + 'f ' + this.routeCommandNameJa(rcode), dim: false });
            var detail = '';
            if (rcode === 4500) detail = this.routeTileGotoTooltipText(entry, it.listIndex, it.span);
            else detail = this.routeCommandTooltipDetailText(rc);
            if (detail) out.push({ text: '  ' + detail, dim: false, detail: true });
        }
        if (!out.length) out.push({ text: '・(移動ルート内コマンドなし)', dim: false });
        return out;
    };

    EE.prototype.commandTooltipLinesForHit = function(hit) {
        if (!hit) return [];
        if (hit.isEndMarker) {
            return [
                { text: '終了', dim: false },
                { text: 'frame: ' + Math.max(0, Math.floor(Number(hit.frame || 0))), dim: false, detail: true }
            ];
        }
        var routeOwnerLabel = '';
        var routeOwnerUid = 0;
        if (hit.routeRangeUid != null && Number(hit.routeRangeUid || 0) > 0) {
            routeOwnerUid = Number(hit.routeRangeUid || 0);
        } else if (hit.routeCmdCode != null || (hit.routeListIndex != null && Number(hit.routeListIndex || -1) >= 0)) {
            routeOwnerUid = Number(hit.uid || 0);
        }
        if (routeOwnerUid > 0) {
            var routeOwnerEntry = this.findEntryInSelectedTrack(routeOwnerUid);
            if (routeOwnerEntry && routeOwnerEntry.command && Number(routeOwnerEntry.command.code || 0) === 205) {
                var routeOwnerCharId = (routeOwnerEntry.charId == null)
                    ? Number((((routeOwnerEntry.command || {}).parameters || [0])[0] || 0))
                    : Number(routeOwnerEntry.charId || 0);
                routeOwnerLabel = this.rowLabelForCharId(this.normalizeMoveTarget(routeOwnerCharId));
            }
        }
        if (hit.routeCmdCode != null) {
            if (Number(hit.routeCmdCode || 0) === 15) return [];
            var out = [{ text: '・' + this.routeCommandNameJa(hit.routeCmdCode), dim: false }];
            var routeCmd = this.routeCommandFromHit(hit);
            var detail = '';
            if (Number(hit.routeCmdCode || 0) === 4500) {
                var e2 = this.findEntryInSelectedTrack(hit.uid);
                detail = this.routeTileGotoTooltipText(e2, hit.routeListIndex, null);
            } else {
                detail = this.routeCommandTooltipDetailText(routeCmd);
            }
            if (detail) out.push({ text: '  ' + detail, dim: false, detail: true });
            if (routeOwnerLabel) out.unshift({ text: routeOwnerLabel, dim: false });
            return out;
        }
        var e = this.findEntryInSelectedTrack(hit.uid);
        if (e && e.rowType === 'char' && e.command && Number(e.command.code || 0) === 205) {
            var routeOut = this.routeTooltipLinesFromEntry(e);
            if (!routeOwnerLabel) {
                var eCharId = (e.charId == null)
                    ? Number((((e.command || {}).parameters || [0])[0] || 0))
                    : Number(e.charId || 0);
                routeOwnerLabel = this.rowLabelForCharId(this.normalizeMoveTarget(eCharId));
            }
            if (routeOwnerLabel) routeOut.unshift({ text: routeOwnerLabel, dim: false });
            return routeOut;
        }
        return this.commandTooltipItemsAtFrame(hit.frame, hit.uid, { excludeMoveRoute205: hit.rowKey === 'main' });
    };

    EE.prototype.commentTooltipLinesAtFrame = function(frame) {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !tr.commands) return [];
        var ls = tr.commands.filter(function(e) {
            return !!e.isComment && Number(e.frame || 0) === Number(frame || 0);
        });
        ls.sort(function(a, b) { return a.uid - b.uid; });
        var out = [];
        for (var i = 0; i < ls.length; i++) {
            var e = ls[i];
            this.memoApplyParsedStateToEntry(e);
            if (e.isMemo) {
                out.push('メモ[' + this.memoNormalizeSize(e.memoSize) + ']');
                out.push(this.memoNormalizeText(e.memoText || ''));
            } else {
                out.push('注釈 ' + (i + 1));
                out.push((e.commentLines || ['']).join('\n'));
            }
            if (i !== ls.length - 1) out.push('');
        }
        return out;
    };

    EE.prototype.wrapCanvasTextByWidth = function(ctx, text, maxWidth) {
        text = String(text == null ? '' : text);
        maxWidth = Math.max(8, Number(maxWidth || 120));
        if (!text.length) return [''];
        var out = [];
        var cur = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (ch === '\r') continue;
            if (ch === '\n') {
                out.push(cur);
                cur = '';
                continue;
            }
            var next = cur + ch;
            if (ctx.measureText(next).width <= maxWidth || !cur.length) {
                cur = next;
            } else {
                out.push(cur);
                cur = ch;
            }
        }
        out.push(cur);
        return out;
    };

    EE.prototype.drawMemoLabelOnTimeline = function(ctx, x, y, size, text) {
        if (!ctx) return;
        text = this.memoNormalizeText(text);
        if (!text.length) return;
        size = this.memoNormalizeSize(size);
        if (size === 'S') return;
        var fontSize = (size === 'L') ? 12 : 10;
        var maxWidth = (size === 'L') ? 180 : 120;
        ctx.save();
        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        var lines = this.wrapCanvasTextByWidth(ctx, text, maxWidth);
        var lineH = fontSize + 2;
        var widest = 0;
        for (var i = 0; i < lines.length; i++) {
            widest = Math.max(widest, Math.ceil(ctx.measureText(lines[i]).width));
        }
        var padX = 4;
        var padY = 3;
        var boxW = widest + padX * 2;
        var boxH = lines.length * lineH + padY * 2;
        var bx = Math.floor(x - boxW / 2);
        var offsetY = (size === 'L') ? -60 : -40;
        var by = Math.floor(y + offsetY);
        // Allow requested offset even near the top of timeline.
        // Keep only a very loose clamp so the box can still be mostly visible.
        var minY = -boxH + 2;
        if (by < minY) by = minY;
        ctx.fillStyle = 'rgba(8,16,12,.72)';
        ctx.strokeStyle = 'rgba(70,178,98,.52)';
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeRect(bx + 0.5, by + 0.5, Math.max(1, boxW - 1), Math.max(1, boxH - 1));
        ctx.fillStyle = 'rgba(214,255,220,.98)';
        for (i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx + padX, by + padY + fontSize + i * lineH);
        }
        ctx.restore();
    };

    EE.prototype.renderMemoLabelOverlay = function(items) {
        if (!this.memoLabelLayer || !this.timelineWrap || !this.timeline) return;
        items = Array.isArray(items) ? items : [];
        if (!items.length) {
            if (this.memoLabelLayer.childNodes && this.memoLabelLayer.childNodes.length) this.memoLabelLayer.innerHTML = '';
            this._memoLabelLayerSig = '';
            return;
        }
        var wrap = this.timelineWrap;
        var cv = this.timeline;
        var wr = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : null;
        var cr = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!wr || !cr) return;
        var sig = String(Math.floor(cr.left)) + '|' + String(Math.floor(cr.top)) + '|' +
            String(Math.floor(Number(wrap.scrollLeft || 0))) + '|' + String(Math.floor(Number(wrap.scrollTop || 0))) + '|';
        var i;
        for (i = 0; i < items.length; i++) {
            var it = items[i] || {};
            sig += [Number(it.x || 0), Number(it.y || 0), String(it.size || ''), String(it.text || '')].join(':') + '|';
        }
        if (sig === this._memoLabelLayerSig) return;
        this._memoLabelLayerSig = sig;
        this.memoLabelLayer.innerHTML = '';
        for (i = 0; i < items.length; i++) {
            var m = items[i] || {};
            var sz = this.memoNormalizeSize(m.size);
            if (sz === 'S') continue;
            var txt = this.memoNormalizeText(m.text || '');
            if (!txt.length) continue;
            var dotX = Number(m.x || 0);
            var dotY = Number(m.y || 0);
            // cr already reflects wrap scroll; no extra scroll offset is needed here.
            var sx = cr.left + dotX;
            var sy = cr.top + dotY;
            var offsetY = (sz === 'L') ? -60 : -40;
            var b = this.el('div', 'mmlbl ' + (sz === 'L' ? 'l' : 'm'));
            b.textContent = txt;
            b.style.left = Math.floor(sx) + 'px';
            b.style.top = Math.floor(sy + offsetY) + 'px';
            b.style.transform = 'translateX(-50%)';
            this.memoLabelLayer.appendChild(b);
        }
    };

    EE.prototype.collectLargeMemoMarkersForSelectedTrack = function() {
        var out = [];
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return out;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e || !e.isComment) continue;
            this.memoApplyParsedStateToEntry(e);
            if (!e.isMemo) continue;
            if (this.memoNormalizeSize(e.memoSize) !== 'L') continue;
            out.push({
                uid: Math.floor(Number(e.uid || 0)),
                frame: Math.max(0, Math.floor(Number(e.frame || 0))),
                text: this.memoNormalizeText(e.memoText || '')
            });
        }
        out.sort(function(a, b) {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return a.uid - b.uid;
        });
        return out;
    };

    EE.prototype.refreshMemoScrollLane = function(maxFrame) {
        if (!this.memoScrollLane || !this.timelineWrap) return;
        var lane = this.memoScrollLane;
        var markers = this.collectLargeMemoMarkersForSelectedTrack();
        if (!markers.length) {
            lane.style.display = 'none';
            if (lane.childNodes && lane.childNodes.length) lane.innerHTML = '';
            this._memoScrollLaneSig = '';
            return;
        }
        var wr = this.timelineWrap.getBoundingClientRect ? this.timelineWrap.getBoundingClientRect() : null;
        if (!wr || wr.width <= 4 || wr.height <= 8) {
            lane.style.display = 'none';
            return;
        }
        var left = Math.floor(wr.left + 2);
        var top = Math.floor(wr.bottom - 10);
        var width = Math.max(8, Math.floor(wr.width - 4));
        var height = 8;
        maxFrame = Math.max(1, Math.floor(Number(maxFrame || this.maxFrame() || 1)));
        var sig = String(left) + '|' + String(top) + '|' + String(width) + '|' + String(maxFrame) + '|';
        for (var i = 0; i < markers.length; i++) {
            sig += markers[i].uid + ':' + markers[i].frame + ':' + markers[i].text + '|';
        }
        lane.style.display = 'block';
        lane.style.left = left + 'px';
        lane.style.top = top + 'px';
        lane.style.width = width + 'px';
        lane.style.height = height + 'px';
        if (sig === this._memoScrollLaneSig) return;
        this._memoScrollLaneSig = sig;
        lane.innerHTML = '';
        var self = this;
        for (i = 0; i < markers.length; i++) {
            (function(m) {
                var dot = self.el('div', 'mmdot');
                var ratio = Math.max(0, Math.min(1, Number(m.frame || 0) / maxFrame));
                dot.style.left = Math.floor(ratio * (width - 2) + 1) + 'px';
                dot.style.top = '4px';
                dot.addEventListener('mouseenter', function(ev) {
                    self.showTipAt(ev.clientX || (left + 8), ev.clientY || (top - 8), m.text || '');
                });
                dot.addEventListener('mousemove', function(ev) {
                    self.showTipAt(ev.clientX || (left + 8), ev.clientY || (top - 8), m.text || '');
                });
                dot.addEventListener('mouseleave', function() {
                    self.showTipAt(0, 0, '');
                });
                dot.addEventListener('mousedown', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                dot.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    // Reuse existing "select + smooth reveal" behavior.
                    self.focusExecutionLogTarget(Number(m.uid || 0), -1);
                    self.showTipAt(0, 0, '');
                });
                lane.appendChild(dot);
            })(markers[i]);
        }
    };

    EE.prototype.routeOptionsFromEntry = function(entry) {
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return null;
        var route = entry.command.parameters && entry.command.parameters[1];
        if (!route || typeof route !== 'object') return null;
        return route;
    };

    EE.prototype.isMoveRouteWaitEnabledEntry = function(entry) {
        var route = this.routeOptionsFromEntry(entry);
        return !!(route && route.wait);
    };

    EE.prototype.isMoveRouteWaitDisabledEntry = function(entry) {
        var route = this.routeOptionsFromEntry(entry);
        // In event data, route.wait may be omitted (undefined) which is
        // effectively OFF. Treat anything other than explicit true as wait:OFF.
        return !!(route && route.wait !== true);
    };

    EE.prototype.collectMoveRouteWaitRanges = function(tr, ignoreUid) {
        var out = [];
        if (!tr || !Array.isArray(tr.commands)) return out;
        ignoreUid = Number(ignoreUid || 0);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (ignoreUid > 0 && Number(e.uid || 0) === ignoreUid) continue;
            if (!this.isMoveRouteWaitEnabledEntry(e)) continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            if (w <= 0) continue;
            out.push({
                uid: Number(e.uid || 0),
                start: s,
                end: s + w,
                charId: Number(e.charId || 0)
            });
        }
        return out;
    };

    EE.prototype.isIntervalLockedByMoveRouteWait = function(tr, frame, end, ignoreUid) {
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        end = Math.max(frame + 1, Math.floor(Number(end == null ? (frame + 1) : end)));
        var ranges = this.collectMoveRouteWaitRanges(tr, ignoreUid);
        for (var i = 0; i < ranges.length; i++) {
            var r = ranges[i];
            var rs = Math.max(0, Math.floor(Number(r.start || 0)));
            var re = Math.max(rs + 1, Math.floor(Number(r.end == null ? (rs + 1) : r.end)));
            // Allow placement at the route start frame (before execution),
            // but keep the interval after start locked.
            var lockStart = rs + 1;
            if (lockStart < re && frame < re && lockStart < end) return true;
        }
        return false;
    };

    EE.prototype.hasMainCommandInRange = function(tr, frame, end, ignoreUid) {
        if (!tr || !Array.isArray(tr.commands)) return false;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        end = Math.max(frame + 1, Math.floor(Number(end == null ? (frame + 1) : end)));
        ignoreUid = Number(ignoreUid || 0);
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (ignoreUid > 0 && Number(e.uid || 0) === ignoreUid) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var s = Math.max(0, Math.floor(Number(e.frame || 0)));
            var w = Math.max(0, Math.floor(Number(e.wait || 0)));
            var ed = s + w;
            if (w > 0) {
                var ms = s + 1;
                if (ms < ed && frame < ed && ms < end) return true;
            } else {
                if (s > frame && s < end) return true;
            }
        }
        return false;
    };

    EE.prototype.canPlaceEntry = function(tr, entry, frame, rowKey, ignoreUid) {
        if (!tr || !entry) return false;
        if (entry.rowType === 'main' && rowKey !== 'main') return false;
        if (entry.rowType === 'char' && (!rowKey || rowKey.indexOf('char:') !== 0)) return false;
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        var end = frame + Math.max(0, Math.floor(Number(entry.wait || 0)));
        var endEx = (Math.max(0, Math.floor(Number(entry.wait || 0))) > 0) ? end : (frame + 1);
        if (rowKey === 'main' && this.isIntervalLockedByMoveRouteWait(tr, frame, endEx, ignoreUid)) return false;
        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitEnabledEntry(entry) && this.hasMainCommandInRange(tr, frame, end, ignoreUid)) return false;
        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitDisabledEntry(entry)) {
            var routeRuntimeStart = frame;
            var routeRuntimeEnd = routeRuntimeStart + this.routeExecutionSpanFramesForEntry(entry);
            for (var ri = 0; ri < tr.commands.length; ri++) {
                var re = tr.commands[ri];
                if (!re) continue;
                if (ignoreUid > 0 && Number(re.uid || 0) === ignoreUid) continue;
                if (!this.isMoveRouteWaitDisabledEntry(re)) continue;
                var rrk = re.rowKey || (re.rowType === 'char' ? ('char:' + re.charId) : 'main');
                if (String(rrk) !== rowKey) continue;
                var rs = Math.max(0, Math.floor(Number(re.frame || 0)));
                var red = rs + this.routeExecutionSpanFramesForEntry(re);
                if (routeRuntimeStart < red && rs < routeRuntimeEnd) return false;
            }
        }
        for (var i = 0; i < tr.commands.length; i++) {
            var o = tr.commands[i];
            if (!o || o.uid === ignoreUid) continue;
            var ork = o.rowKey || (o.rowType === 'char' ? ('char:' + o.charId) : 'main');
            if (ork !== rowKey) continue;
            var os = Math.max(0, Math.floor(Number(o.frame || 0)));
            var ow = Math.max(0, Math.floor(Number(o.wait || 0)));
            var oe = os + ow;
            if (entry.wait > 0) {
                if (ow > 0) {
                    if (frame < oe && os < end) return false;
                } else {
                    // Non-wait commands at the same frame can run before this wait command.
                    if (os > frame && os < end) return false;
                }
            } else {
                if (ow > 0) {
                    // Allow same-frame placement; wait command executes last on that frame.
                    if (frame > os && frame < oe) return false;
                }
            }
        }
        return true;
    };

    EE.prototype.entryConflictDebugInfo = function(e) {
        if (!e) return null;
        var cmd = e.command || {};
        var code = Math.floor(Number(cmd.code || 0));
        var p = Array.isArray(cmd.parameters) ? cmd.parameters : [];
        var info = {
            uid: Math.floor(Number(e.uid || 0)),
            eventId: Math.floor(Number(e.eventId || 0)),
            pageIndex: Math.floor(Number(e.pageIndex || 0)),
            rowType: String(e.rowType || ''),
            rowKey: String(e.rowKey || ''),
            charId: (e.charId == null) ? null : Math.floor(Number(e.charId || 0)),
            frame: Math.max(0, Math.floor(Number(e.frame || 0))),
            wait: Math.max(0, Math.floor(Number(e.wait || 0))),
            code: code,
            commandName: (typeof this.commandNameJa === 'function') ? String(this.commandNameJa(code) || '') : ''
        };
        if (code === 205) {
            var route = p[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            info.route = {
                targetId: Math.floor(Number(p[0] || 0)),
                wait: !!(route && route.wait),
                repeat: !!(route && route.repeat),
                skippable: !!(route && route.skippable),
                listLength: list.length
            };
        }
        return info;
    };

    EE.prototype.collectCanPlaceEntryConflicts = function(tr, entry, frame, rowKey, ignoreUid) {
        var out = {
            ok: true,
            reasons: [],
            blockers: [],
            overlap: {
                attemptStart: 0,
                attemptEnd: 0,
                attemptEndExclusive: 0
            }
        };
        if (!tr || !entry) {
            out.ok = false;
            out.reasons.push('invalid_input');
            return out;
        }
        frame = Math.max(0, Math.floor(Number(frame || 0)));
        rowKey = String(rowKey || '');
        ignoreUid = Math.floor(Number(ignoreUid || 0));
        var wait = Math.max(0, Math.floor(Number(entry.wait || 0)));
        var end = frame + wait;
        var endEx = (wait > 0) ? end : (frame + 1);
        out.overlap.attemptStart = frame;
        out.overlap.attemptEnd = end;
        out.overlap.attemptEndExclusive = endEx;

        if (entry.rowType === 'main' && rowKey !== 'main') {
            out.ok = false;
            out.reasons.push('row_type_main_mismatch');
        }
        if (entry.rowType === 'char' && (!rowKey || rowKey.indexOf('char:') !== 0)) {
            out.ok = false;
            out.reasons.push('row_type_char_mismatch');
        }

        if (rowKey === 'main') {
            var ranges = this.collectMoveRouteWaitRanges(tr, ignoreUid);
            for (var i = 0; i < ranges.length; i++) {
                var rg = ranges[i];
                var rs = Math.max(0, Math.floor(Number(rg.start || 0)));
                var re = Math.max(rs + 1, Math.floor(Number(rg.end == null ? (rs + 1) : rg.end)));
                var lockStart = rs + 1;
                if (!(lockStart < re && frame < re && lockStart < endEx)) continue;
                out.ok = false;
                out.reasons.push('locked_by_route_wait');
                var be = this.findEntryInSelectedTrack(Number(rg.uid || 0));
                out.blockers.push({
                    type: 'route_wait_lock',
                    lockStart: lockStart,
                    lockEnd: re,
                    charId: Math.floor(Number(rg.charId || 0)),
                    blocker: this.entryConflictDebugInfo(be)
                });
            }
        }

        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitEnabledEntry(entry)) {
            for (var j = 0; j < tr.commands.length; j++) {
                var mc = tr.commands[j];
                if (!mc) continue;
                if (ignoreUid > 0 && Number(mc.uid || 0) === ignoreUid) continue;
                var mrk = mc.rowKey || (mc.rowType === 'char' ? ('char:' + mc.charId) : 'main');
                if (mrk !== 'main') continue;
                var ms = Math.max(0, Math.floor(Number(mc.frame || 0)));
                var mw = Math.max(0, Math.floor(Number(mc.wait || 0)));
                var med = ms + mw;
                var hit = false;
                if (mw > 0) {
                    var mws = ms + 1;
                    if (mws < med && frame < med && mws < end) hit = true;
                } else {
                    if (ms > frame && ms < end) hit = true;
                }
                if (!hit) continue;
                out.ok = false;
                out.reasons.push('route_wait_hits_main');
                out.blockers.push({
                    type: 'main_command_overlap_with_route_wait',
                    overlapStart: frame,
                    overlapEnd: end,
                    blocker: this.entryConflictDebugInfo(mc)
                });
            }
        }

        if (rowKey.indexOf('char:') === 0 && this.isMoveRouteWaitDisabledEntry(entry)) {
            var runStart = frame;
            var runEnd = runStart + this.routeExecutionSpanFramesForEntry(entry);
            for (j = 0; j < tr.commands.length; j++) {
                var rc = tr.commands[j];
                if (!rc) continue;
                if (ignoreUid > 0 && Number(rc.uid || 0) === ignoreUid) continue;
                if (!this.isMoveRouteWaitDisabledEntry(rc)) continue;
                var rrk = rc.rowKey || (rc.rowType === 'char' ? ('char:' + rc.charId) : 'main');
                if (String(rrk) !== rowKey) continue;
                var rcs = Math.max(0, Math.floor(Number(rc.frame || 0)));
                var rce = rcs + this.routeExecutionSpanFramesForEntry(rc);
                if (!(runStart < rce && rcs < runEnd)) continue;
                out.ok = false;
                out.reasons.push('same_char_route_wait_false_overlap');
                out.blockers.push({
                    type: 'same_char_route_wait_false_overlap',
                    overlapStart: Math.max(runStart, rcs),
                    overlapEnd: Math.min(runEnd, rce),
                    blockerRangeStart: rcs,
                    blockerRangeEnd: rce,
                    blocker: this.entryConflictDebugInfo(rc)
                });
            }
        }

        for (var k = 0; k < tr.commands.length; k++) {
            var o = tr.commands[k];
            if (!o) continue;
            if (ignoreUid > 0 && Number(o.uid || 0) === ignoreUid) continue;
            var ork = o.rowKey || (o.rowType === 'char' ? ('char:' + o.charId) : 'main');
            if (String(ork) !== rowKey) continue;
            var os = Math.max(0, Math.floor(Number(o.frame || 0)));
            var ow = Math.max(0, Math.floor(Number(o.wait || 0)));
            var oe = os + ow;
            var collide = false;
            var ctype = '';
            if (wait > 0) {
                if (ow > 0) {
                    if (frame < oe && os < end) {
                        collide = true;
                        ctype = 'same_row_wait_vs_wait';
                    }
                } else if (os > frame && os < end) {
                    collide = true;
                    ctype = 'same_row_wait_vs_instant';
                }
            } else if (ow > 0) {
                if (frame > os && frame < oe) {
                    collide = true;
                    ctype = 'same_row_instant_inside_wait';
                }
            }
            if (!collide) continue;
            out.ok = false;
            out.reasons.push(ctype);
            out.blockers.push({
                type: ctype,
                blockerRangeStart: os,
                blockerRangeEnd: oe,
                blocker: this.entryConflictDebugInfo(o)
            });
        }

        if (out.ok) return out;
        var uniq = Object.create(null);
        var compactReasons = [];
        for (var ri = 0; ri < out.reasons.length; ri++) {
            var rk2 = String(out.reasons[ri] || '');
            if (!rk2 || uniq[rk2]) continue;
            uniq[rk2] = true;
            compactReasons.push(rk2);
        }
        out.reasons = compactReasons;
        return out;
    };

    EE.prototype.logDropConflictDetail = function(tr, entry, frame, rowKey, ignoreUid, context) {
        var payload = {
            tag: 'drop_conflict',
            context: String(context || ''),
            mapId: ($gameMap && typeof $gameMap.mapId === 'function') ? Math.floor(Number($gameMap.mapId() || 0)) : 0,
            selected: {
                selEid: Math.floor(Number(this.selEid || 0)),
                selPage: Math.floor(Number(this.selPage == null ? -1 : this.selPage)),
                selKey: String(this.selKey || ''),
                selUid: Math.floor(Number(this.selUid || 0)),
                selRouteListIndex: this.nodeRouteIndex(this.selRouteListIndex),
                frame: Math.max(0, Math.floor(Number(this.frame || 0)))
            },
            attempt: {
                frame: Math.max(0, Math.floor(Number(frame || 0))),
                rowKey: String(rowKey || ''),
                ignoreUid: Math.floor(Number(ignoreUid || 0)),
                entry: this.entryConflictDebugInfo(entry)
            },
            track: {
                eventId: Math.floor(Number(tr && tr.eventId || 0)),
                pageIndex: Math.floor(Number(tr && tr.pageIndex || 0)),
                commandCount: Array.isArray(tr && tr.commands) ? tr.commands.length : 0
            }
        };
        payload.conflict = this.collectCanPlaceEntryConflicts(tr, entry, frame, rowKey, ignoreUid);
        try {
            console.log('[EE_DROP_CONFLICT] ' + JSON.stringify(payload));
        } catch (_) {
            try { console.log('[EE_DROP_CONFLICT]', payload); } catch (_) {}
        }
    };

    EE.prototype.buildMainLaneMap = function(tr) {
        var laneByUid = {};
        var maxStack = 1;
        if (!tr || !tr.commands) return { laneByUid: laneByUid, maxStack: maxStack };
        var byFrame = {};
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            // Comments are drawn in a separate marker lane, so they must not
            // consume main command stack slots.
            if (e.isComment || (e.command && Number(e.command.code || 0) === 108)) continue;
            var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
            if (rk !== 'main') continue;
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (!byFrame[f]) byFrame[f] = [];
            byFrame[f].push(e);
        }
        var frames = Object.keys(byFrame).map(function(v) { return Number(v); }).sort(function(a, b) { return a - b; });
        for (var j = 0; j < frames.length; j++) {
            var ls = byFrame[frames[j]];
            ls.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
            for (var k = 0; k < ls.length; k++) laneByUid[ls[k].uid] = k;
            if (ls.length > maxStack) maxStack = ls.length;
        }
        return { laneByUid: laneByUid, maxStack: Math.max(1, maxStack) };
    };

    EE.prototype.fillCircleWithBlackOutline = function(ctx, x, y, radius) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(Number(x || 0), Number(y || 0), Math.max(0, Number(radius || 0)), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.98)';
        ctx.lineWidth = 1;
        ctx.stroke();
    };

    EE.prototype.fillRoundedRect = function(ctx, x, y, w, h, r) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        r = Math.max(0, Math.min(Number(r || 0), w * 0.5, h * 0.5));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.fill();
    };

    EE.prototype.pathHandleRect = function(ctx, x, y, w, h, r, roundLeft, roundRight) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        r = Math.max(0, Math.min(Number(r || 0), w * 0.5, h * 0.5));
        var rl = roundLeft ? r : 0;
        var rr = roundRight ? r : 0;
        ctx.beginPath();
        ctx.moveTo(x + rl, y);
        ctx.lineTo(x + w - rr, y);
        if (rr > 0) ctx.arcTo(x + w, y, x + w, y + rr, rr);
        else ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - rr);
        if (rr > 0) ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
        else ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + rl, y + h);
        if (rl > 0) ctx.arcTo(x, y + h, x, y + h - rl, rl);
        else ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + rl);
        if (rl > 0) ctx.arcTo(x, y, x + rl, y, rl);
        else ctx.lineTo(x, y);
        ctx.closePath();
    };

    EE.prototype.fillHandleRect = function(ctx, x, y, w, h, r, roundLeft, roundRight) {
        this.pathHandleRect(ctx, x, y, w, h, r, roundLeft, roundRight);
        ctx.fill();
    };

    EE.prototype.strokeHandleRect = function(ctx, x, y, w, h, r, roundLeft, roundRight) {
        this.pathHandleRect(ctx, x, y, w, h, r, roundLeft, roundRight);
        ctx.stroke();
    };

    EE.prototype.strokeRoundedRect = function(ctx, x, y, w, h, r) {
        if (!ctx) return;
        x = Number(x || 0);
        y = Number(y || 0);
        w = Math.max(0, Number(w || 0));
        h = Math.max(0, Number(h || 0));
        r = Math.max(0, Math.min(Number(r || 0), w * 0.5, h * 0.5));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        ctx.stroke();
    };

    EE.prototype.commandNodePointForEntry = function(entry, rowMap, rmets) {
        if (!entry || !rowMap || !rmets) return null;
        var rk = entry.rowKey || (entry.rowType === 'char' ? ('char:' + entry.charId) : 'main');
        var ri = rowMap[rk];
        if (ri == null) return null;
        var met = rmets[ri] || { top: this.rulerH + ri * this.rowH, height: this.rowH, center: this.rulerH + ri * this.rowH + Math.floor(this.rowH / 2) };
        var y = met.center;
        if (rk === 'main') {
            var lane = this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(entry.uid) ? this._mainLaneByUid[entry.uid] : 0;
            y = met.top + this.mainLaneTop + lane * this.mainLaneGap;
        }
        return {
            x: this.frameToX(Math.max(0, Math.floor(Number(entry.frame || 0)))),
            y: Math.floor(Number(y || 0))
        };
    };

    EE.prototype.drawSelectedCommandOrderButtons = function(ctx, rowMap, rmets) {
        if (!ctx) return;
        if (!this.selUid || this.nodeRouteIndex(this.selRouteListIndex) >= 0) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var info = this.sameFrameCommandMoveInfo(this.selUid);
        if (!info.show) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var entry = this.findEntryInSelectedTrack(this.selUid);
        if (!entry) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var pt = this.commandNodePointForEntry(entry, rowMap, rmets);
        if (!pt) {
            this.orderButtonAnchorEntry = null;
            return;
        }
        var bw = 16;
        var bh = 11;
        var gap = 2;
        var x = Math.floor(pt.x + 10);
        if (this.orderButtonAnchorEntry !== entry) {
            this.orderButtonAnchorEntry = entry;
            this.orderButtonAnchorY = Math.floor(Number(pt.y || 0));
        }
        var anchorY = Math.floor(Number(this.orderButtonAnchorY || pt.y || 0));
        var yTop = Math.floor(anchorY - (bh * 2 + gap) * 0.5);
        x = Math.max(this.labelW + 2, Math.min(Math.max(this.labelW + 2, this.tw - bw - 2), x));
        var self = this;
        var drawBtn = function(dir, y, enabled) {
            var x1 = x;
            var y1 = y;
            var x2 = x1 + bw;
            var y2 = y1 + bh;
            ctx.fillStyle = enabled ? 'rgba(54,132,225,.95)' : 'rgba(52,58,68,.72)';
            self.fillRoundedRect(ctx, x1, y1, bw, bh, 3);
            ctx.strokeStyle = enabled ? 'rgba(202,230,255,.92)' : 'rgba(128,140,156,.62)';
            ctx.lineWidth = 1;
            self.strokeRoundedRect(ctx, x1 + 0.5, y1 + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1), 3);
            ctx.fillStyle = enabled ? 'rgba(245,251,255,.98)' : 'rgba(166,178,194,.74)';
            var cx = x1 + Math.floor(bw / 2);
            var cy = y1 + Math.floor(bh / 2);
            ctx.beginPath();
            if (dir === 'prev') {
                ctx.moveTo(cx, cy - 3);
                ctx.lineTo(cx - 4, cy + 2);
                ctx.lineTo(cx + 4, cy + 2);
            } else {
                ctx.moveTo(cx, cy + 3);
                ctx.lineTo(cx - 4, cy - 2);
                ctx.lineTo(cx + 4, cy - 2);
            }
            ctx.closePath();
            ctx.fill();
            self.hitOrderButtons.push({
                uid: Math.floor(Number(entry.uid || 0)),
                dir: dir,
                enabled: !!enabled,
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2
            });
        };
        drawBtn('prev', yTop, !!info.canPrev);
        drawBtn('next', yTop + bh + gap, !!info.canNext);
    };

    EE.prototype.fitTimelineRangeLabel = function(ctx, text, maxPx) {
        if (!ctx) return '';
        text = String(text == null ? '' : text);
        if (!text) return '';
        maxPx = Math.max(0, Math.floor(Number(maxPx || 0)));
        if (maxPx <= 0) return '';
        if (ctx.measureText(text).width <= maxPx) return text;
        var first = text.charAt(0);
        if (!first) return '';
        if (ctx.measureText(first).width > maxPx) return '';
        var ell = '...';
        if (ctx.measureText(first + ell).width > maxPx) return first;
        var lo = 1, hi = text.length, best = first;
        while (lo <= hi) {
            var mid = Math.floor((lo + hi) / 2);
            if (mid >= text.length) {
                hi = mid - 1;
                continue;
            }
            var cand = text.slice(0, mid) + ell;
            if (ctx.measureText(cand).width <= maxPx) {
                best = cand;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best;
    };

    EE.prototype.drawFixedLabelColumn = function(ctx, rows, rmets, selectedCharRowKey, scrollLeft, totalHeight) {
        if (!ctx) return;
        rows = Array.isArray(rows) ? rows : [];
        rmets = Array.isArray(rmets) ? rmets : [];
        var fx = Math.max(0, Math.floor(Number(scrollLeft || 0)));
        var h = Math.max(1, Math.floor(Number(totalHeight || 1)));
        ctx.save();
        ctx.fillStyle = 'rgba(8,14,20,.98)';
        ctx.fillRect(fx, 0, this.labelW, h);
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.moveTo(fx + this.labelW + .5, 0);
        ctx.lineTo(fx + this.labelW + .5, h);
        ctx.stroke();
        for (var i = 0; i < rows.length; i++) {
            var mt = rmets[i] || { top: this.rulerH + i * this.rowH, height: this.rowH };
            var y = mt.top;
            var isSelCharRow = (rows[i] && rows[i].type === 'char' && rows[i].key === selectedCharRowKey);
            if (isSelCharRow) {
                ctx.fillStyle = 'rgba(255,170,90,.20)';
                ctx.fillRect(fx, y, this.labelW, mt.height);
                ctx.strokeStyle = 'rgba(255,198,132,.52)';
                ctx.strokeRect(fx + .5, y + .5, this.labelW - 1, Math.max(1, mt.height - 1));
            }
            ctx.strokeStyle = 'rgba(255,255,255,.14)';
            ctx.beginPath();
            ctx.moveTo(fx, y + .5);
            ctx.lineTo(fx + this.labelW, y + .5);
            ctx.stroke();
            ctx.font = isSelCharRow ? 'bold 11px sans-serif' : '11px sans-serif';
            ctx.fillStyle = isSelCharRow ? 'rgba(255,232,205,.98)' : 'rgba(220,230,240,.88)';
            ctx.fillText(rows[i].label, fx + 8, y + 17);
        }
        var lastY = this.rulerH;
        if (rmets.length) {
            var lm = rmets[rmets.length - 1];
            lastY = lm.top + lm.height;
        } else {
            lastY = this.rulerH + rows.length * this.rowH;
        }
        ctx.strokeStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath();
        ctx.moveTo(fx, lastY + .5);
        ctx.lineTo(fx + this.labelW, lastY + .5);
        ctx.stroke();
        ctx.restore();
    };

    EE.prototype.drawStickyTimelineRuler = function(ctx, maxF, fixedLabelX, totalWidth, totalHeight) {
        if (!ctx) return;
        totalWidth = Math.max(1, Math.floor(Number(totalWidth || 1)));
        totalHeight = Math.max(1, Math.floor(Number(totalHeight || 1)));
        var rulerY = this.timelineRulerTopY(totalHeight);
        var fx = Math.max(0, Math.floor(Number(fixedLabelX || 0)));
        var labelRight = fx + this.labelW;

        ctx.save();
        ctx.fillStyle = 'rgba(8,14,20,.98)';
        ctx.fillRect(fx, rulerY, this.labelW, this.rulerH);
        ctx.fillStyle = 'rgba(8,14,20,.95)';
        ctx.fillRect(labelRight, rulerY, Math.max(1, totalWidth - labelRight), this.rulerH);

        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.moveTo(labelRight + .5, rulerY);
        ctx.lineTo(labelRight + .5, rulerY + this.rulerH);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.moveTo(fx, rulerY + this.rulerH + .5);
        ctx.lineTo(totalWidth, rulerY + this.rulerH + .5);
        ctx.stroke();

        var pxPerFrame = Math.max(1 / 4096, Number(this.pxPerFrame || this.minPxPerFrame || 1));
        var step = Math.max(1, this.niceFrameStep(80 / pxPerFrame));
        var minorDiv = 6;
        for (var ms = 0; ms <= maxF; ms += step) {
            for (var md = 1; md < minorDiv; md++) {
                var mf = ms + step * (md / minorDiv);
                if (mf > maxF) break;
                var mx = this.frameToX(mf) + .5;
                if (mx < labelRight - 1 || mx > totalWidth + 1) continue;
                ctx.strokeStyle = 'rgba(255,255,255,.10)';
                ctx.beginPath();
                ctx.moveTo(mx, rulerY + this.rulerH - 5);
                ctx.lineTo(mx, rulerY + this.rulerH);
                ctx.stroke();
            }
        }

        ctx.font = '10px sans-serif';
        for (var f = 0; f <= maxF; f += step) {
            var x = this.frameToX(f) + .5;
            if (x < labelRight - 1 || x > totalWidth + 1) continue;
            ctx.strokeStyle = 'rgba(255,255,255,.20)';
            ctx.beginPath();
            ctx.moveTo(x, rulerY + this.rulerH - 8);
            ctx.lineTo(x, rulerY + this.rulerH);
            ctx.stroke();
            ctx.fillStyle = 'rgba(230,236,243,.88)';
            ctx.fillText(String(f), x + 2, rulerY + 11);
        }

        if (Number(this.hoverFrame) >= 0) {
            var hf = Math.max(0, Math.floor(Number(this.hoverFrame || 0)));
            var hx = this.frameToX(hf) + .5;
            var ht = String(hf) + 'f';
            ctx.font = 'bold 10px sans-serif';
            var hw = Math.ceil(ctx.measureText(ht).width) + 8;
            var hxBox = Math.max(labelRight + 1, Math.min(Math.floor(hx - hw / 2), totalWidth - hw - 1));
            var hyBox = rulerY + 2;
            ctx.fillStyle = 'rgba(0,0,0,.78)';
            ctx.fillRect(hxBox, hyBox, hw, 12);
            ctx.strokeStyle = 'rgba(210,230,255,.85)';
            ctx.strokeRect(hxBox + .5, hyBox + .5, hw - 1, 11);
            ctx.fillStyle = 'rgba(240,248,255,.98)';
            ctx.fillText(ht, hxBox + 4, hyBox + 9);
            ctx.strokeStyle = 'rgba(210,230,255,.55)';
            ctx.beginPath();
            ctx.moveTo(hx, rulerY);
            ctx.lineTo(hx, rulerY + this.rulerH);
            ctx.stroke();
        }

        var px = this.frameToX(this.frame);
        ctx.strokeStyle = 'rgba(100,255,175,.95)';
        ctx.beginPath();
        ctx.moveTo(px + .5, rulerY);
        ctx.lineTo(px + .5, rulerY + this.rulerH);
        ctx.stroke();
        ctx.restore();
    };

    EE.prototype.drawTimeline = function() {
        if (!this.timelineDirty) return;
        this.timelineDirty = false;
        var pulseNow = Date.now();
        var pulseActive = this.pruneExecutionPulses(pulseNow);
        var maxF = this.maxFrame();
        this.syncTimelineSize(maxF);
        var c = this.timeline.getContext('2d'), w = this.tw, h = this.th;
        var fixedLabelX = this.timelineWrap ? Math.max(0, Math.floor(Number(this.timelineWrap.scrollLeft || 0))) : 0;
        c.clearRect(0, 0, w, h);
        c.fillStyle = 'rgba(4,10,16,.95)';
        c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(8,14,20,.95)';
        c.fillRect(0, 0, this.labelW, h);
        c.fillStyle = 'rgba(8,14,20,.95)';
        c.fillRect(this.labelW, 0, w - this.labelW, this.rulerH);

        c.strokeStyle = 'rgba(255,255,255,.18)';
        c.beginPath();
        c.moveTo(this.labelW + .5, 0);
        c.lineTo(this.labelW + .5, h);
        c.stroke();

        var pxPerFrame = Math.max(1 / 4096, Number(this.pxPerFrame || this.minPxPerFrame || 1));
        var step = Math.max(1, this.niceFrameStep(80 / pxPerFrame));
        var minorDiv = 6;
        for (var ms = 0; ms <= maxF; ms += step) {
            for (var md = 1; md < minorDiv; md++) {
                var mf = ms + step * (md / minorDiv);
                if (mf > maxF) break;
                var mx = this.frameToX(mf) + .5;
                c.strokeStyle = 'rgba(255,255,255,.07)';
                c.beginPath();
                c.moveTo(mx, this.rulerH);
                c.lineTo(mx, h);
                c.stroke();
            }
        }
        c.font = '10px sans-serif';
        for (var f = 0; f <= maxF; f += step) {
            var x = this.frameToX(f) + .5;
            c.strokeStyle = 'rgba(255,255,255,.14)';
            c.beginPath();
            c.moveTo(x, this.rulerH);
            c.lineTo(x, h);
            c.stroke();
            c.fillStyle = 'rgba(230,236,243,.75)';
            c.fillText(String(f), x + 2, 11);
        }
        if (Number(this.hoverFrame) >= 0) {
            var hf = Math.max(0, Math.floor(Number(this.hoverFrame || 0)));
            var hx = this.frameToX(hf) + .5;
            var ht = String(hf) + 'f';
            c.font = 'bold 10px sans-serif';
            var hw = Math.ceil(c.measureText(ht).width) + 8;
            var hxBox = Math.max(fixedLabelX + this.labelW + 1, Math.min(Math.floor(hx - hw / 2), w - hw - 1));
            var hyBox = 2;
            c.fillStyle = 'rgba(0,0,0,.78)';
            c.fillRect(hxBox, hyBox, hw, 12);
            c.strokeStyle = 'rgba(210,230,255,.85)';
            c.strokeRect(hxBox + .5, hyBox + .5, hw - 1, 11);
            c.fillStyle = 'rgba(240,248,255,.98)';
            c.fillText(ht, hxBox + 4, hyBox + 9);
            c.strokeStyle = 'rgba(210,230,255,.55)';
            c.beginPath();
            c.moveTo(hx, 0);
            c.lineTo(hx, this.rulerH);
            c.stroke();
        }

        var tr = this.model.tracks[this.selKey];
        var rows = this._rows || [{ key: 'main', label: 'Main' }];
        var rmets = this._rowMetrics || [];
        var hideCircles = !!this.hideTimelineCircles;
        var hideHandles = !!this.hideRouteHandles;
        var selectedCharId = this.currentSelectedCharacterId();
        var selectedCharRowKey = (selectedCharId == null) ? '' : ('char:' + this.normalizeMoveTarget(selectedCharId));
        var laneInfo = this.buildMainLaneMap(tr);
        this._mainLaneByUid = laneInfo.laneByUid || {};
        this._mainStackMax = laneInfo.maxStack || this._mainStackMax || 1;
        var rowMap = {};
        for (var i = 0; i < rows.length; i++) {
            rowMap[rows[i].key] = i;
            var mt = rmets[i] || { top: this.rulerH + i * this.rowH, height: this.rowH };
            var y = mt.top;
            var isSelCharRow = (rows[i] && rows[i].type === 'char' && rows[i].key === selectedCharRowKey);
            if (isSelCharRow) {
                c.fillStyle = 'rgba(255,170,90,.14)';
                c.fillRect(this.labelW, y, w - this.labelW, mt.height);
                c.fillStyle = 'rgba(255,170,90,.20)';
                c.fillRect(0, y, this.labelW, mt.height);
                c.strokeStyle = 'rgba(255,198,132,.52)';
                c.strokeRect(.5, y + .5, this.labelW - 1, Math.max(1, mt.height - 1));
            }
            c.strokeStyle = 'rgba(255,255,255,.14)';
            c.beginPath();
            c.moveTo(0, y + .5);
            c.lineTo(w, y + .5);
            c.stroke();
            c.font = isSelCharRow ? 'bold 11px sans-serif' : '11px sans-serif';
            c.fillStyle = isSelCharRow ? 'rgba(255,232,205,.98)' : 'rgba(220,230,240,.88)';
            c.fillText(rows[i].label, 8, y + 17);
        }
        var lastY = this.rulerH;
        if (rmets.length) {
            var lm = rmets[rmets.length - 1];
            lastY = lm.top + lm.height;
        } else {
            lastY = this.rulerH + rows.length * this.rowH;
        }
        c.strokeStyle = 'rgba(255,255,255,.14)';
        c.beginPath();
        c.moveTo(0, lastY + .5);
        c.lineTo(w, lastY + .5);
        c.stroke();
        if (tr) {
            var shadeEndFrame = this.normalizeTrackEndFrame(tr);
            var shadeX = Math.max(this.labelW, Math.floor(this.frameToX(shadeEndFrame)) + 1);
            var shadeY = this.rulerH;
            var shadeH = Math.max(1, lastY - shadeY);
            var shadeW = Math.max(0, w - shadeX);
            if (shadeW > 0 && shadeH > 0) {
                c.save();
                c.beginPath();
                c.rect(shadeX, shadeY, shadeW, shadeH);
                c.clip();
                c.fillStyle = 'rgba(120,120,120,.10)';
                c.fillRect(shadeX, shadeY, shadeW, shadeH);
                c.strokeStyle = 'rgba(190,190,190,.24)';
                c.lineWidth = 1;
                var hatchStep = 10;
                var hatchStart = Math.floor(shadeX - shadeH);
                var hatchEnd = Math.ceil(shadeX + shadeW + shadeH);
                for (var hxi = hatchStart; hxi <= hatchEnd; hxi += hatchStep) {
                    c.beginPath();
                    c.moveTo(hxi, shadeY + shadeH);
                    c.lineTo(hxi + shadeH, shadeY);
                    c.stroke();
                }
                c.restore();
                c.strokeStyle = 'rgba(200,200,200,.44)';
                c.beginPath();
                c.moveTo(shadeX + .5, shadeY);
                c.lineTo(shadeX + .5, shadeY + shadeH);
                c.stroke();
            }
        }

        if (tr && tr.commands) {
            var ranges = this.collectMoveRouteWaitRanges(tr, 0);
            var overlayTop = this.rulerH;
            var overlayBottom = Math.max(overlayTop + 1, lastY);
            var overlayHeight = Math.max(1, overlayBottom - overlayTop);
            for (var wr = 0; wr < ranges.length; wr++) {
                var rg = ranges[wr];
                var sxr = this.frameToX(rg.start);
                var exr = this.frameToX(rg.end);
                var bxr = Math.min(sxr, exr);
                var bwr = Math.max(2, Math.abs(exr - sxr));
                c.fillStyle = 'rgba(255,166,84,.10)';
                c.fillRect(bxr, overlayTop, bwr, overlayHeight);
                c.save();
                c.beginPath();
                c.rect(bxr, overlayTop, bwr, overlayHeight);
                c.clip();
                c.strokeStyle = 'rgba(255,176,96,.30)';
                c.lineWidth = 1;
                var hatchStep = 8;
                var hatchStart = Math.floor(bxr - overlayHeight);
                var hatchEnd = Math.ceil(bxr + bwr + overlayHeight);
                for (var hx = hatchStart; hx <= hatchEnd; hx += hatchStep) {
                    c.beginPath();
                    c.moveTo(hx, overlayBottom);
                    c.lineTo(hx + overlayHeight, overlayTop);
                    c.stroke();
                }
                c.restore();
                c.strokeStyle = 'rgba(255,176,96,.50)';
                c.beginPath();
                c.moveTo(bxr + 0.5, overlayTop);
                c.lineTo(bxr + 0.5, overlayBottom);
                c.moveTo(bxr + bwr - 0.5, overlayTop);
                c.lineTo(bxr + bwr - 0.5, overlayBottom);
                c.stroke();
            }
        }

        this.hitNodes = [];
        this.hitComments = [];
        this.hitBars = [];
        this.hitOrderButtons = [];
        var memoLabelQueue = [];
        var commentFrontQueue = [];
        var drawnCommentAt = {};
        if (tr && tr.commands) {
            for (i = 0; i < tr.commands.length; i++) {
                var e = tr.commands[i];
                var rk = e.rowKey || (e.rowType === 'char' ? ('char:' + e.charId) : 'main');
                var ri = rowMap[rk];
                if (ri == null) continue;
                var met = rmets[ri] || { top: this.rulerH + ri * this.rowH, height: this.rowH, center: this.rulerH + ri * this.rowH + Math.floor(this.rowH / 2) };
                var cy = met.center;
                if (rk === 'main') {
                    var lane = this._mainLaneByUid && this._mainLaneByUid.hasOwnProperty(e.uid) ? this._mainLaneByUid[e.uid] : 0;
                    cy = met.top + this.mainLaneTop + lane * this.mainLaneGap;
                }
                var cx = this.frameToX(e.frame);
                var wait = Math.max(0, Math.floor(Number(e.wait || 0)));
                var sel = (e.uid === this.selUid && (this.selRouteListIndex == null || this.selRouteListIndex < 0)) || this.isEntryInRangeSelection(e.uid);
                if (e.isComment || e.command.code === 108) {
                    var ckey = rk + ':' + String(Math.max(0, Math.floor(Number(e.frame || 0))));
                    if (drawnCommentAt[ckey]) continue;
                    drawnCommentAt[ckey] = true;
                    this.memoApplyParsedStateToEntry(e);
                    var msize = e.isMemo ? this.memoNormalizeSize(e.memoSize) : 'S';
                    var cr = this.memoCircleRadiusForSize(msize);
                    // Keep comment marker on the border between ruler and timeline body.
                    var ay = Math.max(0, Math.floor(Number(this.rulerH || 0))) + 1;
                    if (!hideCircles) {
                        c.fillStyle = 'rgba(80,220,110,.98)';
                        this.fillCircleWithBlackOutline(c, cx, ay, cr);
                        if (this.drawExecutionPulse(c, e.uid, -1, cx, ay, cr, pulseNow)) pulseActive = true;
                        if (e.isMemo && msize !== 'S') memoLabelQueue.push({ x: cx, y: ay, size: msize, text: e.memoText || '' });
                        commentFrontQueue.push({
                            uid: e.uid,
                            x: cx,
                            y: ay,
                            r: cr,
                            sel: !!sel,
                            hov: !!this.isNodeHovered(e.uid, -1)
                        });
                    }
                    if (!hideCircles) {
                        this.hitComments.push({
                            uid: e.uid,
                            x: cx,
                            y: ay,
                            r: cr,
                            frame: e.frame,
                            rowKey: rk,
                            text: e.isMemo ? this.memoNormalizeText(e.memoText || '') : (e.commentLines || ['']).join('\n')
                        });
                    }
                    if (!hideCircles) this.hitNodes.push({ uid: e.uid, x: cx, y: ay, r: Math.max(4, cr + 1), frame: e.frame, rowKey: rk });
                    var hsel = sel;
                    var hhov = this.isNodeHovered(e.uid, -1);
                    if (!hideCircles && (hsel || hhov)) {
                        c.strokeStyle = hsel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                        c.lineWidth = hsel ? 2 : 1;
                        c.beginPath();
                        c.arc(cx, ay, (hsel ? 4 : 3) + cr, 0, Math.PI * 2);
                        c.stroke();
                        c.lineWidth = 1;
                    }
                    continue;
                }
                if (e.command && Number(e.command.code || 0) === 205 && rk.indexOf('char:') === 0) {
                    var route = e.command.parameters && e.command.parameters[1];
                    var routeWaitOn = !!(route && route.wait);
                    var routeBarFillColor = routeWaitOn ? 'rgba(242,144,64,.38)' : 'rgba(255,170,90,.20)';
                    var routeNodeFillColor = routeWaitOn ? 'rgba(246,168,96,.98)' : 'rgba(255,186,118,.98)';
                    var routeHandleBaseColor = routeWaitOn ? 'rgba(246,162,84,1)' : 'rgba(255,180,110,1)';
                    var tl = this.moveRouteTimeline(route);
                    var total = Math.max(1, Math.floor(Number(e.wait || tl.totalFrames || 1)));
                    var sx = this.frameToX(e.frame);
                    var ex205 = this.frameToX(e.frame + total);
                    var bx = Math.min(sx, ex205);
                    var bw205 = Math.max(2, Math.abs(ex205 - sx));
                    var by = cy - 7;
                    var bh = 14;
                    var hW = 7, hH = 12, hR = 3;
                    var lhx = bx - hW - 2;
                    var lhy = cy - Math.floor(hH / 2);
                    var rhx = bx + bw205;
                    var rhy = cy - Math.floor(hH / 2);
                    // Extend visual range start to the left handle edge so no visual gap appears.
                    var vbx = Math.min(bx, lhx + hW - 2);
                    var vbw = Math.max(2, bw205 + (bx - vbx));
                    c.fillStyle = routeBarFillColor;
                    c.fillRect(vbx, by, vbw, bh);
                    var rangeSel = (e.uid === this.selUid && (this.selRouteListIndex == null || this.selRouteListIndex < 0)) || this.isEntryInRangeSelection(e.uid);
                    var rangeHover = this.isNodeHovered(e.uid, -1);
                    var routeHx = Math.floor(lhx - 1);
                    var routeHy = Math.floor(cy - Math.floor(hH / 2) - 1);
                    var routeHw = Math.max(6, Math.ceil((rhx + hW) - lhx + 2));
                    var routeHh = Math.max(6, Math.ceil(hH + 2));
                    if (rangeSel || rangeHover) {
                        if (rangeSel) {
                            c.strokeStyle = 'rgba(36,20,8,.96)';
                            c.lineWidth = 3;
                            this.strokeRoundedRect(c, routeHx + .5, routeHy + .5, Math.max(1, routeHw - 1), Math.max(1, routeHh - 1), 4);
                            c.strokeStyle = 'rgba(255,165,70,.98)';
                            c.lineWidth = 2;
                            this.strokeRoundedRect(c, routeHx + 1.5, routeHy + 1.5, Math.max(1, routeHw - 3), Math.max(1, routeHh - 3), 3);
                        } else {
                            c.strokeStyle = 'rgba(255,220,170,.95)';
                            c.lineWidth = 1;
                            this.strokeRoundedRect(c, routeHx + .5, routeHy + .5, Math.max(1, routeHw - 1), Math.max(1, routeHh - 1), 4);
                        }
                        c.lineWidth = 1;
                    }
                    var hColor = rangeSel ? 'rgba(255,170,88,1)' : (rangeHover ? 'rgba(255,220,170,1)' : routeHandleBaseColor);
                    var kx = bx + Math.floor(bw205 / 2);
                    var ky = by;
                    var kW = 8, kH = 4, kr = 2;
                    var kx1 = kx - Math.floor(kW / 2) - 1, ky1 = ky - Math.floor(kH / 2);
                    if (!hideHandles) {
                        c.fillStyle = hColor;
                        // Left handle: anchorX=1 (right edge at bx), inner(right) side is square.
                        this.fillHandleRect(c, lhx, lhy, hW, hH, hR, true, false);
                        // Right handle: anchorX=0 (left edge at bx+bw205), inner(left) side is square.
                        this.fillHandleRect(c, rhx, rhy, hW, hH, hR, false, true);
                        this.fillRoundedRect(c, kx1, ky1, kW, kH, kr);
                    }
                    var hru = Number(this.hoverRangeUid || 0);
                    var hrp = String(this.hoverRangePart || '');
                    if (!hideHandles && hru === Number(e.uid || 0)) {
                        var hs = rangeSel ? 'rgba(255,165,70,.98)' : 'rgba(255,220,170,.95)';
                        c.strokeStyle = hs;
                        c.lineWidth = rangeSel ? 2 : 1;
                        if (hrp === 'left') this.strokeHandleRect(c, lhx + .5, lhy + .5, Math.max(1, hW - 1), Math.max(1, hH - 1), hR, true, false);
                        else if (hrp === 'right') this.strokeHandleRect(c, rhx + .5, rhy + .5, Math.max(1, hW - 1), Math.max(1, hH - 1), hR, false, true);
                        else if (hrp === 'move') this.strokeRoundedRect(c, kx1 + .5, ky1 + .5, Math.max(1, kW - 1), Math.max(1, kH - 1), kr);
                        c.lineWidth = 1;
                    }
                    this.hitBars.push({
                        uid: e.uid, x1: bx, x2: bx + bw205, y: cy, frame: e.frame, rowKey: rk,
                        routeRangeUid: e.uid, routeRangePart: 'body', frameStart: e.frame, waitFrames: total
                    });
                    var items = tl.items || [];
                    var hasVisibleRouteCmd = false;
                    if (!items.length) {
                        if (!hideCircles) {
                            c.fillStyle = routeNodeFillColor;
                            this.fillCircleWithBlackOutline(c, cx, cy, 4);
                        }
                        var rsel0 = sel;
                        var rhov0 = this.isNodeHovered(e.uid, -1);
                        if (!hideCircles && (rsel0 || rhov0)) {
                            if (rsel0) {
                                c.strokeStyle = 'rgba(36,20,8,.96)';
                                c.lineWidth = 3;
                                c.beginPath();
                                c.arc(cx, cy, 8, 0, Math.PI * 2);
                                c.stroke();
                                c.strokeStyle = 'rgba(255,165,70,.98)';
                                c.lineWidth = 2;
                                c.beginPath();
                                c.arc(cx, cy, 7, 0, Math.PI * 2);
                                c.stroke();
                            } else {
                                c.strokeStyle = 'rgba(255,220,170,.95)';
                                c.lineWidth = 1;
                                c.beginPath();
                                c.arc(cx, cy, 6, 0, Math.PI * 2);
                                c.stroke();
                            }
                            c.lineWidth = 1;
                        }
                        if (!hideCircles) {
                            this.hitNodes.push({
                                uid: e.uid, x: cx, y: cy, r: 5, frame: e.frame, rowKey: rk,
                                routeCmdCode: null, routeListIndex: -1
                            });
                        }
                    } else {
                        for (var m = 0; m < items.length; m++) {
                            var it = items[m];
                            var rcmd = it && it.command ? it.command : null;
                            var rcode = Number((it && it.displayCode != null) ? it.displayCode : 0);
                            if (rcode <= 0 && rcmd) rcode = this.routeDisplayCodeForCommand(rcmd);
                            var displayCode = rcode;
                            if (displayCode <= 0 || displayCode === 15) continue;
                            hasVisibleRouteCmd = true;
                            var rf = e.frame + Math.max(0, Math.floor(Number(it.offset || 0)));
                            var rcx = this.frameToX(rf);
                            var spanFrames = Math.max(1, Math.floor(Number(it.span || 1)));
                            if (spanFrames > 1) {
                                var rex = this.frameToX(rf + spanFrames);
                                c.strokeStyle = routeNodeFillColor;
                                c.lineWidth = 2;
                                c.beginPath();
                                c.moveTo(rcx, cy);
                                c.lineTo(rex, cy);
                                c.stroke();
                                c.lineWidth = 1;
                            }
                            if (!hideCircles) {
                                c.fillStyle = routeNodeFillColor;
                                this.fillCircleWithBlackOutline(c, rcx, cy, 4);
                                if (this.drawExecutionPulse(c, e.uid, rli, rcx, cy, 4, pulseNow)) pulseActive = true;
                            }
                            var rli = Number(it.listIndex == null ? -1 : it.listIndex);
                            var rsel = (e.uid === this.selUid && this.selRouteListIndex === rli) || this.isRouteCmdInRangeSelection(e.uid, rli);
                            var rhov = this.isNodeHovered(e.uid, rli);
                            if (!hideCircles && (rsel || rhov)) {
                                if (rsel) {
                                    c.strokeStyle = 'rgba(36,20,8,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(rcx, cy, 8, 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(255,165,70,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(rcx, cy, 7, 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(255,220,170,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(rcx, cy, 6, 0, Math.PI * 2);
                                    c.stroke();
                                }
                                c.lineWidth = 1;
                            }
                            if (!hideCircles) {
                                this.hitNodes.push({
                                    uid: e.uid, x: rcx, y: cy, r: 5, frame: rf, rowKey: rk,
                                    routeCmdCode: displayCode, routeOffset: Number(it.offset || 0), routeIndex: m, routeListIndex: rli
                                });
                            }
                        }
                        if (!hasVisibleRouteCmd) {
                            if (!hideCircles) {
                                c.fillStyle = routeNodeFillColor;
                                this.fillCircleWithBlackOutline(c, cx, cy, 4);
                                if (this.drawExecutionPulse(c, e.uid, -1, cx, cy, 4, pulseNow)) pulseActive = true;
                            }
                            var rsel1 = sel;
                            var rhov1 = this.isNodeHovered(e.uid, -1);
                            if (!hideCircles && (rsel1 || rhov1)) {
                                if (rsel1) {
                                    c.strokeStyle = 'rgba(36,20,8,.96)';
                                    c.lineWidth = 3;
                                    c.beginPath();
                                    c.arc(cx, cy, 8, 0, Math.PI * 2);
                                    c.stroke();
                                    c.strokeStyle = 'rgba(255,165,70,.98)';
                                    c.lineWidth = 2;
                                    c.beginPath();
                                    c.arc(cx, cy, 7, 0, Math.PI * 2);
                                    c.stroke();
                                } else {
                                    c.strokeStyle = 'rgba(255,220,170,.95)';
                                    c.lineWidth = 1;
                                    c.beginPath();
                                    c.arc(cx, cy, 6, 0, Math.PI * 2);
                                    c.stroke();
                                }
                                c.lineWidth = 1;
                            }
                            if (!hideCircles) {
                                this.hitNodes.push({
                                    uid: e.uid, x: cx, y: cy, r: 5, frame: e.frame, rowKey: rk,
                                    routeCmdCode: null, routeListIndex: -1
                                });
                            }
                        }
                    }
                    if (!hideHandles) {
                        this.hitBars.push({
                            uid: e.uid, x1: lhx, x2: lhx + hW, y: cy, frame: e.frame, rowKey: rk,
                            routeRangeUid: e.uid, routeRangePart: 'left', frameStart: e.frame, waitFrames: total
                        });
                        this.hitBars.push({
                            uid: e.uid, x1: rhx, x2: rhx + hW, y: cy, frame: e.frame, rowKey: rk,
                            routeRangeUid: e.uid, routeRangePart: 'right', frameStart: e.frame, waitFrames: total
                        });
                        this.hitBars.push({
                            uid: e.uid, x1: kx - 10, x2: kx + 10, y: ky, frame: e.frame, rowKey: rk,
                            routeRangeUid: e.uid, routeRangePart: 'move', frameStart: e.frame, waitFrames: total
                        });
                    }
                    continue;
                }
                if (wait > 1) {
                    var ex = this.frameToX(e.frame + wait);
                    c.strokeStyle = rk === 'main' ? 'rgba(114,205,255,.95)' : 'rgba(255,176,96,.95)';
                    c.lineWidth = 3;
                    c.beginPath();
                    c.moveTo(cx, cy);
                    c.lineTo(ex, cy);
                    c.stroke();
                    c.lineWidth = 1;
                    this.hitBars.push({ uid: e.uid, x1: Math.min(cx, ex), x2: Math.max(cx, ex), y: cy, frame: e.frame, rowKey: rk });
                }
                if (e.command && e.command.code === 101) c.fillStyle = 'rgba(255,100,190,.98)';
                else c.fillStyle = rk === 'main' ? 'rgba(122,210,255,.98)' : 'rgba(255,176,96,.98)';
                if (!hideCircles) this.fillCircleWithBlackOutline(c, cx, cy, 4);
                if (!hideCircles && this.drawExecutionPulse(c, e.uid, -1, cx, cy, 4, pulseNow)) pulseActive = true;
                var gsel = sel;
                var ghov = this.isNodeHovered(e.uid, -1);
                if (!hideCircles && (gsel || ghov)) {
                    c.strokeStyle = gsel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                    c.lineWidth = gsel ? 2 : 1;
                    c.beginPath();
                    c.arc(cx, cy, gsel ? 7 : 6, 0, Math.PI * 2);
                    c.stroke();
                    c.lineWidth = 1;
                }
                if (!hideCircles) this.hitNodes.push({ uid: e.uid, x: cx, y: cy, r: 5, frame: e.frame, rowKey: rk });
            }
        }

        if (tr) {
            var minEndFrame = this.trackComputedEndFrame(tr);
            var baseEndFrame = this.normalizeTrackEndFrame(tr);
            var drawEndFrame = baseEndFrame;
            if (this.dragState && this.dragState.endMarker) {
                var dsEnd = this.dragState;
                var dTarget = (dsEnd.targetFrame == null) ? dsEnd.startFrame : dsEnd.targetFrame;
                drawEndFrame = Math.max(minEndFrame, Math.floor(Number(dTarget || 0)));
            }
            var mainRi = rowMap.main;
            var mainMet = (mainRi != null) ? (rmets[mainRi] || null) : null;
            var endX = this.frameToX(drawEndFrame);
            var endY = mainMet ? (Number(mainMet.top || this.rulerH) + this.mainLaneTop) : (this.rulerH + Math.floor(this.rowH / 2));
            var endR = 5;
            if (!hideCircles) {
                c.fillStyle = 'rgba(170,170,170,.98)';
                this.fillCircleWithBlackOutline(c, endX, endY, endR);
                var endActive = !!(this.dragState && this.dragState.endMarker) || !!this.hoverEndMarker;
                if (endActive) {
                    c.strokeStyle = (this.dragState && this.dragState.endMarker) ? 'rgba(236,236,236,.98)' : 'rgba(210,220,236,.95)';
                    c.lineWidth = (this.dragState && this.dragState.endMarker) ? 2 : 1;
                    c.beginPath();
                    c.arc(endX, endY, 8, 0, Math.PI * 2);
                    c.stroke();
                    c.lineWidth = 1;
                }
                this.hitNodes.push({
                    uid: 0,
                    isEndMarker: true,
                    x: endX,
                    y: endY,
                    r: 6,
                    frame: drawEndFrame,
                    rowKey: 'main'
                });
            }
        }

        this.drawSelectedCommandOrderButtons(c, rowMap, rmets);

        if (this.dragState && this.dragState.uid && this.dragState.moved) {
            var ds = this.dragState;
            if (ds.isRangeDrag) {
                var de = this.findEntryInSelectedTrack(ds.uid);
                var drk = de ? (de.rowKey || (de.rowType === 'char' ? ('char:' + de.charId) : 'main')) : ds.targetRowKey;
                var dri = rowMap[drk];
                if (dri != null) {
                    var dmet = rmets[dri] || { top: this.rulerH + dri * this.rowH, height: this.rowH, center: this.rulerH + dri * this.rowH + Math.floor(this.rowH / 2) };
                    var dcy = dmet.center;
                    var dby = dcy - 7, dbh = 14;
                    var oldStart = Math.max(0, Math.floor(Number(ds.startEntryFrame || (de ? de.frame : 0))));
                    var oldWait = Math.max(1, Math.floor(Number(ds.startWait || (de ? de.wait : 1))));
                    var newStart = Math.max(0, Math.floor(Number(ds.targetFrame || oldStart)));
                    var newWait = Math.max(1, Math.floor(Number(ds.targetWait || oldWait)));
                    var ox1 = this.frameToX(oldStart), ox2 = this.frameToX(oldStart + oldWait);
                    var nx1 = this.frameToX(newStart), nx2 = this.frameToX(newStart + newWait);
                    var obx = Math.min(ox1, ox2), obw = Math.max(2, Math.abs(ox2 - ox1));
                    var nbx = Math.min(nx1, nx2), nbw = Math.max(2, Math.abs(nx2 - nx1));

                    c.fillStyle = 'rgba(255,255,255,.08)';
                    c.fillRect(obx, dby, obw, dbh);
                    c.strokeStyle = 'rgba(255,255,255,.24)';
                    c.lineWidth = 1;
                    c.strokeRect(obx + .5, dby + .5, Math.max(1, obw - 1), Math.max(1, dbh - 1));

                    c.fillStyle = ds.valid ? 'rgba(100,255,170,.28)' : 'rgba(255,120,120,.28)';
                    c.fillRect(nbx, dby, nbw, dbh);
                    c.strokeStyle = ds.valid ? 'rgba(100,255,170,.94)' : 'rgba(255,120,120,.94)';
                    c.lineWidth = 2;
                    c.strokeRect(nbx + .5, dby + .5, Math.max(1, nbw - 1), Math.max(1, dbh - 1));
                    c.lineWidth = 1;

                    var dPart = String(ds.rangePart || '');
                    if (dPart === 'left' || dPart === 'right') {
                        var dFrame = newWait - oldWait;
                        var dText = (dFrame >= 0 ? '+' : '') + dFrame + 'f';
                        c.font = 'bold 11px sans-serif';
                        var tw = Math.ceil(c.measureText(dText).width) + 8;
                        var tx = Math.floor(nbx + nbw / 2 - tw / 2);
                        var ty = Math.floor(dby - 18);
                        c.fillStyle = 'rgba(0,0,0,.78)';
                        c.fillRect(tx, ty, tw, 14);
                        c.strokeStyle = 'rgba(255,255,255,.22)';
                        c.strokeRect(tx + .5, ty + .5, tw - 1, 13);
                        c.fillStyle = ds.valid ? 'rgba(170,255,205,.98)' : 'rgba(255,196,196,.98)';
                        c.fillText(dText, tx + 4, ty + 10);
                    }
                }
            } else {
                var di = rowMap[ds.targetRowKey];
                if (di != null) {
                    var dy = this.rulerH + di * this.rowH + Math.floor(this.rowH / 2);
                    var dx = this.frameToX(ds.targetFrame);
                    if (!hideCircles) {
                        c.fillStyle = ds.valid ? 'rgba(100,255,170,.9)' : 'rgba(255,120,120,.9)';
                        this.fillCircleWithBlackOutline(c, dx, dy, 5);
                    }
                }
            }
        }

        if (this.hasRangeSelection()) {
            var rs = this.rangeSelection || {};
            var srects = Array.isArray(rs.rects) ? rs.rects : [];
            for (var sri = 0; sri < srects.length; sri++) {
                var src = srects[sri];
                if (!src) continue;
                var sx1 = Math.min(Number(src.x1 || 0), Number(src.x2 || 0));
                var sx2 = Math.max(Number(src.x1 || 0), Number(src.x2 || 0));
                var sy1 = Math.min(Number(src.y1 || 0), Number(src.y2 || 0));
                var sy2 = Math.max(Number(src.y1 || 0), Number(src.y2 || 0));
                var sw = Math.max(1, sx2 - sx1);
                var sh = Math.max(1, sy2 - sy1);
                c.fillStyle = 'rgba(88,168,255,.10)';
                c.fillRect(sx1, sy1, sw, sh);
                c.strokeStyle = 'rgba(118,198,255,.78)';
                c.lineWidth = 1;
                c.strokeRect(sx1 + .5, sy1 + .5, Math.max(1, sw - 1), Math.max(1, sh - 1));
            }
        }

        if (this.rangeSelectDrag) {
            var rsd = this.rangeSelectDrag;
            var rsi = this.rangeSelectDragFrameInfo(rsd);
            var dr = rsi && rsi.rect ? rsi.rect : this.normalizeCanvasRect(rsd.startX, rsd.startY, rsd.currentX, rsd.currentY);
            var dx1 = Math.min(Number(dr.x1 || 0), Number(dr.x2 || 0));
            var dx2 = Math.max(Number(dr.x1 || 0), Number(dr.x2 || 0));
            var dy1 = Math.min(Number(dr.y1 || 0), Number(dr.y2 || 0));
            var dy2 = Math.max(Number(dr.y1 || 0), Number(dr.y2 || 0));
            var dw = Math.max(1, dx2 - dx1);
            var dh = Math.max(1, dy2 - dy1);
            c.fillStyle = 'rgba(88,168,255,.16)';
            c.fillRect(dx1, dy1, dw, dh);
            c.strokeStyle = 'rgba(128,212,255,.95)';
            c.lineWidth = 1;
            c.strokeRect(dx1 + .5, dy1 + .5, Math.max(1, dw - 1), Math.max(1, dh - 1));
            if (rsi) {
                var dragText = '選択中: ' + rsi.frameCount + 'f';
                c.save();
                c.font = 'bold 12px sans-serif';
                var padX = 7;
                var padY = 4;
                var tw2 = Math.ceil(c.measureText(dragText).width);
                var bw2 = tw2 + padX * 2;
                var bh2 = 20;
                var bx2 = Math.floor(dx1 + 4);
                var by2 = Math.floor(dy1 - bh2 - 4);
                if (by2 < 2) by2 = Math.floor(dy2 + 4);
                if (bx2 + bw2 > this.tw - 2) bx2 = Math.max(2, Math.floor(this.tw - bw2 - 2));
                c.fillStyle = 'rgba(14,30,42,.92)';
                this.fillRoundedRect(c, bx2, by2, bw2, bh2, 4);
                c.strokeStyle = 'rgba(128,212,255,.92)';
                c.lineWidth = 1;
                this.strokeRoundedRect(c, bx2 + .5, by2 + .5, Math.max(1, bw2 - 1), Math.max(1, bh2 - 1), 4);
                c.fillStyle = 'rgba(208,236,255,.98)';
                c.fillText(dragText, bx2 + padX, by2 + 14);
                c.restore();
            }
        }

        if (this.rangeMoveDrag && this.rangeMoveDrag.moved) {
            var rmd = this.rangeMoveDrag;
            var okCol = rmd.valid ? 'rgba(100,255,170,.94)' : 'rgba(255,120,120,.94)';
            var okFill = rmd.valid ? 'rgba(100,255,170,.24)' : 'rgba(255,120,120,.24)';
            if (rmd.kind === 'routeCmd') {
                var re = this.findEntryInSelectedTrack(Number(rmd.previewRouteUid || 0));
                var rrk = re ? String(re.rowKey || 'main') : '';
                var rri = rowMap[rrk];
                if (rri != null && re && rmd.previewRouteBlocks && rmd.previewRouteBlocks.length) {
                    var rmet = rmets[rri] || { top: this.rulerH + rri * this.rowH, height: this.rowH, center: this.rulerH + rri * this.rowH + Math.floor(this.rowH / 2) };
                    var rcy = rmet.center;
                    c.strokeStyle = okCol;
                    c.fillStyle = okFill;
                    for (var rbi = 0; rbi < rmd.previewRouteBlocks.length; rbi++) {
                        var rb = rmd.previewRouteBlocks[rbi];
                        if (!rb || !rb._sel) continue;
                        var rfx = this.frameToX(Math.max(0, Math.floor(Number(re.frame || 0))) + Math.max(0, Math.floor(Number(rb.start || 0))));
                        this.fillCircleWithBlackOutline(c, rfx, rcy, 5);
                        c.beginPath();
                        c.arc(rfx, rcy, 8, 0, Math.PI * 2);
                        c.stroke();
                    }
                }
            } else if (Array.isArray(rmd.previewEntries) && rmd.previewEntries.length) {
                for (var pei = 0; pei < rmd.previewEntries.length; pei++) {
                    var pe = rmd.previewEntries[pei];
                    if (!pe || !pe.entry) continue;
                    var prk = String(pe.rowKey || pe.entry.rowKey || 'main');
                    var pri = rowMap[prk];
                    if (pri == null) continue;
                    var pmet = rmets[pri] || { top: this.rulerH + pri * this.rowH, height: this.rowH, center: this.rulerH + pri * this.rowH + Math.floor(this.rowH / 2) };
                    var pcy = pmet.center;
                    var pfx = this.frameToX(Math.max(0, Math.floor(Number(pe.frame || 0))));
                    var isMoveRouteEntry = !!(pe.entry && pe.entry.command && Number(pe.entry.command.code || 0) === 205);
                    if (isMoveRouteEntry) {
                        var pspan = Math.max(1, this.routeExecutionSpanFramesForEntry(pe.entry));
                        var pexr = this.frameToX(Math.max(0, Math.floor(Number(pe.frame || 0))) + pspan);
                        var px1r = Math.min(pfx, pexr);
                        var pwr = Math.max(2, Math.abs(pexr - pfx));
                        var pby = Math.floor(pcy - 7);
                        var pbh = 14;
                        c.fillStyle = okFill;
                        c.fillRect(px1r, pby, pwr, pbh);
                        c.strokeStyle = okCol;
                        c.lineWidth = 2;
                        c.strokeRect(px1r + .5, pby + .5, Math.max(1, pwr - 1), Math.max(1, pbh - 1));
                        c.lineWidth = 1;
                        continue;
                    }
                    var pwait = Math.max(0, Math.floor(Number(pe.entry.wait || 0)));
                    if (pwait > 1) {
                        var pex = this.frameToX(Math.max(0, Math.floor(Number(pe.frame || 0))) + pwait);
                        c.strokeStyle = okCol;
                        c.lineWidth = 3;
                        c.beginPath();
                        c.moveTo(pfx, pcy);
                        c.lineTo(pex, pcy);
                        c.stroke();
                        c.lineWidth = 1;
                    }
                    c.fillStyle = okFill;
                    this.fillCircleWithBlackOutline(c, pfx, pcy, 5);
                    c.strokeStyle = okCol;
                    c.beginPath();
                    c.arc(pfx, pcy, 8, 0, Math.PI * 2);
                    c.stroke();
                }
            }
        }

        if (pulseActive) this.timelineDirty = true;

        // Keep left label column fixed while horizontal scrolling.
        this.drawFixedLabelColumn(c, rows, rmets, selectedCharRowKey, fixedLabelX, h);

        if (Number(this.hoverFrame) >= 0) {
            var hvf = Math.max(0, Math.floor(Number(this.hoverFrame || 0)));
            var hvx = this.frameToX(hvf) + 0.5;
            c.strokeStyle = 'rgba(210,230,255,.35)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(hvx, this.rulerH);
            c.lineTo(hvx, h);
            c.stroke();
        }

        var px = this.frameToX(this.frame);
        c.strokeStyle = 'rgba(100,255,175,.95)';
        c.beginPath();
        c.moveTo(px + .5, 0);
        c.lineTo(px + .5, h);
        c.stroke();

        // Keep top ruler fixed while vertical scrolling.
        this.drawStickyTimelineRuler(c, maxF, fixedLabelX, w, h);
        var frontPulse = false;
        for (var cqi = 0; cqi < commentFrontQueue.length; cqi++) {
            var cq = commentFrontQueue[cqi];
            c.fillStyle = 'rgba(80,220,110,.98)';
            this.fillCircleWithBlackOutline(c, cq.x, cq.y, cq.r);
            if (this.drawExecutionPulse(c, cq.uid, -1, cq.x, cq.y, cq.r, pulseNow)) frontPulse = true;
            if (cq.sel || cq.hov) {
                c.strokeStyle = cq.sel ? 'rgba(60,140,235,.98)' : 'rgba(190,228,255,.95)';
                c.lineWidth = cq.sel ? 2 : 1;
                c.beginPath();
                c.arc(cq.x, cq.y, (cq.sel ? 4 : 3) + cq.r, 0, Math.PI * 2);
                c.stroke();
                c.lineWidth = 1;
            }
        }
        if (frontPulse) this.timelineDirty = true;
        this.renderMemoLabelOverlay(memoLabelQueue);

        if (this.tInfo) {
            var sid = (this.selUid || '-');
            if (this.selRouteListIndex != null && this.selRouteListIndex >= 0) sid += '/route[' + this.selRouteListIndex + ']';
            var dragInfoText = '';
            if (this.rangeSelectDrag) {
                var dsInfo = this.rangeSelectDragFrameInfo(this.rangeSelectDrag);
                if (dsInfo) dragInfoText = ' | selecting: ' + dsInfo.frameCount + 'f';
            }
            this.tInfo.textContent = 'frame: ' + this.frame + ' | selected: ' + sid + ' | event: ' + (this.selEid || '-') + ' | rows: ' + rows.length + dragInfoText;
        }
        this.refreshMemoScrollLane(maxF);
    };

    EE.prototype.niceFrameStep = function(target) {
        target = Math.max(1, Number(target || 1));
        var step = 30;
        while (step < target) step *= 2;
        return step;
    };

    EE.prototype.onTimelineLeave = function() {
        if (this.panState && this.panState.mode === 'timeline') return;
        if (this.isAnyContextMenuOpen()) {
            this.showTipAt(0, 0, '');
            return;
        }
        this.setHoverNode(null);
        if (this.timeline) this.timeline.style.cursor = 'crosshair';
        if (Number(this.hoverFrame) !== -1) {
            this.hoverFrame = -1;
            this.timelineDirty = true;
        }
        if (this.hoverEndMarker) {
            this.hoverEndMarker = false;
            this.timelineDirty = true;
        }
        if (Number(this.hoverRangeUid || 0) !== 0 || String(this.hoverRangePart || '') !== '') {
            this.hoverRangeUid = 0;
            this.hoverRangePart = '';
            this.timelineDirty = true;
        }
        this.showTipAt(0, 0, '');
    };

    EE.prototype.onTimelineMove = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        if (this.panState) {
            this.updateSpacePanDrag(e);
            return;
        }
        var r = this.timeline.getBoundingClientRect();
        if (e.clientX == null || e.clientY == null) return;
        var x = e.clientX - r.left, y = e.clientY - r.top;
        this.lastMouseX = x;
        this.lastMouseY = y;
        if (this.isAnyContextMenuOpen()) {
            this.showTipAt(0, 0, '');
            return;
        }
        if (this.rangeSelectDrag) {
            this.updateRangeSelectionDrag(x, y);
            if (this.timeline.style.cursor !== 'crosshair') this.timeline.style.cursor = 'crosshair';
            this.showTipAt(0, 0, '');
            return;
        }
        if (this.rangeMoveDrag) {
            this.updateRangeMoveDrag(x, y);
            if (this.timeline.style.cursor !== 'move') this.timeline.style.cursor = 'move';
            this.showTipAt(0, 0, '');
            return;
        }
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var hc = onRulerAny ? null : this.hitTestComment(x, y);
        var hn = onRulerAny ? null : this.hitTestNode(x, y);
        var hb = (onRulerAny || hn) ? null : this.hitTestBar(x, y);
        var hob = onRulerAny ? null : this.hitTestOrderButton(x, y);
        var hru = (hb && hb.routeRangeUid) ? Math.floor(Number(hb.routeRangeUid || 0)) : 0;
        var hrp = (hb && hb.routeRangeUid) ? String(hb.routeRangePart || '') : '';
        if (Number(this.hoverRangeUid || 0) !== hru || String(this.hoverRangePart || '') !== hrp) {
            this.hoverRangeUid = hru;
            this.hoverRangePart = hrp;
            this.timelineDirty = true;
        }
        var endHoverNow = !!(hn && hn.isEndMarker);
        if (!!this.hoverEndMarker !== endHoverNow) {
            this.hoverEndMarker = endHoverNow;
            this.timelineDirty = true;
        }
        var cursor = 'crosshair';
        if (this.dragState && this.dragState.endMarker) {
            cursor = 'ew-resize';
        } else if (this.dragState && this.dragState.uid && this.dragState.isRangeDrag) {
            var dragPart = String(this.dragState.rangePart || '');
            if (dragPart === 'left' || dragPart === 'right') cursor = 'ew-resize';
            else if (dragPart === 'move') cursor = 'move';
        } else if (hn && hn.isEndMarker) {
            cursor = 'ew-resize';
        } else if (hb && hb.routeRangeUid) {
            var hoverPart = String(hb.routeRangePart || '');
            if (hoverPart === 'left' || hoverPart === 'right') cursor = 'ew-resize';
            else if (hoverPart === 'move') cursor = 'move';
            else cursor = 'pointer';
        } else if (hob) {
            cursor = 'pointer';
        } else if (hn || hc || hb) {
            cursor = 'pointer';
        }
        if (this.timeline.style.cursor !== cursor) this.timeline.style.cursor = cursor;
        var hf = this.xToFrame(x);
        if (Number(this.hoverFrame) !== Number(hf)) {
            this.hoverFrame = Number(hf);
            this.timelineDirty = true;
        }
        this.setHoverNode((hn && hn.isEndMarker) ? null : (hn || null));
        if (hc) {
            var cLines = this.commentTooltipLinesAtFrame(hc.frame);
            this.showTipAt(e.clientX, e.clientY, cLines);
        } else if (hn && hn.isEndMarker) {
            this.showTipAt(e.clientX, e.clientY, ['終了', Math.max(0, Math.floor(Number(hn.frame || 0))) + 'f']);
        } else if (hob) {
            this.showTipAt(e.clientX, e.clientY, hob.dir === 'prev' ? ['前へ'] : ['次へ']);
        } else if (hn || hb) {
            var hit = hn || hb;
            var lines = this.commandTooltipLinesForHit(hit);
            this.showTipAt(e.clientX, e.clientY, lines);
        } else {
            this.showTipAt(0, 0, '');
        }
        if (this.tInfo) {
            var sid = (this.selUid || '-');
            if (this.selRouteListIndex != null && this.selRouteListIndex >= 0) sid += '/route[' + this.selRouteListIndex + ']';
            this.tInfo.textContent = 'frame: ' + this.frame + ' | hover: ' + hf + ' | selected: ' + sid;
        }

        if (this.dragState && this.dragState.endMarker) {
            var dxEnd = x - this.dragState.startX;
            var dyEnd = y - this.dragState.startY;
            if (!this.dragState.moved && (Math.abs(dxEnd) > 3 || Math.abs(dyEnd) > 3)) this.dragState.moved = true;
            if (!this.dragState.moved) return;
            var trEnd = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            var minEnd = this.trackComputedEndFrame(trEnd);
            this.dragState.targetFrame = Math.max(minEnd, this.xToFrame(x));
            this.timelineDirty = true;
            return;
        }

        if (!this.dragState || !this.dragState.uid) return;
        var tr = this.model.tracks[this.selKey];
        if (!tr) return;
        var de = null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === this.dragState.uid) { de = tr.commands[i]; break; }
        }
        if (!de) return;
        var dx = x - this.dragState.startX, dy = y - this.dragState.startY;
        if (!this.dragState.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) this.dragState.moved = true;
        if (!this.dragState.moved) return;

        if (this.dragState.routeListIndex != null && this.dragState.routeListIndex >= 0) {
            var dRouteListIndex = this.nodeRouteIndex(this.dragState.routeListIndex);
            var dRouteUid = Math.floor(Number(this.dragState.uid || 0));
            var dRouteFrame = Math.max(0, Math.floor(Number(this.dragState.startFrame || 0)));
            this.setRangeSelection('rect', [{ kind: 'routeCmd', uid: dRouteUid, routeListIndex: dRouteListIndex }], {
                frameStart: dRouteFrame,
                frameEnd: dRouteFrame,
                rects: [],
                nonContiguous: false
            });
            this.beginRangeMoveDrag(this.dragState.startX, this.dragState.startY, {
                kind: 'routeCmd',
                uid: dRouteUid,
                routeListIndex: dRouteListIndex
            });
            this.dragState = null;
            this.updateRangeMoveDrag(x, y);
            return;
        }

        if (this.dragState.isRangeDrag) {
            var part = String(this.dragState.rangePart || '');
            if (part !== 'left' && part !== 'right' && part !== 'move') {
                this.dragState.valid = true;
                return;
            }
            var pf = this.xToFrame(x);
            var baseMin = 1;
            var leadingWait = 0;
            if (de.command && Number(de.command.code || 0) === 205) {
                var rt = de.command.parameters && de.command.parameters[1];
                baseMin = Math.max(1, this.moveRouteBaseFramesWithoutTrailingWait(rt));
                leadingWait = Math.max(0, this.moveRouteLeadingWaitFrames(rt));
            }
            var ns = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)));
            var nw = Math.max(1, Math.floor(Number(this.dragState.startWait || 1)));
            if (part === 'left') {
                var baseStart = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)));
                var maxStart = baseStart + leadingWait;
                ns = Math.max(0, Math.min(maxStart, pf));
                nw = Math.max(1, Math.floor(Number(this.dragState.startWait || 1)) + (baseStart - ns));
            } else if (part === 'right') {
                ns = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)));
                nw = Math.max(1, pf - ns);
                if (nw < baseMin) nw = baseMin;
            } else if (part === 'move') {
                var delta = pf - Math.max(0, Math.floor(Number(this.dragState.startFrame || 0)));
                ns = Math.max(0, Math.floor(Number(this.dragState.startEntryFrame || 0)) + delta);
                nw = Math.max(1, Math.floor(Number(this.dragState.startWait || 1)));
            }
            this.dragState.targetFrame = ns;
            this.dragState.targetWait = nw;
            var probe = clone(de);
            probe.frame = ns;
            probe.wait = nw;
            this.dragState.valid = this.canPlaceEntry(tr, probe, ns, de.rowKey, de.uid);
            this.timelineDirty = true;
            return;
        }

        var row = this.rowFromY(y);
        var rowKey = row ? row.key : this.dragState.startRowKey;
        var frame = this.xToFrame(x);
        this.dragState.targetFrame = frame;
        this.dragState.targetRowKey = rowKey;
        this.dragState.valid = this.canPlaceEntry(tr, de, frame, rowKey, de.uid);
        this.timelineDirty = true;
    };

    EE.prototype.onTimelineDown = function(e) {
        if (e.button !== 0) return;
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (this.tryStartSpacePanOnTimeline(e, x, y)) return;
        if (this.controlMode) this.setInteractionMode('timeline', 'timeline');
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var onRulerTrack = this.isTimelineRulerPoint(x, y, false);
        var preNode = onRulerAny ? null : this.hitTestNode(x, y);
        var preComment = onRulerAny ? null : this.hitTestComment(x, y);
        var preBar = onRulerAny ? null : this.hitTestBar(x, y);
        var preOrderBtn = onRulerAny ? null : this.hitTestOrderButton(x, y);
        if (preOrderBtn) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.suppressTimelineDblClickUntil = Date.now() + 450;
            if (preOrderBtn.enabled) this.moveSameFrameCommand(Number(preOrderBtn.uid || 0), String(preOrderBtn.dir || 'prev'));
            return;
        }
        if (preNode && preNode.isEndMarker) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            if (this.hasRangeSelection()) this.clearRangeSelection();
            var endFrame = Math.max(0, Math.floor(Number(preNode.frame || 0)));
            this.dragState = {
                endMarker: true,
                startX: x,
                startY: y,
                startFrame: endFrame,
                targetFrame: endFrame,
                moved: false,
                valid: true
            };
            this.frame = endFrame;
            this.timelineDirty = true;
            return;
        }
        if (!onRulerAny && this.hasRangeSelection()) {
            var preSelHit = this.rangeSelectionHitAtPoint(x, y);
            if (preSelHit && this.beginRangeMoveDrag(x, y, preSelHit)) {
                e.preventDefault();
                this.closeRouteRangeContextMenu();
                return;
            }
        }
        if (onRulerTrack) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.beginRangeSelectionDrag('memory', x, y, e);
            return;
        }
        if (!onRulerAny && y > this.rulerH && !preNode && !preBar && !preComment) {
            e.preventDefault();
            this.closeRouteRangeContextMenu();
            this.beginRangeSelectionDrag('rect', x, y, e);
            return;
        }
        e.preventDefault();
        this.closeRouteRangeContextMenu();
        if (this.hasRangeSelection()) this.clearRangeSelection();
        var node = this.hitTestNode(x, y);
        var hb = this.hitTestBar(x, y);
        if (hb && hb.routeRangeUid) {
            var rp = String(hb.routeRangePart || '');
            if (rp === 'body') {
                var nearRouteNode = this.hitTestRouteCommandNodeNear(Number(hb.routeRangeUid || 0), x, y, 5);
                if (nearRouteNode) node = nearRouteNode;
            }
            if (rp === 'left' || rp === 'right' || rp === 'move') {
                var isRouteSubNode = !!node &&
                    Number(node.uid || 0) === Number(hb.routeRangeUid || 0) &&
                    node.routeListIndex != null &&
                    Number(node.routeListIndex) >= 0;
                if (!isRouteSubNode) {
                    var nearHandleNode = this.hitTestRouteCommandNodeNear(Number(hb.routeRangeUid || 0), x, y, 6);
                    if (nearHandleNode) node = nearHandleNode;
                    else node = null;
                }
            }
            else if (node && hb.routeCmdCode == null) {
                var isRouteSubNodeBody = (node.routeListIndex != null && Number(node.routeListIndex) >= 0);
                if (isRouteSubNodeBody) {
                    // Keep move-route sub-command node selection when clicking on a circle.
                } else {
                // Prioritize route-range body hit over node so whole-range selection is easier.
                var ne = this.findEntryInSelectedTrack(Number(node.uid || 0));
                if (ne && ne.command && Number(ne.command.code || 0) === 205 && ne.rowType === 'char') node = null;
                }
            }
        }
        var hoverNode = node;
        if (!hoverNode && hb && hb.routeRangeUid) hoverNode = { uid: hb.routeRangeUid, routeListIndex: -1 };
        this.setHoverNode(hoverNode || null);
        var nodeRouteListIndex = node ? this.nodeRouteIndex(node.routeListIndex) : -1;
        var prevRouteListIndex = this.nodeRouteIndex(this.selRouteListIndex);
        var wasSelected = !!node && Number(this.selUid || 0) === Number(node.uid || 0) && prevRouteListIndex === nodeRouteListIndex;
        var rangeUid = (hb && hb.routeRangeUid) ? Math.floor(Number(hb.routeRangeUid || 0)) : 0;
        var rangeEntry = rangeUid > 0 ? this.findRouteRangeEntryByUid(rangeUid) : null;
        if (!node && rangeEntry) {
            wasSelected = Number(this.selUid || 0) === Number(rangeUid) && prevRouteListIndex < 0;
        }
        var row = this.rowFromY(y);
        var rowKey = node ? node.rowKey : (rangeEntry ? rangeEntry.rowKey : (row ? row.key : 'main'));
        if (String(rowKey || '').indexOf('char:') === 0) {
            var cid = this.normalizeMoveTarget(Number(String(rowKey).replace('char:', '')));
            this.cleanupTemporaryCharRows(cid);
            this.panelSelectedCharId = cid;
        } else {
            this.cleanupTemporaryCharRows(null);
            this.panelSelectedCharId = null;
        }
        this.refreshCharacterPanel(true);
        this.dragState = {
            uid: node ? node.uid : (rangeEntry ? rangeUid : 0),
            routeListIndex: node ? nodeRouteListIndex : null,
            startX: x,
            startY: y,
            startFrame: node ? node.frame : (rangeEntry ? this.xToFrame(x) : this.xToFrame(x)),
            startRowKey: rowKey,
            targetFrame: node ? node.frame : (rangeEntry ? Math.max(0, Math.floor(Number(rangeEntry.frame || 0))) : this.xToFrame(x)),
            targetRowKey: rowKey,
            wasSelected: wasSelected,
            moved: false,
            valid: true,
            emptyClick: !node && !rangeEntry,
            rangePart: rangeEntry ? String(hb.routeRangePart || 'body') : '',
            startWait: rangeEntry ? Math.max(1, Math.floor(Number(rangeEntry.wait || 1))) : 0,
            startEntryFrame: rangeEntry ? Math.max(0, Math.floor(Number(rangeEntry.frame || 0))) : 0,
            targetWait: rangeEntry ? Math.max(1, Math.floor(Number(rangeEntry.wait || 1))) : 0,
            isRangeDrag: !!rangeEntry && !(node && nodeRouteListIndex >= 0)
        };
        if (node) {
            this.selUid = node.uid;
            this.selRouteListIndex = nodeRouteListIndex;
            this.frame = node.frame;
            this.timelineDirty = true;
        } else if (rangeEntry) {
            this.selUid = rangeEntry.uid;
            this.selRouteListIndex = -1;
            this.frame = Math.max(0, Math.floor(Number(rangeEntry.frame || 0)));
            this.timelineDirty = true;
        }
    };

    EE.prototype.onTimelineDblClick = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        if (Date.now() < Number(this.suppressTimelineDblClickUntil || 0)) {
            e.preventDefault();
            return;
        }
        if (this.controlMode) this.setInteractionMode('timeline', 'timeline');
        e.preventDefault();
        if (this.hasRangeSelection()) this.clearRangeSelection();
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (this.isTimelineRulerY(y)) return;
        var frame = this.xToFrame(x);
        var hitNode = this.hitTestNode(x, y);
        if (hitNode) {
            if (hitNode.isEndMarker) {
                this.seek(Math.max(0, Math.floor(Number(hitNode.frame || 0))));
                return;
            }
            this.selUid = Number(hitNode.uid || 0);
            this.selRouteListIndex = this.nodeRouteIndex(hitNode.routeListIndex);
            this.frame = Math.max(0, Math.floor(Number(hitNode.frame || 0)));
            this.timelineDirty = true;
            if (this.selUid) this.openEditor(this.selUid, this.selRouteListIndex >= 0 ? this.selRouteListIndex : undefined);
            return;
        }
        var hitRange = this.hitTestBar(x, y);
        if (hitRange && hitRange.routeRangeUid) {
            var rangeEntry = this.findRouteRangeEntryByUid(Number(hitRange.routeRangeUid || 0));
            var routeHit = this.routeTimelineItemAtFrame(rangeEntry, frame);
            if (rangeEntry && routeHit && routeHit.listIndex >= 0) {
                this.selUid = Number(rangeEntry.uid || 0);
                this.selRouteListIndex = this.nodeRouteIndex(routeHit.listIndex);
                this.frame = Math.max(0, Math.floor(Number(routeHit.frame || frame)));
                this.timelineDirty = true;
                if (this.selUid) this.openEditor(this.selUid, this.selRouteListIndex);
                return;
            }
        }
        var row = this.rowFromY(y);
        var hitBar = hitRange;
        if (hitBar && (!row || String(row.key || '').indexOf('char:') !== 0)) return;
        var rowKey = row ? row.key : 'main';
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.frame = frame;
        this.timelineDirty = true;
        if (String(rowKey || '').indexOf('char:') === 0) {
            var cid = this.normalizeMoveTarget(Number(String(rowKey).replace('char:', '')));
            this.panelSelectedCharId = cid;
            this.cleanupTemporaryCharRows(cid);
            this.refreshCharacterPanel(true);
            this.openRouteCommandPanel(frame, rowKey);
        } else {
            this.panelSelectedCharId = null;
            this.cleanupTemporaryCharRows(null);
            this.refreshCharacterPanel(true);
            if (this.isFrameLockedForFrameCommandAdd(frame)) {
                this.msg('コマンド追加不可: ウェイト実行中フレームです');
                return;
            }
            this.openAddCommandPanel(frame, rowKey, this.makeAddPlacementContextFromFrame(frame));
        }
    };

    EE.prototype.onTimelineContextMenu = function(e) {
        if (!this.timeline || !this.timelineWrap) return;
        e.preventDefault();
        this.closeCameraContextMenu();
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        var clickedFrame = this.xToFrame(x);
        var onRulerAny = this.isTimelineRulerPoint(x, y, true);
        var hn = onRulerAny ? null : this.hitTestNode(x, y);
        var hb = onRulerAny ? null : this.hitTestBar(x, y);
        var hnrli = hn ? this.nodeRouteIndex(hn.routeListIndex) : -1;
        if (!onRulerAny && this.hasRangeSelection() && this.isPointInsideCurrentRangeSelection(x, y)) {
            this.openSelectionContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromSelection());
            return;
        }
        if (hn && hnrli >= 0) {
            var he = this.findEntryInSelectedTrack(Number(hn.uid || 0));
            if (he && he.command && Number(he.command.code || 0) === 205 && he.rowType === 'char') {
                this.selUid = Number(hn.uid || 0);
                this.selRouteListIndex = hnrli;
                this.frame = Math.max(0, Math.floor(Number(hn.frame || clickedFrame || 0)));
                this.timelineDirty = true;
                this.openTimelineContextMenu(
                    e.clientX,
                    e.clientY,
                    this.makeWaitInsertContextFromRouteCommand(Number(hn.uid || 0), hnrli, Number(hn.frame || clickedFrame || 0))
                );
                return;
            }
        }
        var uid = 0;
        if (hb && hb.routeRangeUid) {
            uid = Number(hb.routeRangeUid || 0);
        } else if (hb && hb.uid) {
            var be = this.findEntryInSelectedTrack(Number(hb.uid || 0));
            if (be && be.command && Number(be.command.code || 0) === 205 && be.rowType === 'char') {
                uid = Number(be.uid || 0);
            }
        } else if (hn) {
            var ne = this.findEntryInSelectedTrack(Number(hn.uid || 0));
            if (ne && ne.command && Number(ne.command.code || 0) === 205 && ne.rowType === 'char') {
                uid = Number(ne.uid || 0);
            }
        }
        if (uid > 0) {
            this.selUid = uid;
            this.selRouteListIndex = -1;
            var e2 = this.findEntryInSelectedTrack(uid);
            if (e2) this.frame = Math.max(0, Math.floor(Number(e2.frame || 0)));
            this.timelineDirty = true;
            this.openRouteRangeContextMenu(uid, e.clientX, e.clientY, this.makeWaitInsertContextFromCommand(uid, clickedFrame));
            return;
        }
        var cmdUid = 0;
        if (hn && Number(hn.uid || 0) > 0) cmdUid = Number(hn.uid || 0);
        if (!cmdUid && hb && Number(hb.uid || 0) > 0) cmdUid = Number(hb.uid || 0);
        if (cmdUid > 0) {
            var ce = this.findEntryInSelectedTrack(cmdUid);
            if (ce) {
                this.selUid = cmdUid;
                this.selRouteListIndex = (hn && Number(hn.uid || 0) === cmdUid)
                    ? this.nodeRouteIndex(hn.routeListIndex)
                    : -1;
                this.frame = Math.max(0, Math.floor(Number(ce.frame || clickedFrame || 0)));
                this.timelineDirty = true;
            }
            this.openTimelineContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromCommand(cmdUid, clickedFrame));
            return;
        }
        var row = this.rowFromY(y);
        var rowKey = row ? String(row.key || 'main') : 'main';
        this.openTimelineContextMenu(e.clientX, e.clientY, this.makeWaitInsertContextFromFrame(clickedFrame, rowKey));
    };

    EE.prototype.onTimelineUp = function() {
        if (this.panState) {
            this.endSpacePanDrag();
            this.timelineDirty = true;
            return;
        }
        if (this.rangeSelectDrag) {
            this.finalizeRangeSelectionDrag();
            return;
        }
        if (this.rangeMoveDrag) {
            this.applyRangeMoveDrag();
            return;
        }
        if (!this.dragState) return;
        var ds = this.dragState;
        this.dragState = null;
        if (ds.endMarker) {
            var trEnd = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
            if (!trEnd) return;
            var oldEnd = this.normalizeTrackEndFrame(trEnd);
            var minEnd = this.trackComputedEndFrame(trEnd);
            var targetEnd = Math.max(minEnd, Math.floor(Number((ds.targetFrame == null ? ds.startFrame : ds.targetFrame) || 0)));
            if (ds.moved && targetEnd !== oldEnd) {
                this.pushSnap('endMarker');
                trEnd.endFrame = targetEnd;
                this.normalizeTrackEndFrame(trEnd);
                this.dirty[this.selKey] = true;
            }
            this.seek(Math.max(0, Math.floor(Number(trEnd.endFrame || targetEnd || ds.startFrame || 0))));
            return;
        }
        if (ds.uid) {
            if (ds.isRangeDrag) {
                var trr = this.model.tracks[this.selKey];
                if (!trr) return;
                var re = null;
                for (var ri = 0; ri < trr.commands.length; ri++) {
                    if (trr.commands[ri].uid === ds.uid) { re = trr.commands[ri]; break; }
                }
                if (!re) return;
                var rp = String(ds.rangePart || '');
                if (rp !== 'left' && rp !== 'right' && rp !== 'move') {
                    this.seek(re.frame);
                    return;
                }
                if (!ds.moved) {
                    this.seek(re.frame);
                    return;
                }
                if (!ds.valid) {
                    this.msg('Drop rejected (wait overlap / invalid range)');
                    this.timelineDirty = true;
                    return;
                }
                var oldFrame = Math.max(0, Math.floor(Number(re.frame || 0)));
                var oldWait = Math.max(1, Math.floor(Number(re.wait || 1)));
                var oldCmd = clone(re.command);
                var newFrame = Math.max(0, Math.floor(Number(ds.targetFrame || oldFrame)));
                if (ds.rangePart === 'left' || ds.rangePart === 'right') {
                    var tw = Math.max(1, Math.floor(Number(ds.targetWait || oldWait)));
                    if (newFrame === oldFrame && tw === oldWait) {
                        this.seek(re.frame);
                        return;
                    }
                } else if (newFrame === oldFrame) {
                    this.seek(re.frame);
                    return;
                }
                this.pushSnap('routeRange');
                if (ds.rangePart === 'left') {
                    var deltaLeft = oldFrame - newFrame;
                    if (!this.shiftMoveRouteLeftBoundary(re.command, deltaLeft)) {
                        this.msg('Drop rejected (left range cannot shrink further)');
                        this.timelineDirty = true;
                        return;
                    }
                    re.frame = newFrame;
                    re.wait = this.commandWaitFrames(re.command);
                } else if (ds.rangePart === 'right') {
                    re.frame = oldFrame;
                    this.setMoveRouteDuration(re.command, Math.max(1, Math.floor(Number(ds.targetWait || oldWait))));
                    re.wait = this.commandWaitFrames(re.command);
                } else {
                    re.frame = newFrame;
                    re.wait = this.commandWaitFrames(re.command);
                }
                if (!this.canPlaceEntry(trr, re, re.frame, re.rowKey, re.uid)) {
                    re.frame = oldFrame;
                    re.wait = oldWait;
                    re.command = oldCmd;
                    this.msg('Drop rejected (wait overlap / invalid range)');
                    this.timelineDirty = true;
                    return;
                }
                trr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
                this.selUid = re.uid;
                this.selRouteListIndex = -1;
                this.frame = re.frame;
                this.dirty[this.selKey] = true;
                this.rebuildSchedule();
                this.seek(this.frame);
                return;
            }
            if (ds.routeListIndex != null && ds.routeListIndex >= 0) {
                if (ds.moved) {
                    this.msg('Move-route sub-command drag is disabled');
                    this.timelineDirty = true;
                    return;
                }
                this.seek(ds.startFrame);
                if (ds.wasSelected) this.openEditor(ds.uid, ds.routeListIndex);
                return;
            }
            if (ds.moved) {
                var tr = this.model.tracks[this.selKey];
                if (!tr) return;
                var de = null;
                for (var i = 0; i < tr.commands.length; i++) if (tr.commands[i].uid === ds.uid) { de = tr.commands[i]; break; }
                if (!de) return;
                if (!ds.valid) {
                    this.msg('Drop rejected (wait overlap / invalid row)');
                    this.timelineDirty = true;
                    return;
                }
                this.pushSnap('drag');
                de.frame = Math.max(0, Math.floor(Number(ds.targetFrame || 0)));
                if (de.rowType === 'char') {
                    var cid = Number(String(ds.targetRowKey || '').replace('char:', ''));
                    if (!isNaN(cid)) {
                        de.charId = cid;
                        de.rowKey = 'char:' + cid;
                        if (de.command && de.command.code === 205) de.command.parameters[0] = cid;
                    }
                }
                tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
                this.selUid = de.uid;
                this.selRouteListIndex = -1;
                this.frame = de.frame;
                this.dirty[this.selKey] = true;
                this.rebuildSchedule();
                this.seek(this.frame);
                return;
            }
            this.selRouteListIndex = -1;
            this.seek(ds.startFrame);
            if (ds.wasSelected) this.openEditor(ds.uid);
            return;
        }
        if (ds.emptyClick && !ds.moved) {
            this.selUid = 0;
            this.selRouteListIndex = -1;
            this.closeEditor();
            this.seek(ds.startFrame);
        }
    };

    EE.prototype.onTimelineWheel = function(e) {
        if (!this.timelineWrap) return;
        var r = this.timeline.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        var onRuler = this.isTimelineRulerPoint(x, y, true);
        var doZoom = !!onRuler || !!e.ctrlKey;

        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(this.timelineWrap.clientHeight || 100));
        var dx = Number(e.deltaX || 0) * modeScale;
        var dy = Number(e.deltaY || 0) * modeScale;

        if (doZoom) {
            e.preventDefault();
            var beforeFrame = this.xToFrame(x);
            var beforeX = this.frameToX(beforeFrame);
            var px = this.pxPerFrame;
            var zDelta = (Math.abs(dy) >= Math.abs(dx)) ? dy : dx;
            if (zDelta < 0) px *= 1.15; else if (zDelta > 0) px /= 1.15;
            px = Math.max(this.minPxPerFrame, Math.min(this.maxPxPerFrame, px));
            if (Math.abs(px - this.pxPerFrame) < 0.0001) return;
            this.stopTimelineAutoScrollAnimation();
            this.pxPerFrame = px;
            this.syncTimelineSize();
            var afterX = this.frameToX(beforeFrame);
            this.timelineWrap.scrollLeft += (afterX - beforeX);
            this.timelineDirty = true;
            return;
        }

        var wrap = this.timelineWrap;
        var canScrollX = (wrap.scrollWidth - wrap.clientWidth) > 1;
        var canScrollY = (wrap.scrollHeight - wrap.clientHeight) > 1;
        if (!canScrollX && !canScrollY) return;

        // If only horizontal overflow exists, treat vertical wheel as horizontal pan.
        if (canScrollX && !canScrollY && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (e.shiftKey && canScrollX && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }

        var prevLeft = wrap.scrollLeft;
        var prevTop = wrap.scrollTop;
        if (canScrollX && Math.abs(dx) > 0.01) wrap.scrollLeft += dx;
        if (canScrollY && Math.abs(dy) > 0.01) wrap.scrollTop += dy;
        if (wrap.scrollLeft !== prevLeft || wrap.scrollTop !== prevTop) {
            this.stopTimelineAutoScrollAnimation();
            e.preventDefault();
            this.timelineDirty = true;
        }
    };

    EE.prototype.onExecutionLogWheel = function(e) {
        if (!this.execLogView) return;
        var box = this.execLogView;
        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(box.clientHeight || 100));
        var dx = Number(e.deltaX || 0) * modeScale;
        var dy = Number(e.deltaY || 0) * modeScale;
        var canScrollX = (box.scrollWidth - box.clientWidth) > 1;
        var canScrollY = (box.scrollHeight - box.clientHeight) > 1;
        if (!canScrollX && !canScrollY) return;
        if (canScrollX && !canScrollY && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (e.shiftKey && canScrollX && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        var prevLeft = box.scrollLeft;
        var prevTop = box.scrollTop;
        if (canScrollX && Math.abs(dx) > 0.01) box.scrollLeft += dx;
        if (canScrollY && Math.abs(dy) > 0.01) box.scrollTop += dy;
        if (box.scrollLeft !== prevLeft || box.scrollTop !== prevTop) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    EE.prototype.attachNumberWheelInput = function(input) {
        if (!input || !input.tagName) return;
        if (String(input.tagName).toUpperCase() !== 'INPUT') return;
        if (String(input.type || '').toLowerCase() !== 'number') return;
        if (input._eeWheelHandler) return;
        var self = this;
        var h = function(ev) { self.onEditorNumberWheel(ev); };
        input._eeWheelHandler = h;
        input.addEventListener('wheel', h, { passive: false });
        input.addEventListener('mousewheel', h, { passive: false });
    };

    EE.prototype.attachSelectWheelInput = function(select) {
        if (!select || !select.tagName) return;
        if (String(select.tagName).toUpperCase() !== 'SELECT') return;
        if (select._eeWheelHandler) return;
        var self = this;
        var h = function(ev) { self.onEditorSelectWheel(ev); };
        select._eeWheelHandler = h;
        select.addEventListener('wheel', h, { passive: false });
        select.addEventListener('mousewheel', h, { passive: false });
    };

    EE.prototype.isEditorDialogOpenForWheel = function() {
        return !!(
            (this.modal && this.modal.classList && this.modal.classList.contains('on')) ||
            (this.waitInsertModal && this.waitInsertModal.classList && this.waitInsertModal.classList.contains('on')) ||
            (this.memoModal && this.memoModal.classList && this.memoModal.classList.contains('on')) ||
            (this.routeModal && this.routeModal.classList && this.routeModal.classList.contains('on')) ||
            (this.addModal && this.addModal.classList && this.addModal.classList.contains('on'))
        );
    };

    EE.prototype.onEditorNumberWheel = function(e) {
        var target = e && e.target ? e.target : null;
        if (!target || !target.tagName) return false;
        if (String(target.tagName).toUpperCase() !== 'INPUT') return false;
        if (String(target.type || '').toLowerCase() !== 'number') return false;
        if (!this.root || !this.root.contains(target)) return false;
        if (!this.isEditorDialogOpenForWheel()) return false;
        if (target.disabled || target.readOnly) return false;

        var delta = Number(e.deltaY || 0);
        if (Math.abs(delta) < 0.0001) delta = Number(e.deltaX || 0);
        if (Math.abs(delta) < 0.0001 && e && e.wheelDelta != null) delta = -Number(e.wheelDelta || 0);
        if (Math.abs(delta) < 0.0001) return false;

        var stepText = String(target.step || '');
        var step = Number(stepText);
        if (!isFinite(step) || step <= 0) step = 1;
        var nowValue = Number(target.value);
        if (!isFinite(nowValue)) nowValue = 0;
        var dir = (delta < 0) ? 1 : -1;
        var next = nowValue + step * dir;

        function inputAttrNumber(input, attr) {
            if (!input || !input.getAttribute) return NaN;
            var raw = input.getAttribute(attr);
            if (raw == null) return NaN;
            var text = String(raw).trim();
            if (!text.length) return NaN;
            var n = Number(text);
            return isFinite(n) ? n : NaN;
        }
        var min = inputAttrNumber(target, 'min');
        var max = inputAttrNumber(target, 'max');
        if (isFinite(min) && next < min) next = min;
        if (isFinite(max) && next > max) next = max;

        function countStepDecimals(text) {
            text = String(text || '').toLowerCase();
            if (!text.length || text === 'any') return 0;
            var expIdx = text.indexOf('e-');
            if (expIdx >= 0) {
                var exp = Number(text.slice(expIdx + 2));
                if (isFinite(exp) && exp > 0) return Math.floor(exp);
            }
            var dot = text.indexOf('.');
            return dot >= 0 ? Math.max(0, text.length - dot - 1) : 0;
        }
        function trimTrailingZeros(valueText) {
            return String(valueText).replace(/(\.\d*?[1-9])0+$/g, '$1').replace(/\.0+$/g, '');
        }

        var digits = countStepDecimals(stepText);
        var pow = Math.pow(10, digits);
        if (digits > 0 && isFinite(pow) && pow > 0) next = Math.round(next * pow) / pow;
        target.value = (digits > 0) ? trimTrailingZeros(next.toFixed(digits)) : String(Math.round(next));

        try {
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.onEditorSelectWheel = function(e) {
        var target = e && e.target ? e.target : null;
        if (!target) return false;
        var select = null;
        var node = target;
        while (node) {
            if (node.tagName && String(node.tagName).toUpperCase() === 'SELECT') {
                select = node;
                break;
            }
            node = node.parentElement;
        }
        if (!select || !select.tagName) return false;
        if (!this.root || !this.root.contains(select)) return false;
        if (!this.isEditorDialogOpenForWheel()) return false;
        if (select.disabled) return false;
        var len = select.options ? select.options.length : 0;
        if (!len) return false;

        var delta = Number(e.deltaY || 0);
        if (Math.abs(delta) < 0.0001) delta = Number(e.deltaX || 0);
        if (Math.abs(delta) < 0.0001 && e && e.wheelDelta != null) delta = -Number(e.wheelDelta || 0);
        if (Math.abs(delta) < 0.0001) return false;

        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(select.clientHeight || 100));

        var isList = !!select.multiple || Number(select.size || 0) > 1;
        if (isList) {
            var prevTop = Number(select.scrollTop || 0);
            select.scrollTop = prevTop + delta * modeScale;
            var canScrollY = (Number(select.scrollHeight || 0) - Number(select.clientHeight || 0)) > 1;
            if (canScrollY) {
                e.preventDefault();
                e.stopPropagation();
                return true;
            }
        }

        var dir = (delta > 0) ? 1 : -1;
        var idx = Math.floor(Number(select.selectedIndex || 0));
        if (!isFinite(idx) || idx < 0) idx = 0;
        idx += dir;
        if (idx < 0) idx = 0;
        if (idx >= len) idx = len - 1;
        if (idx === Number(select.selectedIndex || 0) && Number(select.size || 0) <= 1) {
            e.preventDefault();
            e.stopPropagation();
            return true;
        }
        select.selectedIndex = idx;
        try {
            var opt = select.options[idx];
            if (opt && opt.scrollIntoView) opt.scrollIntoView({ block: 'nearest' });
        } catch (_) {}
        try {
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.onUi = function(x, y) {
        if (!this.root) return false;
        if (this.routeModal && this.routeModal.classList && this.routeModal.classList.contains('on')) return true;
        if (this.modal && this.modal.classList && this.modal.classList.contains('on')) return true;
        if (this.addModal && this.addModal.classList && this.addModal.classList.contains('on')) return true;
        if (this.waitInsertModal && this.waitInsertModal.classList && this.waitInsertModal.classList.contains('on')) return true;
        if (this.memoModal && this.memoModal.classList && this.memoModal.classList.contains('on')) return true;
        if (this.memoScrollLane && this.memoScrollLane.style && this.memoScrollLane.style.display !== 'none') {
            var lr = this.memoScrollLane.getBoundingClientRect();
            if (x >= lr.left && x <= lr.right && y >= lr.top && y <= lr.bottom) return true;
        }
        if (this.cameraCtx && this.cameraCtx.classList && this.cameraCtx.classList.contains('on')) {
            var cr = this.cameraCtx.getBoundingClientRect();
            if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom) return true;
        }
        if (this.routeCtx && this.routeCtx.classList && this.routeCtx.classList.contains('on')) {
            var rr = this.routeCtx.getBoundingClientRect();
            if (x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom) return true;
        }
        if (this.charCtx && this.charCtx.classList && this.charCtx.classList.contains('on')) {
            var mr = this.charCtx.getBoundingClientRect();
            if (x >= mr.left && x <= mr.right && y >= mr.top && y <= mr.bottom) return true;
        }
        var ps = this.root.querySelectorAll('.p');
        for (var i = 0; i < ps.length; i++) {
            var r = ps[i].getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
        }
        return false;
    };

    EE.prototype.selectEvent = function(eid, skipUndo) {
        // Drop transient character rows from the currently selected track
        // before switching selection.
        this.cleanupTemporaryCharRows(null);
        var ev = $gameMap.event(eid);
        if (!ev || ev._pageIndex < 0) {
            this.selEid = 0; this.selPage = -1; this.selKey = ''; this.selUid = 0; this.selRouteListIndex = -1;
            this._timelineViewPending = null;
            this.panelSelectedCharId = null;
            this.closeEditor();
            this.closeAddCommandPanel();
            this.closeRouteCommandPanel();
            this.closeWaitInsertDialog();
            this.closeMemoEditor();
            this.closeCharContextMenu();
            this.closeCameraContextMenu();
            this.closeRouteRangeContextMenu();
            this.refreshEventInfo(); this.timelineDirty = true;
            this.refreshCharacterPanel(true);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            return;
        }
        if (!skipUndo) this.pushSnap('select');
        this.selEid = eid;
        this.selPage = ev._pageIndex;
        this.selKey = this.key(eid, ev._pageIndex);
        this.ensureTrack(eid, ev._pageIndex);
        this.queueTimelineViewRestoreForTrack(eid, ev._pageIndex);
        this.selUid = 0;
        this.selRouteListIndex = -1;
        this.panelSelectedCharId = Number(eid || 0);
        this.closeEditor();
        this.closeAddCommandPanel();
        this.closeRouteCommandPanel();
        this.closeWaitInsertDialog();
        this.closeMemoEditor();
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        this.refreshEventInfo();
        this.rebuildSchedule();
        this.timelineDirty = true;
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
    };

    EE.prototype.makeMoveScriptCmd = function(script) {
        return {
            code: 205, indent: 0, parameters: [0, {
                repeat: false, skippable: false, wait: false,
                list: [{ code: Game_Character.ROUTE_SCRIPT, parameters: [String(script || '')] }, { code: 0, parameters: [] }]
            }]
        };
    };

    EE.prototype.addCmd = function(cmd, f) {
        if (!this.needSelTrack()) return;
        f = Math.max(0, Math.floor(f === undefined ? this.frame : f));
        var tr = this.ensureTrack(this.selEid, this.selPage);
        var e = this.entryFromCommand(clone(cmd), this.selEid, this.selPage, f);
        if (!e) return null;
        if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, 0)) {
            this.logDropConflictDetail(tr, e, e.frame, e.rowKey, 0, 'addCmd');
            this.err('E_DROP_CONFLICT', new Error('command overlaps with wait-range'));
            return null;
        }
        this.pushSnap('addCmd');
        tr.commands.push(e);
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        if (e.rowType === 'char') this.confirmCharRowPermanent(e.charId);
        this.selUid = e.uid;
        this.selRouteListIndex = -1;
        this.frame = this.advanceTargetFrameByWait(e.frame, e.wait);
        this.dirty[this.selKey] = true;
        this.rebuildSchedule();
        this.playFrom(this.frame);
        return e;
    };

    EE.prototype.addWait = function() {
        if (!this.needSelTrack()) return;
        this.openWaitInsertDialog(this.makeWaitInsertContextFromFrame(this.frame));
    };

    EE.prototype.listFromTrack = function(tr) {
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        var out = [], lf = 0, prevMsgExt = null;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            var f = Math.max(0, Math.floor(Number(e.frame || 0)));
            if (f > lf) out.push({ code: 230, indent: 0, parameters: [f - lf] });
            var cmd = clone(e.command || { code: 0, indent: 0, parameters: [] });
            if (cmd.code === 205) {
                if (!cmd.parameters) cmd.parameters = [0, { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] }];
                cmd.parameters[0] = this.normalizeMoveTarget(e.charId == null ? cmd.parameters[0] : e.charId);
                this.stripRouteEditorMeta(cmd.parameters[1]);
                out.push(cmd);
                var mr = cmd.parameters[1];
                var mrl = mr && Array.isArray(mr.list) ? mr.list : [];
                for (var r = 0; r < mrl.length; r++) {
                    var mcmd = mrl[r];
                    if (!mcmd || Number(mcmd.code || 0) === 0) continue;
                    out.push({ code: 505, indent: Number(cmd.indent || 0), parameters: [clone(mcmd)] });
                }
            } else if (cmd.code === 212) {
                var animSpec = this.animationRequestSpecFromEntry({ command: cmd });
                if (!animSpec) {
                    animSpec = { targetId: 0, animationId: 1, addX: 0, addY: 0, scale: 1, wait: false };
                }
                var animScript = this.makeCharacterRequestAnimationScript(
                    animSpec.targetId,
                    animSpec.animationId,
                    animSpec.addX,
                    animSpec.addY,
                    animSpec.scale
                );
                out.push({ code: 355, indent: Number(cmd.indent || 0), parameters: [animScript] });
                if (animSpec.wait) out.push({ code: 230, indent: Number(cmd.indent || 0), parameters: [60] });
            } else if (cmd.code === 108) {
                this.memoApplyParsedStateToEntry(e);
                if (e.isMemo) {
                    var memoLine = this.memoCommentLine(e.memoSize, e.memoText);
                    e.commentLines = [memoLine];
                    out.push({ code: 108, indent: Number(cmd.indent || 0), parameters: [memoLine] });
                } else {
                    var lines = e.commentLines && e.commentLines.length ? e.commentLines : [String((cmd.parameters || [''])[0] || '')];
                    out.push({ code: 108, indent: Number(cmd.indent || 0), parameters: [String(lines[0] || '')] });
                    for (var j = 1; j < lines.length; j++) {
                        out.push({ code: 408, indent: Number(cmd.indent || 0), parameters: [String(lines[j] || '')] });
                    }
                }
            } else if (cmd.code === 101) {
                var delta = this.messageExtDeltaForOutput(e, prevMsgExt);
                var pre = delta && Array.isArray(delta.commands) ? delta.commands : [];
                for (var pm = 0; pm < pre.length; pm++) out.push(pre[pm]);
                prevMsgExt = delta ? delta.nextState : prevMsgExt;
                out.push(cmd);
                var mls = Array.isArray(e.messageLines) ? e.messageLines : [];
                for (var k = 0; k < mls.length; k++) {
                    out.push({ code: 401, indent: Number(cmd.indent || 0), parameters: [String(mls[k] || '')] });
                }
            } else if (cmd.code === 355) {
                var sls = (e.scriptLines && e.scriptLines.length)
                    ? e.scriptLines
                    : [String((cmd.parameters || [''])[0] || '')];
                cmd.parameters = [String(sls[0] || '')];
                out.push(cmd);
                for (var si = 1; si < sls.length; si++) {
                    out.push({ code: 655, indent: Number(cmd.indent || 0), parameters: [String(sls[si] || '')] });
                }
            } else if (cmd.code === 105) {
                out.push(cmd);
                var tls = Array.isArray(e.scrollLines) ? e.scrollLines : [];
                for (var ti = 0; ti < tls.length; ti++) {
                    out.push({ code: 405, indent: Number(cmd.indent || 0), parameters: [String(tls[ti] || '')] });
                }
            } else {
                out.push(cmd);
            }
            lf = Math.max(lf, f + Math.max(0, Math.floor(Number(e.wait || 0))));
        }
        var endFrame = this.normalizeTrackEndFrame(tr);
        if (endFrame > lf) {
            out.push({ code: 230, indent: 0, parameters: [endFrame - lf] });
            lf = endFrame;
        }
        out.push({ code: 0, indent: 0, parameters: [] });
        return out;
    };

    var _eeBaseRebuildSchedule = EE.prototype.rebuildSchedule;
    EE.prototype.rebuildSchedule = function() {
        if (this._eeRebuildScheduleGuard) {
            _eeBaseRebuildSchedule.call(this);
            return;
        }
        this._eeRebuildScheduleGuard = true;
        try {
            // 1) Build latest schedule from current model so simTo() can see edits.
            _eeBaseRebuildSchedule.call(this);

            // 2) Auto-adjust tile-goto wait lengths after any edit/add/move.
            if (!this.play && this.model && this.model.tracks) {
                var ks = Object.keys(this.model.tracks);
                for (var i = 0; i < ks.length; i++) {
                    var tr = this.model.tracks[ks[i]];
                    if (!tr || !Array.isArray(tr.commands)) continue;
                    var hasRoute = false;
                    for (var j = 0; j < tr.commands.length; j++) {
                        var ce = tr.commands[j];
                        if (ce && ce.command && Number(ce.command.code || 0) === 205) { hasRoute = true; break; }
                    }
                    if (!hasRoute) continue;
                    this.normalizeTrackRouteTileGotoWaitMeta(tr);
                }
            }

            // 3) Rebuild once more to apply updated wait lengths to schedule/hit ranges.
            _eeBaseRebuildSchedule.call(this);
        } finally {
            this._eeRebuildScheduleGuard = false;
        }
    };

    var _eeBaseSave = EE.prototype.save;
    EE.prototype.save = function(backupOnly) {
        _eeBaseSave.call(this, backupOnly);
        if (backupOnly) return;
        this.persistSelectedTimelineViewStateToDisk();
    };

    // Extend snapshot/restore for timeline-only UI state so undo/redo remains stable.
    var _eeBaseSnap = EE.prototype.snap;
    EE.prototype.snap = function(label) {
        var s = _eeBaseSnap.call(this, label);
        s.panelSelectedCharId = (this.panelSelectedCharId == null) ? null : Number(this.panelSelectedCharId);
        if (this.rangeSelection && typeof this.rangeSelection === 'object') {
            s.rangeSelection = {
                kind: String(this.rangeSelection.kind || 'none'),
                items: this.normalizeRangeSelectionItems(Array.isArray(this.rangeSelection.items) ? this.rangeSelection.items : []),
                frameStart: Math.max(0, Math.floor(Number(this.rangeSelection.frameStart || 0))),
                frameEnd: Math.max(0, Math.floor(Number(this.rangeSelection.frameEnd || 0))),
                rects: Array.isArray(this.rangeSelection.rects) ? clone(this.rangeSelection.rects) : [],
                nonContiguous: !!this.rangeSelection.nonContiguous
            };
        } else {
            s.rangeSelection = null;
        }
        return s;
    };

    var _eeBaseLoadSnap = EE.prototype.loadSnap;
    EE.prototype.loadSnap = function(s) {
        _eeBaseLoadSnap.call(this, s);
        if (this.dragMode === 'tile' || this.tileMoveState) this.cancelTileMoveMode(true);
        if (this.panState) this.endSpacePanDrag();
        this.dragState = null;
        this.rangeSelectDrag = null;
        this.rangeMoveDrag = null;
        this.closeEditor();
        this.closeAddCommandPanel();
        this.closeRouteCommandPanel();
        this.closeWaitInsertDialog();
        this.closeMemoEditor();
        this.closeCharContextMenu();
        this.closeCameraContextMenu();
        this.closeRouteRangeContextMenu();
        this.setHoverNode(null);
        this.hoverFrame = -1;
        this.hoverRangeUid = 0;
        this.hoverRangePart = '';
        this.hoverEndMarker = false;
        this.showTipAt(0, 0, '');
        var rs = s && s.rangeSelection ? s.rangeSelection : null;
        if (rs && typeof rs === 'object') {
            var kind = String(rs.kind || 'none');
            if (kind !== 'memory' && kind !== 'rect') kind = 'none';
            var items = this.normalizeRangeSelectionItems(Array.isArray(rs.items) ? rs.items : []);
            var map = Object.create(null);
            for (var i = 0; i < items.length; i++) map[this.rangeSelectionItemKey(items[i])] = true;
            var fs = Math.max(0, Math.floor(Number(rs.frameStart || 0)));
            var fe = Math.max(fs, Math.floor(Number(rs.frameEnd == null ? fs : rs.frameEnd)));
            this.rangeSelection = {
                kind: (kind !== 'none' && (items.length || kind === 'memory')) ? kind : 'none',
                items: items,
                itemMap: map,
                frameStart: fs,
                frameEnd: fe,
                rects: Array.isArray(rs.rects) ? clone(rs.rects) : [],
                nonContiguous: !!rs.nonContiguous
            };
        } else {
            this.rangeSelection = {
                kind: 'none',
                items: [],
                itemMap: Object.create(null),
                frameStart: 0,
                frameEnd: 0,
                rects: [],
                nonContiguous: false
            };
        }
        this.panelSelectedCharId = (s && s.panelSelectedCharId != null)
            ? Number(s.panelSelectedCharId)
            : (this.selEid > 0 ? Number(this.selEid) : null);
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
    };


})();
