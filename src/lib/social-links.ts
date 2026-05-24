type SocialAccount = {
  provider: string;
  providerAccountId: string;
};

type SocialUser = {
  name?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  vkId?: string | null;
  accounts?: SocialAccount[];
};

export type SocialLink = {
  id: "telegram" | "vk";
  label: string;
  href: string;
  handle: string;
  telegramProfile?: TelegramProfileLinks;
};

export type TelegramProfileLinks = {
  href: string;
  androidHref?: string;
  iosHref?: string;
  webHref?: string;
  telegramId?: string;
  username?: string;
};

function normalizeTelegramUsername(value?: string | null) {
  const username = value?.trim().replace(/^@/, "");
  return username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : null;
}

export function getTelegramProfileLinks(user: Pick<SocialUser, "telegramId" | "telegramUsername">): TelegramProfileLinks | null {
  const telegramId = user.telegramId?.trim();
  const telegramUsername = normalizeTelegramUsername(user.telegramUsername);

  if (telegramId && /^\d+$/.test(telegramId)) {
    const iosHref = `tg://user?id=${telegramId}`;

    return {
      href: iosHref,
      androidHref: `tg://openmessage?user_id=${telegramId}`,
      iosHref,
      telegramId,
      username: telegramUsername ?? undefined,
    };
  }

  return telegramUsername ? { href: `https://t.me/${telegramUsername}`, webHref: `https://t.me/${telegramUsername}`, username: telegramUsername } : null;
}

export function getTelegramProfileHref(user: Pick<SocialUser, "telegramId" | "telegramUsername">) {
  return getTelegramProfileLinks(user)?.href ?? null;
}

export function getTelegramHandle(user: Pick<SocialUser, "telegramId" | "telegramUsername">) {
  const telegramUsername = normalizeTelegramUsername(user.telegramUsername);
  return telegramUsername ? `@${telegramUsername}` : "Telegram";
}

export function getUserSocialLinks(user: SocialUser): SocialLink[] {
  const links: SocialLink[] = [];
  const displayLabel = user.name?.trim() || "Профиль";
  const vkAccountId = user.vkId || user.accounts?.find((account) => account.provider === "vk")?.providerAccountId;
  const telegramProfile = getTelegramProfileLinks(user);

  if (telegramProfile) {
    links.push({
      id: "telegram",
      label: displayLabel,
      href: telegramProfile.href,
      handle: getTelegramHandle(user),
      telegramProfile,
    });
  }

  if (vkAccountId?.trim()) {
    const normalizedVkId = vkAccountId.trim();

    links.push({
      id: "vk",
      label: displayLabel,
      href: `https://vk.com/id${normalizedVkId}`,
      handle: `id${normalizedVkId}`,
    });
  }

  return links;
}
