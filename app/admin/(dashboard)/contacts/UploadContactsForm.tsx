"use client";

import { useActionState, useState } from "react";
import { uploadContactsAction, type UploadState } from "./actions";
import leadStyles from "../leads/leads.module.css";
import styles from "./contacts.module.css";

const MAX_BYTES = 1024 * 1024;
const MAX_SKIPPED_SHOWN = 8;

export default function UploadContactsForm() {
  const [state, formAction, isPending] = useActionState<UploadState | null, FormData>(uploadContactsAction, null);
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form action={formAction} className={styles.uploadCard}>
      <div className={styles.uploadRow}>
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className={styles.fileInput}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileError(file && file.size > MAX_BYTES ? "That file is larger than 1 MB. Split it into smaller files." : null);
          }}
        />
        <button type="submit" className={leadStyles.primaryButton} disabled={isPending || fileError !== null}>
          {isPending ? "Uploading…" : "Upload list"}
        </button>
        <a href="/api/admin/contacts/template" className={styles.templateLink} download>
          Download sample file
        </a>
      </div>

      <p className={leadStyles.muted}>
        Excel (.xlsx) or CSV with a <strong>Name</strong> and a <strong>Phone</strong> column (an optional{" "}
        <strong>Course</strong> column personalises the call). Numbers already on the list are updated, not
        duplicated.
      </p>

      {fileError && <p className={leadStyles.callNowError}>{fileError}</p>}

      {state && !state.ok && <p className={leadStyles.callNowError}>{state.message}</p>}

      {state?.ok && (
        <div className={styles.summary} role="status">
          <p className={leadStyles.callNowSuccess}>
            {state.summary.added} added · {state.summary.updated} updated
            {state.summary.skipped.length > 0 ? ` · ${state.summary.skipped.length} skipped` : ""}
          </p>
          {state.summary.skipped.length > 0 && (
            <ul className={styles.skippedList}>
              {state.summary.skipped.slice(0, MAX_SKIPPED_SHOWN).map((item) => (
                <li key={item.row}>
                  Row {item.row}: {item.reason}
                </li>
              ))}
              {state.summary.skipped.length > MAX_SKIPPED_SHOWN && (
                <li>…and {state.summary.skipped.length - MAX_SKIPPED_SHOWN} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
