import crypto from "node:crypto";
import type { TelegramRichMessageDraft } from "@/lib/telegram-rich";

export type TelegramPublicationAction = "send" | "edit" | "skip";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashTelegramRichMessage(message: TelegramRichMessageDraft) {
  return crypto.createHash("sha256").update(stableSerialize(message)).digest("hex");
}

export function resolveTelegramPublicationAction(params: {
  existingMessageId?: string | null;
  existingContentHash?: string | null;
  nextContentHash: string;
}): TelegramPublicationAction {
  if (!params.existingMessageId) return "send";
  return params.existingContentHash === params.nextContentHash ? "skip" : "edit";
}

export type TelegramAudienceScope = "all" | "participants" | "group" | "applicants" | "unresolved";

export type TelegramAudienceCandidate = {
  userId: string;
  telegramId: string | null;
  isBanned?: boolean;
  participantTournamentIds?: string[];
  groupIds?: string[];
  applicantTournamentIds?: string[];
  unresolvedTournamentIds?: string[];
};

export function filterTelegramAudience(params: {
  scope: TelegramAudienceScope;
  tournamentId?: string;
  groupId?: string;
  candidates: TelegramAudienceCandidate[];
}) {
  const seenTelegramIds = new Set<string>();

  return params.candidates.flatMap((candidate) => {
    const telegramId = candidate.telegramId?.trim();
    if (!telegramId || candidate.isBanned || seenTelegramIds.has(telegramId)) return [];

    const inScope =
      params.scope === "all" ||
      (params.scope === "participants" && Boolean(params.tournamentId && candidate.participantTournamentIds?.includes(params.tournamentId))) ||
      (params.scope === "group" && Boolean(
        params.tournamentId &&
        params.groupId &&
        candidate.participantTournamentIds?.includes(params.tournamentId) &&
        candidate.groupIds?.includes(params.groupId),
      )) ||
      (params.scope === "applicants" && Boolean(params.tournamentId && candidate.applicantTournamentIds?.includes(params.tournamentId))) ||
      (params.scope === "unresolved" && Boolean(params.tournamentId && candidate.unresolvedTournamentIds?.includes(params.tournamentId)));

    if (!inScope) return [];
    seenTelegramIds.add(telegramId);
    return [{ userId: candidate.userId, telegramId }];
  });
}
