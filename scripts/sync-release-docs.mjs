import {readFileSync,writeFileSync} from 'node:fs';
import {BANDS} from '../src/domain.mjs';
const {version}=JSON.parse(readFileSync('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid version');
writeFileSync('README.md',readFileSync('docs/README.template.md','utf8').replaceAll('{{VERSION}}',version).replaceAll('{{BANDS}}',String(BANDS.length)));
writeFileSync('src/version.mjs',`export const APP_VERSION='${version}';\n`);
