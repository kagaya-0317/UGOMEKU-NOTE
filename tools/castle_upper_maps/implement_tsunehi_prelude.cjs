const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{keySpan,patchRecords}=require('./implement_events.cjs');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'data/Map062.json'),before=fs.readFileSync(file),text=before.toString('utf8'),map=JSON.parse(text);
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const js=(text,indent=0)=>text.split('\n').map((line,i)=>c(i?655:355,[line],indent));
const msg=(lines,indent=0)=>[c(101,['',0,0,2],indent),...lines.map(line=>c(401,[line],indent))];
const boss=(lines,shout=false)=>[...js('KNH_CastleUpper.throneBossSpeaker('+shout+');'),...msg(lines)];
const actor=(id,lines)=>[c(111,[12,'KNH_CastleUpper.throneActorSpeaker('+id+')']),...msg(lines,1),c(412)];
const pose=name=>js('KNH_CastleUpper.thronePose('+JSON.stringify(name)+');');
const wait=n=>c(230,[n]);
const se=(name,pitch=100)=>c(250,[{name,volume:80,pitch,pan:0}]);
const original=map.events[5].pages[0].list,at=original.findIndex(v=>v.code===301);assert.ok(at>=0&&original[at].parameters[1]===48);
const after=JSON.parse(JSON.stringify(original.slice(at+1)));
// Only reset the temporary lunge/pose; keep the existing battle outcome and progression.
const recover=after.findIndex(v=>v.code===355&&v.parameters[0]==='KNH_CastleUpper.mapSpeaker(3);');assert.ok(recover>=0);
after.splice(recover,0,...js('this._character = KNH_CastleUpper.throneRecover();\nthis.setWaitMode("move");'));
map.events[3].pages[0].image.characterName='$castleTsunehi_back';map.events[3].pages[0].image.direction=8;
for(const id of [7,8])map.events[id].pages[0].moveSpeed=4;
map.events[5].pages[0].list=[
 ...js("ImageManager.loadCharacter('$castleTsunehi_vial_tmp');"),
 ...js('KNH_CastleUpper.beginScene(3, true);\nthis.setWaitMode("castleUpperFormation");'),
 ...js('this._character = this.character(3);\nthis.setWaitMode("image");'),
 ...js('KNH_CastleUpper.focusScene(3);'),wait(90),
 ...boss(['……来たか']),
 ...actor(3,['ツネヒ…？']),...actor(3,['モンスターの','王は？']),
 ...boss(['王はここには','いねえ']),...boss(['そんな簡単に','会わせてたまるかよ']),
 ...js('KNH_CastleUpper.clearMessage();'),...pose('front'),wait(24),
 ...boss(['俺には王を守る','大事な任務があんだ']),...boss(['それ以上近づくな']),
 ...actor(4,['近づくつもりは','ないわ']),...actor(4,['あなたが悪い','モンスターじゃないの','を知ってるからよ']),
 ...boss(['…あ？']),...actor(3,['話し合いに','来たんだ']),...actor(3,['村を襲ったことには','怒ってるけど…']),...actor(3,['でも…平和的に','解決できないかな？']),
 ...boss(['…作戦失敗か']),...boss(['なら、こうする','しかねェな']),
 ...js('KNH_CastleUpper.clearMessage();'),...pose('inject'),se('Equip1',80),wait(18),se('Poison',70),wait(24),
 ...actor(3,['何をしたの！？']),...pose('mad'),
 ...boss(['……','これでいい']),...boss(['これで','テメェらと戦える']),...boss(['クソども！！','ぶっ殺してやる！！！'],true),
 ...js('KNH_CastleUpper.clearMessage();'),...pose('attack'),se('Blow1',85),wait(18),
 c(301,[0,48,false,false]),...after
];
const[a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[3,5,7,8].map(id=>[id,map.events[id]]))+text.slice(b);
const plugin=path.join(root,'js/plugins/KNH_ZXC_CastleUpper.js'),pb=fs.readFileSync(plugin),pc=pb.toString('utf8'),nl=pc.includes('\r\n')?'\r\n':'\n',marker='    // This guest uses an actual Game_Actor';assert.ok(pc.includes(marker)&&!pc.includes('api.thronePose ='));
const helper=fs.readFileSync(path.join(__dirname,'tsunehi_prelude_helpers.txt'),'utf8').replace(/\r?\n/g,nl);
assert.ok(fs.readFileSync(file).equals(before),'Concurrent map edit');assert.ok(fs.readFileSync(plugin).equals(pb),'Concurrent plugin edit');
fs.writeFileSync(file,updated);fs.writeFileSync(plugin,pc.replace(marker,helper+marker));
console.log('Saved throne prebattle dialogue and native pose/staging flow; battle 48 and completion state retained');
