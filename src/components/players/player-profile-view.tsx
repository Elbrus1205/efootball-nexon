import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ChevronRight, ShieldCheck, Trophy } from "lucide-react";
import { ProfileStatusType, type ProfileStatusTone, type Season, type UserRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PlayerCareerStatsPanel } from "@/components/players/player-career-stats";
import { PlayerSocialLinks } from "@/components/players/player-social-links";
import { PlayerPodiumHistoryPanel } from "@/components/players/player-podium-history";
import type { PlayerPodiumHistory } from "@/lib/services/player-podium";
import { ProfileStatusBadge } from "@/components/profile/profile-status-badge";
import { StatsPeriodSwitcher } from "@/components/players/stats-period-switcher";
import { UserRoleBadge } from "@/components/users/user-role-badge";
import type { ClubOption } from "@/lib/clubs";
import type { AchievementGroupProgress } from "@/lib/achievements";
import { getPlayerDisplayName } from "@/lib/player-name";
import type { PlayerCareerStats } from "@/lib/player-stats";
import type { ReliabilitySummary } from "@/lib/services/reliability";
import { optimizedImageUrl } from "@/lib/image-optimization";
import { getUserSocialLinks } from "@/lib/social-links";
import { formatTimeZoneLabel, formatTimeZoneLocalTime } from "@/lib/time-zone";
import styles from "./player-profile.module.css";

type ProfileStatus = {
  id: string;
  title: string;
  tone: ProfileStatusTone;
  type: ProfileStatusType;
  youtubeUrl: string | null;
  youtubeChannelTitle: string | null;
  selectedOrder: number | null;
};

type ProfileUser = {
  id: string;
  publicId: string;
  name: string | null;
  image: string | null;
  bannerImage: string | null;
  bio: string | null;
  favoriteTeam: string | null;
  timeZone: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  vkId: string | null;
  role: UserRole;
  createdAt: Date;
  accounts?: Array<{ provider: string; providerAccountId: string }>;
  profileStatuses: ProfileStatus[];
};

type PlayerProfileViewProps = {
  user: ProfileUser;
  clubs: ClubOption[];
  seasons: Season[];
  selectedSeason: Season | null;
  rating: number | null;
  ratingPlace: number | null;
  careerStats: PlayerCareerStats;
  achievements: AchievementGroupProgress[];
  reliability: ReliabilitySummary | null;
  basePath: string;
  podiumHistory: PlayerPodiumHistory;
};

function AchievementShortcut({ achievements, href }: { achievements: AchievementGroupProgress[]; href: string }) {
  const unlockedTotal = achievements.reduce((sum, group) => sum + group.unlockedCount, 0);
  const total = achievements.reduce((sum, group) => sum + group.totalCount, 0);
  const percent = total ? Math.round((unlockedTotal / total) * 100) : 0;

  return (
    <Card className={styles.panel}>
      <Link href={href} className={styles.achievementLink}>
        <span className={styles.achievementIcon}><Trophy aria-hidden="true" size={21} strokeWidth={1.5} /></span>
        <div className={styles.achievementCopy}>
          <h2 className={styles.sectionTitle}>Достижения</h2>
          <p className={styles.caption}>Открыто {unlockedTotal} из {total}</p>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
        </div>
        <ChevronRight className={styles.chevron} size={18} aria-hidden="true" />
      </Link>
    </Card>
  );
}

