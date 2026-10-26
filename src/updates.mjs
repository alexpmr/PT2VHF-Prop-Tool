// Only pt2vhf.com is trusted to advertise Prop Tool packages.
export const UPDATE_FEED='https://www.pt2vhf.com/update.php?product=prop&platform=windows-x64';
export function compareVersions(a,b){
  if(!/^\d+\.\d+\.\d+$/.test(a)||!/^\d+\.\d+\.\d+$/.test(b))throw new Error('Invalid release version');
  const aa=a.split('.').map(Number),bb=b.split('.').map(Number);
  for(let i=0;i<3;i++){if(aa[i]!==bb[i])return Math.sign(aa[i]-bb[i]);}return 0;
}
export function trustedDownloadURL(value){
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='www.pt2vhf.com'
    &&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash
    &&/^\/downloads\/prop-tool\/PT2VHF-Prop-Tool-\d+\.\d+\.\d+-x64-(?:portable|setup)\.exe$/.test(u.pathname);
  }catch{return false;}
}
export function releaseAsset(release,kind='portable'){
  if(!['portable','installer'].includes(kind))throw new Error('Invalid package kind');
  if(release?.schema!==1||release?.source!=='https://www.pt2vhf.com'||release?.product!=='prop'||release?.status!=='available')throw new Error('No verified Prop Tool release on site');
  const version=release.version;compareVersions(version,'0.0.0');
  const target=kind==='installer'?'setup':'portable',category='windows-'+kind;
  const name=`PT2VHF-Prop-Tool-${version}-x64-${target}.exe`;
  const url=`https://www.pt2vhf.com/downloads/prop-tool/${name}`;
  const files=Array.isArray(release.files)?release.files:[];
  const matches=files.filter(a=>a?.category===category&&a.kind===kind&&a.platform==='windows-x64'&&a.name===name&&a.url===url);
  if(matches.length!==1)throw new Error('Missing exact site release asset');
  const file=matches[0];
  if(!trustedDownloadURL(file.url)||!Number.isSafeInteger(file.size)||file.size<50e6||file.size>700e6||!/^[a-f0-9]{64}$/.test(file.sha256||''))throw new Error('Invalid release size or digest');
  return {version,name,url,size:file.size,sha256:file.sha256};
}
