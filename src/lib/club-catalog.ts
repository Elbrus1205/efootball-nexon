export type LeagueCatalogOption = { slug: string; name: string; badgePath: string };

export const TOP_FIVE_LEAGUES: readonly LeagueCatalogOption[] = [
  { slug: "premier-league", name: "АПЛ", badgePath: "/club-badges/liverpool.png" },
  { slug: "la-liga", name: "Ла Лига", badgePath: "/club-badges/real-madrid.png" },
  { slug: "ligue-1", name: "Лига 1", badgePath: "/club-badges/psg-big-768x768.png" },
  { slug: "bundesliga", name: "Бундеслига", badgePath: "/club-badges/bayern-munich-big-768x768.png" },
  { slug: "serie-a", name: "Серия А", badgePath: "/club-badges/juventus.png" },
];
