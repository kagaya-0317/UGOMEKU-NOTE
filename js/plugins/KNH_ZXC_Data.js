//=============================================================================
// KNH_ZXC_Data.js
//=============================================================================

/*:
 * @plugindesc ZXCデータ管理
 * @author kagaya
 *
 * @help
 */

var $dataZXC = {};

(function() {
    'use strict';
    var pluginName = 'KNH_ZXC_Data';

    //-----------------------------------------------------------------------------
    // data
    //-----------------------------------------------------------------------------

    var ensureBaseDescription = function (data) {
        if (!data) return '';
        if (!Object.prototype.hasOwnProperty.call(data, '_zxcBaseDescription')) {
            data._zxcBaseDescription = data.description || '';
        }
        return data._zxcBaseDescription || '';
    };
    var processDataDescriptions = function () {
        if (!$dataItems || !$dataArmors || !$dataSkills) return;

        $dataItems.forEach(it => {
            if (!it || !it.name) return;
            var base = ensureBaseDescription(it);
            var formula = it.damage && it.damage.formula != null ? it.damage.formula : '';
            it.description = _tl(base).format(formula);
        });
        $dataArmors.forEach(ar => {
            if (!ar || !ar.name) return;
            var base = ensureBaseDescription(ar);
            var pr = ar.params.map(a => Math.abs(a));
            ar.description = _tl(base).format(pr[2], pr[3], pr[4], pr[5], pr[6], pr[7], pr[0], pr[1]);
            ar.description = ar.description.replace(
                /<([^>]+?)>/g,
                (_, tag) => Object.prototype.hasOwnProperty.call(ar.meta, tag)
                    ? ar.meta[tag]
                    : _
            );
        });
        $dataSkills.forEach(sk => {
            if (!sk || !sk.name) return;
            var base = ensureBaseDescription(sk);
            sk.description = _tl(base);
        });

        if ($gameTemp) {
            $gameTemp._dataSet = true;
            $gameTemp._dataLanguage = _lg;
        }
    };
    
    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.apply(this, arguments);
        if (!$gameTemp._dataSet || $gameTemp._dataLanguage !== _lg) this.processData();
    };

    Scene_Boot.prototype.processData = function () {
        processDataDescriptions();
    };

    var _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function (variableId, value) {
        var lastValue = this.value(variableId);
        _Game_Variables_setValue.apply(this, arguments);
        if (variableId !== 31) return;
        if (lastValue === this.value(variableId)) return;
        if (!$gameTemp || !$gameTemp._dataSet) return;
        processDataDescriptions();
    };

    var _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function () {
        _Scene_Base_update.apply(this, arguments);
        if (!$gameTemp || !$gameTemp._dataSet) return;
        if ($gameTemp._dataLanguage === _lg) return;
        processDataDescriptions();
    };
})();
