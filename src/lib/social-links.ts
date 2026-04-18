type SocialAccount = {
  provider: string;
  providerAccountId: string;
};

type SocialUser = {
  name?: string | null;
  nickname?: string | null;
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

export function getUserSocialLinks(user: SocialUser): SocialLink[] {
  const links: SocialLink[] = [];
  const displayLabel = user.name?.trim() || user.nickname?.trim() || "Профиль";
  const vkAccountId = user.vkId || user.accounts?.find((account) => account.provider === "vk")?.providerAccountId;

  if (user.telegramUsername?.trim()) {
    links.push({
      id: "telegram",
      label: displayLabel,
      href: `https://t.me/${user.telegramUsername.trim()}`,
      handle: `@${user.telegramUsername.trim()}`,
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
