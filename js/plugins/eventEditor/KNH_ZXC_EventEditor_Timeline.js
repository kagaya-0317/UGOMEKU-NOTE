//=============================================================================
// KNH_ZXC_EventEditor_Timeline.js (functional split loader)
//=============================================================================
/*:
 * @plugindesc [MV][Playtest] Event timeline editor timeline extension v0.3.0 (functional split loader)
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
        'KNH_ZXC_EventEditor_Document.js',
        'KNH_ZXC_EventEditor_Services.js',
        'KNH_ZXC_EventEditor_Model.js',
        'KNH_ZXC_EventEditor_Timeline_Shared.js',
        'KNH_ZXC_EventEditor_Style.js',
        'KNH_ZXC_EventEditor_Timeline_Core.js',
        'KNH_ZXC_EventEditor_RouteSchemas.js',
        'KNH_ZXC_EventEditor_Debug.js',
        'KNH_ZXC_EventEditor_Timeline_Schema.js',
        'KNH_ZXC_EventEditor_CommandSchemas.js',
        'KNH_ZXC_EventEditor_Timeline_Preview.js',
        'KNH_ZXC_EventEditor_Timeline_Branch.js',
        'KNH_ZXC_EventEditor_Timeline_Render.js',
        'KNH_ZXC_EventEditor_Timeline_Edit.js',
        'KNH_ZXC_EventEditor_Timeline_Canvas.js',
        'KNH_ZXC_EventEditor_Timeline_Input.js'
    ];

    for (var i = 0; i < files.length; i++) {
        var fp = path.join(baseDir, files[i]);
        if (!fs.existsSync(fp)) {
            throw new Error('Timeline split file missing: ' + fp);
        }
        var source = fs.readFileSync(fp, 'utf8');
        (0, eval)(source + '\n//# sourceURL=js/plugins/eventEditor/' + files[i]);
    }

    var shared = NS._eeTimelineShared;
    var requiredModules = ['shared', 'core', 'route_schemas', 'debug', 'schema', 'command_schemas', 'preview', 'branch', 'render', 'edit', 'canvas', 'input'];
    if (!NS._eeDocument || !NS._eeServices || !NS._eeServices.storage ||
        !NS._eeModel || typeof NS._eeStyleText !== 'string') {
        throw new Error('Timeline service initialization incomplete');
    }
    if (!shared || !shared.hasModules || !shared.hasModules(requiredModules)) {
        throw new Error('Timeline module initialization incomplete');
    }
})();
