import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock3, PackageCheck, ShieldCheck, UserRoundCheck } from "lucide-react";
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
  return product ? { title: product.title } : { title: "Товар не найден" };
}

export default async function ShopProductPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const [product, settings, session] = await Promise.all([getShopProductBySlug(slug), getShopSettings(), getCurrentSession()]);
  if (!product) notFound();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id }, select: { telegramId: true, telegramUsername: true } }) : null;
  const availability = getShopAvailability(settings);
  const payment = getPaymentReadiness();
  const variant = product.defaultVariant;
  const currentPrice = variant?.activePromotion?.salePriceMinor ?? variant?.priceMinor;
  return <div className={styles.shell}><div className={styles.productCheckoutPage}><section className={styles.detailPanel}>
    <p className={styles.eyebrow}>{product.category.name}</p><h1 className={styles.detailTitle}>{product.title}</h1>
    <div className={styles.productFacts}><span><Clock3 />{formatFulfillmentTime(variant?.estimatedMinutes ?? product.estimatedMinutes)}</span><span><PackageCheck />{product.available ? "В наличии" : "Закончился"}</span></div>
    <div className={styles.detailPrice}>{currentPrice === undefined ? "Цена уточняется" : formatShopMoney(currentPrice, settings.currency)}</div>
    {variant?.activePromotion ? <div className={styles.success}><ShieldCheck /><div>Акционная цена действует до {variant.activePromotion.promotion.endsAt.toLocaleString("ru-RU")}.</div></div> : null}
    <CheckoutSheet productId={product.id} productTitle={product.title} variants={product.variants.map((item) => ({ id: item.id, name: item.name, sku: item.sku, priceMinor: item.priceMinor, available: item.available, availableQuantity: item.availableQuantity, estimatedMinutes: item.estimatedMinutes, maxPerOrder: item.maxPerOrder, quantityEnabled: item.quantityEnabled, activePromotion: item.activePromotion ? { salePriceMinor: item.activePromotion.salePriceMinor, discountMinor: item.activePromotion.discountMinor } : null }))} fields={product.fields.map((field) => ({ key: field.key, label: field.label, description: field.description, placeholder: field.placeholder, type: field.type, isRequired: field.isRequired, isSensitive: field.isSensitive, options: Array.isArray(field.optionsJson) ? field.optionsJson.filter((option): option is string => typeof option === "string") : [] }))} termsVersion={settings.termsVersion} currency={settings.currency} authenticated={Boolean(session?.user?.id)} telegramLinked={Boolean(user?.telegramId && user?.telegramUsername)} shopAvailable={availability.available} payment={payment} />
    <div className={styles.notice}><UserRoundCheck /><div><strong>Исполнитель назначится автоматически</strong><br />Сразу после подтверждения оплаты обе стороны получат контакты друг друга в Telegram.</div></div>
  </section></div></div>;
}
