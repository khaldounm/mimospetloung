import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toContactMessageDTO } from "@/lib/messages";
import MessagesView from "@/components/messages/MessagesView";

export default async function MessagesPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "notifications:write");

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Web Contact Form
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enquiries submitted through the public website contact form. Opening a
        new message marks it as read; archive ones you have handled.
      </Typography>
      <MessagesView
        initialMessages={messages.map(toContactMessageDTO)}
        canWrite={canWrite}
      />
    </Box>
  );
}
