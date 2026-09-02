import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChangePasswordForm from "@/components/users/ChangePasswordForm";

// Your own account. Not gated by any permission: it belongs to whoever is
// signed in, whatever their role. It replaces the old /reset-password stub,
// which asked for an email and sent nothing, because there is no mail server.
export default async function AccountPage() {
  const session = await auth();
  const userId = session?.user?.userId;

  // Read the row rather than the token: a name or role changed by an admin
  // since sign-in should show as it is now, not as the cookie remembers it.
  const user = userId
    ? await prisma.user.findUnique({
        where: { userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: { select: { name: true } },
        },
      })
    : null;

  return (
    <Stack spacing={4}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Your account</Typography>
        {user && (
          <Typography color="text.secondary">
            {user.firstName} {user.lastName}, {user.email}, signed in as{" "}
            {user.role.name}
          </Typography>
        )}
      </Stack>
      <ChangePasswordForm />
    </Stack>
  );
}
