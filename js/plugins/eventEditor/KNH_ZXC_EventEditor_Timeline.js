//=============================================================================
// KNH_ZXC_EventEditor_Timeline.js (functional split loader)
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.2 (functional split loader)
 * @author kagaya
 * @help
 * KNH_ZXC_EventEditor.js の後に読み込んでください。
 * 本ファイルは eventEditor 配下の機能別分割ファイルを順次読み込みます。
 */

(function() {
    'use strict';

    var NS = window.KNH_ZXC_EventEditor = window.KNH_ZXC_EventEditor || {};
    if (NS._timelineSplitLoaderApplied) return;
    NS._timelineSplitLoaderApplied = true;

    var fs = null;
    var path = null;
    try {
        fs = require('fs');
        path = require('path');
    } catch (_) {
        return;
    }

    var baseDir = '';
    try {
        baseDir = path.join(path.dirname(process.mainModule.filename), 'js', 'plugins', 'eventEditor');
    } catch (_) {
        return;
    }

    var files = [
        'KNH_ZXC_EventEditor_Timeline_Core.js',
        'KNH_ZXC_EventEditor_Timeline_Schema.js',
        'KNH_ZXC_EventEditor_Timeline_Preview.js',
        'KNH_ZXC_EventEditor_Timeline_Render.js',
        'KNH_ZXC_EventEditor_Timeline_Input.js'
    ];

    var merged = '';
    for (var i = 0; i < files.length; i++) {
        var fp = path.join(baseDir, files[i]);
        if (!fs.existsSync(fp)) {
            throw new Error('Timeline split file missing: ' + fp);
        }
        merged += fs.readFileSync(fp, 'utf8') + '\n';
    }

    (0, eval)(merged + '\n//# sourceURL=KNH_ZXC_EventEditor_Timeline.bundle.js');
})();
