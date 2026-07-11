import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, Clock3, PencilLine, ShieldCheck, Trophy } from "lucide-react";
import { ProfileStatusType, type ProfileStatusTone, type Season, type UserRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerCareerStatsPanel } from "@/components/players/player-career-stats";
import { PlayerSocialLinks } from "@/components/players/player-social-links";
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
  editHref?: string;
};

function AchievementShortcut({ achievements, href }: { achievements: AchievementGroupProgress[]; href: string }) {
  const unlockedTotal = achievements.reduce((sum, group) => sum + group.unlockedCount, 0);
  const total = achievements.reduce((sum, group) => sum + group.totalCount, 0);
  const percent = total ? Math.round((unlockedTotal / total) * 100) : 0;

  return (
    <Card className="overflow-hidden rounded-lg p-0">
      <Link href={href} className="group grid gap-3 p-4 transition hover:bg-white/[0.035] sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-200" />
            <div className="font-semibold text-white">Достижения</div>
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            Открыто {unlockedTotal} из {total}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm font-medium text-zinc-200 group-hover:text-white">
          <span>Открыть</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </Card>
  );
}

function formatProfileRating(rating: number | null) {
  if (rating === null) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(rating) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

function RatingValue({ rating, ratingPlace }: { rating: number | null; ratingPlace: number | null }) {
  const formattedRating = formatProfileRating(rating);

  return (
    <div className="mt-2 flex min-w-0 items-start gap-1 text-xl font-black leading-none text-amber-100">
      <span>{formattedRating}</span>
      {ratingPlace ? (
        <sup className="relative top-[-0.35em] text-[0.55em] font-black leading-none text-primary" aria-label={`место ${ratingPlace}`}>
          {ratingPlace}
        </sup>
      ) : null}
    </div>
  );
}

function ReliabilityValue({ reliability }: { reliability: ReliabilitySummary | null }) {
  if (!reliability) {
    return <div className="mt-2 text-xl font-black leading-none text-white">—</div>;
  }

  const statusClasses = {
    excellent: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    good: "border-sky-300/30 bg-sky-400/10 text-sky-200",
    allowed: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    restricted: "border-red-300/30 bg-red-500/10 text-red-200",
  } satisfies Record<ReliabilitySummary["status"]["tone"], string>;
  const StatusIcon = reliability.status.tone === "restricted" ? AlertTriangle : ShieldCheck;

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="flex items-baseline gap-1 text-xl font-black leading-none text-white">
        <span>{reliability.score}</span>
        <span className="text-xs font-bold text-zinc-500">/100</span>
      </div>
      <div className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none ${statusClasses[reliability.status.tone]}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {reliability.status.label}
      </div>
    </div>
  );
}

