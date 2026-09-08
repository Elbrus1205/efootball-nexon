import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { ArrowUpRight, CalendarDays, Check, ChevronRight, CircleDot, MessageCircleMore, Users } from "lucide-react";
import { MatchStatus, ParticipantStatus, TournamentStatus } from "@prisma/client";
import { AndroidDownload } from "@/components/home/android-download";
import { HomeCarousel } from "@/components/home/home-carousel";
import { TopPlayers } from "@/components/home/top-players";
import { ProductCard } from "@/components/shop/product-card";
import { Reveal } from "@/components/shared/reveal";
import { db } from "@/lib/db";
import { getAndroidDownloadUrl, homeLinks } from "@/lib/home-links";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import { getShopSettings } from "@/lib/shop/config";
import { listShopProducts } from "@/lib/shop/catalog";
import { formatDate } from "@/lib/utils";
import shopStyles from "@/components/shop/shop.module.css";
import s from "./home.module.css";

const activeStatuses = [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.AWAITING_START, TournamentStatus.IN_PROGRESS];
const statusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Черновик", REGISTRATION_OPEN: "Регистрация открыта", REGISTRATION_CLOSED: "Набор завершён", AWAITING_START: "Скоро старт", IN_PROGRESS: "Идёт сейчас", COMPLETED: "Завершён",
};

const getHomeData = unstable_cache(async () => {
  const [totalUsers, completedTournaments, playedMatches, prizes, archived, tournaments] = await Promise.all([
    db.user.count(),
    db.tournament.count({ where: { status: TournamentStatus.COMPLETED, isTest: false } }),
    db.match.count({ where: { status: MatchStatus.CONFIRMED, tournament: { isTest: false } } }),
    db.tournament.findMany({ where: { status: TournamentStatus.COMPLETED, isTest: false }, select: { prizePool: true } }),
    getArchivedHomeStats(),
    db.tournament.findMany({ where: { status: { in: activeStatuses }, isTest: false }, orderBy: [{ status: "asc" }, { startsAt: "asc" }], take: 6, select: {
      id: true, title: true, status: true, startsAt: true, maxParticipants: true, prizePool: true, coverImage: true, updatedAt: true,
      _count: { select: { participants: { where: { status: { not: ParticipantStatus.REMOVED } } } } },
    } }),
  ]);
  return {
    playersCount: totalUsers + archived.users,
    tournamentsCount: completedTournaments + archived.tournaments,
    matchesCount: playedMatches,
    awardedPrizePool: archived.prizePool + prizes.reduce((sum, item) => sum + parsePrizePoolValue(item.prizePool), 0),
    tournaments: tournaments.map(({ _count, coverImage, ...tournament }) => ({ ...tournament, participantsCount: _count.participants, coverImage: coverImage ? `/api/tournaments/${tournament.id}/cover?w=1200&h=720&q=84&v=${tournament.updatedAt.getTime()}` : null })),
  };
}, ["home-page-data-v6"], { revalidate: 60 });

const getHomeShopData = unstable_cache(async () => {
  try {
    const settings = await getShopSettings();
    const [products, reviews] = await Promise.all([
      settings.isEnabled && settings.showHomeBlock ? listShopProducts({ popularOnly: true, sort: "popular", pageSize: 3 }) : Promise.resolve({ items: [] }),
      db.shopReview.findMany({ where: { status: "PUBLISHED", deletedAt: null }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 3, select: { id: true, rating: true, body: true, buyerName: true, product: { select: { title: true } } } }),
    ]);
    return { items: products.items, currency: settings.currency, reviewsTelegramUrl: settings.reviewsTelegramUrl, reviews };
  } catch (error) {
    console.warn("Home shop block is unavailable until the shop migration is applied.", error);
    return null;
  }
}, ["home-shop-data-v3"], { revalidate: 120 });

function tournamentCard(tournament: Awaited<ReturnType<typeof getHomeData>>["tournaments"][number], index: number) {
  const percentage = Math.min(100, Math.round((tournament.participantsCount / Math.max(1, tournament.maxParticipants)) * 100));
  return <Link href={`/tournaments/${tournament.id}`} className={s.eventCard} key={tournament.id}>
    <div className={s.eventMedia}>
      {tournament.coverImage ? <Image src={tournament.coverImage} alt="" fill sizes="(max-width: 700px) 82vw, 420px" loading="lazy" className={s.eventImage} /> : <div className={s.eventFallback} aria-hidden="true"><CircleDot /></div>}
      <span className={s.eventNumber}>0{index + 1}</span>
      <span className={`${s.eventStatus} ${tournament.status === TournamentStatus.IN_PROGRESS ? s.eventLive : ""}`}><i />{statusLabels[tournament.status]}</span>
    </div>
    <div className={s.eventBody}>
      <span className={s.eventEyebrow}>EFOOTBALL MOBILE / EVENT</span>
      <h3>{tournament.title}</h3>
      <div className={s.eventMeta}><span><CalendarDays />{formatDate(tournament.startsAt)}</span><span><Users />{tournament.participantsCount}/{tournament.maxParticipants}</span></div>
      <div className={s.eventProgress}><span style={{ width: `${percentage}%` }} /></div>
      <div className={s.eventFooter}><strong>{tournament.prizePool || "Призовой фонд уточняется"}</strong><span>Открыть <ChevronRight /></span></div>
    </div>
  </Link>;
}

