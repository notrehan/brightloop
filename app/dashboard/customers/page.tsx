import Link from "next/link";
import { Plus } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace";
import { createCustomer } from "../actions";
import { date } from "@/lib/format";
import CustomerList from "./CustomerList";
import styles from "./customers.module.css";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
  user_id: string | null;
};

export default async function Customers({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const { supabase, businessId } = await requireWorkspace();
  const params = await searchParams;
  const [{ data: customerData, error: customerError }, { data: subscriptionData, error: subscriptionError }] = await Promise.all([
    supabase.from("customers").select("id,name,email,phone,company,created_at,user_id").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("customer_id").eq("business_id", businessId),
  ]);
  const customers = (customerData ?? []) as CustomerRow[];
  const subscriptionCounts = new Map<string, number>();
  for (const subscription of subscriptionData ?? []) {
    subscriptionCounts.set(subscription.customer_id, (subscriptionCounts.get(subscription.customer_id) ?? 0) + 1);
  }
  const rows = customers.map((customer) => ({
    ...customer,
    addedDate: date(customer.created_at),
    subscriptionCount: subscriptionError ? null : subscriptionCounts.get(customer.id) ?? 0,
  }));
  const hasCustomerError = Boolean(customerError);
  const customerCount = customers.length;

  return (
    <section className={`page ${styles.customersPage}`}>
      <div className={`page-heading ${styles.heading}`}>
        <div>
          <p className="eyebrow">CUSTOMER DIRECTORY</p>
          <h1>Customers</h1>
          <p>Keep customer records and portal accounts organized.</p>
        </div>
        <Link className="button primary" href="#add-customer"><Plus size={16} aria-hidden="true" /> Add Customer</Link>
      </div>

      {params.success && <div className="alert success" role="status">{params.success}</div>}
      {params.error && <div className="alert error" role="alert">{params.error}</div>}
      {customerError && <div className="alert error" role="alert">Customers could not be loaded: {customerError.message}</div>}
      {subscriptionError && <div className="alert error" role="alert">Subscription counts could not be loaded: {subscriptionError.message}</div>}

      <section className={`panel ${styles.createPanel}`} id="add-customer" aria-labelledby="add-customer-title">
        <div className={styles.createHeading}>
          <div>
            <h2 id="add-customer-title">Add a customer</h2>
            <p>Create a customer record for your workspace.</p>
          </div>
          <span className={styles.requiredNote}>Name and email are required</span>
        </div>
        <form action={createCustomer} className={styles.createForm}>
          <label>
            Customer name <span aria-hidden="true">*</span>
            <input name="name" placeholder="e.g. Alex Morgan" autoComplete="name" required />
          </label>
          <label>
            Email address <span aria-hidden="true">*</span>
            <input name="email" type="email" placeholder="alex@company.com" autoComplete="email" required />
          </label>
          <label>
            Phone <span className={styles.optional}>(optional)</span>
            <input name="phone" type="tel" placeholder="Phone number" autoComplete="tel" />
          </label>
          <label>
            Company <span className={styles.optional}>(optional)</span>
            <input name="company" placeholder="Company name" autoComplete="organization" />
          </label>
          <button className="button primary" type="submit">Add customer</button>
        </form>
      </section>

      <section className={`panel ${styles.directoryPanel}`} aria-labelledby="customer-list-title">
        <div className={styles.directoryHeader}>
          <div>
            <h2 id="customer-list-title">All customers</h2>
            <p>{hasCustomerError ? "Customer records are unavailable." : `${customerCount} ${customerCount === 1 ? "customer" : "customers"} in this workspace`}</p>
          </div>
        </div>
        {hasCustomerError ? (
          <div className={styles.stateMessage} role="status">Refresh the page to try loading customer records again.</div>
        ) : (
          <CustomerList customers={rows} />
        )}
      </section>
    </section>
  );
}
