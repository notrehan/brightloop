import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace";
import { date, money, periodLabel, title } from "@/lib/format";
import { runBilling, setSubscriptionStatus } from "../actions";

export default async function Subscriptions({searchParams}:{searchParams:Promise<{success?:string;error?:string;created?:string}>}) {
  const {supabase,businessId}=await requireWorkspace(); const params=await searchParams;
  const {data:subs=[],error}=await supabase.from("subscriptions").select("id,subscription_number,status,amount_minor,total_minor,interval,period_unit,period_count,next_billing_at,started_at,customers(name,email,phone),pricing_plans(name),subscription_items(id,row_type)").eq("business_id",businessId).order("created_at",{ascending:false}) as any;
  return <section className="page subscriptions-list-page">
    <div className="page-heading"><div><h1>Subscriptions</h1></div><div className="row-actions"><form action={runBilling}><button className="button secondary">Run billing cycle</button></form><Link href="/dashboard/subscriptions/new" className="button primary"><Plus size={16}/> New Subscription</Link></div></div>
    {params.success&&<div className="alert success">{params.success}{params.created&&<> · <Link href={`/dashboard/subscriptions/${params.created}`}>View subscription</Link></>}</div>}{params.error&&<div className="alert error">{params.error}</div>}
    {error&&<div className="alert error">Subscription order fields are not in Supabase yet. Run <strong>supabase/subscriptions_order_editor.sql</strong> in the SQL Editor, then refresh.</div>}
    <div className="panel table-panel"><div className="table-wrap subscriptions-table-scroll"><table><thead><tr><th>Subscription</th><th>Customer</th><th>Order lines</th><th>Recurring amount</th><th>Status</th><th>Next billing</th><th>Actions</th></tr></thead><tbody>
      {subs.map((s:any)=><tr key={s.id}><td><Link href={`/dashboard/subscriptions/${s.id}`} className="subscription-number">{s.subscription_number||`S-${s.id.slice(0,8).toUpperCase()}`}<ArrowUpRight size={13}/></Link><small>Started {date(s.started_at)}</small></td><td><strong>{s.customers?.name||"Customer"}</strong><small>{s.customers?.email||s.customers?.phone||"No contact"}</small></td><td>{(s.subscription_items||[]).filter((line:any)=>line.row_type==="product").length||1} products</td><td>{money(s.amount_minor)} / {periodLabel(s.period_unit,s.period_count)}</td><td><span className={`status ${s.status}`}>{title(s.status)}</span></td><td>{date(s.next_billing_at)}</td><td><form action={setSubscriptionStatus} className="row-actions"><input type="hidden" name="id" value={s.id}/>{s.status==="paused"?<button name="status" value="active" className="small-button">Resume</button>:<button name="status" value="paused" className="small-button" disabled={!['active','trialing','past_due'].includes(s.status)}>Pause</button>}<button name="status" value="cancelled" className="small-button danger-text" disabled={s.status==="cancelled"}>Cancel</button></form></td></tr>)}
    </tbody></table>{!subs.length&&!error&&<div className="empty-state">No subscriptions yet. Create one to get started.<p><Link className="button primary" href="/dashboard/subscriptions/new">New Subscription</Link></p></div>}</div></div>
  </section>;
}
