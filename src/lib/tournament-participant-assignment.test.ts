import assert from "node:assert/strict";
import test from "node:test";
import {
  assignParticipantsByGroupCapacity,
  orderParticipantsByRating,
  resolveParticipantClub,
  shuffleParticipants,
} from "./tournament-participant-assignment";

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

test("rating seeding keeps the highest-rated entries together and assigns stable seed numbers", () => {
  const ordered = [
    { id: "first", groupId: null },
    { id: "second", groupId: null },
    { id: "third", groupId: null },
    { id: "fourth", groupId: null },
  ];

  assert.deepEqual(
    assignParticipantsByGroupCapacity(ordered, [
      { id: "group-a", capacity: 2 },
      { id: "group-b", capacity: 2 },
    ]),
    [
      { participant: ordered[0], groupId: "group-a", seed: 1 },
      { participant: ordered[1], groupId: "group-a", seed: 2 },
      { participant: ordered[2], groupId: "group-b", seed: 3 },
      { participant: ordered[3], groupId: "group-b", seed: 4 },
    ],
  );
});

test("manual seeding preserves valid group choices and fills only empty slots", () => {
  const participants = [
    { id: "manual-b", groupId: "group-b" },
    { id: "unassigned", groupId: null },
    { id: "manual-a", groupId: "group-a" },
  ];

  assert.deepEqual(
    assignParticipantsByGroupCapacity(
      participants,
      [
        { id: "group-a", capacity: 2 },
        { id: "group-b", capacity: 2 },
      ],
      { preserveExisting: true },
    ).map(({ participant, groupId }) => ({ id: participant.id, groupId })),
    [
      { id: "manual-b", groupId: "group-b" },
      { id: "unassigned", groupId: "group-a" },
      { id: "manual-a", groupId: "group-a" },
    ],
  );
});

test("random seeding uses a Fisher-Yates shuffle without mutating registration order", () => {
  const participants = ["first", "second", "third", "fourth"];
  const randomValues = [0.1, 0.8, 0.4];

  assert.deepEqual(shuffleParticipants(participants, () => randomValues.shift() ?? 0), [
    "second",
    "fourth",
    "third",
    "first",
  ]);
  assert.deepEqual(participants, ["first", "second", "third", "fourth"]);
});
