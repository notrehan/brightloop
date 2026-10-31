export const money=(minor:number,currency="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:0}).format((minor||0)/100);
export const date=(v:string|null)=>v?new Date(v).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—";
export const title=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
export const periodLabel=(unit?:string|null,count?:number|null)=>{const n=Math.max(1,Number(count)||1),u=unit||"month";if(u==="week")return n===1?"weekly":`every ${n} weeks`;if(u==="year")return n===1?"yearly":`every ${n} years`;return n===1?"monthly":n===3?"quarterly":`every ${n} months`;};
