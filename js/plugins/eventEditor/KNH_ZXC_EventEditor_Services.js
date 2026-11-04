//=============================================================================
// KNH_ZXC_EventEditor_Services
//=============================================================================

(function(root, factory) {
    'use strict';
    var api = factory();
    if (root) {
        var ns = root.KNH_ZXC_EventEditor = root.KNH_ZXC_EventEditor || {};
        ns._eeServices = api;
    }
    if (typeof window === 'undefined' && typeof module === 'object' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    function createStorage(options) {
        options = options || {};
        var fs = options.fs || require('fs');
        var path = options.path || require('path');
        var now = options.now || function() { return Date.now(); };
        var random = options.random || Math.random;
        var processId = options.processId == null
            ? ((typeof process !== 'undefined' && process.pid) || 0)
            : options.processId;

        function ensureDir(dirPath) {
            if (!dirPath || fs.existsSync(dirPath)) return dirPath;
            fs.mkdirSync(dirPath, { recursive: true });
            return dirPath;
        }

        function ensureParent(filePath) {
            ensureDir(path.dirname(filePath));
            return filePath;
        }

        function tempPathFor(filePath) {
            return filePath + '.event-editor-' + String(processId) + '-' +
                String(now()) + '-' + String(Math.floor(random() * 1000000)) + '.tmp';
        }

        function isReplaceBlockedError(error) {
            var code = String(error && error.code || '');
            return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' ||
                code === 'EEXIST' || code === 'ENOTEMPTY';
        }

        function waitForReplaceRetry(milliseconds) {
            var until = Date.now() + Math.max(0, Math.floor(Number(milliseconds || 0)));
            while (Date.now() < until) {}
        }

        function replaceTempFile(tempPath, filePath, text) {
            var renameError = null;
            for (var attempt = 0; attempt < 3; attempt++) {
                try {
                    fs.renameSync(tempPath, filePath);
                    return true;
                } catch (error) {
                    if (!isReplaceBlockedError(error)) throw error;
                    renameError = error;
                    if (attempt < 2) waitForReplaceRetry((attempt + 1) * 8);
                }
            }
            try {
                if (typeof fs.copyFileSync === 'function') {
                    fs.copyFileSync(tempPath, filePath);
                } else {
                    fs.writeFileSync(filePath, String(text == null ? '' : text), { encoding: 'utf8' });
                }
            } catch (copyError) {
                try {
                    fs.writeFileSync(filePath, String(text == null ? '' : text), { encoding: 'utf8' });
                } catch (writeError) {
                    writeError.atomicRenameError = renameError;
                    writeError.atomicCopyError = copyError;
                    throw writeError;
                }
            }
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
            return true;
        }

        function writeTextAtomic(filePath, text) {
            ensureParent(filePath);
            var tempPath = tempPathFor(filePath);
            var committed = false;
            try {
                fs.writeFileSync(tempPath, String(text == null ? '' : text), {
                    encoding: 'utf8',
                    flag: 'wx'
                });
                replaceTempFile(tempPath, filePath, text);
                committed = true;
            } finally {
                if (!committed) {
                    try {
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    } catch (_) {}
                }
            }
            return filePath;
        }

        function writeJsonAtomic(filePath, value, spacing) {
            var indent = spacing == null ? 2 : spacing;
            return writeTextAtomic(filePath, JSON.stringify(value, null, indent));
        }

        function readText(filePath) {
            return fs.readFileSync(filePath, 'utf8');
        }

        function readJson(filePath) {
            return JSON.parse(readText(filePath));
        }

        function exists(filePath) {
            return !!(filePath && fs.existsSync(filePath));
        }

        function removeFileIfExists(filePath) {
            if (exists(filePath)) fs.unlinkSync(filePath);
            return true;
        }

        function uniquePath(dirPath, fileName) {
            var ext = path.extname(fileName);
            var stem = ext ? fileName.slice(0, -ext.length) : fileName;
            var candidate = fileName;
            var suffix = 1;
            ensureDir(dirPath);
            while (fs.existsSync(path.join(dirPath, candidate))) {
                candidate = stem + '-' + String(suffix++) + ext;
            }
            return path.join(dirPath, candidate);
        }

        function writeBackup(dirPath, fileName, text) {
            var backupPath = uniquePath(dirPath, fileName);
            fs.writeFileSync(backupPath, String(text == null ? '' : text), {
                encoding: 'utf8',
                flag: 'wx'
            });
            return backupPath;
        }

        function pruneBackups(dirPath, prefix, keepCount) {
            var keep = Math.max(1, Math.floor(Number(keepCount || 0)));
            if (!dirPath || !prefix || typeof fs.readdirSync !== 'function' ||
                typeof fs.statSync !== 'function' || typeof fs.unlinkSync !== 'function') return [];
            if (!fs.existsSync(dirPath)) return [];
            var names = fs.readdirSync(dirPath).filter(function(name) {
                return String(name).indexOf(String(prefix)) === 0;
            });
            var files = [];
            for (var i = 0; i < names.length; i++) {
                var filePath = path.join(dirPath, names[i]);
                try {
                    var stat = fs.statSync(filePath);
                    if (!stat || (typeof stat.isFile === 'function' && !stat.isFile())) continue;
                    files.push({
                        path: filePath,
                        name: names[i],
                        mtimeMs: Number(stat.mtimeMs || (stat.mtime && stat.mtime.getTime()) || 0)
                    });
                } catch (_) {}
            }
            files.sort(function(a, b) {
                return (b.mtimeMs - a.mtimeMs) || String(b.name).localeCompare(String(a.name));
            });
            var removed = [];
            for (var j = keep; j < files.length; j++) {
                try {
                    fs.unlinkSync(files[j].path);
                    removed.push(files[j].path);
                } catch (_) {}
            }
            return removed;
        }

        function backupAndWriteJson(options) {
            options = options || {};
            var filePath = options.filePath;
            if (!filePath) throw new Error('filePath is required');
            var originalText = fs.existsSync(filePath) ? readText(filePath) : '';
            var backupPath = '';
            if (originalText.length && options.backupDir && options.backupName) {
                backupPath = writeBackup(options.backupDir, options.backupName, originalText);
            }
            writeJsonAtomic(filePath, options.value, options.spacing);
            var removedBackups = [];
            if (backupPath && options.backupPrefix && options.keepBackups != null) {
                removedBackups = pruneBackups(options.backupDir, options.backupPrefix, options.keepBackups);
            }
            return { filePath: filePath, backupPath: backupPath, removedBackups: removedBackups };
        }

        return {
            ensureDir: ensureDir,
            ensureParent: ensureParent,
            readText: readText,
            readJson: readJson,
            exists: exists,
            removeFileIfExists: removeFileIfExists,
            writeTextAtomic: writeTextAtomic,
            writeJsonAtomic: writeJsonAtomic,
            uniquePath: uniquePath,
            writeBackup: writeBackup,
            pruneBackups: pruneBackups,
            backupAndWriteJson: backupAndWriteJson
        };
    }

    var storage = null;
    try {
        storage = createStorage();
    } catch (_) {}

    return {
        createStorage: createStorage,
        storage: storage
    };
});
