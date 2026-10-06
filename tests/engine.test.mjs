import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,BANDS,toGrid,fromGrid,distance,bearing,validateSettings,parsePSK,relevantSpots,evaluateBand,mergeSpots,AlertMachine} from '../src/domain.mjs';
import {parseKp,pskURL,boundedFetch} from '../src/sources.mjs';
const now=1800000000000;
const settings={...DEFAULT_SETTINGS,callsign:'PT2VHF',lat:-15.8,lon:-47.9};
function spot(id,overrides={}){return {id,source:'PSK Reporter',evidence:'observed',timestamp:now-60000,frequency:14074000,band:'20 m',tx:'PT2VHF',rx:`TEST${id}`,txPosition:null,rxPosition:{lat:50+Number(id)/10,lon:8+Number(id)/10},mode:'FT8',...overrides};}
test('Maidenhead round-trip includes Brasília and coordinate extremes',()=>{
  for(const [lat,lon] of [[-15.8,-47.9],[0,0],[89.99,179.99],[-89.99,-179.99]]){
    const center=fromGrid(toGrid(lat,lon));assert.ok(distance({lat,lon},center)<6);
  }
  assert.equal(fromGrid('SS00'),null);assert.equal(fromGrid('GH64YY'),null);
  assert.throws(()=>toGrid(null,0));assert.ok(fromGrid('gh64'));
  assert.ok(fromGrid('GH64AA00').precisionKm<fromGrid('GH64AA').precisionKm);
});
test('Great-circle distance and bearing cross the date line correctly',()=>{
  assert.ok(distance({lat:0,lon:179},{lat:0,lon:-179})<225);
  assert.ok(Math.abs(bearing({lat:0,lon:0},{lat:1,lon:0}))<.01);
});
test('All supported bands shown by default and alerts configurable separately',()=>{
  assert.equal(DEFAULT_SETTINGS.visible.length,BANDS.length);assert.equal(DEFAULT_SETTINGS.alertBands.length,0);
  assert.throws(()=>validateSettings({...settings,lat:NaN}));
  assert.throws(()=>validateSettings({...settings,alertBands:['23 cm']}));
  assert.throws(()=>validateSettings({...settings,windowMinutes:'30'}));
});
test('PSK parsing preserves direction, time, unknown mode and missing SNR',()=>{
  const data=parsePSK(`<receptionReports><receptionReport senderCallsign="pt2vhf" receiverCallsign="dl1abc" receiverLocator="JO31" frequency="14074000" flowStartSeconds="1800000000"/><receptionReport senderCallsign="TEST" receiverCallsign="RX" frequency="999" flowStartSeconds="1800000000"/></receptionReports>`);
  assert.equal(data.length,1);assert.equal(data[0].tx,'PT2VHF');assert.equal(data[0].rx,'DL1ABC');
  assert.equal(data[0].mode,'Não informado');assert.equal(data[0].snr,null);assert.equal(data[0].band,'20 m');
  assert.throws(()=>parsePSK('<html>Erro 429</html>'));
  assert.equal(parsePSK('<receptionReports/>').length,0);
  assert.throws(()=>parsePSK('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///secret">]><receptionReports></receptionReports>'));
});
test('Station view cannot imply another transmitter was the home station',()=>{
  const reports=[spot('1'),spot('2',{tx:'OTHER',txPosition:{lat:-15.9,lon:-47.8}}),spot('3',{tx:'DX',rx:'PT2VHF',txPosition:{lat:40,lon:10}})];
  const direct=relevantSpots(reports,settings,'station',now);assert.equal(direct.length,2);
  assert.equal(direct[0].origin,'direct-tx');assert.equal(direct[1].origin,'direct-rx');
  const nearby=relevantSpots(reports,settings,'nearby',now);assert.equal(nearby.length,3);assert.equal(nearby[1].origin,'nearby');
});
test('Stale reports, future timestamps, duplicates and unlocated endpoints excluded',()=>{
  const reports=[spot('1'),spot('1'),spot('2',{timestamp:now-61*60000}),spot('3',{timestamp:now+2*60000}),spot('4',{rxPosition:null})];
  assert.equal(relevantSpots(reports,settings,'station',now).length,1);
  assert.equal(mergeSpots([spot('1')],[spot('1'),spot('2',{timestamp:now-25*3600000})],now).length,1);
});
test('No observations produce unknown score, never a closed-band verdict',()=>{
  const b=evaluateBand([],'20 m',now);assert.equal(b.score,null);assert.equal(b.state,'Sem evidências');assert.equal(b.zones.length,0);
});
test('Sparse distant reports do not create a continent-size propagation polygon',()=>{
  const data=relevantSpots([spot('1',{rxPosition:{lat:50,lon:8}}),spot('2',{rxPosition:{lat:5,lon:100}}),spot('3',{rxPosition:{lat:-20,lon:130}})],settings,'station',now);
  assert.equal(evaluateBand(data,'20 m',now).zones.length,0);
});
test('Adjacent occupied cells form conservative irregular zones, without filling gaps',()=>{
  const data=relevantSpots([spot('1',{rxPosition:{lat:50.5,lon:8.5}}),spot('2',{rxPosition:{lat:50.5,lon:10.5}}),spot('3',{rxPosition:{lat:52.5,lon:8.5}})],settings,'station',now);
  const b=evaluateBand(data,'20 m',now);assert.equal(b.zones.length,1);assert.equal(b.zones[0].pairs,3);
  const ring=b.zones[0].rings[0];assert.deepEqual(ring[0],ring.at(-1));assert.ok(ring.length>5);
  assert.ok(!ring.some(([x,y])=>x===12&&y===54));
});
test('Opening alerts require direct TX evidence, suppress repeats and survive source failures',()=>{
  const cfg={...settings,alertBands:['20 m'],alertMinScore:60,alertMinDistance:500};
  const zones=[{directTX:true,directTXPairs:4,pairs:4,maxDistance:9000,txMaxDistance:9000,lastEvidence:now,latestTX:now}];
  const high={band:'20 m',score:85,zones},low={band:'20 m',score:40,zones:[]};
  const m=new AlertMachine();assert.equal(m.update([high],cfg,now).length,1);
  assert.equal(m.update([high],cfg,now+60000).length,0);
  m.update([low],cfg,now+120000,false);assert.equal(m.update([high],cfg,now+180000,true).length,0);
  m.update([low],cfg,now+31*60000);assert.equal(m.update([{...high,zones:[{...zones[0],latestTX:now+32*60000}]}],cfg,now+32*60000).length,1);
  const regional=new AlertMachine();assert.equal(regional.update([{...high,zones:[{...zones[0],directTXPairs:1}]}],cfg,now).length,0);
});
test('Kp validation keeps measurement timestamp separate from fetch time',()=>{
  const kp=parseKp([['time_tag','Kp'],['2026-10-06 12:00:00.000','3.33']]);assert.equal(kp.value,3.33);assert.equal(kp.timestamp,Date.parse('2026-10-06T12:00:00Z'));
  assert.throws(()=>parseKp([['time_tag','Kp'],['bad','99']]));
  const objects=parseKp([{time_tag:'2026-10-06T12:00:00Z',kp_index:3},{time_tag:'2026-10-06T09:00:00Z',kp_index:1}]);
  assert.equal(objects.value,3);assert.equal(objects.timestamp,kp.timestamp);
  assert.throws(()=>parseKp([{time_tag:'2026-10-06T12:00:00Z',kp_index:null}]));
});
test('PSK query is scoped to a callsign or a grid, never global unrestricted retrieval',()=>{
  const direct=new URL(pskURL(settings,'station'));assert.equal(direct.searchParams.get('callsign'),'PT2VHF');
  const nearby=new URL(pskURL({...settings,grid:'GH64AA'},'nearby'));assert.equal(nearby.searchParams.get('modify'),'grid');assert.equal(nearby.searchParams.get('callsign'),'GH64');
});
test('Fetching rejects arbitrary hosts and oversized streamed responses',async()=>{
  await assert.rejects(boundedFetch('https://example.com/private'));
  await assert.rejects(boundedFetch('https://services.swpc.noaa.gov/large','text',async()=>new Response(new Uint8Array(6000001))));
});
