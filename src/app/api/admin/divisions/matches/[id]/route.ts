import { DivisionMatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { cancelDivisionMatch, finishDivisionMatch } from "@/lib/services/divisions";
import { db } from "@/lib/db";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePermission("divisions.manage");
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "cancel") {
    const match = await cancelDivisionMatch(params.id, typeof body?.adminNote === "string" ? body.adminNote : null);
    return NextResponse.json({ match });
  }

  if (action === "confirm") {
    const playerOneScore = Number(body?.playerOneScore);
    const playerTwoScore = Number(body?.playerTwoScore);
    if (!Number.isInteger(playerOneScore) || !Number.isInteger(playerTwoScore) || playerOneScore < 0 || playerTwoScore < 0) {
      return NextResponse.json({ error: "Введите корректный счет." }, { status: 400 });
    }
    const match = await finishDivisionMatch(params.id, playerOneScore, playerTwoScore, {
      adminNote: typeof body?.adminNote === "string" ? body.adminNote : null,
    });
    return NextResponse.json({ match });
  }

  if (action === "dispute") {
    const match = await db.divisionMatch.update({
      where: { id: params.id },
      data: { status: DivisionMatchStatus.DISPUTED, adminNote: typeof body?.adminNote === "string" ? body.adminNote : null },
    });
    return NextResponse.json({ match });
  }

  return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
}
