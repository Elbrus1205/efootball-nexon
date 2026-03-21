import { NextResponse } from "next/server";
import { MatchStatus, NotificationType, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { advanceMatch } from "@/lib/services/tournaments";
import { createNotification } from "@/lib/services/notifications";
import { reviewSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const formData = await request.formData();
  const body = reviewSchema.parse({
    action: formData.get("action"),
    moderatorComment: formData.get("moderatorComment"),
  });

  const submission = await db.matchResultSubmission.findFirst({
    where: { matchId: params.id },
    orderBy: { createdAt: "desc" },
  });

  const match = await db.match.findUnique({
    where: { id: params.id },
    include: { player1: true, player2: true },
  });

  if (!submission || !match) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  await db.matchResultSubmission.update({
    where: { id: submission.id },
    data: {
      moderatorComment: body.moderatorComment,
      reviewedAt: new Date(),
    },
  });

  if (body.action === "approve") {
    const winnerId = submission.player1Score >= submission.player2Score ? match.player1Id : match.player2Id;
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;

    if (winnerId) {
      await advanceMatch(match.id, winnerId, loserId);
    }

    await db.match.update({
      where: { id: params.id },
      data: { status: MatchStatus.CONFIRMED },
    });
  } else {
    await db.match.update({
      where: { id: params.id },
      data: { status: MatchStatus.REJECTED },
    });
  }

  const targets = [match.player1Id, match.player2Id].filter(Boolean) as string[];
  await Promise.all(
    targets.map((userId) =>
      createNotification({
        userId,
        title: body.action === "approve" ? "Результат подтверждён" : "Результат отклонён",
        body: body.moderatorComment,
        type: NotificationType.RESULT,
        link: `/tournaments/${match.tournamentId}`,
      }),
    ),
  );

  return NextResponse.redirect(new URL("/admin/moderation", process.env.NEXTAUTH_URL));
}
