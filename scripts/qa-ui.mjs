import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=resolve('.'),out=resolve('docs/screenshots');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.svg':'image/svg+xml','.geojson':'application/json'})[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({...(process.env.PROP_CHROMIUM||existsSync('/tmp/chromium')?{executablePath:process.env.PROP_CHROMIUM||'/tmp/chromium'}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--single-process','--no-zygote']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/ui/index.html`);await page.waitForSelector('html[data-ready=true]');assert.equal(await page.locator('.bandRow').count(),14);assert.equal(await page.locator('#languages img').count(),6);
 await page.screenshot({path:out+'/01-inicio-escuro.png'});
 await page.click('#settingsButton');assert.equal(await page.inputValue('#power'),'100');assert.equal(await page.inputValue('#updateMinutes'),'5');assert.equal(await page.inputValue('#dataRefreshMinutes'),'5');assert.equal(await page.locator('.sourceCards article').count(),4);assert.equal(await page.locator('#bandSettings input[data-kind=visible]:checked').count(),14);
 for(const val of await page.locator('#bandSettings select').evaluateAll(ns=>ns.map(n=>n.value)))assert.equal(val,'Vertical');
 await page.fill('#callsign','PT2VHF');await page.fill('#grid','GH64');await page.locator('#grid').dispatchEvent('change');await page.click('#criteria > summary');
 await page.locator('#settingsPage').screenshot({path:out+'/02-configuracoes.png'});await page.locator('#bandSettings').evaluate(n=>n.scrollTop=n.scrollHeight);await page.locator('#bandSettings').screenshot({path:out+'/02b-bandas.png'});await page.click('#configForm button[type=submit]');await page.waitForSelector('#empty.hidden',{state:'attached'});assert.equal(await page.locator('#emptyConfigure').isVisible(),false);assert.ok(await page.locator('#mapNotice').isVisible());
 await page.click('#themeButton');await page.waitForSelector('html[data-theme=light]');await page.screenshot({path:out+'/03-mapa-claro.png'});
 await page.click('#logsTab');assert.ok(await page.locator('#logsPage').isVisible());await page.click('#helpTab');await page.locator('#helpPage').screenshot({path:out+'/04-ajuda.png'});
 const help={en:'Using',es:'Cómo',fr:'Utiliser',de:'verwenden',it:'Come', 'pt-BR':'Como'};
 for(const [code,word] of Object.entries(help)){await page.locator('#languageMenu > summary').click();await page.locator(`button[data-language="${code}"]`).click();await page.waitForFunction(c=>document.documentElement.lang===c,code);assert.ok((await page.locator('#helpPage h1').innerText()).includes(word));assert.ok((await page.locator('#helpPage').innerText()).length>1300);await page.click('#settingsButton');assert.equal(await page.inputValue('#power'),'100');await page.click('#helpTab');}
 await page.locator('#languageMenu > summary').click();await page.screenshot({path:out+'/05-idiomas.png'});await page.locator('#languageMenu > summary').click();await page.click('#aboutTab');await page.locator('#aboutPage').screenshot({path:out+'/06-sobre.png'});
 await page.reload();await page.waitForSelector('html[data-ready=true]');assert.equal(await page.getAttribute('html','data-theme'),'light');assert.equal(await page.locator('#stationLabel').innerText(),'PT2VHF');assert.equal(await page.locator('#emptyConfigure').isVisible(),false);
 await page.click('#settingsButton');await page.fill('#power','50');await page.selectOption('select[data-antenna="20 m"]','Yagi');await page.uncheck('input[data-band="11 m"][data-kind="visible"]');await page.click('#configForm button[type=submit]');await page.reload();await page.waitForSelector('html[data-ready=true]');await page.click('#settingsButton');assert.equal(await page.inputValue('#power'),'50');assert.equal(await page.inputValue('select[data-antenna="20 m"]'),'Yagi');assert.equal(await page.locator('input[data-band="11 m"][data-kind="visible"]').isChecked(),false);
 assert.deepEqual(errors,[]);console.log('Browser QA: 6 languages, Help, navigation, 14 bands, themes, defaults, saved settings and unobstructed empty map OK. Screenshots captured.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
