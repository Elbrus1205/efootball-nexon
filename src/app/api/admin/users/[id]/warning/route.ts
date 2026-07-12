import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";

const MAX_WARNINGS = 3;
const TOURNAMENT_BAN_DAYS = 120;

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = typeof value === "string" ? value : "";
  return returnTo.startsWith("/admin/users") ? returnTo : "/admin/users";
}

function redirectWithStatus(request: Request, returnTo: string, key: "updated" | "error", message: string) {
  const url = new URL(returnTo, getRequestBaseUrl(request));
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("users.ban");
  const formData = await request.formData();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (params.id === session.user.id) {
    return redirectWithStatus(request, returnTo, "error", "Нельзя выдать предупреждение самому себе.");
  }

  if (reason.length > 500) {
    return redirectWithStatus(request, returnTo, "error", "Причина предупреждения должна быть не длиннее 500 символов.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, isBanned: true },
  });

  if (!targetUser) {
    return redirectWithStatus(request, returnTo, "error", "Пользователь не найден.");
  }

  const now = new Date();
  const bannedUntil = new Date(now.getTime() + TOURNAMENT_BAN_DAYS * 24 * 60 * 60 * 1000);
  const result = await db.$transaction(async (tx) => {
    const currentWarnings = await tx.userWarning.count({ where: { userId: params.id } });

    if (currentWarnings >= MAX_WARNINGS) {
      return { status: "limit" as const, warningsCount: currentWarnings, bannedUntil: null };
    }

    await tx.userWarning.create({
      data: {
        userId: params.id,
        issuedById: session.user.id,
        reason: reason || null,
      },
    });

    const warningsCount = currentWarnings + 1;

    if (warningsCount >= MAX_WARNINGS && !targetUser.isBanned) {
      await tx.user.update({
        where: { id: params.id },
        data: {
          isBanned: false,
          bannedAt: now,
          bannedUntil,
          banReason: reason || "3 предупреждения: запрет участия в турнирах на 120 дней.",
        },
      });
    }

    return { status: "created" as const, warningsCount, bannedUntil: warningsCount >= MAX_WARNINGS ? bannedUntil : null };
  });

  if (result.status === "limit") {
    return redirectWithStatus(request, returnTo, "error", "У игрока уже 3 предупреждения.");
  }

  await createNotification({
    userId: params.id,
    title: result.bannedUntil ? "Вы получили 3 предупреждения" : "Вы получили предупреждение",
    body: result.bannedUntil
      ? `Вам выдано ${result.warningsCount}/3 предупреждений. Участие в турнирах заблокировано на 120 дней.`
      : `Вам выдано предупреждение ${result.warningsCount}/3.${reason ? ` Причина: ${reason}` : ""}`,
    type: NotificationType.SYSTEM,
    link: "/dashboard",
    dedupeWithinHours: 1,
  });

  revalidatePath("/admin/users");

  return redirectWithStatus(
    request,
    returnTo,
    "updated",
    result.bannedUntil ? "Выдано 3 предупреждение. Игрок заблокирован от участия в турнирах на 120 дней." : "Предупреждение выдано.",
  );
}
