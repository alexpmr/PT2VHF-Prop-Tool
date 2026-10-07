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

export function propagationQuality(value){
  if(!Number.isFinite(value))return {level:'none',height:2,color:[112,124,139],value:null};
  const score=Math.max(0,Math.min(100,Number(value)));
  let color;
  if(score<25){
    const u=score/25;color=[210+Math.round(25*u),55+Math.round(45*u),48];
  }else if(score<50){
    const u=(score-25)/25;color=[235+Math.round(10*u),100+Math.round(80*u),48];
  }else if(score<75){
    const u=(score-50)/25;color=[245-Math.round(95*u),180+Math.round(35*u),48+Math.round(25*u)];
  }else{
    const u=(score-75)/25;color=[150-Math.round(90*u),215+Math.round(10*u),73+Math.round(40*u)];
  }
  return {level:score<25?'low':score<50?'moderate':score<75?'good':'excellent',height:Math.round(4+score*.20),color,value:Math.round(score)};
}
export function heatLegendStops(){
  return HEAT_STOPS.map(([position,color])=>({position,color:[...color]}));
}
