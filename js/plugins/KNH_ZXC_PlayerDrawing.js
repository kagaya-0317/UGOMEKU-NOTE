//=============================================================================
// KNH_ZXC_PlayerDrawing.js
//=============================================================================

/*:
 * @plugindesc Scene_Map player drawing editor and runtime drawing bitmaps.
 * @author KNH
 *
 * @help
 * Script examples:
 *   this.openPlayerDrawing({ background: "transparent" });
 *   // In a later event command after the editor closes:
 *   KNH_PlayerDrawing.putItem(this.lastPlayerDrawingId(), 1, $gamePlayer.x, $gamePlayer.y);
 *   ImageManager.loadPlayerDrawing(1);
 *   ImageManager.loadDynamicBitmap("PD:1");
 */

(function() {
    'use strict';

    var PD = window.KNH_PlayerDrawing = window.KNH_PlayerDrawing || {};
    var PLUGIN_NAME = 'KNH_ZXC_PlayerDrawing';
    var DOC_W = 72;
    var DOC_H = 72;
    var DISPLAY_SCALE = 6;
    var OUTPUT_SIZE = 144;
    var PIXEL_TRANSPARENT = 0;
    var PIXEL_WHITE = 1;
    var PIXEL_BLACK = 2;
    var DRAWING_NAME_RE = /^PD:(\d+)$/i;

    function clampInt(value, min, max) {
        value = Math.floor(Number(value) || 0);
        return Math.max(min, Math.min(max, value));
    }

    function wrapRef(owner, key) {
        return {
            get value() {
                return owner[key];
            },
            set value(value) {
                owner[key] = value;
            }
        };
    }

    function zxcData() {
        if ($gameSystem && typeof $gameSystem.ZXC === 'function') {
            return $gameSystem.ZXC();
        }
        if ($gameSystem) {
            $gameSystem._ZXC = $gameSystem._ZXC || {};
            return $gameSystem._ZXC;
        }
        return null;
    }

    function ensureStore() {
        var zxc = zxcData();
        if (!zxc) return null;
        if (!zxc.playerDrawings) {
            zxc.playerDrawings = {
                nextId: 1,
                entries: {}
            };
        }
        if (!zxc.playerDrawings.entries) zxc.playerDrawings.entries = {};
        if (!zxc.playerDrawings.nextId) zxc.playerDrawings.nextId = 1;
        return zxc.playerDrawings;
    }

    function bytesToBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64');
        }
        var chunk = 0x8000;
        var parts = [];
        for (var i = 0; i < bytes.length; i += chunk) {
            parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
        }
        return btoa(parts.join(''));
    }

    function base64ToBytes(text) {
        text = text || '';
        if (typeof Buffer !== 'undefined') {
            return new Uint8Array(Buffer.from(text, 'base64'));
        }
        var binary = atob(text);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
        return bytes;
    }

    function parseDrawingName(name) {
        var match = String(name || '').match(DRAWING_NAME_RE);
        return match ? Number(match[1]) : 0;
    }

    function markBitmapDirty(bitmap) {
        if (!bitmap) return;
        if (bitmap._setDirty) bitmap._setDirty();
        if (bitmap.checkDirty) bitmap.checkDirty();
    }

    function markYuraSpriteDirty(sprite) {
        if (!sprite) return;
        sprite._lastFrame = null;
        if (sprite._baseBitmap) {
            var frame = sprite._frame ? {
                x: sprite._frame.x,
                y: sprite._frame.y,
                width: sprite._frame.width,
                height: sprite._frame.height
            } : null;
            sprite.bitmap = sprite._baseBitmap;
            sprite._baseBitmap = null;
            if (frame) sprite.setFrame(frame.x, frame.y, frame.width, frame.height);
        }
        if (sprite._meshSprite) {
            sprite._meshSprite._meshDirty = true;
            sprite._meshSprite._lastPattern = null;
            sprite._meshSprite._lastMeshStep = null;
        }
    }

    function DrawingDocument(entry) {
        this.initialize(entry);
    }

    DrawingDocument.prototype.initialize = function(entry) {
        this.width = DOC_W;
        this.height = DOC_H;
        this.background = entry && entry.background === 'white' ? 'white' : 'transparent';
        this.pixels = new Uint8Array(this.width * this.height);
        this._undo = null;
        this._redo = null;
        if (entry && entry.pixels) this.unpack(entry.pixels);
    };

    DrawingDocument.prototype.index = function(x, y) {
        return y * this.width + x;
    };

    DrawingDocument.prototype.get = function(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return PIXEL_TRANSPARENT;
        return this.pixels[this.index(x, y)];
    };

    DrawingDocument.prototype.set = function(x, y, value) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
        value = clampInt(value, 0, 2);
        var index = this.index(x, y);
        if (this.pixels[index] === value) return false;
        this.pixels[index] = value;
        return true;
    };

    DrawingDocument.prototype.pack = function() {
        var total = this.pixels.length;
        var bytes = new Uint8Array(Math.ceil(total / 4));
        for (var i = 0; i < total; i++) {
            bytes[i >> 2] |= (this.pixels[i] & 0x03) << ((i & 3) * 2);
        }
        return bytesToBase64(bytes);
    };

    DrawingDocument.prototype.unpack = function(text) {
        var bytes = base64ToBytes(text);
        var total = this.pixels.length;
        for (var i = 0; i < total; i++) {
            this.pixels[i] = (bytes[i >> 2] >> ((i & 3) * 2)) & 0x03;
        }
    };

    DrawingDocument.prototype.snapshot = function() {
        return {
            background: this.background,
            pixels: this.pack()
        };
    };

    DrawingDocument.prototype.restore = function(snapshot) {
        if (!snapshot) return;
        if (typeof snapshot === 'string') {
            this.unpack(snapshot);
            return;
        }
        this.background = snapshot.background === 'white' ? 'white' : 'transparent';
        this.unpack(snapshot.pixels);
    };

    DrawingDocument.prototype.beginOperation = function() {
        this._undo = this.snapshot();
        this._redo = null;
    };

    DrawingDocument.prototype.canUndo = function() {
        return !!this._undo;
    };

    DrawingDocument.prototype.canRedo = function() {
        return !!this._redo;
    };

    DrawingDocument.prototype.undo = function() {
        if (!this._undo) return false;
        var now = this.snapshot();
        this.restore(this._undo);
        this._undo = null;
        this._redo = now;
        return true;
    };

    DrawingDocument.prototype.redo = function() {
        if (!this._redo) return false;
        var now = this.snapshot();
        this.restore(this._redo);
        this._redo = null;
        this._undo = now;
        return true;
    };

    DrawingDocument.prototype.brush = function(cx, cy, size, value) {
        size = clampInt(size, 1, 3);
        var changed = false;
        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                changed = this.set(cx + x, cy + y, value) || changed;
            }
        }
        return changed;
    };

    DrawingDocument.prototype.fill = function(x, y, value) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
        value = clampInt(value, 0, 2);
        var target = this.get(x, y);
        if (target === value) return false;
        var queue = [[x, y]];
        var changed = false;
        this.set(x, y, value);
        changed = true;
        while (queue.length) {
            var p = queue.pop();
            var px = p[0];
            var py = p[1];
            var next = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
            for (var i = 0; i < next.length; i++) {
                var nx = next[i][0];
                var ny = next[i][1];
                if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height && this.get(nx, ny) === target) {
                    this.set(nx, ny, value);
                    queue.push([nx, ny]);
                }
            }
        }
        return changed;
    };

    DrawingDocument.prototype.clear = function() {
        this.pixels.fill(PIXEL_TRANSPARENT);
    };

    DrawingDocument.prototype.toEntry = function(id, name) {
        return {
            id: id,
            w: this.width,
            h: this.height,
            background: this.background,
            pixels: this.pack(),
            name: name || '',
            version: 1
        };
    };

    function DrawingEditor(options) {
        this.initialize(options);
    }

    DrawingEditor.prototype.initialize = function(options) {
        options = options || {};
        this.options = options;
        this.sourceId = Number(options.drawingId || options.id || 0);
        var entry = this.sourceId ? PD.entry(this.sourceId) : null;
        this.doc = new DrawingDocument(entry);
        if (!entry && options.background === 'white') this.doc.background = 'white';
        this.tool = options.tool || 'pen';
        this.color = options.color === 'white' ? PIXEL_WHITE : PIXEL_BLACK;
        this.size = clampInt(options.size || 1, 1, 3);
        this._painting = false;
        this._changedInOperation = false;
        this._lastPixel = null;
    };

    DrawingEditor.prototype.paintValue = function() {
        return this.tool === 'eraser' ? PIXEL_TRANSPARENT : this.color;
    };

    DrawingEditor.prototype.setTool = function(tool) {
        this.tool = tool;
    };

    DrawingEditor.prototype.toggleColor = function() {
        this.color = this.color === PIXEL_BLACK ? PIXEL_WHITE : PIXEL_BLACK;
    };

    DrawingEditor.prototype.cycleSize = function() {
        this.size = this.size >= 3 ? 1 : this.size + 1;
    };

    DrawingEditor.prototype.toggleBackground = function() {
        this.doc.background = this.doc.background === 'white' ? 'transparent' : 'white';
    };

    DrawingEditor.prototype.beginDraw = function() {
        this.doc.beginOperation();
        this._changedInOperation = false;
    };

    DrawingEditor.prototype.finishDraw = function() {
        if (!this._changedInOperation) this.doc._undo = null;
        this._painting = false;
        this._lastPixel = null;
    };

    DrawingEditor.prototype.drawAt = function(x, y) {
        var changed = this.doc.brush(x, y, this.size, this.paintValue());
        this._changedInOperation = this._changedInOperation || changed;
        return changed;
    };

    DrawingEditor.prototype.drawLine = function(from, to) {
        if (!from) return this.drawAt(to.x, to.y);
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
        var changed = false;
        for (var i = 0; i <= steps; i++) {
            var x = Math.round(from.x + dx * i / steps);
            var y = Math.round(from.y + dy * i / steps);
            changed = this.drawAt(x, y) || changed;
        }
        return changed;
    };

    DrawingEditor.prototype.save = function() {
        var name = this.options.name || '';
        if (this.sourceId && this.options.overwrite) {
            PD.updateEntry(this.sourceId, this.doc.toEntry(this.sourceId, name));
            return this.sourceId;
        }
        return PD.createEntry(this.doc, name);
    };

    function drawDocumentToBitmap(bitmap, doc, scale, showGrid) {
        bitmap.smooth = false;
        var ctx = bitmap._context;
        var w = doc.width * scale;
        var h = doc.height * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, bitmap.width, bitmap.height);
        if (doc.background === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        } else {
            var checker = Math.max(4, scale * 2);
            for (var cy = 0; cy < h; cy += checker) {
                for (var cx = 0; cx < w; cx += checker) {
                    ctx.fillStyle = (((cx / checker + cy / checker) & 1) === 0) ? '#d6d6d6' : '#f2f2f2';
                    ctx.fillRect(cx, cy, checker, checker);
                }
            }
        }
        for (var y = 0; y < doc.height; y++) {
            for (var x = 0; x < doc.width; x++) {
                var value = doc.get(x, y);
                if (value === PIXEL_TRANSPARENT) continue;
                ctx.fillStyle = value === PIXEL_BLACK ? '#111111' : '#ffffff';
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
        if (showGrid) {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            for (var gx = 0; gx <= w; gx += scale) ctx.fillRect(gx, 0, 1, h);
            for (var gy = 0; gy <= h; gy += scale) ctx.fillRect(0, gy, w, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, w, 1);
            ctx.fillRect(0, h - 1, w, 1);
            ctx.fillRect(0, 0, 1, h);
            ctx.fillRect(w - 1, 0, 1, h);
        }
        ctx.restore();
        markBitmapDirty(bitmap);
    }

    function makeOutputBitmap(entry, size) {
        var doc = new DrawingDocument(entry);
        size = Math.max(1, Number(size || OUTPUT_SIZE));
        var scale = size / DOC_W;
        var bitmap = new Bitmap(size, size);
        var ctx = bitmap._context;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        if (doc.background === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
        }
        for (var y = 0; y < doc.height; y++) {
            for (var x = 0; x < doc.width; x++) {
                var value = doc.get(x, y);
                if (value === PIXEL_TRANSPARENT) continue;
                ctx.fillStyle = value === PIXEL_BLACK ? '#111111' : '#ffffff';
                ctx.fillRect(Math.floor(x * scale), Math.floor(y * scale), Math.ceil(scale), Math.ceil(scale));
            }
        }
        ctx.restore();
        bitmap.smooth = false;
        bitmap._knhPlayerDrawing = true;
        bitmap._knhPlayerDrawingId = Number(entry.id || 0);
        markBitmapDirty(bitmap);
        return bitmap;
    }

    function blankOutputBitmap(size) {
        var bitmap = new Bitmap(size || OUTPUT_SIZE, size || OUTPUT_SIZE);
        bitmap.smooth = false;
        bitmap._knhPlayerDrawing = true;
        markBitmapDirty(bitmap);
        return bitmap;
    }

    PD.clearCache = function() {
        this._bitmapCache = {};
        this._cacheVersion = (this._cacheVersion || 0) + 1;
    };

    PD.entry = function(id) {
        var store = ensureStore();
        if (!store) return null;
        return store.entries[String(Number(id))] || null;
    };

    PD.createEntry = function(doc, name) {
        var store = ensureStore();
        if (!store) return 0;
        var id = Number(store.nextId || 1);
        store.nextId = id + 1;
        store.entries[String(id)] = doc.toEntry(id, name);
        this.clearCache();
        return id;
    };

    PD.updateEntry = function(id, entry) {
        var store = ensureStore();
        if (!store) return 0;
        id = Number(id);
        entry.id = id;
        store.entries[String(id)] = entry;
        store.nextId = Math.max(Number(store.nextId || 1), id + 1);
        this.clearCache();
        return id;
    };

    PD.loadDocument = function(id) {
        return new DrawingDocument(this.entry(id));
    };

    PD.drawingName = function(id) {
        return 'PD:' + Number(id || 0);
    };

    PD.parseDrawingName = parseDrawingName;

    PD.isDrawingName = function(name) {
        return !!parseDrawingName(name);
    };

    PD.loadBitmap = function(id, options) {
        options = options || {};
        id = Number(id || 0);
        var size = Number(options.size || OUTPUT_SIZE);
        var key = id + ':' + size;
        this._bitmapCache = this._bitmapCache || {};
        if (this._bitmapCache[key]) return this._bitmapCache[key];
        var entry = this.entry(id);
        var bitmap = entry ? makeOutputBitmap(entry, size) : blankOutputBitmap(size);
        this._bitmapCache[key] = bitmap;
        return bitmap;
    };

    PD.loadDynamicBitmap = function(name, options) {
        var id = parseDrawingName(name);
        return id ? this.loadBitmap(id, options) : null;
    };

    PD.putItem = function(drawingId, itemOrId, x, y, num) {
        if (!$gameMap || !$dataTemplateEvents) return null;
        return $gameMap.putPlayerDrawingItem(drawingId, itemOrId, x, y, num);
    };

    PD.spawnEvent = function(drawingId, template, x, y, options) {
        if (!$gameMap) return null;
        return $gameMap.spawnPlayerDrawingEvent(drawingId, template, x, y, options);
    };

    PD.open = function(options) {
        var scene = SceneManager && SceneManager._scene;
        if (scene && scene.startPlayerDrawing) return scene.startPlayerDrawing(options || {});
        return false;
    };

    function Window_PlayerDrawingCanvas() {
        this.initialize.apply(this, arguments);
    }

    Window_PlayerDrawingCanvas.prototype = Object.create(Window_Base.prototype);
    Window_PlayerDrawingCanvas.prototype.constructor = Window_PlayerDrawingCanvas;

    Window_PlayerDrawingCanvas.prototype.initialize = function(editor, x, y) {
        this._editor = editor;
        var size = DOC_W * DISPLAY_SCALE;
        Window_Base.prototype.initialize.call(this, x, y, size + this.standardPadding() * 2, size + this.standardPadding() * 2);
        this.refresh();
    };

    Window_PlayerDrawingCanvas.prototype.refresh = function() {
        if (this.refreshYurayura) this.refreshYurayura();
        drawDocumentToBitmap(this.contents, this._editor.doc, DISPLAY_SCALE, true);
        markYuraSpriteDirty(this._windowContentsSprite);
    };

    Window_PlayerDrawingCanvas.prototype.pixelFromScreen = function(screenX, screenY) {
        var x = this.canvasToLocalX(screenX) - this.padding;
        var y = this.canvasToLocalY(screenY) - this.padding;
        var size = DOC_W * DISPLAY_SCALE;
        if (x < 0 || y < 0 || x >= size || y >= size) return null;
        return {
            x: clampInt(x / DISPLAY_SCALE, 0, DOC_W - 1),
            y: clampInt(y / DISPLAY_SCALE, 0, DOC_H - 1)
        };
    };

    function Window_PlayerDrawingToolbar() {
        this.initialize.apply(this, arguments);
    }

    Window_PlayerDrawingToolbar.prototype = Object.create(Window_Command.prototype);
    Window_PlayerDrawingToolbar.prototype.constructor = Window_PlayerDrawingToolbar;

    Window_PlayerDrawingToolbar.prototype.initialize = function(editor, x, y) {
        this._editor = editor;
        Window_Command.prototype.initialize.call(this, x, y);
    };

    Window_PlayerDrawingToolbar.prototype.windowWidth = function() {
        return 176;
    };

    Window_PlayerDrawingToolbar.prototype.numVisibleRows = function() {
        return 12;
    };

    Window_PlayerDrawingToolbar.prototype.makeCommandList = function() {
        var e = this._editor;
        var tool = e ? e.tool : 'pen';
        var mark = function(name, active) {
            return (active ? '> ' : '  ') + name;
        };
        this.addCommand(mark('Pen', tool === 'pen'), 'tool_pen');
        this.addCommand(mark('Erase', tool === 'eraser'), 'tool_eraser');
        this.addCommand(mark('Fill', tool === 'fill'), 'tool_fill');
        this.addCommand(mark('Picker', tool === 'picker'), 'tool_picker');
        this.addCommand('Color ' + (e && e.color === PIXEL_WHITE ? 'White' : 'Black'), 'color');
        this.addCommand('Size ' + (e ? e.size : 1), 'size');
        this.addCommand('BG ' + (e && e.doc.background === 'white' ? 'White' : 'Trans'), 'background');
        this.addCommand('Undo', 'undo', !!(e && e.doc.canUndo()));
        this.addCommand('Redo', 'redo', !!(e && e.doc.canRedo()));
        this.addCommand('Clear', 'clear');
        this.addCommand('Done', 'done');
        this.addCommand('Cancel', 'cancel_draw');
    };

    Window_PlayerDrawingToolbar.prototype.refreshState = function() {
        var symbol = this.currentSymbol();
        this.refresh();
        this.selectSymbol(symbol);
        this.activate();
    };

    Window_PlayerDrawingToolbar.prototype.processTouch = function() {
        var scene = SceneManager && SceneManager._scene;
        var info = scene && scene._sceneInfo;
        var insideCanvas = info && info.type === 'playerDrawing' && info.canvasWindow &&
                info.canvasWindow.pixelFromScreen(TouchInput.x, TouchInput.y);
        var canvasTouching = TouchInput.isTriggered() || TouchInput.isPressed() ||
                TouchInput.isCancelled() || (TouchInput.isReleased && TouchInput.isReleased());
        if (insideCanvas && canvasTouching) {
            this._touching = false;
            return;
        }
        Window_Command.prototype.processTouch.apply(this, arguments);
    };

    function resolveTemplate(template, isTemplate) {
        if (template == null || template === '') return null;
        if (typeof template === 'number' || String(template).match(/^\d+$/)) return Number(template);
        var source = isTemplate ? $dataTemplateEvents : ($dataMap && $dataMap.events);
        var data = DataManager.searchDataItem ? DataManager.searchDataItem(source, 'name', String(template)) : null;
        return data ? data.id : null;
    }

    function resolveItem(itemOrId) {
        if (!itemOrId) return null;
        if (typeof itemOrId === 'object') return itemOrId;
        return $dataItems ? $dataItems[Number(itemOrId)] : null;
    }

    ImageManager.loadPlayerDrawing = function(id, options) {
        return PD.loadBitmap(id, options);
    };

    ImageManager.loadDynamicBitmap = function(name, options) {
        return PD.loadDynamicBitmap(name, options);
    };

    function wrapImageLoader(name) {
        var base = ImageManager[name];
        if (typeof base !== 'function') return;
        ImageManager[name] = function(filename, hue) {
            var bitmap = this.loadDynamicBitmap(filename);
            if (bitmap) return bitmap;
            return base.apply(this, arguments);
        };
    }

    wrapImageLoader('loadItem');
    wrapImageLoader('loadPicture');
    wrapImageLoader('loadEnemy');
    wrapImageLoader('loadSvEnemy');
    wrapImageLoader('loadSystem');

    Game_Event.prototype.setPlayerDrawingImage = function(drawingId, options) {
        options = options || {};
        this._playerDrawingImageInfo = {
            id: Number(drawingId || 0),
            size: Number(options.size || OUTPUT_SIZE),
            scale: Number(options.scale || this._scaleX || 100),
            anchorX: options.anchorX == null ? 0.5 : Number(options.anchorX),
            anchorY: options.anchorY == null ? 1 : Number(options.anchorY),
            outlineBlack: options.outlineBlack == null ? 1 : Number(options.outlineBlack),
            outlineWhite: options.outlineWhite == null ? 2 : Number(options.outlineWhite),
            yura: options.yura === false ? null : (options.yura || [24, 24])
        };
        this._scaleX = this._scaleY = this._playerDrawingImageInfo.scale;
        var sprite = this.sprite && this.sprite();
        if (sprite && sprite.updateBitmap) sprite.updateBitmap();
    };

    Game_Event.prototype.clearPlayerDrawingImage = function() {
        this._playerDrawingImageInfo = null;
        var sprite = this.sprite && this.sprite();
        if (sprite && sprite.updateBitmap) sprite.updateBitmap();
    };

    Game_Event.prototype.playerDrawingImageInfo = function() {
        return this._playerDrawingImageInfo;
    };

    Game_Map.prototype.putPlayerDrawingItem = function(drawingId, itemOrId, x, y, num) {
        var item = resolveItem(itemOrId);
        var tpl = DataManager.searchDataItem ? DataManager.searchDataItem($dataTemplateEvents, 'name', 'item') : null;
        if (!item || !tpl) return null;
        var ev = this.spawnEvent(tpl.id, x, y, true);
        ev.setItem(item);
        ev.setPlayerDrawingImage(drawingId, { scale: ev._scaleX || 60 });
        ev._itemNum = num || 1;
        this.rejudgeEvents();
        return ev;
    };

    Game_Map.prototype.spawnPlayerDrawingEvent = function(drawingId, template, x, y, options) {
        options = options || {};
        var isTemplate = options.isTemplate !== false;
        var templateId = resolveTemplate(template, isTemplate);
        if (!templateId) return null;
        var ev = this.spawnEvent(templateId, x, y, isTemplate);
        ev.setPlayerDrawingImage(drawingId, options);
        this.rejudgeEvents();
        return ev;
    };

    function drawingInfoForCharacter(character) {
        if (!character) return null;
        if (character.playerDrawingImageInfo && character.playerDrawingImageInfo()) {
            return character.playerDrawingImageInfo();
        }
        if (character.itemImageInfo && character.itemImageInfo()) {
            var imageInfo = character.itemImageInfo();
            var id = parseDrawingName(imageInfo[0]);
            if (id) return { id: id, size: OUTPUT_SIZE, scale: character._scaleX || 100, anchorX: 0.5, anchorY: 1, outlineBlack: 1, outlineWhite: 2, yura: [24, 24] };
        }
        return null;
    }

    function drawingImageKey(info) {
        if (!info || !info.id) return '';
        return [
            PD._cacheVersion || 0,
            Number(info.id || 0),
            Number(info.size || OUTPUT_SIZE),
            Number(info.scale || 100),
            Number(info.anchorX == null ? 0.5 : info.anchorX),
            Number(info.anchorY == null ? 1 : info.anchorY),
            Number(info.outlineBlack || 0),
            Number(info.outlineWhite || 0),
            info.yura ? String(info.yura) : ''
        ].join('|');
    }

    var _Sprite_Character_isImageChanged_PD = Sprite_Character.prototype.isImageChanged;
    Sprite_Character.prototype.isImageChanged = function() {
        var key = drawingImageKey(drawingInfoForCharacter(this._character));
        if (this._playerDrawingKey !== key) return true;
        return _Sprite_Character_isImageChanged_PD.apply(this, arguments);
    };

    var _Sprite_Character_updateBitmap_PD = Sprite_Character.prototype.updateBitmap;
    Sprite_Character.prototype.updateBitmap = function() {
        var info = drawingInfoForCharacter(this._character);
        if (info && info.id) {
            var key = drawingImageKey(info);
            if (this._playerDrawingKey !== key) {
                this._tilesetId = $gameMap.tilesetId();
                this._tileId = 0;
                this._characterName = this._character.characterName();
                this._characterIndex = this._character.characterIndex();
                this.setCharacterBitmap();
            }
            return;
        }
        _Sprite_Character_updateBitmap_PD.apply(this, arguments);
    };

    var _Sprite_Character_setTileBitmap_PD = Sprite_Character.prototype.setTileBitmap;
    Sprite_Character.prototype.setTileBitmap = function() {
        this._playerDrawingSprite = false;
        this._playerDrawingKey = '';
        _Sprite_Character_setTileBitmap_PD.apply(this, arguments);
    };

    var _Sprite_Character_setCharacterBitmap_PD = Sprite_Character.prototype.setCharacterBitmap;
    Sprite_Character.prototype.setCharacterBitmap = function() {
        var info = drawingInfoForCharacter(this._character);
        if (info && info.id) {
            this.bitmap = ImageManager.loadPlayerDrawing(info.id, { size: info.size || OUTPUT_SIZE });
            this._baseBitmap = null;
            this._playerDrawingSprite = true;
            this._playerDrawingKey = drawingImageKey(info);
            this._enemySprite = false;
            this._needEnemyAnimInit = false;
            this._isBigCharacter = true;
            this.bitmap.addLoadListener(function() {
                this.setFrame(0, 0, this.bitmap.width, this.bitmap.height);
                this.anchor.x = info.anchorX == null ? 0.5 : info.anchorX;
                this.anchor.y = info.anchorY == null ? 1 : info.anchorY;
                this.scale.x = this.scale.y = Number(info.scale || 100) / 100;
                if (this.setOutline) this.setOutline(info.outlineBlack || 0, info.outlineWhite || 0);
                this._yuraInfo = info.yura || null;
                markYuraSpriteDirty(this);
            }.bind(this));
            return;
        }
        if (this._playerDrawingSprite) this.scale.x = this.scale.y = 1;
        this._playerDrawingSprite = false;
        this._playerDrawingKey = '';
        _Sprite_Character_setCharacterBitmap_PD.apply(this, arguments);
    };

    var _Sprite_Character_updateCharacterFrame_PD = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function() {
        if (this._playerDrawingSprite || drawingInfoForCharacter(this._character)) return;
        _Sprite_Character_updateCharacterFrame_PD.apply(this, arguments);
    };

    Scene_Base.prototype.startPlayerDrawing = function(options) {
        options = options || {};
        if (this._sceneInfo) return false;
        var editor = new DrawingEditor(options);
        var toolbarW = 176;
        var gap = 16;
        var padding = Window_Base.prototype.standardPadding();
        var canvasW = DOC_W * DISPLAY_SCALE + padding * 2;
        var totalW = toolbarW + gap + canvasW;
        var canvasLeft = Math.floor((Graphics.boxWidth - canvasW) / 2);
        var maxLeft = Math.max(8, Graphics.boxWidth - totalW - 8);
        var left = Math.max(8, Math.min(canvasLeft - toolbarW - gap, maxLeft));
        var top = Math.max(8, Math.floor((Graphics.boxHeight - canvasW) / 2));
        this._pdToolbarWindow = new Window_PlayerDrawingToolbar(editor, left, top);
        this._pdCanvasWindow = new Window_PlayerDrawingCanvas(editor, left + toolbarW + gap, top);
        this.addWindow(this._pdToolbarWindow);
        this.addWindow(this._pdCanvasWindow);

        var info = this._sceneInfo = {
            type: 'playerDrawing',
            editor: editor,
            toolbarWindow: this._pdToolbarWindow,
            canvasWindow: this._pdCanvasWindow,
            windows: [wrapRef(this, '_pdToolbarWindow'), wrapRef(this, '_pdCanvasWindow')],
            returnInterpreter: options.returnInterpreter || null,
            onDone: typeof options.onDone === 'function' ? options.onDone : null,
            resultVariableId: Number(options.resultVariableId || 0),
            resultSwitchId: Number(options.resultSwitchId || 0)
        };
        this._pdToolbarWindow.setHandler('tool_pen', this.onPlayerDrawingCommand.bind(this, 'tool_pen'));
        this._pdToolbarWindow.setHandler('tool_eraser', this.onPlayerDrawingCommand.bind(this, 'tool_eraser'));
        this._pdToolbarWindow.setHandler('tool_fill', this.onPlayerDrawingCommand.bind(this, 'tool_fill'));
        this._pdToolbarWindow.setHandler('tool_picker', this.onPlayerDrawingCommand.bind(this, 'tool_picker'));
        this._pdToolbarWindow.setHandler('color', this.onPlayerDrawingCommand.bind(this, 'color'));
        this._pdToolbarWindow.setHandler('size', this.onPlayerDrawingCommand.bind(this, 'size'));
        this._pdToolbarWindow.setHandler('background', this.onPlayerDrawingCommand.bind(this, 'background'));
        this._pdToolbarWindow.setHandler('undo', this.onPlayerDrawingCommand.bind(this, 'undo'));
        this._pdToolbarWindow.setHandler('redo', this.onPlayerDrawingCommand.bind(this, 'redo'));
        this._pdToolbarWindow.setHandler('clear', this.onPlayerDrawingCommand.bind(this, 'clear'));
        this._pdToolbarWindow.setHandler('done', this.finishPlayerDrawing.bind(this, true));
        this._pdToolbarWindow.setHandler('cancel_draw', this.finishPlayerDrawing.bind(this, false));
        this._pdToolbarWindow.setHandler('cancel', this.finishPlayerDrawing.bind(this, false));
        return true;
    };

    Scene_Base.prototype.onPlayerDrawingCommand = function(symbol) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        var editor = info.editor;
        switch (symbol) {
            case 'tool_pen':
                editor.setTool('pen');
                break;
            case 'tool_eraser':
                editor.setTool('eraser');
                break;
            case 'tool_fill':
                editor.setTool('fill');
                break;
            case 'tool_picker':
                editor.setTool('picker');
                break;
            case 'color':
                editor.toggleColor();
                break;
            case 'size':
                editor.cycleSize();
                break;
            case 'background':
                editor.doc.beginOperation();
                editor.toggleBackground();
                info.canvasWindow.refresh();
                break;
            case 'undo':
                if (editor.doc.undo()) info.canvasWindow.refresh();
                break;
            case 'redo':
                if (editor.doc.redo()) info.canvasWindow.refresh();
                break;
            case 'clear':
                editor.doc.beginOperation();
                editor.doc.clear();
                info.canvasWindow.refresh();
                break;
        }
        info.toolbarWindow.refreshState();
    };

    Scene_Base.prototype.finishPlayerDrawing = function(save) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        var id = 0;
        if (save) id = info.editor.save();
        if (info.returnInterpreter) info.returnInterpreter._lastPlayerDrawingId = id;
        if (info.onDone) info.onDone.call(info.returnInterpreter || this, id);
        if (info.resultVariableId > 0) $gameVariables.setValue(info.resultVariableId, id);
        if (info.resultSwitchId > 0) $gameSwitches.setValue(info.resultSwitchId, !!id);
        info.windows.forEach(function(ref) {
            if (ref.value && this._windowLayer) this._windowLayer.removeChild(ref.value);
            ref.value = null;
        }, this);
        this._sceneInfo = null;
    };

    Scene_Base.prototype.updatePlayerDrawing = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        var editor = info.editor;
        var canvas = info.canvasWindow;
        if (TouchInput.isTriggered()) {
            var start = canvas.pixelFromScreen(TouchInput.x, TouchInput.y);
            if (start) {
                if (editor.tool === 'picker') {
                    var picked = editor.doc.get(start.x, start.y);
                    if (picked === PIXEL_WHITE || picked === PIXEL_BLACK) {
                        editor.color = picked;
                        editor.tool = 'pen';
                    } else {
                        editor.tool = 'eraser';
                    }
                    info.toolbarWindow.refreshState();
                } else if (editor.tool === 'fill') {
                    editor.doc.beginOperation();
                    if (editor.doc.fill(start.x, start.y, editor.color)) canvas.refresh();
                    else editor.doc._undo = null;
                    info.toolbarWindow.refreshState();
                } else {
                    editor.beginDraw();
                    editor._painting = true;
                    editor._lastPixel = start;
                    if (editor.drawAt(start.x, start.y)) canvas.refresh();
                    info.toolbarWindow.refreshState();
                }
            }
        } else if (editor._painting && TouchInput.isPressed()) {
            var current = canvas.pixelFromScreen(TouchInput.x, TouchInput.y);
            if (current) {
                if (editor.drawLine(editor._lastPixel, current)) canvas.refresh();
                editor._lastPixel = current;
            }
        }
        if (editor._painting && TouchInput.isReleased()) {
            editor.finishDraw();
            info.toolbarWindow.refreshState();
        }
    };

    var _Scene_Map_update_PD = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update_PD.apply(this, arguments);
        this.updatePlayerDrawing();
    };

    Game_Interpreter.prototype.openPlayerDrawing = function(options) {
        options = options || {};
        options.returnInterpreter = this;
        var opened = PD.open(options);
        if (opened) this.setWaitMode('scene');
        return opened;
    };

    Game_Interpreter.prototype.lastPlayerDrawingId = function() {
        return Number(this._lastPlayerDrawingId || 0);
    };

    var _Game_Interpreter_pluginCommand_PD = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand_PD.apply(this, arguments);
        if (String(command || '').toUpperCase() === 'PD_OPEN') {
            args = args || [];
            var first = String(args[0] || '').toLowerCase();
            var background = first === 'white' || first === 'transparent' ? first : (args[1] || 'transparent');
            this.openPlayerDrawing({
                resultVariableId: first === 'white' || first === 'transparent' ? 0 : Number(args[0] || 0),
                background: background
            });
        }
    };

    var _Game_System_onAfterLoad_PD = Game_System.prototype.onAfterLoad;
    Game_System.prototype.onAfterLoad = function() {
        _Game_System_onAfterLoad_PD.apply(this, arguments);
        PD.clearCache();
    };

    PD.Document = DrawingDocument;
    PD.Editor = DrawingEditor;
    PD.WindowCanvas = Window_PlayerDrawingCanvas;
    PD.WindowToolbar = Window_PlayerDrawingToolbar;
})();
