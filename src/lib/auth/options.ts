import { randomUUID } from "crypto";
import { LoginAttemptStatus, UserRole } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare, hash } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import VkProvider from "next-auth/providers/vk";
import { buildSecurityContext, createLoginHistory, createSecuritySession, touchSecuritySession } from "@/lib/auth/security";
import { db } from "@/lib/db";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { generateFallbackNickname } from "@/lib/player-name";
import { verifyTwoFactorChallenge } from "@/lib/two-factor";

const TELEGRAM_ADMIN_ID = "6595067194";
const hasVkCredentials = Boolean(process.env.VK_CLIENT_ID && process.env.VK_CLIENT_SECRET);
const canonicalBaseUrl = process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, "");
const vkRedirectUri = process.env.VK_REDIRECT_URI?.trim() || (canonicalBaseUrl ? `${canonicalBaseUrl}/api/auth/callback/vk` : undefined);
const vkApiVersion = "5.131";

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
        twoFactorCode: { label: "2FA Code", type: "text" },
        challengeToken: { label: "2FA Challenge", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const rawPassword = credentials.password;
        const trimmedPassword = rawPassword.trim();
        const context = buildSecurityContext(req?.headers);

        const user = await db.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: "insensitive",
            },
          },
        });

        if (!user?.passwordHash || user.isBanned) {
          await createLoginHistory({
            userId: user?.id,
            email: normalizedEmail,
            status: LoginAttemptStatus.FAILED,
            context,
          });
          return null;
        }

        const passwordCandidates = Array.from(new Set([rawPassword, trimmedPassword].filter(Boolean)));
        let isValid = false;
        let matchedPassword = rawPassword;

        if (user.passwordHash.startsWith("$2")) {
          for (const candidate of passwordCandidates) {
            if (await compare(candidate, user.passwordHash)) {
              isValid = true;
              matchedPassword = candidate;
              break;
            }
          }
        } else {
          for (const candidate of passwordCandidates) {
            if (candidate === user.passwordHash) {
              isValid = true;
              matchedPassword = candidate;
              await db.user.update({
                where: { id: user.id },
                data: {
                  passwordHash: await hash(candidate, 10),
                },
              });
              break;
            }
          }
        }

        if (!isValid) {
          await createLoginHistory({
            userId: user.id,
            email: normalizedEmail,
            status: LoginAttemptStatus.FAILED,
            context,
          });
          return null;
        }

        if (user.telegram2faEnabled) {
          if (!credentials.twoFactorCode || !credentials.challengeToken) {
            return null;
          }

          const verifiedChallenge = await verifyTwoFactorChallenge({
            userId: user.id,
            token: credentials.challengeToken,
            code: credentials.twoFactorCode,
            purpose: "LOGIN",
          });

          if (!verifiedChallenge) {
            return null;
          }
        }

        if (matchedPassword !== rawPassword) {
          await db.user.update({
            where: { id: user.id },
            data: {
              passwordHash: await hash(matchedPassword, 10),
            },
          });
        }

        const authSessionId = await createSecuritySession({
          userId: user.id,
          context,
        });

        await createLoginHistory({
          userId: user.id,
          email: normalizedEmail,
          status: LoginAttemptStatus.SUCCESS,
          context,
        });

        return {
          id: user.id,
          email: user.email,
          image: user.image,
          name: user.name ?? user.nickname ?? user.email ?? "Player",
          role: user.role,
          nickname: user.nickname,
          efootballUid: user.efootballUid,
          isBanned: user.isBanned,
          authSessionId,
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
      async authorize(credentials, req) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token || !credentials?.id || !credentials.hash || !credentials.auth_date) return null;
        const context = buildSecurityContext(req?.headers);

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
        const role = credentials.id === TELEGRAM_ADMIN_ID ? UserRole.ADMIN : UserRole.PLAYER;
        const fallbackNickname = generateFallbackNickname(credentials.id);

        const user = await db.user.upsert({
          where: { telegramId: credentials.id },
          update: {
            name: displayName || credentials.username || "Telegram Player",
            nickname: credentials.username || fallbackNickname,
            telegramUsername: credentials.username,
            image: credentials.photo_url,
            role,
          },
          create: {
            telegramId: credentials.id,
            telegramUsername: credentials.username,
            image: credentials.photo_url,
            name: displayName || credentials.username || "Telegram Player",
            nickname: credentials.username || fallbackNickname,
            role,
          },
        });

        const authSessionId = await createSecuritySession({
          userId: user.id,
          context,
        });

        await createLoginHistory({
          userId: user.id,
          email: user.email,
          status: LoginAttemptStatus.SUCCESS,
          context,
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
          authSessionId,
        };
      },
    }),
    ...(hasVkCredentials
      ? [
          VkProvider({
            clientId: process.env.VK_CLIENT_ID!,
            clientSecret: process.env.VK_CLIENT_SECRET!,
            authorization: vkRedirectUri
              ? {
                  url: `https://oauth.vk.ru/authorize?scope=email&v=${vkApiVersion}`,
                  params: {
                    redirect_uri: vkRedirectUri,
                  },
                }
              : `https://oauth.vk.ru/authorize?scope=email&v=${vkApiVersion}`,
            token: `https://oauth.vk.ru/access_token?v=${vkApiVersion}`,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "vk" && user.id && account.providerAccountId) {
        const authSessionId = randomUUID();
        await db.user.update({
          where: { id: user.id },
          data: { vkId: account.providerAccountId },
        });
        await createSecuritySession({
          userId: user.id,
          authSessionId,
          context: {
            device: "VK OAuth",
            platform: "VK",
            location: "Не определено",
            ipAddress: null,
            userAgent: "VK OAuth",
          },
        });
        await createLoginHistory({
          userId: user.id,
          email: user.email,
          status: LoginAttemptStatus.SUCCESS,
          context: {
            device: "VK OAuth",
            platform: "VK",
            location: "Не определено",
            ipAddress: null,
            userAgent: "VK OAuth",
          },
        });
        user.authSessionId = authSessionId;
      }

      return !user.isBanned;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.nickname = user.nickname;
        token.efootballUid = user.efootballUid;
        token.isBanned = user.isBanned;
        token.authSessionId = user.authSessionId ?? token.authSessionId;
      }

      if (token.sub) {
        if (!token.authSessionId) {
          token.authSessionId = await createSecuritySession({
            userId: token.sub,
            authSessionId: randomUUID(),
            context: {
              device: "Текущее устройство",
              platform: "Не определено",
              location: "Не определено",
              ipAddress: null,
              userAgent: "Unknown",
            },
          });
        }

        if (token.authSessionId) {
          const activeSession = await db.securitySession.findUnique({
            where: { authSessionId: token.authSessionId },
          });

          if (!activeSession || activeSession.revokedAt) {
            return {} as typeof token;
          }

          await touchSecuritySession(token.authSessionId);
        }

        const dbUser = await db.user.findUnique({ where: { id: token.sub } });
        if (dbUser) {
          if (!dbUser.nickname?.trim()) {
            const generatedNickname = generateFallbackNickname(dbUser.id);
            await db.user.update({
              where: { id: dbUser.id },
              data: { nickname: generatedNickname },
            });
            dbUser.nickname = generatedNickname;
          }

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
        session.user.authSessionId = token.authSessionId;
      }

      return session;
    },
  },
};
