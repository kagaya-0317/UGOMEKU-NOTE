const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const manifest=path.join(__dirname,'artist_sources.json'),m=JSON.parse(fs.readFileSync(manifest,'utf8')),work=fs.mkdtempSync(path.join(os.tmpdir(),'castle-artist-export-test-')),log=path.join(work,'verify.log'),testSource=path.join(work,'test-cleanup.aseprite');
const exe='C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe';
function run(script,params){const args=['--batch'];for(const[k,v]of Object.entries(params))args.push('--script-param',k+'='+v);args.push('--script',path.join(__dirname,script));const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(fs.readFileSync(log,'utf8'),'OK');console.log(r.stdout.trim());}
run('verify_artist_sources.lua',{manifest,log,testSource});
const runtime=path.join(work,'test-cleanup.png'),testManifest=path.join(work,'test-export.json');fs.writeFileSync(testManifest,JSON.stringify({assets:[{...m.assets[6],editable:testSource,runtime}]}));
run('export_artist_sources.lua',{manifest:testManifest,log});assert(fs.existsSync(runtime));
run('verify_artist_sources.lua',{manifest,log,testOutput:runtime});
fs.writeFileSync(path.join(work,'test-result.json'),JSON.stringify({nativeReopen:true,draftPixelsMatchAllRuntimeImages:true,blankCleanupSkipped:true,paintedCleanupExported:true}));
console.log('PASS native sources, current runtime equivalence, blank protection and cleanup export.');
