export type CoinsOffer = {
  id: string;
  title: string;
  coins: number;
  paidCoins: number;
  freeCoins: number;
  price?: string;
  kind: "coins" | "bundle";
  badge?: string;
  note?: string;
  bonus?: string;
  priceMode?: "fixed" | "request";
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

const androidPrices = {
  "pack-130": "₺45,99",
  "pack-300": "₺104,99",
  "pack-550": "₺189,99",
  "pack-750": "₺254,99",
  "pack-1040": "₺349,99",
  "pack-2130": "₺699,99",
  "pack-3250": "₺1.029,99",
  "pack-5700": "₺1.729,99",
  "pack-12800": "₺3.699,99",
} as const;

export const androidCoinPacks: CoinsOffer[] = baseCoinPacks.map((offer) => ({
  ...offer,
  kind: "coins",
  price: androidPrices[offer.id],
  priceMode: "fixed",
}));

export const iosCoinPacks: CoinsOffer[] = baseCoinPacks.map((offer) => ({
  ...offer,
  kind: "coins",
  badge: "iOS",
  note: "Цена для iPhone и iPad отличается. Подтвердим актуальную стоимость в Telegram перед оплатой.",
  priceMode: "request",
}));

export const promoCoinPacks: CoinsOffer[] = [
  {
    id: "promo-260",
    title: "260 Coins",
    coins: 260,
    paidCoins: 130,
    freeCoins: 130,
    price: "₺45,99",
    kind: "coins",
    badge: "Акция",
    note: "Единая цена для Android и iOS.",
    priceMode: "fixed",
  },
  {
    id: "promo-840",
    title: "840 Coins",
    coins: 840,
    paidCoins: 530,
    freeCoins: 310,
    price: "₺189,99",
    kind: "coins",
    badge: "Акция",
    note: "Единая цена для Android и iOS.",
    priceMode: "fixed",
  },
  {
    id: "promo-3430",
    title: "3 430 Coins",
    coins: 3430,
    paidCoins: 1950,
    freeCoins: 1480,
    price: "₺699,99",
    kind: "coins",
    badge: "Акция",
    note: "Единая цена для Android и iOS.",
    priceMode: "fixed",
  },
];

export const promoBundles: CoinsOffer[] = [
  {
    id: "starter-burak-yilmaz",
    title: "Starter Set: Burak Yilmaz",
    coins: 10,
    paidCoins: 10,
    freeCoins: 0,
    price: "₺19,99",
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 1 бонусная карточка",
    note: "Одинаковая цена для Android и iOS.",
    priceMode: "fixed",
  },
  {
    id: "mourinho-set",
    title: "Mourinho Set",
    coins: 150,
    paidCoins: 150,
    freeCoins: 0,
    price: "₺124,99",
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 3 бонусные карточки",
    note: "Одинаковая цена для Android и iOS.",
    priceMode: "fixed",
  },
  {
    id: "starter-silvestre",
    title: "Starter Set: Silvestre",
    coins: 50,
    paidCoins: 50,
    freeCoins: 0,
    price: "₺24,99",
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 1 бонусная карточка",
    note: "Одинаковая цена для Android и iOS.",
    priceMode: "fixed",
  },
  {
    id: "starter-van-nistelrooij",
    title: "Starter Set: van Nistelrooij",
    coins: 100,
    paidCoins: 100,
    freeCoins: 0,
    price: "₺74,99",
    kind: "bundle",
    badge: "Выгодный комплект",
    bonus: "Coins + 4 бонусные карточки",
    note: "Одинаковая цена для Android и iOS.",
    priceMode: "fixed",
  },
];
