import { TournamentFormat, TournamentStatus, UserRole } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const profileSchema = z.object({
  nickname: z.string().min(2),
  efootballUid: z.string().min(4),
  favoriteTeam: z.string().optional().or(z.literal("")),
  image: z.string().url().optional().or(z.literal("")),
});

export const tournamentSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  rules: z.string().min(20),
  startsAt: z.string(),
  registrationEndsAt: z.string(),
  maxParticipants: z.coerce.number().min(2).max(128),
  prizePool: z.string().optional().or(z.literal("")),
  format: z.nativeEnum(TournamentFormat),
  status: z.nativeEnum(TournamentStatus).default(TournamentStatus.REGISTRATION_OPEN),
  coverImage: z.string().url().optional().or(z.literal("")),
});

export const resultSubmissionSchema = z.object({
  player1Score: z.coerce.number().min(0).max(99),
  player2Score: z.coerce.number().min(0).max(99),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
  comment: z.string().max(500).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  moderatorComment: z.string().min(3),
});

export const roleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const banSchema = z.object({
  isBanned: z.boolean(),
});
