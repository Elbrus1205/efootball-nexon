export type TelegramOidcProfile = {
  subject: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  picture?: string | null;
};

export function getTelegramOidcClientId() {
  return process.env.TELEGRAM_CLIENT_ID?.trim() || "";
}
