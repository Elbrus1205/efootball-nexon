import assert from "node:assert/strict";
import test from "node:test";
import { orderParticipantsByRating, resolveParticipantClub } from "./tournament-participant-assignment";

const clubs = [
  { slug: "arsenal", name: "Арсенал", imagePath: "/club-badges/thumbs/arsenal.webp" },
  { slug: "barcelona", name: "Барселона", imagePath: "/club-badges/thumbs/barcelona.webp" },
];

test("admin participant club selection uses canonical club data", () => {
  assert.deepEqual(resolveParticipantClub(" arsenal ", clubs), {
    clubSlug: "arsenal",
    clubName: "Арсенал",
    clubBadgePath: "/club-badges/thumbs/arsenal.webp",
  });
});

test("admin participant club selection rejects an empty or unknown club", () => {
  assert.throws(() => resolveParticipantClub("", clubs), /Выберите клуб/);
  assert.throws(() => resolveParticipantClub("unknown", clubs), /Клуб не найден/);
});

test("rating group assignment orders entries by the average roster rating", () => {
  const entries = [
    { id: "one", userId: "one", rosterMembers: [{ userId: "one" }, { userId: "two" }] },
    { id: "three", userId: "three", rosterMembers: [] },
    { id: "four", userId: "four", rosterMembers: [{ userId: "four" }, { userId: "five" }] },
  ];
  const ratings = new Map([
    ["one", 900],
    ["two", 700],
    ["three", 850],
    ["four", 1000],
    ["five", 800],
  ]);

  assert.deepEqual(orderParticipantsByRating(entries, ratings).map((entry) => entry.id), ["four", "three", "one"]);
});
