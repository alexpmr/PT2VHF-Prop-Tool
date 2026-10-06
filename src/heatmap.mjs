export const HEAT_STOPS=[
  [0.00,[32,55,170]],[0.20,[30,111,214]],[0.40,[25,190,201]],
  [0.58,[47,202,110]],[0.74,[238,218,73]],[0.88,[244,139,47]],[1.00,[224,52,45]]
];
export function clamp01(value){return Math.max(0,Math.min(1,Number(value)||0));}
export function kernelRadius(scale=1){
  const z=Math.max(1,Math.min(6,Number(scale)||1));
  return Math.round(Math.max(12,Math.min(30,30-(z-1)*3.6)));
}
export function heatColor(value){
  const t=clamp01(value);
  for(let i=1;i<HEAT_STOPS.length;i++){
    const [p1,c1]=HEAT_STOPS[i];
    if(t<=p1){
      const [p0,c0]=HEAT_STOPS[i-1],u=(t-p0)/(p1-p0||1);
      return c0.map((v,j)=>Math.round(v+(c1[j]-v)*u));
    }
  }
  return [...HEAT_STOPS.at(-1)[1]];
}
export function aggregateHeatSamples(samples,cellSize=8){
  const size=Math.max(2,Number(cellSize)||8),bins=new Map();
  for(const sample of samples||[]){
    if(!Number.isFinite(sample?.x)||!Number.isFinite(sample?.y))continue;
    const weight=Math.max(0,Number(sample.weight)||0);if(!weight)continue;
    const gx=Math.floor(sample.x/size),gy=Math.floor(sample.y/size),key=gx+','+gy;
    const previous=bins.get(key)||{x:0,y:0,weight:0,count:0};
    const total=previous.weight+weight;
    previous.x=(previous.x*previous.weight+sample.x*weight)/total;
    previous.y=(previous.y*previous.weight+sample.y*weight)/total;
    previous.weight=total;previous.count++;
    bins.set(key,previous);
  }
  return [...bins.values()];
}
