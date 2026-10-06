import {parsePSK,bandFor,fromGrid} from './domain.mjs';
import {APP_VERSION} from './version.mjs';
export const PSK_INTERVAL=300000;
export const NOAA_INTERVAL=300000;
export const RBN_INTERVAL=300000;
export const PSK_REPORT_LIMIT=3000;
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
const AUTHORIZED_HOSTS=new Set(['retrieve.pskreporter.info','services.swpc.noaa.gov','api.github.com','vailrerbn.com']);
const MAX_RESPONSE_BYTES=6e6,MAX_REDIRECTS=3,LOG_PREVIEW_BYTES=8192;
function sourceName(host){return host==='retrieve.pskreporter.info'?'PSK Reporter':host==='services.swpc.noaa.gov'?'NOAA SWPC':host==='api.github.com'?'GitHub':host==='vailrerbn.com'?'Reverse Beacon Network':'HTTP';}
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
export async function loadRBN(fetchImpl,activity){
  const data=await boundedFetch('https://vailrerbn.com/api/v1/spots?limit=1000','json',fetchImpl,activity);
  return parseRBN(data);
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
