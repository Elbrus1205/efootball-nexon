import { Prisma, ShopDiscountType, ShopProductType, ShopStockMode } from "@prisma/client";
import { db } from "@/lib/db";

export type ShopCatalogSort = "popular" | "new" | "price-asc" | "price-desc" | "discount";
export type ShopCatalogFilters = {
  search?: string;
  category?: string;
  type?: ShopProductType;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  availableOnly?: boolean;
  popularOnly?: boolean;
  discountedOnly?: boolean;
  sort?: ShopCatalogSort;
  page?: number;
  pageSize?: number;
};

const productInclude = {
  category: { select: { id: true, slug: true, name: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 5 },
  variants: {
    where: { isActive: true, deletedAt: null },
    orderBy: [{ isDefault: "desc" as const }, { sortOrder: "asc" as const }],
  },
  promotions: {
    include: { promotion: true },
  },
} satisfies Prisma.ShopProductInclude;

function promotionPrice(
  priceMinor: number,
  promotions: Array<{ variantId: string | null; promotion: { discountType: ShopDiscountType; discountValue: number; maximumDiscountMinor: number | null; startsAt: Date; endsAt: Date; isActive: boolean; showCountdown: boolean; name: string } }>,
  variantId: string,
  now: Date,
) {
  const candidates = promotions
    .filter(({ variantId: target, promotion }) =>
      (!target || target === variantId) && promotion.isActive && promotion.startsAt <= now && promotion.endsAt > now,
    )
    .map(({ promotion }) => {
      const rawDiscount = promotion.discountType === ShopDiscountType.PERCENT
        ? Math.floor((priceMinor * promotion.discountValue) / 100)
        : promotion.discountValue;
      const discount = Math.min(priceMinor, promotion.maximumDiscountMinor ? Math.min(rawDiscount, promotion.maximumDiscountMinor) : rawDiscount);
      return { promotion, salePriceMinor: priceMinor - discount, discountMinor: discount };
    })
    .sort((a, b) => a.salePriceMinor - b.salePriceMinor);

  return candidates[0] ?? null;
}

type CatalogProduct = Prisma.ShopProductGetPayload<{ include: typeof productInclude }>;
type PresentedVariant<T extends CatalogProduct> = T["variants"][number] & {
  available: boolean;
  availableQuantity: number | null;
  activePromotion: ReturnType<typeof promotionPrice>;
};
type PresentedProduct<T extends CatalogProduct> = Omit<T, "ratingAverage" | "variants"> & {
  ratingAverage: number;
  variants: Array<PresentedVariant<T>>;
  defaultVariant: PresentedVariant<T> | null;
  available: boolean;
};

export function presentShopProduct<T extends CatalogProduct>(product: T, now = new Date()): PresentedProduct<T> {
  const variants = product.variants.map((variant) => ({
    ...variant,
    available: variant.stockMode === ShopStockMode.UNLIMITED || variant.stockQuantity - variant.reservedQuantity > 0,
    availableQuantity: variant.stockMode === ShopStockMode.UNLIMITED ? null : Math.max(0, variant.stockQuantity - variant.reservedQuantity),
    activePromotion: promotionPrice(variant.priceMinor, product.promotions, variant.id, now),
  }));
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0] ?? null;

  return {
    ...product,
    ratingAverage: Number(product.ratingAverage),
    variants,
    defaultVariant,
    available: variants.some((variant) => variant.available),
  } as PresentedProduct<T>;
}

export async function listShopCategories() {
  return db.shopCategory.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listShopProducts(filters: ShopCatalogFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 12));
  const search = filters.search?.trim().slice(0, 80);
  const variantWhere: Prisma.ShopProductVariantWhereInput = {
    isActive: true,
    deletedAt: null,
    ...(filters.availableOnly
      ? { OR: [{ stockMode: ShopStockMode.UNLIMITED }, { stockQuantity: { gt: 0 } }] }
      : {}),
    ...(filters.minPriceMinor !== undefined || filters.maxPriceMinor !== undefined
      ? { priceMinor: { gte: filters.minPriceMinor, lte: filters.maxPriceMinor } }
      : {}),
  };
  const now = new Date();
  const where: Prisma.ShopProductWhereInput = {
    isActive: true,
    deletedAt: null,
    category: { isActive: true, deletedAt: null, ...(filters.category ? { slug: filters.category } : {}) },
    variants: { some: variantWhere },
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.popularOnly ? { isPopular: true } : {}),
    ...(search
      ? { OR: [
          { title: { contains: search, mode: "insensitive" } },
          { shortDescription: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ] }
      : {}),
    ...(filters.discountedOnly
      ? { promotions: { some: { promotion: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } } } } }
      : {}),
  };

  const orderBy: Prisma.ShopProductOrderByWithRelationInput[] = filters.sort === "new"
    ? [{ createdAt: "desc" }]
    : filters.sort === "popular"
      ? [{ purchaseCount: "desc" }, { ratingAverage: "desc" }]
      : [{ sortOrder: "asc" }, { createdAt: "desc" }];

  const [total, products] = await db.$transaction([
    db.shopProduct.count({ where }),
    db.shopProduct.findMany({ where, include: productInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  let items = products.map((product) => presentShopProduct(product, now));
  if (filters.sort === "price-asc" || filters.sort === "price-desc" || filters.sort === "discount") {
    items = items.sort((a, b) => {
      if (filters.sort === "discount") {
        const aDiscount = a.defaultVariant?.activePromotion?.discountMinor ?? 0;
        const bDiscount = b.defaultVariant?.activePromotion?.discountMinor ?? 0;
        return bDiscount - aDiscount;
      }
      const aPrice = a.defaultVariant?.activePromotion?.salePriceMinor ?? a.defaultVariant?.priceMinor ?? Number.MAX_SAFE_INTEGER;
      const bPrice = b.defaultVariant?.activePromotion?.salePriceMinor ?? b.defaultVariant?.priceMinor ?? Number.MAX_SAFE_INTEGER;
      return filters.sort === "price-asc" ? aPrice - bPrice : bPrice - aPrice;
    });
  }

  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getShopProductBySlug(slug: string) {
  const product = await db.shopProduct.findFirst({
    where: { slug, isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null } },
    include: {
      ...productInclude,
      fields: { orderBy: { sortOrder: "asc" } },
    },
  });
  return product ? presentShopProduct(product) : null;
}
