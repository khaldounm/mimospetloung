import { Box, Typography } from "@mui/material";
import NotificationsTabs from "@/components/notifications/NotificationsTabs";

// Shared shell for all notification tabs: the title and tab bar persist across
// tab navigations, only the tab content below re-renders.
export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Notifications
      </Typography>
      <NotificationsTabs />
      {children}
    </Box>
  );
}
