"use client";

import { useActionState } from "react";
import {
  WEBSITE_LEAD_STATUSES,
  WEBSITE_LEAD_STATUS_LABELS as STATUS_LABELS,
  type WebsiteLeadStatus,
} from "@/lib/websiteLeadTypes";
import { callWebsiteLeadAction, updateWebsiteLeadStatusAction, type CallWebsiteLeadState } from "./actions";
import leadStyles from "../leads/leads.module.css";
import styles from "./website-leads.module.css";

/** Status picker that saves as soon as it changes. */
export function StatusSelect({ id, status }: { id: string; status: WebsiteLeadStatus }) {
  return (
    <form action={updateWebsiteLeadStatusAction} key={status}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        className={`${leadStyles.input} ${styles.statusSelect} ${styles[`status_${status}`]}`}
        aria-label="Enquiry status"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {WEBSITE_LEAD_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </select>
    </form>
  );
}

export function CallButton({ id, disabledReason }: { id: string; disabledReason: string | null }) {
  const [state, action, isCalling] = useActionState<CallWebsiteLeadState | null, FormData>(
    callWebsiteLeadAction,
    null
  );

  return (
    <form action={action} className={styles.callForm}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={`${leadStyles.primaryButton} ${styles.callButton}`}
        disabled={isCalling || disabledReason !== null}
        title={disabledReason ?? "Have Sam call this student"}
      >
        {isCalling ? "Calling…" : "📞 Call"}
      </button>
      {state && !isCalling && (
        <span className={state.ok ? leadStyles.callNowSuccess : leadStyles.callNowError} role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}
