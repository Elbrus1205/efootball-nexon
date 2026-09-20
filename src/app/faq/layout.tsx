import type { ReactNode } from "react";
import styles from "@/components/faq/faq.module.css";

export default function FaqLayout({ children }: { children: ReactNode }) {
  return <div className={styles.surface}>{children}</div>;
}
