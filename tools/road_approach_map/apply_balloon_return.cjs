// Add the existing exclamation balloon and native walking handoff to Map063.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {keySpan, patchRecords} = require('../castle_upper_maps/implement_events.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'artifacts/road-intro-balloon-return-20261120');
fs.mkdirSync(path.join(out, 'before'), {recursive: true});
const files = new Map();
function read(file) {
    const bytes = fs.readFileSync(path.join(root, file));
    const text = bytes.toString('utf8');
    assert.ok(Buffer.from(text).equals(bytes), file + ': UTF-8');
    files.set(file, {bytes, text, next: text});
    return text;
}
function replace(file, before, after) {
    const entry = files.get(file) || (read(file), files.get(file));
    assert.equal(entry.next.split(before).length, 2, file + ': unique patch');
    entry.next = entry.next.replace(before, after);
}
const mapFile = 'data/Map063.json';
const text = read(mapFile), map = JSON.parse(text);
const event = structuredClone(map.events[3]);
const list = event.pages[0].list;
assert.equal(list.filter(c => c.code === 213).length, 0);
const firstText = list.findIndex(c => c.code === 101);
assert.ok(firstText > 0);
list.splice(firstText, 0, {code: 213, indent: 0, parameters: [-1, 11, false]});
const end = list.findIndex(c => c.code === 355 && c.parameters[0] === 'KNH_CastleUpper.endRoadIntro();');
assert.ok(end > firstText);
list.splice(end, 0,
    {code: 355, indent: 0, parameters: ['KNH_CastleUpper.returnScene();']},
    {code: 655, indent: 0, parameters: ['this.setWaitMode("castleUpperReturn");']});
const [a, b] = keySpan(text, 'events');
files.get(mapFile).next = text.slice(0, a) + patchRecords(text.slice(a, b), [[3, event]]) + text.slice(b);
const systemFile = 'data/System.json', systemText = read(systemFile), system = JSON.parse(systemText);
const [x, y] = keySpan(systemText, 'versionId');
files.get(systemFile).next = systemText.slice(0, x) + JSON.stringify(system.versionId + 1) + systemText.slice(y);
// isReturning already restores each follower's direction before the handoff.
const pluginFile = 'js/plugins/KNH_ZXC_CastleUpper.js';
const plugin = read(pluginFile), nl = plugin.includes('\r\n') ? '\r\n' : '\n';
const endBlock = ['    api.endRoadIntro = function() {', '        var state = roadIntroState();', '        if (!state) return;', '        $gameMessage.clearPopupPortrait();', '        api.roadIntroFaceRight();', '        api.endScene();'].join(nl);
replace(pluginFile, endBlock, endBlock.replace('        api.roadIntroFaceRight();' + nl, ''));
const builderFile = 'tools/road_approach_map/implement_intro.cjs';
replace(builderFile, " ...dialoguePages.flatMap(p=>p.speaker==='tsunehi'?voice(p.lines,!!p.tone,!!p.laugh):reaction(p.lines,p.speaker)),", " ...dialoguePages.flatMap((p,index)=>{const commands=p.speaker==='tsunehi'?voice(p.lines,!!p.tone,!!p.laugh):reaction(p.lines,p.speaker);if(index===0)commands.splice(commands.findIndex(c=>c.code===101),0,c(213,[-1,11,false]));return commands;}),");
replace(builderFile, " wait(24),...js('KNH_CastleUpper.endRoadIntro();'),", " wait(24),...js('KNH_CastleUpper.returnScene();\\nthis.setWaitMode(\"castleUpperReturn\");'),...js('KNH_CastleUpper.endRoadIntro();'),");
const dialogueFile = 'tools/road_approach_map/apply_dialogue.cjs';
replace(dialogueFile, 'const dialogue=pages.flatMap(p=>{', 'const dialogue=pages.flatMap((p,index)=>{');
replace(dialogueFile, 'c(101,[\'\',0,0,2],indent)', "...index===0?[c(213,[-1,11,false])]:[],c(101,['',0,0,2],indent)");
// Prove that the map change consists solely of the three requested commands.
const check = JSON.parse(files.get(mapFile).next);
check.events[3].pages[0].list.splice(end, 2);
check.events[3].pages[0].list.splice(firstText, 1);
assert.deepEqual(check, map);
for (const [file, entry] of files) assert.ok(fs.readFileSync(path.join(root, file)).equals(entry.bytes), file + ': concurrent edit');
for (const [file, entry] of files) {
    const backup = path.join(out, 'before', file);
    assert.ok(!fs.existsSync(backup), 'Do not rerun an already applied patch');
    fs.mkdirSync(path.dirname(backup), {recursive: true});
    fs.writeFileSync(backup, entry.bytes);
}
for (const [file, entry] of files) fs.writeFileSync(path.join(root, file), entry.next);
console.log(JSON.stringify({mapId: 63, eventId: 3, balloon: [-1, 11, false], returnWait: 'castleUpperReturn', version: system.versionId + 1, files: [...files.keys()]}));
