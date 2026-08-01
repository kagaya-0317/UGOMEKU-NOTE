//=============================================================================
// KNH_ZXC_PopupPortrait.js
//=============================================================================

/*:
 * @plugindesc Character portraits for KNH popup message bubbles.
 * @author kagaya
 *
 * @help
 * Call before Show Text:
 *
 *   $gameMessage.setPopupPortrait({
 *       fileName: "Actor1",
 *       index: 0,
 *       side: "right",
 *       direction: 2,
 *       pattern: 1,
 *       offsetX: 0,
 *       offsetY: 0,
 *       viewWidth: 72,
 *       animation: { type: "yura" }
 *   });
 *
 * Pattern animation with a local wait:
 *
 *   $gameMessage.setPopupPortrait({
 *       fileName: "Actor1",
 *       animation: {
 *           type: "pattern",
 *           timing: "custom",
 *           wait: 6,
 *           sequence: [0, 1, 2, 1]
 *       }
 *   });
 *
 * Pattern animation synchronized with the global yurayura step:
 *
 *   $gameMessage.setPopupPortrait({
 *       fileName: "Actor1",
 *       animation: { type: "pattern", timing: "yura" }
 *   });
 *
 * Clear manually with:
 *
 *   $gameMessage.clearPopupPortrait();
 */

