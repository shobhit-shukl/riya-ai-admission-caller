"use client";

import Link from "next/link";
import { useActionState } from "react";
import { COURSE_LEVELS, COURSE_LEVEL_LABELS, type CourseFields } from "@/lib/courseTypes";
import { saveCourseAction, type FormState } from "./actions";
import leadStyles from "../leads/leads.module.css";
import styles from "./courses.module.css";

const TEXT_FIELDS: { key: keyof CourseFields; label: string; placeholder: string; rows?: number }[] = [
  { key: "department", label: "Department / school", placeholder: "School of Management" },
  { key: "duration", label: "Duration", placeholder: "3 years (6 semesters)" },
  { key: "seats", label: "Seats", placeholder: "120" },
  { key: "fees", label: "Fees", placeholder: "₹85,000 per year + ₹10,000 one-time admission fee", rows: 2 },
  { key: "eligibility", label: "Eligibility", placeholder: "12th pass in any stream with at least 50% marks", rows: 2 },
  { key: "selectionProcess", label: "Selection process", placeholder: "Merit in 12th + personal interview", rows: 2 },
  {
    key: "description",
    label: "About the course",
    placeholder: "Specialisations, highlights, internships, placements…",
    rows: 4,
  },
  { key: "applyUrl", label: "Application link", placeholder: "https://…" },
  { key: "brochureUrl", label: "Brochure link (PDF)", placeholder: "https://…" },
];

export default function CourseForm({ id, course }: { id?: string; course?: CourseFields }) {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(saveCourseAction, null);

  return (
    <form action={formAction} className={styles.card}>
      {id && <input type="hidden" name="id" value={id} />}

      <div className={styles.grid}>
        <label className={`${leadStyles.formField} ${styles.wide}`}>
          <span className={leadStyles.fieldLabel}>Course name *</span>
          <input name="name" required maxLength={150} defaultValue={course?.name} className={leadStyles.input} placeholder="BBA" />
        </label>

        <label className={leadStyles.formField}>
          <span className={leadStyles.fieldLabel}>Level</span>
          <select name="level" defaultValue={course?.level ?? "ug"} className={leadStyles.input}>
            {COURSE_LEVELS.map((value) => (
              <option key={value} value={value}>
                {COURSE_LEVEL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {TEXT_FIELDS.map(({ key, label, placeholder, rows }) => (
          <label key={key} className={`${leadStyles.formField} ${rows ? styles.wide : ""}`}>
            <span className={leadStyles.fieldLabel}>{label}</span>
            {rows ? (
              <textarea
                name={key}
                rows={rows}
                defaultValue={String(course?.[key] ?? "")}
                placeholder={placeholder}
                className={leadStyles.input}
              />
            ) : (
              <input
                name={key}
                type={key.endsWith("Url") ? "url" : "text"}
                defaultValue={String(course?.[key] ?? "")}
                placeholder={placeholder}
                className={leadStyles.input}
              />
            )}
          </label>
        ))}
      </div>

      <div className={styles.checks}>
        <label className={leadStyles.filterCheckbox}>
          <input type="checkbox" name="admissionsOpen" defaultChecked={course?.admissionsOpen ?? true} />
          Admissions open
        </label>
        <label className={leadStyles.filterCheckbox}>
          <input type="checkbox" name="active" defaultChecked={course?.active ?? true} />
          Show to students (WhatsApp bot)
        </label>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={leadStyles.primaryButton} disabled={isPending}>
          {isPending ? "Saving…" : id ? "Save changes" : "Add course"}
        </button>
        <Link href="/admin/courses" className={leadStyles.clearLink}>
          Cancel
        </Link>
        {state && !state.ok && (
          <span className={leadStyles.callNowError} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
