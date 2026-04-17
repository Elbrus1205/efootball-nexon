import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { banSchema } from "@/lib/validators";

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = typeof value === "string" ? value : "";
  return returnTo.startsWith("/admin/users") ? returnTo : "/admin/users";
}

function redirectWithStatus(request: Request, returnTo: string, key: "updated" | "error", message: string) {
  const url = new URL(returnTo, request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));
  const parsed = banSchema.safeParse({
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
    bannedUntil: formData.get("bannedUntil") ?? "",
  });

  if (!parsed.success) {
    return redirectWithStatus(request, returnTo, "error", parsed.error.issues[0]?.message ?? "Не удалось применить бан.");
  }

  const body = parsed.data;

  if (params.id === session.user.id && body.action !== "unban") {
    return redirectWithStatus(request, returnTo, "error", "Нельзя забанить свой аккаунт из админ-панели.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!targetUser) {
    return redirectWithStatus(request, returnTo, "error", "Пользователь не найден.");
  }

  const now = new Date();
  const data =
    body.action === "unban"
      ? {
          isBanned: false,
          banReason: null,
          bannedUntil: null,
          bannedAt: null,
        }
      : body.action === "permanent"
        ? {
            isBanned: true,
            banReason: body.reason?.trim() || null,
            bannedUntil: null,
            bannedAt: now,
          }
        : {
            isBanned: false,
            banReason: body.reason?.trim() || null,
            bannedUntil: new Date(body.bannedUntil ?? ""),
            bannedAt: now,
          };

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.id },
      data,
    });

    if (body.action === "permanent") {
      await tx.securitySession.updateMany({
        where: {
          userId: params.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.session.deleteMany({
        where: { userId: params.id },
      });
    }
  });

  revalidatePath("/admin/users");

  const status =
    body.action === "unban"
      ? "Бан снят."
      : body.action === "permanent"
        ? "Игрок забанен навсегда, активные сессии закрыты."
        : "Временный бан выдан.";

  return redirectWithStatus(request, returnTo, "updated", status);
}
