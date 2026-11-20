//=============================================================================
// KNH_ZXC_Gimmick_Else.js
//=============================================================================

/*:
 * @plugindesc その他のギミック集
 * @author kagaya
 *
 * @help
 * Rocket launch: available on events, the player and followers.
 *   this.character(0).startRocketLaunch({ smokeScale: 1 });
 *   this.command_startRocketLaunch(0, { smokeScale: 1 }, true);
 * The interpreter command accepts a character id or a character object.
 * Its last argument waits until the smoke has completely disappeared.
 *   character.isRocketLaunching();
 *   character.clearRocketLaunch(); // Restore the original display/movement.
 * The launched character stays hidden until cleared or transferred.
 * Start on a stationary character; false means moving, jumping or already active.
 * Options (durations are game frames; height/offsets are map pixels):
 *   shakeFrames:48, flightFrames:96, height:960, smokeScale:1,
 *   frameWait:10, fadeDelay:12, fadeStep:10, footOffsetX:0, footOffsetY:0
 * Smoke 2 draws in front and starts fading after smoke 1 has disappeared.
 * By default, the next fade starts on the previous segment's second fade cell.
 * Smoke cells share the yurayura clock; frameWait defaults to its interval.
 * Vibration builds during shakeFrames and continues at full strength in flight.
 */


