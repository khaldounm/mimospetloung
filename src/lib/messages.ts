import type { ContactMessage } from "@/generated/prisma/client";
import type { ContactMessageStatus } from "@/types/enums";
import type { ContactMessageDTO } from "@/types/entities";

export function toContactMessageDTO(m: ContactMessage): ContactMessageDTO {
  return {
    messageId: m.messageId,
    name: m.name,
    email: m.email,
    phone: m.phone,
    petName: m.petName,
    petType: m.petType,
    message: m.message,
    status: m.status as ContactMessageStatus,
    createdAt: m.createdAt.toISOString(),
  };
}
