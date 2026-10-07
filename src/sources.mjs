import {parsePSK,bandFor,fromGrid,coordinates,distance} from './domain.mjs';
import {APP_VERSION} from './version.mjs';
export const PSK_INTERVAL=300000;
export const IONO_INTERVAL=900000;
export const NOAA_INTERVAL=300000;
export const RBN_INTERVAL=300000;
export const WSPR_INTERVAL=300000;
export const PSK_REPORT_LIMIT=3000;
export const WSPR_REPORT_LIMIT=3000;
export function observationWindowSeconds(settings){
  const minutes=Number(settings?.windowMinutes);
  if(!Number.isFinite(minutes)||minutes<5||minutes>1440)throw new Error('Janela de observação inválida');
  return Math.round(minutes*60);
}
export function pskQueryPlan(settings,coverage,now=Date.now(),refreshMs=PSK_INTERVAL,grid=''){
  const windowSeconds=observationWindowSeconds(settings),windowMs=windowSeconds*1000,neededFrom=now-windowMs;
  const sameGrid=Boolean(coverage)&&(!grid||coverage.grid===grid);
  const complete=sameGrid&&Number.isFinite(coverage.from)&&Number.isFinite(coverage.to)&&coverage.from<=neededFrom&&coverage.to>=now-Math.max(refreshMs*1.5,PSK_INTERVAL);
  if(!complete)return {mode:'backfill',seconds:windowSeconds,from:neededFrom,to:now,windowMinutes:Number(settings.windowMinutes)};
  const gapSeconds=Math.max(0,Math.ceil((now-coverage.to)/1000)),seconds=Math.min(windowSeconds,Math.max(300,gapSeconds+120));
  return {mode:'incremental',seconds,from:now-seconds*1000,to:now,windowMinutes:Number(settings.windowMinutes)};
}
export function pskURL(settings,scope='nearby',lookbackSeconds=observationWindowSeconds(settings)) {
  const requested=Math.max(300,Math.min(86400,Math.round(Number(lookbackSeconds)||observationWindowSeconds(settings))));
  const q=new URLSearchParams({flowStartSeconds:String(-requested),rronly:'1',noactive:'1',rptlimit:String(PSK_REPORT_LIMIT)});
  if(scope==='nearby') {
    if(!settings.grid)throw new Error('Localização da estação necessária');
    q.set('callsign',settings.grid.slice(0,4));q.set('modify','grid');
  } else {
    if(!settings.callsign)throw new Error('Informe seu indicativo');
    q.set('callsign',settings.callsign);
  }
  return 'https://retrieve.pskreporter.info/query?'+q.toString();
}
const AUTHORIZED_HOSTS=new Set(['retrieve.pskreporter.info','services.swpc.noaa.gov','api.github.com','vailrerbn.com','db1.wspr.live','prop.kc2g.com']);
const MAX_RESPONSE_BYTES=6e6,MAX_REDIRECTS=3,LOG_PREVIEW_BYTES=8192;
function sourceName(host){return host==='retrieve.pskreporter.info'?'PSK Reporter':host==='services.swpc.noaa.gov'?'NOAA SWPC':host==='api.github.com'?'GitHub':host==='vailrerbn.com'?'Reverse Beacon Network':host==='db1.wspr.live'?'WSPR.live':host==='prop.kc2g.com'?'KC2G / GIRO':'HTTP';}
function validateEndpoint(value){const u=value instanceof URL?value:new URL(value);if(u.protocol!=='https:'||u.username||u.password||!AUTHORIZED_HOSTS.has(u.hostname))throw new Error('Fonte não autorizada');return u;}
export async function boundedFetch(url,format='text',fetchImpl=fetch,activity=()=>{}) {
  let current=validateEndpoint(url),response,redirects=0;const started=Date.now(),method='GET';
  activity({timestamp:started,direction:'TX',source:sourceName(current.hostname),method,url:current.toString()});
  try{
    while(true){
      response=await fetchImpl(current.toString(),{signal:AbortSignal.timeout(15000),redirect:'manual',headers:{'User-Agent':'PT2VHF-Prop-Tool/'+APP_VERSION,'Accept':format==='json'?'application/json':'application/xml, text/xml;q=0.9, */*;q=0.1'}});
      if(response.status<300||response.status>=400)break;
      const location=response.headers.get('location');if(!location||redirects++>=MAX_REDIRECTS)throw new Error('Redirecionamento inválido');
      const next=validateEndpoint(new URL(location,current));activity({timestamp:Date.now(),direction:'INFO',source:sourceName(current.hostname),status:response.status,url:current.toString(),detail:'redirect -> '+next.toString()});current=next;
    }
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    if(Number(response.headers.get('content-length')||0)>MAX_RESPONSE_BYTES)throw new Error('Resposta excede o limite');
    let bytes;
    if(response.body?.getReader){
      const reader=response.body.getReader();let size=0;const chunks=[];
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_RESPONSE_BYTES)throw new Error('Resposta excede o limite');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
      bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    }else{bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>MAX_RESPONSE_BYTES)throw new Error('Resposta excede o limite');}
    const text=new TextDecoder().decode(bytes);
    activity({timestamp:Date.now(),direction:'RX',source:sourceName(current.hostname),method,status:response.status,url:current.toString(),bytes:bytes.length,durationMs:Date.now()-started,payload:text.slice(0,LOG_PREVIEW_BYTES),truncated:text.length>LOG_PREVIEW_BYTES});
    return format==='json'?JSON.parse(text):text;
  }catch(error){
    activity({timestamp:Date.now(),direction:'RX',source:sourceName(current.hostname),method,status:'ERROR',url:current.toString(),durationMs:Date.now()-started,error:error.message});
    throw error;
  }
}
function timestamp(value){
  if(typeof value!=='string')return NaN;
  const iso=value.replace(' ','T');return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso)?iso:iso+'Z');
}
export function parseKp(rows) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('Kp indisponível');
  let data;
  if(Array.isArray(rows[0])){
    const header=rows[0],t=header.indexOf('time_tag'),k=header.indexOf('Kp');
    if(t<0||k<0)throw new Error('Formato Kp desconhecido');
    data=rows.slice(1).map(row=>({time:row[t],raw:row[k]}));
  }else{data=rows.map(row=>({time:row.time_tag,raw:row.Kp??row.kp_index??row.kp}));}
  const valid=data.flatMap(({time,raw})=>{
    if(raw===null||raw===undefined||raw==='')return [];
    const value=Number(raw),when=timestamp(time);
    return Number.isFinite(value)&&value>=0&&value<=9&&Number.isFinite(when)?[{value,timestamp:when,evidence:'measured',source:'NOAA SWPC'}]:[];
  }).sort((a,b)=>a.timestamp-b.timestamp);
  if(!valid.length)throw new Error('Kp inválido');return valid.at(-1);
}
export function parseF107(rows){
  const row=Array.isArray(rows)?rows.at(-1):null,value=Number(row?.flux),when=timestamp(row?.time_tag);
  if(!Number.isFinite(value)||value<40||value>500||!Number.isFinite(when))throw new Error('F10.7 inválido');
  return {value,timestamp:when,evidence:'measured',source:'NOAA SWPC'};
}
export function parseSolarWindMag(rows){
  const row=Array.isArray(rows)?rows.at(-1):null,bz=Number(row?.bz_gsm),bt=Number(row?.bt),when=timestamp(row?.time_tag);
  if(!Number.isFinite(bz)||!Number.isFinite(bt)||!Number.isFinite(when))throw new Error('Campo magnético solar inválido');
  return {bz:{value:bz,timestamp:when,evidence:'measured',source:'NOAA SWPC'},bt:{value:bt,timestamp:when,evidence:'measured',source:'NOAA SWPC'}};
}
export function parseSolarWindSpeed(rows){
  const row=Array.isArray(rows)?rows.at(-1):null,value=Number(row?.proton_speed),when=timestamp(row?.time_tag);
  if(!Number.isFinite(value)||value<0||value>5000||!Number.isFinite(when))throw new Error('Vento solar inválido');
  return {value,timestamp:when,evidence:'measured',source:'NOAA SWPC'};
}
export function parseXray(rows){
  const row=Array.isArray(rows)?rows.at(-1):null,cls=String(row?.current_class||'').toUpperCase(),when=timestamp(row?.time_tag);
  if(!/^[ABCMX]\d+(?:\.\d+)?$/.test(cls)||!Number.isFinite(when))throw new Error('Raios X inválidos');
  return {class:cls,timestamp:when,evidence:'measured',source:'NOAA SWPC'};
}
export async function loadPSK(settings,scope,lookbackSeconds,fetchImpl,activity) {return parsePSK(await boundedFetch(pskURL(settings,scope,lookbackSeconds),'text',fetchImpl,activity));}
export function parseRBN(payload){
  const rows=Array.isArray(payload)?payload:Array.isArray(payload?.spots)?payload.spots:[];
  const out=[];
  for(const row of rows){
    const frequency=Number(row.frequency)*1000,when=Date.parse(row.timestamp),band=bandFor(frequency);
    const tx=String(row.callsign||'').trim().toUpperCase(),rx=String(row.spotter||'').trim().toUpperCase();
    if(!band||!Number.isFinite(when)||!tx||!rx)continue;
    const snr=Number(row.snr),txGrid=String(row.grid||''),rxGrid=String(row.spotter_grid||'');
    out.push({source:'Reverse Beacon Network',evidence:'observed',timestamp:when,frequency,band,tx,rx,
      txGrid,rxGrid,txPosition:fromGrid(txGrid),rxPosition:fromGrid(rxGrid),mode:String(row.mode||'CW'),snr:Number.isFinite(snr)?snr:null,
      id:'RBN|'+String(row.id??[tx,rx,frequency,when,row.mode||''].join('|'))});
  }
  return out;
}
export const RBN_BAND_CODES={'160 m':'160m','80 m':'80m','60 m':'60m','40 m':'40m','30 m':'30m','20 m':'20m','17 m':'17m','15 m':'15m','12 m':'12m','10 m':'10m','6 m':'6m'};
export function rbnURLs(settings={},now=Date.now(),offset=0){
  const since=Math.floor((now-Math.max(5,Math.min(60,Number(settings.windowMinutes)||30))*60000)/1000);
  const visible=(Array.isArray(settings.visible)?settings.visible:[]).map(v=>RBN_BAND_CODES[v]).filter(Boolean);
  return [...new Set(visible)].map(band=>'https://vailrerbn.com/api/v1/spots?limit=1000&offset='+offset+'&since='+since+'&band='+encodeURIComponent(band));
}
export function filterRBNByRadius(spots,settings={}){
  if(!coordinates(settings.lat,settings.lon))return [];
  const radius=Number(settings.nearbyRadius)||300,home={lat:settings.lat,lon:settings.lon};
  return (spots||[]).filter(s=>{
    if(!coordinates(s.txPosition?.lat,s.txPosition?.lon)||!coordinates(s.rxPosition?.lat,s.rxPosition?.lon))return false;
    const tx=distance(home,s.txPosition),rx=distance(home,s.rxPosition),txNear=tx<=radius,rxNear=rx<=radius;
    return txNear!==rxNear;
  });
}
export async function loadRBN(settings={},fetchImpl,activity){
  const firstURLs=rbnURLs(settings);
  if(!firstURLs.length)return [];
  const first=await Promise.all(firstURLs.map(url=>boundedFetch(url,'json',fetchImpl,activity)));
  const payloads=[...first],secondURLs=[];
  first.forEach((payload,i)=>{if(Number(payload?.total)>1000&&Array.isArray(payload?.spots)&&payload.spots.length>=1000)secondURLs.push(firstURLs[i].replace('offset=0','offset=1000'));});
  if(secondURLs.length)payloads.push(...await Promise.all(secondURLs.filter(Boolean).map(url=>boundedFetch(url,'json',fetchImpl,activity))));
  const merged=new Map();
  for(const payload of payloads)for(const spot of parseRBN(payload))merged.set(spot.id,spot);
  return filterRBNByRadius([...merged.values()],settings).sort((a,b)=>a.timestamp-b.timestamp);
}

