//=============================================================================
// KNH_ZXC_Gimmick_Else.js
//=============================================================================

/*:
 * @plugindesc その他のギミック集
 * @author kagaya
 *
 * @help
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

})();
