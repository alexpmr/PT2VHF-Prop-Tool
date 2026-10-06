import {BANDS} from './domain.mjs';

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function bandPattern(name){return name.replace(' ','\\s*').replace('cm','\\s*cm').replace('m','\\s*m');}
export function questionBand(question){
  const q=normalize(question);
  for(const band of BANDS){
    const compact=normalize(band.name).replace(/\s+/g,'');
    if(q.replace(/\s+/g,'').includes(compact))return band.name;
    const number=band.name.match(/\d+/)?.[0];
    if(number&&new RegExp(`(^|\\D)${number}\\s*(m|metros?|meters?|metres?|cm)(\\D|$)`,'i').test(q))return band.name;
  }
  return null;
}
function chosenBand(snapshot,selectedBand,question){
  const explicit=questionBand(question);
  if(explicit)return snapshot.bands.find(b=>b.band===explicit)||null;
  if(selectedBand)return snapshot.bands.find(b=>b.band===selectedBand)||null;
  return snapshot.bands.filter(b=>snapshot.settings.visible.includes(b.band)&&b.chance!==null).sort((a,b)=>(b.chance??-1)-(a.chance??-1))[0]||null;
}
function bandSpots(snapshot,band){return (snapshot.spots||[]).filter(s=>!band||s.band===band);}
function sector(spots){
  const sectors=['N','NE','E','SE','S','SW','W','NW'],counts=new Array(8).fill(0),distances=Array.from({length:8},()=>[]);
  for(const s of spots){if(!Number.isFinite(s.bearing))continue;const idx=Math.round(s.bearing/45)%8;counts[idx]++;if(Number.isFinite(s.distance))distances[idx].push(s.distance);}
  const max=Math.max(...counts);if(max<=0)return null;const idx=counts.indexOf(max),list=distances[idx].sort((a,b)=>a-b),median=list.length?list[Math.floor(list.length/2)]:null;
  return {cardinal:sectors[idx],degrees:idx*45,reports:max,distance:median===null?null:Math.round(median)};
}
function sourceState(snapshot,key){return snapshot.sourceStatus?.[key]?.state||'idle';}
function basisKey(band){
  return band?.basis==='estimated'?'basisEstimated':band?.basis==='observed'?'basisObserved':band?.basis==='fused'?'basisFused':'basisNone';
}
export function assistantReply(question,snapshot,selectedBand=''){
  const q=normalize(question),band=chosenBand(snapshot,selectedBand,question),spots=bandSpots(snapshot,band?.band);
  if(!q)return {key:'assistantUnknown'};

  if(/(muf|fof2|voacap|tep|esporadic|sporadic|tropo|duct|aurora|meteor)/.test(q))
    return {key:'assistantLimits'};

  if(/(fonte|source|psk|rbn|wspr|noaa|status)/.test(q))
    return {key:'assistantSources',vars:{psk:sourceState(snapshot,'psk'),rbn:sourceState(snapshot,'rbn'),wspr:sourceState(snapshot,'wspr'),noaa:sourceState(snapshot,'noaa')}};

  if(/(janela|window|periodo|period|tempo de observ|observation)/.test(q))
    return {key:'assistantWindow',vars:{n:snapshot.settings.windowMinutes}};

  if(/(heatmap|heat map|mapa de calor|cores?|densidade|density)/.test(q))
    return {key:'assistantHeatmap'};

  if(/(score|indice|pontuacao|chance.*calcul|como.*chance|por que.*chance|why.*score)/.test(q))
    return {key:'assistantScore',vars:{band:band?.band||'',score:band?.chance??'—',basisKey:basisKey(band),reports:band?.reports??0}};

  if(/(direcao|direction|azimut|azimuth|rumo|para onde|regiao|region|pais|country)/.test(q)){
    if(!band)return {key:'assistantEmpty',vars:{n:snapshot.settings.windowMinutes}};
    const top=sector(spots);
    if(!top)return {key:'assistantDirectionEmpty',vars:{band:band.band,n:snapshot.settings.windowMinutes}};
    return {key:'assistantDirection',vars:{band:band.band,cardinal:top.cardinal,degrees:top.degrees,reports:top.reports,distance:top.distance??'—'}};
  }

  if(/(entrada|saida|inbound|outbound|recepc|report|enlace|link|quant|how many)/.test(q)){
    if(!band)return {key:'assistantEmpty',vars:{n:snapshot.settings.windowMinutes}};
    return {key:'assistantTraffic',vars:{band:band.band,reports:band.reports,pairs:band.pairs,tx:band.txReports,rx:band.rxReports,basisKey:basisKey(band)}};
  }

  if(/(ultima|ultimo|latest|recent|recente|quando)/.test(q)){
    if(!band||!band.latest)return {key:'assistantLatestEmpty',vars:{band:band?.band||'',n:snapshot.settings.windowMinutes}};
    return {key:'assistantLatest',vars:{band:band.band,latest:band.latest}};
  }

  const explicit=questionBand(question);
  if(explicit||/(situacao|condicao|como esta|estado|aberta|fechada|band|banda)/.test(q)){
    if(!band)return {key:'assistantEmpty',vars:{n:snapshot.settings.windowMinutes}};
    return {key:'assistantBand',vars:{band:band.band,score:band.chance??'—',reports:band.reports,pairs:band.pairs,trend:band.trend,basisKey:basisKey(band),latest:band.latest}};
  }

  if(/(melhor|maior chance|qual banda|best|highest|which band|better|agora|now)/.test(q)){
    if(!band)return {key:'assistantEmpty',vars:{n:snapshot.settings.windowMinutes}};
    return {key:'assistantBest',vars:{band:band.band,score:band.chance??'—',reports:band.reports,pairs:band.pairs,basisKey:basisKey(band),latest:band.latest}};
  }

  return {key:'assistantUnknown'};
}
