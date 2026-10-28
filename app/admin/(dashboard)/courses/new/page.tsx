import Link from "next/link";
import dashboardStyles from "../../dashboard.module.css";
import leadStyles from "../../leads/leads.module.css";
import CourseForm from "../CourseForm";

export const metadata = {
  title: "Add course — Sam Admin",
};

export default function NewCoursePage() {
  return (
    <div>
      <Link href="/admin/courses" className={leadStyles.backLink}>
        ← Courses
      </Link>
      <div className={dashboardStyles.pageHeading}>
        <h1>Add course</h1>
        <p>Write it the way you&apos;d explain it to a student. The WhatsApp bot answers from exactly this.</p>
      </div>
      <CourseForm />
    </div>
  );
}
