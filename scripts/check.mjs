import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
for(const dir of ['desktop','src','ui','scripts','tests'])for(const file of readdirSync(dir))if(/\.(mjs|cjs)$/.test(file))execFileSync(process.execPath,['--check',join(dir,file)],{stdio:'inherit'});
const land=JSON.parse(readFileSync('ui/land.geojson','utf8'));
if(land.type!=='FeatureCollection'||land.features.length<100)throw new Error('Mapa inválido');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
if(!pkg.build.win.target.includes('nsis')||!pkg.build.win.target.includes('portable'))throw new Error('Targets Windows ausentes');
console.log('Sintaxe, mapa offline e configuração dos dois pacotes Windows: OK');
