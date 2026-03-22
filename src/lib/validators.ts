import {
  ParticipantStatus,
  PlayoffType,
  SeedingMethod,
  SortRule,
  TournamentFormat,
  TournamentStatus,
  UserRole,
} from "@prisma/client";
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
  image: z
    .string()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"), {
      message: "Avatar must be an image data URL or image URL",
    })
    .optional()
    .or(z.literal("")),
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

export const tournamentBuilderSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  rules: z.string().min(20),
  startsAt: z.string(),
  registrationEndsAt: z.string(),
  endsAt: z.string().optional().or(z.literal("")),
  maxParticipants: z.coerce.number().min(2).max(256),
  prizePool: z.string().optional().or(z.literal("")),
  format: z.nativeEnum(TournamentFormat),
  status: z.nativeEnum(TournamentStatus).default(TournamentStatus.DRAFT),
  coverImage: z.string().url().optional().or(z.literal("")),
  playoffType: z.nativeEnum(PlayoffType).optional().nullable(),
  seedingMethod: z.nativeEnum(SeedingMethod).default(SeedingMethod.MANUAL),
  roundsInLeague: z.coerce.number().min(1).max(4).default(1),
  groupsCount: z.coerce.number().min(1).max(16).optional().nullable(),
  participantsPerGroup: z.coerce.number().min(2).max(32).optional().nullable(),
  playoffTeamsPerGroup: z.coerce.number().min(1).max(8).optional().nullable(),
  pointsForWin: z.coerce.number().min(0).max(10).default(3),
  pointsForDraw: z.coerce.number().min(0).max(10).default(1),
  pointsForLoss: z.coerce.number().min(0).max(10).default(0),
  autoCreateMatches: z.coerce.boolean().default(true),
  autoCreateStages: z.coerce.boolean().default(true),
  autoCreateSchedule: z.coerce.boolean().default(false),
  autoAdvanceFromGroups: z.coerce.boolean().default(false),
  manualBracketControl: z.coerce.boolean().default(false),
  manualPlayoffSelection: z.coerce.boolean().default(false),
  checkInRequired: z.coerce.boolean().default(false),
  sortRules: z.array(z.nativeEnum(SortRule)).default([SortRule.POINTS, SortRule.GOAL_DIFFERENCE, SortRule.GOALS_FOR, SortRule.WINS]),
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

export const stageGenerationSchema = z.object({
  regenerate: z.coerce.boolean().optional().default(false),
});

export const participantManageSchema = z.object({
  action: z.enum(["add", "remove", "replace", "seed", "status"]),
  userId: z.string().optional(),
  registrationId: z.string().optional(),
  replacementUserId: z.string().optional(),
  groupId: z.string().optional().or(z.literal("")),
  seed: z.coerce.number().optional(),
  status: z.nativeEnum(ParticipantStatus).optional(),
});

export const groupAssignmentSchema = z.object({
  mode: z.enum(["auto", "manual"]),
  assignments: z
    .array(
      z.object({
        registrationId: z.string(),
        groupId: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export const bracketSlotSchema = z.object({
  bracketId: z.string(),
  round: z.coerce.number().min(1),
  matchNumber: z.coerce.number().min(1),
  slotNumber: z.coerce.number().min(1).max(2),
  participantId: z.string().nullable().optional(),
  sourceType: z.string().optional().or(z.literal("")),
  sourceRef: z.string().optional().or(z.literal("")),
});

export const roleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const banSchema = z.object({
  isBanned: z.boolean(),
});
