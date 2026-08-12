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
  return <div className={styles.shell}><header className={styles.hero}><div><p className={styles.eyebrow}>Рабочее место исполнителя</p><h1 className={styles.title}>Назначенные заказы</h1><p className={styles.lead}>Оплаченный заказ назначается автоматически. Сразу откройте карточку и напишите покупателю в Telegram.</p></div><BriefcaseBusiness size={30} /></header>{orders.items.length ? <div className={styles.orderList}>{orders.items.map((order) => <Link className={styles.orderCard} href={`/shop/orders/${order.id}`} key={order.id}><div className={styles.orderCardHead}><span>{order.orderNumber}</span><span className={styles.status}>{shopOrderStatusLabels[order.status]}</span></div><h2>{order.items[0]?.productTitle}</h2><footer><strong>{formatShopMoney(order.totalMinor, order.currency)}</strong><span>Открыть</span></footer></Link>)}</div> : <div className={styles.empty}><div><PackageOpen /><h2>Назначенных заказов нет</h2><p>Новые оплаченные заказы появятся здесь и сразу придут в Telegram.</p></div></div>}</div>;
}
