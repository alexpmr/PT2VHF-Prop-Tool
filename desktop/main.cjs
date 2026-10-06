const {app,BrowserWindow,ipcMain,session,dialog,Notification,shell}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let win,state,file,domain,sources,alerts,refreshing=false,checkingUpdate=false;
let scope='station',lastUpdateCheck=0;
let update={state:'idle',message:'Verificar atualização',notes:'',version:null},updater;
const portable=Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
const releaseURL='https://github.com/alexpmr/PT2VHF-Prop-Tool/releases';
const mainURL=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
const smoke=process.argv.includes('--smoke-test');
if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(start).catch(error=>{dialog.showErrorBox('PT2VHF Prop Tool',error.message);app.quit();});
}
app.on('window-all-closed',()=>app.quit());
async function persist(){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(state),'utf8');await fs.rename(file+'.tmp',file);}
function snapshot(){
  const now=Date.now(),spots=domain.relevantSpots(state.spots,state.settings,scope,now);
  const bands=domain.BANDS.map(b=>domain.evaluateBand(spots,b.name,now));
  return {version:app.getVersion(),portable,settings:state.settings,scope,spots:spots.slice(-5000),bands,
    kp:state.kp,sourceStatus:state.status,update,now,
    nextPSK:Math.max(0,sources.PSK_INTERVAL-(now-state.attemptPSK))};
}
function emit(){if(win&&!win.isDestroyed())win.webContents.send('state',snapshot());}
async function refresh(nextScope=scope){
  if(!['station','nearby'].includes(nextScope))throw new Error('Visão inválida');scope=nextScope;
  if(refreshing){emit();return snapshot();}refreshing=true;
  try{
    const now=Date.now(),canQuery=Boolean(state.settings.callsign)&&domain.coordinates(state.settings.lat,state.settings.lon);
    const duePSK=canQuery&&now-state.attemptPSK>=sources.PSK_INTERVAL;
    const dueKp=now-state.attemptKp>=sources.NOAA_INTERVAL;
    if(duePSK)state.attemptPSK=now;if(dueKp)state.attemptKp=now;
    await persist(); // Persist attempt before network I/O: restarts cannot bypass provider limits.
    const work=[];
    if(duePSK){state.status.psk={...state.status.psk,state:'loading',message:'Consultando'};work.push((async()=>{
      try{
        const spots=await sources.loadPSK({...state.settings,grid:domain.toGrid(state.settings.lat,state.settings.lon)},scope);
        state.spots=domain.mergeSpots(state.spots,spots);
        state.status.psk={state:'online',updated:Date.now(),message:`${spots.length} recepções retornadas`,queryScope:scope};
      }catch(e){state.status.psk={...state.status.psk,state:'error',message:e.message};}
    })());}
    if(dueKp){state.status.noaa={...state.status.noaa,state:'loading',message:'Consultando'};work.push((async()=>{
      try{state.kp=await sources.loadKp();state.status.noaa={state:'online',updated:Date.now(),message:'Kp recebido'};}
      catch(e){state.status.noaa={...state.status.noaa,state:'error',message:e.message};}
    })());}
    emit();await Promise.all(work);state.spots=domain.mergeSpots(state.spots,[]);await persist();
    const snap=snapshot(),healthy=state.status.psk.state==='online'&&Date.now()-state.status.psk.updated<6*60000;
    for(const b of alerts.update(snap.bands,state.settings,Date.now(),healthy)) {
      if(Notification.isSupported())new Notification({title:`Evidência de abertura — ${b.band}`,body:`Sua transmissão foi recebida em múltiplas estações. Índice de evidências: ${b.score}/100. Verifique o mapa.`}).show();
      win.webContents.send('state',{...snapshot(),alert:{band:b.band,score:b.score}});
    }
    emit();return snapshot();
  }finally{refreshing=false;}
}
function setupUpdater(){
  if(portable||!app.isPackaged)return;
  const {autoUpdater}=require('electron-updater');updater=autoUpdater;
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('update-available',info=>{update={state:'available',version:info.version,notes:typeof info.releaseNotes==='string'?info.releaseNotes:'Consulte as notas da versão.',message:`Versão ${info.version} disponível`};emit();});
  updater.on('update-not-available',()=>{update={...update,state:'current',message:'Versão atualizada'};emit();});
  updater.on('download-progress',p=>{update={...update,state:'downloading',message:`Baixando atualização: ${Math.round(p.percent)}%`};emit();});
  updater.on('update-downloaded',()=>{update={...update,state:'downloaded',message:'Atualização pronta para instalar'};emit();});
  updater.on('error',e=>{update={...update,state:'error',message:`Atualização indisponível: ${e.message}`};emit();});
}
async function checkUpdate(){
  if(checkingUpdate)return update;
  if(Date.now()-lastUpdateCheck<15*60000)return update;
  checkingUpdate=true;lastUpdateCheck=Date.now();update={...update,state:'checking',message:'Verificando atualização'};emit();
  try{
    if(!app.isPackaged){update={state:'development',message:'Atualização disponível após publicação',notes:''};}
    else if(updater)await updater.checkForUpdates();
    else {
      const r=await sources.boundedFetch('https://api.github.com/repos/alexpmr/PT2VHF-Prop-Tool/releases/latest','json');
      const version=String(r.tag_name??'').replace(/^v/,'');
      const valid=/^\d+\.\d+\.\d+$/.test(version),parts=app.getVersion().split('.').map(Number),incoming=version.split('.').map(Number);
      const compare=incoming.reduce((out,n,i)=>out||Math.sign(n-(parts[i]??0)),0);
      update={state:valid&&compare>0?'available':'current',version,notes:String(r.body??''),message:valid&&compare>0?`Versão ${version} disponível`:'Versão atualizada'};
    }
  }catch(e){update={...update,state:'error',message:'Não foi possível consultar as versões: '+e.message};}
  finally{checkingUpdate=false;emit();}return update;
}
async function start(){
  if(process.platform==='win32')app.setAppUserModelId('br.pt2vhf.proptool');
  domain=await import('../src/domain.mjs');sources=await import('../src/sources.mjs');alerts=new domain.AlertMachine();
  const dir=portable?path.join(process.env.PORTABLE_EXECUTABLE_DIR,'data'):app.getPath('userData');
  file=path.join(dir,'state.json');
  state={settings:{...domain.DEFAULT_SETTINGS},spots:[],kp:null,attemptPSK:0,attemptKp:0,status:{psk:{state:'idle',message:'Configure sua estação'},noaa:{state:'idle',message:'Aguardando'}}};
  try{
    const loaded=JSON.parse(await fs.readFile(file,'utf8'));
    state={...state,...loaded,settings:domain.validateSettings(loaded.settings),spots:domain.mergeSpots(Array.isArray(loaded.spots)?loaded.spots:[])};
  }catch(e){if(e.code!=='ENOENT'){await dialog.showMessageBox({type:'warning',message:'A configuração anterior não pôde ser carregada.',detail:'O arquivo original será preservado e uma configuração nova será criada.'});await fs.rename(file,file+'.invalid-'+Date.now()).catch(()=>{});}}
  win=new BrowserWindow({width:1440,height:940,minWidth:1050,minHeight:700,show:!smoke,backgroundColor:'#09111d',title:'PT2VHF Prop Tool',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(e,url)=>{if(url!==mainURL)e.preventDefault();});
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===win.webContents&&permission==='geolocation'&&contents.getURL()===mainURL));
  session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='geolocation'&&contents.getURL()===mainURL);
  const handle=(name,fn)=>ipcMain.handle(name,(event,...args)=>{if(event.sender!==win.webContents||event.sender.getURL()!==mainURL)throw new Error('Origem inválida');return fn(...args);});
  handle('snapshot',snapshot);
  handle('configure',async input=>{
    const settings=domain.validateSettings(input),old=state.settings;state.settings=settings;
    try{await persist();}catch(e){state.settings=old;throw e;}
    alerts=new domain.AlertMachine();emit();return snapshot();
  });
  handle('refresh',refresh);handle('check-update',checkUpdate);
  handle('open-releases',()=>shell.openExternal(releaseURL));
  handle('download-update',async()=>{if(portable){await shell.openExternal(releaseURL);return;}if(updater&&update.state==='available')await updater.downloadUpdate();});
  handle('install-update',async()=>{if(!updater||update.state!=='downloaded')return;const r=await dialog.showMessageBox(win,{type:'question',message:'Instalar a atualização e reiniciar o aplicativo?',buttons:['Cancelar','Instalar'],defaultId:0,cancelId:0});if(r.response===1)updater.quitAndInstall(false,true);});
  setupUpdater();await win.loadFile(path.join(__dirname,'../ui/index.html'));
  if(smoke){
    try{
      await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const deadline=Date.now()+15000;const poll=setInterval(()=>{if(document.documentElement.dataset.ready==='true'){clearInterval(poll);const bands=document.querySelectorAll('.bandRow').length,land=document.querySelectorAll('#land path').length;if(bands===13&&land>100&&typeof window.propTool.snapshot==='function')resolve(true);else reject(new Error('Interface, bridge or map failed'));}else if(Date.now()>deadline){clearInterval(poll);reject(new Error('Renderer timeout'));}},100);})`);
      console.log('Electron smoke test: renderer, IPC bridge and offline map OK');app.exit(0);
    }catch(e){console.error(e.message);app.exit(1);}return;
  }
  refresh().catch(e=>{state.status.psk={state:'error',message:e.message};emit();});
  const poll=setInterval(()=>{refresh().catch(e=>{state.status.psk={state:'error',message:e.message};emit();});if(Date.now()-lastUpdateCheck>=state.settings.updateMinutes*60000)checkUpdate();},30000);
  const firstCheck=setTimeout(checkUpdate,10000);
  app.on('before-quit',()=>{clearInterval(poll);clearTimeout(firstCheck);});
}
