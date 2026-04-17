import { randomUUID } from "crypto";
import { LoginAttemptStatus, UserRole } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare, hash } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { buildSecurityContext, createLoginHistory, createSecuritySession, touchSecuritySession } from "@/lib/auth/security";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { fetchVkUserProfile } from "@/lib/auth/vk";
import { db } from "@/lib/db";
import { generateFallbackNickname } from "@/lib/player-name";
import { verifyTwoFactorChallenge } from "@/lib/two-factor";

const TELEGRAM_ADMIN_ID = "6595067194";

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
      id: "vkid",
      name: "VK ID",
      credentials: {
        accessToken: { label: "VK Access Token", type: "text" },
      },
      async authorize(credentials, req) {
        const accessToken = credentials?.accessToken?.trim();
        if (!accessToken) return null;

        const context = buildSecurityContext(req?.headers);
        const vkProfile = await fetchVkUserProfile(accessToken);

        let user = await db.user.findUnique({
          where: { vkId: vkProfile.vkId },
        });

        if (!user && vkProfile.email) {
          user = await db.user.findFirst({
            where: {
              email: {
                equals: vkProfile.email,
                mode: "insensitive",
              },
            },
          });
        }

        if (user) {
          if (user.isBanned) {
            await createLoginHistory({
              userId: user.id,
              email: user.email ?? vkProfile.email,
              status: LoginAttemptStatus.FAILED,
              context,
            });
            return null;
          }

          user = await db.user.update({
            where: { id: user.id },
            data: {
              vkId: user.vkId ?? vkProfile.vkId,
              email: user.email ?? vkProfile.email ?? undefined,
              name: user.name?.trim() ? user.name : vkProfile.fullName ?? undefined,
              image: user.image ?? vkProfile.avatar ?? undefined,
            },
          });
        } else {
          user = await db.user.create({
            data: {
              vkId: vkProfile.vkId,
              email: vkProfile.email,
              name: vkProfile.fullName ?? "VK Player",
              image: vkProfile.avatar,
            },
          });
        }

        const authSessionId = await createSecuritySession({
          userId: user.id,
          context,
        });

        await createLoginHistory({
          userId: user.id,
          email: user.email ?? vkProfile.email,
          status: LoginAttemptStatus.SUCCESS,
          context,
        });

        return {
          id: user.id,
          email: user.email,
          image: user.image,
          name: user.name ?? user.nickname ?? "VK Player",
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

        const telegramUsername = credentials.username?.trim() || generateFallbackNickname(credentials.id);
        const role = credentials.id === TELEGRAM_ADMIN_ID ? UserRole.ADMIN : UserRole.PLAYER;

        const user = await db.user.upsert({
          where: { telegramId: credentials.id },
          update: {
            name: undefined,
            telegramUsername: credentials.username,
            image: credentials.photo_url,
            role,
          },
          create: {
            telegramId: credentials.id,
            telegramUsername: credentials.username,
            image: credentials.photo_url,
            name: telegramUsername,
            role,
          },
        });

        const normalizedCurrentName = user.name?.trim() || "";
        if (!normalizedCurrentName) {
          await db.user.update({
            where: { id: user.id },
            data: {
              name: telegramUsername,
            },
          });
          user.name = telegramUsername;
        }

        if (user.isBanned) {
          await createLoginHistory({
            userId: user.id,
            email: user.email,
            status: LoginAttemptStatus.FAILED,
            context,
          });
          return null;
        }

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
        token.authSessionId = user.authSessionId ?? token.authSessionId;
      }

      if (token.sub) {
        if (!token.authSessionId) {
          token.authSessionId = await createSecuritySession({
            userId: token.sub,
            authSessionId: randomUUID(),
            context: {
              device: "РўРµРєСѓС‰РµРµ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ",
              platform: "РќРµ РѕРїСЂРµРґРµР»РµРЅРѕ",
              location: "РќРµ РѕРїСЂРµРґРµР»РµРЅРѕ",
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