function formatProfileRating(rating: number | null) {
  if (rating === null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(rating) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

function ReliabilityValue({ reliability }: { reliability: ReliabilitySummary | null }) {
  const StatusIcon = reliability?.status.tone === "restricted" ? AlertTriangle : ShieldCheck;
  return (
    <>
      <div className={styles.metricValue}>
        {reliability?.score ?? "—"}{reliability ? <span className={styles.metricUnit}>/ 100</span> : null}
      </div>
      {reliability ? (
        <span className={styles.reliabilityStatus} data-tone={reliability.status.tone}>
          <StatusIcon size={14} aria-hidden="true" />{reliability.status.label}
        </span>
      ) : null}
    </>
  );
}

export function PlayerProfileView({
  user, clubs, seasons, selectedSeason, rating, ratingPlace, careerStats, achievements, reliability, basePath, podiumHistory,
}: PlayerProfileViewProps) {
  const displayName = getPlayerDisplayName(user);
  const favoriteClub = clubs.find((club) => club.slug === user.favoriteTeam || club.name === user.favoriteTeam) ?? null;
  const socialLinks = getUserSocialLinks(user);
  const selectedStatuses = user.profileStatuses.filter((status) => status.selectedOrder !== null).slice(0, 3);
  const ambassadorStatus = user.profileStatuses.find((status) => status.type === ProfileStatusType.AMBASSADOR && status.youtubeUrl);
  const profileSocialLinks = ambassadorStatus?.youtubeUrl
    ? [...socialLinks, { id: "youtube" as const, label: "YouTube" as const, handle: ambassadorStatus.youtubeChannelTitle ?? "YouTube-канал", href: ambassadorStatus.youtubeUrl }]
    : socialLinks;
  const periodLabel = selectedSeason ? `Сезон: ${selectedSeason.name}` : "За всё время";
  const timeZoneLocalTime = formatTimeZoneLocalTime(user.timeZone);
  const bannerImageSrc = optimizedImageUrl(user.bannerImage, { width: 1600, height: 420, quality: 82, resize: "cover", format: "webp" });
  const registeredAt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(user.createdAt);

  return (
    <div className={`page-shell ${styles.page}`}>
      <Card className={`${styles.panel} ${styles.hero}`}>
        <div className={styles.banner}>
          {bannerImageSrc ? (
            <Image src={bannerImageSrc} alt="" fill priority fetchPriority="high" sizes="(max-width: 1120px) 100vw, 1120px" quality={82} className="object-cover" />
          ) : null}
          <div className={styles.bannerShade} aria-hidden="true" />
        </div>
        <div className={styles.identity}>
          <Avatar className={styles.avatar}>
            <AvatarImage src={user.image || undefined} alt={`Фото ${displayName}`} />
            <AvatarFallback className={styles.avatarFallback}>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className={styles.identityCopy}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{displayName}</h1>
              <UserRoleBadge role={user.role} className={styles.roleBadge} />
            </div>
            {selectedStatuses.length ? (
              <div className={styles.badges}>
                {selectedStatuses.map((status) => <ProfileStatusBadge key={status.id} status={status} className={styles.statusBadge} />)}
              </div>
            ) : null}
            {user.bio ? <p className={styles.bio}>{user.bio}</p> : null}
          </div>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Рейтинг</div>
            <div className={`${styles.metricValue} ${styles.ratingValue}`}>{formatProfileRating(rating)}</div>
            {ratingPlace ? <div className={styles.caption}>{ratingPlace} место</div> : null}
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Надёжность</div>
            <ReliabilityValue reliability={reliability} />
          </div>
        </div>
      </Card>

      <div className={styles.contentGrid}>
        <div className={styles.column}>
          <section aria-labelledby="profile-info-heading">
            <h2 id="profile-info-heading" className={styles.groupTitle}>Информация</h2>
            <Card className={styles.panel}>
              <dl className={styles.details}>
                <div className={styles.detailRow}><dt>ID игрока</dt><dd className={styles.playerId}>{user.publicId}</dd></div>
                <div className={styles.detailRow}>
                  <dt>Любимый клуб</dt>
                  <dd className={styles.clubValue}>
                    {favoriteClub ? <><Image src={favoriteClub.imagePath} alt="" width={26} height={26} className={styles.clubBadge} /><span>{favoriteClub.name}</span></> : "Не выбран"}
                  </dd>
                </div>
                <div className={styles.detailRow}><dt>Регистрация</dt><dd><time dateTime={user.createdAt.toISOString()}>{registeredAt}</time></dd></div>
                <div className={styles.detailRow}>
                  <dt>Часовой пояс</dt>
                  <dd>{formatTimeZoneLabel(user.timeZone)}{timeZoneLocalTime ? <span className={styles.detailHint}>Местное время · {timeZoneLocalTime}</span> : null}</dd>
                </div>
              </dl>
            </Card>
          </section>
          {profileSocialLinks.length ? <PlayerSocialLinks links={profileSocialLinks} /> : null}
          <section aria-labelledby="profile-status-heading">
            <h2 id="profile-status-heading" className={styles.groupTitle}>Статусы профиля</h2>
            <Card className={`${styles.panel} ${styles.statusPanel}`}>
              <p className={styles.caption}>Все подтверждённые статусы</p>
              {user.profileStatuses.length ? (
                <div className={styles.badges}>
                  {user.profileStatuses.map((status) => <ProfileStatusBadge key={status.id} status={status} className={styles.statusBadge} />)}
                </div>
              ) : <p className={styles.emptyText}>Подтверждённых статусов пока нет.</p>}
            </Card>
          </section>
          <AchievementShortcut achievements={achievements} href={`${basePath}/achievements`} />
        </div>
        <div className={styles.column}>
          <PlayerCareerStatsPanel
            stats={careerStats}
            periodLabel={periodLabel}
            periodControl={<StatsPeriodSwitcher basePath={basePath} seasons={seasons} selectedSeasonId={selectedSeason?.id ?? null} />}
          />
          <PlayerPodiumHistoryPanel history={podiumHistory} basePath={basePath} seasonId={selectedSeason?.id} />
        </div>
      </div>
    </div>
  );
}
