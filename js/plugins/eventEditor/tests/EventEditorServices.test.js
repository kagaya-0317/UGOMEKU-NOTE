'use strict';

var assert = require('assert');
var path = require('path');
var services = require('../KNH_ZXC_EventEditor_Services.js');

function createMemoryFs() {
    var files = Object.create(null);
    var mtimes = Object.create(null);
    var dirs = Object.create(null);
    var writeClock = 1;
    dirs[path.resolve('C:\\ee-test')] = true;
    return {
        files: files,
        existsSync: function(filePath) {
            var key = path.resolve(filePath);
            return Object.prototype.hasOwnProperty.call(files, key) || !!dirs[key];
        },
        mkdirSync: function(dirPath) {
            dirs[path.resolve(dirPath)] = true;
        },
        readFileSync: function(filePath) {
            var key = path.resolve(filePath);
            if (!Object.prototype.hasOwnProperty.call(files, key)) throw new Error('ENOENT: ' + key);
            return files[key];
        },
        writeFileSync: function(filePath, text, options) {
            var key = path.resolve(filePath);
            if (options && options.flag === 'wx' && Object.prototype.hasOwnProperty.call(files, key)) {
                throw new Error('EEXIST: ' + key);
            }
            files[key] = String(text);
            mtimes[key] = writeClock++;
        },
        renameSync: function(fromPath, toPath) {
            var fromKey = path.resolve(fromPath);
            var toKey = path.resolve(toPath);
            files[toKey] = files[fromKey];
            mtimes[toKey] = mtimes[fromKey];
            delete files[fromKey];
            delete mtimes[fromKey];
        },
        unlinkSync: function(filePath) {
            var key = path.resolve(filePath);
            delete files[key];
            delete mtimes[key];
        },
        readdirSync: function(dirPath) {
            var dirKey = path.resolve(dirPath);
            return Object.keys(files).filter(function(filePath) {
                return path.dirname(filePath) === dirKey;
            }).map(function(filePath) { return path.basename(filePath); });
        },
        statSync: function(filePath) {
            var key = path.resolve(filePath);
            if (!Object.prototype.hasOwnProperty.call(files, key)) throw new Error('ENOENT: ' + key);
            return { mtimeMs: mtimes[key], isFile: function() { return true; } };
        }
    };
}

var memoryFs = createMemoryFs();
var clock = 100;
var storage = services.createStorage({
    fs: memoryFs,
    path: path,
    processId: 7,
    now: function() { return clock++; },
    random: function() { return 0.25; }
});
var root = path.resolve('C:\\ee-test');
var filePath = path.join(root, 'data', 'System.json');
var backupDir = path.join(root, 'data', '_backup');

storage.writeTextAtomic(filePath, '{"before":true}');
assert.strictEqual(storage.readText(filePath), '{"before":true}');
assert.strictEqual(storage.exists(filePath), true);

var result = storage.backupAndWriteJson({
    filePath: filePath,
    value: { after: true },
    spacing: 2,
    backupDir: backupDir,
    backupName: 'System.100.json'
});
assert.strictEqual(storage.readText(result.backupPath), '{"before":true}');
assert.deepStrictEqual(storage.readJson(filePath), { after: true });

var secondBackup = storage.writeBackup(backupDir, 'System.100.json', 'second');
assert.notStrictEqual(secondBackup, result.backupPath);
assert.strictEqual(storage.readText(secondBackup), 'second');

storage.writeBackup(backupDir, 'System.101.json', 'third');
storage.writeBackup(backupDir, 'System.102.json', 'fourth');
var removed = storage.pruneBackups(backupDir, 'System.', 2);
assert.strictEqual(removed.length, 2);
assert.strictEqual(memoryFs.readdirSync(backupDir).filter(function(name) {
    return name.indexOf('System.') === 0;
}).length, 2);

storage.removeFileIfExists(filePath);
assert.strictEqual(storage.exists(filePath), false);
assert.strictEqual(storage.removeFileIfExists(filePath), true);

console.log('Event editor services: OK');
