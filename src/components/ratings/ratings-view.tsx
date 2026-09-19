import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Info, Trophy, Users } from "lucide-react";
import type { Season } from "@prisma/client";
import { Fragment } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ProfileStatusBadge } from "@/components/profile/profile-status-badge";
import type { PlayerRatingRow } from "@/lib/ratings";
import { getRatingPageNumbers, getRatingsPagination, ratingPageHref } from "@/lib/ratings-pagination";
import { formatDate } from "@/lib/utils";
import profile from "@/components/players/player-profile.module.css";
import styles from "./ratings.module.css";

type RatingSeason = Pick<Season, "id" | "name" | "isActive" | "startsAt" | "endsAt">;

type RatingsViewProps = {
  players: PlayerRatingRow[];
  totalPlayers: number;
  page: number;
  currentPlayer: { player: PlayerRatingRow; rank: number } | null;
  seasons: RatingSeason[];
  ratingSeason: RatingSeason | null;
  prizePool: number;
};

const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const ratingFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function PlayerAvatar({ player }: { player: PlayerRatingRow }) {
  return (
    <Avatar className={styles.avatar}>
      <AvatarImage src={player.image ?? undefined} alt="" />
      <AvatarFallback className={styles.avatarFallback}>{player.playerName}</AvatarFallback>
    </Avatar>
  );
}

function RatingChange({ player }: { player: PlayerRatingRow }) {
  const changedAt = player.lastRatingChangeAt ? new Date(player.lastRatingChangeAt).getTime() : NaN;
  const age = Date.now() - changedAt;
  if (!player.lastRatingChange || !Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) return null;
  const positive = player.lastRatingChange > 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={styles.ratingChange} data-positive={positive} aria-label={`Изменение рейтинга: ${positive ? "+" : ""}${ratingFormat.format(player.lastRatingChange)}`}>
      <Icon size={12} aria-hidden="true" />
      {positive ? "+" : ""}{ratingFormat.format(player.lastRatingChange)}
    </span>
  );
}

function SeasonLink({ season, active }: { season: RatingSeason | null; active: boolean }) {
  return (
    <Link
      href={season ? `/ratings?season=${encodeURIComponent(season.id)}` : "/ratings?season=all"}
      className={styles.seasonLink}
      aria-current={active ? "page" : undefined}
      prefetch={false}
    >
      {season?.isActive ? <span className={styles.activeDot} aria-hidden="true" /> : null}
      <span>{season?.name ?? "За всё время"}</span>
      {season && !season.isActive && season.endsAt ? <time dateTime={new Date(season.endsAt).toISOString()}>{formatDate(season.endsAt, "d MMM yyyy")}</time> : null}
    </Link>
  );
}

