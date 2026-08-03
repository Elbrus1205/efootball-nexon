import { Skeleton } from "@/components/ui/skeleton";
import styles from "@/components/shop/shop.module.css";

export default function ShopLoading() {
  return <div className={styles.shell}><Skeleton className="h-28 w-full" /><div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-72 w-full" />)}</div></div>;
}
