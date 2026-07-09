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
 *   this.openPlayerDrawing({ background: "transparent", showCancelButton: true });
 *   // In a later event command after the editor closes:
 *   KNH_PlayerDrawing.putItem(this.lastPlayerDrawingId(), 1, $gamePlayer.x, $gamePlayer.y);
 *   this.registerLastPlayerDrawingItemImage(1);
 *   this.putLastPlayerDrawingItem(1, $gamePlayer.x, $gamePlayer.y);
 *   this.spawnLastPlayerDrawingEvent("templateName", $gamePlayer.x, $gamePlayer.y);
 *   ImageManager.loadPlayerDrawing(1);
 *   ImageManager.loadDynamicBitmap("PD:1");
 */

(function() {
    'use strict';

    var PD = window.KNH_PlayerDrawing = window.KNH_PlayerDrawing || {};
    var DOC_W = 72;
    var DOC_H = 72;
    var DISPLAY_SCALE = 6;
    var OUTPUT_SIZE = 144;
    var HISTORY_LIMIT = 10;
    var TRANSPARENT_CHECKER_CELLS = 4;
    var DISPLAY_UPDATE_MARGIN = 2;
    var DISPLAY_DIAGONAL_BRIDGE_SIZE = 2;
    var BRUSH_SIZE_MIN = 1;
    var BRUSH_SIZE_MAX = 3;
    var STROKE_SE_INTERVAL = 10;
    var STROKE_SE_VOLUME = 150;
    var ERASER_STROKE_SE_NAME = '00_powa';
    var ERASER_STROKE_SE_VOLUME = 70;
    var STROKE_SE_PITCH_MIN = 100;
    var STROKE_SE_PITCH_MAX = 120;
    var FILL_SE_NAME = '00_gero';
    var FILL_SE_VOLUME = 70;
    var FILL_SE_PITCH = 150;
    var DONE_CONFIRM_TEXT = '\u3053\u308c\u3067\u3044\u3044\uff1f';
    var DONE_CONFIRM_YES = '\u306f\u3044';
    var DONE_CONFIRM_NO = '\u3044\u3044\u3048';
    var WHITE_COLOR = '#ffffff';
    var TECH_BLACK_COLOR = '#000000';
    var GAME_BLACK_COLOR = '#474e51';
    var TRANSPARENT_HATCH_COLOR = GAME_BLACK_COLOR;
    var TOOL_ICON_BITMAP = 'UI_playerDrawingTools';
    var TOOL_ICON_SIZE = 48;
    var TOOL_BUTTON_SIZE = TOOL_ICON_SIZE;
    var TOOL_BUTTON_GAP = 7;
    var TOOL_ICON_OFFSET = Math.floor((TOOL_BUTTON_SIZE - TOOL_ICON_SIZE) / 2);
    var PROMPT_MARGIN = 8;
    var PROMPT_MIN_FONT_SIZE = 18;
    var SIZE_BUTTON_SIZE = 24;
    var SIZE_BUTTON_GAP = 6;
    var SIZE_SELECT_GAP = 2;
    var SIZE_SELECT_BORDER = 3;
    var SIZE_SELECT_OUTSET = SIZE_SELECT_GAP + SIZE_SELECT_BORDER;
    var TOOLBAR_W = 128;
    var ACTION_BUTTON_GAP = 4;
    var ACTION_H = 84;
    var COLOR_WINDOW_W = 64;
    var COLOR_WINDOW_H = 64;
    var COLOR_BIG_SIZE = 38;
    var COLOR_SMALL_SIZE = 28;
    var COLOR_WHITE_BORDER = 4;
    var COLOR_BLACK_BORDER = 6;
    var PIXEL_TRANSPARENT = 0;
    var PIXEL_WHITE = 1;
    var PIXEL_BLACK = 2;
    var BACKGROUND_WHITE = 'white';
    var BACKGROUND_TRANSPARENT = 'transparent';
    var DRAWING_NAME_RE = /^PD:(\d+)$/i;
    var SHORTCUT_NAMES = ['undo', 'redo', 'toolbarPrev', 'toolbarNext', 'brushSmaller', 'brushLarger'];
    var GAMEPAD_UNDO_BUTTONS = [4, 6];
    var GAMEPAD_REDO_BUTTONS = [5, 7];
    var DISPLAY_CORNERS = [
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: 1 }
    ];
    var DRAWING_TOOL_KEYS = ['pen', 'eraser', 'fill', 'picker'];
    var TOOLBAR_BUTTONS = [
        { key: 'pen', icon: 0, type: 'tool' },
        { key: 'eraser', icon: 1, type: 'tool' },
        { key: 'fill', icon: 2, type: 'tool' },
        { key: 'picker', icon: 3, type: 'tool' },
        { key: 'clear', icon: 4, type: 'action' },
        { key: 'undo', icon: 5, type: 'action' },
        { key: 'redo', icon: 6, type: 'action' }
    ];
    var ACTION_BUTTONS = [
        { key: 'done', icon: 7 },
        { key: 'cancel_draw', icon: 8 }
    ];
    var ACTION_DONE_BUTTONS = [ACTION_BUTTONS[0]];
    var CURSOR_TOOL_ICONS = {
        pen: 0,
        eraser: 1,
        fill: 2,
        picker: 3
    };

    function toolbarIndexForKey(key) {
        for (var i = 0; i < TOOLBAR_BUTTONS.length; i++) {
            if (TOOLBAR_BUTTONS[i].key === key) return i;
        }
        return -1;
    }

    function toolbarCommandForButton(button) {
        if (!button) return null;
        return button.type === 'tool' ? 'tool_' + button.key : button.key;
    }

    function cursorIconForTool(tool) {
        return Object.prototype.hasOwnProperty.call(CURSOR_TOOL_ICONS, tool) ? CURSOR_TOOL_ICONS[tool] : -1;
    }

    function isBrushTool(tool) {
        return tool === 'pen' || tool === 'eraser';
    }

    function isDrawingTool(tool) {
        return DRAWING_TOOL_KEYS.indexOf(tool) >= 0;
    }

    function normalizeBackground(value) {
        return value === BACKGROUND_WHITE ? BACKGROUND_WHITE : BACKGROUND_TRANSPARENT;
    }

    function normalizePixelValue(value) {
        return clampInt(value, PIXEL_TRANSPARENT, PIXEL_BLACK);
    }

    function pixelCss(value) {
        return value === PIXEL_BLACK ? GAME_BLACK_COLOR : WHITE_COLOR;
    }

    function rectContains(rect, x, y) {
        return !!rect && x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
    }

    function contentsContainsPoint(win, point) {
        return point.x >= 0 && point.y >= 0 && point.x < win.contents.width && point.y < win.contents.height;
    }

    function windowTouchPoint(win, contentsSpace) {
        var offset = contentsSpace ? win.padding : 0;
        return {
            x: win.canvasToLocalX(TouchInput.x) - offset,
            y: win.canvasToLocalY(TouchInput.y) - offset
        };
    }

    function triggeredContentsPoint(win, contentsSpace) {
        if (!TouchInput.isTriggered()) return null;
        var point = windowTouchPoint(win, contentsSpace);
        return contentsContainsPoint(win, point) ? point : null;
    }

    function toolbarWindowHeight() {
        var contentH = TOOLBAR_BUTTONS.length * TOOL_BUTTON_SIZE + (TOOLBAR_BUTTONS.length - 1) * TOOL_BUTTON_GAP;
        return contentH + Window_Base.prototype.standardPadding() * 2;
    }

    function actionButtonsForEditor(editor) {
        return editor && editor.showCancelButton ? ACTION_BUTTONS : ACTION_DONE_BUTTONS;
    }

    function actionWindowWidth(editor) {
        var buttons = actionButtonsForEditor(editor);
        var contentW = buttons.length * TOOL_BUTTON_SIZE + Math.max(0, buttons.length - 1) * ACTION_BUTTON_GAP;
        return contentW + Window_Base.prototype.standardPadding() * 2;
    }

    function booleanOption(value, defaultValue) {
        if (value == null) return !!defaultValue;
        if (value === true || value === false) return value;
        var text = String(value).toLowerCase();
        if (text === 'true' || text === 'on' || text === 'yes' || text === '1') return true;
        if (text === 'false' || text === 'off' || text === 'no' || text === '0') return false;
        return !!value;
    }

    function pdText(text) {
        return typeof _tl === 'function' ? _tl(text) : text;
    }

    function optionText(options, keys) {
        for (var i = 0; i < keys.length; i++) {
            var value = options[keys[i]];
            if (value != null && value !== '') return String(value);
        }
        return '';
    }

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
                entries: {},
                itemImages: {}
            };
        }
        if (!zxc.playerDrawings.entries) zxc.playerDrawings.entries = {};
        if (!zxc.playerDrawings.itemImages) zxc.playerDrawings.itemImages = {};
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

    function playPlayerDrawingSound(type) {
        if (typeof SoundManager === 'undefined' || !SoundManager) return;
        if (type === 'cursor' && SoundManager.playCursor) SoundManager.playCursor();
        else if (type === 'ok' && SoundManager.playOk) SoundManager.playOk();
        else if (type === 'cancel' && SoundManager.playCancel) SoundManager.playCancel();
        else if (type === 'buzzer' && SoundManager.playBuzzer) SoundManager.playBuzzer();
    }

    function playPlayerDrawingSe(name, volume, pitch, isStatic) {
        var gameSystem = typeof $gameSystem !== 'undefined' ? $gameSystem : null;
        if (gameSystem && isStatic && gameSystem.playStaticSe) {
            gameSystem.playStaticSe(name, volume, pitch);
            return;
        }
        if (gameSystem && !isStatic && gameSystem.playSe) {
            gameSystem.playSe(name, volume, pitch);
            return;
        }
        if (typeof AudioManager === 'undefined') return;
        var se = { name: name, volume: volume, pitch: pitch, pan: 0 };
        if (isStatic && AudioManager.playStaticSe) AudioManager.playStaticSe(se);
        else if (!isStatic && AudioManager.playSe) AudioManager.playSe(se);
    }

    function pdRandInt(min, max) {
        if (typeof _rand === 'function') return _rand(min, max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function playerDrawingStrokeSeName(tool) {
        if (tool === 'eraser') return ERASER_STROKE_SE_NAME;
        return '00_pen' + pdRandInt(1, 26);
    }

    function playPlayerDrawingStrokeSe(tool) {
        var name = playerDrawingStrokeSeName(tool);
        var volume = tool === 'eraser' ? ERASER_STROKE_SE_VOLUME : STROKE_SE_VOLUME;
        var pitch = pdRandInt(STROKE_SE_PITCH_MIN, STROKE_SE_PITCH_MAX);
        playPlayerDrawingSe(name, volume, pitch, true);
    }

    function playPlayerDrawingFillSe() {
        playPlayerDrawingSe(FILL_SE_NAME, FILL_SE_VOLUME, FILL_SE_PITCH, false);
    }

    function playPlayerDrawingPickerSe() {
        playPlayerDrawingStrokeSe('eraser');
    }

    function isPlayerDrawingActive() {
        var scene = SceneManager && SceneManager._scene;
        return !!(scene && scene._sceneInfo && scene._sceneInfo.type === 'playerDrawing');
    }

    function updateRightButtonStateFromEvent(event) {
        var state = PD._rightButtonState;
        state.x = Graphics.pageToCanvasX(event.pageX);
        state.y = Graphics.pageToCanvasY(event.pageY);
        state.insideCanvas = Graphics.isInsideCanvas(state.x, state.y);
        return state.insideCanvas;
    }

    function resetRightButtonState() {
        var state = PD._rightButtonState;
        if (!state) return;
        state.pressed = false;
        state.triggered = false;
        state.lastPickKey = '';
    }

    function ensureShortcutQueue() {
        PD._shortcutQueue = PD._shortcutQueue || {};
        for (var i = 0; i < SHORTCUT_NAMES.length; i++) {
            var name = SHORTCUT_NAMES[i];
            PD._shortcutQueue[name] = !!PD._shortcutQueue[name];
        }
    }

    function queueKeyboardShortcut(name, event) {
        ensureShortcutQueue();
        PD._shortcutQueue[name] = true;
        if (event && event.preventDefault) event.preventDefault();
    }

    PD._rightButtonState = PD._rightButtonState || {
        pressed: false,
        triggered: false,
        insideCanvas: false,
        x: 0,
        y: 0,
        lastPickKey: ''
    };
    if (!PD._rightButtonHookReady && typeof TouchInput !== 'undefined') {
        PD._rightButtonHookReady = true;
        var _TouchInput_onRightButtonDown_PD = TouchInput._onRightButtonDown;
        var _TouchInput_onMouseMove_PD = TouchInput._onMouseMove;
        var _TouchInput_onMouseUp_PD = TouchInput._onMouseUp;
        TouchInput._onRightButtonDown = function(event) {
            if (isPlayerDrawingActive()) {
                var state = PD._rightButtonState;
                var inside = updateRightButtonStateFromEvent(event);
                state.pressed = inside;
                state.triggered = inside;
                state.lastPickKey = '';
                event.preventDefault();
                return;
            }
            _TouchInput_onRightButtonDown_PD.apply(this, arguments);
        };
        TouchInput._onMouseMove = function(event) {
            _TouchInput_onMouseMove_PD.apply(this, arguments);
            if (isPlayerDrawingActive() && PD._rightButtonState.pressed) {
                updateRightButtonStateFromEvent(event);
                event.preventDefault();
            }
        };
        TouchInput._onMouseUp = function(event) {
            if (isPlayerDrawingActive() && event.button === 2) {
                updateRightButtonStateFromEvent(event);
                resetRightButtonState();
                event.preventDefault();
                return;
            }
            _TouchInput_onMouseUp_PD.apply(this, arguments);
        };
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('contextmenu', function(event) {
                if (!isPlayerDrawingActive()) return;
                event.preventDefault();
            });
        }
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('blur', function() {
                resetRightButtonState();
            });
        }
    }

    ensureShortcutQueue();
    PD._lastPadShortcut = PD._lastPadShortcut || {};

    if (!PD._shortcutListenerReady && typeof document !== 'undefined' && document.addEventListener) {
        PD._shortcutListenerReady = true;
        document.addEventListener('keydown', function(event) {
            if (!isPlayerDrawingActive()) return;
            if (event.altKey || event.metaKey) return;
            var key = String(event.key || '').toLowerCase();
            if (event.ctrlKey) {
                if (event.repeat) return;
                if (key === 'z') {
                    queueKeyboardShortcut('undo', event);
                } else if (key === 'y') {
                    queueKeyboardShortcut('redo', event);
                }
                return;
            }
            if (key === 'arrowup' || key === 'w') {
                queueKeyboardShortcut('toolbarPrev', event);
            } else if (key === 'arrowdown' || key === 's') {
                queueKeyboardShortcut('toolbarNext', event);
            } else if (key === 'q') {
                queueKeyboardShortcut('brushSmaller', event);
            } else if (key === 'e') {
                queueKeyboardShortcut('brushLarger', event);
            }
        });
    }

    function consumeKeyboardShortcut(name) {
        if (!PD._shortcutQueue || !PD._shortcutQueue[name]) return false;
        PD._shortcutQueue[name] = false;
        return true;
    }

    function isAnyGamepadButtonPressed(buttonIds) {
        var states = Input && Input._gamepadStates;
        if (!states) return false;
        for (var i = 0; i < states.length; i++) {
            var state = states[i];
            if (!state) continue;
            for (var j = 0; j < buttonIds.length; j++) {
                if (state[buttonIds[j]]) return true;
            }
        }
        return false;
    }

    function isGamepadButtonTriggered(name, buttonIds) {
        var pressed = isAnyGamepadButtonPressed(buttonIds);
        var last = !!PD._lastPadShortcut[name];
        PD._lastPadShortcut[name] = pressed;
        return pressed && !last;
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

    function markYuraSpriteBitmapChanged(sprite, bitmap) {
        markBitmapDirty(bitmap);
        if (!sprite || !sprite._meshSprite) return;
        if (sprite._yuraDirect) {
            if (sprite._meshSprite._bitmap !== bitmap ||
                    !sprite._meshSprite.texture ||
                    sprite._meshSprite.texture.baseTexture !== bitmap._baseTexture) {
                sprite._meshSprite._bitmap = bitmap;
                sprite._meshSprite.texture = new PIXI.Texture(bitmap._baseTexture);
                sprite._meshSprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            }
            sprite._meshSprite._meshDirty = true;
            if (sprite._meshSprite.updateMesh) sprite._meshSprite.updateMesh();
            return;
        }
        sprite._lastFrame = null;
        sprite._meshSprite._meshDirty = true;
        sprite._meshSprite._lastPattern = null;
        sprite._meshSprite._lastMeshStep = null;
    }

    function beginWindowContentsRefresh(win) {
        if (win.refreshYurayura) win.refreshYurayura();
        win.contents.clear();
    }

    function endWindowContentsRefresh(win) {
        markBitmapDirty(win.contents);
        markYuraSpriteDirty(win._windowContentsSprite);
    }

    function dirtyBounds(x, y) {
        return { minX: x, minY: y, maxX: x, maxY: y };
    }

    function addDirtyPoint(bounds, x, y) {
        if (!bounds) return dirtyBounds(x, y);
        if (x < bounds.minX) bounds.minX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y > bounds.maxY) bounds.maxY = y;
        return bounds;
    }

    function mergeDirtyBounds(a, b) {
        if (!b) return a || null;
        if (!a) return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
        addDirtyPoint(a, b.minX, b.minY);
        addDirtyPoint(a, b.maxX, b.maxY);
        return a;
    }

    function DrawingDocument(entry) {
        this.initialize(entry);
    }

    DrawingDocument.prototype.initialize = function(entry) {
        this.width = DOC_W;
        this.height = DOC_H;
        this.background = normalizeBackground(entry && entry.background);
        this.pixels = new Uint8Array(this.width * this.height);
        this._undoStack = [];
        this._redoStack = [];
        this._pendingSnapshot = null;
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
        value = normalizePixelValue(value);
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
        this.background = normalizeBackground(snapshot.background);
        this.unpack(snapshot.pixels);
    };

    DrawingDocument.prototype.pushHistory = function(stack, snapshot) {
        stack.push(snapshot);
        while (stack.length > HISTORY_LIMIT) stack.shift();
    };

    DrawingDocument.prototype.beginOperation = function() {
        if (!this._pendingSnapshot) this._pendingSnapshot = this.snapshot();
    };

    DrawingDocument.prototype.commitOperation = function() {
        if (!this._pendingSnapshot) return false;
        this.pushHistory(this._undoStack, this._pendingSnapshot);
        this._pendingSnapshot = null;
        this._redoStack.length = 0;
        return true;
    };

    DrawingDocument.prototype.cancelOperation = function() {
        this._pendingSnapshot = null;
    };

    DrawingDocument.prototype.canUndo = function() {
        return this._undoStack.length > 0;
    };

    DrawingDocument.prototype.canRedo = function() {
        return this._redoStack.length > 0;
    };

    DrawingDocument.prototype.hasPixels = function() {
        for (var i = 0; i < this.pixels.length; i++) {
            if (this.pixels[i] !== PIXEL_TRANSPARENT) return true;
        }
        return false;
    };

    DrawingDocument.prototype.undo = function() {
        if (!this.canUndo()) return false;
        this.cancelOperation();
        var now = this.snapshot();
        var previous = this._undoStack.pop();
        this.pushHistory(this._redoStack, now);
        this.restore(previous);
        return true;
    };

    DrawingDocument.prototype.redo = function() {
        if (!this.canRedo()) return false;
        this.cancelOperation();
        var now = this.snapshot();
        var next = this._redoStack.pop();
        this.pushHistory(this._undoStack, now);
        this.restore(next);
        return true;
    };

    DrawingDocument.prototype.brushBounds = function(cx, cy, size, value) {
        size = clampInt(size, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
        var bounds = null;
        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                var px = cx + x;
                var py = cy + y;
                if (this.set(px, py, value)) bounds = addDirtyPoint(bounds, px, py);
            }
        }
        return bounds;
    };

    DrawingDocument.prototype.fillBounds = function(x, y, value) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
        value = normalizePixelValue(value);
        var target = this.get(x, y);
        if (target === value) return null;
        var queueX = [x];
        var queueY = [y];
        var bounds = dirtyBounds(x, y);
        this.set(x, y, value);
        while (queueX.length) {
            var px = queueX.pop();
            var py = queueY.pop();
            bounds = this.pushFillNeighbor(queueX, queueY, bounds, px + 1, py, target, value);
            bounds = this.pushFillNeighbor(queueX, queueY, bounds, px - 1, py, target, value);
            bounds = this.pushFillNeighbor(queueX, queueY, bounds, px, py + 1, target, value);
            bounds = this.pushFillNeighbor(queueX, queueY, bounds, px, py - 1, target, value);
        }
        return bounds;
    };

    DrawingDocument.prototype.pushFillNeighbor = function(queueX, queueY, bounds, x, y, target, value) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return bounds;
        if (this.get(x, y) !== target) return bounds;
        this.set(x, y, value);
        queueX.push(x);
        queueY.push(y);
        return addDirtyPoint(bounds, x, y);
    };

    DrawingDocument.prototype.fill = function(x, y, value) {
        return !!this.fillBounds(x, y, value);
    };

    DrawingDocument.prototype.clear = function() {
        if (!this.hasPixels()) return false;
        this.pixels.fill(PIXEL_TRANSPARENT);
        return true;
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
        if (!entry) this.doc.background = normalizeBackground(options.background);
        this.tool = isDrawingTool(options.tool) ? options.tool : 'pen';
        this.toolbarIndex = Math.max(0, toolbarIndexForKey(this.tool));
        this.color = options.color === BACKGROUND_WHITE ? PIXEL_WHITE : PIXEL_BLACK;
        this.penSize = clampInt(options.penSize || options.size || 2, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
        this.eraserSize = clampInt(options.eraserSize || options.size || 2, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
        this.showCancelButton = booleanOption(
                options.showCancelButton != null ? options.showCancelButton : options.cancelButton,
                false);
        this.promptText = optionText(options, ['promptText', 'guideText', 'titleText', 'prompt']);
        this._painting = false;
        this._changedInOperation = false;
        this._lastPixel = null;
        this._strokeSeWait = 0;
        this._strokeSeLastPoint = null;
    };

    DrawingEditor.prototype.paintValue = function() {
        return this.tool === 'eraser' ? PIXEL_TRANSPARENT : this.color;
    };

    DrawingEditor.prototype.setTool = function(tool) {
        if (!isDrawingTool(tool)) return false;
        this.tool = tool;
        var index = toolbarIndexForKey(tool);
        if (index >= 0) this.toolbarIndex = index;
        return true;
    };

    DrawingEditor.prototype.setToolbarIndex = function(index) {
        index = clampInt(index, 0, TOOLBAR_BUTTONS.length - 1);
        this.toolbarIndex = index;
        var button = TOOLBAR_BUTTONS[index];
        if (button && button.type === 'tool') this.setTool(button.key);
    };

    DrawingEditor.prototype.toolbarCommand = function() {
        return toolbarCommandForButton(TOOLBAR_BUTTONS[this.toolbarIndex]);
    };

    DrawingEditor.prototype.toolbarButton = function() {
        return TOOLBAR_BUTTONS[this.toolbarIndex] || null;
    };

    DrawingEditor.prototype.toggleColor = function() {
        this.color = this.color === PIXEL_BLACK ? PIXEL_WHITE : PIXEL_BLACK;
    };

    DrawingEditor.prototype.selectedBrushSizeTool = function() {
        var button = this.toolbarButton();
        return button && isBrushTool(button.key) ? button.key : '';
    };

    DrawingEditor.prototype.brushSize = function() {
        return this.tool === 'eraser' ? this.eraserSize : this.penSize;
    };

    DrawingEditor.prototype.setBrushSize = function(size) {
        size = clampInt(size, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
        if (this.tool === 'eraser') this.eraserSize = size;
        else this.penSize = size;
    };

    DrawingEditor.prototype.nudgeBrushSize = function(delta) {
        var next = clampInt(this.brushSize() + delta, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX);
        if (next === this.brushSize()) return false;
        this.setBrushSize(next);
        return true;
    };

    DrawingEditor.prototype.beginDraw = function() {
        this.doc.beginOperation();
        this._changedInOperation = false;
        this.resetStrokeSe();
    };

    DrawingEditor.prototype.finishDraw = function() {
        if (this._changedInOperation) this.doc.commitOperation();
        else this.doc.cancelOperation();
        this._painting = false;
        this._lastPixel = null;
        this.resetStrokeSe();
    };

    DrawingEditor.prototype.usesStrokeSe = function() {
        return isBrushTool(this.tool);
    };

    DrawingEditor.prototype.resetStrokeSe = function() {
        this._strokeSeWait = 0;
        this._strokeSeLastPoint = null;
    };

    DrawingEditor.prototype.setStrokeSePoint = function(x, y) {
        this._strokeSeLastPoint = { x: x, y: y };
    };

    DrawingEditor.prototype.strokeSeMoved = function(x, y) {
        var last = this._strokeSeLastPoint;
        this._strokeSeLastPoint = { x: x, y: y };
        if (!last) return false;
        return Math.abs(x - last.x) >= 1 || Math.abs(y - last.y) >= 1;
    };

    DrawingEditor.prototype.playStrokeSeIfMoving = function(x, y) {
        if (!this.usesStrokeSe()) return;
        if (!this.strokeSeMoved(x, y)) return;
        if (this._strokeSeWait > 0) {
            this._strokeSeWait--;
            return;
        }
        playPlayerDrawingStrokeSe(this.tool);
        this._strokeSeWait = STROKE_SE_INTERVAL;
    };

    DrawingEditor.prototype.drawAt = function(x, y) {
        var bounds = this.doc.brushBounds(x, y, this.brushSize(), this.paintValue());
        this._changedInOperation = this._changedInOperation || !!bounds;
        return bounds;
    };

    DrawingEditor.prototype.drawLine = function(from, to) {
        if (!from) return this.drawAt(to.x, to.y);
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
        var bounds = null;
        for (var i = 0; i <= steps; i++) {
            var x = Math.round(from.x + dx * i / steps);
            var y = Math.round(from.y + dy * i / steps);
            bounds = mergeDirtyBounds(bounds, this.drawAt(x, y));
        }
        return bounds;
    };

    DrawingEditor.prototype.save = function() {
        var name = this.options.name || '';
        if (this.sourceId && this.options.overwrite) {
            PD.updateEntry(this.sourceId, this.doc.toEntry(this.sourceId, name));
            return this.sourceId;
        }
        return PD.createEntry(this.doc, name);
    };

    function createTransparentHatchPattern(ctx, dense) {
        var patternCanvas = document.createElement('canvas');
        patternCanvas.width = 8;
        patternCanvas.height = 8;
        var pctx = patternCanvas.getContext('2d');
        pctx.strokeStyle = TRANSPARENT_HATCH_COLOR;
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.moveTo(8, 0);
        pctx.lineTo(0, 8);
        if (dense) {
            pctx.moveTo(4, 0);
            pctx.lineTo(0, 4);
            pctx.moveTo(8, 4);
            pctx.lineTo(4, 8);
        }
        pctx.stroke();
        return ctx.createPattern(patternCanvas, 'repeat');
    }

    function transparentPreviewPatterns(bitmap, ctx) {
        if (bitmap && bitmap._pdTransparentPreviewPatterns) return bitmap._pdTransparentPreviewPatterns;
        var patterns = {
            sparse: createTransparentHatchPattern(ctx, false),
            dense: createTransparentHatchPattern(ctx, true)
        };
        if (bitmap) bitmap._pdTransparentPreviewPatterns = patterns;
        return patterns;
    }

    function transparentPreviewCellSize(w, scale) {
        return Math.max(scale, Math.floor(w / TRANSPARENT_CHECKER_CELLS));
    }

    function fillTransparentPreviewRegion(ctx, w, h, scale, bitmap, x, y, width, height) {
        if (width <= 0 || height <= 0) return;
        var cell = transparentPreviewCellSize(w, scale);
        var patterns = transparentPreviewPatterns(bitmap, ctx);
        var right = Math.min(w, x + width);
        var bottom = Math.min(h, y + height);
        var startX = Math.floor(x / cell) * cell;
        var startY = Math.floor(y / cell) * cell;
        ctx.fillStyle = WHITE_COLOR;
        ctx.fillRect(x, y, width, height);
        for (var cy = startY; cy < bottom; cy += cell) {
            for (var cx = startX; cx < right; cx += cell) {
                var rx = Math.max(x, cx);
                var ry = Math.max(y, cy);
                var rw = Math.min(right, cx + cell) - rx;
                var rh = Math.min(bottom, cy + cell) - ry;
                if (rw <= 0 || rh <= 0) continue;
                ctx.fillStyle = (((cx / cell + cy / cell) & 1) === 0) ? patterns.dense : patterns.sparse;
                ctx.fillRect(rx, ry, rw, rh);
            }
        }
    }

    function fillTransparentPreviewBackground(ctx, w, h, scale, bitmap) {
        fillTransparentPreviewRegion(ctx, w, h, scale, bitmap, 0, 0, w, h);
    }

    function fillDisplayCellRegion(ctx, bitmap, doc, scale, value, x, y, width, height) {
        if (width <= 0 || height <= 0) return;
        if (value === PIXEL_BLACK) {
            ctx.fillStyle = GAME_BLACK_COLOR;
            ctx.fillRect(x, y, width, height);
        } else if (value === PIXEL_WHITE || doc.background === BACKGROUND_WHITE) {
            ctx.fillStyle = WHITE_COLOR;
            ctx.fillRect(x, y, width, height);
        } else {
            fillTransparentPreviewRegion(ctx, doc.width * scale, doc.height * scale, scale, bitmap, x, y, width, height);
        }
    }

    function paintDocumentBackground(bitmap, doc, scale, rect) {
        var ctx = bitmap._context;
        var w = doc.width * scale;
        var h = doc.height * scale;
        if (rect) {
            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
            ctx.clip();
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
        } else {
            ctx.clearRect(0, 0, bitmap.width, bitmap.height);
        }
        if (doc.background === BACKGROUND_WHITE) {
            ctx.fillStyle = WHITE_COLOR;
            if (rect) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            else ctx.fillRect(0, 0, w, h);
        } else {
            fillTransparentPreviewBackground(ctx, w, h, scale, bitmap);
        }
    }

    function displayPixelAt(doc, x, y) {
        var value = PIXEL_TRANSPARENT;
        if (x >= 0 && y >= 0 && x < doc.width && y < doc.height) {
            value = doc.pixels[y * doc.width + x];
        }
        return value === PIXEL_TRANSPARENT && doc.background === BACKGROUND_WHITE ? PIXEL_WHITE : value;
    }

    function paintDocumentBasePixels(bitmap, doc, scale, minX, minY, maxX, maxY) {
        var ctx = bitmap._context;
        var pixels = doc.pixels;
        var docW = doc.width;
        for (var y = minY; y <= maxY; y++) {
            var row = y * docW;
            var runX = minX;
            var runValue = PIXEL_TRANSPARENT;
            for (var x = minX; x <= maxX + 1; x++) {
                var value = x <= maxX ? pixels[row + x] : PIXEL_TRANSPARENT;
                if (value === runValue) continue;
                if (runValue !== PIXEL_TRANSPARENT) {
                    fillDisplayCellRegion(ctx, bitmap, doc, scale, runValue,
                            runX * scale, y * scale, (x - runX) * scale, scale);
                }
                runX = x;
                runValue = value;
            }
        }
    }

    function paintDocumentPixels(bitmap, doc, scale, minX, minY, maxX, maxY) {
        paintDocumentBasePixels(bitmap, doc, scale, minX, minY, maxX, maxY);
        paintDocumentCornerCuts(bitmap, doc, scale, minX, minY, maxX, maxY);
        paintDocumentDiagonalBridges(bitmap, doc, scale, minX, minY, maxX, maxY);
    }

    function displayCornerRadius(scale) {
        return Math.max(1, Math.min(Math.floor(scale / 2), Math.floor(scale / 3)));
    }

    function displayCornerCutValue(doc, x, y, dx, dy) {
        var value = displayPixelAt(doc, x, y);
        var vertical = displayPixelAt(doc, x, y + dy);
        var horizontal = displayPixelAt(doc, x + dx, y);
        var diagonal = displayPixelAt(doc, x + dx, y + dy);
        if (vertical !== horizontal) return -1;
        if (vertical === value) return -1;
        if (diagonal === value) return -1;
        return vertical;
    }

    function paintDisplayCornerCut(ctx, bitmap, doc, scale, radius, x, y, dx, dy, value) {
        var px = x * scale;
        var py = y * scale;
        for (var i = 0; i < radius; i++) {
            var row = dy < 0 ? i : scale - radius + i;
            var width = dy < 0 ? radius - i : i + 1;
            var left = dx < 0 ? 0 : scale - width;
            fillDisplayCellRegion(ctx, bitmap, doc, scale, value, px + left, py + row, width, 1);
        }
    }

    function paintDocumentCornerCuts(bitmap, doc, scale, minX, minY, maxX, maxY) {
        var ctx = bitmap._context;
        var corners = DISPLAY_CORNERS;
        var radius = displayCornerRadius(scale);
        for (var y = minY; y <= maxY; y++) {
            for (var x = minX; x <= maxX; x++) {
                for (var i = 0; i < corners.length; i++) {
                    var corner = corners[i];
                    var value = displayCornerCutValue(doc, x, y, corner.dx, corner.dy);
                    if (value >= 0) paintDisplayCornerCut(ctx, bitmap, doc, scale, radius, x, y, corner.dx, corner.dy, value);
                }
            }
        }
    }

    function isDisplayBridgeValue(value) {
        return value === PIXEL_BLACK || value === PIXEL_WHITE;
    }

    function displayNeighborScore(doc, x, y, value) {
        var score = 0;
        if (displayPixelAt(doc, x, y - 1) === value) score++;
        if (displayPixelAt(doc, x, y + 1) === value) score++;
        if (displayPixelAt(doc, x - 1, y) === value) score++;
        if (displayPixelAt(doc, x + 1, y) === value) score++;
        return score;
    }

    function diagonalBridgeCandidateScore(doc, x1, y1, x2, y2, value, otherA, otherB) {
        if (!isDisplayBridgeValue(value)) return -1;
        if (otherA === value || otherB === value) return -1;
        return displayNeighborScore(doc, x1, y1, value) + displayNeighborScore(doc, x2, y2, value);
    }

    function displayDiagonalBridgeValue(doc, x, y) {
        var nw = displayPixelAt(doc, x, y);
        var ne = displayPixelAt(doc, x + 1, y);
        var sw = displayPixelAt(doc, x, y + 1);
        var se = displayPixelAt(doc, x + 1, y + 1);
        var downRightScore = nw === se ? diagonalBridgeCandidateScore(doc, x, y, x + 1, y + 1, nw, ne, sw) : -1;
        var downLeftScore = ne === sw ? diagonalBridgeCandidateScore(doc, x + 1, y, x, y + 1, ne, nw, se) : -1;
        if (downRightScore >= 0 && downLeftScore >= 0) {
            if (downRightScore === downLeftScore) return -1;
            return downRightScore < downLeftScore ? nw : ne;
        }
        if (downRightScore >= 0) return nw;
        if (downLeftScore >= 0) return ne;
        return -1;
    }

    function paintDocumentDiagonalBridges(bitmap, doc, scale, minX, minY, maxX, maxY) {
        var ctx = bitmap._context;
        var size = Math.max(1, Math.min(DISPLAY_DIAGONAL_BRIDGE_SIZE, Math.floor(scale)));
        var offset = Math.floor(size / 2);
        for (var y = minY; y < maxY; y++) {
            for (var x = minX; x < maxX; x++) {
                var value = displayDiagonalBridgeValue(doc, x, y);
                if (value < 0) continue;
                fillDisplayCellRegion(ctx, bitmap, doc, scale, value,
                        (x + 1) * scale - offset, (y + 1) * scale - offset, size, size);
            }
        }
    }

    function drawDocumentRegionToBitmap(bitmap, doc, scale, bounds) {
        bitmap.smooth = false;
        var ctx = bitmap._context;
        var minX = clampInt(bounds.minX - DISPLAY_UPDATE_MARGIN, 0, doc.width - 1);
        var minY = clampInt(bounds.minY - DISPLAY_UPDATE_MARGIN, 0, doc.height - 1);
        var maxX = clampInt(bounds.maxX + DISPLAY_UPDATE_MARGIN, 0, doc.width - 1);
        var maxY = clampInt(bounds.maxY + DISPLAY_UPDATE_MARGIN, 0, doc.height - 1);
        if (maxX < minX || maxY < minY) return;
        var rect = {
            x: minX * scale,
            y: minY * scale,
            width: (maxX - minX + 1) * scale,
            height: (maxY - minY + 1) * scale
        };
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        paintDocumentBackground(bitmap, doc, scale, rect);
        paintDocumentPixels(bitmap, doc, scale, minX, minY, maxX, maxY);
        ctx.restore();
        markBitmapDirty(bitmap);
    }

    function drawDocumentToBitmap(bitmap, doc, scale) {
        bitmap.smooth = false;
        var ctx = bitmap._context;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        paintDocumentBackground(bitmap, doc, scale, null);
        paintDocumentPixels(bitmap, doc, scale, 0, 0, doc.width - 1, doc.height - 1);
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
        if (doc.background === BACKGROUND_WHITE) {
            ctx.fillStyle = WHITE_COLOR;
            ctx.fillRect(0, 0, size, size);
        }
        for (var y = 0; y < doc.height; y++) {
            for (var x = 0; x < doc.width; x++) {
                var value = doc.get(x, y);
                if (value === PIXEL_TRANSPARENT) continue;
                ctx.fillStyle = pixelCss(value);
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

    PD.itemDrawingId = function(itemOrId) {
        var store = ensureStore();
        if (!store || !store.itemImages) return 0;
        var key = itemRegisterKey(itemOrId);
        return key ? Number(store.itemImages[key] || 0) : 0;
    };

    PD.registerItemImage = function(itemOrId, drawingId) {
        var store = ensureStore();
        var key = itemRegisterKey(itemOrId);
        drawingId = Number(drawingId || 0);
        if (!store || !key || !drawingId || !this.entry(drawingId)) {
            warnPlayerDrawing('registerItemImage failed.', { item: itemOrId, drawingId: drawingId });
            return false;
        }
        store.itemImages[key] = drawingId;
        refreshPlayerDrawingItemEvents(itemOrId);
        return true;
    };

    PD.unregisterItemImage = function(itemOrId) {
        var store = ensureStore();
        var key = itemRegisterKey(itemOrId);
        if (!store || !key || !store.itemImages || !store.itemImages[key]) return false;
        delete store.itemImages[key];
        refreshPlayerDrawingItemEvents(itemOrId);
        return true;
    };

    PD.itemImageInfo = function(itemOrId) {
        var item = resolveItem(itemOrId);
        var drawingId = this.itemDrawingId(item);
        if (drawingId) {
            return {
                name: this.drawingName(drawingId),
                index: 0,
                drawingId: drawingId,
                playerDrawing: true
            };
        }
        if (!item || !item.meta || !item.meta.image) return null;
        var parts = String(item.meta.image).split(',');
        return {
            name: parts[0] || '',
            index: Number(parts[1] || 0),
            drawingId: 0,
            playerDrawing: false
        };
    };

    PD.loadItemImageBitmap = function(imageInfo) {
        if (imageInfo && imageInfo.playerDrawing) {
            return this.loadBitmap(imageInfo.drawingId, { size: OUTPUT_SIZE });
        }
        return ImageManager.loadItem(imageInfo ? imageInfo.name || '' : '');
    };

    PD.itemImageFrame = function(bitmap, imageInfo) {
        if (!bitmap) return { x: 0, y: 0, width: 0, height: 0 };
        if (imageInfo && imageInfo.playerDrawing) {
            return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
        }
        var index = Number(imageInfo && imageInfo.index || 0);
        var pw = bitmap.width / 4;
        var ph = bitmap.height / 2;
        return {
            x: (index % 4) * pw,
            y: Math.floor(index / 4) * ph,
            width: pw,
            height: ph
        };
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

    function Window_PlayerDrawingPrompt() {
        this.initialize.apply(this, arguments);
    }

    Window_PlayerDrawingPrompt.prototype = Object.create(Window_Base.prototype);
    Window_PlayerDrawingPrompt.prototype.constructor = Window_PlayerDrawingPrompt;

    Window_PlayerDrawingPrompt.prototype.initialize = function(editor, x, y, width) {
        this._editor = editor;
        Window_Base.prototype.initialize.call(this, x, y, width, this.fittingHeight(1));
        this.refresh();
    };

    Window_PlayerDrawingPrompt.prototype.text = function() {
        return String(this._editor.promptText || '').replace(/[\r\n]+/g, ' ');
    };

    Window_PlayerDrawingPrompt.prototype.refresh = function() {
        beginWindowContentsRefresh(this);
        var text = this.text();
        if (text) {
            var x = this.textPadding();
            var width = Math.max(1, this.contents.width - x * 2);
            this.resetFontSettings();
            while (this.contents.fontSize > PROMPT_MIN_FONT_SIZE && this.textWidth(text) > width) {
                this.contents.fontSize--;
            }
            this.drawText(text, x, 0, width, 'center');
        }
        endWindowContentsRefresh(this);
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
        if (this._windowContentsSprite) {
            this._windowContentsSprite._yuraDirect = true;
            this._windowContentsSprite._yuraLockGeometry = true;
        }
        this.refresh();
    };

    Window_PlayerDrawingCanvas.prototype.refresh = function() {
        if (this.refreshYurayura) this.refreshYurayura();
        drawDocumentToBitmap(this.contents, this._editor.doc, DISPLAY_SCALE);
        markYuraSpriteDirty(this._windowContentsSprite);
    };

    Window_PlayerDrawingCanvas.prototype.drawingBitmap = function() {
        return this._windowContentsSprite && this._windowContentsSprite._baseBitmap ?
                this._windowContentsSprite._baseBitmap : this.contents;
    };

    Window_PlayerDrawingCanvas.prototype.refreshDirty = function(bounds) {
        if (!bounds) return;
        var bitmap = this.drawingBitmap();
        drawDocumentRegionToBitmap(bitmap, this._editor.doc, DISPLAY_SCALE, bounds);
        markYuraSpriteBitmapChanged(this._windowContentsSprite, bitmap);
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

    Window_PlayerDrawingToolbar.prototype = Object.create(Window_Base.prototype);
    Window_PlayerDrawingToolbar.prototype.constructor = Window_PlayerDrawingToolbar;

    Window_PlayerDrawingToolbar.prototype.initialize = function(editor, x, y, height) {
        this._editor = editor;
        this._iconBitmap = ImageManager.loadSystem(TOOL_ICON_BITMAP);
        Window_Base.prototype.initialize.call(this, x, y, TOOLBAR_W, height);
        if (this._iconBitmap && this._iconBitmap.addLoadListener) {
            this._iconBitmap.addLoadListener(this.refresh.bind(this));
        }
        this.refresh();
    };

    Window_PlayerDrawingToolbar.prototype.refreshState = function() {
        this.refresh();
    };

    Window_PlayerDrawingToolbar.prototype.buttonRect = function(index) {
        return {
            x: 0,
            y: index * (TOOL_BUTTON_SIZE + TOOL_BUTTON_GAP),
            width: TOOL_BUTTON_SIZE,
            height: TOOL_BUTTON_SIZE
        };
    };

    Window_PlayerDrawingToolbar.prototype.sizeRect = function(size) {
        var tool = this._editor.selectedBrushSizeTool();
        var index = DRAWING_TOOL_KEYS.indexOf(tool);
        if (index < 0) return null;
        return {
            x: TOOL_BUTTON_SIZE + 10,
            y: index * (TOOL_BUTTON_SIZE + TOOL_BUTTON_GAP) + SIZE_SELECT_OUTSET + (size - 1) * (SIZE_BUTTON_SIZE + SIZE_BUTTON_GAP),
            width: SIZE_BUTTON_SIZE,
            height: SIZE_BUTTON_SIZE
        };
    };

    Window_PlayerDrawingToolbar.prototype.consumeTriggeredAction = function() {
        var point = triggeredContentsPoint(this, true);
        if (!point) return null;
        for (var s = BRUSH_SIZE_MIN; s <= BRUSH_SIZE_MAX; s++) {
            if (rectContains(this.sizeRect(s), point.x, point.y)) {
                return { key: 'size_' + s };
            }
        }
        for (var i = 0; i < TOOLBAR_BUTTONS.length; i++) {
            var button = TOOLBAR_BUTTONS[i];
            if (rectContains(this.buttonRect(i), point.x, point.y)) {
                return {
                    key: toolbarCommandForButton(button),
                    toolbarIndex: i,
                    buttonType: button.type
                };
            }
        }
        return null;
    };

    Window_PlayerDrawingToolbar.prototype.drawButtonFrame = function(rect, active) {
        var ctx = this.contents._context;
        ctx.save();
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeStyle = active ? WHITE_COLOR : 'rgba(255,255,255,0.45)';
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
        ctx.restore();
    };

    Window_PlayerDrawingToolbar.prototype.drawIcon = function(iconIndex, x, y, selected) {
        if (!this._iconBitmap || !this._iconBitmap.isReady || !this._iconBitmap.isReady()) return;
        var sy = selected && this._iconBitmap.height >= TOOL_ICON_SIZE * 2 ? TOOL_ICON_SIZE : 0;
        this.contents.blt(this._iconBitmap, iconIndex * TOOL_ICON_SIZE, sy, TOOL_ICON_SIZE, TOOL_ICON_SIZE, x, y);
    };

    Window_PlayerDrawingToolbar.prototype.drawToolButtons = function() {
        for (var i = 0; i < TOOLBAR_BUTTONS.length; i++) {
            var button = TOOLBAR_BUTTONS[i];
            var rect = this.buttonRect(i);
            var active = i === this._editor.toolbarIndex;
            this.drawButtonFrame(rect, active);
            this.drawIcon(button.icon, rect.x + TOOL_ICON_OFFSET, rect.y + TOOL_ICON_OFFSET, active);
        }
    };

    Window_PlayerDrawingToolbar.prototype.drawSizePanel = function() {
        var tool = this._editor.selectedBrushSizeTool();
        if (!tool) return;
        var current = tool === 'eraser' ? this._editor.eraserSize : this._editor.penSize;
        var inverted = tool === 'pen' && this._editor.color === PIXEL_BLACK;
        var fillColor = inverted ? WHITE_COLOR : GAME_BLACK_COLOR;
        var markColor = inverted ? GAME_BLACK_COLOR : WHITE_COLOR;
        var ctx = this.contents._context;
        for (var size = BRUSH_SIZE_MIN; size <= BRUSH_SIZE_MAX; size++) {
            var rect = this.sizeRect(size);
            var active = size === current;
            ctx.save();
            if (active) {
                var outerX = rect.x - SIZE_SELECT_OUTSET;
                var outerY = rect.y - SIZE_SELECT_OUTSET;
                var outerW = rect.width + SIZE_SELECT_OUTSET * 2;
                var outerH = rect.height + SIZE_SELECT_OUTSET * 2;
                ctx.fillStyle = GAME_BLACK_COLOR;
                ctx.fillRect(outerX, outerY, outerW, SIZE_SELECT_BORDER);
                ctx.fillRect(outerX, outerY + outerH - SIZE_SELECT_BORDER, outerW, SIZE_SELECT_BORDER);
                ctx.fillRect(outerX, outerY, SIZE_SELECT_BORDER, outerH);
                ctx.fillRect(outerX + outerW - SIZE_SELECT_BORDER, outerY, SIZE_SELECT_BORDER, outerH);
            }
            ctx.fillStyle = fillColor;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            if (!inverted) {
                ctx.strokeStyle = active ? GAME_BLACK_COLOR : 'rgba(255,255,255,0.45)';
                ctx.lineWidth = active ? 2 : 1;
                ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
            }
            ctx.fillStyle = markColor;
            var dot = size * 4;
            ctx.fillRect(rect.x + Math.floor((rect.width - dot) / 2), rect.y + Math.floor((rect.height - dot) / 2), dot, dot);
            ctx.restore();
        }
    };

    Window_PlayerDrawingToolbar.prototype.refresh = function() {
        beginWindowContentsRefresh(this);
        this.drawToolButtons();
        this.drawSizePanel();
        endWindowContentsRefresh(this);
    };

    function Window_PlayerDrawingColor() {
        this.initialize.apply(this, arguments);
    }

    Window_PlayerDrawingColor.prototype = Object.create(Window_Base.prototype);
    Window_PlayerDrawingColor.prototype.constructor = Window_PlayerDrawingColor;

    Window_PlayerDrawingColor.prototype.standardPadding = function() {
        return 0;
    };

    Window_PlayerDrawingColor.prototype.initialize = function(editor, x, y) {
        this._editor = editor;
        Window_Base.prototype.initialize.call(this, x, y, COLOR_WINDOW_W, COLOR_WINDOW_H);
        this.hideChrome();
        this.refresh();
    };

    Window_PlayerDrawingColor.prototype.hideChrome = function() {
        this.opacity = 0;
        this.backOpacity = 0;
        if (this._windowFrameSprite) this._windowFrameSprite.visible = false;
        if (this._windowBackSprite) this._windowBackSprite.visible = false;
    };

    Window_PlayerDrawingColor.prototype.consumeTriggeredAction = function() {
        var point = triggeredContentsPoint(this, false);
        if (!point) return null;
        return { key: 'color' };
    };

    Window_PlayerDrawingColor.prototype.drawSwatch = function(rect, color) {
        var ctx = this.contents._context;
        ctx.fillStyle = TECH_BLACK_COLOR;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = color;
        ctx.fillRect(
            rect.x + COLOR_BLACK_BORDER,
            rect.y + COLOR_BLACK_BORDER,
            rect.width - COLOR_BLACK_BORDER * 2,
            rect.height - COLOR_BLACK_BORDER * 2
        );
    };

    Window_PlayerDrawingColor.prototype.refresh = function() {
        if (this.refreshYurayura) this.refreshYurayura();
        this.hideChrome();
        this.contents.clear();
        var current = this._editor.color;
        var other = current === PIXEL_BLACK ? PIXEL_WHITE : PIXEL_BLACK;
        var big = { x: 22, y: 4, width: COLOR_BIG_SIZE, height: COLOR_BIG_SIZE };
        var small = { x: 8, y: 26, width: COLOR_SMALL_SIZE, height: COLOR_SMALL_SIZE };
        var ctx = this.contents._context;
        ctx.save();
        ctx.fillStyle = WHITE_COLOR;
        ctx.fillRect(
            big.x - COLOR_WHITE_BORDER,
            big.y - COLOR_WHITE_BORDER,
            big.width + COLOR_WHITE_BORDER * 2,
            big.height + COLOR_WHITE_BORDER * 2
        );
        ctx.fillRect(
            small.x - COLOR_WHITE_BORDER,
            small.y - COLOR_WHITE_BORDER,
            small.width + COLOR_WHITE_BORDER * 2,
            small.height + COLOR_WHITE_BORDER * 2
        );
        this.drawSwatch(small, pixelCss(other));
        this.drawSwatch(big, pixelCss(current));
        ctx.restore();
        endWindowContentsRefresh(this);
    };

    function Window_PlayerDrawingConfirm() {
        this.initialize.apply(this, arguments);
    }

    Window_PlayerDrawingConfirm.prototype = Object.create(Window_Base.prototype);
    Window_PlayerDrawingConfirm.prototype.constructor = Window_PlayerDrawingConfirm;

    Window_PlayerDrawingConfirm.prototype.initialize = function(editor, x, y) {
        this._editor = editor;
        this._iconBitmap = ImageManager.loadSystem(TOOL_ICON_BITMAP);
        Window_Base.prototype.initialize.call(this, x, y, actionWindowWidth(editor), ACTION_H);
        if (this._iconBitmap && this._iconBitmap.addLoadListener) {
            this._iconBitmap.addLoadListener(this.refresh.bind(this));
        }
        this.refresh();
    };

    Window_PlayerDrawingConfirm.prototype.buttons = function() {
        return actionButtonsForEditor(this._editor);
    };

    Window_PlayerDrawingConfirm.prototype.buttonRect = function(index) {
        return {
            x: index * (TOOL_BUTTON_SIZE + ACTION_BUTTON_GAP),
            y: 0,
            width: TOOL_BUTTON_SIZE,
            height: TOOL_BUTTON_SIZE
        };
    };

    Window_PlayerDrawingConfirm.prototype.consumeTriggeredAction = function() {
        var point = triggeredContentsPoint(this, true);
        if (!point) return null;
        var buttons = this.buttons();
        for (var i = 0; i < buttons.length; i++) {
            if (rectContains(this.buttonRect(i), point.x, point.y)) {
                return { key: buttons[i].key };
            }
        }
        return null;
    };

    Window_PlayerDrawingConfirm.prototype.refresh = function() {
        beginWindowContentsRefresh(this);
        var buttons = this.buttons();
        for (var i = 0; i < buttons.length; i++) {
            var rect = this.buttonRect(i);
            Window_PlayerDrawingToolbar.prototype.drawButtonFrame.call(this, rect, false);
            Window_PlayerDrawingToolbar.prototype.drawIcon.call(this, buttons[i].icon, rect.x + TOOL_ICON_OFFSET, rect.y + TOOL_ICON_OFFSET, false);
        }
        endWindowContentsRefresh(this);
    };

    function resolveTemplate(template, isTemplate) {
        if (template == null || template === '') return null;
        if (typeof template === 'number' || String(template).match(/^\d+$/)) return Number(template);
        var source = isTemplate ? $dataTemplateEvents : ($dataMap && $dataMap.events);
        var data = DataManager.searchDataItem ? DataManager.searchDataItem(source, 'name', String(template)) : null;
        return data ? data.id : null;
    }

    function warnPlayerDrawing(message, detail) {
        if (typeof console === 'undefined' || !console.warn) return;
        if (detail == null) {
            console.warn('[KNH_PlayerDrawing] ' + message);
        } else {
            console.warn('[KNH_PlayerDrawing] ' + message, detail);
        }
    }

    function resolveItem(itemOrId) {
        if (!itemOrId) return null;
        if (typeof itemOrId === 'object') return itemOrId;
        return $dataItems ? $dataItems[Number(itemOrId)] : null;
    }

    function itemRegisterKey(itemOrId) {
        var item = resolveItem(itemOrId);
        if (!item || !item.id || !$dataItems || $dataItems[item.id] !== item) return '';
        return String(item.id);
    }

    function refreshPlayerDrawingItemEvents(itemOrId) {
        var item = resolveItem(itemOrId);
        if (!item || !$gameMap || !$gameMap._events) return;
        var events = $gameMap._events;
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (ev && ev._item === item && ev.setItem) ev.setItem(item);
        }
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
            yura: options.yura === false ? null : (options.yura || [24, 24]),
            source: options.source || 'direct'
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

    var _Game_Event_setItem_PD = Game_Event.prototype.setItem;
    Game_Event.prototype.setItem = function(item) {
        _Game_Event_setItem_PD.apply(this, arguments);
        var drawingId = PD.itemDrawingId(item);
        if (drawingId) {
            if (this._playerDrawingImageInfo && this._playerDrawingImageInfo.source === 'direct') return;
            this.setPlayerDrawingImage(drawingId, { scale: this._scaleX || 60, source: 'item' });
        } else if (this._playerDrawingImageInfo && this._playerDrawingImageInfo.source === 'item') {
            this.clearPlayerDrawingImage();
        }
    };

    Game_Map.prototype.putPlayerDrawingItem = function(drawingId, itemOrId, x, y, num) {
        if (!drawingId) {
            warnPlayerDrawing('putPlayerDrawingItem failed: drawingId is empty.');
            return null;
        }
        var item = resolveItem(itemOrId);
        var tpl = DataManager.searchDataItem ? DataManager.searchDataItem($dataTemplateEvents, 'name', 'item') : null;
        if (!item) {
            warnPlayerDrawing('putPlayerDrawingItem failed: item not found.', itemOrId);
            return null;
        }
        if (!tpl) {
            warnPlayerDrawing('putPlayerDrawingItem failed: template event "item" not found.');
            return null;
        }
        var ev = this.spawnEvent(tpl.id, x, y, true);
        if (!ev) {
            warnPlayerDrawing('putPlayerDrawingItem failed: spawnEvent returned empty.', { templateId: tpl.id, x: x, y: y });
            return null;
        }
        ev.setItem(item);
        ev.setPlayerDrawingImage(drawingId, { scale: ev._scaleX || 60 });
        ev._itemNum = num || 1;
        this.rejudgeEvents();
        return ev;
    };

    Game_Map.prototype.spawnPlayerDrawingEvent = function(drawingId, template, x, y, options) {
        options = options || {};
        if (!drawingId) {
            warnPlayerDrawing('spawnPlayerDrawingEvent failed: drawingId is empty.');
            return null;
        }
        var isTemplate = options.isTemplate !== false;
        if (isTemplate && String(template) === 'item') {
            warnPlayerDrawing('spawnPlayerDrawingEvent failed: template "item" needs item data. Use putPlayerDrawingItem or putLastPlayerDrawingItem.');
            return null;
        }
        var templateId = resolveTemplate(template, isTemplate);
        if (!templateId) {
            warnPlayerDrawing('spawnPlayerDrawingEvent failed: template event not found.', {
                template: template,
                isTemplate: isTemplate
            });
            return null;
        }
        var ev = this.spawnEvent(templateId, x, y, isTemplate);
        if (!ev) {
            warnPlayerDrawing('spawnPlayerDrawingEvent failed: spawnEvent returned empty.', {
                templateId: templateId,
                isTemplate: isTemplate,
                x: x,
                y: y
            });
            return null;
        }
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

    Scene_Base.prototype.setupPlayerDrawingCursor = function() {
        var canvas = Graphics._canvas;
        this._pdCursorOldCanvasCursor = canvas ? canvas.style.cursor : null;
        this._pdCursorCanvasHover = Graphics.isInsideCanvas(TouchInput.x, TouchInput.y);
        this._pdCursorTool = '';
        this._pdCursorNativeHidden = false;
        this._pdCursorEnterHandler = function() {
            this._pdCursorCanvasHover = true;
        }.bind(this);
        this._pdCursorLeaveHandler = function() {
            this._pdCursorCanvasHover = false;
            this.updatePlayerDrawingCursor(true);
        }.bind(this);
        if (canvas) {
            canvas.addEventListener('mouseenter', this._pdCursorEnterHandler);
            canvas.addEventListener('mouseleave', this._pdCursorLeaveHandler);
        }
        this._pdCursorSprite = new Sprite(ImageManager.loadSystem(TOOL_ICON_BITMAP));
        this._pdCursorSprite.anchor.x = 0;
        this._pdCursorSprite.anchor.y = 1;
        this._pdCursorSprite.visible = false;
        this._pdCursorSprite.bitmap.smooth = false;
        this._pdCursorSprite._yuraInfo = [12, 10];
        this._pdCursorSprite._yuraUseOwnStep = true;
        this._pdCursorSprite.setFrame(0, 0, TOOL_ICON_SIZE, TOOL_ICON_SIZE);
        this.addChild(this._pdCursorSprite);
    };

    Scene_Base.prototype.restorePlayerDrawingCursor = function() {
        resetRightButtonState();
        var canvas = Graphics._canvas;
        if (canvas) {
            if (this._pdCursorEnterHandler) canvas.removeEventListener('mouseenter', this._pdCursorEnterHandler);
            if (this._pdCursorLeaveHandler) canvas.removeEventListener('mouseleave', this._pdCursorLeaveHandler);
            canvas.style.cursor = this._pdCursorOldCanvasCursor != null ? this._pdCursorOldCanvasCursor : '';
        }
        if (this._pdCursorSprite && this._pdCursorSprite.parent) {
            this._pdCursorSprite.parent.removeChild(this._pdCursorSprite);
        }
        this._pdCursorSprite = null;
        this._pdCursorTool = '';
        this._pdCursorNativeHidden = false;
        this._pdCursorEnterHandler = null;
        this._pdCursorLeaveHandler = null;
        this._pdCursorOldCanvasCursor = null;
    };

    Scene_Base.prototype.setPlayerDrawingCursorHidden = function(hidden) {
        if (this._pdCursorNativeHidden === hidden) return;
        var canvas = Graphics._canvas;
        if (canvas) {
            canvas.style.cursor = hidden ? 'none' : (this._pdCursorOldCanvasCursor != null ? this._pdCursorOldCanvasCursor : '');
        }
        this._pdCursorNativeHidden = hidden;
    };

    Scene_Base.prototype.playerDrawingCursorPoint = function() {
        var state = PD._rightButtonState;
        if (state && state.pressed) {
            return { x: state.x, y: state.y };
        }
        return { x: TouchInput.x, y: TouchInput.y };
    };

    Scene_Base.prototype.playerDrawingCursorTool = function(editor) {
        var state = PD._rightButtonState;
        return state && state.pressed ? 'picker' : editor.tool;
    };

    Scene_Base.prototype.updatePlayerDrawingCursor = function(forceHide) {
        var sprite = this._pdCursorSprite;
        if (!sprite) return;
        var info = this._sceneInfo;
        var show = false;
        var icon = -1;
        var point = this.playerDrawingCursorPoint();
        if (!forceHide && info && info.type === 'playerDrawing' && info.canvasWindow && this._pdCursorCanvasHover !== false) {
            icon = cursorIconForTool(this.playerDrawingCursorTool(info.editor));
            show = icon >= 0 && !!info.canvasWindow.pixelFromScreen(point.x, point.y);
        }
        if (show) {
            var tool = this.playerDrawingCursorTool(info.editor);
            if (this._pdCursorTool !== tool) {
                sprite.setFrame(icon * TOOL_ICON_SIZE, 0, TOOL_ICON_SIZE, TOOL_ICON_SIZE);
                sprite._lastFrame = null;
                this._pdCursorTool = tool;
            }
            sprite.x = point.x;
            sprite.y = point.y;
            sprite.visible = true;
            sprite.opacity = 255;
            this.setPlayerDrawingCursorHidden(true);
        } else {
            sprite.visible = false;
            this._pdCursorTool = '';
            this.setPlayerDrawingCursorHidden(false);
        }
    };

    function playerDrawingLayout(editor) {
        var toolbarW = TOOLBAR_W;
        var toolbarH = toolbarWindowHeight();
        var gap = 16;
        var padding = Window_Base.prototype.standardPadding();
        var canvasW = DOC_W * DISPLAY_SCALE + padding * 2;
        var actionW = actionWindowWidth(editor);
        var totalW = toolbarW + gap + canvasW + gap + actionW;
        var promptH = editor.promptText ? Window_Base.prototype.fittingHeight.call(Window_Base.prototype, 1) : 0;
        var minTop = promptH > 0 ? PROMPT_MARGIN + promptH + PROMPT_MARGIN : 8;
        var canvasLeft = Math.floor((Graphics.boxWidth - canvasW) / 2);
        var maxLeft = Math.max(8, Graphics.boxWidth - totalW - 8);
        var left = Math.max(8, Math.min(canvasLeft - toolbarW - gap, maxLeft));
        var top = Math.max(minTop, Math.floor((Graphics.boxHeight - canvasW) / 2));
        var canvasX = left + toolbarW + gap;
        var promptW = Math.min(Graphics.boxWidth - PROMPT_MARGIN * 2, Math.max(totalW, canvasW));
        return {
            toolbarX: left,
            toolbarY: top,
            toolbarH: toolbarH,
            canvasX: canvasX,
            canvasY: top,
            colorX: left + Math.floor((toolbarW - COLOR_WINDOW_W) / 2),
            colorY: Math.max(8, Math.min(top + toolbarH + 8, Graphics.boxHeight - COLOR_WINDOW_H - 8)),
            actionX: canvasX + canvasW + gap,
            actionY: top + canvasW - ACTION_H,
            promptX: Math.floor((Graphics.boxWidth - promptW) / 2),
            promptY: PROMPT_MARGIN,
            promptW: promptW
        };
    }

    Scene_Base.prototype.startPlayerDrawing = function(options) {
        options = options || {};
        if (this._sceneInfo) return false;
        var editor = new DrawingEditor(options);
        var layout = playerDrawingLayout(editor);
        this._pdPromptWindow = editor.promptText ? new Window_PlayerDrawingPrompt(editor, layout.promptX, layout.promptY, layout.promptW) : null;
        this._pdToolbarWindow = new Window_PlayerDrawingToolbar(editor, layout.toolbarX, layout.toolbarY, layout.toolbarH);
        this._pdCanvasWindow = new Window_PlayerDrawingCanvas(editor, layout.canvasX, layout.canvasY);
        this._pdColorWindow = new Window_PlayerDrawingColor(editor, layout.colorX, layout.colorY);
        this._pdActionWindow = new Window_PlayerDrawingConfirm(editor, layout.actionX, layout.actionY);
        this.addWindow(this._pdToolbarWindow);
        this.addWindow(this._pdCanvasWindow);
        this.addWindow(this._pdColorWindow);
        this.addWindow(this._pdActionWindow);
        if (this._pdPromptWindow) this.addWindow(this._pdPromptWindow);
        this.setupPlayerDrawingCursor();

        var info = this._sceneInfo = {
            type: 'playerDrawing',
            editor: editor,
            toolbarWindow: this._pdToolbarWindow,
            canvasWindow: this._pdCanvasWindow,
            colorWindow: this._pdColorWindow,
            actionWindow: this._pdActionWindow,
            promptWindow: this._pdPromptWindow,
            windows: [wrapRef(this, '_pdPromptWindow'), wrapRef(this, '_pdToolbarWindow'), wrapRef(this, '_pdCanvasWindow'), wrapRef(this, '_pdColorWindow'), wrapRef(this, '_pdActionWindow')],
            returnInterpreter: options.returnInterpreter || null,
            onDone: typeof options.onDone === 'function' ? options.onDone : null,
            resultVariableId: Number(options.resultVariableId || 0),
            resultSwitchId: Number(options.resultSwitchId || 0),
            phase: '',
            confirmChoice: -1,
            systemMessage: false
        };
        return true;
    };

    Scene_Base.prototype.refreshPlayerDrawingUi = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        if (info.toolbarWindow) info.toolbarWindow.refreshState();
        if (info.colorWindow) info.colorWindow.refresh();
        if (info.actionWindow) info.actionWindow.refresh();
    };

    Scene_Base.prototype.isPlayerDrawingToolbarIndexValid = function(index) {
        var info = this._sceneInfo;
        return !!(info && info.type === 'playerDrawing' && TOOLBAR_BUTTONS[index]);
    };

    Scene_Base.prototype.selectPlayerDrawingToolbarIndex = function(index, playSound) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return false;
        if (!this.isPlayerDrawingToolbarIndexValid(index)) {
            if (playSound) playPlayerDrawingSound('buzzer');
            return false;
        }
        var changed = info.editor.toolbarIndex !== index;
        info.editor.setToolbarIndex(index);
        this.refreshPlayerDrawingUi();
        if (playSound) playPlayerDrawingSound(changed ? 'cursor' : 'ok');
        return true;
    };

    Scene_Base.prototype.onPlayerDrawingCommand = function(symbol) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return false;
        var editor = info.editor;
        symbol = String(symbol || '');
        if (symbol === 'done') {
            this.requestPlayerDrawingDoneConfirm();
            return true;
        }
        if (symbol === 'cancel_draw') {
            this.finishPlayerDrawing(false);
            return true;
        }
        if (symbol.indexOf('tool_') === 0) {
            var tool = symbol.slice(5);
            if (!editor.setTool(tool)) return false;
            this.refreshPlayerDrawingUi();
            return true;
        }
        if (symbol.indexOf('size_') === 0) {
            var oldSize = editor.brushSize();
            editor.setBrushSize(Number(symbol.split('_')[1]));
            this.refreshPlayerDrawingUi();
            return editor.brushSize() !== oldSize;
        }
        var handled = true;
        switch (symbol) {
            case 'color':
                editor.toggleColor();
                break;
            case 'undo':
                if (editor.doc.undo()) info.canvasWindow.refresh();
                else handled = false;
                break;
            case 'redo':
                if (editor.doc.redo()) info.canvasWindow.refresh();
                else handled = false;
                break;
            case 'clear':
                editor.doc.beginOperation();
                if (editor.doc.clear()) {
                    editor.doc.commitOperation();
                    info.canvasWindow.refresh();
                } else {
                    editor.doc.cancelOperation();
                    handled = false;
                }
                break;
            default:
                handled = false;
                break;
        }
        this.refreshPlayerDrawingUi();
        return handled;
    };

    Scene_Base.prototype.executePlayerDrawingCommand = function(symbol, soundType) {
        var handled = this.onPlayerDrawingCommand(symbol);
        if (soundType !== false) playPlayerDrawingSound(handled ? (soundType || 'ok') : 'buzzer');
        return handled;
    };

    Scene_Base.prototype.pickPlayerDrawingPixel = function(point, playSound) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing' || !point) return false;
        var editor = info.editor;
        var picked = editor.doc.get(point.x, point.y);
        if (picked === PIXEL_WHITE || picked === PIXEL_BLACK) {
            editor.color = picked;
            editor.setTool('pen');
        } else {
            editor.setTool('eraser');
        }
        this.refreshPlayerDrawingUi();
        if (playSound) playPlayerDrawingPickerSe();
        return true;
    };

    Scene_Base.prototype.bringPlayerDrawingMessageToFront = function() {
        if (!this._messageWindow || !this._windowLayer) return;
        this.addWindow(this._messageWindow);
        this._messageWindow.subWindows().forEach(function(window) {
            this.addWindow(window);
        }, this);
    };

    function clearPlayerDrawingPopupPosition() {
        if (!$gameSystem) return;
        if ($gameSystem.clearMessagePopupFree) $gameSystem.clearMessagePopupFree();
        if ($gameSystem.clearMessagePopup) $gameSystem.clearMessagePopup();
    }

    function setupPlayerDrawingSystemMessageShape() {
        if (!$gameMessage) return;
        $gameMessage._fukidashi = false;
        $gameMessage._tailDir = 5;
        $gameMessage._realTailDir = null;
        $gameMessage._realTailAngle = null;
    }

    Scene_Base.prototype.preparePlayerDrawingSystemMessage = function() {
        clearPlayerDrawingPopupPosition();
        if ($gameSystem) {
            if ($gameSystem.setMessagePopupFree) {
                var point = this.playerDrawingConfirmPopupPoint();
                $gameSystem.setMessagePopupFree(point.x, point.y);
            }
        }
        if ($gameMessage) {
            setupPlayerDrawingSystemMessageShape();
            if ($gameMessage.setBackground) $gameMessage.setBackground(0);
            if ($gameMessage.setPositionType) $gameMessage.setPositionType(2);
            if ($gameMessage.setChoiceBackground) $gameMessage.setChoiceBackground(0);
            if ($gameMessage.setChoicePositionType) $gameMessage.setChoicePositionType(2);
        }
    };

    Scene_Base.prototype.playerDrawingConfirmPopupPoint = function() {
        var info = this._sceneInfo;
        var canvas = info && info.canvasWindow;
        if (canvas) {
            return {
                x: canvas.x + canvas.width / 2,
                y: canvas.y + canvas.height / 2
            };
        }
        return {
            x: Graphics.boxWidth / 2,
            y: Graphics.boxHeight / 2
        };
    };

    Scene_Base.prototype.clearPlayerDrawingSystemMessagePopup = function() {
        clearPlayerDrawingPopupPosition();
        setupPlayerDrawingSystemMessageShape();
    };

    Scene_Base.prototype.requestPlayerDrawingDoneConfirm = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        if (info.phase === 'doneConfirm') return;
        if (!$gameMessage) return this.finishPlayerDrawing(true);
        if ($gameMessage.isBusy && $gameMessage.isBusy()) return;
        info.phase = 'doneConfirm';
        info.confirmChoice = -1;
        info.systemMessage = true;
        this.bringPlayerDrawingMessageToFront();
        this.preparePlayerDrawingSystemMessage();
        $gameMessage.add(pdText(DONE_CONFIRM_TEXT));
        $gameMessage.setChoices([pdText(DONE_CONFIRM_YES), pdText(DONE_CONFIRM_NO)], 0, 1);
        $gameMessage.setChoiceCallback(function(choice) {
            var current = this._sceneInfo;
            if (current && current.type === 'playerDrawing') current.confirmChoice = choice;
        }.bind(this));
        this.updatePlayerDrawingCursor(true);
    };

    Scene_Base.prototype.updatePlayerDrawingDoneConfirm = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing' || info.phase !== 'doneConfirm') return false;
        this.updatePlayerDrawingCursor(true);
        if ($gameMessage && $gameMessage.isBusy && $gameMessage.isBusy()) return true;
        var choice = Number(info.confirmChoice);
        info.phase = '';
        info.confirmChoice = -1;
        info.systemMessage = false;
        this.clearPlayerDrawingSystemMessagePopup();
        if (choice === 0) {
            this.finishPlayerDrawing(true);
        } else {
            this.updatePlayerDrawingCursor();
        }
        return true;
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
        this.restorePlayerDrawingCursor();
        this._sceneInfo = null;
    };

    Scene_Base.prototype.cyclePlayerDrawingToolbar = function(delta) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        var length = TOOLBAR_BUTTONS.length;
        var index = Number(info.editor.toolbarIndex);
        if (isNaN(index)) index = Math.max(0, toolbarIndexForKey(info.editor.tool));
        this.selectPlayerDrawingToolbarIndex((index + delta + length) % length, true);
    };

    Scene_Base.prototype.executeSelectedPlayerDrawingToolbarCommand = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return false;
        var index = info.editor.toolbarIndex;
        var button = TOOLBAR_BUTTONS[index];
        if (button && button.type === 'tool') {
            this.onPlayerDrawingCommand(info.editor.toolbarCommand());
            return true;
        }
        return this.executePlayerDrawingCommand(info.editor.toolbarCommand(), 'ok');
    };

    Scene_Base.prototype.handlePlayerDrawingToolbarAction = function(action) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing' || !action) return false;
        if (String(action.key || '').indexOf('size_') === 0) {
            var handled = this.onPlayerDrawingCommand(action.key);
            if (handled) playPlayerDrawingSound('cursor');
            return true;
        }
        if (action.toolbarIndex != null) {
            if (info.editor.toolbarIndex !== action.toolbarIndex) {
                this.selectPlayerDrawingToolbarIndex(action.toolbarIndex, true);
                return true;
            }
            if (action.buttonType === 'tool') {
                this.onPlayerDrawingCommand(action.key);
                return true;
            }
            this.executePlayerDrawingCommand(action.key, 'ok');
            return true;
        }
        this.executePlayerDrawingCommand(action.key, 'ok');
        return true;
    };

    Scene_Base.prototype.updatePlayerDrawingUiInput = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return false;
        var action = null;
        if (info.toolbarWindow) {
            action = info.toolbarWindow.consumeTriggeredAction();
            if (action) return this.handlePlayerDrawingToolbarAction(action);
        }
        if (info.colorWindow) action = info.colorWindow.consumeTriggeredAction();
        if (action) {
            this.executePlayerDrawingCommand(action.key, 'cursor');
            return true;
        }
        if (info.actionWindow) action = info.actionWindow.consumeTriggeredAction();
        if (action) {
            this.executePlayerDrawingCommand(action.key, action.key === 'cancel_draw' ? 'cancel' : 'ok');
            return true;
        }
        return false;
    };

    Scene_Base.prototype.updatePlayerDrawingRightPicker = function() {
        var info = this._sceneInfo;
        var state = PD._rightButtonState;
        if (!info || info.type !== 'playerDrawing' || !state || !state.pressed) return false;
        if (info.phase === 'doneConfirm') return true;
        var point = info.canvasWindow.pixelFromScreen(state.x, state.y);
        if (!point) {
            state.triggered = false;
            state.lastPickKey = '';
            return true;
        }
        var key = point.x + ',' + point.y;
        if (state.triggered || state.lastPickKey !== key) {
            this.pickPlayerDrawingPixel(point, true);
            state.triggered = false;
            state.lastPickKey = key;
        }
        return true;
    };

    Scene_Base.prototype.updatePlayerDrawingKeyInput = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        if (info.phase === 'doneConfirm') return;
        var editor = info.editor;
        var toolbarPrev = consumeKeyboardShortcut('toolbarPrev');
        var toolbarNext = consumeKeyboardShortcut('toolbarNext');
        var brushSmaller = consumeKeyboardShortcut('brushSmaller') || Input.isRepeated('Q');
        var brushLarger = consumeKeyboardShortcut('brushLarger') || Input.isRepeated('E');
        var sizeTool = editor.selectedBrushSizeTool();
        if (consumeKeyboardShortcut('undo') || isGamepadButtonTriggered('undo', GAMEPAD_UNDO_BUTTONS)) {
            this.executePlayerDrawingCommand('undo', 'ok');
        } else if (consumeKeyboardShortcut('redo') || isGamepadButtonTriggered('redo', GAMEPAD_REDO_BUTTONS)) {
            this.executePlayerDrawingCommand('redo', 'ok');
        } else if (toolbarPrev) {
            this.cyclePlayerDrawingToolbar(-1);
        } else if (toolbarNext) {
            this.cyclePlayerDrawingToolbar(1);
        } else if (Input.isTriggered('ok')) {
            this.executeSelectedPlayerDrawingToolbarCommand();
        } else if (Input.isTriggered('cancel')) {
            playPlayerDrawingSound('cancel');
            this.finishPlayerDrawing(false);
        } else if (sizeTool && brushSmaller) {
            if (editor.nudgeBrushSize(-1)) {
                playPlayerDrawingSound('cursor');
                info.toolbarWindow.refreshState();
            } else {
                playPlayerDrawingSound('buzzer');
            }
        } else if (sizeTool && brushLarger) {
            if (editor.nudgeBrushSize(1)) {
                playPlayerDrawingSound('cursor');
                info.toolbarWindow.refreshState();
            } else {
                playPlayerDrawingSound('buzzer');
            }
        } else if (Input.isTriggered('left') || Input.isTriggered('right')) {
            editor.toggleColor();
            playPlayerDrawingSound('cursor');
            if (info.toolbarWindow) info.toolbarWindow.refreshState();
            if (info.colorWindow) info.colorWindow.refresh();
        }
    };

    Scene_Base.prototype.fillPlayerDrawingAt = function(point) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing' || !point) return false;
        var editor = info.editor;
        editor.doc.beginOperation();
        var fillBounds = editor.doc.fillBounds(point.x, point.y, editor.color);
        if (fillBounds) {
            editor.doc.commitOperation();
            info.canvasWindow.refreshDirty(fillBounds);
        } else {
            editor.doc.cancelOperation();
        }
        playPlayerDrawingFillSe();
        if (info.toolbarWindow) info.toolbarWindow.refreshState();
        return true;
    };

    Scene_Base.prototype.startPlayerDrawingStroke = function(point) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing' || !point) return false;
        var editor = info.editor;
        editor.beginDraw();
        editor._painting = true;
        editor._lastPixel = point;
        info.canvasWindow.refreshDirty(editor.drawAt(point.x, point.y));
        editor.setStrokeSePoint(TouchInput.x, TouchInput.y);
        if (info.toolbarWindow) info.toolbarWindow.refreshState();
        return true;
    };

    Scene_Base.prototype.handlePlayerDrawingCanvasTrigger = function(point) {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing' || !point) return false;
        var editor = info.editor;
        if (editor.tool === 'picker') return this.pickPlayerDrawingPixel(point, true);
        if (editor.tool === 'fill') return this.fillPlayerDrawingAt(point);
        return this.startPlayerDrawingStroke(point);
    };

    Scene_Base.prototype.updatePlayerDrawingStroke = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        var editor = info.editor;
        if (editor._painting && TouchInput.isPressed()) {
            var current = info.canvasWindow.pixelFromScreen(TouchInput.x, TouchInput.y);
            if (current) {
                var lineBounds = editor.drawLine(editor._lastPixel, current);
                info.canvasWindow.refreshDirty(lineBounds);
                editor._lastPixel = current;
                editor.playStrokeSeIfMoving(TouchInput.x, TouchInput.y);
            }
        }
        if (editor._painting && TouchInput.isReleased()) {
            editor.finishDraw();
            if (info.toolbarWindow) info.toolbarWindow.refreshState();
        }
    };

    Scene_Base.prototype.updatePlayerDrawing = function() {
        var info = this._sceneInfo;
        if (!info || info.type !== 'playerDrawing') return;
        if (this.updatePlayerDrawingDoneConfirm()) return;
        var canvas = info.canvasWindow;
        this.updatePlayerDrawingKeyInput();
        if (!this._sceneInfo || this._sceneInfo.type !== 'playerDrawing') return;
        if (this.updatePlayerDrawingDoneConfirm()) return;
        if (this.updatePlayerDrawingUiInput()) {
            this.updatePlayerDrawingCursor();
            return;
        }
        if (this.updatePlayerDrawingRightPicker()) {
            this.updatePlayerDrawingCursor();
            return;
        }
        if (TouchInput.isTriggered()) {
            var start = canvas.pixelFromScreen(TouchInput.x, TouchInput.y);
            if (start) this.handlePlayerDrawingCanvasTrigger(start);
        } else {
            this.updatePlayerDrawingStroke();
        }
        this.updatePlayerDrawingCursor();
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

    Game_Interpreter.prototype.registerLastPlayerDrawingItemImage = function(itemOrId) {
        var drawingId = this.lastPlayerDrawingId();
        if (!drawingId) {
            warnPlayerDrawing('registerLastPlayerDrawingItemImage failed: last drawing id is empty.');
            return false;
        }
        return PD.registerItemImage(itemOrId, drawingId);
    };

    Game_Interpreter.prototype.unregisterPlayerDrawingItemImage = function(itemOrId) {
        return PD.unregisterItemImage(itemOrId);
    };

    Game_Interpreter.prototype.putLastPlayerDrawingItem = function(itemOrId, x, y, num) {
        var drawingId = this.lastPlayerDrawingId();
        if (!drawingId) {
            warnPlayerDrawing('putLastPlayerDrawingItem failed: last drawing id is empty.');
            return null;
        }
        return $gameMap.putPlayerDrawingItem(drawingId, itemOrId, x, y, num);
    };

    Game_Interpreter.prototype.spawnLastPlayerDrawingEvent = function(template, x, y, options) {
        var drawingId = this.lastPlayerDrawingId();
        if (!drawingId) {
            warnPlayerDrawing('spawnLastPlayerDrawingEvent failed: last drawing id is empty.');
            return null;
        }
        return $gameMap.spawnPlayerDrawingEvent(drawingId, template, x, y, options);
    };

    var _Game_Interpreter_pluginCommand_PD = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand_PD.apply(this, arguments);
        if (String(command || '').toUpperCase() === 'PD_OPEN') {
            args = args || [];
            var first = String(args[0] || '').toLowerCase();
            var firstIsBackground = first === BACKGROUND_WHITE || first === BACKGROUND_TRANSPARENT;
            var background = firstIsBackground ? first : (args[1] || BACKGROUND_TRANSPARENT);
            var promptText = args.slice(firstIsBackground ? 1 : 2).join(' ');
            var options = {
                resultVariableId: firstIsBackground ? 0 : Number(args[0] || 0),
                background: background
            };
            if (promptText) options.promptText = promptText;
            this.openPlayerDrawing(options);
        }
    };

    var _Game_System_onAfterLoad_PD = Game_System.prototype.onAfterLoad;
    Game_System.prototype.onAfterLoad = function() {
        _Game_System_onAfterLoad_PD.apply(this, arguments);
        PD.clearCache();
    };

    PD.Document = DrawingDocument;
    PD.Editor = DrawingEditor;
    PD.WindowPrompt = Window_PlayerDrawingPrompt;
    PD.WindowCanvas = Window_PlayerDrawingCanvas;
    PD.WindowToolbar = Window_PlayerDrawingToolbar;
    PD.WindowColor = Window_PlayerDrawingColor;
    PD.WindowConfirm = Window_PlayerDrawingConfirm;
})();
