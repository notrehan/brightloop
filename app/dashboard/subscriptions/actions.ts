"use server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";

const fail=(message:string)=>redirect(`/dashboard/subscriptions/new?error=${encodeURIComponent(message)}`);
export async function createSubscriptionOrder(form:FormData){
  const {supabase}=await requireWorkspace();
  const name=String(form.get("customer_name")||"").trim();
  const email=String(form.get("customer_email")||"").trim().toLowerCase();
  const phone=String(form.get("customer_phone")||"").trim();
  const address=String(form.get("customer_address")||"").trim();
  const startedAt=String(form.get("started_at")||"");
  const expiresAt=String(form.get("expires_at")||"")||null;
  const paymentTerms=String(form.get("payment_terms")||"Due immediately");
  const terms=String(form.get("terms")||"").trim();
  let lines:unknown;
  try{lines=JSON.parse(String(form.get("lines_json")||"[]"));}catch{fail("Order lines could not be read. Please review the products.");}
  if(!name)fail("Customer name is required.");
  if(!email&&!phone)fail("Enter a customer email or phone number.");
  if(!startedAt)fail("Choose a subscription start date.");
  if(!Array.isArray(lines)||!lines.some((line:any)=>line.row_type==="product"&&line.plan_id))fail("Add at least one product with a valid price.");
  const {data:subscriptionId,error}=await supabase.rpc("create_subscription_order",{
    p_customer_name:name,p_customer_email:email||null,p_customer_phone:phone||null,p_customer_address:address||null,
    p_started_at:startedAt,p_expires_at:expiresAt,p_payment_terms:paymentTerms,p_terms:terms,p_lines:lines,
  });
  if(error)fail(error.message);
  redirect(`/dashboard/subscriptions?success=${encodeURIComponent("Subscription created")}&created=${encodeURIComponent(subscriptionId||"")}`);
}
