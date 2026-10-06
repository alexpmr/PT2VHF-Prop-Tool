export const BANDS = [
  ['160 m',1.8,2],['80 m',3.5,4],['60 m',5.25,5.45],['40 m',7,7.3],
  ['30 m',10.1,10.15],['20 m',14,14.35],['17 m',18.068,18.168],
  ['15 m',21,21.45],['12 m',24.89,24.99],['11 m',26.965,27.855],['10 m',28,29.7],
  ['6 m',50,54],['2 m',144,148],['70 cm',430,440]
].map(([name,low,high])=>({name,low:low*1e6,high:high*1e6}));
export const DEFAULT_SETTINGS = {
  callsign:'',lat:null,lon:null,power:100,antennas:Object.fromEntries(BANDS.map(b=>[b.name,{type:'Vertical'}])),
  visible:BANDS.map(b=>b.name),alertBands:[],alertMinScore:65,
  alertMinDistance:800,alertCooldown:30,windowMinutes:30,
  updateMinutes:5,nearbyRadius:300,language:'pt-BR',theme:'dark'
};
export function coordinates(lat,lon) {
  return typeof lat==='number' && typeof lon==='number' && Number.isFinite(lat) && Number.isFinite(lon) && lat>=-90 && lat<=90 && lon>=-180 && lon<=180;
}
export function toGrid(lat,lon) {
  if (!coordinates(lat,lon)) throw new Error('Coordenadas inválidas');
  const x=Math.min(lon+180,359.999999), y=Math.min(lat+90,179.999999);
  return String.fromCharCode(65+Math.floor(x/20),65+Math.floor(y/10))+
    Math.floor(x%20/2)+Math.floor(y%10)+
    String.fromCharCode(65+Math.floor(x%2*12),65+Math.floor(y%1*24));
}
export function fromGrid(grid) {
  if (typeof grid!=='string' || !/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/i.test(grid)) return null;
  const g=grid.toUpperCase();
  let lon=(g.charCodeAt(0)-65)*20-180+Number(g[2])*2;
  let lat=(g.charCodeAt(1)-65)*10-90+Number(g[3]);
  let w=2,h=1;
  if(g.length>=6){w/=24;h/=24;lon+=(g.charCodeAt(4)-65)*w;lat+=(g.charCodeAt(5)-65)*h;}
  if(g.length===8){w/=10;h/=10;lon+=Number(g[6])*w;lat+=Number(g[7])*h;}
  return {lat:lat+h/2,lon:lon+w/2,precisionKm:Math.hypot(h*111,w*111*Math.cos(lat*Math.PI/180))};
}
const rad=n=>n*Math.PI/180;
export function distance(a,b) {
  const dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon);
  const x=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
