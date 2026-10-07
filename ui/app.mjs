import {BANDS,DEFAULT_SETTINGS,validateSettings,toGrid,fromGrid,coordinates,evaluateBand,distance,bearing} from '../src/domain.mjs';
import {LANGUAGES,translate} from '../src/i18n.mjs';
import {APP_VERSION} from '../src/version.mjs';
import {normalizeReleaseNotes} from '../src/release-notes.mjs';
import {aggregateHeatSamples,heatColor,kernelRadius} from '../src/heatmap.mjs';
import {assistantReply} from '../src/assistant.mjs';
import {rankCountries} from '../src/geography.mjs';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const colors=['#bab1dc','#ad9ce5','#738fea','#76a8fa','#6bbee9','#57d3b4','#b0de74','#e4da68','#efbd7a','#ef837a','#dca0f0','#86dbf1','#ecade0','#90cda0'];
const SOURCE_CONTROLS=[['psk','PSK'],['wspr','WSPR'],['rbn','RBN'],['noaa','NOAA'],['voacap','VOACAP'],['muf','MUF']];
const color=band=>colors[BANDS.findIndex(b=>b.name===band)]||'#6fe2bf';
let current,alertBand,scale=1,tx=0,ty=0,pointer,page='map',language='pt-BR',toastTimer,toastKey,configErrorKey,logsPaused=false,newsShownFor=null,heatFrame=0,updateFlowActive=false,countryFeatures=[];
const heatScratch=document.createElement('canvas');
let lastActivity={rx:0,tx:0},ledTimers={rx:null,tx:null};
const listeners=[],conversation=[{key:'welcome'}];
const t=(key,vars)=>translate(language,key,vars);
function previewSnapshot(settings) {
  if(!settings){try{settings=validateSettings(JSON.parse(localStorage.getItem('prop-settings'))||DEFAULT_SETTINGS);}catch{settings=validateSettings(DEFAULT_SETTINGS);}}
  return {version:APP_VERSION,portable:false,settings,scope:'nearby',spots:[],voacapPredictions:[],ionosonde:null,bands:BANDS.map(b=>evaluateBand([],b.name)),kp:null,spaceWeather:{},sourceStatus:{psk:{state:'preview'},rbn:{state:'preview'},wspr:{state:'preview'},noaa:{state:'preview'},voacap:{state:'preview'},muf:{state:'preview'}},activity:{rx:0,tx:0},logs:[],startupNews:null,update:{state:'development',notes:''},now:Date.now(),nextPSK:0};
}
const api=window.propTool||{
  snapshot:async()=>previewSnapshot(),
  configure:async s=>{const settings=validateSettings(s);localStorage.setItem('prop-settings',JSON.stringify(settings));current=previewSnapshot(settings);listeners.forEach(fn=>fn(current));return current;},
  refresh:async()=>{current=previewSnapshot(current.settings);listeners.forEach(fn=>fn(current));return current;},clearLogs:async()=>{current={...current,logs:[]};listeners.forEach(fn=>fn(current));return true;},exportLogs:async()=>false,factoryReset:async()=>{localStorage.clear();location.reload();return true;},subscribe:fn=>{listeners.push(fn);return ()=>{};},checkUpdate:async()=>current.update,
  runUpdateFlow:async()=>current.update,acknowledgeNews:async()=>true,
  downloadUpdate:async()=>toast('development'),installUpdate:async()=>{},openLink:async target=>window.open({project:'https://github.com/alexpmr/PT2VHF-Prop-Tool',issues:'https://github.com/alexpmr/PT2VHF-Prop-Tool/issues',profile:'https://github.com/alexpmr',releases:'https://github.com/alexpmr/PT2VHF-Prop-Tool/releases',manual:`https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v${APP_VERSION}/PT2VHF-Prop-Tool-${APP_VERSION}-Manual.pdf`}[target],'_blank','noopener')
};
function svgNode(name,attrs={},parent){const node=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(parent)parent.append(node);return node;}
const project=([lon,lat])=>[(lon+180)*3,(90-lat)*3];
function ringPath(ring){return ring.map((v,i)=>`${i?'L':'M'}${project(v).join(',')}`).join(' ')+' Z';}
function zoneCenters(zone){
  const centers=[];for(const ring of zone.rings||[]){if(!ring?.length)continue;let lon=0,lat=0,n=0;for(const point of ring){if(!Array.isArray(point)||point.length<2)continue;lon+=point[0];lat+=point[1];n++;}if(n)centers.push({lon:lon/n,lat:lat/n});}return centers;
}
function mapProjector(){
  const matrix=$('world')?.getScreenCTM(),rect=$('map').getBoundingClientRect();if(!matrix||!rect.width||!rect.height)return null;
  return position=>{if(!position)return null;const [x,y]=project([position.lon,position.lat]);return {x:matrix.a*x+matrix.c*y+matrix.e-rect.left,y:matrix.b*x+matrix.d*y+matrix.f-rect.top,width:rect.width,height:rect.height};};
}
function screenPosition(position){const projectScreen=mapProjector();return projectScreen?projectScreen(position):null;}
function renderDensityHeatmap(){
  const canvas=$('heatmapCanvas');if(!canvas||!current)return;
  const rect=$('map').getBoundingClientRect(),width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);
  const selected=$('band').value,shownBands=new Set(current.bands.filter(b=>current.settings.visible.includes(b.band)&&(!selected||b.band===selected)).map(b=>b.band));
  const samples=[],projectScreen=mapProjector();if(!projectScreen)return;
  for(const s of current.spots){
    if(!shownBands.has(s.band)||!s.endpoint)continue;const p=projectScreen(s.endpoint);if(!p)continue;
    const snr=Number.isFinite(s.snr)?Math.max(-30,Math.min(20,s.snr)): -10;
    samples.push({x:p.x,y:p.y,weight:.8+(snr+30)/100});
  }
  {
    for(const p0 of current.voacapPredictions||[]){if(!shownBands.has(p0.band)||!p0.target)continue;const p=projectScreen(p0.target);if(p)samples.push({x:p.x,y:p.y,weight:.25+.75*Math.max(0,Math.min(1,(p0.reliability??0)/100))});}
    for(const b of current.bands){
      if(!shownBands.has(b.band))continue;const weight=.18+.24*Math.max(0,Math.min(1,(b.chance??0)/100));
      for(const zone of b.predictedZones||[])for(const center of zoneCenters(zone)){const p=projectScreen(center);if(p)samples.push({x:p.x,y:p.y,weight});}
    }
  }
  const radius=kernelRadius(scale),bins=aggregateHeatSamples(samples,Math.max(4,radius*.28));
  if(!bins.length)return;
  const density=heatScratch;if(density.width!==width)density.width=width;if(density.height!==height)density.height=height;
  const dctx=density.getContext('2d',{willReadFrequently:true});dctx.clearRect(0,0,width,height);dctx.globalCompositeOperation='lighter';
  for(const bin of bins){
    if(bin.x<-radius||bin.y<-radius||bin.x>width+radius||bin.y>height+radius)continue;
    const strength=Math.min(.92,.08+.12*Math.log2(1+bin.weight));
    const grad=dctx.createRadialGradient(bin.x,bin.y,0,bin.x,bin.y,radius);
    grad.addColorStop(0,`rgba(0,0,0,${strength})`);grad.addColorStop(.45,`rgba(0,0,0,${strength*.58})`);grad.addColorStop(1,'rgba(0,0,0,0)');
    dctx.fillStyle=grad;dctx.fillRect(bin.x-radius,bin.y-radius,radius*2,radius*2);
  }
  const src=dctx.getImageData(0,0,width,height),hist=new Uint32Array(256);let active=0;
  for(let i=3;i<src.data.length;i+=4){const a=src.data[i];if(a){hist[a]++;active++;}}
  if(!active)return;
  let cumulative=0,threshold=255,target=active*.985;for(let i=1;i<256;i++){cumulative+=hist[i];if(cumulative>=target){threshold=Math.max(18,i);break;}}
  const out=ctx.createImageData(width,height);
  for(let i=0;i<src.data.length;i+=4){
    const a=src.data[i+3];if(!a)continue;let intensity=Math.min(1,a/threshold);if(intensity<.035)continue;intensity=Math.pow(intensity,.72);
    const [r,g,b]=heatColor(intensity);out.data[i]=r;out.data[i+1]=g;out.data[i+2]=b;out.data[i+3]=Math.round(35+205*Math.pow(intensity,.78));
  }
  ctx.putImageData(out,0,0);
}
function updateHomeOverlay(){
  const home=$('homeOverlay');if(!home||!current||!coordinates(current.settings.lat,current.settings.lon)){if(home)home.style.display='none';return;}
  const p=screenPosition({lat:current.settings.lat,lon:current.settings.lon});if(!p||p.x<-30||p.y<-30||p.x>p.width+30||p.y>p.height+30){home.style.display='none';return;}
  home.style.display='flex';home.style.left=p.x+'px';home.style.top=p.y+'px';home.querySelector('span').textContent=current.settings.callsign||'';
}
function renderMapOverlays(){renderDensityHeatmap();updateHomeOverlay();}
function scheduleMapOverlays(){cancelAnimationFrame(heatFrame);heatFrame=requestAnimationFrame(renderMapOverlays);}
function mapTransform(){$('world').setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);scheduleMapOverlays();}
function zoom(f){const next=Math.max(1,Math.min(6,scale*f));tx=540-(540-tx)*next/scale;ty=270-(270-ty)*next/scale;scale=next;mapTransform();}
for(let lon=-180;lon<=180;lon+=30)svgNode('path',{d:`M${(lon+180)*3},0 V540`},$('graticule'));
for(let lat=-60;lat<=60;lat+=30)svgNode('path',{d:`M0,${(90-lat)*3} H1080`},$('graticule'));
try{const land=await (await fetch('land.geojson')).json();for(const f of land.features){const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];for(const rings of polygons)svgNode('path',{d:rings.map(ringPath).join(' '),'fill-rule':'evenodd'},$('land'));}}catch{toast('mapError');}
try{const countries=await (await fetch('countries.geojson')).json();countryFeatures=Array.isArray(countries.features)?countries.features:[];}catch{countryFeatures=[];}
for(const band of BANDS){const option=document.createElement('option');option.value=option.textContent=band.name;$('band').append(option);}
for(const item of LANGUAGES){const button=document.createElement('button');button.type='button';button.dataset.language=item.code;const img=document.createElement('img');img.src=`flags/${item.flag}.svg`;img.alt='';button.append(img,document.createTextNode(item.name));button.onclick=()=>{changePreference('language',item.code);$('languageMenu').open=false;};$('languages').append(button);}
function compactBandLabel(name){return name.replace(/\s+/g,'');}
function renderBandControls(){
  if($('band').value&&!current.settings.visible.includes($('band').value))$('band').value='';
  const selected=$('band').value,host=$('bandButtons');host.replaceChildren();
  const choices=[['',t('allBands')],...current.settings.visible.map(name=>[name,compactBandLabel(name)])];
  for(const [value,label] of choices){const b=document.createElement('button');b.type='button';b.dataset.band=value;b.textContent=label;b.classList.toggle('active',selected===value);b.setAttribute('role','radio');b.setAttribute('aria-checked',String(selected===value));b.onclick=()=>{$('band').value=value;render(current);};host.append(b);}
}
function renderSourceControls(){
  const host=$('sourceButtons');if(!host||!current)return;host.replaceChildren();
  for(const [key,label] of SOURCE_CONTROLS){
    const b=document.createElement('button');b.type='button';b.dataset.source=key;b.textContent=label;
    const active=current.settings.sourceEnabled?.[key]!==false;b.classList.toggle('active',active);b.classList.toggle('inactive',!active);b.setAttribute('aria-pressed',String(active));
    b.onclick=async()=>{const next={...(current.settings.sourceEnabled||{}),[key]:!active};try{render(await api.configure({...current.settings,sourceEnabled:next}));}catch{toast('appError');}};
    host.append(b);
  }
}
function renderPeriodControls(){
  const selected=Number(current.settings.windowMinutes),host=$('periodButtons');host.replaceChildren();
  for(const n of [15,30,60]){const b=document.createElement('button');b.type='button';b.dataset.minutes=String(n);b.textContent=n===60?t('hour'):t('minutes',{n});b.classList.toggle('active',selected===n);b.setAttribute('role','radio');b.setAttribute('aria-checked',String(selected===n));b.onclick=async()=>{if(Number(current.settings.windowMinutes)===n)return;try{$('period').value=String(n);render(await api.configure({...current.settings,windowMinutes:n}));await refresh();}catch{toast('appError');}};host.append(b);}
}
function paintTranslations(){
  document.documentElement.lang=language;document.documentElement.dataset.theme=current.settings.theme;document.documentElement.dataset.mapBase=current.settings.mapBase||'default';
  for(const [attr,target] of [['data-i18n','textContent'],['data-i18n-title','title'],['data-i18n-aria','aria-label'],['data-i18n-placeholder','placeholder']])for(const node of document.querySelectorAll(`[${attr}]`)){const val=t(node.getAttribute(attr));if(target==='textContent')node.textContent=val;else node.setAttribute(target,val);}
  for(const n of [15,30])$('period').querySelector(`[value="${n}"]`).textContent=t('minutes',{n});
  $('period').querySelector('[value="60"]').textContent=t('hour');$('period').setAttribute('aria-label',t('observationWindow'));
  const selected=LANGUAGES.find(l=>l.code===language);$('languageFlag').src=`flags/${selected.flag}.svg`;$('currentLanguage').textContent=selected.name;$('languageMenu').querySelector('summary').title=t('language');
  for(const n of $('languages').querySelectorAll('button'))n.setAttribute('aria-pressed',String(n.dataset.language===language));
  $('themeButton').textContent=(current.settings.theme==='dark'?'☀ ':'☾ ')+t(current.settings.theme==='dark'?'light':'dark');$('themeButton').title=t('theme');
  if(configErrorKey)$('configError').textContent=t(configErrorKey);if(toastKey)$('toast').textContent=t(toastKey.key,toastKey.vars);if($('pauseLogs'))$('pauseLogs').textContent=t(logsPaused?'resume':'pause');
  for(const n of $('bandSettings').querySelectorAll('select'))n.setAttribute('aria-label',t('antennaFor',{band:n.dataset.antenna}));
  renderConversation();
}
function age(time){if(!time)return t('noData');const n=Math.max(0,Math.floor((Date.now()-time)/60000));return n<1?t('justNow'):t('ago',{n});}
const date=time=>new Date(time).toLocaleString(language);
function pulseActivity(value={}){
  for(const dir of ['rx','tx'])if(value[dir]&&value[dir]!==lastActivity[dir]){
    lastActivity[dir]=value[dir];const led=$(dir+'Led');led.classList.add('active');clearTimeout(ledTimers[dir]);ledTimers[dir]=setTimeout(()=>led.classList.remove('active'),180);
  }
}
function renderLogs(){
  if(!current||logsPaused)return;
  const logs=Array.isArray(current.logs)?current.logs:[],direction=$('logDirection').value,search=$('logSearch').value.trim().toLowerCase(),selectedSource=$('logSource').value;
  const sources=[...new Set(logs.map(v=>v.source).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  if(!$('logSource').dataset.sources||$('logSource').dataset.sources!==sources.join('|')){
    $('logSource').dataset.sources=sources.join('|');$('logSource').replaceChildren();const all=document.createElement('option');all.value='';all.textContent=t('allSources');$('logSource').append(all);for(const source of sources){const o=document.createElement('option');o.value=o.textContent=source;$('logSource').append(o);}$('logSource').value=sources.includes(selectedSource)?selectedSource:'';
  }
  const source=$('logSource').value,filtered=logs.filter(v=>(!direction||v.direction===direction)&&(!source||v.source===source)&&(!search||JSON.stringify(v).toLowerCase().includes(search)));
  $('logCount').textContent=t('logEntries',{n:filtered.length});$('logList').replaceChildren();
  if(!filtered.length){const empty=document.createElement('div');empty.className='logEmpty';empty.textContent=t('noLogs');$('logList').append(empty);return;}
  for(const item of [...filtered].reverse()){
    const row=document.createElement('div');row.className='logRow';const when=document.createElement('span');when.textContent=new Date(item.timestamp).toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3});
    const dir=document.createElement('span');dir.className='logDir '+String(item.direction||'info').toLowerCase();dir.textContent=item.direction||'INFO';const sourceNode=document.createElement('span');sourceNode.textContent=item.source||'—';const status=document.createElement('span');status.className='logMeta';status.textContent=item.status??item.event??'—';
    const detail=document.createElement('div');detail.className='logDetail';const lines=[];if(item.method||item.url)lines.push([item.method,item.url].filter(Boolean).join(' '));if(item.detail)lines.push(item.detail);if(item.error)lines.push('ERROR: '+item.error);if(item.bytes!==undefined||item.durationMs!==undefined)lines.push([item.bytes!==undefined?item.bytes+' B':'',item.durationMs!==undefined?item.durationMs+' ms':''].filter(Boolean).join(' · '));detail.append(document.createTextNode(lines.join('\n')||'—'));
    if(item.payload){const d=document.createElement('details'),s=document.createElement('summary');s.textContent='payload'+(item.truncated?' (preview)':'');const pre=document.createElement('div');pre.className='logPayload';pre.textContent=item.payload;d.append(s,pre);detail.append(d);}
    row.append(when,dir,sourceNode,status,detail);$('logList').append(row);
  }
}
const bandStates={'Sem evidências':'none','Evidência forte':'strong','Evidência moderada':'moderate','Evidência limitada':'limited'};
function sourceLabel(status){return t({online:'online',loading:'loading',error:'sourceError',preview:'preview'}[status.state]||'waiting');}
function render(snap){
  current=snap;language=snap.settings.language;paintTranslations();pulseActivity(snap.activity||{});$('appVersion').textContent=$('aboutVersion').textContent=`v${snap.version}`;
  const status=snap.sourceStatus.psk,rbnStatus=snap.sourceStatus.rbn||{state:'idle'},wsprStatus=snap.sourceStatus.wspr||{state:'idle'},voacapStatus=snap.sourceStatus.voacap||{state:'idle'};const obsOnline=status.state==='online'||rbnStatus.state==='online'||wsprStatus.state==='online';$('status').textContent=obsOnline?'PSK/RBN/WSPR'+(voacapStatus.state==='online'?' + VOACAP':'')+' OK':sourceLabel(status);$('stationLabel').textContent=snap.settings.callsign||t('configure');
  $('period').value=String(snap.settings.windowMinutes);
  renderBandControls();renderPeriodControls();renderSourceControls();$('mapBase').value=snap.settings.mapBase||'default';
  $('bands').replaceChildren();$('bandCount').textContent=t('bandCount',{n:snap.settings.visible.length});
  for(const b of snap.bands.filter(b=>snap.settings.visible.includes(b.band))){
    const row=document.createElement('div');row.className='bandRow';
    const label=document.createElement('strong');label.textContent=b.band;label.style.color=color(b.band);
    const state=document.createElement('span');state.className='state';state.textContent=b.chance===null?t('insufficient'):t(bandStates[b.state]||'none')+(b.trend!=='—'?' '+b.trend:'');
    const basis=document.createElement('small');basis.className='basis';basis.textContent=t({estimated:'basisEstimated',observed:'basisObserved',fused:'basisFused',voacap:'basisVoacap',none:'basisNone'}[b.basis]||'basisNone')+(b.voacapScore!==null&&b.voacapScore!==undefined?' · VOACAP '+b.voacapScore+'%':'')+(b.mufContext?' · MUF(3000) '+b.mufContext.referenceMHz.toFixed(1)+' MHz':'')+' · '+t('confidenceShort',{n:b.confidence??0});
    row.append(label,state,basis);$('bands').append(row);
  }
  const displayed=snap.bands.filter(b=>snap.settings.visible.includes(b.band)&&(!$('band').value||b.band===$('band').value));let zoneCount=0,pointCount=0;
  const shownBands=new Set(displayed.map(b=>b.band));
  const shownSpots=snap.spots.filter(p=>shownBands.has(p.band));
  pointCount=shownSpots.length;
  zoneCount+=displayed.reduce((n,b)=>n+(b.predictedZones||[]).length,0);
  zoneCount+=displayed.reduce((n,b)=>n+(b.confirmedZones||b.zones||[]).length,0);
  const ranked=rankCountries(shownSpots,countryFeatures,language,3),destHost=$('favoredDestinations');destHost.replaceChildren();
  if(!ranked.length){const empty=document.createElement('span');empty.className='destinationEmpty';empty.textContent=t('noFavoredDestinations');destHost.append(empty);}
  else for(const item of ranked){const row=document.createElement('div');row.className='destinationRow';const name=document.createElement('strong');name.textContent=item.name;const meta=document.createElement('span');meta.textContent=t('destinationMeta',{n:item.reports,sources:item.sources.length});row.append(name,meta);destHost.append(row);}
  const configured=Boolean(snap.settings.callsign)&&coordinates(snap.settings.lat,snap.settings.lon);
  scheduleMapOverlays();
  $('empty').classList.toggle('hidden',configured);$('emptyTitle').textContent=t('configure');$('emptyConfigure').hidden=configured;
  const onlyBand=$('band').value?snap.bands.find(b=>b.band===$('band').value):null,estimateOnly=Boolean(onlyBand?.basis==='estimated'&&pointCount===0);
  $('mapNotice').classList.toggle('hidden',!configured||pointCount>0&&!estimateOnly);$('mapNotice').textContent=estimateOnly?t(onlyBand.band==='11 m'?'elevenMeterEstimateNotice':'estimateOnlyNotice',{band:onlyBand.band,score:onlyBand.chance??'—'}):status.state==='error'?t('sourceError'):status.state==='loading'?t('loading'):status.state==='preview'?t('previewNotice'):t('emptyTitle');$('mapNotice').title=estimateOnly?t('estimateNotConfirmed'):t('emptyBody');
  $('evidenceCount').textContent=t('counts',{n:pointCount,zones:zoneCount});const query=status.state==='online'?t('queryCount',{n:status.count??0}):sourceLabel(status);
  const rbnQuery=rbnStatus.state==='online'?`OK (${rbnStatus.count??0})`:sourceLabel(rbnStatus),wsprQuery=wsprStatus.state==='online'?`OK (${wsprStatus.count??0})`:sourceLabel(wsprStatus),voacapQuery=voacapStatus.state==='online'?`OK (${voacapStatus.targets??0})`:sourceLabel(voacapStatus);$('freshness').textContent=`PSK: ${query}${status.updated?' · '+age(status.updated):''} · WSPR: ${wsprQuery}${wsprStatus.updated?' · '+age(wsprStatus.updated):''} · RBN: ${rbnQuery}${rbnStatus.updated?' · '+age(rbnStatus.updated):''} · VOACAP: ${voacapQuery}${voacapStatus.updated?' · '+age(voacapStatus.updated):''}${snap.nextPSK>0?' · '+t('nextQuery',{n:Math.ceil(snap.nextPSK/60000)}):''}`;
  const noaaActive=snap.settings.sourceEnabled?.noaa!==false,mufActive=snap.settings.sourceEnabled?.muf!==false;
  const iono=snap.ionosonde,mufStatus=snap.sourceStatus.muf||{state:'waiting'};
  $('mufValue').textContent=iono?.muf3000!=null?'MUF(3000): '+iono.muf3000.toFixed(1)+' MHz':'MUF(3000): —';
  $('fof2Value').textContent=iono?.fof2!=null?iono.fof2.toFixed(1)+' MHz':'—';
  $('mufDistance').textContent=iono?Math.round(iono.distanceKm)+' km':'—';
  $('mufStation').textContent=!mufActive?t('sourceDisabled'):(iono?iono.name+' ('+iono.code+') · '+date(iono.timestamp)+' · '+t('mufReferenceWarning'):(mufStatus.detail||t('mufUnavailable')));
  const kp=snap.kp,sw=snap.spaceWeather||{};$('kp').textContent=kp?kp.value.toLocaleString(language,{minimumFractionDigits:1,maximumFractionDigits:1}):'—';$('kpState').textContent=!noaaActive?t('sourceDisabled'):(kp?t(Date.now()-kp.timestamp>4*3600000?'oldMeasure':kp.value>=5?'elevated':'measurement'):sourceLabel(snap.sourceStatus.noaa));$('kpTime').textContent=kp?`${date(kp.timestamp)} · ${t('kpNote')}`:t('kpWaiting');$('sfi').textContent=sw.f107?.value??'—';$('bz').textContent=sw.bz?`${sw.bz.value} nT`:'—';$('wind').textContent=sw.wind?`${Math.round(sw.wind.value)} km/s`:'—';$('xray').textContent=sw.xray?.class??'—';
  renderUpdate(snap.update);renderLogs();
  if(snap.startupNews&&newsShownFor!==snap.startupNews.version){newsShownFor=snap.startupNews.version;$('newsVersion').textContent='v'+snap.startupNews.version;const notes=normalizeReleaseNotes(snap.startupNews.notes);$('newsNotes').textContent=notes||t('news027');if(!$('newsDialog').open)$('newsDialog').showModal();}
  if(snap.alert){alertBand=snap.alert.band;$('alertText').textContent=t('alertText',{band:alertBand,n:snap.alert.score});if(!$('alertDialog').open)$('alertDialog').showModal();}
}
function formatBytes(value){const n=Number(value);if(!Number.isFinite(n)||n<0)return '';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(n>=104857600?0:1)+' MB';}
function renderUpdate(u){
  const key={current:'currentVersion',available:'newVersion',checking:'checking',downloading:'downloading',downloaded:'downloaded',installing:'installingUpdate',error:'updateError',development:'development'}[u.state]||'checkUpdate';
  const percent=Math.max(0,Math.min(100,Number(u.percent)||0)),busy=updateFlowActive&&['checking','available','downloading','downloaded','installing'].includes(u.state);
  $('version').textContent=t(key,{n:Math.round(percent)});$('version').classList.toggle('available',u.state==='available');$('version').classList.toggle('current',u.state==='current');$('version').disabled=updateFlowActive||['checking','downloading','installing'].includes(u.state);
  $('updateMessage').textContent=t(u.state==='available'?'updateAvailable':key,{version:u.version,n:Math.round(percent)});
  $('releaseNotes').textContent=normalizeReleaseNotes(u.notes)||t('noNotes');
  $('downloadUpdate').classList.add('hidden');$('installUpdate').classList.add('hidden');
  const progressVisible=updateFlowActive&&['downloading','downloaded','installing'].includes(u.state);$('updateProgress').classList.toggle('hidden',!progressVisible);$('updateProgress').value=u.state==='installing'?100:percent;
  const parts=[];if(Number.isFinite(u.transferred)&&u.transferred>=0)parts.push(formatBytes(u.transferred)+(Number.isFinite(u.total)&&u.total>0?' / '+formatBytes(u.total):''));if(Number.isFinite(u.bytesPerSecond)&&u.bytesPerSecond>0)parts.push(formatBytes(u.bytesPerSecond)+'/s');
  $('updateStats').textContent=parts.join(' · ');$('updateStats').classList.toggle('hidden',!progressVisible||!parts.length);
  $('updateDialog').dataset.busy=String(busy);
  if(updateFlowActive&&!$('updateDialog').open)$('updateDialog').showModal();
}
function toast(key,vars={}){toastKey={key,vars};clearTimeout(toastTimer);$('toast').textContent=t(key,vars);$('toast').style.display='block';toastTimer=setTimeout(()=>{$('toast').style.display='none';toastKey=null;},6000);}
const antennaTypes=[['Não informada','unspecified'],['Dipolo','dipole'],['Vertical','vertical'],['Yagi',null],['Log-periódica','logPeriodic'],['Loop','loop'],['End Fed',null],['Hexbeam',null],['Cobweb',null],['Discone',null],['Colinear','collinear'],['Outra','other']];
function openSettings(){
  const s=current.settings;for(const id of ['callsign','lat','lon','power','nearbyRadius','alertMinScore','alertMinDistance','alertCooldown','updateMinutes','dataRefreshMinutes'])$(id).value=s[id]??'';$('grid').value=coordinates(s.lat,s.lon)?toGrid(s.lat,s.lon):'';configErrorKey=null;$('configError').textContent='';$('bandSettings').replaceChildren();
  for(const b of BANDS){const row=document.createElement('div');row.className='bandConfig';const visible=document.createElement('label'),v=document.createElement('input');v.type='checkbox';v.dataset.band=b.name;v.dataset.kind='visible';v.checked=s.visible.includes(b.name);visible.append(v,document.createTextNode(b.name));const alert=document.createElement('label'),a=document.createElement('input');a.type='checkbox';a.dataset.band=b.name;a.dataset.kind='alertBands';a.checked=s.alertBands.includes(b.name);const span=document.createElement('span');span.dataset.i18n='alert';alert.append(a,span);const type=document.createElement('select');type.dataset.antenna=b.name;for(const [value,key] of antennaTypes){const o=document.createElement('option');o.value=value;if(key)o.dataset.i18n=key;else o.textContent=value;type.append(o);}type.value=s.antennas[b.name]?.type||'Vertical';row.append(visible,alert,type);$('bandSettings').append(row);}paintTranslations();
}
function setPage(next){if(!['map','logs','settings','help','about'].includes(next))return;page=next;for(const p of ['map','logs','settings','help','about'])$(p+'Page').classList.toggle('hidden',p!==page);for(const n of document.querySelectorAll('[data-page]')){n.classList.toggle('selected',n.dataset.page===page);n.setAttribute('aria-current',n.dataset.page===page?'page':'false');}if(page==='settings')openSettings();}
for(const button of document.querySelectorAll('[data-page]'))button.onclick=()=>setPage(button.dataset.page);$('emptyConfigure').onclick=()=>setPage('settings');
async function changePreference(key,value){try{render(await api.configure({...current.settings,[key]:value}));}catch{toast('appError');}}
$('themeButton').onclick=()=>changePreference('theme',current.settings.theme==='dark'?'light':'dark');
$('mapBase').onchange=()=>changePreference('mapBase',$('mapBase').value);
for(const id of ['lat','lon'])$(id).oninput=()=>{const lat=Number($('lat').value),lon=Number($('lon').value);if($('lat').value&&$('lon').value&&coordinates(lat,lon))$('grid').value=toGrid(lat,lon);};
$('grid').onchange=()=>{const p=fromGrid($('grid').value.trim());if(p){$('lat').value=p.lat;$('lon').value=p.lon;}else toast('invalidGrid');};
$('locate').onclick=()=>{if(!navigator.geolocation){toast('locationError');return;}$('locate').disabled=true;navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude;$('lon').value=p.coords.longitude;$('grid').value=toGrid(p.coords.latitude,p.coords.longitude);$('locate').disabled=false;toast('locationFilled',{n:Math.round(p.coords.accuracy)});},()=>{$('locate').disabled=false;toast('locationError');},{timeout:15000,maximumAge:300000,enableHighAccuracy:true});};
for(const input of $('configForm').querySelectorAll('input')){input.addEventListener('invalid',()=>input.setCustomValidity(t('invalidSettings')));input.addEventListener('input',()=>input.setCustomValidity(''));}
$('configForm').onsubmit=async e=>{e.preventDefault();const s={...current.settings};try{for(const id of ['lat','lon','power','nearbyRadius','alertMinScore','alertMinDistance','alertCooldown','updateMinutes','dataRefreshMinutes'])s[id]=Number($(id).value);s.callsign=$('callsign').value;for(const kind of ['visible','alertBands'])s[kind]=[...$('bandSettings').querySelectorAll(`input[data-kind="${kind}"]:checked`)].map(n=>n.dataset.band);s.antennas={...s.antennas};for(const n of $('bandSettings').querySelectorAll('select'))s.antennas[n.dataset.antenna]={...s.antennas[n.dataset.antenna],type:n.value};render(await api.configure(s));setPage('map');toast('saved');await refresh();}catch{configErrorKey='invalidSettings';$('configError').textContent=t(configErrorKey);}};

