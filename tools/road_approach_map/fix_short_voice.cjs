// Keep the full portrait above a one-line voice popup, just as for the laugh.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('../castle_upper_maps/implement_events.cjs'),pages=require('./intro_dialogue.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/road-approach-tsunehi-revised-video-20261120'),file='data/Map063.json';
const bytes=fs.readFileSync(path.join(root,file)),text=bytes.toString('utf8'),map=JSON.parse(text),event=structuredClone(map.events[3]),list=event.pages[0].list;
const target=pages.find(p=>p.speaker==='tsunehi'&&!p.laugh&&p.lines.length===1).lines[0],index=list.findIndex(c=>c.code===401&&c.parameters[0]===target);assert.ok(index>=0);
let script=index;while(script>=0&&list[script].code!==355)script--;assert.ok(script>=0);assert.equal(list[script].parameters[0],'KNH_CastleUpper.roadIntroVoice(false);');assert.notEqual(list[script+1].code,655);
list.splice(script+1,0,{code:655,indent:0,parameters:['$gameSystem.setMessagePopupFree($gameMap.getCenterXForUI(),180);']});
const [a,b]=keySpan(text,'events'),updated=text.slice(0,a)+patchRecords(text.slice(a,b),[[3,event]])+text.slice(b);
const sp='data/System.json',sb=fs.readFileSync(path.join(root,sp)),st=sb.toString('utf8'),system=JSON.parse(st),[x,y]=keySpan(st,'versionId');
const before=path.join(out,'headroom-fix-before');fs.mkdirSync(before,{recursive:true});fs.writeFileSync(path.join(before,'Map063.json'),bytes,{flag:'wx'});fs.writeFileSync(path.join(before,'System.json'),sb,{flag:'wx'});
assert.ok(fs.readFileSync(path.join(root,file)).equals(bytes));assert.ok(fs.readFileSync(path.join(root,sp)).equals(sb));fs.writeFileSync(path.join(root,file),updated);fs.writeFileSync(path.join(root,sp),st.slice(0,x)+JSON.stringify(system.versionId+1)+st.slice(y));
console.log(JSON.stringify({singleLineVoice:target,freePopupY:180,version:system.versionId+1}));
