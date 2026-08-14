import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getShopOrderForUser } from "@/lib/shop/order-queries";
import { getShopComplaintExpiresAt } from "@/lib/shop/order-policy";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import { getShopSettings } from "@/lib/shop/config";
import { OrderActions } from "@/components/shop/order-actions";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Заказ магазина" };

function telegramUrl(username?: string | null) {
  const normalized = username?.trim().replace(/^@/, "");
  return normalized ? `https://t.me/${encodeURIComponent(normalized)}` : null;
}

export default async function ShopOrderPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await props.params;
  const [order, settings] = await Promise.all([getShopOrderForUser(id, session.user.id), getShopSettings()]);
  const item = order.items[0];
  const isBuyer = order.buyerId === session.user.id;
  const contact = isBuyer ? order.seller?.user : order.buyer;
  const contactUrl = order.paidAt ? telegramUrl(contact?.telegramUsername) : null;
  const complaintExpiresAt = order.paidAt ? getShopComplaintExpiresAt(order.paidAt) : null;

  return <div className={styles.shell}><header className={styles.orderHero}><div><p className={styles.eyebrow}>{order.orderNumber}</p><h1 className={styles.title}>{item?.productTitle ?? "Заказ"}</h1><p className={styles.lead}>{item?.variantName} · {item?.quantity} шт.</p></div><div className={styles.orderHeroMeta}><span className={styles.status}>{shopOrderStatusLabels[order.status] ?? order.status}</span><strong>{formatShopMoney(order.totalMinor, order.currency)}</strong></div></header>
    {contactUrl ? <section className={styles.telegramContact}><span className={styles.telegramIcon}><Send /></span><div><p className={styles.eyebrow}>{isBuyer ? "Назначенный исполнитель" : "Покупатель"}</p><h2>{contact?.name ?? (isBuyer ? "Исполнитель" : "Покупатель")}</h2><p>Контакт доступен сразу после оплаты. Общайтесь напрямую в Telegram.</p></div><Link className={styles.button} href={contactUrl} target="_blank" rel="noreferrer"><MessageCircle /> Написать в Telegram</Link></section> : null}
    <OrderActions orderId={order.id} status={order.status} isBuyer={isBuyer} canComplete={order.seller?.userId === session.user.id} complaintExpiresAt={complaintExpiresAt?.toISOString() ?? null} hasDispute={order.disputes.some((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW")} reviewsUrl={settings.reviewsTelegramUrl} />
    <section className={styles.orderTimelineCard}><h2>История заказа</h2><div className={styles.timeline}>{order.statusHistory.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineDot} /><div className={styles.timelineBody}><strong>{shopOrderStatusLabels[event.newStatus] ?? event.newStatus}</strong><time>{event.createdAt.toLocaleString("ru-RU")}</time>{event.comment ? <p>{event.comment}</p> : null}</div></div>)}</div></section>
  </div>;
}
