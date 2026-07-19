import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/request-rate-limit";
import { syncTelegramUsernameById } from "@/lib/services/telegram-username-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth();

  const limited = enforceRateLimit(
    request,
    "telegram-username-sync",
    { limit: 5, windowMs: 60_000 },
    session.user.id,
  );
  if (limited) return limited;

  const result = await syncTelegramUsernameById(session.user.id);

  if (result.outcome === "unavailable") {
    return NextResponse.json(
      {
        error:
          "Не удалось получить данные из Telegram. Убедитесь, что Telegram привязан и вы не заблокировали бота, затем напишите боту /start.",
      },
      { status: 409 },
    );
  }

  if (result.outcome === "error") {
    return NextResponse.json({ error: "Не удалось синхронизировать профиль Telegram. Попробуйте позже." }, { status: 500 });
  }

  const changed = result.outcome === "updated";
  return NextResponse.json({
    ok: true,
    changed,
    username: result.currentUsername,
    message: changed
      ? `Профиль Telegram обновлён${result.currentUsername ? ` (@${result.currentUsername})` : ""}.`
      : "Профиль Telegram уже актуален.",
  });
}
