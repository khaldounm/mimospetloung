import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRbac } from "./rbac";
import { seedBookingTypes } from "./reference-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SERVICES = [
  // Consultations
  { name: "General/wellness exam", category: "Consultation", price: "50.00" },
  { name: "Sick visit", category: "Consultation", price: "0.00" },
  { name: "Follow-up/recheck", category: "Consultation", price: "0.00" },
  {
    name: "Specialty consult (dermatology)",
    category: "Consultation",
    price: "0.00",
  },
  {
    name: "Specialty consult (cardiology)",
    category: "Consultation",
    price: "0.00",
  },
  {
    name: "Specialty consult (orthopedics)",
    category: "Consultation",
    price: "0.00",
  },
  {
    name: "Specialty consult (oncology)",
    category: "Consultation",
    price: "0.00",
  },
  {
    name: "Specialty consult (neurology)",
    category: "Consultation",
    price: "0.00",
  },
  {
    name: "Specialty consult (internal medicine)",
    category: "Consultation",
    price: "0.00",
  },
  { name: "Nutrition/diet consult", category: "Consultation", price: "0.00" },
  { name: "Pre-surgical consult", category: "Consultation", price: "0.00" },
  { name: "Second opinion", category: "Consultation", price: "0.00" },
  { name: "Telehealth consult", category: "Consultation", price: "0.00" },
  {
    name: "Reproduction/breeding consult",
    category: "Consultation",
    price: "0.00",
  },
  { name: "End-of-life consult", category: "Consultation", price: "0.00" },
  // Vaccinations
  { name: "Rabies", category: "Vaccination", price: "25.00" },
  {
    name: "Core vaccine - distemper/parvo/hepatitis (DHPP)",
    category: "Vaccination",
    price: "0.00",
  },
  {
    name: "Core vaccine - feline (FVRCP)",
    category: "Vaccination",
    price: "0.00",
  },
  { name: "Leptospirosis", category: "Vaccination", price: "0.00" },
  { name: "Bordetella (kennel cough)", category: "Vaccination", price: "0.00" },
  { name: "Feline leukemia (FeLV)", category: "Vaccination", price: "0.00" },
  { name: "Lyme disease", category: "Vaccination", price: "0.00" },
  { name: "Canine influenza", category: "Vaccination", price: "0.00" },
  { name: "Annual booster", category: "Vaccination", price: "0.00" },
  { name: "Deworming", category: "Vaccination", price: "0.00" },
  { name: "Echinococcus treatment", category: "Vaccination", price: "0.00" },
  { name: "Flea & tick prevention", category: "Vaccination", price: "0.00" },
  { name: "Heartworm prevention", category: "Vaccination", price: "0.00" },
  // Grooming
  { name: "Bath/shower", category: "Grooming", price: "40.00" },
  { name: "Nail trimming", category: "Grooming", price: "0.00" },
  { name: "Ear cleaning", category: "Grooming", price: "0.00" },
  {
    name: "Tartar/plaque removal (non-surgical dental)",
    category: "Grooming",
    price: "0.00",
  },
  { name: "Anal gland expression", category: "Grooming", price: "0.00" },
  { name: "Brushing/de-shedding", category: "Grooming", price: "0.00" },
  { name: "Sanitary trim", category: "Grooming", price: "0.00" },
  { name: "Fur trimming/clipping", category: "Grooming", price: "0.00" },
  // Treatments
  { name: "Blood test - CBC", category: "Treatment", price: "0.00" },
  {
    name: "Blood test - chemistry panel",
    category: "Treatment",
    price: "0.00",
  },
  { name: "Urinalysis", category: "Treatment", price: "0.00" },
  { name: "Fecal exam", category: "Treatment", price: "0.00" },
  { name: "X-ray", category: "Treatment", price: "0.00" },
  { name: "Ultrasound", category: "Treatment", price: "0.00" },
  { name: "CT/MRI", category: "Treatment", price: "0.00" },
  {
    name: "Biopsy/cytology/histopathology",
    category: "Treatment",
    price: "0.00",
  },
  { name: "Allergy testing", category: "Treatment", price: "0.00" },
  { name: "Thyroid panel", category: "Treatment", price: "0.00" },
  { name: "Tick-borne disease panel", category: "Treatment", price: "0.00" },
  { name: "ECG/cardiac workup", category: "Treatment", price: "0.00" },
  { name: "Spay/neuter", category: "Treatment", price: "0.00" },
  { name: "Mass/tumor removal", category: "Treatment", price: "0.00" },
  { name: "Soft tissue surgery", category: "Treatment", price: "0.00" },
  { name: "Orthopedic surgery", category: "Treatment", price: "0.00" },
  { name: "Dental surgery/extractions", category: "Treatment", price: "0.00" },
  { name: "Wound care/suturing", category: "Treatment", price: "0.00" },
  {
    name: "Medication/prescription dispensing",
    category: "Treatment",
    price: "0.00",
  },
  { name: "Pain management", category: "Treatment", price: "0.00" },
  { name: "IV fluid therapy", category: "Treatment", price: "0.00" },
  { name: "Hospitalization/ICU", category: "Treatment", price: "0.00" },
  {
    name: "Physical therapy/hydrotherapy",
    category: "Treatment",
    price: "0.00",
  },
  {
    name: "C-section/whelping assistance",
    category: "Treatment",
    price: "0.00",
  },
  { name: "Emergency/trauma care", category: "Treatment", price: "0.00" },
  { name: "Euthanasia", category: "Treatment", price: "0.00" },
];

async function main() {
  await seedRbac(prisma);

  // Admin user
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Admin" },
  });
  const passwordHash = await bcrypt.hash("test123", 10);
  await prisma.user.upsert({
    where: { email: "masrikhaldoun@gmail.com" },
    update: { roleId: adminRole.roleId },
    create: {
      email: "masrikhaldoun@gmail.com",
      passwordHash,
      firstName: "Clinic",
      lastName: "Admin",
      roleId: adminRole.roleId,
    },
  });

  await seedBookingTypes(prisma);

  // Services (no unique key, create only if none seeded yet)
  for (const svc of SERVICES) {
    const existing = await prisma.service.findFirst({
      where: { name: svc.name },
    });
    if (!existing) {
      await prisma.service.create({ data: svc });
    }
  }

  console.log("Seed complete:");
  console.log(`  roles: ${await prisma.role.count()}`);
  console.log(`  permissions: ${await prisma.permission.count()}`);
  console.log(`  users: ${await prisma.user.count()}`);
  console.log(`  booking types: ${await prisma.bookingType.count()}`);
  console.log(`  services: ${await prisma.service.count()}`);
  console.log("  admin login: admin@vetclinic.local / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
