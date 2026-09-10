const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;
export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function getSessionExpiry(now = new Date()) {
  return new Date(now.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000);
}

export function getSessionActivityCutoff(now = new Date()) {
  return new Date(now.getTime() - SESSION_ACTIVITY_WRITE_INTERVAL_MS);
}

export function shouldRefreshSessionActivity(lastActiveAt: Date, now = new Date()) {
  return lastActiveAt < getSessionActivityCutoff(now);
}