function showcaseDate(tournament: Awaited<ReturnType<typeof getHomeData>>["tournaments"][number] | undefined) {
  if (!tournament) return { day: "—", month: "" };
  const parts = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).formatToParts(new Date(tournament.startsAt));
  return { day: parts.find((part) => part.type === "day")?.value ?? "—", month: (parts.find((part) => part.type === "month")?.value ?? "").replace(".", "").toUpperCase() };
}

export default async function HomePage() {
  const [data, shop] = await Promise.all([getHomeData(), getHomeShopData()]);
  const reviewsHref = shop?.reviewsTelegramUrl || homeLinks.telegram;
  const featuredTournament = data.tournaments[0];
  const featuredDate = showcaseDate(featuredTournament);
  const stats = [{ value: data.matchesCount, label: "матчей сыграно" }, { value: data.playersCount, label: "игроков в системе" }, { value: data.tournamentsCount, label: "турниров завершено" }, { value: data.awardedPrizePool, label: "выдано призами", suffix: " ₽" }];
  return <div className={s.home}>
    <section className={s.intro} aria-labelledby="hero-title">
      <div className={s.introGrid} aria-hidden="true" />
      <div className={s.shell}>
        <div className={s.introLayout}>
          <div className={s.introCopy}>
            <p className={s.eyebrow}><span /> NEX / COMPETITIVE PLATFORM / 2026</p>
            <h1 id="hero-title">Твой следующий<br /><em>матч — здесь.</em></h1>
            <p className={s.introLead}>Турниры, расписания и рейтинг игроков eFootball Mobile — в одном спокойном и понятном пространстве.</p>
            <div className={s.introActions}><Link href="/tournaments" className={s.primaryButton}>Смотреть турниры <ArrowUpRight aria-hidden="true" /></Link><Link href="/ratings" className={s.secondaryButton}>Открыть рейтинг <ChevronRight aria-hidden="true" /></Link></div>
            <div className={s.introNote}><span className={s.noteIcon}><Check /></span><span>Официальная платформа матчей<br />с прозрачной турнирной сеткой</span></div>
          </div>
          <div className={s.productStage} aria-label="Обзор турнирной платформы">
            <div className={s.stageRule} aria-hidden="true" /><div className={s.stageLabel}>NEXT EVENT <span>01 / 03</span></div>
            <div className={s.stageCardMain}><div className={s.stageCardTop}><span className={s.stageLive}><i /> {featuredTournament ? statusLabels[featuredTournament.status] : "NEXON EVENTS"}</span><span>eFootball mobile</span></div><div className={s.stageDate}>{featuredDate.day} <small>{featuredDate.month}</small></div><h2>{featuredTournament?.title || "Новый турнир скоро"}</h2><p>{featuredTournament ? `${featuredTournament.participantsCount} / ${featuredTournament.maxParticipants} мест занято` : "Следи за анонсами и входи в новую сетку"}</p><Link href={featuredTournament ? `/tournaments/${featuredTournament.id}` : "/tournaments"}>Открыть событие <ArrowUpRight /></Link></div>
            <div className={`${s.stageCardSmall} ${s.stageMatch}`}><span>MATCH CENTER</span><strong>Твои матчи</strong><div className={s.stageMessage}>Расписание<br />всегда рядом</div></div>
            <div className={`${s.stageCardSmall} ${s.stageRank}`}><span>PLAYER RANKING</span><strong>TOP</strong><div>Рейтинг строится<br />по реальным матчам</div></div>
          </div>
        </div>
        <div className={s.introStats}>{stats.map((stat) => <div key={stat.label}><strong>{stat.value.toLocaleString("ru-RU")}{stat.suffix}</strong><span>{stat.label}</span></div>)}</div>
      </div>
    </section>

    <section className={s.section} aria-labelledby="events-title"><div className={s.shell}><Reveal><div className={s.sectionHeader}><div><p className={s.eyebrow}><span /> Турнирный центр</p><h2 id="events-title">События, в которые<br /><em>хочется войти.</em></h2></div><Link href="/tournaments" className={s.headerLink}>Все турниры <ArrowUpRight /></Link></div></Reveal><HomeCarousel count={data.tournaments.length} label="Ближайшие турниры">{data.tournaments.map(tournamentCard)}</HomeCarousel></div></section>

    <section className={`${s.section} ${s.processSection}`} aria-labelledby="process-title"><div className={s.shell}><div className={s.processLayout}><Reveal><div><p className={s.eyebrow}><span /> Простая система</p><h2 id="process-title">От заявки<br /><em>до финала.</em></h2><p className={s.sectionLead}>Всё, что нужно для честного матча, собрано в одном маршруте.</p><Link href="/regulations" className={s.secondaryButton}>Посмотреть регламент <ArrowUpRight /></Link></div></Reveal><div className={s.steps}>{[["01", "Выбери турнир", "Проверь формат и войди в сетку."], ["02", "Получи матч", "Соперник и расписание всегда рядом."], ["03", "Зафиксируй счёт", "Отправь результат после игры."], ["04", "Поднимайся выше", "Рейтинг растёт с каждой победой."]].map(([number, title, text]) => <Reveal key={number}><div className={s.step}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div></Reveal>)}</div></div></div></section>

    <section className={`${s.section} ${s.rankSection}`} aria-labelledby="rank-title"><div className={s.shell}><div className={s.rankLayout}><Reveal><div className={s.rankIntro}><p className={s.eyebrow}><span /> Таблица игроков</p><h2 id="rank-title">Имя в игре.<br /><em>Место в истории.</em></h2><p className={s.sectionLead}>Рейтинг строится на реальных подтверждённых матчах — без ручных списков и случайных очков.</p><Link href="/ratings" className={s.headerLink}>Весь рейтинг <ArrowUpRight /></Link></div></Reveal><Reveal className={s.rankBoard}><div className={s.boardHeader}><span>TOP PLAYERS</span><span>SEASON / 2026</span></div><Suspense fallback={<div className={s.emptyInline}>Загружаем рейтинг…</div>}><TopPlayers /></Suspense></Reveal></div></div></section>

    <section className={`${s.section} ${s.appSection}`} aria-labelledby="app-title"><div className={s.shell}><div className={s.appPanel}><div className={s.appCopy}><p className={s.eyebrow}><span /> Android experience</p><h2 id="app-title">Турниры<br /><em>всегда под рукой.</em></h2><p>Следи за матчами, расписанием и результатами там, где начинается игра.</p><AndroidDownload downloadUrl={getAndroidDownloadUrl()} /></div><div className={s.phone} aria-hidden="true"><div className={s.phoneScreen}><span className={s.phoneNotch} /><div className={s.phoneBrand}>NEXON <small>mobile football</small></div><div className={s.phoneScore}><small>UPCOMING MATCH</small><strong>LIVE</strong><span>TOURNAMENT CENTER</span></div><div className={s.phoneRows}><span /><span /><span /></div></div></div></div></div></section>

    {shop?.items.length ? <section className={s.section} aria-labelledby="shop-title"><div className={s.shell}><div className={s.sectionHeader}><div><p className={s.eyebrow}><span /> Nexon market</p><h2 id="shop-title">Полезное<br /><em>для игры.</em></h2></div><Link href="/shop" className={s.headerLink}>Открыть магазин <ArrowUpRight /></Link></div><div className={shopStyles.grid}>{shop.items.map((product) => <ProductCard key={product.id} product={product} currency={shop.currency} />)}</div></div></section> : null}

    <section className={`${s.section} ${s.communitySection}`} aria-labelledby="community-title"><div className={s.shell}><div className={s.communityPanel}><div><p className={s.eyebrow}><span /> Сообщество Nexon</p><h2 id="community-title">Игра продолжается<br /><em>вне поля.</em></h2><p>Анонсы турниров, расписания и новости сезона — в официальном Telegram.</p><Link href={homeLinks.telegram} target="_blank" rel="noreferrer" className={s.primaryButton}>Telegram community <ArrowUpRight /></Link></div><div className={s.communityAside}><MessageCircleMore /><span>OFFICIAL<br />CHANNEL</span><strong>@efootball_nexon</strong></div></div></div></section>

    <section className={`${s.section} ${s.reviewSection}`} aria-labelledby="reviews-title"><div className={s.shell}><Link href={reviewsHref} target="_blank" rel="noreferrer" className={s.reviewPanel}><div><p className={s.eyebrow}><span /> Голоса сообщества</p><h2 id="reviews-title">Реальные люди.<br /><em>Реальная игра.</em></h2></div><div className={s.reviewArrow}><ArrowUpRight /></div></Link></div></section>
  </div>;
}
