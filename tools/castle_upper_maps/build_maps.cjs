// Create background-only maps. Existing events and progression data are untouched.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'artifacts/castle-upper-maps-implementation-20261118');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const specs = [
  {id:59, name:'113.モーネの間', parentId:33, image:'!map113', width:21, ref:[1067,1474],
    floors:[[[236,727],[435,593],[683,593],[887,727],[887,1095],[805,1180],[805,1315],[732,1387],[400,1387],[326,1310],[326,1291],[178,1291],[178,1241],[326,1241],[236,1105]], [[455,244],[666,244],[666,630],[455,630]]],
    blocks:[], probes:[[3,24.5],[10,22],[10,16],[10,11],[10,5.5]]},
  {id:60, name:'114.モンスター城 3F', parentId:33, image:'!map114', width:41, ref:[1491,1055],
    floors:[[[448,434],[1040,434],[1040,625],[1335,625],[1335,724],[1110,724],[1050,831],[650,831],[650,968],[464,968],[464,831],[360,831],[310,748],[145,748],[145,630],[316,630],[316,600],[448,600]], [[80,370],[357,370],[376,414],[376,501],[306,572],[306,644],[168,644],[80,563]], [[172,568],[284,568],[284,706],[172,706]], [[1090,432],[1424,432],[1424,486],[1285,486],[1285,533],[1199,533],[1199,486],[1090,486]], [[1207,508],[1282,508],[1282,646],[1207,646]], [[835,252],[1015,252],[1015,440],[835,440]]],
    blocks:[[[202,326],[258,326],[258,375],[202,375]]], probes:[[14.5,25],[20,18],[20,12],[25,9],[7,18],[5,15],[6,11],[34,18],[34,15],[37,12],[32,12]]},
  {id:61, name:'3F ギミック部屋', parentId:60, image:'!map114_room', width:21, ref:[1067,1474],
    floors:[[[106,456],[326,456],[326,560],[736,560],[736,554],[967,554],[967,674],[828,674],[828,976],[967,976],[967,1253],[850,1253],[850,1320],[753,1320],[753,1253],[287,1253],[287,1320],[180,1320],[180,1253],[106,1253],[106,976],[242,976],[242,674],[106,674]], [[386,424],[386,372],[465,345],[602,345],[682,372],[682,567],[386,567]]],
    blocks:[[[307,724],[409,724],[409,762],[307,762]], [[657,724],[752,724],[752,762],[657,762]], [[285,1050],[435,1050],[435,1083],[285,1083]], [[415,948],[436,948],[436,1083],[415,1083]], [[630,948],[650,948],[650,1083],[630,1083]], [[630,1050],[785,1050],[785,1083],[630,1083]]],
    probes:[[15.5,25],[10,23],[7,18],[13.5,18],[8,12],[12,12],[10,8],[4,25]]},
  {id:62, name:'115.玉座の間', parentId:33, image:'!map115', width:21, ref:[1067,1474],
    floors:[[[159,574],[366,411],[695,411],[910,574],[910,1212],[819,1280],[591,1280],[591,1340],[477,1340],[477,1280],[246,1280],[159,1212]], [[410,461],[654,461],[654,568],[410,568]], [[391,369],[677,369],[677,459],[391,459]]],
    blocks:[[[228,574],[293,574],[293,733],[228,733]], [[785,574],[847,574],[847,733],[785,733]], [[228,782],[293,782],[293,913],[228,913]], [[785,782],[847,782],[847,913],[785,913]], [[228,989],[293,989],[293,1112],[228,1112]], [[785,989],[847,989],[847,1112],[785,1112]], [[481,280],[590,280],[590,430],[481,430]]],
    probes:[[10,25.5],[10,23],[10,17],[10,12],[10,9],[8,7.5],[12,7.5]]}
];
function inside(p, poly) {
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a[1]>p[1]) !== (b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}
const masks = {0:[],1:[274],2:[272],3:[273],4:[258],5:[266],6:[272,258],7:[273,266],8:[256],9:[274,256],10:[264],11:[273,264],12:[257],13:[257,266],14:[257,264],15:[265]};
function build(spec) {
  const map=read('data/Map054.json');
  delete map.meta; delete map.metaArray;
  Object.assign(map,{width:spec.width,height:30,note:'<noFront>',displayName:'',parallaxName:spec.image,parallaxShow:true,parallaxLoopX:false,parallaxLoopY:false,parallaxSx:0,parallaxSy:0,scrollType:0,encounterList:[],events:[null]});
  const size=map.width*map.height;
  map.data=new Array(size*6).fill(0);
  map.data.fill(2816,0,size);
  const sx=spec.ref[0]/(spec.width===41?2000:1000),sy=spec.ref[1]/1414;
  const floor=(x,y)=>spec.floors.some(p=>inside([x*sx,y*sy],p)) && !spec.blocks.some(p=>inside([x*sx,y*sy],p));
  for(let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) {
    let mask=0;
    for(let q=0;q<4;q++) if(!floor((x+0.5+(q%2)*0.5)*48,(y+0.5+Math.floor(q/2)*0.5)*48))mask|=1<<q;
    const ids=masks[mask];
    map.data[(3*map.height+y)*map.width+x]=ids[0]||0;
    map.data[(2*map.height+y)*map.width+x]=ids[1]||0;
  }
  return map;
}
function main() {
  const maps=specs.map(s=>({spec:s,map:build(s)}));
  for(const {spec,map} of maps) {
    assert.equal(map.events.length,1);
    const png=fs.readFileSync(path.join(root,'img/parallaxes',spec.image+'.png'));
    assert.equal(png.readUInt32BE(16),spec.width===41?2000:1000);
    assert.equal(png.readUInt32BE(20),1414);
  }
  if(!process.argv.includes('--write')) {console.log(JSON.stringify(specs,null,2));return;}
  fs.mkdirSync(output,{recursive:true});
  const manifestPath=path.join(output,'manifest.json');
  const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath)):null;
  const mapInfoPath=path.join(root,'data/MapInfos.json');
  const infoBytes=fs.readFileSync(mapInfoPath),infoText=infoBytes.toString('utf8');
  const infos=JSON.parse(infoText.replace(/^\uFEFF/,''));
  const newline=infoText.includes('\r\n')?'\r\n':'\n';
  const newInfos=[];
  for(const {spec,map} of maps) {
    const relative='data/Map'+String(spec.id).padStart(3,'0')+'.json';
    const target=path.join(root,relative);
    if(fs.existsSync(target)) {
      assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).events.filter(Boolean).length,0,'Background-only builder cannot overwrite event maps: '+relative);
      const old=previous&&previous.maps.find(m=>m.id===spec.id);
      assert.ok(old&&sha(fs.readFileSync(target))===old.sha256,'Map changed outside this build: '+relative);
    } else assert.ok(!infos[spec.id],'Map id already used: '+spec.id);
    if(!infos[spec.id])newInfos.push({id:spec.id,expanded:spec.id===60,name:spec.name,order:spec.id,parentId:spec.parentId,scrollX:spec.width===41?1618:1404,scrollY:spec.width===41?876:768});
  }
  if(!previous)fs.writeFileSync(path.join(output,'MapInfos.before.json'),infoBytes,{flag:'wx'});
  const records=[];
  for(const {spec,map} of maps) {
    const file='data/Map'+String(spec.id).padStart(3,'0')+'.json';
    const bytes=Buffer.from(JSON.stringify(map)+'\n','utf8');
    fs.writeFileSync(path.join(root,file),bytes);
    records.push({id:spec.id,name:spec.name,file,background:'img/parallaxes/'+spec.image+'.png',source:'../aseprite/'+spec.image+'.aseprite',sha256:sha(bytes),events:0,progression:false,probes:spec.probes});
  }
  if(newInfos.length) {
    assert.ok(fs.readFileSync(mapInfoPath).equals(infoBytes),'MapInfos changed concurrently');
    const close=infoText.lastIndexOf(']');
    let at=close;while(at>0&&/\s/.test(infoText[at-1]))at--;
    const updated=infoText.slice(0,at)+','+newline+newInfos.map(x=>JSON.stringify(x)).join(','+newline)+infoText.slice(at);
    assert.equal(JSON.parse(updated.replace(/^\uFEFF/,'')).length,63);
    fs.writeFileSync(mapInfoPath,updated,'utf8');
  }
  fs.writeFileSync(manifestPath,JSON.stringify({maps:records,scope:'Backgrounds, map registration and static walkability only. No events, transfers, items, switches or progression logic.'},null,2)+'\n','utf8');
  console.log(JSON.stringify(records,null,2));
}
if(require.main===module)main();
module.exports={specs,build};
