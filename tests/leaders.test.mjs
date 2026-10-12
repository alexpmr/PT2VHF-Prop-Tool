import test from 'node:test';
import assert from 'node:assert/strict';
import {leadingBands} from '../src/heatmap.mjs';
test('Leadership considers only enabled bands with valid evidence and current scores',()=>{
 const bands=[{band:'20 m',chance:70,basis:'observed'},{band:'40 m',chance:90,basis:'fused'},{band:'10 m',chance:99,basis:'none'},{band:'15 m',chance:null,basis:'none'}];
 assert.deepEqual(leadingBands(bands,['20 m','40 m','10 m','15 m']),['40 m']);
 assert.deepEqual(leadingBands(bands,['20 m','10 m']),['20 m']);
 assert.deepEqual(leadingBands(bands,['15 m']),[]);assert.deepEqual(leadingBands([],['20 m']),[]);
});
test('Ties are explicit and deterministic even when input order changes',()=>{
 const bands=[{band:'40 m',chance:80,basis:'observed'},{band:'20 m',chance:80,basis:'estimated'},{band:'15 m',chance:60,basis:'fused'}];
 assert.deepEqual(leadingBands(bands,['20 m','40 m','15 m']),['20 m','40 m']);
 assert.deepEqual(leadingBands([...bands].reverse(),['20 m','40 m']),['20 m','40 m']);
 assert.equal(bands[0].band,'40 m');
});
test('Unusable numeric values do not produce an artificial winner',()=>{
 const bands=[NaN,Infinity,-1,101,null,undefined].map((chance,i)=>({band:String(i),chance,basis:'observed'}));
 assert.deepEqual(leadingBands(bands,bands.map(b=>b.band)),[]);
});
