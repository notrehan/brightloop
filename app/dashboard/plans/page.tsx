import { requireWorkspace } from "@/lib/workspace";
import { createPlan } from "../actions";
import { money, periodLabel } from "@/lib/format";
export default async function Plans({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const { supabase, businessId } = await requireWorkspace();
  const params = await searchParams;
  const [{ data: plansData }, { data: productData }] = await Promise.all([
    supabase.from("pricing_plans").select("id,name,description,amount_minor,interval,period_unit,period_count,trial_days,enabled,recommended,products(name)").eq("business_id", businessId).order("amount_minor"),
    supabase.from("products").select("id,name").eq("business_id", businessId).eq("enabled", true).order("name"),
  ]) as any;
  const plans = plansData ?? [], products = productData ?? [];
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">CATALOG</p><h1>Plans & pricing</h1><p>Set up recurring price options for each product.</p></div></div>
    {params.success && <div className="alert success">{params.success}</div>}{params.error && <div className="alert error">{params.error}</div>}
    <div className="panel"><h2>Create a pricing plan</h2><form action={createPlan} className="inline-form"><select name="product_id" required defaultValue=""><option value="" disabled>Select product</option>{products.map((x: any) => <option value={x.id} key={x.id}>{x.name}</option>)}</select><input name="name" placeholder="Plan name" required/><input name="amount" type="number" min="0" step="0.01" placeholder="Price in ₹" required/><select name="interval"><option value="week:1">Weekly</option><option value="month:1">Monthly</option><option value="month:2">Every 2 months</option><option value="month:3">Quarterly</option><option value="month:6">Every 6 months</option><option value="year:1">Yearly</option><option value="year:2">Every 2 years</option></select><input name="trial_days" type="number" min="0" placeholder="Trial days"/><input name="description" placeholder="Short description"/><button className="button primary" disabled={!products.length}>Create plan</button></form>{!products.length&&<p className="help-text">Create a product first to attach pricing plans to it.</p>}</div>
    <div className="plan-grid">{plans.map((plan: any) => <article className="pricing-card" key={plan.id}><div className="plan-card-head"><span className="eyebrow">{plan.recommended ? "RECOMMENDED" : "SUBSCRIPTION PLAN"}</span><span className={`status ${plan.enabled ? "active" : "paused"}`}>{plan.enabled ? "Enabled" : "Disabled"}</span></div><h2>{plan.name}</h2><p>{plan.description || plan.products?.name || "Subscription plan"}</p><strong className="plan-price">{money(plan.amount_minor)}<small> / {periodLabel(plan.period_unit,plan.period_count)}</small></strong><div className="plan-meta">{plan.products?.name} · {plan.trial_days ? `${plan.trial_days} day trial` : "No trial"}</div></article>)}</div>
  </section>;
}
