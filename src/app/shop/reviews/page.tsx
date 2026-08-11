import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MessageSquareText, Star } from "lucide-react";
import { db } from "@/lib/db";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Отзывы магазина" };

export default async function ShopReviewsPage() {
  const reviews = await db.shopReview.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    include: {
      product: { select: { title: true, slug: true } },
      buyer: { select: { publicId: true, name: true, image: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return <div className={styles.shell}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>Отзывы настоящих игроков</p><h1 className={styles.title}>Проверенные покупки</h1><p className={styles.lead}>Каждый отзыв привязан к полностью оплаченному и подтверждённому заказу.</p></div><Link className={styles.buttonSecondary} href="/shop">В магазин</Link></header>
    {reviews.length ? <div className={styles.reviewGrid}>{reviews.map((review) => <article className={styles.reviewCard} key={review.id}><div className={styles.reviewAuthor}>{review.buyer.image ? <Image src={review.buyer.image} alt="" width={44} height={44} className={styles.reviewAvatar} /> : <span className={styles.reviewAvatarFallback}>{(review.buyer.name ?? review.buyerName).slice(0, 1).toUpperCase()}</span>}<div><Link href={`/players/${review.buyer.publicId}`}>{review.buyer.name ?? review.buyerName}</Link><span><BadgeCheck /> Подтверждённая покупка</span></div><time>{(review.publishedAt ?? review.createdAt).toLocaleDateString("ru-RU")}</time></div><div className={styles.reviewStars} aria-label={`${review.rating} из 5`}>{[1,2,3,4,5].map((star) => <Star key={star} fill={star <= review.rating ? "currentColor" : "none"} />)}</div><h2><Link href={`/shop/${review.product.slug}`}>{review.product.title}</Link></h2><p>{review.body}</p>{review.tags.length ? <div className={styles.categoryRail}>{review.tags.map((tag) => <span className={styles.chip} key={tag}>{tag}</span>)}</div> : null}</article>)}</div> : <div className={styles.empty} style={{ marginTop: "1.25rem" }}><div><MessageSquareText /><h2>Отзывов пока нет</h2><p>Отзывы появятся после первых подтверждённых заказов.</p></div></div>}
  </div>;
}
