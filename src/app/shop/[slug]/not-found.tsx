import Link from "next/link";
import { PackageX } from "lucide-react";
import styles from "@/components/shop/shop.module.css";

export default function ProductNotFound() {
  return <div className={styles.shell}><div className={styles.empty}><div><PackageX /><h1>Товар не найден</h1><p>Он мог быть отключён, закончиться или сменить адрес.</p><Link className={styles.buttonSecondary} href="/shop">Вернуться в магазин</Link></div></div></div>;
}
