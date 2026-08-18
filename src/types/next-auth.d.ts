import type { DefaultSession } from "next-auth";
import type { AppUserFields } from "./session";

declare module "next-auth" {
  interface Session {
    user: AppUserFields & DefaultSession["user"];
  }

  // Returned by the credentials `authorize` callback.
  interface User extends Partial<AppUserFields> {}
}

declare module "next-auth/jwt" {
  interface JWT extends Partial<AppUserFields> {}
}
