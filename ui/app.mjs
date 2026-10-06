import {BANDS,DEFAULT_SETTINGS,validateSettings,toGrid,fromGrid,coordinates,evaluateBand} from '../src/domain.mjs';
import {LANGUAGES,translate} from '../src/i18n.mjs';
import {APP_VERSION} from '../src/version.mjs';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const colors=['#bab1dc','#ad9ce5','#738fea','#76a8fa','#6bbee9','#57d3b4','#b0de74','#e4da68','#efbd7a','#ef837a','#dca0f0','#86dbf1','#ecade0','#90cda0'];
const color=band=>colors[BANDS.findIndex(b=>b.name===band)]||'#6fe2bf';
let current,alertBand,scale=1,tx=0,ty=0,pointer,page='map',language='pt-BR',toastTimer,toastKey,configErrorKey;
const listeners=[],conversation=[{key:'welcome'}];
const t=(key,vars)=>translate(language,key,vars);
function previewSnapshot(settings,scope='station') {
  if(!settings){try{settings=validateSettings(JSON.parse(localStorage.getItem('prop-settings'))||DEFAULT_SETTINGS);}catch{settings=validateSettings(DEFAULT_SETTINGS);}}
  return {version:APP_VERSION,portable:false,settings,scope,spots:[],bands:BANDS.map(b=>evaluateBand([],b.name)),kp:null,sourceStatus:{psk:{state:'preview'},noaa:{state:'preview'}},update:{state:'development',notes:''},now:Date.now(),nextPSK:0};
}
const api=window.propTool||{
  snapshot:async()=>previewSnapshot(),
  configure:async s=>{const settings=validateSettings(s);localStorage.setItem('prop-settings',JSON.stringify(settings));current=previewSnapshot(settings,current?.scope);listeners.forEach(fn=>fn(current));return current;},
  refresh:async scope=>{current=previewSnapshot(current.settings,scope);listeners.forEach(fn=>fn(current));return current;},subscribe:fn=>{listeners.push(fn);return ()=>{};},checkUpdate:async()=>current.update,
  downloadUpdate:async()=>toast('development'),installUpdate:async()=>{},openLink:async target=>window.open({project:'https://github.com/alexpmr/PT2VHF-Prop-Tool',issues:'https://github.com/alexpmr/PT2VHF-Prop-Tool/issues',profile:'https://github.com/alexpmr',releases:'https://github.com/alexpmr/PT2VHF-Prop-Tool/releases',manual:`https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v${APP_VERSION}/PT2VHF-Prop-Tool-${APP_VERSION}-Manual.pdf`}[target],'_blank','noopener')
};
function svgNode(name,attrs={},parent){const node=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(parent)parent.append(node);return node;}
const project=([lon,lat])=>[(lon+180)*3,(90-lat)*3];
function ringPath(ring){return ring.map((v,i)=>`${i?'L':'M'}${project(v).join(',')}`).join(' ')+' Z';}
function mapTransform(){$('world').setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);}
function zoom(f){const next=Math.max(1,Math.min(6,scale*f));tx=540-(540-tx)*next/scale;ty=270-(270-ty)*next/scale;scale=next;mapTransform();}
for(let lon=-180;lon<=180;lon+=30)svgNode('path',{d:`M${(lon+180)*3},0 V540`},$('graticule'));
for(let lat=-60;lat<=60;lat+=30)svgNode('path',{d:`M0,${(90-lat)*3} H1080`},$('graticule'));
try{const land=await (await fetch('land.geojson')).json();for(const f of land.features){const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];for(const rings of polygons)svgNode('path',{d:rings.map(ringPath).join(' '),'fill-rule':'evenodd'},$('land'));}}catch{toast('mapError');}
for(const band of BANDS){const option=document.createElement('option');option.value=option.textContent=band.name;$('band').append(option);}
for(const item of LANGUAGES){const button=document.createElement('button');button.type='button';button.dataset.language=item.code;const img=document.createElement('img');img.src=`flags/${item.flag}.svg`;img.alt='';button.append(img,document.createTextNode(item.name));button.onclick=()=>{changePreference('language',item.code);$('languageMenu').open=false;};$('languages').append(button);}
function paintTranslations(){
  document.documentElement.lang=language;document.documentElement.dataset.theme=current.settings.theme;
  for(const [attr,target] of [['data-i18n','textContent'],['data-i18n-title','title'],['data-i18n-aria','aria-label'],['data-i18n-placeholder','placeholder']])for(const node of document.querySelectorAll(`[${attr}]`)){const val=t(node.getAttribute(attr));if(target==='textContent')node.textContent=val;else node.setAttribute(target,val);}
  for(const n of [15,30])$('period').querySelector(`[value="${n}"]`).textContent=t('minutes',{n});
  $('period').setAttribute('aria-label',t('minutes',{n:current.settings.windowMinutes}));
  const selected=LANGUAGES.find(l=>l.code===language);$('languageFlag').src=`flags/${selected.flag}.svg`;$('currentLanguage').textContent=selected.name;$('languageMenu').querySelector('summary').title=t('language');
  for(const n of $('languages').querySelectorAll('button'))n.setAttribute('aria-pressed',String(n.dataset.language===language));
  $('themeButton').textContent=(current.settings.theme==='dark'?'☀ ':'☾ ')+t(current.settings.theme==='dark'?'light':'dark');$('themeButton').title=t('theme');
  if(configErrorKey)$('configError').textContent=t(configErrorKey);if(toastKey)$('toast').textContent=t(toastKey.key,toastKey.vars);
  for(const n of $('bandSettings').querySelectorAll('select'))n.setAttribute('aria-label',t('antennaFor',{band:n.dataset.antenna}));
  renderConversation();
}
function age(time){if(!time)return t('noData');const n=Math.max(0,Math.floor((Date.now()-time)/60000));return n<1?t('justNow'):t('ago',{n});}
const date=time=>new Date(time).toLocaleString(language);
const bandStates={'Sem evidências':'none','Evidência forte':'strong','Evidência moderada':'moderate','Evidência limitada':'limited'};
function sourceLabel(status){return t({online:'online',loading:'loading',error:'sourceError',preview:'preview'}[status.state]||'waiting');}
function render(snap){
  current=snap;language=snap.settings.language;paintTranslations();$('appVersion').textContent=$('aboutVersion').textContent=`v${snap.version}`;
  const status=snap.sourceStatus.psk;$('status').textContent=sourceLabel(status);$('stationLabel').textContent=snap.settings.callsign||t('configure');
  $('stationView').classList.toggle('selected',snap.scope==='station');$('nearbyView').classList.toggle('selected',snap.scope==='nearby');$('period').value=String(snap.settings.windowMinutes);
  $('viewNotice').textContent=t(snap.scope==='station'?'stationNotice':'nearbyNotice',{n:snap.settings.nearbyRadius});
  if($('band').value&&!snap.settings.visible.includes($('band').value))$('band').value='';
  $('bands').replaceChildren();$('bandCount').textContent=t('bandCount',{n:snap.settings.visible.length});
  for(const b of snap.bands.filter(b=>snap.settings.visible.includes(b.band))){
    const row=document.createElement('button');row.className='bandRow';if($('band').value===b.band)row.classList.add('selected');
    const label=document.createElement('strong');label.textContent=b.band;label.style.color=color(b.band);
    const desc=document.createElement('div'),state=document.createElement('span');state.className='state';state.textContent=t(bandStates[b.state]||'none')+' '+b.trend;
    const detail=document.createElement('small');detail.textContent=b.reports?t('reports',{n:b.reports,pairs:b.pairs})+' · '+age(b.latest):t('insufficient');
    const index=document.createElement('span');index.className='score';index.textContent=b.score??'—';desc.append(state,detail);row.append(label,desc,index);row.onclick=()=>{$('band').value=$('band').value===b.band?'':b.band;render(current);};$('bands').append(row);
  }
  $('zones').replaceChildren();$('points').replaceChildren();$('home').replaceChildren();
  const displayed=snap.bands.filter(b=>snap.settings.visible.includes(b.band)&&(!$('band').value||b.band===$('band').value));let zoneCount=0,pointCount=0;
  for(const b of displayed)for(const zone of b.zones){zoneCount++;const p=svgNode('path',{d:zone.rings.map(ringPath).join(' '),fill:color(b.band),stroke:color(b.band)},$('zones'));svgNode('title',{},p).textContent=t('zoneTip',{band:b.band,n:zone.reportCount,pairs:zone.pairs});}
  const shownBands=new Set(displayed.map(b=>b.band));
  for(const s of snap.spots.filter(p=>shownBands.has(p.band))){pointCount++;const [cx,cy]=project([s.endpoint.lon,s.endpoint.lat]);const c=svgNode('circle',{cx,cy,r:1.8,fill:color(s.band)},$('points'));const mode=s.mode==='Não informado'?t('unknownMode'):s.mode;const direction=t({'direct-tx':'txReceived','direct-rx':'rxHome',nearby:'rxNearby'}[s.origin]||'observed');svgNode('title',{},c).textContent=`${s.tx} → ${s.rx} · ${s.band} · ${mode}\n${direction} · ${Math.round(s.distance)} km · ${Math.round(s.bearing)}°\n${date(s.timestamp)} · ${s.source}${s.snr===null?'':` · SNR ${s.snr} dB`}`;}
  const configured=Boolean(snap.settings.callsign)&&coordinates(snap.settings.lat,snap.settings.lon);
  if(configured){const [cx,cy]=project([snap.settings.lon,snap.settings.lat]);svgNode('circle',{cx,cy,r:3.6},$('home'));svgNode('text',{x:cx+7,y:cy-5},$('home')).textContent=snap.settings.callsign;}
  $('empty').classList.toggle('hidden',configured);$('emptyTitle').textContent=t('configure');$('emptyConfigure').hidden=configured;
  $('mapNotice').classList.toggle('hidden',!configured||pointCount>0);$('mapNotice').textContent=status.state==='error'?t('sourceError'):status.state==='loading'?t('loading'):status.state==='preview'?t('previewNotice'):t('emptyTitle');$('mapNotice').title=t('emptyBody');
  $('evidenceCount').textContent=t('counts',{n:pointCount,zones:zoneCount});const query=status.state==='online'?t('queryCount',{n:status.count??0}):sourceLabel(status);
  $('freshness').textContent=`PSK: ${query}${status.updated?' · '+age(status.updated):''}${snap.nextPSK>0?' · '+t('nextQuery',{n:Math.ceil(snap.nextPSK/60000)}):''}`;
  const kp=snap.kp;$('kp').textContent=kp?kp.value.toLocaleString(language,{minimumFractionDigits:1,maximumFractionDigits:1}):'—';$('kpState').textContent=kp?t(Date.now()-kp.timestamp>4*3600000?'oldMeasure':kp.value>=5?'elevated':'measurement'):sourceLabel(snap.sourceStatus.noaa);$('kpTime').textContent=kp?`${date(kp.timestamp)} · ${t('kpNote')}`:t('kpWaiting');
  renderUpdate(snap.update);if(snap.alert){alertBand=snap.alert.band;$('alertText').textContent=t('alertText',{band:alertBand,n:snap.alert.score});if(!$('alertDialog').open)$('alertDialog').showModal();}
}
function renderUpdate(u){
  const key={current:'currentVersion',available:'newVersion',checking:'checking',downloading:'downloading',downloaded:'downloaded',error:'updateError',development:'development'}[u.state]||'checkUpdate';
  $('version').textContent=t(key,{n:Math.round(u.percent||0)});$('version').classList.toggle('available',u.state==='available');$('version').classList.toggle('current',u.state==='current');$('version').disabled=['checking','downloading'].includes(u.state);
  $('updateMessage').textContent=t(u.state==='available'?'updateAvailable':key,{version:u.version,n:Math.round(u.percent||0)});
  $('releaseNotes').textContent=t('noNotes'); // Published release notes are opened in their original language.
  $('downloadUpdate').classList.toggle('hidden',u.state!=='available');$('installUpdate').classList.toggle('hidden',u.state!=='downloaded');$('updateProgress').classList.toggle('hidden',u.state!=='downloading');$('updateProgress').value=u.percent||0;
}
function toast(key,vars={}){toastKey={key,vars};clearTimeout(toastTimer);$('toast').textContent=t(key,vars);$('toast').style.display='block';toastTimer=setTimeout(()=>{$('toast').style.display='none';toastKey=null;},6000);}
const antennaTypes=[['Não informada','unspecified'],['Dipolo','dipole'],['Vertical','vertical'],['Yagi',null],['Log-periódica','logPeriodic'],['Loop','loop'],['End Fed',null],['Hexbeam',null],['Cobweb',null],['Discone',null],['Colinear','collinear'],['Outra','other']];
function openSettings(){
  const s=current.settings;for(const id of ['callsign','lat','lon','power','alertMinScore','alertMinDistance','alertCooldown','updateMinutes'])$(id).value=s[id]??'';$('grid').value=coordinates(s.lat,s.lon)?toGrid(s.lat,s.lon):'';configErrorKey=null;$('configError').textContent='';$('bandSettings').replaceChildren();
  for(const b of BANDS){const row=document.createElement('div');row.className='bandConfig';const visible=document.createElement('label'),v=document.createElement('input');v.type='checkbox';v.dataset.band=b.name;v.dataset.kind='visible';v.checked=s.visible.includes(b.name);visible.append(v,document.createTextNode(b.name));const alert=document.createElement('label'),a=document.createElement('input');a.type='checkbox';a.dataset.band=b.name;a.dataset.kind='alertBands';a.checked=s.alertBands.includes(b.name);const span=document.createElement('span');span.dataset.i18n='alert';alert.append(a,span);const type=document.createElement('select');type.dataset.antenna=b.name;for(const [value,key] of antennaTypes){const o=document.createElement('option');o.value=value;if(key)o.dataset.i18n=key;else o.textContent=value;type.append(o);}type.value=s.antennas[b.name]?.type||'Vertical';row.append(visible,alert,type);$('bandSettings').append(row);}paintTranslations();
}
function setPage(next){if(!['map','help','settings','about'].includes(next))return;page=next;for(const p of ['map','help','settings','about'])$(p+'Page').classList.toggle('hidden',p!==page);for(const n of document.querySelectorAll('[data-page]')){n.classList.toggle('selected',n.dataset.page===page);n.setAttribute('aria-current',n.dataset.page===page?'page':'false');}if(page==='settings')openSettings();}
for(const button of document.querySelectorAll('[data-page]'))button.onclick=()=>setPage(button.dataset.page);$('emptyConfigure').onclick=()=>setPage('settings');
async function changePreference(key,value){try{render(await api.configure({...current.settings,[key]:value}));}catch{toast('appError');}}
$('themeButton').onclick=()=>changePreference('theme',current.settings.theme==='dark'?'light':'dark');
for(const id of ['lat','lon'])$(id).oninput=()=>{const lat=Number($('lat').value),lon=Number($('lon').value);if($('lat').value&&$('lon').value&&coordinates(lat,lon))$('grid').value=toGrid(lat,lon);};
$('grid').onchange=()=>{const p=fromGrid($('grid').value.trim());if(p){$('lat').value=p.lat;$('lon').value=p.lon;}else toast('invalidGrid');};
$('locate').onclick=()=>{if(!navigator.geolocation){toast('locationError');return;}$('locate').disabled=true;navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude;$('lon').value=p.coords.longitude;$('grid').value=toGrid(p.coords.latitude,p.coords.longitude);$('locate').disabled=false;toast('locationFilled',{n:Math.round(p.coords.accuracy)});},()=>{$('locate').disabled=false;toast('locationError');},{timeout:15000,maximumAge:300000,enableHighAccuracy:true});};
for(const input of $('configForm').querySelectorAll('input')){input.addEventListener('invalid',()=>input.setCustomValidity(t('invalidSettings')));input.addEventListener('input',()=>input.setCustomValidity(''));}
$('configForm').onsubmit=async e=>{e.preventDefault();const s={...current.settings};try{for(const id of ['lat','lon','power','alertMinScore','alertMinDistance','alertCooldown','updateMinutes'])s[id]=Number($(id).value);s.callsign=$('callsign').value;for(const kind of ['visible','alertBands'])s[kind]=[...$('bandSettings').querySelectorAll(`input[data-kind="${kind}"]:checked`)].map(n=>n.dataset.band);s.antennas={...s.antennas};for(const n of $('bandSettings').querySelectorAll('select'))s.antennas[n.dataset.antenna]={...s.antennas[n.dataset.antenna],type:n.value};render(await api.configure(s));setPage('map');toast('saved');refresh();}catch{configErrorKey='invalidSettings';$('configError').textContent=t(configErrorKey);}};
$('band').onchange=()=>render(current);$('period').onchange=async()=>{try{render(await api.configure({...current.settings,windowMinutes:Number($('period').value)}));}catch{toast('appError');}};
async function refresh(scope=current.scope){$('refresh').disabled=true;try{render(await api.refresh(scope));}catch{toast('appError');}finally{$('refresh').disabled=false;}}
$('refresh').onclick=()=>refresh();$('stationView').onclick=()=>refresh('station');$('nearbyView').onclick=()=>refresh('nearby');
$('version').onclick=async()=>{$('updateDialog').showModal();try{if(current.update.state==='available'){await api.downloadUpdate();}else{const u=await api.checkUpdate();current.update=u;renderUpdate(u);}}catch{toast('updateError');}};
$('closeUpdate').onclick=()=>$('updateDialog').close();$('openReleases').onclick=()=>api.openLink('releases');$('downloadUpdate').onclick=()=>api.downloadUpdate().catch(()=>toast('updateError'));$('installUpdate').onclick=()=>api.installUpdate().catch(()=>toast('updateError'));
for(const [id,target] of [['openProject','project'],['openIssues','issues'],['openProfile','profile'],['openManual','manual']])$(id).onclick=()=>api.openLink(target).catch(()=>toast('appError'));
$('dismissAlert').onclick=()=>$('alertDialog').close();$('viewAlert').onclick=()=>{$('band').value=alertBand;$('alertDialog').close();setPage('map');render(current);};
$('zoomIn').onclick=()=>zoom(1.4);$('zoomOut').onclick=()=>zoom(1/1.4);$('resetMap').onclick=()=>{scale=1;tx=ty=0;mapTransform();};$('map').addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
$('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.clientX,y:e.clientY,tx,ty};$('map').setPointerCapture(e.pointerId);});$('map').addEventListener('pointermove',e=>{if(!pointer)return;const rect=$('map').getBoundingClientRect(),ratio=Math.min(rect.width/1080,rect.height/540);tx=pointer.tx+(e.clientX-pointer.x)/ratio;ty=pointer.ty+(e.clientY-pointer.y)/ratio;mapTransform();});for(const type of ['pointerup','pointercancel'])$('map').addEventListener(type,()=>pointer=null);
function answer(question){const s=current,available=s.bands.filter(b=>s.settings.visible.includes(b.band)&&b.score!==null).sort((a,b)=>b.score-a.score);if(/muf|tep|tropo|ssb|cw|predict|previs|prévi|prognos|previsione|por qu[eê]|why|pourquoi|warum|perché/i.test(question))return {key:'answerLimits'};if(!available.length)return {key:'answerEmpty',vars:{n:s.settings.windowMinutes}};const b=available[0];return {key:'answerBest',vars:{band:b.band,score:b.score,n:b.reports,pairs:b.pairs,tx:b.txReports,rx:b.rxReports,latest:b.latest,scopeKey:s.scope==='station'?'station':'nearby'}};}
function renderConversation(){$('conversation').replaceChildren();for(const item of conversation){const p=document.createElement('p');p.className=item.user?'userMessage':'assistantMessage';p.textContent=item.user||t(item.key,{...item.vars,age:age(item.vars?.latest),scope:item.vars?.scopeKey?t(item.vars.scopeKey):''});$('conversation').append(p);}}
$('chat').onsubmit=e=>{e.preventDefault();const q=$('question').value.trim();if(!q)return;conversation.push({user:q},answer(q));while(conversation.length>41)conversation.splice(1,2);renderConversation();$('conversation').scrollTop=$('conversation').scrollHeight;$('question').value='';};
api.subscribe(render);render(await api.snapshot());document.documentElement.dataset.ready='true';
