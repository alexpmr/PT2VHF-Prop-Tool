import {parsePSK} from './domain.mjs';
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
export async function boundedFetch(url,format='text',fetchImpl=fetch) {
  const host=new URL(url).hostname;
  if(!['retrieve.pskreporter.info','services.swpc.noaa.gov','api.github.com'].includes(host))throw new Error('Fonte não autorizada');
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{'User-Agent':'PT2VHF-Prop-Tool/0.1.0','Accept':format==='json'?'application/json':'application/xml'}});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  if(Number(response.headers.get('content-length')||0)>6e6)throw new Error('Resposta excede o limite');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6e6)throw new Error('Resposta excede o limite');chunks.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const text=new TextDecoder().decode(bytes);return format==='json'?JSON.parse(text):text;
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
export async function loadPSK(settings,scope,fetchImpl) {return parsePSK(await boundedFetch(pskURL(settings,scope),'text',fetchImpl));}
export async function loadKp(fetchImpl) {return parseKp(await boundedFetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json','json',fetchImpl));}
