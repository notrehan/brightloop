import Link from "next/link";
import { ArrowLeft, BadgeCheck, Package, ReceiptText, ShoppingBag } from "lucide-react";
import { createProduct } from "../../actions";
import { ProductImagePicker } from "@/components/ProductImagePicker";
import { ProductTabs } from "@/components/ProductTabs";
import { PricingRows } from "@/components/PricingRows";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="page product-new-page">
    <div className="product-breadcrumb"><Link href="/dashboard/products">Products</Link><i>/</i><strong>New Product</strong></div>
    <div className="page-heading product-new-header"><div><h1>New Product</h1></div><Link href="/dashboard/products" className="button secondary"><ArrowLeft size={15}/> Back to products</Link></div>
    {error&&<div className="alert error">{error}</div>}
    <form action={createProduct} className="new-product-form">
      <div className="product-flags">
        <label><input type="checkbox" name="can_be_sold" defaultChecked/><span>Can be Sold</span></label>
        <label><input type="checkbox" name="can_be_purchased"/><span>Can be Purchased</span></label>
        <label className="recurring-flag"><input type="checkbox" name="recurring" defaultChecked/><span>Recurring</span><small>?</small></label>
      </div>
      <div className="product-workbench">
        <div className="new-product-main">
          <ProductTabs tabs={["General Information","Sales","Time-based Pricing","Accounting"]}>
            <section className="panel form-section"><div className="form-section-title"><span className="section-icon"><Package size={17}/></span><div><h2>General Information</h2></div></div>
              <div className="product-form-grid"><label className="field-wide">Product name <span className="required-mark">*</span><input name="name" placeholder="e.g. Premium Support" required autoFocus/></label><label>Product type<select name="product_type" defaultValue="service"><option value="service">Service</option><option value="digital">Digital product</option><option value="goods">Physical goods</option></select></label><label>Product category<input name="category" placeholder="e.g. Software, Consulting"/></label><label className="field-wide">Description<textarea name="description" rows={4} placeholder="Describe what is included, who it is for, and any important terms."/></label></div>
            </section>
            <section className="panel form-section"><div className="form-section-title"><span className="section-icon"><ShoppingBag size={17}/></span><div><h2>Sales</h2></div></div>
              <div className="product-form-grid"><label>Sales price (INR)<div className="currency-input"><span>₹</span><input name="price" type="number" min="0" step="0.01" placeholder="0.00"/></div></label><label>Trial duration (days)<input name="trial_days" type="number" min="0" max="365" defaultValue="0"/></label><label className="field-wide">Internal reference<input name="internal_reference" placeholder="SKU or internal code"/></label></div>
              <div className="sales-policy-note"><ReceiptText size={16}/><span><strong>Invoicing policy</strong><small>Prepaid / fixed price</small></span></div>
            </section>
            <section className="panel form-section"><div className="form-section-title"><span className="section-icon">₹</span><div><h2>Time-based Pricing</h2></div></div><PricingRows/></section>
            <section className="panel form-section"><div className="form-section-title"><span className="section-icon"><BadgeCheck size={17}/></span><div><h2>Accounting</h2></div></div>
              <div className="product-form-grid"><label>Cost per unit (INR)<div className="currency-input"><span>₹</span><input name="cost" type="number" min="0" step="0.01" placeholder="0.00" defaultValue="0"/></div></label><label>Barcode<input name="barcode" placeholder="Barcode"/></label><div className="accounting-currency"><span>Company currency</span><strong>INR · Indian Rupee</strong></div></div>
            </section>
          </ProductTabs>
        </div>
        <aside className="new-product-aside"><section className="panel image-panel"><div className="form-section-title"><div><h2>Product Image</h2></div></div><ProductImagePicker/></section></aside>
      </div>
      <div className="product-savebar"><Link href="/dashboard/products" className="button secondary">Cancel</Link><button className="button primary">Save Product</button></div>
    </form>
  </section>;
}
