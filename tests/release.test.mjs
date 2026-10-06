import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {BANDS,DEFAULT_SETTINGS,validateSettings,migrateSettings,bandFor,parsePSK} from '../src/domain.mjs';
import {LANGUAGES,MESSAGES,translate} from '../src/i18n.mjs';
import {compareVersions,releaseAsset,trustedDownloadURL} from '../src/updates.mjs';
import updater from '../desktop/portable-update.cjs';
test('14 bands including 11 m, vertical antennas, 100 W and 5-minute update default',()=>{
 assert.equal(BANDS.length,14);assert.equal(bandFor(27555000),'11 m');assert.equal(bandFor(28074000),'10 m');assert.equal(DEFAULT_SETTINGS.power,100);assert.equal(DEFAULT_SETTINGS.updateMinutes,5);
 for(const b of BANDS)assert.equal(DEFAULT_SETTINGS.antennas[b.name].type,'Vertical');assert.equal(validateSettings(DEFAULT_SETTINGS).language,'pt-BR');
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,updateMinutes:4}));assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,language:'xx'}));
 const xml='<receptionReports><receptionReport senderCallsign="TEST" receiverCallsign="RX" frequency="27555000" flowStartSeconds="1800000000"/></receptionReports>';assert.equal(parsePSK(xml)[0].band,'11 m');
});
test('Migration adds 11 m to old all-band profiles, retains custom antennas, power and disabled bands',()=>{
 const old={...DEFAULT_SETTINGS,visible:BANDS.filter(b=>b.name!=='11 m').map(b=>b.name),power:50,updateMinutes:30,antennas:{'20 m':{type:'Yagi'}}};
 const moved=migrateSettings(old,1);assert.ok(moved.visible.includes('11 m'));assert.equal(moved.antennas['20 m'].type,'Yagi');assert.equal(moved.antennas['11 m'].type,'Vertical');assert.equal(moved.power,50);assert.equal(moved.updateMinutes,30);
 assert.deepEqual(migrateSettings({...old,visible:['20 m']},1).visible,['20 m']);assert.ok(!migrateSettings(old,2).visible.includes('11 m'));
 const a=validateSettings(DEFAULT_SETTINGS);a.antennas['20 m'].type='Yagi';assert.equal(DEFAULT_SETTINGS.antennas['20 m'].type,'Vertical');
});
test('All six catalogs cover the same keys and interpolation parameters, including Help and errors',()=>{
 const base=Object.keys(MESSAGES['pt-BR']).sort();
 for(const {code} of LANGUAGES){assert.deepEqual(Object.keys(MESSAGES[code]).sort(),base);for(const key of base){assert.ok(MESSAGES[code][key].trim());const params=v=>[...v.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();assert.deepEqual(params(MESSAGES[code][key]),params(MESSAGES['pt-BR'][key]),`${code}/${key}`);}assert.ok(translate(code,'helpUpdate').length>150);assert.ok(translate(code,'invalidSettings'));}
 assert.equal(translate('en','minutes',{n:5}),'5 minutes');assert.throws(()=>translate('en','missingKey'));
});
const release={tag_name:'v0.3.0',draft:false,prerelease:false,assets:[{name:'PT2VHF-Prop-Tool-0.3.0-x64-portable.exe',state:'uploaded',size:60000000,digest:'sha256:'+'a'.repeat(64),browser_download_url:'https://github.com/alexpmr/PT2VHF-Prop-Tool/releases/download/v0.3.0/PT2VHF-Prop-Tool-0.3.0-x64-portable.exe'}]};
test('Release checking rejects malformed versions, drafts, missing hashes and substituted asset URLs',()=>{
 assert.equal(compareVersions('0.10.0','0.9.9'),1);assert.equal(compareVersions('0.2.0','0.2.0'),0);assert.equal(compareVersions('0.1.0','0.2.0'),-1);assert.throws(()=>compareVersions('oops','0.2.0'));
 assert.equal(releaseAsset(release).sha256,'a'.repeat(64));assert.throws(()=>releaseAsset({...release,draft:true}));assert.throws(()=>releaseAsset({...release,assets:[{...release.assets[0],digest:''}]}));assert.throws(()=>releaseAsset({...release,assets:[{...release.assets[0],browser_download_url:'https://github.com/other/repo/evil.exe'}]}));
 for(const u of ['http://github.com/x','https://github.com.evil.example/x','https://user:pass@github.com/x'])assert.equal(trustedDownloadURL(u),false);
});
test('Portable download verifies SHA-256 and PE header; malicious redirects and corrupt files leave no partials',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'prop-update-test-'));try{
 const bytes=Buffer.from('MZverified executable fixture'),asset={name:'PT2VHF-Prop-Tool-0.3.0-x64-portable.exe',url:release.assets[0].browser_download_url,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 const out=await updater.downloadAsset(asset,folder,null,async()=>new Response(bytes));assert.deepEqual(await readFile(out),bytes);
 await assert.rejects(updater.downloadAsset({...asset,sha256:'b'.repeat(64)},folder,null,async()=>new Response(bytes)));
 await assert.rejects(updater.downloadAsset(asset,folder,null,async()=>new Response(null,{status:302,headers:{location:'https://evil.example/exe'}})));
 assert.ok(!(await readdir(folder)).some(n=>n.endsWith('.partial')));
 }finally{await rm(folder,{recursive:true,force:true});}
});
