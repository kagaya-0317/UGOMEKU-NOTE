//=============================================================================
// KNH_ZXC_Endroll.js
//=============================================================================

/*:
 * @target MV MZ
 * @plugindesc ZXCエンドロール表示
 * @author kagaya
 *
 * @help
 * スクリプトコマンド:
 *   this.command_endroll();
 *
 * 機能:
 * - Scene_Map上に重ねてエンドロール表示
 * - テキストは下から上へスクロール
 * - すべて中央揃え
 * - DevToolsManage の高速化/低速化に対応
 */

(function() {
    'use strict';

    // ここを直接編集して調整
    var SCROLL_SPEED = 1.6;
    var FONT_SIZE = 28;
    var LINE_PITCH = 54;
    var TOP_MARGIN = 48;
    var BOTTOM_MARGIN = 48;

    var ROLE_NAME_GAP = '\u3000';

    function roleLine(roleJa, name) {
        var rawName = String(name || '');
        var names = rawName.split('\n');
        return {
            _knhRoleLine: true,
            role: _tl(roleJa),
            names: names
        };
    }

    function honorific() {
        return '\u3000' + _tl('様');
    }

    function supporterLine(iconCodes, name) {
        return String(iconCodes || '') + String(name || '') + honorific();
    }

    function buildEndrollLines() {
        return [
            '~STAFF ROLL~',
            '',
            '',
            '',
            '',
            '',
            roleLine('ディレクター', 'kagaya'),
            '',
            roleLine('シナリオ', 'kagaya'),
            '',
            roleLine('グラフィック', 'kagaya'),
            '',
            roleLine('キャラクターデザイン', 'kagaya'),
            '',
            roleLine('モンスター設計', 'kagaya'),
            '',
            roleLine('マップ設計', 'kagaya'),
            '',
            roleLine('UIデザイン', 'kagaya'),
            '',
            roleLine('BGM', 'kagaya'),
            '',
            roleLine('システム設計', 'kagaya'),
            '',
            roleLine('プログラミング', 'kagaya'),
            '',
            roleLine('デバッグ', 'kagaya'),
            '',
            '',
            '',
            '',
            '',
            '~Localization~',
            '',
            '',
            '',
            '',
            '',
            roleLine('English', _tl('クロノ・スタジオ\nサム・クロノ')),
            '',
            '',
            '',
            '',
            '',
            '~Special Thanks~',
            '',
            '',
            '',
            '',
            '',
            '======' + _tl('グッズ購入者') + '======',
            '',
            supporterLine('\\i[49]', 'wakame satsuki'),
            supporterLine('\\i[50]', '魚介出汁しじみ'),
            supporterLine('\\i[50]', '真夏'),
            supporterLine('\\i[50]', 'つきてんじん'),
            supporterLine('\\i[50]', 'ねんちゃん'),
            supporterLine('\\i[48]\\i[49]\\i[50]', 'トキア'),
            supporterLine('\\i[48]', 'トギニワ'),
            supporterLine('\\i[49]', 'Shogo Fujisawa'),
            '',
            '====================',
            '',
            '',
            '',
            '...and You!!',
            '',
            '',
            '',
            '',
            '',
            'Thank you for playing!!'
        ];
    }

    var _rapidSpeedCache = null;

    function getDevToolsRapidSpeedRaw() {
        if (_rapidSpeedCache !== null) return _rapidSpeedCache;
        var value = 2;
        if (typeof PluginManager !== 'undefined' && PluginManager.parameters) {
            var devParams = PluginManager.parameters('DevToolsManage') ||
                PluginManager.parameters('DevToolsManager') || {};
            var raw = devParams.RapidSpeed || devParams['高速スピード'];
            var parsed = Number(raw);
            if (isFinite(parsed)) value = parsed;
        }
        _rapidSpeedCache = value;
        return _rapidSpeedCache;
    }

    function getDevToolsSpeedScale() {
        var scale = 1;
        if (typeof SceneManager !== 'undefined' &&
            typeof SceneManager.isRapid === 'function' && SceneManager.isRapid()) {
            var rapidRate = getDevToolsRapidSpeedRaw();
            scale = rapidRate > 1 ? rapidRate : 2;
        } else if (typeof SceneManager !== 'undefined' &&
            typeof SceneManager.isSlow === 'function' && SceneManager.isSlow()) {
            var slowRate = getDevToolsRapidSpeedRaw();
            var divisor = slowRate < -1 ? Math.abs(slowRate) : 2;
            scale = 1 / divisor;
        }
        return scale;
    }

    function Window_KNH_Endroll() {
        this.initialize.apply(this, arguments);
    }

    Window_KNH_Endroll.prototype = Object.create(Window_Base.prototype);
    Window_KNH_Endroll.prototype.constructor = Window_KNH_Endroll;

    Window_KNH_Endroll.prototype.initialize = function(lines) {
        this._lines = lines || [];
        this._linePitch = LINE_PITCH;
        this._fontSize = FONT_SIZE;

        var totalHeight = TOP_MARGIN + this._lines.length * this._linePitch + BOTTOM_MARGIN;
        var framePadding = 36;
        var width = Graphics.boxWidth;
        var height = Math.max(1, totalHeight + framePadding);

        Window_Base.prototype.initialize.call(this, 0, Graphics.boxHeight, width, height);

        this.opacity = 0;
        this.backOpacity = 0;
        this.contentsOpacity = 255;

        this._scrollY = Graphics.boxHeight;
        this.y = this._scrollY;
        this._finished = false;

        this.refresh();
    };

    Window_KNH_Endroll.prototype.refresh = function() {
        this.contents.clear();
        this.resetFontSettings();

        if (typeof this.setFontSize === 'function') {
            this.setFontSize(this._fontSize);
        } else {
            this.contents.fontSize = this._fontSize;
        }
        this.changeTextColor('#ffffff');

        var y = TOP_MARGIN;
        for (var i = 0; i < this._lines.length; i++) {
            var line = this._lines[i];
            if (line && line._knhRoleLine) {
                this.drawCenterRoleLine(line, y);
            } else {
                line = String(line || '');
                if (line) this.drawCenterLine(line, y);
            }
            y += this._linePitch;
        }
    };

    Window_KNH_Endroll.prototype.measureTextExWidth = function(text) {
        var lastNoResetFontSettings = this._noResetFontSettings;
        var lastFontSize = this.contents.fontSize;
        var lastColor = this.contents.textColor;
        this._noResetFontSettings = true;
        this.contents.fontSize = this._fontSize;
        var width = this.drawTextEx(String(text || ''), -9999, -9999);
        this._noResetFontSettings = lastNoResetFontSettings;
        this.contents.fontSize = lastFontSize;
        this.contents.textColor = lastColor;
        return width;
    };

    Window_KNH_Endroll.prototype.drawCenterRoleLine = function(line, y) {
        var role = String(line.role || '');
        var names = Array.isArray(line.names) && line.names.length ? line.names : [''];
        names = names.map(function(name) {
            return String(name || '');
        });

        var hasName = names.some(function(name) {
            return !!name;
        });
        var gapText = role && hasName ? ROLE_NAME_GAP : '';

        var roleWidth = role ? this.measureTextExWidth(role) : 0;
        var gapWidth = gapText ? this.measureTextExWidth(gapText) : 0;
        var maxNameWidth = 0;
        for (var i = 0; i < names.length; i++) {
            maxNameWidth = Math.max(maxNameWidth, this.measureTextExWidth(names[i]));
        }

        var totalWidth = roleWidth + gapWidth + maxNameWidth;
        var leftX = Math.max(0, Math.floor((this.contentsWidth() - totalWidth) / 2));
        var nameX = leftX + roleWidth + gapWidth;
        this.changeTextColor('#ffffff');

        // 複数行名の中心をこの行(y)に合わせる
        var firstNameY = y - Math.floor((names.length - 1) * 33 / 2);
        for (var j = 0; j < names.length; j++) {
            this.drawTextKNH(names[j], nameX, firstNameY + 33 * j, maxNameWidth, 'left', 'center', this._fontSize);
        }
        if (role) {
            this.drawTextKNH(role, leftX, y, roleWidth, 'left', 'center', this._fontSize);
        }
    };

    Window_KNH_Endroll.prototype.drawCenterLine = function(text, y) {
        if (typeof this.drawTextKNH === 'function') {
            this.drawTextKNH(text, 0, y, this.contentsWidth(), 'center', null, this._fontSize);
            return;
        }
        var lineWidth = this.drawTextEx(text, -9999, -9999);
        var x = Math.max(0, Math.floor((this.contentsWidth() - lineWidth) / 2));
        this.drawTextEx(text, x, y);
    };

    Window_KNH_Endroll.prototype.scrollStep = function(speedScale) {
        if (this._finished) return;
        var scale = Number(speedScale);
        if (!isFinite(scale) || scale <= 0) scale = 1;

        this._scrollY -= SCROLL_SPEED * scale;
        this.y = Math.round(this._scrollY);

        if (this.y + this.height < 0) {
            this._finished = true;
        }
    };

    Window_KNH_Endroll.prototype.isFinished = function() {
        return !!this._finished;
    };

    function ensureEndrollState() {
        if (!$gameTemp) return null;
        if (!$gameTemp._knhEndrollState) {
            $gameTemp._knhEndrollState = {
                active: false,
                window: null,
                startMapId: 0
            };
        }
        return $gameTemp._knhEndrollState;
    }

    function isEndrollPlaying() {
        return !!($gameTemp && $gameTemp._knhEndrollPlaying);
    }

    function finishEndroll() {
        var state = ensureEndrollState();
        if (state && state.window && state.window.parent) {
            state.window.parent.removeChild(state.window);
        }
        if (state) {
            state.window = null;
            state.active = false;
            state.startMapId = 0;
        }
        if ($gameTemp) $gameTemp._knhEndrollPlaying = false;
    }

    var _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function() {
        _Game_Temp_initialize.apply(this, arguments);
        this._knhEndrollState = null;
        this._knhEndrollPlaying = false;
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.apply(this, arguments);
        this.updateKnhEndrollOverlay();
    };

    Scene_Map.prototype.updateKnhEndrollOverlay = function() {
        var state = ensureEndrollState();
        if (!state || !state.active) return;

        // 場所移動で mapId が変わったら即終了
        if (state.startMapId && $gameMap && state.startMapId !== $gameMap.mapId()) {
            finishEndroll();
            return;
        }

        if (!state.window || state.window.parent !== this._frontSprite) {
            state.window = new Window_KNH_Endroll(buildEndrollLines());
            // 最前面に重ねる（メッセージウィンドウより前）
            this._frontSprite.addChild(state.window);
        }

        state.window.scrollStep(getDevToolsSpeedScale());
        if (state.window.isFinished()) finishEndroll();
    };

    var _Scene_Map_stop = Scene_Map.prototype.stop;
    Scene_Map.prototype.stop = function() {
        _Scene_Map_stop.apply(this, arguments);
        if (isEndrollPlaying()) finishEndroll();
    };

    Game_Interpreter.prototype.command_endroll = function() {
        if (!$gameTemp || !SceneManager._scene || !(SceneManager._scene instanceof Scene_Map)) return true;
        if ($gameTemp._knhEndrollPlaying) return true;

        var state = ensureEndrollState();
        state.active = true;
        state.window = null;
        state.startMapId = $gameMap ? $gameMap.mapId() : 0;
        $gameTemp._knhEndrollPlaying = true;
        this.setWaitMode('knhEndroll');
        return true;
    };

    var _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'knhEndroll') {
            var waiting = !!($gameTemp && $gameTemp._knhEndrollPlaying);
            if (!waiting) this._waitMode = '';
            return waiting;
        }
        return _Game_Interpreter_updateWaitMode.call(this);
    };
})();
