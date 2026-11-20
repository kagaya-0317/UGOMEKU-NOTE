const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const manifest=path.join(__dirname,'artist_sources.json'),log=path.join(os.tmpdir(),'castle-artist-export-'+process.pid+'.log');
const r=spawnSync('C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe',['--batch','--script-param','manifest='+manifest,'--script-param','log='+log,'--script',path.join(__dirname,'export_artist_sources.lua')],{encoding:'utf8',windowsHide:true});
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');assert.equal(r.status,0);assert.equal(fs.readFileSync(log,'utf8'),'OK');
console.log('Done. Reopen the playtest to load exported artwork.');
