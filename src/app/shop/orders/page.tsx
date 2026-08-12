import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, PackageOpen, ShoppingBag, UserRoundCheck } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listBuyerShopOrders } from "@/lib/shop/order-queries";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Мои заказы" };

export default async function ShopOrdersPage() {
  const session = await requireAuth();
  const orders = await listBuyerShopOrders(session.user.id);
  return <div className={styles.shell}><header className={styles.hero}><div><p className={styles.eyebrow}>Оплаченные покупки</p><h1 className={styles.title}>Мои заказы</h1><p className={styles.lead}>Исполнитель назначается автоматически. Контакт и статус доступны в карточке заказа.</p></div><Link className={styles.buttonSecondary} href="/shop"><ShoppingBag size={17} /> В магазин</Link></header>
    {orders.items.length ? <div className={styles.orderList}>{orders.items.map((order) => <Link className={styles.orderCard} href={`/shop/orders/${order.id}`} key={order.id}><div className={styles.orderCardHead}><span>{order.orderNumber}</span><span className={styles.status}>{shopOrderStatusLabels[order.status]}</span></div><h2>{order.items[0]?.productTitle}</h2><div className={styles.orderCardMeta}><span><UserRoundCheck />{order.seller?.user.name ?? "Назначается"}</span><span><CalendarDays />{order.paidAt?.toLocaleDateString("ru-RU") ?? "—"}</span></div><footer><strong>{formatShopMoney(order.totalMinor, order.currency)}</strong><span>Открыть <ArrowUpRight /></span></footer></Link>)}</div> : <div className={styles.empty}><div><PackageOpen /><h2>Оплаченных заказов пока нет</h2><p>После подтверждения оплаты заказ сразу появится здесь.</p><Link className={styles.button} href="/shop">Перейти в магазин</Link></div></div>}
  </div>;
}
