"use client";

import { deleteCourseAction } from "./actions";
import styles from "./courses.module.css";

export default function RemoveCourseButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCourseAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${name}? Students will no longer hear about it from the WhatsApp bot.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={styles.removeButton} aria-label={`Delete ${name}`}>
        ✕
      </button>
    </form>
  );
}
