import {
  ClubSelectionMode,
  ParticipantStatus,
  PlayoffType,
  SeedingMethod,
  SortRule,
  TournamentFormat,
  TournamentStatus,
  UserRole,
} from "@prisma/client";
import { z } from "zod";

const optionalIntField = (minimum: number, maximum: number, message?: string) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      return value;
    },
    z.coerce
      .number()
      .min(minimum, message ?? `Значение должно быть не меньше ${minimum}.`)
      .max(maximum, `Значение должно быть не больше ${maximum}.`)
      .optional(),
  );

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
  favoriteTeam: z.string().optional().or(z.literal("")),
  bio: z.string().max(300).optional().or(z.literal("")),
  bannerImage: z
    .string()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"), {
      message: "Banner must be an image data URL or image URL",
    })
    .optional()
    .or(z.literal("")),
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
  coverImage: z
    .string()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"), {
      message: "Обложка должна быть картинкой или ссылкой на картинку.",
    })
    .optional()
    .or(z.literal("")),
});

export const securityPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль."),
    newPassword: z.string().min(8, "Новый пароль должен быть не короче 8 символов."),
    repeatPassword: z.string().min(8, "Повторите новый пароль."),
  })
  .refine((data) => data.newPassword === data.repeatPassword, {
    path: ["repeatPassword"],
    message: "Пароли не совпадают.",
  });

export const securityEmailSchema = z.object({
  email: z.string().email("Введите корректный email."),
});

export const securitySessionSchema = z.object({
  authSessionId: z.string().optional(),
  revokeAll: z.coerce.boolean().optional().default(false),
});

export const emailVerificationCodeSchema = z.object({
  code: z.string().trim().min(6, "Введите 6-значный код.").max(6, "Введите 6-значный код."),
});

export const tournamentBuilderSchema = z.object({
  title: z.string().min(3, "Название турнира должно быть не короче 3 символов."),
  description: z.string().min(20, "Описание турнира должно быть не короче 20 символов."),
  rules: z.string().min(20, "Правила турнира должны быть не короче 20 символов."),
  startsAt: z.string(),
  registrationEndsAt: z.string(),
  endsAt: z.string().optional().or(z.literal("")),
  maxParticipants: z.coerce.number().min(2, "Минимум 2 участника.").max(256, "Максимум 256 участников."),
  prizePool: z.string().optional().or(z.literal("")),
  format: z.nativeEnum(TournamentFormat),
  status: z.nativeEnum(TournamentStatus).default(TournamentStatus.DRAFT),
  coverImage: z
    .string()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"), {
      message: "Обложка должна быть картинкой или ссылкой на картинку.",
    })
    .optional()
    .or(z.literal("")),
  playoffType: z.nativeEnum(PlayoffType).optional().nullable(),
  seedingMethod: z.nativeEnum(SeedingMethod).default(SeedingMethod.MANUAL),
  roundsInLeague: optionalIntField(1, 4, "В лиге должен быть минимум 1 круг."),
  groupsCount: optionalIntField(1, 16, "Количество групп должно быть от 1 до 16."),
  participantsPerGroup: optionalIntField(2, 32, "В группе должно быть от 2 до 32 участников."),
  playoffTeamsPerGroup: optionalIntField(1, 8, "Из группы должно выходить от 1 до 8 участников."),
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
  clubSelectionMode: z.nativeEnum(ClubSelectionMode).default(ClubSelectionMode.ADMIN_RANDOM),
  sortRules: z.array(z.nativeEnum(SortRule)).default([SortRule.POINTS, SortRule.GOAL_DIFFERENCE, SortRule.GOALS_FOR, SortRule.WINS]),
}).superRefine((data, ctx) => {
  const isLeague = data.format === TournamentFormat.LEAGUE || data.format === TournamentFormat.ROUND_ROBIN;
  const isGroups = data.format === TournamentFormat.GROUPS || data.format === TournamentFormat.GROUPS_PLAYOFF;

  if (isLeague && !data.roundsInLeague) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["roundsInLeague"],
      message: "В лиге должен быть минимум 1 круг.",
    });
  }

  if (isGroups && !data.groupsCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["groupsCount"],
      message: "Для группового этапа нужно указать количество групп.",
    });
  }

  if (isGroups && !data.participantsPerGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["participantsPerGroup"],
      message: "Для группового этапа нужно указать количество участников в группе.",
    });
  }

  if (data.format === TournamentFormat.GROUPS_PLAYOFF && !data.playoffTeamsPerGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["playoffTeamsPerGroup"],
      message: "Нужно указать, сколько участников выходит из группы.",
    });
  }
});

export const resultSubmissionSchema = z.object({
  player1Score: z.coerce.number().min(0).max(99),
  player2Score: z.coerce.number().min(0).max(99),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
  comment: z.string().max(500).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "dispute"]),
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

export const playoffMappingSchema = z.object({
  bracketId: z.string(),
  mappings: z.array(
    z.object({
      round: z.coerce.number().min(1),
      matchNumber: z.coerce.number().min(1),
      slotNumber: z.coerce.number().min(1).max(2),
      sourceRef: z.string().optional().or(z.literal("")),
    }),
  ),
});

export const stageUpdateSchema = z.object({
  stageId: z.string(),
  name: z.string().min(2).optional(),
  status: z.enum(["DRAFT", "PENDING", "ACTIVE", "COMPLETED"]).optional(),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
});

export const stageReorderSchema = z.object({
  tournamentId: z.string(),
  stageIds: z.array(z.string()).min(1),
});

export const standingUpdateSchema = z.object({
  standingId: z.string(),
  rank: z.coerce.number().min(1).optional(),
  points: z.coerce.number().min(0).optional(),
  goalDifference: z.coerce.number().optional(),
  played: z.coerce.number().min(0).optional(),
  wins: z.coerce.number().min(0).optional(),
  draws: z.coerce.number().min(0).optional(),
  losses: z.coerce.number().min(0).optional(),
  goalsFor: z.coerce.number().min(0).optional(),
  goalsAgainst: z.coerce.number().min(0).optional(),
});

export const scheduleUpdateSchema = z.object({
  matchId: z.string(),
  startsAt: z.string(),
  endsAt: z.string().optional().or(z.literal("")),
  slotLabel: z.string().optional().or(z.literal("")),
  timezone: z.string().optional().or(z.literal("")),
});

export const matchUpdateSchema = z.object({
  player1Id: z.string().optional().or(z.literal("")),
  player2Id: z.string().optional().or(z.literal("")),
  participant1EntryId: z.string().optional().or(z.literal("")),
  participant2EntryId: z.string().optional().or(z.literal("")),
  scheduledAt: z.string().optional().or(z.literal("")),
  player1Score: z.coerce.number().min(0).max(99).optional(),
  player2Score: z.coerce.number().min(0).max(99).optional(),
  status: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const matchReorderSchema = z.object({
  matchIds: z.array(z.string()).min(1),
});

export const roleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const banSchema = z.object({
  isBanned: z.boolean(),
});
