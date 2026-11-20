const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../beast_dialogue/capture_client.cjs');
async function main(){const{q}=await prepare();try{
 await q.evaluate('$gameVariables.setValue(64,2);$gameVariables.setValue(66,1);true');await q.map(60,25.5,16.5);const walked=[];
 for(const[x,y]of [[24,14],[27,14],[25.5,13.5],[25.5,12],[25.5,16.5]]){
  await q.evaluate(`__gnuroIntroQA.route(${x},${y});true`);await q.until('!__gnuroIntroQA.walking&&!$gamePlayer.isMoving()','normal walking to '+x+','+y);const point=await q.evaluate('[$gamePlayer.x,$gamePlayer.y,$gamePlayer.isThrough()]');assert.deepEqual(point,[x,y,false]);walked.push(point);
 }
 const out=path.resolve(__dirname,'../../artifacts/throne-gate-staging-20261119/floor-verification.json');fs.writeFileSync(out,JSON.stringify({nativeWalking:walked,throughEnabled:false},null,2));console.log('PASS normal collision and walking across all formation/return positions');
 }finally{try{await q.call('Browser.close');}catch(_){}q.ws.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
