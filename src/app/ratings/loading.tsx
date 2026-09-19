import profile from "@/components/players/player-profile.module.css";
import styles from "@/components/ratings/ratings.module.css";

export default function RatingsLoading() {
  return (
    <div className={`page-shell ${profile.page} ${styles.page}`} role="status" aria-label="Загружаем рейтинг игроков">
      <span className={styles.srOnly}>Загружаем рейтинг игроков…</span>
      <div aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.loadingTitle}`} />
        <div className={`${styles.skeleton} ${styles.loadingPrize}`} />
        <div className={`${styles.skeleton} ${styles.loadingRows}`} />
      </div>
    </div>
  );
}
