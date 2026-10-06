import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,BANDS,toGrid,fromGrid,distance,bearing,validateSettings,parsePSK,relevantSpots,evaluateBand,spaceWeatherScore,mergeSpots,AlertMachine} from '../src/domain.mjs';
import {parseKp,parseF107,parseSolarWindMag,parseSolarWindSpeed,parseXray,parseRBN,pskURL,pskQueryPlan,boundedFetch} from '../src/sources.mjs';
const now=1800000000000;
const settings={...DEFAULT_SETTINGS,callsign:'PT2VHF',lat:-15.8,lon:-47.9,nearbyRadius:300};
function spot(id,overrides={}){
  return {id,source:'PSK Reporter',evidence:'observed',timestamp:now-60000,frequency:14074000,band:'20 m',
    tx:'PY1AAA',rx:`DX${id}`,txPosition:{lat:-15.9,lon:-47.8},rxPosition:{lat:50+Number(id)/10,lon:8+Number(id)/10},mode:'FT8',snr:-8,...overrides};
}
test('Maidenhead round-trip includes Brasília and coordinate extremes',()=>{
  for(const [lat,lon] of [[-15.8,-47.9],[0,0],[89.99,179.99],[-89.99,-179.99]]){
    const center=fromGrid(toGrid(lat,lon));assert.ok(distance({lat,lon},center)<6);
  }
  assert.equal(fromGrid('SS00'),null);assert.equal(fromGrid('GH64YY'),null);
  assert.throws(()=>toGrid(null,0));assert.ok(fromGrid('gh64'));assert.ok(fromGrid('GH64AA00').precisionKm<fromGrid('GH64AA').precisionKm);
});
test('Great-circle distance and bearing cross the date line correctly',()=>{
  assert.ok(distance({lat:0,lon:179},{lat:0,lon:-179})<225);assert.ok(Math.abs(bearing({lat:0,lon:0},{lat:1,lon:0}))<.01);
});
test('All supported bands shown by default and regional radius remains configurable',()=>{
  assert.equal(DEFAULT_SETTINGS.visible.length,BANDS.length);assert.equal(DEFAULT_SETTINGS.nearbyRadius,300);assert.equal(DEFAULT_SETTINGS.alertBands.length,0);
  assert.throws(()=>validateSettings({...settings,lat:NaN}));assert.throws(()=>validateSettings({...settings,alertBands:['23 cm']}));assert.throws(()=>validateSettings({...settings,windowMinutes:'30'}));
});
test('PSK parsing preserves both endpoint positions and mode',()=>{
  const data=parsePSK('<receptionReports><receptionReport senderCallsign="py1aaa" receiverCallsign="dl1abc" senderLocator="GH64" receiverLocator="JO31" frequency="14074000" flowStartSeconds="1800000000" mode="FT8" sNR="-11"/></receptionReports>');
  assert.equal(data.length,1);assert.equal(data[0].tx,'PY1AAA');assert.equal(data[0].rx,'DL1ABC');assert.equal(data[0].band,'20 m');assert.equal(data[0].snr,-11);assert.ok(data[0].txPosition);assert.ok(data[0].rxPosition);
  assert.throws(()=>parsePSK('<html>Erro 429</html>'));assert.equal(parsePSK('<receptionReports/>').length,0);
  assert.throws(()=>parsePSK('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///secret">]><receptionReports></receptionReports>'));
});
test('Regional view follows stations near home instead of requiring the user callsign',()=>{
  const reports=[
    spot('1'),
    spot('2',{tx:'DX2',rx:'PY2BBB',txPosition:{lat:45,lon:8},rxPosition:{lat:-15.7,lon:-47.7}}),
    spot('3',{tx:'PT2VHF',rx:'DX3',txPosition:{lat:-15.8,lon:-47.9},rxPosition:{lat:35,lon:-3}}),
    spot('4',{tx:'LOCAL1',rx:'LOCAL2',txPosition:{lat:-15.7,lon:-47.8},rxPosition:{lat:-15.6,lon:-47.6}})
  ];
  const regional=relevantSpots(reports,settings,'nearby',now);
  assert.equal(regional.length,3);assert.deepEqual(regional.map(v=>v.origin),['regional-out','regional-in','regional-out']);
  assert.ok(regional.every(v=>v.distance>settings.nearbyRadius));
  const own=relevantSpots(reports,settings,'station',now);assert.equal(own.length,1);assert.equal(own[0].origin,'direct-tx');
});
test('Stale reports, future timestamps, duplicates and unlocated endpoints are excluded',()=>{
  const reports=[spot('1'),spot('1'),spot('2',{timestamp:now-61*60000}),spot('3',{timestamp:now+2*60000}),spot('4',{rxPosition:null})];
  assert.equal(relevantSpots(reports,settings,'nearby',now).length,1);assert.equal(mergeSpots([spot('1')],[spot('1'),spot('2',{timestamp:now-25*3600000})],now).length,1);
});
test('Space weather contributes conservatively when regional observations are absent',()=>{
  const quiet={kp:{value:1},f107:{value:180},bz:{value:2},wind:{value:380},xray:{class:'C1.2'}};
  const disturbed={kp:{value:7},f107:{value:180},bz:{value:-12},wind:{value:750},xray:{class:'X2.0'}};
  assert.ok(spaceWeatherScore('10 m',quiet)>spaceWeatherScore('10 m',disturbed));
  const band=evaluateBand([],'10 m',now,quiet);assert.ok(band.chance>0);assert.equal(band.confirmedZones.length,0);assert.equal(band.predictedZones.length,0);
});
test('Regional observations dominate chance and produce confirmed/forecast polygons',()=>{
  const reports=[
    spot('1',{rxPosition:{lat:50.5,lon:8.5}}),
    spot('2',{tx:'PY2BBB',rxPosition:{lat:50.5,lon:10.5}}),
    spot('3',{tx:'PY6CCC',rxPosition:{lat:52.5,lon:8.5}}),
    spot('4',{tx:'PY7DDD',rxPosition:{lat:52.5,lon:10.5}})
  ];
  const data=relevantSpots(reports,settings,'nearby',now);
  const b=evaluateBand(data,'20 m',now,{kp:{value:2},f107:{value:150},bz:{value:1},wind:{value:400},xray:{class:'C1.0'}});
  assert.ok(b.chance>=50);assert.equal(b.confirmedZones.length,1);assert.ok(b.predictedZones.length>=1);assert.equal(b.confirmedZones[0].type,'confirmed');assert.equal(b.predictedZones[0].type,'predicted');
});
test('Opening alerts use confirmed regional propagation rather than requiring own-station TX',()=>{
  const cfg={...settings,alertBands:['20 m'],alertMinScore:60,alertMinDistance:500};
  const high={band:'20 m',chance:85,score:80,confirmedZones:[{pairs:4,maxDistance:9000,lastEvidence:now}]},low={band:'20 m',chance:30,score:25,confirmedZones:[]};
  const m=new AlertMachine();assert.equal(m.update([high],cfg,now).length,1);assert.equal(m.update([high],cfg,now+60000).length,0);
  m.update([low],cfg,now+31*60000);assert.equal(m.update([{...high,confirmedZones:[{pairs:4,maxDistance:9000,lastEvidence:now+32*60000}]}],cfg,now+32*60000).length,1);
});
test('RBN parser maps skimmer spots into the same propagation model',()=>{
  const rows=parseRBN({spots:[{id:42,timestamp:'2026-10-06T18:30:00Z',spotter:'DL1SKM',spotter_grid:'JO31',callsign:'PY1AAA',grid:'GH64',frequency:14025.3,mode:'CW',snr:18}]});
  assert.equal(rows.length,1);assert.equal(rows[0].source,'Reverse Beacon Network');assert.equal(rows[0].band,'20 m');assert.equal(rows[0].tx,'PY1AAA');assert.equal(rows[0].rx,'DL1SKM');assert.ok(rows[0].txPosition);assert.ok(rows[0].rxPosition);
  assert.equal(relevantSpots(rows,settings,'nearby',Date.parse('2026-10-06T18:31:00Z'))[0].origin,'regional-out');
});
test('NOAA parsers preserve source timestamps and validated values',()=>{
  const kp=parseKp([['time_tag','Kp'],['2026-10-06 12:00:00.000','3.33']]);assert.equal(kp.value,3.33);
  const f=parseF107([{flux:155,time_tag:'2026-10-06T20:00:00Z'}]);assert.equal(f.value,155);
  const mag=parseSolarWindMag([{bt:6,bz_gsm:-4,time_tag:'2026-10-06T18:00:00Z'}]);assert.equal(mag.bz.value,-4);assert.equal(mag.bt.value,6);
  const wind=parseSolarWindSpeed([{proton_speed:434,time_tag:'2026-10-06T18:00:00Z'}]);assert.equal(wind.value,434);
  const x=parseXray([{current_class:'C1.4',time_tag:'2026-10-06T18:39:00Z'}]);assert.equal(x.class,'C1.4');
  assert.throws(()=>parseKp([{time_tag:'bad',kp_index:99}]));assert.throws(()=>parseF107([{flux:999,time_tag:'2026-10-06T20:00:00Z'}]));
});
test('PSK query follows the observation window and regional grid',()=>{
  const regional=new URL(pskURL({...settings,grid:'GH64AA'},'nearby'));assert.equal(regional.searchParams.get('modify'),'grid');assert.equal(regional.searchParams.get('callsign'),'GH64');assert.equal(regional.searchParams.get('flowStartSeconds'),'-1800');
  const short=new URL(pskURL({...settings,grid:'GH64AA',windowMinutes:15},'nearby'));assert.equal(short.searchParams.get('flowStartSeconds'),'-900');
  const direct=new URL(pskURL(settings,'station'));assert.equal(direct.searchParams.get('callsign'),'PT2VHF');assert.equal(direct.searchParams.get('modify'),null);
});
test('PSK query plan backfills missing observation history and then uses incremental overlap',()=>{
  const cfg={...settings,windowMinutes:30},grid='GH64';
  const first=pskQueryPlan(cfg,null,now,300000,grid);assert.equal(first.mode,'backfill');assert.equal(first.seconds,1800);assert.equal(first.from,now-1800000);
  const coverage={grid,windowMinutes:30,from:now-1800000,to:now-300000,complete:true};
  const incremental=pskQueryPlan(cfg,coverage,now,300000,grid);assert.equal(incremental.mode,'incremental');assert.equal(incremental.seconds,420);
  const enlarged=pskQueryPlan({...cfg,windowMinutes:60},coverage,now,300000,grid);assert.equal(enlarged.mode,'backfill');assert.equal(enlarged.seconds,3600);
  const stale=pskQueryPlan(cfg,{...coverage,to:now-3600000},now,300000,grid);assert.equal(stale.mode,'backfill');
  const changedGrid=pskQueryPlan(cfg,{...coverage,grid:'GG00'},now,300000,grid);assert.equal(changedGrid.mode,'backfill');
});
test('Fetching rejects arbitrary hosts and oversized streamed responses',async()=>{
  await assert.rejects(boundedFetch('https://example.com/private'));
  await assert.rejects(boundedFetch('https://services.swpc.noaa.gov/large','text',async()=>new Response(new Uint8Array(6000001))));
});
test('Fetching follows only authorized redirects and reports TX/RX activity',async()=>{
  const events=[],xml='<receptionReports/>';
  const mock=async url=>url.endsWith('/query')?new Response(null,{status:302,headers:{location:'/query/latest'}}):new Response(xml,{status:200,headers:{'content-type':'application/xml'}});
  assert.equal(await boundedFetch('https://retrieve.pskreporter.info/query','text',mock,e=>events.push(e)),xml);assert.deepEqual(events.map(e=>e.direction),['TX','INFO','RX']);
  await assert.rejects(boundedFetch('https://retrieve.pskreporter.info/query','text',async()=>new Response(null,{status:302,headers:{location:'https://evil.example/query'}})));
});
