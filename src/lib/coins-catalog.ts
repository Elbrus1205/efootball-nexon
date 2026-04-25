export type CoinsPlatform = "android" | "ios" | "promo";

export type CoinsOffer = {
  id: string;
  title: string;
  coins: number;
  paidCoins: number;
  freeCoins: number;
  priceKopecks: number;
  kind: "coins" | "bundle";
  badge?: string;
  note?: string;
  bonus?: string;
};

const baseCoinPacks = [
  {
    id: "pack-130",
    title: "130 Coins",
    coins: 130,
    paidCoins: 130,
    freeCoins: 0,
  },
  {
    id: "pack-300",
    title: "300 Coins",
    coins: 300,
    paidCoins: 293,
    freeCoins: 7,
  },
  {
    id: "pack-550",
    title: "550 Coins",
    coins: 550,
    paidCoins: 530,
    freeCoins: 20,
  },
  {
    id: "pack-750",
    title: "750 Coins",
    coins: 750,
    paidCoins: 715,
    freeCoins: 35,
  },
  {
    id: "pack-1040",
    title: "1 040 Coins",
    coins: 1040,
    paidCoins: 975,
    freeCoins: 65,
  },
  {
    id: "pack-2130",
    title: "2 130 Coins",
    coins: 2130,
    paidCoins: 1950,
    freeCoins: 180,
  },
  {
    id: "pack-3250",
    title: "3 250 Coins",
    coins: 3250,
    paidCoins: 2930,
    freeCoins: 320,
  },
  {
    id: "pack-5700",
    title: "5 700 Coins",
    coins: 5700,
    paidCoins: 4860,
    freeCoins: 840,
  },
  {
    id: "pack-12800",
    title: "12 800 Coins",
    coins: 12800,
    paidCoins: 10400,
    freeCoins: 2400,
  },
] as const;

const androidPriceKopecks = {
  "pack-130": 4599,
  "pack-300": 10499,
  "pack-550": 18999,
  "pack-750": 25499,
  "pack-1040": 34999,
  "pack-2130": 69999,
  "pack-3250": 102999,
  "pack-5700": 172999,
  "pack-12800": 369999,
} as const;

const promoCoinPriceKopecks = {
  "promo-260": 4599,
  "promo-840": 18999,
  "promo-3430": 69999,
} as const;

const promoBundlePriceKopecks = {
  "starter-burak-yilmaz": 1999,
  "mourinho-set": 12499,
  "starter-silvestre": 2499,
  "starter-van-nistelrooij": 7499,
} as const;

function addPercentage(priceKopecks: number, percent: number) {
  return Math.round(priceKopecks * (1 + percent / 100));
}

export function formatRubles(priceKopecks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceKopecks / 100);
}

export function getCoinsOfferCostKopecks(priceKopecks: number) {
  return Math.round(priceKopecks * 0.7);
}

export function isCoinsPlatform(value: string): value is CoinsPlatform {
  return value === "android" || value === "ios" || value === "promo";
}

export function getCoinsPlatformLabel(platform: CoinsPlatform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Акции";
}

export function getCoinsCheckoutPath(platform: CoinsPlatform, offerId: string) {
  return `/coins/checkout/${platform}/${encodeURIComponent(offerId)}`;
}

export const androidCoinPacks: CoinsOffer[] = baseCoinPacks.map((offer) => ({
  ...offer,
  kind: "coins",
  priceKopecks: androidPriceKopecks[offer.id],
  note: "Оплата открывает страницу оформления заказа. Позже сюда подключается ЮKassa.",
}));

export const iosCoinPacks: CoinsOffer[] = baseCoinPacks.map((offer) => ({
  ...offer,
  kind: "coins",
  priceKopecks: addPercentage(androidPriceKopecks[offer.id], 10),
  badge: "iOS +10%",
  note: "Стоимость для iPhone и iPad автоматически считается на 10% выше Android.",
}));

export const promoCoinPacks: CoinsOffer[] = [
  {
    id: "promo-260",
    title: "260 Coins",
    coins: 260,
    paidCoins: 130,
    freeCoins: 130,
    priceKopecks: promoCoinPriceKopecks["promo-260"],
    kind: "coins",
    badge: "Акция",
    note: "Одинаковая цена для Android и iOS.",
  },
  {
    id: "promo-840",
    title: "840 Coins",
    coins: 840,
    paidCoins: 530,
    freeCoins: 310,
    priceKopecks: promoCoinPriceKopecks["promo-840"],
    kind: "coins",
    badge: "Акция",
    note: "Одинаковая цена для Android и iOS.",
  },
  {
    id: "promo-3430",
    title: "3 430 Coins",
    coins: 3430,
    paidCoins: 1950,
    freeCoins: 1480,
    priceKopecks: promoCoinPriceKopecks["promo-3430"],
    kind: "coins",
    badge: "Акция",
    note: "Одинаковая цена для Android и iOS.",
  },
];

export const promoBundles: CoinsOffer[] = [
  {
    id: "starter-burak-yilmaz",
    title: "Starter Set: Burak Yilmaz",
    coins: 10,
    paidCoins: 10,
    freeCoins: 0,
    priceKopecks: promoBundlePriceKopecks["starter-burak-yilmaz"],
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 1 бонусная карточка",
    note: "Одинаковая цена для Android и iOS.",
  },
  {
    id: "mourinho-set",
    title: "Mourinho Set",
    coins: 150,
    paidCoins: 150,
    freeCoins: 0,
    priceKopecks: promoBundlePriceKopecks["mourinho-set"],
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 3 бонусные карточки",
    note: "Одинаковая цена для Android и iOS.",
  },
  {
    id: "starter-silvestre",
    title: "Starter Set: Silvestre",
    coins: 50,
    paidCoins: 50,
    freeCoins: 0,
    priceKopecks: promoBundlePriceKopecks["starter-silvestre"],
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 1 бонусная карточка",
    note: "Одинаковая цена для Android и iOS.",
  },
  {
    id: "starter-van-nistelrooij",
    title: "Starter Set: van Nistelrooij",
    coins: 100,
    paidCoins: 100,
    freeCoins: 0,
    priceKopecks: promoBundlePriceKopecks["starter-van-nistelrooij"],
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 4 бонусные карточки",
    note: "Одинаковая цена для Android и iOS.",
  },
];

const coinsCatalogByPlatform: Record<CoinsPlatform, CoinsOffer[]> = {
  android: androidCoinPacks,
  ios: iosCoinPacks,
  promo: [...promoCoinPacks, ...promoBundles],
};

export function getCoinsOffer(platform: CoinsPlatform, offerId: string) {
  return coinsCatalogByPlatform[platform].find((offer) => offer.id === offerId) ?? null;
}
