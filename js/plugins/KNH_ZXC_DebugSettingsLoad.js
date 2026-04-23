/*:
 * @plugindesc [Playtest] Read KNH_ZXC_DebugSettings.json at boot + auto-start tray app (hidden) v0.4
 * @author kagaya
 *
 * @help
 * 外部トレイアプリが保存する JSON 設定を、テストプレイ開始時に1回だけ読み込みます。
 * プレイ中に JSON を更新しても反映はしません（テストプレイ再起動で反映）。
 *
 * 読み込み先:
 *   (process.cwd())/js/plugins/KNH_ZXC_DebugSettings.json
 *
 * 参照:
 *   _debug.get("test1") // bool
 *   _debug.get("test2") // number
 *
 * ■自動起動（任意・開発用）
 * - まず親フォルダ内の UGOMEKU_NOTE_DebugTrayApp* を探し、
 *   dist 内の exe があればそれを起動（推奨）
 * - 無ければ npm start を PowerShell(非表示) 経由で起動（cmdウィンドウを出さない）
 *
 * 無効化したい場合: AUTO_START_TRAY_APP を false に
 */
(function() {
  "use strict";

  var _debug = window._debug = window._debug || {};
  var DEFAULTS = {};
  var AUTO_START_TRAY_APP = true;

  function isPlaytest() {
    try { return Utils && Utils.isOptionValid && Utils.isOptionValid("test"); }
    catch (e) { return false; }
  }

  function getSettingsPath() {
    var path = require("path");
    return path.join(process.cwd(), "js", "plugins", "KNH_ZXC_DebugSettings.json");
  }

  function readJsonOnce() {
    var fs = require("fs");
    var p = getSettingsPath();
    console.log(p);

    try {
      if (!fs.existsSync(p)) return Object.assign({}, DEFAULTS);

      var txt = fs.readFileSync(p, "utf-8");
      txt = txt.replace(/^\uFEFF/, ""); // BOM対策

      var obj = JSON.parse(txt);
      if (!obj || typeof obj !== "object") return Object.assign({}, DEFAULTS);

      // DEFAULTS を下地にして上書き（DEFAULTSが空なら実質objのコピー）
      return Object.assign({}, DEFAULTS, obj);

    } catch (e) {
      console.error(e);
      return Object.assign({}, DEFAULTS);
    }
  }

  _debug._boot = null;
  _debug.loadBoot = function() { this._boot = readJsonOnce(); return this._boot; };
  _debug.get = function (key, fallback) {
    var cfg = this._boot || DEFAULTS;
    var v = cfg[key];
    return v === undefined ? fallback : v;
  };


  // 一度だけ起動試行
  var __knhTrayTried = false;

  function tryAutoStartTrayApp() {
    if (!AUTO_START_TRAY_APP) return;
    if (__knhTrayTried) return;
    __knhTrayTried = true;

    var fs = require("fs");
    var path = require("path");
    var cp = require("child_process");

    // NewGame の親フォルダ（Game_NewGame など）に置いてある想定
    var parent = path.resolve(process.cwd(), "..");

    // フォルダ名: UGOMEKU_NOTE_DebugTrayApp_v0.4 など
    var candidates = [];
    try {
      var entries = fs.readdirSync(parent);
      for (var i = 0; i < entries.length; i++) {
        var name = entries[i];
        if (name.indexOf("UGOMEKU_NOTE_DebugTrayApp") === 0 || name.indexOf("デバッグパネル") === 0) {
          var full = path.join(parent, name);
          try {
            if (fs.statSync(full).isDirectory()) candidates.push(full);
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (!candidates.length) return;
    candidates.sort();
    var appDir = candidates[candidates.length - 1];

    // 1) exe を探す（electron-builder）
    // dist/UGOMEKU NOTE Debug Tray.exe などになる可能性があるので、dist内のexeを拾う
    try {
      var distDir = path.join(appDir, "dist/win-unpacked");
      if (fs.existsSync(distDir) && fs.statSync(distDir).isDirectory()) {
        var distFiles = fs.readdirSync(distDir).filter(function(f){ return /\.exe$/i.test(f); });
        if (distFiles.length) {
          distFiles.sort();
          var exePath = path.join(distDir, distFiles[distFiles.length - 1]);
          cp.spawn(exePath, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
          return;
        }
      }
    } catch (e) {}

    // 2) npm start を PowerShell(非表示) で起動（cmdを出さない）
    //    Start-Process は、起動元のウィンドウを閉じても子プロセスが残る
    try {
      var ps = [
        "-NoProfile",
        "-WindowStyle", "Hidden",
        "-Command",
        "Start-Process -WindowStyle Hidden -FilePath \"cmd.exe\" -ArgumentList \"/c npm start\" -WorkingDirectory \"" + appDir.replace(/"/g,'""') + "\""
      ];
      cp.spawn("powershell.exe", ps, { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } catch (e) {
      // 失敗してもゲーム続行
    }
  }

  var _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    if (isPlaytest()) {
      tryAutoStartTrayApp();
      _debug.loadBoot();
    }
    _Scene_Boot_start.call(this);
  };

})();
