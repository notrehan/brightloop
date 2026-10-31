export const money=(minor:number,currency="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:0}).format((minor||0)/100);
export const date=(v:string|null)=>v?new Date(v).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"—";
export const title=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
