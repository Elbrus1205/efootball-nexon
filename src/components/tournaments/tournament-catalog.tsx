import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import { TournamentCard, type TournamentCardTournament } from "./tournament-card";
import { cn } from "@/lib/utils";
import styles from "./tournament-catalog.module.css";

export function TournamentCatalog({ tournaments, archive, page, hasNext }: {
  tournaments: (TournamentCardTournament & { participantsCount: number })[];
  archive: boolean;
  page: number;
  hasNext: boolean;
}) {
  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (archive) query.set("view", "archive");
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/tournaments${query.size ? `?${query}` : ""}`;
  }

  return (
    <section className={styles.catalog}>
      <header className={styles.header}>
        <div><h1>Турниры</h1><p>{archive ? "Завершённые турниры, матчи и результаты." : "Выберите турнир и выходите на поле."}</p></div>
        <nav className={styles.tabs} aria-label="Разделы турниров">
          <Link href="/tournaments" prefetch={false} className={cn(styles.tab, !archive && styles.tabActive)} aria-current={!archive ? "page" : undefined}><Trophy aria-hidden="true" />Текущие</Link>
          <Link href="/tournaments?view=archive" prefetch={false} className={cn(styles.tab, archive && styles.tabActive)} aria-current={archive ? "page" : undefined}><Archive aria-hidden="true" />Архивные турниры</Link>
        </nav>
      </header>
      {tournaments.length ? (
        <div className={styles.grid}>
          {tournaments.map((tournament, index) => <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament.participantsCount} priorityImage={index === 0} />)}
        </div>
      ) : (
        <div className={styles.empty}>
          <Archive aria-hidden="true" strokeWidth={1.5} />
          <h2>{page > 1 ? "На этой странице турниров нет" : archive ? "Архив пока пуст" : "Сейчас нет текущих турниров"}</h2>
          <p>{page > 1 ? "Вернитесь к началу списка." : archive ? "Здесь появятся турниры после завершения." : "Результаты прошлых соревнований доступны в архиве."}</p>
          <Link className={styles.emptyLink} href={page > 1 ? pageHref(1) : archive ? "/tournaments" : "/tournaments?view=archive"}>{page > 1 ? "К первой странице" : archive ? "Текущие турниры" : "Архивные турниры"}<ArrowRight aria-hidden="true" /></Link>
        </div>
      )}
      {page > 1 || hasNext ? (
        <nav className={styles.pagination} aria-label="Страницы турниров">
          {page > 1 ? <Link href={pageHref(page - 1)} rel="prev" prefetch={false}><ArrowLeft aria-hidden="true" />Назад</Link> : <span />}
          <span className={styles.pageNumber} aria-current="page">{page}</span>
          {hasNext ? <Link href={pageHref(page + 1)} rel="next" prefetch={false}>Далее<ArrowRight aria-hidden="true" /></Link> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
