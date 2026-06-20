import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

const PLAYER_RATING_RESET_PREFIX = "playerRatingResetAt:";
const PLAYER_STATS_RESET_PREFIX = "playerStatsResetAt:";

type ResetAction = "rating" | "stats" | "statuses" | "full";

const actionLabels: Record<ResetAction, string> = {
  rating: "Рейтинг игрока обнулен.",
  stats: "Статистика игрока обнулена.",
  statuses: "Статусы игрока обнулены.",
  full: "Рейтинг, статистика и статусы игрока обнулены.",
};

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = typeof value === "string" ? value : "";
  return returnTo.startsWith("/admin/users") ? returnTo : "/admin/users";
}

function parseResetAction(value: FormDataEntryValue | null): ResetAction | null {
  return value === "rating" || value === "stats" || value === "statuses" || value === "full" ? value : null;
}

function redirectWithStatus(request: Request, returnTo: string, key: "updated" | "error", message: string) {
  const url = new URL(returnTo, getRequestBaseUrl(request));
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requirePermission("users.ban");
  const formData = await request.formData();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));
  const action = parseResetAction(formData.get("action"));

  if (!action) {
    return redirectWithStatus(request, returnTo, "error", "Выберите действие для обнуления.");
  }

  if (params.id === session.user.id) {
    return redirectWithStatus(request, returnTo, "error", "Нельзя обнулить свой аккаунт из админ-панели.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, publicId: true },
  });

  if (!targetUser) {
    return redirectWithStatus(request, returnTo, "error", "Пользователь не найден.");
  }

  const now = new Date().toISOString();
  const shouldResetRating = action === "rating" || action === "full";
  const shouldResetStats = action === "stats" || action === "full";
  const shouldResetStatuses = action === "statuses" || action === "full";

  await db.$transaction(async (tx) => {
    if (shouldResetRating) {
      await tx.siteContent.upsert({
        where: { key: `${PLAYER_RATING_RESET_PREFIX}${params.id}` },
        create: { key: `${PLAYER_RATING_RESET_PREFIX}${params.id}`, body: now },
        update: { body: now },
      });
      await tx.siteContent.deleteMany({ where: { key: `ratingOverride:${params.id}` } });
    }

    if (shouldResetStats) {
      await tx.siteContent.upsert({
        where: { key: `${PLAYER_STATS_RESET_PREFIX}${params.id}` },
        create: { key: `${PLAYER_STATS_RESET_PREFIX}${params.id}`, body: now },
        update: { body: now },
      });
    }

    if (shouldResetStatuses) {
      await tx.userProfileStatus.deleteMany({ where: { userId: params.id } });
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/ratings");
  revalidatePath(`/players/${targetUser.publicId}`);
  revalidatePath(`/players/${targetUser.id}`);
  revalidatePath("/players");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/edit");

  return redirectWithStatus(request, returnTo, "updated", actionLabels[action]);
}
