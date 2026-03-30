import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      nickname?: string | null;
      efootballUid?: string | null;
      isBanned: boolean;
      authSessionId?: string | null;
    };
  }

  interface User {
    role?: UserRole;
    nickname?: string | null;
    efootballUid?: string | null;
    isBanned?: boolean;
    authSessionId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    nickname?: string | null;
    efootballUid?: string | null;
    isBanned?: boolean;
    authSessionId?: string | null;
  }
}
