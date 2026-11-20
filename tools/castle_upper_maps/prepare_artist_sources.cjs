const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),art=path.resolve(root,'../画像');
const exe='C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe';
const work=fs.mkdtempSync(path.join(os.tmpdir(),'castle-artist-sources-'));
const report=path.join(root,'artifacts/artist-sources-20261120');fs.mkdirSync(report,{recursive:true});
const assets=[];
function add(name,base,runtime,width,height,parts,cellWidth,cellHeight){
 const editable=path.join(art,base+'.aseprite');
 assets.push({name,editable,runtime:path.join(root,runtime),width,height,parts,cellWidth,cellHeight,proof:path.join(work,base+'.png')});
}
function part(name,file,sx,sy,w,h,x=0,y=0){return{name,file:path.resolve(root,file),sx,sy,w,h,x,y};}
for(const [base,name,w,h]of [['!map113','モーネの間',1000,1414],['!map114','モンスター城3階',2000,1414],['!map114_room','3階ギミック部屋',1000,1414],['!map115','玉座の間',1000,1414]])
 add(name,base,'img/parallaxes/'+base+'.png',w,h,[part('背景',path.join(art,base+'.aseprite'),0,0,w,h)]);
add('大きい扉','玉座の間_大扉','img/characters/castleThroneDoor.png',384,192,[part('閉じた扉','img/characters/outsideObject3.png',0,0,192,192),part('開いた扉','img/characters/outsideObject3.png',192,0,192,192,192,0)],192,192);
const walk=[];for(let y=0;y<4;y++)for(let x=0;x<3;x++)walk.push(part(['下','左','右','上'][y]+'_'+(x+1),'img/characters/$castleBeast_tmp.png',x*144,y*144,144,144,x*144,y*144));
add('死の猛獣・歩行','死の猛獣_歩行','img/characters/$castleBeast.png',432,576,walk,144,144);
add('死の猛獣・戦闘','死の猛獣_戦闘','img/sv_actors/castleBeast.png',144,144,[part('仲間側の立ち姿','img/sv_actors/castleBeast_tmp.png',0,0,144,144)],144,144);
const poses=[];
for(let i=0;i<3;i++)poses.push(part('正面_'+(i+1),'img/characters/$kanbu2.png',288*i,0,288,320,288*i,0));
for(let i=0;i<3;i++)poses.push(part('薬_'+(i+1),'img/characters/$castleTsunehi_vial_tmp.png',0,0,288,320,288*i,320));
for(let i=0;i<3;i++)poses.push(part('変化後_'+(i+1),'img/characters/$kanbu2_2.png',288*i,320,288,320,288*i,640));
poses.push(part('背面','img/characters/$castleTsunehi_back.png',0,0,288,320,0,960),part('攻撃','img/characters/$kanbu2.png',576,320,288,320,288,960),part('かがみ','img/characters/$kanbu2.png',0,320,288,320,576,960));
add('ツネヒ・マップ','ツネヒ_マップ','img/characters/$castleTsunehi.png',864,1280,poses,288,320);
for(const [base,jp]of [['castleMone_tmp','モーネ'],['castleTsunehi_tmp','ツネヒ']]){
 const parts=[];for(let y=0;y<8;y++)parts.push(part(['待機','ダメージ','笑顔','攻撃1','攻撃2','攻撃3','攻撃4','攻撃5'][y],'img/sv_enemies/'+base+'.png',0,y*144,144,144,0,y*144));
 add(jp+'・戦闘',jp+'_戦闘','img/sv_enemies/'+base+'.png',144,1152,parts,144,144);
}
add('城のカギ','城のカギ','img/items/Item9.png',576,288,[part('まるいカギ','img/items/Item9.png',0,0,144,144),part('さんかくのカギ','img/items/Item9.png',144,0,144,144,144,0)],144,144);
const before=new Map();for(const a of assets){if(fs.existsSync(a.editable)){assert(a.editable.includes('!map'),'Existing artist source: '+a.editable);const b=fs.readFileSync(a.editable);before.set(a.editable,b);fs.writeFileSync(path.join(work,path.basename(a.editable)),b);}}
const manifest={assets};fs.writeFileSync(path.join(work,'plan.json'),JSON.stringify(manifest));
const log=path.join(work,'prepare.log');
// Validate one representative before the full batch.
const sample={assets:[{...assets[5],editable:path.join(work,'sample.aseprite'),proof:path.join(work,'sample.png')}]};
fs.writeFileSync(path.join(work,'sample.json'),JSON.stringify(sample));
function run(plan){const r=spawnSync(exe,['--batch','--script-param','plan='+plan,'--script-param','log='+log,'--script',path.join(__dirname,'artist_sources.lua')],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(fs.readFileSync(log,'utf8'),'OK');}
run(path.join(work,'sample.json'));
for(const [file,bytes]of before)assert(fs.readFileSync(file).equals(bytes),'Concurrent edit: '+file);
run(path.join(work,'plan.json'));
fs.writeFileSync(path.join(__dirname,'artist_sources.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(report,'preparation.json'),JSON.stringify({work,assets:assets.map(a=>({name:a.name,editable:a.editable,runtime:a.runtime,width:a.width,height:a.height}))},null,2));
console.log(JSON.stringify({work,count:assets.length,report}));
