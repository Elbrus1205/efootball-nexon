import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, PackageOpen } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listSellerShopOrders } from "@/lib/shop/order-queries";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Рабочее место продавца" };

export default async function SellerShopPage() {
  const session = await requireAuth();
  const orders = await listSellerShopOrders(session.user.id);
  return <div className={styles.shell}><header className={styles.hero}><div><p className={styles.eyebrow}>Рабочее место исполнителя</p><h1 className={styles.title}>Заказы в работе</h1><p className={styles.lead}>Новый оплаченный заказ одновременно появится здесь и в Telegram. Возьмитесь за работу, свяжитесь с покупателем и отметьте «Монеты куплены» после выполнения.</p></div><BriefcaseBusiness size={30} /></header>{orders.items.length ? <div className={styles.tableWrap} style={{ marginTop: "1.25rem" }}><table className={styles.table}><thead><tr><th>Заказ</th><th>Товар</th><th>Статус</th><th>Сумма</th><th /></tr></thead><tbody>{orders.items.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.items[0]?.productTitle}</td><td><span className={styles.status}>{shopOrderStatusLabels[order.status]}</span></td><td>{formatShopMoney(order.totalMinor, order.currency)}</td><td><Link className={styles.cardLink} href={`/shop/orders/${order.id}`}>{order.status === "WAITING_SELLER" ? "Взяться за работу" : "Открыть"}</Link></td></tr>)}</tbody></table></div> : <div className={styles.empty} style={{ marginTop: "1.25rem" }}><div><PackageOpen /><h2>Назначенных заказов нет</h2><p>Новые оплаченные заказы появятся здесь и придут в Telegram.</p></div></div>}</div>;
}
