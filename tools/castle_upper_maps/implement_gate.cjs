const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('./implement_events.cjs');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'data/Map060.json');
const before=fs.readFileSync(file),text=before.toString('utf8'),map=JSON.parse(text),gate=map.events[8];
assert.equal(gate.name,'玉座の間_二鍵の大扉');
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const js=(s,i=0)=>s.split('\n').map((s,n)=>c(n?655:355,[s],i));
const msg=(lines,i=0)=>[c(101,['',0,0,2],i),...lines.map(s=>c(401,[s],i))];
const system=(lines,i=0)=>[...js('KNH_CastleUpper.systemMessage(); $gameMessage._popupHeight = 0;',i),...msg(lines,i),...js('KNH_CastleUpper.clearMessage();',i)];
const exitIf=(condition,lines)=>[c(111,[12,condition]),...(lines?system(lines,1):[]),...js('KNH_CastleUpper.clearMessage();\ndelete this._castleGateFirstKey;',1),c(115,[],1),c(412)];
const select=n=>[...js('KNH_CastleUpper.systemMessage(); $gameMessage._popupHeight = 0;'),...msg([n===1?'カギを選ぼう':'カギをもう1本選ぼう']),c(104,[3,1]),...js('KNH_CastleUpper.clearMessage();'),...exitIf('$gameVariables.value(3) === 0')];
gate.note=gate.note.replace(/<castleThroneGate>/g,'')+'<castleThroneGate>';
gate.pages[0].list=[
 ...system(['カギがかかっているようだ','カギ穴が2つある']),
 ...select(1),
 ...exitIf('![53,54].contains($gameVariables.value(3))',['鍵穴に合わないようだ']),
 ...js('this._castleGateFirstKey = $gameVariables.value(3);'),
 c(250,[{name:'Equip1',volume:75,pitch:85,pan:0}]),c(230,[18]),
 ...select(2),
 ...exitIf('!((this._castleGateFirstKey === 53 && $gameVariables.value(3) === 54) || (this._castleGateFirstKey === 54 && $gameVariables.value(3) === 53))',['この組み合わせでは','開かないようだ']),
 ...exitIf('!$gameParty.hasItem($dataItems[53]) || !$gameParty.hasItem($dataItems[54])',['鍵が足りないようだ']),
 c(126,[53,1,0,1]),c(126,[54,1,0,1]),
 c(250,[{name:'Equip1',volume:75,pitch:100,pan:0}]),c(230,[24]),
 ...js('KNH_CastleUpper.beginGate(this.eventId());\nthis.setWaitMode("castleUpperFormation");'),...js('KNH_CastleUpper.focusGate(this.eventId());'),c(230,[60]),
 c(250,[{name:'Door2',volume:90,pitch:80,pan:0}]),
 ...js('this.character(0)._castleGateOpening = 0;'),c(230,[84]),
 c(122,[66,66,0,0,1]),...js('KNH_CastleUpper.refreshEvents();'),c(230,[24]),
 c(111,[12,'KNH_CastleUpper.gateMiiSpeaker()']),
 ...msg(['おっきな','扉だね'],1),...msg(['この先が','王の部屋かな…'],1),
 c(111,[12,'KNH_CastleUpper.gateYumeSpeaker()'],1),...msg(['きっとそうよ','準備していきましょ'],2),c(412,[],1),
 ...js('KNH_CastleUpper.gateMiiSpeaker();',1),...msg(['ぼくも出会ったことのない','モンスターの王…','いったいどんな人なんだろう'],1),...msg(['…'],1),c(412),
 ...js('KNH_CastleUpper.returnScene();\nthis.setWaitMode("castleUpperReturn");'),...js('KNH_CastleUpper.endGate();\ndelete this._castleGateFirstKey;'),c(230,[60]),c(0)
];
// An opened gate retains its arch; the native transfer page stays authoritative.
gate.pages[1].image={...gate.pages[0].image};
const [a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[[8,gate]])+text.slice(b);
assert.ok(fs.readFileSync(file).equals(before),'Map changed while preparing gate patch');
fs.writeFileSync(file,updated);console.log('Patched only Map060 event 8');
const plugin=path.join(root,'js/plugins/KNH_ZXC_CastleUpper.js'),original=fs.readFileSync(plugin),code=original.toString('utf8');
const marker='    // This guest uses an actual Game_Actor';
assert.ok(code.includes(marker));
if (!code.includes('api.beginGate =')) {
 const nl=code.includes('\r\n')?'\r\n':'\n';
 const helpers=['gate_item_placement.txt','gate_helpers.txt'].map(name=>fs.readFileSync(path.join(__dirname,name),'utf8').replace(/\r?\n/g,nl)).join(nl);
 assert.ok(fs.readFileSync(plugin).equals(original),'Plugin changed while preparing gate patch');
 fs.writeFileSync(plugin,code.replace(marker,helpers+nl+marker));
 console.log('Inserted scoped gate helpers; preserved existing plugin bytes and line endings');
}
const exitFile=path.join(root,'data/Map062.json'),exitBefore=fs.readFileSync(exitFile),exitText=exitBefore.toString('utf8'),exitMap=JSON.parse(exitText),exit=exitMap.events[6];
exit.pages[0].priorityType=1;exit.pages[0].through=false;
const [exitA,exitB]=keySpan(exitText,'events');
assert.ok(fs.readFileSync(exitFile).equals(exitBefore),'Exit map changed while preparing gate patch');
fs.writeFileSync(exitFile,exitText.slice(0,exitA)+patchRecords(exitText.slice(exitA,exitB),[[6,exit]])+exitText.slice(exitB));
