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
  return <div className={styles.shell}><header className={styles.hero}><div><p className={styles.eyebrow}>Личный кабинет</p><h1 className={styles.title}>Мои заказы</h1><p className={styles.lead}>Оплата, исполнение, переписка и история статусов собраны в одном месте.</p></div><Link className={styles.buttonSecondary} href="/shop"><ShoppingBag size={17} /> В магазин</Link></header>
    {orders.items.length ? <div className={styles.tableWrap} style={{ marginTop: "1.25rem" }}><table className={styles.table}><thead><tr><th>Заказ</th><th>Товар</th><th>Статус</th><th>Сумма</th><th>Дата</th><th /></tr></thead><tbody>{orders.items.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.items[0]?.productTitle}</td><td><span className={styles.status}>{shopOrderStatusLabels[order.status]}</span></td><td>{formatShopMoney(order.totalMinor, order.currency)}</td><td>{order.createdAt.toLocaleDateString("ru-RU")}</td><td><Link className={styles.cardLink} href={`/shop/orders/${order.id}`}>Открыть</Link></td></tr>)}</tbody></table></div> : <div className={styles.empty} style={{ marginTop: "1.25rem" }}><div><PackageOpen /><h2>Заказов пока нет</h2><p>Выберите товар в магазине — здесь появится его полный путь от оплаты до подтверждения.</p><Link className={styles.button} href="/shop">Перейти в магазин</Link></div></div>}
  </div>;
}
