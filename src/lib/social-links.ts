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
};

export function getTelegramProfileHref(user: Pick<SocialUser, "telegramId" | "telegramUsername">) {
  const telegramId = user.telegramId?.trim();
  if (telegramId) return `tg://user?id=${telegramId}`;

  const telegramUsername = user.telegramUsername?.trim().replace(/^@/, "");
  return telegramUsername ? `https://t.me/${telegramUsername}` : null;
}

export function getUserSocialLinks(user: SocialUser): SocialLink[] {
  const links: SocialLink[] = [];
  const displayLabel = user.name?.trim() || "Профиль";
  const vkAccountId = user.vkId || user.accounts?.find((account) => account.provider === "vk")?.providerAccountId;
  const telegramHref = getTelegramProfileHref(user);

  if (telegramHref) {
    const telegramUsername = user.telegramUsername?.trim().replace(/^@/, "");

    links.push({
      id: "telegram",
      label: displayLabel,
      href: telegramHref,
      handle: telegramUsername ? `@${telegramUsername}` : "Telegram",
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
