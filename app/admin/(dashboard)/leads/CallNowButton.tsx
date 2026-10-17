"use client";

import { useActionState } from "react";
import { callLeadNowAction, type CallNowState } from "./actions";
import styles from "./leads.module.css";

export default function CallNowButton({
  leadId,
  disabledReason,
}: {
  leadId: string;
  /** Why calling isn't possible (not set up, do-not-call, no number), or null if it is. */
  disabledReason: string | null;
}) {
  const [state, formAction, isPending] = useActionState<CallNowState | null, FormData>(callLeadNowAction, null);

  return (
    <form action={formAction} className={styles.callNowForm}>
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        className={styles.primaryButton}
        disabled={isPending || disabledReason !== null}
        title={disabledReason ?? undefined}
      >
        {isPending ? "Starting call…" : "📞 Call now"}
      </button>
      {disabledReason ? (
        <span className={styles.muted}>{disabledReason}</span>
      ) : (
        state && (
          <span className={state.ok ? styles.callNowSuccess : styles.callNowError} role="status">
            {state.message}
          </span>
        )
      )}
    </form>
  );
}
