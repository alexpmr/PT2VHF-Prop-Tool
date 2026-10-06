import {parsePSK} from './domain.mjs';
import {APP_VERSION} from './version.mjs';
export const PSK_INTERVAL=300000;
export const NOAA_INTERVAL=300000;
export function pskURL(settings,scope) {
  const q=new URLSearchParams({flowStartSeconds:'-3600',rronly:'1',noactive:'1',rptlimit:'3000'});
  if(scope==='nearby') {
    if(!settings.grid)throw new Error('Localização da estação necessária');
    q.set('callsign',settings.grid.slice(0,4));q.set('modify','grid');
  } else {if(!settings.callsign)throw new Error('Informe seu indicativo');q.set('callsign',settings.callsign);}
  return 'https://retrieve.pskreporter.info/query?'+q.toString();
}
const AUTHORIZED_HOSTS=new Set(['retrieve.pskreporter.info','services.swpc.noaa.gov','api.github.com']);
const MAX_RESPONSE_BYTES=6e6,MAX_REDIRECTS=3,LOG_PREVIEW_BYTES=8192;
function sourceName(host){return host==='retrieve.pskreporter.info'?'PSK Reporter':host==='services.swpc.noaa.gov'?'NOAA SWPC':host==='api.github.com'?'GitHub':'HTTP';}
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
export function parseKp(rows) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('Kp indisponível');
  let data;
  if(Array.isArray(rows[0])){
    const header=rows[0],t=header.indexOf('time_tag'),k=header.indexOf('Kp');
    if(t<0||k<0)throw new Error('Formato Kp desconhecido');
    data=rows.slice(1).map(row=>({time:row[t],raw:row[k]}));
  }else{data=rows.map(row=>({time:row.time_tag,raw:row.Kp??row.kp_index??row.kp}));}
  const valid=data.flatMap(({time,raw})=>{
    if(raw===null||raw===undefined||raw===''||typeof time!=='string')return [];
    const value=Number(raw),iso=time.replace(' ','T');
    const timestamp=Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso)?iso:iso+'Z');
    return Number.isFinite(value)&&value>=0&&value<=9&&Number.isFinite(timestamp)?[{value,timestamp,evidence:'measured',source:'NOAA SWPC'}]:[];
  }).sort((a,b)=>a.timestamp-b.timestamp);
  if(!valid.length)throw new Error('Kp inválido');return valid.at(-1);
}
export async function loadPSK(settings,scope,fetchImpl,activity) {return parsePSK(await boundedFetch(pskURL(settings,scope),'text',fetchImpl,activity));}
export async function loadKp(fetchImpl,activity) {return parseKp(await boundedFetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json','json',fetchImpl,activity));}
