// Isolated map QA. Normal plugin definitions and project saves are untouched.
(function(){
  // This file-based map-only preview uses native audio loading.
  $plugins=$plugins.filter(function(p){return p.name!=='AudioStreaming';});
  var path=require('path'),os=require('os'),fs=require('fs');
  var saves=path.join(os.tmpdir(),'codex-castle-upper-maps-qa-saves');
  if(!fs.existsSync(saves))fs.mkdirSync(saves);
  StorageManager.localFileDirectoryPath=function(){return saves+path.sep;};
})();
