"use client";

import { useActionState } from "react";
import leadStyles from "../leads/leads.module.css";
import { testCallAction, type TestCallState } from "./actions";
import styles from "./calling-setup.module.css";

export default function TestCallForm({ disabledReason }: { disabledReason: string | null }) {
  const [state, formAction, isPending] = useActionState<TestCallState | null, FormData>(testCallAction, null);

  return (
    <form action={formAction} className={styles.testForm}>
      <input
        type="tel"
        name="phone"
        inputMode="tel"
        autoComplete="tel"
        placeholder="Your mobile number"
        required
        maxLength={20}
        className={leadStyles.input}
        aria-label="Your mobile number"
        disabled={disabledReason !== null}
      />
      <button
        type="submit"
        className={leadStyles.primaryButton}
        disabled={isPending || disabledReason !== null}
        title={disabledReason ?? undefined}
      >
        {isPending ? "Starting call…" : "📞 Call my phone"}
      </button>
      {disabledReason ? (
        <span className={leadStyles.muted}>{disabledReason}</span>
      ) : (
        state && (
          <span className={state.ok ? leadStyles.callNowSuccess : leadStyles.callNowError} role="status">
            {state.message}
          </span>
        )
      )}
    </form>
  );
}
