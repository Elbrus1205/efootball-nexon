import Image from "next/image";
import styles from "@/components/providers/app-launch-splash.module.css";

export default function Loading() {
  return (
    <div className={`${styles.splash} ${styles.routeSplash}`} role="status" aria-label="Загрузка страницы" aria-busy="true">
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.iconFrame}>
          <span className={styles.iconGlow} aria-hidden="true" />
          <Image src="/icons/icon-192.png" alt="" width={112} height={112} priority className={styles.icon} />
          <span className={styles.scan} aria-hidden="true" />
        </div>
        <div className={styles.brand}><strong>eFootball</strong><span>Nexon</span></div>
        <p>Загружаем арену</p>
        <div className={styles.progress} aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