export function PlayerProfileView({
  user,
  clubs,
  seasons,
  selectedSeason,
  rating,
  ratingPlace,
  careerStats,
  achievements,
  reliability,
  basePath,
  editHref,
}: PlayerProfileViewProps) {
  const displayName = getPlayerDisplayName(user);
  const favoriteClub = clubs.find((club) => club.slug === user.favoriteTeam || club.name === user.favoriteTeam) ?? null;
  const socialLinks = getUserSocialLinks(user);
  const selectedStatuses = user.profileStatuses.filter((status) => status.selectedOrder !== null).slice(0, 3);
  const ambassadorStatus = user.profileStatuses.find((status) => status.type === ProfileStatusType.AMBASSADOR && status.youtubeUrl);
  const profileSocialLinks = ambassadorStatus?.youtubeUrl
    ? [
        ...socialLinks,
        {
          id: "youtube" as const,
          label: "YouTube" as const,
          handle: ambassadorStatus.youtubeChannelTitle ?? "YouTube-канал",
          href: ambassadorStatus.youtubeUrl,
        },
      ]
    : socialLinks;
  const periodLabel = selectedSeason ? `Сезон: ${selectedSeason.name}` : "За всё время";
  const timeZoneLocalTime = formatTimeZoneLocalTime(user.timeZone);
  const bannerImageSrc = optimizedImageUrl(user.bannerImage, { width: 1600, height: 420, quality: 82, resize: "cover", format: "webp" });
  const registeredAt = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(user.createdAt);

  return (
    <div className="page-shell space-y-8">
      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <div className="relative overflow-hidden border-b border-white/10">
          <div className="profile-banner-surface relative h-40 rounded-t-[inherit] sm:h-52">
            {bannerImageSrc ? (
              <Image
                src={bannerImageSrc}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1120px"
                quality={82}
                className="object-cover"
              />
            ) : null}
            {bannerImageSrc ? <div className="profile-banner-overlay absolute inset-0" /> : null}
          </div>
          <div className="profile-banner-grid absolute inset-0 opacity-20" />

          <div className="relative px-5 pb-6 sm:px-6">
            <div className="-mt-10 flex items-end justify-between gap-4 sm:-mt-12">
              <div className="flex min-w-0 items-end gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 rounded-[1.75rem] border-4 border-[#1D1D1D] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24">
                    <AvatarImage src={user.image || undefined} alt="Аватар игрока" />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  {editHref ? (
                    <Link
                      href={editHref}
                      aria-label="Редактировать профиль"
                      className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#1D1D1D] text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] sm:hidden"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>

                <div className="min-w-0 pb-[12px] sm:pb-1">
                  <div className="flex min-w-0 max-w-full items-center gap-2">
                    <h1 className="min-w-0 truncate text-[18px] font-semibold leading-none text-white sm:text-3xl">{displayName}</h1>
                    <UserRoleBadge role={user.role} className="max-w-[42vw] sm:max-w-none" />
                  </div>
                  {selectedStatuses.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedStatuses.map((status) => (
                        <ProfileStatusBadge key={status.id} status={status} />
                      ))}
                    </div>
                  ) : null}
                  {user.bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{user.bio}</p> : null}
                </div>
              </div>

              {editHref ? (
                <Button asChild variant="secondary" className="hidden gap-2 sm:inline-flex">
                  <Link href={editHref}>
                    <PencilLine className="h-4 w-4" />
                    Редактировать профиль
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Рейтинг</div>
            <RatingValue rating={rating} ratingPlace={ratingPlace} />
          </div>

          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Надежность</div>
            <ReliabilityValue reliability={reliability} />
          </div>

          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">ID игрока</div>
            <div className="mt-2 text-sm font-medium text-white">{user.publicId}</div>
          </div>

          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Любимый клуб</div>
            <div className="mt-2 flex items-center gap-3">
              {favoriteClub ? (
                <>
                  <Image
                    src={favoriteClub.imagePath}
                    alt={favoriteClub.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full border border-white/10 bg-black/20 p-1 object-contain"
                  />
                  <div className="text-sm font-medium text-white">{favoriteClub.name}</div>
                </>
              ) : (
                <div className="text-sm font-medium text-white">Не выбран</div>
              )}
            </div>
          </div>

          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Дата регистрации</div>
            <div className="mt-2 text-sm font-medium text-white">{registeredAt}</div>
          </div>

          <div className="border-b border-white/10 pb-3 sm:col-span-2 lg:col-span-4">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Часовой пояс</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-white">
              <Clock3 className="h-4 w-4 text-primary" />
              <span>{formatTimeZoneLabel(user.timeZone)}</span>
              {timeZoneLocalTime ? <span className="text-zinc-500">местное время {timeZoneLocalTime}</span> : null}
            </div>
          </div>

          {profileSocialLinks.length > 0 ? (
            <div className="border-b border-white/10 pb-3 sm:col-span-2 lg:col-span-4">
              <PlayerSocialLinks links={profileSocialLinks} />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-lg p-5">
        <div className="font-semibold text-white">Статусы профиля</div>
        <div className="mt-1 text-sm text-zinc-500">Все подтверждённые статусы этого профиля.</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.profileStatuses.map((status) => (
            <ProfileStatusBadge key={status.id} status={status} className="min-h-7 px-2.5 py-1 text-xs sm:min-h-10 sm:px-4 sm:py-1.5 sm:text-[19px]" />
          ))}
          {!user.profileStatuses.length ? <div className="text-sm text-zinc-500">Подтверждённых статусов пока нет.</div> : null}
        </div>
      </Card>

      <AchievementShortcut achievements={achievements} href={`${basePath}/achievements`} />

      <PlayerCareerStatsPanel
        stats={careerStats}
        periodLabel={periodLabel}
        periodControl={<StatsPeriodSwitcher basePath={basePath} seasons={seasons} selectedSeasonId={selectedSeason?.id ?? null} />}
      />
    </div>
  );
}
