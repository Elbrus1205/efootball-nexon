import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as prisma from "@prisma/client";
import { NextResponse } from "next/server";
import { participantManageSchema } from "../validators";
import { resolveParticipantClub } from "../tournament-participant-assignment";

test("repeated replacement preserves the club and played match, transferring only future matches", async () => {
  const club = { clubSlug: "arsenal", clubName: "Arsenal", clubBadgePath: "/arsenal.png" };
  const original = { id: "entry1", tournamentId: "cup", userId: "alice", status: "CONFIRMED", ...club, groupId: null, rosterMembers: [], notes: "", user: { id: "alice" } };
  type Entry = typeof original;
  const entries: Entry[] = [original];
  const played = { id: "played", participant1EntryId: "entry1", participant2EntryId: "opponent", player1Id: "alice", player2Id: "bob", status: "CONFIRMED", player1Score: 2, player2Score: 1 };
  const future = { ...played, id: "future", status: "READY", player1Score: null, player2Score: null };
  const noop = async () => undefined;
  const tables = {
    $executeRaw: noop,
    tournamentRegistration: {
      findFirst: async ({ where }: { where: { id?: string | { not: string }; userId?: string; status?: { not: string }; clubSlug?: string; OR?: { userId?: string; clubSlug?: string }[] } }) => entries.find(entry =>
        (typeof where.id !== "string" || entry.id === where.id) &&
        (typeof where.id !== "object" || entry.id !== where.id.not) &&
        (!where.status || entry.status !== where.status.not) &&
        (!where.userId || entry.userId === where.userId) &&
        (!where.clubSlug || entry.clubSlug === where.clubSlug) &&
        (!where.OR || where.OR.some(item => item.userId === entry.userId || item.clubSlug === entry.clubSlug))) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Entry> }) => Object.assign(entries.find(entry => entry.id === where.id)!, data),
      create: async ({ data }: { data: Partial<Entry> }) => { const entry = { ...original, ...data, id: `entry${entries.length + 1}`, user: { id: data.userId! } }; entries.push(entry); return entry; },
    },
    user: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, name: where.id, telegramId: where.id, telegramUsername: where.id }) },
    match: {
      findMany: async ({ where }: { where: { status?: { in: string[] }; lineupPlayers?: unknown } }) => where.lineupPlayers ? [] : [played, future].filter(match => where.status?.in.includes(match.status)),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: object }) => { for (const match of [played, future]) if (where.id.in.includes(match.id)) Object.assign(match, data); },
    },
    tournamentRegistrationMember: { deleteMany: noop, create: noop, updateMany: noop },
  };
  const db = { ...tables, $transaction: async <T>(callback: (tx: typeof tables) => Promise<T>): Promise<T> => callback(tables) };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse }, "@prisma/client": prisma,
    "@/lib/db": { db }, "@/lib/validators": { participantManageSchema },
    "@/lib/tournament-participant-assignment": { resolveParticipantClub },
    "@/lib/auth/session": { requirePermission: async () => ({ user: { id: "admin" } }) },
    "@/lib/clubs": { getAvailableClubs: async () => [{ slug: "arsenal", name: "Arsenal", imagePath: "/arsenal.png" }] },
    "@/lib/social-links": { hasTelegramRegistrationContact: () => true },
  };
  const route: { POST?: (request: Request, props: { params: Promise<{ id: string }> }) => Promise<Response> } = {};
  const source = readFileSync("src/app/api/admin/tournaments/[id]/participants/route.ts", "utf8");
  new Function("require", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(
    (name: string) => deps[name] ?? new Proxy({}, { get: () => () => undefined }), route,
  );
  for (const [index, userId] of ["charlie", "alice"].entries()) {
    const response = await route.POST!(new Request("http://localhost/api/participants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "replace", registrationId: `entry${index + 1}`, replacementUserId: userId, clubSlug: "arsenal" }) }), { params: Promise.resolve({ id: "cup" }) });
    assert.equal(response.status, 200, await response.text());
    assert.equal(entries[index].clubName, "Arsenal");
    assert.equal(entries[index].clubSlug, "arsenal");
    assert.equal(entries[index + 1].clubName, "Arsenal");
    assert.equal(future.player1Id, userId);
    assert.equal(played.player1Id, "alice");
    assert.equal(played.participant1EntryId, "entry1");
  }
});
