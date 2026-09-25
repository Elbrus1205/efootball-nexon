import styles from "./loading.module.css";
import { SiteLogoMark } from "@/components/brand/site-logo-mark";

export default function Loading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.panel}>
        <div className={styles.logoWrap} aria-hidden="true">
          <SiteLogoMark className={styles.logo} />
        </div>
        <div className={styles.copy}>
          <p>Подождите</p>
          <h2>Загружаем страницу</h2>
          <span>Готовим данные турниров и профиль игрока</span>
        </div>
        <div className={styles.progress} aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
