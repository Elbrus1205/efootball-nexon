import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Gamepad2,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { MatchStatus, ParticipantStatus, TournamentStatus } from "@prisma/client";
import { AnimatedBrandHero } from "@/components/home/animated-brand-hero";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { ProductCard } from "@/components/shop/product-card";
import { Reveal } from "@/components/shared/reveal";
import { db } from "@/lib/db";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import { formatDate } from "@/lib/utils";
import { listShopProducts } from "@/lib/shop/catalog";
import { getShopSettings } from "@/lib/shop/config";
import shopStyles from "@/components/shop/shop.module.css";
import s from "./home.module.css";

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";
const marketHref = "https://t.me/eFootballNexonMarketBot";

const activeStatuses = [
  TournamentStatus.REGISTRATION_OPEN,
  TournamentStatus.REGISTRATION_CLOSED,
  TournamentStatus.AWAITING_START,
  TournamentStatus.IN_PROGRESS,
];

const statusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Черновик",
  REGISTRATION_OPEN: "Регистрация открыта",
  REGISTRATION_CLOSED: "Набор завершён",
  AWAITING_START: "Скоро старт",
  IN_PROGRESS: "Идёт сейчас",
  COMPLETED: "Завершён",
};

const getHomeData = unstable_cache(
  async () => {
    const [totalUsers, completedTournaments, playedMatches, completedTournamentPrizes, archivedHomeStats, tournaments] =
      await Promise.all([
        db.user.count(),
        db.tournament.count({ where: { status: TournamentStatus.COMPLETED, isTest: false } }),
        db.match.count({ where: { status: MatchStatus.CONFIRMED, tournament: { isTest: false } } }),
        db.tournament.findMany({
          where: { status: TournamentStatus.COMPLETED, isTest: false },
          select: { prizePool: true },
        }),
        getArchivedHomeStats(),
        db.tournament.findMany({
          where: { status: { in: activeStatuses }, isTest: false },
          orderBy: [{ status: "asc" }, { startsAt: "asc" }],
          take: 3,
          select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
            maxParticipants: true,
            prizePool: true,
            coverImage: true,
            updatedAt: true,
            _count: {
              select: { participants: { where: { status: { not: ParticipantStatus.REMOVED } } } },
            },
          },
        }),
      ]);

    return {
      playersCount: totalUsers + archivedHomeStats.users,
      tournamentsCount: completedTournaments + archivedHomeStats.tournaments,
      matchesCount: playedMatches,
      awardedPrizePool:
        archivedHomeStats.prizePool +
        completedTournamentPrizes.reduce((sum, tournament) => sum + parsePrizePoolValue(tournament.prizePool), 0),
      tournaments: tournaments.map(({ coverImage, _count, ...tournament }) => ({
        ...tournament,
        participantsCount: _count.participants,
        coverImage: coverImage
          ? `/api/tournaments/${tournament.id}/cover?w=960&h=540&q=84&v=${tournament.updatedAt.getTime()}`
          : null,
      })),
    };
  },
  ["home-page-data-v5"],
  { revalidate: 300 },
);

const getHomeShopData = unstable_cache(
  async () => {
    try {
      const settings = await getShopSettings();
      if (!settings.isEnabled || !settings.showHomeBlock) return null;
      const products = await listShopProducts({ popularOnly: true, sort: "popular", pageSize: 3 });
      return products.items.length ? { items: products.items, currency: settings.currency } : null;
    } catch (error) {
      // Allows a zero-downtime deploy where application code starts before the shop migration is applied.
      console.warn("Home shop block is unavailable until the shop migration is applied.", error);
      return null;
    }
  },
  ["home-shop-data-v1"],
  { revalidate: 120 },
);

