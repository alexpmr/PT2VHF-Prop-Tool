import {coordinates,distance} from './domain.mjs';
export const MUF_INTERVAL=15*60*1000;
export const MUF_MAX_AGE=90*60*1000;
const MHz=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<75?Number(v):null);
function coord(v,lat=false){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);if(!Number.isFinite(n))return null;
  const fixed=!lat&&n>=180?n-360:n;
  return fixed>= (lat?-90:-180)&&fixed<= (lat?90:180)?fixed:null;
}
export function parseIonograms(payload,now=Date.now()){
  if(!Array.isArray(payload))throw new Error('Formato das ionossondas desconhecido');
  const result=[];
  for(const row of payload){
    const s=row?.station;
    if(!s||!row?.time)continue;
    const lat=coord(s.latitude,true),lon=coord(s.longitude,false),timestamp=Date.parse(row.time);
    if(lat===null||lon===null||!Number.isFinite(timestamp)||timestamp>now+5*60000||timestamp<now-MUF_MAX_AGE)continue;
    const fof2=MHz(row.fof2),mufd=MHz(row.mufd);
    if(fof2===null&&mufd===null)continue;
    result.push({code:String(s.code||'').slice(0,24),name:String(s.name||s.code||'Ionossonda').slice(0,120),lat,lon,
      timestamp,fof2,muf3000:mufd,hmf2:row.hmf2==null?null:Number(row.hmf2),confidence:Number.isFinite(Number(row.cs))?Number(row.cs):null,source:'KC2G / GIRO',evidence:'ionosonde'});
  }
  return result.sort((a,b)=>b.timestamp-a.timestamp);
}
export function selectNearbyIonosonde(stations,position,now=Date.now(),maxDistanceKm=1800){
  if(!coordinates(position?.lat,position?.lon))return null;
  const candidates=(stations||[]).filter(s=>Number.isFinite(s.timestamp)&&now-s.timestamp<=MUF_MAX_AGE).map(s=>({...s,distanceKm:distance(position,s)})).filter(s=>s.distanceKm<=maxDistanceKm);
  candidates.sort((a,b)=>a.distanceKm-b.distanceKm||b.timestamp-a.timestamp);
  return candidates[0]||null;
}
export function bandMufContext(band,station,now=Date.now()){
  const mhz={'160 m':1.9,'80 m':3.75,'60 m':5.35,'40 m':7.15,'30 m':10.125,'20 m':14.175,'17 m':18.118,'15 m':21.225,'12 m':24.94,'11 m':27.185,'10 m':28.85}[band];
  if(!mhz||!station?.muf3000||now-station.timestamp>MUF_MAX_AGE)return null;
  // Station-specific MUF(3000)F2 is a reference for ~3000 km, not a path limit or a QSO probability.
  const delta=station.muf3000-mhz;
  return {deltaMHz:Math.round(delta*10)/10,level:delta>=2?'within':delta>=-1?'near':'above',referenceMHz:station.muf3000,source:station.source,station:station.code};
}
