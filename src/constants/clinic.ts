// Seller (clinic) identity printed on invoice PDFs.
export const CLINIC = {
  name: "Dr Zeina Veterinary Clinic",
  // IANA timezone for the clinic. Used to render dates/times (e.g. appointment
  // reminders) in local time regardless of where the server runs (Vercel = UTC).
  timezone: "Asia/Beirut",
  // Logo lives in /public. Dimensions keep the source 1280x389 aspect ratio.
  logo: { src: "/dr-zeina-semaan-logo.png", width: 170, height: 52 },
  // One line per array entry; blank entries are skipped.
  addressLines: [
    "Qornayel Main road",
    "Near Yehya Hilal Station",
    "Baabda, Mount-Lebanon",
    "Lebanon",
  ],
  phone: "Mobile: 70 121 556",
  email: "",
  website: "https://zeinavetclinic.com",
  // Tax / business registration number (e.g. EIN, VAT, ABN).
  taxId: "",
} as const;

// ISO 4217 currency code + symbol used on invoices.
export const CURRENCY = {
  code: "USD",
  symbol: "$",
} as const;

// Default payment terms / footer note printed at the bottom of the invoice.
export const INVOICE_TERMS =
  "Payment is due by the date shown above. Please reference the invoice number with your payment. Thank you for your business.";
