//=============================================================================
// KNH_MySetting.js
//=============================================================================

/*:
 * @plugindesc kagayaセッティング
 * @author kagaya
 *
 * @help kagaya開発用セッティング
 *
 */
function Window_Free() {
    this.initialize.apply(this, arguments);
}

var _p = function(value) {
    if ($gameTemp.isPlaytest()) console.log.apply(console, arguments);
};

var _p2 = function(value) {
    var text = '';
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) text += (text ? ', ' : '') + arguments[i];
    }
    $gameTemp._p2 = true;
    $gameTemp.pushMessage(text);
};

var _p3 = function(value, text) {
    $gameTemp._p3 = '' + value;
    $gameTemp.pushMessage('' + text);
};

var _log = function (maxDepth = 3) {
    const stack = new Error().stack.split("\n");
    // stack[0]: "Error"
    // stack[1]: logCallerChain 自身
    for (let depth = 1; depth <= maxDepth; depth++) {
        const targetIndex = depth + 1;
        if (!stack[targetIndex]) break;
        console.log(`呼び出し元(${depth}段階前):`, stack[targetIndex].trim());
    }
}

var _rand = function(min,max) {
    return Math.floor(Math.random() * (max + 1 - min)) + min;
};

var _shuffle = function (array, seed) {
    var n = array.length, t, i;
    while (n) {
        i = Math.floor((seed ? seed.randomInt(100000) / 100000 : Math.random()) * n--);
        t = array[n];
        array[n] = array[i];
        array[i] = t;
    }
    return array;
};

var _timeOut = function(f, wait) {
    setTimeout(f, wait / 60 * 1000);
}

var _getTileInfo = function () {
    for (var i = 0; i < 4; i++) {
        var id = (i * $dataMap.height + $gamePlayer.y) * $dataMap.width + $gamePlayer.x;
        _p('z : ' + i, 'tileId : ' + $dataMap.data[id],
           'kind : ' + Math.floor(($dataMap.data[id] - 2048) / 48), 'mapDataId : ' + id);
    }
};

var _dataByName = function(name, data) {
    return data.filter(function(d) {return d && d.name && d.name === name})[0];
};

var _getMetaInfo = function(text, str) {
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
    return meta['' + str] || false;
};

var _fm = function(value, num, text) {
    text = text || ' ';
    var at = '';
    for (var i = 0; i < num - 1; i++) at += text;
    return (at + value).slice(-num);
};

var _newLine = function(text, maxLen, anywhere) {
    text = text.split('\n').join('　');
    var ps = ['　', ' ', '、', '。'];
    var t = '', tn, tns = [''];
    for (var i = 0; i < text.length; i++) {
        tns[tns.length - 1] += text[i];
        t = text[i], tn = tns[tns.length - 1];
        if ((ps.contains(t) || anywhere) && tn.length > 1) { //改行できそうな場合
            var lt = text.substring(i + 1);
            var len = lt.length;
            for (var j = 0; j < ps.length; j++) {
                if (lt.indexOf(ps[j]) >= 0) len = Math.min(lt.indexOf(ps[j]) + 1, len);
            }
            if (tn.length + len > maxLen) tns.push('');
        }
    }
    return tns.join('\n');
};

//配列の最頻値を返す
Array.prototype.mode = function () {
    if (this.length === 0) return null
    var counter = {};
    var nativeValues = {};
    var maxCounter = 0;
    var maxValue = null;
    for (var i = 0; i < this.length; i++) {
        if (!counter[this[i] + "_" + typeof this[i]]) {
            counter[this[i] + "_" + typeof this[i]] = 0;
        }
        counter[this[i] + "_" + typeof this[i]]++;
        nativeValues[this[i] + "_" + typeof this[i]] = this[i];
    }
    for (var j = 0; j < Object.keys(counter).length; j++) {
        key = Object.keys(counter)[j];
        if (counter[key] > maxCounter) {
            maxCounter = counter[key];
            maxValue = nativeValues[key];
        }
    }
    return maxValue;
};

//点[x,y]に最も近いrect上の点を返す
var _getClosestXyOnRect = function(x, y, rect) {
    if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) return [x, y];
    var lines = [ //x1,y1,x2,y2
        [rect.x, rect.y, rect.x + rect.width, rect.y],
        [rect.x, rect.y, rect.x, rect.y + rect.height],
        [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
        [rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height]
    ]
    //角の場合
    if (x <  lines[0][0] && y <  lines[0][1]) return [lines[0][0], lines[0][1]]; //左上
    if (x <  lines[3][0] && y >= lines[3][1]) return [lines[3][0], lines[3][1]]; //左下
    if (x >= lines[2][0] && y <  lines[2][1]) return [lines[2][0], lines[2][1]]; //右上
    if (x >= lines[2][2] && y >= lines[2][3]) return [lines[2][2], lines[2][3]]; //右下
    //辺上の場合
    if (x <  lines[0][0]) return [lines[0][0], y]; //左
    if (x >= lines[2][0]) return [lines[2][0], y]; //右
    if (y <  lines[0][1]) return [x, lines[0][1]]; //上
    if (y >= lines[0][3]) return [x, lines[1][3]]; //下
    return [x, y];
};

//シード乱数生成用
class _randomSeed {
    constructor(seed, x, y, z) {
        this.x = x || 1145141919;
        this.y = y || 893810;
        this.z = z || 123;
        this.w = seed || 0;
        for (var i = 0; i < 50; i++) this.next(); //空回し
    }
    next() {
        let t;
        t = this.x ^ (this.x << 11);
        this.x = this.y; this.y = this.z; this.z = this.w;
        return this.w = (this.w ^ (this.w >>> 19)) ^ (t ^ (t >>> 8)); 
    }
    random() {
        return this.randomInt(1000000) / 1000000;
    }
    // min以上max以下の整数を生成する
    rand(min, max) {
        const r = Math.round(Math.abs(this.next()));
        return min + (r % (max + 1 - min));
    }
    // max未満の整数を生成する
    randomInt(max) {
        return Math.round(Math.abs(this.next())) % max;
    }
};

//ランダムシードをもとに名前を生成
var kanaList = [
    ['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト',
     'ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ワ',
     'ラ','リ','ル','レ','ロ','ガ','ギ','グ','ゲ','ゴ','ザ','ジ','ズ','ゼ','ゾ','ダ','ヂ','ヅ','デ','ド',
     'バ','ビ','ブ','ベ','ボ','パ','ピ','プ','ペ','ポ','ヴ','ヲ'],
    ['ー','ン'], ['ァ','ィ','ゥ','ェ','ォ','ャ','ュ','ョ','ヮ'], ['ッ']
];
var _getRandomName = function(min, max, seed) {
    var seed = new _randomSeed(seed);
    var length = seed.rand(min, max);
    var flag = false;
    var text = '';
    for (var i = 0; i < length; i++) {
        var n = 0;
        if (!seed.randomInt(4) && i !== 0 && i !== length - 1 && !flag) n = 3, flag = true;
        else if (!seed.randomInt(4) && i !== 0 && !flag) n = !seed.randomInt(4) ? 2 : 1, flag = true;
        else flag = false;
        text += kanaList[n][seed.randomInt(kanaList[n].length)];
    }
    return text;
};

//以下デバッグ用
//そのイベント名のキャラを取得
_ev = function(name) {
    return $gameMap._events.filter(function(ev) {
        return ev && ev.event() && ev.event().name === name;
    })[0];
};
//そのmetaのキャラを取得
_evMetas = function(name) {
    return $gameMap._events.filter(function(ev) {
        return ev && ev.event() && ev.event().meta[name];
    });
};

