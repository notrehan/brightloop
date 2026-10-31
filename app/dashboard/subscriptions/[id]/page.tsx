import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { date, money, periodLabel, title } from "@/lib/format";
import { PrintButton } from "../PrintButton";

export default async function SubscriptionDetails({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {supabase,businessId}=await requireWorkspace();
  const {data:sub,error}=await supabase.from("subscriptions").select("*,customers(name,email,phone,address),pricing_plans(name),subscription_items(id,row_type,product_id,plan_id,description,quantity,unit_of_measure,unit_price_minor,discount_percent,tax_rate_percent,subtotal_minor,tax_minor,total_minor,sort_order,products(name))").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(error||!sub)notFound();
  return <section className="page">
    <div className="product-breadcrumb"><Link href="/dashboard/subscriptions">Subscriptions</Link><i>/</i><strong>{sub.subscription_number||`S-${sub.id.slice(0,8).toUpperCase()}`}</strong></div>
    <div className="page-heading"><div><h1>{sub.subscription_number||`S-${sub.id.slice(0,8).toUpperCase()}`} <span className={`status ${sub.status}`}>{title(sub.status)}</span></h1></div><div className="row-actions"><PrintButton/><Link href="/dashboard/subscriptions" className="button secondary"><ArrowLeft size={15}/> Subscriptions</Link></div></div>
    <div className="panel subscription-overview-grid"><div><h2>Customer</h2><strong>{sub.customers?.name||"Customer"}</strong><p>{sub.customers?.email||sub.customers?.phone||"No email or phone"}</p><p>{sub.customers?.address||"No address"}</p></div><div><h2>Subscription</h2><p><span>Plan</span><strong>{sub.pricing_plans?.name||"Custom order"}</strong></p><p><span>Recurrence</span><strong>{periodLabel(sub.period_unit,sub.period_count)}</strong></p><p><span>Payment terms</span><strong>{sub.payment_terms||"Due immediately"}</strong></p></div><div><h2>Dates</h2><p><span>Start date</span><strong>{date(sub.started_at)}</strong></p><p><span>Expiration</span><strong>{date(sub.expires_at)}</strong></p><p><span>Next billing</span><strong>{date(sub.next_billing_at)}</strong></p></div></div>
    <section className="panel subscription-lines-panel"><div className="panel-title"><div><h2>Order lines</h2></div></div><div className="table-wrap"><table><thead><tr><th>Product / Section</th><th>Description</th><th>Quantity</th><th>Unit price</th><th>Taxes</th><th>Discount</th><th>Subtotal</th></tr></thead><tbody>{(sub.subscription_items||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((line:any)=><tr key={line.id} className={line.row_type==="section"?"subscription-section-row":line.row_type==="note"?"subscription-note-row":""}>{line.row_type==="product"?<><td>{line.products?.name||line.description}</td><td>{line.description}</td><td>{line.quantity} {line.unit_of_measure}</td><td>{money(line.unit_price_minor)}</td><td>{line.tax_rate_percent}% · {money(line.tax_minor)}</td><td>{line.discount_percent}%</td><td>{money(line.subtotal_minor)}</td></>:<td colSpan={7}>{line.description}</td>}</tr>)}</tbody></table>{!sub.subscription_items?.length&&<div className="empty-state">No saved order lines.</div>}</div>
      <div className="subscription-detail-totals"><div><span>Untaxed amount</span><strong>{money(sub.amount_minor)}</strong></div><div><span>Taxes</span><strong>{money(sub.tax_minor)}</strong></div><div className="grand"><span>Total</span><strong>{money(sub.total_minor||sub.amount_minor)}</strong></div></div>
    </section>
    {sub.terms&&<section className="panel"><h2>Terms and conditions</h2><p>{sub.terms}</p></section>}
  </section>;
}
