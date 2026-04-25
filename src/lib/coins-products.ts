import type { CoinProductPlatform } from "@prisma/client";
import { db } from "@/lib/db";
import type { CoinsOffer, CoinsPlatform } from "@/lib/coins-catalog";

export function rublesToKopecks(value: string | number) {
  const normalized = String(value).replace(",", ".").replace(/[^\d.]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function productToOffer(product: {
  id: string;
  title: string;
  coins: number;
  priceKopecks: number;
  costKopecks: number;
}): CoinsOffer {
  return {
    id: product.id,
    title: product.title,
    coins: product.coins,
    paidCoins: product.coins,
    freeCoins: 0,
    priceKopecks: product.priceKopecks,
    costKopecks: product.costKopecks,
    kind: "coins",
  };
}

export async function getCoinsProductOffer(platform: CoinsPlatform, offerId: string) {
  const product = await db.coinProduct.findFirst({
    where: {
      id: offerId,
      platform: platform as CoinProductPlatform,
      isActive: true,
    },
  });

  return product ? productToOffer(product) : null;
}

export async function getCoinsProductOffersByPlatform() {
  const products = await db.coinProduct.findMany({
    where: { isActive: true },
    orderBy: [{ platform: "asc" }, { coins: "asc" }, { createdAt: "asc" }],
  });

  return {
    android: products.filter((product) => product.platform === "android").map(productToOffer),
    ios: products.filter((product) => product.platform === "ios").map(productToOffer),
    promo: products.filter((product) => product.platform === "promo").map(productToOffer),
  } satisfies Record<CoinsPlatform, CoinsOffer[]>;
}
