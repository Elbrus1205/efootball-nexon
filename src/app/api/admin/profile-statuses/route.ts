import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ProfileStatusType, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { grantManualProfileStatuses, manualProfileStatusDrafts } from "@/lib/profile-statuses";

function redirectToStatuses(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/statuses", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const session = await requireRole([UserRole.FOUNDER]);
  const formData = await request.formData();
  const playerQuery = String(formData.get("player") ?? "").trim();
  const requestedTypes = formData.getAll("statusTypes").map((value) => String(value)) as ProfileStatusType[];
  const allowedTypes = new Set<ProfileStatusType>(manualProfileStatusDrafts.map((draft) => draft.type));
  const statusTypes = requestedTypes.filter((type) => allowedTypes.has(type));

  if (!playerQuery) {
    return redirectToStatuses(request, { error: "Введите никнейм, email или ID игрока." });
  }

  if (!statusTypes.length) {
    return redirectToStatuses(request, { error: "Выберите хотя бы один статус." });
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { nickname: { equals: playerQuery, mode: "insensitive" } },
        { name: { equals: playerQuery, mode: "insensitive" } },
        { email: { equals: playerQuery, mode: "insensitive" } },
        { publicId: playerQuery },
        { efootballUid: playerQuery },
        { telegramUsername: { equals: playerQuery.replace(/^@/, ""), mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (!user) {
    return redirectToStatuses(request, { error: "Игрок не найден. Проверьте никнейм, email или ID." });
  }

  const statuses = await grantManualProfileStatuses({
    userId: user.id,
    adminId: session.user.id,
    statusTypes,
  });

  revalidatePath("/admin/statuses");
  revalidatePath(`/players/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/edit");

  return redirectToStatuses(request, { statusAdded: String(statuses.length) });
}
