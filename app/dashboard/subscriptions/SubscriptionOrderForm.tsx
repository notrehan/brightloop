"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./SubscriptionOrderForm.module.css";

type Plan = { id: string; productId: string; productName: string; name: string; amountMinor: number; interval: string; periodUnit: string; periodCount: number };
type Line = { key: number; kind: "product"|"section"|"note"; planId: string; description: string; quantity: string; unitPrice: string; tax: string; discount: string };
const cadence=(p:Plan)=>p.periodUnit==="week"?(p.periodCount===1?"weekly":`every ${p.periodCount} weeks`):p.periodUnit==="year"?(p.periodCount===1?"yearly":`every ${p.periodCount} years`):p.periodCount===3?"quarterly":p.periodCount===1?"monthly":`every ${p.periodCount} months`;
const blank=(key:number,kind:Line["kind"]="product"):Line=>({key,kind,planId:"",description:"",quantity:"1",unitPrice:"",tax:"0",discount:"0"});

export function SubscriptionOrderForm({plans, action}:{plans:Plan[];action:(formData:FormData)=>void|Promise<void>}) {
  const [lines,setLines]=useState<Line[]>([blank(1)]),[seq,setSeq]=useState(2),[email,setEmail]=useState(""),[phone,setPhone]=useState("");
  const firstProductKey=lines.find(l=>l.kind==="product")?.key;
  const recurrencePlan=plans.find(p=>p.id===lines.find(l=>l.kind==="product"&&l.planId)?.planId);
  const update=(key:number,changes:Partial<Line>)=>setLines(current=>current.map(line=>line.key===key?{...line,...changes}:line));
  const choosePlan=(line:Line,planId:string)=>{const selected=plans.find(p=>p.id===planId);if(line.key===firstProductKey&&selected){setLines(current=>current.map(item=>{if(item.key===line.key)return {...item,planId,description:selected.productName,unitPrice:(selected.amountMinor/100).toFixed(2)};const currentPlan=plans.find(p=>p.id===item.planId);return item.kind==="product"&&currentPlan&&(currentPlan.periodUnit!==selected.periodUnit||currentPlan.periodCount!==selected.periodCount)?{...item,planId:"",description:"",unitPrice:""}:item;}));}else update(line.key,{planId,description:selected?.productName||"",unitPrice:selected?(selected.amountMinor/100).toFixed(2):""});};
  const add=(kind:Line["kind"])=>{setLines(current=>[...current,blank(seq,kind)]);setSeq(n=>n+1);};
  const remove=(key:number)=>setLines(current=>current.filter(line=>line.key!==key));
  const totals=useMemo(()=>lines.reduce((sum,line)=>{if(line.kind!=="product")return sum;const qty=Number(line.quantity)||0,price=Math.round((Number(line.unitPrice)||0)*100),discount=Math.min(100,Math.max(0,Number(line.discount)||0)),tax=Math.max(0,Number(line.tax)||0);const subtotal=Math.round(qty*price*(1-discount/100));const taxMinor=Math.round(subtotal*tax/100);return {subtotal:sum.subtotal+subtotal,tax:sum.tax+taxMinor,total:sum.total+subtotal+taxMinor};},{subtotal:0,tax:0,total:0}),[lines]);
  const serialized=JSON.stringify(lines.map(line=>{if(line.kind!=="product")return {row_type:line.kind,description:line.description};const plan=plans.find(item=>item.id===line.planId);return {row_type:"product",plan_id:line.planId,product_id:plan?.productId,description:line.description,quantity:line.quantity,unit_price_minor:Math.round((Number(line.unitPrice)||0)*100),tax_rate_percent:line.tax,discount_percent:line.discount};}));
  return <form action={action} className={styles.form}>
    <section className={styles.panel}><div className={styles.sectionHeading}><h2>Customer</h2></div><div className={styles.customerGrid}>
      <label className={styles.wide}>Customer name <b>*</b><input name="customer_name" required placeholder="Customer or company name"/></label>
      <label>Email<input name="customer_email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required={!phone.trim()} placeholder="name@company.com"/></label>
      <label>Phone<input name="customer_phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required={!email.trim()} placeholder="+1 555 000 0000"/></label>
      <label className={styles.wide}>Address <span>Optional</span><textarea name="customer_address" rows={2} placeholder="Street, city, region, postal code, country"/></label>
    </div></section>
    <section className={styles.panel}><div className={styles.sectionHeading}><h2>Subscription details</h2></div><div className={styles.detailsGrid}>
      <label>Start date<input name="started_at" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
      <label>Expiration<input name="expires_at" type="date"/></label>
      <label>Payment terms<select name="payment_terms" defaultValue="Due immediately"><option>Due immediately</option><option>Net 7</option><option>Net 15</option><option>Net 30</option></select></label>
      <label>Recurrence<input readOnly value={recurrencePlan?cadence(recurrencePlan):"Choose a product"}/></label>
    </div></section>
    <section className={styles.panel}><div className={styles.sectionHeading}><h2>Order lines</h2><span>Subscription ID is assigned when saved</span></div>
      <input type="hidden" name="lines_json" value={serialized}/>
      <div className={styles.tableWrap}><table className={styles.lines}><thead><tr><th>Product</th><th>Description</th><th>Quantity</th><th>UoM</th><th>Unit price</th><th>Taxes</th><th>Disc.%</th><th>Subtotal</th><th/></tr></thead><tbody>
        {lines.map(line=>line.kind==="product"?<tr key={line.key}>
          <td><select aria-label="Product and plan" value={line.planId} required onChange={e=>choosePlan(line,e.target.value)}><option value="">Choose product</option>{plans.filter(p=>line.key===firstProductKey||!recurrencePlan||(p.periodUnit===recurrencePlan.periodUnit&&p.periodCount===recurrencePlan.periodCount)).map(p=><option key={p.id} value={p.id}>{p.productName} · {p.name} · ₹{(p.amountMinor/100).toFixed(2)}/{cadence(p)}</option>)}</select></td>
          <td><input aria-label="Description" value={line.description} onChange={e=>update(line.key,{description:e.target.value})} placeholder="Description"/></td>
          <td><input aria-label="Quantity" type="number" min="0.001" step="0.001" value={line.quantity} onChange={e=>update(line.key,{quantity:e.target.value})}/></td><td>Units</td>
          <td><input aria-label="Unit price in INR" type="number" min="0" step="0.01" value={line.unitPrice} onChange={e=>update(line.key,{unitPrice:e.target.value})}/></td>
          <td><select aria-label="Tax rate" value={line.tax} onChange={e=>update(line.key,{tax:e.target.value})}><option value="0">0%</option><option value="5">5%</option><option value="15">15%</option><option value="18">18%</option></select></td>
          <td><input aria-label="Discount percent" type="number" min="0" max="100" step="0.01" value={line.discount} onChange={e=>update(line.key,{discount:e.target.value})}/></td>
          <td className={styles.amount}>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format((Math.round((Number(line.quantity)||0)*Math.round((Number(line.unitPrice)||0)*100)*(1-Math.min(100,Math.max(0,Number(line.discount)||0))/100)))/100)}</td>
          <td><button className={styles.remove} type="button" aria-label="Remove product line" onClick={()=>remove(line.key)}><Trash2 size={15}/></button></td>
        </tr>:line.kind==="section"?<tr className={styles.sectionRow} key={line.key}><td colSpan={8}><input value={line.description} onChange={e=>update(line.key,{description:e.target.value})} placeholder="Section title" aria-label="Section title"/></td><td><button className={styles.remove} type="button" aria-label="Remove section" onClick={()=>remove(line.key)}><Trash2 size={15}/></button></td></tr>:<tr className={styles.noteRow} key={line.key}><td colSpan={8}><input value={line.description} onChange={e=>update(line.key,{description:e.target.value})} placeholder="Write a note for this order" aria-label="Order note"/></td><td><button className={styles.remove} type="button" aria-label="Remove note" onClick={()=>remove(line.key)}><Trash2 size={15}/></button></td></tr>)}
      </tbody></table></div>
      <div className={styles.lineActions}><button type="button" onClick={()=>add("product")}><Plus size={15}/> Add a product</button><button type="button" onClick={()=>add("section")}><Plus size={15}/> Add section</button><button type="button" onClick={()=>add("note")}><Plus size={15}/> Add a note</button></div>
      <div className={styles.bottomGrid}><label>Terms and conditions<textarea name="terms" rows={3} placeholder="Optional terms for this subscription"/></label><div className={styles.totals}><div><span>Untaxed amount</span><strong>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(totals.subtotal/100)}</strong></div><div><span>Taxes</span><strong>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(totals.tax/100)}</strong></div><div className={styles.grand}><span>Total</span><strong>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(totals.total/100)}</strong></div></div></div>
    </section>
    <div className={styles.footer}><a href="/dashboard/subscriptions" className="button secondary">Cancel</a><button className="button primary">Save Subscription</button></div>
  </form>;
}
