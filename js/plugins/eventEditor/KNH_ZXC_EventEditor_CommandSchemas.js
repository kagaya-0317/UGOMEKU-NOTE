//=============================================================================
// KNH_ZXC_EventEditor_CommandSchemas
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event editor command schema catalog v0.3.0
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
    var RE_COMPACT_SELECT_KEY = SH.RE_COMPACT_SELECT_KEY;
    var RE_COMPACT_NUMBER_KEY = SH.RE_COMPACT_NUMBER_KEY;
    var RE_COMPACT_TEXT_KEY = SH.RE_COMPACT_TEXT_KEY;
    SH.beginModule('command_schemas');

    EE.prototype.ensureEditorSchemas = function() {
        if (this._editorSchemas) return;
        this._editorSchemas = {};
        var self = this;
        function reg(code, schema) { self._editorSchemas[Number(code || 0)] = schema; }
        function regNoParams(code, title, description) {
            reg(code, {
                code: code,
                title: title,
                description: description || 'このコマンドはパラメータを持ちません。',
                fields: [],
                fromEntry: function() { return {}; },
                toParams: function() { return []; }
            });
        }
        function boundedInteger(value, fallback, min, max) {
            var number = Number(value);
            if (!isFinite(number)) number = Number(fallback || 0);
            return Math.max(min, Math.min(max, Math.floor(number)));
        }
        function audioState(value) {
            var audio = value && typeof value === 'object' ? value : self.emptyAudioParam();
            return {
                name: String(audio.name || ''),
                volume: boundedInteger(audio.volume, 90, 0, 100),
                pitch: boundedInteger(audio.pitch, 100, 50, 150),
                pan: boundedInteger(audio.pan, 0, -100, 100)
            };
        }
        function audioValue(state) {
            return audioState(state || {});
        }
        function regAudio(code, title, description, fileType) {
            reg(code, {
                code: code,
                title: title,
                description: description,
                fields: [
                    { key: 'name', type: 'text', label: String(fileType || '音声') + 'ファイル名', full: true },
                    { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                    { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                    { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
                ],
                fromEntry: function(entry) {
                    var params = entry && entry.command && Array.isArray(entry.command.parameters)
                        ? entry.command.parameters
                        : [];
                    return audioState(params[0]);
                },
                toParams: function(state) { return [audioValue(state)]; }
            });
        }
        function regBinaryMode(code, title, description, label, onLabel, offLabel) {
            reg(code, {
                code: code,
                title: title,
                description: description,
                fields: [{
                    key: 'mode',
                    type: 'select',
                    label: label,
                    valueType: 'number',
                    options: [{ value: 0, label: onLabel }, { value: 1, label: offLabel }]
                }],
                fromEntry: function(entry) {
                    var params = entry && entry.command && Array.isArray(entry.command.parameters)
                        ? entry.command.parameters
                        : [];
                    return { mode: Math.max(0, Math.min(1, Math.floor(Number(params[0] || 0) || 0))) };
                },
                toParams: function(state) {
                    return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
                }
            });
        }

        reg(35550, {
            code: 35550,
            commandCode: 355,
            script355: true,
            title: 'カメラ移動',
            description: '$gameMap.scrollCamera(x, y, d) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true },
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.cameraMoveSpecFromEntry(entry);
                if (!spec || spec.kind !== 'scroll') return { x: 0, y: 0, d: 60 };
                return { x: Number(spec.x || 0), y: Number(spec.y || 0), d: Math.max(1, Math.floor(Number(spec.d || 60))) };
            },
            toParams: function(state) {
                return [this.makeCameraMoveScript('scroll', Number(state.x || 0), Number(state.y || 0), Number(state.d || 60))];
            }
        });

        reg(35551, {
            code: 35551,
            commandCode: 355,
            script355: true,
            title: 'カメラ移動(直接指定)',
            description: '$gameMap.scrollCameraTo(x, y, d) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true },
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.cameraMoveSpecFromEntry(entry);
                if (!spec || spec.kind !== 'scrollTo') return { x: 0, y: 0, d: 60 };
                return { x: Number(spec.x || 0), y: Number(spec.y || 0), d: Math.max(1, Math.floor(Number(spec.d || 60))) };
            },
            toParams: function(state) {
                return [this.makeCameraMoveScript('scrollTo', Number(state.x || 0), Number(state.y || 0), Number(state.d || 60))];
            }
        });

        reg(35552, {
            code: 35552,
            commandCode: 355,
            script355: true,
            title: 'キャラの瞬間移動',
            description: 'this.character(targetId).locateTo(x, y) / $gamePlayer.locateTo(x, y) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'x', type: 'number', label: 'X', step: 0.5, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 0.5, integer: false, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.teleportSpecFromEntry(entry);
                if (!spec) {
                    var defTarget = 0;
                    if (typeof this.currentSelectedCharacterId === 'function') defTarget = this.currentSelectedCharacterId();
                    if (defTarget == null && Number(this.selEid || 0) > 0) defTarget = Number(this.selEid || 0);
                    return {
                        targetId: self.normalizeMoveTarget(Number(defTarget == null ? 0 : defTarget)),
                        x: 0,
                        y: 0
                    };
                }
                return {
                    targetId: self.normalizeMoveTarget(Number(spec.targetId || 0)),
                    x: Number(spec.x || 0),
                    y: Number(spec.y || 0)
                };
            },
            toParams: function(state) {
                return [this.makeCharacterTeleportScript(
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Number(state.x || 0),
                    Number(state.y || 0)
                )];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35553, {
            code: 35553,
            commandCode: 355,
            script355: true,
            title: 'マップBGMの再生',
            description: '$gameMap.autoplay(); を実行します（保存時はスクリプト355）。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return ['$gameMap.autoplay();']; },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35554, {
            code: 35554,
            commandCode: 355,
            script355: true,
            title: '画面のフェードインZXC',
            description: '$gameScreen.startFadeOutZXC(d, c); を実行します（仕様どおり名称と呼び出しは逆）。',
            fields: [
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true },
                { key: 'c', type: 'select', label: '色', valueType: 'number', compact: true, options: [{ value: 0, label: '白(0)' }, { value: 1, label: '黒(1)' }] }
            ],
            fromEntry: function(entry) {
                var spec = this.screenFadeZxcSpecFromEntry(entry);
                if (!spec || spec.kind !== 'fadeOut') return { d: 60, c: 1 };
                return { d: Math.max(1, Math.floor(Number(spec.d || 60) || 60)), c: Math.max(0, Math.min(1, Math.floor(Number(spec.c || 0) || 0))) };
            },
            toParams: function(state) {
                var d = Math.max(1, Math.floor(Number(state.d || 60) || 60));
                var c = Math.max(0, Math.min(1, Math.floor(Number(state.c || 0) || 0)));
                return ['$gameScreen.startFadeOutZXC(' + d + ', ' + c + ');'];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35555, {
            code: 35555,
            commandCode: 355,
            script355: true,
            title: '画面のフェードアウトZXC',
            description: '$gameScreen.startFadeInZXC(d, c); を実行します（仕様どおり名称と呼び出しは逆）。',
            fields: [
                { key: 'd', type: 'number', label: 'd(フレーム)', min: 1, step: 1, integer: true, compact: true },
                { key: 'c', type: 'select', label: '色', valueType: 'number', compact: true, options: [{ value: 0, label: '白(0)' }, { value: 1, label: '黒(1)' }] }
            ],
            fromEntry: function(entry) {
                var spec = this.screenFadeZxcSpecFromEntry(entry);
                if (!spec || spec.kind !== 'fadeIn') return { d: 60, c: 1 };
                return { d: Math.max(1, Math.floor(Number(spec.d || 60) || 60)), c: Math.max(0, Math.min(1, Math.floor(Number(spec.c || 0) || 0))) };
            },
            toParams: function(state) {
                var d = Math.max(1, Math.floor(Number(state.d || 60) || 60));
                var c = Math.max(0, Math.min(1, Math.floor(Number(state.c || 0) || 0)));
                return ['$gameScreen.startFadeInZXC(' + d + ', ' + c + ');'];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35556, {
            code: 35556,
            commandCode: 355,
            script355: true,
            title: 'ピクチャSS表示',
            description: 'this.command_showSpriteSheetPicture(...) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャID', min: 1, step: 1, integer: true, compact: true },
                { key: 'pictureName', type: 'text', label: 'ピクチャ名', full: true, compact: true },
                { key: 'rows', type: 'number', label: '行数', min: 1, step: 1, integer: true, compact: true },
                { key: 'cols', type: 'number', label: '列数', min: 1, step: 1, integer: true, compact: true },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', compact: true, options: [{ value: 0, label: '左上(0)' }, { value: 1, label: '中央(1)' }] },
                { key: 'x', type: 'number', label: 'X', step: 1, integer: false, compact: true },
                { key: 'y', type: 'number', label: 'Y', step: 1, integer: false, compact: true },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1, integer: false, compact: true },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1, integer: false, compact: true },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1, integer: true, compact: true },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', compact: true, options: [{ value: 0, label: '通常(0)' }, { value: 1, label: '加算(1)' }, { value: 2, label: '乗算(2)' }, { value: 3, label: 'スクリーン(3)' }] }
            ],
            fromEntry: function(entry) {
                var spec = this.spriteSheetPictureShowSpecFromEntry(entry);
                if (!spec) {
                    return {
                        pictureId: 1,
                        pictureName: '',
                        rows: 1,
                        cols: 1,
                        origin: 0,
                        x: 0,
                        y: 0,
                        scaleX: 100,
                        scaleY: 100,
                        opacity: 255,
                        blendMode: 0
                    };
                }
                return spec;
            },
            toParams: function(state) {
                return [this.makeShowSpriteSheetPictureScript(state)];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35557, {
            code: 35557,
            commandCode: 355,
            script355: true,
            title: 'ピクチャSS再生',
            description: 'this.command_playSpriteSheetPicture(...) を編集します。再生順は配列文字列([0,1,2]) または数字(4)を指定できます（保存時はスクリプト355）。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャID', min: 1, step: 1, integer: true, compact: true },
                { key: 'orderSpec', type: 'text', label: '再生順', full: true, compact: true },
                { key: 'frameWait', type: 'number', label: 'ウェイト(f)', min: 1, step: 1, integer: true, compact: true },
                { key: 'loop', type: 'bool', label: 'ループ' }
            ],
            fromEntry: function(entry) {
                var spec = this.spriteSheetPicturePlaySpecFromEntry(entry);
                if (!spec) {
                    return {
                        pictureId: 1,
                        orderSpec: '[0,1,2,3]',
                        frameWait: 6,
                        loop: true
                    };
                }
                return spec;
            },
            toParams: function(state) {
                return [this.makePlaySpriteSheetPictureScript(state)];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(35558, {
            code: 35558,
            commandCode: 355,
            script355: true,
            title: 'ピクチャSS停止',
            description: 'this.command_stopSpriteSheetPicture(...) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャID', min: 1, step: 1, integer: true, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.spriteSheetPictureStopSpecFromEntry(entry);
                return spec || { pictureId: 1 };
            },
            toParams: function(state) {
                return [this.makeStopSpriteSheetPictureScript(state)];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(303, {
            code: 303,
            title: '名前入力の処理',
            description: '対象アクターと最大文字数を設定します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 11, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'maxLength', type: 'number', label: '最大文字数', min: 1, max: 12, step: 1, hint: '入力できる文字数の上限' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), maxLength: Math.max(1, Math.floor(Number(p[1] || 8) || 8)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.actorId || 1) || 1)), Math.max(1, Math.floor(Number(state.maxLength || 8) || 8))];
            }
        });

        reg(301, {
            code: 301,
            title: '戦闘の処理',
            description: '戦闘する敵グループと敗北時挙動を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '敵グループ指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }, { value: 2, label: 'ランダムエンカウント' }] },
                { key: 'troopId', type: 'list', label: '敵グループ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.troopOptionsForSchema(); } },
                { key: 'troopVarId', type: 'variable', label: '敵グループ変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'canEscape', type: 'bool', label: '逃走を許可' },
                { key: 'canLose', type: 'bool', label: '負けてもゲームオーバーにしない' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var mode = Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0)));
                return {
                    mode: mode,
                    troopId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    troopVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    canEscape: !!p[2],
                    canLose: !!p[3]
                };
            },
            toParams: function(state) {
                var mode = Math.max(0, Math.min(2, Math.floor(Number(state.mode || 0) || 0)));
                var ref = 0;
                if (mode === 0) ref = Math.max(1, Math.floor(Number(state.troopId || 1) || 1));
                else if (mode === 1) ref = Math.max(1, Math.floor(Number(state.troopVarId || 1) || 1));
                return [mode, ref, !!state.canEscape, !!state.canLose];
            }
        });

        reg(302, {
            code: 302,
            title: 'ショップの処理',
            description: '販売商品を1件分設定します（追加商品605は別コマンド）。',
            fields: [
                { key: 'goodsType', type: 'select', label: '商品種別', valueType: 'number', options: [{ value: 0, label: 'アイテム' }, { value: 1, label: '武器' }, { value: 2, label: '防具' }] },
                { key: 'goodsId', type: 'list', label: '商品ID', full: true, size: 10, search: true, valueType: 'number', options: function(state) {
                    var t = Math.max(0, Math.min(2, Math.floor(Number(state && state.goodsType || 0) || 0)));
                    if (t === 1) return self.weaponOptionsForSchema();
                    if (t === 2) return self.armorOptionsForSchema();
                    return self.itemOptionsForSchema();
                } },
                { key: 'priceType', type: 'select', label: '価格', valueType: 'number', options: [{ value: 0, label: '標準価格' }, { value: 1, label: '指定価格' }] },
                { key: 'price', type: 'number', label: '指定価格', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    goodsType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    goodsId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    priceType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    price: Math.max(0, Math.floor(Number(p[3] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.goodsType || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.goodsId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.priceType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.price || 0) || 0))
                ];
            }
        });

        regNoParams(351, 'メニュー画面を開く', 'メニュー画面を開きます。');
        regNoParams(352, 'セーブ画面を開く', 'セーブ画面を開きます。');
        regNoParams(353, 'ゲームオーバー', 'ゲームオーバー画面へ遷移します。');
        regNoParams(354, 'タイトル画面に戻す', 'タイトル画面へ戻します。');

        regAudio(132, '戦闘BGMの変更', '戦闘BGMを変更します。', 'BGM');

        regAudio(133, '勝利MEの変更', '勝利MEを変更します。', 'ME');

        regAudio(139, '敗北MEの変更', '敗北MEを変更します。', 'ME');

        reg(140, {
            code: 140,
            title: '乗り物BGMの変更',
            description: '指定乗り物のBGMを変更します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: function() { return self.vehicleTypeOptionsForSchema(); } },
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[1] && typeof p[1] === 'object') ? p[1] : self.emptyAudioParam();
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    {
                        name: String(state.name || ''),
                        volume: Math.max(0, Math.min(100, Math.floor(Number(state.volume == null ? 90 : state.volume) || 90))),
                        pitch: Math.max(50, Math.min(150, Math.floor(Number(state.pitch == null ? 100 : state.pitch) || 100))),
                        pan: Math.max(-100, Math.min(100, Math.floor(Number(state.pan == null ? 0 : state.pan) || 0)))
                    }
                ];
            }
        });

        regBinaryMode(134, 'セーブ禁止の変更', 'セーブの禁止/許可を切り替えます。', 'セーブ', '禁止', '許可');
        regBinaryMode(135, 'メニュー禁止の変更', 'メニューの禁止/許可を切り替えます。', 'メニュー', '禁止', '許可');
        regBinaryMode(136, 'エンカウント禁止の変更', 'エンカウントの禁止/許可を切り替えます。', 'エンカウント', '禁止', '許可');
        regBinaryMode(137, '並び替え禁止の変更', '並び替えの禁止/許可を切り替えます。', '並び替え', '禁止', '許可');

        reg(138, {
            code: 138,
            title: 'ウィンドウカラーの変更',
            description: 'ウィンドウカラー(色調)を変更します。',
            fields: [
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[0] && Array.isArray(p[0])) ? p[0] : [0, 0, 0, 0];
                return {
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [[
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                    Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                    Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                ]];
            }
        });

        reg(322, {
            code: 322,
            title: 'アクターの画像変更',
            description: 'アクターの歩行/顔/SV画像を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'characterName', type: 'text', label: '歩行グラフィック名', full: true },
                { key: 'characterIndex', type: 'number', label: '歩行インデックス', min: 0, max: 7, step: 1 },
                { key: 'faceName', type: 'text', label: '顔グラフィック名', full: true },
                { key: 'faceIndex', type: 'number', label: '顔インデックス', min: 0, max: 7, step: 1 },
                { key: 'battlerName', type: 'text', label: 'SVバトラー名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    characterName: String(p[1] || ''),
                    characterIndex: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0))),
                    faceName: String(p[3] || ''),
                    faceIndex: Math.max(0, Math.min(7, Math.floor(Number(p[4] || 0) || 0))),
                    battlerName: String(p[5] || '')
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.characterName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.characterIndex || 0) || 0))),
                    String(state.faceName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.faceIndex || 0) || 0))),
                    String(state.battlerName || '')
                ];
            }
        });

        reg(323, {
            code: 323,
            title: '乗り物の画像変更',
            description: '乗り物の歩行画像を変更します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: function() { return self.vehicleTypeOptionsForSchema(); } },
                { key: 'characterName', type: 'text', label: '歩行グラフィック名', full: true },
                { key: 'characterIndex', type: 'number', label: '歩行インデックス', min: 0, max: 7, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    characterName: String(p[1] || ''),
                    characterIndex: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0)))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    String(state.characterName || ''),
                    Math.max(0, Math.min(7, Math.floor(Number(state.characterIndex || 0) || 0)))
                ];
            }
        });

        reg(101, {
            code: 101,
            title: '文章の表示',
            description: '本文と、ウィンドウタイプ/しっぽ方向/ふきだし対象/addX/addY を設定します。',
            fields: [
                { key: 'text', type: 'textarea', label: '本文 (1行=401)', full: true, rows: 4 },
                { key: 'windowType', type: 'select', label: 'ウィンドウタイプ', valueType: 'number', options: [
                    { value: -1, label: '-1 四角' },
                    { value: 0, label: '0 ふきだし' },
                    { value: 1, label: '1 ギザギザふきだし' },
                    { value: 2, label: '2 思考ふきだし' }
                ] },
                { key: 'targetMode', type: 'select', label: 'ふきだし対象', options: [
                    { value: 'char', label: 'キャラ' },
                    { value: 'coord', label: '座標' }
                ] },
                { key: 'tailDir', type: 'taildir', label: 'しっぽ方向', compact: true },
                { key: 'addX', type: 'number', label: 'addX(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'char' } },
                { key: 'addY', type: 'number', label: 'addY(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'char' } },
                { key: 'targetX', type: 'number', label: '画面X(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } },
                { key: 'targetY', type: 'number', label: '画面Y(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } },
                { key: 'targetCharId', type: 'list', label: '対象キャラ', full: true, size: 10, search: true, valueType: 'number',
                    visibleWhen: { key: 'targetMode', eq: 'char' },
                    options: function() { return self.characterTargetOptionsForSchema(true, true); }
                },
                { key: 'specialMode', type: 'select', label: '特殊設定', affectsPreviewMode: true, options: [
                    { value: 'none', label: 'なし' },
                    { value: 'portrait', label: '顔つき' }
                ] },
                { key: 'portraitFileName', type: 'characterImage', label: 'キャラ名', full: true, required: true,
                    indexKey: 'portraitIndex', directionKey: 'portraitDirection', patternKey: 'portraitPattern',
                    visibleWhen: { key: 'specialMode', eq: 'portrait' }
                },
                { key: 'portraitIndex', type: 'number', label: 'index', min: 0, max: 7, step: 1, integer: true, compact: true,
                    visibleWhen: { key: 'specialMode', eq: 'portrait' }
                },
                { key: 'portraitDirection', type: 'select', label: '向き', valueType: 'number', compact: true, options: [
                    { value: 2, label: '2 下' }, { value: 4, label: '4 左' },
                    { value: 6, label: '6 右' }, { value: 8, label: '8 上' }
                ], visibleWhen: { key: 'specialMode', eq: 'portrait' } },
                { key: 'portraitSide', type: 'select', label: '左右', compact: true, options: [
                    { value: 'left', label: '左' }, { value: 'right', label: '右' }
                ], visibleWhen: { key: 'specialMode', eq: 'portrait' } },
                { key: 'portraitAnimationType', type: 'select', label: 'アニメーションタイプ', options: [
                    { value: 'fixed', label: '固定' }, { value: 'pattern', label: 'パターン' }
                ], visibleWhen: { key: 'specialMode', eq: 'portrait' } },
                { key: 'portraitPattern', type: 'number', label: '固定パターン', min: 0, max: 2, step: 1, integer: true, compact: true,
                    visibleWhen: { all: [{ key: 'specialMode', eq: 'portrait' }, { key: 'portraitAnimationType', eq: 'fixed' }] }
                },
                { key: 'portraitPatternSequence', type: 'patternSequence', label: 'patternSequence', full: true,
                    hint: '0～2の配列。例: [0,1,2,1]',
                    visibleWhen: { all: [{ key: 'specialMode', eq: 'portrait' }, { key: 'portraitAnimationType', eq: 'pattern' }] }
                },
                { key: 'portraitTiming', type: 'select', label: '切替設定', options: [
                    { value: 'yura', label: 'ふきだしに合わせる' }, { value: 'custom', label: '独自' }
                ], visibleWhen: { all: [{ key: 'specialMode', eq: 'portrait' }, { key: 'portraitAnimationType', eq: 'pattern' }] } },
                { key: 'portraitWait', type: 'number', label: 'パターン切替間隔', min: 1, step: 1, integer: true, compact: true,
                    visibleWhen: { all: [
                        { key: 'specialMode', eq: 'portrait' },
                        { key: 'portraitAnimationType', eq: 'pattern' },
                        { key: 'portraitTiming', eq: 'custom' }
                    ] }
                },
                { key: 'portraitOffsetX', type: 'number', label: 'offsetX(px)', step: 1, integer: true, compact: true,
                    visibleWhen: { key: 'specialMode', eq: 'portrait' }
                },
                { key: 'portraitOffsetY', type: 'number', label: 'offsetY(px)', step: 1, integer: true, compact: true,
                    visibleWhen: { key: 'specialMode', eq: 'portrait' }
                },
                { key: 'portraitViewWidth', type: 'number', label: '文章予約幅(px)', min: 1, step: 1, integer: true, compact: true,
                    visibleWhen: { key: 'specialMode', eq: 'portrait' }
                },
                { key: 'portraitTextGap', type: 'number', label: 'textGap(px)', min: 0, step: 1, integer: true, compact: true,
                    visibleWhen: { key: 'specialMode', eq: 'portrait' }
                }
            ],
            fromEntry: function(entry) {
                var lines = Array.isArray(entry && entry.messageLines) ? entry.messageLines : [];
                var tr = entry ? self.ensureTrack(entry.eventId, entry.pageIndex) : null;
                var st = entry && entry.messageExt
                    ? self.sanitizeMessageExtState(entry.messageExt)
                    : self.messageExtStateAtPoint(tr, entry ? entry.frame : 0, entry ? entry.uid : Infinity);
                var result = {
                    text: lines.join('\n'),
                    windowType: st.windowType,
                    tailDir: st.tailDir,
                    targetMode: st.targetMode,
                    targetCharId: st.targetCharId,
                    addX: st.addX,
                    addY: st.addY,
                    targetX: st.targetX,
                    targetY: st.targetY
                };
                var portraitState = self.popupPortraitEditorState(entry && entry.popupPortrait);
                Object.keys(portraitState).forEach(function(key) { result[key] = portraitState[key]; });
                return result;
            },
            toParams: function(state, source) {
                var p = (source && source.command && Array.isArray(source.command.parameters))
                    ? clone(source.command.parameters)
                    : ['', 0, 0, 2];
                if (!Array.isArray(p) || p.length < 4) p = ['', 0, 0, 2];
                return p;
            },
            applyEntry: function(entry, state) {
                entry.isMessage = true;
                entry.messageLines = self.linesFromText(state && state.text, true);
                entry.messageExt = self.sanitizeMessageExtState({
                    windowType: state && state.windowType,
                    tailDir: state && state.tailDir,
                    targetMode: state && state.targetMode,
                    targetCharId: state && state.targetCharId,
                    addX: state && state.addX,
                    addY: state && state.addY,
                    targetX: state && state.targetX,
                    targetY: state && state.targetY
                });
                entry.popupPortrait = self.popupPortraitFromEditorState(state);
            }
        });

        reg(102, {
            code: 102,
            title: '選択肢の表示',
            description: '選択肢の文言と、既定/キャンセル/表示位置を設定します。',
            fields: [
                {
                    key: 'choiceBranchViewMode',
                    type: 'select',
                    label: '表示枝',
                    options: function(state) {
                        var out = [{ value: 'auto', label: 'AUTO' }];
                        var cs = self.linesFromText(state && state.choicesText, true);
                        if (!cs.length) cs = ['選択肢1'];
                        if (cs.length > 6) cs = cs.slice(0, 6);
                        for (var i = 0; i < cs.length; i++) {
                            out.push({ value: String(i), label: '選択肢' + String(i + 1) });
                        }
                        var cancelRaw = (state && state.cancelType != null) ? state.cancelType : -2;
                        var cancel = Math.floor(Number(cancelRaw) || 0);
                        if (cancel === -2) out.push({ value: 'cancel', label: 'キャンセル' });
                        return out;
                    }
                },
                { key: 'choicesText', type: 'textarea', label: '選択肢 (1行=1択)', full: true, rows: 7 },
                { key: 'defaultType', type: 'number', label: '既定選択(0開始)', min: 0, step: 1 },
                { key: 'cancelType', type: 'number', label: 'キャンセル(-1禁止 / -2分岐)', min: -2, step: 1 },
                { key: 'positionType', type: 'select', label: 'ウィンドウ位置', valueType: 'number', options: [{ value: 0, label: '左' }, { value: 1, label: '中' }, { value: 2, label: '右' }] },
                { key: 'background', type: 'select', label: '背景', valueType: 'number', options: [{ value: 0, label: 'ウィンドウ' }, { value: 1, label: '暗くする' }, { value: 2, label: '透明' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var cs = Array.isArray(p[0]) ? p[0] : [];
                var choiceBranchViewMode = 'auto';
                if (entry && typeof self.getChoiceBranchViewModeForEntry === 'function') {
                    try { choiceBranchViewMode = self.getChoiceBranchViewModeForEntry(entry); } catch (_) { choiceBranchViewMode = 'auto'; }
                }
                return {
                    choiceBranchViewMode: String(choiceBranchViewMode || 'auto'),
                    choicesText: cs.join('\n'),
                    cancelType: Number(p[1] == null ? -2 : p[1]),
                    defaultType: Number(p[2] == null ? 0 : p[2]),
                    positionType: Number(p[3] == null ? 2 : p[3]),
                    background: Number(p[4] == null ? 0 : p[4])
                };
            },
            toParams: function(state) {
                var cs = self.linesFromText(state.choicesText, true);
                if (!cs.length) cs = ['選択肢1'];
                if (cs.length > 6) cs = cs.slice(0, 6);
                var def = Math.max(0, Math.floor(Number(state.defaultType || 0) || 0));
                if (def >= cs.length) def = 0;
                var cancel = Math.floor(Number(state.cancelType == null ? -2 : state.cancelType) || 0);
                if (cancel >= cs.length) cancel = -2;
                if (cancel < -2) cancel = -2;
                return [
                    cs,
                    cancel,
                    def,
                    Math.max(0, Math.min(2, Math.floor(Number(state.positionType || 2) || 0))),
                    Math.max(0, Math.min(2, Math.floor(Number(state.background || 0) || 0)))
                ];
            },
            applyEntry: function(entry, state) {
                if (!entry || typeof self.setChoiceBranchViewModeForEntry !== 'function') return;
                try {
                    self.setChoiceBranchViewModeForEntry(entry, state ? state.choiceBranchViewMode : 'auto');
                } catch (_) {}
            }
        });

        reg(103, {
            code: 103,
            title: '数値入力の処理',
            description: '入力先の変数と桁数を設定します。',
            fields: [
                { key: 'variableId', type: 'variable', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'digits', type: 'number', label: '桁数', min: 1, max: 8, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), digits: Math.max(1, Math.floor(Number(p[1] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.variableId || 1) || 1)), Math.max(1, Math.min(8, Math.floor(Number(state.digits || 1) || 1)))];
            }
        });

        reg(104, {
            code: 104,
            title: 'アイテム選択の処理',
            description: '選択したアイテムIDを変数に格納します。',
            fields: [
                { key: 'variableId', type: 'variable', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'itemType', type: 'select', label: '対象アイテム種別', valueType: 'number', options: function() { return self.itemTypeOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)), itemType: Math.max(1, Math.min(4, Math.floor(Number(p[1] || 2) || 2))) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.variableId || 1) || 1)), Math.max(1, Math.min(4, Math.floor(Number(state.itemType || 2) || 2)))];
            }
        });

        reg(105, {
            code: 105,
            title: '文章のスクロール表示',
            description: 'スクロール速度と本文を設定します。',
            fields: [
                { key: 'speed', type: 'number', label: 'スクロール速度', min: 1, max: 8, step: 1 },
                { key: 'noFast', type: 'bool', label: '早送り禁止' },
                { key: 'text', type: 'textarea', label: '本文 (1行=405)', full: true, rows: 10 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var lines = Array.isArray(entry && entry.scrollLines) ? entry.scrollLines : [];
                return { speed: Math.max(1, Math.floor(Number(p[0] || 2) || 2)), noFast: !!p[1], text: lines.join('\n') };
            },
            toParams: function(state) {
                return [Math.max(1, Math.min(8, Math.floor(Number(state.speed || 2) || 2))), !!state.noFast];
            },
            applyEntry: function(entry, state) {
                entry.isScrollMessage = true;
                entry.scrollLines = self.linesFromText(state.text, true);
            }
        });

        reg(122, {
            code: 122,
            title: '変数の操作',
            description: '範囲・演算・オペランドを設定します（主要形式を対応）。',
            fields: [
                { key: 'scopeType', type: 'select', label: '対象', valueType: 'number', options: [{ value: 0, label: '単独' }, { value: 1, label: '範囲' }] },
                { key: 'fromVar', type: 'variable', label: '開始変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'toVar', type: 'variable', label: '終了変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'opType', type: 'select', label: '演算', valueType: 'number', options: [{ value: 0, label: '代入' }, { value: 1, label: '加算' }, { value: 2, label: '減算' }, { value: 3, label: '乗算' }, { value: 4, label: '除算' }, { value: 5, label: '剰余' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }, { value: 2, label: '乱数' }, { value: 3, label: 'ゲームデータ' }, { value: 4, label: 'スクリプト' }] },
                { key: 'constValue', type: 'number', label: '定数値', step: 1 },
                { key: 'operandVarId', type: 'variable', label: '参照変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'randMin', type: 'number', label: '乱数最小', step: 1 },
                { key: 'randMax', type: 'number', label: '乱数最大', step: 1 },
                { key: 'gameDataType', type: 'number', label: 'ゲームデータ種別ID', min: 0, step: 1, hint: '必要時のみ。詳細はMV仕様準拠。' },
                { key: 'gameDataP1', type: 'number', label: 'ゲームデータparam1', step: 1 },
                { key: 'gameDataP2', type: 'number', label: 'ゲームデータparam2', step: 1 },
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 4 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = Math.max(1, Math.floor(Number(p[0] || 1) || 1));
                var b = Math.max(1, Math.floor(Number(p[1] || a) || a));
                return {
                    scopeType: (a === b ? 0 : 1),
                    fromVar: a,
                    toVar: b,
                    opType: Math.max(0, Math.min(5, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(4, Math.floor(Number(p[3] || 0) || 0))),
                    constValue: Math.floor(Number(p[4] || 0) || 0),
                    operandVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1)),
                    randMin: Math.floor(Number(p[4] || 0) || 0),
                    randMax: Math.floor(Number(p[5] || 0) || 0),
                    gameDataType: Math.floor(Number(p[4] || 0) || 0),
                    gameDataP1: Math.floor(Number(p[5] || 0) || 0),
                    gameDataP2: Math.floor(Number(p[6] || 0) || 0),
                    script: String(p[4] || '')
                };
            },
            toParams: function(state) {
                var a = Math.max(1, Math.floor(Number(state.fromVar || 1) || 1));
                var b = Math.max(1, Math.floor(Number(state.toVar || a) || a));
                if (Number(state.scopeType || 0) === 0) b = a;
                if (a > b) { var t = a; a = b; b = t; }
                var op = Math.max(0, Math.min(5, Math.floor(Number(state.opType || 0) || 0)));
                var ot = Math.max(0, Math.min(4, Math.floor(Number(state.operandType || 0) || 0)));
                if (ot === 0) return [a, b, op, 0, Math.floor(Number(state.constValue || 0) || 0)];
                if (ot === 1) return [a, b, op, 1, Math.max(1, Math.floor(Number(state.operandVarId || 1) || 1))];
                if (ot === 2) {
                    var mn = Math.floor(Number(state.randMin || 0) || 0);
                    var mx = Math.floor(Number(state.randMax || 0) || 0);
                    if (mn > mx) { var tt = mn; mn = mx; mx = tt; }
                    return [a, b, op, 2, mn, mx];
                }
                if (ot === 3) return [a, b, op, 3, Math.floor(Number(state.gameDataType || 0) || 0), Math.floor(Number(state.gameDataP1 || 0) || 0), Math.floor(Number(state.gameDataP2 || 0) || 0)];
                return [a, b, op, 4, String(state.script || '')];
            }
        });

        reg(123, {
            code: 123,
            title: 'セルフスイッチの操作',
            description: '現在イベントのセルフスイッチを操作します。',
            fields: [
                { key: 'selfSwitch', type: 'select', label: 'セルフスイッチ', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }] },
                { key: 'value', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { selfSwitch: String(p[0] || 'A'), value: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))) };
            },
            toParams: function(state) {
                var ss = String(state.selfSwitch || 'A').toUpperCase();
                if (!/^[ABCD]$/.test(ss)) ss = 'A';
                return [ss, Math.max(0, Math.min(1, Math.floor(Number(state.value || 0) || 0)))];
            }
        });

        reg(124, {
            code: 124,
            title: 'タイマーの操作',
            description: '開始/停止と開始時秒数を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '開始' }, { value: 1, label: '停止' }] },
                { key: 'seconds', type: 'number', label: '秒数(開始時)', min: 1, max: 5999, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))), seconds: Math.max(1, Math.floor(Number(p[1] || 60) || 60)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0))), Math.max(1, Math.floor(Number(state.seconds || 60) || 60))];
            }
        });

        reg(117, {
            code: 117,
            title: 'コモンイベント',
            description: '実行するコモンイベントを選択します。',
            fields: [{ key: 'commonEventId', type: 'list', label: 'コモンイベント', full: true, size: 11, search: true, valueType: 'number', options: function() { return self.commonEventOptionsForSchema(); } }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { commonEventId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) { return [Math.max(1, Math.floor(Number(state.commonEventId || 1) || 1))]; }
        });

        reg(118, {
            code: 118,
            title: 'ラベル',
            description: 'ラベル名を設定します。',
            fields: [{ key: 'labelName', type: 'text', label: 'ラベル名' }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { labelName: String(p[0] || '') };
            },
            toParams: function(state) { return [String(state.labelName || '')]; }
        });

        reg(119, {
            code: 119,
            title: 'ラベルジャンプ',
            description: '移動先ラベル名を設定します。',
            fields: [
                { key: 'jumpLabel', type: 'list', label: 'ラベル一覧', full: true, size: 8, search: true, options: function() { return self.labelOptionsForSchema(); } },
                { key: 'jumpLabelText', type: 'text', label: 'ジャンプ先ラベル名', hint: '一覧になければ手入力可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var name = String(p[0] || '');
                return { jumpLabel: name, jumpLabelText: name };
            },
            toParams: function(state) {
                var name = String(state.jumpLabelText || state.jumpLabel || '');
                return [name];
            }
        });

        reg(111, {
            code: 111,
            title: '条件分岐',
            description: '主要な条件分岐形式を設定します（第一段）。',
            fields: [
                { key: 'branchViewMode', type: 'select', label: '表示枝', options: [{ value: 'auto', label: 'AUTO' }, { value: 'then', label: 'THEN' }, { value: 'else', label: 'ELSE' }] },
                { key: 'condType', type: 'select', label: '条件種別', valueType: 'number', options: [{ value: 0, label: 'スイッチ' }, { value: 1, label: '変数' }, { value: 2, label: 'セルフスイッチ' }, { value: 3, label: 'タイマー' }, { value: 11, label: 'ボタン' }, { value: 12, label: 'スクリプト' }] },
                { key: 'switchId', type: 'switch', label: 'スイッチID', min: 1, step: 1 },
                { key: 'switchValue', type: 'select', label: 'スイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'varId', type: 'variable', label: '変数ID', min: 1, step: 1 },
                { key: 'varOperandType', type: 'select', label: '比較対象', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'varOperand', type: 'number', label: '比較値/比較変数ID', step: 1 },
                { key: 'varCompareType', type: 'select', label: '比較演算', valueType: 'number', options: [{ value: 0, label: '==' }, { value: 1, label: '>=' }, { value: 2, label: '<=' }, { value: 3, label: '>' }, { value: 4, label: '<' }, { value: 5, label: '!=' }] },
                { key: 'selfSwitch', type: 'select', label: 'セルフスイッチ', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }] },
                { key: 'selfSwitchValue', type: 'select', label: 'セルフスイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'timerSec', type: 'number', label: 'タイマー秒数', min: 0, step: 1 },
                { key: 'timerCmp', type: 'select', label: 'タイマー比較', valueType: 'number', options: [{ value: 0, label: '以上' }, { value: 1, label: '以下' }] },
                { key: 'buttonName', type: 'select', label: 'ボタン', options: function() { return self.buttonOptionsForSchema(); } },
                { key: 'script', type: 'textarea', label: 'スクリプト', full: true, rows: 4 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var branchViewMode = 'then';
                if (entry && typeof self.getIfBranchViewModeForEntry === 'function') {
                    try { branchViewMode = self.getIfBranchViewModeForEntry(entry); } catch (_) { branchViewMode = 'then'; }
                }
                var branchMode = String(branchViewMode || '').toLowerCase();
                if (branchMode !== 'auto' && branchMode !== 'else') branchMode = 'then';
                return {
                    branchViewMode: branchMode,
                    condType: Math.floor(Number(p[0] || 0) || 0),
                    switchId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    switchValue: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    varId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    varOperandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    varOperand: Math.floor(Number(p[3] || 0) || 0),
                    varCompareType: Math.max(0, Math.min(5, Math.floor(Number(p[4] || 0) || 0))),
                    selfSwitch: String(p[1] || 'A'),
                    selfSwitchValue: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    timerSec: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    timerCmp: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    buttonName: String(p[1] || 'ok'),
                    script: String(p[1] || '')
                };
            },
            toParams: function(state, entry) {
                var t = Math.floor(Number(state.condType || 0) || 0);
                if (t === 0) return [0, Math.max(1, Math.floor(Number(state.switchId || 1) || 1)), Math.max(0, Math.min(1, Math.floor(Number(state.switchValue || 0) || 0)))];
                if (t === 1) return [1, Math.max(1, Math.floor(Number(state.varId || 1) || 1)), Math.max(0, Math.min(1, Math.floor(Number(state.varOperandType || 0) || 0))), Math.floor(Number(state.varOperand || 0) || 0), Math.max(0, Math.min(5, Math.floor(Number(state.varCompareType || 0) || 0)))];
                if (t === 2) {
                    var ss = String(state.selfSwitch || 'A').toUpperCase();
                    if (!/^[ABCD]$/.test(ss)) ss = 'A';
                    return [2, ss, Math.max(0, Math.min(1, Math.floor(Number(state.selfSwitchValue || 0) || 0)))];
                }
                if (t === 3) return [3, Math.max(0, Math.floor(Number(state.timerSec || 0) || 0)), Math.max(0, Math.min(1, Math.floor(Number(state.timerCmp || 0) || 0)))];
                if (t === 11) return [11, String(state.buttonName || 'ok')];
                if (t === 12) return [12, String(state.script || '')];
                return Array.isArray(entry && entry.command && entry.command.parameters) ? clone(entry.command.parameters) : [];
            },
            applyEntry: function(entry, state) {
                if (!entry || typeof self.setIfBranchViewModeForEntry !== 'function') return;
                try {
                    self.setIfBranchViewModeForEntry(entry, state ? state.branchViewMode : 'then');
                } catch (_) {}
            }
        });

        reg(281, {
            code: 281,
            title: 'マップ名表示の変更',
            description: 'マップ名ウィンドウの表示/非表示を設定します。',
            fields: [
                { key: 'mode', type: 'select', label: '表示設定', valueType: 'number', options: [{ value: 0, label: '表示する' }, { value: 1, label: '表示しない' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(282, {
            code: 282,
            title: 'タイルセットの変更',
            description: '切り替えるタイルセットを選択します。',
            fields: [
                { key: 'tilesetId', type: 'list', label: 'タイルセット', full: true, size: 12, search: true, valueType: 'number', options: function() { return self.tilesetOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { tilesetId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.tilesetId || 1) || 1))];
            }
        });

        reg(283, {
            code: 283,
            title: '戦闘背景の変更',
            description: '戦闘背景1/2の画像名を設定します。',
            fields: [
                { key: 'bb1', type: 'text', label: '戦闘背景1ファイル名' },
                { key: 'bb2', type: 'text', label: '戦闘背景2ファイル名' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { bb1: String(p[0] || ''), bb2: String(p[1] || '') };
            },
            toParams: function(state) {
                return [String(state.bb1 || ''), String(state.bb2 || '')];
            }
        });

        reg(284, {
            code: 284,
            title: '遠景の変更',
            description: '遠景画像・ループ・スクロール速度を設定します。',
            fields: [
                { key: 'name', type: 'text', label: '遠景ファイル名' },
                { key: 'loopX', type: 'bool', label: '横方向にループ' },
                { key: 'loopY', type: 'bool', label: '縦方向にループ' },
                { key: 'sx', type: 'number', label: '横スクロール速度', step: 1 },
                { key: 'sy', type: 'number', label: '縦スクロール速度', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    name: String(p[0] || ''),
                    loopX: !!p[1],
                    loopY: !!p[2],
                    sx: Math.floor(Number(p[3] || 0) || 0),
                    sy: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    String(state.name || ''),
                    !!state.loopX,
                    !!state.loopY,
                    Math.floor(Number(state.sx || 0) || 0),
                    Math.floor(Number(state.sy || 0) || 0)
                ];
            }
        });

        reg(285, {
            code: 285,
            title: '指定位置の情報取得',
            description: '指定座標の情報を変数へ格納します。',
            fields: [
                { key: 'variableId', type: 'variable', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'infoType', type: 'select', label: '取得情報', valueType: 'number', options: [{ value: 0, label: '地形タグ' }, { value: 1, label: 'イベントID' }, { value: 2, label: 'タイルID(レイヤー1)' }, { value: 3, label: 'タイルID(レイヤー2)' }, { value: 4, label: 'タイルID(レイヤー3)' }, { value: 5, label: 'タイルID(レイヤー4)' }, { value: 6, label: 'リージョンID' }] },
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X (値 / 変数ID)', step: 1 },
                { key: 'y', type: 'number', label: 'Y (値 / 変数ID)', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    variableId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    infoType: Math.max(0, Math.min(6, Math.floor(Number(p[1] || 0) || 0))),
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    x: Math.floor(Number(p[3] || 0) || 0),
                    y: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.variableId || 1) || 1)),
                    Math.max(0, Math.min(6, Math.floor(Number(state.infoType || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0))),
                    Math.floor(Number(state.x || 0) || 0),
                    Math.floor(Number(state.y || 0) || 0)
                ];
            }
        });

        reg(201, {
            code: 201,
            title: '場所移動',
            description: 'プレイヤーの場所移動先を設定します。',
            fields: [
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'mapId', type: 'list', label: 'マップ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.mapInfoOptionsForSchema(); } },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'mapVarId', type: 'variable', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 0, label: 'そのまま' }, { value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] },
                { key: 'fadeType', type: 'select', label: 'フェード', valueType: 'number', options: [{ value: 0, label: '黒' }, { value: 1, label: '白' }, { value: 2, label: 'なし' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    mapId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    x: Math.floor(Number(p[2] || 0) || 0),
                    y: Math.floor(Number(p[3] || 0) || 0),
                    mapVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    xVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    direction: Math.floor(Number(p[4] || 0) || 0),
                    fadeType: Math.max(0, Math.min(2, Math.floor(Number(p[5] || 0) || 0)))
                };
            },
            toParams: function(state) {
                var locType = Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0)));
                var mapRef = (locType === 0)
                    ? Math.max(1, Math.floor(Number(state.mapId || 1) || 1))
                    : Math.max(1, Math.floor(Number(state.mapVarId || 1) || 1));
                var xRef = (locType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (locType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                var direction = Math.floor(Number(state.direction || 0) || 0);
                if ([0, 2, 4, 6, 8].indexOf(direction) < 0) direction = 0;
                return [locType, mapRef, xRef, yRef, direction, Math.max(0, Math.min(2, Math.floor(Number(state.fadeType || 0) || 0)))];
            }
        });

        reg(202, {
            code: 202,
            title: '乗り物の位置設定',
            description: '乗り物の配置位置を設定します。',
            fields: [
                { key: 'vehicleType', type: 'select', label: '乗り物', valueType: 'number', options: [{ value: 0, label: '小型船' }, { value: 1, label: '大型船' }, { value: 2, label: '飛行船' }] },
                { key: 'locType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'mapId', type: 'list', label: 'マップ(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.mapInfoOptionsForSchema(); } },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'mapVarId', type: 'variable', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    vehicleType: Math.max(0, Math.min(2, Math.floor(Number(p[0] || 0) || 0))),
                    locType: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    mapId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    x: Math.floor(Number(p[3] || 0) || 0),
                    y: Math.floor(Number(p[4] || 0) || 0),
                    mapVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    xVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1))
                };
            },
            toParams: function(state) {
                var locType = Math.max(0, Math.min(1, Math.floor(Number(state.locType || 0) || 0)));
                var mapRef = (locType === 0)
                    ? Math.max(1, Math.floor(Number(state.mapId || 1) || 1))
                    : Math.max(1, Math.floor(Number(state.mapVarId || 1) || 1));
                var xRef = (locType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (locType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(0, Math.min(2, Math.floor(Number(state.vehicleType || 0) || 0))),
                    locType,
                    mapRef,
                    xRef,
                    yRef
                ];
            }
        });

        reg(203, {
            code: 203,
            title: 'イベントの位置設定',
            description: '対象キャラクターの位置を変更します。',
            fields: [
                { key: 'targetId', type: 'list', label: '移動対象', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'locType', type: 'select', label: '移動方法', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }, { value: 2, label: '他キャラと交換' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'swapTargetId', type: 'list', label: '交換対象', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'direction', type: 'select', label: '向き', valueType: 'number', options: [{ value: 0, label: 'そのまま' }, { value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    locType: Math.max(0, Math.min(2, Math.floor(Number(p[1] || 0) || 0))),
                    x: Math.floor(Number(p[2] || 0) || 0),
                    y: Math.floor(Number(p[3] || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[3] || 1) || 1)),
                    swapTargetId: self.normalizeMoveTarget(Number(p[2] || 0)),
                    direction: Math.floor(Number(p[4] || 0) || 0)
                };
            },
            toParams: function(state) {
                var targetId = self.normalizeMoveTarget(Number(state.targetId || 0));
                var locType = Math.max(0, Math.min(2, Math.floor(Number(state.locType || 0) || 0)));
                var direction = Math.floor(Number(state.direction || 0) || 0);
                if ([0, 2, 4, 6, 8].indexOf(direction) < 0) direction = 0;
                if (locType === 0) {
                    return [targetId, 0, Math.floor(Number(state.x || 0) || 0), Math.floor(Number(state.y || 0) || 0), direction];
                }
                if (locType === 1) {
                    return [targetId, 1, Math.max(1, Math.floor(Number(state.xVarId || 1) || 1)), Math.max(1, Math.floor(Number(state.yVarId || 1) || 1)), direction];
                }
                return [targetId, 2, self.normalizeMoveTarget(Number(state.swapTargetId || 0)), 0, direction];
            }
        });

        reg(204, {
            code: 204,
            title: 'マップのスクロール',
            description: 'マップを指定方向へスクロールします。',
            fields: [
                { key: 'direction', type: 'select', label: '方向', valueType: 'number', options: [{ value: 2, label: '下' }, { value: 4, label: '左' }, { value: 6, label: '右' }, { value: 8, label: '上' }] },
                { key: 'distance', type: 'number', label: '距離', min: 1, step: 1 },
                { key: 'speed', type: 'number', label: '速度', min: 1, max: 6, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    direction: [2, 4, 6, 8].indexOf(Number(p[0])) >= 0 ? Number(p[0]) : 2,
                    distance: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    speed: Math.max(1, Math.min(6, Math.floor(Number(p[2] || 4) || 4)))
                };
            },
            toParams: function(state) {
                var direction = Math.floor(Number(state.direction || 2) || 2);
                if ([2, 4, 6, 8].indexOf(direction) < 0) direction = 2;
                return [
                    direction,
                    Math.max(1, Math.floor(Number(state.distance || 1) || 1)),
                    Math.max(1, Math.min(6, Math.floor(Number(state.speed || 4) || 4)))
                ];
            }
        });

        reg(205, {
            code: 205,
            title: '移動ルートの設定',
            description: '対象キャラクターと移動ルートを設定します（JSON形式）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'repeat', type: 'bool', label: '繰り返す' },
                { key: 'skippable', type: 'bool', label: '移動できない場合は飛ばす' },
                { key: 'wait', type: 'bool', label: '完了までウェイト' },
                { key: 'routeListJson', type: 'textarea', label: 'ルートコマンド配列(JSON)', full: true, rows: 10, hint: '例: [{\"code\":1,\"parameters\":[]},{\"code\":15,\"parameters\":[30]}]' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var route = (p[1] && typeof p[1] === 'object') ? clone(p[1]) : { repeat: false, skippable: false, wait: false, list: [{ code: 0, parameters: [] }] };
                var list = Array.isArray(route.list) ? route.list : [];
                var viewList = [];
                for (var i = 0; i < list.length; i++) {
                    var rc = list[i];
                    if (!rc || Number(rc.code || 0) <= 0) continue;
                    viewList.push({ code: Math.floor(Number(rc.code || 0) || 0), parameters: Array.isArray(rc.parameters) ? clone(rc.parameters) : [] });
                }
                var jsonText = '[]';
                try { jsonText = JSON.stringify(viewList, null, 2); } catch (_) {}
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    repeat: !!route.repeat,
                    skippable: !!route.skippable,
                    wait: !!route.wait,
                    routeListJson: jsonText
                };
            },
            toParams: function(state) {
                var list = [];
                var raw = String(state.routeListJson || '').trim();
                if (raw.length) {
                    var arr = JSON.parse(raw);
                    if (!Array.isArray(arr)) throw new Error('ルートコマンド配列(JSON)は配列で指定してください');
                    for (var i = 0; i < arr.length; i++) {
                        var rc = arr[i];
                        if (!rc) continue;
                        var code = Math.floor(Number(rc.code || 0) || 0);
                        if (code <= 0) continue;
                        list.push({
                            code: code,
                            parameters: Array.isArray(rc.parameters) ? rc.parameters : []
                        });
                    }
                }
                list.push({ code: 0, parameters: [] });
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    {
                        repeat: !!state.repeat,
                        skippable: !!state.skippable,
                        wait: !!state.wait,
                        list: list
                    }
                ];
            }
        });

        regNoParams(206, '乗り物の乗降', 'プレイヤーを乗り物に乗降させます。');

        reg(211, {
            code: 211,
            title: '透明状態の変更',
            description: 'プレイヤーの透明状態を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '透明状態', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(212, {
            code: 212,
            commandCode: 355,
            script355: true,
            title: 'アニメーションの表示',
            description: 'this.character(targetId).requestAnimation(animationId, addX, addY, scale) を編集します（保存時はスクリプト355）。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'animationId', type: 'list', label: 'アニメーション', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.animationOptionsForSchema(); } },
                { key: 'addX', type: 'number', label: 'addX(px)', step: 1, compact: true },
                { key: 'addY', type: 'number', label: 'addY(px)', step: 1, compact: true },
                { key: 'scale', type: 'number', label: 'scale', min: 0.01, step: 0.1, integer: false, compact: true }
            ],
            fromEntry: function(entry) {
                var spec = this.animationRequestSpecFromEntry(entry);
                if (!spec) {
                    return {
                        targetId: 0,
                        animationId: 1,
                        addX: 0,
                        addY: 0,
                        scale: 1
                    };
                }
                return {
                    targetId: self.normalizeMoveTarget(Number(spec.targetId || 0)),
                    animationId: Math.max(1, Math.floor(Number(spec.animationId || 1) || 1)),
                    addX: Number(spec.addX || 0),
                    addY: Number(spec.addY || 0),
                    scale: Number(spec.scale == null ? 1 : spec.scale)
                };
            },
            toParams: function(state) {
                return [this.makeCharacterRequestAnimationScript(
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Math.max(1, Math.floor(Number(state.animationId || 1) || 1)),
                    Number(state.addX || 0),
                    Number(state.addY || 0),
                    Number(state.scale == null ? 1 : state.scale)
                )];
            },
            applyEntry: function(entry) {
                if (!entry || !entry.command) return;
                entry.command.code = 355;
            }
        });

        reg(213, {
            code: 213,
            title: 'フキダシアイコンの表示',
            description: '対象キャラクターにフキダシを表示します。',
            fields: [
                { key: 'targetId', type: 'list', label: '対象キャラクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.characterTargetOptionsForSchema(true, true); } },
                { key: 'balloonId', type: 'select', label: 'フキダシ', valueType: 'number', options: function() { return self.balloonOptionsForSchema(); } },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetId: self.normalizeMoveTarget(Number(p[0] || 0)),
                    balloonId: self.normalizeBalloonIdForSchema(p[1]),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    self.normalizeBalloonIdForSchema(state.balloonId),
                    !!state.wait
                ];
            }
        });

        regNoParams(214, 'イベントの一時消去', 'このイベントを一時消去します。');

        reg(216, {
            code: 216,
            title: '隊列歩行の変更',
            description: '隊列歩行のON/OFFを切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '隊列歩行', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        regNoParams(217, '隊列メンバーの集合', '隊列メンバーを集合させます。');

        reg(231, {
            code: 231,
            title: 'ピクチャの表示',
            description: 'ピクチャを表示します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'name', type: 'text', label: 'ファイル名', full: true },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', options: [{ value: 0, label: '左上' }, { value: 1, label: '中央' }] },
                { key: 'coordType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1 },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1 },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1 },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', options: [{ value: 0, label: '通常' }, { value: 1, label: '加算' }, { value: 2, label: '乗算' }, { value: 3, label: 'スクリーン' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    name: String(p[1] || ''),
                    origin: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    coordType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    x: Math.floor(Number(p[4] || 0) || 0),
                    y: Math.floor(Number(p[5] || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(p[4] || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(p[5] || 1) || 1)),
                    scaleX: Math.floor(Number(p[6] || 100) || 100),
                    scaleY: Math.floor(Number(p[7] || 100) || 100),
                    opacity: Math.max(0, Math.min(255, Math.floor(Number(p[8] || 255) || 255))),
                    blendMode: Math.max(0, Math.min(3, Math.floor(Number(p[9] || 0) || 0)))
                };
            },
            toParams: function(state) {
                var coordType = Math.max(0, Math.min(1, Math.floor(Number(state.coordType || 0) || 0)));
                var xRef = (coordType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (coordType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    String(state.name || ''),
                    Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0))),
                    coordType,
                    xRef,
                    yRef,
                    Math.floor(Number(state.scaleX || 100) || 100),
                    Math.floor(Number(state.scaleY || 100) || 100),
                    Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255))),
                    Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0)))
                ];
            }
        });

        reg(232, {
            code: 232,
            title: 'ピクチャの移動',
            description: 'ピクチャを移動/変形します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'param1', type: 'number', label: '内部param1', step: 1, hint: 'MV内部仕様用。通常は0。' },
                { key: 'origin', type: 'select', label: '原点', valueType: 'number', options: [{ value: 0, label: '左上' }, { value: 1, label: '中央' }] },
                { key: 'coordType', type: 'select', label: '座標指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'x', type: 'number', label: 'X(直接指定)', step: 1 },
                { key: 'y', type: 'number', label: 'Y(直接指定)', step: 1 },
                { key: 'xVarId', type: 'variable', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'variable', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'scaleX', type: 'number', label: '拡大率X', step: 1 },
                { key: 'scaleY', type: 'number', label: '拡大率Y', step: 1 },
                { key: 'opacity', type: 'number', label: '不透明度', min: 0, max: 255, step: 1 },
                { key: 'blendMode', type: 'select', label: '合成方法', valueType: 'number', options: [{ value: 0, label: '通常' }, { value: 1, label: '加算' }, { value: 2, label: '乗算' }, { value: 3, label: 'スクリーン' }] },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var n = p.length;
                var isV12 = n >= 12;
                var origin = isV12 ? Number(p[2] || 0) : Number(p[1] || 0);
                var coordType = isV12 ? Number(p[3] || 0) : Number(p[2] || 0);
                var xRef = isV12 ? Number(p[4] || 0) : Number(p[3] || 0);
                var yRef = isV12 ? Number(p[5] || 0) : Number(p[4] || 0);
                var scaleX = isV12 ? Number(p[6] || 100) : Number(p[5] || 100);
                var scaleY = isV12 ? Number(p[7] || 100) : Number(p[6] || 100);
                var opacity = isV12 ? Number(p[8] || 255) : Number(p[7] || 255);
                var blendMode = isV12 ? Number(p[9] || 0) : Number(p[8] || 0);
                var duration = isV12 ? Number(p[10] || 0) : Number(p[9] || 0);
                var wait = isV12 ? !!p[11] : !!p[10];
                var param1 = isV12 ? Number(p[1] || 0) : 0;
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    param1: Math.floor(Number(param1 || 0) || 0),
                    origin: Math.max(0, Math.min(1, Math.floor(origin || 0))),
                    coordType: Math.max(0, Math.min(1, Math.floor(coordType || 0))),
                    x: Math.floor(Number(xRef || 0) || 0),
                    y: Math.floor(Number(yRef || 0) || 0),
                    xVarId: Math.max(1, Math.floor(Number(xRef || 1) || 1)),
                    yVarId: Math.max(1, Math.floor(Number(yRef || 1) || 1)),
                    scaleX: Math.floor(Number(scaleX || 100) || 100),
                    scaleY: Math.floor(Number(scaleY || 100) || 100),
                    opacity: Math.max(0, Math.min(255, Math.floor(Number(opacity || 255) || 255))),
                    blendMode: Math.max(0, Math.min(3, Math.floor(Number(blendMode || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(duration || 0) || 0)),
                    wait: wait
                };
            },
            toParams: function(state) {
                var coordType = Math.max(0, Math.min(1, Math.floor(Number(state.coordType || 0) || 0)));
                var xRef = (coordType === 0)
                    ? Math.floor(Number(state.x || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.xVarId || 1) || 1));
                var yRef = (coordType === 0)
                    ? Math.floor(Number(state.y || 0) || 0)
                    : Math.max(1, Math.floor(Number(state.yVarId || 1) || 1));
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    Math.floor(Number(state.param1 || 0) || 0),
                    Math.max(0, Math.min(1, Math.floor(Number(state.origin || 0) || 0))),
                    coordType,
                    xRef,
                    yRef,
                    Math.floor(Number(state.scaleX || 100) || 100),
                    Math.floor(Number(state.scaleY || 100) || 100),
                    Math.max(0, Math.min(255, Math.floor(Number(state.opacity || 255) || 255))),
                    Math.max(0, Math.min(3, Math.floor(Number(state.blendMode || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(233, {
            code: 233,
            title: 'ピクチャの回転',
            description: 'ピクチャの回転速度を設定します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'speed', type: 'number', label: '回転速度', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    speed: Math.floor(Number(p[1] || 0) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    Math.floor(Number(state.speed || 0) || 0)
                ];
            }
        });

        reg(234, {
            code: 234,
            title: 'ピクチャの色調変更',
            description: 'ピクチャの色調を変更します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 },
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[1] && Array.isArray(p[1])) ? p[1] : [0, 0, 0, 0];
                return {
                    pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.pictureId || 1) || 1)),
                    [
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(235, {
            code: 235,
            title: 'ピクチャの消去',
            description: '指定ピクチャを消去します。',
            fields: [
                { key: 'pictureId', type: 'number', label: 'ピクチャ番号', min: 1, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { pictureId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.max(1, Math.floor(Number(state.pictureId || 1) || 1))];
            }
        });

        regNoParams(221, '画面のフェードアウト', '画面をフェードアウトします。');

        regNoParams(222, '画面のフェードイン', '画面をフェードインします。');

        reg(223, {
            code: 223,
            title: '画面の色調変更',
            description: '画面色調を変更します。',
            fields: [
                { key: 'toneR', type: 'number', label: '赤', min: -255, max: 255, step: 1 },
                { key: 'toneG', type: 'number', label: '緑', min: -255, max: 255, step: 1 },
                { key: 'toneB', type: 'number', label: '青', min: -255, max: 255, step: 1 },
                { key: 'toneGray', type: 'number', label: 'グレー', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var t = (p[0] && Array.isArray(p[0])) ? p[0] : [0, 0, 0, 0];
                return {
                    toneR: Math.max(-255, Math.min(255, Math.floor(Number(t[0] || 0) || 0))),
                    toneG: Math.max(-255, Math.min(255, Math.floor(Number(t[1] || 0) || 0))),
                    toneB: Math.max(-255, Math.min(255, Math.floor(Number(t[2] || 0) || 0))),
                    toneGray: Math.max(0, Math.min(255, Math.floor(Number(t[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    [
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneR || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneG || 0) || 0))),
                        Math.max(-255, Math.min(255, Math.floor(Number(state.toneB || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.toneGray || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(224, {
            code: 224,
            title: '画面のフラッシュ',
            description: '画面をフラッシュさせます。',
            fields: [
                { key: 'r', type: 'number', label: '赤', min: 0, max: 255, step: 1 },
                { key: 'g', type: 'number', label: '緑', min: 0, max: 255, step: 1 },
                { key: 'b', type: 'number', label: '青', min: 0, max: 255, step: 1 },
                { key: 'a', type: 'number', label: '強さ(アルファ)', min: 0, max: 255, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var c = (p[0] && Array.isArray(p[0])) ? p[0] : [255, 255, 255, 255];
                return {
                    r: Math.max(0, Math.min(255, Math.floor(Number(c[0] || 0) || 0))),
                    g: Math.max(0, Math.min(255, Math.floor(Number(c[1] || 0) || 0))),
                    b: Math.max(0, Math.min(255, Math.floor(Number(c[2] || 0) || 0))),
                    a: Math.max(0, Math.min(255, Math.floor(Number(c[3] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    [
                        Math.max(0, Math.min(255, Math.floor(Number(state.r || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.g || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.b || 0) || 0))),
                        Math.max(0, Math.min(255, Math.floor(Number(state.a || 0) || 0)))
                    ],
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(225, {
            code: 225,
            title: '画面のシェイク',
            description: '画面をシェイクさせます。',
            fields: [
                { key: 'power', type: 'number', label: '強さ', min: 0, max: 9, step: 1 },
                { key: 'speed', type: 'number', label: '速さ', min: 1, max: 9, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    power: Math.max(0, Math.min(9, Math.floor(Number(p[0] || 0) || 0))),
                    speed: Math.max(1, Math.min(9, Math.floor(Number(p[1] || 5) || 5))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(9, Math.floor(Number(state.power || 0) || 0))),
                    Math.max(1, Math.min(9, Math.floor(Number(state.speed || 5) || 5))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        reg(236, {
            code: 236,
            title: '天候の設定',
            description: '天候と強さを設定します。',
            fields: [
                { key: 'weatherType', type: 'select', label: '天候', valueType: 'number', options: [{ value: 0, label: 'なし' }, { value: 1, label: '雨' }, { value: 2, label: '嵐' }, { value: 3, label: '雪' }] },
                { key: 'power', type: 'number', label: '強さ', min: 0, max: 9, step: 1 },
                { key: 'duration', type: 'number', label: '時間(フレーム)', min: 0, step: 1 },
                { key: 'wait', type: 'bool', label: '完了までウェイト' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    weatherType: Math.max(0, Math.min(3, Math.floor(Number(p[0] || 0) || 0))),
                    power: Math.max(0, Math.min(9, Math.floor(Number(p[1] || 0) || 0))),
                    duration: Math.max(0, Math.floor(Number(p[2] || 0) || 0)),
                    wait: !!p[3]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(3, Math.floor(Number(state.weatherType || 0) || 0))),
                    Math.max(0, Math.min(9, Math.floor(Number(state.power || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.duration || 0) || 0)),
                    !!state.wait
                ];
            }
        });

        regAudio(241, 'BGMの演奏', 'BGMを再生します。', 'BGM');

        reg(242, {
            code: 242,
            title: 'BGMのフェードアウト',
            description: 'BGMをフェードアウトします。',
            fields: [
                { key: 'seconds', type: 'number', label: '時間(秒)', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { seconds: Math.max(0, Math.floor(Number(p[0] || 0) || 0)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.floor(Number(state.seconds || 0) || 0))];
            }
        });

        regNoParams(243, 'BGMの保存', '現在のBGMを保存します。');

        regNoParams(244, 'BGMの再開', '保存したBGMを再開します。');

        regAudio(245, 'BGSの演奏', 'BGSを再生します。', 'BGS');

        reg(246, {
            code: 246,
            title: 'BGSのフェードアウト',
            description: 'BGSをフェードアウトします。',
            fields: [
                { key: 'seconds', type: 'number', label: '時間(秒)', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { seconds: Math.max(0, Math.floor(Number(p[0] || 0) || 0)) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.floor(Number(state.seconds || 0) || 0))];
            }
        });

        regAudio(249, 'MEの演奏', 'MEを再生します。', 'ME');

        regAudio(250, 'SEの演奏', 'SEを再生します。', 'SE');

        regNoParams(251, 'SEの停止', '再生中のSEを停止します。');

        reg(261, {
            code: 261,
            title: 'ムービーの再生',
            description: 'ムービーを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'ムービーファイル名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { name: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.name || '')];
            }
        });

        reg(125, {
            code: 125,
            title: '所持金の増減',
            description: '所持金を増減します。',
            fields: [
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[2] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(126, {
            code: 126,
            title: 'アイテムの増減',
            description: '指定アイテムを増減します。',
            fields: [
                { key: 'itemId', type: 'list', label: 'アイテム', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.itemOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    itemId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.itemId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(127, {
            code: 127,
            title: '武器の増減',
            description: '指定武器を増減します。',
            fields: [
                { key: 'weaponId', type: 'list', label: '武器', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.weaponOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 },
                { key: 'includeEquip', type: 'bool', label: '装備中を含む(減少時)' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    weaponId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0)),
                    includeEquip: !!p[4]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.weaponId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.includeEquip
                ];
            }
        });

        reg(128, {
            code: 128,
            title: '防具の増減',
            description: '指定防具を増減します。',
            fields: [
                { key: 'armorId', type: 'list', label: '防具', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.armorOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '個数 / 変数ID', min: 0, step: 1 },
                { key: 'includeEquip', type: 'bool', label: '装備中を含む(減少時)' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    armorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[3] || 0) || 0)),
                    includeEquip: !!p[4]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.armorId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.includeEquip
                ];
            }
        });

        reg(129, {
            code: 129,
            title: 'メンバーの入れ替え',
            description: 'パーティメンバーの加入/離脱を設定します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '加入' }, { value: 1, label: '離脱' }] },
                { key: 'initialize', type: 'bool', label: '加入時に初期化する' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))),
                    initialize: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    !!state.initialize
                ];
            }
        });

        reg(311, {
            code: 311,
            title: 'HPの増減',
            description: '対象アクターのHPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'allowDeath', type: 'bool', label: '戦闘不能を許可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    allowDeath: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.allowDeath
                ];
            }
        });

        reg(312, {
            code: 312,
            title: 'MPの増減',
            description: '対象アクターのMPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(326, {
            code: 326,
            title: 'TPの増減',
            description: '対象アクターのTPを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(313, {
            code: 313,
            title: 'ステートの変更',
            description: '対象アクターのステートを付与/解除します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '付与' }, { value: 1, label: '解除' }] },
                { key: 'stateId', type: 'list', label: 'ステート', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.stateOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    stateId: Math.max(1, Math.floor(Number(p[3] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.stateId || 1) || 1))
                ];
            }
        });

        reg(314, {
            code: 314,
            title: '全回復',
            description: '対象アクターを全回復します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [targetType, targetRef];
            }
        });

        reg(315, {
            code: 315,
            title: '経験値の増減',
            description: '対象アクターの経験値を増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'showLevelUp', type: 'bool', label: 'レベルアップ表示を行う' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    showLevelUp: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.showLevelUp
                ];
            }
        });

        reg(316, {
            code: 316,
            title: 'レベルの増減',
            description: '対象アクターのレベルを増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 },
                { key: 'showLevelUp', type: 'bool', label: 'レベルアップ表示を行う' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[4] || 0) || 0)),
                    showLevelUp: !!p[5]
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0)),
                    !!state.showLevelUp
                ];
            }
        });

        reg(317, {
            code: 317,
            title: '能力値の増減',
            description: '対象アクターの能力値を増減します。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'paramId', type: 'select', label: '能力値', valueType: 'number', options: [{ value: 0, label: '最大HP' }, { value: 1, label: '最大MP' }, { value: 2, label: '攻撃力' }, { value: 3, label: '防御力' }, { value: 4, label: '魔法力' }, { value: 5, label: '魔法防御' }, { value: 6, label: '敏捷性' }, { value: 7, label: '運' }] },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', min: 0, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    paramId: Math.max(0, Math.min(7, Math.floor(Number(p[2] || 0) || 0))),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[3] || 0) || 0))),
                    operandType: Math.max(0, Math.min(1, Math.floor(Number(p[4] || 0) || 0))),
                    operand: Math.max(0, Math.floor(Number(p[5] || 0) || 0))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(7, Math.floor(Number(state.paramId || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))),
                    Math.max(0, Math.floor(Number(state.operand || 0) || 0))
                ];
            }
        });

        reg(318, {
            code: 318,
            title: 'スキルの増減',
            description: '対象アクターにスキルを習得/忘却させます。',
            fields: [
                { key: 'targetType', type: 'select', label: '対象指定', valueType: 'number', options: [{ value: 0, label: '直接指定' }, { value: 1, label: '変数で指定' }] },
                { key: 'actorId', type: 'list', label: '対象アクター(直接指定)', full: true, size: 10, search: true, valueType: 'number', options: function() { return [{ value: 0, label: '0000 パーティ全体' }].concat(self.actorOptionsForSchema()); } },
                { key: 'actorVarId', type: 'variable', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '習得' }, { value: 1, label: '忘却' }] },
                { key: 'skillId', type: 'list', label: 'スキル', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.skillOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    targetType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    actorId: Math.max(0, Math.floor(Number(p[1] || 0) || 0)),
                    actorVarId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    operation: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))),
                    skillId: Math.max(1, Math.floor(Number(p[3] || 1) || 1))
                };
            },
            toParams: function(state) {
                var targetType = Math.max(0, Math.min(1, Math.floor(Number(state.targetType || 0) || 0)));
                var targetRef = targetType === 0
                    ? Math.max(0, Math.floor(Number(state.actorId || 0) || 0))
                    : Math.max(1, Math.floor(Number(state.actorVarId || 1) || 1));
                return [
                    targetType,
                    targetRef,
                    Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))),
                    Math.max(1, Math.floor(Number(state.skillId || 1) || 1))
                ];
            }
        });

        reg(319, {
            code: 319,
            title: '装備の変更',
            description: '対象アクターの装備スロットを変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'equipTypeId', type: 'list', label: '装備タイプ', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.equipTypeOptionsForSchema(); } },
                { key: 'itemId', type: 'number', label: '装備ID', min: 0, step: 1, hint: '0で装備を外す。武器/防具IDは装備タイプに対応したIDを指定。' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    equipTypeId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    itemId: Math.max(0, Math.floor(Number(p[2] || 0) || 0))
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(1, Math.floor(Number(state.equipTypeId || 1) || 1)),
                    Math.max(0, Math.floor(Number(state.itemId || 0) || 0))
                ];
            }
        });

        reg(320, {
            code: 320,
            title: '名前の変更',
            description: '対象アクターの名前を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'name', type: 'text', label: '新しい名前', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    name: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.name == null ? '' : state.name)
                ];
            }
        });

        reg(321, {
            code: 321,
            title: '職業の変更',
            description: '対象アクターの職業を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'classId', type: 'list', label: '職業', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.classOptionsForSchema(); } },
                { key: 'keepExp', type: 'bool', label: '経験値を維持する' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    classId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)),
                    keepExp: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    Math.max(1, Math.floor(Number(state.classId || 1) || 1)),
                    !!state.keepExp
                ];
            }
        });

        reg(324, {
            code: 324,
            title: '二つ名の変更',
            description: '対象アクターの二つ名を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'nickname', type: 'text', label: '新しい二つ名', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    nickname: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.nickname == null ? '' : state.nickname)
                ];
            }
        });

        reg(325, {
            code: 325,
            title: 'プロフィールの変更',
            description: '対象アクターのプロフィール文を変更します。',
            fields: [
                { key: 'actorId', type: 'list', label: '対象アクター', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.actorOptionsForSchema(); } },
                { key: 'profile', type: 'textarea', label: 'プロフィール', full: true, rows: 8 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    actorId: Math.max(1, Math.floor(Number(p[0] || 1) || 1)),
                    profile: String(p[1] == null ? '' : p[1])
                };
            },
            toParams: function(state) {
                return [
                    Math.max(1, Math.floor(Number(state.actorId || 1) || 1)),
                    String(state.profile == null ? '' : state.profile)
                ];
            }
        });

        reg(331, {
            code: 331,
            title: '敵キャラのHP増減',
            description: '対象敵のHPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 },
                { key: 'allowDeath', type: 'bool', label: '戦闘不能を許可' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0), allowDeath: !!p[4] };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0), !!state.allowDeath];
            }
        });

        reg(332, {
            code: 332,
            title: '敵キャラのMP増減',
            description: '対象敵のMPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0)];
            }
        });

        reg(342, {
            code: 342,
            title: '敵キャラのTP増減',
            description: '対象敵のTPを増減します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'operation', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '増やす' }, { value: 1, label: '減らす' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }] },
                { key: 'operand', type: 'number', label: '値 / 変数ID', step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), operation: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), operandType: Math.max(0, Math.min(1, Math.floor(Number(p[2] || 0) || 0))), operand: Math.floor(Number(p[3] || 0) || 0) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.operation || 0) || 0))), Math.max(0, Math.min(1, Math.floor(Number(state.operandType || 0) || 0))), Math.floor(Number(state.operand || 0) || 0)];
            }
        });

        reg(333, {
            code: 333,
            title: '敵キャラのステート変更',
            description: '対象敵にステートを付与/解除します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'mode', type: 'select', label: '操作', valueType: 'number', options: [{ value: 0, label: '付与' }, { value: 1, label: '解除' }] },
                { key: 'stateId', type: 'list', label: 'ステート', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.stateOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), mode: Math.max(0, Math.min(1, Math.floor(Number(p[1] || 0) || 0))), stateId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0))), Math.max(1, Math.floor(Number(state.stateId || 1) || 1))];
            }
        });

        reg(334, {
            code: 334,
            title: '敵キャラの全回復',
            description: '対象敵を全回復します。',
            fields: [{ key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0) };
            },
            toParams: function(state) { return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0)]; }
        });

        reg(335, {
            code: 335,
            title: '敵キャラの出現',
            description: '対象敵を出現させます。',
            fields: [{ key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 }],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0) };
            },
            toParams: function(state) { return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0)]; }
        });

        reg(336, {
            code: 336,
            title: '敵キャラの変身',
            description: '対象敵を別の敵キャラに変身させます。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号(-1で全体)', min: -1, step: 1 },
                { key: 'enemyId', type: 'list', label: '変身先敵キャラ', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.enemyOptionsForSchema(); } }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), enemyId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)) };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(1, Math.floor(Number(state.enemyId || 1) || 1))];
            }
        });

        reg(337, {
            code: 337,
            title: '戦闘アニメーションの表示',
            description: '対象敵にアニメーションを表示します。',
            fields: [
                { key: 'enemyIndex', type: 'number', label: '敵キャラ番号', min: -1, step: 1, hint: '全体指定ON時は無視されます' },
                { key: 'animationId', type: 'list', label: 'アニメーション', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.animationOptionsForSchema(); } },
                { key: 'allEnemies', type: 'bool', label: '敵グループ全体に表示' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { enemyIndex: Math.floor(Number(p[0] == null ? -1 : p[0]) || 0), animationId: Math.max(1, Math.floor(Number(p[1] || 1) || 1)), allEnemies: !!p[2] };
            },
            toParams: function(state) {
                return [Math.floor(Number(state.enemyIndex == null ? -1 : state.enemyIndex) || 0), Math.max(1, Math.floor(Number(state.animationId || 1) || 1)), !!state.allEnemies];
            }
        });

        reg(339, {
            code: 339,
            title: '戦闘行動の強制',
            description: '敵/アクターにスキル使用を強制します。',
            fields: [
                { key: 'battlerType', type: 'select', label: '対象種別', valueType: 'number', options: [{ value: 0, label: '敵キャラ' }, { value: 1, label: 'アクター' }] },
                { key: 'targetId', type: 'number', label: '対象ID', min: -1, step: 1, hint: '敵: 番号(-1=全体) / アクター: アクターID' },
                { key: 'skillId', type: 'number', label: 'スキルID', min: 1, step: 1 },
                { key: 'forceTarget', type: 'number', label: '行動対象インデックス', step: 1, hint: '-2=最後の対象, -1=ランダム' }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return {
                    battlerType: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))),
                    targetId: Math.floor(Number(p[1] || 0) || 0),
                    skillId: Math.max(1, Math.floor(Number(p[2] || 1) || 1)),
                    forceTarget: Math.floor(Number(p[3] == null ? -2 : p[3]) || 0)
                };
            },
            toParams: function(state) {
                return [
                    Math.max(0, Math.min(1, Math.floor(Number(state.battlerType || 0) || 0))),
                    Math.floor(Number(state.targetId || 0) || 0),
                    Math.max(1, Math.floor(Number(state.skillId || 1) || 1)),
                    Math.floor(Number(state.forceTarget == null ? -2 : state.forceTarget) || 0)
                ];
            }
        });

        regNoParams(340, 'バトルの中断');

        reg(356, {
            code: 356,
            title: 'プラグインコマンド',
            description: '実行するプラグインコマンド行を入力します。',
            fields: [
                { key: 'pluginLine', type: 'text', label: 'コマンド行', full: true }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { pluginLine: String(p[0] || '') };
            },
            toParams: function(state) {
                return [String(state.pluginLine || '')];
            }
        });

        regNoParams(112, 'ループ');
        regNoParams(113, 'ループの中断');
        regNoParams(115, 'イベント処理の中断');
    };


    SH.registerModule('command_schemas', ['schema'], []);
})();
