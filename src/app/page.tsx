import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  ArrowRight,
  BadgeCheck,
  Coins,
  Gamepad2,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { MatchStatus, TournamentStatus } from "@prisma/client";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { AutoScrollRow } from "@/components/home/auto-scroll-row";
import { Reveal } from "@/components/shared/reveal";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import s from "./home.module.css";

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";
const marketHref = "https://t.me/eFootballNexonMarketBot";

const getHomeData = unstable_cache(
  async () => {
    const [totalUsers, completedTournaments, playedMatches, completedTournamentPrizes, archivedHomeStats] =
      await Promise.all([
        db.user.count(),
        db.tournament.count({ where: { status: TournamentStatus.COMPLETED, isTest: false } }),
        db.match.count({ where: { status: MatchStatus.CONFIRMED, tournament: { isTest: false } } }),
        db.tournament.findMany({
          where: { status: TournamentStatus.COMPLETED, isTest: false },
          select: { prizePool: true },
        }),
        getArchivedHomeStats(),
      ]);

    const playersCount = Math.max(totalUsers + archivedHomeStats.users, 240);
    const tournamentsCount = completedTournaments + archivedHomeStats.tournaments;
    const matchesCount = playedMatches;
    const awardedPrizePool =
      archivedHomeStats.prizePool +
      completedTournamentPrizes.reduce((sum, tournament) => sum + parsePrizePoolValue(tournament.prizePool), 0);

    return { playersCount, tournamentsCount, matchesCount, awardedPrizePool };
  },
  ["home-page-data-v4"],
  { revalidate: 300 },
);

const brandLetters = "EFOOTBALL".split("");
const brandLettersTwo = "NEXON".split("");

