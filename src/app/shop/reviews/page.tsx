import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Star } from "lucide-react";
import { db } from "@/lib/db";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Отзывы магазина" };

export default async function ShopReviewsPage() {
  const reviews = await db.shopReview.findMany({ where: { status: "PUBLISHED", deletedAt: null }, include: { product: { select: { title: true, slug: true } } }, orderBy: { publishedAt: "desc" }, take: 50 });
  return <div className={styles.shell}><header className={styles.hero}><div><p className={styles.eyebrow}>Только завершённые заказы</p><h1 className={styles.title}>Отзывы</h1><p className={styles.lead}>Один заказ — один отзыв. Публикации привязаны к реально завершённым покупкам.</p></div><Link className={styles.buttonSecondary} href="/shop">В магазин</Link></header>{reviews.length ? <div className={styles.adminGrid} style={{ marginTop: "1.25rem" }}>{reviews.map((review) => <article className={styles.trustCard} key={review.id}><div className={styles.productFacts}><span><Star />{review.rating}/5</span><span>{review.buyerName}</span></div><h2 className={styles.productName}><Link href={`/shop/${review.product.slug}`}>{review.product.title}</Link></h2><p>{review.body}</p>{review.tags.length ? <div className={styles.categoryRail}>{review.tags.map((tag) => <span className={styles.chip} key={tag}>{tag}</span>)}</div> : null}</article>)}</div> : <div className={styles.empty} style={{ marginTop: "1.25rem" }}><div><MessageSquareText /><h2>Отзывов пока нет</h2><p>Отзывы появятся после первых завершённых заказов.</p></div></div>}</div>;
}
