import type { ReactNode } from "react";
import styles from "@/components/ratings/ratings.module.css";

export default function RatingsLayout({ children }: { children: ReactNode }) {
  return <div className={styles.surface}>{children}</div>;
}
