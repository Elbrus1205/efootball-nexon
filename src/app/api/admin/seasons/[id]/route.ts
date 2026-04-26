import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { deleteSeason } from "@/lib/services/seasons";

function redirectToSeasons(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/seasons", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function isDeleteConfirmed(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().toUpperCase() === "УДАЛИТЬ";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();

  try {
    if (formData.get("_method") !== "delete") {
      throw new Error("Неизвестное действие.");
    }

    if (!isDeleteConfirmed(formData.get("confirmation"))) {
      throw new Error("Введите УДАЛИТЬ для подтверждения удаления сезона.");
    }

    await deleteSeason(params.id);
    revalidatePath("/admin/seasons");
    revalidatePath("/ratings");
    return redirectToSeasons(request, { deleted: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить сезон.";
    return redirectToSeasons(request, { error: message });
  }
}
