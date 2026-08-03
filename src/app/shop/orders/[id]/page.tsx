import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Clock3, LockKeyhole, MessageSquareText, ReceiptText, UserRoundCheck } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getShopOrderForUser } from "@/lib/shop/order-queries";
import { getShopPermissionIds } from "@/lib/shop/permissions";
import { formatFulfillmentTime, formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import { OrderActions } from "@/components/shop/order-actions";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Заказ магазина" };

export default async function ShopOrderPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await props.params;
  const [order, permissions] = await Promise.all([getShopOrderForUser(id, session.user.id), getShopPermissionIds(session.user.id)]);
  const item = order.items[0];
  const isBuyer = order.buyerId === session.user.id;
  const isSeller = order.seller?.userId === session.user.id;
  return <div className={styles.shell}>
    <Link href={isSeller ? "/shop/seller" : "/shop/orders"} className={styles.cardLink}><ChevronLeft /> Назад к заказам</Link>
    <header className={styles.hero}><div><p className={styles.eyebrow}>{order.orderNumber}</p><h1 className={styles.title}>{item?.productTitle ?? "Заказ"}</h1><p className={styles.lead}>{item?.variantName} · {item?.quantity} шт. · {formatFulfillmentTime(item?.estimatedMinutes ?? 30)}</p></div><div><span className={styles.status}>{shopOrderStatusLabels[order.status] ?? order.status}</span><div className={styles.detailPrice}>{formatShopMoney(order.totalMinor, order.currency)}</div></div></header>
    <div className={styles.detailGrid}>
      <div>
        <section className={styles.adminCard}><h2>Данные для выполнения</h2><div className={styles.summary}>{order.fieldValues.length ? order.fieldValues.map((field) => <div className={styles.summaryRow} key={field.id}><span>{field.label}</span><strong>{field.value}{field.masked ? " (скрыто до принятия)" : ""}</strong></div>) : <div className={styles.summaryRow}><span>Дополнительные данные</span><strong>Не требуются</strong></div>}</div><div className={styles.notice}><LockKeyhole /><div>Пароли и секретные данные никогда не отправляются в Telegram. Полные значения доступны только участникам заказа по правилам доступа.</div></div></section>
        <section className={styles.section}><h2 className={styles.sectionTitle}>Переписка</h2>{order.messages.length ? <div className={styles.form}>{order.messages.map((message) => <article className={styles.trustCard} key={message.id}><strong>{message.sender.name ?? "Пользователь"}</strong><p>{message.body}</p><small className={styles.helper}>{message.createdAt.toLocaleString("ru-RU")}</small></article>)}</div> : <div className={styles.empty}><div><MessageSquareText /><h3>Сообщений пока нет</h3><p>Используйте форму ниже, если нужно уточнение по заказу.</p></div></div>}</section>
        <OrderActions orderId={order.id} status={order.status} isBuyer={isBuyer} isSeller={isSeller} canSupport={permissions.includes("shop.support") || permissions.includes("shop.manage")} hasReview={Boolean(order.review)} />
      </div>
      <aside className={styles.detailPanel}><h2 className={styles.sectionTitle}>Линия исполнения</h2><div className={styles.timeline}>{order.statusHistory.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineDot} /><div className={styles.timelineBody}><strong>{shopOrderStatusLabels[event.newStatus] ?? event.newStatus}</strong><time>{event.createdAt.toLocaleString("ru-RU")}</time>{event.comment ? <p>{event.comment}</p> : null}</div></div>)}</div>
        <div className={styles.trustGrid} style={{ gridTemplateColumns: "1fr", marginTop: "1rem" }}><article className={styles.trustCard}><ReceiptText /><h3>Цена зафиксирована</h3><p>Продавец не может изменить сумму заказа.</p></article><article className={styles.trustCard}><UserRoundCheck /><h3>Исполнитель</h3><p>{order.seller ? order.seller.user.name ?? "Назначенный продавец" : "Ещё не назначен"}</p></article><article className={styles.trustCard}><Clock3 /><h3>Создан</h3><p>{order.createdAt.toLocaleString("ru-RU")}</p></article></div>
      </aside>
    </div>
  </div>;
}
