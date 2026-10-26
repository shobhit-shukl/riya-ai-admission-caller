/**
 * lib/courseTypes.ts
 *
 * Constants for courses, shared by the model, server code and client
 * components (so nothing here may import Mongoose).
 */

export const COURSE_LEVELS = ["ug", "pg", "diploma", "phd", "certificate"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  ug: "Undergraduate",
  pg: "Postgraduate",
  diploma: "Diploma",
  phd: "PhD",
  certificate: "Certificate",
};

/** The fields an admin edits for a course (all free text so fees etc. can read naturally). */
export interface CourseFields {
  name: string;
  level: CourseLevel;
  department: string;
  duration: string;
  fees: string;
  eligibility: string;
  selectionProcess: string;
  seats: string;
  description: string;
  applyUrl: string;
  brochureUrl: string;
  admissionsOpen: boolean;
  active: boolean;
}

/** Institution-wide admission details the WhatsApp bot answers from. */
export interface AdmissionInfoFields {
  institutionName: string;
  about: string;
  admissionProcess: string;
  documentsRequired: string;
  importantDates: string;
  scholarships: string;
  hostel: string;
  contactDetails: string;
  applyUrl: string;
  otherInfo: string;
}

export const ADMISSION_INFO_FIELDS: { key: keyof AdmissionInfoFields; label: string; hint: string; rows: number }[] = [
  { key: "institutionName", label: "Institution name", hint: "e.g. Maya Devi University, Dehradun", rows: 1 },
  { key: "about", label: "About", hint: "A few lines: location, approvals, rankings, campus", rows: 3 },
  { key: "admissionProcess", label: "Admission process", hint: "Steps from enquiry to enrolment", rows: 4 },
  { key: "documentsRequired", label: "Documents required", hint: "Marksheets, ID proof, photos…", rows: 3 },
  { key: "importantDates", label: "Important dates", hint: "Application deadlines, entrance test, session start", rows: 3 },
  { key: "scholarships", label: "Scholarships", hint: "Who qualifies and how much", rows: 3 },
  { key: "hostel", label: "Hostel & transport", hint: "Availability, fees, facilities", rows: 3 },
  { key: "contactDetails", label: "Contact details", hint: "Admission office phone, email, address, timings", rows: 3 },
  { key: "applyUrl", label: "Online application link", hint: "https://…", rows: 1 },
  { key: "otherInfo", label: "Anything else", hint: "Placements, FAQs, rules the bot should know", rows: 4 },
];
