import { NextResponse } from "next/server";
import { MatchStatus, NotificationType, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { createNotification } from "@/lib/services/notifications";
import { resultSubmissionSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const body = resultSubmissionSchema.parse(await request.json());

  const match = await db.match.findUnique({ where: { id: params.id } });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  await db.matchResultSubmission.create({
    data: {
      matchId: params.id,
      submittedById: session.user.id,
      player1Score: body.player1Score,
      player2Score: body.player2Score,
      screenshotUrl: body.screenshotUrl || null,
      comment: body.comment || null,
    },
  });

  await db.match.update({
    where: { id: params.id },
    data: {
      player1Score: body.player1Score,
      player2Score: body.player2Score,
      status: MatchStatus.RESULT_SUBMITTED,
    },
  });

  const moderators = await db.user.findMany({
    where: { role: { in: [UserRole.ADMIN, UserRole.MODERATOR] } },
  });

  await Promise.all(
    moderators.map((moderator) =>
      createNotification({
        userId: moderator.id,
        title: "Новый результат на проверке",
        body: `Матч ${params.id} ожидает модерации.`,
        type: NotificationType.RESULT,
        link: "/admin/moderation",
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
