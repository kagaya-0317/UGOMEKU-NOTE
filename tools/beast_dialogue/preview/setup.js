// QA only: keep the native mixed audio in the movie, with no speaker connection.
(function(){
    window.__beastCaptureSetup={script:document.currentScript&&document.currentScript.src};
    $plugins=$plugins.filter(function(p){return p.name!=='AudioStreaming';});
    var path=require('path'),fs=require('fs'),os=require('os');
    var saves=path.join(os.tmpdir(),'codex-beast-silent-capture-20261119-saves');
    if(!fs.existsSync(saves))fs.mkdirSync(saves);StorageManager.localFileDirectoryPath=function(){return saves+path.sep;};
    var nativeConnect=AudioNode.prototype.connect,contexts=new WeakMap();
    AudioNode.prototype.connect=function(destination){
        var context=destination&&destination.context;
        if(context&&destination===context.destination){
            var audio=contexts.get(context);
            if(!audio){
                audio={destination:context.createMediaStreamDestination(),analyser:context.createAnalyser(),silentMonitor:context.createGain(),pcOutputMuted:true,blockedSpeakerConnections:0};
                audio.analyser.fftSize=2048;contexts.set(context,audio);
                // Keep a real-time hardware clock, but send it only exact zeros.
                audio.silentMonitor.gain.setValueAtTime(0,context.currentTime);
                nativeConnect.call(audio.analyser,audio.destination);
                nativeConnect.call(audio.analyser,audio.silentMonitor);
                nativeConnect.call(audio.silentMonitor,context.destination);
            }
            audio.blockedSpeakerConnections++;window.__beastCaptureAudio=audio;
            nativeConnect.call(this,audio.analyser,arguments.length>1?arguments[1]:0,0);
            return destination;
        }
        return nativeConnect.apply(this,arguments);
    };
    if(WebAudio._masterGainNode){WebAudio._masterGainNode.disconnect();WebAudio._masterGainNode.connect(WebAudio._context.destination);}
})();
