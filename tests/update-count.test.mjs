import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseAsset,countDownload,COUNTER_API} from '../src/updates.mjs';

const release=(extra={})=>({schema:1,source:'https://www.pt2vhf.com',product:'prop',status:'available',version:'9.0.0',
  files:[{category:'windows-installer',kind:'installer',platform:'windows-x64',name:'PT2VHF-Prop-Tool-9.0.0-x64-setup.exe',
    url:'https://www.pt2vhf.com/downloads/prop-tool/PT2VHF-Prop-Tool-9.0.0-x64-setup.exe',size:60e6,sha256:'a'.repeat(64),...extra}]});

test('counter key comes from the site manifest',()=>{
  assert.equal(releaseAsset(release({counterKey:'win-setup'}),'installer').counterKey,'win-setup');
  assert.equal(releaseAsset(release(),'installer').counterKey,'windows-installer');
});

test('in-app update is counted on the site and never throws',async()=>{
  const calls=[];
  const ok=await countDownload({counterKey:'win-setup'},async(url,opts)=>{calls.push([url,opts.body]);return {ok:true};});
  assert.equal(ok,true);
  assert.deepEqual(calls,[[COUNTER_API,'action=count&product=prop&category=win-setup']]);
  assert.equal(await countDownload({counterKey:'win-setup'},async()=>{throw new Error('offline');}),false);
  assert.equal(await countDownload({},async()=>({ok:true})),false);
});
