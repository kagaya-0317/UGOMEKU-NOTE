const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('./implement_events.cjs');
const root=path.resolve(__dirname,'../..'),plugin=path.join(root,'js/plugins/KNH_ZXC_CastleUpper.js'),before=fs.readFileSync(plugin);let code=before.toString('utf8');const nl=code.includes('\r\n')?'\r\n':'\n';
function replace(a,b){a=a.replace(/\n/g,nl);b=b.replace(/\n/g,nl);assert.ok(code.includes(a),'Missing plugin anchor: '+a.slice(0,80));code=code.replace(a,b);}
replace('function sceneProxies() {\n        return $gameMap._events.filter(function(event) {\n            return event && event.event().meta && event.event().meta.castleUpperActor;\n        });\n    }','function sceneProxies(eventId) {\n        var proxies = $gameMap._events.filter(function(event) {\n            return event && event.event().meta && event.event().meta.castleUpperActor;\n        });\n        var scoped = proxies.filter(function(event) { return Number(event.event().meta.castleUpperScene) === eventId; });\n        return scoped.length ? scoped : proxies.filter(function(event) { return !event.event().meta.castleUpperScene; });\n    }');
replace('api.beginScene = function(eventId, preserveMoveSpeed) {','api.beginScene = function(eventId, preserveMoveSpeed, options) {\n        options = options || {};');
replace('var proxies = sceneProxies();','var proxies = sceneProxies(eventId);');
replace('camera: ($gamePlayer._centerXy || [0, 0]).slice()','camera: ($gamePlayer._centerXy || [0, 0]).slice(),\n            playerReturn: options.returnPlayer ? {x: $gamePlayer._realX, y: $gamePlayer._realY, direction: $gamePlayer.direction()} : null');
replace('if (!follower) return;\n            var target = proxy._castleUpperStandPoint;','if (!follower || (options.returnPlayer && !state.followers)) return;\n            var target = proxy._castleUpperStandPoint;');
replace('state.members.push({actorId: actorId, eventId: proxy.eventId()});','state.members.push({actorId: actorId, eventId: proxy.eventId(),\n                returnPoint: options.returnPlayer ? {x: follower._realX, y: follower._realY, direction: follower.direction()} : null});');
replace('state.returning = true;','state.returning = true;\n        if (state.playerReturn) $gamePlayer.goTo(state.playerReturn.x, state.playerReturn.y);');
replace('if (follower && proxy) proxy.goToCharacter(follower);','if (follower && proxy) {\n                if (member.returnPoint) proxy.goTo(member.returnPoint.x, member.returnPoint.y);\n                else proxy.goToCharacter(follower);\n            }');
replace('if (state.members.some(function(member) {','if (state.playerReturn && $gamePlayer.isMoving()) return true;\n        if (state.members.some(function(member) {');
replace('if (follower && proxy) proxy.setDirection(follower.direction());','if (follower && proxy) proxy.setDirection(member.returnPoint ? member.returnPoint.direction : follower.direction());');
replace('        return false;\n    };\n    var waitMode = Game_Interpreter.prototype.updateWaitMode;','        if (state.playerReturn) $gamePlayer.setDirection(state.playerReturn.direction);\n        return false;\n    };\n    var waitMode = Game_Interpreter.prototype.updateWaitMode;');
replace('sceneProxies().forEach(function(proxy) { proxy.setTransparent(true); });','sceneProxies(state.eventId).forEach(function(proxy) { proxy.setTransparent(true); });');
const start=code.indexOf('    api.beginGate = function('),end=code.indexOf('    var gateCharacterFrame =',start);assert.ok(start>=0&&end>start);
const helpers=fs.readFileSync(path.join(__dirname,'gate_staging_helpers.txt'),'utf8').replace(/\r?\n/g,nl);code=code.slice(0,start)+helpers+code.slice(end);
const mapFile=path.join(root,'data/Map060.json'),mapBefore=fs.readFileSync(mapFile),text=mapBefore.toString('utf8'),map=JSON.parse(text),gate=map.events[8];assert.equal(map.events.length,13,'Recheck event IDs before appending');
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
let list=gate.pages[0].list,index=list.findIndex(c=>c.code===355&&c.parameters[0]==='KNH_CastleUpper.beginGate(this.eventId());');assert.ok(index>=0);
list[index].parameters[0]+='\nthis.setWaitMode("castleUpperFormation");';
// RPG Maker script continuation is a native 655 command.
list[index].parameters[0]='KNH_CastleUpper.beginGate(this.eventId());';list.splice(index+1,0,c(655,['this.setWaitMode("castleUpperFormation");']),c(355,['KNH_CastleUpper.focusGate(this.eventId());']));
index=list.findIndex(c=>c.code===355&&c.parameters[0]==='KNH_CastleUpper.endGate();');assert.ok(index>=0);list.splice(index,0,c(355,['KNH_CastleUpper.returnScene();']),c(655,['this.setWaitMode("castleUpperReturn");']));
const appended=[3,4].map((actor,i)=>{const e=JSON.parse(JSON.stringify(map.events[9+i]));e.id=13+i;e.name=actor===3?'みぃー（扉演出）':'ゆめちゃん（扉演出）';e.x=i?27:24;e.y=14;e.note='<important><castleUpperActor:'+actor+'><castleUpperScene:8>';delete e.meta;delete e.metaArray;return e;});
const[a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[[8,gate]],appended)+text.slice(b);
assert.ok(fs.readFileSync(plugin).equals(before),'Concurrent plugin edit');assert.ok(fs.readFileSync(mapFile).equals(mapBefore),'Concurrent map edit');fs.writeFileSync(plugin,code);fs.writeFileSync(mapFile,updated);console.log('Gate staging installed; other map records and original placements retained');
