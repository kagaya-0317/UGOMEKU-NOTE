// Isolated battle capture only. Leave the project's normal plugin list untouched.
window.__yumePreviewIgnoredMapPlugins = ['KNH_ZXC_Gimmick_Rock'];
$plugins = $plugins.filter(function(plugin) {
    return window.__yumePreviewIgnoredMapPlugins.indexOf(plugin.name) < 0;
});

// The cloud-only weapon database is unavailable. This preview uses its committed
// baseline; no equipped weapon or map object participates in the skill capture.
window.__yumePreviewBaselineData = ['Weapons.json'];
var yumePreviewLoadDataFile = DataManager.loadDataFile;
DataManager.loadDataFile = function(name, src) {
    if (src !== 'Weapons.json') return yumePreviewLoadDataFile.apply(this, arguments);
    window[name] = [null, {id:1, animationId:6, description:'', etypeId:1,
        traits:[{code:31, dataId:1, value:0}, {code:22, dataId:0, value:0}],
        iconIndex:97, name:'', note:'', params:[0,0,10,0,0,0,0,0], price:500, wtypeId:2}];
    this.onLoad(window[name]);
};
