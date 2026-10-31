import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace";
import { money, title } from "@/lib/format";
import { toggleProduct, updateProduct } from "../actions";

export default async function Products({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; q?: string }> }) {
  const { supabase, businessId } = await requireWorkspace();
  const params = await searchParams;
  const { data, error } = await supabase.from("products").select("id,name,description,product_type,internal_reference,category,barcode,can_be_sold,can_be_purchased,recurring,list_price_minor,cost_minor,image_url,enabled,pricing_plans(id,name,amount_minor,interval,enabled)").eq("business_id", businessId).order("created_at", { ascending: false });
  let products = data ?? [];
  if (params.q) { const q = params.q.toLowerCase(); products = products.filter((x: any) => `${x.name} ${x.internal_reference || ""} ${x.category || ""}`.toLowerCase().includes(q)); }
  const schemaError = error?.message.includes("column") ? "Run supabase/products_section.sql in Supabase SQL Editor, then refresh this page." : error?.message;
  return <section className="page">
    <div className="product-breadcrumb"><span>Catalog</span><i>/</i><strong>Products</strong></div>
    <div className="page-heading product-list-header"><div><p className="eyebrow">CATALOG MANAGEMENT</p><h1>Products</h1><p>Manage the goods and services your business sells.</p></div><Link className="button primary" href="/dashboard/products/new"><Plus size={16}/> New Product</Link></div>
    {(params.success || params.error || schemaError) && <div className={`alert ${params.error || schemaError ? "error" : "success"}`}>{params.error || schemaError || params.success}</div>}
    <div className="product-toolbar"><div className="catalog-count"><strong>{products.length}</strong> products</div><form className="product-search" action="/dashboard/products"><Search size={15}/><input name="q" defaultValue={params.q || ""} placeholder="Search products or reference"/><button className="small-button">Search</button></form></div>
    {products.length ? <div className="product-grid">{products.map((product: any) => {
      const plans = (product.pricing_plans ?? []).filter((plan: any) => plan.enabled);
      const lowestPlan = [...plans].sort((a: any, b: any) => a.amount_minor - b.amount_minor)[0];
      return <article className={`product-card ${!product.enabled ? "product-archived" : ""}`} key={product.id}>
        <div className="product-card-top">{product.image_url ? <img className="product-thumbnail" src={product.image_url} alt={`${product.name} product`} /> : <div className="product-icon"><Package size={20}/></div>}<span className={`status ${product.enabled ? "active" : "paused"}`}>{product.enabled ? "Active" : "Archived"}</span></div>
        <div className="product-card-content"><span className="eyebrow">{title(product.product_type || "service")}{product.category ? ` · ${product.category}` : ""}</span><h3>{product.name}</h3><p>{product.description || "No description provided."}</p></div>
        <div className="product-card-facts"><span>{product.recurring ? "Recurring" : "One-time"}{product.internal_reference ? ` · ${product.internal_reference}` : ""}</span><strong>{lowestPlan ? `${money(lowestPlan.amount_minor)} / ${lowestPlan.interval}` : money(product.list_price_minor || 0)}</strong></div>
        <div className="product-card-actions"><details><summary>Edit details</summary><form action={updateProduct} className="product-edit-form"><input type="hidden" name="id" value={product.id}/><label>Product name<input name="name" defaultValue={product.name} required/></label><label>Category<input name="category" defaultValue={product.category || ""}/></label><label>Internal reference<input name="internal_reference" defaultValue={product.internal_reference || ""}/></label><label>Description<textarea name="description" defaultValue={product.description || ""} rows={3}/></label><label className="check-option"><input type="checkbox" name="can_be_sold" defaultChecked={product.can_be_sold}/> Can be sold</label><label className="check-option"><input type="checkbox" name="can_be_purchased" defaultChecked={product.can_be_purchased}/> Can be purchased</label><button className="button secondary">Save changes</button></form></details><form action={toggleProduct}><input type="hidden" name="id" value={product.id}/><input type="hidden" name="enabled" value={String(product.enabled)}/><button className="small-button">{product.enabled ? "Archive" : "Restore"}</button></form></div>
      </article>;
    })}</div> : <div className="panel empty-state">{params.q ? "No products match that search." : "No products yet. Create your first product to begin building your catalog."}<div><Link className="button primary" href="/dashboard/products/new">New Product</Link></div></div>}
  </section>;
}
