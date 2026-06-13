import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ProfileStatusType } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { grantManualProfileStatuses, manualProfileStatusDrafts } from "@/lib/profile-statuses";

function redirectToStatuses(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/statuses", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function normalizeYoutubeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    if (hostname !== "youtube.com" && hostname !== "youtu.be" && hostname !== "m.youtube.com") {
      return null;
    }

    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await requirePermission("profileStatuses.manage");
  const formData = await request.formData();
  const playerQuery = String(formData.get("player") ?? "").trim();
  const requestedTypes = formData.getAll("statusTypes").map((value) => String(value)) as ProfileStatusType[];
  const allowedTypes = new Set<ProfileStatusType>(manualProfileStatusDrafts.map((draft) => draft.type));
  const statusTypes = requestedTypes.filter((type) => allowedTypes.has(type));
  const ambassadorSelected = statusTypes.includes(ProfileStatusType.AMBASSADOR);
  const ambassadorYoutubeUrl = normalizeYoutubeUrl(String(formData.get("youtubeUrl") ?? ""));
  const ambassadorYoutubeChannelTitle = String(formData.get("youtubeChannelTitle") ?? "").trim();

  if (!playerQuery) {
    return redirectToStatuses(request, { error: "Введите имя, email или ID игрока." });
  }

  if (!statusTypes.length) {
    return redirectToStatuses(request, { error: "Выберите хотя бы один статус." });
  }

  if (ambassadorSelected && !ambassadorYoutubeUrl) {
    return redirectToStatuses(request, { error: "Для статуса Амбассадор укажите корректную ссылку YouTube." });
  }

  if (ambassadorSelected && (ambassadorYoutubeChannelTitle.length < 2 || ambassadorYoutubeChannelTitle.length > 64)) {
    return redirectToStatuses(request, { error: "Название YouTube-канала должно быть от 2 до 64 символов." });
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { name: { equals: playerQuery, mode: "insensitive" } },
        { email: { equals: playerQuery, mode: "insensitive" } },
        { publicId: playerQuery },
        { telegramUsername: { equals: playerQuery.replace(/^@/, ""), mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (!user) {
    return redirectToStatuses(request, { error: "Игрок не найден. Проверьте имя, email или ID." });
  }

  const statuses = await grantManualProfileStatuses({
    userId: user.id,
    adminId: session.user.id,
    statusTypes,
    ambassadorYoutubeUrl: ambassadorSelected ? ambassadorYoutubeUrl ?? undefined : undefined,
    ambassadorYoutubeChannelTitle: ambassadorSelected ? ambassadorYoutubeChannelTitle : undefined,
  });

  revalidatePath("/admin/statuses");
  revalidatePath(`/players/${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/edit");

  return redirectToStatuses(request, { statusAdded: String(statuses.length) });
}

