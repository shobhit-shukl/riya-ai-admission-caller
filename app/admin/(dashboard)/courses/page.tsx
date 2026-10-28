import Link from "next/link";
import { COURSE_LEVEL_LABELS } from "@/lib/courseTypes";
import { getAdmissionInfo, listCourses } from "@/lib/courses";
import dashboardStyles from "../dashboard.module.css";
import leadStyles from "../leads/leads.module.css";
import AdmissionInfoForm from "./AdmissionInfoForm";
import styles from "./courses.module.css";
import RemoveCourseButton from "./RemoveCourseButton";

export const metadata = {
  title: "Courses — Sam Admin",
};

export default async function CoursesPage() {
  const [courses, info] = await Promise.all([listCourses(), getAdmissionInfo()]);
  const shown = courses.filter((course) => course.active).length;

  return (
    <div>
      <div className={`${dashboardStyles.pageHeading} ${leadStyles.headingRow}`}>
        <div>
          <h1>Courses</h1>
          <p>
            What the WhatsApp bot tells students. {courses.length} course{courses.length === 1 ? "" : "s"} · {shown}{" "}
            shown to students
          </p>
        </div>
        <div className={leadStyles.headingActions}>
          <Link href="/admin/courses/new" className={leadStyles.primaryButton}>
            + Add course
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className={leadStyles.emptyState}>
          No courses yet. Add your first course so the WhatsApp bot can answer students about it.
        </p>
      ) : (
        <div className={leadStyles.tableWrapper}>
          <table className={leadStyles.table}>
            <thead>
              <tr>
                <th>Course</th>
                <th>Level</th>
                <th>Duration</th>
                <th>Fees</th>
                <th>Admissions</th>
                <th>Bot</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className={styles.nameCell}>
                    <Link href={`/admin/courses/${course.id}`} className={leadStyles.rowLink}>
                      {course.name}
                    </Link>
                    {course.department && <span className={leadStyles.muted}>{course.department}</span>}
                  </td>
                  <td>{COURSE_LEVEL_LABELS[course.level]}</td>
                  <td>{course.duration || "—"}</td>
                  <td className={styles.feesCell} title={course.fees}>
                    {course.fees || "—"}
                  </td>
                  <td>
                    <span className={`${leadStyles.badge} ${course.admissionsOpen ? leadStyles.statusEnrolled : leadStyles.statusLost}`}>
                      {course.admissionsOpen ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td>
                    <span className={`${leadStyles.badge} ${course.active ? leadStyles.statusNew : leadStyles.statusLost}`}>
                      {course.active ? "Shown" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link href={`/admin/courses/${course.id}`} className={leadStyles.backLink}>
                        Edit
                      </Link>
                      <RemoveCourseButton id={course.id} name={course.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.sectionHeading}>
        <h2>Admission info</h2>
        <p className={leadStyles.muted}>
          Details that apply to every course. The bot only answers from this page, so anything left blank it will
          refer to the admissions office.
        </p>
      </div>
      <AdmissionInfoForm info={info} />
    </div>
  );
}
