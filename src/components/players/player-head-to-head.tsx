import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Swords, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlayerHeadToHeadHistory, PlayerHeadToHeadResult } from "@/lib/services/player-head-to-head";
import styles from "./player-profile.module.css";

const resultLabels: Record<PlayerHeadToHeadResult, string> = {
  WIN: "Победа",
  DRAW: "Ничья",
  LOSS: "Поражение",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Moscow",
});

export function PlayerHeadToHeadPanel({
  history,
  basePath,
  seasonId,
  opponentName,
}: {
  history: PlayerHeadToHeadHistory;
  basePath: string;
  seasonId?: string;
  opponentName: string;
}) {
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (page > 1) query.set("matchesPage", String(page));
    if (seasonId) query.set("season", seasonId);
    return `${basePath}${query.size ? `?${query}` : ""}#profile-head-to-head-heading`;
  };

  return (
    <section aria-labelledby="profile-head-to-head-heading">
      <h2 id="profile-head-to-head-heading" className={styles.groupTitle}>Личные встречи</h2>
      <Card className={styles.panel}>
        <div className={styles.headToHeadHeader}>
          <div className={styles.headToHeadIcon} aria-hidden="true"><Swords size={18} strokeWidth={1.6} /></div>
          <div className={styles.headToHeadCopy}>
            <h3>Матчи с {opponentName}</h3>
            <p>{history.total ? `${history.total} ${history.total === 1 ? "встреча" : history.total < 5 ? "встречи" : "встреч"}` : "Пока без общих матчей"}</p>
          </div>
        </div>

        {history.entries.length ? (
          <ol className={styles.headToHeadList}>
            {history.entries.map((match) => (
              <li key={match.id}>
                <div className={styles.headToHeadRow}>
                  <div className={styles.headToHeadResult} data-result={match.result}>
                    <span>{resultLabels[match.result]}</span>
                  </div>
                  <div className={styles.headToHeadDetails}>
                    <Link href={`/tournaments/${match.tournamentId}`} className={styles.headToHeadTournament}>
                      <Trophy size={14} aria-hidden="true" />
                      <span>{match.tournamentTitle}</span>
                    </Link>
                    <p>{match.stageName ? `${match.stageName} · ` : ""}Раунд {match.round}, матч {match.matchNumber}</p>
                    <time dateTime={match.date}><CalendarDays size={13} aria-hidden="true" />{dateFormatter.format(new Date(match.date))}</time>
                  </div>
                  <div className={styles.headToHeadScore} aria-label={`${match.playerScore}:${match.opponentScore}`}>
                    <strong>{match.playerScore}:{match.opponentScore}</strong>
                    <span>ваш счёт</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.headToHeadEmpty}>
            <Swords size={20} aria-hidden="true" />
            <p>{history.page > 1 ? "На этой странице встреч нет. Вернитесь к более новым матчам." : "Подтверждённые встречи появятся здесь после первого матча."}</p>
          </div>
        )}

        {history.page > 1 || history.hasMore ? (
          <nav aria-label="История личных встреч" className={styles.headToHeadPagination}>
            {history.page > 1 ? <Link href={pageHref(history.page - 1)}><ChevronLeft size={14} /> Новее</Link> : <span />}
            {history.hasMore ? <Link href={pageHref(history.page + 1)}>Ранее <ChevronRight size={14} /></Link> : null}
          </nav>
        ) : null}
      </Card>
    </section>
  );
}
