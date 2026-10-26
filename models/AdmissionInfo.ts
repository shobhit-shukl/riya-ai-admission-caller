/**
 * models/AdmissionInfo.ts
 *
 * Institution-wide admission details (process, documents, dates,
 * scholarships, hostel, contacts) edited under Admin → Courses. There is
 * only ever one document, keyed "default".
 */

import { Schema, model, models } from "mongoose";

const AdmissionInfoSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    institutionName: { type: String, default: "" },
    about: { type: String, default: "" },
    admissionProcess: { type: String, default: "" },
    documentsRequired: { type: String, default: "" },
    importantDates: { type: String, default: "" },
    scholarships: { type: String, default: "" },
    hostel: { type: String, default: "" },
    contactDetails: { type: String, default: "" },
    applyUrl: { type: String, default: "" },
    otherInfo: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.AdmissionInfo || model("AdmissionInfo", AdmissionInfoSchema);
