export const REPOSITORY='alexpmr/PT2VHF-Prop-Tool';
export function compareVersions(a,b){
  if(!/^\d+\.\d+\.\d+$/.test(a)||!/^\d+\.\d+\.\d+$/.test(b))throw new Error('Invalid release version');
  const aa=a.split('.').map(Number),bb=b.split('.').map(Number);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return Math.sign(aa[i]-bb[i]);}return 0;
}
export function releaseAsset(release,kind='portable'){
  const version=String(release.tag_name||'').replace(/^v/,'');compareVersions(version,'0.0.0');
  if(release.draft||release.prerelease||!['portable','setup'].includes(kind))throw new Error('Invalid release');
  const name=`PT2VHF-Prop-Tool-${version}-x64-${kind}.exe`,url=`https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
  const asset=release.assets?.find(a=>a.name===name&&a.state==='uploaded');
  if(!asset||asset.browser_download_url!==url||!Number.isSafeInteger(asset.size)||asset.size<50e6||asset.size>700e6||!/^sha256:[a-f0-9]{64}$/.test(asset.digest||''))throw new Error('Missing verified release asset');
  return {version,name,url,size:asset.size,sha256:asset.digest.slice(7)};
}
export function trustedDownloadURL(value){const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='github.com'||u.hostname==='release-assets.githubusercontent.com'||u.hostname==='objects.githubusercontent.com');}
