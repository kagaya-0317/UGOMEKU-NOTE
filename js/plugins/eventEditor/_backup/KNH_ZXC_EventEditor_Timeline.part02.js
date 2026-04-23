        });

        reg(353, {
            code: 353,
            title: 'ゲームオーバー',
            description: 'ゲームオーバー画面へ遷移します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(354, {
            code: 354,
            title: 'タイトル画面に戻す',
            description: 'タイトル画面へ戻します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(132, {
            code: 132,
            title: '戦闘BGMの変更',
            description: '戦闘BGMを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(133, {
            code: 133,
            title: '勝利MEの変更',
            description: '勝利MEを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(139, {
            code: 139,
            title: '敗北MEの変更',
            description: '敗北MEを変更します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(134, {
            code: 134,
            title: 'セーブ禁止の変更',
            description: 'セーブの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'セーブ', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(135, {
            code: 135,
            title: 'メニュー禁止の変更',
            description: 'メニューの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'メニュー', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(136, {
            code: 136,
            title: 'エンカウント禁止の変更',
            description: 'エンカウントの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: 'エンカウント', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

        reg(137, {
            code: 137,
            title: '並び替え禁止の変更',
            description: '並び替えの禁止/許可を切り替えます。',
            fields: [
                { key: 'mode', type: 'select', label: '並び替え', valueType: 'number', options: [{ value: 0, label: '禁止' }, { value: 1, label: '許可' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                return { mode: Math.max(0, Math.min(1, Math.floor(Number(p[0] || 0) || 0))) };
            },
            toParams: function(state) {
                return [Math.max(0, Math.min(1, Math.floor(Number(state.mode || 0) || 0)))];
            }
        });

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
            description: '本文と、ウィンドウタイプ/しっぽ方向/ふきだし対象を設定します。',
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
                { key: 'targetCharId', type: 'list', label: '対象キャラ', full: true, size: 10, search: true, valueType: 'number',
                    visibleWhen: { key: 'targetMode', eq: 'char' },
                    options: function() { return self.characterTargetOptionsForSchema(true, true); }
                },
                { key: 'targetX', type: 'number', label: '画面X(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } },
                { key: 'targetY', type: 'number', label: '画面Y(px)', step: 1, integer: true, compact: true, visibleWhen: { key: 'targetMode', eq: 'coord' } }
            ],
            fromEntry: function(entry) {
                var lines = Array.isArray(entry && entry.messageLines) ? entry.messageLines : [];
                var tr = entry ? self.ensureTrack(entry.eventId, entry.pageIndex) : null;
                var st = entry && entry.messageExt
                    ? self.sanitizeMessageExtState(entry.messageExt)
                    : self.messageExtStateAtPoint(tr, entry ? entry.frame : 0, entry ? entry.uid : Infinity);
                return {
                    text: lines.join('\n'),
                    windowType: st.windowType,
                    tailDir: st.tailDir,
                    targetMode: st.targetMode,
                    targetCharId: st.targetCharId,
                    targetX: st.targetX,
                    targetY: st.targetY
                };
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
                    targetX: state && state.targetX,
                    targetY: state && state.targetY
                });
            }
        });

        reg(102, {
            code: 102,
            title: '選択肢の表示',
            description: '選択肢の文言と、既定/キャンセル/表示位置を設定します。',
            fields: [
                { key: 'choicesText', type: 'textarea', label: '選択肢 (1行=1択)', full: true, rows: 7 },
                { key: 'defaultType', type: 'number', label: '既定選択(0開始)', min: 0, step: 1 },
                { key: 'cancelType', type: 'number', label: 'キャンセル(-1禁止 / -2分岐)', min: -2, step: 1 },
                { key: 'positionType', type: 'select', label: 'ウィンドウ位置', valueType: 'number', options: [{ value: 0, label: '左' }, { value: 1, label: '中' }, { value: 2, label: '右' }] },
                { key: 'background', type: 'select', label: '背景', valueType: 'number', options: [{ value: 0, label: 'ウィンドウ' }, { value: 1, label: '暗くする' }, { value: 2, label: '透明' }] }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var cs = Array.isArray(p[0]) ? p[0] : [];
                return {
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
            }
        });

        reg(103, {
            code: 103,
            title: '数値入力の処理',
            description: '入力先の変数と桁数を設定します。',
            fields: [
                { key: 'variableId', type: 'list', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'variableId', type: 'list', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'fromVar', type: 'list', label: '開始変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'toVar', type: 'list', label: '終了変数', full: true, size: 9, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'opType', type: 'select', label: '演算', valueType: 'number', options: [{ value: 0, label: '代入' }, { value: 1, label: '加算' }, { value: 2, label: '減算' }, { value: 3, label: '乗算' }, { value: 4, label: '除算' }, { value: 5, label: '剰余' }] },
                { key: 'operandType', type: 'select', label: 'オペランド', valueType: 'number', options: [{ value: 0, label: '定数' }, { value: 1, label: '変数' }, { value: 2, label: '乱数' }, { value: 3, label: 'ゲームデータ' }, { value: 4, label: 'スクリプト' }] },
                { key: 'constValue', type: 'number', label: '定数値', step: 1 },
                { key: 'operandVarId', type: 'list', label: '参照変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'condType', type: 'select', label: '条件種別', valueType: 'number', options: [{ value: 0, label: 'スイッチ' }, { value: 1, label: '変数' }, { value: 2, label: 'セルフスイッチ' }, { value: 3, label: 'タイマー' }, { value: 11, label: 'ボタン' }, { value: 12, label: 'スクリプト' }] },
                { key: 'switchId', type: 'number', label: 'スイッチID', min: 1, step: 1 },
                { key: 'switchValue', type: 'select', label: 'スイッチ値', valueType: 'number', options: [{ value: 0, label: 'ON' }, { value: 1, label: 'OFF' }] },
                { key: 'varId', type: 'number', label: '変数ID', min: 1, step: 1 },
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
                return {
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
                { key: 'variableId', type: 'list', label: '格納先変数', full: true, size: 10, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'mapVarId', type: 'list', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'mapVarId', type: 'list', label: 'マップID変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
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
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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

        reg(206, {
            code: 206,
            title: '乗り物の乗降',
            description: 'プレイヤーを乗り物に乗降させます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

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
                    balloonId: Math.max(1, Math.min(10, Math.floor(Number(p[1] || 1) || 1))),
                    wait: !!p[2]
                };
            },
            toParams: function(state) {
                return [
                    self.normalizeMoveTarget(Number(state.targetId || 0)),
                    Math.max(1, Math.min(10, Math.floor(Number(state.balloonId || 1) || 1))),
                    !!state.wait
                ];
            }
        });

        reg(214, {
            code: 214,
            title: 'イベントの一時消去',
            description: 'このイベントを一時消去します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

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

        reg(217, {
            code: 217,
            title: '隊列メンバーの集合',
            description: '隊列メンバーを集合させます。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

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
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'xVarId', type: 'list', label: 'X変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
                { key: 'yVarId', type: 'list', label: 'Y変数', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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

        reg(221, {
            code: 221,
            title: '画面のフェードアウト',
            description: '画面をフェードアウトします。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(222, {
            code: 222,
            title: '画面のフェードイン',
            description: '画面をフェードインします。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

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

        reg(241, {
            code: 241,
            title: 'BGMの演奏',
            description: 'BGMを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGMファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(243, {
            code: 243,
            title: 'BGMの保存',
            description: '現在のBGMを保存します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(244, {
            code: 244,
            title: 'BGMの再開',
            description: '保存したBGMを再開します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

        reg(245, {
            code: 245,
            title: 'BGSの演奏',
            description: 'BGSを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'BGSファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(249, {
            code: 249,
            title: 'MEの演奏',
            description: 'MEを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'MEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(250, {
            code: 250,
            title: 'SEの演奏',
            description: 'SEを再生します。',
            fields: [
                { key: 'name', type: 'text', label: 'SEファイル名', full: true },
                { key: 'volume', type: 'number', label: '音量', min: 0, max: 100, step: 1 },
                { key: 'pitch', type: 'number', label: 'ピッチ', min: 50, max: 150, step: 1 },
                { key: 'pan', type: 'number', label: '位相', min: -100, max: 100, step: 1 }
            ],
            fromEntry: function(entry) {
                var p = (entry && entry.command && Array.isArray(entry.command.parameters)) ? entry.command.parameters : [];
                var a = (p[0] && typeof p[0] === 'object') ? p[0] : self.emptyAudioParam();
                return {
                    name: String(a.name || ''),
                    volume: Math.max(0, Math.min(100, Math.floor(Number(a.volume == null ? 90 : a.volume) || 90))),
                    pitch: Math.max(50, Math.min(150, Math.floor(Number(a.pitch == null ? 100 : a.pitch) || 100))),
                    pan: Math.max(-100, Math.min(100, Math.floor(Number(a.pan == null ? 0 : a.pan) || 0)))
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

        reg(251, {
            code: 251,
            title: 'SEの停止',
            description: '再生中のSEを停止します。',
            fields: [],
            fromEntry: function() { return {}; },
            toParams: function() { return []; }
        });

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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } }
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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
                { key: 'actorVarId', type: 'list', label: '対象アクター変数ID', full: true, size: 8, search: true, valueType: 'number', options: function() { return self.variableOptionsForSchema(); } },
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

        reg(340, { code: 340, title: 'バトルの中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });

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

        reg(112, { code: 112, title: 'ループ', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
        reg(113, { code: 113, title: 'ループの中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
        reg(115, { code: 115, title: 'イベント処理の中断', description: 'このコマンドはパラメータを持ちません。', fields: [], fromEntry: function() { return {}; }, toParams: function() { return []; } });
    };

    EE.prototype.getEditorSchema = function(code) {
        this.ensureEditorSchemas();
        return this._editorSchemas[Number(code || 0)] || null;
    };

    EE.prototype.schemaWithPendingAddWaitLimit = function(schema, entry) {
        if (!schema || !entry) return schema;
        if (!this._pendingNewUid || Number(entry.uid || 0) !== Number(this._pendingNewUid)) return schema;
        var maxWait = Math.floor(Number(entry._pendingWaitMaxFrames || 0));
        if (maxWait < 1) return schema;
        var fields = Array.isArray(schema.fields) ? schema.fields : null;
        if (!fields || !fields.length) return schema;
        var changed = false;
        var nextFields = [];
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            if (!f || f.type !== 'number' || String(f.key || '') !== 'duration') {
                nextFields.push(f);
                continue;
            }
            var nf = {};
            for (var k in f) nf[k] = f[k];
            nf.min = Math.max(1, Math.floor(Number(nf.min == null ? 1 : nf.min) || 1));
            nf.max = maxWait;
            if (nf.hint) nf.hint = String(nf.hint) + ' / 新規追加時の上限: ' + maxWait + 'f';
            else nf.hint = '新規追加時の上限: ' + maxWait + 'f';
            nextFields.push(nf);
            changed = true;
        }
        if (!changed) return schema;
        var out = {};
        for (k in schema) out[k] = schema[k];
        out.fields = nextFields;
        return out;
    };

    EE.prototype.resolveSchemaOptions = function(field, state) {
        if (!field) return [];
        if (typeof field.options === 'function') {
            try { return field.options.call(this, state) || []; } catch (_) { return []; }
        }
        return Array.isArray(field.options) ? field.options : [];
    };

    EE.prototype.normalizeSchemaOption = function(op) {
        if (op == null) return { value: '', label: '' };
        if (typeof op === 'object') {
            return {
                value: (op.value == null ? '' : op.value),
                label: String(op.label == null ? op.value : op.label)
            };
        }
        return { value: op, label: String(op) };
    };

    EE.prototype.normalizeSchemaOptions = function(options) {
        var src = Array.isArray(options) ? options : [];
        var wm = this._schemaNormalizedOptionCache;
        if (wm && wm.has(src)) return wm.get(src);
        var out = new Array(src.length);
        for (var i = 0; i < src.length; i++) {
            var it = this.normalizeSchemaOption(src[i]);
            var lbl = String(it.label == null ? '' : it.label);
            var val = String(it.value == null ? '' : it.value);
            out[i] = {
                value: it.value,
                label: lbl,
                _labelLc: lbl.toLowerCase(),
                _valueLc: val.toLowerCase()
            };
        }
        if (wm) wm.set(src, out);
        return out;
    };

    EE.prototype.schemaFieldShouldCompact = function(field, state) {
        if (!field || field.full) return false;
        if (field.compact === true) return true;
        if (field.compact === false) return false;
        if (field.type === 'textarea' || field.type === 'list' || field.type === 'bool') return false;

        var key = String(field.key || '');
        if (field.type === 'select') {
            var opts = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state));
            if (!opts.length) return false;
            var maxLen = 0;
            for (var i = 0; i < opts.length; i++) {
                var ln = String(opts[i].label || '').trim().length;
                if (ln > maxLen) maxLen = ln;
            }
            if (maxLen <= 8 && opts.length <= 16) return true;
            if (RE_COMPACT_SELECT_KEY.test(key)) return true;
            return false;
        }

        if (field.type === 'number') {
            var hasMin = (field.min != null && isFinite(Number(field.min)));
            var hasMax = (field.max != null && isFinite(Number(field.max)));
            if (hasMin && hasMax) {
                var min = Number(field.min);
                var max = Number(field.max);
                if (Math.abs(max - min) <= 999999) return true;
            }
            if (RE_COMPACT_NUMBER_KEY.test(key)) return true;
            return false;
        }

        if (field.type === 'text') {
            if (field.maxLength != null && Number(field.maxLength) <= 12) return true;
            if (RE_COMPACT_TEXT_KEY.test(key) && String(field.label || '').length <= 8) return true;
        }
        return false;
    };

    EE.prototype.fillSchemaSelect = function(select, options, value) {
        if (!select) return;
        select.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = 0; i < options.length; i++) {
            var src = options[i];
            var it = (src && typeof src === 'object' &&
                Object.prototype.hasOwnProperty.call(src, 'label') &&
                Object.prototype.hasOwnProperty.call(src, 'value'))
                ? src
                : this.normalizeSchemaOption(src);
            var op = document.createElement('option');
            op.value = String(it.value);
            op.textContent = it.label;
            frag.appendChild(op);
        }
        select.appendChild(frag);
        if (value != null) select.value = String(value);
        if (select.selectedIndex < 0 && select.options.length) select.selectedIndex = 0;
    };

    EE.prototype.renderSchemaField = function(field, value, state) {
        var selfEE = this;
        var row = this.el('div', 'sfr' + (field.full ? ' full' : ''));
        if (field && field.span != null) {
            var sp = Math.max(1, Math.min(4, Math.floor(Number(field.span || 0) || 0)));
            if (sp > 0) row.style.gridColumn = 'span ' + sp;
        }
        row.setAttribute('data-fkey', String(field && field.key || ''));
        var binding = { field: field, row: row, input: null, getValue: null, visible: true, searchInput: null, optionSource: null };
        if (field.type === 'bool') row.classList.add('bool');
        if (field.type === 'list') row.classList.add('list');
        if (this.schemaFieldShouldCompact(field, state)) row.classList.add('compact');

        if (field.type !== 'bool') row.appendChild(this.el('label', '', String(field.label || field.key || '')));

        if (field.type === 'textarea') {
            var ta = this.el('textarea', '');
            ta.value = String(value == null ? '' : value);
            if (field.rows) ta.rows = Math.max(2, Number(field.rows || 0));
            if (this.editSchema && Number(this.editSchema.code || 0) === 101 && String(field.key || '') === 'text') {
                ta.rows = 4;
                ta.style.minHeight = '76px';
                ta.style.height = '76px';
                ta.style.maxHeight = '76px';
            }
            row.appendChild(ta);
            binding.input = ta;
            binding.getValue = function() { return String(ta.value || ''); };
        } else if (field.type === 'text') {
            var tx = this.el('input', '');
            tx.type = 'text';
            tx.value = String(value == null ? '' : value);
            row.appendChild(tx);
            binding.input = tx;
            binding.getValue = function() { return String(tx.value || ''); };
        } else if (field.type === 'bool') {
            var cb = this.el('input', '');
            cb.type = 'checkbox';
            cb.checked = !!value;
            row.appendChild(this.el('label', '', String(field.label || field.key || '')));
            row.appendChild(cb);
            binding.input = cb;
            binding.getValue = function() { return !!cb.checked; };
        } else if (field.type === 'number') {
            var nu = this.el('input', '');
            nu.type = 'number';
            if (field.min != null) nu.min = String(field.min);
            if (field.max != null) nu.max = String(field.max);
            if (field.step != null) nu.step = String(field.step);
            nu.value = String(value == null ? (field.defaultValue == null ? '' : field.defaultValue) : value);
            this.attachNumberWheelInput(nu);
            row.appendChild(nu);
            binding.input = nu;
            binding.getValue = function() {
                var n = Number(nu.value);
                if (!isFinite(n)) throw new Error((field.label || field.key) + ' は数値で入力してください');
                if (field.integer !== false) n = Math.floor(n);
                if (field.min != null && n < field.min) throw new Error((field.label || field.key) + ' は ' + field.min + ' 以上で入力してください');
                if (field.max != null && n > field.max) throw new Error((field.label || field.key) + ' は ' + field.max + ' 以下で入力してください');
                return n;
            };
        } else if (field.type === 'taildir') {
            var cur = this.normalizeMessageTailDir(value == null ? 5 : value);
            var hidden = this.el('input', '');
            hidden.type = 'hidden';
            hidden.value = String(cur);
            var grid = this.el('div', 'tdg');
            var order = [7, 8, 9, 4, 5, 6, 1, 2, 3];
            var marks = {
                7: '↖', 8: '↑', 9: '↗',
                4: '←', 5: '・', 6: '→',
                1: '↙', 2: '↓', 3: '↘'
            };
            var btns = [];
            var refreshGrid = function() {
                var sel = Math.floor(Number(hidden.value || 5) || 5);
                for (var bi = 0; bi < btns.length; bi++) {
                    var b = btns[bi];
                    b.classList.toggle('on', Number(b.getAttribute('data-dir') || 0) === sel);
                }
            };
            for (var di = 0; di < order.length; di++) {
                var dir = order[di];
                var bt = this.el('button', 'tdgb', String(marks[dir] || dir));
                bt.type = 'button';
                bt.setAttribute('data-dir', String(dir));
                bt.title = String(dir);
                bt.addEventListener('click', (function(d) {
                    return function(ev) {
                        ev.preventDefault();
                        hidden.value = String(d);
                        refreshGrid();
                        selfEE.refreshSchemaFieldVisibility();
                    };
                })(dir));
                btns.push(bt);
                grid.appendChild(bt);
            }
            refreshGrid();
            row.appendChild(grid);
            row.appendChild(hidden);
            binding.input = hidden;
            binding.getValue = function() {
                return selfEE.normalizeMessageTailDir(hidden.value);
            };
        } else if (field.type === 'select' || field.type === 'list') {
            var search = null;
            if (field.type === 'list' && field.search) {
                search = this.el('input', '');
                search.type = 'text';
                search.placeholder = '検索...';
                row.appendChild(search);
            }
            var sl = this.el('select', '');
            if (field.type === 'list') sl.size = (String(field.key || '') === 'actorId') ? 6 : 10;
            this.attachSelectWheelInput(sl);
            var allOptions = this.normalizeSchemaOptions(this.resolveSchemaOptions(field, state));
            binding.optionSource = allOptions;
            this.fillSchemaSelect(sl, allOptions, value);
            if (search) {
                search.addEventListener('input', function() {
                    selfEE.applySchemaListFilter(binding);
                    selfEE.refreshSchemaFieldVisibility();
                });
                binding.searchInput = search;
            }
            row.appendChild(sl);
            binding.input = sl;
            binding.getValue = function() {
                var v = sl.value;
                if (field.valueType === 'number') return Math.floor(Number(v || 0) || 0);
                return String(v == null ? '' : v);
            };
        } else {
            var unk = this.el('input', '');
            unk.type = 'text';
            unk.value = String(value == null ? '' : value);
            row.appendChild(unk);
            binding.input = unk;
            binding.getValue = function() { return String(unk.value || ''); };
        }

        if (binding.input) {
            var triggerVis = function() { selfEE.refreshSchemaFieldVisibility(); };
            binding.input.addEventListener('change', triggerVis);
            if (field.type !== 'bool') binding.input.addEventListener('input', triggerVis);
        }
        if (field.hint) row.appendChild(this.el('div', 'hint', String(field.hint)));
        return binding;
    };

    EE.prototype.renderEditorSchema = function(schema, state) {
        this.editSchemaBindings = [];
        if (!this.edSchemaWrap || !this.edSchemaFields) return;
        this.edSchemaHead.textContent = String(schema && schema.title || '');
        this.edSchemaDesc.textContent = String(schema && schema.description || '');
        this.edSchemaFields.innerHTML = '';
        var scode = Number(schema && schema.code || 0);
        this.edSchemaFields.classList.toggle('msg101', scode === 101);
        var fs = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
        state = state || {};
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (!f || !f.key) continue;
            var v = (state.hasOwnProperty(f.key)) ? state[f.key] : f.defaultValue;
            var b = this.renderSchemaField(f, v, state);
            this.edSchemaFields.appendChild(b.row);
            this.editSchemaBindings.push(b);
        }
        this.refreshSchemaFieldVisibility();
    };

    EE.prototype.rawSchemaBindingValue = function(binding) {
        if (!binding || !binding.field || !binding.input) return undefined;
        var field = binding.field;
        var inp = binding.input;
        if (field.type === 'bool') return !!inp.checked;
        if (field.type === 'number') {
            var n = Number(inp.value);
            if (!isFinite(n)) n = (field.defaultValue == null ? 0 : Number(field.defaultValue || 0));
            if (!isFinite(n)) n = 0;
            if (field.integer !== false) n = Math.floor(n);
            return n;
        }
        if (field.type === 'select' || field.type === 'list') {
            var v = inp.value;
            if (field.valueType === 'number') return Math.floor(Number(v || 0) || 0);
            return String(v == null ? '' : v);
        }
        return String(inp.value == null ? '' : inp.value);
    };

    EE.prototype.collectEditorSchemaStateRaw = function() {
        var out = {};
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field) continue;
            out[b.field.key] = this.rawSchemaBindingValue(b);
        }
        return out;
    };

    EE.prototype.applySchemaListFilter = function(binding) {
        if (!binding || !binding.field || !binding.input) return;
        var field = binding.field;
        if (!(field.type === 'list' || field.type === 'select')) return;
        var options = Array.isArray(binding.optionSource) ? binding.optionSource : [];
        var q = '';
        if (binding.searchInput) q = String(binding.searchInput.value || '').toLowerCase();
        var filtered = [];
        for (var i = 0; i < options.length; i++) {
            var it = options[i];
            if (!q.length || String(it._labelLc || '').indexOf(q) >= 0 || String(it._valueLc || '').indexOf(q) >= 0) filtered.push(it);
        }
        var old = binding.input.value;
        this.fillSchemaSelect(binding.input, filtered, old);
    };

    EE.prototype.schemaFieldVisible = function(field, state) {
        if (!field) return true;
        if (typeof field.visibleWhen === 'function') {
            try { return !!field.visibleWhen.call(this, state || {}, field); } catch (_) { return true; }
        }
        if (field.visibleWhen && typeof field.visibleWhen === 'object') {
            var c = field.visibleWhen;
            var k = c.key;
            if (k != null) {
                var v = state ? state[k] : undefined;
                if (c.hasOwnProperty('eq') && v !== c.eq) return false;
                if (c.hasOwnProperty('ne') && v === c.ne) return false;
                if (Array.isArray(c.in) && c.in.indexOf(v) < 0) return false;
                if (Array.isArray(c.notIn) && c.notIn.indexOf(v) >= 0) return false;
            }
            if (Array.isArray(c.all)) {
                for (var ai = 0; ai < c.all.length; ai++) {
                    var cc = c.all[ai];
                    if (!this.schemaFieldVisible({ visibleWhen: cc }, state)) return false;
                }
            }
            if (Array.isArray(c.any) && c.any.length) {
                var ok = false;
                for (var aj = 0; aj < c.any.length; aj++) {
                    var c2 = c.any[aj];
                    if (this.schemaFieldVisible({ visibleWhen: c2 }, state)) { ok = true; break; }
                }
                if (!ok) return false;
            }
            return true;
        }
        return this.schemaFieldAutoVisible(field, state || {});
    };

    EE.prototype.schemaFieldAutoVisible = function(field, state) {
        var key = String(field.key || '');
        function has(k) { return Object.prototype.hasOwnProperty.call(state, k); }

        if (has('scopeType') && key === 'toVar') return Number(state.scopeType || 0) !== 0;

        if (has('targetType') && has('actorId') && has('actorVarId')) {
            if (key === 'actorId') return Number(state.targetType || 0) === 0;
            if (key === 'actorVarId') return Number(state.targetType || 0) === 1;
        }

        if (has('mode') && has('troopId') && has('troopVarId')) {
            if (key === 'troopId') return Number(state.mode || 0) === 0;
            if (key === 'troopVarId') return Number(state.mode || 0) === 1;
        }

        if (has('priceType') && key === 'price') return Number(state.priceType || 0) === 1;

        if (has('locType')) {
            var lt = Number(state.locType || 0);
            if (key === 'mapId' && has('mapVarId')) return lt === 0;
            if (key === 'mapVarId') return lt === 1;
            if ((key === 'x' || key === 'y') && has('xVarId') && has('yVarId')) return lt === 0;
            if (key === 'xVarId' || key === 'yVarId') return lt === 1;
            if (key === 'swapTargetId') return lt === 2;
        }

        if (has('coordType')) {
            var ct = Number(state.coordType || 0);
            if ((key === 'x' || key === 'y') && has('xVarId') && has('yVarId')) return ct === 0;
            if (key === 'xVarId' || key === 'yVarId') return ct === 1;
        }

        if (has('operandType')) {
            var ot = Number(state.operandType || 0);
            if (key === 'constValue') return ot === 0;
            if (key === 'operandVarId') return ot === 1;
            if (key === 'randMin' || key === 'randMax') return ot === 2;
            if (key === 'gameDataType' || key === 'gameDataP1' || key === 'gameDataP2') return ot === 3;
            if (key === 'script' && has('constValue')) return ot === 4;
        }

        if (has('condType')) {
            var cd = Number(state.condType || 0);
            if (key === 'switchId' || key === 'switchValue') return cd === 0;
            if (key === 'varId' || key === 'varOperandType' || key === 'varOperand' || key === 'varCompareType') return cd === 1;
            if (key === 'selfSwitch' || key === 'selfSwitchValue') return cd === 2;
            if (key === 'timerSec' || key === 'timerCmp') return cd === 3;
            if (key === 'buttonName') return cd === 11;
            if (key === 'script') return cd === 12;
        }

        if (has('allEnemies') && key === 'enemyIndex') return !state.allEnemies;
        if (has('loopX') && key === 'sx') return !!state.loopX;
        if (has('loopY') && key === 'sy') return !!state.loopY;

        return true;
    };

    EE.prototype.refreshSchemaDynamicOptions = function(state) {
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.input) continue;
            var f = b.field;
            if (!(f.type === 'select' || f.type === 'list')) continue;
            if (typeof f.options !== 'function') continue;
            var nextOptions = this.normalizeSchemaOptions(this.resolveSchemaOptions(f, state));
            if (b.optionSource === nextOptions) continue;
            var old = b.input.value;
            b.optionSource = nextOptions;
            this.fillSchemaSelect(b.input, b.optionSource, old);
            if (b.searchInput) this.applySchemaListFilter(b);
        }
    };

    EE.prototype.refreshSchemaFieldVisibility = function() {
        var state = this.collectEditorSchemaStateRaw();
        this.refreshSchemaDynamicOptions(state);
        state = this.collectEditorSchemaStateRaw();
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.row) continue;
            var vis = this.schemaFieldVisible(b.field, state);
            b.visible = !!vis;
            b.row.style.display = vis ? '' : 'none';
        }
        if (this.shouldShowAnimationPreviewInEditor()) {
            this.requestAnimationPreviewPlayback(false);
        }
    };

    EE.prototype.collectEditorSchemaState = function() {
        var out = {};
        var bs = this.editSchemaBindings || [];
        for (var i = 0; i < bs.length; i++) {
            var b = bs[i];
            if (!b || !b.field || !b.getValue) continue;
            var v = (b.visible === false) ? this.rawSchemaBindingValue(b) : b.getValue();
            out[b.field.key] = v;
        }
        return out;
    };

    EE.prototype.currentEditingEntry = function() {
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return null;
        var uid = Math.floor(Number(this.editUid || 0));
        if (uid <= 0) return null;
        for (var i = 0; i < tr.commands.length; i++) {
            var e = tr.commands[i];
            if (!e) continue;
            if (Math.floor(Number(e.uid || 0)) === uid) return e;
        }
        return null;
    };

    EE.prototype.currentEditingRouteTargetId = function() {
        var rli = (this.editRouteListIndex == null) ? -1 : Number(this.editRouteListIndex);
        if (rli < 0) return 0;
        var e = this.currentEditingEntry();
        if (!e || !e.command || Number(e.command.code || 0) !== 205) return 0;
        var p = Array.isArray(e.command.parameters) ? e.command.parameters : [];
        return this.normalizeMoveTarget(Number(p[0] || e.charId || 0));
    };

    EE.prototype.editorPreviewMode = function() {
        if (!this.editSchema) return '';
        if (!this.edSchemaWrap || this.edSchemaWrap.style.display === 'none') return '';
        var code = Number(this.editSchema.code || 0);
        if (code === 212) return 'animation';
        var rli = (this.editRouteListIndex == null) ? -1 : Number(this.editRouteListIndex);
        if (rli >= 0) {
            if (code === 4510 || code === 4511) return 'frame';
            if (code === 4514) return 'image';
        }
        return '';
    };

    EE.prototype.shouldShowAnimationPreviewInEditor = function() {
        return this.editorPreviewMode().length > 0;
    };

    EE.prototype.isAnimationPreviewEditorActive = function() {
        if (!this.shouldShowAnimationPreviewInEditor()) return false;
        if (!this.modal || !this.modal.classList || !this.modal.classList.contains('on')) return false;
        return true;
    };

    EE.prototype.animationPreviewStateFromRaw = function(raw) {
        raw = (raw && typeof raw === 'object') ? raw : {};
        var mode = this.editorPreviewMode();
        if (mode === 'frame') {
            var tid = this.currentEditingRouteTargetId();
            var wait = Math.max(1, Math.floor(Number(raw.speed || 6) || 6));
            var loop = !!raw.loop;
            var frameSpec = '[8,9,10]';
            var cells = [8, 9, 10];
            var useImage = !!raw.useImage;
            if (!Object.prototype.hasOwnProperty.call(raw, 'useImage')) {
                var editCode = Number(this.editSchema && this.editSchema.code || 0);
                if (editCode === 4511) useImage = true;
            }
            var imageName = null;
            var imageIndex = 0;
            var imageDir = 2;
            var p = this.parseFrameAnimationFrameSpecLiteral(raw.frameSpec);
            if (!p && raw.animId != null) p = this.parseFrameAnimationFrameSpecLiteral(String(Math.max(1, Math.floor(Number(raw.animId || 1) || 1))));
            if (p) {
                frameSpec = String(p.literal || frameSpec);
                cells = (p.kind === 'number') ? Math.max(1, Math.floor(Number(p.number || 1) || 1)) : (Array.isArray(p.values) ? p.values.slice(0) : [8, 9, 10]);
            }
            if (useImage) {
                imageName = String(raw.imageName || '');
                imageIndex = Math.floor(Number(raw.imageIndex || 0) || 0);
                imageDir = this.normalizeDirection8(Number(raw.imageDir || 2), 2);
            }
            return {
                mode: 'frame',
                targetId: tid,
                frameSpec: frameSpec,
                cells: cells,
                wait: wait,
                loop: loop,
                useImage: useImage,
                imageName: imageName,
                imageIndex: imageIndex,
                imageDir: imageDir
            };
        }

        if (mode === 'image') {
            return {
                mode: 'image',
                targetId: this.currentEditingRouteTargetId(),
                imageName: String(raw.name || ''),
                imageIndex: Math.floor(Number(raw.index || 0) || 0),
                imageDir: this.normalizeDirection8(Number(raw.direction || 2), 2)
            };
        }

        var aid = Math.max(1, Math.floor(Number(raw.animationId || 1) || 1));
        var tid2 = this.normalizeMoveTarget(Number(raw.targetId || 0));
        var addX = Number(raw.addX || 0);
        var addY = Number(raw.addY || 0);
        var scale = Number(raw.scale == null ? 1 : raw.scale);
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        return {
            mode: 'animation',
            targetId: tid2,
            animationId: aid,
            addX: addX,
            addY: addY,
            scale: scale
        };
    };

    EE.prototype.animationPreviewStateSig = function(spec) {
        if (!spec) return '';
        if (String(spec.mode || '') === 'image') {
            return [
                'image',
                String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
                String(spec.imageName == null ? '' : spec.imageName),
                String(Math.floor(Number(spec.imageIndex || 0) || 0)),
                String(this.normalizeDirection8(Number(spec.imageDir || 2), 2))
            ].join('|');
        }
        if (String(spec.mode || '') === 'frame') {
            var useImage = !!spec.useImage;
            return [
                'frame',
                String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
                String(spec.frameSpec == null ? '' : spec.frameSpec),
                String(Math.max(1, Math.floor(Number(spec.wait || 6) || 6))),
                String(!!spec.loop),
                String(useImage),
                String(useImage ? (spec.imageName == null ? '' : spec.imageName) : ''),
                String(useImage ? Math.floor(Number(spec.imageIndex || 0) || 0) : 0),
                String(useImage ? this.normalizeDirection8(Number(spec.imageDir || 2), 2) : 2)
            ].join('|');
        }
        return [
            'animation',
            String(this.normalizeMoveTarget(Number(spec.targetId || 0))),
            String(Math.max(1, Math.floor(Number(spec.animationId || 1) || 1))),
            String(Number(spec.addX || 0)),
            String(Number(spec.addY || 0)),
            String(Number(spec.scale == null ? 1 : spec.scale))
        ].join('|');
    };

    EE.prototype.updateAnimationPreviewTitle = function() {
        if (!this.animPreviewTitle) return;
        var mode = this.editorPreviewMode();
        if (mode === 'frame') this.animPreviewTitle.textContent = 'フレームアニメプレビュー（自動再生）';
        else if (mode === 'image') this.animPreviewTitle.textContent = '画像プレビュー（setImageZXC）';
        else this.animPreviewTitle.textContent = 'アニメーションプレビュー（自動再生）';
    };

    EE.prototype.animationPreviewTargetName = function(targetId) {
        targetId = this.normalizeMoveTarget(Number(targetId || 0));
        if (typeof this.rowLabelForCharId === 'function') return String(this.rowLabelForCharId(targetId) || '');
        if (targetId === -1) return 'プレイヤー';
        if (targetId === 0) return 'このイベント';
        return 'イベント ' + targetId;
    };

    EE.prototype.setAnimationPreviewInfo = function(text, isError) {
        if (!this.animPreviewInfo) return;
        this.animPreviewInfo.textContent = String(text || '');
        this.animPreviewInfo.style.color = isError
            ? 'rgba(255,170,170,.98)'
            : 'rgba(182,200,228,.95)';
    };

    EE.prototype.isAnimationPreviewOverlayOpen = function() {
        return !!(this.animPreviewOverlay && this.animPreviewOverlay.classList && this.animPreviewOverlay.classList.contains('on'));
    };

    EE.prototype.resolveAnimationPreviewOverlayImageState = function() {
        var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
        var mode = String(spec && spec.mode || 'animation');
        var name = '';
        var idx = 0;
        var dir = 2;
        var targetLabel = '';
        if (mode === 'image') {
            name = String(spec && spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec && spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec && spec.imageDir || 2), 2);
            targetLabel = 'setImageZXC';
            return { mode: mode, name: name, index: idx, direction: dir, targetLabel: targetLabel };
        }
        if (mode === 'frame' && spec && spec.useImage && String(spec.imageName || '').length) {
            name = String(spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec.imageDir || 2), 2);
            targetLabel = 'setImageZXC + startFrameAnimation';
            return { mode: mode, name: name, index: idx, direction: dir, targetLabel: targetLabel };
        }
        var targetId = this.normalizeMoveTarget(Number(spec && spec.targetId || 0));
        var src = this.animPreviewSourceChar || null;
        if (!src && this.characterByPanelId) src = this.characterByPanelId(targetId);
        if (!src) src = this.animPreviewProxyChar || null;
        if (src) {
            name = String(src._characterName || '');
            idx = Math.max(0, Math.floor(Number(src._characterIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(src._direction || 2), 2);
        }
        targetLabel = this.animationPreviewTargetName(targetId);
        return { mode: mode, name: name, index: idx, direction: dir, targetLabel: targetLabel };
    };

    EE.prototype.drawAnimationPreviewSheetCanvas = function(canvas, infoEl, name, idx, dir, opts) {
        opts = opts || {};
        var mode = String(opts.mode || '');
        var maxW = Math.max(64, Math.floor(Number(opts.maxW || 300) || 300));
        var maxH = Math.max(64, Math.floor(Number(opts.maxH || 220) || 220));
        var targetLabel = String(opts.targetLabel || '');
        var noHighlight = !!opts.noHighlight || mode === 'frame';
        if (!canvas || !canvas.getContext || !infoEl) return;
        name = String(name || '');
        idx = Math.max(0, Math.floor(Number(idx || 0) || 0));
        dir = this.normalizeDirection8(Number(dir || 2), 2);
        var ctx = canvas.getContext('2d');
        if (!name.length) {
            canvas.width = 64;
            canvas.height = 64;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            infoEl.textContent = '画像名が未設定です。';
            return;
        }
        var self = this;
        var bmp = ImageManager.loadCharacter(name);
        var draw = function() {
            if (!bmp || !bmp.width || !bmp.height) return;
            var src = bmp._canvas || bmp.canvas || bmp._image || null;
            if (!src) {
                canvas.width = 64;
                canvas.height = 64;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                infoEl.textContent = '画像を描画できません。';
                return;
            }
            var w = Math.max(1, Math.floor(Number(bmp.width || 1)));
            var h = Math.max(1, Math.floor(Number(bmp.height || 1)));
            var scale = Math.min(maxW / Math.max(1, w), maxH / Math.max(1, h));
            if (!isFinite(scale) || scale <= 0) scale = 1;
            var dw = Math.max(1, Math.floor(w * scale));
            var dh = Math.max(1, Math.floor(h * scale));
            canvas.width = dw;
            canvas.height = dh;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, dw, dh);
            ctx.drawImage(src, 0, 0, w, h, 0, 0, dw, dh);

            var row = (dir === 2) ? 0 : (dir === 4 ? 1 : (dir === 6 ? 2 : 3));
            var big = ImageManager.isBigCharacter(name);
            var rx = 0, ry = 0, rw = 1, rh = 1;
            if (big) {
                var bCellH = h / 4;
                rx = 0;
                ry = row * bCellH;
                rw = w;
                rh = bCellH;
            } else {
                var idxClamped = Math.max(0, Math.min(7, idx));
                var charW = w / 4;
                var charH = h / 2;
                var cx = (idxClamped % 4) * charW;
                var cy = Math.floor(idxClamped / 4) * charH;
                var cellH = charH / 4;
                rx = cx;
                ry = cy + row * cellH;
                rw = charW;
                rh = cellH;
            }
            var dx = Math.floor(rx * dw / w) + 0.5;
            var dy = Math.floor(ry * dh / h) + 0.5;
            var dww = Math.max(1, Math.floor(rw * dw / w));
            var dhh = Math.max(1, Math.floor(rh * dh / h));
            if (!noHighlight) {
                ctx.strokeStyle = 'rgba(255,170,70,.98)';
                ctx.lineWidth = 2;
                ctx.strokeRect(dx, dy, dww, dhh);
                ctx.fillStyle = 'rgba(255,150,40,.14)';
                ctx.fillRect(Math.floor(dx), Math.floor(dy), dww, dhh);
            }

            var info = 'name: ' + name + ' / index: ' + idx + ' / direction: ' + dir + ' / sheet: ' + w + 'x' + h;
            if (targetLabel.length) info = '対象: ' + targetLabel + ' / ' + info;
            infoEl.textContent = info;
        };
        if (bmp && typeof bmp.isError === 'function' && bmp.isError()) {
            infoEl.textContent = '画像を読み込めません。';
            return;
        }
        if (bmp && bmp.isReady && bmp.isReady()) draw();
        else if (bmp && bmp.addLoadListener) {
            infoEl.textContent = '画像読み込み中...';
            bmp.addLoadListener(function() {
                if (!self.animPreviewOverlay && !self.animPreviewSheetCanvas) return;
                if (bmp && typeof bmp.isError === 'function' && bmp.isError()) {
                    infoEl.textContent = '画像を読み込めません。';
                    return;
                }
                draw();
            });
        } else {
            infoEl.textContent = '画像を読み込めません。';
        }
    };

    EE.prototype.openAnimationPreviewImageOverlay = function(name, idx, dir, targetLabel, sourceMode) {
        if (!this.animPreviewOverlay || !this.animPreviewOverlayCanvas || !this.animPreviewOverlayInfo) return false;
        this.endAnimationPreviewPanDrag();
        this.animPreviewOverlay.classList.add('on');
        var vw = 0;
        var vh = 0;
        try {
            vw = Math.max(320, Math.floor(Number(window.innerWidth || 0) - 120));
            vh = Math.max(240, Math.floor(Number(window.innerHeight || 0) - 150));
        } catch (_) {
            vw = 640;
            vh = 480;
        }
        this.drawAnimationPreviewSheetCanvas(
            this.animPreviewOverlayCanvas,
            this.animPreviewOverlayInfo,
            name,
                idx,
                dir,
                {
                mode: String(sourceMode || 'overlay'),
                maxW: vw,
                maxH: vh,
                targetLabel: targetLabel,
                noHighlight: String(sourceMode || '') === 'frame'
            }
        );
        return true;
    };

    EE.prototype.openAnimationPreviewImageOverlayFromEditor = function() {
        var state = this.resolveAnimationPreviewOverlayImageState();
        return this.openAnimationPreviewImageOverlay(
            state && state.name,
            state && state.index,
            state && state.direction,
            state && state.targetLabel,
            state && state.mode
        );
    };

    EE.prototype.closeAnimationPreviewImageOverlay = function() {
        if (!this.animPreviewOverlay || !this.animPreviewOverlay.classList) return;
        this.animPreviewOverlay.classList.remove('on');
    };

    EE.prototype.refreshAnimationPreviewSheet = function(force) {
        if (!this.animPreviewSheetWrap || !this.animPreviewSheetCanvas || !this.animPreviewSheetInfo) return;
        var mode = this.editorPreviewMode();
        var visible = this.shouldShowAnimationPreviewInEditor() && (mode === 'image');
        this.animPreviewSheetWrap.classList.toggle('on', visible);
        if (this.animPreviewSheetBtn) {
            this.animPreviewSheetBtn.style.display = (mode === 'image') ? 'none' : '';
            this.animPreviewSheetBtn.textContent = '現在画像';
        }
        if (!visible) return;
        var name = '';
        var idx = 0;
        var dir = 2;
        if (mode === 'image') {
            var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
            name = String(spec && spec.imageName || '');
            idx = Math.max(0, Math.floor(Number(spec && spec.imageIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(spec && spec.imageDir || 2), 2);
        } else {
            var ch = this.animPreviewSourceChar || this.animPreviewProxyChar;
            if (!ch) {
                this.animPreviewSheetInfo.textContent = 'キャラ情報を取得できません。';
                return;
            }
            name = String(ch._characterName || '');
            idx = Math.max(0, Math.floor(Number(ch._characterIndex || 0) || 0));
            dir = this.normalizeDirection8(Number(ch._direction || 2), 2);
        }
        var key = mode + '|' + name + '|' + idx + '|' + dir;
        if (!force && key === this.animPreviewSheetLastKey) return;
        this.animPreviewSheetLastKey = key;
        this.drawAnimationPreviewSheetCanvas(
            this.animPreviewSheetCanvas,
            this.animPreviewSheetInfo,
            name,
            idx,
            dir,
            {
                mode: mode,
                maxW: 300,
                maxH: 240,
                targetLabel: 'setImageZXC'
            }
        );
    };

    EE.prototype.animationPreviewLogTimestamp = function() {
        var d = new Date();
        function z2(v) { return ('0' + v).slice(-2); }
        function z3(v) { return ('00' + v).slice(-3); }
        return z2(d.getHours()) + ':' + z2(d.getMinutes()) + ':' + z2(d.getSeconds()) + '.' + z3(d.getMilliseconds());
    };

    EE.prototype.pushAnimationPreviewLog = function(text, isError) {
        text = String(text == null ? '' : text);
        var line = '[' + this.animationPreviewLogTimestamp() + '] ' + text;
        if (!Array.isArray(this.animPreviewLogLines)) this.animPreviewLogLines = [];
        this.animPreviewLogLines.push(line);
        if (this.animPreviewLogLines.length > 14) this.animPreviewLogLines.splice(0, this.animPreviewLogLines.length - 14);
        if (this.animPreviewLogView) {
            this.animPreviewLogView.textContent = this.animPreviewLogLines.join('\n');
            this.animPreviewLogView.scrollTop = this.animPreviewLogView.scrollHeight;
            this.animPreviewLogView.style.color = isError ? 'rgba(255,178,178,.98)' : 'rgba(198,214,236,.95)';
        }
        try {
            if (isError) console.warn('[EE Preview]', text);
            else console.log('[EE Preview]', text);
        } catch (_) {}
    };

    EE.prototype.clearAnimationPreviewLog = function() {
        this.animPreviewLogLines = [];
        if (this.animPreviewLogView) this.animPreviewLogView.textContent = '';
    };

    EE.prototype.startAnimationPreviewPanDrag = function(clientX, clientY) {
        if (!this.isAnimationPreviewEditorActive()) return false;
        this.animPreviewPanDragging = true;
        this.animPreviewPanLastX = Number(clientX || 0);
        this.animPreviewPanLastY = Number(clientY || 0);
        if (this.animPreviewViewport && this.animPreviewViewport.classList) this.animPreviewViewport.classList.add('dragging');
        return true;
    };

    EE.prototype.updateAnimationPreviewPanDrag = function(clientX, clientY) {
        if (!this.animPreviewPanDragging) return false;
        var x = Number(clientX || 0);
        var y = Number(clientY || 0);
        var dx = x - Number(this.animPreviewPanLastX || 0);
        var dy = y - Number(this.animPreviewPanLastY || 0);
        this.animPreviewPanLastX = x;
        this.animPreviewPanLastY = y;
        if (!isFinite(dx) || !isFinite(dy)) return false;
        this.animPreviewPanX = Math.max(-4096, Math.min(4096, Number(this.animPreviewPanX || 0) + dx));
        this.animPreviewPanY = Math.max(-4096, Math.min(4096, Number(this.animPreviewPanY || 0) + dy));
        return true;
    };

    EE.prototype.endAnimationPreviewPanDrag = function() {
        if (!this.animPreviewPanDragging) return false;
        this.animPreviewPanDragging = false;
        if (this.animPreviewViewport && this.animPreviewViewport.classList) this.animPreviewViewport.classList.remove('dragging');
        return true;
    };

    EE.prototype.clearAnimationPreviewCharacter = function() {
        if (this.animPreviewWorld && Array.isArray(this.animPreviewWorld.children)) {
            var children = this.animPreviewWorld.children.slice(0);
            for (var i = 0; i < children.length; i++) {
                var ch = children[i];
                if (!ch) continue;
                if (ch.parent) {
                    try { ch.parent.removeChild(ch); } catch (_) {}
                }
                if (ch.destroy) {
                    try { ch.destroy({ children: true }); } catch (_) {}
                }
            }
        }
        if (this.animPreviewSprite && this.animPreviewSprite.parent) {
            this.animPreviewSprite.parent.removeChild(this.animPreviewSprite);
        }
        if (this.animPreviewSprite && this.animPreviewSprite.destroy) {
            try { this.animPreviewSprite.destroy({ children: true }); } catch (_) {}
        }
        this.animPreviewSprite = null;
        this.animPreviewProxyChar = null;
        this.animPreviewSourceChar = null;
        this.animPreviewTargetId = null;
    };

    EE.prototype.pruneAnimationPreviewWorldChildren = function() {
        if (!this.animPreviewWorld || !Array.isArray(this.animPreviewWorld.children)) return;
        var children = this.animPreviewWorld.children.slice(0);
        for (var i = 0; i < children.length; i++) {
            var ch = children[i];
            if (!ch) continue;
            var remove = false;
            if (ch._destroyed || ch.destroyed) remove = true;
            if (!remove && ch.parent !== this.animPreviewWorld) remove = true;
            if (!remove && typeof Sprite_Animation !== 'undefined' && ch instanceof Sprite_Animation) {
                if (!ch._animation || !ch._target || ch._target._destroyed || !ch._target.parent) remove = true;
            }
            if (!remove) continue;
            if (ch.parent) {
                try { ch.parent.removeChild(ch); } catch (_) {}
            }
            if (ch.destroy) {
                try { ch.destroy({ children: true }); } catch (_) {}
            }
        }
    };

    EE.prototype.disposeAnimationPreviewRenderer = function() {
        this.clearAnimationPreviewCharacter();
        if (this.animPreviewRenderer && this.animPreviewRenderer.destroy) {
            try { this.animPreviewRenderer.destroy(true); } catch (_) {}
        }
        this.animPreviewRenderer = null;
        this.animPreviewRendererW = 0;
        this.animPreviewRendererH = 0;
        this.animPreviewStage = null;
        this.animPreviewBack = null;
        this.animPreviewWorld = null;
        if (this.animPreviewViewport) this.animPreviewViewport.innerHTML = '';
    };

    EE.prototype.redrawAnimationPreviewBackdrop = function() {
        if (!this.animPreviewBack) return;
        var w = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var h = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        var g = this.animPreviewBack;
        g.clear();
        g.beginFill(0x0b121a, 0.74);
        g.drawRect(0, 0, w, h);
        g.endFill();
        var gy = Math.floor(h * 0.78) + 0.5;
        g.lineStyle(1, 0x6f8fb6, 0.45);
        g.moveTo(0, gy);
        g.lineTo(w, gy);
        g.lineStyle(1, 0x35506f, 0.22);
        var cx = Math.floor(w * 0.5) + 0.5;
        g.moveTo(cx, 0);
        g.lineTo(cx, h);
    };

    EE.prototype.resizeAnimationPreviewRenderer = function() {
        if (!this.animPreviewRenderer || !this.animPreviewViewport) return;
        var w = Math.max(96, Math.floor(Number(this.animPreviewViewport.clientWidth || 0) || 220));
        var h = Math.max(96, Math.floor(Number(this.animPreviewViewport.clientHeight || 0) || 188));
        if (w === this.animPreviewRendererW && h === this.animPreviewRendererH) return;
        this.animPreviewRendererW = w;
        this.animPreviewRendererH = h;
        try { this.animPreviewRenderer.resize(w, h); } catch (_) {}
        this.redrawAnimationPreviewBackdrop();
        var spr = this.animPreviewSprite;
        var anims = spr && Array.isArray(spr._animationSprites) ? spr._animationSprites : [];
        for (var i = 0; i < anims.length; i++) {
            if (!anims[i]) continue;
            anims[i]._eePreviewViewport = { w: w, h: h };
        }
    };

    EE.prototype.ensureAnimationPreviewRenderer = function() {
        if (!this.animPreviewViewport) return false;
        if (typeof PIXI === 'undefined' || !PIXI.autoDetectRenderer || typeof Sprite_Character === 'undefined') {
            this.setAnimationPreviewInfo('プレビューを初期化できません (PIXI/Sprite_Character が未定義です)', true);
            this.pushAnimationPreviewLog('init failed: PIXI/Sprite_Character missing', true);
            return false;
        }
        if (!this.animPreviewRenderer) {
            try {
                this.animPreviewRenderer = PIXI.autoDetectRenderer(220, 188, {
                    transparent: true,
                    antialias: true,
                    preserveDrawingBuffer: false
                });
            } catch (er) {
                this.animPreviewRenderer = null;
                this.setAnimationPreviewInfo('プレビュー初期化失敗: ' + String(er && er.message || er), true);
                this.pushAnimationPreviewLog('renderer create error: ' + String(er && er.message || er), true);
                return false;
            }
            if (!this.animPreviewRenderer || !this.animPreviewRenderer.view) {
                this.setAnimationPreviewInfo('プレビュー初期化に失敗しました', true);
                this.pushAnimationPreviewLog('renderer create failed (no view)', true);
                return false;
            }
            this.animPreviewStage = new PIXI.Container();
            this.animPreviewBack = new PIXI.Graphics();
            this.animPreviewWorld = new PIXI.Container();
            this.animPreviewStage.addChild(this.animPreviewBack);
            this.animPreviewStage.addChild(this.animPreviewWorld);
            this.animPreviewViewport.innerHTML = '';
            this.animPreviewViewport.appendChild(this.animPreviewRenderer.view);
            this.animPreviewRendererW = 0;
            this.animPreviewRendererH = 0;
            this.pushAnimationPreviewLog('renderer created');
        }
        this.resizeAnimationPreviewRenderer();
        return true;
    };

    EE.prototype.ensureAnimationPreviewCharacter = function(targetId) {
        targetId = this.normalizeMoveTarget(Number(targetId || 0));
        var src = this.characterByPanelId ? this.characterByPanelId(targetId) : null;
        if (!src) {
            this.clearAnimationPreviewCharacter();
            this.animPreviewTargetId = targetId;
            this.pushAnimationPreviewLog('target not found: ' + this.animationPreviewTargetName(targetId), true);
            return false;
        }
        if (this.animPreviewSprite && this.animPreviewProxyChar && this.animPreviewSourceChar === src && this.animPreviewTargetId === targetId) {
            return true;
        }
        this.clearAnimationPreviewCharacter();
        this.animPreviewProxyChar = new EE_AnimationPreviewCharacter();
        this.animPreviewProxyChar.syncFrom(src);
        this.animPreviewSprite = new Sprite_Character(this.animPreviewProxyChar);
        if (this.animPreviewWorld) this.animPreviewWorld.addChild(this.animPreviewSprite);
        this.animPreviewSourceChar = src;
        this.animPreviewTargetId = targetId;
        this.pushAnimationPreviewLog('target sync: ' + this.animationPreviewTargetName(targetId));
        return true;
    };

    EE.prototype.playAnimationPreviewFrameNow = function(spec, proxy, spr) {
        if (!spec || !proxy || !spr) return false;
        var wait = Math.max(1, Math.floor(Number(spec.wait || 6) || 6));
        var loop = !!spec.loop;
        var cells = spec.cells;
        if (Array.isArray(cells)) {
            cells = cells.slice(0);
            if (!cells.length) cells = [0, 1, 2];
            for (var i = 0; i < cells.length; i++) cells[i] = Math.floor(Number(cells[i] || 0) || 0);
        } else {
            cells = Math.max(1, Math.floor(Number(cells || 1) || 1));
        }
        if (spec.useImage && spec.imageName != null && String(spec.imageName).length) {
            if (proxy.setImageZXC) proxy.setImageZXC(String(spec.imageName), Math.floor(Number(spec.imageIndex || 0) || 0), this.normalizeDirection8(Number(spec.imageDir || 2), 2));
            else {
                proxy._characterName = String(spec.imageName);
                proxy._characterIndex = Math.floor(Number(spec.imageIndex || 0) || 0);
                proxy._direction = this.normalizeDirection8(Number(spec.imageDir || 2), 2);
                if (spr.updateBitmap) {
                    try { spr.updateBitmap(); } catch (_) {}
                }
            }
        } else if (this.animPreviewSourceChar && proxy.syncFrom) {
            // "画像変更しない"時は現在キャラ状態の画像を使う。
            proxy.syncFrom(this.animPreviewSourceChar);
            if (spr.updateBitmap) {
                try { spr.updateBitmap(); } catch (_) {}
            }
        }
        if (!proxy.startFrameAnimation) {
            this.pushAnimationPreviewLog('play failed: startFrameAnimation missing', true);
            return false;
        }
        try {
            proxy.startFrameAnimation(cells, wait, loop);
            if (spr.update) spr.update();
            this.pushAnimationPreviewLog(
                'play frame: cells=' + (Array.isArray(cells) ? ('[' + cells.join(',') + ']') : String(cells)) +
                ' wait=' + wait + ' loop=' + String(loop)
            );
            return true;
        } catch (er) {
            this.pushAnimationPreviewLog('play frame error: ' + String(er && er.message || er), true);
            return false;
        }
    };

    EE.prototype.playAnimationPreviewNow = function(spec, proxy, spr) {
        if (!spec || !proxy || !spr) return false;
        if (String(spec.mode || '') === 'frame') {
            return this.playAnimationPreviewFrameNow(spec, proxy, spr);
        }
        this.pruneAnimationPreviewWorldChildren();
        var aid = Math.max(1, Math.floor(Number(spec.animationId || 1) || 1));
        var anim = ($dataAnimations && $dataAnimations[aid]) ? $dataAnimations[aid] : null;
        var addX = Number(spec.addX || 0);
        var addY = Number(spec.addY || 0);
        var scale = Number(spec.scale == null ? 1 : spec.scale);
        if (!isFinite(addX)) addX = 0;
        if (!isFinite(addY)) addY = 0;
        if (!isFinite(scale) || scale <= 0) scale = 1;
        if (!anim) {
            this.setAnimationPreviewInfo('未定義アニメーション: ' + aid, true);
            this.pushAnimationPreviewLog('play failed: animation ' + aid + ' not found', true);
            return false;
        }
        var beforeLen = Array.isArray(spr._animationSprites) ? spr._animationSprites.length : 0;
        this.pushAnimationPreviewLog(
            'play req: aid=' + aid +
            ' target=' + this.animationPreviewTargetName(spec.targetId) +
            ' add=(' + Number(spec.addX || 0) + ',' + Number(spec.addY || 0) + ')' +
            ' scale=' + Number(spec.scale == null ? 1 : spec.scale)
        );
        if (proxy.requestAnimation) {
            proxy.requestAnimation(
                aid,
                addX,
                addY,
                scale
            );
        }
        if (spr.setupAnimation) {
            try { spr.setupAnimation(); } catch (_) {}
        }
        var list = Array.isArray(spr._animationSprites) ? spr._animationSprites : [];
        if (list.length <= beforeLen && spr.startAnimation) {
            try { spr.startAnimation(anim, false, 0); } catch (_) {}
            list = Array.isArray(spr._animationSprites) ? spr._animationSprites : [];
        }
        var vw = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var vh = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        for (var i = beforeLen; i < list.length; i++) {
            var a = list[i];
            if (!a) continue;
            a._eePreviewViewport = { w: vw, h: vh };
            // Preview-side hard apply so addX/addY/scale is visible
            // even when runtime hook order differs.
            a._addX = addX;
            a._addY = addY;
            a._scale = scale;
            if (a.scale) {
                a.scale.x = scale;
                a.scale.y = scale;
            }
        }
        var afterLen = list.length;
        if (afterLen <= beforeLen) {
            this.pushAnimationPreviewLog('play result: animation sprite not added', true);
        } else {
            this.pushAnimationPreviewLog('play result: sprites ' + beforeLen + ' -> ' + afterLen);
            this.pushAnimationPreviewLog(
                'play apply: add=(' + addX + ',' + addY + ') scale=' + scale +
                ' animPos=' + Number(anim && anim.position || 0)
            );
        }
        return true;
    };

    EE.prototype.requestAnimationPreviewPlayback = function(immediate) {
        if (!this.shouldShowAnimationPreviewInEditor()) return;
        var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
        if (String(spec && spec.mode || '') === 'image') {
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
            this.refreshAnimationPreviewSheet(false);
            return false;
        }
        var sig = this.animationPreviewStateSig(spec);
        if (immediate && this.isAnimationPreviewEditorActive() && this.ensureAnimationPreviewRenderer()) {
            if (this.ensureAnimationPreviewCharacter(spec.targetId)) {
                var played = this.playAnimationPreviewNow(spec, this.animPreviewProxyChar, this.animPreviewSprite);
                if (played) {
                    this.animPreviewLastAutoSig = sig;
                    this.animPreviewLoopNextAt = Date.now() + this.animationPreviewLoopIntervalMs();
                }
                this.animPreviewPendingSpec = null;
                this.animPreviewPendingSig = '';
                this.animPreviewPendingAt = 0;
                return played;
            }
        }
        if (!immediate && sig === this.animPreviewPendingSig && this.animPreviewPendingSpec) return;
        this.animPreviewPendingSpec = spec;
        this.animPreviewPendingSig = sig;
        this.animPreviewPendingAt = immediate ? 0 : (Date.now() + 120);
        return false;
    };

    EE.prototype.refreshAnimationPreviewPanel = function(forcePlay) {
        var show = this.shouldShowAnimationPreviewInEditor();
        var mode = this.editorPreviewMode();
        if (this.animPreviewWrap) this.animPreviewWrap.style.display = show ? '' : 'none';
        if (this.edSchemaWrap && this.edSchemaWrap.classList) this.edSchemaWrap.classList.toggle('with-apv', !!show);
        if (this.modalWin && this.modalWin.classList) this.modalWin.classList.toggle('with-apv', !!show);
        if (!show) {
            this.endAnimationPreviewPanDrag();
            this.closeAnimationPreviewImageOverlay();
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
            this.animPreviewLastAutoSig = '';
            this.animPreviewLoopNextAt = 0;
            this.animPreviewSheetVisible = false;
            this.animPreviewSheetLastKey = '';
            if (this.animPreviewInfo) this.animPreviewInfo.textContent = '';
            this.clearAnimationPreviewLog();
            this.clearAnimationPreviewCharacter();
            this.refreshAnimationPreviewSheet(true);
            return;
        }
        this.updateAnimationPreviewTitle();
        if (this.animPreviewViewport) this.animPreviewViewport.style.display = (mode === 'image') ? 'none' : '';
        if (this.animPreviewInfo) this.animPreviewInfo.style.display = (mode === 'image') ? 'none' : '';
        if (this.animPreviewLogView) this.animPreviewLogView.style.display = (mode === 'image') ? 'none' : '';
        if (mode === 'image') this.animPreviewSheetVisible = true;
        this.refreshAnimationPreviewSheet(true);
        if (mode === 'image') return;
        if (!this.ensureAnimationPreviewRenderer()) return;
        if (forcePlay) this.requestAnimationPreviewPlayback(true);
    };

    EE.prototype.hasActiveAnimationPreviewSprite = function(spr) {
        if (!spr || !Array.isArray(spr._animationSprites)) return false;
        var list = spr._animationSprites;
        for (var i = 0; i < list.length; i++) {
            var a = list[i];
            if (!a || a._destroyed || a.destroyed) continue;
            if (a.parent == null) continue;
            if (typeof a.isPlaying === 'function') {
                try {
                    if (a.isPlaying()) return true;
                } catch (_) {}
            }
            if (a._duration == null || Number(a._duration || 0) > 0) return true;
        }
        return false;
    };

    EE.prototype.animationPreviewLoopIntervalFrames = function() {
        return 40;
    };

    EE.prototype.animationPreviewLoopIntervalMs = function() {
        var frames = Math.max(1, Math.floor(Number(this.animationPreviewLoopIntervalFrames() || 1) || 1));
        return Math.max(1, Math.round(frames * (1000 / 60)));
    };

    EE.prototype.updateAnimationPreview = function() {
        if (!this.isAnimationPreviewEditorActive()) return;
        var spec = this.animationPreviewStateFromRaw(this.collectEditorSchemaStateRaw());
        var mode = String(spec && spec.mode || 'animation');
        if (mode === 'image') {
            this.refreshAnimationPreviewSheet(false);
            return;
        }
        if (!this.ensureAnimationPreviewRenderer()) return;
        if (!this.ensureAnimationPreviewCharacter(spec.targetId)) {
            this.setAnimationPreviewInfo('対象キャラを取得できません: ' + this.animationPreviewTargetName(spec.targetId), true);
            if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
            return;
        }
        var src = this.animPreviewSourceChar;
        var proxy = this.animPreviewProxyChar;
        var spr = this.animPreviewSprite;
        if (!src || !proxy || !spr) return;
        if (!(mode === 'frame' && proxy._frameAnimation)) {
            proxy.syncFrom(src);
        }
        var now = Date.now();
        if (this.animPreviewPendingSpec && now >= this.animPreviewPendingAt) {
            var ps = this.animPreviewPendingSpec;
            if (this.playAnimationPreviewNow(ps, proxy, spr)) {
                this.animPreviewLastAutoSig = this.animPreviewPendingSig || this.animationPreviewStateSig(ps);
                this.animPreviewLoopNextAt = now + this.animationPreviewLoopIntervalMs();
            } else {
                this.animPreviewLoopNextAt = now + 250;
            }
            this.animPreviewPendingSpec = null;
            this.animPreviewPendingSig = '';
            this.animPreviewPendingAt = 0;
        }
        if (mode === 'frame' && proxy.updateAnimation) {
            try { proxy.updateAnimation(); } catch (er2) {
                this.pushAnimationPreviewLog('frame update error: ' + String(er2 && er2.message || er2), true);
            }
        }
        this.pruneAnimationPreviewWorldChildren();
        if (this.animPreviewWorld && Array.isArray(this.animPreviewWorld.children)) {
            var children = this.animPreviewWorld.children.slice(0);
            for (var ci = 0; ci < children.length; ci++) {
                var child = children[ci];
                if (!child || child._destroyed || child.destroyed) continue;
                if (child.parent !== this.animPreviewWorld) continue;
                if (typeof Sprite_Animation !== 'undefined' && child instanceof Sprite_Animation) {
                    if (!child._animation || !child._target || child._target._destroyed || !child._target.parent) continue;
                }
                if (typeof child.update !== 'function') continue;
                try {
                    child.update();
                } catch (er) {
                    this.pushAnimationPreviewLog('child update error: ' + String(er && er.message || er), true);
                }
            }
        } else if (spr.update) {
            spr.update();
        }
        var w = Math.max(1, Math.floor(Number(this.animPreviewRendererW || 1)));
        var h = Math.max(1, Math.floor(Number(this.animPreviewRendererH || 1)));
        var sx = 0;
        var sy = 0;
        try { sx = Number(src.screenX ? src.screenX() : proxy.screenX()); } catch (_) { sx = Number(proxy.screenX ? proxy.screenX() : 0); }
        try { sy = Number(src.screenY ? src.screenY() : proxy.screenY()); } catch (_) { sy = Number(proxy.screenY ? proxy.screenY() : 0); }
        if (!isFinite(sx)) sx = 0;
        if (!isFinite(sy)) sy = 0;
        if (this.animPreviewWorld) {
            this.animPreviewWorld.position.x = Math.floor(w * 0.5 + Number(this.animPreviewPanX || 0));
            this.animPreviewWorld.position.y = Math.floor(h * 0.78 + Number(this.animPreviewPanY || 0));
            this.animPreviewWorld.pivot.x = sx;
            this.animPreviewWorld.pivot.y = sy;
        }
        var hasActive = (mode === 'frame')
            ? !!(proxy && proxy._frameAnimation)
            : this.hasActiveAnimationPreviewSprite(spr);
        if (!hasActive && !this.animPreviewPendingSpec && now >= Number(this.animPreviewLoopNextAt || 0)) {
            var currentSig = this.animationPreviewStateSig(spec);
            if (this.playAnimationPreviewNow(spec, proxy, spr)) {
                this.animPreviewLastAutoSig = currentSig;
                this.animPreviewLoopNextAt = now + this.animationPreviewLoopIntervalMs();
            } else {
                this.animPreviewLoopNextAt = now + 250;
            }
        }
        if (this.animPreviewRenderer && this.animPreviewStage) this.animPreviewRenderer.render(this.animPreviewStage);
        var msg = '';
        if (mode === 'frame') {
            msg = '対象:' + this.animationPreviewTargetName(spec.targetId) +
                ' / frame:' + String(spec.frameSpec == null ? '' : spec.frameSpec) +
                ' / wait:' + Math.max(1, Math.floor(Number(spec.wait || 6) || 6)) +
                ' / loop:' + (spec.loop ? 'ON' : 'OFF') +
                ' / pan:(' + Math.round(Number(this.animPreviewPanX || 0)) + ',' + Math.round(Number(this.animPreviewPanY || 0)) + ')';
        } else {
            var animId = Math.max(1, Math.floor(Number(spec.animationId || 1) || 1));
            var animName = ($dataAnimations && $dataAnimations[animId] && $dataAnimations[animId].name)
                ? String($dataAnimations[animId].name)
                : '';
            msg = '対象:' + this.animationPreviewTargetName(spec.targetId) +
                ' / アニメ:' + ('0000' + animId).slice(-4) + (animName ? (' ' + animName) : '') +
                ' / pan:(' + Math.round(Number(this.animPreviewPanX || 0)) + ',' + Math.round(Number(this.animPreviewPanY || 0)) + ')';
        }
        this.setAnimationPreviewInfo(msg, false);
        this.refreshAnimationPreviewSheet(false);
    };

    EE.prototype.setEditorLayout = function(mode) {
        mode = String(mode || 'generic');
        var hideGeneric = (mode === 'message101' || mode === 'switch121' || mode === 'schema');
        if (this.edGenericWrap) this.edGenericWrap.style.display = hideGeneric ? 'none' : '';
        if (this.ed101Wrap) this.ed101Wrap.style.display = (mode === 'message101') ? '' : 'none';
        if (this.ed121Wrap) this.ed121Wrap.style.display = (mode === 'switch121') ? '' : 'none';
        if (this.edSchemaWrap) this.edSchemaWrap.style.display = (mode === 'schema') ? '' : 'none';
        this.edMessageLabel.style.display = 'none';
        this.edMessageText.style.display = 'none';
        this.edCommentLabel.style.display = (mode === 'comment') ? '' : 'none';
        this.edCommentText.style.display = (mode === 'comment') ? '' : 'none';
        this.edScriptLabel.style.display = (mode === 'script') ? '' : 'none';
        this.edScriptText.style.display = (mode === 'script') ? '' : 'none';
        this.refreshAnimationPreviewPanel(false);
    };

    EE.prototype.switchMaxId = function() {
        var arr = $dataSystem && Array.isArray($dataSystem.switches) ? $dataSystem.switches : null;
        return Math.max(1, arr ? (arr.length - 1) : 1);
    };

    EE.prototype.clampSwitchId = function(v) {
        var n = Math.floor(Number(v || 1) || 1);
        var mx = this.switchMaxId();
        if (n < 1) n = 1;
        if (n > mx) n = mx;
        return n;
    };

    EE.prototype.switchNameById = function(id) {
        id = this.clampSwitchId(id);
        var arr = $dataSystem && Array.isArray($dataSystem.switches) ? $dataSystem.switches : null;
        var nm = arr && arr[id] ? String(arr[id]) : '';
        if (!nm.length) nm = '(未設定)';
        return nm;
    };

    EE.prototype.switchIdText = function(id) {
        return ('0000' + this.clampSwitchId(id)).slice(-4);
    };

    EE.prototype.ensureSwitchRangeList = function() {
        if (!this.ed121RangeList) return;
        var mx = this.switchMaxId();
        var blocks = Math.max(1, Math.ceil(mx / 20));
        this.ed121RangeList.innerHTML = '';
        for (var i = 0; i < blocks; i++) {
            var s = i * 20 + 1;
            var e = Math.min(mx, s + 19);
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = '[ ' + this.switchIdText(s) + ' - ' + this.switchIdText(e) + ' ]';
            this.ed121RangeList.appendChild(op);
        }
    };

    EE.prototype.refreshSwitchListByRange = function(rangeIdx) {
        if (!this.ed121SwitchList) return;
        var mx = this.switchMaxId();
        var r = Math.max(0, Math.floor(Number(rangeIdx || 0)));
        var start = r * 20 + 1;
        var end = Math.min(mx, start + 19);
        this.ed121SwitchList.innerHTML = '';
        for (var i = start; i <= end; i++) {
            var op = document.createElement('option');
            op.value = String(i);
            op.textContent = this.switchIdText(i) + ' ' + this.switchNameById(i);
            this.ed121SwitchList.appendChild(op);
        }
    };

    EE.prototype.selectSwitchRangeForId = function(id) {
        id = this.clampSwitchId(id);
        var r = Math.max(0, Math.floor((id - 1) / 20));
        if (this.ed121RangeList) this.ed121RangeList.value = String(r);
        this.refreshSwitchListByRange(r);
        if (this.ed121SwitchList) this.ed121SwitchList.value = String(id);
    };

    EE.prototype.syncSwitchEditorType = function() {
        if (!this.ed121From || !this.ed121To || !this.ed121Single) return;
        var single = !!this.ed121Single.checked;
        if (single) this.ed121To.value = this.ed121From.value;
        this.ed121To.disabled = single;
    };

    EE.prototype.syncSwitchFromInput = function() {
        if (!this.ed121From) return;
        var v = this.clampSwitchId(this.ed121From.value);
        this.ed121From.value = String(v);
        if (this.ed121Single && this.ed121Single.checked) this.ed121To.value = String(v);
        this.selectSwitchRangeForId(v);
    };

    EE.prototype.syncSwitchToInput = function() {
        if (!this.ed121To) return;
        var v = this.clampSwitchId(this.ed121To.value);
        this.ed121To.value = String(v);
        this.selectSwitchRangeForId(v);
    };

    EE.prototype.onSwitchListPick = function() {
        if (!this.ed121SwitchList) return;
        var id = this.clampSwitchId(this.ed121SwitchList.value);
        if (this.ed121Single && this.ed121Single.checked) {
            this.ed121From.value = String(id);
            this.ed121To.value = String(id);
            return;
        }
        if (this.ed121PickTarget === 'to') this.ed121To.value = String(id);
        else this.ed121From.value = String(id);
    };

    EE.prototype.setupSwitchEditor = function(params) {
        params = Array.isArray(params) ? params : [];
        var a = this.clampSwitchId(params[0] || 1);
        var b = this.clampSwitchId(params[1] || a);
        var op = Number(params[2] || 0) ? 1 : 0;
        this.ensureSwitchRangeList();
        this.ed121From.value = String(a);
        this.ed121To.value = String(b);
        var single = (a === b);
        this.ed121Single.checked = single;
        this.ed121Range.checked = !single;
        this.syncSwitchEditorType();
        if (op === 0) this.ed121On.checked = true; else this.ed121Off.checked = true;
        this.selectSwitchRangeForId(a);
    };

    EE.prototype.collectSwitchEditorParams = function() {
        var a = this.clampSwitchId(this.ed121From && this.ed121From.value);
        var b = this.clampSwitchId(this.ed121To && this.ed121To.value);
        var single = !!(this.ed121Single && this.ed121Single.checked);
        if (single) b = a;
        if (a > b) {
            var t = a;
            a = b;
            b = t;
        }
        var op = (this.ed121Off && this.ed121Off.checked) ? 1 : 0;
        return [a, b, op];
    };

    EE.prototype.repositionEditorWindow = function() {
        if (!this.modalWin) return;
        var w = this.modalWin;
        var vw = Math.max(320, window.innerWidth || 1280);
        var vh = Math.max(240, window.innerHeight || 720);
        w.style.maxWidth = Math.floor(vw * 0.90) + 'px';
        w.style.maxHeight = Math.floor(vh * 0.84) + 'px';
        if (this.isRouteEditorMapPickerMode && this.isRouteEditorMapPickerMode()) {
            this.applyRouteTileEditorModalMode(true);
            w.style.left = '50%';
            w.style.top = Math.floor(vh * 0.74) + 'px';
            w.style.transform = 'translate(-50%,-50%)';
            var rt = w.getBoundingClientRect();
            var padt = 8;
            var halfH = Math.max(1, Number(rt.height || 0) * 0.5);
            var minCy = padt + halfH;
            var maxCy = vh - padt - halfH;
            var cy = Math.floor(Number(w.style.top.replace('px', '')) || Math.floor(vh * 0.74));
            cy = Math.max(minCy, Math.min(maxCy, cy));
            w.style.top = Math.floor(cy) + 'px';
            this.updateRouteTileEditorModalMask();
            return;
        }
        this.applyRouteTileEditorModalMode(false);
        w.style.left = '50%';
        w.style.top = '50%';
        w.style.transform = 'translate(-50%,-50%)';
        var r = w.getBoundingClientRect();
        var pad = 8;
        if (r.left >= pad && r.top >= pad && r.right <= vw - pad && r.bottom <= vh - pad) return;
        var nx = Math.max(pad, Math.min((vw - r.width) / 2, vw - r.width - pad));
        var ny = Math.max(pad, Math.min((vh - r.height) / 2, vh - r.height - pad));
        w.style.transform = 'none';
        w.style.left = Math.floor(nx) + 'px';
        w.style.top = Math.floor(ny) + 'px';
        this.updateRouteTileEditorModalMask();
    };

    EE.prototype.openEditor = function(uid, routeListIndex) {
        this.closeRouteRangeContextMenu();
        this.closeCameraContextMenu();
        var tr = this.model.tracks[this.selKey];
        if (!tr) return;
        var e = null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === uid) { e = tr.commands[i]; break; }
        }
        if (!e) return;
        this.editUid = uid;
        this.editRouteListIndex = -1;
        this.editSchema = null;
        this.editSchemaBindings = [];
        this.edCode.readOnly = true;
        this.edIndent.disabled = false;
        this.edCommentText.value = '';
        this.edScriptText.value = '';
        this.edMessageText.value = '';
        this.ed101Text.value = '';
        if (this.edDeleteBtn) this.edDeleteBtn.style.display = '';
        this.setEditorLayout('generic');
        var useRoute = (routeListIndex != null && routeListIndex >= 0 && e.command && Number(e.command.code || 0) === 205);
        if (useRoute) {
            var route = e.command.parameters && e.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : [];
            var rIdx = Math.floor(Number(routeListIndex || 0));
            var rc = (rIdx >= 0 && rIdx < list.length) ? list[rIdx] : null;
            if (rc && Number(rc.code || 0) !== 0) {
                this.editRouteListIndex = rIdx;
                this.edHead.textContent = '移動ルート内コマンド編集';
                this.edCode.value = String(Number(rc.code || 0));
                this.edCode.readOnly = false;
                this.edIndent.value = '0';
                this.edIndent.disabled = true;
                var routeSchema = this.getRouteEditorSchemaForCommand(rc);
                if (routeSchema) {
                    this.editSchema = routeSchema;
                    var rst = routeSchema.fromRouteCommand ? routeSchema.fromRouteCommand.call(this, rc, e, rIdx) : {};
                    this.renderEditorSchema(routeSchema, rst || {});
                    if (routeSchema.routeCode != null) {
                        this.edCode.value = String(Number(routeSchema.routeCode || 0));
                        this.edCode.readOnly = true;
                    }
                    if (routeSchema.title) this.edHead.textContent = String(routeSchema.title);
                    this.setEditorLayout('schema');
                } else {
                    this.renderParamEditors((rc.parameters || []));
                    this.setEditorLayout('route');
                }
                this.modal.classList.add('on');
                this.refreshAnimationPreviewPanel(false);
                this.repositionEditorWindow();
                var self = this;
                setTimeout(function() { self.repositionEditorWindow(); }, 0);
                return;
            }
        }
        this.edHead.textContent = 'コマンド編集';
        this.edCode.value = String(e.command && e.command.code || 0);
        this.edIndent.value = String(e.command && e.command.indent || 0);
        this.renderParamEditors((e.command && e.command.parameters) || []);
        var schemaCode = (e.command && Number(e.command.code || 0) === 355)
            ? this.mainCommandDisplayCodeForEntry(e)
            : (e.command && e.command.code);
        var schema = this.getEditorSchema(schemaCode);
        schema = this.schemaWithPendingAddWaitLimit(schema, e);
        if (schema) {
            this.editSchema = schema;
            var st = schema.fromEntry ? schema.fromEntry.call(this, e) : {};
            this.renderEditorSchema(schema, st || {});
            if (schema.commandCode != null) {
                this.edCode.value = String(Number(schema.commandCode || 0));
                this.edCode.readOnly = true;
            }
            if (schema.title) this.edHead.textContent = String(schema.title);
            this.setEditorLayout('schema');
        } else if (e.command && e.command.code === 101) {
            var mlines = (e.messageLines && e.messageLines.length ? e.messageLines : []);
            this.ed101Text.value = mlines.join('\n');
            this.edHead.textContent = '文章の表示';
            this.setEditorLayout('message101');
        } else if (e.command && e.command.code === 121) {
            this.setupSwitchEditor(e.command.parameters || []);
            this.edHead.textContent = 'スイッチの操作';
            this.setEditorLayout('switch121');
        } else if (e.command && e.command.code === 108) {
            this.memoApplyParsedStateToEntry(e);
            if (e.isMemo) {
                this.openMemoEditorForEntry(e.uid);
                return;
            }
            this.edCommentText.value = (e.commentLines && e.commentLines.length ? e.commentLines : [String((e.command.parameters || [''])[0] || '')]).join('\n');
            this.edHead.textContent = '注釈';
            this.setEditorLayout('comment');
        } else if (e.command && e.command.code === 355) {
            var slines = (e.scriptLines && e.scriptLines.length)
                ? e.scriptLines
                : [String((e.command.parameters || [''])[0] || '')];
            this.edScriptText.value = slines.join('\n');
            this.edHead.textContent = 'スクリプト';
            this.setEditorLayout('script');
        } else {
            this.setEditorLayout('generic');
        }
        if (this.edDeleteBtn && this._pendingNewUid && Number(uid) === Number(this._pendingNewUid)) {
            this.edDeleteBtn.style.display = 'none';
        }
        this.modal.classList.add('on');
        this.refreshAnimationPreviewPanel(true);
        this.repositionEditorWindow();
        var self = this;
        setTimeout(function() { self.repositionEditorWindow(); }, 0);
    };

    EE.prototype.removeTrackEntryByUid = function(uid) {
        uid = Number(uid || 0);
        if (!uid) return false;
        var tr = this.model && this.model.tracks ? this.model.tracks[this.selKey] : null;
        if (!tr || !Array.isArray(tr.commands)) return false;
        for (var i = 0; i < tr.commands.length; i++) {
            if (Number(tr.commands[i].uid || 0) !== uid) continue;
            tr.commands.splice(i, 1);
            return true;
        }
        return false;
    };

    EE.prototype.closeEditor = function() {
        if (!this.modal) return;
        this.stopRouteTileEditorPicker();
        this.stopRouteJumpEditorPicker();
        var wasPending = (this._pendingNewUid && Number(this.editUid || 0) === Number(this._pendingNewUid));
        var confirmed = !!this._pendingNewConfirmed;
        this.modal.classList.remove('on');
        this.editUid = 0;
        this.editRouteListIndex = -1;
        this.editSchema = null;
        this.editSchemaBindings = [];
        this.refreshAnimationPreviewPanel(false);
        if (wasPending && !confirmed) {
            if (this.removeTrackEntryByUid(this._pendingNewUid)) {
                this.selUid = 0;
                this.selRouteListIndex = -1;
                this.rebuildSchedule();
                this.seek(this.frame);
                this.timelineDirty = true;
            }
        }
        this._pendingNewUid = 0;
        this._pendingNewConfirmed = false;
    };

    EE.prototype.applyEditor = function() {
        var tr = this.model.tracks[this.selKey];
        if (!tr || !this.editUid) return;
        var e = null;
        for (var i = 0; i < tr.commands.length; i++) {
            if (tr.commands[i].uid === this.editUid) { e = tr.commands[i]; break; }
        }
        if (!e) { this.closeEditor(); return; }
        var isPendingNew = (this._pendingNewUid && Number(e.uid || 0) === Number(this._pendingNewUid));
        var indent = Math.max(0, Math.floor(Number(this.edIndent.value || 0) || 0));
        var params = [];
        var schemaState = null;
        var use101Layout = (this.editRouteListIndex == null || this.editRouteListIndex < 0) &&
            e.command && Number(e.command.code || 0) === 101 &&
            this.ed101Wrap && this.ed101Wrap.style.display !== 'none';
        var use121Layout = (this.editRouteListIndex == null || this.editRouteListIndex < 0) &&
            e.command && Number(e.command.code || 0) === 121 &&
            this.ed121Wrap && this.ed121Wrap.style.display !== 'none';
        var useSchemaLayout = !!this.editSchema &&
            this.edSchemaWrap && this.edSchemaWrap.style.display !== 'none';
        if (use101Layout) {
            // Keep current 101 visual/position parameters as-is; this layout edits text lines only.
            params = Array.isArray(e.command.parameters) ? clone(e.command.parameters) : [];
        } else if (use121Layout) {
            params = this.collectSwitchEditorParams();
        } else if (useSchemaLayout) {
            try {
                schemaState = this.collectEditorSchemaState();
                var schemaSource = e;
                if (this.editRouteListIndex != null && this.editRouteListIndex >= 0 && e.command && Number(e.command.code || 0) === 205) {
                    var srcRoute = e.command.parameters && e.command.parameters[1];
                    var srcList = srcRoute && Array.isArray(srcRoute.list) ? srcRoute.list : null;
                    var srcIdx = Math.floor(Number(this.editRouteListIndex || 0));
                    if (srcList && srcIdx >= 0 && srcIdx < srcList.length) schemaSource = srcList[srcIdx];
                }
                if (this.editSchema && typeof this.editSchema.toParams === 'function') {
                    params = this.editSchema.toParams.call(this, schemaState, schemaSource, e);
                } else {
                    params = [];
                }
                if (!Array.isArray(params)) throw new Error('schema toParams must return array');
            } catch (er2) {
                this.err('E_EDIT_SCHEMA', er2);
                return;
            }
        } else {
            try {
                params = this.collectParamEditors();
            } catch (er) {
                this.err('E_EDIT_PARAM_PARSE', er);
                return;
            }
        }
        if (this.editRouteListIndex != null && this.editRouteListIndex >= 0) {
            if (!e.command || Number(e.command.code || 0) !== 205) { this.closeEditor(); return; }
            var route = e.command.parameters && e.command.parameters[1];
            var list = route && Array.isArray(route.list) ? route.list : null;
            var idx = Math.floor(Number(this.editRouteListIndex || 0));
            if (!list || idx < 0 || idx >= list.length || Number((list[idx] || {}).code || 0) === 0) {
                this.err('E_EDIT_ROUTE_TARGET', new Error('move route command not found'));
                return;
            }
            var newCode = Math.floor(Number(this.edCode.value || 0) || 0);
            if (newCode <= 0) {
                this.err('E_EDIT_ROUTE_CODE', new Error('route command code must be positive'));
                return;
            }
            this.pushSnap('editRouteCmd');
            var oldList = clone(list);
            var oldWait = e.wait;
            if (this.editSchema && this.editSchema.routeCode != null) {
                newCode = Math.floor(Number(this.editSchema.routeCode || newCode));
            }
            list[idx].code = newCode;
            list[idx].parameters = params;
            if (useSchemaLayout && this.editSchema && typeof this.editSchema.applyRouteCommand === 'function') {
                try {
                    this.editSchema.applyRouteCommand.call(this, list, idx, schemaState || {}, e);
                } catch (er4) {
                    this.err('E_EDIT_SCHEMA_APPLY', er4);
                    return;
                }
            }
            e.wait = this.commandWaitFrames(e.command);
            if (!this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
                route.list = oldList;
                e.wait = oldWait;
                this.err('E_EDIT_COLLISION', new Error('command overlaps with wait-range'));
                return;
            }
            this.dirty[this.selKey] = true;
            tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
            this.rebuildSchedule();
            this.seek(this.frame);
            if (isPendingNew) this._pendingNewConfirmed = true;
            this.closeEditor();
            return;
        }
        if (!isPendingNew) this.pushSnap('editCmd');
        e.command.indent = indent;
        e.command.parameters = params;
        if (useSchemaLayout && this.editSchema && typeof this.editSchema.applyEntry === 'function') {
            try {
                this.editSchema.applyEntry.call(this, e, schemaState || {});
            } catch (er3) {
                this.err('E_EDIT_SCHEMA_APPLY', er3);
                return;
            }
        }
        if (e.command.code === 101) {
            var schema101 = useSchemaLayout && this.editSchema && Number(this.editSchema.code || 0) === 101;
            var mtxt = '';
            if (schema101) mtxt = String((schemaState && schemaState.text) || '');
            else mtxt = String((use101Layout ? this.ed101Text.value : this.edMessageText.value) || '');
            var mlines = mtxt.length ? mtxt.split(/\r?\n/) : [];
            e.messageLines = mlines;
            e.wait = 0;
            e.isMessage = true;
            e.isComment = false;
            e.commentLines = null;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isScript = false;
            e.scriptLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else if (e.command.code === 108) {
            var lines = String(this.edCommentText.value || '').split(/\r?\n/);
            if (!lines.length) lines = [''];
            e.commentLines = lines;
            e.command.parameters = [lines[0]];
            e.wait = 0;
            e.isComment = true;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.isScript = false;
            e.scriptLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else if (e.command.code === 355) {
            var slines;
            if (useSchemaLayout && this.editSchema && this.editSchema.script355) {
                slines = [String((params && params.length) ? params[0] : '')];
            } else {
                var stxt = String(this.edScriptText.value || '');
                slines = stxt.length ? stxt.split(/\r?\n/) : [''];
            }
            e.scriptLines = slines;
            e.command.parameters = [String(slines[0] || '')];
            e.wait = 0;
            e.isScript = true;
            e.isComment = false;
            e.commentLines = null;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else if (e.command.code === 105) {
            if (!Array.isArray(e.scrollLines)) {
                e.scrollLines = this.linesFromText(schemaState && schemaState.text, true);
            }
            e.wait = 0;
            e.isScrollMessage = true;
            e.isComment = false;
            e.commentLines = null;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.isScript = false;
            e.scriptLines = null;
            e.rowType = 'main';
            e.rowKey = 'main';
            e.charId = null;
        } else {
            e.wait = this.commandWaitFrames(e.command);
            e.isComment = false;
            e.isMemo = false;
            e.memoSize = 'S';
            e.memoText = '';
            e.isMessage = false;
            e.messageLines = null;
            e.commentLines = null;
            e.isScript = false;
            e.scriptLines = null;
            e.isScrollMessage = false;
            e.scrollLines = null;
            if (e.command.code === 205) {
                e.rowType = 'char';
                e.charId = this.normalizeMoveTarget(Number(e.command.parameters[0] || 0));
                e.rowKey = 'char:' + e.charId;
                e.command.parameters[0] = e.charId;
            } else {
                e.rowType = 'main';
                e.charId = null;
                e.rowKey = 'main';
            }
        }
        if (!isPendingNew && !this.canPlaceEntry(tr, e, e.frame, e.rowKey, e.uid)) {
            this.err('E_EDIT_COLLISION', new Error('command overlaps with wait-range'));
            return;
        }
        if (isPendingNew) {
            if (!this.finalizePendingAddEntry(tr, e)) return;
            this.closeEditor();
            return;
        }
        this.dirty[this.selKey] = true;
        tr.commands.sort(function(a, b) { return compareEntriesByFrameWaitUid(a, b); });
        this.rebuildSchedule();
        this.playFrom(this.frame);
        this.closeEditor();
    };

    EE.prototype.bind = function() {
        var self = this;
        this.timeline.addEventListener('mousemove', function(e) {
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            self.onTimelineMove(e);
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        });
        this.timeline.addEventListener('mousedown', function(e) { self.onTimelineDown(e); });
        this.timeline.addEventListener('dblclick', function(e) { self.onTimelineDblClick(e); });
        this.timeline.addEventListener('contextmenu', function(e) { self.onTimelineContextMenu(e); });
        this.timeline.addEventListener('mouseleave', function() { self.onTimelineLeave(); });
        this.timeline.addEventListener('wheel', function(e) { self.onTimelineWheel(e); }, { passive: false });
        this.timelineWrap.addEventListener('scroll', function() { self.timelineDirty = true; });
        this._mm = function(e) {
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            if (self.updateAnimationPreviewPanDrag(self.lastPointerClientX, self.lastPointerClientY)) return;
            self.onTimelineMove(e);
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        };
        this._mu = function(e) {
            self.endAnimationPreviewPanDrag();
            self.onTimelineUp(e);
        };
        window.addEventListener('mousemove', this._mm, true);
        window.addEventListener('mouseup', this._mu, true);
        this.kd = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeAnimationPreviewImageOverlay();
                }
                return;
            }
            if (e.code === 'Space' || e.key === ' ') self.spaceDown = true;
            if (e.code === 'Space' || e.key === ' ') self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
            if (self.routeModal && self.routeModal.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeRouteCommandPanel();
                return;
            }
            if (self.charCtx && self.charCtx.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeCharContextMenu();
                return;
            }
            if (self.cameraCtx && self.cameraCtx.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeCameraContextMenu();
                return;
            }
            if (self.routeCtx && self.routeCtx.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeRouteRangeContextMenu();
                return;
            }
            if (self.waitInsertModal && self.waitInsertModal.classList.contains('on') && e.key === 'Escape') {
                e.preventDefault();
                self.closeWaitInsertDialog();
                return;
            }
            if (self.memoModal && self.memoModal.classList.contains('on')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    self.closeMemoEditor();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    self.submitMemoEditor();
                    return;
                }
                return;
            }
            if (self.addModal && self.addModal.classList.contains('on')) {
                if (e.key === 'Escape') { e.preventDefault(); self.closeAddCommandPanel(); }
                return;
            }
            if (self.modal && self.modal.classList.contains('on')) {
                if (e.key === 'Escape') { e.preventDefault(); self.closeEditor(); }
                return;
            }
            var target = e.target;
            var tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
            var isTypingTarget = !!(target && (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'));
            var key = (e.key || '').toLowerCase();
            if (!isTypingTarget && !self.play && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    var dir = (e.key === 'ArrowLeft') ? -1 : 1;
                    if (e.shiftKey) {
                        if (self.hasTimelineNudgeTarget && self.hasTimelineNudgeTarget()) {
                            self.nudgeSelectedTimelineByFrames(dir);
                            return;
                        }
                        self.seek(Math.max(0, Math.floor(Number(self.frame || 0)) + dir * 30));
                    } else {
                        self.seek(Math.max(0, Math.floor(Number(self.frame || 0)) + dir));
                    }
                    self.timelineDirty = true;
                    return;
                }
                if (key === 'delete' || key === 'backspace') {
                    if (self.hasRangeSelection && self.hasRangeSelection()) {
                        e.preventDefault();
                        self.deleteRangeSelection();
                    } else if (self.selUid) {
                        e.preventDefault();
                        self.delSel();
                    }
                    return;
                }
            }
            if (key === ' ' || e.code === 'Space') {
                if (self.controlMode) {
                    e.preventDefault();
                    var wasPlaying = !!self.play;
                    self.manualPause = !self.manualPause;
                    self.play = !self.manualPause;
                    if (!wasPlaying && self.play) self.playStartFrame = Math.max(0, Math.floor(Number(self.frame || 0)));
                    if (wasPlaying && !self.play) self.clearMessageRuntimeState();
                    self.setPlayBtn();
                    self.msg(self.play ? 'Play ON' : 'Play OFF (space)');
                }
                return;
            }
            if (e.ctrlKey && key === 'r') {
                e.preventDefault();
                if (self.play) {
                    self.seek(Math.max(0, Math.floor(Number(self.playStartFrame || 0))));
                    self.msg('play開始前フレームへ移動');
                    return;
                }
                self.setInteractionMode(self.controlMode ? 'timeline' : 'game', 'ctrl+r');
                return;
            }
            if (!e.ctrlKey) return;
            var k = key;
            if (k === 'z') { e.preventDefault(); self.undo(); }
            else if (k === 'y') { e.preventDefault(); self.redo(); }
            else if (k === 'c') { e.preventDefault(); self.copy(); }
            else if (k === 'v') { e.preventDefault(); self.paste(); }
            else if (k === 'x') { e.preventDefault(); self.cut(); }
            else if (k === 's') { e.preventDefault(); self.save(!!e.shiftKey); }
        };
        document.addEventListener('keydown', this.kd, true);
        this.ku = function(e) {
            if (e.code === 'Space' || e.key === ' ') {
                self.spaceDown = false;
                if (self.panState) self.endSpacePanDrag();
                self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
            }
        };
        document.addEventListener('keyup', this.ku, true);
        this._wb = function() {
            self.spaceDown = false;
            self.endAnimationPreviewPanDrag();
            if (self.panState) self.endSpacePanDrag();
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        };
        window.addEventListener('blur', this._wb, true);
        this._wh = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) return;
            if (self.onEditorNumberWheel(e)) return;
            self.onEditorSelectWheel(e);
        };
        document.addEventListener('wheel', this._wh, { capture: true, passive: false });
        this._md = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) return;
            self.lastPointerClientX = Number(e.clientX || 0);
            self.lastPointerClientY = Number(e.clientY || 0);
            if (self.charCtx && self.charCtx.classList && self.charCtx.classList.contains('on')) {
                var mr = self.charCtx.getBoundingClientRect();
                var inMenu = (e.clientX >= mr.left && e.clientX <= mr.right && e.clientY >= mr.top && e.clientY <= mr.bottom);
                if (!inMenu) self.closeCharContextMenu();
            }
            if (self.cameraCtx && self.cameraCtx.classList && self.cameraCtx.classList.contains('on')) {
                var cr = self.cameraCtx.getBoundingClientRect();
                var inCamMenu = (e.clientX >= cr.left && e.clientX <= cr.right && e.clientY >= cr.top && e.clientY <= cr.bottom);
                if (!inCamMenu) self.closeCameraContextMenu();
            }
            if (self.routeCtx && self.routeCtx.classList && self.routeCtx.classList.contains('on')) {
                var rr = self.routeCtx.getBoundingClientRect();
                var inRouteMenu = (e.clientX >= rr.left && e.clientX <= rr.right && e.clientY >= rr.top && e.clientY <= rr.bottom);
                if (!inRouteMenu) self.closeRouteRangeContextMenu();
            }
            if (e.button !== 0) return;
            if (self.onUi(e.clientX, e.clientY)) {
                return;
            }
            if (self.tryCenterGameFrameOnClick(e)) return;
            if (self.tryStartSpacePanOnGame(e)) return;
            self.refreshSpacePanCursor(self.lastPointerClientX, self.lastPointerClientY);
        };
        document.addEventListener('mousedown', this._md, true);
        this._cm = function(e) {
            if (!self.on) return;
            if (self.isAnimationPreviewOverlayOpen()) {
                e.preventDefault();
                e.stopPropagation();
                self.closeAnimationPreviewImageOverlay();
                return;
            }
            if (self.dragMode === 'tile') return;
            var sx = Number(e.clientX || 0);
            var sy = Number(e.clientY || 0);
            if (!self.isPointOnGameFrameBorder(sx, sy)) return;
            self.onGameFrameContextMenu(e);
        };
        document.addEventListener('contextmenu', this._cm, true);
        this.rs = function() {
            self.applyGameViewport();
            self.syncTimelineSize();
            self.resizeAnimationPreviewRenderer();
            if (self.modal && self.modal.classList.contains('on')) self.repositionEditorWindow();
            if (self.addModal && self.addModal.classList.contains('on')) self.renderAddCommandPage();
            self.timelineDirty = true;
        };
        window.addEventListener('resize', this.rs);
    };

    EE.prototype.unbind = function() {
        if (this.dragMode === 'tile') this.cancelTileMoveMode(true);
        this.stopRouteTileEditorPicker();
        this.stopRouteJumpEditorPicker();
        this.stopTimelineAutoScrollAnimation();
        this.stopGameFrameCenterAnimation();
        this.closeAnimationPreviewImageOverlay();
        this.disposeAnimationPreviewRenderer();
        if (this.kd) document.removeEventListener('keydown', this.kd, true);
        if (this.ku) document.removeEventListener('keyup', this.ku, true);
        if (this._md) document.removeEventListener('mousedown', this._md, true);
        if (this._cm) document.removeEventListener('contextmenu', this._cm, true);
        if (this.rs) window.removeEventListener('resize', this.rs);
        if (this._wb) window.removeEventListener('blur', this._wb, true);
        if (this._wh) document.removeEventListener('wheel', this._wh, true);
        if (this._mm) window.removeEventListener('mousemove', this._mm, true);
        if (this._mu) window.removeEventListener('mouseup', this._mu, true);
        this.endSpacePanDrag();
        this.spaceDown = false;
        this.refreshSpacePanCursor(this.lastPointerClientX, this.lastPointerClientY);
        this.kd = null;
        this.ku = null;
        this._md = null;
        this._cm = null;
        this.rs = null;
        this._wb = null;
        this._wh = null;
        this._mm = null;
        this._mu = null;
    };

    EE.prototype.shrink = function() {
        var sc = this.s;
        var ss = this.s && this.s._spriteset;
        if (!ss || !sc) return;
        this.savedSceneTransform = {
            sx: Number(sc.scale && sc.scale.x != null ? sc.scale.x : 1),
            sy: Number(sc.scale && sc.scale.y != null ? sc.scale.y : 1),
            x: Number(sc.x || 0),
            y: Number(sc.y || 0)
        };
        this.savedScale = { sx: ss.scale.x, sy: ss.scale.y, x: ss.x, y: ss.y };
        this.applyGameViewport();
    };

    EE.prototype.restoreShrink = function() {
        this.clearGameClipMask();
        var sc = this.s;
        var ss = this.s && this.s._spriteset;
        if (!ss || !this.savedScale) return;
        ss.scale.x = this.savedScale.sx;
        ss.scale.y = this.savedScale.sy;
        ss.x = this.savedScale.x;
        ss.y = this.savedScale.y;
        if (sc && this.savedSceneTransform) {
            sc.scale.x = this.savedSceneTransform.sx;
            sc.scale.y = this.savedSceneTransform.sy;
            sc.x = this.savedSceneTransform.x;
            sc.y = this.savedSceneTransform.y;
        }
    };

    EE.prototype.timelineTopInCanvasY = function() {
        var gh = Number(Graphics.boxHeight || Graphics.height || 624);
        var fallback = Math.max(1, Math.floor(gh * 0.5) - 4);
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        var panel = this.timelinePanel;
        if (!panel || !cr || !cr.height || !panel.getBoundingClientRect) return fallback;
        if (panel.style && panel.style.display === 'none') return fallback;
        var pr = panel.getBoundingClientRect();
        if (pr.height < 1) return fallback;
        var y = (pr.top - cr.top) * (gh / Math.max(1, cr.height));
        if (!isFinite(y)) return fallback;
        return Math.max(1, Math.min(gh, Math.floor(y)));
    };

    EE.prototype.timelineTopInScreenY = function() {
        var cv = Graphics && Graphics._canvas ? Graphics._canvas : null;
        var cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
        if (!cr || !cr.height) return Math.max(0, Math.floor((window.innerHeight || 0) * 0.5));
        var gh = Number(Graphics.boxHeight || Graphics.height || 624);
        var cy = this.timelineTopInCanvasY();
        var sy = cr.top + cy * (cr.height / Math.max(1, gh));
        if (!isFinite(sy)) return Math.max(0, Math.floor((window.innerHeight || 0) * 0.5));
        return Math.max(0, Math.floor(sy));
    };

    EE.prototype.fixedViewportRectScreen = function() {
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        var leftPad = 380;
        var rightPad = 380;
        var topPad = 0;
        var fixedH = 420;
        var x = Math.max(0, Math.floor(leftPad));
        var y = Math.max(0, Math.floor(topPad));
        var w = Math.max(1, Math.floor(ww - leftPad - rightPad));
        if (x + w > ww) {
            x = 0;
            w = ww;
        }
        var h = Math.max(1, Math.floor(fixedH));
        if (y + h > wh) {
            y = Math.max(0, Math.floor(wh - h));
            if (y + h > wh) h = Math.max(1, wh - y);
        }
        return { x: x, y: y, w: w, h: h };
    };

    EE.prototype.fixedViewportRectCanvas = function() {
        var sr = this.fixedViewportRectScreen();
        if (!sr) return null;
        var p1 = this.screenPointToCanvas(sr.x, sr.y);
        var p2 = this.screenPointToCanvas(sr.x + sr.w, sr.y + sr.h);
        if (!p1 || !p2) return null;
        var x1 = Math.min(Number(p1.x || 0), Number(p2.x || 0));
        var y1 = Math.min(Number(p1.y || 0), Number(p2.y || 0));
        var x2 = Math.max(Number(p1.x || 0), Number(p2.x || 0));
        var y2 = Math.max(Number(p1.y || 0), Number(p2.y || 0));
        return {
            x: Math.floor(x1),
            y: Math.floor(y1),
            w: Math.max(1, Math.floor(x2 - x1)),
            h: Math.max(1, Math.floor(y2 - y1))
        };
    };

    EE.prototype.isPointInFixedViewportRect = function(x, y) {
        var r = this.fixedViewportRectScreen();
        if (!r) return false;
        x = Number(x || 0);
        y = Number(y || 0);
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };

    EE.prototype.updateGameViewportGuards = function() {
        var gs = this.gameViewportGuards;
        if (!gs) return;
        var r = this.fixedViewportRectScreen();
        var ww = Math.max(1, Math.floor(window.innerWidth || 1));
        var wh = Math.max(1, Math.floor(window.innerHeight || 1));
        if (!r) {
            var all = [gs.top, gs.left, gs.right, gs.bottom];
            for (var i = 0; i < all.length; i++) if (all[i]) all[i].style.display = 'none';
            return;
        }
        var topH = Math.max(0, r.y);
        var leftW = Math.max(0, r.x);
        var rightX = Math.max(0, Math.floor(r.x + r.w));
        var rightW = Math.max(0, ww - rightX);
        var bottomY = Math.max(0, Math.floor(r.y + r.h));
        var bottomH = Math.max(0, wh - bottomY);
        if (gs.top) {
            gs.top.style.display = topH > 0 ? 'block' : 'none';
            gs.top.style.left = '0px';
            gs.top.style.top = '0px';
            gs.top.style.width = ww + 'px';
            gs.top.style.height = topH + 'px';
        }
        if (gs.left) {
            gs.left.style.display = leftW > 0 ? 'block' : 'none';
            gs.left.style.left = '0px';
            gs.left.style.top = r.y + 'px';
            gs.left.style.width = leftW + 'px';
            gs.left.style.height = Math.max(0, Math.floor(r.h)) + 'px';
        }
        if (gs.right) {
            gs.right.style.display = rightW > 0 ? 'block' : 'none';
            gs.right.style.left = rightX + 'px';
            gs.right.style.top = r.y + 'px';
            gs.right.style.width = rightW + 'px';
            gs.right.style.height = Math.max(0, Math.floor(r.h)) + 'px';
        }
        if (gs.bottom) {
            gs.bottom.style.display = bottomH > 0 ? 'block' : 'none';
            gs.bottom.style.left = '0px';
            gs.bottom.style.top = bottomY + 'px';
            gs.bottom.style.width = ww + 'px';
            gs.bottom.style.height = bottomH + 'px';
        }
    };

    EE.prototype.updateGameBottomMask = function() {
        var bm = this.gameBottomMask;
        if (!bm) return;
        bm.style.display = 'none';
    };

    EE.prototype.ensureEditorDisplayState = function() {
        if (!$gameMap) return;
        var gx = Number($gameMap._displayX == null ? 0 : $gameMap._displayX);
        var gy = Number($gameMap._displayY == null ? 0 : $gameMap._displayY);
        if (this.editorDisplayX == null || this.editorDisplayY == null) {
            this.editorDisplayX = gx;
            this.editorDisplayY = gy;
        }
        if (this.editorBaseDisplayX == null || this.editorBaseDisplayY == null) {
            this.editorBaseDisplayX = gx;
            this.editorBaseDisplayY = gy;
        }
    };

    EE.prototype.applyEditorDisplayState = function() {
        if (this.controlMode) return;
        if (!$gameMap || !$gameMap.setDisplayPos) return;
        this.ensureEditorDisplayState();
        $gameMap.setDisplayPos(Number(this.editorDisplayX || 0), Number(this.editorDisplayY || 0));
        this.editorDisplayX = Number($gameMap._displayX == null ? this.editorDisplayX : $gameMap._displayX);
        this.editorDisplayY = Number($gameMap._displayY == null ? this.editorDisplayY : $gameMap._displayY);
    };

    EE.prototype.updateOverlayClipMask = function() {
        var ov = this.charOverlayLayer;
        if (!ov) return;
        var vr = this.fixedViewportRectScreen();
        ov.style.top = '0px';
        ov.style.left = '0px';
        ov.style.right = '0px';
        ov.style.bottom = '0px';
        ov.style.height = '';
        ov.style.overflow = 'hidden';
        if (!vr || !isFinite(vr.x) || !isFinite(vr.y) || !isFinite(vr.w) || !isFinite(vr.h)) {
            ov.style.clipPath = '';
