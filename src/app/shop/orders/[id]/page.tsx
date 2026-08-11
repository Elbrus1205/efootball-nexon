import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Clock3, LockKeyhole, MessageCircle, ReceiptText, Send, UserRoundCheck } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getShopOrderForUser } from "@/lib/shop/order-queries";
import { getShopPermissionIds } from "@/lib/shop/permissions";
import { formatFulfillmentTime, formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
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
  const [order, permissions] = await Promise.all([getShopOrderForUser(id, session.user.id), getShopPermissionIds(session.user.id)]);
  const item = order.items[0];
  const isBuyer = order.buyerId === session.user.id;
  const isSeller = order.seller?.userId === session.user.id;
  const contact = isBuyer ? order.seller?.user : order.buyer;
  const contactUrl = ["ACCEPTED", "IN_PROGRESS", "SELLER_COMPLETED", "WAITING_BUYER_CONFIRMATION", "COMPLETED", "DISPUTE"].includes(order.status)
    ? telegramUrl(contact?.telegramUsername)
    : null;

  return <div className={styles.shell}>
    <Link href={isSeller ? "/shop/seller" : "/shop/orders"} className={styles.cardLink}><ChevronLeft /> Назад к заказам</Link>
    <header className={styles.hero}><div><p className={styles.eyebrow}>{order.orderNumber}</p><h1 className={styles.title}>{item?.productTitle ?? "Заказ"}</h1><p className={styles.lead}>{item?.variantName} · {item?.quantity} шт. · {formatFulfillmentTime(item?.estimatedMinutes ?? 30)}</p></div><div><span className={styles.status}>{shopOrderStatusLabels[order.status] ?? order.status}</span><div className={styles.detailPrice}>{formatShopMoney(order.totalMinor, order.currency)}</div></div></header>
    <div className={styles.detailGrid}>
      <div>
        {contactUrl ? <section className={styles.telegramContact}><span className={styles.telegramIcon}><Send /></span><div><p className={styles.eyebrow}>Связь по заказу</p><h2>{contact?.name ?? (isBuyer ? "Исполнитель" : "Покупатель")}</h2><p>Общайтесь напрямую в Telegram. Не отправляйте пароли, коды подтверждения и платёжные данные.</p></div><Link className={styles.button} href={contactUrl} target="_blank" rel="noreferrer"><MessageCircle /> Написать в Telegram</Link></section> : order.status !== "COMPLETED" ? <div className={styles.notice}><UserRoundCheck /><div><strong>Контакт появится после принятия заказа</strong><br />Когда исполнитель возьмётся за работу, обе стороны увидят Telegram друг друга.</div></div> : null}

        <section className={styles.adminCard}><h2>Данные для выполнения</h2><div className={styles.summary}>{order.fieldValues.length ? order.fieldValues.map((field) => <div className={styles.summaryRow} key={field.id}><span>{field.label}</span><strong>{field.value}{field.masked ? " (скрыто до принятия)" : ""}</strong></div>) : <div className={styles.summaryRow}><span>Дополнительные данные</span><strong>Не требуются</strong></div>}</div><div className={styles.notice}><LockKeyhole /><div>Секретные данные не отправляются в Telegram. Полные значения доступны только участникам заказа по правилам доступа.</div></div></section>
        <OrderActions orderId={order.id} status={order.status} isBuyer={isBuyer} isSeller={isSeller} canSupport={permissions.includes("shop.support") || permissions.includes("shop.manage")} hasReview={Boolean(order.review)} />
      </div>
      <aside className={styles.detailPanel}><h2 className={styles.sectionTitle}>Статус заказа</h2><div className={styles.timeline}>{order.statusHistory.map((event) => <div className={styles.timelineItem} key={event.id}><span className={styles.timelineDot} /><div className={styles.timelineBody}><strong>{shopOrderStatusLabels[event.newStatus] ?? event.newStatus}</strong><time>{event.createdAt.toLocaleString("ru-RU")}</time>{event.comment ? <p>{event.comment}</p> : null}</div></div>)}</div>
        <div className={styles.trustGrid} style={{ gridTemplateColumns: "1fr", marginTop: "1rem" }}><article className={styles.trustCard}><ReceiptText /><h3>Цена зафиксирована</h3><p>Исполнитель не может изменить сумму заказа.</p></article><article className={styles.trustCard}><UserRoundCheck /><h3>Исполнитель</h3><p>{order.seller ? order.seller.user.name ?? "Назначенный исполнитель" : "Ещё не назначен"}</p></article><article className={styles.trustCard}><Clock3 /><h3>Создан</h3><p>{order.createdAt.toLocaleString("ru-RU")}</p></article></div>
      </aside>
    </div>
  </div>;
}
