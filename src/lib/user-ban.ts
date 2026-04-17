import { formatDate } from "@/lib/utils";

type UserBanState = {
  isBanned: boolean;
  banReason?: string | null;
  bannedUntil?: Date | string | null;
};

type ActiveUserBan =
  | {
      isPermanent: true;
      reason: string | null;
      until: null;
    }
  | {
      isPermanent: false;
      reason: string | null;
      until: Date;
    };

export function getActiveUserBan(user: UserBanState | null | undefined, now = new Date()): ActiveUserBan | null {
  if (!user) return null;

  if (user.isBanned) {
    return {
      isPermanent: true,
      reason: user.banReason?.trim() || null,
      until: null,
    };
  }

  if (user.bannedUntil) {
    const until = new Date(user.bannedUntil);
    if (until > now) {
      return {
        isPermanent: false,
        reason: user.banReason?.trim() || null,
        until,
      };
    }
  }

  return null;
}

export function formatTournamentBanMessage(user: UserBanState | null | undefined, now = new Date()) {
  const ban = getActiveUserBan(user, now);
  if (!ban) return null;

  const reasonText = ban.reason ? ` Причина: ${ban.reason}` : "";
  if (ban.isPermanent) {
    return `Вы не можете зарегистрироваться: аккаунт заблокирован навсегда.${reasonText}`;
  }

  return `Вы не можете зарегистрироваться до ${formatDate(ban.until)}.${reasonText}`;
}
