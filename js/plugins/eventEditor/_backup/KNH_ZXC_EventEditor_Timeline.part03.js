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

