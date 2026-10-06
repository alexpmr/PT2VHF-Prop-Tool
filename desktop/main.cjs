const {app,BrowserWindow,ipcMain,session,dialog,Notification,shell}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createReadStream,realpathSync}=require('node:fs');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {downloadAsset,launchHandoff}=require('./portable-update.cjs');
let win,state,file,domain,sources,alerts,i18n,versions,refreshing=false,checkingUpdate=false,downloadingUpdate=false;
let scope='station',lastUpdateCheck=0,persistQueue=Promise.resolve(),update={state:'idle',notes:'',version:null},updater,asset,pendingFile;\nlet trafficLogs=[],trafficSeq=0,activity={rx:0,tx:0};const TRAFFIC_LIMIT=300;
const portable=Boolean(process.env.PORTABLE_EXECUTABLE_DIR),smoke=process.argv.includes('--smoke-test');
if(smoke&&process.env.PROP_SMOKE_LOG){const {appendFileSync}=require('node:fs');const log=value=>{try{appendFileSync(process.env.PROP_SMOKE_LOG,value+'\n');}catch{}};log(JSON.stringify({argv:process.argv,portable,dir:process.env.PORTABLE_EXECUTABLE_DIR}));for(const name of ['log','error']){const original=console[name];console[name]=(...values)=>{log(values.map(v=>v?.stack||String(v)).join(' '));original(...values);};}}
const repo='https://github.com/alexpmr/PT2VHF-Prop-Tool',mainURL=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
const canonicalUI=realpathSync(fileURLToPath(mainURL));
function isMainURL(value){try{const url=new URL(value);if(url.protocol!=='file:'||url.search||url.hash)return false;const actual=realpathSync(fileURLToPath(url));return process.platform==='win32'?actual.toLowerCase()===canonicalUI.toLowerCase():actual===canonicalUI;}catch{return false;}}
const t=(key,vars)=>i18n.translate(state?.settings.language||'pt-BR',key,vars);
if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(start).catch(error=>{console.error(error);if(smoke){app.exit(1);return;}dialog.showErrorBox('PT2VHF Prop Tool',i18n?t('appError'):'Não foi possível iniciar a aplicação.');app.quit();});
}
app.on('window-all-closed',()=>app.quit());
function persist(){const payload=JSON.stringify(state);const job=persistQueue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',payload,'utf8');await fs.rename(file+'.tmp',file);});persistQueue=job;return job;}
function snapshot(){const now=Date.now(),spots=domain.relevantSpots(state.spots,state.settings,scope,now),bands=domain.BANDS.map(b=>domain.evaluateBand(spots,b.name,now));return {version:app.getVersion(),portable,settings:state.settings,scope,spots:spots.slice(-5000),bands,kp:state.kp,sourceStatus:state.status,update,now,nextPSK:Math.max(0,sources.PSK_INTERVAL-(now-state.attemptPSK))};}
function emit(){if(win&&!win.isDestroyed())win.webContents.send('state',snapshot());}
async function refresh(nextScope=scope){
  if(!['station','nearby'].includes(nextScope))throw Error('Invalid view');scope=nextScope;if(refreshing){emit();return snapshot();}refreshing=true;
  try{
    const now=Date.now(),canQuery=Boolean(state.settings.callsign)&&domain.coordinates(state.settings.lat,state.settings.lon),dataInterval=Math.max(sources.PSK_INTERVAL,state.settings.dataRefreshMinutes*60000),noaaInterval=Math.max(sources.NOAA_INTERVAL,state.settings.dataRefreshMinutes*60000),duePSK=canQuery&&now-state.attemptPSK>=dataInterval,dueKp=now-state.attemptKp>=noaaInterval;
    if(duePSK)state.attemptPSK=now;if(dueKp)state.attemptKp=now;await persist();const work=[];
    if(duePSK){state.status.psk={...state.status.psk,state:'loading'};const querySettings={...state.settings},queryScope=scope;work.push((async()=>{try{const spots=await sources.loadPSK({...querySettings,grid:domain.toGrid(querySettings.lat,querySettings.lon)},queryScope,undefined,recordTraffic);state.spots=domain.mergeSpots(state.spots,spots);state.status.psk={state:'online',updated:Date.now(),count:spots.length,queryScope};recordTraffic({direction:'INFO',source:'PSK Reporter',event:'parsed',detail:`${spots.length} reception reports parsed`});}catch(e){state.status.psk={...state.status.psk,state:'error',detail:e.message};}})());}
    if(dueKp){state.status.noaa={...state.status.noaa,state:'loading'};work.push((async()=>{try{state.kp=await sources.loadKp(undefined,recordTraffic);state.status.noaa={state:'online',updated:Date.now()};recordTraffic({direction:'INFO',source:'NOAA SWPC',event:'parsed',detail:`Kp ${state.kp.value}`});}catch(e){state.status.noaa={...state.status.noaa,state:'error',detail:e.message};}})());}
    emit();await Promise.all(work);state.spots=domain.mergeSpots(state.spots,[]);await persist();const snap=snapshot(),healthy=state.status.psk.state==='online'&&Date.now()-state.status.psk.updated<6*60000;
    for(const b of alerts.update(snap.bands,state.settings,Date.now(),healthy)){if(Notification.isSupported())new Notification({title:t('opening')+' — '+b.band,body:t('alertText',{band:b.band,n:b.score})}).show();win.webContents.send('state',{...snapshot(),alert:{band:b.band,score:b.score}});}emit();return snapshot();
  }finally{refreshing=false;}
}
function setupUpdater(){
  if(portable||!app.isPackaged)return;
  const {autoUpdater}=require('electron-updater');updater=autoUpdater;updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;updater.installDirectory=path.dirname(app.getPath('exe'));
  updater.on('update-available',info=>{if(versions.compareVersions(info.version,app.getVersion())<=0)return;update={state:'available',version:info.version,notes:typeof info.releaseNotes==='string'?info.releaseNotes:''};emit();});
  updater.on('update-not-available',()=>{update={state:'current',version:app.getVersion(),notes:''};emit();});
  updater.on('download-progress',p=>{update={...update,state:'downloading',percent:p.percent};emit();});
  updater.on('update-downloaded',()=>{pendingFile=updater.installerPath;update={...update,state:'downloaded',percent:100};emit();});
  updater.on('error',e=>{update={...update,state:'error',detail:e.message};emit();});
}
async function checkUpdate(){
  if(checkingUpdate||downloadingUpdate||update.state==='downloaded')return update;
  if(Date.now()-lastUpdateCheck<30000)return update;
  checkingUpdate=true;lastUpdateCheck=Date.now();update={...update,state:'checking'};emit();
  try{
    if(!app.isPackaged)update={state:'development',notes:''};
    else if(updater)await updater.checkForUpdates();
    else{const release=await sources.boundedFetch('https://api.github.com/repos/alexpmr/PT2VHF-Prop-Tool/releases/latest','json',undefined,recordTraffic);const incoming=String(release.tag_name||'').replace(/^v/,'');if(release.draft||release.prerelease)throw Error('Invalid release');const newer=versions.compareVersions(incoming,app.getVersion())>0;asset=newer?versions.releaseAsset(release):null;update={state:newer?'available':'current',version:incoming,notes:String(release.body||'')};}
  }catch(e){update={...update,state:'error',detail:e.message};}finally{checkingUpdate=false;emit();}return update;
}
async function downloadUpdate(){
  if(downloadingUpdate||update.state!=='available')return;downloadingUpdate=true;update={...update,state:'downloading',percent:0};emit();
  try{if(portable){pendingFile=await downloadAsset(asset,path.join(path.dirname(file),'updates'),percent=>{update={...update,percent};emit();});update={...update,state:'downloaded',percent:100};emit();}else if(updater)await updater.downloadUpdate();else throw Error('No updater');}catch(e){update={...update,state:'error',detail:e.message};emit();throw e;}finally{downloadingUpdate=false;}
}
async function installUpdate(){
  if(update.state!=='downloaded'||!pendingFile)return;
  const r=await dialog.showMessageBox(win,{type:'question',message:t('confirmUpdate'),buttons:[t('cancel'),t('install')],defaultId:0,cancelId:0});if(r.response!==1)return;
  try{
    const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(pendingFile))hash.update(chunk);const sha256=hash.digest('hex');
    const options={Mode:portable?'portable':'installed',Candidate:pendingFile,Sha256:sha256,ExpectedVersion:update.version,StateFile:file};
    if(portable){if(!process.env.PORTABLE_EXECUTABLE_FILE||!asset||sha256!==asset.sha256)throw Error('Portable launcher metadata missing');options.Original=process.env.PORTABLE_EXECUTABLE_FILE;options.Target=path.join(process.env.PORTABLE_EXECUTABLE_DIR,asset.name);options.LauncherPid=Number(process.env.PORTABLE_LAUNCHER_PID)||0;}
    else options.InstallDir=path.dirname(app.getPath('exe'));
    await persist();await launchHandoff(options,path.join(path.dirname(file),'updates'));app.quit();
  }catch(e){update={...update,state:'error',detail:e.message};emit();throw e;}
}
async function rendererReady(){return win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const deadline=Date.now()+15000;const poll=setInterval(()=>{if(document.documentElement.dataset.ready==='true'){clearInterval(poll);const bands=document.querySelectorAll('.bandRow').length,land=document.querySelectorAll('#land path').length;if(bands===${state.settings.visible.length}&&document.querySelector('#band').options.length===${domain.BANDS.length+1}&&land>100&&typeof window.propTool.snapshot==='function')resolve(true);else reject(new Error('Interface, bridge or map failed'));}else if(Date.now()>deadline){clearInterval(poll);reject(new Error('Renderer timeout'));}},100);})`);}
async function start(){
  if(smoke)console.log('Smoke startup: Electron ready');
  if(process.platform==='win32')app.setAppUserModelId('br.pt2vhf.proptool');[domain,sources,i18n,versions]=await Promise.all([import('../src/domain.mjs'),import('../src/sources.mjs'),import('../src/i18n.mjs'),import('../src/updates.mjs')]);alerts=new domain.AlertMachine();
  const dir=portable?path.join(process.env.PORTABLE_EXECUTABLE_DIR,'data'):smoke?path.join(app.getPath('temp'),'pt2vhf-smoke-'+process.pid):app.getPath('userData');file=path.join(dir,'state.json');
  state={schemaVersion:3,settings:domain.validateSettings(domain.DEFAULT_SETTINGS),spots:[],kp:null,attemptPSK:0,attemptKp:0,status:{psk:{state:'idle'},noaa:{state:'idle'}}};
  try{const loaded=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));state={...state,...loaded,schemaVersion:3,settings:domain.migrateSettings(loaded.settings,loaded.schemaVersion||1),spots:domain.mergeSpots(Array.isArray(loaded.spots)?loaded.spots:[],[])};}catch(e){if(e.code!=='ENOENT'){console.error('Settings load failed:',e);if(smoke)throw e;await dialog.showMessageBox({type:'warning',message:t('settingsLoadError')});await fs.rename(file,file+'.invalid-'+Date.now()).catch(()=>{});}}
  if(smoke)console.log('Smoke startup: settings loaded',file,state.settings.visible.length);
  win=new BrowserWindow({width:1440,height:980,minWidth:1050,minHeight:760,show:!smoke,backgroundColor:state.settings.theme==='light'?'#edf2f7':'#09111d',title:'PT2VHF Prop Tool v'+app.getVersion(),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!isMainURL(url))e.preventDefault();});
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===win.webContents&&permission==='geolocation'&&isMainURL(contents.getURL())));session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='geolocation'&&isMainURL(contents.getURL()));
  const handle=(name,fn)=>ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!isMainURL(event.senderFrame.url))throw Error('Invalid origin');return fn(...args);});
  handle('snapshot',snapshot);handle('configure',async input=>{const settings=domain.validateSettings(input),old=state.settings;state.settings=settings;try{await persist();}catch(e){state.settings=old;throw e;}if(['callsign','lat','lon','alertMinScore','alertMinDistance','alertCooldown','alertBands'].some(k=>JSON.stringify(old[k])!==JSON.stringify(settings[k])))alerts=new domain.AlertMachine();emit();return snapshot();});
  handle('refresh',refresh);handle('clear-logs',clearLogs);handle('export-logs',exportLogs);handle('check-update',checkUpdate);handle('download-update',downloadUpdate);handle('install-update',installUpdate);
  const openLink=target=>{const links={project:repo,issues:repo+'/issues',profile:'https://github.com/alexpmr',releases:repo+'/releases',manual:`${repo}/releases/download/v${app.getVersion()}/PT2VHF-Prop-Tool-${app.getVersion()}-Manual.pdf`};if(!Object.hasOwn(links,target))throw Error('Invalid link');return shell.openExternal(links[target]);};handle('open-link',openLink);handle('open-releases',()=>openLink('releases'));
  setupUpdater();await win.loadFile(path.join(__dirname,'../ui/index.html'));if(smoke)console.log('Smoke startup: renderer loaded');await rendererReady();
  if(process.env.PROP_UPDATE_CONFIRM_FILE&&path.resolve(process.env.PROP_UPDATE_CONFIRM_FILE)===path.join(dir,'updates','update-ready.json'))await fs.writeFile(process.env.PROP_UPDATE_CONFIRM_FILE,JSON.stringify({version:app.getVersion()}),'utf8');
  if(smoke){try{await win.webContents.executeJavaScript(`(async()=>{const old=await window.propTool.snapshot();for(const language of ['pt-BR','en','es','fr','de','it']){await window.propTool.configure({...old.settings,language});await new Promise(r=>setTimeout(r,60));if(document.documentElement.lang!==language||document.querySelectorAll('#languages img').length!==6)throw Error('Language failed');document.getElementById('helpTab').click();if(document.getElementById('helpPage').classList.contains('hidden'))throw Error('Help failed');}await window.propTool.configure({...old.settings,theme:'light'});await new Promise(r=>setTimeout(r,60));if(document.documentElement.dataset.theme!=='light')throw Error('Theme failed');await window.propTool.configure(old.settings);})()`);console.log('Electron smoke test: 14 bands, six languages, Help, themes, IPC and offline map OK');app.exit(0);}catch(e){console.error(e);app.exit(1);}return;}
  refresh().catch(e=>{state.status.psk={state:'error',detail:e.message};emit();});const poll=setInterval(()=>{refresh().catch(e=>{state.status.psk={state:'error',detail:e.message};emit();});if(Date.now()-lastUpdateCheck>=state.settings.updateMinutes*60000)checkUpdate();},30000),firstCheck=setTimeout(checkUpdate,10000);app.on('before-quit',()=>{clearInterval(poll);clearTimeout(firstCheck);});
}
