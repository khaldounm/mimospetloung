import { z } from "zod";
import { optionalString, optionalDate } from "./common";

const baseFields = {
  subcategory: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1, "Title is required").max(255),
  notes: optionalString(5000),
  performedAt: optionalDate,
  nextDueDate: optionalDate,
  performedBy: z.coerce.number().int().positive().optional(),
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
});

export type ClinicalRecordUpdateInput = z.infer<
  typeof clinicalRecordUpdateSchema
>;
