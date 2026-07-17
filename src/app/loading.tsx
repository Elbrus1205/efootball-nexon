import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.panel}>
        <div className={styles.mark} aria-hidden="true">
          <span>eF</span>
          <strong>N</strong>
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
