import { randomUUID } from "crypto";
import { LoginAttemptStatus } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare, hash } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { buildSecurityContext, createLoginHistory, createSecuritySession, touchSecuritySession } from "@/lib/auth/security";
import { fetchVkUserProfile } from "@/lib/auth/vk";
import { db } from "@/lib/db";
import { getLegalAcceptanceData, isLegalAccepted } from "@/lib/legal-acceptance";
import { formatPhoneNumber, normalizeAuthIdentifier } from "@/lib/phone";
import { generateUniquePublicPlayerId } from "@/lib/public-player-id";

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
      name: "Phone",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.phone || !credentials.password) return null;

        const parsedIdentifier = normalizeAuthIdentifier(credentials.phone);
        if (parsedIdentifier.type === "unknown") return null;
        const rawPassword = credentials.password;
        const trimmedPassword = rawPassword.trim();
        const context = buildSecurityContext(req?.headers);

        const user = await db.user.findFirst({
          where:
            parsedIdentifier.type === "email"
              ? {
                  email: {
                    equals: parsedIdentifier.value,
                    mode: "insensitive",
                  },
                }
              : {
                  phone: parsedIdentifier.value,
                },
        });

        if (!user?.passwordHash || user.isBanned) {
          await createLoginHistory({
            userId: user?.id,
            identifier: parsedIdentifier.value,
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
            identifier: parsedIdentifier.value,
            status: LoginAttemptStatus.FAILED,
            context,
          });
          return null;
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
          identifier: parsedIdentifier.value,
          status: LoginAttemptStatus.SUCCESS,
          context,
        });

        return {
          id: user.id,
          email: user.email,
          image: user.image,
          name: (user.name ?? user.nickname ?? formatPhoneNumber(user.phone)) || user.email || "Player",
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
