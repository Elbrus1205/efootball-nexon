import { MatchStatus, NotificationType, TournamentApplicationStatus, TournamentStatus, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { checkTelegramBotOnline } from "@/lib/telegram-bot";
import { createNotificationsForUsers } from "@/lib/services/notifications";

// Roles that should receive operational alerts about platform health.
const OPS_ALERT_ROLES: UserRole[] = [UserRole.FOUNDER, UserRole.ORGANIZER];

// Thresholds that turn a metric into a digest line worth surfacing.
const UNDELIVERED_ALERT_THRESHOLD = 20;
const UNDELIVERED_STUCK_MINUTES = 15;
const DELIVERY_CRON_STALE_MINUTES = 15;

type OperationalMetrics = {
  undeliveredTotal: number;
  undeliveredStuck: number;
  oldestUndeliveredMinutes: number | null;
  lastDeliveryMinutesAgo: number | null;
  openDisputes: number;
  overdueMatches: number;
  pendingApplications: number;
  oldestPendingApplicationHours: number | null;
  botOnline: boolean;
};

function minutesAgo(date: Date | null | undefined, now: number) {
  if (!date) return null;
  return Math.max(0, Math.round((now - date.getTime()) / 60000));
}

export async function getOperationalRecipientIds() {
  const recipients = await db.user.findMany({
    where: { role: { in: OPS_ALERT_ROLES }, isBanned: false },
    select: { id: true },
  });
  return recipients.map((recipient) => recipient.id);
}

export async function collectOperationalMetrics(now = new Date()): Promise<OperationalMetrics> {
  const nowMs = now.getTime();
  const stuckBefore = new Date(nowMs - UNDELIVERED_STUCK_MINUTES * 60000);

  const [
    undeliveredTotal,
    undeliveredStuck,
    oldestUndelivered,
    lastDelivered,
    openDisputes,
    pendingApplications,
    oldestPendingApplication,
    overdueDeadlines,
  ] = await Promise.all([
    db.notificationDelivery.count({ where: { deliveredAt: null } }),
    db.notificationDelivery.count({ where: { deliveredAt: null, availableAt: { lt: stuckBefore } } }),
    db.notificationDelivery.findFirst({
      where: { deliveredAt: null },
      orderBy: { availableAt: "asc" },
      select: { availableAt: true },
    }),
    db.notificationDelivery.findFirst({
      where: { deliveredAt: { not: null } },
      orderBy: { deliveredAt: "desc" },
      select: { deliveredAt: true },
    }),
    db.match.count({ where: { status: MatchStatus.DISPUTED } }),
    db.tournamentRegistrationApplication.count({ where: { status: TournamentApplicationStatus.PENDING } }),
    db.tournamentRegistrationApplication.findFirst({
      where: { status: TournamentApplicationStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    // Round deadlines already passed, for tournaments still running.
    db.roundDeadline.findMany({
      where: {
        deadlineAt: { lt: now },
        tournament: { status: TournamentStatus.IN_PROGRESS, notificationsEnabled: true },
      },
      select: {
        round: true,
        stage: {
          select: {
            matches: {
              where: {
                isPenaltyTiebreak: false,
                player1Id: { not: null },
                player2Id: { not: null },
                status: { in: [MatchStatus.PENDING, MatchStatus.SCHEDULED, MatchStatus.READY, MatchStatus.RESULT_SUBMITTED] },
              },
              select: { id: true, round: true },
            },
          },
        },
      },
    }),
  ]);

  const overdueMatches = overdueDeadlines.reduce(
    (sum, deadline) => sum + deadline.stage.matches.filter((match) => match.round === deadline.round).length,
    0,
  );

  const botOnline = await checkTelegramBotOnline();

  return {
    undeliveredTotal,
    undeliveredStuck,
    oldestUndeliveredMinutes: minutesAgo(oldestUndelivered?.availableAt ?? null, nowMs),
    lastDeliveryMinutesAgo: minutesAgo(lastDelivered?.deliveredAt ?? null, nowMs),
    openDisputes,
    overdueMatches,
    pendingApplications,
    oldestPendingApplicationHours:
      oldestPendingApplication?.createdAt != null
        ? Math.max(0, Math.round((nowMs - oldestPendingApplication.createdAt.getTime()) / 3_600_000))
        : null,
    botOnline,
  };
}

// Turns metrics into human-readable digest lines. Empty array means "all healthy".
export function buildOperationalDigestLines(metrics: OperationalMetrics) {
  const lines: string[] = [];

  if (!metrics.botOnline) {
    lines.push("Критично: Telegram-бот недоступен (getMe не отвечает).");
  }

  if (metrics.undeliveredStuck > 0 || (metrics.lastDeliveryMinutesAgo ?? Infinity) > DELIVERY_CRON_STALE_MINUTES) {
    const stuckPart = metrics.oldestUndeliveredMinutes != null ? ` Старейшее ждёт ${metrics.oldestUndeliveredMinutes} мин.` : "";
    lines.push(`Критично: доставка уведомлений похоже не запускается — застряло ${metrics.undeliveredStuck}.${stuckPart}`);
  } else if (metrics.undeliveredTotal >= UNDELIVERED_ALERT_THRESHOLD) {
    lines.push(`Рост неотправленных уведомлений: ${metrics.undeliveredTotal} в очереди.`);
  }

  if (metrics.openDisputes > 0) {
    lines.push(`Открытые спорные матчи: ${metrics.openDisputes}.`);
  }

  if (metrics.overdueMatches > 0) {
    lines.push(`Просроченные матчи без результата: ${metrics.overdueMatches}.`);
  }

  if (metrics.pendingApplications > 0) {
    const agePart = metrics.oldestPendingApplicationHours != null ? ` Старейшая ждёт ${metrics.oldestPendingApplicationHours} ч.` : "";
    lines.push(`Заявки на проверке: ${metrics.pendingApplications}.${agePart}`);
  }

  return lines;
}

// Sends ONE combined operational digest to founders/organizers.
// Returns notifiedCount 0 when nothing needs attention (no message sent).
export async function sendOperationalDigest(now = new Date()) {
  const metrics = await collectOperationalMetrics(now);
  const lines = buildOperationalDigestLines(metrics);
  if (!lines.length) return { notifiedCount: 0, lines };

  const recipientIds = await getOperationalRecipientIds();
  if (!recipientIds.length) return { notifiedCount: 0, lines };

  // Dedupe per calendar day (Moscow) so re-runs of the digest cron don't spam.
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  await createNotificationsForUsers({
    userIds: recipientIds,
    title: "Сводка по платформе",
    body: ["Ежедневная сводка:", ...lines].join("\n"),
    type: NotificationType.SYSTEM,
    link: "/admin/moderation",
    dedupeKey: `ops-digest:${dayKey}`,
    dedupeWithinHours: 20,
  });

  return { notifiedCount: recipientIds.length, lines };
}