(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_Gimmick_Else';

    
    //-----------------------------------------------------------------------------
    // スポットライト
    //-----------------------------------------------------------------------------

    // InvertedSpriteMaskFilter（_frame対応＋にじみ防止のUVクランプ付き）
    function InvertedSpriteMaskFilter(maskSprite) {
        var vertexSrc = PIXI.Filter.defaultVertexSrc;
        var fragmentSrc =
            "precision mediump float;\n" +
            "varying vec2 vTextureCoord;\n" +
            "uniform sampler2D uSampler;\n" +      // 暗闇
            "uniform sampler2D mask;\n" +          // マスク元（キャラ）
            "uniform mat3 otherMatrix;\n" +
            "uniform vec4 maskClamp;\n" +          // u0,v0,u1,v1（現在frameのUV境界）
            "uniform float hardCut;\n" +
            "void main(void){\n" +
            "  vec2 uv = (otherMatrix * vec3(vTextureCoord, 1.0)).xy;\n" +
            "  // 現在フレームの範囲外は読み出さない（隣コマのにじみ防止）\n" +
            "  uv = clamp(uv, maskClamp.xy, maskClamp.zw);\n" +
            "  float ma = texture2D(mask, uv).a;\n" +
            "  float cut = 1.0 - ma;\n" +
            "  cut = mix(cut, step(0.5, cut), hardCut);\n" +
            "  vec4 base = texture2D(uSampler, vTextureCoord);\n" +
            "  base.rgb *= cut;  // premultiplied対応：RGBも一緒にゼロ\n" +
            "  base.a   *= cut;\n" +
            "  gl_FragColor = base;\n" +
            "}\n";

        PIXI.Filter.call(this, vertexSrc, fragmentSrc);
        this.maskSprite = maskSprite;
        this.maskMatrix = new PIXI.Matrix();
        this.uniforms.mask = maskSprite.texture;
        this.uniforms.otherMatrix = this.maskMatrix.toArray(true);
        this.uniforms.hardCut = 0.0; // 1.0で完全二値
        this.uniforms.maskClamp = new Float32Array([0, 0, 1, 1]); // 初期値
        this._updateClamp(); // 初期計算
    }
    InvertedSpriteMaskFilter.prototype = Object.create(PIXI.Filter.prototype);
    InvertedSpriteMaskFilter.prototype.constructor = InvertedSpriteMaskFilter;

    // 現在テクスチャのframe→UV境界へ
    InvertedSpriteMaskFilter.prototype._updateClamp = function () {
        var tex = this.maskSprite.texture;
        if (!tex || !tex.baseTexture || !tex.valid) return;
        var base = tex.baseTexture;
        var fr = tex.frame; // ← setFrameで更新される現在コマ
        var u0 = fr.x / base.width, v0 = fr.y / base.height;
        var u1 = (fr.x + fr.width) / base.width;
        var v1 = (fr.y + fr.height) / base.height;
        // 端のサンプリング誤差回避にごく小さいエッジマージン
        var eps = 0.5 / Math.max(base.width, base.height);
        this.uniforms.maskClamp[0] = u0 + eps;
        this.uniforms.maskClamp[1] = v0 + eps;
        this.uniforms.maskClamp[2] = u1 - eps;
        this.uniforms.maskClamp[3] = v1 - eps;
    };

    InvertedSpriteMaskFilter.prototype.apply = function (filterManager, input, output, clear) {
        if (this.maskSprite && this.maskSprite.texture && this.maskSprite.texture.valid) {
            this.uniforms.mask = this.maskSprite.texture;
            // フレーム・向き・歩行更新に追従
            filterManager.calculateSpriteMatrix(this.maskMatrix, this.maskSprite);
            this.uniforms.otherMatrix = this.maskMatrix.toArray(true);
            // 毎フレームでも軽いので都度UV境界を同期
            this._updateClamp();
        }
        filterManager.applyFilter(this, input, output, clear);
    };

    // ==== イベントコマンドから呼ぶエントリポイント ====
    // 例：this.command_setSpotLightFilter($gameMap._darkSprite, $gamePlayer)
    Game_Interpreter.prototype.command_setSpotLightFilter = function (overlaySprite, characters) {
        // 既存フィルタを壊さないように後ろに追加
        var filters = overlaySprite.filters ? overlaySprite.filters.slice() : [];
        // 同じキャラのスポットライトが既に居れば置き換え
        if (overlaySprite._spotlightFilter) {
            var idx = filters.indexOf(overlaySprite._spotlightFilter);
            if (idx >= 0) filters.splice(idx, 1);
        }
        characters.forEach(character => {
            var charSprite = character.sprite(), filter = new InvertedSpriteMaskFilter(charSprite);
            filters.push(filter);
        })
        overlaySprite.filters = filters;

        // 後で消したくなったとき用に保持
        overlaySprite._spotlightFilter = filters;
        overlaySprite._spotlightCharacters = characters;

        // パフォーマンス微調整（描画領域のヒント）。必要に応じて画面サイズ等に。
        if (!overlaySprite.filterArea) {
            overlaySprite.filterArea = new PIXI.Rectangle(0, 0, Graphics.width, Graphics.height);
        }

        // 念のため、暗闇スプライトがシーン上に居るかチェック（未追加なら最前面に追加）
        if (!overlaySprite.parent) {
            var spriteset = SceneManager._scene && SceneManager._scene._spriteset;
            if (spriteset) spriteset.addChild(overlaySprite);
        }

        return true;
    };

    Game_Interpreter.prototype.command_startSpotLight = function (ch1, ch2) {
        var sprite1 = new Sprite(ImageManager.loadSystem('dark'));
        SceneManager._scene._spriteset._tilemap.addChild(sprite1);
        this.command_setSpotLightFilter(sprite1, [ch1, ch2]);
        var sprite2 = new Sprite(ImageManager.loadSystem('dark2'));
        SceneManager._scene._spriteset._tilemap.addChild(sprite2);
        this.command_setSpotLightFilter(sprite2, [ch1]);
        sprite1._yuraInfo = sprite2._yuraInfo = [];
        sprite1.z = sprite2.z = 4;
        $gameTemp._slSprites = [sprite1, sprite2];
    };

    Game_Interpreter.prototype.command_clearSpotLight = function () {
        $gameTemp._slSprites.forEach(sp => {
            if (!sp || !sp._spotlightFilter) return false;
            var filters = sp.filters ? sp.filters.slice() : [];
            var idx = filters.indexOf(sp._spotlightFilter);
            if (idx >= 0) filters.splice(idx, 1);
            sp.filters = filters.length ? filters : null;
            sp._spotlightFilter = null;
            sp._spotlightCharacters = null;
            sp.parent.removeChild(sp);
        })
        $gameTemp._slSprites = null;
    };


    //-----------------------------------------------------------------------------
    // 選択肢に二重線
    //-----------------------------------------------------------------------------

    const SW = 9, SPD = 0.08, GAP = 8, TH = 2, PAD = 8, COL = "#000000";

    const _init = Window_ChoiceList.prototype.initialize;
    Window_ChoiceList.prototype.initialize = function (w) { _init.call(this, w); this._dz = null; };

    Window_ChoiceList.prototype._dzStart = function () {
        if (this._dz) return;
        const r = this.itemRect(0), x = r.x + PAD, w = this.contentsWidth() - x - PAD;
        const y = r.y + (r.height / 2 - GAP) + 10;
        this._dz = { x, y, y2: y + GAP, w, p1: 0, p2: 0, ph: 1 }; // ph:1→1本目、2→2本目、3→完了
    };

    const _upd = Window_ChoiceList.prototype.update;
    Window_ChoiceList.prototype.update = function () {
        _upd.call(this);
        const d = this._dz; if (!d || d.ph === 3) return;
        this.refreshYurayura();
        if (d.ph === 1) {
            d.p1 = Math.min(1, d.p1 + SPD);
            this.contents.fillRect(d.x, d.y - (TH >> 1), (d.w * d.p1) | 0, TH, COL);
            if (d.p1 === 1) d.ph = 2;
        } else if (d.ph === 2) {
            d.p2 = Math.min(1, d.p2 + SPD);
            this.contents.fillRect(d.x, d.y2 - (TH >> 1), (d.w * d.p2) | 0, TH, COL);
            if (d.p2 === 1) d.ph = 3;
        }
    };

    const _ok = Window_ChoiceList.prototype.processOk;
    Window_ChoiceList.prototype.processOk = function () {
        if ($gameSwitches.value(SW) && this.index() === 0) {
            if (!this._dz) {
                this._dzStart(); // 初回のみスルスル描画、以後はブザーのみ
                $gameSystem.playSe('00_voice_kora')
            } else {
                SoundManager.playBuzzer();
            }
            return;
        }
        _ok.call(this);
        this._dz = null;
    };

    //-----------------------------------------------------------------------------
    // 3回まわってワンと鳴く判定
    //-----------------------------------------------------------------------------

    // 方向を0～3にマッピング（0:←, 1:↓, 2:→, 3:↑）
    function triggeredDir() {
        if (Input.isTriggered('left')) return 0;
        if (Input.isTriggered('down')) return 1;
        if (Input.isTriggered('right')) return 2;
        if (Input.isTriggered('up')) return 3;
        return null;
    }

    // 0～3に正規化
    function mod4(n) { return (n + 4) % 4; }

    // 隣接チェック: bがa+1なら+1（時計回り）、a-1なら-1（反時計回り）、それ以外は0
    function neighborSense(a, b) {
        if (mod4(a + 1) === b) return +1;
        if (mod4(a - 1) === b) return -1;
        return 0;
    }

    // 状態（$gameTempに保持）
    Game_Temp.prototype.spin3State = function () {
        if (!this._spin3State) {
            this._spin3State = {
                start: null,   // 最初の方向（0..3）
                sense: null,   // +1:時計回り / -1:反時計回り / null:未確定
                step: 0,       // 進行ステップ（0=待機、1～4）
                total: 0,      // 累計回転数（ミスではリセットしない）
                last: null     // 最後に「受理した」方向キー（同じ連続は無視のため）
            };
        }
        return this._spin3State;
    };

    // 累計のみ手動クリアしたい場合（任意）
    Game_Temp.prototype.clearSpin3Count = function () {
        const st = this.spin3State();
        st.total = 0;
    };

    // 進行だけリセット（任意）
    Game_Temp.prototype.resetSpin3Progress = function () {
        const st = this.spin3State();
        st.start = null;
        st.sense = null;
        st.step = 0;
        st.last = null;
    };

    /**
     * 毎フレーム呼ぶ。戻り値は「累計回転数」。
     * 例）3回転で実行： if (this.command_spin3() >= 3) { … }
     */
    Game_Interpreter.prototype.command_spin3 = function () {
        const st = $gameTemp.spin3State();
        const d = triggeredDir();

        // このフレームで新規入力なし → 現在の累計を返す
        if (d == null) return st.total;

        // 同じキーを連続で押した場合は「無視」：状態を変えず、そのまま累計返す
        if (st.last !== null && d === st.last) {
            return st.total;
        }

        // ここから「受理」する入力。最後の受理キーを更新
        st.last = d;

        if (st.step === 0) {
            // 1つ目のキーで開始
            st.start = d;
            st.sense = null;
            st.step = 1; // 次で隣接入力を待つ（回転方向決定）
            return st.total;
        }

        if (st.step === 1 && st.sense == null) {
            // 2つ目のキーで回転方向を決定
            const s = neighborSense(st.start, d);
            if (s === 0) {
                // 隣接していない → 現在の回転入力だけやり直し（累計は維持）
                st.start = d;    // この入力を新たな開始点に
                st.sense = null;
                st.step = 1;
                return st.total;
            }
            // 隣接OK → 方向確定、次は start + 2*sense
            st.sense = s;
            st.step = 2;
            return st.total;
        }

        // 方向確定後：期待入力をチェック
        const expected = (st.step === 4)
            ? st.start
            : mod4(st.start + st.sense * st.step);

        if (d === expected) {
            st.step++;
            if (st.step > 4) {
                // スタートに戻った → 1回転成立
                st.total++;
                // オーバーラップ対応：このキーを新しい開始点として継続
                st.start = d;
                st.sense = null;
                st.step = 1;
            }
        } else {
            // ミス：現在の回転入力だけリセット（累計は触らない）
            st.start = d;     // この入力を新たな開始点に
            st.sense = null;
            st.step = 1;
        }

        return st.total;
    };

    //-----------------------------------------------------------------------------
    // みぃーのカラオケ採点結果
    //-----------------------------------------------------------------------------

    Game_Interpreter.prototype.command_miiKaraoke = function(line) {
        var wd = $gameTemp._miiKaraokeWindow;
        if (!line) {
            var w = 400, h = 33 * 9 + 36;
            var wd = $gameTemp._miiKaraokeWindow = new Window_Base((Graphics.boxWidth - w) / 2, (Graphics.boxHeight - h) / 2 - 10, w, h);
            wd.openness = 0, wd.open();
            wd.contents.fontBold = true;
            wd.setFontSize(36);
            wd.drawTextKNH('\\s[36]採点結果 \\s[24](100点満点)\\s[36]', 0, 16, wd.contents.width, 'center');
            wd.contents.fontBold = false;
            wd.setFontSize(28);
            wd._drawY = 66;
            SceneManager._scene.addWindow(wd);
        } else if (line === 1) {
            wd.refreshYurayura();
            wd.drawText('音程', 16, wd._drawY, wd.contents.width - 32, 'left');
            wd.drawText('-3点', 16, wd._drawY, wd.contents.width - 32, 'right');
            wd._drawY += 33;
        } else if (line === 2) {
            wd.refreshYurayura();
            wd.drawText('リズム', 16, wd._drawY, wd.contents.width - 32, 'left');
            wd.drawText('-1点', 16, wd._drawY, wd.contents.width - 32, 'right');
            wd._drawY += 33;
        } else if (line === 3) {
            wd.refreshYurayura();
            wd.drawText('表現力', 16, wd._drawY, wd.contents.width - 32, 'left');
            wd.drawText('-2点', 16, wd._drawY, wd.contents.width - 32, 'right');
            wd._drawY += 33;
        } else if (line === 4) {
            wd.refreshYurayura();
            wd.drawText('ビブラート', 16, wd._drawY, wd.contents.width - 32, 'left');
            wd.drawText('2回', 16, wd._drawY, wd.contents.width * 0.5, 'right');
            wd.drawText('+4点', 16, wd._drawY, wd.contents.width - 32, 'right');
            wd._drawY += 33;
        } else if (line === 5) {
            wd.refreshYurayura();
            wd.drawText('こぶし', 16, wd._drawY, wd.contents.width - 32, 'left');
            wd.drawText('863回', 16, wd._drawY, wd.contents.width * 0.5, 'right');
            wd.drawText('+97.4点', 16, wd._drawY, wd.contents.width - 32, 'right');
            wd._drawY += 50;
        } else if (line === 6) {
            wd.refreshYurayura();
            wd.contents.fontBold = true;
            wd.setFontSize(36);
            wd.drawText('合計', 32, wd._drawY, wd.contents.width - 64, 'left');
            wd.drawText('99.4点', 32, wd._drawY, wd.contents.width - 64, 'right');
            wd.contents.fontBold = false;
            wd.setFontSize(28);
            wd._drawY += 33;
        } else if (line === -1) {
            $gameTemp._miiKaraokeWindow = null;
            wd.close();
        }
    };

    //-----------------------------------------------------------------------------
    // テキスト変換
    //-----------------------------------------------------------------------------

    //王様が名前を勝手に変える
    var _reKana = /[\u3040-\u309F\u30A0-\u30FF]/;
    var _reSmallYoon = /[\u3083\u3085\u3087\u30E3\u30E5\u30E7]/;
    var _reSmallVowel = /[\u3041\u3043\u3045\u3047\u3049\u30A1\u30A3\u30A5\u30A7\u30A9]/;
    var _reSmallKana = /[\u3041\u3043\u3045\u3047\u3049\u3083\u3085\u3087\u3063\u308E\u3095\u3096\u30A1\u30A3\u30A5\u30A7\u30A9\u30E3\u30E5\u30E7\u30C3\u30EE\u30F5\u30F6]/;
    var _isKana = function (ch) { return _reKana.test(ch); };
    var _isLongMark = function (ch) { return ch === '\u30FC' || ch === '\uFF70' || ch === '\u301C' || ch === '\uFF5E'; };
    var _isDashLongMark = function (ch) { return ch === '\u30FC' || ch === '\uFF70'; };
    var _isSmallYoon = function (ch) { return _reSmallYoon.test(ch); };
    var _isSmallVowel = function (ch) { return _reSmallVowel.test(ch); };
    var _isSmallKana = function (ch) { return _reSmallKana.test(ch); };
    var _isSmallTsu = function (ch) { return ch === '\u3063' || ch === '\u30C3'; };
    var _isSmallKanaExceptTsu = function (ch) { return _isSmallKana(ch) && !_isSmallTsu(ch); };
    var _isBigKana = function (ch) { return _isKana(ch) && !_isSmallKana(ch) && !_isLongMark(ch); };
    var _stripLongMarks = function (text) { return text.replace(/[\u30FC\uFF70]/g, ''); };
    var _unitEndsWithKana = function (u) { return !!u && _isKana(u[u.length - 1]); };
    var _splitUnitsForLength = function (text) {
        var units = [];
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (_isLongMark(ch)) continue;
            if ((_isSmallYoon(ch) || _isSmallVowel(ch)) && units.length > 0 && _unitEndsWithKana(units[units.length - 1])) { units[units.length - 1] += ch; continue; }
            units.push(ch);
        }
        return units;
    };
    var _readKanaUnitAt = function (text, index) {
        var ch = text[index];
        if (!ch) return '';
        if (_isBigKana(ch) && (_isSmallYoon(text[index + 1]) || _isSmallVowel(text[index + 1]))) return ch + text[index + 1];
        return ch;
    };
    var _findFirstIndex = function (text, pred) { for (var i = 0; i < text.length; i++) { if (pred(text[i])) return i; } return -1; };
    var _chooseBaseIndex = function (text) {
        var idx = _findFirstIndex(text, function (ch) { return _isBigKana(ch); });
        if (idx >= 0) return idx;
        idx = _findFirstIndex(text, function (ch) { return _isSmallKanaExceptTsu(ch); });
        if (idx >= 0) return idx;
        idx = _findFirstIndex(text, function (ch) { return !_isKana(ch) && !_isLongMark(ch); });
        if (idx >= 0) return idx;
        idx = _findFirstIndex(text, function (ch) { return _isSmallTsu(ch); });
        if (idx >= 0) return idx;
        return _findFirstIndex(text, function (ch) { return _isLongMark(ch); });
    };

    var _enSplitPrefix = function (s) {
        var m = String(s).match(/^[^A-Za-z0-9]+/);
        var prefix = m ? m[0] : '';
        return { prefix: prefix, core: String(s).slice(prefix.length) };
    };
    var _enTitleCase = function (s) {
        if (!s) return s;
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    };
    var _enAllLower = function (s) { return !/[A-Z]/.test(s) && /[a-z]/.test(s); };
    var _enAllUpper = function (s) { return !/[a-z]/.test(s) && /[A-Z]/.test(s); };
    var _enFirstVowelIndex = function (s) {
        for (var i = 0; i < s.length; i++) if (/[AEIOUaeiou]/.test(s[i])) return i;
        return -1;
    };
    var _enVowelCount = function (s) {
        var letters = String(s).replace(/[^A-Za-z]/g, '').toLowerCase();
        var m = letters.match(/[aeiou]/g);
        return m ? m.length : 0;
    };
    var _enGimmickName = function (text) {
        if (text === null || text === undefined) return '';
        var s = String(text);
        if (!s) return s;
        var sp = _enSplitPrefix(s);
        if (!sp.core) return s;
        var core = sp.core;
        var coreNorm = (_enAllLower(core) || _enAllUpper(core)) ? _enTitleCase(core) : core;
        var vcount = _enVowelCount(coreNorm);
        var v = _enFirstVowelIndex(coreNorm);
        var x = v >= 0 ? coreNorm.slice(0, v + 1) : coreNorm.charAt(0);
        if (!x) return s;
        var chant = x + ' ' + x + ' ' + x + '\u2014' + x;
        var dot;
        if (vcount <= 1) dot = x + '\u2014' + coreNorm + ' ' + coreNorm;
        else if (vcount === 2) dot = x + '\u2014' + coreNorm;
        else {
            var rest = coreNorm.slice(x.length);
            var restNorm = _enTitleCase(rest || coreNorm);
            dot = x + '\u2014' + restNorm;
        }
        return sp.prefix + chant + ' \u00B7 \n' + dot;
    };

    var zxcGimmickName = function (text, lang) {
        lang = lang || 0;
        if (lang === 1) return _enGimmickName(text);
        if (text === null || text === undefined) return '';
        var s = String(text);
        if (!s) return s;
        var baseIndex = _chooseBaseIndex(s);
        if (baseIndex < 0) return s;
        var x = _readKanaUnitAt(s, baseIndex);
        if (!x) return s;
        var prefix = _stripLongMarks(s.slice(0, baseIndex));
        var core = s.slice(baseIndex);
        if (!core) return s;
        var units = _splitUnitsForLength(core);
        if (!units.length) units = [x];
        var rest = core.slice(x.length);
        while (rest[0] && _isDashLongMark(rest[0])) rest = rest.slice(1);
        var seg1 = x + x + x + '\u30FC' + x;
        var seg2 = units.length <= 1 ? x + '\u30FC' + x + x : (units.length === 2 ? x + '\u30FC' + x + rest : x + '\u30FC' + rest);
        return prefix + seg1 + '\u30FB\n' + seg2;
    };
    window.KNH_ZXC_GimmickName = zxcGimmickName;

    //-----------------------------------------------------------------------------
    // Rocket launch: serializable character state, scene-owned smoke sprites.
    //-----------------------------------------------------------------------------

    var ROCKET_TRAIL_CELL_SIZE = 96;
    // Both visible fade cells are retained, even when adjacent fades overlap.
    var ROCKET_TRAIL_FADE_VISIBLE_CELLS = 2;

    function rocketNumber(value, fallback, min, max) {
        var n = value == null ? fallback : Number(value);
        if (!isFinite(n)) n = fallback;
        return Math.max(min, Math.min(max, n));
    }

    function rocketOptions(options) {
        var o = options || {};
        var zoom = $gameScreen.zoomScale() || 1;
        var frameWait = Math.floor(rocketNumber(o.frameWait, $gameSystem.animationWait(), 1, 120));
        return {
            shakeFrames: Math.floor(rocketNumber(o.shakeFrames, 48, 0, 3600)),
            flightFrames: Math.floor(rocketNumber(o.flightFrames, 96, 1, 3600)),
            height: rocketNumber(o.height, Math.max(960, Graphics.height / zoom + 256), 1, 8192),
            smokeScale: rocketNumber(o.smokeScale, 1, 0.25, 8),
            frameWait: frameWait,
            fadeDelay: Math.floor(rocketNumber(o.fadeDelay, 12, 0, 3600)),
            fadeStep: Math.floor(rocketNumber(o.fadeStep, frameWait, frameWait, 3600)),
            footOffsetX: rocketNumber(o.footOffsetX, 0, -2048, 2048),
            footOffsetY: rocketNumber(o.footOffsetY, 0, -2048, 2048)
        };
    }

    Game_CharacterBase.prototype.startRocketLaunch = function(options) {
        if (this.isRocketLaunching() || this.isMoving() || this.isJumping()) return false;
        var o = rocketOptions(options);
        var tileHeight = ROCKET_TRAIL_CELL_SIZE * o.smokeScale;
        var puffStart = Math.max(0, o.shakeFrames - o.frameWait * 6);
        var fadeStart = Math.max(puffStart + o.frameWait * 15,
            o.shakeFrames + o.flightFrames + o.fadeDelay);
        this._rocketLaunch = {
            options: o, mapId: $gameMap.mapId(), frame: 0, ready: false,
            animationFrame: 0, animationStep: null,
            originX: this._realX, originY: this._realY,
            offsetX: this.screenX() - $gameMap.adjustX(this._realX) * $gameMap.tileWidth(),
            offsetY: this.screenY() - $gameMap.adjustY(this._realY) * $gameMap.tileHeight(),
            height: 0, shakeX: 0, shakeRotation: 0, shakeNextFrame: 0, hidden: false, done: false,
            puffStart: puffStart, fadeStart: fadeStart,
            endFrame: Math.max(puffStart + o.frameWait * 15,
                fadeStart + (Math.ceil(o.height / tileHeight) - 1) * o.fadeStep + o.frameWait * ROCKET_TRAIL_FADE_VISIBLE_CELLS)
        };
        ImageManager.loadCharacter('rocketSmog');
        ImageManager.loadCharacter('rocketSmog2');
        $gameMap.rejudgeEvents();
        return true;
    };

    Game_CharacterBase.prototype.isRocketLaunching = function() {
        return !!this._rocketLaunch && !this._rocketLaunch.done;
    };

    function rocketCharacterSprite(character) {
        var scene = SceneManager._scene;
        return scene && scene._spriteset && character.sprite();
    }

    Game_CharacterBase.prototype.clearRocketLaunch = function() {
        if (!this._rocketLaunch) return;
        this._rocketLaunch = null;
        var sprite = rocketCharacterSprite(this);
        if (sprite) clearRocketSmoke(sprite);
        $gameMap.rejudgeEvents();
    };

    function syncRocketAnimation(state, step) {
        if ($gameSwitches.value(1)) return;
        if (step == null) step = Math.floor($gameSystem.sceneCount() / state.options.frameWait);
        if (state.animationStep !== step) {
            state.animationStep = step;
            state.animationFrame = state.frame;
        }
    }

    function updateRocketShake(state) {
        if (state.hidden) {
            state.shakeX = 0;
            state.shakeRotation = 0;
            return;
        }
        if (state.frame < (state.shakeNextFrame || 0)) return;
        var power = Math.min(1, state.frame / Math.max(1, state.options.shakeFrames));
        var direction = state.shakeX > 0 ? -1 : 1;
        state.shakeX = direction * (0.4 + 2.6 * power) * (0.6 + Math.random() * 0.4);
        state.shakeRotation = (Math.random() * 2 - 1) * (0.4 + 4.1 * power) * Math.PI / 180;
        // Hold this random pose until the next tick, including across save/load.
        state.shakeNextFrame = state.frame + Math.round(5 - 3 * power);
    }

    Game_CharacterBase.prototype.updateRocketLaunch = function() {
        var s = this._rocketLaunch;
        if (!s || s.done) return;
        if (!s.ready) {
            if (!ImageManager.loadCharacter('rocketSmog').isReady() ||
                !ImageManager.loadCharacter('rocketSmog2').isReady()) return;
            s.ready = true;
        }
        var o = s.options;
        var frame = ++s.frame;
        syncRocketAnimation(s);
        var t = Math.min(1, Math.max(0, frame - o.shakeFrames) / o.flightFrames);
        s.height = o.height * t * t;
        s.hidden = frame >= o.shakeFrames + o.flightFrames;
        updateRocketShake(s);
        s.done = s.animationFrame >= s.endFrame;
        if (s.done) {
            var sprite = rocketCharacterSprite(this);
            if (sprite) clearRocketSmoke(sprite);
        }
    };

    // Keep logical map positions and all original character settings intact.
    var rocketCharacterUpdate = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function() {
        if (this._rocketLaunch) {
            this.updateAnimation();
            this.updateRocketLaunch();
        } else {
            rocketCharacterUpdate.apply(this, arguments);
        }
    };

    var rocketNeedNotUpdate = Game_CharacterBase.prototype.needNotUpdate;
    Game_CharacterBase.prototype.needNotUpdate = function() {
        return this.isRocketLaunching() ? false : rocketNeedNotUpdate.apply(this, arguments);
    };

    var rocketIsThrough = Game_CharacterBase.prototype.isThrough;
    Game_CharacterBase.prototype.isThrough = function() {
        return !!(this._rocketLaunch && this._rocketLaunch.frame >= this._rocketLaunch.options.shakeFrames) ||
            rocketIsThrough.apply(this, arguments);
    };

    var rocketPlayerCanMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        return !this._rocketLaunch && rocketPlayerCanMove.apply(this, arguments);
    };

    var rocketFollowerChase = Game_Follower.prototype.chaseCharacter;
    Game_Follower.prototype.chaseCharacter = function(character) {
        if (!this._rocketLaunch) rocketFollowerChase.apply(this, arguments);
    };

    var rocketEventErase = Game_Event.prototype.erase;
    Game_Event.prototype.erase = function() {
        this.clearRocketLaunch();
        rocketEventErase.apply(this, arguments);
    };

    var rocketPerformTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function() {
        if (this.isTransferring()) {
            this.clearRocketLaunch();
            this.followers().forEach(function(follower) { follower.clearRocketLaunch(); });
        }
        rocketPerformTransfer.apply(this, arguments);
    };

    Game_Interpreter.prototype.command_startRocketLaunch = function(character, options, wait) {
        var target = typeof character === 'object' && character ? character : this.character(character == null ? 0 : character);
        if (!target || !target.startRocketLaunch) return false;
        var started = target.startRocketLaunch(options);
        if (wait && target.isRocketLaunching()) {
            this._rocketLaunchWaitCharacter = target;
            this.setWaitMode('rocketLaunch');
        }
        return started;
    };

    var rocketUpdateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode !== 'rocketLaunch') return rocketUpdateWaitMode.apply(this, arguments);
        var target = this._rocketLaunchWaitCharacter;
        if (target && target.isRocketLaunching()) return true;
        this._rocketLaunchWaitCharacter = null;
        this._waitMode = '';
        return false;
    };

    function Sprite_RocketSmoke(character, state) {
        this.initialize(character, state);
    }
    Sprite_RocketSmoke.prototype = Object.create(Sprite.prototype);
    Sprite_RocketSmoke.prototype.constructor = Sprite_RocketSmoke;

    Sprite_RocketSmoke.prototype.destroy = function(options) {
        if (this._rocketDisposed) return;
        this._rocketDisposed = true;
        this.clearYuraFilterZXC();
        Sprite.prototype.destroy.call(this, options);
    };

    Sprite_RocketSmoke.prototype.initialize = function(character, state) {
        Sprite.prototype.initialize.call(this);
        this._character = character;
        this._state = state;
        this._segments = [];
        this._puff = new Sprite(ImageManager.loadCharacter('rocketSmog'));
        this._puff.anchor.set(0.5, 0.5);
        this.addChild(this._puff);
        this.z = 3;
        this.setYuraFilterZXC({ blockSize: 12, maxShake: 5, pixelSnap: true });
    };

    Sprite_RocketSmoke.prototype.update = function() {
        var s = this._state, o = s.options;
        this.visible = this._character._rocketLaunch === s && s.ready && !s.done;
        if (!this.visible) return;
        this.x = $gameMap.adjustX(s.originX) * $gameMap.tileWidth() + s.offsetX + o.footOffsetX;
        this.y = $gameMap.adjustY(s.originY) * $gameMap.tileHeight() + s.offsetY + o.footOffsetY;
        Sprite.prototype.update.call(this);
        var filter = this._yuraFilterZXC;
        var step = filter && o.frameWait === $gameSystem.animationWait() ? filter.uniforms.stepCount : null;
        syncRocketAnimation(s, step);
        var animationFrame = s.animationFrame || 0;
        var puffFrame = Math.floor((animationFrame - s.puffStart) / o.frameWait);
        this._puff.visible = puffFrame >= 0 && puffFrame < 15;
        if (this._puff.visible) {
            var puffWidth = this._puff.bitmap.width / 3;
            var puffHeight = this._puff.bitmap.height / 5;
            this._puff.setFrame(puffFrame % 3 * puffWidth, Math.floor(puffFrame / 3) * puffHeight, puffWidth, puffHeight);
            this._puff.scale.set(o.smokeScale, o.smokeScale);
        }
        var cellSize = ROCKET_TRAIL_CELL_SIZE;
        var tileHeight = cellSize * o.smokeScale;
        var count = Math.ceil(s.height / tileHeight);
        var loopFrame = Math.floor(Math.max(0, animationFrame - o.shakeFrames) / o.frameWait) % 3;
        var bitmap = ImageManager.loadCharacter('rocketSmog2');
        for (var i = 0; i < Math.max(count, this._segments.length); i++) {
            var segment = this._segments[i];
            if (!segment) {
                segment = this._segments[i] = new Sprite(bitmap);
                segment.anchor.x = 0.5;
                this.addChild(segment);
            }
            var fadeAge = animationFrame - s.fadeStart - i * o.fadeStep;
            var fadeFrame = Math.floor(fadeAge / o.frameWait);
            segment.visible = i < count && fadeFrame < ROCKET_TRAIL_FADE_VISIBLE_CELLS;
            if (!segment.visible) continue;
            // Crop the growing top segment; never stretch the smoke artwork.
            var cellHeight = Math.min(cellSize, Math.max(0, s.height / o.smokeScale - i * cellSize));
            var sourceY = cellSize - cellHeight;
            var column = fadeAge >= 0 ? fadeFrame : loopFrame;
            segment.setFrame(column * cellSize, (fadeAge >= 0 ? cellSize : 0) + sourceY, cellSize, cellHeight);
            segment.scale.set(o.smokeScale, o.smokeScale);
            segment.y = -i * tileHeight - cellHeight * o.smokeScale;
        }
    };

    function clearRocketSmoke(sprite) {
        var smoke = sprite._rocketSmoke;
        if (!smoke) return;
        if (smoke.parent) smoke.parent.removeChild(smoke);
        smoke.destroy({ children: true, texture: false, baseTexture: false });
        sprite._rocketSmoke = null;
    }

    var rocketSpritePosition = Sprite_Character.prototype.updatePosition;
    Sprite_Character.prototype.updatePosition = function() {
        rocketSpritePosition.apply(this, arguments);
        var s = this._character._rocketLaunch;
        if (s) {
            this.x += s.shakeX;
            this.y -= s.height;
            if (s.height > 0) this.z = Math.max(5, this.z);
        }
    };

    var rocketSpriteVisibility = Sprite_Character.prototype.updateVisibility;
    Sprite_Character.prototype.updateVisibility = function() {
        rocketSpriteVisibility.apply(this, arguments);
        if (this._character._rocketLaunch && this._character._rocketLaunch.hidden) this.visible = false;
    };

    var rocketSpriteUpdate = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        rocketSpriteUpdate.apply(this, arguments);
        var s = this._character._rocketLaunch;
        if (s) this.rotation = this._character.angle() * Math.PI / 180 + (s.shakeRotation || 0);
        if (this._rocketSmoke && (this._rocketSmoke._state !== s || !s || s.done ||
            s.mapId !== $gameMap.mapId() || this._character._erased)) clearRocketSmoke(this);
        if (s && !s.done && !this._character._erased && s.mapId === $gameMap.mapId() && this.parent) {
            if (!this._rocketSmoke) {
                this._rocketSmoke = new Sprite_RocketSmoke(this._character, s);
                this._rocketSmoke.update();
            }
            if (this._rocketSmoke.parent !== this.parent) this.parent.addChild(this._rocketSmoke);
        }
    };

    var rocketSpriteDestroy = Sprite_Character.prototype.destroy;
    Sprite_Character.prototype.destroy = function() {
        clearRocketSmoke(this);
        rocketSpriteDestroy.apply(this, arguments);
    };

})();
