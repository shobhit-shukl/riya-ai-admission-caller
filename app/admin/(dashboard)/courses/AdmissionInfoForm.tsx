"use client";

import { useActionState } from "react";
import { ADMISSION_INFO_FIELDS, type AdmissionInfoFields } from "@/lib/courseTypes";
import { saveAdmissionInfoAction, type FormState } from "./actions";
import leadStyles from "../leads/leads.module.css";
import styles from "./courses.module.css";

export default function AdmissionInfoForm({ info }: { info: AdmissionInfoFields }) {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(saveAdmissionInfoAction, null);

  return (
    <form action={formAction} className={styles.card}>
      <div className={styles.grid}>
        {ADMISSION_INFO_FIELDS.map(({ key, label, hint, rows }) => (
          <label key={key} className={`${leadStyles.formField} ${rows > 1 ? styles.wide : ""}`}>
            <span className={leadStyles.fieldLabel}>{label}</span>
            {rows > 1 ? (
              <textarea name={key} rows={rows} defaultValue={info[key]} placeholder={hint} className={leadStyles.input} />
            ) : (
              <input
                name={key}
                type={key === "applyUrl" ? "url" : "text"}
                defaultValue={info[key]}
                placeholder={hint}
                className={leadStyles.input}
              />
            )}
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="submit" className={leadStyles.primaryButton} disabled={isPending}>
          {isPending ? "Saving…" : "Save admission info"}
        </button>
        {state && !isPending && (
          <span className={state.ok ? leadStyles.callNowSuccess : leadStyles.callNowError} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