export function bearing(a,b) {
  const dl=rad(b.lon-a.lon);
  return (Math.atan2(Math.sin(dl)*Math.cos(rad(b.lat)),Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(dl))*180/Math.PI+360)%360;
}
export function bandFor(freq) {return BANDS.find(b=>Number(freq)>=b.low && Number(freq)<=b.high)?.name??null;}
export function validateSettings(input) {
  const s={...DEFAULT_SETTINGS,...input};
  s.callsign=String(s.callsign||'').trim().toUpperCase();
  if(s.callsign && !/^[A-Z0-9/]{3,20}$/.test(s.callsign)) throw new Error('Indicativo inválido');
  if((s.lat!==null || s.lon!==null) && !coordinates(s.lat,s.lon)) throw new Error('Informe latitude e longitude válidas');
  for(const [name,min,max] of [['power',0,10000],['alertMinScore',0,100],['alertMinDistance',0,20040],['alertCooldown',1,1440],['windowMinutes',5,60],['updateMinutes',5,1440],['nearbyRadius',1,500]]) {
    if(typeof s[name]!=='number' || !Number.isFinite(s[name]) || s[name]<min || s[name]>max) throw new Error(`Valor inválido: ${name}`);
  }
  for(const field of ['visible','alertBands']) {
    if(!Array.isArray(s[field]) || s[field].some(v=>!BANDS.some(b=>b.name===v))) throw new Error('Seleção de bandas inválida');
    s[field]=[...new Set(s[field])];
  }
  if(!s.antennas || typeof s.antennas!=='object' || Array.isArray(s.antennas)) throw new Error('Antenas inválidas');
  s.antennas=Object.fromEntries(BANDS.map(b=>[b.name,{type:'Vertical',...s.antennas[b.name]}]));
  if(!['pt-BR','en','es','fr','de','it'].includes(s.language))throw new Error('Idioma inválido');
  if(!['dark','light'].includes(s.theme))throw new Error('Tema inválido');
  return s;
}
export function migrateSettings(input,schemaVersion=1) {
  const s={...input,antennas:{...input.antennas}};
  if(schemaVersion<2&&input.visible?.length===13&&BANDS.filter(b=>b.name!=='11 m').every(b=>input.visible.includes(b.name)))s.visible=[...input.visible,'11 m'];
  return validateSettings(s);
}
function unescapeXML(v) {
  return v.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,m=> {
    const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    if(named[m])return named[m];
    const code=m[2].toLowerCase()==='x'?parseInt(m.slice(3,-1),16):parseInt(m.slice(2,-1),10);
    return code>=0&&code<=0x10ffff?String.fromCodePoint(code):'';
  });
}
// Limited parser for the provider's flat receptionReport records. Reject DTD/entities.
export function parsePSK(xml) {
  if(typeof xml!=='string' || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<receptionReports(?:\s|\/|>)/.test(xml) || !(/<\/receptionReports>/.test(xml)||/<receptionReports\b[^>]*\/>/.test(xml))) throw new Error('Resposta PSK Reporter inválida');
  if(/<error\b/i.test(xml))throw new Error('PSK Reporter retornou erro');
  const result=[];
  for(const tag of xml.matchAll(/<receptionReport\b([^>]*?)\/?\s*>/g)) {
    const attrs={};
    for(const a of tag[1].matchAll(/([\w]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[a[1]]=unescapeXML(a[2]??a[3]);
    const frequency=Number(attrs.frequency), timestamp=Number(attrs.flowStartSeconds)*1000;
    if(!bandFor(frequency)||!Number.isFinite(timestamp)||timestamp<=0||!attrs.senderCallsign||!attrs.receiverCallsign)continue;
    const snr=attrs.sNR===undefined?null:Number(attrs.sNR);
    result.push({source:'PSK Reporter',evidence:'observed',timestamp,frequency,band:bandFor(frequency),
      tx:attrs.senderCallsign.toUpperCase(),rx:attrs.receiverCallsign.toUpperCase(),
      txGrid:attrs.senderLocator??'',rxGrid:attrs.receiverLocator??'',
      txPosition:fromGrid(attrs.senderLocator),rxPosition:fromGrid(attrs.receiverLocator),
      mode:attrs.mode||'Não informado',snr:Number.isFinite(snr)?snr:null,
      id:[attrs.senderCallsign.toUpperCase(),attrs.receiverCallsign.toUpperCase(),frequency,timestamp,attrs.mode||''].join('|')});
  }
  return result;
}
export function relevantSpots(spots,settings,scope,now=Date.now()) {
  if(!coordinates(settings.lat,settings.lon))return [];
  const home={lat:settings.lat,lon:settings.lon};
  const seen=new Set(),out=[];
  for(const spot of spots) {
    if(spot.timestamp>now+60000 || spot.timestamp<now-settings.windowMinutes*60000 || seen.has(spot.id))continue;
    seen.add(spot.id);
    const directTX=spot.tx===settings.callsign && Boolean(settings.callsign);
    const directRX=spot.rx===settings.callsign && Boolean(settings.callsign);
    let endpoint,direction,origin;
    if(directTX){endpoint=spot.rxPosition;direction='Sua transmissão recebida';origin='direct-tx';}
    else if(directRX){endpoint=spot.txPosition;direction='Recebido pela sua estação';origin='direct-rx';}
    else if(scope==='nearby' && spot.txPosition && distance(home,spot.txPosition)<=settings.nearbyRadius){endpoint=spot.rxPosition;direction='Transmissão de estação próxima';origin='nearby';}
    else continue;
    if(!endpoint)continue;
    out.push({...spot,endpoint,direction,origin,distance:distance(home,endpoint),bearing:bearing(home,endpoint)});
  }
  return out;
}
// Occupied cells only. No hull connecting distant receptions or smoothing into unsampled areas.
export function zonesFor(spots,band) {
  const cells=new Map();
  for(const s of spots.filter(v=>v.band===band)) {
    const x=Math.min(179,Math.floor((s.endpoint.lon+180)/2)),y=Math.min(89,Math.floor((s.endpoint.lat+90)/2));
    const key=`${x},${y}`;
    if(!cells.has(key))cells.set(key,{x,y,spots:[]});
    cells.get(key).spots.push(s);
  }
  const visited=new Set(),zones=[];
  for(const [key,start] of cells) {
    if(visited.has(key))continue;
    const queue=[start],group=[];visited.add(key);
    while(queue.length){const c=queue.pop();group.push(c);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n=`${c.x+dx},${c.y+dy}`;if(cells.has(n)&&!visited.has(n)){visited.add(n);queue.push(cells.get(n));}
    }}
    const reports=group.flatMap(c=>c.spots),pairs=new Set(reports.map(s=>s.tx+'|'+s.rx));
    if(pairs.size<3 || group.length<2)continue;
    // Remove shared edges, then stitch the exterior and any holes as independent closed rings.
    const edges=new Map();
    for(const c of group){const p=[[c.x,c.y],[c.x+1,c.y],[c.x+1,c.y+1],[c.x,c.y+1]];
      for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4],id=a+'>'+b,rev=b+'>'+a;if(edges.has(rev))edges.delete(rev);else edges.set(id,[a,b]);}
    }
    const rings=[];
    while(edges.size){const [id,edge]=edges.entries().next().value;edges.delete(id);const ring=[edge[0],edge[1]];
      while(String(ring.at(-1))!==String(ring[0])){const next=[...edges].find(([,e])=>String(e[0])===String(ring.at(-1)));if(!next)break;edges.delete(next[0]);ring.push(next[1][1]);}
      rings.push(ring.map(([x,y])=>[x*2-180,y*2-90]));
    }
    const outgoing=reports.filter(s=>s.origin==='direct-tx');
    zones.push({id:`${band}:${key}`,band,rings,reportCount:reports.length,pairs:pairs.size,evidence:'observed',
      directTX:outgoing.length>0,directTXPairs:new Set(outgoing.map(s=>s.tx+'|'+s.rx)).size,
      txMaxDistance:outgoing.length?Math.max(...outgoing.map(s=>s.distance)):0,
      latestTX:outgoing.length?Math.max(...outgoing.map(s=>s.timestamp)):0,lastEvidence:Math.max(...reports.map(s=>s.timestamp)),
      maxDistance:Math.max(...reports.map(s=>s.distance))});
  }
  return zones;
}
export function evaluateBand(spots,band,now=Date.now()) {
  const data=spots.filter(s=>s.band===band),pairs=new Set(data.map(s=>s.tx+'|'+s.rx));
  const latest=data.length?Math.max(...data.map(s=>s.timestamp)):null;
  // Evidence strength, not probability of a contact, mode conversion or physical propagation mechanism.
  const score=data.length?Math.round(Math.min(100,Math.log2(1+pairs.size)*18+Math.min(15,data.length/2))*Math.exp(-(now-latest)/(30*60000))):null;
  const state=score===null?'Sem evidências':score>=75?'Evidência forte':score>=45?'Evidência moderada':'Evidência limitada';
  const recent=data.filter(s=>s.timestamp>=now-10*60000).length;
  const previous=data.filter(s=>s.timestamp>=now-20*60000&&s.timestamp<now-10*60000).length;
  const trend=previous>=3?(recent>previous*1.25?'↑':recent<previous*.75?'↓':'→'):'—';
  return {band,state,score,pairs:pairs.size,reports:data.length,latest,trend,
    txReports:data.filter(s=>s.origin==='direct-tx').length,rxReports:data.filter(s=>s.origin==='direct-rx').length,
    zones:zonesFor(data,band)};
}
export function mergeSpots(existing,incoming,now=Date.now()) {
  const map=new Map();for(const s of [...existing,...incoming])if(s.timestamp>=now-24*3600000&&s.timestamp<=now+60000)map.set(s.id,s);
  return [...map.values()].sort((a,b)=>a.timestamp-b.timestamp).slice(-20000);
}
export class AlertMachine {
  constructor(){this.states=new Map();}
  update(bands,settings,now=Date.now(),healthy=true) {
    const alerts=[];
    for(const b of bands){const eligible=settings.alertBands.includes(b.band)&&healthy&&b.score!==null&&b.score>=settings.alertMinScore;
      const qualified=b.zones.some(z=>z.directTXPairs>=3&&z.txMaxDistance>=settings.alertMinDistance&&now-z.latestTX<10*60000);
      const open=eligible&&qualified,prev=this.states.get(b.band)||{active:false,last:0};
      if(open&&!prev.active&&(prev.last===0||now-prev.last>=settings.alertCooldown*60000)){alerts.push(b);prev.last=now;}
      // Failure or stale data suspends notifications, without inventing closure/reopening.
      if(healthy){if(open)prev.active=true;else if(b.score===null||b.score<settings.alertMinScore-10)prev.active=false;}
      this.states.set(b.band,prev);
    }
    return alerts;
  }
}
