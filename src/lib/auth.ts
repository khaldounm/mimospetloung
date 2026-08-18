import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        // email column is citext → match is case-insensitive at the DB level.
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { userId: user.userId },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: String(user.userId),
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleName: user.role.name,
          permissions: user.role.rolePermissions.map(
            (rp) => rp.permission.name,
          ),
        };
      },
    }),
  ],
});
