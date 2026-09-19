"use client";

import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import profile from "@/components/players/player-profile.module.css";
import styles from "@/components/ratings/ratings.module.css";

export default function RatingsError({ reset }: { reset: () => void }) {
  return (
    <div className={`page-shell ${profile.page} ${styles.page}`}>
      <Card className={`${profile.panel} ${styles.panel}`}>
        <div className={styles.empty} role="alert">
          <h1>Не удалось загрузить рейтинг</h1>
          <p>Сервер временно не отвечает. Попробуйте загрузить страницу ещё раз.</p>
          <button type="button" className={styles.actionLink} onClick={reset}>Повторить загрузку<RefreshCw size={16} aria-hidden="true" /></button>
        </div>
      </Card>
    </div>
  );
}
