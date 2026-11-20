// Reuse the verified silent-monitor routing, with this task's own save directory.
(function() {
    var path = require('path'), fs = require('fs'), os = require('os');
    var directory = path.join(os.tmpdir(), 'codex-road-intro-capture-20261120-saves');
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    StorageManager.localFileDirectoryPath = function() { return directory + path.sep; };
})();
