import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { date, money, title } from "@/lib/format";
import { PrintInvoiceButton, SimulatedPayment } from "../../InvoiceActions";
import styles from "../../portal.module.css";

type InvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit_amount_minor: number;
  amount_minor: number;
};

type InvoicePaymentRow = {
  id: string;
  status: string;
  amount_minor: number;
  method: string | null;
  is_simulated: boolean;
  note: string | null;
  created_at: string;
};

const quantity = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);

export default async function InvoiceDetailPage({ params, searchParams }: InvoicePageProps) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/portal/invoices/${invoiceId}`)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) notFound();
  if (profile.role !== "customer") redirect("/dashboard");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, email, company, phone, business_id")
    .eq("user_id", user.id)
    .eq("business_id", profile.business_id)
    .maybeSingle();

  if (customerError || !customer) notFound();

  // The ID is never sufficient to read an invoice. Scope it to this authenticated
  // customer's row and business as well as relying on Supabase RLS.
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, business_id, customer_id, subscription_id, invoice_number, status, period_start, period_end, subtotal_minor, total_minor, due_at, created_at",
    )
    .eq("id", invoiceId)
    .eq("customer_id", customer.id)
    .eq("business_id", customer.business_id)
    .maybeSingle();

  if (invoiceError || !invoice) notFound();

  const [businessResult, itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, currency")
      .eq("id", invoice.business_id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_amount_minor, amount_minor")
      .eq("invoice_id", invoice.id)
      .order("id", { ascending: true }),
    supabase
      .from("payments")
      .select("id, status, amount_minor, method, is_simulated, note, created_at")
      .eq("invoice_id", invoice.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ]);

  const paramsResult = await searchParams;
  const items = (itemsResult.data ?? []) as InvoiceItemRow[];
  const payments = (paymentsResult.data ?? []) as InvoicePaymentRow[];
  const canPay = ["open", "overdue"].includes(invoice.status) && invoice.total_minor > 0;
  const adjustment = Number(invoice.total_minor) - Number(invoice.subtotal_minor);
  const currency = businessResult.data?.currency || "INR";

  return (
    <main className={styles.invoicePage}>
      <header className={`${styles.portalHeader} ${styles.invoiceHeader}`}>
        <Link className={styles.brand} href="/portal" aria-label="Back to Brightloop customer portal">
          <span className={styles.brandMark}>b</span>
          <span>brightloop</span>
        </Link>
        <div className={styles.invoiceHeaderActions}>
          <Link href="/portal" className={styles.secondaryButton}>Back to portal</Link>
          <PrintInvoiceButton />
        </div>
      </header>

      <div className={styles.invoiceContent}>
        {paramsResult.success && <div className={styles.successAlert} role="status">{paramsResult.success}</div>}
        {paramsResult.error && <div className={styles.errorAlert} role="alert">{paramsResult.error}</div>}

        <article className={styles.invoiceDocument}>
          <div className={styles.invoiceTitleRow}>
            <div>
              <p className={styles.eyebrow}>BRIGHTLOOP BILLING</p>
              <h1>Invoice</h1>
              <p className={styles.invoiceNumber}>{invoice.invoice_number}</p>
            </div>
            <span className={`${styles.status} ${styles[`status_${invoice.status}`] || ""}`}>
              {title(invoice.status)}
            </span>
          </div>

          <div className={styles.invoiceParties}>
            <section>
              <p className={styles.invoiceLabel}>Billed by</p>
              <h2>{businessResult.data?.name || "Brightloop"}</h2>
              <p>Business currency: {currency}</p>
              {businessResult.error && <p className={styles.inlineError}>Business information is temporarily unavailable.</p>}
            </section>
            <section>
              <p className={styles.invoiceLabel}>Billed to</p>
              <h2>{customer.name}</h2>
              <p>{customer.email}</p>
              {customer.company && <p>{customer.company}</p>}
              {customer.phone && <p>{customer.phone}</p>}
            </section>
          </div>

          <dl className={styles.invoiceMeta}>
            <div><dt>Invoice date</dt><dd>{date(invoice.created_at)}</dd></div>
            <div><dt>Due date</dt><dd>{date(invoice.due_at)}</dd></div>
            <div>
              <dt>Billing period</dt>
              <dd>
                {invoice.period_start || invoice.period_end
                  ? `${date(invoice.period_start)} – ${date(invoice.period_end)}`
                  : "—"}
              </dd>
            </div>
          </dl>

          <section className={styles.invoiceItemsSection}>
            <h2>Line items</h2>
            {itemsResult.error ? (
              <div className={styles.inlineError} role="alert">Invoice line items could not be loaded. Please try again.</div>
            ) : items.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.invoiceTable}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className={styles.numericCell}>Qty</th>
                      <th className={styles.numericCell}>Unit price</th>
                      <th className={styles.numericCell}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className={styles.numericCell}>{quantity(Number(item.quantity))}</td>
                        <td className={styles.numericCell}>{money(item.unit_amount_minor, currency)}</td>
                        <td className={styles.numericCell}>{money(item.amount_minor, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>No line items are recorded for this invoice.</div>
            )}
          </section>

          <div className={styles.invoiceTotals}>
            <div><span>Subtotal</span><strong>{money(invoice.subtotal_minor, currency)}</strong></div>
            {adjustment !== 0 && (
              <div>
                <span>Unclassified adjustment</span>
                <strong>{adjustment > 0 ? "+" : "−"}{money(Math.abs(adjustment), currency)}</strong>
              </div>
            )}
            <div className={styles.invoiceGrandTotal}>
              <span>Total due</span><strong>{money(invoice.total_minor, currency)}</strong>
            </div>
          </div>
          <p className={styles.invoiceFootnote}>
            This demo invoice stores subtotal and total amounts. Separate tax and discount breakdowns are not currently recorded.
          </p>

          {paymentsResult.error ? (
            <div className={styles.inlineError} role="alert">Payment history for this invoice is temporarily unavailable.</div>
          ) : payments.length > 0 && (
            <section className={styles.invoicePaymentHistory}>
              <h2>Payment activity</h2>
              {payments.map((payment) => (
                <div key={payment.id} className={styles.invoicePaymentRow}>
                  <span>{date(payment.created_at)} · {payment.is_simulated ? "Simulated" : title(payment.method || "Payment")}</span>
                  <span className={`${styles.status} ${styles[`status_${payment.status}`] || ""}`}>{title(payment.status)}</span>
                  <strong>{money(payment.amount_minor, currency)}</strong>
                </div>
              ))}
            </section>
          )}
        </article>

        {canPay && <SimulatedPayment invoiceId={invoice.id} />}
        {!canPay && invoice.status === "paid" && (
          <p className={styles.paidNote}>This invoice has been paid. No further payment is available.</p>
        )}
        {!canPay && ["void"].includes(invoice.status) && (
          <p className={styles.paidNote}>This invoice is void and cannot be paid.</p>
        )}
        <p className={styles.disclaimer}>
          All payments in this demo are simulations. No real money or payment credentials are processed.
        </p>
      </div>
    </main>
  );
}
