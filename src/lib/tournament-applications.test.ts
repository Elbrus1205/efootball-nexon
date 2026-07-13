import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applicationDecisionSchema,
  isLineupPhotoStorageUrl,
  participantStatusAfterApplicationApproval,
} from "@/lib/tournament-applications";

describe("tournament registration applications", () => {
  it("requires a clear reason when an application is rejected", () => {
    assert.equal(applicationDecisionSchema.safeParse({ action: "reject", reason: "" }).success, false);
    assert.equal(
      applicationDecisionSchema.safeParse({ action: "reject", reason: "Скриншот не показывает полный состав." }).success,
      true,
    );
  });

  it("accepts lineup photos only from the configured storage folder", () => {
    const storage = "https://project.supabase.co";
    assert.equal(
      isLineupPhotoStorageUrl(
        "https://project.supabase.co/storage/v1/object/public/public-media/lineups/photo.webp",
        storage,
      ),
      true,
    );
    assert.equal(isLineupPhotoStorageUrl("https://tracker.example/photo.webp", storage), false);
    assert.equal(
      isLineupPhotoStorageUrl(
        "https://project.supabase.co/storage/v1/object/public/public-media/tournaments/photo.webp",
        storage,
      ),
      false,
    );
  });

  it("confirms solo players but preserves roster assembly for team modes", () => {
    assert.equal(
      participantStatusAfterApplicationApproval("SINGLE"),
      "CONFIRMED",
    );
    assert.equal(
      participantStatusAfterApplicationApproval("COOP"),
      "PENDING",
    );
    assert.equal(
      participantStatusAfterApplicationApproval("TEAM"),
      "PENDING",
    );
  });
});
