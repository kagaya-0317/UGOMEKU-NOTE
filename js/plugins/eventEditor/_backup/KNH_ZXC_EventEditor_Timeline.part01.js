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
