import test from 'node:test';
import assert from 'node:assert/strict';
import {activityStations,sourceHealth,assistantBrief} from '../src/activity.mjs';
import {validateSettings,DEFAULT_SETTINGS,migrateSettings} from '../src/domain.mjs';
const now=1800000000000;
const settings=validateSettings({...DEFAULT_SETTINGS,lat:-15.8,lon:-47.9});
const spot={id:'one',timestamp:now-60000,band:'20 m',frequency:14074000,tx:'PT2ABC',rx:'G1ABC',source:'PSK Reporter',mode:'FT8',origin:'regional-out',endpoint:{lat:51,lon:0},bearing:30,distance:8700,snr:-10};
const snapshot={now,settings,spots:[spot],bands:[{band:'20 m',chance:80,confidence:30,reports:1,basis:'observed',latest:spot.timestamp},{band:'40 m',chance:60,confidence:70,reports:0,basis:'estimated'}],sourceStatus:{psk:{state:'online',updated:now}}};
test('Activity groups remote stations by band and preserves latest reception provenance',()=>{
  const stations=activityStations({...snapshot,spots:[spot,{...spot,id:'two',source:'WSPR.live',mode:'WSPR',timestamp:now-30000},{...spot,id:'three',band:'40 m'}]});
  assert.equal(stations.length,2);assert.equal(stations[0].call,'G1ABC');assert.equal(stations[0].reports,2);assert.deepEqual(stations[0].modes,['FT8','WSPR']);assert.equal(stations[0].source,'WSPR.live');assert.equal(stations[0].latest,now-30000);
});
test('Activity applies source, mode, direction, search, window and visible-band filters independently',()=>{
  assert.equal(activityStations(snapshot,{search:'g1'}).length,1);assert.equal(activityStations(snapshot,{search:'PT2'}).length,0);
  assert.equal(activityStations(snapshot,{mode:'CW'}).length,0);assert.equal(activityStations(snapshot,{direction:'in'}).length,0);assert.equal(activityStations(snapshot,{band:'40 m'}).length,0);
  assert.equal(activityStations({...snapshot,settings:{...settings,sourceEnabled:{psk:false}}}).length,0);
  assert.equal(activityStations({...snapshot,settings:{...settings,visible:['40 m']}}).length,0);
  for(const timestamp of [now-31*60000,now+120000,NaN])assert.equal(activityStations({...snapshot,spots:[{...spot,timestamp}]}).length,0);
  assert.equal(activityStations({...snapshot,spots:[{...spot,endpoint:{lat:999,lon:0}}]}).length,0);
  const incoming=activityStations({...snapshot,spots:[{...spot,origin:'regional-in'}]},{direction:'in'});assert.equal(incoming[0].call,'PT2ABC');
});
test('Health keeps failed source and disabled-source states even with cached data',()=>{
  const status=sourceHealth({...snapshot,sourceStatus:{psk:{state:'error',updated:now-60000},wspr:{state:'online',updated:now-3600000,coverage:{complete:false}},noaa:{state:'online',updated:now-3600000}}});
  assert.equal(status[0].state,'error');assert.equal(status[1].state,'stale');assert.equal(status[1].incomplete,true);assert.equal(status.find(s=>s.key==='noaa').state,'online');
  assert.equal(sourceHealth({...snapshot,settings:{...settings,sourceEnabled:{psk:false}}})[0].state,'disabled');
});
test('Assistant profiles change recommendations without mutating evidence or inventing observations',()=>{
  const before=JSON.stringify(snapshot);assert.equal(assistantBrief(snapshot).vars.band,'20 m');
  assert.equal(assistantBrief({...snapshot,settings:{...settings,assistantFocus:'confidence'}}).vars.band,'40 m');
  assert.equal(assistantBrief({...snapshot,settings:{...settings,assistantFocus:'observed'}},'40 m').key,'assistantEmpty');
  assert.equal(assistantBrief(snapshot).vars.call,'G1ABC');assert.equal(JSON.stringify(snapshot),before);
});
test('Old profiles acquire safe defaults while new preferences are validated',()=>{
  const old={...settings};delete old.assistantFocus;delete old.showActivity;delete old.alwaysOnTop;
  const migrated=migrateSettings({...old,showActivity:true});assert.equal(Object.hasOwn(migrated,'showActivity'),false);assert.equal(migrated.alwaysOnTop,false);assert.equal(migrated.assistantFocus,'balanced');
  assert.throws(()=>validateSettings({...settings,assistantFocus:'invent'}));assert.throws(()=>validateSettings({...settings,alwaysOnTop:'yes'}));
});
