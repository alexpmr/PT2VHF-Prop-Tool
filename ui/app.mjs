import {BANDS,DEFAULT_SETTINGS,validateSettings,toGrid,fromGrid,coordinates,evaluateBand} from '../src/domain.mjs';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const colors=['#bab1dc','#ad9ce5','#738fea','#76a8fa','#6bbee9','#57d3b4','#b0de74','#e4da68','#ebae69','#ef837a','#dca0f0','#86dbf1','#ecade0'];
const color=band=>colors[BANDS.findIndex(b=>b.name===band)]||'#6fe2bf';
let current,alertBand,scale=1,tx=0,ty=0,pointer;
const listeners=[];
function previewSnapshot(settings=DEFAULT_SETTINGS,scope='station') {
  return {version:'0.1.0',portable:false,settings,scope,spots:[],bands:BANDS.map(b=>evaluateBand([],b.name)),kp:null,
    sourceStatus:{psk:{state:'preview',message:'Prévia no navegador: consulta disponível no aplicativo Windows'},noaa:{state:'preview',message:'Sem consulta nesta prévia'}},
    update:{state:'development',message:'Projeto inicial: publicação ainda pendente',notes:''},now:Date.now(),nextPSK:0};
}
const api=window.propTool||{
  snapshot:async()=>previewSnapshot(),
  configure:async s=>{current=previewSnapshot(validateSettings(s),current?.scope);listeners.forEach(fn=>fn(current));return current;},
  refresh:async scope=>{current=previewSnapshot(current.settings,scope);listeners.forEach(fn=>fn(current));return current;},
  subscribe:fn=>{listeners.push(fn);return ()=>{};},
  checkUpdate:async()=>current.update,
  downloadUpdate:async()=>toast('Downloads disponíveis após a publicação do projeto.'),
  installUpdate:async()=>{},openReleases:async()=>toast('A criação do repositório ainda está pendente.')
};
function svgNode(name,attrs={},parent){const node=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(parent)parent.append(node);return node;}
const project=([lon,lat])=>[(lon+180)*3,(90-lat)*3];
function ringPath(ring){return ring.map((v,i)=>`${i?'L':'M'}${project(v).join(',')}`).join(' ')+' Z';}
function mapTransform(){$('world').setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);}
function zoom(f){const next=Math.max(1,Math.min(6,scale*f));tx=540-(540-tx)*next/scale;ty=270-(270-ty)*next/scale;scale=next;mapTransform();}
for(let lon=-180;lon<=180;lon+=30)svgNode('path',{d:`M${(lon+180)*3},0 V540`},$('graticule'));
for(let lat=-60;lat<=60;lat+=30)svgNode('path',{d:`M0,${(90-lat)*3} H1080`},$('graticule'));
try{
  const land=await (await fetch('land.geojson')).json();
  for(const f of land.features){const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];for(const rings of polygons)svgNode('path',{d:rings.map(ringPath).join(' '),'fill-rule':'evenodd'},$('land'));}
}catch(e){toast('Não foi possível carregar o mapa offline. '+e.message);}
for(const band of BANDS){const option=document.createElement('option');option.value=band.name;option.textContent=band.name;$('band').append(option);}
function age(t){if(!t)return 'sem dados';const min=Math.max(0,Math.floor((Date.now()-t)/60000));return min<1?'há menos de 1 min':`há ${min} min`;}
function render(snap){
  current=snap;$('version').textContent=`v${snap.version}`;$('version').classList.toggle('available',snap.update.state==='available');
  const status=snap.sourceStatus.psk;$('status').textContent=status.state==='online'?'PSK conectado':status.state==='loading'?'Consultando…':status.state==='error'?'Fonte indisponível':status.state==='preview'?'Prévia da interface':'Aguardando dados';
  $('stationLabel').textContent=snap.settings.callsign||'Configure sua estação';
  $('stationView').classList.toggle('selected',snap.scope==='station');$('nearbyView').classList.toggle('selected',snap.scope==='nearby');
  $('viewNotice').textContent=snap.scope==='station'?'Sua transmissão recebida ou recepções da sua estação. Sem garantia de contato.':`Estações TX a até ${snap.settings.nearbyRadius} km. Evidência regional; alcance da sua estação não confirmado.`;
  $('bands').replaceChildren();$('bandCount').textContent=snap.settings.visible.length+' bandas';
  for(const b of snap.bands.filter(b=>snap.settings.visible.includes(b.band))){
    const row=document.createElement('button');row.className='bandRow';if($('band').value===b.band)row.classList.add('selected');
    const label=document.createElement('strong');label.textContent=b.band;label.style.color=color(b.band);
    const desc=document.createElement('div'),state=document.createElement('span');state.className='state';state.textContent=b.state+' '+b.trend;
    const detail=document.createElement('small');detail.textContent=b.reports?`${b.reports} recepções · ${b.pairs} enlaces · ${age(b.latest)}`:'Dados insuficientes para avaliar';
    const index=document.createElement('span');index.className='score';index.textContent=b.score??'—';desc.append(state,detail);row.append(label,desc,index);
    row.onclick=()=>{$('band').value=$('band').value===b.band?'':b.band;render(current);};$('bands').append(row);
  }
  $('zones').replaceChildren();$('points').replaceChildren();$('home').replaceChildren();
  const displayed=snap.bands.filter(b=>snap.settings.visible.includes(b.band)&&(!$('band').value||b.band===$('band').value));
  let zoneCount=0,pointCount=0;
  for(const b of displayed){for(const zone of b.zones){zoneCount++;const p=svgNode('path',{d:zone.rings.map(ringPath).join(' '),fill:color(b.band),stroke:color(b.band)},$('zones'));
    const title=svgNode('title',{},p);title.textContent=`${b.band} · ${zone.reportCount} recepções · ${zone.pairs} enlaces · células observadas de 2°. Área entre pontos não confirmada.`;
  }}
  const shownBands=new Set(displayed.map(b=>b.band));
  for(const s of snap.spots.filter(p=>shownBands.has(p.band))){pointCount++;const [cx,cy]=project([s.endpoint.lon,s.endpoint.lat]);const c=svgNode('circle',{cx,cy,r:1.8,fill:color(s.band)},$('points'));
    const title=svgNode('title',{},c);title.textContent=`${s.tx} → ${s.rx} · ${s.band} · ${s.mode}\n${s.direction} · ${Math.round(s.distance)} km · azimute ${Math.round(s.bearing)}°\n${new Date(s.timestamp).toLocaleString('pt-BR')} · ${s.source}${s.snr===null?'':` · SNR ${s.snr} dB`}`;
  }
  if(coordinates(snap.settings.lat,snap.settings.lon)){const [cx,cy]=project([snap.settings.lon,snap.settings.lat]);svgNode('circle',{cx,cy,r:3.6},$('home'));const label=svgNode('text',{x:cx+7,y:cy-5},$('home'));label.textContent=snap.settings.callsign||'Minha estação';}
  $('empty').classList.toggle('hidden',pointCount>0);
  if(coordinates(snap.settings.lat,snap.settings.lon)){
    $('empty').querySelector('strong').textContent='Sem evidências para este filtro';
    $('empty').querySelector('p').textContent=status.state==='error'?`Fonte indisponível: ${status.message}. Isso não significa banda fechada.`:status.state==='preview'?status.message:'Nenhuma recepção recente com localização foi encontrada. Isso não significa banda fechada. Confira também o período e as bandas selecionadas.';
  }
  $('evidenceCount').textContent=`${pointCount} recepções · ${zoneCount} zonas`;
  $('freshness').textContent=`PSK: ${status.message}${status.updated?' · consulta '+age(status.updated):''}${snap.nextPSK>0?' · próxima em '+Math.ceil(snap.nextPSK/60000)+' min':''}`;
  const kp=snap.kp;$('kp').textContent=kp?kp.value.toFixed(1):'—';
  $('kpState').textContent=kp?(Date.now()-kp.timestamp>4*3600000?'Medição antiga':kp.value>=5?'Atividade elevada':'Medição disponível'):snap.sourceStatus.noaa.state==='error'?'Fonte indisponível':'Aguardando';
  $('kpTime').textContent=kp?`${new Date(kp.timestamp).toLocaleString('pt-BR')} · índice global de 3 h; não confirma abertura de banda.`:'Medição com horário próprio, independente dos spots.';
  renderUpdate(snap.update);
  if(snap.alert){alertBand=snap.alert.band;$('alertText').textContent=`${alertBand}: índice ${snap.alert.score}/100, sustentado por recepções da sua transmissão. Confira a direção e o modo no mapa.`;if(!$('alertDialog').open)$('alertDialog').showModal();}
}
function renderUpdate(u){$('updateMessage').textContent=u.message;$('releaseNotes').textContent=u.notes||'As notas da versão serão exibidas quando houver uma publicação disponível.';$('downloadUpdate').classList.toggle('hidden',u.state!=='available');$('downloadUpdate').textContent=current?.portable?'Baixar versão portátil':'Baixar atualização';$('installUpdate').classList.toggle('hidden',u.state!=='downloaded');}
let toastTimer;function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',6000);}
const antennaTypes=['Não informada','Dipolo','Vertical','Yagi','Log-periódica','Loop','End Fed','Hexbeam','Cobweb','Discone','Colinear','Outra'];
function openSettings(){
  const s=current.settings;for(const id of ['callsign','lat','lon','power','alertMinScore','alertMinDistance','alertCooldown','updateMinutes'])$(id).value=s[id]??'';
  $('grid').value=coordinates(s.lat,s.lon)?toGrid(s.lat,s.lon):'';$('configError').textContent='';$('bandSettings').replaceChildren();
  for(const b of BANDS){const row=document.createElement('div');row.className='bandConfig';
    const visible=document.createElement('label'),v=document.createElement('input');v.type='checkbox';v.dataset.band=b.name;v.dataset.kind='visible';v.checked=s.visible.includes(b.name);visible.append(v,document.createTextNode(b.name));
    const alert=document.createElement('label'),a=document.createElement('input');a.type='checkbox';a.dataset.band=b.name;a.dataset.kind='alertBands';a.checked=s.alertBands.includes(b.name);alert.append(a,document.createTextNode('Alertar'));
    const type=document.createElement('select');type.setAttribute('aria-label','Antena para '+b.name);type.dataset.antenna=b.name;
    for(const t of antennaTypes){const o=document.createElement('option');o.textContent=t;type.append(o);}type.value=s.antennas[b.name]?.type||'Não informada';
    row.append(visible,alert,type);$('bandSettings').append(row);
  }
  $('settings').showModal();
}
for(const id of ['settingsButton','emptyConfigure'])$(id).onclick=openSettings;
$('closeSettings').onclick=()=>$('settings').close();
for(const id of ['lat','lon'])$(id).oninput=()=>{const lat=Number($('lat').value),lon=Number($('lon').value);if($('lat').value&&$('lon').value&&coordinates(lat,lon))$('grid').value=toGrid(lat,lon);};
$('grid').onchange=()=>{const p=fromGrid($('grid').value.trim());if(p){$('lat').value=p.lat;$('lon').value=p.lon;}else toast('Grid inválido. Use quatro, seis ou oito caracteres.');};
$('locate').onclick=()=>{
  if(!navigator.geolocation){toast('Localização automática indisponível. Informe as coordenadas ou o Grid.');return;}
  $('locate').disabled=true;navigator.geolocation.getCurrentPosition(p=>{$('lat').value=p.coords.latitude;$('lon').value=p.coords.longitude;$('grid').value=toGrid(p.coords.latitude,p.coords.longitude);$('locate').disabled=false;toast(`Posição preenchida. Precisão informada: ${Math.round(p.coords.accuracy)} m. Confira a antena.`);},()=>{$('locate').disabled=false;toast('Não foi possível obter a localização. Informe coordenadas ou Grid.');},{timeout:15000,maximumAge:300000,enableHighAccuracy:true});
};
$('configForm').onsubmit=async e=>{e.preventDefault();const s={...current.settings};try{
  for(const id of ['lat','lon','power','alertMinScore','alertMinDistance','alertCooldown','updateMinutes'])s[id]=Number($(id).value);
  s.callsign=$('callsign').value;
  for(const kind of ['visible','alertBands'])s[kind]=[...$('bandSettings').querySelectorAll(`input[data-kind="${kind}"]:checked`)].map(n=>n.dataset.band);
  s.antennas={...s.antennas};for(const n of $('bandSettings').querySelectorAll('select'))s.antennas[n.dataset.antenna]={...s.antennas[n.dataset.antenna],type:n.value};
  render(await api.configure(s));$('settings').close();await api.refresh(current.scope);toast('Configuração salva.');
}catch(err){$('configError').textContent=err.message;}};
$('band').onchange=()=>render(current);
$('period').onchange=async()=>{try{render(await api.configure({...current.settings,windowMinutes:Number($('period').value)}));}catch(e){toast(e.message);}};
async function refresh(scope=current.scope){$('refresh').disabled=true;try{render(await api.refresh(scope));}catch(e){toast(e.message);}finally{$('refresh').disabled=false;}}
$('refresh').onclick=()=>refresh();$('stationView').onclick=()=>refresh('station');$('nearbyView').onclick=()=>refresh('nearby');
$('version').onclick=async()=>{$('updateDialog').showModal();try{renderUpdate(await api.checkUpdate());}catch(e){toast(e.message);}};
$('closeUpdate').onclick=()=>$('updateDialog').close();$('openReleases').onclick=()=>api.openReleases();
$('downloadUpdate').onclick=()=>api.downloadUpdate().catch(e=>toast(e.message));$('installUpdate').onclick=()=>api.installUpdate().catch(e=>toast(e.message));
$('dismissAlert').onclick=()=>$('alertDialog').close();$('viewAlert').onclick=()=>{$('band').value=alertBand;$('alertDialog').close();render(current);};
$('zoomIn').onclick=()=>zoom(1.4);$('zoomOut').onclick=()=>zoom(1/1.4);$('resetMap').onclick=()=>{scale=1;tx=ty=0;mapTransform();};
$('map').addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
$('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.clientX,y:e.clientY,tx,ty};$('map').setPointerCapture(e.pointerId);});
$('map').addEventListener('pointermove',e=>{if(!pointer)return;const rect=$('map').getBoundingClientRect(),ratio=Math.min(rect.width/1080,rect.height/540);tx=pointer.tx+(e.clientX-pointer.x)/ratio;ty=pointer.ty+(e.clientY-pointer.y)/ratio;mapTransform();});
for(const type of ['pointerup','pointercancel'])$('map').addEventListener(type,()=>pointer=null);
function answer(question){
  const s=current,available=s.bands.filter(b=>s.settings.visible.includes(b.band)&&b.score!==null).sort((a,b)=>b.score-a.score);
  if(/por qu[eê]|muf|tep|espor[aá]dica|tropo|ssb|cw|previs[aã]o|quando/i.test(question))return 'Esta versão não tem medições ionosféricas ou modelos suficientes para determinar mecanismo, prever horários ou extrapolar FT8 para SSB/CW. As evidências disponíveis são recepções PSK Reporter e Kp da NOAA.';
  if(!available.length)return `Não há evidências suficientes no período de ${s.settings.windowMinutes} minutos. Isso não indica ausência de propagação. Confira o indicativo, a posição, os filtros e o estado da fonte: ${s.sourceStatus.psk.message}.`;
  const b=available[0],scope=s.scope==='station'?'da sua estação':'de estações próximas (sem alcance confirmado da sua estação)';
  return `A banda com maior índice de evidências ${scope} é ${b.band}: ${b.score}/100, ${b.reports} recepções e ${b.pairs} enlaces no período. ${b.txReports} recepções da sua transmissão e ${b.rxReports} recepções pela sua estação. Última evidência ${age(b.latest)}. O índice não é probabilidade de contato; antena, potência e equivalência entre modos ainda não são modeladas.`;
}
$('chat').onsubmit=e=>{e.preventDefault();const q=$('question').value.trim();if(!q)return;const user=document.createElement('p');user.className='userMessage';user.textContent=q;const reply=document.createElement('p');reply.className='assistantMessage';reply.textContent=answer(q);$('conversation').append(user,reply);while($('conversation').children.length>40)$('conversation').firstChild.remove();$('conversation').scrollTop=$('conversation').scrollHeight;$('question').value='';};
api.subscribe(render);render(await api.snapshot());$('period').value=String(current.settings.windowMinutes);
document.documentElement.dataset.ready='true';
