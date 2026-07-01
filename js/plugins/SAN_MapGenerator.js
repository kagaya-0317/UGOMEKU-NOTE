//=============================================================================
// SAN_MapGenerator.js
//=============================================================================
// Copyright (c) 2015-2017 Sanshiro
// Released under the MIT license
// http://opensource.org/licenses/mit-license.php
//=============================================================================

/*:
 * @plugindesc 自動マップ生成 ver1.1.8
 * 自動的にマップを生成しイベントを配置します。
 * @author サンシロ https://twitter.com/rev2nym
 * @version 1.1.8 2017/02/24 FillRoomで生成される部屋を大部屋と一致させるよう変更。
 * 1.1.7 2017/02/19 分割可能判定の不具合を修正。
 * 1.16 2016/09/21 部屋生成の処理を修正。入口イベントの不具合を修正。壁生成と大部屋のスクリプトコマンドを追加。
 * 1.15 2016/09/13 壁生成判定の不具合を修正。ツルハシとバクダンのスクリプトコマンドを追加。
 * 1.14 2016/09/12 座標による部屋取得機能の不具合を修正。イベントのプレイヤーと同部屋判定を追加。
 * 1.12 2016/09/08 壁生成判定の不具合を修正。オートタイル以外のタイルの使用に対応。
 * 1.11 2016/04/05 稀に壁をすり抜ける不具合を修正、通行判定機能を強化。
 * 1.10 2016/03/19 壁の高さ、部屋の大きさ、外壁表示を指定するプラグインパラメータを追加、 壁を表示するスペースを確保するよう部屋と通路の生成規則を変更。
 * 1.00a 2015/12/19 ヘルプ文書のイベントメモ欄設定の誤りを修正。
 * 1.00 2015/11/29 公開
 * 
 * @param WallHight
 * @desc 壁の高さを指定します。（1～3）
 * @default 1
 * 
 * @param MinRoomSize
 * @desc 部屋の大きさの最小値を指定します。（3～）
 * @default 5
 * 
 * @param MaxRoomSize
 * @desc 部屋の大きさの最大値を指定します。（3～）
 * MaxRoomSizeがMinRoomSizeより小さい場合、MinRoomSizeと同じ値に補正されます。
 * @default 10
 * 
 * @param ShowOuterWall
 * @desc 部屋の外側の壁を表示します。（ONで有効）
 * @default ON
 * 
 * @help
 * ■概要
 * マップ生成プラグインコマンドを実行するとマップが自動生成され
 * プレイヤーが入口イベントの地点に移動します。
 * 
 * ■設定
 * ツクールMVのエディタ上でベースとなるマップの下記の座標に
 * タイルとイベントを配置して下さい。
 * 
 * ・タイル
 *  空白:{x:0, y:0}
 *  部屋:{x:0, y:1}
 *  通路:{x:0, y:2}
 *  天井:{x:0, y:3}
 *  壁  :{x:0, y:4}
 *  瓦礫:{x:0, y:5}
 * 
 * ・イベント
 *  入口:{x:1, y:0}
 *  出口:{x:1, y:1}
 *  他  :上記以外の座標
 * 
 * ・イベント出現率
 * 入口と出口以外のイベントには出現率を設定できます。
 * イベントのメモ欄に下記を記載して下さい。
 * 出現率設定がないイベント生成されません。
 * 
 *  マップ毎の出現率:<RateMap: [1.0以下の正の小数]>
 *  部屋毎の出現率  :<RateRoom:[1.0以下の正の小数]>
 * 
 * ■プラグインコマンド
 * ・MapGenerator RoomAndPass
 *  部屋と通路から構成されるマップを生成します。
 * 
 * ・MapGenerator FillRoom
 *  マップ全体に及ぶ一つの部屋を生成します。
 * 
 * ■スクリプトコマンド
 * ・Game_Character.prototype.isSameRoomWithPlayer()
 *  キャラクターのプレイヤーとの同部屋判定です。
 *  例：条件分岐イベントコマンドのスクリプト欄に
 *      「this.character().isSameRoomWithPlayer()」
 *      と記述するとそのイベントがプレイヤーと同じ部屋に
 *      存在するか判定します。
 * 
 * ・Game_Map.prototype.pickel()
 *  ツルハシコマンドです。
 *  プレイヤーの正面の非地面タイルを通路タイルに変換します。
 *  このコマンドは自動生成マップ内のみ有効です。
 *  例：コモンイベントのスクリプトコマンドに
 *     「$gameMap.pickel()」
 *      と記述して実行すると正面の壁を掘ることができます。
 * 
 * ・Game_Map.prototype.bomb(x, y)
 *  バクダンコマンドです。
 *  指定した座標と周囲の9タイルの非地面タイルを通路タイルに変換します。
 *  このコマンドは自動生成マップ内のみ有効です。
 *  例：コモンイベントのスクリプトコマンドに
 *      「$gameMap.bomb($gamePlayer.x, $gamePlayer.y)」
 *      と記述して実行するとプレイヤーの周囲の壁を取り除くことができます。
 * 
 * ・Game_Map.prototype.makeWall(x, y)
 *  壁生成コマンドです。
 *  指定した座標の地面タイルを壁(瓦礫)タイルに変換します。
 *  このコマンドは自動生成マップ内のみ有効です。
 *  例：コモンイベントのスクリプトコマンドに
 *      「var x = $gamePlayer.x;
 *        var y = $gamePlayer.y;
 *        var d = $gamePlayer.direction();
 *        $gameMap.makeWall(
 *            $gameMap.xWithDirection(x, d),
 *            $gameMap.yWithDirection(y, d)
 *        );」
 *      と記述して実行するとプレイヤーの正面に壁を設置することができます。
 * 
 * ・Game_Map.prototype.bigRoom()
 *  大部屋コマンドです。
 *  マップ全体に及ぶ一つの部屋を生成します。
 *  このコマンドは自動生成マップ内のみ有効です。
 *  例：コモンイベントのスクリプトコマンドに
 *     「$gameMap.bigRoom()」
 *      と記述して実行すると大部屋を生成します。
 * 
 * ■利用規約
 * MITライセンスのもと、商用利用、改変、再配布が可能です。
 * ただし冒頭のコメントは削除や改変をしないでください。
 * よかったらクレジットに作者名を記載してください。
 * 
 * これを利用したことによるいかなる損害にも作者は責任を負いません。
 * サポートは期待しないでください＞＜。
 * 
 */

var Imported = Imported || {};
Imported.SAN_MapGenerator = true;

var Sanshiro = Sanshiro || {};
Sanshiro.Game_MapGenerator = Sanshiro.Game_MapGenerator || {};

var HKsp = 7;

//-----------------------------------------------------------------------------
// Game_MapGenerator
//
// マップジェネレーター（大部屋）

function Game_MapGenerator() {
    this.initialize();
}

// オートタイル解析タイルidリスト
//   tileIdsFloor : 床
//   tileIdsWall  : 壁
//   candidate    : 候補タイル ID 
//   connect      : 接続タイル ID
//   noConnect    : 非接続タイル ID
Game_MapGenerator.tileIdsFloor = {};

Game_MapGenerator.tileIdsFloor.candidate =
    [ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11,
     12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
     24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
     36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];

