import Link from "next/link";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlayerPodiumHistory } from "@/lib/services/player-podium";
import type { PodiumPlace } from "@/lib/tournaments/podium";
import styles from "./player-profile.module.css";

function PodiumMedal({ place }: { place: PodiumPlace }) {
  return (
    <svg viewBox="0 0 48 56" className={styles.medal} data-place={place} aria-hidden="true">
      <path d="M12 3h10l6 20-9 4zM26 3h10l-7 24-9-4z" fill="currentColor" opacity=".28" />
      <path d="M12 3h10M26 3h10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="35" r="17" fill="currentColor" opacity=".12" />
      <circle cx="24" cy="35" r="16" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="24" cy="35" r="12.5" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <text x="24" y="41" textAnchor="middle" fill="currentColor" fontFamily="system-ui, sans-serif" fontSize="17" fontWeight="500">{place}</text>
    </svg>
  );
}

export function PlayerPodiumHistoryPanel({ history, basePath, seasonId }: { history: PlayerPodiumHistory; basePath: string; seasonId?: string }) {
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (page > 1) query.set("historyPage", String(page));
    if (seasonId) query.set("season", seasonId);
    return `${basePath}${query.size ? `?${query}` : ""}#profile-podium-heading`;
  };
  return (
    <section aria-labelledby="profile-podium-heading">
      <h2 id="profile-podium-heading" className={styles.groupTitle}>История призовых мест</h2>
      <Card className={styles.panel}>
        {history.entries.length ? (
          <ol className={styles.podiumList}>
            {history.entries.map((item) => (
              <li key={item.id}>
                <Link href={`/tournaments/${item.tournamentId}`} className={styles.podiumRow}>
                  <PodiumMedal place={item.place} />
                  <div className={styles.podiumCopy}>
                    <span className={styles.podiumPlace} data-place={item.place}>{item.place === 1 ? "1 место · Победитель" : `${item.place} место`}</span>
                    <h3>{item.title}</h3>
                    {item.stageLabel ? <p className={styles.podiumStage}>{item.stageLabel}</p> : null}
                    <time dateTime={item.date}>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(item.date))}</time>
                  </div>
                  <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.podiumEmpty}><Trophy size={22} strokeWidth={1.4} aria-hidden="true" /><p>{history.page > 1 || history.hasMore ? "В этих турнирах призовых мест нет. Посмотрите другие результаты." : "Здесь появятся 1-е, 2-е и 3-е места игрока после завершения турниров."}</p></div>
        )}
        {history.page > 1 || history.hasMore ? (
          <nav aria-label="История призовых мест" className={styles.podiumPagination}>
            {history.page > 1 ? <Link href={pageHref(history.page - 1)}><ChevronLeft size={14} />Новее</Link> : <span />}
            {history.hasMore ? <Link href={pageHref(history.page + 1)}>Ранее<ChevronRight size={14} /></Link> : null}
          </nav>
        ) : null}
      </Card>
    </section>
  );
}