const WSPR_BAND_CODES={'160 m':1,'80 m':3,'60 m':5,'40 m':7,'30 m':10,'20 m':14,'17 m':18,'15 m':21,'12 m':24,'10 m':28,'6 m':50,'2 m':144,'70 cm':432};
function sqlLiteral(value){return "'"+String(value).replaceAll("'","''")+"'";}
export function wsprURL(settings,lookbackSeconds=observationWindowSeconds(settings)){
  if(!settings?.grid)throw new Error('Localização da estação necessária');
  const grid=String(settings.grid).slice(0,4).toUpperCase();
  if(!/^[A-R]{2}\d{2}$/.test(grid))throw new Error('Grid inválido para WSPR');
  const requested=Math.max(300,Math.min(86400,Math.round(Number(lookbackSeconds)||observationWindowSeconds(settings))));
  const visible=(Array.isArray(settings.visible)?settings.visible:[]).map(v=>WSPR_BAND_CODES[v]).filter(Number.isFinite);
  if(!visible.length)throw new Error('Nenhuma banda compatível com WSPR habilitada');
  const query=`SELECT id,time,frequency,tx_sign,tx_lat,tx_lon,tx_loc,rx_sign,rx_lat,rx_lon,rx_loc,distance,azimuth,rx_azimuth,power,snr,code FROM wspr.rx WHERE time >= now() - INTERVAL ${requested} SECOND AND band IN (${visible.join(',')}) AND (startsWith(tx_loc,${sqlLiteral(grid)}) OR startsWith(rx_loc,${sqlLiteral(grid)})) ORDER BY time DESC LIMIT ${WSPR_REPORT_LIMIT} FORMAT JSON`;
  return 'https://db1.wspr.live/?query='+encodeURIComponent(query);
}
export function parseWSPR(payload){
  const rows=Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];
  const out=[];
  for(const row of rows){
    const frequency=Number(row.frequency),band=bandFor(frequency),when=timestamp(String(row.time||''));
    const tx=String(row.tx_sign||'').trim().toUpperCase(),rx=String(row.rx_sign||'').trim().toUpperCase();
    if(!band||band==='11 m'||!Number.isFinite(when)||!tx||!rx)continue;
    const txGrid=String(row.tx_loc||''),rxGrid=String(row.rx_loc||'');
    const txLat=Number(row.tx_lat),txLon=Number(row.tx_lon),rxLat=Number(row.rx_lat),rxLon=Number(row.rx_lon);
    const txPosition=fromGrid(txGrid)||(txGrid&&Number.isFinite(txLat)&&Number.isFinite(txLon)&&Math.abs(txLat)<=90&&Math.abs(txLon)<=180?{lat:txLat,lon:txLon}:null);
    const rxPosition=fromGrid(rxGrid)||(rxGrid&&Number.isFinite(rxLat)&&Number.isFinite(rxLon)&&Math.abs(rxLat)<=90&&Math.abs(rxLon)<=180?{lat:rxLat,lon:rxLon}:null);
    const snr=Number(row.snr),code=Number(row.code);
    out.push({source:'WSPR.live',evidence:'observed',timestamp:when,frequency,band,tx,rx,txGrid,rxGrid,txPosition,rxPosition,
      mode:Number.isFinite(code)&&code!==1?`WSPR/FST4W (${code})`:'WSPR',snr:Number.isFinite(snr)?snr:null,
      id:'WSPR|'+String(row.id??[tx,rx,frequency,when].join('|'))});
  }
  return out;
}
export async function loadWSPR(settings,lookbackSeconds,fetchImpl,activity){
  return parseWSPR(await boundedFetch(wsprURL(settings,lookbackSeconds),'json',fetchImpl,activity));
}

