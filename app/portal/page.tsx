import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money, date, title } from "@/lib/format";
import { signOutCustomer, startSubscription } from "./actions";
import { SubscriptionActions } from "./SubscriptionActions";
import styles from "./portal.module.css";

type PortalSearchParams = Promise<{ success?: string; error?: string }>;

export default async function Portal({
  searchParams,
}: {
  searchParams: PortalSearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fportal");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("business_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login?error=Your%20Brightloop%20account%20could%20not%20be%20verified.");
  }
  if (profile.role !== "customer") redirect("/dashboard");

  const params = await searchParams;
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, email, business_id")
    .eq("user_id", user.id)
    .eq("business_id", profile.business_id)
    .maybeSingle();

  const [plansResult, subscriptionsResult, invoicesResult, paymentsResult] = customer
    ? await Promise.all([
        supabase
          .from("pricing_plans")
          .select("id, name, description, amount_minor, interval, trial_days, products(name)")
          .eq("business_id", profile.business_id)
          .eq("enabled", true)
          .order("amount_minor"),
        supabase
          .from("subscriptions")
          .select(
            "id, status, amount_minor, interval, started_at, period_start, period_end, next_billing_at, products(name), pricing_plans(name)",
          )
          .eq("customer_id", customer.id)
          .eq("business_id", profile.business_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, invoice_number, status, total_minor, created_at, due_at")
          .eq("customer_id", customer.id)
          .eq("business_id", profile.business_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select(
            "id, invoice_id, status, amount_minor, created_at, note, method, is_simulated, invoices(invoice_number)",
          )
          .eq("customer_id", customer.id)
          .eq("business_id", profile.business_id)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const plans = plansResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const displayName = customer?.name || profile.full_name || user.email || "Customer";

  return (
    <main className={styles.portalPage}>
      <header className={styles.portalHeader}>
        <Link className={styles.brand} href="/portal" aria-label="Brightloop customer portal home">
          <span className={styles.brandMark}>b</span>
          <span>brightloop</span>
        </Link>
        <div className={styles.headerAccount}>
          <span className={styles.accountName}>{displayName}</span>
          <form action={signOutCustomer}>
            <button className={styles.secondaryButton} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>CUSTOMER PORTAL</p>
            <h1>Your account</h1>
            <p>View your subscriptions, invoices, and payment activity.</p>
          </div>
        </section>

        {params.success && <div className={styles.successAlert} role="status">{params.success}</div>}
        {params.error && <div className={styles.errorAlert} role="alert">{params.error}</div>}
        {customerError && (
          <div className={styles.errorAlert} role="alert">
            We could not load your customer profile. Please refresh or contact the business.
          </div>
        )}

        <section className={styles.panel} aria-labelledby="subscriptions-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="subscriptions-heading">Your subscriptions</h2>
              <p>Review your product, plan, billing period, and renewal date.</p>
            </div>
            <span className={styles.countPill}>{subscriptions.length}</span>
          </div>
          {subscriptionsResult.error ? (
            <div className={styles.inlineError} role="alert">Subscriptions could not be loaded right now.</div>
          ) : subscriptions.length ? (
            <div className={styles.subscriptionList}>
              {subscriptions.map((subscription: any) => {
                const canPause = ["active", "trialing", "past_due"].includes(subscription.status);
                const canResume = subscription.status === "paused";
                const canCancel = ["active", "trialing", "past_due", "paused"].includes(
                  subscription.status,
                );
                return (
                  <article className={styles.subscriptionCard} key={subscription.id}>
                    <div className={styles.subscriptionMain}>
                      <span className={`${styles.status} ${styles[`status_${subscription.status}`] || ""}`}>
                        {title(subscription.status)}
                      </span>
                      <h3>{subscription.products?.name || "Subscription"}</h3>
                      <p className={styles.planName}>{subscription.pricing_plans?.name || "Plan"}</p>
                      <strong className={styles.subscriptionPrice}>
                        {money(subscription.amount_minor)} <span>/ {subscription.interval}</span>
                      </strong>
                      <dl className={styles.subscriptionFacts}>
                        <div>
                          <dt>Started</dt>
                          <dd>{date(subscription.started_at)}</dd>
                        </div>
                        <div>
                          <dt>Current period</dt>
                          <dd>{date(subscription.period_start)} – {date(subscription.period_end)}</dd>
                        </div>
                        <div>
                          <dt>Next renewal</dt>
                          <dd>
                            {["cancelled", "expired"].includes(subscription.status)
                              ? "—"
                              : date(subscription.next_billing_at)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    {(canPause || canResume || canCancel) && (
                      <SubscriptionActions
                        subscriptionId={subscription.id}
                        status={subscription.status}
                        canPause={canPause}
                        canResume={canResume}
                        canCancel={canCancel}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              You do not have any subscriptions yet. Choose a plan below to get started.
            </div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="invoices-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="invoices-heading">Invoices</h2>
              <p>Open an invoice to review the full details or print a copy.</p>
            </div>
            <span className={styles.countPill}>{invoices.length}</span>
          </div>
          {invoicesResult.error ? (
            <div className={styles.inlineError} role="alert">Invoices could not be loaded right now.</div>
          ) : invoices.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th className={styles.numericCell}>Total</th>
                    <th><span className={styles.visuallyHidden}>Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id}>
                      <td><strong>{invoice.invoice_number}</strong></td>
                      <td>
                        <span className={`${styles.status} ${styles[`status_${invoice.status}`] || ""}`}>
                          {title(invoice.status)}
                        </span>
                      </td>
                      <td>{date(invoice.created_at)}</td>
                      <td>{date(invoice.due_at)}</td>
                      <td className={styles.numericCell}>{money(invoice.total_minor)}</td>
                      <td>
                        <Link className={styles.textLink} href={`/portal/invoices/${invoice.id}`}>
                          View invoice <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>Invoices created for your subscriptions will appear here.</div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="payments-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="payments-heading">Payment history</h2>
              <p>Successful and failed payment attempts associated with your account.</p>
            </div>
            <span className={styles.countPill}>{payments.length}</span>
          </div>
          {paymentsResult.error ? (
            <div className={styles.inlineError} role="alert">Payment history could not be loaded right now.</div>
          ) : payments.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th className={styles.numericCell}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td>
                        <Link className={styles.textLink} href={`/portal/invoices/${payment.invoice_id}`}>
                          {payment.invoices?.invoice_number || "View invoice"}
                        </Link>
                      </td>
                      <td>
                        <span className={`${styles.status} ${styles[`status_${payment.status}`] || ""}`}>
                          {title(payment.status)}
                        </span>
                      </td>
                      <td>{date(payment.created_at)}</td>
                      <td>{payment.is_simulated ? "Simulated" : title(payment.method || "Payment")}</td>
                      <td className={styles.numericCell}>{money(payment.amount_minor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>Your payment attempts will appear here.</div>
          )}
        </section>

        <section className={styles.planSection} aria-labelledby="plans-heading">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="plans-heading">Available plans</h2>
              <p>Choose an available plan to start a subscription.</p>
            </div>
          </div>
          {plansResult.error ? (
            <div className={styles.errorAlert} role="alert">Available plans could not be loaded right now.</div>
          ) : plans.length ? (
            <div className={styles.planGrid}>
              {plans.map((plan: any) => (
                <article className={styles.planCard} key={plan.id}>
                  <p className={styles.eyebrow}>BRIGHTLOOP PLAN</p>
                  <h3>{plan.products?.name || plan.name}</h3>
                  <p className={styles.planDescription}>{plan.description || "Subscription plan"}</p>
                  <strong className={styles.planPrice}>
                    {money(plan.amount_minor)} <span>/ {plan.interval}</span>
                  </strong>
                  {plan.trial_days > 0 && <p className={styles.trialNote}>{plan.trial_days}-day trial included</p>}
                  <form action={startSubscription}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <button className={styles.primaryButton} type="submit">Subscribe</button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>There are no plans available to purchase right now.</div>
          )}
        </section>

        <p className={styles.disclaimer}>
          Demo environment: payments shown as simulated do not collect real money or payment details.
        </p>
      </div>
    </main>
  );
}