export default async function HomePage() {
  const [data, shop] = await Promise.all([getHomeData(), getHomeShopData()]);
  const stats = [
    { value: data.playersCount, suffix: "", label: "игроков" },
    { value: data.tournamentsCount, suffix: "", label: "турниров завершено" },
    { value: data.matchesCount, suffix: "", label: "матчей сыграно" },
    { value: data.awardedPrizePool, suffix: " ₽", label: "выдано призами" },
  ];

  return (
    <div className={s.home}>
      <section className={s.hero} aria-labelledby="hero-title">
        <div className={s.heroGrid} aria-hidden="true" />
        <div className={s.heroLight} aria-hidden="true" />
        <div className={s.shell}>
          <AnimatedBrandHero
            telegramHref={telegramHref}
          />

          <div className={s.stats} aria-label="Статистика платформы">
            {stats.map((stat) => (
              <div className={s.stat} key={stat.label}>
                <strong><AnimatedCounter value={stat.value} />{stat.suffix}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.section} ${s.tournaments}`} aria-labelledby="tournaments-title">
        <div className={s.shell}>
          <Reveal>
            <div className={s.sectionHead}>
              <div><p className={s.kicker}><span /> Турнирный центр</p><h2 id="tournaments-title">Игра начинается<br />до первого свистка</h2></div>
              <Link href="/tournaments" className={s.textButton}>Все турниры <ArrowUpRight aria-hidden="true" /></Link>
            </div>
          </Reveal>

          {data.tournaments.length ? (
            <div className={s.tournamentList}>
              {data.tournaments.map((tournament, index) => (
                <Reveal key={tournament.id}>
                  <Link href={`/tournaments/${tournament.id}`} className={s.tournamentCard}>
                    <div className={s.tournamentMedia}>
                      {tournament.coverImage ? (
                        <Image src={tournament.coverImage} alt="" fill unoptimized loading="lazy" sizes="(min-width: 900px) 34vw, 100vw" className={s.tournamentImage} />
                      ) : (
                        <div className={s.coverFallback} aria-hidden="true"><span /><CircleDot /></div>
                      )}
                      <span className={s.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <div className={s.tournamentBody}>
                      <span className={s.status}><i />{statusLabels[tournament.status]}</span>
                      <h3>{tournament.title}</h3>
                      <div className={s.tournamentMeta}>
                        <span><CalendarDays aria-hidden="true" />{formatDate(tournament.startsAt)}</span>
                        <span><Users aria-hidden="true" />{tournament.participantsCount} / {tournament.maxParticipants}</span>
                        {tournament.prizePool ? <span><Trophy aria-hidden="true" />{tournament.prizePool}</span> : null}
                      </div>
                      <span className={s.cardAction}>Открыть турнир <ChevronRight aria-hidden="true" /></span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <div className={s.emptyState}>
                <Trophy aria-hidden="true" />
                <div><h3>Новые турниры готовятся</h3><p>Расписание появится здесь после публикации организатором.</p></div>
                <Link href={telegramHref} target="_blank" rel="noreferrer">Следить в Telegram <ArrowUpRight aria-hidden="true" /></Link>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {shop ? <section className={`${s.section} ${s.how}`} aria-labelledby="shop-title">
        <div className={s.shell}>
          <Reveal>
            <div className={s.sectionHead}>
              <div><p className={s.kicker}><span /> Магазин</p><h2 id="shop-title">Популярные товары</h2></div>
              <Link href="/shop" className={s.textButton}>Перейти в магазин <ArrowUpRight aria-hidden="true" /></Link>
            </div>
          </Reveal>
          <div className={shopStyles.grid}>{shop.items.map((product) => <ProductCard key={product.id} product={product} currency={shop.currency} />)}</div>
        </div>
      </section> : null}

      <section className={`${s.section} ${s.how}`} aria-labelledby="how-title">
        <div className={s.shell}>
          <Reveal>
            <div className={s.howIntro}>
              <p className={s.kicker}><span /> Как это работает</p>
              <h2 id="how-title">От заявки<br />до результата</h2>
              <p>Платформа ведёт игрока по настоящему турнирному процессу — без лишних экранов и потерянных сообщений.</p>
            </div>
          </Reveal>
          <div className={s.steps}>
            <article><span>Заявка</span><Swords aria-hidden="true" /><h3>Выбери турнир</h3><p>Открой событие, проверь формат и зарегистрируйся.</p></article>
            <article><span>Игра</span><Gamepad2 aria-hidden="true" /><h3>Сыграй матч</h3><p>Узнай соперника и расписание прямо в турнирной сетке.</p></article>
            <article><span>Результат</span><ShieldCheck aria-hidden="true" /><h3>Зафиксируй счёт</h3><p>Отправь результат на подтверждение и двигайся дальше.</p></article>
          </div>
        </div>
      </section>

      <section className={`${s.section} ${s.ecosystem}`} aria-labelledby="ecosystem-title">
        <div className={s.shell}>
          <Reveal>
            <div className={s.ecosystemGrid}>
              <div className={s.ecosystemCopy}>
                <p className={s.kicker}><span /> Экосистема Nexon</p>
                <h2 id="ecosystem-title">Вся игра<br />на связи</h2>
                <p>Анонсы, общение и официальный Telegram-маркет дополняют турнирную платформу.</p>
              </div>
              <div className={s.linkStack}>
                <SocialLink href={telegramHref} icon={<TelegramGlyph />} label="Telegram" text="Анонсы и расписание" />
                <SocialLink href={vkHref} icon={<VkGlyph />} label="ВКонтакте" text="Сообщество игроков" />
                <SocialLink href={marketHref} icon={<ShoppingBag />} label="Telegram-маркет" text="Аккаунты и пополнение" featured />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function SocialLink({ href, icon, label, text, featured = false }: { href: string; icon: React.ReactNode; label: string; text: string; featured?: boolean }) {
  return (
    <Link href={href} target="_blank" rel="noreferrer" className={`${s.socialLink} ${featured ? s.socialFeatured : ""}`}>
      <span className={s.socialIcon}>{icon}</span><span><strong>{label}</strong><small>{text}</small></span><ArrowUpRight aria-hidden="true" />
    </Link>
  );
}

function TelegramGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M21.6 4.2c.2-1-.7-1.7-1.6-1.3L2.8 9.5c-1.1.4-1 2 .1 2.3l4.4 1.4 1.7 5.2c.4 1.1 1.8 1.4 2.5.5l2.5-3 4.4 3.3c.8.6 1.9.1 2.1-.9l3.1-14.1Zm-5.9 3.4-6.5 5.8-.3 3 1.1-2.2 6.9-6.1c.4-.4-.1-.8-.6-.5Z" /></svg>;
}

function VkGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.785 17.58c-5.09 0-7.994-3.49-8.115-9.295H7.22c.084 4.26 1.963 6.064 3.452 6.435V8.285h2.4v3.673c1.47-.158 3.012-1.832 3.533-3.673h2.4c-.4 2.27-2.074 3.944-3.266 4.632 1.192.558 3.1 2.018 3.827 4.663h-2.64c-.567-1.767-1.98-3.135-3.854-3.321v3.321h-.287Z" /></svg>;
}