export async function loadKp(fetchImpl,activity) {return parseKp(await boundedFetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json','json',fetchImpl,activity));}
export async function loadSpaceWeather(fetchImpl,activity=()=>{}){
  const requests=[
    ['kp','https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',parseKp],
    ['f107','https://services.swpc.noaa.gov/products/summary/10cm-flux.json',parseF107],
    ['mag','https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json',parseSolarWindMag],
    ['wind','https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json',parseSolarWindSpeed],
    ['xray','https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json',parseXray]
  ];
  const settled=await Promise.allSettled(requests.map(async([key,url,parser])=>[key,parser(await boundedFetch(url,'json',fetchImpl,activity))]));
  const out={},errors=[];
  for(const result of settled){
    if(result.status==='rejected'){errors.push(result.reason?.message||String(result.reason));continue;}
    const [key,value]=result.value;if(key==='mag'){out.bz=value.bz;out.bt=value.bt;}else out[key]=value;
  }
  if(!Object.keys(out).length)throw new Error('NOAA SWPC indisponível: '+errors.join('; '));
  out.updated=Math.max(...Object.values(out).filter(v=>v&&typeof v==='object'&&Number.isFinite(v.timestamp)).map(v=>v.timestamp),0);
  return out;
}

export async function loadIonosondes(fetchImpl,activity){
  return boundedFetch('https://prop.kc2g.com/api/stations.json','json',fetchImpl,activity);
}
