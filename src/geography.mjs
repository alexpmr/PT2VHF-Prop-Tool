function normalizeLon(lon,reference){
  let x=Number(lon);if(!Number.isFinite(x))return x;
  while(x-reference>180)x-=360;while(x-reference<-180)x+=360;return x;
}
function ringContains(point,ring){
  if(!Array.isArray(ring)||ring.length<3)return false;
  const px=Number(point.lon),py=Number(point.lat);if(!Number.isFinite(px)||!Number.isFinite(py))return false;
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const yi=Number(ring[i][1]),yj=Number(ring[j][1]);
    const xi=normalizeLon(ring[i][0],px),xj=normalizeLon(ring[j][0],px);
    const crosses=((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/((yj-yi)||Number.EPSILON)+xi);
    if(crosses)inside=!inside;
  }
  return inside;
}
function polygonContains(point,rings){
  if(!Array.isArray(rings)||!rings.length||!ringContains(point,rings[0]))return false;
  for(let i=1;i<rings.length;i++)if(ringContains(point,rings[i]))return false;
  return true;
}
function bboxContains(point,bbox){
  if(!Array.isArray(bbox)||bbox.length<4)return true;
  const [minLon,minLat,maxLon,maxLat]=bbox.map(Number);
  if(point.lat<minLat||point.lat>maxLat)return false;
  if(maxLon-minLon>=180)return true;
  return point.lon>=minLon&&point.lon<=maxLon;
}
export function featureContainsPoint(feature,point){
  if(!feature?.geometry||!point||!bboxContains(point,feature.bbox))return false;
  const g=feature.geometry;
  if(g.type==='Polygon')return polygonContains(point,g.coordinates);
  if(g.type==='MultiPolygon')return g.coordinates.some(poly=>polygonContains(point,poly));
  return false;
}
export function countryForPoint(point,features=[]){
  for(const feature of features)if(featureContainsPoint(feature,point))return feature.properties||null;
  return null;
}
function localizedName(properties,language){
  return properties?.names?.[language]||properties?.names?.en||properties?.name||properties?.iso3||'—';
}
export function rankCountries(spots,features=[],language='pt-BR',limit=3){
  const ranked=new Map();
  for(const spot of spots||[]){
    if(!spot?.endpoint)continue;
    const country=countryForPoint(spot.endpoint,features);if(!country)continue;
    const key=country.iso3||country.name;
    if(!ranked.has(key))ranked.set(key,{iso3:country.iso3,name:localizedName(country,language),continent:country.continent||'',region:country.region||'',reports:0,sources:new Set(),distances:[]});
    const item=ranked.get(key);item.reports++;if(spot.source)item.sources.add(spot.source);if(Number.isFinite(spot.distance))item.distances.push(spot.distance);
  }
  return [...ranked.values()].map(item=>{
    const sorted=item.distances.sort((a,b)=>a-b);
    return {...item,sources:[...item.sources].sort(),distance:sorted.length?Math.round(sorted[Math.floor(sorted.length/2)]):null};
  }).sort((a,b)=>b.reports-a.reports||b.sources.length-a.sources.length||String(a.name).localeCompare(String(b.name))).slice(0,Math.max(1,limit));
}
export function rankContinents(spots,features=[],language='pt-BR',limit=3){
  const countries=rankCountries(spots,features,language,features.length||999),map=new Map();
  for(const c of countries){const key=c.continent||c.region||'—';if(!map.has(key))map.set(key,{name:key,reports:0,sources:new Set(),countries:0});const x=map.get(key);x.reports+=c.reports;x.countries++;for(const s of c.sources)x.sources.add(s);}
  return [...map.values()].map(x=>({...x,sources:[...x.sources].sort()})).sort((a,b)=>b.reports-a.reports).slice(0,Math.max(1,limit));
}
