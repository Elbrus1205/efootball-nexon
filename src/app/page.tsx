import Link from "next/link";
import type { CSSProperties } from "react";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  BadgeCheck,
  Coins,
  Gamepad2,
  Radio,
  Send,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { MatchStatus, Prisma, TournamentStatus } from "@prisma/client";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { TournamentCarousel, type CarouselTournament } from "@/components/home/tournament-carousel";
import { Reveal } from "@/components/shared/reveal";
import { db } from "@/lib/db";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import s from "./home.module.css";

const home = s.home;

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";
const marketHref = "https://t.me/eFootballNexonMarketBot";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

const formatLabels: Record<string, string> = {
  LEAGUE: "Лига",
  GROUPS_PLAYOFF: "Группы + плей-офф",
  SINGLE_ELIMINATION: "Плей-офф",
  DOUBLE_ELIMINATION: "Double elimination",
  SWISS: "Швейцарка",
  CUSTOM: "Кастомный формат",
};

type StatusMeta = { label: string; tone: CarouselTournament["statusTone"] };

function statusMeta(status: string): StatusMeta {
  switch (status) {
    case TournamentStatus.IN_PROGRESS:
      return { label: "В эфире", tone: "live" };
    case TournamentStatus.REGISTRATION_OPEN:
      return { label: "Идёт набор", tone: "open" };
    case TournamentStatus.AWAITING_START:
    case TournamentStatus.REGISTRATION_CLOSED:
      return { label: "Скоро старт", tone: "soon" };
    case TournamentStatus.COMPLETED:
      return { label: "Завершён", tone: "done" };
    default:
      return { label: "Черновик", tone: "done" };
  }
}

type TournamentRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: Date;
  maxParticipants: number;
  prizePool: string | null;
  format: string;
  hasCoverImage: boolean;
  updatedAt: Date;
  participants: number;
};

const getHomeData = unstable_cache(
  async () => {
    const [totalUsers, completedTournaments, playedMatches, completedTournamentPrizes, archivedHomeStats, tournamentRows] =
      await Promise.all([
        db.user.count(),
        db.tournament.count({ where: { status: TournamentStatus.COMPLETED, isTest: false } }),
        db.match.count({ where: { status: MatchStatus.CONFIRMED, tournament: { isTest: false } } }),
        db.tournament.findMany({
          where: { status: TournamentStatus.COMPLETED, isTest: false },
          select: { prizePool: true },
        }),
        getArchivedHomeStats(),
        db.$queryRaw<TournamentRow[]>(Prisma.sql`
          SELECT
            t.id, t.slug, t.title, t.status::text AS status, t."startsAt",
            t."maxParticipants", t."prizePool", t.format::text AS format,
            (t."coverImage" IS NOT NULL AND t."coverImage" <> '') AS "hasCoverImage",
            t."updatedAt",
            (
              SELECT COUNT(*)::int FROM "TournamentRegistration" p
              WHERE p."tournamentId" = t.id AND p.status <> 'REMOVED'::"ParticipantStatus"
            ) AS participants
          FROM "Tournament" t
          WHERE t."isTest" = false
          ORDER BY
            (CASE t.status
              WHEN 'IN_PROGRESS' THEN 0
              WHEN 'REGISTRATION_OPEN' THEN 1
              WHEN 'AWAITING_START' THEN 2
              WHEN 'REGISTRATION_CLOSED' THEN 3
              WHEN 'DRAFT' THEN 4
              WHEN 'COMPLETED' THEN 5
              ELSE 6
            END),
            t."startsAt" DESC
          LIMIT 8
        `),
      ]);

    const playersCount = Math.max(totalUsers + archivedHomeStats.users, 240);
    const tournamentsCount = completedTournaments + archivedHomeStats.tournaments;
    const matchesCount = playedMatches;
    const awardedPrizePool =
      archivedHomeStats.prizePool +
      completedTournamentPrizes.reduce((sum, tournament) => sum + parsePrizePoolValue(tournament.prizePool), 0);

    const tournaments: CarouselTournament[] = tournamentRows.map((row) => {
      const meta = statusMeta(row.status);
      const prizeValue = parsePrizePoolValue(row.prizePool);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        statusLabel: meta.label,
        statusTone: meta.tone,
        dateLabel: dateFormatter.format(new Date(row.startsAt)),
        formatLabel: formatLabels[row.format] ?? "Турнир",
        prizeLabel: prizeValue ? `${new Intl.NumberFormat("ru-RU").format(prizeValue)} ₽` : null,
        participants: row.participants,
        maxParticipants: row.maxParticipants,
        coverUrl: row.hasCoverImage ? `/api/tournaments/${row.id}/cover?v=${row.updatedAt.getTime()}` : null,
      };
    });

    return { playersCount, tournamentsCount, matchesCount, awardedPrizePool, tournaments };
  },
  ["home-page-data-v2"],
  { revalidate: 300 },
);

