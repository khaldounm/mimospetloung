import { z } from "zod";
import { optionalString, optionalDate } from "./common";

// Vitals are optional on every record type: a booster or a groom often never
// puts the animal on a scale. Blank clears the figure rather than leaving the
// old one behind, so a value corrected to nothing does not linger on the chart.
//
// The bounds are typo guards, not clinical limits. "385" for 38.5 and "45" for
// 4.5 kg are the mistakes a keyboard makes, and both land outside a range that
// still admits every animal this clinic will see.
function optionalMeasure(min: number, max: number, message: string) {
  return z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(min, message).max(max, message).nullable().optional(),
  );
}

const vitals = {
  // Degrees Celsius. 20 is profound hypothermia, 50 is past survivable.
  temperature: optionalMeasure(
    20,
    50,
    "Temperature should be between 20 and 50 °C",
  ),
  // Kilograms, from a 0.05 kg neonate upward.
  weight: optionalMeasure(
    0.01,
    999.99,
    "Weight should be between 0 and 1000 kg",
  ),
};

const baseFields = {
  subcategory: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1, "Title is required").max(255),
  notes: optionalString(5000),
  performedAt: optionalDate,
  nextDueDate: optionalDate,
  performedBy: z.coerce.number().int().positive().optional(),
  ...vitals,
};

const consultationDetails = z.object({
  chiefComplaint: optionalString(2000),
  assessment: optionalString(2000),
  plan: optionalString(2000),
  medication: optionalString(2000),
});

const vaccinationDetails = z.object({
  lotNumber: optionalString(100),
  manufacturer: optionalString(255),
});

const groomingDetails = z.object({
  coatCondition: optionalString(1000),
});

const treatmentDetails = z.object({
  procedure: optionalString(2000),
  findings: optionalString(2000),
  result: optionalString(2000),
});

export const clinicalRecordCreateSchema = z.discriminatedUnion("recordType", [
  z.object({
    recordType: z.literal("Consultation"),
    ...baseFields,
    details: consultationDetails,
  }),
  z.object({
    recordType: z.literal("Vaccination"),
    ...baseFields,
    details: vaccinationDetails,
  }),
  z.object({
    recordType: z.literal("Grooming"),
    ...baseFields,
    details: groomingDetails,
  }),
  z.object({
    recordType: z.literal("Treatment"),
    ...baseFields,
    details: treatmentDetails,
  }),
]);

export type ClinicalRecordCreateInput = z.infer<
  typeof clinicalRecordCreateSchema
>;

// Update schema: recordType is immutable, all other fields optional.
export const clinicalRecordUpdateSchema = z.object({
  subcategory: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1, "Title is required").max(255).optional(),
  notes: optionalString(5000),
  performedAt: optionalDate,
  nextDueDate: optionalDate,
  details: z.record(z.string(), z.unknown()).optional(),
  ...vitals,
});

export type ClinicalRecordUpdateInput = z.infer<
  typeof clinicalRecordUpdateSchema
>;
