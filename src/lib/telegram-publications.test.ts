import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterTelegramAudience,
  hashTelegramRichMessage,
  resolveTelegramPublicationAction,
  type TelegramAudienceCandidate,
} from "@/lib/telegram-publications";

describe("Telegram publication decisions", () => {
  it("hashes semantically identical content deterministically", () => {
    const message = {
      blocks: [{ type: "paragraph" as const, text: "Матч завершён" }],
      fallbackText: "Матч завершён",
      buttons: [{ text: "Открыть", url: "https://nexon.example/match", row: 1 }],
    };

    const first = hashTelegramRichMessage(message);
    const second = hashTelegramRichMessage(structuredClone(message));
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(first, second);
  });

  it("sends, edits or skips based on persisted publication state", () => {
    assert.equal(resolveTelegramPublicationAction({ nextContentHash: "new" }), "send");
    assert.equal(
      resolveTelegramPublicationAction({ existingMessageId: "45", existingContentHash: "old", nextContentHash: "new" }),
      "edit",
    );
    assert.equal(
      resolveTelegramPublicationAction({ existingMessageId: "45", existingContentHash: "same", nextContentHash: "same" }),
      "skip",
    );
  });
});

describe("Telegram broadcast audiences", () => {
  const candidates: TelegramAudienceCandidate[] = [
    { userId: "all", telegramId: "100" },
    { userId: "participant", telegramId: "101", participantTournamentIds: ["cup"] },
    { userId: "group", telegramId: "102", participantTournamentIds: ["cup"], groupIds: ["group-a"] },
    { userId: "applicant", telegramId: "103", applicantTournamentIds: ["cup"] },
    { userId: "unresolved", telegramId: "104", unresolvedTournamentIds: ["cup"] },
    { userId: "blocked", telegramId: "105", isBanned: true, participantTournamentIds: ["cup"] },
    { userId: "unlinked", telegramId: null, participantTournamentIds: ["cup"] },
  ];

  it("filters every supported audience without banned or unlinked recipients", () => {
    assert.deepEqual(filterTelegramAudience({ scope: "all", candidates }).map((item) => item.userId), [
      "all",
      "participant",
      "group",
      "applicant",
      "unresolved",
    ]);
    assert.deepEqual(
      filterTelegramAudience({ scope: "participants", tournamentId: "cup", candidates }).map((item) => item.userId),
      ["participant", "group"],
    );
    assert.deepEqual(
      filterTelegramAudience({ scope: "group", tournamentId: "cup", groupId: "group-a", candidates }).map((item) => item.userId),
      ["group"],
    );
    assert.deepEqual(
      filterTelegramAudience({ scope: "applicants", tournamentId: "cup", candidates }).map((item) => item.userId),
      ["applicant"],
    );
    assert.deepEqual(
      filterTelegramAudience({ scope: "unresolved", tournamentId: "cup", candidates }).map((item) => item.userId),
      ["unresolved"],
    );
  });
});