Game_MapGenerator.tileIdsFloor.connect = {
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

Game_MapGenerator.tileIdsFloor.noConnect = {
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

Game_MapGenerator.tileIdsWall = {};

Game_MapGenerator.tileIdsWall.candidate =
    [ 0,  1,  2,  3,  4,  5,  6,  7,
      8,  9, 10, 11, 12, 13, 14, 15];

Game_MapGenerator.tileIdsWall.connect = {
    2:[ 0,  1,  2,  3,  4,  5,  6,  7],  // 2:下
    4:[ 0,  2,  4,  6,  8, 10, 12, 14],  // 4:左
    6:[ 0,  1,  2,  3,  8,  9, 10, 11],  // 6:右
    8:[ 0,  1,  4,  5,  8,  9, 12, 13]   // 8:上
};

Game_MapGenerator.tileIdsWall.noConnect = {
    2:[ 8,  9, 10, 11, 12, 13, 14, 15],  // 2:下
    4:[ 1,  3,  5,  7,  9, 11, 13, 15],  // 4:左
    6:[ 4,  5,  6,  7, 12, 13, 14, 15],  // 6:右
    8:[ 2,  3,  6,  7, 10, 11, 14, 15]   // 8:上
};

// 初期化
Game_MapGenerator.prototype.initialize = function() {
    this._wallHeight = Number(PluginManager.parameters('SAN_MapGenerator')['WallHight']);
    this._showOuterWall = (PluginManager.parameters('SAN_MapGenerator')['ShowOuterWall'] === 'ON');
    this._startXY = {x:0, y:0};
    this._goalXY  = {x:0, y:0};
    this._blocks  = [];
    this._rooms   = [];
    this._passes  = [];
    this._data    = [];
    this._isReady = false;
};

// マップ生成
Game_MapGenerator.prototype.setup = function() {
    $gameMap._events = [undefined];
    for (key in $gameSelfSwitches._data) {
        if (key.split(",")[0] === String($gameMap.mapId())) {
            delete $gameSelfSwitches._data[key];
        }
    }
    this._isReady = false;
    this._blocks  = [];
    this._rooms   = [];
    this._passes  = [];
    this._startXY = {x:0, y:0};
    this._goalXY  = {x:0, y:0};
    this._data    = [];
    this.initSymbolTable();
    this.initSymbolMap();
    this.generateMap();
    this.refreshWallAndRoof();
    this.refreshDisturb();
    this.makeData();
    this.setStart();
    this.setGoal();
    this.setRateEvents();
    SceneManager._scene.createDisplayObjects();
    this._isReady = true;
};

// シンボル定義表の初期化
Game_MapGenerator.prototype.initSymbolTable = function() {
    // シンボル定義
    //  refXY      : シンボルに対応するタイルのツクールのマップ上の座標
    //  baseTileId : シンボルに対応するタイル ID 
    //  dispChar   : 生成したマップを文字列として表示する際の文字 
    
    var n = (Number($dataMap.meta.tilePattern) || 1);
    if ($gameSystem.HK()._nextIsMonsterFloor) n = n - 1;
    else n = Math.randomInt(n - 1);
    this._DPattern = n;
    var canPass = ['room', 'pass', 'ps1', 'ps2', 'ps3', 'ps4', 'rm1', 'rm2', 'rm3', 'rm4'];
    
    this._symbolTable = {
        player: {refXY:{x:n, y:0}, baseTileId:[], dispChar:'＠', passable:canPass},
        space:  {refXY:{x:n, y:0}, baseTileId:[], dispChar:'　', passable:['space']},
        room:   {refXY:{x:n, y:1}, baseTileId:[], dispChar:'□', passable:canPass},
        pass:   {refXY:{x:n, y:2}, baseTileId:[], dispChar:'■', passable:canPass},
        roof:   {refXY:{x:n, y:3}, baseTileId:[], dispChar:'＃', passable:['roof']},
        wall:   {refXY:{x:n, y:4}, baseTileId:[], dispChar:'＝', passable:[]},
        rubble: {refXY:{x:n, y:5}, baseTileId:[], dispChar:'＊', passable:[]}, 
        start:  {refXY:{x:1, y:0}, baseTileId:[], dispChar:'△', passable:canPass},
        goal:   {refXY:{x:2, y:0}, baseTileId:[], dispChar:'▽', passable:canPass},
        
        ps1:     {refXY:{x:n, y:6}, baseTileId:[], dispChar:'■', passable:canPass},
        ps2:     {refXY:{x:n, y:7}, baseTileId:[], dispChar:'■', passable:canPass},
        ps3:     {refXY:{x:n, y:8}, baseTileId:[], dispChar:'■', passable:canPass},
        ps4:     {refXY:{x:n, y:9}, baseTileId:[], dispChar:'■', passable:canPass},
        rm1:     {refXY:{x:n, y:6}, baseTileId:[], dispChar:'■', passable:canPass},
        rm2:     {refXY:{x:n, y:7}, baseTileId:[], dispChar:'■', passable:canPass},
        rm3:     {refXY:{x:n, y:8}, baseTileId:[], dispChar:'■', passable:canPass},
        rm4:     {refXY:{x:n, y:9}, baseTileId:[], dispChar:'■', passable:canPass},
        rf1:     {refXY:{x:n, y:10}, baseTileId:[], dispChar:'＃', passable:['roof']},
        rf2:     {refXY:{x:n, y:11}, baseTileId:[], dispChar:'＃', passable:['roof']},
        rf3:     {refXY:{x:n, y:12}, baseTileId:[], dispChar:'＃', passable:['roof']},
        rf4:     {refXY:{x:n, y:13}, baseTileId:[], dispChar:'＃', passable:['roof']}
    //  fence:  {refXY:{x:0, y:6}, baseTileId:[], dispChar:'只'},
    //  pond:   {refXY:{x:0, y:7}, baseTileId:[], dispChar:'○'},
    //  hole:   {refXY:{x:0, y:8}, baseTileId:[], dispChar:'●'},
    //  brink:  {refXY:{x:0, y:9}, baseTileId:[], dispChar:'＾'},
    //  enemy:  {refXY:{x:1, y:2}, baseTileId:[], dispChar:'＄'},
    //  crawler:{refXY:{x:0, y:1}, baseTileId:[], dispChar:'＆'}
    };
    for (symbol in this._symbolTable) {
        var x = this._symbolTable[symbol].refXY.x;
        var y = this._symbolTable[symbol].refXY.y;
        for (var z = 0; z < 6; z ++) {
            // z0:タイルA下層, z1:タイルA上層, z2:タイルB下層, z3:タイルB上層, z4:影, z5:リージョン
            this._symbolTable[symbol].baseTileId[z] = this.baseAutoTileId(x, y, z);
        }
    }
};

// オートタイルタイルの基点タイルID 
Game_MapGenerator.prototype.baseAutoTileId = function(x, y, z) {
    if ($gameMap.tileId(x, y, z) >= Tilemap.TILE_ID_A1) {
        return (Math.floor(($gameMap.tileId(x, y, z) - Tilemap.TILE_ID_A1) / 48)) * 48 + Tilemap.TILE_ID_A1;
    } else {
        return $gameMap.tileId(x, y, z);
    }
};

// シンボルで表現されるマップの初期化（初期化時はスペースで埋める）
Game_MapGenerator.prototype.initSymbolMap = function() {
    this._symbolMap = new Array($gameMap.width());
    for (var x = 0; x < $gameMap.width(); x++) {
        this._symbolMap[x] = new Array($gameMap.height());
        for (var y = 0; y < $gameMap.height(); y++) {
            this._symbolMap[x][y] = 'space';
        }
    }
};

// シンボルによる通行可能判定
Game_MapGenerator.prototype.isPassable = function(x, y, d) {
    var x2 = $gameMap.roundXWithDirection(x, d);
    var y2 = $gameMap.roundYWithDirection(y, d);
    if (!this._symbolMap[x]  || !this._symbolMap[x][y] ||
        !this._symbolMap[x2] || !this._symbolMap[x2][y2]) {
        return false;
    }
    var symbol  = this._symbolMap[x][y];
    var symbol2 = this._symbolMap[x2][y2];
    return this._symbolTable[symbol].passable.contains(symbol2);
};

// シンボルによる地面判定
Game_MapGenerator.prototype.isGround = function(x, y) {
    if (!this._symbolMap[x] || !this._symbolMap[x][y]) {
        return false;
    }
    return ['room', 'pass', 'start', 'goal', 'ps1', 'ps2', 'ps3', 'ps4'].indexOf(this._symbolMap[x][y]) !== -1;
};

// シンボルによる壁判定
Game_MapGenerator.prototype.isWall = function(x, y) {
    if (!this._symbolMap[x] || !this._symbolMap[x][y]) {
        return false;
    }
    return this._symbolMap[x][y] === 'wall';
};

//blockデータを作成
Game_MapGenerator.prototype.newBlock = function(x, y, w, h) {
    return {
        x : HKsp,
        y : HKsp,
        w : $dataMap.width - HKsp * 2 - 1,
        h : $dataMap.height - HKsp * 2
    };
};
//roomデータを作成
Game_MapGenerator.prototype.newRoom = function(x, y, w, h) {
    return {
        x           : x,
        y           : y,
        w           : w,
        h           : h,
        hasPass     : {t:false, b:false, l:false, r:false},
        passXy      : {t:null, b:null, l:null, r:null},
        connectRoom : {t:null, b:null, l:null, r:null}
    };
};

// シンボルマップ生成
Game_MapGenerator.prototype.generateMap = function() {
    var block = this.newBlock();
    var room = this.newRoom(block.x, block.y + this._wallHeight,
                            block.w, block.h - this._wallHeight * 2);
    this._blocks = [block];
    this._rooms  = [room];
    this._passes = [];
    this.initSymbolMap();
    for (var y = 0; y < room.h; y++) {
        for (var x = 0 ; x < room.w; x++) {
            this._symbolMap[room.x + x][room.y + y] = 'room';
        }
    }
};

// イベントの設置
Game_MapGenerator.prototype.setEvent = function(event, targetSymbols, targetArea) {
    var startOrGoal = !!this._setEventStartOrGoal;
    this._setEventStartOrGoal = false;
    
    targetSymbols = targetSymbols || ['room'];
    targetArea = targetArea || {x:0, y:0, w:$dataMap.width, h:$dataMap.height};
    var canSet = false;
    for (var x = targetArea.x; x < targetArea.x + targetArea.w && !canSet; x++) {
        for (var y = targetArea.y; y < targetArea.y + targetArea.h && !canSet; y ++) {
            canSet = (targetSymbols.indexOf(this._symbolMap[x][y]) !== -1);
        }
    }
    if (canSet) {
        for (var i = 0; i < Math.pow(targetArea.w * targetArea.h, 2); i++) {
            var x = targetArea.x + Math.randomInt(targetArea.w);
            var y = targetArea.y + Math.randomInt(targetArea.h);
            if ($gameMap.eventsXy(x, y).length === 0 &&
                targetSymbols.indexOf(this._symbolMap[x][y]) !== -1 &&
                (!startOrGoal || !this.isAdjacenting(x, y, 'pass', true)) &&
                (!startOrGoal || this.isAdjacenting(x, y, 'roof', true) < 2))
            {
                break;
            }
        }
        event.setPosition(x, y);
        return {x:x, y:y}
    } else {
        return undefined;
    }
};

// 座標によるイベントデータの配列
Game_MapGenerator.prototype.dataMapEventsXy = function(x, y) {
    return $dataMap.events.filter(function(event) {
        return (!!event && event.x === x && event.y === y);
    }, this);
};

// スタート地点イベントの設置
Game_MapGenerator.prototype.setStart = function() {
    var refXY = this._symbolTable['start'].refXY;
    var id = this.dataMapEventsXy(refXY.x, refXY.y)[0].id;
    var event = new Game_Event($gameMap.mapId(), id);
    $gameMap._events[id] = event;
    this._setEventStartOrGoal = true;
    this._startXY = this.setEvent(event);
    $gamePlayer.locate(this._startXY.x, this._startXY.y);
    $gamePlayer.reserveTransfer($gameMap.mapId(), this._startXY.x, this._startXY.y);
    $gameMap._interpreter.setWaitMode('transfer')
};

// ゴール地点イベントの設置
Game_MapGenerator.prototype.setGoal = function() {
    var refXY = this._symbolTable['goal'].refXY;
    var id = this.dataMapEventsXy(refXY.x, refXY.y)[0].id;
    var event = new Game_Event($gameMap.mapId(), id);
    $gameMap._events[id] = event;
    this._setEventStartOrGoal = true;
    this._goalXY = this.setEvent(event);
};

// 確率イベントの設置
Game_MapGenerator.prototype.setRateEvents = function() {
    var events = $dataMap.events;
    var mapDataRateMapEvents = events.filter(function(event) {
        return !!event && !!event.meta.RateMap;
    });
    mapDataRateMapEvents.forEach(function(mapDataEvent) {
        if (!mapDataEvent) return;
        if (this.randBool(parseFloat(mapDataEvent.meta.RateMap))) {
            for (var i = 1; $dataMap.events[i] || $gameMap._events[i]; i++) continue;
            var event = new Game_Event($gameMap.mapId(), mapDataEvent.id);
            event._eventId = i;
            $gameMap._events[i] = event;
            this.setEvent(event);
        }
    }, this);
    var mapDataRateRoomEvents = events.filter(function(event) {
        return !!event && !!event.meta.RateRoom;
    });
    mapDataRateRoomEvents.forEach(function(mapDataEvent) {
        if (!mapDataEvent) return;
        this._rooms.forEach(function(room) {
            if (this.randBool(parseFloat(mapDataEvent.meta.RateRoom))) {
                for (var i = 1; $dataMap.events[i] || $gameMap._events[i]; i++) continue;
                var event = new Game_Event($gameMap.mapId(), mapDataEvent.id);
                event._eventId = i;
                $gameMap._events[i] = event;
                event.event = function(){
                    return this.hasTemplate() ? $dataTemplateEvents[this._templateId] : mapDataEvent;
                };
                this.setEvent(event, 'room', room);
            }
        }, this);
    }, this);
};

//ランダムブール
//probability : true が返る確立
Game_MapGenerator.prototype.randBool = function(probability) {
    return Math.random() < probability;
};

//隣接判定
Game_MapGenerator.prototype.isAdjacenting = function(x, y, name, naname) {
    var value = 0;
    for (var i = 0; i < (naname ? 8 : 4); i++) {
        var ax = [0,-1,1,0,-1,-1,1,1], ay = [1,0,0,-1,1,-1,-1,1];
        var sx = this._symbolMap[x + ax[i]];
        if (!sx || !sx[y + ay[i]]) continue;
        if (sx[y + ay[i]] === name) value++;
    }
    return value;
};

//装飾パーツ隣接判定
Game_MapGenerator.prototype.isAdjacentingRorP = function(x, y) {
    var value = 0;
    for (var i = 0; i < 4; i++) {
        var sx = this._symbolMap[x + [0, -1, 1, 0][i]];
        if (!sx || !sx[y + [1, 0, 0, -1][i]]) continue;
        if (['rm1', 'rm2', 'rm3', 'rm4', 'ps1', 'ps2', 'ps3', 'ps4'].indexOf(sx[y + [1, 0, 0, -1][i]]) >= 0) value++;
    }
    return value;
};

Game_MapGenerator.prototype.shuffle = function(array) {
    var n = array.length, t, i;
    while (n) {
        i = Math.floor(Math.random() * n--);
        t = array[n];
        array[n] = array[i];
        array[i] = t;
    }
    return array;
};

// シンボルマップの壁と天井を設置：マップ全体
// 床と通路だけのシンボルマップに壁と天井を追加する
Game_MapGenerator.prototype.refreshWallAndRoof = function() {
    for (var x = this._symbolMap.length - 1; x >= 0; x--) {
        for (var y = this._symbolMap[x].length - 1; y >= 0; y--) {
            if (this.isGround(x, y)) {
                this.refreshWallAndRoofUpperSide(x - 1, y - 1);  // 左上
                this.refreshWallAndRoofUpper(x, y - 1);          // 上
                this.refreshWallAndRoofUpperSide(x + 1, y - 1);  // 右上
                this.refreshWallAndRoofSide(x - 1, y);           // 左
                this.refreshWallAndRoofSide(x + 1, y);           // 右
                this.refreshWallAndRoofDowner(x - 1, y + 1);     // 左下
                this.refreshWallAndRoofDowner(x, y + 1);         // 下
                this.refreshWallAndRoofDowner(x + 1, y + 1);     // 右下
            }
        }
    }
    for (var x = this._symbolMap.length - 1; x >= 0; x--) {
        for (var y = this._symbolMap[x].length - 1; y >= 0; y--) {
            if (this._symbolMap[x][y] === 'roof' && this._symbolMap[x][y - 1] === 'wall') {
                this._symbolMap[x][y - 1] = 'roof';
            }
            if (this._symbolMap[x][y] === 'space') this._symbolMap[x][y] = 'roof';
        }
    }
};
Game_MapGenerator.prototype.refreshDisturb = function() {
    var des = Number($dataMap.meta.disturb) || 0; //乱雑さ (0~9)
    var xList = [], yList = [];
    for (var x = 0; x < this._symbolMap.length; x++) {
        xList.push(x)
        for (var y = 0; y < this._symbolMap[x].length; y++) {
            if (!yList[x]) yList[x] = [];
            yList[x].push(y);
        }
    };
    this.shuffle(xList);
    for (var x = 0; x < yList.length; x++) this.shuffle(yList[x]);
    
    for (var x2 = 0; x2 < this._symbolMap.length; x2++) {
        for (var y2 = 0; y2 < this._symbolMap[x2].length; y2++) {
            var x = xList[x2], y = yList[x][y2];
            var symbol = this._symbolMap[x][y];
            if ((symbol === 'space') || (
                symbol === 'room' && !this.isAdjacenting(x, y, 'pass', true) &&
                !this.isAdjacenting(x, y, 'changeRoof', true) &&
                ((this.isAdjacenting(x, y, 'roof') === 2 && this.randBool(0.5 * des/9)) ||
                 (this.isAdjacenting(x, y, 'roof') === 1 && this.randBool(0.5 * des/9)) ||
                 (this.isAdjacenting(x, y, 'roof', true) === 0 && this.randBool(0.12 * des/9)))))
                this._symbolMap[x][y] = 'changeRoof';
//            else if (symbol === 'roof' &&
//                this.isAdjacenting(x, y, 'pass') >= 1 && this.randBool(0.15 * des/9))
//                this._symbolMap[x][y] = 'changePass';
//            else if (symbol === 'roof' &&
//                this.isAdjacenting(x, y, 'room') >= 1 && this.randBool(0.15 * des/9))
//                this._symbolMap[x][y] = 'changeRoom';
        }
    }
    for (var x = this._symbolMap.length - 1; x >= 0; x--) {
        for (var y = this._symbolMap[x].length - 1; y >= 0; y--) {
            var symbol = this._symbolMap[x][y];
            if (symbol === 'changeRoof') this._symbolMap[x][y] = 'roof';
            if (symbol === 'changePass') this._symbolMap[x][y] = 'pass';
            if (symbol === 'changeRoom') this._symbolMap[x][y] = 'room';
            if (((symbol === 'room' &&
                 ((this.isAdjacenting(x, y, 'roof') && !Math.randomInt(15)) || 
                  (!this.isAdjacenting(x, y, 'roof') && !Math.randomInt(30)))) ||
               (symbol === 'pass' && !Math.randomInt(20))) &&
               !this.isAdjacentingRorP(x, y))
                this._symbolMap[x][y] = (symbol === 'pass' ? 'ps' : 'rm') + (1 + Math.randomInt(4));
            if (symbol === 'roof' && !Math.randomInt(30) && !this.isAdjacentingRorP(x, y))
                this._symbolMap[x][y] = 'rf' + (1 + Math.randomInt(4));
        }
    }
};

// シンボルマップの壁と天井を設置：上
Game_MapGenerator.prototype.refreshWallAndRoofUpper = function(x, y) {
    if (!this._symbolMap[x] || !this._symbolMap[x][y] || this.isGround(x, y)) {
        return;
    }
    for (var h = 0; h < y && !this.isGround(x, y - h); h++);
    if (h > this._wallHeight) {
        for (var wH = 0; wH < this._wallHeight; wH++) {
            this._symbolMap[x][y - wH] = 'wall';
        }
        this._symbolMap[x][y - this._wallHeight] = 'roof';
    } else {
        for (var wH = 0; wH < h; wH++) {
            if (!this.isGround(x, y - wH)) {
                this._symbolMap[x][y - wH] = 'rubble';
            }
        }
    }
};

// シンボルマップの壁と天井を設置：下
Game_MapGenerator.prototype.refreshWallAndRoofDowner = function(x, y) {
    if (!this._symbolMap[x] || !this._symbolMap[x][y] || this.isGround(x, y)) {
        return;
    }
    for (var h = 0; h + y < $gameMap.height() && !this.isGround(x, y + h); h++);
    if (h > this._wallHeight) {
        this._symbolMap[x][y] = 'roof';
        if (this._showOuterWall) {
            for (var wH = 0; wH < this._wallHeight; wH++) {
                if (this._symbolMap[x][y + wH + 1] !== 'roof') {
                    this._symbolMap[x][y + wH + 1] = 'wall';
                }
            }
        }
    } else {
        for (var wH = 0; wH < h; wH++) {
            if (!this.isGround(x, y + wH) && !this.isWall(x, y)) {
                this._symbolMap[x][y + wH] = 'rubble';
            }
        }
    }
};

//シンボルマップの壁と天井を設置：横
Game_MapGenerator.prototype.refreshWallAndRoofSide = function(x, y) {
    if (!this._symbolMap[x] || !this._symbolMap[x][y] || this.isGround(x, y)) {
        return;
    }
    if (this.isGround(x, y + 1)) {
        this.refreshWallAndRoofUpper(x, y);
    } else {
        this.refreshWallAndRoofDowner(x, y);
    }
};

// シンボルマップの壁と天井を設置：斜め上
Game_MapGenerator.prototype.refreshWallAndRoofUpperSide = function(x, y) {
    if (!this._symbolMap[x] || !this._symbolMap[x][y] || this.isGround(x, y)) {
        return;
    }
    this.refreshWallAndRoofDowner(x, y - this._wallHeight);
};

// オートタイルを考慮したタイルID
Game_MapGenerator.prototype.autoTileId = function(x, y, z) {
    var baseTileId = this._symbolTable[this._symbolMap[x][y]].baseTileId[z];
    if ((x < 0 || x >= $dataMap.width) || (y < 0 || y >= $dataMap.height)) {
        return undefined;
    } else if (z === 4) {
        return this.shadow(x, y);
    } else if (!Tilemap.isAutotile(baseTileId)) { 
        return baseTileId;
    }
    var candidateTileIds = [];
    if (!Tilemap.isWallSideTile(baseTileId)) {
        // 壁以外の場合
        candidateTileIds = Game_MapGenerator.tileIdsFloor.candidate.concat();
        [1, 2, 3, 4, 6, 7, 8, 9].forEach (function(direction) {
            var dx = x + Math.floor((direction - 1) % 3) - 1;
            var dy = y - Math.floor((direction - 1) / 3) + 1;
            if ((dx < 0 || dx >= $dataMap.width) || (dy < 0 || dy >= $dataMap.height)) {
                return; // マップ範囲外なら判定しない
            }
            var roundTileId = this._symbolTable[this._symbolMap[dx][dy]].baseTileId[z];
            if (Tilemap.isSameKindTile(baseTileId, roundTileId)) {
                candidateTileIds = candidateTileIds.filter(function(Id) {
                    return Game_MapGenerator.tileIdsFloor.connect[direction].indexOf(Id) !== -1;
                }); // 同種オートタイルの場合候補タイルIDから接続タイルIDを選択
            } else {
                candidateTileIds = candidateTileIds.filter(function(Id) {
                    return Game_MapGenerator.tileIdsFloor.noConnect[direction].indexOf(Id) !== -1;
                }); // 異種オートタイルの場合候補タイルIDから非接続タイルIDを選択
            }
        }, this);
    } else {
        // 壁の場合
        candidateTileIds = Game_MapGenerator.tileIdsWall.candidate.concat();
        for (var by = y; this._symbolMap[x][y] === this._symbolMap[x][by + 1]; by++);  // 壁の下端
        for (var ty = y; this._symbolMap[x][y] === this._symbolMap[x][ty - 1]; ty--);  // 壁の上端
        // 上下の処理
        [2, 8].forEach(function(direction) {
            var dx = x + Math.floor((direction - 1) % 3) - 1;
            var dy = y - Math.floor((direction - 1) / 3) + 1;
            if ((dx < 0 || dx >= $dataMap.width) || (dy < 0 || dy >= $dataMap.height)) {
                return; // マップ範囲外なら判定しない
            }
            var roundTileId = this._symbolTable[this._symbolMap[dx][dy]].baseTileId[z];
            if (Tilemap.isSameKindTile(baseTileId, roundTileId)) {
                candidateTileIds = candidateTileIds.filter(function(Id) {
                    return Game_MapGenerator.tileIdsWall.connect[direction].indexOf(Id) !== -1;
                }); // 同種オートタイルの場合候補タイルIDから接続タイルIDを選択
            } else {
                candidateTileIds = candidateTileIds.filter(function(Id) {
                    return Game_MapGenerator.tileIdsWall.noConnect[direction].indexOf(Id) !== -1;
                }); // 異種オートタイルの場合候補タイルIDから非接続タイルIDを選択
            }
        }, this);
        // 左右の処理
        [4, 6].forEach(function(direction) {
            var dx = x + Math.floor((direction - 1) % 3) - 1;
            var dy = y - Math.floor((direction - 1) / 3) + 1;
            if ((dx < 0 || dx >= $dataMap.width) || (dy < 0 || dy >= $dataMap.height)) {
                return; // マップ範囲外なら判定しない
            }
            var upperSideTileId  = this._symbolTable[this._symbolMap[dx][ty]].baseTileId[z];
            var downerSideTileId = this._symbolTable[this._symbolMap[dx][by]].baseTileId[z];
            if ((Tilemap.isWallTile(upperSideTileId)  || Tilemap.isRoofTile(upperSideTileId)) &&
                (Tilemap.isWallTile(downerSideTileId) || Tilemap.isRoofTile(downerSideTileId)))
            {
                candidateTileIds = candidateTileIds.filter(function(Id) {
                    return Game_MapGenerator.tileIdsWall.connect[direction].indexOf(Id) !== -1;
                }); // 壁の下端の両横隣が壁タイルまたは天井タイルでかつ上端の両横隣が壁タイルまたは天井タイルでなければ接続タイルIDを選択
            } else {
                candidateTileIds = candidateTileIds.filter(function(Id) {
                    return Game_MapGenerator.tileIdsWall.noConnect[direction].indexOf(Id) !== -1;
                }); // 非接続タイルIDを選択
            }
        }, this);
    }
    return this._symbolTable[this._symbolMap[x][y]].baseTileId[z] + candidateTileIds[0];
};


// タイル同種判定
Game_MapGenerator.prototype.isSameKindTileSymbol = function(symbol1, symbol2) {
    return Tilemap.isSameKindTile(symbol1, symbol2);
};

// 影の算出
Game_MapGenerator.prototype.shadow = function(x, y) {
//    if (!this._symbolMap[x - 1] ||
//        this._symbolMap[x][y] === 'space'||
//        this._symbolMap[x][y] === 'roof' ||
//        this._symbolMap[x][y] === 'wall')
//    {
//        return 0;
//    } else if (this._symbolMap[x - 1][y] === 'roof') {
//        if (this._symbolMap[x - 1][y - 1] === 'roof' ||
//            this._symbolMap[x - 1][y - 1] === 'wall')
//        {
//            return 5;
//        }
//    }  else if (this._symbolMap[x - 1][y] === 'wall') {
//        return 5;
//    }
    return 0;
};

// マップデータ作成
Game_MapGenerator.prototype.makeData = function() {
    var width = $dataMap.width;
    var height = $dataMap.height;
    for (var x = 0; x < this._symbolMap.length; x++) {
        for (var y = 0; y < this._symbolMap[x].length; y++) {
            for (var z = 0; z < 6; z++) {
                this._data[(z * height + y) * width + x] = this.autoTileId(x, y, z);
            }
        }
    }
};

// 非地面タイルを通路タイルに変換
Game_MapGenerator.prototype.notGroundToPass = function(x, y) {
    var block = this.newBlock();
    var wH = this._wallHeight;
    if (x < block.x || block.x + block.w <= x) return;
    if (y < block.y || block.x + block.h <= y) return;
    if (!this.isGround(x, y) && this._symbolMap[x] && this._symbolMap[x][y]) {
        this._symbolMap[x][y] = 'pass';
    }
};
// 部屋タイルに変換
Game_MapGenerator.prototype.toRoom = function(x, y) {
    var block = this.newBlock();
    var wH = this._wallHeight;
    if (x < block.x || block.x + block.w <= x) return;
    if (y < block.y || block.y + block.h <= y) return;
    if (this._symbolMap[x] && this._symbolMap[x][y]) {
        this._symbolMap[x][y] = 'room';
    }
};

// ツルハシ(プレイヤーの前方1タイルを通路タイルに変換)
Game_MapGenerator.prototype.pickel = function() {
    this.notGroundToPass(
        $gameMap.xWithDirection($gamePlayer.x, $gamePlayer.direction()),
        $gameMap.yWithDirection($gamePlayer.y, $gamePlayer.direction())
    );
    this.refreshWallAndRoof();
    SceneManager._scene._spriteset._tilemap.refresh();
    this.makeData();
    if (Imported.SAN_AnalogMove) {
        Game_CollideMap.setup();
    }
    $gameSystem.HK()._groundList[[$gamePlayer.x, $gamePlayer.y]] = null;
    $gameSystem._needRefreshMiniMapGround = true;
};

// バクダン(指定座標と周囲の計9タイルを通路タイルに変換)
Game_MapGenerator.prototype.bomb = function(x, y) {
    for (var x2 = x - 1; x2 <= x + 1; x2++) {
        for (var y2 = y - 1; y2 <= y + 1; y2++) {
            this.notGroundToPass(x2, y2);
        }
    }
    this.refreshWallAndRoof();
    SceneManager._scene._spriteset._tilemap.refresh();
    this.makeData();
    if (Imported.SAN_AnalogMove) {
        Game_CollideMap.setup();
    }
    $gameSystem.HK()._groundList[[$gamePlayer.x, $gamePlayer.y]] = null;
    $gameSystem._needRefreshMiniMapGround = true;
    
};

// 大部屋
Game_MapGenerator.prototype.bigRoom = function() {
    Game_MapGenerator.prototype.generateMap.call(this);
    this.refreshWallAndRoof();
    SceneManager._scene._spriteset._tilemap.refresh();
    this.makeData();
    if (Imported.SAN_AnalogMove) {
        Game_CollideMap.setup();
    }
    $gameSystem.HK()._groundList[[$gamePlayer.x, $gamePlayer.y]] = null;
    $gameSystem._needRefreshMiniMapGround = true;
};

// 指定したタイルを空白タイルに変換
Game_MapGenerator.prototype.anyToSpace = function(x, y) {
    if (x < 0 || $gameMap.width()  <= x) { return; }
    if (y < 0 || $gameMap.height() <= y) { return; }
    this._symbolMap[x][y] = 'space';
};

// 壁生成
Game_MapGenerator.prototype.makeWall = function(x, y) {
    this.anyToSpace(x, y);
    this.refreshWallAndRoof();
    this.makeData();
    if (Imported.SAN_AnalogMove) {
        Game_CollideMap.setup();
    }
    $gameSystem.HK()._groundList[[$gamePlayer.x, $gamePlayer.y]] = null;
    $gameSystem._needRefreshMiniMapGround = true;
};

// マップデータ
Game_MapGenerator.prototype.data = function() {
    return this._data;
};

// タイルID
Game_MapGenerator.prototype.tileId = function(x, y, z) {
    return this._data[(z * $dataMap.height + y) * $dataMap.width + x];
};

// 準備完了判定
Game_MapGenerator.prototype.isReady = function() {
    return this._isReady;
};

// マップのコンソール表示（デバッグ用）
Game_MapGenerator.prototype.printMap = function() {
    var dispMap = "";
    for (var y = 0; y < this._symbolMap[0].length; y++) {
        for (var x = 0; x < this._symbolMap.length; x++) {
            dispMap += this._symbolTable[this._symbolMap[x][y]].dispChar;
        }
        dispMap += "\r\n";
    }
    console.log(dispMap);
};

//-----------------------------------------------------------------------------
// Game_MapGeneratorRoomAndPass
//
// マップジェネレーター（部屋と通路）

function Game_MapGeneratorRoomAndPass() {
    this.initialize.apply(this, arguments);
}

Game_MapGeneratorRoomAndPass.prototype = Object.create(Game_MapGenerator.prototype);
Game_MapGeneratorRoomAndPass.prototype.constructor = Game_MapGeneratorRoomAndPass;

// 初期化
Game_MapGeneratorRoomAndPass.prototype.initialize = function() {
    Game_MapGenerator.prototype.initialize.call(this);
};

// マップ（ダンジョン）自動生成
Game_MapGeneratorRoomAndPass.prototype.generateMap = function() {
    this._minRoomSize = Number($dataMap.meta.minRoomSize) || Number(PluginManager.parameters('SAN_MapGenerator')['MinRoomSize']);
    this._maxRoomSize = Number($dataMap.meta.maxRoomSize) || Number(PluginManager.parameters('SAN_MapGenerator')['MaxRoomSize']);
    if (this._maxRoomSize < this._minRoomSize) {
        this._maxRoomSize = this._minRoomSize;
    }
    this._minBlockSize = this._minRoomSize + (this._wallHeight + 1) * 2 + 2;
    this._minRooms = Number($dataMap.meta.minRooms) || 3;
    this._maxRooms = Number($dataMap.meta.maxRooms) || 6;
    this._adjacentBlockIndexList = [];
    var block = this.newBlock();
    this._blocks.push(block);
    this.splitBlock(this._blocks[0]);
    this.makeAdjacentBlockIndexList();
    this.makeRooms();
    this.makePasses();
};

// 隣り合うブロックのリスト作成
Game_MapGeneratorRoomAndPass.prototype.makeAdjacentBlockIndexList = function() {
    for (var crntIndex = 0; crntIndex < this._blocks.length; crntIndex++) {
        var crntBlock = this._blocks[crntIndex];
        this._adjacentBlockIndexList[crntIndex] = {t:[], b:[], l:[], r:[]};
        for (var tgetIndex = 0; tgetIndex < this._blocks.length; tgetIndex++) {
            var tgetBlock = this._blocks[tgetIndex];
            if (crntBlock === tgetBlock) {
                continue;
            }
            var adjacentT = (crntBlock.y === tgetBlock.y + tgetBlock.h + 1);
            var adjacentB = (tgetBlock.y === crntBlock.y + crntBlock.h + 1);
            var adjacentL = (crntBlock.x === tgetBlock.x + tgetBlock.w + 1);
            var adjacentR = (tgetBlock.x === crntBlock.x + crntBlock.w + 1);
            if (!adjacentT && !adjacentB && !adjacentL && !adjacentR) {
                continue;
            }
            var matchH =
                (tgetBlock.x <= crntBlock.x + crntBlock.w && tgetBlock.x >= crntBlock.x) ||
                (tgetBlock.x + tgetBlock.w <= crntBlock.x + crntBlock.w && tgetBlock.x + tgetBlock.w >= crntBlock.x) ||
                (crntBlock.x <= tgetBlock.x + tgetBlock.w && crntBlock.x >= tgetBlock.x) ||
                (crntBlock.x + crntBlock.w <= tgetBlock.x + tgetBlock.w && crntBlock.x + crntBlock.w >= tgetBlock.x);
            var matchV =
                (tgetBlock.y <= crntBlock.y + crntBlock.h && tgetBlock.y >= crntBlock.y) ||
                (tgetBlock.y + tgetBlock.h <= crntBlock.y + crntBlock.h && tgetBlock.y + tgetBlock.h >= crntBlock.y) ||
                (crntBlock.y <= tgetBlock.y + tgetBlock.h && crntBlock.y >= tgetBlock.y) ||
                (crntBlock.y + crntBlock.h <= tgetBlock.y + tgetBlock.h && crntBlock.y + crntBlock.h >= tgetBlock.y);
            if (adjacentT && matchH) {
                this._adjacentBlockIndexList[crntIndex].t.push(tgetIndex);
                continue;
            } else if (adjacentB && matchH) {
                this._adjacentBlockIndexList[crntIndex].b.push(tgetIndex);
                continue;
            }
            if (adjacentL && matchV) {
                this._adjacentBlockIndexList[crntIndex].l.push(tgetIndex);
                continue;
            } else if (adjacentR && matchV) {
                this._adjacentBlockIndexList[crntIndex].r.push(tgetIndex);
                continue;
            }
        }
    }
};

// 部屋作成
Game_MapGeneratorRoomAndPass.prototype.makeRooms = function() {
    var mapBlock = this.newBlock();
    this._blocks.forEach(function(block) {
        var roomW = this._minRoomSize + Math.randomInt((block.w - (this._wallHeight + 1) * 2) - this._minRoomSize - 2);
        var roomH = this._minRoomSize + Math.randomInt((block.h - (this._wallHeight + 1) * 2) - this._minRoomSize - 2);
        if (roomW > this._maxRoomSize) {
            roomW = this._maxRoomSize;
        }
        if (roomH > this._maxRoomSize) {
            roomH = this._maxRoomSize;
        }
        var roomX = block.x + (this._wallHeight + 1) + 1 + Math.randomInt(block.w - roomW - (this._wallHeight + 1) * 2 - 1);
        var roomY = block.y + (this._wallHeight + 1) + 1 + Math.randomInt(block.h - roomH - (this._wallHeight + 1) * 2 - 1);
        
        while (roomX + roomW > mapBlock.x + mapBlock.w) {
            if (roomW > this._minRoomSize) roomW--;
            else if (roomX > block.x + (this._wallHeight + 1) + 1) roomX--;
            else return;
        }
        while (roomY + roomH > mapBlock.y + mapBlock.h) {
            if (roomH > this._minRoomSize) roomH--;
            else if (roomY > block.y + (this._wallHeight + 1) + 1) roomY--;
            else return;
        }
        
//        var min = this._minRoomSize, max = this._maxRoomSize;
//        var sp = 2;
//        var roomW = Math.min(min + Math.randomInt(block.w - sp * 2 - min - 2), max);
//        var roomH = Math.min(min + Math.randomInt(block.h - sp * 2 - min - 2), max);
//        var roomX = block.x + (this._wallHeight + 1) + 1 + Math.randomInt(block.w - roomW - (this._wallHeight + 1) * 2 - 1);
//        var roomY = block.y + (this._wallHeight + 1) + 1 + Math.randomInt(block.h - roomH - (this._wallHeight + 1) * 2 - 1);
////        var roomX = block.x + 4 + Math.randomInt(block.w - roomW + 1 - 8);
////        var roomY = block.y + 4 + Math.randomInt(block.h - roomH + 1 - 8);
        
        var room = this.newRoom(roomX, roomY, roomW, roomH);
        this._rooms.push(room);
    }, this);
    this._rooms.forEach(function(room) {
        for (var y = 0; y < room.h; y++) {
            for (var x = 0 ; x < room.w; x++) {
                this._symbolMap[room.x + x][room.y + y] = 'room';
            }
        }
    }, this);
};

// 通路作成
Game_MapGeneratorRoomAndPass.prototype.makePasses = function() {
    var cache = {};
    for (var crntIndex = 0; crntIndex < this._adjacentBlockIndexList.length; crntIndex++ ) {
        cache[crntIndex] = [];
        var crngBlock = this._blocks[crntIndex];
        for(var direction in this._adjacentBlockIndexList[crntIndex]) {
            var tgetIndexList = this._adjacentBlockIndexList[crntIndex][direction];
            tgetIndexList.forEach(function(tgetIndex) {
                if (cache[tgetIndex] !== undefined && cache[tgetIndex].indexOf(crntIndex) !== -1)
                {
                    return;
                }
                cache[crntIndex].push(tgetIndex);
                var tgetBlock = this._blocks[tgetIndex];
                var crntRoom = this._rooms[crntIndex];
                var tgetRoom = this._rooms[tgetIndex];
                var crntPass = {x:0, y:0, w:0, h:0};
                var tgetPass = {x:0, y:0, w:0, h:0};
                var bordPass = {x:0, y:0, w:0, h:0};
                var wid = function () {return 1;}
                switch (direction) {
                case 't':
                    if (crntRoom.hasPass.t || tgetRoom.hasPass.b) {
                        return;
                    }
                    crntPass.x = crntRoom.x + 1 + Math.randomInt(crntRoom.w - 2);
                    crntPass.y = crngBlock.y;
                    crntPass.w = wid();
                    crntPass.h = crntRoom.y - crngBlock.y;
                    tgetPass.x = tgetRoom.x + 1 + Math.randomInt(tgetRoom.w - 2);
                    tgetPass.y = tgetRoom.y + tgetRoom.h;
                    tgetPass.w = wid();
                    tgetPass.h = crngBlock.y - tgetPass.y;
                    bordPass.x = Math.min(crntPass.x, tgetPass.x);
                    bordPass.y = crngBlock.y - 1;
                    bordPass.w = Math.max(crntPass.x, tgetPass.x) - bordPass.x + 1;
                    bordPass.h = wid();
                    crntRoom.hasPass.t = true;
                    tgetRoom.hasPass.b = true;
                    crntRoom.passXy.t = [crntPass.x, crntRoom.y - 1];
                    tgetRoom.passXy.b = [tgetPass.x, tgetPass.y];
                    crntRoom.connectRoom.t = tgetRoom, tgetRoom.connectRoom.b = crntRoom;
                    break;
                case 'b':
                    if (crntRoom.hasPass.b || tgetRoom.hasPass.t) {
                        return;
                    }
                    crntPass.x = crntRoom.x + 1 + Math.randomInt(crntRoom.w - 2);
                    crntPass.y = crntRoom.y + crntRoom.h;
                    crntPass.w = wid();
                    crntPass.h = tgetBlock.y - crntPass.y;
                    tgetPass.x = tgetRoom.x + 1 + Math.randomInt(tgetRoom.w - 2);
                    tgetPass.y = tgetBlock.y;
                    tgetPass.w = wid();
                    tgetPass.h = tgetRoom.y - tgetBlock.y;
                    bordPass.x = Math.min(crntPass.x, tgetPass.x);
                    bordPass.y = tgetBlock.y - 1;
                    bordPass.w = Math.max(crntPass.x, tgetPass.x) - bordPass.x + 1;
                    bordPass.h = wid();
                    crntRoom.hasPass.b = true;
                    tgetRoom.hasPass.t = true;
                    crntRoom.passXy.b = [crntPass.x, crntPass.y];
                    tgetRoom.passXy.t = [tgetPass.x, tgetRoom.y - 1];
                    crntRoom.connectRoom.b = tgetRoom, tgetRoom.connectRoom.t = crntRoom;
                    break;
                case 'l':
                    if (crntRoom.hasPass.l || tgetRoom.hasPass.r) {
                        return;
                    }
                    crntPass.x = crngBlock.x - 1;
                    crntPass.y = crntRoom.y + 1 + Math.randomInt(crntRoom.h - 2);
                    crntPass.w = crntRoom.x - crntPass.x;
                    crntPass.h = wid();
                    tgetPass.x = tgetRoom.x + tgetRoom.w;
                    tgetPass.y = tgetRoom.y + 1 + Math.randomInt(tgetRoom.h - 2);
                    tgetPass.w = crntPass.x - tgetRoom.x - tgetRoom.w;
                    tgetPass.h = wid();
                    bordPass.x = crngBlock.x - 1;
                    bordPass.y = Math.min(crntPass.y, tgetPass.y);
                    bordPass.w = wid();
                    bordPass.h = Math.max(crntPass.y, tgetPass.y) - bordPass.y + 1;
                    crntRoom.hasPass.l = true;
                    tgetRoom.hasPass.r = true;
                    crntRoom.passXy.l = [crntRoom.x - 1, crntPass.y];
                    tgetRoom.passXy.r = [tgetPass.x, tgetPass.y];
                    crntRoom.connectRoom.l = tgetRoom, tgetRoom.connectRoom.r = crntRoom;
                    break;
                case 'r':
                    if (crntRoom.hasPass.r || tgetRoom.hasPass.l) {
                        return;
                    }
                    crntPass.x = crntRoom.x + crntRoom.w
                    crntPass.w = tgetBlock.x - 1 - crntRoom.x - crntRoom.w
                    crntPass.y = crntRoom.y + 1 + Math.randomInt(crntRoom.h - 2);
                    crntPass.h = wid();
                    tgetPass.x = tgetBlock.x - 1;
                    tgetPass.y = tgetRoom.y + 1 + Math.randomInt(tgetRoom.h - 2);
                    tgetPass.w = tgetRoom.x - tgetPass.x;
                    tgetPass.h = wid();
                    bordPass.x = tgetBlock.x - 1;
                    bordPass.y = Math.min(crntPass.y, tgetPass.y);
                    bordPass.w = wid();
                    bordPass.h = Math.max(crntPass.y, tgetPass.y) - bordPass.y + 1;
                    crntRoom.hasPass.r = true;
                    tgetRoom.hasPass.l = true;
                    crntRoom.passXy.r = [crntPass.x, crntPass.y];
                    tgetRoom.passXy.l = [tgetRoom.x - 1, tgetPass.y];
                    crntRoom.connectRoom.r = tgetRoom, tgetRoom.connectRoom.l = crntRoom;
                    break;
                }
                this._passes.push(crntPass);
                this._passes.push(tgetPass);
                this._passes.push(bordPass);
            }, this);
        }
    }
    this._passes.forEach(function(pass) {
        for (var y = 0; y < pass.h; y++) {
            for (var x = 0; x < pass.w; x++) {
                this._symbolMap[pass.x + x][pass.y + y] = 'pass';
            }
        }
    }, this);
};

// ブロック分割：ランダム
Game_MapGeneratorRoomAndPass.prototype.splitBlock = function(block) {
    if (this.randBool(0.5)) {
        if (this.isSplitableH(block)) {
            this.splitBlockH(block);
        }
        if (this.isSplitableV(block)) {
            this.splitBlockV(block);
        }
    } else {
        if (this.isSplitableV(block)) {
            this.splitBlockV(block);
        }
        if (this.isSplitableH(block)) {
            this.splitBlockH(block);
        }
    }
};

//ブロック分割：横分割
Game_MapGeneratorRoomAndPass.prototype.splitBlockH = function(block) {
    var orgBlockW = 0;
    var newBlockW = 0;
    while (orgBlockW < this._minBlockSize || newBlockW < this._minBlockSize) {
        orgBlockW = Math.floor(block.w / 4 + block.w * Math.random() / 2);
        newBlockW = block.w - orgBlockW - 1;
    }
    block.w = orgBlockW;
    var newBlock = {x:block.x + orgBlockW + 1, y:block.y, w:newBlockW, h:block.h};
    this._blocks.push(newBlock);
    this.splitBlock(block);
    this.splitBlock(newBlock);
};

// ブロック分割：縦分割
Game_MapGeneratorRoomAndPass.prototype.splitBlockV = function(block) {
    var orgBlockH = 0;
    var newBlockH = 0;
    while (orgBlockH < this._minBlockSize || newBlockH < this._minBlockSize) {
        orgBlockH = Math.floor(block.h / 4 + block.h * Math.random() / 2);
        newBlockH = block.h - orgBlockH - 1;
    }
    block.h = orgBlockH;
    var newBlock = {x:block.x, y:block.y + orgBlockH + 1, w:block.w, h:newBlockH};
    this._blocks.push(newBlock);
    this.splitBlock(block);
    this.splitBlock(newBlock);
};

// ブロック分割可能判定：部屋数
Game_MapGeneratorRoomAndPass.prototype.isSplitableByRoomNum = function() {
    if (this._blocks.length >= this._maxRooms) {
        return false;
    }
    if (this._blocks.length >= this._minRooms &&
        this.randBool((this._blocks.length - this._minRooms + 1) / (this._maxRooms - this._minRooms + 1)))
    {
        return false;
    }
    return true;
};

// ブロック分割可能判定：横分割
Game_MapGeneratorRoomAndPass.prototype.isSplitableV = function(block) {
    return block.h > (this._minBlockSize * 2 + 1) && this.isSplitableByRoomNum();
};

// ブロック分割可能判定：縦分割
Game_MapGeneratorRoomAndPass.prototype.isSplitableH = function(block) {
    return block.w > (this._minBlockSize * 2 + 1) && this.isSplitableByRoomNum();
};

// 座標によって部屋を取得
Game_MapGeneratorRoomAndPass.prototype.roomByXY = function(x, y) {
    for (i = 0; i < this._rooms.length; i++) {
        var room = this._rooms[i];
        if (room.x <= x && x < room.x + room.w &&
            room.y <= y && y < room.y + room.h)
        {
            return room;
        }
    }
    return undefined;
};

//-----------------------------------------------------------------------------
// Game_Map
//
// マップクラス

// マップクラスの初期化
Sanshiro.Game_MapGenerator.Game_Map_initialize = Game_Map.prototype.initialize;
Game_Map.prototype.initialize = function() {
    Sanshiro.Game_MapGenerator.Game_Map_initialize.call(this);
};

// マップジェネレーターの取得
Game_Map.prototype.mapGenerator = function() {
    return this._mapGenerator;
};

// マップクラスのセットアップ
Sanshiro.Game_MapGenerator.Game_Map_setup = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId) {
    Sanshiro.Game_MapGenerator.Game_Map_setup.call(this, mapId)
    this._mapGenerator = null;
};

// マップクラスのタイルID
Sanshiro.Game_MapGenerator.Game_Map_tileId = Game_Map.prototype.tileId
Game_Map.prototype.tileId = function(x, y, z) {
    if (this.isGenegratedMap()) {
        return this._mapGenerator.tileId(x, y, z);
    }
    return Sanshiro.Game_MapGenerator.Game_Map_tileId.call(this, x, y, z);
};

// マップクラスのマップデータ
Sanshiro.Game_MapGenerator.Game_Map_data = Game_Map.prototype.data
Game_Map.prototype.data = function() {
    if (this.isGenegratedMap()) {
        return this._mapGenerator.data();
    }
    return Sanshiro.Game_MapGenerator.Game_Map_data.call(this);
};

// マップクラスの通行判定
Sanshiro.Game_MapGenerator.Game_Map_isPassable = Game_Map.prototype.isPassable
Game_Map.prototype.isPassable = function(x, y, d) {
    if (this.isGenegratedMap()) {
        return this._mapGenerator.isPassable(x, y, d);
    }
    return Sanshiro.Game_MapGenerator.Game_Map_isPassable.call(this, x, y, d);
};

// マップクラスのマップ自動生成
Game_Map.prototype.generateMap = function(mapType) {
    mapType = mapType || 'FillRoom';
    switch (mapType) {
    case 'RoomAndPass':
        this._mapGenerator = new Game_MapGeneratorRoomAndPass();
        break;
    case 'FillRoom':
        this._mapGenerator = new Game_MapGenerator();
        break;
    }
    this._mapGenerator.setup();
    if (Imported.SAN_AnalogMove) {
        Game_CollideMap.setup();
    }
};

// 自動生成マップ判定
Game_Map.prototype.isGenegratedMap = function() {
    return !!this._mapGenerator && this._mapGenerator.isReady();
};

// ツルハシ
Game_Map.prototype.pickel = function() {
    if (this.isGenegratedMap()) {
        this._mapGenerator.pickel();
    }
};

// バクダン
Game_Map.prototype.bomb = function(x, y) {
    if (this.isGenegratedMap()) {
        this._mapGenerator.bomb(x, y);
    }
};

// 大部屋
Game_Map.prototype.bigRoom = function() {
    if (this.isGenegratedMap()) {
        this._mapGenerator.bigRoom();
    }
};

// 壁生成
Game_Map.prototype.makeWall = function(x, y) {
    if (this.isGenegratedMap()) {
        this._mapGenerator.makeWall(x, y);
    }
};

// 壁破壊
Game_Map.prototype.eraseWall = function(xyList, toRoom) {
    if (this.isGenegratedMap() && xyList.length) {
        xyList.forEach(function(xy) {
            if (toRoom) this._mapGenerator.toRoom(xy[0], xy[1]);
            else this._mapGenerator.notGroundToPass(xy[0], xy[1]);
        }, this)
        this._mapGenerator.refreshWallAndRoof();
        SceneManager._scene._spriteset._tilemap.refresh();
        this._mapGenerator.makeData();
        if (Imported.SAN_AnalogMove) {
            Game_CollideMap.setup();
        }
        $gameSystem.HK()._groundList[[$gamePlayer.x, $gamePlayer.y]] = null;
        $gameSystem._needRefreshMiniMapGround = true;
    }
};

// シンボル取得
Game_Map.prototype.symbolXy = function(x, y) {
    if (!this._mapGenerator) return this.regionId(x, y) >= 7 ? 'room' : $gameSystem.isGround(x, y) ? 'pass' : 'roof';
    if (!this._mapGenerator._symbolMap[x]) return null;
    return this._mapGenerator._symbolMap[x][y];
};

// xyが部屋かどうか
Game_Map.prototype.isRoom = function(x, y) {
    return ['room', 'rm1', 'rm2', 'rm3', 'rm4'].contains(this.symbolXy(x, y));
};
// xyが通路かどうか
Game_Map.prototype.isPass = function(x, y) {
    return ['pass', 'ps1', 'ps2', 'ps3', 'ps4'].contains(this.symbolXy(x, y));
};

// シンボル隣接判定
Game_Map.prototype.isAdjacenting = function(x, y, name, naname) {
    return this._mapGenerator.isAdjacenting(x, y, name, naname);
};

// 座標によって部屋を取得
Game_Map.prototype.roomByXY = function(x, y) {
    if (!this.mapGenerator()) return this.regionId(x, y);
    for (i = 0; i < this.mapGenerator()._rooms.length; i++) {
        var room = this.mapGenerator()._rooms[i];
        if (room.x <= x && x < room.x + room.w &&
            room.y <= y && y < room.y + room.h)
        {
            return room;
        }
    }
};

//-----------------------------------------------------------------------------
// Game_Character
//
// キャラクタークラス

Game_Character.prototype.currentRoom = function () {
    if (!$gameMap.isGenegratedMap ||
        !($gameMap.mapGenerator() instanceof Game_MapGeneratorRoomAndPass))
    {
        return $gameMap.roomByXY(this.x, this.y);
    }
    return $gameMap.mapGenerator().roomByXY(this.x, this.y);
};

// プレイヤーと同部屋判定
Game_Character.prototype.isSameRoomWithPlayer = function() {
    if ($gameMap.mapGenerator().constructor === Game_MapGenerator) { return true; }
    var room1 = this.currentRoom();
    var room2 = $gamePlayer.currentRoom();
    return (!!room1 && !!room2 && room1 === room2);
};

//-----------------------------------------------------------------------------
// Game_Event
//
// イベントクラス

// イベントクラスの初期化
Sanshiro.Game_MapGenerator.Game_Event_initialize = Game_Event.prototype.initialize;
Game_Event.prototype.initialize = function(mapId, eventId) {
    this._dataEventId = eventId;
    Sanshiro.Game_MapGenerator.Game_Event_initialize.call(this, mapId, eventId);
};

// イベントクラスのデータベースのイベントデータ
Game_Event.prototype.event = function() {
    return $dataMap.events[this._dataEventId];
};

//-----------------------------------------------------------------------------
// Game_Interpreter
//
// インタープリタークラス

// プラグインコマンド
Sanshiro.Game_MapGenerator.Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function(command, args) {
    Sanshiro.Game_MapGenerator.Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'MapGenerator') {
        switch (args[0]) {
        case 'FillRoom':
            $gameMap.generateMap(args[0]);
            break;
        case 'RoomAndPass':
            $gameMap.generateMap(args[0]);
            break;
        }
    }
};
