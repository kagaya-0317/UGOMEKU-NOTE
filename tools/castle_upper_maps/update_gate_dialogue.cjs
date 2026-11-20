const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('./implement_events.cjs');
const root=path.resolve(__dirname,'../..'),mapFile=path.join(root,'data/Map060.json'),before=fs.readFileSync(mapFile),text=before.toString('utf8'),map=JSON.parse(text),gate=map.events[8],list=gate.pages[0].list;
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
const start=list.findIndex(v=>v.code===111&&v.parameters[1]==='KNH_CastleUpper.gateMiiSpeaker()'),end=list.findIndex((v,i)=>i>start&&v.code===412&&v.indent===0);assert.ok(start>=0&&end>start);
list.splice(start,end-start+1,
 c(111,[12,'KNH_CastleUpper.gateMiiSpeaker()']),c(101,['',0,0,2],1),c(401,['この先が魔王の部屋かな…'],1),
 c(111,[12,'KNH_CastleUpper.gateYumeSpeaker()'],1),c(101,['',0,0,2],2),c(401,['きっとそうよ'],2),c(401,['準備していきましょ'],2),c(412,[],1),c(412));
const[a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[[8,gate]])+text.slice(b);
const helper=[
'    api.gateYumeSpeaker = function() {',
'        var state = $gameTemp._castleUpperScene;',
'        if (!state || state.eventId !== 8 || state.mapId !== $gameMap.mapId()) return false;',
'        var member = state.members.filter(function(member) { return member.actorId === 4; })[0];',
'        var yume = member && $gameMap.event(member.eventId);',
'        if (!yume) return false;',
'        $gamePlayer.turnTowardCharacter(yume);',
'        state.members.forEach(function(member) {',
'            if (member.actorId === 3) {',
'                var mii = $gameMap.event(member.eventId);',
'                mii.turnTowardCharacter(yume);',
'                yume.turnTowardCharacter(mii);',
'            }',
'        });',
'        api.mapSpeaker(yume.eventId());',
'        $gameMessage._popupHeight = 0;',
'        return true;',
'    };',
''
].join('\n');
const files=['js/plugins/KNH_ZXC_CastleUpper.js','tools/castle_upper_maps/gate_staging_helpers.txt'].map(name=>{const file=path.join(root,name),bytes=fs.readFileSync(file),code=bytes.toString('utf8'),nl=code.includes('\r\n')?'\r\n':'\n',marker='    api.endGate = function() {';assert.ok(code.includes(marker)&&!code.includes('api.gateYumeSpeaker ='));return {file,bytes,updated:code.replace(marker,helper.replace(/\n/g,nl)+marker)};});
assert.ok(fs.readFileSync(mapFile).equals(before),'Concurrent map edit');for(const item of files)assert.ok(fs.readFileSync(item.file).equals(item.bytes),'Concurrent plugin edit');
for(const item of files)fs.writeFileSync(item.file,item.updated);fs.writeFileSync(mapFile,updated);console.log('Updated Mii line and actor-4 reply, preserving formation and return flow');
