# EventEditor仕様書

## 1. 文書情報
- 対象プラグイン: `KNH_ZXC_EventEditor`（`v0.1.0`）
- タイムライン拡張: `KNH_ZXC_EventEditor_Timeline`（分割モジュール構成 `v0.2`）
- 対象環境: RPG Maker MV Playtest（NW.js/Node利用可能環境）

## 2. 概要
EventEditorは、`Scene_Map`上でイベントコマンドをタイムラインとして可視化・編集・再生するデバッグ向けエディタである。  
通常のイベントリスト（`$dataMap.events[...].pages[...].list`）を内部タイムラインモデルに変換し、編集結果を逆変換して保存する。

## 3. 起動条件とライフサイクル

### 3.1 起動条件
- Playtest実行中であること。
- `_debug.get('editEventMode') === true` であること。
- 初期起動時に `_debug.get('startModeTestSave')` が設定されていること。
- `TestReload` API (`_loadContentsFromTestFile`, `_startInterpreterGate`) と `Scene_TestReload` が存在すること。

### 3.2 起動シーケンス
1. `Scene_Boot.start`で有効化判定を行う。
2. `Scene_Map.start`で未初期化の場合、テストセーブ読み込みを実施する。
3. 読み込み完了後、`new EE(scene).start()` でUIを構築する。

### 3.3 終了シーケンス
- `Scene_Map.terminate`で`EE.stop()`を呼び、UI・イベントハンドラ・音声再生を解除し、画面縮小状態を復元する。

## 4. モジュール構成
- `js/plugins/KNH_ZXC_EventEditor.js`: 本体、保存、Scene/入力フック、基礎シミュレーション。
- `js/plugins/eventEditor/KNH_ZXC_EventEditor_Timeline.js`: 分割ローダー。
- 分割モジュール:
  - `..._Core.js`: UI骨格、コマンドカタログ、ルート編集基盤。
  - `..._Schema.js`: コマンド別編集スキーマ、メッセージ拡張設定。
  - `..._Preview.js`: エディタモーダル、入力バインド、アニメーションプレビュー。
  - `..._Render.js`: 描画、トラック生成、配置判定、コンテキストメニュー。
  - `..._Input.js`: タイムライン操作（ドラッグ、範囲選択、ホイール、保存拡張）。

## 5. UI仕様

### 5.1 画面レイアウト
- 左パネル: キャラ＆イベント一覧。
- 左中央パネル: 選択キャラ情報。
- 右パネル: 選択イベント情報、実行ログ。
- 下部パネル: タイムライン（キャンバス）。
- オーバーレイ: キャラ枠、ゲーム表示枠、ツールチップ、状態表示。

### 5.2 コンテキストメニュー
- キャラメニュー: コマンド追加、タイル移動、瞬間移動。
- カメラメニュー: カメラ移動、カメラ移動（直接指定）。
- ルート/選択メニュー: コマンド追加（前/後）、メモ、コピー/切り取り/貼り付け、ウェイト挿入、詰める、移動ルート結合。

### 5.3 モーダル
- コマンド編集モーダル
- コマンド追加モーダル（3ページ）
- ウェイト挿入モーダル
- メモ編集モーダル
- ルートコマンド選択モーダル

## 6. 操作仕様

### 6.1 キーボードショートカット
- `Ctrl+S`: マップ保存 + バックアップ + diff出力
- `Ctrl+Shift+S`: バックアップのみ
- `Ctrl+Z / Ctrl+Y`: Undo / Redo
- `Ctrl+C / Ctrl+X / Ctrl+V`: コピー / 切り取り / 貼り付け
- `Ctrl+R`: 編集モード/ゲーム制御モード切替（再生中は再生開始フレームへ戻る）
- `Space`: ゲーム制御モード時のみ再生ON/OFF
- `← / →`: フレーム移動（`Shift`併用で±30f）
- `Delete / Backspace`: 選択コマンドまたは範囲削除
- `Esc`: 開いているモーダル/メニューを閉じる

### 6.2 タイムライン操作
- ダブルクリック:
  - ノード上: コマンド編集を開く
  - 空白(メイン行): コマンド追加モーダル
  - 空白(キャラ行): ルートコマンドモーダル
- 右クリック: 文脈に応じてコンテキストメニュー表示
- ドラッグ:
  - ノード移動（フレーム/行）
  - ルート範囲伸縮（左右ハンドル）
  - 範囲選択・範囲移動
- ホイール:
  - ルーラー上 or `Ctrl+Wheel`: ズーム
  - 通常: スクロール

## 7. データモデル仕様

### 7.1 モデル構造
- `model = { nextUid, tracks }`
- `tracks[key]` (`key = "<eventId>:<pageIndex>"`)
  - `eventId`, `pageIndex`
  - `commands[]`（タイムラインエントリ）
  - `extraCharRows[]`, `tempCharRows[]`
  - `endFrame`

