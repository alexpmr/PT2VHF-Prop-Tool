const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
async function downloadAsset(asset,folder,onProgress,fetchImpl=fetch){
  const {trustedDownloadURL}=await import('../src/updates.mjs');
  if(!/^[a-f0-9]{64}$/.test(asset.sha256)||!/^PT2VHF-Prop-Tool-\d+\.\d+\.\d+-x64-portable\.exe$/.test(asset.name))throw Error('Invalid update asset');
  await fs.mkdir(folder,{recursive:true});const candidate=path.join(folder,asset.name),partial=candidate+'.partial';let file;
  try{
    let url=asset.url,response;
    for(let i=0;i<5;i++){
      if(!trustedDownloadURL(url))throw Error('Untrusted update host');
      response=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(360000),headers:{'User-Agent':'PT2VHF-Prop-Tool'}});
      if([301,302,303,307,308].includes(response.status)){const next=response.headers.get('location');await response.body?.cancel();if(!next)throw Error('Missing redirect');url=new URL(next,url).href;response=null;continue;}break;
    }
    if(!response?.ok||!response.body)throw Error('Update download failed');
    const hash=crypto.createHash('sha256');file=await fs.open(partial,'w',0o600);const reader=response.body.getReader();let received=0,header=Buffer.alloc(0);
    try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;if(received>asset.size||received>700e6)throw Error('Update size exceeded');if(header.length<2)header=Buffer.concat([header,Buffer.from(value)]).subarray(0,2);hash.update(value);await file.write(value);onProgress?.(received/asset.size*100);}}finally{await reader.cancel();}
    await file.close();file=null;
    if(received!==asset.size||header[0]!==0x4d||header[1]!==0x5a||hash.digest('hex')!==asset.sha256)throw Error('Update integrity failed');
    await fs.rename(partial,candidate);return candidate;
  }catch(e){await file?.close();await fs.rm(partial,{force:true}).catch(()=>{});throw e;}
}
async function launchHandoff(options,folder){
  if(process.platform!=='win32')throw Error('Windows update required');
  await fs.mkdir(folder,{recursive:true});const script=path.join(folder,'apply-update.ps1'),manifest=path.join(folder,'apply-update.json');
  await fs.copyFile(path.join(__dirname,'apply-update.ps1'),script);
  await fs.writeFile(manifest,JSON.stringify({...options,AppPid:process.pid,ReadyFile:path.join(folder,'update-ready.json')}),'utf8');
  await fs.rm(path.join(folder,'update-ready.json'),{force:true});
  const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  await new Promise((resolve,reject)=>{const child=spawn(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Manifest',manifest],{detached:true,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
}
module.exports={downloadAsset,launchHandoff};
