export type LeagueCatalogOption = { slug: string; name: string; badgePath: string };

export const TOP_FIVE_LEAGUES: readonly LeagueCatalogOption[] = [
  { slug: "premier-league", name: "АПЛ", badgePath: "/emblem-league/apl-league.png" },
  { slug: "la-liga", name: "Ла Лига", badgePath: "/emblem-league/la-liga.png" },
  { slug: "ligue-1", name: "Лига 1", badgePath: "/emblem-league/league1-mc.png" },
  { slug: "bundesliga", name: "Бундеслига", badgePath: "/emblem-league/bundesliga.png" },
  { slug: "serie-a", name: "Серия А", badgePath: "/emblem-league/serie-a.png" },
];
