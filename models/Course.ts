/**
 * models/Course.ts
 *
 * A course the university offers, managed under Admin → Courses. The
 * WhatsApp bot answers students from these (GET /api/bot/knowledge), so
 * only `active` courses are shared with it.
 */

import { Schema, model, models } from "mongoose";
import { COURSE_LEVELS } from "@/lib/courseTypes";

const CourseSchema = new Schema(
  {
    name: { type: String, required: true },
    level: { type: String, enum: COURSE_LEVELS, default: "ug", index: true },
    department: { type: String, default: "" },
    duration: { type: String, default: "" },
    fees: { type: String, default: "" },
    eligibility: { type: String, default: "" },
    selectionProcess: { type: String, default: "" },
    seats: { type: String, default: "" },
    description: { type: String, default: "" },
    applyUrl: { type: String, default: "" },
    brochureUrl: { type: String, default: "" },
    admissionsOpen: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default models.Course || model("Course", CourseSchema);