export function RatingsView({ players, totalPlayers, page, currentPlayer, seasons, ratingSeason, prizePool }: RatingsViewProps) {
  const activeSeasons = seasons.filter((season) => season.isActive);
  const archivedSeasons = seasons.filter((season) => !season.isActive);
  const isArchived = Boolean(ratingSeason && !ratingSeason.isActive);
  const pagination = getRatingsPagination(totalPlayers, String(page));
  const showOwnPosition = currentPlayer && !players.some((player) => player.playerId === currentPlayer.player.playerId);
  const visiblePlayers = showOwnPosition ? [...players, currentPlayer.player] : players;
  const period = ratingSeason?.name ?? "За всё время";
  const panel = `${profile.panel} ${styles.panel}`;

  return (
    <div className={`page-shell ${profile.page} ${styles.page}`}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>eFootball Nexon · Соревновательная платформа</p>
          <h1>Рейтинг игроков</h1>
          <p className={styles.intro}>Сильнейшие игроки Nexon. Каждая победа имеет значение.</p>
        </div>
        <div className={styles.playerCount}><Users size={16} aria-hidden="true" /><span>Игроков в рейтинге <strong>{numberFormat.format(totalPlayers)}</strong></span></div>
      </header>

      <nav className={styles.periodNav} aria-label="Период рейтинга">
        <div className={styles.periodLinks}>
          {activeSeasons.map((season) => <SeasonLink key={season.id} season={season} active={ratingSeason?.id === season.id} />)}
          <SeasonLink season={null} active={!ratingSeason} />
        </div>
        {archivedSeasons.length ? (
          <details className={styles.archive} open={isArchived || undefined}>
            <summary><CalendarDays size={15} aria-hidden="true" />Архив сезонов<ChevronDown size={14} aria-hidden="true" /></summary>
            <div className={styles.archiveLinks}>
              {archivedSeasons.map((season) => <SeasonLink key={season.id} season={season} active={ratingSeason?.id === season.id} />)}
            </div>
          </details>
        ) : null}
      </nav>

      <Card className={`${panel} ${styles.prizePanel}`}>
        <div className={styles.prizeCopy}>
          <div className={styles.sideHeading}><Trophy size={17} strokeWidth={1.5} aria-hidden="true" /><h2>Призовой фонд</h2></div>
          <p className={styles.sideCaption}>10% от фондов завершённых турниров</p>
        </div>
        <p className={styles.prizeValue}>{numberFormat.format(prizePool)}<span>₽</span></p>
      </Card>

      <section aria-labelledby="rating-table-heading" className={styles.tableSection}>
        <Card className={panel}>
          <div className={styles.tableHeading}>
            <div><h2 id="rating-table-heading">Таблица рейтинга</h2><p>{period}</p></div>
            <span className={styles.topLabel}>{totalPlayers ? `${pagination.offset + 1}–${pagination.end}` : "0"} из {numberFormat.format(totalPlayers)}</span>
          </div>
          {visiblePlayers.length ? (
            <table className={styles.table}>
              <caption className={styles.srOnly}>Рейтинг, страница {pagination.page}{showOwnPosition ? " и ваша позиция" : ""}. {period}.</caption>
              <colgroup><col className={styles.rankColumn} /><col /><col className={styles.statColumn} /><col className={styles.statColumn} /><col className={styles.scoreColumn} /></colgroup>
              <thead><tr><th scope="col"><span aria-hidden="true">#</span><span className={styles.srOnly}>Место</span></th><th scope="col">Игрок</th><th scope="col" className={styles.desktopStat}>Матчи</th><th scope="col" className={styles.desktopStat}>Победы</th><th scope="col" aria-sort="descending">Рейтинг</th></tr></thead>
              <tbody>
                {visiblePlayers.map((player, index) => {
                  const isOwn = currentPlayer?.player.playerId === player.playerId;
                  const separated = Boolean(showOwnPosition && index === visiblePlayers.length - 1);
                  const rank = separated ? currentPlayer!.rank : pagination.offset + index + 1;
                  return (
                    <Fragment key={player.playerId}>
                      {separated ? <tr className={styles.separator}><td colSpan={5}><span>···</span>Ваша позиция в общем рейтинге</td></tr> : null}
                      <tr data-own={isOwn} data-pinned={separated}>
                        <td><span className={styles.rank} data-place={rank}>{String(rank).padStart(2, "0")}</span></td>
                        <th scope="row">
                          <div className={styles.playerIdentity}>
                            <PlayerAvatar player={player} />
                            <div className={styles.playerCopy}>
                              <Link href={`/players/${player.playerId}`} prefetch={false} className={styles.playerLink} aria-label={isOwn ? `${player.playerName}, ваша позиция в рейтинге` : undefined}>{player.playerName}</Link>
                              {player.selectedStatuses.length ? <div className={styles.statuses}>{player.selectedStatuses.map((status) => <ProfileStatusBadge key={status.id} status={status} className={styles.statusBadge} />)}</div> : null}
                            </div>
                          </div>
                        </th>
                        <td className={styles.desktopStat}>{numberFormat.format(player.played)}</td>
                        <td className={styles.desktopStat}>{numberFormat.format(player.wins)}</td>
                        <td><div className={styles.score}>{ratingFormat.format(player.rating)}</div><RatingChange player={player} /></td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className={styles.empty}><Trophy size={32} strokeWidth={1.25} aria-hidden="true" /><h3>Здесь начинается история</h3><p>В этом периоде пока нет рейтинга. Первые результаты появятся после подтверждённых матчей.</p><Link href="/tournaments" className={styles.actionLink}>Выбрать турнир<ArrowRight size={16} aria-hidden="true" /></Link></div>
          )}
          {pagination.totalPages > 1 ? (
            <nav className={styles.pagination} aria-label="Страницы рейтинга">
              <span className={styles.pageSummary}>Страница {pagination.page} из {numberFormat.format(pagination.totalPages)}</span>
              <div className={styles.pageLinks}>
                {pagination.page > 1 ? <Link href={ratingPageHref(ratingSeason?.id ?? null, pagination.page - 1)} prefetch={false} rel="prev" aria-label="Предыдущая страница"><ChevronLeft size={15} aria-hidden="true" /></Link> : <span className={styles.disabledPage} aria-disabled="true" aria-label="Предыдущая страница"><ChevronLeft size={15} aria-hidden="true" /></span>}
                {getRatingPageNumbers(pagination.page, pagination.totalPages).map((item) => typeof item === "number" ? (
                  <Link key={item} href={ratingPageHref(ratingSeason?.id ?? null, item)} prefetch={false} aria-label={`Страница ${item}`} aria-current={item === pagination.page ? "page" : undefined}>{item}</Link>
                ) : <span key={item} className={styles.pageGap} aria-hidden="true">…</span>)}
                {pagination.page < pagination.totalPages ? <Link href={ratingPageHref(ratingSeason?.id ?? null, pagination.page + 1)} prefetch={false} rel="next" aria-label="Следующая страница"><ChevronRight size={15} aria-hidden="true" /></Link> : <span className={styles.disabledPage} aria-disabled="true" aria-label="Следующая страница"><ChevronRight size={15} aria-hidden="true" /></span>}
              </div>
            </nav>
          ) : null}
          {visiblePlayers.length ? <div className={styles.tableFoot}><span className={styles.activeDot} aria-hidden="true" />По результатам подтверждённых матчей</div> : null}
        </Card>
      </section>

      <div className={styles.note}><Info size={16} aria-hidden="true" /><p>Рейтинг учитывает результаты матчей и бонусы за призовые места в турнирах. Выберите сезон, чтобы сравнить результаты за один период.</p></div>
    </div>
  );
}
