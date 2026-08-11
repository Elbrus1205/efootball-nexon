import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen, ShoppingBag } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listBuyerShopOrders } from "@/lib/shop/order-queries";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Мои заказы" };

export default async function ShopOrdersPage() {
  const session = await requireAuth();
  const orders = await listBuyerShopOrders(session.user.id);
  return <div className={styles.shell}><header className={styles.hero}><div><p className={styles.eyebrow}>Только подтверждённые оплаты</p><h1 className={styles.title}>Мои заказы</h1><p className={styles.lead}>Здесь появляются только оплаченные заказы. Следите за выполнением, связывайтесь с исполнителем в Telegram и подтверждайте получение.</p></div><Link className={styles.buttonSecondary} href="/shop"><ShoppingBag size={17} /> В магазин</Link></header>
    {orders.items.length ? <div className={styles.tableWrap} style={{ marginTop: "1.25rem" }}><table className={styles.table}><thead><tr><th>Заказ</th><th>Товар</th><th>Статус</th><th>Сумма</th><th>Оплачен</th><th /></tr></thead><tbody>{orders.items.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.items[0]?.productTitle}</td><td><span className={styles.status}>{shopOrderStatusLabels[order.status]}</span></td><td>{formatShopMoney(order.totalMinor, order.currency)}</td><td>{order.paidAt?.toLocaleDateString("ru-RU") ?? "—"}</td><td><Link className={styles.cardLink} href={`/shop/orders/${order.id}`}>Открыть</Link></td></tr>)}</tbody></table></div> : <div className={styles.empty} style={{ marginTop: "1.25rem" }}><div><PackageOpen /><h2>Оплаченных заказов пока нет</h2><p>Неоплаченные попытки сюда не попадают. После подтверждения оплаты заказ сразу появится в истории.</p><Link className={styles.button} href="/shop">Перейти в магазин</Link></div></div>}
  </div>;
}
