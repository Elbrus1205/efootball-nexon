import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { AdminActionType, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = typeof value === "string" ? value : "";
  return returnTo.startsWith("/admin/users") ? returnTo : "/admin/users";
}

function redirectWithStatus(request: Request, returnTo: string, key: "updated" | "error", message: string) {
  const url = new URL(returnTo, getRequestBaseUrl(request));
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.FOUNDER]);
  const formData = await request.formData();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));
  const sourceUserId = params.id;
  const targetUserLookup = String(formData.get("targetUserId") ?? "").trim();
  const confirmed = formData.get("confirmTransfer") === "true";

  if (!confirmed) {
    return redirectWithStatus(request, returnTo, "error", "Подтвердите перенос аккаунта.");
  }

  if (!targetUserLookup) {
    return redirectWithStatus(request, returnTo, "error", "Укажите ID игрока целевого аккаунта.");
  }

  if (sourceUserId === targetUserLookup) {
    return redirectWithStatus(request, returnTo, "error", "Нельзя переносить аккаунт сам в себя.");
  }

  if (sourceUserId === session.user.id) {
    return redirectWithStatus(request, returnTo, "error", "Нельзя переносить свой аккаунт из админ-панели.");
  }

  const [sourceUser, targetUser] = await Promise.all([
    db.user.findUnique({
      where: { id: sourceUserId },
      select: { id: true, publicId: true, email: true, name: true, telegramUsername: true },
    }),
    db.user.findFirst({
      where: {
        OR: [{ id: targetUserLookup }, { publicId: targetUserLookup }],
      },
      select: { id: true, publicId: true, email: true, name: true, telegramUsername: true },
    }),
  ]);

  if (!sourceUser) {
    return redirectWithStatus(request, returnTo, "error", "Исходный аккаунт не найден.");
  }

  if (!targetUser) {
    return redirectWithStatus(request, returnTo, "error", "Целевой аккаунт не найден.");
  }

  const targetUserId = targetUser.id;

  if (sourceUserId === targetUserId) {
    return redirectWithStatus(request, returnTo, "error", "Нельзя переносить аккаунт сам в себя.");
  }

  const duplicateTournamentRegistration = await db.tournamentRegistration.findFirst({
      where: {
        userId: sourceUserId,
        tournament: {
          participants: {
            some: { userId: targetUserId },
          },
        },
      },
      include: {
        tournament: { select: { title: true } },
      },
    });

  if (duplicateTournamentRegistration) {
    return redirectWithStatus(
      request,
      returnTo,
      "error",
      `Нельзя перенести: целевой аккаунт уже есть в турнире "${duplicateTournamentRegistration.tournament.title}".`,
    );
  }

  const result = await db.$transaction(async (tx) => {
    const updates = await Promise.all([
      tx.account.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } }),
      tx.passwordResetToken.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } }),
      tx.emailVerificationCode.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } }),
      tx.tournament.updateMany({ where: { createdById: sourceUserId }, data: { createdById: targetUserId } }),
      tx.tournamentRegistration.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } }),
      tx.match.updateMany({ where: { player1Id: sourceUserId }, data: { player1Id: targetUserId } }),
      tx.match.updateMany({ where: { player2Id: sourceUserId }, data: { player2Id: targetUserId } }),
      tx.match.updateMany({ where: { winnerId: sourceUserId }, data: { winnerId: targetUserId } }),
      tx.matchResultSubmission.updateMany({ where: { submittedById: sourceUserId }, data: { submittedById: targetUserId } }),
      tx.notification.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } }),
      tx.securitySession.updateMany({ where: { userId: sourceUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
      tx.session.deleteMany({ where: { userId: sourceUserId } }),
      tx.loginHistory.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } }),
      tx.twoFactorChallenge.deleteMany({ where: { userId: sourceUserId } }),
    ]);

    const counts = {
      accounts: updates[0].count,
      passwordResetTokens: updates[1].count,
      emailVerificationCodes: updates[2].count,
      createdTournaments: updates[3].count,
      tournamentRegistrations: updates[4].count,
      playerOneMatches: updates[5].count,
      playerTwoMatches: updates[6].count,
      wonMatches: updates[7].count,
      matchResultSubmissions: updates[8].count,
      notifications: updates[9].count,
      revokedSecuritySessions: updates[10].count,
      deletedSessions: updates[11].count,
      loginHistory: updates[12].count,
      deletedTwoFactorChallenges: updates[13].count,
    };

    await tx.adminAction.create({
      data: {
        adminId: session.user.id,
        entityType: "USER_ACCOUNT_TRANSFER",
        entityId: sourceUserId,
        actionType: AdminActionType.UPDATE,
        beforeJson: { sourceUser, targetUser },
        afterJson: { sourceUserId, targetUserId, counts },
      },
    });

    return counts;
  });

  revalidatePath("/admin/users");
  revalidatePath(`/players/${sourceUserId}`);
  revalidatePath(`/players/${targetUserId}`);
  revalidatePath("/ratings");

  const moved =
    result.tournamentRegistrations +
    result.playerOneMatches +
    result.playerTwoMatches +
    result.wonMatches +
    result.matchResultSubmissions +
    result.notifications;

  return redirectWithStatus(request, returnTo, "updated", `Аккаунт перенесен. Обновлено связанных записей: ${moved}.`);
}
