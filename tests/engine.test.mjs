import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,BANDS,toGrid,fromGrid,distance,bearing,validateSettings,parsePSK,relevantSpots,evaluateBand,spaceWeatherScore,mergeSpots,filterSpotsBySources,AlertMachine} from '../src/domain.mjs';
import {parseKp,parseF107,parseSolarWindMag,parseSolarWindSpeed,parseXray,parseRBN,parseWSPR,wsprURL,pskURL,pskQueryPlan,boundedFetch,rbnURLs,filterRBNByRadius} from '../src/sources.mjs';
import {assistantReply} from '../src/assistant.mjs';
import {parseIonograms,selectNearbyIonosonde,bandMufContext,MUF_MAX_AGE} from '../src/muf.mjs';
import {countryForPoint,rankCountries,rankContinents} from '../src/geography.mjs';
import {buildVoacapDeck,parseVoacapReliability,predictionsForHour,observedTargets,VOACAP_BANDS} from '../src/voacap.mjs';
import {propagationQuality,heatLegendStops,HEAT_STOPS} from '../src/heatmap.mjs';
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
test('All supported bands shown by default, update check defaults to 15 minutes and regional radius remains configurable',()=>{
  assert.equal(DEFAULT_SETTINGS.visible.length,BANDS.length);assert.equal(DEFAULT_SETTINGS.nearbyRadius,300);assert.equal(DEFAULT_SETTINGS.alertBands.length,0);assert.equal(DEFAULT_SETTINGS.updateMinutes,15);assert.equal(DEFAULT_SETTINGS.mapBase,'default');assert.equal(Object.values(DEFAULT_SETTINGS.sourceEnabled).every(Boolean),true);
  assert.throws(()=>validateSettings({...settings,lat:NaN}));assert.throws(()=>validateSettings({...settings,alertBands:['23 cm']}));assert.throws(()=>validateSettings({...settings,windowMinutes:'30'}));
  assert.throws(()=>validateSettings({...settings,mapBase:'satellite'}));const filtered=validateSettings({...settings,mapBase:'terrain',sourceEnabled:{psk:false,wspr:true}});assert.equal(filtered.mapBase,'terrain');assert.equal(filtered.sourceEnabled.psk,false);assert.equal(filtered.sourceEnabled.wspr,true);assert.equal(filtered.sourceEnabled.rbn,true);
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
  const band=evaluateBand([],'10 m',now,quiet);assert.ok(band.chance>0);assert.equal(band.basis,'estimated');assert.equal(band.confirmedZones.length,0);assert.equal(band.predictedZones.length,0);
  const eleven=evaluateBand([],'11 m',now,quiet);assert.ok(eleven.chance>0);assert.equal(eleven.basis,'estimated');assert.equal(eleven.reports,0);assert.equal(eleven.confirmedZones.length,0);
});
test('Regional observations dominate chance and produce heatmap support zones',()=>{
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
test('Independent observation sources are identified without multiplying the same link pair',()=>{
  const a=spot('10',{source:'PSK Reporter'}),b=spot('11',{source:'WSPR.live',tx:a.tx,rx:a.rx,txPosition:a.txPosition,rxPosition:a.rxPosition,timestamp:a.timestamp});
  const data=relevantSpots([a,b],settings,'nearby',now),result=evaluateBand(data,'20 m',now,{kp:{value:2},f107:{value:150},bz:{value:1},wind:{value:400},xray:{class:'C1.0'}});
  assert.equal(result.sourceCount,2);assert.equal(result.pairs,1);assert.equal(result.reports,2);assert.equal(result.basis,'fused');assert.ok(result.confidence>0);assert.equal(result.independentEvents,1);assert.equal(result.convergedEvents,1);
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
test('WSPR.live URL is bounded by window, grid and supported bands, and parser feeds the regional model',()=>{
  const url=new URL(wsprURL({...settings,grid:'GH64AA',visible:['20 m','10 m','11 m']},900));const query=decodeURIComponent(url.searchParams.get('query'));
  assert.equal(url.hostname,'db1.wspr.live');assert.match(query,/INTERVAL 900 SECOND/);assert.match(query,/startsWith\(tx_loc,'GH64'\)/);assert.match(query,/band IN \(14,28\)/);assert.doesNotMatch(query,/27/);
  const payload={data:[{id:7,time:'2026-10-06 18:30:00',frequency:14095600,tx_sign:'PY1AAA',tx_lat:-15.8,tx_lon:-47.9,tx_loc:'GH64',rx_sign:'DL1ABC',rx_lat:51,rx_lon:7,rx_loc:'JO31',snr:-20,code:1}]};
  const rows=parseWSPR(payload);assert.equal(rows.length,1);assert.equal(rows[0].source,'WSPR.live');assert.equal(rows[0].band,'20 m');assert.equal(rows[0].mode,'WSPR');
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
  const widerCoverage={...coverage,windowMinutes:60,from:now-3600000};const reduced=pskQueryPlan({...cfg,windowMinutes:15},widerCoverage,now,300000,grid);assert.equal(reduced.mode,'incremental');
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

test('Offline geography resolves countries and ranks geolocated evidence',()=>{
  const countries=[{type:'Feature',properties:{name:'Brasil',names:{'pt-BR':'Brasil',en:'Brazil'},iso3:'BRA',continent:'South America'},bbox:[-75,-35,-34,6],geometry:{type:'Polygon',coordinates:[[[-75,-35],[-34,-35],[-34,6],[-75,6],[-75,-35]]]}}];
  assert.equal(countryForPoint({lat:-15.8,lon:-47.9},countries).iso3,'BRA');assert.equal(countryForPoint({lat:50,lon:8},countries),null);
  const ranked=rankCountries([{endpoint:{lat:-15.8,lon:-47.9},source:'PSK Reporter',distance:900},{endpoint:{lat:-10,lon:-50},source:'WSPR.live',distance:1200}],countries,'en',3);
  assert.equal(ranked[0].name,'Brazil');assert.equal(ranked[0].reports,2);assert.equal(ranked[0].sources.length,2);
  const regions=rankContinents([{endpoint:{lat:-15.8,lon:-47.9},source:'PSK Reporter'}],countries,'pt-BR',3);assert.equal(regions[0].name,'América do Sul');
});
test('Confidence falls when otherwise similar evidence gets older',()=>{
  const fresh=[spot('20',{txGrid:'GH64AA',rxGrid:'JO31AA',origin:'regional-out',endpoint:{lat:50,lon:8},distance:8000,bearing:40})];
  const stale=[{...fresh[0],timestamp:now-25*60000}];
  const a=evaluateBand(fresh,'20 m',now,{}),b=evaluateBand(stale,'20 m',now,{});
  assert.ok(a.confidence>b.confidence);assert.ok(a.score>=b.score);
});

test('Assistant routes different questions to different answers and respects selected/specific bands',()=>{
  const spots=[
    {...spot('1'),bearing:45,distance:1500,origin:'regional-out',endpoint:{lat:1,lon:1}},
    {...spot('2'),bearing:50,distance:1700,origin:'regional-in',endpoint:{lat:2,lon:2}}
  ];
  const bands=BANDS.map(b=>evaluateBand(spots,b.name,now,{kp:{value:2},f107:{value:155},bz:{value:1},wind:{value:400},xray:{class:'C1.0'}}));
  const snapshot={settings:{...settings,windowMinutes:30,visible:BANDS.map(b=>b.name)},spots,bands,sourceStatus:{psk:{state:'online'},rbn:{state:'online'},wspr:{state:'online'},noaa:{state:'online'}}};
  const best=assistantReply('qual a melhor banda agora?',snapshot,'40 m');assert.equal(best.key,'assistantBest');assert.equal(best.vars.band,'20 m');
  assert.equal(assistantReply('como estão os 20 metros?',snapshot,'').key,'assistantBand');
  assert.equal(assistantReply('qual direção para 20m?',snapshot,'').key,'assistantDirection');
  const countries=[{type:'Feature',properties:{name:'Teste',names:{'pt-BR':'País Teste'},iso3:'TST',continent:'South America'},bbox:[0,0,3,3],geometry:{type:'Polygon',coordinates:[[[0,0],[3,0],[3,3],[0,3],[0,0]]]}}];
  const countryAnswer=assistantReply('quais países estão favorecidos em 20m?',snapshot,'',{countries,language:'pt-BR'});assert.equal(countryAnswer.key,'assistantCountries');assert.match(countryAnswer.vars.countries,/País Teste/);
  const regionAnswer=assistantReply('qual região está favorecida em 20m?',snapshot,'',{countries,language:'pt-BR'});assert.equal(regionAnswer.key,'assistantRegions');assert.match(regionAnswer.vars.regions,/América do Sul/);
  assert.equal(assistantReply('como estão as fontes?',snapshot,'').key,'assistantSources');
  assert.equal(assistantReply('qual a janela de observação?',snapshot,'').key,'assistantWindow');
  assert.equal(assistantReply('o que é esse heatmap?',snapshot,'').key,'assistantHeatmap');
  assert.equal(assistantReply('banana com rádio?',snapshot,'').key,'assistantUnknown');
});


test('VOACAP deck uses local point-to-point HF frequencies and configured power',()=>{
  const deck=buildVoacapDeck({date:new Date('2026-10-06T22:00:00Z'),tx:{lat:-15.8,lon:-47.9},rx:{lat:51,lon:7},power:100,ssn:120});
  assert.match(deck,/COEFFS\s+CCIR/);assert.match(deck,/MONTH\s+2026\s+10\.00/);assert.match(deck,/SUNSPOT\s+120\.0/);
  assert.match(deck,/14\.175/);assert.match(deck,/27\.185/);assert.match(deck,/28\.850/);assert.match(deck,/METHOD\s+30/);
});
test('VOACAP REL parser rotates UTC 24 to hour zero and returns per-band percentages',()=>{
  const rows=[];for(let h=1;h<=24;h++){const vals=Object.keys(VOACAP_BANDS).map((_,i)=>((h+i)%10)/10);rows.push(' 0.50 '+vals.map(v=>v.toFixed(2)).join(' ')+' REL');}
  const parsed=parseVoacapReliability(rows.join('\n'));assert.equal(parsed.length,24);assert.equal(parsed[0][0],40);
  const byBand=predictionsForHour(rows.join('\n'),0);assert.equal(byBand['80 m'],40);assert.ok(Number.isFinite(byBand['10 m']));
});
test('VOACAP targets are derived only from geolocated observed endpoints',()=>{
  const data=relevantSpots([spot('1'),spot('2',{rxPosition:{lat:40,lon:-3}})],settings,'nearby',now);
  const targets=observedTargets(data,settings,12);assert.equal(targets.length,2);assert.ok(targets.every(v=>Number.isFinite(v.distance)&&Number.isFinite(v.bearing)));
});
test('VOACAP reliability contributes to HF chance without becoming observed evidence',()=>{
  const predicted=[{band:'20 m',reliability:82,timestamp:now,target:{lat:50,lon:8}}];
  const b=evaluateBand([],'20 m',now,{},predicted);assert.equal(b.basis,'voacap');assert.equal(b.voacapScore,82);assert.ok(b.chance>0);assert.equal(b.reports,0);
});

test('Ionogram adapter keeps only recent physically plausible MUF and foF2 values',()=>{
 const recent=new Date(now-10*60000).toISOString();
 const rows=parseIonograms([
  {station:{code:'BR001',name:'Brasil',latitude:'-15.8',longitude:'312.1'},time:recent,fof2:9.2,mufd:29.6,cs:78},
  {station:{code:'OLD',latitude:'-15.9',longitude:'-47.9'},time:new Date(now-MUF_MAX_AGE-1000).toISOString(),fof2:10,mufd:30},
  {station:{code:'BAD',latitude:'-95',longitude:'-47'},time:recent,fof2:12,mufd:40},
  {station:{code:'ZERO',latitude:'-13',longitude:'-48'},time:recent,fof2:0,mufd:0}
 ],now);
 assert.equal(rows.length,1);assert.equal(rows[0].lon,-47.89999999999998);assert.equal(rows[0].muf3000,29.6);assert.equal(rows[0].fof2,9.2);
});
test('MUF uses a nearby valid station and never asserts precise link cutoff',()=>{
 const rows=parseIonograms([
   {station:{code:'CLOSE',name:'Near',latitude:-16,longitude:-48},time:new Date(now-10*60000).toISOString(),fof2:8.5,mufd:24.5},
   {station:{code:'FAR',name:'Far',latitude:42,longitude:11},time:new Date(now-10*60000).toISOString(),fof2:15,mufd:45}
 ],now);
 const near=selectNearbyIonosonde(rows,{lat:-15.8,lon:-47.9},now);
 assert.equal(near.code,'CLOSE');
 assert.equal(bandMufContext('15 m',near,now).level,'within');
 assert.equal(bandMufContext('10 m',near,now).level,'above');
 assert.equal(bandMufContext('2 m',near,now),null);
 assert.equal(selectNearbyIonosonde(rows,{lat:85,lon:85},now),null);
 assert.equal(bandMufContext('20 m',{...near,timestamp:now-MUF_MAX_AGE-1},now),null);
});


test('Source comparison keeps WSPR and RBN observations when PSK is disabled',()=>{
  const p=spot('90',{source:'PSK Reporter'});
  const w=spot('91',{source:'WSPR.live',tx:'PT2AAA',rx:'DL1AAA'});
  const r=spot('92',{source:'Reverse Beacon Network',tx:'PT2BBB',rx:'K1ABC'});
  const filtered=filterSpotsBySources([p,w,r],{psk:false,wspr:true,rbn:true});
  assert.deepEqual(filtered.map(s=>s.source),['WSPR.live','Reverse Beacon Network']);
  const regional=relevantSpots(filtered,settings,'nearby',now);
  assert.ok(regional.length>=2);
  const band=evaluateBand(regional,'20 m',now,{kp:{value:2},f107:{value:150}});
  assert.ok(band.reports>=2);assert.notEqual(band.basis,'none');assert.ok(band.chance>0);
});

test('Source comparison supports WSPR-only and RBN-only snapshots',()=>{
  const w=spot('93',{source:'WSPR.live',tx:'PT2AAA',rx:'DL1AAA'});
  const r=spot('94',{source:'Reverse Beacon Network',tx:'PT2BBB',rx:'K1ABC'});
  const wOnly=relevantSpots(filterSpotsBySources([w,r],{psk:false,wspr:true,rbn:false}),settings,'nearby',now);
  const rOnly=relevantSpots(filterSpotsBySources([w,r],{psk:false,wspr:false,rbn:true}),settings,'nearby',now);
  assert.equal(wOnly.length,1);assert.equal(wOnly[0].source,'WSPR.live');
  assert.equal(rOnly.length,1);assert.equal(rOnly[0].source,'Reverse Beacon Network');
});

test('RBN regional queries are band/time based and never infer geography from callsign prefix',()=>{
  const urls=rbnURLs({...settings,callsign:'PT2VHF',windowMinutes:30,visible:['40 m','20 m','10 m']},now).map(u=>new URL(u));
  assert.equal(urls.length,3);
  assert.deepEqual(urls.map(u=>u.searchParams.get('band')),['40m','20m','10m']);
  assert.ok(urls.every(u=>u.searchParams.get('since')&&u.searchParams.get('limit')==='1000'));
  assert.ok(urls.every(u=>!u.searchParams.has('call')&&!u.searchParams.has('spotter')));
});

test('RBN region is defined only by real grid distance to configured radius',()=>{
  const home={...settings,nearbyRadius:300};
  const nearTx=spot('101',{source:'Reverse Beacon Network',txPosition:{lat:-15.9,lon:-47.8},rxPosition:{lat:50,lon:8}});
  const nearRx=spot('102',{source:'Reverse Beacon Network',txPosition:{lat:40,lon:-3},rxPosition:{lat:-16.2,lon:-48}});
  const bothFar=spot('103',{source:'Reverse Beacon Network',txPosition:{lat:40,lon:-3},rxPosition:{lat:50,lon:8}});
  const bothNear=spot('104',{source:'Reverse Beacon Network',txPosition:{lat:-15.9,lon:-47.8},rxPosition:{lat:-16.2,lon:-48}});
  const mobileWrongPrefix=spot('105',{source:'Reverse Beacon Network',tx:'PT2MOBILE',txPosition:{lat:-23.5,lon:-46.6},rxPosition:{lat:50,lon:8}});
  const foreignCallNear=spot('106',{source:'Reverse Beacon Network',tx:'PY1XYZ',txPosition:{lat:-15.7,lon:-47.7},rxPosition:{lat:50,lon:8}});
  const kept=filterRBNByRadius([nearTx,nearRx,bothFar,bothNear,mobileWrongPrefix,foreignCallNear],home);
  assert.deepEqual(kept.map(s=>s.id),['101','102','106']);
});


test('Band quality bar maps score to increasing height and red-to-green levels',()=>{
  const none=propagationQuality(null),low=propagationQuality(10),mid=propagationQuality(50),high=propagationQuality(90);
  assert.equal(none.level,'none');assert.equal(none.value,null);
  assert.equal(low.level,'low');assert.equal(mid.level,'good');assert.equal(high.level,'excellent');
  assert.ok(low.height<mid.height&&mid.height<high.height);
  assert.ok(low.color[0]>low.color[1]);
  assert.ok(high.color[1]>high.color[0]);
});

test('Heatmap legend reuses the exact renderer color stops',()=>{
  const legend=heatLegendStops();
  assert.equal(legend.length,HEAT_STOPS.length);
  assert.deepEqual(legend.map(s=>s.position),HEAT_STOPS.map(s=>s[0]));
  assert.deepEqual(legend.map(s=>s.color),HEAT_STOPS.map(s=>s[1]));
});
