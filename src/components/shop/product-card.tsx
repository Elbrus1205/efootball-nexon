import Link from "next/link";
import { Clock3, PackageCheck, ShoppingBag, Star } from "lucide-react";
import { formatFulfillmentTime, formatShopMoney } from "@/lib/shop/format";
import styles from "./shop.module.css";

type ProductCardProps = {
  product: {
    slug: string;
    title: string;
    shortDescription: string;
    type: string;
    purchaseCount: number;
    ratingAverage: number;
    estimatedMinutes: number;
    category: { name: string };
    images: Array<{ url: string; alt: string }>;
    available: boolean;
    defaultVariant: null | {
      priceMinor: number;
      activePromotion: null | { salePriceMinor: number; discountMinor: number };
    };
  };
  currency?: string;
};

export function ProductCard({ product, currency = "RUB" }: ProductCardProps) {
  const variant = product.defaultVariant;
  const price = variant?.activePromotion?.salePriceMinor ?? variant?.priceMinor;
  const percent = variant?.activePromotion && variant.priceMinor > 0
    ? Math.round((variant.activePromotion.discountMinor / variant.priceMinor) * 100)
    : 0;

  return (
    <article className={styles.productCard}>
      <span className={styles.productCardBackdrop} aria-hidden="true" />
      <span className={styles.productCardScrim} aria-hidden="true" />
      <Link href={`/shop/${product.slug}`} className={styles.productImage} aria-label={`Открыть товар ${product.title}`}>
        <span className={styles.productPlaceholder}><ShoppingBag aria-hidden="true" /></span>
        <span className={styles.badgeRow}>
          <span className={styles.badge}>{product.type === "PROMOTIONAL" ? "Акционный" : "В игре"}</span>
          {percent > 0 ? <span className={styles.saleBadge}>−{percent}%</span> : null}
        </span>
      </Link>
      <div className={styles.productBody}>
        <div className={styles.productCategory}>{product.category.name}</div>
        <h2 className={styles.productName}>{product.title}</h2>
        <p className={styles.productDescription}>{product.shortDescription}</p>
        <div className={styles.productFacts}>
          <span><Clock3 aria-hidden="true" />{formatFulfillmentTime(product.estimatedMinutes)}</span>
          <span><Star aria-hidden="true" />{product.ratingAverage > 0 ? product.ratingAverage.toFixed(1) : "Новый"}</span>
          <span><PackageCheck aria-hidden="true" />{product.available ? "В наличии" : "Закончился"}</span>
        </div>
        <div className={styles.priceRow}>
          <div>
            {variant?.activePromotion ? <span className={styles.oldPrice}>{formatShopMoney(variant.priceMinor, currency)}</span> : null}
            <strong className={styles.price}>{price === undefined ? "Цена уточняется" : formatShopMoney(price, currency)}</strong>
          </div>
          <Link href={`/shop/${product.slug}`} className={styles.cardLink}>Купить</Link>
        </div>
      </div>
    </article>
  );
}
