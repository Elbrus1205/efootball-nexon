const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

type RuntimePoolEnvironment = {
  connectionLimit?: string;
  poolTimeout?: string;
};

function parsePositiveInteger(name: string, value: string | undefined, fallback: number, maximum: number) {
  if (value === undefined || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }

  return parsed;
}

export function configureRuntimeDatabaseUrl(databaseUrl: string, environment: RuntimePoolEnvironment) {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return databaseUrl;
  }

  const connectionLimit = parsePositiveInteger(
    "PRISMA_CONNECTION_LIMIT",
    environment.connectionLimit,
    DEFAULT_CONNECTION_LIMIT,
    50,
  );
  const poolTimeout = parsePositiveInteger(
    "PRISMA_POOL_TIMEOUT",
    environment.poolTimeout,
    DEFAULT_POOL_TIMEOUT_SECONDS,
    120,
  );

  // Runtime settings deliberately win over query-string defaults. This keeps an
  // accidentally copied one-connection development URL from serialising every
  // request in production.
  url.searchParams.set("connection_limit", String(connectionLimit));
  url.searchParams.set("pool_timeout", String(poolTimeout));

  return url.toString();
}
