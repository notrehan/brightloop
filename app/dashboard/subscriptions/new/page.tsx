import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace";
import { SubscriptionOrderForm } from "../SubscriptionOrderForm";
import { createSubscriptionOrder } from "../actions";

export default async function NewSubscription({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {supabase,businessId}=await requireWorkspace(); const params=await searchParams;
  const {data:rows,error}=await supabase.from("pricing_plans").select("id,name,amount_minor,interval,period_unit,period_count,product_id,products(name)").eq("business_id",businessId).eq("enabled",true).order("created_at",{ascending:false});
  const plans=(rows||[]).map((row:any)=>({id:row.id,productId:row.product_id,productName:row.products?.name||"Product",name:row.name,amountMinor:row.amount_minor,interval:row.interval,periodUnit:row.period_unit||"month",periodCount:row.period_count||(row.interval==="quarterly"?3:row.interval==="yearly"?12:1)}));
  return <section className="page subscription-create-page">
    <div className="product-breadcrumb"><Link href="/dashboard/subscriptions">Subscriptions</Link><i>/</i><strong>New Subscription</strong></div>
    <div className="page-heading"><div><h1>New Subscription</h1></div><Link href="/dashboard/subscriptions" className="button secondary"><ArrowLeft size={15}/> Back to subscriptions</Link></div>
    {params.error&&<div className="alert error">{params.error}</div>}
    {error&&<div className="alert error">Could not load product pricing. Apply the current Supabase migrations and refresh.</div>}
    {!plans.length&&!error&&<div className="alert error">Create an enabled recurring product and price before starting a subscription.</div>}
    <SubscriptionOrderForm plans={plans} action={createSubscriptionOrder}/>
  </section>;
}
