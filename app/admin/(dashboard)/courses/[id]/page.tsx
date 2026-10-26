import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/courses";
import dashboardStyles from "../../dashboard.module.css";
import leadStyles from "../../leads/leads.module.css";
import CourseForm from "../CourseForm";

export const metadata = {
  title: "Edit course — Riya Admin",
};

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  return (
    <div>
      <Link href="/admin/courses" className={leadStyles.backLink}>
        ← Courses
      </Link>
      <div className={dashboardStyles.pageHeading}>
        <h1>{course.name}</h1>
        <p>Changes reach the WhatsApp bot from its next reply.</p>
      </div>
      <CourseForm id={course.id} course={course} />
    </div>
  );
}
