/**
 * lib/courses.ts
 *
 * Courses and institution-wide admission info (Admin → Courses), and the
 * plain-text knowledge sheet the WhatsApp bot answers from
 * (GET /api/bot/knowledge).
 */

import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import {
  ADMISSION_INFO_FIELDS,
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  type AdmissionInfoFields,
  type CourseFields,
  type CourseLevel,
} from "@/lib/courseTypes";
import AdmissionInfoModel from "@/models/AdmissionInfo";
import CourseModel from "@/models/Course";

// ---------------------------------------------------------------------------
// Parsing admin form input
// ---------------------------------------------------------------------------

function line(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function paragraph(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

/** Empty, or an http(s) URL. Returns null if it's something else. */
function url(value: FormDataEntryValue | null): string | null {
  const raw = line(value, 500);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function parseCourseForm(formData: FormData): { ok: true; course: CourseFields } | { ok: false; error: string } {
  const name = line(formData.get("name"), 150);
  if (!name) return { ok: false, error: "Course name is required." };

  const levelValue = String(formData.get("level") ?? "");
  const applyUrl = url(formData.get("applyUrl"));
  const brochureUrl = url(formData.get("brochureUrl"));
  if (applyUrl === null) return { ok: false, error: "Application link must start with http:// or https://" };
  if (brochureUrl === null) return { ok: false, error: "Brochure link must start with http:// or https://" };

  return {
    ok: true,
    course: {
      name,
      level: (COURSE_LEVELS as readonly string[]).includes(levelValue) ? (levelValue as CourseLevel) : "ug",
      department: line(formData.get("department"), 150),
      duration: line(formData.get("duration"), 100),
      fees: paragraph(formData.get("fees"), 1000),
      eligibility: paragraph(formData.get("eligibility"), 1000),
      selectionProcess: paragraph(formData.get("selectionProcess"), 1000),
      seats: line(formData.get("seats"), 50),
      description: paragraph(formData.get("description"), 3000),
      applyUrl,
      brochureUrl,
      admissionsOpen: formData.get("admissionsOpen") === "on",
      active: formData.get("active") === "on",
    },
  };
}

export function parseAdmissionInfoForm(
  formData: FormData
): { ok: true; info: AdmissionInfoFields } | { ok: false; error: string } {
  const info = Object.fromEntries(
    ADMISSION_INFO_FIELDS.map(({ key, rows }) => [
      key,
      rows === 1 ? line(formData.get(key), 300) : paragraph(formData.get(key), 4000),
    ])
  ) as unknown as AdmissionInfoFields;

  const applyUrl = url(info.applyUrl);
  if (applyUrl === null) return { ok: false, error: "Online application link must start with http:// or https://" };
  return { ok: true, info: { ...info, applyUrl } };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export interface CourseListItem extends CourseFields {
  id: string;
  updatedAt: string;
}

type CourseLean = Partial<CourseFields> & { _id: { toString(): string }; updatedAt?: Date };

function toListItem(doc: CourseLean): CourseListItem {
  return {
    id: doc._id.toString(),
    name: doc.name ?? "",
    level: doc.level ?? "ug",
    department: doc.department ?? "",
    duration: doc.duration ?? "",
    fees: doc.fees ?? "",
    eligibility: doc.eligibility ?? "",
    selectionProcess: doc.selectionProcess ?? "",
    seats: doc.seats ?? "",
    description: doc.description ?? "",
    applyUrl: doc.applyUrl ?? "",
    brochureUrl: doc.brochureUrl ?? "",
    admissionsOpen: doc.admissionsOpen ?? true,
    active: doc.active ?? true,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : "",
  };
}

/** All courses, grouped by level (UG first) then by name. */
export async function listCourses({ activeOnly = false } = {}): Promise<CourseListItem[]> {
  await connectToDatabase();
  const docs = (await CourseModel.find(activeOnly ? { active: true } : {}).lean()) as unknown as CourseLean[];
  return docs
    .map(toListItem)
    .sort(
      (a, b) =>
        COURSE_LEVELS.indexOf(a.level) - COURSE_LEVELS.indexOf(b.level) ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
}

export async function getCourse(id: string): Promise<CourseListItem | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = (await CourseModel.findById(id).lean()) as unknown as CourseLean | null;
  return doc ? toListItem(doc) : null;
}

export async function createCourse(course: CourseFields): Promise<string> {
  await connectToDatabase();
  const doc = await CourseModel.create(course);
  return doc._id.toString();
}

export async function updateCourse(id: string, course: CourseFields): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectToDatabase();
  const result = await CourseModel.updateOne({ _id: id }, { $set: course });
  return result.matchedCount > 0;
}

export async function deleteCourse(id: string): Promise<void> {
  if (!isValidObjectId(id)) return;
  await connectToDatabase();
  await CourseModel.deleteOne({ _id: id });
}

// ---------------------------------------------------------------------------
// Admission info
// ---------------------------------------------------------------------------

const EMPTY_ADMISSION_INFO = Object.fromEntries(
  ADMISSION_INFO_FIELDS.map(({ key }) => [key, ""])
) as unknown as AdmissionInfoFields;

export async function getAdmissionInfo(): Promise<AdmissionInfoFields & { updatedAt: string }> {
  await connectToDatabase();
  const doc = (await AdmissionInfoModel.findOne({ key: "default" }).lean()) as unknown as
    | (Partial<AdmissionInfoFields> & { updatedAt?: Date })
    | null;

  const info = { ...EMPTY_ADMISSION_INFO };
  for (const { key } of ADMISSION_INFO_FIELDS) info[key] = doc?.[key] ?? "";
  return { ...info, updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : "" };
}

export async function saveAdmissionInfo(info: AdmissionInfoFields): Promise<void> {
  await connectToDatabase();
  await AdmissionInfoModel.updateOne({ key: "default" }, { $set: info }, { upsert: true });
}

// ---------------------------------------------------------------------------
// Knowledge sheet for the WhatsApp bot
// ---------------------------------------------------------------------------

export interface BotKnowledge {
  institutionName: string;
  /** Everything the bot may say, as plain text for its system prompt. */
  text: string;
  courses: { name: string; level: string; admissionsOpen: boolean }[];
  updatedAt: string;
}

function section(title: string, body: string): string {
  return body ? `## ${title}\n${body}` : "";
}

function courseBlock(course: CourseListItem): string {
  const rows: [string, string][] = [
    ["Level", COURSE_LEVEL_LABELS[course.level]],
    ["Department", course.department],
    ["Duration", course.duration],
    ["Fees", course.fees],
    ["Eligibility", course.eligibility],
    ["Selection process", course.selectionProcess],
    ["Seats", course.seats],
    ["Admissions", course.admissionsOpen ? "Open" : "Closed for now"],
    ["About", course.description],
    ["Apply", course.applyUrl],
    ["Brochure", course.brochureUrl],
  ];
  return [`### ${course.name}`, ...rows.filter(([, value]) => value).map(([label, value]) => `- ${label}: ${value}`)].join(
    "\n"
  );
}

export async function buildBotKnowledge(): Promise<BotKnowledge> {
  const [courses, info] = await Promise.all([listCourses({ activeOnly: true }), getAdmissionInfo()]);

  const text = [
    info.institutionName ? `# ${info.institutionName}` : "",
    section("About", info.about),
    section("Courses offered", courses.length > 0 ? courses.map(courseBlock).join("\n\n") : "No courses listed yet."),
    ...ADMISSION_INFO_FIELDS.filter(({ key }) => key !== "institutionName" && key !== "about").map(
      ({ key, label }) => section(label, info[key])
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  const latest = [info.updatedAt, ...courses.map((course) => course.updatedAt)].filter(Boolean).sort().at(-1) ?? "";

  return {
    institutionName: info.institutionName,
    text,
    courses: courses.map((course) => ({
      name: course.name,
      level: COURSE_LEVEL_LABELS[course.level],
      admissionsOpen: course.admissionsOpen,
    })),
    updatedAt: latest,
  };
}
