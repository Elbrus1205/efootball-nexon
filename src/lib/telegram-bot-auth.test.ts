import test from "node:test";
import assert from "node:assert/strict";
import { LoginAttemptStatus, UserRole } from "@prisma/client";
import { finalizeTelegramBotLogin, handleTelegramBotStart } from "@/lib/telegram-bot-auth";
import { buildPendingTelegramBotLoginIdentifier, buildVerifiedTelegramBotLoginIdentifier } from "@/lib/telegram-bot-login";

type VerificationTokenRecord = {
  token: string;
  identifier: string;
  expires: Date;
};

type FakeUser = {
  id: string;
  email: string | null;
  image: string | null;
  isBanned: boolean;
  name: string | null;
  role: UserRole;
  telegramId: string | null;
  telegramUsername: string | null;
  legalAcceptedAt?: Date | null;
};

function createFakeDb(params?: {
  verificationTokens?: VerificationTokenRecord[];
  users?: FakeUser[];
}) {
  const verificationTokens = [...(params?.verificationTokens ?? [])];
  const users = [...(params?.users ?? [])];

  return {
    state: {
      verificationTokens,
      users,
    },
    db: {
      verificationToken: {
        async findUnique({ where: { token } }: { where: { token: string } }) {
          return verificationTokens.find((item) => item.token === token) ?? null;
        },
        async update({ where: { token }, data: { identifier } }: { where: { token: string }; data: { identifier: string } }) {
          const record = verificationTokens.find((item) => item.token === token);
          if (!record) throw new Error("verification token not found");
          record.identifier = identifier;
          return record;
        },
        async delete({ where: { token } }: { where: { token: string } }) {
          const index = verificationTokens.findIndex((item) => item.token === token);
          if (index >= 0) verificationTokens.splice(index, 1);
          return null;
        },
      },
      user: {
        async findUnique({ where }: { where: { telegramId?: string; id?: string } }) {
          if (where.id) return users.find((item) => item.id === where.id) ?? null;
          if (where.telegramId) return users.find((item) => item.telegramId === where.telegramId) ?? null;
          return null;
        },
        async update({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) {
          const user = users.find((item) => item.id === id);
          if (!user) throw new Error("user not found");
          Object.assign(user, data);
          return user;
        },
        async create({ data }: { data: Record<string, unknown> }) {
          const user: FakeUser = {
            id: String(data.id ?? `user-${users.length + 1}`),
            email: (data.email as string | null | undefined) ?? null,
            image: (data.image as string | null | undefined) ?? null,
            isBanned: Boolean(data.isBanned ?? false),
            name: (data.name as string | null | undefined) ?? null,
            role: (data.role as UserRole | undefined) ?? UserRole.PLAYER,
            telegramId: (data.telegramId as string | null | undefined) ?? null,
            telegramUsername: (data.telegramUsername as string | null | undefined) ?? null,
            legalAcceptedAt: (data.legalAcceptedAt as Date | null | undefined) ?? new Date(),
          };
          users.push(user);
          return user;
        },
      },
    },
  };
}

const context = {
  device: "Test device",
  platform: "TestOS",
  location: "Test City",
  ipAddress: "127.0.0.1",
  userAgent: "node:test",
};

test("handleTelegramBotStart verifies a pending token and stores telegram profile", async () => {
  const sentMessages: Array<{ chatId: string; text: string; siteUrl: string }> = [];
  const fake = createFakeDb({
    verificationTokens: [
      {
        token: "login-token",
        identifier: buildPendingTelegramBotLoginIdentifier(true),
        expires: new Date(Date.now() + 60_000),
      },
    ],
  });

  const result = await handleTelegramBotStart(
    {
      db: fake.db,
      async getTelegramPhotoFileId() {
        return "photo-file";
      },
      async sendTelegramMessage(chatId, text, siteUrl) {
        sentMessages.push({ chatId, text, siteUrl });
      },
    },
    {
      loginToken: "login-token",
      telegramUser: {
        id: "777",
        firstName: "Test",
        lastName: "User",
        username: "telegram_test",
      },
      chatId: "555",
      siteUrl: "https://example.com/login",
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.reason, "verified");
  assert.match(fake.state.verificationTokens[0]?.identifier ?? "", /^telegram-bot-login:verified:/);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.text ?? "", /Готово/);
});

test("handleTelegramBotStart gracefully handles repeated start for the same user", async () => {
  const sentMessages: string[] = [];
  const fake = createFakeDb({
    verificationTokens: [
      {
        token: "repeat-token",
        identifier: buildVerifiedTelegramBotLoginIdentifier(
          {
            id: "777",
            username: "telegram_test",
          },
          true,
        ),
        expires: new Date(Date.now() + 60_000),
      },
    ],
  });

  const result = await handleTelegramBotStart(
    {
      db: fake.db,
      async getTelegramPhotoFileId() {
        return null;
      },
      async sendTelegramMessage(_chatId, text) {
        sentMessages.push(text);
      },
    },
    {
      loginToken: "repeat-token",
      telegramUser: {
        id: "777",
        username: "telegram_test",
      },
      chatId: "555",
      siteUrl: "https://example.com/login",
    },
  );

  assert.equal(result.reason, "already-verified");
  assert.match(sentMessages[0] ?? "", /уже подтверждён/i);
});

test("finalizeTelegramBotLogin logs in an existing user without duplication", async () => {
  const loginHistory: Array<{ status: LoginAttemptStatus; userId?: string | null }> = [];
  const fake = createFakeDb({
    verificationTokens: [
      {
        token: "existing-user-token",
        identifier: buildVerifiedTelegramBotLoginIdentifier(
          {
            id: "900",
            username: "existing_user",
            firstName: "Existing",
            lastName: "Player",
          },
          false,
        ),
        expires: new Date(Date.now() + 60_000),
      },
    ],
    users: [
      {
        id: "user-1",
        email: "existing@example.com",
        image: null,
        isBanned: false,
        name: "Existing Player",
role: UserRole.PLAYER,
        telegramId: "900",
        telegramUsername: "old_name",
        legalAcceptedAt: null,
      },
    ],
  });

  const result = await finalizeTelegramBotLogin(
    {
      db: fake.db,
      async createLoginHistory(entry) {
        loginHistory.push(entry);
      },
      async createSecuritySession() {
        return "security-session";
      },
      async generateUniquePublicPlayerId() {
        return "PUB-1";
      },
      getLegalAcceptanceData() {
        return { legalAcceptedAt: new Date("2026-01-01T00:00:00.000Z") };
      },
    },
    {
      loginToken: "existing-user-token",
      legalAcceptedFallback: true,
      context,
    },
  );

  assert.ok(result);
  assert.equal(result?.id, "user-1");
  assert.equal(fake.state.users.length, 1);
  assert.equal(fake.state.users[0]?.telegramUsername, "existing_user");
  assert.equal(loginHistory[0]?.status, LoginAttemptStatus.SUCCESS);
  assert.equal(fake.state.verificationTokens.length, 0);
});

test("finalizeTelegramBotLogin creates a new user only when needed", async () => {
  const fake = createFakeDb({
    verificationTokens: [
      {
        token: "new-user-token",
        identifier: buildVerifiedTelegramBotLoginIdentifier(
          {
            id: "901",
            username: "new_player",
            firstName: "New",
            lastName: "Player",
          },
          true,
        ),
        expires: new Date(Date.now() + 60_000),
      },
    ],
  });

  const result = await finalizeTelegramBotLogin(
    {
      db: fake.db,
      async createLoginHistory() {
        return;
      },
      async createSecuritySession() {
        return "security-session";
      },
      async generateUniquePublicPlayerId() {
        return "PUB-NEW";
      },
      getLegalAcceptanceData() {
        return { legalAcceptedAt: new Date("2026-01-01T00:00:00.000Z") };
      },
    },
    {
      loginToken: "new-user-token",
      legalAcceptedFallback: false,
      context,
    },
  );

  assert.ok(result);
  assert.equal(fake.state.users.length, 1);
  assert.equal(fake.state.users[0]?.telegramId, "901");
  assert.equal(fake.state.users[0]?.name, "New Player");
  assert.equal(fake.state.verificationTokens.length, 0);
});

test("finalizeTelegramBotLogin rejects expired tokens", async () => {
  const fake = createFakeDb({
    verificationTokens: [
      {
        token: "expired-token",
        identifier: buildPendingTelegramBotLoginIdentifier(false),
        expires: new Date(Date.now() - 60_000),
      },
    ],
  });

  const result = await finalizeTelegramBotLogin(
    {
      db: fake.db,
      async createLoginHistory() {
        return;
      },
      async createSecuritySession() {
        return "security-session";
      },
      async generateUniquePublicPlayerId() {
        return "PUB-NEW";
      },
      getLegalAcceptanceData() {
        return {};
      },
    },
    {
      loginToken: "expired-token",
      legalAcceptedFallback: false,
      context,
    },
  );

  assert.equal(result, null);
  assert.equal(fake.state.verificationTokens.length, 0);
});

