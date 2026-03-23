import { AdminActionType, MatchResultStatus, MatchStatus, ParticipantStatus, PlayoffType, StageStatus, StageType, TournamentFormat, TournamentStatus } from "@prisma/client";

export const matchStatusLabel: Record<MatchStatus, string> = {
  PENDING: "Не назначен",
  READY: "Готов",
  RESULT_SUBMITTED: "Ожидает результат",
  CONFIRMED: "Подтверждён",
  REJECTED: "Отклонён",
  FORFEIT: "Техпоражение",
  SCHEDULED: "Запланирован",
  LIVE: "Идёт сейчас",
  DISPUTED: "Спорный",
  FINISHED: "Завершён",
};

export const tournamentStatusLabel: Record<TournamentStatus, string> = {
  DRAFT: "Черновик",
  REGISTRATION_OPEN: "Регистрация открыта",
  REGISTRATION_CLOSED: "Регистрация закрыта",
  IN_PROGRESS: "Идёт",
  COMPLETED: "Завершён",
};

export const tournamentFormatLabel: Record<TournamentFormat, string> = {
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  ROUND_ROBIN: "Round Robin",
  LEAGUE: "Лига",
  GROUPS: "Группы",
  GROUPS_PLAYOFF: "Группы + плей-офф",
};

export const playoffTypeLabel: Record<PlayoffType, string> = {
  SINGLE: "Single Elimination",
  DOUBLE: "Double Elimination",
};

export const stageStatusLabel: Record<StageStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "Ожидает",
  ACTIVE: "Активен",
  COMPLETED: "Завершён",
};

export const stageTypeLabel: Record<StageType, string> = {
  LEAGUE: "Лига",
  GROUP_STAGE: "Группы",
  PLAYOFF: "Плей-офф",
};

export const participantStatusLabel: Record<ParticipantStatus, string> = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждён",
  WAITLIST: "Лист ожидания",
  REJECTED: "Отклонён",
  REMOVED: "Удалён",
};

export const resultSubmissionLabel: Record<MatchResultStatus, string> = {
  PENDING: "Ожидает проверки",
  CONFIRMED: "Подтверждён",
  REJECTED: "Отклонён",
  DISPUTED: "В споре",
};

export const resultSubmissionVariant: Record<MatchResultStatus, "primary" | "accent" | "neutral" | "success" | "danger"> = {
  PENDING: "accent",
  CONFIRMED: "success",
  REJECTED: "danger",
  DISPUTED: "danger",
};

export const adminActionLabel: Record<AdminActionType, string> = {
  CREATE: "Создание",
  UPDATE: "Обновление",
  DELETE: "Удаление",
  PUBLISH: "Публикация",
  GENERATE: "Генерация",
  APPROVE: "Подтверждение",
  REJECT: "Отклонение",
  RESCHEDULE: "Перенос",
  FORFEIT: "Техпоражение",
};

export const matchStatusVariant: Partial<Record<MatchStatus, "primary" | "accent" | "neutral" | "success" | "danger">> = {
  PENDING: "neutral",
  READY: "primary",
  RESULT_SUBMITTED: "accent",
  CONFIRMED: "success",
  REJECTED: "danger",
  FORFEIT: "danger",
  SCHEDULED: "primary",
  LIVE: "accent",
  DISPUTED: "danger",
  FINISHED: "success",
};

export const tournamentStatusVariant: Record<TournamentStatus, "primary" | "accent" | "neutral" | "success" | "danger"> = {
  DRAFT: "neutral",
  REGISTRATION_OPEN: "primary",
  REGISTRATION_CLOSED: "accent",
  IN_PROGRESS: "success",
  COMPLETED: "neutral",
};
