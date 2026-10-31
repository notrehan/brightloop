"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type PriceRow = { period: string; label: string; amount: string };
const choices = [
  { value: "week:1", label: "Weekly" },
  { value: "month:1", label: "Monthly" },
  { value: "month:2", label: "Every 2 months" },
  { value: "month:3", label: "Quarterly (3 months)" },
  { value: "month:6", label: "Every 6 months" },
  { value: "year:1", label: "Yearly" },
  { value: "year:2", label: "Every 2 years" },
];
export function PricingRows() {
  const [rows, setRows] = useState<PriceRow[]>([{period:"month:1",label:"",amount:""}]);
  const update = (index:number, key:keyof PriceRow, value:string) => setRows(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row));
  const remove = (index:number) => setRows(current=>current.length===1?current:current.filter((_,i)=>i!==index));
  return <div className="pricing-editor">
    <div className="pricing-editor-heading"><h3>Time-based pricing</h3><button type="button" className="button secondary add-price-button" onClick={()=>setRows(current=>[...current,{period:"month:1",label:"",amount:""}])}><Plus size={15}/> Add a price</button></div>
    <input type="hidden" name="price_count" value={rows.length}/>
    <div className="pricing-table"><div className="pricing-table-head"><span>Period</span><span>Pricelist label</span><span>Price (INR)</span><span/></div>{rows.map((row,index)=><div className="pricing-table-row" key={index}>
      <select name={`price_period_${index}`} aria-label={`Billing period ${index+1}`} value={row.period} onChange={e=>update(index,"period",e.target.value)}>{choices.map(choice=><option value={choice.value} key={choice.value}>{choice.label}</option>)}</select>
      <input name={`price_label_${index}`} aria-label={`Pricelist label ${index+1}`} placeholder="e.g. VIP customers" value={row.label} onChange={e=>update(index,"label",e.target.value)}/>
      <div className="currency-input"><span>₹</span><input name={`price_amount_${index}`} aria-label={`Price ${index+1}`} type="number" min="0" step="0.01" placeholder="0.00" value={row.amount} onChange={e=>update(index,"amount",e.target.value)}/></div>
      <button type="button" className="remove-price-button" aria-label={`Remove ${choices.find(choice=>choice.value===row.period)?.label||"price"}`} onClick={()=>remove(index)} disabled={rows.length===1}><Trash2 size={16}/></button>
    </div>)}</div>
  </div>;
}
