import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {getBinFromUrl}=require('app-builder-lib/out/binDownload');
const version=JSON.parse(readFileSync('package.json','utf8')).version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Release version must be numeric');
const nsis=await getBinFromUrl('nsis','3.0.4.1','VKMiizYdmNdJOWpRGz4trl4lD++BvYP2irAXpMilheUP0pc93iKlWAoP843Vlraj8YG19CVn0j+dCo/hURz9+Q==');
const compiler=join(nsis,process.platform==='win32'?'Bin/makensis.exe':process.platform==='darwin'?'mac/makensis':'linux/makensis');
const appDir=resolve('dist/win-unpacked'),script=resolve('scripts/windows.nsi');
if(!existsSync(join(appDir,'PT2VHF Prop Tool.exe')))throw new Error('Packaged Windows application missing');
writeFileSync(join(appDir,'resources/app-update.yml'),'provider: github\nowner: alexpmr\nrepo: PT2VHF-Prop-Tool\nupdaterCacheDir: pt2vhf-prop-tool-updater\n');
// Enumerate exact installed files. Uninstall removes no unrelated files and retains AppData settings.
const files=[],dirs=[];
function visit(dir){for(const item of readdirSync(dir)){const p=join(dir,item);if(statSync(p).isDirectory()){visit(p);dirs.push(p);}else files.push(p);}}visit(appDir);
const escape=p=>relative(appDir,p).replaceAll('\\','/').replaceAll('$','$$').replaceAll('/', '\\');
const uninstall=resolve('dist/uninstall-files.nsh');
writeFileSync(uninstall,files.map(p=>`Delete "$INSTDIR\\${escape(p)}"`).join('\n')+'\n'+dirs.map(p=>`RMDir "$INSTDIR\\${escape(p)}"`).join('\n')+'\n');
const prefix=process.platform==='win32'?'/':'-';
const artifacts=[];
for(const target of ['setup','portable']){
  const output=resolve(`dist/PT2VHF-Prop-Tool-${version}-x64-${target}.exe`);
  const args=[prefix+'V2',prefix+'DVERSION='+version,prefix+'DOUTPUT='+output,prefix+'DAPP_DIR='+appDir,prefix+'DUNINSTALL_INCLUDE='+uninstall];
  if(target==='portable')args.push(prefix+'DPORTABLE');args.push(script);
  console.log(`Building Windows ${target} with native NSIS compiler…`);
  execFileSync(compiler,args,{stdio:'inherit',env:{...process.env,NSISDIR:nsis}});
  const bytes=readFileSync(output);if(bytes[0]!==0x4d||bytes[1]!==0x5a||bytes.length<50e6)throw new Error('Invalid or incomplete executable');
  artifacts.push({output,name:relative(resolve('dist'),output),size:bytes.length,sha512:createHash('sha512').update(bytes).digest('base64')});
}
const setup=artifacts[0];
writeFileSync('dist/latest.yml',`version: ${version}\nfiles:\n  - url: ${setup.name}\n    sha512: ${setup.sha512}\n    size: ${setup.size}\npath: ${setup.name}\nsha512: ${setup.sha512}\nreleaseDate: '${new Date().toISOString()}'\n`);
writeFileSync('dist/SHA256SUMS.txt',artifacts.map(a=>createHash('sha256').update(readFileSync(a.output)).digest('hex')+'  '+a.name).join('\n')+'\n');
console.log('Installer, portable, update manifest and checksums generated.');
