const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect}=require('../gnuro_prebattle/client.cjs');
async function prepare(){const q=await connect('beast-silent-capture-qa');try{await q.ready();await q.call('Page.reload');await q.ready();
 await q.evaluate('DataManager.setupNewGame();$gameParty._actors=[2,3,4];$gamePlayer.refresh();$gameVariables.setValue(63,2);$gameVariables.setValue(64,0);true');await q.evaluate(fs.readFileSync(path.resolve(__dirname,'../gnuro_prebattle/driver.js'),'utf8'));
 await q.evaluate('(async function(){if(WebAudio._context.state!=="running")await WebAudio._context.resume();return true;})()');
 await q.map(60,6,18.5);await q.until('AudioManager._bgmBuffer instanceof WebAudio&&AudioManager._bgmBuffer.isReady()&&AudioManager._bgmBuffer.isPlaying()','native BGM');
 await q.until('(function(){var a=__beastCaptureAudio.analyser,v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);return v.some(n=>Math.abs(n)>.001);})()','audio reaches recording-only output');
 const sound=await q.evaluate('(function(){var a=__beastCaptureAudio.analyser,v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);var rms=Math.sqrt(v.reduce((s,n)=>s+n*n,0)/v.length);return {pcOutputMuted:__beastCaptureAudio.pcOutputMuted,speakerGain:__beastCaptureAudio.silentMonitor.gain.value,blockedSpeakerConnections:__beastCaptureAudio.blockedSpeakerConnections,context:WebAudio._context.state,track:__beastCaptureAudio.destination.stream.getAudioTracks()[0].readyState,rms:rms,bgm:AudioManager._currentBgm.name};})()');
 assert.equal(sound.pcOutputMuted,true);assert.equal(sound.speakerGain,0);assert.equal(sound.context,'running');assert.equal(sound.track,'live');assert.ok(sound.rms>0);console.log('Silent PC / live movie audio '+JSON.stringify(sound));return {q,sound};
}catch(error){try{await q.call('Browser.close');}catch(_){}q.ws.close();throw error;}
}
module.exports={prepare};