(function() {
    'use strict';
    var pluginName = 'KNH_MySetting';
    
    var getBoolean = function(text) {
        return (applyCharacters(text) || '').toUpperCase() === 'ON';
    };
    
    var getNumber = function(text, max, min) {
        text = applyCharacters(text);
        if (isNaN(text)) return NaN;
        return Math.max(Math.min(Number(text), max || Infinity), min || -Infinity);
    };
    
    var getArrayString = function(text) {
        var values = applyCharacters(text).split(',');
        for (var i = 0; i < values.length; i++) {
            values[i] = values[i].trim();
            if (!isNaN(values[i])) values[i] = Number(values[i]);
        }
        return values;
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
    // 仕様変更
    //-----------------------------------------------------------------------------

    //プレイヤーの移動速度
    var _Game_Player_initialize = Game_Player.prototype.initialize;
    Game_Player.prototype.initialize = function() {
        _Game_Player_initialize.call(this);
        this._moveSpeed = this.baseSpeed();
    };
    Game_Player.prototype.baseSpeed = function() {
        return 4.5;
    };
    Game_Player.prototype.isDashButtonPressed = function() {
        return false;
    };

    //移動サーチを軽量化
    Game_Character.prototype.searchLimit = function() {
        return 24; //12;
    };
    
    Window_Base.prototype.standardBackOpacity = function() {
        return 255;
    };
    
    var _Window_Base_update = Window_Base.prototype.update;
    Window_Base.prototype.update = function() {
        //軽量化
        if (!this.visible || (this.openness <= 0 && !this._opening)) {
            if (this._titleWindow) this._titleWindow.openness = 0;
            return false;
        }
        _Window_Base_update.apply(this, arguments);
    };
    
    //謎仕様無効化 & スワイプで選択肢移動しない
    Window_Selectable.prototype.onTouch = function(triggered) {
        var lastIndex = this.index();
        var x = this.canvasToLocalX(TouchInput.x);
        var y = this.canvasToLocalY(TouchInput.y);
        var hitIndex = this.hitTest(x, y);
        if (hitIndex >= 0) {
            if (hitIndex === this.index()) {
                if (triggered && this.isTouchOkEnabled()) this.processOk();
            } else if (triggered && this.isCursorMovable()) {
                this.select(hitIndex);
            }
        }
        if (this.index() !== lastIndex) SoundManager.playCursor();
    };
    
    //マスクしない
    var _WindowLayer_maskWindow = WindowLayer.prototype._maskWindow;
    WindowLayer.prototype._maskWindow = function(window, shift) {
        _WindowLayer_maskWindow.apply(this, arguments);
        this._windowRect.x++, this._windowRect.y++, this._windowRect.width--, this._windowRect.height--;
//        if (window._nonMask) this._windowRect.width = 0;
        this._windowRect.width = 0;
    };
    
    //アニメ名に<rand>で角度・拡大率などランダム化
    var _Sprite_Animation_updateCellSprite = Sprite_Animation.prototype.updateCellSprite;
    Sprite_Animation.prototype.updateCellSprite = function(sprite, cell) {
        _Sprite_Animation_updateCellSprite.apply(this, arguments);
        if (!this._setted && this._animation.name.indexOf('<rand>') >= 0) {
            this._rand = [_rand(0, 360), _rand(-3, 3), _rand(0, 1), _rand(0, 100)];
        }
        var ind = this._animation.name.indexOf('<scale:');
        if (!this._setted && ind >= 0) {
            for (var i = 4; !this._settingScale && i > 0; i--)
                this._settingScale = Number(this._animation.name.slice(ind + 7, ind + 7 + i));
        }
        this._setted = true;
        if (cell[3] >= 1000) sprite.scale.x = sprite.scale.y = 2000;
        if (this._rand) {
            sprite.rotation += this._rand[0] * Math.PI / 180;
            sprite.x += this._rand[1] * (this._rand[2] == 0 ? 1 : -1);
//            sprite.scale.x *= -0.90 + this._rand[3] * 0.002;
//            sprite.scale.y *= -0.90 + this._rand[3] * 0.002;
        }
        if (this._settingScale) {
            var scale = this._settingScale / 100;
            sprite.x *= scale, sprite.y *= scale;
            sprite.scale.x *= scale, sprite.scale.y *= scale;
        }
    };
    
    //アニメ名に空白のフラッシュSEを入れたらそこでウェイト終了
    var _Sprite_Animation_processTimingData = Sprite_Animation.prototype.processTimingData;
    Sprite_Animation.prototype.processTimingData = function(timing) {
        _Sprite_Animation_processTimingData.apply(this, arguments);
        if (timing.flashScope === 0 && !timing.se) {
            this._finish = true;
            if (this._target._character) this._target._character._animationNum--;
        }
    };
    Sprite_Base.prototype.isFinishAnimation = function() {
        return this._animationSprites.every(function(sprite) {
            sprite._finish
        });
    };
    Game_CharacterBase.prototype.isAnimationPlaying = function() {
        return (this._animationId > 0 || this._animationPlaying) && this._animationNum;
    };
    var _Game_CharacterBase_requestAnimation = Game_CharacterBase.prototype.requestAnimation;
    Game_CharacterBase.prototype.requestAnimation = function() {
        _Game_CharacterBase_requestAnimation.apply(this, arguments);
        this._animationNum = (this._animationNum || 0) + 1;
    };

    //自動でゲームオーバーにしない
    Scene_Base.prototype.checkGameover = function() {
    };
    
    
    //-----------------------------------------------------------------------------
    // 追加機能 (文字関係)
    //-----------------------------------------------------------------------------
    
    //文字潰れ防止
    // var _Window_Base_drawText = Window_Base.prototype.drawText;
    // Window_Base.prototype.drawText = function(text, x, y, maxWidth, align) {
    //     if (this.contents.fontSize >= 21) return _Window_Base_drawText.apply(this, arguments);
    //     var w = maxWidth || 144, h = this.lineHeight();
    //     var bitmap = this.newDrawText1(text, x, y, w, h, align);
    //     this.newDrawText2(bitmap, this.contents);
    // };
    var _Window_Base_drawTextEx = Window_Base.prototype.drawTextEx;
    Window_Base.prototype.drawTextEx = function(text, x, y) {
        var wid;
        if (text) {
            var textState = { index: 0, x: x, y: y, left: x };
            textState.text = this.convertEscapeCharacters(text);
            textState.height = this.calcTextHeight(textState, false);
            this.resetFontSettings();
            var maxWid = 0;
            while (textState.index < textState.text.length) {
                this.processCharacter(textState);
                maxWid = Math.max(textState.x - x, maxWid);
            }
            this._lastTextExHeight = textState.y - y + textState.height;
            wid = maxWid;
        } else {
            wid = 0;
        }

        if (this.contents.fontSize >= 21) return wid;
        var bitmap = this._newDrawBitmap;
        if (bitmap) this.newDrawText2(bitmap, this.contents);
        return wid;
    };
    //    var _Window_Base_processNormalCharacter = Window_Base.prototype.processNormalCharacter;
    //    Window_Base.prototype.processNormalCharacter = function(textState) {
    //        if (this.contents.fontSize >= 21) return _Window_Base_processNormalCharacter.apply(this, arguments);
    //        var c = textState.text[textState.index++];
    //        var w = this.textWidth(c);
    //        this.newDrawText1(c, textState.x, textState.y, w * 2, textState.height, 'left');
    //        textState.x += w;
    //    };
    Window_Base.prototype.newDrawText1 = function(text, x, y, w, h, align) {
        var cw = this.contents.width * 2, ch = this.contents.height * 2;
        if (!this._newDrawBitmap || this._newDrawBitmap.width < cw || this._newDrawBitmap.height < ch) {
            this._newDrawBitmap = new Bitmap(cw, ch);
            this._newDrawBitmap.smooth = true;
        }
        var bitmap = this._newDrawBitmap;
        bitmap.fontSize = this.contents.fontSize * 2;
        bitmap.textColor = this.contents.textColor;
        bitmap.outlineWidth = this.contents.outlineWidth * 2;
        bitmap.outlineColor = this.contents.outlineColor;
        bitmap.fontBold = this.contents.fontBold;
        bitmap.drawText(text, x * 2, y * 2, w * 2, h * 2, align);
        return bitmap;
    };
    Window_Base.prototype.newDrawText2 = function(textBitmap, drawBitmap) {
        if (!textBitmap) return;
        drawBitmap.blt(textBitmap, 0, 0, textBitmap.width, textBitmap.height,
                       0, 0, textBitmap.width / 2, textBitmap.height / 2);
        textBitmap.clear();
    };

    //拡張文字描写
    Window_Base.prototype.drawTextKNH = function(text, x, y, w, align, align2, fontSize, color) {
        var lastNoResetFontSettings = this._noResetFontSettings;
        this._noResetFontSettings = true;
        var lastFontSize = this.contents.fontSize;
        var lastColor = this.contents.textColor;
        if (fontSize) this.contents.fontSize = fontSize;
        if (color) this.changeTextColor(this.textColor(color));

        var width, height;

        if (align2 && align2 !== 'down') {
            this.drawTextEx(text, -999, -999);
            if (align2 === 'center') y -= this._lastTextExHeight / 2;
            if (align2 === 'up')     y -= this._lastTextExHeight;
        }

        if (align && align !== 'left') {
            var texts = text.split('\n');
            var dx = x, dy = y, dw = 0;
            for (var i = 0; i < texts.length; i++) {
                dw = this.drawTextEx(texts[i], -999, -999);
                if (align === 'center') dx = x + (w - dw) / 2;
                if (align === 'right')  dx = x + w - dw;
                width = Math.max(this.drawTextEx(texts[i], dx, dy), width || 0);
                height += this._lastTextExHeight;
                dy += this._lastTextExHeight;
            }
        } else {
            width = this.drawTextEx(text, x, y);
            height = this._lastTextExHeight;
        }

        this._noResetFontSettings = lastNoResetFontSettings;
        this.contents.fontSize = lastFontSize;
        this.contents.textColor = lastColor;

        return {x : x, y : y, w : Math.ceil(width), h : Math.ceil(height)};
    };
    
    //自動改行機能つき文字描写
    Window_Base.prototype.drawTextNL = function (text, x, y, width, _fontReduce, _skipAutoResize) {
        if (!text) return 0;
        const maxAutoReduce = 5;
        const maxLines = 4;
        const fontReduce = Math.max(0, Number(_fontReduce || 0));
        const skipAutoResize = !!_skipAutoResize;

        const NG_PUNCT = /[。、　., ]/; // 行頭に来てほしくない記号
        const noBreakTokens = ['HP', 'GOD']; //途中で改行されたくないワード
        const isDigit = c => /\d/.test(c); 
        const getLangId = () => {
            try {
                if (typeof _lg === 'function') return Number(_lg()) || 0;
                return Number(_lg || 0) || 0;
            } catch (e) {
                return 0;
            }
        };
        const isEnglish = getLangId() === 1;
        const EN_BREAK_PUNCT = /[,.!?:;]/;
        const EN_HEAD_NG_PUNCT = /[.,!?]/;
        const EN_HYPHEN_MIN_WORD_LEN = 9;
        const EN_HYPHEN_MIN_LEFT = 3;
        const EN_HYPHEN_MIN_RIGHT = 3;
        const EN_COMMON_DIGRAPHS = ['th', 'sh', 'ch', 'ph', 'wh', 'qu', 'ck', 'gh', 'ng'];
        const isAsciiAlpha = c => /[A-Za-z]/.test(c);
        const isAsciiAlphaWord = s => /^[A-Za-z]+$/.test(s);
        const isVowel = c => /[AEIOUYaeiouy]/.test(c || '');
        const ESC = '\x1b';

        const tokens = Array.isArray(noBreakTokens)
            ? noBreakTokens
            : (this._noBreakTokens || []);

        const ts = { index: 0, x: x, y: y, left: x, right: x + width };
        ts.text = this.convertEscapeCharacters(text);
        ts.height = this.calcTextHeight(ts, false);
        this.resetFontSettings();
        if (fontReduce > 0) this.contents.fontSize = Math.max(8, this.contents.fontSize - fontReduce);

        let lineCount = 1;
        const finalizeDraw = (drawWidth) => {
            if (!skipAutoResize && lineCount > maxLines && fontReduce < maxAutoReduce) {
                const clearH = Math.ceil(Math.max(ts.height * lineCount, ts.height) + 2);
                this.contents.clearRect(Math.floor(x), Math.floor(y), Math.ceil(width), clearH);
                return this.drawTextNL(text, x, y, width, fontReduce + 1, false);
            }
            return drawWidth;
        };

        const wrapLine = () => {
            ts.x = ts.left;
            ts.y += ts.height;
            lineCount++;
        };

        const processInsertedChar = (char) => {
            const tmp = {
                index: 0,
                x: ts.x,
                y: ts.y,
                left: ts.left,
                right: ts.right,
                text: char,
                height: ts.height
            };
            this.processCharacter(tmp);
            ts.x = tmp.x;
            ts.y = tmp.y;
        };

        const pickExistingHyphenBreakIndex = (token, availWidth) => {
            if (token.indexOf('-') < 0) return -1;
            for (let i = token.length - 1; i >= 1; i--) {
                if (token[i - 1] !== '-') continue; // 区切り位置はハイフンの直後
                const left = token.slice(0, i);
                const right = token.slice(i);
                if (!right) continue;
                if (this.textWidth(left) <= availWidth) return i;
            }
            return -1;
        };

        const scoreHyphenPoint = (word, i) => {
            const a = word[i - 1], b = word[i], p = word[i - 2], n = word[i + 1];
            const pair = (String(a || '') + String(b || '')).toLowerCase();
            if (EN_COMMON_DIGRAPHS.contains(pair)) return -100;

            const av = isVowel(a), bv = isVowel(b), pv = isVowel(p), nv = isVowel(n);
            let score = 0;

            // VCCV / VC-V 系を優先（簡易）
            if (pv && !av && !bv && nv) score += 5;
            else if (av && !bv && nv) score += 4;
            else if (av && !bv) score += 2;
            else if (!av && bv) score += 1;
            else if (av && bv) score -= 2;

            // 接尾辞の直前っぽい位置を少し優先
            const suffix = word.slice(i).toLowerCase();
            if (/^(ing|tion|sion|ment|ness|less|able|ible|ally|edly|edly|ed|er|ly|ful|ous)$/.test(suffix)) score += 1;

            return score;
        };

        const pickHyphenationIndex = (word, availWidth) => {
            if (!isAsciiAlphaWord(word)) return -1;
            if (word.length < EN_HYPHEN_MIN_WORD_LEN) return -1;

            const fitCandidates = [];
            for (let i = EN_HYPHEN_MIN_LEFT; i <= word.length - EN_HYPHEN_MIN_RIGHT; i++) {
                const left = word.slice(0, i) + '-';
                if (this.textWidth(left) > availWidth) continue;
                fitCandidates.push({ i: i, score: scoreHyphenPoint(word, i) });
            }
            if (!fitCandidates.length) return -1;

            // まず自然さ（score）を優先。スコア同点なら右側（行末に詰める）を優先。
            let best = fitCandidates[0];
            for (let k = 1; k < fitCandidates.length; k++) {
                const c = fitCandidates[k];
                if (c.score > best.score || (c.score === best.score && c.i > best.i)) {
                    best = c;
                }
            }
            if (best.score >= 0) return best.i;

            // 全候補が低スコアの場合のみ、従来どおり右寄せ
            return fitCandidates[fitCandidates.length - 1].i;
        };

        const getNextTokenAfterSpaces = (index) => {
            let i = index;
            while (i < ts.text.length && ts.text[i] === ' ') i++;
            if (i >= ts.text.length) return null;
            const c = ts.text[i];
            if (c === '\n' || c === ESC) return null;
            let end = i;
            while (end < ts.text.length) {
                const ch = ts.text[end];
                if (ch === ' ' || ch === '_' || ch === '\n' || ch === ESC || EN_BREAK_PUNCT.test(ch)) break;
                end++;
            }
            if (end <= i) return null;
            return ts.text.slice(i, end);
        };

        if (isEnglish) {
            while (ts.index < ts.text.length) {
                const ch = ts.text[ts.index];

                // 明示改行/制御文字は優先
                if (ch === '\n' || ch === ESC) {
                    this.processCharacter(ts);
                    continue;
                }

                // 数字列＋小数点＋％（半角／全角）は従来どおり一塊
                if (isDigit(ch)) {
                    let end = ts.index;
                    while (end < ts.text.length && (isDigit(ts.text[end]) || ts.text[end] === '.')) end++;
                    if (ts.text[end] === '%' || ts.text[end] === '％') end++;
                    let token = ts.text.slice(ts.index, end);
                    let tokenW = this.textWidth(token);
                    if (tokenW > width) {
                        tokenW = this.textWidth(ch);
                        end = ts.index + 1;
                        token = ts.text[ts.index];
                    }
                    if (ts.x + tokenW > ts.right) {
                        wrapLine();
                        continue;
                    }
                    while (ts.index < end) this.processCharacter(ts);
                    continue;
                }

                // 半角スペース連続は「改行判定上は1個扱い」。行頭には出さない
                if (ch === ' ') {
                    let end = ts.index;
                    while (ts.text[end] === ' ') end++;
                    if (ts.x <= ts.left) {
                        ts.index = end; // 行頭スペースはスキップ
                        continue;
                    }
                    const spaceW = this.textWidth(' ');
                    if (ts.x + spaceW > ts.right) {
                        wrapLine();
                        ts.index = end; // 改行後の先頭スペースもスキップ
                        continue;
                    }
                    while (ts.index < end) this.processCharacter(ts);
                    continue;
                }

                // 英語句読点は改行候補。ただし .,!?
                if (EN_BREAK_PUNCT.test(ch)) {
                    const charW = this.textWidth(ch);
                    if (ts.x + charW > ts.right) {
                        if (EN_HEAD_NG_PUNCT.test(ch)) {
                            this.processCharacter(ts); // 行頭回避のため行末側へ押し込む
                            wrapLine();
                        } else {
                            wrapLine();
                        }
                        continue;
                    }
                    this.processCharacter(ts);
                    continue;
                }

                // アンダースコアは区切り文字として扱う（単語トークンから分離）
                if (ch === '_') {
                    const charW = this.textWidth(ch);
                    if (ts.x + charW > ts.right) {
                        wrapLine();
                        continue;
                    }
                    this.processCharacter(ts);
                    continue;
                }

                // 単語（スペース/句読点/改行/制御文字/_ まで）を一塊として扱う
                let end = ts.index;
                while (end < ts.text.length) {
                    const c = ts.text[end];
                    if (c === ' ' || c === '_' || c === '\n' || c === ESC || EN_BREAK_PUNCT.test(c)) break;
                    end++;
                }
                if (end <= ts.index) { // 保険
                    this.processCharacter(ts);
                    continue;
                }

                const token = ts.text.slice(ts.index, end);
                const tokenW = this.textWidth(token);
                const remainW = ts.right - ts.x;
                if (tokenW <= width) {
                    if (ts.x + tokenW > ts.right) {
                        const hyphenBreak = pickExistingHyphenBreakIndex(token, remainW);
                        if (hyphenBreak > 0) {
                            const tokenEnd = ts.index + hyphenBreak;
                            while (ts.index < tokenEnd) this.processCharacter(ts);
                            wrapLine();
                            continue;
                        }
                        // 既存ハイフンがない長い英単語は、行末に詰める形でその場ハイフネーション
                        if (isAsciiAlphaWord(token) && token.length >= EN_HYPHEN_MIN_WORD_LEN) {
                            const splitForFit = pickHyphenationIndex(token, remainW);
                            if (splitForFit > 0 && splitForFit < token.length) {
                                const tokenEnd = ts.index + splitForFit;
                                while (ts.index < tokenEnd) this.processCharacter(ts);
                                processInsertedChar('-');
                                wrapLine();
                                continue;
                            }
                        }
                        wrapLine();
                        continue;
                    }

                    // 単語自体は入るが、次語が同じ行に入らない場合は長語を事前にハイフネーション
                    if (isAsciiAlphaWord(token) && token.length >= EN_HYPHEN_MIN_WORD_LEN) {
                        const nextToken = getNextTokenAfterSpaces(end);
                        if (nextToken) {
                            const pairW = this.textWidth(token + ' ' + nextToken);
                            if (ts.x + pairW > ts.right) {
                                const splitForPair = pickHyphenationIndex(token, remainW);
                                if (splitForPair > 0 && splitForPair < token.length) {
                                    const tokenEnd = ts.index + splitForPair;
                                    while (ts.index < tokenEnd) this.processCharacter(ts);
                                    processInsertedChar('-');
                                    wrapLine();
                                    continue;
                                }
                            }
                        }
                    }

                    while (ts.index < end) this.processCharacter(ts);
                    continue;
                }

                // 既存ハイフン位置を最優先で利用
                const hyphenBreak = pickExistingHyphenBreakIndex(token, remainW);
                if (hyphenBreak > 0) {
                    const tokenEnd = ts.index + hyphenBreak;
                    while (ts.index < tokenEnd) this.processCharacter(ts);
                    wrapLine();
                    continue;
                }
                if (ts.x > ts.left) {
                    // 行頭に送れば入る可能性がある場合は先に送る
                    const hyphenBreakFull = pickExistingHyphenBreakIndex(token, width);
                    if (tokenW <= width || hyphenBreakFull > 0 || pickHyphenationIndex(token, width) > 0) {
                        wrapLine();
                        continue;
                    }
                }

                // 長い英単語（アルファベットのみ・12文字以上）は簡易ハイフネーション
                const split = pickHyphenationIndex(token, ts.right - ts.x);
                if (split > 0) {
                    const tokenEnd = ts.index + split;
                    while (ts.index < tokenEnd) this.processCharacter(ts);
                    processInsertedChar('-');
                    wrapLine();
                    continue;
                }

                // 単語自体が長すぎる場合のみ途中改行を許可（フォールバック）
                while (ts.index < end) {
                    const cw = this.textWidth(ts.text[ts.index]);
                    if (ts.x + cw > ts.right) wrapLine();
                    this.processCharacter(ts);
                }
            }
            return finalizeDraw(ts.x - x);
        }

        while (ts.index < ts.text.length) {
            const ch = ts.text[ts.index];

            /* --- 1) 任意の改行禁止トークンを優先的に判定 --- */
            let matchedToken = null;
            if (tokens && tokens.length) {
                for (const t of tokens) {
                    if (!t) continue;
                    if (ts.text.startsWith(t, ts.index) && (!matchedToken || t.length > matchedToken.length)) matchedToken = t;
                }
            }
            if (matchedToken) {
                let tokenW = this.textWidth(matchedToken);
                const tokenEnd = ts.index + matchedToken.length;
                if (tokenW > width) tokenW = this.textWidth(ch);
                if (ts.x + tokenW > ts.right) {
                    wrapLine();
                    continue;
                }
                while (ts.index < tokenEnd) this.processCharacter(ts);
                continue;
            }

            /* --- 2) 数字列＋小数点＋％（半角／全角）を一塊として処理 --- */
            if (isDigit(ch)) {
                let end = ts.index;
                while (end < ts.text.length && (isDigit(ts.text[end]) || ts.text[end] === '.')) end++;
                if (ts.text[end] === '%' || ts.text[end] === '％') end++;
                let token = ts.text.slice(ts.index, end);
                let tokenW = this.textWidth(token);
                if (tokenW > width) {
                    tokenW = this.textWidth(ch);
                    end = ts.index + 1;
                    token = ts.text[ts.index];
                }
                if (ts.x + tokenW > ts.right) {
                    wrapLine();
                    continue;
                }
                while (ts.index < end) this.processCharacter(ts);
                continue;
            }

            /* --- 3) 非数字文字／句読点処理 --- */
            const charW = this.textWidth(ch);
            if (ts.x + charW > ts.right) {
                if (NG_PUNCT.test(ch)) {
                    this.processCharacter(ts);
                    wrapLine();
                } else {
                    wrapLine();
                }
                continue;
            }

            // 通常描画
            this.processCharacter(ts);
        }
        return finalizeDraw(ts.x - x);
    };

    //制御文字追加
    var _Bitmap__makeFontNameText      = Bitmap.prototype._makeFontNameText;
    Bitmap.prototype._makeFontNameText = function() {
        return (this.fontBold ? 'bold ' : '') + _Bitmap__makeFontNameText.apply(this, arguments);
    };
    var _Window_Base_processEscapeCharacter = Window_Base.prototype.processEscapeCharacter;
    Window_Base.prototype.processEscapeCharacter = function(code, textState) {
        switch (code) {
            case 'B':
                this.contents.fontBold = !this.contents.fontBold;
                break;
            case 'S':
                this.contents.fontSize = this.obtainEscapeParam(textState);
                break;
            case 'PS':
                this.contents.fontSize += this.obtainEscapeParam(textState);
                break;
            case 'MS':
                this.contents.fontSize -= this.obtainEscapeParam(textState);
                break;
            case 'X':
                textState.x += this.obtainEscapeParam(textState);
                break;
            case 'MX':
                textState.x -= this.obtainEscapeParam(textState);
                break;
            case 'Y':
                textState.y += this.obtainEscapeParam(textState);
                break;
            case 'MY':
                textState.y -= this.obtainEscapeParam(textState);
                break;
            default:
                _Window_Base_processEscapeCharacter.call(this, code, textState);
                break;
        }
    };
    var _Window_Base_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
    Window_Base.prototype.convertEscapeCharacters = function(text) {
        text = _Window_Base_convertEscapeCharacters.apply(this, arguments);
        text = text.replace(/\x1bIT\[(\d+)\]/gi, function() {
            var item = $dataItems[arguments[1]];
            return item ? '\x1bi[' + item.iconIndex + ']' + item.name : '';
        }.bind(this));
        text = text.replace(/\x1bWP\[(\d+)\]/gi, function() {
            var item = $dataWeapons[arguments[1]];
            return item ? '\x1bi[' + item.iconIndex + ']' + item.name : '';
        }.bind(this));
        text = text.replace(/\x1bAM\[(\d+)\]/gi, function() {
            var item = $dataArmors[arguments[1]];
            return item ? '\x1bi[' + item.iconIndex + ']' + item.name : '';
        }.bind(this));
        if (/\\[A-Za-z]/.test(text)) text = this.convertEscapeCharacters(text);
        return text;
    };
    
    //アイコンの大きさをフォントサイズに合わせる
    Window_Base.prototype.drawIcon = function(iconIndex, x, y, ss) {
        var bitmap = ImageManager.loadSystem('IconSet');
        var pw = Window_Base._iconWidth, ph = Window_Base._iconHeight;
        var sx = iconIndex % 16 * pw,    sy = Math.floor(iconIndex / 16) * ph;
        ss = Math.floor(ss || (pw * this.contents.fontSize) / 32);
        y = Math.ceil(y + 10 - this.contents.fontSize / 3);
        this.contents._context.imageSmoothingEnabled = false;
        this.contents.blt(bitmap, sx, sy, pw, ph, x, y, ss, ss);
    };
    Window_Base.prototype.processDrawIcon = function(iconIndex, textState) {
        this.drawIcon(iconIndex, textState.x + 2 * this.contents.fontSize / 32, textState.y);
        textState.x += (Window_Base._iconWidth + 2) * this.contents.fontSize / 32;
        if (iconIndex === 16) textState.x -= 10 * this.contents.fontSize / 32;
    };

    //フォントリセットを行わない機能
    var _Window_Base_resetFontSettings = Window_Base.prototype.resetFontSettings;
    Window_Base.prototype.resetFontSettings = function() {
        if (this._noResetFontSettings) return;
        _Window_Base_resetFontSettings.apply(this, arguments);
    };


    //-----------------------------------------------------------------------------
    // 追加機能 (Window関係)
    //-----------------------------------------------------------------------------
    
    //余白なし透明ウィンドウ
    Window_Free.prototype = Object.create(Window_Base.prototype);
    Window_Free.prototype.constructor = Window_Free;

    Window_Free.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this.setBackgroundType(2);
    };
    Window_Free.prototype.standardPadding = function() {return 0};
    
    
    //リフレッシュOpen
    Window_Base.prototype.refreshOpen = function() {
        if (this.refresh) this.refresh();
        this.openness = 0, this.open();
    };
    
    //Window_Base でも isTouchedInsideFrame 使用可
    Window_Base.prototype.isTouchedInsideFrame = function() {
        var x = this.canvasToLocalX(TouchInput.x);
        var y = this.canvasToLocalY(TouchInput.y);
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    };

    //マウス位置の記録を常に行う
    TouchInput._onMouseMove = function(event) {
        var x = Graphics.pageToCanvasX(event.pageX);
        var y = Graphics.pageToCanvasY(event.pageY);
        this._onMove(x, y);
    };

    //ボタン仕様変更
    var _Sprite_Button_initialize = Sprite_Button.prototype.initialize;
    Sprite_Button.prototype.initialize = function(bitmap) {
        _Sprite_Button_initialize.call(this);
        if (bitmap) this.bitmap = bitmap;
        this.anchor = new Point(0.5, 0.5);
        this.active = true;
    };

    //ボタン仕様変更　ボタンスプライトをキー降下中の際にもhotFrameに設定　キーによる起動
    Sprite_Button.prototype.processTouch = function() {
        var inputPressed = this._input && (Input.isPressed(this._input) ||
                                           (this._input === 'cancel' && TouchInput.isCancelled()));
        var touchInputPressed = TouchInput.isPressed() && this.isButtonTouched();
        if (this.isActive() && this.active) {
            if ((TouchInput.isTriggered() && this.isButtonTouched()) || inputPressed) this._touching = true;
            if (this._touching) {
                if (TouchInput.isPressed() && !this.isButtonTouched())
                    this._touching = false;
                else if (!TouchInput.isPressed() && !inputPressed) {
                    this._touching = false;
                    if (!this._longPressed) this.callClickHandler();
                    else this._longPressed = false;
                }
            }
        } else {
            if (!this._canTouchContinuously || (!inputPressed && !touchInputPressed)) this._touching = false;
        }
    };

    //ボタン　透明部分の判定をなくす
    var _Sprite_Button_isButtonTouched = Sprite_Button.prototype.isButtonTouched;
    Sprite_Button.prototype.isButtonTouched = function() {
        var x = this.canvasToLocalX(TouchInput.x);
        var y = this.canvasToLocalY(TouchInput.y);
        var sx = -this.anchor.x * this.width, sy = -this.anchor.y * this.height;
        if (x >= sx && y >= sy && x < sx + this.width && y < sy + this.height) {
            var px = x - sx + (this._frame.x || 0);
            var py = y - sy + (this._frame.y || 0);
            return this.bitmap.getPixel(px, py) !== '#000000';
        } else {
            return false;
        }
    };

    //ボタン　テキストを表示　非アクティブで半透明 & _helpCursorTextの処理
    var _Sprite_Button_update = Sprite_Button.prototype.update;
    Sprite_Button.prototype.update = function() {
        _Sprite_Button_update.apply(this, arguments);

        if (this._text && this.width) {
            if (!this._textSprite) {
                this._textSprite = new Window_Free(0, 0, this.width, this.height);
                this.addChild(this._textSprite);
            }
            this._lastInfo = this._lastInfo || '';
            var info = [this._text, this._textFontSize, this._textColor].toString();
            if (this._lastInfo !== info) {
                this._lastInfo = info;
                this._textSprite.contents.clear();
                this._textSprite.contents.fontSize = this._textFontSize || 12;
                this._textSprite.contents.textColor = this._textColor || 'white';
                this._textSprite.drawTextKNH(this._text, 0, this.height / 2, this.width, 'center', 'center', 20);
            }
            this._textSprite.visible = this.visible;
            this._textSprite.x = -this.width / 2 + (this._textX || 0);
            this._textSprite.y = -this.height / 2 + (this._textY || 0);
            this.opacity = this.isActive() && this.active ? 255 : 192;
        }

        if (this._input && this.width) {
            if (!this._inputSprite) {
                var ins = this._inputSprite = new Sprite(ImageManager.loadSystem('IconSet'));
                ins.anchor = new Point(0.5, 0.5);
                this.addChild(ins);
            }
            var ins = this._inputSprite;
            var info = [this._input, $gameVariables.value(12)].toString();
            if (this._lastInfoInput !== info) {
                this._lastInfoInput = info;
                var iconIndex = [320, 321, 322, 323, 324, 325][['ok', 'cancel', 'debugRoom', 'changeAuto', 'L', 'R'].indexOf(this._input)];
                if ($gameVariables.value(12)) iconIndex += 16;
                ins.setFrame(iconIndex % 16 * 32, Math.floor(iconIndex / 16) * 32, 32, 32);
            }
            if (this._inputXy) ins.x = this._inputXy[0], ins.y = this._inputXy[1];
            ins.visible = this.active;
        }

        if (this._helpCursorText && this.active && this.visible && this.isButtonTouched()) {
            $gameTemp._helpCursorText = this._helpCursorText; 
        }

        this.opacity = this.active ? 255 : 160;

        this.scale.x = this.scale.y = this._touching ? 0.95 : 1;
    };

    var _Sprite_Button_isButtonTouched = Sprite_Button.prototype.isButtonTouched;
    Sprite.prototype.isButtonTouched = function() {
        return _Sprite_Button_isButtonTouched.apply(this, arguments);
    };
    var _Sprite_Button_canvasToLocalX = Sprite_Button.prototype.canvasToLocalX;
    Sprite.prototype.canvasToLocalX = function(x) {
        return _Sprite_Button_canvasToLocalX.apply(this, arguments);
    };
    var _Sprite_Button_canvasToLocalY = Sprite_Button.prototype.canvasToLocalY;
    Sprite.prototype.canvasToLocalY = function(y) {
        return _Sprite_Button_canvasToLocalY.apply(this, arguments);
    };
    
    //-----------------------------------------------------------------------------
    // 追加機能 (Character関係)
    //-----------------------------------------------------------------------------
    
    //キャラの目の前のx,yを得る
    Game_CharacterBase.prototype.frontX = function() {
        return $gameMap.roundXWithDirection(this.x, this._direction);
    };
    Game_CharacterBase.prototype.frontY = function() {
        return $gameMap.roundYWithDirection(this.y, this._direction);
    };
    
    //キャラとの距離をだす
    Game_CharacterBase.prototype.distanceFrom = function(character) {
        var x = character.x, y = character.y;
        return Math.sqrt(Math.pow(this.deltaXFrom(x), 2) + Math.pow(this.deltaYFrom(y), 2));
    };
    
    //キャラとの正確な距離をだす
    Game_CharacterBase.prototype.realDistanceFrom = function(character) {
        var x = character._realX, y = character._realY;
        return Math.sqrt(Math.pow($gameMap.deltaX(this._realX, x), 2) + Math.pow($gameMap.deltaY(this._realY, y), 2));
    };
    
    //キャラクターのいる方向を取得する
    Game_Character.prototype.getTowardCharacter = function(character) {
        if (!character) return 2;
        var sx = this.deltaXFrom(character._realX), sy = this.deltaYFrom(character._realY);
        if (Math.abs(sx) > Math.abs(sy)) return sx > 0 ? 4 : 6;
        else if (sy !== 0) return sy > 0 ? 8 : 2;
        return this._direction;
    };

    Game_Character.prototype.turnTowardCharacter = function(character) {
        this.setDirection(this.getTowardCharacter(character));
    };
    
    //移動ルート設定の前に this._forceCharacter に入れると そのキャラの移動ルート設定になる
    Game_Interpreter.prototype.command205 = function() {
        $gameMap.refreshIfNeeded();
        this._character = this.character(this._params[0]);
        if (this._params[0] === 0 && !this._character) this._character = $gamePlayer;
        if (this._forceCharacter) this._character = this._forceCharacter;
        this._forceCharacter = null;
        if (this._character) {
            this._character.forceMoveRoute(this._params[1]);
            if (this._params[1].wait) this.setWaitMode('route');
        }
        return true;
    };
    //InterpreterのwaitModeに「this._characterが停止しているか」を追加
    const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === 'move') {
            var waiting = this._character && !this._character.isStopping();
            if (!waiting) this._waitMode = '';
            return waiting;
        } else if (this._waitMode === 'ok') {
            var waiting = !Input.isTriggered('ok') && !TouchInput.isTriggered();
            if (!waiting) this._waitMode = '';
            return waiting;
        }
        return _Game_Interpreter_updateWaitMode.call(this);
    };

    //キャラのスプライトを取得
    Game_CharacterBase.prototype.sprite = function() {
        if (!SceneManager._scene._spriteset) return;
        return SceneManager._scene._spriteset._characterSprites.filter(function(sprite, index) {
            return sprite._character && sprite._character === this;
        }, this)[0];
    };
    //プレイヤーのスプライトを取得
    Game_Player.prototype.sprite = function() {
        if (!SceneManager._scene._spriteset) return;
        return SceneManager._scene._spriteset._characterSprites.filter(function(sprite, index) {
            return sprite._character instanceof Game_Player;
        }, this)[0];
    };
    //イベントのスプライトを取得
    Game_Event.prototype.sprite = function() {
        if (!SceneManager._scene._spriteset) return;
        return SceneManager._scene._spriteset._characterSprites.filter(function(sprite, index) {
            return sprite._character instanceof Game_Event &&
                sprite._character._eventId === this._eventId;
        }, this)[0];
    };
    //ピクチャのスプライトを取得
    Game_Picture.prototype.sprite = function() {
        return SceneManager._scene._spriteset._pictureContainer.children.filter(function(sprite) {
            var realPictureId = $gameScreen.realPictureId(sprite._pictureId);
            return sprite instanceof Sprite_Picture && realPictureId === $gameScreen._pictures.indexOf(this);
        }, this)[0];
    };

    //キャラのサイズをビットマップから取得
    Game_CharacterBase.prototype.height = function() {
        if (this._height) return this._height;
        if (!this.sprite || !this.sprite() || !this.sprite().bitmap) return 48;
        return this.sprite()._frame.height;
    };
    Game_CharacterBase.prototype.width = function() {
        if (this._width) return this._width;
        if (!this.sprite || !this.sprite() || !this.sprite().bitmap) return 48;
        return this.sprite()._frame.width;
    };

    //イベントの消去を完全消去にする
    Game_Event.prototype.erase = function() {
        this._erased = true;
        this.refresh();
        delete $gameMap._events[this._eventId];
        //        $gameMap.rejudgeEvents();
        SceneManager._scene._spriteset._characterSprites.forEach(function(sprite, index) {
            if (sprite._character instanceof Game_Event && sprite._character._eventId === this._eventId) {
                SceneManager._scene._spriteset._characterSprites.splice(index, 1);
                sprite._animationSprites.forEach(function(animation) {
                    animation.remove();
                });
                if (sprite._hpGaugeSprite) SceneManager._scene._spriteset._baseSprite.removeChild(sprite._hpGaugeSprite);
                if (sprite._stateSprite) sprite.removeChild(sprite._stateSprite);
                if (sprite._iconSprite) sprite.removeChild(sprite._iconSprite);
                sprite.visible = false;
                sprite = null;
            }
        }, this);
        SceneManager._scene._spriteset._tilemap.children.forEach(function(sprite, index) {
            if (sprite._character instanceof Game_Event && sprite._character._eventId === this._eventId) {
                SceneManager._scene._spriteset._tilemap.children.splice(index, 1);
                sprite.visible = false;
                sprite = null;
            }
        }, this);
    };
    Game_Map.prototype.eraseEvent = function(eventId) {
        if (this._events[eventId]) this._events[eventId].erase();
    };

    //-----------------------------------------------------------------------------
    // 追加機能（演出関係）
    //-----------------------------------------------------------------------------
    
    Game_Map.prototype.setCenter = function(x, y) {
        this.setDisplayPos(x - $gamePlayer.centerX(), y - $gamePlayer.centerY());
    };

    //SE再生　キャラから再生
    Game_CharacterBase.prototype.playSe = function(seName, volume, pitch, noChangePan) {
        if (this._count < 10) return; //最初何フレームかは音を出さない
        var pan = noChangePan ? 0 : this.sePan();
        var cx = Graphics.boxWidth / 2, cy = Graphics.boxHeight / 2;
        var d = Math.sqrt(Math.pow(this.screenX() - cx, 2) + Math.pow(this.screenY() - cy, 2)) / 48;
        AudioManager.playSe({
            name : seName,
            volume : Math.round((volume || 80) * this.seVolumeRate()),
            pitch : Math.round(pitch || 100),
            pan : Math.round(pan)
        });
        this._playingSe = AudioManager._seBuffers[AudioManager._seBuffers.length - 1];
        this._playingSeInfo = [volume, noChangePan];
    };
    Game_CharacterBase.prototype.stopSe = function() {
        if (this._playingSe) {
            this._playingSe.stop();
            this._playingSe = null;
            this._playingSeInfo = [];
        }
    };

    //SE再生簡易
    Game_System.prototype.playSe = function(seName, volume, pitch, pan) {
        AudioManager.playSe({
            name : seName,
            volume : volume || 80,
            pitch : pitch || 100,
            pan : pan || 0
        });
        return AudioManager._seBuffers[AudioManager._seBuffers.length - 1];
    };
    Game_System.prototype.playStaticSe = function(seName, volume, pitch, pan) {
        AudioManager.playStaticSe({
            name : seName,
            volume : volume || 80,
            pitch : pitch || 100,
            pan : pan || 0
        });
        return AudioManager._seBuffers[AudioManager._seBuffers.length - 1];
    };

    Game_CharacterBase.prototype.sePan = function() {
        var x = this._realX;
        var cx = $gameMap.displayX() + Graphics.boxWidth / 48 / $gameScreen.zoomScale() / 2;
        var pan = ((x - cx) / 15 * 100).clamp(-80, 80);
        return pan;
    };
    Game_CharacterBase.prototype.seVolumeRate = function() {
        var cx = $gameMap.displayX() + Graphics.boxWidth / 48 / $gameScreen.zoomScale() / 2;
        var cy = $gameMap.displayY() + Graphics.boxWidth / 48 / $gameScreen.zoomScale() / 2;
        var volume = (1 - Math.sqrt(Math.pow(this._realX - cx, 2) + Math.pow(this._realY - cy, 2)) / 20).clamp(0, 1);
        return volume;
    };

    //再生SE数に制限
    var _AudioManager_playSe = AudioManager.playSe;
    AudioManager.playSe = function(se) {
        if ($gameTemp && $gameTemp._seCount >= 6) return;
        _AudioManager_playSe.apply(this, arguments);
        $gameTemp._seCount++;
    };

    //キャラからシェイク
    Game_CharacterBase.prototype.startShake = function(power, speed, duration) {
        power = power || 2, speed = speed || 5, duration = duration || 6;
        var cx = Graphics.boxWidth / 2, cy = Graphics.boxHeight / 2;
        var d = Math.sqrt(Math.pow(this.screenX() - cx, 2) + Math.pow(this.screenY() - cy, 2)) / 48;
        power *= (1 - d / 20).clamp(0.1, 1);
        $gameScreen.startShake(power, speed, duration);
    };

    //画面のシェイクを改良
    Game_Screen.prototype.startShake = function(power, speed, duration) {
        this._shakePower = this._shakePower * (this._shakeDuration / 20).clamp(0, 1) + power;
        this._shakeSpeed = speed;
        this._shakeDuration = Math.max(this._shakeDuration, duration);
    };
    var _Spriteset_Base_updatePosition = Spriteset_Base.prototype.updatePosition;
    Spriteset_Base.prototype.updatePosition = function() {
        _Spriteset_Base_updatePosition.apply(this, arguments);
        this.x = Math.round(-$gameScreen.zoomX() * ($gameScreen.zoomScale() - 1));

        // if ($gameScreen.shake()) this._shake = $gameScreen.shake();
        // else this._shake > 0 ? this._shake -= 0.5 : this._shake = 0;
        // if (this._shake) {
        //     this.x += _rand(-this._shake * 2, +this._shake * 2);
        //     this.y += _rand(-this._shake * 2, +this._shake * 2);
        // }
    };
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.apply(this, arguments);

        this.x = this.y = 0;
        if ($gameScreen.shake()) this._shake = $gameScreen.shake();
        else this._shake > 0 ? this._shake -= 0.5 : this._shake = 0;
        if (this._shake) {
            this.x += _rand(-this._shake * 2, +this._shake * 2);
            this.y += _rand(-this._shake * 2, +this._shake * 2);
        }
    };
    Game_Screen.prototype.updateShake = function() {
        this._shake = this._shakeDuration > 0 ? this._shakePower : 0;
        this._shakeDuration--;
    };

    //最初からフェードアウト状態のマップ
    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        this._numRegionEnemies = [];
        _Game_Map_setup.apply(this, arguments);
        if ($dataMap.meta && $dataMap.meta.fadeOutStart) $gameScreen.startFadeOut(1);
    };

    //イージングを任意のオブジェクトに適用する
    SceneManager.setEasing = function(obj, name, easing, before, target, duration) {
        this._easingList = this._easingList || [];
        var info = [obj, name, easing, before, target - before, duration, 0];
        this._easingList.push(info);
        obj._easingPlaying = true;
    };
    SceneManager.clearEasing = function(obj, nameList) {
        this._easingList = this._easingList || [];
        var clearList = [];
        this._easingList.forEach(function(easing) {
            if (easing[0] === obj && nameList.contains(easing[1])) {
                easing[0][easing[1]] = easing[3] + easing[4];
                clearList.push(easing);
            }
        })
        clearList.forEach(function(easing) {
            this._easingList.splice(this._easingList.indexOf(easing), 1);
        }, this)
    };
    var _SceneManager_update = SceneManager.update;
    SceneManager.update = function() {
        _SceneManager_update.apply(this, arguments);
        this.updateEasing();
    };
    SceneManager.updateEasing = function() {
        if (!this._easingList || !this._easingList.length) return;
        this._easingList.forEach(function(easing, i) {
            var obj = easing[0];
            obj[easing[1]] = _easing[easing[2]](easing[6]++, easing[3], easing[4], easing[5]);
            if (easing[6] >= easing[5]) {
                obj[easing[1]] = easing[3] + easing[4];
                this._easingList.splice(i, 1);
                obj._easingPlaying = false;
            }
        }, this)
    };
    //以下イージング
    var _easing = {
        // t: current time, b: begInnIng value, c: change In value, d: duration
        linear: function(t, b, c, d) {return c*(t/d) + b;},
        easeInQuad: function (t, b, c, d) {return c*(t/=d)*t + b;},
        easeOutQuad: function (t, b, c, d) {return -c *(t/=d)*(t-2) + b;},
        easeInOutQuad: function (t, b, c, d) {if ((t/=d/2) < 1) return c/2*t*t + b;return -c/2 * ((--t)*(t-2) - 1) + b;},
        easeInCubic: function (t, b, c, d) {return c*(t/=d)*t*t + b;},
        easeOutCubic: function (t, b, c, d) {return c*((t=t/d-1)*t*t + 1) + b;},
        easeInOutCubic: function (t, b, c, d) {if ((t/=d/2) < 1) return c/2*t*t*t + b;return c/2*((t-=2)*t*t + 2) + b;},
        easeInQuart: function (t, b, c, d) {return c*(t/=d)*t*t*t + b;},
        easeOutQuart: function (t, b, c, d) {return -c * ((t=t/d-1)*t*t*t - 1) + b;},
        easeInOutQuart: function (t, b, c, d) {if ((t/=d/2) < 1) return c/2*t*t*t*t + b;return -c/2 * ((t-=2)*t*t*t - 2) + b;},
        easeInQuint: function (t, b, c, d) {return c*(t/=d)*t*t*t*t + b;},
        easeOutQuint: function (t, b, c, d) {return c*((t=t/d-1)*t*t*t*t + 1) + b;},
        easeInOutQuint: function (t, b, c, d) {if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;return c/2*((t-=2)*t*t*t*t + 2) + b;},
        easeInSine: function (t, b, c, d) {return -c * Math.cos(t/d * (Math.PI/2)) + c + b;},
        easeOutSine: function (t, b, c, d) {return c * Math.sin(t/d * (Math.PI/2)) + b;},
        easeInOutSine: function (t, b, c, d) {return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;},
        easeInExpo: function (t, b, c, d) {return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;},
        easeOutExpo: function (t, b, c, d) {return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;},
        easeInOutExpo: function (t, b, c, d) {if (t==0) return b;if (t==d) return b+c;if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;},
        easeInCirc: function (t, b, c, d) {return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;},
        easeOutCirc: function (t, b, c, d) {return c * Math.sqrt(1 - (t=t/d-1)*t) + b;},
        easeInOutCirc: function (t, b, c, d) {if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;},
        easeInElastic: function (t, b, c, d) {var s=1.70158;var p=0;var a=c;if (c==0||t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;if (a < Math.abs(c)) { a=c; var s=p/4; }else var s = p/(2*Math.PI) * Math.asin (c/a);return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;},
        easeOutElastic: function (t, b, c, d) {var s=1.70158;var p=0;var a=c;if (c==0||t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;if (a < Math.abs(c)) { a=c; var s=p/4; }else var s = p/(2*Math.PI) * Math.asin (c/a);return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;},
        easeInOutElastic: function (t, b, c, d) {var s=1.70158;var p=0;var a=c;if (c==0||t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);if (a < Math.abs(c)) { a=c; var s=p/4; }else var s = p/(2*Math.PI) * Math.asin (c/a);if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;},
        easeInBack: function (t, b, c, d, s) {if (s == undefined) s = 1.70158;return c*(t/=d)*t*((s+1)*t - s) + b;},
        easeOutBack: function (t, b, c, d, s) {if (s == undefined) s = 1.70158;return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;},
        easeInOutBack: function (t, b, c, d, s) {if (s == undefined) s = 1.70158; if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;},
        easeInBounce: function (t, b, c, d) {return c - this.easeOutBounce(d-t, 0, c, d) + b;},
        easeOutBounce: function (t, b, c, d) {if ((t/=d) < (1/2.75)) {return c*(7.5625*t*t) + b;} else if (t < (2/2.75)) {return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;} else if (t < (2.5/2.75)) {return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;} else {return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;}},
        easeInOutBounce: function (t, b, c, d) {if (t < d/2) return this.easeInBounce(t*2, 0, c, d) * .5 + b;return this.easeOutBounce(t*2-d, 0, c, d) * .5 + c*.5 + b;}
    };

    
    //-----------------------------------------------------------------------------
    // 追加機能（開発用）
    //-----------------------------------------------------------------------------

    //ドキュメントタイトルに諸情報を描写
    var _SceneManager_update2 = SceneManager.update;
    SceneManager.update = function() {
        _SceneManager_update2.apply(this, arguments);
        if (($gameTemp && $gameTemp.isPlaytest()) || BattleManager.isBattleTest()) {
            if (!this.originalTitle) this.originalTitle = document.title;
            if (TouchInput.isCancelled()) this._otx = TouchInput.x, this._oty = TouchInput.y;
            document.title = '%1 [%2, %3] %4'.format(
                this.originalTitle, TouchInput.x - (this._otx || 0), TouchInput.y - (this._oty || 0),
                (this.isRapid() ? ' [!!!Rapid!!!]' : '') + (this.isSlow() ? ' [!!!Slow!!!]' : ''))
        }
    };
    
    Game_Interpreter.prototype.command355 = function() {
        var script = this.currentCommand().parameters[0] + '\n';
        var sc = script.slice(0, 200);
        
        var ch = this.character(0) || $gamePlayer;
        
        while (this.nextEventCode() === 655) {
            this._index++;
            script += this.currentCommand().parameters[0] + '\n';
        }
        try {
            eval(script);
        } catch (e) {
            console.log('ID:%1, "%2"'.format(this._eventId, sc), e);
            eval(script);
        }
        return true;
    };
    
    Scene_Base.prototype.fadeOutInTest = function() {
        AudioManager.fadeOutBgm(1);
        AudioManager.fadeOutBgs(1);
        AudioManager.fadeOutMe(1);
        this.startFadeOut(1);
    };
    
   Scene_Title.prototype.commandNewGame = function() {
       DataManager.setupNewGame();
       this._commandWindow.close();
       !$gameTemp.isPlaytest() ? this.fadeOutAll() : this.fadeOutInTest();
       SceneManager.goto(Scene_Map);
       };

    //呼び出し先コモンイベントから呼び出し元を読み込める
    var _Game_Interpreter_setupChild = Game_Interpreter.prototype.setupChild;
    Game_Interpreter.prototype.setupChild = function(list, eventId) {
        _Game_Interpreter_setupChild.apply(this, arguments);
        this._childInterpreter._parent = this;
    };

    //今実行しているInterpreterを取得（コモンイベントも考慮）
    Game_Map.prototype.runningInterpreter = function() {
        var interpreter = this._interpreter;
        while (interpreter._childInterpreter) interpreter = interpreter._childInterpreter;
        return interpreter;
    };
    //今実行しているInterpreterで移動ルート待ちをしているキャラクターを取得
    Game_Map.prototype.waitingRouteCharacter = function() {
        var interpreter = this.runningInterpreter();
        if (interpreter && interpreter._waitMode === 'route') return interpreter._character;
        return null;
    };
    
    //データ検索用
    DataManager.searchDataItem = function(dataArray, columnName, columnValue) {
        var result = {};
        dataArray.some(function(dataItem) {
            if (dataItem && dataItem[columnName] === columnValue) {
                result = dataItem;
                return true;
            }
            return false;
        });
        return result;
    };

    //タイルがA4の天井かどうか
    Game_Map.prototype.isA4Roof = function(x, y) {
        var tileId = this.tileId(x, y, 0);
        var kind = Math.floor((tileId - 2048) / 48);
        return kind >= 80 && kind <= 127 && ((kind - 80) % 16) <= 7;
    };

    //タイルがA4の壁かどうか
    Game_Map.prototype.isA4Wall = function(x, y) {
        var tileId = this.tileId(x, y, 0);
        var kind = Math.floor((tileId - 2048) / 48);
        return kind >= 80 && kind <= 127 && ((kind - 80) % 16) > 7;
    };

    //便利変数の操作では更新しない　軽量化のため
    Game_Variables.prototype.setValue = function(variableId, value) {
        if (variableId > 0 && variableId < $dataSystem.variables.length) {
            if (typeof value === 'number') value = Math.floor(value);
            this._data[variableId] = value;
            if (![3, 4, 5].contains(variableId)) this.onChange();
        }
    };

    //短形でマスク（表示しない）
    const BIG = 1e6;
    Sprite.prototype._screenToLocal = function (x, y) {
        const t = this.worldTransform, det = t.a * t.d - t.b * t.c || 1e-8;
        const dx = x - t.tx, dy = y - t.ty;
        return new PIXI.Point((t.d * dx - t.c * dy) / det, (-t.b * dx + t.a * dy) / det);
    };
    Sprite.prototype._updateCutoutMask = function () {
        const r = this._screenMaskRect;
        if (!r) return;

        // 画面矩形の4頂点→ローカル
        const p1 = this._screenToLocal(r.x, r.y);
        const p2 = this._screenToLocal(r.x + r.width, r.y);
        const p3 = this._screenToLocal(r.x + r.width, r.y + r.height);
        const p4 = this._screenToLocal(r.x, r.y + r.height);

        const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
        const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
        const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
        const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

        // 一度だけ描画範囲（ローカルAABB）を取得してキャッシュ
        if (!this._cutoutLB) {
            let lb;
            try { lb = this.getLocalBounds(); } catch (_) { lb = new PIXI.Rectangle(-BIG, -BIG, BIG * 2, BIG * 2); }
            this._cutoutLB = { L: lb.x, T: lb.y, R: lb.x + lb.width, B: lb.y + lb.height };
        }
        const L = this._cutoutLB.L, T = this._cutoutLB.T, R = this._cutoutLB.R, B = this._cutoutLB.B;

        const g = this._cutoutMask || (this._cutoutMask = new PIXI.Graphics());
        g.clear().beginFill(0xffffff, 1);

        // 上
        const upH = Math.max(0, minY - T);
        if (upH) g.drawRect(L, T, R - L, upH);
        // 下
        const dnH = Math.max(0, B - maxY);
        if (dnH) g.drawRect(L, maxY, R - L, dnH);
        // 左右（縦の重なり部分だけ）
        const topY = Math.max(T, minY), botY = Math.min(B, maxY), midH = Math.max(0, botY - topY);
        if (midH) {
            const lh = Math.max(0, minX - L);
            if (lh) g.drawRect(L, topY, lh, midH);
            const rw = Math.max(0, R - maxX);
            if (rw) g.drawRect(maxX, topY, rw, midH);
        }
        g.endFill();
        if (!g.parent) this.addChild(g);
        this.mask = g;
    };
    Sprite.prototype.setMaskRect = function (x, y, w, h) {
        this._screenMaskRect = new Rectangle(x, y, w, h);
        this._updateCutoutMask();
    };
    Sprite.prototype.clearMaskRect = function () {
        this._screenMaskRect = null;
        if (this._cutoutMask) this._cutoutMask.clear();
        if (this.mask === this._cutoutMask) this.mask = null;
        this._cutoutLB = null;
    };
    const _update = Sprite.prototype.update;
    Sprite.prototype.update = function () {
        _update.call(this);
        if (this._screenMaskRect) this._updateCutoutMask();
    };
    
    //-----------------------------------------------------------------------------
    // オートタイル機能実装
    //-----------------------------------------------------------------------------
    
    var tileIdsFloor = {};
    tileIdsFloor.candidate =
        [ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
         12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
         24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
         36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];
    tileIdsFloor.connect = {
        1:[ 0,  1,  2,  3,  4,  5,  6,  7, 16, 17, 18, 19,
           20, 21, 24, 26, 28, 29, 30, 31, 32, 33, 34, 35,
           36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],         // 1:左下
        2:[ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
           12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
           24, 25, 26, 27, 32, 34, 35, 36, 37, 42, 47],         // 2:下
        3:[ 0,  1,  2,  3,  8,  9, 10, 11, 16, 17, 20, 22,
           24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36,
           37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],         // 3:右下
        4:[ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
           12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 26, 27,
           28, 29, 30, 31, 33, 36, 37, 38, 39, 45, 47],         // 4:左
        6:[ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
           12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
           28, 29, 30, 31, 33, 34, 35, 40, 41, 43, 47],         // 6:右
        7:[ 0,  2,  4,  6,  8, 10, 12, 14, 16, 17, 18, 19,
           20, 21, 22, 23, 24, 25, 28, 30, 32, 33, 34, 35,
           36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 47],         // 7:左上
        8:[ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
           12, 13, 14, 15, 16, 17, 18, 19, 24, 25, 26, 27,
           28, 29, 30, 31, 32, 38, 39, 40, 41, 44, 47],         // 8:上
        9:[ 0,  1,  4,  5,  8,  9, 12, 13, 16, 18, 20, 21,
           22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35,
           36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47]          // 9:右上
    };
    tileIdsFloor.noConnect = {
        1:[ 8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
           22, 23, 25, 27, 28, 29, 30, 31, 32, 33, 34, 35,
           37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],         // 1:左下
        2:[28, 29, 30, 31, 33, 38, 39, 40, 41, 43, 44, 45, 46], // 2:下
        3:[ 4,  5,  6,  7, 12, 13, 14, 15, 18, 19, 21, 23,
           24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36,
           37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],         // 3:右下
        4:[16, 17, 18, 19, 32, 34, 35, 40, 41, 42, 43, 44, 46], // 4:左
        6:[24, 25, 26, 27, 32, 36, 37, 38, 39, 42, 44, 45, 46], // 6:右
        7:[ 1,  3,  5,  7,  9, 11, 13, 15, 16, 17, 18, 19,
           20, 21, 22, 23, 26, 27, 29, 31, 32, 33, 34, 35,
           36, 37, 39, 40, 41, 42, 43, 44, 45, 46, 47],         // 7:左上
        8:[20, 21, 22, 23, 33, 34, 35, 36, 37, 42, 43, 45, 46], // 8:上
        9:[ 2,  3,  6,  7, 10, 11, 14, 15, 17, 19, 20, 21,
           22, 23, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35,
           36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47]          // 9:右上
    };

    Game_Map.prototype.setAutoTileId = function(x, y, z, tileId) {
        var getBaseTileId = function(kind) {
            return kind * 48 + 2048;
        }
        var getTileKind = function(tileId) {
            return Tilemap.isAutotile(tileId) ? Math.floor((tileId - 2048) / 48) : tileId;
        }
        
        var dataId = (z * $dataMap.height + y) * $dataMap.width + x;
        var baseTileId = tileId;
        if (!Tilemap.isAutotile(baseTileId) || !Tilemap.isGroundTile(baseTileId)) { 
            $dataMap.data[dataId] = baseTileId;
            if ($gameMap._mapGenerator) $gameMap._mapGenerator._data[dataId] = baseTileId;
        } else {
            baseTileId += !tileId ? 46 : 0;
            $dataMap.data[dataId] = baseTileId;
            if ($gameMap._mapGenerator) $gameMap._mapGenerator._data[dataId] = baseTileId;
        }
        if (Tilemap.isAutotile(tileId)) {
            [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach (function(d) {
                var x2 = x + Math.floor((d - 1) % 3) - 1, y2 = y - Math.floor((d - 1) / 3) + 1;
                var dataId2 = (z * $dataMap.height + y2) * $dataMap.width + x2;
                var baseTileId2 = $dataMap.data[dataId2];
                if (!Tilemap.isAutotile(baseTileId2) || !Tilemap.isGroundTile(baseTileId2)) return;
                var candidateTileIds = [].concat(tileIdsFloor.candidate);
                [1, 2, 3, 4, 6, 7, 8, 9].forEach (function(direction) {
                    var dx = x2 + Math.floor((direction - 1) % 3) - 1, dy = y2 - Math.floor((direction - 1) / 3) + 1;
                    var roundDataId = (z * $dataMap.height + dy) * $dataMap.width + dx;
                    var roundTileId = $dataMap.data[roundDataId];
                    if ((dx < 0 || dx >= $dataMap.width) || (dy < 0 || dy >= $dataMap.height)) {
                        return; // マップ範囲外なら判定しない
                    }
                    if (Tilemap.isSameKindTile(baseTileId2, roundTileId)) {
                        candidateTileIds = candidateTileIds.filter(function(Id) {
                            return tileIdsFloor.connect[direction].contains(Id);
                        }); // 同種オートタイルの場合候補タイルIDから接続タイルIDを選択
                    } else {
                        candidateTileIds = candidateTileIds.filter(function(Id) {
                            return tileIdsFloor.noConnect[direction].contains(Id);
                        }); // 異種オートタイルの場合候補タイルIDから非接続タイルIDを選択
                    }
                }, this);
                var value = getBaseTileId(getTileKind(baseTileId2)) + (candidateTileIds[0] || 0);
                $dataMap.data[dataId2] = value;
                if ($gameMap._mapGenerator) $gameMap._mapGenerator._data[dataId2] = value;
            }, this);
        };
    };
    Game_Map.prototype.refreshTilemap = function() {
        if (SceneManager._scene._spriteset._tilemap) SceneManager._scene._spriteset._tilemap.refresh();
    };
    
    //-----------------------------------------------------------------------------
    // 追加機能（その他）
    //-----------------------------------------------------------------------------

    Rectangle.prototype.equals = function(r) {
        return this.x === r.x && this.y === r.y && this.width === r.width && this.height === r.height;
    };
    Rectangle.prototype.clone = function() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    };
    
    //イベント中かどうかの判定を変更　何らかのウェイトありのときのみイベント中
    var __Game_Interpreter_setWaitMode = Game_Interpreter.prototype.setWaitMode;
    Game_Interpreter.prototype.setWaitMode = function(waitMode) {
        __Game_Interpreter_setWaitMode.apply(this, arguments);
        if (!this._backRunning) $gameSwitches.setValue(3, true);
    };
    var __Game_Interpreter_wait = Game_Interpreter.prototype.wait;
    Game_Interpreter.prototype.wait = function(duration) {
        __Game_Interpreter_wait.apply(this, arguments);
        if (!this._backRunning) $gameSwitches.setValue(3, true);
    };
    var __Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        __Scene_Map_update.apply(this, arguments);
        if (!$gameMap.isEventRunning() && $gameSwitches.value(3)) $gameSwitches.setValue(3, false);

        //デバッグ　キャラの上で右クリックで情報表示
        if (TouchInput.isCancelled() && $gameTemp.isPlaytest()) {
            var mx = ($gameMap._displayX * $gameMap.tileWidth() + TouchInput.x) / $gameMap.tileWidth();
            var my = ($gameMap._displayY * $gameMap.tileHeight() + TouchInput.y) / $gameMap.tileHeight();
            _p('screen:[%1,%2] map:[%3,%4]'.format(TouchInput.x, TouchInput.y, mx.toFixed(1), my.toFixed(1)));
            var x = $gameMap.canvasToMapX(TouchInput.x);
            var y = $gameMap.canvasToMapY(TouchInput.y);
            var events = $gameMap._events.filter(function(ev) {
                return ev && Math.round(ev._x) === x && Math.round(ev._y) === y;
            })
            if (events.length) console.log(events[0]);
        }
    };
    
    //マップにアニメーションを書き込む用
    //使い方
    //$gameMap.requestMapAnimation(animationId, mapX, mapY, mirror, delay, scale)
    Game_Map.prototype.requestMapAnimation = function(animationId, mapX, mapY, mirror, delay, scale, speed) {
        $gameTemp._animationMapXy = [mapX, mapY];
        $gameTemp._animationScale = scale || 1;
        $gameTemp._animationSpeed = speed || 4;
        SceneManager._scene._spriteset._playAnimationSprite.startAnimation($dataAnimations[animationId], mirror, delay);
    };
    var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.apply(this, arguments);
        this._playAnimationSprite = new Sprite_Base();
        this._playAnimationSprite.move(0, 0, Graphics.boxWidth, Graphics.boxHeight);
        this._baseSprite.addChild(this._playAnimationSprite);
    };
    var _Sprite_Base_startAnimation = Sprite_Base.prototype.startAnimation;
    Sprite_Base.prototype.startAnimation = function(animation, mirror, delay) {
        if (animation.name.indexOf('<randMirror>') >= 0) mirror = !!Math.randomInt(2);
        _Sprite_Base_startAnimation.apply(this, arguments);
        var sprite = this._animationSprites[this._animationSprites.length - 1];
        if ($gameTemp._animationMapXy) {
            sprite._mapXy = [].concat($gameTemp._animationMapXy);
            sprite._scale = $gameTemp._animationScale;
            sprite.z += sprite._mapXy[1] / 100;
            $gameTemp._animationMapXy = $gameTemp._animationScale = null;
        }
        return sprite;
    };
    Sprite_Animation.prototype.setupRate = function() {
        if ($gameTemp._animationSpeed) this._rate = $gameTemp._animationSpeed;
        else {
            const m = this._animation.name.match(/<rate:(\d+)>/i);
            this._rate = m ? Number(m[1]) : 4;
        }
        $gameTemp._animationSpeed = null;
    };
    var _Sprite_Animation_updatePosition = Sprite_Animation.prototype.updatePosition;
    Sprite_Animation.prototype.updatePosition = function() {
        if (this._noUpdatePosition) return;
        _Sprite_Animation_updatePosition.apply(this, arguments);
        if (this._mapXy !== undefined) {
            this.x = 24 + $gameMap.adjustX(this._mapXy[0]) * 48;
            this.y = 24 + $gameMap.adjustY(this._mapXy[1]) * 48;
            if (this._animation.position === 0) this.y -= 24;
            if (this._animation.position === 2) this.y += 24;
        }
        if (this._scale !== undefined) this.scale.x = this.scale.y = this._scale;
        
        this.x += this._addX || 0;
        this.y += this._addY || 0;
    };
    //アニメーションの親がなくなったら自分で削除する
    const _Sprite_Animation_update = Sprite_Animation.prototype.update;
    Sprite_Animation.prototype.update = function () {
        _Sprite_Animation_update.apply(this, arguments);
        if (this.isPlaying()) this._playing = true;
        else if (this._playing) this.remove();
    };

    //-----------------------------------------------------------------------------
    // 汎用画面表示機能
    //-----------------------------------------------------------------------------

    //画面表示
    Game_System.prototype.drawText = function(text, x, y, w, align1, align2, fontsize, color) {
        var scene = SceneManager._scene;
        var wd = scene._drawTextWindow;
        if (!wd) {
            wd = new Window_Base(-12, -12, Graphics.boxWidth + 24, Graphics.boxHeight + 24);
            wd.setBackgroundType(2);
            scene._drawTextWindow = wd;
            scene.addWindow(wd);
        }
        wd.contents.fontBold = false;
        return wd.drawTextKNH(text, x, y, w, align1, align2, fontsize, color);
    };
    //画面表示を消す
    Game_System.prototype.clearText = function() {
        var scene = SceneManager._scene;
        var wd = scene._drawTextWindow;
        if (wd) wd.contents.clear();
    };
    //画面表示をrectで消す
    Game_System.prototype.clearRect = function(x, y, w, h) {
        var scene = SceneManager._scene;
        var wd = scene._drawTextWindow;
        if (wd) wd.contents.clearRect(x, y, w, h);
    };

    //汎用ウィンドウ
    Game_System.prototype.window = function() {
        var scene = SceneManager._scene;
        var wd = scene._genericWindow;
        if (!wd) {
            wd = new Window_Base();
            scene._genericWindow = wd;
            scene.addWindow(wd);
        }
        return wd;
    };

    //-----------------------------------------------------------------------------
    // 画面の自由なところにポップアップできるやつ
    //-----------------------------------------------------------------------------

    Game_Screen.prototype.popupText = function(text, x, y, size, moveType) {
        if (!SceneManager._DR_popSpriteContainer) return;
        var scene = SceneManager;
        if (!scene._popupTexts_up) scene._popupTexts_up = [], scene._popupTexts_system = [];
        var sp = new Window_Base(0, 0, 0, 0);
        sp.setBackgroundType(2);
        if (size) sp.contents.fontSize = size;
        var info = sp.drawTextKNH(text, 4, 4);
        sp.width = info.w + sp.padding * 2 + 8, sp.height = info.h + sp.padding * 2 + 8;
        sp.createContents();
        if (size) sp.contents.fontSize = size;
        sp.contents.outlineWidth = 6;
        sp.drawTextKNH(text, 4, 4, sp.contents.width, 'left', 'down', size, 4);
        sp.x = x - sp.width / 2, sp.y = y - sp.height / 2;
        var popupTexts = moveType ? scene._popupTexts_up : scene._popupTexts_system;
        if (!moveType) sp.y -= popupTexts.length * 32;
        sp._count = 0;
        sp._moveType = moveType;
        if (popupTexts.length > 10) {
            var _sp = popupTexts.shift();
            SceneManager._DR_popSpriteContainer.removeChild(_sp);
        }
        SceneManager._DR_popSpriteContainer.addChild(sp);
        popupTexts.push(sp);
    };

    Game_Screen.prototype.popupSystemText = function(text, size) {
        this.popupText('%1'.format(text), Graphics.boxWidth / 2, 7.5 * 48, size || 28);
    };

    var _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        _Scene_Base_update.call(this);

        //任意の場所にポップアップできるやつ
        if (!SceneManager._popupTexts_up) {
            SceneManager._popupTexts_up = [];
            SceneManager._popupTexts_system = [];
        } else {
            [SceneManager._popupTexts_up, SceneManager._popupTexts_system].forEach(function(popTexts) {
                for (var i = 0; i < popTexts.length; i++) {
                    var sp = popTexts[i];
                    if (!sp) continue;
                    if (sp.contentsOpacity <= 0) {
                        SceneManager._DR_popSpriteContainer.removeChild(sp);
                        popTexts[i] = null;
                    } else {
                        if (sp._moveType === 1) sp.y -= 36 / 60 * (1 - sp._count / 60) * 1.5;
                        if (sp._count++ >= 45) sp.contentsOpacity -= 255 / 20;
                    }
                }
                if (popTexts.every(function(sp) {return !sp})) popTexts.length = 0;
            }, this)
        }
    };
    
    //常にリロード時読み込み直す
    Scene_Load.prototype.reloadMapIfUpdated = function() {
        $gamePlayer.reserveTransfer($gameMap.mapId(), $gamePlayer.x, $gamePlayer.y);
        $gamePlayer.requestMapReload();
    };
    Scene_Boot.prototype.reloadMapIfUpdated = Scene_Load.prototype.reloadMapIfUpdated;

    //コモンイベントアイテム使用時にアイテム情報を格納
    Game_Action.prototype.itemEffectCommonEvent = function(target, effect) {
        $gameTemp._itemUseInfo = [this._item.object(), target];
    };
    Scene_ItemBase.prototype.checkCommonEvent = function() {
        if ($gameTemp.isCommonEventReserved()) {
            if (!$gameTemp._itemUseInfo) $gameTemp._itemUseInfo = [this.item()];
            SceneManager.goto(Scene_Map);
        }
    };
    
    //左クリックの長押し判定を追加
    var _TouchInput_onRightButtonDown = TouchInput._onRightButtonDown;
    TouchInput._onRightButtonDown = function(event) {
        _TouchInput_onRightButtonDown.apply(this, arguments);
        var x = Graphics.pageToCanvasX(event.pageX);
        var y = Graphics.pageToCanvasY(event.pageY);
        if (Graphics.isInsideCanvas(x, y)) {
            this._mouseCancelPressed = true;
        }
    };
    var _TouchInput_onMouseUp = TouchInput._onMouseUp;
    TouchInput._onMouseUp = function(event) {
        _TouchInput_onMouseUp.apply(this, arguments);
        if (event.button === 2) {
            this._mouseCancelPressed = false;
        }
    };
    
    //アイコンを子スプライトとしてセット
    Sprite.prototype.pushIconSprite = function (iconIndex, x, y, scale) {
        this._iconSprites = this._iconSprites || [];
        var is = this._iconSprites[this._iconSprites.length] = new Sprite();
        is.bitmap = ImageManager.loadSystem('IconSet');
        is.x = x || 0, is.y = y || 0;
        is.scale.x = is.scale.y = scale || 1;
        is.anchor.x = 0.5, is.anchor.y = 0.5;
        is.setFrame(iconIndex % 16 * 32, Math.floor(iconIndex / 16) * 32, 32, 32);
        this.addChild(is);
    };


    //-----------------------------------------------------------------------------
    // SpriteSheet
    //-----------------------------------------------------------------------------

    function SpriteSheet() {
        this.initialize.apply(this, arguments);
    }

    SpriteSheet.prototype = Object.create(Sprite_Base.prototype);
    SpriteSheet.prototype.constructor = SpriteSheet;

    SpriteSheet.prototype.initialize = function (bitmap, totalFrames, cols, rows, frameDuration, loop) {
        Sprite_Base.prototype.initialize.call(this);
        this.bitmap = bitmap;
        this._totalFrames = Math.max(1, (totalFrames | 0) || 1);
        this._cols = Math.max(1, (cols | 0) || 1);
        this._rows = Math.max(1, (rows | 0) || 1);
        this._frameDuration = Math.max(1, (frameDuration | 0) || 1);
        this._loop = !!loop;
        this._frameIndex = 0;
        this._tick = 0;
        this._stopped = false;
        this._frameW = 0;
        this._frameH = 0;
        this.setFrame(0, 0, this._frameW, this._frameH);
        this._applyFrameIfReady();
    };
    SpriteSheet.prototype.stop = function () {
        this._stopped = true;
    };
    SpriteSheet.prototype.play = function () {
        this._stopped = false;
    };
    SpriteSheet.prototype.update = function () {
        Sprite_Base.prototype.update.call(this);
        if (this._stopped) return;
        if (!this.bitmap || !this.bitmap.isReady()) return;
        if (!this._frameW || !this._frameH) this._calcFrameSize_();
        this._tick++;
        if (this._tick >= this._frameDuration) {
            this._tick = 0;
            let next = this._frameIndex + 1;
            if (next >= this._totalFrames) {
                if (this._loop) {
                    next = 0;
                } else {
                    next = this._totalFrames - 1;
                    this._yuraInfo = [];
                    this._stopped = true;
                }
            }
            this._frameIndex = next;
            this._applyFrame_();
        }
    };
    SpriteSheet.prototype._calcFrameSize_ = function () {
        const bw = this.bitmap.width || 0;
        const bh = this.bitmap.height || 0;
        // 画像が期待どおりのグリッド前提（不足分はそのまま切り出し）
        this._frameW = Math.floor(bw / this._cols);
        this._frameH = Math.floor(bh / this._rows);
        if (this._frameW <= 0) this._frameW = bw;
        if (this._frameH <= 0) this._frameH = bh;
    };
    SpriteSheet.prototype._applyFrameIfReady = function () {
        if (!this.bitmap || !this.bitmap.isReady()) return;
        if (!this._frameW || !this._frameH) this._calcFrameSize_();
        this._applyFrame_();
    };
    SpriteSheet.prototype._applyFrame_ = function () {
        const i = Math.max(0, Math.min(this._frameIndex, this._totalFrames - 1));
        const col = i % this._cols;
        const row = Math.floor(i / this._cols);
        const sx = col * this._frameW;
        const sy = row * this._frameH;
        this.setFrame(sx, sy, this._frameW, this._frameH);
    };
    window.SpriteSheet = SpriteSheet;
    
})();
