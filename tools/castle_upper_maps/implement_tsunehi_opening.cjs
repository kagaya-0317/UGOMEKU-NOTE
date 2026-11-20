// Native one-shot troop page; reuse the upper-castle battle popup helper.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const dialogue = require('./tsunehi_opening_dialogue.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'artifacts/tsunehi-battle-opening-20261120');
const c = (code, parameters = [], indent = 0) => ({code, indent, parameters});
const page = {
    conditions: {actorHp:50,actorId:1,actorValid:false,enemyHp:50,enemyIndex:0,enemyValid:false,switchId:1,switchValid:false,turnA:0,turnB:0,turnEnding:false,turnValid:true},
    span: 0,
    list: [c(108, ['Tsunehi opening; turn 0; once per battle']), c(121, [6,6,0]), c(230, [24]),
        ...dialogue.flatMap(({who,lines,tone=0}) => {
            const call = 'KNH_CastleUpper.battleSpeaker(' + JSON.stringify(who) + ')';
            const indent = who === 'enemy' ? 0 : 1;
            return [who === 'enemy' ? c(355, [call + ';']) : c(111, [12, call]),
                c(122, [14,14,0,0,tone], indent), c(101, ['',0,0,2], indent),
                ...lines.map(line => c(401, [line], indent)),
                ...(indent ? [c(412)] : [])];
        }), c(355, ['KNH_CastleUpper.clearMessage();']), c(0)]
};
const files = ['data/Troops.json', 'data/testData/Test_Troops.json'];
const pending = files.map(file => {
    const full = path.join(root,file), bytes = fs.readFileSync(full), text = bytes.toString('utf8');
    assert.ok(Buffer.from(text).equals(bytes), 'UTF-8');
    const records = JSON.parse(text), old = records[48], next = structuredClone(old);
    if (file === files[0]) assert.equal(old.pages.length, 0, 'Reconcile existing Tsunehi pages first');
    else assert.ok(!old.name && !old.members.length && old.pages.every(p => p.list.every(c => c.code === 0)), 'Test record has user edits');
    Object.assign(next, structuredClone(JSON.parse(pendingRuntime())));
    next.pages = [page];
    const token = JSON.stringify(old);
    assert.equal(text.split(token).length, 2, 'Unique native troop record');
    const updated = text.replace(token, JSON.stringify(next));
    const proof = JSON.parse(updated); proof[48] = old; assert.deepEqual(proof, records);
    return {file,full,bytes,updated};
});
function pendingRuntime() { return JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, files[0]), 'utf8'))[48]); }
// The existing battle-test snapshot still has a blank enemy 24.
{
    const file = 'data/testData/Test_Enemies.json', full = path.join(root,file);
    const bytes = fs.readFileSync(full), text = bytes.toString('utf8'), records = JSON.parse(text), old = records[24];
    const next = JSON.parse(fs.readFileSync(path.join(root,'data/Enemies.json'),'utf8'))[24];
    assert.ok(!old.name && !old.battlerName, 'Test enemy has user edits');
    const token = JSON.stringify(old); assert.equal(text.split(token).length,2);
    const updated = text.replace(token,JSON.stringify(next));
    const proof = JSON.parse(updated); proof[24] = old; assert.deepEqual(proof,records);
    pending.push({file,full,bytes,updated});
}
const pluginFile = 'js/plugins/KNH_ZXC_CastleUpper.js';
const pluginPath = path.join(root,pluginFile), pluginBytes = fs.readFileSync(pluginPath);
const pluginText = pluginBytes.toString('utf8'), nl = pluginText.includes('\r\n') ? '\r\n' : '\n';
let pluginNext = pluginText;
function replace(before, after) {
    assert.equal(pluginNext.split(before).length, 2, 'Unique plugin patch');
    pluginNext = pluginNext.replace(before,after);
}
replace("        var sp = who === 'beast' ? scene._castleGuestSprite : api.actorSprite(who);", [
    '        var tsunehi = scene instanceof Scene_NewBattle && $gameTroop._troopId === 48;',
    "        var sp = who === 'beast' ? scene._castleGuestSprite :",
    "            tsunehi && who === 'enemy' ? scene._enemySprites.filter(function(sprite) {",
    '                return sprite._battler.enemyId() === 24;',
    '            })[0] : api.actorSprite(who);',
    '        if (tsunehi) {',
    '            if (!sp) return false;',
    '            scene._castleTsunehiSpeaker = who;',
    '            $gameMessage._fukidashi = true;',
    "            $gameMessage._tailDir = who === 'enemy' ? 9 : 7;",
    '            $gameMessage._popupHeight = 0;',
    "            $gameSystem.setMessagePopupFree(who === 'enemy' ? Graphics.boxWidth - 36 : sp.x, Math.max(130, sp.y - (who === 'enemy' ? 110 : 72)));",
    '            return true;',
    '        }'
].join(nl));
replace('    // Mone dialogue uses native troop pages and the existing battle pause/resume', [
    '    // Reuse the native battle-tail targeting already used by Gnuro and Mone.',
    '    var tsunehiTailTarget = Window_Base.prototype._popupTailCharacterCenterToBmp;',
    '    Window_Base.prototype._popupTailCharacterCenterToBmp = function(bmp) {',
    '        var scene = SceneManager._scene;',
    '        if (scene instanceof Scene_NewBattle && $gameTroop._troopId === 48 &&',
    '                this === scene._messageWindow && $gameMessage._fukidashi) {',
    '            var who = scene._castleTsunehiSpeaker;',
    "            var sp = who === 'enemy' ? scene._enemySprites[0] : api.actorSprite(who);",
    '            if (sp) return this._fukidashiGlobalToBmpPos(bmp, sp.x,',
    '                sp.y - sp._frameSize * Math.abs(sp.scale.y) * 0.42);',
    '        }',
    '        return tsunehiTailTarget.apply(this, arguments);',
    '    };',
    '    // Mone dialogue uses native troop pages and the existing battle pause/resume'
].join(nl));
replace('        $gameMessage._popupHeight = 99;', '        $gameMessage._popupHeight = 99;' + nl +
    '        if (SceneManager._scene) delete SceneManager._scene._castleTsunehiSpeaker;');
replace('        if (this._castleMoneDialogue) {' + nl + '            this._castleMoneDialogue.speaker = null;',
    '        if (this._castleMoneDialogue || this._castleTsunehiSpeaker !== undefined) {' + nl +
    '            if (this._castleMoneDialogue) this._castleMoneDialogue.speaker = null;');
pending.push({file:pluginFile,full:pluginPath,bytes:pluginBytes,updated:pluginNext});
for (const entry of pending) assert.ok(fs.readFileSync(entry.full).equals(entry.bytes), 'Concurrent change: ' + entry.file);
for (const entry of pending) {
    const backup = path.join(out,'before',entry.file);
    assert.ok(!fs.existsSync(backup), 'Already applied');
    fs.mkdirSync(path.dirname(backup), {recursive:true}); fs.writeFileSync(backup,entry.bytes);
}
for (const entry of pending) fs.writeFileSync(entry.full,entry.updated);
fs.writeFileSync(path.join(out,'implementation.json'),JSON.stringify({troop:48,turn:0,span:'battle',dialogue,onlyRecord48Changed:true},null,2)+'\n');
console.log('Saved seven opening popups in native troop 48 and its battle-test copy.');
