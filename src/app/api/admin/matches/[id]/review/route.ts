import { NextResponse } from "next/server";
import { MatchStatus, NotificationType, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/services/admin-actions";
import { resolveConfirmedMatch, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";
import { createNotification } from "@/lib/services/notifications";
import { reviewSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const formData = await request.formData();
  const returnTo = String(formData.get("returnTo") || `/admin/matches/${params.id}`);
  const body = reviewSchema.parse({
    action: formData.get("action"),
    moderatorComment: formData.get("moderatorComment"),
    player1Score: formData.get("player1Score") || undefined,
    player2Score: formData.get("player2Score") || undefined,
  });

  const submission = await db.matchResultSubmission.findFirst({
    where: { matchId: params.id },
    orderBy: { createdAt: "desc" },
  });

  const match = await db.match.findUnique({
    where: { id: params.id },
    include: { player1: true, player2: true },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (submission) {
    await db.matchResultSubmission.update({
      where: { id: submission.id },
      data: {
        moderatorComment: body.moderatorComment,
        reviewedAt: new Date(),
      },
    });
  }

  if (body.action === "approve") {
    const player1Score = body.player1Score ?? submission?.player1Score;
    const player2Score = body.player2Score ?? submission?.player2Score;

    if (player1Score == null || player2Score == null) {
      return NextResponse.json({ error: "Укажите финальный счёт матча." }, { status: 400 });
    }

    if (match.isPenaltyTiebreak && player1Score === player2Score) {
      return NextResponse.json({ error: "В серии пенальти нельзя подтвердить ничью." }, { status: 400 });
    }

    await db.match.update({
      where: { id: params.id },
      data: {
        player1Score,
        player2Score,
        winnerId: player1Score > player2Score ? match.player1Id : player1Score < player2Score ? match.player2Id : null,
        status: MatchStatus.CONFIRMED,
      },
    });

    await resolveConfirmedMatch(match.id);
  } else if (body.action === "reject") {
    await db.match.update({
      where: { id: params.id },
      data: { status: MatchStatus.REJECTED },
    });
  } else {
    await db.match.update({
      where: { id: params.id },
      data: { status: MatchStatus.DISPUTED },
    });
  }

  await syncTournamentLifecycleStatus(match.tournamentId);

  const targets = [match.player1Id, match.player2Id].filter(Boolean) as string[];
  await Promise.all(
    targets.map((userId) =>
      createNotification({
        userId,
        title:
          body.action === "approve"
            ? "Результат подтверждён"
            : body.action === "reject"
              ? "Результат отклонён"
              : "Матч отправлен в спор",
        body: body.moderatorComment,
        type: NotificationType.RESULT,
        link: `/tournaments/${match.tournamentId}`,
      }),
    ),
  );

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: match.tournamentId,
    entityType: "MATCH_REVIEW",
    entityId: match.id,
    actionType: body.action === "approve" ? "APPROVE" : body.action === "reject" ? "REJECT" : "UPDATE",
    afterJson: {
      action: body.action,
      moderatorComment: body.moderatorComment,
      matchStatus: body.action === "approve" ? MatchStatus.CONFIRMED : body.action === "reject" ? MatchStatus.REJECTED : MatchStatus.DISPUTED,
      player1Score: body.player1Score,
      player2Score: body.player2Score,
    },
  });

  return NextResponse.redirect(new URL(returnTo, process.env.NEXTAUTH_URL));
}
