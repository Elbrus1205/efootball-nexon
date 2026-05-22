import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { isDivisionAdminRole, submitDivisionScore } from "@/lib/services/divisions";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!isDivisionAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Режим дивизионов доступен только администраторам." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const playerOneScore = Number(body?.playerOneScore);
  const playerTwoScore = Number(body?.playerTwoScore);

  if (
    !Number.isInteger(playerOneScore) ||
    !Number.isInteger(playerTwoScore) ||
    playerOneScore < 0 ||
    playerTwoScore < 0 ||
    playerOneScore > 99 ||
    playerTwoScore > 99
  ) {
    return NextResponse.json({ error: "Введите корректный счет от 0 до 99." }, { status: 400 });
  }

  try {
    const match = await submitDivisionScore({
      matchId: params.id,
      userId: session.user.id,
      playerOneScore,
      playerTwoScore,
    });

    return NextResponse.json({ match });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось отправить счет." }, { status: 400 });
  }
}
