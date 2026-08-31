//=============================================================================
// KNH_ZXC_EventEditor_RouteSchemas
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event editor move-route schema catalog v0.3.0
 * @author kagaya
 * @help
 * Internal module loaded by KNH_ZXC_EventEditor_Timeline.js.
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    var EE = NS.EE;
    if (!EE) return;

    var SH = NS._eeTimelineShared;
    if (!SH || !SH.ready) return;
    var clone = SH.clone;
    var compareEntriesByFrameWaitUid = SH.compareEntriesByFrameWaitUid;
    var COMMAND_CODE = SH.COMMAND_CODE;
    SH.beginModule('route_schemas');

    EE.prototype.ensureRouteEditorSchemas = function() {
        if (this._routeEditorSchemas) return;
        this._routeEditorSchemas = {};
        var self = this;
        function reg(code, schema) { self._routeEditorSchemas[Number(code || 0)] = schema; }
        function regSimple(code, desc) {
            reg(code, {
                code: code,
                title: self.routeCommandNameJa(code),
                description: String(desc || 'このコマンドはパラメータを持ちません。'),
                fields: [],
                fromRouteCommand: function() { return {}; },
                toParams: function() { return []; }
            });
        }
        function regRouteScriptNoParams(code, title, description, makeScript) {
            reg(code, {
                code: code,
                routeCode: 45,
                title: title,
                description: description,
                fields: [],
                fromRouteCommand: function() { return {}; },
                toParams: function() { return [makeScript.call(this)]; }
            });
        }

        for (var c = 1; c <= 13; c++) regSimple(c);
        for (c = 16; c <= 26; c++) regSimple(c);
        for (c = 31; c <= 40; c++) regSimple(c);
        var turnDirOptions = [
            { value: 16, label: self.routeCommandNameJa(16) },
            { value: 17, label: self.routeCommandNameJa(17) },
            { value: 18, label: self.routeCommandNameJa(18) },
            { value: 19, label: self.routeCommandNameJa(19) }
        ];
        var makeTurnDirSchema = function(code) {
            return {
                code: code,
                title: self.routeCommandNameJa(code),
                description: '向きを選択して切り替えます。',
                fields: [
                    {
                        key: 'dirCode',
                        type: 'select',
                        label: '方向',
                        valueType: 'number',
                        compact: true,
                        options: turnDirOptions
                    }
                ],
                fromRouteCommand: function(cmd) {
                    var cc = Math.floor(Number(cmd && cmd.code || 0));
                    if (cc !== 16 && cc !== 17 && cc !== 18 && cc !== 19) cc = Math.floor(Number(code || 16));
                    return { dirCode: cc };
                },
                toParams: function() { return []; },
                applyRouteCommand: function(list, idx, state) {
                    if (!Array.isArray(list)) return;
                    idx = Math.floor(Number(idx || -1));
                    if (idx < 0 || idx >= list.length) return;
                    var target = list[idx];
                    if (!target) return;
                    var nextCode = Math.floor(Number(state && state.dirCode || code || 16));
                    if (nextCode !== 16 && nextCode !== 17 && nextCode !== 18 && nextCode !== 19) nextCode = 16;
                    target.code = nextCode;
                    target.parameters = [];
                }
            };
        };
        reg(16, makeTurnDirSchema(16));
        reg(17, makeTurnDirSchema(17));
        reg(18, makeTurnDirSchema(18));
        reg(19, makeTurnDirSchema(19));

        reg(14, {
            code: 14,
            routeCode: 45,
            title: 'ジャンプ',
            description: 'this.jump(x, y, 高さ倍率, 時間倍率) を編集します（保存時はスクリプト(45)）。ゲーム画面クリックで着地点指定できます。',
            fields: [
                { key: 'dx', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'dy', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true },
                { key: 'heightRate', type: 'number', label: '高さ倍率', min: 0.1, step: 0.1, integer: false, compact: true },
                { key: 'durationRate', type: 'number', label: '時間倍率', min: 0.1, step: 0.1, integer: false, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var parsed = this.parseRouteJumpExCommand(cmd);
                if (parsed) {
                    return {
                        dx: this.tileMoveSnapCoord(Number(parsed.dx || 0)),
                        dy: this.tileMoveSnapCoord(Number(parsed.dy || 0)),
                        heightRate: Math.max(0.1, Number(parsed.heightRate == null ? 1 : parsed.heightRate) || 1),
                        durationRate: Math.max(0.1, Number(parsed.durationRate == null ? 1 : parsed.durationRate) || 1)
                    };
                }
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return {
                    dx: this.tileMoveSnapCoord(Number(p[0] || 0)),
                    dy: this.tileMoveSnapCoord(Number(p[1] || 0)),
                    heightRate: 1,
                    durationRate: 1
                };
            },
            toParams: function(state) {
                return [this.makeRouteJumpExScript(
                    state && state.dx,
                    state && state.dy,
                    state && state.heightRate,
                    state && state.durationRate
                )];
            }
        });

        reg(15, {
            code: 15,
            title: 'ウェイト',
            description: '待機フレーム数を指定します。',
            fields: [
                { key: 'frames', type: 'number', label: 'フレーム', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { frames: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.frames || 1) || 1))];
            }
        });

        reg(27, {
            code: 27,
            title: 'スイッチON',
            description: 'ON にするスイッチIDを指定します。',
            fields: [
                { key: 'switchId', type: 'switch', label: 'スイッチID', compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { switchId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.switchId || 1) || 1))];
            }
        });

        reg(28, {
            code: 28,
            title: 'スイッチOFF',
            description: 'OFF にするスイッチIDを指定します。',
            fields: [
                { key: 'switchId', type: 'switch', label: 'スイッチID', compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { switchId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.switchId || 1) || 1))];
            }
        });

        reg(29, {
            code: 29,
            title: '移動速度の変更',
            description: '移動速度 (1〜6) を指定します。',
            fields: [
                { key: 'speed', type: 'number', label: '移動速度', min: 1, max: 6, step: 0.1, integer: false, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var parsed = this.parseRouteSetMoveSpeedCommand(cmd);
                if (parsed) return { speed: parsed.speed };
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { speed: this.normalizeRouteMoveSpeed(p[0], 4) };
            },
            toParams: function(state) {
                return [this.normalizeRouteMoveSpeed(state && state.speed, 4)];
            },
            applyRouteCommand: function(list, idx, state) {
                if (!Array.isArray(list)) return;
                idx = Math.floor(Number(idx || -1));
                if (idx < 0 || idx >= list.length) return;
                var target = list[idx];
                if (!target) return;
                var speed = this.normalizeRouteMoveSpeed(state && state.speed, 4);
                var rounded = Math.round(speed);
                if (Math.abs(speed - rounded) <= 1e-6) {
                    target.code = 29;
                    target.parameters = [rounded];
                } else {
                    target.code = 45;
                    target.parameters = [this.makeRouteSetMoveSpeedScript(speed)];
                }
            }
        });

        reg(30, {
            code: 30,
            title: '移動頻度の変更',
            description: '移動頻度 (1〜5) を指定します。',
            fields: [
                { key: 'freq', type: 'number', label: '移動頻度', min: 1, max: 5, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { freq: Math.max(1, Math.min(5, Math.floor(Number(p[0] || 3) || 3))) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.min(5, Math.floor(Number(state.freq || 3) || 3)))];
            }
        });

        reg(41, {
            code: 41,
            title: '画像の変更',
            description: '画像名とインデックスを指定します。',
            fields: [
                { key: 'name', type: 'text', label: '画像名', full: true },
                { key: 'index', type: 'number', label: 'インデックス', min: 0, max: 7, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return {
                    name: String(p[0] || ''),
                    index: Math.max(0, Math.min(7, Math.floor(Number(p[1] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    String(state.name || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.index || 0) || 0)))
                ];
            }
        });

        reg(42, {
            code: 42,
            title: '不透明度の変更',
            description: '不透明度 (0〜255) を指定します。',
            fields: [
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { opacity: Math.max(0, Math.min(255, Math.floor(Number(p[0] || 255) || 255))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255)))];
            }
        });

        reg(43, {
            code: 43,
            title: '合成方法の変更',
            description: '合成方法を指定します。',
            fields: [
                {
                    key: 'blend',
                    type: 'select',
                    label: '合成方法',
                    valueType: 'number',
                    options: [
                        { value: 0, label: '通常' },
                        { value: 1, label: '加算' },
                        { value: 2, label: '乗算' },
                        { value: 3, label: 'スクリーン' }
                    ],
                    compact: true
                }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { blend: Math.max(0, Math.min(3, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(3, Math.floor(Number(state.blend || 0) || 0)))];
            }
        });

        reg(44, {
            code: 44,
            title: 'SEの演奏',
            description: 'SEパラメータを指定します。',
            fields: [
                { key: 'name', type: 'text', label: 'SE名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1, integer: true, compact: true },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1, integer: true, compact: true },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                var se = (p[0] && typeof p[0] === 'object') ? p[0] : {};
                return {
                    name: String(se.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(se.volume == null ? 90 : se.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(se.pitch == null ? 100 : se.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(se.pan == null ? 0 : se.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [{
                    name: String(state.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                }];
            }
        });

        reg(45, {
            code: 45,
            title: 'スクリプト',
            description: '実行するスクリプトを入力します。',
            fields: [
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 6 }
            ],
            fromRouteCommand: function(cmd) {
                var p = (cmd && Array.isArray(cmd.parameters)) ? cmd.parameters : [];
                return { script: this.routeScriptToMultilineForEditor(String(p[0] || '')) };
            },
            toParams: function(state) {
                return [this.routeScriptToSingleLineForOutput(String(state.script || ''))];
            }
        });

        reg(4510, {
            code: 4510,
            routeCode: 45,
            title: 'フレームアニメ再生',
            description: 'this.startFrameAnimation(...) を編集します。画像変更をONにすると this.setImageZXC(...), this.startFrameAnimation(...) 形式で保存します（スクリプト(45)）。',
            fields: [
                { key: 'useImage', type: 'bool', label: '画像変更を行う', full: true },
                { key: 'imageName', type: 'text', label: '画像名', full: true, visibleWhen: { key: 'useImage', eq: true } },
                { key: 'imageIndex', type: 'number', label: 'index', step: 1, integer: true, compact: true, visibleWhen: { key: 'useImage', eq: true } },
                { key: 'imageDir', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true, visibleWhen: { key: 'useImage', eq: true } },
                { key: 'frameSpec', type: 'text', label: 'フレーム指定(数値 or 配列)', full: true, hint: '例: 8 / [8,9,10]' },
                { key: 'speed', type: 'number', label: '速度', step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ再生' }
            ],
            fromRouteCommand: function(cmd, entry, routeListIndex) {
                var q = this.parseRouteSetImageAndStartFrameAnimationCommand(cmd);
                if (q) {
                    return {
                        useImage: true,
                        imageName: String(q.imageName || ''),
                        imageIndex: Math.floor(Number(q.imageIndex || 0) || 0),
                        imageDir: this.normalizeDirection8(q.imageDir, 2),
                        frameSpec: String(q.frameSpec || '[8,9,10]'),
                        speed: Math.floor(Number(q.speed || 6) || 6),
                        loop: !!q.loop
                    };
                }
                var p = this.parseRouteStartFrameAnimationListCommand(cmd);
                var imageDefaults = this.defaultRouteCharacterImageStateForEntry(entry, routeListIndex);
                return {
                    useImage: p ? false : true,
                    imageName: imageDefaults.name,
                    imageIndex: imageDefaults.index,
                    imageDir: imageDefaults.direction,
                    frameSpec: p ? String(p.frameSpec || '[8,9,10]') : '[8,9,10]',
                    speed: p ? Math.floor(Number(p.speed || 6) || 6) : 6,
                    loop: p ? !!p.loop : false
                };
            },
            toParams: function(state) {
                var ps = this.parseFrameAnimationFrameSpecLiteral(state && state.frameSpec);
                if (!ps) throw new Error('フレーム指定は「数値」または「[1,2,3]」形式で入力してください');
                if (state && state.useImage) {
                    return [this.makeRouteSetImageAndStartFrameAnimationScript(
                        state && state.imageName,
                        state && state.imageIndex,
                        state && state.imageDir,
                        ps.literal,
                        state && state.speed,
                        state && state.loop
                    )];
                }
                return [this.makeRouteStartFrameAnimationListScript(ps.literal, state && state.speed, state && state.loop)];
            }
        });

        reg(4523, {
            code: 4523,
            routeCode: 45,
            title: 'フレームアニメ終了',
            description: 'this.endFrameAnimation() を実行します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'keepPatternFix', type: 'bool', label: 'パターン固定を維持する' }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteEndFrameAnimationCommand(cmd);
                return { keepPatternFix: p ? !!p.keepPatternFix : false };
            },
            toParams: function(state) {
                return [this.makeRouteEndFrameAnimationScript(!!(state && state.keepPatternFix))];
            }
        });

        reg(4511, {
            code: 4511,
            routeCode: 45,
            title: '画像変更+フレームアニメ',
            description: 'this.setImageZXC(...), this.startFrameAnimation(...) を1コマンドで編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'imageName', type: 'text', label: '画像名', full: true },
                { key: 'imageIndex', type: 'number', label: '画像インデックス', step: 1, integer: true, compact: true },
                { key: 'imageDir', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true },
                { key: 'frameSpec', type: 'text', label: 'フレーム指定(数値 or 配列)', hint: '例: 8 / [8,9,10]' },
                { key: 'speed', type: 'number', label: '速度', step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ再生' }
            ],
            fromRouteCommand: function(cmd, entry, routeListIndex) {
                var p = this.parseRouteSetImageAndStartFrameAnimationCommand(cmd);
                var imageDefaults = p ? null : this.defaultRouteCharacterImageStateForEntry(entry, routeListIndex);
                return {
                    imageName: p ? String(p.imageName || '') : imageDefaults.name,
                    imageIndex: p ? Math.floor(Number(p.imageIndex || 0) || 0) : imageDefaults.index,
                    imageDir: p ? this.normalizeDirection8(p.imageDir, 2) : imageDefaults.direction,
                    frameSpec: p ? String(p.frameSpec || '[8,9,10]') : '[8,9,10]',
                    speed: p ? Math.floor(Number(p.speed || 6) || 6) : 6,
                    loop: p ? !!p.loop : false
                };
            },
            toParams: function(state) {
                var ps = this.parseFrameAnimationFrameSpecLiteral(state && state.frameSpec);
                if (!ps) throw new Error('フレーム指定は「数値」または「[1,2,3]」形式で入力してください');
                return [this.makeRouteSetImageAndStartFrameAnimationScript(
                    state && state.imageName,
                    state && state.imageIndex,
                    state && state.imageDir,
                    ps.literal,
                    state && state.speed,
                    state && state.loop
                )];
            }
        });

        reg(4514, {
            code: 4514,
            routeCode: 45,
            title: '画像の変更(setImageZXC)',
            description: 'this.setImageZXC(name, index, direction) を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'name', type: 'text', label: '画像名', full: true },
                { key: 'index', type: 'number', label: 'index', step: 1, integer: true, compact: true },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true }
            ],
            fromRouteCommand: function(cmd, entry, routeListIndex) {
                var p = this.parseRouteSetImageZxcCommand(cmd);
                var imageDefaults = p ? null : this.defaultRouteCharacterImageStateForEntry(entry, routeListIndex);
                return {
                    name: p ? String(p.name || '') : imageDefaults.name,
                    index: p ? Math.floor(Number(p.x || 0) || 0) : imageDefaults.index,
                    direction: p ? this.normalizeDirection8(Number(p.y || 2), 2) : imageDefaults.direction
                };
            },
            toParams: function(state) {
                return [this.makeRouteSetImageZxcScript(
                    state && state.name,
                    state && state.index,
                    state && state.direction
                )];
            }
        });

        reg(4512, {
            code: 4512,
            routeCode: 45,
            title: '仲間の位置に合わせる',
            description: 'this.locateToCharacter($gamePlayer._followers.follower(n)), this._direction = d を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'partyMember', type: 'select', label: 'パーティメンバー', valueType: 'number', options: [{ value: 2, label: '2人目' }, { value: 3, label: '3人目' }, { value: 4, label: '4人目' }], compact: true },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 2, label: '下(2)' }, { value: 4, label: '左(4)' }, { value: 6, label: '右(6)' }, { value: 8, label: '上(8)' }], compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteLocateFollowerAndDirectionCommand(cmd);
                return {
                    partyMember: this.routeFollowerIndexToPartyMember(p ? p.followerIndex : 1),
                    direction: p ? this.normalizeDirection8(p.direction, 6) : 6
                };
            },
            toParams: function(state) {
                return [this.makeRouteLocateFollowerAndDirectionScript(
                    this.routePartyMemberToFollowerIndex(state && state.partyMember),
                    state && state.direction
                )];
            }
        });

        reg(4519, {
            code: 4519,
            routeCode: 45,
            title: '仲間の位置へ向かう',
            description: 'this.goToCharacter($gamePlayer._followers.follower(n)) を編集します。ウェイトは移動距離と速度から自動計算で固定（保存時はスクリプト(45)）。',
            fields: [
                { key: 'partyMember', type: 'select', label: 'パーティメンバー', valueType: 'number', options: [{ value: 2, label: '2人目' }, { value: 3, label: '3人目' }, { value: 4, label: '4人目' }], compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteGoToFollowerCommand(cmd);
                return {
                    partyMember: this.routeFollowerIndexToPartyMember(p ? p.followerIndex : 1)
                };
            },
            toParams: function(state) {
                return [this.makeRouteGoToFollowerScript(this.routePartyMemberToFollowerIndex(state && state.partyMember))];
            },
            applyRouteCommand: function(list, idx, state, entry) {
                var wf = this.routeGoToFollowerAutoWaitFrames(entry, idx, this.routePartyMemberToFollowerIndex(state && state.partyMember));
                this.setRouteGoToFollowerWaitFrames(list, idx, wf);
            }
        });

        reg(4513, {
            code: 4513,
            routeCode: 45,
            title: 'マスクフェードアウト',
            description: 'this.startMaskFadeOut(70) を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'frames', type: 'number', label: 'フェードフレーム', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteStartMaskFadeOutCommand(cmd);
                return { frames: p ? Math.max(1, Math.floor(Number(p.frames || 1) || 1)) : 70 };
            },
            toParams: function(state) {
                return [this.makeRouteStartMaskFadeOutScript(state && state.frames)];
            }
        });

        reg(4520, {
            code: 4520,
            routeCode: 45,
            title: 'マスクフェードイン',
            description: 'this.startMaskFadeIn(70) を編集します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'frames', type: 'number', label: 'フェードフレーム', min: 1, step: 1, integer: true, compact: true }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteStartMaskFadeInCommand(cmd);
                return { frames: p ? Math.max(1, Math.floor(Number(p.frames || 1) || 1)) : 70 };
            },
            toParams: function(state) {
                return [this.makeRouteStartMaskFadeInScript(state && state.frames)];
            }
        });

        reg(4521, {
            code: 4521,
            routeCode: 45,
            title: 'CSSアニメ再生',
            description: 'this.command_playCssRectAnimation(rows, cols, order, wait, loop) を編集します（保存時はスクリプト(45)）。order は配列([0,1,6,5])または数値(4)を指定できます。',
            fields: [
                { key: 'rows', type: 'number', label: '行数', min: 1, step: 1, integer: true, compact: true },
                { key: 'cols', type: 'number', label: '列数', min: 1, step: 1, integer: true, compact: true },
                { key: 'orderSpec', type: 'text', label: '再生順', full: true, compact: true },
                { key: 'frameWait', type: 'number', label: 'ウェイト(f)', min: 1, step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ再生' }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRoutePlayCssRectAnimationCommand(cmd);
                return {
                    rows: p ? Math.max(1, Math.floor(Number(p.rows || 1) || 1)) : 1,
                    cols: p ? Math.max(1, Math.floor(Number(p.cols || 1) || 1)) : 1,
                    orderSpec: p ? String(p.orderSpec || '1') : '1',
                    frameWait: p ? Math.max(1, Math.floor(Number(p.frameWait || 6) || 6)) : 6,
                    loop: p ? !!p.loop : true
                };
            },
            toParams: function(state) {
                return [this.makeRoutePlayCssRectAnimationScript(
                    state && state.rows,
                    state && state.cols,
                    state && state.orderSpec,
                    state && state.frameWait,
                    state && state.loop
                )];
            }
        });

        regRouteScriptNoParams(
            4522,
            'CSSアニメ停止',
            'this.command_stopCssRectAnimation() を実行します（保存時はスクリプト(45)）。',
            this.makeRouteStopCssRectAnimationScript
        );

        reg(4515, {
            code: 4515,
            routeCode: 45,
            title: '振動アニメ開始',
            description: 'ブルブルまたはガタガタの振動アニメを開始します（保存時はスクリプト(45)）。',
            fields: [
                { key: 'shakeType', type: 'select', label: '種類', options: [
                    { value: 'shiverX', label: 'ブルブル' },
                    { value: 'gatagata', label: 'ガタガタ' }
                ] }
            ],
            fromRouteCommand: function(cmd) {
                var p = this.parseRouteShiverControlCommand(cmd);
                return { shakeType: p && p.action === 'start' ? p.shakeType : 'shiverX' };
            },
            toParams: function(state) {
                return [this.makeRouteShiverStartScript(state && state.shakeType)];
            }
        });

        regRouteScriptNoParams(
            4516,
            '振動アニメ停止',
            'ブルブルとガタガタの両方を停止します（保存時はスクリプト(45)）。',
            this.makeRouteShiverStopScript
        );

        reg(4500, {
            code: 4500,
            routeCode: 45,
            title: 'タイルへ移動',
            description: 'this.goTo(x, y) を編集します。ウェイトは移動距離と速度から自動計算で固定（セーブ上はスクリプト(45)のまま保存）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true }
            ],
            fromRouteCommand: function(cmd, entry, routeListIndex) {
                var p = this.parseRouteTileGotoCommand(cmd);
                return {
                    x: p ? Number(p.x || 0) : 0,
                    y: p ? Number(p.y || 0) : 0
                };
            },
            toParams: function(state) {
                return [this.makeRouteTileGotoScript(state && state.x, state && state.y)];
            },
            applyRouteCommand: function(list, idx, state, entry) {
                var wf = this.routeTileGotoAutoWaitFrames(entry, idx, state && state.x, state && state.y);
                this.setRouteTileGotoWaitFrames(list, idx, wf);
            }
        });
    };


    SH.registerModule('route_schemas', ['core'], []);
})();
