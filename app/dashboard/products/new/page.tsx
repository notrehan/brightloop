import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { createProduct } from "../../actions";
import { ProductImagePicker } from "@/components/ProductImagePicker";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="page product-new-page">
    <div className="product-breadcrumb"><Link href="/dashboard/products">Products</Link><i>/</i><strong>New Product</strong></div>
    <div className="page-heading product-new-header"><div><p className="eyebrow">PRODUCT CATALOG</p><h1>New Product</h1><p>Add a product, configure its commercial details, and set up recurring billing.</p></div><Link href="/dashboard/products" className="button secondary"><ArrowLeft size={15}/> Back to products</Link></div>
    {error&&<div className="alert error">{error}</div>}
    <form action={createProduct} className="new-product-form">
      <div className="new-product-main">
        <section className="panel form-section"><div className="form-section-title"><span className="section-icon"><Package size={17}/></span><div><h2>Product information</h2><p>Core details shown to your team and customers.</p></div></div>
          <div className="product-form-grid"><label className="field-wide">Product name <span className="required-mark">*</span><input name="name" placeholder="e.g. Premium Support" required autoFocus/></label><label>Product type<select name="product_type" defaultValue="service"><option value="service">Service</option><option value="digital">Digital product</option><option value="goods">Physical goods</option></select></label><label>Product category<input name="category" placeholder="e.g. Software, Consulting"/></label><label>Internal reference<input name="internal_reference" placeholder="SKU or internal code"/></label><label>Barcode<input name="barcode" placeholder="Optional barcode"/></label><label className="field-wide">Customer-facing description<textarea name="description" rows={4} placeholder="Describe what is included, who it is for, and any important terms."/></label></div>
        </section>
        <section className="panel form-section"><div className="form-section-title"><span className="section-icon">₹</span><div><h2>Sales & pricing</h2><p>Set the default price and whether this product renews.</p></div></div>
          <div className="product-form-grid"><label>Sales price (INR)<span className="input-help">Customer price per billing period</span><div className="currency-input"><span>₹</span><input name="price" type="number" min="0" step="0.01" placeholder="0.00" required/></div></label><label>Cost (INR)<span className="input-help">Internal cost per unit</span><div className="currency-input"><span>₹</span><input name="cost" type="number" min="0" step="0.01" placeholder="0.00" defaultValue="0"/></div></label><label>Billing period<select name="interval" defaultValue="monthly"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select><span className="input-help">Used when recurring is enabled</span></label><label>Trial duration (days)<input name="trial_days" type="number" min="0" max="365" defaultValue="0"/><span className="input-help">0 means no free trial</span></label>
          </div>
          <div className="recurring-callout"><div><strong>Recurring subscription</strong><p>Automatically create a billing plan for this product.</p></div><label className="switch-control"><input type="checkbox" name="recurring" defaultChecked/><span/></label></div>
        </section>
        <section className="panel form-section"><div className="form-section-title"><span className="section-icon">✓</span><div><h2>Sales & purchasing options</h2><p>Control how this item can be used in your business.</p></div></div><div className="option-list"><label className="option-row"><span><strong>Can be sold</strong><small>Show this product to customers and use it on subscriptions.</small></span><input type="checkbox" name="can_be_sold" defaultChecked/></label><label className="option-row"><span><strong>Can be purchased</strong><small>Track this as an item that your business buys.</small></span><input type="checkbox" name="can_be_purchased"/></label></div></section>
      </div>
      <aside className="new-product-aside"><section className="panel image-panel"><div className="form-section-title"><div><h2>Product image</h2><p>Help your team recognize this item.</p></div></div><ProductImagePicker/></section><section className="panel product-tip"><p className="eyebrow">AFTER SAVING</p><strong>Manage all price options</strong><p>You can add other billing periods and price tiers in Plans & Pricing.</p><Link href="/dashboard/plans">Go to plans & pricing →</Link></section></aside>
      <div className="product-savebar"><Link href="/dashboard/products" className="button secondary">Cancel</Link><button className="button primary">Save Product</button></div>
    </form>
  </section>;
}
