import {coordinates,sourceKeyForSpot} from './domain.mjs';

// One remote station per band. Counts are reception reports, never confirmed QSOs.
export function activityStations(snapshot,{band='',mode='',direction='',search=''}={}) {
  const now=snapshot.now??Date.now(),settings=snapshot.settings,groups=new Map();
  const query=String(search).trim().toUpperCase(),seen=new Set();
  for(const spot of snapshot.spots||[]) {
    if(!settings.visible.includes(spot.band)||band&&spot.band!==band)continue;
    if(!Number.isFinite(spot.timestamp)||spot.timestamp<now-settings.windowMinutes*60000||spot.timestamp>now+60000)continue;
    if(settings.sourceEnabled?.[sourceKeyForSpot(spot)]===false)continue;
    if(spot.id&&seen.has(spot.id))continue;if(spot.id)seen.add(spot.id);
    if(!spot.endpoint||!coordinates(spot.endpoint.lat,spot.endpoint.lon))continue;
    const outbound=['regional-out','direct-tx'].includes(spot.origin),inbound=['regional-in','direct-rx'].includes(spot.origin);
    if(!outbound&&!inbound)continue;
    const flow=outbound?'out':'in',call=outbound?spot.rx:spot.tx;
    if(!call||direction&&direction!==flow||mode&&spot.mode!==mode||query&&!call.toUpperCase().includes(query))continue;
    const key=call+'|'+spot.band;
    if(!groups.has(key))groups.set(key,{key,call,band:spot.band,reports:0,sources:new Set(),modes:new Set(),directions:new Set(),latest:0});
    const station=groups.get(key);station.reports++;station.sources.add(spot.source);station.modes.add(spot.mode||'—');station.directions.add(flow);
    if(spot.timestamp>=station.latest)Object.assign(station,{latest:spot.timestamp,position:spot.endpoint,frequency:spot.frequency,snr:spot.snr,bearing:spot.bearing,distance:spot.distance,tx:spot.tx,rx:spot.rx,mode:spot.mode,source:spot.source});
  }
  return [...groups.values()].sort((a,b)=>b.latest-a.latest||a.key.localeCompare(b.key)).map(s=>({...s,sources:[...s.sources].sort(),modes:[...s.modes].sort(),directions:[...s.directions].sort()}));
}

export function sourceHealth(snapshot) {
  const labels={psk:'PSK Reporter',wspr:'WSPR.live',rbn:'Reverse Beacon Network',noaa:'NOAA SWPC',voacap:'VOACAP',muf:'KC2G / GIRO'};
  return Object.entries(labels).map(([key,name])=>{
    const status=snapshot.sourceStatus?.[key]||{},now=snapshot.now??Date.now();
    const ageMs=Number.isFinite(status.updated)?Math.max(0,now-status.updated):null;
    const threshold=key==='muf'?90*60000:key==='noaa'?4*3600000:Math.max(snapshot.settings.dataRefreshMinutes*2,15)*60000;
    const enabled=snapshot.settings.sourceEnabled?.[key]!==false;
    return {key,name,enabled,state:!enabled?'disabled':status.state==='error'?'error':status.state==='loading'?'loading':ageMs!==null&&ageMs>threshold?'stale':status.state==='online'?'online':status.state==='preview'?'preview':'waiting',updated:status.updated||null,count:status.count??null,detail:status.detail||'',incomplete:status.coverage?.complete===false};
  });
}

export function assistantBrief(snapshot,selectedBand='') {
  const eligible=snapshot.bands.filter(b=>snapshot.settings.visible.includes(b.band)&&(!selectedBand||b.band===selectedBand));
  const focus=snapshot.settings.assistantFocus||'balanced';
  const bands=focus==='observed'?eligible.filter(b=>b.reports>0):eligible;
  const band=[...bands].filter(b=>b.chance!==null).sort((a,b)=>(focus==='confidence'?b.confidence-a.confidence:0)||(b.chance-a.chance))[0];
  if(!band)return {key:'assistantEmpty',vars:{n:snapshot.settings.windowMinutes}};
  const station=activityStations(snapshot,{band:band.band}).sort((a,b)=>b.reports-a.reports||b.latest-a.latest)[0];
  return {key:'operationBrief',vars:{band:band.band,score:band.chance,reports:band.reports,confidence:band.confidence??0,basisKey:band.basis==='observed'?'basisObserved':band.basis==='fused'?'basisFused':band.basis==='voacap'?'basisVoacap':'basisEstimated',call:station?.call||'—',degrees:Number.isFinite(station?.bearing)?Math.round(station.bearing):'—',latest:band.latest}};
}
