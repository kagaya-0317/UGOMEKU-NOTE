//=============================================================================
// KNH_ZXC_EventEditor_Style
//=============================================================================

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    NS._eeStyleText = [
        '#knh-ee{position:fixed;left:0;top:0;width:100%;height:100%;z-index:9999;pointer-events:none;font-family:"Yu Gothic UI","Meiryo UI",sans-serif;color:#eef3f6;}',
        '#knh-ee,#knh-ee *{scrollbar-width:thin;scrollbar-color:rgba(96,106,120,.95) rgba(8,12,18,.92);}',
        'html.knh-ee-cursor-move, html.knh-ee-cursor-move *{cursor:move !important;}',
        '#knh-ee::-webkit-scrollbar,#knh-ee *::-webkit-scrollbar{width:12px;height:12px;}',
        '#knh-ee::-webkit-scrollbar-track,#knh-ee *::-webkit-scrollbar-track{background:rgba(8,12,18,.92);}',
        '#knh-ee::-webkit-scrollbar-thumb,#knh-ee *::-webkit-scrollbar-thumb{background:rgba(96,106,120,.95);border:2px solid rgba(8,12,18,.92);border-radius:10px;}',
        '#knh-ee::-webkit-scrollbar-thumb:hover,#knh-ee *::-webkit-scrollbar-thumb:hover{background:rgba(126,138,154,.98);}',
        '#knh-ee::-webkit-scrollbar-corner,#knh-ee *::-webkit-scrollbar-corner{background:rgba(8,12,18,.92);}',
        '#knh-ee .p{position:absolute;z-index:20;background:rgba(10,16,22,.84);border:1px solid rgba(255,255,255,.25);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.36);pointer-events:auto;}',
        '#knh-ee .l{left:8px;top:8px;width:158px;max-height:calc(50% - 16px);padding:10px;overflow:hidden;display:flex;flex-direction:column;}',
        '#knh-ee .ld{left:178px;top:8px;width:162px;max-height:calc(50% - 16px);padding:10px;overflow:auto;}',
        '#knh-ee .r{right:8px;top:8px;width:340px;height:calc(50% - 16px);padding:10px;overflow:hidden;display:flex;flex-direction:column;}',
        '#knh-ee.ee-battle .ovl,#knh-ee.ee-battle .oadjline,#knh-ee.ee-battle .radj,#knh-ee.ee-battle .tmg,#knh-ee.ee-battle .tmk,#knh-ee.ee-battle .mmlane,#knh-ee.ee-battle .mmlbl-layer,#knh-ee.ee-battle .gf,#knh-ee.ee-battle .gfv,#knh-ee.ee-battle .gvg{display:none !important;}',
        '#knh-ee.ee-battle .t{top:calc(66% + 24px);}',
        '#knh-ee .t{left:8px;right:8px;top:calc(50% + 40px);bottom:8px;padding:8px 8px 0 8px;display:flex;flex-direction:column;}',
        '#knh-ee .ti{font-size:13px;font-weight:700;margin-bottom:6px;}',
        '#knh-ee .rw{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}',
        '#knh-ee .b{padding:4px 8px;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(34,56,74,.9);color:#f3f4f5;font-size:12px;cursor:pointer;}',
        '#knh-ee .b.good{background:rgba(22,86,38,.94);}',
        '#knh-ee .b.warn{background:rgba(102,40,20,.94);}',
        '#knh-ee .i{font-size:12px;line-height:1.4;white-space:pre-wrap;}',
        '#knh-ee .charlist{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-height:0;max-height:none;overflow:auto;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.24);padding:4px;}',
        '#knh-ee .charit{display:flex;align-items:center;width:100%;min-height:24px;height:auto;box-sizing:border-box;text-align:left;padding:3px 6px;border:1px solid rgba(255,255,255,.18);border-radius:4px;background:rgba(34,56,74,.52);color:#e8f0ff;font-size:12px;line-height:1.35;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '#knh-ee .charit:hover{background:rgba(48,74,96,.68);}',
        '#knh-ee .charit.v{color:#d2ffd8;border-color:rgba(120,230,145,.5);background:rgba(24,78,42,.38);}',
        '#knh-ee .charit.sel{border-color:rgba(80,160,255,.92);box-shadow:0 0 0 1px rgba(145,198,255,.72) inset;background:rgba(38,68,108,.72);}',
        '#knh-ee .charhint{margin-top:6px;font-size:11px;color:rgba(195,210,232,.95);line-height:1.3;white-space:pre-wrap;}',
        '#knh-ee .cinfo{font-size:12px;line-height:1.35;white-space:pre-wrap;color:#dbe8ff;}',
        '#knh-ee .cinfo .line{display:block;}',
        '#knh-ee .cinfo .chg{color:#ffe26f;font-weight:700;}',
        '#knh-ee .chctx{position:fixed;display:none;z-index:30;min-width:148px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
        '#knh-ee .chctx.on{display:block;}',
        '#knh-ee .chctx button{display:block;width:100%;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
        '#knh-ee .chctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
        '#knh-ee .camctx{position:fixed;display:none;z-index:30;min-width:184px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
        '#knh-ee .camctx.on{display:block;}',
        '#knh-ee .camctx button{display:block;width:100%;margin:0 0 3px 0;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
        '#knh-ee .camctx button:last-child{margin-bottom:0;}',
        '#knh-ee .camctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
        '#knh-ee .mpctx{position:fixed;display:none;z-index:30;min-width:184px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
        '#knh-ee .mpctx.on{display:block;}',
        '#knh-ee .mpctx button{display:block;width:100%;margin:0;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
        '#knh-ee .mpctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
        '#knh-ee .rtctx{position:fixed;display:none;z-index:31;min-width:200px;padding:4px;background:#2d343b;border:1px solid rgba(170,185,208,.46);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.42);pointer-events:auto;}',
        '#knh-ee .rtctx.on{display:block;}',
        '#knh-ee .rtctx button{display:block;width:100%;margin:0 0 3px 0;padding:5px 8px;text-align:left;background:#47515b;border:1px solid rgba(170,185,208,.34);border-radius:4px;color:#edf3ff;font-size:12px;cursor:pointer;}',
        '#knh-ee .rtctx button:last-child{margin-bottom:0;}',
        '#knh-ee .rtctx button:disabled{background:#3d4349;border-color:rgba(130,142,156,.3);color:#98a4b3;cursor:not-allowed;}',
        '#knh-ee .rtctx .rtctxclrlabel{display:none;margin:2px 0 4px 0;padding:0 2px;color:rgba(210,226,246,.95);font-size:11px;line-height:1.2;}',
        '#knh-ee .rtctx .rtctxclr{display:none;flex-wrap:wrap;gap:4px;margin:0 0 4px 0;padding:0 1px;}',
        '#knh-ee .rtctx .rtctxclr button{display:inline-flex;width:22px;min-width:22px;height:22px;margin:0;padding:0;align-items:center;justify-content:center;text-align:center;border-radius:4px;background:#596472;border:1px solid rgba(180,198,220,.58);color:#f3f6ff;font-size:11px;line-height:1;cursor:pointer;}',
        '#knh-ee .rtctx .rtctxclr button.sel{box-shadow:0 0 0 2px rgba(238,246,255,.92) inset,0 0 0 1px rgba(0,0,0,.65);}',
        '#knh-ee .rtctx .rtctxclr button:disabled{opacity:.45;cursor:not-allowed;}',
        '#knh-ee .gbm{position:fixed;left:0;right:0;bottom:0;top:50%;background:rgba(2,6,10,.96);pointer-events:none;z-index:0;}',
        '#knh-ee .ovl{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:3;}',
        '#knh-ee .ovit{position:fixed;box-sizing:border-box;border:1px solid rgba(236,188,120,.45);background:rgba(205,150,90,.10);pointer-events:auto;cursor:pointer;}',
        '#knh-ee .ovit.sel{border:2px solid rgba(255,175,90,.96);background:rgba(255,140,60,.14);box-shadow:0 0 0 1px rgba(255,205,145,.75) inset;}',
        '#knh-ee .ovnm{position:absolute;left:0;top:-13px;display:block;max-width:100%;padding:1px 4px;box-sizing:border-box;border-radius:3px;background:rgba(8,14,22,.8);border:1px solid rgba(236,194,140,.46);color:#e3efff;font-size:8px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer;}',
        '#knh-ee .ovit.sel .ovnm{border-color:rgba(255,188,120,.78);color:#fff5ea;}',
        '#knh-ee .ovl.tilemode .ovit,#knh-ee .ovl.tilemode .ovnm{pointer-events:none !important;cursor:default !important;}',
        '#knh-ee .oadjline{position:fixed;display:none;pointer-events:none;z-index:6;box-sizing:border-box;height:0;border-top:2px solid rgba(255,112,112,.98);box-shadow:0 0 0 1px rgba(40,8,8,.85),0 0 6px rgba(255,120,120,.6);}',
        '#knh-ee .oadjline .oadjlbl{position:absolute;left:0;top:-18px;padding:2px 6px;border-radius:4px;background:rgba(24,6,8,.88);border:1px solid rgba(255,136,136,.88);color:#ffe9e9;font-size:11px;line-height:1;white-space:nowrap;}',
        '#knh-ee .radj{position:fixed;display:none;left:0;top:0;right:0;bottom:0;pointer-events:auto;z-index:7;}',
        '#knh-ee .radj .radjcell{position:fixed;box-sizing:border-box;border:1px solid rgba(255,136,136,.62);background:rgba(255,96,96,.02);pointer-events:auto;cursor:pointer;}',
        '#knh-ee .radj .radjcell.on{background:rgba(255,82,82,.28);border-color:rgba(255,168,168,.92);box-shadow:0 0 0 1px rgba(120,24,24,.62) inset;}',
        '#knh-ee .tmg{position:fixed;display:none;pointer-events:none;z-index:4;opacity:.48;image-rendering:pixelated;filter:saturate(.75) brightness(1.08);}',
        '#knh-ee .tmk{position:fixed;display:none;pointer-events:none;z-index:4;box-sizing:border-box;border:2px dashed rgba(255,216,125,.98);background:rgba(255,185,72,.20);box-shadow:0 0 0 1px rgba(255,243,196,.66) inset;}',
        '#knh-ee .tmkl{position:absolute;left:0;top:-18px;padding:2px 5px;border-radius:4px;background:rgba(8,14,22,.88);border:1px solid rgba(255,216,125,.82);color:#fff8e3;font-size:11px;line-height:1;white-space:nowrap;}',
        '#knh-ee .tmk.start{z-index:5;border-width:2px;border-style:dotted;border-color:rgba(168,206,238,.92);background:rgba(124,168,206,.14);box-shadow:0 0 0 1px rgba(218,236,255,.62) inset;opacity:.86;}',
        '#knh-ee .tmk.start .tmkl{border-color:rgba(168,206,238,.88);color:#edf6ff;background:rgba(10,16,24,.72);}',
        '#knh-ee .tmk.hover{z-index:4;border-style:solid;border-color:rgba(132,238,198,.92);background:rgba(96,188,152,.18);box-shadow:0 0 0 1px rgba(210,255,240,.52) inset;}',
        '#knh-ee .tmk.hover .tmkl{border-color:rgba(132,238,198,.88);color:#e8fff5;background:rgba(8,16,16,.78);}',
        '#knh-ee .tv{position:relative;flex:1 1 auto;min-height:0;height:auto;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.38);overflow:auto;}',
        '#knh-ee .mmlane{position:fixed;display:none;z-index:24;pointer-events:none;}',
        '#knh-ee .mmdot{position:absolute;width:8px;height:8px;border-radius:999px;transform:translate(-50%,-50%);background:rgba(80,220,110,.98);border:1px solid rgba(16,54,20,.98);box-shadow:0 0 0 1px rgba(0,0,0,.45);pointer-events:auto;cursor:pointer;}',
        '#knh-ee .mmdot:hover{background:rgba(122,255,145,.98);}',
        '#knh-ee .mmdotlbl{position:absolute;left:0;top:12px;transform:translateX(-50%);font-size:10px;line-height:1.2;font-weight:700;color:rgba(214,255,220,.98);background:transparent;border:none;border-radius:0;padding:0;text-align:center;white-space:normal;word-break:break-word;overflow-wrap:anywhere;width:max-content;max-width:180px;pointer-events:none;box-sizing:border-box;text-shadow:0 1px 1px rgba(0,0,0,.9);}',
        '#knh-ee .mmlbl-layer{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:23;}',
        '#knh-ee .mmlbl{position:fixed;padding:0;border:none;background:transparent;color:rgba(214,255,220,.98);font-weight:700;line-height:1.15;text-align:center;white-space:normal;word-break:break-word;overflow-wrap:anywhere;width:max-content;max-width:220px;text-shadow:0 1px 1px rgba(0,0,0,.9);}',
        '#knh-ee .mmlbl.m{font-size:10px;}',
        '#knh-ee .mmlbl.l{font-size:12px;}',
        '#knh-ee .t > .i{margin:22px 0 0 0;flex:0 0 auto;}',
        '#knh-ee .cv{display:block;cursor:crosshair;}',
        '#knh-ee .cv-overlay{position:absolute;left:0;top:0;pointer-events:none;z-index:3;}',
        '#knh-ee .s{position:absolute;z-index:21;left:50%;right:auto;transform:translateX(-50%);top:46px;min-height:24px;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.46);border:1px solid rgba(255,255,255,.2);font-size:12px;pointer-events:none;width:max-content;max-width:calc(100% - 24px);text-align:center;}',
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
        '#knh-ee .mb.ee-prompt{z-index:90;}',
        '#knh-ee .mb.tilepick{background:transparent;}',
        '#knh-ee .mb .mbtp{position:fixed;display:none;background:rgba(0,0,0,.42);pointer-events:auto;}',
        '#knh-ee .mb.tilepick .mbtp{display:block;}',
        '#knh-ee .mw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:410px;max-width:92vw;max-height:88vh;overflow:auto;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}',
        '#knh-ee .mw.with-apv{width:700px;max-width:96vw;}',
        '#knh-ee .mw.script355{width:590px;max-width:97vw;}',
        '#knh-ee .mw.script355 .ed-script355-text{font-size:12px;min-height:320px;}',
        '#knh-ee .mw .h{font-size:12px;line-height:1.1;font-weight:700px;margin:0;padding:5px 8px;background:#607eab;color:#eef3ff;border-radius:10px 10px 0 0;}',
        '#knh-ee .mw .sec{padding:12px 16px;}',
        '#knh-ee .mw label{display:block;font-size:12px;margin:8px 0 4px;color:#d7e3f6;}',
        '#knh-ee .mw input,#knh-ee .mw textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}',
        '#knh-ee .mw input[type=checkbox]{width:auto !important;transform:scale(2);transform-origin:center center;margin:0;accent-color:#67be7a;}',
        '#knh-ee .mw input[type=radio]{width:auto !important;padding:0;border:none;background:transparent;accent-color:#67be7a;}',
        '#knh-ee .mw textarea{min-height:90px;resize:vertical;line-height:1.35;}',
        '#knh-ee .plist{display:flex;flex-direction:column;gap:8px;}',
        '#knh-ee .prow{display:flex;flex-direction:column;gap:4px;}',
        '#knh-ee .plbl{font-size:11px;color:rgba(180,205,240,.96);}',
        '#knh-ee .pempty{font-size:12px;color:rgba(190,200,210,.92);padding:6px 0;}',
        '#knh-ee .ed101{background:rgba(8,12,18,.24);border:1px solid rgba(170,185,208,.36);border-radius:6px;padding:10px;}',
        '#knh-ee .ed101 textarea{min-height:240px;}',
        '#knh-ee .mw select{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}',
        '#knh-ee select{color-scheme:dark;}',
        '#knh-ee select option{background:rgba(14,20,30,.98);color:#e8f0ff;}',
        '#knh-ee select option:checked,#knh-ee select option[selected]{background:linear-gradient(rgba(46,143,244,.98),rgba(46,143,244,.98));color:#ffffff !important;-webkit-text-fill-color:#ffffff;box-shadow:inset 0 0 0 9999px rgba(46,143,244,.98);}',
        '#knh-ee select option:disabled{background:rgba(36,42,52,.98);color:rgba(150,164,182,.9);}',
        '#knh-ee .ed121{background:#30363e;border:1px solid rgba(130,168,222,.72);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:10px;}',
        '#knh-ee .ed121-box{border:1px solid rgba(170,185,208,.36);background:rgba(8,12,18,.24);border-radius:6px;padding:8px;}',
        '#knh-ee .ed121-title{font-size:12px;line-height:1.2;font-weight:700;text-align:left;padding:2px 0 0;margin:0 0 8px;color:#d9e6fb;}',
        '#knh-ee .ed121-radio{display:flex;gap:18px;align-items:center;margin:4px 0 8px;color:#d7e3f6;}',
        '#knh-ee .ed121-num{display:grid;grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr);gap:8px;align-items:center;}',
        '#knh-ee .ed121-num input[readonly]{cursor:pointer;}',
        '#knh-ee .ed121-sep{text-align:center;color:rgba(188,205,230,.92);}',
        '#knh-ee .ed121-op{display:flex;gap:28px;align-items:center;margin-top:2px;}',
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
        '#knh-ee .sfr .sfr-label{display:block;width:100%;min-width:0;max-width:100%;line-height:1.2;white-space:nowrap;overflow:hidden;}',
        '#knh-ee .sfr input[readonly]{cursor:pointer;}',
        '#knh-ee .sfr .charimg-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;}',
        '#knh-ee .sfr .charimg-pick{height:29px;padding:0 12px;border:1px solid rgba(150,178,220,.52);border-radius:6px;background:rgba(38,58,82,.9);color:#eef5ff;font-size:11px;cursor:pointer;white-space:nowrap;}',
        '#knh-ee .sfr .charimg-pick:hover{background:rgba(54,80,112,.94);}',
        '#knh-ee .sfr .sfrh{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
        '#knh-ee .sfr .sfrh>.sfr-label{flex:1 1 auto;width:auto;}',
        '#knh-ee .sfr .txemo-bar{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:nowrap;}',
        '#knh-ee .sfr .txemo-item{min-width:26px;height:24px;padding:0 6px;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(18,25,36,.95);color:#f3f7ff;font-size:14px;line-height:1;cursor:pointer;}',
        '#knh-ee .sfr .txemo-item:hover{background:rgba(58,76,102,.92);}',
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
        '#knh-ee .sff.msg101 .sfr[data-fkey="windowType"]{grid-column:1 / span 2;grid-row:2;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="targetMode"]{grid-column:3 / span 1;grid-row:2;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="tailDir"]{grid-column:4 / span 1;grid-row:2 / span 2;align-self:start;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="addX"]{grid-column:1 / span 1;grid-row:3;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="addY"]{grid-column:2 / span 1;grid-row:3;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="targetX"]{grid-column:1 / span 1;grid-row:3;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="targetY"]{grid-column:2 / span 1;grid-row:3;}',
        '#knh-ee .sff.msg101 .sfr[data-fkey="targetCharId"]{grid-column:1 / span 4;grid-row:4;}',
        '#knh-ee .sfr.bool{grid-column:span 1;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:4px;padding-top:0;text-align:center;}',
        '#knh-ee .sfr.bool label{margin:0;text-align:center;}',
        '#knh-ee .sfr.bool input[type=checkbox]{align-self:center;margin-top:8px;}',
        '#knh-ee .sfr.list select{height:auto;min-height:0;font-family:monospace;}',
        '#knh-ee .sfr.list input{margin-bottom:6px;}',
        '#knh-ee .ed-btns{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px 14px;}',
        '#knh-ee .acmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:41;}',
        '#knh-ee .acmb.on{display:block;}',
        '#knh-ee .acw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:490px;max-width:96vw;height:530px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;padding:8px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}',
        '#knh-ee .actabs{display:flex;gap:4px;margin-bottom:6px;}',
        '#knh-ee .actab{min-width:40px;padding:4px 8px;background:#2d343b;border:1px solid rgba(170,185,208,.36);border-radius:4px;color:#dce9ff;font-size:15px;line-height:1;cursor:pointer;}',
        '#knh-ee .actab.on{background:#1f2c3e;border-color:#7aa5dc;color:#f1f7ff;}',
        '#knh-ee .acgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1 1 auto;min-height:0;overflow:auto;}',
        '#knh-ee .accol{display:flex;flex-direction:column;gap:8px;}',
        '#knh-ee .acgrp{border:1px solid rgba(170,185,208,.36);background:rgba(8,12,18,.24);border-radius:6px;padding:6px;}',
        '#knh-ee .acgtt{font-size:13px;line-height:1.2;font-weight:700;color:#edf4ff;letter-spacing:.01em;margin:0 0 4px 0;}',
        '#knh-ee .acbtn{display:block;width:100%;margin:0 0 2px 0;padding:2px 6px;text-align:center;background:#535b62;border:1px solid rgba(185,196,212,.42);border-radius:4px;color:#eaf1ff;font-size:12px;line-height:1.1;cursor:pointer;}',
        '#knh-ee .acbtn:last-child{margin-bottom:0;}',
        '#knh-ee .acbtn:hover{background:#606971;}',
        '#knh-ee .acbtn.brown{background:#6b5038;border-color:rgba(201,165,122,.72);color:#f5ecde;}',
        '#knh-ee .acbtn.brown:hover{background:#7a5c40;}',
        '#knh-ee .acbtn.dis,#knh-ee .acbtn:disabled{background:#41474d;border-color:rgba(150,160,172,.28);color:#9ea8b5;cursor:not-allowed;}',
        '#knh-ee .acbtn.dis:hover,#knh-ee .acbtn:disabled:hover{background:#41474d;}',
        '#knh-ee .acbtn.brown.dis,#knh-ee .acbtn.brown:disabled{background:#4d3b2b;border-color:rgba(130,100,72,.60);color:#c8b6a3;}',
        '#knh-ee .acbtn.brown.dis:hover,#knh-ee .acbtn.brown:disabled:hover{background:#4d3b2b;}',
        '#knh-ee .acf{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:6px;}',
        '#knh-ee .acinfo{font-size:11px;color:rgba(192,208,232,.95);white-space:pre-wrap;}',
        '#knh-ee .acclose{padding:4px 8px;background:#3e4750;border:1px solid rgba(170,185,208,.36);border-radius:4px;color:#eaf1ff;font-size:11px;cursor:pointer;}'
        ,'#knh-ee .wimb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:43;}'
        ,'#knh-ee .wimb.on{display:block;}'
        ,'#knh-ee .wiw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-width:94vw;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}'
        ,'#knh-ee .wiw .h{font-size:12px;line-height:1.1;font-weight:700;margin:0;padding:6px 10px;background:#607eab;color:#eef3ff;border-radius:10px 10px 0 0;}'
        ,'#knh-ee .wiw .wi-sec{padding:12px 16px 8px 16px;}'
        ,'#knh-ee .wiw label{display:block;font-size:12px;margin:8px 0 4px;color:#d7e3f6;}'
        ,'#knh-ee .wiw input,#knh-ee .wiw select{box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}'
        ,'#knh-ee .wiw input[type=number]{width:120px;}'
        ,'#knh-ee .wiw input[type=radio]{width:auto;padding:0;border:none;background:transparent;accent-color:#67be7a;}'
        ,'#knh-ee .wi-pos{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:6px 0 10px 0;padding:6px 8px;border:1px solid rgba(170,185,208,.30);border-radius:8px;background:rgba(8,12,18,.20);}'
        ,'#knh-ee .wi-pos label{display:flex;align-items:center;gap:6px;margin:0;color:#e3ecfb;font-size:12px;}'
        ,'#knh-ee .wi-row{display:flex;align-items:center;gap:8px;margin-top:4px;}'
        ,'#knh-ee .wi-row span{color:#dbe8ff;font-size:12px;}'
        ,'#knh-ee .wi-note{margin-top:8px;font-size:11px;line-height:1.35;color:rgba(188,204,228,.96);white-space:pre-wrap;}'
        ,'#knh-ee .mbbw{width:460px;max-width:94vw;}'
        ,'#knh-ee .mbb-sec{padding:12px 16px 8px 16px;display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .mbb-row{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;align-items:center;}'
        ,'#knh-ee .mbb-row input[type=number],#knh-ee .mbb-row select{width:100%;box-sizing:border-box;}'
        ,'#knh-ee .mbb-row label{margin:0;font-size:12px;color:#d7e3f6;}'
        ,'#knh-ee .mbb-row .mbb-ck{display:flex;align-items:center;gap:8px;}'
        ,'#knh-ee .mbb-row .mbb-ck input[type=checkbox]{width:auto;padding:0;border:none;background:transparent;accent-color:#67be7a;}'
        ,'#knh-ee .mbb-note{margin-top:4px;font-size:11px;line-height:1.35;color:rgba(188,204,228,.96);white-space:pre-wrap;}'
        ,'#knh-ee .mmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:44;}'
        ,'#knh-ee .mmb.on{display:block;}'
        ,'#knh-ee .mmw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-width:94vw;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}'
        ,'#knh-ee .mmw .h{font-size:12px;line-height:1.1;font-weight:700;margin:0;padding:6px 10px;background:#607eab;color:#eef3ff;border-radius:10px 10px 0 0;}'
        ,'#knh-ee .mm-sec{padding:12px 16px 8px 16px;display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .mm-top{display:grid;grid-template-columns:170px minmax(0,1fr);gap:8px;align-items:end;}'
        ,'#knh-ee .mm-field{display:flex;flex-direction:column;gap:4px;min-width:0;}'
        ,'#knh-ee .mmw label{display:block;font-size:12px;margin:0;color:#d7e3f6;}'
        ,'#knh-ee .mmw input,#knh-ee .mmw select{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}'
        ,'#knh-ee .mm-size{width:100%;max-width:100%;}'
        ,'#knh-ee .mm-note{margin:0;font-size:11px;line-height:1.35;color:rgba(188,204,228,.96);white-space:pre-wrap;}'
        ,'#knh-ee .esmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:45;}'
        ,'#knh-ee .esmb.on{display:block;}'
        ,'#knh-ee .esw{position:fixed;left:50%;top:16px;bottom:16px;transform:translateX(-50%);width:780px;max-width:calc(100vw - 16px);height:auto;max-height:none;min-height:0;overflow:hidden;padding:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);display:flex;flex-direction:column;}'
        ,'#knh-ee .esw .es-h{font-size:12px;line-height:1.1;font-weight:700;margin:0;padding:6px 10px;background:#607eab;color:#eef3ff;}'
        ,'#knh-ee .esw .es-body{padding:8px;overflow:hidden;display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:0;}'
        ,'#knh-ee .esw .es-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;}'
        ,'#knh-ee .esw .es-top-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,3fr);gap:6px;}'
        ,'#knh-ee .esw .es-field{display:flex;flex-direction:column;gap:4px;}'
        ,'#knh-ee .esw .es-field label{margin:0;font-size:12px;color:#d7e3f6;}'
        ,'#knh-ee .esw input,#knh-ee .esw textarea,#knh-ee .esw select{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.35);color:#eef3f6;padding:6px;font-size:12px;}'
        ,'#knh-ee .esw input:disabled,#knh-ee .esw textarea:disabled,#knh-ee .esw select:disabled{background:rgba(52,60,70,.92);border-color:rgba(124,138,156,.32);color:rgba(178,190,208,.62);cursor:not-allowed;}'
        ,'#knh-ee .esw textarea{resize:vertical;min-height:34px;line-height:1.3;}'
        ,'#knh-ee .esw input[type=checkbox]{width:16px;height:16px;transform:none;margin:0;accent-color:#67be7a;}'
        ,'#knh-ee .esw .es-page{display:flex;align-items:center;gap:8px;min-width:0;margin-top:8px;}'
        ,'#knh-ee .esw .es-page .es-page-select{display:none !important;}'
        ,'#knh-ee .esw .es-tabs{display:flex;align-items:flex-end;gap:2px;min-width:0;overflow-x:auto;overflow-y:hidden;padding:0 0 0 2px;border-bottom:1px solid rgba(170,185,208,.36);}'
        ,'#knh-ee .esw .es-tab{flex:0 0 auto;min-width:24px;padding:4px 10px;margin:0 0 -1px 0;border:1px solid rgba(170,185,208,.4);border-bottom-color:rgba(170,185,208,.26);border-radius:6px 6px 0 0;background:rgba(0,0,0,.2);color:#dbe7fb;font-size:12px;line-height:1.1;cursor:pointer;}'
        ,'#knh-ee .esw .es-tab:hover{background:rgba(255,255,255,.06);}'
        ,'#knh-ee .esw .es-tab.on{background:rgba(86,122,170,.62);border-color:rgba(172,208,255,.82);border-bottom-color:rgba(8,12,18,.24);color:#f2f7ff;}'
        ,'#knh-ee .esw .es-page-ops{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;}'
        ,'#knh-ee .esw .es-page-ops .esbtn{width:80px;min-width:80px;max-width:96px;height:40px;padding:3px 2px;line-height:1.15;white-space:pre-line;display:flex;align-items:center;justify-content:center;text-align:center;}'
        ,'#knh-ee .esw .es-split{display:grid;grid-template-columns:minmax(0,calc(25% + 96px)) minmax(0,calc(75% - 96px));grid-template-rows:minmax(0,1fr);gap:8px;align-items:stretch;flex:1 1 auto;min-height:0;height:auto;max-height:none;margin-top:0px;}'
        ,'#knh-ee .esw .es-left{min-width:0;min-height:0;height:auto;display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .esw .es-right{min-width:0;min-height:0;height:auto;display:flex;flex-direction:column;gap:8px;overflow:hidden;}'
        ,'#knh-ee .esw .es-main{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1 1 auto;height:auto;overflow:auto;padding-right:2px;}'
        ,'#knh-ee .esw .es-mid{display:grid;grid-template-columns:108px minmax(0,1fr);gap:8px;}'
        ,'#knh-ee .esw .es-bottom{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;}'
        ,'#knh-ee .esw .es-col{min-width:0;display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .esw .es-stack{display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .esw .es-stack > .es-sec{flex:0 0 auto;}'
        ,'#knh-ee .esw .es-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}'
        ,'#knh-ee .esw .es-sec{border:1px solid rgba(170,185,208,.36);border-radius:8px;padding:8px;background:rgba(8,12,18,.24);display:flex;flex-direction:column;gap:5px;}'
        ,'#knh-ee .esw .es-sec-compact{gap:4px;}'
        ,'#knh-ee .esw .es-sec-compact > select{display:block;flex:0 0 auto;min-height:30px;}'
        ,'#knh-ee .esw .es-sec-ttl{font-size:13px;font-weight:700;color:#edf4ff;}'
        ,'#knh-ee .esw .es-row{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;}'
        ,'#knh-ee .esw .es-row.chk{grid-template-columns:auto auto minmax(0,1fr);}'
        ,'#knh-ee .esw .es-row.chk label{margin:0 0 0 8px;font-size:12px;color:#e3ecfb;cursor:pointer;}'
        ,'#knh-ee .esw .es-row.kv label{margin:0;font-size:12px;color:#e3ecfb;}'
        ,'#knh-ee .esw .es-row.two{grid-template-columns:1fr 1fr;}'
        ,'#knh-ee .esw .es-row.es-var-extra{grid-template-columns:auto auto 44px minmax(0,1fr);}'
        ,'#knh-ee .esw .es-row.es-script-cond{grid-template-columns:auto auto minmax(0,1fr);align-items:start;}'
        ,'#knh-ee .esw .es-row.es-script-cond textarea{min-height:42px;}'
        ,'#knh-ee .esw .es-row .es-var-op{text-align:center;font-size:12px;color:#e3ecfb;}'
        ,'#knh-ee .esw .es-var-wrap{display:grid;grid-template-columns:minmax(0,1fr) 30px 74px;gap:4px;}'
        ,'#knh-ee .esw .es-pick{width:30px;min-width:30px;padding:0;border:1px solid rgba(170,185,208,.36);border-radius:5px;background:#3e4750;color:#eaf1ff;font-size:12px;line-height:1;cursor:pointer;}'
        ,'#knh-ee .esw .es-pick:disabled{opacity:.55;cursor:not-allowed;}'
        ,'#knh-ee .esw .es-note{font-size:11px;line-height:1.3;color:rgba(188,204,228,.96);}'
        ,'#knh-ee .esw .es-opt{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;}'
        ,'#knh-ee .esw .es-opt.es-opt-v{grid-template-columns:minmax(0,1fr);}'
        ,'#knh-ee .esw .es-opt label{display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:#e3ecfb;}'
        ,'#knh-ee .esw .es-opt-check{row-gap:8px;}'
        ,'#knh-ee .esw .es-opt-check label{gap:0;}'
        ,'#knh-ee .esw .es-opt-check label span{margin-left:8px;}'
        ,'#knh-ee .esw .es-img-preview-wrap{display:grid;grid-template-columns:84px;grid-template-rows:112px;justify-content:center;justify-items:stretch;align-content:start;gap:0;}'
        ,'#knh-ee .esw .es-img-preview{width:84px;height:112px;border:1px solid rgba(170,185,208,.46);border-radius:4px;background:rgba(0,0,0,.32);image-rendering:pixelated;}'
        ,'#knh-ee .esw .es-img-hidden{display:none;}'
        ,'#knh-ee .esw .es-route-btn{width:100%;}'
        ,'#knh-ee .esw .es-route-flags{display:none !important;}'
        ,'#knh-ee .esw .es-exec{min-height:0;max-height:none;flex:1 1 auto;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;}'
        ,'#knh-ee .esw .es-exec-body{position:relative;display:flex;flex-direction:column;flex:1 1 auto;min-height:0;min-width:0;width:100%;align-self:stretch;overflow:hidden;}'
        ,'#knh-ee .esw .es-exec-list{position:relative;z-index:1;flex:1 1 auto;min-height:0;max-height:none;overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.24);}'
        ,'#knh-ee .esw .es-exec-jump{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0;border-radius:6px;background:rgba(6,10,16,.64);color:#ffffff;font-size:24px;font-weight:700;letter-spacing:.08em;text-align:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .12s ease;z-index:5;}'
        ,'#knh-ee .esw .es-exec-body:hover .es-exec-jump,#knh-ee .esw .es-exec-body:focus-within .es-exec-jump{opacity:1;pointer-events:auto;}'
        ,'#knh-ee .esw .es-exec-row{display:grid;grid-template-columns:36px minmax(0,1fr);gap:8px;align-items:start;padding:6px 8px;border-bottom:1px solid rgba(170,185,208,.16);}'
        ,'#knh-ee .esw .es-exec-row:last-child{border-bottom:none;}'
        ,'#knh-ee .esw .es-exec-row:nth-child(odd){background:rgba(255,255,255,.02);}'
        ,'#knh-ee .esw .es-exec-idx{padding-top:2px;font-size:11px;line-height:1.2;text-align:right;color:rgba(162,180,204,.95);font-variant-numeric:tabular-nums;}'
        ,'#knh-ee .esw .es-exec-text{min-width:0;display:flex;flex-direction:column;gap:2px;}'
        ,'#knh-ee .esw .es-exec-name{font-size:12px;line-height:1.25;color:#edf4ff;word-break:break-word;}'
        ,'#knh-ee .esw .es-exec-detail{font-size:11px;line-height:1.3;color:rgba(132,224,255,.98);word-break:break-word;}'
        ,'#knh-ee .esw .es-exec-empty{padding:8px;font-size:12px;line-height:1.3;color:rgba(190,200,210,.92);}'
        ,'#knh-ee .esw .es-fo{display:flex;justify-content:flex-end;gap:8px;padding:8px 12px 12px 12px;}'
        ,'@media (max-width: 1180px){#knh-ee .esw .es-top{grid-template-columns:minmax(0,1fr);}#knh-ee .esw .es-top-fields{grid-template-columns:minmax(0,1fr);}#knh-ee .esw .es-page-ops{justify-content:flex-start;}#knh-ee .esw .es-split{grid-template-columns:minmax(0,calc(25% + 96px)) minmax(0,calc(75% - 96px));}#knh-ee .esw .es-mid,#knh-ee .esw .es-bottom{grid-template-columns:minmax(0,1fr);}#knh-ee .esw .es-opt{grid-template-columns:minmax(0,1fr);}}'
        ,'#knh-ee .esw .esbtn{padding:4px 10px;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:#3e4750;color:#eaf1ff;font-size:12px;cursor:pointer;}'
        ,'#knh-ee .esw .esbtn.good{background:rgba(22,86,38,.94);border-color:rgba(120,198,145,.55);}'
        ,'#knh-ee .esw .esbtn:disabled,#knh-ee .esw .esbtn.is-disabled{background:rgba(52,60,70,.92);border-color:rgba(124,138,156,.32);color:rgba(178,190,208,.62);cursor:not-allowed;box-shadow:none;filter:saturate(.45);}'
        ,'#knh-ee .esnmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.56);display:none;pointer-events:auto;z-index:46;}'
        ,'#knh-ee .esnmb.on{display:block;}'
        ,'#knh-ee .esnw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:760px;max-width:calc(100vw - 28px);height:420px;max-height:calc(100vh - 120px);min-height:220px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);display:flex;flex-direction:column;overflow:hidden;pointer-events:auto;}'
        ,'#knh-ee .esn-h{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:0;padding:6px 10px;background:#607eab;color:#eef3ff;font-size:12px;font-weight:700;line-height:1.1;box-sizing:border-box;border-bottom:1px solid rgba(170,185,208,.24);}'
        ,'#knh-ee .esn-body{flex:1 1 auto;min-height:0;padding:10px;display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .esn-ta{flex:1 1 auto;min-height:0;width:100%;box-sizing:border-box;resize:none;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.32);color:#eef3f6;padding:8px;font-size:13px;line-height:1.35;font-family:monospace;}'
        ,'#knh-ee .esn-note{font-size:11px;line-height:1.3;color:rgba(188,204,228,.96);}'
        ,'#knh-ee .eipmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:46;}'
        ,'#knh-ee .eipmb.on{display:block;}'
        ,'#knh-ee .eipw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:820px;max-width:calc(100vw - 16px);height:560px;max-height:calc(100vh - 84px);min-height:420px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;pointer-events:auto;}'
        ,'#knh-ee .eip-h{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:0;padding:6px 10px;background:#607eab;color:#eef3ff;font-size:12px;font-weight:700;line-height:1.1;box-sizing:border-box;border-bottom:1px solid rgba(170,185,208,.24);}'
        ,'#knh-ee .eip-close{width:24px;height:24px;padding:0;border:1px solid rgba(190,210,236,.55);border-radius:4px;background:rgba(34,42,54,.45);color:#eef3ff;font-size:16px;line-height:1;cursor:pointer;}'
        ,'#knh-ee .eip-body{min-height:0;height:100%;box-sizing:border-box;display:grid;grid-template-columns:200px minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:8px;padding:8px;overflow:hidden;}'
        ,'#knh-ee .eip-left{min-width:0;min-height:0;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(8,12,18,.22);overflow:hidden;display:flex;flex-direction:column;}'
        ,'#knh-ee .eip-list{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:hidden;scrollbar-gutter:stable;padding:4px;}'
        ,'#knh-ee .eip-item{display:block;width:100%;padding:3px 6px;margin:0;border:1px solid transparent;border-radius:4px;background:transparent;color:#e8f0ff;text-align:left;font-size:12px;line-height:1.25;cursor:pointer;}'
        ,'#knh-ee .eip-item:hover{background:rgba(126,148,176,.22);}'
        ,'#knh-ee .eip-item.on{background:rgba(93,136,197,.72);border-color:rgba(172,208,255,.85);}'
        ,'#knh-ee .eip-right{min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:hidden;}'
        ,'#knh-ee .eip-vp{flex:1 1 auto;min-width:0;min-height:0;width:100%;height:auto;max-height:none;overflow-x:hidden;overflow-y:hidden;scrollbar-gutter:stable;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(8,12,18,.22);box-sizing:border-box;}'
        ,'#knh-ee .eip-cv-wrap{display:inline-block;width:max-content;height:max-content;min-width:0;min-height:0;}'
        ,'#knh-ee .eip-cv{display:block;image-rendering:pixelated;max-width:none;max-height:none;width:auto;height:auto;}'
        ,'#knh-ee .eip-info{padding:6px 8px;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.2);font-size:11px;line-height:1.3;color:rgba(198,214,236,.94);white-space:pre-wrap;}'
        ,'#knh-ee .eip-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}'
        ,'#knh-ee .eip-status{display:inline-flex;align-items:center;min-height:28px;padding:0 8px;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(0,0,0,.22);font-size:11px;line-height:1.2;color:rgba(198,214,236,.94);}'
        ,'#knh-ee .eip-btn.toggle.on{background:rgba(44,96,156,.94);border-color:rgba(146,192,246,.78);}'
        ,'#knh-ee .eip-btn.warn{background:rgba(122,62,26,.92);border-color:rgba(228,168,112,.78);}'
        ,'#knh-ee .eip-fo{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px 12px 12px 12px;border-top:1px solid rgba(170,185,208,.24);}'
        ,'#knh-ee .eip-btn{display:inline-flex;align-items:center;justify-content:center;min-width:86px;min-height:30px;height:30px;padding:4px 10px;box-sizing:border-box;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:#3e4750;color:#eaf1ff;font-size:12px;line-height:1.2;white-space:nowrap;cursor:pointer;}'
        ,'#knh-ee .eip-btn.good{background:rgba(22,86,38,.94);border-color:rgba(120,198,145,.55);}'
        ,'@media (max-width: 920px){#knh-ee .eipw{width:calc(100vw - 16px);}#knh-ee .eip-body{grid-template-columns:180px minmax(0,1fr);}}'
        ,'@media (max-width: 720px){#knh-ee .eipw{width:calc(100vw - 16px);height:calc(100vh - 84px);max-height:calc(100vh - 84px);min-height:0;}#knh-ee .eip-body{grid-template-columns:minmax(0,1fr);grid-template-rows:180px minmax(0,1fr);}#knh-ee .eip-left{min-height:0;}#knh-ee .eip-right{min-height:0;}}'
        ,'#knh-ee .semb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:47;}'
        ,'#knh-ee .semb.on{display:block;}'
        ,'#knh-ee .sew{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:448px;max-width:calc(100vw - 16px);height:624px;max-height:calc(100vh - 84px);min-height:456px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;pointer-events:auto;}'
        ,'#knh-ee .se-h{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:0;padding:6px 10px;background:#607eab;color:#eef3ff;font-size:12px;font-weight:700;line-height:1.1;box-sizing:border-box;border-bottom:1px solid rgba(170,185,208,.24);}'
        ,'#knh-ee .se-close{width:24px;height:24px;padding:0;border:1px solid rgba(190,210,236,.55);border-radius:4px;background:rgba(34,42,54,.45);color:#eef3ff;font-size:16px;line-height:1;cursor:pointer;}'
        ,'#knh-ee .se-body{min-height:0;height:100%;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 196px;gap:8px;padding:8px;overflow:hidden;}'
        ,'#knh-ee .se-left{min-width:0;min-height:0;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:rgba(8,12,18,.22);overflow:hidden;display:flex;flex-direction:column;}'
        ,'#knh-ee .se-list{flex:1 1 auto;min-height:0;overflow:auto;scrollbar-gutter:stable;padding:3px;}'
        ,'#knh-ee .se-item{display:block;width:100%;padding:2px 8px;margin:0;border:1px solid transparent;border-radius:4px;background:transparent;color:#e8f0ff;text-align:left;font-size:12px;line-height:1.2;cursor:pointer;}'
        ,'#knh-ee .se-item:hover{background:rgba(126,148,176,.22);}'
        ,'#knh-ee .se-item.on{background:rgba(93,136,197,.72);border-color:rgba(172,208,255,.85);}'
        ,'#knh-ee .se-right{min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px;}'
        ,'#knh-ee .se-play{display:grid;grid-template-columns:1fr 1fr;gap:8px;}'
        ,'#knh-ee .se-btn{display:inline-flex;align-items:center;justify-content:center;min-width:86px;min-height:30px;height:30px;padding:4px 10px;box-sizing:border-box;border:1px solid rgba(170,185,208,.36);border-radius:6px;background:#3e4750;color:#eaf1ff;font-size:12px;line-height:1.2;white-space:nowrap;cursor:pointer;}'
        ,'#knh-ee .se-box{border:1px solid rgba(138,160,188,.42);border-radius:6px;background:rgba(8,12,18,.72);padding:6px 8px;display:flex;flex-direction:column;gap:5px;}'
        ,'#knh-ee .se-ttl{font-size:12px;color:#e1ecff;}'
        ,'#knh-ee .se-range{width:100%;height:18px;appearance:none;background:transparent;}'
        ,'#knh-ee .se-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:rgba(20,28,38,.95);border:1px solid rgba(116,138,166,.42);}'
        ,'#knh-ee .se-range::-webkit-slider-thumb{appearance:none;width:12px;height:22px;margin-top:-10px;border-radius:3px;border:1px solid rgba(182,202,228,.72);background:#c7d7ef;box-shadow:0 1px 0 rgba(0,0,0,.35);}'
        ,'#knh-ee .se-range::-moz-range-track{height:4px;border-radius:999px;background:rgba(20,28,38,.95);border:1px solid rgba(116,138,166,.42);}'
        ,'#knh-ee .se-range::-moz-range-thumb{width:12px;height:22px;border-radius:3px;border:1px solid rgba(182,202,228,.72);background:#c7d7ef;}'
        ,'#knh-ee .se-num{width:100%;height:30px;padding:4px 8px;box-sizing:border-box;border:1px solid rgba(132,154,182,.55);border-radius:4px;background:rgba(8,12,18,.92);color:#e8f0ff;font-size:12px;line-height:1.2;}'
        ,'#knh-ee .se-num:focus{outline:none;border-color:rgba(150,188,236,.88);box-shadow:0 0 0 1px rgba(86,132,198,.5) inset;}'
        ,'#knh-ee .se-fo{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px 12px 12px 12px;border-top:1px solid rgba(170,185,208,.24);}'
        ,'#knh-ee .se-btn.good{background:rgba(22,86,38,.94);border-color:rgba(120,198,145,.55);}'
        ,'@media (max-width: 760px){#knh-ee .sew{width:calc(100vw - 16px);height:calc(100vh - 84px);}#knh-ee .se-body{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;}#knh-ee .se-right{display:grid;grid-template-columns:1fr 1fr;gap:8px;}#knh-ee .se-play{grid-column:1 / -1;}}'
        ,'#knh-ee .swpmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:48;}'
        ,'#knh-ee .swpmb.on{display:block;}'
        ,'#knh-ee .swpw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:344px;max-width:calc(100vw - 16px);height:auto;max-height:calc(100vh - 96px);min-height:0;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;pointer-events:auto;}'
        ,'#knh-ee .swp-h{font-size:12px;line-height:1.1;font-weight:700;margin:0;padding:5px 8px;background:#607eab;color:#eef3ff;display:flex;align-items:center;justify-content:space-between;gap:8px;}'
        ,'#knh-ee .swp-x{width:24px;height:24px;padding:0;border:1px solid rgba(170,185,208,.36);border-radius:4px;background:#3e4750;color:#eaf1ff;font-size:16px;line-height:1;cursor:pointer;}'
        ,'#knh-ee .swp-body{padding:4px;display:grid;grid-template-columns:132px 208px;gap:4px;min-height:0;align-items:start;}'
        ,'#knh-ee .swp-sec{display:flex;flex-direction:column;min-height:0;gap:4px;border:1px solid rgba(170,185,208,.36);border-radius:6px;padding:4px;background:rgba(8,12,18,.22);}'
        ,'#knh-ee .swp-sec-main{align-items:flex-start;}'
        ,'#knh-ee .swp-ttl{font-size:12px;line-height:1.2;font-weight:700;margin:0;padding:6px 8px;border:1px solid rgba(170,185,208,.28);border-radius:6px;background:rgba(24,34,48,.68);text-align:center;color:#e9f2ff;}'
        ,'#knh-ee .swp-list{width:100%;height:100%;min-height:0;box-sizing:border-box;border:1px solid rgba(132,154,182,.55);border-radius:4px;background:rgba(8,12,18,.92);color:#e8f0ff;font-size:12px;line-height:1.2;padding:4px;font-family:inherit;}'
        ,'#knh-ee .swp-list-range{height:auto;flex:0 0 auto;align-self:flex-start;}'
        ,'#knh-ee .swp-list-main{width:100%;max-width:100%;height:auto;flex:0 0 auto;align-self:flex-start;}'
        ,'#knh-ee .swp-name-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;}'
        ,'#knh-ee .swp-name-row-main{width:100%;max-width:100%;}'
        ,'#knh-ee .swp-name-row label{margin:0;font-size:12px;line-height:1.2;color:#d7e3f6;}'
        ,'#knh-ee .swp-name-row input{height:30px;padding:4px 8px;box-sizing:border-box;border:1px solid rgba(132,154,182,.55);border-radius:4px;background:rgba(8,12,18,.92);color:#e8f0ff;font-size:12px;line-height:1.2;}'
        ,'#knh-ee .swp-fo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px 8px;border-top:1px solid rgba(170,185,208,.24);}'
        ,'#knh-ee .swp-fo-left,#knh-ee .swp-fo-right{display:flex;align-items:center;gap:8px;}'
        ,'#knh-ee .rmcmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.44);display:none;pointer-events:auto;z-index:42;}'
        ,'#knh-ee .rmcmb.on{display:block;}'
        ,'#knh-ee .rmcw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:820px;max-width:96vw;max-height:92vh;overflow:auto;padding:8px;background:#323942;border:1px solid rgba(132,169,219,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.48);}'
        ,'#knh-ee .rmctt{font-size:22px;line-height:1.1;font-weight:700;color:#edf4ff;margin:2px 2px 8px 2px;}'
        ,'#knh-ee .rmcgrid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px;}'
        ,'#knh-ee .rmccol{display:flex;flex-direction:column;gap:1px;}'
        ,'#knh-ee .rmcbtn{display:block;width:calc(100% - 24px);margin:0 auto;padding:2px 6px;text-align:center;background:#535b62;border:1px solid rgba(185,196,212,.42);border-radius:4px;color:#eaf1ff;font-size:12px;line-height:1.15;cursor:pointer;}'
        ,'#knh-ee .rmcbtn:hover{background:#606971;}'
        ,'#knh-ee .rmcbtn.ext{background:rgba(108,82,54,.88);border-color:rgba(198,160,120,.72);color:#f6eddc;}'
        ,'#knh-ee .rmcbtn.ext:hover{background:rgba(128,98,66,.94);}'
        ,'#knh-ee .rmcf{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}'
        ,'#knh-ee .rmcclose{padding:4px 8px;background:#3e4750;border:1px solid rgba(170,185,208,.36);border-radius:4px;color:#eaf1ff;font-size:11px;cursor:pointer;}'
        ,'#knh-ee .besmb{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.46);display:none;pointer-events:auto;z-index:44;}'
        ,'#knh-ee .besmb.on{display:block;}'
        ,'#knh-ee .besw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:640px;max-width:96vw;max-height:90vh;overflow:auto;background:#2c333c;border:1px solid rgba(154,188,228,.62);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.5);display:flex;flex-direction:column;}'
        ,'#knh-ee .bes-h{padding:10px 12px;border-bottom:1px solid rgba(170,185,208,.24);font-size:16px;font-weight:700;color:#f0f6ff;}'
        ,'#knh-ee .bes-body{padding:10px 12px;display:flex;flex-direction:column;gap:10px;}'
        ,'#knh-ee .bes-row{display:grid;grid-template-columns:160px 1fr;gap:8px;align-items:center;}'
        ,'#knh-ee .bes-row.chk{grid-template-columns:24px 136px 1fr;}'
        ,'#knh-ee .bes-row input[type=\"number\"],#knh-ee .bes-row select{height:28px;padding:3px 8px;box-sizing:border-box;border:1px solid rgba(132,154,182,.55);border-radius:4px;background:rgba(8,12,18,.92);color:#e8f0ff;font-size:12px;}'
        ,'#knh-ee .bes-row input[type=\"checkbox\"]{width:16px;height:16px;}'
        ,'#knh-ee .bes-fo{display:flex;justify-content:flex-end;gap:8px;padding:10px 12px 12px;border-top:1px solid rgba(170,185,208,.24);}'
    ].join('\n');
})();
