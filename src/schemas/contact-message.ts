import { z } from "zod";
import { CONTACT_MESSAGE_STATUSES } from "@/types/enums";

// Staff can only change a website message's triage status; the message content
// itself is immutable (it came from a third party).
export const contactMessageUpdateSchema = z.object({
  status: z.enum(CONTACT_MESSAGE_STATUSES),
});
