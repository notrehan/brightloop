"use client";

import type { FormEvent } from "react";
import { payInvoice } from "./actions";
import styles from "./portal.module.css";

export function PrintInvoiceButton() {
  return (
    <button className={styles.secondaryButton} type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}

export function SimulatedPayment({ invoiceId }: { invoiceId: string }) {
  return (
    <div className={styles.paymentBox}>
      <div>
        <strong>Demo payment</strong>
        <p>This is a simulated payment only. No card, bank, or other payment details are collected.</p>
      </div>
      <form
        action={payInvoice}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          if (
            !window.confirm(
              "Complete this simulated payment? Brightloop will record a successful demo payment. No real money will be collected.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button className={styles.primaryButton} type="submit">
          Pay now · simulated
        </button>
      </form>
    </div>
  );
}
