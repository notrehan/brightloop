"use client";

import type { FormEvent } from "react";
import { manageSubscription } from "./actions";
import styles from "./portal.module.css";

type SubscriptionActionsProps = {
  subscriptionId: string;
  status: string;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
};

export function SubscriptionActions({
  subscriptionId,
  status,
  canPause,
  canResume,
  canCancel,
}: SubscriptionActionsProps) {
  const submitWithConfirmation = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const action = String(new FormData(form).get("action") || "");
    const messages: Record<string, string> = {
      pause: "Pause this subscription? Billing will be paused until you resume it.",
      resume: "Resume this subscription? Billing will continue on the shown renewal schedule.",
      cancel: "Cancel this subscription? This action stops future renewals.",
    };
    if (!window.confirm(messages[action] || "Continue with this subscription change?")) {
      event.preventDefault();
    }
  };

  return (
    <div className={styles.subscriptionActions}>
      {canPause && (
        <form action={manageSubscription} onSubmit={submitWithConfirmation}>
          <input type="hidden" name="id" value={subscriptionId} />
          <input type="hidden" name="action" value="pause" />
          <button className={styles.secondaryButton} type="submit">Pause</button>
        </form>
      )}
      {canResume && (
        <form action={manageSubscription} onSubmit={submitWithConfirmation}>
          <input type="hidden" name="id" value={subscriptionId} />
          <input type="hidden" name="action" value="resume" />
          <button className={styles.secondaryButton} type="submit">Resume</button>
        </form>
      )}
      {canCancel && (
        <form action={manageSubscription} onSubmit={submitWithConfirmation}>
          <input type="hidden" name="id" value={subscriptionId} />
          <input type="hidden" name="action" value="cancel" />
          <button className={styles.dangerButton} type="submit">Cancel</button>
        </form>
      )}
      <span className={styles.actionHint}>Current status: {status.replaceAll("_", " ")}</span>
    </div>
  );
}