### 7.2 エントリ構造（主要）
- `uid`, `frame`, `eventId`, `pageIndex`
- `command` (`code`, `indent`, `parameters`)
- `wait`
- `rowType` (`main` / `char`)
- `rowKey` (`main` / `char:<id>`)
- `charId`
- 拡張フラグ:
  - `isComment`, `commentLines`
  - `isMemo`, `memoSize`, `memoText`
  - `isMessage`, `messageLines`, `messageExt`
  - `isScrollMessage`, `scrollLines`
  - `isScript`, `scriptLines`

### 7.3 行ID
- `char:-1`: Player
- `char:0`: This Event
- `char:n (>0)`: Event n

## 8. 変換仕様（イベントリスト ↔ タイムライン）

### 8.1 読み込み時（`ensureTrack`）
- `230`（ウェイト）はフレーム進行に吸収し、単独エントリ化しない。
- 連結展開:
  - `108 + 408*`（注釈）
  - `101 + 401*`（文章）
  - `355 + 655*`（スクリプト）
  - `105 + 405*`（スクロール文章）
- `205`（移動ルート）は`rowType=char`として扱う。
- 末尾の累積フレームを`track.endFrame`として保持する。

### 8.2 書き戻し時（`listFromTrack`）
- タイムライン間隔を`230`で補間する。
- `205`は`505`展開を再生成する。
- `101`は`messageExt`差分から前置コマンドを再生成する。
- `212`は内部的に`355`スクリプト（`requestAnimation(...)`）へ変換出力される。
- `endFrame`が最終コマンドより後ろの場合、末尾に`230`を追加し、最後に`code:0`を付与する。

## 9. 配置判定・整合性ルール
- 同一`rowKey`上で待機区間が重なる配置は禁止。
- `main`行は、`wait=true`な移動ルート実行中区間（開始フレームを除く）へ配置不可。
- `char`行の`wait=true`移動ルートは、主行コマンド実行区間と衝突不可。
- `char`行の`wait=false`移動ルート同士は、同一キャラ上で実行区間重複不可。
- 行型制約:
  - `main`コマンドを`char`行へ貼り付け不可
  - `char`コマンドを`main`行へ貼り付け不可

## 10. 編集機能仕様
- Undo/Redoはスナップショット方式（履歴上限80）。
- 同フレーム非待機コマンドは順序入替可能（UIDスワップ）。
- クリップボード形式:
  - `timeline_entries_v1`
  - 同一選択で`main`行と`char`行の混在コピー不可
  - `char`行コピーは同一キャラ行のみ許可

## 11. 再生・実行仕様
- 再生中はフレームごとにスケジュール実行し、`205`は同フレーム内で最後に評価。
- 再生フレームは選択トラック`endFrame`を超えないようクランプされる。
- オーディオ（BGM/BGS/ME/SE）はシミュレーション状態を保持し、シーク時に再構築する。
- 実行ログとタイムライン上の実行パルスを更新する。

## 12. 保存・出力仕様

### 12.1 バックアップ
- 出力先: `data/_backup/`
- 形式: `MapNNN.YYYYMMDD_HHMMSS.json`
- `Ctrl+Shift+S`はバックアップのみ。

### 12.2 本保存
- 出力先:
  - マップ本体: `data/MapNNN.json`
  - 差分: `data/_event_editor/MapNNN.eventdiff.json`
- `dirty`トラックのみを書き戻し対象とする。

### 12.3 eventdiffフォーマット
- ルート: `plugin`, `version`, `mapId`, `savedAt`, `tracks[]`
- `tracks[i]`: `eventId`, `pageIndex`, `list`, `timeline`

### 12.4 タイムライン表示状態保存
- 出力先: `data/_event_editor/MapNNN.timelineView.json`
- キー: `"<eventId>:<pageIndex>"`
- 値: `pxPerFrame`, `scrollLeft`, `scrollTop`
- 通常保存時のみ永続化（バックアップのみ保存では書かない）。

## 13. エラー/フェイルセーフ仕様
- 致命エラー時は`Graphics.printError`表示、`SceneManager.stop()`、全音声停止。
- 主な致命例:
  - テストセーブ名未設定
  - `TestReload` API不足
  - `Scene_TestReload`欠落
  - テストセーブ読込失敗
- 保存時にNode API不在なら`E_NO_NODE`、保存失敗は`E_SAVE_FAILED`。

## 14. 既知制約
- キャンバス幅に実装上限（`16384px`）があるため、必要に応じて自動ズーム縮小する。
- 本機能はPlaytest専用で、実行時にNodeモジュール（`fs`, `path`）へ依存する。
- `plugins.js`上の明示プラグイン登録は`KNH_ZXC_EventEditor`のみでよく、タイムライン拡張は自動ロードされる。
