"use server";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

const msg = (path: string, type: string, value: string) => redirect(`${path}?${type}=${encodeURIComponent(value)}`);
export async function signOut() { const s = await createClient(); await s.auth.signOut(); redirect("/login"); }
export async function createProduct(f: FormData) {
  const { supabase, businessId } = await requireWorkspace();
  const name = String(f.get("name") || "").trim();
  const price = Number(f.get("price")), cost = Number(f.get("cost") || 0), trialDays = Math.max(0, Math.min(365, Math.trunc(Number(f.get("trial_days")) || 0)));
  const interval = String(f.get("interval") || "monthly"), recurring = f.get("recurring") === "on", productType = String(f.get("product_type") || "service");
  const imageValue = f.get("image");
  const image = imageValue instanceof File && imageValue.size ? imageValue : null;
  if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0 || !["monthly", "quarterly", "yearly"].includes(interval) || !["service", "digital", "goods"].includes(productType)) msg("/dashboard/products/new", "error", "Review the required product details and try again");
  if (image && (!(["image/png", "image/jpeg", "image/webp"].includes(image.type)) || image.size > 5 * 1024 * 1024)) msg("/dashboard/products/new", "error", "Choose a PNG, JPG, or WebP image smaller than 5 MB");
  const { data: product, error } = await supabase.from("products").insert({
    business_id: businessId, name, description: String(f.get("description") || "").trim(),
    product_type: productType, category: String(f.get("category") || "").trim() || null,
    internal_reference: String(f.get("internal_reference") || "").trim() || null,
    barcode: String(f.get("barcode") || "").trim() || null,
    can_be_sold: f.get("can_be_sold") === "on", can_be_purchased: f.get("can_be_purchased") === "on",
    recurring, list_price_minor: Math.round(price * 100), cost_minor: Math.round(cost * 100), enabled: true,
  }).select("id").single();
  if (error || !product) msg("/dashboard/products/new", "error", error?.message || "Could not create product");
  let imagePath: string | null = null;
  if (image) {
    const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/png" ? "png" : "webp";
    imagePath = `${businessId}/${product!.id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("brightloop-products").upload(imagePath, image, { contentType: image.type, cacheControl: "3600", upsert: false });
    if (uploadError) { await supabase.from("products").delete().eq("id", product!.id).eq("business_id", businessId); msg("/dashboard/products/new", "error", `Image upload failed: ${uploadError.message}. Run supabase/products_section.sql first.`); }
    const imageUrl = supabase.storage.from("brightloop-products").getPublicUrl(imagePath).data.publicUrl;
    const { error: imageUpdateError } = await supabase.from("products").update({ image_url: imageUrl }).eq("id", product!.id).eq("business_id", businessId);
    if (imageUpdateError) { await supabase.storage.from("brightloop-products").remove([imagePath]); await supabase.from("products").delete().eq("id", product!.id).eq("business_id", businessId); msg("/dashboard/products/new", "error", imageUpdateError.message); }
  }
  if (recurring) {
    const { error: planError } = await supabase.from("pricing_plans").insert({ business_id: businessId, product_id: product!.id, name, description: String(f.get("description") || "").trim(), amount_minor: Math.round(price * 100), interval, trial_days: trialDays, enabled: true });
    if (planError) {
      if (imagePath) await supabase.storage.from("brightloop-products").remove([imagePath]);
      await supabase.from("products").delete().eq("id", product!.id).eq("business_id", businessId);
      msg("/dashboard/products/new", "error", `Product was not saved: ${planError.message}`);
    }
  }
  msg("/dashboard/products", "success", recurring ? "Recurring product and subscription plan created" : "Product created");
}
export async function updateProduct(f: FormData) {
  const { supabase, businessId } = await requireWorkspace();
  const id = String(f.get("id") || "");
  const name = String(f.get("name") || "").trim();
  if (!id || !name) msg("/dashboard/products", "error", "Product name is required");
  const { error } = await supabase.from("products").update({ name, description: String(f.get("description") || "").trim(), product_type: String(f.get("product_type") || "service"), category: String(f.get("category") || "").trim() || null, internal_reference: String(f.get("internal_reference") || "").trim() || null, can_be_sold: f.get("can_be_sold") === "on", can_be_purchased: f.get("can_be_purchased") === "on" }).eq("id", id).eq("business_id", businessId);
  if (error) msg("/dashboard/products", "error", error.message);
  msg("/dashboard/products", "success", "Product details updated");
}
export async function toggleProduct(f: FormData) {
  const { supabase, businessId } = await requireWorkspace();
  const id = String(f.get("id") || "");
  const enabled = String(f.get("enabled")) === "true";
  const { error } = await supabase.from("products").update({ enabled: !enabled }).eq("id", id).eq("business_id", businessId);
  if (error) msg("/dashboard/products", "error", error.message);
  msg("/dashboard/products", "success", enabled ? "Product archived" : "Product restored");
}
export async function createCustomer(f: FormData) { const { supabase, businessId } = await requireWorkspace(); const name=String(f.get("name")||"").trim(), email=String(f.get("email")||"").trim().toLowerCase(); if(!name||!email) msg("/dashboard/customers","error","Name and email are required"); const {error}=await supabase.from("customers").insert({business_id:businessId,name,email,company:String(f.get("company")||"").trim()||null,phone:String(f.get("phone")||"").trim()||null}); if(error) msg("/dashboard/customers","error",error.message); msg("/dashboard/customers","success","Customer added"); }
export async function createPlan(f: FormData) {
  const { supabase, businessId } = await requireWorkspace();
  const name = String(f.get("name") || "").trim(), amount = Number(f.get("amount")), interval = String(f.get("interval") || "monthly"), productId = String(f.get("product_id") || "");
  if (!name || !Number.isFinite(amount) || amount < 0 || !["monthly", "quarterly", "yearly"].includes(interval) || !productId) msg("/dashboard/plans", "error", "Choose a product and enter a valid plan");
  const { data: product } = await supabase.from("products").select("id").eq("id", productId).eq("business_id", businessId).single();
  if (!product) msg("/dashboard/plans", "error", "That product is not in this workspace");
  const { error } = await supabase.from("pricing_plans").insert({ business_id: businessId, product_id: product!.id, name, description: String(f.get("description") || "").trim(), amount_minor: Math.round(amount * 100), interval, trial_days: Math.max(0, Math.trunc(Number(f.get("trial_days")) || 0)), enabled: true, recommended: f.get("recommended") === "on" });
  if (error) msg("/dashboard/plans", "error", error.message);
  msg("/dashboard/plans", "success", "Pricing plan created");
}
export async function createSubscription(f: FormData) { const {supabase,businessId}=await requireWorkspace(); const customer=String(f.get("customer_id")||""), planId=String(f.get("plan_id")||""); const {data:plan,error}=await supabase.from("pricing_plans").select("*").eq("id",planId).eq("business_id",businessId).eq("enabled",true).single(); if(error||!plan) msg("/dashboard/subscriptions","error","Select a valid plan"); const now=new Date(), end=new Date(now); if(plan!.interval==="yearly") end.setFullYear(end.getFullYear()+1); else end.setMonth(end.getMonth()+(plan!.interval==="quarterly"?3:1)); const {error:e}=await supabase.from("subscriptions").insert({business_id:businessId,customer_id:customer,product_id:plan!.product_id,plan_id:plan!.id,status:plan!.trial_days?"trialing":"active",amount_minor:plan!.amount_minor,interval:plan!.interval,started_at:now.toISOString(),period_start:now.toISOString(),period_end:end.toISOString(),next_billing_at:end.toISOString()}); if(e) msg("/dashboard/subscriptions","error",e.message); msg("/dashboard/subscriptions","success","Subscription created"); }
export async function setSubscriptionStatus(f: FormData) { const {supabase,businessId}=await requireWorkspace(); const id=String(f.get("id")||""), status=String(f.get("status")||""); if(!["active","paused","cancelled"].includes(status)) msg("/dashboard/subscriptions","error","Invalid status"); const {error}=await supabase.from("subscriptions").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",businessId); if(error) msg("/dashboard/subscriptions","error",error.message); msg("/dashboard/subscriptions","success","Subscription updated"); }
export async function runBilling() { const {supabase}=await requireWorkspace(); const {data,error}=await supabase.rpc("run_billing_cycle",{p_force:true}); if(error) msg("/dashboard/invoices","error",error.message); msg("/dashboard/invoices","success",`${data||0} invoice(s) generated. Existing periods are not duplicated.`); }
export async function simulatePayment(f: FormData) { const {supabase}=await requireWorkspace(); const id=String(f.get("invoice_id")||""), success=String(f.get("success"))==="true"; const {error}=await supabase.rpc("simulate_invoice_payment",{p_invoice_id:id,p_success:success}); if(error) msg("/dashboard/invoices","error",error.message); msg("/dashboard/invoices","success",success?"Simulated payment succeeded":"Simulated payment failed; subscription marked past due"); }
