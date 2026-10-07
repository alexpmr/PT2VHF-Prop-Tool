import {BANDS,distance,bearing} from './domain.mjs';

export const VOACAP_INTERVAL=15*60*1000;
export const VOACAP_MAX_TARGETS=12;
export const VOACAP_BANDS={
  '80 m':3.75,'60 m':5.35,'40 m':7.15,'30 m':10.125,'20 m':14.175,
  '17 m':18.118,'15 m':21.225,'12 m':24.94,'11 m':27.185,'10 m':28.85
};
export const VOACAP_FREQUENCIES=Object.entries(VOACAP_BANDS);

const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
function hemi(value,pos,neg,digits){
  const n=Math.abs(Number(value));
  return n.toFixed(2).padStart(digits,' ')+(Number(value)>=0?pos:neg);
}
function powerField(watts){
  const kw=Math.max(0.001,Math.min(10,Number(watts)||100)/1000);
  return kw.toFixed(4).padStart(10,' ');
}
function antennaLine(which,azimuth,powerWatts){
  const file=which===1?'default\\CCIR.000':'default\\SWWHIP.VOA';
  return 'ANTENNA   '+String(which).padStart(5,' ')+String(which).padStart(5,' ')+'    2   30     0.000['+
    file.padEnd(21,' ')+']'+Number(azimuth||0).toFixed(1).padStart(5,' ')+(which===1?powerField(powerWatts):'0.0000'.padStart(10,' '));
}
export function buildVoacapDeck({date=new Date(),tx,rx,power=100,ssn=100,requiredSnr=17}){
  if(!tx||!rx||![tx.lat,tx.lon,rx.lat,rx.lon].every(Number.isFinite))throw new Error('Coordenadas VOACAP inválidas');
  const az=bearing(tx,rx),year=date.getUTCFullYear(),month=date.getUTCMonth()+1;
  const circuit='CIRCUIT   '+hemi(tx.lat,'N','S',5)+hemi(tx.lon,'E','W',9)+hemi(rx.lat,'N','S',9)+hemi(rx.lon,'E','W',9)+'  S     0';
  const system='SYSTEM    '+(Math.max(.001,Number(power)||100)/1000).toFixed(3).padStart(5,' ')+'  145 3.00   90'+Number(requiredSnr).toFixed(1).padStart(5,' ')+' 3.00 0.00';
  const freq='FREQUENCY '+VOACAP_FREQUENCIES.map(([,mhz])=>mhz.toFixed(3).padStart(6,' ')).join('')+' 0.000';
  return [
    'COMMENT   PT2VHF Prop Tool local VOACAP',
    'LINEMAX      55',
    'COEFFS    CCIR',
    'TIME          1   24    1    1',
    `MONTH      ${year} ${month.toFixed(2)}`,
    `SUNSPOT   ${Math.round(clamp(ssn,0,300)).toFixed(1)}`,
    'LABEL     PT2VHF              TARGET',
    circuit,system,'FPROB      1.00 1.00 1.00 0.00',
    antennaLine(1,az,power),antennaLine(2,(az+180)%360,0),freq,
    'METHOD       30    0','EXECUTE','QUIT',''
  ].join('\n');
}
export function parseVoacapReliability(text){
  if(typeof text!=='string'||!text.trim())throw new Error('Saída VOACAP vazia');
  const rows=[];
  for(const line of text.split(/\r?\n/)){
    if(!/\bREL\s*$/.test(line))continue;
    const values=(line.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number).filter(Number.isFinite);
    if(values.length<VOACAP_FREQUENCIES.length+1)continue;
    rows.push(values.slice(1,1+VOACAP_FREQUENCIES.length).map(v=>clamp(v*100)));
    if(rows.length===24)break;
  }
  if(rows.length<24)throw new Error(`Saída VOACAP incompleta: ${rows.length}/24 horas`);
  rows.unshift(rows.pop());
  return rows;
}
export function predictionsForHour(text,hourUTC=new Date().getUTCHours()){
  const rows=parseVoacapReliability(text),row=rows[Math.max(0,Math.min(23,Number(hourUTC)||0))];
  return Object.fromEntries(VOACAP_FREQUENCIES.map(([band],i)=>[band,Math.round(row[i])]));
}
export function observedTargets(spots,settings,limit=VOACAP_MAX_TARGETS){
  if(!settings||!Number.isFinite(settings.lat)||!Number.isFinite(settings.lon))return [];
  const home={lat:settings.lat,lon:settings.lon},seen=new Map();
  for(const s of [...(spots||[])].sort((a,b)=>b.timestamp-a.timestamp)){
    const p=s.endpoint;if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
    const key=(Math.round(p.lat*2)/2).toFixed(1)+','+(Math.round(p.lon*2)/2).toFixed(1);
    if(seen.has(key))continue;
    seen.set(key,{lat:p.lat,lon:p.lon,distance:Number.isFinite(s.distance)?s.distance:distance(home,p),bearing:Number.isFinite(s.bearing)?s.bearing:bearing(home,p),source:s.source,timestamp:s.timestamp});
    if(seen.size>=limit)break;
  }
  return [...seen.values()];
}
export function mergeVoacapPredictions(existing,incoming,now=Date.now()){
  const map=new Map();
  for(const p of [...(existing||[]),...(incoming||[])])if(p&&p.timestamp>=now-6*3600000){
    const key=[p.band,Math.round(p.target.lat*2)/2,Math.round(p.target.lon*2)/2].join('|');
    if(!map.has(key)||map.get(key).timestamp<p.timestamp)map.set(key,p);
  }
  return [...map.values()];
}
export function voacapBandSummary(predictions,band,now=Date.now()){
  const rows=(predictions||[]).filter(p=>p.band===band&&p.timestamp>=now-2*VOACAP_INTERVAL&&Number.isFinite(p.reliability));
  if(!rows.length)return null;
  const weighted=rows.map(p=>({p,w:Math.exp(-Math.max(0,now-p.timestamp)/(2*VOACAP_INTERVAL))}));
  const sum=weighted.reduce((n,x)=>n+x.w,0)||1;
  const mean=weighted.reduce((n,x)=>n+x.p.reliability*x.w,0)/sum;
  const best=Math.max(...rows.map(p=>p.reliability));
  return {mean:Math.round(mean),best:Math.round(best),count:rows.length,updated:Math.max(...rows.map(p=>p.timestamp))};
}
