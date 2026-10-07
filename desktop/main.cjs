const {app,BrowserWindow,ipcMain,session,dialog,Notification,shell}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createReadStream,realpathSync}=require('node:fs');
const {spawn}=require('node:child_process');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {downloadAsset,launchHandoff}=require('./portable-update.cjs');
let win,state,file,dataDir,domain,sources,voacap,muf,alerts,i18n,versions,refreshing=false,checkingUpdate=false,downloadingUpdate=false;
let scope='nearby',lastUpdateCheck=0,persistQueue=Promise.resolve(),update={state:'idle',notes:'',version:null},updater,asset,pendingFile;
let trafficLogs=[],trafficSeq=0,activity={rx:0,tx:0};const TRAFFIC_LIMIT=300;
const portable=Boolean(process.env.PORTABLE_EXECUTABLE_DIR),smoke=process.argv.includes('--smoke-test'),captureDocs=process.argv.includes('--capture-docs');
if(smoke&&process.env.PROP_SMOKE_LOG){const {appendFileSync}=require('node:fs');const log=value=>{try{appendFileSync(process.env.PROP_SMOKE_LOG,value+'\n');}catch{}};log(JSON.stringify({argv:process.argv,portable,dir:process.env.PORTABLE_EXECUTABLE_DIR}));for(const name of ['log','error']){const original=console[name];console[name]=(...values)=>{log(values.map(v=>v?.stack||String(v)).join(' '));original(...values);};}}
const repo='https://github.com/alexpmr/PT2VHF-Prop-Tool',mainURL=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
const canonicalUI=realpathSync(fileURLToPath(mainURL));
function isMainURL(value){try{const url=new URL(value);if(url.protocol!=='file:'||url.search||url.hash)return false;const actual=realpathSync(fileURLToPath(url));return process.platform==='win32'?actual.toLowerCase()===canonicalUI.toLowerCase():actual===canonicalUI;}catch{return false;}}
const t=(key,vars)=>i18n.translate(state?.settings.language||'pt-BR',key,vars);
if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(start).catch(error=>{console.error(error);if(smoke||captureDocs){app.exit(1);return;}dialog.showErrorBox('PT2VHF Prop Tool',i18n?t('appError'):'Não foi possível iniciar a aplicação.');app.quit();});
}
app.on('window-all-closed',()=>app.quit());
function persist(){const payload=JSON.stringify(state);const job=persistQueue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',payload,'utf8');await fs.rename(file+'.tmp',file);});persistQueue=job;return job;}
function snapshot(){
  const now=Date.now(),enabled=state.settings.sourceEnabled||{},rawSpots=domain.relevantSpots(state.spots,state.settings,scope,now);
  const spots=domain.filterSpotsBySources(rawSpots,enabled);
  const spaceWeather=enabled.noaa===false?{}:(state.spaceWeather||{kp:state.kp});
  const voacapPredictions=enabled.voacap===false?[]:(state.voacapPredictions||[]);
  const ionosonde=enabled.muf===false?null:(state.ionosonde&&now-state.ionosonde.timestamp<=muf.MUF_MAX_AGE?state.ionosonde:null);
  const bands=domain.BANDS.map(b=>domain.evaluateBand(spots,b.name,now,spaceWeather,voacapPredictions)).map(b=>({...b,mufContext:muf.bandMufContext(b.band,ionosonde,now)})),dataInterval=Math.max(sources.PSK_INTERVAL,state.settings.dataRefreshMinutes*60000);
  return {version:app.getVersion(),portable,settings:state.settings,scope,spots:spots.slice(-5000),voacapPredictions:voacapPredictions.slice(-1000),ionosonde,bands,kp:spaceWeather.kp??null,spaceWeather,sourceStatus:state.status,update,activity,logs:trafficLogs.slice(-TRAFFIC_LIMIT),startupNews:state.startupNews||null,now,nextPSK:Math.max(0,dataInterval-(now-state.attemptPSK))};
}
function emit(){if(win&&!win.isDestroyed())win.webContents.send('state',snapshot());}
function recordTraffic(event){const item={id:++trafficSeq,timestamp:Date.now(),...event};trafficLogs.push(item);if(trafficLogs.length>TRAFFIC_LIMIT)trafficLogs.splice(0,trafficLogs.length-TRAFFIC_LIMIT);if(item.direction==='RX')activity={...activity,rx:item.timestamp};if(item.direction==='TX')activity={...activity,tx:item.timestamp};emit();return item;}
function clearLogs(){trafficLogs=[];emit();return true;}
async function exportLogs(){const result=await dialog.showSaveDialog(win,{title:'PT2VHF Prop Tool - LOGs',defaultPath:`PT2VHF-Prop-Tool-traffic-${new Date().toISOString().replace(/[:.]/g,'-')}.jsonl`,filters:[{name:'JSON Lines',extensions:['jsonl']},{name:'Text',extensions:['txt']}]});if(result.canceled||!result.filePath)return false;await fs.writeFile(result.filePath,trafficLogs.map(v=>JSON.stringify(v)).join('\n')+'\n','utf8');return true;}
async function acknowledgeNews(){state.lastSeenVersion=app.getVersion();state.pendingNews=null;state.startupNews=null;await persist();emit();return true;}
async function voacapRuntime(){
  const root=process.env.PT2VHF_VOACAP_ROOT||(process.platform==='win32'?'C:\\itshfbc':'');
  const bin=process.env.PT2VHF_VOACAP_BIN||(root?path.join(root,'bin_win','voacapw.exe'):'');
  if(!root||!bin)throw new Error('VOACAP local não configurado');
  await Promise.all([fs.access(root),fs.access(bin),fs.access(path.join(root,'run'))]);
  return {root,bin};
}
async function executeVoacap(deck){
  const runtime=await voacapRuntime(),id='pt2vhf_'+process.pid+'_'+Date.now()+'_'+crypto.randomBytes(3).toString('hex'),input=id+'.dat',output=id+'.out',run=path.join(runtime.root,'run'),inputPath=path.join(run,input),outputPath=path.join(run,output);
  await fs.writeFile(inputPath,deck,'ascii');const started=Date.now();
  recordTraffic({direction:'TX',source:'VOACAP',event:'local-engine',detail:input});
  try{
    await new Promise((resolve,reject)=>{
      const child=spawn(runtime.bin,['silent',runtime.root,input,output],{cwd:path.dirname(runtime.bin),windowsHide:true,stdio:['ignore','ignore','pipe']});
      let stderr='',settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;child.kill();reject(new Error('Timeout VOACAP'));}},15000);
      child.stderr.on('data',d=>{if(stderr.length<4096)stderr+=String(d);});
      child.on('error',e=>{if(!settled){settled=true;clearTimeout(timer);reject(e);}});
      child.on('exit',code=>{if(!settled){settled=true;clearTimeout(timer);code===0?resolve():reject(new Error('VOACAP exit '+code+(stderr?' · '+stderr.trim():'')));}});
    });
    const text=await fs.readFile(outputPath,'utf8');recordTraffic({direction:'RX',source:'VOACAP',event:'local-engine',status:'OK',bytes:Buffer.byteLength(text),durationMs:Date.now()-started,payload:text.slice(0,8192),truncated:text.length>8192});return text;
  }finally{await Promise.allSettled([fs.unlink(inputPath),fs.unlink(outputPath)]);}
}
async function refreshVoacap(spots,now){
  state.voacapPredictions=state.voacapPredictions||[];state.status.voacap=state.status.voacap||{state:'waiting'};
  if(now-(state.attemptVOACAP||0)<voacap.VOACAP_INTERVAL)return;
  state.attemptVOACAP=now;
  const supported=state.settings.visible.filter(b=>voacap.VOACAP_BANDS[b]);if(!supported.length){state.status.voacap={state:'idle',detail:'Nenhuma banda HF VOACAP habilitada'};return;}
  const targets=voacap.observedTargets(spots,state.settings);if(!targets.length){state.status.voacap={state:'waiting',detail:'Aguardando destinos observados'};return;}
  state.status.voacap={state:'loading',detail:targets.length+' circuitos HF'};emit();
  try{
    await voacapRuntime();const f107=Number(state.spaceWeather?.f107?.value),ssn=Number.isFinite(f107)?Math.max(0,Math.min(300,Math.round((f107-67)*1.61))):100,predictions=[];
    const home={lat:state.settings.lat,lon:state.settings.lon},date=new Date(now);
    for(const target of targets){
      const deck=voacap.buildVoacapDeck({date,tx:home,rx:target,power:state.settings.power,ssn});
      const rel=voacap.predictionsForHour(await executeVoacap(deck),date.getUTCHours());
      for(const band of supported){const reliability=rel[band];if(Number.isFinite(reliability))predictions.push({source:'VOACAP',evidence:'predicted',timestamp:Date.now(),band,reliability,target:{lat:target.lat,lon:target.lon},distance:target.distance,bearing:target.bearing});}
    }
    state.voacapPredictions=voacap.mergeVoacapPredictions(state.voacapPredictions,predictions,now);state.status.voacap={state:'online',updated:Date.now(),count:predictions.length,targets:targets.length,detail:targets.length+' circuitos · SSN '+ssn+' estimado de F10.7'};
    recordTraffic({direction:'INFO',source:'VOACAP',event:'forecast',detail:predictions.length+' previsões · '+targets.length+' destinos'});
  }catch(e){state.status.voacap={state:'unavailable',detail:e.message};recordTraffic({direction:'INFO',source:'VOACAP',event:'unavailable',detail:e.message});}
}
async function refresh(){
  scope='nearby';if(refreshing){emit();return snapshot();}refreshing=true;
  try{
    const now=Date.now(),hasPosition=domain.coordinates(state.settings.lat,state.settings.lon),canQuery=hasPosition;
    const dataInterval=Math.max(sources.PSK_INTERVAL,state.settings.dataRefreshMinutes*60000),noaaInterval=Math.max(sources.NOAA_INTERVAL,state.settings.dataRefreshMinutes*60000);
    const rbnInterval=Math.max(sources.RBN_INTERVAL,state.settings.dataRefreshMinutes*60000),wsprInterval=Math.max(sources.WSPR_INTERVAL,state.settings.dataRefreshMinutes*60000),grid=canQuery?domain.toGrid(state.settings.lat,state.settings.lon):'',grid4=grid.slice(0,4),canWSPR=hasPosition&&state.settings.visible.some(b=>b!=='11 m');
    const pskPlan=canQuery?sources.pskQueryPlan(state.settings,state.status.psk?.coverage,now,dataInterval,grid4):null,wsprPlan=canWSPR?sources.pskQueryPlan(state.settings,state.status.wspr?.coverage,now,wsprInterval,grid4):null;
    const forceBackfill=Boolean(pskPlan?.mode==='backfill'&&(state.status.psk?.requestedWindowMinutes!==state.settings.windowMinutes||state.status.psk?.requestedGrid!==grid4));
    const forceWSPRBackfill=Boolean(wsprPlan?.mode==='backfill'&&(state.status.wspr?.requestedWindowMinutes!==state.settings.windowMinutes||state.status.wspr?.requestedGrid!==grid4));
    const duePSK=canQuery&&(state.attemptPSK===0||now-state.attemptPSK>=dataInterval||forceBackfill),dueRBN=hasPosition&&now-(state.attemptRBN||0)>=rbnInterval,dueWSPR=canWSPR&&(state.attemptWSPR===0||now-state.attemptWSPR>=wsprInterval||forceWSPRBackfill),dueNOAA=now-state.attemptKp>=noaaInterval,dueMUF=hasPosition&&now-(state.attemptMUF||0)>=sources.IONO_INTERVAL;
    if(duePSK)state.attemptPSK=now;if(dueRBN)state.attemptRBN=now;if(dueWSPR)state.attemptWSPR=now;if(dueNOAA)state.attemptKp=now;if(dueMUF)state.attemptMUF=now;await persist();const work=[];
    if(duePSK){
      const querySettings={...state.settings},queryScope='nearby',plan=sources.pskQueryPlan(querySettings,state.status.psk?.coverage,now,dataInterval,grid4);
      state.status.psk={...state.status.psk,state:'loading',requestedWindowMinutes:querySettings.windowMinutes,requestedGrid:grid4};
      work.push((async()=>{try{
        const spots=await sources.loadPSK({...querySettings,grid},queryScope,plan.seconds,undefined,recordTraffic);
        state.spots=domain.mergeSpots(state.spots,spots);
        const truncated=spots.length>=sources.PSK_REPORT_LIMIT,previous=state.status.psk?.coverage;
        const coverage={grid:grid4,windowMinutes:querySettings.windowMinutes,from:plan.mode==='incremental'&&previous?.grid===grid4?Math.min(previous.from,plan.from):plan.from,to:Date.now(),complete:!truncated,requestedSeconds:plan.seconds};
        const coverageText=`${plan.mode==='backfill'?'carga retroativa':'incremental'} ${Math.round(plan.seconds/60)} min${truncated?' · limite '+sources.PSK_REPORT_LIMIT+' atingido':''}`;
        state.status.psk={state:'online',updated:Date.now(),count:spots.length,queryScope,detail:`Grid ${grid4} · ${coverageText}`,coverage,requestedWindowMinutes:querySettings.windowMinutes,requestedGrid:grid4};
        recordTraffic({direction:'INFO',source:'PSK Reporter',event:plan.mode==='backfill'?'backfill':'parsed',detail:`${spots.length} reception reports parsed · regional grid ${grid4} · ${coverageText}`});
      }catch(e){state.status.psk={...state.status.psk,state:'error',detail:e.message,requestedWindowMinutes:querySettings.windowMinutes,requestedGrid:grid4};}})());
    }
    if(dueRBN){
      state.status.rbn={...state.status.rbn,state:'loading'};
      work.push((async()=>{try{
        const spots=await sources.loadRBN(state.settings,undefined,recordTraffic);state.spots=domain.mergeSpots(state.spots,spots);
        state.status.rbn={state:'online',updated:Date.now(),count:spots.length};
        recordTraffic({direction:'INFO',source:'Reverse Beacon Network',event:'parsed',detail:`${spots.length} RBN spots parsed`});
      }catch(e){state.status.rbn={...state.status.rbn,state:'error',detail:e.message};}})());
    }
    if(dueWSPR){
      const querySettings={...state.settings,grid},plan=sources.pskQueryPlan(state.settings,state.status.wspr?.coverage,now,wsprInterval,grid4);
      state.status.wspr={...state.status.wspr,state:'loading',requestedWindowMinutes:querySettings.windowMinutes,requestedGrid:grid4};
      work.push((async()=>{try{
        const spots=await sources.loadWSPR(querySettings,plan.seconds,undefined,recordTraffic);state.spots=domain.mergeSpots(state.spots,spots);
        const truncated=spots.length>=sources.WSPR_REPORT_LIMIT,previous=state.status.wspr?.coverage;
        const coverage={grid:grid4,windowMinutes:querySettings.windowMinutes,from:plan.mode==='incremental'&&previous?.grid===grid4?Math.min(previous.from,plan.from):plan.from,to:Date.now(),complete:!truncated,requestedSeconds:plan.seconds};
        const coverageText=`${plan.mode==='backfill'?'carga retroativa':'incremental'} ${Math.round(plan.seconds/60)} min${truncated?' · limite '+sources.WSPR_REPORT_LIMIT+' atingido':''}`;
        state.status.wspr={state:'online',updated:Date.now(),count:spots.length,detail:`Grid ${grid4} · ${coverageText}`,coverage,requestedWindowMinutes:querySettings.windowMinutes,requestedGrid:grid4};
        recordTraffic({direction:'INFO',source:'WSPR.live',event:plan.mode==='backfill'?'backfill':'parsed',detail:`${spots.length} WSPR reports parsed · regional grid ${grid4} · ${coverageText}`});
      }catch(e){state.status.wspr={...state.status.wspr,state:'error',detail:e.message,requestedWindowMinutes:querySettings.windowMinutes,requestedGrid:grid4};}})());
    }
    if(dueNOAA){
      state.status.noaa={...state.status.noaa,state:'loading'};
      work.push((async()=>{try{
        const sw=await sources.loadSpaceWeather(undefined,recordTraffic);state.spaceWeather={...(state.spaceWeather||{}),...sw};state.kp=state.spaceWeather.kp??state.kp;
        state.status.noaa={state:'online',updated:Date.now(),detail:'Kp · F10.7 · Bz · vento solar · raios X'};
        const parts=[state.spaceWeather.kp?`Kp ${state.spaceWeather.kp.value}`:'',state.spaceWeather.f107?`SFI ${state.spaceWeather.f107.value}`:'',state.spaceWeather.bz?`Bz ${state.spaceWeather.bz.value} nT`:'',state.spaceWeather.wind?`Vsw ${state.spaceWeather.wind.value} km/s`:'',state.spaceWeather.xray?`X-ray ${state.spaceWeather.xray.class}`:''].filter(Boolean);
        recordTraffic({direction:'INFO',source:'NOAA SWPC',event:'fusion-input',detail:parts.join(' · ')});
      }catch(e){state.status.noaa={...state.status.noaa,state:'error',detail:e.message};}})());
    }
    if(dueMUF){
      state.status.muf={state:'loading'};emit();
      work.push((async()=>{try{
        const rows=muf.parseIonograms(await sources.loadIonosondes(undefined,recordTraffic),Date.now());
        const station=muf.selectNearbyIonosonde(rows,{lat:state.settings.lat,lon:state.settings.lon},Date.now());
        state.ionosonde=station;
        state.status.muf=station?{state:'online',updated:station.timestamp,count:rows.length,detail:station.name+' · '+Math.round(station.distanceKm)+' km · MUF(3000) '+(station.muf3000??'—')+' MHz'}:{state:'waiting',updated:Date.now(),count:rows.length,detail:'Sem ionossonda recente a até 1800 km da estação'};
        recordTraffic({direction:'INFO',source:'KC2G / GIRO',event:'ionosonde',detail:state.status.muf.detail});
      }catch(e){
        state.ionosonde=null;state.status.muf={state:'error',detail:e.message};
        recordTraffic({direction:'INFO',source:'KC2G / GIRO',event:'ionosonde-error',error:e.message});
      }})());
    }
    emit();await Promise.all(work);state.spots=domain.mergeSpots(state.spots,[]);const regionalForVoacap=domain.filterSpotsBySources(domain.relevantSpots(state.spots,state.settings,'nearby',Date.now()),state.settings.sourceEnabled||{});await refreshVoacap(regionalForVoacap,Date.now());await persist();
    const snap=snapshot(),healthy=(state.status.psk.state==='online'&&Date.now()-state.status.psk.updated<6*60000)||(state.status.rbn?.state==='online'&&Date.now()-state.status.rbn.updated<6*60000)||(state.status.wspr?.state==='online'&&Date.now()-state.status.wspr.updated<6*60000);
    for(const b of alerts.update(snap.bands,state.settings,Date.now(),healthy)){
      const metric=b.chance??b.score;if(Notification.isSupported())new Notification({title:t('opening')+' — '+b.band,body:t('alertText',{band:b.band,n:metric})}).show();
      win.webContents.send('state',{...snapshot(),alert:{band:b.band,score:metric}});
    }
    emit();return snapshot();
  }finally{refreshing=false;}
}
function setupUpdater(){
  if(portable||!app.isPackaged)return;
  const {autoUpdater}=require('electron-updater');updater=autoUpdater;updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;updater.installDirectory=path.dirname(app.getPath('exe'));
  updater.on('update-available',info=>{if(versions.compareVersions(info.version,app.getVersion())<=0)return;const notes=typeof info.releaseNotes==='string'?info.releaseNotes:Array.isArray(info.releaseNotes)?info.releaseNotes.map(v=>typeof v==='string'?v:v?.note||'').filter(Boolean).join('\n'):'';update={state:'available',version:info.version,notes};emit();});
  updater.on('update-not-available',()=>{update={state:'current',version:app.getVersion(),notes:''};emit();});
  updater.on('download-progress',p=>{update={...update,state:'downloading',percent:p.percent,transferred:p.transferred,total:p.total,bytesPerSecond:p.bytesPerSecond};emit();});
  updater.on('update-downloaded',event=>{pendingFile=event?.downloadedFile||null;update={...update,state:'downloaded',percent:100};emit();});
  updater.on('error',e=>{update={...update,state:'error',detail:e.message};emit();});
}
async function checkUpdate(force=false){
  if(checkingUpdate||downloadingUpdate||update.state==='downloaded')return update;
  if(!force&&Date.now()-lastUpdateCheck<30000)return update;
  checkingUpdate=true;lastUpdateCheck=Date.now();update={...update,state:'checking'};emit();
  try{
    if(!app.isPackaged)update={state:'development',notes:''};
    else if(updater)await updater.checkForUpdates();
    else{const release=await sources.boundedFetch('https://api.github.com/repos/alexpmr/PT2VHF-Prop-Tool/releases/latest','json',undefined,recordTraffic);const incoming=String(release.tag_name||'').replace(/^v/,'');if(release.draft||release.prerelease)throw Error('Invalid release');const newer=versions.compareVersions(incoming,app.getVersion())>0;asset=newer?versions.releaseAsset(release):null;update={state:newer?'available':'current',version:incoming,notes:String(release.body||'')};}
  }catch(e){update={...update,state:'error',detail:e.message};}finally{checkingUpdate=false;emit();}return update;
}
async function downloadUpdate(){
  if(downloadingUpdate||update.state!=='available')return;downloadingUpdate=true;update={...update,state:'downloading',percent:0,transferred:0,total:portable&&asset?asset.size:null,bytesPerSecond:null};emit();
  try{if(portable){let lastAt=Date.now(),lastBytes=0;pendingFile=await downloadAsset(asset,path.join(path.dirname(file),'updates'),progress=>{const now=Date.now(),elapsed=Math.max(1,now-lastAt),speed=(progress.transferred-lastBytes)*1000/elapsed;lastAt=now;lastBytes=progress.transferred;update={...update,...progress,bytesPerSecond:speed};emit();});update={...update,state:'downloaded',percent:100,transferred:asset.size,total:asset.size,bytesPerSecond:0};emit();}else if(updater)await updater.downloadUpdate();else throw Error('No updater');}catch(e){update={...update,state:'error',detail:e.message};emit();throw e;}finally{downloadingUpdate=false;}
}
async function installUpdate(){
  if(update.state!=='downloaded')return;
  if(portable&&!pendingFile)return;
  try{
    update={...update,state:'installing',percent:100};emit();
    state.pendingNews={version:update.version,notes:String(update.notes||'')};await persist();
    await new Promise(resolve=>setTimeout(resolve,180));
    if(!portable&&updater){updater.quitAndInstall(true,true);return;}
    const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(pendingFile))hash.update(chunk);const sha256=hash.digest('hex');
    const options={Mode:'portable',Candidate:pendingFile,Sha256:sha256,ExpectedVersion:update.version,StateFile:file};
    if(!process.env.PORTABLE_EXECUTABLE_FILE||!asset||sha256!==asset.sha256)throw Error('Portable launcher metadata missing');
    options.Original=process.env.PORTABLE_EXECUTABLE_FILE;options.Target=path.join(process.env.PORTABLE_EXECUTABLE_DIR,asset.name);options.LauncherPid=Number(process.env.PORTABLE_LAUNCHER_PID)||0;
    await launchHandoff(options,path.join(path.dirname(file),'updates'));app.quit();
  }catch(e){update={...update,state:'error',detail:e.message};emit();throw e;}
}
async function runUpdateFlow(){
  const checked=await checkUpdate(true);
  if(checked.state!=='available')return checked;
  await downloadUpdate();
  if(update.state==='downloaded')await installUpdate();
  return update;
}
async function factoryReset(){
  if(smoke)throw Error('Factory reset unavailable in smoke mode');
  const restart=portable?process.env.PORTABLE_EXECUTABLE_FILE:process.execPath;
  if(!restart)throw Error('Restart executable unavailable');
  await persistQueue.catch(()=>{});
  await session.defaultSession.clearCache().catch(()=>{});
  await session.defaultSession.clearStorageData().catch(()=>{});
  trafficLogs=[];activity={rx:0,tx:0};
  const script=path.join(app.getPath('temp'),`pt2vhf-factory-reset-${process.pid}.ps1`);
  const body=`param([int]$ParentPid,[string]$DataDir,[string]$RestartExe)
$ErrorActionPreference='SilentlyContinue'
$log=Join-Path $env:TEMP 'PT2VHF-Prop-Tool-factory-reset.log'
$backup=$DataDir+'.factory-reset-backup'
try { Wait-Process -Id $ParentPid -Timeout 30 } catch {}
Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
$ok=$false
$lastError=''
try {
  if(Test-Path -LiteralPath $DataDir){ Move-Item -LiteralPath $DataDir -Destination $backup -Force -ErrorAction Stop }
  $ok=$true
} catch { $lastError=$_.Exception.Message }
if($ok -and (Test-Path -LiteralPath $backup)){
  $deleted=$false
  for($i=0;$i -lt 30;$i++){
    try { Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction Stop; $deleted=$true; break } catch { $lastError=$_.Exception.Message; Start-Sleep -Milliseconds 500 }
  }
  $ok=$deleted
}
if($ok){
  Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $RestartExe
}else{
  if((Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $DataDir)){
    try { Move-Item -LiteralPath $backup -Destination $DataDir -Force -ErrorAction Stop } catch { $lastError=$lastError+'; restore: '+$_.Exception.Message }
  }
  ('Factory reset failed: '+$lastError) | Set-Content -LiteralPath $log -Encoding UTF8
  Start-Process -FilePath $RestartExe -ArgumentList ('--factory-reset-error='+$log)
}
Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
`;
  await fs.writeFile(script,body,'utf8');
  spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',script,String(process.pid),dataDir,restart],{detached:true,stdio:'ignore',windowsHide:true}).unref();
  setTimeout(()=>app.exit(0),120);
  return true;
}
async function rendererReady(){return win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const deadline=Date.now()+15000;const poll=setInterval(()=>{if(document.documentElement.dataset.ready==='true'){clearInterval(poll);const bands=document.querySelectorAll('.bandRow').length,land=document.querySelectorAll('#land path').length;if(bands===${state.settings.visible.length}&&document.querySelector('#band').options.length===${domain.BANDS.length+1}&&document.querySelectorAll('#bandButtons button').length===${state.settings.visible.length+1}&&document.querySelectorAll('#periodButtons button').length===3&&document.querySelectorAll('#sourceButtons button').length===6&&document.querySelectorAll('#bandButtons .bandQuality').length===${state.settings.visible.length}&&document.querySelector('#heatLegendBar')&&document.querySelector('#heatLegendNote')&&document.querySelector('#mapBase')&&document.querySelector('#mapVisualization')===null&&document.querySelector('#favoredDestinations')&&land>100&&typeof window.propTool.snapshot==='function'&&typeof window.propTool.runUpdateFlow==='function'&&typeof window.propTool.clearLogs==='function'&&typeof window.propTool.factoryReset==='function')resolve(true);else reject(new Error('Interface, bridge or map failed'));}else if(Date.now()>deadline){clearInterval(poll);reject(new Error('Renderer timeout'));}},100);})`);}
async function start(){
  if(smoke)console.log('Smoke startup: Electron ready');
  if(process.platform==='win32')app.setAppUserModelId('br.pt2vhf.proptool');[domain,sources,voacap,muf,i18n,versions]=await Promise.all([import('../src/domain.mjs'),import('../src/sources.mjs'),import('../src/voacap.mjs'),import('../src/muf.mjs'),import('../src/i18n.mjs'),import('../src/updates.mjs')]);alerts=new domain.AlertMachine();
  dataDir=portable?path.join(process.env.PORTABLE_EXECUTABLE_DIR,'data'):(smoke||captureDocs)?path.join(app.getPath('temp'),`pt2vhf-${captureDocs?'docs':'smoke'}-${process.pid}`):app.getPath('userData');file=path.join(dataDir,'state.json');
  state={schemaVersion:7,settings:domain.validateSettings(domain.DEFAULT_SETTINGS),spots:[],kp:null,spaceWeather:null,attemptPSK:0,attemptRBN:0,attemptWSPR:0,attemptKp:0,attemptMUF:0,ionosonde:null,status:{psk:{state:'idle'},rbn:{state:'idle'},wspr:{state:'idle'},noaa:{state:'idle'},muf:{state:'idle'}},lastSeenVersion:app.getVersion(),pendingNews:null,startupNews:null};
  try{const loaded=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));const previousSchema=loaded.schemaVersion||1;state={...state,...loaded,schemaVersion:7,settings:domain.migrateSettings(loaded.settings,previousSchema),spots:domain.mergeSpots(Array.isArray(loaded.spots)?loaded.spots:[],[]),status:{...state.status,...(loaded.status||{})}};if(state.pendingNews?.version===app.getVersion())state.startupNews=state.pendingNews;else if(!loaded.lastSeenVersion&&previousSchema<4)state.startupNews={version:app.getVersion(),notes:''};else if(loaded.lastSeenVersion&&loaded.lastSeenVersion!==app.getVersion())state.startupNews={version:app.getVersion(),notes:''};}catch(e){if(e.code!=='ENOENT'){console.error('Settings load failed:',e);if(smoke)throw e;await dialog.showMessageBox({type:'warning',message:t('settingsLoadError')});await fs.rename(file,file+'.invalid-'+Date.now()).catch(()=>{});}}
  if(captureDocs){const p=domain.fromGrid('GH64');state.settings=domain.validateSettings({...domain.DEFAULT_SETTINGS,callsign:'PT2VHF',lat:p.lat,lon:p.lon,language:'pt-BR',theme:'dark'});}
  if(smoke)console.log('Smoke startup: settings loaded',file,state.settings.visible.length);
  win=new BrowserWindow({width:1440,height:980,minWidth:1050,minHeight:760,show:!smoke,backgroundColor:state.settings.theme==='light'?'#edf2f7':'#09111d',title:'PT2VHF Prop Tool v'+app.getVersion(),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
  win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!isMainURL(url))e.preventDefault();});
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===win.webContents&&permission==='geolocation'&&isMainURL(contents.getURL())));session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='geolocation'&&isMainURL(contents.getURL()));
  const handle=(name,fn)=>ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!isMainURL(event.senderFrame.url))throw Error('Invalid origin');return fn(...args);});
  handle('snapshot',snapshot);handle('configure',async input=>{const settings=domain.validateSettings(input),old=state.settings;state.settings=settings;try{await persist();}catch(e){state.settings=old;throw e;}if(['callsign','lat','lon','alertMinScore','alertMinDistance','alertCooldown','alertBands'].some(k=>JSON.stringify(old[k])!==JSON.stringify(settings[k])))alerts=new domain.AlertMachine();emit();return snapshot();});
  handle('refresh',refresh);handle('clear-logs',clearLogs);handle('export-logs',exportLogs);handle('factory-reset',factoryReset);handle('ack-news',acknowledgeNews);handle('check-update',()=>checkUpdate(true));handle('run-update-flow',runUpdateFlow);handle('download-update',downloadUpdate);handle('install-update',installUpdate);
  const openLink=target=>{const links={project:repo,issues:repo+'/issues',profile:'https://github.com/alexpmr',releases:repo+'/releases',manual:`${repo}/releases/download/v${app.getVersion()}/PT2VHF-Prop-Tool-${app.getVersion()}-Manual.pdf`};if(!Object.hasOwn(links,target))throw Error('Invalid link');return shell.openExternal(links[target]);};handle('open-link',openLink);handle('open-releases',()=>openLink('releases'));
  setupUpdater();await win.loadFile(path.join(__dirname,'../ui/index.html'));if(smoke)console.log('Smoke startup: renderer loaded');await rendererReady();const factoryResetError=process.argv.find(v=>v.startsWith('--factory-reset-error='));if(factoryResetError&&!smoke)await dialog.showMessageBox(win,{type:'error',title:'PT2VHF Prop Tool',message:t('factoryResetError'),detail:factoryResetError.slice(factoryResetError.indexOf('=')+1)});
  if(captureDocs){
    win.show();win.focus();await new Promise(r=>setTimeout(r,450));
    const out=path.join(__dirname,'../docs/screenshots');await fs.mkdir(out,{recursive:true});
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const full=async name=>{await wait(180);const image=await win.webContents.capturePage();await fs.writeFile(path.join(out,name),image.toPNG());};
    const element=async(name,selector)=>{await wait(180);const rect=await win.webContents.executeJavaScript(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const r=n.getBoundingClientRect();return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.max(1,Math.ceil(r.width)),height:Math.max(1,Math.ceil(r.height))};})()`);if(!rect)throw Error('Screenshot target missing: '+selector);const image=await win.webContents.capturePage(rect);await fs.writeFile(path.join(out,name),image.toPNG());};
    await full('01-inicio-escuro.png');
    await win.webContents.executeJavaScript("document.getElementById('settingsButton').click()");await element('02-configuracoes.png','#settingsPage');await element('02b-bandas.png','#bandSettings');
    await win.webContents.executeJavaScript("document.getElementById('mapTab').click();document.getElementById('themeButton').click()");await full('03-mapa-claro.png');
    await win.webContents.executeJavaScript("document.getElementById('helpTab').click()");await element('04-ajuda.png','#helpPage');
    await win.webContents.executeJavaScript("document.querySelector('#languageMenu > summary').click()");await full('05-idiomas.png');
    await win.webContents.executeJavaScript("document.querySelector('#languageMenu > summary').click();document.getElementById('aboutTab').click()");await element('06-sobre.png','#aboutPage');
    console.log('Documentation screenshots captured from current renderer');app.exit(0);return;
  }
  if(process.env.PROP_UPDATE_CONFIRM_FILE&&path.resolve(process.env.PROP_UPDATE_CONFIRM_FILE)===path.join(dataDir,'updates','update-ready.json'))await fs.writeFile(process.env.PROP_UPDATE_CONFIRM_FILE,JSON.stringify({version:app.getVersion()}),'utf8');
  if(smoke){try{await win.webContents.executeJavaScript(`(async()=>{const old=await window.propTool.snapshot();for(const language of ['pt-BR','en','es','fr','de','it']){await window.propTool.configure({...old.settings,language});await new Promise(r=>setTimeout(r,60));if(document.documentElement.lang!==language||document.querySelectorAll('#languages img').length!==6)throw Error('Language failed');document.getElementById('helpTab').click();if(document.getElementById('helpPage').classList.contains('hidden'))throw Error('Help failed');}await window.propTool.configure({...old.settings,theme:'light',mapBase:'terrain',sourceEnabled:{...old.settings.sourceEnabled,psk:false}});await new Promise(r=>setTimeout(r,60));if(document.documentElement.dataset.theme!=='light'||document.documentElement.dataset.mapBase!=='terrain')throw Error('Theme/map base failed');if(document.querySelector('#sourceButtons button[data-source="psk"]')?.getAttribute('aria-pressed')!=='false')throw Error('Source toggle failed');await window.propTool.configure(old.settings);})()`);console.log('Electron smoke test: 14 bands, six languages, Help, themes, IPC and offline map OK');app.exit(0);}catch(e){console.error(e);app.exit(1);}return;}
  refresh().catch(e=>{state.status.psk={state:'error',detail:e.message};emit();});const poll=setInterval(()=>{refresh().catch(e=>{state.status.psk={state:'error',detail:e.message};emit();});if(Date.now()-lastUpdateCheck>=state.settings.updateMinutes*60000)checkUpdate();},30000),firstCheck=setTimeout(checkUpdate,10000);app.on('before-quit',()=>{clearInterval(poll);clearTimeout(firstCheck);});
}
