import { randomUUID } from "crypto";
import { LoginAttemptStatus, UserRole } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare, hash } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { buildSecurityContext, createLoginHistory, createSecuritySession, touchSecuritySession } from "@/lib/auth/security";
import { fetchVkUserProfile } from "@/lib/auth/vk";
import { db } from "@/lib/db";
import { getLegalAcceptanceData, isLegalAccepted } from "@/lib/legal-acceptance";
import { generateFallbackNickname } from "@/lib/player-name";
import { generateUniquePublicPlayerId } from "@/lib/public-player-id";
import { finalizeTelegramBotLogin, logTelegramBotAuth } from "@/lib/telegram-bot-auth";
import { describeTelegramOidcError, verifyAndConsumeTelegramIdToken } from "@/lib/telegram-oidc-server";
import { verifyTwoFactorChallenge } from "@/lib/two-factor";

const TELEGRAM_ADMIN_ID = "6595067194";
const FALLBACK_SECURITY_CONTEXT = {
  device: "Текущее устройство",
  platform: "Не определено",
  location: "Не определено",
  ipAddress: null,
  userAgent: "Неизвестное устройство",
};

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
        legalAccepted: { label: "Legal Accepted", type: "text" },
      },
      async authorize(credentials, req) {
        const accessToken = credentials?.accessToken?.trim();
        if (!accessToken) return null;

        const context = buildSecurityContext(req?.headers);
        const acceptedLegalDocuments = isLegalAccepted(credentials?.legalAccepted);
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
              ...(!user.legalAcceptedAt && acceptedLegalDocuments ? getLegalAcceptanceData(req?.headers) : {}),
            },
          });
        } else {
          if (!acceptedLegalDocuments) return null;

          user = await db.user.create({
            data: {
              publicId: await generateUniquePublicPlayerId(),
              vkId: vkProfile.vkId,
              email: vkProfile.email,
              name: vkProfile.fullName ?? "VK Player",
              image: vkProfile.avatar,
              ...getLegalAcceptanceData(req?.headers),
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
        idToken: { label: "Telegram ID Token", type: "text" },
        legalAccepted: { label: "Legal Accepted", type: "text" },
      },
      async authorize(credentials, req) {
        const context = buildSecurityContext(req?.headers);
        const idToken = credentials?.idToken?.trim();
        if (!idToken) {
          console.warn("[telegram-auth] missing-id-token");
          return null;
        }

        let profile;
        try {
          profile = await verifyAndConsumeTelegramIdToken(idToken);
        } catch (error) {
          const described = describeTelegramOidcError(error);
          console.warn("[telegram-auth] id-token-verification-failed", {
            error: described.message,
            cause: described.cause,
          });
          return null;
        }

        const telegramId = profile.telegramId.trim();
        const telegramUsername = profile.username?.trim() || generateFallbackNickname(telegramId);
        const role = telegramId === TELEGRAM_ADMIN_ID ? UserRole.FOUNDER : UserRole.PLAYER;
        const existingRoleUpdate = telegramId === TELEGRAM_ADMIN_ID ? UserRole.FOUNDER : undefined;
        const acceptedLegalDocuments = isLegalAccepted(credentials?.legalAccepted);

        let user = await db.user.findUnique({
          where: { telegramId },
        });

        if (user) {
          if (user.isBanned) {
            console.warn("[telegram-auth] banned-user", { telegramId, userId: user.id });
            await createLoginHistory({
              userId: user.id,
              email: user.email,
              status: LoginAttemptStatus.FAILED,
              context,
            });
            return null;
          }

          user = await db.user.update({
            where: { id: user.id },
            data: {
              name: undefined,
              telegramUsername: profile.username ?? null,
              image: profile.picture || undefined,
              role: existingRoleUpdate,
              ...(!user.legalAcceptedAt && acceptedLegalDocuments ? getLegalAcceptanceData(req?.headers) : {}),
            },
          });
          console.info("[telegram-auth] updated-existing-user", { telegramId, userId: user.id });
        } else {
          if (!acceptedLegalDocuments) {
            console.warn("[telegram-auth] legal-acceptance-required", { telegramId });
            return null;
          }

          user = await db.user.create({
            data: {
              publicId: await generateUniquePublicPlayerId(),
              telegramId,
              telegramUsername: profile.username ?? null,
              image: profile.picture || undefined,
              name: telegramUsername,
              role,
              ...getLegalAcceptanceData(req?.headers),
            },
          });
          console.info("[telegram-auth] created-user", { telegramId, userId: user.id });
        }

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

        console.info("[telegram-auth] authorize-success", {
          telegramId,
          userId: user.id,
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
    CredentialsProvider({
      id: "telegram-bot",
      name: "Telegram Bot",
      credentials: {
        token: { label: "Login Token", type: "text" },
        legalAccepted: { label: "Legal Accepted", type: "text" },
      },
      async authorize(credentials, req) {
        const loginToken = credentials?.token?.trim();
        if (!loginToken) return null;
        const context = buildSecurityContext(req?.headers);
        const legalAcceptanceData = getLegalAcceptanceData(req?.headers);

        try {
          return await finalizeTelegramBotLogin(
            {
              db,
              createLoginHistory,
              createSecuritySession,
              generateUniquePublicPlayerId,
              getLegalAcceptanceData: () => legalAcceptanceData,
            },
            {
              loginToken,
              legalAcceptedFallback: isLegalAccepted(credentials?.legalAccepted),
              context,
            },
          );
        } catch (error) {
          logTelegramBotAuth("login-failure", {
            token: loginToken,
            reason: "authorize-telegram-bot-exception",
            error: error instanceof Error ? error.message : "unknown-error",
          });
          return null;
        }
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
        token.telegramUsername = user.telegramUsername;
        token.isBanned = user.isBanned;
        token.authSessionId = user.authSessionId ?? token.authSessionId;
      }

      if (token.sub) {
        const dbUser = await db.user.findUnique({ where: { id: token.sub } });

        if (!dbUser || dbUser.isBanned) {
          return {} as typeof token;
        }

        if (!token.authSessionId) {
          token.authSessionId = await createSecuritySession({
            userId: token.sub,
            authSessionId: randomUUID(),
            context: FALLBACK_SECURITY_CONTEXT,
          });
        }

        if (token.authSessionId) {
          const activeSession = await db.securitySession.findUnique({
            where: { authSessionId: token.authSessionId },
          });

          if (!activeSession || activeSession.revokedAt || activeSession.userId !== token.sub) {
            return {} as typeof token;
          } else {
            await touchSecuritySession(token.authSessionId);
          }
        }

        if (dbUser) {
          token.role = dbUser.role;
          token.nickname = dbUser.nickname;
          token.efootballUid = dbUser.efootballUid;
          token.telegramUsername = dbUser.telegramUsername;
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
        session.user.telegramUsername = token.telegramUsername;
        session.user.isBanned = Boolean(token.isBanned);
        session.user.authSessionId = token.authSessionId;
      }

      return session;
    },
  },
};
