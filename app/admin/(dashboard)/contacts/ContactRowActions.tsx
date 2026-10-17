"use client";

import { useActionState } from "react";
import { callContactAction, removeContactAction, type CallContactState } from "./actions";
import leadStyles from "../leads/leads.module.css";
import styles from "./contacts.module.css";

export default function ContactRowActions({
  contactId,
  contactLabel,
  callDisabledReason,
}: {
  contactId: string;
  contactLabel: string;
  /** Why this contact can't be called right now, or null if it can. */
  callDisabledReason: string | null;
}) {
  const [state, callAction, isCalling] = useActionState<CallContactState | null, FormData>(callContactAction, null);

  return (
    <div className={styles.rowActions}>
      <form action={callAction}>
        <input type="hidden" name="contactId" value={contactId} />
        <button
          type="submit"
          className={`${leadStyles.primaryButton} ${styles.callButton}`}
          disabled={isCalling || callDisabledReason !== null}
          title={callDisabledReason ?? `Call ${contactLabel}`}
        >
          {isCalling ? "Calling…" : "📞 Call"}
        </button>
      </form>

      <form
        action={removeContactAction}
        onSubmit={(event) => {
          if (!window.confirm(`Remove ${contactLabel} from the call list?`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="contactId" value={contactId} />
        <button type="submit" className={styles.removeButton} aria-label={`Remove ${contactLabel}`}>
          ✕
        </button>
      </form>

      {state && !isCalling && (
        <span className={state.ok ? leadStyles.callNowSuccess : leadStyles.callNowError} role="status">
          {state.message}
        </span>
      )}
    </div>
  );
}
