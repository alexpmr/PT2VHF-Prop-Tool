const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('propTool',{
  snapshot:()=>ipcRenderer.invoke('snapshot'),
  configure:settings=>ipcRenderer.invoke('configure',settings),
  refresh:scope=>ipcRenderer.invoke('refresh',scope),
  clearLogs:()=>ipcRenderer.invoke('clear-logs'),
  exportLogs:()=>ipcRenderer.invoke('export-logs'),
  checkUpdate:()=>ipcRenderer.invoke('check-update'),
  runUpdateFlow:()=>ipcRenderer.invoke('run-update-flow'),
  acknowledgeNews:()=>ipcRenderer.invoke('ack-news'),
  downloadUpdate:()=>ipcRenderer.invoke('download-update'),
  installUpdate:()=>ipcRenderer.invoke('install-update'),
  openReleases:()=>ipcRenderer.invoke('open-releases'),
  openLink:target=>ipcRenderer.invoke('open-link',target),
  subscribe:callback=>{const handler=(_,payload)=>callback(payload);ipcRenderer.on('state',handler);return ()=>ipcRenderer.removeListener('state',handler);}
});
