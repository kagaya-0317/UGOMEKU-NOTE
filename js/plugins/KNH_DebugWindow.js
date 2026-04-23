//=============================================================================
// KNH_DebugWindow.js
//=============================================================================

/*:
 * @plugindesc デバッグ機能追加
 * @author kagaya
 *
 * @help
 */

var version = '1.00';

(function() {
    'use strict';
    var pluginName = 'KNH_DebugWindow';
    
    var getNumber = function(text, max, min) {
        text = applyCharacters(text);
        if (isNaN(text)) return NaN;
        return Math.max(Math.min(Number(text), max || Infinity), min || -Infinity);
    };
    
    var applyCharacters = function(text) {
        if (text === null) text = '';
        text = '' + text;
        text = text.replace(/\\/g, '\x1b');
        text = text.replace(/\x1b\x1b/g, '\\');
        text = text.replace(/\x1bV\[(\d+)\]/gi, function() {
            return $gameVariables.value(parseInt(arguments[1], 10));
        }.bind(this));
        text = text.replace(/\x1bV\[(\d+)\]/gi, function() {
            return $gameVariables.value(parseInt(arguments[1], 10));
        }.bind(this));
        text = text.replace(/\x1bN\[(\d+)\]/gi, function() {
            var actor = parseInt(arguments[1], 10) >= 1 ? $gameActors.actor(parseInt(arguments[1], 10)) : null;
            return actor ? actor.name() : '';
        }.bind(this));
        text = text.replace(/\x1bP\[(\d+)\]/gi, function() {
            var actor = parseInt(arguments[1], 10) >= 1 ? $gameParty.members()[parseInt(arguments[1], 10) - 1] : null;
            return actor ? actor.name() : '';
        }.bind(this));
        if ($dataSystem) text = text.replace(/\x1bG/gi, TextManager.currencyUnit);
        return text;
    };
    
    var getMeta = function(text, str) {
        var re = /<([^<>:]+)(:?)([^>]*)>/g;
        var meta = {};
        for (;;) {
            var match = re.exec(text);
            if (match) {
                if (match[2] === ':') {
                    meta[match[1]] = match[3];
                } else {
                    meta[match[1]] = true;
                }
            } else {
                break;
            }
        }
        return meta['' + str];
    };
    
    //-----------------------------------------------------------------------------
    // 
    //-----------------------------------------------------------------------------
    
    var debugList = [
        ['ｴﾝｶｳﾝﾄ不可', 'bool', '$gamePlayer._noEncount'],
    ];

    var _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        _Scene_Base_update.apply(this, arguments);
        SceneManager.updateDebugWindow();
    };
    SceneManager.updateDebugWindow = function() {
        if (!this._debugWindow) this._debugWindow = new Window_Debug();
//        if ($gameTemp.isPlaytest()) this._scene.addChild(this._debugWindow);
    };

    function Window_Debug() {
        this.initialize();
    };

    Window_Debug.prototype = Object.create(Window_Base.prototype);
    Window_Debug.prototype.constructor = Window_Debug;
    
    Window_Debug.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, 0, 200, 108, 300);
        this._params = [];
        this._paramsIndex = [];
        $gameTemp._number = 0;
        for (var i = 0; i < debugList.length; i++) this.setParam(i);
        this.setBackgroundType(2);
        this.refresh();
    };
    Window_Debug.prototype.standardFontSize = function() {return 16};
    Window_Debug.prototype.standardPadding = function() {return 0};
    
    Window_Debug.prototype.refresh = function() {
        this.contents.clear();
        this.contents.outlineWidth = 2;
        this.contents.outlineColor = 'black'
        this.contents.fillRect(0, 0, this.contents.width, debugList.length * 24, 'rgba(0,0,0,0.2)');
        debugList.forEach(function(a, i) {
            this.drawTextKNH(a[0], 4, i * 24, this.contents.width, 'left', 'down');
            if (a[1] === 'bool') {
                var w = 16, h = 16;
                this.contents.fillRect(this.contents.width - w - 4, i * 24 + (24 - h) / 2, w, h, 'black');
                if (this._params[i])
                    this.contents.fillRect(this.contents.width - w - 2, i * 24 + (24 - h) / 2 + 2, w - 4, h - 4, 'rgb(0,255,255)');
            } else if (a[1] === 'number') {
                this.drawTextKNH('' + this._params[i], 0, i * 24, this.contents.width - 4, 'right', 'down');
            }
        }.bind(this));
    };
    Window_Debug.prototype.setParam = function(index, value) {
        this._params[index] = value === undefined ? eval(debugList[index][2]) : value;
        eval(debugList[index][2] + '=' + this._params[index]);
        if (debugList[index][3]) this._paramsIndex[index] = debugList[index][3].indexOf(this._params[index]);
    };
    Window_Debug.prototype.update = function() {
        Window_Base.prototype.update.apply(this, arguments);
        var info = [];
        debugList.forEach(function(a) {info.push(eval(a[2]))});
        if (this._lastInfo !== info.toString()) {
            this._lastInfo = info.toString();
            this.refresh();
        }
        
        //タッチ判定
        if (TouchInput.isTriggered() && this.isTouchedInsideFrame()) {
            var tx = this.canvasToLocalX(TouchInput.x);
            var ty = this.canvasToLocalY(TouchInput.y);
            debugList.forEach(function(a, i) {
                if (ty >= i * 24 && ty < (i + 1) * 24) {
                    //タッチ処理
                    var value = eval(a[2]);
                    if (a[1] === 'bool') value = !value;
                    else if (a[1] === 'number') {
                        this._paramsIndex[i] = (this._paramsIndex[i] + 1) % a[3].length;
                        value = a[3][this._paramsIndex[i]];
                    }
                    this.setParam(i, value);
                }
            }.bind(this));
        }
    };
    
})();
