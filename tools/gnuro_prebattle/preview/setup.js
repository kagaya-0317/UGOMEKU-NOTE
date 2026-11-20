// Native WebAudio and isolated saves for this QA profile only.
(function(){
    $plugins=$plugins.filter(function(p){return p.name!=='AudioStreaming';});
    var path=require('path'),fs=require('fs'),os=require('os');
    var saves=path.join(os.tmpdir(),'codex-gnuro-prebattle-20261119-saves');
    fs.mkdirSync(saves,{recursive:true});
    StorageManager.localFileDirectoryPath=function(){return saves+path.sep;};
})();
