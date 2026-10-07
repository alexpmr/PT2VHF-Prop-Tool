import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {BANDS,DEFAULT_SETTINGS,validateSettings,migrateSettings,bandFor,parsePSK} from '../src/domain.mjs';
import {LANGUAGES,MESSAGES,translate} from '../src/i18n.mjs';
import {compareVersions,releaseAsset,trustedDownloadURL} from '../src/updates.mjs';
import {normalizeReleaseNotes} from '../src/release-notes.mjs';
import {aggregateHeatSamples,heatColor,kernelRadius} from '../src/heatmap.mjs';
import updater from '../desktop/portable-update.cjs';
test('14 bands including 11 m, vertical antennas, 100 W, 5-minute data refresh and 15-minute version check',()=>{
 assert.equal(BANDS.length,14);assert.equal(bandFor(27555000),'11 m');assert.equal(bandFor(28074000),'10 m');assert.equal(DEFAULT_SETTINGS.power,100);assert.equal(DEFAULT_SETTINGS.updateMinutes,15);assert.equal(DEFAULT_SETTINGS.dataRefreshMinutes,5);
 for(const b of BANDS)assert.equal(DEFAULT_SETTINGS.antennas[b.name].type,'Vertical');assert.equal(validateSettings(DEFAULT_SETTINGS).language,'pt-BR');
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,updateMinutes:4}));assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,dataRefreshMinutes:4}));assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,language:'xx'}));assert.equal(Object.hasOwn(validateSettings({...DEFAULT_SETTINGS,mapView:'polygons'}),'mapView'),false);
 const xml='<receptionReports><receptionReport senderCallsign="TEST" receiverCallsign="RX" frequency="27555000" flowStartSeconds="1800000000"/></receptionReports>';assert.equal(parsePSK(xml)[0].band,'11 m');
});
test('Migration adds 11 m to old all-band profiles, retains custom antennas, power and disabled bands',()=>{
 const old={...DEFAULT_SETTINGS,visible:BANDS.filter(b=>b.name!=='11 m').map(b=>b.name),power:50,updateMinutes:5,antennas:{'20 m':{type:'Yagi'}}};
 const moved=migrateSettings(old,1);assert.ok(moved.visible.includes('11 m'));assert.equal(moved.antennas['20 m'].type,'Yagi');assert.equal(moved.antennas['11 m'].type,'Vertical');assert.equal(moved.power,50);assert.equal(moved.updateMinutes,15);
 assert.deepEqual(migrateSettings({...old,visible:['20 m']},1).visible,['20 m']);assert.ok(!migrateSettings(old,2).visible.includes('11 m'));assert.equal(migrateSettings({...old,updateMinutes:45},3).updateMinutes,45);assert.equal(migrateSettings({...DEFAULT_SETTINGS,updateMinutes:30},4).updateMinutes,15);assert.equal(Object.hasOwn(migrateSettings({...DEFAULT_SETTINGS,mapView:'polygons'},5),'mapView'),false);
 const a=validateSettings(DEFAULT_SETTINGS);a.antennas['20 m'].type='Yagi';assert.equal(DEFAULT_SETTINGS.antennas['20 m'].type,'Vertical');
});
test('All six catalogs cover the same keys and interpolation parameters, including Help and errors',()=>{
 const base=Object.keys(MESSAGES['pt-BR']).sort();
 for(const {code} of LANGUAGES){assert.deepEqual(Object.keys(MESSAGES[code]).sort(),base);for(const key of base){assert.ok(MESSAGES[code][key].trim());const params=v=>[...v.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();assert.deepEqual(params(MESSAGES[code][key]),params(MESSAGES['pt-BR'][key]),`${code}/${key}`);}assert.ok(translate(code,'helpUpdate').length>150);assert.ok(translate(code,'invalidSettings'));}
 assert.equal(translate('en','minutes',{n:5}),'5 minutes');assert.throws(()=>translate('en','missingKey'));
});
test('Density heatmap uses a multicolor scale and smaller kernels as zoom increases',()=>{
 const cold=heatColor(.08),mid=heatColor(.55),hot=heatColor(1);
 assert.notDeepEqual(cold,mid);assert.notDeepEqual(mid,hot);assert.notDeepEqual(hot,[255,255,255]);
 assert.ok(kernelRadius(1)>kernelRadius(3));assert.ok(kernelRadius(3)>kernelRadius(6));assert.ok(kernelRadius(6)>=12);
 const bins=aggregateHeatSamples([{x:10,y:10,weight:1},{x:11,y:11,weight:2},{x:80,y:80,weight:1}],8);
 assert.equal(bins.length,2);assert.equal(bins[0].count,2);assert.equal(bins[0].weight,3);
});
test('Release notes sanitize HTML, Markdown and plain text without exposing raw tags',()=>{
 const html='<h2>What\'s Changed</h2><ul><li>Fix by <a class="user-mention" data-hovercard-type="user" href="https://github.com/alexpmr">@alexpmr</a></li></ul><script>alert(1)</script>';
 const clean=normalizeReleaseNotes(html);assert.match(clean,/What's Changed/);assert.match(clean,/• Fix by @alexpmr/);assert.match(clean,/https:\/\/github\.com\/alexpmr/);assert.doesNotMatch(clean,/<h2>|data-hovercard|script|alert\(1\)/);
 const markdown=normalizeReleaseNotes('## Novidades\n- **Heatmap** ativo\n[Release](https://github.com/alexpmr/PT2VHF-Prop-Tool/releases)');
 assert.match(markdown,/Novidades/);assert.match(markdown,/• Heatmap ativo/);assert.match(markdown,/Release \(https:\/\/github\.com/);
 assert.equal(normalizeReleaseNotes('Texto simples'),'Texto simples');assert.doesNotMatch(normalizeReleaseNotes('&lt;h2&gt;Título&lt;/h2&gt;&lt;li&gt;Item&lt;/li&gt;'),/[<>]/);
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
 const progress=[];const out=await updater.downloadAsset(asset,folder,p=>progress.push(p),async()=>new Response(bytes));assert.deepEqual(await readFile(out),bytes);assert.ok(progress.length);assert.equal(Math.round(progress.at(-1).percent),100);assert.equal(progress.at(-1).transferred,bytes.length);assert.equal(progress.at(-1).total,bytes.length);
 await assert.rejects(updater.downloadAsset({...asset,sha256:'b'.repeat(64)},folder,null,async()=>new Response(bytes)));
 await assert.rejects(updater.downloadAsset(asset,folder,null,async()=>new Response(null,{status:302,headers:{location:'https://evil.example/exe'}})));
 assert.ok(!(await readdir(folder)).some(n=>n.endsWith('.partial')));
 }finally{await rm(folder,{recursive:true,force:true});}
});
