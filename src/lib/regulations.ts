import { getTrustedClientAddress } from "@/lib/client-address";
import { db } from "@/lib/db";

export const DEFAULT_REGULATIONS_TEXT =
  "Заполните здесь официальный регламент турниров: сроки, подтверждение матчей, правила переигровок, технические поражения и требования к скриншотам.\n\nШтраф за сообщения\nМат, оскорбления, унижение участников, угрозы, травля и иное непристойное поведение в личных или общих сообщениях платформы и турнира считаются нарушением. За подтвержденное нарушение снимается минус 6 баллов надежности. Штраф может быть применен к одному или обоим игрокам матча, если нарушение допущено обеими сторонами.";
const DEFAULT_REGULATIONS_VERSION = "default-2026-07-19-message-misconduct";
const REGULATIONS_ACCEPTANCE_PREFIX = "regulations_acceptance:";
const REGULATIONS_PREVIOUS_KEY = "regulations_previous";

export async function getRegulationsText() {
  const document = await getRegulationsDocument();
  return document.body;
}

export async function getRegulationsDocument() {

  const rows = await db.$queryRaw<Array<{ body: string; updatedAt: Date }>>`
    SELECT "body", "updatedAt" FROM "SiteContent" WHERE "key" = 'regulations' LIMIT 1
  `;

  const row = rows[0];
  const updatedAt = row?.updatedAt ?? null;

  return {
    body: row?.body ?? DEFAULT_REGULATIONS_TEXT,
    updatedAt,
    version: updatedAt?.toISOString() ?? DEFAULT_REGULATIONS_VERSION,
  };
}

export async function getRegulationsChangeHighlights() {

  const document = await getRegulationsDocument();
  const rows = await db.$queryRaw<Array<{ body: string }>>`
    SELECT "body" FROM "SiteContent" WHERE "key" = ${REGULATIONS_PREVIOUS_KEY} LIMIT 1
  `;

  return buildRegulationsHighlights(rows[0]?.body ?? "", document.body);
}

export async function saveRegulationsText(body: string) {
  const current = await getRegulationsDocument();

  if (current.body !== body) {
    await db.$executeRaw`
      INSERT INTO "SiteContent" ("key", "body", "updatedAt")
      VALUES (${REGULATIONS_PREVIOUS_KEY}, ${current.body}, CURRENT_TIMESTAMP)
      ON CONFLICT ("key")
      DO UPDATE SET "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  await db.$executeRaw`
    INSERT INTO "SiteContent" ("key", "body", "updatedAt")
    VALUES ('regulations', ${body}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key")
    DO UPDATE SET "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function getRegulationsAcceptance(userId: string) {

  const document = await getRegulationsDocument();
  const key = createRegulationsAcceptanceKey(userId);
  const rows = await db.$queryRaw<Array<{ body: string; updatedAt: Date }>>`
    SELECT "body", "updatedAt" FROM "SiteContent" WHERE "key" = ${key} LIMIT 1
  `;
  const acceptance = parseRegulationsAcceptance(rows[0]?.body);

  return {
    accepted: acceptance?.version === document.version,
    acceptedAt: acceptance?.acceptedAt ?? rows[0]?.updatedAt?.toISOString() ?? null,
    acceptedVersion: acceptance?.version ?? null,
    document,
  };
}

export async function hasAcceptedCurrentRegulations(userId: string) {
  const acceptance = await getRegulationsAcceptance(userId);
  return acceptance.accepted;
}

export async function acceptCurrentRegulations(userId: string, headers?: Headers) {

  const document = await getRegulationsDocument();
  const acceptedAt = new Date().toISOString();
  const payload = JSON.stringify({
    version: document.version,
    acceptedAt,
    ipAddress: getTrustedClientAddress(headers),
    userAgent: readHeader(headers, "user-agent")?.trim() ?? null,
  });
  const key = createRegulationsAcceptanceKey(userId);

  await db.$executeRaw`
    INSERT INTO "SiteContent" ("key", "body", "updatedAt")
    VALUES (${key}, ${payload}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key")
    DO UPDATE SET "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP
  `;

  return {
    accepted: true,
    acceptedAt,
    document,
  };
}

function createRegulationsAcceptanceKey(userId: string) {
  return `${REGULATIONS_ACCEPTANCE_PREFIX}${userId}`;
}

function parseRegulationsAcceptance(value?: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { version?: unknown; acceptedAt?: unknown };

    return {
      version: typeof parsed.version === "string" ? parsed.version : null,
      acceptedAt: typeof parsed.acceptedAt === "string" ? parsed.acceptedAt : null,
    };
  } catch {
    return null;
  }
}

function buildRegulationsHighlights(previousBody: string, currentBody: string) {
  if (!previousBody || previousBody === currentBody) {
    return currentBody.split("\n").map((text) => ({ text, changed: false }));
  }

  const previousLines = new Set(
    previousBody
      .split("\n")
      .map((line) => normalizeRegulationsLine(line))
      .filter(Boolean),
  );

  return currentBody.split("\n").map((text) => ({
    text,
    changed: Boolean(normalizeRegulationsLine(text) && !previousLines.has(normalizeRegulationsLine(text))),
  }));
}

function normalizeRegulationsLine(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function readHeader(headers: Headers | undefined, key: string) {
  return headers?.get(key) ?? null;
}
