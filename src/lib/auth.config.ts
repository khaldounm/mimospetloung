import type { NextAuthConfig } from "next-auth";
import type { AppUserFields } from "@/types/session";

// Edge-safe auth config: NO database / bcrypt imports here, so it can be used
// by middleware on the Edge runtime. The credentials provider (which needs
// Prisma + bcrypt) is added in auth.ts only.
export const authConfig = {
  // Trust the deploy host. Vercel sets this implicitly; needed for local
  // production builds and any self-hosted environment behind a known proxy.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    // Persist app-specific fields onto the JWT at sign-in. `authorize` returns
    // a user already enriched with role + permissions, so the token carries
    // everything middleware needs — no DB call on the Edge.
    jwt({ token, user }) {
      if (user) {
        token.userId = user.userId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    session({ session, token }) {
      // The JWT is an untyped payload (Record<string, unknown>); read our
      // fields through the known shape we wrote in the jwt callback.
      const t = token as Partial<AppUserFields>;
      if (t.userId !== undefined) session.user.userId = t.userId;
      if (t.roleName !== undefined) session.user.roleName = t.roleName;
      session.user.permissions = t.permissions ?? [];
      if (t.firstName !== undefined) session.user.firstName = t.firstName;
      if (t.lastName !== undefined) session.user.lastName = t.lastName;
      return session;
    },
  },
} satisfies NextAuthConfig;
