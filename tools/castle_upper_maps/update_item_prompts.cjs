// Patch only the two requested item-selection events, preserving other bytes.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {keySpan,patchRecords}=require('./implement_events.cjs');
const c=(code,parameters=[],indent=0)=>({code,indent,parameters});
function patch(file,id,edit){const before=fs.readFileSync(file),text=before.toString('utf8'),map=JSON.parse(text),event=map.events[id];edit(event);const[a,b]=keySpan(text,'events');const result=text.slice(0,a)+patchRecords(text.slice(a,b),[[id,event]])+text.slice(b);assert.ok(fs.readFileSync(file).equals(before),'Concurrent map edit: '+file);fs.writeFileSync(file,result);console.log('Patched '+file+' event '+id);}
patch('data/Map060.json',8,event=>{
 const list=event.pages[0].list;
 for(const command of list){if(command.code===401&&command.parameters[0]==='1つ目の鍵を選んでください')command.parameters[0]='カギを選ぼう';if(command.code===401&&command.parameters[0]==='2つ目の鍵を選んでください')command.parameters[0]='カギをもう1本選ぼう';}
 assert.ok(list.some(command=>command.code===401&&command.parameters[0]==='カギを選ぼう'));
 if(!list.some(command=>command.code===401&&command.parameters[0]==='カギがかかっているようだ'))list.unshift(c(355,['KNH_CastleUpper.systemMessage(); $gameMessage._popupHeight = 0;']),c(101,['',0,0,2]),c(401,['カギがかかっているようだ']),c(401,['カギ穴が2つある']),c(355,['KNH_CastleUpper.clearMessage();']));
});
patch('data/Map049.json',14,event=>{
 const list=event.pages[0].list,index=list.findIndex(command=>command.code===104);assert.ok(index>=0);
 if(list.some(command=>command.code===401&&command.parameters[0]==='リップクリームを渡そう'))return;
 const indent=list[index].indent;
 // Use this map's existing paired system-message common events and restore the NPC tail.
 list.splice(index+1,0,c(117,[6],indent),c(355,['$gameMessage._tailDir = 9;'],indent));
 list.splice(index,0,c(117,[5],indent),c(355,['$gameMessage._tailDir = 5; $gameMessage._popupHeight = 0;'],indent),c(101,['',0,0,2],indent),c(401,['リップクリームを渡そう'],indent));
});