$('band').onchange=()=>render(current);$('period').onchange=async()=>{try{const next=Number($('period').value);render(await api.configure({...current.settings,windowMinutes:next}));await refresh();}catch{toast('appError');}};
async function refresh(){$('refresh').disabled=true;try{render(await api.refresh());}catch{toast('appError');}finally{$('refresh').disabled=false;}}
$('refresh').onclick=()=>refresh();
$('version').onclick=async()=>{
  if(updateFlowActive)return;updateFlowActive=true;
  const checking={...(current.update||{}),state:'checking',percent:0,transferred:0,total:0};renderUpdate(checking);
  try{
    const u=await api.runUpdateFlow();if(u){current.update=u;renderUpdate(u);}
    if(u?.state==='current'){updateFlowActive=false;renderUpdate(u);if($('updateDialog').open)$('updateDialog').close();toast('currentVersion');}
    else if(u?.state==='development'){updateFlowActive=false;renderUpdate(u);if($('updateDialog').open)$('updateDialog').close();toast('development');}
    else if(u?.state==='error'){updateFlowActive=false;renderUpdate(u);toast('updateError');}
  }catch{updateFlowActive=false;renderUpdate({...current.update,state:'error'});toast('updateError');}
};
$('closeUpdate').onclick=()=>{if(!updateFlowActive)$('updateDialog').close();};$('openReleases').onclick=()=>api.openLink('releases');$('downloadUpdate').onclick=()=>{};$('installUpdate').onclick=()=>{};
for(const [id,target] of [['openProject','project'],['openIssues','issues'],['openProfile','profile'],['openManual','manual']])$(id).onclick=()=>api.openLink(target).catch(()=>toast('appError'));
$('factoryReset').onclick=async()=>{if(!window.confirm(t('factoryResetConfirm')))return;$('factoryReset').disabled=true;try{await api.factoryReset();}catch{$('factoryReset').disabled=false;toast('factoryResetError');}};
$('closeNews').onclick=async()=>{try{await api.acknowledgeNews();}finally{$('newsDialog').close();}};
$('dismissAlert').onclick=()=>$('alertDialog').close();$('viewAlert').onclick=()=>{$('band').value=alertBand;$('alertDialog').close();setPage('map');render(current);};
$('zoomIn').onclick=()=>zoom(1.4);$('zoomOut').onclick=()=>zoom(1/1.4);$('resetMap').onclick=()=>{scale=1;tx=ty=0;mapTransform();};window.addEventListener('resize',scheduleMapOverlays);$('map').addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
function updateCursorReadout(e){
  const info=$('cursorInfo');if(!current||!coordinates(current.settings.lat,current.settings.lon)){info.classList.add('hidden');return;}
  const matrix=$('world').getScreenCTM();if(!matrix){info.classList.add('hidden');return;}const point=$('map').createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform(matrix.inverse());
  if(p.x<0||p.x>1080||p.y<0||p.y>540){info.classList.add('hidden');return;}const target={lon:p.x/3-180,lat:90-p.y/3},home={lat:current.settings.lat,lon:current.settings.lon},km=distance(home,target),az=bearing(home,target),cardinal=['N','NE','E','SE','S','SW','W','NW'][Math.round(az/45)%8];
  info.textContent=`${cardinal} ${Math.round(az)}° · ${km<10?km.toFixed(1):Math.round(km)} km`;info.classList.remove('hidden');
}
$('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.clientX,y:e.clientY,tx,ty};$('map').setPointerCapture(e.pointerId);});$('map').addEventListener('pointermove',e=>{updateCursorReadout(e);if(!pointer)return;const rect=$('map').getBoundingClientRect(),ratio=Math.min(rect.width/1080,rect.height/540);tx=pointer.tx+(e.clientX-pointer.x)/ratio;ty=pointer.ty+(e.clientY-pointer.y)/ratio;mapTransform();});$('map').addEventListener('pointerleave',()=>$('cursorInfo').classList.add('hidden'));for(const type of ['pointerup','pointercancel'])$('map').addEventListener(type,()=>pointer=null);
for(const id of ['logDirection','logSource'])$(id).onchange=renderLogs;$('logSearch').oninput=renderLogs;$('pauseLogs').onclick=()=>{logsPaused=!logsPaused;$('pauseLogs').textContent=t(logsPaused?'resume':'pause');if(!logsPaused)renderLogs();};$('clearLogs').onclick=async()=>{await api.clearLogs();if(current)current.logs=[];renderLogs();};$('exportLogs').onclick=()=>api.exportLogs().then(ok=>{if(ok)toast('exported');}).catch(()=>toast('appError'));
function answer(question){return assistantReply(question,current,$('band').value,{countries:countryFeatures,language});}
function renderConversation(){$('conversation').replaceChildren();for(const item of conversation){const p=document.createElement('p');p.className=item.user?'userMessage':'assistantMessage';const vars={...item.vars,age:age(item.vars?.latest),basis:item.vars?.basisKey?t(item.vars.basisKey):'',psk:item.vars?.psk?t('sourceState_'+item.vars.psk):item.vars?.psk,rbn:item.vars?.rbn?t('sourceState_'+item.vars.rbn):item.vars?.rbn,wspr:item.vars?.wspr?t('sourceState_'+item.vars.wspr):item.vars?.wspr,noaa:item.vars?.noaa?t('sourceState_'+item.vars.noaa):item.vars?.noaa};p.textContent=item.user||t(item.key,vars);$('conversation').append(p);}}
$('chat').onsubmit=e=>{e.preventDefault();const q=$('question').value.trim();if(!q)return;conversation.push({user:q},answer(q));while(conversation.length>41)conversation.splice(1,2);renderConversation();$('conversation').scrollTop=$('conversation').scrollHeight;$('question').value='';};
api.subscribe(render);render(await api.snapshot());document.documentElement.dataset.ready='true';
