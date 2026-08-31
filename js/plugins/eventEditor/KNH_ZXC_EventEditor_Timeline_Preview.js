//=============================================================================
// KNH_ZXC_EventEditor_Timeline_Preview
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.3.0 (KNH_ZXC_EventEditor_Timeline_Preview)
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
    var compareEntriesByFrameWaitUid = SH.compareEntriesByFrameWaitUid;
    var EE_AnimationPreviewCharacter = SH.EE_AnimationPreviewCharacter;
    var COMMAND_CODE = SH.COMMAND_CODE;
    SH.beginModule('preview');

    // Editor dialogs, visual previews, and map-side editing interactions.
    EE.prototype.isAnimationPreviewEditorActive = function() {
        if (!this.shouldShowAnimationPreviewInEditor()) return false;
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        return true;
    };

    EE.prototype.animationPreviewStateFromRaw = function(raw) {
        raw = (raw && typeof raw === 'object') ? raw : {};
        var mode = this.editorPreviewMode();
        if (mode === 'portrait') {
            var portraitSequence = this.parsePopupPortraitPatternSequence(raw.portraitPatternSequence) || [0, 1, 2, 1];
            return {
                mode: 'portrait',
                imageName: String(raw.portraitFileName || ''),
                imageIndex: Math.max(0, Math.min(7, Math.floor(Number(raw.portraitIndex || 0) || 0))),
                imageDir: this.normalizeDirection8(Number(raw.portraitDirection || 2), 2),
                animationType: String(raw.portraitAnimationType || 'fixed') === 'pattern' ? 'pattern' : 'fixed',
                pattern: Math.max(0, Math.min(2, Math.floor(Number(raw.portraitPattern == null ? 1 : raw.portraitPattern) || 0))),
                sequence: portraitSequence,
                timing: String(raw.portraitTiming || 'custom') === 'yura' ? 'yura' : 'custom',
                wait: Math.max(1, Math.floor(Number(raw.portraitWait || 10) || 10))
            };
        }
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

        if (mode === 'cssRectFrame') {
            var tidCss = this.currentEditingRouteTargetId();
            var rowsCss = Math.max(1, Math.floor(Number(raw.rows || 1) || 1));
            var colsCss = Math.max(1, Math.floor(Number(raw.cols || 1) || 1));
            var orderSpecCss = String(raw.orderSpec == null ? '' : raw.orderSpec).trim();
            if (!orderSpecCss.length) orderSpecCss = '1';
            var waitCss = Math.max(1, Math.floor(Number(raw.frameWait || 6) || 6));
            var loopCss = !!raw.loop;
            return {
                mode: 'cssRectFrame',
                targetId: tidCss,
                rows: rowsCss,
                cols: colsCss,
                orderSpec: orderSpecCss,
                wait: waitCss,
                loop: loopCss
            };
        }

        if (mode === 'picture') {
            var pictureIdPlain = Math.max(1, Math.floor(Number(raw.pictureId || 1) || 1));
            var coordTypePlain = Math.max(0, Math.min(1, Math.floor(Number(raw.coordType || 0) || 0)));
            var xRef = (coordTypePlain === 0)
                ? Number(raw.x || 0)
                : Math.max(1, Math.floor(Number(raw.xVarId || 1) || 1));
            var yRef = (coordTypePlain === 0)
                ? Number(raw.y || 0)
                : Math.max(1, Math.floor(Number(raw.yVarId || 1) || 1));
            var xPlain = xRef;
            var yPlain = yRef;
            if (coordTypePlain === 1 && $gameVariables && typeof $gameVariables.value === 'function') {
                xPlain = Number($gameVariables.value(Math.max(1, Math.floor(Number(xRef || 1) || 1))));
                yPlain = Number($gameVariables.value(Math.max(1, Math.floor(Number(yRef || 1) || 1))));
            }
            if (!isFinite(xPlain)) xPlain = 0;
            if (!isFinite(yPlain)) yPlain = 0;
            return {
                mode: 'picture',
                pictureId: pictureIdPlain,
                pictureName: String(raw.name || ''),
                origin: Math.max(0, Math.min(1, Math.floor(Number(raw.origin || 0) || 0))),
                coordType: coordTypePlain,
                x: xPlain,
                y: yPlain,
                xRef: xRef,
                yRef: yRef,
                scaleX: Number(raw.scaleX == null ? 100 : raw.scaleX),
                scaleY: Number(raw.scaleY == null ? 100 : raw.scaleY),
                opacity: Math.max(0, Math.min(255, Math.floor(Number(raw.opacity == null ? 255 : raw.opacity) || 255))),
                blendMode: Math.max(0, Math.min(3, Math.floor(Number(raw.blendMode || 0) || 0)))
            };
        }

        if (mode === 'pictureSheet') {
            var schemaCode = Number(this.editSchema && this.editSchema.code || 0);
            var pictureId = Math.max(1, Math.floor(Number(raw.pictureId || 1) || 1));
            var showSpec = null;
            if (schemaCode === 35556) {
                showSpec = {
                    pictureId: pictureId,
                    pictureName: String(raw.pictureName || ''),
                    rows: Math.max(1, Math.floor(Number(raw.rows || 1) || 1)),
                    cols: Math.max(1, Math.floor(Number(raw.cols || 1) || 1))
                };
            } else if (typeof this.findSpriteSheetShowSpecForPreview === 'function') {
                showSpec = this.findSpriteSheetShowSpecForPreview(pictureId);
            }
            var name = String(showSpec && showSpec.pictureName || '');
            var rows = Math.max(1, Math.floor(Number(showSpec && showSpec.rows || 1) || 1));
            var cols = Math.max(1, Math.floor(Number(showSpec && showSpec.cols || 1) || 1));
            var orderSpec = '';
            var wait = 6;
            var loop = true;
            if (schemaCode === 35557) {
                orderSpec = String(raw.orderSpec == null ? '' : raw.orderSpec);
                wait = Math.max(1, Math.floor(Number(raw.frameWait || 1) || 1));
                loop = !!raw.loop;
            }
            return {
                mode: 'pictureSheet',
                pictureId: pictureId,
                pictureName: name,
                rows: rows,
                cols: cols,
                orderSpec: orderSpec,
                wait: wait,
                loop: loop
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
        if (String(spec.mode || '') === 'portrait') {
            return [
                'portrait',
                String(spec.imageName || ''),
                String(Math.max(0, Math.min(7, Math.floor(Number(spec.imageIndex || 0) || 0)))),
                String(this.normalizeDirection8(Number(spec.imageDir || 2), 2)),
                String(spec.animationType || 'fixed'),
                String(Math.max(0, Math.min(2, Math.floor(Number(spec.pattern == null ? 1 : spec.pattern) || 0)))),
                JSON.stringify(Array.isArray(spec.sequence) ? spec.sequence : []),
                String(spec.timing || 'yura'),
                String(Math.max(1, Math.floor(Number(spec.wait || 10) || 10)))
            ].join('|');
        }
        if (String(spec.mode || '') === 'cssRectFrame') {
            return [
                'cssRectFrame',
                String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
                String(Math.max(1, Math.floor(Number(spec.rows || 1) || 1))),
                String(Math.max(1, Math.floor(Number(spec.cols || 1) || 1))),
                String(spec.orderSpec == null ? '' : spec.orderSpec),
                String(Math.max(1, Math.floor(Number(spec.wait || 1) || 1))),
                String(!!spec.loop)
            ].join('|');
        }
        if (String(spec.mode || '') === 'picture') {
            return [
                'picture',
                String(Math.max(1, Math.floor(Number(spec.pictureId || 1) || 1))),
                String(spec.pictureName == null ? '' : spec.pictureName),
                String(Math.max(0, Math.min(1, Math.floor(Number(spec.origin || 0) || 0)))),
                String(Math.max(0, Math.min(1, Math.floor(Number(spec.coordType || 0) || 0)))),
                String(Number(spec.x || 0)),
                String(Number(spec.y || 0)),
                String(Number(spec.xRef || 0)),
                String(Number(spec.yRef || 0)),
                String(Number(spec.scaleX == null ? 100 : spec.scaleX)),
                String(Number(spec.scaleY == null ? 100 : spec.scaleY)),
                String(Math.max(0, Math.min(255, Math.floor(Number(spec.opacity == null ? 255 : spec.opacity) || 255)))),
                String(Math.max(0, Math.min(3, Math.floor(Number(spec.blendMode || 0) || 0))))
            ].join('|');
        }
        if (String(spec.mode || '') === 'pictureSheet') {
            return [
                'pictureSheet',
                String(Math.max(1, Math.floor(Number(spec.pictureId || 1) || 1))),
                String(spec.pictureName == null ? '' : spec.pictureName),
                String(Math.max(1, Math.floor(Number(spec.rows || 1) || 1))),
                String(Math.max(1, Math.floor(Number(spec.cols || 1) || 1))),
                String(spec.orderSpec == null ? '' : spec.orderSpec),
                String(Math.max(1, Math.floor(Number(spec.wait || 1) || 1))),
                String(!!spec.loop)
            ].join('|');
        }
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
        if (mode === 'portrait') this.animPreviewTitle.textContent = '顔画像アニメーションプレビュー';
        else if (mode === 'frame') this.animPreviewTitle.textContent = 'フレームアニメプレビュー（自動再生）';
        else if (mode === 'cssRectFrame') this.animPreviewTitle.textContent = 'CSSアニメプレビュー（自動再生）';
        else if (mode === 'image') this.animPreviewTitle.textContent = '画像プレビュー（setImageZXC）';
        else if (mode === 'picture') this.animPreviewTitle.textContent = 'ピクチャ表示プレビュー';
        else if (mode === 'pictureSheet') this.animPreviewTitle.textContent = 'ピクチャ再生プレビュー（自動再生）';
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

    EE.prototype.findSpriteSheetShowSpecForPreview = function(pictureId) {
        if (typeof this.spriteSheetPictureShowSpecFromEntry !== 'function') return null;
        pictureId = Math.max(1, Math.floor(Number(pictureId || 1) || 1));
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return null;
        var cur = (typeof this.currentEditingEntry === 'function') ? this.currentEditingEntry() : null;
        var list = tr.commands.slice(0).sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        var best = null;
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e) continue;
            if (cur && compareEntriesByFrameWaitUid(e, cur) > 0) break;
            var spec = this.spriteSheetPictureShowSpecFromEntry(e);
            if (!spec) continue;
            if (Math.max(1, Math.floor(Number(spec.pictureId || 1) || 1)) !== pictureId) continue;
            best = spec;
        }
        return best;
    };

    EE.prototype.normalizeSpriteSheetOrderForPreview = function(orderSpec, total) {
        total = Math.max(1, Math.floor(Number(total || 1) || 1));
        var count = null;
        if (typeof orderSpec === 'number' && isFinite(orderSpec)) {
            count = Math.floor(orderSpec);
        } else {
            var st = String(orderSpec == null ? '' : orderSpec).trim();
            if (/^[-+]?\d+(?:\.\d+)?$/.test(st)) count = Math.floor(Number(st));
        }
        if (count != null && count > 0) {
            var seqN = [];
            for (var ni = 0; ni < count && ni < total; ni++) seqN.push(ni);
            if (!seqN.length) seqN.push(0);
            return seqN;
        }
        var raw = [];
        if (Array.isArray(orderSpec)) raw = orderSpec.slice(0);
        else {
            var text = String(orderSpec == null ? '' : orderSpec).trim();
            if (text.length) {
                try {
                    if (text.charAt(0) !== '[') text = '[' + text + ']';
                    var parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) raw = parsed;
                } catch (_) {
                    raw = text.split(',');
                }
            }
        }
        if (!raw.length) {
            for (var i = 0; i < total; i++) raw.push(i);
        }
        var seq = [];
        for (var j = 0; j < raw.length; j++) {
            var n = Math.floor(Number(raw[j]));
            if (!isFinite(n)) continue;
            if (n < 0 || n >= total) continue;
            seq.push(n);
        }
        if (!seq.length) seq.push(0);
        return seq;
    };

    EE.prototype.ensureAnimationPreviewPictureSprite = function(spec) {
        spec = spec || {};
        if (!this.animPreviewWorld) return false;
        var name = String(spec.pictureName || '');
        if (!this.animPreviewPictureSprite) {
            this.animPreviewPictureSprite = new Sprite();
            this.animPreviewPictureSprite.anchor.x = 0.5;
            this.animPreviewPictureSprite.anchor.y = 0.5;
        }
        var spr = this.animPreviewPictureSprite;
        if (spr.parent !== this.animPreviewWorld) this.animPreviewWorld.addChild(spr);
        if (this.animPreviewPictureName !== name) {
            this.animPreviewPictureName = name;
            this.animPreviewPicturePlayback = null;
            spr.bitmap = name.length ? ImageManager.loadPicture(name) : null;
        }
        return name.length > 0;
    };

    EE.prototype.updateAnimationPreviewPictureSheet = function(spec) {
        if (!spec) return false;
        if (!this.ensureAnimationPreviewPictureSprite(spec)) {
            this.setAnimationPreviewInfo('ピクチャ名が未設定です。', true);
            return false;
        }
        var spr = this.animPreviewPictureSprite;
        var bmp = spr ? spr.bitmap : null;
        if (!bmp || !bmp.isReady()) {
            this.setAnimationPreviewInfo('画像読み込み中: ' + String(spec.pictureName || ''), false);
            return false;
        }
        var bw = Math.floor(Number(bmp.width || 0));
        var bh = Math.floor(Number(bmp.height || 0));
        var rows = Math.max(1, Math.floor(Number(spec.rows || 1) || 1));
        var cols = Math.max(1, Math.floor(Number(spec.cols || 1) || 1));
        var cellW = Math.floor(bw / cols);
        var cellH = Math.floor(bh / rows);
        if (cellW <= 0 || cellH <= 0) {
            this.setAnimationPreviewInfo('行/列設定が画像サイズに対して不正です。', true);
            return false;
        }
        var total = Math.max(1, rows * cols);
        var sig = this.animationPreviewStateSig(spec);
        if (!this.animPreviewPicturePlayback || this.animPreviewPicturePlayback.sig !== sig) {
            this.animPreviewPicturePlayback = {
                sig: sig,
                seq: this.normalizeSpriteSheetOrderForPreview(spec.orderSpec, total),
                pos: 0,
                count: 0,
                wait: Math.max(1, Math.floor(Number(spec.wait || 1) || 1)),
                loop: !!spec.loop
            };
            this.pushAnimationPreviewLog(
                'picture preview start: id=' + Math.max(1, Math.floor(Number(spec.pictureId || 1) || 1)) +
                ' name=' + String(spec.pictureName || '') +
                ' rows=' + rows + ' cols=' + cols
            );
        }
        var st = this.animPreviewPicturePlayback;
        st.wait = Math.max(1, Math.floor(Number(spec.wait || st.wait || 1) || 1));
        st.loop = !!spec.loop;
        var seq = (st.seq && st.seq.length) ? st.seq : [0];
        var frame = Math.max(0, Math.min(total - 1, Math.floor(Number(seq[st.pos] || 0) || 0)));
        var sx = (frame % cols) * cellW;
        var sy = Math.floor(frame / cols) * cellH;
        spr.setFrame(sx, sy, cellW, cellH);
        st.count++;
        if (st.count >= st.wait) {
            st.count = 0;
            var next = st.pos + 1;
            if (next >= seq.length) {
                if (st.loop) next = 0;
                else next = seq.length - 1;
            }
            st.pos = Math.max(0, next);
        }
        var vw = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var vh = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        var fitX = (vw * 0.78) / Math.max(1, cellW);
        var fitY = (vh * 0.66) / Math.max(1, cellH);
        var sc = Math.min(fitX, fitY);
        if (!isFinite(sc) || sc <= 0) sc = 1;
        sc = Math.max(0.1, sc);
        spr.scale.x = sc;
        spr.scale.y = sc;
        spr.x = Math.floor(vw * 0.5 + Number(this.animPreviewPanX || 0));
        spr.y = Math.floor(vh * 0.5 + Number(this.animPreviewPanY || 0));
        this.setAnimationPreviewInfo(
            'Picture ' + Math.max(1, Math.floor(Number(spec.pictureId || 1) || 1)) +
            ' / frame ' + frame + ' / wait ' + st.wait + ' / loop ' + (st.loop ? 'ON' : 'OFF'),
            false
        );
        return true;
    };

    EE.prototype.updateAnimationPreviewPictureDisplay = function(spec) {
        if (!spec) return false;
        if (!this.ensureAnimationPreviewPictureSprite({ pictureName: String(spec.pictureName || '') })) {
            this.setAnimationPreviewInfo('ピクチャ名が未設定です。', true);
            return false;
        }
        var spr = this.animPreviewPictureSprite;
        var bmp = spr ? spr.bitmap : null;
        if (!bmp || !bmp.isReady()) {
            this.setAnimationPreviewInfo('画像読み込み中: ' + String(spec.pictureName || ''), false);
            return false;
        }
        var bw = Math.max(1, Math.floor(Number(bmp.width || 1)));
        var bh = Math.max(1, Math.floor(Number(bmp.height || 1)));
        spr.setFrame(0, 0, bw, bh);
        var origin = Math.max(0, Math.min(1, Math.floor(Number(spec.origin || 0) || 0)));
        spr.anchor.x = (origin === 1) ? 0.5 : 0;
        spr.anchor.y = (origin === 1) ? 0.5 : 0;
        var vw = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var vh = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        var fit = Math.min((vw * 0.86) / Math.max(1, bw), (vh * 0.8) / Math.max(1, bh));
        if (!isFinite(fit) || fit <= 0) fit = 1;
        var sxPct = Number(spec.scaleX == null ? 100 : spec.scaleX);
        var syPct = Number(spec.scaleY == null ? 100 : spec.scaleY);
        if (!isFinite(sxPct)) sxPct = 100;
        if (!isFinite(syPct)) syPct = 100;
        spr.scale.x = Math.max(0.01, fit * (sxPct / 100));
        spr.scale.y = Math.max(0.01, fit * (syPct / 100));
        var opacity = Math.max(0, Math.min(255, Math.floor(Number(spec.opacity == null ? 255 : spec.opacity) || 255)));
        spr.alpha = opacity / 255;
        var blendMode = Math.max(0, Math.min(3, Math.floor(Number(spec.blendMode || 0) || 0)));
        if (spr.blendMode != null) spr.blendMode = blendMode;
        var gx = (typeof Graphics !== 'undefined' && Graphics && Graphics.boxWidth) ? Math.max(1, Math.floor(Number(Graphics.boxWidth || 1))) : 816;
        var gy = (typeof Graphics !== 'undefined' && Graphics && Graphics.boxHeight) ? Math.max(1, Math.floor(Number(Graphics.boxHeight || 1))) : 624;
        var px = Number(spec.x || 0);
        var py = Number(spec.y || 0);
        if (!isFinite(px)) px = 0;
        if (!isFinite(py)) py = 0;
        spr.x = Math.floor((px / gx) * vw + Number(this.animPreviewPanX || 0));
        spr.y = Math.floor((py / gy) * vh + Number(this.animPreviewPanY || 0));
        var posText = '(' + Math.round(px) + ',' + Math.round(py) + ')';
        if (Math.max(0, Math.min(1, Math.floor(Number(spec.coordType || 0) || 0))) === 1) {
            posText = 'v[' + Math.max(1, Math.floor(Number(spec.xRef || 1) || 1)) + '],v[' + Math.max(1, Math.floor(Number(spec.yRef || 1) || 1)) + '] -> ' + posText;
        }
        this.setAnimationPreviewInfo(
            'Picture ' + Math.max(1, Math.floor(Number(spec.pictureId || 1) || 1)) +
            ' / pos ' + posText +
            ' / scale ' + Math.round(sxPct) + ',' + Math.round(syPct) +
            ' / opacity ' + opacity,
            false
        );
        return true;
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
        if (mode === 'portrait') {
            name = String(spec && spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec && spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec && spec.imageDir || 2), 2);
            return { mode: mode, name: name, index: idx, direction: dir, targetLabel: '顔画像' };
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
        var bmp = SH.loadCharacterBitmapIfExists(name);
        if (!bmp) {
            canvas.width = 64;
            canvas.height = 64;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            infoEl.textContent = '画像が見つかりません: ' + name;
            return;
        }
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
            this.animPreviewSheetBtn.style.display = (mode === 'image' || mode === 'picture' || mode === 'pictureSheet') ? 'none' : '';
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
        // Portrait previews live in animPreviewWorld as ordinary Sprite instances.
        // Clear their references here, together with the objects this method owns.
        // PIXI nulls properties such as anchor when a Sprite is destroyed, so a
        // stale portrait reference must never be reused after this cleanup.
        this.animPreviewPortraitSprite = null;
        this.animPreviewPortraitSpecSig = '';
        this.animPreviewPortraitStartedFrame = 0;
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
        this.animPreviewPictureSprite = null;
        this.animPreviewPictureName = '';
        this.animPreviewPicturePlayback = null;
    };

    EE.prototype.pruneAnimationPreviewWorldChildren = function() {
        if (!this.animPreviewWorld || !Array.isArray(this.animPreviewWorld.children)) return;
        var children = this.animPreviewWorld.children;
        for (var i = children.length - 1; i >= 0; i--) {
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

    EE.prototype.ensureAnimationPreviewPortraitSprite = function(spec) {
        if (!spec || !this.animPreviewWorld || typeof Sprite === 'undefined') return false;
        var sig = this.animationPreviewStateSig(spec);
        var current = this.animPreviewPortraitSprite;
        var reusable = current &&
            !current._destroyed && !current.destroyed &&
            current.anchor && current.parent === this.animPreviewWorld;
        if (reusable && this.animPreviewPortraitSpecSig === sig) return true;
        this.clearAnimationPreviewCharacter();
        var sprite = new Sprite();
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 1;
        sprite.bitmap = SH.loadCharacterBitmapIfExists(String(spec.imageName || ''));
        this.animPreviewWorld.addChild(sprite);
        this.animPreviewPortraitSprite = sprite;
        this.animPreviewPortraitSpecSig = sig;
        this.animPreviewPortraitStartedFrame = typeof Graphics !== 'undefined' ? Number(Graphics.frameCount || 0) : 0;
        return true;
    };

    EE.prototype.updateAnimationPreviewPortrait = function(spec) {
        if (!this.ensureAnimationPreviewRenderer() || !this.ensureAnimationPreviewPortraitSprite(spec)) return false;
        var sprite = this.animPreviewPortraitSprite;
        var bitmap = sprite && sprite.bitmap;
        if (!bitmap) {
            this.setAnimationPreviewInfo(
                String(spec.imageName || '').length ? ('画像が見つかりません: ' + String(spec.imageName)) : 'キャラ画像を選択してください。',
                true
            );
            if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
            return true;
        }
        if (!bitmap.isReady || !bitmap.isReady()) {
            this.setAnimationPreviewInfo('画像読み込み中: ' + String(spec.imageName || ''), false);
            if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
            return true;
        }
        var big = ImageManager.isBigCharacter(String(spec.imageName || ''));
        var frameWidth = bitmap.width / (big ? 3 : 12);
        var frameHeight = bitmap.height / (big ? 4 : 8);
        var pattern = Math.max(0, Math.min(2, Math.floor(Number(spec.pattern == null ? 1 : spec.pattern) || 0)));
        var step = 0;
        if (spec.animationType === 'pattern') {
            if (spec.timing === 'yura') {
                var globalWait = Math.max(1, Number($gameSystem && $gameSystem.animationWait ? $gameSystem.animationWait() : spec.wait));
                var count = $gameSystem && $gameSystem.sceneCount ? $gameSystem.sceneCount() : Graphics.frameCount;
                step = Math.floor(Number(count || 0) / globalWait);
            } else {
                step = Math.floor(Math.max(0, Number(Graphics.frameCount || 0) - Number(this.animPreviewPortraitStartedFrame || 0)) / Math.max(1, Number(spec.wait || 1)));
            }
            var sequence = Array.isArray(spec.sequence) && spec.sequence.length ? spec.sequence : [0, 1, 2, 1];
            pattern = Math.max(0, Math.min(2, Math.floor(Number(sequence[((step % sequence.length) + sequence.length) % sequence.length]) || 0)));
        }
        if (sprite._eePortraitPattern !== pattern) {
            var index = Math.max(0, Math.min(7, Math.floor(Number(spec.imageIndex || 0) || 0)));
            var direction = this.normalizeDirection8(Number(spec.imageDir || 2), 2);
            var portraitApi = window.KNH_ZXC_PopupPortrait;
            var frame = portraitApi && typeof portraitApi.characterFrameRect === 'function'
                ? portraitApi.characterFrameRect(bitmap, String(spec.imageName || ''), index, direction, pattern)
                : null;
            if (!frame) {
                var characterColumn = big ? 0 : (index % 4) * 3;
                var characterRow = big ? 0 : Math.floor(index / 4) * 4;
                frame = {
                    x: (characterColumn + pattern) * frameWidth,
                    y: (characterRow + (direction - 2) / 2) * frameHeight,
                    width: frameWidth,
                    height: frameHeight
                };
            }
            sprite.setFrame(frame.x, frame.y, frame.width, frame.height);
            sprite._lastFrame = null;
            sprite._baseBitmap = null;
            sprite._eePortraitPattern = pattern;
        }
        if (spec.animationType === 'fixed') {
            sprite._yuraInfo = [20, 15, $gameSystem && $gameSystem.animationWait ? $gameSystem.animationWait() : 10, false];
            sprite._yuraUseOwnStep = false;
        } else {
            sprite._yuraInfo = null;
        }
        if (sprite.update) sprite.update();
        var width = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var height = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        sprite.x = Math.floor(width * 0.5 + Number(this.animPreviewPanX || 0));
        sprite.y = Math.floor(height * 0.78 + Number(this.animPreviewPanY || 0));
        if (this.animPreviewWorld) {
            this.animPreviewWorld.position.x = 0;
            this.animPreviewWorld.position.y = 0;
            this.animPreviewWorld.pivot.x = 0;
            this.animPreviewWorld.pivot.y = 0;
        }
        if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
        var timingText = spec.animationType === 'fixed'
            ? '固定 + ゆらゆら'
            : (spec.timing === 'yura' ? '全体同期' : ('独自 ' + Math.max(1, Number(spec.wait || 1)) + 'f'));
        this.setAnimationPreviewInfo(
            String(spec.imageName || '') + ' / index:' + Number(spec.imageIndex || 0) +
            ' / 向き:' + Number(spec.imageDir || 2) + ' / pattern:' + pattern + ' / ' + timingText,
            false
        );
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

    EE.prototype.playAnimationPreviewCssRectNow = function(spec, proxy, spr) {
        if (!spec || !proxy || !spr) return false;
        var rows = Math.max(1, Math.floor(Number(spec.rows || 1) || 1));
        var cols = Math.max(1, Math.floor(Number(spec.cols || 1) || 1));
        var wait = Math.max(1, Math.floor(Number(spec.wait || 6) || 6));
        var loop = !!spec.loop;
        var orderSpec = String(spec.orderSpec == null ? '' : spec.orderSpec).trim();
        if (!orderSpec.length) orderSpec = '1';
        var orderArg = orderSpec;
        if (/^[-+]?\d+(?:\.\d+)?$/.test(orderSpec)) {
            orderArg = Math.max(1, Math.floor(Number(orderSpec) || 1));
        } else {
            var parsed = (typeof this.parseCssRectOrderSpecLiteral === 'function')
                ? this.parseCssRectOrderSpecLiteral(orderSpec)
                : null;
            if (!parsed) {
                this.pushAnimationPreviewLog('play cssRect failed: invalid orderSpec', true);
                return false;
            }
            orderArg = parsed.literal;
        }
        if (!proxy.command_playCssRectAnimation && !proxy.startCssRectFrameAnimation) {
            this.pushAnimationPreviewLog('play cssRect failed: command_playCssRectAnimation missing', true);
            return false;
        }
        var srcRect = null;
        var bmp = spr ? (spr._baseBitmap || spr.bitmap) : null;
        if (bmp && bmp.isReady && bmp.isReady()) {
            var bw = Math.floor(Number(bmp.width || 0));
            var bh = Math.floor(Number(bmp.height || 0));
            if (bw > 0 && bh > 0) srcRect = { x: 0, y: 0, width: bw, height: bh };
        }
        if (!srcRect && proxy.cssRectWholeImageSource) srcRect = proxy.cssRectWholeImageSource();
        if (!srcRect || srcRect.width <= 0 || srcRect.height <= 0) {
            this.pushAnimationPreviewLog('play cssRect failed: whole-image source not found', true);
            return false;
        }
        proxy._cssRectAnimSourceRect = { x: srcRect.x, y: srcRect.y, width: srcRect.width, height: srcRect.height };
        proxy._cssRect = { x: srcRect.x, y: srcRect.y, width: srcRect.width, height: srcRect.height };
        try {
            if (proxy.command_playCssRectAnimation) {
                proxy.command_playCssRectAnimation(rows, cols, orderArg, wait, loop);
            } else {
                var seq = [];
                var total = Math.max(1, rows * cols);
                if (typeof orderArg === 'number' && isFinite(orderArg)) {
                    for (var ni = 0; ni < orderArg && ni < total; ni++) seq.push(ni);
                } else {
                    var text = String(orderArg || '').trim();
                    if (text.charAt(0) === '[') {
                        var arr = JSON.parse(text);
                        if (Array.isArray(arr)) seq = arr;
                    }
                }
                if (!seq.length) seq.push(0);
                proxy.startCssRectFrameAnimation(rows, cols, seq, wait, loop);
            }
            if (spr.update) spr.update();
            this.pushAnimationPreviewLog(
                'play cssRect: grid=' + rows + 'x' + cols +
                ' order=' + (typeof orderArg === 'number' ? String(orderArg) : String(orderArg)) +
                ' wait=' + wait + ' loop=' + String(loop)
            );
            return true;
        } catch (er) {
            this.pushAnimationPreviewLog('play cssRect error: ' + String(er && er.message || er), true);
            return false;
        }
    };

    EE.prototype.playAnimationPreviewNow = function(spec, proxy, spr) {
        if (!spec) return false;
        if (String(spec.mode || '') === 'pictureSheet' || String(spec.mode || '') === 'picture') {
            // Picture-sheet preview progresses in updateAnimationPreviewPictureSheet.
            this.animPreviewPicturePlayback = null;
            return true;
        }
        if (!proxy || !spr) return false;
        if (String(spec.mode || '') === 'frame') {
            return this.playAnimationPreviewFrameNow(spec, proxy, spr);
        }
        if (String(spec.mode || '') === 'cssRectFrame') {
            return this.playAnimationPreviewCssRectNow(spec, proxy, spr);
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
        if (String(spec && spec.mode || '') === 'portrait') {
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
            if (immediate && this.isAnimationPreviewEditorActive()) this.updateAnimationPreviewPortrait(spec);
            return false;
        }
        if (String(spec && spec.mode || '') === 'image') {
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
            this.refreshAnimationPreviewSheet(false);
            return false;
        }
        var sig = this.animationPreviewStateSig(spec);
        if (immediate && this.isAnimationPreviewEditorActive() && this.ensureAnimationPreviewRenderer()) {
            if (String(spec && spec.mode || '') === 'pictureSheet' || String(spec && spec.mode || '') === 'picture') {
                var playedPicture = this.playAnimationPreviewNow(spec, null, null);
                if (playedPicture) {
                    this.animPreviewLastAutoSig = sig;
                    this.animPreviewLoopNextAt = Date.now() + this.animationPreviewLoopIntervalMs();
                }
                this.animPreviewPendingSpec = null;
                this.animPreviewPendingSig = '';
                this.animPreviewPendingAt = 0;
                return playedPicture;
            }
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
        if (this.scheduleSchemaFieldLabelFit) this.scheduleSchemaFieldLabelFit();
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
        if (mode === 'portrait') {
            this.updateAnimationPreviewPortrait(spec);
            this.refreshAnimationPreviewSheet(false);
            return;
        }
        if (mode === 'image') {
            this.refreshAnimationPreviewSheet(false);
            return;
        }
        if (mode === 'picture') {
            if (!this.ensureAnimationPreviewRenderer()) return;
            if (this.animPreviewSprite || this.animPreviewProxyChar || this.animPreviewSourceChar) {
                this.clearAnimationPreviewCharacter();
            }
            var nowPicture = Date.now();
            if (this.animPreviewPendingSpec && nowPicture >= this.animPreviewPendingAt) {
                this.playAnimationPreviewNow(this.animPreviewPendingSpec, null, null);
                this.animPreviewPendingSpec = null;
                this.animPreviewPendingSig = '';
                this.animPreviewPendingAt = 0;
            }
            if (this.animPreviewWorld) {
                this.animPreviewWorld.position.x = 0;
                this.animPreviewWorld.position.y = 0;
                this.animPreviewWorld.pivot.x = 0;
                this.animPreviewWorld.pivot.y = 0;
            }
            this.pruneAnimationPreviewWorldChildren();
            this.updateAnimationPreviewPictureDisplay(spec);
            if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
            this.refreshAnimationPreviewSheet(false);
            return;
        }
        if (mode === 'pictureSheet') {
            if (!this.ensureAnimationPreviewRenderer()) return;
            // If switching from character preview mode, discard old character objects.
            if (this.animPreviewSprite || this.animPreviewProxyChar || this.animPreviewSourceChar) {
                this.clearAnimationPreviewCharacter();
            }
            var nowPic = Date.now();
            if (this.animPreviewPendingSpec && nowPic >= this.animPreviewPendingAt) {
                var psPic = this.animPreviewPendingSpec;
                if (this.playAnimationPreviewNow(psPic, null, null)) {
                    this.animPreviewLastAutoSig = this.animPreviewPendingSig || this.animationPreviewStateSig(psPic);
                    this.animPreviewLoopNextAt = nowPic + this.animationPreviewLoopIntervalMs();
                } else {
                    this.animPreviewLoopNextAt = nowPic + 250;
                }
                this.animPreviewPendingSpec = null;
                this.animPreviewPendingSig = '';
                this.animPreviewPendingAt = 0;
            }
            if (this.animPreviewWorld) {
                this.animPreviewWorld.position.x = 0;
                this.animPreviewWorld.position.y = 0;
                this.animPreviewWorld.pivot.x = 0;
                this.animPreviewWorld.pivot.y = 0;
            }
            this.pruneAnimationPreviewWorldChildren();
            this.updateAnimationPreviewPictureSheet(spec);
            if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
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
        if (!((mode === 'frame' && proxy._frameAnimation) || (mode === 'cssRectFrame' && proxy._cssRectFrameAnimation))) {
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
        if ((mode === 'frame' || mode === 'cssRectFrame') && proxy.updateAnimation) {
            try { proxy.updateAnimation(); } catch (er2) {
                this.pushAnimationPreviewLog('frame update error: ' + String(er2 && er2.message || er2), true);
            }
        }
        this.pruneAnimationPreviewWorldChildren();
        if (this.animPreviewWorld && Array.isArray(this.animPreviewWorld.children)) {
            var children = this.animPreviewWorld.children;
            for (var ci = children.length - 1; ci >= 0; ci--) {
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
        var hasActive = false;
        if (mode === 'frame') hasActive = !!(proxy && proxy._frameAnimation);
        else if (mode === 'cssRectFrame') hasActive = !!(proxy && proxy._cssRectFrameAnimation);
        else hasActive = this.hasActiveAnimationPreviewSprite(spr);
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
        } else if (mode === 'cssRectFrame') {
            msg = '対象:' + this.animationPreviewTargetName(spec.targetId) +
                ' / css:' + Math.max(1, Math.floor(Number(spec.rows || 1) || 1)) + 'x' + Math.max(1, Math.floor(Number(spec.cols || 1) || 1)) +
                ' / order:' + String(spec.orderSpec == null ? '' : spec.orderSpec) +
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
        var hideGeneric = (mode === 'message101' || mode === 'switch121' || mode === 'schema' || mode === 'script');
        if (this.edGenericWrap) this.edGenericWrap.style.display = hideGeneric ? 'none' : '';
        if (this.ed101Wrap) this.ed101Wrap.style.display = (mode === 'message101') ? '' : 'none';
        if (this.ed121Wrap) this.ed121Wrap.style.display = (mode === 'switch121') ? '' : 'none';
        if (this.edSchemaWrap) this.edSchemaWrap.style.display = (mode === 'schema') ? '' : 'none';
        if (this.modalWin && this.modalWin.classList) this.modalWin.classList.toggle('script355', mode === 'script');
        this.edMessageLabel.style.display = 'none';
        this.edMessageText.style.display = 'none';
        this.edCommentLabel.style.display = (mode === 'comment') ? '' : 'none';
        this.edCommentText.style.display = (mode === 'comment') ? '' : 'none';
        this.edScriptLabel.style.display = (mode === 'script') ? '' : 'none';
        this.edScriptText.style.display = (mode === 'script') ? '' : 'none';
        this.updateScriptEditorOkState();
        this.refreshAnimationPreviewPanel(false);
    };

    EE.prototype.validateScriptEditorSyntax = function(scriptText) {
        var src = String(scriptText == null ? '' : scriptText);
        try {
            // Parse-only check for event command script body.
            new Function(src);
            return { ok: true, message: '' };
        } catch (er) {
            var msg = (er && er.message) ? String(er.message) : 'スクリプトの構文が不正です。';
            return { ok: false, message: msg };
        }
    };

    EE.prototype.updateScriptEditorOkState = function() {
        if (!this.edOkBtn) return;
        var scriptMode = !!(this.edScriptText && this.edScriptText.style.display !== 'none');
        if (!scriptMode) {
            this.edOkBtn.disabled = false;
            this.edOkBtn.title = '';
            this._scriptEditorSyntaxError = '';
            return;
        }
        var v = this.validateScriptEditorSyntax(this.edScriptText ? this.edScriptText.value : '');
        this._scriptEditorSyntaxError = v.ok ? '' : String(v.message || '');
        this.edOkBtn.disabled = !v.ok;
        this.edOkBtn.title = v.ok ? '' : ('構文エラー: ' + this._scriptEditorSyntaxError);
    };

    EE.prototype.sePickerAudioNames = function() {
        var names = [];
        try {
            var fs = require('fs');
            var path = require('path');
            var dir = path.join(process.cwd(), 'audio', 'se');
            if (!fs.existsSync(dir)) return names;
            var files = fs.readdirSync(dir);
            var seen = Object.create(null);
            for (var i = 0; i < files.length; i++) {
                var fn = String(files[i] || '');
                var m = fn.match(/^(.*)\.(ogg)$/i);
                if (!m) continue;
                var key = String(m[1] || '').trim();
                if (!key.length || seen[key]) continue;
                seen[key] = true;
                names.push(key);
            }
            names.sort(function(a, b) {
                return String(a || '').toLowerCase().localeCompare(String(b || '').toLowerCase());
            });
        } catch (_) {}
        return names;
    };

    EE.prototype.normalizeSePickerParam = function(param) {
        param = (param && typeof param === 'object') ? param : {};
        return {
            name: String(param.name || ''),
            volume: Math.max(0, Math.min(100, Math.floor(Number(param.volume == null ? 90 : param.volume) || 90))),
            pitch: Math.max(50, Math.min(150, Math.floor(Number(param.pitch == null ? 100 : param.pitch) || 100))),
            pan: Math.max(-100, Math.min(100, Math.floor(Number(param.pan == null ? 0 : param.pan) || 0)))
        };
    };

    EE.prototype.setSePickerNumericValue = function(key, raw) {
        var k = String(key || '');
        var v = Math.floor(Number(raw || 0) || 0);
        if (k === 'volume') v = Math.max(0, Math.min(100, v));
        else if (k === 'pitch') v = Math.max(50, Math.min(150, v));
        else if (k === 'pan') v = Math.max(-100, Math.min(100, v));
        else return;
        if (k === 'volume') this.sePickerVolume = v;
        if (k === 'pitch') this.sePickerPitch = v;
        if (k === 'pan') this.sePickerPan = v;
        this.refreshSePickerUi();
    };

    EE.prototype.renderSePickerList = function() {
        if (!this.sePickerList) return;
        var self = this;
        var list = this.sePickerList;
        list.innerHTML = '';
        var addItem = function(value, label, active) {
            var b = self.el('button', 'se-item' + (active ? ' on' : ''), label);
            b.type = 'button';
            b.addEventListener('click', function() {
                self.sePickerName = String(value || '');
                self.renderSePickerList();
                self.refreshSePickerUi();
            });
            b.addEventListener('dblclick', function() {
                self.sePickerName = String(value || '');
                self.renderSePickerList();
                self.refreshSePickerUi();
                if (String(self.sePickerName || '').length) self.playSePickerPreview();
                else self.stopSePickerPreview();
            });
            list.appendChild(b);
        };
        addItem('', '(なし)', !String(this.sePickerName || '').length);
        var names = Array.isArray(this.sePickerNames) ? this.sePickerNames : [];
        for (var i = 0; i < names.length; i++) {
            var name = String(names[i] || '');
            if (!name.length) continue;
            addItem(name, name, String(this.sePickerName || '') === name);
        }
    };

    EE.prototype.refreshSePickerUi = function() {
        if (this.sePickerVolumeRange) this.sePickerVolumeRange.value = String(Math.floor(Number(this.sePickerVolume || 90)));
        if (this.sePickerVolumeInput) this.sePickerVolumeInput.value = String(Math.floor(Number(this.sePickerVolume || 90)));
        if (this.sePickerPitchRange) this.sePickerPitchRange.value = String(Math.floor(Number(this.sePickerPitch || 100)));
        if (this.sePickerPitchInput) this.sePickerPitchInput.value = String(Math.floor(Number(this.sePickerPitch || 100)));
        if (this.sePickerPanRange) this.sePickerPanRange.value = String(Math.floor(Number(this.sePickerPan || 0)));
        if (this.sePickerPanInput) this.sePickerPanInput.value = String(Math.floor(Number(this.sePickerPan || 0)));
        if (this.sePickerPlayBtn) this.sePickerPlayBtn.disabled = !String(this.sePickerName || '').length;
    };

    EE.prototype.playSePickerPreview = function() {
        if (!AudioManager) return;
        var se = this.normalizeSePickerParam({
            name: this.sePickerName,
            volume: this.sePickerVolume,
            pitch: this.sePickerPitch,
            pan: this.sePickerPan
        });
        if (!se.name.length) return;
        try { if (AudioManager.stopSe) AudioManager.stopSe(); } catch (_) {}
        try { if (AudioManager.playSe) AudioManager.playSe(se); } catch (_) {}
    };

    EE.prototype.stopSePickerPreview = function() {
        if (!AudioManager || typeof AudioManager.stopSe !== 'function') return;
        try { AudioManager.stopSe(); } catch (_) {}
    };

    EE.prototype.openSePickerForEntry = function(uid) {
        if (!this.sePickerModal || !this.sePickerList) return false;
        uid = Math.floor(Number(uid || 0));
        if (uid <= 0) return false;
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 250) return false;
        var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
        var se = this.normalizeSePickerParam((p[0] && typeof p[0] === 'object') ? p[0] : this.emptyAudioParam());
        var names = this.sePickerAudioNames();
        if (se.name.length && names.indexOf(se.name) < 0) names.unshift(se.name);
        this.sePickerNames = names;
        this.sePickerName = se.name;
        this.sePickerVolume = se.volume;
        this.sePickerPitch = se.pitch;
        this.sePickerPan = se.pan;
        this.sePickerEditUid = uid;
        this.renderSePickerList();
        this.refreshSePickerUi();
        this.sePickerModal.classList.add('on');
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.sePickerModal);
        return true;
    };

    EE.prototype.applySePickerToEditingEntry = function() {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        var uid = Math.floor(Number(this.sePickerEditUid || 0));
        if (uid <= 0) return false;
        var e = this.findEntryInSelectedTrack(uid);
        if (!e || !e.command || Number(e.command.code || 0) !== 250) return false;
        var isPendingNew = (this._pendingNewUid && Number(e.uid || 0) === Number(this._pendingNewUid));
        var se = this.normalizeSePickerParam({
            name: this.sePickerName,
            volume: this.sePickerVolume,
            pitch: this.sePickerPitch,
            pan: this.sePickerPan
        });
        if (!isPendingNew) this.pushSnap('editCmd');
        e.command.parameters = [clone(se)];
        e.wait = this.commandWaitFrames(e.command);
        e.rowType = 'main';
        e.rowKey = 'main';
        e.charId = null;
        if (isPendingNew) {
            if (!this.finalizePendingAddEntry(tr, e)) return false;
        } else {
            this.commitTrackMutation({ earliestChangedFrame: e.frame });
            this.playFrom(this.frame);
        }
        return true;
    };

    EE.prototype.closeSePicker = function(apply) {
        if (!this.sePickerModal) return;
        apply = !!apply;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        var wasPending = (this._pendingNewUid && Number(this.sePickerEditUid || 0) === Number(this._pendingNewUid));
        if (apply) {
            if (!this.applySePickerToEditingEntry()) return;
        } else if (wasPending && tr) {
            var pendingSeEntry = this.findEntryInSelectedTrack(this._pendingNewUid);
            if (this.removeTrackEntryByUid(this._pendingNewUid)) {
                this.selUid = 0;
                this.selRouteListIndex = -1;
                this.commitTrackMutation({
                    markDirty: false,
                    earliestChangedFrame: pendingSeEntry ? pendingSeEntry.frame : 0
                });
                this.seek(this.frame);
            }
        }
        this.stopSePickerPreview();
        this.sePickerModal.classList.remove('on');
        this.sePickerEditUid = 0;
        this.sePickerNames = [];
        this.sePickerName = '';
        this.editUid = 0;
        this.editRouteListIndex = -1;
        this.editSchema = null;
        this.editSchemaBindings = [];
        this._pendingNewUid = 0;
        this._pendingNewConfirmed = false;
    };

    EE.prototype.systemNamePickerConfig = function(kind) {
        if (String(kind || '') === 'variable') {
            return {
                kind: 'variable', dataKey: 'variables', rangeListKey: 'variablePickerRangeList',
                itemListKey: 'variablePickerVariableList', nameInputKey: 'variablePickerNameInput',
                selectedIdKey: 'variablePickerSelectedId', dirtyKey: 'variablePickerDirty'
            };
        }
        return {
            kind: 'switch', dataKey: 'switches', rangeListKey: 'switchPickerRangeList',
            itemListKey: 'switchPickerSwitchList', nameInputKey: 'switchPickerNameInput',
            selectedIdKey: 'switchPickerSelectedId', dirtyKey: 'switchPickerDirty'
        };
    };

    EE.prototype.ensureSystemNameArray = function(kind) {
        var config = this.systemNamePickerConfig(kind);
        if (!$dataSystem || typeof $dataSystem !== 'object') return null;
        var arr = $dataSystem[config.dataKey];
        if (!Array.isArray(arr)) arr = $dataSystem[config.dataKey] = [''];
        if (!arr.length) arr.push('');
        if (arr[0] == null) arr[0] = '';
        return arr;
    };

    EE.prototype.systemNameMaxId = function(kind) {
        var arr = this.ensureSystemNameArray(kind);
        return Math.max(1, arr ? (arr.length - 1) : 1);
    };

    EE.prototype.clampSystemNameId = function(kind, value) {
        var id = Math.floor(Number(value || 1) || 1);
        return Math.max(1, Math.min(this.systemNameMaxId(kind), id));
    };

    EE.prototype.systemNameById = function(kind, id) {
        id = this.clampSystemNameId(kind, id);
        var arr = this.ensureSystemNameArray(kind);
        var name = arr && arr[id] ? String(arr[id]) : '';
        return name.length ? name : '(未設定)';
    };

    EE.prototype.systemNameIdText = function(kind, id) {
        return ('0000' + this.clampSystemNameId(kind, id)).slice(-4);
    };

    EE.prototype.systemNameDisplayText = function(kind, id) {
        id = this.clampSystemNameId(kind, id);
        return this.systemNameIdText(kind, id) + ' ' + this.systemNameById(kind, id);
    };

    EE.prototype.refreshSystemNamePickerRangeList = function(kind) {
        var config = this.systemNamePickerConfig(kind);
        var list = this[config.rangeListKey];
        if (!list) return;
        var maxId = this.systemNameMaxId(kind);
        var blocks = Math.max(1, Math.ceil(maxId / 20));
        var current = Math.max(0, Math.floor(Number(list.value || 0)));
        list.innerHTML = '';
        for (var i = 0; i < blocks; i++) {
            var start = i * 20 + 1;
            var end = Math.min(maxId, start + 19);
            var option = document.createElement('option');
            option.value = String(i);
            option.textContent = '[ ' + this.systemNameIdText(kind, start) + ' - ' + this.systemNameIdText(kind, end) + ' ]';
            list.appendChild(option);
        }
        list.value = String(Math.max(0, Math.min(blocks - 1, current)));
    };

    EE.prototype.refreshSystemNamePickerItemList = function(kind, rangeIndex) {
        var config = this.systemNamePickerConfig(kind);
        var list = this[config.itemListKey];
        if (!list) return;
        var maxId = this.systemNameMaxId(kind);
        var range = Math.max(0, Math.floor(Number(rangeIndex || 0)));
        var start = range * 20 + 1;
        var end = Math.min(maxId, start + 19);
        var current = this[config.selectedIdKey] != null
            ? this.clampSystemNameId(kind, this[config.selectedIdKey])
            : this.clampSystemNameId(kind, start);
        list.innerHTML = '';
        for (var i = start; i <= end; i++) {
            var option = document.createElement('option');
            option.value = String(i);
            option.textContent = this.systemNameDisplayText(kind, i);
            list.appendChild(option);
        }
        if (current < start || current > end) current = start;
        list.value = String(current);
        this[config.selectedIdKey] = current;
        this.onSystemNamePickerSelectionChange(kind);
    };

    EE.prototype.onSystemNamePickerSelectionChange = function(kind) {
        var config = this.systemNamePickerConfig(kind);
        var list = this[config.itemListKey];
        var id = list ? this.clampSystemNameId(kind, list.value) : 1;
        this[config.selectedIdKey] = id;
        var nameInput = this[config.nameInputKey];
        if (nameInput) {
            var arr = this.ensureSystemNameArray(kind);
            nameInput.value = arr && arr[id] != null ? String(arr[id]) : '';
        }
    };

    EE.prototype.onSystemNamePickerNameInput = function(kind) {
        var config = this.systemNamePickerConfig(kind);
        var arr = this.ensureSystemNameArray(kind);
        var nameInput = this[config.nameInputKey];
        var list = this[config.itemListKey];
        if (!arr || !nameInput) return;
        var id = this[config.selectedIdKey] != null
            ? this.clampSystemNameId(kind, this[config.selectedIdKey])
            : (list ? this.clampSystemNameId(kind, list.value) : 1);
        arr[id] = String(nameInput.value || '');
        this[config.dirtyKey] = true;
        if (kind === 'variable') this.invalidateVariableOptionCache();
        if (list && list.options) {
            var index = list.selectedIndex;
            if (index >= 0 && list.options[index]) {
                list.options[index].textContent = this.systemNameDisplayText(kind, id);
            }
        }
        if (kind === 'variable') this.refreshVariableEditorFieldTexts();
        else this.refreshSwitchEditorFieldTexts();
    };

    EE.prototype.ensureSystemSwitchArray = function() {
        return this.ensureSystemNameArray('switch');
    };

    EE.prototype.switchMaxId = function() {
        return this.systemNameMaxId('switch');
    };

    EE.prototype.clampSwitchId = function(v) {
        return this.clampSystemNameId('switch', v);
    };

    EE.prototype.switchNameById = function(id) {
        return this.systemNameById('switch', id);
    };

    EE.prototype.switchIdText = function(id) {
        return this.systemNameIdText('switch', id);
    };

    EE.prototype.switchDisplayText = function(id) {
        return this.systemNameDisplayText('switch', id);
    };

    EE.prototype.switchEditorFieldValue = function(el, fallback) {
        var fb = Math.max(1, Math.floor(Number(fallback || 1) || 1));
        if (!el) return this.clampSwitchId(fb);
        var raw = (el.dataset && el.dataset.switchId != null)
            ? el.dataset.switchId
            : ((el.value == null) ? '' : el.value);
        var m = String(raw || '').match(/^\s*(\d+)/);
        if (m) return this.clampSwitchId(m[1]);
        return this.clampSwitchId(fb);
    };

    EE.prototype.setSwitchEditorFieldValue = function(el, id) {
        if (!el) return;
        var v = this.clampSwitchId(id);
        if (el.dataset) el.dataset.switchId = String(v);
        el.value = this.switchDisplayText(v);
    };

    EE.prototype.refreshSwitchEditorFieldTexts = function() {
        if (this.ed121From) {
            this.setSwitchEditorFieldValue(this.ed121From, this.switchEditorFieldValue(this.ed121From, 1));
        }
        if (this.ed121To) {
            this.setSwitchEditorFieldValue(this.ed121To, this.switchEditorFieldValue(this.ed121To, this.switchEditorFieldValue(this.ed121From, 1)));
        }
    };

    EE.prototype.ensureSwitchRangeList = function() {
        this.refreshSwitchEditorFieldTexts();
        if (this.switchPickerModal && this.switchPickerModal.classList.contains('on')) {
            this.refreshSwitchPickerRangeList();
            this.refreshSwitchPickerSwitchList(Number(this.switchPickerRangeList && this.switchPickerRangeList.value || 0));
        }
    };

    EE.prototype.refreshSwitchPickerRangeList = function() {
        this.refreshSystemNamePickerRangeList('switch');
    };

    EE.prototype.refreshSwitchPickerSwitchList = function(rangeIdx) {
        this.refreshSystemNamePickerItemList('switch', rangeIdx);
    };

    EE.prototype.onSwitchPickerSelectionChange = function() {
        this.onSystemNamePickerSelectionChange('switch');
    };

    EE.prototype.onSwitchPickerNameInput = function() {
        this.onSystemNamePickerNameInput('switch');
    };

    EE.prototype.refreshSwitchInputsAfterPickerChange = function() {
        this.refreshSwitchEditorFieldTexts();
        if (this.eventSettingsPopulateConditionLists) {
            var keepSw1 = this.eventSettingsSw1Id ? this.clampSwitchId(this.eventSettingsSw1Id.value) : 1;
            var keepSw2 = this.eventSettingsSw2Id ? this.clampSwitchId(this.eventSettingsSw2Id.value) : 1;
            this.eventSettingsPopulateConditionLists();
            if (this.eventSettingsSw1Id) this.eventSettingsSw1Id.value = String(keepSw1);
            if (this.eventSettingsSw2Id) this.eventSettingsSw2Id.value = String(keepSw2);
        }
        if (this.battleEventSwitchId && this.eventSettingsSwitchOptions && this.eventSettingsFillSelect) {
            var keepBattleSw = this.clampSwitchId(this.battleEventSwitchId.value || 1);
            this.eventSettingsFillSelect(this.battleEventSwitchId, this.eventSettingsSwitchOptions());
            this.battleEventSwitchId.value = String(keepBattleSw);
        }
    };

    EE.prototype.openSwitchPickerCommon = function(initialId) {
        if (!this.switchPickerModal) return;
        this.ensureSystemSwitchArray();
        var arr = this.ensureSystemSwitchArray();
        this.switchPickerBackupSwitches = clone(arr || ['']);
        this.switchPickerDirty = false;
        var remembered = Math.floor(Number(this.switchPickerLastUsedId || 0) || 0);
        var startId = (remembered > 0) ? remembered : (initialId == null ? 1 : initialId);
        this.switchPickerSelectedId = this.clampSwitchId(startId);
        this.refreshSwitchPickerRangeList();
        var r = Math.max(0, Math.floor((this.switchPickerSelectedId - 1) / 20));
        if (this.switchPickerRangeList) this.switchPickerRangeList.value = String(r);
        this.refreshSwitchPickerSwitchList(r);
        if (this.switchPickerSwitchList) this.switchPickerSwitchList.value = String(this.switchPickerSelectedId);
        this.onSwitchPickerSelectionChange();
        this.switchPickerModal.classList.add('on');
        var self = this;
        if (typeof setTimeout === 'function') {
            setTimeout(function() {
                if (self.switchPickerSwitchList && self.switchPickerSwitchList.focus) self.switchPickerSwitchList.focus();
            }, 0);
        }
    };

    EE.prototype.openSwitchPickerForEditor = function(targetKey) {
        targetKey = (String(targetKey || '') === 'to') ? 'to' : 'from';
        this.ed121PickTarget = targetKey;
        this.switchPickerMode = 'ed121';
        this.switchPickerTargetKey = targetKey;
        this.switchPickerTargetElement = null;
        this.switchPickerTargetBinding = null;
        var target = (targetKey === 'to') ? this.ed121To : this.ed121From;
        this.openSwitchPickerCommon(this.switchEditorFieldValue(target, this.switchEditorFieldValue(this.ed121From, 1)));
    };

    EE.prototype.openSwitchPickerForElement = function(el) {
        if (!el) return;
        if (el.disabled) return;
        this.switchPickerMode = 'element';
        this.switchPickerTargetKey = '';
        this.switchPickerTargetElement = el;
        this.switchPickerTargetBinding = null;
        this.openSwitchPickerCommon(this.clampSwitchId(el.value || 1));
    };

    EE.prototype.openSwitchPickerForSchemaBinding = function(binding) {
        if (!binding || !binding.input) return;
        this.switchPickerMode = 'schema';
        this.switchPickerTargetKey = '';
        this.switchPickerTargetElement = null;
        this.switchPickerTargetBinding = binding;
        var inp = binding.input;
        var fallback = binding.field && binding.field.defaultValue != null ? binding.field.defaultValue : 1;
        this.openSwitchPickerCommon(this.switchEditorFieldValue(inp, fallback));
    };

    EE.prototype.persistSystemDataForPicker = function(errorCode) {
        try {
            var path = require('path');
            var filePath = path.join(process.cwd(), 'data', 'System.json');
            this.backupAndWriteJsonFileAtomic({
                filePath: filePath,
                value: $dataSystem || {},
                spacing: 2,
                backupDir: path.join(process.cwd(), 'data', '_backup'),
                backupName: 'System.' + String(Date.now()) + '.json',
                backupPrefix: 'System.',
                keepBackups: 80
            });
            return true;
        } catch (e) {
            this.err(errorCode || 'E_SYSTEM_PICKER_SAVE', e);
            return false;
        }
    };

    EE.prototype.persistSystemSwitchesForPicker = function() {
        return this.persistSystemDataForPicker('E_SWITCH_PICKER_SAVE');
    };

    EE.prototype.dispatchEditorFieldChange = function(input) {
        if (!input) return;
        try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
        try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    };

    EE.prototype.closeSwitchPickerForEditor = function(apply) {
        if (!this.switchPickerModal || !this.switchPickerModal.classList.contains('on')) return;
        apply = !!apply;
        var backup = Array.isArray(this.switchPickerBackupSwitches) ? clone(this.switchPickerBackupSwitches) : null;
        if (!apply && backup && $dataSystem && typeof $dataSystem === 'object') {
            $dataSystem.switches = backup;
        }
        if (apply) {
            if (this.switchPickerDirty && !this.persistSystemSwitchesForPicker()) return false;
            var id = this.switchPickerSelectedId != null
                ? this.clampSwitchId(this.switchPickerSelectedId)
                : (this.switchPickerSwitchList ? this.clampSwitchId(this.switchPickerSwitchList.value) : 1);
            this.switchPickerLastUsedId = id;
            var mode = String(this.switchPickerMode || 'ed121');
            if (mode === 'element') {
                var targetEl = this.switchPickerTargetElement;
                if (targetEl) {
                    targetEl.value = String(id);
                    this.dispatchEditorFieldChange(targetEl);
                }
            } else if (mode === 'schema') {
                var targetBinding = this.switchPickerTargetBinding;
                if (targetBinding && targetBinding.input) {
                    this.setSwitchEditorFieldValue(targetBinding.input, id);
                    this.dispatchEditorFieldChange(targetBinding.input);
                }
            } else {
                var target = (String(this.switchPickerTargetKey || 'from') === 'to') ? this.ed121To : this.ed121From;
                this.setSwitchEditorFieldValue(target, id);
                if (this.ed121Single && this.ed121Single.checked) this.setSwitchEditorFieldValue(this.ed121To, this.switchEditorFieldValue(this.ed121From, id));
            }
        }
        this.switchPickerModal.classList.remove('on');
        this.switchPickerMode = '';
        this.switchPickerTargetKey = '';
        this.switchPickerTargetElement = null;
        this.switchPickerTargetBinding = null;
        this.switchPickerBackupSwitches = null;
        this.switchPickerDirty = false;
        this.refreshSwitchInputsAfterPickerChange();
        this.syncSwitchEditorType();
        return true;
    };

    EE.prototype.promptSwitchPickerResize = function() {
        var cur = this.switchMaxId();
        var self = this;
        this.openEditorIntegerPrompt('スイッチ最大数の変更', cur, 1, 9999, function(next) {
            return self.resizeSystemNamePicker('switch', next);
        });
    };

    EE.prototype.resizeSystemNamePicker = function(kind, nextMaxId) {
        var config = this.systemNamePickerConfig(kind);
        var arr = this.ensureSystemNameArray(kind);
        if (!arr) return false;
        var targetLength = Math.max(1, Math.floor(Number(nextMaxId || 1))) + 1;
        while (arr.length < targetLength) arr.push('');
        if (arr.length > targetLength) arr.length = targetLength;
        if (arr[0] == null) arr[0] = '';
        this[config.dirtyKey] = true;
        if (kind === 'variable') this.invalidateVariableOptionCache();
        var selected = this[config.selectedIdKey] != null ? this[config.selectedIdKey] : 1;
        selected = this[config.selectedIdKey] = this.clampSystemNameId(kind, selected);
        this.refreshSystemNamePickerRangeList(kind);
        var rangeIndex = Math.max(0, Math.floor((selected - 1) / 20));
        var rangeList = this[config.rangeListKey];
        if (rangeList) rangeList.value = String(rangeIndex);
        this.refreshSystemNamePickerItemList(kind, rangeIndex);
        var itemList = this[config.itemListKey];
        if (itemList) itemList.value = String(selected);
        this.onSystemNamePickerSelectionChange(kind);
        if (kind === 'variable') this.refreshVariableEditorFieldTexts();
        else this.refreshSwitchEditorFieldTexts();
        return true;
    };

    EE.prototype.ensureSystemVariableArray = function() {
        return this.ensureSystemNameArray('variable');
    };

    EE.prototype.variableMaxId = function() {
        return this.systemNameMaxId('variable');
    };

    EE.prototype.clampVariableId = function(v) {
        return this.clampSystemNameId('variable', v);
    };

    EE.prototype.variableNameById = function(id) {
        return this.systemNameById('variable', id);
    };

    EE.prototype.variableIdText = function(id) {
        return this.systemNameIdText('variable', id);
    };

    EE.prototype.variableDisplayText = function(id) {
        return this.systemNameDisplayText('variable', id);
    };

    EE.prototype.variableEditorFieldValue = function(el, fallback) {
        var fb = Math.max(1, Math.floor(Number(fallback || 1) || 1));
        if (!el) return this.clampVariableId(fb);
        var raw = (el.dataset && el.dataset.variableId != null)
            ? el.dataset.variableId
            : ((el.value == null) ? '' : el.value);
        var m = String(raw || '').match(/^\s*(\d+)/);
        if (m) return this.clampVariableId(m[1]);
        return this.clampVariableId(fb);
    };

    EE.prototype.setVariableEditorFieldValue = function(el, id) {
        if (!el) return;
        var v = this.clampVariableId(id);
        if (el.dataset) el.dataset.variableId = String(v);
        el.value = this.variableDisplayText(v);
    };

    EE.prototype.invalidateVariableOptionCache = function() {
        if (!this._schemaOptionCache || typeof this._schemaOptionCache !== 'object') return;
        if (Object.prototype.hasOwnProperty.call(this._schemaOptionCache, 'variables')) {
            delete this._schemaOptionCache.variables;
        }
    };

    EE.prototype.refreshVariableEditorFieldTexts = function() {
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || String(b.field.type || '') !== 'variable' || !b.input) continue;
            this.setVariableEditorFieldValue(b.input, this.variableEditorFieldValue(b.input, b.field && b.field.defaultValue != null ? b.field.defaultValue : 1));
        }
    };

    EE.prototype.refreshVariablePickerRangeList = function() {
        this.refreshSystemNamePickerRangeList('variable');
    };

    EE.prototype.refreshVariablePickerVariableList = function(rangeIdx) {
        this.refreshSystemNamePickerItemList('variable', rangeIdx);
    };

    EE.prototype.onVariablePickerSelectionChange = function() {
        this.onSystemNamePickerSelectionChange('variable');
    };

    EE.prototype.onVariablePickerNameInput = function() {
        this.onSystemNamePickerNameInput('variable');
    };

    EE.prototype.refreshVariableInputsAfterPickerChange = function() {
        this.refreshVariableEditorFieldTexts();
        if (this.eventSettingsVarId && this.eventSettingsFillSelect) {
            var keepVar = this.clampVariableId(this.eventSettingsVarId.value || 1);
            this.invalidateVariableOptionCache();
            var opts = (typeof this.variableOptionsForSchema === 'function')
                ? this.variableOptionsForSchema()
                : [];
            this.eventSettingsFillSelect(this.eventSettingsVarId, opts);
            this.eventSettingsVarId.value = String(this.clampVariableId(keepVar));
        }
    };

    EE.prototype.openVariablePickerCommon = function(initialId) {
        if (!this.variablePickerModal) return;
        this.ensureSystemVariableArray();
        var arr = this.ensureSystemVariableArray();
        this.variablePickerBackupVariables = clone(arr || ['']);
        this.variablePickerDirty = false;
        var remembered = Math.floor(Number(this.variablePickerLastUsedId || 0) || 0);
        var startId = (remembered > 0) ? remembered : (initialId == null ? 1 : initialId);
        this.variablePickerSelectedId = this.clampVariableId(startId);
        this.refreshVariablePickerRangeList();
        var r = Math.max(0, Math.floor((this.variablePickerSelectedId - 1) / 20));
        if (this.variablePickerRangeList) this.variablePickerRangeList.value = String(r);
        this.refreshVariablePickerVariableList(r);
        if (this.variablePickerVariableList) this.variablePickerVariableList.value = String(this.variablePickerSelectedId);
        this.onVariablePickerSelectionChange();
        this.variablePickerModal.classList.add('on');
        var self = this;
        if (typeof setTimeout === 'function') {
            setTimeout(function() {
                if (self.variablePickerVariableList && self.variablePickerVariableList.focus) self.variablePickerVariableList.focus();
            }, 0);
        }
    };

    EE.prototype.openVariablePickerForElement = function(el) {
        if (!el) return;
        if (el.disabled) return;
        this.variablePickerMode = 'element';
        this.variablePickerTargetElement = el;
        this.variablePickerTargetBinding = null;
        this.openVariablePickerCommon(this.clampVariableId(el.value || 1));
    };

    EE.prototype.openVariablePickerForSchemaBinding = function(binding) {
        if (!binding || !binding.input) return;
        this.variablePickerMode = 'schema';
        this.variablePickerTargetElement = null;
        this.variablePickerTargetBinding = binding;
        var inp = binding.input;
        var fallback = binding.field && binding.field.defaultValue != null ? binding.field.defaultValue : 1;
        this.openVariablePickerCommon(this.variableEditorFieldValue(inp, fallback));
    };

    EE.prototype.persistSystemVariablesForPicker = function() {
        return this.persistSystemDataForPicker('E_VARIABLE_PICKER_SAVE');
    };

    EE.prototype.closeVariablePickerForEditor = function(apply) {
        if (!this.variablePickerModal || !this.variablePickerModal.classList.contains('on')) return;
        apply = !!apply;
        var backup = Array.isArray(this.variablePickerBackupVariables) ? clone(this.variablePickerBackupVariables) : null;
        if (!apply && backup && $dataSystem && typeof $dataSystem === 'object') {
            $dataSystem.variables = backup;
        }
        if (apply) {
            if (this.variablePickerDirty && !this.persistSystemVariablesForPicker()) return false;
            var id = this.variablePickerSelectedId != null
                ? this.clampVariableId(this.variablePickerSelectedId)
                : (this.variablePickerVariableList ? this.clampVariableId(this.variablePickerVariableList.value) : 1);
            this.variablePickerLastUsedId = id;
            var mode = String(this.variablePickerMode || 'element');
            if (mode === 'schema') {
                var targetBinding = this.variablePickerTargetBinding;
                if (targetBinding && targetBinding.input) {
                    this.setVariableEditorFieldValue(targetBinding.input, id);
                    this.dispatchEditorFieldChange(targetBinding.input);
                }
            } else {
                var targetEl = this.variablePickerTargetElement;
                if (targetEl) {
                    targetEl.value = String(id);
                    this.dispatchEditorFieldChange(targetEl);
                }
            }
        }
        this.variablePickerModal.classList.remove('on');
        this.variablePickerMode = '';
        this.variablePickerTargetElement = null;
        this.variablePickerTargetBinding = null;
        this.variablePickerBackupVariables = null;
        this.variablePickerDirty = false;
        this.refreshVariableInputsAfterPickerChange();
        return true;
    };

    EE.prototype.promptVariablePickerResize = function() {
        var cur = this.variableMaxId();
        var self = this;
        this.openEditorIntegerPrompt('変数最大数の変更', cur, 1, 9999, function(next) {
            return self.resizeSystemNamePicker('variable', next);
        });
    };

    EE.prototype.syncSwitchEditorType = function() {
        if (!this.ed121From || !this.ed121To || !this.ed121Single) return;
        var single = !!this.ed121Single.checked;
        if (single) this.setSwitchEditorFieldValue(this.ed121To, this.switchEditorFieldValue(this.ed121From, 1));
        this.ed121To.disabled = single;
        if (this.ed121To && this.ed121To.style) this.ed121To.style.display = single ? 'none' : '';
        if (this.ed121RangeSep && this.ed121RangeSep.style) {
            this.ed121RangeSep.style.visibility = single ? 'hidden' : '';
        }
        var row = this.ed121From && this.ed121From.parentNode;
        if (row && row.style) {
            row.style.gridTemplateColumns = single
                ? 'minmax(0,1fr)'
                : 'minmax(0,1fr) 20px minmax(0,1fr)';
        }
    };

    EE.prototype.setupSwitchEditor = function(params) {
        params = Array.isArray(params) ? params : [];
        var a = this.clampSwitchId(params[0] || 1);
        var b = this.clampSwitchId(params[1] || a);
        var op = Number(params[2] || 0) ? 1 : 0;
        this.ensureSwitchRangeList();
        this.setSwitchEditorFieldValue(this.ed121From, a);
        this.setSwitchEditorFieldValue(this.ed121To, b);
        var single = (a === b);
        this.ed121Single.checked = single;
        this.ed121Range.checked = !single;
        this.syncSwitchEditorType();
        if (op === 0) this.ed121On.checked = true; else this.ed121Off.checked = true;
    };

    EE.prototype.collectSwitchEditorParams = function() {
        var a = this.switchEditorFieldValue(this.ed121From, 1);
        var b = this.switchEditorFieldValue(this.ed121To, a);
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
        if (this.sePickerModal && this.sePickerModal.classList.contains('on')) {
            this.closeSePicker(false);
        }
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
                if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.modal);
                this.refreshAnimationPreviewPanel(false);
                this.repositionEditorWindow();
                var self = this;
                setTimeout(function() { self.repositionEditorWindow(); }, 0);
                return;
            }
        }
        if (e.command && Number(e.command.code || 0) === 250) {
            this.edHead.textContent = 'SEの演奏';
            if (this.openSePickerForEntry(uid)) return;
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
        if (typeof this.syncButtonsToCancelWidthAsync === 'function') this.syncButtonsToCancelWidthAsync(this.modal);
        this.refreshAnimationPreviewPanel(true);
        this.repositionEditorWindow();
        var self = this;
        setTimeout(function() { self.repositionEditorWindow(); }, 0);
    };

    EE.prototype.removeTrackEntryByUid = function(uid) {
        var tr = this.selectedTrack();
        var index = this.findTrackEntryIndexByUid(tr, uid);
        if (index < 0) return false;
        tr.commands.splice(index, 1);
        return true;
    };

    EE.prototype.closeEditor = function() {
        if (this.sePickerModal && this.sePickerModal.classList.contains('on')) {
            this.closeSePicker(false);
        }
        if (this.switchPickerModal && this.switchPickerModal.classList.contains('on')) {
            this.closeSwitchPickerForEditor(false);
        }
        if (this.variablePickerModal && this.variablePickerModal.classList.contains('on')) {
            this.closeVariablePickerForEditor(false);
        }
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
            var pendingEntry = this.findEntryInSelectedTrack(this._pendingNewUid);
            if (this.removeTrackEntryByUid(this._pendingNewUid)) {
                this.selUid = 0;
                this.selRouteListIndex = -1;
                this.commitTrackMutation({
                    markDirty: false,
                    earliestChangedFrame: pendingEntry ? pendingEntry.frame : 0
                });
                this.seek(this.frame);
            }
        }
        this._pendingNewUid = 0;
        this._pendingNewConfirmed = false;
    };

    EE.prototype.isEditorMultilineInputFocused = function(target) {
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        var n = target || (document && document.activeElement) || null;
        if (!n) return false;
        if (this.modal.contains && !this.modal.contains(n)) return false;
        while (n && n !== this.modal) {
            var tag = n.tagName ? String(n.tagName).toUpperCase() : '';
            if (tag === 'TEXTAREA' || n.isContentEditable) return true;
            n = n.parentNode;
        }
        return false;
    };

    EE.prototype.shouldApplyEditorOnEnter = function(e) {
        if (!e || e.key !== 'Enter') return false;
        if (this.switchPickerModal && this.switchPickerModal.classList && this.switchPickerModal.classList.contains('on')) return false;
        if (this.variablePickerModal && this.variablePickerModal.classList && this.variablePickerModal.classList.contains('on')) return false;
        if (e.isComposing || Number(e.keyCode || 0) === 229) return false;
        if (e.ctrlKey || e.altKey || e.metaKey) return false;
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        if (this.isEditorMultilineInputFocused(e.target)) return false;
        return true;
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
        var previousRouteCharId = (e.command && Number(e.command.code || 0) === 205)
            ? this.normalizeMoveTarget(e.charId == null ? Number((e.command.parameters || [0])[0] || 0) : Number(e.charId || 0))
            : null;
        var choiceStructureBefore = (!isPendingNew && e.command && Number(e.command.code || 0) === COMMAND_CODE.SHOW_CHOICES &&
            typeof this.captureChoiceBranchStructure === 'function')
            ? this.captureChoiceBranchStructure(tr, e)
            : null;
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
        var useScriptTextLayout = (this.editRouteListIndex == null || this.editRouteListIndex < 0) &&
            e.command && Number(e.command.code || 0) === 355 &&
            !useSchemaLayout &&
            this.edScriptText && this.edScriptText.style.display !== 'none';
        if (useScriptTextLayout) {
            var scriptValidation = this.validateScriptEditorSyntax(this.edScriptText.value || '');
            if (!scriptValidation.ok) {
                this.updateScriptEditorOkState();
                this.err('E_EDIT_SCRIPT_SYNTAX', new Error(String(scriptValidation.message || 'スクリプトの構文が不正です。')));
                return;
            }
        }
        if (use101Layout) {
            // Keep current 101 visual/position parameters as-is; this layout edits text lines only.
            params = Array.isArray(e.command.parameters) ? clone(e.command.parameters) : [];
        } else if (use121Layout) {
            params = this.collectSwitchEditorParams();
        } else if (useScriptTextLayout) {
            // 355専用エディタでは汎用param(JSON)パースを行わない。
            // 実際の保存値は後段の e.command.code===355 分岐で edScriptText から組み立てる。
            params = Array.isArray(e.command.parameters) ? clone(e.command.parameters) : [];
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
            // Fallback for turn-direction route commands: commit selected dirCode
            // as the route command code itself (no parameters).
            if (this.editSchema && typeof this.findEditorSchemaBindingByKey === 'function') {
                var dirBind = this.findEditorSchemaBindingByKey('dirCode');
                if (dirBind) {
                    var dirVal = NaN;
                    try {
                        if (typeof this.rawSchemaBindingValue === 'function') dirVal = Number(this.rawSchemaBindingValue(dirBind));
                        else if (dirBind.input) dirVal = Number(dirBind.input.value);
                    } catch (_) {
                        dirVal = NaN;
                    }
                    var dirCode = Math.floor(Number(dirVal || 0));
                    if (dirCode >= 16 && dirCode <= 19) newCode = dirCode;
                }
            }
            list[idx].code = newCode;
            list[idx].parameters = params;
            if (newCode >= 16 && newCode <= 19) {
                list[idx].parameters = [];
            }
            if (useSchemaLayout && this.editSchema && typeof this.editSchema.applyRouteCommand === 'function') {
                try {
                    this.editSchema.applyRouteCommand.call(this, list, idx, schemaState || {}, e);
                } catch (er4) {
                    this.err('E_EDIT_SCHEMA_APPLY', er4);
                    return;
                }
            }
            var finalRouteCode = Math.floor(Number((list[idx] && list[idx].code) || 0));
            if (finalRouteCode >= 16 && finalRouteCode <= 19 && list[idx]) {
                list[idx].parameters = [];
            }
            e.wait = this.commandWaitFrames(e.command);
            if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
                route.list = oldList;
                e.wait = oldWait;
                this.err('E_EDIT_COLLISION', new Error('command overlaps with wait-range'));
                return;
            }
            this.commitTrackMutation({ earliestChangedFrame: e.frame });
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
                if (this.isBattleEventMode()) {
                    e.rowType = 'main';
                    e.charId = null;
                    e.rowKey = 'main';
                } else {
                    e.rowType = 'char';
                    e.charId = this.normalizeMoveTarget(Number(e.command.parameters[0] || 0));
                    e.rowKey = 'char:' + e.charId;
                    e.command.parameters[0] = e.charId;
                    if (previousRouteCharId != null && e.charId !== previousRouteCharId) e.routeSymbolOrdinal = 0;
                }
            } else {
                e.rowType = 'main';
                e.charId = null;
                e.rowKey = 'main';
            }
        }
        if (e.command.code !== 101) e.popupPortrait = null;
        if (!isPendingNew && !this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
            this.err('E_EDIT_COLLISION', new Error('command overlaps with wait-range'));
            return;
        }
        if (isPendingNew) {
            if (!this.finalizePendingAddEntry(tr, e)) return;
            this.closeEditor();
            return;
        }
        if (e.command && Number(e.command.code || 0) === COMMAND_CODE.SHOW_CHOICES &&
            typeof this.synchronizeChoiceBranchStructure === 'function') {
            this.synchronizeChoiceBranchStructure(tr, e, choiceStructureBefore);
        }
        this.commitTrackMutation({ earliestChangedFrame: e.frame });
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
            if ((e.code === 'Space' || e.key === ' ') && !self.controlMode) self.spaceDown = true;
            if ((e.code === 'Space' || e.key === ' ') && !self.controlMode) self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
            if (e.key === 'Escape' && self.closeTopEditorModalOnEscape && self.closeTopEditorModalOnEscape(e)) return;
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
            if (self.simplePromptModal && self.simplePromptModal.classList.contains('on')) {
                var multilinePrompt = !!(self.simplePromptRequest && self.simplePromptRequest.multiline);
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeEditorPromptDialog(false);
                    return;
                }
                if (e.key === 'Enter' && (!multilinePrompt || e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    self.closeEditorPromptDialog(true);
                    return;
                }
                return;
            }
            if (self.waitInsertModal && self.waitInsertModal.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeWaitInsertDialog();
                return;
            }
            if (self.messageBubbleBulkModal && self.messageBubbleBulkModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeMessageBubbleBulkDialog();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.submitMessageBubbleBulkDialog();
                    return;
                }
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
            if (self.sePickerModal && self.sePickerModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeSePicker(false);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.closeSePicker(true);
                    return;
                }
                return;
            }
            if (self.switchPickerModal && self.switchPickerModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeSwitchPickerForEditor(false);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.closeSwitchPickerForEditor(true);
                    return;
                }
                return;
            }
            if (self.variablePickerModal && self.variablePickerModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeVariablePickerForEditor(false);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.closeVariablePickerForEditor(true);
                    return;
                }
                return;
            }
            if (self.eventSettingsNoteZoomModal && self.eventSettingsNoteZoomModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (typeof self.closeEventSettingsNoteZoom === 'function') self.closeEventSettingsNoteZoom(true);
                    return;
                }
                return;
            }
            if (self.battleEventSettingsModal && self.battleEventSettingsModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeBattleEventSettingsEditor();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.applyBattleEventSettingsEditor();
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
                else if (self.shouldApplyEditorOnEnter && self.shouldApplyEditorOnEnter(e)) {
                    e.preventDefault();
                    self.applyEditor();
                }
                return;
            }
            if (self.isAnyRegisteredEditorModalOpen && self.isAnyRegisteredEditorModalOpen()) return;
            var target = e.target;
            var tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
            var isTypingTarget = !!(target && (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'));
            var key = (e.key || '').toLowerCase();
            if (typeof self.handleContextEventAdjustKeyDown === 'function' &&
                self.handleContextEventAdjustKeyDown(e, isTypingTarget)) {
                return;
            }
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
                if (key === 'b') {
                    e.preventDefault();
                    if (typeof self.stopTimelineAutoScrollAnimation === 'function') {
                        self.stopTimelineAutoScrollAnimation();
                    }
                    self.seek(0);
                    if (self.timelineWrap) self.timelineWrap.scrollLeft = 0;
                    self.timelineDirty = true;
                    return;
                }
                if (key === 'enter') {
                    if (self.selUid) {
                        e.preventDefault();
                        self.openEditor(
                            self.selUid,
                            self.selRouteListIndex >= 0 ? self.selRouteListIndex : undefined
                        );
                    }
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
                if (!isTypingTarget) e.preventDefault();
                if (!isTypingTarget && self.controlMode && !e.repeat) self.togglePlay();
                return;
            }
            if (e.ctrlKey && key === 'r') {
                e.preventDefault();
                if (!e.repeat) self.handleCtrlRShortcut();
                return;
            }
            if (isTypingTarget || !e.ctrlKey) return;
            var k = key;
            if (k === 'a') {
                e.preventDefault();
                if (typeof self.needSelTrack === 'function' && !self.needSelTrack()) return;
                var endFrame = (typeof self.selectedTrackEndFrame === 'function')
                    ? Math.max(0, Math.floor(Number(self.selectedTrackEndFrame() || 0)))
                    : 0;
                var items = (typeof self.collectMemoryRangeSelectionItems === 'function')
                    ? self.collectMemoryRangeSelectionItems(0, endFrame)
                    : [];
                var rect = (typeof self.rangeSelectionFrameRectFromFrames === 'function')
                    ? self.rangeSelectionFrameRectFromFrames(0, endFrame)
                    : null;
                if (typeof self.setRangeSelection === 'function') {
                    self.setRangeSelection('memory', items, {
                        frameStart: 0,
                        frameEnd: endFrame,
                        rects: rect ? [rect] : [],
                        nonContiguous: false,
                        keepEmpty: true
                    });
                    self.msg('範囲選択: 0f - ' + endFrame + 'f');
                }
            }
            else if (k === 'z') { e.preventDefault(); self.undo(); }
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
            if (self.trySpaceWheelPan(e)) return;
            if (self.onEditorNumberWheel(e)) return;
            if (self.onEditorSelectWheel(e)) return;
            if (typeof self.onUiScrollableWheel === 'function') self.onUiScrollableWheel(e);
        };
        document.addEventListener('wheel', this._wh, { capture: true, passive: false });
        this._md = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) return;
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            if (self.play && !self.isPointInFixedViewportRect(self.lastPointerClientX, self.lastPointerClientY)) {
                self.stopPlaybackLikeSpace('outside-pointer');
            }
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
            if (self.mapCreateCtx && self.mapCreateCtx.classList && self.mapCreateCtx.classList.contains('on')) {
                var pr = self.mapCreateCtx.getBoundingClientRect();
                var inMapMenu = (e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom);
                if (!inMapMenu) self.closeMapCreateContextMenu();
            }
            if (self.routeCtx && self.routeCtx.classList && self.routeCtx.classList.contains('on')) {
                var rr = self.routeCtx.getBoundingClientRect();
                var inRouteMenu = (e.clientX >= rr.left && e.clientX <= rr.right && e.clientY >= rr.top && e.clientY <= rr.bottom);
                if (!inRouteMenu) self.closeRouteRangeContextMenu();
            }
            if (e.button === 1) {
                if (self.tryStartSpacePanOnGame(e)) return;
                return;
            }
            if (e.button !== 0) return;
            if (self.onUi(e.clientX, e.clientY)) {
                return;
            }
            if (self.isBattleEventMode()) return;
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
            var sx = Number(e.clientX || 0);
            var sy = Number(e.clientY || 0);
            if (self.play && !self.isPointInFixedViewportRect(sx, sy)) {
                self.stopPlaybackLikeSpace('outside-pointer');
            }
            if (self.isBattleEventMode()) {
                if (!self.onUi(sx, sy)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            if (self.dragMode === 'tile') return;
            if (self.isPointInFixedViewportRect(sx, sy)) {
                if (!self.onUi(sx, sy)) self.onGameFrameContextMenu(e);
                return;
            }
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
        this._beforeUnload = function(e) {
            if (!self.on || !self.hasUnsavedChanges()) return;
            self.writeRecoverySnapshot(true);
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', this._beforeUnload);
    };

    EE.prototype.unbind = function() {
        if (typeof this.endContextEventAdjustMode === 'function') this.endContextEventAdjustMode(true);
        if (this.dragMode === 'tile') this.cancelTileMoveMode(true);
        if (this.sePickerModal && this.sePickerModal.classList.contains('on')) this.closeSePicker(false);
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
        if (this._beforeUnload) window.removeEventListener('beforeunload', this._beforeUnload);
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
        this._beforeUnload = null;
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

    EE.prototype.graphicsCanvasRectCached = function() {
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        if (!cv || !cv.getBoundingClientRect) return null;
        var frame = (Graphics && Graphics.frameCount != null) ? Math.floor(Number(Graphics.frameCount || 0)) : -1;
        if (frame < 0) return cv.getBoundingClientRect();
        var cache = this._eeCanvasRectCache;
        if (cache && cache.frame === frame && cache.rect) return cache.rect;
        var rect = cv.getBoundingClientRect();
        this._eeCanvasRectCache = { frame: frame, rect: rect };
        return rect;
    };

    EE.prototype.graphicsCanvasMetricsCached = function() {
        var frame = (Graphics && Graphics.frameCount != null) ? Math.floor(Number(Graphics.frameCount || 0)) : -1;
        var bw = Number(Graphics.width || Graphics.boxWidth || 816);
        var bh = Number(Graphics.height || Graphics.boxHeight || 624);
        if (frame >= 0) {
            var cache = this._eeCanvasMetricsCache;
            if (cache && cache.frame === frame && cache.bw === bw && cache.bh === bh) return cache;
        }
        var rect = this.graphicsCanvasRectCached();
        if (!rect) return null;
        var out = {
            frame: frame,
            rect: rect,
            bw: bw,
            bh: bh,
            sx: rect.width / Math.max(1, bw),
            sy: rect.height / Math.max(1, bh)
        };
        if (frame >= 0) this._eeCanvasMetricsCache = out;
        return out;
    };

    EE.prototype.fixedViewportRectScreen = function() {
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        var cache = this._fixedViewportScreenCache;
        if (cache && cache.ww === ww && cache.wh === wh && cache.rect) return cache.rect;
        var leftPad = 380;
        var rightPad = 380;
        var topPad = 0;
        var fixedH = this.isBattleEventMode() ? 560 : 420;
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
        var rect = { x: x, y: y, w: w, h: h };
        this._fixedViewportScreenCache = { ww: ww, wh: wh, rect: rect };
        return rect;
    };

    EE.prototype.fixedViewportRectCanvas = function() {
        var frame = (Graphics && Graphics.frameCount != null) ? Math.floor(Number(Graphics.frameCount || 0)) : -1;
        var sr = this.fixedViewportRectScreen();
        if (!sr) return null;
        var cache = this._fixedViewportCanvasCache;
        if (cache &&
            cache.frame === frame &&
            cache.sx === sr.x && cache.sy === sr.y &&
            cache.sw === sr.w && cache.sh === sr.h &&
            cache.rect) {
            return cache.rect;
        }
        var p1 = this.screenPointToCanvas(sr.x, sr.y);
        var p2 = this.screenPointToCanvas(sr.x + sr.w, sr.y + sr.h);
        if (!p1 || !p2) return null;
        var x1 = Math.min(Number(p1.x || 0), Number(p2.x || 0));
        var y1 = Math.min(Number(p1.y || 0), Number(p2.y || 0));
        var x2 = Math.max(Number(p1.x || 0), Number(p2.x || 0));
        var y2 = Math.max(Number(p1.y || 0), Number(p2.y || 0));
        var rect = {
            x: Math.floor(x1),
            y: Math.floor(y1),
            w: Math.max(1, Math.floor(x2 - x1)),
            h: Math.max(1, Math.floor(y2 - y1))
        };
        this._fixedViewportCanvasCache = {
            frame: frame,
            sx: sr.x, sy: sr.y, sw: sr.w, sh: sr.h,
            rect: rect
        };
        return rect;
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
    };

    EE.prototype.applyEditorDisplayState = function() {
        if (this.controlMode) return;
        if (!$gameMap || !$gameMap.setDisplayPos) return;
        this.ensureEditorDisplayState();
        $gameMap.setDisplayPos(Number(this.editorDisplayX || 0), Number(this.editorDisplayY || 0));
        this.editorDisplayX = Number($gameMap._displayX == null ? this.editorDisplayX : $gameMap._displayX);
        this.editorDisplayY = Number($gameMap._displayY == null ? this.editorDisplayY : $gameMap._displayY);
    };

    EE.prototype.setGameFramePinnedMode = function(enabled) {
        var on = !!enabled;
        if (!!this.gameFramePinned === on) return;
        this.gameFramePinned = on;
        this.updateGameFrameVisual();
        this.timelineDirty = true;
    };

    EE.prototype.updateOverlayClipMask = function() {
        var ov = this.charOverlayLayer;
        if (!ov) return;
        var st = ov.style;
        if (st.top !== '0px') st.top = '0px';
        if (st.left !== '0px') st.left = '0px';
        if (st.right !== '0px') st.right = '0px';
        if (st.bottom !== '0px') st.bottom = '0px';
        if (st.height !== '') st.height = '';
        if (st.overflow !== 'hidden') st.overflow = 'hidden';
        var vr = this.fixedViewportRectScreen();
        if (!vr || !isFinite(vr.x) || !isFinite(vr.y) || !isFinite(vr.w) || !isFinite(vr.h)) {
            if (st.clipPath !== '') st.clipPath = '';
            if (st.webkitClipPath !== '') st.webkitClipPath = '';
            this._overlayClipInset = '';
            return;
        }
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        var top = Math.max(0, Math.floor(vr.y));
        var left = Math.max(0, Math.floor(vr.x));
        var right = Math.max(0, ww - Math.floor(vr.x + vr.w));
        var bottom = Math.max(0, wh - Math.floor(vr.y + vr.h));
        var inset = 'inset(' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px)';
        if (this._overlayClipInset !== inset) {
            st.clipPath = inset;
            st.webkitClipPath = inset;
            this._overlayClipInset = inset;
        }
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
        var sig = String(x) + ',' + String(y) + ',' + String(w) + ',' + String(h);
        if (this._gameClipMaskSig !== sig) {
            m.clear();
            m.beginFill(0xffffff, 1);
            m.drawRect(x, y, w, h);
            m.endFill();
            this._gameClipMaskSig = sig;
        }
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
        this._gameClipMaskSig = '';
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
        if (Math.abs(Number(scene.scale.x || 1) - scale) > 1e-6) scene.scale.x = scale;
        if (Math.abs(Number(scene.scale.y || 1) - scale) > 1e-6) scene.scale.y = scale;
        var targetX = 0;
        var targetY = 0;
        if (vr) {
            targetX = Math.floor(Number(vr.x || 0) + (vw - gw * scale) / 2);
            targetY = Math.floor(Number(vr.y || 0) + (vh - gh * scale) / 2);
        } else {
            targetX = Math.floor((gw - gw * scale) / 2);
            targetY = 8;
        }
        if (Math.abs(Number(scene.x || 0) - targetX) > 1e-6) scene.x = targetX;
        if (Math.abs(Number(scene.y || 0) - targetY) > 1e-6) scene.y = targetY;
        if (this.savedScale) {
            if (Math.abs(Number(ss.scale.x || 1) - Number(this.savedScale.sx || 1)) > 1e-6) ss.scale.x = this.savedScale.sx;
            if (Math.abs(Number(ss.scale.y || 1) - Number(this.savedScale.sy || 1)) > 1e-6) ss.scale.y = this.savedScale.sy;
            if (Math.abs(Number(ss.x || 0) - Number(this.savedScale.x || 0)) > 1e-6) ss.x = this.savedScale.x;
            if (Math.abs(Number(ss.y || 0) - Number(this.savedScale.y || 0)) > 1e-6) ss.y = this.savedScale.y;
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
        var cm = this.graphicsCanvasMetricsCached();
        if (!cm || !cm.rect) return null;
        var cr = cm.rect;
        var bw = cm.bw;
        var bh = cm.bh;
        var sx = Number(scene.scale && scene.scale.x != null ? scene.scale.x : 1);
        var sy = Number(scene.scale && scene.scale.y != null ? scene.scale.y : 1);
        var ux = cm.sx;
        var uy = cm.sy;
        var x = cr.left + Number(scene.x || 0) * ux;
        var y = cr.top + Number(scene.y || 0) * uy;
        var w = bw * sx * ux;
        var h = bh * sy * uy;
        return { x: x, y: y, w: w, h: h };
    };

    EE.prototype.canvasToScreenRect = function(x, y, w, h) {
        var cm = this.graphicsCanvasMetricsCached();
        if (!cm || !cm.rect) return null;
        var cr = cm.rect;
        var sx = cm.sx;
        var sy = cm.sy;
        var rx = cr.left + Number(x || 0) * sx;
        var ry = cr.top + Number(y || 0) * sy;
        var rw = Number(w || 0) * sx;
        var rh = Number(h || 0) * sy;
        return { x: rx, y: ry, w: rw, h: rh };
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
            var vfs = this.gameViewportFrame.style;
            if (vr) {
                var vLeft = Math.floor(vr.x) + 'px';
                var vTop = Math.floor(vr.y) + 'px';
                var vWidth = Math.max(1, Math.floor(vr.w)) + 'px';
                var vHeight = Math.max(1, Math.floor(vr.h)) + 'px';
                if (vfs.display !== 'block') vfs.display = 'block';
                if (vfs.left !== vLeft) vfs.left = vLeft;
                if (vfs.top !== vTop) vfs.top = vTop;
                if (vfs.width !== vWidth) vfs.width = vWidth;
                if (vfs.height !== vHeight) vfs.height = vHeight;
            } else {
                if (vfs.display !== 'none') vfs.display = 'none';
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
        this.ensureEditorDisplayState();
        if (r && this.s && $gameMap) {
            var cm = this.graphicsCanvasMetricsCached();
            var ux = cm ? Number(cm.sx || 1) : 1;
            var uy = cm ? Number(cm.sy || 1) : 1;
            var scx = Number(this.s.scale && this.s.scale.x != null ? this.s.scale.x : 1);
            var scy = Number(this.s.scale && this.s.scale.y != null ? this.s.scale.y : 1);
            var tw = Number($gameMap.tileWidth ? $gameMap.tileWidth() : 48);
            var th = Number($gameMap.tileHeight ? $gameMap.tileHeight() : 48);
            var runtimeDisplayX = (!this.controlMode && this.runtimeDisplayX != null)
                ? Number(this.runtimeDisplayX)
                : Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
            var runtimeDisplayY = (!this.controlMode && this.runtimeDisplayY != null)
                ? Number(this.runtimeDisplayY)
                : Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
            var viewportDisplayX = this.controlMode
                ? runtimeDisplayX
                : Number(this.editorDisplayX == null ? runtimeDisplayX : this.editorDisplayX);
            var viewportDisplayY = this.controlMode
                ? runtimeDisplayY
                : Number(this.editorDisplayY == null ? runtimeDisplayY : this.editorDisplayY);
            // Frame should stay on runtime displayXY; moving editor viewport must shift frame relatively.
            var dxTiles = runtimeDisplayX - viewportDisplayX;
            var dyTiles = runtimeDisplayY - viewportDisplayY;
            gfLeft += dxTiles * tw * scx * ux;
            gfTop += dyTiles * th * scy * uy;
        }
        var gfs = this.gameFrame.style;
        var gfLeftPx = Math.floor(gfLeft) + 'px';
        var gfTopPx = Math.floor(gfTop) + 'px';
        var gfWidthPx = gfWidth + 'px';
        var gfHeightPx = gfHeight + 'px';
        if (gfs.display !== 'block') gfs.display = 'block';
        if (gfs.left !== gfLeftPx) gfs.left = gfLeftPx;
        if (gfs.top !== gfTopPx) gfs.top = gfTopPx;
        if (gfs.width !== gfWidthPx) gfs.width = gfWidthPx;
        if (gfs.height !== gfHeightPx) gfs.height = gfHeightPx;
        if (this.play) {
            if (gfs.borderColor !== 'rgba(255,60,170,.95)') gfs.borderColor = 'rgba(255,60,170,.95)';
            if (gfs.boxShadow !== '0 0 0 1px rgba(255,180,230,.95) inset') gfs.boxShadow = '0 0 0 1px rgba(255,180,230,.95) inset';
        } else if (this.gameFramePinned) {
            if (gfs.borderColor !== 'rgba(255,216,125,.98)') gfs.borderColor = 'rgba(255,216,125,.98)';
            if (gfs.boxShadow !== '0 0 0 1px rgba(255,243,196,.88) inset') gfs.boxShadow = '0 0 0 1px rgba(255,243,196,.88) inset';
        } else {
            if (gfs.borderColor !== 'rgba(170,170,170,.95)') gfs.borderColor = 'rgba(170,170,170,.95)';
            if (gfs.boxShadow !== '0 0 0 1px rgba(230,230,230,.75) inset') gfs.boxShadow = '0 0 0 1px rgba(230,230,230,.75) inset';
        }
    };

    EE.prototype.syncPlaybackStateHistoryLog = function() {
        var now = !!this.play;
        if (this._eePlaybackHistoryLastState == null) {
            this._eePlaybackHistoryLastState = now;
            return;
        }
        if (this._eePlaybackHistoryLastState === now) return;
        this._eePlaybackHistoryLastState = now;
        if (typeof this.appendPlaybackStateLog === 'function') {
            this.appendPlaybackStateLog(now, this.frame);
        }
    };

    EE.prototype.hasUnsavedChanges = function() {
        if (Object.keys(this.dirty || {}).length) return true;
        var documentDirty = this.documentDirty || { events: {}, troops: {} };
        return !!(Object.keys(documentDirty.events || {}).length || Object.keys(documentDirty.troops || {}).length);
    };

    EE.prototype.closeEditorNow = function(discardUnsaved) {
        try { if (typeof this.restoreBase === 'function') this.restoreBase(); } catch (_) {}
        NS._runtimeEnabled = false;
        NS._boot = false;
        this._skipRecoveryOnStop = true;
        if (discardUnsaved) this.clearRecoverySnapshot();
        this.stop();
        return true;
    };

    EE.prototype.requestCloseEditor = function() {
        var discardUnsaved = this.hasUnsavedChanges();
        if (!discardUnsaved) return this.closeEditorNow(false);
        var self = this;
        this.openEditorConfirmDialog({
            title: '未保存の変更',
            message: '未保存の変更があります。\n保存せずにイベントエディタを閉じますか？',
            okText: '保存せず閉じる',
            cancelText: '編集を続ける',
            onConfirm: function() { return self.closeEditorNow(true); }
        });
        return false;
    };

    EE.prototype.recoveryContextInfo = function() {
        var battle = this.isBattleEventMode();
        return {
            mode: battle ? 'battle' : 'map',
            contextId: battle
                ? Math.max(1, Math.floor(Number(this.currentBattleTroopId() || 0)))
                : Math.max(1, Math.floor(Number($gameMap && $gameMap.mapId ? $gameMap.mapId() : 0)))
        };
    };

    EE.prototype.recoveryFilePath = function() {
        try {
            var path = require('path');
            var info = this.recoveryContextInfo();
            var prefix = info.mode === 'battle' ? 'Troop' : 'Map';
            var fileName = prefix + ('000' + info.contextId).slice(-3) + '.recovery.json';
            return path.join(process.cwd(), 'data', '_event_editor', 'recovery', fileName);
        } catch (_) {
            return '';
        }
    };

    EE.prototype.buildRecoveryState = function() {
        var info = this.recoveryContextInfo();
        var documentDirty = clone(this.documentDirty || { events: {}, troops: {} });
        var documentEvents = {};
        var eventIds = Object.keys(documentDirty.events || {});
        for (var i = 0; i < eventIds.length; i++) {
            var eventId = Math.max(0, Math.floor(Number(eventIds[i] || 0)));
            documentEvents[eventId] = ($dataMap && Array.isArray($dataMap.events) && $dataMap.events[eventId])
                ? clone($dataMap.events[eventId])
                : null;
        }
        var documentTroops = {};
        var troopIds = Object.keys(documentDirty.troops || {});
        for (var j = 0; j < troopIds.length; j++) {
            var troopId = Math.max(0, Math.floor(Number(troopIds[j] || 0)));
            documentTroops[troopId] = ($dataTroops && Array.isArray($dataTroops) && $dataTroops[troopId])
                ? clone($dataTroops[troopId])
                : null;
        }
        return {
            plugin: 'KNH_ZXC_EventEditor',
            version: String(NS.VERSION || '0.3.0'),
            mode: info.mode,
            contextId: info.contextId,
            model: clone(this.model),
            dirty: clone(this.dirty || {}),
            documentDirty: documentDirty,
            documentEvents: documentEvents,
            documentTroops: documentTroops,
            selection: {
                eventId: Number(this.selEid || 0),
                pageIndex: Number(this.selPage == null ? -1 : this.selPage),
                key: String(this.selKey || ''),
                uid: Number(this.selUid || 0),
                routeListIndex: Number(this.selRouteListIndex == null ? -1 : this.selRouteListIndex),
                frame: Math.max(0, Math.floor(Number(this.frame || 0)))
            }
        };
    };

    EE.prototype.writeRecoverySnapshot = function(force) {
        if (!this.hasUnsavedChanges()) return false;
        var now = Date.now();
        if (!force && now - Number(this._recoveryLastWriteAt || 0) < 2000) return false;
        var filePath = this.recoveryFilePath();
        if (!filePath) return false;
        try {
            var fs = require('fs');
            var path = require('path');
            var state = this.buildRecoveryState();
            var stateText = JSON.stringify(state);
            if (!force && stateText === this._recoveryLastStateText) return false;
            state.savedAt = new Date(now).toISOString();
            var text = JSON.stringify(state, null, 2);
            var dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            this.writeTextFileAtomic(filePath, text);
            this._recoveryLastStateText = stateText;
            this._recoveryLastWriteAt = now;
            return true;
        } catch (e) {
            if (typeof this.err === 'function') this.err('E_RECOVERY_WRITE', e);
            return false;
        }
    };

    EE.prototype.clearRecoverySnapshot = function() {
        var filePath = this.recoveryFilePath();
        if (!filePath) return false;
        try {
            var storage = NS._eeServices && NS._eeServices.storage;
            if (storage && typeof storage.removeFileIfExists === 'function') storage.removeFileIfExists(filePath);
            else {
                var fs = require('fs');
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            this._recoveryLastStateText = '';
            this._recoveryLastWriteAt = 0;
            return true;
        } catch (e) {
            if (typeof this.err === 'function') this.err('E_RECOVERY_CLEAR', e);
            return false;
        }
    };

    EE.prototype.applyRecoverySnapshot = function(recovery) {
        if (!recovery || !recovery.model || !recovery.model.tracks) throw new Error('invalid recovery model');
        this.model = clone(recovery.model);
        this.dirty = clone(recovery.dirty || {});
        this.documentDirty = clone(recovery.documentDirty || { events: {}, troops: {} });
        var documentEvents = recovery.documentEvents || {};
        var eventIds = Object.keys(documentEvents);
        for (var i = 0; i < eventIds.length; i++) {
            var eventId = Math.max(0, Math.floor(Number(eventIds[i] || 0)));
            $dataMap.events[eventId] = documentEvents[eventIds[i]] == null ? null : clone(documentEvents[eventIds[i]]);
            if (!this._documentUndoEventIds) this._documentUndoEventIds = {};
            this._documentUndoEventIds[eventId] = true;
            if (typeof this.refreshDocumentEventRuntime === 'function') this.refreshDocumentEventRuntime(eventId);
        }
        var documentTroops = recovery.documentTroops || {};
        var troopIds = Object.keys(documentTroops);
        for (var j = 0; j < troopIds.length; j++) {
            var troopId = Math.max(0, Math.floor(Number(troopIds[j] || 0)));
            $dataTroops[troopId] = documentTroops[troopIds[j]] == null ? null : clone(documentTroops[troopIds[j]]);
            if (!this._documentUndoTroopIds) this._documentUndoTroopIds = {};
            this._documentUndoTroopIds[troopId] = true;
        }
        var selection = recovery.selection || {};
        this.selEid = Number(selection.eventId || 0);
        this.selPage = Number(selection.pageIndex == null ? -1 : selection.pageIndex);
        this.selKey = String(selection.key || '');
        this.selUid = Number(selection.uid || 0);
        this.selRouteListIndex = Number(selection.routeListIndex == null ? -1 : selection.routeListIndex);
        this.frame = Math.max(0, Math.floor(Number(selection.frame || 0)));
        this._scheduleEntriesByTrack = null;
        this._trackRevisionByKey = {};
        this.rebuildSchedule({ skipRouteNormalize: true });
        this.simTo(this.frame, false);
        this.timelineDirty = true;
        this._recoverySnapshotDecision = 'restored';
        if (Array.isArray(this.undoS)) this.undoS.length = 0;
        if (Array.isArray(this.redoS)) this.redoS.length = 0;
        if (typeof this.pushSnap === 'function') this.pushSnap('recovery');
        this.msg('未保存データを復元しました');
        return true;
    };

    EE.prototype.restoreRecoverySnapshotIfAvailable = function() {
        var filePath = this.recoveryFilePath();
        if (!filePath) return false;
        try {
            var fs = require('fs');
            if (!fs.existsSync(filePath)) return false;
            var recovery = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            var info = this.recoveryContextInfo();
            if (!recovery || recovery.plugin !== 'KNH_ZXC_EventEditor' ||
                String(recovery.mode || '') !== info.mode || Number(recovery.contextId || 0) !== info.contextId) return false;
            var self = this;
            this.openEditorConfirmDialog({
                title: '未保存データの復元',
                message: '前回終了時の未保存データがあります。復元しますか？\n' + String(recovery.savedAt || ''),
                okText: '復元する',
                cancelText: '復元しない',
                onConfirm: function() {
                    try { return self.applyRecoverySnapshot(recovery); }
                    catch (e) {
                        if (typeof self.err === 'function') self.err('E_RECOVERY_APPLY', e);
                        return false;
                    }
                },
                onCancel: function() { self._recoverySnapshotDecision = 'declined'; }
            });
            return true;
        } catch (e2) {
            if (typeof this.err === 'function') this.err('E_RECOVERY_READ', e2);
            return false;
        }
    };

    EE.prototype.setPlayBtn = function() {
        this.syncPlaybackStateHistoryLog();
    };

    EE.prototype.stopPlaybackLikeSpace = function(reason) {
        if (!this.play) return false;
        this.manualPause = true;
        this.play = false;
        this.clearMessageRuntimeState();
        this.stopEditorAudioPlayback();
        this.stopTimelineAutoScrollAnimation();
        this.setPlayBtn();
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        this.msg(this.play ? '再生中' : '一時停止（Space）');
        return true;
    };

    EE.prototype.handleCtrlRShortcut = function() {
        if (this.play) {
            this.seek(Math.max(0, Math.floor(Number(this.playStartFrame || 0))));
            this.manualPause = true;
            this.msg('再生開始前フレームへ移動');
            return;
        }
        this.setInteractionMode(this.controlMode ? 'timeline' : 'game', 'Ctrl+R');
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
            this.runtimeDisplayX = gx;
            this.runtimeDisplayY = gy;
        }
        if (wasGame && !toGame) this._simForceFull = true;
        if (!toGame) this.manualPause = false;
        this.play = toGame ? !this.manualPause : false;
        if (!wasPlaying && this.play) {
            this.keepRuntimeDisplayOnPlayStart = true;
            this.playStartFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
            if (typeof this.ensurePlaybackCursorVisibleOnStart === 'function') this.ensurePlaybackCursorVisibleOnStart();
        }
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
        this.msg((toGame ? 'GAMEモード' : 'EDITモード') + (reason ? ' [' + reason + ']' : ''));
    };

    EE.prototype.isBlockingEditorUiOpen = function() {
        if (this.isAnyRegisteredEditorModalOpen) return this.isAnyRegisteredEditorModalOpen();
        var names = [
            'modal', 'simplePromptModal', 'addModal', 'routeModal', 'waitInsertModal', 'messageBubbleBulkModal',
            'memoModal', 'eventSettingsModal', 'eventSettingsNoteZoomModal', 'eventSettingsImagePickerModal',
            'battleEventSettingsModal', 'sePickerModal', 'switchPickerModal', 'variablePickerModal'
        ];
        for (var i = 0; i < names.length; i++) {
            var node = this[names[i]];
            if (node && node.classList && node.classList.contains('on')) return true;
        }
        return false;
    };

    EE.prototype.allowGameInput = function() {
        if (!this.on || !this.controlMode) return false;
        return !this.isBlockingEditorUiOpen();
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
            this.msg('タイムライン編集モード: 再生は常にOFFです');
            return;
        }
        this.manualPause = !this.manualPause;
        this.play = !this.manualPause;
        if (!wasPlaying && this.play) {
            this.keepRuntimeDisplayOnPlayStart = true;
            this.playStartFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
            if (typeof this.ensurePlaybackCursorVisibleOnStart === 'function') this.ensurePlaybackCursorVisibleOnStart();
        }
        if (wasPlaying && !this.play) this.clearMessageRuntimeState();
        if (this.play) this.rebuildSimAudioPlayback(this.frame);
        else {
            this.stopEditorAudioPlayback();
            this.stopTimelineAutoScrollAnimation();
        }
        this.setPlayBtn();
        this.refreshCharacterOverlay(true);
        this.msg(this.play ? '再生中' : '停止しました');
    };

    EE.prototype.isPointInTimelineRect = function(sx, sy) {
        if (!this.timeline || !this.timeline.getBoundingClientRect) return false;
        var r = this.timeline.getBoundingClientRect();
        return sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom;
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

    EE.prototype.trySpaceWheelPan = function(e) {
        if (!e || !this.on || this.controlMode) return false;
        if (!this.isSpacePanModifierActive()) return false;
        var sx = Number(e.clientX == null ? this.lastPointerClientX : e.clientX);
        var sy = Number(e.clientY == null ? this.lastPointerClientY : e.clientY);
        if (this.onUi(sx, sy)) return false;
        if (!this.isPointInFixedViewportRect(sx, sy)) return false;

        var modeScale = 1;
        if (Number(e.deltaMode || 0) === 1) modeScale = 16;
        else if (Number(e.deltaMode || 0) === 2) modeScale = Math.max(100, Math.floor(window.innerHeight || 100));
        var dx = Number(e.deltaX || 0) * modeScale;
        var dy = Number(e.deltaY || 0) * modeScale;
        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001 && e.wheelDelta != null) dy = -Number(e.wheelDelta || 0);
        if (e.shiftKey && Math.abs(dx) < 0.01 && Math.abs(dy) > 0.01) {
            dx = dy;
            dy = 0;
        }
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false;
        if (!$gameMap) return false;

        this.ensureEditorDisplayState();
        var cm = this.graphicsCanvasMetricsCached();
        var ux = cm ? Number(cm.sx || 1) : 1;
        var uy = cm ? Number(cm.sy || 1) : 1;
        var scx = Number(this.s && this.s.scale && this.s.scale.x != null ? this.s.scale.x : 1);
        var scy = Number(this.s && this.s.scale && this.s.scale.y != null ? this.s.scale.y : 1);
        var tw = Number($gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var pxPerTileX = tw * scx * ux;
        var pxPerTileY = th * scy * uy;
        if (!(pxPerTileX > 1e-6)) pxPerTileX = Math.max(1, tw);
        if (!(pxPerTileY > 1e-6)) pxPerTileY = Math.max(1, th);

        if (this.gameFramePinned) this.setGameFramePinnedMode(false);
        this.editorDisplayX = Number(this.editorDisplayX || 0) + dx / pxPerTileX;
        this.editorDisplayY = Number(this.editorDisplayY || 0) + dy / pxPerTileY;
        this.applyEditorDisplayState();
        this.applyGameViewport();
        this.stepVisualRuntime();
        this.updateGameFrameVisual();
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        this.lastPointerClientX = sx;
        this.lastPointerClientY = sy;
        this.refreshSpacePanCursor(sx, sy);
        e.preventDefault();
        e.stopPropagation();
        return true;
    };

    EE.prototype.setGlobalSpaceCursorClass = function(cursor) {
        var de = (typeof document !== 'undefined' && document && document.documentElement) ? document.documentElement : null;
        if (!de || !de.classList) return;
        de.classList.remove('knh-ee-cursor-move');
        if (cursor === 'move') de.classList.add('knh-ee-cursor-move');
    };

    EE.prototype.tryStartSpacePanOnTimeline = function(e, x, y) {
        if (!this.timelineWrap) return false;
        var btn = Math.floor(Number(e && e.button || 0));
        if (btn !== 0 && btn !== 1) return false;
        if (!(this.isSpacePanModifierActive() || btn === 1)) return false;
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
        var btn = Math.floor(Number(e && e.button || 0));
        if (btn !== 0 && btn !== 1) return false;
        if (!(this.isSpacePanModifierActive() || btn === 1)) return false;
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
        if (ps.mode === 'game' && ps.moved && this.gameFramePinned) this.setGameFramePinnedMode(false);
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
        var cm = this.graphicsCanvasMetricsCached();
        var cr = cm ? cm.rect : null;
        if (!cr || !(cr.width > 0) || !(cr.height > 0)) return false;
        var ux = Number(cm.sx || 1);
        var uy = Number(cm.sy || 1);
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
        this.stopGameFrameCenterAnimation();
        this.editorDisplayX = tx;
        this.editorDisplayY = ty;
        this.applyEditorDisplayState();
        this.applyGameViewport();
        this.stepVisualRuntime();
        this.updateGameFrameVisual();
        this.refreshCharacterOverlay(true);
        this.timelineDirty = true;
        return true;
    };

    EE.prototype.tryCenterGameFrameOnClick = function(e) {
        if (!e || Number(e.button || 0) !== 0) return false;
        if (this.isSpacePanModifierActive()) return false;
        if (this.dragMode === 'tile') return false;
        var sx = Number(e.clientX || 0);
        var sy = Number(e.clientY || 0);
        if (!this.isPointOnGameFrameBorder(sx, sy)) return false;
        this.centerGameFrameIntoViewport(0);
        this.setGameFramePinnedMode(true);
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
                if (!this._eeMapRectTmpIn1) this._eeMapRectTmpIn1 = new PIXI.Point();
                if (!this._eeMapRectTmpIn2) this._eeMapRectTmpIn2 = new PIXI.Point();
                if (!this._eeMapRectTmpOut1) this._eeMapRectTmpOut1 = new PIXI.Point();
                if (!this._eeMapRectTmpOut2) this._eeMapRectTmpOut2 = new PIXI.Point();
                this._eeMapRectTmpIn1.x = cx;
                this._eeMapRectTmpIn1.y = cy;
                this._eeMapRectTmpIn2.x = cx + cw;
                this._eeMapRectTmpIn2.y = cy + ch;
                var p1 = ss.worldTransform.apply(this._eeMapRectTmpIn1, this._eeMapRectTmpOut1);
                var p2 = ss.worldTransform.apply(this._eeMapRectTmpIn2, this._eeMapRectTmpOut2);
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
        var cm = this.graphicsCanvasMetricsCached();
        if (!cm || !cm.rect) return null;
        var cr = cm.rect;
        return {
            x: cr.left + Number(cx || 0) * Number(cm.sx || 1),
            y: cr.top + Number(cy || 0) * Number(cm.sy || 1)
        };
    };

    EE.prototype.screenPointToCanvas = function(sx, sy) {
        var cm = this.graphicsCanvasMetricsCached();
        if (!cm || !cm.rect) return null;
        var cr = cm.rect;
        var bw = Number(cm.bw || 816);
        var bh = Number(cm.bh || 624);
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
        var ch = this.routeCharacterByEntry ? this.routeCharacterByEntry(entry) : this.characterByPanelId(cid);
        if (!ch) ch = this.characterByPanelId(cid);
        var sx = ch ? Number(ch._x == null ? (ch.x == null ? ch._realX : ch.x) : ch._x) : 0;
        var sy = ch ? Number(ch._y == null ? (ch.y == null ? ch._realY : ch.y) : ch._y) : 0;
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        sx = this.tileMoveSnapCoord(sx);
        sy = this.tileMoveSnapCoord(sy);
        var st = this.routeTileEditorPickState;
        if (!st ||
            Number(st.uid || 0) !== Number(entry.uid || 0) ||
            Number(st.routeListIndex == null ? -1 : st.routeListIndex) !== idx ||
            Number(st.charId || 0) !== Number(cid || 0)) {
            var startState = this.routeJumpPreviewStartState ? this.routeJumpPreviewStartState(entry, idx, ch) : null;
            st = {
                uid: Number(entry.uid || 0),
                routeListIndex: idx,
                charId: cid,
                startX: Number(startState && startState.x != null ? startState.x : sx),
                startY: Number(startState && startState.y != null ? startState.y : sy),
                speed: Math.max(1, Math.min(6, Math.floor(Number(startState && startState.speed != null ? startState.speed : this.characterMoveSpeedForTileMove(ch)) || 4))),
                previewRelocate: true,
                appliedX: null,
                appliedY: null,
                previewTargetX: null,
                previewTargetY: null,
                previewWaitFrames: 0,
                previewFrame: 0,
                previewStarted: false
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
            if (st.previewRelocate !== false && ch) {
                this.updateRouteTilePreviewCharacter(st, ch, pvx, pvy, wf);
            }
        } else {
            this.updateTileMoveMarker(null, null, 0);
            if (st.previewRelocate !== false && ch && (st.appliedX != null || st.appliedY != null)) {
                st.appliedX = null;
                st.appliedY = null;
                st.previewTargetX = null;
                st.previewTargetY = null;
                st.previewWaitFrames = 0;
                st.previewFrame = 0;
                st.previewStarted = false;
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

    EE.prototype.isRouteJumpPreviewCharacterJumping = function(ch) {
        if (!ch) return false;
        try {
            if (typeof ch.isJumping === 'function') return !!ch.isJumping();
        } catch (_) {}
        return Number(ch._jumpCount || 0) > 0;
    };

    EE.prototype.stepRouteJumpPreviewCharacter = function(ch) {
        if (!ch) return;
        try {
            if (typeof ch.updateJump === 'function' && Number(ch._jumpCount || 0) > 0) {
                ch.updateJump();
                return;
            }
        } catch (_) {}
        try {
            var jc = Math.max(0, Math.floor(Number(ch._jumpCount || 0)));
            if (jc > 0) ch._jumpCount = jc - 1;
        } catch (_) {}
    };

    EE.prototype.routeJumpPreviewDebugEnabled = function() {
        try {
            if (window.__eeRouteJumpPreviewLog === true) return true;
            return !!(window._debug && typeof _debug.get === 'function' && _debug.get('eeRouteJumpPreviewLog'));
        } catch (_) {}
        return false;
    };

    EE.prototype.routeJumpPreviewDebugLog = function(tag, payload) {
        if (!this.routeJumpPreviewDebugEnabled()) return;
        try {
            console.log('[EE][RouteJumpPreview][' + String(tag || '') + ']', payload || {});
        } catch (_) {}
    };

    EE.prototype.forceRouteJumpPreviewStartPosition = function(ch, x, y) {
        if (!ch) return;
        x = Number(x || 0);
        y = Number(y || 0);
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;
        var bx = Number(ch._x == null ? (ch.x == null ? ch._realX : ch.x) : ch._x);
        var by = Number(ch._y == null ? (ch.y == null ? ch._realY : ch.y) : ch._y);
        var brx = Number(ch._realX == null ? bx : ch._realX);
        var bry = Number(ch._realY == null ? by : ch._realY);
        try { if (ch._jumpCount != null) ch._jumpCount = 0; } catch (_) {}
        try { if (ch._jumpPeak != null) ch._jumpPeak = 0; } catch (_) {}
        try {
            if (typeof ch.locateTo === 'function') ch.locateTo(x, y);
            else if (typeof ch.locate === 'function') ch.locate(x, y);
        } catch (_) {}
        try { ch._x = x; } catch (_) {}
        try { ch._y = y; } catch (_) {}
        try { ch._realX = x; } catch (_) {}
        try { ch._realY = y; } catch (_) {}
        try { if (typeof ch.refreshBushDepth === 'function') ch.refreshBushDepth(); } catch (_) {}
        this.routeJumpPreviewDebugLog('forceStart', {
            toX: x,
            toY: y,
            beforeX: bx,
            beforeY: by,
            beforeRealX: brx,
            beforeRealY: bry,
            afterX: Number(ch._x),
            afterY: Number(ch._y),
            afterRealX: Number(ch._realX),
            afterRealY: Number(ch._realY),
            jumpCount: Number(ch._jumpCount || 0)
        });
    };

    EE.prototype.routeJumpPreviewStartState = function(entry, routeListIndex, fallbackCh) {
        var ch = fallbackCh || null;
        if ((!ch) && this.routeCharacterByEntry) ch = this.routeCharacterByEntry(entry);
        var sx = ch ? Number(ch._x == null ? (ch.x == null ? ch._realX : ch.x) : ch._x) : 0;
        var sy = ch ? Number(ch._y == null ? (ch.y == null ? ch._realY : ch.y) : ch._y) : 0;
        var spd = ch ? Number(ch._moveSpeed || 4) : 4;
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        if (!isFinite(spd)) spd = 4;
        var out = {
            x: this.tileMoveSnapCoord(sx),
            y: this.tileMoveSnapCoord(sy),
            speed: Math.max(1, Math.min(6, Math.floor(spd || 4))),
            source: 'runtime_current'
        };
        if (!entry || !entry.command || Number(entry.command.code || 0) !== 205) return out;
        if (typeof this.simTo !== 'function' || this.play || this._simToRunning) return out;
        var route = entry.command.parameters && entry.command.parameters[1];
        var baseFrame = Math.max(0, Math.floor(Number(entry.frame || 0)));
        var idx = (typeof this.nodeRouteIndex === 'function')
            ? this.nodeRouteIndex(routeListIndex)
            : Math.floor(Number(routeListIndex == null ? -1 : routeListIndex));
        var offset = 0;
        if (idx >= 0 && route) {
            var it = null;
            if (typeof this.routeCommandTimelineItemByListIndex === 'function') {
                it = this.routeCommandTimelineItemByListIndex(entry, idx);
            }
            if (!it && typeof this.moveRouteTimeline === 'function') {
                var tl = this.moveRouteTimeline(route);
                var items = tl && Array.isArray(tl.items) ? tl.items : [];
                for (var i = 0; i < items.length; i++) {
                    var cand = items[i];
                    if (!cand) continue;
                    var li = (typeof this.nodeRouteIndex === 'function')
                        ? this.nodeRouteIndex(cand.listIndex)
                        : Math.floor(Number(cand.listIndex == null ? -1 : cand.listIndex));
                    if (li === idx) { it = cand; break; }
                }
            }
            if (it) offset = Math.max(0, Math.floor(Number(it.offset || 0)));
        }
        var simFrame = Math.max(0, baseFrame + offset);
        var restoreFrame = Math.max(0, Math.floor(Number(this.frame || 0)));
        var moved = false;
        try {
            if (simFrame !== restoreFrame) {
                this.simTo(simFrame, false);
                moved = true;
            }
            var simCh = this.routeCharacterByEntry ? this.routeCharacterByEntry(entry) : null;
            if (!simCh) simCh = fallbackCh || ch;
            if (simCh) {
                var x2 = Number(simCh._x == null ? (simCh.x == null ? simCh._realX : simCh.x) : simCh._x);
                var y2 = Number(simCh._y == null ? (simCh.y == null ? simCh._realY : simCh.y) : simCh._y);
                var s2 = Number(simCh._moveSpeed || out.speed || 4);
                if (isFinite(x2)) out.x = this.tileMoveSnapCoord(x2);
                if (isFinite(y2)) out.y = this.tileMoveSnapCoord(y2);
                if (isFinite(s2)) out.speed = Math.max(1, Math.min(6, Math.floor(s2 || 4)));
                out.source = 'runtime_at_route_offset';
            }
        } catch (_) {
        } finally {
            try {
                if (moved && this.simTo) this.simTo(restoreFrame, false);
            } catch (_) {}
        }
        return out;
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
            st.pendingDx = dx;
            st.pendingDy = dy;
            st.pendingHeightRate = hr;
            st.pendingDurationRate = dr;
        }

        var wasJumping = this.isRouteJumpPreviewCharacterJumping(ch);
        if (wasJumping) {
            this.stepRouteJumpPreviewCharacter(ch);
        }
        var isJumping = this.isRouteJumpPreviewCharacterJumping(ch);
        if (!isJumping && (
            st.previewDx == null || st.previewDy == null ||
            st.previewHeightRate == null || st.previewDurationRate == null ||
            st.pendingDx != null
        )) {
            var nextDx = (st.pendingDx == null) ? dx : Number(st.pendingDx);
            var nextDy = (st.pendingDy == null) ? dy : Number(st.pendingDy);
            var nextHr = this.routeJumpRateValue((st.pendingHeightRate == null) ? hr : st.pendingHeightRate, 1);
            var nextDr = this.routeJumpRateValue((st.pendingDurationRate == null) ? dr : st.pendingDurationRate, 1);
            st.pendingDx = null;
            st.pendingDy = null;
            st.pendingHeightRate = null;
            st.pendingDurationRate = null;
            st.previewDx = this.tileMoveSnapCoord(nextDx);
            st.previewDy = this.tileMoveSnapCoord(nextDy);
            st.previewHeightRate = nextHr;
            st.previewDurationRate = nextDr;
            st.jumpLoopDelay = 0;
            this.forceRouteJumpPreviewStartPosition(ch, Number(st.startX || 0), Number(st.startY || 0));
        }
        var playDx = this.tileMoveSnapCoord(Number(st.previewDx || 0));
        var playDy = this.tileMoveSnapCoord(Number(st.previewDy || 0));
        var playHr = this.routeJumpRateValue(st.previewHeightRate, 1);
        var playDr = this.routeJumpRateValue(st.previewDurationRate, 1);
        if (!isJumping) {
            // Always snap back to the fixed loop start so preview never accumulates drift.
            this.forceRouteJumpPreviewStartPosition(ch, Number(st.startX || 0), Number(st.startY || 0));
        }
        if (!isJumping) {
            st.jumpLoopDelay = 0;
            if (playDx !== 0 || playDy !== 0) {
                this.routeJumpPreviewDebugLog('jump', {
                    uid: Number(st.uid || 0),
                    routeListIndex: Number(st.routeListIndex || 0),
                    startX: Number(st.startX || 0),
                    startY: Number(st.startY || 0),
                    dx: Number(playDx || 0),
                    dy: Number(playDy || 0),
                    targetX: Number(st.startX || 0) + Number(playDx || 0),
                    targetY: Number(st.startY || 0) + Number(playDy || 0)
                });
                try {
                    if (typeof ch.jump === 'function') ch.jump(playDx, playDy, playHr, playDr);
                } catch (_) {
                    try { if (typeof ch.jump === 'function') ch.jump(playDx, playDy); } catch (_) {}
                }
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
        var ch = this.routeCharacterByEntry ? this.routeCharacterByEntry(entry) : null;
        if (!ch) ch = this.characterByPanelId(cid);
        var sx = ch ? Number(ch._x == null ? (ch.x == null ? ch._realX : ch.x) : ch._x) : 0;
        var sy = ch ? Number(ch._y == null ? (ch.y == null ? ch._realY : ch.y) : ch._y) : 0;
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        sx = this.tileMoveSnapCoord(sx);
        sy = this.tileMoveSnapCoord(sy);
        var st = this.routeJumpEditorPickState;
        if (!st ||
            Number(st.uid || 0) !== Number(entry.uid || 0) ||
            Number(st.routeListIndex == null ? -1 : st.routeListIndex) !== idx ||
            Number(st.charId || 0) !== Number(cid || 0)) {
            var startState = this.routeJumpPreviewStartState(entry, idx, ch);
            st = {
                uid: Number(entry.uid || 0),
                routeListIndex: idx,
                charId: cid,
                startX: Number(startState && startState.x != null ? startState.x : sx),
                startY: Number(startState && startState.y != null ? startState.y : sy),
                speed: Math.max(1, Math.min(6, Math.floor(Number(startState && startState.speed != null ? startState.speed : this.characterMoveSpeedForTileMove(ch)) || 4))),
                baseDisplayX: Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0),
                baseDisplayY: Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0),
                previewRelocate: true,
                appliedX: null,
                appliedY: null,
                previewDx: null,
                previewDy: null,
                previewHeightRate: 1,
                previewDurationRate: 1,
                jumpLoopDelay: 0,
                pendingDx: null,
                pendingDy: null,
                pendingHeightRate: null,
                pendingDurationRate: null
            };
            this.routeJumpEditorPickState = st;
            this.prepareTileMoveStartGhost(st);
            this.routeJumpPreviewDebugLog('init', {
                uid: Number(entry.uid || 0),
                routeListIndex: idx,
                charId: cid,
                startX: Number(st.startX || 0),
                startY: Number(st.startY || 0),
                source: String(startState && startState.source || ''),
                frame: Math.max(0, Math.floor(Number(this.frame || 0)))
            });
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
        var pointInGame = this.isPointInFixedViewportRect ? this.isPointInFixedViewportRect(sxNow, syNow) : true;
        var hoverTarget = this.tileMoveTargetFromScreen(sxNow, syNow, { ignoreUi: true, blockModal: true });
        var rel = null;
        if (hoverTarget) rel = this.routeJumpRelativeFromTarget(st, hoverTarget.x, hoverTarget.y);
        if (!rel && !pointInGame) {
            rel = {
                dx: dx,
                dy: dy,
                targetX: Number(st.startX || 0) + dx,
                targetY: Number(st.startY || 0) + dy
            };
        }
        if (!rel && st.previewDx != null && st.previewDy != null) {
            rel = {
                dx: this.tileMoveSnapCoord(Number(st.previewDx || 0)),
                dy: this.tileMoveSnapCoord(Number(st.previewDy || 0)),
                targetX: Number(st.startX || 0) + this.tileMoveSnapCoord(Number(st.previewDx || 0)),
                targetY: Number(st.startY || 0) + this.tileMoveSnapCoord(Number(st.previewDy || 0))
            };
        }
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

    EE.prototype.forceRouteTilePreviewStartPosition = function(ch, x, y) {
        if (!ch) return;
        if (typeof this.forceRouteJumpPreviewStartPosition === 'function') {
            this.forceRouteJumpPreviewStartPosition(ch, x, y);
            return;
        }
        this.applyTileMovePreviewPosition(ch, x, y);
    };

    EE.prototype.routeTilePreviewCurrentPos = function(ch) {
        if (!ch) return { x: 0, y: 0 };
        var x = Number(ch._realX == null ? (ch.x == null ? ch._x : ch.x) : ch._realX);
        var y = Number(ch._realY == null ? (ch.y == null ? ch._y : ch.y) : ch._realY);
        if (!isFinite(x)) x = Number(ch._x == null ? (ch.x || 0) : ch._x);
        if (!isFinite(y)) y = Number(ch._y == null ? (ch.y || 0) : ch._y);
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;
        return { x: x, y: y };
    };

    EE.prototype.updateRouteTilePreviewCharacter = function(st, ch, tx, ty, waitFrames) {
        if (!st || !ch) return;
        var sx = this.tileMoveSnapCoord(Number(st.startX || 0));
        var sy = this.tileMoveSnapCoord(Number(st.startY || 0));
        tx = this.tileMoveSnapCoord(Number(tx == null ? sx : tx));
        ty = this.tileMoveSnapCoord(Number(ty == null ? sy : ty));
        waitFrames = Math.max(1, Math.floor(Number(waitFrames || 1)));
        var changed = (st.previewTargetX !== tx) ||
            (st.previewTargetY !== ty) ||
            (Number(st.previewWaitFrames || 0) !== waitFrames);
        if (changed) {
            st.previewTargetX = tx;
            st.previewTargetY = ty;
            st.previewWaitFrames = waitFrames;
            st.previewFrame = 0;
            st.previewStarted = false;
        }

        var dist = Math.abs(tx - sx) + Math.abs(ty - sy);
        if (!(dist > 1e-6)) {
            this.forceRouteTilePreviewStartPosition(ch, sx, sy);
            st.appliedX = sx;
            st.appliedY = sy;
            this.stepVisualRuntime();
            this.lockTileMoveDisplay(st);
            this.refreshSelectedCharacterInfo(true);
            this.refreshCharacterOverlay(true);
            return;
        }

        if (!st.previewStarted) {
            this.forceRouteTilePreviewStartPosition(ch, sx, sy);
            st.previewFrame = 0;
            st.previewStarted = true;
            if (typeof ch.goTo === 'function') {
                try { ch.goTo(tx, ty); } catch (_) {}
            }
        }

        var usedGoTo = false;
        if (typeof ch.goTo === 'function' && typeof ch.updateMove === 'function') {
            try {
                ch.updateMove();
                usedGoTo = true;
            } catch (_) {
                usedGoTo = false;
            }
        }
        if (!usedGoTo) {
            var f = Math.max(0, Math.floor(Number(st.previewFrame || 0)));
            var t = Math.min(1, f / Math.max(1, waitFrames));
            var ix = sx + (tx - sx) * t;
            var iy = sy + (ty - sy) * t;
            this.applyTileMovePreviewPosition(ch, ix, iy);
        }
        st.previewFrame = Math.max(0, Math.floor(Number(st.previewFrame || 0))) + 1;

        var pos = this.routeTilePreviewCurrentPos(ch);
        var remain = Math.abs(Number(pos.x || 0) - tx) + Math.abs(Number(pos.y || 0) - ty);
        var reached = remain <= 0.02;
        if (!reached && Number(st.previewFrame || 0) > Math.max(3, waitFrames + 8)) reached = true;
        if (reached) {
            this.forceRouteTilePreviewStartPosition(ch, sx, sy);
            st.previewFrame = 0;
            st.previewStarted = false;
            st.appliedX = sx;
            st.appliedY = sy;
        } else {
            st.appliedX = Number(pos.x || 0);
            st.appliedY = Number(pos.y || 0);
        }
        this.stepVisualRuntime();
        this.lockTileMoveDisplay(st);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
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

    EE.prototype.beginInitialPositionEditForCharacter = function(charId) {
        return this.beginTileMoveForCharacter(charId, 'initpos');
    };

    EE.prototype.tileMoveActionLabel = function(action) {
        var act = String(action || 'route');
        if (act === 'teleport') return '瞬間移動';
        if (act === 'initpos') return '初期位置編集';
        return 'タイル移動';
    };

    EE.prototype.applyCharacterInitialPosition = function(charId, tx, ty) {
        var eventId = this.normalizeMoveTarget(charId);
        if (eventId <= 0) return { ok: false, error: 'イベントのみ編集できます' };
        var evData = ($dataMap && Array.isArray($dataMap.events)) ? $dataMap.events[eventId] : null;
        if (!evData) return { ok: false, error: 'イベントが見つかりません' };
        var nx = Math.floor(Number(tx || 0));
        var ny = Math.floor(Number(ty || 0));
        var ox = Math.floor(Number(evData.x || 0));
        var oy = Math.floor(Number(evData.y || 0));
        var changed = (ox !== nx) || (oy !== ny);
        if (changed) {
            if (typeof this.trackDocumentEventForUndo === 'function') this.trackDocumentEventForUndo(eventId);
            this.pushSnap('event-initial-position');
            evData.x = nx;
            evData.y = ny;
        }
        var evObj = ($gameMap && typeof $gameMap.event === 'function') ? $gameMap.event(eventId) : null;
        if (evObj) {
            try {
                if (typeof evObj.locate === 'function') evObj.locate(nx, ny);
                else {
                    evObj._x = nx;
                    evObj._y = ny;
                    evObj._realX = nx;
                    evObj._realY = ny;
                }
            } catch (_) {}
            try { if (typeof evObj.refresh === 'function') evObj.refresh(); } catch (_) {}
        }
        if (changed) {
            if (typeof this.contextEventAdjustMarkDirty === 'function') this.contextEventAdjustMarkDirty(eventId);
            else {
                if (!this.documentDirty) this.documentDirty = { events: {}, troops: {} };
                this.documentDirty.events[eventId] = true;
                this.timelineDirty = true;
            }
            if ($gameMap && typeof $gameMap.requestRefresh === 'function') $gameMap.requestRefresh();
        }
        if (this.base && this.base.ev) {
            if (typeof this.captureCanonicalEventState === 'function') {
                try { this.base.ev[eventId] = this.captureCanonicalEventState(eventId, evObj || null); } catch (_) {}
            } else if (evObj && typeof this.capCh === 'function') {
                try { this.base.ev[eventId] = this.capCh(evObj); } catch (_) {}
            }
        }
        this.refreshEventInfo();
        this.refreshCharacterPanel(true);
        this.refreshSelectedCharacterInfo(true);
        this.refreshCharacterOverlay(true);
        return { ok: true, changed: changed, x: nx, y: ny };
    };

    EE.prototype.beginTileMoveForCharacter = function(charId, action) {
        var act = String(action || 'route');
        if (act !== 'teleport' && act !== 'initpos') act = 'route';
        if (act !== 'initpos' && !this.needSelTrack()) return false;
        var cid = this.normalizeMoveTarget(charId);
        var ch = this.characterByPanelId(cid);
        if (!ch) {
            this.err('E_TILEMOVE_TARGET', new Error('対象キャラを取得できません'));
            return false;
        }
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
        this.updateTileMoveMarker(tx, ty, wf, act === 'route');
        this.msg(this.tileMoveActionLabel(act) + ': マップ左クリックで確定 / 右クリックでキャンセル');
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
        if (!silent) this.msg(this.tileMoveActionLabel(action) + 'をキャンセル');
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
        this.commitTrackMutation({ earliestChangedFrame: frame });
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
        var action = String(st.action || 'route');
        if (action === 'initpos') {
            var initPosResult = this.applyCharacterInitialPosition(st.charId, tx, ty);
            if (!initPosResult || !initPosResult.ok) {
                this.msg(initPosResult && initPosResult.error ? initPosResult.error : '初期位置編集に失敗しました');
                return;
            }
            var initPosText = '(' + this.tileMoveCoordText(initPosResult.x) + ', ' + this.tileMoveCoordText(initPosResult.y) + ')';
            if (initPosResult.changed) this.msg('初期位置を更新: ' + initPosText);
            else this.msg('初期位置は変更なし: ' + initPosText);
            return;
        }
        if (action === 'teleport') {
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
            this.updateTileMoveMarker(st.targetX, st.targetY, this.tileMoveWaitFrames(st, st.targetX, st.targetY), String(st.action || 'route') === 'route');
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
        var cx = Number(TouchInput.x || 0);
        var cy = Number(TouchInput.y || 0);
        var sp = this.canvasPointToScreen(cx, cy);
        var sx = sp ? Number(sp.x || 0) : cx;
        var sy = sp ? Number(sp.y || 0) : cy;
        if (this.onUi(sx, sy)) return;
        if (!this.isPointInFixedViewportRect(sx, sy)) return;
        if (!TouchInput.isTriggered()) return;
        var cid = this.pickCharacterIdAtScreen(cx, cy);
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
            if (!sp || !sp.visible || !sp._character) continue;
            var b = this.characterSpriteCanvasBounds ? this.characterSpriteCanvasBounds(sp, sp._character) : null;
            if (!b) continue;
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
        if (!this._eeScreenToMapIn) this._eeScreenToMapIn = new PIXI.Point();
        if (!this._eeScreenToMapOut) this._eeScreenToMapOut = new PIXI.Point();
        this._eeScreenToMapIn.x = Number(sx || 0);
        this._eeScreenToMapIn.y = Number(sy || 0);
        var p = ss.worldTransform.applyInverse(this._eeScreenToMapIn, this._eeScreenToMapOut);
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
            this._mouseCoordInfoVisible = false;
            return;
        }
        var cp = this.screenPointToCanvas(sx, sy);
        if (!cp) {
            if (box.style.display !== 'none') box.style.display = 'none';
            this._mouseCoordInfoVisible = false;
            return;
        }
        var mp = this.screenToMap(cp.x, cp.y, 'raw');
        if (!mp) {
            if (box.style.display !== 'none') box.style.display = 'none';
            this._mouseCoordInfoVisible = false;
            return;
        }
        this.ensureEditorDisplayState();
        var dispX = (!this.controlMode && this.runtimeDisplayX != null)
            ? Number(this.runtimeDisplayX)
            : Number($gameMap && $gameMap._displayX != null ? $gameMap._displayX : 0);
        var dispY = (!this.controlMode && this.runtimeDisplayY != null)
            ? Number(this.runtimeDisplayY)
            : Number($gameMap && $gameMap._displayY != null ? $gameMap._displayY : 0);
        var tw = Number($gameMap && $gameMap.tileWidth ? $gameMap.tileWidth() : 48);
        var th = Number($gameMap && $gameMap.tileHeight ? $gameMap.tileHeight() : 48);
        var relX = Math.round((Number(mp.x || 0) - dispX) * tw);
        var relY = Math.round((Number(mp.y || 0) - dispY) * th);
        var html =
            '<div class="mcr"><span class="lbl">画面座標</span><span class="val">(' +
            this.formatCoordText(relX, 0) + ', ' + this.formatCoordText(relY, 0) +
            ')</span></div>' +
            '<div class="mcr"><span class="lbl">タイル座標</span><span class="val">(' +
            this.formatCoordText(mp.x, 1, true) + ', ' + this.formatCoordText(mp.y, 1, true) +
            ')</span></div>' +
            '<div class="mcr"><span class="lbl">displayXY</span><span class="val">(' +
            this.formatCoordText(dispX, 1, true) + ', ' + this.formatCoordText(dispY, 1, true) +
            ')</span></div>';
        var wasVisible = !!this._mouseCoordInfoVisible;
        var sizeDirty = !wasVisible;
        if (this._mouseCoordInfoHtml !== html) {
            box.innerHTML = html;
            this._mouseCoordInfoHtml = html;
            sizeDirty = true;
        }
        if (box.style.display !== 'block') box.style.display = 'block';
        this._mouseCoordInfoVisible = true;
        var fr = this.fixedViewportRectScreen();
        if (fr) {
            var margin = 4;
            var bw = 1;
            var bh = 1;
            if (!sizeDirty && this._mouseCoordInfoSize) {
                bw = Math.max(1, Math.ceil(Number(this._mouseCoordInfoSize.w || 1)));
                bh = Math.max(1, Math.ceil(Number(this._mouseCoordInfoSize.h || 1)));
            } else {
                var br = box.getBoundingClientRect ? box.getBoundingClientRect() : null;
                bw = Math.max(1, Math.ceil(Number(br && br.width ? br.width : box.offsetWidth || 1)));
                bh = Math.max(1, Math.ceil(Number(br && br.height ? br.height : box.offsetHeight || 1)));
                this._mouseCoordInfoSize = { w: bw, h: bh };
            }
            var x = Math.floor(Number(fr.x || 0) + Number(fr.w || 0) - bw - margin);
            var y = Math.floor(Number(fr.y || 0) + Number(fr.h || 0) - bh - margin);
            var minX = Math.floor(Number(fr.x || 0) + margin);
            var minY = Math.floor(Number(fr.y || 0) + margin);
            if (x < minX) x = minX;
            if (y < minY) y = minY;
            if (this._mouseCoordInfoPosX !== x) {
                box.style.left = x + 'px';
                this._mouseCoordInfoPosX = x;
            }
            if (this._mouseCoordInfoPosY !== y) {
                box.style.top = y + 'px';
                this._mouseCoordInfoPosY = y;
            }
            if (box.style.right !== 'auto') box.style.right = 'auto';
            if (box.style.bottom !== 'auto') box.style.bottom = 'auto';
        }
    };

    EE.prototype.hideEmptyMapHoverTileMarker = function() {
        if (this.hoverTileMarker) this.hoverTileMarker.style.display = 'none';
    };

    EE.prototype.isPointOnCharacterOverlayName = function(sx, sy) {
        if (!this.charOverlayLayer || !this.charOverlayLayer.getBoundingClientRect) return false;
        if (this.charOverlayLayer.style && this.charOverlayLayer.style.display === 'none') return false;
        if (typeof document === 'undefined' || !document || typeof document.elementFromPoint !== 'function') return false;
        var x = Number(sx || 0);
        var y = Number(sy || 0);
        var n = null;
        try {
            n = document.elementFromPoint(x, y);
        } catch (_) {
            n = null;
        }
        while (n && n !== document && n !== window) {
            if (n === this.charOverlayLayer) return false;
            if (n.classList && n.classList.contains('ovnm')) return true;
            if (n.classList && n.classList.contains('ovit')) return false;
            n = n.parentNode;
        }
        return false;
    };

    EE.prototype.showEmptyMapHoverTileMarkerAt = function(mx, my) {
        if (!this.hoverTileMarker || !this.hoverTileMarkerLabel) return false;
        mx = this.tileMoveSnapCoord(Number(mx || 0));
        my = this.tileMoveSnapCoord(Number(my || 0));
        var mw = Number($dataMap && $dataMap.width || 0);
        var mh = Number($dataMap && $dataMap.height || 0);
        if (mw > 0) mx = Math.max(0, Math.min(Math.max(0, mw - 0.5), mx));
        if (mh > 0) my = Math.max(0, Math.min(Math.max(0, mh - 0.5), my));
        var sr = this.mapRectToScreen(mx, my, 0.5, 0.5);
        if (!sr) return false;
        this.hoverTileMarker.style.display = 'block';
        this.hoverTileMarker.style.left = Math.floor(Number(sr.x || 0)) + 'px';
        this.hoverTileMarker.style.top = Math.floor(Number(sr.y || 0)) + 'px';
        this.hoverTileMarker.style.width = Math.max(6, Math.floor(Number(sr.w || 0))) + 'px';
        this.hoverTileMarker.style.height = Math.max(6, Math.floor(Number(sr.h || 0))) + 'px';
        this.hoverTileMarkerLabel.textContent =
            '(' + this.tileMoveCoordText(mx) + ', ' + this.tileMoveCoordText(my) + ')';
        return true;
    };

    EE.prototype.updateEmptyMapHoverTileMarker = function() {
        if (!this.hoverTileMarker || !this.hoverTileMarkerLabel) return;
        if (this.dragMode === 'tile') {
            this.hideEmptyMapHoverTileMarker();
            return;
        }
        if (this.isRouteEditorMapPickerMode && this.isRouteEditorMapPickerMode()) {
            this.hideEmptyMapHoverTileMarker();
            return;
        }
        var charCtxOn = !!(this.charCtx && this.charCtx.classList && this.charCtx.classList.contains('on'));
        if (charCtxOn) {
            var fixedPoint = {
                x: Number(this.mapCreateCtxMapX),
                y: Number(this.mapCreateCtxMapY)
            };
            var canUseFixedPoint = true;
            if (typeof this.cameraContextMapPointIsValid === 'function') {
                canUseFixedPoint = this.cameraContextMapPointIsValid(fixedPoint);
            }
            if (!canUseFixedPoint || !this.showEmptyMapHoverTileMarkerAt(fixedPoint.x, fixedPoint.y)) {
                this.hideEmptyMapHoverTileMarker();
            }
            return;
        }
        var mapCreateCtxOn = !!(this.mapCreateCtx && this.mapCreateCtx.classList && this.mapCreateCtx.classList.contains('on'));
        if (mapCreateCtxOn) {
            var mapFixedPoint = {
                x: Number(this.mapCreateCtxMapX),
                y: Number(this.mapCreateCtxMapY)
            };
            var canUseMapFixedPoint = true;
            if (typeof this.cameraContextMapPointIsValid === 'function') {
                canUseMapFixedPoint = this.cameraContextMapPointIsValid(mapFixedPoint);
            }
            if (!canUseMapFixedPoint || !this.showEmptyMapHoverTileMarkerAt(mapFixedPoint.x, mapFixedPoint.y)) {
                this.hideEmptyMapHoverTileMarker();
            }
            return;
        }
        var sx = Number(this.lastPointerClientX || 0);
        var sy = Number(this.lastPointerClientY || 0);
        if (this.onUi(sx, sy) || !this.isPointInFixedViewportRect(sx, sy)) {
            this.hideEmptyMapHoverTileMarker();
            return;
        }
        if (this.isPointOnCharacterOverlayName(sx, sy)) {
            this.hideEmptyMapHoverTileMarker();
            return;
        }
        var cp = this.screenPointToCanvas(sx, sy);
        if (!cp) {
            this.hideEmptyMapHoverTileMarker();
            return;
        }
        var p = this.screenToMap(cp.x, cp.y, 'raw');
        if (!p) {
            this.hideEmptyMapHoverTileMarker();
            return;
        }
        if (!this.showEmptyMapHoverTileMarkerAt(Number(p.x || 0), Number(p.y || 0))) {
            this.hideEmptyMapHoverTileMarker();
        }
    };
    SH.registerModule('preview', ['command_schemas'], [
        'beginTileMove',
        'updateTileDrag'
    ]);
})();

