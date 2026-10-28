import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGUAGES,MESSAGES} from '../src/i18n.mjs';

const app=readFileSync(new URL('../ui/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8');

test('site notice opens on every start, without a "do not show again" option',()=>{
  assert.match(html,/<dialog id="siteNoticeDialog">/);
  assert.match(html,/www\.pt2vhf\.com/);
  assert.doesNotMatch(html+app,/siteNotice[^;]*localStorage/);
  assert.doesNotMatch(html,/siteNoticeDialog[^\n]*type="checkbox"/);
  assert.ok(app.includes("render(firstSnapshot);showSiteNotice(firstSnapshot);"));
  // Fora da captura do manual e do smoke test.
  assert.ok(main.includes('siteNotice:!(smoke||captureDocs)'));
  assert.ok(main.includes("site:'https://www.pt2vhf.com/prop'"));
});

test('new version prompt and release notes wait for the site notice',()=>{
  assert.ok(app.includes("if(!siteNoticeDone||document.querySelector('dialog[open]')){setTimeout"));
  assert.ok(app.includes('if(siteNoticeDone&&snap.startupNews'));
  assert.ok(app.includes("$('siteNoticeDialog').addEventListener('close',()=>{siteNoticeDone=true;if(current)render(current);});"));
});

test('site notice texts exist in every language',()=>{
  for(const {code} of LANGUAGES)for(const key of ['siteNoticeTitle','siteNoticeMessage','siteNoticeOpen','continue'])assert.ok(MESSAGES[code]?.[key],`${code}.${key}`);
});