(function() {
    'use strict';

    var api = window.KNH_ZXC_PopupPortrait = window.KNH_ZXC_PopupPortrait || {};
    var bodyGeometryByBitmap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var bodyGeometrySerial = 0;

    var defaults = {
        index: 0,
        side: 'right',
        direction: 2,
        pattern: 1,
        offsetX: 0,
        offsetY: 0,
        viewWidth: 72,
        reserveWidth: null,
        textGap: 8,
        scale: 1,
        mirror: false,
        maskInset: 2,
        animation: {
            type: 'yura',
            timing: 'custom',
            wait: 10,
            sequence: [0, 1, 2, 1],
            phase: 0
        },
        yura: {
            blockSize: 20,
            maxShake: 15
        }
    };

    api.defaults = defaults;

    function finiteNumber(value, fallback) {
        var number = Number(value);
        return isFinite(number) ? number : fallback;
    }

    function positiveNumber(value, fallback) {
        var number = finiteNumber(value, fallback);
        return number > 0 ? number : fallback;
    }

    function clampInteger(value, min, max, fallback) {
        var number = Math.floor(finiteNumber(value, fallback));
        return Math.max(min, Math.min(max, number));
    }

    function cloneSequence(value, fallback) {
        var source = Array.isArray(value) && value.length ? value : fallback;
        var result = [];
        for (var i = 0; i < source.length; i++) {
            result.push(clampInteger(source[i], 0, 2, 1));
        }
        return result.length ? result : [1];
    }

    function normalizeDirection(value) {
        var direction = Math.floor(finiteNumber(value, defaults.direction));
        return [2, 4, 6, 8].indexOf(direction) >= 0 ? direction : defaults.direction;
    }

    function normalizeAnimation(value) {
        var source = typeof value === 'string' ? { type: value } : (value || {});
        var base = defaults.animation;
        var type = String(source.type == null ? base.type : source.type).toLowerCase();
        if (['yura', 'pattern', 'fixed'].indexOf(type) < 0) type = base.type;
        var timing = String(source.timing == null ? base.timing : source.timing).toLowerCase();
        if (timing !== 'yura') timing = 'custom';
        return {
            type: type,
            timing: timing,
            wait: Math.max(1, Math.floor(positiveNumber(source.wait, base.wait))),
            sequence: cloneSequence(source.sequence, base.sequence),
            phase: Math.floor(finiteNumber(source.phase, base.phase))
        };
    }

    function normalizeYura(value) {
        var source = value || {};
        var base = defaults.yura;
        return {
            blockSize: positiveNumber(source.blockSize, base.blockSize),
            maxShake: Math.max(0, finiteNumber(source.maxShake, base.maxShake))
        };
    }

    function normalizePortraitOptions(value) {
        var source = typeof value === 'string' ? { fileName: value } : (value || {});
        var fileName = String(source.fileName == null ? '' : source.fileName);
        fileName = fileName.replace(/\.png$/i, '');
        if (!fileName) return null;

        var side = String(source.side == null ? defaults.side : source.side).toLowerCase();
        if (side !== 'left') side = 'right';
        var viewWidth = positiveNumber(source.viewWidth, defaults.viewWidth);
        var textGap = Math.max(0, finiteNumber(source.textGap, defaults.textGap));
        var reserveWidth = source.reserveWidth == null
            ? viewWidth + textGap
            : Math.max(0, finiteNumber(source.reserveWidth, viewWidth + textGap));

        return {
            fileName: fileName,
            index: clampInteger(source.index, 0, 7, defaults.index),
            side: side,
            direction: normalizeDirection(source.direction),
            pattern: clampInteger(source.pattern, 0, 2, defaults.pattern),
            offsetX: finiteNumber(source.offsetX, defaults.offsetX),
            offsetY: finiteNumber(source.offsetY, defaults.offsetY),
            viewWidth: viewWidth,
            reserveWidth: reserveWidth,
            textGap: textGap,
            scale: positiveNumber(source.scale, defaults.scale),
            mirror: source.mirror == null ? !!defaults.mirror : !!source.mirror,
            maskInset: Math.max(0, finiteNumber(source.maskInset, defaults.maskInset)),
            animation: normalizeAnimation(source.animation),
            yura: normalizeYura(source.yura)
        };
    }

    api.normalize = normalizePortraitOptions;

    var _Game_Message_clear_PopupPortrait = Game_Message.prototype.clear;
    Game_Message.prototype.clear = function() {
        var revision = Math.floor(finiteNumber(this._popupPortraitRevision, 0)) + 1;
        _Game_Message_clear_PopupPortrait.apply(this, arguments);
        this._popupPortrait = null;
        this._popupPortraitRevision = revision;
    };

    Game_Message.prototype.setPopupPortrait = function(options) {
        var info = normalizePortraitOptions(options);
        if (!info) {
            this.clearPopupPortrait();
            return null;
        }
        this._popupPortrait = info;
        this._popupPortraitRevision = Math.floor(finiteNumber(this._popupPortraitRevision, 0)) + 1;
        return info;
    };

    Game_Message.prototype.clearPopupPortrait = function() {
        this._popupPortrait = null;
        this._popupPortraitRevision = Math.floor(finiteNumber(this._popupPortraitRevision, 0)) + 1;
    };

    Game_Message.prototype.popupPortrait = function() {
        return this._popupPortrait || null;
    };

    Game_Interpreter.prototype.setPopupPortrait = function(options) {
        return $gameMessage.setPopupPortrait(options);
    };

    Game_Interpreter.prototype.clearPopupPortrait = function() {
        $gameMessage.clearPopupPortrait();
    };

    function activePortraitInfo(windowMessage) {
        if (!$gameMessage || !$gameMessage._fukidashi) return null;
        if (!windowMessage || !windowMessage.isPopup || !windowMessage.isPopup()) return null;
        return $gameMessage.popupPortrait ? $gameMessage.popupPortrait() : null;
    }

    function portraitReserveWidth(info) {
        return info ? Math.max(0, finiteNumber(info.reserveWidth, 0)) : 0;
    }

    var _Window_Message_newLineX_PopupPortrait = Window_Message.prototype.newLineX;
    Window_Message.prototype.newLineX = function() {
        var x = _Window_Message_newLineX_PopupPortrait.apply(this, arguments);
        var info = activePortraitInfo(this);
        if (info && info.side === 'left') x += portraitReserveWidth(info);
        return x;
    };

    var _Window_Message_processVirtual_PopupPortrait = Window_Message.prototype.processVirtual;
    if (_Window_Message_processVirtual_PopupPortrait) {
        Window_Message.prototype.processVirtual = function() {
            _Window_Message_processVirtual_PopupPortrait.apply(this, arguments);
            var info = activePortraitInfo(this);
            if (!info || info.side !== 'right') return;
            var reserve = portraitReserveWidth(info);
            if (reserve <= 0) return;
            var previousWidth = this.width;
            this.width = Math.ceil(this.width + reserve);
            if (this.width !== previousWidth) this.createContents();
            this.resetFontSettings();
        };
    }

    var _Window_Base_fukidashiRender_PopupPortrait = Window_Base.prototype._fukidashiRender;
    if (_Window_Base_fukidashiRender_PopupPortrait) {
        Window_Base.prototype._fukidashiRender = function(bitmap, points, tailPoints, type, useLine) {
            if (bodyGeometryByBitmap && bitmap && Array.isArray(points) && points.length >= 3) {
                var copy = [];
                for (var i = 0; i < points.length; i++) {
                    copy.push({ x: Number(points[i].x), y: Number(points[i].y) });
                }
                bodyGeometryByBitmap.set(bitmap, {
                    id: ++bodyGeometrySerial,
                    points: copy,
                    type: type
                });
            }
            return _Window_Base_fukidashiRender_PopupPortrait.apply(this, arguments);
        };
    }

    Window_Message.prototype._popupPortraitGeometry = function() {
        if (!bodyGeometryByBitmap || !this._fukidashiSprite) return null;
        var sprite = this._fukidashiSprite;
        var bitmap = sprite._baseBitmap || sprite.bitmap;
        var stored = bitmap ? bodyGeometryByBitmap.get(bitmap) : null;
        if (!stored || !stored.points || stored.points.length < 3) return null;
        var anchorX = sprite.anchor ? sprite.anchor.x : 0;
        var anchorY = sprite.anchor ? sprite.anchor.y : 0;
        var scaleX = sprite.scale ? sprite.scale.x : 1;
        var scaleY = sprite.scale ? sprite.scale.y : 1;
        var result = [];
        for (var i = 0; i < stored.points.length; i++) {
            var point = stored.points[i];
            result.push({
                x: sprite.x + (point.x - bitmap.width * anchorX) * scaleX,
                y: sprite.y + (point.y - bitmap.height * anchorY) * scaleY
            });
        }
        return { id: stored.id, points: result };
    };

    Window_Message.prototype._ensurePopupPortraitObjects = function() {
        if (!this._popupPortraitLayer) {
            this._popupPortraitLayer = new PIXI.Container();
            this.addChild(this._popupPortraitLayer);
        }
        if (!this._popupPortraitMaskRoot) {
            this._popupPortraitMaskRoot = new PIXI.Container();
            this._popupPortraitMaskSprite = new Sprite();
            this._popupPortraitMaskSprite.renderable = false;
            this._popupPortraitMaskRoot.addChild(this._popupPortraitMaskSprite);
            this.addChild(this._popupPortraitMaskRoot);
            this._popupPortraitLayer.mask = this._popupPortraitMaskSprite;
        }
        this._sortPopupPortraitObjects();
    };

    Window_Message.prototype._sortPopupPortraitObjects = function() {
        var layer = this._popupPortraitLayer;
        var maskRoot = this._popupPortraitMaskRoot;
        if (!layer || !maskRoot || !this._windowSpriteContainer) return;
        var fukidashiIndex = this._fukidashiSprite ? this.children.indexOf(this._fukidashiSprite) : -1;
        var targetIndex = fukidashiIndex >= 0 ? fukidashiIndex + 1 : this.children.indexOf(this._windowSpriteContainer);
        targetIndex = Math.max(0, Math.min(targetIndex, this.children.length - 1));
        this.setChildIndex(layer, targetIndex);
        var windowIndex = this.children.indexOf(this._windowSpriteContainer);
        var maskIndex = Math.min(this.children.indexOf(layer) + 1, Math.max(0, windowIndex));
        this.setChildIndex(maskRoot, maskIndex);
    };

    Window_Message.prototype._removePopupPortraitSprite = function() {
        var sprite = this._popupPortraitSprite;
        if (!sprite) return;
        sprite._yuraInfo = null;
        if (sprite.parent) sprite.parent.removeChild(sprite);
        try {
            sprite.destroy({ children: true, texture: false, baseTexture: false });
        } catch (e) {
            if (sprite.destroy) sprite.destroy();
        }
        this._popupPortraitSprite = null;
    };

    Window_Message.prototype._hidePopupPortrait = function(removeSprite) {
        if (this._popupPortraitLayer) this._popupPortraitLayer.visible = false;
        if (this._popupPortraitMaskRoot) this._popupPortraitMaskRoot.visible = false;
        if (removeSprite) this._removePopupPortraitSprite();
        this._popupPortraitInfo = null;
        this._popupPortraitAppliedRevision = null;
        this._popupPortraitMaskKey = null;
        this._popupPortraitMaskGeometry = null;
        this._popupPortraitLastAnimationStep = null;
        this._popupPortraitLoadToken = Math.floor(finiteNumber(this._popupPortraitLoadToken, 0)) + 1;
    };

    Window_Message.prototype._setupPopupPortrait = function(info) {
        this._ensurePopupPortraitObjects();
        this._removePopupPortraitSprite();

        var sprite = this._popupPortraitSprite = new Sprite();
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 1;
        sprite.scale.x = info.scale * (info.mirror ? -1 : 1);
        sprite.scale.y = info.scale;
        sprite.bitmap = ImageManager.loadCharacter(info.fileName);
        this._popupPortraitLayer.addChild(sprite);

        this._popupPortraitInfo = info;
        this._popupPortraitAppliedRevision = $gameMessage._popupPortraitRevision;
        this._popupPortraitLastAnimationStep = null;
        this._popupPortraitMaskKey = null;
        this._popupPortraitMaskGeometry = this._popupPortraitGeometry();
        var token = this._popupPortraitLoadToken = Math.floor(finiteNumber(this._popupPortraitLoadToken, 0)) + 1;
        var windowMessage = this;
        sprite.bitmap.addLoadListener(function() {
            if (windowMessage._popupPortraitLoadToken !== token) return;
            if (windowMessage._popupPortraitSprite !== sprite) return;
            windowMessage._applyPopupPortraitPattern(info.pattern, true);
            windowMessage._updatePopupPortraitTransform();
        });
    };

    Window_Message.prototype._popupPortraitFrameSize = function() {
        var sprite = this._popupPortraitSprite;
        var info = this._popupPortraitInfo;
        var bitmap = sprite && sprite.bitmap;
        if (!sprite || !info || !bitmap || !bitmap.isReady || !bitmap.isReady()) return null;
        var big = ImageManager.isBigCharacter(info.fileName);
        var width = bitmap.width / (big ? 3 : 12);
        var height = bitmap.height / (big ? 4 : 8);
        if (width <= 0 || height <= 0) return null;
        return { width: width, height: height, big: big };
    };

    Window_Message.prototype._applyPopupPortraitPattern = function(pattern, force) {
        var sprite = this._popupPortraitSprite;
        var info = this._popupPortraitInfo;
        var size = this._popupPortraitFrameSize();
        if (!sprite || !info || !size) return;
        pattern = clampInteger(pattern, 0, 2, info.pattern);
        if (!force && this._popupPortraitCurrentPattern === pattern) return;

        var characterColumn = size.big ? 0 : (info.index % 4) * 3;
        var characterRow = size.big ? 0 : Math.floor(info.index / 4) * 4;
        var directionRow = (info.direction - 2) / 2;
        var sx = (characterColumn + pattern) * size.width;
        var sy = (characterRow + directionRow) * size.height;
        sprite.setFrame(sx, sy, size.width, size.height);
        sprite._lastFrame = null;
        sprite._baseBitmap = null;
        this._popupPortraitCurrentPattern = pattern;

        if (info.animation.type === 'yura') {
            sprite._yuraInfo = [
                info.yura.blockSize,
                info.yura.maxShake,
                $gameSystem && $gameSystem.animationWait ? $gameSystem.animationWait() : 10,
                false
            ];
            sprite._yuraUseOwnStep = false;
        } else {
            sprite._yuraInfo = null;
        }
        sprite.update();
    };

    Window_Message.prototype._popupPortraitAnalyticBottom = function(x, inset) {
        var bitmapWidth = this.width * 0.75;
        var bitmapHeight = this.height * 0.75;
        var baseWidth = Math.max(1, bitmapWidth * 0.8 - 16);
        var baseHeight = Math.max(1, bitmapHeight * 0.8 - 16);
        var shape = this._fukidashiShapeInfo
            ? this._fukidashiShapeInfo(baseWidth, baseHeight)
            : { a: baseWidth / 2, b: baseHeight / 2, n: 2 };
        var cx = this.width / 2;
        var cy = this.height / 2;
        var a = Math.max(1, shape.a * 2);
        var b = Math.max(1, shape.b * 2);
        var n = Math.max(2, finiteNumber(shape.n, 2));
        var nx = Math.abs((x - cx) / a);
        if (nx >= 1) return cy - inset;
        var power = Math.max(0, 1 - Math.pow(nx, n));
        return cy + b * Math.pow(power, 1 / n) - inset;
    };

    Window_Message.prototype._popupPortraitGeometryBottom = function(points, x) {
        if (!points || points.length < 3) return null;
        var bottom = null;
        for (var i = 0; i < points.length; i++) {
            var a = points[i];
            var b = points[(i + 1) % points.length];
            var minX = Math.min(a.x, b.x);
            var maxX = Math.max(a.x, b.x);
            if (x < minX || x > maxX) continue;
            var dx = b.x - a.x;
            if (Math.abs(dx) < 0.0001) {
                if (Math.abs(x - a.x) < 0.5) bottom = Math.max(bottom == null ? -Infinity : bottom, a.y, b.y);
                continue;
            }
            var rate = (x - a.x) / dx;
            if (rate < 0 || rate > 1) continue;
            var y = a.y + (b.y - a.y) * rate;
            if (bottom == null || y > bottom) bottom = y;
        }
        return bottom;
    };

    Window_Message.prototype._popupPortraitSlot = function(info) {
        var faceInset = info.side === 'left' && $gameMessage.faceName()
            ? Window_Message._faceWidth + 8
            : 0;
        var x = info.side === 'left'
            ? this.padding + faceInset
            : this.width - this.padding - info.viewWidth;
        return { x: x, width: info.viewWidth, centerX: x + info.viewWidth / 2 };
    };

    Window_Message.prototype._refreshPopupPortraitMask = function(force) {
        var info = this._popupPortraitInfo;
        var maskSprite = this._popupPortraitMaskSprite;
        if (!info || !maskSprite) return;
        var slot = this._popupPortraitSlot(info);
        var geometry = this._popupPortraitMaskGeometry;
        if (!geometry) {
            geometry = this._popupPortraitGeometry();
            this._popupPortraitMaskGeometry = geometry;
        }
        var geometryId = geometry ? geometry.id : 0;
        var topMargin = Math.ceil(Graphics.boxHeight || Graphics.height || 624);
        var key = [
            this.width, this.height, this.padding, info.side, info.viewWidth,
            info.maskInset, geometryId, topMargin
        ].join(':');
        if (!force && this._popupPortraitMaskKey === key) return;

        var bitmapWidth = Math.max(1, Math.ceil(this.width));
        var bitmapHeight = Math.max(1, topMargin + Math.ceil(this.height * 1.25));
        var maskBitmap = new Bitmap(bitmapWidth, bitmapHeight);
        var context = maskBitmap._context;
        context.save();
        context.imageSmoothingEnabled = false;
        context.fillStyle = 'white';
        context.beginPath();

        var x0 = Math.max(0, slot.x);
        var x1 = Math.min(this.width, slot.x + slot.width);
        var centerY = this.height / 2;
        context.moveTo(x0, 0);
        context.lineTo(x1, 0);
        context.lineTo(x1, topMargin + centerY);

        var points = geometry ? geometry.points : null;
        for (var x = x1; x >= x0; x -= 2) {
            var analyticBottom = this._popupPortraitAnalyticBottom(x, info.maskInset);
            var geometryBottom = this._popupPortraitGeometryBottom(points, x);
            var bottom = geometryBottom == null
                ? analyticBottom
                : Math.min(geometryBottom - info.maskInset, analyticBottom + 12);
            context.lineTo(x, topMargin + bottom);
        }
        context.lineTo(x0, topMargin + centerY);
        context.closePath();
        context.fill();
        context.restore();
        maskBitmap._setDirty();
        if (typeof maskBitmap.checkDirty === 'function') maskBitmap.checkDirty();

        maskSprite.bitmap = maskBitmap;
        maskSprite.x = 0;
        maskSprite.y = -topMargin;
        maskSprite.renderable = false;
        this._popupPortraitMaskKey = key;
        this._popupPortraitSlotInfo = slot;
    };

    Window_Message.prototype._updatePopupPortraitTransform = function() {
        var info = this._popupPortraitInfo;
        var sprite = this._popupPortraitSprite;
        var layer = this._popupPortraitLayer;
        var maskRoot = this._popupPortraitMaskRoot;
        if (!info || !sprite || !layer || !maskRoot) return;

        var slot = this._popupPortraitSlotInfo || this._popupPortraitSlot(info);
        var geometry = this._popupPortraitMaskGeometry;
        var bottom = this._popupPortraitGeometryBottom(geometry ? geometry.points : null, slot.centerX);
        if (bottom == null) bottom = this._popupPortraitAnalyticBottom(slot.centerX, info.maskInset);
        sprite.x = slot.centerX + info.offsetX;
        sprite.y = bottom + info.offsetY;

        var centerX = this.width / 2;
        var centerY = this.height / 2;
        layer.pivot.x = centerX;
        layer.pivot.y = centerY;
        layer.position.x = centerX;
        layer.position.y = centerY;
        maskRoot.pivot.x = centerX;
        maskRoot.pivot.y = centerY;
        maskRoot.position.x = centerX;
        maskRoot.position.y = centerY;

        var openScale = this._fukidashiSprite && this._fukidashiSprite.scale
            ? this._fukidashiSprite.scale.x / 2
            : (this.isOpen() ? 1 : 0.75);
        layer.scale.x = layer.scale.y = openScale;
        maskRoot.scale.x = maskRoot.scale.y = openScale;
        layer.visible = this.openness > 0;
        maskRoot.visible = this.openness > 0;
        this._sortPopupPortraitObjects();
    };

    Window_Message.prototype._updatePopupPortraitAnimation = function() {
        var info = this._popupPortraitInfo;
        var sprite = this._popupPortraitSprite;
        if (!info || !sprite) return;
        var animation = info.animation;
        if (animation.type !== 'pattern') {
            this._applyPopupPortraitPattern(info.pattern, false);
            if (animation.type === 'yura') sprite.update();
            return;
        }

        var step;
        if (animation.timing === 'yura') {
            if ($gameSwitches && $gameSwitches.value(1)) return;
            var wait = Math.max(1, Number($gameSystem && $gameSystem.animationWait
                ? $gameSystem.animationWait()
                : animation.wait));
            var count = $gameSystem && $gameSystem.sceneCount
                ? $gameSystem.sceneCount()
                : Graphics.frameCount;
            step = Math.floor(count / wait);
        } else {
            var startFrame = finiteNumber(this._popupPortraitStartedFrame, Graphics.frameCount);
            step = Math.floor(Math.max(0, Graphics.frameCount - startFrame) / animation.wait);
        }
        step += animation.phase;
        if (this._popupPortraitLastAnimationStep === step) return;
        this._popupPortraitLastAnimationStep = step;
        var length = animation.sequence.length;
        var sequenceIndex = ((step % length) + length) % length;
        this._applyPopupPortraitPattern(animation.sequence[sequenceIndex], false);
    };

    Window_Message.prototype.refreshPopupPortrait = function(force) {
        var info = activePortraitInfo(this);
        if (!info || !this._fukidashiSprite) {
            this._hidePopupPortrait(false);
            return;
        }
        var revision = $gameMessage._popupPortraitRevision;
        if (force || this._popupPortraitAppliedRevision !== revision || !this._popupPortraitSprite) {
            this._setupPopupPortrait(info);
        }
        this._refreshPopupPortraitMask(force);
        this._updatePopupPortraitTransform();
    };

    Window_Message.prototype.updatePopupPortrait = function() {
        var info = activePortraitInfo(this);
        if (!info || !this._fukidashiSprite) {
            if (this._popupPortraitLayer) this._hidePopupPortrait(false);
            return;
        }
        if (this._popupPortraitAppliedRevision !== $gameMessage._popupPortraitRevision || !this._popupPortraitSprite) {
            this.refreshPopupPortrait(true);
        }
        this._updatePopupPortraitAnimation();
        this._refreshPopupPortraitMask(false);
        this._updatePopupPortraitTransform();
    };

    var _Window_Message_startMessage_PopupPortrait = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function() {
        this._popupPortraitStartedFrame = Graphics.frameCount;
        this._popupPortraitLastAnimationStep = null;
        _Window_Message_startMessage_PopupPortrait.apply(this, arguments);
        this.refreshPopupPortrait(false);
    };

    var _Window_Message_setFukidashi_PopupPortrait = Window_Message.prototype.setFukidashi;
    Window_Message.prototype.setFukidashi = function() {
        var result = _Window_Message_setFukidashi_PopupPortrait.apply(this, arguments);
        if (this instanceof Window_Message) this.refreshPopupPortrait(false);
        return result;
    };

    var _Window_Message_updateBackground_PopupPortrait = Window_Message.prototype.updateBackground;
    Window_Message.prototype.updateBackground = function() {
        var result = _Window_Message_updateBackground_PopupPortrait.apply(this, arguments);
        if (!(this instanceof Window_Message)) return result;
        if (this._fukidashiSprite) this.refreshPopupPortrait(false);
        else this._hidePopupPortrait(false);
        return result;
    };

    var _Window_Message_update_PopupPortrait = Window_Message.prototype.update;
    Window_Message.prototype.update = function() {
        _Window_Message_update_PopupPortrait.apply(this, arguments);
        this.updatePopupPortrait();
    };

    var _Window_Message_terminateMessage_PopupPortrait = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function() {
        this._hidePopupPortrait(true);
        _Window_Message_terminateMessage_PopupPortrait.apply(this, arguments);
    };

})();
