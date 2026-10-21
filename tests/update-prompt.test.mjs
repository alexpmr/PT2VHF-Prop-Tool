import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGUAGES,MESSAGES} from '../src/i18n.mjs';

const app=readFileSync(new URL('../ui/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../ui/index.html',import.meta.url),'utf8');

test('new version prompt asks to update, snoozes 24 h and reuses the update flow',()=>{
  assert.match(html,/<dialog id="updatePromptDialog">/);
  assert.ok(app.includes("const UPDATE_PROMPT_SNOOZE_MS=24*60*60*1000;"));
  assert.ok(app.includes("if(u?.state!=='available'||!u.version||updateFlowActive||updatePromptedFor===u.version)return;"));
  assert.ok(app.includes("$('updatePromptNow').onclick=()=>{$('updatePromptDialog').close();$('version').onclick();};"));
  assert.ok(app.includes("maybePromptUpdate(u);"));
  // Não abre por cima de outro diálogo (ex.: novidades da versão).
  assert.ok(app.includes("document.querySelector('dialog[open]')"));
});

test('update prompt texts exist in every language',()=>{
  for(const {code} of LANGUAGES){
    for(const key of ['updatePromptQuestion','updateNow','updateLater'])assert.ok(MESSAGES[code]?.[key],`${code}.${key}`);
    assert.ok(MESSAGES[code].updatePromptQuestion.includes('{version}'));
  }
});
