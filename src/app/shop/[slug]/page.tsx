import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock3, PackageCheck, ShieldCheck, Star, UserRoundCheck } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getShopProductBySlug } from "@/lib/shop/catalog";
import { getShopAvailability, getShopSettings } from "@/lib/shop/config";
import { formatFulfillmentTime, formatShopMoney } from "@/lib/shop/format";
import { getPaymentReadiness } from "@/lib/shop/payment-provider";
import { CheckoutSheet } from "@/components/shop/checkout-sheet";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getShopProductBySlug(slug);
  return product ? { title: product.title, description: product.shortDescription } : { title: "Товар не найден" };
}

export default async function ShopProductPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const [product, settings, session] = await Promise.all([getShopProductBySlug(slug), getShopSettings(), getCurrentSession()]);
  if (!product) notFound();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id }, select: { telegramId: true } }) : null;
  const availability = getShopAvailability(settings);
  const payment = getPaymentReadiness();
  const variant = product.defaultVariant;
  const currentPrice = variant?.activePromotion?.salePriceMinor ?? variant?.priceMinor;
  return <div className={styles.shell}>
    <Link href="/shop" className={styles.cardLink}><ChevronLeft /> Вернуться в магазин</Link>
    <div className={styles.detailGrid}>
      <div>
        <section className={styles.section}><h2 className={styles.sectionTitle}>Описание и получение</h2><p className={styles.detailDescription}>{product.description}</p><div className={styles.notice}><ShieldCheck /><div><strong>Условия получения</strong><br />{product.fulfillmentTerms}</div></div></section>
        <section className={styles.section}><h2 className={styles.sectionTitle}>Отзывы</h2>{product.reviews.length ? <div className={styles.adminGrid}>{product.reviews.map((review) => <article key={review.id} className={styles.trustCard}><div className={styles.productFacts}><span><Star />{review.rating}/5</span><span>{review.buyerName}</span></div><p>{review.body}</p></article>)}</div> : <div className={styles.empty}><div><Star /><h3>Отзывов пока нет</h3><p>Первый отзыв появится после подтверждённого заказа.</p></div></div>}</section>
      </div>
      <aside className={styles.detailPanel}>
        <p className={styles.eyebrow}>{product.category.name}</p><h1 className={styles.detailTitle}>{product.title}</h1><p className={styles.detailDescription}>{product.shortDescription}</p>
        <div className={styles.productFacts}><span><Clock3 />{formatFulfillmentTime(variant?.estimatedMinutes ?? product.estimatedMinutes)}</span><span><PackageCheck />{product.available ? "В наличии" : "Закончился"}</span><span><Star />{product.ratingAverage > 0 ? product.ratingAverage.toFixed(1) : "Новый товар"}</span></div>
        <div className={styles.detailPrice}>{currentPrice === undefined ? "Цена уточняется" : formatShopMoney(currentPrice, settings.currency)}</div>
        {variant?.activePromotion ? <div className={styles.success}><ShieldCheck /><div>Акционная цена действует до {variant.activePromotion.promotion.endsAt.toLocaleString("ru-RU")}. Таймер показывается только по реальной дате акции.</div></div> : null}
        <CheckoutSheet productId={product.id} productTitle={product.title} variants={product.variants.map((item) => ({ id: item.id, name: item.name, sku: item.sku, priceMinor: item.priceMinor, available: item.available, availableQuantity: item.availableQuantity, estimatedMinutes: item.estimatedMinutes, activePromotion: item.activePromotion ? { salePriceMinor: item.activePromotion.salePriceMinor, discountMinor: item.activePromotion.discountMinor } : null }))} fields={product.fields.map((field) => ({ key: field.key, label: field.label, description: field.description, placeholder: field.placeholder, type: field.type, isRequired: field.isRequired, isSensitive: field.isSensitive, options: Array.isArray(field.optionsJson) ? field.optionsJson.filter((option): option is string => typeof option === "string") : [] }))} termsVersion={settings.termsVersion} currency={settings.currency} authenticated={Boolean(session?.user?.id)} telegramLinked={Boolean(user?.telegramId)} shopAvailable={availability.available} payment={payment} />
        <div className={styles.trustGrid} style={{ gridTemplateColumns: "1fr", marginTop: "1rem" }}><article className={styles.trustCard}><UserRoundCheck /><h3>Продавец назначается безопасно</h3><p>Полные игровые данные открываются продавцу только после принятия заказа.</p></article></div>
      </aside>
    </div>
  </div>;
}
