export type RiskStats = { returnPct: number | null; volatilityPct: number | null; maxDrawdownPct: number | null; sharpe: number | null; sample: number };
function clean(values:number[]){return values.filter(v=>Number.isFinite(v)&&v>0)}
export function periodReturn(values:number[]){const v=clean(values);if(v.length<2)return null;return(v.at(-1)!/v[0]-1)*100}
export function maxDrawdown(values:number[]){const v=clean(values);if(v.length<2)return null;let peak=v[0],max=0;for(const x of v){peak=Math.max(peak,x);if(peak>0)max=Math.max(max,(peak-x)/peak*100)}return max}
export function dailyReturns(values:number[]){const v=clean(values),o:number[]=[];for(let i=1;i<v.length;i++)if(v[i-1]>0)o.push(v[i]/v[i-1]-1);return o}
export function volatilityAnnualized(values:number[]){const r=dailyReturns(values);if(r.length<2)return null;const m=r.reduce((a,b)=>a+b,0)/r.length,variance=r.reduce((s,x)=>s+(x-m)**2,0)/(r.length-1);return Math.sqrt(Math.max(0,variance))*Math.sqrt(252)*100}
export function sharpeAnnualized(values:number[],riskFreeAnnualPct=1.5){const r=dailyReturns(values);if(r.length<2)return null;const m=r.reduce((a,b)=>a+b,0)/r.length,variance=r.reduce((s,x)=>s+(x-m)**2,0)/(r.length-1),sd=Math.sqrt(Math.max(0,variance));if(sd===0)return null;const rf=Math.pow(1+riskFreeAnnualPct/100,1/252)-1;return((m-rf)/sd)*Math.sqrt(252)}
export function riskStats(values:number[]):RiskStats{return{returnPct:periodReturn(values),volatilityPct:volatilityAnnualized(values),maxDrawdownPct:maxDrawdown(values),sharpe:sharpeAnnualized(values),sample:clean(values).length}}
export function normalized(values:number[]){const v=clean(values);return!v.length?[]:v.map(x=>x/v[0])}
