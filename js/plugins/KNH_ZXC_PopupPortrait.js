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
 *       viewWidth: 72, // Text reservation width; does not crop the portrait.
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
 *
 * viewWidth controls only the space reserved between the text and portrait.
 * The portrait itself is not cropped to viewWidth. Set reserveWidth only when
 * an exact total reservation is required instead of viewWidth + textGap.
 */

(function() {
    'use strict';

    var api = window.KNH_ZXC_PopupPortrait = window.KNH_ZXC_PopupPortrait || {};
    var bodyGeometryByBitmap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var bodyGeometrySerial = 0;
    var bodyGeometryScratchCanvas = null;
    var MASK_CACHE_LIMIT = 12;
    var GEOMETRY_CACHE_LIMIT = 16;

    function BoundedCache(limit) {
        this._limit = Math.max(1, Math.floor(Number(limit || 1)));
        this._map = Object.create(null);
        this._order = [];
    }

    BoundedCache.prototype.get = function(key) {
        if (!Object.prototype.hasOwnProperty.call(this._map, key)) return null;
        var index = this._order.indexOf(key);
        if (index >= 0 && index !== this._order.length - 1) {
            this._order.splice(index, 1);
            this._order.push(key);
        }
        return this._map[key];
    };

    BoundedCache.prototype.set = function(key, value) {
        if (Object.prototype.hasOwnProperty.call(this._map, key)) {
            this._map[key] = value;
            this.get(key);
            return value;
        }
        this._map[key] = value;
        this._order.push(key);
        while (this._order.length > this._limit) {
            delete this._map[this._order.shift()];
        }
        return value;
    };

    // Configuration and pure value helpers.
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

    function characterFrameRect(bitmap, fileName, index, direction, pattern) {
        if (!bitmap || !bitmap.isReady || !bitmap.isReady()) return null;
        var big = ImageManager.isBigCharacter(String(fileName || ''));
        var width = Number(bitmap.width || 0) / (big ? 3 : 12);
        var height = Number(bitmap.height || 0) / (big ? 4 : 8);
        if (width <= 0 || height <= 0) return null;
        index = clampInteger(index, 0, 7, defaults.index);
        direction = normalizeDirection(direction);
        pattern = clampInteger(pattern, 0, 2, defaults.pattern);
        var column = big ? 0 : (index % 4) * 3;
        var row = big ? 0 : Math.floor(index / 4) * 4;
        return {
            x: (column + pattern) * width,
            y: (row + (direction - 2) / 2) * height,
            width: width,
            height: height,
            big: big
        };
    }

    api.characterFrameRect = characterFrameRect;

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
            ? null
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

    function nextPopupPortraitRevision(message) {
        return Math.floor(finiteNumber(message && message._popupPortraitRevision, 0)) + 1;
    }

    function touchPopupPortrait(message) {
        message._popupPortraitRevision = nextPopupPortraitRevision(message);
    }

    // Public message/interpreter API.
    var _Game_Message_clear_PopupPortrait = Game_Message.prototype.clear;
    Game_Message.prototype.clear = function() {
        var revision = nextPopupPortraitRevision(this);
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
        touchPopupPortrait(this);
        return info;
    };

    Game_Message.prototype.clearPopupPortrait = function() {
        this._popupPortrait = null;
        touchPopupPortrait(this);
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

    function hasPopupPortraitDisplay(windowMessage) {
        return !!(windowMessage && (
            windowMessage._popupPortraitInfo ||
            (windowMessage._popupPortraitLayer && windowMessage._popupPortraitLayer.visible) ||
            (windowMessage._popupPortraitMaskRoot && windowMessage._popupPortraitMaskRoot.visible)
        ));
    }

    function portraitReserveWidth(info) {
        if (!info) return 0;
        if (info.reserveWidth != null) return Math.max(0, finiteNumber(info.reserveWidth, 0));
        return Math.max(0, finiteNumber(info.viewWidth, 0)) + info.textGap;
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

    // Bubble body geometry capture. This intentionally excludes the tail.
    function traceFukidashiBodyPath(context, points, type, useLine) {
        if (!context || !Array.isArray(points) || points.length < 3) return false;
        var quad = function(a, b) {
            context.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        };
        var quadTo = function(a, b) {
            context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2, b.x, b.y);
        };
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        if (type === 2 && points.length >= 3 && !useLine) {
            if (points[0] && points[0].peak === false) {
                for (var i = 1; i < points.length; i++) {
                    var point = points[i];
                    if (point.peak) {
                        context.lineTo(point.x, point.y);
                    } else if (i + 1 < points.length) {
                        var nextPeak = points[i + 1];
                        context.quadraticCurveTo(point.x, point.y, nextPeak.x, nextPeak.y);
                        i++;
                    } else {
                        context.lineTo(point.x, point.y);
                    }
                }
            } else {
                for (var j = 1; j < points.length - 1; j += 2) {
                    context.quadraticCurveTo(
                        points[j].x,
                        points[j].y,
                        points[j + 1].x,
                        points[j + 1].y
                    );
                }
            }
        } else {
            for (var k = 1; k < points.length; k++) {
                if (useLine) context.lineTo(points[k].x, points[k].y);
                else if (type === 2) {
                    if (k % 2) context.lineTo(points[k].x, points[k].y);
                    else quadTo(points[k - 1], points[k]);
                } else {
                    quad(points[k - 1], points[k]);
                }
            }
        }
        quad(points[points.length - 1], points[0]);
        context.closePath();
        return true;
    }

    function bodyGeometryScratchContext(width, height) {
        if (typeof document === 'undefined' || !document.createElement) return null;
        if (!bodyGeometryScratchCanvas) bodyGeometryScratchCanvas = document.createElement('canvas');
        if (bodyGeometryScratchCanvas.width !== width) bodyGeometryScratchCanvas.width = width;
        if (bodyGeometryScratchCanvas.height !== height) bodyGeometryScratchCanvas.height = height;
        var context = bodyGeometryScratchCanvas.getContext('2d');
        if (!context) return null;
        context.clearRect(0, 0, width, height);
        return context;
    }

    function captureFukidashiBodyGeometry(bitmap, points, type, useLine) {
        if (!bitmap || !Array.isArray(points) || points.length < 3) return null;
        var width = Math.max(1, Math.ceil(Number(bitmap.width || 0)));
        var height = Math.max(1, Math.ceil(Number(bitmap.height || 0)));
        if (width <= 1 || height <= 1) return null;
        var context = bodyGeometryScratchContext(width, height);
        if (!context) return null;
        context.save();
        context.imageSmoothingEnabled = false;
        context.fillStyle = 'white';
        if (!traceFukidashiBodyPath(context, points, type, useLine)) {
            context.restore();
            return null;
        }
        context.fill();
        context.restore();

        var pixels = context.getImageData(0, 0, width, height).data;
        var boundary = new Array(width);
        var minX = width;
        var maxX = -1;
        var signatureHash = 2166136261;
        for (var x = 0; x < width; x++) {
            var bottom = -1;
            for (var y = height - 1; y >= 0; y--) {
                if (pixels[(y * width + x) * 4 + 3] > 0) {
                    bottom = y;
                    break;
                }
            }
            boundary[x] = bottom;
            signatureHash ^= (bottom + 2) & 0xffff;
            signatureHash = Math.imul(signatureHash, 16777619) >>> 0;
            if (bottom >= 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
            }
        }
        if (maxX < minX) return null;
        var copy = [];
        for (var i = 0; i < points.length; i++) {
            var pointX = Number(points[i].x);
            var pointY = Number(points[i].y);
            copy.push({
                x: pointX,
                y: pointY,
                peak: points[i].peak
            });
            signatureHash ^= Math.round(pointX * 100) >>> 0;
            signatureHash = Math.imul(signatureHash, 16777619) >>> 0;
            signatureHash ^= Math.round(pointY * 100) >>> 0;
            signatureHash = Math.imul(signatureHash, 16777619) >>> 0;
            signatureHash ^= points[i].peak === false ? 2 : (points[i].peak ? 1 : 0);
            signatureHash = Math.imul(signatureHash, 16777619) >>> 0;
        }
        return {
            id: ++bodyGeometrySerial,
            points: copy,
            boundary: boundary,
            minX: minX,
            maxX: maxX,
            bitmapWidth: width,
            bitmapHeight: height,
            signature: width + 'x' + height + ':' + signatureHash,
            type: type
        };
    }

    function shouldCapturePopupPortraitGeometry(windowBase) {
        if (!(windowBase instanceof Window_Message)) return false;
        if (!$gameMessage || !$gameMessage._fukidashi) return false;
        return !!($gameMessage.popupPortrait && $gameMessage.popupPortrait());
    }

    var _Window_Base_fukidashiRender_PopupPortrait = Window_Base.prototype._fukidashiRender;
    if (_Window_Base_fukidashiRender_PopupPortrait) {
        Window_Base.prototype._fukidashiRender = function(bitmap, points, tailPoints, type, useLine) {
            var result = _Window_Base_fukidashiRender_PopupPortrait.apply(this, arguments);
            if (bodyGeometryByBitmap && bitmap && shouldCapturePopupPortraitGeometry(this)) {
                var geometry = captureFukidashiBodyGeometry(bitmap, points, type, useLine);
                if (geometry) bodyGeometryByBitmap.set(bitmap, geometry);
            }
            return result;
        };
    }

    Window_Message.prototype._popupPortraitWarpPoint = function(sprite, bitmap, sourceX, sourceY, useMesh) {
        if (!sprite || !bitmap) return null;
        useMesh = useMesh !== false;
        var anchorX = sprite.anchor ? sprite.anchor.x : 0;
        var anchorY = sprite.anchor ? sprite.anchor.y : 0;
        var localX = sourceX - bitmap.width * anchorX;
        var localY = sourceY - bitmap.height * anchorY;
        var mesh = useMesh ? sprite._meshSprite : null;
        var vertices = mesh && mesh.visible ? mesh.vertices : null;
        var cols = mesh ? Math.max(1, Math.floor(Number(mesh._cols || 1))) : 0;
        var rows = mesh ? Math.max(1, Math.floor(Number(mesh._rows || 1))) : 0;
        if (vertices && vertices.length >= (cols + 1) * (rows + 1) * 2) {
            var gx = Math.max(0, Math.min(cols, sourceX / Math.max(1, bitmap.width) * cols));
            var gy = Math.max(0, Math.min(rows, sourceY / Math.max(1, bitmap.height) * rows));
            var ix = Math.min(cols - 1, Math.floor(gx));
            var iy = Math.min(rows - 1, Math.floor(gy));
            var tx = gx - ix;
            var ty = gy - iy;
            var stride = cols + 1;
            var i00 = (iy * stride + ix) * 2;
            var i10 = i00 + 2;
            var i01 = ((iy + 1) * stride + ix) * 2;
            var i11 = i01 + 2;
            var topX = vertices[i00] + (vertices[i10] - vertices[i00]) * tx;
            var topY = vertices[i00 + 1] + (vertices[i10 + 1] - vertices[i00 + 1]) * tx;
            var bottomX = vertices[i01] + (vertices[i11] - vertices[i01]) * tx;
            var bottomY = vertices[i01 + 1] + (vertices[i11 + 1] - vertices[i01 + 1]) * tx;
            localX = Number(mesh.x || 0) + topX + (bottomX - topX) * ty;
            localY = Number(mesh.y || 0) + topY + (bottomY - topY) * ty;
        }
        var liveScaleX = sprite.scale ? Number(sprite.scale.x || 0) : 1;
        var liveScaleY = sprite.scale ? Number(sprite.scale.y || 0) : 1;
        var openScale = Math.max(0.0001, Math.abs(liveScaleX) / 2);
        var scaleX = liveScaleX / openScale;
        var scaleY = liveScaleY / openScale;
        return {
            x: sprite.x + localX * scaleX,
            y: sprite.y + localY * scaleY
        };
    };

    Window_Message.prototype._popupPortraitGeometrySource = function(useMesh) {
        if (!bodyGeometryByBitmap || !this._fukidashiSprite) return null;
        useMesh = useMesh !== false;
        var sprite = this._fukidashiSprite;
        var bitmap = sprite._baseBitmap || sprite.bitmap;
        var stored = bitmap ? bodyGeometryByBitmap.get(bitmap) : null;
        if (!stored || !stored.boundary || stored.maxX < stored.minX) return null;
        var mesh = useMesh ? sprite._meshSprite : null;
        var meshPattern = -1;
        if (mesh && Array.isArray(mesh._distortPatterns)) {
            meshPattern = mesh._distortPatterns.indexOf(mesh._lastPattern);
        }
        var liveScaleX = sprite.scale ? Number(sprite.scale.x || 0) : 1;
        var liveScaleY = sprite.scale ? Number(sprite.scale.y || 0) : 1;
        var openScale = Math.max(0.0001, Math.abs(liveScaleX) / 2);
        var key = [
            useMesh ? 'mesh' : 'base', stored.signature,
            Number(sprite.x || 0), Number(sprite.y || 0),
            liveScaleX / openScale, liveScaleY / openScale,
            Number(bitmap.width || 0), Number(bitmap.height || 0),
            meshPattern,
            mesh && meshPattern < 0 ? Number(mesh._lastMeshStep == null ? -1 : mesh._lastMeshStep) : -1,
            mesh && meshPattern < 0 && mesh._meshDirty ? 1 : 0,
            mesh ? Number(mesh.x || 0) : 0,
            mesh ? Number(mesh.y || 0) : 0
        ].join(':');
        return {
            key: key,
            sprite: sprite,
            bitmap: bitmap,
            stored: stored,
            mesh: mesh,
            meshPattern: meshPattern
        };
    };

    Window_Message.prototype._popupPortraitGeometry = function(useMesh, source) {
        useMesh = useMesh !== false;
        source = source || this._popupPortraitGeometrySource(useMesh);
        if (!source) return null;
        var cache = this._popupPortraitGeometryCache;
        if (!cache) cache = this._popupPortraitGeometryCache = new BoundedCache(GEOMETRY_CACHE_LIMIT);
        var cached = cache.get(source.key);
        if (cached) return cached;
        var sprite = source.sprite;
        var bitmap = source.bitmap;
        var stored = source.stored;
        var boundary = [];
        var sampleStep = 1;
        for (var sourceX = stored.minX; sourceX <= stored.maxX; sourceX += sampleStep) {
            var sourceY = Number(stored.boundary[sourceX]);
            if (sourceY < 0) continue;
            var warped = this._popupPortraitWarpPoint(sprite, bitmap, sourceX, sourceY, useMesh);
            if (warped) boundary.push(warped);
        }
        if (boundary.length < 2) return null;
        var minX = Infinity;
        var maxX = -Infinity;
        for (var i = 0; i < stored.points.length; i++) {
            var point = stored.points[i];
            var edgePoint = this._popupPortraitWarpPoint(sprite, bitmap, point.x, point.y, useMesh);
            if (!edgePoint) continue;
            minX = Math.min(minX, edgePoint.x);
            maxX = Math.max(maxX, edgePoint.x);
        }
        for (i = 0; i < boundary.length; i++) {
            minX = Math.min(minX, boundary[i].x);
            maxX = Math.max(maxX, boundary[i].x);
        }
        var mesh = source.mesh;
        var result = {
            id: stored.id,
            signature: stored.signature || String(stored.id),
            sourceKey: source.key,
            meshStep: mesh ? Number(mesh._lastMeshStep == null ? -1 : mesh._lastMeshStep) : -1,
            meshPattern: source.meshPattern,
            boundary: boundary,
            minX: isFinite(minX) ? minX : 0,
            maxX: isFinite(maxX) ? maxX : this.width
        };
        cache.set(source.key, result);
        return result;
    };

    // Portrait display object lifecycle.
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
        this._popupPortraitPlacementGeometry = null;
        this._popupPortraitPlacementDirty = true;
        this._popupPortraitPresentationKey = null;
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
        this._popupPortraitPlacementDirty = true;
        this._popupPortraitPresentationKey = null;
        // Mask geometry follows redraw/yurayura. Placement geometry is a stable,
        // non-mesh snapshot so outline animation never drags the portrait.
        if (!this._popupPortraitPlacementGeometry) {
            this._popupPortraitPlacementGeometry = this._popupPortraitGeometry(false);
        }
        var token = this._popupPortraitLoadToken = Math.floor(finiteNumber(this._popupPortraitLoadToken, 0)) + 1;
        var windowMessage = this;
        sprite.bitmap.addLoadListener(function() {
            if (windowMessage._popupPortraitLoadToken !== token) return;
            if (windowMessage._popupPortraitSprite !== sprite) return;
            windowMessage._applyPopupPortraitPattern(info.pattern, true);
            windowMessage._popupPortraitPlacementDirty = true;
            windowMessage._updatePopupPortraitTransform(true);
        });
    };

    Window_Message.prototype._popupPortraitFrameRect = function(pattern) {
        var sprite = this._popupPortraitSprite;
        var info = this._popupPortraitInfo;
        var bitmap = sprite && sprite.bitmap;
        if (!sprite || !info || !bitmap) return null;
        return characterFrameRect(bitmap, info.fileName, info.index, info.direction, pattern);
    };

    Window_Message.prototype._applyPopupPortraitPattern = function(pattern, force) {
        var sprite = this._popupPortraitSprite;
        var info = this._popupPortraitInfo;
        if (!sprite || !info) return;
        pattern = clampInteger(pattern, 0, 2, info.pattern);
        if (!force && this._popupPortraitCurrentPattern === pattern) return;
        var frame = this._popupPortraitFrameRect(pattern);
        if (!frame) return;
        sprite.setFrame(frame.x, frame.y, frame.width, frame.height);
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

    // Stable placement and dynamic mask rendering.
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
        if (!points || points.length < 2) return null;
        var bottom = null;
        for (var i = 0; i < points.length - 1; i++) {
            var a = points[i];
            var b = points[i + 1];
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

    Window_Message.prototype._popupPortraitSlot = function(info, geometry) {
        var frame = this._popupPortraitFrameRect(info.pattern);
        var frameWidth = frame ? frame.width * Math.abs(info.scale) : info.viewWidth;
        if (!isFinite(frameWidth) || frameWidth <= 0) frameWidth = info.viewWidth;
        var faceInset = info.side === 'left' && $gameMessage.faceName() ? Window_Message._faceWidth + 8 : 0;
        var left = geometry ? geometry.minX + info.maskInset : this.padding + faceInset;
        var right = geometry ? geometry.maxX - info.maskInset : this.width - this.padding;
        if (info.side === 'left') left = Math.max(left, this.padding + faceInset);
        var centerX = info.side === 'left' ? left + frameWidth / 2 : right - frameWidth / 2;
        return {
            x: centerX - frameWidth / 2,
            width: frameWidth,
            centerX: centerX,
            clipMinX: geometry ? geometry.minX + info.maskInset : 0,
            clipMaxX: geometry ? geometry.maxX - info.maskInset : this.width
        };
    };

    function popupPortraitMaskKey(windowMessage, info, geometryKey, topMargin) {
        return [
            windowMessage.width, windowMessage.height, windowMessage.padding, info.side,
            info.maskInset, geometryKey, topMargin
        ].join(':');
    }

    function createPopupPortraitMaskBitmap(windowMessage, info, geometry, topMargin) {
        var slot = windowMessage._popupPortraitSlot(info, geometry);
        var bitmapWidth = Math.max(1, Math.ceil(windowMessage.width));
        var bitmapHeight = Math.max(1, topMargin + Math.ceil(windowMessage.height * 1.25));
        var bitmap = new Bitmap(bitmapWidth, bitmapHeight);
        var context = bitmap._context;
        context.save();
        context.imageSmoothingEnabled = false;
        context.fillStyle = 'white';
        context.beginPath();

        var x0 = Math.max(0, slot.clipMinX);
        var x1 = Math.min(windowMessage.width, slot.clipMaxX);
        context.moveTo(x0, 0);
        context.lineTo(x1, 0);
        var boundary = geometry ? geometry.boundary : null;
        if (boundary && boundary.length >= 2) {
            for (var i = boundary.length - 1; i >= 0; i--) {
                context.lineTo(boundary[i].x, topMargin + boundary[i].y - info.maskInset);
            }
        } else {
            for (var x = x1; x >= x0; x -= 2) {
                context.lineTo(x, topMargin + windowMessage._popupPortraitAnalyticBottom(x, info.maskInset));
            }
        }
        context.closePath();
        context.fill();
        context.restore();
        bitmap._setDirty();
        if (typeof bitmap.checkDirty === 'function') bitmap.checkDirty();
        return bitmap;
    }

    function applyPopupPortraitMaskBitmap(maskSprite, bitmap, topMargin) {
        maskSprite.bitmap = bitmap;
        maskSprite.x = 0;
        maskSprite.y = -topMargin;
        maskSprite.renderable = false;
    }

    Window_Message.prototype._refreshPopupPortraitMask = function(force) {
        var info = this._popupPortraitInfo;
        var maskSprite = this._popupPortraitMaskSprite;
        if (!info || !maskSprite) return;
        var source = this._popupPortraitGeometrySource(true);
        var geometryKey = source ? source.key : 'fallback';
        var topMargin = Math.ceil(Graphics.boxHeight || Graphics.height || 624);
        var key = popupPortraitMaskKey(this, info, geometryKey, topMargin);
        if (!force && this._popupPortraitMaskKey === key) return;

        var maskCache = this._popupPortraitMaskCache;
        if (!maskCache) maskCache = this._popupPortraitMaskCache = new BoundedCache(MASK_CACHE_LIMIT);
        var cachedBitmap = maskCache.get(key);
        if (cachedBitmap) {
            applyPopupPortraitMaskBitmap(maskSprite, cachedBitmap, topMargin);
            this._popupPortraitMaskKey = key;
            return;
        }

        var geometry = this._popupPortraitGeometry(true, source);
        var maskBitmap = createPopupPortraitMaskBitmap(this, info, geometry, topMargin);
        maskCache.set(key, maskBitmap);
        applyPopupPortraitMaskBitmap(maskSprite, maskBitmap, topMargin);
        this._popupPortraitMaskKey = key;
    };

    Window_Message.prototype._updatePopupPortraitTransform = function(force) {
        var info = this._popupPortraitInfo;
        var sprite = this._popupPortraitSprite;
        var layer = this._popupPortraitLayer;
        var maskRoot = this._popupPortraitMaskRoot;
        if (!info || !sprite || !layer || !maskRoot) return;

        var geometry = this._popupPortraitPlacementGeometry;
        if (!geometry) {
            geometry = this._popupPortraitGeometry(false);
            this._popupPortraitPlacementGeometry = geometry;
        }
        if (force || this._popupPortraitPlacementDirty) {
            var slot = this._popupPortraitSlot(info, geometry);
            var portraitX = slot.centerX + info.offsetX;
            var bottom = this._popupPortraitGeometryBottom(geometry ? geometry.boundary : null, portraitX);
            if (bottom == null) bottom = this._popupPortraitAnalyticBottom(slot.centerX, info.maskInset);
            sprite.x = portraitX;
            sprite.y = bottom + info.offsetY;
            this._popupPortraitPlacementDirty = false;
        }

        var centerX = this.width / 2;
        var centerY = this.height / 2;
        var openScale = this._fukidashiSprite && this._fukidashiSprite.scale
            ? this._fukidashiSprite.scale.x / 2
            : (this.isOpen() ? 1 : 0.75);
        var visible = this.openness > 0;
        var presentationKey = [centerX, centerY, openScale, visible ? 1 : 0].join(':');
        if (force || this._popupPortraitPresentationKey !== presentationKey) {
            layer.pivot.x = centerX;
            layer.pivot.y = centerY;
            layer.position.x = centerX;
            layer.position.y = centerY;
            maskRoot.pivot.x = centerX;
            maskRoot.pivot.y = centerY;
            maskRoot.position.x = centerX;
            maskRoot.position.y = centerY;
            layer.scale.x = layer.scale.y = openScale;
            maskRoot.scale.x = maskRoot.scale.y = openScale;
            layer.visible = visible;
            maskRoot.visible = visible;
            this._popupPortraitPresentationKey = presentationKey;
        }
    };

    // Pattern/yurayura animation and Window_Message hooks.
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
            if (hasPopupPortraitDisplay(this)) this._hidePopupPortrait(false);
            return;
        }
        var revision = $gameMessage._popupPortraitRevision;
        if (force || this._popupPortraitAppliedRevision !== revision || !this._popupPortraitSprite) {
            this._setupPopupPortrait(info);
        }
        if (!this._popupPortraitPlacementGeometry) {
            this._popupPortraitPlacementGeometry = this._popupPortraitGeometry(false);
        }
        this._refreshPopupPortraitMask(force);
        this._updatePopupPortraitTransform(force);
    };

    Window_Message.prototype.updatePopupPortrait = function() {
        var info = activePortraitInfo(this);
        if (!info || !this._fukidashiSprite) {
            if (hasPopupPortraitDisplay(this)) this._hidePopupPortrait(false);
            return;
        }
        if (this._popupPortraitAppliedRevision !== $gameMessage._popupPortraitRevision || !this._popupPortraitSprite) {
            this.refreshPopupPortrait(true);
            return;
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
        if (this instanceof Window_Message) {
            this._popupPortraitPlacementGeometry = null;
            this._popupPortraitPlacementDirty = true;
            this._popupPortraitPresentationKey = null;
            this._sortPopupPortraitObjects();
            this.refreshPopupPortrait(false);
        }
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
