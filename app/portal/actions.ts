"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function portalMessage(path: string, key: "success" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

async function requireCustomerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login?error=Your%20Brightloop%20account%20could%20not%20be%20verified.");
  }
  if (profile.role !== "customer") redirect("/dashboard");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, business_id")
    .eq("user_id", user.id)
    .eq("business_id", profile.business_id)
    .maybeSingle();

  if (customerError || !customer) {
    redirect("/portal?error=Your%20customer%20record%20could%20not%20be%20found.");
  }

  return { supabase, user, profile, customer };
}

export async function signOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function startSubscription(formData: FormData) {
  const { supabase, customer } = await requireCustomerContext();
  const planId = String(formData.get("plan_id") || "");

  if (!planId) portalMessage("/portal", "error", "Choose a valid plan.");

  const { data: plan, error: planError } = await supabase
    .from("pricing_plans")
    .select("id")
    .eq("id", planId)
    .eq("business_id", customer.business_id)
    .eq("enabled", true)
    .maybeSingle();

  if (planError || !plan) portalMessage("/portal", "error", "That plan is not available.");

  const { error } = await supabase.rpc("customer_start_subscription", {
    p_plan_id: plan.id,
  });

  if (error) portalMessage("/portal", "error", error.message);
  portalMessage("/portal", "success", "Subscription started. Your invoice is ready.");
}

export async function manageSubscription(formData: FormData) {
  const { supabase, customer } = await requireCustomerContext();
  const subscriptionId = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");

  if (!subscriptionId || !["pause", "resume", "cancel"].includes(action)) {
    portalMessage("/portal", "error", "Choose a valid subscription action.");
  }

  const { data: ownedSubscription, error: lookupError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("id", subscriptionId)
    .eq("customer_id", customer.id)
    .eq("business_id", customer.business_id)
    .maybeSingle();

  if (lookupError || !ownedSubscription) {
    portalMessage("/portal", "error", "That subscription could not be found.");
  }

  const { error } = await supabase.rpc("customer_manage_subscription", {
    p_subscription_id: ownedSubscription.id,
    p_action: action,
  });

  if (error) portalMessage("/portal", "error", error.message);
  const successMessage =
    action === "cancel"
      ? "Subscription cancelled."
      : action === "pause"
        ? "Subscription paused."
        : "Subscription resumed.";
  portalMessage("/portal", "success", successMessage);
}

export async function payInvoice(formData: FormData) {
  const { supabase, customer } = await requireCustomerContext();
  const invoiceId = String(formData.get("invoice_id") || "");

  if (!invoiceId) portalMessage("/portal", "error", "Invoice not found.");
  const invoicePath = `/portal/invoices/${encodeURIComponent(invoiceId)}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status, total_minor")
    .eq("id", invoiceId)
    .eq("customer_id", customer.id)
    .eq("business_id", customer.business_id)
    .maybeSingle();

  if (invoiceError || !invoice) portalMessage("/portal", "error", "Invoice not found.");
  if (!["open", "overdue"].includes(invoice.status) || invoice.total_minor <= 0) {
    portalMessage(invoicePath, "error", "This invoice is not eligible for payment.");
  }

  const { error } = await supabase.rpc("customer_simulate_invoice_payment", {
    p_invoice_id: invoice.id,
  });

  if (error) portalMessage(invoicePath, "error", error.message);
  portalMessage(
    invoicePath,
    "success",
    "Simulated payment completed. No real payment was collected.",
  );
}