// Broadcast texture — real club crests already shipped in /public/club-badges.
const tickerFixtures = [
  { home: "real-madrid", away: "barcelona", homeName: "RMA", awayName: "BAR", score: "2 : 1", state: "68'" },
  { home: "manchester-city", away: "liverpool", homeName: "MCI", awayName: "LIV", score: "1 : 1", state: "LIVE" },
  { home: "milan", away: "inter-milan", homeName: "MIL", awayName: "INT", score: "0 : 2", state: "FT" },
  { home: "arsenal", away: "chelsea", homeName: "ARS", awayName: "CHE", score: "3 : 0", state: "FT" },
  { home: "juventus", away: "napoli-big-2024-768x768", homeName: "JUV", awayName: "NAP", score: "1 : 2", state: "81'" },
  { home: "psg-big-768x768", away: "monaco", homeName: "PSG", awayName: "ASM", score: "2 : 2", state: "LIVE" },
];

export default async function HomePage() {
  const { playersCount, tournamentsCount, matchesCount, awardedPrizePool, tournaments } = await getHomeData();

  const stats = [
    { icon: Users, value: playersCount, suffix: "+", label: "Игроков" },
    { icon: Trophy, value: tournamentsCount, suffix: "", label: "Турниров сыграно" },
    { icon: Swords, value: matchesCount, suffix: "", label: "Матчей проведено" },
    { icon: Coins, value: awardedPrizePool, suffix: " ₽", label: "Разыграно призов" },
  ];

  const features = [
    {
      icon: Trophy,
      gold: true,
      title: "Сетки и живой счёт",
      text: "Автоматические группы и плей-офф, понятный путь от квалификации до финала. Счёт обновляется по ходу турнира.",
    },
    {
      icon: ShieldCheck,
      gold: false,
      title: "Честная модерация",
      text: "Каждый результат подтверждается, спорные матчи разбирает администрация.",
    },
    {
      icon: Zap,
      gold: false,
      title: "Уведомления в реальном времени",
      text: "Оповещения о старте матча, сопернике и результате приходят мгновенно.",
    },
  ];

  const marketItems = [
    {
      icon: Gamepad2,
      tag: "Аккаунты",
      title: "Готовые составы",
      text: "Проверенные аккаунты eFootball с сильными карточками и рейтингом.",
    },
    {
      icon: Coins,
      tag: "GP и монеты",
      title: "Внутриигровая валюта",
      text: "Пополнение GP и eFootball Coins по курсу сообщества, без переплат.",
    },
    {
      icon: BadgeCheck,
      tag: "Буст",
      title: "Прокачка и буст",
      text: "Помощь с прокачкой профиля и рейтинга под конкретную задачу.",
    },
  ];

  return (
    <div className="-mt-16 sm:-mt-[72px] lg:-mt-20">
      <main className={home}>
        {/* ============================ HERO ============================ */}
        <section className={s.heroWrap} aria-label="eFootball Nexon">
          <div className={s.heroBg} aria-hidden="true">
            <video
              className={s.heroVideo}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/images-site/home-hero-poster.jpg"
            >
              <source src="/videos/home-hero-stadium.webm" type="video/webm" />
              <source src="/videos/home-hero-stadium.mp4" type="video/mp4" />
            </video>
            <div className={s.heroGrade} />
            <div className={s.heroGridlines} />
            <div className={s.heroGlow} />
          </div>

          <div className={s.heroInner}>
            <div className={s.heroLeft}>
              <div className={s.statusRow}>
                <span className={s.livePill}>
                  <span />
                  Live
                </span>
                <span className={s.statusDivider} />
                eFootball Mobile · Сезон 2026
              </div>

              <h1 className={s.heroTitle}>
                <span className={s.heroTitleLine}>Каждый матч —</span>
                <span className={`${s.heroTitleLine} ${s.heroTitleAccent}`}>твой выход</span>
                <span className={s.heroTitleLine}>на поле</span>
              </h1>

              <p className={s.heroLede}>
                Турнирная платформа eFootball Nexon: собираем сетки, ведём счёт в прямом эфире и следим за честностью
                результатов. Регистрируйся, играй, поднимайся в рейтинге.
              </p>

              <div className={s.heroActions}>
                <Link href="/tournaments" className={s.solidButton}>
                  <Trophy className="h-5 w-5" />
                  Смотреть турниры
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/register" className={s.ghostButton}>
                  <Swords className="h-4 w-4" />
                  Начать играть
                </Link>
              </div>
            </div>

            {/* Signature: live fixture card */}
            <aside className={s.fixture} aria-label="Матч в прямом эфире">
              <div className={s.fixtureTop}>
                <span>Кубок · 1/4 финала</span>
                <span className={s.fixtureLive}>
                  <span />
                  Live
                </span>
              </div>

              <div className={s.fixtureBody}>
                <div className={s.fixtureTeam}>
                  <span className={s.fixtureCrest}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/club-badges/real-madrid.png" alt="" loading="lazy" />
                  </span>
                  <span className={s.fixtureTeamName}>Nexus FC</span>
                </div>

                <div className={s.fixtureScore}>
                  <span className={s.fixtureScoreNums}>2 : 1</span>
                  <span className={s.fixtureMinute}>74&apos;</span>
                </div>

                <div className={s.fixtureTeam}>
                  <span className={s.fixtureCrest}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/club-badges/manchester-city.png" alt="" loading="lazy" />
                  </span>
                  <span className={s.fixtureTeamName}>Vortex United</span>
                </div>
              </div>

              <div className={s.fixtureFoot}>
                <span>Best of 3 · Матч 2</span>
                <span className={s.fixtureFootHot}>Победитель — в полуфинал</span>
              </div>
            </aside>
          </div>

          <div className={s.scrollCue} aria-hidden="true">
            <span className={s.scrollTrack}>
              <span className={s.scrollThumb} />
            </span>
            <span className={s.scrollLabel}>Листай</span>
          </div>
        </section>

        {/* ============================ LIVE TICKER ============================ */}
        <div className={s.ticker} aria-hidden="true">
          <span className={s.tickerLabel}>
            <span />
            Табло
          </span>
          <div className={s.tickerViewport}>
            <div className={s.tickerRow}>
              {[...tickerFixtures, ...tickerFixtures].map((fixture, index) => (
                <span className={s.tickerItem} key={`${fixture.home}-${index}`}>
                  {fixture.homeName}
                  <span className={s.tickerScoreVal}>{fixture.score}</span>
                  {fixture.awayName}
                  {fixture.state === "FT" ? (
                    <span className={s.tickerFin}>FT</span>
                  ) : (
                    <span className={s.tickerFin} style={{ color: "var(--ice)" } as CSSProperties}>
                      {fixture.state}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ============================ WHY US ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.head}>
              <div className={s.headText}>
                <span className={s.eyebrow}>Платформа</span>
                <h2 className={s.title}>Всё для соревновательной игры</h2>
                <p className={s.titleSub}>
                  От заявки до трофея — на одной платформе. Ниже то, что отличает турниры Nexon от игры в переписке.
                </p>
              </div>
            </div>
          </Reveal>

          <div className={s.bento}>
            {features.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 90} className={s.bentoCard}>
                <span className={`${s.bentoIcon} ${feature.gold ? s.bentoGold : ""}`}>
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className={s.bentoCardTitle}>{feature.title}</h3>
                <p className={s.bentoCardText}>{feature.text}</p>
              </Reveal>
            ))}

            <Reveal delay={270} className={s.bentoCardWide}>
              <div className={s.bentoWideGrid}>
                <div className={s.bentoWideStat}>4 шага</div>
                <div>
                  <h3 className={s.bentoCardTitle}>Регистрация → группы → плей-офф → трофей</h3>
                  <p className={s.bentoCardText}>
                    Понятный путь без хаоса: подал заявку, сыграл групповой этап, прошёл сетку на вылет и забрал приз.
                    Расписание и соперники всегда под рукой в профиле.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================ TOURNAMENTS ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.head}>
              <div className={s.headText}>
                <span className={s.eyebrow}>Турниры</span>
                <h2 className={s.title}>Ближайшие события</h2>
              </div>
              <Link href="/tournaments" className={s.ghostButton}>
                Все турниры
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal>
            <TournamentCarousel tournaments={tournaments} />
          </Reveal>
        </section>

        {/* ============================ MARKET ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.head}>
              <div className={s.headText}>
                <span className={s.eyebrow}>Маркет</span>
                <h2 className={s.title}>Магазин сообщества</h2>
                <p className={s.titleSub}>
                  Аккаунты, валюта и буст от проверенных продавцов. Сделки идут в Telegram-маркете.
                </p>
              </div>
              <Link href={marketHref} target="_blank" rel="noreferrer" className={s.solidButton}>
                <ShoppingBag className="h-5 w-5" />
                Открыть маркет
              </Link>
            </div>
          </Reveal>

          <div className={s.market}>
            {marketItems.map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <Link href={marketHref} target="_blank" rel="noreferrer" className={s.marketCard}>
                  <span className={s.marketTag}>{item.tag}</span>
                  <span className={s.marketIcon}>
                    <item.icon className="h-6 w-6" />
                  </span>
                  <h3 className={s.marketTitle}>{item.title}</h3>
                  <p className={s.marketText}>{item.text}</p>
                  <span className={s.marketFoot}>
                    В Telegram-маркет
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ============================ SCOREBOARD (STATS) ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.scoreboard}>
              <div className={s.scoreboardGrid}>
                {stats.map((stat) => (
                  <div key={stat.label} className={s.scoreCell}>
                    <span className={s.scoreIcon}>
                      <stat.icon className="h-5 w-5" />
                    </span>
                    <div className={s.scoreValue}>
                      <AnimatedCounter value={stat.value} />
                      <span className={s.scoreSuffix}>{stat.suffix}</span>
                    </div>
                    <div className={s.scoreLabel}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ============================ COMMUNITY ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.community}>
              <span className={s.eyebrow}>Сообщество</span>
              <h2 className={s.communityTitle}>Присоединяйся к сообществу</h2>
              <p className={s.communityText}>
                Анонсы турниров, результаты матчей и разборы — в наших каналах. Выбирай, где тебе удобнее.
              </p>

              <div className={s.socialGrid}>
                <Link
                  href={telegramHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${s.socialCard} ${s.socialTelegram}`}
                  aria-label="Telegram-канал eFootball Nexon"
                >
                  <span className={s.socialIcon}>
                    <TelegramGlyph />
                  </span>
                  <span className={s.socialName}>Telegram-канал</span>
                  <span className={s.socialMeta}>Анонсы турниров, расписание и новости лиги.</span>
                  <span className={s.socialArrow}>
                    <Send className="h-4 w-4" />
                    Подписаться
                  </span>
                </Link>

                <Link
                  href={vkHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${s.socialCard} ${s.socialVk}`}
                  aria-label="Сообщество ВКонтакте eFootball Nexon"
                >
                  <span className={s.socialIcon}>
                    <VkGlyph />
                  </span>
                  <span className={s.socialName}>ВКонтакте</span>
                  <span className={s.socialMeta}>Сообщество игроков, обсуждения и клипы матчей.</span>
                  <span className={s.socialArrow}>
                    <Radio className="h-4 w-4" />
                    Вступить
                  </span>
                </Link>

                <Link
                  href={marketHref}
                  target="_blank"
                  rel="noreferrer"
                  className={`${s.socialCard} ${s.socialMarket}`}
                  aria-label="Telegram-маркет eFootball Nexon"
                >
                  <span className={s.socialIcon}>
                    <ShoppingBag className="h-5 w-5" />
                  </span>
                  <span className={s.socialName}>Telegram-маркет</span>
                  <span className={s.socialMeta}>Аккаунты, валюта и буст от продавцов сообщества.</span>
                  <span className={s.socialArrow}>
                    <ArrowRight className="h-4 w-4" />
                    Перейти
                  </span>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
}

/* Local glyphs so social icons stay on-brand without new deps. */
function TelegramGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M21.6 4.2c.2-1-.7-1.7-1.6-1.3L2.8 9.5c-1.1.4-1 2 .1 2.3l4.4 1.4 1.7 5.2c.4 1.1 1.8 1.4 2.5.5l2.5-3 4.4 3.3c.8.6 1.9.1 2.1-.9l3.1-14.1Zm-5.9 3.4-6.5 5.8-.3 3 1.1-2.2 6.9-6.1c.4-.4-.1-.8-.6-.5Z" />
    </svg>
  );
}

function VkGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M12.785 17.58c-5.09 0-7.994-3.49-8.115-9.295H7.22c.084 4.26 1.963 6.064 3.452 6.435V8.285h2.4v3.673c1.47-.158 3.012-1.832 3.533-3.673h2.4c-.4 2.27-2.074 3.944-3.266 4.632 1.192.558 3.1 2.018 3.827 4.663h-2.64c-.567-1.767-1.98-3.135-3.854-3.321v3.321h-.287Z" />
    </svg>
  );
}
