const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 60 * 60_000;

export function getNotificationRetryDelayMs(attempt: number) {
  const exponent = Math.max(0, Math.min(16, attempt - 1));
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** exponent);
}
