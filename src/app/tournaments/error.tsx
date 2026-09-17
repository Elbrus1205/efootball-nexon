"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/tournaments/tournament-catalog.module.css";

export default function TournamentsError({ reset }: { reset: () => void }) {
  return (
    <div className={`page-shell ${styles.catalog}`}>
      <div className={styles.empty} role="alert">
        <h1>Не удалось загрузить турниры</h1>
        <p>Проверьте соединение и попробуйте ещё раз.</p>
        <Button variant="secondary" onClick={reset} className={styles.emptyLink}>
          <RefreshCw aria-hidden="true" />Повторить
        </Button>
      </div>
    </div>
  );
}
