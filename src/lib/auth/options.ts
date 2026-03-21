import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import VkProvider from "next-auth/providers/vk";
import { db } from "@/lib/db";
import { verifyTelegramAuth } from "@/lib/auth/telegram";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as never,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.passwordHash || user.isBanned) return null;
        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          image: user.image,
          name: user.name ?? user.nickname ?? user.email ?? "Player",
          role: user.role,
          nickname: user.nickname,
          efootballUid: user.efootballUid,
          isBanned: user.isBanned,
        };
      },
    }),
    CredentialsProvider({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: { label: "Telegram ID", type: "text" },
        first_name: { label: "First name", type: "text" },
        last_name: { label: "Last name", type: "text" },
        username: { label: "Username", type: "text" },
        photo_url: { label: "Photo", type: "text" },
        auth_date: { label: "Auth date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token || !credentials?.id || !credentials.hash || !credentials.auth_date) return null;

        const verified = verifyTelegramAuth(
          credentials as {
            id: string;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            auth_date: string;
            hash: string;
          },
          token,
        );

        if (!verified) return null;

        const displayName = [credentials.first_name, credentials.last_name].filter(Boolean).join(" ");

        const user = await db.user.upsert({
          where: { telegramId: credentials.id },
          update: {
            name: displayName || credentials.username || "Telegram Player",
            telegramUsername: credentials.username,
            image: credentials.photo_url,
          },
          create: {
            telegramId: credentials.id,
            telegramUsername: credentials.username,
            image: credentials.photo_url,
            name: displayName || credentials.username || "Telegram Player",
          },
        });

        return {
          id: user.id,
          email: user.email,
          image: user.image,
          name: user.name ?? "Telegram Player",
          role: user.role,
          nickname: user.nickname,
          efootballUid: user.efootballUid,
          isBanned: user.isBanned,
        };
      },
    }),
    VkProvider({
      clientId: process.env.VK_CLIENT_ID ?? "",
      clientSecret: process.env.VK_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return !user.isBanned;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.nickname = user.nickname;
        token.efootballUid = user.efootballUid;
        token.isBanned = user.isBanned;
      }

      if (token.sub) {
        const dbUser = await db.user.findUnique({ where: { id: token.sub } });
        if (dbUser) {
          token.role = dbUser.role;
          token.nickname = dbUser.nickname;
          token.efootballUid = dbUser.efootballUid;
          token.isBanned = dbUser.isBanned;
          token.picture = dbUser.image;
          token.name = dbUser.name ?? dbUser.nickname ?? token.name;
          token.email = dbUser.email ?? token.email;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "PLAYER";
        session.user.nickname = token.nickname;
        session.user.efootballUid = token.efootballUid;
        session.user.isBanned = Boolean(token.isBanned);
      }

      return session;
    },
  },
};
