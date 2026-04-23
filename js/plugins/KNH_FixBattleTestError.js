/*:
 * @plugindesc [Dev][MV] Keep Battle/Event Test Test_*.json alive for F5 reload (auto backup + restore) v1.1
 * @author kagaya
 *
 * @help
 * 戦闘テスト(btest)/イベントテスト(etest)で data/Test_*.json が消えて
 * F5リロード時に「Failed to load: data/Test_XXX.json」で落ちる問題を回避します。
 *
 * 仕組み:
 * 1) data/Test_*.json が存在する時は data/testData/ にバックアップ（上書き）
 * 2) data/Test_*.json が無い時は data/testData/ から data/ に復元
 * 3) その後、通常の DataManager.loadDatabase が data/Test_*.json を読む
 *
 * 注意:
 * - “未保存のDB編集”を反映する用途ではありません（OKでコミットが必要）
 * - NW.js（ローカル）専用。ブラウザ実行では何もしません
 */

(() => {
    const isTestMode = () => Utils.isOptionValid('btest') || Utils.isOptionValid('etest');
    if (!isTestMode()) return;
    if (!Utils.isNwjs()) return;

    const fs = require('fs');
    const path = require('path');

    const BACKUP_SUBDIR = 'testData';

    function baseDirFromLocation() {
        // 例:
        // テストプレイ: file:///C:/.../NewGame/index.html  -> C:\...\NewGame
        // デプロイ:     file:///C:/.../Game/www/index.html -> C:\...\Game\www
        let p = decodeURIComponent(window.location.pathname || '');
        // Windowsの file:///C:/... は pathname が "/C:/..." になるので先頭の "/" を外す
        if (process.platform === 'win32' && p.startsWith('/')) p = p.slice(1);
        p = p.replace(/\//g, path.sep);
        return path.dirname(p);
    }

    function resolveDataDir() {
        // 基本は index.html の隣の data/
        const base = baseDirFromLocation();
        const cand1 = path.join(base, 'data');

        // 一応、別構成の保険（index.htmlが直下で data が別、など）
        const cand2 = path.join(base, 'www', 'data');

        if (fs.existsSync(cand1)) return cand1;
        if (fs.existsSync(cand2)) return cand2;

        // 最後の手段：相対 data をそのまま base に作る
        return cand1;
    }

    function ensureDir(p) {
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    }

    function safeCopy(src, dst) {
        try {
            fs.copyFileSync(src, dst);
            return true;
        } catch (e) {
            return false;
        }
    }

    function getTestFileList() {
        const list = [];
        for (let i = 0; i < DataManager._databaseFiles.length; i++) {
            list.push('Test_' + DataManager._databaseFiles[i].src);
        }
        if (Utils.isOptionValid('etest')) list.push('Test_Event.json');
        return list;
    }

    function backupAndRestoreTestFiles() {
        const ddir = resolveDataDir();
        const bdir = path.join(ddir, BACKUP_SUBDIR);
        ensureDir(bdir);

        const files = getTestFileList();

        // 1) data側に Test_*.json が一部でもあるなら、それをバックアップに反映（最新化）
        let anyExists = false;
        for (const f of files) {
            if (fs.existsSync(path.join(ddir, f))) { anyExists = true; break; }
        }
        if (anyExists) {
            for (const f of files) {
                const src = path.join(ddir, f);
                const dst = path.join(bdir, f);
                if (fs.existsSync(src)) safeCopy(src, dst);
            }
        }

        // 2) data側に無い Test_*.json をバックアップから復元
        for (const f of files) {
            const dst = path.join(ddir, f);
            if (fs.existsSync(dst)) continue;

            const src = path.join(bdir, f);
            if (fs.existsSync(src)) safeCopy(src, dst);
        }
    }

    const _loadDatabase = DataManager.loadDatabase;
    DataManager.loadDatabase = function () {
        try { backupAndRestoreTestFiles(); } catch (e) { }
        return _loadDatabase.call(this);
    };
})();