export default async function HomePage() {
  const [{ playersCount, tournamentsCount, matchesCount, awardedPrizePool }, session] = await Promise.all([getHomeData(), getCurrentSession()]);
  const playHref = session?.user?.id ? "/tournaments" : "/register";

  const stats = [
    { icon: Users, value: playersCount, suffix: "+", label: "Игроков" },
    { icon: Trophy, value: tournamentsCount, suffix: "", label: "Турниров" },
    { icon: Swords, value: matchesCount, suffix: "", label: "Матчей" },
    { icon: Coins, value: awardedPrizePool, suffix: " ₽", label: "Призов" },
  ];

  const features = [
    {
      icon: Trophy,
      accent: "gold" as const,
      title: "Сетки и живой счёт",
      text: "Автоматические группы и плей-офф, счёт обновляется по ходу турнира.",
    },
    {
      icon: ShieldCheck,
      accent: "ice" as const,
      title: "Честная модерация",
      text: "Каждый результат подтверждается, спорные матчи разбирает администрация.",
    },
    {
      icon: Zap,
      accent: "ice" as const,
      title: "Уведомления в эфире",
      text: "Оповещения о старте матча, сопернике и результате приходят мгновенно.",
    },
    {
      icon: BarChartMini,
      accent: "gold" as const,
      title: "Рейтинг и дивизионы",
      text: "Поднимайся по дивизионам и следи за позицией среди сильнейших.",
    },
    {
      icon: Users,
      accent: "ice" as const,
      title: "Командный режим",
      text: "Играй один или составом — турниры 1×1 и 2×2 в одном месте.",
    },
  ];

  const marketItems = [
    {
      icon: Gamepad2,
      tag: "Аккаунты",
      title: "Готовые составы",
      text: "Проверенные аккаунты с сильными карточками и рейтингом.",
    },
    {
      icon: Coins,
      tag: "GP и монеты",
      title: "Внутриигровая валюта",
      text: "Пополнение GP и eFootball Coins по курсу сообщества.",
    },
    {
      icon: BadgeCheck,
      tag: "Буст",
      title: "Прокачка и буст",
      text: "Помощь с прокачкой профиля и рейтинга под задачу.",
    },
    {
      icon: ShoppingBag,
      tag: "Обмен",
      title: "Скупка и продажа",
      text: "Продай или обменяй аккаунт через проверенный маркет.",
    },
  ];

  return (
    <div className="-mt-16 sm:-mt-[72px] lg:-mt-20">
      <main className={s.home}>
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
            <div className={s.statusRow}>
              <span className={s.statusDot} aria-hidden="true" />
              eFootball Mobile · Сезон 2026
            </div>

            <h1 className={s.brand} aria-label="eFootball Nexon">
              <span className={s.brandLine}>
                {brandLetters.map((letter, index) => (
                  <span key={`a-${index}`} className={s.brandChar} style={{ animationDelay: `${0.25 + index * 0.05}s` }}>
                    {letter}
                  </span>
                ))}
              </span>
              <span className={`${s.brandLine} ${s.brandLineAccent}`}>
                {brandLettersTwo.map((letter, index) => (
                  <span
                    key={`b-${index}`}
                    className={s.brandChar}
                    style={{ animationDelay: `${0.25 + (brandLetters.length + index) * 0.05}s` }}
                  >
                    {letter}
                  </span>
                ))}
              </span>
            </h1>

            <div className={s.heroActions}>
              <Link href={playHref} className={s.heroCta}>
                <span className={s.heroCtaGlow} aria-hidden="true" />
                <Swords className="h-5 w-5" />
                <span>Начать играть</span>
                <ArrowRight className={`h-4 w-4 ${s.heroCtaArrow}`} />
              </Link>
            </div>

            <div className={s.heroStats} aria-label="Статистика платформы">
              {stats.map((stat) => (
                <div key={stat.label} className={s.heroStat}>
                  <span className={s.statOrbit} aria-hidden="true" />
                  <span className={s.statShine} aria-hidden="true" />
                  <span className={s.heroStatIcon}>
                    <stat.icon className="h-4 w-4" />
                  </span>
                  <span className={s.heroStatValue}>
                    <AnimatedCounter value={stat.value} />
                    <span className={s.heroStatSuffix}>{stat.suffix}</span>
                  </span>
                  <span className={s.heroStatLabel}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={s.scrollCue} aria-hidden="true">
            <span className={s.scrollTrack}>
              <span className={s.scrollThumb} />
            </span>
            <span className={s.scrollLabel}>Листай</span>
          </div>
        </section>

        {/* ============================ PLATFORM (auto-scroll cards) ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.headCenter}>
              <span className={s.eyebrow}>Платформа</span>
              <h2 className={s.title}>Всё для соревновательной игры</h2>
            </div>
          </Reveal>

          <Reveal>
            <div className={s.bleed}>
              <AutoScrollRow ariaLabel="Возможности платформы" speed={0.35}>
                {features.map((feature) => (
                  <article
                    key={feature.title}
                    className={`${s.miniCard} ${feature.accent === "gold" ? s.miniGold : s.miniIce}`}
                    role="listitem"
                  >
                    <div className={s.miniGlow} aria-hidden="true" />
                    <span className={s.miniIcon}>
                      <feature.icon className="h-5 w-5" />
                    </span>
                    <h3 className={s.miniTitle}>{feature.title}</h3>
                    <p className={s.miniText}>{feature.text}</p>
                  </article>
                ))}
              </AutoScrollRow>
            </div>
          </Reveal>
        </section>

        {/* ============================ MARKET ============================ */}
        <section className={`${s.shell} ${s.block}`}>
          <Reveal>
            <div className={s.headCenter}>
              <span className={s.eyebrow}>Маркет</span>
              <h2 className={s.title}>Магазин сообщества</h2>
              <div className={s.headAction}>
                <Link href={marketHref} target="_blank" rel="noreferrer" className={s.glassButton}>
                  <ShoppingBag className="h-4 w-4" />
                  Открыть маркет
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className={s.marketStage}>
              <div className={s.marketAura} aria-hidden="true" />
              <div className={s.marketGrid}>
                {marketItems.map((item) => (
                  <Link
                    key={item.title}
                    href={marketHref}
                    target="_blank"
                    rel="noreferrer"
                    className={s.marketCard}
                    role="listitem"
                  >
                    <span className={s.marketBeam} aria-hidden="true" />
                    <span className={s.marketNoise} aria-hidden="true" />
                    <span className={s.marketTag}>{item.tag}</span>
                    <span className={s.marketIcon}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    <h3 className={s.marketTitle}>{item.title}</h3>
                    <p className={s.marketText}>{item.text}</p>
                    <span className={s.marketFoot}>
                      В Telegram-маркет
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
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
                    Подписаться
                    <ArrowRight className="h-4 w-4" />
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
                    Вступить
                    <ArrowRight className="h-4 w-4" />
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
                    Перейти
                    <ArrowRight className="h-4 w-4" />
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

/* tiny inline bar-chart glyph to avoid importing another lucide icon name */
function BarChartMini({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
